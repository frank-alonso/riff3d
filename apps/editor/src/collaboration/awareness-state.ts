/**
 * Awareness state types for the Yjs Awareness protocol.
 *
 * Awareness carries ephemeral per-user state (not persisted in Y.Doc):
 * - User identity and color
 * - Current selection
 * - Camera position/rotation
 * - Editor mode (editor camera vs embodied avatar)
 * - Entity locks held by this user
 *
 * All presence rendering (frustum cones, avatars, hierarchy borders,
 * inspector highlights) reads from Awareness state.
 */

export interface PresenceState {
  user: {
    id: string;
    name: string;
    color: string;
  };
  /** Currently selected entity IDs */
  selection: string[];
  /** Camera position and orientation */
  camera: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
    fov: number;
  };
  /** Editor camera mode or embodied avatar mode */
  mode: "editor" | "avatar";
  /** Entity IDs this user has locked */
  locks: string[];
}

/**
 * Update one or more fields of the local Awareness state.
 *
 * Uses setLocalStateField for partial updates (does not replace
 * the entire state on each call).
 */
export function updatePresence(
  awareness: { setLocalStateField: (key: string, value: unknown) => void },
  partial: Partial<PresenceState>,
): void {
  for (const [key, value] of Object.entries(partial)) {
    awareness.setLocalStateField(key, value);
  }
}

/**
 * Get all remote presence states (excludes the local client).
 */
export function getRemotePresences(
  awareness: { getStates: () => Map<number, Record<string, unknown>>; clientID: number },
): Map<number, PresenceState> {
  const result = new Map<number, PresenceState>();
  for (const [clientId, state] of awareness.getStates()) {
    if (clientId === awareness.clientID) continue;
    if (state.user) {
      result.set(clientId, state as unknown as PresenceState);
    }
  }
  return result;
}
