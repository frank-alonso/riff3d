import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  CanonicalSceneSchema,
  CanonicalNodeSchema,
  CanonicalComponentSchema,
  CanonicalAssetSchema,
  CanonicalWireSchema,
  CanonicalEnvironmentSchema,
  type CanonicalScene,
  type CanonicalNode,
  type CanonicalComponent,
  type CanonicalAsset,
  type CanonicalWire,
  type CanonicalEnvironment,
} from "../src/types/index";
import {
  PORTABLE_COMPONENT_TYPES,
  PORTABLE_LIGHT_TYPES,
  PORTABLE_CAMERA_TYPES,
  PORTABLE_MATERIAL_PROPERTIES,
  isPortableComponent,
  isPortableProperty,
} from "../src/portable-subset";

// ---------------------------------------------------------------------------
// CanonicalNode
// ---------------------------------------------------------------------------
describe("CanonicalNodeSchema", () => {
  it("validates a fully explicit node", () => {
    const node = CanonicalNodeSchema.parse({
      id: "node-1",
      name: "Box",
      parentId: null,
      childIds: [],
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      components: [],
      visible: true,
    });

    expect(node.id).toBe("node-1");
    expect(node.name).toBe("Box");
    expect(node.parentId).toBeNull();
    expect(node.childIds).toEqual([]);
    expect(node.transform.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(node.transform.rotation).toEqual({ x: 0, y: 0, z: 0, w: 1 });
    expect(node.transform.scale).toEqual({ x: 1, y: 1, z: 1 });
    expect(node.components).toEqual([]);
    expect(node.visible).toBe(true);
  });

  it("requires explicit transform -- no implicit defaults", () => {
    // IR must be explicit: passing no transform should fail
    const result = CanonicalNodeSchema.safeParse({
      id: "node-1",
      name: "Box",
      parentId: null,
      childIds: [],
      components: [],
      visible: true,
    });
    expect(result.success).toBe(false);
  });

  it("requires all transform sub-fields", () => {
    const result = CanonicalNodeSchema.safeParse({
      id: "node-1",
      name: "Box",
      parentId: null,
      childIds: [],
      transform: {
        position: { x: 0, y: 0, z: 0 },
        // Missing rotation and scale
      },
      components: [],
      visible: true,
    });
    expect(result.success).toBe(false);
  });

  it("preserves optional tuning section", () => {
    const node = CanonicalNodeSchema.parse({
      id: "node-1",
      name: "Box",
      parentId: null,
      childIds: [],
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      components: [],
      visible: true,
      tuning: {
        playcanvas: { castShadows: true },
      },
    });

    expect(node.tuning).toEqual({ playcanvas: { castShadows: true } });
  });

  it("rejects missing required fields", () => {
    const result = CanonicalNodeSchema.safeParse({
      id: "node-1",
      // missing name, parentId, childIds, transform, components, visible
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CanonicalComponent
// ---------------------------------------------------------------------------
describe("CanonicalComponentSchema", () => {
  it("validates pure data component with no editor sugar", () => {
    const component = CanonicalComponentSchema.parse({
      type: "MeshRenderer",
      properties: { meshAssetId: "ast_abc123" },
    });

    expect(component.type).toBe("MeshRenderer");
    expect(component.properties).toEqual({ meshAssetId: "ast_abc123" });
  });

  it("has no editor hints, no metadata fields", () => {
    // Only 'type' and 'properties' are the valid fields (plus unknown passthrough)
    const component = CanonicalComponentSchema.parse({
      type: "Light",
      properties: { intensity: 2.0, color: "#ffffff" },
    });

    // There should be no fields beyond type and properties
    expect(Object.keys(component)).toEqual(["type", "properties"]);
  });

  it("requires type and properties", () => {
    const result = CanonicalComponentSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CanonicalAsset
// ---------------------------------------------------------------------------
describe("CanonicalAssetSchema", () => {
  it("validates asset with all fields", () => {
    const asset = CanonicalAssetSchema.parse({
      id: "ast_001",
      type: "mesh",
      name: "Cube Mesh",
      uri: "https://example.com/cube.glb",
      data: null,
    });

    expect(asset.id).toBe("ast_001");
    expect(asset.type).toBe("mesh");
    expect(asset.name).toBe("Cube Mesh");
    expect(asset.uri).toBe("https://example.com/cube.glb");
    expect(asset.data).toBeNull();
  });

  it("requires all fields including uri and data (nullable, not optional)", () => {
    const result = CanonicalAssetSchema.safeParse({
      id: "ast_001",
      type: "mesh",
      name: "Cube",
      // Missing uri and data -- IR requires them even if null
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CanonicalWire
// ---------------------------------------------------------------------------
describe("CanonicalWireSchema", () => {
  it("validates wire with all required fields", () => {
    const wire = CanonicalWireSchema.parse({
      id: "wir_001",
      sourceNodeId: "node-1",
      sourceEvent: "onCollision",
      targetNodeId: "node-2",
      targetAction: "destroy",
      parameters: {},
    });

    expect(wire.id).toBe("wir_001");
    expect(wire.sourceNodeId).toBe("node-1");
    expect(wire.parameters).toEqual({});
  });

  it("requires all fields including parameters (not optional in IR)", () => {
    const result = CanonicalWireSchema.safeParse({
      id: "wir_001",
      sourceNodeId: "node-1",
      sourceEvent: "onCollision",
      targetNodeId: "node-2",
      targetAction: "destroy",
      // Missing parameters -- IR requires it even if empty
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CanonicalEnvironment
// ---------------------------------------------------------------------------
describe("CanonicalEnvironmentSchema", () => {
  it("validates fully explicit environment (no defaults)", () => {
    const env = CanonicalEnvironmentSchema.parse({
      skybox: { type: "color", color: "#87CEEB", uri: null },
      fog: {
        enabled: false,
        type: "linear",
        color: "#cccccc",
        near: 10,
        far: 100,
        density: 0.01,
      },
      ambientLight: { color: "#ffffff", intensity: 0.5 },
      gravity: { x: 0, y: -9.81, z: 0 },
    });

    expect(env.skybox.type).toBe("color");
    expect(env.fog.enabled).toBe(false);
    expect(env.ambientLight.intensity).toBe(0.5);
    expect(env.gravity.y).toBe(-9.81);
  });

  it("requires all sub-fields to be explicit", () => {
    // No defaults in IR: empty object should fail
    const result = CanonicalEnvironmentSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CanonicalScene
// ---------------------------------------------------------------------------
describe("CanonicalSceneSchema", () => {
  it("validates a complete scene", () => {
    const scene = CanonicalSceneSchema.parse({
      id: "scene-1",
      name: "Test Scene",
      sourceSchemaVersion: 1,
      nodes: [
        {
          id: "root",
          name: "Root",
          parentId: null,
          childIds: [],
          transform: {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 1, y: 1, z: 1 },
          },
          components: [],
          visible: true,
        },
      ],
      nodeIndex: { root: 0 },
      rootNodeId: "root",
      assets: [],
      wires: [],
      environment: {
        skybox: { type: "color", color: "#87CEEB", uri: null },
        fog: {
          enabled: false,
          type: "linear",
          color: "#cccccc",
          near: 10,
          far: 100,
          density: 0.01,
        },
        ambientLight: { color: "#ffffff", intensity: 0.5 },
        gravity: { x: 0, y: -9.81, z: 0 },
      },
      gameSettings: null,
    });

    expect(scene.id).toBe("scene-1");
    expect(scene.nodes).toHaveLength(1);
    expect(scene.nodeIndex["root"]).toBe(0);
    expect(scene.rootNodeId).toBe("root");
  });

  it("nodeIndex provides O(1) lookup for all nodes", () => {
    const scene = CanonicalSceneSchema.parse({
      id: "scene-1",
      name: "Test Scene",
      sourceSchemaVersion: 1,
      nodes: [
        {
          id: "root",
          name: "Root",
          parentId: null,
          childIds: ["child-1"],
          transform: {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 1, y: 1, z: 1 },
          },
          components: [],
          visible: true,
        },
        {
          id: "child-1",
          name: "Child",
          parentId: "root",
          childIds: [],
          transform: {
            position: { x: 1, y: 2, z: 3 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 1, y: 1, z: 1 },
          },
          components: [],
          visible: true,
        },
      ],
      nodeIndex: { root: 0, "child-1": 1 },
      rootNodeId: "root",
      assets: [],
      wires: [],
      environment: {
        skybox: { type: "color", color: "#87CEEB", uri: null },
        fog: {
          enabled: false,
          type: "linear",
          color: "#cccccc",
          near: 10,
          far: 100,
          density: 0.01,
        },
        ambientLight: { color: "#ffffff", intensity: 0.5 },
        gravity: { x: 0, y: -9.81, z: 0 },
      },
      gameSettings: null,
    });

    // Verify O(1) lookup
    const rootIdx = scene.nodeIndex["root"];
    expect(scene.nodes[rootIdx].id).toBe("root");
    const childIdx = scene.nodeIndex["child-1"];
    expect(scene.nodes[childIdx].id).toBe("child-1");
  });

  it("rejects incomplete scene", () => {
    const result = CanonicalSceneSchema.safeParse({
      id: "scene-1",
      name: "Test",
      // Missing everything else
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Portable Subset
// ---------------------------------------------------------------------------
describe("Portable Subset", () => {
  it("includes expected portable component types", () => {
    const expected = [
      "MeshRenderer",
      "Light",
      "Camera",
      "RigidBody",
      "Collider",
      "AudioSource",
      "AudioListener",
      "Animation",
      "Material",
    ];

    for (const type of expected) {
      expect(PORTABLE_COMPONENT_TYPES.has(type)).toBe(true);
    }
  });

  it("does not include non-portable component types", () => {
    expect(PORTABLE_COMPONENT_TYPES.has("CustomScript")).toBe(false);
    expect(PORTABLE_COMPONENT_TYPES.has("EditorHelper")).toBe(false);
    expect(PORTABLE_COMPONENT_TYPES.has("PlayCanvasSpecific")).toBe(false);
  });

  it("PORTABLE_LIGHT_TYPES includes directional, point, spot", () => {
    expect(PORTABLE_LIGHT_TYPES.has("directional")).toBe(true);
    expect(PORTABLE_LIGHT_TYPES.has("point")).toBe(true);
    expect(PORTABLE_LIGHT_TYPES.has("spot")).toBe(true);
    // hemisphere is NOT portable (engine-specific)
    expect(PORTABLE_LIGHT_TYPES.has("hemisphere")).toBe(false);
  });

  it("PORTABLE_CAMERA_TYPES includes perspective and orthographic", () => {
    expect(PORTABLE_CAMERA_TYPES.has("perspective")).toBe(true);
    expect(PORTABLE_CAMERA_TYPES.has("orthographic")).toBe(true);
  });

  it("PORTABLE_MATERIAL_PROPERTIES covers PBR baseline", () => {
    const expectedProps = [
      "baseColor",
      "metallic",
      "roughness",
      "emissive",
      "emissiveIntensity",
      "opacity",
      "alphaMode",
      "alphaCutoff",
      "doubleSided",
      "baseColorMap",
      "normalMap",
      "metallicRoughnessMap",
      "emissiveMap",
      "occlusionMap",
    ];

    for (const prop of expectedProps) {
      expect(PORTABLE_MATERIAL_PROPERTIES.has(prop)).toBe(true);
    }
  });

  it("isPortableComponent correctly identifies portable types", () => {
    expect(isPortableComponent("MeshRenderer")).toBe(true);
    expect(isPortableComponent("Light")).toBe(true);
    expect(isPortableComponent("CustomScript")).toBe(false);
  });

  it("isPortableProperty checks component-specific portability", () => {
    // Material properties
    expect(isPortableProperty("Material", "baseColor")).toBe(true);
    expect(isPortableProperty("Material", "metallic")).toBe(true);
    expect(isPortableProperty("Material", "someEngineSpecific")).toBe(false);

    // Light properties
    expect(isPortableProperty("Light", "lightType")).toBe(true);
    expect(isPortableProperty("Light", "intensity")).toBe(true);
    expect(isPortableProperty("Light", "color")).toBe(true);

    // Camera properties
    expect(isPortableProperty("Camera", "cameraType")).toBe(true);
    expect(isPortableProperty("Camera", "fov")).toBe(true);

    // Non-portable component
    expect(isPortableProperty("CustomScript", "anything")).toBe(false);
  });
});
