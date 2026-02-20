// Re-export shared types from canonical-ir for backward compatibility.
// EngineAdapter and related types now live in canonical-ir (shared by both adapters).
export type { EngineAdapter, SerializedCameraState } from "@riff3d/canonical-ir";
export type { IRDelta } from "@riff3d/canonical-ir";

/**
 * Camera mode for the editor viewport.
 * - 'fly': Game-style camera (right-click+drag to look, WASD to move)
 * - 'orbit': Standard orbit camera (Alt+click orbit, Alt+middle pan, scroll zoom)
 *
 * This is PlayCanvas-specific (camera controller implementation lives here).
 */
export interface CameraMode {
  type: "fly" | "orbit";
}
