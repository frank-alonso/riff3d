"use client";

import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useEditorStore } from "@/stores/hooks";
import { editorStore } from "@/stores/editor-store";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { EngineType } from "@/stores/slices/engine-slice";

/**
 * Engine icon badge component.
 * Shows a small styled badge with "PC" for PlayCanvas or "BJ" for Babylon.
 *
 * Per locked decision: active engine indicated by a subtle engine icon
 * (not a text label).
 */
function EngineIcon({
  engine,
  size = 20,
  active = false,
}: {
  engine: EngineType;
  size?: number;
  active?: boolean;
}) {
  const label = engine === "playcanvas" ? "PC" : "BJ";
  const bgColor = active
    ? engine === "playcanvas"
      ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
      : "bg-purple-500/20 text-purple-400 border-purple-500/30"
    : "bg-[var(--muted)] text-[var(--muted-foreground)] border-transparent";

  return (
    <span
      className={`inline-flex items-center justify-center rounded border font-mono text-[9px] font-bold leading-none ${bgColor}`}
      style={{ width: size, height: size }}
    >
      {label}
    </span>
  );
}

/**
 * Engine switcher component for the editor top bar.
 *
 * Per locked decisions (04-CONTEXT.md):
 * - Lives in the main editor toolbar (top bar)
 * - Active engine indicated by a subtle engine icon
 * - Clicking shows a confirmation dialog before switching
 * - Disabled during play-test mode
 * - Tooltip notes rendering may vary slightly between engines
 * - Subtle badge/dot when custom tuning is applied
 *
 * Key link: Reads activeEngine/isSwitchingEngine from engine-slice.
 * Key link: Dispatches switchEngine action to trigger viewport adapter swap.
 */
export function EngineSwitcher() {
  const activeEngine = useEditorStore((s) => s.activeEngine);
  const isSwitchingEngine = useEditorStore((s) => s.isSwitchingEngine);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const ecsonDoc = useEditorStore((s) => s.ecsonDoc);

  const [showConfirm, setShowConfirm] = useState(false);

  const targetEngine: EngineType =
    activeEngine === "playcanvas" ? "babylon" : "playcanvas";

  const targetLabel =
    targetEngine === "playcanvas" ? "PlayCanvas" : "Babylon.js";

  // Check if any entity has custom tuning for the active engine
  const hasTuning = useMemo(() => {
    if (!ecsonDoc) return false;
    for (const entity of Object.values(ecsonDoc.entities)) {
      const tuning = (entity as Record<string, unknown>).tuning as
        | Record<string, unknown>
        | undefined;
      if (tuning && tuning[activeEngine]) return true;
    }
    return false;
  }, [ecsonDoc, activeEngine]);

  const disabled = isPlaying || isSwitchingEngine;

  const handleClick = () => {
    if (disabled) return;
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    setShowConfirm(false);
    editorStore.getState().setSelection([]);
    editorStore.getState().switchEngine(targetEngine);
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title="Switch rendering engine (rendering may vary slightly between engines)"
        className={`relative flex items-center gap-1.5 rounded px-1.5 py-1 transition-colors ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:bg-[var(--muted)] cursor-pointer"
        }`}
      >
        {isSwitchingEngine ? (
          <Loader2 size={14} className="animate-spin text-[var(--muted-foreground)]" />
        ) : (
          <EngineIcon engine={activeEngine} active size={20} />
        )}

        {/* Tuning badge: subtle dot when custom tuning is applied */}
        {hasTuning && !isSwitchingEngine && (
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-cyan-400" />
        )}
      </button>

      {/* Confirmation dialog */}
      <ConfirmDialog
        open={showConfirm}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        title="Switch Rendering Engine"
        message={`Switch to ${targetLabel}? The scene will reload and rendering may look slightly different. Selection will be reset.`}
        confirmLabel="Switch Engine"
        cancelLabel="Cancel"
      />
    </>
  );
}
