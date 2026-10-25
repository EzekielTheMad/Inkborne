import { describe, expect, it } from "vitest";
import { resolveBuilderEquipmentPreview } from "@/lib/builder/preview-equipment";
import { evaluate } from "@/lib/engine/evaluator";
import { subclassResilienceMechanics } from "@/scripts/transformers/classes";
import type { InventoryItem } from "@/lib/types/inventory";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import { draconicLevels, draconicResilienceSource, draconicRoot, hpId } from "../../fixtures/subclass-hit-points";

export function equippedArmor(category = "Light", base = 11, n = 1): InventoryItem {
  const data = { armor_category: category, armor_class: { base, dex_bonus: true, max_bonus: category === "Medium" ? 2 : null } };
  return { id: hpId(100 + n), character_id: hpId(1), content_id: hpId(200 + n), content_version: 1,
    name: "Saved armor", content_type: "armor", equipped: true, attuned: false, quantity: 1, sort_order: 0, notes: null,
    created_at: "2026-10-24T00:00:00Z", custom_data: null,
    content_definitions: { id: hpId(200 + n), system_id: hpId(2), version: 1, content_type: "armor", slug: "saved-armor",
      name: "Saved armor", source: "srd", scope: "platform", owner_id: null, data, effects: [] },
  } as InventoryItem;
}
const schema: SystemSchemaDefinition = { ability_scores: [{ slug: "dexterity", name: "Dexterity", abbr: "DEX" }],
  proficiency_levels: [], derived_stats: [{ slug: "armor_class", name: "Armor Class", formula: "10 + mod(dexterity)" }],
  skills: [], resources: [], content_types: [], currencies: [], creation_steps: [], sheet_sections: [],
};
const scales = subclassResilienceMechanics(draconicRoot, draconicLevels, draconicResilienceSource).effects;

describe("class preview equipped snapshot context", () => {
  it("preserves the existing empty-state unarmored default and confirms no-equipped-items AC15", () => {
    expect(evaluate({ dexterity: 14 }, scales, schema, undefined, {}).computed.armor_class).toBe(15);
    const preview = resolveBuilderEquipmentPreview(hpId(1), hpId(2), []);
    expect(preview).toEqual({ effects: [], state: { equipped_armor: "none", shield_equipped: false } });
    expect(evaluate({ dexterity: 14 }, [...scales, ...preview.effects], schema, undefined, preview.state).computed.armor_class).toBe(15);
  });
  it.each([["Light", 11, 13], ["Medium", 14, 16], ["Heavy", 18, 18]] as const)("uses saved %s body armor instead of treating gear as absent", (category, base, expected) => {
    const item = equippedArmor(category, base); if (category === "Heavy") item.custom_data = { armor_class: { base, dex_bonus: false } };
    const before = JSON.stringify(item), preview = resolveBuilderEquipmentPreview(hpId(1), hpId(2), [item]);
    const staleState = { equipped_armor: "none", shield_equipped: false };
    const state = { ...staleState, ...preview.state };
    expect(evaluate({ dexterity: 14 }, [...scales, ...preview.effects], schema, undefined, state).computed.armor_class).toBe(expected);
    expect(JSON.stringify(item)).toBe(before);
  });
  it("uses custom data overrides and passes shield presence through existing provider semantics", () => {
    const item = equippedArmor(); item.custom_data = { armor_class: { base: 12, dex_bonus: true } };
    const shield = equippedArmor("Shield", 2, 2);
    const preview = resolveBuilderEquipmentPreview(hpId(1), hpId(2), [item, shield]);
    expect(preview.state).toEqual({ equipped_armor: "light", shield_equipped: true });
    expect(evaluate({ dexterity: 14 }, [...scales, ...preview.effects], schema, undefined, preview.state).computed.armor_class).toBe(14);
  });
  it.each(["missing", "version", "system", "character", "type", "custom", "unequipped", "duplicate-body"])("refuses %s equipment evidence instead of assuming unarmored", mode => {
    const item = equippedArmor(), items = [item];
    if (mode === "missing") item.content_definitions = null;
    if (mode === "version") item.content_version = 2;
    if (mode === "system") item.content_definitions!.system_id = hpId(99);
    if (mode === "character") item.character_id = hpId(99);
    if (mode === "type") item.content_type = "weapon";
    if (mode === "custom") item.custom_data = { armor_class: { base: "15", dex_bonus: true } };
    if (mode === "unequipped") item.equipped = false;
    if (mode === "duplicate-body") items.push(equippedArmor("Medium", 14, 2));
    expect(() => resolveBuilderEquipmentPreview(hpId(1), hpId(2), items)).toThrow("Saved equipped items are unavailable");
  });
});
