"use client";

import { useEditorStore } from "@/stores/hooks";
import { useEntityLocks } from "@/collaboration/hooks/use-entity-locks";
import { useRemoteChanges, type RemoteChangeEntry } from "@/collaboration/hooks/use-remote-changes";
import { EntityHeader } from "./entity-header";
import { ComponentInspector } from "./component-inspector";
import { EnvironmentPanel } from "./widgets/environment-panel";
import { EngineTuningSection } from "./engine-tuning-section";

/**
 * Inspector panel for the selected entity or environment settings.
 *
 * Reads selectedEntityIds from the store:
 * - None selected: shows EnvironmentPanel (ambient, fog, sky settings)
 * - Multiple selected: shows count (Phase 2 simplicity -- shows first entity)
 * - One selected: shows EntityHeader + ComponentInspector for each component
 *
 * Remote change highlights: when a remote user modifies a property of the
 * currently inspected entity, the component section briefly flashes with
 * the remote user's color (via CSS transition).
 *
 * Lock-aware read-only mode (05-04): when the selected entity is locked
 * by another user, shows a "Locked by [name]" banner and disables all
 * inputs. Values are still visible so the user can see the current state.
 *
 * Key link: Reads entity data from ecsonDoc via fine-grained selectors.
 * Key link: ComponentInspector dispatches SetComponentProperty PatchOps.
 * Key link: EnvironmentPanel dispatches SetProperty PatchOps for environment paths.
 */
export function InspectorPanel() {
  const selectedEntityIds = useEditorStore((s) => s.selectedEntityIds);
  const ecsonDoc = useEditorStore((s) => s.ecsonDoc);
  const remoteChanges = useRemoteChanges();
  const { getLockInfo } = useEntityLocks();

  if (!ecsonDoc || selectedEntityIds.length === 0) {
    // Show environment settings when nothing is selected
    return ecsonDoc ? (
      <div className="h-full overflow-auto">
        <EnvironmentPanel />
        <EngineTuningSection entityId={null} />
      </div>
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

  // Get remote changes for the currently inspected entity
  const entityChanges = remoteChanges.get(entityId) ?? [];

  // Lock state: if locked by another user, inspector is read-only (05-04)
  const lockInfo = getLockInfo(entityId);
  const isLockedByOther = lockInfo.locked && !lockInfo.lockedByMe;

  return (
    <div className="h-full overflow-auto">
      {/* Lock banner: shown when entity is locked by another user (05-04) */}
      {isLockedByOther && lockInfo.holder && (
        <div
          className="flex items-center gap-2 border-b px-3 py-2 text-xs font-medium"
          style={{
            borderColor: lockInfo.holder.color,
            backgroundColor: `${lockInfo.holder.color}15`,
            color: lockInfo.holder.color,
          }}
        >
          <svg
            className="h-3.5 w-3.5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Locked by {lockInfo.holder.name}
        </div>
      )}

      {/* Multi-select indicator */}
      {selectedEntityIds.length > 1 && (
        <div className="border-b border-neutral-700 px-3 py-1.5 text-xs text-neutral-400">
          {selectedEntityIds.length} entities selected (showing first)
        </div>
      )}

      {/* Wrap content in a container that disables pointer events when locked by another user */}
      <div className={isLockedByOther ? "pointer-events-none opacity-70" : ""}>
        {/* Entity header: name, transform, add component */}
        <EntityHeader entityId={entityId} />

        {/* Remote change highlight for entity-level changes (transform, name, etc.) */}
        <RemoteChangeIndicator changes={entityChanges} filter="transform" />

        {/* Component sections */}
        {entity.components.map((component, index) => (
          <div key={`${component.type}-${index}`} className="relative">
            <RemoteChangeIndicator changes={entityChanges} filter="components" />
            <ComponentInspector
              entityId={entityId}
              componentType={component.type}
              properties={component.properties as Record<string, unknown>}
            />
          </div>
        ))}

        {/* Empty state when no components */}
        {entity.components.length === 0 && (
          <div className="flex items-center justify-center p-6 text-xs text-neutral-500">
            No components attached
          </div>
        )}

        {/* Engine tuning section (collapsed by default) */}
        <EngineTuningSection entityId={entityId} />
      </div>
    </div>
  );
}

/**
 * Thin overlay that flashes a remote user's color when a matching
 * property was recently changed. Uses CSS transition for the fade.
 */
function RemoteChangeIndicator({
  changes,
  filter,
}: {
  changes: RemoteChangeEntry[];
  filter: string;
}) {
  const match = changes.find((c) => c.property === filter || c.property === "entity");

  if (!match) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-start">
      {/* Colored dot indicator */}
      <div
        className="ml-1 mt-1 h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: match.color }}
        title={`Changed by ${match.userName}`}
      />
      {/* Flash overlay with fade transition */}
      <div
        className="absolute inset-0 animate-[remoteFlash_0.5s_ease-out_forwards]"
        style={{
          backgroundColor: match.color,
          opacity: 0.15,
        }}
      />
    </div>
  );
}
