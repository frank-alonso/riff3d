"use client";

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * Color picker widget using native HTML color input with a hex text field.
 * Displays a color swatch and allows both visual picking and hex entry.
 */
export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-28 shrink-0 truncate text-xs text-neutral-400">
        {label}
      </label>
      <div className="flex flex-1 items-center gap-1.5">
        <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded border border-neutral-600">
          <input
            type="color"
            className="absolute inset-[-4px] h-[calc(100%+8px)] w-[calc(100%+8px)] cursor-pointer border-0 p-0"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
        <input
          type="text"
          className="flex-1 rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-200 outline-none ring-1 ring-neutral-700 focus:ring-blue-500"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            // Only emit if it looks like a valid hex
            if (/^#[0-9a-fA-F]{6}$/.test(v)) {
              onChange(v);
            }
          }}
          onBlur={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{6}$/.test(v)) {
              onChange(v);
            }
          }}
        />
      </div>
    </div>
  );
}
