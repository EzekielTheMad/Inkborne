import { describe, expect, it } from "vitest";
import { resolveCastingAbility } from "@/lib/spells/casting-ability";
import { castingAbilityFixture } from "../fixtures/casting-acquisitions";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";

describe("exact acquisition casting ability", () => {
  it("uses the exact racial cantrip source without inventing a casting class", () => {
    const input = castingAbilityFixture();
    const rootId = "10000000-0000-4000-8000-000000000001", traitId = "10000000-0000-4000-8000-000000000002";
    const base = input.contentRefs[0];
    const root = { ...base, id: rootId, content_id: "tiefling-content", content_definitions: {
      ...base.content_definitions, id: "tiefling-content", content_type: "race", slug: "tiefling", data: { traits: ["infernal-legacy"] }, effects: [],
    } } as unknown as ContentRefWithContent;
    const trait = { ...base, id: traitId, content_id: "infernal-legacy-content", context: { source: "racial_trait", root_controller_ref_id: rootId },
      content_definitions: { ...base.content_definitions, id: "infernal-legacy-content", content_type: "trait", slug: "infernal-legacy", data: {},
        effects: [{ type: "grant", stat: "spell", value: "prism-signal" }, { type: "grant", stat: "spellcasting_ability", value: "charisma" }] },
    } as unknown as ContentRefWithContent;
    input.character.choices = { classes: [{ slug: "fighter", level: 1 }], race: "tiefling" };
    input.contentRefs = [root, trait]; input.spells = [{ ...input.spells[0], source: "racial_trait", class_slug: "race:tiefling",
      custom_data: { builder_source_pin_id: traitId, builder_root_ref_id: rootId, builder_choice_id: null, spellcasting_ability: "charisma" },
      content_definitions: { ...input.spells[0].content_definitions!, data: { ...input.spells[0].content_definitions!.data, level: 0 } },
    }];
    expect(resolveCastingAbility(input.spells[0], input)).toMatchObject({ status: "available", racialPin: { contentId: "tiefling-content", version: 1 },
      profile: { ability: "charisma", spellAttackBonus: 3, spellDc: 11 } });
    input.character.choices.race = "human";
    expect(resolveCastingAbility(input.spells[0], input).status).toBe("unavailable");
    input.character.choices.race = "tiefling"; input.spells[0].custom_data!.spellcasting_ability = "intelligence";
    expect(resolveCastingAbility(input.spells[0], input).status).toBe("unavailable");
  });
  it.each([[18, 10, 7, 3], [10, 18, 3, 7]])("binds the same spell/version under each class with opposite ability strengths (%s/%s)", (intelligence, charisma, wizardBonus, warlockBonus) => {
    const input = castingAbilityFixture(intelligence, charisma);
    for (const [index, ability, bonus] of [[0, "intelligence", wizardBonus], [1, "charisma", warlockBonus]] as const) {
      expect(resolveCastingAbility(input.spells[index], input)).toMatchObject({ status: "available", profile: { ability, spellAttackBonus: bonus, spellDc: 8 + bonus, abilityModifier: bonus - 3 } });
    }
    expect(input.spells[0].content_id).toBe(input.spells[1].content_id);
    expect(input.spells[0].content_version).toBe(input.spells[1].content_version);
  });
  it("takes snapshot/effects from the loaded acquisition, ignoring a same-identity caller forgery", () => {
    const input = castingAbilityFixture(), loaded = input.spells[0];
    const forged = { ...loaded, content_definitions: { ...loaded.content_definitions!, data: { level: 0, attack_type: null }, effects: [] } } as typeof loaded;
    const result = resolveCastingAbility(forged, input);
    expect(result.status).toBe("available");
    if (result.status === "available") expect(result.spell).toBe(loaded);
  });
  it.each(["missing-row", "duplicate-row", "target-class", "unselected-class", "missing-class", "duplicate-class", "class-version", "class-character", "class-system", "spell-version", "spell-system", "spell-type", "spell-character", "inactive-class", "unknown-ability", "duplicate-ability", "missing-score", "nan-score", "missing-proficiency", "infinite-proficiency", "overflow"])("refuses %s without a numeric fallback", problem => {
    const input = castingAbilityFixture(); const target = { ...input.spells[0] };
    if (problem === "missing-row") input.spells = [];
    if (problem === "duplicate-row") input.spells = [input.spells[0], input.spells[0]];
    if (problem === "target-class") target.class_slug = "warlock";
    if (problem === "unselected-class") input.character.choices.classes = [{ slug: "warlock", level: 3 }];
    if (problem === "missing-class") input.contentRefs = [];
    if (problem === "duplicate-class") input.contentRefs.push(input.contentRefs[0]);
    if (problem === "class-version") input.contentRefs[0].content_version = 2;
    if (problem === "class-character") input.contentRefs[0].character_id = "another";
    if (problem === "class-system") input.contentRefs[0].content_definitions.system_id = "another";
    if (problem === "spell-version") input.spells[0].content_definitions!.version = 3;
    if (problem === "spell-system") input.spells[0].content_definitions!.system_id = "another";
    if (problem === "spell-type") input.spells[0].content_definitions!.content_type = "feat";
    if (problem === "spell-character") input.spells[0].character_id = target.character_id = "another";
    if (problem === "inactive-class") (input.contentRefs[0].content_definitions.data as { levels: Array<{ spellcasting: unknown }> }).levels[0].spellcasting = null;
    if (problem === "unknown-ability") input.abilities = [];
    if (problem === "duplicate-ability") input.abilities = [{ slug: "intelligence" }, { slug: "intelligence" }];
    if (problem === "missing-score") delete input.abilityScores.intelligence;
    if (problem === "nan-score") input.abilityScores.intelligence = NaN;
    if (problem === "missing-proficiency") input.proficiencyBonus = undefined;
    if (problem === "infinite-proficiency") input.proficiencyBonus = Infinity;
    if (problem === "overflow") { input.abilityScores.intelligence = Number.MAX_VALUE; input.proficiencyBonus = Number.MAX_VALUE; }
    const result = resolveCastingAbility(target, input);
    expect(result.status).toBe("unavailable"); expect(result).not.toHaveProperty("profile");
  });
  it("allows readable foreign-author historical class/spell pins without a catalog lookup", () => {
    const input = castingAbilityFixture();
    expect(input.contentRefs[0].content_definitions.owner_id).toBe("other-author");
    expect(input.spells[0].content_definitions!.owner_id).toBe("other-author");
    expect(resolveCastingAbility(input.spells[0], input).status).toBe("available");
  });
});
