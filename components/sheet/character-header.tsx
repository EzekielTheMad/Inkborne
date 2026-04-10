"use client";

import Link from "next/link";
import { ArrowLeftIcon, PencilIcon, StarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CharacterWithSystem } from "@/lib/types/character";
import { PortraitAvatar } from "@/components/narrative/portrait-avatar";

interface CharacterHeaderProps {
  character: CharacterWithSystem;
  inspiration: boolean;
  onToggleInspiration: () => void;
  mobile?: boolean;
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
}: CharacterHeaderProps) {
  const classDisplay = getClassDisplay(character);
  const raceDisplay = getRaceDisplay(character);

  if (mobile) {
    return (
      <header className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card">
        <Link href={`/characters/${character.id}`}>
          <Button variant="ghost" size="icon-sm" aria-label="Back to character">
            <ArrowLeftIcon />
          </Button>
        </Link>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-accent truncate">
            {character.name}
          </p>
          <p className="text-xs text-muted-foreground truncate">{classDisplay}</p>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={inspiration ? "Inspiration active" : "Inspiration inactive"}
          onClick={onToggleInspiration}
          className={cn(inspiration && "text-accent")}
        >
          <StarIcon className={cn("size-4", inspiration && "fill-current")} />
        </Button>

        <Link href={`/characters/${character.id}/builder`}>
          <Button variant="ghost" size="icon-sm" aria-label="Edit character">
            <PencilIcon />
          </Button>
        </Link>
      </header>
    );
  }

  return (
    <header className="flex items-center gap-4 px-6 py-4 border-b border-border bg-card">
      {/* Portrait avatar */}
      <PortraitAvatar
        portraitUrl={character.narrative?.portrait_url}
        characterName={character.name}
        size="sm"
      />

      {/* Identity */}
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-bold text-accent leading-tight">
          {character.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {[raceDisplay, classDisplay].filter(Boolean).join(" · ")}
          {character.game_systems?.name && (
            <span className="ml-2 text-xs">
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
          className={cn(inspiration && "text-accent")}
          title="Inspiration"
        >
          <StarIcon
            className={cn("size-5", inspiration && "fill-current")}
          />
        </Button>

        <Link href={`/characters/${character.id}/builder`}>
          <Button variant="outline" size="sm">
            <PencilIcon />
            Edit
          </Button>
        </Link>

        <Link href={`/characters/${character.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeftIcon />
            Dashboard
          </Button>
        </Link>
      </div>
    </header>
  );
}
