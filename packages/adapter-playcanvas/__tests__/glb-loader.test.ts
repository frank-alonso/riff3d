import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MockApplication,
  MockEntity,
  MockStandardMaterial,
  MockColor,
  MockAsset,
  createPlayCanvasMockModule,
} from "./helpers/pc-mocks";

vi.mock("playcanvas", () => createPlayCanvasMockModule());

import { importGlb } from "../src/glb-loader";
import type { GlbImportResult } from "../src/glb-loader";

// ─── Helpers ────────────────────────────────────────────────────────────────

function createSingleMeshAsset(): MockAsset {
  const rootEntity = new MockEntity("GLB_Root");
  rootEntity.setLocalPosition(0, 0, 0);
  rootEntity.setLocalRotation(0, 0, 0, 1);
  rootEntity.setLocalScale(1, 1, 1);

  const mat = new MockStandardMaterial();
  mat.name = "DefaultMaterial";
  mat.diffuse = new MockColor(0.8, 0.2, 0.1);
  mat.metalness = 0.5;
  mat.gloss = 0.7; // roughness = 1 - 0.7 = 0.3
  mat.emissive = new MockColor(0, 0, 0);
  mat.emissiveIntensity = 1;
  mat.opacity = 1;

  rootEntity.render = {
    meshInstances: [{ material: mat }],
  };

  const asset = new MockAsset("test.glb", "container", { url: "http://example.com/test.glb" });
  asset.resource = {
    instantiateRenderEntity: vi.fn(() => rootEntity),
    animations: [],
  };

  return asset;
}

function createMultiMeshAsset(): MockAsset {
  const rootEntity = new MockEntity("Scene_Root");
  rootEntity.setLocalPosition(0, 0, 0);
  rootEntity.setLocalRotation(0, 0, 0, 1);
  rootEntity.setLocalScale(1, 1, 1);

  const child1 = new MockEntity("Mesh_Body");
  child1.setLocalPosition(0, 1, 0);
  child1.setLocalRotation(0, 0, 0, 1);
  child1.setLocalScale(1, 1, 1);
  const bodyMat = new MockStandardMaterial();
  bodyMat.name = "BodyMaterial";
  bodyMat.diffuse = new MockColor(0.5, 0.5, 0.5);
  bodyMat.metalness = 0.8;
  bodyMat.gloss = 0.3;
  bodyMat.emissive = new MockColor(0, 0, 0);
  bodyMat.emissiveIntensity = 1;
  bodyMat.opacity = 1;
  child1.render = { meshInstances: [{ material: bodyMat }] };

  const child2 = new MockEntity("Mesh_Wheel");
  child2.setLocalPosition(0, 0, 1);
  child2.setLocalRotation(0, 0, 0, 1);
  child2.setLocalScale(0.5, 0.5, 0.5);
  const wheelMat = new MockStandardMaterial();
  wheelMat.name = "WheelMaterial";
  wheelMat.diffuse = new MockColor(0.1, 0.1, 0.1);
  wheelMat.metalness = 0.2;
  wheelMat.gloss = 0.9;
  wheelMat.emissive = new MockColor(0, 0, 0);
  wheelMat.emissiveIntensity = 1;
  wheelMat.opacity = 1;
  child2.render = { meshInstances: [{ material: wheelMat }] };

  rootEntity.children = [child1, child2];
  child1.parent = rootEntity;
  child2.parent = rootEntity;

  const asset = new MockAsset("car.glb", "container", { url: "http://example.com/car.glb" });
  asset.resource = {
    instantiateRenderEntity: vi.fn(() => rootEntity),
    animations: [{ name: "idle" }, { name: "run" }],
  };

  return asset;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("importGlb", () => {
  let app: MockApplication;

  beforeEach(() => {
    app = new MockApplication();
  });

  it("resolves with hierarchy data for single-mesh GLB", async () => {
    const mockAsset = createSingleMeshAsset();

    // Override assets.add and assets.load to fire "load" on the asset
    app.assets.add.mockImplementation(() => {});
    app.assets.load.mockImplementation((asset: MockAsset) => {
      // Simulate async load completion
      queueMicrotask(() => asset.fire("load"));
    });

    // Mock the Asset constructor to return our mock asset
    const pcMock = await import("playcanvas");
    const originalAsset = pcMock.Asset;
    (pcMock as Record<string, unknown>).Asset = class {
      name: string;
      type: string;
      resource = mockAsset.resource;
      private eventHandlers = new Map<string, Array<(...args: unknown[]) => void>>();

      on = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        const handlers = this.eventHandlers.get(event) ?? [];
        handlers.push(handler);
        this.eventHandlers.set(event, handlers);
      });

      fire(event: string, ...args: unknown[]): void {
        const handlers = this.eventHandlers.get(event) ?? [];
        for (const handler of handlers) handler(...args);
      }

      constructor(name: string, type: string, _data?: unknown) {
        this.name = name;
        this.type = type;
        // Assign ourselves to be loaded
        app.assets.load.mockImplementation(() => {
          queueMicrotask(() => this.fire("load"));
        });
      }
    };

    const result = await importGlb(app as never, "http://example.com/test.glb");

    // Restore original
    (pcMock as Record<string, unknown>).Asset = originalAsset;

    expect(result.hierarchy.length).toBe(1);
    expect(result.hierarchy[0]?.name).toBe("GLB_Root");
    expect(result.hierarchy[0]?.parentIndex).toBe(-1);
    expect(result.hierarchy[0]?.hasMesh).toBe(true);
    expect(result.materials.length).toBe(1);
    expect(result.materials[0]?.name).toBe("DefaultMaterial");
    expect(result.animationCount).toBe(0);
  });

  it("resolves with hierarchy data for multi-mesh GLB", async () => {
    const mockAsset = createMultiMeshAsset();

    const pcMock = await import("playcanvas");
    const originalAsset = pcMock.Asset;
    (pcMock as Record<string, unknown>).Asset = class {
      name: string;
      type: string;
      resource = mockAsset.resource;
      private eventHandlers = new Map<string, Array<(...args: unknown[]) => void>>();

      on = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        const handlers = this.eventHandlers.get(event) ?? [];
        handlers.push(handler);
        this.eventHandlers.set(event, handlers);
      });

      fire(event: string, ...args: unknown[]): void {
        const handlers = this.eventHandlers.get(event) ?? [];
        for (const handler of handlers) handler(...args);
      }

      constructor(name: string, type: string, _data?: unknown) {
        this.name = name;
        this.type = type;
        app.assets.load.mockImplementation(() => {
          queueMicrotask(() => this.fire("load"));
        });
      }
    };

    const result = await importGlb(app as never, "http://example.com/car.glb");

    (pcMock as Record<string, unknown>).Asset = originalAsset;

    // Root + 2 children = 3 nodes
    expect(result.hierarchy.length).toBe(3);
    expect(result.hierarchy[0]?.name).toBe("Scene_Root");
    expect(result.hierarchy[1]?.name).toBe("Mesh_Body");
    expect(result.hierarchy[2]?.name).toBe("Mesh_Wheel");

    // Parent-child relationships
    expect(result.hierarchy[0]?.parentIndex).toBe(-1);
    expect(result.hierarchy[1]?.parentIndex).toBe(0);
    expect(result.hierarchy[2]?.parentIndex).toBe(0);

    // Materials deduplicated by name
    expect(result.materials.length).toBe(2);

    // Animation count
    expect(result.animationCount).toBe(2);
  });

  it("extracts material properties correctly", async () => {
    const mockAsset = createSingleMeshAsset();

    const pcMock = await import("playcanvas");
    const originalAsset = pcMock.Asset;
    (pcMock as Record<string, unknown>).Asset = class {
      name: string;
      type: string;
      resource = mockAsset.resource;
      private eventHandlers = new Map<string, Array<(...args: unknown[]) => void>>();

      on = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        const handlers = this.eventHandlers.get(event) ?? [];
        handlers.push(handler);
        this.eventHandlers.set(event, handlers);
      });

      fire(event: string, ...args: unknown[]): void {
        const handlers = this.eventHandlers.get(event) ?? [];
        for (const handler of handlers) handler(...args);
      }

      constructor(name: string, type: string, _data?: unknown) {
        this.name = name;
        this.type = type;
        app.assets.load.mockImplementation(() => {
          queueMicrotask(() => this.fire("load"));
        });
      }
    };

    const result = await importGlb(app as never, "http://example.com/test.glb");

    (pcMock as Record<string, unknown>).Asset = originalAsset;

    const mat = result.materials[0]!;
    expect(mat.metallic).toBe(0.5);
    // roughness = 1 - gloss (0.7) = 0.3
    expect(mat.roughness).toBeCloseTo(0.3, 5);
    expect(mat.opacity).toBe(1);
  });

  it("rejects on load error", async () => {
    const pcMock = await import("playcanvas");
    const originalAsset = pcMock.Asset;
    (pcMock as Record<string, unknown>).Asset = class {
      name: string;
      type: string;
      resource = null;
      private eventHandlers = new Map<string, Array<(...args: unknown[]) => void>>();

      on = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        const handlers = this.eventHandlers.get(event) ?? [];
        handlers.push(handler);
        this.eventHandlers.set(event, handlers);
      });

      fire(event: string, ...args: unknown[]): void {
        const handlers = this.eventHandlers.get(event) ?? [];
        for (const handler of handlers) handler(...args);
      }

      constructor(name: string, type: string, _data?: unknown) {
        this.name = name;
        this.type = type;
        app.assets.load.mockImplementation(() => {
          queueMicrotask(() => this.fire("error", "Network error"));
        });
      }
    };

    await expect(
      importGlb(app as never, "http://example.com/bad.glb"),
    ).rejects.toThrow("Failed to load GLB");

    (pcMock as Record<string, unknown>).Asset = originalAsset;
  });
});
