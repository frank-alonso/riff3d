import { describe, it, expect } from "vitest";
import {
  createEmptyDocument,
  createEntity,
  type SceneDocument,
  type Entity,
  EntitySchema,
  SceneDocumentSchema,
  CURRENT_SCHEMA_VERSION,
} from "@riff3d/ecson";
import { compile } from "../src/compiler";
import { CanonicalSceneSchema, type CanonicalScene } from "../src/types/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function addEntityToDoc(
  doc: SceneDocument,
  entity: Entity,
  parentId: string,
): SceneDocument {
  // Add entity to the entities record
  const updatedEntities = { ...doc.entities };
  updatedEntities[entity.id] = { ...entity, parentId };

  // Add entity as child of parent
  const parent = updatedEntities[parentId];
  if (parent) {
    updatedEntities[parentId] = {
      ...parent,
      children: [...parent.children, entity.id],
    };
  }

  return SceneDocumentSchema.parse({
    ...doc,
    entities: updatedEntities,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("compile", () => {
  it("compiles empty document (root entity only) to valid CanonicalScene", () => {
    const doc = createEmptyDocument("Empty Test");
    const ir = compile(doc);

    // Should be a valid CanonicalScene
    expect(() => CanonicalSceneSchema.parse(ir)).not.toThrow();

    // Should have exactly 1 node (root)
    expect(ir.nodes).toHaveLength(1);
    expect(ir.nodes[0].id).toBe(doc.rootEntityId);
    expect(ir.rootNodeId).toBe(doc.rootEntityId);

    // nodeIndex maps root to index 0
    expect(ir.nodeIndex[doc.rootEntityId]).toBe(0);

    // Source schema version preserved
    expect(ir.sourceSchemaVersion).toBe(CURRENT_SCHEMA_VERSION);

    // Name preserved
    expect(ir.name).toBe("Empty Test");
  });

  it("compiles document with nested entities into topologically sorted nodes", () => {
    let doc = createEmptyDocument("Hierarchy Test");
    const rootId = doc.rootEntityId;

    const child1 = createEntity("Child1", rootId);
    doc = addEntityToDoc(doc, child1, rootId);

    const child2 = createEntity("Child2", rootId);
    doc = addEntityToDoc(doc, child2, rootId);

    const grandchild = createEntity("Grandchild", child1.id);
    doc = addEntityToDoc(doc, grandchild, child1.id);

    const ir = compile(doc);

    // 4 nodes total
    expect(ir.nodes).toHaveLength(4);

    // Topological sort: parents before children
    const rootIdx = ir.nodeIndex[rootId];
    const child1Idx = ir.nodeIndex[child1.id];
    const child2Idx = ir.nodeIndex[child2.id];
    const grandchildIdx = ir.nodeIndex[grandchild.id];

    expect(rootIdx).toBeLessThan(child1Idx);
    expect(rootIdx).toBeLessThan(child2Idx);
    expect(child1Idx).toBeLessThan(grandchildIdx);
  });

  it("compiles entity with components into CanonicalNodes with CanonicalComponents", () => {
    let doc = createEmptyDocument("Component Test");
    const rootId = doc.rootEntityId;

    // Add entity with components
    const entity = EntitySchema.parse({
      id: "entity-with-components",
      name: "LitBox",
      parentId: rootId,
      components: [
        { type: "MeshRenderer", properties: { meshAssetId: "ast_mesh1" } },
        { type: "Light", properties: { lightType: "point", intensity: 2.0 } },
      ],
    });

    doc = addEntityToDoc(doc, entity, rootId);
    const ir = compile(doc);

    const entityNode = ir.nodes[ir.nodeIndex["entity-with-components"]];
    expect(entityNode.components).toHaveLength(2);
    expect(entityNode.components[0].type).toBe("MeshRenderer");
    expect(entityNode.components[0].properties).toEqual({ meshAssetId: "ast_mesh1" });
    expect(entityNode.components[1].type).toBe("Light");
    expect(entityNode.components[1].properties).toEqual({ lightType: "point", intensity: 2.0 });
  });

  it("compiles assets into CanonicalAssets", () => {
    let doc = createEmptyDocument("Asset Test");

    doc = SceneDocumentSchema.parse({
      ...doc,
      assets: {
        ast_001: {
          id: "ast_001",
          type: "mesh",
          name: "Cube",
          uri: "https://example.com/cube.glb",
        },
        ast_002: {
          id: "ast_002",
          type: "texture",
          name: "Stone",
          uri: "https://example.com/stone.png",
        },
      },
    });

    const ir = compile(doc);

    expect(ir.assets).toHaveLength(2);

    // Assets should have all fields normalized (uri nullable, data nullable)
    const cubeAsset = ir.assets.find((a) => a.id === "ast_001");
    expect(cubeAsset).toBeDefined();
    expect(cubeAsset!.type).toBe("mesh");
    expect(cubeAsset!.name).toBe("Cube");
    expect(cubeAsset!.uri).toBe("https://example.com/cube.glb");
    expect(cubeAsset!.data).toBeNull();
  });

  it("compiles event wires into CanonicalWires", () => {
    let doc = createEmptyDocument("Wire Test");

    doc = SceneDocumentSchema.parse({
      ...doc,
      wiring: [
        {
          id: "wir_001",
          sourceEntityId: "node-1",
          sourceEvent: "onCollision",
          targetEntityId: "node-2",
          targetAction: "destroy",
        },
        {
          id: "wir_002",
          sourceEntityId: "node-3",
          sourceEvent: "onClick",
          targetEntityId: "node-4",
          targetAction: "playSound",
          parameters: { volume: 0.8 },
        },
      ],
    });

    const ir = compile(doc);

    expect(ir.wires).toHaveLength(2);

    const wire1 = ir.wires.find((w) => w.id === "wir_001");
    expect(wire1).toBeDefined();
    expect(wire1!.sourceNodeId).toBe("node-1");
    expect(wire1!.sourceEvent).toBe("onCollision");
    expect(wire1!.targetNodeId).toBe("node-2");
    expect(wire1!.targetAction).toBe("destroy");
    expect(wire1!.parameters).toEqual({}); // Normalized from undefined to {}

    const wire2 = ir.wires.find((w) => w.id === "wir_002");
    expect(wire2!.parameters).toEqual({ volume: 0.8 });
  });

  it("compiles environment settings with all defaults baked in", () => {
    const doc = createEmptyDocument("Env Test");
    const ir = compile(doc);

    // Environment should be fully explicit
    expect(ir.environment.skybox.type).toBe("color");
    expect(ir.environment.skybox.color).toBeNull();
    expect(ir.environment.skybox.uri).toBeNull();
    expect(ir.environment.fog.enabled).toBe(false);
    expect(ir.environment.fog.type).toBe("linear");
    expect(ir.environment.fog.color).toBe("#cccccc");
    expect(ir.environment.fog.near).toBe(10);
    expect(ir.environment.fog.far).toBe(100);
    expect(ir.environment.fog.density).toBe(0.01);
    expect(ir.environment.ambientLight.color).toBe("#ffffff");
    expect(ir.environment.ambientLight.intensity).toBe(0.5);
    expect(ir.environment.gravity).toEqual({ x: 0, y: -9.81, z: 0 });
  });

  it("preserves engine tuning sections on nodes", () => {
    let doc = createEmptyDocument("Tuning Test");
    const rootId = doc.rootEntityId;

    const entity = EntitySchema.parse({
      id: "tuned-entity",
      name: "Tuned",
      parentId: rootId,
      tuning: {
        playcanvas: { castShadows: true, batchGroupId: 5 },
        babylon: { billboardMode: 7 },
      },
    });

    doc = addEntityToDoc(doc, entity, rootId);
    const ir = compile(doc);

    const node = ir.nodes[ir.nodeIndex["tuned-entity"]];
    expect(node.tuning).toEqual({
      playcanvas: { castShadows: true, batchGroupId: 5 },
      babylon: { billboardMode: 7 },
    });
  });

  it("nodeIndex provides correct O(1) lookup for all nodes", () => {
    let doc = createEmptyDocument("Index Test");
    const rootId = doc.rootEntityId;

    const a = createEntity("A", rootId);
    doc = addEntityToDoc(doc, a, rootId);
    const b = createEntity("B", rootId);
    doc = addEntityToDoc(doc, b, rootId);

    const ir = compile(doc);

    // Every node should be addressable via nodeIndex
    for (const node of ir.nodes) {
      const idx = ir.nodeIndex[node.id];
      expect(idx).toBeDefined();
      expect(ir.nodes[idx].id).toBe(node.id);
    }
  });

  it("rejects invalid ECSON (Zod parse failure)", () => {
    expect(() =>
      compile({ not: "a valid document" } as unknown as SceneDocument),
    ).toThrow();
  });
});
