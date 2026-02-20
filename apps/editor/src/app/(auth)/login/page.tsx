"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type Provider = "google" | "discord" | "github";

const providers: { id: Provider; label: string }[] = [
  { id: "github", label: "GitHub" },
  { id: "google", label: "Google" },
  { id: "discord", label: "Discord" },
];

export default function LoginPage() {
  const [loading, setLoading] = useState<Provider | null>(null);
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/";

  async function handleLogin(provider: Provider) {
    setLoading(provider);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
      },
    });

    if (error) {
      console.error("Login error:", error.message);
      setLoading(null);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            Riff3D
          </h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Sign in to your account
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {providers.map(({ id, label }) => (
            <Button
              key={id}
              variant="secondary"
              onClick={() => handleLogin(id)}
              disabled={loading !== null}
              className="w-full justify-center"
            >
              {loading === id ? "Redirecting..." : `Continue with ${label}`}
            </Button>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-[var(--muted-foreground)]">
          By continuing, you agree to our terms of service.
        </p>
      </div>
    </div>
  );
}
