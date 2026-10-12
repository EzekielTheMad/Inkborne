import { describe, expect, it } from "vitest";
import { npcDataSchema, NPC_PAYLOAD_MAX_BYTES } from "@/lib/schemas/content-types/npc";
import { longNpc, originalNpc } from "@/tests/fixtures/npcs";

describe("strict narrative NPC payload", () => {
  it("accepts a name-only payload and preserves absence, empty arrays and ordered original text", () => {
    expect(npcDataSchema.parse({ schema_version: 1 })).toEqual({ schema_version: 1 });
    const input = { ...originalNpc, description: "  Original text\nSecond line  ", personality: { ideals: [] }, relationships: [] };
    expect(npcDataSchema.parse(input)).toEqual(input);
  });
  it.each([{}, { schema_version: 2 }, { schema_version: "1" }, { schema_version: 1, secret: "private" },
    { ...originalNpc, description: " " }, { ...originalNpc, occupation: null },
    { ...originalNpc, personality: { bonds: ["valid"], hidden: "secret" } },
    { ...originalNpc, relationships: [{ name: "one", relationship: "friend", character_id: "forged" }] },
    { ...originalNpc, personality: { ideals: Array(9).fill("too many") } },
    { ...originalNpc, relationships: Array(21).fill({ name: "one", relationship: "friend" }) },
    { ...originalNpc, personality: { fear: "x".repeat(1_001) } }, { ...originalNpc, description: "x".repeat(8_001) },
  ])("rejects unsupported/wrong/null/oversized input %j", input => {
    expect(npcDataSchema.safeParse(input).success).toBe(false);
  });
  it("accepts every finite field maximum but rejects multibyte aggregate excess", () => {
    expect(npcDataSchema.safeParse(longNpc()).success).toBe(true);
    const input = longNpc("é");
    expect(new TextEncoder().encode(JSON.stringify(input)).byteLength).toBeGreaterThan(NPC_PAYLOAD_MAX_BYTES);
    const parsed = npcDataSchema.safeParse(input);
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues).toContainEqual(expect.objectContaining({ message: "NPC data exceeds the 64 KiB UTF-8 payload budget" }));
  });
});
