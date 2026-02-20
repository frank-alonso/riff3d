"use client";

import { useState, useCallback, useRef } from "react";
import { Plus } from "lucide-react";
import { generateOpId, listComponents } from "@riff3d/ecson";
import type { ComponentDefinition } from "@riff3d/ecson";
import type { PatchOp } from "@riff3d/patchops";
import { CURRENT_PATCHOP_VERSION } from "@riff3d/patchops";
import { useEditorStore } from "@/stores/hooks";
import { editorStore } from "@/stores/editor-store";
import { Vec3Input } from "./widgets/vec3-input";

interface EntityHeaderProps {
  entityId: string;
}

/**
 * Convert quaternion (x, y, z, w) to Euler angles (degrees) for display.
 * Uses intrinsic Tait-Bryan rotation order XYZ.
 */
function quaternionToEuler(q: {
  x: number;
  y: number;
  z: number;
  w: number;
}): { x: number; y: number; z: number } {
  const { x, y, z, w } = q;

  // Roll (x-axis rotation)
  const sinr_cosp = 2 * (w * x + y * z);
  const cosr_cosp = 1 - 2 * (x * x + y * y);
  const roll = Math.atan2(sinr_cosp, cosr_cosp);

  // Pitch (y-axis rotation)
  const sinp = 2 * (w * y - z * x);
  let pitch: number;
  if (Math.abs(sinp) >= 1) {
    pitch = (Math.PI / 2) * Math.sign(sinp); // Clamp to +/-90
  } else {
    pitch = Math.asin(sinp);
  }

  // Yaw (z-axis rotation)
  const siny_cosp = 2 * (w * z + x * y);
  const cosy_cosp = 1 - 2 * (y * y + z * z);
  const yaw = Math.atan2(siny_cosp, cosy_cosp);

  const toDeg = 180 / Math.PI;
  return {
    x: parseFloat((roll * toDeg).toFixed(2)),
    y: parseFloat((pitch * toDeg).toFixed(2)),
    z: parseFloat((yaw * toDeg).toFixed(2)),
  };
}

/**
 * Convert Euler angles (degrees) back to quaternion for storage.
 * Uses intrinsic Tait-Bryan rotation order XYZ.
 */
function eulerToQuaternion(euler: {
  x: number;
  y: number;
  z: number;
}): { x: number; y: number; z: number; w: number } {
  const toRad = Math.PI / 180;
  const cx = Math.cos((euler.x * toRad) / 2);
  const sx = Math.sin((euler.x * toRad) / 2);
  const cy = Math.cos((euler.y * toRad) / 2);
  const sy = Math.sin((euler.y * toRad) / 2);
  const cz = Math.cos((euler.z * toRad) / 2);
  const sz = Math.sin((euler.z * toRad) / 2);

  return {
    x: parseFloat((sx * cy * cz + cx * sy * sz).toFixed(6)),
    y: parseFloat((cx * sy * cz - sx * cy * sz).toFixed(6)),
    z: parseFloat((cx * cy * sz + sx * sy * cz).toFixed(6)),
    w: parseFloat((cx * cy * cz - sx * sy * sz).toFixed(6)),
  };
}

/**
 * Entity header section of the inspector.
 *
 * Shows:
 * - Entity name (editable inline)
 * - Transform section: Position (Vec3), Rotation (Euler display, stored as quaternion), Scale (Vec3)
 * - "Add Component" button
 *
 * Transform inputs dispatch SetProperty PatchOps with debounced dispatch (300ms)
 * for keyboard input. On blur, force dispatch.
 */
export function EntityHeader({ entityId }: EntityHeaderProps) {
  const entity = useEditorStore((s) => {
    const doc = s.ecsonDoc;
    return doc?.entities[entityId] ?? null;
  });

  const [showAddComponent, setShowAddComponent] = useState(false);
  const nameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transformDebounceRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );

  // Dispatch SetProperty PatchOp for entity-level properties
  const dispatchSetProperty = useCallback(
    (path: string, value: unknown, previousValue: unknown, immediate = false) => {
      const dispatch = () => {
        const op: PatchOp = {
          id: generateOpId(),
          timestamp: Date.now(),
          origin: "user",
          version: CURRENT_PATCHOP_VERSION,
          type: "SetProperty",
          payload: { entityId, path, value, previousValue },
        };
        editorStore.getState().dispatchOp(op);
      };

      if (immediate) {
        const timer = transformDebounceRef.current.get(path);
        if (timer) {
          clearTimeout(timer);
          transformDebounceRef.current.delete(path);
        }
        dispatch();
      } else {
        const existing = transformDebounceRef.current.get(path);
        if (existing) clearTimeout(existing);
        transformDebounceRef.current.set(
          path,
          setTimeout(() => {
            transformDebounceRef.current.delete(path);
            dispatch();
          }, 300),
        );
      }
    },
    [entityId],
  );

  // Handle name change
  const handleNameChange = useCallback(
    (newName: string) => {
      if (!entity) return;
      if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
      nameDebounceRef.current = setTimeout(() => {
        dispatchSetProperty("name", newName, entity.name, true);
      }, 300);
    },
    [entity, dispatchSetProperty],
  );

  // Handle Add Component
  const handleAddComponent = useCallback(
    (def: ComponentDefinition) => {
      const op: PatchOp = {
        id: generateOpId(),
        timestamp: Date.now(),
        origin: "user",
        version: CURRENT_PATCHOP_VERSION,
        type: "AddComponent",
        payload: {
          entityId,
          component: {
            type: def.type,
            properties: {},
          },
        },
      };
      editorStore.getState().dispatchOp(op);
      setShowAddComponent(false);
    },
    [entityId],
  );

  if (!entity) return null;

  const eulerRotation = quaternionToEuler(entity.transform.rotation);

  // Group components by category for the add-component dropdown
  const allComponents = listComponents();
  const existingTypes = new Set(entity.components.map((c) => c.type));
  const availableComponents = allComponents.filter(
    (def) => !def.singleton || !existingTypes.has(def.type),
  );
  const grouped = new Map<string, ComponentDefinition[]>();
  for (const def of availableComponents) {
    const existing = grouped.get(def.category) ?? [];
    existing.push(def);
    grouped.set(def.category, existing);
  }

  return (
    <div className="border-b border-neutral-700">
      {/* Entity name */}
      <div className="px-3 py-2">
        <input
          type="text"
          className="w-full rounded bg-neutral-800 px-2 py-1.5 text-sm font-medium text-neutral-100 outline-none ring-1 ring-neutral-700 focus:ring-blue-500"
          defaultValue={entity.name}
          onBlur={(e) => {
            if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
            if (e.target.value !== entity.name) {
              dispatchSetProperty("name", e.target.value, entity.name, true);
            }
          }}
          onChange={(e) => handleNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      </div>

      {/* Transform section */}
      <div className="space-y-2 px-3 pb-3">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          Transform
        </h4>

        {/* Position */}
        <Vec3Input
          label="Position"
          value={entity.transform.position}
          onChange={(value) => {
            dispatchSetProperty(
              "transform.position",
              value,
              entity.transform.position,
            );
          }}
        />

        {/* Rotation (displayed as Euler, stored as quaternion) */}
        <Vec3Input
          label="Rotation"
          value={eulerRotation}
          onChange={(euler) => {
            const quat = eulerToQuaternion(euler);
            dispatchSetProperty(
              "transform.rotation",
              quat,
              entity.transform.rotation,
            );
          }}
        />

        {/* Scale */}
        <Vec3Input
          label="Scale"
          value={entity.transform.scale}
          onChange={(value) => {
            dispatchSetProperty(
              "transform.scale",
              value,
              entity.transform.scale,
            );
          }}
        />
      </div>

      {/* Add Component button */}
      <div className="relative px-3 pb-3">
        <button
          type="button"
          className="flex w-full items-center justify-center gap-1.5 rounded bg-neutral-700/50 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-neutral-700"
          onClick={() => setShowAddComponent(!showAddComponent)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Component
        </button>

        {/* Component dropdown */}
        {showAddComponent && (
          <div className="absolute right-3 left-3 z-10 mt-1 max-h-60 overflow-auto rounded-md border border-neutral-700 bg-neutral-800 py-1 shadow-xl">
            {Array.from(grouped.entries()).map(([category, defs]) => (
              <div key={category}>
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  {category}
                </div>
                {defs.map((def) => (
                  <button
                    key={def.type}
                    type="button"
                    className="flex w-full items-center px-3 py-1.5 text-left text-xs text-neutral-200 hover:bg-neutral-700"
                    onClick={() => handleAddComponent(def)}
                  >
                    {def.type}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
