import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MockApplication,
  MockEntity,
  MockStandardMaterial,
  MockColor,
  PC_CONSTANTS,
  createPlayCanvasMockModule,
} from "./helpers/pc-mocks";

vi.mock("playcanvas", () => createPlayCanvasMockModule());

import { applyMeshRenderer } from "../src/component-mappers/mesh-renderer";
import { applyLight } from "../src/component-mappers/light";
import { applyCamera } from "../src/component-mappers/camera";
import { createMaterial, hexToColor } from "../src/component-mappers/material";
import type { CanonicalComponent, CanonicalNode } from "@riff3d/canonical-ir";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeComponent(type: string, properties: Record<string, unknown>): CanonicalComponent {
  return { type, properties };
}

function makeNode(
  components: CanonicalComponent[],
  overrides?: Partial<CanonicalNode>,
): CanonicalNode {
  return {
    id: "test-node",
    name: "TestNode",
    parentId: null,
    childIds: [],
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    },
    components,
    visible: true,
    ...overrides,
  };
}

// ─── applyMeshRenderer ─────────────────────────────────────────────────────

describe("applyMeshRenderer", () => {
  let app: MockApplication;
  let entity: MockEntity;

  beforeEach(() => {
    app = new MockApplication();
    entity = new MockEntity("MeshEntity");
  });

  it.each(["box", "sphere", "cylinder", "capsule", "cone", "plane", "torus"])(
    "adds render component for primitive '%s'",
    (primitive) => {
      const comp = makeComponent("MeshRenderer", { primitive });
      const node = makeNode([comp]);

      applyMeshRenderer(app as never, entity as never, comp, node);

      expect(entity.addComponent).toHaveBeenCalledWith(
        "render",
        expect.objectContaining({ type: primitive }),
      );
    },
  );

  it("sets shadow cast/receive settings", () => {
    const comp = makeComponent("MeshRenderer", {
      primitive: "box",
      castShadows: false,
      receiveShadows: false,
    });
    const node = makeNode([comp]);

    applyMeshRenderer(app as never, entity as never, comp, node);

    expect(entity.addComponent).toHaveBeenCalledWith(
      "render",
      expect.objectContaining({
        castShadows: false,
        receiveShadows: false,
      }),
    );
  });

  it("defaults shadow cast/receive to true when not specified", () => {
    const comp = makeComponent("MeshRenderer", { primitive: "sphere" });
    const node = makeNode([comp]);

    applyMeshRenderer(app as never, entity as never, comp, node);

    expect(entity.addComponent).toHaveBeenCalledWith(
      "render",
      expect.objectContaining({
        castShadows: true,
        receiveShadows: true,
      }),
    );
  });

  it("applies Material component from the same node", () => {
    const meshComp = makeComponent("MeshRenderer", { primitive: "box" });
    const matComp = makeComponent("Material", { baseColor: "#ff0000" });
    const node = makeNode([meshComp, matComp]);

    // Give entity a render with meshInstances so material can be applied
    entity.addComponent.mockImplementation((type: string, data?: Record<string, unknown>) => {
      if (type === "render") {
        const mat = new MockStandardMaterial();
        entity.render = { meshInstances: [{ material: mat }] };
      }
      return data ?? {};
    });

    applyMeshRenderer(app as never, entity as never, meshComp, node);

    // The material should have been created and set on the mesh instance
    expect(entity.render).not.toBeNull();
    if (entity.render) {
      const appliedMat = entity.render.meshInstances[0]?.material;
      // createMaterial produces a StandardMaterial with diffuse from baseColor
      expect(appliedMat).toBeDefined();
    }
  });

  it("handles meshAssetId with placeholder box", () => {
    const comp = makeComponent("MeshRenderer", { meshAssetId: "asset-123" });
    const node = makeNode([comp]);

    applyMeshRenderer(app as never, entity as never, comp, node);

    expect(entity.addComponent).toHaveBeenCalledWith(
      "render",
      expect.objectContaining({ type: "box" }),
    );
  });
});

// ─── applyLight ─────────────────────────────────────────────────────────────

describe("applyLight", () => {
  let entity: MockEntity;

  beforeEach(() => {
    entity = new MockEntity("LightEntity");
  });

  it.each([
    ["directional", "directional"],
    ["point", "omni"],
    ["spot", "spot"],
  ] as const)("maps IR light type '%s' to PlayCanvas '%s'", (irType, pcType) => {
    const comp = makeComponent("Light", { lightType: irType });

    applyLight(entity as never, comp);

    expect(entity.addComponent).toHaveBeenCalledWith(
      "light",
      expect.objectContaining({ type: pcType }),
    );
  });

  it("sets color, intensity, and shadow settings", () => {
    const comp = makeComponent("Light", {
      lightType: "point",
      color: "#ff8800",
      intensity: 2.5,
      castShadows: true,
      shadowBias: 0.01,
    });

    applyLight(entity as never, comp);

    const callArgs = entity.addComponent.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(callArgs["intensity"]).toBe(2.5);
    expect(callArgs["castShadows"]).toBe(true);
    expect(callArgs["shadowBias"]).toBe(0.01);
    // Color should be a MockColor parsed from hex
    expect(callArgs["color"]).toBeDefined();
  });

  it("uses defaults for missing properties", () => {
    const comp = makeComponent("Light", {});

    applyLight(entity as never, comp);

    const callArgs = entity.addComponent.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(callArgs["type"]).toBe("omni"); // default when lightType missing
    expect(callArgs["intensity"]).toBe(1);
    expect(callArgs["range"]).toBe(10);
    expect(callArgs["castShadows"]).toBe(false);
  });

  it("sets cone angles for spot lights", () => {
    const comp = makeComponent("Light", {
      lightType: "spot",
      innerConeAngle: 15,
      outerConeAngle: 30,
    });

    applyLight(entity as never, comp);

    const callArgs = entity.addComponent.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(callArgs["innerConeAngle"]).toBe(15);
    expect(callArgs["outerConeAngle"]).toBe(30);
  });
});

// ─── applyCamera ────────────────────────────────────────────────────────────

describe("applyCamera", () => {
  let entity: MockEntity;

  beforeEach(() => {
    entity = new MockEntity("CameraEntity");
  });

  it("sets perspective projection by default", () => {
    const comp = makeComponent("Camera", {});

    applyCamera(entity as never, comp);

    const callArgs = entity.addComponent.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(callArgs["projection"]).toBe(PC_CONSTANTS.PROJECTION_PERSPECTIVE);
  });

  it("sets orthographic projection when specified", () => {
    const comp = makeComponent("Camera", { projection: "orthographic" });

    applyCamera(entity as never, comp);

    const callArgs = entity.addComponent.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(callArgs["projection"]).toBe(PC_CONSTANTS.PROJECTION_ORTHOGRAPHIC);
  });

  it("sets fov, near/far clip planes", () => {
    const comp = makeComponent("Camera", {
      fov: 90,
      nearClip: 0.5,
      farClip: 5000,
    });

    applyCamera(entity as never, comp);

    const callArgs = entity.addComponent.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(callArgs["fov"]).toBe(90);
    expect(callArgs["nearClip"]).toBe(0.5);
    expect(callArgs["farClip"]).toBe(5000);
  });

  it("sets clearColor from hex string", () => {
    const comp = makeComponent("Camera", { clearColor: "#ff0000" });

    applyCamera(entity as never, comp);

    const callArgs = entity.addComponent.mock.calls[0]?.[1] as Record<string, unknown>;
    const clearColor = callArgs["clearColor"] as MockColor;
    expect(clearColor).toBeDefined();
    expect(clearColor.r).toBeCloseTo(1, 1);
    expect(clearColor.g).toBeCloseTo(0, 1);
  });

  it("scene cameras are disabled by default (enabled: false)", () => {
    const comp = makeComponent("Camera", {});

    applyCamera(entity as never, comp);

    const callArgs = entity.addComponent.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(callArgs["enabled"]).toBe(false);
  });
});

// ─── createMaterial ─────────────────────────────────────────────────────────

describe("createMaterial", () => {
  it("sets diffuse color from baseColor hex", () => {
    const comp = makeComponent("Material", { baseColor: "#ff0000" });

    const mat = createMaterial(comp) as unknown as MockStandardMaterial;

    expect(mat.diffuse.r).toBeCloseTo(1, 1);
    expect(mat.diffuse.g).toBeCloseTo(0, 1);
    expect(mat.diffuse.b).toBeCloseTo(0, 1);
  });

  it("sets metalness and enables metalness workflow", () => {
    const comp = makeComponent("Material", { metallic: 0.8 });

    const mat = createMaterial(comp) as unknown as MockStandardMaterial;

    expect(mat.metalness).toBe(0.8);
    expect(mat.useMetalness).toBe(true);
  });

  it("converts roughness to gloss (gloss = 1 - roughness)", () => {
    const comp = makeComponent("Material", { roughness: 0.3 });

    const mat = createMaterial(comp) as unknown as MockStandardMaterial;

    expect(mat.gloss).toBeCloseTo(0.7, 5);
  });

  it("sets emissive color and intensity", () => {
    const comp = makeComponent("Material", {
      emissive: "#00ff00",
      emissiveIntensity: 2,
    });

    const mat = createMaterial(comp) as unknown as MockStandardMaterial;

    expect(mat.emissive.g).toBeCloseTo(1, 1);
    expect(mat.emissiveIntensity).toBe(2);
  });

  it("sets opacity and enables blend mode for semi-transparent materials", () => {
    const comp = makeComponent("Material", { opacity: 0.5 });

    const mat = createMaterial(comp) as unknown as MockStandardMaterial;

    expect(mat.opacity).toBe(0.5);
    expect(mat.blendType).toBe(PC_CONSTANTS.BLEND_NORMAL);
  });

  it("handles doubleSided materials", () => {
    const comp = makeComponent("Material", { doubleSided: true });

    const mat = createMaterial(comp) as unknown as MockStandardMaterial;

    expect(mat.cull).toBe(PC_CONSTANTS.CULLFACE_NONE);
    expect(mat.twoSidedLighting).toBe(true);
  });

  it("calls update() after setting properties", () => {
    const comp = makeComponent("Material", { baseColor: "#ffffff" });

    const mat = createMaterial(comp) as unknown as MockStandardMaterial;

    expect(mat.update).toHaveBeenCalled();
  });
});

// ─── hexToColor ─────────────────────────────────────────────────────────────

describe("hexToColor", () => {
  it("parses 6-digit hex color", () => {
    const color = hexToColor("#ff8800") as unknown as MockColor;

    expect(color.r).toBeCloseTo(1, 1);
    expect(color.g).toBeCloseTo(0.533, 2);
    expect(color.b).toBeCloseTo(0, 1);
  });

  it("parses 3-digit shorthand hex color", () => {
    const color = hexToColor("#f00") as unknown as MockColor;

    expect(color.r).toBeCloseTo(1, 1);
    expect(color.g).toBeCloseTo(0, 1);
    expect(color.b).toBeCloseTo(0, 1);
  });
});
