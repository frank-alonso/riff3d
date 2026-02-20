import type { PatchOp } from "@riff3d/patchops";
import type { GlbImportResult } from "@riff3d/adapter-playcanvas";
import { generateEntityId, generateOpId } from "@riff3d/ecson";
import { CURRENT_PATCHOP_VERSION } from "@riff3d/patchops";

// ─── Helpers ──────────────────────────────────────────────────────────

function makeOp(type: string, payload: Record<string, unknown>): PatchOp {
  return {
    id: generateOpId(),
    timestamp: Date.now(),
    origin: "user",
    version: CURRENT_PATCHOP_VERSION,
    type,
    payload,
  } as PatchOp;
}

/**
 * Convert a GLB import result into a sequence of PatchOps.
 *
 * Walks the extracted GLB hierarchy and generates:
 * - CreateEntity for each node (with new ECSON entity IDs)
 * - AddComponent with MeshRenderer for mesh nodes
 * - AddComponent with Material for nodes that have materials
 *
 * The ops should be wrapped in a BatchOp for atomic dispatch.
 *
 * Material mapping from PlayCanvas StandardMaterial to ECSON:
 * - diffuse Color -> baseColor hex string
 * - metalness -> metallic
 * - gloss -> roughness (inverted: roughness = 1 - gloss)
 * - emissive Color -> emissive hex string
 * - emissiveIntensity -> emissiveIntensity
 * - opacity -> opacity
 *
 * @param importResult - The GLB import data from importGlb()
 * @param parentId - The ECSON entity ID to parent the root node(s) under
 * @returns Array of PatchOps and the root entity ID
 */
export function glbToEcsonOps(
  importResult: GlbImportResult,
  parentId: string,
): { ops: PatchOp[]; rootEntityId: string; entityCount: number; materialCount: number } {
  const { hierarchy, materials } = importResult;
  const ops: PatchOp[] = [];

  // Build ID mapping: GLB node index -> ECSON entity ID
  const idMap = new Map<number, string>();
  for (const node of hierarchy) {
    idMap.set(node.index, generateEntityId());
  }

  let entityCount = 0;

  for (const node of hierarchy) {
    const entityId = idMap.get(node.index)!;

    // Determine parent ECSON ID
    let nodeParentId: string;
    if (node.parentIndex === -1) {
      // Root node of the GLB goes under the specified parent
      nodeParentId = parentId;
    } else {
      nodeParentId = idMap.get(node.parentIndex) ?? parentId;
    }

    // CreateEntity with the node's local transform
    ops.push(
      makeOp("CreateEntity", {
        entityId,
        name: node.name,
        parentId: nodeParentId,
        transform: {
          position: node.position,
          rotation: node.rotation,
          scale: node.scale,
        },
      }),
    );
    entityCount++;

    // Add MeshRenderer for nodes that have meshes
    if (node.hasMesh) {
      ops.push(
        makeOp("AddComponent", {
          entityId,
          component: {
            type: "MeshRenderer",
            properties: {
              // GLB meshes are custom, not primitives -- use "custom" sentinel
              primitive: "custom",
              castShadows: true,
              receiveShadows: true,
            },
          },
        }),
      );

      // Add Material from the first material on this node
      if (node.materials.length > 0) {
        const mat = node.materials[0]!;
        ops.push(
          makeOp("AddComponent", {
            entityId,
            component: {
              type: "Material",
              properties: {
                baseColor: mat.baseColor,
                metallic: mat.metallic,
                roughness: mat.roughness,
                emissive: mat.emissive,
                emissiveIntensity: mat.emissiveIntensity,
                opacity: mat.opacity,
              },
            },
          }),
        );
      }
    }
  }

  // The root entity ID is the first node's mapped ID
  const rootEntityId = hierarchy.length > 0 ? idMap.get(0)! : parentId;

  return {
    ops,
    rootEntityId,
    entityCount,
    materialCount: materials.length,
  };
}
