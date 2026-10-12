import { describe, expect, it } from "vitest";
import { buildCharacterPrintModel } from "@/lib/character/print-model";
import { canonicalWeaponRef } from "../../../e2e/print/canonical-weapons";
import { printFixture } from "../../../e2e/print/fixtures";

describe("print attack and inventory canonical weapon representation", () => {
  it("retains parsed damage/type/range instead of a fabricated fallback", () => {
    const ctx = printFixture("martial"), ref = canonicalWeaponRef("ranged");
    ctx.contentRefs = [ref];
    ctx.inventory = [{ ...ctx.inventory[0], content_id: ref.content_id, content_version: ref.content_version, content_type: "weapon", name: ref.content_definitions.name, content_definitions: ref.content_definitions, custom_data: null }];
    ctx.evalResult.grants = [{ type: "grant", stat: "simple_weapons", value: "proficient" }];
    const model = buildCharacterPrintModel(ctx);
    expect(model.attacks[0].details).toContain("Hit +1 | Damage 1d8 +1 piercing | 120/480 ft");
    expect(model.inventory[0].details).toContain("1d8 piercing");
    expect(model.inventory[0].details).toContain("120/480 ft");
    expect(model.attacks[0].details).not.toContain("1d4");
  });
  it("reports a canonical missing damage field as unavailable", () => {
    const ctx = printFixture("martial"), ref = canonicalWeaponRef("melee");
    ref.content_definitions.data.damage = null; ctx.contentRefs = [ref];
    expect(buildCharacterPrintModel(ctx).attacks[0].details).toContain("Damage unavailable");
  });
});
