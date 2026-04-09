"use client";

import { useMemo } from "react";
import { evaluate } from "@/lib/engine/evaluator";
import { Separator } from "@/components/ui/separator";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { Effect } from "@/lib/types/effects";

interface StatPreviewProps {
  baseStats: Record<string, number>;
  effects: Effect[];
  schema: SystemSchemaDefinition;
  level: number;
}

export function StatPreview({
  baseStats,
  effects,
  schema,
  level,
}: StatPreviewProps) {
  const result = useMemo(() => {
    const statsWithLevel = { ...baseStats, level };
    return evaluate(statsWithLevel, effects, schema);
  }, [baseStats, effects, schema, level]);

  const hasStats = Object.keys(baseStats).length > 0;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold">Stats</h3>

      {hasStats ? (
        <>
          {/* Ability Scores */}
          <div className="grid grid-cols-3 gap-2">
            {schema.ability_scores.map((ability) => {
              const score = result.stats[ability.slug] ?? baseStats[ability.slug] ?? 10;
              const mod = Math.floor((score - 10) / 2);

              return (
                <div
                  key={ability.slug}
                  className="text-center rounded-md border bg-background p-2"
                >
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">
                    {ability.abbr}
                  </p>
                  <p className="text-lg font-bold">{score}</p>
                  <p className="text-xs text-muted-foreground">
                    {mod >= 0 ? "+" : ""}
                    {mod}
                  </p>
                </div>
              );
            })}
          </div>

          <Separator />

          {/* Derived Stats */}
          <div className="space-y-1">
            {schema.derived_stats.map((stat) => {
              const value = result.computed[stat.slug];
              if (value === undefined) return null;

              return (
                <div
                  key={stat.slug}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">{stat.name}</span>
                  <span className="font-medium">{value}</span>
                </div>
              );
            })}
          </div>

          {/* Grants */}
          {result.grants.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Proficiencies
                </p>
                <div className="flex flex-wrap gap-1">
                  {result.grants.map((g, i) => (
                    <span
                      key={i}
                      className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded"
                    >
                      {g.stat}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          Assign ability scores to see computed stats.
        </p>
      )}
    </div>
  );
}
