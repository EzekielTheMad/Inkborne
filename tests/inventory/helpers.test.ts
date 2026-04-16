import { describe, it, expect } from "vitest";
import {
  getItemData,
  getItemWeight,
  isShield,
  isBodyArmor,
} from "@/lib/inventory/helpers";
import type { InventoryItem } from "@/lib/types/inventory";

function makeItem(overrides: Partial<InventoryItem>): InventoryItem {
  return {
    id: "test",
    character_id: "char1",
    content_id: null,
    name: "Test",
    content_type: "item",
    quantity: 1,
    equipped: false,
    attuned: false,
    sort_order: 0,
    notes: null,
    custom_data: null,
    created_at: "2026-01-01",
    content_definitions: null,
    ...overrides,
  };
}

describe("getItemData", () => {
  it("returns content_definitions.data when no custom_data", () => {
    const item = makeItem({
      content_definitions: {
        id: "c1",
        name: "Longsword",
        slug: "longsword",
        content_type: "weapon",
        data: { damage: "1d8", weight: 3 },
        effects: [],
      },
    });
    expect(getItemData(item)).toEqual({ damage: "1d8", weight: 3 });
  });

  it("merges custom_data over content_definitions.data", () => {
    const item = makeItem({
      content_definitions: {
        id: "c1",
        name: "Longsword",
        slug: "longsword",
        content_type: "weapon",
        data: { damage: "1d8", weight: 3 },
        effects: [],
      },
      custom_data: { weight: 5 },
    });
    expect(getItemData(item)).toEqual({ damage: "1d8", weight: 5 });
  });

  it("returns empty object when no data at all", () => {
    const item = makeItem({});
    expect(getItemData(item)).toEqual({});
  });
});

describe("getItemWeight", () => {
  it("returns custom_data.weight when set", () => {
    const item = makeItem({
      custom_data: { weight: 10 },
      content_definitions: {
        id: "c1", name: "X", slug: "x", content_type: "item",
        data: { weight: 2 }, effects: [],
      },
    });
    expect(getItemWeight(item)).toBe(10);
  });

  it("returns content_definitions.data.weight when no custom", () => {
    const item = makeItem({
      content_definitions: {
        id: "c1", name: "X", slug: "x", content_type: "item",
        data: { weight: 2 }, effects: [],
      },
    });
    expect(getItemWeight(item)).toBe(2);
  });

  it("returns 0 when no weight anywhere", () => {
    const item = makeItem({});
    expect(getItemWeight(item)).toBe(0);
  });

  it("returns 0 when weight is non-numeric", () => {
    const item = makeItem({
      content_definitions: {
        id: "c1", name: "X", slug: "x", content_type: "item",
        data: { weight: "heavy" }, effects: [],
      },
    });
    expect(getItemWeight(item)).toBe(0);
  });
});

describe("isShield", () => {
  it("returns true for item with armor_category Shield", () => {
    const item = makeItem({
      content_definitions: {
        id: "c1", name: "Shield", slug: "shield", content_type: "armor",
        data: { armor_category: "Shield" }, effects: [],
      },
    });
    expect(isShield(item)).toBe(true);
  });

  it("returns false for item with armor_category Heavy", () => {
    const item = makeItem({
      content_definitions: {
        id: "c1", name: "Plate", slug: "plate", content_type: "armor",
        data: { armor_category: "Heavy" }, effects: [],
      },
    });
    expect(isShield(item)).toBe(false);
  });

  it("returns false for item with no armor_category", () => {
    const item = makeItem({});
    expect(isShield(item)).toBe(false);
  });
});

describe("isBodyArmor", () => {
  it("returns true for armor content_type that is not a shield", () => {
    const item = makeItem({
      content_type: "armor",
      content_definitions: {
        id: "c1", name: "Plate", slug: "plate", content_type: "armor",
        data: { armor_category: "Heavy" }, effects: [],
      },
    });
    expect(isBodyArmor(item)).toBe(true);
  });

  it("returns false for shield", () => {
    const item = makeItem({
      content_type: "armor",
      content_definitions: {
        id: "c1", name: "Shield", slug: "shield", content_type: "armor",
        data: { armor_category: "Shield" }, effects: [],
      },
    });
    expect(isBodyArmor(item)).toBe(false);
  });

  it("returns false for non-armor content_type", () => {
    const item = makeItem({ content_type: "weapon" });
    expect(isBodyArmor(item)).toBe(false);
  });
});
