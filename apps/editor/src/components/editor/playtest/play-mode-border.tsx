"use client";

import { useEditorStore } from "@/stores/hooks";

/**
 * Colored border overlay that signals play mode on the viewport.
 *
 * Renders a semi-transparent colored border around the viewport area:
 * - Playing: cyan/teal border with a subtle glow animation
 * - Paused: amber/orange border (static, no animation)
 * - Not playing: hidden
 *
 * The overlay is absolutely positioned and uses `pointer-events: none`
 * so it does not interfere with viewport interaction (camera, gizmos,
 * selection, asset drops).
 */
export function PlayModeBorder() {
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const isPaused = useEditorStore((s) => s.isPaused);

  if (!isPlaying) return null;

  const borderColor = isPaused
    ? "rgba(245, 158, 11, 0.7)" // amber
    : "rgba(6, 182, 212, 0.7)"; // cyan

  const shadowColor = isPaused
    ? "rgba(245, 158, 11, 0.3)"
    : "rgba(6, 182, 212, 0.3)";

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20"
      style={{
        border: `3px solid ${borderColor}`,
        boxShadow: isPaused
          ? `inset 0 0 8px ${shadowColor}`
          : `inset 0 0 12px ${shadowColor}`,
        animation: isPaused ? "none" : "playmode-pulse 2s ease-in-out infinite",
        borderRadius: "1px",
      }}
    >
      {/* Inject keyframe animation via style tag (scoped to this component) */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes playmode-pulse {
              0%, 100% { opacity: 0.7; }
              50% { opacity: 1; }
            }
          `,
        }}
      />
    </div>
  );
}
