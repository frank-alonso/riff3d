"use client";

interface Vec3InputProps {
  label: string;
  value: { x: number; y: number; z: number };
  onChange: (value: { x: number; y: number; z: number }) => void;
}

/**
 * Vec3 input widget with three inline number inputs labeled X/Y/Z.
 * Uses colored labels matching gizmo axis convention (red=X, green=Y, blue=Z).
 */
export function Vec3Input({ label, value, onChange }: Vec3InputProps) {
  const handleChange = (axis: "x" | "y" | "z", raw: string) => {
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      onChange({ ...value, [axis]: parsed });
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
            step="0.1"
            className="w-full min-w-0 rounded bg-neutral-800 px-1.5 py-1 text-xs tabular-nums text-neutral-200 outline-none ring-1 ring-neutral-700 focus:ring-blue-500"
            value={value.x}
            onChange={(e) => handleChange("x", e.target.value)}
          />
        </div>
        {/* Y */}
        <div className="flex flex-1 items-center gap-0.5">
          <span className="text-[10px] font-bold text-green-400">Y</span>
          <input
            type="number"
            step="0.1"
            className="w-full min-w-0 rounded bg-neutral-800 px-1.5 py-1 text-xs tabular-nums text-neutral-200 outline-none ring-1 ring-neutral-700 focus:ring-blue-500"
            value={value.y}
            onChange={(e) => handleChange("y", e.target.value)}
          />
        </div>
        {/* Z */}
        <div className="flex flex-1 items-center gap-0.5">
          <span className="text-[10px] font-bold text-blue-400">Z</span>
          <input
            type="number"
            step="0.1"
            className="w-full min-w-0 rounded bg-neutral-800 px-1.5 py-1 text-xs tabular-nums text-neutral-200 outline-none ring-1 ring-neutral-700 focus:ring-blue-500"
            value={value.z}
            onChange={(e) => handleChange("z", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
