"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { reportClientError } from "@/lib/supabase/errors";

/**
 * Mount-once client component that registers window error + unhandled-rejection
 * listeners. Reports to the app_errors table as the current authenticated user.
 *
 * Placed in the authenticated layout (`app/(app)/layout.tsx`) so it only runs
 * for signed-in users — RLS requires `user_id = auth.uid()` on insert anyway.
 *
 * Listeners run passively: they do NOT swallow the error or prevent default
 * browser handling. We just observe and report.
 */
export function ErrorListeners() {
  useEffect(() => {
    const supabase = createClient();

    async function getCurrentUserId(): Promise<string | null> {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id ?? null;
    }

    function pageUrl(): string | null {
      if (typeof window === "undefined") return null;
      return window.location.pathname + window.location.search;
    }

    function userAgent(): string | null {
      if (typeof window === "undefined") return null;
      return window.navigator.userAgent;
    }

    const handleError = async (e: ErrorEvent) => {
      const userId = await getCurrentUserId();
      if (!userId) return;
      // e.error may be null (e.g. CORS-opaque script errors — "Script error.")
      const message = e.error?.message || e.message || "Unknown error";
      const stack = e.error?.stack ?? null;
      await reportClientError(supabase, userId, {
        source: "client_unhandled",
        message,
        stack,
        pageUrl: pageUrl(),
        userAgent: userAgent(),
        context: e.filename
          ? { filename: e.filename, lineno: e.lineno, colno: e.colno }
          : null,
      });
    };

    const handleRejection = async (e: PromiseRejectionEvent) => {
      const userId = await getCurrentUserId();
      if (!userId) return;
      const reason = e.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Unhandled promise rejection";
      const stack = reason instanceof Error ? reason.stack ?? null : null;
      await reportClientError(supabase, userId, {
        source: "client_rejection",
        message,
        stack,
        pageUrl: pageUrl(),
        userAgent: userAgent(),
        context:
          reason && typeof reason === "object" && !(reason instanceof Error)
            ? { reason: JSON.parse(JSON.stringify(reason)) }
            : null,
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
