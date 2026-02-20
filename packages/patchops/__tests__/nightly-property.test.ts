/**
 * CF-01: Nightly property test suite.
 *
 * Same invariants as the standard property tests in conformance, but:
 * - Uses a rotating seed (Date.now()) instead of fixed seed=42
 * - Runs 1000 iterations instead of 100
 * - Logs the seed on failure for reproduction
 * - Skipped in standard CI: only runs when NIGHTLY=true
 *
 * To reproduce a failure, set the seed in FC_PARAMS:
 *   FC_PARAMS = { seed: <logged-seed>, numRuns: 1000 }
 */
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
} from "../src/index";

// ---------------------------------------------------------------------------
// Rotating seed for nightly runs
// ---------------------------------------------------------------------------

const NIGHTLY_SEED = Date.now();

const FC_PARAMS = {
  seed: NIGHTLY_SEED,
  numRuns: 1000,
} as const;

// Log seed at the top of the test suite so failures can be reproduced
console.log(`[nightly-property] Running with seed: ${NIGHTLY_SEED}`);

// ---------------------------------------------------------------------------
// Shared test infrastructure (duplicated from conformance property-tests
// to keep patchops self-contained)
// ---------------------------------------------------------------------------

const ROOT_ID = "nightly_root_00000";

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

function generateValidOpSequence(length: number): fc.Arbitrary<PatchOp[]> {
  return fc
    .tuple(
      fc.array(entityIdArb, { minLength: length, maxLength: length }),
      fc.array(transformArb, { minLength: length, maxLength: length }),
      fc.array(fc.constantFrom("MeshRenderer", "Light", "Camera"), {
        minLength: length,
        maxLength: length,
      }),
    )
    .map(([ids, transforms, compTypes]) => {
      const ops: PatchOp[] = [];
      const existingEntities = new Set<string>([ROOT_ID]);
      let opCounter = 0;

      for (let i = 0; i < length; i++) {
        opCounter++;
        const entityId = ids[i]!;

        if (!existingEntities.has(entityId)) {
          ops.push({
            id: `nightly_op_${String(opCounter).padStart(6, "0")}`,
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

        opCounter++;
        ops.push({
          id: `nightly_op_${String(opCounter).padStart(6, "0")}`,
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

function createPropertyDoc(): SceneDocument {
  return SceneDocumentSchema.parse({
    id: "nightly_doc_id_00",
    name: "Nightly Property Test Document",
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

function normalizeDoc(doc: SceneDocument): string {
  return JSON.stringify(doc, (_key, value: unknown) => {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(value as Record<string, unknown>).sort()) {
        sorted[k] = (value as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return value;
  });
}

// ---------------------------------------------------------------------------
// Nightly property tests
// ---------------------------------------------------------------------------

describe.skipIf(!process.env["NIGHTLY"])(
  "Nightly property tests (CF-01)",
  () => {
    test.prop(
      [generateValidOpSequence(5)],
      FC_PARAMS,
    )(
      "apply-inverse identity (1000 runs, rotating seed)",
      (ops) => {
        const doc = createPropertyDoc();
        const originalNorm = normalizeDoc(doc);

        const inverses: PatchOp[] = [];
        for (const op of ops) {
          inverses.push(applyOp(doc, op));
        }

        for (let i = inverses.length - 1; i >= 0; i--) {
          applyOp(doc, inverses[i]!);
        }

        const restoredNorm = normalizeDoc(doc);
        expect(restoredNorm).toBe(originalNorm);
      },
    );

    test.prop(
      [generateValidOpSequence(5)],
      FC_PARAMS,
    )(
      "replay determinism (1000 runs, rotating seed)",
      (ops) => {
        const doc1 = createPropertyDoc();
        const doc2 = createPropertyDoc();

        applyOps(doc1, ops);
        applyOps(doc2, ops);

        expect(normalizeDoc(doc1)).toBe(normalizeDoc(doc2));
      },
    );

    test.prop(
      [generateValidOpSequence(5)],
      FC_PARAMS,
    )(
      "batch equivalence (1000 runs, rotating seed)",
      (ops) => {
        const doc1 = createPropertyDoc();
        applyOps(doc1, ops);

        const doc2 = createPropertyDoc();
        const batchOp: PatchOp = {
          id: "nightly_batch_op",
          timestamp: Date.now(),
          origin: "replay",
          version: CURRENT_PATCHOP_VERSION,
          type: "BatchOp",
          payload: { ops },
        } as PatchOp;
        applyOp(doc2, batchOp);

        expect(normalizeDoc(doc1)).toBe(normalizeDoc(doc2));
      },
    );

    test.prop(
      [generateValidOpSequence(5)],
      FC_PARAMS,
    )(
      "structural integrity (1000 runs, rotating seed)",
      (ops) => {
        const doc = createPropertyDoc();
        applyOps(doc, ops);

        const result = SceneDocumentSchema.safeParse(doc);
        expect(result.success).toBe(true);
      },
    );
  },
);
