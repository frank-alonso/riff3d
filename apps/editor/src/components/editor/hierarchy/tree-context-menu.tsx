"use client";

import { useEffect, useRef } from "react";
import { generateEntityId, generateOpId } from "@riff3d/ecson";
import type { PatchOp } from "@riff3d/patchops";
import { CURRENT_PATCHOP_VERSION } from "@riff3d/patchops";
import { editorStore } from "@/stores/editor-store";

interface ContextMenuProps {
  x: number;
  y: number;
  /** Entity ID that was right-clicked, or null for empty-area click */
  entityId: string | null;
  /** Parent entity ID for new entities: the right-clicked entity or root */
  parentId: string;
  onClose: () => void;
}

interface AddEntityOption {
  label: string;
  componentType: string | null;
  primitive?: string;
}

const ADD_ENTITY_OPTIONS: AddEntityOption[] = [
  { label: "Empty", componentType: null },
  { label: "Cube", componentType: "MeshRenderer", primitive: "box" },
  { label: "Sphere", componentType: "MeshRenderer", primitive: "sphere" },
  { label: "Plane", componentType: "MeshRenderer", primitive: "plane" },
  { label: "Cylinder", componentType: "MeshRenderer", primitive: "cylinder" },
  { label: "Point Light", componentType: "Light" },
  { label: "Spot Light", componentType: "Light" },
  { label: "Camera", componentType: "Camera" },
];

function createAddEntityOps(
  option: AddEntityOption,
  parentId: string,
): PatchOp[] {
  const entityId = generateEntityId();
  const base = {
    timestamp: Date.now(),
    origin: "user" as const,
    version: CURRENT_PATCHOP_VERSION,
  };

  const ops: PatchOp[] = [
    {
      ...base,
      id: generateOpId(),
      type: "CreateEntity",
      payload: {
        entityId,
        name: option.label,
        parentId,
      },
    },
  ];

  if (option.componentType === "MeshRenderer" && option.primitive) {
    ops.push({
      ...base,
      id: generateOpId(),
      type: "AddComponent",
      payload: {
        entityId,
        component: {
          type: "MeshRenderer",
          properties: { primitive: option.primitive },
        },
      },
    });
    // Add a default material
    ops.push({
      ...base,
      id: generateOpId(),
      type: "AddComponent",
      payload: {
        entityId,
        component: {
          type: "Material",
          properties: { baseColor: "#cccccc", roughness: 0.5, metallic: 0 },
        },
      },
    });
  } else if (option.componentType === "Light") {
    const lightType = option.label === "Spot Light" ? "spot" : "point";
    ops.push({
      ...base,
      id: generateOpId(),
      type: "AddComponent",
      payload: {
        entityId,
        component: {
          type: "Light",
          properties: { lightType, intensity: 1, color: "#ffffff" },
        },
      },
    });
  } else if (option.componentType === "Camera") {
    ops.push({
      ...base,
      id: generateOpId(),
      type: "AddComponent",
      payload: {
        entityId,
        component: {
          type: "Camera",
          properties: { projection: "perspective", fov: 60 },
        },
      },
    });
  }

  return ops;
}

/**
 * Context menu for the scene hierarchy tree.
 *
 * Right-click on a tree node to show:
 * - Add Entity (submenu: Empty, Cube, Sphere, Plane, Cylinder, Point Light, Spot Light, Camera)
 * - Rename
 * - Duplicate (placeholder -- implemented in 02-05)
 * - Delete (dispatches DeleteEntity PatchOp)
 *
 * Right-click on empty area: Add Entity at root level.
 * Each "Add Entity" option dispatches CreateEntity + AddComponent PatchOps.
 */
export function TreeContextMenu({
  x,
  y,
  entityId,
  parentId,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const addSubmenuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        addSubmenuRef.current &&
        !addSubmenuRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
      // Also close if clicking outside both refs but addSubmenu doesn't exist
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !addSubmenuRef.current
      ) {
        onClose();
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  function handleAddEntity(option: AddEntityOption) {
    const ops = createAddEntityOps(option, parentId);
    const { dispatchOp } = editorStore.getState();
    for (const op of ops) {
      dispatchOp(op);
    }
    onClose();
  }

  function handleDelete() {
    if (!entityId) return;
    const { ecsonDoc, dispatchOp, setSelection } = editorStore.getState();
    if (!ecsonDoc) return;

    const entity = ecsonDoc.entities[entityId];
    if (!entity) return;

    const op: PatchOp = {
      id: generateOpId(),
      timestamp: Date.now(),
      origin: "user",
      version: CURRENT_PATCHOP_VERSION,
      type: "DeleteEntity",
      payload: { entityId, previousState: entity },
    };
    dispatchOp(op);
    setSelection([]);
    onClose();
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] rounded-md border border-neutral-700 bg-neutral-800 py-1 shadow-xl"
      style={{ left: x, top: y }}
    >
      {/* Add Entity submenu */}
      <div className="group/add relative">
        <button
          type="button"
          className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-neutral-200 hover:bg-neutral-700"
        >
          Add Entity
          <span className="text-neutral-500">&#9656;</span>
        </button>
        <div
          ref={addSubmenuRef}
          className="invisible absolute left-full top-0 z-50 min-w-[160px] rounded-md border border-neutral-700 bg-neutral-800 py-1 shadow-xl group-hover/add:visible"
        >
          {ADD_ENTITY_OPTIONS.map((option) => (
            <button
              key={option.label}
              type="button"
              className="flex w-full items-center px-3 py-1.5 text-left text-sm text-neutral-200 hover:bg-neutral-700"
              onClick={() => handleAddEntity(option)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Separator */}
      {entityId && <div className="my-1 border-t border-neutral-700" />}

      {/* Entity-specific actions (only when right-clicked on an entity) */}
      {entityId && (
        <>
          <button
            type="button"
            className="flex w-full items-center px-3 py-1.5 text-left text-sm text-neutral-200 hover:bg-neutral-700"
            onClick={() => {
              // Rename is handled by react-arborist's edit mode -- we'd need the tree ref
              // For now, we dispatch through the tree's edit system
              onClose();
            }}
          >
            Rename
          </button>

          <button
            type="button"
            className="flex w-full cursor-not-allowed items-center px-3 py-1.5 text-left text-sm text-neutral-500"
            disabled
          >
            Duplicate (02-05)
          </button>

          <div className="my-1 border-t border-neutral-700" />

          <button
            type="button"
            className="flex w-full items-center px-3 py-1.5 text-left text-sm text-red-400 hover:bg-neutral-700"
            onClick={handleDelete}
          >
            Delete
          </button>
        </>
      )}
    </div>
  );
}
