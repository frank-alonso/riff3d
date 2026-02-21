import type { StateCreator } from "zustand";
import type * as Y from "yjs";

/**
 * Collaboration state slice.
 *
 * Tracks the current collaboration session state:
 * - Whether collaboration is active and connected
 * - Sync status with the Hocuspocus server
 * - User's assigned presence color
 * - List of other collaborators
 * - Offline/error state
 * - References to the Y.UndoManager for collaborative undo
 * - Callback hook for syncing PatchOps to Y.Doc
 *
 * The CollaborationProvider (React context) sets these values as
 * the WebSocket connection lifecycle progresses.
 */

export interface Collaborator {
  id: string;
  name: string;
  color: string;
}

export interface CollabSlice {
  /** Whether the editor is in collaborative mode. */
  isCollaborating: boolean;
  /** Whether the WebSocket connection is established. */
  isConnected: boolean;
  /** Whether the initial Y.Doc sync is complete. */
  isSynced: boolean;
  /** Whether the connection has been lost (read-only mode). */
  isOffline: boolean;
  /** This user's assigned presence color. */
  userColor: string;
  /** List of other users in the session. */
  collaborators: Collaborator[];
  /** Error message from collaboration (auth failure, etc.). */
  collabError: string | null;

  /**
   * Y.UndoManager for collaborative undo.
   * When set (collab active), undo/redo delegates to this instead
   * of the PatchOps inverse stack.
   */
  collabUndoManager: Y.UndoManager | null;

  /**
   * Callback registered by the CollaborationProvider to sync
   * PatchOp changes to the Y.Doc. Called after every dispatchOp.
   * If null, no collaboration sync occurs (solo editing).
   */
  onAfterDispatch: ((entityId?: string) => void) | null;

  /** Update collaboration state (partial). */
  setCollabState: (partial: Partial<Pick<CollabSlice,
    "isCollaborating" | "isConnected" | "isSynced" | "isOffline" |
    "userColor" | "collabError" | "collabUndoManager" | "onAfterDispatch"
  >>) => void;

  /** Set the list of remote collaborators. */
  setCollaborators: (collaborators: Collaborator[]) => void;
}

export const createCollabSlice: StateCreator<CollabSlice, [], [], CollabSlice> = (set) => ({
  isCollaborating: false,
  isConnected: false,
  isSynced: false,
  isOffline: false,
  userColor: "",
  collaborators: [],
  collabError: null,
  collabUndoManager: null,
  onAfterDispatch: null,

  setCollabState: (partial) => set(partial),

  setCollaborators: (collaborators) => set({ collaborators }),
});
