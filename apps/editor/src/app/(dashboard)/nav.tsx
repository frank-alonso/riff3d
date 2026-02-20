"use client";

import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";

interface DashboardNavProps {
  email: string;
  avatarUrl?: string;
}

export function DashboardNav({ email, avatarUrl }: DashboardNavProps) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="border-b border-[var(--border)] bg-[var(--card)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <span className="text-lg font-bold tracking-tight text-[var(--foreground)]">
          Riff3D
        </span>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-[var(--muted-foreground)] sm:inline">
            {email}
          </span>
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt="Avatar"
              width={28}
              height={28}
              className="rounded-full"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--muted)]">
              <User size={14} className="text-[var(--muted-foreground)]" />
            </div>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </nav>
  );
}
