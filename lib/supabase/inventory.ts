import { createClient } from "@/lib/supabase/client";
import {
  parseContentDefinitions,
  parseNestedContentVersionSnapshot,
  type ParsedContentDefinition,
} from "@/lib/supabase/content-definitions-parser";
import type { InventoryItem } from "@/lib/types/inventory";

const INVENTORY_SELECT =
  `*, content_versions!character_inventory_content_version_fkey(
    content_id, version, system_id_snapshot, content_type_snapshot,
    slug_snapshot, name_snapshot, data_snapshot, effects_snapshot,
    source_snapshot, scope_snapshot, owner_id_snapshot
  )`;

function parseInventoryRow(raw: Record<string, unknown>): InventoryItem {
  return {
    ...raw,
    content_definitions: parseNestedContentVersionSnapshot(
      raw.content_versions,
    ),
  } as unknown as InventoryItem;
}

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
    throw error;
  }
  return (data ?? []).map((row) =>
    parseInventoryRow(row as Record<string, unknown>),
  );
}

export async function addInventoryItem(
  characterId: string,
  item: {
    content_id?: string | null;
    content_version?: number | null;
    name: string;
    content_type: string;
    quantity?: number;
    custom_data?: Record<string, unknown> | null;
  },
): Promise<InventoryItem | null> {
  if (item.content_id && !Number.isInteger(item.content_version)) {
    throw new Error("A definition-backed inventory item requires a content version.");
  }
  if (!item.content_id && item.content_version != null) {
    throw new Error("A custom inventory item cannot specify a content version.");
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("character_inventory")
    .insert({
      character_id: characterId,
      content_id: item.content_id ?? null,
      content_version: item.content_id ? item.content_version : null,
      name: item.name,
      content_type: item.content_type,
      quantity: item.quantity ?? 1,
      custom_data: item.custom_data ?? null,
    })
    .select(INVENTORY_SELECT)
    .single();

  if (error) {
    throw error;
  }
  return data ? parseInventoryRow(data as Record<string, unknown>) : null;
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
    throw error;
  }
}

export async function removeInventoryItem(itemId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("character_inventory")
    .delete()
    .eq("id", itemId);

  if (error) {
    throw error;
  }
}

export interface SearchItemsOptions {
  contentType?: string;
  equipmentCategory?: string;
  magicalOnly?: boolean;
}

export type ItemSearchResult = Omit<
  ParsedContentDefinition,
  "effects"
> & {
  effects: Array<Record<string, unknown>>;
};

export async function searchItems(
  systemId: string,
  query: string,
  options?: SearchItemsOptions,
): Promise<
  ItemSearchResult[]
> {
  const supabase = createClient();
  let builder = supabase
    .from("content_definitions")
    .select(
      "id, name, slug, content_type, data, effects, version, source, system_id, scope, owner_id",
    )
    .eq("system_id", systemId)
    .ilike("name", `%${query}%`);

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

  const { data, error } = await builder.order("name").limit(50);
  if (error) {
    throw error;
  }
  return parseContentDefinitions(data ?? []).map((definition) => ({
    ...definition,
    effects: definition.effects as unknown as Array<Record<string, unknown>>,
  }));
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
    throw error;
  }
}
