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
import { SceneDocumentSchema, type SceneDocument } from "@riff3d/ecson";

/** Transaction origin tag for local edits (prevents feedback loops). */
export const ORIGIN_LOCAL = "riff3d:local-edit";

/** Transaction origin tag for initial Y.Doc population. */
export const ORIGIN_INIT = "riff3d:init";

/**
 * Collab document shape version. Incremented when the Y.Doc structure
 * changes (separate from the ECSON schemaVersion which tracks the
 * document format). On load, old Y.Docs are migrated to the current
 * shape version before reconstruction.
 */
export const COLLAB_SHAPE_VERSION = 1;

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
    yMeta.set("_shapeVersion", COLLAB_SHAPE_VERSION);

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

    // Wiring (event wires between entities)
    const yWiring = yDoc.getArray("wiring");
    for (const wire of ecsonDoc.wiring) {
      yWiring.push([wire]);
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

    if (entityId === "__environment__") {
      // Environment edits use a virtual entityId -- sync environment Y.Map
      const yEnvironment = yDoc.getMap("environment");
      for (const [key, value] of Object.entries(ecsonDoc.environment)) {
        const existing = yEnvironment.get(key);
        if (JSON.stringify(existing) !== JSON.stringify(value)) {
          yEnvironment.set(key, value);
        }
      }
    } else if (entityId) {
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

      // Sync wiring
      syncWiring(yDoc, ecsonDoc.wiring);

      // Sync metadata
      const yMetadata = yDoc.getMap("metadata");
      for (const [key, value] of Object.entries(ecsonDoc.metadata)) {
        const existing = yMetadata.get(key);
        if (JSON.stringify(existing) !== JSON.stringify(value)) {
          yMetadata.set(key, value);
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
 * Sync wiring array from ECSON to Y.Doc.
 * Replaces the entire Y.Array content with the current wiring state.
 */
function syncWiring(
  yDoc: Y.Doc,
  wiring: ReadonlyArray<Record<string, unknown>>,
): void {
  const yWiring = yDoc.getArray("wiring");
  const currentJson = JSON.stringify(yWiring.toJSON());
  const targetJson = JSON.stringify(wiring);
  if (currentJson !== targetJson) {
    yWiring.delete(0, yWiring.length);
    for (const wire of wiring) {
      yWiring.push([wire]);
    }
  }
}

/**
 * Migrate a Y.Doc from an older collab shape version to the target version.
 *
 * Version 0 (implicit -- no _shapeVersion field) is the pre-versioning shape.
 * Migration from 0 -> 1 simply stamps the version field (no structural changes,
 * since version 1 IS the current shape). This establishes the migration pattern
 * for future shape changes without over-engineering.
 */
function migrateCollabShape(
  yDoc: Y.Doc,
  fromVersion: number,
  toVersion: number,
): void {
  const yMeta = yDoc.getMap("meta");

  // Version 0 -> 1: No structural changes. Just stamp the version field.
  if (fromVersion < 1 && toVersion >= 1) {
    yMeta.set("_shapeVersion", 1);
  }

  // Future migrations would chain here:
  // if (fromVersion < 2 && toVersion >= 2) { ... }
}

/**
 * Reconstruct a full ECSON SceneDocument from Y.Doc state.
 *
 * Used when remote changes arrive to rebuild the ECSON from the
 * authoritative Y.Doc state. Validates the result against the
 * SceneDocumentSchema. Returns null on validation failure (fail-closed)
 * to prevent malformed state from propagating into the editor.
 */
export function yDocToEcson(yDoc: Y.Doc): SceneDocument | null {
  const yMeta = yDoc.getMap("meta");

  // Check and migrate collab shape version (CF-P5-04).
  // Version 0 is implicit (no _shapeVersion field) -- pre-versioning docs.
  const shapeVersion = (yMeta.get("_shapeVersion") as number) ?? 0;
  if (shapeVersion < COLLAB_SHAPE_VERSION) {
    migrateCollabShape(yDoc, shapeVersion, COLLAB_SHAPE_VERSION);
  }

  const yEntities = yDoc.getMap("entities");
  const yAssets = yDoc.getMap("assets");
  const yEnvironment = yDoc.getMap("environment");
  const yMetadata = yDoc.getMap("metadata");
  const yWiring = yDoc.getArray("wiring");

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

  const raw = {
    id: (yMeta.get("id") as string) || "",
    name: (yMeta.get("name") as string) || "",
    schemaVersion: (yMeta.get("schemaVersion") as number) || 1,
    rootEntityId: (yMeta.get("rootEntityId") as string) || "",
    entities,
    assets: yAssets.toJSON(),
    wiring: yWiring.toJSON(),
    environment: yEnvironment.toJSON(),
    metadata: yMetadata.toJSON(),
  };

  // Validate against ECSON schema — fail-closed to prevent malformed
  // Y.Doc state from propagating into the editor store.
  const result = SceneDocumentSchema.safeParse(raw);
  if (result.success) {
    return result.data;
  }

  // Fail closed: log the error and return null. Callers must preserve
  // the last-known-good document when this returns null.
  console.error(
    "[sync-bridge] Y.Doc→ECSON validation failed (rejecting update):",
    result.error.issues,
  );
  return null;
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
  const yMetadata = yDoc.getMap("metadata");
  const yWiring = yDoc.getArray("wiring");

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
      // Fail-closed: only propagate valid ECSON. If validation fails,
      // the editor preserves its last-known-good document.
      if (ecson) {
        onRemoteChange(ecson);
      }
    }, 50);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Y.observeDeep callback type
  function handleMapEvent(_events: Y.YEvent<any>[], transaction: Y.Transaction): void {
    if (
      transaction.origin === ORIGIN_LOCAL ||
      transaction.origin === ORIGIN_INIT
    ) {
      return;
    }
    scheduleRebuild();
  }

  function handleArrayEvent(
    _event: Y.YArrayEvent<unknown>,
    transaction: Y.Transaction,
  ): void {
    if (
      transaction.origin === ORIGIN_LOCAL ||
      transaction.origin === ORIGIN_INIT
    ) {
      return;
    }
    scheduleRebuild();
  }

  yEntities.observeDeep(handleMapEvent);
  yAssets.observeDeep(handleMapEvent);
  yEnvironment.observeDeep(handleMapEvent);
  yMetadata.observeDeep(handleMapEvent);
  yWiring.observe(handleArrayEvent);

  return () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    yEntities.unobserveDeep(handleMapEvent);
    yAssets.unobserveDeep(handleMapEvent);
    yEnvironment.unobserveDeep(handleMapEvent);
    yMetadata.unobserveDeep(handleMapEvent);
    yWiring.unobserve(handleArrayEvent);
  };
}
