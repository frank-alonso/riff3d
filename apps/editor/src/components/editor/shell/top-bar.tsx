"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Square, Save, User, Globe, LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface TopBarProps {
  projectId: string;
  projectName: string;
  isOwner: boolean;
  isPublic: boolean;
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
    navigator.clipboard.writeText(url);
    toast.success("Link copied!");
  }

  return (
    <div className="flex h-10 items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-3">
      {/* Left: Project name */}
      <div className="flex items-center gap-2">
        {editing && isOwner ? (
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveName();
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
                  onClick={togglePublic}
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

      {/* Center: Play controls (placeholder, non-functional until 02-07) */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled
          title="Play (coming soon)"
          className="flex h-7 w-7 items-center justify-center rounded text-[var(--muted-foreground)] opacity-50"
        >
          <Play size={14} />
        </button>
        <button
          type="button"
          disabled
          title="Pause (coming soon)"
          className="flex h-7 w-7 items-center justify-center rounded text-[var(--muted-foreground)] opacity-50"
        >
          <Pause size={14} />
        </button>
        <button
          type="button"
          disabled
          title="Stop (coming soon)"
          className="flex h-7 w-7 items-center justify-center rounded text-[var(--muted-foreground)] opacity-50"
        >
          <Square size={14} />
        </button>
      </div>

      {/* Right: Save status + User avatar */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
          <Save size={12} />
          Saved
        </span>
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--muted)]">
          <User size={12} className="text-[var(--muted-foreground)]" />
        </div>
      </div>
    </div>
  );
}
