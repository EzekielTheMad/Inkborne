import { describe, expect, it } from "vitest";

import { mapHomebrewBackgroundFormData } from "@/lib/homebrew/background-form";
import { backgroundDataSchema } from "@/lib/schemas/content-types/background";
import { effectSchema } from "@/lib/schemas/effects";

type FormValue = string | string[];

function validForm(overrides: Record<string, FormValue> = {}): FormData {
  const values: Record<string, FormValue> = {
    name: "  Lantern Warden  ",
    feature_name: "  Safe Harbor  ",
    feature_description: "  You can find sanctuary among fellow wardens.  ",
    skills: ["Insight", "persuasion, Insight"],
    tool_profs: "Cartographer's Tools\nHerbalism Kit, herbalism-kit",
    fixed_languages: ["Elvish", "Dwarvish, elvish"],
    language_choice_count: "2",
    gold: "15",
    equipment: "  A traveler's cloak, a lantern, and a map case.  ",
    personality_traits: "I always mark the safe road.\nI share my fire with strangers.",
    // Ideals use one line per ideal: `ideal text | optional alignment`.
    ideals: "Community. No traveler should stand alone. | Good\nDiscovery comes before comfort.",
    bonds: "I owe my life to the keeper of an old waystation.",
    flaws: "I assume every mystery is mine to solve.",
    ...overrides,
  };
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) formData.append(key, item);
  }
  return formData;
}

describe("mapHomebrewBackgroundFormData", () => {
  it("builds canonical background data and validated server-derived effects", () => {
    const result = mapHomebrewBackgroundFormData(validForm());

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toEqual({
      name: "Lantern Warden",
      data: {
        feature: {
          name: "Safe Harbor",
          description: "You can find sanctuary among fellow wardens.",
        },
        personality_traits: [
          "I always mark the safe road.",
          "I share my fire with strangers.",
        ],
        ideals: [
          { text: "Community. No traveler should stand alone.", alignment: "Good" },
          { text: "Discovery comes before comfort.", alignment: "" },
        ],
        bonds: ["I owe my life to the keeper of an old waystation."],
        flaws: ["I assume every mystery is mine to solve."],
        skills: ["insight", "persuasion"],
        gold: 15,
        languageProfs: ["elvish", "dwarvish", { choose: 2, from: "any" }],
        toolProfs: ["cartographers-tools", "herbalism-kit"],
        equipment: "A traveler's cloak, a lantern, and a map case.",
        variant: null,
        source_refs: [],
      },
      effects: [
        {
          type: "narrative",
          text: "Safe Harbor: You can find sanctuary among fellow wardens.",
          tag: "Background Feature",
        },
        { type: "grant", stat: "insight", value: "proficient" },
        { type: "grant", stat: "persuasion", value: "proficient" },
        { type: "grant", stat: "cartographers-tools", value: "proficient" },
        { type: "grant", stat: "herbalism-kit", value: "proficient" },
        { type: "grant", stat: "elvish", value: "proficient" },
        { type: "grant", stat: "dwarvish", value: "proficient" },
        {
          type: "choice",
          choose: 2,
          from: "any",
          grant_type: "language",
          choice_id: "background-lantern-warden-languages",
        },
      ],
    });
    expect(backgroundDataSchema.safeParse(result.data.data).success).toBe(true);
    expect(result.data.effects.every((effect) => effectSchema.safeParse(effect).success)).toBe(true);
  });

  it("uses canonical defaults and omits optional grants", () => {
    const result = mapHomebrewBackgroundFormData(validForm({
      skills: "",
      tool_profs: "",
      fixed_languages: "",
      language_choice_count: "0",
      gold: "",
      equipment: "",
      personality_traits: "",
      ideals: "",
      bonds: "",
      flaws: "",
    }));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.data).toEqual({
      feature: {
        name: "Safe Harbor",
        description: "You can find sanctuary among fellow wardens.",
      },
      personality_traits: [],
      ideals: [],
      bonds: [],
      flaws: [],
      skills: [],
      languageProfs: [],
      toolProfs: [],
      equipment: "",
      variant: null,
      source_refs: [],
    });
    expect(result.data.effects).toEqual([
      expect.objectContaining({ type: "narrative", tag: "Background Feature" }),
    ]);
  });

  it("documents newline-delimited ideal syntax with an optional alignment", () => {
    const result = mapHomebrewBackgroundFormData(validForm({
      ideals: [
        "Freedom. Chains are meant to be broken. | Chaotic",
        "People matter more than rules.",
      ],
    }));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.data.ideals).toEqual([
      { text: "Freedom. Chains are meant to be broken.", alignment: "Chaotic" },
      { text: "People matter more than rules.", alignment: "" },
    ]);
  });

  it("returns form-keyed errors for required, bounded, and finite fields", () => {
    const result = mapHomebrewBackgroundFormData(validForm({
      name: "",
      feature_name: "",
      feature_description: "",
      skills: "not-a-real-skill",
      language_choice_count: "11",
      gold: "-1",
    }));

    expect(result).toEqual(expect.objectContaining({
      success: false,
      fieldErrors: expect.objectContaining({
        name: expect.any(Array),
        feature_name: expect.any(Array),
        feature_description: expect.any(Array),
        skills: expect.any(Array),
        language_choice_count: expect.any(Array),
        gold: expect.any(Array),
      }),
    }));
  });

  it("rejects empty ideal text while keying the error to ideals", () => {
    const result = mapHomebrewBackgroundFormData(validForm({
      ideals: "| Neutral",
    }));

    expect(result).toEqual(expect.objectContaining({
      success: false,
      fieldErrors: expect.objectContaining({ ideals: expect.any(Array) }),
    }));
  });

  it("ignores arbitrary envelopes, ownership, and submitted effects", () => {
    const form = validForm();
    form.set("owner_id", "attacker");
    form.set("scope", "public");
    form.set("data", JSON.stringify({ gold: 999_999 }));
    form.set(
      "effects",
      JSON.stringify([{ type: "mechanical", stat: "armor_class", op: "add", value: 99 }]),
    );

    const result = mapHomebrewBackgroundFormData(form);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).not.toHaveProperty("owner_id");
    expect(result.data).not.toHaveProperty("scope");
    expect(result.data.data.gold).toBe(15);
    expect(result.data.effects).not.toContainEqual(expect.objectContaining({ value: 99 }));
  });
});
