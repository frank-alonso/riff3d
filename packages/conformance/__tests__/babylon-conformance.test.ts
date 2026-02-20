/**
 * Babylon.js adapter conformance tests.
 *
 * Validates that the Babylon adapter correctly implements the EngineAdapter
 * interface for all golden fixtures. Each fixture is compiled to CanonicalScene
 * and run through the generic conformance harness.
 *
 * Uses globalThis stubs for DOM APIs (no jsdom needed).
 * Uses explicit vi.mock() for each Babylon sub-module (vitest hoisting).
 */
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import {
  setupDomStubs,
  createMockCanvas,
  loadAllGoldenFixtures,
  type GoldenFixture,
} from "./helpers/adapter-test-helpers";

// Set up DOM stubs before any Babylon imports
setupDomStubs();

// Import Babylon mock classes for vi.mock (these are simple value types, safe to import early)
import {
  MockScene,
  MockTransformNode,
  MockMesh,
  MockVector3,
  MockQuaternion,
  MockMatrix,
  MockColor3,
  MockColor4,
  MockPBRMetallicRoughnessMaterial,
  MockPBRMaterial,
  MockDirectionalLight,
  MockPointLight,
  MockSpotLight,
  MockUniversalCamera,
  MockArcRotateCamera,
  MockCamera,
  MockEngine,
  mockCreateBox,
  mockCreateSphere,
  mockCreateCylinder,
  mockCreateCapsule,
  mockCreateGround,
  mockCreateTorus,
} from "../../adapter-babylon/__tests__/helpers/babylon-mocks";

// Explicit vi.mock calls for each Babylon sub-module (hoisted by vitest)
vi.mock("@babylonjs/core/Engines/engine", () => ({ Engine: MockEngine }));
vi.mock("@babylonjs/core/scene", () => ({ Scene: MockScene }));
vi.mock("@babylonjs/core/Meshes/transformNode", () => ({
  TransformNode: MockTransformNode,
}));
vi.mock("@babylonjs/core/Meshes/mesh", () => ({ Mesh: MockMesh }));
vi.mock("@babylonjs/core/Maths/math.vector", () => ({
  Vector3: MockVector3,
  Quaternion: MockQuaternion,
  Matrix: MockMatrix,
}));
vi.mock("@babylonjs/core/Cameras/arcRotateCamera", () => ({
  ArcRotateCamera: MockArcRotateCamera,
}));
vi.mock("@babylonjs/core/Maths/math.color", () => ({
  Color3: MockColor3,
  Color4: MockColor4,
}));
vi.mock("@babylonjs/core/Materials/PBR/pbrMetallicRoughnessMaterial", () => ({
  PBRMetallicRoughnessMaterial: MockPBRMetallicRoughnessMaterial,
}));
vi.mock("@babylonjs/core/Materials/PBR/pbrMaterial", () => ({
  PBRMaterial: MockPBRMaterial,
}));
vi.mock("@babylonjs/core/Lights/directionalLight", () => ({
  DirectionalLight: MockDirectionalLight,
}));
vi.mock("@babylonjs/core/Lights/pointLight", () => ({
  PointLight: MockPointLight,
}));
vi.mock("@babylonjs/core/Lights/spotLight", () => ({
  SpotLight: MockSpotLight,
}));
vi.mock("@babylonjs/core/Cameras/universalCamera", () => ({
  UniversalCamera: MockUniversalCamera,
}));
vi.mock("@babylonjs/core/Cameras/camera", () => ({
  Camera: MockCamera,
}));
vi.mock("@babylonjs/core/Meshes/Builders/boxBuilder", () => ({
  CreateBox: mockCreateBox,
}));
vi.mock("@babylonjs/core/Meshes/Builders/sphereBuilder", () => ({
  CreateSphere: mockCreateSphere,
}));
vi.mock("@babylonjs/core/Meshes/Builders/cylinderBuilder", () => ({
  CreateCylinder: mockCreateCylinder,
}));
vi.mock("@babylonjs/core/Meshes/Builders/capsuleBuilder", () => ({
  CreateCapsule: mockCreateCapsule,
}));
vi.mock("@babylonjs/core/Meshes/Builders/groundBuilder", () => ({
  CreateGround: mockCreateGround,
}));
vi.mock("@babylonjs/core/Meshes/Builders/torusBuilder", () => ({
  CreateTorus: mockCreateTorus,
}));

// Import after mocks are set up
import { BabylonAdapter } from "@riff3d/adapter-babylon";
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

describe("Babylon adapter conformance", () => {
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

      const adapter = new BabylonAdapter();
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

      const adapter = new BabylonAdapter();
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
      const adapter = new BabylonAdapter();
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

        const adapter = new BabylonAdapter();
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
