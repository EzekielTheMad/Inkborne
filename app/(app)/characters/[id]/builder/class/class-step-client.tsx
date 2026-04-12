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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ContentBrowser, type ContentEntry } from "@/components/builder/content-browser";
import { ContentPreview } from "@/components/builder/content-preview";
import { ChoiceSelector } from "@/components/builder/choice-selector";
import { SubclassSelector } from "@/components/builder/subclass-selector";
import { AsiSelector } from "@/components/builder/asi-selector";
import { StatPreview } from "@/components/builder/stat-preview";
import type { CharacterChoices, AsiChoice } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { Effect, ChoiceEffect } from "@/lib/types/effects";

interface ClassStepClientProps {
  characterId: string;
  character: {
    id: string;
    level: number;
    base_stats: Record<string, number>;
    choices: CharacterChoices;
  };
  classes: ContentEntry[];
  subclasses: ContentEntry[];
  features: ContentEntry[];
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

export function ClassStepClient({
  characterId,
  character,
  classes,
  subclasses,
  features,
  contentRefs,
  schema,
}: ClassStepClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();
  const [previewContent, setPreviewContent] = useState<ContentEntry | null>(null);
  const [localChoices, setLocalChoices] = useState<CharacterChoices>(
    character.choices ?? {},
  );
  const [localLevel, setLocalLevel] = useState(character.level);

  const selectedClasses = localChoices.classes ?? [];
  const hasClass = selectedClasses.length > 0;

  const allEffects: Effect[] = contentRefs.flatMap(
    (ref) => ref.content_definitions?.effects ?? [],
  );

  async function handleSelectClass(content: ContentEntry) {
    setPreviewContent(null);

    const newClasses = [...selectedClasses, { slug: content.slug, level: 1 }];
    const totalLevel = newClasses.reduce((sum, c) => sum + c.level, 0);
    const newChoices = { ...localChoices, classes: newClasses };

    setLocalChoices(newChoices);
    setLocalLevel(totalLevel);

    // Save to database
    await supabase
      .from("characters")
      .update({ choices: newChoices, level: totalLevel })
      .eq("id", characterId);

    // Create content ref
    await supabase.from("character_content_refs").insert([
      {
        character_id: characterId,
        content_id: content.id,
        content_version: content.version,
        context: { source: "class", level: 1 },
      },
    ]);

    startTransition(() => router.refresh());
  }

  async function handleLevelChange(classIndex: number, newLevel: number) {
    const updatedClasses = [...selectedClasses];
    updatedClasses[classIndex] = { ...updatedClasses[classIndex], level: newLevel };
    const totalLevel = updatedClasses.reduce((sum, c) => sum + c.level, 0);
    const newChoices = { ...localChoices, classes: updatedClasses };

    setLocalChoices(newChoices);
    setLocalLevel(totalLevel);

    await supabase
      .from("characters")
      .update({ choices: newChoices, level: totalLevel })
      .eq("id", characterId);

    startTransition(() => router.refresh());
  }

  async function handleRemoveClass(classIndex: number) {
    const removedClass = selectedClasses[classIndex];
    const updatedClasses = selectedClasses.filter((_, i) => i !== classIndex);
    const totalLevel = updatedClasses.reduce((sum, c) => sum + c.level, 0);
    const newChoices = { ...localChoices, classes: updatedClasses };

    setLocalChoices(newChoices);
    setLocalLevel(Math.max(totalLevel, 1));

    await supabase
      .from("characters")
      .update({ choices: newChoices, level: Math.max(totalLevel, 1) })
      .eq("id", characterId);

    // Remove content ref for this class
    const classContentRef = contentRefs.find(
      (ref) =>
        ref.content_definitions?.slug === removedClass.slug &&
        ref.content_definitions?.content_type === "class",
    );
    if (classContentRef) {
      await supabase
        .from("character_content_refs")
        .delete()
        .eq("id", classContentRef.id);
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

  async function handleSubclassSelect(
    classSlug: string,
    classIndex: number,
    subclassSlug: string | undefined,
  ) {
    const updatedClasses = [...selectedClasses];
    updatedClasses[classIndex] = {
      ...updatedClasses[classIndex],
      subclass: subclassSlug,
    };
    const newChoices = { ...localChoices, classes: updatedClasses };
    setLocalChoices(newChoices);

    await supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);

    // Manage content ref for the subclass
    if (subclassSlug) {
      const subclassContent = subclasses.find((sc) => sc.slug === subclassSlug);
      if (subclassContent) {
        // Remove any existing subclass ref for this class
        const existingRef = contentRefs.find(
          (ref) =>
            ref.content_definitions?.content_type === "subclass" &&
            ref.context?.source === "subclass" &&
            ref.context?.class === classSlug,
        );
        if (existingRef) {
          await supabase
            .from("character_content_refs")
            .delete()
            .eq("id", existingRef.id);
        }

        await supabase.from("character_content_refs").insert([
          {
            character_id: characterId,
            content_id: subclassContent.id,
            content_version: subclassContent.version,
            context: { source: "subclass", class: classSlug },
          },
        ]);
      }
    } else {
      // Remove subclass content ref
      const existingRef = contentRefs.find(
        (ref) =>
          ref.content_definitions?.content_type === "subclass" &&
          ref.context?.source === "subclass" &&
          ref.context?.class === classSlug,
      );
      if (existingRef) {
        await supabase
          .from("character_content_refs")
          .delete()
          .eq("id", existingRef.id);
      }
    }

    startTransition(() => router.refresh());
  }

  async function handleAsiSelect(featureSlug: string, choice: AsiChoice) {
    const newAsiChoices = {
      ...localChoices.asi_choices,
      [featureSlug]: choice,
    };
    const newChoices = { ...localChoices, asi_choices: newAsiChoices };
    setLocalChoices(newChoices);

    await supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);
  }

  /** Check feature type from data.feature_type field */
  function getFeatureType(feature: ContentEntry): string {
    return (feature.data.feature_type as string) ?? "passive";
  }

  // Get features for a specific class at a specific level
  function getFeaturesForClass(classSlug: string, level: number) {
    return features.filter((f) => {
      const data = f.data as Record<string, unknown>;
      return (
        data.class === classSlug &&
        typeof data.level === "number" &&
        data.level <= level
      );
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Class</h2>

        {hasClass ? (
          <div className="space-y-4">
            {selectedClasses.map((cls, index) => {
              const classData = classes.find((c) => c.slug === cls.slug);
              const classFeatures = getFeaturesForClass(cls.slug, cls.level);
              const choiceEffects = classFeatures.flatMap((f) =>
                f.effects.filter((e): e is ChoiceEffect => e.type === "choice"),
              );

              return (
                <Card key={`${cls.slug}-${index}`}>
                  <CardHeader>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <CardTitle className="capitalize">{cls.slug}</CardTitle>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-muted-foreground">
                          Level:
                        </label>
                        <select
                          value={cls.level}
                          onChange={(e) =>
                            handleLevelChange(index, parseInt(e.target.value))
                          }
                          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {Array.from({ length: 20 }, (_, i) => i + 1).map(
                            (lvl) => (
                              <option key={lvl} value={lvl}>
                                {lvl}
                              </option>
                            ),
                          )}
                        </select>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {"hit_die" in (classData?.data ?? {}) && (
                      <p className="text-sm text-muted-foreground mb-3">
                        Hit Die: d{String(classData?.data.hit_die)}
                      </p>
                    )}

                    {/* Class-level choices (skill proficiency, etc.) */}
                    {(() => {
                      const classChoices = (classData?.effects ?? []).filter(
                        (e): e is ChoiceEffect => e.type === "choice",
                      );
                      if (classChoices.length === 0) return null;
                      return (
                        <div className="space-y-3 mb-4">
                          <p className="text-sm font-medium">Class Proficiency Choices</p>
                          {classChoices.map((choice) => (
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
                          <Separator />
                        </div>
                      );
                    })()}

                    {classFeatures.length > 0 && (
                      <Accordion className="w-full">
                        {classFeatures.map((feature) => {
                          const featureChoices = feature.effects.filter(
                            (e): e is ChoiceEffect => e.type === "choice",
                          );
                          const featureLevel =
                            typeof feature.data.level === "number"
                              ? feature.data.level
                              : 0;
                          const featureType = getFeatureType(feature);
                          const showSubclass = featureType === "subclass";
                          const showAsi = featureType === "asi";
                          const hasInteraction =
                            featureChoices.length > 0 ||
                            showSubclass ||
                            showAsi;

                          return (
                            <AccordionItem
                              key={feature.id}
                              value={feature.id}
                            >
                              <AccordionTrigger className="text-sm">
                                <span className="flex flex-col items-start gap-0.5">
                                  <span className="flex items-center gap-2">
                                    {feature.name}
                                    {hasInteraction && (
                                      <Badge variant="secondary" className="text-xs">
                                        {showAsi
                                          ? "ASI"
                                          : showSubclass
                                            ? "Subclass"
                                            : `${featureChoices.length} choice${featureChoices.length > 1 ? "s" : ""}`}
                                      </Badge>
                                    )}
                                  </span>
                                  {featureLevel > 0 && (
                                    <span className="text-xs text-muted-foreground">
                                      {featureLevel === 1 ? "1st" : featureLevel === 2 ? "2nd" : featureLevel === 3 ? "3rd" : `${featureLevel}th`} level
                                    </span>
                                  )}
                                </span>
                              </AccordionTrigger>
                              <AccordionContent className="space-y-3">
                                {typeof feature.data.description === "string" && (
                                  <p className="text-sm text-muted-foreground">
                                    {feature.data.description}
                                  </p>
                                )}

                                {/* Subclass selector */}
                                {showSubclass && (
                                  <SubclassSelector
                                    classSlug={cls.slug}
                                    subclasses={subclasses}
                                    currentSelection={cls.subclass}
                                    onSelect={(slug) =>
                                      handleSubclassSelect(
                                        cls.slug,
                                        index,
                                        slug,
                                      )
                                    }
                                  />
                                )}

                                {/* ASI selector */}
                                {showAsi && (
                                  <AsiSelector
                                    featureSlug={feature.slug}
                                    currentChoice={
                                      localChoices.asi_choices?.[feature.slug]
                                    }
                                    onSelect={(choice) =>
                                      handleAsiSelect(feature.slug, choice)
                                    }
                                  />
                                )}

                                {/* Standard choice effects */}
                                {featureChoices.map((choice) => (
                                  <ChoiceSelector
                                    key={choice.choice_id}
                                    choiceEffect={choice}
                                    currentSelections={
                                      localChoices.resolved_choices?.[
                                        choice.choice_id
                                      ] ?? []
                                    }
                                    onSelect={(selections) =>
                                      handleChoiceSelect(
                                        choice.choice_id,
                                        selections,
                                      )
                                    }
                                  />
                                ))}
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    )}

                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveClass(index)}
                      >
                        Remove Class
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            <Separator />
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Add another class for multiclassing:
              </p>
              <ContentBrowser
                entries={classes.filter(
                  (c) => !selectedClasses.some((sc) => sc.slug === c.slug),
                )}
                contentTypeLabel="Class"
                onSelect={setPreviewContent}
              />
            </div>
          </div>
        ) : (
          <ContentBrowser
            entries={classes}
            contentTypeLabel="Class"
            onSelect={setPreviewContent}
          />
        )}

        <ContentPreview
          content={previewContent}
          contentTypeLabel="Class"
          onConfirm={handleSelectClass}
          onCancel={() => setPreviewContent(null)}
          features={features}
        />

        {/* Bottom navigation */}
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => router.push(`/characters/${characterId}/builder`)}
          >
            Back to Overview
          </Button>
          <Button
            onClick={() =>
              router.push(`/characters/${characterId}/builder/race`)
            }
          >
            Next: Race
          </Button>
        </div>
      </div>

      {/* Sidebar: StatPreview */}
      {schema && (
        <div className="hidden lg:block">
          <StatPreview
            baseStats={character.base_stats ?? {}}
            effects={allEffects}
            schema={schema}
            level={localLevel}
          />
        </div>
      )}
    </div>
  );
}
