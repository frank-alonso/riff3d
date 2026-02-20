import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MockApplication,
  MockEntity,
  createPlayCanvasMockModule,
} from "./helpers/pc-mocks";

// Stub DOM globals needed by adapter.ts (new pc.Keyboard(window))
// and camera-controller.ts (window.addEventListener, canvas instanceof HTMLCanvasElement)
// These must be set on globalThis before any source modules are imported.

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

import { PlayCanvasAdapter } from "../src/adapter";
import type { CanonicalScene } from "@riff3d/canonical-ir";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeScene(): CanonicalScene {
  return {
    id: "scene-1",
    name: "Test Scene",
    sourceSchemaVersion: 1,
    nodes: [
      {
        id: "n1",
        name: "Cube",
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
    nodeIndex: { n1: 0 },
    rootNodeId: "n1",
    assets: [],
    wires: [],
    environment: {
      skybox: { type: "color", color: "#0d0d1f", uri: null },
      fog: {
        enabled: false,
        type: "linear",
        color: "#ffffff",
        near: 0,
        far: 100,
        density: 0.01,
      },
      ambientLight: { color: "#ffffff", intensity: 0.5 },
      gravity: { x: 0, y: -9.81, z: 0 },
    },
    gameSettings: null,
  };
}

function createMockCanvas(): HTMLCanvasElement {
  const canvas = new FakeHTMLCanvasElement();
  return canvas as unknown as HTMLCanvasElement;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("PlayCanvasAdapter", () => {
  let adapter: PlayCanvasAdapter;

  beforeEach(() => {
    adapter = new PlayCanvasAdapter();
  });

  describe("initialize", () => {
    it("creates Application and calls start", async () => {
      const canvas = createMockCanvas();

      await adapter.initialize(canvas);

      const app = adapter.getApp() as unknown as MockApplication;
      expect(app).not.toBeNull();
      expect(app.start).toHaveBeenCalled();
    });

    it("sets up editor camera", async () => {
      const canvas = createMockCanvas();

      await adapter.initialize(canvas);

      const camera = adapter.getCameraEntity();
      expect(camera).not.toBeNull();
      expect((camera as unknown as MockEntity).name).toBe("EditorCamera");
    });

    it("guards against double initialization", async () => {
      const canvas = createMockCanvas();

      await adapter.initialize(canvas);
      const firstApp = adapter.getApp();

      await adapter.initialize(canvas);
      const secondApp = adapter.getApp();

      // Should be the same instance (not recreated)
      expect(firstApp).toBe(secondApp);
    });
  });

  describe("loadScene", () => {
    it("calls buildScene and populates entityMap", async () => {
      const canvas = createMockCanvas();
      await adapter.initialize(canvas);

      const scene = makeScene();
      adapter.loadScene(scene);

      const entityMap = adapter.getEntityMap();
      expect(entityMap.size).toBe(1);
      expect(entityMap.has("n1")).toBe(true);
    });

    it("does nothing when called before initialize", () => {
      const scene = makeScene();

      // Should not throw
      adapter.loadScene(scene);

      expect(adapter.getEntityMap().size).toBe(0);
    });
  });

  describe("rebuildScene", () => {
    it("destroys existing entities before building new ones", async () => {
      const canvas = createMockCanvas();
      await adapter.initialize(canvas);

      const scene1 = makeScene();
      adapter.loadScene(scene1);
      expect(adapter.getEntityMap().size).toBe(1);

      // Rebuild with a different scene
      const scene2: CanonicalScene = {
        ...makeScene(),
        nodes: [
          {
            id: "n2",
            name: "Sphere",
            parentId: null,
            childIds: [],
            transform: {
              position: { x: 1, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0, w: 1 },
              scale: { x: 1, y: 1, z: 1 },
            },
            components: [],
            visible: true,
          },
          {
            id: "n3",
            name: "Light",
            parentId: null,
            childIds: [],
            transform: {
              position: { x: 0, y: 5, z: 0 },
              rotation: { x: 0, y: 0, z: 0, w: 1 },
              scale: { x: 1, y: 1, z: 1 },
            },
            components: [],
            visible: true,
          },
        ],
        nodeIndex: { n2: 0, n3: 1 },
        rootNodeId: "n2",
      };

      adapter.rebuildScene(scene2);

      const entityMap = adapter.getEntityMap();
      expect(entityMap.has("n1")).toBe(false);
      expect(entityMap.has("n2")).toBe(true);
      expect(entityMap.has("n3")).toBe(true);
      expect(entityMap.size).toBe(2);
    });
  });

  describe("setPlayMode", () => {
    it("sets timeScale to 1 when entering play mode", async () => {
      const canvas = createMockCanvas();
      await adapter.initialize(canvas);

      adapter.setPlayMode(true);

      const app = adapter.getApp() as unknown as MockApplication;
      expect(app.timeScale).toBe(1);
      expect(adapter.isInPlayMode()).toBe(true);
    });

    it("sets timeScale to 0 when exiting play mode", async () => {
      const canvas = createMockCanvas();
      await adapter.initialize(canvas);

      adapter.setPlayMode(true);
      adapter.setPlayMode(false);

      const app = adapter.getApp() as unknown as MockApplication;
      expect(app.timeScale).toBe(0);
      expect(adapter.isInPlayMode()).toBe(false);
    });

    it("does nothing when called before initialize", () => {
      // Should not throw
      adapter.setPlayMode(true);
      expect(adapter.isInPlayMode()).toBe(false);
    });
  });

  describe("getEntityMap", () => {
    it("returns current entity map", async () => {
      const canvas = createMockCanvas();
      await adapter.initialize(canvas);

      adapter.loadScene(makeScene());

      const map = adapter.getEntityMap();
      expect(map).toBeInstanceOf(Map);
      expect(map.size).toBe(1);
    });

    it("returns empty map before loadScene", () => {
      const map = adapter.getEntityMap();
      expect(map.size).toBe(0);
    });
  });

  describe("dispose", () => {
    it("destroys Application and cleans up", async () => {
      const canvas = createMockCanvas();
      await adapter.initialize(canvas);

      const app = adapter.getApp() as unknown as MockApplication;

      adapter.dispose();

      expect(app.destroy).toHaveBeenCalled();
      expect(adapter.getApp()).toBeNull();
      expect(adapter.getCameraEntity()).toBeNull();
    });

    it("does not crash when called before initialize", () => {
      // Should not throw
      adapter.dispose();
    });

    it("does not crash when called twice", async () => {
      const canvas = createMockCanvas();
      await adapter.initialize(canvas);

      adapter.dispose();
      adapter.dispose();
    });
  });

  describe("setTimeScale", () => {
    it("sets engine time scale", async () => {
      const canvas = createMockCanvas();
      await adapter.initialize(canvas);

      adapter.setTimeScale(0.5);

      const app = adapter.getApp() as unknown as MockApplication;
      expect(app.timeScale).toBe(0.5);
    });
  });
});
