import { describe, it, expect } from "vitest";
import { buildTransformsParentingFixture } from "../src/builders/transforms-parenting";
import referenceJson from "../src/reference/transforms-parenting.json" with { type: "json" };

/**
 * Normalize a SceneDocument for comparison:
 * - Sort entity keys alphabetically in the entities record
 * - Sort component arrays by type
 * - Serialize with sorted keys for deterministic comparison
 */
function normalizeForComparison(doc: unknown): string {
  return JSON.stringify(doc, (key, value: unknown) => {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      // Sort object keys
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(value as Record<string, unknown>).sort()) {
        sorted[k] = (value as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return value;
  });
}

describe("Reference equivalence", () => {
  it("builder output matches hand-authored reference JSON", () => {
    const builderOutput = buildTransformsParentingFixture();
    const reference = referenceJson;

    // Normalize both for stable comparison (key ordering)
    const normalizedBuilder = normalizeForComparison(builderOutput);
    const normalizedReference = normalizeForComparison(reference);

    expect(normalizedBuilder).toBe(normalizedReference);
  });

  it("hand-authored reference is a valid SceneDocument structure", () => {
    // Verify the reference has the expected top-level structure
    expect(referenceJson).toHaveProperty("id");
    expect(referenceJson).toHaveProperty("name");
    expect(referenceJson).toHaveProperty("schemaVersion");
    expect(referenceJson).toHaveProperty("entities");
    expect(referenceJson).toHaveProperty("rootEntityId");
    expect(referenceJson).toHaveProperty("environment");

    // Verify entity count
    const entityCount = Object.keys(referenceJson.entities).length;
    expect(entityCount).toBe(6);
  });
});
