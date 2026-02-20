"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  MoreVertical,
  Globe,
  Lock,
  Link as LinkIcon,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  thumbnail_url: string | null;
  entity_count: number;
  is_public: boolean;
  updated_at: string;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function ProjectCard({ project }: { project: Project }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(project.is_public);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  async function togglePublic() {
    const supabase = createClient();
    const newValue = !isPublic;
    const { error } = await supabase
      .from("projects")
      .update({ is_public: newValue })
      .eq("id", project.id);

    if (error) {
      toast.error("Failed to update visibility");
      return;
    }

    setIsPublic(newValue);
    toast.success(newValue ? "Project is now public" : "Project is now private");
    setMenuOpen(false);
  }

  function copyLink() {
    const url = `${window.location.origin}/editor/${project.id}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied!");
    setMenuOpen(false);
  }

  async function deleteProject() {
    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", project.id);

    if (error) {
      toast.error("Failed to delete project");
      return;
    }

    toast.success("Project deleted");
    router.refresh();
    setMenuOpen(false);
  }

  return (
    <div className="group relative rounded-xl border border-[var(--border)] bg-[var(--card)] transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20">
      {/* Thumbnail */}
      <button
        type="button"
        onClick={() => router.push(`/editor/${project.id}`)}
        className="block w-full cursor-pointer"
      >
        <div className="relative flex h-40 items-center justify-center rounded-t-xl bg-[var(--surface)]">
          {project.thumbnail_url ? (
            <Image
              src={project.thumbnail_url}
              alt={project.name}
              fill
              className="rounded-t-xl object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-[var(--muted-foreground)]">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
                <path d="M12 12l8-4.5" />
                <path d="M12 12v9" />
                <path d="M12 12L4 7.5" />
              </svg>
              <span className="text-xs">No preview</span>
            </div>
          )}
        </div>
      </button>

      {/* Info */}
      <div className="flex items-center justify-between p-3">
        <button
          type="button"
          onClick={() => router.push(`/editor/${project.id}`)}
          className="min-w-0 flex-1 cursor-pointer text-left"
        >
          <h3 className="truncate text-sm font-medium text-[var(--foreground)]">
            {project.name}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <span>{relativeTime(project.updated_at)}</span>
            <span className="opacity-40">|</span>
            <span>
              {project.entity_count}{" "}
              {project.entity_count === 1 ? "entity" : "entities"}
            </span>
            {isPublic && (
              <>
                <span className="opacity-40">|</span>
                <Globe size={12} className="text-[var(--accent)]" />
              </>
            )}
          </div>
        </button>

        {/* Menu */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="rounded-md p-1.5 text-[var(--muted-foreground)] opacity-0 transition-opacity hover:bg-[var(--muted)] hover:text-[var(--foreground)] group-hover:opacity-100"
          >
            <MoreVertical size={16} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-[var(--border)] bg-[var(--card)] py-1 shadow-xl">
              <button
                type="button"
                onClick={togglePublic}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
              >
                {isPublic ? <Lock size={14} /> : <Globe size={14} />}
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
              <hr className="my-1 border-[var(--border)]" />
              <button
                type="button"
                onClick={deleteProject}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--destructive)] hover:bg-[var(--muted)]"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
