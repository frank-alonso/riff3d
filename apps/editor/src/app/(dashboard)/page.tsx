import { createClient } from "@/lib/supabase/server";
import { DashboardContent } from "./content";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, thumbnail_url, entity_count, is_public, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch projects:", error.message);
  }

  return <DashboardContent projects={projects ?? []} />;
}
