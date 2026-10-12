import type { ClassOriginAcceptance, ClassOriginGraph, ClassOriginReceipt } from "@/lib/character/class-origin-command-schema";
import { classRoleFixture, roleId } from "./class-role-effects";

const time = "2026-10-12T05:00:00Z";
const target = roleId(800), actor = roleId(9), operation = roleId(810), acceptanceId = roleId(811), occurrenceId = roleId(820), refId = roleId(821);
function graph(): ClassOriginGraph {
  const root = classRoleFixture(), version = root.sources.find(pin => pin.resolved.slug === "lantern-keeper")!.resolved;
  return {
    parent: { id: target, user_id: actor, system_id: roleId(2), campaign_id: null, name: "Original workshop character", archived: false, action_revision: "1", level: 1,
      choices: { classes: [{ occurrence_id: occurrenceId, slug: "lantern-keeper", level: 1 }], original_notes: ["last", "first"] }, state: { current_hp: 7 } },
    origin: { character_id: target, schema_version: 1, system_id: roleId(2), command_revision: "1", origin_status: "recorded", origin_occurrence_id: occurrenceId,
      creation_provenance: "new_character", creation_operation_id: roleId(801), source_draft_operation_id: null, role_proof: null },
    occurrences: [{ id: occurrenceId, character_id: target, system_id: roleId(2), content_id: version.id, content_version: 1, class_slug: version.slug,
      lifecycle: "accepted", selected_at: "2026-10-12T04:00:00Z", acquired_character_level: 1, acquisition_operation_id: operation, accepted_at: time, ended_at: null,
      controller_ref_id: refId, subclass_ref_id: null }],
    refs: [{ id: refId, character_id: target, content_id: version.id, content_version: 1, context: { source: "class", original_order: [2, 1] }, choice_source: null, feature_grant_id: null }],
    versions: [{ content_id: version.id, version: 1, system_id_snapshot: roleId(2), content_type_snapshot: "class", slug_snapshot: version.slug,
      name_snapshot: "Original workshop class", data_snapshot: version.data, effects_snapshot: version.effects, source_snapshot: "homebrew", scope_snapshot: "personal", owner_id_snapshot: actor,
      created_at: "2026-10-12T03:00:00Z" }],
    inventory: [], spells: [], feature_grants: [], spell_grants: [],
    order: { character_id: target, producer_version: 1, producer_revision: "1", pins: [refId], inventory: [], spells: [], feature_grants: [], spell_grants: [] },
  };
}
function plan(rows: ClassOriginAcceptance["transitions"]) {
  return rows.map(row => ({ relation_key: row.relation_key, row_key: row.row_key, before_row: structuredClone(row.before_row), after_row: structuredClone(row.after_row) }));
}
export function classOriginTransitionFixture(): ClassOriginAcceptance {
  const after = graph(), beforeParent = structuredClone(after.parent), beforeOrigin = structuredClone(after.origin);
  beforeParent.action_revision = "0"; beforeOrigin.command_revision = "0"; beforeOrigin.origin_status = "draft"; beforeOrigin.origin_occurrence_id = null;
  const receipt: ClassOriginReceipt = {
    receipt_version: 1, receipt_kind: "class_transition", operation_id: operation, verified_actor_id: actor, target_character_id: target, accepted_at: time,
    canonical_intent: { contract_version: 1, command: "confirm_origin", character_id: target, operation_id: operation,
      expected_action_revision: "0", expected_class_revision: "0", fields: { selected_occurrence_id: occurrenceId } },
    before_action_revision: "0", after_action_revision: "1", before_class_revision: "0", after_class_revision: "1",
    confirmation: { canonical_intent: { contract_version: 1, command: "confirm_origin", character_id: target, operation_id: operation,
      expected_revision: "0", selected_occurrence_id: occurrenceId }, applied_revision: "1", accepted_at: time },
  };
  after.origin.role_proof = { kind: "confirmation", receipt: structuredClone(receipt.confirmation) };
  const beforeOccurrence = { ...after.occurrences[0], lifecycle: "provisional", acquired_character_level: null, acquisition_operation_id: null, accepted_at: null };
  const transitions: ClassOriginAcceptance["transitions"] = [
    { relation_key: "origin", row_key: [target], before_row: beforeOrigin, after_row: structuredClone(after.origin), consumed: true },
    { relation_key: "occurrence", row_key: [occurrenceId], before_row: beforeOccurrence, after_row: structuredClone(after.occurrences[0]), consumed: true },
    { relation_key: "class_receipt", row_key: [target, operation], before_row: null, after_row: { character_id: target, operation_id: operation, receipt: structuredClone(receipt) }, consumed: true },
  ];
  return { acceptance_kind: "class_transition", acceptance_id: acceptanceId, transaction_id: "900", verified_actor_id: actor, target_character_id: target,
    finalized: true, revision_transition_consumed: true, before_parent: beforeParent, before_origin: beforeOrigin, expected_graph: after, receipt,
    transitions, planned_transitions: plan(transitions) };
}
export function classOriginBootstrapFixture(): ClassOriginAcceptance {
  const after = graph(); after.parent.action_revision = "0"; after.parent.choices = { classes: [] }; after.origin.command_revision = "0";
  after.origin.origin_status = "draft"; after.origin.origin_occurrence_id = null; after.origin.role_proof = null;
  after.origin.creation_operation_id = operation; after.order.producer_revision = "0"; after.order.pins = [];
  after.refs = []; after.occurrences = []; after.versions = [];
  const receipt: ClassOriginReceipt = { receipt_version: 1, receipt_kind: "bootstrap_new", operation_id: operation, verified_actor_id: actor,
    target_character_id: target, accepted_at: time, canonical_intent: { contract_version: 1, command: "create_character", operation_id: operation,
      fields: { name: "Original workshop character", system_id: roleId(2), campaign_id: null } },
    initial_action_revision: "0", initial_class_revision: "0", initial_producer_revision: "0", copy_lineage: null };
  const transitions: ClassOriginAcceptance["transitions"] = [
    { relation_key: "origin", row_key: [target], before_row: null, after_row: structuredClone(after.origin), consumed: true },
    { relation_key: "creation_receipt", row_key: [actor, operation], before_row: null, after_row: { verified_actor_id: actor, operation_id: operation, target_character_id: target, receipt: structuredClone(receipt) }, consumed: true },
  ];
  return { acceptance_kind: "bootstrap_new", acceptance_id: acceptanceId, transaction_id: "900", verified_actor_id: actor, target_character_id: target,
    finalized: true, preinsert_proof: { acceptance_id: acceptanceId, target_character_id: target, transaction_id: "900", captured_at: "2026-10-12T04:59:00Z" },
    expected_graph: after, receipt, transitions, planned_transitions: plan(transitions) };
}
export function classOriginCopiedFixture(ended = false): ClassOriginAcceptance {
  const fixture = classOriginBootstrapFixture(), root = classRoleFixture(), proof = root.origin!.role_proof!;
  if (proof.kind !== "confirmation" || fixture.acceptance_kind !== "bootstrap_new") throw Error("Original direct fixtures required");
  const sourceCharacter = roleId(850), sourceOccurrence = roleId(851), copyOperation = roleId(852);
  const after = graph(); after.parent.action_revision = "0"; after.origin.command_revision = "0"; after.order.producer_revision = "0";
  after.parent.name = "Original second copy";
  after.origin.creation_provenance = "confirmed_copy"; after.origin.creation_operation_id = operation;
  const endedAt = ended ? "2026-10-12T04:30:00Z" : null;
  after.occurrences[0].lifecycle = ended ? "ended" : "accepted"; after.occurrences[0].ended_at = endedAt;
  after.occurrences[0].selected_at = root.occurrences[0].selected_at;
  after.occurrences[0].accepted_at = root.occurrences[0].accepted_at;
  after.occurrences[0].acquisition_operation_id = root.occurrences[0].acquisition_operation_id;
  if (ended) { after.parent.choices = { classes: [] }; after.refs = []; after.order.pins = []; after.occurrences[0].controller_ref_id = null; }
  const receipt: ClassOriginReceipt = { receipt_version: 1, receipt_kind: "bootstrap_copy", operation_id: operation, verified_actor_id: actor, target_character_id: target,
    accepted_at: time, initial_action_revision: "0", initial_class_revision: "0", initial_producer_revision: "0",
    canonical_intent: { contract_version: 1, command: "copy_character", operation_id: operation,
      fields: { name: "Original second copy", campaign_id: null, source_character_id: sourceCharacter, expected_source_action_revision: "55", expected_source_class_revision: "12" } },
    copy_lineage: { lineage_version: 1, copy_kind: "recorded", root_anchor: { root_confirmation: structuredClone(proof.receipt), root_occurrence_at_confirmation: structuredClone(root.occurrences[0]) },
      immediate_source: { source_character_id: sourceCharacter, source_origin_occurrence_id: sourceOccurrence, creation_operation_id: copyOperation,
        action_revision: "55", class_revision: "12", origin_status: "recorded", lifecycle: ended ? "ended" : "accepted", ended_at: endedAt, raw_provenance: { original_order: [2, 1] } },
      source_copy_receipt_identity: { operation_id: copyOperation, target_character_id: sourceCharacter, root_character_id: root.character.id, root_occurrence_id: root.occurrences[0].id },
      occurrence_map: [{ source_id: sourceOccurrence, target_id: occurrenceId }], ref_map: ended ? [] : [{ source_id: roleId(853), target_id: refId }] },
  };
  after.origin.role_proof = { kind: "copy_lineage", lineage_version: 1, lineage: structuredClone(receipt.copy_lineage) };
  const transitions: ClassOriginAcceptance["transitions"] = [
    { relation_key: "origin", row_key: [target], before_row: null, after_row: structuredClone(after.origin), consumed: true },
    { relation_key: "occurrence", row_key: [occurrenceId], before_row: null, after_row: structuredClone(after.occurrences[0]), consumed: true },
    { relation_key: "creation_receipt", row_key: [actor, operation], before_row: null, after_row: { verified_actor_id: actor, operation_id: operation, target_character_id: target, receipt: structuredClone(receipt) }, consumed: true },
  ];
  return { ...fixture, acceptance_kind: "bootstrap_copy", expected_graph: after, receipt, transitions, planned_transitions: plan(transitions) };
}

/** Rebuild protected expected row proofs after a deliberate synthetic mutation. */
export function refreshClassOriginFixtureProofs(fixture: ClassOriginAcceptance): void {
  for (const transition of fixture.transitions) {
    if (transition.relation_key === "origin") transition.after_row = structuredClone(fixture.expected_graph.origin);
    if (transition.relation_key === "occurrence") {
      const occurrence = fixture.expected_graph.occurrences.find(row => row.id === transition.row_key[0]);
      if (occurrence) transition.after_row = structuredClone(occurrence);
    }
    if (transition.relation_key === "class_receipt" && transition.after_row) transition.after_row.receipt = structuredClone(fixture.receipt);
    if (transition.relation_key === "creation_receipt" && transition.after_row) transition.after_row.receipt = structuredClone(fixture.receipt);
  }
  fixture.planned_transitions = plan(fixture.transitions);
}

export function classOriginCanonicalSubclassFixture(): ClassOriginAcceptance {
  const fixture = classOriginCopiedFixture();
  if (fixture.receipt.receipt_kind !== "bootstrap_copy") throw Error("Copy fixture required");
  const subRef = roleId(930), subContent = roleId(931), graph = fixture.expected_graph;
  graph.parent.level = 3;
  const choice = (graph.parent.choices as { classes: { level: number; subclass?: string }[] }).classes[0];
  choice.level = 3; choice.subclass = "original-lantern-watch";
  graph.occurrences[0].subclass_ref_id = subRef;
  graph.refs.push({ id: subRef, character_id: graph.parent.id, content_id: subContent, content_version: 1,
    context: { source: "subclass", class: "lantern-keeper" }, choice_source: null, feature_grant_id: null });
  graph.order.pins.push(subRef);
  graph.versions.push({ content_id: subContent, version: 1, system_id_snapshot: graph.parent.system_id, content_type_snapshot: "subclass",
    slug_snapshot: choice.subclass, name_snapshot: "Original lantern watch", data_snapshot: { parent_class: "lantern-keeper", description: "Original test association.",
      flavor_label: "Watch", levels: [{ level: 3, features: [], spellcasting: null }], spells: [] }, effects_snapshot: [], source_snapshot: "homebrew", scope_snapshot: "personal",
    owner_id_snapshot: graph.parent.user_id, created_at: "2026-10-12T03:00:00Z" });
  fixture.receipt.copy_lineage.ref_map.push({ source_id: roleId(932), target_id: subRef });
  graph.origin.role_proof = { kind: "copy_lineage", lineage_version: 1, lineage: structuredClone(fixture.receipt.copy_lineage) };
  refreshClassOriginFixtureProofs(fixture); return fixture;
}
