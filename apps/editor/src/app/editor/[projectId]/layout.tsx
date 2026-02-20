import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Editor layout server component.
 *
 * Fetches the project data including the ECSON document from Supabase
 * and passes it to the client via a script tag with __RIFF3D_PROJECT_DATA__.
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

  // Fetch project with ECSON document
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, owner_id, name, is_public, ecson")
    .eq("id", projectId)
    .single();

  // Project not found (or private + unauthenticated = RLS blocks it)
  if (error || !project) {
    if (!user) {
      redirect(`/login?redirect=/editor/${projectId}`);
    }
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

  const isOwner = user?.id === project.owner_id;

  // Serialize project data for the client.
  // Using a script tag avoids data-attribute escaping issues with large JSON.
  const projectData = JSON.stringify({
    projectId: project.id,
    projectName: project.name,
    isOwner,
    isPublic: project.is_public,
    ecson: project.ecson,
  });

  return (
    <div className="h-screen w-screen overflow-hidden bg-[var(--background)]">
      <script
        id="__RIFF3D_PROJECT_DATA__"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: projectData }}
      />
      {children}
    </div>
  );
}
