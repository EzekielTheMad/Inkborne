"use client";

import { useMemo } from "react";
import { evaluate, type StructuredSources } from "@/lib/engine/evaluator";
import { Separator } from "@/components/ui/separator";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { Effect } from "@/lib/types/effects";
import { getConfirmedAbilityModifier, resolveAbilityMechanics } from "@/lib/character/ability-mechanics";
import { computeMaxHp } from "@/lib/character/max-hp";
import type { SubclassHitPointBonus } from "@/lib/character/subclass-hit-points";
import { resolveCastingMath } from "@/lib/spells/casting-math";
import type { CharacterChoices, HpRule } from "@/lib/types/character";
import type { EffectiveCastingSource } from "@/lib/spells/effective-sources";

export interface StatPreviewClassContext {
  available: boolean;
  choices: CharacterChoices;
  classContent: Record<string, { id: string; version: number; slug: string; name?: string; data: Record<string, unknown> }>;
  hpRule: HpRule;
  originalOccurrenceId?: string | null;
  subclassHitPoints?: SubclassHitPointBonus;
  castingSources: EffectiveCastingSource[];
}

interface StatPreviewProps {
  draft?: boolean;
  baseStats: Record<string, number>;
  effects: Effect[];
  schema: SystemSchemaDefinition;
  level: number;
  sources?: StructuredSources;
  state?: Record<string, unknown>;
  classContext?: StatPreviewClassContext;
}

export function StatPreview({
  draft = false,
  baseStats,
  effects,
  schema,
  level,
  sources,
  state,
  classContext,
}: StatPreviewProps) {
  const result = useMemo(() => {
    const statsWithLevel = { ...baseStats, level };
    return evaluate(statsWithLevel, effects, schema, sources, state);
  }, [baseStats, effects, schema, level, sources, state]);

  const hasStats = Object.keys(baseStats).length > 0;
  const mechanics = resolveAbilityMechanics(baseStats, result, schema);
  const classes = classContext?.choices.classes ?? [];
  const classContextReady = !!classContext?.available && mechanics.status === "available"
    && classes.length > 0 && new Set(classes.map(cls => cls.slug)).size === classes.length
    && classes.every(cls => Number.isInteger(cls.level) && cls.level >= 1 && cls.level <= 20
      && classContext.classContent[cls.slug]?.slug === cls.slug
      && [4, 6, 8, 10, 12].includes(Number(classContext.classContent[cls.slug].data.hit_die)))
    && classes.reduce((sum, cls) => sum + cls.level, 0) === level;
  const originalReady = classContext?.originalOccurrenceId === undefined
    ? !classes.some(cls => cls.occurrence_id)
    : classes.filter(cls => cls.occurrence_id === classContext.originalOccurrenceId).length === 1;
  const subclassHitPoints: SubclassHitPointBonus = classContext?.subclassHitPoints ?? { status: "available", bonus: 0 };
  const maxHp = classContextReady && originalReady && subclassHitPoints.status === "available" && Number.isFinite(result.stats.constitution)
    ? computeMaxHp(classes, classContext!.classContent, result.stats.constitution, classContext!.choices.hp_rolls,
      classContext!.hpRule, classContext!.originalOccurrenceId, subclassHitPoints.bonus) : null;
  const casting = (classContext?.castingSources ?? []).filter(source => source.active && source.config).map(source => {
    const definition = classContext?.classContent[source.classSlug];
    const exact = classContextReady && definition?.id === source.parentPin.contentId && definition.version === source.parentPin.version
      && classes.some(cls => cls.slug === source.classSlug && cls.level === source.classLevel);
    const normal = source.config && exact ? resolveCastingMath(source.config.ability, schema.ability_scores, result.stats,
      result.computed.proficiency_bonus) : null;
    const modifier = source.config ? getConfirmedAbilityModifier(result, schema, source.config.ability) : null;
    const attack = normal?.status === "available" && modifier !== null ? result.computed.proficiency_bonus + modifier : null;
    return { source, name: definition?.name ?? source.classSlug, attack: attack !== null && Number.isFinite(attack) ? attack : null };
  });

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold">Stats</h3>
      {draft ? <p role="status" className="text-xs">Draft preview only; these values do not authorize actions or prerequisites.</p>
        : mechanics.status !== "available" ? <p role="status" className="text-xs">{mechanics.reason} Content preview is read-only.</p>
        : mechanics.capUnverified ? <p role="status" className="text-xs">Saved ASI contributions retained; historical cap eligibility is unverified.</p> : null}

      {hasStats ? (
        <>
          {/* Ability Scores */}
          <div className="grid grid-cols-3 gap-2">
            {schema.ability_scores.map((ability) => {
              const score = result.stats[ability.slug];
              const mod = Math.floor((score - 10) / 2);

              return (
                <div
                  key={ability.slug}
                  className="text-center rounded-md border bg-background p-2"
                >
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">
                    {ability.abbr}
                  </p>
                  <p className="text-lg font-bold">{Number.isFinite(score) ? score : "Unavailable"}</p>
                  <p className="text-xs text-muted-foreground">
                    {Number.isFinite(mod) ? `${mod >= 0 ? "+" : ""}${mod}` : "--"}
                  </p>
                </div>
              );
            })}
          </div>

          <Separator />

          {/* Derived Stats */}
          <div className="space-y-1">
            {schema.derived_stats.map((stat) => {
              // The generic schema has no class die total or casting ability.
              // Class-dependent values require the pinned build context below.
              if (["spell_save_dc", "spell_attack_bonus"].includes(stat.slug)) return null;
              const value = stat.slug === "hit_points_max" ? maxHp ?? "Unavailable" : result.computed[stat.slug];
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
            {casting.map(({ source, name, attack }) => <div key={source.classSlug} role="group" aria-label={`${name} spellcasting`}
              className="space-y-1 border-t pt-2 mt-2">
              <p className="text-xs font-medium">{name}</p>
              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Spell Save DC</span>
                <span className="font-medium">{attack === null ? "Unavailable" : 8 + attack}</span></div>
              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Spell Attack Bonus</span>
                <span className="font-medium">{attack === null ? "Unavailable" : `${attack >= 0 ? "+" : ""}${attack}`}</span></div>
            </div>)}
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
