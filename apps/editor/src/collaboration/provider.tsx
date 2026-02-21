"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { createClient } from "@/lib/supabase/client";
import { editorStore } from "@/stores/editor-store";
import {
  initializeYDoc,
  syncToYDoc,
  yDocToEcson,
  observeRemoteChanges,
  ORIGIN_LOCAL,
} from "./sync-bridge";
import type { PresenceState } from "./awareness-state";

/**
 * Context value exposed by CollaborationProvider.
 *
 * Components use `useCollaboration()` to access the Y.Doc, provider,
 * awareness, undo manager, and connection state.
 */
interface CollabContextValue {
  provider: HocuspocusProvider | null;
  yDoc: Y.Doc;
  awareness: HocuspocusProvider["awareness"] | null;
  undoManager: Y.UndoManager | null;
}

const CollabContext = createContext<CollabContextValue | null>(null);

/**
 * CollaborationProvider -- wraps editor content to enable real-time
 * collaborative editing via Hocuspocus/Yjs.
 *
 * Lifecycle:
 * 1. Creates a Y.Doc and HocuspocusProvider with Supabase JWT auth
 * 2. On initial sync (onSynced):
 *    - If Y.Doc is empty: initialize from local ECSON (first collab session)
 *    - If Y.Doc has content: load Y.Doc state into the editor store
 * 3. Sets up bidirectional sync:
 *    - Local PatchOps -> Y.Doc (via onAfterDispatch callback on collab slice)
 *    - Remote Y.Doc changes -> ECSON rebuild -> loadProject
 * 4. Creates per-user Y.UndoManager with captureTimeout:0
 * 5. Manages offline/reconnect state transitions
 */
export function CollaborationProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const yDocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const undoManagerRef = useRef<Y.UndoManager | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const yDoc = new Y.Doc();
    yDocRef.current = yDoc;

    const supabase = createClient();
    let provider: HocuspocusProvider | null = null;

    async function connect(): Promise<void> {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        editorStore.getState().setCollabState({
          collabError: "No active session -- collaboration requires authentication",
        });
        return;
      }

      const collabUrl = process.env.NEXT_PUBLIC_COLLAB_URL;
      if (!collabUrl) return;

      provider = new HocuspocusProvider({
        url: collabUrl,
        name: projectId,
        document: yDoc,
        token: session.access_token,

        onSynced({ state }) {
          if (!state) return;

          // Check if Y.Doc has content (entities map has entries)
          const yEntities = yDoc.getMap("entities");
          const hasContent = yEntities.size > 0;

          if (!hasContent) {
            // First collaborative session -- initialize Y.Doc from local ECSON
            const ecsonDoc = editorStore.getState().ecsonDoc;
            if (ecsonDoc) {
              initializeYDoc(yDoc, ecsonDoc);
            }
          } else {
            // Y.Doc has content from server -- load it into the editor
            const ecson = yDocToEcson(yDoc);
            editorStore.getState().loadProject(ecson);
          }

          // Set up remote change observer
          const unobserve = observeRemoteChanges(yDoc, (ecson) => {
            // Remote changes: rebuild ECSON from Y.Doc and reload.
            // This triggers IR recompilation and adapter scene rebuild.
            editorStore.getState().loadProject(ecson);
          });
          cleanupRef.current = unobserve;

          // Create per-user Y.UndoManager
          // CRITICAL: captureTimeout:0 prevents cross-user operation merging
          // trackedOrigins: only track our local edits
          const yEntitiesMap = yDoc.getMap("entities");
          const yAssetsMap = yDoc.getMap("assets");
          const yEnvironmentMap = yDoc.getMap("environment");

          const undoManager = new Y.UndoManager(
            [yEntitiesMap, yAssetsMap, yEnvironmentMap],
            {
              trackedOrigins: new Set([ORIGIN_LOCAL]),
              captureTimeout: 0,
            },
          );
          undoManagerRef.current = undoManager;

          // Register the onAfterDispatch callback to sync PatchOps to Y.Doc
          const dispatchCallback = (entityId?: string) => {
            const ecsonDoc = editorStore.getState().ecsonDoc;
            if (ecsonDoc) {
              syncToYDoc(yDoc, ecsonDoc, entityId);
            }
          };

          editorStore.getState().setCollabState({
            isSynced: true,
            isCollaborating: true,
            collabUndoManager: undoManager,
            onAfterDispatch: dispatchCallback,
            // Expose awareness to scene-slice for lock guard and auto-release (05-04)
            _lockAwareness: provider?.awareness ?? null,
          });
        },

        onStatus({ status }) {
          const isConnected = status === "connected";
          editorStore.getState().setCollabState({
            isConnected,
            isOffline: !isConnected,
          });

          // Per locked decision: editor goes read-only when offline
          if (!isConnected) {
            editorStore.getState().setReadOnly(true);
          } else {
            // On reconnect, restore editing capability for owners.
            // (Non-owners stay read-only regardless.)
            // Check isOwner by seeing if read-only was set by collab disconnect
            // vs by project access control. Use a simple heuristic: if we were
            // collaborating, we had write access.
            const { isCollaborating } = editorStore.getState();
            if (isCollaborating) {
              editorStore.getState().setReadOnly(false);
            }
          }
        },

        onAuthenticationFailed({ reason }) {
          editorStore.getState().setCollabState({
            collabError: `Authentication failed: ${reason}`,
          });
        },

        onAwarenessUpdate() {
          // Update collaborators list from awareness states
          if (!provider) return;
          const states = provider.awareness?.getStates();
          if (!states) return;

          const collaborators: Array<{ id: string; name: string; color: string }> = [];
          const localClientId = yDoc.clientID;

          for (const [clientId, state] of states) {
            if (clientId === localClientId) continue;
            const presence = state as Partial<PresenceState>;
            if (presence.user) {
              collaborators.push({
                id: presence.user.id,
                name: presence.user.name,
                color: presence.user.color,
              });
            }
          }

          editorStore.getState().setCollaborators(collaborators);
        },
      });

      providerRef.current = provider;

      editorStore.getState().setCollabState({
        isCollaborating: true,
        isConnected: false,
        isSynced: false,
      });
    }

    void connect();

    return () => {
      // Cleanup: unregister callbacks, destroy provider, destroy Y.Doc
      editorStore.getState().setCollabState({
        isCollaborating: false,
        isConnected: false,
        isSynced: false,
        isOffline: false,
        collabUndoManager: null,
        onAfterDispatch: null,
        _lockAwareness: null,
      });

      cleanupRef.current?.();
      cleanupRef.current = null;

      undoManagerRef.current?.destroy();
      undoManagerRef.current = null;

      providerRef.current?.destroy();
      providerRef.current = null;

      yDocRef.current?.destroy();
      yDocRef.current = null;
    };
  }, [projectId]);

  return (
    <CollabContext
      value={{
        provider: providerRef.current,
        yDoc: yDocRef.current ?? new Y.Doc(),
        awareness: providerRef.current?.awareness ?? null,
        undoManager: undoManagerRef.current,
      }}
    >
      {children}
    </CollabContext>
  );
}

/**
 * Hook to access the collaboration context.
 * Returns null when not wrapped in CollaborationProvider
 * (solo editing mode).
 */
export function useCollaboration(): CollabContextValue | null {
  return useContext(CollabContext);
}
