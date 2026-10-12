import { describe, expect, it } from "vitest";
import { classOriginJointSources } from "@/tests/fixtures/class-origin-joint-revision";
const sources = classOriginJointSources(), sql = sources.joint!;
function body(name: string, source = sql) {
  source = source.replace(/\r\n/g, "\n");
  let start = source.indexOf(`CREATE FUNCTION private.${name}(`);
  if (start < 0) start = source.indexOf(`CREATE OR REPLACE FUNCTION private.${name}(`);
  expect(start).toBeGreaterThan(-1);
  const opening = source.indexOf("AS $$", start); return source.slice(start, source.indexOf("$$;", opening + 5) + 3);
}
describe("P1b.1 source installation/ACL contract only; SQL never executes", () => {
  it("orders table/policies → validators → helper → replacements → triggers → final ACL closure", () => {
    const names = ["CREATE TABLE private.class_origin_revision_events_v1", "CREATE POLICY class_origin_event_class_read",
      "CREATE FUNCTION private.class_origin_metadata_delta_v1", "CREATE FUNCTION private.class_origin_observed_revision_v1",
      "CREATE FUNCTION private.class_origin_assert_metadata_revision_v1", "CREATE FUNCTION private.class_origin_consume_metadata_revision_v1",
      "CREATE FUNCTION private.class_origin_revision_event_guard_v1", "CREATE FUNCTION private.apply_class_metadata_revision_v1",
      "CREATE FUNCTION private.class_origin_revision_event_closure_v1", "CREATE FUNCTION private.class_origin_metadata_revision_dispatch_v1",
      "CREATE OR REPLACE FUNCTION private.class_origin_acceptance_guard_v1", "CREATE OR REPLACE FUNCTION private.class_origin_finalize_transition_v1",
      "CREATE OR REPLACE FUNCTION private.hit_die_character_revision_v1", "CREATE TRIGGER class_origin_revision_event_guard",
      "CREATE TRIGGER class_origin_metadata_revision_dispatch", "CREATE CONSTRAINT TRIGGER class_origin_revision_event_closure",
      "REVOKE ALL ON FUNCTION", "COMMIT;"];
    let previous = -1; for (const name of names) { const next = sql.indexOf(name); expect(next).toBeGreaterThan(previous); previous = next; }
    expect(sql).toContain("REFERENCES private.class_writer_acceptance_v1(acceptance_id) ON DELETE RESTRICT");
  });
  it("retains original class guard/normal predicates with only explicit checked-event additions", () => {
    for (const name of ["class_origin_acceptance_guard_v1", "class_origin_finalize_transition_v1"]) {
      let replacement = body(name).replace("CREATE OR REPLACE FUNCTION", "CREATE FUNCTION");
      if (name === "class_origin_acceptance_guard_v1") replacement = replacement.replace("    IF NOT OLD.revision_transition_consumed AND NEW.revision_transition_consumed THEN\n      PERFORM private.class_origin_observed_revision_v1(NEW.acceptance_id);\n    END IF;\n", "");
      else replacement = replacement.replace("  PERFORM private.class_origin_assert_metadata_revision_v1(p_acceptance);\n", "");
      expect(replacement).toBe(body(name, sources.p1a));
    }
    expect(sql).not.toMatch(/CREATE(?: OR REPLACE)? FUNCTION private\.class_origin_finalize_bootstrap_v1/);
  });
  it("preserves actual ordinary R09 revision branch verbatim and leaves shared guard/rebind untouched", () => {
    const marker = "  IF (NEW.state,NEW.base_stats", original = body("hit_die_character_revision_v1", sources.authority), next = body("hit_die_character_revision_v1");
    expect(next.slice(next.indexOf(marker))).toBe(original.slice(original.indexOf(marker)));
    expect(sql).not.toMatch(/CREATE(?: OR REPLACE)? FUNCTION private\.(?:lock_character_writer_guard_v1|hit_die_order_revision_rebind_v1)/);
    const helper = body("apply_class_metadata_revision_v1");
    expect(helper.match(/UPDATE public\.characters/g)).toHaveLength(1);
    expect(helper).toContain("SET action_revision=before_shared+1"); expect(helper).not.toMatch(/SET (?:choices|id|updated_at|level|state)/);
    expect(sql).not.toMatch(/UPDATE private\.character_projection_order_v1/);
  });
  it("new event callback calls only class assertion; P1 base deferred triggers retain full closure", () => {
    const callback = body("class_origin_revision_event_closure_v1");
    expect(callback).toContain("private.class_origin_assert_metadata_revision_v1(NEW.acceptance_id)");
    expect(callback).not.toContain("class_origin_finalize_acceptance_v1");
    expect(sql).not.toMatch(/GRANT EXECUTE[^;]*class_origin_finalize_acceptance_v1/);
    expect(sources.p1a).toContain("CREATE CONSTRAINT TRIGGER class_origin_acceptance_closure");
    expect(sources.p1a).toContain("CREATE CONSTRAINT TRIGGER class_origin_transition_closure");
    expect(body("class_origin_deferred_finalizer_v1", sources.p1a)).toContain("class_origin_finalize_acceptance_v1(NEW.acceptance_id)");
  });
  it("class validator checks actual rows after consumed proof, not planned headers alone", () => {
    const delta = body("class_origin_metadata_delta_v1"), dispatch = body("class_origin_metadata_revision_dispatch_v1");
    for (const check of ["origin_proof.after_row IS DISTINCT FROM origin_json", "occurrence_proof.after_row IS DISTINCT FROM pg_catalog.to_jsonb(occurrence)",
      "occurrence.acquired_character_level IS DISTINCT FROM 1", "occurrence.acquisition_operation_id IS DISTINCT FROM", "occurrence.system_id IS DISTINCT FROM c.system_id",
      "version.system_id_snapshot=c.system_id", "before_shared=9223372036854775807", "j.before_parent#>>'{choices,classes,0,occurrence_id}'"])
      expect(delta).toContain(check);
    expect(dispatch).toContain("proof.after_row=(pg_catalog.to_jsonb(NEW)");
    expect(sql).toContain("class_origin_metadata_revision_dispatch AFTER UPDATE");
  });
  it("actual returning/stored/order observation precedes Boolean consumption and cannot skip phases", () => {
    const helper = body("apply_class_metadata_revision_v1"), consumer = body("class_origin_consume_metadata_revision_v1"), guard = body("class_origin_revision_event_guard_v1");
    expect(helper.indexOf("RETURNING * INTO after_row")).toBeLessThan(helper.indexOf("parent_json IS DISTINCT FROM after_json"));
    expect(helper.indexOf("parent_json IS DISTINCT FROM after_json")).toBeLessThan(helper.indexOf("SET phase='observed'"));
    expect(helper.indexOf("SET phase='observed'")).toBeLessThan(helper.indexOf("class_origin_consume_metadata_revision_v1"));
    expect(consumer.indexOf("class_origin_observed_revision_v1")).toBeLessThan(consumer.indexOf("SET revision_transition_consumed=true"));
    expect(consumer).toContain("changed<>1"); expect(guard).toContain("8388608"); expect(guard).toContain("NOT COALESCE(");
    expect(guard).toContain("NEW.observed_parent=parent_json"); expect(guard).not.toContain("PERFORM private.class_origin_observed_revision_v1");
  });
  it("closes ACLs under original owners without broad journal DML or observed-helper/base-dispatch grant", () => {
    for (const authorityFunction of ["class_origin_revision_event_guard_v1()", "apply_class_metadata_revision_v1(uuid)", "class_origin_revision_event_closure_v1()", "hit_die_character_revision_v1()"]) {
      expect(sql).toContain(`ALTER FUNCTION private.${authorityFunction} OWNER TO inkborne_hit_die_authority_owner`);
    }
    for (const classFunction of ["class_origin_metadata_delta_v1(uuid)", "class_origin_observed_revision_v1(uuid)", "class_origin_consume_metadata_revision_v1(uuid)", "class_origin_assert_metadata_revision_v1(uuid)", "class_origin_acceptance_guard_v1()", "class_origin_finalize_transition_v1(uuid)"]) {
      expect(sql).toContain(`ALTER FUNCTION private.${classFunction} OWNER TO inkborne_class_origin_owner`);
    }
    expect(sql).toContain("FROM PUBLIC,anon,authenticated,service_role");
    expect(sql).not.toMatch(/GRANT[^;]*class_writer_acceptance_v1/);
    expect(sql).not.toMatch(/GRANT EXECUTE[^;]*class_origin_observed_revision_v1/);
    for (const name of ["class_origin_revision_event_guard_v1", "apply_class_metadata_revision_v1", "hit_die_character_revision_v1"]) {
      expect(body(name)).not.toContain("FROM private.class_writer_acceptance_v1");
    }
  });
  it("does not create issuer/Auth/order/readiness/bootstrap/copy/app authority", () => {
    expect(sql).not.toMatch(/CREATE(?: OR REPLACE)? FUNCTION public\./);
    expect(sql).not.toMatch(/CREATE(?: OR REPLACE)? FUNCTION private\.require_(?:class_origin|verified_hit_die)_auth_v1/);
    expect(sql).not.toMatch(/(?:INSERT INTO|UPDATE) private\.character_writer_readiness_v1/);
    expect(sql).not.toMatch(/(?:INSERT INTO|UPDATE) private\.class_writer_acceptance_v1[^;]*finalized=true/);
    expect(sql).not.toContain("set_config"); expect(sql).not.toContain("current_setting"); expect(sql).not.toContain("current_user");
    expect(body("require_class_origin_auth_v1", sources.p1a)).toContain("RAISE EXCEPTION 'auth_unavailable'");
    expect(body("require_verified_hit_die_auth_v1", sources.authority)).toContain("RAISE EXCEPTION 'auth_unavailable'");
  });
});
