"use client";

import { useHotkeys } from "react-hotkeys-hook";
import { editorStore } from "@/stores/editor-store";
import { generateOpId } from "@riff3d/ecson";
import type { PatchOp } from "@riff3d/patchops";
import { CURRENT_PATCHOP_VERSION } from "@riff3d/patchops";
import {
  copyEntities,
  pasteEntities,
  duplicateEntities,
  readClipboard,
} from "@/lib/clipboard";

/**
 * Register all editor keyboard shortcuts.
 *
 * Shortcuts (industry standard):
 * - W -> translate gizmo
 * - E -> rotate gizmo
 * - R -> scale gizmo
 * - Escape -> deselect all (or stop play mode)
 * - Delete / Backspace -> delete selected entities
 * - F -> focus camera on selected entity (placeholder for now)
 * - Ctrl+Z -> undo
 * - Ctrl+Shift+Z / Ctrl+Y -> redo
 * - Ctrl+C -> copy selected entities
 * - Ctrl+V -> paste entities from clipboard
 * - Ctrl+D -> duplicate selected entities
 * - Ctrl+A -> select all entities
 * - Ctrl+S -> manual save (handled in use-auto-save, but preventDefault here)
 * - Ctrl+P / F5 -> toggle play/stop
 * - Space -> toggle pause/resume (only during play mode)
 *
 * Guards:
 * - Shortcuts don't fire when typing in input/textarea/select fields
 *   (react-hotkeys-hook default: enableOnFormTags is false)
 * - Space shortcut only active during play mode to avoid conflicts
 *
 * Call this hook once in EditorShell to register all shortcuts.
 */
export function useKeyboardShortcuts(): void {
  // W -> translate gizmo
  useHotkeys("w", () => {
    editorStore.getState().setGizmoMode("translate");
  }, { preventDefault: true });

  // E -> rotate gizmo
  useHotkeys("e", () => {
    editorStore.getState().setGizmoMode("rotate");
  }, { preventDefault: true });

  // R -> scale gizmo
  useHotkeys("r", () => {
    editorStore.getState().setGizmoMode("scale");
  }, { preventDefault: true });

  // Escape -> deselect all
  useHotkeys("escape", () => {
    editorStore.getState().setSelection([]);
  });

  // Delete / Backspace -> delete selected entities
  useHotkeys("delete, backspace", () => {
    const { selectedEntityIds, ecsonDoc, dispatchOp, setSelection } =
      editorStore.getState();

    if (selectedEntityIds.length === 0 || !ecsonDoc) return;

    // Create DeleteEntity PatchOps for each selected entity
    for (const entityId of selectedEntityIds) {
      const entity = ecsonDoc.entities[entityId];
      if (!entity) continue;

      const op: PatchOp = {
        id: generateOpId(),
        timestamp: Date.now(),
        origin: "user",
        version: CURRENT_PATCHOP_VERSION,
        type: "DeleteEntity",
        payload: {
          entityId,
          previousState: entity,
        },
      };

      dispatchOp(op);
    }

    // Clear selection after deletion
    setSelection([]);
  }, { preventDefault: true });

  // F -> focus camera on selected entity
  // This is a placeholder -- the actual camera focus will be handled
  // by the viewport adapter in a future iteration. For now, it's a no-op
  // since we need the adapter reference to move the camera.
  useHotkeys("f", () => {
    // Focus camera on selection (will be connected to adapter later)
    // For now this serves as a registered shortcut that doesn't conflict
  });

  // Ctrl+Z -> undo
  useHotkeys("mod+z", () => {
    editorStore.getState().undo();
  }, { preventDefault: true });

  // Ctrl+Shift+Z / Ctrl+Y -> redo
  useHotkeys("mod+shift+z, mod+y", () => {
    editorStore.getState().redo();
  }, { preventDefault: true });

  // Ctrl+C -> copy selected entities
  useHotkeys("mod+c", () => {
    const { selectedEntityIds, ecsonDoc } = editorStore.getState();
    if (selectedEntityIds.length === 0 || !ecsonDoc) return;

    void copyEntities(selectedEntityIds, ecsonDoc);
  }, { preventDefault: true });

  // Ctrl+V -> paste entities from clipboard
  useHotkeys("mod+v", () => {
    void (async () => {
      const { ecsonDoc, dispatchOp, setSelection } = editorStore.getState();
      if (!ecsonDoc) return;

      const clipboardJson = await readClipboard();
      if (!clipboardJson) return;

      // Determine paste target: selected entity's parent, or root
      const { selectedEntityIds } = editorStore.getState();
      let parentId = ecsonDoc.rootEntityId;
      if (selectedEntityIds.length === 1) {
        parentId = selectedEntityIds[0]!;
      }

      const { ops, newEntityIds } = pasteEntities(clipboardJson, parentId);
      if (ops.length === 0) return;

      // Dispatch as a BatchOp so undo reverts the entire paste
      const batchOp: PatchOp = {
        id: generateOpId(),
        timestamp: Date.now(),
        origin: "user",
        version: CURRENT_PATCHOP_VERSION,
        type: "BatchOp",
        payload: { ops },
      };

      dispatchOp(batchOp);
      setSelection(newEntityIds);
    })();
  }, { preventDefault: true });

  // Ctrl+D -> duplicate selected entities
  useHotkeys("mod+d", () => {
    const { selectedEntityIds, ecsonDoc, dispatchOp, setSelection } =
      editorStore.getState();

    if (selectedEntityIds.length === 0 || !ecsonDoc) return;

    const { ops, newEntityIds } = duplicateEntities(selectedEntityIds, ecsonDoc);
    if (ops.length === 0) return;

    // Dispatch as a BatchOp so undo reverts the entire duplicate
    const batchOp: PatchOp = {
      id: generateOpId(),
      timestamp: Date.now(),
      origin: "user",
      version: CURRENT_PATCHOP_VERSION,
      type: "BatchOp",
      payload: { ops },
    };

    dispatchOp(batchOp);
    setSelection(newEntityIds);
  }, { preventDefault: true });

  // Ctrl+A -> select all entities
  useHotkeys("mod+a", () => {
    const { ecsonDoc, setSelection } = editorStore.getState();
    if (!ecsonDoc) return;

    // Select all entities except the root
    const allIds = Object.keys(ecsonDoc.entities).filter(
      (id) => id !== ecsonDoc.rootEntityId,
    );
    setSelection(allIds);
  }, { preventDefault: true });

  // Ctrl+S -> manual save (preventDefault only -- actual save is handled by useAutoSave)
  useHotkeys("mod+s", () => {
    // The useAutoSave hook subscribes to a manualSaveRequested flag.
    // We dispatch a custom event that the auto-save hook will listen to.
    window.dispatchEvent(new CustomEvent("riff3d:manual-save"));
  }, { preventDefault: true });

  // Ctrl+P / F5 -> toggle play/stop
  useHotkeys("mod+p, f5", () => {
    const { isPlaying, play, stop } = editorStore.getState();
    if (isPlaying) {
      stop();
    } else {
      play();
    }
  }, { preventDefault: true });

  // Space -> toggle pause/resume (only during play mode)
  useHotkeys("space", () => {
    const { isPlaying, isPaused, pause, resume } = editorStore.getState();
    if (!isPlaying) return;

    if (isPaused) {
      resume();
    } else {
      pause();
    }
  }, { preventDefault: true });
}
