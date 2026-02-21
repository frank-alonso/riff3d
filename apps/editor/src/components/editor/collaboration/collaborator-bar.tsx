"use client";

import { useEditorStore } from "@/stores/hooks";

/**
 * Collaborator bar component for the top bar.
 *
 * Shows colored circles with user initials for each remote collaborator.
 * - Max 5 visible, overflow shows "+N" badge
 * - Tooltip on hover shows full name
 * - Only visible when isCollaborating is true
 *
 * Reads from collab-slice `collaborators` array (updated by
 * the awareness hook or provider onAwarenessUpdate).
 */
export function CollaboratorBar() {
  const isCollaborating = useEditorStore((s) => s.isCollaborating);
  const collaborators = useEditorStore((s) => s.collaborators);

  if (!isCollaborating || collaborators.length === 0) return null;

  const maxVisible = 5;
  const visible = collaborators.slice(0, maxVisible);
  const overflow = collaborators.length - maxVisible;

  return (
    <div className="flex items-center gap-1">
      {visible.map((user) => {
        const initials = getInitials(user.name);
        return (
          <div
            key={user.id}
            className="group relative flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
            style={{ backgroundColor: user.color }}
            title={user.name}
          >
            {initials}
            {/* Tooltip */}
            <div className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              {user.name}
            </div>
          </div>
        );
      })}
      {overflow > 0 && (
        <div
          className="flex h-6 items-center justify-center rounded-full bg-neutral-600 px-1.5 text-[10px] font-medium text-neutral-200"
          title={`${overflow} more collaborator${overflow > 1 ? "s" : ""}`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

/**
 * Extract initials from a display name.
 * "Alice B" -> "AB", "alice" -> "A", "A" -> "A"
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]![0]!.toUpperCase()}${parts[1]![0]!.toUpperCase()}`;
  }
  return (parts[0]?.[0] ?? "?").toUpperCase();
}
