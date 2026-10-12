import { webcrypto, createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "@/tests/fixtures/npc-json/original-npc.json";
import { createNpcJsonReview } from "@/lib/import/npc-json/review";
const encode = (text: string) => new TextEncoder().encode(text);
beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => vi.unstubAllGlobals());
describe("local original-byte NPC JSON review evidence, not a write receipt", () => {
  it("hashes original bytes externally, retains raw whitespace, and freezes review/source data", async () => {
    const text = JSON.stringify(fixture, null, 2), bytes = encode(text), result = await createNpcJsonReview(bytes, "C:\\fiction\\original.json", bytes.length);
    expect(result.success).toBe(true); if (!result.success) throw Error("Original fixture refused");
    expect(result.review.candidate).toEqual(fixture);
    expect(result.review.provenance).toMatchObject({ format: "inkborne_npc_json_v1", safeFilename: "original.json", sourceBytes: bytes.length,
      sourceSha256: createHash("sha256").update(bytes).digest("hex") });
    expect(Object.hasOwn(result.review.candidate.data, "source_refs")).toBe(false);
    expect(Object.isFrozen(result.review.candidate.data.personality?.personality_traits)).toBe(true);
    expect(Object.isFrozen(result.review.provenance.origins)).toBe(true);
  });
  it("same narrative with different original bytes has different provenance hashes", async () => {
    const first = await createNpcJsonReview(encode(JSON.stringify(fixture)), "first.json"), second = await createNpcJsonReview(encode(JSON.stringify(fixture, null, 2)), "second.json");
    if (!first.success || !second.success) throw Error("Fixture refused");
    expect(first.review.candidate).toEqual(second.review.candidate);
    expect(first.review.provenance.sourceSha256).not.toBe(second.review.provenance.sourceSha256);
  });
  it("owns the exact bytes across native asynchronous hashing rather than caller mutation", async () => {
    const original = encode(JSON.stringify(fixture)), expected = createHash("sha256").update(original).digest("hex");
    const pending = createNpcJsonReview(original, "race.json"); original.fill(32);
    const result = await pending; if (!result.success) throw Error("Fixture refused");
    expect(result.review.provenance.sourceSha256).toBe(expected); expect(result.review.candidate).toEqual(fixture);
  });
  it.each([0, 131_073])("rejects raw byte bounds before review allocation/hash %i", async length => {
    expect(await createNpcJsonReview(new Uint8Array(length), "size.json")).toMatchObject({ success: false, diagnostics: [{ code: "BYTE_LIMIT" }] });
  });
  it("hash failure, size mismatch and forbidden effects never manufacture accepted preview evidence", async () => {
    const bytes = encode(JSON.stringify(fixture));
    expect(await createNpcJsonReview(bytes, "size.json", bytes.length + 1)).toMatchObject({ success: false, diagnostics: [{ code: "SIZE_MISMATCH" }] });
    vi.stubGlobal("crypto", undefined);
    expect(await createNpcJsonReview(bytes, "hash.json")).toMatchObject({ success: false, diagnostics: [{ code: "HASH_UNAVAILABLE" }] });
    const bad = encode(JSON.stringify({ ...fixture, effects: [{ type: "narrative", text: "Original forbidden effect" }] }));
    expect(await createNpcJsonReview(bad, "effect.json")).toMatchObject({ success: false, diagnostics: [{ code: "SCHEMA" }] });
  });
});
