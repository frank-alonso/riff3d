"use client";

import type { NodeRendererProps } from "react-arborist";
import { Box, Sun, Camera, Layers, Minus, Lock, Unlock } from "lucide-react";
import { useEditorStore } from "@/stores/hooks";
import { useEntityLocks } from "@/collaboration/hooks/use-entity-locks";
import type { Collaborator } from "@/stores/slices/collab-slice";

/**
 * Tree data shape for each entity node in the scene hierarchy.
 */
export interface TreeNodeData {
  id: string;
  name: string;
  /** Primary component type for icon selection */
  primaryComponent: string | null;
  children: TreeNodeData[];
}

/**
 * Determine the icon to display based on the entity's primary component type.
 */
function getEntityIcon(primaryComponent: string | null) {
  switch (primaryComponent) {
    case "MeshRenderer":
      return <Box className="h-3.5 w-3.5 shrink-0 text-blue-400" />;
    case "Light":
      return <Sun className="h-3.5 w-3.5 shrink-0 text-yellow-400" />;
    case "Camera":
      return <Camera className="h-3.5 w-3.5 shrink-0 text-green-400" />;
    default:
      return <Layers className="h-3.5 w-3.5 shrink-0 text-neutral-400" />;
  }
}

/**
 * Small colored presence chip showing a remote user's initial.
 * Displayed next to entity names when another user has that entity selected.
 */
function PresenceChip({ user }: { user: Collaborator }) {
  const initial = (user.name[0] ?? "?").toUpperCase();
  return (
    <div
      className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
      style={{ backgroundColor: user.color }}
      title={user.name}
    >
      {initial}
    </div>
  );
}

/**
 * Hook to get remote users who have a specific entity selected.
 * Reads from the collab-slice collaborators and presence state.
 */
function useEntityPresence(entityId: string): Collaborator[] {
  const isCollaborating = useEditorStore((s) => s.isCollaborating);
  const collaborators = useEditorStore((s) => s.collaborators);
  const presenceStates = useEditorStore((s) => s.collaboratorPresence);

  if (!isCollaborating || !presenceStates) return [];

  return collaborators.filter((user) => {
    const presence = presenceStates.get(user.id);
    return presence?.selection?.includes(entityId);
  });
}

/**
 * Custom node renderer for react-arborist tree.
 *
 * Shows: expand/collapse arrow (if has children), entity icon (based on
 * primary component type), and entity name. Supports selected, hover,
 * and dragging visual states.
 *
 * Presence indicators: when another user has this entity selected,
 * a 2px left border in the user's color and a small colored chip
 * with their initial appears next to the entity name.
 */
export function TreeNode({
  node,
  style,
  dragHandle,
}: NodeRendererProps<TreeNodeData>) {
  const presenceUsers = useEntityPresence(node.data.id);
  const firstPresenceColor = presenceUsers.length > 0 ? presenceUsers[0]!.color : null;
  const maxChips = 3;
  const visibleChips = presenceUsers.slice(0, maxChips);
  const chipOverflow = presenceUsers.length - maxChips;

  // Lock state (05-04)
  const { getLockInfo, lockEntity, unlockEntity, isCollaborating } = useEntityLocks();
  const lockInfo = getLockInfo(node.data.id);

  return (
    <div
      ref={dragHandle}
      style={{
        ...style,
        borderLeft: firstPresenceColor ? `2px solid ${firstPresenceColor}` : undefined,
      }}
      className={`group flex cursor-pointer items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-sm ${
        node.isSelected
          ? "bg-blue-600/30 text-neutral-100"
          : "text-neutral-300 hover:bg-neutral-700/50"
      } ${node.isDragging ? "opacity-40" : ""}`}
      onClick={(e) => node.handleClick(e)}
      onDoubleClick={() => {
        if (node.isEditable) {
          node.edit();
        }
      }}
    >
      {/* Expand/collapse arrow */}
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center"
        onClick={(e) => {
          e.stopPropagation();
          if (node.isInternal) {
            node.toggle();
          }
        }}
      >
        {node.isInternal ? (
          <Minus
            className={`h-3 w-3 text-neutral-500 transition-transform ${
              node.isOpen ? "" : "-rotate-90"
            }`}
          />
        ) : null}
      </span>

      {/* Entity icon */}
      {getEntityIcon(node.data.primaryComponent)}

      {/* Entity name -- inline editing or display */}
      {node.isEditing ? (
        <input
          type="text"
          className="flex-1 rounded bg-neutral-800 px-1 text-sm text-neutral-100 outline-none ring-1 ring-blue-500"
          defaultValue={node.data.name}
          autoFocus
          onBlur={(e) => node.submit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              node.submit(e.currentTarget.value);
            } else if (e.key === "Escape") {
              node.reset();
            }
          }}
        />
      ) : (
        <span className="min-w-0 flex-1 truncate">{node.data.name}</span>
      )}

      {/* Presence chips: show which remote users have this entity selected */}
      {visibleChips.length > 0 && (
        <div className="flex shrink-0 items-center gap-0.5">
          {visibleChips.map((user) => (
            <PresenceChip key={user.id} user={user} />
          ))}
          {chipOverflow > 0 && (
            <span className="text-[8px] text-neutral-500">+{chipOverflow}</span>
          )}
        </div>
      )}
    </div>
  );
}
