"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import type { PlayCanvasAdapter } from "@riff3d/adapter-playcanvas";

/**
 * Context for sharing the PlayCanvas adapter instance with child components.
 *
 * The adapter ref allows gizmo manager, selection manager, and other
 * viewport subsystems (added in 02-03+) to access the PlayCanvas adapter
 * without prop drilling.
 *
 * The ref holds null until the ViewportCanvas initializes the adapter.
 */
interface ViewportContextValue {
  /** Ref to the PlayCanvas adapter instance. Null until initialized. */
  adapterRef: React.RefObject<PlayCanvasAdapter | null>;
}

const ViewportContext = createContext<ViewportContextValue | null>(null);

/**
 * Provider that holds the PlayCanvas adapter instance ref.
 * Wrap the viewport area with this to give child components access.
 */
export function ViewportProvider({ children }: { children: ReactNode }) {
  const adapterRef = useRef<PlayCanvasAdapter | null>(null);

  return (
    <ViewportContext value={{ adapterRef }}>
      {children}
    </ViewportContext>
  );
}

/**
 * Hook to access the PlayCanvas adapter from any child of ViewportProvider.
 *
 * @returns The adapter ref (may be null if not yet initialized)
 * @throws If used outside of ViewportProvider
 */
export function useViewportAdapter(): React.RefObject<PlayCanvasAdapter | null> {
  const ctx = useContext(ViewportContext);
  if (!ctx) {
    throw new Error("useViewportAdapter must be used within a ViewportProvider");
  }
  return ctx.adapterRef;
}
