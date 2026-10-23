import { describe, expect, it } from "vitest";
import { subclassSpellMetadata } from "@/scripts/transformers/classes";
import { buildContentEntry } from "@/scripts/transformers/common";
import { subclassDataSchema } from "@/lib/schemas/content-types/subclass";
import { validateSrdCatalog } from "@/scripts/transformers/validate-catalog";
import { originalParent } from "../fixtures/subclass-casting";

// Exact ten spell/own-class-level relationships from the cached public 2014
// Fiend resource, reviewed against the SRD 5.1 Expanded Spell List table.
const tiers = [
  { level: 1, spells: ["burning-hands", "command"] },
  { level: 3, spells: ["blindness-deafness", "scorching-ray"] },
  { level: 5, spells: ["fireball", "stinking-cloud"] },
  { level: 7, spells: ["fire-shield", "wall-of-fire"] },
  { level: 9, spells: ["flame-strike", "hallow"] },
];
const fiend = () => ({ index: "fiend", class: { index: "warlock", name: "Warlock" }, spells: tiers.flatMap(tier =>
  tier.spells.map(index => ({ spell: { index, name: index }, prerequisites: [{ type: "level", index: `warlock-${tier.level}` }] }))) });
const data = () => ({ parent_class: "warlock", levels: [{ level: 1, features: [] }], spells: [], spellcastingExpanded: tiers });

describe("Fiend source spell-list semantics", () => {
  it("publishes all ten ordinary-list additions without restoring the old grant overlay", () => {
    expect(subclassSpellMetadata(fiend())).toEqual({ spellcastingExpanded: tiers });
    const entry = buildContentEntry("subclass", "fiend", "Fiend", { ...data(), ...subclassSpellMetadata(fiend()) });
    expect(entry.data).not.toHaveProperty("spellcastingExtra");
    expect(subclassDataSchema.parse(entry.data).spellcastingExpanded).toEqual(tiers);
  });
  it("requires genuine parent, complete spell pairs and exact own-class prerequisites", () => {
    const missing = fiend(); missing.spells.pop();
    const duplicate = fiend(); duplicate.spells[1] = duplicate.spells[0];
    const wrongTier = fiend(); wrongTier.spells[0].prerequisites[0].index = "warlock-3";
    const wrongParent = fiend(); wrongParent.class.index = "cleric";
    const wrongPrerequisite = fiend(); wrongPrerequisite.spells[0].prerequisites[0].type = "feature";
    const conditional = fiend(); conditional.spells[0].prerequisites.push({ type: "feature", index: "unearned" });
    const foreignLevel = fiend(); foreignLevel.spells[0].prerequisites[0].index = "bard-1";
    for (const changed of [missing, duplicate, wrongTier, wrongParent, wrongPrerequisite, conditional, foreignLevel]) {
      expect(() => subclassSpellMetadata(changed)).toThrow("genuine SRD Fiend expanded spell list");
    }
  });
  it("preserves Life grants and excludes conditional Land edges from unconditional grants", () => {
    const life = { index: "life", class: { index: "cleric", name: "Cleric" }, spells: [
      { spell: { index: "bless", name: "Bless" }, prerequisites: [{ type: "level", index: "cleric-1" }] },
    ] };
    expect(subclassSpellMetadata(life)).toEqual({ spellcastingExtra: [{ level: 1, spells: ["bless"] }] });
    const land = { index: "land", class: { index: "druid", name: "Druid" }, spells: [
      { spell: { index: "spider-climb", name: "Spider Climb" }, prerequisites: [
        { type: "level", index: "druid-3" }, { type: "feature", index: "circle-of-the-land-forest" },
      ] },
    ] };
    expect(subclassSpellMetadata(land)).toEqual({});
  });
  it("refuses duplicate, blank and ambiguous expanded tiers at the immutable schema boundary", () => {
    for (const spellcastingExpanded of [[], [{ level: 0, spells: ["original"] }], [{ level: 1, spells: [] }],
      [{ level: 1, spells: [" "] }], [{ level: 1, spells: [" original "] }], [{ level: 1, spells: ["same", "same"] }],
      [{ level: 1, spells: ["one"] }, { level: 1, spells: ["two"] }],
      [{ level: 1, spells: ["same"] }, { level: 3, spells: ["same"] }]]) {
      expect(subclassDataSchema.safeParse({ ...data(), spellcastingExpanded }).success).toBe(false);
    }
  });
  it("requires every expanded spell dependency before catalog publication", () => {
    const parent = originalParent("warlock").content_definitions;
    expect(() => validateSrdCatalog([
      { content_type: "class", slug: parent.slug, name: parent.name, data: parent.data, effects: [] },
      { content_type: "subclass", slug: "fiend", name: "Fiend", data: data(), effects: [] },
    ])).toThrow("Missing SRD dependency: subclass/fiend -> spell/burning-hands");
  });
});
