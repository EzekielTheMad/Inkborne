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

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: displayName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push(`/auth/verify?email=${encodeURIComponent(email)}`);
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

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-1.5">
            <AuthLabel htmlFor="displayName">What should we call you?</AuthLabel>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="A name (any will do)"
              required
            />
          </div>
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
            <AuthLabel htmlFor="password">Choose a password</AuthLabel>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
            />
          </div>
          <Button type="submit" variant="gold" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Create account →"}
          </Button>
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
