import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MockApplication,
  MockEntity,
  createPlayCanvasMockModule,
} from "./helpers/pc-mocks";

vi.mock("playcanvas", () => createPlayCanvasMockModule());

import { buildScene, destroySceneEntities } from "../src/scene-builder";
import type { CanonicalScene, CanonicalNode } from "@riff3d/canonical-ir";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeNode(overrides: Partial<CanonicalNode> & { id: string; name: string }): CanonicalNode {
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
  nodes.forEach((n, i) => { nodeIndex[n.id] = i; });
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
      fog: { enabled: false, type: "linear", color: "#ffffff", near: 0, far: 100, density: 0.01 },
      ambientLight: { color: "#ffffff", intensity: 0.5 },
      gravity: { x: 0, y: -9.81, z: 0 },
    },
    gameSettings: null,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("buildScene", () => {
  let app: MockApplication;

  beforeEach(() => {
    app = new MockApplication();
  });

  it("creates entities for each IR node with correct names", () => {
    const scene = makeScene([
      makeNode({ id: "n1", name: "Cube" }),
      makeNode({ id: "n2", name: "Light" }),
    ]);

    const result = buildScene(app as never, scene);

    expect(result.entityMap.size).toBe(2);
    const e1 = result.entityMap.get("n1") as unknown as MockEntity;
    const e2 = result.entityMap.get("n2") as unknown as MockEntity;
    expect(e1.name).toBe("Cube");
    expect(e2.name).toBe("Light");
  });

  it("applies position, rotation, and scale transforms", () => {
    const scene = makeScene([
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

    buildScene(app as never, scene);

    const entity = app.root.children[0] as MockEntity;
    expect(entity.setLocalPosition).toHaveBeenCalledWith(1, 2, 3);
    expect(entity.setLocalRotation).toHaveBeenCalledWith(0.1, 0.2, 0.3, 0.9);
    expect(entity.setLocalScale).toHaveBeenCalledWith(2, 3, 4);
  });

  it("handles parent-child hierarchy via addChild", () => {
    const scene = makeScene([
      makeNode({ id: "parent", name: "Parent", childIds: ["child"] }),
      makeNode({ id: "child", name: "Child", parentId: "parent" }),
    ]);

    const result = buildScene(app as never, scene);

    // Parent should be added to app.root
    expect(app.root.addChild).toHaveBeenCalled();
    expect(result.rootEntities.length).toBe(1);

    // Child should be added to parent, not app.root
    const parentEntity = result.entityMap.get("parent") as unknown as MockEntity;
    expect(parentEntity.addChild).toHaveBeenCalled();
    const childEntity = result.entityMap.get("child") as unknown as MockEntity;
    expect(childEntity.parent).toBe(parentEntity);
  });

  it("returns entityMap with ECSON IDs as keys", () => {
    const scene = makeScene([
      makeNode({ id: "abc-123", name: "A" }),
      makeNode({ id: "def-456", name: "B" }),
    ]);

    const result = buildScene(app as never, scene);

    expect(result.entityMap.has("abc-123")).toBe(true);
    expect(result.entityMap.has("def-456")).toBe(true);
    expect(result.entityMap.has("unknown")).toBe(false);
  });

  it("handles visibility (entity.enabled = false for invisible nodes)", () => {
    const scene = makeScene([
      makeNode({ id: "visible", name: "Visible", visible: true }),
      makeNode({ id: "hidden", name: "Hidden", visible: false }),
    ]);

    const result = buildScene(app as never, scene);

    const visibleEntity = result.entityMap.get("visible") as unknown as MockEntity;
    const hiddenEntity = result.entityMap.get("hidden") as unknown as MockEntity;
    expect(visibleEntity.enabled).toBe(true);
    expect(hiddenEntity.enabled).toBe(false);
  });

  it("handles empty scene (0 nodes) without errors", () => {
    const scene = makeScene([]);

    const result = buildScene(app as never, scene);

    expect(result.entityMap.size).toBe(0);
    expect(result.rootEntities.length).toBe(0);
  });

  it("adds root nodes to app.root and tracks them in rootEntities", () => {
    const scene = makeScene([
      makeNode({ id: "r1", name: "Root1" }),
      makeNode({ id: "r2", name: "Root2" }),
    ]);

    const result = buildScene(app as never, scene);

    expect(result.rootEntities.length).toBe(2);
    expect(app.root.addChild).toHaveBeenCalledTimes(2);
  });
});

describe("destroySceneEntities", () => {
  it("calls destroy() on all entities in the map", () => {
    const e1 = new MockEntity("E1");
    const e2 = new MockEntity("E2");
    // Simulate them being in the scene graph (parent set)
    e1.parent = new MockEntity("Root");
    e2.parent = new MockEntity("Root");

    const entityMap = new Map<string, unknown>([
      ["id1", e1],
      ["id2", e2],
    ]);

    destroySceneEntities(entityMap as Map<string, never>);

    expect(e1.destroy).toHaveBeenCalled();
    expect(e2.destroy).toHaveBeenCalled();
  });

  it("returns empty entity map after destruction", () => {
    const e1 = new MockEntity("E1");
    e1.parent = new MockEntity("Root");

    const entityMap = new Map<string, unknown>([["id1", e1]]);

    destroySceneEntities(entityMap as Map<string, never>);

    expect(entityMap.size).toBe(0);
  });

  it("skips entities with no parent (already detached)", () => {
    const e1 = new MockEntity("E1");
    // No parent -- simulates already-destroyed entity
    e1.parent = null;

    const entityMap = new Map<string, unknown>([["id1", e1]]);

    destroySceneEntities(entityMap as Map<string, never>);

    expect(e1.destroy).not.toHaveBeenCalled();
    expect(entityMap.size).toBe(0);
  });
});
