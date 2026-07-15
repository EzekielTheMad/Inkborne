import { describe, it, expect } from "vitest";
import {
  classFeaturesPerLevel,
  buildRenderedPerLevel,
  type PerLevel,
} from "@/lib/builder/class-features-per-level";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { CharacterChoices } from "@/lib/types/character";

describe("buildRenderedPerLevel", () => {
  const rows: PerLevel[] = [
    { level: 1, features: [], choices: [] },
    { level: 2, features: [], choices: [] },
    { level: 3, features: [], choices: [] },
  ];

  it("returns rows up to the current level when not mid-flow", () => {
    expect(buildRenderedPerLevel(rows, 2, null).map((r) => r.level)).toEqual([1, 2]);
  });

  it("appends a placeholder draft row when the draft level is beyond current", () => {
    const result = buildRenderedPerLevel(rows, 1, 2);
    expect(result.map((r) => r.level)).toEqual([1, 2]);
    // The appended level-2 entry is the empty placeholder, not the real row.
    expect(result[result.length - 1]).toEqual({ level: 2, features: [], choices: [] });
  });

  it("does NOT append a duplicate level row during the confirm transition (draft === current)", () => {
    // Regression: on confirm, the persisted level bumps to the draft level a
    // render before the draft clears. Appending here would create two rows with
    // the same `level`, surfacing as React's duplicate-key warning in LevelRail.
    const levels = buildRenderedPerLevel(rows, 2, 2).map((r) => r.level);
    expect(levels).toEqual([1, 2]);
    expect(new Set(levels).size).toBe(levels.length);
  });
});

function feature(slug: string, name: string, level: number, classSlug: string, extras: Record<string, unknown> = {}): ContentEntry {
  return {
    id: `feat-${slug}`,
    slug,
    name,
    content_type: "feature",
    data: { level, class: classSlug, ...extras },
    effects: [],
    version: 1,
    source: "srd",
  };
}

function makeClass(): ContentEntry {
  return {
    id: "c-paladin",
    slug: "paladin",
    name: "Paladin",
    content_type: "class",
    data: {
      hit_die: 10,
      levels: [
        { level: 1, features: ["divine-sense"] },
        { level: 3, features: ["sacred-oath"] },
        { level: 4, features: ["paladin-asi-4"] },
      ],
    },
    effects: [],
    version: 1,
    source: "srd",
  };
}

describe("classFeaturesPerLevel", () => {
  const baseArgs = {
    classContent: makeClass(),
    features: [
      feature("divine-sense", "Divine Sense", 1, "paladin"),
      feature("sacred-oath", "Sacred Oath", 3, "paladin", { feature_type: "subclass" }),
      feature("paladin-asi-4", "Ability Score Improvement", 4, "paladin", { feature_type: "asi" }),
    ],
    subclassContent: null,
    characterChoices: {} as CharacterChoices,
    classIndex: 0,
  };

  it("returns per-level rows in level order", () => {
    const result = classFeaturesPerLevel(baseArgs);
    expect(result.map((r) => r.level)).toEqual([1, 3, 4]);
  });

  it("attaches passive features to their level row", () => {
    const result = classFeaturesPerLevel(baseArgs);
    expect(result[0].features.map((f) => f.slug)).toEqual(["divine-sense"]);
  });

  it("flags an unmade subclass choice on the level it gates", () => {
    const result = classFeaturesPerLevel(baseArgs);
    const lv3 = result.find((r) => r.level === 3)!;
    expect(lv3.choices).toEqual([
      expect.objectContaining({
        type: "subclass",
        classSlug: "paladin",
        label: "Sacred Oath",
        isMade: false,
      }),
    ]);
  });

  it("flags an unmade ASI choice on the level it gates", () => {
    const result = classFeaturesPerLevel(baseArgs);
    const lv4 = result.find((r) => r.level === 4)!;
    expect(lv4.choices).toEqual([
      expect.objectContaining({
        type: "asi",
        featureSlug: "paladin-asi-4",
        classSlug: "paladin",
        label: "Ability Score Improvement",
        isMade: false,
      }),
    ]);
  });

  it("marks subclass choice as made when characterChoices.classes[classIndex].subclass is set", () => {
    const result = classFeaturesPerLevel({
      ...baseArgs,
      characterChoices: {
        classes: [{ slug: "paladin", level: 5, subclass: "devotion" }],
      },
    });
    const lv3 = result.find((r) => r.level === 3)!;
    expect(lv3.choices[0].isMade).toBe(true);
  });

  it("marks ASI choice as made when asi_choices contains the feature slug", () => {
    const result = classFeaturesPerLevel({
      ...baseArgs,
      characterChoices: {
        asi_choices: {
          "paladin-asi-4": {
            mode: "asi",
            allocations: [{ ability: "strength", amount: 2 }],
          },
        },
      },
    });
    const lv4 = result.find((r) => r.level === 4)!;
    expect(lv4.choices[0].isMade).toBe(true);
  });

  it("merges subclass features into their level row when a subclass is provided", () => {
    const subclass: ContentEntry = {
      id: "sc-devotion",
      slug: "devotion",
      name: "Oath of Devotion",
      content_type: "subclass",
      data: {
        parent_class: "paladin",
        levels: [{ level: 3, features: ["cd-sacred-weapon"] }],
      },
      effects: [],
      version: 1,
      source: "srd",
    };
    const features = [
      ...baseArgs.features,
      feature("cd-sacred-weapon", "Channel Divinity: Sacred Weapon", 3, "paladin", { subclass: "devotion" }),
    ];
    const result = classFeaturesPerLevel({
      ...baseArgs,
      features,
      subclassContent: subclass,
      characterChoices: {
        classes: [{ slug: "paladin", level: 5, subclass: "devotion" }],
      },
    });
    const lv3 = result.find((r) => r.level === 3)!;
    expect(lv3.features.map((f) => f.slug)).toContain("cd-sacred-weapon");
  });

  it("flags an unmade fighting style choice using the parent feature slug", () => {
    const fighter: ContentEntry = {
      id: "c-fighter",
      slug: "fighter",
      name: "Fighter",
      content_type: "class",
      data: {
        hit_die: 10,
        levels: [{ level: 1, features: ["fighter-fighting-style"] }],
      },
      effects: [],
      version: 1,
      source: "srd",
    };
    const features = [
      feature("fighter-fighting-style", "Fighting Style", 1, "fighter", { feature_type: "fighting_style" }),
      feature("fighter-fs-archery", "Fighting Style: Archery", 1, "fighter", { feature_type: "fighting_style" }),
    ];
    const result = classFeaturesPerLevel({
      classContent: fighter,
      features,
      subclassContent: null,
      characterChoices: {},
      classIndex: 0,
    });
    const lv1 = result.find((r) => r.level === 1)!;
    expect(lv1.choices).toEqual([
      expect.objectContaining({
        type: "fighting-style",
        featureSlug: "fighter-fighting-style",
        isMade: false,
      }),
    ]);
  });

  it("includes a row for levels with no features and no choices (so the rail can navigate to them)", () => {
    const wizard: ContentEntry = {
      id: "c-wizard",
      slug: "wizard",
      name: "Wizard",
      content_type: "class",
      data: {
        hit_die: 6,
        levels: [
          { level: 1, features: ["arcane-recovery"] },
          { level: 2, features: ["arcane-tradition"] },
          { level: 3, features: [] }, // explicit empty level
        ],
      },
      effects: [],
      version: 1,
      source: "srd",
    };
    const features = [
      feature("arcane-recovery", "Arcane Recovery", 1, "wizard"),
      feature("arcane-tradition", "Arcane Tradition", 2, "wizard", { feature_type: "subclass" }),
    ];
    const result = classFeaturesPerLevel({
      classContent: wizard,
      features,
      subclassContent: null,
      characterChoices: {} as CharacterChoices,
      classIndex: 0,
    });
    // All three levels must be present in the result.
    expect(result.map((r) => r.level)).toContain(3);
    const lv3 = result.find((r) => r.level === 3);
    expect(lv3).toBeDefined();
    expect(lv3?.features).toHaveLength(0);
    expect(lv3?.choices).toHaveLength(0);
  });
});
