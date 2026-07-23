import "server-only";

import {
  COMPENDIUM_CATEGORIES,
  COMPENDIUM_PAGE_SIZE,
  type CompendiumQuery,
} from "@/lib/compendium/catalog";
import type {
  CompendiumEntry,
  CompendiumResultPage,
  CompendiumSystem,
} from "@/lib/compendium/types";
import {
  parseContentDefinition,
  parseContentDefinitions,
} from "@/lib/supabase/content-definitions-parser";
import { createClient } from "@/lib/supabase/server";

const CONTENT_SELECT =
  "id, name, slug, content_type, data, effects, version, source, system_id, scope, owner_id";

export async function listCompendiumSystems(): Promise<CompendiumSystem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("game_systems")
    .select("id, name, slug, version_label")
    .eq("status", "published")
    .order("name");

  if (error) throw error;

  return (data ?? []).map((system) => ({
    id: system.id,
    name: system.name,
    slug: system.slug,
    versionLabel: system.version_label,
  }));
}

export async function listCompendiumEntries(
  query: CompendiumQuery,
  userId: string,
): Promise<CompendiumResultPage> {
  if (!query.system) {
    return { entries: [], total: 0, page: query.page, pageSize: COMPENDIUM_PAGE_SIZE };
  }

  const supabase = await createClient();
  const category = COMPENDIUM_CATEGORIES[query.category];
  let request = supabase
    .from("content_definitions")
    .select(CONTENT_SELECT, { count: "exact" })
    .eq("system_id", query.system)
    .in("content_type", [...category.contentTypes])
    .eq("is_retired", false);

  if (query.q) request = request.ilike("name", `%${query.q}%`);

  if (query.provenance === "srd") {
    request = request.eq("source", "srd");
  } else if (query.provenance === "mine") {
    request = request.eq("owner_id", userId);
  } else if (query.provenance === "shared") {
    request = request.eq("source", "homebrew").neq("owner_id", userId);
  }

  if (query.category === "spells") {
    if (query.level) request = request.filter("data->>level", "eq", query.level);
    if (query.school) request = request.filter("data->>school", "eq", query.school);
    if (query.ritual) request = request.filter("data->>ritual", "eq", "true");
    if (query.concentration) {
      request = request.filter("data->>concentration", "eq", "true");
    }
  } else if (query.category === "items") {
    if (query.rarity) request = request.filter("data->>rarity", "eq", query.rarity);
    if (query.attunement === "required") {
      request = request
        .eq("content_type", "magic_item")
        .filter("data->>requires_attunement", "eq", "true");
    } else if (query.attunement === "not-required") {
      request = request
        .eq("content_type", "magic_item")
        .filter("data->>requires_attunement", "eq", "false");
    }
  } else if (query.category === "races" && query.size) {
    request = request.filter("data->>size", "eq", query.size);
  } else if (query.category === "weapons") {
    if (query.weaponCategory) {
      request = request.filter("data->>weapon_category", "eq", query.weaponCategory);
    }
    if (query.weaponRange) {
      request = request.filter("data->>weapon_range", "eq", query.weaponRange);
    }
  } else if (query.category === "armor" && query.armorCategory) {
    request = request.filter("data->>armor_category", "eq", query.armorCategory);
  } else if (query.category === "classes" && query.hitDie) {
    request = request.filter("data->>hit_die", "eq", query.hitDie);
  }

  if (query.sort === "newest") {
    request = request
      .order("created_at", { ascending: false })
      .order("name")
      .order("id");
  } else {
    request = request
      .order("name", { ascending: query.sort === "name-asc" })
      .order("id");
  }

  const from = (query.page - 1) * COMPENDIUM_PAGE_SIZE;
  const { data, error, count } = await request.range(
    from,
    from + COMPENDIUM_PAGE_SIZE - 1,
  );

  if (error) throw error;

  return {
    entries: parseContentDefinitions(data ?? []) as CompendiumEntry[],
    total: count ?? 0,
    page: query.page,
    pageSize: COMPENDIUM_PAGE_SIZE,
  };
}

export async function getCompendiumEntry(
  entryId: string,
): Promise<CompendiumEntry | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_definitions")
    .select(CONTENT_SELECT)
    .eq("id", entryId)
    .eq("is_retired", false)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return parseContentDefinition(data) as CompendiumEntry | null;
}
