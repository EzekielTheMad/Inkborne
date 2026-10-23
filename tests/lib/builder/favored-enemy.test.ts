import { describe, expect, it } from "vitest";
import { favoredEnemyLanguages, isFavoredEnemyComplete } from "@/lib/builder/favored-enemy";

const feature = { slug: "favored-enemy-1-type", content_type: "feature", data: { feature_type: "favored_enemy",
  favored_enemy: { enemy_types: ["beasts", "fiends"], humanoid_races: ["gnoll", "orc", "human"] } } };

describe("Favored Enemy atomic choices", () => {
  it("requires exactly one supported branch and a supported language or explicit none", () => {
    expect(isFavoredEnemyComplete(feature, { selection: { mode: "type", enemy_type: "beasts" }, language: null }, [])).toBe(true);
    expect(isFavoredEnemyComplete(feature, { selection: { mode: "humanoids", races: ["gnoll", "orc"] }, language: "abyssal" }, ["abyssal"])).toBe(true);
    for (const selection of [{ mode: "humanoids", races: ["orc", "orc"] }, { mode: "humanoids", races: ["orc"] },
      { mode: "type", enemy_type: "humanoids" }, { mode: "type", enemy_type: "fiends", races: ["orc", "gnoll"] }]) {
      expect(isFavoredEnemyComplete(feature, { selection, language: null }, [])).toBe(false);
    }
    expect(isFavoredEnemyComplete(feature, { selection: { mode: "type", enemy_type: "beasts" }, language: "invented" }, ["common"])).toBe(false);
  });
  it("rejects repeated enemies across earned tiers", () => {
    const prior = { selection: { mode: "type" as const, enemy_type: "beasts" }, language: null };
    expect(isFavoredEnemyComplete(feature, prior, [], [prior])).toBe(false);
    expect(isFavoredEnemyComplete(feature, { selection: { mode: "humanoids", races: ["gnoll", "orc"] }, language: null }, [],
      [{ selection: { mode: "humanoids", races: ["orc", "human"] }, language: null }])).toBe(false);
  });
  it("projects only languages backed by an earned feature and valid branch", () => {
    const choices = { favored_enemies: { [feature.slug]: { selection: { mode: "type" as const, enemy_type: "beasts" }, language: "elvish" } } };
    expect(favoredEnemyLanguages([{ content_definitions: feature }], choices, ["elvish"])).toEqual(["elvish"]);
    expect(favoredEnemyLanguages([], choices, ["elvish"])).toEqual([]);
    expect(favoredEnemyLanguages([{ content_definitions: feature }], choices, ["common"])).toEqual([]);
  });
});
