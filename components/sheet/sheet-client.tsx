"use client";

import type { CharacterWithSystem, CharacterState } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { EvaluationResult } from "@/lib/engine/evaluator";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";

interface SheetClientProps {
  character: CharacterWithSystem;
  schema: SystemSchemaDefinition;
  evalResult: EvaluationResult;
  contentRefs: ContentRefWithContent[];
  initialState: CharacterState;
  maxHp: number;
}

export function SheetClient({
  character,
  schema,
  evalResult,
  contentRefs,
  initialState,
  maxHp,
}: SheetClientProps) {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-accent">{character.name}</h1>
        <p className="text-sm text-muted-foreground">
          Level {character.level} &mdash; {character.game_systems.name}
        </p>
      </div>

      {/* Ability Scores */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Ability Scores
        </h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {schema.ability_scores.map((ability) => {
            const score = evalResult.stats[ability.slug] ?? 10;
            const mod = Math.floor((score - 10) / 2);
            return (
              <div
                key={ability.slug}
                className="rounded-lg border border-border bg-card p-3 text-center"
              >
                <p className="text-[10px] font-medium text-muted-foreground uppercase">
                  {ability.abbr}
                </p>
                <p className="text-2xl font-bold">
                  {mod >= 0 ? `+${mod}` : `${mod}`}
                </p>
                <p className="text-sm text-muted-foreground">{score}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Derived Stats */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Derived Stats
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {schema.derived_stats.map((stat) => {
            const value = evalResult.computed[stat.slug];
            if (value === undefined) return null;
            return (
              <div
                key={stat.slug}
                className="rounded-lg border border-border bg-card p-3 text-center"
              >
                <p className="text-[10px] font-medium text-muted-foreground uppercase">
                  {stat.name}
                </p>
                <p className="text-xl font-bold text-accent">{value}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* HP */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Hit Points
        </h2>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-3xl font-bold">
            {initialState.current_hp}{" "}
            <span className="text-lg text-muted-foreground">/ {maxHp}</span>
          </p>
          {(initialState.temp_hp ?? 0) > 0 && (
            <p className="text-sm text-muted-foreground">
              Temp: {initialState.temp_hp}
            </p>
          )}
        </div>
      </section>

      {/* Content Refs Summary */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Content ({contentRefs.length} items)
        </h2>
        <ul className="space-y-1">
          {contentRefs.map((ref) => (
            <li key={ref.id} className="text-sm text-muted-foreground">
              {ref.content_definitions.name} ({ref.content_definitions.content_type})
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
