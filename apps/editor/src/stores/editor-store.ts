import { createStore } from "zustand/vanilla";
import { subscribeWithSelector } from "zustand/middleware";
import { createUISlice, type UISlice } from "./slices/ui-slice";

/**
 * The single editor store, composed from slices.
 *
 * This is a vanilla (non-React) store so it can be accessed from both
 * React components (via useEditorStore hook) and imperative code
 * (e.g., engine adapters, PatchOps engine).
 *
 * Slices added by later plans:
 * - 02-02: Scene state (entities, selection, ECSON document)
 * - 02-02: Viewport state (camera, gizmo mode, grid)
 * - 02-07: Playtest state (play/pause/stop, runtime mode)
 */
// Intersection type composed from slices.
// Future slices will be added here (e.g., EditorState = UISlice & SceneSlice & ViewportSlice)
export type EditorState = UISlice;

export const editorStore = createStore<EditorState>()(
  subscribeWithSelector((...args) => ({
    ...createUISlice(...args),
  })),
);
