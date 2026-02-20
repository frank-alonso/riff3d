import { describe, it, expect } from "vitest";
import {
  createEmptyDocument,
  createEntity,
  SceneDocumentSchema,
  EntitySchema,
  type SceneDocument,
  type Entity,
  CURRENT_SCHEMA_VERSION,
} from "@riff3d/ecson";
import { compile } from "../src/compiler";
import { decompile } from "../src/decompiler";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function addEntityToDoc(
  doc: SceneDocument,
  entity: Entity,
  parentId: string,
): SceneDocument {
  const updatedEntities = { ...doc.entities };
  updatedEntities[entity.id] = { ...entity, parentId };

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
describe("decompile", () => {
  it("decompiles CanonicalScene back to valid SceneDocument", () => {
    const doc = createEmptyDocument("Decompile Test");
    const ir = compile(doc);
    const result = decompile(ir);

    // Should be a valid SceneDocument
    expect(() => SceneDocumentSchema.parse(result)).not.toThrow();
    expect(result.name).toBe("Decompile Test");
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("restores entity hierarchy from sorted node array", () => {
    let doc = createEmptyDocument("Hierarchy Test");
    const rootId = doc.rootEntityId;

    const child1 = createEntity("Child1", rootId);
    doc = addEntityToDoc(doc, child1, rootId);

    const child2 = createEntity("Child2", rootId);
    doc = addEntityToDoc(doc, child2, rootId);

    const grandchild = createEntity("Grandchild", child1.id);
    doc = addEntityToDoc(doc, grandchild, child1.id);

    const ir = compile(doc);
    const result = decompile(ir);

    // Root should have 2 children
    const rootEntity = result.entities[rootId];
    expect(rootEntity.children).toContain(child1.id);
    expect(rootEntity.children).toContain(child2.id);

    // Child1 should have grandchild
    const child1Entity = result.entities[child1.id];
    expect(child1Entity.children).toContain(grandchild.id);
    expect(child1Entity.parentId).toBe(rootId);

    // Grandchild should have child1 as parent
    const grandchildEntity = result.entities[grandchild.id];
    expect(grandchildEntity.parentId).toBe(child1.id);
    expect(grandchildEntity.children).toEqual([]);
  });

  it("restores components on entities", () => {
    let doc = createEmptyDocument("Components Test");
    const rootId = doc.rootEntityId;

    const entity = EntitySchema.parse({
      id: "comp-entity",
      name: "ComponentEntity",
      parentId: rootId,
      components: [
        { type: "MeshRenderer", properties: { meshAssetId: "ast_mesh1" } },
        { type: "Light", properties: { lightType: "point", intensity: 2.0 } },
      ],
    });

    doc = addEntityToDoc(doc, entity, rootId);

    const ir = compile(doc);
    const result = decompile(ir);

    const restored = result.entities["comp-entity"];
    expect(restored.components).toHaveLength(2);
    expect(restored.components[0].type).toBe("MeshRenderer");
    expect(restored.components[0].properties).toEqual({ meshAssetId: "ast_mesh1" });
    expect(restored.components[1].type).toBe("Light");
  });

  it("restores assets and wiring", () => {
    let doc = createEmptyDocument("Assets Wire Test");

    doc = SceneDocumentSchema.parse({
      ...doc,
      assets: {
        ast_001: {
          id: "ast_001",
          type: "mesh",
          name: "Cube",
          uri: "https://example.com/cube.glb",
        },
      },
      wiring: [
        {
          id: "wir_001",
          sourceEntityId: "node-1",
          sourceEvent: "onCollision",
          targetEntityId: "node-2",
          targetAction: "destroy",
          parameters: { force: 10 },
        },
      ],
    });

    const ir = compile(doc);
    const result = decompile(ir);

    // Assets restored
    expect(result.assets["ast_001"]).toBeDefined();
    expect(result.assets["ast_001"].name).toBe("Cube");
    expect(result.assets["ast_001"].type).toBe("mesh");
    expect(result.assets["ast_001"].uri).toBe("https://example.com/cube.glb");

    // Wiring restored
    expect(result.wiring).toHaveLength(1);
    expect(result.wiring[0].id).toBe("wir_001");
    expect(result.wiring[0].sourceEntityId).toBe("node-1");
    expect(result.wiring[0].targetAction).toBe("destroy");
    expect(result.wiring[0].parameters).toEqual({ force: 10 });
  });

  it("restores environment settings", () => {
    let doc = createEmptyDocument("Environment Test");

    doc = SceneDocumentSchema.parse({
      ...doc,
      environment: {
        skybox: { type: "hdri", uri: "https://example.com/sky.hdr" },
        fog: { enabled: true, type: "exponential", color: "#aabbcc", near: 5, far: 50, density: 0.05 },
        ambientLight: { color: "#ff9900", intensity: 0.8 },
        gravity: { x: 0, y: -4.9, z: 0 },
      },
    });

    const ir = compile(doc);
    const result = decompile(ir);

    expect(result.environment.skybox.type).toBe("hdri");
    expect(result.environment.skybox.uri).toBe("https://example.com/sky.hdr");
    expect(result.environment.fog.enabled).toBe(true);
    expect(result.environment.fog.type).toBe("exponential");
    expect(result.environment.fog.color).toBe("#aabbcc");
    expect(result.environment.ambientLight.color).toBe("#ff9900");
    expect(result.environment.ambientLight.intensity).toBe(0.8);
    expect(result.environment.gravity.y).toBe(-4.9);
  });
});
