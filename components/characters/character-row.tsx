import Link from "next/link";
import { PortraitAvatar, type CropArea } from "@/components/narrative/portrait-avatar";
import type { CharacterChoices } from "@/lib/types/character";

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
}: CharacterRowProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 rounded-lg border border-border bg-white/[0.015] px-3.5 py-3 transition-colors hover:border-accent/40 hover:bg-accent/[0.03]"
    >
      <PortraitAvatar
        portraitUrl={portraitUrl}
        cropArea={cropArea}
        characterName={name}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="j-display truncate text-[15px] text-foreground">{name}</span>
          {level != null ? (
            <span className="shrink-0 text-[11px] tracking-wider text-muted-foreground">
              · LVL {level}
            </span>
          ) : (
            <span className="j-marginalia shrink-0 text-[11px]">· unwritten</span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <span
        className="shrink-0 text-sm text-muted-foreground transition-colors group-hover:text-accent"
        aria-hidden="true"
      >
        ›
      </span>
    </Link>
  );
}
