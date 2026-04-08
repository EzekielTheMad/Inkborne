"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
  contentRefs,
  schema,
}: RaceStepClientProps) {
  const router = useRouter();
  const supabase = createClient();
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

  async function handleSelectRace(content: ContentEntry) {
    setPreviewContent(null);

    const newChoices = {
      ...localChoices,
      race: content.slug,
      subrace: undefined,
    };
    setLocalChoices(newChoices);

    // Save to database
    await supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);

    // Remove old race content ref (if any)
    const oldRaceRef = contentRefs.find(
      (ref) => ref.content_definitions?.content_type === "race",
    );
    if (oldRaceRef) {
      await supabase
        .from("character_content_refs")
        .delete()
        .eq("id", oldRaceRef.id);
    }

    // Remove old subrace content ref (if any)
    const oldSubraceRef = contentRefs.find(
      (ref) => ref.content_definitions?.content_type === "subrace",
    );
    if (oldSubraceRef) {
      await supabase
        .from("character_content_refs")
        .delete()
        .eq("id", oldSubraceRef.id);
    }

    // Create new content ref
    await supabase.from("character_content_refs").insert([
      {
        character_id: characterId,
        content_id: content.id,
        content_version: content.version,
        context: { source: "race" },
      },
    ]);

    startTransition(() => router.refresh());
  }

  async function handleSelectSubrace(subrace: ContentEntry) {
    const newChoices = { ...localChoices, subrace: subrace.slug };
    setLocalChoices(newChoices);

    await supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);

    // Remove old subrace ref
    const oldSubraceRef = contentRefs.find(
      (ref) => ref.content_definitions?.content_type === "subrace",
    );
    if (oldSubraceRef) {
      await supabase
        .from("character_content_refs")
        .delete()
        .eq("id", oldSubraceRef.id);
    }

    // Create new content ref
    await supabase.from("character_content_refs").insert([
      {
        character_id: characterId,
        content_id: subrace.id,
        content_version: subrace.version,
        context: { source: "subrace" },
      },
    ]);

    startTransition(() => router.refresh());
  }

  async function handleChangeRace() {
    const newChoices = {
      ...localChoices,
      race: undefined,
      subrace: undefined,
    };
    setLocalChoices(newChoices);

    await supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);

    // Remove race and subrace content refs
    const raceRefs = contentRefs.filter(
      (ref) =>
        ref.content_definitions?.content_type === "race" ||
        ref.content_definitions?.content_type === "subrace",
    );
    for (const ref of raceRefs) {
      await supabase
        .from("character_content_refs")
        .delete()
        .eq("id", ref.id);
    }

    startTransition(() => router.refresh());
  }

  async function handleChoiceSelect(choiceId: string, selections: string[]) {
    const newResolved = {
      ...localChoices.resolved_choices,
      [choiceId]: selections,
    };
    const newChoices = { ...localChoices, resolved_choices: newResolved };
    setLocalChoices(newChoices);

    await supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);
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

                <div className="flex flex-wrap gap-2 text-sm">
                  {selectedRaceContent.data.speed != null && (
                    <Badge variant="outline">
                      Speed: {String(selectedRaceContent.data.speed)} ft
                    </Badge>
                  )}
                  {selectedRaceContent.data.size != null && (
                    <Badge variant="outline" className="capitalize">
                      Size: {String(selectedRaceContent.data.size)}
                    </Badge>
                  )}
                </div>

                {/* Grants from race */}
                {selectedRaceContent.effects
                  .filter((e) => e.type === "grant")
                  .length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1">Traits</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedRaceContent.effects
                        .filter((e) => e.type === "grant")
                        .map((e, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {(e as { stat: string }).stat}:{" "}
                            {(e as { value: string }).value}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}

                {/* Race choices */}
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
                          onClick={() => {
                            const newChoices = {
                              ...localChoices,
                              subrace: undefined,
                            };
                            setLocalChoices(newChoices);
                            supabase
                              .from("characters")
                              .update({ choices: newChoices })
                              .eq("id", characterId);
                            startTransition(() => router.refresh());
                          }}
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
        />

        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() =>
              router.push(`/characters/${characterId}/builder/class`)
            }
          >
            Previous: Class
          </Button>
          <Button
            onClick={() =>
              router.push(`/characters/${characterId}/builder/background`)
            }
          >
            Next: Background
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
