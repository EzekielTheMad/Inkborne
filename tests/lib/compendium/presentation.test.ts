import { describe, expect, it } from "vitest";

import {
  getCompendiumEntryDescription,
  getCompendiumEntryFacts,
  getCompendiumEntryEyebrow,
} from "@/lib/compendium/presentation";
import {
  getCompendiumProvenance,
  type CompendiumEntry,
} from "@/lib/compendium/types";
import { cinderlitKite, monsterEnvelope } from "@/tests/fixtures/monsters";

function entry(overrides: Partial<CompendiumEntry>): CompendiumEntry {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    system_id: "22222222-2222-4222-8222-222222222222",
    name: "Example",
    slug: "example",
    content_type: "spell",
    version: 2,
    source: "srd",
    scope: "platform",
    owner_id: null,
    data: {},
    effects: [],
    ...overrides,
  };
}

describe("compendium presentation", () => {
  it("uses monster declared statistics and interface copy without fabricated data", () => {
    const monster = monsterEnvelope();
    expect(getCompendiumEntryEyebrow(monster)).toBe("Monster · Small construct");
    expect(getCompendiumEntryFacts(monster)).toEqual([
      { label: "Size", value: "Small" }, { label: "Type", value: "construct" },
      { label: "Armor Class", value: "12" }, { label: "Hit Points", value: "18" },
    ]);
    expect(getCompendiumEntryDescription(monster)).toBe(cinderlitKite.description);
    delete monster.data.description;
    expect(getCompendiumEntryDescription(monster)).toBe("Monster stat block.");
    expect(getCompendiumEntryFacts({ ...monster, data: { ...monster.data, armor_class: { value: 0 }, challenge: { rating: "1/2", experience_points: 0 } } }))
      .toContainEqual({ label: "Armor Class", value: "0" });
  });
  it("derives provenance from the authenticated viewer, not shared scope alone", () => {
    const owned = entry({
      source: "homebrew",
      scope: "shared",
      owner_id: "33333333-3333-4333-8333-333333333333",
    });

    expect(getCompendiumProvenance(owned, owned.owner_id!)).toBe("Your homebrew");
    expect(getCompendiumProvenance(owned, "44444444-4444-4444-8444-444444444444"))
      .toBe("Campaign shared");
    expect(getCompendiumProvenance(entry({}), "any-user")).toBe("SRD");
  });

  it("presents structured spell rules without exposing raw JSON", () => {
    const spell = entry({
      data: {
        level: 3,
        school: "evocation",
        description: "A bright streak flashes from your finger.",
        casting_time: "1 action",
        range: "150 feet",
        duration: "Instantaneous",
        components: ["V", "S", "M"],
        material: "A tiny ball of bat guano and sulfur",
        attack_type: null,
        damage: {
          type: "fire",
          dice_at_slot_level: { "3": "8d6", "4": "9d6" },
        },
        dc: { type: "dexterity", success: "half" },
        area_of_effect: { type: "sphere", size: 20 },
        ritual: false,
        concentration: false,
        classes: ["wizard", "sorcerer"],
      },
    });

    expect(getCompendiumEntryDescription(spell)).toContain("bright streak");
    expect(getCompendiumEntryFacts(spell)).toEqual(expect.arrayContaining([
      { label: "Level", value: "3" },
      { label: "School", value: "Evocation" },
      { label: "Materials", value: "A tiny ball of bat guano and sulfur" },
      { label: "Damage", value: "Fire · Level 3: 8d6, Level 4: 9d6" },
      { label: "Saving throw", value: "Dexterity · half damage on success" },
      { label: "Area", value: "20-ft. Sphere" },
      { label: "Classes", value: "Wizard, Sorcerer" },
    ]));
  });

  it("presents rules-critical equipment cost, range, and versatile damage", () => {
    const weapon = entry({
      content_type: "weapon",
      data: {
        weapon_category: "Martial",
        weapon_range: "Ranged",
        cost: { quantity: 50, unit: "gp" },
        range: { normal: 150, long: 600 },
        damage: { dice: "1d8", type: "piercing" },
        two_handed_damage: { dice: "1d10", type: "piercing" },
        properties: ["ammunition", "versatile"],
      },
    });

    expect(getCompendiumEntryFacts(weapon)).toEqual(expect.arrayContaining([
      { label: "Cost", value: "50 gp" },
      { label: "Range", value: "150 ft. / 600 ft." },
      { label: "Damage", value: "1d8 Piercing" },
      { label: "Versatile damage", value: "1d10 Piercing" },
    ]));
  });

  it("shows boolean magic-item attunement clearly", () => {
    const item = entry({
      content_type: "magic_item",
      data: {
        rarity: "Rare",
        description: "A ring of guarded flame.",
        requires_attunement: true,
      },
    });

    expect(getCompendiumEntryFacts(item)).toContainEqual({
      label: "Attunement",
      value: "Required",
    });
  });
});
