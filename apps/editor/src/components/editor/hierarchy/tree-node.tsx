"use client";

import type { NodeRendererProps } from "react-arborist";
import { Box, Sun, Camera, Layers, Minus } from "lucide-react";

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
 * Custom node renderer for react-arborist tree.
 *
 * Shows: expand/collapse arrow (if has children), entity icon (based on
 * primary component type), and entity name. Supports selected, hover,
 * and dragging visual states.
 */
export function TreeNode({
  node,
  style,
  dragHandle,
}: NodeRendererProps<TreeNodeData>) {
  return (
    <div
      ref={dragHandle}
      style={style}
      className={`flex cursor-pointer items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-sm ${
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
    </div>
  );
}
