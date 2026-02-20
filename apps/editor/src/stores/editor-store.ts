import { createStore } from "zustand/vanilla";
import { subscribeWithSelector } from "zustand/middleware";
import { createUISlice, type UISlice } from "./slices/ui-slice";
import { createSceneSlice, type SceneSlice } from "./slices/scene-slice";
import { createViewportSlice, type ViewportSlice } from "./slices/viewport-slice";

/**
 * The single editor store, composed from slices.
 *
 * This is a vanilla (non-React) store so it can be accessed from both
 * React components (via useEditorStore hook) and imperative code
 * (e.g., engine adapters, PatchOps engine).
 *
 * Slices:
 * - UISlice: panel visibility, sidebar tabs
 * - SceneSlice: ECSON document, Canonical IR, selection, PatchOp dispatch
 * - ViewportSlice: camera mode, gizmo mode, snap settings
 * - 02-07: Playtest state (play/pause/stop, runtime mode)
 */
export type EditorState = UISlice & SceneSlice & ViewportSlice;

export const editorStore = createStore<EditorState>()(
  subscribeWithSelector((...args) => ({
    ...createUISlice(...args),
    ...createSceneSlice(...args),
    ...createViewportSlice(...args),
  })),
);
