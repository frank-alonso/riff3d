import type { StateCreator } from "zustand";
import type { SceneDocument } from "@riff3d/ecson";
import type { CanonicalScene } from "@riff3d/canonical-ir";
import type { PatchOp } from "@riff3d/patchops";
import { compile } from "@riff3d/canonical-ir";
import { applyOp } from "@riff3d/patchops";

/**
 * Scene slice -- owns the ECSON document, Canonical IR, and selection state.
 *
 * Key link: dispatchOp calls applyOp(ecsonDoc, op) from @riff3d/patchops,
 * then recompiles ECSON to IR via compile() from @riff3d/canonical-ir.
 *
 * The canonicalScene is what the PlayCanvas adapter reads. When ecsonDoc
 * changes (via loadProject or dispatchOp), canonicalScene is recompiled
 * and the adapter subscriber triggers a scene rebuild.
 */
export interface SceneSlice {
  /** The current ECSON document (project file). Null before project loads. */
  ecsonDoc: SceneDocument | null;
  /** Compiled Canonical IR from the ECSON document. Null before project loads. */
  canonicalScene: CanonicalScene | null;
  /** Currently selected entity IDs in the scene hierarchy. */
  selectedEntityIds: string[];

  /**
   * Load a project by setting the ECSON document and compiling to IR.
   * Called when opening a project from the dashboard.
   */
  loadProject: (doc: SceneDocument) => void;

  /**
   * Dispatch a PatchOp to mutate the ECSON document.
   * Applies the op, recompiles IR, returns the inverse op for undo.
   * Undo/redo stacks will be added in 02-05.
   */
  dispatchOp: (op: PatchOp) => PatchOp;

  /**
   * Set the selected entity IDs.
   */
  setSelection: (ids: string[]) => void;
}

export const createSceneSlice: StateCreator<
  SceneSlice,
  [],
  [],
  SceneSlice
> = (set, get) => ({
  ecsonDoc: null,
  canonicalScene: null,
  selectedEntityIds: [],

  loadProject: (doc: SceneDocument) => {
    const canonicalScene = compile(doc);
    set({ ecsonDoc: doc, canonicalScene });
  },

  dispatchOp: (op: PatchOp): PatchOp => {
    const { ecsonDoc } = get();
    if (!ecsonDoc) {
      throw new Error("Cannot dispatch PatchOp: no ECSON document loaded");
    }

    // applyOp mutates the doc in place and returns the inverse op
    const inverseOp = applyOp(ecsonDoc, op);

    // Recompile IR from the mutated document
    const canonicalScene = compile(ecsonDoc);

    // Spread to create a new top-level reference so Zustand selectors
    // watching ecsonDoc detect the change. applyOp mutates in place,
    // so without this spread Object.is(old, new) === true and
    // components like InspectorPanel never re-render.
    set({ ecsonDoc: { ...ecsonDoc }, canonicalScene });

    return inverseOp;
  },

  setSelection: (ids: string[]) => {
    set({ selectedEntityIds: ids });
  },
});
