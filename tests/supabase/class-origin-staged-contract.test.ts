import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CLASS_ORIGIN_STAGE_PATH } from "@/lib/character/class-origin-command-model";
const sql = readFileSync(CLASS_ORIGIN_STAGE_PATH, "utf8");
function body(name: string) { const start = sql.indexOf(`CREATE FUNCTION private.${name}(`); expect(start).toBeGreaterThan(-1); return sql.slice(start, sql.indexOf("END $$;", start)); }
describe("P1a actual staged source contract, never executes SQL", () => {
  it("has no public producer/positive auth/shared revision change/cutover/readiness writer", () => {
    expect(sql).not.toMatch(/CREATE(?: OR REPLACE)? FUNCTION public\./);
    expect(sql).not.toMatch(/CREATE(?: OR REPLACE)? FUNCTION private\.(?:hit_die_|lock_character_writer_guard)/);
    expect(sql).not.toMatch(/(?:INSERT INTO|UPDATE) private\.character_writer_readiness_v1/i);
    expect(sql).not.toMatch(/(?:INSERT INTO|UPDATE) private\.character_projection_order_v1/i);
    expect(sql).not.toMatch(/UPDATE public\.characters/i);
    expect(sql).not.toContain("set_config"); expect(sql).not.toContain("current_setting"); expect(sql).not.toContain("current_user");
    expect(sql).toContain("CHECK(NOT enabled)"); expect(sql).toContain("NOBYPASSRLS NOINHERIT NOSUPERUSER");
    const entry = body("begin_class_origin_acceptance_v1"), auth = body("require_class_origin_auth_v1");
    expect(auth).toContain("RAISE EXCEPTION 'auth_unavailable'"); expect(entry).not.toMatch(/INSERT|UPDATE|DELETE/);
    expect(entry.indexOf("require_class_origin_auth_v1")).toBeLessThan(entry.indexOf("lock_character_writer_guard_v1"));
  });
  it("restricts all new private table/functions and grants only key lock visibility on public parents", () => {
    expect(sql).toContain("REVOKE ALL ON private.%I FROM PUBLIC,anon,authenticated,service_role");
    expect(sql).toContain("REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role");
    expect(sql).toContain("ALTER TABLE private.%I ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("GRANT UPDATE(id) ON public.characters"); expect(sql).toContain("AS RESTRICTIVE FOR UPDATE");
    expect(sql).not.toMatch(/GRANT.*(?:EXECUTE|MEMBERSHIP).*TO (?:service_role|authenticated|anon)/);
    expect(sql).not.toMatch(/GRANT UPDATE\(action_revision/);
  });
  it("captures bootstrap absence before INSERT under existing exclusive guard, forbidding supplied capture", () => {
    const guard = body("class_origin_acceptance_guard_v1");
    expect(guard.indexOf("lock_character_writer_guard_v1")).toBeLessThan(guard.indexOf("Bootstrap target not absent"));
    for (const token of ["NEW.preinsert_proof IS NOT NULL", "EXISTS(SELECT 1 FROM public.characters", "EXISTS(SELECT 1 FROM private.character_class_origin_v1",
      "EXISTS(SELECT 1 FROM private.character_projection_order_v1", "NEW.preinsert_proof:=pg_catalog.jsonb_build_object", "pg_catalog.pg_current_xact_id()"])
      expect(guard).toContain(token);
    expect(guard).toContain("Actual before parent mismatch"); expect(guard).toContain("Actual before origin mismatch");
  });
  it("uses immutable exact planned old/new row proofs, one consumption and current transaction", () => {
    const guard = body("class_origin_protected_row_guard_v1"), transitions = body("class_origin_row_transition_guard_v1");
    for (const token of ["transition.before_row IS NOT DISTINCT FROM old_row", "transition.after_row IS NOT DISTINCT FROM new_row", "match_count<>1",
      "NOT transition.consumed", "NOT j.finalized", "j.transaction_id=pg_catalog.pg_current_xact_id()", "SET consumed=true"])
      expect(guard).toContain(token);
    expect(transitions).toContain("j.planned_transitions @>"); expect(transitions).toContain("OLD.consumed OR NOT NEW.consumed");
    expect(body("class_origin_assert_common_v1")).toContain("Exact planned proof set mismatch");
  });
  it("dispatches transition and bootstrap through actual immediate and deferred functions", () => {
    const dispatch = body("class_origin_finalize_acceptance_v1");
    expect(dispatch).toContain("IF j.acceptance_kind='class_transition' THEN PERFORM private.class_origin_finalize_transition_v1");
    expect(dispatch).toContain("ELSIF j.acceptance_kind IN ('bootstrap_new','bootstrap_copy') THEN PERFORM private.class_origin_finalize_bootstrap_v1");
    expect(body("class_origin_deferred_finalizer_v1")).toContain("private.class_origin_finalize_acceptance_v1(NEW.acceptance_id)");
    expect(sql.match(/DEFERRABLE INITIALLY DEFERRED/g)).toHaveLength(2);
    expect(sql).toContain("UNIQUE(transaction_id,target_character_id)");
  });
  it("normal +1 is distinct from bootstrap0 with absent before state and original source-only counters", () => {
    const transition = body("class_origin_finalize_transition_v1"), bootstrap = body("class_origin_finalize_bootstrap_v1");
    expect(transition).toContain("before_shared+1"); expect(transition).toContain("before_class+1"); expect(transition).toContain("NOT j.revision_transition_consumed");
    expect(transition).toContain("Actual metadata confirmation delta missing");
    for (const token of ["j.before_parent IS NOT NULL", "j.before_origin IS NOT NULL", "j.revision_transition_consumed", "IS DISTINCT FROM '0'",
      "j.preinsert_proof->>'transaction_id'", "j.receipt ?| ARRAY['before_action_revision'"])
      expect(bootstrap).toContain(token);
    expect(body("class_origin_receipt_shape_v1")).toContain("class_origin_exact_keys_v1(receipt");
  });
  it("compares complete final raw graph and full ordered ID bijections, not hidden/default subsets", () => {
    const graph = body("class_origin_read_final_graph_v1"), common = body("class_origin_assert_common_v1");
    expect(graph).toContain("producer_revision<>c.action_revision"); expect(graph).toContain("Retained occurrence bijection mismatch");
    for (const domain of ["Ref", "Inventory", "Spell", "Feature grant", "Spell grant"]) expect(graph).toContain(`${domain} bijection mismatch`);
    expect(graph).toContain("WITH ORDINALITY"); expect(graph).toContain("LEFT JOIN public.content_versions"); expect(graph).toContain("required_count<>resolved_count");
    expect(common).toContain("graph IS DISTINCT FROM j.expected_graph"); expect(common).toContain("Reverse class graph mismatch");
    expect(common).toContain("Subclass exact parent mismatch"); expect(common).toContain("Recorded active origin must retain first HP position");
  });
  it("retains original anchor and immediate source lifecycle as separate copy proof namespaces", () => {
    const lineage = body("class_origin_copy_lineage_shape_v1"), bootstrap = body("class_origin_finalize_bootstrap_v1");
    for (const token of ["root_occurrence_at_confirmation", "root_confirmation", "source_copy_receipt_identity", "immediate_source", "occurrence_map"]) expect(lineage).toContain(token);
    expect(lineage).toContain("occurrence->>'character_id' IS DISTINCT FROM original->>'character_id'");
    expect(bootstrap).toContain("origin_occurrence->>'lifecycle' IS DISTINCT FROM lineage#>>'{immediate_source,lifecycle}'");
    expect(bootstrap).toContain("Target copy must preserve root identity and immediate lifecycle");
    expect(sql).toContain("Immutable history; lifecycle prerequisite unavailable");
  });
});
