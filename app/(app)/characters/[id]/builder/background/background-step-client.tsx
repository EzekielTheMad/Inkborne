"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface BackgroundStepClientProps {
  characterId: string;
  character: {
    id: string;
    level: number;
    base_stats: Record<string, number>;
    choices: CharacterChoices;
  };
  backgrounds: ContentEntry[];
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

export function BackgroundStepClient({
  characterId,
  character,
  backgrounds,
  contentRefs,
  schema,
}: BackgroundStepClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();
  const [previewContent, setPreviewContent] = useState<ContentEntry | null>(null);
  const [localChoices, setLocalChoices] = useState<CharacterChoices>(
    character.choices ?? {},
  );

  const selectedBackground = localChoices.background;
  const hasBackground = !!selectedBackground;
  const selectedBgContent = backgrounds.find(
    (b) => b.slug === selectedBackground,
  );

  const allEffects: Effect[] = contentRefs.flatMap(
    (ref) => ref.content_definitions?.effects ?? [],
  );

  const bgChoices: ChoiceEffect[] = (selectedBgContent?.effects ?? []).filter(
    (e): e is ChoiceEffect => e.type === "choice",
  );

  // Personality tables from background data
  const personalityTraits =
    (selectedBgContent?.data.personality_traits as string[] | undefined) ?? [];
  const ideals =
    (selectedBgContent?.data.ideals as string[] | undefined) ?? [];
  const bonds =
    (selectedBgContent?.data.bonds as string[] | undefined) ?? [];
  const flaws =
    (selectedBgContent?.data.flaws as string[] | undefined) ?? [];

  async function handleSelectBackground(content: ContentEntry) {
    setPreviewContent(null);

    const newChoices = {
      ...localChoices,
      background: content.slug,
      personality_traits: [],
      ideals: [],
      bonds: [],
      flaws: [],
    };
    setLocalChoices(newChoices);

    await supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);

    // Remove old background ref
    const oldRef = contentRefs.find(
      (ref) => ref.content_definitions?.content_type === "background",
    );
    if (oldRef) {
      await supabase
        .from("character_content_refs")
        .delete()
        .eq("id", oldRef.id);
    }

    await supabase.from("character_content_refs").insert([
      {
        character_id: characterId,
        content_id: content.id,
        content_version: content.version,
        context: { source: "background" },
      },
    ]);

    startTransition(() => router.refresh());
  }

  async function handleChangeBackground() {
    const newChoices = {
      ...localChoices,
      background: undefined,
      personality_traits: [],
      ideals: [],
      bonds: [],
      flaws: [],
    };
    setLocalChoices(newChoices);

    await supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);

    const bgRef = contentRefs.find(
      (ref) => ref.content_definitions?.content_type === "background",
    );
    if (bgRef) {
      await supabase
        .from("character_content_refs")
        .delete()
        .eq("id", bgRef.id);
    }

    startTransition(() => router.refresh());
  }

  async function handleNarrativeChange(
    field: "personality_traits" | "ideals" | "bonds" | "flaws",
    value: string[],
  ) {
    const newChoices = { ...localChoices, [field]: value };
    setLocalChoices(newChoices);

    await supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);
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

  const renderNarrativeSelector = (
    label: string,
    field: "personality_traits" | "ideals" | "bonds" | "flaws",
    options: string[],
    max: number,
  ) => {
    const current = localChoices[field] ?? [];

    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {label} ({current.length}/{max})
        </p>
        {options.length > 0 ? (
          <div className="space-y-1">
            {options.map((option, i) => {
              const isSelected = current.includes(option);
              const isDisabled = !isSelected && current.length >= max;

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      handleNarrativeChange(
                        field,
                        current.filter((v) => v !== option),
                      );
                    } else if (!isDisabled) {
                      handleNarrativeChange(field, [...current, option]);
                    }
                  }}
                  disabled={isDisabled}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm border transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary"
                      : isDisabled
                        ? "bg-muted text-muted-foreground border-border cursor-not-allowed opacity-50"
                        : "bg-card text-card-foreground border-border hover:bg-accent hover:text-accent-foreground cursor-pointer"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        ) : (
          <Input
            placeholder={`Enter custom ${label.toLowerCase()}`}
            value={current[0] ?? ""}
            onChange={(e) => handleNarrativeChange(field, [e.target.value])}
          />
        )}
      </div>
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Background</h2>

        {hasBackground && selectedBgContent ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{selectedBgContent.name}</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleChangeBackground}
                  >
                    Change Background
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {typeof selectedBgContent.data.description === "string" && (
                  <p className="text-sm text-muted-foreground">
                    {selectedBgContent.data.description}
                  </p>
                )}

                {selectedBgContent.effects
                  .filter((e) => e.type === "grant")
                  .length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedBgContent.effects
                      .filter((e) => e.type === "grant")
                      .map((e, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {(e as { stat: string }).stat}:{" "}
                          {(e as { value: string }).value}
                        </Badge>
                      ))}
                  </div>
                )}

                {bgChoices.map((choice) => (
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

            <Separator />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Personality</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderNarrativeSelector("Personality Traits", "personality_traits", personalityTraits, 2)}
                {renderNarrativeSelector("Ideals", "ideals", ideals, 1)}
                {renderNarrativeSelector("Bonds", "bonds", bonds, 1)}
                {renderNarrativeSelector("Flaws", "flaws", flaws, 1)}
              </CardContent>
            </Card>
          </div>
        ) : (
          <ContentBrowser
            entries={backgrounds}
            contentTypeLabel="Background"
            onSelect={setPreviewContent}
          />
        )}

        <ContentPreview
          content={previewContent}
          contentTypeLabel="Background"
          onConfirm={handleSelectBackground}
          onCancel={() => setPreviewContent(null)}
        />

        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() =>
              router.push(`/characters/${characterId}/builder/race`)
            }
          >
            Previous: Race
          </Button>
          <Button
            onClick={() =>
              router.push(`/characters/${characterId}/builder/abilities`)
            }
          >
            Next: Abilities
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
