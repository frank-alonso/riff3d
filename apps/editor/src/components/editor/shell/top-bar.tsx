"use client";

import { useState, useRef, useEffect } from "react";
import { Save, User, Globe, LinkIcon, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useEditorStore } from "@/stores/hooks";
import type { SaveStatus } from "@/stores/slices/save-slice";
import { PlayControls } from "@/components/editor/playtest/play-controls";
import { EngineSwitcher } from "./engine-switcher";
import { CollaboratorBar } from "@/components/editor/collaboration/collaborator-bar";

interface TopBarProps {
  projectId: string;
  projectName: string;
  isOwner: boolean;
  isPublic: boolean;
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  switch (status) {
    case "saved":
      return (
        <span className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
          <Save size={12} className="text-green-500" />
          Saved
        </span>
      );
    case "saving":
      return (
        <span className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
          <Loader2 size={12} className="animate-spin" />
          Saving...
        </span>
      );
    case "unsaved":
      return (
        <span className="flex items-center gap-1.5 text-xs text-yellow-500">
          <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
          Unsaved changes
        </span>
      );
    case "error":
      return (
        <span className="flex items-center gap-1.5 text-xs text-red-500">
          <AlertCircle size={12} />
          Save failed
        </span>
      );
  }
}

export function TopBar({
  projectId,
  projectName,
  isOwner,
  isPublic: initialIsPublic,
}: TopBarProps) {
  const [name, setName] = useState(projectName);
  const [editing, setEditing] = useState(false);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const isPaused = useEditorStore((s) => s.isPaused);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!settingsOpen) return;
    function handleClick(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [settingsOpen]);

  async function saveName() {
    setEditing(false);
    if (name.trim() === projectName) return;
    if (!name.trim()) {
      setName(projectName);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .update({ name: name.trim() })
      .eq("id", projectId);

    if (error) {
      toast.error("Failed to rename project");
      setName(projectName);
    }
  }

  async function togglePublic() {
    const supabase = createClient();
    const newValue = !isPublic;
    const { error } = await supabase
      .from("projects")
      .update({ is_public: newValue })
      .eq("id", projectId);

    if (error) {
      toast.error("Failed to update visibility");
      return;
    }

    setIsPublic(newValue);
    toast.success(newValue ? "Project is now public" : "Project is now private");
  }

  function copyLink() {
    const url = `${window.location.origin}/editor/${projectId}`;
    void navigator.clipboard.writeText(url);
    toast.success("Link copied!");
  }

  // Determine top bar background tint based on play state
  const topBarBg = isPlaying
    ? isPaused
      ? "bg-amber-950/30 border-amber-700/40"
      : "bg-cyan-950/30 border-cyan-700/40"
    : "bg-[var(--card)] border-[var(--border)]";

  return (
    <div className={`flex h-10 items-center justify-between border-b px-3 transition-colors duration-300 ${topBarBg}`}>
      {/* Left: Project name */}
      <div className="flex items-center gap-2">
        {editing && isOwner ? (
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => void saveName()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void saveName();
              if (e.key === "Escape") {
                setName(projectName);
                setEditing(false);
              }
            }}
            className="h-6 w-48 rounded border border-[var(--border)] bg-[var(--input)] px-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
          />
        ) : (
          <button
            type="button"
            onClick={() => isOwner && setEditing(true)}
            className={`text-sm font-medium text-[var(--foreground)] ${isOwner ? "cursor-text hover:underline" : "cursor-default"}`}
          >
            {name}
          </button>
        )}

        {/* Read-only badge for non-owners */}
        {!isOwner && (
          <span className="rounded bg-[var(--muted)] px-2 py-0.5 text-xs font-medium text-[var(--muted-foreground)]">
            View Only
          </span>
        )}

        {/* Project settings dropdown (owner only) */}
        {isOwner && (
          <div ref={settingsRef} className="relative">
            <button
              type="button"
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
              title="Project settings"
            >
              <Globe size={14} />
            </button>
            {settingsOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-lg border border-[var(--border)] bg-[var(--card)] py-1 shadow-xl">
                <button
                  type="button"
                  onClick={() => void togglePublic()}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
                >
                  <Globe size={14} />
                  {isPublic ? "Make Private" : "Make Public"}
                </button>
                {isPublic && (
                  <button
                    type="button"
                    onClick={copyLink}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
                  >
                    <LinkIcon size={14} />
                    Copy Link
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Center: Engine switcher + Play controls */}
      <div className="flex items-center gap-3">
        <EngineSwitcher />
        <PlayControls />
      </div>

      {/* Right: Save status + Collaborator bar + User avatar */}
      <div className="flex items-center gap-3">
        <SaveIndicator status={saveStatus} />
        <CollaboratorBar />
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--muted)]">
          <User size={12} className="text-[var(--muted-foreground)]" />
        </div>
      </div>
    </div>
  );
}
