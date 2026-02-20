import { describe, it, expect } from "vitest";
import {
  buildTransformsParentingFixture,
  buildAdversarialFixture,
} from "@riff3d/fixtures";
import {
  type SceneDocument,
  SceneDocumentSchema,
  CURRENT_SCHEMA_VERSION,
} from "@riff3d/ecson";
import {
  type PatchOp,
  CURRENT_PATCHOP_VERSION,
  applyOps,
} from "@riff3d/patchops";
import { testReplayDeterminism, generateOpsForFixture } from "../src/replay";
import { normalizeForComparison } from "../src/round-trip";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createReplayDoc(): SceneDocument {
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

let opCounter = 0;
function makeOp(type: string, payload: Record<string, unknown>): PatchOp {
  opCounter++;
  return {
    id: `test_op_${String(opCounter).padStart(6, "0")}`,
    timestamp: 1000000 + opCounter,
    origin: "replay" as const,
    version: CURRENT_PATCHOP_VERSION,
    type,
    payload,
  } as PatchOp;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Replay determinism", () => {
  it("transforms-parenting fixture: ops applied twice produce identical results", () => {
    const fixture = buildTransformsParentingFixture();
    const ops = generateOpsForFixture(fixture);
    expect(ops.length).toBeGreaterThan(0);

    const result = testReplayDeterminism(ops);
    expect(result.passed).toBe(true);
  });

  it("adversarial fixture: ops applied twice produce identical results", () => {
    const fixture = buildAdversarialFixture();
    const ops = generateOpsForFixture(fixture);
    expect(ops.length).toBeGreaterThan(0);

    const result = testReplayDeterminism(ops);
    expect(result.passed).toBe(true);
  });

  it("interleaved ops: create, modify, delete, create again", () => {
    opCounter = 0;

    // Create an entity
    const createOp = makeOp("CreateEntity", {
      entityId: "ent_interleaved1",
      name: "InterleavedEntity",
      parentId: "replay_root_id_0",
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      tags: [],
    });

    // Add a component
    const addCompOp = makeOp("AddComponent", {
      entityId: "ent_interleaved1",
      component: { type: "MeshRenderer", properties: { meshType: "box" } },
    });

    // Modify a property
    const setPropertyOp = makeOp("SetProperty", {
      entityId: "ent_interleaved1",
      path: "name",
      value: "RenamedEntity",
      previousValue: "InterleavedEntity",
    });

    // Delete the entity (capture previous state for inverse)
    const deleteOp = makeOp("DeleteEntity", {
      entityId: "ent_interleaved1",
      previousState: {
        id: "ent_interleaved1",
        name: "RenamedEntity",
        parentId: "replay_root_id_0",
        children: [],
        components: [{ type: "MeshRenderer", properties: { meshType: "box" } }],
        tags: [],
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
        visible: true,
        locked: false,
      },
    });

    // Create a new entity in the same slot
    const createAgainOp = makeOp("CreateEntity", {
      entityId: "ent_interleaved2",
      name: "NewEntity",
      parentId: "replay_root_id_0",
      transform: {
        position: { x: 5, y: 5, z: 5 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      tags: [],
    });

    const ops = [createOp, addCompOp, setPropertyOp, deleteOp, createAgainOp];

    // Apply to two fresh documents
    const doc1 = createReplayDoc();
    const doc2 = createReplayDoc();

    applyOps(doc1, ops);
    applyOps(doc2, ops);

    const norm1 = normalizeForComparison(doc1);
    const norm2 = normalizeForComparison(doc2);

    expect(norm1).toBe(norm2);

    // Verify the final state has the new entity but not the old one
    expect(doc1.entities["ent_interleaved1"]).toBeUndefined();
    expect(doc1.entities["ent_interleaved2"]).toBeDefined();
    expect(doc1.entities["ent_interleaved2"]!.name).toBe("NewEntity");
  });
});
