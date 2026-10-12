import { describe, expect, it } from "vitest";
import { parseContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";
import { resolvePinnedSpellSlots } from "@/lib/spells/helpers";
import { resolveCastingAbility } from "@/lib/spells/casting-ability";
import { originalGrantData, originalSnapshot, originalSubclassData, originalSubclassFixture } from "../fixtures/subclass-casting";

describe("original pinned subclass casting integration", () => {
  it("retains an explicitly declared third-caster profile through the actual immutable snapshot parser", () => {
    const data = originalSubclassData();
    expect(parseContentVersionSnapshot(originalSnapshot("lumen-adept", "subclass", data, 20))?.data.spellcasting).toEqual(data.spellcasting);
  });
  it("reads the only regular source's direct subclass row under its parent identity", () => {
    const input = originalSubclassFixture();
    expect(resolvePinnedSpellSlots(input.character.choices.classes, input.contentRefs, input.character)).toMatchObject({ status: "available", maxSlots: { "1": 3 }, pactSlotLevel: null });
  });
  it("uses the acquisition parent class's selected subclass ability without a global fallback", () => {
    const input = originalSubclassFixture();
    expect(resolveCastingAbility(input.spells[0], input)).toMatchObject({ status: "available", profile: { classSlug: "warden", ability: "intelligence", abilityModifier: 2, spellAttackBonus: 4, spellDc: 12 } });
  });
  it("retains shipped-style object-tier grants without creating a casting profile", () => {
    const data = originalGrantData();
    const parsed = parseContentVersionSnapshot(originalSnapshot("original-gift", "subclass", data, 20));
    expect(parsed?.data.spellcastingExtra).toEqual(data.spellcastingExtra);
    expect(parsed?.data).not.toHaveProperty("spellcasting");
  });
});
