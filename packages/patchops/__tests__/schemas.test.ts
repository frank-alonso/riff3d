import { describe, it, expect } from "vitest";
import {
  PatchOpSchema,
  type PatchOp,
  OriginSchema,
  CURRENT_PATCHOP_VERSION,
  CreateEntityOpSchema,
  DeleteEntityOpSchema,
  SetPropertyOpSchema,
  AddChildOpSchema,
  RemoveChildOpSchema,
  ReparentOpSchema,
  AddComponentOpSchema,
  RemoveComponentOpSchema,
  SetComponentPropertyOpSchema,
  AddAssetOpSchema,
  RemoveAssetOpSchema,
  ReplaceAssetRefOpSchema,
  AddKeyframeOpSchema,
  RemoveKeyframeOpSchema,
  SetKeyframeValueOpSchema,
  BatchOpSchema,
} from "../src/index";

/** Helper to create a valid base op fields object. */
function base(type: string) {
  return {
    id: "op_test123",
    timestamp: Date.now(),
    origin: "user" as const,
    version: CURRENT_PATCHOP_VERSION,
  };
}

describe("PatchOp schemas", () => {
  describe("origin", () => {
    it("accepts user, ai, system, replay", () => {
      expect(OriginSchema.parse("user")).toBe("user");
      expect(OriginSchema.parse("ai")).toBe("ai");
      expect(OriginSchema.parse("system")).toBe("system");
      expect(OriginSchema.parse("replay")).toBe("replay");
    });

    it("rejects invalid origins", () => {
      expect(() => OriginSchema.parse("admin")).toThrow();
      expect(() => OriginSchema.parse("")).toThrow();
    });
  });

  describe("version", () => {
    it("CURRENT_PATCHOP_VERSION is 1", () => {
      expect(CURRENT_PATCHOP_VERSION).toBe(1);
    });

    it("defaults version to CURRENT_PATCHOP_VERSION when omitted", () => {
      const op = CreateEntityOpSchema.parse({
        id: "op_test",
        timestamp: 1000,
        origin: "user",
        type: "CreateEntity",
        payload: {
          entityId: "ent1",
          name: "Test",
          parentId: null,
        },
      });
      expect(op.version).toBe(CURRENT_PATCHOP_VERSION);
    });
  });

  describe("base fields", () => {
    it("every op has id, timestamp, origin, version", () => {
      const op = PatchOpSchema.parse({
        ...base("CreateEntity"),
        type: "CreateEntity",
        payload: {
          entityId: "ent1",
          name: "Test",
          parentId: null,
        },
      });
      expect(op).toHaveProperty("id");
      expect(op).toHaveProperty("timestamp");
      expect(op).toHaveProperty("origin");
      expect(op).toHaveProperty("version");
    });
  });

  describe("discriminated union", () => {
    it("rejects op with unknown type", () => {
      expect(() =>
        PatchOpSchema.parse({
          ...base("Unknown"),
          type: "UnknownOp",
          payload: {},
        }),
      ).toThrow();
    });
  });

  describe("CreateEntity", () => {
    it("validates with correct payload", () => {
      const op = PatchOpSchema.parse({
        ...base("CreateEntity"),
        type: "CreateEntity",
        payload: {
          entityId: "ent1",
          name: "Cube",
          parentId: "root1",
          tags: ["geometry"],
        },
      });
      expect(op.type).toBe("CreateEntity");
    });

    it("allows null parentId", () => {
      const op = PatchOpSchema.parse({
        ...base("CreateEntity"),
        type: "CreateEntity",
        payload: {
          entityId: "ent1",
          name: "Root",
          parentId: null,
        },
      });
      expect(op.type).toBe("CreateEntity");
    });
  });

  describe("DeleteEntity", () => {
    it("validates with previousState", () => {
      const op = PatchOpSchema.parse({
        ...base("DeleteEntity"),
        type: "DeleteEntity",
        payload: {
          entityId: "ent1",
          previousState: {
            id: "ent1",
            name: "Cube",
            parentId: "root1",
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
      });
      expect(op.type).toBe("DeleteEntity");
    });
  });

  describe("SetProperty", () => {
    it("validates with path and values", () => {
      const op = PatchOpSchema.parse({
        ...base("SetProperty"),
        type: "SetProperty",
        payload: {
          entityId: "ent1",
          path: "transform.position.x",
          value: 10,
          previousValue: 0,
        },
      });
      expect(op.type).toBe("SetProperty");
    });
  });

  describe("AddChild", () => {
    it("validates with parentId and childId", () => {
      const op = PatchOpSchema.parse({
        ...base("AddChild"),
        type: "AddChild",
        payload: {
          parentId: "parent1",
          childId: "child1",
          index: 0,
        },
      });
      expect(op.type).toBe("AddChild");
    });

    it("index is optional", () => {
      const op = PatchOpSchema.parse({
        ...base("AddChild"),
        type: "AddChild",
        payload: {
          parentId: "parent1",
          childId: "child1",
        },
      });
      expect(op.type).toBe("AddChild");
    });
  });

  describe("RemoveChild", () => {
    it("validates with previousIndex", () => {
      const op = PatchOpSchema.parse({
        ...base("RemoveChild"),
        type: "RemoveChild",
        payload: {
          parentId: "parent1",
          childId: "child1",
          previousIndex: 2,
        },
      });
      expect(op.type).toBe("RemoveChild");
    });
  });

  describe("Reparent", () => {
    it("validates full reparent payload", () => {
      const op = PatchOpSchema.parse({
        ...base("Reparent"),
        type: "Reparent",
        payload: {
          entityId: "ent1",
          newParentId: "parent2",
          oldParentId: "parent1",
          oldIndex: 0,
          newIndex: 1,
        },
      });
      expect(op.type).toBe("Reparent");
    });

    it("allows null parent IDs", () => {
      const op = PatchOpSchema.parse({
        ...base("Reparent"),
        type: "Reparent",
        payload: {
          entityId: "ent1",
          newParentId: null,
          oldParentId: null,
          oldIndex: 0,
        },
      });
      expect(op.type).toBe("Reparent");
    });
  });

  describe("AddComponent", () => {
    it("validates with component instance", () => {
      const op = PatchOpSchema.parse({
        ...base("AddComponent"),
        type: "AddComponent",
        payload: {
          entityId: "ent1",
          component: {
            type: "Light",
            properties: { intensity: 1.0, color: "#ffffff" },
          },
        },
      });
      expect(op.type).toBe("AddComponent");
    });
  });

  describe("RemoveComponent", () => {
    it("validates with componentType and previousComponent", () => {
      const op = PatchOpSchema.parse({
        ...base("RemoveComponent"),
        type: "RemoveComponent",
        payload: {
          entityId: "ent1",
          componentType: "Light",
          previousComponent: {
            type: "Light",
            properties: { intensity: 1.0 },
          },
        },
      });
      expect(op.type).toBe("RemoveComponent");
    });
  });

  describe("SetComponentProperty", () => {
    it("validates with componentType, propertyPath, values", () => {
      const op = PatchOpSchema.parse({
        ...base("SetComponentProperty"),
        type: "SetComponentProperty",
        payload: {
          entityId: "ent1",
          componentType: "Light",
          propertyPath: "intensity",
          value: 2.0,
          previousValue: 1.0,
        },
      });
      expect(op.type).toBe("SetComponentProperty");
    });
  });

  describe("AddAsset", () => {
    it("validates with asset entry", () => {
      const op = PatchOpSchema.parse({
        ...base("AddAsset"),
        type: "AddAsset",
        payload: {
          asset: {
            id: "ast_001",
            type: "texture",
            name: "diffuse.png",
            uri: "https://example.com/diffuse.png",
          },
        },
      });
      expect(op.type).toBe("AddAsset");
    });
  });

  describe("RemoveAsset", () => {
    it("validates with assetId and previousAsset", () => {
      const op = PatchOpSchema.parse({
        ...base("RemoveAsset"),
        type: "RemoveAsset",
        payload: {
          assetId: "ast_001",
          previousAsset: {
            id: "ast_001",
            type: "texture",
            name: "diffuse.png",
          },
        },
      });
      expect(op.type).toBe("RemoveAsset");
    });
  });

  describe("ReplaceAssetRef", () => {
    it("validates with entity, component, and asset IDs", () => {
      const op = PatchOpSchema.parse({
        ...base("ReplaceAssetRef"),
        type: "ReplaceAssetRef",
        payload: {
          entityId: "ent1",
          componentType: "MeshRenderer",
          propertyPath: "materialAssetId",
          newAssetId: "ast_002",
          oldAssetId: "ast_001",
        },
      });
      expect(op.type).toBe("ReplaceAssetRef");
    });
  });

  describe("AddKeyframe", () => {
    it("validates with track and time", () => {
      const op = PatchOpSchema.parse({
        ...base("AddKeyframe"),
        type: "AddKeyframe",
        payload: {
          entityId: "ent1",
          trackId: "track_pos_x",
          time: 0.5,
          value: 10,
        },
      });
      expect(op.type).toBe("AddKeyframe");
    });
  });

  describe("RemoveKeyframe", () => {
    it("validates with previousValue", () => {
      const op = PatchOpSchema.parse({
        ...base("RemoveKeyframe"),
        type: "RemoveKeyframe",
        payload: {
          entityId: "ent1",
          trackId: "track_pos_x",
          time: 0.5,
          previousValue: 10,
        },
      });
      expect(op.type).toBe("RemoveKeyframe");
    });
  });

  describe("SetKeyframeValue", () => {
    it("validates with value and previousValue", () => {
      const op = PatchOpSchema.parse({
        ...base("SetKeyframeValue"),
        type: "SetKeyframeValue",
        payload: {
          entityId: "ent1",
          trackId: "track_pos_x",
          time: 0.5,
          value: 20,
          previousValue: 10,
        },
      });
      expect(op.type).toBe("SetKeyframeValue");
    });
  });

  describe("BatchOp", () => {
    it("validates with array of sub-ops", () => {
      const op = PatchOpSchema.parse({
        ...base("BatchOp"),
        type: "BatchOp",
        payload: {
          ops: [
            {
              ...base("CreateEntity"),
              type: "CreateEntity",
              payload: {
                entityId: "ent1",
                name: "Cube",
                parentId: null,
              },
            },
            {
              ...base("SetProperty"),
              type: "SetProperty",
              payload: {
                entityId: "ent1",
                path: "name",
                value: "Renamed",
                previousValue: "Cube",
              },
            },
          ],
        },
      });
      expect(op.type).toBe("BatchOp");
    });

    it("allows empty ops array", () => {
      const op = PatchOpSchema.parse({
        ...base("BatchOp"),
        type: "BatchOp",
        payload: { ops: [] },
      });
      expect(op.type).toBe("BatchOp");
    });
  });

  describe("all 16 types pass through discriminated union", () => {
    const opTypes = [
      "CreateEntity",
      "DeleteEntity",
      "SetProperty",
      "AddChild",
      "RemoveChild",
      "Reparent",
      "AddComponent",
      "RemoveComponent",
      "SetComponentProperty",
      "AddAsset",
      "RemoveAsset",
      "ReplaceAssetRef",
      "AddKeyframe",
      "RemoveKeyframe",
      "SetKeyframeValue",
      "BatchOp",
    ] as const;

    it("has exactly 16 types", () => {
      expect(opTypes.length).toBe(16);
    });
  });
});
