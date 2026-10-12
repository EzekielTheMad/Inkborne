import { describe, expect, it } from "vitest";
import { createClassConfirmationProducerModel } from "@/lib/character/class-origin-confirmation-model";
import { classConfirmationModelResultSchema, parseClassConfirmationIntent, parseClassConfirmationWorld } from "@/lib/character/class-origin-confirmation-schema";
import { classDataSchema } from "@/lib/schemas/content-types/class";
import { effectSchema } from "@/lib/schemas/effects";
import { subclassDataSchema } from "@/lib/schemas/content-types/subclass";
import { classConfirmationFixture, classConfirmationSources, classConfirmationSubclassFixture } from "@/tests/fixtures/class-origin-confirmation";
import { roleId } from "@/tests/fixtures/class-role-effects";

const model = createClassConfirmationProducerModel(classConfirmationSources());
function applied(mode: "level1" | "higher" | "multiclass" = "level1") {
  const fixture = classConfirmationFixture(mode), result = model.deriveForTest(fixture.intent, fixture.world);
  if (result.status !== "model_checked" || result.mode !== "applied") throw Error(`Positive source-bound model: ${JSON.stringify(result)}`);
  return { ...fixture, result };
}
describe("P1b.2 actual-source-bound confirmation reference only; no SQL/Auth execution", () => {
  it.each(["level1", "higher", "multiclass"] as const)("derives %s original current rows, three consumed proofs and one joint bump", mode => {
    const fixture = classConfirmationFixture(mode), before = structuredClone(fixture), result = model.deriveForTest(fixture.intent, fixture.world);
    expect(result.status).toBe("model_checked"); if (result.status !== "model_checked" || result.mode !== "applied") throw Error("Expected applied model");
    expect(result.receipt).toMatchObject({ before_action_revision: "5", after_action_revision: "6", before_class_revision: "3", after_class_revision: "4", accepted_at: fixture.world.acceptance_time });
    expect(result.acceptance.transitions).toHaveLength(3); expect(result.acceptance.transitions.every(t => t.consumed)).toBe(true);
    expect(result.event.phase).toBe("observed"); expect(result.graph.parent).toEqual({ ...fixture.world.owned_parent, action_revision: "6" });
    expect(result.graph.order).toEqual({ ...fixture.world.before_graph!.order, producer_revision: "6" });
    expect(result.graph.versions).toEqual(fixture.world.before_graph!.versions); expect(result.graph.refs).toEqual(fixture.world.before_graph!.refs);
    expect(result.graph.parent.state).toEqual(fixture.world.before_graph!.parent.state);
    expect(result.graph.occurrences[0]).toMatchObject({ lifecycle: "accepted", acquired_character_level: 1, acquisition_operation_id: fixture.intent.operation_id });
    for (const v of result.graph.versions) { expect(classDataSchema.safeParse(v.data_snapshot).success).toBe(true); for (const e of v.effects_snapshot as unknown[]) expect(effectSchema.safeParse(e).success).toBe(true); }
    expect(classConfirmationModelResultSchema.safeParse(result).success).toBe(true); expect(fixture).toEqual(before);
    expect(result.trace).toContain("private.class_origin_revision_event_closure_v1"); expect(model.traceEntryForTest().reason).toBe("auth_unavailable");
  });
  it("replays the original actor/time/revisions before unavailable new history and source gates", () => {
    const f = applied(); f.world.stored_receipt = structuredClone(f.result.receipt);
    f.world.before_graph = null; f.world.history = null; f.world.sources_before_wait = null; f.world.sources_after_wait = null;
    f.world.owned_parent.action_revision = "9223372036854775807";
    const result = model.deriveForTest(f.intent, f.world);
    expect(result).toMatchObject({ status: "model_checked", mode: "replayed", receipt: f.result.receipt });
    if (result.status !== "model_checked") throw Error("Replay must pass");
    expect(result.trace).not.toContain("private.class_confirmation_private_inputs_v1"); expect(result.trace).not.toContain("private.lock_class_confirmation_sources_v1");
  });
  it("current owner can replay without rewriting original accepted actor", () => {
    const f = applied(); f.world.stored_receipt = f.result.receipt; f.world.owned_parent.user_id = roleId(1200);
    for (const context of [f.world.context_at_entry, f.world.context_after_wait, f.world.context_before_return, f.world.context_at_acceptance]) context.actor_id = roleId(1200);
    const result = model.deriveForTest(f.intent, f.world); expect(result).toMatchObject({ status: "model_checked", mode: "replayed", receipt: f.result.receipt });
  });
  it.each(["after_wait_time", "before_return_time"] as const)("matching receipt refuses native equality expiry at %s", phase => {
    const f = applied(); f.world.stored_receipt = f.result.receipt; f.world[phase] = f.world.context_at_entry.jwt_expires_at;
    expect(model.deriveForTest(f.intent, f.world)).toMatchObject({ status: "model_refused", reason: "native_auth_expired_or_current_owner" });
  });
  it("receipt context session drift after waits refuses, with otherwise valid identity and expiry", () => {
    const f = applied(); f.world.stored_receipt = f.result.receipt; f.world.context_after_wait.session_id = roleId(1201);
    expect(model.deriveForTest(f.intent, f.world)).toMatchObject({ reason: "native_auth_expired_or_current_owner" });
  });
  it("operation collision never becomes fresh work or rewritten receipt", () => {
    const f = applied(); f.world.stored_receipt = f.result.receipt; f.intent.fields.selected_occurrence_id = roleId(1202);
    expect(model.deriveForTest(f.intent, f.world)).toMatchObject({ reason: "operation_intent_conflict" });
  });
  it.each(["retired", "snapshot", "current"] as const)("denies current acquisition %s while v2 never substitutes v1", kind => {
    const f = classConfirmationFixture();
    if (kind === "retired") f.world.sources_after_wait!.definitions[0].is_retired = true;
    if (kind === "current") f.world.sources_after_wait!.definitions[0].owner_id = roleId(1203);
    if (kind === "snapshot") { f.world.sources_after_wait!.versions[0].owner_id_snapshot = roleId(1203); f.world.before_graph!.versions[0].owner_id_snapshot = roleId(1203); }
    expect(model.deriveForTest(f.intent, f.world)).toMatchObject({ reason: "confirmation_acquisition_unavailable" });
  });
  it("shared same-campaign owner or member must satisfy both snapshot and current scope after waits", () => {
    const f = classConfirmationFixture(), campaign = roleId(1204), actor = f.world.context_at_entry.actor_id;
    f.world.before_graph!.parent.campaign_id = campaign; f.world.owned_parent.campaign_id = campaign;
    const s = f.world.sources_after_wait!; s.campaign = { id: campaign, system_id: f.world.owned_parent.system_id, owner_id: actor };
    s.definitions[0].owner_id = roleId(1205); s.definitions[0].scope = "shared"; s.versions[0].owner_id_snapshot = roleId(1205); s.versions[0].scope_snapshot = "shared";
    f.world.before_graph!.versions = structuredClone(s.versions); s.shares = [{ id: roleId(1206), campaign_id: campaign, content_id: s.definitions[0].id }];
    expect(model.deriveForTest(f.intent, f.world).status).toBe("model_checked");
    s.campaign.owner_id = roleId(1205); expect(model.deriveForTest(f.intent, f.world)).toMatchObject({ reason: "confirmation_acquisition_unavailable" });
    s.members = [{ id: roleId(1207), campaign_id: campaign, user_id: actor }]; expect(model.deriveForTest(f.intent, f.world).status).toBe("model_checked");
    s.shares = []; expect(model.deriveForTest(f.intent, f.world)).toMatchObject({ reason: "confirmation_acquisition_unavailable" });
  });
  it("unretired current identity is required even when the pinned version is selfconsistent foreign-system", () => {
    const f = classConfirmationFixture(); f.world.sources_after_wait!.definitions[0].system_id = roleId(1208);
    expect(model.deriveForTest(f.intent, f.world)).toMatchObject({ reason: "retained_version_identity_mismatch" });
  });
  it("canonical selected subclass is preserved and separately acquisition-checked", () => {
    const f = classConfirmationSubclassFixture(), version = f.world.before_graph!.versions.find(v => v.content_type_snapshot === "subclass")!;
    expect(subclassDataSchema.safeParse(version.data_snapshot).success).toBe(true);
    expect(model.deriveForTest(f.intent, f.world).status).toBe("model_checked");
    f.world.sources_after_wait!.definitions.find(d => d.content_type === "subclass")!.is_retired = true;
    expect(model.deriveForTest(f.intent, f.world)).toMatchObject({ reason: "confirmation_acquisition_unavailable" });
  });
  it("selfconsistent wrong subclass parent raw snapshots refuse canonical graph closure", () => {
    const f = classConfirmationSubclassFixture();
    for (const versions of [f.world.before_graph!.versions, f.world.sources_after_wait!.versions]) {
      (versions.find(v => v.content_type_snapshot === "subclass")!.data_snapshot as Record<string, unknown>).parent_class = "other-parent";
    }
    expect(model.deriveForTest(f.intent, f.world)).toMatchObject({ status: "model_refused", reason: "final_graph_receipt_mismatch" });
  });
  it("missing ordered ref and altered full immutable source bytes refuse the actual retained graph", () => {
    const f = classConfirmationFixture(); f.world.before_graph!.order.pins = [];
    expect(model.deriveForTest(f.intent, f.world)).toMatchObject({ status: "model_refused", reason: "final_graph_receipt_mismatch" });
    const changed = classConfirmationFixture(); changed.world.sources_after_wait!.versions[0].data_snapshot = { description: "Do not substitute changed bytes." };
    expect(model.deriveForTest(changed.intent, changed.world)).toMatchObject({ reason: "locked_versions_changed" });
  });
  it("missing actual current graph from unchanged direct-create/UI cannot be bootstrap proof", () => {
    const f = classConfirmationFixture(); f.world.history = null;
    expect(model.deriveForTest(f.intent, f.world)).toMatchObject({ reason: "creation_history_unavailable" });
    f.world.before_graph = null; expect(model.deriveForTest(f.intent, f.world)).toMatchObject({ reason: "actual_before_graph_required" });
  });
  it("selfconsistent foreign bootstrap actor cannot be inferred from current owner or header", () => {
    const f = classConfirmationFixture(), h = f.world.history!;
    h.bootstrap.verified_actor_id = roleId(1209); h.creation_row.verified_actor_id = roleId(1209); h.creation_row.receipt.verified_actor_id = roleId(1209); h.bootstrap.receipt = structuredClone(h.creation_row.receipt);
    expect(model.deriveForTest(f.intent, f.world)).toMatchObject({ reason: "bootstrap_correspondence_mismatch" });
  });
  it("missing bootstrap INSERT proof or synthetic zero counters cannot establish fresh absence", () => {
    const f = classConfirmationFixture(); f.world.history!.bootstrap.transitions[0].before_row = {};
    f.world.history!.bootstrap.planned_transitions[0].before_row = {};
    expect(model.deriveForTest(f.intent, f.world)).toMatchObject({ reason: "bootstrap_insert_proof_mismatch" });
  });
  it("selected insertion tuple is frozen even if expected history changes selfconsistently", () => {
    const f = classConfirmationFixture(), s = f.world.history!.selection;
    s.transitions[0].after_row!.controller_ref_id = roleId(1210); s.planned_transitions[0].after_row!.controller_ref_id = roleId(1210);
    s.expected_graph.occurrences[0].controller_ref_id = roleId(1210);
    expect(model.deriveForTest(f.intent, f.world)).toMatchObject({ reason: "selection_insert_correspondence_mismatch" });
  });
  it("unconsumed historical proof cannot be accepted as a complete old producer", () => {
    const f = classConfirmationFixture(); f.world.history!.selection.transitions[0].consumed = false;
    expect(model.deriveForTest(f.intent, f.world)).toMatchObject({ reason: "selection_insert_correspondence_mismatch" });
  });
  it.each(["fresh_draft_copy", "confirmed_copy", "legacy_unavailable"])("does not mint new origin for %s", provenance => {
    const f = classConfirmationFixture(); f.world.before_graph!.origin.creation_provenance = provenance;
    expect(model.deriveForTest(f.intent, f.world)).toMatchObject({ reason: "draft_provenance_unavailable" });
  });
  it("new confirmation at revision ceiling refuses while known replay is separately permitted", () => {
    const f = classConfirmationFixture(); f.intent.expected_action_revision = "9223372036854775807";
    f.world.owned_parent.action_revision = f.intent.expected_action_revision; f.world.before_graph!.parent.action_revision = f.intent.expected_action_revision;
    f.world.before_graph!.order.producer_revision = f.intent.expected_action_revision;
    expect(model.deriveForTest(f.intent, f.world)).toMatchObject({ reason: "confirmation_revision_exhausted" });
  });
  it("native acceptance equality-expiry refuses before issuing a marker", () => {
    const f = classConfirmationFixture(); f.world.acceptance_time = f.world.context_at_entry.jwt_expires_at;
    expect(model.deriveForTest(f.intent, f.world)).toMatchObject({ reason: "native_acceptance_expired_or_future_selection" });
  });
  it("strict shapes refuse caller graphs/actor fields, nonfinite/cyclic input and oversized decimal revisions", () => {
    const f = classConfirmationFixture(); expect(parseClassConfirmationIntent({ ...f.intent, actor_id: roleId(9) })).toBeNull();
    expect(parseClassConfirmationIntent({ ...f.intent, expected_action_revision: "9223372036854775808" })).toBeNull();
    expect(parseClassConfirmationIntent({ ...f.intent, expected_class_revision: 3 })).toBeNull();
    const cycle: Record<string, unknown> = {}; cycle.self = cycle; expect(parseClassConfirmationWorld(cycle)).toBeNull();
    expect(parseClassConfirmationWorld({ ...f.world, acceptance_time: Infinity })).toBeNull();
    expect(parseClassConfirmationWorld({ ...f.world, invented_auth_authority: true })).toBeNull();
  });
});
