import type { SceneDocument } from "@riff3d/ecson";
import type { PatchOp } from "./schemas";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Pre-apply validation for a PatchOp against a SceneDocument.
 *
 * Checks:
 * - Entity existence (for ops that reference entities)
 * - Entity non-existence (for CreateEntity)
 * - Circular reparent detection (walk ancestor chain)
 * - Component existence checks
 * - Asset existence checks
 */
export function validateOp(doc: SceneDocument, op: PatchOp): ValidationResult {
  switch (op.type) {
    case "CreateEntity": {
      const { entityId } = op.payload;
      if (doc.entities[entityId] !== undefined) {
        return { valid: false, error: `Entity '${entityId}' already exists` };
      }
      return { valid: true };
    }

    case "DeleteEntity": {
      const { entityId } = op.payload;
      if (doc.entities[entityId] === undefined) {
        return { valid: false, error: `Entity '${entityId}' does not exist` };
      }
      const entity = doc.entities[entityId]!;
      if (entity.children.length > 0) {
        return {
          valid: false,
          error: `Entity '${entityId}' has children. Remove children before deleting.`,
        };
      }
      return { valid: true };
    }

    case "SetProperty": {
      const { entityId, path } = op.payload;
      // Special __environment__ entity targets doc.environment.* only
      if (entityId === "__environment__") {
        if (!path.startsWith("environment.")) {
          return {
            valid: false,
            error: `__environment__ entity only allows paths starting with "environment.", got "${path}"`,
          };
        }
        return { valid: true };
      }
      if (doc.entities[entityId] === undefined) {
        return { valid: false, error: `Entity '${entityId}' does not exist` };
      }
      return { valid: true };
    }

    case "AddComponent":
    case "RemoveComponent":
    case "SetComponentProperty":
    case "ReplaceAssetRef":
    case "AddKeyframe":
    case "RemoveKeyframe":
    case "SetKeyframeValue": {
      const { entityId } = op.payload;
      if (doc.entities[entityId] === undefined) {
        return { valid: false, error: `Entity '${entityId}' does not exist` };
      }
      return { valid: true };
    }

    case "AddChild": {
      const { parentId, childId } = op.payload;
      if (doc.entities[parentId] === undefined) {
        return { valid: false, error: `Parent entity '${parentId}' does not exist` };
      }
      if (doc.entities[childId] === undefined) {
        return { valid: false, error: `Child entity '${childId}' does not exist` };
      }
      return { valid: true };
    }

    case "RemoveChild": {
      const { parentId } = op.payload;
      if (doc.entities[parentId] === undefined) {
        return { valid: false, error: `Parent entity '${parentId}' does not exist` };
      }
      return { valid: true };
    }

    case "Reparent": {
      const { entityId, newParentId } = op.payload;
      if (doc.entities[entityId] === undefined) {
        return { valid: false, error: `Entity '${entityId}' does not exist` };
      }
      if (newParentId !== null && doc.entities[newParentId] === undefined) {
        return { valid: false, error: `New parent '${newParentId}' does not exist` };
      }
      // Circular reparent check: walk up from newParentId to root.
      // If we encounter entityId on the way, it's circular.
      if (newParentId !== null) {
        let current: string | null = newParentId;
        while (current !== null) {
          if (current === entityId) {
            return {
              valid: false,
              error: `Circular reparent: '${entityId}' is an ancestor of '${newParentId}'`,
            };
          }
          const ent: { parentId: string | null } | undefined = doc.entities[current];
          if (ent === undefined) break;
          current = ent.parentId;
        }
      }
      return { valid: true };
    }

    case "AddAsset": {
      const { asset } = op.payload;
      if (doc.assets[asset.id] !== undefined) {
        return { valid: false, error: `Asset '${asset.id}' already exists` };
      }
      return { valid: true };
    }

    case "RemoveAsset": {
      const { assetId } = op.payload;
      if (doc.assets[assetId] === undefined) {
        return { valid: false, error: `Asset '${assetId}' does not exist` };
      }
      return { valid: true };
    }

    case "BatchOp": {
      // BatchOp sub-ops are validated individually during apply
      return { valid: true };
    }

    default: {
      const _exhaustive: never = op;
      return { valid: false, error: `Unknown op type: ${(op as PatchOp).type}` };
    }
  }
}
