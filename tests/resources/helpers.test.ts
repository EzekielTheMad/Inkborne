import { describe, it, expect } from "vitest";
import {
  normalizeRecovery,
  getMaxUses,
  computeResources,
  groupByRecovery,
} from "@/lib/resources/helpers";
import type { FeatureResource } from "@/lib/types/resources";

describe("normalizeRecovery", () => {
  it("maps short rest to short", () => {
    expect(normalizeRecovery("short rest")).toBe("short");
  });
  it("maps long rest to long", () => {
    expect(normalizeRecovery("long rest")).toBe("long");
  });
  it("maps dawn to long", () => {
    expect(normalizeRecovery("dawn")).toBe("long");
  });
  it("maps day to long", () => {
    expect(normalizeRecovery("day")).toBe("long");
  });
  it("returns null for null/undefined", () => {
    expect(normalizeRecovery(null)).toBe(null);
    expect(normalizeRecovery(undefined)).toBe(null);
  });
});

describe("getMaxUses", () => {
  it("returns fixed number as-is", () => {
    expect(getMaxUses(3, 1)).toBe(3);
  });
  it("resolves per-level array at classLevel-1 index", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    expect(getMaxUses(arr, 1)).toBe(1);
    expect(getMaxUses(arr, 5)).toBe(5);
    expect(getMaxUses(arr, 20)).toBe(20);
  });
  it("returns 0 for null entry in array", () => {
    const arr = [null, null, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
    expect(getMaxUses(arr, 1)).toBe(0);
    expect(getMaxUses(arr, 3)).toBe(2);
  });
  it("returns 0 for undefined usages", () => {
    expect(getMaxUses(undefined, 1)).toBe(0);
  });
  it("clamps classLevel below 1 to 0", () => {
    expect(getMaxUses([1, 2, 3], 0)).toBe(0);
  });
});

describe("computeResources", () => {
  // Synthetic feature fixture helper
  function feature(slug: string, data: Record<string, unknown>) {
    return {
      id: `id-${slug}`,
      content_id: `content-${slug}`,
      character_id: "char-1",
      content_version: 1,
      context: {},
      choice_source: null,
      created_at: "2026-04-23",
      content_definitions: {
        id: `content-${slug}`,
        slug,
        name: slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        content_type: "feature",
        data,
        version: 1,
      },
    };
  }

  it("returns empty array when no features", () => {
    expect(computeResources([], [])).toEqual([]);
  });

  it("excludes feature with no usages", () => {
    const refs = [feature("dummy", { class: "wizard", level: 1, description: "x" })];
    expect(computeResources(refs, [{ slug: "wizard", level: 3 }])).toEqual([]);
  });

  it("excludes feature with usages but no recovery", () => {
    const refs = [feature("dummy", { class: "wizard", level: 1, description: "x", usages: 3, recovery: null })];
    expect(computeResources(refs, [{ slug: "wizard", level: 3 }])).toEqual([]);
  });

  it("builds a resource from fixed-number usages", () => {
    const refs = [feature("action_surge", {
      class: "fighter",
      level: 2,
      description: "x",
      usages: 1,
      recovery: "short rest",
    })];
    const result = computeResources(refs, [{ slug: "fighter", level: 2 }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      slug: "action_surge",
      name: "Action Surge",
      max: 1,
      recovery: "short",
      sourceLabel: "Fighter 2",
      sourceFeatureSlug: "action_surge",
    });
  });

  it("resolves per-level array usages against class level", () => {
    const rageArr = [2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 99];
    const refs = [feature("rage", {
      class: "barbarian",
      level: 1,
      description: "x",
      usages: rageArr,
      recovery: "long rest",
    })];
    const result = computeResources(refs, [{ slug: "barbarian", level: 5 }]);
    expect(result[0].max).toBe(3); // index 4 -> rageArr[4] = 3
  });

  it("maps dawn and day to long recovery", () => {
    const refs = [
      feature("dawnfeat", { class: "wizard", level: 1, description: "x", usages: 1, recovery: "dawn" }),
      feature("dayfeat", { class: "wizard", level: 1, description: "x", usages: 1, recovery: "day" }),
    ];
    const result = computeResources(refs, [{ slug: "wizard", level: 1 }]);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.recovery === "long")).toBe(true);
  });

  it("includes extraLimitedFeatures as separate entries", () => {
    const refs = [feature("wild_shape", {
      class: "druid",
      level: 2,
      description: "x",
      usages: 2,
      recovery: "short rest",
      extraLimitedFeatures: [
        { name: "Primal Strike", usages: 1, recovery: "long rest" },
      ],
    })];
    const result = computeResources(refs, [{ slug: "druid", level: 2 }]);
    expect(result).toHaveLength(2);
    const parent = result.find((r) => r.slug === "wild_shape");
    const extra = result.find((r) => r.slug === "wild_shape.primal_strike");
    expect(parent).toBeDefined();
    expect(parent?.max).toBe(2);
    expect(parent?.recovery).toBe("short");
    expect(extra).toBeDefined();
    expect(extra?.max).toBe(1);
    expect(extra?.recovery).toBe("long");
    expect(extra?.name).toBe("Wild Shape: Primal Strike");
    expect(extra?.sourceFeatureSlug).toBe("wild_shape");
  });

  it("skips features for classes the character doesn't have", () => {
    const refs = [feature("rage", { class: "barbarian", level: 1, description: "x", usages: 2, recovery: "long rest" })];
    const result = computeResources(refs, [{ slug: "fighter", level: 5 }]);
    expect(result).toEqual([]);
  });

  it("skips features whose resolved max is 0", () => {
    const refs = [feature("nothing", {
      class: "fighter",
      level: 11,
      description: "x",
      usages: [null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      recovery: "long rest",
    })];
    const result = computeResources(refs, [{ slug: "fighter", level: 5 }]);
    expect(result).toEqual([]);
  });

  it("skips non-feature content types", () => {
    const refs = [{
      id: "id1", content_id: "c1", character_id: "ch", content_version: 1,
      context: {}, choice_source: null, created_at: "",
      content_definitions: {
        id: "c1", slug: "longsword", name: "Longsword", content_type: "weapon",
        data: { usages: 1, recovery: "long rest" }, version: 1,
      },
    }];
    expect(computeResources(refs as never, [{ slug: "fighter", level: 1 }])).toEqual([]);
  });
});

describe("groupByRecovery", () => {
  const mk = (slug: string, name: string, recovery: "short" | "long"): FeatureResource => ({
    slug, name, max: 1, recovery, sourceLabel: "", sourceFeatureSlug: slug,
  });

  it("groups and sorts alphabetically within each group", () => {
    const input = [
      mk("rage", "Rage", "long"),
      mk("ki", "Ki", "short"),
      mk("action_surge", "Action Surge", "short"),
      mk("lay_on_hands", "Lay on Hands", "long"),
    ];
    const result = groupByRecovery(input);
    expect(result.short.map((r) => r.name)).toEqual(["Action Surge", "Ki"]);
    expect(result.long.map((r) => r.name)).toEqual(["Lay on Hands", "Rage"]);
  });

  it("returns empty arrays when input empty", () => {
    expect(groupByRecovery([])).toEqual({ short: [], long: [] });
  });
});
