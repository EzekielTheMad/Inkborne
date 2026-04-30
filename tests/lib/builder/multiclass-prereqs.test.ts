import { describe, it, expect } from "vitest";
import {
  MULTICLASS_PREREQ_TABLE,
  evaluateMulticlassPrereq,
  multiclassPrereqsForAll,
  type ClassPrereqResult,
} from "@/lib/builder/multiclass-prereqs";
import type { ContentEntry } from "@/components/builder/content-browser";

function classEntry(slug: string, name: string): ContentEntry {
  return {
    id: `c-${slug}`,
    slug,
    name,
    content_type: "class",
    data: {},
    effects: [],
    version: 1,
    source: "srd",
  };
}

describe("MULTICLASS_PREREQ_TABLE", () => {
  it("has an entry for every SRD class", () => {
    const expected = [
      "barbarian", "bard", "cleric", "druid", "fighter", "monk",
      "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard",
    ];
    expect(Object.keys(MULTICLASS_PREREQ_TABLE).sort()).toEqual(expected.sort());
  });
});

describe("evaluateMulticlassPrereq", () => {
  const stats13 = {
    strength: 13, dexterity: 13, constitution: 13,
    intelligence: 13, wisdom: 13, charisma: 13,
  };
  const stats10 = {
    strength: 10, dexterity: 10, constitution: 10,
    intelligence: 10, wisdom: 10, charisma: 10,
  };

  it("returns met when all `all` thresholds are hit", () => {
    const result = evaluateMulticlassPrereq("paladin", stats13, []);
    expect(result.state).toBe("met");
    expect(result.line).toBe("STR 13 · met");
  });

  it("returns not-met when any `all` threshold misses", () => {
    const result = evaluateMulticlassPrereq("paladin", { ...stats13, charisma: 12 }, []);
    expect(result.state).toBe("not-met");
    expect(result.line).toBe("CHA 13 · not met");
    expect(result.unmet).toEqual([
      { ability: "charisma", min: 13, have: 12 },
    ]);
  });

  it("lists multiple unmet abilities when several `all` thresholds miss", () => {
    const result = evaluateMulticlassPrereq("paladin", stats10, []);
    expect(result.state).toBe("not-met");
    expect(result.line).toBe("STR 13 · not met");
    expect(result.unmet?.length).toBe(2);
  });

  it("returns met for Fighter when only one of the `any` thresholds is hit", () => {
    const result = evaluateMulticlassPrereq("fighter", { ...stats10, dexterity: 13 }, []);
    expect(result.state).toBe("met");
    expect(result.line).toBe("DEX 13 · met");
  });

  it("returns not-met for Fighter when neither `any` threshold is hit", () => {
    const result = evaluateMulticlassPrereq("fighter", stats10, []);
    expect(result.state).toBe("not-met");
    expect(result.line).toBe("STR 13 or DEX 13 · not met");
  });

  it("returns already-in-build when selectedClasses contains the slug", () => {
    const result = evaluateMulticlassPrereq("paladin", stats13, [{ slug: "paladin" }]);
    expect(result.state).toBe("already-in-build");
    expect(result.line).toBe("Already in this build");
  });

  it("uses STR/DEX/CON/INT/WIS/CHA abbreviations in the line", () => {
    expect(evaluateMulticlassPrereq("rogue", stats13, []).line).toBe("DEX 13 · met");
    expect(evaluateMulticlassPrereq("wizard", stats13, []).line).toBe("INT 13 · met");
    expect(evaluateMulticlassPrereq("cleric", stats13, []).line).toBe("WIS 13 · met");
    expect(evaluateMulticlassPrereq("bard", stats13, []).line).toBe("CHA 13 · met");
    expect(evaluateMulticlassPrereq("barbarian", stats13, []).line).toBe("STR 13 · met");
  });

  it("missing ability score (e.g. undefined) is treated as 0 (not met)", () => {
    const result = evaluateMulticlassPrereq("paladin", {} as Record<string, number>, []);
    expect(result.state).toBe("not-met");
  });
});

describe("multiclassPrereqsForAll", () => {
  const stats = {
    strength: 13, dexterity: 13, constitution: 13,
    intelligence: 8, wisdom: 8, charisma: 8,
  };

  it("returns one result per class in the input list", () => {
    const classes = [
      classEntry("barbarian", "Barbarian"),
      classEntry("wizard", "Wizard"),
    ];
    const results = multiclassPrereqsForAll(stats, [], classes);
    expect(results).toHaveLength(2);
    expect(results.map((r: ClassPrereqResult) => r.classSlug)).toEqual(["barbarian", "wizard"]);
  });

  it("preserves input order", () => {
    const classes = [
      classEntry("wizard", "Wizard"),
      classEntry("barbarian", "Barbarian"),
    ];
    const results = multiclassPrereqsForAll(stats, [], classes);
    expect(results.map((r) => r.classSlug)).toEqual(["wizard", "barbarian"]);
  });

  it("respects selectedClasses for the already-in-build state", () => {
    const classes = [classEntry("barbarian", "Barbarian")];
    const results = multiclassPrereqsForAll(stats, [{ slug: "barbarian" }], classes);
    expect(results[0].state).toBe("already-in-build");
  });
});
