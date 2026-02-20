"use client";

import { useState } from "react";
import { ProjectGrid } from "@/components/dashboard/project-grid";
import { NewProjectModal } from "@/components/dashboard/new-project-modal";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface Project {
  id: string;
  name: string;
  thumbnail_url: string | null;
  entity_count: number;
  is_public: boolean;
  updated_at: string;
}

export function DashboardContent({ projects }: { projects: Project[] }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      {projects.length === 0 ? (
        <EmptyState onCreateProject={() => setModalOpen(true)} />
      ) : (
        <div>
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              Projects
            </h1>
            <Button onClick={() => setModalOpen(true)} size="sm">
              <Plus size={16} />
              New Project
            </Button>
          </div>
          <ProjectGrid projects={projects} />
        </div>
      )}

      <NewProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
