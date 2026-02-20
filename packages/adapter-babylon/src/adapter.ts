import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3, Quaternion } from "@babylonjs/core/Maths/math.vector";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { CanonicalScene } from "@riff3d/canonical-ir";
import type { EngineAdapter, SerializedCameraState, IRDelta } from "./types";
import { buildScene, destroySceneEntities } from "./scene-builder";
import { applyEnvironment, getSkyboxColor } from "./environment";

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
   * - Editor camera (UniversalCamera at position 0,3,-8)
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

    // Create editor camera
    this.editorCamera = new UniversalCamera(
      "__editorCamera",
      new Vector3(0, 3, -8),
      this.scene,
    );
    // Look at origin
    this.editorCamera.setTarget(Vector3.Zero());

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
   * Stub: falls back to full rebuild. Incremental delta implementation
   * will be added in 04-02.
   */
  applyDelta(_delta: IRDelta): void {
    if (this.currentScene) {
      this.rebuildScene(this.currentScene);
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
   * Serialize the editor camera state for engine switching.
   */
  serializeCameraState(): SerializedCameraState {
    if (!this.editorCamera) {
      return {
        position: { x: 0, y: 3, z: -8 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        mode: "fly",
      };
    }

    const pos = this.editorCamera.position;
    const rot = this.editorCamera.rotationQuaternion ?? new Quaternion(0, 0, 0, 1);

    return {
      position: { x: pos.x, y: pos.y, z: pos.z },
      rotation: { x: rot.x, y: rot.y, z: rot.z, w: rot.w },
      mode: "fly",
    };
  }

  /**
   * Restore the editor camera state after engine switch.
   */
  restoreCameraState(state: SerializedCameraState): void {
    if (!this.editorCamera) return;

    this.editorCamera.position = new Vector3(
      state.position.x,
      state.position.y,
      state.position.z,
    );

    this.editorCamera.rotationQuaternion = new Quaternion(
      state.rotation.x,
      state.rotation.y,
      state.rotation.z,
      state.rotation.w,
    );
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

    this.editorCamera = null;
    this.currentScene = null;
    this.canvas = null;
  }
}
