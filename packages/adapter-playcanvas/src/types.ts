import type { CanonicalScene } from "@riff3d/canonical-ir";

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
   * Get the mapping of ECSON entity IDs to engine-native entity objects.
   * Used by gizmos, selection, and other editor systems.
   */
  getEntityMap(): Map<string, unknown>;

  /** Resize the canvas to match its container. */
  resize(): void;

  /** Destroy the engine and clean up all resources. */
  dispose(): void;
}

/**
 * Camera mode for the editor viewport.
 * - 'fly': Game-style camera (right-click+drag to look, WASD to move)
 * - 'orbit': Standard orbit camera (Alt+click orbit, Alt+middle pan, scroll zoom)
 */
export interface CameraMode {
  type: "fly" | "orbit";
}
