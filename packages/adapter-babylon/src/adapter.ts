import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import type { CanonicalScene } from "@riff3d/canonical-ir";
import type { EngineAdapter, SerializedCameraState, IRDelta } from "./types";
import { buildScene, destroySceneEntities } from "./scene-builder";
import { applyEnvironment, getSkyboxColor } from "./environment";
import { applyBabylonDelta } from "./delta";
import { BabylonCameraController } from "./editor-tools/camera-controller";

/**
 * Babylon.js adapter implementing the shared EngineAdapter interface.
 *
 * This adapter reads Canonical IR (compiled from ECSON) and builds a
 * Babylon.js scene with PBR materials, lighting, and camera controls.
 *
 * Architecture rule #3: Adapters read Canonical IR only. This adapter
 * never imports from @riff3d/ecson directly.
 *
 * IR conventions (CF-06):
 * - **Coordinate system:** Right-handed Y-up in IR. Babylon is left-handed
 *   Y-up, but for primitives/lights the difference is negligible.
 *   glTF import (Phase 7) will handle handedness conversion.
 * - **Physics units:** Meters (1 unit = 1 meter)
 * - **Rotation:** Quaternion (x,y,z,w) -- always use rotationQuaternion
 * - **Roughness:** 0 = smooth, 1 = rough (direct, no inversion)
 * - **1:N mapping:** One ECSON entity = one IR node
 *
 * Lifecycle:
 * 1. `initialize(canvas)` - Create Babylon Engine, Scene, editor camera
 * 2. `loadScene(scene)` - Build scene graph from IR
 * 3. `rebuildScene(scene)` - Tear down and rebuild (ECSON changes)
 * 4. `applyDelta(delta)` - Incremental update (04-02 implements)
 * 5. `dispose()` - Clean up everything
 */
export class BabylonAdapter implements EngineAdapter {
  private engine: Engine | null = null;
  private scene: Scene | null = null;
  private entityMap: Map<string, TransformNode> = new Map();
  private cameraController: BabylonCameraController | null = null;
  private editorCamera: UniversalCamera | null = null;
  private currentScene: CanonicalScene | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private inPlayMode = false;

  /**
   * Initialize the Babylon.js engine with the given canvas element.
   *
   * Sets up:
   * - Babylon Engine (preserveDrawingBuffer, stencil)
   * - Scene with dark blue clear color
   * - Render loop
   * - Editor camera (ArcRotateCamera with orbit controls)
   */
  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    // Guard against double initialization (React Strict Mode)
    if (this.engine) {
      return;
    }

    this.canvas = canvas;

    // Create Babylon Engine
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });

    // Create Scene
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.05, 0.05, 0.12, 1);

    // Create camera controller with orbit controls
    this.cameraController = new BabylonCameraController(this.scene, canvas);
    this.editorCamera = this.cameraController.initialize();

    // Start render loop
    this.engine.runRenderLoop(() => {
      this.scene?.render();
    });

    // Initial resize
    this.resize();
  }

  /**
   * Load a complete scene from Canonical IR.
   * Builds the Babylon.js scene graph from the IR nodes.
   */
  loadScene(scene: CanonicalScene): void {
    if (!this.scene) return;

    this.currentScene = scene;

    // Build scene graph
    const result = buildScene(this.scene, scene);
    this.entityMap = result.entityMap;

    // Apply environment settings
    applyEnvironment(this.scene, scene.environment);

    // Update clear color from skybox
    this.scene.clearColor = getSkyboxColor(scene.environment);

    // Signal scene is ready for visual testing / screenshot capture
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("__sceneReady"));
    }
  }

  /**
   * Rebuild the scene from a new Canonical IR snapshot.
   * Destroys existing scene entities and rebuilds from scratch.
   */
  rebuildScene(scene: CanonicalScene): void {
    if (!this.scene) return;

    // Destroy existing scene entities
    destroySceneEntities(this.entityMap);

    // Rebuild
    this.loadScene(scene);
  }

  /**
   * Apply an incremental scene update from Canonical IR.
   *
   * For property-level deltas (transform, visibility, component-property,
   * environment), applies the change directly to the engine node (O(1)).
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

    if (this.scene) {
      applyBabylonDelta(this.entityMap, this.scene, delta);
    }
  }

  /**
   * Get the entity map (ECSON entity ID -> Babylon.js TransformNode).
   * Used by editor systems (gizmos, selection, inspector).
   */
  getEntityMap(): Map<string, unknown> {
    return this.entityMap as Map<string, unknown>;
  }

  /**
   * Get the internal entity map typed as Babylon TransformNodes.
   * For use by adapter-internal systems (selection manager).
   */
  getTypedEntityMap(): Map<string, TransformNode> {
    return this.entityMap;
  }

  /**
   * Get the Babylon.js Scene instance.
   * Used by selection manager and other editor tools.
   */
  getScene(): Scene | null {
    return this.scene;
  }

  /**
   * Get the canvas element.
   * Used by editor tools that need DOM event binding.
   */
  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  /**
   * Serialize the editor camera state for engine switching.
   *
   * Converts the ArcRotateCamera's orbital position to a position/quaternion
   * format compatible with the PlayCanvas adapter.
   */
  serializeCameraState(): SerializedCameraState {
    if (!this.cameraController) {
      return {
        position: { x: 0, y: 3, z: -8 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        mode: "orbit",
      };
    }

    return this.cameraController.serializeCameraState();
  }

  /**
   * Restore the editor camera state after engine switch.
   *
   * Converts position/quaternion from PlayCanvas format to
   * ArcRotateCamera orbital parameters.
   */
  restoreCameraState(state: SerializedCameraState): void {
    if (!this.cameraController) return;

    this.cameraController.restoreCameraState(state);
  }

  /**
   * Resize the canvas to match its container dimensions.
   */
  resize(): void {
    this.engine?.resize();
  }

  /**
   * Enter or exit play mode.
   * No-op for Phase 4 (Babylon play mode deferred).
   */
  setPlayMode(playing: boolean): void {
    this.inPlayMode = playing;
  }

  /**
   * Set the engine time scale.
   * No-op stub for Phase 4.
   */
  setTimeScale(_scale: number): void {
    // No-op: Babylon time scale deferred to future phase
  }

  /**
   * Check if the adapter is in play mode.
   */
  isInPlayMode(): boolean {
    return this.inPlayMode;
  }

  /**
   * Destroy the Babylon.js engine and clean up all resources.
   */
  dispose(): void {
    // Clean up camera controller
    this.cameraController?.dispose();
    this.cameraController = null;
    this.editorCamera = null;

    // Destroy scene entities
    destroySceneEntities(this.entityMap);

    // Dispose scene
    if (this.scene) {
      this.scene.dispose();
      this.scene = null;
    }

    // Dispose engine
    if (this.engine) {
      this.engine.dispose();
      this.engine = null;
    }

    this.currentScene = null;
    this.canvas = null;
  }
}
