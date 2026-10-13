import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { campaignMonsterStageModel } from "@/tests/fixtures/campaign-monster-stage-model";
import { MC, monsterCreate, monsterSnapshot } from "@/tests/fixtures/campaign-monster-instances";
const sql = readFileSync("supabase/staged/campaign-monster-instances.sql", "utf8");
const nextOp = (tail: string) => `30000000-0000-4000-8000-${tail.padStart(12, "0")}`;
describe("source-bound campaign monster transaction REVIEW MODEL, not PostgreSQL", () => {
  it("reports model-only/default-off and static removal failure separately", () => {
    const model = campaignMonsterStageModel(sql); expect(model.evidence).toBe("model_checked"); expect(model.currentNativeGate).toBe(false);
    expect(() => campaignMonsterStageModel(sql.replaceAll("RETURN prior.receipt", "missing replay"))).toThrow(/STATIC source binding/);
  });
  it("model atomically rolls back injected instance/receipt boundary and resolves accepted lost response once", () => {
    const model = campaignMonsterStageModel(sql); const intent = monsterCreate(); const before = model.dump();
    expect(() => model.commit(MC.owner, intent, "before-receipt")).toThrow("INJECTED_ROLLBACK"); expect(model.dump()).toEqual(before);
    expect(() => model.commit(MC.owner, intent, "lost-response")).toThrow("INJECTED_RESPONSE_LOSS");
    const saved = model.commit(MC.owner, intent); expect(model.resolve(MC.owner, intent.operation_id)).toEqual({ status: "saved", receipt: saved });
    expect(model.dump().rows).toHaveLength(1); expect(model.dump().receipts).toHaveLength(1);
  });
  it("model receipt-first current-owner replay bypasses NEW retired/version gates but rejects changed intent", () => {
    const model = campaignMonsterStageModel(sql); const intent = monsterCreate(); const saved = model.commit(MC.owner, intent);
    model.current.active = false; model.current.currentVersion = 2; expect(model.commit(MC.owner, intent)).toEqual(saved);
    expect(() => model.commit(MC.owner, { ...intent, name: "Different" })).toThrow("INTENT_CONFLICT");
    model.setOwner(MC.foreign); expect(() => model.resolve(MC.owner, intent.operation_id)).toThrow("OWNER_DENIED");
  });
  it("model absent receipt is not cancellation: delayed same operation still accepts once", () => {
    const model = campaignMonsterStageModel(sql), intent = monsterCreate(); expect(model.resolve(MC.owner, intent.operation_id)).toEqual({ status: "absent" });
    const delayed = model.commit(MC.owner, intent); expect(model.commit(MC.owner, intent)).toEqual(delayed); expect(model.dump().rows).toHaveLength(1);
  });
  it("model two deliberate distinct accepted operations create distinct instances of same source", () => {
    const model = campaignMonsterStageModel(sql), first = model.commit(MC.owner, monsterCreate());
    const second = model.commit(MC.owner, { ...monsterCreate(), operation_id: nextOp("1") });
    expect(second.instance_id).not.toBe(first.instance_id); expect(model.dump().rows).toHaveLength(2); expect(model.dump().receipts).toHaveLength(2);
  });
  it("model permits platform owner-null exact identity and rejects self-consistent foreign snapshot system", () => {
    const model = campaignMonsterStageModel(sql); model.current.scope = "platform"; model.current.owner = null;
    model.current.snapshot = { ...monsterSnapshot(), scope_snapshot: "platform", owner_id_snapshot: null, source_snapshot: "srd" };
    expect(model.commit(MC.owner, monsterCreate()).outcome).toBe("created");
    const foreign = campaignMonsterStageModel(sql); foreign.current.snapshot = { ...monsterSnapshot(), system_id_snapshot: MC.foreign };
    expect(() => foreign.commit(MC.owner, monsterCreate())).toThrow("SOURCE_IDENTITY_DENIED"); expect(foreign.dump().rows).toEqual([]);
  });
  it("model rejects shared/foreign/new-version acquisitions and preserves embedded raw source after edit", () => {
    const model = campaignMonsterStageModel(sql); model.current.scope = "shared"; expect(() => model.commit(MC.owner, monsterCreate())).toThrow("SOURCE_DENIED");
    model.current.scope = "personal"; model.current.owner = MC.foreign; expect(() => model.commit(MC.owner, monsterCreate())).toThrow("SOURCE_DENIED");
    model.current.owner = MC.owner; const first = model.commit(MC.owner, monsterCreate()); const original = model.dump().rows[0].source_snapshot;
    model.current.currentVersion = 2; model.current.snapshot = { edited: true }; expect(() => model.commit(MC.owner, { ...monsterCreate(), operation_id: nextOp("1") })).toThrow("SOURCE_DENIED");
    expect(model.dump().rows[0].source_snapshot).toEqual(original); expect(first.readback.current_hp).toBe(0);
  });
  it("model changed/no-op/CAS archive/clear keeps source fixed and never overwrites a stale revision", () => {
    const model = campaignMonsterStageModel(sql); const saved = model.commit(MC.owner, monsterCreate());
    const changed = model.commit(MC.owner, { command_version: 1, operation_id: nextOp("1"), command: "update", instance_id: saved.instance_id, expected_revision: "0", patch: { notes: "", archived: true } });
    expect(changed.readback).toMatchObject({ revision: "1", notes: "", archived: true });
    const noop = model.commit(MC.owner, { command_version: 1, operation_id: nextOp("2"), command: "update", instance_id: saved.instance_id, expected_revision: "1", patch: { archived: true } });
    expect(noop).toMatchObject({ outcome: "noop", readback: { revision: "1" } });
    const before = model.dump(); expect(() => model.commit(MC.owner, { command_version: 1, operation_id: nextOp("3"), command: "update", instance_id: saved.instance_id, expected_revision: "0", patch: { current_hp: 17 } })).toThrow("REVISION_CONFLICT"); expect(model.dump()).toEqual(before);
  });
});
