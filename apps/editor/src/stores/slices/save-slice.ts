import type { StateCreator } from "zustand";

/**
 * Save slice -- owns save status and last-saved timestamp.
 *
 * The auto-save hook (useAutoSave) updates this state as it saves.
 * The TopBar component reads saveStatus to show the save indicator.
 */
export type SaveStatus = "saved" | "saving" | "unsaved" | "error";

export interface SaveSlice {
  /** Current save status for the save indicator in the top bar. */
  saveStatus: SaveStatus;
  /** Timestamp of the last successful save. Null if never saved. */
  lastSavedAt: Date | null;

  /** Update the save status. */
  setSaveStatus: (status: SaveStatus) => void;
  /** Record a successful save. */
  markSaved: () => void;
}

export const createSaveSlice: StateCreator<SaveSlice, [], [], SaveSlice> = (set) => ({
  saveStatus: "saved",
  lastSavedAt: null,

  setSaveStatus: (status) => set({ saveStatus: status }),

  markSaved: () =>
    set({
      saveStatus: "saved",
      lastSavedAt: new Date(),
    }),
});
