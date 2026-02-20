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

import { buildScene, destroySceneEntities } from "../src/scene-builder";
import type { CanonicalScene, CanonicalNode } from "@riff3d/canonical-ir";

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

function makeScene(nodes: CanonicalNode[]): CanonicalScene {
  const nodeIndex: Record<string, number> = {};
  nodes.forEach((n, i) => {
    nodeIndex[n.id] = i;
  });
  return {
    id: "scene-1",
    name: "Test Scene",
    sourceSchemaVersion: 1,
    nodes,
    nodeIndex,
    rootNodeId: nodes[0]?.id ?? "",
    assets: [],
    wires: [],
    environment: {
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
    },
    gameSettings: null,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("buildScene", () => {
  let scene: MockScene;

  beforeEach(() => {
    scene = new MockScene();
    vi.clearAllMocks();
  });

  it("handles empty scene (0 nodes) without errors", () => {
    const irScene = makeScene([]);

    const result = buildScene(scene as never, irScene);

    expect(result.entityMap.size).toBe(0);
    expect(result.rootNodes.length).toBe(0);
  });

  it("creates TransformNode for each IR node with correct names", () => {
    const irScene = makeScene([
      makeNode({ id: "n1", name: "Cube" }),
      makeNode({ id: "n2", name: "Light" }),
    ]);

    const result = buildScene(scene as never, irScene);

    expect(result.entityMap.size).toBe(2);
    const node1 = result.entityMap.get("n1") as unknown as MockTransformNode;
    const node2 = result.entityMap.get("n2") as unknown as MockTransformNode;
    expect(node1.name).toBe("Cube");
    expect(node2.name).toBe("Light");
  });

  it("applies position, rotation quaternion, and scale transforms", () => {
    const irScene = makeScene([
      makeNode({
        id: "n1",
        name: "Transformed",
        transform: {
          position: { x: 1, y: 2, z: 3 },
          rotation: { x: 0.1, y: 0.2, z: 0.3, w: 0.9 },
          scale: { x: 2, y: 3, z: 4 },
        },
      }),
    ]);

    const result = buildScene(scene as never, irScene);

    const node = result.entityMap.get("n1") as unknown as MockTransformNode;

    // Position
    expect(node.position).toEqual(expect.objectContaining({ x: 1, y: 2, z: 3 }));

    // Rotation quaternion (CRITICAL: must use rotationQuaternion, not rotation)
    expect(node.rotationQuaternion).toEqual(
      expect.objectContaining({ x: 0.1, y: 0.2, z: 0.3, w: 0.9 }),
    );

    // Scale
    expect(node.scaling).toEqual(expect.objectContaining({ x: 2, y: 3, z: 4 }));
  });

  it("establishes parent-child hierarchy via .parent property", () => {
    const irScene = makeScene([
      makeNode({
        id: "parent",
        name: "Parent",
        childIds: ["child"],
      }),
      makeNode({
        id: "child",
        name: "Child",
        parentId: "parent",
      }),
    ]);

    const result = buildScene(scene as never, irScene);

    // Parent should be a root node
    expect(result.rootNodes.length).toBe(1);
    expect(result.rootNodes[0]!.name).toBe("Parent");

    // Child should have parent set
    const childNode = result.entityMap.get("child") as unknown as MockTransformNode;
    const parentNode = result.entityMap.get("parent") as unknown as MockTransformNode;
    expect(childNode.parent).toBe(parentNode);
  });

  it("sets node.id to IR node id for entity map lookup", () => {
    const irScene = makeScene([makeNode({ id: "abc-123", name: "TestNode" })]);

    const result = buildScene(scene as never, irScene);

    const node = result.entityMap.get("abc-123") as unknown as MockTransformNode;
    expect(node.id).toBe("abc-123");
  });

  it("maps node visibility to setEnabled()", () => {
    const irScene = makeScene([
      makeNode({ id: "visible", name: "Visible", visible: true }),
      makeNode({ id: "hidden", name: "Hidden", visible: false }),
    ]);

    const result = buildScene(scene as never, irScene);

    const visibleNode = result.entityMap.get(
      "visible",
    ) as unknown as MockTransformNode;
    const hiddenNode = result.entityMap.get(
      "hidden",
    ) as unknown as MockTransformNode;
    expect(visibleNode.setEnabled).toHaveBeenCalledWith(true);
    expect(hiddenNode.setEnabled).toHaveBeenCalledWith(false);
  });

  it("creates Mesh when node has MeshRenderer component", () => {
    const irScene = makeScene([
      makeNode({
        id: "mesh-node",
        name: "MyCube",
        components: [
          { type: "MeshRenderer", properties: { primitive: "box" } },
        ],
      }),
    ]);

    const result = buildScene(scene as never, irScene);

    // The mockCreateBox should have been called
    expect(mockCreateBox).toHaveBeenCalled();
    // Node should exist in entity map
    expect(result.entityMap.has("mesh-node")).toBe(true);
  });
});

describe("destroySceneEntities", () => {
  it("calls dispose() on all nodes in the entity map", () => {
    const n1 = new MockTransformNode("N1");
    const n2 = new MockTransformNode("N2");

    const entityMap = new Map<string, unknown>([
      ["id1", n1],
      ["id2", n2],
    ]);

    destroySceneEntities(entityMap as Map<string, never>);

    expect(n1.dispose).toHaveBeenCalled();
    expect(n2.dispose).toHaveBeenCalled();
  });

  it("clears the entity map after destruction", () => {
    const n1 = new MockTransformNode("N1");
    const entityMap = new Map<string, unknown>([["id1", n1]]);

    destroySceneEntities(entityMap as Map<string, never>);

    expect(entityMap.size).toBe(0);
  });
});
