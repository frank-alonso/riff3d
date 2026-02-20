import * as pc from "playcanvas";

/**
 * Gizmo mode types matching the editor store.
 */
export type GizmoMode = "translate" | "rotate" | "scale";

/**
 * Store interface expected by GizmoManager.
 *
 * This is a minimal interface to avoid coupling the adapter package
 * to the full editor store type. The adapter package should not
 * import from @riff3d/editor.
 */
export interface GizmoStoreApi {
  getState(): {
    gizmoMode: GizmoMode;
    selectedEntityIds: string[];
    snapEnabled: boolean;
    gridSize: number;
    rotationSnap: number;
  };
  subscribe(listener: (state: {
    gizmoMode: GizmoMode;
    selectedEntityIds: string[];
    snapEnabled: boolean;
    gridSize: number;
    rotationSnap: number;
  }, prevState: {
    gizmoMode: GizmoMode;
    selectedEntityIds: string[];
    snapEnabled: boolean;
    gridSize: number;
    rotationSnap: number;
  }) => void): () => void;
}

/**
 * Callback for dispatching PatchOps when a gizmo transform ends.
 * Called with entity ID, property path, new value, and previous value.
 */
export type DispatchTransformCallback = (
  entityId: string,
  path: string,
  value: { x: number; y: number; z: number; w?: number },
  previousValue: { x: number; y: number; z: number; w?: number },
) => void;

/**
 * GizmoManager manages PlayCanvas TranslateGizmo, RotateGizmo, ScaleGizmo lifecycle.
 *
 * Key responsibilities:
 * - Creates and manages all three gizmo types with a shared gizmo layer
 * - Subscribes to editorStore for gizmo mode, selection, and snap changes
 * - Captures transform state on transform:start and creates PatchOps on transform:end
 * - Ensures one PatchOp per drag gesture (not one per frame)
 *
 * CRITICAL: The gizmo manager creates PatchOps on transform:end, not during drag.
 * During drag, PlayCanvas updates entity transforms directly for visual feedback.
 * On drag end, we capture the final values and dispatch a SetProperty PatchOp.
 *
 * RGB axes convention: red=X, green=Y, blue=Z (PlayCanvas default).
 */
export class GizmoManager {
  private app: pc.Application;
  private cameraEntity: pc.Entity;
  private entityMap: Map<string, pc.Entity>;
  private dispatchTransform: DispatchTransformCallback;

  private gizmoLayer: pc.Layer | null = null;
  private translateGizmo: pc.TranslateGizmo | null = null;
  private rotateGizmo: pc.RotateGizmo | null = null;
  private scaleGizmo: pc.ScaleGizmo | null = null;
  private activeGizmo: pc.TranslateGizmo | pc.RotateGizmo | pc.ScaleGizmo | null = null;
  private currentMode: GizmoMode = "translate";

  private unsubscribers: Array<() => void> = [];

  /**
   * Stored transform values at the start of a drag gesture.
   * Key: entity ECSON ID -> { position, rotation, scale }
   */
  private previousTransforms = new Map<string, {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
    scale: { x: number; y: number; z: number };
  }>();

  /** Currently attached ECSON entity IDs. */
  private attachedEntityIds: string[] = [];

  constructor(
    app: pc.Application,
    cameraEntity: pc.Entity,
    entityMap: Map<string, pc.Entity>,
    dispatchTransform: DispatchTransformCallback,
  ) {
    this.app = app;
    this.cameraEntity = cameraEntity;
    this.entityMap = entityMap;
    this.dispatchTransform = dispatchTransform;
  }

  /**
   * Initialize gizmos and subscribe to store changes.
   *
   * @param store - The editor store API for subscribing to state changes
   */
  initialize(store: GizmoStoreApi): void {
    const camera = this.cameraEntity.camera;
    if (!camera) return;

    // Create gizmo rendering layer
    this.gizmoLayer = pc.Gizmo.createLayer(this.app);

    // Create all three gizmo types
    this.translateGizmo = new pc.TranslateGizmo(camera, this.gizmoLayer);
    this.rotateGizmo = new pc.RotateGizmo(camera, this.gizmoLayer);
    this.scaleGizmo = new pc.ScaleGizmo(camera, this.gizmoLayer);

    // Wire up transform events for all gizmos
    this.wireGizmoEvents(this.translateGizmo, "translate");
    this.wireGizmoEvents(this.rotateGizmo, "rotate");
    this.wireGizmoEvents(this.scaleGizmo, "scale");

    // Set initial state from store
    const state = store.getState();
    this.currentMode = state.gizmoMode;
    this.setActiveGizmo(state.gizmoMode);
    this.updateSnap(state.snapEnabled, state.gridSize, state.rotationSnap);

    // Subscribe to store changes
    const unsub = store.subscribe((newState, prevState) => {
      // Gizmo mode changed
      if (newState.gizmoMode !== prevState.gizmoMode) {
        this.switchGizmo(newState.gizmoMode);
      }

      // Selection changed
      if (newState.selectedEntityIds !== prevState.selectedEntityIds) {
        this.attachToEntities(newState.selectedEntityIds);
      }

      // Snap settings changed
      if (
        newState.snapEnabled !== prevState.snapEnabled ||
        newState.gridSize !== prevState.gridSize ||
        newState.rotationSnap !== prevState.rotationSnap
      ) {
        this.updateSnap(newState.snapEnabled, newState.gridSize, newState.rotationSnap);
      }
    });
    this.unsubscribers.push(unsub);

    // Attach to currently selected entities (if any)
    if (state.selectedEntityIds.length > 0) {
      this.attachToEntities(state.selectedEntityIds);
    }
  }

  /**
   * Wire transform:start and transform:end events for a gizmo.
   */
  private wireGizmoEvents(
    gizmo: pc.TranslateGizmo | pc.RotateGizmo | pc.ScaleGizmo,
    mode: GizmoMode,
  ): void {
    gizmo.on("transform:start", () => {
      this.captureTransformState();
    });

    gizmo.on("transform:end", () => {
      this.emitTransformOps(mode);
    });
  }

  /**
   * Capture current transform values of all attached entities.
   * Called on transform:start to record "before" state.
   */
  private captureTransformState(): void {
    this.previousTransforms.clear();
    for (const entityId of this.attachedEntityIds) {
      const pcEntity = this.entityMap.get(entityId);
      if (!pcEntity) continue;

      const pos = pcEntity.getLocalPosition();
      const rot = pcEntity.getLocalRotation();
      const scl = pcEntity.getLocalScale();

      this.previousTransforms.set(entityId, {
        position: { x: pos.x, y: pos.y, z: pos.z },
        rotation: { x: rot.x, y: rot.y, z: rot.z, w: rot.w },
        scale: { x: scl.x, y: scl.y, z: scl.z },
      });
    }
  }

  /**
   * Emit PatchOps for all attached entities after transform ends.
   * Creates one SetProperty PatchOp per entity per affected transform property.
   */
  private emitTransformOps(mode: GizmoMode): void {
    for (const entityId of this.attachedEntityIds) {
      const pcEntity = this.entityMap.get(entityId);
      const prev = this.previousTransforms.get(entityId);
      if (!pcEntity || !prev) continue;

      const pos = pcEntity.getLocalPosition();
      const rot = pcEntity.getLocalRotation();
      const scl = pcEntity.getLocalScale();

      if (mode === "translate") {
        const newPos = { x: pos.x, y: pos.y, z: pos.z };
        if (!vec3Equal(newPos, prev.position)) {
          this.dispatchTransform(entityId, "transform.position", newPos, prev.position);
        }
      } else if (mode === "rotate") {
        const newRot = { x: rot.x, y: rot.y, z: rot.z, w: rot.w };
        if (!quatEqual(newRot, prev.rotation)) {
          this.dispatchTransform(entityId, "transform.rotation", newRot, prev.rotation);
        }
      } else if (mode === "scale") {
        const newScl = { x: scl.x, y: scl.y, z: scl.z };
        if (!vec3Equal(newScl, prev.scale)) {
          this.dispatchTransform(entityId, "transform.scale", newScl, prev.scale);
        }
      }
    }

    this.previousTransforms.clear();
  }

  /**
   * Switch to a different gizmo mode.
   * Detaches current gizmo, activates new one, re-attaches to selected entities.
   */
  switchGizmo(mode: GizmoMode): void {
    if (mode === this.currentMode) return;

    // Detach current
    this.activeGizmo?.detach();

    this.currentMode = mode;
    this.setActiveGizmo(mode);

    // Re-attach to currently selected entities
    if (this.attachedEntityIds.length > 0) {
      this.attachToEntities(this.attachedEntityIds);
    }
  }

  /**
   * Set the active gizmo based on mode.
   */
  private setActiveGizmo(mode: GizmoMode): void {
    switch (mode) {
      case "translate":
        this.activeGizmo = this.translateGizmo;
        break;
      case "rotate":
        this.activeGizmo = this.rotateGizmo;
        break;
      case "scale":
        this.activeGizmo = this.scaleGizmo;
        break;
    }
  }

  /**
   * Attach the active gizmo to the specified entities.
   * Looks up PlayCanvas entities from the entity map.
   */
  attachToEntities(entityIds: string[]): void {
    // Detach current gizmo
    this.activeGizmo?.detach();
    this.attachedEntityIds = entityIds;

    if (entityIds.length === 0 || !this.activeGizmo) return;

    // Resolve PlayCanvas entities from ECSON IDs
    const pcEntities: pc.GraphNode[] = [];
    for (const id of entityIds) {
      const pcEntity = this.entityMap.get(id);
      if (pcEntity) {
        pcEntities.push(pcEntity);
      }
    }

    if (pcEntities.length > 0) {
      this.activeGizmo.attach(pcEntities);
    }
  }

  /**
   * Update snap settings on all gizmos.
   */
  updateSnap(enabled: boolean, gridSize: number, rotationSnap: number): void {
    const gizmos = [this.translateGizmo, this.rotateGizmo, this.scaleGizmo];
    for (const gizmo of gizmos) {
      if (!gizmo) continue;
      gizmo.snap = enabled;
      // For rotate gizmo, snap increment is in degrees
      if (gizmo === this.rotateGizmo) {
        gizmo.snapIncrement = rotationSnap;
      } else {
        gizmo.snapIncrement = gridSize;
      }
    }
  }

  /**
   * Update the entity map reference (called after scene rebuild).
   */
  updateEntityMap(entityMap: Map<string, pc.Entity>): void {
    this.entityMap = entityMap;
    // Re-attach to current selection with new entity references
    if (this.attachedEntityIds.length > 0) {
      this.attachToEntities(this.attachedEntityIds);
    }
  }

  /**
   * Destroy all gizmos and unsubscribe from store.
   */
  dispose(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];

    this.translateGizmo?.destroy();
    this.rotateGizmo?.destroy();
    this.scaleGizmo?.destroy();

    this.translateGizmo = null;
    this.rotateGizmo = null;
    this.scaleGizmo = null;
    this.activeGizmo = null;
    this.gizmoLayer = null;
    this.previousTransforms.clear();
    this.attachedEntityIds = [];
  }
}

/** Epsilon for floating-point comparison. */
const EPSILON = 1e-6;

/** Compare two Vec3-like objects for equality. */
function vec3Equal(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): boolean {
  return (
    Math.abs(a.x - b.x) < EPSILON &&
    Math.abs(a.y - b.y) < EPSILON &&
    Math.abs(a.z - b.z) < EPSILON
  );
}

/** Compare two quaternion-like objects for equality. */
function quatEqual(
  a: { x: number; y: number; z: number; w: number },
  b: { x: number; y: number; z: number; w: number },
): boolean {
  return (
    Math.abs(a.x - b.x) < EPSILON &&
    Math.abs(a.y - b.y) < EPSILON &&
    Math.abs(a.z - b.z) < EPSILON &&
    Math.abs(a.w - b.w) < EPSILON
  );
}
