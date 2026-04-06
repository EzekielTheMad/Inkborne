import { describe, it, expect } from "vitest";
import { collectEffects, sortEffectsByPriority } from "@/lib/engine/effects";
import type { Effect, MechanicalEffect } from "@/lib/types/effects";

describe("collectEffects", () => {
  it("flattens effects from multiple content entries", () => {
    const contentEffects: Effect[][] = [
      [{ type: "mechanical", stat: "strength", op: "add", value: 2 }],
      [
        { type: "mechanical", stat: "dexterity", op: "add", value: 1 },
        { type: "narrative", text: "Darkvision 60ft" },
      ],
    ];
    const result = collectEffects(contentEffects);
    expect(result).toHaveLength(3);
  });

  it("returns empty array for no content", () => {
    const result = collectEffects([]);
    expect(result).toEqual([]);
  });
});

describe("sortEffectsByPriority", () => {
  it("sorts set before add before multiply before formula", () => {
    const effects: MechanicalEffect[] = [
      { type: "mechanical", stat: "armor_class", op: "formula", expr: "10 + mod(dexterity)" },
      { type: "mechanical", stat: "strength", op: "add", value: 2 },
      { type: "mechanical", stat: "armor_class", op: "set", value: 10 },
      { type: "mechanical", stat: "strength", op: "multiply", value: 1.5 },
    ];
    const sorted = sortEffectsByPriority(effects);
    expect(sorted[0].op).toBe("set");
    expect(sorted[1].op).toBe("add");
    expect(sorted[2].op).toBe("multiply");
    expect(sorted[3].op).toBe("formula");
  });

  it("preserves order for same priority", () => {
    const effects: MechanicalEffect[] = [
      { type: "mechanical", stat: "strength", op: "add", value: 2 },
      { type: "mechanical", stat: "dexterity", op: "add", value: 1 },
    ];
    const sorted = sortEffectsByPriority(effects);
    expect(sorted[0].stat).toBe("strength");
    expect(sorted[1].stat).toBe("dexterity");
  });
});
