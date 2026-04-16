import { createClient } from "@/lib/supabase/client";
import type { InventoryItem } from "@/lib/types/inventory";

const INVENTORY_SELECT =
  "*, content_definitions(id, name, slug, content_type, data, effects)";

export async function getInventoryForCharacter(
  characterId: string,
): Promise<InventoryItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("character_inventory")
    .select(INVENTORY_SELECT)
    .eq("character_id", characterId)
    .order("sort_order")
    .order("name");

  if (error) {
    console.error("[getInventory] Error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function addInventoryItem(
  characterId: string,
  item: {
    content_id?: string | null;
    name: string;
    content_type: string;
    quantity?: number;
    custom_data?: Record<string, unknown> | null;
  },
): Promise<InventoryItem | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("character_inventory")
    .insert({
      character_id: characterId,
      content_id: item.content_id ?? null,
      name: item.name,
      content_type: item.content_type,
      quantity: item.quantity ?? 1,
      custom_data: item.custom_data ?? null,
    })
    .select(INVENTORY_SELECT)
    .single();

  if (error) {
    console.error("[addInventoryItem] Error:", error.message);
    return null;
  }
  return data;
}

export async function updateInventoryItem(
  itemId: string,
  updates: Partial<
    Pick<
      InventoryItem,
      "quantity" | "equipped" | "attuned" | "notes" | "sort_order" | "custom_data"
    >
  >,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("character_inventory")
    .update(updates)
    .eq("id", itemId);

  if (error) {
    console.error("[updateInventoryItem] Error:", error.message);
  }
}

export async function removeInventoryItem(itemId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("character_inventory")
    .delete()
    .eq("id", itemId);

  if (error) {
    console.error("[removeInventoryItem] Error:", error.message);
  }
}

export interface SearchItemsOptions {
  contentType?: string;
  equipmentCategory?: string;
  magicalOnly?: boolean;
}

export async function searchItems(
  systemId: string,
  query: string,
  options?: SearchItemsOptions,
): Promise<
  Array<{
    id: string;
    name: string;
    slug: string;
    content_type: string;
    data: Record<string, unknown>;
    effects: Array<Record<string, unknown>>;
  }>
> {
  const supabase = createClient();
  let builder = supabase
    .from("content_definitions")
    .select("id, name, slug, content_type, data, effects")
    .eq("system_id", systemId)
    .eq("scope", "platform")
    .ilike("name", `%${query}%`)
    .order("name")
    .limit(50);

  // Equipment category filter
  if (options?.equipmentCategory === "Weapon") {
    builder = builder.or(
      "content_type.eq.weapon,and(content_type.eq.magic_item,data->>equipment_category.eq.Weapon)",
    );
  } else if (options?.equipmentCategory === "Armor") {
    builder = builder.or(
      "content_type.eq.armor,and(content_type.eq.magic_item,data->>equipment_category.eq.Armor)",
    );
  } else if (options?.equipmentCategory === "Gear") {
    builder = builder.eq("content_type", "item");
  } else if (options?.equipmentCategory) {
    builder = builder
      .eq("content_type", "magic_item")
      .eq("data->>equipment_category", options.equipmentCategory);
  } else if (options?.contentType) {
    builder = builder.eq("content_type", options.contentType);
  } else {
    builder = builder.in("content_type", [
      "weapon",
      "armor",
      "item",
      "magic_item",
    ]);
  }

  // Magical-only filter: items with effects or non-Common rarity
  if (options?.magicalOnly) {
    builder = builder.or(
      "effects.neq.[],and(data->>rarity.neq.null,data->>rarity.neq.Common)",
    );
  }

  const { data, error } = await builder;
  if (error) {
    console.error("[searchItems] Error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function unequipAllArmor(characterId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("character_inventory")
    .update({ equipped: false })
    .eq("character_id", characterId)
    .eq("content_type", "armor")
    .eq("equipped", true);

  if (error) {
    console.error("[unequipAllArmor] Error:", error.message);
  }
}
