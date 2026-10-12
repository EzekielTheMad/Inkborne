import { describe, expect, it } from "vitest";
import { mapNpcForm, mergeNpcEdit, changedNpcFields, acceptNpcResponse, NPC_VERSION_MAX } from "@/lib/homebrew/npc-form";
import { npcId, originalNpc } from "@/tests/fixtures/npcs";
function form(data: unknown, version = "1", edit = false) {
  const input = new FormData(); input.set("name", "  Original NPC  "); input.set("npc_data", JSON.stringify(data));
  if (edit) { input.set("id", npcId(1)); input.set("expected_version", version); input.set("changed_fields", "[]"); } return input;
}
describe("NPC authoring mapper and raw group merge", () => {
  it("accepts name-only without defaults and ignores separate forged authority", () => {
    const input = form({ schema_version: 1 }); input.set("owner_id", npcId(99)); input.set("effects", "forged"); input.set("id", npcId(80));
    expect(mapNpcForm(input, "create")).toMatchObject({ success: true, value: { name: "  Original NPC  ", data: { schema_version: 1 } } });
  });
  it.each(["0", "-1", "+1", "01", "1.5", "1e2", "0x10", "2147483648", "9007199254740991"])("rejects version %s", version => {
    expect(mapNpcForm(form(originalNpc, version, true), "edit").success).toBe(false);
  });
  it("admits pg MAX and refuses duplicate/File/oversized/malformed transport", () => {
    expect(mapNpcForm(form(originalNpc, String(NPC_VERSION_MAX), true), "edit").success).toBe(true);
    const input = form(originalNpc); input.append("name", "duplicate"); expect(mapNpcForm(input, "create").success).toBe(false);
    input.delete("name"); input.set("name", new File(["x"], "bad")); expect(mapNpcForm(input, "create").success).toBe(false);
    input.set("name", "valid"); input.set("npc_data", "x".repeat(131_073)); expect(mapNpcForm(input, "create")).toMatchObject({ success: false, fieldErrors: { form: expect.any(Array) } });
    input.set("npc_data", "{"); expect(mapNpcForm(input, "create").success).toBe(false);
  });
  it.each([{ schema_version: 1 }, { schema_version: 1, personality: {} }, { schema_version: 1, personality: { ideals: [] }, relationships: [] }])("description-only preserves presence %j", data => {
    const after = { ...data, description: "  New text\n" } as typeof originalNpc;
    expect(mergeNpcEdit(data, after, ["description"])).toEqual(after);
    expect(changedNpcFields(data as typeof originalNpc, after)).toEqual(["description"]);
  });
  it("keeps duplicates/order and explicit clear, but rejects unmarked/unknown groups without changing originals", () => {
    const raw = { ...originalNpc, relationships: [originalNpc.relationships![0], originalNpc.relationships![0]], personality: { ideals: ["same", "same"] } };
    const before = JSON.stringify(raw); const draft = { ...raw, description: "changed" };
    expect(mergeNpcEdit(raw, draft, ["description"]).relationships).toEqual(raw.relationships);
    expect(() => mergeNpcEdit(raw, draft, [])).toThrow();
    expect(() => mergeNpcEdit({ ...raw, extension: { secret: true } }, draft, ["description"])).toThrow();
    const cleared = { ...raw }; delete cleared.description;
    expect(Object.hasOwn(mergeNpcEdit(raw, cleared, ["description"]), "description")).toBe(false);
    expect(JSON.stringify(raw)).toBe(before);
  });
  it.each([undefined, null, {}, { status: "saved", id: npcId(1), version: 2, operation: "create" }, { status: "unchanged", id: npcId(1), version: 1, message: "No changes to save." }])("unconfirmed create response stays uncertain %j", raw => {
    expect(acceptNpcResponse(raw, "create").status).toBe("uncertain");
  });
  it("correlates exact changed vs unchanged edit versions", () => {
    const expected = { id: npcId(1), version: 1 };
    expect(acceptNpcResponse({ status: "saved", ...expected, operation: "edit" }, "edit", expected).status).toBe("uncertain");
    expect(acceptNpcResponse({ status: "saved", ...expected, version: 2, operation: "edit" }, "edit", expected).status).toBe("saved");
    expect(acceptNpcResponse({ status: "unchanged", ...expected, message: "No changes to save." }, "edit", expected).status).toBe("unchanged");
  });
});
