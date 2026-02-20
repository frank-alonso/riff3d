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

import { applyBabylonDelta } from "../src/delta";
import type { IRDelta } from "@riff3d/canonical-ir";

const DEG_TO_RAD = Math.PI / 180;

// ─── Helpers ────────────────────────────────────────────────────────────────

function createEntityMap(): Map<string, MockTransformNode> {
  const mesh = new MockMesh("TestMesh");
  // Give it a PBR material for component property tests
  (mesh as MockMesh).material = new MockPBRMetallicRoughnessMaterial("TestMat");

  const map = new Map<string, MockTransformNode>();
  map.set("entity-1", mesh);
  return map;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("applyBabylonDelta", () => {
  let entityMap: Map<string, MockTransformNode>;
  let scene: MockScene;

  beforeEach(() => {
    entityMap = createEntityMap();
    scene = new MockScene();
    vi.clearAllMocks();
  });

  describe("node-transform delta", () => {
    it("sets position via Vector3", () => {
      const delta: IRDelta = {
        type: "node-transform",
        nodeId: "entity-1",
        transform: { position: { x: 5, y: 10, z: -3 } },
      };

      applyBabylonDelta(
        entityMap as unknown as Map<string, never>,
        scene as unknown as never,
        delta,
      );

      const node = entityMap.get("entity-1")!;
      expect(node.position).toEqual(
        expect.objectContaining({ x: 5, y: 10, z: -3 }),
      );
    });

    it("sets rotation via Quaternion (not Euler)", () => {
      const delta: IRDelta = {
        type: "node-transform",
        nodeId: "entity-1",
        transform: { rotation: { x: 0.1, y: 0.2, z: 0.3, w: 0.9 } },
      };

      applyBabylonDelta(
        entityMap as unknown as Map<string, never>,
        scene as unknown as never,
        delta,
      );

      const node = entityMap.get("entity-1")!;
      // CRITICAL: must use rotationQuaternion, NOT rotation
      expect(node.rotationQuaternion).toEqual(
        expect.objectContaining({ x: 0.1, y: 0.2, z: 0.3, w: 0.9 }),
      );
    });

    it("sets scale via Vector3", () => {
      const delta: IRDelta = {
        type: "node-transform",
        nodeId: "entity-1",
        transform: { scale: { x: 2, y: 3, z: 4 } },
      };

      applyBabylonDelta(
        entityMap as unknown as Map<string, never>,
        scene as unknown as never,
        delta,
      );

      const node = entityMap.get("entity-1")!;
      expect(node.scaling).toEqual(
        expect.objectContaining({ x: 2, y: 3, z: 4 }),
      );
    });
  });

  describe("node-visibility delta", () => {
    it("calls setEnabled(true)", () => {
      const delta: IRDelta = {
        type: "node-visibility",
        nodeId: "entity-1",
        visible: true,
      };

      applyBabylonDelta(
        entityMap as unknown as Map<string, never>,
        scene as unknown as never,
        delta,
      );

      const node = entityMap.get("entity-1")!;
      expect(node.setEnabled).toHaveBeenCalledWith(true);
    });

    it("calls setEnabled(false)", () => {
      const delta: IRDelta = {
        type: "node-visibility",
        nodeId: "entity-1",
        visible: false,
      };

      applyBabylonDelta(
        entityMap as unknown as Map<string, never>,
        scene as unknown as never,
        delta,
      );

      const node = entityMap.get("entity-1")!;
      expect(node.setEnabled).toHaveBeenCalledWith(false);
    });
  });

  describe("component-property delta", () => {
    it("changes material baseColor", () => {
      const delta: IRDelta = {
        type: "component-property",
        nodeId: "entity-1",
        componentIndex: 0,
        property: "Material:baseColor",
        value: "#ff0000",
      };

      applyBabylonDelta(
        entityMap as unknown as Map<string, never>,
        scene as unknown as never,
        delta,
      );

      const mesh = entityMap.get("entity-1") as unknown as MockMesh;
      const material = mesh.material as MockPBRMetallicRoughnessMaterial;
      expect(material.baseColor.r).toBeCloseTo(1, 2);
      expect(material.baseColor.g).toBeCloseTo(0, 2);
      expect(material.baseColor.b).toBeCloseTo(0, 2);
    });

    it("sets roughness directly (NO inversion)", () => {
      const delta: IRDelta = {
        type: "component-property",
        nodeId: "entity-1",
        componentIndex: 0,
        property: "Material:roughness",
        value: 0.3,
      };

      applyBabylonDelta(
        entityMap as unknown as Map<string, never>,
        scene as unknown as never,
        delta,
      );

      const mesh = entityMap.get("entity-1") as unknown as MockMesh;
      const material = mesh.material as MockPBRMetallicRoughnessMaterial;
      // CRITICAL: Direct pass-through, NOT 1 - 0.3
      expect(material.roughness).toBeCloseTo(0.3, 5);
    });

    it("sets metallic directly", () => {
      const delta: IRDelta = {
        type: "component-property",
        nodeId: "entity-1",
        componentIndex: 0,
        property: "Material:metallic",
        value: 0.8,
      };

      applyBabylonDelta(
        entityMap as unknown as Map<string, never>,
        scene as unknown as never,
        delta,
      );

      const mesh = entityMap.get("entity-1") as unknown as MockMesh;
      const material = mesh.material as MockPBRMetallicRoughnessMaterial;
      expect(material.metallic).toBe(0.8);
    });
  });

  describe("environment delta", () => {
    it("changes fog density", () => {
      const delta: IRDelta = {
        type: "environment",
        path: "fog.density",
        value: 0.05,
      };

      applyBabylonDelta(
        entityMap as unknown as Map<string, never>,
        scene as unknown as never,
        delta,
      );

      expect(scene.fogDensity).toBe(0.05);
    });

    it("changes ambient color", () => {
      const delta: IRDelta = {
        type: "environment",
        path: "ambientLight.color",
        value: "#ff0000",
      };

      applyBabylonDelta(
        entityMap as unknown as Map<string, never>,
        scene as unknown as never,
        delta,
      );

      expect(scene.ambientColor.r).toBeCloseTo(1, 2);
      expect(scene.ambientColor.g).toBeCloseTo(0, 2);
      expect(scene.ambientColor.b).toBeCloseTo(0, 2);
    });

    it("changes skybox color to scene clearColor", () => {
      const delta: IRDelta = {
        type: "environment",
        path: "skybox.color",
        value: "#336699",
      };

      applyBabylonDelta(
        entityMap as unknown as Map<string, never>,
        scene as unknown as never,
        delta,
      );

      expect(scene.clearColor.r).toBeCloseTo(0x33 / 255, 2);
      expect(scene.clearColor.g).toBeCloseTo(0x66 / 255, 2);
      expect(scene.clearColor.b).toBeCloseTo(0x99 / 255, 2);
    });

    it("sets fog mode to linear", () => {
      const delta: IRDelta = {
        type: "environment",
        path: "fog.type",
        value: "linear",
      };

      applyBabylonDelta(
        entityMap as unknown as Map<string, never>,
        scene as unknown as never,
        delta,
      );

      expect(scene.fogMode).toBe(MockScene.FOGMODE_LINEAR);
    });

    it("disables fog", () => {
      scene.fogMode = MockScene.FOGMODE_LINEAR;

      const delta: IRDelta = {
        type: "environment",
        path: "fog.enabled",
        value: false,
      };

      applyBabylonDelta(
        entityMap as unknown as Map<string, never>,
        scene as unknown as never,
        delta,
      );

      expect(scene.fogMode).toBe(MockScene.FOGMODE_NONE);
    });
  });

  describe("full-rebuild delta", () => {
    it("does not modify any nodes (caller handles rebuild)", () => {
      const delta: IRDelta = { type: "full-rebuild" };

      const node = entityMap.get("entity-1")!;

      applyBabylonDelta(
        entityMap as unknown as Map<string, never>,
        scene as unknown as never,
        delta,
      );

      // Node state should be unchanged
      expect(node.setEnabled).not.toHaveBeenCalled();
    });
  });

  describe("defensive: unknown nodeId", () => {
    it("is a no-op for transform delta with missing nodeId", () => {
      const delta: IRDelta = {
        type: "node-transform",
        nodeId: "nonexistent-entity",
        transform: { position: { x: 99, y: 99, z: 99 } },
      };

      expect(() =>
        applyBabylonDelta(
          entityMap as unknown as Map<string, never>,
          scene as unknown as never,
          delta,
        ),
      ).not.toThrow();
    });
  });

  describe("Babylon-specific: FOV conversion", () => {
    it("converts FOV from degrees to radians", () => {
      // Create a camera-like entity
      const camera = new MockUniversalCamera("TestCamera", new MockVector3());
      const cameraMap = new Map<string, MockTransformNode>();
      cameraMap.set("cam-1", camera as unknown as MockTransformNode);

      const delta: IRDelta = {
        type: "component-property",
        nodeId: "cam-1",
        componentIndex: 0,
        property: "Camera:fov",
        value: 90,
      };

      applyBabylonDelta(
        cameraMap as unknown as Map<string, never>,
        scene as unknown as never,
        delta,
      );

      // 90 degrees -> pi/2 radians
      expect(camera.fov).toBeCloseTo(90 * DEG_TO_RAD, 5);
    });
  });

  describe("Babylon-specific: rotation uses quaternion", () => {
    it("sets rotationQuaternion, not rotation Euler", () => {
      const delta: IRDelta = {
        type: "node-transform",
        nodeId: "entity-1",
        transform: { rotation: { x: 0, y: 0.707, z: 0, w: 0.707 } },
      };

      applyBabylonDelta(
        entityMap as unknown as Map<string, never>,
        scene as unknown as never,
        delta,
      );

      const node = entityMap.get("entity-1")!;
      // Should be a Quaternion with the right values
      expect(node.rotationQuaternion).not.toBeNull();
      expect(node.rotationQuaternion!.w).toBeCloseTo(0.707, 3);
    });
  });
});
