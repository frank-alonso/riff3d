/**
 * Entity lock manager for collaborative editing.
 *
 * Locks are stored in each user's Yjs Awareness state as `locks: string[]`
 * (array of entity IDs this user has locked). Because locks live in Awareness
 * (not Y.Doc), they automatically clear when a user disconnects.
 *
 * Key behaviors:
 * - Locking an entity also locks all its descendants (hierarchical propagation)
 * - Lock acquisition fails if the entity (or any ancestor) is already locked by another user
 * - Auto-release on deselect is handled by scene-slice (not here)
 * - Auto-release on disconnect is handled by Awareness protocol (free)
 */

import type { SceneDocument } from "@riff3d/ecson";

/**
 * Minimal Awareness interface to avoid importing the full yjs/hocuspocus types.
 * Matches the subset of HocuspocusProvider["awareness"] that we need.
 */
export interface AwarenessLike {
  getStates: () => Map<number, Record<string, unknown>>;
  clientID: number;
  setLocalStateField: (key: string, value: unknown) => void;
  getLocalState: () => Record<string, unknown> | null;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  off: (event: string, callback: (...args: unknown[]) => void) => void;
}

export interface LockHolder {
  name: string;
  color: string;
}

export interface LockAcquireResult {
  success: boolean;
  holder?: LockHolder;
}

export interface LockInfo {
  locked: boolean;
  lockedByMe: boolean;
  holder?: LockHolder;
  /** True when the entity itself is not directly locked but an ancestor is */
  inherited: boolean;
}

export interface LockEntry {
  lockedByMe: boolean;
  holder: LockHolder;
  inherited: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Collect all descendant entity IDs by walking the children arrays.
 * Uses BFS to avoid stack overflow on deep hierarchies.
 */
function getDescendantIds(
  entityId: string,
  doc: SceneDocument,
): string[] {
  const descendants: string[] = [];
  const queue = [entityId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const entity = doc.entities[current];
    if (!entity) continue;

    for (const childId of entity.children) {
      descendants.push(childId);
      queue.push(childId);
    }
  }

  return descendants;
}

/**
 * Collect all ancestor entity IDs by walking the parentId chain.
 */
function getAncestorIds(
  entityId: string,
  doc: SceneDocument,
): string[] {
  const ancestors: string[] = [];
  let current = doc.entities[entityId];

  while (current?.parentId) {
    ancestors.push(current.parentId);
    current = doc.entities[current.parentId];
  }

  return ancestors;
}

/**
 * Extract user info from an Awareness state entry.
 */
function getUserFromState(
  state: Record<string, unknown>,
): LockHolder | null {
  const user = state.user as
    | { name: string; color: string }
    | undefined;
  if (!user?.name) return null;
  return { name: user.name, color: user.color };
}

/**
 * Get the locks array from an Awareness state entry.
 */
function getLocksFromState(state: Record<string, unknown>): string[] {
  const locks = state.locks;
  if (!Array.isArray(locks)) return [];
  return locks as string[];
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Attempt to acquire a lock on an entity and all its descendants.
 *
 * Fails if:
 * - The entity (or any ancestor) is already locked by another user
 * - Any descendant is already locked by another user
 *
 * On success, adds entityId + all descendant IDs to the local user's
 * `locks` array in Awareness state.
 */
export function acquireLock(
  entityId: string,
  ecsonDoc: SceneDocument,
  awareness: AwarenessLike,
): LockAcquireResult {
  const localClientId = awareness.clientID;

  // Check if entity or any ancestor is locked by another user
  const ancestors = getAncestorIds(entityId, ecsonDoc);
  const idsToCheck = [entityId, ...ancestors];

  for (const [clientId, state] of awareness.getStates()) {
    if (clientId === localClientId) continue;
    const remoteLocks = getLocksFromState(state);
    if (remoteLocks.length === 0) continue;

    for (const checkId of idsToCheck) {
      if (remoteLocks.includes(checkId)) {
        const holder = getUserFromState(state);
        return {
          success: false,
          holder: holder ?? { name: "Unknown", color: "#888" },
        };
      }
    }
  }

  // Check if any descendant is locked by another user
  const descendants = getDescendantIds(entityId, ecsonDoc);

  for (const [clientId, state] of awareness.getStates()) {
    if (clientId === localClientId) continue;
    const remoteLocks = getLocksFromState(state);
    if (remoteLocks.length === 0) continue;

    for (const descId of descendants) {
      if (remoteLocks.includes(descId)) {
        const holder = getUserFromState(state);
        return {
          success: false,
          holder: holder ?? { name: "Unknown", color: "#888" },
        };
      }
    }
  }

  // Acquire: add entityId + all descendants to local locks
  const localState = awareness.getLocalState();
  const currentLocks = localState ? getLocksFromState(localState) : [];

  // Merge without duplicates
  const newLockSet = new Set(currentLocks);
  newLockSet.add(entityId);
  for (const descId of descendants) {
    newLockSet.add(descId);
  }

  awareness.setLocalStateField("locks", Array.from(newLockSet));
  return { success: true };
}

/**
 * Release a lock on an entity and all its descendants.
 *
 * Removes entityId and all descendant IDs from the local user's
 * `locks` array in Awareness state.
 */
export function releaseLock(
  entityId: string,
  ecsonDoc: SceneDocument,
  awareness: AwarenessLike,
): void {
  const localState = awareness.getLocalState();
  if (!localState) return;

  const currentLocks = getLocksFromState(localState);
  if (currentLocks.length === 0) return;

  // Gather the set of IDs to remove: entityId + all descendants
  const descendants = getDescendantIds(entityId, ecsonDoc);
  const removeSet = new Set([entityId, ...descendants]);

  const newLocks = currentLocks.filter((id) => !removeSet.has(id));
  awareness.setLocalStateField("locks", newLocks);
}

/**
 * Release all locks held by the local user.
 */
export function releaseAllLocks(awareness: AwarenessLike): void {
  awareness.setLocalStateField("locks", []);
}

/**
 * Check if a specific entity is locked and by whom.
 *
 * An entity is considered locked if:
 * 1. It appears directly in any user's locks array, OR
 * 2. Any of its ancestors appears in any user's locks array (inherited lock)
 */
export function isEntityLocked(
  entityId: string,
  ecsonDoc: SceneDocument,
  awareness: AwarenessLike,
  localClientId: number,
): LockInfo {
  const notLocked: LockInfo = {
    locked: false,
    lockedByMe: false,
    inherited: false,
  };

  // Check direct lock first
  for (const [clientId, state] of awareness.getStates()) {
    const locks = getLocksFromState(state);
    if (locks.includes(entityId)) {
      const isMe = clientId === localClientId;
      const holder = getUserFromState(state);
      return {
        locked: true,
        lockedByMe: isMe,
        holder: holder ?? { name: "Unknown", color: "#888" },
        inherited: false,
      };
    }
  }

  // Check ancestor locks (inherited)
  const ancestors = getAncestorIds(entityId, ecsonDoc);
  for (const ancestorId of ancestors) {
    for (const [clientId, state] of awareness.getStates()) {
      const locks = getLocksFromState(state);
      if (locks.includes(ancestorId)) {
        const isMe = clientId === localClientId;
        const holder = getUserFromState(state);
        return {
          locked: true,
          lockedByMe: isMe,
          holder: holder ?? { name: "Unknown", color: "#888" },
          inherited: true,
        };
      }
    }
  }

  return notLocked;
}

/**
 * Get a map of all currently locked entities across all users.
 *
 * Returns a Map<entityId, LockEntry> for every entity ID that appears
 * in any user's locks array.
 */
export function getLockedEntities(
  awareness: AwarenessLike,
  localClientId: number,
): Map<string, LockEntry> {
  const result = new Map<string, LockEntry>();

  for (const [clientId, state] of awareness.getStates()) {
    const locks = getLocksFromState(state);
    if (locks.length === 0) continue;

    const isMe = clientId === localClientId;
    const holder = getUserFromState(state);
    if (!holder) continue;

    for (const entityId of locks) {
      // First direct lock wins (don't overwrite with later entries)
      if (!result.has(entityId)) {
        result.set(entityId, {
          lockedByMe: isMe,
          holder,
          inherited: false,
        });
      }
    }
  }

  return result;
}

/**
 * Extract the target entity ID from a PatchOp payload.
 *
 * Used by the lock guard in dispatchOp to check if the target entity
 * is locked by another user before applying the op.
 *
 * Returns null for ops that don't target a specific entity (e.g., BatchOp)
 * or for the special __environment__ entity.
 */
export function getOpTargetEntityId(
  op: { type: string; payload: Record<string, unknown> },
): string | null {
  // BatchOp has no single target -- checked recursively by caller
  if (op.type === "BatchOp") return null;

  const entityId = op.payload.entityId as string | undefined;
  if (!entityId) return null;

  // __environment__ is a virtual entity, not lockable
  if (entityId === "__environment__") return null;

  return entityId;
}
