import { describe, it, expect } from "vitest";
import { transformEquipmentEntry } from "@/scripts/transformers/equipment";

describe("transformEquipmentEntry", () => {
  it("transforms a weapon (longsword)", () => {
    const apiItem = {
      index: "longsword",
      name: "Longsword",
      equipment_category: { index: "weapon", name: "Weapon" },
      weapon_category: "Martial",
      weapon_range: "Melee",
      category_range: "Martial Melee",
      cost: { quantity: 15, unit: "gp" },
      weight: 3,
      damage: { damage_dice: "1d8", damage_type: { index: "slashing", name: "Slashing" } },
      range: { normal: 5 },
      properties: [{ index: "versatile", name: "Versatile" }],
      two_handed_damage: { damage_dice: "1d10", damage_type: { index: "slashing", name: "Slashing" } },
    };

    const result = transformEquipmentEntry(apiItem);
    expect(result.content_type).toBe("weapon");
    expect(result.data.weapon_category).toBe("Martial");
    expect(result.data.damage).toEqual({ dice: "1d8", type: "slashing" });
    expect(result.data.two_handed_damage).toEqual({ dice: "1d10", type: "slashing" });
  });

  it("transforms armor (chain mail)", () => {
    const apiItem = {
      index: "chain-mail",
      name: "Chain Mail",
      equipment_category: { index: "armor", name: "Armor" },
      armor_category: "Heavy",
      armor_class: { base: 16, dex_bonus: false, max_bonus: null },
      str_minimum: 13,
      stealth_disadvantage: true,
      cost: { quantity: 75, unit: "gp" },
      weight: 55,
    };

    const result = transformEquipmentEntry(apiItem);
    expect(result.content_type).toBe("armor");
    expect(result.data.armor_category).toBe("Heavy");
    expect(result.data.armor_class).toEqual({ base: 16, dex_bonus: false, max_bonus: null });
  });

  it("transforms general equipment", () => {
    const apiItem = {
      index: "backpack",
      name: "Backpack",
      equipment_category: { index: "adventuring-gear", name: "Adventuring Gear" },
      cost: { quantity: 2, unit: "gp" },
      weight: 5,
      desc: ["A backpack can hold..."],
    };

    const result = transformEquipmentEntry(apiItem);
    expect(result.content_type).toBe("item");
    expect(result.data.equipment_category).toBe("Adventuring Gear");
  });
});
