import type { StateCreator } from "zustand";
import type { SceneDocument } from "@riff3d/ecson";

/**
 * Engine type discriminator for the dual-adapter system.
 * PlayCanvas is the primary engine (Phases 1-3), Babylon.js is the
 * validation engine introduced in Phase 4.
 */
export type EngineType = "playcanvas" | "babylon";

/**
 * Engine slice -- manages the active rendering engine and switching state.
 *
 * When the user switches engines via the EngineSwitcher UI:
 * 1. `switchEngine(engine)` sets `activeEngine` and `isSwitchingEngine: true`
 * 2. The ViewportCanvas component reacts to `activeEngine` changes,
 *    disposes the old adapter, and creates a new one
 * 3. The viewport calls `setEngineSwitching(false)` once the new adapter
 *    is fully initialized
 *
 * Engine preference is persisted as `preferredEngine` in ECSON metadata.
 * When a project loads, editor-shell reads the preference and calls
 * `switchEngine()` if it's not the default.
 *
 * Key link: ViewportCanvas subscribes to `activeEngine` to decide which
 * adapter to instantiate (PlayCanvasAdapter or BabylonAdapter).
 */
export interface EngineSlice {
  /** Currently active rendering engine */
  activeEngine: EngineType;
  /** Whether an engine switch is in progress (loading overlay shown) */
  isSwitchingEngine: boolean;

  /**
   * Switch to a different engine.
   * Sets activeEngine and isSwitchingEngine: true.
   * Also persists the preference in ECSON metadata (non-PatchOp, system-level).
   */
  switchEngine: (engine: EngineType) => void;

  /**
   * Set switching state.
   * Called by viewport when the adapter finishes initializing (false)
   * or starts initializing (true).
   */
  setEngineSwitching: (switching: boolean) => void;
}

/**
 * The engine slice accesses ecsonDoc and docVersion from scene-slice
 * to persist the engine preference in ECSON metadata. This is a
 * system-level mutation (not a PatchOp) matching the approved exception
 * for loadProject/playtest stop.
 */
export const createEngineSlice: StateCreator<
  EngineSlice & {
    ecsonDoc: SceneDocument | null;
    docVersion: number;
  },
  [],
  [],
  EngineSlice
> = (set, get) => ({
  activeEngine: "playcanvas",
  isSwitchingEngine: false,

  switchEngine: (engine: EngineType) => {
    const { activeEngine, ecsonDoc } = get();
    if (engine === activeEngine) return;

    // Persist engine preference in ECSON metadata (system-level mutation,
    // not a PatchOp -- per approved architectural exception pattern).
    if (ecsonDoc) {
      ecsonDoc.metadata.preferredEngine = engine;
    }

    set({
      activeEngine: engine,
      isSwitchingEngine: true,
      // Bump docVersion so auto-save picks up the metadata change
      ...(ecsonDoc ? { docVersion: get().docVersion + 1 } : {}),
    });
  },

  setEngineSwitching: (switching: boolean) => {
    set({ isSwitchingEngine: switching });
  },
});
