"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { blockCreationScope, endCreationSession, getCreationScope, setCreationAccount } from "@/lib/character/pending-creation-storage";

/** Local pending-request housekeeping, never an authentication authority. */
export function CreationSessionBoundary({ accountId }: { accountId: string | null | undefined }) {
  const previousServerAccount = useRef(accountId);
  useEffect(() => {
    let active = true;
    const changed = previousServerAccount.current !== accountId;
    previousServerAccount.current = accountId;
    const currentScope = getCreationScope();
    const accountToVerify = changed && typeof accountId === "string"
      && !(currentScope.accountId === accountId && currentScope.storageReady) ? accountId : null;
    try {
      // A remounted stale component cannot reactivate a signed-out lease.
      // A server-action sign-in can change this mounted boundary's prop without
      // emitting SIGNED_IN in the browser. Invalidate old responses before a
      // fresh browser lookup confirms that exact new server account.
      if (accountToVerify !== null) {
        blockCreationScope();
      } else if (getCreationScope().accountId === undefined && accountId !== undefined) {
        setCreationAccount(accountId, window.sessionStorage);
      }
      const verificationEpoch = getCreationScope().epoch;
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
      if (accountToVerify !== null) {
        void (async () => {
          try {
            const { data, error } = await client.auth.getUser();
            if (!active || getCreationScope().epoch !== verificationEpoch) return;
            if (!error && data.user?.id === accountToVerify) {
              setCreationAccount(accountToVerify, window.sessionStorage);
            }
          } catch { /* Unknown Auth state keeps original bytes and the blocked lease. */ }
        })();
      }
      return () => { active = false; subscription.unsubscribe(); };
    } catch {
      // Keep the original record when storage/client setup is unavailable.
      // Invalidate writes without claiming a confirmed sign-out.
      blockCreationScope();
    }
  }, [accountId]);
  return null;
}
