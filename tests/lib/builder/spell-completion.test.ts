import { describe, expect, it } from "vitest";
import { classSpellSelectionsComplete, type BuilderSpellCompletionRow } from "@/lib/builder/spell-completion";
import type { EffectiveCastingSource } from "@/lib/spells/effective-sources";

const cleric: EffectiveCastingSource = {
  classSlug: "cleric", classLevel: 1, kind: "class", parentPin: { contentId: "class-cleric", version: 1 },
  active: true, config: { type: "full", ability: "wisdom" }, cantripsKnown: 3, spellsKnown: "all",
  prepared: true, preparationRule: "parent", spellList: { class: "cleric", level: [0, 9] },
  directSlots: [2, 0, 0, 0, 0, 0, 0, 0, 0], maxLearnableLevel: 1,
};
function spell(id: string, level: number, patch: Partial<BuilderSpellCompletionRow> = {}): BuilderSpellCompletionRow {
  return { content_id: id, content_version: 1, class_slug: "cleric", source: "selection", is_prepared: true,
    is_known: true, in_spellbook: false, always_prepared: false,
    content_definitions: { id, version: 1, content_type: "spell", data: { level, classes: ["cleric"] } }, ...patch };
}
const cantrips = () => [spell("guidance", 0), spell("resistance", 0), spell("sacred-flame", 0)];
const complete = () => [...cantrips(), spell("bane", 1), spell("command", 1), spell("guiding-bolt", 1)];
const scores = { wisdom: 15, intelligence: 16, charisma: 16 };

describe("physical builder spell completion", () => {
  it("accepts complete Cleric choices while Life and racial grants do not consume ordinary allowances", () => {
    expect(classSpellSelectionsComplete([cleric], [...complete(),
      spell("bless", 1, { source: "feature", always_prepared: true }),
      spell("cure-wounds", 1, { source: "feature", always_prepared: true }),
      spell("light", 0, { source: "racial_trait", class_slug: "elf" }),
    ], scores)).toBe(true);
  });

  it("requires actual cantrip choices and at least one prepared spell", () => {
    expect(classSpellSelectionsComplete([cleric], complete().slice(1), scores)).toBe(false);
    expect(classSpellSelectionsComplete([cleric], complete().map(row => row.content_id === "guidance" ? { ...row, is_known: false } : row), scores)).toBe(false);
    expect(classSpellSelectionsComplete([cleric], complete().map(row => row.content_id === "bane" ? { ...row, is_known: false } : row), scores)).toBe(false);
    expect(classSpellSelectionsComplete([cleric], cantrips(), scores)).toBe(false);
    expect(classSpellSelectionsComplete([cleric], [...cantrips(), spell("bane", 1, { is_prepared: false })], scores)).toBe(false);
  });

  it("refuses preparation above confirmed ability capacity or missing mechanics", () => {
    expect(classSpellSelectionsComplete([cleric], [...complete(), spell("detect-magic", 1)], scores)).toBe(false);
    expect(classSpellSelectionsComplete([cleric], complete(), {})).toBe(false);
    expect(classSpellSelectionsComplete([cleric], complete(), { wisdom: Number.NaN })).toBe(false);
    expect(classSpellSelectionsComplete([cleric], [...cantrips(), spell("bane", 1)], { wisdom: 3 })).toBe(true);
  });

  it("does not substitute current spell versions, duplicates, levels, or other class lists", () => {
    for (const invalid of [
      spell("bane", 1, { content_version: 2 }),
      spell("bane", 1, { content_definitions: null }),
      spell("bane", 1, { content_definitions: { id: "different", version: 1, content_type: "spell", data: { level: 1, classes: ["cleric"] } } }),
      spell("too-high", 2),
      spell("wrong-class", 1, { content_definitions: { id: "wrong-class", version: 1, content_type: "spell", data: { level: 1, classes: ["wizard"] } } }),
    ]) expect(classSpellSelectionsComplete([cleric], [...cantrips(), invalid], scores)).toBe(false);
    expect(classSpellSelectionsComplete([cleric], [...complete(), spell("bane", 1)], scores)).toBe(false);
  });

  it("requires exact known-caster counts and actual known rows", () => {
    const source: EffectiveCastingSource = { ...cleric, classSlug: "bard", config: { type: "full", ability: "charisma" },
      cantripsKnown: 0, spellsKnown: 2, prepared: false, spellList: { class: "bard", level: [0, 9] } };
    const known = (id: string) => spell(id, 1, { class_slug: "bard", is_known: true, is_prepared: false,
      content_definitions: { id, version: 1, content_type: "spell", data: { level: 1, classes: ["bard"] } } });
    expect(classSpellSelectionsComplete([source], [known("one"), known("two")], scores)).toBe(true);
    expect(classSpellSelectionsComplete([source], [known("one")], scores)).toBe(false);
    expect(classSpellSelectionsComplete([source], [known("one"), { ...known("two"), is_known: false }], scores)).toBe(false);
  });

  it("counts earned expanded spells as ordinary known selections with exact saved slug evidence", () => {
    const source: EffectiveCastingSource = { ...cleric, classSlug: "warlock", config: { type: "pact", ability: "charisma" },
      cantripsKnown: 0, spellsKnown: 2, prepared: false, spellList: { class: "warlock", level: [0, 9] },
      expandedSpellSlugs: ["burning-hands", "command"] };
    const known = (slug: string, classes = ["wizard"]) => spell(slug, 1, {
      class_slug: "warlock", is_prepared: false, content_definitions: {
        id: slug, slug, version: 1, content_type: "spell", data: { level: 1, classes },
      },
    });
    const saved = [known("burning-hands"), known("hex", ["warlock"])];
    expect(classSpellSelectionsComplete([source], saved, scores)).toBe(true);
    expect(classSpellSelectionsComplete([source], [...saved, known("command", ["cleric"])], scores)).toBe(false);
    expect(classSpellSelectionsComplete([{ ...source, expandedSpellSlugs: [] }], saved, scores)).toBe(false);
    expect(classSpellSelectionsComplete([source], [saved[1], known("wrong-slug")], scores)).toBe(false);
    expect(classSpellSelectionsComplete([source], saved.map(row => ({ ...row, always_prepared: true })), scores)).toBe(false);
    expect(classSpellSelectionsComplete([source], saved.map(row => ({ ...row, source: "feature" })), scores)).toBe(false);
  });

  it("requires a real Wizard spellbook of the expected size and a prepared subset", () => {
    const source: EffectiveCastingSource = { ...cleric, classSlug: "wizard", config: { type: "full", ability: "intelligence" },
      cantripsKnown: 0, spellList: { class: "wizard", level: [0, 9] } };
    const book = Array.from({ length: 6 }, (_, index) => {
      const id = "wizard-" + index;
      return spell(id, 1, { class_slug: "wizard", in_spellbook: true, is_prepared: index < 4,
        content_definitions: { id, version: 1, content_type: "spell", data: { level: 1, classes: ["wizard"] } } });
    });
    expect(classSpellSelectionsComplete([source], book, scores)).toBe(true);
    expect(classSpellSelectionsComplete([source], book.slice(1), scores)).toBe(false);
    expect(classSpellSelectionsComplete([source], book.map(row => ({ ...row, in_spellbook: false })), scores)).toBe(false);
    expect(classSpellSelectionsComplete([{ ...source, classLevel: 2 }], book, scores)).toBe(false);
  });

  it("uses the half-level preparation rule and refuses orphaned physical selections", () => {
    const source: EffectiveCastingSource = { ...cleric, classSlug: "paladin", classLevel: 2, cantripsKnown: 0,
      config: { type: "half", ability: "charisma" }, spellList: { class: "paladin", level: [0, 9] } };
    const prepared = Array.from({ length: 4 }, (_, index) => {
      const id = "paladin-" + index;
      return spell(id, 1, { class_slug: "paladin", content_definitions: { id, version: 1, content_type: "spell", data: { level: 1, classes: ["paladin"] } } });
    });
    expect(classSpellSelectionsComplete([source], prepared, scores)).toBe(true);
    expect(classSpellSelectionsComplete([source], [...prepared, spell("extra", 1, { class_slug: "paladin",
      content_definitions: { id: "extra", version: 1, content_type: "spell", data: { level: 1, classes: ["paladin"] } } })], scores)).toBe(false);
    expect(classSpellSelectionsComplete([], [spell("orphan", 0)], scores)).toBe(false);
    expect(classSpellSelectionsComplete([], [], {})).toBe(true);
    expect(classSpellSelectionsComplete([cleric, cleric], complete(), scores)).toBe(false);
  });
});
