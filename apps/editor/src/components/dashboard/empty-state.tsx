"use client";

import { Button } from "@/components/ui/button";
import { Box } from "lucide-react";

interface EmptyStateProps {
  onCreateProject: () => void;
}

export function EmptyState({ onCreateProject }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      {/* Placeholder illustration */}
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-[var(--surface)] text-[var(--muted-foreground)]">
        <Box size={48} strokeWidth={1} />
      </div>

      <h2 className="mb-2 text-xl font-semibold text-[var(--foreground)]">
        Welcome to Riff3D
      </h2>
      <p className="mb-6 max-w-sm text-sm text-[var(--muted-foreground)]">
        Create your first project to start building 3D experiences in the
        browser.
      </p>
      <Button onClick={onCreateProject} size="lg">
        Create your first project
      </Button>
    </div>
  );
}
