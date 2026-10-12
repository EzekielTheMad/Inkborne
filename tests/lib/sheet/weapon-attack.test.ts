import { describe, expect, it } from "vitest";
import { getWeaponAttack, getWeaponDisplay } from "@/lib/sheet/weapon-attack";
import { canonicalWeaponRef } from "../../../e2e/print/canonical-weapons";
import { printFixture } from "../../../e2e/print/fixtures";

function attack(kind: "melee" | "ranged" | "finesse", grants: string[] = []) {
  const ctx = printFixture("martial"), definition = canonicalWeaponRef(kind).content_definitions;
  ctx.evalResult.stats = { strength: 12, strength_mod: 1, dexterity: 18, dexterity_mod: 4 };
  ctx.evalResult.grants = grants.map(stat => ({ type: "grant", stat, value: "proficient" }));
  return getWeaponAttack(definition.name, definition.slug, definition.data, ctx.evalResult);
}
describe("shared canonical weapon display and bounded attack math", () => {
  it("reads nested canonical damage and range fields", () => {
    expect(getWeaponDisplay(canonicalWeaponRef("ranged").content_definitions.data)).toMatchObject({ damageDice: "1d8", damageType: "piercing", damageText: "1d8 piercing", range: "120/480 ft", ranged: true });
  });
  it("retains legitimate legacy display strings without pretending they imply a weapon category", () => {
    expect(getWeaponDisplay({ damage: "1d6", damage_type: "bludgeoning", range: "5 ft", weapon_type: "melee", properties: [] })).toMatchObject({ damageText: "1d6 bludgeoning", range: "5 ft", ranged: false, category: "" });
  });
  it("applies only the matching category grant", () => {
    expect(attack("melee", ["simple_weapons"]).hitBonusValue).toBe(4);
    expect(attack("ranged", ["simple_weapons"]).hitBonusValue).toBe(4);
    expect(attack("ranged", ["martial_weapons"]).hitBonusValue).toBe(7);
    expect(attack("melee", ["martial_weapons"]).hitBonusValue).toBe(1);
  });
  it.each(["courier-needle", "weapon_courier-needle"])("recognizes the specific weapon grant %s", stat => {
    expect(attack("finesse", [stat]).hitBonusValue).toBe(7);
  });
  it("uses the higher finesse ability and prefers the supplied effective modifier", () => {
    expect(attack("finesse").damageExpression).toBe("1d8+4");
    const ctx = printFixture("martial"), definition = canonicalWeaponRef("finesse").content_definitions;
    ctx.evalResult.stats = { strength: 12, strength_mod: 5, dexterity: 18, dexterity_mod: 4 };
    expect(getWeaponAttack(definition.name, definition.slug, definition.data, ctx.evalResult).damageExpression).toBe("1d8+5");
  });
  it("keeps a canonical thrown melee weapon on STR despite its numeric long range", () => {
    const ctx = printFixture("martial"), definition = canonicalWeaponRef("melee").content_definitions;
    definition.data.range = { normal: 20, long: 60 }; definition.data.properties = ["thrown"];
    ctx.evalResult.stats = { strength: 12, strength_mod: 1, dexterity: 18, dexterity_mod: 4 };
    expect(getWeaponAttack(definition.name, definition.slug, definition.data, ctx.evalResult).damageExpression).toBe("1d6+1");
  });
  it.each([null, undefined, { dice: "special", type: "piercing" }])("does not produce accepted damage rolls from unavailable dice %s", damage => {
    const ctx = printFixture("martial"), definition = canonicalWeaponRef("melee").content_definitions;
    definition.data.damage = damage;
    expect(getWeaponAttack(definition.name, definition.slug, definition.data, ctx.evalResult)).toMatchObject({ damage: "Damage unavailable", damageExpression: null });
  });
});
