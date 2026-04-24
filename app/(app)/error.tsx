"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { reportClientError } from "@/lib/supabase/errors";

/**
 * Error boundary for the authenticated area. Next.js App Router convention:
 * any segment that throws during render gets caught here.
 *
 * Reports the error via the app_errors table (client_boundary source), then
 * shows a friendly fallback with "Try again" (Next's reset) and a link back
 * to the dashboard.
 */
export default function AppErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Fire-and-forget report. reportClientError swallows its own failures.
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await reportClientError(supabase, user.id, {
        source: "client_boundary",
        message: error.message,
        stack: error.stack ?? null,
        pageUrl: typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : null,
        userAgent: typeof window !== "undefined" ? window.navigator.userAgent : null,
        context: error.digest ? { digest: error.digest } : null,
      });
    })();
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          We&apos;ve logged the error automatically. You can try again, head back to the
          dashboard, or let us know what happened via the Feedback button in the nav.
        </p>
        {error.message && (
          <p className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded">
            {error.message}
          </p>
        )}
        <div className="flex gap-2 justify-center">
          <Button onClick={reset}>Try again</Button>
          <Link href="/dashboard">
            <Button variant="outline">Back to dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
