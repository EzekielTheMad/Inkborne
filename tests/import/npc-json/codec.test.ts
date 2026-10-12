import { describe, expect, it } from "vitest";
import fixture from "@/tests/fixtures/npc-json/original-npc.json";
import { decodeNpcJson } from "@/lib/import/npc-json/codec";
import { NPC_JSON_LIMITS } from "@/lib/import/npc-json/types";
import { npcRejectedEffects } from "@/tests/fixtures/npcs";
import { effectSchema } from "@/lib/schemas/effects";
import { npcEnvelope, npcSnapshot } from "@/tests/fixtures/npcs";
import { parseContentDefinition, parseContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";
// jsdom's native TextEncoder can produce a different-realm Uint8Array. Own the
// identical bytes in this realm, matching File.arrayBuffer -> review's native
// byte copy; no text normalization or parser/guard substitution is involved.
const bytes = (text: string) => new Uint8Array(new TextEncoder().encode(text));
const minimal = { format: "inkborne-npc", format_version: 1, name: "Original NPC", data: { schema_version: 1 }, effects: [] };
function refusal(text: string, code: string) {
  const result = decodeNpcJson(bytes(text), "original.json"); expect(result.success).toBe(false);
  if (result.success) throw Error("Expected refusal");
  expect(result.diagnostics[0].code).toBe(code); expect("candidate" in result).toBe(false); return result.diagnostics[0];
}
describe("provisional local one-NPC JSON codec; no app upload or database proof", () => {
  it("validates without trimming/defaulting or losing empty/absent/order/duplicate data", () => {
    const result = decodeNpcJson(bytes(JSON.stringify(fixture)), "../../original.json");
    expect(result.success).toBe(true);
    if (!result.success) throw Error("Fixture rejected");
    expect(result.candidate).toEqual(fixture); expect(result.safeFilename).toBe("original.json");
    expect(Object.hasOwn(result.candidate.data.personality!, "bonds")).toBe(false);
    expect(result.candidate.data.personality!.ideals).toEqual([]);
    expect(result.candidate.name).toBe("  Original Bell Keeper  ");
    expect(result.candidate.data.personality!.motivation).toContain("constructor");
    const envelope = npcEnvelope(result.candidate.data);
    expect(parseContentDefinition(envelope)?.data).toEqual(result.candidate.data);
    expect(parseContentVersionSnapshot(npcSnapshot(envelope))?.data).toEqual(result.candidate.data);
  });
  it.each([{}, { personality: {} }, { personality: { ideals: [] }, relationships: [] }])("preserves distinct raw presence %j", extra => {
    const raw = { ...minimal, data: { schema_version: 1, ...extra } }, result = decodeNpcJson(bytes(JSON.stringify(raw)), "empty.json");
    expect(result).toMatchObject({ success: true, candidate: raw });
  });
  it.each(["id", "owner", "owner_id", "system", "system_id", "content_type", "source", "scope", "version", "slug", "campaign_id", "source_refs", "sharing_rights_status"])("rejects authority/unknown root field %s", key => {
    refusal(JSON.stringify({ ...minimal, [key]: "forged" }), "SCHEMA");
  });
  it.each(["", "   ", "x".repeat(121), 0, null])("uses shipped finite nonblank name schema without coercion %j", name => {
    refusal(JSON.stringify({ ...minimal, name }), "SCHEMA");
  });
  it.each([undefined, null, "", {}, [null]])("requires explicit actual empty effects %j", effects => {
    refusal(JSON.stringify({ ...minimal, effects }), "SCHEMA");
  });
  it.each(npcRejectedEffects)("refuses otherwise valid effect without erasing it %j", effect => {
    expect(effectSchema.safeParse(effect).success).toBe(true);
    const raw = { ...minimal, effects: [effect] }, before = JSON.stringify(raw);
    refusal(before, "SCHEMA"); expect(JSON.stringify(raw)).toBe(before);
  });
  it.each(["name", "\\u006eame"])("rejects decoded duplicate alias %s", key => {
    const diagnostic = refusal(`{"name":"first","${key}":"second"}`, "DUPLICATE_KEY");
    expect(diagnostic.path).toBe("/name"); expect(diagnostic.location.byteOffset).toBe(16);
  });
  it.each(["__proto__", "prototype", "constructor", "\\u0063onstructor"])("rejects dangerous keys only, at any object depth %s", key => {
    refusal(`{"data":{"${key}":"ordinary value"}}`, "DANGEROUS_KEY");
    expect(({} as { compromised?: boolean }).compromised).toBeUndefined();
  });
  it.each(["\\u0000", "\\ud800", "\\udc00", "\\udc00\\ud800", "\\ud800\\u0061"])("every decoded string/key rejects NUL or malformed pairs %s", escaped => {
    for (const source of [`{"${escaped}":0}`, `{"data":{"${escaped}":0}}`, `{"name":"${escaped}"}`, `{"data":{"personality":{"ideals":["${escaped}"]}}}`]) refusal(source, "INVALID_STRING");
  });
  it("reports original escape-byte positions after multiline multibyte/astral text, not decoded UTF16 indices", () => {
    const source = '{\n"data":{"description":"é😀","personality":{"motivation":"x\\ud800"}}}';
    const diagnostic = refusal(source, "INVALID_STRING"), index = source.indexOf("\\ud800");
    expect(diagnostic.location.byteOffset).toBe(bytes(source.slice(0, index)).byteLength);
    expect(diagnostic.location.byteOffset).not.toBe(index);
    expect(diagnostic.location.line).toBe(2);
    expect(diagnostic.location.column).toBe([...source.slice(source.indexOf("\n") + 1, index)].length + 1);
    const keySource = '{"é😀":"safe","\\u0000":0}';
    expect(refusal(keySource, "INVALID_STRING").location.byteOffset).toBe(bytes(keySource.slice(0, keySource.indexOf("\\u0000"))).byteLength);
  });
  it("preserves valid surrogate pairs and distinct composed/decomposed plaintext exactly", () => {
    for (const description of ["😀", "é e\u0301", "constructor prototype __proto__"]) {
      const raw = { ...minimal, data: { schema_version: 1, description } };
      expect(decodeNpcJson(bytes(JSON.stringify(raw)), "pair.json")).toMatchObject({ success: true, candidate: raw });
    }
    const result = decodeNpcJson(bytes(JSON.stringify(minimal).replace('"Original NPC"', '"\\ud83d\\ude00"')), "pair.json");
    expect(result).toMatchObject({ success: true, candidate: { name: "😀" } });
  });
  it.each(['{"x":01}', '{"x":1.}', '{"x":true,}', '{"x":[1,]}', '{/*comment*/}', '[undefined]', '{} trailing', '{"x":"\\x41"}', '{"x":"\n"}', 'NaN', '(()=>{window.compromised=true})()'])("fails strict JSON grammar without partial candidate %s", source => refusal(source, "SYNTAX"));
  it("rejects finite overflow without inventing a value", () => refusal('{"x":1e999}', "NON_FINITE"));
  it("rejects BOM and malformed UTF8 with original sequence location", () => {
    expect(decodeNpcJson(new Uint8Array([0xef, 0xbb, 0xbf, 123, 125]), "bom.json")).toMatchObject({ success: false, diagnostics: [{ code: "BOM" }] });
    for (const tail of [[0xff], [0xc0, 0x80], [0xed, 0xa0, 0x80], [0xf4, 0x90, 0x80, 0x80], [0xe2, 0x82]]) {
      expect(decodeNpcJson(new Uint8Array([10, 32, ...tail]), "utf8.json")).toMatchObject({ success: false, diagnostics: [{ code: "UTF8", location: { byteOffset: 2, line: 2, column: 2 } }] });
    }
  });
  it("enforces every structural ceiling before schema/result admission", () => {
    const input = bytes(JSON.stringify(minimal));
    for (const [limits, code] of [[{ bytes: 1 }, "BYTE_LIMIT"], [{ depth: 1 }, "DEPTH_LIMIT"], [{ nodes: 1 }, "NODE_LIMIT"], [{ members: 1 }, "MEMBER_LIMIT"]] as const)
      expect(decodeNpcJson(input, "limited.json", { limits })).toMatchObject({ success: false, diagnostics: [{ code }] });
    expect(decodeNpcJson(new Uint8Array(NPC_JSON_LIMITS.bytes + 1), "huge.json")).toMatchObject({ success: false, diagnostics: [{ code: "BYTE_LIMIT" }] });
    refusal(`[${"[".repeat(9)}0${"]".repeat(9)}]`, "DEPTH_LIMIT");
    refusal(`[${Array.from({ length: 2048 }, () => "0").join(",")}]`, "NODE_LIMIT");
    refusal(`{${Array.from({ length: 513 }, (_, index) => `"k${index}":0`).join(",")}}`, "MEMBER_LIMIT");
    for (const value of [0, -1, 9, NaN, Infinity]) expect(decodeNpcJson(input, "limit.json", { limits: { depth: value } }).success).toBe(false);
  });
  it("accepts the actual valid candidate at each lowered reader boundary and refuses one below", () => {
    const input = bytes(JSON.stringify(minimal)), exact = { bytes: input.length, depth: 3, nodes: 7, members: 6 };
    expect(decodeNpcJson(input, "boundary.json", { limits: exact })).toMatchObject({ success: true, candidate: minimal });
    for (const [key, code] of [["bytes", "BYTE_LIMIT"], ["depth", "DEPTH_LIMIT"], ["nodes", "NODE_LIMIT"], ["members", "MEMBER_LIMIT"]] as const) {
      expect(decodeNpcJson(input, "boundary.json", { limits: { ...exact, [key]: exact[key] - 1 } })).toMatchObject({ success: false, diagnostics: [{ code }] });
    }
  });
  it("bounds diagnostics, preserves unknown/schema failures and original token locations", () => {
    const source = JSON.stringify({ ...minimal, data: { schema_version: 1, relationships: Array.from({ length: 100 }, () => ({ name: 0, relationship: 0 })) } });
    const result = decodeNpcJson(bytes(source), "many.json"); expect(result.success).toBe(false);
    if (result.success) throw Error("Expected refusal");
    expect(new Set(result.diagnostics.map(issue => issue.path)).size).toBeLessThanOrEqual(100);
    expect(result.diagnostics.every(issue => issue.message.length <= 200 && issue.path.length <= 100)).toBe(true);
    const unknown = JSON.stringify({ ...minimal, data: { schema_version: 1, secret: "unsupported" } });
    expect(refusal(unknown, "SCHEMA").location.byteOffset).toBe(bytes(unknown.slice(0, unknown.indexOf('"secret"'))).byteLength);
    const invalidName = JSON.stringify({ ...minimal, name: 0 });
    expect(refusal(invalidName, "SCHEMA").location.byteOffset).toBe(bytes(invalidName.slice(0, invalidName.indexOf(':0') + 1)).byteLength);
    expect(decodeNpcJson(bytes(JSON.stringify(minimal)), "wrong.txt").success).toBe(false);
    expect(decodeNpcJson(bytes(JSON.stringify(minimal)), "ok.json", { expectedSize: 1 })).toMatchObject({ success: false, diagnostics: [{ code: "SIZE_MISMATCH" }] });
  });
});
