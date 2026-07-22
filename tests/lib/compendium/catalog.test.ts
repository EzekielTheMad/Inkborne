import { describe, expect, it } from "vitest";

import {
  compendiumHref,
  parseCompendiumQuery,
  resetCategoryFilters,
} from "@/lib/compendium/catalog";

describe("compendium catalog query", () => {
  it("normalizes untrusted URL values into bounded filters", () => {
    const query = parseCompendiumQuery({
      category: "spells",
      q: `  ${"x".repeat(140)}  `,
      page: "10000",
      level: "12",
      school: "chronomancy",
      provenance: "private",
      ritual: "true",
    });

    expect(query.category).toBe("spells");
    expect(query.q).toHaveLength(120);
    expect(query.page).toBe(999);
    expect(query.level).toBeNull();
    expect(query.school).toBeNull();
    expect(query.provenance).toBe("all");
    expect(query.ritual).toBe(true);
  });

  it.each(["constructor", "toString", "__proto__"])(
    "rejects inherited object key %s as a category",
    (category) => {
      expect(parseCompendiumQuery({ category }).category).toBe("spells");
    },
  );

  it("keeps supported category filters and serializes stable links", () => {
    const query = parseCompendiumQuery({
      system: "22222222-2222-4222-8222-222222222222",
      category: "weapons",
      weaponCategory: "Martial",
      weaponRange: "Ranged",
      provenance: "shared",
      sort: "name-desc",
      page: "2",
    });

    expect(compendiumHref(query)).toBe(
      "/library?system=22222222-2222-4222-8222-222222222222&category=weapons&provenance=shared&sort=name-desc&page=2&weaponCategory=Martial&weaponRange=Ranged",
    );
  });

  it("clears incompatible filters when changing categories", () => {
    const spellQuery = parseCompendiumQuery({
      category: "spells",
      level: "3",
      school: "evocation",
      ritual: "true",
      q: "fire",
    });

    const itemQuery = resetCategoryFilters(spellQuery, "items");

    expect(itemQuery.category).toBe("items");
    expect(itemQuery.q).toBe("fire");
    expect(itemQuery.level).toBeNull();
    expect(itemQuery.school).toBeNull();
    expect(itemQuery.ritual).toBe(false);
    expect(itemQuery.page).toBe(1);
  });
});
