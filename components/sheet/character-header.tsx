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
import styles from "@/components/character/character-notebook.module.css";

interface CharacterHeaderProps {
  character: CharacterWithSystem;
  inspiration: boolean;
  onToggleInspiration: () => void;
  mobile?: boolean;
  portraitUrl?: string;
  portraitCrop?: { x: number; y: number; width: number; height: number } | null;
}

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
      className={styles.portrait}
      size={mobile ? "sm" : "lg"}
    />
  );

  const avatarTrigger = isOwner ? (
    <ColorPickerPopover currentColor={primaryColor} onChange={handleColorChange}>
      <button
        type="button"
        className={styles.portrait}
        aria-label="Change character color"
      >
        {avatarEl}
      </button>
    </ColorPickerPopover>
  ) : (
    avatarEl
  );

  return (
    <header className={cn(styles.identity, mobile && styles.identityMobile)}>
      {avatarTrigger}
      <div className={styles.identityText}>
        <p className={styles.eyebrow}>Character notebook</p>
        <h1 className={styles.identityName}>{character.name}</h1>
        <p className={styles.identityDescription}>
          <span>{[raceDisplay, classDisplay].filter(Boolean).join(" · ")}</span>
          {character.game_systems?.name && <span className={styles.identitySystem}>{character.game_systems.name}</span>}
        </p>
      </div>
      <div className={styles.identityActions}>
        {mobile && <Link href={`/characters/${character.id}`}><Button variant="ghost" size="icon-sm" aria-label="Back to character"><ArrowLeftIcon /></Button></Link>}
        <Button
          variant="ghost"
          size={mobile ? "icon-sm" : "icon"}
          aria-label={mobile ? inspiration ? "Inspiration active" : "Inspiration inactive" : inspiration ? "Remove inspiration" : "Grant inspiration"}
          aria-pressed={inspiration}
          onClick={onToggleInspiration}
          className={cn(inspiration && styles.inspired)}
          title="Inspiration"
        ><StarIcon className={cn("size-5", inspiration && "fill-current")} /></Button>
        {isOwner && <Link href={`/characters/${character.id}/builder`}>
          <Button variant="outline" size={mobile ? "icon-sm" : "sm"} aria-label={mobile ? "Edit character" : undefined}>
            <PencilIcon />{!mobile && "Edit"}
          </Button>
        </Link>}
        {isOwner && <Link href={`/characters/${character.id}/copy`}>
          <Button variant="outline" size={mobile ? "icon-sm" : "sm"} aria-label={mobile ? "Copy character" : undefined}>
            <CopyIcon />{!mobile && "Copy"}
          </Button>
        </Link>}
        {!mobile && <Link href="/characters"><Button variant="ghost" size="sm"><ArrowLeftIcon />Characters</Button></Link>}
      </div>
    </header>
  );
}
