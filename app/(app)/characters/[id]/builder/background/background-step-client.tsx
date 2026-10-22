"use client";
import type { AsiEvidence } from "@/lib/character/asi-contributions";
import { buildCharacterStructuredSources } from "@/lib/character/structured-sources";


import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSaveNavigationGuard } from "@/lib/builder/use-save-navigation-guard";
import { updateCharacter } from "@/lib/supabase/character-client";
import { setCharacterBackground } from "@/lib/supabase/background-selection-client";
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
import type { SaveBuilderStep } from "@/lib/builder/builder-step-command";

import { fixedLanguages, resolveChoiceOptions } from "@/lib/builder/choice-validation";

type NarrativeField = "personality_traits" | "ideals" | "bonds" | "flaws";

interface BackgroundStepClientProps {
  characterId: string;
  character: {
    id: string;
    system_id?: string;
    level: number;
    base_stats: Record<string, number>;
    choices: CharacterChoices;
    state?: Record<string, unknown>;
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
      version: number;
      source: string;
    };
  }>;
  asiEvidence?: AsiEvidence;
  schema: SystemSchemaDefinition | undefined;
  availableLanguages?: string[];
  saveAction?: SaveBuilderStep;
}

function getBackgroundSelectionError(
  error: unknown,
  action: "selected" | "cleared",
) {
  if (
    error instanceof Error
    && error.message.includes("starting equipment is confirmed")
  ) {
    return "Starting equipment is already confirmed. To protect your inventory, the background cannot be changed.";
  }

  return `The background could not be ${action}. Refresh and try again.`;
}

export function BackgroundStepClient({
  characterId,
  character,
  backgrounds,
  contentRefs,
  schema,
  asiEvidence,
  availableLanguages = [],
  saveAction,
}: BackgroundStepClientProps) {
  const saveBusy = useRef(false);
  const [customDrafts, setCustomDrafts] = useState<Partial<Record<NarrativeField, string[]>>>({});
  const { notice: navigationNotice, setBlocked } = useSaveNavigationGuard("background notes and choices");
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [previewContent, setPreviewContent] = useState<ContentEntry | null>(null);
  const [selectedOverride, setSelectedOverride] = useState<ContentEntry | null>(null);
  const [isChangingBackground, setIsChangingBackground] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [isSavingBackground, setIsSavingBackground] = useState(false);
  const [localChoices, setLocalChoices] = useState<CharacterChoices>(
    character.choices ?? {},
  );

  const selectedBackground = localChoices.background;
  const hasBackground = !!selectedBackground;
  const backgroundPins = contentRefs.filter(ref =>
    ref.content_id === ref.content_definitions.id &&
    ref.content_definitions.content_type === "background" &&
    ref.content_definitions.slug === selectedBackground);
  const conflictingPins = backgroundPins.length > 1;
  const pinnedBackground = backgroundPins.length === 1 ? backgroundPins[0].content_definitions : undefined;
  const selectedBgContent = conflictingPins ? undefined :
    (selectedOverride?.slug === selectedBackground ? selectedOverride : pinnedBackground);
  const missingSnapshot = !!selectedBackground && !selectedBgContent && !conflictingPins;

  const hasDrafts = Object.keys(customDrafts).length > 0;
  useEffect(() => {
    setBlocked(hasDrafts || isSavingBackground || !!selectionError);
  }, [hasDrafts, isSavingBackground, selectionError, setBlocked]);

  function beginSave() {
    if (saveBusy.current || conflictingPins) return false;
    saveBusy.current = true;
    setIsSavingBackground(true);
    setSelectionError(null);
    setBlocked(true);
    return true;
  }

  function navigateTo(step: string) {
    if (saveBusy.current) return;
    if ((hasDrafts || selectionError) && !window.confirm("Your background notes or choices have unconfirmed changes. A save already sent may still complete. Leave anyway?")) return;
    router.push(`/characters/${characterId}/builder/${step}`);
  }

  const allEffects: Effect[] = [
    ...contentRefs
      .filter((ref) => ref.content_definitions?.content_type !== "background")
      .flatMap((ref) => ref.content_definitions?.effects ?? []),
    ...(selectedBgContent?.effects ?? []),
  ];

  const bgChoices: ChoiceEffect[] = (selectedBgContent?.effects ?? []).filter(
    (e): e is ChoiceEffect => e.type === "choice",
  );

  // Personality tables from background data
  const personalityTraits =
    (selectedBgContent?.data.personality_traits as string[] | undefined) ?? [];
  const idealsRaw = (selectedBgContent?.data.ideals as Array<string | { text: string; alignment?: string }> | undefined) ?? [];
  const ideals = idealsRaw.map((ideal) =>
    typeof ideal === "string" ? ideal : ideal.text
  );
  const bonds =
    (selectedBgContent?.data.bonds as string[] | undefined) ?? [];
  const flaws =
    (selectedBgContent?.data.flaws as string[] | undefined) ?? [];

  function hasUnconfirmedNotes() {
    if (!hasDrafts) return false;
    setSelectionError("Save your unconfirmed notes before changing the background. Leave the text field or press Enter to retry.");
    return true;
  }

  async function handleSelectBackground(content: ContentEntry) {
    if (hasUnconfirmedNotes() || !beginSave()) return;

    setPreviewContent(null);

    const prev = localChoices;

    try {
      const savedChoices = saveAction
        ? (await saveAction("select_background", { content_id: content.id, content_version: content.version })).choices
        : (await setCharacterBackground(characterId, content.id, content.version)).savedChoices;
      setLocalChoices(savedChoices);
      setSelectedOverride(content);
      setIsChangingBackground(false);

      startTransition(() => router.refresh());
    } catch (error) {
      setLocalChoices(prev);
      setSelectionError(getBackgroundSelectionError(error, "selected"));
    } finally {
      saveBusy.current = false;
      setIsSavingBackground(false);
    }
  }

  function handleStartChangingBackground() {
    if (saveBusy.current || conflictingPins || hasUnconfirmedNotes()) return;

    setPreviewContent(null);
    setSelectionError(null);
    setIsChangingBackground(true);
  }

  function handleKeepCurrentBackground() {
    if (saveBusy.current || conflictingPins) return;

    setPreviewContent(null);
    setSelectionError(null);
    setIsChangingBackground(false);
  }

  async function handleNarrativeChange(
    field: NarrativeField,
    value: string[],
  ) {
    if (!beginSave()) return;

    const newChoices = { ...localChoices, [field]: value.filter(note => note.trim().length > 0) };

    const prev = localChoices;
    setLocalChoices(newChoices);

    try {
      if (saveAction) {
        const saved = await saveAction("background_narrative", { key: field, values: newChoices[field] });
        setLocalChoices(saved.choices);
        startTransition(() => router.refresh());
      } else await updateCharacter(characterId, { choices: newChoices });
      setCustomDrafts(drafts => {
        if (drafts[field] !== value) return drafts;
        const next = { ...drafts };
        delete next[field];
        return next;
      });
    } catch (err) {
      setLocalChoices(prev);
      console.error("Failed to save narrative trait:", err);
      setSelectionError("These background choices could not be confirmed. Reload the character before trying again.");
    } finally {
      saveBusy.current = false;
      setIsSavingBackground(false);
    }
  }

  async function handleChoiceSelect(choiceId: string, selections: string[]) {
    if (!beginSave()) return;

    const newResolved = {
      ...localChoices.resolved_choices,
      [choiceId]: selections,
    };
    const newChoices = { ...localChoices, resolved_choices: newResolved };

    const prev = localChoices;
    setLocalChoices(newChoices);

    try {
      if (saveAction) {
        const saved = await saveAction("background_choice", { choice_id: choiceId, selections });
        setLocalChoices(saved.choices);
        startTransition(() => router.refresh());
      } else await updateCharacter(characterId, { choices: newChoices });
    } catch (err) {
      setLocalChoices(prev);
      console.error("Failed to save choice selection:", err);
      setSelectionError("These background choices could not be confirmed. Reload the character before trying again.");
    } finally {
      saveBusy.current = false;
      setIsSavingBackground(false);
    }
  }

  const renderNarrativeSelector = (
    label: string,
    field: NarrativeField,
    options: string[],
    max: number,
  ) => {
    const current = customDrafts[field] ?? localChoices[field] ?? [];
    const selectedCount = current.filter(note => note.trim().length > 0).length;

    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {label} ({selectedCount}/{max})
        </p>
        {options.length > 0 ? (
          <div className="space-y-1">
            {options.map((option, i) => {
              const isSelected = current.includes(option);
              const isDisabled = !isSelected && selectedCount >= max;

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
                      ? "bg-character-bg text-character-fg border-character-border"
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
            aria-label={label}
            placeholder={`Enter custom ${label.toLowerCase()}`}
            value={current[0] ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              setBlocked(true);
              setCustomDrafts(drafts => ({ ...drafts, [field]: [value] }));
            }}
            onBlur={() => {
              const draft = customDrafts[field];
              if (draft) void handleNarrativeChange(field, draft);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
            }}
          />
        )}
      </div>
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <fieldset
        disabled={isSavingBackground || conflictingPins}
        aria-busy={isSavingBackground}
        className="min-w-0 space-y-6 border-0 p-0"
      >
        <h2 className="text-xl font-semibold">Background</h2>
        {hasDrafts && <p role="status" className="text-sm text-muted-foreground">You have unsaved notes. Leave the text field or press Enter to save.</p>}
        {navigationNotice && <p role="alert" className="text-sm text-destructive">{navigationNotice}</p>}
        {conflictingPins && <p role="alert" className="text-sm text-destructive">Multiple saved snapshots match this background. Reload the character and resolve its references before editing.</p>}
        {missingSnapshot && <p role="alert" className="text-sm text-destructive">The selected background has no matching saved snapshot. Reload the character and check its references before making further choices.</p>}

        {hasBackground && selectedBgContent && !isChangingBackground ? (
          <div className="space-y-4">
            <Card>
              {/* Chrome can collapse this inline-size container after retained Activity updates.
                  This header has no container queries; keep its recovery controls visible. */}
              <CardHeader
                style={{ containerType: "normal" }}
                className="flex flex-row items-center justify-between"
              >
                <CardTitle>{selectedBgContent.name}</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartChangingBackground}
                    disabled={isSavingBackground}
                  >
                    {isSavingBackground ? "Saving..." : "Change Background"}
                  </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {typeof selectedBgContent.data.description === "string" && (
                  <p className="text-sm text-muted-foreground">
                    {selectedBgContent.data.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">
                    {selectedBgContent.source === "srd" ? "SRD" : "Homebrew"}
                  </Badge>
                  <Badge variant="secondary">v{selectedBgContent.version}</Badge>
                </div>

                {selectedBgContent.data.feature != null
                  && typeof selectedBgContent.data.feature === "object" && (
                  <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
                    <p className="text-sm font-medium text-accent">
                      {String((selectedBgContent.data.feature as { name?: unknown }).name ?? "Background Feature")}
                    </p>
                    {(selectedBgContent.data.feature as { description?: unknown }).description != null && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {String((selectedBgContent.data.feature as { description?: unknown }).description)}
                      </p>
                    )}
                  </div>
                )}

                {/* Enriched background data */}
                <div className="text-sm space-y-0.5">
                  {Array.isArray(selectedBgContent.data.skills) &&
                    (selectedBgContent.data.skills as string[]).length > 0 && (
                    <div>
                      <span className="font-medium">Skills: </span>
                      <span>
                        {(selectedBgContent.data.skills as string[])
                          .map((s) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
                          .join(", ")}
                      </span>
                    </div>
                  )}
                  {selectedBgContent.data.gold != null && (
                    <div>
                      <span className="font-medium">Starting Gold: </span>
                      <span>{String(selectedBgContent.data.gold)} gp</span>
                    </div>
                  )}
                  {Array.isArray(selectedBgContent.data.toolProfs) &&
                    (selectedBgContent.data.toolProfs as string[]).length > 0 && (
                    <div>
                      <span className="font-medium">Tools: </span>
                      <span>
                        {(selectedBgContent.data.toolProfs as string[])
                          .map((t) => t.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
                          .join(", ")}
                      </span>
                    </div>
                  )}
                </div>

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

                {bgChoices.map((choice) => {
                  const options = resolveChoiceOptions(choice, availableLanguages, fixedLanguages([
                    ...contentRefs.filter(ref => ref.content_definitions.content_type !== "background").map(ref => ref.content_definitions),
                    ...(selectedBgContent ? [selectedBgContent] : []),
                  ]));
                  const resolvedChoice = options ? { ...choice, from: [...options] } : choice;

                  return (
                    <ChoiceSelector
                      key={choice.choice_id}
                      choiceEffect={resolvedChoice}
                      currentSelections={
                        localChoices.resolved_choices?.[choice.choice_id] ?? []
                      }
                      onSelect={(selections) =>
                        handleChoiceSelect(choice.choice_id, selections)
                      }
                    />
                  );
                })}
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
          <div className="space-y-4">
            {hasBackground && selectedBgContent && isChangingBackground && (
              <Card>
                <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      Current background: {selectedBgContent.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      It stays saved until you confirm a replacement.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleKeepCurrentBackground}
                  >
                    Keep Current Background
                  </Button>
                </CardContent>
              </Card>
            )}
            <ContentBrowser
              entries={backgrounds}
              contentTypeLabel="Background"
              onSelect={setPreviewContent}
            />
          </div>
        )}

        <ContentPreview
          content={conflictingPins ? null : previewContent}
          contentTypeLabel="Background"
          onConfirm={handleSelectBackground}
          onCancel={() => setPreviewContent(null)}
        />

        {selectionError && (
          <p role="alert" className="text-sm text-destructive">
            {selectionError}
          </p>
        )}

        <p className="sr-only" aria-live="polite">
          {isSavingBackground ? "Saving background." : ""}
        </p>

        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => navigateTo("abilities")}
          >
            Previous: Abilities
          </Button>
          <Button
            className="bg-character-fg text-background hover:opacity-90"
            onClick={() => navigateTo("equipment")}
          >
            Next: Equipment
          </Button>
        </div>
      </fieldset>

      {schema && (
        <div className="hidden lg:block">
          <StatPreview
            state={character.state}
            draft={isSavingBackground || hasDrafts || !!selectionError || missingSnapshot || conflictingPins || JSON.stringify(localChoices) !== JSON.stringify(character.choices) ||
              (!!selectedOverride && (!pinnedBackground || selectedOverride.id !== pinnedBackground.id || selectedOverride.version !== pinnedBackground.version || JSON.stringify(selectedOverride.data) !== JSON.stringify(pinnedBackground.data) || JSON.stringify(selectedOverride.effects) !== JSON.stringify(pinnedBackground.effects)))}
            baseStats={character.base_stats ?? {}}
            effects={allEffects}
            schema={schema}
            level={character.level}
            sources={buildCharacterStructuredSources(contentRefs, character.level, { character: { ...character, system_id: character.system_id ?? "" }, evidence: asiEvidence })}
          />
        </div>
      )}
    </div>
  );
}
