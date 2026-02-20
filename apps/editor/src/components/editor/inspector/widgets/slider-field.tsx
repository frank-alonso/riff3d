"use client";

interface SliderFieldProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}

/**
 * Slider widget for numeric properties with a range constraint.
 * Shows a range input alongside the numeric value.
 */
export function SliderField({
  label,
  value,
  min = 0,
  max = 100,
  step = 0.01,
  onChange,
}: SliderFieldProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-28 shrink-0 truncate text-xs text-neutral-400">
        {label}
      </label>
      <input
        type="range"
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-neutral-700 accent-blue-500"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className="w-12 shrink-0 text-right text-xs tabular-nums text-neutral-300">
        {typeof value === "number" ? value.toFixed(2) : value}
      </span>
    </div>
  );
}
