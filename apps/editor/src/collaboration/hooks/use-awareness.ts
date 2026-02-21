"use client";

import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useCollaboration } from "../provider";
import { getRemotePresences, type PresenceState } from "../awareness-state";
import { editorStore } from "@/stores/editor-store";
import type { CollaboratorPresence } from "@/stores/slices/collab-slice";

/**
 * Hook for subscribing to Yjs Awareness state changes.
 *
 * Provides:
 * - Map of all remote users' presence states (excludes self)
 * - Join/leave detection with toast notifications
 * - Automatic collab-slice collaborator list updates
 * - Functions to update local awareness (selection, camera)
 *
 * Camera updates are throttled to 100ms to avoid flooding the
 * Awareness protocol with high-frequency updates.
 */
export function useAwareness(): {
  remoteUsers: Map<number, PresenceState>;
  updateSelection: (entityIds: string[]) => void;
  updateCamera: (camera: PresenceState["camera"]) => void;
} {
  const collab = useCollaboration();
  const remoteUsersRef = useRef<Map<number, PresenceState>>(new Map());
  const previousClientIdsRef = useRef<Set<number>>(new Set());
  const cameraThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!collab?.awareness) return;
    const awareness = collab.awareness;

    function handleAwarenessChange(): void {
      const currentRemotes = getRemotePresences(awareness);
      const currentIds = new Set(currentRemotes.keys());
      const previousIds = previousClientIdsRef.current;

      // Detect joins (new keys)
      for (const clientId of currentIds) {
        if (!previousIds.has(clientId)) {
          const presence = currentRemotes.get(clientId);
          if (presence?.user?.name) {
            toast.info(`${presence.user.name} joined`, {
              style: { borderLeft: `4px solid ${presence.user.color}` },
              duration: 3000,
            });
          }
        }
      }

      // Detect leaves (removed keys)
      for (const clientId of previousIds) {
        if (!currentIds.has(clientId)) {
          // Look up the name from the previous snapshot
          const previous = remoteUsersRef.current.get(clientId);
          if (previous?.user?.name) {
            toast.info(`${previous.user.name} left`, {
              duration: 3000,
            });
          }
        }
      }

      previousClientIdsRef.current = currentIds;
      remoteUsersRef.current = currentRemotes;

      // Update collab-slice collaborators array and detailed presence
      const collaborators: Array<{ id: string; name: string; color: string }> = [];
      const presenceMap = new Map<string, CollaboratorPresence>();

      for (const [, presence] of currentRemotes) {
        if (presence.user) {
          collaborators.push({
            id: presence.user.id,
            name: presence.user.name,
            color: presence.user.color,
          });
          presenceMap.set(presence.user.id, {
            selection: presence.selection ?? [],
            camera: presence.camera,
            mode: presence.mode,
          });
        }
      }
      editorStore.getState().setCollaborators(collaborators);
      editorStore.getState().setCollaboratorPresence(presenceMap);
    }

    awareness.on("change", handleAwarenessChange);

    // Initial read
    handleAwarenessChange();

    return () => {
      awareness.off("change", handleAwarenessChange);
      if (cameraThrottleRef.current) {
        clearTimeout(cameraThrottleRef.current);
      }
    };
  }, [collab?.awareness]);

  const updateSelection = useCallback(
    (entityIds: string[]) => {
      if (!collab?.awareness) return;
      collab.awareness.setLocalStateField("selection", entityIds);
    },
    [collab?.awareness],
  );

  const updateCamera = useCallback(
    (camera: PresenceState["camera"]) => {
      if (!collab?.awareness) return;
      // Throttle camera updates to 100ms
      if (cameraThrottleRef.current) return;
      collab.awareness.setLocalStateField("camera", camera);
      cameraThrottleRef.current = setTimeout(() => {
        cameraThrottleRef.current = null;
      }, 100);
    },
    [collab?.awareness],
  );

  return {
    remoteUsers: remoteUsersRef.current,
    updateSelection,
    updateCamera,
  };
}
