/**
 * PlayCanvas adapter conformance tests.
 *
 * Validates that the PlayCanvas adapter correctly implements the EngineAdapter
 * interface for all golden fixtures. Each fixture is compiled to CanonicalScene
 * and run through the generic conformance harness.
 *
 * Uses globalThis stubs for DOM APIs (no jsdom needed).
 */
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import {
  setupDomStubs,
  createMockCanvas,
  loadAllGoldenFixtures,
  type GoldenFixture,
} from "./helpers/adapter-test-helpers";
import {
  createPlayCanvasMockModule,
} from "../../adapter-playcanvas/__tests__/helpers/pc-mocks";

// Set up DOM stubs before any PlayCanvas imports
setupDomStubs();

// Mock PlayCanvas engine
vi.mock("playcanvas", () => createPlayCanvasMockModule());

// Import after mocks are set up
import { PlayCanvasAdapter } from "@riff3d/adapter-playcanvas";
import { runAdapterConformance } from "../../conformance/src/adapter-conformance";

// ---------------------------------------------------------------------------
// Load golden fixtures once for all tests
// ---------------------------------------------------------------------------

let fixtures: GoldenFixture[];

beforeAll(() => {
  fixtures = loadAllGoldenFixtures();
});

// ---------------------------------------------------------------------------
// Conformance tests
// ---------------------------------------------------------------------------

describe("PlayCanvas adapter conformance", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("has golden fixtures to test", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(6);
  });

  describe.each([
    "transforms-parenting",
    "materials-lights",
    "animation",
    "events-triggers",
    "character-stub",
    "timeline-stub",
    "adversarial",
  ])("fixture: %s", (fixtureName) => {
    it("passes all conformance checks", async () => {
      const fixture = fixtures.find((f) => f.name === fixtureName);
      expect(fixture).toBeDefined();

      const adapter = new PlayCanvasAdapter();
      const canvas = createMockCanvas();
      await adapter.initialize(canvas);

      const result = runAdapterConformance(
        adapter,
        fixture!.name,
        fixture!.scene,
      );

      expect(result.errors).toEqual([]);
      expect(result.passed).toBe(true);
      expect(result.entityCount).toBe(result.expectedEntityCount);
    });

    it("entity count matches IR node count", async () => {
      const fixture = fixtures.find((f) => f.name === fixtureName);
      expect(fixture).toBeDefined();

      const adapter = new PlayCanvasAdapter();
      const canvas = createMockCanvas();
      await adapter.initialize(canvas);

      adapter.loadScene(fixture!.scene);
      const entityMap = adapter.getEntityMap();

      expect(entityMap.size).toBe(fixture!.scene.nodes.length);
    });
  });

  describe("rebuildScene idempotency", () => {
    it("produces same entity count as initial loadScene", async () => {
      const fixture = fixtures[0]!;
      const adapter = new PlayCanvasAdapter();
      const canvas = createMockCanvas();
      await adapter.initialize(canvas);

      adapter.loadScene(fixture.scene);
      const countAfterLoad = adapter.getEntityMap().size;

      adapter.rebuildScene(fixture.scene);
      const countAfterRebuild = adapter.getEntityMap().size;

      expect(countAfterRebuild).toBe(countAfterLoad);
      adapter.dispose();
    });
  });

  describe("applyDelta with transform", () => {
    it("does not throw for any fixture with nodes", async () => {
      for (const fixture of fixtures) {
        if (fixture.scene.nodes.length === 0) continue;

        const adapter = new PlayCanvasAdapter();
        const canvas = createMockCanvas();
        await adapter.initialize(canvas);
        adapter.loadScene(fixture.scene);

        const firstNode = fixture.scene.nodes[0]!;
        expect(() =>
          adapter.applyDelta({
            type: "node-transform",
            nodeId: firstNode.id,
            transform: { position: { x: 10, y: 20, z: 30 } },
          }),
        ).not.toThrow();

        adapter.dispose();
      }
    });
  });
});
