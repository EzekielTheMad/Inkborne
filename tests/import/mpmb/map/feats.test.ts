// @vitest-environment node

import { describe, expect, it } from "vitest";

import { mapMpmbFeat } from "@/lib/import/mpmb/map/feats";
import {
  createMpmbSourceIndex,
  mapMpmbSources,
} from "@/lib/import/mpmb/map/sources";
import type { MpmbParsedEntry, MpmbStaticObject } from "@/lib/import/mpmb/types";
import { featDataSchema } from "@/lib/schemas/content-types/feat";
import { effectSchema } from "@/lib/schemas/effects";

function entry(
  key: string,
  data: MpmbStaticObject,
  registry: MpmbParsedEntry["registry"] = "FeatsList",
): MpmbParsedEntry {
  return { registry, key, data, location: { line: 12, column: 3 } };
}

const source = entry(
  "IBX",
  { name: "Inkborne Examples", abbreviation: "IBX" },
  "SourceList",
);
const context = {
  sourcesByKey: createMpmbSourceIndex(mapMpmbSources([source])),
};

function validFeat(overrides: MpmbStaticObject = {}): MpmbParsedEntry {
  return entry("steadfast adept", {
    name: "Steadfast Adept",
    source: ["IBX", 7],
    description: {
      type: "mpmb-helper",
      name: "desc",
      arguments: [["First line", "Second line"]],
    },
    prerequisite: "Wisdom 13 or higher",
    scores: [0, 1, 0, 0, 1, 0],
    scoresMaximum: [20, 22, 20, 20, 22, 20],
    scorestxt: "Increase Dexterity and Wisdom by 1.",
    action: ["bonus action", ""],
    usages: 2,
    recovery: "long rest",
    speed: { walk: 5 },
    vision: [["Darkvision", 60]],
    dmgres: ["Fire"],
    savetxt: { adv_vs: ["Charmed"], immune: ["Magical sleep"] },
    skills: ["Perception"],
    skillstxt: "You gain Perception proficiency.",
    weaponProfs: ["Longsword"],
    armorProfs: ["Light armor"],
    toolProfs: ["Herbalism kit", ["Artisan tools", 1]],
    languageProfs: ["Elvish", 1],
    extraAC: { mod: 1 },
    spellcastingAbility: "Wis",
    spellcastingBonus: [{ name: "Adept magic", spells: ["guidance"] }],
    extraLimitedFeatures: [
      { name: "Steadfast Focus", usages: 1, recovery: "short rest" },
    ],
    calcChanges: [
      { target: "atkAdd", description: "Static attack note", value: 1 },
    ],
    addMod: [{ type: "save", field: "Wis", mod: 1, text: "Adept" }],
    ...overrides,
  });
}

const safeRepairCases: Array<{
  label: string;
  overrides: MpmbStaticObject;
  issueCode: string;
  expectedData: Record<string, unknown>;
  missingDataKey?: string;
}> = [
  {
    label: "action",
    overrides: { action: "instant" },
    issueCode: "feat.action.invalid",
    expectedData: { action: null },
  },
  {
    label: "recovery",
    overrides: { recovery: "turn" },
    issueCode: "feat.recovery.invalid",
    expectedData: { recovery: null },
  },
  {
    label: "spellcasting ability",
    overrides: { spellcastingAbility: "Luck" },
    issueCode: "feat.spellcastingAbility.invalid",
    expectedData: {},
    missingDataKey: "spellcastingAbility",
  },
];

describe("MPMB feat mapping", () => {
  it("creates a schema-valid candidate and schema-valid narrative/mechanical effects", () => {
    const mapped = mapMpmbFeat(validFeat(), context);

    expect(mapped.status).toBe("valid");
    expect(mapped.sourceRefs).toEqual([{ book: "IBX", page: 7 }]);
    expect(mapped.candidate).toMatchObject({
      content_type: "feat",
      slug: "steadfast-adept",
      name: "Steadfast Adept",
      data: {
        description: "First line\nSecond line",
        prerequisites: [{ stat: "wisdom", op: "gte", value: 13 }],
        scores: [0, 1, 0, 0, 1, 0],
        action: "bonus action",
        vision: [{ type: "darkvision", range: 60 }],
        spellcastingAbility: "wisdom",
      },
    });
    expect(featDataSchema.safeParse(mapped.candidate?.data).success).toBe(true);
    expect(mapped.candidate?.effects.every((effect) => effectSchema.safeParse(effect).success)).toBe(true);
    expect(mapped.candidate?.effects).toEqual([
      { type: "narrative", text: "First line\nSecond line", tag: "Feat" },
      { type: "mechanical", stat: "dexterity", op: "add", value: 1 },
      { type: "mechanical", stat: "wisdom", op: "add", value: 1 },
      { type: "mechanical", stat: "armor_class", op: "add", value: 1 },
    ]);
  });

  it("requires information for compound prerequisites", () => {
    const mapped = mapMpmbFeat(
      validFeat({ prerequisite: "Strength 13 or Dexterity 13" }),
      context,
    );

    expect(mapped.status).toBe("needs_info");
    expect(mapped.candidate).toMatchObject({
      content_type: "feat",
      data: { prerequisites: [] },
    });
    expect(featDataSchema.safeParse(mapped.candidate?.data).success).toBe(true);
    expect(mapped.issues).toContainEqual(
      expect.objectContaining({
        code: "feat.prerequisite.compound",
        severity: "blocking",
      }),
    );
  });

  it("retains a safe candidate for an unsupported prerequisite", () => {
    const mapped = mapMpmbFeat(
      validFeat({ prerequisite: "13th-level fighter" }),
      context,
    );

    expect(mapped.status).toBe("needs_info");
    expect(mapped.candidate).toMatchObject({
      content_type: "feat",
      data: { prerequisites: [] },
    });
    expect(mapped.issues).toContainEqual(
      expect.objectContaining({
        code: "feat.prerequisite.unsupported",
        severity: "blocking",
      }),
    );
  });

  it("rejects rather than truncating MPMB seven-score arrays", () => {
    const mapped = mapMpmbFeat(
      validFeat({ scores: [1, 0, 0, 0, 0, 0, 1] }),
      context,
    );

    expect(mapped.status).toBe("needs_info");
    expect(mapped.candidate?.content_type).toBe("feat");
    expect(mapped.candidate?.data).not.toHaveProperty("scores");
    expect(mapped.issues).toContainEqual(
      expect.objectContaining({
        code: "feat.scores.seventh_ability_unsupported",
        severity: "blocking",
      }),
    );
  });

  it.each(safeRepairCases)(
    "retains a schema-valid candidate when $label needs repair",
    ({ overrides, issueCode, expectedData, missingDataKey }) => {
      const mapped = mapMpmbFeat(validFeat(overrides), context);

      expect(mapped.status).toBe("needs_info");
      expect(mapped.candidate).toMatchObject({
        content_type: "feat",
        data: expectedData,
      });
      expect(featDataSchema.safeParse(mapped.candidate?.data).success).toBe(true);
      if (missingDataKey) {
        expect(mapped.candidate?.data).not.toHaveProperty(missingDataKey);
      }
      expect(mapped.issues).toContainEqual(
        expect.objectContaining({ code: issueCode, severity: "blocking" }),
      );
    },
  );

  it("does not retain a candidate when the required description is missing", () => {
    const mapped = mapMpmbFeat(
      validFeat({ description: undefined as never }),
      context,
    );

    expect(mapped.status).toBe("needs_info");
    expect(mapped.candidate).toBeNull();
    expect(mapped.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "feat.description.required",
          severity: "blocking",
        }),
        expect.objectContaining({
          code: "feat.schema.description",
          severity: "blocking",
        }),
      ]),
    );
  });

  it("normalizes an action tuple and warns when its label is lossy", () => {
    const mapped = mapMpmbFeat(
      validFeat({ action: ["reaction", "Steadfast Retort"] }),
      context,
    );

    expect(mapped.status).toBe("valid");
    expect(mapped.candidate?.content_type).toBe("feat");
    if (mapped.candidate?.content_type === "feat") {
      expect(mapped.candidate.data.action).toBe("reaction");
    }
    expect(mapped.issues).toContainEqual(
      expect.objectContaining({
        code: "feat.action.label_lossy",
        kind: "lossy_normalization",
      }),
    );
  });

  it("retains a tool proficiency while diagnosing its lossy ability tuple", () => {
    const mapped = mapMpmbFeat(
      validFeat({ toolProfs: [["Thieves' tools", "Dex"]] }),
      context,
    );

    expect(mapped.status).toBe("valid");
    expect(mapped.candidate?.content_type).toBe("feat");
    if (mapped.candidate?.content_type === "feat") {
      expect(mapped.candidate.data.toolProfs).toEqual(["thieves' tools"]);
    }
    expect(mapped.issues).toContainEqual(
      expect.objectContaining({
        code: "feat.toolProfs.0.ability_lossy",
        kind: "lossy_normalization",
      }),
    );
  });

  it("maps extraAC to both feat data and an armor-class effect", () => {
    const mapped = mapMpmbFeat(validFeat({ extraAC: { mod: 2 } }), context);

    expect(mapped.candidate?.content_type).toBe("feat");
    if (mapped.candidate?.content_type === "feat") {
      expect(mapped.candidate.data.extraAC).toBe(2);
      expect(mapped.candidate.effects).toContainEqual({
        type: "mechanical",
        stat: "armor_class",
        op: "add",
        value: 2,
      });
    }
  });

  it("diagnoses unknown fields before validation without copying them", () => {
    const mapped = mapMpmbFeat(validFeat({ mysteryMechanic: 42 }), context);

    expect(mapped.status).toBe("valid");
    expect(mapped.issues).toContainEqual(
      expect.objectContaining({ code: "unmapped.mysteryMechanic" }),
    );
    expect(mapped.candidate?.data).not.toHaveProperty("mysteryMechanic");
  });

  it("is deterministic and does not mutate parser output", () => {
    const input = validFeat();
    const before = structuredClone(input);

    const first = mapMpmbFeat(input, context);
    const second = mapMpmbFeat(input, context);

    expect(first).toEqual(second);
    expect(input).toEqual(before);
  });
});
