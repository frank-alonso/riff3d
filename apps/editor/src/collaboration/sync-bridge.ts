/**
 * ECSON <-> Y.Doc Bidirectional Sync Bridge
 *
 * This is the critical integration seam between the PatchOps-driven
 * architecture and Yjs CRDTs. ECSON remains the local source of truth;
 * Y.Doc is the sync transport.
 *
 * Local edit flow:
 *   User action -> dispatchOp(op) -> applyOp(ecsonDoc, op)
 *     -> syncToYDoc(yDoc, ecsonDoc) -> Y.Doc broadcasts to peers
 *     -> compile(ecsonDoc) -> adapter
 *
 * Remote sync flow:
 *   Y.Doc observe -> yDocToEcson(yDoc) -> loadProject(ecson)
 *     -> compile -> adapter
 *
 * Feedback loop prevention:
 *   All local Y.Doc writes are tagged with ORIGIN_LOCAL.
 *   The Y.Doc observer skips events with ORIGIN_LOCAL origin.
 *   Remote changes arrive with the remote client's origin (their clientID).
 */
import * as Y from "yjs";
import type { SceneDocument } from "@riff3d/ecson";

/** Transaction origin tag for local edits (prevents feedback loops). */
export const ORIGIN_LOCAL = "riff3d:local-edit";

/** Transaction origin tag for initial Y.Doc population. */
export const ORIGIN_INIT = "riff3d:init";

/**
 * Initialize a Y.Doc from an ECSON SceneDocument.
 *
 * Called on the first collaborative session when the Y.Doc is empty.
 * Populates the Y.Doc with nested Y.Maps for granular per-property sync.
 *
 * Entity structure: Y.Map<entityId, Y.Map<propKey, value>>
 * This enables per-property LWW merge (success criterion #2).
 */
export function initializeYDoc(yDoc: Y.Doc, ecsonDoc: SceneDocument): void {
  yDoc.transact(() => {
    // Meta
    const yMeta = yDoc.getMap("meta");
    yMeta.set("id", ecsonDoc.id);
    yMeta.set("name", ecsonDoc.name);
    yMeta.set("schemaVersion", ecsonDoc.schemaVersion);
    yMeta.set("rootEntityId", ecsonDoc.rootEntityId);

    // Entities as nested Y.Maps (per-property granularity)
    const yEntities = yDoc.getMap("entities");
    for (const [entityId, entity] of Object.entries(ecsonDoc.entities)) {
      const yEntity = new Y.Map<unknown>();
      for (const [key, value] of Object.entries(entity)) {
        yEntity.set(key, value);
      }
      yEntities.set(entityId, yEntity);
    }

    // Assets (atomic -- replaced whole per asset)
    const yAssets = yDoc.getMap("assets");
    for (const [assetId, asset] of Object.entries(ecsonDoc.assets)) {
      yAssets.set(assetId, asset);
    }

    // Environment
    const yEnvironment = yDoc.getMap("environment");
    for (const [key, value] of Object.entries(ecsonDoc.environment)) {
      yEnvironment.set(key, value);
    }

    // Metadata
    const yMetadata = yDoc.getMap("metadata");
    for (const [key, value] of Object.entries(ecsonDoc.metadata)) {
      yMetadata.set(key, value);
    }
  }, ORIGIN_INIT);
}

/**
 * Sync ECSON changes to Y.Doc after a local PatchOp.
 *
 * If an entityId is provided, only that entity is synced (property change).
 * If no entityId, the full entity map is synced (structural ops like
 * CreateEntity/DeleteEntity).
 *
 * Uses JSON.stringify comparison to avoid no-op writes that would
 * generate unnecessary Y.Doc updates.
 */
export function syncToYDoc(
  yDoc: Y.Doc,
  ecsonDoc: SceneDocument,
  entityId?: string,
): void {
  yDoc.transact(() => {
    const yEntities = yDoc.getMap("entities");

    if (entityId) {
      // Single entity sync
      const entity = ecsonDoc.entities[entityId];
      if (entity) {
        syncEntity(yEntities, entityId, entity);
      } else {
        // Entity was deleted
        yEntities.delete(entityId);
      }
    } else {
      // Full sync -- handle structural changes
      // Remove entities that no longer exist
      for (const key of Array.from(yEntities.keys())) {
        if (!(key in ecsonDoc.entities)) {
          yEntities.delete(key);
        }
      }
      // Sync all entities
      for (const [id, entity] of Object.entries(ecsonDoc.entities)) {
        syncEntity(yEntities, id, entity);
      }

      // Sync assets
      const yAssets = yDoc.getMap("assets");
      for (const key of Array.from(yAssets.keys())) {
        if (!(key in ecsonDoc.assets)) {
          yAssets.delete(key);
        }
      }
      for (const [assetId, asset] of Object.entries(ecsonDoc.assets)) {
        const existing = yAssets.get(assetId);
        if (JSON.stringify(existing) !== JSON.stringify(asset)) {
          yAssets.set(assetId, asset);
        }
      }

      // Sync environment
      const yEnvironment = yDoc.getMap("environment");
      for (const [key, value] of Object.entries(ecsonDoc.environment)) {
        const existing = yEnvironment.get(key);
        if (JSON.stringify(existing) !== JSON.stringify(value)) {
          yEnvironment.set(key, value);
        }
      }
    }
  }, ORIGIN_LOCAL);
}

/**
 * Sync a single entity to its Y.Map in the entities container.
 * Creates the Y.Map if it doesn't exist. Uses JSON comparison
 * to skip no-op writes.
 */
function syncEntity(
  yEntities: Y.Map<unknown>,
  entityId: string,
  entity: Record<string, unknown>,
): void {
  let yEntity = yEntities.get(entityId);
  if (!(yEntity instanceof Y.Map)) {
    yEntity = new Y.Map<unknown>();
    yEntities.set(entityId, yEntity);
  }
  const yMap = yEntity as Y.Map<unknown>;

  // Sync each top-level property
  for (const [key, value] of Object.entries(entity)) {
    const existing = yMap.get(key);
    if (JSON.stringify(existing) !== JSON.stringify(value)) {
      yMap.set(key, value);
    }
  }

  // Remove properties that no longer exist on the entity
  for (const key of Array.from(yMap.keys())) {
    if (!(key in entity)) {
      yMap.delete(key);
    }
  }
}

/**
 * Reconstruct a full ECSON SceneDocument from Y.Doc state.
 *
 * Used when remote changes arrive to rebuild the ECSON from the
 * authoritative Y.Doc state.
 */
export function yDocToEcson(yDoc: Y.Doc): SceneDocument {
  const yMeta = yDoc.getMap("meta");
  const yEntities = yDoc.getMap("entities");
  const yAssets = yDoc.getMap("assets");
  const yEnvironment = yDoc.getMap("environment");
  const yMetadata = yDoc.getMap("metadata");

  // Reconstruct entities from nested Y.Maps
  const entities: Record<string, Record<string, unknown>> = {};
  for (const [entityId, yEntity] of yEntities.entries()) {
    if (yEntity instanceof Y.Map) {
      entities[entityId] = yEntity.toJSON() as Record<string, unknown>;
    } else {
      // Fallback for plain JSON values (shouldn't happen with proper init)
      entities[entityId] = yEntity as Record<string, unknown>;
    }
  }

  // Cast through unknown because Y.Doc reconstruction produces
  // Record<string, Record<string, unknown>> for entities, which is
  // structurally compatible at runtime but not assignable in strict TS.
  return {
    id: (yMeta.get("id") as string) || "",
    name: (yMeta.get("name") as string) || "",
    schemaVersion: (yMeta.get("schemaVersion") as number) || 1,
    rootEntityId: (yMeta.get("rootEntityId") as string) || "",
    entities,
    assets: yAssets.toJSON() as Record<string, SceneDocument["assets"][string]>,
    wiring: [],
    environment: yEnvironment.toJSON() as SceneDocument["environment"],
    metadata: yMetadata.toJSON() as Record<string, unknown>,
  } as unknown as SceneDocument;
}

/**
 * Observe Y.Doc changes from remote users.
 *
 * Sets up deep observers on the entities, assets, and environment maps.
 * Skips events with ORIGIN_LOCAL or ORIGIN_INIT origin to prevent
 * feedback loops. Calls onRemoteChange with a fresh ECSON document
 * reconstructed from the Y.Doc.
 *
 * Returns a cleanup function to unsubscribe.
 */
export function observeRemoteChanges(
  yDoc: Y.Doc,
  onRemoteChange: (ecson: SceneDocument) => void,
): () => void {
  const yEntities = yDoc.getMap("entities");
  const yAssets = yDoc.getMap("assets");
  const yEnvironment = yDoc.getMap("environment");

  // Debounce to batch multiple Y.Doc events into a single ECSON rebuild.
  // Remote changes can arrive as multiple rapid Y.Doc events (e.g., a
  // BatchOp on the sender side generates multiple entity map mutations).
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleRebuild(): void {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      const ecson = yDocToEcson(yDoc);
      onRemoteChange(ecson);
    }, 50);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Y.observeDeep callback type
  function handleEvent(_events: Y.YEvent<any>[], transaction: Y.Transaction): void {
    // Skip local and init origins to prevent feedback loops
    if (
      transaction.origin === ORIGIN_LOCAL ||
      transaction.origin === ORIGIN_INIT
    ) {
      return;
    }
    scheduleRebuild();
  }

  yEntities.observeDeep(handleEvent);
  yAssets.observeDeep(handleEvent);
  yEnvironment.observeDeep(handleEvent);

  return () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    yEntities.unobserveDeep(handleEvent);
    yAssets.unobserveDeep(handleEvent);
    yEnvironment.unobserveDeep(handleEvent);
  };
}
