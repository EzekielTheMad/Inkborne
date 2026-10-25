import { describe, expect, it } from "vitest";
import { earnedRacialSpellsSchema, earnedRacialSpellSourceSchema, INFERNAL_LEGACY_EARNED_SPELLS } from "@/lib/schemas/racial-spells";
import { raceDataSchema } from "@/lib/schemas/content-types/race";
import { earnedRacialFixture } from "../fixtures/earned-racial-spells";

describe("finite earned racial spell schemas", () => {
  it("leaves historical roots neutral and accepts only the reviewed literal root", () => {
    expect(raceDataSchema.parse({ size: "Medium", speed: 30, source_refs: [] })).not.toHaveProperty("earned_racial_spells");
    expect(earnedRacialSpellsSchema.parse(INFERNAL_LEGACY_EARNED_SPELLS)).toEqual(INFERNAL_LEGACY_EARNED_SPELLS);
  });
  it.each(["extra", "ability", "trait", "threshold", "spell", "base-level", "cast-level", "reorder", "duplicate", "resource"])("refuses changed %s policy", fault => {
    const value = structuredClone(INFERNAL_LEGACY_EARNED_SPELLS) as unknown as Record<string, unknown>;
    const grants = value.grants as Record<string, unknown>[];
    if (fault === "extra") value.any_spell = true;
    if (fault === "ability") value.spellcasting_ability = "intelligence";
    if (fault === "trait") value.source_trait = "other";
    if (fault === "threshold") grants[0].character_level = 2;
    if (fault === "spell") grants[0].spell = "fireball";
    if (fault === "base-level") grants[0].spell_level = 2;
    if (fault === "cast-level") grants[0].cast_level = 1;
    if (fault === "reorder") grants.reverse();
    if (fault === "duplicate") grants[1] = grants[0];
    if (fault === "resource") value.recovery = "long rest";
    expect(earnedRacialSpellsSchema.safeParse(value).success).toBe(false);
    expect(raceDataSchema.safeParse({ size: "Medium", speed: 30, source_refs: [], earned_racial_spells: value }).success).toBe(false);
  });
  it.each(["extra-outer", "extra-inner", "key", "level", "choice", "ability", "version"])("rejects source %s substitution", fault => {
    const source = structuredClone(earnedRacialFixture().spells[0].custom_data)!;
    const inner = source.builder_earned_racial_spell as Record<string, unknown>;
    if (fault === "extra-outer") source.arbitrary = true;
    if (fault === "extra-inner") inner.uses = 1;
    if (fault === "key") inner.grant_key = "infernal-legacy:5:darkness";
    if (fault === "level") inner.character_level = 5;
    if (fault === "choice") source.builder_choice_id = "borrowed";
    if (fault === "ability") source.spellcasting_ability = "intelligence";
    if (fault === "version") inner.contract_version = 2;
    expect(earnedRacialSpellSourceSchema.safeParse(source).success).toBe(false);
  });
});
