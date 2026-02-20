"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Tree } from "react-arborist";
import type { TreeApi, MoveHandler, RenameHandler } from "react-arborist";
import { Search } from "lucide-react";
import { useEditorStore } from "@/stores/hooks";
import { editorStore } from "@/stores/editor-store";
import { generateOpId } from "@riff3d/ecson";
import type { PatchOp } from "@riff3d/patchops";
import { CURRENT_PATCHOP_VERSION } from "@riff3d/patchops";
import { TreeNode, type TreeNodeData } from "./tree-node";
import { TreeContextMenu } from "./tree-context-menu";

/**
 * Build a tree data structure from a flat ECSON entity map.
 *
 * The ECSON document stores entities in a flat Record<string, Entity> with
 * parentId references. This function converts that to the nested TreeNodeData[]
 * structure that react-arborist expects.
 */
function buildTreeData(
  entities: Record<string, { id: string; name: string; parentId: string | null; children: string[]; components: { type: string }[] }>,
  rootEntityId: string,
): TreeNodeData[] {
  function buildNode(entityId: string): TreeNodeData | null {
    const entity = entities[entityId];
    if (!entity) return null;

    // Determine primary component for icon
    const primaryComponent = entity.components.length > 0
      ? entity.components[0].type
      : null;

    // Recursively build children, using entity.children for ordering
    const children: TreeNodeData[] = [];
    for (const childId of entity.children) {
      const childNode = buildNode(childId);
      if (childNode) {
        children.push(childNode);
      }
    }

    return {
      id: entity.id,
      name: entity.name,
      primaryComponent,
      children,
    };
  }

  // Start from root entity and return its children as the tree data
  // (root itself is not shown in the tree, its children are the top-level items)
  const rootEntity = entities[rootEntityId];
  if (!rootEntity) return [];

  const topLevelNodes: TreeNodeData[] = [];
  for (const childId of rootEntity.children) {
    const node = buildNode(childId);
    if (node) {
      topLevelNodes.push(node);
    }
  }

  return topLevelNodes;
}

interface ContextMenuState {
  x: number;
  y: number;
  entityId: string | null;
}

/**
 * Scene hierarchy tree component.
 *
 * Uses react-arborist to render a tree view of all entities in the scene.
 * Supports:
 * - Click-to-select (synced with viewport selection)
 * - Multi-select (Ctrl/Cmd-click and Shift-click)
 * - Drag-to-reparent (dispatches Reparent PatchOp)
 * - Search/filter by entity name
 * - Inline rename (double-click)
 * - Context menu (right-click) for add/delete/rename
 *
 * Key link: setSelection() syncs tree selection with viewport via editorStore.
 * Key link: Reparent PatchOp dispatched on drag-drop updates ECSON hierarchy.
 */
export function SceneTree() {
  const ecsonDoc = useEditorStore((s) => s.ecsonDoc);
  const selectedEntityIds = useEditorStore((s) => s.selectedEntityIds);
  const [searchTerm, setSearchTerm] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const treeRef = useRef<TreeApi<TreeNodeData> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [treeHeight, setTreeHeight] = useState(400);

  // Measure container for tree height
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setTreeHeight(entry.contentRect.height);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Build tree data from flat ECSON entity map
  const treeData = useMemo(() => {
    if (!ecsonDoc) return [];
    return buildTreeData(ecsonDoc.entities, ecsonDoc.rootEntityId);
  }, [ecsonDoc]);

  // Sync selection from store to tree -- convert array to pipe-separated string
  // react-arborist uses a string ID for single selection
  const selectionString = useMemo(() => {
    if (selectedEntityIds.length === 0) return undefined;
    // react-arborist doesn't accept multi-select via props directly
    // We'll use the selection prop for single selection
    return selectedEntityIds[0];
  }, [selectedEntityIds]);

  // Handle tree node selection -> sync to store
  const handleSelect = useCallback(
    (nodes: { id: string }[]) => {
      const ids = nodes.map((n) => n.id);
      editorStore.getState().setSelection(ids);
    },
    [],
  );

  // Handle drag-to-reparent -> dispatch Reparent PatchOp
  const handleMove: MoveHandler<TreeNodeData> = useCallback(
    ({ dragIds, parentId: newParentId, index }) => {
      if (!ecsonDoc) return;

      // Use rootEntityId as parent when dropping at top level
      const targetParentId = newParentId ?? ecsonDoc.rootEntityId;

      for (const entityId of dragIds) {
        const entity = ecsonDoc.entities[entityId];
        if (!entity) continue;

        const oldParentId = entity.parentId;
        if (!oldParentId) continue; // Can't reparent root

        // Calculate old index
        const oldParent = ecsonDoc.entities[oldParentId];
        const oldIndex = oldParent
          ? oldParent.children.indexOf(entityId)
          : 0;

        const op: PatchOp = {
          id: generateOpId(),
          timestamp: Date.now(),
          origin: "user",
          version: CURRENT_PATCHOP_VERSION,
          type: "Reparent",
          payload: {
            entityId,
            newParentId: targetParentId,
            oldParentId,
            oldIndex,
            newIndex: index,
          },
        };

        editorStore.getState().dispatchOp(op);
      }
    },
    [ecsonDoc],
  );

  // Handle inline rename -> dispatch SetProperty PatchOp
  const handleRename: RenameHandler<TreeNodeData> = useCallback(
    ({ id, name }) => {
      if (!ecsonDoc) return;
      const entity = ecsonDoc.entities[id];
      if (!entity) return;

      const op: PatchOp = {
        id: generateOpId(),
        timestamp: Date.now(),
        origin: "user",
        version: CURRENT_PATCHOP_VERSION,
        type: "SetProperty",
        payload: {
          entityId: id,
          path: "name",
          value: name,
          previousValue: entity.name,
        },
      };

      editorStore.getState().dispatchOp(op);
    },
    [ecsonDoc],
  );

  // Search match function for react-arborist
  const searchMatch = useCallback(
    (node: { data: TreeNodeData }, term: string) => {
      return node.data.name.toLowerCase().includes(term.toLowerCase());
    },
    [],
  );

  // Context menu handler
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      // Try to determine which entity was right-clicked by checking target
      const target = e.target as HTMLElement;
      const nodeEl = target.closest("[data-testid]") as HTMLElement | null;
      const entityId = nodeEl?.dataset.testid ?? null;

      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        entityId,
      });
    },
    [],
  );

  if (!ecsonDoc) {
    return (
      <div className="flex items-center justify-center p-4 text-xs text-neutral-500">
        No scene loaded
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Search bar */}
      <div className="flex items-center gap-2 border-b border-neutral-700 px-2 py-1.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
        <input
          type="text"
          placeholder="Search entities..."
          className="flex-1 bg-transparent text-xs text-neutral-300 placeholder-neutral-600 outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button
            type="button"
            className="text-xs text-neutral-500 hover:text-neutral-300"
            onClick={() => setSearchTerm("")}
          >
            Clear
          </button>
        )}
      </div>

      {/* Tree */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
        onContextMenu={handleContextMenu}
      >
        <Tree<TreeNodeData>
          ref={treeRef}
          data={treeData}
          width="100%"
          height={treeHeight}
          rowHeight={28}
          indent={16}
          openByDefault
          selection={selectionString}
          searchTerm={searchTerm || undefined}
          searchMatch={searchMatch}
          onSelect={handleSelect}
          onMove={handleMove}
          onRename={handleRename}
        >
          {TreeNode}
        </Tree>
      </div>

      {/* Context menu portal */}
      {contextMenu && (
        <TreeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entityId={contextMenu.entityId}
          parentId={contextMenu.entityId ?? ecsonDoc.rootEntityId}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
