import { describe, expect, it } from "vitest";
import { classSpellSelectionsComplete, type BuilderSpellCompletionRow, type BonusSpellCompletionEvidence } from "@/lib/builder/spell-completion";
import type { BonusSpellChoice } from "@/lib/builder/bonus-spells";
import type { EffectiveCastingSource } from "@/lib/spells/effective-sources";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const bard: EffectiveCastingSource = { classSlug: "bard", classLevel: 10, kind: "class", subclassSlug: "lore",
  parentPin: { contentId: id(800), version: 1 }, active: true, config: { type: "full", ability: "charisma" },
  cantripsKnown: 0, spellsKnown: 14, prepared: false, preparationRule: "parent", spellList: { class: "bard", level: [0, 9] },
  directSlots: [4, 3, 3, 3, 2, 0, 0, 0, 0], maxLearnableLevel: 5 };
const choice: BonusSpellChoice = { choice_id: "magical-secrets-1", choose: 2, min_spell_level: 0, max_spell_level: "class",
  list_class: null, ritual_only: false, spellbook_only: false, counts_known: true, always_prepared: false, mode: "known" };
function row(n: number, level = 1, classSlug = "bard", patch: Partial<BuilderSpellCompletionRow> = {}): BuilderSpellCompletionRow {
  return { content_id: id(n), content_version: 1, class_slug: classSlug, source: "selection", is_known: true,
    is_prepared: false, always_prepared: false, in_spellbook: false,
    content_definitions: { id: id(n), version: 1, content_type: "spell", data: { level, classes: [classSlug] } }, ...patch };
}
const feature = (policy: BonusSpellChoice, patch: Record<string, unknown> = {}) => ({ id: id(900), version: 1,
  slug: policy.choice_id, ref_id: id(901), data: { class: "bard", level: 10, bonus_spells: [policy], ...patch } });
const pin = (n: number) => ({ content_id: id(n), content_version: 1 });
const bonusRow = (n: number, policy = choice, level = 1) => row(n, level, "bard", { source: "bonus", custom_data: {
  builder_bonus_choice_id: policy.choice_id, builder_bonus_source_ref_id: id(901), builder_bonus_mode: policy.mode,
}, content_definitions: { id: id(n), version: 1, content_type: "spell", data: { level, classes: ["wizard"] } } });

describe("bonus spell saved-state completion", () => {
  it("reserves Magical Secrets from ordinary known spells and requires saved source-owned bonus rows", () => {
    const ordinary = Array.from({ length: 12 }, (_, index) => row(index + 1));
    const evidence: BonusSpellCompletionEvidence = { features: [feature(choice)], selections: { [choice.choice_id]: [pin(101), pin(102)] } };
    const allRows = [...ordinary, bonusRow(101), bonusRow(102, choice, 0)];
    expect(classSpellSelectionsComplete([bard], allRows, {}, evidence)).toBe(true);
    expect(classSpellSelectionsComplete([bard], [...allRows, row(20)], {}, evidence)).toBe(false);
    expect(classSpellSelectionsComplete([bard], ordinary, {}, evidence)).toBe(false);
    expect(classSpellSelectionsComplete([bard], allRows, {}, { ...evidence, selections: {} })).toBe(false);
    expect(classSpellSelectionsComplete([bard], allRows.map(spell => spell.content_id === id(101)
      ? { ...spell, custom_data: { ...spell.custom_data, builder_bonus_source_ref_id: id(902) } } : spell), {}, evidence)).toBe(false);
    expect(classSpellSelectionsComplete([bard], allRows, {}, { ...evidence, selections: { [choice.choice_id]: [pin(101), { ...pin(102), content_version: 2 }] } })).toBe(false);
  });

  it("keeps Lore Additional Magical Secrets outside the ordinary Bard known allowance", () => {
    const lore = { ...choice, choice_id: "additional-magical-secrets", counts_known: false };
    const ordinary = Array.from({ length: 14 }, (_, index) => row(index + 1));
    const evidence = { features: [feature(lore, { level: 6, subclass: "lore" })], selections: { [lore.choice_id]: [pin(101), pin(102)] } };
    expect(classSpellSelectionsComplete([bard], [...ordinary, bonusRow(101, lore), bonusRow(102, lore)], {}, evidence)).toBe(true);
    expect(classSpellSelectionsComplete([{ ...bard, subclassSlug: "valor" }], ordinary, {}, evidence)).toBe(false);
  });

  it("marks exact Wizard spellbook entries without duplicating them and excludes Signature preparation", () => {
    const wizard = { ...bard, classSlug: "wizard", classLevel: 20, cantripsKnown: 0, spellsKnown: "all" as const,
      subclassSlug: undefined, prepared: true, config: { type: "full" as const, ability: "intelligence" },
      spellList: { class: "wizard", level: [0, 9] as [number, number] }, maxLearnableLevel: 9 };
    const signature: BonusSpellChoice = { ...choice, choice_id: "signature-spell", min_spell_level: 3, max_spell_level: 3,
      list_class: "wizard", spellbook_only: true, counts_known: false, always_prepared: true, mode: "signature" };
    const mastery: BonusSpellChoice = { ...signature, choice_id: "spell-mastery-1", choose: 1, min_spell_level: 1, max_spell_level: 1,
      always_prepared: false, mode: "mastery" };
    const book = Array.from({ length: 44 }, (_, index) => row(index + 1, index < 2 ? 3 : 1, "wizard", {
      in_spellbook: true, is_prepared: index < 25, always_prepared: index < 2,
    }));
    const evidence = { features: [feature(signature, { class: "wizard", level: 20 }), feature(mastery, { class: "wizard", level: 18 })],
      selections: { [signature.choice_id]: [pin(1), pin(2)], [mastery.choice_id]: [pin(3)] } };
    expect(classSpellSelectionsComplete([wizard], book, { intelligence: 16 }, evidence)).toBe(true);
    expect(classSpellSelectionsComplete([wizard], book.map(spell => ({ ...spell, is_prepared: !!spell.always_prepared })),
      { intelligence: 16 }, evidence)).toBe(true);
    expect(classSpellSelectionsComplete([wizard], book.map(spell => spell.content_id === id(1)
      ? { ...spell, always_prepared: false } : spell), { intelligence: 16 }, evidence)).toBe(false);
    expect(classSpellSelectionsComplete([wizard], book, { intelligence: 16 }, { ...evidence,
      selections: { ...evidence.selections, [mastery.choice_id]: [pin(100)] } })).toBe(false);
    expect(classSpellSelectionsComplete([wizard], book, { intelligence: 16 }, { ...evidence,
      selections: { ...evidence.selections, [mastery.choice_id]: [pin(1)] } })).toBe(false);
  });
});
