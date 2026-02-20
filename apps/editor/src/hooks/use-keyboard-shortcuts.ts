"use client";

import { useHotkeys } from "react-hotkeys-hook";
import { editorStore } from "@/stores/editor-store";
import { generateOpId } from "@riff3d/ecson";
import type { PatchOp } from "@riff3d/patchops";
import { CURRENT_PATCHOP_VERSION } from "@riff3d/patchops";

/**
 * Register all editor keyboard shortcuts.
 *
 * Shortcuts (industry standard):
 * - W -> translate gizmo
 * - E -> rotate gizmo
 * - R -> scale gizmo
 * - Escape -> deselect all
 * - Delete / Backspace -> delete selected entities
 * - F -> focus camera on selected entity (placeholder for now)
 *
 * Guards:
 * - Shortcuts don't fire when typing in input/textarea/select fields
 *   (react-hotkeys-hook default: enableOnFormTags is false)
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
}
