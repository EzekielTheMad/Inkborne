"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/landing/logo";
import { LandingFooter } from "@/components/landing/landing-footer";
import Link from "next/link";

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen flex-col bg-background">
        <div className="flex flex-1 items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="items-center space-y-3">
              <Logo />
              <CardTitle className="text-center text-2xl">Loading...</CardTitle>
            </CardHeader>
          </Card>
        </div>
        <LandingFooter />
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [resendStatus, setResendStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [resendError, setResendError] = useState<string | null>(null);
  const supabase = createClient();

  async function handleResend() {
    if (!email) return;
    setResendStatus("loading");
    setResendError(null);

    const { error } = await supabase.auth.resend({ type: "signup", email });

    if (error) {
      setResendError(error.message);
      setResendStatus("error");
    } else {
      setResendStatus("success");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center space-y-3">
            <Logo />
            <CardTitle className="text-center text-2xl">Check your email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-center">
            <p className="text-sm text-muted-foreground">
              {email ? (
                <>
                  We sent a verification link to{" "}
                  <span className="font-medium text-foreground">{email}</span>.
                </>
              ) : (
                "We sent a verification link to your email address."
              )}
            </p>

            {resendStatus === "success" ? (
              <p className="text-sm text-foreground">Verification email resent.</p>
            ) : (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleResend}
                  disabled={resendStatus === "loading" || !email}
                >
                  {resendStatus === "loading" ? "Resending..." : "Resend verification email"}
                </Button>
                {resendStatus === "error" && resendError && (
                  <p className="text-sm text-destructive">{resendError}</p>
                )}
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              <Link href="/login" className="text-primary hover:underline">
                Back to login
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
      <LandingFooter />
    </div>
  );
}
