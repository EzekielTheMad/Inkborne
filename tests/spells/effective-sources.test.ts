import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
import { parseContentRefWithContent } from "@/lib/supabase/content-refs";
import { parseContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";
import { applyActiveSpellGrantOverlays } from "@/lib/supabase/spells-server";
import { resolveEffectiveCastingSources } from "@/lib/spells/effective-sources";
import { resolveCastingAbility } from "@/lib/spells/casting-ability";
import { originalGrantData, originalId, originalParent, originalRef, originalSnapshot, originalSpell, originalSubclass, originalSubclassData, originalSubclassFixture, rawOriginalRef } from "../fixtures/subclass-casting";

describe("effective class/subclass sources", () => {
  it.each([1, 2, 3, 5])("keeps selected class level %s explicit, with one source and its direct row", level => {
    const input = originalSubclassFixture(level);
    const result = resolveEffectiveCastingSources(input.character.choices.classes, input.contentRefs, input.character);
    expect(result.status).toBe("available");
    if (result.status !== "available") return;
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]).toMatchObject({ classSlug: "warden", kind: "subclass", active: level >= 3, cantripsKnown: level >= 3 ? 2 : 0 });
    expect(result.slots.maxSlots).toEqual(level < 3 ? {} : level === 3 ? { "1": 3 } : { "1": 4, "2": 1 });
  });
  it("uses sparse/reordered tagged rows rather than a table index", () => {
    const input = originalSubclassFixture(5);
    const data = originalSubclassData(); data.levels = (data.levels as Array<{ level: number }>).filter(row => row.level === 3 || row.level === 5).reverse();
    input.contentRefs[1] = originalSubclass(data);
    expect(resolveEffectiveCastingSources(input.character.choices.classes, input.contentRefs, input.character)).toMatchObject({ status: "available", slots: { maxSlots: { "1": 4, "2": 1 } } });
  });
  it("keeps non-null zero rows active and allows an original earlier unlock without guessing", () => {
    const input = originalSubclassFixture(1), data = originalSubclassData();
    (data.spellcastingKnown as { cantrips: number[] }).cantrips[0] = 2;
    (data.levels as Array<{ spellcasting: unknown }>)[0].spellcasting = { spell_slots: Array(9).fill(0), cantrips_known: 2 };
    input.contentRefs[1] = originalSubclass(data);
    expect(resolveEffectiveCastingSources(input.character.choices.classes, input.contentRefs, input.character)).toMatchObject({ status: "available", sources: [{ active: true }], slots: { maxSlots: {} } });
  });
  it.each(["full", "half", "pact"] as const)("parses canonical object-tier grant refs and inherits %s parent without a current subclass row", type => {
    const input = originalSubclassFixture(4);
    input.contentRefs[0] = originalParent("warden", type, type === "pact" ? [0, 2, 0, 0, 0, 0, 0, 0, 0] : [3, 0, 0, 0, 0, 0, 0, 0, 0]);
    const raw = rawOriginalRef(originalSnapshot("lumen-adept", "subclass", originalGrantData(), 20));
    const parsed = parseContentRefWithContent(raw)!; input.contentRefs[1] = parsed;
    expect(parsed).not.toBeNull(); expect(parsed.content_definitions.data).not.toHaveProperty("spellcasting");
    expect(parsed.content_definitions.data.spellcastingExtra).toEqual(originalGrantData().spellcastingExtra);
    const result = resolveEffectiveCastingSources(input.character.choices.classes, input.contentRefs, input.character);
    expect(result).toMatchObject({ status: "available", sources: [{ kind: "class", classSlug: "warden", config: { type, ability: "charisma" } }] });
    if (result.status === "available") expect(result.slots.maxSlots).toEqual(type === "pact" ? { pact: 2 } : { "1": 3 });
  });
  it.each([undefined, null])("retains grant-only parent inactivity with subclass config %s", config => {
    const input = originalSubclassFixture(4), data = originalGrantData(); if (config === null) data.spellcasting = null;
    input.contentRefs[1] = originalSubclass(data);
    expect(resolveEffectiveCastingSources(input.character.choices.classes, input.contentRefs, input.character)).toMatchObject({ status: "available", sources: [{ kind: "class", active: false }], slots: { maxSlots: {} } });
  });
  it("weights two parent classes once each, while Pact/noncasters keep the direct regular source", () => {
    const input = originalSubclassFixture(5);
    input.character.choices.classes.push({ slug: "original-full", level: 3 });
    input.contentRefs.push(originalParent("original-full", "full", [4, 2, 0, 0, 0, 0, 0, 0, 0], 11));
    expect(resolveEffectiveCastingSources(input.character.choices.classes, input.contentRefs, input.character)).toMatchObject({ status: "available", slots: { maxSlots: { "1": 4, "2": 3 } } });
    input.character.choices.classes[1] = { slug: "echo-pact", level: 3 };
    input.contentRefs[2] = originalParent("echo-pact", "pact", [0, 2, 0, 0, 0, 0, 0, 0, 0], 11);
    expect(resolveEffectiveCastingSources(input.character.choices.classes, input.contentRefs, input.character)).toMatchObject({ status: "available", slots: { maxSlots: { "1": 4, "2": 1, pact: 2 }, pactSlotLevel: 2 } });
    input.character.choices.classes[1] = { slug: "original-noncaster", level: 3 };
    input.contentRefs[2] = originalParent("original-noncaster", null, null, 11);
    expect(resolveEffectiveCastingSources(input.character.choices.classes, input.contentRefs, input.character)).toMatchObject({ status: "available", slots: { maxSlots: { "1": 4, "2": 1 } } });
  });
  it.each(["missing-subclass", "duplicate-subclass", "wrong-parent", "wrong-system", "wrong-character", "wrong-version", "wrong-type", "wrong-choice", "partial-config", "partial-known", "partial-list", "missing-row", "duplicate-row", "wrong-counts", "dual-profile", "missing-rule"])("refuses %s without accepted fallback mechanics", problem => {
    const input = originalSubclassFixture();
    const sub = input.contentRefs[1];
    if (problem === "missing-subclass") input.contentRefs.pop();
    if (problem === "duplicate-subclass") input.contentRefs.push(sub);
    if (problem === "wrong-parent") sub.content_definitions.data.parent_class = "other-parent";
    if (problem === "wrong-system") sub.content_definitions.system_id = originalId(99);
    if (problem === "wrong-character") sub.character_id = originalId(99);
    if (problem === "wrong-version") sub.content_version = 2;
    if (problem === "wrong-type") sub.content_definitions.content_type = "class";
    if (problem === "wrong-choice") input.character.choices.classes[0].subclass = "other-subclass";
    if (problem === "partial-config") delete sub.content_definitions.data.spellcasting;
    if (problem === "partial-known") delete sub.content_definitions.data.spellcastingKnown;
    if (problem === "partial-list") delete sub.content_definitions.data.spellcastingList;
    if (problem === "missing-row") (sub.content_definitions.data.levels as Array<{ level: number }>).splice(2, 1);
    if (problem === "duplicate-row") (sub.content_definitions.data.levels as unknown[]).push((sub.content_definitions.data.levels as unknown[])[2]);
    if (problem === "wrong-counts") (sub.content_definitions.data.levels as Array<{ spellcasting: { cantrips_known: number } }>)[2].spellcasting.cantrips_known = 7;
    if (problem === "dual-profile") input.contentRefs[0] = originalParent("warden", "full", [3, 0, 0, 0, 0, 0, 0, 0, 0]);
    if (problem === "missing-rule") { sub.content_definitions.data = originalSubclassData(true); delete sub.content_definitions.data.preparation_rule; }
    const result = resolveEffectiveCastingSources(input.character.choices.classes, input.contentRefs, input.character);
    expect(result.status).toBe("unavailable"); expect(result).not.toHaveProperty("sources");
  });
  it("preserves active grant overlay versus selected acquisition versions under inherited parent identity", () => {
    const selected = originalSpell("warden", 2), granted = originalSpell("warden", 1);
    const grant = { content_id: granted.content_id!, content_version: 1, class_slug: "warden" };
    const overlaid = applyActiveSpellGrantOverlays([selected], [grant])[0];
    expect(overlaid).toMatchObject({ content_version: 2, source: "selection", always_prepared: true, is_prepared: true, class_slug: "warden" });
    expect(overlaid.content_definitions).toBe(selected.content_definitions);
    // Model an existing RPC returning its captured row after selected removal.
    expect(applyActiveSpellGrantOverlays([granted], [grant])[0].content_version).toBe(1);
  });
  it("uses separate acquisition identities for the same spell/version under two parent classes with opposite strengths", () => {
    const input = originalSubclassFixture();
    input.character.choices.classes.push({ slug: "original-full", level: 3 });
    input.contentRefs.push(originalParent("original-full", "full", [4, 2, 0, 0, 0, 0, 0, 0, 0], 11));
    input.spells.push({ ...originalSpell("original-full"), id: originalId(101) });
    expect(input.spells[0].content_id).toBe(input.spells[1].content_id);
    for (const strengths of [{ intelligence: 14, charisma: 20 }, { intelligence: 20, charisma: 14 }]) {
      input.abilityScores = strengths;
      expect(resolveCastingAbility(input.spells[0], input)).toMatchObject({ status: "available", profile: { ability: "intelligence", spellAttackBonus: strengths.intelligence === 14 ? 4 : 7 } });
      expect(resolveCastingAbility(input.spells[1], input)).toMatchObject({ status: "available", profile: { ability: "charisma", spellAttackBonus: strengths.charisma === 14 ? 4 : 7 } });
    }
  });
  it("accepts a separately readable shared historical subclass snapshot from another author", () => {
    const input = originalSubclassFixture(), snapshot = originalSnapshot("lumen-adept", "subclass", originalSubclassData(), 20);
    snapshot.owner_id_snapshot = originalId(99); snapshot.scope_snapshot = "shared";
    input.contentRefs[1] = originalRef(snapshot);
    expect(resolveEffectiveCastingSources(input.character.choices.classes, input.contentRefs, input.character).status).toBe("available");
  });
  it.each(["focus", "ritual_casting"])("does not manufacture missing subclass config %s at snapshot parsing", missing => {
    const data = originalSubclassData(); delete (data.spellcasting as Record<string, unknown>)[missing];
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(parseContentVersionSnapshot(originalSnapshot("lumen-adept", "subclass", data, 20))).toBeNull();
    error.mockRestore();
  });
  it.each([{ spellcastingExtra: ["original-only"] }, { spellcastingExtra: [["original-tier"]] }, { spellcastingExtra: [{ level: 3, spells: ["original-object"] }] }])("retains legacy and object grant shapes $spellcastingExtra", ({ spellcastingExtra }) => {
    const snapshot = originalSnapshot("grant-only", "subclass", { ...originalGrantData(), spellcastingExtra }, 20);
    expect(parseContentVersionSnapshot(snapshot)?.data.spellcastingExtra).toEqual(spellcastingExtra);
  });
  it.each([{ spells: ["missing-level"] }, { level: 3 }, { level: 0, spells: ["original"] }, { level: 3, spells: [" "] }])("rejects malformed object-tier grant %j at the actual snapshot boundary", tier => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(parseContentVersionSnapshot(originalSnapshot("bad-grant", "subclass", { ...originalGrantData(), spellcastingExtra: [tier] }, 20))).toBeNull();
    error.mockRestore();
  });
  it("retains omitted and explicit-null rows distinctly through canonical snapshot/ref parsing", () => {
    const data = originalSubclassData(); delete (data.levels as Array<{ spellcasting?: unknown }>)[2].spellcasting;
    const parsed = originalRef(originalSnapshot("lumen-adept", "subclass", data, 20));
    const rows = parsed.content_definitions.data.levels as Array<{ spellcasting?: unknown }>;
    expect(rows[2]).not.toHaveProperty("spellcasting"); expect(rows[0].spellcasting).toBeNull();
    const input = originalSubclassFixture(); input.contentRefs[1] = parsed;
    expect(resolveEffectiveCastingSources(input.character.choices.classes, input.contentRefs, input.character).status).toBe("unavailable");
  });
});
