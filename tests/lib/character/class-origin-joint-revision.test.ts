import { describe, expect, it } from "vitest";
import { createClassOriginJointRevisionModel } from "@/lib/character/class-origin-joint-revision-model";
import { parseClassOriginRevisionEvent, classOriginRevisionEventSchema, boundedClassOriginRevisionJson } from "@/lib/character/class-origin-revision-event-schema";
import { classDataSchema } from "@/lib/schemas/content-types/class";
import { classOriginJointFixture, classOriginJointSources } from "@/tests/fixtures/class-origin-joint-revision";
import { classOriginBootstrapFixture, classOriginCopiedFixture, refreshClassOriginFixtureProofs } from "@/tests/fixtures/class-origin-command";
import { roleId } from "@/tests/fixtures/class-role-effects";

const sources = classOriginJointSources(), model = createClassOriginJointRevisionModel(sources);
function phases(mode: "level1" | "higher" | "multiclass" = "level1") {
  const fixture = classOriginJointFixture(mode), j = fixture.acceptance;
  const emitted = model.emitForTest(j, fixture.actualBefore, "900");
  if (emitted.status !== "model_checked") throw Error(`Emit: ${emitted.reason}`);
  const assigned = model.assignForTest(j, emitted.event, fixture.actualBefore, j.expected_graph.parent, "900");
  if (assigned.status !== "model_checked") throw Error(`Assign: ${assigned.reason}`);
  const actualAfter = structuredClone(fixture.actualBefore);
  actualAfter.parent = structuredClone(assigned.parent); actualAfter.order.producer_revision = emitted.event.after_action_revision;
  const observed = model.observeForTest(j, assigned.event, actualAfter, assigned.parent, "900");
  if (observed.status !== "model_checked") throw Error(`Observe: ${observed.reason}`);
  const consumed = model.consumeForTest(j, observed.event, actualAfter, "900");
  if (consumed.status !== "model_checked") throw Error(`Consume: ${consumed.reason}`);
  const final = structuredClone(consumed.acceptance); final.finalized = true;
  final.transitions.find(row => row.relation_key === "class_receipt")!.consumed = true;
  return { ...fixture, emitted, assigned, actualAfter, observed, consumed, final };
}
describe("P1b.1 actual-source-bound joint phases only, no SQL/Auth/writer acceptance", () => {
  it.each(["level1", "higher", "multiclass"] as const)("genuine already-first %s metadata has one observed shared/class/order step", mode => {
    const original = classOriginJointFixture(mode), untouched = structuredClone(original), proof = phases(mode);
    for (const version of proof.actualAfter.versions) expect(classDataSchema.safeParse(version.data_snapshot).success).toBe(true);
    expect(proof.emitted.event.phase).toBe("pending"); expect(proof.assigned.event.phase).toBe("assigned"); expect(proof.observed.event.phase).toBe("observed");
    expect(proof.actualAfter.parent).toEqual({ ...proof.acceptance.before_parent, action_revision: "1" });
    expect(proof.actualAfter.origin.command_revision).toBe("1"); expect(proof.actualAfter.order).toEqual({ ...proof.actualBefore.order, producer_revision: "1" });
    expect(proof.consumed.acceptance.revision_transition_consumed).toBe(true);
    for (const phase of ["immediate", "deferred"] as const) expect(model.finalizeForTest(proof.final, proof.observed.event, proof.actualAfter, proof.final.receipt, "900", phase).status).toBe("model_checked");
    expect(original).toEqual(untouched); expect(model.traceEntryForTest({ actor_id: roleId(9) }, proof.final.receipt.canonical_intent).status).toBe("unready");
  });
  it("semantic frozen-before: valid model constructs and rejects revision-only parent change; original Boolean-only model misses observed event", () => {
    const old = createClassOriginJointRevisionModel({ ...sources, joint: null }), proof = phases();
    expect(old.mode).toBe("frozen_base_only");
    expect(old.originalFinalizeForTest(proof.final, proof.actualAfter, proof.final.receipt, "900", "deferred").status).toBe("model_checked");
    const before = proof.acceptance.before_parent;
    expect(old.ordinaryParentUpdateForTest(before, before).status).toBe("model_checked");
    const missing = old.ordinaryParentUpdateForTest(before, proof.actualAfter.parent);
    expect(missing.status).toBe("model_rejected"); if (missing.status === "model_rejected") expect(missing.reason).toBe("revision_database_controlled");
    expect(model.finalizeForTest(proof.final, null, proof.actualAfter, proof.final.receipt, "900", "deferred").status).toBe("model_rejected");
  });
  it("keeps original ordinary inspiration/no-op/exhaustion semantics without an event", () => {
    const fixture = classOriginJointFixture(), before = fixture.acceptance.before_parent;
    expect(model.ordinaryParentUpdateForTest(before, before)).toMatchObject({ status: "model_checked", parent: before });
    expect(model.ordinaryParentUpdateForTest(before, { ...before, state: { ...(before.state as object), inspiration: true }, action_revision: "999" })).toMatchObject({ status: "model_checked", parent: { action_revision: "1" } });
    expect(model.ordinaryParentUpdateForTest({ ...before, action_revision: "9223372036854775807" }, { ...before, state: { inspiration: true } }).status).toBe("model_rejected");
  });
  it.each(["planned-only", "unconsumed-origin", "unconsumed-occurrence", "wrong-xid", "wrong-owner", "changed-order", "changed-parent", "wrong-pin", "legacy", "already-finalized"])("does not emit from %s evidence", mode => {
    const fixture = classOriginJointFixture(), j = fixture.acceptance, actual = fixture.actualBefore;
    if (mode === "planned-only") actual.origin = structuredClone(j.before_origin);
    if (mode === "unconsumed-origin") j.transitions.find(row => row.relation_key === "origin")!.consumed = false;
    if (mode === "unconsumed-occurrence") j.transitions.find(row => row.relation_key === "occurrence")!.consumed = false;
    if (mode === "wrong-owner") actual.parent.user_id = roleId(999);
    if (mode === "changed-order") actual.order.pins = [];
    if (mode === "changed-parent") actual.parent.level = 2;
    if (mode === "wrong-pin") actual.refs[0].content_id = roleId(999);
    if (mode === "legacy") { actual.origin.creation_provenance = null; j.expected_graph.origin.creation_provenance = null; refreshClassOriginFixtureProofs(j); }
    if (mode === "already-finalized") j.finalized = true;
    expect(model.emitForTest(j, actual, mode === "wrong-xid" ? "901" : "900").status).toBe("model_rejected");
  });
  it.each(["target", "actor", "operation", "xid", "counter", "parent", "mode", "extra"])("rejects forged %s event", mode => {
    const proof = phases(), event = structuredClone(proof.emitted.event) as unknown as Record<string, unknown>;
    if (mode === "target") event.target_character_id = roleId(999);
    if (mode === "actor") event.verified_actor_id = roleId(999);
    if (mode === "operation") event.operation_id = roleId(999);
    if (mode === "xid") event.transaction_id = "901";
    if (mode === "counter") event.after_action_revision = "2";
    if (mode === "parent") (event.before_parent as Record<string, unknown>).name = "tampered";
    if (mode === "mode") event.mode = "bootstrap_new";
    if (mode === "extra") event.current_user = "inkborne_hit_die_authority_owner";
    expect(model.assignForTest(proof.acceptance, event, proof.actualBefore, proof.actualAfter.parent, "900").status).toBe("model_rejected");
  });
  it("no phase skip/reuse/Boolean-before-observation or missing order rebind passes", () => {
    const proof = phases();
    expect(model.observeForTest(proof.acceptance, proof.emitted.event, proof.actualAfter, proof.actualAfter.parent, "900").status).toBe("model_rejected");
    expect(model.assignForTest(proof.acceptance, proof.assigned.event, proof.actualBefore, proof.actualAfter.parent, "900").status).toBe("model_rejected");
    expect(model.consumeForTest(proof.acceptance, proof.assigned.event, proof.actualAfter, "900").status).toBe("model_rejected");
    expect(model.consumeForTest(proof.consumed.acceptance, proof.observed.event, proof.actualAfter, "900").status).toBe("model_rejected");
    expect(model.observeForTest(proof.acceptance, proof.assigned.event, { ...proof.actualAfter, order: proof.actualBefore.order }, proof.actualAfter.parent, "900").status).toBe("model_rejected");
    expect(model.observeForTest(proof.acceptance, proof.assigned.event, proof.actualAfter, { ...proof.actualAfter.parent, name: "unexpected returning" }, "900").status).toBe("model_rejected");
  });
  it.each(["counter", "arrays", "raw-metadata", "receipt", "unconsumed-receipt"])("late %s change refuses final deferred closure", mode => {
    const proof = phases(), graph = structuredClone(proof.actualAfter), storedReceipt = structuredClone(proof.final.receipt);
    if (mode === "counter") graph.parent.action_revision = "2";
    if (mode === "arrays") graph.order.pins = [];
    if (mode === "raw-metadata") graph.origin.original_extension = ["changed"];
    if (mode === "receipt") storedReceipt.operation_id = roleId(999);
    if (mode === "unconsumed-receipt") proof.final.transitions.find(row => row.relation_key === "class_receipt")!.consumed = false;
    expect(model.finalizeForTest(proof.final, proof.observed.event, graph, storedReceipt, "900", "deferred").status).toBe("model_rejected");
  });
  it("recorded operation cannot emit/reassign another event; bootstrap remains zero and unsupported here", () => {
    const proof = phases(); expect(model.emitForTest(proof.final, proof.actualAfter, "900").status).toBe("model_rejected");
    for (const j of [classOriginBootstrapFixture(), classOriginCopiedFixture(), classOriginCopiedFixture(true)]) {
      expect(j.expected_graph.parent.action_revision).toBe("0"); expect(model.emitForTest(j, j.expected_graph, "900").status).toBe("model_rejected");
      expect(model.originalFinalizeForTest(j, j.expected_graph, j.receipt, "900", "deferred").status).toBe("model_checked");
    }
  });
  it.each(["bad", "1e2", "-1", "01", "9223372036854775808", 1])("decimal %s cannot throw or be accepted", value => {
    const proof = phases(); expect(() => parseClassOriginRevisionEvent({ ...proof.emitted.event, before_action_revision: value })).not.toThrow();
    expect(parseClassOriginRevisionEvent({ ...proof.emitted.event, before_action_revision: value })).toBeNull();
  });
  it("strict observed NULL fields, finite JSON and aggregate8MiB are enforced before parsing", () => {
    const proof = phases();
    expect(classOriginRevisionEventSchema.safeParse({ ...proof.observed.event, observed_parent: null }).success).toBe(false);
    expect(classOriginRevisionEventSchema.safeParse({ ...proof.emitted.event, observed_parent: proof.actualAfter.parent }).success).toBe(false);
    const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic; expect(parseClassOriginRevisionEvent(cyclic)).toBeNull();
    expect(boundedClassOriginRevisionJson({ native: Number.POSITIVE_INFINITY })).toBe(false);
    expect(boundedClassOriginRevisionJson({ notes: "x".repeat(5 * 1024 * 1024) })).toBe(true);
    expect(parseClassOriginRevisionEvent({ ...proof.emitted.event, before_parent: { ...proof.emitted.event.before_parent, notes: "x".repeat(4 * 1024 * 1024) }, expected_after_parent: { ...proof.emitted.event.expected_after_parent, notes: "x".repeat(4 * 1024 * 1024) } })).toBeNull();
  });
  it("models actual source dependencies and refuses detached critical predicates separately from semantic before", () => {
    for (const predicate of ["origin_proof.after_row IS DISTINCT FROM origin_json", "RETURNING * INTO after_row", "event.observed_order IS DISTINCT FROM order_json", "SET phase='assigned'", "private.class_origin_observed_revision_v1(NEW.acceptance_id)"]) {
      expect(() => createClassOriginJointRevisionModel({ ...sources, joint: sources.joint!.replace(predicate, "removed_predicate") })).toThrow();
    }
    expect(() => createClassOriginJointRevisionModel({ ...sources, joint: sources.joint!.replace("NEW.action_revision := OLD.action_revision + 1", "NEW.action_revision := OLD.action_revision + 2") })).toThrow();
  });
});
