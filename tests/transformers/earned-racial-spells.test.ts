import { describe, expect, it } from "vitest";
import { transformRaceEntry, raceEarnedSpellMechanics } from "@/scripts/transformers/races";
import { transformTraitEntry } from "@/scripts/transformers/traits";
import { transformSpellEntry } from "@/scripts/transformers/spells";
import { buildContentEntry } from "@/scripts/transformers/common";
import { validateSrdCatalog } from "@/scripts/transformers/validate-catalog";
import { infernalInputs } from "../fixtures/earned-racial-spells";

describe("meaningful immutable Tiefling root publication", () => {
  it("retains the existing neutral array-damage output without altering genuine source bytes", () => {
    const before = JSON.stringify(infernalInputs.spells);
    expect(transformSpellEntry(infernalInputs.spells[1]).data.damage).toEqual({ type: null, dice_at_slot_level: {} });
    expect(transformSpellEntry(infernalInputs.spells[0]).data.damage).toEqual({ type: null, dice_at_slot_level: {} });
    expect(JSON.stringify(infernalInputs.spells)).toBe(before);
  });
  it("adds the reviewed policy to the root while preserving genuine inputs and old trait effects", () => {
    const inputs = structuredClone(infernalInputs), before = JSON.stringify(inputs), oldTrait = transformTraitEntry(inputs.trait);
    const root = transformRaceEntry(inputs.tiefling, { trait: inputs.trait, spells: inputs.spells });
    expect(root.data.earned_racial_spells).toMatchObject({ version: 1, spellcasting_ability: "charisma", grants: [
      { character_level: 3, spell: "hellish-rebuke", spell_level: 1, cast_level: 2 },
      { character_level: 5, spell: "darkness", spell_level: 2, cast_level: 2 }] });
    expect(oldTrait.effects.filter(effect => effect.type === "grant" && effect.stat === "spell")).toEqual([{ type: "grant", stat: "spell", value: "thaumaturgy" }]);
    expect(oldTrait.data).not.toHaveProperty("earned_racial_spells"); expect(oldTrait.data).not.toHaveProperty("usages");
    expect(transformTraitEntry(inputs.trait)).toEqual(oldTrait); expect(JSON.stringify(inputs)).toBe(before);
    // The complete catalog validator must not publish a root with missing children.
    expect(() => validateSrdCatalog([root])).toThrow("Missing SRD dependency");
  });
  it.each(["missing", "membership", "prose", "race-prose", "cantrip", "rebuke", "darkness", "spell-prose", "extra-spell", "reorder"])("refuses changed genuine %s input", fault => {
    const inputs = structuredClone(infernalInputs);
    if (fault === "membership") inputs.trait.races[0].index = "human";
    if (fault === "prose") inputs.trait.desc[0] += " freely";
    if (fault === "race-prose") inputs.tiefling.age += " changed";
    if (fault === "cantrip") inputs.spells[0].level = 1;
    if (fault === "rebuke") inputs.spells[1].level = 2;
    if (fault === "darkness") inputs.spells[2].level = 1;
    if (fault === "spell-prose") inputs.spells[1].desc[0] += " changed";
    if (fault === "extra-spell") inputs.spells.push(inputs.spells[1]);
    if (fault === "reorder") inputs.spells.reverse();
    expect(() => transformRaceEntry(inputs.tiefling, fault === "missing" ? undefined : { trait: inputs.trait, spells: inputs.spells })).toThrow("unavailable or changed");
  });
  it("does not invent entitlements for another root from its slug or a trait alone", () => {
    expect(raceEarnedSpellMechanics({ index: "human" }, infernalInputs)).toEqual({});
    expect(() => raceEarnedSpellMechanics(infernalInputs.tiefling)).toThrow("unavailable or changed");
  });
  it("validates both new immutable spell edges while retaining the old cantrip edge", () => {
    const root = transformRaceEntry(infernalInputs.tiefling, infernalInputs);
    const entries = [root, transformTraitEntry(infernalInputs.trait),
      ...["darkvision", "hellish-resistance"].map(slug => buildContentEntry("trait", slug, slug,
        { description: "Explicit dependency control", races: ["tiefling"], subraces: [] })),
      ...infernalInputs.spells.map(spell => transformSpellEntry(spell))];
    expect(validateSrdCatalog(entries).find(entry => entry.slug === "tiefling")?.data).toHaveProperty("earned_racial_spells");
    for (const slug of ["hellish-rebuke", "darkness", "thaumaturgy"]) {
      expect(() => validateSrdCatalog(entries.filter(entry => entry.slug !== slug))).toThrow(`spell/${slug}`);
    }
    expect(() => validateSrdCatalog([{ ...root, slug: "human" }, ...entries.slice(1)])).toThrow("reviewed Tiefling root");
  });
});
