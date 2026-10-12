"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { discardAbilityScoreDraft, useAbilityScoreDraft } from "@/lib/builder/use-ability-score-draft";
import type { AbilityMethod } from "@/lib/supabase/ability-scores-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { StatPreview } from "@/components/builder/stat-preview";
import { RaceAbilityNotice } from "@/components/builder/race-ability-notice";
import { buildCharacterStructuredSources } from "@/lib/character/structured-sources";
import { evaluate } from "@/lib/engine/evaluator";
import { abilityScoreArraySchema } from "@/lib/schemas/content-types/mechanical";
import { RACE_ABILITY_SLUGS } from "@/lib/engine/race-ability-scores";
import type { CharacterChoices } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { Effect } from "@/lib/types/effects";
import { STANDARD_ARRAY, POINT_BUY_BUDGET, POINT_BUY_COSTS } from "@/lib/builder/ability-score-validation";
import { useSaveNavigationGuard } from "@/lib/builder/use-save-navigation-guard";

interface AbilitiesStepClientProps {
  ownerId: string;
  characterId: string;
  character: {
    id: string;
    level: number;
    base_stats: Record<string, number>;
    choices: CharacterChoices;
    state?: Record<string, unknown>;
  };
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

export function AbilitiesStepClient(props: AbilitiesStepClientProps) {
  return <AbilitiesEditor key={`${props.ownerId}:${props.characterId}`} {...props} />;
}

function AbilitiesEditor({
  ownerId,
  characterId,
  character,
  contentRefs,
  schema,
}: AbilitiesStepClientProps) {
  const router = useRouter();
  const abilities = useMemo(
    () => schema?.ability_scores ?? [],
    [schema?.ability_scores],
  );

  function defaultScores(method: AbilityMethod): Record<string, number> {
    return method === "standard_array" ? {} : Object.fromEntries(
      abilities.map((ability) => [ability.slug, method === "point_buy" ? 8 : 10]),
    );
  }

  const initialMethod = character.choices?.ability_method ?? "standard_array";
  const persistedScores = character.base_stats ?? {};
  const { draft, status, changeDraft, retry } = useAbilityScoreDraft(
    ownerId,
    characterId,
    {
      method: initialMethod,
      scores: character.choices?.ability_method && Object.keys(persistedScores).length
        ? persistedScores : defaultScores(initialMethod),
    },
    { method: character.choices?.ability_method ?? null, scores: persistedScores },
  );
  const { method, scores } = draft;
  const arrayAssignments = scores;
  const cannotNavigate = status !== "saved";
  const hasConflict = status === "conflict" || status === "session_changed";
  const navigationGuard = useSaveNavigationGuard();
  const { setBlocked } = navigationGuard;
  useEffect(() => {
    // Cleared account data needs reload, but must not retain an unload warning.
    setBlocked(cannotNavigate && status !== "session_changed");
  }, [cannotNavigate, status, setBlocked]);

  const allEffects: Effect[] = contentRefs.flatMap(
    (ref) => ref.content_definitions?.effects ?? [],
  );

  const structuredSources = buildCharacterStructuredSources(contentRefs, character.level);
  const evaluated = schema ? evaluate({ ...scores, level: character.level }, allEffects, schema, structuredSources, character.state) : null;

  // Preserve the existing saved ASI display contribution separately. It is not
  // synthesized into live effects by this race repair (R06.3 remains open).
  interface BonusEntry { source: string; value: number }
  const asiBonuses = useMemo(() => {
    const bonuses: Record<string, BonusEntry[]> = {};
    // From ASI choices
    const asiChoices = character.choices?.asi_choices ?? {};
    for (const asiChoice of Object.values(asiChoices)) {
      if (asiChoice?.mode === "asi") {
        for (const alloc of asiChoice.allocations) {
          if (alloc.amount !== 0) {
            const slug = alloc.ability;
            if (!bonuses[slug]) bonuses[slug] = [];
            bonuses[slug].push({ source: "Saved Ability Score Improvement", value: alloc.amount });
          }
        }
      }
    }

    return bonuses;
  }, [character.choices?.asi_choices]);

  // Preserve the former displayed contribution only for unambiguous supplied
  // subrace scores-only extensions; canonical parsing/live source expansion is
  // a separate gate. Never remove an effect to infer this compatibility case.
  const subraceBonuses: Record<string, BonusEntry[]> = {};
  const dualSubraceNames: string[] = [];
  for (const ref of contentRefs) {
    const definition = ref.content_definitions;
    if (definition.content_type !== "subrace") continue;
    const stored = abilityScoreArraySchema.safeParse(definition.data.scores);
    if (!stored.success) continue;
    if (definition.effects.some(effect => effect.type === "mechanical" && RACE_ABILITY_SLUGS.some(slug => slug === effect.stat))) {
      dualSubraceNames.push(definition.name);
      continue;
    }
    stored.data.forEach((value, index) => {
      if (value !== 0) (subraceBonuses[RACE_ABILITY_SLUGS[index]] ??= []).push({ source: `Saved subrace bonus: ${definition.name}`, value });
    });
  }

  // Point buy points remaining
  const pointsUsed = useMemo(() => {
    if (method !== "point_buy") return 0;
    return Object.values(scores).reduce(
      (sum, score) => sum + (POINT_BUY_COSTS[score] ?? 0),
      0,
    );
  }, [scores, method]);

  const currentScores = scores;

  function handleMethodChange(newMethod: AbilityMethod) {
    changeDraft((previous) => previous.method === newMethod ? previous : {
      method: newMethod, scores: defaultScores(newMethod),
    });
  }

  function handleStandardArrayAssign(abilitySlug: string, value: string) {
    const numValue = value === "" ? null : Number(value);
    if (numValue !== null && !STANDARD_ARRAY.includes(numValue)) return;
    changeDraft((previous) => {
      const newAssignments = { ...previous.scores };
      for (const key of Object.keys(newAssignments)) {
        if (newAssignments[key] === numValue && key !== abilitySlug) delete newAssignments[key];
      }
      if (numValue === null) delete newAssignments[abilitySlug];
      else newAssignments[abilitySlug] = numValue;
      return { ...previous, scores: newAssignments };
    });
  }

  function handlePointBuyChange(abilitySlug: string, delta: number) {
    changeDraft((previous) => {
      const next = (previous.scores[abilitySlug] ?? 8) + delta;
      if (next < 8 || next > 15) return previous;
      const newScores = { ...previous.scores, [abilitySlug]: next };
      const newPointsUsed = Object.values(newScores).reduce(
        (sum, score) => sum + (POINT_BUY_COSTS[score] ?? 0), 0,
      );
      return newPointsUsed > POINT_BUY_BUDGET ? previous : { ...previous, scores: newScores };
    });
  }

  function handleManualChange(abilitySlug: string, value: string) {
    const numValue = Number(value);
    if (!Number.isInteger(numValue) || numValue < 1 || numValue > 30) return;
    changeDraft((previous) => ({ ...previous, scores: { ...previous.scores, [abilitySlug]: numValue } }));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Ability Scores</h2>
        <RaceAbilityNotice contentRefs={contentRefs} />
        <p className="text-sm text-muted-foreground">Totals include race and content effects; conditions follow the saved character state.
          Content considered: {contentRefs.map(ref => ref.content_definitions.name).join(", ") || "none"}.</p>
        {Object.keys(asiBonuses).length > 0 && <p role="status" className="text-sm text-muted-foreground">
          Saved Ability Score Improvement choices are added to these totals separately. The Stats preview and live sheet
          currently omit that addition.
        </p>}
        {Object.keys(subraceBonuses).length > 0 && <p role="status" className="text-sm text-muted-foreground">
          Saved subrace score bonuses remain a separate builder contribution. The Stats preview and live sheet omit
          those score-only bonuses; subrace calculation parity remains unresolved.
        </p>}
        {dualSubraceNames.length > 0 && <p role="status" className="text-sm text-muted-foreground">
          Subrace score data and ability effects overlap for {dualSubraceNames.join(", ")}. Evaluated content includes the effects;
          the former score-preferred display differs. Resolving that subrace representation remains separate from race totals.
        </p>}
        {navigationGuard.notice && <p role="alert" className="text-sm text-destructive">{hasConflict
          ? "Reload the saved ability scores before editing again. This draft has not been saved."
          : navigationGuard.notice}</p>}

        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {status === "saving" ? "Saving ability scores… Stay on this step until saving finishes." : status === "saved" ? "Changes save automatically." : "Ability scores have not been saved. Stay on this step to resolve the save."}
        </p>
        {status === "error" && (
          <div role="alert" className="space-y-2 text-sm text-destructive">
            <p>Could not save ability scores. Your changes are still here. Retry before continuing.</p>
            <Button variant="outline" size="sm" onClick={retry}>Retry save</Button>
          </div>
        )}
        {hasConflict && (
          <div role="alert" className="space-y-2 text-sm text-destructive">
            <p>{status === "session_changed"
              ? "Your sign-in session changed. Reload before editing ability scores."
              : "Ability scores changed in another editor. Reload the saved scores before editing again."}</p>
            <Button variant="outline" size="sm" onClick={() => {
              discardAbilityScoreDraft(ownerId, characterId);
              window.location.reload();
            }}>Reload saved scores</Button>
          </div>
        )}

        {/* Method selector */}
        <div className="space-y-2">
          <Label>Method</Label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { value: "standard_array", label: "Standard Array" },
                { value: "point_buy", label: "Point Buy" },
                { value: "manual", label: "Manual Entry" },
              ] as const
            ).map(({ value, label }) => (
              <Button
                key={value}
                variant={method === value ? "default" : "outline"}
                size="sm"
                disabled={hasConflict}
                aria-pressed={method === value}
                onClick={() => handleMethodChange(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {method === "point_buy" && (
          <p className="text-sm text-muted-foreground">
            Points remaining:{" "}
            <span className="font-bold">
              {POINT_BUY_BUDGET - pointsUsed} / {POINT_BUY_BUDGET}
            </span>
          </p>
        )}

        {method === "standard_array" && (
          <p className="text-sm text-muted-foreground">
            Assign these values: {STANDARD_ARRAY.join(", ")}
          </p>
        )}

        {/* Ability score grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {abilities.map((ability) => {
            const base = currentScores[ability.slug] ?? 0;
            const contentTotal = evaluated?.stats[ability.slug] ?? base;
            const displayContributions = [...(asiBonuses[ability.slug] ?? []), ...(subraceBonuses[ability.slug] ?? [])];
            const total = contentTotal + displayContributions.reduce((sum, entry) => sum + entry.value, 0);
            const mod = Math.floor((total - 10) / 2);

            return (
              <Card key={ability.slug}>
                <CardContent className="p-4 text-center space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    {ability.name}
                  </p>

                  {method === "standard_array" && (
                    <select
                      aria-label={`${ability.name} score`}
                      disabled={hasConflict}
                      value={arrayAssignments[ability.slug] ?? ""}
                      onChange={(e) =>
                        handleStandardArrayAssign(ability.slug, e.target.value)
                      }
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-center text-lg font-bold"
                    >
                      <option value="">--</option>
                      {STANDARD_ARRAY.map((val) => {
                        const assignedTo = Object.entries(
                          arrayAssignments,
                        ).find(
                          ([, v]) => v === val,
                        )?.[0];
                        const isAvailable =
                          !assignedTo || assignedTo === ability.slug;
                        return (
                          <option
                            key={val}
                            value={val}
                            disabled={!isAvailable}
                          >
                            {val}
                          </option>
                        );
                      })}
                    </select>
                  )}

                  {method === "point_buy" && (
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handlePointBuyChange(ability.slug, -1)
                        }
                        disabled={
                          hasConflict || (scores[ability.slug] ?? 8) <= 8
                        }
                        aria-label={`Decrease ${ability.name}`}
                        className="h-8 w-8 p-0"
                      >
                        -
                      </Button>
                      <span className="text-2xl font-bold w-10 text-center">
                        {scores[ability.slug] ?? 8}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handlePointBuyChange(ability.slug, 1)
                        }
                        disabled={
                          hasConflict || (scores[ability.slug] ?? 8) >= 15
                        }
                        aria-label={`Increase ${ability.name}`}
                        className="h-8 w-8 p-0"
                      >
                        +
                      </Button>
                    </div>
                  )}

                  {method === "manual" && (
                    <Input
                      type="number"
                      aria-label={`${ability.name} score`}
                      disabled={hasConflict}
                      min={1}
                      max={30}
                      value={scores[ability.slug] ?? 10}
                      onChange={(e) =>
                        handleManualChange(ability.slug, e.target.value)
                      }
                      className="text-center text-lg font-bold"
                    />
                  )}

                  <Separator />

                  {/* Score breakdown */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Base Score</span>
                      <span className="font-medium">{base || "--"}</span>
                    </div>
                    <div className="flex justify-between"><span>Evaluated content total</span><span>{contentTotal}</span></div>
                    {displayContributions.map((entry, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-muted-foreground">{entry.source}</span>
                        <span className="font-medium text-accent">
                          {entry.value > 0 ? "+" : ""}{entry.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
                    <p className="text-2xl font-bold">{total || "--"}</p>
                    <p className="text-sm text-muted-foreground">
                      Modifier: {total
                        ? `${mod >= 0 ? "+" : ""}${mod}`
                        : "--"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            disabled={cannotNavigate}
            onClick={() =>
              router.push(`/characters/${characterId}/builder/class`)
            }
          >
            Previous: Class
          </Button>
          <Button
            className="bg-character-fg text-background hover:opacity-90"
            disabled={cannotNavigate}
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
            baseStats={currentScores}
            effects={allEffects}
            schema={schema}
            level={character.level}
            sources={structuredSources}
            state={character.state}
          />
        </div>
      )}
    </div>
  );
}
