"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import dynamic from "next/dynamic";
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";
import { ActivityBar } from "./activity-bar";
import { TopBar } from "./top-bar";
import { useEditorStore } from "@/stores/hooks";
import { editorStore } from "@/stores/editor-store";
import { ViewportProvider } from "@/components/editor/viewport/viewport-provider";
import { ViewportLoader } from "@/components/editor/viewport/viewport-loader";
import { PlayModeBorder } from "@/components/editor/playtest/play-mode-border";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useAutoSave } from "@/hooks/use-auto-save";
import { SceneTree } from "@/components/editor/hierarchy/scene-tree";
import { InspectorPanel } from "@/components/editor/inspector/inspector-panel";
import { AssetBrowser } from "@/components/editor/assets/asset-browser";
import { AssetStrip } from "@/components/editor/assets/asset-strip";
import { ASSET_DRAG_MIME, getStarterAsset } from "@/lib/asset-manager";
import { generateOpId } from "@riff3d/ecson";
import type { SceneDocument } from "@riff3d/ecson";
import { CURRENT_PATCHOP_VERSION } from "@riff3d/patchops";
import type { PatchOp } from "@riff3d/patchops";

/**
 * Dynamically import ViewportCanvas with ssr: false.
 * PlayCanvas requires DOM APIs (canvas, WebGL) that aren't available during SSR.
 */
const ViewportCanvas = dynamic(
  () =>
    import("@/components/editor/viewport/viewport-canvas").then(
      (mod) => mod.ViewportCanvas,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="relative h-full w-full">
        <ViewportLoader stage="Loading 3D engine..." progress={-1} />
      </div>
    ),
  },
);

interface EditorShellProps {
  projectId: string;
  projectName: string;
  isOwner: boolean;
  isPublic: boolean;
  ecsonDoc?: SceneDocument | null;
}

const PANEL_IDS = {
  left: "left-panel",
  center: "center-panel",
  right: "right-panel",
} as const;

export function EditorShell({
  projectId,
  projectName,
  isOwner,
  isPublic,
  ecsonDoc,
}: EditorShellProps) {
  const activePanel = useEditorStore((s) => s.activePanel);
  const inspectorVisible = useEditorStore((s) => s.inspectorVisible);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const hasLoadedProject = useRef(false);

  /**
   * Peekable panel state for play mode.
   * During play mode, panels are collapsed by default.
   * Hovering the left/right edge or clicking activity bar icons
   * temporarily reveals them. Moving away collapses them after a delay.
   *
   * Peek state is only relevant when isPlaying is true. When not playing,
   * showLeftPanel/showRightPanel derivations ignore peek values, so stale
   * peek state from a previous play session is harmless.
   */
  const [leftPeek, setLeftPeek] = useState(false);
  const [rightPeek, setRightPeek] = useState(false);
  const leftPeekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rightPeekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Determine if left panel should show:
   * - Not playing: show if activePanel is set
   * - Playing: show only if peeking
   */
  const showLeftPanel = isPlaying ? leftPeek && activePanel !== null : activePanel !== null;
  const showRightPanel = isPlaying ? rightPeek : inspectorVisible;

  /** Start peek on left panel edge hover / activity bar click */
  const handleLeftPeekEnter = useCallback(() => {
    if (!editorStore.getState().isPlaying) return;
    if (leftPeekTimer.current) clearTimeout(leftPeekTimer.current);
    setLeftPeek(true);
  }, []);

  const handleLeftPeekLeave = useCallback(() => {
    if (!editorStore.getState().isPlaying) return;
    leftPeekTimer.current = setTimeout(() => setLeftPeek(false), 400);
  }, []);

  const handleRightPeekEnter = useCallback(() => {
    if (!editorStore.getState().isPlaying) return;
    if (rightPeekTimer.current) clearTimeout(rightPeekTimer.current);
    setRightPeek(true);
  }, []);

  const handleRightPeekLeave = useCallback(() => {
    if (!editorStore.getState().isPlaying) return;
    rightPeekTimer.current = setTimeout(() => setRightPeek(false), 400);
  }, []);

  // Register all editor keyboard shortcuts (W/E/R, Escape, Delete, F, undo/redo, copy/paste/duplicate)
  useKeyboardShortcuts();

  // Auto-save: monitors docVersion changes and saves ECSON to Supabase
  useAutoSave(projectId);

  // Load project into store on mount and set read-only mode for non-owners
  useEffect(() => {
    if (ecsonDoc && !hasLoadedProject.current) {
      hasLoadedProject.current = true;
      editorStore.getState().setReadOnly(!isOwner);
      editorStore.getState().loadProject(ecsonDoc);
    }
  }, [ecsonDoc, isOwner]);

  // Persist panel layouts to localStorage
  const layoutProps = useDefaultLayout({
    id: "riff3d-editor-panels",
    storage: typeof window !== "undefined" ? localStorage : undefined,
  });

  /**
   * Handle drag-over on the viewport container to allow asset drops.
   */
  const handleViewportDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes(ASSET_DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  /**
   * Handle asset drop on the viewport.
   * Reads the asset ID from the drag data, generates PatchOps, and dispatches.
   */
  const handleViewportDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      const assetId = e.dataTransfer.getData(ASSET_DRAG_MIME);
      if (!assetId) return;

      e.preventDefault();

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
    [],
  );

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      {/* Top Bar */}
      <TopBar
        projectId={projectId}
        projectName={projectName}
        isOwner={isOwner}
        isPublic={isPublic}
      />

      {/* Main area: Activity Bar + Panels */}
      <div className="flex flex-1 overflow-hidden">
        {/* Activity Bar -- fixed width, not part of panel group. Dimmed during play mode. */}
        <div
          className={`transition-opacity duration-300 ${isPlaying ? "opacity-50" : ""}`}
          onMouseEnter={handleLeftPeekEnter}
          onMouseLeave={handleLeftPeekLeave}
        >
          <ActivityBar />
        </div>

        {/* Resizable panel layout */}
        <Group
          orientation="horizontal"
          id="riff3d-editor-panels"
          className="flex-1"
          {...layoutProps}
        >
          {/* Left Panel -- hidden during play mode unless peeking */}
          {showLeftPanel && (
            <>
              <Panel
                id={PANEL_IDS.left}
                defaultSize="20%"
                minSize="15%"
                maxSize="30%"
              >
                <div
                  className="h-full overflow-hidden border-r border-[var(--border)] bg-[var(--panel)]"
                  onMouseEnter={handleLeftPeekEnter}
                  onMouseLeave={handleLeftPeekLeave}
                >
                  <div className="border-b border-[var(--border)] px-3 py-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                      {activePanel === "hierarchy"
                        ? "Scene Hierarchy"
                        : "Asset Browser"}
                    </h3>
                  </div>
                  {activePanel === "hierarchy" ? (
                    <SceneTree />
                  ) : (
                    <AssetBrowser />
                  )}
                </div>
              </Panel>

              <Separator className="w-1 cursor-col-resize bg-transparent transition-colors hover:bg-[var(--accent)]" />
            </>
          )}

          {/* Left peek activation strip -- visible only during play mode when panel is collapsed */}
          {isPlaying && !leftPeek && activePanel !== null && (
            <div
              className="w-1 cursor-pointer bg-transparent transition-colors hover:bg-cyan-500/30"
              onMouseEnter={handleLeftPeekEnter}
            />
          )}

          {/* Center: Viewport */}
          <Panel id={PANEL_IDS.center} minSize="30%">
            <div className="flex h-full flex-col">
              {/* PlayCanvas Viewport with drop handler for asset spawning */}
              <div
                className="relative flex-1 bg-[#111111]"
                onDragOver={handleViewportDragOver}
                onDrop={handleViewportDrop}
              >
                <ViewportProvider>
                  <ViewportCanvas />
                </ViewportProvider>
                {/* Play mode border overlay */}
                <PlayModeBorder />
              </div>

              {/* Compact asset strip for quick drag-and-drop (hidden during play mode) */}
              {!isPlaying && <AssetStrip />}
            </div>
          </Panel>

          {/* Right peek activation strip -- visible only during play mode when panel is collapsed */}
          {isPlaying && !rightPeek && inspectorVisible && (
            <div
              className="w-1 cursor-pointer bg-transparent transition-colors hover:bg-cyan-500/30"
              onMouseEnter={handleRightPeekEnter}
            />
          )}

          {/* Right Panel: Inspector -- hidden during play mode unless peeking */}
          {showRightPanel && (
            <>
              <Separator className="w-1 cursor-col-resize bg-transparent transition-colors hover:bg-[var(--accent)]" />

              <Panel
                id={PANEL_IDS.right}
                defaultSize="22%"
                minSize="18%"
                maxSize="35%"
              >
                <div
                  className="h-full overflow-hidden border-l border-[var(--border)] bg-[var(--panel)]"
                  onMouseEnter={handleRightPeekEnter}
                  onMouseLeave={handleRightPeekLeave}
                >
                  <div className="border-b border-[var(--border)] px-3 py-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                      Inspector
                    </h3>
                  </div>
                  <InspectorPanel />
                </div>
              </Panel>
            </>
          )}
        </Group>
      </div>
    </div>
  );
}
