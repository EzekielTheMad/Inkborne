import { describe, expect, it } from "vitest";
import { subclassFeatureManifest } from "@/scripts/transformers/classes";

// Exact source relationships from the cached public 2014 API: the subclass
// level listing omits circle-of-the-land; that feature resource supplies its
// Druid/Land/level-two ownership and seven referenced terrain children.
const subclass = { index: "land", class: { index: "druid", name: "Druid" } };
const sourceLevels = [
  { level: 2, features: [{ index: "bonus-cantrip" }, { index: "natural-recovery" }] },
  { level: 6, features: [{ index: "druid-lands-stride" }] },
  { level: 10, features: [{ index: "natures-ward" }] },
  { level: 14, features: [{ index: "natures-sanctuary" }] },
];
const controller = () => ({ index: "circle-of-the-land", class: { index: "druid" }, subclass: { index: "land" }, level: 2,
  feature_specific: { subfeature_options: { choose: 1, from: { options: ["arctic", "coast", "desert", "forest", "grassland", "mountain", "swamp"]
    .map(terrain => ({ option_type: "reference", item: { index: `circle-of-the-land-${terrain}`, name: terrain } })) } } } });

describe("genuine SRD subclass choice manifests", () => {
  it("restores only the source-owned Land controller and preserves every listed feature", () => {
    expect(subclassFeatureManifest(subclass, sourceLevels, controller())).toEqual([
      { level: 2, features: ["bonus-cantrip", "natural-recovery", "circle-of-the-land"] },
      { level: 6, features: ["druid-lands-stride"] }, { level: 10, features: ["natures-ward"] }, { level: 14, features: ["natures-sanctuary"] },
    ]);
    expect(sourceLevels[0].features.map(feature => feature.index)).toEqual(["bonus-cantrip", "natural-recovery"]);
  });
  it("retains an already correct genuine manifest exactly once", () => {
    const corrected = sourceLevels.map(row => ({ ...row, features: row.level === 2 ? [...row.features, { index: "circle-of-the-land" }] : row.features }));
    expect(subclassFeatureManifest(subclass, corrected, controller())[0].features.filter(slug => slug === "circle-of-the-land")).toHaveLength(1);
  });
  it("rejects missing, changed or conflicting source ownership rather than inventing a controller", () => {
    expect(() => subclassFeatureManifest(subclass, sourceLevels)).toThrow("genuine SRD Circle of the Land controller");
    for (const changed of [{ ...controller(), level: 3 }, { ...controller(), subclass: { index: "moon" } },
      { ...controller(), class: { index: "ranger" } }]) {
      expect(() => subclassFeatureManifest(subclass, sourceLevels, changed)).toThrow("genuine SRD Circle of the Land controller");
    }
    const changed = controller(); changed.feature_specific.subfeature_options.from.options[0].item.index = "unreviewed-terrain";
    expect(() => subclassFeatureManifest(subclass, sourceLevels, changed)).toThrow("genuine SRD Circle of the Land controller");
    expect(() => subclassFeatureManifest(subclass, sourceLevels.map(row => ({ ...row,
      features: row.level === 6 ? [...row.features, { index: "circle-of-the-land" }] : row.features })), controller())).toThrow("conflicting level ownership");
  });
  it("preserves unrelated subclass manifests without requiring Land metadata", () => {
    expect(subclassFeatureManifest({ index: "hunter", class: { index: "ranger", name: "Ranger" } }, [
      { level: 3, features: [{ index: "hunters-prey" }] }, { level: 7, features: [{ index: "defensive-tactics" }] },
    ])).toEqual([{ level: 3, features: ["hunters-prey"] }, { level: 7, features: ["defensive-tactics"] }]);
  });
});
