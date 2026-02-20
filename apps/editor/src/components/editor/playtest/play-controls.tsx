"use client";

import { Play, Pause, Square } from "lucide-react";
import { useEditorStore } from "@/stores/hooks";

/**
 * Play/Pause/Stop button group for the top bar.
 *
 * State-dependent rendering:
 * - Not playing: Play enabled (green tint), Pause/Stop disabled
 * - Playing: Pause and Stop enabled, Play shows "playing" state
 * - Paused: Resume (play icon) and Stop enabled, Pause disabled
 *
 * Centered in the top bar per user decision. Always visible regardless of mode.
 */
export function PlayControls() {
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const isPaused = useEditorStore((s) => s.isPaused);
  const play = useEditorStore((s) => s.play);
  const pause = useEditorStore((s) => s.pause);
  const resume = useEditorStore((s) => s.resume);
  const stop = useEditorStore((s) => s.stop);

  const handlePlayClick = () => {
    if (!isPlaying) {
      play();
    } else if (isPaused) {
      resume();
    }
  };

  const handlePauseClick = () => {
    if (isPlaying && !isPaused) {
      pause();
    }
  };

  const handleStopClick = () => {
    if (isPlaying) {
      stop();
    }
  };

  return (
    <div className="flex items-center gap-1">
      {/* Play / Resume button */}
      <button
        type="button"
        onClick={handlePlayClick}
        disabled={isPlaying && !isPaused}
        title={
          !isPlaying
            ? "Play (Ctrl+P)"
            : isPaused
              ? "Resume"
              : "Playing..."
        }
        className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
          !isPlaying
            ? "text-green-400 hover:bg-green-500/20 hover:text-green-300"
            : isPaused
              ? "text-green-400 hover:bg-green-500/20 hover:text-green-300"
              : "text-green-500 opacity-60 cursor-default"
        }`}
      >
        <Play size={14} fill={isPlaying && !isPaused ? "currentColor" : "none"} />
      </button>

      {/* Pause button */}
      <button
        type="button"
        onClick={handlePauseClick}
        disabled={!isPlaying || isPaused}
        title="Pause (Space)"
        className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
          isPlaying && !isPaused
            ? "text-[var(--foreground)] hover:bg-[var(--muted)]"
            : "text-[var(--muted-foreground)] opacity-40 cursor-default"
        }`}
      >
        <Pause size={14} />
      </button>

      {/* Stop button */}
      <button
        type="button"
        onClick={handleStopClick}
        disabled={!isPlaying}
        title="Stop (Ctrl+P)"
        className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
          isPlaying
            ? "text-red-400 hover:bg-red-500/20 hover:text-red-300"
            : "text-[var(--muted-foreground)] opacity-40 cursor-default"
        }`}
      >
        <Square size={14} />
      </button>

      {/* Paused indicator */}
      {isPaused && (
        <span className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
          Paused
        </span>
      )}
    </div>
  );
}
