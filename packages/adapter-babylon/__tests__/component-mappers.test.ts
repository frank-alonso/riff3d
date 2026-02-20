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
import type { CanonicalComponent, CanonicalNode } from "@riff3d/canonical-ir";

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

import { applyMeshRenderer } from "../src/component-mappers/mesh-renderer";
import { applyMaterial, hexToColor3 } from "../src/component-mappers/material";
import { applyLight } from "../src/component-mappers/light";
import { applyCamera } from "../src/component-mappers/camera";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeNode(
  overrides: Partial<CanonicalNode> & { id: string; name: string },
): CanonicalNode {
  return {
    parentId: null,
    childIds: [],
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    },
    components: [],
    visible: true,
    ...overrides,
  };
}

function makeComponent(
  type: string,
  properties: Record<string, unknown>,
): CanonicalComponent {
  return { type, properties };
}

// ─── Mesh Renderer Tests ────────────────────────────────────────────────────

describe("applyMeshRenderer", () => {
  let scene: MockScene;

  beforeEach(() => {
    scene = new MockScene();
    vi.clearAllMocks();
  });

  it.each([
    ["box", mockCreateBox],
    ["sphere", mockCreateSphere],
    ["cylinder", mockCreateCylinder],
    ["capsule", mockCreateCapsule],
    ["plane", mockCreateGround],
    ["torus", mockCreateTorus],
  ])("creates %s primitive mesh", (primitive, mockBuilder) => {
    const comp = makeComponent("MeshRenderer", { primitive });
    const node = makeNode({
      id: "n1",
      name: "TestMesh",
      components: [comp],
    });

    const mesh = applyMeshRenderer(scene as never, node, comp);

    expect(mesh).not.toBeNull();
    expect(mockBuilder).toHaveBeenCalled();
  });

  it("creates cone using CreateCylinder with diameterTop: 0", () => {
    const comp = makeComponent("MeshRenderer", { primitive: "cone" });
    const node = makeNode({
      id: "n1",
      name: "Cone",
      components: [comp],
    });

    applyMeshRenderer(scene as never, node, comp);

    expect(mockCreateCylinder).toHaveBeenCalledWith(
      "Cone",
      expect.objectContaining({ diameterTop: 0 }),
      scene,
    );
  });

  it("applies Material component when found on same node", () => {
    const meshComp = makeComponent("MeshRenderer", { primitive: "box" });
    const matComp = makeComponent("Material", {
      baseColor: "#ff0000",
      metallic: 0.5,
      roughness: 0.3,
    });
    const node = makeNode({
      id: "n1",
      name: "MaterialMesh",
      components: [meshComp, matComp],
    });

    const mesh = applyMeshRenderer(scene as never, node, meshComp);

    expect(mesh).not.toBeNull();
    expect(mesh!.material).toBeInstanceOf(MockPBRMetallicRoughnessMaterial);
  });

  it("returns null for unknown primitive type", () => {
    const comp = makeComponent("MeshRenderer", { primitive: "unknown" });
    const node = makeNode({
      id: "n1",
      name: "Unknown",
      components: [comp],
    });

    const result = applyMeshRenderer(scene as never, node, comp);

    expect(result).toBeNull();
  });
});

// ─── Material Tests ─────────────────────────────────────────────────────────

describe("applyMaterial", () => {
  let scene: MockScene;

  beforeEach(() => {
    scene = new MockScene();
  });

  it("sets baseColor from hex string", () => {
    const comp = makeComponent("Material", { baseColor: "#ff0000" });

    const mat = applyMaterial(scene as never, comp);

    expect(mat.baseColor).toBeInstanceOf(MockColor3);
    // Red: r ~= 1, g ~= 0, b ~= 0
    expect(mat.baseColor.r).toBeCloseTo(1, 1);
    expect(mat.baseColor.g).toBeCloseTo(0, 1);
    expect(mat.baseColor.b).toBeCloseTo(0, 1);
  });

  it("sets metallic value directly", () => {
    const comp = makeComponent("Material", { metallic: 0.7 });

    const mat = applyMaterial(scene as never, comp);

    expect(mat.metallic).toBe(0.7);
  });

  it("sets roughness value directly (NO inversion)", () => {
    const comp = makeComponent("Material", { roughness: 0.4 });

    const mat = applyMaterial(scene as never, comp);

    // CRITICAL: Babylon uses roughness directly, unlike PlayCanvas which inverts to gloss
    expect(mat.roughness).toBe(0.4);
  });

  it("sets emissive color from hex string", () => {
    const comp = makeComponent("Material", { emissive: "#00ff00" });

    const mat = applyMaterial(scene as never, comp);

    expect(mat.emissiveColor).toBeInstanceOf(MockColor3);
    expect(mat.emissiveColor.g).toBeCloseTo(1, 1);
  });

  it("sets opacity and enables alpha blend when < 1", () => {
    const comp = makeComponent("Material", { opacity: 0.5 });

    const mat = applyMaterial(scene as never, comp);

    expect(mat.alpha).toBe(0.5);
    expect(mat.transparencyMode).toBe(MockPBRMaterial.PBRMATERIAL_ALPHABLEND);
  });

  it("keeps opacity opaque when = 1", () => {
    const comp = makeComponent("Material", { opacity: 1 });

    const mat = applyMaterial(scene as never, comp);

    expect(mat.alpha).toBe(1);
    expect(mat.transparencyMode).toBeNull();
  });

  it("disables back-face culling for doubleSided", () => {
    const comp = makeComponent("Material", { doubleSided: true });

    const mat = applyMaterial(scene as never, comp);

    expect(mat.backFaceCulling).toBe(false);
  });
});

// ─── hexToColor3 Tests ──────────────────────────────────────────────────────

describe("hexToColor3", () => {
  it("parses 6-digit hex with #", () => {
    const c = hexToColor3("#ff8800");
    expect(c.r).toBeCloseTo(1, 1);
    expect(c.g).toBeCloseTo(0.533, 1);
    expect(c.b).toBeCloseTo(0, 1);
  });

  it("parses 6-digit hex without #", () => {
    const c = hexToColor3("00ff00");
    expect(c.r).toBeCloseTo(0, 1);
    expect(c.g).toBeCloseTo(1, 1);
    expect(c.b).toBeCloseTo(0, 1);
  });

  it("parses 3-digit hex shorthand", () => {
    const c = hexToColor3("#f00");
    expect(c.r).toBeCloseTo(1, 1);
    expect(c.g).toBeCloseTo(0, 1);
    expect(c.b).toBeCloseTo(0, 1);
  });
});

// ─── Light Tests ────────────────────────────────────────────────────────────

describe("applyLight", () => {
  let scene: MockScene;

  beforeEach(() => {
    scene = new MockScene();
    vi.clearAllMocks();
  });

  it("creates DirectionalLight for 'directional' type", () => {
    const comp = makeComponent("Light", {
      lightType: "directional",
      color: "#ffffff",
      intensity: 2,
    });

    const light = applyLight(scene as never, comp);

    expect(light).toBeInstanceOf(MockDirectionalLight);
    const dirLight = light as unknown as MockDirectionalLight;
    expect(dirLight.intensity).toBe(2);
  });

  it("creates PointLight for 'point' type with range", () => {
    const comp = makeComponent("Light", {
      lightType: "point",
      color: "#ffff00",
      intensity: 1.5,
      range: 20,
    });

    const light = applyLight(scene as never, comp);

    expect(light).toBeInstanceOf(MockPointLight);
    const pointLight = light as unknown as MockPointLight;
    expect(pointLight.intensity).toBe(1.5);
    expect(pointLight.range).toBe(20);
  });

  it("creates SpotLight for 'spot' type with angle in radians", () => {
    const comp = makeComponent("Light", {
      lightType: "spot",
      color: "#ffffff",
      intensity: 3,
      outerConeAngle: 90,
      range: 15,
    });

    const light = applyLight(scene as never, comp);

    expect(light).toBeInstanceOf(MockSpotLight);
    const spotLight = light as unknown as MockSpotLight;
    expect(spotLight.intensity).toBe(3);
    // 90 degrees -> PI/2 radians
    expect(spotLight.angle).toBeCloseTo(Math.PI / 2, 3);
    expect(spotLight.range).toBe(15);
  });

  it("sets diffuse color from hex", () => {
    const comp = makeComponent("Light", {
      lightType: "point",
      color: "#ff0000",
    });

    const light = applyLight(scene as never, comp);

    const pointLight = light as unknown as MockPointLight;
    expect(pointLight.diffuse).toBeInstanceOf(MockColor3);
    expect(pointLight.diffuse.r).toBeCloseTo(1, 1);
    expect(pointLight.diffuse.g).toBeCloseTo(0, 1);
  });
});

// ─── Camera Tests ───────────────────────────────────────────────────────────

describe("applyCamera", () => {
  let scene: MockScene;

  beforeEach(() => {
    scene = new MockScene();
  });

  it("creates UniversalCamera with FOV converted to radians", () => {
    const comp = makeComponent("Camera", { fov: 60 });

    const camera = applyCamera(scene as never, comp);

    expect(camera).toBeInstanceOf(MockUniversalCamera);
    // 60 degrees -> PI/3 radians
    expect(camera.fov).toBeCloseTo(Math.PI / 3, 3);
  });

  it("sets nearClip and farClip", () => {
    const comp = makeComponent("Camera", {
      nearClip: 0.5,
      farClip: 500,
    });

    const camera = applyCamera(scene as never, comp);

    expect(camera.minZ).toBe(0.5);
    expect(camera.maxZ).toBe(500);
  });

  it("sets orthographic mode with orthoSize", () => {
    const comp = makeComponent("Camera", {
      projection: "orthographic",
      orthoSize: 10,
    });

    const camera = applyCamera(scene as never, comp);

    expect(camera.mode).toBe(MockCamera.ORTHOGRAPHIC_CAMERA);
    expect(camera.orthoTop).toBe(10);
    expect(camera.orthoBottom).toBe(-10);
  });

  it("calls detachControl for scene cameras (editor mode)", () => {
    const comp = makeComponent("Camera", {});

    const camera = applyCamera(scene as never, comp);

    expect(camera.detachControl).toHaveBeenCalled();
  });
});
