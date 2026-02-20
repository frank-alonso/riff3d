import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Editor layout server component.
 *
 * PROJ-03 access control:
 * - Project not found -> 404
 * - Private project + unauthenticated user -> redirect to /login with redirect param
 * - Private project + authenticated non-owner -> 403 access denied
 * - Public project + non-owner -> read-only view
 * - Owner -> full edit mode
 */
export default async function EditorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch project -- use service-level select that respects RLS
  // The "Public projects are readable by anyone" RLS policy allows
  // unauthenticated reads of public projects
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, owner_id, name, is_public")
    .eq("id", projectId)
    .single();

  // Project not found (or private + unauthenticated = RLS blocks it)
  if (error || !project) {
    // If user is not authenticated, this might be a private project
    // Redirect to login with redirect param so they can try again
    if (!user) {
      redirect(`/login?redirect=/editor/${projectId}`);
    }
    // Authenticated but still can't see it -> truly not found
    notFound();
  }

  // Private project access control
  if (!project.is_public) {
    if (!user) {
      redirect(`/login?redirect=/editor/${projectId}`);
    }
    if (user.id !== project.owner_id) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
          <div className="text-center">
            <h1 className="mb-2 text-2xl font-bold text-[var(--foreground)]">
              Access Denied
            </h1>
            <p className="text-[var(--muted-foreground)]">
              You do not have permission to view this project.
            </p>
          </div>
        </div>
      );
    }
  }

  // Determine if the current user is the owner
  const isOwner = user?.id === project.owner_id;

  return (
    <div
      className="h-screen w-screen overflow-hidden bg-[var(--background)]"
      data-project-id={project.id}
      data-project-name={project.name}
      data-is-owner={isOwner ? "true" : "false"}
      data-is-public={project.is_public ? "true" : "false"}
    >
      {children}
    </div>
  );
}
