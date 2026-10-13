import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { arcanumCaptureSchema, arcanumReceiptSchema, parseArcanumRead, parseArcanumRequest,
  sameArcanumJson, ARCANUM_READ_MAX_BYTES } from "@/lib/spells/arcanum-selection-schema";
import { recordedArcanumFixture, foreignSystemArcanumPair } from "@/tests/fixtures/arcanum-selection";
import { originalId } from "@/tests/fixtures/subclass-casting";
import { arcanumSelectionSourceModel } from "./arcanum-selection-source-model";

const sql = readFileSync("supabase/staged/arcanum-first-selection.sql", "utf8");
const authority = readFileSync("supabase/staged/hit-die-authority-and-writers.sql", "utf8");
function fixture(tier: 6 | 7 | 8 | 9 = 6, spent: unknown = 1) {
  const f = recordedArcanumFixture(tier, spent);
  const rows = { parent: f.parent, captures: [f.capture], receipts: [f.receipt] };
  return { ...f, rows, model: arcanumSelectionSourceModel(sql, authority, rows) };
}
describe("strict internal Arcanum first-choice DTOs (not native admission)", () => {
  it.each([6, 7, 8, 9] as const)("admits original canonical tier%s raw capture while preserving ordered extensions and exact bigint", tier => {
    const f = fixture(tier); const before = structuredClone(f.capture);
    expect(arcanumCaptureSchema.parse(f.capture)).toEqual(before); expect(arcanumReceiptSchema.parse(f.receipt)).toEqual(f.receipt);
    expect(parseArcanumRequest(f.request).expected_revision).toBe("9007199254740993");
    expect(f.capture.captured_grant.original_extension).toEqual({ ordered: ["prism", "horizon"] }); expect(f.capture).toEqual(before);
  });
  it.each(["earned_occurrence_id", "feature_grant_id", "spell_content_id", "operation_id"])("rejects canonical intent %s tampering", key => {
    const f = fixture(); const raw = structuredClone(f.capture); Object.assign(raw.canonical_intent, { [key]: originalId(9999) });
    expect(arcanumCaptureSchema.safeParse(raw).success).toBe(false);
  });
  it.each(["-1", "01", "1.5", "9223372036854775808", "invalid"])("refuses nonnative revision%s without safeParse throwing", expected_revision => {
    const f = fixture(); expect(() => parseArcanumRequest({ ...f.request, expected_revision })).toThrow();
    expect(arcanumCaptureSchema.safeParse({ ...f.capture, before_revision: expected_revision }).success).toBe(false);
  });
  it("rejects exhausted revision and fake increments", () => {
    const f = fixture(); expect(arcanumCaptureSchema.safeParse({ ...f.capture, after_revision: f.capture.before_revision }).success).toBe(false);
    const raw = structuredClone(f.capture); raw.before_revision = "9223372036854775807"; raw.after_revision = raw.before_revision; raw.canonical_intent.expected_revision = raw.before_revision;
    expect(arcanumCaptureSchema.safeParse(raw).success).toBe(false);
  });
  it.each(["copy", "inherited"])("refuses v1 capture kind%s, not a synthetic fresh human receipt", capture_kind => {
    const f = fixture(); expect(arcanumCaptureSchema.safeParse({ ...f.capture, capture_kind }).success).toBe(false);
    expect(arcanumReceiptSchema.safeParse({ ...f.receipt, capture_kind }).success).toBe(false);
  });
  it.each(["character_id", "selection_id", "earned_occurrence_id", "origin_id", "original_actor_id", "operation_id"])("rejects reciprocal receipt %s mismatch", key => {
    const f = fixture(); expect(arcanumReceiptSchema.safeParse({ ...f.receipt, [key]: originalId(9999) }).success).toBe(false);
  });
  it.each(["controller_snapshot", "feature_snapshot", "spell_snapshot"] as const)("rejects raw%s version/system/identity substitution", key => {
    const f = fixture(); const raw = structuredClone(f.capture); raw[key].system_id_snapshot = originalId(9999);
    expect(arcanumCaptureSchema.safeParse(raw).success).toBe(false);
    raw[key].system_id_snapshot = f.capture.system_id; raw[key].version += 1;
    expect(arcanumCaptureSchema.safeParse(raw).success).toBe(false);
  });
  it("preserves significant arrays; canonical key order does not change intent", () => {
    expect(sameArcanumJson({ b: ["prism", "horizon"], a: 1 }, { a: 1, b: ["prism", "horizon"] })).toBe(true);
    expect(sameArcanumJson({ a: ["prism", "horizon"] }, { a: ["horizon", "prism"] })).toBe(false);
  });
  it("caps transport before parse and refuses caller authority fields", () => {
    const f = fixture(); expect(() => parseArcanumRequest({ ...f.request, actor_id: f.parent.owner_id })).toThrow();
    expect(() => parseArcanumRequest({ ...f.request, extra: "x".repeat(8193) })).toThrow();
    expect(() => parseArcanumRead({ payload: "x".repeat(ARCANUM_READ_MAX_BYTES + 1) })).toThrow("budget");
  });
});

describe("actual-staged-body-bound POST-prefix MODEL phases only", () => {
  it("actual entry is always Auth unavailable; self-consistent fixture is not an issuer", () => {
    const f = fixture(); expect(() => f.model.invokeActualEntryForTest()).toThrow("AUTH_UNAVAILABLE");
  });
  it.each([0, 1, 4])("recorded spent%s history remains visible unchanged, never cast-ready/spent/reset", spent => {
    const f = fixture(6, spent), before = structuredClone(f.rows);
    const read = f.model.readRecordedAfterPrefixForTest(f.phase);
    expect(read.selections).toEqual([f.capture]); expect(read.receipts).toEqual([f.receipt]);
    expect(read.state).toEqual(f.parent.state); expect(read.current_eligibility).toEqual({ status: "unavailable", reason: "prerequisites_unimplemented" });
    expect(read.counts).toEqual({ selections: "1", receipts: "1" }); expect(f.rows).toEqual(before);
  });
  it.each([null, -1, 0.5, "1", { collision: true }])("malformed usage%j cannot become ready or hide recorded history", spent => {
    const f = fixture(6, spent); const read = f.model.readRecordedAfterPrefixForTest(f.phase);
    expect(read.selections).toEqual([f.capture]); expect(read.current_eligibility.status).toBe("unavailable"); expect(read.state).toEqual(f.parent.state);
  });
  it("replay precedes NEW expected revision/source/lineage gates, preserving original actor/time and raw receipt", () => {
    const f = fixture(); f.rows.parent.revision = "9007199254740999"; f.rows.parent.owner_id = originalId(9000);
    const phase = { ...f.phase, current_actor_id: f.rows.parent.owner_id };
    expect(f.model.selectAfterPrefixForTest(f.request, phase)).toEqual({ status: "recorded", receipt: f.receipt });
    expect(f.model.resolveAfterPrefixForTest(f.request.operation_id, phase)).toEqual({ status: "recorded", receipt: f.receipt });
    expect(f.receipt.original_actor_id).not.toBe(phase.current_actor_id); expect(f.receipt.accepted_at).toBe("2026-10-13T20:00:00.000001Z");
  });
  it("self-consistent foreign-system capture AND receipt cannot become current-parent history", () => {
    const f = fixture(), pair = foreignSystemArcanumPair(f);
    expect(arcanumCaptureSchema.parse(pair.capture)).toEqual(pair.capture);
    expect(arcanumReceiptSchema.parse(pair.receipt)).toEqual(pair.receipt);
    f.rows.captures = [pair.capture]; f.rows.receipts = [pair.receipt];
    const before = structuredClone(f.rows);
    expect(() => f.model.readRecordedAfterPrefixForTest(f.phase)).toThrow("Incomplete or foreign reciprocal selection graph");
    expect(f.rows).toEqual(before);
  });
  it("top-level read-system substitution cannot relabel a valid original pair", () => {
    const f = fixture(), read = f.model.readRecordedAfterPrefixForTest(f.phase);
    expect(parseArcanumRead(read)).toEqual(read);
    expect(() => parseArcanumRead({ ...read, system_id: originalId(9900) })).toThrow("Incomplete or foreign reciprocal selection graph");
  });
  it("current-parent system change refuses full history but preserves receipt-FIRST select/resolve recovery", () => {
    const f = fixture(); f.rows.parent.system_id = originalId(9900);
    const before = structuredClone(f.rows);
    expect(() => f.model.readRecordedAfterPrefixForTest(f.phase)).toThrow("Incomplete or foreign reciprocal selection graph");
    expect(f.model.selectAfterPrefixForTest(f.request, f.phase)).toEqual({ status: "recorded", receipt: f.receipt });
    expect(f.model.resolveAfterPrefixForTest(f.request.operation_id, f.phase)).toEqual({ status: "recorded", receipt: f.receipt });
    expect(f.rows).toEqual(before);
  });
  it("new generation/same occurrence cannot become an empty selection slot or positive first choice", () => {
    const f = fixture(); const current = { ...f.request, operation_id: originalId(9998), feature_grant_id: originalId(9999) };
    expect(f.model.selectAfterPrefixForTest(current, f.phase)).toEqual({ status: "unready", reason: "canonical_lineage_order_unimplemented" });
    expect(f.rows.captures).toEqual([f.capture]); expect(f.rows.parent.revision).toBe("9007199254740995");
  });
  it("fresh absent receipt is not cancellation; NEW commands always refuse even with valid modeled rows", () => {
    const f = fixture(); const op = originalId(9999);
    expect(f.model.resolveAfterPrefixForTest(op, f.phase)).toEqual({ status: "absent" });
    expect(f.model.selectAfterPrefixForTest({ ...f.request, operation_id: op }, f.phase).status).toBe("unready");
    expect(f.rows.receipts).toEqual([f.receipt]);
  });
  it("changed canonical intent for the same operation refuses instead of rewriting capture", () => {
    const f = fixture(); expect(f.model.selectAfterPrefixForTest({ ...f.request, spell_version: 3 }, f.phase)).toEqual({ status: "intent_conflict" });
    expect(f.rows.captures).toEqual([f.capture]);
  });
  it.each(["before", "return", "equality"])("native modeled expiry%s denies read/replay before return", when => {
    const f = fixture(); const phase = { ...f.phase, return_at: when === "return" ? "2026-10-13T20:10:00.000003Z" : f.phase.return_at,
      expires_at: when === "before" ? f.phase.before_at : f.phase.return_at };
    expect(() => f.model.readRecordedAfterPrefixForTest(phase)).toThrow("CURRENT_EXPIRY_DENIED");
    expect(() => f.model.resolveAfterPrefixForTest(f.request.operation_id, phase)).toThrow("CURRENT_EXPIRY_DENIED");
  });
  it("foreign current owner denies original receipt even though old actor matches capture", () => {
    const f = fixture(); f.rows.parent.owner_id = originalId(9999);
    expect(() => f.model.resolveAfterPrefixForTest(f.request.operation_id, f.phase)).toThrow("CURRENT_OWNER_DENIED");
  });
  it("modeled lifetime guard uses exact OLD parent, refuses reparent/update, and never treats caller identity as RI", () => {
    const f = fixture(), row = { ...f.capture, capture: f.capture };
    expect(() => f.model.lifetimeGuardForTest("DELETE", row, [f.parent])).toThrow("CAPTURE_LIFETIME_IMMUTABLE");
    expect(() => f.model.lifetimeGuardForTest("UPDATE", row, [f.parent])).toThrow("CAPTURE_IDENTITY_IMMUTABLE");
    expect(f.model.lifetimeGuardForTest("DELETE", row, [{ id: originalId(9999), system_id: f.parent.system_id }])).toBe("model_checked_exact_parent_cascade");
    expect(() => f.model.lifetimeGuardForTest("INSERT", { ...row, character_id: originalId(9999) }, [f.parent])).toThrow("EXACT_PARENT_UNAVAILABLE");
    expect(() => f.model.lifetimeGuardForTest("INSERT", { ...row, capture: { ...f.capture, character_id: originalId(9999) } }, [f.parent])).toThrow();
    expect(() => f.model.lifetimeGuardForTest("INSERT", { ...row, controller_ref_id: originalId(9999) }, [f.parent])).toThrow("CAPTURE_ROW_CORRESPONDENCE");
  });
  it("modeled deferred closure keeps pair mandatory while parent exists, permits only actual lifetime absence", () => {
    const f = fixture(); expect(f.model.deferredPairForTest([f.parent.id])).toBe("model_checked_pair_closure");
    f.rows.receipts = []; expect(() => f.model.deferredPairForTest([f.parent.id])).toThrow("RECIPROCAL_GRAPH_UNAVAILABLE");
    expect(f.model.deferredPairForTest([])).toBe("model_checked_exact_parent_cascade");
  });
  it.each(["missing", "extra", "raw-array", "foreign-parent"])("%s reciprocal graph is unavailable, never false empty", failure => {
    const f = fixture();
    if (failure === "missing") f.rows.captures = [];
    if (failure === "extra") f.rows.receipts.push(structuredClone(f.receipt));
    if (failure === "raw-array") f.rows.receipts[0].capture.captured_grant.original_extension = { ordered: ["horizon", "prism"] };
    if (failure === "foreign-parent") { f.rows.captures[0].character_id = originalId(9999); f.rows.receipts[0].character_id = originalId(9999); f.rows.receipts[0].capture.character_id = originalId(9999); }
    expect(() => f.model.readRecordedAfterPrefixForTest(f.phase)).toThrow();
  });
  it("static token-removal constructor refusal is SOURCE binding, not semantic/native before", () => {
    const f = fixture();
    expect(() => arcanumSelectionSourceModel(sql.replace("SELECT command.receipt,selection.capture", "SELECT receipt,capture"), authority, f.rows)).toThrow("Static source binding");
    expect(() => arcanumSelectionSourceModel(sql.replace("parent.id=OLD.character_id", "true"), authority, f.rows)).toThrow();
  });
});
