"use client";

interface NumberFieldProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}

/**
 * Number input widget with optional min/max/step constraints.
 * Includes up/down step buttons via native number input.
 */
export function NumberField({
  label,
  value,
  min,
  max,
  step = 0.1,
  onChange,
}: NumberFieldProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-28 shrink-0 truncate text-xs text-neutral-400">
        {label}
      </label>
      <input
        type="number"
        className="flex-1 rounded bg-neutral-800 px-2 py-1 text-xs tabular-nums text-neutral-200 outline-none ring-1 ring-neutral-700 focus:ring-blue-500"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const parsed = parseFloat(e.target.value);
          if (!isNaN(parsed)) {
            onChange(parsed);
          }
        }}
      />
    </div>
  );
}
