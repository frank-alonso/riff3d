import { describe, it, expect } from "vitest";
import { SceneDocumentSchema, type SceneDocument, type Entity } from "@riff3d/ecson";
import {
  buildTransformsParentingFixture,
  buildMaterialsLightsFixture,
  buildAnimationFixture,
  buildEventsTriggersFixture,
  buildCharacterStubFixture,
  buildTimelineStubFixture,
  buildAdversarialFixture,
} from "../src/builders/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAllEntityIds(doc: SceneDocument): string[] {
  return Object.keys(doc.entities);
}

function getMaxDepth(doc: SceneDocument): number {
  function depth(entityId: string, visited: Set<string>): number {
    if (visited.has(entityId)) return 0;
    visited.add(entityId);
    const entity = doc.entities[entityId];
    if (!entity || entity.children.length === 0) return 1;
    let max = 0;
    for (const childId of entity.children) {
      max = Math.max(max, depth(childId, visited));
    }
    return 1 + max;
  }
  return depth(doc.rootEntityId, new Set());
}

function findEntities(doc: SceneDocument, predicate: (e: Entity) => boolean): Entity[] {
  return Object.values(doc.entities).filter(predicate);
}

// ---------------------------------------------------------------------------
// Tests: all 7 builders produce valid SceneDocuments
// ---------------------------------------------------------------------------

const ALL_BUILDERS = [
  { name: "transforms-parenting", fn: buildTransformsParentingFixture },
  { name: "materials-lights", fn: buildMaterialsLightsFixture },
  { name: "animation", fn: buildAnimationFixture },
  { name: "events-triggers", fn: buildEventsTriggersFixture },
  { name: "character-stub", fn: buildCharacterStubFixture },
  { name: "timeline-stub", fn: buildTimelineStubFixture },
  { name: "adversarial", fn: buildAdversarialFixture },
] as const;

describe("Golden fixture builders", () => {
  describe.each(ALL_BUILDERS)("$name", ({ fn }) => {
    it("produces a valid SceneDocument (Zod parse succeeds)", () => {
      const doc = fn();
      // Should not throw -- builder already validates, but let's double-check
      const result = SceneDocumentSchema.safeParse(doc);
      expect(result.success).toBe(true);
    });

    it("has unique entity IDs (no duplicates)", () => {
      const doc = fn();
      const ids = getAllEntityIds(doc);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });
  });
});

// ---------------------------------------------------------------------------
// Specific fixture tests
// ---------------------------------------------------------------------------

describe("transforms-parenting fixture specifics", () => {
  const doc = buildTransformsParentingFixture();

  it("has correct hierarchy depth (3 levels: root -> parent -> child)", () => {
    expect(getMaxDepth(doc)).toBe(3);
  });

  it("has correct entity count (root + 2 parents + 3 children = 6)", () => {
    expect(getAllEntityIds(doc).length).toBe(6);
  });

  it("root has 2 direct children (Parent A and Parent B)", () => {
    const root = doc.entities[doc.rootEntityId]!;
    expect(root.children.length).toBe(2);
  });
});

describe("materials-lights fixture specifics", () => {
  const doc = buildMaterialsLightsFixture();

  it("has 3 entities sharing one material asset", () => {
    // Find all material assets
    const materialAssets = Object.values(doc.assets).filter(
      (a) => a.type === "material" && a.name === "SharedPBRMaterial",
    );
    expect(materialAssets.length).toBe(1);

    const matId = materialAssets[0]!.id;

    // Count entities referencing this material
    const entitiesWithMat = findEntities(doc, (e) =>
      e.components.some(
        (c) =>
          c.type === "Material" &&
          (c.properties as Record<string, unknown>)["materialAssetId"] === matId,
      ),
    );
    expect(entitiesWithMat.length).toBe(3);
  });
});

describe("timeline-stub fixture specifics", () => {
  const doc = buildTimelineStubFixture();

  it("has 3 entities with multi-track keyframe data", () => {
    const animatedEntities = findEntities(doc, (e) =>
      e.components.some((c) => c.type === "Animation"),
    );
    expect(animatedEntities.length).toBe(3);
  });

  it("all animated entities share the same timeline duration", () => {
    const animatedEntities = findEntities(doc, (e) =>
      e.components.some((c) => c.type === "Animation"),
    );

    const durations = animatedEntities.map((e) => {
      const anim = e.components.find((c) => c.type === "Animation")!;
      return (anim.properties as Record<string, unknown>)["timelineDuration"];
    });

    // All should be the same value
    expect(new Set(durations).size).toBe(1);
    expect(durations[0]).toBe(5.0);
  });
});

describe("adversarial fixture specifics", () => {
  const doc = buildAdversarialFixture();

  it("has 6+ levels of nesting", () => {
    expect(getMaxDepth(doc)).toBeGreaterThanOrEqual(6);
  });

  it("has unicode entity names", () => {
    const names = Object.values(doc.entities).map((e) => e.name);

    // Check for emoji
    const hasEmoji = names.some((n) => /\p{Emoji}/u.test(n));
    expect(hasEmoji).toBe(true);

    // Check for CJK characters
    const hasCJK = names.some((n) => /[\u4e00-\u9fff]/.test(n));
    expect(hasCJK).toBe(true);

    // Check for RTL text (Arabic)
    const hasRTL = names.some((n) => /[\u0600-\u06ff]/.test(n));
    expect(hasRTL).toBe(true);
  });

  it("has empty entities (no components)", () => {
    const emptyEntities = findEntities(
      doc,
      (e) => e.components.length === 0 && e.id !== doc.rootEntityId,
    );
    expect(emptyEntities.length).toBeGreaterThanOrEqual(1);
  });

  it("has 3-step event wire chain", () => {
    expect(doc.wiring.length).toBeGreaterThanOrEqual(3);
  });

  it("has non-default game settings", () => {
    expect(doc.gameSettings).toBeDefined();
    expect(doc.gameSettings!.maxPlayers).toBe(16);
    expect(doc.gameSettings!.roundDuration).toBe(300);
    expect(doc.gameSettings!.respawnEnabled).toBe(false);
  });

  it("has entities with engine tuning", () => {
    const tunedEntities = findEntities(doc, (e) => e.tuning !== undefined);
    expect(tunedEntities.length).toBeGreaterThanOrEqual(1);
  });
});
