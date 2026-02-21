"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useCollaboration } from "../provider";
import { getRemotePresences } from "../awareness-state";
import { ORIGIN_LOCAL, ORIGIN_INIT } from "../sync-bridge";
import type * as Y from "yjs";

/**
 * Entry tracking a property changed by a remote user.
 */
export interface RemoteChangeEntry {
  /** The dot-path of the changed property (e.g., "transform", "components"). */
  property: string;
  /** The remote user's assigned color. */
  color: string;
  /** The remote user's name. */
  userName: string;
  /** Timestamp when the change was detected. */
  timestamp: number;
}

/**
 * Hook for tracking which entity properties were recently changed
 * by remote users.
 *
 * Subscribes to Y.Doc entity map changes (deep observer), cross-references
 * with Awareness state to determine which remote user made the change,
 * and maintains a map of recent changes that auto-clear after 2 seconds.
 *
 * UI components use this to show brief color flashes on properties
 * that were remotely modified.
 */
export function useRemoteChanges(): Map<string, RemoteChangeEntry[]> {
  const collab = useCollaboration();
  const [changeMap, setChangeMap] = useState<Map<string, RemoteChangeEntry[]>>(
    () => new Map(),
  );
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const addChange = useCallback(
    (entityId: string, property: string, color: string, userName: string) => {
      const key = `${entityId}:${property}`;
      const entry: RemoteChangeEntry = {
        property,
        color,
        userName,
        timestamp: Date.now(),
      };

      setChangeMap((prev) => {
        const next = new Map(prev);
        const existing = next.get(entityId) ?? [];
        // Replace existing entry for same property or add new
        const filtered = existing.filter((e) => e.property !== property);
        next.set(entityId, [...filtered, entry]);
        return next;
      });

      // Clear after 2 seconds
      const existingTimer = timersRef.current.get(key);
      if (existingTimer) clearTimeout(existingTimer);

      const timer = setTimeout(() => {
        timersRef.current.delete(key);
        setChangeMap((prev) => {
          const next = new Map(prev);
          const entries = next.get(entityId);
          if (entries) {
            const filtered = entries.filter((e) => e.property !== property);
            if (filtered.length === 0) {
              next.delete(entityId);
            } else {
              next.set(entityId, filtered);
            }
          }
          return next;
        });
      }, 2000);

      timersRef.current.set(key, timer);
    },
    [],
  );

  useEffect(() => {
    if (!collab?.awareness) return;
    const yDoc = collab.yDoc;
    const awareness = collab.awareness;

    const yEntities = yDoc.getMap("entities");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Y.observeDeep callback type
    function handleEntityChanges(events: Y.YEvent<any>[], transaction: Y.Transaction): void {
      // Skip local and init origins
      if (
        transaction.origin === ORIGIN_LOCAL ||
        transaction.origin === ORIGIN_INIT
      ) {
        return;
      }

      // Get remote user info from Awareness to determine color
      const remotes = getRemotePresences(awareness);
      // Use the first remote user's color as a fallback
      // (Hocuspocus sends the transaction origin as the remote clientID)
      let changeColor = "#888888";
      let changeName = "Remote user";

      // Try to find the specific user by transaction origin (clientID)
      if (typeof transaction.origin === "number") {
        const userState = remotes.get(transaction.origin);
        if (userState?.user) {
          changeColor = userState.user.color;
          changeName = userState.user.name;
        }
      } else {
        // Fallback: use the first remote user's color
        for (const [, presence] of remotes) {
          if (presence.user) {
            changeColor = presence.user.color;
            changeName = presence.user.name;
            break;
          }
        }
      }

      // Walk events to find which entities and properties changed.
      // Y.Doc structure: yEntities (Y.Map) -> entityId (Y.Map) -> property keys.
      // observeDeep event paths relative to yEntities:
      //   path=[]           -> top-level: entity added/deleted
      //   path=[entityId]   -> entity Y.Map key changed (e.g. "components", "transform")
      //   path=[entityId, prop, ...] -> deep nested change within a property
      for (const event of events) {
        const path = event.path;
        if (path.length >= 2) {
          // Deep nested change within an entity property
          const entityId = String(path[0]);
          const property = String(path[1]);
          addChange(entityId, property, changeColor, changeName);
        } else if (path.length === 1) {
          // Entity Y.Map property change -- read actual keys from event
          const entityId = String(path[0]);
          if (event.changes?.keys) {
            for (const [propertyKey] of event.changes.keys) {
              addChange(entityId, propertyKey, changeColor, changeName);
            }
          }
        } else if (event.changes?.keys) {
          // Top-level entity map change (add/delete entity)
          for (const [entityId] of event.changes.keys) {
            addChange(entityId, "entity", changeColor, changeName);
          }
        }
      }
    }

    yEntities.observeDeep(handleEntityChanges);

    const timers = timersRef.current;
    return () => {
      yEntities.unobserveDeep(handleEntityChanges);
      // Clear all timers
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, [collab?.awareness, collab?.yDoc, addChange]);

  return changeMap;
}
