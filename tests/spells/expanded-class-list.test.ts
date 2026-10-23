import { describe, expect, it } from "vitest";
import { resolveEffectiveCastingSources } from "@/lib/spells/effective-sources";
import { isOrdinaryClassSpellEligible } from "@/lib/spells/spell-eligibility";
import { isBonusSpellEligible } from "@/lib/builder/bonus-spells";
import { originalParent, originalRef, originalSnapshot, originalSubclassFixture, subclassSystemId, subclassOwnerId } from "../fixtures/subclass-casting";

function fixture(level = 3) {
  const input = originalSubclassFixture(level);
  input.contentRefs[0] = originalParent("warden", "pact", level < 3
    ? [1, 0, 0, 0, 0, 0, 0, 0, 0] : [0, 2, 0, 0, 0, 0, 0, 0, 0]);
  input.contentRefs[1] = originalRef(originalSnapshot("lumen-adept", "subclass", {
    parent_class: "warden", levels: [{ level: 1, features: [] }], spells: [], spellcastingExpanded: [
      { level: 1, spells: ["prism-mark"] }, { level: 3, spells: ["quiet-beacon"] },
      { level: 5, spells: ["unearned"] },
    ],
  }, 20, 2));
  return input;
}
const origin = { system_id: subclassSystemId, source: "homebrew", scope: "personal", owner_id: subclassOwnerId };
const spell = (slug: string, level: number, classes = ["original-scholar"]) => ({ slug, ...origin, data: { level, classes } });

describe("immutable expanded ordinary spell lists", () => {
  it.each([1, 3])("inherits one Pact source and earns only its own class-level tiers at %s", level => {
    const input = fixture(level);
    // Higher ordinary multiclass slots do not unlock the Pact subclass tiers.
    input.character.choices.classes.push({ slug: "other-caster", level: 9 });
    input.contentRefs.push(originalParent("other-caster", "full", [4, 3, 3, 3, 1, 0, 0, 0, 0], 11));
    const result = resolveEffectiveCastingSources(input.character.choices.classes, input.contentRefs, input.character);
    expect(result.status).toBe("available"); if (result.status !== "available") return;
    const source = result.sources[0];
    expect(result.sources).toHaveLength(2);
    expect(source).toMatchObject({ kind: "class", config: { type: "pact" }, subclassPin: { version: 2 },
      maxLearnableLevel: level < 3 ? 1 : 2, spellsKnown: 4,
      expandedSpellSlugs: level < 3 ? ["prism-mark"] : ["prism-mark", "quiet-beacon"] });
    expect(isOrdinaryClassSpellEligible(source, spell("prism-mark", 1))).toBe(true);
    expect(isOrdinaryClassSpellEligible(source, spell("quiet-beacon", 2))).toBe(level >= 3);
    expect(isOrdinaryClassSpellEligible(source, spell("unearned", 3))).toBe(false);
    expect(isOrdinaryClassSpellEligible(source, spell("ordinary", 1, ["warden"]))).toBe(true);
    expect(isOrdinaryClassSpellEligible(source, spell("off-list", 1))).toBe(false);
    expect(isOrdinaryClassSpellEligible(source, spell("prism-mark", 3))).toBe(false);
    for (const provenance of [{ system_id: "other-system" }, { source: "srd" }, { scope: "shared" }, { owner_id: null }]) {
      expect(isOrdinaryClassSpellEligible(source, { ...spell("prism-mark", 1), ...provenance })).toBe(false);
      // Legitimate ordinary class-list candidates retain their existing eligibility.
      expect(isOrdinaryClassSpellEligible(source, { ...spell("ordinary", 1, ["warden"]), ...provenance })).toBe(true);
    }
    expect(isOrdinaryClassSpellEligible({ ...source, expandedSpellSource: undefined }, spell("prism-mark", 1))).toBe(false);
    expect(isOrdinaryClassSpellEligible(result.sources[1], spell("prism-mark", 1))).toBe(false);
  });
  it("keeps absent metadata absent and refuses malformed saved metadata without repinning", () => {
    const input = fixture();
    delete input.contentRefs[1].content_definitions.data.spellcastingExpanded;
    const old = resolveEffectiveCastingSources(input.character.choices.classes, input.contentRefs, input.character);
    expect(old).toMatchObject({ status: "available" });
    if (old.status !== "available") return;
    expect(old.sources[0]).not.toHaveProperty("expandedSpellSlugs");
    expect(isOrdinaryClassSpellEligible(old.sources[0], spell("prism-mark", 1))).toBe(false);
    input.contentRefs[1].content_definitions.data.spellcastingExpanded = [{ level: 1, spells: ["same", "same"] }];
    expect(resolveEffectiveCastingSources(input.character.choices.classes, input.contentRefs, input.character).status).toBe("unavailable");
  });
  it("does not expand the separate exact-level Arcanum list or accept malformed candidates", () => {
    const input = fixture(), result = resolveEffectiveCastingSources(input.character.choices.classes, input.contentRefs, input.character);
    if (result.status !== "available") throw Error("Unavailable fixture");
    const source = result.sources[0];
    for (const candidate of [spell("prism-mark", -1), spell("prism-mark", 1.5), spell("prism-mark", 1, []),
      { slug: "prism-mark", data: { level: 1, classes: [123] } }]) expect(isOrdinaryClassSpellEligible(source, candidate)).toBe(false);
    expect(isOrdinaryClassSpellEligible({ ...source, active: false }, spell("prism-mark", 1))).toBe(false);
    expect(isBonusSpellEligible({ choice_id: "original-arcanum", choose: 1, min_spell_level: 6, max_spell_level: 6,
      list_class: "warden", ritual_only: false, spellbook_only: false, counts_known: false, always_prepared: false, mode: "arcanum" },
    { id: "00000000-0000-4000-8000-000000000030", version: 1, data: { level: 6, classes: ["original-scholar"] } },
    { classMaxSpellLevel: 2 })).toBe(false);
  });
});
