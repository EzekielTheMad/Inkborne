"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AuthShell,
  AuthCard,
  AuthHeading,
  AuthErrorBanner,
  AuthLabel,
} from "@/components/auth/auth-shell";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  }

  return (
    <AuthShell marginalia={"“A key, misplaced.”"}>
      <AuthCard>
        <AuthHeading
          kicker="Folio I · Recover"
          title="Reset your password."
          sub="Enter your email and we'll send you a reset link."
        />

        {success ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-foreground">
              Check your email for a password reset link. ✦
            </p>
            <p className="text-[12.5px] text-muted-foreground">
              <Link
                href="/login"
                className="text-accent underline underline-offset-[3px] hover:text-accent/80"
              >
                Back to login
              </Link>
            </p>
          </div>
        ) : (
          <>
            {error && <AuthErrorBanner title="That didn&rsquo;t work.">{error}</AuthErrorBanner>}
            <form onSubmit={handleSubmit} className="space-y-4">
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
              <Button type="submit" variant="gold" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send reset link"}
              </Button>
            </form>
            <p className="mt-5 text-center text-[12.5px] text-muted-foreground">
              <Link
                href="/login"
                className="text-accent underline underline-offset-[3px] hover:text-accent/80"
              >
                Back to login
              </Link>
            </p>
          </>
        )}
      </AuthCard>
    </AuthShell>
  );
}
