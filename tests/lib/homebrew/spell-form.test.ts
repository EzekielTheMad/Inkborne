import { describe, expect, it } from "vitest";

import { mapHomebrewSpellFormData } from "@/lib/homebrew/spell-form";
import { spellDataSchema } from "@/lib/schemas/content-types/spell";

const SYSTEM_ID = "22222222-2222-4222-8222-222222222222";

function validForm(overrides: Record<string, string | string[]> = {}): FormData {
  const values: Record<string, string | string[]> = {
    system_id: SYSTEM_ID,
    name: " Arcane Burst ",
    level: "2",
    school: "evocation",
    casting_time: " 1 action ",
    range: " 60 feet ",
    components: ["V", "S"],
    material: "",
    duration: " Instantaneous ",
    concentration: "on",
    ritual: "",
    description: " A focused burst of arcane power. ",
    higher_level: "",
    attack_type: "ranged",
    damage_type: "force",
    damage_dice: "2d6 + 3",
    healing_dice: "",
    save_type: "dexterity",
    save_success: "half",
    area_type: "",
    area_size: "",
    classes: ["wizard"],
    ...overrides,
  };
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (entry !== "") formData.append(key, entry);
    }
  }

  return formData;
}

describe("mapHomebrewSpellFormData", () => {
  it("normalizes authored fields and finishes at the canonical spell schema", () => {
    const result = mapHomebrewSpellFormData(validForm({
      components: ["v, s", "V"],
      classes: [" Wizard ", "wizard", "Cleric"],
    }));

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toEqual({
      systemId: SYSTEM_ID,
      name: "Arcane Burst",
      data: expect.objectContaining({
        level: 2,
        school: "evocation",
        casting_time: "1 action",
        range: "60 feet",
        components: ["V", "S"],
        concentration: true,
        ritual: false,
        description: "A focused burst of arcane power.",
        attack_type: "ranged",
        damage: {
          type: "force",
          dice_at_slot_level: { "2": "2d6 + 3" },
        },
        dc: { type: "dexterity", success: "half" },
        classes: ["wizard", "cleric"],
        subclasses: [],
        dependencies: [],
      }),
    });
    expect(result.data.data).not.toHaveProperty("material");
    expect(result.data.data).not.toHaveProperty("higher_level");
    expect(spellDataSchema.safeParse(result.data.data).success).toBe(true);
  });

  it("uses slot 1 for a cantrip's single base damage and healing rows", () => {
    const result = mapHomebrewSpellFormData(validForm({
      level: "0",
      damage_dice: "1d10",
      healing_dice: "1d8 + MOD",
    }));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.data.damage?.dice_at_slot_level).toEqual({ "1": "1d10" });
    expect(result.data.data.heal_at_slot_level).toEqual({ "1": "1d8 + MOD" });
  });

  it("accepts whole-word MOD for authored healing while rejecting other identifiers", () => {
    expect(
      mapHomebrewSpellFormData(validForm({ healing_dice: "2d8+MOD" })).success,
    ).toBe(true);

    const invalid = mapHomebrewSpellFormData(
      validForm({ healing_dice: "2d8+ABILITY" }),
    );
    expect(invalid).toEqual(expect.objectContaining({
      success: false,
      fieldErrors: { healing_dice: [expect.stringContaining("valid dice expression")] },
    }));
  });

  it("requires both a component and at least one class", () => {
    const result = mapHomebrewSpellFormData(
      validForm({ components: [], classes: [] }),
    );

    expect(result).toEqual(expect.objectContaining({
      success: false,
      fieldErrors: expect.objectContaining({
        components: expect.any(Array),
        classes: expect.any(Array),
      }),
    }));
  });

  it("requires material text for M and discards material text when M is absent", () => {
    const missing = mapHomebrewSpellFormData(
      validForm({ components: ["V", "M"], material: "" }),
    );
    expect(missing).toEqual(expect.objectContaining({
      success: false,
      fieldErrors: expect.objectContaining({ material: expect.any(Array) }),
    }));

    const discarded = mapHomebrewSpellFormData(
      validForm({ components: ["V"], material: "a pearl worth 100 gp" }),
    );
    expect(discarded.success).toBe(true);
    if (discarded.success) expect(discarded.data.data).not.toHaveProperty("material");
  });

  it("requires damage dice when a damage type is selected", () => {
    const result = mapHomebrewSpellFormData(validForm({ damage_dice: "" }));
    expect(result).toEqual(expect.objectContaining({
      success: false,
      fieldErrors: expect.objectContaining({ damage_dice: expect.any(Array) }),
    }));
  });

  it("rejects malformed authored damage dice", () => {
    const result = mapHomebrewSpellFormData(
      validForm({ damage_dice: "200d6" }),
    );
    expect(result).toEqual(expect.objectContaining({
      success: false,
      fieldErrors: expect.objectContaining({ damage_dice: expect.any(Array) }),
    }));
  });

  it("maps a complete area and rejects either half on its own", () => {
    const complete = mapHomebrewSpellFormData(
      validForm({ area_type: "sphere", area_size: "20" }),
    );
    expect(complete.success).toBe(true);
    if (complete.success) {
      expect(complete.data.data.area_of_effect).toEqual({ type: "sphere", size: 20 });
    }

    const missingSize = mapHomebrewSpellFormData(
      validForm({ area_type: "cone", area_size: "" }),
    );
    expect(missingSize).toEqual(expect.objectContaining({
      success: false,
      fieldErrors: expect.objectContaining({ area_size: expect.any(Array) }),
    }));
  });

  it("returns form-keyed errors for missing required authored fields", () => {
    const result = mapHomebrewSpellFormData(validForm({
      name: "",
      casting_time: "",
      range: "",
      duration: "",
      description: "",
    }));

    expect(result).toEqual(expect.objectContaining({
      success: false,
      fieldErrors: expect.objectContaining({
        name: expect.any(Array),
        casting_time: expect.any(Array),
        range: expect.any(Array),
        duration: expect.any(Array),
        description: expect.any(Array),
      }),
    }));
  });
});
