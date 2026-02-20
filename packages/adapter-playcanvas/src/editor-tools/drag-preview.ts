import * as pc from "playcanvas";

/**
 * Configuration for the DragPreviewManager.
 *
 * The `onDrop` callback receives the world-space position and the asset ID
 * string extracted from the drag event. The viewport component handles
 * converting this into PatchOps (CreateEntity + AddComponent + SetProperty).
 *
 * IMPORTANT: This module does NOT import editor-app modules (e.g. ASSET_DRAG_MIME,
 * asset-manager). The editor layer is responsible for extracting the asset ID
 * from the DragEvent and passing it through. This preserves the dependency
 * boundary: editor depends on adapter, not vice versa.
 */
export interface DragPreviewConfig {
  app: pc.Application;
  camera: pc.Entity;
  canvas: HTMLCanvasElement;
  onDrop: (position: { x: number; y: number; z: number }, assetId: string) => void;
}

/**
 * Manages a translucent "ghost" entity during drag-and-drop asset placement.
 *
 * When an asset is dragged over the viewport canvas:
 * 1. `startPreview` creates a translucent box entity at the cursor position
 * 2. `updatePreview` moves the ghost using Y=0 ground plane raycasting
 * 3. `endPreview` removes the ghost (on drag leave)
 * 4. `confirmDrop` removes the ghost and calls the onDrop callback (on drop)
 *
 * Ground plane raycasting (Y=0 mathematical intersection):
 * Converts screen coordinates to a 3D ray via camera projection, then
 * computes the ray-plane intersection with the Y=0 ground plane. No physics
 * engine dependency -- purely mathematical.
 *
 * TODO Phase 7: When physics raycasting is available, the ghost can snap to
 * surface normals. For now, ghost always aligns to world up (Y-axis).
 */
export class DragPreviewManager {
  private readonly app: pc.Application;
  private readonly camera: pc.Entity;
  private readonly canvas: HTMLCanvasElement;
  private readonly onDrop: DragPreviewConfig["onDrop"];

  private ghostEntity: pc.Entity | null = null;
  private ghostMaterial: pc.StandardMaterial | null = null;
  private currentAssetId: string | null = null;

  /** Default distance along ray when no ground intersection exists (camera facing up). */
  private static readonly FALLBACK_DISTANCE = 5;

  constructor(config: DragPreviewConfig) {
    this.app = config.app;
    this.camera = config.camera;
    this.canvas = config.canvas;
    this.onDrop = config.onDrop;
  }

  /**
   * Create the translucent ghost entity. Called when a drag enters the canvas.
   *
   * @param assetId - The asset identifier from the drag data (parsed by the editor layer)
   * @param screenX - Mouse X position relative to the canvas
   * @param screenY - Mouse Y position relative to the canvas
   */
  startPreview(assetId: string, screenX: number, screenY: number): void {
    // Clean up any stale ghost from a previous drag
    this.cleanupGhost();

    this.currentAssetId = assetId;

    // Create ghost entity with a box render component (default preview shape)
    this.ghostEntity = new pc.Entity("__drag_preview_ghost__");
    this.ghostEntity.addComponent("render", { type: "box" });

    // Create translucent material
    this.ghostMaterial = new pc.StandardMaterial();
    this.ghostMaterial.opacity = 0.5;
    this.ghostMaterial.blendType = pc.BLEND_NORMAL;
    // Light blue emissive tint for visibility
    this.ghostMaterial.emissive.set(0.3, 0.6, 0.9);
    this.ghostMaterial.emissiveIntensity = 1;
    this.ghostMaterial.update();

    // Apply material to all mesh instances
    if (this.ghostEntity.render) {
      for (const mi of this.ghostEntity.render.meshInstances) {
        mi.material = this.ghostMaterial;
      }
    }

    // Add to app root as a temporary child (NOT in ECSON entity map)
    this.app.root.addChild(this.ghostEntity);

    // Position the ghost at the initial cursor location
    const pos = this.screenToGroundPlane(screenX, screenY);
    this.ghostEntity.setPosition(pos.x, pos.y, pos.z);
  }

  /**
   * Update the ghost entity position. Called on dragover to follow cursor.
   *
   * @param screenX - Mouse X position relative to the canvas
   * @param screenY - Mouse Y position relative to the canvas
   */
  updatePreview(screenX: number, screenY: number): void {
    if (!this.ghostEntity) return;

    const pos = this.screenToGroundPlane(screenX, screenY);
    this.ghostEntity.setPosition(pos.x, pos.y, pos.z);
  }

  /**
   * Cancel the drag preview and destroy the ghost. Called on drag leave.
   */
  endPreview(): void {
    this.cleanupGhost();
    this.currentAssetId = null;
  }

  /**
   * Confirm the drop: invoke the onDrop callback with final position, then clean up.
   *
   * @param screenX - Mouse X position relative to the canvas
   * @param screenY - Mouse Y position relative to the canvas
   */
  confirmDrop(screenX: number, screenY: number): void {
    if (!this.currentAssetId) return;

    const pos = this.screenToGroundPlane(screenX, screenY);
    const assetId = this.currentAssetId;

    this.cleanupGhost();
    this.currentAssetId = null;

    this.onDrop(pos, assetId);
  }

  /**
   * Clean up all resources. Called when the adapter is disposed.
   */
  dispose(): void {
    this.cleanupGhost();
    this.currentAssetId = null;
  }

  /**
   * Compute the Y=0 ground plane intersection from screen coordinates.
   *
   * Algorithm:
   * 1. Convert screen position to near/far 3D points via camera projection
   * 2. Compute ray direction (far - near), normalize
   * 3. Calculate t = -near.y / direction.y for Y=0 plane intersection
   * 4. If t > 0, return the intersection point
   * 5. If t <= 0 (camera looking away from ground), place at a fixed distance
   *
   * @param screenX - X coordinate in screen pixels
   * @param screenY - Y coordinate in screen pixels
   * @returns World-space position {x, y, z}
   */
  screenToGroundPlane(screenX: number, screenY: number): { x: number; y: number; z: number } {
    const cameraComponent = this.camera.camera;
    if (!cameraComponent) {
      return { x: 0, y: 0, z: 0 };
    }

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    // Get near and far points from camera projection
    const nearPoint = new pc.Vec3();
    const farPoint = new pc.Vec3();
    cameraComponent.screenToWorld(screenX, screenY, cameraComponent.nearClip ?? 0.1, nearPoint);
    cameraComponent.screenToWorld(screenX, screenY, cameraComponent.farClip ?? 1000, farPoint);

    // Ray direction = far - near
    const direction = new pc.Vec3();
    direction.sub2(farPoint, nearPoint);
    direction.normalize();

    // Y=0 plane intersection: t = -near.y / direction.y
    if (Math.abs(direction.y) > 1e-6) {
      const t = -nearPoint.y / direction.y;
      if (t > 0) {
        // Intersection in front of camera
        return {
          x: nearPoint.x + direction.x * t,
          y: 0,
          z: nearPoint.z + direction.z * t,
        };
      }
    }

    // Fallback: no ground intersection (camera looking up or parallel to ground)
    // Place the ghost at a fixed distance along the ray
    const fallback = DragPreviewManager.FALLBACK_DISTANCE;
    return {
      x: nearPoint.x + direction.x * fallback,
      y: nearPoint.y + direction.y * fallback,
      z: nearPoint.z + direction.z * fallback,
    };
  }

  // ─── Private ────────────────────────────────────────────────────────

  private cleanupGhost(): void {
    if (this.ghostEntity) {
      this.ghostEntity.destroy();
      this.ghostEntity = null;
    }
    if (this.ghostMaterial) {
      this.ghostMaterial.destroy();
      this.ghostMaterial = null;
    }
  }
}
