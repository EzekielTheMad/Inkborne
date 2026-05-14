"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCharacter } from "@/lib/supabase/character-client";
import {
  insertContentRef,
  removeContentRefById,
} from "@/lib/supabase/content-refs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ContentBrowser, type ContentEntry } from "@/components/builder/content-browser";
import { ContentPreview } from "@/components/builder/content-preview";
import { ChoiceSelector } from "@/components/builder/choice-selector";
import { StatPreview } from "@/components/builder/stat-preview";
import type { CharacterChoices } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { Effect, ChoiceEffect } from "@/lib/types/effects";

const ABILITY_ABBR = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

function formatScores(scores: number[]): string {
  return scores
    .map((v, i) => (v !== 0 ? `${v > 0 ? "+" : ""}${v} ${ABILITY_ABBR[i]}` : null))
    .filter(Boolean)
    .join(", ");
}

function formatSlug(slug: string): string {
  return slug
    .replace(/^skill-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface RaceStepClientProps {
  characterId: string;
  character: {
    id: string;
    level: number;
    base_stats: Record<string, number>;
    choices: CharacterChoices;
  };
  races: ContentEntry[];
  subraces: ContentEntry[];
  traits: ContentEntry[];
  contentRefs: Array<{
    id: string;
    content_id: string;
    context: Record<string, unknown>;
    choice_source: string | null;
    content_definitions: {
      id: string;
      name: string;
      slug: string;
      content_type: string;
      data: Record<string, unknown>;
      effects: Effect[];
    };
  }>;
  schema: SystemSchemaDefinition | undefined;
}

export function RaceStepClient({
  characterId,
  character,
  races,
  subraces,
  traits,
  contentRefs,
  schema,
}: RaceStepClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [previewContent, setPreviewContent] = useState<ContentEntry | null>(null);
  const [localChoices, setLocalChoices] = useState<CharacterChoices>(
    character.choices ?? {},
  );

  const selectedRace = localChoices.race;
  const selectedSubrace = localChoices.subrace;
  const hasRace = !!selectedRace;

  // Get content type label from schema (Race vs Species)
  const raceTypeLabel =
    schema?.content_types?.find((ct) => ct.slug === "race")?.name ?? "Race";

  // Get the selected race's content entry
  const selectedRaceContent = races.find((r) => r.slug === selectedRace);
  const availableSubraces = subraces.filter(
    (sr) => (sr.data as Record<string, unknown>).parent_race === selectedRace,
  );
  const selectedSubraceContent = subraces.find(
    (sr) => sr.slug === selectedSubrace,
  );

  // Collect all effects for stat preview
  const allEffects: Effect[] = contentRefs.flatMap(
    (ref) => ref.content_definitions?.effects ?? [],
  );

  // Get choice effects from race and subrace
  const raceChoices: ChoiceEffect[] = (selectedRaceContent?.effects ?? []).filter(
    (e): e is ChoiceEffect => e.type === "choice",
  );
  const subraceChoices: ChoiceEffect[] = (
    selectedSubraceContent?.effects ?? []
  ).filter((e): e is ChoiceEffect => e.type === "choice");

  // Resolve trait choices from race's data.traits array
  const raceTraitSlugs = (selectedRaceContent?.data?.traits as string[] | undefined) ?? [];
  const resolvedTraits = raceTraitSlugs
    .map((slug) => traits.find((t) => t.slug === slug))
    .filter((t): t is ContentEntry => !!t);
  const traitChoices: Array<{ trait: ContentEntry; choice: ChoiceEffect }> = resolvedTraits.flatMap(
    (trait) =>
      (trait.effects ?? [])
        .filter((e): e is ChoiceEffect => e.type === "choice")
        .map((choice) => ({ trait, choice })),
  );

  async function handleSelectRace(content: ContentEntry) {
    setPreviewContent(null);

    const newChoices = {
      ...localChoices,
      race: content.slug,
      subrace: undefined,
    };

    const prev = localChoices;
    setLocalChoices(newChoices);

    try {
      await updateCharacter(characterId, { choices: newChoices });

      const oldRaceRef = contentRefs.find(
        (ref) => ref.content_definitions?.content_type === "race",
      );
      if (oldRaceRef) {
        await removeContentRefById(oldRaceRef.id);
      }
      const oldSubraceRef = contentRefs.find(
        (ref) => ref.content_definitions?.content_type === "subrace",
      );
      if (oldSubraceRef) {
        await removeContentRefById(oldSubraceRef.id);
      }

      await insertContentRef({
        characterId,
        contentId: content.id,
        contentVersion: content.version,
        context: { source: "race" },
      });

      startTransition(() => router.refresh());
    } catch (err) {
      setLocalChoices(prev);
      console.error("Failed to select race:", err);
    }
  }

  async function handleSelectSubrace(subrace: ContentEntry) {
    const newChoices = { ...localChoices, subrace: subrace.slug };

    const prev = localChoices;
    setLocalChoices(newChoices);

    try {
      await updateCharacter(characterId, { choices: newChoices });

      const oldSubraceRef = contentRefs.find(
        (ref) => ref.content_definitions?.content_type === "subrace",
      );
      if (oldSubraceRef) {
        await removeContentRefById(oldSubraceRef.id);
      }

      await insertContentRef({
        characterId,
        contentId: subrace.id,
        contentVersion: subrace.version,
        context: { source: "subrace" },
      });

      startTransition(() => router.refresh());
    } catch (err) {
      setLocalChoices(prev);
      console.error("Failed to select subrace:", err);
    }
  }

  async function handleChangeRace() {
    const newChoices = {
      ...localChoices,
      race: undefined,
      subrace: undefined,
    };

    const prev = localChoices;
    setLocalChoices(newChoices);

    try {
      await updateCharacter(characterId, { choices: newChoices });

      const raceRefs = contentRefs.filter(
        (ref) =>
          ref.content_definitions?.content_type === "race" ||
          ref.content_definitions?.content_type === "subrace",
      );
      for (const ref of raceRefs) {
        await removeContentRefById(ref.id);
      }

      startTransition(() => router.refresh());
    } catch (err) {
      setLocalChoices(prev);
      console.error("Failed to clear race:", err);
    }
  }

  async function handleChoiceSelect(choiceId: string, selections: string[]) {
    const newResolved = {
      ...localChoices.resolved_choices,
      [choiceId]: selections,
    };
    const newChoices = { ...localChoices, resolved_choices: newResolved };

    const prev = localChoices;
    setLocalChoices(newChoices);

    try {
      await updateCharacter(characterId, { choices: newChoices });
    } catch (err) {
      setLocalChoices(prev);
      console.error("Failed to save choice selection:", err);
    }
  }

  async function handleChangeSubrace() {
    const newChoices = { ...localChoices, subrace: undefined };

    const prev = localChoices;
    setLocalChoices(newChoices);

    try {
      await updateCharacter(characterId, { choices: newChoices });

      const oldSubraceRef = contentRefs.find(
        (ref) => ref.content_definitions?.content_type === "subrace",
      );
      if (oldSubraceRef) {
        await removeContentRefById(oldSubraceRef.id);
      }

      startTransition(() => router.refresh());
    } catch (err) {
      setLocalChoices(prev);
      console.error("Failed to clear subrace:", err);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">{raceTypeLabel}</h2>

        {hasRace && selectedRaceContent ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{selectedRaceContent.name}</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleChangeRace}
                  >
                    Change {raceTypeLabel}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {typeof selectedRaceContent.data.description === "string" && (
                  <p className="text-sm text-muted-foreground">
                    {selectedRaceContent.data.description}
                  </p>
                )}

                {/* Ability Score Bonuses */}
                {Array.isArray(selectedRaceContent.data.scores) && (
                  <div className="text-sm">
                    <span className="font-medium">Ability Scores: </span>
                    <span>{formatScores(selectedRaceContent.data.scores as number[])}</span>
                    {typeof selectedRaceContent.data.scorestxt === "string" && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {selectedRaceContent.data.scorestxt}
                      </p>
                    )}
                  </div>
                )}

                {/* Key stats badges */}
                <div className="flex flex-wrap gap-2 text-sm">
                  {/* Speed — prefer speed_detail over flat speed */}
                  {selectedRaceContent.data.speed_detail != null ? (
                    Object.entries(selectedRaceContent.data.speed_detail as Record<string, number>)
                      .filter(([key]) => key !== "encumbered")
                      .map(([type, spd]) => (
                        <Badge key={type} variant="outline">
                          {type === "walk" ? "Speed" : formatSlug(type)}: {spd} ft
                        </Badge>
                      ))
                  ) : selectedRaceContent.data.speed != null ? (
                    <Badge variant="outline">
                      Speed: {String(selectedRaceContent.data.speed)} ft
                    </Badge>
                  ) : null}
                  {selectedRaceContent.data.size != null && (
                    <Badge variant="outline" className="capitalize">
                      Size: {String(selectedRaceContent.data.size)}
                    </Badge>
                  )}
                  {/* Vision */}
                  {Array.isArray(selectedRaceContent.data.vision) &&
                    (selectedRaceContent.data.vision as Array<{ type: string; range: number }>).map((v, i) => (
                      <Badge key={i} variant="outline" className="capitalize">
                        {v.type} {v.range} ft
                      </Badge>
                    ))}
                </div>

                {/* Damage Resistances */}
                {Array.isArray(selectedRaceContent.data.dmgres) &&
                  (selectedRaceContent.data.dmgres as string[]).length > 0 && (
                  <div className="text-sm">
                    <span className="font-medium">Damage Resistance: </span>
                    <span className="capitalize">
                      {(selectedRaceContent.data.dmgres as string[]).join(", ")}
                    </span>
                  </div>
                )}

                {/* Save Advantages / Immunities */}
                {selectedRaceContent.data.savetxt != null && (() => {
                  const savetxt = selectedRaceContent.data.savetxt as { adv_vs?: string[]; immune?: string[] };
                  const items = [
                    ...(savetxt.adv_vs ?? []).map((s) => `Advantage vs. ${s}`),
                    ...(savetxt.immune ?? []).map((s) => `Immune to ${s}`),
                  ];
                  return items.length > 0 ? (
                    <div className="text-sm">
                      <span className="font-medium">Defenses: </span>
                      <span>{items.join("; ")}</span>
                    </div>
                  ) : null;
                })()}

                {/* Racial Proficiencies */}
                {(() => {
                  const profs: Array<{ label: string; items: string[] }> = [];
                  const weapons = selectedRaceContent.data.weaponProfs as string[] | undefined;
                  const armor = selectedRaceContent.data.armorProfs as string[] | undefined;
                  const tools = selectedRaceContent.data.toolProfs as string[] | undefined;
                  const skills = selectedRaceContent.data.skills as string[] | undefined;
                  if (weapons?.length) profs.push({ label: "Weapons", items: weapons.map(formatSlug) });
                  if (armor?.length) profs.push({ label: "Armor", items: armor.map(formatSlug) });
                  if (tools?.length) profs.push({ label: "Tools", items: tools.map(formatSlug) });
                  if (skills?.length) profs.push({ label: "Skills", items: skills.map(formatSlug) });
                  return profs.length > 0 ? (
                    <div className="text-sm space-y-0.5">
                      {profs.map(({ label, items }) => (
                        <div key={label}>
                          <span className="font-medium">{label}: </span>
                          <span className="text-muted-foreground">{items.join(", ")}</span>
                        </div>
                      ))}
                    </div>
                  ) : null;
                })()}

                {/* Traits (non-choice, descriptive) */}
                {resolvedTraits.filter((t) => !(t.effects ?? []).some((e) => e.type === "choice")).length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1">Traits</p>
                    <div className="space-y-1.5">
                      {resolvedTraits
                        .filter((t) => !(t.effects ?? []).some((e) => e.type === "choice"))
                        .map((t) => (
                          <div key={t.slug} className="rounded-md border border-border bg-muted/50 px-3 py-2">
                            <p className="text-sm font-medium text-accent">{t.name}</p>
                            {typeof t.data.description === "string" && (
                              <p className="text-xs text-muted-foreground mt-0.5">{t.data.description}</p>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Race-level choices */}
                {raceChoices.map((choice) => (
                  <ChoiceSelector
                    key={choice.choice_id}
                    choiceEffect={choice}
                    currentSelections={
                      localChoices.resolved_choices?.[choice.choice_id] ?? []
                    }
                    onSelect={(selections) =>
                      handleChoiceSelect(choice.choice_id, selections)
                    }
                  />
                ))}

                {/* Trait-level choices (e.g., Dwarf Tool Proficiency, Half-Elf Skill Versatility) */}
                {traitChoices.map(({ trait, choice }) => (
                  <ChoiceSelector
                    key={choice.choice_id}
                    choiceEffect={choice}
                    currentSelections={
                      localChoices.resolved_choices?.[choice.choice_id] ?? []
                    }
                    onSelect={(selections) =>
                      handleChoiceSelect(choice.choice_id, selections)
                    }
                    label={`${trait.name}: Choose ${choice.choose}`}
                  />
                ))}
              </CardContent>
            </Card>

            {/* Subrace selector */}
            {availableSubraces.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Subrace</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedSubraceContent ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">
                          {selectedSubraceContent.name}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleChangeSubrace}
                        >
                          Change Subrace
                        </Button>
                      </div>
                      {typeof selectedSubraceContent.data.description === "string" && (
                        <p className="text-sm text-muted-foreground">
                          {selectedSubraceContent.data.description}
                        </p>
                      )}
                      {subraceChoices.map((choice) => (
                        <ChoiceSelector
                          key={choice.choice_id}
                          choiceEffect={choice}
                          currentSelections={
                            localChoices.resolved_choices?.[
                              choice.choice_id
                            ] ?? []
                          }
                          onSelect={(selections) =>
                            handleChoiceSelect(choice.choice_id, selections)
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {availableSubraces.map((sr) => (
                        <Card
                          key={sr.id}
                          className="cursor-pointer hover:bg-accent/50 transition-colors"
                          onClick={() => handleSelectSubrace(sr)}
                        >
                          <CardContent className="p-3">
                            <p className="font-medium text-sm">{sr.name}</p>
                            {typeof sr.data.description === "string" && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {sr.data.description.slice(0, 100)}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <ContentBrowser
            entries={races}
            contentTypeLabel={raceTypeLabel}
            onSelect={setPreviewContent}
          />
        )}

        <ContentPreview
          content={previewContent}
          contentTypeLabel={raceTypeLabel}
          onConfirm={handleSelectRace}
          onCancel={() => setPreviewContent(null)}
          features={traits}
        />

        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() =>
              router.push(`/characters/${characterId}/builder`)
            }
          >
            Back to Overview
          </Button>
          <Button
            className="bg-character-fg text-background hover:opacity-90"
            onClick={() =>
              router.push(`/characters/${characterId}/builder/class`)
            }
          >
            Next: Class
          </Button>
        </div>
      </div>

      {schema && (
        <div className="hidden lg:block">
          <StatPreview
            baseStats={character.base_stats ?? {}}
            effects={allEffects}
            schema={schema}
            level={character.level}
          />
        </div>
      )}
    </div>
  );
}
