import { describe, expect, it } from "vitest";

import { mapHomebrewMagicItemFormData } from "@/lib/homebrew/magic-item-form";

function form(overrides: Record<string, string> = {}): FormData {
  const input = new FormData();
  input.set("name", "  Oathbound Compass  ");
  input.set("rarity", "Rare");
  input.set(
    "description",
    "  A compass that points toward the last promise you made.  ",
  );
  input.set("equipment_category", "  Wondrous item  ");
  input.set("requires_attunement", "on");
  for (const [key, value] of Object.entries(overrides)) input.set(key, value);
  return input;
}

describe("mapHomebrewMagicItemFormData", () => {
  it("maps trimmed named controls into canonical magic-item data", () => {
    expect(mapHomebrewMagicItemFormData(form())).toEqual({
      success: true,
      data: {
        name: "Oathbound Compass",
        data: {
          rarity: "Rare",
          description: "A compass that points toward the last promise you made.",
          equipment_category: "Wondrous item",
          requires_attunement: true,
        },
      },
    });
  });

  it("omits an empty optional category and treats an absent checkbox as false", () => {
    const input = form({ equipment_category: "" });
    input.delete("requires_attunement");

    expect(mapHomebrewMagicItemFormData(input)).toEqual({
      success: true,
      data: {
        name: "Oathbound Compass",
        data: {
          rarity: "Rare",
          description: "A compass that points toward the last promise you made.",
          requires_attunement: false,
        },
      },
    });
  });

  it("returns named validation errors and ignores forged envelope fields", () => {
    const invalid = form({ name: "", rarity: "Mythic", description: "" });
    invalid.set("owner_id", "attacker");
    invalid.set("content_type", "spell");
    invalid.set("effects", '[{"type":"grant"}]');

    expect(mapHomebrewMagicItemFormData(invalid)).toEqual({
      success: false,
      fieldErrors: {
        name: ["Name is required."],
        rarity: [expect.any(String)],
        description: ["Description is required."],
      },
    });
  });
});
