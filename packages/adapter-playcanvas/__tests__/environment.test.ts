import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MockApplication,
  MockColor,
  PC_CONSTANTS,
  createPlayCanvasMockModule,
} from "./helpers/pc-mocks";

vi.mock("playcanvas", () => createPlayCanvasMockModule());

import { applyEnvironment, getSkyboxColor } from "../src/environment";
import type { CanonicalEnvironment } from "@riff3d/canonical-ir";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeEnv(overrides?: Partial<CanonicalEnvironment>): CanonicalEnvironment {
  return {
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
    ...overrides,
  };
}

// ─── applyEnvironment ───────────────────────────────────────────────────────

describe("applyEnvironment", () => {
  let app: MockApplication;

  beforeEach(() => {
    app = new MockApplication();
  });

  it("sets ambient light color scaled by intensity", () => {
    const env = makeEnv({
      ambientLight: { color: "#ffffff", intensity: 0.5 },
    });

    applyEnvironment(app as never, env);

    // #ffffff = (1,1,1), * 0.5 = (0.5, 0.5, 0.5)
    expect(app.scene.ambientLight.r).toBeCloseTo(0.5, 2);
    expect(app.scene.ambientLight.g).toBeCloseTo(0.5, 2);
    expect(app.scene.ambientLight.b).toBeCloseTo(0.5, 2);
  });

  it("configures linear fog with start and end", () => {
    const env = makeEnv({
      fog: {
        enabled: true,
        type: "linear",
        color: "#aabbcc",
        near: 10,
        far: 200,
        density: 0.01,
      },
    });

    applyEnvironment(app as never, env);

    expect(app.scene.fog.type).toBe(PC_CONSTANTS.FOG_LINEAR);
    expect(app.scene.fog.start).toBe(10);
    expect(app.scene.fog.end).toBe(200);
  });

  it("configures exponential fog with density", () => {
    const env = makeEnv({
      fog: {
        enabled: true,
        type: "exponential",
        color: "#ffffff",
        near: 0,
        far: 100,
        density: 0.05,
      },
    });

    applyEnvironment(app as never, env);

    expect(app.scene.fog.type).toBe(PC_CONSTANTS.FOG_EXP);
    expect(app.scene.fog.density).toBe(0.05);
  });

  it("configures exponential2 fog with density", () => {
    const env = makeEnv({
      fog: {
        enabled: true,
        type: "exponential2",
        color: "#ffffff",
        near: 0,
        far: 100,
        density: 0.02,
      },
    });

    applyEnvironment(app as never, env);

    expect(app.scene.fog.type).toBe(PC_CONSTANTS.FOG_EXP2);
    expect(app.scene.fog.density).toBe(0.02);
  });

  it("sets fog type to FOG_NONE when fog is disabled", () => {
    const env = makeEnv({
      fog: {
        enabled: false,
        type: "linear",
        color: "#ffffff",
        near: 0,
        far: 100,
        density: 0.01,
      },
    });

    applyEnvironment(app as never, env);

    expect(app.scene.fog.type).toBe(PC_CONSTANTS.FOG_NONE);
  });

  it("sets fog color when fog is enabled", () => {
    const env = makeEnv({
      fog: {
        enabled: true,
        type: "linear",
        color: "#ff0000",
        near: 0,
        far: 100,
        density: 0.01,
      },
    });

    applyEnvironment(app as never, env);

    expect(app.scene.fog.color.r).toBeCloseTo(1, 1);
    expect(app.scene.fog.color.g).toBeCloseTo(0, 1);
    expect(app.scene.fog.color.b).toBeCloseTo(0, 1);
  });

  it("sets exposure to 1", () => {
    const env = makeEnv();

    applyEnvironment(app as never, env);

    expect(app.scene.exposure).toBe(1);
  });

  it("sets skyboxIntensity for color-type skybox", () => {
    const env = makeEnv({
      skybox: { type: "color", color: "#0d0d1f", uri: null },
    });

    applyEnvironment(app as never, env);

    expect(app.scene.skyboxIntensity).toBe(1);
  });
});

// ─── getSkyboxColor ─────────────────────────────────────────────────────────

describe("getSkyboxColor", () => {
  it("returns Color from hex string for color-type skybox", () => {
    const env = makeEnv({
      skybox: { type: "color", color: "#ff0000", uri: null },
    });

    const color = getSkyboxColor(env) as unknown as MockColor;

    expect(color.r).toBeCloseTo(1, 1);
    expect(color.g).toBeCloseTo(0, 1);
    expect(color.b).toBeCloseTo(0, 1);
  });

  it("returns default dark blue for non-color skybox", () => {
    const env = makeEnv({
      skybox: { type: "image", color: null, uri: "sky.hdr" },
    });

    const color = getSkyboxColor(env) as unknown as MockColor;

    expect(color.r).toBeCloseTo(0.05, 2);
    expect(color.g).toBeCloseTo(0.05, 2);
    expect(color.b).toBeCloseTo(0.12, 2);
  });

  it("returns default dark blue when skybox color is null", () => {
    const env = makeEnv({
      skybox: { type: "color", color: null, uri: null },
    });

    const color = getSkyboxColor(env) as unknown as MockColor;

    expect(color.r).toBeCloseTo(0.05, 2);
    expect(color.b).toBeCloseTo(0.12, 2);
  });
});
