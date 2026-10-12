import { readFileSync } from "node:fs";
import { CLASS_CONFIRMATION_STAGE_PATH, type ClassConfirmationStageSources } from "@/lib/character/class-origin-confirmation-model";
import type { ClassConfirmationWorld } from "@/lib/character/class-origin-confirmation-schema";
import type { ClassOriginAcceptance, ClassOriginReceipt } from "@/lib/character/class-origin-command-schema";
import { classOriginBootstrapFixture } from "./class-origin-command";
import { classOriginJointFixture, classOriginJointSources } from "./class-origin-joint-revision";
import { roleId } from "./class-role-effects";

export function classConfirmationSources(): ClassConfirmationStageSources {
  return { ...classOriginJointSources(), confirmation: readFileSync(CLASS_CONFIRMATION_STAGE_PATH, "utf8") };
}
/** Original canonical data; private history is injection, NOT any native producer proof. */
export function classConfirmationFixture(mode: "level1" | "higher" | "multiclass" = "level1") {
  const prior = classOriginJointFixture(mode), current = structuredClone(prior.actualBefore), j = prior.acceptance;
  if (j.acceptance_kind !== "class_transition" || j.receipt.receipt_kind !== "class_transition" || j.receipt.canonical_intent.command !== "confirm_origin") throw Error("Original fixture required");
  current.origin = structuredClone(j.before_origin);
  const selectedId = j.receipt.canonical_intent.fields.selected_occurrence_id;
  current.occurrences = current.occurrences.map(o => o.id === selectedId ? structuredClone(j.transitions.find(t => t.relation_key === "occurrence")!.before_row!) : o);
  current.parent.action_revision = "5"; current.origin.command_revision = "3"; current.order.producer_revision = "5";
  const bootstrap = classOriginBootstrapFixture();
  if (bootstrap.acceptance_kind !== "bootstrap_new" || bootstrap.receipt.receipt_kind !== "bootstrap_new") throw Error("Original bootstrap required");
  bootstrap.acceptance_id = roleId(1100); bootstrap.transaction_id = "500";
  bootstrap.receipt.operation_id = String(current.origin.creation_operation_id);
  bootstrap.receipt.canonical_intent.operation_id = bootstrap.receipt.operation_id;
  bootstrap.receipt.accepted_at = "2026-10-12T00:00:00Z";
  bootstrap.expected_graph.origin.creation_operation_id = bootstrap.receipt.operation_id;
  bootstrap.preinsert_proof = { acceptance_id: bootstrap.acceptance_id, target_character_id: bootstrap.target_character_id, transaction_id: "500", captured_at: "2026-10-11T23:59:59.999999Z" };
  const creationRow = { verified_actor_id: bootstrap.verified_actor_id, operation_id: bootstrap.receipt.operation_id, target_character_id: bootstrap.target_character_id, receipt: structuredClone(bootstrap.receipt) };
  bootstrap.transitions = [{ relation_key: "origin", row_key: [bootstrap.target_character_id], before_row: null, after_row: structuredClone(bootstrap.expected_graph.origin), consumed: true },
    { relation_key: "creation_receipt", row_key: [bootstrap.verified_actor_id, bootstrap.receipt.operation_id], before_row: null, after_row: structuredClone(creationRow), consumed: true }];
  bootstrap.planned_transitions = bootstrap.transitions.map(({ consumed: _consumed, ...t }) => { void _consumed; return structuredClone(t); });
  const selected = current.occurrences.find(o => o.id === selectedId)!, selectionOp = roleId(1101), selectionTime = "2026-10-12T04:00:00Z";
  const selectionReceipt: ClassOriginReceipt = { receipt_version: 1, receipt_kind: "class_transition", operation_id: selectionOp, verified_actor_id: String(current.parent.user_id),
    target_character_id: String(current.parent.id), accepted_at: selectionTime,
    canonical_intent: { contract_version: 1, command: "add_class", character_id: String(current.parent.id), operation_id: selectionOp,
      expected_action_revision: "0", expected_class_revision: "0", fields: { content_id: String(selected.content_id), content_version: Number(selected.content_version), subclass: null } },
    before_action_revision: "0", after_action_revision: "1", before_class_revision: "0", after_class_revision: "1", confirmation: null };
  const addedGraph = structuredClone(current); addedGraph.parent.action_revision = "1"; addedGraph.origin.command_revision = "1"; addedGraph.order.producer_revision = "1";
  // One add_class command owns one original insertion. Other fixture classes are
  // later injected writers, not secretly emitted by this add_class receipt.
  addedGraph.occurrences = [structuredClone(selected)];
  addedGraph.refs = addedGraph.refs.filter(p => p.id === selected.controller_ref_id);
  addedGraph.versions = addedGraph.versions.filter(v => v.content_id === selected.content_id);
  addedGraph.order.pins = addedGraph.refs.map(p => String(p.id));
  addedGraph.parent.choices = { classes: [{ occurrence_id: selectedId, slug: selected.class_slug, level: 1 }], original_notes: ["last", "first"] }; addedGraph.parent.level = 1;
  const selectionRow = { character_id: String(current.parent.id), operation_id: selectionOp, receipt: selectionReceipt };
  const rows: ClassOriginAcceptance["transitions"] = [
    { relation_key: "occurrence", row_key: [selectedId], before_row: null, after_row: structuredClone(selected), consumed: true },
    { relation_key: "origin", row_key: [String(current.parent.id)], before_row: structuredClone(bootstrap.expected_graph.origin), after_row: structuredClone(addedGraph.origin), consumed: true },
    { relation_key: "class_receipt", row_key: [String(current.parent.id), selectionOp], before_row: null, after_row: structuredClone(selectionRow), consumed: true },
  ];
  const selection: ClassOriginAcceptance = { acceptance_kind: "class_transition", acceptance_id: roleId(1102), transaction_id: "501", verified_actor_id: String(current.parent.user_id),
    target_character_id: String(current.parent.id), finalized: true, revision_transition_consumed: true, before_parent: structuredClone(bootstrap.expected_graph.parent),
    before_origin: structuredClone(bootstrap.expected_graph.origin), expected_graph: addedGraph, receipt: selectionReceipt, transitions: rows,
    planned_transitions: rows.map(({ consumed: _consumed, ...row }) => { void _consumed; return structuredClone(row); }) };
  const context = { context_version: 1 as const, actor_id: String(current.parent.user_id), session_id: roleId(1103), jwt_expires_at: "2026-10-12T06:00:00.000000Z" };
  const sources = { system: { id: current.parent.system_id, slug: "dnd-5e-2014", status: "published" }, campaign: null, members: [], shares: [], versions: structuredClone(current.versions),
    definitions: current.versions.map(v => ({ id: v.content_id, system_id: v.system_id_snapshot, content_type: v.content_type_snapshot, slug: v.slug_snapshot,
      scope: v.scope_snapshot, owner_id: v.owner_id_snapshot, version: 2, is_retired: false, data: { description: "Original newer catalog text, never substituted." }, effects: [] })) };
  const world: ClassConfirmationWorld = { context_at_entry: context, context_after_wait: structuredClone(context), context_before_return: structuredClone(context), context_at_acceptance: structuredClone(context),
    after_wait_time: "2026-10-12T04:59:58Z", before_return_time: "2026-10-12T04:59:59Z", acceptance_time: "2026-10-12T05:00:00.123456Z", owned_parent: structuredClone(current.parent),
    stored_receipt: null, before_graph: current, history: { creation_row: creationRow, bootstrap, selection, selection_receipt_row: structuredClone(selectionRow) },
    sources_before_wait: structuredClone(sources), sources_after_wait: sources, acceptance_id: roleId(1104), transaction_id: "900" };
  const intent = { ...structuredClone(j.receipt.canonical_intent), expected_action_revision: "5", expected_class_revision: "3" };
  return { intent, world };
}

export function classConfirmationSubclassFixture() {
  const fixture = classConfirmationFixture("higher"), graph = fixture.world.before_graph!, actor = fixture.world.context_at_entry.actor_id;
  const ref = roleId(1220), content = roleId(1221), slug = "original-lantern-watch", primary = graph.occurrences[0];
  primary.subclass_ref_id = ref;
  (graph.parent.choices as { classes: { subclass?: string }[] }).classes[0].subclass = slug;
  fixture.world.owned_parent = structuredClone(graph.parent);
  graph.refs.push({ id: ref, character_id: graph.parent.id, content_id: content, content_version: 1,
    context: { source: "subclass", class: primary.class_slug }, choice_source: null, feature_grant_id: null });
  graph.order.pins.push(ref);
  graph.versions.push({ content_id: content, version: 1, system_id_snapshot: graph.parent.system_id, content_type_snapshot: "subclass", slug_snapshot: slug,
    name_snapshot: "Original lantern watch", data_snapshot: { parent_class: primary.class_slug, flavor_label: "Watch", description: "Original test association.",
      levels: [{ level: 3, features: [], spellcasting: null }], spells: [] }, effects_snapshot: [], source_snapshot: "homebrew", scope_snapshot: "personal", owner_id_snapshot: actor,
    created_at: "2026-10-12T03:00:00Z" });
  for (const sources of [fixture.world.sources_before_wait!, fixture.world.sources_after_wait!]) {
    sources.versions = structuredClone(graph.versions); sources.definitions.push({ id: content, system_id: graph.parent.system_id, content_type: "subclass", slug,
      scope: "personal", owner_id: actor, version: 1, is_retired: false });
  }
  return fixture;
}
