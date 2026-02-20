"use client";

import { useEffect, useRef } from "react";
import {
  PlayCanvasAdapter,
  GizmoManager,
  SelectionManager,
  createGrid,
} from "@riff3d/adapter-playcanvas";
import type { GridHandle } from "@riff3d/adapter-playcanvas";
import { compile } from "@riff3d/canonical-ir";
import { generateOpId } from "@riff3d/ecson";
import type { PatchOp } from "@riff3d/patchops";
import { CURRENT_PATCHOP_VERSION } from "@riff3d/patchops";
import { editorStore } from "@/stores/editor-store";
import { useViewportAdapter } from "./viewport-provider";
import { FloatingToolbar } from "./floating-toolbar";

/**
 * PlayCanvas viewport canvas component.
 *
 * Renders a <canvas> element that fills its container and initializes
 * the PlayCanvas adapter. Subscribes to the Zustand store to react to:
 * - ecsonDoc changes -> rebuild scene via adapter
 * - cameraMode changes -> switch camera controller
 *
 * Also initializes editor subsystems:
 * - GizmoManager: transform gizmos attached to selected entities
 * - SelectionManager: click, shift-click, box-select entity picking
 * - Grid: ground plane with configurable grid size
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
    let gridSizeUnsub: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let gizmoManager: GizmoManager | null = null;
    let selectionManager: SelectionManager | null = null;
    let gridHandle: GridHandle | null = null;

    // Initialize adapter asynchronously
    void adapter.initialize(canvasRef.current).then(() => {
      const app = adapter.getApp();
      const camera = adapter.getCameraEntity();
      if (!app || !camera) return;

      // Load existing scene if available
      const { ecsonDoc } = editorStore.getState();
      if (ecsonDoc) {
        const scene = compile(ecsonDoc);
        adapter.loadScene(scene);
      }

      // --- Initialize Grid ---
      const initialGridSize = editorStore.getState().gridSize;
      gridHandle = createGrid(app, initialGridSize);

      // Subscribe to grid size changes
      gridSizeUnsub = editorStore.subscribe(
        (state) => state.gridSize,
        (newGridSize) => {
          gridHandle?.updateGridSize(newGridSize);
        },
      );

      // --- Initialize Gizmo Manager ---
      const entityMap = adapter.getTypedEntityMap();

      /**
       * Dispatch a transform PatchOp when a gizmo drag ends.
       * Creates a SetProperty op with the entity path and values.
       */
      const dispatchTransform = (
        entityId: string,
        path: string,
        value: { x: number; y: number; z: number; w?: number },
        previousValue: { x: number; y: number; z: number; w?: number },
      ) => {
        const op: PatchOp = {
          id: generateOpId(),
          timestamp: Date.now(),
          origin: "user",
          version: CURRENT_PATCHOP_VERSION,
          type: "SetProperty",
          payload: { entityId, path, value, previousValue },
        };
        editorStore.getState().dispatchOp(op);
      };

      gizmoManager = new GizmoManager(app, camera, entityMap, dispatchTransform);
      gizmoManager.initialize(editorStore);

      // --- Initialize Selection Manager ---
      const setSelection = (ids: string[]) => {
        editorStore.getState().setSelection(ids);
      };

      selectionManager = new SelectionManager(app, camera, entityMap, setSelection, editorStore);
      selectionManager.initialize();

      // Subscribe to ecsonDoc changes -> rebuild scene and update managers
      docUnsub = editorStore.subscribe(
        (state) => state.canonicalScene,
        (canonicalScene) => {
          if (canonicalScene) {
            adapter.rebuildScene(canonicalScene);
            // Update entity map references in managers after rebuild
            const newEntityMap = adapter.getTypedEntityMap();
            gizmoManager?.updateEntityMap(newEntityMap);
            selectionManager?.updateEntityMap(newEntityMap);
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
      gridSizeUnsub?.();
      resizeObserver?.disconnect();
      gizmoManager?.dispose();
      selectionManager?.dispose();
      gridHandle?.dispose();
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
      {/* Floating toolbar overlay -- receives pointer events, canvas behind gets the rest */}
      <FloatingToolbar />
    </div>
  );
}
