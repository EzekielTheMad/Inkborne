import type { InventoryItem } from "@/lib/types/inventory";

/**
 * Merged item data: content_definitions.data plus custom_data overrides.
 * custom_data fields win over inherited fields.
 */
export function getItemData(item: InventoryItem): Record<string, unknown> {
  const base = (item.content_definitions?.data ?? {}) as Record<string, unknown>;
  const custom = (item.custom_data ?? {}) as Record<string, unknown>;
  return { ...base, ...custom };
}

/**
 * Item weight in pounds. custom_data.weight wins over content definition weight.
 * Returns 0 if no numeric weight is available.
 */
export function getItemWeight(item: InventoryItem): number {
  const data = getItemData(item);
  const weight = data.weight;
  return typeof weight === "number" ? weight : 0;
}

/**
 * True if the item's armor_category is "Shield". Works for items stored as
 * either content_type="armor" or content_type="magic_item" with armor category.
 */
export function isShield(item: InventoryItem): boolean {
  const data = getItemData(item);
  return data.armor_category === "Shield";
}

/**
 * True if the item is body armor (content_type="armor" and not a shield).
 */
export function isBodyArmor(item: InventoryItem): boolean {
  return item.content_type === "armor" && !isShield(item);
}
