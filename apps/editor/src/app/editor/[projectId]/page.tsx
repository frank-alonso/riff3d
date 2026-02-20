"use client";

import dynamic from "next/dynamic";

/**
 * Editor page with dynamic import to prevent SSR of 3D engine components.
 * The EditorShell uses browser-only APIs (react-resizable-panels localStorage,
 * zustand, and eventually PlayCanvas canvas).
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

export default function EditorPage() {
  // Read data attributes from the layout container
  // This avoids prop drilling through Next.js page/layout boundary
  if (typeof window === "undefined") return null;

  const container = document.querySelector("[data-project-id]");
  if (!container) return <EditorSkeleton />;

  const projectId = container.getAttribute("data-project-id") ?? "";
  const projectName = container.getAttribute("data-project-name") ?? "Untitled";
  const isOwner = container.getAttribute("data-is-owner") === "true";
  const isPublic = container.getAttribute("data-is-public") === "true";

  return (
    <EditorShell
      projectId={projectId}
      projectName={projectName}
      isOwner={isOwner}
      isPublic={isPublic}
    />
  );
}
