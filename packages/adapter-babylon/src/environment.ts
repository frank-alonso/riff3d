import { Scene } from "@babylonjs/core/scene";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import type { CanonicalEnvironment } from "@riff3d/canonical-ir";
import { hexToColor3 } from "./component-mappers/material";

/**
 * Apply Canonical IR environment settings to a Babylon.js scene.
 *
 * IR convention:
 * - Ambient light: color (hex string) + intensity
 * - Skybox: type ("color" | "image" | "hdri"), color, uri
 *   Phase 4 supports "color" only; image/hdri skyboxes deferred.
 * - Fog: type ("linear" | "exponential" | "exponential2"), color, near/far/density
 * - Gravity: Vec3 in meters/s^2 (deferred -- no physics in Phase 4)
 *
 * @param scene - The Babylon.js Scene instance
 * @param env - The Canonical IR environment settings
 */
export function applyEnvironment(
  scene: Scene,
  env: CanonicalEnvironment,
): void {
  // Ambient light
  const ambientColor = hexToColor3(env.ambientLight.color);
  scene.ambientColor = new Color3(
    ambientColor.r * env.ambientLight.intensity,
    ambientColor.g * env.ambientLight.intensity,
    ambientColor.b * env.ambientLight.intensity,
  );

  // Fog
  if (env.fog.enabled) {
    const fogColor = hexToColor3(env.fog.color);
    scene.fogColor = new Color3(fogColor.r, fogColor.g, fogColor.b);

    switch (env.fog.type) {
      case "linear":
        scene.fogMode = Scene.FOGMODE_LINEAR;
        scene.fogStart = env.fog.near;
        scene.fogEnd = env.fog.far;
        break;
      case "exponential":
        scene.fogMode = Scene.FOGMODE_EXP;
        scene.fogDensity = env.fog.density;
        break;
      case "exponential2":
        scene.fogMode = Scene.FOGMODE_EXP2;
        scene.fogDensity = env.fog.density;
        break;
    }
  } else {
    scene.fogMode = Scene.FOGMODE_NONE;
  }

  // Skybox color -> scene clear color
  if (env.skybox.type === "color" && env.skybox.color) {
    const skyColor = hexToColor3(env.skybox.color);
    scene.clearColor = new Color4(skyColor.r, skyColor.g, skyColor.b, 1);
  }
}

/**
 * Get the skybox color from environment settings for use as scene clear color.
 * Returns a Color4 or a default dark blue if no skybox color is set.
 */
export function getSkyboxColor(env: CanonicalEnvironment): Color4 {
  if (env.skybox.type === "color" && env.skybox.color) {
    const c = hexToColor3(env.skybox.color);
    return new Color4(c.r, c.g, c.b, 1);
  }
  // Default dark blue sky
  return new Color4(0.05, 0.05, 0.12, 1);
}
