import { describe, expect } from "vitest";
import { test, fc } from "@fast-check/vitest";
import {
  type SceneDocument,
  SceneDocumentSchema,
  CURRENT_SCHEMA_VERSION,
} from "@riff3d/ecson";
import {
  type PatchOp,
  CURRENT_PATCHOP_VERSION,
  applyOp,
  applyOps,
} from "@riff3d/patchops";
import { normalizeForComparison } from "../src/round-trip";

// ---------------------------------------------------------------------------
// Fixed seed for reproducibility in CI
// ---------------------------------------------------------------------------

const FC_PARAMS = {
  seed: 42,
  numRuns: 100,
} as const;

// ---------------------------------------------------------------------------
// Model-based testing: track document state for valid op generation
// ---------------------------------------------------------------------------

/**
 * A stateful arbitrary that generates valid op sequences.
 * Tracks which entities exist to ensure ops reference valid targets.
 */

const ROOT_ID = "prop_root_id_0000";

/** Entity ID arbitrary: 16 alphanumeric characters */
const entityIdArb = fc.stringMatching(/^[0-9a-z]{16}$/);

const vec3Arb = fc.record({
  x: fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
  y: fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
  z: fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
});

const quaternionArb = fc.record({
  x: fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true }),
  y: fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true }),
  z: fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true }),
  w: fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true }),
});

const transformArb = fc.record({
  position: vec3Arb,
  rotation: quaternionArb,
  scale: vec3Arb,
});

/**
 * Generate a valid op sequence using the commands pattern.
 * Each op is generated with full knowledge of current document state.
 */
function generateValidOpSequence(
  length: number,
): fc.Arbitrary<PatchOp[]> {
  return fc.tuple(
    fc.array(entityIdArb, { minLength: length, maxLength: length }),
    fc.array(transformArb, { minLength: length, maxLength: length }),
    fc.array(
      fc.constantFrom("MeshRenderer", "Light", "Camera"),
      { minLength: length, maxLength: length },
    ),
  ).map(([ids, transforms, compTypes]) => {
    const ops: PatchOp[] = [];
    const existingEntities = new Set<string>([ROOT_ID]);
    let opCounter = 0;

    for (let i = 0; i < length; i++) {
      opCounter++;
      const entityId = ids[i]!;

      // If entity doesn't exist yet, create it
      if (!existingEntities.has(entityId)) {
        ops.push({
          id: `prop_op_${String(opCounter).padStart(6, "0")}`,
          timestamp: 1000000 + opCounter,
          origin: "replay",
          version: CURRENT_PATCHOP_VERSION,
          type: "CreateEntity",
          payload: {
            entityId,
            name: `Entity_${i}`,
            parentId: ROOT_ID,
            transform: transforms[i],
            tags: [],
          },
        } as PatchOp);
        existingEntities.add(entityId);
      }

      // Add a component to the entity
      opCounter++;
      ops.push({
        id: `prop_op_${String(opCounter).padStart(6, "0")}`,
        timestamp: 1000000 + opCounter,
        origin: "replay",
        version: CURRENT_PATCHOP_VERSION,
        type: "AddComponent",
        payload: {
          entityId,
          component: {
            type: compTypes[i],
            properties: { generated: true, index: i },
          },
        },
      } as PatchOp);
    }

    return ops;
  });
}

/**
 * Create a minimal document for property testing.
 */
function createPropertyDoc(): SceneDocument {
  return SceneDocumentSchema.parse({
    id: "prop_doc_id_00000",
    name: "Property Test Document",
    schemaVersion: CURRENT_SCHEMA_VERSION,
    rootEntityId: ROOT_ID,
    entities: {
      [ROOT_ID]: {
        id: ROOT_ID,
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
// Property 1: Apply-inverse identity
// ---------------------------------------------------------------------------

describe("Property tests", () => {
  test.prop(
    [generateValidOpSequence(5)],
    FC_PARAMS,
  )(
    "applying ops then their inverses returns to original state",
    (ops) => {
      const doc = createPropertyDoc();
      const originalNorm = normalizeForComparison(doc);

      // Apply all ops, collect inverses
      const inverses: PatchOp[] = [];
      for (const op of ops) {
        inverses.push(applyOp(doc, op));
      }

      // Apply inverses in reverse order
      for (let i = inverses.length - 1; i >= 0; i--) {
        applyOp(doc, inverses[i]!);
      }

      const restoredNorm = normalizeForComparison(doc);
      expect(restoredNorm).toBe(originalNorm);
    },
  );

  // ---------------------------------------------------------------------------
  // Property 2: Replay determinism
  // ---------------------------------------------------------------------------

  test.prop(
    [generateValidOpSequence(5)],
    FC_PARAMS,
  )(
    "replaying same ops on fresh docs produces identical results",
    (ops) => {
      const doc1 = createPropertyDoc();
      const doc2 = createPropertyDoc();

      applyOps(doc1, ops);
      applyOps(doc2, ops);

      const norm1 = normalizeForComparison(doc1);
      const norm2 = normalizeForComparison(doc2);

      expect(norm1).toBe(norm2);
    },
  );

  // ---------------------------------------------------------------------------
  // Property 3: Batch equivalence
  // ---------------------------------------------------------------------------

  test.prop(
    [generateValidOpSequence(5)],
    FC_PARAMS,
  )(
    "applying ops individually equals applying them as a BatchOp",
    (ops) => {
      // Apply individually
      const doc1 = createPropertyDoc();
      applyOps(doc1, ops);

      // Apply as a single BatchOp
      const doc2 = createPropertyDoc();
      const batchOp: PatchOp = {
        id: "batch_prop_test_op",
        timestamp: Date.now(),
        origin: "replay",
        version: CURRENT_PATCHOP_VERSION,
        type: "BatchOp",
        payload: { ops },
      } as PatchOp;
      applyOp(doc2, batchOp);

      const norm1 = normalizeForComparison(doc1);
      const norm2 = normalizeForComparison(doc2);

      expect(norm1).toBe(norm2);
    },
  );

  // ---------------------------------------------------------------------------
  // Property 4: Structural integrity
  // ---------------------------------------------------------------------------

  test.prop(
    [generateValidOpSequence(5)],
    FC_PARAMS,
  )(
    "after any valid op sequence, the document is still valid per Zod",
    (ops) => {
      const doc = createPropertyDoc();
      applyOps(doc, ops);

      // The document should still be valid
      const result = SceneDocumentSchema.safeParse(doc);
      expect(result.success).toBe(true);
    },
  );
});
