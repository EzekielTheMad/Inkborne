"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
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
import { login, type LoginActionState } from "./actions";

const initialLoginState: LoginActionState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialLoginState);
  const [oauthError, setOauthError] = useState<string | null>(null);

  async function handleOAuth(provider: OAuthProvider) {
    setOauthError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });

      if (error) setOauthError(error.message);
    } catch {
      setOauthError("Unable to start sign in. Please try again.");
    }
  }

  const error = oauthError ?? state.error;

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

        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <AuthLabel htmlFor="email">Email</AuthLabel>
            <Input id="email" name="email" type="email" autoComplete="email" required />
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
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <Button
            type="submit"
            variant="gold"
            className="w-full"
            disabled={pending}
            aria-disabled={pending}
          >
            {pending ? "Signing in..." : "Sign in →"}
          </Button>
          <span className="sr-only" role="status" aria-live="polite">
            {pending ? "Signing in" : ""}
          </span>
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
