import * as pc from "playcanvas";
import type { CanonicalComponent, CanonicalNode } from "@riff3d/canonical-ir";
import { createMaterial } from "./material";

/**
 * Supported primitive types that map to PlayCanvas render component types.
 */
const PRIMITIVE_TYPE_MAP: Record<string, string> = {
  box: "box",
  sphere: "sphere",
  cylinder: "cylinder",
  capsule: "capsule",
  cone: "cone",
  plane: "plane",
  torus: "torus",
};

/**
 * Apply a MeshRenderer IR component to a PlayCanvas entity.
 *
 * For primitive shapes (box, sphere, plane, etc.), adds a `render` component
 * with the appropriate type. For mesh asset references (GLB imports), the
 * mesh asset would be loaded separately (deferred to 02-06 asset pipeline).
 *
 * IR convention: 1:N entity-to-node mapping means one ECSON entity maps to
 * one IR node. The MeshRenderer component specifies either a primitive shape
 * or an external mesh asset ID.
 */
export function applyMeshRenderer(
  app: pc.Application,
  entity: pc.Entity,
  component: CanonicalComponent,
  node: CanonicalNode,
): void {
  const props = component.properties;
  const primitive = props["primitive"];

  if (typeof primitive === "string" && primitive in PRIMITIVE_TYPE_MAP) {
    const pcType = PRIMITIVE_TYPE_MAP[primitive]!;
    entity.addComponent("render", {
      type: pcType,
      castShadows: props["castShadows"] !== false,
      receiveShadows: props["receiveShadows"] !== false,
    });

    // Find associated Material component on the same node and apply it
    const materialComp = node.components.find((c) => c.type === "Material");
    if (materialComp) {
      const mat = createMaterial(materialComp);
      const meshInstances = entity.render?.meshInstances;
      if (meshInstances) {
        for (const mi of meshInstances) {
          mi.material = mat;
        }
      }
    }
  } else if (typeof props["meshAssetId"] === "string") {
    // Asset-based mesh -- placeholder for 02-06 asset pipeline
    // For now, add a render component with a box as placeholder
    entity.addComponent("render", {
      type: "box",
      castShadows: props["castShadows"] !== false,
      receiveShadows: props["receiveShadows"] !== false,
    });
  }
}
