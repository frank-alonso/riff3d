import type { StateCreator } from "zustand";

/**
 * Viewport slice -- owns gizmo mode, camera mode, snap, grid, and avatar mode settings.
 *
 * These values drive both the UI (toolbar display, toggle states) and the
 * PlayCanvas adapter (camera controller mode switch, grid rendering).
 *
 * Default camera mode is "fly" per user decision in 02-CONTEXT.md.
 */
export interface ViewportSlice {
  /** Current gizmo mode for transform manipulation. */
  gizmoMode: "translate" | "rotate" | "scale";
  /** Current camera navigation mode. */
  cameraMode: "fly" | "orbit";
  /** Whether snapping is enabled for gizmo operations. */
  snapEnabled: boolean;
  /** Grid snap size in meters. */
  gridSize: number;
  /** Rotation snap angle in degrees. */
  rotationSnap: number;
  /**
   * Whether the user is in embodied avatar mode.
   * When true, the normal camera controller is disabled and the
   * AvatarController takes over with WASD ground-plane movement.
   */
  isAvatarMode: boolean;

  /** Set the gizmo mode. */
  setGizmoMode: (mode: "translate" | "rotate" | "scale") => void;
  /** Set the camera mode (triggers adapter camera switch via store subscription). */
  setCameraMode: (mode: "fly" | "orbit") => void;
  /** Toggle snapping on/off. */
  toggleSnap: () => void;
  /** Set the grid snap size. */
  setGridSize: (size: number) => void;
  /** Set the rotation snap angle. */
  setRotationSnap: (degrees: number) => void;
  /** Toggle avatar mode on/off. */
  toggleAvatarMode: () => void;
  /** Set avatar mode explicitly. */
  setAvatarMode: (enabled: boolean) => void;
}

export const createViewportSlice: StateCreator<
  ViewportSlice,
  [],
  [],
  ViewportSlice
> = (set) => ({
  gizmoMode: "translate",
  cameraMode: "fly",
  snapEnabled: false,
  gridSize: 1,
  rotationSnap: 15,
  isAvatarMode: false,

  setGizmoMode: (mode) => set({ gizmoMode: mode }),
  setCameraMode: (mode) => set({ cameraMode: mode }),
  toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),
  setGridSize: (size) => set({ gridSize: size }),
  setRotationSnap: (degrees) => set({ rotationSnap: degrees }),
  toggleAvatarMode: () => set((state) => ({ isAvatarMode: !state.isAvatarMode })),
  setAvatarMode: (enabled) => set({ isAvatarMode: enabled }),
});
