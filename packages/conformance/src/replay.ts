import {
  type SceneDocument,
  type Entity,
  type AssetEntry,
  SceneDocumentSchema,
  CURRENT_SCHEMA_VERSION,
} from "@riff3d/ecson";
import { applyOps, type PatchOp, CURRENT_PATCHOP_VERSION } from "@riff3d/patchops";
import { normalizeForComparison } from "./round-trip.js";

// ---------------------------------------------------------------------------
// ID generation for replay ops
// ---------------------------------------------------------------------------

let replayOpCounter = 0;

function makeOpId(): string {
  replayOpCounter++;
  return `replay_op_${String(replayOpCounter).padStart(6, "0")}`;
}

function resetOpCounter(): void {
  replayOpCounter = 0;
}

// ---------------------------------------------------------------------------
// Replay determinism test
// ---------------------------------------------------------------------------

/**
 * Test replay determinism: applying the same ops to two fresh docs
 * produces identical results.
 *
 * 1. Create empty document, apply ops -> result1
 * 2. Create fresh empty document, apply same ops -> result2
 * 3. Compare result1 and result2 using normalizeForComparison
 */
export function testReplayDeterminism(ops: PatchOp[]): {
  passed: boolean;
  diff?: string;
} {
  try {
    // Run 1
    const doc1 = createMinimalDoc();
    applyOps(doc1, ops);

    // Run 2
    const doc2 = createMinimalDoc();
    applyOps(doc2, ops);

    const norm1 = normalizeForComparison(doc1);
    const norm2 = normalizeForComparison(doc2);

    if (norm1 === norm2) {
      return { passed: true };
    }

    return {
      passed: false,
      diff: `Documents differ after applying ${ops.length} ops`,
    };
  } catch (err: unknown) {
    return {
      passed: false,
      diff: `Error during replay: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Generate ops from fixture
// ---------------------------------------------------------------------------

/**
 * Given a fixture, generate the PatchOps that would build it from scratch.
 * This "reverse-engineers" a fixture into an operation log.
 *
 * Operations generated:
 * - CreateEntity for each entity (in topological order)
 * - AddComponent for each component
 * - AddAsset for each asset
 * - (Wiring is stored on the doc, not via PatchOps currently)
 */
export function generateOpsForFixture(fixture: SceneDocument): PatchOp[] {
  resetOpCounter();
  const ops: PatchOp[] = [];

  // Get entities in topological order (parents before children)
  const sorted = topologicalSort(fixture);

  for (const entity of sorted) {
    // Skip root -- it already exists in the minimal doc
    // Actually, we need to create ALL entities including root
    // because we start from a different minimal doc
    ops.push(makeCreateEntityOp(entity));

    // Add components
    for (const comp of entity.components) {
      ops.push(makeAddComponentOp(entity.id, comp));
    }
  }

  // Add assets
  for (const asset of Object.values(fixture.assets)) {
    ops.push(makeAddAssetOp(asset));
  }

  return ops;
}

// ---------------------------------------------------------------------------
// Create a minimal doc for replay
// ---------------------------------------------------------------------------

function createMinimalDoc(): SceneDocument {
  return SceneDocumentSchema.parse({
    id: "replay_doc_id_00",
    name: "Replay Document",
    schemaVersion: CURRENT_SCHEMA_VERSION,
    rootEntityId: "replay_root_id_0",
    entities: {
      "replay_root_id_0": {
        id: "replay_root_id_0",
        name: "Root",
        parentId: null,
        children: [],
        components: [],
        tags: [],
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
        visible: true,
        locked: false,
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Op builders
// ---------------------------------------------------------------------------

function makeCreateEntityOp(entity: Entity): PatchOp {
  return {
    id: makeOpId(),
    timestamp: Date.now(),
    origin: "replay",
    version: CURRENT_PATCHOP_VERSION,
    type: "CreateEntity",
    payload: {
      entityId: entity.id,
      name: entity.name,
      parentId: entity.parentId,
      transform: {
        position: { ...entity.transform.position },
        rotation: { ...entity.transform.rotation },
        scale: { ...entity.transform.scale },
      },
      tags: [...entity.tags],
    },
  } as PatchOp;
}

function makeAddComponentOp(
  entityId: string,
  comp: { type: string; properties: Record<string, unknown> },
): PatchOp {
  return {
    id: makeOpId(),
    timestamp: Date.now(),
    origin: "replay",
    version: CURRENT_PATCHOP_VERSION,
    type: "AddComponent",
    payload: {
      entityId,
      component: {
        type: comp.type,
        properties: { ...comp.properties },
      },
    },
  } as PatchOp;
}

function makeAddAssetOp(asset: AssetEntry): PatchOp {
  return {
    id: makeOpId(),
    timestamp: Date.now(),
    origin: "replay",
    version: CURRENT_PATCHOP_VERSION,
    type: "AddAsset",
    payload: {
      asset: {
        id: asset.id,
        type: asset.type,
        name: asset.name,
        uri: asset.uri,
        data: asset.data,
        metadata: { ...asset.metadata },
      },
    },
  } as PatchOp;
}

// ---------------------------------------------------------------------------
// Topological sort helper
// ---------------------------------------------------------------------------

function topologicalSort(doc: SceneDocument): Entity[] {
  const sorted: Entity[] = [];
  const queue: string[] = [doc.rootEntityId];

  while (queue.length > 0) {
    const entityId = queue.shift()!;
    const entity = doc.entities[entityId];
    if (!entity) continue;

    sorted.push(entity);

    for (const childId of entity.children) {
      queue.push(childId);
    }
  }

  return sorted;
}
