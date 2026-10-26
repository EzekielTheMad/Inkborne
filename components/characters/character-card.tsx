import Link from "next/link";
import type { Character } from "@/lib/types/character";
import { PortraitAvatar, type CropArea } from "@/components/narrative/portrait-avatar";
import { formatClassLine } from "@/components/characters/character-row";
import { characterNotebookStyle } from "@/lib/character/notebook-colors";
import styles from "./notebook-overview.module.css";

interface CharacterCardProps {
  character: Character & {
    game_systems?: { name: string } | null;
    campaigns?: { name: string } | null;
  };
}

function formatRace(character: CharacterCardProps["character"]): string | null {
  const race = character.choices?.race;
  if (!race) return null;
  const subrace = character.choices?.subrace;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return subrace ? `${cap(subrace)} ${cap(race)}` : cap(race);
}

/**
 * Rich character card for the /characters grid — journey handoff's
 * "card grid, richer cards" direction: paper framing, portrait, serif
 * name + level tag, race/class line, system + campaign tags.
 */
export function CharacterCard({ character }: CharacterCardProps) {
  const classLine = formatClassLine(character.choices);
  const raceLine = formatRace(character);
  const built = !!classLine;
  const narrative = character.narrative as
    | { portrait_url?: string; portrait_crop?: CropArea | null }
    | null;

  return (
    <Link
      href={`/characters/${character.id}`}
      className={`${styles.entry} ${styles.card} j-card-paper group transition-colors`}
      style={characterNotebookStyle(character.primary_color)}
    >
      <div className={`${styles.cardIdentity} flex`}>
        <PortraitAvatar
          portraitUrl={narrative?.portrait_url}
          cropArea={narrative?.portrait_crop}
          characterName={character.name}
          size="md"
          className={styles.portrait}
        />
        <div className="min-w-0 flex-1">
          <div className={`${styles.cardHeading} flex items-baseline`}>
            <span className={`${styles.name} j-display text-foreground`} title={character.name}>
              {character.name}
            </span>
            {built && (
              <span className={`${styles.level} j-display shrink-0 text-[11px] tracking-[0.1em]`}>
                · LVL {character.level}
              </span>
            )}
          </div>
          <p className={`${styles.subtitle} text-muted-foreground`}>
            {built
              ? [raceLine, classLine].filter(Boolean).join(" · ")
              : "Unwritten — the builder awaits"}
          </p>
        </div>
      </div>
      <div className={`${styles.metadata} text-muted-foreground`}>
        <span className={styles.system}>
          <span className="text-accent" aria-hidden="true">★</span> {character.game_systems?.name ?? "Unknown system"}
        </span>
        {character.campaigns?.name && (
          <span className={styles.campaign}>Campaign · {character.campaigns.name}</span>
        )}
        <span className={styles.open}>
          Open ›
        </span>
      </div>
    </Link>
  );
}
