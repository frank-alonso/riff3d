import * as pc from "playcanvas";

/**
 * Lock info for a single entity.
 */
interface LockVisual {
  color: string;
}

/**
 * Renders colored wireframe bounding boxes around locked entities
 * in the 3D viewport.
 *
 * Uses PlayCanvas `app.drawLines()` immediate-mode API to draw
 * 12 edges of an AABB (axis-aligned bounding box) per locked entity.
 * This approach avoids modifying entity materials (simpler and
 * non-destructive) and matches the grid's immediate-mode pattern.
 *
 * The renderer is updated each frame via the `update` event.
 * It reads the current lock map and draws wireframes for any
 * entities found in the entity map.
 */
export class LockRenderer {
  private app: pc.Application;
  private entityMap: Map<string, pc.Entity>;
  private lockMap: Map<string, LockVisual> = new Map();
  private updateHandler: (() => void) | null = null;
  private disposed = false;

  constructor(app: pc.Application, entityMap: Map<string, pc.Entity>) {
    this.app = app;
    this.entityMap = entityMap;

    // Register per-frame draw callback
    this.updateHandler = () => this.draw();
    this.app.on("update", this.updateHandler);
  }

  /**
   * Update the set of locked entities to render.
   * Call this whenever lock state changes.
   *
   * @param lockedEntities - Map of entity ID to lock visual info (color)
   */
  updateLocks(lockedEntities: Map<string, LockVisual>): void {
    this.lockMap = lockedEntities;
  }

  /**
   * Update the entity map reference (e.g., after scene rebuild).
   */
  updateEntityMap(entityMap: Map<string, pc.Entity>): void {
    this.entityMap = entityMap;
  }

  /**
   * Draw wireframe bounding boxes for all locked entities.
   * Called every frame via the "update" event.
   */
  private draw(): void {
    if (this.disposed || this.lockMap.size === 0) return;

    for (const [entityId, visual] of this.lockMap) {
      const pcEntity = this.entityMap.get(entityId);
      if (!pcEntity) continue;

      // Get the world-space AABB of the entity.
      // Try render components first (mesh), then fall back to a small box at position.
      const aabb = this.getEntityAABB(pcEntity);
      if (!aabb) continue;

      const color = this.parseColor(visual.color);
      this.drawWireframeBox(aabb, color);
    }
  }

  /**
   * Get the AABB for an entity. Tries render component first,
   * then falls back to a small box at the entity's world position.
   */
  private getEntityAABB(entity: pc.Entity): pc.BoundingBox | null {
    // Check for render component (mesh)
    const render = entity.render;
    if (render?.meshInstances && render.meshInstances.length > 0) {
      // Combine all mesh instance AABBs
      const combined = new pc.BoundingBox();
      let first = true;
      for (const mi of render.meshInstances) {
        if (first) {
          combined.copy(mi.aabb);
          first = false;
        } else {
          combined.add(mi.aabb);
        }
      }
      return combined;
    }

    // Check for light component -- use a small box
    if (entity.light) {
      const pos = entity.getPosition();
      return new pc.BoundingBox(
        new pc.Vec3(pos.x, pos.y, pos.z),
        new pc.Vec3(0.3, 0.3, 0.3),
      );
    }

    // Fallback: small box at entity position
    const pos = entity.getPosition();
    return new pc.BoundingBox(
      new pc.Vec3(pos.x, pos.y, pos.z),
      new pc.Vec3(0.2, 0.2, 0.2),
    );
  }

  /**
   * Parse a CSS color string (hex) to a PlayCanvas Color.
   * Uses reduced alpha for subtlety.
   */
  private parseColor(cssColor: string): pc.Color {
    // Parse hex color (#RRGGBB or #RGB)
    let hex = cssColor.replace("#", "");
    if (hex.length === 3) {
      hex = hex[0]! + hex[0]! + hex[1]! + hex[1]! + hex[2]! + hex[2]!;
    }
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    return new pc.Color(r, g, b, 0.6);
  }

  /**
   * Draw 12 wireframe edges of an AABB using app.drawLines().
   * Uses Vec3[] positions and a single Color (uniform color for all lines).
   */
  private drawWireframeBox(aabb: pc.BoundingBox, color: pc.Color): void {
    const min = aabb.getMin();
    const max = aabb.getMax();

    // 8 corners of the box
    const corners = [
      new pc.Vec3(min.x, min.y, min.z), // 0: front-bottom-left
      new pc.Vec3(max.x, min.y, min.z), // 1: front-bottom-right
      new pc.Vec3(max.x, max.y, min.z), // 2: front-top-right
      new pc.Vec3(min.x, max.y, min.z), // 3: front-top-left
      new pc.Vec3(min.x, min.y, max.z), // 4: back-bottom-left
      new pc.Vec3(max.x, min.y, max.z), // 5: back-bottom-right
      new pc.Vec3(max.x, max.y, max.z), // 6: back-top-right
      new pc.Vec3(min.x, max.y, max.z), // 7: back-top-left
    ];

    // 12 edges as pairs of Vec3 positions
    const edges: [number, number][] = [
      // Front face
      [0, 1], [1, 2], [2, 3], [3, 0],
      // Back face
      [4, 5], [5, 6], [6, 7], [7, 4],
      // Connecting edges
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];

    // Build line positions array (pairs of Vec3 for each line segment)
    const positions: pc.Vec3[] = [];

    for (const [a, b] of edges) {
      positions.push(corners[a]!);
      positions.push(corners[b]!);
    }

    this.app.drawLines(positions, color);
  }

  /**
   * Clean up: remove update handler.
   */
  dispose(): void {
    this.disposed = true;
    if (this.updateHandler) {
      this.app.off("update", this.updateHandler);
      this.updateHandler = null;
    }
    this.lockMap.clear();
  }
}
