import type { Currency } from "@/lib/types/inventory";
import type { StartingEquipmentSelections } from "@/lib/types/character";

/**
 * Starting-equipment choice parsing + resolution for the builder equipment step.
 *
 * Class equipment (migration 00018) is MPMB-seeded prose with semicolon-separated
 * groups: "A mace or a warhammer (if proficient); scale mail, leather armor, or
 * chain mail (if proficient); …". Background equipment (migration 00017) is a
 * single comma list: "A holy symbol, a prayer book or prayer wheel, 5 sticks of
 * incense, …, and a pouch containing 15 gp".
 *
 * Everything in this module is pure so parsing, completeness gating, and grant
 * building are unit-testable without a DOM or Supabase.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Trimmed catalog row passed from the server (content_definitions subset). */
export interface EquipmentCatalogItem {
  id: string;
  name: string;
  slug: string;
  content_type: string; // "weapon" | "armor" | "item"
  weapon_category?: string | null; // "Simple" | "Martial"
  weapon_range?: string | null; // "Melee" | "Ranged"
}

export type NamedCategoryKey =
  | "holy-symbol"
  | "druidic-focus"
  | "arcane-focus"
  | "musical-instrument";

export type EquipmentCategory =
  | {
      kind: "weapon";
      weaponCategory: "Simple" | "Martial";
      weaponRange?: "Melee" | "Ranged";
    }
  | { kind: "named"; key: NamedCategoryKey };

export type ParsedEquipmentItem =
  | { kind: "concrete"; name: string; quantity: number }
  | { kind: "category"; label: string; category: EquipmentCategory; count: number }
  | { kind: "currency"; amount: number; unit: keyof Currency };

export interface EquipmentOption {
  /** Stable id within the group: "a", "b", "c", … */
  id: string;
  /** Display label — the source text verbatim (first letter capitalized). */
  label: string;
  items: ParsedEquipmentItem[];
}

export interface EquipmentGroup {
  /** Stable key: `${source}:${index}` (e.g. "class:2"). */
  key: string;
  source: "class" | "background";
  /** Original group text, for display fallbacks. */
  label: string;
  kind: "choice" | "fixed";
  /** Fixed groups have exactly one option (id "a"). */
  options: EquipmentOption[];
}

/** One dropdown the user must fill for a category placeholder. */
export interface CategorySlot {
  key: string;
  label: string;
  category: EquipmentCategory;
}

export interface CategoryChoice {
  /** Catalog slug, or `custom:<Name>` when the item has no content definition. */
  value: string;
  label: string;
  item: EquipmentCatalogItem | null;
}

export interface InventoryGrant {
  content_id: string | null;
  name: string;
  content_type: string;
  quantity: number;
}

export interface EquipmentGrantResult {
  items: InventoryGrant[];
  currency: Partial<Currency>;
}

// ---------------------------------------------------------------------------
// Phrase parsing
// ---------------------------------------------------------------------------

const QUANTITY_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const CURRENCY_UNITS = new Set(["cp", "sp", "ep", "gp", "pp"]);

const NAMED_CATEGORY_PATTERNS: Array<{ pattern: RegExp; key: NamedCategoryKey }> = [
  { pattern: /^holy symbols?$/, key: "holy-symbol" },
  { pattern: /^druidic (?:focus|foci)$/, key: "druidic-focus" },
  { pattern: /^arcane (?:focus|foci)$/, key: "arcane-focus" },
  { pattern: /^musical instruments?$/, key: "musical-instrument" },
];

/** Concrete SRD members of the named categories. Resolved against the catalog
 *  at render time; names missing from the catalog still work as custom grants. */
export const NAMED_CATEGORY_ITEMS: Record<NamedCategoryKey, string[]> = {
  "holy-symbol": ["Amulet", "Emblem", "Reliquary"],
  "druidic-focus": ["Sprig of mistletoe", "Totem", "Wooden staff", "Yew wand"],
  "arcane-focus": ["Crystal", "Orb", "Rod", "Staff", "Wand"],
  "musical-instrument": [
    "Bagpipes",
    "Drum",
    "Dulcimer",
    "Flute",
    "Horn",
    "Lute",
    "Lyre",
    "Pan flute",
    "Shawm",
    "Viol",
  ],
};

const CATEGORY_LABELS: Record<NamedCategoryKey, string> = {
  "holy-symbol": "Holy symbol",
  "druidic-focus": "Druidic focus",
  "arcane-focus": "Arcane focus",
  "musical-instrument": "Musical instrument",
};

function parseLeadingQuantity(phrase: string): { quantity: number; rest: string } {
  const m = phrase.match(
    /^(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(.+)$/i,
  );
  if (!m) return { quantity: 1, rest: phrase };
  const word = m[1].toLowerCase();
  const quantity = QUANTITY_WORDS[word] ?? Number.parseInt(word, 10);
  return { quantity: Number.isFinite(quantity) ? quantity : 1, rest: m[2] };
}

function matchCategory(rest: string): EquipmentCategory | null {
  const r = rest
    .toLowerCase()
    .replace(/^any\s+/, "")
    .replace(/^other\s+/, "")
    .trim();

  const weaponMatch = r.match(/^(simple|martial)(?:\s+(melee|ranged))?\s+weapons?$/);
  if (weaponMatch) {
    return {
      kind: "weapon",
      weaponCategory: weaponMatch[1] === "simple" ? "Simple" : "Martial",
      weaponRange: weaponMatch[2]
        ? weaponMatch[2] === "melee"
          ? "Melee"
          : "Ranged"
        : undefined,
    };
  }

  for (const { pattern, key } of NAMED_CATEGORY_PATTERNS) {
    if (pattern.test(r)) return { kind: "named", key };
  }
  return null;
}

/** "handaxes" → "handaxe"; "sticks of incense" → "stick of incense". */
function depluralize(name: string): string {
  const stripS = (word: string) =>
    word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;

  const ofIndex = name.indexOf(" of ");
  if (ofIndex > 0) {
    const head = name.slice(0, ofIndex);
    return `${head.split(" ").map(stripS).join(" ")}${name.slice(ofIndex)}`;
  }
  const words = name.split(" ");
  words[words.length - 1] = stripS(words[words.length - 1]);
  return words.join(" ");
}

/** Parses one item phrase ("two handaxes", "a quiver of 20 arrows",
 *  "a pouch containing 15 gp", "any simple weapon") into grant primitives. */
export function parseItemPhrase(raw: string): ParsedEquipmentItem[] {
  const phrase = raw
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\.\s*$/, "")
    .trim();
  if (!phrase) return [];

  // "a pouch containing 15 gp" → container item + currency
  const currencyMatch = phrase.match(/^(.+?)\s+containing\s+(\d+)\s*(cp|sp|ep|gp|pp)$/i);
  if (currencyMatch && CURRENCY_UNITS.has(currencyMatch[3].toLowerCase())) {
    return [
      ...parseItemPhrase(currencyMatch[1]),
      {
        kind: "currency",
        amount: Number.parseInt(currencyMatch[2], 10),
        unit: currencyMatch[3].toLowerCase() as keyof Currency,
      },
    ];
  }

  // "a quiver of 20 arrows" → container item + counted contents
  const containerMatch = phrase.match(/^(.+?)\s+of\s+(\d+)\s+(.+)$/i);
  if (containerMatch) {
    return [
      ...parseItemPhrase(containerMatch[1]),
      ...parseItemPhrase(`${containerMatch[2]} ${containerMatch[3]}`),
    ];
  }

  const { quantity, rest } = parseLeadingQuantity(phrase);

  const category = matchCategory(rest);
  if (category) {
    return [{ kind: "category", label: phrase, category, count: quantity }];
  }

  const name = quantity > 1 ? depluralize(rest.toLowerCase()) : rest.toLowerCase();
  return [{ kind: "concrete", name, quantity }];
}

/** Splits a bundle like "leather armor, a longbow, and 20 arrows" into phrases. */
function splitItemPhrases(text: string): string[] {
  return text
    .replace(/,\s+and\s+/gi, ", ")
    .split(/,\s+/)
    .flatMap((part) => part.split(/\s+and\s+/i))
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Group parsing
// ---------------------------------------------------------------------------

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function buildOption(text: string, index: number): EquipmentOption {
  return {
    id: String.fromCharCode(97 + index), // a, b, c, …
    label: capitalize(text.trim()),
    items: splitItemPhrases(text).flatMap(parseItemPhrase),
  };
}

function parseGroupText(groupText: string): Omit<EquipmentGroup, "key" | "source"> {
  const text = groupText.trim();
  let optionTexts: string[];

  if (/,\s+or\s+/i.test(text)) {
    // Serial-comma alternatives: "scale mail, leather armor, or chain mail"
    const parts = text.split(/,\s+or\s+/i);
    optionTexts = [...parts[0].split(/,\s+/), ...parts.slice(1)];
  } else if (/\s+or\s+/i.test(text)) {
    // Plain alternatives, options may be bundles:
    // "chain mail or leather armor, a longbow, and 20 arrows"
    optionTexts = text.split(/\s+or\s+/i);
  } else {
    optionTexts = [text];
  }

  optionTexts = optionTexts.map((t) => t.trim()).filter(Boolean);
  return {
    label: text,
    kind: optionTexts.length > 1 ? "choice" : "fixed",
    options: optionTexts.map(buildOption),
  };
}

/** Class equipment: semicolon-separated groups. */
export function parseClassEquipmentText(
  text: string,
): Array<Omit<EquipmentGroup, "key" | "source">> {
  return text
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseGroupText);
}

/** Background equipment: one comma list. Elements containing " or " become
 *  their own choice group; runs of fixed elements merge into fixed groups. */
export function parseBackgroundEquipmentText(
  text: string,
): Array<Omit<EquipmentGroup, "key" | "source">> {
  const elements = text
    .replace(/,\s+and\s+/gi, ", ")
    .split(/,\s+/)
    .map((s) => s.trim().replace(/^and\s+/i, ""))
    .filter(Boolean);

  const groups: Array<Omit<EquipmentGroup, "key" | "source">> = [];
  let fixedBuffer: string[] = [];
  const flushFixed = () => {
    if (fixedBuffer.length > 0) {
      groups.push(parseGroupText(fixedBuffer.join(", ")));
      fixedBuffer = [];
    }
  };

  for (const element of elements) {
    if (/\s+or\s+/i.test(element)) {
      flushFixed();
      groups.push(parseGroupText(element));
    } else {
      fixedBuffer.push(element);
    }
  }
  flushFixed();
  return groups;
}

export interface EquipmentSourceTexts {
  classText?: string | null;
  backgroundText?: string | null;
}

/** Parses class + background equipment into keyed groups, class first. */
export function parseEquipmentGroups({
  classText,
  backgroundText,
}: EquipmentSourceTexts): EquipmentGroup[] {
  const classGroups = classText
    ? parseClassEquipmentText(classText).map((g, i) => ({
        ...g,
        key: `class:${i}`,
        source: "class" as const,
      }))
    : [];
  const backgroundGroups = backgroundText
    ? parseBackgroundEquipmentText(backgroundText).map((g, i) => ({
        ...g,
        key: `background:${i}`,
        source: "background" as const,
      }))
    : [];
  return [...classGroups, ...backgroundGroups];
}

// ---------------------------------------------------------------------------
// Category slots + choices
// ---------------------------------------------------------------------------

export function categoryLabel(category: EquipmentCategory): string {
  if (category.kind === "named") return CATEGORY_LABELS[category.key];
  const range = category.weaponRange ? ` ${category.weaponRange.toLowerCase()}` : "";
  return `${category.weaponCategory}${range} weapon`;
}

/** Expands an option's category placeholders into one slot per required pick
 *  ("two martial weapons" → two slots). Slot keys are stable for persistence. */
export function getOptionCategorySlots(
  group: EquipmentGroup,
  option: EquipmentOption,
): CategorySlot[] {
  const slots: CategorySlot[] = [];
  option.items.forEach((item, itemIndex) => {
    if (item.kind !== "category") return;
    for (let n = 0; n < item.count; n++) {
      slots.push({
        key: `${group.key}:${option.id}:${itemIndex}:${n}`,
        label:
          item.count > 1
            ? `${categoryLabel(item.category)} (${n + 1} of ${item.count})`
            : categoryLabel(item.category),
        category: item.category,
      });
    }
  });
  return slots;
}

/** Dropdown choices for a category slot, resolved against the catalog. */
export function getCategoryChoices(
  category: EquipmentCategory,
  catalog: EquipmentCatalogItem[],
): CategoryChoice[] {
  if (category.kind === "weapon") {
    return catalog
      .filter(
        (c) =>
          c.content_type === "weapon" &&
          c.weapon_category === category.weaponCategory &&
          (!category.weaponRange || c.weapon_range === category.weaponRange),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({ value: c.slug, label: c.name, item: c }));
  }

  const index = buildCatalogNameIndex(catalog);
  return NAMED_CATEGORY_ITEMS[category.key].map((name) => {
    const item = index.get(normalizeItemName(name)) ?? null;
    return {
      value: item ? item.slug : `custom:${name}`,
      label: item?.name ?? name,
      item,
    };
  });
}

// ---------------------------------------------------------------------------
// Selection state
// ---------------------------------------------------------------------------

export function emptySelections(): StartingEquipmentSelections {
  return { selections: {}, picks: {} };
}

/** Narrowing helper: chooser-format state (vs legacy "acknowledged" strings). */
export function isStructuredSelections(
  value: string | StartingEquipmentSelections | undefined,
): value is StartingEquipmentSelections {
  return typeof value === "object" && value !== null;
}

export function isEquipmentConfirmed(
  value: string | StartingEquipmentSelections | undefined,
): boolean {
  if (typeof value === "string") return value.length > 0; // legacy flow
  return !!value?.confirmed;
}

export function getActiveOption(
  group: EquipmentGroup,
  selections: Record<string, string>,
): EquipmentOption | null {
  if (group.kind === "fixed") return group.options[0] ?? null;
  const optionId = selections[group.key];
  return group.options.find((o) => o.id === optionId) ?? null;
}

/** True when every choice group has a selection and every category slot
 *  (including those inside fixed groups) has a pick. Gates Confirm. */
export function isSelectionComplete(
  groups: EquipmentGroup[],
  state: StartingEquipmentSelections,
): boolean {
  return groups.every((group) => {
    const option = getActiveOption(group, state.selections);
    if (!option) return false;
    return getOptionCategorySlots(group, option).every(
      (slot) => !!state.picks[slot.key],
    );
  });
}

// ---------------------------------------------------------------------------
// Name resolution + grants
// ---------------------------------------------------------------------------

/** Parsed-name → catalog-name aliases, applied after normalization. */
const NAME_ALIASES: Record<string, string> = {
  bolt: "crossbow bolt",
  "wooden shield": "shield",
};

/** Canonical form for name matching: lowercase, "Crossbow, light" → "light
 *  crossbow", punctuation stripped, "set of " prefix dropped. */
export function normalizeItemName(name: string): string {
  let n = name.toLowerCase().trim();
  const commaIndex = n.indexOf(", ");
  if (commaIndex > 0) {
    n = `${n.slice(commaIndex + 2)} ${n.slice(0, commaIndex)}`;
  }
  n = n
    .replace(/['’.]/g, "")
    .replace(/^set of /, "")
    .replace(/\s+/g, " ")
    .trim();
  return n;
}

function buildCatalogNameIndex(
  catalog: EquipmentCatalogItem[],
): Map<string, EquipmentCatalogItem> {
  const index = new Map<string, EquipmentCatalogItem>();
  for (const item of catalog) {
    const key = normalizeItemName(item.name);
    if (!index.has(key)) index.set(key, item);
  }
  return index;
}

export function resolveCatalogItem(
  parsedName: string,
  catalog: EquipmentCatalogItem[] | Map<string, EquipmentCatalogItem>,
): EquipmentCatalogItem | null {
  const index = catalog instanceof Map ? catalog : buildCatalogNameIndex(catalog);
  const normalized = normalizeItemName(parsedName);
  const candidates = [
    normalized,
    NAME_ALIASES[normalized],
    depluralize(normalized),
    NAME_ALIASES[depluralize(normalized)],
  ].filter((c): c is string => !!c);
  for (const candidate of candidates) {
    const hit = index.get(candidate);
    if (hit) return hit;
  }
  return null;
}

function titleCaseFirst(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Builds the inventory + currency grants for the current selections.
 *  Duplicate grants (e.g. a picked dagger on top of "two daggers") merge into
 *  a single row with a summed quantity. */
export function buildInventoryGrants(
  groups: EquipmentGroup[],
  state: StartingEquipmentSelections,
  catalog: EquipmentCatalogItem[],
): EquipmentGrantResult {
  const nameIndex = buildCatalogNameIndex(catalog);
  const slugIndex = new Map(catalog.map((c) => [c.slug, c]));
  const items: InventoryGrant[] = [];
  const currency: Partial<Currency> = {};

  const push = (grant: InventoryGrant) => {
    const existing = items.find((i) =>
      grant.content_id
        ? i.content_id === grant.content_id
        : i.content_id === null && i.name === grant.name,
    );
    if (existing) existing.quantity += grant.quantity;
    else items.push(grant);
  };

  for (const group of groups) {
    const option = getActiveOption(group, state.selections);
    if (!option) continue;

    for (const item of option.items) {
      if (item.kind === "concrete") {
        const resolved = resolveCatalogItem(item.name, nameIndex);
        push(
          resolved
            ? {
                content_id: resolved.id,
                name: resolved.name,
                content_type: resolved.content_type,
                quantity: item.quantity,
              }
            : {
                content_id: null,
                name: titleCaseFirst(item.name),
                content_type: "item",
                quantity: item.quantity,
              },
        );
      } else if (item.kind === "currency") {
        currency[item.unit] = (currency[item.unit] ?? 0) + item.amount;
      }
    }

    for (const slot of getOptionCategorySlots(group, option)) {
      const value = state.picks[slot.key];
      if (!value) continue;
      if (value.startsWith("custom:")) {
        push({
          content_id: null,
          name: value.slice("custom:".length),
          content_type: "item",
          quantity: 1,
        });
      } else {
        const catalogItem = slugIndex.get(value);
        if (catalogItem) {
          push({
            content_id: catalogItem.id,
            name: catalogItem.name,
            content_type: catalogItem.content_type,
            quantity: 1,
          });
        }
      }
    }
  }

  return { items, currency };
}

/** Short human status for the builder overview card. */
export function describeStartingEquipment(
  value: string | StartingEquipmentSelections | undefined,
): string {
  if (!value) return "Not selected";
  if (typeof value === "string") return value; // legacy: "acknowledged" / "bundle_0"
  if (value.confirmed) return "Confirmed";
  return Object.keys(value.selections).length > 0 || Object.keys(value.picks).length > 0
    ? "In progress"
    : "Not selected";
}
