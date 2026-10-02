"use client";

import { useEffect, useRef, useState } from "react";

/** One action per mounted dialog session. Persistence is not cancelled when
 * the parent navigates away, but its completion cannot update a later session. */
export function useDialogAction() {
  const active = useRef(true);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  return {
    pending,
    canDismiss: () => !busy.current,
    async run<T>(
      action: () => Promise<T>,
      onSuccess: (result: T) => void,
      onFailure: () => void,
    ) {
      if (busy.current || !active.current) return;
      busy.current = true;
      setPending(true);
      try {
        const result = await action();
        if (active.current) onSuccess(result);
      } catch {
        if (active.current) onFailure();
      } finally {
        busy.current = false;
        if (active.current) setPending(false);
      }
    },
  };
}
