import { describe, expect, it } from "vitest";
import { companionDataSchema, COMPANION_PAYLOAD_MAX_BYTES } from "@/lib/schemas/content-types/companion";
import { monsterDataSchema } from "@/lib/schemas/content-types/monster";
import { companionWithBytes, originalCompanion } from "@/tests/fixtures/companions";

describe("strict declared companion template, no defaults or creature mechanics", () => {
  it.each(["mount", "beast_form", "summon"] as const)("accepts only documented descriptive role %s without changing data", role => {
    const data = originalCompanion(role), before = JSON.stringify(data);
    data.stat_block.speed.fly = 0; data.stat_block.speed.hover = false;
    data.stat_block.actions!.push(structuredClone(data.stat_block.actions![0]));
    const declared = JSON.stringify(data);
    expect(companionDataSchema.parse(data)).toEqual(data);
    expect(JSON.stringify(data)).toBe(declared); expect(before).not.toBe(declared);
  });
  it("preserves all missing optional inner fields instead of fabricating rules", () => {
    const data = originalCompanion();
    delete data.stat_block.description; delete data.stat_block.saving_throws; delete data.stat_block.skills; delete data.stat_block.actions;
    const parsed = companionDataSchema.parse(data);
    expect(Object.hasOwn(parsed.stat_block, "description")).toBe(false);
    expect(Object.hasOwn(parsed.stat_block, "actions")).toBe(false);
    expect(parsed).toEqual(data);
  });
  it.each([
    {}, { schema_version: 2 }, { ...originalCompanion(), role: "familiar" }, { ...originalCompanion(), role: "warrior" },
    { ...originalCompanion(), character_id: "forged" }, { ...originalCompanion(), effects: [] }, { ...originalCompanion(), source_monster_id: "forged" },
    { ...originalCompanion(), stat_block: null }, { ...originalCompanion(), stat_block: { schema_version: 1 } },
    { ...originalCompanion(), stat_block: { ...originalCompanion().stat_block, effects: [] } },
    { ...originalCompanion(), stat_block: { ...originalCompanion().stat_block, ability_scores: { strength: 0 } } },
    { ...originalCompanion(), stat_block: { ...originalCompanion().stat_block, armor_class: { value: "12" } } },
  ])("refuses strict/unsupported/unknown/undeclared input %j", data => expect(companionDataSchema.safeParse(data).success).toBe(false));
  it("enforces inclusive whole-wrapper UTF8 budget even when the inner stat block is valid", () => {
    const at = companionWithBytes(COMPANION_PAYLOAD_MAX_BYTES), over = companionWithBytes(COMPANION_PAYLOAD_MAX_BYTES + 1);
    expect(new TextEncoder().encode(JSON.stringify(at)).byteLength).toBe(COMPANION_PAYLOAD_MAX_BYTES);
    expect(monsterDataSchema.safeParse(over.stat_block).success).toBe(true);
    expect(companionDataSchema.safeParse(at).success).toBe(true);
    expect(companionDataSchema.safeParse(over).success).toBe(false);
  });
  it("applies real inner schema count/field budgets and UTF8 multibyte total", () => {
    const data = originalCompanion(); data.stat_block.actions = Array.from({ length: 31 }, () => ({ name: "Original", description: "Declared" }));
    expect(companionDataSchema.safeParse(data).success).toBe(false);
    const long = companionWithBytes(COMPANION_PAYLOAD_MAX_BYTES);
    long.stat_block.traits![0].description = long.stat_block.traits![0].description.replaceAll("x", "é");
    expect(companionDataSchema.safeParse(long).success).toBe(false);
  });
});
