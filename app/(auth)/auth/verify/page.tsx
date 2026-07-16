"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AuthShell, AuthCard, AuthHeading } from "@/components/auth/auth-shell";
import { Quill } from "@/components/journey/ornaments";
import Link from "next/link";

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <AuthShell>
          <AuthCard className="text-center">
            <AuthHeading kicker="Folio II · Confirm" title="Loading..." />
          </AuthCard>
        </AuthShell>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}

function Step({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span className="j-display w-4 shrink-0 text-sm text-accent opacity-80">{n}.</span>
      <span className="text-[12.5px] leading-relaxed text-muted-foreground">{children}</span>
    </div>
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
    <AuthShell marginalia={"“Mid-stitch.”"}>
      <AuthCard className="max-w-[480px] text-center">
        <Quill className="mx-auto size-14 opacity-50" />
        <div className="mt-3">
          <AuthHeading kicker="Folio II · Confirm" title="We sent you a letter." />
        </div>
        <p className="-mt-2 mb-6 text-[13.5px] leading-relaxed text-muted-foreground">
          {email ? (
            <>
              Check <span className="text-accent">{email}</span> for a confirmation link. Most
              arrive within 30 seconds.
            </>
          ) : (
            "Check your inbox for a confirmation link. Most arrive within 30 seconds."
          )}
        </p>

        <div className="mb-5 rounded-lg border border-border bg-white/[0.02] p-4 text-left">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
            If it doesn&rsquo;t arrive…
          </p>
          <Step n="I">Check your spam or promotions tab — alpha mail sometimes lands there.</Step>
          <Step n="II">Wait a minute or two, then resend from the button below.</Step>
          <Step n="III">Still nothing after 5 minutes? Sign up again with a different address.</Step>
        </div>

        {resendStatus === "success" ? (
          <p className="mb-4 text-sm text-foreground">Verification email resent. ✦</p>
        ) : (
          <div className="mb-4 space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleResend}
              disabled={resendStatus === "loading" || !email}
            >
              {resendStatus === "loading" ? "Resending..." : "Resend email"}
            </Button>
            {resendStatus === "error" && resendError && (
              <p className="text-sm text-destructive">{resendError}</p>
            )}
          </div>
        )}

        <p className="text-[11.5px] text-muted-foreground">
          Wrong address?{" "}
          <Link
            href="/signup"
            className="text-accent underline underline-offset-[3px] hover:text-accent/80"
          >
            Restart
          </Link>
          {" · "}
          <Link
            href="/login"
            className="text-accent underline underline-offset-[3px] hover:text-accent/80"
          >
            Back to login
          </Link>
        </p>
      </AuthCard>
    </AuthShell>
  );
}
