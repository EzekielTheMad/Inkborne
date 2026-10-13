import { describe, expect, it } from "vitest";
import { admittedMonsterSnapshot, CAMPAIGN_MONSTERS_ENABLED, instanceReceiptSchema, instanceRequestSchema, parseInstanceActionResponse, revisionSchema, sameInstanceIntent } from "@/lib/campaigns/monster-instance-schema";
import { instanceIntentForm, instanceIntentFromForm } from "@/lib/campaigns/monster-instance-form";
import { MC, monsterCreate, monsterReceipt, monsterSnapshot } from "@/tests/fixtures/campaign-monster-instances";
describe("campaign monster strict contracts (no native authority)", () => {
  it("defaults off and admits original canonical zero/negative modifiers without normalizing source", () => {
    expect(CAMPAIGN_MONSTERS_ENABLED).toBe(false); const raw = monsterSnapshot(); const before = structuredClone(raw);
    expect(admittedMonsterSnapshot(raw, MC.system, MC.source, 1).data.saving_throws).toEqual({ wisdom: 0, charisma: -2 }); expect(raw).toEqual(before);
    expect(instanceIntentFromForm(instanceIntentForm(monsterCreate()))).toEqual(monsterCreate());
  });
  it.each(["-1", "01", "1.0", "1e3", "9223372036854775808", "x", "9".repeat(1000)])("refuses invalid revision %s", (value) => expect(revisionSchema.safeParse(value).success).toBe(false));
  it("keeps exact maximum bigint as decimal text", () => expect(revisionSchema.parse("9223372036854775807")).toBe("9223372036854775807"));
  it.each([{ current_hp: -1 }, { current_hp: 1.5 }, { current_hp: Infinity }, { name: " " }, { name: "x".repeat(101) }, { notes: "x".repeat(8001) }, { notes: "\u0000" }, { name: "\ud800" }, { actor_id: MC.owner }])("refuses controls/authority tampering", (patch) => expect(instanceRequestSchema.safeParse({ ...monsterCreate(), ...patch }).success).toBe(false));
  it("rejects missing/duplicate/File/unknown/overbudget form controls before parse", () => {
    const duplicate = instanceIntentForm(monsterCreate()); duplicate.append("intent", "{}"); expect(() => instanceIntentFromForm(duplicate)).toThrow();
    const file = new FormData(); file.set("intent", new File(["{}"], "request.json")); expect(() => instanceIntentFromForm(file)).toThrow();
    const unknown = instanceIntentForm(monsterCreate()); unknown.set("actor", MC.owner); expect(() => instanceIntentFromForm(unknown)).toThrow();
    const large = new FormData(); large.set("intent", "x".repeat(40961)); expect(() => instanceIntentFromForm(large)).toThrow(/budget/);
    expect(() => instanceIntentFromForm(new FormData())).toThrow();
  });
  it.each(["effects", "version", "system", "type", "data", "hp"])("canonical source preview/render rejects %s tampering", (field) => {
    const source = monsterSnapshot();
    if (field === "effects") Object.assign(source, { effects_snapshot: [{ type: "unknown" }] });
    if (field === "version") source.version = 2;
    if (field === "system") source.system_id_snapshot = MC.foreign;
    if (field === "type") source.content_type_snapshot = "spell";
    if (field === "data") Object.assign(source.data_snapshot, { unsupported: true });
    if (field === "hp") source.data_snapshot.hit_points.average = 0;
    expect(() => admittedMonsterSnapshot(source, MC.system, MC.source, 1)).toThrow();
  });
  it("validates receipt identity, exact canonical intent and readback before success", () => {
    const receipt = monsterReceipt(); expect(instanceReceiptSchema.parse(receipt)).toEqual(receipt);
    expect(() => parseInstanceActionResponse({ status: "saved", receipt }, MC.foreign, MC.operation)).toThrow();
    expect(() => parseInstanceActionResponse({ status: "saved", receipt }, MC.campaign, MC.operation, { ...monsterCreate(), name: "Changed" })).toThrow();
    expect(instanceReceiptSchema.safeParse({ ...receipt, readback: { ...receipt.readback, current_hp: 1 } }).success).toBe(false);
    expect(sameInstanceIntent({ a: 1, entries: [1, 2] }, { entries: [1, 2], a: 1 })).toBe(true);
    expect(sameInstanceIntent({ entries: [1, 2] }, { entries: [2, 1] })).toBe(false);
  });
  it("admits exhausted-revision no-op receipt but rejects impossible increment past bigint maximum", () => {
    const request = { command_version: 1 as const, operation_id: MC.operation, command: "update" as const, instance_id: MC.instance,
      expected_revision: "9223372036854775807", patch: { notes: "Original private note." } };
    const receipt = { ...monsterReceipt(), canonical_intent: request, outcome: "noop", readback: { ...monsterReceipt().readback, revision: request.expected_revision } };
    expect(instanceReceiptSchema.safeParse(receipt).success).toBe(true);
    expect(instanceReceiptSchema.safeParse({ ...receipt, outcome: "updated", readback: { ...receipt.readback, revision: "9223372036854775808" } }).success).toBe(false);
  });
});
