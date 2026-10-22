"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { blockCreationScope, endCreationSession, getCreationScope, setCreationAccount } from "@/lib/character/pending-creation-storage";

/** Local pending-request housekeeping, never an authentication authority. */
export function CreationSessionBoundary({ accountId }: { accountId: string | null | undefined }) {
  useEffect(() => {
    let active = true;
    try {
      // A remounted stale component cannot reactivate a signed-out lease.
      // A fresh document starts undefined; a successful SIGNED_IN can activate
      // the next account. Token refreshes never revive an invalidated lease.
      if (getCreationScope().accountId === undefined && accountId !== undefined) {
        setCreationAccount(accountId, window.sessionStorage);
      }
      const client = createClient();
      const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
        if (!active) return;
        if (event === "SIGNED_OUT" || (event === "INITIAL_SESSION" && !session)) {
          endCreationSession();
          return;
        }
        const observed = session?.user.id;
        if (!observed) return;
        const current = getCreationScope();
        if (event === "SIGNED_IN" && current.accountId !== observed) {
          setCreationAccount(observed, window.sessionStorage);
        } else if (current.accountId !== undefined && current.accountId !== null && current.accountId !== observed) {
          // An account transition invalidates every in-flight response before
          // any later navigation can establish a new local account scope.
          endCreationSession();
        }
      });
      return () => { active = false; subscription.unsubscribe(); };
    } catch {
      // Keep the original record when storage/client setup is unavailable.
      // Invalidate writes without claiming a confirmed sign-out.
      blockCreationScope();
    }
  }, [accountId]);
  return null;
}
