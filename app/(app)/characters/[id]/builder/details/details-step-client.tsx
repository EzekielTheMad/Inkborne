"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { CharacterChoices } from "@/lib/types/character";

const ALIGNMENTS = [
  "Lawful Good",
  "Neutral Good",
  "Chaotic Good",
  "Lawful Neutral",
  "True Neutral",
  "Chaotic Neutral",
  "Lawful Evil",
  "Neutral Evil",
  "Chaotic Evil",
];

interface DetailsStepClientProps {
  characterId: string;
  character: {
    id: string;
    name: string;
    level: number;
    base_stats: Record<string, number>;
    choices: CharacterChoices;
  };
  contentNames: Record<string, string>;
}

export function DetailsStepClient({
  characterId,
  character,
  contentNames,
}: DetailsStepClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(character.name ?? "");
  const [alignment, setAlignment] = useState(
    character.choices?.alignment ?? "",
  );

  const choices = character.choices ?? {};
  const classChoices = choices.classes ?? [];
  const raceSlug = choices.race;
  const subraceSlug = choices.subrace;
  const backgroundSlug = choices.background;

  const raceName = raceSlug ? contentNames[raceSlug] ?? raceSlug : null;
  const subraceName = subraceSlug ? contentNames[subraceSlug] ?? subraceSlug : null;
  const backgroundName = backgroundSlug ? contentNames[backgroundSlug] ?? backgroundSlug : null;

  const abilityMethod = choices.ability_method;
  const ABILITY_LABELS: Record<string, string> = {
    strength: "STR",
    dexterity: "DEX",
    constitution: "CON",
    intelligence: "INT",
    wisdom: "WIS",
    charisma: "CHA",
  };

  async function handleSaveName(newName: string) {
    setName(newName);
    await supabase
      .from("characters")
      .update({ name: newName })
      .eq("id", characterId);
  }

  async function handleSaveAlignment(newAlignment: string) {
    setAlignment(newAlignment);
    const newChoices = { ...choices, alignment: newAlignment };
    await supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-semibold">Character Details</h2>
      <p className="text-sm text-muted-foreground">
        Review your character and set final details before viewing your sheet.
      </p>

      {/* Name */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Name</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={(e) => handleSaveName(e.target.value)}
            placeholder="Enter character name"
            className="max-w-sm text-lg font-medium"
          />
        </CardContent>
      </Card>

      {/* Alignment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alignment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {ALIGNMENTS.map((a) => (
              <Button
                key={a}
                variant={alignment === a ? "default" : "outline"}
                size="sm"
                onClick={() => handleSaveAlignment(a)}
                className="text-xs"
              >
                {a}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Character Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Race */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Race</span>
            <span className="text-sm font-medium">
              {subraceName ? `${subraceName} ${raceName}` : raceName ?? "—"}
            </span>
          </div>

          <Separator />

          {/* Classes */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Class</span>
            <div className="flex flex-wrap gap-1.5 justify-end">
              {classChoices.length > 0 ? (
                classChoices.map((c, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {contentNames[c.slug] ?? c.slug} {c.level}
                  </Badge>
                ))
              ) : (
                <span className="text-sm">—</span>
              )}
            </div>
          </div>

          <Separator />

          {/* Level */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Level</span>
            <span className="text-sm font-medium">{character.level}</span>
          </div>

          <Separator />

          {/* Background */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Background</span>
            <span className="text-sm font-medium">{backgroundName ?? "—"}</span>
          </div>

          <Separator />

          {/* Ability Scores */}
          <div>
            <span className="text-sm text-muted-foreground">Ability Scores</span>
            {abilityMethod && (
              <span className="text-xs text-muted-foreground ml-2">
                ({abilityMethod.replace(/_/g, " ")})
              </span>
            )}
            <div className="flex gap-3 mt-2">
              {Object.entries(character.base_stats ?? {}).map(([key, val]) => (
                <div key={key} className="text-center">
                  <p className="text-xs text-muted-foreground">
                    {ABILITY_LABELS[key] ?? key.toUpperCase().slice(0, 3)}
                  </p>
                  <p className="text-sm font-bold">{val}</p>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Alignment */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Alignment</span>
            <span className="text-sm font-medium">{alignment || "—"}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between pt-4">
        <Button
          variant="outline"
          onClick={() =>
            router.push(`/characters/${characterId}/builder/equipment`)
          }
        >
          Previous: Equipment
        </Button>
        <Button
          onClick={() => router.push(`/characters/${characterId}`)}
        >
          Finish &amp; View Character
        </Button>
      </div>
    </div>
  );
}
