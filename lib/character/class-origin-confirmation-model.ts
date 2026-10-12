import { createClassOriginStageModel } from "./class-origin-command-model";
import { createClassOriginJointRevisionModel, type ClassOriginJointSources } from "./class-origin-joint-revision-model";
import { classOriginAcceptanceSchema, classOriginInstantMicros, type ClassOriginAcceptance, type ClassOriginGraph } from "./class-origin-command-schema";
import { sameClassOriginRevision as same } from "./class-origin-revision-event-schema";
import { parseClassConfirmationIntent, parseClassConfirmationWorld, classConfirmationModelResultSchema, type ClassConfirmationWorld } from "./class-origin-confirmation-schema";

export const CLASS_CONFIRMATION_STAGE_PATH = "supabase/staged/class-origin-confirmation-producer.sql";
export type ClassConfirmationStageSources = ClassOriginJointSources & { confirmation: string };
function body(source: string, name: string) {
  const start = source.indexOf(`CREATE FUNCTION private.${name}(`), opening = source.indexOf("AS $$", start), end = source.indexOf("$$;", opening + 5);
  if (start < 0 || opening < start || end < opening) throw Error(`Actual confirmation source absent: ${name}`);
  return source.slice(start, end + 3);
}
const tracePrefix = ["private.require_class_origin_auth_v1", "private.lock_character_writer_guard_v1", "public.characters FOR UPDATE", "private.require_class_origin_auth_v1", "private.character_class_commands_v1 receipt lookup"];
const refused = (reason: string, trace = tracePrefix) => ({ status: "model_refused" as const, reason, trace });
function contextMatches(world: ClassConfirmationWorld, phase: "context_after_wait" | "context_before_return" | "context_at_acceptance", time: string) {
  const original = world.context_at_entry, current = world[phase], expiry = classOriginInstantMicros(current.jwt_expires_at), now = classOriginInstantMicros(time);
  return same(current, original) && current.actor_id === world.owned_parent.user_id && expiry !== null && now !== null && expiry > now;
}
function historicalRows(j: ClassOriginAcceptance) {
  const keys = j.transitions.map(row => JSON.stringify([row.relation_key, row.row_key]));
  const plannedKeys = j.planned_transitions.map(row => JSON.stringify([row.relation_key, row.row_key]));
  return j.finalized && new Set(keys).size === keys.length && new Set(plannedKeys).size === plannedKeys.length
    && j.transitions.length === j.planned_transitions.length && j.transitions.every(row => row.consumed
    && j.planned_transitions.some(plan => same(plan, { relation_key: row.relation_key, row_key: row.row_key, before_row: row.before_row, after_row: row.after_row })));
}
function historyReason(world: ClassConfirmationWorld, graph: ClassOriginGraph, selectedId: string): string | null {
  const history = world.history; if (!history) return "creation_history_unavailable";
  const { bootstrap: b, selection: s, creation_row: row } = history, initial = b.expected_graph, origin = graph.origin, parent = graph.parent, receipt = row.receipt;
  if (origin.origin_status !== "draft" || origin.creation_provenance !== "new_character" || !origin.creation_operation_id
    || origin.role_proof !== null || origin.origin_occurrence_id !== null || origin.source_draft_operation_id !== null) return "draft_provenance_unavailable";
  if (receipt.receipt_kind !== "bootstrap_new" || receipt.canonical_intent.command !== "create_character" || b.acceptance_kind !== "bootstrap_new"
    || receipt.verified_actor_id !== parent.user_id || row.verified_actor_id !== parent.user_id || b.verified_actor_id !== parent.user_id
    || receipt.target_character_id !== parent.id || row.target_character_id !== parent.id || b.target_character_id !== parent.id
    || row.operation_id !== receipt.operation_id || receipt.operation_id !== origin.creation_operation_id || !same(b.receipt, receipt)
    || receipt.canonical_intent.fields.system_id !== parent.system_id || !historicalRows(b)
    || b.preinsert_proof.acceptance_id !== b.acceptance_id || b.preinsert_proof.target_character_id !== parent.id || b.preinsert_proof.transaction_id !== b.transaction_id
    || classOriginInstantMicros(b.preinsert_proof.captured_at) === null
    || classOriginInstantMicros(b.preinsert_proof.captured_at)! > classOriginInstantMicros(receipt.accepted_at)!
    || initial.parent.id !== parent.id || initial.parent.user_id !== parent.user_id || initial.parent.system_id !== parent.system_id
    || initial.parent.action_revision !== "0" || initial.origin.command_revision !== "0" || initial.order.producer_revision !== "0"
    || !same((initial.parent.choices as { classes?: unknown })?.classes, []) || initial.parent.name !== receipt.canonical_intent.fields.name
    || initial.parent.campaign_id !== receipt.canonical_intent.fields.campaign_id
    || !same({ ...initial.origin, command_revision: origin.command_revision }, origin)
    || b.transitions.length !== 2 || [initial.occurrences, initial.refs, initial.inventory, initial.spells, initial.feature_grants, initial.spell_grants, initial.versions].some(rows => rows.length)) return "bootstrap_correspondence_mismatch";
  if (!b.transitions.some(t => t.relation_key === "origin" && same(t.row_key, [parent.id]) && t.before_row === null && same(t.after_row, initial.origin))
    || !b.transitions.some(t => t.relation_key === "creation_receipt" && same(t.row_key, [parent.user_id, row.operation_id]) && t.before_row === null && same(t.after_row, row))) return "bootstrap_insert_proof_mismatch";
  const selected = graph.occurrences.find(o => o.id === selectedId), inserts = s.transitions.filter(t => t.relation_key === "occurrence" && same(t.row_key, [selectedId]) && t.before_row === null);
  const inserted = inserts[0]?.after_row, r = s.receipt;
  if (!selected || inserts.length !== 1 || !inserted || s.acceptance_kind !== "class_transition" || !s.revision_transition_consumed || !historicalRows(s)
    || r.receipt_kind !== "class_transition" || r.canonical_intent.command !== "add_class" || s.target_character_id !== parent.id || s.verified_actor_id !== parent.user_id
    || r.target_character_id !== parent.id || r.verified_actor_id !== parent.user_id || r.canonical_intent.character_id !== parent.id
    || history.selection_receipt_row.character_id !== parent.id || history.selection_receipt_row.operation_id !== r.operation_id || !same(history.selection_receipt_row.receipt, r)
    || r.canonical_intent.fields.content_id !== selected.content_id || r.canonical_intent.fields.content_version !== selected.content_version
    || s.before_parent.id !== parent.id || s.before_parent.user_id !== parent.user_id || s.before_parent.system_id !== parent.system_id
    || s.expected_graph.parent.id !== parent.id || s.expected_graph.parent.user_id !== parent.user_id || s.expected_graph.parent.system_id !== parent.system_id
    || r.before_action_revision !== s.before_parent.action_revision || r.before_class_revision !== s.before_origin.command_revision
    || r.after_action_revision !== s.expected_graph.parent.action_revision || r.after_class_revision !== s.expected_graph.origin.command_revision
    || !s.expected_graph.occurrences.some(o => same(o, inserted))
    || [selected, inserted].some(o => o.lifecycle !== "provisional" || o.accepted_at !== null || o.acquired_character_level !== null || o.acquisition_operation_id !== null || o.ended_at !== null)
    || ["id", "character_id", "system_id", "content_id", "content_version", "class_slug", "selected_at", "controller_ref_id"].some(key => !same(selected[key], inserted[key]))) return "selection_insert_correspondence_mismatch";
  return null;
}
function sourceReason(world: ClassConfirmationWorld, graph: ClassOriginGraph, selectedId: string): string | null {
  const sources = world.sources_after_wait;
  if (!sources || !world.sources_before_wait) return "source_graph_unavailable";
  if (!same(sources.versions, graph.versions)) return "locked_versions_changed";
  if (sources.system.id !== graph.parent.system_id || sources.system.slug !== "dnd-5e-2014" || sources.system.status !== "published") return "published_system_unavailable";
  if (graph.parent.campaign_id !== null && (!sources.campaign || sources.campaign.id !== graph.parent.campaign_id || sources.campaign.system_id !== graph.parent.system_id)) return "campaign_system_mismatch";
  if (new Set(sources.definitions.map(d => d.id)).size !== sources.definitions.length || sources.definitions.length !== new Set(graph.versions.map(v => v.content_id)).size) return "current_source_identity_unavailable";
  for (const version of graph.versions) {
    const d = sources.definitions.find(d => d.id === version.content_id);
    if (!d || d.system_id !== graph.parent.system_id || version.system_id_snapshot !== graph.parent.system_id
      || d.content_type !== version.content_type_snapshot || d.slug !== version.slug_snapshot) return "retained_version_identity_mismatch";
  }
  const selected = graph.occurrences.find(o => o.id === selectedId); if (!selected) return "selected_occurrence_unavailable";
  const actor = world.context_after_wait.actor_id, campaign = sources.campaign;
  const member = campaign?.owner_id === actor || sources.members.some(m => m.campaign_id === graph.parent.campaign_id && m.user_id === actor);
  const permitted = (scope: unknown, owner: unknown, id: unknown) => scope === "platform" || owner === actor
    || scope === "shared" && !!campaign && member && sources.shares.some(s => s.campaign_id === graph.parent.campaign_id && s.content_id === id);
  for (const id of [selected.controller_ref_id, selected.subclass_ref_id].filter(id => id !== null)) {
    const pin = graph.refs.find(p => p.id === id), v = pin && graph.versions.find(v => v.content_id === pin.content_id && v.version === pin.content_version), d = pin && sources.definitions.find(d => d.id === pin.content_id);
    if (!pin || !v || !d) return "selected_pin_unavailable";
    if (d.is_retired !== false || !permitted(d.scope, d.owner_id, d.id) || !permitted(v.scope_snapshot, v.owner_id_snapshot, v.content_id)) return "confirmation_acquisition_unavailable";
  }
  return null;
}

/** Trace/reference for actual staged bodies; never SQL execution or native Auth. */
export function createClassConfirmationProducerModel(sources: ClassConfirmationStageSources) {
  const stage = sources.confirmation.replace(/\r\n/g, "\n"), entry = body(stage, "confirm_already_first_class_origin_v1");
  const required: Record<string, string[]> = {
    confirm_already_first_class_origin_v1: ["require_class_origin_auth_v1", "SELECT receipt INTO previous", "native_auth_expired", "RETURN pg_catalog.jsonb_build_object('status','replayed'", "locked_versions_changed", "new_acceptance:=pg_catalog.gen_random_uuid()", "pg_catalog.pg_current_xact_id()", "GET DIAGNOSTICS changed=ROW_COUNT", "private.class_origin_finalize_acceptance_v1(new_acceptance)"],
    class_confirmation_private_inputs_v1: ["FOR SHARE OF t", "historical_consumption_mismatch", "creation_history_unavailable", "selection_receipt_unavailable", "UNION SELECT content_id,content_version FROM private.character_class_occurrences_v1"],
    lock_class_confirmation_sources_v1: ["require_verified_hit_die_auth_v1", "ORDER BY d.id FOR SHARE", "ORDER BY v.content_id,v.version FOR SHARE OF v", "ORDER BY id FOR SHARE", "retained_sources_changed_after_wait", "version.scope_snapshot", "definition.scope", "NOT definition.is_retired"],
    validate_class_confirmation_before_v1: ["bootstrap_correspondence_mismatch", "bootstrap_insert_proof_mismatch", "already_first_selection_required", "selection_insert_correspondence_mismatch", "data_snapshot,parent_class", "reverse_class_graph_mismatch"],
  };
  for (const [name, checks] of Object.entries(required)) if (checks.some(check => !body(stage, name).includes(check))) throw Error(`Actual producer critical path changed: ${name}`);
  if (entry.indexOf("'status','replayed'") > entry.indexOf("sources:=private.lock_class_confirmation_sources_v1") || /UPDATE public\.characters/.test(entry)) throw Error("Receipt-first/sole-joint-bump source contract changed");
  const joint = createClassOriginJointRevisionModel(sources), base = createClassOriginStageModel(sources.p1a);
  return {
    traceEntryForTest: () => ({ status: "model_refused" as const, reason: "auth_unavailable", trace: ["private.confirm_already_first_class_origin_v1", "private.require_class_origin_auth_v1"] }),
    deriveForTest(intentInput: unknown, worldInput: unknown) {
      const intent = parseClassConfirmationIntent(intentInput), world = parseClassConfirmationWorld(worldInput);
      if (!intent || !world) return refused("strict_confirmation_request_or_evidence_required");
      if (world.owned_parent.id !== intent.character_id || !contextMatches(world, "context_after_wait", world.after_wait_time)) return refused("native_auth_expired_or_current_owner");
      if (world.stored_receipt) {
        if (!same(world.stored_receipt.canonical_intent, intent)) return refused("operation_intent_conflict");
        if (world.stored_receipt.target_character_id !== intent.character_id || !contextMatches(world, "context_before_return", world.before_return_time)) return refused("native_auth_expired_or_current_owner");
        return classConfirmationModelResultSchema.parse({ status: "model_checked", mode: "replayed", receipt: structuredClone(world.stored_receipt), trace: [...tracePrefix, "private.require_class_origin_auth_v1", "native pre-return expiry", "return immutable receipt"] });
      }
      const graph = world.before_graph; if (!graph || !same(graph.parent, world.owned_parent)) return refused("actual_before_graph_required");
      const reason = historyReason(world, graph, intent.fields.selected_occurrence_id) ?? sourceReason(world, graph, intent.fields.selected_occurrence_id);
      if (reason) return refused(reason);
      const choices = (graph.parent.choices as { classes?: { occurrence_id?: string }[] })?.classes;
      if (choices?.[0]?.occurrence_id !== intent.fields.selected_occurrence_id) return refused("already_first_selection_required");
      if (graph.parent.action_revision !== intent.expected_action_revision || graph.origin.command_revision !== intent.expected_class_revision) return refused("stale_confirmation_revision");
      if ([intent.expected_action_revision, intent.expected_class_revision].includes("9223372036854775807")) return refused("confirmation_revision_exhausted");
      if (!contextMatches(world, "context_at_acceptance", world.acceptance_time)) return refused("native_acceptance_expired_or_future_selection");
      const afterShared = (BigInt(intent.expected_action_revision) + BigInt(1)).toString(), afterClass = (BigInt(intent.expected_class_revision) + BigInt(1)).toString();
      const before = graph.occurrences.find(o => o.id === intent.fields.selected_occurrence_id)!;
      if (classOriginInstantMicros(before.selected_at)! > classOriginInstantMicros(world.acceptance_time)!) return refused("native_acceptance_expired_or_future_selection");
      const confirmation = { canonical_intent: { contract_version: 1 as const, command: "confirm_origin" as const, character_id: intent.character_id, operation_id: intent.operation_id,
        expected_revision: intent.expected_class_revision, selected_occurrence_id: intent.fields.selected_occurrence_id }, applied_revision: afterClass, accepted_at: world.acceptance_time };
      const receipt = { receipt_version: 1 as const, receipt_kind: "class_transition" as const, operation_id: intent.operation_id, verified_actor_id: world.context_after_wait.actor_id,
        target_character_id: intent.character_id, accepted_at: world.acceptance_time, canonical_intent: intent, before_action_revision: intent.expected_action_revision,
        after_action_revision: afterShared, before_class_revision: intent.expected_class_revision, after_class_revision: afterClass, confirmation };
      const after = { ...structuredClone(before), lifecycle: "accepted", acquired_character_level: 1, acquisition_operation_id: intent.operation_id, accepted_at: world.acceptance_time };
      const afterOrigin = { ...structuredClone(graph.origin), command_revision: afterClass, origin_status: "recorded", origin_occurrence_id: before.id, role_proof: { kind: "confirmation", receipt: confirmation } };
      const expected: ClassOriginGraph = { ...structuredClone(graph), parent: { ...structuredClone(graph.parent), action_revision: afterShared }, origin: afterOrigin,
        order: { ...structuredClone(graph.order), producer_revision: afterShared }, occurrences: graph.occurrences.map(o => o.id === before.id ? after : structuredClone(o)) };
      const planned = [{ relation_key: "occurrence" as const, row_key: [String(before.id)], before_row: structuredClone(before), after_row: after },
        { relation_key: "origin" as const, row_key: [intent.character_id], before_row: structuredClone(graph.origin), after_row: afterOrigin },
        { relation_key: "class_receipt" as const, row_key: [intent.character_id, intent.operation_id], before_row: null, after_row: { character_id: intent.character_id, operation_id: intent.operation_id, receipt } }];
      const pending = classOriginAcceptanceSchema.parse({ acceptance_kind: "class_transition", acceptance_id: world.acceptance_id, transaction_id: world.transaction_id,
        verified_actor_id: world.context_after_wait.actor_id, target_character_id: intent.character_id, finalized: false, revision_transition_consumed: false,
        before_parent: structuredClone(graph.parent), before_origin: structuredClone(graph.origin), expected_graph: expected, receipt,
        planned_transitions: planned, transitions: planned.map(p => ({ ...structuredClone(p), consumed: false })) });
      const occurrenceWritten = base.consumeRowForTest(pending, world.transaction_id, "occurrence", [String(before.id)], before, after);
      if (!occurrenceWritten) return refused("protected_occurrence_row_mismatch");
      const j = base.consumeRowForTest(occurrenceWritten, world.transaction_id, "origin", [intent.character_id], graph.origin, afterOrigin);
      if (!j) return refused("protected_origin_row_mismatch");
      const metadataActual = { ...structuredClone(expected), parent: structuredClone(graph.parent), order: structuredClone(graph.order) };
      const emitted = joint.emitForTest(j, metadataActual, world.transaction_id); if (emitted.status !== "model_checked") return refused(emitted.reason, emitted.trace);
      const assigned = joint.assignForTest(j, emitted.event, metadataActual, expected.parent, world.transaction_id); if (assigned.status !== "model_checked") return refused(assigned.reason, assigned.trace);
      const observed = joint.observeForTest(j, assigned.event, expected, expected.parent, world.transaction_id); if (observed.status !== "model_checked") return refused(observed.reason, observed.trace);
      const consumed = joint.consumeForTest(j, observed.event, expected, world.transaction_id); if (consumed.status !== "model_checked") return refused(consumed.reason, consumed.trace);
      const receiptWritten = base.consumeRowForTest(consumed.acceptance, world.transaction_id, "class_receipt", [intent.character_id, intent.operation_id], null,
        { character_id: intent.character_id, operation_id: intent.operation_id, receipt });
      if (!receiptWritten) return refused("protected_receipt_row_mismatch");
      const finalized = { ...receiptWritten, finalized: true };
      // Full base common closure covers reverse classes, exact domains/versions/proofs.
      const closure = base.finalizeForTest(finalized, expected, receipt, world.transaction_id, "immediate");
      if (closure.status !== "model_checked") return refused(closure.reason, closure.trace);
      const deferred = joint.finalizeForTest(finalized, observed.event, expected, receipt, world.transaction_id, "deferred");
      if (deferred.status !== "model_checked") return refused(deferred.reason, deferred.trace);
      return classConfirmationModelResultSchema.parse({ status: "model_checked", mode: "applied", receipt, acceptance: finalized, event: observed.event, graph: expected,
        trace: [...tracePrefix, "private.class_confirmation_private_inputs_v1", "private.lock_class_confirmation_sources_v1", "private.validate_class_confirmation_before_v1", "native acceptance",
          "private.class_origin_protected_row_guard_v1 occurrence→origin", ...emitted.trace, ...assigned.trace, ...observed.trace, ...consumed.trace,
          "private.class_origin_protected_row_guard_v1 class_receipt", ...closure.trace, ...deferred.trace] });
    },
  };
}
