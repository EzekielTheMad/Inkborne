"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Protect same-window link navigation and browser unload while this editor
 * has unconfirmed edits. SPA history/router commands need their own integration. */
export function useSaveNavigationGuard(subject = "ability scores") {
  const blocked = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!blocked.current || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return;
      const destination = new URL(link.href, window.location.href);
      if (!/^https?:$/.test(destination.protocol)) return;
      if (destination.origin === window.location.origin && destination.pathname === window.location.pathname &&
        destination.search === window.location.search) return;
      if (window.confirm(`Your latest ${subject} have not finished saving. Leaving may lose changes, and a save already sent may still complete. Leave anyway?`)) return;
      event.preventDefault();
      event.stopPropagation();
      setNotice(`Save your latest ${subject} before leaving. Wait for the save to finish, or retry if it failed.`);
    };
    const onUnload = (event: BeforeUnloadEvent) => {
      if (!blocked.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [subject]);
  const setBlocked = useCallback((value: boolean) => {
    blocked.current = value;
    if (!value) setNotice(null);
  }, []);
  return {
    notice,
    setBlocked,
  };
}
