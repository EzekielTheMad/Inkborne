import { describe, expect, it } from "vitest";

import { buildCharacterStructuredSources } from "@/lib/character/structured-sources";
import { evaluate } from "@/lib/engine/evaluator";
import type { SystemSchemaDefinition } from "@/lib/types/system";

describe("buildCharacterStructuredSources", () => {
  it("uses each earned class level for Extra Attack instead of the combined character level", () => {
    const attacks = Array.from({ length: 20 }, (_, index) => index < 4 ? 1 : index < 10 ? 2 : 3);
    const refs = [{ content_id: "fighter-pin", content_version: 1, content_definitions: {
      id: "fighter-pin", version: 1, content_type: "class", slug: "fighter", data: { attacks } } },
    { content_id: "cleric-pin", content_version: 1, content_definitions: {
      id: "cleric-pin", version: 1, content_type: "class", slug: "cleric", data: { attacks: Array(20).fill(1) } } }];
    const schema = { ability_scores: [], derived_stats: [], skills: [], proficiency_levels: [], resources: [],
      content_types: [], currencies: [], creation_steps: [], sheet_sections: [] } as SystemSchemaDefinition;
    const run = (fighterLevel: number, clericLevel: number) => {
      const level = fighterLevel + clericLevel;
      const sources = buildCharacterStructuredSources(refs, level, { character: { id: "target", system_id: "system", level,
        choices: { classes: [{ slug: "cleric", level: clericLevel }, { slug: "fighter", level: fighterLevel }] } } });
      return evaluate({}, [], schema, sources).attacks;
    };
    expect(run(4, 1)).toBe(1);
    expect(run(5, 5)).toBe(2);
    expect(run(10, 1)).toBe(2);
    expect(run(11, 1)).toBe(3);
  });
  it("includes both class features and feats in live structured calculations", () => {
    const sources = buildCharacterStructuredSources([
      { content_definitions: { content_type: "race", data: { speed: 30 } } },
      { content_definitions: { content_type: "class", data: { attacks: [1] } } },
      { content_definitions: { content_type: "feature", data: { speed: { walk: 5 } } } },
      {
        content_definitions: {
          content_type: "feat",
          data: {
            vision: [{ type: "darkvision", range: 60 }],
            dmgres: ["fire"],
          },
        },
      },
      { content_definitions: { content_type: "spell", data: { level: 1 } } },
    ], 5);

    expect(sources).toEqual({
      ancestryDefenses: { status: "unavailable", reason: "incomplete_evidence" },
      raceData: { speed: 30 },
      classData: { attacks: [1] },
      featureData: [
        { speed: { walk: 5 } },
        { vision: [{ type: "darkvision", range: 60 }], dmgres: ["fire"] },
      ],
      level: 5,
    });
  });
});
