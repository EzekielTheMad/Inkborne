import Link from "next/link";
import type { Character } from "@/lib/types/character";
import { PortraitAvatar, type CropArea } from "@/components/narrative/portrait-avatar";
import { formatClassLine } from "@/components/characters/character-row";

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
      className="j-card-paper group block p-4 transition-colors hover:border-accent/40"
    >
      <div className="flex items-center gap-3.5">
        <PortraitAvatar
          portraitUrl={narrative?.portrait_url}
          cropArea={narrative?.portrait_crop}
          characterName={character.name}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="j-display truncate text-[17px] text-foreground">
              {character.name}
            </span>
            {built && (
              <span className="j-display shrink-0 text-[11px] tracking-[0.1em] text-accent">
                · LVL {character.level}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {built
              ? [raceLine, classLine].filter(Boolean).join(" · ")
              : "Unwritten — the builder awaits"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2.5 text-[11px] text-muted-foreground">
        <span>
          <span className="text-accent">★</span> {character.game_systems?.name ?? "Unknown system"}
        </span>
        {character.campaigns?.name && (
          <span className="truncate">· {character.campaigns.name}</span>
        )}
        <span className="ml-auto text-muted-foreground/70 transition-colors group-hover:text-accent">
          Open ›
        </span>
      </div>
    </Link>
  );
}
