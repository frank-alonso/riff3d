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
export const selectActivePanel = (s: EditorState) => s.activePanel;
export const selectInspectorVisible = (s: EditorState) => s.inspectorVisible;
export const selectSetActivePanel = (s: EditorState) => s.setActivePanel;
export const selectToggleInspector = (s: EditorState) => s.toggleInspector;
