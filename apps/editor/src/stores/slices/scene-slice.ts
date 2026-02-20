import type { StateCreator } from "zustand";
import type { SceneDocument } from "@riff3d/ecson";
import type { CanonicalScene } from "@riff3d/canonical-ir";
import type { PatchOp } from "@riff3d/patchops";
import { compile } from "@riff3d/canonical-ir";
import { applyOp } from "@riff3d/patchops";

/**
 * Scene slice -- owns the ECSON document, Canonical IR, selection state,
 * undo/redo stacks, and document versioning.
 *
 * Key link: dispatchOp calls applyOp(ecsonDoc, op) from @riff3d/patchops,
 * then recompiles ECSON to IR via compile() from @riff3d/canonical-ir.
 *
 * The canonicalScene is what the PlayCanvas adapter reads. When ecsonDoc
 * changes (via loadProject or dispatchOp), canonicalScene is recompiled
 * and the adapter subscriber triggers a scene rebuild.
 *
 * Undo/redo: Every dispatchOp pushes the inverse onto undoStack and clears
 * redoStack. undo() pops from undoStack, applies the inverse, and pushes
 * the re-inverse onto redoStack. redo() does the reverse.
 */
export interface SceneSlice {
  /** The current ECSON document (project file). Null before project loads. */
  ecsonDoc: SceneDocument | null;
  /** Compiled Canonical IR from the ECSON document. Null before project loads. */
  canonicalScene: CanonicalScene | null;
  /** Currently selected entity IDs in the scene hierarchy. */
  selectedEntityIds: string[];

  /** Stack of inverse ops for undo (most recent at the end). */
  undoStack: PatchOp[];
  /** Stack of redo ops (most recent at the end). */
  redoStack: PatchOp[];
  /** Whether there are operations to undo. */
  canUndo: boolean;
  /** Whether there are operations to redo. */
  canRedo: boolean;
  /** Monotonically increasing version counter, incremented on every mutation. */
  docVersion: number;
  /** The type of the last dispatched op (used by auto-save to detect structural changes). */
  lastOpType: string | null;

  /**
   * Load a project by setting the ECSON document and compiling to IR.
   * Called when opening a project from the dashboard.
   */
  loadProject: (doc: SceneDocument) => void;

  /**
   * Dispatch a PatchOp to mutate the ECSON document.
   * Applies the op, pushes the inverse onto undoStack, clears redoStack,
   * recompiles IR, increments docVersion.
   * Returns the inverse op.
   */
  dispatchOp: (op: PatchOp) => PatchOp;

  /**
   * Undo the last edit. Pops from undoStack, applies the inverse,
   * pushes the re-inverse onto redoStack.
   */
  undo: () => void;

  /**
   * Redo a previously undone edit. Pops from redoStack, applies the op,
   * pushes the inverse onto undoStack.
   */
  redo: () => void;

  /**
   * Set the selected entity IDs.
   */
  setSelection: (ids: string[]) => void;
}

/** Maximum undo history depth to prevent unbounded memory growth. */
const MAX_UNDO_DEPTH = 200;

export const createSceneSlice: StateCreator<
  SceneSlice,
  [],
  [],
  SceneSlice
> = (set, get) => ({
  ecsonDoc: null,
  canonicalScene: null,
  selectedEntityIds: [],
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,
  docVersion: 0,
  lastOpType: null,

  loadProject: (doc: SceneDocument) => {
    const canonicalScene = compile(doc);
    set({
      ecsonDoc: doc,
      canonicalScene,
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
      docVersion: 0,
      lastOpType: null,
    });
  },

  dispatchOp: (op: PatchOp): PatchOp => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cross-slice read for read-only guard
    const fullState = get() as any;
    if (fullState.isReadOnly === true) {
      throw new Error("Cannot dispatch PatchOp: editor is in read-only mode");
    }

    const { ecsonDoc, undoStack } = get();
    if (!ecsonDoc) {
      throw new Error("Cannot dispatch PatchOp: no ECSON document loaded");
    }

    // applyOp mutates the doc in place and returns the inverse op
    const inverseOp = applyOp(ecsonDoc, op);

    // Push inverse to undo stack (capped at MAX_UNDO_DEPTH)
    const newUndoStack = [...undoStack, inverseOp];
    if (newUndoStack.length > MAX_UNDO_DEPTH) {
      newUndoStack.shift();
    }

    // Recompile IR from the mutated document
    const canonicalScene = compile(ecsonDoc);

    // Spread to create a new top-level reference so Zustand selectors
    // watching ecsonDoc detect the change. applyOp mutates in place,
    // so without this spread Object.is(old, new) === true and
    // components like InspectorPanel never re-render.
    set((state) => ({
      ecsonDoc: { ...ecsonDoc },
      canonicalScene,
      undoStack: newUndoStack,
      redoStack: [],
      canUndo: true,
      canRedo: false,
      docVersion: state.docVersion + 1,
      lastOpType: op.type,
    }));

    return inverseOp;
  },

  undo: () => {
    const { ecsonDoc, undoStack, redoStack } = get();
    if (!ecsonDoc || undoStack.length === 0) return;

    const inverseOp = undoStack[undoStack.length - 1]!;
    const newUndoStack = undoStack.slice(0, -1);

    // Apply the inverse op and get the re-inverse (for redo)
    const reInverse = applyOp(ecsonDoc, inverseOp);
    const newRedoStack = [...redoStack, reInverse];

    const canonicalScene = compile(ecsonDoc);

    set((state) => ({
      ecsonDoc: { ...ecsonDoc },
      canonicalScene,
      undoStack: newUndoStack,
      redoStack: newRedoStack,
      canUndo: newUndoStack.length > 0,
      canRedo: true,
      docVersion: state.docVersion + 1,
      lastOpType: "Undo",
    }));
  },

  redo: () => {
    const { ecsonDoc, undoStack, redoStack } = get();
    if (!ecsonDoc || redoStack.length === 0) return;

    const redoOp = redoStack[redoStack.length - 1]!;
    const newRedoStack = redoStack.slice(0, -1);

    // Apply the redo op and get the inverse (for undo)
    const inverse = applyOp(ecsonDoc, redoOp);
    const newUndoStack = [...undoStack, inverse];

    const canonicalScene = compile(ecsonDoc);

    set((state) => ({
      ecsonDoc: { ...ecsonDoc },
      canonicalScene,
      undoStack: newUndoStack,
      redoStack: newRedoStack,
      canUndo: true,
      canRedo: newRedoStack.length > 0,
      docVersion: state.docVersion + 1,
      lastOpType: "Redo",
    }));
  },

  setSelection: (ids: string[]) => {
    set({ selectedEntityIds: ids });
  },
});
