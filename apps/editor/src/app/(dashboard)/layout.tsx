import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardNav } from "./nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const isAnonymous = user.is_anonymous ?? !user.email;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <DashboardNav
        email={isAnonymous ? "Guest" : (user.email ?? "")}
        avatarUrl={user.user_metadata?.avatar_url as string | undefined}
        isAnonymous={isAnonymous}
      />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
