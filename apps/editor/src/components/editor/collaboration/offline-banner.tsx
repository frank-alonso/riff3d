"use client";

import { AlertTriangle } from "lucide-react";
import { useEditorStore } from "@/stores/hooks";

/**
 * Offline status banner component.
 *
 * Displayed as a fixed banner at the top of the viewport area (below top bar)
 * when the WebSocket connection to the Hocuspocus server is lost.
 *
 * Per locked decision: when offline, the editor goes read-only and this
 * banner is shown. Changes will sync when reconnected.
 *
 * Only visible when isOffline is true in collab-slice.
 */
export function OfflineBanner() {
  const isOffline = useEditorStore((s) => s.isOffline);
  const isCollaborating = useEditorStore((s) => s.isCollaborating);

  // Only show when in collab mode and offline
  if (!isCollaborating || !isOffline) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-900/80 px-3 py-1.5 text-sm text-amber-200">
      <AlertTriangle size={14} className="shrink-0" />
      <span>Offline -- changes will sync when reconnected</span>
    </div>
  );
}
