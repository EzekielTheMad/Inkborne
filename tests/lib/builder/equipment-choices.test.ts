import { describe, it, expect } from "vitest";
import {
  buildInventoryGrants,
  describeStartingEquipment,
  emptySelections,
  getActiveOption,
  getCategoryChoices,
  getOptionCategorySlots,
  isEquipmentConfirmed,
  isSelectionComplete,
  isStructuredSelections,
  normalizeItemName,
  parseBackgroundEquipmentText,
  parseClassEquipmentText,
  parseEquipmentGroups,
  parseItemPhrase,
  resolveCatalogItem,
  type EquipmentCatalogItem,
  type EquipmentGroup,
} from "@/lib/builder/equipment-choices";

// ---------------------------------------------------------------------------
// Fixtures — SRD equipment strings exactly as seeded by migrations 00017/00018
// ---------------------------------------------------------------------------

const CLERIC_EQUIPMENT =
  "A mace or a warhammer (if proficient); scale mail, leather armor, or chain mail (if proficient); a light crossbow and 20 bolts or any simple weapon; a priest's pack or an explorer's pack; a shield and a holy symbol";

const FIGHTER_EQUIPMENT =
  "Chain mail or leather armor, a longbow, and 20 arrows; a martial weapon and a shield or two martial weapons; a light crossbow and 20 bolts or two handaxes; a dungeoneer's pack or an explorer's pack";

const ACOLYTE_EQUIPMENT =
  "A holy symbol, a prayer book or prayer wheel, 5 sticks of incense, vestments, a set of common clothes, and a pouch containing 15 gp";

function catalogItem(
  partial: Partial<EquipmentCatalogItem> & { name: string; slug: string },
): EquipmentCatalogItem {
  return {
    id: `id-${partial.slug}`,
    content_type: "item",
    weapon_category: null,
    weapon_range: null,
    ...partial,
  };
}

const CATALOG: EquipmentCatalogItem[] = [
  catalogItem({ name: "Mace", slug: "mace", content_type: "weapon", weapon_category: "Simple", weapon_range: "Melee" }),
  catalogItem({ name: "Warhammer", slug: "warhammer", content_type: "weapon", weapon_category: "Martial", weapon_range: "Melee" }),
  catalogItem({ name: "Dagger", slug: "dagger", content_type: "weapon", weapon_category: "Simple", weapon_range: "Melee" }),
  catalogItem({ name: "Handaxe", slug: "handaxe", content_type: "weapon", weapon_category: "Simple", weapon_range: "Melee" }),
  catalogItem({ name: "Longsword", slug: "longsword", content_type: "weapon", weapon_category: "Martial", weapon_range: "Melee" }),
  catalogItem({ name: "Longbow", slug: "longbow", content_type: "weapon", weapon_category: "Martial", weapon_range: "Ranged" }),
  catalogItem({ name: "Crossbow, light", slug: "crossbow-light", content_type: "weapon", weapon_category: "Simple", weapon_range: "Ranged" }),
  catalogItem({ name: "Crossbow bolt", slug: "crossbow-bolt" }),
  catalogItem({ name: "Arrow", slug: "arrow" }),
  catalogItem({ name: "Scale Mail", slug: "scale-mail", content_type: "armor" }),
  catalogItem({ name: "Leather Armor", slug: "leather-armor", content_type: "armor" }),
  catalogItem({ name: "Chain Mail", slug: "chain-mail", content_type: "armor" }),
  catalogItem({ name: "Shield", slug: "shield", content_type: "armor" }),
  catalogItem({ name: "Priest's Pack", slug: "priests-pack" }),
  catalogItem({ name: "Explorer's Pack", slug: "explorers-pack" }),
  catalogItem({ name: "Dungeoneer's Pack", slug: "dungeoneers-pack" }),
  catalogItem({ name: "Amulet", slug: "amulet" }),
  catalogItem({ name: "Emblem", slug: "emblem" }),
  catalogItem({ name: "Reliquary", slug: "reliquary" }),
  catalogItem({ name: "Clothes, common", slug: "clothes-common" }),
  catalogItem({ name: "Pouch", slug: "pouch" }),
  catalogItem({ name: "Quiver", slug: "quiver" }),
];

// ---------------------------------------------------------------------------
// Phrase parsing
// ---------------------------------------------------------------------------

describe("parseItemPhrase", () => {
  it("parses a plain item with an article", () => {
    expect(parseItemPhrase("a mace")).toEqual([
      { kind: "concrete", name: "mace", quantity: 1 },
    ]);
  });

  it("parses word quantities and depluralizes", () => {
    expect(parseItemPhrase("two handaxes")).toEqual([
      { kind: "concrete", name: "handaxe", quantity: 2 },
    ]);
    expect(parseItemPhrase("four javelins")).toEqual([
      { kind: "concrete", name: "javelin", quantity: 4 },
    ]);
  });

  it("parses numeric quantities", () => {
    expect(parseItemPhrase("10 darts")).toEqual([
      { kind: "concrete", name: "dart", quantity: 10 },
    ]);
  });

  it("strips parenthetical notes", () => {
    expect(parseItemPhrase("a warhammer (if proficient)")).toEqual([
      { kind: "concrete", name: "warhammer", quantity: 1 },
    ]);
  });

  it("parses containers with counted contents", () => {
    expect(parseItemPhrase("a quiver of 20 arrows")).toEqual([
      { kind: "concrete", name: "quiver", quantity: 1 },
      { kind: "concrete", name: "arrow", quantity: 20 },
    ]);
  });

  it("parses currency containers", () => {
    expect(parseItemPhrase("a pouch containing 15 gp")).toEqual([
      { kind: "concrete", name: "pouch", quantity: 1 },
      { kind: "currency", amount: 15, unit: "gp" },
    ]);
  });

  it("depluralizes the head noun of 'of' phrases", () => {
    expect(parseItemPhrase("5 sticks of incense")).toEqual([
      { kind: "concrete", name: "stick of incense", quantity: 5 },
    ]);
  });

  it("recognizes weapon categories", () => {
    expect(parseItemPhrase("any simple weapon")).toEqual([
      {
        kind: "category",
        label: "any simple weapon",
        category: { kind: "weapon", weaponCategory: "Simple", weaponRange: undefined },
        count: 1,
      },
    ]);
    expect(parseItemPhrase("any martial melee weapon")).toEqual([
      {
        kind: "category",
        label: "any martial melee weapon",
        category: { kind: "weapon", weaponCategory: "Martial", weaponRange: "Melee" },
        count: 1,
      },
    ]);
  });

  it("recognizes counted weapon categories", () => {
    expect(parseItemPhrase("two martial weapons")).toEqual([
      {
        kind: "category",
        label: "two martial weapons",
        category: { kind: "weapon", weaponCategory: "Martial", weaponRange: undefined },
        count: 2,
      },
    ]);
  });

  it("recognizes named categories", () => {
    expect(parseItemPhrase("a holy symbol")[0]).toMatchObject({
      kind: "category",
      category: { kind: "named", key: "holy-symbol" },
    });
    expect(parseItemPhrase("an arcane focus")[0]).toMatchObject({
      kind: "category",
      category: { kind: "named", key: "arcane-focus" },
    });
    expect(parseItemPhrase("a druidic focus")[0]).toMatchObject({
      kind: "category",
      category: { kind: "named", key: "druidic-focus" },
    });
    expect(parseItemPhrase("any other musical instrument")[0]).toMatchObject({
      kind: "category",
      category: { kind: "named", key: "musical-instrument" },
    });
  });
});

// ---------------------------------------------------------------------------
// Class group parsing
// ---------------------------------------------------------------------------

describe("parseClassEquipmentText", () => {
  it("splits semicolon groups (cleric has 5)", () => {
    const groups = parseClassEquipmentText(CLERIC_EQUIPMENT);
    expect(groups).toHaveLength(5);
  });

  it("parses a simple two-way choice", () => {
    const [maceOrWarhammer] = parseClassEquipmentText(CLERIC_EQUIPMENT);
    expect(maceOrWarhammer.kind).toBe("choice");
    expect(maceOrWarhammer.options.map((o) => o.label)).toEqual([
      "A mace",
      "A warhammer (if proficient)",
    ]);
  });

  it("parses serial-comma choices into three options", () => {
    const armorGroup = parseClassEquipmentText(CLERIC_EQUIPMENT)[1];
    expect(armorGroup.kind).toBe("choice");
    expect(armorGroup.options).toHaveLength(3);
    expect(armorGroup.options[2].items).toEqual([
      { kind: "concrete", name: "chain mail", quantity: 1 },
    ]);
  });

  it("parses bundle options (crossbow + bolts vs simple weapon)", () => {
    const crossbowGroup = parseClassEquipmentText(CLERIC_EQUIPMENT)[2];
    expect(crossbowGroup.options).toHaveLength(2);
    expect(crossbowGroup.options[0].items).toEqual([
      { kind: "concrete", name: "light crossbow", quantity: 1 },
      { kind: "concrete", name: "bolt", quantity: 20 },
    ]);
    expect(crossbowGroup.options[1].items[0].kind).toBe("category");
  });

  it("parses fixed groups with a category placeholder", () => {
    const fixedGroup = parseClassEquipmentText(CLERIC_EQUIPMENT)[4];
    expect(fixedGroup.kind).toBe("fixed");
    expect(fixedGroup.options).toHaveLength(1);
    expect(fixedGroup.options[0].items).toEqual([
      { kind: "concrete", name: "shield", quantity: 1 },
      {
        kind: "category",
        label: "a holy symbol",
        category: { kind: "named", key: "holy-symbol" },
        count: 1,
      },
    ]);
  });

  it("keeps commas inside a bundle option (fighter armor group)", () => {
    const [armorGroup, weaponGroup] = parseClassEquipmentText(FIGHTER_EQUIPMENT);
    expect(armorGroup.kind).toBe("choice");
    expect(armorGroup.options).toHaveLength(2);
    expect(armorGroup.options[1].items).toEqual([
      { kind: "concrete", name: "leather armor", quantity: 1 },
      { kind: "concrete", name: "longbow", quantity: 1 },
      { kind: "concrete", name: "arrow", quantity: 20 },
    ]);

    // "a martial weapon and a shield or two martial weapons"
    expect(weaponGroup.options[0].items).toMatchObject([
      { kind: "category", count: 1 },
      { kind: "concrete", name: "shield", quantity: 1 },
    ]);
    expect(weaponGroup.options[1].items).toMatchObject([
      { kind: "category", count: 2 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Background parsing
// ---------------------------------------------------------------------------

describe("parseBackgroundEquipmentText", () => {
  it("parses the acolyte list into fixed + choice groups", () => {
    const groups = parseBackgroundEquipmentText(ACOLYTE_EQUIPMENT);
    expect(groups.map((g) => g.kind)).toEqual(["fixed", "choice", "fixed"]);

    // The embedded "or" becomes its own choice group
    expect(groups[1].options.map((o) => o.label)).toEqual([
      "A prayer book",
      "Prayer wheel",
    ]);

    // The holy symbol requires a category pick even though the group is fixed
    expect(groups[0].options[0].items[0]).toMatchObject({
      kind: "category",
      category: { kind: "named", key: "holy-symbol" },
    });

    // Trailing fixed items include the currency pouch
    const trailingItems = groups[2].options[0].items;
    expect(trailingItems).toContainEqual({ kind: "currency", amount: 15, unit: "gp" });
    expect(trailingItems).toContainEqual({ kind: "concrete", name: "pouch", quantity: 1 });
    expect(trailingItems).toContainEqual({ kind: "concrete", name: "vestments", quantity: 1 });
  });
});

// ---------------------------------------------------------------------------
// Combined sources + keys
// ---------------------------------------------------------------------------

describe("parseEquipmentGroups", () => {
  it("keys class and background groups by source and index", () => {
    const groups = parseEquipmentGroups({
      classText: CLERIC_EQUIPMENT,
      backgroundText: ACOLYTE_EQUIPMENT,
    });
    expect(groups.filter((g) => g.source === "class")).toHaveLength(5);
    expect(groups.filter((g) => g.source === "background")).toHaveLength(3);
    expect(groups[0].key).toBe("class:0");
    expect(groups[5].key).toBe("background:0");
  });

  it("returns an empty list with no sources", () => {
    expect(parseEquipmentGroups({})).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Category slots + choices
// ---------------------------------------------------------------------------

describe("getOptionCategorySlots / getCategoryChoices", () => {
  it("expands counted categories into one slot per pick", () => {
    const groups = parseEquipmentGroups({ classText: FIGHTER_EQUIPMENT });
    const weaponGroup = groups[1];
    const twoWeapons = weaponGroup.options[1];
    const slots = getOptionCategorySlots(weaponGroup, twoWeapons);
    expect(slots).toHaveLength(2);
    expect(slots[0].key).not.toBe(slots[1].key);
    expect(slots[0].label).toContain("1 of 2");
  });

  it("filters weapon choices by category and range", () => {
    const simpleMelee = getCategoryChoices(
      { kind: "weapon", weaponCategory: "Simple", weaponRange: "Melee" },
      CATALOG,
    );
    expect(simpleMelee.map((c) => c.label)).toEqual(["Dagger", "Handaxe", "Mace"]);

    const martial = getCategoryChoices(
      { kind: "weapon", weaponCategory: "Martial" },
      CATALOG,
    );
    expect(martial.map((c) => c.label)).toEqual(["Longbow", "Longsword", "Warhammer"]);
  });

  it("resolves named categories against the catalog with custom fallback", () => {
    const holySymbols = getCategoryChoices(
      { kind: "named", key: "holy-symbol" },
      CATALOG,
    );
    expect(holySymbols.map((c) => c.value)).toEqual(["amulet", "emblem", "reliquary"]);

    const foci = getCategoryChoices({ kind: "named", key: "druidic-focus" }, CATALOG);
    // Not in the fixture catalog → custom values
    expect(foci.every((c) => c.value.startsWith("custom:"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Completeness gating
// ---------------------------------------------------------------------------

describe("isSelectionComplete", () => {
  function clericGroups(): EquipmentGroup[] {
    return parseEquipmentGroups({ classText: CLERIC_EQUIPMENT });
  }

  it("is false with no selections", () => {
    expect(isSelectionComplete(clericGroups(), emptySelections())).toBe(false);
  });

  it("is false until every choice group has a selection", () => {
    const state = {
      selections: { "class:0": "a", "class:1": "b", "class:2": "a" },
      picks: {},
    };
    expect(isSelectionComplete(clericGroups(), state)).toBe(false);
  });

  it("is false while a category slot is unpicked", () => {
    const state = {
      // class:4 is fixed (shield + holy symbol) — its pick is still required
      selections: {
        "class:0": "a",
        "class:1": "b",
        "class:2": "a",
        "class:3": "a",
      },
      picks: {},
    };
    expect(isSelectionComplete(clericGroups(), state)).toBe(false);
  });

  it("is true once all selections and picks are made", () => {
    const state = {
      selections: {
        "class:0": "a",
        "class:1": "b",
        "class:2": "a",
        "class:3": "a",
      },
      picks: { "class:4:a:1:0": "amulet" },
    };
    expect(isSelectionComplete(clericGroups(), state)).toBe(true);
  });

  it("requires picks inside a selected category option", () => {
    const state = {
      selections: {
        "class:0": "a",
        "class:1": "b",
        "class:2": "b", // "any simple weapon" — needs a pick
        "class:3": "a",
      },
      picks: { "class:4:a:1:0": "amulet" },
    };
    expect(isSelectionComplete(clericGroups(), state)).toBe(false);
    expect(
      isSelectionComplete(clericGroups(), {
        ...state,
        picks: { ...state.picks, "class:2:b:0:0": "mace" },
      }),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Name resolution
// ---------------------------------------------------------------------------

describe("normalizeItemName / resolveCatalogItem", () => {
  it("inverts comma-form catalog names", () => {
    expect(normalizeItemName("Crossbow, light")).toBe("light crossbow");
    expect(normalizeItemName("Clothes, common")).toBe("common clothes");
  });

  it("strips punctuation and 'set of' prefixes", () => {
    expect(normalizeItemName("Explorer's Pack")).toBe("explorers pack");
    expect(normalizeItemName("set of common clothes")).toBe("common clothes");
  });

  it("resolves parsed names to catalog rows", () => {
    expect(resolveCatalogItem("light crossbow", CATALOG)?.slug).toBe("crossbow-light");
    expect(resolveCatalogItem("explorer's pack", CATALOG)?.slug).toBe("explorers-pack");
    expect(resolveCatalogItem("set of common clothes", CATALOG)?.slug).toBe("clothes-common");
  });

  it("applies aliases (bolts → crossbow bolt, wooden shield → shield)", () => {
    expect(resolveCatalogItem("bolt", CATALOG)?.slug).toBe("crossbow-bolt");
    expect(resolveCatalogItem("wooden shield", CATALOG)?.slug).toBe("shield");
  });

  it("returns null for unknown items", () => {
    expect(resolveCatalogItem("stick of incense", CATALOG)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Grants
// ---------------------------------------------------------------------------

describe("buildInventoryGrants", () => {
  it("grants the selected options, resolved against the catalog", () => {
    const groups = parseEquipmentGroups({ classText: CLERIC_EQUIPMENT });
    const state = {
      selections: {
        "class:0": "a", // mace
        "class:1": "c", // chain mail
        "class:2": "a", // light crossbow + 20 bolts
        "class:3": "b", // explorer's pack
      },
      picks: { "class:4:a:1:0": "amulet" },
    };

    const { items, currency } = buildInventoryGrants(groups, state, CATALOG);
    expect(currency).toEqual({});
    expect(items).toContainEqual({
      content_id: "id-mace",
      name: "Mace",
      content_type: "weapon",
      quantity: 1,
    });
    expect(items).toContainEqual({
      content_id: "id-chain-mail",
      name: "Chain Mail",
      content_type: "armor",
      quantity: 1,
    });
    expect(items).toContainEqual({
      content_id: "id-crossbow-bolt",
      name: "Crossbow bolt",
      content_type: "item",
      quantity: 20,
    });
    expect(items).toContainEqual({
      content_id: "id-shield",
      name: "Shield",
      content_type: "armor",
      quantity: 1,
    });
    expect(items).toContainEqual({
      content_id: "id-amulet",
      name: "Amulet",
      content_type: "item",
      quantity: 1,
    });
    // Unselected options grant nothing
    expect(items.find((i) => i.name === "Warhammer")).toBeUndefined();
  });

  it("skips groups without a selection", () => {
    const groups = parseEquipmentGroups({ classText: CLERIC_EQUIPMENT });
    const { items } = buildInventoryGrants(groups, emptySelections(), CATALOG);
    // Only the fixed group's concrete items grant (shield); its holy-symbol
    // slot is unpicked so nothing else lands.
    expect(items).toEqual([
      { content_id: "id-shield", name: "Shield", content_type: "armor", quantity: 1 },
    ]);
  });

  it("grants category picks per slot and merges duplicates", () => {
    const groups = parseEquipmentGroups({ classText: FIGHTER_EQUIPMENT });
    const state = {
      selections: {
        "class:0": "a",
        "class:1": "b", // two martial weapons
        "class:2": "b", // two handaxes
        "class:3": "a",
      },
      picks: {
        "class:1:b:0:0": "longsword",
        "class:1:b:0:1": "longsword",
      },
    };
    const { items } = buildInventoryGrants(groups, state, CATALOG);
    expect(items).toContainEqual({
      content_id: "id-longsword",
      name: "Longsword",
      content_type: "weapon",
      quantity: 2,
    });
    expect(items).toContainEqual({
      content_id: "id-handaxe",
      name: "Handaxe",
      content_type: "weapon",
      quantity: 2,
    });
  });

  it("grants background currency and custom-item fallbacks", () => {
    const groups = parseEquipmentGroups({ backgroundText: ACOLYTE_EQUIPMENT });
    const state = {
      selections: { "background:1": "a" }, // prayer book
      picks: { "background:0:a:0:0": "emblem" },
    };
    const { items, currency } = buildInventoryGrants(groups, state, CATALOG);

    expect(currency).toEqual({ gp: 15 });
    expect(items).toContainEqual({
      content_id: "id-emblem",
      name: "Emblem",
      content_type: "item",
      quantity: 1,
    });
    expect(items).toContainEqual({
      content_id: "id-pouch",
      name: "Pouch",
      content_type: "item",
      quantity: 1,
    });
    expect(items).toContainEqual({
      content_id: "id-clothes-common",
      name: "Clothes, common",
      content_type: "item",
      quantity: 1,
    });
    // No SRD content definition → custom item with a readable name
    expect(items).toContainEqual({
      content_id: null,
      name: "Stick of incense",
      content_type: "item",
      quantity: 5,
    });
    expect(items).toContainEqual({
      content_id: null,
      name: "Prayer book",
      content_type: "item",
      quantity: 1,
    });
  });

  it("grants custom picks from named categories", () => {
    const groups = parseEquipmentGroups({ classText: "a druidic focus" });
    const state = {
      selections: {},
      picks: { "class:0:a:0:0": "custom:Totem" },
    };
    const { items } = buildInventoryGrants(groups, state, CATALOG);
    expect(items).toEqual([
      { content_id: null, name: "Totem", content_type: "item", quantity: 1 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

describe("state helpers", () => {
  it("distinguishes legacy strings from structured selections", () => {
    expect(isStructuredSelections("acknowledged")).toBe(false);
    expect(isStructuredSelections(undefined)).toBe(false);
    expect(isStructuredSelections(emptySelections())).toBe(true);
  });

  it("treats legacy strings and confirmed objects as confirmed", () => {
    expect(isEquipmentConfirmed("acknowledged")).toBe(true);
    expect(isEquipmentConfirmed("bundle_0")).toBe(true);
    expect(isEquipmentConfirmed(undefined)).toBe(false);
    expect(isEquipmentConfirmed(emptySelections())).toBe(false);
    expect(isEquipmentConfirmed({ ...emptySelections(), confirmed: true })).toBe(true);
  });

  it("describes progress for the builder overview", () => {
    expect(describeStartingEquipment(undefined)).toBe("Not selected");
    expect(describeStartingEquipment("acknowledged")).toBe("acknowledged");
    expect(describeStartingEquipment(emptySelections())).toBe("Not selected");
    expect(
      describeStartingEquipment({
        selections: { "class:0": "a" },
        picks: {},
      }),
    ).toBe("In progress");
    expect(
      describeStartingEquipment({ ...emptySelections(), confirmed: true }),
    ).toBe("Confirmed");
  });

  it("getActiveOption returns fixed options without a selection", () => {
    const groups = parseEquipmentGroups({ classText: "a spellbook" });
    expect(getActiveOption(groups[0], {})?.items).toEqual([
      { kind: "concrete", name: "spellbook", quantity: 1 },
    ]);
  });
});
