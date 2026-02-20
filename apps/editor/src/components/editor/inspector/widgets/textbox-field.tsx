"use client";

interface TextboxFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * Text input widget for string properties.
 */
export function TextboxField({ label, value, onChange }: TextboxFieldProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-28 shrink-0 truncate text-xs text-neutral-400">
        {label}
      </label>
      <input
        type="text"
        className="flex-1 rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-200 outline-none ring-1 ring-neutral-700 focus:ring-blue-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
