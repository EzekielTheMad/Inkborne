"use client";

import { usePathname } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { isCharacterNotebookPath } from "@/lib/character/notebook-route";
import { CharacterVisualProvider } from "./character-notebook-scope";
import styles from "./character-notebook.module.css";

const brandScope: CSSProperties = {};

export function CharacterRouteFrame({ children }: { children: ReactNode }) {
  const notebook = isCharacterNotebookPath(usePathname());
  const frame = <div className={`min-h-screen flex flex-col bg-background ${notebook ? styles.applicationFrame : ""}`} data-character-app={notebook || undefined}>{children}</div>;
  // Global navigation menus use brand roles, independently of the nested player accent.
  return notebook ? <CharacterVisualProvider style={brandScope} portalClassName={styles.portal}>{frame}</CharacterVisualProvider> : frame;
}
