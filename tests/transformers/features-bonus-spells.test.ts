import { describe, expect, it } from "vitest";
import { transformFeatureEntry, transformLandSpellGrants } from "@/scripts/transformers/features";
import { featureDataSchema } from "@/lib/schemas/content-types/feature";
import { readBonusSpellChoices } from "@/lib/builder/bonus-spells";

const feature = (index: string, classSlug: string, level: number, desc: string, subclass?: string) => ({ index, name: index,
  class: { index: classSlug, name: classSlug }, level, desc: [desc], prerequisites: [] as unknown[],
  ...(subclass ? { subclass: { index: subclass, name: subclass } } : {}) });

describe("source-backed bonus selection descriptors", () => {
  it("keeps Secrets known cost separate from Lore additional spells", () => {
    for (const [index, level] of [["magical-secrets-1", 10], ["magical-secrets-2", 14], ["magical-secrets-3", 18]] as const) {
      const raw = feature(index, "bard", level, "Choose two spells from any class. They are included in the number in the Spells Known column.");
      const data = featureDataSchema.parse(transformFeatureEntry(raw).data);
      expect(readBonusSpellChoices(data)).toEqual([{ choice_id: index, choose: 2, min_spell_level: 0, max_spell_level: "class",
        list_class: null, ritual_only: false, spellbook_only: false, counts_known: true, always_prepared: false, mode: "known" }]);
      expect(() => transformFeatureEntry({ ...raw, level: 1 })).toThrow("Unsupported SRD bonus spells");
    }
    const additional = transformFeatureEntry(feature("additional-magical-secrets", "bard", 6,
      "You learn two spells of your choice from any class. These don't count against the number of bard spells you know.", "lore"));
    expect(readBonusSpellChoices(additional.data)[0]).toMatchObject({ choose: 2, counts_known: false, max_spell_level: "class" });
  });
  it("gives Lore three skill choices and Land one additional Druid cantrip", () => {
    const lore = transformFeatureEntry(feature("bonus-proficiencies", "bard", 3,
      "You gain proficiency with three skills of your choice.", "lore"));
    expect(lore.data.feature_type).toBe("choice");
    expect(lore.effects).toContainEqual(expect.objectContaining({ type: "choice", choice_id: "bonus-proficiencies", choose: 3, grant_type: "proficiency" }));
    expect(lore.effects.find(effect => effect.type === "choice")?.from).toHaveLength(18);
    const land = transformFeatureEntry(feature("bonus-cantrip", "druid", 2, "You learn one additional druid cantrip of your choice.", "land"));
    expect(readBonusSpellChoices(land.data)[0]).toMatchObject({ choose: 1, list_class: "druid", max_spell_level: 0, counts_known: false });
    expect(() => transformFeatureEntry(feature("bonus-proficiencies", "bard", 3, "Unknown", "lore"))).toThrow("Unsupported SRD Lore");
  });
  it("keeps Tome, ritual book and exact-level Arcanum outside ordinary pact budgets", () => {
    const tome = transformFeatureEntry(feature("pact-of-the-tome", "warlock", 3,
      "Choose three cantrips from any class's spell list. They don't count against your number of cantrips known."));
    expect(readBonusSpellChoices(tome.data)[0]).toMatchObject({ choose: 3, max_spell_level: 0, list_class: null, counts_known: false });
    const book = feature("eldritch-invocation-book-of-ancient-secrets", "warlock", 2,
      "Choose two 1st-level spells that have the ritual tag from any class's spell list. You cannot cast them except as rituals.");
    expect(() => transformFeatureEntry(book)).toThrow("Unsupported SRD bonus spell prerequisite");
    book.prerequisites.push({ type: "feature", feature: "/api/2014/features/pact-of-the-tome" });
    const bookData = transformFeatureEntry(book).data;
    expect(readBonusSpellChoices(bookData)[0]).toMatchObject({ min_spell_level: 1, max_spell_level: 1, ritual_only: true, mode: "ritual" });
    expect(bookData.selection_prerequisites).toContainEqual({ kind: "feature", slug: "pact-of-the-tome" });
    for (const spellLevel of [6, 7, 8, 9]) {
      const arcanum = transformFeatureEntry(feature(`mystic-arcanum-${spellLevel}th-level`, "warlock", spellLevel * 2 - 1,
        "Choose one 6th- level spell from the warlock spell list. You gain one 9th-level spell at 17th level."));
      expect(readBonusSpellChoices(arcanum.data)[0]).toMatchObject({ choose: 1, min_spell_level: spellLevel, max_spell_level: spellLevel,
        list_class: "warlock", mode: "arcanum", counts_known: false });
    }
  });
  it("requires existing book choices without preparing Mastery automatically", () => {
    const mastery = transformFeatureEntry(feature("spell-mastery", "wizard", 18,
      "Choose a 1st-level wizard spell and a 2nd-level wizard spell that are in your spellbook. Cast them when you have them prepared."));
    expect(readBonusSpellChoices(mastery.data)).toMatchObject([
      { choice_id: "spell-mastery-1", min_spell_level: 1, max_spell_level: 1, spellbook_only: true, always_prepared: false },
      { choice_id: "spell-mastery-2", min_spell_level: 2, max_spell_level: 2, spellbook_only: true, always_prepared: false },
    ]);
    const signature = transformFeatureEntry(feature("signature-spell", "wizard", 20,
      "Choose two 3rd-level wizard spells in your spellbook. You always have these spells prepared, and they don't count against the number of spells you have prepared."));
    expect(readBonusSpellChoices(signature.data)[0]).toMatchObject({ choose: 2, min_spell_level: 3, max_spell_level: 3,
      spellbook_only: true, always_prepared: true, counts_known: false, mode: "signature" });
  });
});

describe("Land spell source predicates", () => {
  const source = () => ({ index: "land", class: { index: "druid" }, spells:
    ["arctic", "coast", "desert", "forest", "grassland", "mountain", "swamp"].flatMap(terrain => [3, 5, 7, 9].flatMap(level =>
      ["first", "second"].map(name => ({ spell: { index: `${terrain}-${name}-${level}` }, prerequisites: [
        { type: "level", index: `druid-${level}` }, { type: "feature", index: `circle-of-the-land-${terrain}` },
      ] })))) });
  it("preserves both chosen terrain and own-class unlock on all 56 source edges", () => {
    const tiers = transformLandSpellGrants(source());
    expect(Object.keys(tiers)).toHaveLength(7);
    expect(tiers["circle-of-the-land-forest"]).toEqual([3, 5, 7, 9].map(class_level => ({ class_level,
      spells: [`forest-first-${class_level}`, `forest-second-${class_level}`], always_prepared: true })));
    const child = transformFeatureEntry(feature("circle-of-the-land-forest", "druid", 2, "Forest", "land"), tiers["circle-of-the-land-forest"]);
    expect(featureDataSchema.parse(child.data).bonus_spell_grants).toEqual(tiers["circle-of-the-land-forest"]);
  });
  it("refuses missing terrain, extra predicates, changed levels and duplicate source edges", () => {
    const missing = source(); missing.spells.pop(); expect(() => transformLandSpellGrants(missing)).toThrow("Unsupported SRD Land");
    const changed = source(); changed.spells[0].prerequisites[0].index = "druid-4"; expect(() => transformLandSpellGrants(changed)).toThrow("Unsupported SRD Land");
    const extra = source(); extra.spells[0].prerequisites.push({ type: "unknown", index: "anything" }); expect(() => transformLandSpellGrants(extra)).toThrow("Unsupported SRD Land");
    const duplicate = source(); duplicate.spells[1] = duplicate.spells[0]; expect(() => transformLandSpellGrants(duplicate)).toThrow("Duplicate SRD Land");
  });
});
