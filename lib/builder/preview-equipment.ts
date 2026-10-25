import { z } from "zod";
import { getItemData, isBodyArmor, isShield } from "@/lib/inventory/helpers";
import { generateArmorEffects } from "@/lib/inventory/armor-effects";
import { armorDataSchema } from "@/lib/schemas/content-types/armor";
import type { InventoryItem } from "@/lib/types/inventory";
import type { Effect } from "@/lib/types/effects";

export type BuilderEquipmentPreview = {
  effects: Effect[];
  state: { equipped_armor: string; shield_equipped: boolean };
};
const armor = armorDataSchema.pick({ armor_category: true, armor_class: true });
const unavailable = () => Error("Saved equipped items are unavailable. Reload or restore the character's saved equipment.");

/** The class sidebar uses the same body-armor math and derived fields as the
 * sheet provider. An unreadable equipped pin is never interpreted as no armor.
 * This does not add a separate shield bonus or change live sheet mechanics. */
export function resolveBuilderEquipmentPreview(characterId: string, systemId: string,
  equippedItems: readonly InventoryItem[]): BuilderEquipmentPreview {
  if (!z.uuid().safeParse(characterId).success || !z.uuid().safeParse(systemId).success
    || new Set(equippedItems.map(item => item.id)).size !== equippedItems.length) throw unavailable();
  for (const item of equippedItems) {
    if (!z.uuid().safeParse(item.id).success || item.character_id !== characterId || item.equipped !== true
      || item.custom_data !== null && (typeof item.custom_data !== "object" || Array.isArray(item.custom_data))) throw unavailable();
    if (item.content_id !== null) {
      const definition = item.content_definitions;
      if (!definition || !z.uuid().safeParse(item.content_id).success || !Number.isInteger(item.content_version)
        || item.content_version! < 1 || definition.id !== item.content_id || definition.version !== item.content_version
        || definition.system_id !== systemId || definition.content_type !== item.content_type) throw unavailable();
    } else if (item.content_version !== null || item.content_definitions) throw unavailable();
    if ((isBodyArmor(item) || isShield(item)) && !armor.safeParse(getItemData(item)).success) throw unavailable();
  }
  const bodies = equippedItems.filter(isBodyArmor);
  if (bodies.length > 1) throw unavailable();
  const body = bodies[0];
  const data = body ? armor.parse(getItemData(body)) : null;
  return { effects: generateArmorEffects(data), state: {
    equipped_armor: data ? data.armor_category.toLowerCase() : "none",
    shield_equipped: equippedItems.some(isShield),
  } };
}
