import type { Scene } from "@babylonjs/core/scene";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { CanonicalNode } from "@riff3d/canonical-ir";
import { applyMeshRenderer } from "./mesh-renderer";
import { applyLight } from "./light";
import { applyCamera } from "./camera";

/**
 * Component mapper result -- what was created for an IR node.
 *
 * Because Babylon.js creates distinct node types (Mesh for renderers,
 * Light for lights, Camera for cameras), the mapper returns the primary
 * node that was created. The caller uses this to set up parent-child
 * relationships and transforms.
 */
export interface ComponentResult {
  /** The primary node if a mesh was created (replaces TransformNode). */
  mesh: TransformNode | null;
  /** Whether a light was created (lights are separate nodes in Babylon). */
  hasLight: boolean;
  /** Whether a camera was created (cameras are separate nodes in Babylon). */
  hasCamera: boolean;
}

/**
 * Apply all components from an IR node to a Babylon.js scene.
 *
 * Unlike PlayCanvas where components are added to an existing entity,
 * Babylon.js creates different node types for different purposes:
 * - MeshRenderer -> Mesh node (replaces the TransformNode)
 * - Light -> Light node (separate from the transform hierarchy)
 * - Camera -> Camera node (separate from the transform hierarchy)
 * - Material -> handled by MeshRenderer (looks up Material on same node)
 *
 * Unrecognized component types are silently skipped.
 */
export function applyComponents(
  scene: Scene,
  _node: TransformNode,
  irNode: CanonicalNode,
): ComponentResult {
  const result: ComponentResult = {
    mesh: null,
    hasLight: false,
    hasCamera: false,
  };

  for (const component of irNode.components) {
    switch (component.type) {
      case "MeshRenderer": {
        const mesh = applyMeshRenderer(scene, irNode, component);
        if (mesh) {
          result.mesh = mesh;
        }
        break;
      }
      case "Light": {
        const light = applyLight(scene, component);
        if (light) {
          result.hasLight = true;
        }
        break;
      }
      case "Camera": {
        applyCamera(scene, component);
        result.hasCamera = true;
        break;
      }
      case "Material": {
        // Handled by MeshRenderer -- skip to avoid double-processing
        break;
      }
      default: {
        // Unknown components are silently skipped.
        // They may be runtime-only (physics, triggers, etc.)
        break;
      }
    }
  }

  return result;
}

export { applyMeshRenderer } from "./mesh-renderer";
export { applyMaterial, hexToColor3 } from "./material";
export { applyLight } from "./light";
export { applyCamera } from "./camera";
