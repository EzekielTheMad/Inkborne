import { describe, it, expect } from "vitest";
import { transformClassEntry } from "@/scripts/transformers/classes";

describe("transformClassEntry", () => {
  it("transforms a non-caster class (Fighter)", () => {
    const apiClass = {
      index: "fighter",
      name: "Fighter",
      hit_die: 10,
      proficiency_choices: [{
        choose: 2,
        from: { options: [
          { item: { index: "skill-athletics", name: "Athletics" } },
          { item: { index: "skill-acrobatics", name: "Acrobatics" } },
          { item: { index: "skill-history", name: "History" } },
        ] },
      }],
      proficiencies: [
        { index: "all-armor", name: "All armor" },
        { index: "shields", name: "Shields" },
      ],
      saving_throws: [{ index: "str", name: "STR" }, { index: "con", name: "CON" }],
      starting_equipment: [],
      starting_equipment_options: [],
      subclasses: [{ index: "champion", name: "Champion" }],
      spellcasting: undefined,
      multi_classing: {
        prerequisites: [{ ability_score: { index: "str", name: "STR" }, minimum_score: 13 }],
        proficiencies: [{ index: "light-armor", name: "Light armor" }],
      },
    };
    const apiLevels = [
      { level: 1, ability_score_bonuses: 0, prof_bonus: 2, features: [{ index: "fighting-style", name: "Fighting Style" }], spellcasting: undefined, class_specific: {} },
      { level: 2, ability_score_bonuses: 0, prof_bonus: 2, features: [{ index: "action-surge", name: "Action Surge" }], spellcasting: undefined, class_specific: {} },
      { level: 3, ability_score_bonuses: 0, prof_bonus: 2, features: [], spellcasting: undefined, class_specific: {}, subclass: { index: "champion" } },
    ];

    const result = transformClassEntry(apiClass, apiLevels);
    expect(result.slug).toBe("fighter");
    expect(result.data.hit_die).toBe(10);
    expect(result.data.spellcasting).toBeNull();
    expect(result.data.saving_throws).toEqual(["strength", "constitution"]);
    const multiclass = result.data.multiclass as { prerequisites: unknown[]; proficiencies_gained: string[] };
    expect(multiclass.prerequisites).toEqual([
      { stat: "strength", op: "gte", value: 13 },
    ]);
    const levels = result.data.levels as Array<{ level: number; features: string[]; subclass_level?: boolean }>;
    expect(levels).toHaveLength(3);
    expect(levels[0].features).toContain("fighting-style");
    expect(levels[2].subclass_level).toBe(true);

    const choiceEffects = result.effects.filter((e) => e.type === "choice");
    expect(choiceEffects.length).toBeGreaterThan(0);
  });
});
