"use client";

import { useState, useCallback, useRef } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { getComponentDef, generateOpId } from "@riff3d/ecson";
import type { EditorHint, ComponentDefinition } from "@riff3d/ecson";
import type { PatchOp } from "@riff3d/patchops";
import { CURRENT_PATCHOP_VERSION } from "@riff3d/patchops";
import { editorStore } from "@/stores/editor-store";
import { PropertyWidget } from "./property-widget";

interface ComponentInspectorProps {
  entityId: string;
  componentType: string;
  properties: Record<string, unknown>;
}

/**
 * Extract enum options from a Zod schema for a given property.
 *
 * Uses Zod's internal `_def` structure to walk through wrappers
 * (default/nullable/optional) and find enum values. This avoids
 * importing zod directly in the editor package.
 */
function extractEnumOptions(
  def: ComponentDefinition,
  propName: string,
): string[] | undefined {
  try {
    // Access the schema shape via _def (Zod internal but stable API)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schemaDef = (def.schema as any)._def as Record<string, unknown> | undefined;
    if (!schemaDef) return undefined;

    const shape = schemaDef.shape as Record<string, Record<string, unknown>> | undefined;
    if (!shape) return undefined;

    const propSchema = shape[propName];
    if (!propSchema) return undefined;

    // Walk through wrappers to find the inner type
    let inner = propSchema;
    for (let i = 0; i < 5; i++) {
      const innerDef = inner._def as Record<string, unknown> | undefined;
      if (!innerDef) break;

      // Check if this is a ZodEnum (has `values` array in _def)
      if (innerDef.values && Array.isArray(innerDef.values)) {
        return innerDef.values as string[];
      }

      // Unwrap wrapper types (default, nullable, optional all use innerType)
      if (innerDef.innerType) {
        inner = innerDef.innerType as Record<string, unknown>;
      } else {
        break;
      }
    }
  } catch {
    // Ignore errors from introspection
  }
  return undefined;
}

/**
 * Inspector section for a single component on an entity.
 *
 * For a given entity component:
 * 1. Looks up ComponentDefinition via getComponentDef(component.type)
 * 2. If no definition found, shows raw JSON viewer (fallback)
 * 3. If definition found, renders a collapsible section with property widgets
 *
 * Key link: Each property change dispatches a SetComponentProperty PatchOp
 * via editorStore.dispatchOp().
 *
 * Key link: Reads component definition from @riff3d/ecson getComponentDef()
 * for editorHints that drive widget auto-generation.
 */
export function ComponentInspector({
  entityId,
  componentType,
  properties,
}: ComponentInspectorProps) {
  const [isOpen, setIsOpen] = useState(true);
  const debounceTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const def = getComponentDef(componentType);

  // Dispatch SetComponentProperty PatchOp with debounce for keyboard input
  const handlePropertyChange = useCallback(
    (propName: string, newValue: unknown, immediate = false) => {
      const dispatch = () => {
        const { ecsonDoc } = editorStore.getState();
        if (!ecsonDoc) return;

        const entity = ecsonDoc.entities[entityId];
        if (!entity) return;

        const comp = entity.components.find((c) => c.type === componentType);
        const previousValue = comp?.properties[propName];

        const op: PatchOp = {
          id: generateOpId(),
          timestamp: Date.now(),
          origin: "user",
          version: CURRENT_PATCHOP_VERSION,
          type: "SetComponentProperty",
          payload: {
            entityId,
            componentType,
            propertyPath: propName,
            value: newValue,
            previousValue,
          },
        };

        editorStore.getState().dispatchOp(op);
      };

      if (immediate) {
        // Clear any pending debounce for this property
        const timer = debounceTimers.current.get(propName);
        if (timer) {
          clearTimeout(timer);
          debounceTimers.current.delete(propName);
        }
        dispatch();
      } else {
        // Debounce keyboard input (300ms)
        const existingTimer = debounceTimers.current.get(propName);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }
        debounceTimers.current.set(
          propName,
          setTimeout(() => {
            debounceTimers.current.delete(propName);
            dispatch();
          }, 300),
        );
      }
    },
    [entityId, componentType],
  );

  // Remove component handler
  const handleRemove = useCallback(() => {
    const { ecsonDoc } = editorStore.getState();
    if (!ecsonDoc) return;

    const entity = ecsonDoc.entities[entityId];
    if (!entity) return;

    const comp = entity.components.find((c) => c.type === componentType);
    if (!comp) return;

    const op: PatchOp = {
      id: generateOpId(),
      timestamp: Date.now(),
      origin: "user",
      version: CURRENT_PATCHOP_VERSION,
      type: "RemoveComponent",
      payload: {
        entityId,
        componentType,
        previousComponent: comp,
      },
    };

    editorStore.getState().dispatchOp(op);
  }, [entityId, componentType]);

  return (
    <div className="border-b border-neutral-700">
      {/* Component header — uses div instead of button to avoid nested button violation */}
      <div
        role="button"
        tabIndex={0}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-neutral-800/50"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
      >
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-neutral-500 transition-transform ${
            isOpen ? "" : "-rotate-90"
          }`}
        />
        <span className="flex-1 text-xs font-medium text-neutral-200">
          {componentType}
        </span>
        <button
          type="button"
          className="rounded p-0.5 text-neutral-500 hover:bg-neutral-700 hover:text-red-400"
          onClick={(e) => {
            e.stopPropagation();
            handleRemove();
          }}
          title="Remove component"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Component properties */}
      {isOpen && (
        <div className="space-y-2 px-3 pb-3">
          {def ? (
            // Auto-generated widgets from editorHints
            Object.entries(def.editorHints).map(
              ([propName, hint]: [string, EditorHint]) => {
                const value = properties[propName];
                const enumOptions = extractEnumOptions(def, propName);

                return (
                  <PropertyWidget
                    key={propName}
                    propName={propName}
                    hint={hint}
                    value={value}
                    enumOptions={enumOptions}
                    onChange={(newValue) => {
                      // Sliders and checkboxes are immediate; text/number are debounced
                      const immediate =
                        hint.editorHint === "slider" ||
                        hint.editorHint === "checkbox" ||
                        hint.editorHint === "color" ||
                        hint.editorHint === "dropdown";
                      handlePropertyChange(propName, newValue, immediate);
                    }}
                  />
                );
              },
            )
          ) : (
            // Fallback: raw JSON viewer
            <div className="rounded bg-neutral-800/50 p-2">
              <pre className="text-xs text-neutral-400">
                {JSON.stringify(properties, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
