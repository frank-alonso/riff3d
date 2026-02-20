import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { CanonicalComponent } from "@riff3d/canonical-ir";

const DEG_TO_RAD = Math.PI / 180;

/**
 * Apply a Camera IR component by creating a Babylon.js camera.
 *
 * Scene cameras are created but NOT used for the editor's navigation camera.
 * The editor has its own camera managed by BabylonAdapter.
 * Scene cameras may be used in play-test mode.
 *
 * IR convention:
 * - projection: "perspective" | "orthographic"
 * - fov: vertical field of view in degrees (converted to radians for Babylon)
 * - nearClip/farClip: clipping planes in meters
 * - orthoSize: half-height for orthographic projection
 */
export function applyCamera(
  scene: Scene,
  component: CanonicalComponent,
): UniversalCamera {
  const props = component.properties;

  const camera = new UniversalCamera("sceneCamera", Vector3.Zero(), scene);

  // FOV: degrees to radians
  const fovDeg = typeof props["fov"] === "number" ? props["fov"] : 60;
  camera.fov = fovDeg * DEG_TO_RAD;

  // Clipping planes
  camera.minZ = typeof props["nearClip"] === "number" ? props["nearClip"] : 0.1;
  camera.maxZ = typeof props["farClip"] === "number" ? props["farClip"] : 1000;

  // Projection mode
  if (props["projection"] === "orthographic") {
    camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    const orthoSize = typeof props["orthoSize"] === "number" ? props["orthoSize"] : 5;
    camera.orthoTop = orthoSize;
    camera.orthoBottom = -orthoSize;
    // Aspect ratio for left/right will be set during resize
    camera.orthoLeft = -orthoSize;
    camera.orthoRight = orthoSize;
  }

  // Scene cameras don't receive input in editor mode
  camera.detachControl();

  return camera;
}
