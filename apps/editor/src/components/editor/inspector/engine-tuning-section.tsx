"use client";

import { useState, useMemo, useCallback } from "react";
import { ChevronDown, ChevronRight, Eye, EyeOff, Plus } from "lucide-react";
import { useEditorStore } from "@/stores/hooks";
import { editorStore } from "@/stores/editor-store";
import { generateOpId } from "@riff3d/ecson";
import { CURRENT_PATCHOP_VERSION } from "@riff3d/patchops";
import type { PatchOp } from "@riff3d/patchops";
import type { EngineType } from "@/stores/slices/engine-slice";

const ENGINE_LABELS: Record<EngineType, string> = {
  playcanvas: "PlayCanvas",
  babylon: "Babylon.js",
};

/**
 * Render a key-value pair from the tuning record.
 * For Phase 4, tuning values are displayed as raw key-value text inputs.
 * Typed tuning editors (sliders, color pickers) are future work.
 */
function TuningField({
  entityId,
  engineName,
  fieldKey,
  value,
  readOnly,
}: {
  entityId: string | null;
  engineName: EngineType;
  fieldKey: string;
  value: unknown;
  readOnly: boolean;
}) {
  const displayValue = typeof value === "object" ? JSON.stringify(value) : String(value ?? "");

  const handleChange = useCallback(
    (newValue: string) => {
      if (readOnly || !entityId) return;

      // Parse the value: try number, then boolean, else string
      let parsed: unknown = newValue;
      if (newValue === "true") parsed = true;
      else if (newValue === "false") parsed = false;
      else if (!isNaN(Number(newValue)) && newValue.trim() !== "") parsed = Number(newValue);

      const op: PatchOp = {
        id: generateOpId(),
        timestamp: Date.now(),
        origin: "user",
        version: CURRENT_PATCHOP_VERSION,
        type: "SetProperty",
        payload: {
          entityId,
          path: `tuning.${engineName}.${fieldKey}`,
          value: parsed,
          previousValue: value,
        },
      };
      editorStore.getState().dispatchOp(op);
    },
    [entityId, engineName, fieldKey, value, readOnly],
  );

  return (
    <div className="flex items-center gap-2 px-3 py-1">
      <span className="w-24 truncate text-[10px] text-[var(--muted-foreground)]">
        {fieldKey}
      </span>
      <input
        type="text"
        value={displayValue}
        onChange={(e) => handleChange(e.target.value)}
        readOnly={readOnly}
        className={`flex-1 rounded border border-[var(--border)] bg-[var(--input)] px-2 py-0.5 text-[10px] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] ${
          readOnly ? "opacity-50 cursor-not-allowed" : ""
        }`}
      />
    </div>
  );
}

interface EngineTuningSectionProps {
  /** Entity ID for per-entity tuning, or null for scene-level tuning */
  entityId: string | null;
}

/**
 * Collapsible "Engine Tuning" section in the inspector.
 *
 * Per locked decisions (04-CONTEXT.md):
 * - Only active engine's tuning visible by default
 * - Subtle toggle to peek at other engine's tuning (dimmed/read-only)
 * - Per-entity tuning only when user explicitly opts in
 * - Scene-level tuning shown when no entity is selected
 *
 * For Phase 4 scope: tuning values are displayed as raw key-value pairs.
 * Typed tuning editors (shadow resolution slider, etc.) are future work.
 *
 * Key link: Reads activeEngine from engine-slice.
 * Key link: Reads tuning data from ecsonDoc entities/environment.
 * Key link: Dispatches SetProperty PatchOps for tuning edits.
 */
export function EngineTuningSection({ entityId }: EngineTuningSectionProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [showOtherEngine, setShowOtherEngine] = useState(false);
  const activeEngine = useEditorStore((s) => s.activeEngine);
  const ecsonDoc = useEditorStore((s) => s.ecsonDoc);
  const isReadOnly = useEditorStore((s) => s.isReadOnly);

  const otherEngine: EngineType =
    activeEngine === "playcanvas" ? "babylon" : "playcanvas";

  // Extract tuning data for the entity or scene level
  const { activeTuning, otherTuning } = useMemo(() => {
    if (!ecsonDoc) return { activeTuning: null, otherTuning: null };

    if (entityId) {
      const entity = ecsonDoc.entities[entityId];
      if (!entity) return { activeTuning: null, otherTuning: null };

      const tuning = (entity as Record<string, unknown>).tuning as
        | Record<string, Record<string, unknown>>
        | undefined;

      return {
        activeTuning: tuning?.[activeEngine] ?? null,
        otherTuning: tuning?.[otherEngine] ?? null,
      };
    }

    // Scene-level tuning: look at environment.tuning (if it exists)
    const envTuning = (ecsonDoc.environment as Record<string, unknown>)
      .tuning as Record<string, Record<string, unknown>> | undefined;

    return {
      activeTuning: envTuning?.[activeEngine] ?? null,
      otherTuning: envTuning?.[otherEngine] ?? null,
    };
  }, [ecsonDoc, entityId, activeEngine, otherEngine]);

  const handleAddTuning = useCallback(() => {
    if (!entityId || isReadOnly) return;

    // Add an empty tuning record for the active engine
    const op: PatchOp = {
      id: generateOpId(),
      timestamp: Date.now(),
      origin: "user",
      version: CURRENT_PATCHOP_VERSION,
      type: "SetProperty",
      payload: {
        entityId,
        path: `tuning.${activeEngine}`,
        value: {},
        previousValue: undefined,
      },
    };
    editorStore.getState().dispatchOp(op);
  }, [entityId, activeEngine, isReadOnly]);

  const sectionLabel = entityId ? "Engine Tuning" : "Scene Engine Tuning";

  return (
    <div className="border-t border-[var(--border)]">
      {/* Collapsible header */}
      <div className="flex w-full items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex flex-1 items-center gap-2 text-left transition-colors hover:text-[var(--foreground)]"
        >
          {collapsed ? (
            <ChevronRight size={12} className="text-[var(--muted-foreground)]" />
          ) : (
            <ChevronDown size={12} className="text-[var(--muted-foreground)]" />
          )}
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            {sectionLabel}
          </span>
          <span className="text-[9px] text-[var(--muted-foreground)]">
            ({ENGINE_LABELS[activeEngine]})
          </span>
        </button>

        {/* Peek other engine toggle */}
        {!collapsed && (
          <button
            type="button"
            onClick={() => setShowOtherEngine(!showOtherEngine)}
            className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            title={
              showOtherEngine
                ? `Hide ${ENGINE_LABELS[otherEngine]} tuning`
                : `Peek ${ENGINE_LABELS[otherEngine]} tuning`
            }
          >
            {showOtherEngine ? <EyeOff size={10} /> : <Eye size={10} />}
          </button>
        )}
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="pb-2">
          {/* Active engine tuning */}
          {activeTuning && Object.keys(activeTuning).length > 0 ? (
            <div>
              {Object.entries(activeTuning).map(([key, val]) => (
                <TuningField
                  key={key}
                  entityId={entityId}
                  engineName={activeEngine}
                  fieldKey={key}
                  value={val}
                  readOnly={isReadOnly}
                />
              ))}
            </div>
          ) : (
            <div className="px-3 py-2">
              <p className="text-[10px] text-[var(--muted-foreground)]">
                No {ENGINE_LABELS[activeEngine]} tuning configured
              </p>
              {entityId && !isReadOnly && (
                <button
                  type="button"
                  onClick={handleAddTuning}
                  className="mt-1 flex items-center gap-1 text-[10px] text-[var(--accent)] transition-colors hover:text-[var(--foreground)]"
                >
                  <Plus size={10} />
                  Add Tuning
                </button>
              )}
            </div>
          )}

          {/* Other engine tuning (dimmed/read-only peek) */}
          {showOtherEngine && (
            <div className="mt-1 border-t border-[var(--border)] pt-1 opacity-50">
              <div className="px-3 py-1">
                <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  {ENGINE_LABELS[otherEngine]} (read-only)
                </span>
              </div>
              {otherTuning && Object.keys(otherTuning).length > 0 ? (
                Object.entries(otherTuning).map(([key, val]) => (
                  <TuningField
                    key={key}
                    entityId={entityId}
                    engineName={otherEngine}
                    fieldKey={key}
                    value={val}
                    readOnly
                  />
                ))
              ) : (
                <div className="px-3 py-1">
                  <p className="text-[10px] text-[var(--muted-foreground)]">
                    No {ENGINE_LABELS[otherEngine]} tuning configured
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
