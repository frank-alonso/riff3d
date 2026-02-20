"use client";

import { useEffect, useRef, useState } from "react";
import { PlayCanvasAdapter } from "@riff3d/adapter-playcanvas";
import {
  GizmoManager,
  SelectionManager,
  createGrid,
  DragPreviewManager,
  type GridHandle,
} from "@riff3d/adapter-playcanvas/editor-tools";
import { compile } from "@riff3d/canonical-ir";
import { generateOpId } from "@riff3d/ecson";
import type { PatchOp } from "@riff3d/patchops";
import { CURRENT_PATCHOP_VERSION } from "@riff3d/patchops";
import { editorStore } from "@/stores/editor-store";
import { ASSET_DRAG_MIME, getStarterAsset } from "@/lib/asset-manager";
import { useViewportAdapter } from "./viewport-provider";
import { FloatingToolbar } from "./floating-toolbar";
import { ViewportLoader } from "./viewport-loader";

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

  // Loading state for the viewport loader overlay
  const [loadingStage, setLoadingStage] = useState<string | null>(
    "Initializing WebGL...",
  );
  const [loadingProgress, setLoadingProgress] = useState(10);

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
    let windowResizeHandler: (() => void) | null = null;
    let requestAppHandler: (() => void) | null = null;
    let dragPreviewManager: DragPreviewManager | null = null;
    let dragEnterHandler: ((e: globalThis.DragEvent) => void) | null = null;
    let dragOverHandler: ((e: globalThis.DragEvent) => void) | null = null;
    let dragLeaveHandler: ((e: globalThis.DragEvent) => void) | null = null;
    let dropHandler: ((e: globalThis.DragEvent) => void) | null = null;

    // Initialize adapter asynchronously
    void adapter.initialize(canvasRef.current).then(() => {
      const app = adapter.getApp();
      const camera = adapter.getCameraEntity();
      if (!app || !camera) return;

      setLoadingStage("Building scene...");
      setLoadingProgress(50);

      // Load existing scene if available
      const { ecsonDoc } = editorStore.getState();
      if (ecsonDoc) {
        const scene = compile(ecsonDoc);
        adapter.loadScene(scene);
      }

      setLoadingStage("Setting up editor tools...");
      setLoadingProgress(70);

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

      // --- Initialize Drag Preview Manager ---
      const canvasEl = canvasRef.current;
      if (canvasEl) {
        dragPreviewManager = new DragPreviewManager({
          app,
          camera,
          canvas: canvasEl,
          onDrop: (position, assetId) => {
            const asset = getStarterAsset(assetId);
            const doc = editorStore.getState().ecsonDoc;
            if (!asset || !doc) return;

            const parentId = doc.rootEntityId;
            const ops = asset.createOps(parentId);
            if (ops.length === 0) return;

            // Find the new entity ID from the CreateEntity op
            const createOp = ops.find((op) => op.type === "CreateEntity");
            const newEntityId = createOp
              ? (createOp.payload as { entityId: string }).entityId
              : null;

            // Add a SetProperty op to place the entity at the drop position
            if (newEntityId) {
              ops.push({
                id: generateOpId(),
                timestamp: Date.now(),
                origin: "user",
                version: CURRENT_PATCHOP_VERSION,
                type: "SetProperty",
                payload: {
                  entityId: newEntityId,
                  path: "transform.position",
                  value: position,
                  previousValue: { x: 0, y: 0, z: 0 },
                },
              } as PatchOp);
            }

            // Dispatch as BatchOp for atomic undo
            const batchOp: PatchOp = {
              id: generateOpId(),
              timestamp: Date.now(),
              origin: "user",
              version: CURRENT_PATCHOP_VERSION,
              type: "BatchOp",
              payload: { ops },
            };

            editorStore.getState().dispatchOp(batchOp);

            if (newEntityId) {
              editorStore.getState().setSelection([newEntityId]);
            }
          },
        });

        // Wire DOM drag events to the DragPreviewManager
        // The editor layer parses ASSET_DRAG_MIME; the adapter only handles the 3D ghost.
        const dpm = dragPreviewManager;

        dragEnterHandler = (e: globalThis.DragEvent) => {
          if (!e.dataTransfer?.types.includes(ASSET_DRAG_MIME)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          const rect = canvasEl.getBoundingClientRect();
          const assetId = e.dataTransfer.getData(ASSET_DRAG_MIME);
          // On dragenter the getData may be empty due to browser security;
          // store a placeholder and update on drop
          dpm.startPreview(assetId || "__pending__", e.clientX - rect.left, e.clientY - rect.top);
        };

        dragOverHandler = (e: globalThis.DragEvent) => {
          if (!e.dataTransfer?.types.includes(ASSET_DRAG_MIME)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          const rect = canvasEl.getBoundingClientRect();
          dpm.updatePreview(e.clientX - rect.left, e.clientY - rect.top);
        };

        dragLeaveHandler = (e: globalThis.DragEvent) => {
          // Only end preview if actually leaving the canvas (not entering a child)
          if (e.relatedTarget && canvasEl.contains(e.relatedTarget as Node)) return;
          dpm.endPreview();
        };

        dropHandler = (e: globalThis.DragEvent) => {
          const assetId = e.dataTransfer?.getData(ASSET_DRAG_MIME);
          if (!assetId) return;
          e.preventDefault();
          const rect = canvasEl.getBoundingClientRect();
          // Restart preview with real asset ID if we had a placeholder
          dpm.endPreview();
          dpm.startPreview(assetId, e.clientX - rect.left, e.clientY - rect.top);
          dpm.confirmDrop(e.clientX - rect.left, e.clientY - rect.top);
        };

        canvasEl.addEventListener("dragenter", dragEnterHandler);
        canvasEl.addEventListener("dragover", dragOverHandler);
        canvasEl.addEventListener("dragleave", dragLeaveHandler);
        canvasEl.addEventListener("drop", dropHandler);
      }

      setLoadingProgress(90);

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

      // Backup: window resize catches dev-tools open/close and other
      // browser chrome changes that ResizeObserver on the container
      // may miss (the container CSS dimensions don't always update
      // synchronously with the window resize event).
      const onWindowResize = () => {
        requestAnimationFrame(() => adapter.resize());
      };
      window.addEventListener("resize", onWindowResize);
      windowResizeHandler = onWindowResize;

      // Listen for app instance requests (used by GLB import)
      requestAppHandler = () => {
        window.dispatchEvent(
          new CustomEvent("riff3d:provide-app", {
            detail: { app: adapter.getApp() },
          }),
        );
      };
      window.addEventListener("riff3d:request-app", requestAppHandler);

      // Done — dismiss the loader
      setLoadingStage(null);
      setLoadingProgress(100);
    });

    // Cleanup
    return () => {
      docUnsub?.();
      cameraModeUnsub?.();
      gridSizeUnsub?.();
      resizeObserver?.disconnect();
      if (windowResizeHandler) {
        window.removeEventListener("resize", windowResizeHandler);
      }
      if (requestAppHandler) {
        window.removeEventListener("riff3d:request-app", requestAppHandler);
      }
      // Remove drag event listeners from canvas
      if (canvasRef.current) {
        if (dragEnterHandler) canvasRef.current.removeEventListener("dragenter", dragEnterHandler);
        if (dragOverHandler) canvasRef.current.removeEventListener("dragover", dragOverHandler);
        if (dragLeaveHandler) canvasRef.current.removeEventListener("dragleave", dragLeaveHandler);
        if (dropHandler) canvasRef.current.removeEventListener("drop", dropHandler);
      }
      dragPreviewManager?.dispose();
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
      {/* Loading overlay — shown until adapter init + scene build complete */}
      {loadingStage && (
        <ViewportLoader stage={loadingStage} progress={loadingProgress} />
      )}
      {/* Floating toolbar overlay -- receives pointer events, canvas behind gets the rest */}
      <FloatingToolbar />
    </div>
  );
}
