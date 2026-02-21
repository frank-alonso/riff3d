import type { StateCreator } from "zustand";
import type * as Y from "yjs";
import type { AwarenessLike } from "@/collaboration/lock-manager";

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

/**
 * Presence state for a remote collaborator, keyed by user ID.
 * Stores selection and camera state from Awareness.
 */
export interface CollaboratorPresence {
  selection: string[];
  camera?: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
    fov: number;
  };
  mode?: "editor" | "avatar";
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
  /** This user's display name (for local presence indicators). */
  userName: string;
  /** List of other users in the session. */
  collaborators: Collaborator[];
  /** Error message from collaboration (auth failure, etc.). */
  collabError: string | null;

  /**
   * Detailed presence state per collaborator (keyed by user ID).
   * Includes selection arrays and camera state from Awareness.
   * Updated by the awareness hook or provider.
   */
  collaboratorPresence: Map<string, CollaboratorPresence> | null;

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

  /**
   * Awareness reference for lock checking in scene-slice.
   * Set by CollaborationProvider when collaboration starts.
   * Used by dispatchOp lock guard and setSelection auto-release.
   * Prefixed with _ to indicate it is an internal cross-slice field.
   */
  _lockAwareness: AwarenessLike | null;

  /** Update collaboration state (partial). */
  setCollabState: (partial: Partial<Pick<CollabSlice,
    "isCollaborating" | "isConnected" | "isSynced" | "isOffline" |
    "userColor" | "userName" | "collabError" | "collabUndoManager" | "onAfterDispatch" |
    "_lockAwareness"
  >>) => void;

  /** Set the list of remote collaborators. */
  setCollaborators: (collaborators: Collaborator[]) => void;

  /** Update detailed presence state for collaborators. */
  setCollaboratorPresence: (presence: Map<string, CollaboratorPresence>) => void;
}

export const createCollabSlice: StateCreator<CollabSlice, [], [], CollabSlice> = (set) => ({
  isCollaborating: false,
  isConnected: false,
  isSynced: false,
  isOffline: false,
  userColor: "",
  userName: "",
  collaborators: [],
  collabError: null,
  collaboratorPresence: null,
  collabUndoManager: null,
  onAfterDispatch: null,
  _lockAwareness: null,

  setCollabState: (partial) => set(partial),

  setCollaborators: (collaborators) => set({ collaborators }),

  setCollaboratorPresence: (presence) => set({ collaboratorPresence: presence }),
});
