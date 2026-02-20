import type { StateCreator } from "zustand";
import type { SceneDocument } from "@riff3d/ecson";
import type { CanonicalScene } from "@riff3d/canonical-ir";
import { compile } from "@riff3d/canonical-ir";

/**
 * Playtest slice -- manages the play/pause/stop state machine and ECSON
 * snapshot/restore for play-test mode.
 *
 * When the user presses Play:
 * 1. Deep-clone the current ECSON document as a snapshot
 * 2. Set isPlaying=true, isPaused=false
 * 3. Signal the adapter to enter runtime mode (grid off, gizmos off, timeScale=1)
 *
 * When the user presses Pause:
 * 1. Set isPaused=true
 * 2. Signal the adapter: timeScale=0
 *
 * When the user presses Resume:
 * 1. Set isPaused=false
 * 2. Signal the adapter: timeScale=1
 *
 * When the user presses Stop:
 * 1. Restore the ECSON snapshot to scene slice
 * 2. Clear undo/redo stacks (play session changes are not undoable)
 * 3. Recompile IR from restored doc
 * 4. Signal the adapter to exit runtime mode (grid on, gizmos on, timeScale=0)
 *
 * Decision: "Keep changes" on stop is deferred to a future enhancement.
 * The current behavior always discards runtime changes on Stop.
 */
export interface PlaytestSlice {
  /** Whether the editor is in play mode. */
  isPlaying: boolean;
  /** Whether the play simulation is paused. */
  isPaused: boolean;
  /** Deep clone of the ECSON document taken when entering play mode. */
  ecsonSnapshot: SceneDocument | null;
  /** Panel sizes saved before play mode collapse (for restoration on stop). */
  prePanelState: {
    activePanel: "hierarchy" | "assets" | null;
    inspectorVisible: boolean;
  } | null;

  /** Enter play mode: snapshot ECSON, enable runtime. */
  play: () => void;
  /** Pause the runtime simulation (freeze time). */
  pause: () => void;
  /** Resume the runtime simulation after pause. */
  resume: () => void;
  /** Stop play mode: restore ECSON snapshot, clear undo/redo, rebuild scene. */
  stop: () => void;
}

/**
 * The playtest slice accesses scene-slice and ui-slice state via the combined
 * EditorState. The StateCreator generic uses `PlaytestSlice` for the slice
 * output, and the full state type is resolved at compose time in editor-store.ts.
 *
 * The cross-slice access pattern follows Zustand's recommended approach:
 * use get() to read state from other slices within actions.
 */
export const createPlaytestSlice: StateCreator<
  PlaytestSlice & {
    ecsonDoc: SceneDocument | null;
    canonicalScene: CanonicalScene | null;
    undoStack: unknown[];
    redoStack: unknown[];
    canUndo: boolean;
    canRedo: boolean;
    docVersion: number;
    lastOpType: string | null;
    activePanel: "hierarchy" | "assets" | null;
    inspectorVisible: boolean;
    loadProject: (doc: SceneDocument) => void;
  },
  [],
  [],
  PlaytestSlice
> = (set, get) => ({
  isPlaying: false,
  isPaused: false,
  ecsonSnapshot: null,
  prePanelState: null,

  play: () => {
    const { ecsonDoc, isPlaying, activePanel, inspectorVisible } = get();
    if (isPlaying || !ecsonDoc) return;

    // Deep-clone the ECSON document as a snapshot (JSON clone per decision [01-03])
    const snapshot = JSON.parse(JSON.stringify(ecsonDoc)) as SceneDocument;

    // Save panel state for restoration on stop
    const panelState = { activePanel, inspectorVisible };

    set({
      isPlaying: true,
      isPaused: false,
      ecsonSnapshot: snapshot,
      prePanelState: panelState,
    });
  },

  pause: () => {
    const { isPlaying, isPaused } = get();
    if (!isPlaying || isPaused) return;

    set({ isPaused: true });
  },

  resume: () => {
    const { isPlaying, isPaused } = get();
    if (!isPlaying || !isPaused) return;

    set({ isPaused: false });
  },

  stop: () => {
    const { isPlaying, ecsonSnapshot, prePanelState } = get();
    if (!isPlaying || !ecsonSnapshot) return;

    // Recompile IR from the restored snapshot
    const canonicalScene = compile(ecsonSnapshot);

    // Restore the pre-play ECSON document and clear play state.
    // Clear undo/redo stacks -- play session ops are not undoable.
    set({
      // Scene slice state
      ecsonDoc: ecsonSnapshot,
      canonicalScene,
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
      docVersion: get().docVersion + 1,
      lastOpType: "PlaytestStop",

      // Playtest slice state
      isPlaying: false,
      isPaused: false,
      ecsonSnapshot: null,
      prePanelState: null,

      // Restore panel state
      ...(prePanelState ?? {}),
    });
  },
});
