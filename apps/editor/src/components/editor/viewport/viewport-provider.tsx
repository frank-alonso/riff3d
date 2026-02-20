"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import type { EngineAdapter } from "@riff3d/canonical-ir";

/**
 * Context for sharing the engine adapter instance with child components.
 *
 * Generalized from PlayCanvasAdapter-specific to EngineAdapter interface
 * (04-03) to support engine switching. Components that need PlayCanvas-specific
 * methods should use `instanceof PlayCanvasAdapter` checks on the ref value.
 *
 * The ref holds null until the ViewportCanvas initializes the adapter.
 */
interface ViewportContextValue {
  /** Ref to the engine adapter instance. Null until initialized. */
  adapterRef: React.RefObject<EngineAdapter | null>;
}

const ViewportContext = createContext<ViewportContextValue | null>(null);

/**
 * Provider that holds the engine adapter instance ref.
 * Wrap the viewport area with this to give child components access.
 */
export function ViewportProvider({ children }: { children: ReactNode }) {
  const adapterRef = useRef<EngineAdapter | null>(null);

  return (
    <ViewportContext value={{ adapterRef }}>
      {children}
    </ViewportContext>
  );
}

/**
 * Hook to access the engine adapter from any child of ViewportProvider.
 *
 * @returns The adapter ref (may be null if not yet initialized)
 * @throws If used outside of ViewportProvider
 */
export function useViewportAdapter(): React.RefObject<EngineAdapter | null> {
  const ctx = useContext(ViewportContext);
  if (!ctx) {
    throw new Error("useViewportAdapter must be used within a ViewportProvider");
  }
  return ctx.adapterRef;
}
