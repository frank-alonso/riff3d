"use client";

import { ListTree, Package, Settings2 } from "lucide-react";
import { useEditorStore } from "@/stores/hooks";
import type { EditorState } from "@/stores/editor-store";

type PanelType = EditorState["activePanel"];

const activities: { id: PanelType; icon: typeof ListTree; label: string }[] = [
  { id: "hierarchy", icon: ListTree, label: "Hierarchy" },
  { id: "assets", icon: Package, label: "Assets" },
];

export function ActivityBar() {
  const activePanel = useEditorStore((s) => s.activePanel);
  const setActivePanel = useEditorStore((s) => s.setActivePanel);

  return (
    <div className="flex w-12 flex-col items-center gap-1 border-r border-[var(--border)] bg-[#0a0a0a] py-2">
      {activities.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => setActivePanel(id)}
          title={label}
          className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
            activePanel === id
              ? "bg-[var(--accent)] text-white"
              : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          <Icon size={20} />
        </button>
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings at bottom */}
      <button
        type="button"
        title="Settings"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <Settings2 size={20} />
      </button>
    </div>
  );
}
