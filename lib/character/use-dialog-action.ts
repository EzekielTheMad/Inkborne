"use client";

import { useEffect, useRef, useState } from "react";

/** One action per mounted dialog session. Activity may retain that session
 * while its effects are disconnected. Keep a settled outcome for its reveal;
 * destruction (open=false or a new spell key) never delivers it elsewhere. */
export function useDialogAction() {
  const active = useRef(true);
  const busy = useRef(false);
  const generation = useRef(0);
  const completion = useRef<(() => void) | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    active.current = true;
    const deliver = completion.current;
    completion.current = null;
    deliver?.();
    return () => { active.current = false; };
  }, []);

  return {
    pending,
    canDismiss: () => !busy.current,
    async run<T>(
      action: () => Promise<T>,
      onSuccess: (result: T) => void,
      onFailure: (error: unknown) => void,
    ) {
      if (busy.current || !active.current || completion.current) return;
      const actionGeneration = ++generation.current;
      busy.current = true;
      setPending(true);
      let deliver: () => void;
      try {
        const result = await action();
        deliver = () => onSuccess(result);
      } catch (error) {
        deliver = () => onFailure(error);
      }
      if (generation.current !== actionGeneration) return;
      busy.current = false;
      const finish = () => {
        if (generation.current !== actionGeneration) return;
        setPending(false);
        deliver();
      };
      if (active.current) finish();
      else completion.current = finish;
    },
  };
}
