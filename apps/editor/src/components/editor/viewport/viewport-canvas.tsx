"use client";

import { useEffect, useRef } from "react";
import { PlayCanvasAdapter } from "@riff3d/adapter-playcanvas";
import { compile } from "@riff3d/canonical-ir";
import { editorStore } from "@/stores/editor-store";
import { useViewportAdapter } from "./viewport-provider";

/**
 * PlayCanvas viewport canvas component.
 *
 * Renders a <canvas> element that fills its container and initializes
 * the PlayCanvas adapter. Subscribes to the Zustand store to react to:
 * - ecsonDoc changes -> rebuild scene via adapter
 * - cameraMode changes -> switch camera controller
 *
 * Key link: The adapter subscribes to ecsonDoc changes from editorStore
 * and calls adapter.rebuildScene(compile(doc)) when the doc changes.
 *
 * CRITICAL: This component must be loaded with `ssr: false` via dynamic
 * import in the parent to prevent SSR of PlayCanvas (which requires DOM).
 *
 * CRITICAL: Uses isInitialized ref to handle React Strict Mode double-effect.
 */
export function ViewportCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);
  const adapterRef = useViewportAdapter();

  useEffect(() => {
    // Guard against React Strict Mode double-effect
    if (isInitialized.current) return;
    if (!canvasRef.current || !containerRef.current) return;

    isInitialized.current = true;

    const adapter = new PlayCanvasAdapter();
    adapterRef.current = adapter;

    let docUnsub: (() => void) | null = null;
    let cameraModeUnsub: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;

    // Initialize adapter asynchronously
    void adapter.initialize(canvasRef.current).then(() => {
      // Load existing scene if available
      const { ecsonDoc } = editorStore.getState();
      if (ecsonDoc) {
        const scene = compile(ecsonDoc);
        adapter.loadScene(scene);
      }

      // Subscribe to ecsonDoc changes -> rebuild scene
      docUnsub = editorStore.subscribe(
        (state) => state.canonicalScene,
        (canonicalScene) => {
          if (canonicalScene) {
            adapter.rebuildScene(canonicalScene);
          }
        },
      );

      // Subscribe to cameraMode changes -> switch camera controller
      cameraModeUnsub = editorStore.subscribe(
        (state) => state.cameraMode,
        (mode) => {
          adapter.switchCameraMode(mode);
        },
      );

      // Set up ResizeObserver for container resize -> adapter.resize()
      if (containerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          adapter.resize();
        });
        resizeObserver.observe(containerRef.current);
      }
    });

    // Cleanup
    return () => {
      docUnsub?.();
      cameraModeUnsub?.();
      resizeObserver?.disconnect();
      adapter.dispose();
      adapterRef.current = null;
      isInitialized.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        tabIndex={0}
      />
    </div>
  );
}
