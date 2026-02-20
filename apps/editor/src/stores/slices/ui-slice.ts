import type { StateCreator } from "zustand";

export interface UISlice {
  /** Currently active left sidebar panel */
  activePanel: "hierarchy" | "assets" | null;
  /** Whether the right inspector panel is visible */
  inspectorVisible: boolean;
  /** Currently active sidebar tab (for sub-tab navigation within a panel) */
  activeSidebarTab: string;

  /** Set the active left sidebar panel. Pass null to collapse. */
  setActivePanel: (panel: "hierarchy" | "assets" | null) => void;
  /** Toggle the right inspector panel visibility */
  toggleInspector: () => void;
  /** Set the active sidebar tab */
  setActiveSidebarTab: (tab: string) => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  activePanel: "hierarchy",
  inspectorVisible: true,
  activeSidebarTab: "properties",

  setActivePanel: (panel) =>
    set((state) => ({
      // Toggle off if clicking the same panel
      activePanel: state.activePanel === panel ? null : panel,
    })),

  toggleInspector: () =>
    set((state) => ({
      inspectorVisible: !state.inspectorVisible,
    })),

  setActiveSidebarTab: (tab) =>
    set({ activeSidebarTab: tab }),
});
