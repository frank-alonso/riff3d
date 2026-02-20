"use client";

import { useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import type { SceneDocument } from "@riff3d/ecson";

/**
 * Editor page with dynamic import to prevent SSR of 3D engine components.
 * The EditorShell uses browser-only APIs (react-resizable-panels localStorage,
 * zustand, PlayCanvas canvas).
 *
 * Project data (including ECSON document) is passed from the server layout
 * via a script tag with id="__RIFF3D_PROJECT_DATA__".
 */
const EditorShell = dynamic(
  () =>
    import("@/components/editor/shell/editor-shell").then(
      (mod) => mod.EditorShell,
    ),
  {
    ssr: false,
    loading: () => <EditorSkeleton />,
  },
);

function EditorSkeleton() {
  return (
    <div className="flex h-full w-full">
      {/* Activity bar skeleton */}
      <div className="w-12 bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-2 p-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-10 w-10 animate-pulse rounded-lg bg-[var(--muted)]"
            />
          ))}
        </div>
      </div>
      {/* Left panel skeleton */}
      <div className="w-64 border-r border-[var(--border)] bg-[var(--panel)]">
        <div className="space-y-2 p-3">
          <div className="h-4 w-24 animate-pulse rounded bg-[var(--muted)]" />
          <div className="h-4 w-full animate-pulse rounded bg-[var(--muted)]" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--muted)]" />
        </div>
      </div>
      {/* Center viewport skeleton */}
      <div className="flex-1 bg-[#111111]" />
      {/* Right panel skeleton */}
      <div className="w-72 border-l border-[var(--border)] bg-[var(--panel)]">
        <div className="space-y-2 p-3">
          <div className="h-4 w-20 animate-pulse rounded bg-[var(--muted)]" />
          <div className="h-4 w-full animate-pulse rounded bg-[var(--muted)]" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--muted)]" />
        </div>
      </div>
    </div>
  );
}

interface ProjectData {
  projectId: string;
  projectName: string;
  isOwner: boolean;
  isPublic: boolean;
  ecson: SceneDocument | null;
}

/**
 * Cached project data snapshot. Parsed once from the DOM script tag and
 * reused on every call. useSyncExternalStore compares snapshots by reference,
 * so returning a new object each time causes an infinite re-render loop.
 */
let cachedProjectData: ProjectData | null | undefined;

/** Read project data from the server-rendered script tag (DOM external store). */
function getProjectDataSnapshot(): ProjectData | null {
  if (cachedProjectData !== undefined) return cachedProjectData;
  if (typeof document === "undefined") return null;
  const scriptEl = document.getElementById("__RIFF3D_PROJECT_DATA__");
  if (!scriptEl?.textContent) {
    cachedProjectData = null;
    return null;
  }
  try {
    const data = JSON.parse(scriptEl.textContent) as {
      projectId: string;
      projectName: string;
      isOwner: boolean;
      isPublic: boolean;
      ecson: SceneDocument | null;
    };
    cachedProjectData = {
      projectId: data.projectId,
      projectName: data.projectName,
      isOwner: data.isOwner,
      isPublic: data.isPublic,
      ecson: data.ecson ?? null,
    };
    return cachedProjectData;
  } catch {
    cachedProjectData = null;
    return null;
  }
}

/** Server snapshot always returns null (no DOM during SSR). */
function getProjectDataServerSnapshot(): ProjectData | null {
  return null;
}

/** No-op subscribe -- the DOM script tag is static after SSR, never changes. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function subscribeToProjectData(onStoreChange: () => void): () => void {
  return () => {};
}

export default function EditorPage() {
  const projectData = useSyncExternalStore(
    subscribeToProjectData,
    getProjectDataSnapshot,
    getProjectDataServerSnapshot,
  );

  if (!projectData) return <EditorSkeleton />;

  return (
    <EditorShell
      projectId={projectData.projectId}
      projectName={projectData.projectName}
      isOwner={projectData.isOwner}
      isPublic={projectData.isPublic}
      ecsonDoc={projectData.ecson}
    />
  );
}
