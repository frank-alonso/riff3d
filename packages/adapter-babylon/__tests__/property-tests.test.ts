/**
 * Multi-seed property tests for Babylon.js adapter (CF-P3-03).
 *
 * Uses fast-check with 3 different seeds (42, 123, 456) x 50 iterations each
 * to verify adapter invariants hold across random CanonicalScene inputs.
 *
 * Properties tested:
 * 1. loadScene + getEntityMap produces entityMap with size === scene.nodes.length
 * 2. applyDelta with a valid transform delta does not throw
 * 3. rebuildScene is idempotent (entity count unchanged)
 */
import { describe, expect, vi, afterEach } from "vitest";
import { test, fc } from "@fast-check/vitest";
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
} from "./helpers/babylon-mocks";

// ─── DOM stubs ──────────────────────────────────────────────────────────────

class FakeHTMLCanvasElement {
  width = 800;
  height = 600;
  style: Record<string, string> = {};
  parentElement = {
    clientWidth: 800,
    clientHeight: 600,
    style: {} as Record<string, string>,
    appendChild: vi.fn(),
  };
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  getBoundingClientRect = vi.fn(() => ({
    left: 0,
    top: 0,
    width: 800,
    height: 600,
  }));
}

globalThis.HTMLCanvasElement =
  FakeHTMLCanvasElement as unknown as typeof HTMLCanvasElement;
globalThis.window = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
} as unknown as Window & typeof globalThis;
globalThis.document = {
  createElement: vi.fn((tag: string) => {
    if (tag === "div") {
      return { style: {} as Record<string, string>, parentElement: null };
    }
    return {};
  }),
} as unknown as Document;

// ─── Mock Babylon (explicit vi.mock calls, hoisted by vitest) ────────────────

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

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { BabylonAdapter } from "../src/adapter";
import type { CanonicalScene, CanonicalNode } from "@riff3d/canonical-ir";

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const vec3Arb = fc.record({
  x: fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
  y: fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
  z: fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
});

const quatArb = fc.record({
  x: fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true }),
  y: fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true }),
  z: fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true }),
  w: fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true }),
});

const scaleArb = fc.record({
  x: fc.double({ min: 0.01, max: 10, noNaN: true, noDefaultInfinity: true }),
  y: fc.double({ min: 0.01, max: 10, noNaN: true, noDefaultInfinity: true }),
  z: fc.double({ min: 0.01, max: 10, noNaN: true, noDefaultInfinity: true }),
});

const nodeArb = (index: number): fc.Arbitrary<CanonicalNode> =>
  fc
    .tuple(
      fc.stringMatching(/^[a-z0-9]{8}$/),
      fc.string({ minLength: 1, maxLength: 20 }),
      vec3Arb,
      quatArb,
      scaleArb,
    )
    .map(([idSuffix, name, position, rotation, scale]) => ({
      id: `n_${index}_${idSuffix}`,
      name,
      parentId: null,
      childIds: [],
      transform: { position, rotation, scale },
      components: [],
      visible: true,
    }));

const sceneArb: fc.Arbitrary<CanonicalScene> = fc
  .integer({ min: 1, max: 15 })
  .chain((count) =>
    fc.tuple(...Array.from({ length: count }, (_, i) => nodeArb(i))),
  )
  .map((nodes) => {
    const nodeIndex: Record<string, number> = {};
    nodes.forEach((n, i) => {
      nodeIndex[n.id] = i;
    });
    return {
      id: "prop-scene",
      name: "Property Test Scene",
      sourceSchemaVersion: 1,
      nodes,
      nodeIndex,
      rootNodeId: nodes[0]!.id,
      assets: [],
      wires: [],
      environment: {
        skybox: { type: "color" as const, color: "#0d0d1f", uri: null },
        fog: {
          enabled: false,
          type: "linear" as const,
          color: "#ffffff",
          near: 0,
          far: 100,
          density: 0.01,
        },
        ambientLight: { color: "#ffffff", intensity: 0.5 },
        gravity: { x: 0, y: -9.81, z: 0 },
      },
      gameSettings: null,
    };
  });

// ─── Seeds and iterations ───────────────────────────────────────────────────

const SEEDS = [42, 123, 456] as const;
const NUM_RUNS = 50;

function createCanvas(): HTMLCanvasElement {
  return new FakeHTMLCanvasElement() as unknown as HTMLCanvasElement;
}

// ─── Property tests ─────────────────────────────────────────────────────────

describe("Babylon adapter property tests", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  for (const seed of SEEDS) {
    const params = { seed, numRuns: NUM_RUNS } as const;

    describe(`seed=${seed}`, () => {
      test.prop([sceneArb], params)(
        "loadScene entity count matches scene.nodes.length",
        async (scene) => {
          const adapter = new BabylonAdapter();
          await adapter.initialize(createCanvas());

          adapter.loadScene(scene);
          const entityMap = adapter.getEntityMap();

          expect(entityMap.size).toBe(scene.nodes.length);
          adapter.dispose();
        },
      );

      test.prop([sceneArb, vec3Arb], params)(
        "applyDelta with transform does not throw",
        async (scene, position) => {
          const adapter = new BabylonAdapter();
          await adapter.initialize(createCanvas());
          adapter.loadScene(scene);

          const firstNode = scene.nodes[0]!;
          expect(() =>
            adapter.applyDelta({
              type: "node-transform",
              nodeId: firstNode.id,
              transform: { position },
            }),
          ).not.toThrow();

          adapter.dispose();
        },
      );

      test.prop([sceneArb], params)(
        "rebuildScene is idempotent (entity count unchanged)",
        async (scene) => {
          const adapter = new BabylonAdapter();
          await adapter.initialize(createCanvas());

          adapter.loadScene(scene);
          const countAfterLoad = adapter.getEntityMap().size;

          adapter.rebuildScene(scene);
          const countAfterRebuild = adapter.getEntityMap().size;

          expect(countAfterRebuild).toBe(countAfterLoad);
          adapter.dispose();
        },
      );
    });
  }
});
