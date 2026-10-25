import Link from "next/link";
import { PortraitAvatar, type CropArea } from "@/components/narrative/portrait-avatar";
import type { CharacterChoices } from "@/lib/types/character";
import { characterNotebookStyle } from "@/lib/character/notebook-colors";
import styles from "./notebook-overview.module.css";

/**
 * Compact character row for the dashboard list — the journey handoff's
 * JCharRow (journey-primitives.jsx): portrait, serif name, level tag,
 * muted sub-line.
 */
export interface CharacterRowProps {
  href: string;
  name: string;
  /** Null when the character hasn't been built yet. */
  level: number | null;
  subtitle: string;
  portraitUrl?: string | null;
  cropArea?: CropArea | null;
  primaryColor?: string | null;
  campaignName?: string | null;
}

/** "wizard 3 / cleric 1" choices → "Wizard 3 / Cleric 1". */
export function formatClassLine(choices: CharacterChoices | null | undefined): string | null {
  const classes = choices?.classes;
  if (!classes || classes.length === 0) return null;
  return classes
    .map((c) => `${c.slug.replace(/(^|[\s-])\w/g, (ch) => ch.toUpperCase())} ${c.level}`)
    .join(" / ");
}

export function CharacterRow({
  href,
  name,
  level,
  subtitle,
  portraitUrl,
  cropArea,
  primaryColor,
  campaignName,
}: CharacterRowProps) {
  return (
    <Link
      href={href}
      className={`${styles.entry} ${styles.row} group flex items-center gap-3.5 border transition-colors`}
      style={characterNotebookStyle(primaryColor ?? null)}
    >
      <PortraitAvatar
        portraitUrl={portraitUrl}
        cropArea={cropArea}
        characterName={name}
        size="sm"
        className={styles.portrait}
      />
      <div className="min-w-0 flex-1">
        <div className={`${styles.rowIdentity} flex items-baseline`}>
          <span className={`${styles.name} j-display text-foreground`}>{name}</span>
          {level != null ? (
            <span className="shrink-0 text-[11px] tracking-wider text-muted-foreground">
              · LVL {level}
            </span>
          ) : (
            <span className="j-marginalia shrink-0 text-[11px]">· unwritten</span>
          )}
        </div>
        <p className={`${styles.subtitle} text-muted-foreground`}>{subtitle}</p>
        {campaignName && (
          <p className={`${styles.subtitle} text-muted-foreground`}>Campaign · {campaignName}</p>
        )}
      </div>
      <span
        className={`${styles.arrow} shrink-0 text-sm`}
        aria-hidden="true"
      >
        ›
      </span>
    </Link>
  );
}
