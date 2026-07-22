// @vitest-environment node

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { buildCharacterStructuredSources } from "@/lib/character/structured-sources";
import { evaluate } from "@/lib/engine/evaluator";
import { mapParsedMpmbSource } from "@/lib/import/mpmb/map";
import {
  buildMpmbCalculationPreview,
  type MpmbPreviewCandidate,
} from "@/lib/import/mpmb/preview";
import { parseMpmbSource } from "@/lib/import/mpmb/parser";
import type { SystemSchemaDefinition } from "@/lib/types/system";

const fixture = readFileSync(
  new URL("../../fixtures/mpmb/representative-parity.mpmb", import.meta.url),
  "utf8",
);

const SCHEMA: SystemSchemaDefinition = {
  ability_scores: [
    { slug: "strength", name: "Strength", abbr: "STR" },
    { slug: "dexterity", name: "Dexterity", abbr: "DEX" },
    { slug: "constitution", name: "Constitution", abbr: "CON" },
    { slug: "intelligence", name: "Intelligence", abbr: "INT" },
    { slug: "wisdom", name: "Wisdom", abbr: "WIS" },
    { slug: "charisma", name: "Charisma", abbr: "CHA" },
  ],
  proficiency_levels: [
    { slug: "none", name: "None", multiplier: 0 },
    { slug: "proficient", name: "Proficient", multiplier: 1 },
  ],
  derived_stats: [
    {
      slug: "proficiency_bonus",
      name: "Proficiency Bonus",
      formula: "floor((level - 1) / 4) + 2",
    },
    {
      slug: "armor_class",
      name: "Armor Class",
      formula: "10 + mod(dexterity)",
    },
    { slug: "initiative", name: "Initiative", formula: "mod(dexterity)" },
  ],
  skills: [],
  resources: [],
  content_types: [
    { slug: "feat", name: "Feat" },
    { slug: "spell", name: "Spell" },
  ],
  currencies: [],
  creation_steps: [{ step: 1, type: "details", label: "Details" }],
  sheet_sections: [{ slug: "header", label: "Header" }],
};

function mappedCandidates(): {
  feat: Extract<MpmbPreviewCandidate, { contentType: "feat" }>;
  spell: Extract<MpmbPreviewCandidate, { contentType: "spell" }>;
} {
  const mapped = mapParsedMpmbSource(parseMpmbSource(fixture));
  expect(mapped.summary).toEqual({
    valid: 2,
    needsInfo: 0,
    unsupported: 0,
    warnings: 0,
    blockingIssues: 0,
  });

  const featCandidate = mapped.items.find(
    (item) => item.candidate?.content_type === "feat",
  )?.candidate;
  const spellCandidate = mapped.items.find(
    (item) => item.candidate?.content_type === "spell",
  )?.candidate;
  if (featCandidate?.content_type !== "feat") {
    throw new Error("Representative fixture did not map its feat");
  }
  if (spellCandidate?.content_type !== "spell") {
    throw new Error("Representative fixture did not map its spell");
  }

  return {
    feat: {
      id: "representative-feat",
      contentType: "feat",
      name: featCandidate.name,
      slug: featCandidate.slug,
      data: featCandidate.data,
      effects: featCandidate.effects,
    },
    spell: {
      id: "representative-spell",
      contentType: "spell",
      name: spellCandidate.name,
      slug: spellCandidate.slug,
      data: spellCandidate.data,
      effects: spellCandidate.effects,
    },
  };
}

describe("representative MPMB calculation parity", () => {
  it("matches the imported feat preview to the live sheet structured-source path", () => {
    const { feat } = mappedCandidates();
    const level = 5;
    const baseStats = {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      level,
    };
    const state = {
      equipped_armor: "none",
      shield_equipped: false,
      rage_active: false,
    };
    const importedSources = { featureData: [feat.data], level };
    const liveSheetSources = buildCharacterStructuredSources([
      {
        content_definitions: {
          content_type: "feat",
          data: feat.data,
        },
      },
    ], level);

    expect(liveSheetSources).toEqual(importedSources);

    const importedResult = evaluate(
      baseStats,
      feat.effects,
      SCHEMA,
      importedSources,
      state,
    );
    const liveSheetResult = evaluate(
      baseStats,
      feat.effects,
      SCHEMA,
      liveSheetSources,
      state,
    );
    expect(liveSheetResult).toEqual(importedResult);
    expect(liveSheetResult).toMatchObject({
      stats: { dexterity: 11 },
      computed: { armor_class: 11 },
      speed: { walk: 35 },
      vision: [{ type: "darkvision", range: 60 }],
      dmgres: ["fire"],
      savetxt: {
        adv_vs: ["charmed"],
        immune: ["magical sleep"],
      },
    });

    const preview = buildMpmbCalculationPreview(SCHEMA, [feat]);
    const previewItem = preview.items[0];
    if (previewItem?.status !== "passed" || previewItem.contentType !== "feat") {
      throw new Error("Representative feat preview did not pass");
    }
    expect(previewItem.levels.find((entry) => entry.level === level)).toEqual({
      level,
      abilities: [{
        slug: "dexterity",
        label: "Dexterity",
        before: 10,
        after: liveSheetResult.stats.dexterity,
        delta: 1,
      }],
      derivedStats: [{
        slug: "armor_class",
        label: "Armor Class",
        before: 10,
        after: liveSheetResult.computed.armor_class,
        delta: 1,
      }],
      speed: [{
        slug: "walk",
        label: "walk speed",
        before: 30,
        after: liveSheetResult.speed.walk,
        delta: 5,
      }],
      visionAdded: liveSheetResult.vision,
      damageResistancesAdded: liveSheetResult.dmgres,
      saveAdvantagesAdded: liveSheetResult.savetxt.adv_vs,
      saveImmunitiesAdded: liveSheetResult.savetxt.immune,
    });
  });

  it("keeps every imported spell preview cast deterministic", () => {
    const { spell } = mappedCandidates();
    const first = buildMpmbCalculationPreview(SCHEMA, [spell]);
    const second = buildMpmbCalculationPreview(SCHEMA, [spell]);

    expect(second).toEqual(first);
    const previewItem = first.items[0];
    if (previewItem?.status !== "passed" || previewItem.contentType !== "spell") {
      throw new Error("Representative spell preview did not pass");
    }

    const expectedDamage = [
      "1d8 + 3",
      "1d8 + 3",
      "2d8 + 3",
      "2d8 + 3",
      "3d8 + 3",
      "3d8 + 3",
      "3d8 + 3",
      "3d8 + 3",
      "3d8 + 3",
    ];
    expect(previewItem.casts.map((cast) => ({
      label: cast.label,
      characterLevel: cast.characterLevel,
      castLevel: cast.castLevel,
      rollKinds: cast.rolls.map((roll) => roll.kind),
      expressions: cast.rolls.map((roll) => roll.expression),
      dc: cast.dc,
      persistentEffect: cast.persistentEffect,
    }))).toEqual(expectedDamage.map((damage, index) => ({
      label: index === 0
        ? "Base cast (level 1)"
        : `Upcast at level ${index + 1}`,
      characterLevel: index * 2 + 1,
      castLevel: index + 1,
      rollKinds: ["attack", "damage"],
      expressions: ["1d20+5", damage],
      dc: { ability: "dexterity", value: 13, success: "half" },
      persistentEffect: false,
    })));
  });
});
