import { describe, expect, it } from "vitest";
import { subraceHitPointMechanics, transformSubraceEntry } from "@/scripts/transformers/races";
import { transformTraitEntry } from "@/scripts/transformers/traits";
import { subraceDataSchema } from "@/lib/schemas/content-types/subrace";
import { dwarvenToughnessSource, hillDwarfSource } from "../fixtures/ancestry-hit-points";

describe("meaningful Hill Dwarf HP root publication", () => {
  it("uses the genuine mandatory source while leaving its trait and source inputs unchanged", () => {
    const source = structuredClone(dwarvenToughnessSource), root = structuredClone(hillDwarfSource), before = JSON.stringify({ source, root });
    const oldTrait = transformTraitEntry(source), next = transformSubraceEntry(root, source);
    expect(subraceDataSchema.parse(next.data).hit_points_bonus_per_character_level).toBe(1);
    expect(next.data).toMatchObject({ parent_race: "dwarf", traits: ["dwarven-toughness"] });
    expect(next.effects).toContainEqual({ type: "mechanical", stat: "wisdom", op: "add", value: 1 });
    expect(oldTrait.data).not.toHaveProperty("hit_points_bonus_per_character_level");
    expect(oldTrait.effects).toEqual([{ type: "narrative", text: source.desc[0], tag: "Racial Trait" }]);
    expect(transformTraitEntry(source)).toEqual(oldTrait);
    expect(JSON.stringify({ source, root })).toBe(before);
  });
  it.each(["missing", "parent", "mandatory", "duplicate", "identity", "name", "prose", "owner", "extra-owner"])(
    "refuses changed or unavailable genuine %s evidence", kind => {
      const root = structuredClone(hillDwarfSource), source = structuredClone(dwarvenToughnessSource);
      if (kind === "parent") root.race.index = "elf";
      if (kind === "mandatory") root.racial_traits = [];
      if (kind === "duplicate") root.racial_traits.push(root.racial_traits[0]);
      if (kind === "identity") source.index = "other";
      if (kind === "name") source.name = "Other";
      if (kind === "prose") source.desc[0] += " per class";
      if (kind === "owner") source.subraces[0].index = "rock-gnome";
      if (kind === "extra-owner") source.subraces.push({ index: "other", name: "Other" });
      expect(() => subraceHitPointMechanics(root, kind === "missing" ? undefined : source)).toThrow("unavailable or changed");
    });
  it("does not assign HP to other subraces or rely on a trait alone", () => {
    expect(subraceHitPointMechanics({ ...hillDwarfSource, index: "rock-gnome" }, dwarvenToughnessSource)).toEqual({});
    expect(() => transformSubraceEntry(hillDwarfSource)).toThrow("unavailable or changed");
  });
});
