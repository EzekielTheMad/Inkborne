import { describe, expect, it } from "vitest";

import { mapHomebrewFeatFormData } from "@/lib/homebrew/feat-form";
import { featDataSchema } from "@/lib/schemas/content-types/feat";
import { effectSchema } from "@/lib/schemas/effects";

function validForm(overrides: Record<string, string> = {}): FormData {
  const values = {
    name: "  Flame-Touched Adept  ",
    description: "  You have learned to endure and direct elemental flame.  ",
    prerequisite_ability: "dexterity",
    prerequisite_minimum: "13",
    ability_strength: "0",
    ability_dexterity: "1",
    ability_constitution: "0",
    ability_intelligence: "0",
    ability_wisdom: "0",
    ability_charisma: "0",
    action: "bonus action",
    usages: "2",
    recovery: "long rest",
    extra_ac: "1",
    ...overrides,
  };
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

describe("mapHomebrewFeatFormData", () => {
  it("builds canonical feat data and server-derived effects from named fields", () => {
    const result = mapHomebrewFeatFormData(validForm());

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toEqual({
      name: "Flame-Touched Adept",
      data: expect.objectContaining({
        description: "You have learned to endure and direct elemental flame.",
        prerequisites: [{ stat: "dexterity", op: "gte", value: 13 }],
        scores: [0, 1, 0, 0, 0, 0],
        action: "bonus action",
        usages: 2,
        recovery: "long rest",
        extraAC: 1,
        vision: [],
        dmgres: [],
        spellcastingBonus: [],
      }),
      effects: [
        { type: "narrative", text: "You have learned to endure and direct elemental flame.", tag: "Feat" },
        { type: "mechanical", stat: "dexterity", op: "add", value: 1 },
        { type: "mechanical", stat: "armor_class", op: "add", value: 1 },
      ],
    });
    expect(featDataSchema.safeParse(result.data.data).success).toBe(true);
    expect(result.data.effects.every((effect) => effectSchema.safeParse(effect).success)).toBe(true);
  });

  it("uses defaults and omits zero-only authored mechanics", () => {
    const result = mapHomebrewFeatFormData(validForm({
      prerequisite_ability: "",
      prerequisite_minimum: "",
      ability_dexterity: "0",
      action: "",
      usages: "",
      recovery: "",
      extra_ac: "0",
    }));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.data).toEqual(expect.objectContaining({
      prerequisites: [],
      action: null,
      recovery: null,
    }));
    expect(result.data.data).not.toHaveProperty("scores");
    expect(result.data.data).not.toHaveProperty("usages");
    expect(result.data.data).not.toHaveProperty("extraAC");
    expect(result.data.effects).toEqual([
      expect.objectContaining({ type: "narrative", tag: "Feat" }),
    ]);
  });

  it("requires paired prerequisites and paired usage recovery fields", () => {
    const missingPrerequisite = mapHomebrewFeatFormData(validForm({ prerequisite_minimum: "" }));
    expect(missingPrerequisite).toEqual(expect.objectContaining({
      success: false,
      fieldErrors: expect.objectContaining({ prerequisite_minimum: expect.any(Array) }),
    }));

    const missingRecovery = mapHomebrewFeatFormData(validForm({ recovery: "" }));
    expect(missingRecovery).toEqual(expect.objectContaining({
      success: false,
      fieldErrors: expect.objectContaining({ recovery: expect.any(Array) }),
    }));
  });

  it("enforces bounded named fields and ignores malicious envelope values", () => {
    const invalid = mapHomebrewFeatFormData(validForm({
      ability_strength: "6",
      extra_ac: "11",
    }));
    expect(invalid).toEqual(expect.objectContaining({
      success: false,
      fieldErrors: expect.objectContaining({
        ability_strength: expect.any(Array),
        extra_ac: expect.any(Array),
      }),
    }));

    const form = validForm();
    form.set("owner_id", "attacker");
    form.set("scope", "public");
    form.set("effects", '[{"type":"mechanical","stat":"armor_class","op":"add","value":99}]');
    form.set("data", '{"extraAC":99}');
    const result = mapHomebrewFeatFormData(form);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).not.toHaveProperty("owner_id");
    expect(result.data).not.toHaveProperty("scope");
    expect(result.data.effects).not.toContainEqual(expect.objectContaining({ value: 99 }));
  });

  it("returns form-keyed errors for missing required fields", () => {
    const result = mapHomebrewFeatFormData(validForm({ name: "", description: "" }));
    expect(result).toEqual(expect.objectContaining({
      success: false,
      fieldErrors: expect.objectContaining({
        name: expect.any(Array),
        description: expect.any(Array),
      }),
    }));
  });
});
