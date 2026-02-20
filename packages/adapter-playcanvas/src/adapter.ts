import * as pc from "playcanvas";
import type { CanonicalScene } from "@riff3d/canonical-ir";
import type { EngineAdapter, SerializedCameraState, IRDelta } from "./types";
import { buildScene, destroySceneEntities } from "./scene-builder";
import { applyEnvironment, getSkyboxColor } from "./environment";
import { CameraController, createEditorCamera } from "./editor-tools/camera-controller";
import { applyPlayCanvasDelta } from "./delta";

/**
 * PlayCanvas adapter implementing the EngineAdapter interface.
 *
 * This adapter reads Canonical IR (compiled from ECSON) and builds a
 * PlayCanvas scene with PBR materials, lighting, and camera controls.
 *
 * Architecture rule #3: Adapters read Canonical IR only. This adapter
 * never imports from @riff3d/ecson directly.
 *
 * IR conventions (CF-06):
 * - **Coordinate system:** Right-handed, Y-up (native to PlayCanvas)
 * - **Physics units:** Meters (1 unit = 1 meter)
 * - **Rotation:** Quaternion (x,y,z,w)
 * - **Roughness:** 0 = smooth, 1 = rough (inverted to gloss for PlayCanvas)
 * - **1:N mapping:** One ECSON entity = one IR node
 *
 * Lifecycle:
 * 1. `initialize(canvas)` - Create PlayCanvas Application, set up editor camera
 * 2. `loadScene(scene)` - Build scene graph from IR
 * 3. `rebuildScene(scene)` - Tear down and rebuild (used when ECSON changes)
 * 4. `dispose()` - Clean up everything
 *
 * CRITICAL: The entityMap (ECSON ID -> pc.Entity) is maintained internally.
 * It must NEVER be stored in Zustand or any React state.
 */
export class PlayCanvasAdapter implements EngineAdapter {
  private app: pc.Application | null = null;
  private entityMap: Map<string, pc.Entity> = new Map();
  private editorCamera: pc.Entity | null = null;
  private cameraController: CameraController | null = null;
  private currentScene: CanonicalScene | null = null;
  private canvas: HTMLCanvasElement | null = null;

  /**
   * Whether the adapter is currently in play mode.
   * When true, editor features (grid, gizmos, selection) are disabled.
   */
  private inPlayMode = false;

  /**
   * Initialize the PlayCanvas application with the given canvas element.
   *
   * Sets up:
   * - PlayCanvas Application with mouse + keyboard input
   * - Fill mode FILLMODE_NONE (container-managed sizing)
   * - Editor camera entity (separate from scene cameras)
   * - Camera controller (fly mode by default)
   * - Resize handling
   *
   * CRITICAL: Call dispose() in cleanup to prevent memory leaks.
   * Handle React Strict Mode double-effect by checking if already initialized.
   */
  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    // Guard against double initialization (React Strict Mode)
    if (this.app) {
      return;
    }

    this.canvas = canvas;

    // Create PlayCanvas Application
    this.app = new pc.Application(canvas, {
      mouse: new pc.Mouse(canvas),
      keyboard: new pc.Keyboard(window),
    });

    // Container-managed sizing (not fullscreen)
    this.app.setCanvasFillMode(pc.FILLMODE_NONE);
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);

    // Start the application
    this.app.start();

    // Create editor camera with default dark blue sky color
    this.editorCamera = createEditorCamera(this.app);

    // Set up camera controller (fly mode by default)
    this.cameraController = new CameraController(this.app, this.editorCamera);
    this.cameraController.initialize();

    // Initial resize to match container
    this.resize();
  }

  /**
   * Load a complete scene from Canonical IR.
   * Builds the PlayCanvas scene graph from the IR nodes.
   */
  loadScene(scene: CanonicalScene): void {
    if (!this.app) return;

    this.currentScene = scene;

    // Build scene graph
    const result = buildScene(this.app, scene);
    this.entityMap = result.entityMap;

    // Apply environment settings
    applyEnvironment(this.app, scene.environment);

    // Update editor camera clear color from skybox
    if (this.editorCamera?.camera) {
      this.editorCamera.camera.clearColor = getSkyboxColor(scene.environment);
    }

    // Signal scene is ready for visual testing / screenshot capture
    // Wait one frame for rendering to complete
    if (this.app) {
      this.app.once("frameend", () => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("__sceneReady"));
        }
      });
    }
  }

  /**
   * Rebuild the scene from a new Canonical IR snapshot.
   * Destroys existing scene entities and rebuilds from scratch.
   *
   * This is called when the ECSON document changes (e.g., via PatchOps).
   * Full rebuild is used in Phase 2; incremental delta updates will be
   * added in a future phase for performance.
   */
  rebuildScene(scene: CanonicalScene): void {
    if (!this.app) return;

    // Destroy existing scene entities
    destroySceneEntities(this.entityMap);

    // Rebuild
    this.loadScene(scene);
  }

  /**
   * Get the entity map (ECSON entity ID -> PlayCanvas Entity).
   * Used by editor systems (gizmos, selection, inspector) to find
   * the engine-native entity for a given ECSON entity.
   *
   * WARNING: Do NOT store this map in Zustand or React state.
   */
  getEntityMap(): Map<string, unknown> {
    return this.entityMap as Map<string, unknown>;
  }

  /**
   * Get the internal entity map typed as PlayCanvas entities.
   * For use by adapter-internal systems (gizmos, selection).
   */
  getTypedEntityMap(): Map<string, pc.Entity> {
    return this.entityMap;
  }

  /**
   * Get the PlayCanvas Application instance.
   * Used by gizmo manager, selection manager, and grid.
   */
  getApp(): pc.Application | null {
    return this.app;
  }

  /**
   * Get the editor camera entity.
   * Used by gizmo manager and selection manager.
   */
  getCameraEntity(): pc.Entity | null {
    return this.editorCamera;
  }

  /**
   * Resize the canvas to match its container dimensions.
   * Called by ResizeObserver in the viewport component.
   */
  resize(): void {
    if (!this.app || !this.canvas) return;

    const parent = this.canvas.parentElement;
    if (parent) {
      this.canvas.width = parent.clientWidth;
      this.canvas.height = parent.clientHeight;
    }

    this.app.resizeCanvas();
  }

  /**
   * Switch the editor camera between fly and orbit modes.
   *
   * @param mode - Target camera mode
   */
  switchCameraMode(mode: "fly" | "orbit"): void {
    this.cameraController?.switchMode(mode);
  }

  /**
   * Get the current camera mode.
   */
  getCameraMode(): "fly" | "orbit" {
    return this.cameraController?.getMode() ?? "fly";
  }

  /**
   * Enter or exit play mode.
   *
   * Play mode disables editor-specific features so the user sees the
   * scene as it would appear at runtime:
   * - `playing = true`: Set timeScale=1 (simulation runs)
   * - `playing = false`: Set timeScale=0 (simulation frozen), re-enable
   *   editor features
   *
   * Grid, gizmo, and selection toggling is handled externally by the
   * viewport component via GizmoManager/SelectionManager/GridHandle
   * references. This method controls only engine-level play state.
   */
  setPlayMode(playing: boolean): void {
    if (!this.app) return;

    this.inPlayMode = playing;

    if (playing) {
      // Enter runtime mode: time progresses
      this.app.timeScale = 1;
    } else {
      // Exit runtime mode: freeze time (editor mode)
      this.app.timeScale = 0;
    }
  }

  /**
   * Set the engine time scale.
   * 0 = frozen (editor mode / paused), 1 = normal speed.
   */
  setTimeScale(scale: number): void {
    if (!this.app) return;
    this.app.timeScale = scale;
  }

  /**
   * Check if the adapter is in play mode.
   */
  isInPlayMode(): boolean {
    return this.inPlayMode;
  }

  /**
   * Apply an incremental scene update from Canonical IR.
   *
   * For property-level deltas (transform, visibility, component-property,
   * environment), applies the change directly to the engine entity (O(1)).
   * For structural deltas (full-rebuild), falls back to rebuilding the
   * entire scene from the current IR snapshot.
   */
  applyDelta(delta: IRDelta): void {
    if (delta.type === "full-rebuild") {
      if (this.currentScene) {
        this.rebuildScene(this.currentScene);
      }
      return;
    }

    if (this.app) {
      applyPlayCanvasDelta(this.entityMap, this.app, this.editorCamera, delta);
    }
  }

  /**
   * Serialize the editor camera state for engine switching.
   * Returns position, rotation (quaternion), and camera mode.
   */
  serializeCameraState(): SerializedCameraState {
    if (!this.editorCamera) {
      return {
        position: { x: 0, y: 3, z: -8 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        mode: this.getCameraMode(),
      };
    }

    const pos = this.editorCamera.getLocalPosition();
    const rot = this.editorCamera.getLocalRotation();

    return {
      position: { x: pos.x, y: pos.y, z: pos.z },
      rotation: { x: rot.x, y: rot.y, z: rot.z, w: rot.w },
      mode: this.getCameraMode(),
    };
  }

  /**
   * Restore the editor camera state after engine switch.
   */
  restoreCameraState(state: SerializedCameraState): void {
    if (!this.editorCamera) return;

    this.editorCamera.setLocalPosition(
      state.position.x,
      state.position.y,
      state.position.z,
    );
    this.editorCamera.setLocalRotation(
      state.rotation.x,
      state.rotation.y,
      state.rotation.z,
      state.rotation.w,
    );

    if (state.mode !== this.getCameraMode()) {
      this.switchCameraMode(state.mode);
    }
  }

  /**
   * Destroy the PlayCanvas application and clean up all resources.
   *
   * MUST be called in React useEffect cleanup to prevent memory leaks.
   * After dispose(), the adapter instance should not be reused.
   */
  dispose(): void {
    // Clean up camera controller
    this.cameraController?.dispose();
    this.cameraController = null;

    // Destroy scene entities
    destroySceneEntities(this.entityMap);

    // Destroy the PlayCanvas application
    if (this.app) {
      this.app.destroy();
      this.app = null;
    }

    this.editorCamera = null;
    this.currentScene = null;
    this.canvas = null;
  }
}
