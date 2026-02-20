"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";
import { ActivityBar } from "./activity-bar";
import { TopBar } from "./top-bar";
import { useEditorStore } from "@/stores/hooks";
import { editorStore } from "@/stores/editor-store";
import { ViewportProvider } from "@/components/editor/viewport/viewport-provider";
import { ViewportLoader } from "@/components/editor/viewport/viewport-loader";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useAutoSave } from "@/hooks/use-auto-save";
import { SceneTree } from "@/components/editor/hierarchy/scene-tree";
import { InspectorPanel } from "@/components/editor/inspector/inspector-panel";
import type { SceneDocument } from "@riff3d/ecson";

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
  const hasLoadedProject = useRef(false);

  // Register all editor keyboard shortcuts (W/E/R, Escape, Delete, F, undo/redo, copy/paste/duplicate)
  useKeyboardShortcuts();

  // Auto-save: monitors docVersion changes and saves ECSON to Supabase
  useAutoSave(projectId);

  // Load project into store on mount
  useEffect(() => {
    if (ecsonDoc && !hasLoadedProject.current) {
      hasLoadedProject.current = true;
      editorStore.getState().loadProject(ecsonDoc);
    }
  }, [ecsonDoc]);

  // Persist panel layouts to localStorage
  const layoutProps = useDefaultLayout({
    id: "riff3d-editor-panels",
    storage: typeof window !== "undefined" ? localStorage : undefined,
  });

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
        {/* Activity Bar -- fixed width, not part of panel group */}
        <ActivityBar />

        {/* Resizable panel layout */}
        <Group
          orientation="horizontal"
          id="riff3d-editor-panels"
          className="flex-1"
          {...layoutProps}
        >
          {/* Left Panel */}
          {activePanel !== null && (
            <>
              <Panel
                id={PANEL_IDS.left}
                defaultSize="20%"
                minSize="15%"
                maxSize="30%"
              >
                <div className="h-full overflow-hidden border-r border-[var(--border)] bg-[var(--panel)]">
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
                    <div className="flex items-center justify-center p-4 text-xs text-[var(--muted-foreground)]">
                      Asset browser will render here (02-05)
                    </div>
                  )}
                </div>
              </Panel>

              <Separator className="w-1 cursor-col-resize bg-transparent transition-colors hover:bg-[var(--accent)]" />
            </>
          )}

          {/* Center: Viewport */}
          <Panel id={PANEL_IDS.center} minSize="30%">
            <div className="flex h-full flex-col">
              {/* PlayCanvas Viewport */}
              <div className="flex-1 bg-[#111111]">
                <ViewportProvider>
                  <ViewportCanvas />
                </ViewportProvider>
              </div>

              {/* Bottom strip placeholder for asset drag-and-drop */}
              <div className="flex h-8 items-center justify-center border-t border-[var(--border)] bg-[var(--panel)] text-xs text-[var(--muted-foreground)] opacity-50">
                Asset drop zone (02-05)
              </div>
            </div>
          </Panel>

          {/* Right Panel: Inspector */}
          {inspectorVisible && (
            <>
              <Separator className="w-1 cursor-col-resize bg-transparent transition-colors hover:bg-[var(--accent)]" />

              <Panel
                id={PANEL_IDS.right}
                defaultSize="22%"
                minSize="18%"
                maxSize="35%"
              >
                <div className="h-full overflow-hidden border-l border-[var(--border)] bg-[var(--panel)]">
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
