"use client";

interface CheckboxFieldProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

/**
 * Checkbox/toggle widget for boolean properties.
 */
export function CheckboxField({ label, value, onChange }: CheckboxFieldProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-28 shrink-0 truncate text-xs text-neutral-400">
        {label}
      </label>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          value ? "bg-blue-500" : "bg-neutral-700"
        }`}
        onClick={() => onChange(!value)}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            value ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
