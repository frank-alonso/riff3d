"use client";

import { useState, useCallback } from "react";
import {
  Move,
  RotateCw,
  Maximize2,
  Grid3x3,
  Camera,
  Navigation,
} from "lucide-react";
import { useEditorStore } from "@/stores/hooks";

/**
 * Figma-style floating toolbar embedded in the viewport.
 *
 * Position: Bottom-center of the viewport area.
 * Appearance: Dark semi-transparent background with subtle shadow and rounded corners.
 *
 * Contains:
 * - Gizmo mode buttons: Move, Rotate, Scale (W/E/R)
 * - Separator
 * - Snap toggle (grid icon)
 * - Grid size display
 * - Separator
 * - Camera mode toggle (orbit/fly)
 *
 * All buttons dispatch through the Zustand editor store.
 */
export function FloatingToolbar() {
  const gizmoMode = useEditorStore((s) => s.gizmoMode);
  const setGizmoMode = useEditorStore((s) => s.setGizmoMode);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const toggleSnap = useEditorStore((s) => s.toggleSnap);
  const gridSize = useEditorStore((s) => s.gridSize);
  const setGridSize = useEditorStore((s) => s.setGridSize);
  const cameraMode = useEditorStore((s) => s.cameraMode);
  const setCameraMode = useEditorStore((s) => s.setCameraMode);

  const [showGridPopover, setShowGridPopover] = useState(false);

  const toggleCameraMode = useCallback(() => {
    setCameraMode(cameraMode === "fly" ? "orbit" : "fly");
  }, [cameraMode, setCameraMode]);

  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-white/10 bg-neutral-900/90 px-2 py-1.5 shadow-lg backdrop-blur-sm">
      {/* Gizmo mode buttons */}
      <ToolbarButton
        icon={<Move size={16} />}
        label="Move (W)"
        active={gizmoMode === "translate"}
        onClick={() => setGizmoMode("translate")}
      />
      <ToolbarButton
        icon={<RotateCw size={16} />}
        label="Rotate (E)"
        active={gizmoMode === "rotate"}
        onClick={() => setGizmoMode("rotate")}
      />
      <ToolbarButton
        icon={<Maximize2 size={16} />}
        label="Scale (R)"
        active={gizmoMode === "scale"}
        onClick={() => setGizmoMode("scale")}
      />

      <ToolbarSeparator />

      {/* Snap toggle */}
      <ToolbarButton
        icon={<Grid3x3 size={16} />}
        label={`Snap ${snapEnabled ? "On" : "Off"}`}
        active={snapEnabled}
        onClick={toggleSnap}
      />

      {/* Grid size display/button */}
      <div className="relative">
        <button
          type="button"
          className="rounded px-1.5 py-1 text-xs text-neutral-400 transition-colors hover:bg-white/10 hover:text-neutral-200"
          onClick={() => setShowGridPopover(!showGridPopover)}
          title="Grid size"
        >
          {gridSize}m
        </button>

        {/* Grid size popover */}
        {showGridPopover && (
          <GridSizePopover
            currentSize={gridSize}
            onSelect={(size) => {
              setGridSize(size);
              setShowGridPopover(false);
            }}
            onClose={() => setShowGridPopover(false)}
          />
        )}
      </div>

      <ToolbarSeparator />

      {/* Camera mode toggle */}
      <ToolbarButton
        icon={cameraMode === "orbit" ? <Camera size={16} /> : <Navigation size={16} />}
        label={`${cameraMode === "orbit" ? "Orbit" : "Fly"} Camera`}
        active={false}
        onClick={toggleCameraMode}
      />
    </div>
  );
}

/**
 * Individual toolbar button with active state highlight.
 */
function ToolbarButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex items-center justify-center rounded p-1.5 transition-colors ${
        active
          ? "bg-blue-600/80 text-white"
          : "text-neutral-400 hover:bg-white/10 hover:text-neutral-200"
      }`}
      onClick={onClick}
      title={label}
    >
      {icon}
    </button>
  );
}

/**
 * Vertical separator between toolbar groups.
 */
function ToolbarSeparator() {
  return <div className="mx-0.5 h-5 w-px bg-white/10" />;
}

/**
 * Popover for selecting grid size values.
 */
function GridSizePopover({
  currentSize,
  onSelect,
  onClose,
}: {
  currentSize: number;
  onSelect: (size: number) => void;
  onClose: () => void;
}) {
  const sizes = [0.1, 0.25, 0.5, 1, 2, 5, 10];

  return (
    <>
      {/* Backdrop to close popover */}
      <div
        className="fixed inset-0 z-30"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        role="button"
        tabIndex={-1}
        aria-label="Close grid size popover"
      />

      <div className="absolute bottom-full left-1/2 z-40 mb-2 -translate-x-1/2 rounded-lg border border-white/10 bg-neutral-900/95 py-1 shadow-xl backdrop-blur-sm">
        <div className="px-3 py-1 text-xs text-neutral-500">Grid Size</div>
        {sizes.map((size) => (
          <button
            key={size}
            type="button"
            className={`block w-full px-4 py-1 text-left text-xs transition-colors ${
              size === currentSize
                ? "bg-blue-600/30 text-blue-300"
                : "text-neutral-300 hover:bg-white/10"
            }`}
            onClick={() => onSelect(size)}
          >
            {size}m
          </button>
        ))}
      </div>
    </>
  );
}
