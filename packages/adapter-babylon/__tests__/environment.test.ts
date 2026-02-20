import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MockScene,
  MockTransformNode,
  MockMesh,
  MockVector3,
  MockQuaternion,
  MockColor3,
  MockColor4,
  MockPBRMetallicRoughnessMaterial,
  MockPBRMaterial,
  MockDirectionalLight,
  MockPointLight,
  MockSpotLight,
  MockUniversalCamera,
  MockCamera,
  mockCreateBox,
  mockCreateSphere,
  mockCreateCylinder,
  mockCreateCapsule,
  mockCreateGround,
  mockCreateTorus,
} from "./helpers/babylon-mocks";

// ─── Apply mocks (explicit vi.mock calls, hoisted by vitest) ────────────────

vi.mock("@babylonjs/core/Engines/engine", () => ({ Engine: MockScene }));
vi.mock("@babylonjs/core/scene", () => ({ Scene: MockScene }));
vi.mock("@babylonjs/core/Meshes/transformNode", () => ({
  TransformNode: MockTransformNode,
}));
vi.mock("@babylonjs/core/Meshes/mesh", () => ({ Mesh: MockMesh }));
vi.mock("@babylonjs/core/Maths/math.vector", () => ({
  Vector3: MockVector3,
  Quaternion: MockQuaternion,
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

// ─── Imports (after mocks) ──────────────────────────────────────────────────

import { applyEnvironment, getSkyboxColor } from "../src/environment";
import type { CanonicalEnvironment } from "@riff3d/canonical-ir";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeEnv(overrides?: Partial<CanonicalEnvironment>): CanonicalEnvironment {
  return {
    skybox: { type: "color", color: "#0d0d1f", uri: null },
    fog: {
      enabled: false,
      type: "linear",
      color: "#ffffff",
      near: 0,
      far: 100,
      density: 0.01,
    },
    ambientLight: { color: "#ffffff", intensity: 0.5 },
    gravity: { x: 0, y: -9.81, z: 0 },
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("applyEnvironment", () => {
  let scene: MockScene;

  beforeEach(() => {
    scene = new MockScene();
  });

  it("sets ambient light color scaled by intensity", () => {
    const env = makeEnv({
      ambientLight: { color: "#ffffff", intensity: 0.5 },
    });

    applyEnvironment(scene as never, env);

    // White (#ffffff) at 0.5 intensity = (0.5, 0.5, 0.5)
    expect(scene.ambientColor).toBeInstanceOf(MockColor3);
    expect(scene.ambientColor.r).toBeCloseTo(0.5, 1);
    expect(scene.ambientColor.g).toBeCloseTo(0.5, 1);
    expect(scene.ambientColor.b).toBeCloseTo(0.5, 1);
  });

  it("sets linear fog mode with start and end", () => {
    const env = makeEnv({
      fog: {
        enabled: true,
        type: "linear",
        color: "#aabbcc",
        near: 10,
        far: 200,
        density: 0.01,
      },
    });

    applyEnvironment(scene as never, env);

    expect(scene.fogMode).toBe(MockScene.FOGMODE_LINEAR);
    expect(scene.fogStart).toBe(10);
    expect(scene.fogEnd).toBe(200);
    expect(scene.fogColor).toBeInstanceOf(MockColor3);
  });

  it("sets exponential fog mode with density", () => {
    const env = makeEnv({
      fog: {
        enabled: true,
        type: "exponential",
        color: "#ffffff",
        near: 0,
        far: 100,
        density: 0.05,
      },
    });

    applyEnvironment(scene as never, env);

    expect(scene.fogMode).toBe(MockScene.FOGMODE_EXP);
    expect(scene.fogDensity).toBe(0.05);
  });

  it("sets exponential2 fog mode with density", () => {
    const env = makeEnv({
      fog: {
        enabled: true,
        type: "exponential2",
        color: "#ffffff",
        near: 0,
        far: 100,
        density: 0.03,
      },
    });

    applyEnvironment(scene as never, env);

    expect(scene.fogMode).toBe(MockScene.FOGMODE_EXP2);
    expect(scene.fogDensity).toBe(0.03);
  });

  it("disables fog when fog.enabled is false", () => {
    const env = makeEnv({
      fog: {
        enabled: false,
        type: "linear",
        color: "#ffffff",
        near: 0,
        far: 100,
        density: 0.01,
      },
    });

    applyEnvironment(scene as never, env);

    expect(scene.fogMode).toBe(MockScene.FOGMODE_NONE);
  });

  it("sets skybox color as scene clearColor", () => {
    const env = makeEnv({
      skybox: { type: "color", color: "#ff0000", uri: null },
    });

    applyEnvironment(scene as never, env);

    expect(scene.clearColor).toBeInstanceOf(MockColor4);
    expect(scene.clearColor.r).toBeCloseTo(1, 1);
    expect(scene.clearColor.g).toBeCloseTo(0, 1);
    expect(scene.clearColor.b).toBeCloseTo(0, 1);
    expect(scene.clearColor.a).toBe(1);
  });
});

describe("getSkyboxColor", () => {
  it("returns Color4 from skybox color when type is 'color'", () => {
    const env = makeEnv({
      skybox: { type: "color", color: "#00ff00", uri: null },
    });

    const color = getSkyboxColor(env);

    expect(color).toBeInstanceOf(MockColor4);
    expect(color.g).toBeCloseTo(1, 1);
  });

  it("returns default dark blue when skybox color is null", () => {
    const env = makeEnv({
      skybox: { type: "color", color: null, uri: null },
    });

    const color = getSkyboxColor(env);

    expect(color).toBeInstanceOf(MockColor4);
    expect(color.r).toBeCloseTo(0.05, 2);
    expect(color.g).toBeCloseTo(0.05, 2);
    expect(color.b).toBeCloseTo(0.12, 2);
  });

  it("returns default dark blue for non-color skybox types", () => {
    const env = makeEnv({
      skybox: { type: "image", color: "#ffffff", uri: "texture.hdr" },
    });

    const color = getSkyboxColor(env);

    expect(color.r).toBeCloseTo(0.05, 2);
    expect(color.g).toBeCloseTo(0.05, 2);
    expect(color.b).toBeCloseTo(0.12, 2);
  });
});
