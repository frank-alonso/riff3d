"use client";

interface DropdownFieldProps {
  label: string;
  value: string;
  options?: string[];
  onChange: (value: string) => void;
}

/**
 * Dropdown/select widget for enum-like properties.
 * Options can be explicitly provided or auto-detected from schema.
 */
export function DropdownField({
  label,
  value,
  options = [],
  onChange,
}: DropdownFieldProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-28 shrink-0 truncate text-xs text-neutral-400">
        {label}
      </label>
      <select
        className="flex-1 cursor-pointer rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-200 outline-none ring-1 ring-neutral-700 focus:ring-blue-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.length > 0 ? (
          options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))
        ) : (
          <option value={value}>{value}</option>
        )}
      </select>
    </div>
  );
}
