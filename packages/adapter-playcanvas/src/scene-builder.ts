import * as pc from "playcanvas";
import type { CanonicalScene, CanonicalNode } from "@riff3d/canonical-ir";
import { applyComponents } from "./component-mappers/index";

/**
 * Result of building a PlayCanvas scene from Canonical IR.
 */
export interface BuildSceneResult {
  /** Map of ECSON entity ID -> PlayCanvas Entity */
  entityMap: Map<string, pc.Entity>;
  /** Root-level entities added to app.root */
  rootEntities: pc.Entity[];
}

/**
 * Build a PlayCanvas scene graph from Canonical IR.
 *
 * IR conventions documented per CF-06:
 * - **Coordinate system:** Right-handed, Y-up (matches PlayCanvas native)
 * - **Physics units:** Meters (1 unit = 1 meter)
 * - **Rotation:** Stored as quaternion (x,y,z,w) in IR. PlayCanvas entities
 *   accept quaternions directly via setLocalRotation().
 * - **Roughness:** 0 = smooth, 1 = rough. PlayCanvas uses gloss (inverted).
 *   Conversion handled in material mapper.
 * - **1:N entity-to-node mapping:** One ECSON entity compiles to one IR node.
 *   The IR nodes array is BFS-sorted (parents before children), so we can
 *   process nodes in array order and parents will always exist in entityMap
 *   before their children.
 *
 * @param app - The PlayCanvas Application instance
 * @param scene - The Canonical IR scene to build
 * @returns Entity map and root entity list
 */
export function buildScene(
  app: pc.Application,
  scene: CanonicalScene,
): BuildSceneResult {
  const entityMap = new Map<string, pc.Entity>();
  const rootEntities: pc.Entity[] = [];

  // Nodes are BFS-sorted: parents before children.
  // This guarantees the parent entity exists in entityMap when we process a child.
  for (const node of scene.nodes) {
    const entity = createEntityFromNode(app, node);
    entityMap.set(node.id, entity);

    // Reparent under parent or add to app.root
    if (node.parentId) {
      const parent = entityMap.get(node.parentId);
      if (parent) {
        parent.addChild(entity);
      } else {
        // Parent not found (shouldn't happen with BFS sort, but be defensive)
        app.root.addChild(entity);
        rootEntities.push(entity);
      }
    } else {
      // Root node
      app.root.addChild(entity);
      rootEntities.push(entity);
    }
  }

  return { entityMap, rootEntities };
}

/**
 * Create a PlayCanvas Entity from a Canonical IR node.
 *
 * Sets the entity name, transform (position, rotation, scale),
 * visibility, and applies all component mappers.
 */
function createEntityFromNode(
  app: pc.Application,
  node: CanonicalNode,
): pc.Entity {
  const entity = new pc.Entity(node.name);

  // Set transform from IR
  // IR stores position as {x,y,z} and rotation as quaternion {x,y,z,w}
  entity.setLocalPosition(
    node.transform.position.x,
    node.transform.position.y,
    node.transform.position.z,
  );

  // PlayCanvas Entity.setLocalRotation accepts quaternion components directly
  entity.setLocalRotation(
    node.transform.rotation.x,
    node.transform.rotation.y,
    node.transform.rotation.z,
    node.transform.rotation.w,
  );

  entity.setLocalScale(
    node.transform.scale.x,
    node.transform.scale.y,
    node.transform.scale.z,
  );

  // Visibility
  entity.enabled = node.visible;

  // Apply components (MeshRenderer, Light, Camera, etc.)
  applyComponents(app, entity, node);

  return entity;
}

/**
 * Destroy all scene entities created by buildScene.
 * Used during scene rebuild to clean up before recreating.
 *
 * @param entityMap - The entity map from a previous buildScene call
 */
export function destroySceneEntities(entityMap: Map<string, pc.Entity>): void {
  for (const entity of entityMap.values()) {
    // Only destroy if still in the scene graph and not already destroyed
    if (entity.parent) {
      entity.destroy();
    }
  }
  entityMap.clear();
}
