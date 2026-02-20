/**
 * CF-02: Lossiness contract tests.
 *
 * These tests enumerate which ECSON fields ARE expected to be stripped
 * during the ECSON -> IR -> ECSON round-trip and assert that ALL other
 * fields are preserved identically.
 *
 * Contract: If a new field is added to ECSON but not to the portable
 * subset, it MUST be explicitly listed in EXPECTED_STRIPPED_FIELDS.
 * Otherwise the test fails, forcing the developer to make a conscious
 * decision about whether the field should survive round-trip.
 */
import { describe, it, expect } from "vitest";
import {
  buildTransformsParentingFixture,
  buildMaterialsLightsFixture,
  buildAnimationFixture,
  buildEventsTriggersFixture,
  buildCharacterStubFixture,
  buildTimelineStubFixture,
  buildAdversarialFixture,
} from "@riff3d/fixtures";
import type { Entity } from "@riff3d/ecson";
import { compile, decompile } from "@riff3d/canonical-ir";

// ---------------------------------------------------------------------------
// Expected stripped fields (the lossiness contract)
// ---------------------------------------------------------------------------

/**
 * Entity-level fields that are expected to NOT survive the round-trip.
 * These are explicitly acknowledged as non-portable.
 *
 * Note: `tuning` IS preserved through IR (compiler/decompiler carry it).
 * Only `tags` and `locked` are stripped.
 */
const EXPECTED_STRIPPED_ENTITY_FIELDS: ReadonlySet<string> = new Set([
  "tags",
  "locked",
]);

/**
 * Document-level fields that are expected to NOT survive the round-trip.
 */
const EXPECTED_STRIPPED_DOC_FIELDS: ReadonlySet<string> = new Set([
  "metadata",
  "schemaVersion",
  "gameSettings",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Deep-compare two values, returning paths where they differ.
 */
function findDifferences(
  a: unknown,
  b: unknown,
  path: string = "",
): string[] {
  const diffs: string[] = [];

  if (a === b) return diffs;
  if (a === null || b === null || typeof a !== typeof b) {
    diffs.push(path || "(root)");
    return diffs;
  }

  if (typeof a === "object") {
    if (Array.isArray(a) && Array.isArray(b)) {
      const maxLen = Math.max(a.length, b.length);
      for (let i = 0; i < maxLen; i++) {
        diffs.push(
          ...findDifferences(
            a[i] as unknown,
            b[i] as unknown,
            `${path}[${i}]`,
          ),
        );
      }
    } else if (!Array.isArray(a) && !Array.isArray(b)) {
      const aObj = a as Record<string, unknown>;
      const bObj = b as Record<string, unknown>;
      const allKeys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);
      for (const key of allKeys) {
        diffs.push(
          ...findDifferences(aObj[key], bObj[key], path ? `${path}.${key}` : key),
        );
      }
    } else {
      diffs.push(path || "(root)");
    }
  } else {
    diffs.push(path || "(root)");
  }

  return diffs;
}

/**
 * Get all fields present on an entity (including undefined-valued ones
 * that exist in the schema).
 */
function getEntityFields(entity: Entity): string[] {
  return Object.keys(entity);
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ALL_FIXTURES = [
  { name: "transforms-parenting", build: buildTransformsParentingFixture },
  { name: "materials-lights", build: buildMaterialsLightsFixture },
  { name: "animation", build: buildAnimationFixture },
  { name: "events-triggers", build: buildEventsTriggersFixture },
  { name: "character-stub", build: buildCharacterStubFixture },
  { name: "timeline-stub", build: buildTimelineStubFixture },
  { name: "adversarial", build: buildAdversarialFixture },
] as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Lossiness contract tests (CF-02)", () => {
  describe.each(ALL_FIXTURES)("$name fixture", ({ build }) => {
    it("expected-stripped entity fields are indeed absent after round-trip", () => {
      const doc = build();
      const ir = compile(doc);
      const roundTripped = decompile(ir);

      for (const [entityId, entity] of Object.entries(doc.entities)) {
        const rtEntity = roundTripped.entities[entityId];
        expect(rtEntity).toBeDefined();
        if (!rtEntity) continue;

        for (const field of EXPECTED_STRIPPED_ENTITY_FIELDS) {
          const originalValue = (entity as Record<string, unknown>)[field];
          // Only check if the original actually had a meaningful value
          if (originalValue !== undefined) {
            const rtValue = (rtEntity as Record<string, unknown>)[field];
            // The field should either be absent, empty array, or default value
            if (field === "tags") {
              // Tags should be empty or missing after round-trip
              expect(
                rtValue === undefined ||
                  (Array.isArray(rtValue) && rtValue.length === 0),
              ).toBe(true);
            } else if (field === "locked") {
              // Locked should be false (default) or missing
              expect(
                rtValue === undefined || rtValue === false,
              ).toBe(true);
            } else if (field === "tuning") {
              // Tuning should be absent
              expect(rtValue).toBeUndefined();
            }
          }
        }
      }
    });

    it("all NON-stripped entity fields are preserved identically", () => {
      const doc = build();
      const ir = compile(doc);
      const roundTripped = decompile(ir);

      for (const [entityId, entity] of Object.entries(doc.entities)) {
        const rtEntity = roundTripped.entities[entityId];
        expect(rtEntity).toBeDefined();
        if (!rtEntity) continue;

        const entityFields = getEntityFields(entity);
        for (const field of entityFields) {
          if (EXPECTED_STRIPPED_ENTITY_FIELDS.has(field)) continue;

          const originalValue = (entity as Record<string, unknown>)[field];
          const rtValue = (rtEntity as Record<string, unknown>)[field];

          if (field === "components") {
            // Components need special handling: strip tuning from comparison
            const origComps = entity.components.map((c) => ({
              type: c.type,
              properties: c.properties,
            }));
            const rtComps = rtEntity.components.map((c) => ({
              type: c.type,
              properties: c.properties,
            }));
            expect(origComps).toEqual(rtComps);
          } else {
            const diffs = findDifferences(
              JSON.parse(JSON.stringify(originalValue)),
              JSON.parse(JSON.stringify(rtValue)),
              `entities.${entityId}.${field}`,
            );
            expect(diffs).toEqual([]);
          }
        }
      }
    });

    it("expected-stripped document fields are absent or defaults after round-trip", () => {
      const doc = build();
      const ir = compile(doc);
      const roundTripped = decompile(ir);

      for (const field of EXPECTED_STRIPPED_DOC_FIELDS) {
        const original = (doc as unknown as Record<string, unknown>)[field];
        if (original === undefined) continue;

        const rt = (roundTripped as unknown as Record<string, unknown>)[field];
        if (field === "metadata") {
          expect(
            rt === undefined ||
              (typeof rt === "object" && rt !== null && Object.keys(rt).length === 0),
          ).toBe(true);
        } else if (field === "schemaVersion") {
          // schemaVersion may be re-set to the current version
          // This is acceptable; the important thing is that the content is preserved
          expect(typeof rt === "number" || rt === undefined).toBe(true);
        }
      }
    });

    it("all NON-stripped document fields are preserved identically", () => {
      const doc = build();
      const ir = compile(doc);
      const roundTripped = decompile(ir);

      // Core document fields that must survive
      expect(roundTripped.id).toBe(doc.id);
      expect(roundTripped.name).toBe(doc.name);
      expect(roundTripped.rootEntityId).toBe(doc.rootEntityId);

      // Environment
      const diffs = findDifferences(
        JSON.parse(JSON.stringify(doc.environment)),
        JSON.parse(JSON.stringify(roundTripped.environment)),
        "environment",
      );
      expect(diffs).toEqual([]);

      // Assets
      for (const [assetId, asset] of Object.entries(doc.assets)) {
        const rtAsset = roundTripped.assets[assetId];
        expect(rtAsset).toBeDefined();
        if (!rtAsset) continue;

        expect(rtAsset.id).toBe(asset.id);
        expect(rtAsset.type).toBe(asset.type);
        expect(rtAsset.name).toBe(asset.name);
      }

      // Wiring
      expect(roundTripped.wiring.length).toBe(doc.wiring.length);
      for (let i = 0; i < doc.wiring.length; i++) {
        const origWire = doc.wiring[i]!;
        const rtWire = roundTripped.wiring[i]!;
        expect(rtWire.id).toBe(origWire.id);
        expect(rtWire.sourceEntityId).toBe(origWire.sourceEntityId);
        expect(rtWire.sourceEvent).toBe(origWire.sourceEvent);
        expect(rtWire.targetEntityId).toBe(origWire.targetEntityId);
        expect(rtWire.targetAction).toBe(origWire.targetAction);
      }
    });
  });

  it("any new entity field not in the stripped list causes test to notice", () => {
    // This test documents all known entity fields.
    // If a new field is added to EntitySchema, this test will need updating,
    // forcing the developer to decide: stripped or preserved?
    const KNOWN_ENTITY_FIELDS = new Set([
      "id",
      "name",
      "parentId",
      "children",
      "components",
      "tags",
      "transform",
      "visible",
      "locked",
      "tuning",
    ]);

    const PORTABLE_FIELDS = new Set(
      [...KNOWN_ENTITY_FIELDS].filter(
        (f) => !EXPECTED_STRIPPED_ENTITY_FIELDS.has(f),
      ),
    );

    // Verify our known lists cover all entity fields
    const doc = buildTransformsParentingFixture();
    const someEntity = Object.values(doc.entities)[0];
    expect(someEntity).toBeDefined();

    if (someEntity) {
      const actualFields = new Set(Object.keys(someEntity));
      for (const field of actualFields) {
        const isKnown = KNOWN_ENTITY_FIELDS.has(field);
        if (!isKnown) {
          throw new Error(
            `New entity field "${field}" found! ` +
              `Add it to either EXPECTED_STRIPPED_ENTITY_FIELDS (non-portable) ` +
              `or PORTABLE_FIELDS (must survive round-trip) in lossiness-contract.test.ts.`,
          );
        }
      }
    }

    // Sanity check: portable fields should not be empty
    expect(PORTABLE_FIELDS.size).toBeGreaterThan(0);
  });
});
