"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Provider = "google" | "discord" | "github";

const providers: { id: Provider; label: string }[] = [
  { id: "github", label: "GitHub" },
  { id: "google", label: "Google" },
  { id: "discord", label: "Discord" },
];

function LoginForm() {
  const [loading, setLoading] = useState<Provider | null>(null);
  const [guestLoading, setGuestLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/";

  async function handleGuestLogin() {
    setGuestLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInAnonymously();

    if (error) {
      console.error("Guest login error:", error.message);
      setGuestLoading(false);
      return;
    }

    // Anonymous auth completes immediately — redirect to dashboard
    window.location.href = redirectTo;
  }

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

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setEmailLoading(true);
    setEmailError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
      },
    });

    if (error) {
      setEmailError(error.message);
    } else {
      setEmailSent(true);
    }
    setEmailLoading(false);
  }

  return (
    <>
      {emailSent ? (
        <div className="text-center">
          <p className="text-sm text-[var(--foreground)]">
            Check your email for a login link.
          </p>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            Sent to {email}
          </p>
          <Button
            variant="secondary"
            onClick={() => { setEmailSent(false); setEmail(""); }}
            className="mt-4 w-full justify-center"
          >
            Try a different email
          </Button>
        </div>
      ) : (
        <>
          <form onSubmit={handleEmailLogin} className="flex flex-col gap-3">
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={emailLoading}
              error={emailError ?? undefined}
            />
            <Button
              type="submit"
              disabled={emailLoading || !email}
              className="w-full justify-center"
            >
              {emailLoading ? "Sending..." : "Continue with Email"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--border)]" />
            <span className="text-xs text-[var(--muted-foreground)]">or</span>
            <div className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <div className="flex flex-col gap-3">
            {providers.map(({ id, label }) => (
              <Button
                key={id}
                variant="secondary"
                onClick={() => handleLogin(id)}
                disabled={loading !== null || emailLoading || guestLoading}
                className="w-full justify-center"
              >
                {loading === id ? "Redirecting..." : `Continue with ${label}`}
              </Button>
            ))}
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--border)]" />
            <span className="text-xs text-[var(--muted-foreground)]">or</span>
            <div className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <Button
            variant="secondary"
            onClick={handleGuestLogin}
            disabled={loading !== null || emailLoading || guestLoading}
            className="w-full justify-center"
          >
            {guestLoading ? "Setting up..." : "Continue as Guest"}
          </Button>
        </>
      )}
    </>
  );
}

export default function LoginPage() {
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

        <Suspense>
          <LoginForm />
        </Suspense>

        <p className="mt-6 text-center text-xs text-[var(--muted-foreground)]">
          By continuing, you agree to our terms of service.
        </p>
      </div>
    </div>
  );
}
