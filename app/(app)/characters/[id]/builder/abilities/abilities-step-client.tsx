"use client";

import { useMemo } from "react";
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
import type { CharacterChoices } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { Effect } from "@/lib/types/effects";

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const POINT_BUY_BUDGET = 27;
const POINT_BUY_COSTS: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9,
};

interface AbilitiesStepClientProps {
  ownerId: string;
  characterId: string;
  character: {
    id: string;
    level: number;
    base_stats: Record<string, number>;
    choices: CharacterChoices;
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

  const allEffects: Effect[] = contentRefs.flatMap(
    (ref) => ref.content_definitions?.effects ?? [],
  );

  // Compute per-ability bonuses with source attribution
  interface BonusEntry { source: string; value: number }
  const abilityBonuses = useMemo(() => {
    const bonuses: Record<string, BonusEntry[]> = {};

    // From content refs (race, subrace, class features, etc.)
    for (const ref of contentRefs) {
      const contentType = ref.content_definitions?.content_type;
      const contentName = ref.content_definitions?.name;
      const label =
        contentType === "race" || contentType === "subrace"
          ? contentName ?? "Race"
          : contentType === "class"
            ? contentName ?? "Class"
            : contentName ?? "Feature";

      // Prefer enriched scores array for races/subraces (avoids double-counting with mechanical effects)
      const scoresArr = ref.content_definitions?.data?.scores as number[] | undefined;
      const hasEnrichedScores = Array.isArray(scoresArr) && scoresArr.length === 6 &&
        (contentType === "race" || contentType === "subrace");

      if (hasEnrichedScores) {
        const slugs = abilities.map((a) => a.slug);
        for (let i = 0; i < Math.min(scoresArr!.length, slugs.length); i++) {
          if (scoresArr![i] !== 0) {
            const slug = slugs[i];
            if (!bonuses[slug]) bonuses[slug] = [];
            bonuses[slug].push({ source: label, value: scoresArr![i] });
          }
        }
      } else {
        // Fall back to mechanical effects for non-race content or races without enriched scores
        for (const effect of ref.content_definitions?.effects ?? []) {
          if (
            effect.type === "mechanical" &&
            effect.op === "add" &&
            abilities.some((a) => a.slug === effect.stat)
          ) {
            const val = typeof effect.value === "number" ? effect.value : 0;
            if (val !== 0) {
              if (!bonuses[effect.stat]) bonuses[effect.stat] = [];
              bonuses[effect.stat].push({ source: label, value: val });
            }
          }
        }
      }
    }

    // From ASI choices
    const asiChoices = character.choices?.asi_choices ?? {};
    for (const asiChoice of Object.values(asiChoices)) {
      if (asiChoice?.mode === "asi") {
        for (const alloc of asiChoice.allocations) {
          if (alloc.amount !== 0) {
            const slug = alloc.ability;
            if (!bonuses[slug]) bonuses[slug] = [];
            bonuses[slug].push({ source: "Ability Score Improvement", value: alloc.amount });
          }
        }
      }
    }

    return bonuses;
  }, [contentRefs, abilities, character.choices?.asi_choices]);

  // Total racial/other bonuses per ability (for score calculation)
  const racialBonuses = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const [slug, entries] of Object.entries(abilityBonuses)) {
      totals[slug] = entries.reduce((sum, e) => sum + e.value, 0);
    }
    return totals;
  }, [abilityBonuses]);

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
            const bonus = racialBonuses[ability.slug] ?? 0;
            const total = base + bonus;
            const mod = Math.floor((total - 10) / 2);

            return (
              <Card key={ability.slug}>
                <CardContent className="p-4 text-center space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    {ability.name}
                  </p>

                  {method === "standard_array" && (
                    <select
                      aria-label={`${ability.name} standard-array score`}
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
                    {(abilityBonuses[ability.slug] ?? []).map((entry, i) => (
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
          />
        </div>
      )}
    </div>
  );
}
