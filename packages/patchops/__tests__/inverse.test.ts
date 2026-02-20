import { describe, it, expect } from "vitest";
import {
  SceneDocumentSchema,
  EntitySchema,
  CURRENT_SCHEMA_VERSION,
  type SceneDocument,
} from "@riff3d/ecson";
import { applyOp } from "../src/engine";
import { CURRENT_PATCHOP_VERSION } from "../src/version";
import type { PatchOp } from "../src/schemas";

function createTestDoc(): SceneDocument {
  const rootId = "root_001";
  return SceneDocumentSchema.parse({
    id: "doc_001",
    name: "Test Scene",
    schemaVersion: CURRENT_SCHEMA_VERSION,
    rootEntityId: rootId,
    entities: {
      [rootId]: {
        id: rootId,
        name: "Root",
        parentId: null,
      },
    },
  });
}

function makeOp(type: string, payload: Record<string, unknown>): PatchOp {
  return {
    id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    origin: "user",
    version: CURRENT_PATCHOP_VERSION,
    type,
    payload,
  } as PatchOp;
}

/** Deep clone a document for comparison. */
function cloneDoc(doc: SceneDocument): SceneDocument {
  return JSON.parse(JSON.stringify(doc));
}

describe("apply-inverse identity (all 16 op types)", () => {
  it("CreateEntity: apply then inverse restores document", () => {
    const doc = createTestDoc();
    const original = cloneDoc(doc);

    const op = makeOp("CreateEntity", {
      entityId: "ent_new",
      name: "NewEntity",
      parentId: "root_001",
    });

    const inverse = applyOp(doc, op);
    applyOp(doc, inverse);

    expect(doc).toEqual(original);
  });

  it("DeleteEntity: apply then inverse restores document", () => {
    const doc = createTestDoc();
    const entity = EntitySchema.parse({
      id: "ent_del",
      name: "ToDelete",
      parentId: "root_001",
      components: [{ type: "Light", properties: { intensity: 1.0 } }],
      tags: ["test"],
      transform: {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
    });
    doc.entities["ent_del"] = entity;
    doc.entities["root_001"]!.children.push("ent_del");

    const original = cloneDoc(doc);

    const op = makeOp("DeleteEntity", {
      entityId: "ent_del",
      previousState: entity,
    });

    const inverse = applyOp(doc, op);
    applyOp(doc, inverse);

    expect(doc).toEqual(original);
  });

  it("SetProperty: apply then inverse restores document", () => {
    const doc = createTestDoc();
    const original = cloneDoc(doc);

    const op = makeOp("SetProperty", {
      entityId: "root_001",
      path: "name",
      value: "Changed",
      previousValue: "Root",
    });

    const inverse = applyOp(doc, op);
    applyOp(doc, inverse);

    expect(doc).toEqual(original);
  });

  it("SetProperty (nested path): apply then inverse restores document", () => {
    const doc = createTestDoc();
    const original = cloneDoc(doc);

    const op = makeOp("SetProperty", {
      entityId: "root_001",
      path: "transform.position.x",
      value: 42,
      previousValue: 0,
    });

    const inverse = applyOp(doc, op);
    applyOp(doc, inverse);

    expect(doc).toEqual(original);
  });

  it("AddChild: apply then inverse restores document", () => {
    const doc = createTestDoc();
    doc.entities["child_1"] = EntitySchema.parse({
      id: "child_1",
      name: "Child",
      parentId: "root_001",
    });
    const original = cloneDoc(doc);

    const op = makeOp("AddChild", {
      parentId: "root_001",
      childId: "child_1",
    });

    const inverse = applyOp(doc, op);
    applyOp(doc, inverse);

    expect(doc).toEqual(original);
  });

  it("RemoveChild: apply then inverse restores document", () => {
    const doc = createTestDoc();
    doc.entities["child_1"] = EntitySchema.parse({
      id: "child_1",
      name: "Child",
      parentId: "root_001",
    });
    doc.entities["root_001"]!.children = ["child_1"];
    const original = cloneDoc(doc);

    const op = makeOp("RemoveChild", {
      parentId: "root_001",
      childId: "child_1",
      previousIndex: 0,
    });

    const inverse = applyOp(doc, op);
    applyOp(doc, inverse);

    expect(doc).toEqual(original);
  });

  it("Reparent: apply then inverse restores original parent AND sibling order", () => {
    const doc = createTestDoc();
    doc.entities["parentA"] = EntitySchema.parse({
      id: "parentA",
      name: "ParentA",
      parentId: "root_001",
      children: ["child_x", "child_y"],
    });
    doc.entities["parentB"] = EntitySchema.parse({
      id: "parentB",
      name: "ParentB",
      parentId: "root_001",
      children: ["child_z"],
    });
    doc.entities["child_x"] = EntitySchema.parse({
      id: "child_x",
      name: "ChildX",
      parentId: "parentA",
    });
    doc.entities["child_y"] = EntitySchema.parse({
      id: "child_y",
      name: "ChildY",
      parentId: "parentA",
    });
    doc.entities["child_z"] = EntitySchema.parse({
      id: "child_z",
      name: "ChildZ",
      parentId: "parentB",
    });

    const original = cloneDoc(doc);

    const op = makeOp("Reparent", {
      entityId: "child_x",
      newParentId: "parentB",
      oldParentId: "parentA",
      oldIndex: 0,
      newIndex: 1,
    });

    const inverse = applyOp(doc, op);
    applyOp(doc, inverse);

    expect(doc).toEqual(original);
  });

  it("AddComponent: apply then inverse restores document", () => {
    const doc = createTestDoc();
    const original = cloneDoc(doc);

    const op = makeOp("AddComponent", {
      entityId: "root_001",
      component: { type: "Light", properties: { intensity: 1.5 } },
    });

    const inverse = applyOp(doc, op);
    applyOp(doc, inverse);

    expect(doc).toEqual(original);
  });

  it("RemoveComponent: apply then inverse restores document", () => {
    const doc = createTestDoc();
    doc.entities["root_001"]!.components.push({
      type: "Camera",
      properties: { fov: 60 },
    });
    const original = cloneDoc(doc);

    const op = makeOp("RemoveComponent", {
      entityId: "root_001",
      componentType: "Camera",
      previousComponent: { type: "Camera", properties: { fov: 60 } },
    });

    const inverse = applyOp(doc, op);
    applyOp(doc, inverse);

    expect(doc).toEqual(original);
  });

  it("SetComponentProperty: apply then inverse restores document", () => {
    const doc = createTestDoc();
    doc.entities["root_001"]!.components.push({
      type: "Light",
      properties: { intensity: 1.0, color: "#ffffff" },
    });
    const original = cloneDoc(doc);

    const op = makeOp("SetComponentProperty", {
      entityId: "root_001",
      componentType: "Light",
      propertyPath: "intensity",
      value: 2.5,
      previousValue: 1.0,
    });

    const inverse = applyOp(doc, op);
    applyOp(doc, inverse);

    expect(doc).toEqual(original);
  });

  it("AddAsset: apply then inverse restores document", () => {
    const doc = createTestDoc();
    const original = cloneDoc(doc);

    const op = makeOp("AddAsset", {
      asset: {
        id: "ast_new",
        type: "texture",
        name: "new_texture.png",
        metadata: {},
      },
    });

    const inverse = applyOp(doc, op);
    applyOp(doc, inverse);

    expect(doc).toEqual(original);
  });

  it("RemoveAsset: apply then inverse restores document", () => {
    const doc = createTestDoc();
    doc.assets["ast_rm"] = {
      id: "ast_rm",
      type: "mesh",
      name: "model.glb",
      metadata: {},
    };
    const original = cloneDoc(doc);

    const op = makeOp("RemoveAsset", {
      assetId: "ast_rm",
      previousAsset: {
        id: "ast_rm",
        type: "mesh",
        name: "model.glb",
        metadata: {},
      },
    });

    const inverse = applyOp(doc, op);
    applyOp(doc, inverse);

    expect(doc).toEqual(original);
  });

  it("ReplaceAssetRef: apply then inverse restores document", () => {
    const doc = createTestDoc();
    doc.entities["root_001"]!.components.push({
      type: "MeshRenderer",
      properties: { materialAssetId: "ast_old" },
    });
    const original = cloneDoc(doc);

    const op = makeOp("ReplaceAssetRef", {
      entityId: "root_001",
      componentType: "MeshRenderer",
      propertyPath: "materialAssetId",
      newAssetId: "ast_new",
      oldAssetId: "ast_old",
    });

    const inverse = applyOp(doc, op);
    applyOp(doc, inverse);

    expect(doc).toEqual(original);
  });

  it("AddKeyframe: apply then inverse restores document", () => {
    const doc = createTestDoc();
    doc.entities["root_001"]!.components.push({
      type: "Animation",
      properties: { tracks: {} },
    });
    const original = cloneDoc(doc);

    const op = makeOp("AddKeyframe", {
      entityId: "root_001",
      trackId: "pos_x",
      time: 0.5,
      value: 10,
    });

    const inverse = applyOp(doc, op);
    applyOp(doc, inverse);

    expect(doc).toEqual(original);
  });

  it("RemoveKeyframe: apply then inverse restores document", () => {
    const doc = createTestDoc();
    doc.entities["root_001"]!.components.push({
      type: "Animation",
      properties: {
        tracks: {
          pos_x: { keyframes: [{ time: 0.5, value: 10 }] },
        },
      },
    });
    const original = cloneDoc(doc);

    const op = makeOp("RemoveKeyframe", {
      entityId: "root_001",
      trackId: "pos_x",
      time: 0.5,
      previousValue: 10,
    });

    const inverse = applyOp(doc, op);
    applyOp(doc, inverse);

    expect(doc).toEqual(original);
  });

  it("SetKeyframeValue: apply then inverse restores document", () => {
    const doc = createTestDoc();
    doc.entities["root_001"]!.components.push({
      type: "Animation",
      properties: {
        tracks: {
          pos_x: { keyframes: [{ time: 0.5, value: 10 }] },
        },
      },
    });
    const original = cloneDoc(doc);

    const op = makeOp("SetKeyframeValue", {
      entityId: "root_001",
      trackId: "pos_x",
      time: 0.5,
      value: 20,
      previousValue: 10,
    });

    const inverse = applyOp(doc, op);
    applyOp(doc, inverse);

    expect(doc).toEqual(original);
  });

  it("BatchOp: apply then inverse restores document to pre-batch state", () => {
    const doc = createTestDoc();
    const original = cloneDoc(doc);

    const batchOp = makeOp("BatchOp", {
      ops: [
        makeOp("CreateEntity", {
          entityId: "ent_b1",
          name: "Batch1",
          parentId: "root_001",
        }),
        makeOp("SetProperty", {
          entityId: "root_001",
          path: "name",
          value: "BatchedRoot",
          previousValue: "Root",
        }),
      ],
    });

    const inverse = applyOp(doc, batchOp);
    applyOp(doc, inverse);

    expect(doc).toEqual(original);
  });
});

describe("validation", () => {
  it("Reparent rejects circular reparent (reparenting under own descendant)", () => {
    const doc = createTestDoc();
    doc.entities["parentA"] = EntitySchema.parse({
      id: "parentA",
      name: "ParentA",
      parentId: "root_001",
      children: ["child_x"],
    });
    doc.entities["child_x"] = EntitySchema.parse({
      id: "child_x",
      name: "ChildX",
      parentId: "parentA",
      children: ["grandchild"],
    });
    doc.entities["grandchild"] = EntitySchema.parse({
      id: "grandchild",
      name: "Grandchild",
      parentId: "child_x",
    });

    // Try to reparent parentA under its grandchild -- should be rejected
    const op = makeOp("Reparent", {
      entityId: "parentA",
      newParentId: "grandchild",
      oldParentId: "root_001",
      oldIndex: 0,
    });

    expect(() => applyOp(doc, op)).toThrow(/circular/i);
  });

  it("Reparent allows non-circular reparent", () => {
    const doc = createTestDoc();
    doc.entities["sibling"] = EntitySchema.parse({
      id: "sibling",
      name: "Sibling",
      parentId: "root_001",
    });
    doc.entities["other"] = EntitySchema.parse({
      id: "other",
      name: "Other",
      parentId: "root_001",
    });
    doc.entities["root_001"]!.children = ["sibling", "other"];

    const op = makeOp("Reparent", {
      entityId: "sibling",
      newParentId: "other",
      oldParentId: "root_001",
      oldIndex: 0,
    });

    // Should not throw
    expect(() => applyOp(doc, op)).not.toThrow();
  });
});
