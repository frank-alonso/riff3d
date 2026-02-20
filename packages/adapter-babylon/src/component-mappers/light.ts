import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { SpotLight } from "@babylonjs/core/Lights/spotLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Light } from "@babylonjs/core/Lights/light";
import type { Scene } from "@babylonjs/core/scene";
import type { CanonicalComponent } from "@riff3d/canonical-ir";
import { hexToColor3 } from "./material";

const DEG_TO_RAD = Math.PI / 180;

/**
 * Apply a Light IR component by creating a Babylon.js light node.
 *
 * IMPORTANT: Babylon.js lights extend Node, NOT TransformNode.
 * Position is set directly on the light. Direction is derived from
 * the quaternion rotation on the parent transform node.
 *
 * IR convention:
 * - "directional" -> DirectionalLight
 * - "point" -> PointLight
 * - "spot" -> SpotLight (cone angles in degrees -> radians)
 */
export function applyLight(
  scene: Scene,
  component: CanonicalComponent,
): Light | null {
  const props = component.properties;

  const lightType = typeof props["lightType"] === "string"
    ? props["lightType"]
    : "point";

  const color = typeof props["color"] === "string"
    ? hexToColor3(props["color"])
    : new Color3(1, 1, 1);

  const intensity = typeof props["intensity"] === "number"
    ? props["intensity"]
    : 1;

  const range = typeof props["range"] === "number"
    ? props["range"]
    : 10;

  let light: Light | null = null;

  switch (lightType) {
    case "directional": {
      const dirLight = new DirectionalLight(
        "directionalLight",
        new Vector3(0, -1, 0),
        scene,
      );
      dirLight.diffuse = color;
      dirLight.intensity = intensity;
      light = dirLight;
      break;
    }

    case "point": {
      const pointLight = new PointLight(
        "pointLight",
        Vector3.Zero(),
        scene,
      );
      pointLight.diffuse = color;
      pointLight.intensity = intensity;
      pointLight.range = range;
      light = pointLight;
      break;
    }

    case "spot": {
      const outerConeAngle = typeof props["outerConeAngle"] === "number"
        ? props["outerConeAngle"]
        : 45;

      // Babylon SpotLight exponent controls falloff (higher = tighter cone)
      const exponent = 2;

      const spotLight = new SpotLight(
        "spotLight",
        Vector3.Zero(),
        new Vector3(0, -1, 0),
        outerConeAngle * DEG_TO_RAD,
        exponent,
        scene,
      );
      spotLight.diffuse = color;
      spotLight.intensity = intensity;
      spotLight.range = range;
      light = spotLight;
      break;
    }
  }

  // castShadows: ShadowGenerator creation deferred to Phase 7
  // We document the intention but don't create generators yet.

  return light;
}
