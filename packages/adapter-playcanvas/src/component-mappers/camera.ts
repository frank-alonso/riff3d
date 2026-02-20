import * as pc from "playcanvas";
import type { CanonicalComponent } from "@riff3d/canonical-ir";
import { hexToColor } from "./material";

/**
 * Apply a Camera IR component to a PlayCanvas entity.
 *
 * Scene cameras are created but NOT used for the editor's navigation camera.
 * The editor has its own camera entity managed by the CameraController.
 * Scene cameras are rendered to show camera frustum gizmos and for play-test mode.
 *
 * IR convention:
 * - projection: "perspective" | "orthographic"
 * - fov: vertical field of view in degrees
 * - nearClip/farClip: clipping planes in meters (physics units)
 * - orthoSize: half-height for orthographic projection
 * - clearColor: hex string for camera background
 */
export function applyCamera(
  entity: pc.Entity,
  component: CanonicalComponent,
): void {
  const props = component.properties;

  const projection = props["projection"] === "orthographic"
    ? pc.PROJECTION_ORTHOGRAPHIC
    : pc.PROJECTION_PERSPECTIVE;

  const fov = typeof props["fov"] === "number" ? props["fov"] : 60;
  const nearClip = typeof props["nearClip"] === "number" ? props["nearClip"] : 0.1;
  const farClip = typeof props["farClip"] === "number" ? props["farClip"] : 1000;
  const orthoHeight = typeof props["orthoSize"] === "number" ? props["orthoSize"] : 5;

  const clearColor = typeof props["clearColor"] === "string"
    ? hexToColor(props["clearColor"])
    : new pc.Color(0, 0, 0, 1);

  const priority = typeof props["priority"] === "number" ? props["priority"] : 0;

  entity.addComponent("camera", {
    projection,
    fov,
    nearClip,
    farClip,
    orthoHeight,
    clearColor,
    priority,
    // Scene cameras are disabled by default in editor mode.
    // They are enabled during play-test (02-07).
    enabled: false,
  });
}
