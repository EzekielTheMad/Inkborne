import { describe, it, expect } from "vitest";
import { raceDataSchema } from "@/lib/schemas/content-types/race";
import { subraceDataSchema } from "@/lib/schemas/content-types/subrace";
import { traitDataSchema } from "@/lib/schemas/content-types/trait";
import { languageDataSchema } from "@/lib/schemas/content-types/language";
import { proficiencyDataSchema } from "@/lib/schemas/content-types/proficiency";
import { featureDataSchema } from "@/lib/schemas/content-types/feature";
import { getContentTypeSchema } from "@/lib/schemas/content-types/index";

describe("Race Data Schema", () => {
  it("validates a complete race entry", () => {
    const result = raceDataSchema.safeParse({
      size: "Medium",
      speed: 30,
      age_description: "Elves reach maturity around 100",
      alignment_description: "Elves tend toward chaotic good",
      size_description: "Elves range from 5 to 6 feet",
      language_description: "You can speak Common and Elvish",
      traits: ["darkvision", "fey-ancestry"],
      subraces: ["high-elf"],
      languages: ["common", "elvish"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects race with invalid size", () => {
    const result = raceDataSchema.safeParse({
      size: "Enormous",
      speed: 30,
      traits: [],
      subraces: [],
      languages: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("Subrace Data Schema", () => {
  it("validates a subrace entry", () => {
    const result = subraceDataSchema.safeParse({
      parent_race: "elf",
      description: "High elves have a keen mind",
      traits: ["elf-weapon-training"],
      languages: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("Trait Data Schema", () => {
  it("validates a trait entry", () => {
    const result = traitDataSchema.safeParse({
      description: "You can see in dim light within 60 feet",
      races: ["elf", "dwarf"],
      subraces: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("Language Data Schema", () => {
  it("validates a language entry", () => {
    const result = languageDataSchema.safeParse({
      type: "Standard",
      script: "Elvish",
      typical_speakers: ["Elves"],
      description: "The language of the elves",
    });
    expect(result.success).toBe(true);
  });
});

describe("Proficiency Data Schema", () => {
  it("validates a proficiency entry", () => {
    const result = proficiencyDataSchema.safeParse({
      proficiency_type: "skill",
      reference: "acrobatics",
      classes: ["rogue"],
      races: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("Feature Data Schema", () => {
  it("validates a class feature entry", () => {
    const result = featureDataSchema.safeParse({
      class: "wizard",
      subclass: null,
      level: 2,
      description: "You learn to regain some magical energy",
    });
    expect(result.success).toBe(true);
  });

  it("validates a subclass feature", () => {
    const result = featureDataSchema.safeParse({
      class: "bard",
      subclass: "lore",
      level: 3,
      description: "You learn additional spells",
    });
    expect(result.success).toBe(true);
  });
});

describe("Schema Registry", () => {
  it("returns race schema for 'race' content type", () => {
    const schema = getContentTypeSchema("race");
    expect(schema).toBeDefined();
  });

  it("returns undefined for unknown content type", () => {
    const schema = getContentTypeSchema("unknown_type");
    expect(schema).toBeUndefined();
  });
});
