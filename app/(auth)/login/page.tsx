"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AuthShell,
  AuthCard,
  AuthHeading,
  AuthDivider,
  AuthErrorBanner,
  AuthLabel,
} from "@/components/auth/auth-shell";
import { OAuthButtons, type OAuthProvider } from "@/components/auth/oauth-buttons";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  async function handleOAuth(provider: OAuthProvider) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  return (
    <AuthShell marginalia={"“Open the notebook.”"}>
      <AuthCard>
        <AuthHeading
          kicker="Folio I · Sign in"
          title="Welcome back."
          sub="Your characters are right where you left them."
        />

        <OAuthButtons onSelect={handleOAuth} />

        <AuthDivider />

        {error && (
          <AuthErrorBanner title="That didn&rsquo;t match.">
            {error}{" "}
            <Link
              href="/auth/forgot-password"
              className="text-accent underline underline-offset-2 hover:text-accent/80"
            >
              Reset your password
            </Link>
          </AuthErrorBanner>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <AuthLabel htmlFor="email">Email</AuthLabel>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <AuthLabel htmlFor="password">Password</AuthLabel>
              <Link
                href="/auth/forgot-password"
                className="text-[11px] text-muted-foreground transition-colors hover:text-accent"
              >
                Forgot?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" variant="gold" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in →"}
          </Button>
        </form>

        <p className="mt-5 text-center text-[12.5px] text-muted-foreground">
          New here?{" "}
          <Link
            href="/signup"
            className="text-accent underline underline-offset-[3px] hover:text-accent/80"
          >
            Begin a notebook
          </Link>
        </p>
      </AuthCard>
    </AuthShell>
  );
}
