import { fetchAllFromApi, buildContentEntry } from "./common";
import type { TransformedContent } from "./common";

interface ApiEquipment {
  index: string;
  name: string;
  equipment_category: { index: string; name: string };
  weapon_category?: string;
  weapon_range?: string;
  category_range?: string;
  armor_category?: string;
  armor_class?: { base: number; dex_bonus: boolean; max_bonus: number | null };
  str_minimum?: number;
  stealth_disadvantage?: boolean;
  cost?: { quantity: number; unit: string };
  weight?: number;
  damage?: { damage_dice: string; damage_type: { index: string; name: string } };
  two_handed_damage?: { damage_dice: string; damage_type: { index: string; name: string } };
  range?: { normal: number; long?: number };
  properties?: Array<{ index: string; name: string }>;
  desc?: string[];
}

export function transformEquipmentEntry(apiItem: ApiEquipment): TransformedContent {
  const category = apiItem.equipment_category.index;

  if (category === "weapon" && apiItem.weapon_category) {
    // Phase 3: monkweapon — the dnd5eapi does not tag monk weapons via properties,
    // so we default to false. Correct values are populated via SQL migration or manual correction.
    // Phase 3: ability, ammo, and baseWeapon are not available from the API
    // and are either MPMB-seeded or set via homebrew creation.
    return buildContentEntry("weapon", apiItem.index, apiItem.name, {
      weapon_category: apiItem.weapon_category,
      weapon_range: apiItem.weapon_range ?? "Melee",
      cost: apiItem.cost ?? null,
      weight: apiItem.weight ?? null,
      damage: apiItem.damage
        ? { dice: apiItem.damage.damage_dice, type: apiItem.damage.damage_type.index }
        : null,
      range: apiItem.range ?? null,
      properties: (apiItem.properties ?? []).map((p) => p.index),
      two_handed_damage: apiItem.two_handed_damage
        ? { dice: apiItem.two_handed_damage.damage_dice, type: apiItem.two_handed_damage.damage_type.index }
        : null,
      monkweapon: false,
      source_refs: [{ book: "SRD", page: 0 }],
    });
  }

  if (category === "armor" && apiItem.armor_category) {
    return buildContentEntry("armor", apiItem.index, apiItem.name, {
      armor_category: apiItem.armor_category,
      cost: apiItem.cost ?? null,
      weight: apiItem.weight ?? null,
      armor_class: apiItem.armor_class ?? { base: 0, dex_bonus: false, max_bonus: null },
      str_minimum: apiItem.str_minimum ?? 0,
      stealth_disadvantage: apiItem.stealth_disadvantage ?? false,
    });
  }

  // General equipment
  return buildContentEntry("item", apiItem.index, apiItem.name, {
    equipment_category: apiItem.equipment_category.name,
    cost: apiItem.cost ?? null,
    weight: apiItem.weight ?? null,
    description: (apiItem.desc ?? []).join("\n"),
  });
}

export async function transformEquipment(): Promise<TransformedContent[]> {
  const equipment = await fetchAllFromApi<ApiEquipment>("/equipment");
  return equipment.map(transformEquipmentEntry);
}
