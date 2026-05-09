"use client";

import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 767px)";

/**
 * SSR-safe hook for sub-`md` viewport detection.
 *
 * Always returns `false` on the server AND on the client's first render
 * (matching the server's HTML so hydration doesn't mismatch). After hydration,
 * a useEffect reads the actual viewport via matchMedia and triggers a
 * re-render if it differs.
 *
 * The trade-off: mobile users see a brief desktop-shaped flash on first paint
 * before the layout switches to mobile. The alternative (synchronous matchMedia
 * on first render) causes a React hydration warning and bails out of hydration
 * for the affected subtree, which is worse.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(MOBILE_QUERY);
    setIsMobile(mql.matches);
    const onChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
