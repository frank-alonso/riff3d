"use client";

interface ViewportLoaderProps {
  /** Current loading stage label */
  stage: string;
  /** Progress 0-100. Negative means indeterminate. */
  progress: number;
}

/**
 * Loading overlay shown inside the viewport area during initialization.
 *
 * Shows a 3D cube icon, stage label, and a progress bar. Replaces the
 * generic "Loading viewport..." text with actionable diagnostic info
 * so slow loads are easier to debug.
 */
export function ViewportLoader({ stage, progress }: ViewportLoaderProps) {
  const isIndeterminate = progress < 0;
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#111111]">
      <div className="flex flex-col items-center gap-4">
        {/* Cube icon */}
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-pulse text-neutral-500"
        >
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
          <path d="M12 12l8-4.5" />
          <path d="M12 12v9" />
          <path d="M12 12L4 7.5" />
        </svg>

        {/* Stage label */}
        <span className="text-xs text-neutral-400">{stage}</span>

        {/* Progress bar */}
        <div className="h-1 w-48 overflow-hidden rounded-full bg-neutral-800">
          {isIndeterminate ? (
            <div className="h-full w-1/3 animate-[indeterminate_1.5s_ease-in-out_infinite] rounded-full bg-blue-500/60" />
          ) : (
            <div
              className="h-full rounded-full bg-blue-500/80 transition-[width] duration-300"
              style={{ width: `${clampedProgress}%` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
