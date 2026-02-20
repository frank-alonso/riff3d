/**
 * PatchOp to IRDelta mapper.
 *
 * Examines a PatchOp and returns an IRDelta if the change can be applied
 * incrementally (O(1)) by the adapter, or { type: "full-rebuild" } if
 * a full scene rebuild is needed.
 *
 * This function accepts a simplified PatchOp shape ({ type, payload })
 * to avoid adding @riff3d/patchops as a dependency of canonical-ir.
 * The function only reads .type and .payload fields.
 *
 * Mapping rules:
 * - SetProperty with transform path -> node-transform delta
 * - SetProperty with "visible" path -> node-visibility delta
 * - SetProperty with "environment.*" path -> environment delta
 * - SetComponentProperty -> component-property delta
 * - Structural ops (Create/Delete/Reparent/AddComponent/RemoveComponent) -> full-rebuild
 * - BatchOp -> full-rebuild (batches are structural by convention)
 * - Unknown op types -> full-rebuild (safe fallback)
 */
import type { IRDelta } from "./types/ir-delta";

/** Minimal PatchOp shape -- avoids importing @riff3d/patchops. */
interface PatchOpLike {
  type: string;
  payload: Record<string, unknown>;
}

/**
 * Map a PatchOp to an IRDelta for incremental adapter updates.
 *
 * @param op - A PatchOp (or any object with { type, payload })
 * @returns An IRDelta describing the minimal engine update needed
 */
export function computeDelta(op: PatchOpLike): IRDelta {
  switch (op.type) {
    case "SetProperty":
      return computeSetPropertyDelta(op.payload);

    case "SetComponentProperty":
      return computeSetComponentPropertyDelta(op.payload);

    // Structural ops always require full rebuild
    case "CreateEntity":
    case "DeleteEntity":
    case "Reparent":
    case "AddComponent":
    case "RemoveComponent":
    case "AddChild":
    case "RemoveChild":
    case "BatchOp":
    case "AddAsset":
    case "RemoveAsset":
    case "ReplaceAssetRef":
    case "AddKeyframe":
    case "RemoveKeyframe":
    case "SetKeyframeValue":
      return { type: "full-rebuild" };

    default:
      // Unknown op type -- safe fallback to full rebuild
      return { type: "full-rebuild" };
  }
}

/**
 * Map a SetProperty op payload to an IRDelta.
 *
 * SetProperty covers:
 * - transform.position / transform.rotation / transform.scale -> node-transform
 * - visible -> node-visibility
 * - environment.* -> environment delta
 * - anything else -> full-rebuild (unknown property path)
 */
function computeSetPropertyDelta(payload: Record<string, unknown>): IRDelta {
  const entityId = payload["entityId"] as string;
  const path = payload["path"] as string;
  const value = payload["value"];

  // Transform properties
  if (path === "transform.position") {
    return {
      type: "node-transform",
      nodeId: entityId,
      transform: { position: value as { x: number; y: number; z: number } },
    };
  }

  if (path === "transform.rotation") {
    return {
      type: "node-transform",
      nodeId: entityId,
      transform: {
        rotation: value as { x: number; y: number; z: number; w: number },
      },
    };
  }

  if (path === "transform.scale") {
    return {
      type: "node-transform",
      nodeId: entityId,
      transform: { scale: value as { x: number; y: number; z: number } },
    };
  }

  // Visibility
  if (path === "visible") {
    return {
      type: "node-visibility",
      nodeId: entityId,
      visible: value as boolean,
    };
  }

  // Environment properties (entityId is "__environment__" for these)
  if (path.startsWith("environment.")) {
    const envPath = path.slice("environment.".length);
    return {
      type: "environment",
      path: envPath,
      value,
    };
  }

  // Unknown path -- fall back to full rebuild
  return { type: "full-rebuild" };
}

/**
 * Map a SetComponentProperty op payload to an IRDelta.
 *
 * The payload contains:
 * - entityId: the entity owning the component
 * - componentType: "Material" | "Light" | "Camera" | "MeshRenderer" etc.
 * - propertyPath: the property within the component
 * - value: the new value
 *
 * The componentIndex is derived by finding the component by type in the
 * entity's components array. Since we don't have the entity data here,
 * we pass componentType as-is and let the adapter resolve the index.
 * For the IRDelta, we encode componentType in the property field using
 * the format "componentType.propertyPath" and set componentIndex to -1
 * as a sentinel (adapter uses componentType for lookup).
 *
 * Actually, the IRDelta schema uses componentIndex (number) + property (string).
 * Since we don't have the ECSON doc here to resolve the index, we'll
 * use a convention: encode the component type in the delta by using
 * componentIndex = 0 (first component of that type -- which is the
 * common case), and prefix the property with the componentType so the
 * adapter can find the right component.
 *
 * Simpler approach: The adapter already has the entity map. We pass
 * componentType as part of the property string using the format
 * "ComponentType:propertyPath". The adapter parses this.
 */
function computeSetComponentPropertyDelta(
  payload: Record<string, unknown>,
): IRDelta {
  const entityId = payload["entityId"] as string;
  const componentType = payload["componentType"] as string;
  const propertyPath = payload["propertyPath"] as string;
  const value = payload["value"];

  return {
    type: "component-property",
    nodeId: entityId,
    // Encode componentType in componentIndex: we use 0 as placeholder.
    // The property string carries the full resolution info.
    componentIndex: 0,
    property: `${componentType}:${propertyPath}`,
    value,
  };
}
