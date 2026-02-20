import { useStore } from "zustand";
import { editorStore, type EditorState } from "./editor-store";

/**
 * React hook for subscribing to the editor store.
 * Uses a selector for optimal re-renders.
 *
 * @example
 * ```tsx
 * const activePanel = useEditorStore((s) => s.activePanel);
 * const toggleInspector = useEditorStore((s) => s.toggleInspector);
 * ```
 */
export function useEditorStore<T>(selector: (state: EditorState) => T): T {
  return useStore(editorStore, selector);
}

// Convenience selectors for common access patterns

// UI
export const selectActivePanel = (s: EditorState) => s.activePanel;
export const selectInspectorVisible = (s: EditorState) => s.inspectorVisible;
export const selectSetActivePanel = (s: EditorState) => s.setActivePanel;
export const selectToggleInspector = (s: EditorState) => s.toggleInspector;

// Scene
export const selectEcsonDoc = (s: EditorState) => s.ecsonDoc;
export const selectCanonicalScene = (s: EditorState) => s.canonicalScene;
export const selectSelectedEntityIds = (s: EditorState) => s.selectedEntityIds;
export const selectLoadProject = (s: EditorState) => s.loadProject;
export const selectDispatchOp = (s: EditorState) => s.dispatchOp;
export const selectSetSelection = (s: EditorState) => s.setSelection;
export const selectCanUndo = (s: EditorState) => s.canUndo;
export const selectCanRedo = (s: EditorState) => s.canRedo;
export const selectUndo = (s: EditorState) => s.undo;
export const selectRedo = (s: EditorState) => s.redo;
export const selectDocVersion = (s: EditorState) => s.docVersion;
export const selectLastOpType = (s: EditorState) => s.lastOpType;

// Viewport
export const selectGizmoMode = (s: EditorState) => s.gizmoMode;
export const selectCameraMode = (s: EditorState) => s.cameraMode;
export const selectSnapEnabled = (s: EditorState) => s.snapEnabled;
export const selectSetGizmoMode = (s: EditorState) => s.setGizmoMode;
export const selectSetCameraMode = (s: EditorState) => s.setCameraMode;

// Save
export const selectSaveStatus = (s: EditorState) => s.saveStatus;
export const selectLastSavedAt = (s: EditorState) => s.lastSavedAt;
export const selectSetSaveStatus = (s: EditorState) => s.setSaveStatus;
export const selectMarkSaved = (s: EditorState) => s.markSaved;
