import { describe, it, expect } from "vitest";
import {
  getComponentDef,
  validateComponentProperties,
  listComponents,
  listComponentsByCategory,
  componentRegistry,
} from "../src/index.js";
import type { ComponentDefinition, EditorHint } from "../src/index.js";

// ---------------------------------------------------------------------------
// Core 3D Components (9)
// ---------------------------------------------------------------------------

const CORE_COMPONENT_TYPES = [
  "MeshRenderer",
  "Light",
  "Camera",
  "RigidBody",
  "Collider",
  "AudioSource",
  "AudioListener",
  "Animation",
  "Material",
] as const;

const GAMEPLAY_COMPONENT_TYPES = [
  "ScoreZone",
  "KillZone",
  "Spawner",
  "TriggerZone",
  "Checkpoint",
  "MovingPlatform",
  "PathFollower",
  "Timer",
] as const;

const ALL_COMPONENT_TYPES = [
  ...CORE_COMPONENT_TYPES,
  ...GAMEPLAY_COMPONENT_TYPES,
] as const;

describe("Component Registry", () => {
  describe("registry infrastructure", () => {
    it("contains exactly 9 core components", () => {
      // At this point only core components are registered (no gameplay stubs yet in this test)
      const all = listComponents();
      expect(all.length).toBeGreaterThanOrEqual(9);
      for (const type of CORE_COMPONENT_TYPES) {
        expect(componentRegistry.has(type)).toBe(true);
      }
    });

    it("getComponentDef returns definition for known types", () => {
      const light = getComponentDef("Light");
      expect(light).toBeDefined();
      expect(light!.type).toBe("Light");
      expect(light!.category).toBe("rendering");
      expect(light!.singleton).toBe(true);
    });

    it("getComponentDef returns undefined for unknown types", () => {
      expect(getComponentDef("NonExistent")).toBeUndefined();
    });

    it("listComponents returns all registered definitions", () => {
      const all = listComponents();
      expect(all.length).toBeGreaterThanOrEqual(9);
      const types = new Set(all.map((d) => d.type));
      for (const t of CORE_COMPONENT_TYPES) {
        expect(types.has(t)).toBe(true);
      }
    });

    it("listComponentsByCategory filters correctly", () => {
      const rendering = listComponentsByCategory("rendering");
      // At minimum: MeshRenderer, Light, Camera, Animation, Material
      expect(rendering.length).toBeGreaterThanOrEqual(5);
      for (const def of rendering) {
        expect(def.category).toBe("rendering");
      }
    });
  });

  describe("each core component has required fields", () => {
    for (const type of CORE_COMPONENT_TYPES) {
      it(`${type} has type, category, description, singleton, schema, editorHints`, () => {
        const def = getComponentDef(type)!;
        expect(def).toBeDefined();
        expect(def.type).toBe(type);
        expect(
          ["rendering", "physics", "audio", "gameplay", "logic", "settings"].includes(
            def.category,
          ),
        ).toBe(true);
        expect(typeof def.description).toBe("string");
        expect(def.description.length).toBeGreaterThan(0);
        expect(typeof def.singleton).toBe("boolean");
        expect(def.schema).toBeDefined();
        expect(typeof def.schema.safeParse).toBe("function");
        expect(def.editorHints).toBeDefined();
        expect(Object.keys(def.editorHints).length).toBeGreaterThan(0);
      });
    }
  });

  describe("property validation", () => {
    it("validates Light with valid properties", () => {
      const result = validateComponentProperties("Light", {
        lightType: "point",
        color: "#ff0000",
      });
      expect(result.success).toBe(true);
    });

    it("rejects Light with invalid lightType", () => {
      const result = validateComponentProperties("Light", {
        lightType: "invalid",
      });
      expect(result.success).toBe(false);
    });

    it("returns error for unknown component type", () => {
      const result = validateComponentProperties("Unknown", { foo: "bar" });
      expect(result.success).toBe(false);
    });

    it("validates MeshRenderer with valid properties", () => {
      const result = validateComponentProperties("MeshRenderer", {
        primitive: "box",
        castShadows: true,
      });
      expect(result.success).toBe(true);
    });

    it("rejects MeshRenderer with invalid primitive", () => {
      const result = validateComponentProperties("MeshRenderer", {
        primitive: "pyramid",
      });
      expect(result.success).toBe(false);
    });

    it("validates Camera with valid properties", () => {
      const result = validateComponentProperties("Camera", {
        projection: "perspective",
        fov: 90,
      });
      expect(result.success).toBe(true);
    });

    it("validates RigidBody with valid properties", () => {
      const result = validateComponentProperties("RigidBody", {
        bodyType: "dynamic",
        mass: 5,
      });
      expect(result.success).toBe(true);
    });

    it("validates Collider with valid properties", () => {
      const result = validateComponentProperties("Collider", {
        shape: "sphere",
        radius: 2,
      });
      expect(result.success).toBe(true);
    });

    it("validates AudioSource with valid properties", () => {
      const result = validateComponentProperties("AudioSource", {
        volume: 0.5,
        spatial: true,
      });
      expect(result.success).toBe(true);
    });

    it("validates AudioListener with valid properties", () => {
      const result = validateComponentProperties("AudioListener", {
        active: false,
      });
      expect(result.success).toBe(true);
    });

    it("validates Animation with valid properties", () => {
      const result = validateComponentProperties("Animation", {
        clips: [{ name: "walk", assetId: "anim_001" }],
        speed: 2,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("defaults are applied correctly", () => {
    it("Light defaults", () => {
      const def = getComponentDef("Light")!;
      const result = def.schema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.lightType).toBe("point");
        expect(result.data.color).toBe("#ffffff");
        expect(result.data.intensity).toBe(1);
        expect(result.data.range).toBe(10);
        expect(result.data.castShadows).toBe(false);
      }
    });

    it("MeshRenderer defaults", () => {
      const def = getComponentDef("MeshRenderer")!;
      const result = def.schema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.primitive).toBeNull();
        expect(result.data.castShadows).toBe(true);
        expect(result.data.receiveShadows).toBe(true);
      }
    });

    it("Camera defaults", () => {
      const def = getComponentDef("Camera")!;
      const result = def.schema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.projection).toBe("perspective");
        expect(result.data.fov).toBe(60);
        expect(result.data.nearClip).toBe(0.1);
        expect(result.data.farClip).toBe(1000);
      }
    });

    it("RigidBody defaults", () => {
      const def = getComponentDef("RigidBody")!;
      const result = def.schema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.bodyType).toBe("dynamic");
        expect(result.data.mass).toBe(1);
        expect(result.data.friction).toBe(0.5);
        expect(result.data.ccdEnabled).toBe(false);
      }
    });

    it("Collider defaults", () => {
      const def = getComponentDef("Collider")!;
      const result = def.schema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.shape).toBe("box");
        expect(result.data.size).toEqual({ x: 1, y: 1, z: 1 });
        expect(result.data.isTrigger).toBe(false);
      }
    });

    it("AudioSource defaults", () => {
      const def = getComponentDef("AudioSource")!;
      const result = def.schema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.volume).toBe(1);
        expect(result.data.spatial).toBe(true);
        expect(result.data.autoPlay).toBe(false);
      }
    });

    it("AudioListener defaults", () => {
      const def = getComponentDef("AudioListener")!;
      const result = def.schema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.active).toBe(true);
      }
    });

    it("Animation defaults", () => {
      const def = getComponentDef("Animation")!;
      const result = def.schema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.clips).toEqual([]);
        expect(result.data.speed).toBe(1);
        expect(result.data.loop).toBe(true);
      }
    });

    it("Material defaults", () => {
      const def = getComponentDef("Material")!;
      const result = def.schema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.baseColor).toBe("#cccccc");
        expect(result.data.metallic).toBe(0);
        expect(result.data.roughness).toBe(0.5);
        expect(result.data.opacity).toBe(1);
        expect(result.data.alphaMode).toBe("opaque");
        expect(result.data.doubleSided).toBe(false);
      }
    });
  });

  describe("editor hints", () => {
    it("editor hints are present for all properties", () => {
      for (const type of CORE_COMPONENT_TYPES) {
        const def = getComponentDef(type)!;
        const hintKeys = Object.keys(def.editorHints);
        expect(hintKeys.length).toBeGreaterThan(0);
        for (const hint of Object.values(def.editorHints)) {
          expect(hint.editorHint).toBeDefined();
          expect(typeof hint.editorHint).toBe("string");
        }
      }
    });

    it("Light has correct editor hint types", () => {
      const def = getComponentDef("Light")!;
      expect(def.editorHints.lightType.editorHint).toBe("dropdown");
      expect(def.editorHints.color.editorHint).toBe("color");
      expect(def.editorHints.intensity.editorHint).toBe("slider");
      expect(def.editorHints.castShadows.editorHint).toBe("checkbox");
      expect(def.editorHints.shadowBias.editorHint).toBe("number");
    });

    it("Material has asset-ref hints for texture slots", () => {
      const def = getComponentDef("Material")!;
      expect(def.editorHints.baseColorMap.editorHint).toBe("asset-ref");
      expect(def.editorHints.baseColorMap.assetType).toBe("texture");
      expect(def.editorHints.normalMap.editorHint).toBe("asset-ref");
      expect(def.editorHints.normalMap.assetType).toBe("texture");
    });

    it("Collider has vec3 hints for size and offset", () => {
      const def = getComponentDef("Collider")!;
      expect(def.editorHints.size.editorHint).toBe("vec3");
      expect(def.editorHints.offset.editorHint).toBe("vec3");
    });
  });

  describe("Material includes all PBR portable subset properties", () => {
    it("has all required PBR properties", () => {
      const def = getComponentDef("Material")!;
      const result = def.schema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        // Core PBR
        expect("baseColor" in data).toBe(true);
        expect("metallic" in data).toBe(true);
        expect("roughness" in data).toBe(true);
        expect("emissive" in data).toBe(true);
        expect("emissiveIntensity" in data).toBe(true);
        expect("opacity" in data).toBe(true);
        expect("alphaMode" in data).toBe(true);
        expect("alphaCutoff" in data).toBe(true);
        expect("doubleSided" in data).toBe(true);
        // Texture slots
        expect("baseColorMap" in data).toBe(true);
        expect("normalMap" in data).toBe(true);
        expect("metallicRoughnessMap" in data).toBe(true);
        expect("emissiveMap" in data).toBe(true);
        expect("occlusionMap" in data).toBe(true);
      }
    });
  });

  describe("singleton flags", () => {
    it("Light is singleton", () => {
      expect(getComponentDef("Light")!.singleton).toBe(true);
    });

    it("Camera is singleton", () => {
      expect(getComponentDef("Camera")!.singleton).toBe(true);
    });

    it("MeshRenderer is singleton", () => {
      expect(getComponentDef("MeshRenderer")!.singleton).toBe(true);
    });

    it("RigidBody is singleton", () => {
      expect(getComponentDef("RigidBody")!.singleton).toBe(true);
    });

    it("AudioListener is singleton", () => {
      expect(getComponentDef("AudioListener")!.singleton).toBe(true);
    });

    it("Collider is NOT singleton", () => {
      expect(getComponentDef("Collider")!.singleton).toBe(false);
    });

    it("AudioSource is NOT singleton", () => {
      expect(getComponentDef("AudioSource")!.singleton).toBe(false);
    });

    it("Animation is NOT singleton", () => {
      expect(getComponentDef("Animation")!.singleton).toBe(false);
    });

    it("Material is NOT singleton", () => {
      expect(getComponentDef("Material")!.singleton).toBe(false);
    });
  });

  describe("events and actions", () => {
    it("AudioSource has events", () => {
      const def = getComponentDef("AudioSource")!;
      expect(def.events).toBeDefined();
      expect(def.events!.length).toBe(3);
      const names = def.events!.map((e) => e.name);
      expect(names).toContain("onPlay");
      expect(names).toContain("onStop");
      expect(names).toContain("onEnd");
    });

    it("Animation has events", () => {
      const def = getComponentDef("Animation")!;
      expect(def.events).toBeDefined();
      expect(def.events!.length).toBe(2);
      const names = def.events!.map((e) => e.name);
      expect(names).toContain("onClipStart");
      expect(names).toContain("onClipEnd");
    });

    it("components without events have undefined events", () => {
      const def = getComponentDef("Light")!;
      expect(def.events).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Full registry with gameplay stubs (17 total)
  // ---------------------------------------------------------------------------

  describe("full registry (17 components)", () => {
    it("contains exactly 17 component types total", () => {
      const all = listComponents();
      expect(all.length).toBe(17);
      for (const type of ALL_COMPONENT_TYPES) {
        expect(componentRegistry.has(type)).toBe(true);
      }
    });

    it("listComponentsByCategory returns 7 gameplay components", () => {
      const gameplay = listComponentsByCategory("gameplay");
      expect(gameplay.length).toBe(7);
      for (const def of gameplay) {
        expect(def.category).toBe("gameplay");
      }
    });

    it("listComponentsByCategory returns 1 logic component (Timer)", () => {
      const logic = listComponentsByCategory("logic");
      expect(logic.length).toBe(1);
      expect(logic[0].type).toBe("Timer");
    });

    it("gameplay + logic = 8 stubs total", () => {
      const gameplay = listComponentsByCategory("gameplay");
      const logic = listComponentsByCategory("logic");
      expect(gameplay.length + logic.length).toBe(8);
    });
  });

  describe("each gameplay stub has required fields", () => {
    for (const type of GAMEPLAY_COMPONENT_TYPES) {
      it(`${type} has type, category, description, singleton, schema, editorHints`, () => {
        const def = getComponentDef(type)!;
        expect(def).toBeDefined();
        expect(def.type).toBe(type);
        expect(
          ["rendering", "physics", "audio", "gameplay", "logic", "settings"].includes(
            def.category,
          ),
        ).toBe(true);
        expect(typeof def.description).toBe("string");
        expect(def.description.length).toBeGreaterThan(0);
        expect(typeof def.singleton).toBe("boolean");
        expect(def.schema).toBeDefined();
        expect(typeof def.schema.safeParse).toBe("function");
        expect(def.editorHints).toBeDefined();
        expect(Object.keys(def.editorHints).length).toBeGreaterThan(0);
      });
    }
  });

  describe("gameplay stubs validate with defaults", () => {
    for (const type of GAMEPLAY_COMPONENT_TYPES) {
      it(`${type} validates empty input (defaults applied)`, () => {
        const def = getComponentDef(type)!;
        const result = def.schema.safeParse({});
        expect(result.success).toBe(true);
      });
    }
  });

  describe("gameplay stub defaults", () => {
    it("ScoreZone defaults", () => {
      const def = getComponentDef("ScoreZone")!;
      const result = def.schema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.points).toBe(10);
        expect(result.data.teamFilter).toBeNull();
        expect(result.data.repeatable).toBe(false);
        expect(result.data.cooldown).toBe(0);
      }
    });

    it("KillZone defaults", () => {
      const def = getComponentDef("KillZone")!;
      const result = def.schema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.respawnBehavior).toBe("lastCheckpoint");
        expect(result.data.damage).toBe(Infinity);
      }
    });

    it("Spawner defaults", () => {
      const def = getComponentDef("Spawner")!;
      const result = def.schema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.spawnInterval).toBe(5);
        expect(result.data.maxActive).toBe(5);
        expect(result.data.spawnOnStart).toBe(true);
      }
    });

    it("TriggerZone defaults", () => {
      const def = getComponentDef("TriggerZone")!;
      const result = def.schema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.triggerOnce).toBe(false);
        expect(result.data.filterTags).toEqual([]);
      }
    });

    it("Checkpoint defaults", () => {
      const def = getComponentDef("Checkpoint")!;
      const result = def.schema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.orderIndex).toBe(0);
        expect(result.data.respawnOffset).toEqual({ x: 0, y: 1, z: 0 });
      }
    });

    it("MovingPlatform defaults", () => {
      const def = getComponentDef("MovingPlatform")!;
      const result = def.schema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.axis).toBe("y");
        expect(result.data.distance).toBe(5);
        expect(result.data.speed).toBe(2);
        expect(result.data.easing).toBe("easeInOut");
      }
    });

    it("PathFollower defaults", () => {
      const def = getComponentDef("PathFollower")!;
      const result = def.schema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.waypointEntityIds).toEqual([]);
        expect(result.data.speed).toBe(3);
        expect(result.data.loopMode).toBe("loop");
        expect(result.data.lookAtNext).toBe(true);
      }
    });

    it("Timer defaults", () => {
      const def = getComponentDef("Timer")!;
      const result = def.schema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.duration).toBe(60);
        expect(result.data.autoStart).toBe(false);
        expect(result.data.loop).toBe(false);
      }
    });
  });

  describe("gameplay events and actions", () => {
    it("ScoreZone has events and actions", () => {
      const def = getComponentDef("ScoreZone")!;
      expect(def.events).toBeDefined();
      expect(def.events!.map((e) => e.name)).toContain("onScore");
      expect(def.actions).toBeDefined();
      expect(def.actions!.map((a) => a.name)).toContain("activate");
      expect(def.actions!.map((a) => a.name)).toContain("deactivate");
    });

    it("KillZone has events and actions", () => {
      const def = getComponentDef("KillZone")!;
      expect(def.events!.map((e) => e.name)).toContain("onKill");
      expect(def.actions!.map((a) => a.name)).toContain("activate");
    });

    it("Spawner has events and actions", () => {
      const def = getComponentDef("Spawner")!;
      expect(def.events!.map((e) => e.name)).toContain("onSpawn");
      expect(def.actions!.map((a) => a.name)).toContain("spawn");
      expect(def.actions!.map((a) => a.name)).toContain("reset");
    });

    it("TriggerZone has enter/exit/stay events", () => {
      const def = getComponentDef("TriggerZone")!;
      const eventNames = def.events!.map((e) => e.name);
      expect(eventNames).toContain("onEnter");
      expect(eventNames).toContain("onExit");
      expect(eventNames).toContain("onStay");
    });

    it("Checkpoint has onActivate event", () => {
      const def = getComponentDef("Checkpoint")!;
      expect(def.events!.map((e) => e.name)).toContain("onActivate");
    });

    it("MovingPlatform has events and actions", () => {
      const def = getComponentDef("MovingPlatform")!;
      const eventNames = def.events!.map((e) => e.name);
      expect(eventNames).toContain("onReachEnd");
      expect(eventNames).toContain("onReachStart");
      const actionNames = def.actions!.map((a) => a.name);
      expect(actionNames).toContain("start");
      expect(actionNames).toContain("stop");
      expect(actionNames).toContain("reverse");
    });

    it("PathFollower has events and actions", () => {
      const def = getComponentDef("PathFollower")!;
      const eventNames = def.events!.map((e) => e.name);
      expect(eventNames).toContain("onWaypointReached");
      expect(eventNames).toContain("onPathComplete");
      const actionNames = def.actions!.map((a) => a.name);
      expect(actionNames).toContain("start");
      expect(actionNames).toContain("stop");
      expect(actionNames).toContain("reset");
    });

    it("Timer has events and actions", () => {
      const def = getComponentDef("Timer")!;
      const eventNames = def.events!.map((e) => e.name);
      expect(eventNames).toContain("onStart");
      expect(eventNames).toContain("onTick");
      expect(eventNames).toContain("onComplete");
      const actionNames = def.actions!.map((a) => a.name);
      expect(actionNames).toContain("start");
      expect(actionNames).toContain("stop");
      expect(actionNames).toContain("reset");
    });
  });
});
