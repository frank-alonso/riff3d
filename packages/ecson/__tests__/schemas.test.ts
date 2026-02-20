import { describe, it, expect } from "vitest";
import {
  Vec3Schema,
  QuaternionSchema,
  TransformSchema,
  EngineTuningSchema,
  ComponentInstanceSchema,
  EntitySchema,
  AssetEntrySchema,
  EventWireSchema,
  EnvironmentSettingsSchema,
  GameSettingsSchema,
  SceneDocumentSchema,
  CURRENT_SCHEMA_VERSION,
  type SceneDocument,
  type Entity,
  type Transform,
  type Vec3,
  type Quaternion,
  type ComponentInstance,
  type AssetEntry,
  type EventWire,
  type EnvironmentSettings,
  type GameSettings,
  type EngineTuning,
} from "../src/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMinimalSceneDocument(
  overrides: Partial<{
    entities: Record<string, unknown>;
    rootEntityId: string;
  }> = {},
) {
  const rootId = "root-entity-id";
  return {
    id: "doc-1",
    name: "Test Scene",
    schemaVersion: 1,
    rootEntityId: overrides.rootEntityId ?? rootId,
    entities: overrides.entities ?? {
      [rootId]: {
        id: rootId,
        name: "Root",
        parentId: null,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Vec3
// ---------------------------------------------------------------------------

describe("Vec3Schema", () => {
  it("parses a complete Vec3", () => {
    const result = Vec3Schema.parse({ x: 1, y: 2, z: 3 });
    expect(result).toEqual({ x: 1, y: 2, z: 3 });
  });

  it("applies defaults for missing fields", () => {
    const result = Vec3Schema.parse({});
    expect(result).toEqual({ x: 0, y: 0, z: 0 });
  });
});

// ---------------------------------------------------------------------------
// Quaternion
// ---------------------------------------------------------------------------

describe("QuaternionSchema", () => {
  it("parses a complete Quaternion", () => {
    const result = QuaternionSchema.parse({ x: 0, y: 0, z: 0, w: 1 });
    expect(result).toEqual({ x: 0, y: 0, z: 0, w: 1 });
  });

  it("applies identity default", () => {
    const result = QuaternionSchema.parse({});
    expect(result).toEqual({ x: 0, y: 0, z: 0, w: 1 });
  });
});

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------

describe("TransformSchema", () => {
  it("applies full defaults", () => {
    const result = TransformSchema.parse({});
    expect(result.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(result.rotation).toEqual({ x: 0, y: 0, z: 0, w: 1 });
    expect(result.scale).toEqual({ x: 1, y: 1, z: 1 });
  });

  it("preserves custom values", () => {
    const result = TransformSchema.parse({
      position: { x: 5, y: 10, z: 15 },
      rotation: { x: 0.5, y: 0.5, z: 0, w: 0.707 },
      scale: { x: 2, y: 2, z: 2 },
    });
    expect(result.position.x).toBe(5);
    expect(result.scale.x).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// EngineTuning
// ---------------------------------------------------------------------------

describe("EngineTuningSchema", () => {
  it("accepts arbitrary per-engine properties", () => {
    const tuning = EngineTuningSchema.parse({
      playcanvas: {
        shadowType: "pcf5",
        layers: [0, 1, 2],
      },
      babylon: {
        customShader: "myShader",
        lod: { levels: [100, 200, 500] },
      },
    });
    expect(tuning["playcanvas"]).toBeDefined();
    expect(tuning["babylon"]).toBeDefined();
  });

  it("accepts an empty record", () => {
    const result = EngineTuningSchema.parse({});
    expect(result).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// ComponentInstance
// ---------------------------------------------------------------------------

describe("ComponentInstanceSchema", () => {
  it("parses a minimal component", () => {
    const result = ComponentInstanceSchema.parse({ type: "Light" });
    expect(result.type).toBe("Light");
    expect(result.properties).toEqual({});
    expect(result.tuning).toBeUndefined();
  });

  it("accepts properties and tuning", () => {
    const result = ComponentInstanceSchema.parse({
      type: "MeshRenderer",
      properties: { meshType: "primitive", primitive: "box" },
      tuning: { playcanvas: { layers: [0] } },
    });
    expect(result.properties["meshType"]).toBe("primitive");
    expect(result.tuning).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

describe("EntitySchema", () => {
  it("parses a minimal entity (no components)", () => {
    const result = EntitySchema.parse({
      id: "ent-1",
      name: "Test Entity",
      parentId: null,
    });
    expect(result.id).toBe("ent-1");
    expect(result.components).toEqual([]);
    expect(result.tags).toEqual([]);
    expect(result.visible).toBe(true);
    expect(result.locked).toBe(false);
    expect(result.children).toEqual([]);
    expect(result.transform.position).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("parses an entity with multiple components", () => {
    const result = EntitySchema.parse({
      id: "ent-2",
      name: "Complex Entity",
      parentId: "ent-1",
      children: ["ent-3", "ent-4"],
      components: [
        { type: "Light", properties: { lightType: "point" } },
        { type: "MeshRenderer", properties: { primitive: "box" } },
      ],
      tags: ["player", "collidable"],
      visible: false,
      locked: true,
    });
    expect(result.components).toHaveLength(2);
    expect(result.tags).toEqual(["player", "collidable"]);
    expect(result.visible).toBe(false);
    expect(result.locked).toBe(true);
    expect(result.children).toEqual(["ent-3", "ent-4"]);
  });

  it("accepts entity-level tuning", () => {
    const result = EntitySchema.parse({
      id: "ent-tuned",
      name: "Tuned",
      parentId: null,
      tuning: { playcanvas: { castShadows: true } },
    });
    expect(result.tuning).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AssetEntry
// ---------------------------------------------------------------------------

describe("AssetEntrySchema", () => {
  it("parses an asset with uri", () => {
    const result = AssetEntrySchema.parse({
      id: "ast-1",
      type: "texture",
      name: "Sky Texture",
      uri: "https://example.com/sky.png",
    });
    expect(result.uri).toBe("https://example.com/sky.png");
    expect(result.metadata).toEqual({});
  });

  it("parses an asset without uri", () => {
    const result = AssetEntrySchema.parse({
      id: "ast-2",
      type: "material",
      name: "Red Material",
      data: { color: "#ff0000", metalness: 0.5 },
    });
    expect(result.uri).toBeUndefined();
    expect(result.data).toBeDefined();
  });

  it("rejects invalid asset type", () => {
    expect(() =>
      AssetEntrySchema.parse({
        id: "ast-3",
        type: "invalid-type",
        name: "Bad Asset",
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// EventWire
// ---------------------------------------------------------------------------

describe("EventWireSchema", () => {
  it("validates source and target fields", () => {
    const result = EventWireSchema.parse({
      id: "wire-1",
      sourceEntityId: "ent-1",
      sourceEvent: "onEnter",
      targetEntityId: "ent-2",
      targetAction: "activate",
    });
    expect(result.sourceEntityId).toBe("ent-1");
    expect(result.targetEntityId).toBe("ent-2");
    expect(result.parameters).toBeUndefined();
  });

  it("accepts optional parameters", () => {
    const result = EventWireSchema.parse({
      id: "wire-2",
      sourceEntityId: "ent-1",
      sourceEvent: "onCollide",
      targetEntityId: "ent-2",
      targetAction: "playSound",
      parameters: { volume: 0.5, clip: "bang" },
    });
    expect(result.parameters).toEqual({ volume: 0.5, clip: "bang" });
  });

  it("rejects missing required fields", () => {
    expect(() =>
      EventWireSchema.parse({
        id: "wire-3",
        sourceEntityId: "ent-1",
        // missing sourceEvent, targetEntityId, targetAction
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// EnvironmentSettings
// ---------------------------------------------------------------------------

describe("EnvironmentSettingsSchema", () => {
  it("applies full defaults", () => {
    const result = EnvironmentSettingsSchema.parse({});
    expect(result.skybox.type).toBe("color");
    expect(result.fog.enabled).toBe(false);
    expect(result.fog.type).toBe("linear");
    expect(result.ambientLight.color).toBe("#ffffff");
    expect(result.ambientLight.intensity).toBe(0.5);
    expect(result.gravity).toEqual({ x: 0, y: -9.81, z: 0 });
  });

  it("preserves custom gravity", () => {
    const result = EnvironmentSettingsSchema.parse({
      gravity: { x: 0, y: -20, z: 0 },
    });
    expect(result.gravity.y).toBe(-20);
  });
});

// ---------------------------------------------------------------------------
// GameSettings
// ---------------------------------------------------------------------------

describe("GameSettingsSchema", () => {
  it("applies defaults", () => {
    const result = GameSettingsSchema.parse({});
    expect(result.maxPlayers).toBe(8);
    expect(result.roundDuration).toBe(120);
    expect(result.respawnEnabled).toBe(true);
    expect(result.respawnDelay).toBe(3);
  });

  it("rejects negative maxPlayers", () => {
    expect(() => GameSettingsSchema.parse({ maxPlayers: 0 })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// SceneDocument
// ---------------------------------------------------------------------------

describe("SceneDocumentSchema", () => {
  it("parses a valid SceneDocument", () => {
    const doc = SceneDocumentSchema.parse(makeMinimalSceneDocument());
    expect(doc.id).toBe("doc-1");
    expect(doc.name).toBe("Test Scene");
    expect(doc.schemaVersion).toBe(1);
    expect(doc.rootEntityId).toBe("root-entity-id");
    expect(Object.keys(doc.entities)).toHaveLength(1);
    expect(doc.assets).toEqual({});
    expect(doc.wiring).toEqual([]);
    expect(doc.metadata).toEqual({});
    expect(doc.gameSettings).toBeUndefined();
  });

  it("rejects a document missing required fields", () => {
    expect(() =>
      SceneDocumentSchema.parse({
        id: "doc-bad",
        // missing name, schemaVersion, rootEntityId
      }),
    ).toThrow();
  });

  it("rejects schemaVersion < 1", () => {
    expect(() =>
      SceneDocumentSchema.parse({
        ...makeMinimalSceneDocument(),
        schemaVersion: 0,
      }),
    ).toThrow();
  });

  it("accepts an empty entities record", () => {
    const doc = SceneDocumentSchema.parse({
      ...makeMinimalSceneDocument(),
      entities: {},
    });
    expect(Object.keys(doc.entities)).toHaveLength(0);
  });

  it("accepts optional gameSettings", () => {
    const doc = SceneDocumentSchema.parse({
      ...makeMinimalSceneDocument(),
      gameSettings: { maxPlayers: 4 },
    });
    expect(doc.gameSettings?.maxPlayers).toBe(4);
  });

  it("exports CURRENT_SCHEMA_VERSION as 1", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Type inference (compile-time checks)
// ---------------------------------------------------------------------------

describe("Type inference", () => {
  it("inferred types are assignable", () => {
    // These assignments verify that z.infer<> produces the correct types.
    // If any type is wrong, this file won't compile.
    const vec3: Vec3 = { x: 1, y: 2, z: 3 };
    const quat: Quaternion = { x: 0, y: 0, z: 0, w: 1 };
    const transform: Transform = {
      position: vec3,
      rotation: quat,
      scale: vec3,
    };
    const component: ComponentInstance = {
      type: "Light",
      properties: {},
    };
    const entity: Entity = {
      id: "e1",
      name: "Test",
      parentId: null,
      children: [],
      components: [component],
      tags: [],
      transform,
      visible: true,
      locked: false,
    };
    const asset: AssetEntry = {
      id: "a1",
      type: "texture",
      name: "Tex",
      metadata: {},
    };
    const wire: EventWire = {
      id: "w1",
      sourceEntityId: "e1",
      sourceEvent: "onEnter",
      targetEntityId: "e2",
      targetAction: "activate",
    };
    const env: EnvironmentSettings = EnvironmentSettingsSchema.parse({});
    const settings: GameSettings = GameSettingsSchema.parse({});
    const tuning: EngineTuning = { playcanvas: { x: 1 } };
    const doc: SceneDocument = {
      id: "d1",
      name: "Doc",
      schemaVersion: 1,
      entities: { [entity.id]: entity },
      rootEntityId: entity.id,
      assets: { [asset.id]: asset },
      wiring: [wire],
      environment: env,
      gameSettings: settings,
      metadata: {},
    };

    // All variables used to prevent unused warnings
    expect(doc.id).toBe("d1");
    expect(tuning).toBeDefined();
  });
});
