"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useCollaboration } from "../provider";
import {
  acquireLock,
  releaseLock,
  isEntityLocked,
  getLockedEntities,
  type AwarenessLike,
  type LockInfo,
  type LockEntry,
} from "../lock-manager";
import { editorStore } from "@/stores/editor-store";

/**
 * Hook for querying and managing entity lock state.
 *
 * Subscribes to Yjs Awareness change events to re-render when lock
 * state changes (e.g., another user acquires or releases a lock).
 *
 * Provides:
 * - lockEntity(entityId): Attempt to acquire a lock (shows toast on failure)
 * - unlockEntity(entityId): Release a lock
 * - getLockInfo(entityId): Get lock status for a specific entity
 * - lockedEntities: Map of all currently locked entities
 * - isCollaborating: Whether collaboration is active (controls UI visibility)
 */
export function useEntityLocks(): {
  lockEntity: (entityId: string) => boolean;
  unlockEntity: (entityId: string) => void;
  getLockInfo: (entityId: string) => LockInfo;
  lockedEntities: Map<string, LockEntry>;
  isCollaborating: boolean;
} {
  const collab = useCollaboration();
  const [lockedEntities, setLockedEntities] = useState<Map<string, LockEntry>>(
    () => new Map(),
  );
  // Track version to force re-renders on awareness changes
  const [, setVersion] = useState(0);
  const awarenessRef = useRef<AwarenessLike | null>(null);

  const awareness = collab?.awareness as AwarenessLike | null;
  awarenessRef.current = awareness;

  const isCollaborating = !!awareness;

  useEffect(() => {
    if (!awareness) return;

    function handleAwarenessChange(): void {
      if (!awareness) return;
      const entries = getLockedEntities(awareness, awareness.clientID);
      setLockedEntities(entries);
      setVersion((v) => v + 1);
    }

    awareness.on("change", handleAwarenessChange);

    // Initial read
    handleAwarenessChange();

    return () => {
      awareness.off("change", handleAwarenessChange);
    };
  }, [awareness]);

  const lockEntity = useCallback(
    (entityId: string): boolean => {
      if (!awareness) return false;

      const ecsonDoc = editorStore.getState().ecsonDoc;
      if (!ecsonDoc) return false;

      const result = acquireLock(entityId, ecsonDoc, awareness);
      if (!result.success && result.holder) {
        toast.error(`Entity locked by ${result.holder.name}`, {
          style: { borderLeft: `4px solid ${result.holder.color}` },
          duration: 3000,
        });
        return false;
      }

      return result.success;
    },
    [awareness],
  );

  const unlockEntity = useCallback(
    (entityId: string): void => {
      if (!awareness) return;

      const ecsonDoc = editorStore.getState().ecsonDoc;
      if (!ecsonDoc) return;

      releaseLock(entityId, ecsonDoc, awareness);
    },
    [awareness],
  );

  const getLockInfo = useCallback(
    (entityId: string): LockInfo => {
      if (!awareness) {
        return { locked: false, lockedByMe: false, inherited: false };
      }

      const ecsonDoc = editorStore.getState().ecsonDoc;
      if (!ecsonDoc) {
        return { locked: false, lockedByMe: false, inherited: false };
      }

      return isEntityLocked(
        entityId,
        ecsonDoc,
        awareness,
        awareness.clientID,
      );
    },
    [awareness],
  );

  return {
    lockEntity,
    unlockEntity,
    getLockInfo,
    lockedEntities,
    isCollaborating,
  };
}
