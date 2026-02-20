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
import { testRoundTrip } from "../src/round-trip";
import { runConformanceSuite } from "../src/harness";

// ---------------------------------------------------------------------------
// Per-fixture round-trip tests
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

describe("Round-trip tests", () => {
  describe.each(ALL_FIXTURES)("$name", ({ build }) => {
    it("ECSON -> IR -> ECSON preserves portable subset", () => {
      const doc = build();
      const result = testRoundTrip(doc);
      expect(result.passed).toBe(true);
      if (!result.passed) {
        console.error("Round-trip diff:", result.diff);
      }
    });
  });

  it("adversarial fixture survives round-trip (empty entities, unicode names, deep hierarchy)", () => {
    const doc = buildAdversarialFixture();
    const result = testRoundTrip(doc);
    expect(result.passed).toBe(true);
  });

  it("engine tuning is preserved through round-trip", () => {
    const doc = buildAdversarialFixture();
    // The adversarial fixture has entities with tuning
    const tunedEntities = Object.values(doc.entities).filter(
      (e) => e.tuning !== undefined,
    );
    expect(tunedEntities.length).toBeGreaterThanOrEqual(1);

    // After round-trip, tuning should still be present
    const result = testRoundTrip(doc);
    expect(result.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Conformance suite harness test
// ---------------------------------------------------------------------------

describe("Conformance suite harness", () => {
  it("all 7 fixtures pass the conformance suite", () => {
    const fixtures = ALL_FIXTURES.map(({ name, build }) => ({
      name,
      doc: build(),
    }));

    const result = runConformanceSuite(fixtures);
    expect(result.passed).toBe(7);
    expect(result.failed).toBe(0);
    expect(result.results).toHaveLength(7);

    for (const r of result.results) {
      expect(r.roundTrip).toBe(true);
      expect(r.errors).toHaveLength(0);
    }
  });
});
