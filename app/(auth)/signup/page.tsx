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
import { signup, type SignupActionState } from "./actions";

const initialSignupState: SignupActionState = { error: null };

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, initialSignupState);
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
      setOauthError("Unable to start sign up. Please try again.");
    }
  }

  const error = oauthError ?? state.error;

  return (
    <AuthShell marginalia={"“Open a new notebook.”"}>
      <AuthCard>
        <AuthHeading
          kicker="Folio I · Begin"
          title="Open a notebook."
          sub="Inkborne is in alpha. Access is free while we build."
        />

        <OAuthButtons onSelect={handleOAuth} />

        <AuthDivider />

        {error && <AuthErrorBanner title="That didn&rsquo;t take.">{error}</AuthErrorBanner>}

        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <AuthLabel htmlFor="displayName">What should we call you?</AuthLabel>
            <Input
              id="displayName"
              name="displayName"
              autoComplete="name"
              placeholder="A name (any will do)"
              required
            />
          </div>
          <div className="space-y-1.5">
            <AuthLabel htmlFor="email">Email</AuthLabel>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-1.5">
            <AuthLabel htmlFor="password">Choose a password</AuthLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              required
              minLength={8}
            />
          </div>
          <Button
            type="submit"
            variant="gold"
            className="w-full"
            disabled={pending}
            aria-disabled={pending}
          >
            {pending ? "Creating account..." : "Create account →"}
          </Button>
          <span className="sr-only" role="status" aria-live="polite">
            {pending ? "Creating account" : ""}
          </span>
        </form>

        <p className="mt-5 text-center text-[12.5px] leading-relaxed text-muted-foreground">
          Already a scribe?{" "}
          <Link
            href="/login"
            className="text-accent underline underline-offset-[3px] hover:text-accent/80"
          >
            Sign in
          </Link>
        </p>
      </AuthCard>
    </AuthShell>
  );
}
