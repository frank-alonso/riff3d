"use client";

import { useEditorStore } from "@/stores/hooks";
import { EntityHeader } from "./entity-header";
import { ComponentInspector } from "./component-inspector";
import { EnvironmentPanel } from "./widgets/environment-panel";

/**
 * Inspector panel for the selected entity or environment settings.
 *
 * Reads selectedEntityIds from the store:
 * - None selected: shows EnvironmentPanel (ambient, fog, sky settings)
 * - Multiple selected: shows count (Phase 2 simplicity -- shows first entity)
 * - One selected: shows EntityHeader + ComponentInspector for each component
 *
 * Key link: Reads entity data from ecsonDoc via fine-grained selectors.
 * Key link: ComponentInspector dispatches SetComponentProperty PatchOps.
 * Key link: EnvironmentPanel dispatches SetProperty PatchOps for environment paths.
 */
export function InspectorPanel() {
  const selectedEntityIds = useEditorStore((s) => s.selectedEntityIds);
  const ecsonDoc = useEditorStore((s) => s.ecsonDoc);

  if (!ecsonDoc || selectedEntityIds.length === 0) {
    // Show environment settings when nothing is selected
    return ecsonDoc ? (
      <EnvironmentPanel />
    ) : (
      <div className="flex h-full items-center justify-center p-4 text-xs text-neutral-500">
        No entity selected
      </div>
    );
  }

  // For Phase 2, show first entity when multiple are selected
  const entityId = selectedEntityIds[0];
  const entity = ecsonDoc.entities[entityId];

  if (!entity) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-xs text-neutral-500">
        Entity not found
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      {/* Multi-select indicator */}
      {selectedEntityIds.length > 1 && (
        <div className="border-b border-neutral-700 px-3 py-1.5 text-xs text-neutral-400">
          {selectedEntityIds.length} entities selected (showing first)
        </div>
      )}

      {/* Entity header: name, transform, add component */}
      <EntityHeader entityId={entityId} />

      {/* Component sections */}
      {entity.components.map((component, index) => (
        <ComponentInspector
          key={`${component.type}-${index}`}
          entityId={entityId}
          componentType={component.type}
          properties={component.properties as Record<string, unknown>}
        />
      ))}

      {/* Empty state when no components */}
      {entity.components.length === 0 && (
        <div className="flex items-center justify-center p-6 text-xs text-neutral-500">
          No components attached
        </div>
      )}
    </div>
  );
}
