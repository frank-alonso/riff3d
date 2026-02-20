/**
 * Babylon.js delta application -- incremental scene updates.
 *
 * Instead of destroying and rebuilding the entire Babylon.js scene graph,
 * this module applies fine-grained deltas to individual nodes, materials,
 * lights, and cameras. This makes property edits in the inspector
 * feel instant (O(1) per property) instead of causing a full rebuild (O(n)).
 *
 * IR conventions (CF-06):
 * - Roughness: 0 = smooth, 1 = rough (direct pass-through, NO inversion)
 * - Colors: hex strings in IR -> Color3 (0-1 floats)
 * - FOV: degrees in IR -> radians for Babylon (conversion needed)
 * - Rotation: always use rotationQuaternion (never rotation Euler)
 */
import { Vector3, Quaternion } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Scene } from "@babylonjs/core/scene";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { PBRMetallicRoughnessMaterial } from "@babylonjs/core/Materials/PBR/pbrMetallicRoughnessMaterial";
import type { IRDelta } from "./types";
import { hexToColor3 } from "./component-mappers/material";

const DEG_TO_RAD = Math.PI / 180;

/**
 * Apply an incremental IRDelta to the Babylon.js scene.
 *
 * @param entityMap - Map of ECSON entity ID -> Babylon.js TransformNode
 * @param scene - The Babylon.js Scene instance
 * @param delta - The IRDelta to apply
 */
export function applyBabylonDelta(
  entityMap: Map<string, TransformNode>,
  scene: Scene,
  delta: IRDelta,
): void {
  switch (delta.type) {
    case "node-transform":
      applyTransformDelta(entityMap, delta);
      break;

    case "node-visibility":
      applyVisibilityDelta(entityMap, delta);
      break;

    case "component-property":
      applyComponentPropertyDelta(entityMap, delta);
      break;

    case "environment":
      applyEnvironmentDelta(scene, delta);
      break;

    case "full-rebuild":
      // No-op: caller handles full rebuild fallback
      break;
  }
}

// ─── Transform Delta ────────────────────────────────────────────────────────

function applyTransformDelta(
  entityMap: Map<string, TransformNode>,
  delta: Extract<IRDelta, { type: "node-transform" }>,
): void {
  const node = entityMap.get(delta.nodeId);
  if (!node) return; // Defensive: unknown nodeId is a no-op

  if (delta.transform.position) {
    const { x, y, z } = delta.transform.position;
    node.position = new Vector3(x, y, z);
  }

  if (delta.transform.rotation) {
    const { x, y, z, w } = delta.transform.rotation;
    // CRITICAL: Always use rotationQuaternion, never rotation Euler
    node.rotationQuaternion = new Quaternion(x, y, z, w);
  }

  if (delta.transform.scale) {
    const { x, y, z } = delta.transform.scale;
    node.scaling = new Vector3(x, y, z);
  }
}

// ─── Visibility Delta ───────────────────────────────────────────────────────

function applyVisibilityDelta(
  entityMap: Map<string, TransformNode>,
  delta: Extract<IRDelta, { type: "node-visibility" }>,
): void {
  const node = entityMap.get(delta.nodeId);
  if (!node) return;

  node.setEnabled(delta.visible);
}

// ─── Component Property Delta ───────────────────────────────────────────────

/**
 * Apply a component property change to a Babylon.js node.
 *
 * The property field encodes "ComponentType:propertyPath" so we can
 * find the right component on the node and set the correct property.
 */
function applyComponentPropertyDelta(
  entityMap: Map<string, TransformNode>,
  delta: Extract<IRDelta, { type: "component-property" }>,
): void {
  const node = entityMap.get(delta.nodeId);
  if (!node) return;

  // Parse "ComponentType:propertyPath" from the property field
  const colonIdx = delta.property.indexOf(":");
  if (colonIdx === -1) return;

  const componentType = delta.property.slice(0, colonIdx);
  const propertyPath = delta.property.slice(colonIdx + 1);

  switch (componentType) {
    case "Material":
      applyMaterialProperty(node, propertyPath, delta.value);
      break;
    case "Light":
      applyLightProperty(node, propertyPath, delta.value);
      break;
    case "Camera":
      applyCameraProperty(node, propertyPath, delta.value);
      break;
    default:
      break;
  }
}

/**
 * Apply a material property change to a Babylon.js node.
 *
 * CRITICAL: Roughness is direct pass-through (NO inversion unlike PlayCanvas).
 */
function applyMaterialProperty(
  node: TransformNode,
  property: string,
  value: unknown,
): void {
  // Babylon Mesh has .material; TransformNode does not.
  // Cast to access .material (Mesh extends TransformNode).
  const mesh = node as TransformNode & { material?: PBRMetallicRoughnessMaterial };
  const material = mesh.material;
  if (!material) return;

  switch (property) {
    case "baseColor":
      if (typeof value === "string") {
        material.baseColor = hexToColor3(value);
      }
      break;
    case "metallic":
      if (typeof value === "number") {
        material.metallic = value;
      }
      break;
    case "roughness":
      // CRITICAL: Direct pass-through (NO inversion)
      if (typeof value === "number") {
        material.roughness = value;
      }
      break;
    case "emissive":
      if (typeof value === "string") {
        material.emissiveColor = hexToColor3(value);
      }
      break;
    case "opacity":
      if (typeof value === "number") {
        material.alpha = value;
      }
      break;
    default:
      break;
  }
}

/**
 * Apply a light property change to a Babylon.js light.
 *
 * Babylon lights are separate nodes (not components on the TransformNode).
 * For delta application, we access light properties via the scene's lights array.
 */
function applyLightProperty(
  _node: TransformNode,
  property: string,
  value: unknown,
): void {
  // In Babylon, lights are separate objects -- not attached to the TransformNode
  // directly. For property deltas on lights, the full rebuild path handles this
  // correctly. This is a best-effort for simple property changes.
  // Note: The light node IS the entity in our entityMap for light entities,
  // so we can cast it.
  const light = _node as unknown as {
    diffuse?: { r: number; g: number; b: number };
    intensity?: number;
    range?: number;
  };

  switch (property) {
    case "color":
      if (typeof value === "string" && light.diffuse) {
        const color = hexToColor3(value);
        light.diffuse = color;
      }
      break;
    case "intensity":
      if (typeof value === "number") {
        light.intensity = value;
      }
      break;
    case "range":
      if (typeof value === "number") {
        light.range = value;
      }
      break;
    default:
      break;
  }
}

/**
 * Apply a camera property change to a Babylon.js camera.
 *
 * CRITICAL: FOV must be converted from degrees to radians.
 */
function applyCameraProperty(
  _node: TransformNode,
  property: string,
  value: unknown,
): void {
  const camera = _node as unknown as {
    fov?: number;
    minZ?: number;
    maxZ?: number;
  };

  switch (property) {
    case "fov":
      // CRITICAL: degrees to radians conversion
      if (typeof value === "number") {
        camera.fov = value * DEG_TO_RAD;
      }
      break;
    case "nearClip":
      if (typeof value === "number") {
        camera.minZ = value;
      }
      break;
    case "farClip":
      if (typeof value === "number") {
        camera.maxZ = value;
      }
      break;
    default:
      break;
  }
}

// ─── Environment Delta ──────────────────────────────────────────────────────

/**
 * Apply an environment property change to the Babylon.js scene.
 *
 * Environment paths follow the structure:
 * - "ambientLight.color", "ambientLight.intensity"
 * - "fog.enabled", "fog.type", "fog.color", "fog.near", "fog.far", "fog.density"
 * - "skybox.color", "skybox.type"
 */
function applyEnvironmentDelta(
  scene: Scene,
  delta: Extract<IRDelta, { type: "environment" }>,
): void {
  const { path, value } = delta;

  // Ambient light
  if (path === "ambientLight.color" && typeof value === "string") {
    scene.ambientColor = hexToColor3(value);
  } else if (path === "ambientLight.intensity" && typeof value === "number") {
    // Intensity modulates ambient color; best-effort for incremental update
    const current = scene.ambientColor;
    scene.ambientColor = new Color3(current.r, current.g, current.b);
  }

  // Fog
  else if (path === "fog.enabled") {
    if (value === false) {
      scene.fogMode = Scene.FOGMODE_NONE;
    }
  } else if (path === "fog.type" && typeof value === "string") {
    switch (value) {
      case "linear":
        scene.fogMode = Scene.FOGMODE_LINEAR;
        break;
      case "exponential":
        scene.fogMode = Scene.FOGMODE_EXP;
        break;
      case "exponential2":
        scene.fogMode = Scene.FOGMODE_EXP2;
        break;
    }
  } else if (path === "fog.color" && typeof value === "string") {
    scene.fogColor = hexToColor3(value);
  } else if (path === "fog.near" && typeof value === "number") {
    scene.fogStart = value;
  } else if (path === "fog.far" && typeof value === "number") {
    scene.fogEnd = value;
  } else if (path === "fog.density" && typeof value === "number") {
    scene.fogDensity = value;
  }

  // Skybox -> clear color
  else if (path === "skybox.color" && typeof value === "string") {
    const color = hexToColor3(value);
    scene.clearColor = new Color4(color.r, color.g, color.b, 1);
  }
}
