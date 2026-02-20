"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createDefaultScene } from "@/lib/default-scene";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Lock } from "lucide-react";

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewProjectModal({ open, onClose }: NewProjectModalProps) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  async function handleCreate() {
    if (!name.trim()) return;

    setCreating(true);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("You must be logged in to create a project");
      setCreating(false);
      return;
    }

    const ecson = createDefaultScene(name.trim());

    const { data, error } = await supabase
      .from("projects")
      .insert({
        owner_id: user.id,
        name: name.trim(),
        ecson,
        entity_count: Object.keys(ecson.entities).length,
      })
      .select("id")
      .single();

    if (error) {
      toast.error("Failed to create project");
      setCreating(false);
      return;
    }

    toast.success("Project created");
    setName("");
    onClose();
    router.push(`/editor/${data.id}`);
  }

  return (
    <Modal open={open} onClose={onClose} title="New Project">
      <div className="flex flex-col gap-4">
        <Input
          label="Project Name"
          placeholder="My Awesome Scene"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
          }}
          autoFocus
        />

        <div className="flex flex-col gap-2">
          <Button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="w-full justify-center"
          >
            {creating ? "Creating..." : "Blank Scene"}
          </Button>
        </div>

        {/* Template slots -- locked until Phase 8 */}
        <div className="mt-2 border-t border-[var(--border)] pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
            Templates
          </p>
          <div className="grid grid-cols-2 gap-2">
            {["Platformer", "FPS Arena", "Puzzle Room", "Open World"].map(
              (template) => (
                <div
                  key={template}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] p-3 text-xs text-[var(--muted-foreground)] opacity-50"
                >
                  <Lock size={12} />
                  {template}
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
