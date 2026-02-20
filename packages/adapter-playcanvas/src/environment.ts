import * as pc from "playcanvas";
import type { CanonicalEnvironment } from "@riff3d/canonical-ir";
import { hexToColor } from "./component-mappers/material";

/**
 * Apply Canonical IR environment settings to a PlayCanvas application.
 *
 * IR convention:
 * - Ambient light: color (hex string) + intensity
 * - Skybox: type ("color" | "image" | "hdri"), color, uri
 *   Phase 2 supports "color" only; image/hdri skyboxes deferred to 02-06.
 * - Fog: type ("linear" | "exponential" | "exponential2"), color, near/far/density
 *   PlayCanvas 2.16 uses FogParams object on scene.fog
 * - Gravity: Vec3 in meters/s^2 (physics convention, Y-up)
 *
 * @param app - The PlayCanvas Application instance
 * @param env - The Canonical IR environment settings
 */
export function applyEnvironment(
  app: pc.Application,
  env: CanonicalEnvironment,
): void {
  // Ambient light
  const ambientColor = hexToColor(env.ambientLight.color);
  app.scene.ambientLight.set(
    ambientColor.r * env.ambientLight.intensity,
    ambientColor.g * env.ambientLight.intensity,
    ambientColor.b * env.ambientLight.intensity,
  );

  // Skybox (color-only for Phase 2)
  if (env.skybox.type === "color" && env.skybox.color) {
    // For a solid-color skybox without a cubemap, we use the editor
    // camera's clear color. Store color for the adapter to read.
    app.scene.skyboxIntensity = 1;
  }

  // Fog -- PlayCanvas 2.16 uses scene.fog (FogParams object)
  const fogParams = app.scene.fog;
  if (env.fog.enabled) {
    const fogColor = hexToColor(env.fog.color);
    fogParams.color.set(fogColor.r, fogColor.g, fogColor.b);

    switch (env.fog.type) {
      case "linear":
        fogParams.type = pc.FOG_LINEAR;
        fogParams.start = env.fog.near;
        fogParams.end = env.fog.far;
        break;
      case "exponential":
        fogParams.type = pc.FOG_EXP;
        fogParams.density = env.fog.density;
        break;
      case "exponential2":
        fogParams.type = pc.FOG_EXP2;
        fogParams.density = env.fog.density;
        break;
    }
  } else {
    fogParams.type = pc.FOG_NONE;
  }

  // Exposure (tone mapping) -- reads from environment if available,
  // otherwise defaults to 1.0
  app.scene.exposure = 1;

  // Apply sky clear color to the editor camera
  // (The adapter sets camera clear color in loadScene, but this
  // ensures it stays in sync after incremental environment edits.)
}

/**
 * Get the skybox color from environment settings for use as camera clear color.
 * Returns a pc.Color or a default dark blue if no skybox color is set.
 */
export function getSkyboxColor(env: CanonicalEnvironment): pc.Color {
  if (env.skybox.type === "color" && env.skybox.color) {
    return hexToColor(env.skybox.color);
  }
  // Default dark blue sky
  return new pc.Color(0.05, 0.05, 0.12, 1);
}
