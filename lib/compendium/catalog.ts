import {
  ARMOR_CATEGORIES,
  CREATURE_SIZES,
  ITEM_RARITIES,
  MAGIC_SCHOOLS,
  WEAPON_CATEGORIES,
  WEAPON_RANGE_TYPES,
} from "@/lib/types/taxonomies";

export const COMPENDIUM_CATEGORIES = {
  classes: {
    label: "Classes",
    singular: "Class",
    description: "Core class rules, progression, proficiencies, and spellcasting.",
    contentTypes: ["class"],
  },
  races: {
    label: "Species / Races",
    singular: "Species / Race",
    description: "Ancestries, movement, senses, languages, and innate traits.",
    contentTypes: ["race"],
  },
  backgrounds: {
    label: "Backgrounds",
    singular: "Background",
    description: "Origins, proficiencies, equipment, and defining features.",
    contentTypes: ["background"],
  },
  feats: {
    label: "Feats",
    singular: "Feat",
    description: "Optional talents, prerequisites, actions, and limited resources.",
    contentTypes: ["feat"],
  },
  spells: {
    label: "Spells",
    singular: "Spell",
    description: "Search spell levels, schools, rituals, and concentration rules.",
    contentTypes: ["spell"],
  },
  items: {
    label: "Items",
    singular: "Item",
    description: "Adventuring gear and magic items available to your table.",
    contentTypes: ["item", "magic_item"],
  },
  weapons: {
    label: "Weapons",
    singular: "Weapon",
    description: "Weapon categories, ranges, damage, and properties.",
    contentTypes: ["weapon"],
  },
  armor: {
    label: "Armor",
    singular: "Armor",
    description: "Armor class, strength requirements, and stealth rules.",
    contentTypes: ["armor"],
  },
} as const;

export type CompendiumCategory = keyof typeof COMPENDIUM_CATEGORIES;

export const COMPENDIUM_CATEGORY_KEYS = Object.keys(
  COMPENDIUM_CATEGORIES,
) as CompendiumCategory[];

export function isCompendiumCategory(value: string): value is CompendiumCategory {
  return Object.hasOwn(COMPENDIUM_CATEGORIES, value);
}

export const COMPENDIUM_PROVENANCE = ["all", "srd", "mine", "shared"] as const;
export type CompendiumProvenanceFilter = (typeof COMPENDIUM_PROVENANCE)[number];

export const COMPENDIUM_SORTS = ["name-asc", "name-desc", "newest"] as const;
export type CompendiumSort = (typeof COMPENDIUM_SORTS)[number];

export const COMPENDIUM_PAGE_SIZE = 24;

export interface CompendiumQuery {
  system: string | null;
  category: CompendiumCategory;
  q: string;
  provenance: CompendiumProvenanceFilter;
  sort: CompendiumSort;
  page: number;
  level: string | null;
  school: string | null;
  ritual: boolean;
  concentration: boolean;
  rarity: string | null;
  attunement: string | null;
  size: string | null;
  weaponCategory: string | null;
  weaponRange: string | null;
  armorCategory: string | null;
  hitDie: string | null;
}

type RawSearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function oneOf<T extends readonly string[]>(
  value: string | undefined,
  options: T,
): T[number] | null {
  return value && options.includes(value) ? (value as T[number]) : null;
}

function optionalInteger(
  value: string | undefined,
  min: number,
  max: number,
): string | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return parsed >= min && parsed <= max ? String(parsed) : null;
}

export function parseCompendiumQuery(params: RawSearchParams): CompendiumQuery {
  const rawCategory = one(params.category);
  const rawPage = Number(one(params.page));
  const category = rawCategory && isCompendiumCategory(rawCategory)
    ? rawCategory
    : "spells";

  return {
    system: one(params.system) ?? null,
    category,
    q: (one(params.q) ?? "").trim().slice(0, 120),
    provenance: oneOf(one(params.provenance), COMPENDIUM_PROVENANCE) ?? "all",
    sort: oneOf(one(params.sort), COMPENDIUM_SORTS) ?? "name-asc",
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 999) : 1,
    level: optionalInteger(one(params.level), 0, 9),
    school: oneOf(one(params.school), MAGIC_SCHOOLS),
    ritual: one(params.ritual) === "true",
    concentration: one(params.concentration) === "true",
    rarity: oneOf(one(params.rarity), ITEM_RARITIES),
    attunement: oneOf(one(params.attunement), ["required", "not-required"] as const),
    size: oneOf(one(params.size), CREATURE_SIZES),
    weaponCategory: oneOf(one(params.weaponCategory), WEAPON_CATEGORIES),
    weaponRange: oneOf(one(params.weaponRange), WEAPON_RANGE_TYPES),
    armorCategory: oneOf(one(params.armorCategory), ARMOR_CATEGORIES),
    hitDie: oneOf(one(params.hitDie), ["6", "8", "10", "12"] as const),
  };
}

export function compendiumHref(
  query: CompendiumQuery,
  changes: Partial<CompendiumQuery> = {},
): string {
  const next = { ...query, ...changes };
  const params = new URLSearchParams();

  if (next.system) params.set("system", next.system);
  params.set("category", next.category);
  if (next.q) params.set("q", next.q);
  if (next.provenance !== "all") params.set("provenance", next.provenance);
  if (next.sort !== "name-asc") params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));

  const optional: Array<[string, string | null]> = [
    ["level", next.level],
    ["school", next.school],
    ["rarity", next.rarity],
    ["attunement", next.attunement],
    ["size", next.size],
    ["weaponCategory", next.weaponCategory],
    ["weaponRange", next.weaponRange],
    ["armorCategory", next.armorCategory],
    ["hitDie", next.hitDie],
  ];
  for (const [key, value] of optional) {
    if (value) params.set(key, value);
  }
  if (next.ritual) params.set("ritual", "true");
  if (next.concentration) params.set("concentration", "true");

  return `/library?${params.toString()}`;
}

export function resetCategoryFilters(
  query: CompendiumQuery,
  category: CompendiumCategory,
): CompendiumQuery {
  return {
    ...query,
    category,
    page: 1,
    level: null,
    school: null,
    ritual: false,
    concentration: false,
    rarity: null,
    attunement: null,
    size: null,
    weaponCategory: null,
    weaponRange: null,
    armorCategory: null,
    hitDie: null,
  };
}

export const COMPENDIUM_FILTER_OPTIONS = {
  magicSchools: MAGIC_SCHOOLS,
  itemRarities: ITEM_RARITIES,
  creatureSizes: CREATURE_SIZES,
  weaponCategories: WEAPON_CATEGORIES,
  weaponRanges: WEAPON_RANGE_TYPES,
  armorCategories: ARMOR_CATEGORIES,
} as const;
