import { parseDiceExpression } from "@/lib/dice/parser";
import type { RollKind } from "@/lib/dice/types";
import { evaluate, type EvaluationResult } from "@/lib/engine/evaluator";
import type { FeatData } from "@/lib/schemas/content-types/feat";
import type { SpellData } from "@/lib/schemas/content-types/spell";
import {
  computeCastEffects,
  type CastChoice,
  type CastSpellSource,
} from "@/lib/spells/casting";
import type { CharacterState } from "@/lib/types/character";
import type { Effect } from "@/lib/types/effects";
import type { CasterInfo } from "@/lib/types/spells";
import type { SystemSchemaDefinition } from "@/lib/types/system";

export const MPMB_PREVIEW_LEVELS = [1, 5, 11, 17] as const;

const FIXED_PREVIEW_TIME = new Date("2026-01-01T00:00:00.000Z");

export type MpmbPreviewCandidate =
  | {
      id: string;
      contentType: "feat";
      name: string;
      slug: string;
      data: FeatData;
      effects: Effect[];
    }
  | {
      id: string;
      contentType: "spell";
      name: string;
      slug: string;
      data: SpellData;
      effects: Effect[];
    };

export interface MpmbPreviewNumericChange {
  slug: string;
  label: string;
  before: number;
  after: number;
  delta: number;
}

export interface MpmbPreviewFeatLevel {
  level: number;
  abilities: MpmbPreviewNumericChange[];
  derivedStats: MpmbPreviewNumericChange[];
  speed: MpmbPreviewNumericChange[];
  visionAdded: Array<{ type: string; range: number }>;
  damageResistancesAdded: string[];
  saveAdvantagesAdded: string[];
  saveImmunitiesAdded: string[];
}

export interface MpmbPreviewSpellCast {
  label: string;
  characterLevel: number;
  castLevel: number;
  rolls: Array<{
    kind: RollKind;
    label: string;
    expression: string;
  }>;
  dc: { ability: string; value: number; success: "half" | "none" | "other" } | null;
  persistentEffect: boolean;
}

export type MpmbPreviewItem =
  | {
      id: string;
      contentType: "feat";
      name: string;
      status: "passed";
      levels: MpmbPreviewFeatLevel[];
      narratives: Array<{ text: string; tag?: string }>;
      grants: Array<{ stat: string; value: string }>;
      warnings: string[];
    }
  | {
      id: string;
      contentType: "spell";
      name: string;
      status: "passed";
      castingTime: string;
      range: string;
      components: string[];
      concentration: boolean;
      ritual: boolean;
      casts: MpmbPreviewSpellCast[];
      warnings: string[];
    }
  | {
      id: string;
      contentType: "feat" | "spell";
      name: string;
      status: "failed";
      message: string;
    };

export interface MpmbCalculationPreview {
  passed: boolean;
  assumptions: {
    levels: number[];
    abilityScore: number;
    castingAbilityScore: number;
    spellSaveDc: number;
    spellAttackBonus: number;
    equipment: string;
  };
  items: MpmbPreviewItem[];
}

function neutralStats(
  schema: SystemSchemaDefinition,
  level: number,
): Record<string, number> {
  return {
    ...Object.fromEntries(schema.ability_scores.map((ability) => [ability.slug, 10])),
    level,
  };
}

function assertFiniteResult(result: EvaluationResult): void {
  for (const [slug, value] of [
    ...Object.entries(result.stats),
    ...Object.entries(result.computed),
  ]) {
    if (!Number.isFinite(value)) {
      throw new Error(`The calculation for ${slug} did not produce a finite number.`);
    }
  }
}

function numericChanges(
  slugs: Array<{ slug: string; name: string }>,
  before: Record<string, number>,
  after: Record<string, number>,
): MpmbPreviewNumericChange[] {
  return slugs.flatMap((definition) => {
    const beforeValue = before[definition.slug];
    const afterValue = after[definition.slug];
    if (
      !Number.isFinite(beforeValue)
      || !Number.isFinite(afterValue)
      || Object.is(beforeValue, afterValue)
    ) {
      return [];
    }
    return [{
      slug: definition.slug,
      label: definition.name,
      before: beforeValue,
      after: afterValue,
      delta: afterValue - beforeValue,
    }];
  });
}

function speedChanges(
  before: EvaluationResult["speed"],
  after: EvaluationResult["speed"],
): MpmbPreviewNumericChange[] {
  const movementTypes = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...movementTypes].flatMap((slug) => {
    const beforeValue = before[slug as keyof typeof before] ?? 0;
    const afterValue = after[slug as keyof typeof after] ?? 0;
    if (beforeValue === afterValue) return [];
    return [{
      slug,
      label: `${slug.replaceAll("_", " ")} speed`,
      before: beforeValue,
      after: afterValue,
      delta: afterValue - beforeValue,
    }];
  });
}

function addedStrings(before: string[], after: string[]): string[] {
  const existing = new Set(before.map((value) => value.toLocaleLowerCase()));
  return after.filter((value) => !existing.has(value.toLocaleLowerCase()));
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value == null || value === false || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function featWarnings(data: FeatData): string[] {
  const manualFields: Array<[keyof FeatData, string]> = [
    ["scoresMaximum", "custom ability-score maximums"],
    ["skills", "skill proficiencies"],
    ["weaponProfs", "weapon proficiencies"],
    ["armorProfs", "armor proficiencies"],
    ["toolProfs", "tool proficiencies"],
    ["languageProfs", "language proficiencies"],
    ["spellcastingBonus", "granted spells"],
    ["spellcastingAbility", "spellcasting ability changes"],
    ["extraLimitedFeatures", "additional limited-use resources"],
    ["calcChanges", "MPMB calculation-change notes"],
    ["addMod", "MPMB roll-modifier notes"],
  ];
  return manualFields.flatMap(([field, label]) =>
    hasMeaningfulValue(data[field])
      ? [`${label} are stored for reference but are not automated by the character sheet yet.`]
      : []
  );
}

function previewFeat(
  schema: SystemSchemaDefinition,
  candidate: Extract<MpmbPreviewCandidate, { contentType: "feat" }>,
): Extract<MpmbPreviewItem, { contentType: "feat"; status: "passed" }> {
  const evaluatedResults: EvaluationResult[] = [];
  const levels = MPMB_PREVIEW_LEVELS.map((level) => {
    const baseStats = neutralStats(schema, level);
    const baseline = evaluate(baseStats, [], schema, { level }, {
      equipped_armor: "none",
      shield_equipped: false,
      rage_active: false,
    });
    const calculated = evaluate(
      baseStats,
      candidate.effects,
      schema,
      { featureData: [candidate.data], level },
      {
        equipped_armor: "none",
        shield_equipped: false,
        rage_active: false,
      },
    );
    assertFiniteResult(baseline);
    assertFiniteResult(calculated);
    evaluatedResults.push(calculated);

    const baselineVision = new Set(
      baseline.vision.map((entry) => `${entry.type}:${entry.range}`),
    );
    return {
      level,
      abilities: numericChanges(
        schema.ability_scores,
        baseline.stats,
        calculated.stats,
      ),
      derivedStats: numericChanges(
        schema.derived_stats,
        baseline.computed,
        calculated.computed,
      ),
      speed: speedChanges(baseline.speed, calculated.speed),
      visionAdded: calculated.vision.filter(
        (entry) => !baselineVision.has(`${entry.type}:${entry.range}`),
      ),
      damageResistancesAdded: addedStrings(baseline.dmgres, calculated.dmgres),
      saveAdvantagesAdded: addedStrings(
        baseline.savetxt.adv_vs,
        calculated.savetxt.adv_vs,
      ),
      saveImmunitiesAdded: addedStrings(
        baseline.savetxt.immune,
        calculated.savetxt.immune,
      ),
    };
  });

  return {
    id: candidate.id,
    contentType: "feat",
    name: candidate.name,
    status: "passed",
    levels,
    narratives: (evaluatedResults[0]?.narratives ?? []).map(({ text, tag }) => ({
      text,
      ...(tag ? { tag } : {}),
    })),
    grants: (evaluatedResults[0]?.grants ?? []).map(({ stat, value }) => ({ stat, value })),
    warnings: featWarnings(candidate.data),
  };
}

function previewCasterInfo(level: number, castingAbility: string): CasterInfo {
  return {
    isCaster: true,
    classes: [{
      slug: "preview-caster",
      level,
      type: "full",
      ability: castingAbility,
      prepared: true,
      cantripsKnown: 4,
      spellsKnown: "all",
      maxPrepared: 20,
      ritualCasting: true,
    }],
    spellDc: 13,
    spellAttackBonus: 5,
  };
}

function previewSpell(
  schema: SystemSchemaDefinition,
  candidate: Extract<MpmbPreviewCandidate, { contentType: "spell" }>,
): Extract<MpmbPreviewItem, { contentType: "spell"; status: "passed" }> {
  const castingAbility = schema.ability_scores.some(
    (ability) => ability.slug === "intelligence",
  )
    ? "intelligence"
    : schema.ability_scores[0].slug;
  const abilityScores = neutralStats(schema, 1);
  abilityScores[castingAbility] = 16;
  const spell: CastSpellSource = {
    name: candidate.name,
    slug: candidate.slug,
    effects: candidate.effects,
    data: candidate.data,
  };
  const spellLevel = candidate.data.level;
  const castInputs: Array<{
    label: string;
    characterLevel: number;
    choice: CastChoice;
  }> = spellLevel === 0
    ? MPMB_PREVIEW_LEVELS.map((level) => ({
        label: `Character level ${level}`,
        characterLevel: level,
        choice: { type: "cantrip" as const },
      }))
    : Array.from({ length: 10 - spellLevel }, (_, index) => {
        const slotLevel = spellLevel + index;
        return {
          label: slotLevel === spellLevel
            ? `Base cast (level ${slotLevel})`
            : `Upcast at level ${slotLevel}`,
          characterLevel: Math.min(17, Math.max(1, slotLevel * 2 - 1)),
          choice: { type: "slot" as const, level: slotLevel },
        };
      });
  const state: CharacterState = {
    spell_slots_used: {},
    active_effects: [],
    concentrating_on: null,
  };

  const casts = castInputs.map(({ label, characterLevel, choice }) => {
    const outcome = computeCastEffects({
      spell,
      choice,
      state,
      casterInfo: previewCasterInfo(characterLevel, castingAbility),
      abilityScores,
      characterLevel,
      classSlug: "preview-caster",
      now: FIXED_PREVIEW_TIME,
      generateId: () => "mpmb-preview-effect",
    });
    for (const roll of outcome.rollRequests) {
      parseDiceExpression(roll.expression);
    }
    return {
      label,
      characterLevel,
      castLevel: outcome.castLevel,
      rolls: outcome.rollRequests.map(({ kind, label: rollLabel, expression }) => ({
        kind,
        label: rollLabel,
        expression,
      })),
      dc: outcome.dcInfo
        ? {
            ability: outcome.dcInfo.ability,
            value: outcome.dcInfo.dc,
            success: outcome.dcInfo.success,
          }
        : null,
      persistentEffect: outcome.activeEffect !== null,
    };
  });

  return {
    id: candidate.id,
    contentType: "spell",
    name: candidate.name,
    status: "passed",
    castingTime: candidate.data.casting_time,
    range: candidate.data.range,
    components: candidate.data.components,
    concentration: candidate.data.concentration,
    ritual: candidate.data.ritual,
    casts,
    warnings: casts.every(
      (cast) => cast.rolls.length === 0 && !cast.dc && !cast.persistentEffect,
    )
      ? ["This spell has no automated roll, save, or persistent sheet effect; its rules remain narrative."]
      : [],
  };
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error) || !error.message.trim()) {
    return "The calculation could not be evaluated safely.";
  }
  return error.message.trim().slice(0, 300);
}

export function buildMpmbCalculationPreview(
  schema: SystemSchemaDefinition,
  candidates: MpmbPreviewCandidate[],
): MpmbCalculationPreview {
  const items: MpmbPreviewItem[] = candidates.map((candidate) => {
    try {
      return candidate.contentType === "feat"
        ? previewFeat(schema, candidate)
        : previewSpell(schema, candidate);
    } catch (error) {
      return {
        id: candidate.id,
        contentType: candidate.contentType,
        name: candidate.name,
        status: "failed",
        message: errorMessage(error),
      };
    }
  });

  return {
    passed: items.length > 0 && items.every((item) => item.status === "passed"),
    assumptions: {
      levels: [...MPMB_PREVIEW_LEVELS],
      abilityScore: 10,
      castingAbilityScore: 16,
      spellSaveDc: 13,
      spellAttackBonus: 5,
      equipment: "No armor, shield, active effects, or other content",
    },
    items,
  };
}
