"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";
import { ActivityBar } from "./activity-bar";
import { TopBar } from "./top-bar";
import { useEditorStore } from "@/stores/hooks";
import { editorStore } from "@/stores/editor-store";
import { ViewportProvider } from "@/components/editor/viewport/viewport-provider";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
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
      <div className="flex h-full w-full items-center justify-center bg-[#111111]">
        <div className="flex flex-col items-center gap-3 text-[var(--muted-foreground)]">
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-pulse opacity-30"
          >
            <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
            <path d="M12 12l8-4.5" />
            <path d="M12 12v9" />
            <path d="M12 12L4 7.5" />
          </svg>
          <span className="text-sm opacity-50">Loading viewport...</span>
        </div>
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

  // Register all editor keyboard shortcuts (W/E/R, Escape, Delete, F)
  useKeyboardShortcuts();

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
                <div className="h-full overflow-auto border-r border-[var(--border)] bg-[var(--panel)]">
                  <div className="border-b border-[var(--border)] px-3 py-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                      {activePanel === "hierarchy"
                        ? "Scene Hierarchy"
                        : "Asset Browser"}
                    </h3>
                  </div>
                  <div className="flex items-center justify-center p-4 text-xs text-[var(--muted-foreground)]">
                    {activePanel === "hierarchy"
                      ? "Hierarchy tree will render here (02-03)"
                      : "Asset browser will render here (02-05)"}
                  </div>
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
                <div className="h-full overflow-auto border-l border-[var(--border)] bg-[var(--panel)]">
                  <div className="border-b border-[var(--border)] px-3 py-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                      Inspector
                    </h3>
                  </div>
                  <div className="flex items-center justify-center p-4 text-xs text-[var(--muted-foreground)]">
                    Select an entity to inspect (02-04)
                  </div>
                </div>
              </Panel>
            </>
          )}
        </Group>
      </div>
    </div>
  );
}
