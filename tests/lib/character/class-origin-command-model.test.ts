import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createClassOriginStageModel, CLASS_ORIGIN_STAGE_PATH } from "@/lib/character/class-origin-command-model";
import { classOriginAcceptanceSchema, classOriginReceiptSchema, parseClassOriginRequest } from "@/lib/character/class-origin-command-schema";
import { classOriginBootstrapFixture, classOriginCopiedFixture, classOriginTransitionFixture, classOriginCanonicalSubclassFixture, refreshClassOriginFixtureProofs } from "@/tests/fixtures/class-origin-command";
import { classDataSchema } from "@/lib/schemas/content-types/class";
import { subclassDataSchema } from "@/lib/schemas/content-types/subclass";
import { roleId } from "@/tests/fixtures/class-role-effects";

const sql = readFileSync(CLASS_ORIGIN_STAGE_PATH, "utf8"), model = createClassOriginStageModel(sql);
function finalize(fixture = classOriginTransitionFixture(), phase: "immediate" | "deferred" = "immediate") {
  return model.finalizeForTest(fixture, fixture.expected_graph, fixture.receipt, "900", phase);
}
describe("P1a actual staged-source-bound reference checks, no SQL/Auth/runtime acceptance", () => {
  it("refuses a model detached from the actual SQL entry, Auth seam or deferred dispatch", () => {
    for (const name of ["begin_class_origin_acceptance_v1", "require_class_origin_auth_v1", "class_origin_finalize_bootstrap_v1", "class_origin_deferred_finalizer_v1"]) {
      expect(() => createClassOriginStageModel(sql.replace(`CREATE FUNCTION private.${name}(`, `CREATE FUNCTION private.removed_${name}(`))).toThrow();
    }
    expect(() => createClassOriginStageModel(sql.replace("RAISE EXCEPTION 'auth_unavailable'", "RETURN"))).toThrow();
    expect(() => createClassOriginStageModel(sql.replace("CREATE CONSTRAINT TRIGGER class_origin_acceptance_closure", "-- removed closure"))).toThrow();
    for (const check of ["before_shared+1", "match_count<>1", "required_count<>resolved_count", "graph IS DISTINCT FROM j.expected_graph"]) {
      expect(() => createClassOriginStageModel(sql.replace(check, "removed_check"))).toThrow();
    }
  });
  it.each([null, {}, { actor_id: roleId(9), writers_complete: true }, { role: "service_role", current_user: "inkborne_class_origin_owner", marker: "on" }])(
    "cannot turn a supplied context into a positive stage entry: %j", context => {
      expect(model.traceEntryForTest(context, classOriginTransitionFixture().receipt.canonical_intent)).toEqual({ status: "unready", reason: "auth_unavailable",
        trace: ["private.begin_class_origin_acceptance_v1", "private.require_class_origin_auth_v1"] });
    });
  it("uses an original schema-valid class fixture and preserves raw extension/effect order", () => {
    const fixture = classOriginTransitionFixture(), before = structuredClone(fixture);
    expect(classDataSchema.safeParse(fixture.expected_graph.versions[0].data_snapshot).success).toBe(true);
    expect(finalize(fixture).status).toBe("model_checked"); expect(fixture).toEqual(before);
    expect(finalize(fixture).trace).toContain("private.class_origin_finalize_transition_v1");
  });
  it.each(["immediate", "deferred"] as const)("checks metadata-only confirmation through actual %s finalizer path", phase => {
    const fixture = classOriginTransitionFixture(); if (fixture.acceptance_kind !== "class_transition") throw Error("Transition fixture");
    const before = { ...fixture.before_parent }, after = { ...fixture.expected_graph.parent };
    delete before.action_revision; delete after.action_revision; expect(after).toEqual(before);
    expect(finalize(fixture, phase).status).toBe("model_checked");
  });
  it.each([1, 7])("already-first only-class level %s has one modeled bump, not a manufactured order delta", level => {
    const fixture = classOriginTransitionFixture(); if (fixture.acceptance_kind !== "class_transition") throw Error("Transition fixture");
    fixture.before_parent.level = level; fixture.expected_graph.parent.level = level;
    (fixture.before_parent.choices as { classes: { level: number }[] }).classes[0].level = level;
    (fixture.expected_graph.parent.choices as { classes: { level: number }[] }).classes[0].level = level;
    expect(finalize(fixture).status).toBe("model_checked");
  });
  it.each([classOriginBootstrapFixture, () => classOriginCopiedFixture(false), () => classOriginCopiedFixture(true)])("uses distinct initial-zero bootstrap dispatch with injected protected preinsert evidence", fixtureFactory => {
    const fixture = fixtureFactory(); expect(finalize(fixture).status).toBe("model_checked");
    expect(finalize(fixture, "deferred").status).toBe("model_checked");
    expect(finalize(fixture).trace).toContain("private.class_origin_finalize_bootstrap_v1");
    expect(fixture.expected_graph.parent.action_revision).toBe("0"); expect(fixture.expected_graph.origin.command_revision).toBe("0");
  });
  it("rejects invented before state/counters in bootstrap or initial fields in transition", () => {
    const bootstrap = classOriginBootstrapFixture(), transition = classOriginTransitionFixture();
    expect(classOriginAcceptanceSchema.safeParse({ ...bootstrap, before_parent: {} }).success).toBe(false);
    expect(classOriginReceiptSchema.safeParse({ ...bootstrap.receipt, before_action_revision: "0" }).success).toBe(false);
    expect(classOriginReceiptSchema.safeParse({ ...transition.receipt, initial_action_revision: "0" }).success).toBe(false);
    expect(classOriginReceiptSchema.safeParse({ ...bootstrap.receipt, initial_action_revision: "55" }).success).toBe(false);
    expect(classOriginReceiptSchema.safeParse({ ...transition.receipt, after_action_revision: "0" }).success).toBe(false);
  });
  it("malformed revisions fail validation without throwing BigInt conversion", () => {
    for (const revision of ["1e2", "-1", "01", "9223372036854775808", 1]) {
      expect(classOriginReceiptSchema.safeParse({ ...classOriginTransitionFixture().receipt, before_class_revision: revision }).success).toBe(false);
    }
    const receipt = classOriginTransitionFixture().receipt;
    expect(parseClassOriginRequest({ ...receipt.canonical_intent, expected_action_revision: "9223372036854775807" })).not.toBeNull();
    expect(parseClassOriginRequest({ ...receipt.canonical_intent, actor_id: roleId(9) })).toBeNull();
    expect(parseClassOriginRequest({ ...receipt.canonical_intent, fields: { raw: "x".repeat(32768) } })).toBeNull();
  });
  it("same row proof is single-use, exact before/after/key/transaction, never role-based", () => {
    const fixture = classOriginTransitionFixture(); fixture.finalized = false; fixture.transitions.forEach(row => { row.consumed = false; });
    const row = fixture.transitions[0];
    const next = model.consumeRowForTest(fixture, "900", row.relation_key, row.row_key, row.before_row, row.after_row);
    expect(next?.transitions[0].consumed).toBe(true); expect(fixture.transitions[0].consumed).toBe(false);
    expect(model.consumeRowForTest(next!, "900", row.relation_key, row.row_key, row.before_row, row.after_row)).toBeNull();
    expect(model.consumeRowForTest(fixture, "901", row.relation_key, row.row_key, row.before_row, row.after_row)).toBeNull();
    expect(model.consumeRowForTest(fixture, "900", row.relation_key, [roleId(999)], row.before_row, row.after_row)).toBeNull();
    expect(model.consumeRowForTest(fixture, "900", row.relation_key, row.row_key, row.before_row, { ...row.after_row, origin_status: "draft" })).toBeNull();
  });
  it.each(["unconsumed", "duplicate", "extra", "missing-plan", "wrong-tx", "unfinalized", "no-revision-proof"])("deferred closure rejects %s proof", mode => {
    const fixture = classOriginTransitionFixture();
    if (mode === "unconsumed") fixture.transitions[0].consumed = false;
    if (mode === "duplicate") fixture.transitions.push(structuredClone(fixture.transitions[0]));
    if (mode === "extra") fixture.transitions.push({ ...structuredClone(fixture.transitions[0]), row_key: [roleId(999)] });
    if (mode === "missing-plan") fixture.planned_transitions.pop();
    if (mode === "wrong-tx") fixture.transaction_id = "901";
    if (mode === "unfinalized") fixture.finalized = false;
    if (mode === "no-revision-proof" && fixture.acceptance_kind === "class_transition") fixture.revision_transition_consumed = false;
    expect(finalize(fixture, "deferred").status).toBe("model_rejected");
  });
  it("alternate raw writer after immediate finalization is rejected by deferred graph comparison", () => {
    const fixture = classOriginTransitionFixture(), observed = structuredClone(fixture.expected_graph);
    expect(finalize(fixture).status).toBe("model_checked"); observed.parent.state = { current_hp: 99 };
    expect(model.finalizeForTest(fixture, observed, fixture.receipt, "900", "deferred").status).toBe("model_rejected");
  });
  it.each(["ref-order", "extra-class", "missing-version", "changed-effect", "wrong-owner", "order-revision", "subclass-unselected"])("refuses %s even when forged expected graph matches injected observation", mode => {
    const fixture = classOriginTransitionFixture(), graph = fixture.expected_graph;
    if (mode === "ref-order") graph.order.pins = [];
    if (mode === "extra-class") { const ref = { ...graph.refs[0], id: roleId(999) }; graph.refs.push(ref); graph.order.pins.push(String(ref.id)); }
    if (mode === "missing-version") graph.versions = [];
    if (mode === "changed-effect") return expect(model.finalizeForTest(fixture, { ...graph, versions: [{ ...graph.versions[0], effects_snapshot: [] }] }, fixture.receipt, "900", "deferred").status).toBe("model_rejected");
    if (mode === "wrong-owner") graph.parent.user_id = roleId(999);
    if (mode === "order-revision") graph.order.producer_revision = "0";
    if (mode === "subclass-unselected") graph.occurrences[0].subclass_ref_id = roleId(999);
    expect(finalize(fixture).status).toBe("model_rejected");
  });
  it("bootstrap captured evidence cannot be replaced by a boolean or a later guessed absence", () => {
    const fixture = classOriginBootstrapFixture(); if (fixture.acceptance_kind === "class_transition") throw Error("Bootstrap fixture");
    expect(classOriginAcceptanceSchema.safeParse({ ...fixture, preinsert_proof: null, target_absent_before_insert: true }).success).toBe(false);
    fixture.preinsert_proof.transaction_id = "899"; expect(finalize(fixture).status).toBe("model_rejected");
  });
  it("copy-of-copy retains A confirmation and separately records B current ended lifecycle", () => {
    const fixture = classOriginCopiedFixture(true); if (fixture.receipt.receipt_kind !== "bootstrap_copy") throw Error("Copy fixture");
    const lineage = fixture.receipt.copy_lineage, root = structuredClone(lineage.root_anchor);
    expect(lineage.immediate_source.source_character_id).not.toBe(lineage.root_anchor!.root_confirmation.canonical_intent.character_id);
    expect(lineage.root_anchor!.root_occurrence_at_confirmation.lifecycle).toBe("accepted"); expect(lineage.immediate_source.lifecycle).toBe("ended");
    expect(finalize(fixture).status).toBe("model_checked"); expect(lineage.root_anchor).toEqual(root);
    fixture.expected_graph.occurrences[0].lifecycle = "accepted"; fixture.expected_graph.occurrences[0].ended_at = null;
    expect(finalize(fixture).status).toBe("model_rejected");
  });
  it.each(["root-id", "prior-copy", "map", "source-counter", "target-counter"])("rejects copied %s substitution", mode => {
    const fixture = classOriginCopiedFixture(); if (fixture.receipt.receipt_kind !== "bootstrap_copy") throw Error("Copy fixture");
    const lineage = fixture.receipt.copy_lineage;
    if (mode === "root-id") lineage.root_anchor!.root_confirmation.canonical_intent.character_id = lineage.immediate_source.source_character_id;
    if (mode === "prior-copy") lineage.source_copy_receipt_identity = null;
    if (mode === "map") lineage.occurrence_map[0].target_id = roleId(999);
    if (mode === "source-counter") lineage.immediate_source.action_revision = "54";
    if (mode === "target-counter") fixture.expected_graph.parent.action_revision = "55";
    expect(finalize(fixture).status).toBe("model_rejected");
  });
  it("canonical subclass parent_class participates; wrong-parent and class-only payloads do not", () => {
    const fixture = classOriginCanonicalSubclassFixture(), version = fixture.expected_graph.versions.find(row => row.content_type_snapshot === "subclass")!;
    expect(subclassDataSchema.safeParse(version.data_snapshot).success).toBe(true); expect(finalize(fixture).status).toBe("model_checked");
    version.data_snapshot = { ...version.data_snapshot as Record<string, unknown>, parent_class: "wrong-parent" };
    expect(finalize(fixture).status).toBe("model_rejected");
    const data: Record<string, unknown> = { ...version.data_snapshot as Record<string, unknown>, class: "lantern-keeper" }; delete data.parent_class; version.data_snapshot = data;
    expect(subclassDataSchema.safeParse(data).success).toBe(false); expect(finalize(fixture).status).toBe("model_rejected");
  });
  it.each(["before-accepted", "after-provisional", "unknown-acquired", "wrong-operation", "wrong-time", "content", "version", "slug", "system"])(
    "confirmation refuses selfconsistent selected-occurrence %s substitution", mode => {
      const fixture = classOriginTransitionFixture(), graph = fixture.expected_graph, occurrence = graph.occurrences[0];
      if (fixture.acceptance_kind !== "class_transition") throw Error("Transition fixture");
      if (mode === "before-accepted") {
        const before = fixture.transitions.find(row => row.relation_key === "occurrence")!.before_row!;
        before.lifecycle = "accepted"; before.acquired_character_level = 1; before.accepted_at = "2026-10-12T04:00:00Z"; before.acquisition_operation_id = roleId(999);
      }
      if (mode === "after-provisional") { occurrence.lifecycle = "provisional"; occurrence.acquired_character_level = null; occurrence.acquisition_operation_id = null; occurrence.accepted_at = null; }
      if (mode === "unknown-acquired") occurrence.acquired_character_level = null;
      if (mode === "wrong-operation") occurrence.acquisition_operation_id = roleId(999);
      if (mode === "wrong-time") occurrence.accepted_at = "2026-10-12T05:00:01Z";
      if (mode === "content") { occurrence.content_id = roleId(999); graph.refs[0].content_id = roleId(999); graph.versions[0].content_id = roleId(999); }
      if (mode === "version") { occurrence.content_version = 2; graph.refs[0].content_version = 2; graph.versions[0].version = 2; }
      if (mode === "slug") { occurrence.class_slug = "changed-class"; graph.versions[0].slug_snapshot = "changed-class"; (graph.parent.choices as { classes: { slug: string }[] }).classes[0].slug = "changed-class"; }
      if (mode === "system") { graph.parent.system_id = roleId(999); graph.origin.system_id = roleId(999); occurrence.system_id = roleId(999); graph.versions[0].system_id_snapshot = roleId(999); }
      refreshClassOriginFixtureProofs(fixture);
      const checked = finalize(fixture); expect(checked.status).toBe("model_rejected");
      if (checked.status === "model_rejected") expect(checked.reason).toBe("selected_confirmation_occurrence_mismatch");
    });
  it("retained ended occurrence and its matching foreign version cannot escape parent system binding", () => {
    const fixture = classOriginCopiedFixture(), graph = fixture.expected_graph, occurrence = structuredClone(graph.occurrences[0]);
    occurrence.id = roleId(940); occurrence.system_id = roleId(999); occurrence.content_id = roleId(941); occurrence.class_slug = "foreign-ended-class";
    occurrence.lifecycle = "ended"; occurrence.ended_at = "2026-10-12T04:30:00Z"; occurrence.controller_ref_id = null;
    graph.occurrences.push(occurrence); graph.versions.push({ ...graph.versions[0], content_id: occurrence.content_id, system_id_snapshot: occurrence.system_id, slug_snapshot: occurrence.class_slug });
    expect(finalize(fixture).status).toBe("model_rejected");
  });
  it.each(["inventory", "spells", "feature_grants", "spell_grants"] as const)("every required %s version must use the parent system", domain => {
    const fixture = classOriginCopiedFixture(), graph = fixture.expected_graph, id = roleId(940), content = roleId(941);
    graph[domain].push(domain === "feature_grants" ? { id, character_id: graph.parent.id, feature_content_id: content, feature_version: 1 }
      : domain === "spell_grants" ? { id, character_id: graph.parent.id, spell_content_id: content, spell_version: 1 }
        : { id, character_id: graph.parent.id, content_id: content, content_version: 1 });
    graph.order[domain].push(id); graph.versions.push({ ...graph.versions[0], content_id: content, system_id_snapshot: roleId(999) });
    expect(finalize(fixture).status).toBe("model_rejected");
  });
  it.each(["content", "version", "slug", "system", "acquired", "selected-time", "accepted-time"])("recorded copy refuses selfconsistent target/root %s divergence", mode => {
    const fixture = classOriginCopiedFixture(), graph = fixture.expected_graph, occurrence = graph.occurrences[0];
    if (mode === "content") { occurrence.content_id = roleId(999); graph.refs[0].content_id = roleId(999); graph.versions[0].content_id = roleId(999); }
    if (mode === "version") { occurrence.content_version = 2; graph.refs[0].content_version = 2; graph.versions[0].version = 2; }
    if (mode === "slug") { occurrence.class_slug = "different-root"; graph.versions[0].slug_snapshot = "different-root"; (graph.parent.choices as { classes: { slug: string }[] }).classes[0].slug = "different-root"; }
    if (mode === "system") { graph.parent.system_id = roleId(999); graph.origin.system_id = roleId(999); occurrence.system_id = roleId(999); graph.versions[0].system_id_snapshot = roleId(999); }
    if (mode === "acquired") occurrence.acquired_character_level = null;
    if (mode === "selected-time") occurrence.selected_at = "2026-10-12T01:00:01Z";
    if (mode === "accepted-time") occurrence.accepted_at = "2026-10-12T02:00:01Z";
    refreshClassOriginFixtureProofs(fixture); const checked = finalize(fixture);
    expect(checked.status).toBe("model_rejected");
    if (checked.status === "model_rejected") expect(checked.reason).toBe("copy_root_or_current_lifecycle_mismatch");
  });
  it.each(["selected", "accepted", "receipt-time", "selected-after", "ended-before", "microsecond-order"])("copy root %s has explicit finite native chronology", mode => {
    const fixture = classOriginCopiedFixture(true); if (fixture.receipt.receipt_kind !== "bootstrap_copy") throw Error("Copy fixture");
    const anchor = fixture.receipt.copy_lineage.root_anchor!;
    const occurrence = anchor.root_occurrence_at_confirmation as unknown as Record<string, unknown>;
    if (mode === "selected") occurrence.selected_at = null;
    if (mode === "accepted") occurrence.accepted_at = null;
    if (mode === "receipt-time") (anchor.root_confirmation as unknown as Record<string, unknown>).accepted_at = null;
    if (mode === "selected-after") occurrence.selected_at = "2026-10-12T03:00:00Z";
    if (mode === "ended-before") fixture.receipt.copy_lineage.immediate_source.ended_at = "2026-10-12T01:59:59Z";
    if (mode === "microsecond-order") { occurrence.selected_at = "2026-10-12T02:00:00.000002Z"; occurrence.accepted_at = "2026-10-12T02:00:00.000001Z"; anchor.root_confirmation.accepted_at = String(occurrence.accepted_at); }
    fixture.expected_graph.origin.role_proof = { kind: "copy_lineage", lineage_version: 1, lineage: structuredClone(fixture.receipt.copy_lineage) };
    refreshClassOriginFixtureProofs(fixture); expect(finalize(fixture).status).toBe("model_rejected");
  });
  it.each(["origin", "occurrence", "class_receipt", "creation_receipt"] as const)("foreign selfconsistent %s proof is denied before consumption and at deferred closure", relation => {
    const fixture = relation === "creation_receipt" ? classOriginBootstrapFixture() : classOriginTransitionFixture();
    fixture.finalized = false; const row = fixture.transitions.find(candidate => candidate.relation_key === relation)!; row.consumed = false;
    for (const value of [row.before_row, row.after_row]) if (value) {
      if (relation === "creation_receipt") { value.target_character_id = roleId(999); value.verified_actor_id = roleId(998); }
      else value.character_id = roleId(999);
    }
    if (relation === "origin") row.row_key = [roleId(999)];
    if (relation === "class_receipt") row.row_key[0] = roleId(999);
    if (relation === "creation_receipt") row.row_key[0] = roleId(998);
    fixture.planned_transitions = fixture.transitions.map(candidate => ({ relation_key: candidate.relation_key, row_key: structuredClone(candidate.row_key), before_row: structuredClone(candidate.before_row), after_row: structuredClone(candidate.after_row) }));
    expect(model.consumeRowForTest(fixture, "900", relation, row.row_key, row.before_row, row.after_row)).toBeNull(); expect(row.consumed).toBe(false);
    fixture.finalized = true; row.consumed = true;
    const checked = finalize(fixture, "deferred"); expect(checked.status).toBe("model_rejected");
    if (checked.status === "model_rejected") expect(checked.reason).toBe("row_target_actor_identity_mismatch");
  });
  it.each(["actor-only", "target-only"])("creation receipt %s mismatch fails exact planned proof consumption", mode => {
    const fixture = classOriginBootstrapFixture(); fixture.finalized = false;
    const row = fixture.transitions.find(candidate => candidate.relation_key === "creation_receipt")!; row.consumed = false;
    if (mode === "actor-only") { row.after_row!.verified_actor_id = roleId(998); row.row_key[0] = roleId(998); }
    else row.after_row!.target_character_id = roleId(999);
    fixture.planned_transitions = fixture.transitions.map(candidate => ({ relation_key: candidate.relation_key, row_key: structuredClone(candidate.row_key), before_row: structuredClone(candidate.before_row), after_row: structuredClone(candidate.after_row) }));
    expect(model.consumeRowForTest(fixture, "900", row.relation_key, row.row_key, row.before_row, row.after_row)).toBeNull();
  });
});
