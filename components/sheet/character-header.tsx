"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, CopyIcon, PencilIcon, StarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CharacterWithSystem } from "@/lib/types/character";
import { PortraitAvatar } from "@/components/narrative/portrait-avatar";
import { useCharacter } from "@/lib/character/character-context";
import { ColorPickerPopover } from "@/components/character/color-picker-popover";
import { updateCharacterColor } from "@/lib/supabase/character-client";

interface CharacterHeaderProps {
  character: CharacterWithSystem;
  inspiration: boolean;
  onToggleInspiration: () => void;
  mobile?: boolean;
  portraitUrl?: string;
  portraitCrop?: { x: number; y: number; width: number; height: number } | null;
}

const HEADER_GRADIENT_STYLE = {
  background:
    "linear-gradient(135deg, var(--character-color) 0%, color-mix(in oklab, var(--character-color) 55%, var(--background)) 100%)",
};

function getClassDisplay(character: CharacterWithSystem): string {
  const classes = character.choices?.classes;
  if (!classes || classes.length === 0) {
    return `Level ${character.level}`;
  }
  return classes
    .map((c) => {
      const name = c.slug.charAt(0).toUpperCase() + c.slug.slice(1);
      return `${name} ${c.level}`;
    })
    .join(" / ");
}

function getRaceDisplay(character: CharacterWithSystem): string {
  const race = character.choices?.race;
  const subrace = character.choices?.subrace;
  if (!race) return "";
  const raceName = race.charAt(0).toUpperCase() + race.slice(1);
  if (!subrace) return raceName;
  const subraceName = subrace.charAt(0).toUpperCase() + subrace.slice(1);
  return `${subraceName} ${raceName}`;
}

export function CharacterHeader({
  character,
  inspiration,
  onToggleInspiration,
  mobile = false,
  portraitUrl,
  portraitCrop,
}: CharacterHeaderProps) {
  const classDisplay = getClassDisplay(character);
  const raceDisplay = getRaceDisplay(character);
  const router = useRouter();
  const { primaryColor, setPrimaryColor, isOwner } = useCharacter();

  const handleColorChange = async (color: string | null) => {
    const prev = primaryColor;
    setPrimaryColor(color); // optimistic
    try {
      await updateCharacterColor(character.id, color);
      // Invalidate any cached server-rendered pages (e.g. the builder layout
      // also reads character.primary_color) so a subsequent navigation picks
      // up the new color without a hard reload.
      router.refresh();
    } catch (err) {
      setPrimaryColor(prev); // revert
      console.error("Failed to save character color:", err);
    }
  };

  const avatarEl = (
    <PortraitAvatar
      portraitUrl={portraitUrl ?? character.narrative?.portrait_url}
      cropArea={
        portraitCrop ??
        (character.narrative?.portrait_crop as
          | { x: number; y: number; width: number; height: number }
          | undefined)
      }
      characterName={character.name}
      size="sm"
    />
  );

  const avatarTrigger = isOwner ? (
    <ColorPickerPopover currentColor={primaryColor} onChange={handleColorChange}>
      <button
        type="button"
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        aria-label="Change character color"
      >
        {avatarEl}
      </button>
    </ColorPickerPopover>
  ) : (
    avatarEl
  );

  if (mobile) {
    return (
      <header
        className="flex items-center gap-2 px-4 py-2 border-b border-border"
        style={HEADER_GRADIENT_STYLE}
      >
        <Link href={`/characters/${character.id}`}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back to character"
            className="text-white hover:bg-white/15 hover:text-white"
          >
            <ArrowLeftIcon />
          </Button>
        </Link>

        {avatarTrigger}

        <div className="flex-1 min-w-0">
          <p className="j-display text-[15px] leading-tight text-white truncate">
            {character.name}
          </p>
          <p className="text-xs text-white/85 truncate">{classDisplay}</p>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={inspiration ? "Inspiration active" : "Inspiration inactive"}
          onClick={onToggleInspiration}
          className={cn(
            "hover:bg-white/15",
            inspiration ? "text-yellow-300 hover:text-yellow-300" : "text-white/70 hover:text-white",
          )}
        >
          <StarIcon className={cn("size-4", inspiration && "fill-current")} />
        </Button>

        {isOwner && (
          <Link href={`/characters/${character.id}/builder`}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Edit character"
              className="text-white hover:bg-white/15 hover:text-white"
            >
              <PencilIcon />
            </Button>
          </Link>
        )}

        {isOwner && (
          <Link href={`/characters/${character.id}/copy`}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Copy character"
              className="text-white/80 hover:bg-white/15 hover:text-white"
            >
              <CopyIcon />
            </Button>
          </Link>
        )}
      </header>
    );
  }

  return (
    <header
      className="flex items-center gap-4 px-6 py-4 border-b border-border"
      style={HEADER_GRADIENT_STYLE}
    >
      {/* Portrait avatar — owners get the color-picker trigger */}
      {avatarTrigger}

      {/* Identity */}
      <div className="flex-1 min-w-0">
        <h1 className="j-display text-[26px] text-white leading-tight">
          {character.name}
        </h1>
        <p className="text-sm text-white/85">
          {[raceDisplay, classDisplay].filter(Boolean).join(" · ")}
          {character.game_systems?.name && (
            <span className="ml-2 text-xs text-white/70">
              — {character.game_systems.name}
            </span>
          )}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          aria-label={inspiration ? "Remove inspiration" : "Grant inspiration"}
          onClick={onToggleInspiration}
          className={cn(
            "hover:bg-white/15",
            inspiration ? "text-yellow-300 hover:text-yellow-300" : "text-white/70 hover:text-white",
          )}
          title="Inspiration"
        >
          <StarIcon
            className={cn("size-5", inspiration && "fill-current")}
          />
        </Button>

        {isOwner && (
          <Link href={`/characters/${character.id}/builder`}>
            <Button
              variant="outline"
              size="sm"
              className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <PencilIcon />
              Edit
            </Button>
          </Link>
        )}

        {isOwner && (
          <Link href={`/characters/${character.id}/copy`}>
            <Button
              variant="outline"
              size="sm"
              className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <CopyIcon />
              Copy
            </Button>
          </Link>
        )}

        <Link href="/characters">
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/15 hover:text-white"
          >
            <ArrowLeftIcon />
            Characters
          </Button>
        </Link>
      </div>
    </header>
  );
}
