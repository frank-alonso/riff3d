import { describe, it, expect, beforeEach } from "vitest";
import type { SceneDocument, Entity } from "@riff3d/ecson";
import { applyOp, applyOps } from "../src/engine.js";
import { CURRENT_PATCHOP_VERSION } from "../src/version.js";
import type { PatchOp } from "../src/schemas.js";

/** Helper: create a minimal valid SceneDocument for testing. */
function createTestDoc(): SceneDocument {
  const rootId = "root_001";
  return {
    id: "doc_001",
    name: "Test Scene",
    schemaVersion: 1,
    rootEntityId: rootId,
    entities: {
      [rootId]: {
        id: rootId,
        name: "Root",
        parentId: null,
        children: [],
        components: [],
        tags: [],
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
        visible: true,
        locked: false,
      },
    },
    assets: {},
    wiring: [],
    environment: {
      skybox: { type: "color", color: "#87CEEB" },
      fog: { type: "none" },
      ambientLight: { color: "#404040", intensity: 1 },
      gravity: { x: 0, y: -9.81, z: 0 },
    },
    metadata: {},
  };
}

function makeOp(type: string, payload: Record<string, unknown>): PatchOp {
  return {
    id: `op_${Date.now()}`,
    timestamp: Date.now(),
    origin: "user",
    version: CURRENT_PATCHOP_VERSION,
    type,
    payload,
  } as PatchOp;
}

describe("applyOp", () => {
  let doc: SceneDocument;

  beforeEach(() => {
    doc = createTestDoc();
  });

  describe("CreateEntity", () => {
    it("adds entity to document and returns DeleteEntity inverse", () => {
      const op = makeOp("CreateEntity", {
        entityId: "ent_child1",
        name: "Cube",
        parentId: "root_001",
      });

      const inverse = applyOp(doc, op);

      expect(doc.entities["ent_child1"]).toBeDefined();
      expect(doc.entities["ent_child1"]!.name).toBe("Cube");
      expect(doc.entities["ent_child1"]!.parentId).toBe("root_001");
      expect(doc.entities["root_001"]!.children).toContain("ent_child1");
      expect(inverse.type).toBe("DeleteEntity");
    });
  });

  describe("DeleteEntity", () => {
    it("removes entity from document and returns CreateEntity inverse", () => {
      // First create an entity
      const entity: Entity = {
        id: "ent_todelete",
        name: "ToDelete",
        parentId: "root_001",
        children: [],
        components: [],
        tags: [],
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
        visible: true,
        locked: false,
      };
      doc.entities["ent_todelete"] = entity;
      doc.entities["root_001"]!.children.push("ent_todelete");

      const op = makeOp("DeleteEntity", {
        entityId: "ent_todelete",
        previousState: entity,
      });

      const inverse = applyOp(doc, op);

      expect(doc.entities["ent_todelete"]).toBeUndefined();
      expect(doc.entities["root_001"]!.children).not.toContain("ent_todelete");
      expect(inverse.type).toBe("CreateEntity");
    });
  });

  describe("SetProperty", () => {
    it("updates property at path and returns inverse with old value", () => {
      const op = makeOp("SetProperty", {
        entityId: "root_001",
        path: "name",
        value: "Renamed Root",
        previousValue: "Root",
      });

      const inverse = applyOp(doc, op);

      expect(doc.entities["root_001"]!.name).toBe("Renamed Root");
      expect(inverse.type).toBe("SetProperty");
      if (inverse.type === "SetProperty") {
        expect(inverse.payload.value).toBe("Root");
        expect(inverse.payload.previousValue).toBe("Renamed Root");
      }
    });

    it("handles nested paths like transform.position.x", () => {
      const op = makeOp("SetProperty", {
        entityId: "root_001",
        path: "transform.position.x",
        value: 5,
        previousValue: 0,
      });

      const inverse = applyOp(doc, op);

      expect(doc.entities["root_001"]!.transform.position.x).toBe(5);
      expect(inverse.type).toBe("SetProperty");
    });
  });

  describe("AddChild", () => {
    it("adds childId to parent's children array", () => {
      // First add a child entity
      doc.entities["ent_child1"] = {
        id: "ent_child1",
        name: "Child",
        parentId: "root_001",
        children: [],
        components: [],
        tags: [],
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
        visible: true,
        locked: false,
      };

      const op = makeOp("AddChild", {
        parentId: "root_001",
        childId: "ent_child1",
      });

      const inverse = applyOp(doc, op);

      expect(doc.entities["root_001"]!.children).toContain("ent_child1");
      expect(inverse.type).toBe("RemoveChild");
    });

    it("inserts at specified index", () => {
      doc.entities["root_001"]!.children = ["child_a", "child_b"];
      doc.entities["ent_new"] = {
        id: "ent_new",
        name: "New",
        parentId: "root_001",
        children: [],
        components: [],
        tags: [],
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
        visible: true,
        locked: false,
      };

      const op = makeOp("AddChild", {
        parentId: "root_001",
        childId: "ent_new",
        index: 1,
      });

      applyOp(doc, op);

      expect(doc.entities["root_001"]!.children).toEqual([
        "child_a",
        "ent_new",
        "child_b",
      ]);
    });
  });

  describe("RemoveChild", () => {
    it("removes childId from parent's children", () => {
      doc.entities["root_001"]!.children = ["child_a", "child_b"];

      const op = makeOp("RemoveChild", {
        parentId: "root_001",
        childId: "child_a",
        previousIndex: 0,
      });

      const inverse = applyOp(doc, op);

      expect(doc.entities["root_001"]!.children).toEqual(["child_b"]);
      expect(inverse.type).toBe("AddChild");
    });
  });

  describe("Reparent", () => {
    it("moves entity between parents", () => {
      // Setup: root -> parentA -> child, root -> parentB
      doc.entities["parentA"] = {
        id: "parentA",
        name: "ParentA",
        parentId: "root_001",
        children: ["child_x"],
        components: [],
        tags: [],
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
        visible: true,
        locked: false,
      };
      doc.entities["parentB"] = {
        id: "parentB",
        name: "ParentB",
        parentId: "root_001",
        children: [],
        components: [],
        tags: [],
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
        visible: true,
        locked: false,
      };
      doc.entities["child_x"] = {
        id: "child_x",
        name: "ChildX",
        parentId: "parentA",
        children: [],
        components: [],
        tags: [],
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
        visible: true,
        locked: false,
      };

      const op = makeOp("Reparent", {
        entityId: "child_x",
        newParentId: "parentB",
        oldParentId: "parentA",
        oldIndex: 0,
      });

      const inverse = applyOp(doc, op);

      expect(doc.entities["child_x"]!.parentId).toBe("parentB");
      expect(doc.entities["parentA"]!.children).not.toContain("child_x");
      expect(doc.entities["parentB"]!.children).toContain("child_x");
      expect(inverse.type).toBe("Reparent");
    });
  });

  describe("AddComponent", () => {
    it("adds component to entity", () => {
      const comp = { type: "Light", properties: { intensity: 1.0 } };

      const op = makeOp("AddComponent", {
        entityId: "root_001",
        component: comp,
      });

      const inverse = applyOp(doc, op);

      expect(
        doc.entities["root_001"]!.components.some(
          (c) => c.type === "Light",
        ),
      ).toBe(true);
      expect(inverse.type).toBe("RemoveComponent");
    });
  });

  describe("RemoveComponent", () => {
    it("removes component from entity", () => {
      const comp = { type: "Light", properties: { intensity: 1.0 } };
      doc.entities["root_001"]!.components.push(comp);

      const op = makeOp("RemoveComponent", {
        entityId: "root_001",
        componentType: "Light",
        previousComponent: comp,
      });

      const inverse = applyOp(doc, op);

      expect(
        doc.entities["root_001"]!.components.some(
          (c) => c.type === "Light",
        ),
      ).toBe(false);
      expect(inverse.type).toBe("AddComponent");
    });
  });

  describe("SetComponentProperty", () => {
    it("updates component property", () => {
      doc.entities["root_001"]!.components.push({
        type: "Light",
        properties: { intensity: 1.0 },
      });

      const op = makeOp("SetComponentProperty", {
        entityId: "root_001",
        componentType: "Light",
        propertyPath: "intensity",
        value: 2.0,
        previousValue: 1.0,
      });

      const inverse = applyOp(doc, op);

      const light = doc.entities["root_001"]!.components.find(
        (c) => c.type === "Light",
      );
      expect(light!.properties["intensity"]).toBe(2.0);
      expect(inverse.type).toBe("SetComponentProperty");
    });
  });

  describe("AddAsset", () => {
    it("adds asset to document", () => {
      const asset = {
        id: "ast_001",
        type: "texture" as const,
        name: "diffuse.png",
        metadata: {},
      };

      const op = makeOp("AddAsset", { asset });
      const inverse = applyOp(doc, op);

      expect(doc.assets["ast_001"]).toBeDefined();
      expect(doc.assets["ast_001"]!.name).toBe("diffuse.png");
      expect(inverse.type).toBe("RemoveAsset");
    });
  });

  describe("RemoveAsset", () => {
    it("removes asset from document", () => {
      const asset = {
        id: "ast_001",
        type: "texture" as const,
        name: "diffuse.png",
        metadata: {},
      };
      doc.assets["ast_001"] = asset;

      const op = makeOp("RemoveAsset", {
        assetId: "ast_001",
        previousAsset: asset,
      });

      const inverse = applyOp(doc, op);

      expect(doc.assets["ast_001"]).toBeUndefined();
      expect(inverse.type).toBe("AddAsset");
    });
  });

  describe("ReplaceAssetRef", () => {
    it("updates asset reference in component", () => {
      doc.entities["root_001"]!.components.push({
        type: "MeshRenderer",
        properties: { materialAssetId: "ast_001" },
      });

      const op = makeOp("ReplaceAssetRef", {
        entityId: "root_001",
        componentType: "MeshRenderer",
        propertyPath: "materialAssetId",
        newAssetId: "ast_002",
        oldAssetId: "ast_001",
      });

      const inverse = applyOp(doc, op);

      const mr = doc.entities["root_001"]!.components.find(
        (c) => c.type === "MeshRenderer",
      );
      expect(mr!.properties["materialAssetId"]).toBe("ast_002");
      expect(inverse.type).toBe("ReplaceAssetRef");
      if (inverse.type === "ReplaceAssetRef") {
        expect(inverse.payload.newAssetId).toBe("ast_001");
        expect(inverse.payload.oldAssetId).toBe("ast_002");
      }
    });
  });

  describe("AddKeyframe", () => {
    it("adds keyframe to animation data", () => {
      doc.entities["root_001"]!.components.push({
        type: "Animation",
        properties: { tracks: {} },
      });

      const op = makeOp("AddKeyframe", {
        entityId: "root_001",
        trackId: "pos_x",
        time: 0.5,
        value: 10,
      });

      const inverse = applyOp(doc, op);
      expect(inverse.type).toBe("RemoveKeyframe");
    });
  });

  describe("RemoveKeyframe", () => {
    it("removes keyframe from animation data", () => {
      doc.entities["root_001"]!.components.push({
        type: "Animation",
        properties: {
          tracks: {
            pos_x: { keyframes: [{ time: 0.5, value: 10 }] },
          },
        },
      });

      const op = makeOp("RemoveKeyframe", {
        entityId: "root_001",
        trackId: "pos_x",
        time: 0.5,
        previousValue: 10,
      });

      const inverse = applyOp(doc, op);
      expect(inverse.type).toBe("AddKeyframe");
    });
  });

  describe("SetKeyframeValue", () => {
    it("updates keyframe value", () => {
      doc.entities["root_001"]!.components.push({
        type: "Animation",
        properties: {
          tracks: {
            pos_x: { keyframes: [{ time: 0.5, value: 10 }] },
          },
        },
      });

      const op = makeOp("SetKeyframeValue", {
        entityId: "root_001",
        trackId: "pos_x",
        time: 0.5,
        value: 20,
        previousValue: 10,
      });

      const inverse = applyOp(doc, op);
      expect(inverse.type).toBe("SetKeyframeValue");
    });
  });

  describe("BatchOp", () => {
    it("applies all sub-ops and returns BatchOp inverse with reversed sub-inverses", () => {
      const ops: PatchOp[] = [
        makeOp("CreateEntity", {
          entityId: "ent_batch1",
          name: "Batch1",
          parentId: "root_001",
        }),
        makeOp("SetProperty", {
          entityId: "root_001",
          path: "name",
          value: "Updated Root",
          previousValue: "Root",
        }),
      ];

      const batchOp = makeOp("BatchOp", { ops });
      const inverse = applyOp(doc, batchOp);

      expect(doc.entities["ent_batch1"]).toBeDefined();
      expect(doc.entities["root_001"]!.name).toBe("Updated Root");
      expect(inverse.type).toBe("BatchOp");
      if (inverse.type === "BatchOp") {
        expect(inverse.payload.ops).toHaveLength(2);
        // Sub-inverses should be in reverse order
        expect(inverse.payload.ops[0]!.type).toBe("SetProperty");
        expect(inverse.payload.ops[1]!.type).toBe("DeleteEntity");
      }
    });
  });

  describe("applyOps", () => {
    it("applies a sequence of ops and returns array of inverses", () => {
      const ops: PatchOp[] = [
        makeOp("CreateEntity", {
          entityId: "ent_seq1",
          name: "Seq1",
          parentId: "root_001",
        }),
        makeOp("CreateEntity", {
          entityId: "ent_seq2",
          name: "Seq2",
          parentId: "root_001",
        }),
      ];

      const inverses = applyOps(doc, ops);

      expect(doc.entities["ent_seq1"]).toBeDefined();
      expect(doc.entities["ent_seq2"]).toBeDefined();
      expect(inverses).toHaveLength(2);
      expect(inverses[0]!.type).toBe("DeleteEntity");
      expect(inverses[1]!.type).toBe("DeleteEntity");
    });
  });
});
