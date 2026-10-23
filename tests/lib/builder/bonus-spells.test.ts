import { describe, expect, it } from "vitest";
import { bonusSpellSelectionComplete, isBonusSpellEligible, ordinaryKnownSpellBudget,
  readBonusSpellChoices, resolveLoreSkillChoice, type BonusSpellChoice } from "@/lib/builder/bonus-spells";
import type { ChoiceEffect } from "@/lib/types/effects";

const id = "11111111-1111-4111-8111-111111111111";
const choice = (overrides: Partial<BonusSpellChoice> = {}): BonusSpellChoice => ({ choice_id: "magical-secrets-1", choose: 2,
  min_spell_level: 0, max_spell_level: "class", list_class: null, ritual_only: false, spellbook_only: false,
  counts_known: true, always_prepared: false, mode: "known", ...overrides });
const spell = (level: number, classes = ["wizard"], ritual = false, version = 1) => ({ id, version, data: { level, classes, ritual } });

describe("bonus spell choices and independent ordinary budgets", () => {
  it("reserves every earned Secrets tier, while Lore and Tome stay additional", () => {
    const secrets = [choice(), choice({ choice_id: "magical-secrets-2" }), choice({ choice_id: "magical-secrets-3" })];
    expect(ordinaryKnownSpellBudget(22, [...secrets, choice({ choice_id: "additional-magical-secrets", counts_known: false }),
      choice({ choice_id: "pact-of-the-tome", choose: 3, counts_known: false, max_spell_level: 0 })])).toBe(16);
    expect(ordinaryKnownSpellBudget(14, [secrets[0]])).toBe(12);
    expect(ordinaryKnownSpellBudget(14, [secrets[0], secrets[0]])).toBe(0);
  });
  it("uses the owning class maximum and allows cantrips from another class", () => {
    expect(isBonusSpellEligible(choice(), spell(0), { classMaxSpellLevel: 5 })).toBe(true);
    expect(isBonusSpellEligible(choice(), spell(5), { classMaxSpellLevel: 5 })).toBe(true);
    expect(isBonusSpellEligible(choice(), spell(6), { classMaxSpellLevel: 5 })).toBe(false);
    expect(isBonusSpellEligible(choice(), spell(1, []), { classMaxSpellLevel: 5 })).toBe(false);
  });
  it("enforces ritual and Arcanum lists independently of ordinary pact limits", () => {
    const rituals = choice({ min_spell_level: 1, max_spell_level: 1, ritual_only: true, counts_known: false, mode: "ritual" });
    expect(isBonusSpellEligible(rituals, spell(1, ["wizard"], true), { classMaxSpellLevel: 2 })).toBe(true);
    expect(isBonusSpellEligible(rituals, spell(1), { classMaxSpellLevel: 2 })).toBe(false);
    expect(isBonusSpellEligible(rituals, spell(2, ["wizard"], true), { classMaxSpellLevel: 2 })).toBe(false);
    const arcanum = choice({ choose: 1, min_spell_level: 6, max_spell_level: 6, list_class: "warlock", mode: "arcanum" });
    expect(isBonusSpellEligible(arcanum, spell(6, ["warlock"]), { classMaxSpellLevel: 5 })).toBe(true);
    expect(isBonusSpellEligible(arcanum, spell(6), { classMaxSpellLevel: 5 })).toBe(false);
  });
  it("requires the exact selected Wizard book version and preserves prepared policy", () => {
    const mastery = choice({ choose: 1, min_spell_level: 1, max_spell_level: 1, list_class: "wizard", spellbook_only: true,
      counts_known: false, mode: "mastery" });
    const spellbook = [{ content_id: id, content_version: 1 }];
    expect(isBonusSpellEligible(mastery, spell(1), { classMaxSpellLevel: 9, spellbook })).toBe(true);
    expect(isBonusSpellEligible(mastery, spell(1, ["wizard"], false, 2), { classMaxSpellLevel: 9, spellbook })).toBe(false);
    expect(isBonusSpellEligible(mastery, spell(1), { classMaxSpellLevel: 9 })).toBe(false);
    expect(mastery.always_prepared).toBe(false);
  });
  it("requires complete distinct immutable selections and unambiguous spell evidence", () => {
    const one = choice({ choose: 1 });
    const pin = { content_id: id, content_version: 1 };
    expect(bonusSpellSelectionComplete(one, [pin], [spell(2)], { classMaxSpellLevel: 5 })).toBe(true);
    expect(bonusSpellSelectionComplete(one, [pin], [spell(2), spell(2)], { classMaxSpellLevel: 5 })).toBe(false);
    expect(bonusSpellSelectionComplete(choice(), [pin, pin], [spell(2)], { classMaxSpellLevel: 5 })).toBe(false);
    expect(bonusSpellSelectionComplete(one, [], [spell(2)], { classMaxSpellLevel: 5 })).toBe(false);
    expect(readBonusSpellChoices({ bonus_spells: [one] })).toEqual([one]);
    expect(readBonusSpellChoices({ bonus_spells: [one, one] })).toEqual([]);
    expect(readBonusSpellChoices({ bonus_spells: [{ ...one, execute: "arbitrary code" }] })).toEqual([]);
  });
});

describe("Lore bonus skill ownership", () => {
  const lore: ChoiceEffect = { type: "choice", choice_id: "bonus-proficiencies", choose: 3, grant_type: "proficiency",
    from: ["skill-arcana", "skill-insight", "skill-stealth", "skill-perception"] };
  const refs = [{ content_definitions: { content_type: "feature", effects: [lore] } },
    { content_definitions: { content_type: "background", effects: [{ type: "grant" as const, stat: "skill-insight", value: "proficient" }] } }];
  it("excludes existing proficiencies while retaining its own saved choices", () => {
    expect(resolveLoreSkillChoice(lore, refs, { resolved_choices: { "bonus-proficiencies": ["skill-arcana"] } }).from)
      .toEqual(["skill-arcana", "skill-stealth", "skill-perception"]);
    expect(resolveLoreSkillChoice(lore, [...refs, refs[0]], {}).from).toEqual([]);
  });
});
