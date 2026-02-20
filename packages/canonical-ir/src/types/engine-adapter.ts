/**
 * Shared EngineAdapter interface -- the contract both adapters implement.
 *
 * This lives in @riff3d/canonical-ir because adapters depend on canonical-ir
 * and the interface references CanonicalScene. Putting it here avoids a
 * circular dependency between adapter packages.
 *
 * Lifecycle:
 * 1. `initialize(canvas)` -- Create engine, set up editor camera
 * 2. `loadScene(scene)` -- Build scene graph from IR
 * 3. `rebuildScene(scene)` -- Tear down and rebuild (ECSON changes)
 * 4. `applyDelta(delta)` -- Incremental update (04-02 implements)
 * 5. `dispose()` -- Clean up everything
 */

import type { CanonicalScene } from "./canonical-scene";
import type { IRDelta } from "./ir-delta";

/**
 * Serialized camera state for engine switching.
 *
 * When switching between adapters (PlayCanvas <-> Babylon), the camera
 * position/rotation can be transferred to maintain the user's viewpoint.
 *
 * All values are in a **common right-handed Y-up coordinate system**
 * (matching PlayCanvas). Babylon adapters convert to/from left-handed
 * coordinates during serialize/deserialize.
 *
 * The optional `yaw`/`pitch` fields (degrees) take precedence over
 * `rotation` when available, avoiding lossy quaternion conversion.
 *   - Positive yaw = turn left (counterclockwise from above)
 *   - Positive pitch = look up
 */
export interface SerializedCameraState {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  mode: "fly" | "orbit";
  /** Yaw in degrees (positive = turn left). Takes precedence over rotation. */
  yaw?: number;
  /** Pitch in degrees (positive = look up). Takes precedence over rotation. */
  pitch?: number;
}

/**
 * Engine adapter interface.
 *
 * Adapters consume Canonical IR (never ECSON or PatchOps directly) and
 * translate it into engine-native scene graph operations.
 */
export interface EngineAdapter {
  /** Initialize the engine with the given canvas element. */
  initialize(canvas: HTMLCanvasElement): Promise<void>;

  /** Load a complete scene from Canonical IR. */
  loadScene(scene: CanonicalScene): void;

  /**
   * Rebuild the scene from a new Canonical IR snapshot.
   * Destroys existing scene entities and rebuilds from scratch.
   */
  rebuildScene(scene: CanonicalScene): void;

  /**
   * Apply an incremental scene update from Canonical IR.
   * Falls back to full rebuild for structural changes.
   */
  applyDelta(delta: IRDelta): void;

  /**
   * Get the mapping of ECSON entity IDs to engine-native entity objects.
   * Used by gizmos, selection, and other editor systems.
   */
  getEntityMap(): Map<string, unknown>;

  /**
   * Serialize the editor camera state for engine switching.
   * Returns position, rotation (quaternion), and camera mode.
   */
  serializeCameraState(): SerializedCameraState;

  /**
   * Restore the editor camera state after engine switch.
   */
  restoreCameraState(state: SerializedCameraState): void;

  /** Resize the canvas to match its container. */
  resize(): void;

  /**
   * Enter or exit play mode.
   * Play mode disables editor features and runs the simulation.
   */
  setPlayMode(playing: boolean): void;

  /** Set the engine time scale (0 = frozen, 1 = normal). */
  setTimeScale(scale: number): void;

  /** Check if the adapter is in play mode. */
  isInPlayMode(): boolean;

  /** Destroy the engine and clean up all resources. */
  dispose(): void;
}
