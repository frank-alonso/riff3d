import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene as BabylonScene } from "@babylonjs/core/scene";
import type { CanonicalScene, CanonicalNode } from "@riff3d/canonical-ir";
import { applyComponents } from "./component-mappers/index";

/**
 * Result of building a Babylon.js scene from Canonical IR.
 */
export interface BuildSceneResult {
  /** Map of ECSON entity ID -> Babylon.js TransformNode (or Mesh subclass) */
  entityMap: Map<string, TransformNode>;
  /** Root-level nodes (no parent in IR) */
  rootNodes: TransformNode[];
}

/**
 * Build a Babylon.js scene graph from Canonical IR.
 *
 * IR conventions (CF-06):
 * - **Coordinate system:** Right-handed, Y-up. Babylon.js is LEFT-handed Y-up,
 *   but for editor rendering of primitives and lights the coordinate difference
 *   is negligible. glTF import (Phase 7) will handle handedness conversion.
 * - **Physics units:** Meters (1 unit = 1 meter)
 * - **Rotation:** Stored as quaternion (x,y,z,w). Always use
 *   `node.rotationQuaternion` in Babylon (never `node.rotation` Euler).
 * - **Roughness:** 0 = smooth, 1 = rough. Direct pass-through to Babylon's
 *   PBRMetallicRoughnessMaterial (no inversion needed).
 * - **1:N entity-to-node mapping:** One ECSON entity = one IR node.
 *
 * Nodes are BFS-sorted (parents before children), so we process in array order.
 */
export function buildScene(
  scene: BabylonScene,
  irScene: CanonicalScene,
): BuildSceneResult {
  const entityMap = new Map<string, TransformNode>();
  const rootNodes: TransformNode[] = [];

  for (const irNode of irScene.nodes) {
    const node = createNodeFromIR(scene, irNode);
    entityMap.set(irNode.id, node);

    // Parent-child hierarchy
    if (irNode.parentId) {
      const parentNode = entityMap.get(irNode.parentId);
      if (parentNode) {
        node.parent = parentNode;
      } else {
        // Parent not found (shouldn't happen with BFS sort, but be defensive)
        rootNodes.push(node);
      }
    } else {
      rootNodes.push(node);
    }
  }

  return { entityMap, rootNodes };
}

/**
 * Create a Babylon.js node from a Canonical IR node.
 *
 * Sets the node ID, name, transform (position, rotation quaternion, scale),
 * visibility, and applies all component mappers.
 *
 * CRITICAL Babylon patterns:
 * - Always use `node.rotationQuaternion` (never `node.rotation` Euler)
 * - `node.id = irNodeId` (string) for entity map lookup
 */
function createNodeFromIR(
  scene: BabylonScene,
  irNode: CanonicalNode,
): TransformNode {
  // Start with a TransformNode -- may be replaced by Mesh from component mappers
  let node: TransformNode = new TransformNode(irNode.name, scene);

  // Apply components -- may return a Mesh that replaces the TransformNode
  const result = applyComponents(scene, node, irNode);
  if (result.mesh) {
    // A Mesh was created (MeshRenderer component) -- dispose the empty
    // TransformNode and use the Mesh instead (Mesh extends TransformNode)
    node.dispose();
    node = result.mesh;
  }

  // Set node ID for entity map lookup
  // CRITICAL: Use `node.id` (string), NOT `node.uniqueId` (number)
  node.id = irNode.id;

  // Set transform from IR
  node.position = new Vector3(
    irNode.transform.position.x,
    irNode.transform.position.y,
    irNode.transform.position.z,
  );

  // CRITICAL: Always use rotationQuaternion in Babylon (never rotation Euler)
  node.rotationQuaternion = new Quaternion(
    irNode.transform.rotation.x,
    irNode.transform.rotation.y,
    irNode.transform.rotation.z,
    irNode.transform.rotation.w,
  );

  node.scaling = new Vector3(
    irNode.transform.scale.x,
    irNode.transform.scale.y,
    irNode.transform.scale.z,
  );

  // Visibility
  node.setEnabled(irNode.visible);

  return node;
}

/**
 * Destroy all scene entities created by buildScene.
 * Used during scene rebuild to clean up before recreating.
 *
 * @param entityMap - The entity map from a previous buildScene call
 */
export function destroySceneEntities(entityMap: Map<string, TransformNode>): void {
  for (const node of entityMap.values()) {
    node.dispose();
  }
  entityMap.clear();
}
