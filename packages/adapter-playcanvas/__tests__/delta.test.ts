import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MockApplication,
  MockEntity,
  MockColor,
  MockStandardMaterial,
  createPlayCanvasMockModule,
} from "./helpers/pc-mocks";

// Stub DOM globals
class FakeHTMLCanvasElement {
  width = 800;
  height = 600;
  style: Record<string, string> = {};
  parentElement = {
    clientWidth: 800,
    clientHeight: 600,
    style: {} as Record<string, string>,
    appendChild: vi.fn(),
  };
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  getBoundingClientRect = vi.fn(() => ({
    left: 0,
    top: 0,
    width: 800,
    height: 600,
  }));
}

globalThis.HTMLCanvasElement = FakeHTMLCanvasElement as unknown as typeof HTMLCanvasElement;
globalThis.window = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
} as unknown as Window & typeof globalThis;
globalThis.document = {
  createElement: vi.fn((tag: string) => {
    if (tag === "div") {
      return { style: {} as Record<string, string>, parentElement: null };
    }
    return {};
  }),
} as unknown as Document;

vi.mock("playcanvas", () => createPlayCanvasMockModule());

import { applyPlayCanvasDelta } from "../src/delta";
import type { IRDelta } from "@riff3d/canonical-ir";

// ─── Helpers ────────────────────────────────────────────────────────────────

function createEntityMap(): Map<string, MockEntity> {
  const entity = new MockEntity("TestEntity");
  // Give it render and light components for component property tests
  entity.render = {
    meshInstances: [{ material: new MockStandardMaterial() }],
    castShadows: true,
    receiveShadows: true,
  } as MockEntity["render"] & { castShadows: boolean; receiveShadows: boolean };
  entity.light = {
    color: new MockColor(1, 1, 1),
    intensity: 1,
    range: 10,
    castShadows: false,
    innerConeAngle: 30,
    outerConeAngle: 45,
  };
  entity.camera = {
    clearColor: new MockColor(0, 0, 0, 1),
    worldToScreen: vi.fn(),
    fov: 60,
    nearClip: 0.1,
    farClip: 1000,
  } as MockEntity["camera"] & { fov: number; nearClip: number; farClip: number };

  const map = new Map<string, MockEntity>();
  map.set("entity-1", entity);
  return map;
}

function createApp(): MockApplication {
  return new MockApplication();
}

function createEditorCamera(): MockEntity {
  const camera = new MockEntity("EditorCamera");
  camera.camera = {
    clearColor: new MockColor(0.05, 0.05, 0.12, 1),
    worldToScreen: vi.fn(),
  };
  return camera;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("applyPlayCanvasDelta", () => {
  let entityMap: Map<string, MockEntity>;
  let app: MockApplication;
  let editorCamera: MockEntity;

  beforeEach(() => {
    entityMap = createEntityMap();
    app = createApp();
    editorCamera = createEditorCamera();
    vi.clearAllMocks();
  });

  describe("node-transform delta", () => {
    it("sets position on entity", () => {
      const delta: IRDelta = {
        type: "node-transform",
        nodeId: "entity-1",
        transform: { position: { x: 5, y: 10, z: -3 } },
      };

      applyPlayCanvasDelta(
        entityMap as unknown as Map<string, never>,
        app as unknown as never,
        editorCamera as unknown as never,
        delta,
      );

      const entity = entityMap.get("entity-1")!;
      expect(entity.setLocalPosition).toHaveBeenCalledWith(5, 10, -3);
    });

    it("sets rotation on entity", () => {
      const delta: IRDelta = {
        type: "node-transform",
        nodeId: "entity-1",
        transform: { rotation: { x: 0.1, y: 0.2, z: 0.3, w: 0.9 } },
      };

      applyPlayCanvasDelta(
        entityMap as unknown as Map<string, never>,
        app as unknown as never,
        editorCamera as unknown as never,
        delta,
      );

      const entity = entityMap.get("entity-1")!;
      expect(entity.setLocalRotation).toHaveBeenCalledWith(0.1, 0.2, 0.3, 0.9);
    });

    it("sets scale on entity", () => {
      const delta: IRDelta = {
        type: "node-transform",
        nodeId: "entity-1",
        transform: { scale: { x: 2, y: 3, z: 4 } },
      };

      applyPlayCanvasDelta(
        entityMap as unknown as Map<string, never>,
        app as unknown as never,
        editorCamera as unknown as never,
        delta,
      );

      const entity = entityMap.get("entity-1")!;
      expect(entity.setLocalScale).toHaveBeenCalledWith(2, 3, 4);
    });
  });

  describe("node-visibility delta", () => {
    it("sets entity.enabled to true", () => {
      const delta: IRDelta = {
        type: "node-visibility",
        nodeId: "entity-1",
        visible: true,
      };

      applyPlayCanvasDelta(
        entityMap as unknown as Map<string, never>,
        app as unknown as never,
        editorCamera as unknown as never,
        delta,
      );

      const entity = entityMap.get("entity-1")!;
      expect(entity.enabled).toBe(true);
    });

    it("sets entity.enabled to false", () => {
      const delta: IRDelta = {
        type: "node-visibility",
        nodeId: "entity-1",
        visible: false,
      };

      applyPlayCanvasDelta(
        entityMap as unknown as Map<string, never>,
        app as unknown as never,
        editorCamera as unknown as never,
        delta,
      );

      const entity = entityMap.get("entity-1")!;
      expect(entity.enabled).toBe(false);
    });
  });

  describe("component-property delta", () => {
    it("changes material baseColor", () => {
      const delta: IRDelta = {
        type: "component-property",
        nodeId: "entity-1",
        componentIndex: 0,
        property: "Material:baseColor",
        value: "#ff0000",
      };

      applyPlayCanvasDelta(
        entityMap as unknown as Map<string, never>,
        app as unknown as never,
        editorCamera as unknown as never,
        delta,
      );

      const entity = entityMap.get("entity-1")!;
      const material = entity.render!.meshInstances[0]!.material;
      // hexToColor("#ff0000") should produce r=1, g=0, b=0
      expect(material.diffuse.r).toBeCloseTo(1, 2);
      expect(material.diffuse.g).toBeCloseTo(0, 2);
      expect(material.diffuse.b).toBeCloseTo(0, 2);
    });

    it("inverts roughness to gloss for PlayCanvas", () => {
      const delta: IRDelta = {
        type: "component-property",
        nodeId: "entity-1",
        componentIndex: 0,
        property: "Material:roughness",
        value: 0.3,
      };

      applyPlayCanvasDelta(
        entityMap as unknown as Map<string, never>,
        app as unknown as never,
        editorCamera as unknown as never,
        delta,
      );

      const entity = entityMap.get("entity-1")!;
      const material = entity.render!.meshInstances[0]!.material;
      // gloss = 1 - roughness = 0.7
      expect(material.gloss).toBeCloseTo(0.7, 5);
    });

    it("changes light intensity", () => {
      const delta: IRDelta = {
        type: "component-property",
        nodeId: "entity-1",
        componentIndex: 0,
        property: "Light:intensity",
        value: 2.5,
      };

      applyPlayCanvasDelta(
        entityMap as unknown as Map<string, never>,
        app as unknown as never,
        editorCamera as unknown as never,
        delta,
      );

      const entity = entityMap.get("entity-1")!;
      const light = entity.light as { intensity: number };
      expect(light.intensity).toBe(2.5);
    });
  });

  describe("environment delta", () => {
    it("changes fog density", () => {
      const delta: IRDelta = {
        type: "environment",
        path: "fog.density",
        value: 0.05,
      };

      applyPlayCanvasDelta(
        entityMap as unknown as Map<string, never>,
        app as unknown as never,
        editorCamera as unknown as never,
        delta,
      );

      expect(app.scene.fog.density).toBe(0.05);
    });

    it("changes ambient light color", () => {
      const delta: IRDelta = {
        type: "environment",
        path: "ambientLight.color",
        value: "#ff8800",
      };

      applyPlayCanvasDelta(
        entityMap as unknown as Map<string, never>,
        app as unknown as never,
        editorCamera as unknown as never,
        delta,
      );

      // Ambient light should have been set (exact values depend on hex parsing)
      expect(app.scene.ambientLight.r).toBeCloseTo(1, 2);
      expect(app.scene.ambientLight.g).toBeCloseTo(0x88 / 255, 2);
      expect(app.scene.ambientLight.b).toBeCloseTo(0, 2);
    });

    it("changes skybox color on editor camera", () => {
      const delta: IRDelta = {
        type: "environment",
        path: "skybox.color",
        value: "#336699",
      };

      applyPlayCanvasDelta(
        entityMap as unknown as Map<string, never>,
        app as unknown as never,
        editorCamera as unknown as never,
        delta,
      );

      const clearColor = editorCamera.camera!.clearColor;
      expect(clearColor.r).toBeCloseTo(0x33 / 255, 2);
      expect(clearColor.g).toBeCloseTo(0x66 / 255, 2);
      expect(clearColor.b).toBeCloseTo(0x99 / 255, 2);
    });
  });

  describe("full-rebuild delta", () => {
    it("does not modify any entities (caller handles rebuild)", () => {
      const delta: IRDelta = { type: "full-rebuild" };

      const entity = entityMap.get("entity-1")!;
      const enabledBefore = entity.enabled;

      applyPlayCanvasDelta(
        entityMap as unknown as Map<string, never>,
        app as unknown as never,
        editorCamera as unknown as never,
        delta,
      );

      // Entity state should be unchanged
      expect(entity.enabled).toBe(enabledBefore);
      expect(entity.setLocalPosition).not.toHaveBeenCalled();
      expect(entity.setLocalRotation).not.toHaveBeenCalled();
      expect(entity.setLocalScale).not.toHaveBeenCalled();
    });
  });

  describe("defensive: unknown nodeId", () => {
    it("is a no-op for transform delta with missing nodeId", () => {
      const delta: IRDelta = {
        type: "node-transform",
        nodeId: "nonexistent-entity",
        transform: { position: { x: 99, y: 99, z: 99 } },
      };

      // Should not throw
      expect(() =>
        applyPlayCanvasDelta(
          entityMap as unknown as Map<string, never>,
          app as unknown as never,
          editorCamera as unknown as never,
          delta,
        ),
      ).not.toThrow();
    });

    it("is a no-op for visibility delta with missing nodeId", () => {
      const delta: IRDelta = {
        type: "node-visibility",
        nodeId: "nonexistent-entity",
        visible: false,
      };

      expect(() =>
        applyPlayCanvasDelta(
          entityMap as unknown as Map<string, never>,
          app as unknown as never,
          editorCamera as unknown as never,
          delta,
        ),
      ).not.toThrow();
    });
  });
});
