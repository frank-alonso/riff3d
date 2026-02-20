import * as pc from "playcanvas";
import type { CanonicalComponent } from "@riff3d/canonical-ir";
import { hexToColor } from "./material";

/**
 * Map IR light types to PlayCanvas light types.
 *
 * IR convention:
 * - "directional" -> PlayCanvas "directional"
 * - "point" -> PlayCanvas "omni" (PlayCanvas calls point lights "omni")
 * - "spot" -> PlayCanvas "spot"
 */
const LIGHT_TYPE_MAP: Record<string, string> = {
  directional: "directional",
  point: "omni",
  spot: "spot",
};

/**
 * Apply a Light IR component to a PlayCanvas entity.
 *
 * Maps IR light properties (type, color, intensity, range, cone angles,
 * shadows) to PlayCanvas light component properties. Colors are converted
 * from hex strings to pc.Color.
 */
export function applyLight(
  entity: pc.Entity,
  component: CanonicalComponent,
): void {
  const props = component.properties;

  const lightType = typeof props["lightType"] === "string"
    ? (LIGHT_TYPE_MAP[props["lightType"]] ?? "omni")
    : "omni";

  const color = typeof props["color"] === "string"
    ? hexToColor(props["color"])
    : new pc.Color(1, 1, 1);

  const intensity = typeof props["intensity"] === "number"
    ? props["intensity"]
    : 1;

  const range = typeof props["range"] === "number"
    ? props["range"]
    : 10;

  const castShadows = props["castShadows"] === true;
  const shadowBias = typeof props["shadowBias"] === "number"
    ? props["shadowBias"]
    : 0.005;

  const innerConeAngle = typeof props["innerConeAngle"] === "number"
    ? props["innerConeAngle"]
    : 30;

  const outerConeAngle = typeof props["outerConeAngle"] === "number"
    ? props["outerConeAngle"]
    : 45;

  entity.addComponent("light", {
    type: lightType,
    color,
    intensity,
    range,
    castShadows,
    shadowBias,
    innerConeAngle,
    outerConeAngle,
    // Shadow resolution for quality
    shadowResolution: 2048,
    // Normal offset bias to reduce shadow acne
    normalOffsetBias: 0.05,
  });
}
