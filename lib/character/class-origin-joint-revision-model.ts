import { createClassOriginStageModel } from "./class-origin-command-model";
import { classOriginAcceptanceSchema, classOriginGraphSchema, classOriginInstantMicros, type ClassOriginAcceptance, type ClassOriginGraph } from "./class-origin-command-schema";
import { boundedClassRoleJson, classRoleRevisionSchema } from "./class-role-effects-schema";
import { parseClassOriginRevisionEvent, sameClassOriginRevision as same, type ClassOriginRevisionEvent } from "./class-origin-revision-event-schema";

/** Actual stage source trace/reference ONLY. No SQL engine, Auth, producer or app import. */
export const CLASS_ORIGIN_JOINT_STAGE_PATH = "supabase/staged/class-origin-joint-revision.sql";
export const CLASS_ORIGIN_AUTHORITY_BASE = "1d028063b8bc5bf2e82bc4de54b80999f44862fa";
export type ClassOriginJointSources = { authority: string; p1a: string; joint: string | null };
const watched = ["state", "base_stats", "choices", "level", "system_id", "campaign_id", "archived", "user_id"] as const;
function body(source: string, name: string): string {
  source = source.replace(/\r\n/g, "\n");
  const plain = source.indexOf(`CREATE FUNCTION ${name}(`), replacement = source.indexOf(`CREATE OR REPLACE FUNCTION ${name}(`);
  const start = plain < 0 ? replacement : replacement < 0 ? plain : Math.min(plain, replacement);
  const opening = start < 0 ? -1 : source.indexOf("AS $$", start), end = opening < 0 ? -1 : source.indexOf("$$;", opening + 5);
  if (start < 0 || end < 0) throw Error(`Actual joint body absent: ${name}`);
  return source.slice(start, end + 3);
}
const normalizedOrder = (graph: ClassOriginGraph, revision: string) => ({ ...graph.order, producer_revision: revision });
function metadataDelta(acceptance: ClassOriginAcceptance, actual: ClassOriginGraph, xid: string): string | null {
  if (acceptance.acceptance_kind !== "class_transition" || acceptance.transaction_id !== xid
    || acceptance.receipt.receipt_kind !== "class_transition" || acceptance.receipt.canonical_intent.command !== "confirm_origin") return "exact_metadata_acceptance_required";
  const j = acceptance, receipt = j.receipt;
  if (receipt.receipt_kind !== "class_transition" || receipt.canonical_intent.command !== "confirm_origin") return "exact_metadata_acceptance_required";
  const selected = receipt.canonical_intent.fields.selected_occurrence_id;
  if (actual.parent.id !== j.target_character_id || actual.parent.user_id !== j.verified_actor_id || actual.parent.system_id !== j.before_parent.system_id
    || !same(j.expected_graph.parent, { ...j.before_parent, action_revision: receipt.after_action_revision })
    || (j.before_parent.choices as { classes?: { occurrence_id?: string }[] })?.classes?.[0]?.occurrence_id !== selected
    || !same(actual.origin, j.expected_graph.origin)) return "actual_metadata_identity_mismatch";
  const origins = j.transitions.filter(row => row.relation_key === "origin" && same(row.row_key, [j.target_character_id]) && row.consumed);
  const proofs = j.transitions.filter(row => row.relation_key === "occurrence" && same(row.row_key, [selected]) && row.consumed);
  const occurrence = actual.occurrences.find(row => row.id === selected), before = proofs[0]?.before_row;
  const header = actual.origin;
  if (origins.length !== 1 || !same(origins[0].before_row, j.before_origin) || !same(origins[0].after_row, header)
    || j.before_origin.origin_status !== "draft" || j.before_origin.origin_occurrence_id !== null || j.before_origin.role_proof !== null
    || header.origin_status !== "recorded" || header.origin_occurrence_id !== selected || header.system_id !== actual.parent.system_id
    || !["new_character", "fresh_draft_copy"].includes(String(header.creation_provenance)) || !header.creation_operation_id
    || !same(header.role_proof, { kind: "confirmation", receipt: receipt.confirmation })
    || j.before_parent.action_revision !== receipt.before_action_revision || j.before_origin.command_revision !== receipt.before_class_revision
    || header.command_revision !== receipt.after_class_revision
    || !classRoleRevisionSchema.safeParse(j.before_origin.command_revision).success || !classRoleRevisionSchema.safeParse(header.command_revision).success
    || BigInt(String(header.command_revision)) !== BigInt(String(j.before_origin.command_revision)) + BigInt(1)) return "actual_origin_transition_mismatch";
  const beforeHeader = { ...j.before_origin }, afterHeader = { ...header };
  for (const key of ["command_revision", "origin_status", "origin_occurrence_id", "role_proof"]) { delete beforeHeader[key]; delete afterHeader[key]; }
  if (!same(beforeHeader, afterHeader)) return "actual_origin_transition_mismatch";
  const selectedTime = classOriginInstantMicros(before?.selected_at), accepted = classOriginInstantMicros(occurrence?.accepted_at);
  if (proofs.length !== 1 || !before || !occurrence || before.lifecycle !== "provisional" || occurrence.lifecycle !== "accepted"
    || before.acquired_character_level !== null || before.acquisition_operation_id !== null || before.accepted_at !== null || before.ended_at !== null
    || occurrence.acquired_character_level !== 1 || occurrence.acquisition_operation_id !== receipt.operation_id || occurrence.ended_at !== null
    || occurrence.system_id !== actual.parent.system_id || selectedTime === null || accepted === null || selectedTime > accepted
    || accepted !== classOriginInstantMicros(receipt.accepted_at) || !same(proofs[0].after_row, occurrence)
    || ["id", "character_id", "system_id", "content_id", "content_version", "class_slug", "selected_at", "controller_ref_id"].some(key => !same(before[key], occurrence[key]))) return "actual_selected_transition_mismatch";
  const pin = actual.refs.find(row => row.id === occurrence.controller_ref_id), version = pin && actual.versions.find(row => row.content_id === pin.content_id && row.version === pin.content_version);
  if (!pin || !version || pin.character_id !== j.target_character_id || pin.content_id !== occurrence.content_id || pin.content_version !== occurrence.content_version
    || (pin.context as { source?: unknown })?.source !== "class" || version.content_type_snapshot !== "class"
    || version.slug_snapshot !== occurrence.class_slug || version.system_id_snapshot !== actual.parent.system_id) return "actual_selected_pin_mismatch";
  return null;
}
function parseWorld(input: unknown, actual: unknown) {
  if (!boundedClassRoleJson(input) || !boundedClassRoleJson(actual)) return null;
  const j = classOriginAcceptanceSchema.safeParse(input), graph = classOriginGraphSchema.safeParse(actual);
  return j.success && graph.success ? { j: j.data, actual: graph.data } : null;
}
function eventIdentity(j: ClassOriginAcceptance, event: ClassOriginRevisionEvent): boolean {
  if (j.acceptance_kind !== "class_transition" || j.receipt.receipt_kind !== "class_transition" || j.receipt.canonical_intent.command !== "confirm_origin") return false;
  return event.acceptance_id === j.acceptance_id && event.transaction_id === j.transaction_id && event.target_character_id === j.target_character_id
    && event.verified_actor_id === j.verified_actor_id && event.operation_id === j.receipt.operation_id
    && event.before_action_revision === j.receipt.before_action_revision && event.after_action_revision === j.receipt.after_action_revision
    && same(event.before_parent, j.before_parent) && same(event.expected_after_parent, j.expected_graph.parent)
    && same(event.origin_transition_key, [j.target_character_id]) && same(event.occurrence_transition_key, [j.receipt.canonical_intent.fields.selected_occurrence_id]);
}
export function createClassOriginJointRevisionModel(sources: ClassOriginJointSources) {
  const base = createClassOriginStageModel(sources.p1a);
  const original = body(sources.authority, "private.hit_die_character_revision_v1"), rebind = body(sources.authority, "private.hit_die_order_revision_rebind_v1");
  if (!original.includes("NEW.action_revision := OLD.action_revision + 1") || !original.includes("Revision is database controlled")
    || !rebind.includes("SET producer_revision = NEW.action_revision") || rebind.includes("INSERT INTO")) throw Error("Actual frozen authority unavailable");
  if (sources.joint !== null) {
    const checks: Record<string, string[]> = {
      "private.class_origin_metadata_delta_v1": ["occurrence_proof.after_row IS DISTINCT FROM pg_catalog.to_jsonb(occurrence)", "origin_proof.after_row IS DISTINCT FROM origin_json", "Consumed selected occurrence required"],
      "private.class_origin_observed_revision_v1": ["event.phase<>'observed'", "event.observed_parent IS DISTINCT FROM parent_json", "event.observed_order IS DISTINCT FROM order_json"],
      "private.class_origin_assert_metadata_revision_v1": ["NOT j.finalized", "NOT j.revision_transition_consumed", "receipt=j.receipt"],
      "private.class_origin_consume_metadata_revision_v1": ["SET revision_transition_consumed=true", "NOT finalized AND NOT revision_transition_consumed", "changed<>1"],
      "private.class_origin_revision_event_guard_v1": ["NEW.transaction_id IS DISTINCT FROM pg_catalog.pg_current_xact_id()", "8388608", "OLD.phase='pending' AND NEW.phase='assigned'", "NEW.observed_parent=parent_json"],
      "private.apply_class_metadata_revision_v1": ["SET action_revision=before_shared+1", "RETURNING * INTO after_row", "parent_json IS DISTINCT FROM after_json", "phase='observed'", "class_origin_consume_metadata_revision_v1"],
      "private.class_origin_revision_event_closure_v1": ["class_origin_assert_metadata_revision_v1(NEW.acceptance_id)"],
      "private.class_origin_metadata_revision_dispatch_v1": ["OLD.origin_status='draft' AND NEW.origin_status='recorded'", "proof.before_row=", "proof.after_row=", "private.apply_class_metadata_revision_v1"],
      "private.class_origin_acceptance_guard_v1": ["private.class_origin_observed_revision_v1(NEW.acceptance_id)", "Actual before parent mismatch"],
      "private.class_origin_finalize_transition_v1": ["private.class_origin_assert_metadata_revision_v1(p_acceptance)", "private.class_origin_assert_common_v1(p_acceptance)"],
      "private.hit_die_character_revision_v1": ["event.phase<>'pending'", "No mixed mechanical metadata branch", "SET phase='assigned'"],
    };
    for (const [name, predicates] of Object.entries(checks)) if (predicates.some(check => !body(sources.joint!, name).includes(check))) throw Error(`Actual staged joint checks absent: ${name}`);
    const revision = body(sources.joint, "private.hit_die_character_revision_v1"), marker = "  IF (NEW.state,NEW.base_stats";
    if (revision.slice(revision.indexOf(marker)) !== original.slice(original.indexOf(marker))) throw Error("Ordinary frozen revision branch changed");
    if (body(sources.joint, "private.class_origin_revision_event_closure_v1").includes("class_origin_finalize_acceptance_v1")) throw Error("Redundant cross-owner finalizer call");
    const tableAt = sources.joint.indexOf("CREATE TABLE private.class_origin_revision_events_v1"), deltaAt = sources.joint.indexOf("CREATE FUNCTION private.class_origin_metadata_delta_v1");
    const helperAt = sources.joint.indexOf("CREATE FUNCTION private.apply_class_metadata_revision_v1"), replacementAt = sources.joint.indexOf("CREATE OR REPLACE FUNCTION private.class_origin_acceptance_guard_v1");
    const triggerAt = sources.joint.indexOf("CREATE TRIGGER class_origin_revision_event_guard");
    if (!(tableAt >= 0 && tableAt < deltaAt && deltaAt < helperAt && helperAt < replacementAt && replacementAt < triggerAt)
      || !sources.joint.includes("DEFERRABLE INITIALLY DEFERRED") || !sources.joint.includes("FROM PUBLIC,anon,authenticated,service_role")) throw Error("Actual staged joint installation closure absent");
  }
  const reject = (reason: string, trace: string[] = []) => ({ status: "model_rejected" as const, reason, trace });
  const prefix = ["private.class_origin_metadata_revision_dispatch_v1", "private.class_origin_metadata_delta_v1"];
  function checked(input: unknown, eventInput: unknown, actualInput: unknown, xid: string) {
    const world = parseWorld(input, actualInput), event = parseClassOriginRevisionEvent(eventInput);
    if (!world || !event || !eventIdentity(world.j, event) || event.transaction_id !== xid) return null;
    return metadataDelta(world.j, world.actual, xid) === null ? { ...world, event } : null;
  }
  return {
    mode: sources.joint === null ? "frozen_base_only" as const : "joint_source" as const,
    traceEntryForTest: base.traceEntryForTest,
    originalFinalizeForTest: base.finalizeForTest,
    ordinaryParentUpdateForTest(oldInput: Record<string, unknown>, requested: Record<string, unknown>) {
      if (!boundedClassRoleJson(oldInput) || !boundedClassRoleJson(requested) || !classRoleRevisionSchema.safeParse(oldInput.action_revision).success) return reject("invalid_parent");
      if (watched.some(key => !same(oldInput[key], requested[key]))) {
        if (oldInput.action_revision === "9223372036854775807") return reject("revision_exhausted");
        return { status: "model_checked" as const, parent: { ...requested, action_revision: (BigInt(String(oldInput.action_revision)) + BigInt(1)).toString() }, trace: ["private.hit_die_character_revision_v1"] };
      }
      return oldInput.action_revision === requested.action_revision ? { status: "model_checked" as const, parent: structuredClone(requested), trace: ["private.hit_die_character_revision_v1"] } : reject("revision_database_controlled", ["private.hit_die_character_revision_v1"]);
    },
    emitForTest(input: unknown, actualInput: unknown, xid: string) {
      if (sources.joint === null) return reject("joint_stage_absent", prefix);
      const world = parseWorld(input, actualInput);
      if (!world || world.j.acceptance_kind !== "class_transition" || world.j.finalized || world.j.revision_transition_consumed) return reject("pending_acceptance_required", prefix);
      const { j, actual } = world, reason = metadataDelta(j, actual, xid);
      if (reason) return reject(reason, prefix);
      if (!same(actual.parent, j.before_parent) || !same(actual.order, normalizedOrder(j.expected_graph, String(j.before_parent.action_revision)))) return reject("actual_before_parent_order_mismatch", prefix);
      const receipt = j.receipt;
      if (receipt.receipt_kind !== "class_transition" || receipt.canonical_intent.command !== "confirm_origin") return reject("unsupported_command", prefix);
      const event = parseClassOriginRevisionEvent({ event_version: 1, mode: "metadata_only_confirm", acceptance_id: j.acceptance_id, transaction_id: xid,
        target_character_id: j.target_character_id, verified_actor_id: j.verified_actor_id, operation_id: receipt.operation_id,
        before_action_revision: receipt.before_action_revision, after_action_revision: receipt.after_action_revision,
        origin_transition_key: [j.target_character_id], occurrence_transition_key: [receipt.canonical_intent.fields.selected_occurrence_id],
        before_parent: structuredClone(actual.parent), expected_after_parent: structuredClone(j.expected_graph.parent), before_order: structuredClone(actual.order),
        phase: "pending", observed_parent: null, observed_order: null });
      return event ? { status: "model_checked" as const, event, trace: [...prefix, "private.apply_class_metadata_revision_v1", "private.class_origin_revision_event_guard_v1"] } : reject("invalid_event", prefix);
    },
    assignForTest(input: unknown, eventInput: unknown, actualInput: unknown, requested: unknown, xid: string) {
      const proof = sources.joint === null ? null : checked(input, eventInput, actualInput, xid);
      if (!proof || proof.j.acceptance_kind !== "class_transition" || proof.j.finalized || proof.j.revision_transition_consumed || proof.event.phase !== "pending") return reject("one_pending_event_required");
      if (!boundedClassRoleJson(requested) || !same(proof.actual.parent, proof.event.before_parent) || !same(requested, proof.event.expected_after_parent)
        || !same(proof.actual.order, proof.event.before_order)) return reject("no_mixed_mechanical_metadata_branch");
      const event = parseClassOriginRevisionEvent({ ...proof.event, phase: "assigned" });
      return event ? { status: "model_checked" as const, event, parent: structuredClone(proof.event.expected_after_parent), trace: ["private.hit_die_character_revision_v1", "private.class_origin_revision_event_guard_v1"] } : reject("invalid_assigned_event");
    },
    observeForTest(input: unknown, eventInput: unknown, actualInput: unknown, returningParent: unknown, xid: string) {
      const proof = sources.joint === null ? null : checked(input, eventInput, actualInput, xid);
      if (!proof || proof.j.acceptance_kind !== "class_transition" || proof.j.finalized || proof.j.revision_transition_consumed || proof.event.phase !== "assigned") return reject("assigned_event_required");
      if (!boundedClassRoleJson(returningParent) || !same(returningParent, proof.event.expected_after_parent) || !same(proof.actual.parent, returningParent)
        || !same(proof.actual.order, { ...proof.event.before_order, producer_revision: proof.event.after_action_revision })) return reject("actual_returning_stored_order_mismatch");
      const event = parseClassOriginRevisionEvent({ ...proof.event, phase: "observed", observed_parent: structuredClone(proof.actual.parent), observed_order: structuredClone(proof.actual.order) });
      return event ? { status: "model_checked" as const, event, trace: ["private.apply_class_metadata_revision_v1", "private.hit_die_order_revision_rebind_v1", "private.class_origin_revision_event_guard_v1"] } : reject("invalid_observed_event");
    },
    consumeForTest(input: unknown, eventInput: unknown, actualInput: unknown, xid: string) {
      const proof = sources.joint === null ? null : checked(input, eventInput, actualInput, xid);
      if (!proof || proof.j.acceptance_kind !== "class_transition" || proof.j.finalized || proof.j.revision_transition_consumed || proof.event.phase !== "observed"
        || !same(proof.actual.parent, proof.event.observed_parent) || !same(proof.actual.order, proof.event.observed_order)) return reject("observed_one_use_proof_required");
      return { status: "model_checked" as const, acceptance: { ...structuredClone(proof.j), revision_transition_consumed: true }, trace: ["private.class_origin_observed_revision_v1", "private.class_origin_consume_metadata_revision_v1", "private.class_origin_acceptance_guard_v1"] };
    },
    finalizeForTest(input: unknown, eventInput: unknown, actualInput: unknown, receipt: unknown, xid: string, phase: "immediate" | "deferred") {
      const proof = sources.joint === null ? null : checked(input, eventInput, actualInput, xid);
      if (!proof || proof.j.acceptance_kind !== "class_transition" || !proof.j.finalized || !proof.j.revision_transition_consumed || proof.event.phase !== "observed"
        || !same(proof.actual.parent, proof.event.observed_parent) || !same(proof.actual.order, proof.event.observed_order)) return reject("finalized_observed_event_required");
      const closure = base.finalizeForTest(proof.j, proof.actual, receipt, xid, phase);
      return { ...closure, trace: [phase === "deferred" ? "private.class_origin_revision_event_closure_v1" : "private.class_origin_finalize_transition_v1",
        "private.class_origin_assert_metadata_revision_v1", "private.class_origin_observed_revision_v1", ...closure.trace] };
    },
  };
}
