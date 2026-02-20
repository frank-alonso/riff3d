"use client";

import { useState, useEffect } from "react";

interface Vec3InputProps {
  label: string;
  value: { x: number; y: number; z: number };
  /** Step size for arrow key / spinner increments. Default 0.1. */
  step?: number;
  onChange: (value: { x: number; y: number; z: number }) => void;
}

/**
 * Vec3 input widget with three inline number inputs labeled X/Y/Z.
 * Uses colored labels matching gizmo axis convention (red=X, green=Y, blue=Z).
 *
 * Maintains local state so the input feels responsive immediately,
 * even when the upstream store dispatch is debounced. Syncs from
 * the value prop when the store eventually updates.
 */
export function Vec3Input({ label, value, step = 0.1, onChange }: Vec3InputProps) {
  // Local state for responsive input — masks debounce latency
  const [local, setLocal] = useState(value);

  // Sync from prop when the store updates (or entity changes)
  useEffect(() => {
    setLocal(value);
  }, [value.x, value.y, value.z]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (axis: "x" | "y" | "z", raw: string) => {
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      const next = { ...local, [axis]: parsed };
      setLocal(next);
      onChange(next);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label className="w-28 shrink-0 truncate text-xs text-neutral-400">
        {label}
      </label>
      <div className="flex flex-1 gap-1">
        {/* X */}
        <div className="flex flex-1 items-center gap-0.5">
          <span className="text-[10px] font-bold text-red-400">X</span>
          <input
            type="number"
            step={step}
            className="w-full min-w-0 rounded bg-neutral-800 px-1.5 py-1 text-xs tabular-nums text-neutral-200 outline-none ring-1 ring-neutral-700 focus:ring-blue-500"
            value={local.x}
            onChange={(e) => handleChange("x", e.target.value)}
          />
        </div>
        {/* Y */}
        <div className="flex flex-1 items-center gap-0.5">
          <span className="text-[10px] font-bold text-green-400">Y</span>
          <input
            type="number"
            step={step}
            className="w-full min-w-0 rounded bg-neutral-800 px-1.5 py-1 text-xs tabular-nums text-neutral-200 outline-none ring-1 ring-neutral-700 focus:ring-blue-500"
            value={local.y}
            onChange={(e) => handleChange("y", e.target.value)}
          />
        </div>
        {/* Z */}
        <div className="flex flex-1 items-center gap-0.5">
          <span className="text-[10px] font-bold text-blue-400">Z</span>
          <input
            type="number"
            step={step}
            className="w-full min-w-0 rounded bg-neutral-800 px-1.5 py-1 text-xs tabular-nums text-neutral-200 outline-none ring-1 ring-neutral-700 focus:ring-blue-500"
            value={local.z}
            onChange={(e) => handleChange("z", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
