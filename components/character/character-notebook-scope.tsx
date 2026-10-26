"use client";

import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from "react";

interface NotebookVisuals { style: CSSProperties; portalClassName: string }
const VisualScope = createContext<NotebookVisuals | null>(null);

export function CharacterVisualProvider({ style, portalClassName, children }: NotebookVisuals & { children: ReactNode }) {
  const scope = useMemo(() => ({ style, portalClassName }), [style, portalClassName]);
  return <VisualScope value={scope}>{children}</VisualScope>;
}

/** React context carries the active notebook through a portal without changing
 * global tokens or another character's appearance. Outside a notebook, emit no DOM. */
export function CharacterPortalScope({ children }: { children: ReactNode }) {
  const scope = useContext(VisualScope);
  return scope ? <div className={scope.portalClassName} style={scope.style} data-character-portal>{children}</div> : children;
}
