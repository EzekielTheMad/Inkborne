import { beforeEach, describe, expect, it, vi } from "vitest";
import { effectSchema } from "@/lib/schemas/effects";
import { parseContentDefinition, parseContentVersionSnapshot, parseNestedContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";
import { monsterEnvelope } from "@/tests/fixtures/monsters";
import { npcEnvelope, npcSnapshot, npcRejectedEffects } from "@/tests/fixtures/npcs";

beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => {}); });
describe("NPC current and immutable canonical boundaries", () => {
  it("keeps exact v1 independent of current v2 and returns unchanged narrative data", () => {
    const first = npcEnvelope(), pin = npcSnapshot(first);
    const second = { ...first, version: 2, name: "A changed keeper", data: { ...first.data, occupation: "Map reader" } };
    expect(parseContentDefinition(second)).toMatchObject({ name: second.name, version: 2 });
    expect(parseContentVersionSnapshot(pin)).toEqual(parseContentDefinition(first));
    expect(parseNestedContentVersionSnapshot([pin])).toEqual(parseContentDefinition(first));
    expect(parseNestedContentVersionSnapshot([pin, pin])).toBeNull();
  });
  it.each(npcRejectedEffects)("rejects independently canonical-valid %j rather than discarding it", effect => {
    expect(effectSchema.safeParse(effect).success).toBe(true);
    const row = { ...npcEnvelope(), effects: [effect] }, snapshot = { ...npcSnapshot(), effects_snapshot: [effect] };
    const before = JSON.stringify({ row, snapshot });
    expect(parseContentDefinition(row)).toBeNull(); expect(parseContentVersionSnapshot(snapshot)).toBeNull();
    expect(JSON.stringify({ row, snapshot })).toBe(before);
  });
  it.each([undefined, null, {}, "[]", false, [{ type: "unknown" }]])("refuses missing/null/wrong-shaped effects %j before defaults", effects => {
    const row = { ...npcEnvelope(), effects }, pin = { ...npcSnapshot(), effects_snapshot: effects };
    if (effects === undefined) { delete (row as { effects?: unknown }).effects; delete (pin as { effects_snapshot?: unknown }).effects_snapshot; }
    const before = JSON.stringify({ row, pin });
    expect(parseContentDefinition(row)).toBeNull(); expect(parseContentVersionSnapshot(pin)).toBeNull();
    expect(JSON.stringify({ row, pin })).toBe(before);
  });
  it("rejects malformed payload/envelope and leaves ordinary valid monster effects intact", () => {
    expect(parseContentDefinition({ ...npcEnvelope(), data: { schema_version: 1, hidden: true } })).toBeNull();
    expect(parseContentVersionSnapshot({ ...npcSnapshot(), data_snapshot: { schema_version: 2 } })).toBeNull();
    expect(parseContentDefinition({ ...npcEnvelope(), id: "bad" })).toBeNull();
    const row = { ...monsterEnvelope(), effects: [npcRejectedEffects[0]] };
    expect(parseContentDefinition(row)?.effects).toEqual(row.effects);
  });
});
