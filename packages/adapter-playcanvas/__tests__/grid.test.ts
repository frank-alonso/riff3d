import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MockApplication,
  createPlayCanvasMockModule,
} from "./helpers/pc-mocks";

vi.mock("playcanvas", () => createPlayCanvasMockModule());

import { createGrid, GridHandle } from "../src/grid";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("createGrid", () => {
  let app: MockApplication;

  beforeEach(() => {
    app = new MockApplication();
  });

  it("returns a GridHandle", () => {
    const handle = createGrid(app as never);

    expect(handle).toBeInstanceOf(GridHandle);
  });

  it("registers an update handler on the app", () => {
    createGrid(app as never);

    expect(app.on).toHaveBeenCalledWith("update", expect.any(Function));
  });

  it("uses default gridSize of 1 when not specified", () => {
    const handle = createGrid(app as never);

    // No crash -- uses default
    expect(handle).toBeDefined();
  });

  it("accepts custom gridSize", () => {
    const handle = createGrid(app as never, 0.5);

    expect(handle).toBeInstanceOf(GridHandle);
  });
});

describe("GridHandle", () => {
  let app: MockApplication;

  beforeEach(() => {
    app = new MockApplication();
  });

  describe("constructor", () => {
    it("creates grid lines on construction", () => {
      const handle = new GridHandle(app as never, 1);

      // Grid handle should exist with lines built
      expect(handle).toBeDefined();
    });
  });

  describe("start", () => {
    it("registers update callback on app", () => {
      const handle = new GridHandle(app as never, 1);
      handle.start();

      expect(app.on).toHaveBeenCalledWith("update", expect.any(Function));
    });

    it("finds World layer from scene", () => {
      const handle = new GridHandle(app as never, 1);
      handle.start();

      expect(app.scene.layers.getLayerByName).toHaveBeenCalledWith("World");
    });
  });

  describe("updateGridSize", () => {
    it("rebuilds lines with new grid size", () => {
      const handle = new GridHandle(app as never, 1);
      handle.start();

      handle.updateGridSize(0.5);

      // No crash, lines rebuilt
    });

    it("skips rebuild if same grid size", () => {
      const handle = new GridHandle(app as never, 1);
      handle.start();

      handle.updateGridSize(1);

      // Idempotent, no crash
    });
  });

  describe("dispose", () => {
    it("removes update callback from app", () => {
      const handle = new GridHandle(app as never, 1);
      handle.start();

      handle.dispose();

      expect(app.off).toHaveBeenCalledWith("update", expect.any(Function));
    });

    it("clears lines and layer", () => {
      const handle = new GridHandle(app as never, 1);
      handle.start();

      handle.dispose();

      // Should be safe to dispose again
      handle.dispose();
    });
  });

  describe("render", () => {
    it("draws lines when update fires", () => {
      const handle = new GridHandle(app as never, 1);
      handle.start();

      // Find the update handler and call it to simulate a frame
      const updateCall = app.on.mock.calls.find(
        (c: unknown[]) => c[0] === "update",
      );
      expect(updateCall).toBeDefined();

      const updateHandler = updateCall?.[1] as () => void;
      updateHandler();

      // drawLine should have been called for each grid line
      expect(app.drawLine).toHaveBeenCalled();
      // With default extent=50 and gridSize=1, there are 101 lines per axis * 2 axes = 202 lines
      expect(app.drawLine.mock.calls.length).toBeGreaterThan(100);
    });
  });
});
