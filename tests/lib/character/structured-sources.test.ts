import { describe, expect, it } from "vitest";

import { buildCharacterStructuredSources } from "@/lib/character/structured-sources";

describe("buildCharacterStructuredSources", () => {
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
