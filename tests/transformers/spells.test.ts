import { describe, it, expect } from "vitest";
import { transformSpellEntry } from "@/scripts/transformers/spells";

describe("transformSpellEntry", () => {
  it("transforms a damage spell (Fireball)", () => {
    const apiSpell = {
      index: "fireball",
      name: "Fireball",
      desc: ["A bright streak flashes from your pointing finger..."],
      higher_level: ["When you cast this spell using a spell slot of 4th level or higher..."],
      range: "150 feet",
      components: ["V", "S", "M"],
      material: "A tiny ball of bat guano and sulfur",
      ritual: false,
      duration: "Instantaneous",
      concentration: false,
      casting_time: "1 action",
      level: 3,
      damage: {
        damage_type: { index: "fire", name: "Fire" },
        damage_at_slot_level: { "3": "8d6", "4": "9d6", "5": "10d6", "6": "11d6", "7": "12d6", "8": "13d6", "9": "14d6" },
      },
      dc: { dc_type: { index: "dex", name: "DEX" }, dc_success: "half" },
      area_of_effect: { type: "sphere", size: 20 },
      school: { index: "evocation", name: "Evocation" },
      classes: [{ index: "sorcerer", name: "Sorcerer" }, { index: "wizard", name: "Wizard" }],
      subclasses: [{ index: "fiend", name: "Fiend" }],
      heal_at_slot_level: undefined,
    };

    const result = transformSpellEntry(apiSpell);
    expect(result.slug).toBe("fireball");
    expect(result.content_type).toBe("spell");
    expect(result.data.level).toBe(3);
    expect(result.data.school).toBe("evocation");
    expect(result.data.concentration).toBe(false);
    expect(result.data.damage).toEqual({
      type: "fire",
      dice_at_slot_level: { "3": "8d6", "4": "9d6", "5": "10d6", "6": "11d6", "7": "12d6", "8": "13d6", "9": "14d6" },
    });
    expect(result.data.dc).toEqual({ type: "dexterity", success: "half" });
    expect(result.data.classes).toEqual(["sorcerer", "wizard"]);
  });

  it("transforms a cantrip with no damage", () => {
    const apiSpell = {
      index: "light",
      name: "Light",
      desc: ["You touch one object..."],
      range: "Touch",
      components: ["V"],
      ritual: false,
      duration: "1 hour",
      concentration: false,
      casting_time: "1 action",
      level: 0,
      school: { index: "evocation", name: "Evocation" },
      classes: [{ index: "cleric", name: "Cleric" }],
      subclasses: [],
    };

    const result = transformSpellEntry(apiSpell);
    expect(result.data.level).toBe(0);
    expect(result.data.damage).toBeNull();
    expect(result.data.dc).toBeNull();
  });
});
