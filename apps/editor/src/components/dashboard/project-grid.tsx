"use client";

import { ProjectCard } from "./project-card";

interface Project {
  id: string;
  name: string;
  thumbnail_url: string | null;
  entity_count: number;
  is_public: boolean;
  updated_at: string;
}

export function ProjectGrid({ projects }: { projects: Project[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
