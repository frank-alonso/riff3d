import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MockApplication,
  MockEntity,
  MockVec3,
  createPlayCanvasMockModule,
} from "./helpers/pc-mocks";

// Stub DOM globals needed by DragPreviewManager
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

globalThis.HTMLCanvasElement =
  FakeHTMLCanvasElement as unknown as typeof HTMLCanvasElement;

vi.mock("playcanvas", () => createPlayCanvasMockModule());

import { DragPreviewManager } from "../src/editor-tools/drag-preview";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Create a mock camera entity with screenToWorld that projects onto the Y=0 plane.
 *
 * For testing, we set up a camera at position (0, 5, 10) looking at the origin.
 * screenToWorld returns near/far points that produce a ray hitting the ground.
 */
function createMockCamera(): MockEntity {
  const camera = new MockEntity("Camera");
  camera.setLocalPosition(0, 5, 10);

  // Mock camera component with screenToWorld
  camera.camera = {
    clearColor: { r: 0, g: 0, b: 0, a: 1 },
    worldToScreen: vi.fn(),
    nearClip: 0.1,
    farClip: 1000,
    // screenToWorld: populates output Vec3 based on screen coords and depth
    screenToWorld: vi.fn(
      (
        _sx: number,
        _sy: number,
        depth: number,
        output: MockVec3,
      ) => {
        // For simplicity: near point = camera position (0, 5, 10)
        // Far point = direction toward ground (normalized approximately)
        if (depth <= 1) {
          // Near point: camera position
          output.set(0, 5, 10);
        } else {
          // Far point: looking toward origin => direction (0, -5, -10) normalized
          // So far = near + direction_normalized * farClip
          // For testing, just set a far point that produces a clear intersection
          output.set(0, -5, -10);
        }
        return output;
      },
    ),
  } as unknown as MockEntity["camera"];

  return camera;
}

function createTestConfig(overrides?: {
  onDrop?: (
    position: { x: number; y: number; z: number },
    assetId: string,
  ) => void;
}) {
  const app = new MockApplication();
  const camera = createMockCamera();
  const canvas = new FakeHTMLCanvasElement() as unknown as HTMLCanvasElement;
  const onDrop = overrides?.onDrop ?? vi.fn();

  return {
    config: {
      app: app as unknown as import("playcanvas").Application,
      camera: camera as unknown as import("playcanvas").Entity,
      canvas,
      onDrop,
    },
    app,
    camera,
    canvas,
    onDrop,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("DragPreviewManager", () => {
  let manager: DragPreviewManager;
  let app: MockApplication;
  let onDrop: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const setup = createTestConfig();
    manager = new DragPreviewManager(setup.config);
    app = setup.app;
    onDrop = setup.onDrop as ReturnType<typeof vi.fn>;
  });

  describe("startPreview", () => {
    it("creates a ghost entity and adds it to app.root", () => {
      manager.startPreview("prim-cube", 400, 300);

      // Should have added a child to app.root
      expect(app.root.addChild).toHaveBeenCalled();
      const child = (app.root.addChild as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as MockEntity;
      expect(child.name).toBe("__drag_preview_ghost__");
    });

    it("creates ghost with render component", () => {
      manager.startPreview("prim-cube", 400, 300);

      const child = (app.root.addChild as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as MockEntity;
      expect(child.addComponent).toHaveBeenCalledWith("render", {
        type: "box",
      });
    });

    it("cleans up previous ghost if startPreview called twice", () => {
      manager.startPreview("prim-cube", 400, 300);
      const firstChild = (app.root.addChild as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as MockEntity;

      manager.startPreview("prim-sphere", 400, 300);

      // First ghost should have been destroyed
      expect(firstChild.destroy).toHaveBeenCalled();
    });
  });

  describe("updatePreview", () => {
    it("updates ghost position using ground plane intersection", () => {
      manager.startPreview("prim-cube", 400, 300);
      const ghost = (app.root.addChild as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as MockEntity;

      manager.updatePreview(500, 350);

      // setPosition should have been called (initial + update)
      expect(ghost.setPosition).toHaveBeenCalled();
    });

    it("does nothing if no ghost entity exists", () => {
      // Should not throw
      manager.updatePreview(400, 300);
    });
  });

  describe("endPreview", () => {
    it("destroys the ghost entity", () => {
      manager.startPreview("prim-cube", 400, 300);
      const ghost = (app.root.addChild as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as MockEntity;

      manager.endPreview();

      expect(ghost.destroy).toHaveBeenCalled();
    });

    it("can be called safely without a ghost", () => {
      // Should not throw
      manager.endPreview();
    });
  });

  describe("confirmDrop", () => {
    it("calls onDrop with position and asset ID", () => {
      manager.startPreview("prim-cube", 400, 300);

      manager.confirmDrop(400, 300);

      expect(onDrop).toHaveBeenCalledTimes(1);
      const [position, assetId] = onDrop.mock.calls[0] as [
        { x: number; y: number; z: number },
        string,
      ];
      expect(assetId).toBe("prim-cube");
      expect(typeof position.x).toBe("number");
      expect(typeof position.y).toBe("number");
      expect(typeof position.z).toBe("number");
    });

    it("cleans up ghost after drop", () => {
      manager.startPreview("prim-cube", 400, 300);
      const ghost = (app.root.addChild as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as MockEntity;

      manager.confirmDrop(400, 300);

      expect(ghost.destroy).toHaveBeenCalled();
    });

    it("does not call onDrop if no asset was being dragged", () => {
      manager.confirmDrop(400, 300);

      expect(onDrop).not.toHaveBeenCalled();
    });
  });

  describe("dispose", () => {
    it("cleans up ghost entity if one exists", () => {
      manager.startPreview("prim-cube", 400, 300);
      const ghost = (app.root.addChild as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as MockEntity;

      manager.dispose();

      expect(ghost.destroy).toHaveBeenCalled();
    });

    it("can be called safely with no ghost", () => {
      manager.dispose();
      // Should not throw
    });
  });

  describe("screenToGroundPlane (raycasting math)", () => {
    it("returns a position with y=0 when ray intersects the ground plane", () => {
      // Set up camera looking down at origin
      const setup = createTestConfig();

      // Override screenToWorld to simulate a camera at (0, 10, 0) looking straight down
      const cameraEntity = setup.camera;
      (
        cameraEntity.camera as unknown as {
          screenToWorld: ReturnType<typeof vi.fn>;
        }
      ).screenToWorld = vi.fn(
        (
          _sx: number,
          _sy: number,
          depth: number,
          output: MockVec3,
        ) => {
          if (depth <= 1) {
            // Near point: right above origin
            output.set(0, 10, 0);
          } else {
            // Far point: below near, straight down
            output.set(0, -10, 0);
          }
          return output;
        },
      );

      const mgr = new DragPreviewManager(setup.config);
      const pos = mgr.screenToGroundPlane(400, 300);

      // Should land at y=0 on the ground plane
      expect(pos.y).toBeCloseTo(0, 5);
    });

    it("returns fallback position when camera faces away from ground", () => {
      const setup = createTestConfig();

      // Camera looking up (no ground intersection)
      const cameraEntity = setup.camera;
      (
        cameraEntity.camera as unknown as {
          screenToWorld: ReturnType<typeof vi.fn>;
        }
      ).screenToWorld = vi.fn(
        (
          _sx: number,
          _sy: number,
          depth: number,
          output: MockVec3,
        ) => {
          if (depth <= 1) {
            output.set(0, 5, 0);
          } else {
            // Looking up, both points have positive Y
            output.set(0, 15, 0);
          }
          return output;
        },
      );

      const mgr = new DragPreviewManager(setup.config);
      const pos = mgr.screenToGroundPlane(400, 300);

      // Should NOT be at y=0 since ray doesn't hit ground
      // Should be placed at fallback distance along ray
      expect(pos.y).not.toBeCloseTo(0, 1);
    });

    it("handles a camera at angle computing correct intersection", () => {
      const setup = createTestConfig();

      // Camera at (0, 5, 10) looking toward origin: direction (0, -5, -10) normalized
      const cameraEntity = setup.camera;
      (
        cameraEntity.camera as unknown as {
          screenToWorld: ReturnType<typeof vi.fn>;
        }
      ).screenToWorld = vi.fn(
        (
          _sx: number,
          _sy: number,
          depth: number,
          output: MockVec3,
        ) => {
          if (depth <= 1) {
            output.set(0, 5, 10);
          } else {
            output.set(0, 0, 0);
          }
          return output;
        },
      );

      const mgr = new DragPreviewManager(setup.config);
      const pos = mgr.screenToGroundPlane(400, 300);

      // Ray from (0,5,10) toward (0,0,0): direction = (0,-5,-10) normalized
      // t = -5 / (-5/sqrt(125)) = sqrt(125) = 11.18
      // intersection x = 0, y = 0, z = 10 + (-10/sqrt(125)) * sqrt(125) = 10 - 10 = 0
      expect(pos.y).toBeCloseTo(0, 5);
      expect(pos.z).toBeCloseTo(0, 1);
      expect(pos.x).toBeCloseTo(0, 5);
    });
  });
});
