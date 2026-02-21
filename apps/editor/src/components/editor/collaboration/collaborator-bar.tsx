"use client";

import { useEditorStore } from "@/stores/hooks";

/**
 * Collaborator bar component for the top bar.
 *
 * Shows colored circles with user initials for all collaborators,
 * including the local user (distinguished with a ring outline).
 * - Max 5 visible, overflow shows "+N" badge
 * - Tooltip on hover shows full name ("You" suffix for local user)
 * - Only visible when isCollaborating is true
 *
 * Reads from collab-slice `collaborators` array (remote users, updated
 * by the awareness hook) plus local user info (userColor, userName).
 */
export function CollaboratorBar() {
  const isCollaborating = useEditorStore((s) => s.isCollaborating);
  const collaborators = useEditorStore((s) => s.collaborators);
  const userColor = useEditorStore((s) => s.userColor);
  const userName = useEditorStore((s) => s.userName);

  if (!isCollaborating) return null;

  // Build full list: local user first, then remote collaborators
  const allUsers = [
    ...(userColor ? [{ id: "local", name: userName || "You", color: userColor, isLocal: true }] : []),
    ...collaborators.map((c) => ({ ...c, isLocal: false })),
  ];

  if (allUsers.length === 0) return null;

  const maxVisible = 5;
  const visible = allUsers.slice(0, maxVisible);
  const overflow = allUsers.length - maxVisible;

  return (
    <div className="flex items-center gap-1">
      {visible.map((user) => {
        const initials = getInitials(user.name);
        const tooltip = user.isLocal ? `${user.name} (You)` : user.name;
        return (
          <div
            key={user.id}
            className={`group relative flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ${user.isLocal ? "ring-2 ring-white/40" : ""}`}
            style={{ backgroundColor: user.color }}
            title={tooltip}
          >
            {initials}
            {/* Tooltip */}
            <div className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              {tooltip}
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
