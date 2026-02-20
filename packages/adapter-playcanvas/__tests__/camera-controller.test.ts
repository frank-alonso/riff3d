import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MockApplication,
  MockEntity,
  createPlayCanvasMockModule,
} from "./helpers/pc-mocks";

// Stub DOM globals for camera controller (window.addEventListener, canvas instanceof)
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

vi.mock("playcanvas", () => createPlayCanvasMockModule());

import { CameraController, createEditorCamera } from "../src/editor-tools/camera-controller";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("CameraController", () => {
  let app: MockApplication;
  let cameraEntity: MockEntity;
  let controller: CameraController;

  beforeEach(() => {
    app = new MockApplication();
    // Set graphicsDevice.canvas to a FakeHTMLCanvasElement
    const fakeCanvas = new FakeHTMLCanvasElement();
    app.graphicsDevice.canvas = fakeCanvas as unknown as HTMLCanvasElement;

    cameraEntity = new MockEntity("EditorCamera");
    cameraEntity.camera = {
      clearColor: { r: 0, g: 0, b: 0, a: 1 } as never,
      worldToScreen: vi.fn(),
    };

    controller = new CameraController(app as never, cameraEntity as never);
  });

  describe("constructor", () => {
    it("defaults to fly mode", () => {
      expect(controller.getMode()).toBe("fly");
    });
  });

  describe("initialize", () => {
    it("attaches event listeners to canvas", () => {
      controller.initialize();

      const canvas = app.graphicsDevice.canvas as unknown as FakeHTMLCanvasElement;
      expect(canvas.addEventListener).toHaveBeenCalledWith("mousedown", expect.any(Function));
      expect(canvas.addEventListener).toHaveBeenCalledWith("mouseup", expect.any(Function));
      expect(canvas.addEventListener).toHaveBeenCalledWith("mousemove", expect.any(Function));
      expect(canvas.addEventListener).toHaveBeenCalledWith(
        "wheel",
        expect.any(Function),
        expect.objectContaining({ passive: false }),
      );
      expect(canvas.addEventListener).toHaveBeenCalledWith("contextmenu", expect.any(Function));
    });

    it("registers window keyboard events", () => {
      controller.initialize();

      const win = globalThis.window;
      expect(win.addEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
      expect(win.addEventListener).toHaveBeenCalledWith("keyup", expect.any(Function));
    });

    it("registers update handler on app", () => {
      controller.initialize();

      expect(app.on).toHaveBeenCalledWith("update", expect.any(Function));
    });
  });

  describe("switchMode", () => {
    it("switches from fly to orbit mode", () => {
      controller.initialize();

      controller.switchMode("orbit");

      expect(controller.getMode()).toBe("orbit");
    });

    it("switches from orbit to fly mode", () => {
      controller.initialize();

      controller.switchMode("orbit");
      controller.switchMode("fly");

      expect(controller.getMode()).toBe("fly");
    });

    it("is idempotent for same mode", () => {
      controller.initialize();

      controller.switchMode("fly");

      expect(controller.getMode()).toBe("fly");
    });
  });

  describe("getMode", () => {
    it("returns current camera mode", () => {
      expect(controller.getMode()).toBe("fly");

      controller.initialize();
      controller.switchMode("orbit");

      expect(controller.getMode()).toBe("orbit");
    });
  });

  describe("dispose", () => {
    it("removes all event listeners", () => {
      controller.initialize();

      controller.dispose();

      const canvas = app.graphicsDevice.canvas as unknown as FakeHTMLCanvasElement;
      expect(canvas.removeEventListener).toHaveBeenCalledWith("mousedown", expect.any(Function));
      expect(canvas.removeEventListener).toHaveBeenCalledWith("mouseup", expect.any(Function));
      expect(canvas.removeEventListener).toHaveBeenCalledWith("mousemove", expect.any(Function));
      expect(canvas.removeEventListener).toHaveBeenCalledWith("wheel", expect.any(Function));
      expect(canvas.removeEventListener).toHaveBeenCalledWith("contextmenu", expect.any(Function));
    });

    it("removes window keyboard listeners", () => {
      controller.initialize();

      controller.dispose();

      const win = globalThis.window;
      expect(win.removeEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
      expect(win.removeEventListener).toHaveBeenCalledWith("keyup", expect.any(Function));
    });

    it("removes update handler from app", () => {
      controller.initialize();

      controller.dispose();

      expect(app.off).toHaveBeenCalledWith("update", expect.any(Function));
    });
  });
});

describe("createEditorCamera", () => {
  it("creates an Entity named EditorCamera", () => {
    const app = new MockApplication();

    const camera = createEditorCamera(app as never) as unknown as MockEntity;

    expect(camera.name).toBe("EditorCamera");
  });

  it("adds a camera component with default settings", () => {
    const app = new MockApplication();

    const camera = createEditorCamera(app as never) as unknown as MockEntity;

    expect(camera.addComponent).toHaveBeenCalledWith(
      "camera",
      expect.objectContaining({
        nearClip: 0.1,
        farClip: 5000,
        fov: 60,
      }),
    );
  });

  it("sets default position and angles", () => {
    const app = new MockApplication();

    const camera = createEditorCamera(app as never) as unknown as MockEntity;

    expect(camera.setPosition).toHaveBeenCalledWith(0, 5, 10);
    expect(camera.setEulerAngles).toHaveBeenCalledWith(-20, 0, 0);
  });

  it("adds camera entity to app.root", () => {
    const app = new MockApplication();

    createEditorCamera(app as never);

    expect(app.root.addChild).toHaveBeenCalled();
  });
});
