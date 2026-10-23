import { describe, expect, it } from "vitest";
import { transformFeatureEntry } from "@/scripts/transformers/features";
import { buildContentEntry } from "@/scripts/transformers/common";
import { validateSrdCatalog } from "@/scripts/transformers/validate-catalog";
import type { ApiChoice } from "@/scripts/transformers/api-options";

const skills = ["acrobatics", "animal-handling", "arcana", "athletics", "deception", "history", "insight", "intimidation",
  "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleight-of-hand", "stealth", "survival"]
  .map(skill => `skill-${skill}`);
const reference = (index: string) => ({ option_type: "reference", item: { index, name: index } });
const chooseSkills = (choose: number): ApiChoice => ({ choose, from: { options: skills.map(reference) } });
const source = (level: 1 | 6) => {
  const expertise_options: ApiChoice = level === 6
    ? { choose: 2, from: { options: [...skills, "thieves-tools"].map(reference) } }
    : { choose: 1, from: { options: [
      { option_type: "choice", choice: chooseSkills(2) },
      { option_type: "multiple", items: [{ option_type: "choice", choice: chooseSkills(1) }, reference("thieves-tools")] },
    ] } };
  return { index: `rogue-expertise-${level === 1 ? 1 : 2}`, name: "Expertise", class: { index: "rogue", name: "Rogue" },
    level, desc: ["Choose proficiencies you already have."], prerequisites: [], feature_specific: { expertise_options } };
};

describe("real SRD Rogue Expertise source mapping", () => {
  it.each([1, 6] as const)("preserves the level %s source and finite proficiency vocabulary", level => {
    const feature = transformFeatureEntry(source(level));
    expect(feature.slug).toBe(`rogue-expertise-${level === 1 ? 1 : 2}`);
    expect(feature.data.feature_type).toBe("choice");
    expect(feature.data.choices ?? []).toEqual([]);
    expect(feature.effects).toContainEqual({ type: "choice", choice_id: feature.slug, choose: 2,
      from: [...skills, "thieves-tools"], grant_type: "expertise" });
    expect(feature.effects[0].type).toBe("narrative");
  });

  it("rejects unsupported bundled or changed cardinality sources", () => {
    const input = source(1);
    input.feature_specific.expertise_options.choose = 2;
    expect(() => transformFeatureEntry(input)).toThrow("Unsupported SRD Rogue Expertise");
    const wrongTool = source(6);
    wrongTool.feature_specific.expertise_options.from.options!.at(-1)!.item = { index: "flute", name: "Flute" };
    expect(() => transformFeatureEntry(wrongTool)).toThrow("Unsupported SRD Rogue Expertise");
    expect(() => transformFeatureEntry({ ...source(1), level: 2 })).toThrow("Unsupported SRD Rogue Expertise");
  });

  it("requires real proficiency dependencies, without inventing feature children", () => {
    const cls = buildContentEntry("class", "rogue", "Rogue", { hit_die: 8, spellcasting: null, multiclass: { prerequisites: [], proficiencies_gained: [] },
      saving_throws: [], starting_proficiencies: [], levels: [{ level: 1, features: [] }] });
    const feature = transformFeatureEntry(source(1));
    expect(() => validateSrdCatalog([cls, feature])).toThrow("feature/rogue-expertise-1 -> proficiency/skill-acrobatics");
    const proficiencies = [...skills, "thieves-tools"].map(slug => buildContentEntry("proficiency", slug, slug,
      { proficiency_type: slug.startsWith("skill-") ? "skill" : "tool", reference: slug, classes: [], races: [] }));
    expect(validateSrdCatalog([cls, feature, ...proficiencies]).find(entry => entry.slug === feature.slug)?.effects).toEqual(feature.effects);
  });
});
