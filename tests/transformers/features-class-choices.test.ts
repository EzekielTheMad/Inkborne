import { describe, expect, it } from "vitest";
import { transformFeatureEntry } from "@/scripts/transformers/features";

const terrains = ["arctic", "coast", "desert", "forest", "grassland", "mountain", "swamp"];
const tiers = [["natural-explorer-1-terrain-type", 1], ["natural-explorer-2-terrain-types", 6],
  ["natural-explorer-3-terrain-types", 10]] as const;
const source = (index: string, level: number) => ({ index, name: "Natural Explorer", class: { index: "ranger", name: "Ranger" },
  level, prerequisites: [], desc: ["Choose one additional terrain."],
  feature_specific: { terrain_type_options: { choose: 1, type: "string", from: { option_set_type: "options_array", options: [...terrains] } } } });

describe("real SRD Natural Explorer source mapping", () => {
  it.each(tiers)("records one additional terrain at %s", (slug, level) => {
    const feature = transformFeatureEntry(source(slug, level));
    expect(feature.data.feature_type).toBe("choice");
    expect(feature.effects).toContainEqual({ type: "choice", choice_id: slug, choose: 1, from: terrains, grant_type: "favored_terrain" });
    expect(feature.data.choices ?? []).toEqual([]);
  });
  it("rejects unsupported terrain vocabulary, cumulative cardinality and level drift", () => {
    const duplicate = source(...tiers[0]); duplicate.feature_specific.terrain_type_options.from.options[1] = "arctic";
    expect(() => transformFeatureEntry(duplicate)).toThrow("Unsupported SRD Natural Explorer");
    const cumulative = source(...tiers[1]); cumulative.feature_specific.terrain_type_options.choose = 2;
    expect(() => transformFeatureEntry(cumulative)).toThrow("Unsupported SRD Natural Explorer");
    expect(() => transformFeatureEntry({ ...source(...tiers[2]), level: 14 })).toThrow("Unsupported SRD Natural Explorer");
  });
});
