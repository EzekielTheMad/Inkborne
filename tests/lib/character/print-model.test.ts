import { describe, expect, it } from "vitest";
import { buildCharacterPrintModel } from "@/lib/character/print-model";
import { printFixture } from "../../../e2e/print/fixtures";

describe("paper-safe current character snapshot", () => {
  it("refuses unresolved slot evidence instead of printing an empty pool", () => {
    const ctx = printFixture("caster"); ctx.slotResolution = { status: "unavailable", reason: "missing class pin" };
    expect(() => buildCharacterPrintModel(ctx)).toThrow(/Spell slots are unavailable/);
  });
  it("uses evaluated caster abilities, saves, current HP and spent resources", () => {
    const ctx = printFixture("caster");
    const model = buildCharacterPrintModel(ctx, "captured");
    expect(model.abilities.find(ability => ability.name === "Strength")).toMatchObject({ score: 10, modifier: "+0", save: "+0" });
    expect(model.abilities.find(ability => ability.name === "Intelligence")).toMatchObject({ score: 18, modifier: "+4", save: "+7" });
    expect(model.skills.find(skill => skill.name === "Arcana")).toMatchObject({ modifier: "+7", passive: 17 });
    expect(model.stats).toContainEqual({ name: "HP", value: "23/32 (4 temporary)" });
    expect(model.stats).toContainEqual({ name: "Hit dice", value: "wizard 3/5 d6" });
    expect(model.stats).toContainEqual({ name: "Attacks per action", value: "1" });
    expect(model.stats).toContainEqual({ name: "wizard spellcasting", value: "DC 15; attack +7; intelligence" });
    expect(model.stats).toContainEqual({ name: "Level 1 slots", value: "3/4 remaining" });
    expect(model.spells[0].pin).toBe("Guiding Lantern v3");
    expect(JSON.stringify(model)).not.toContain("FORBIDDEN_");
  });
  it.each(["martial", "caster", "long"] as const)("retains all %s lists and long descriptions", kind => {
    const ctx = printFixture(kind), model = buildCharacterPrintModel(ctx);
    expect(model.inventory).toHaveLength(ctx.inventory.length);
    expect(model.spells).toHaveLength(ctx.spells.length);
    expect(model.features).toHaveLength(ctx.contentRefs.filter(ref => ref.content_definitions.content_type !== "weapon").length);
    if (kind === "long") { expect(model.features[0].description).toContain("FEATURE_END_1"); expect(model.spells.at(-1)?.description).toContain("SPELL_END_14"); }
    const capturedHp = `23/${ctx.maxHp} (4 temporary)`;
    ctx.state.current_hp = 1;
    expect(model.stats.find(stat => stat.name === "HP")?.value).toBe(capturedHp);
  });
  it("prints weapon modifiers from the same evaluated abilities and grants as the sheet", () => {
    const model = buildCharacterPrintModel(printFixture("martial"));
    expect(model.attacks[0].details).toContain("Hit +7 | Damage 1d8 +4 slashing");
    expect(model.skills.find(skill => skill.name === "Athletics")).toMatchObject({ modifier: "+10", passive: 20 });
  });
  it.each(["isOwner", "hasSheet"] as const)("rejects missing %s", field => {
    const ctx = printFixture("martial"); ctx[field] = false;
    expect(() => buildCharacterPrintModel(ctx)).toThrow("completed character");
  });
  it.each(["reloadRequired", "rollPersistencePending", "rollPersistenceUncertain"] as const)("rejects %s", field => {
    const ctx = printFixture("martial"); ctx[field] = true;
    expect(() => buildCharacterPrintModel(ctx)).toThrow("before printing");
  });
  it("rejects pending state writes and concentration decisions", () => {
    const ctx = printFixture("martial"); ctx.patchState.hasPendingWrites = () => true;
    expect(() => buildCharacterPrintModel(ctx)).toThrow("before printing");
    ctx.patchState.hasPendingWrites = () => false; ctx.pendingConcentrationCheck = { damage: 20, dc: 10 };
    expect(() => buildCharacterPrintModel(ctx)).toThrow("before printing");
  });
  it("rejects an omitted ref even when the surviving array contains only valid pins", () => {
    const ctx = printFixture("martial"); ctx.contentSnapshotsComplete = false;
    expect(() => buildCharacterPrintModel(ctx)).toThrow("saved content version");
  });
  it.each(["contentRefs", "inventory", "spells"] as const)("fails closed on unavailable or mismatched %s pins", field => {
    const ctx = printFixture("caster");
    if (field === "inventory") { ctx.inventory[0].content_id = ctx.contentRefs[0].content_id; ctx.inventory[0].content_version = 3; }
    const row = ctx[field][0]; row.content_definitions = { ...ctx.contentRefs[0].content_definitions, version: 4 };
    expect(() => buildCharacterPrintModel(ctx)).toThrow("saved content version");
  });
  it.each(["contentRefs", "inventory", "spells"] as const)("rejects %s rows belonging to another character", field => {
    const ctx = printFixture("caster"); ctx[field][0].character_id = "foreign-character";
    expect(() => buildCharacterPrintModel(ctx)).toThrow("another character or game system");
  });
  it.each(["contentRefs", "inventory", "spells"] as const)("rejects foreign-system %s definitions", field => {
    const ctx = printFixture("caster");
    const row = ctx[field][0];
    row.content_definitions = { ...(row.content_definitions ?? ctx.contentRefs[0].content_definitions), system_id: "foreign-system" };
    expect(() => buildCharacterPrintModel(ctx)).toThrow("another character or game system");
  });
  it("preserves authorized shared historical pins owned by another user", () => {
    const ctx = printFixture("caster"); ctx.contentRefs[0].content_definitions.owner_id = "foreign-owner";
    expect(buildCharacterPrintModel(ctx).features[0].pin).toBe("Lantern Step v3");
  });
});
