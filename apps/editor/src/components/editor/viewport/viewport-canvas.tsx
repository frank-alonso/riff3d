"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { PlayCanvasAdapter } from "@riff3d/adapter-playcanvas";
import {
  GizmoManager,
  SelectionManager,
  createGrid,
  DragPreviewManager,
  PresenceRenderer,
  AvatarRenderer,
  LockRenderer,
  type GridHandle,
  type RemoteUserPresence,
} from "@riff3d/adapter-playcanvas/editor-tools";
import type { BabylonAdapter } from "@riff3d/adapter-babylon";
import type { BabylonSelectionManager as BabylonSelectionManagerType } from "@riff3d/adapter-babylon";
import type { EngineAdapter, SerializedCameraState } from "@riff3d/canonical-ir";
import { compile } from "@riff3d/canonical-ir";
import { generateOpId } from "@riff3d/ecson";
import type { PatchOp } from "@riff3d/patchops";
import { CURRENT_PATCHOP_VERSION } from "@riff3d/patchops";
import { editorStore } from "@/stores/editor-store";
import { useEditorStore } from "@/stores/hooks";
import { ASSET_DRAG_MIME, getStarterAsset } from "@/lib/asset-manager";
import { getLockedEntities, type AwarenessLike } from "@/collaboration/lock-manager";
import { AvatarController } from "@/collaboration/avatar-controller";
import { updatePresence } from "@/collaboration/awareness-state";
import { useViewportAdapter } from "./viewport-provider";
import { FloatingToolbar } from "./floating-toolbar";
import { ViewportLoader } from "./viewport-loader";
import type { EngineType } from "@/stores/slices/engine-slice";

/**
 * Engine-agnostic viewport canvas component.
 *
 * Renders a <canvas> element that fills its container and initializes
 * the appropriate engine adapter based on `activeEngine` from the store.
 * Reacts to engine switches by disposing the old adapter, preserving
 * camera state, and creating a new adapter.
 *
 * Subscribes to the Zustand store for:
 * - activeEngine changes -> switch adapter (dispose old, create new)
 * - canonicalScene changes -> apply delta or rebuild scene
 * - cameraMode changes -> switch camera controller (PlayCanvas only)
 *
 * Editor subsystems:
 * - GizmoManager: transform gizmos attached to selected entities (PlayCanvas only)
 * - SelectionManager: click, shift-click, box-select entity picking (PlayCanvas)
 * - BabylonSelectionManager: click-to-select entity picking (Babylon)
 * - Grid: ground plane with configurable grid size (PlayCanvas only)
 * - DragPreviewManager: ghost placement for asset drag-and-drop (PlayCanvas only)
 *
 * CRITICAL: This component must be loaded with `ssr: false` via dynamic
 * import in the parent to prevent SSR of PlayCanvas/Babylon (which require DOM).
 *
 * CRITICAL: Uses switchCounter ref to track engine switches and ensure
 * stale async initialization callbacks do not interfere with newer ones.
 */
export function ViewportCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useViewportAdapter();

  // Engine state from store
  const activeEngine = useEditorStore((s) => s.activeEngine);
  const isSwitchingEngine = useEditorStore((s) => s.isSwitchingEngine);

  // Camera state preserved across engine switches
  const pendingCameraState = useRef<SerializedCameraState | null>(null);

  // Switch counter to invalidate stale async callbacks
  const switchCounter = useRef(0);

  // Loading state for the viewport loader overlay
  const [loadingStage, setLoadingStage] = useState<string | null>(
    "Initializing WebGL...",
  );
  const [loadingProgress, setLoadingProgress] = useState(10);

  /**
   * Create an adapter instance for the given engine type.
   * Babylon adapter is dynamically imported to avoid loading Babylon.js
   * when not needed.
   */
  const createAdapter = useCallback(
    async (engineType: EngineType): Promise<EngineAdapter> => {
      if (engineType === "babylon") {
        const { BabylonAdapter } = await import("@riff3d/adapter-babylon");
        return new BabylonAdapter();
      }
      return new PlayCanvasAdapter();
    },
    [],
  );

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // Capture refs for use in cleanup (React lint rule: refs may change by cleanup time)
    const canvasEl = canvasRef.current;

    // Increment switch counter to invalidate any in-flight initialization
    const currentSwitch = ++switchCounter.current;

    // Serialize camera state from the previous adapter before disposing
    const previousAdapter = adapterRef.current;
    if (previousAdapter) {
      pendingCameraState.current = previousAdapter.serializeCameraState();
      previousAdapter.dispose();
      adapterRef.current = null;
    }

    // Show loading overlay
    setLoadingStage(
      activeEngine === "babylon"
        ? "Initializing Babylon.js..."
        : "Initializing PlayCanvas...",
    );
    setLoadingProgress(10);
    editorStore.getState().setEngineSwitching(true);

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
    let presenceRenderer: PresenceRenderer | null = null;
    let avatarRenderer: AvatarRenderer | null = null;
    let presenceUnsub: (() => void) | null = null;
    let avatarController: AvatarController | null = null;
    let avatarModeUnsub: (() => void) | null = null;
    let lockRenderer: LockRenderer | null = null;
    let lockUnsub: (() => void) | null = null;
    let dragEnterHandler: ((e: globalThis.DragEvent) => void) | null = null;
    let dragOverHandler: ((e: globalThis.DragEvent) => void) | null = null;
    let dragLeaveHandler: ((e: globalThis.DragEvent) => void) | null = null;
    let dropHandler: ((e: globalThis.DragEvent) => void) | null = null;
    let adapter: EngineAdapter | null = null;
    let babylonSelectionManager: BabylonSelectionManagerType | null = null;

    // Initialize adapter asynchronously.
    // A small delay between dispose and initialize allows the GPU context
    // to fully release, preventing the Babylon-first race condition (CF-P4-06)
    // where switching from Babylon to PlayCanvas would sometimes fail to render.
    const initAdapter = async () => {
      // Wait one frame + 50ms for the previous engine's GPU context to release.
      // This is essential when switching from Babylon (which holds a WebGL context
      // via Engine) to PlayCanvas -- without the delay, PlayCanvas may fail to
      // acquire the context and render a blank viewport.
      if (previousAdapter) {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            setTimeout(resolve, 50);
          });
        });
      }

      // Stale check after delay
      if (currentSwitch !== switchCounter.current) return;

      const newAdapter = await createAdapter(activeEngine);

      // Stale check: if another switch happened while we were creating,
      // dispose this adapter and bail out
      if (currentSwitch !== switchCounter.current) {
        newAdapter.dispose();
        return;
      }

      adapter = newAdapter;
      adapterRef.current = adapter;

      setLoadingStage("Initializing engine...");
      setLoadingProgress(30);

      await adapter.initialize(canvasRef.current!);

      // Another stale check after async initialize
      if (currentSwitch !== switchCounter.current) {
        adapter.dispose();
        return;
      }

      setLoadingStage("Building scene...");
      setLoadingProgress(50);

      // Load existing scene if available
      const { ecsonDoc } = editorStore.getState();
      if (ecsonDoc) {
        const scene = compile(ecsonDoc);
        adapter.loadScene(scene);
      }

      // Restore camera state from previous engine (if switching)
      if (pendingCameraState.current) {
        adapter.restoreCameraState(pendingCameraState.current);
        pendingCameraState.current = null;
      }

      // Reset selection on engine switch (per locked decision)
      editorStore.getState().setSelection([]);

      setLoadingStage("Setting up editor tools...");
      setLoadingProgress(70);

      // --- PlayCanvas-specific editor tools (gizmos, selection, grid, drag preview) ---
      if (activeEngine === "playcanvas" && adapter instanceof PlayCanvasAdapter) {
        const pcAdapter = adapter;
        const app = pcAdapter.getApp();
        const camera = pcAdapter.getCameraEntity();

        if (app && camera) {
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
          const entityMap = pcAdapter.getTypedEntityMap();

          /**
           * Dispatch a transform PatchOp when a gizmo drag ends.
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

                const createOp = ops.find((op) => op.type === "CreateEntity");
                const newEntityId = createOp
                  ? (createOp.payload as { entityId: string }).entityId
                  : null;

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

            const dpm = dragPreviewManager;

            dragEnterHandler = (e: globalThis.DragEvent) => {
              if (!e.dataTransfer?.types.includes(ASSET_DRAG_MIME)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              const rect = canvasEl.getBoundingClientRect();
              const assetId = e.dataTransfer.getData(ASSET_DRAG_MIME);
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
              if (e.relatedTarget && canvasEl.contains(e.relatedTarget as Node)) return;
              dpm.endPreview();
            };

            dropHandler = (e: globalThis.DragEvent) => {
              const assetId = e.dataTransfer?.getData(ASSET_DRAG_MIME);
              if (!assetId) return;
              e.preventDefault();
              const rect = canvasEl.getBoundingClientRect();
              dpm.endPreview();
              dpm.startPreview(assetId, e.clientX - rect.left, e.clientY - rect.top);
              dpm.confirmDrop(e.clientX - rect.left, e.clientY - rect.top);
            };

            canvasEl.addEventListener("dragenter", dragEnterHandler);
            canvasEl.addEventListener("dragover", dragOverHandler);
            canvasEl.addEventListener("dragleave", dragLeaveHandler);
            canvasEl.addEventListener("drop", dropHandler);
          }

          // --- Initialize Lock Renderer (05-04) ---
          // Draws colored wireframe bounding boxes around locked entities
          lockRenderer = new LockRenderer(app, entityMap);

          // Subscribe to awareness lock changes by polling _lockAwareness
          // from collab-slice. The lock renderer updates every frame, so
          // we just need to update the lock map when awareness changes.
          const updateLockVisuals = () => {
            const awareness = editorStore.getState()._lockAwareness as AwarenessLike | null;
            if (!awareness || !lockRenderer) {
              lockRenderer?.updateLocks(new Map());
              return;
            }
            const locked = getLockedEntities(awareness, awareness.clientID);
            const visuals = new Map<string, { color: string }>();
            for (const [eid, entry] of locked) {
              // Only show wireframes for entities locked by OTHER users
              if (!entry.lockedByMe) {
                visuals.set(eid, { color: entry.holder.color });
              }
            }
            lockRenderer.updateLocks(visuals);
          };

          // Subscribe to collab state changes to update lock visuals
          lockUnsub = editorStore.subscribe(
            (state) => state._lockAwareness,
            () => {
              updateLockVisuals();
              // Also register awareness change listener
              const awareness = editorStore.getState()._lockAwareness as AwarenessLike | null;
              if (awareness) {
                awareness.on("change", updateLockVisuals);
              }
            },
          );

          // Initial check
          updateLockVisuals();

          // --- Initialize Presence Renderer (05-03) ---
          // Draws frustum cones with floating name labels for remote users
          presenceRenderer = new PresenceRenderer(app, camera);
          presenceRenderer.start();

          // --- Initialize Avatar Renderer (05-05) ---
          // Draws colored capsule avatars for remote users in avatar mode
          avatarRenderer = new AvatarRenderer(app, camera);
          avatarRenderer.start();

          // Subscribe to collaborator presence changes to feed both renderers
          presenceUnsub = editorStore.subscribe(
            (state) => state.collaboratorPresence,
            (presenceMap) => {
              if (!presenceMap) {
                presenceRenderer?.update([]);
                avatarRenderer?.update([]);
                return;
              }
              const collaborators = editorStore.getState().collaborators;
              const remoteUsers: RemoteUserPresence[] = [];
              for (const collab of collaborators) {
                const presence = presenceMap.get(collab.id);
                if (presence?.camera) {
                  remoteUsers.push({
                    name: collab.name,
                    color: collab.color,
                    position: presence.camera.position,
                    rotation: presence.camera.rotation,
                    fov: presence.camera.fov,
                    mode: presence.mode ?? "editor",
                  });
                }
              }
              // Both renderers receive the full list; each filters by mode internally
              // PresenceRenderer renders mode=editor users (frustum cones)
              // AvatarRenderer renders mode=avatar users (capsules)
              presenceRenderer?.update(remoteUsers);
              avatarRenderer?.update(remoteUsers);
            },
          );

          // --- Initialize Avatar Controller (05-05) ---
          // WASD ground-plane movement when local user enters avatar mode
          const pcAdapterForAvatar = pcAdapter;
          const cameraController = pcAdapterForAvatar.getCameraController();

          if (canvasEl && cameraController) {
            avatarController = new AvatarController(canvasEl, camera, app);

            // Set up awareness broadcast callback for avatar position
            avatarController.setBroadcastCallback((cameraState) => {
              const awareness = editorStore.getState()._lockAwareness;
              if (awareness) {
                (awareness as { setLocalStateField: (k: string, v: unknown) => void })
                  .setLocalStateField("camera", cameraState);
              }
            });

            // Subscribe to avatar mode toggle
            avatarModeUnsub = editorStore.subscribe(
              (state) => state.isAvatarMode,
              (isAvatarMode) => {
                if (isAvatarMode) {
                  // Enter avatar mode: disable normal camera, enable avatar controller
                  cameraController.disable();
                  avatarController?.enable();
                  // Update awareness mode
                  const awareness = editorStore.getState()._lockAwareness;
                  if (awareness) {
                    updatePresence(
                      awareness as { setLocalStateField: (k: string, v: unknown) => void },
                      { mode: "avatar" },
                    );
                  }
                } else {
                  // Exit avatar mode: disable avatar controller, enable normal camera
                  avatarController?.disable();
                  cameraController.enable();
                  // Update awareness mode
                  const awareness = editorStore.getState()._lockAwareness;
                  if (awareness) {
                    updatePresence(
                      awareness as { setLocalStateField: (k: string, v: unknown) => void },
                      { mode: "editor" },
                    );
                  }
                }
              },
            );

            // If avatar mode was already active when adapter initialized
            if (editorStore.getState().isAvatarMode) {
              cameraController.disable();
              avatarController.enable();
              const awareness = editorStore.getState()._lockAwareness;
              if (awareness) {
                updatePresence(
                  awareness as { setLocalStateField: (k: string, v: unknown) => void },
                  { mode: "avatar" },
                );
              }
            }
          }

          // Listen for app instance requests (used by GLB import)
          requestAppHandler = () => {
            window.dispatchEvent(
              new CustomEvent("riff3d:provide-app", {
                detail: { app: pcAdapter.getApp() },
              }),
            );
          };
          window.addEventListener("riff3d:request-app", requestAppHandler);
        }
      }

      // --- Babylon-specific editor tools (selection) ---
      // Basic click-to-select for the validation adapter.
      if (activeEngine === "babylon") {
        const { BabylonAdapter: BabylonAdapterClass, BabylonSelectionManager } =
          await import("@riff3d/adapter-babylon");

        // Stale check after dynamic import
        if (currentSwitch !== switchCounter.current) return;

        if (adapter instanceof BabylonAdapterClass) {
          const bjsAdapter = adapter;
          const bjsScene = bjsAdapter.getScene();
          const bjsCanvas = bjsAdapter.getCanvas();

          if (bjsScene && bjsCanvas) {
            const entityMap = bjsAdapter.getTypedEntityMap();
            const setSelection = (ids: string[]) => {
              editorStore.getState().setSelection(ids);
            };

            babylonSelectionManager = new BabylonSelectionManager(
              bjsScene,
              bjsCanvas,
              entityMap,
              setSelection,
              editorStore,
            );
            babylonSelectionManager.initialize();
          }
        }
      }

      setLoadingProgress(90);

      // --- Delta-aware canonicalScene subscriber ---
      // Routes between adapter.applyDelta() (O(1) property updates) and
      // adapter.rebuildScene() (structural changes). The lastDelta field
      // was added by 04-02 to scene-slice.
      docUnsub = editorStore.subscribe(
        (state) => state.canonicalScene,
        (canonicalScene) => {
          if (!canonicalScene || !adapter) return;
          const { lastDelta } = editorStore.getState();
          if (lastDelta && lastDelta.type !== "full-rebuild") {
            adapter.applyDelta(lastDelta);
          } else {
            adapter.rebuildScene(canonicalScene);
          }
          // Update entity map references for editor tools
          if (adapter instanceof PlayCanvasAdapter) {
            const newEntityMap = adapter.getTypedEntityMap();
            gizmoManager?.updateEntityMap(newEntityMap);
            selectionManager?.updateEntityMap(newEntityMap);
            lockRenderer?.updateEntityMap(newEntityMap);
          } else if (babylonSelectionManager) {
            // Dynamic import -- check if adapter has getTypedEntityMap
            const bjsAdapter = adapter as BabylonAdapter;
            if (bjsAdapter.getTypedEntityMap) {
              babylonSelectionManager.updateEntityMap(bjsAdapter.getTypedEntityMap());
            }
          }
        },
      );

      // Subscribe to cameraMode changes -> switch camera controller (PlayCanvas only)
      if (activeEngine === "playcanvas" && adapter instanceof PlayCanvasAdapter) {
        const pcAdapter = adapter;
        cameraModeUnsub = editorStore.subscribe(
          (state) => state.cameraMode,
          (mode) => {
            pcAdapter.switchCameraMode(mode);
          },
        );
      }

      // Set up ResizeObserver for container resize -> adapter.resize()
      // Uses requestAnimationFrame batching to avoid excessive redraws
      // when the browser fires multiple resize events rapidly (CF-P4-07).
      if (containerRef.current && adapter) {
        const a = adapter;
        let resizeRafId: number | null = null;
        resizeObserver = new ResizeObserver(() => {
          if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
          resizeRafId = requestAnimationFrame(() => {
            resizeRafId = null;
            a.resize();
          });
        });
        resizeObserver.observe(containerRef.current);
      }

      // Backup: window resize catches dev-tools open/close
      if (adapter) {
        const a = adapter;
        let windowRafId: number | null = null;
        const onWindowResize = () => {
          if (windowRafId !== null) cancelAnimationFrame(windowRafId);
          windowRafId = requestAnimationFrame(() => {
            windowRafId = null;
            a.resize();
          });
        };
        window.addEventListener("resize", onWindowResize);
        windowResizeHandler = onWindowResize;
      }

      // Done -- dismiss the loader and clear switching state
      setLoadingStage(null);
      setLoadingProgress(100);
      editorStore.getState().setEngineSwitching(false);
    };

    void initAdapter();

    // Cleanup function: disposes adapter and removes all subscriptions.
    // Uses switchCounter via currentSwitch (captured above) + increment
    // to invalidate stale async callbacks.
    return () => {
      // Invalidate any in-flight async callbacks
      switchCounter.current = currentSwitch + 1;

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
      if (canvasEl) {
        if (dragEnterHandler) canvasEl.removeEventListener("dragenter", dragEnterHandler);
        if (dragOverHandler) canvasEl.removeEventListener("dragover", dragOverHandler);
        if (dragLeaveHandler) canvasEl.removeEventListener("dragleave", dragLeaveHandler);
        if (dropHandler) canvasEl.removeEventListener("drop", dropHandler);
      }
      dragPreviewManager?.dispose();
      presenceRenderer?.dispose();
      avatarRenderer?.dispose();
      presenceUnsub?.();
      avatarController?.dispose();
      avatarModeUnsub?.();
      lockRenderer?.dispose();
      lockUnsub?.();
      gizmoManager?.dispose();
      selectionManager?.dispose();
      babylonSelectionManager?.dispose();
      gridHandle?.dispose();
      if (adapter) {
        adapter.dispose();
        adapter = null;
      }
      adapterRef.current = null;
    };
  }, [activeEngine, createAdapter, adapterRef]);

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
      {/* Loading overlay -- shown until adapter init + scene build complete */}
      {(loadingStage || isSwitchingEngine) && (
        <ViewportLoader
          stage={loadingStage ?? "Switching engine..."}
          progress={loadingProgress}
        />
      )}
      {/* Floating toolbar overlay -- receives pointer events, canvas behind gets the rest */}
      <FloatingToolbar />
    </div>
  );
}
