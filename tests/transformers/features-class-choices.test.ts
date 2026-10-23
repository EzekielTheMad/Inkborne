import { describe, expect, it } from "vitest";
import { transformFeatureEntry } from "@/scripts/transformers/features";

const terrains = ["arctic", "coast", "desert", "forest", "grassland", "mountain", "swamp"];
const tiers = [["natural-explorer-1-terrain-type", 1], ["natural-explorer-2-terrain-types", 6],
  ["natural-explorer-3-terrain-types", 10]] as const;
const source = (index: string, level: number) => ({ index, name: "Natural Explorer", class: { index: "ranger", name: "Ranger" },
  level, prerequisites: [], desc: ["Choose one additional terrain."],
  feature_specific: { terrain_type_options: { choose: 1, type: "string", from: { option_set_type: "options_array", options: [...terrains] } } } });

describe("real SRD Natural Explorer source mapping", () => {
  it.each(tiers)("records one additional terrain at %s", (slug, level) => {
    const feature = transformFeatureEntry(source(slug, level));
    expect(feature.data.feature_type).toBe("choice");
    expect(feature.effects).toContainEqual({ type: "choice", choice_id: slug, choose: 1, from: terrains, grant_type: "favored_terrain" });
    expect(feature.data.choices ?? []).toEqual([]);
  });
  it("rejects unsupported terrain vocabulary, cumulative cardinality and level drift", () => {
    const duplicate = source(...tiers[0]); duplicate.feature_specific.terrain_type_options.from.options[1] = "arctic";
    expect(() => transformFeatureEntry(duplicate)).toThrow("Unsupported SRD Natural Explorer");
    const cumulative = source(...tiers[1]); cumulative.feature_specific.terrain_type_options.choose = 2;
    expect(() => transformFeatureEntry(cumulative)).toThrow("Unsupported SRD Natural Explorer");
    expect(() => transformFeatureEntry({ ...source(...tiers[2]), level: 14 })).toThrow("Unsupported SRD Natural Explorer");
  });
});

describe("native SRD child feature source contracts", () => {
  const metamagic = ["careful", "distant", "empowered", "extended", "heightened", "quickened", "subtle", "twinned"]
    .map(name => `metamagic-${name}-spell`);
  it.each([[1, 3, 2], [2, 10, 1], [3, 17, 1]])("preserves Metamagic tier %s and finite child dependencies", (tier, level, count) => {
    const feature = transformFeatureEntry({ index: `metamagic-${tier}`, name: "Metamagic", class: { index: "sorcerer", name: "Sorcerer" },
      level, desc: ["Choose additional options."], prerequisites: [], feature_specific: { subfeature_options: { choose: count,
        from: { options: metamagic.map(index => ({ option_type: "reference", item: { index, name: index } })) } } } });
    expect(feature.effects).toContainEqual({ type: "choice", choice_id: `metamagic-${tier}`, choose: count, from: metamagic, grant_type: "feature" });
    expect(feature.data.choices).toEqual([{ name: "Metamagic", count, options: metamagic }]);
  });
  it("preserves finite invocation prerequisites rather than accepting description-only options", () => {
    const feature = transformFeatureEntry({ index: "eldritch-invocation-thirsting-blade", name: "Thirsting Blade",
      class: { index: "warlock", name: "Warlock" }, level: 5, desc: ["Attack twice with your pact weapon."],
      prerequisites: [{ type: "level", level: 5 }, { type: "feature", feature: "/api/2014/features/pact-of-the-blade" }] });
    expect(feature.data.selection_prerequisites).toEqual([{ kind: "class_level", minimum: 5 }, { kind: "feature", slug: "pact-of-the-blade" }]);
    const spell = transformFeatureEntry({ index: "eldritch-invocation-agonizing-blast", name: "Agonizing Blast",
      class: { index: "warlock", name: "Warlock" }, level: 2, desc: ["Add Charisma damage."],
      prerequisites: [{ type: "spell", spell: "/api/2014/spells/eldritch-blast" }] });
    expect(spell.data.selection_prerequisites).toEqual([{ kind: "class_level", minimum: 2 }, { kind: "spell", slug: "eldritch-blast" }]);
    expect(() => transformFeatureEntry({ index: "eldritch-invocation-unknown", name: "Unknown", class: { index: "warlock", name: "Warlock" },
      level: 2, desc: ["Unknown prerequisite"], prerequisites: [{ type: "freeform", value: "Trust this" }] })).toThrow("Unsupported SRD invocation prerequisite");
  });
  it("adds only source-supported skill grants to Beguiling Influence", () => {
    const feature = transformFeatureEntry({ index: "eldritch-invocation-beguiling-influence", name: "Beguiling Influence",
      class: { index: "warlock", name: "Warlock" }, level: 2, desc: ["You gain proficiency in the Deception and Persuasion skills."], prerequisites: [] });
    expect(feature.effects).toContainEqual({ type: "grant", stat: "skill-deception", value: "proficient" });
    expect(feature.effects).toContainEqual({ type: "grant", stat: "skill-persuasion", value: "proficient" });
  });
  it("retains Favored Enemy's type/humanoid alternative as structured metadata", () => {
    const enemy_types = ["aberrations", "beasts", "celestials", "constructs", "dragons", "elementals", "fey", "fiends", "giants", "monstrosities", "oozes", "plants", "undead"];
    const feature = transformFeatureEntry({ index: "favored-enemy-1-type", name: "Favored Enemy", class: { index: "ranger", name: "Ranger" },
      level: 1, desc: ["Choose one type or two humanoid races."], prerequisites: [], feature_specific: { enemy_type_options: {
        choose: 1, type: "string", from: { option_set_type: "options_array", options: [...enemy_types, "humanoids"] } } } });
    expect(feature.data.feature_type).toBe("favored_enemy");
    expect(feature.data.favored_enemy).toEqual({ enemy_types, humanoid_races: ["dragonborn", "dwarf", "elf", "gnoll", "gnome", "half-elf", "half-orc", "halfling", "human", "orc", "tiefling"] });
    expect(feature.effects.filter(effect => effect.type === "choice")).toEqual([]);
  });
});
