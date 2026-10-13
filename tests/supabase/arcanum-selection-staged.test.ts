import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { arcanumFunctionBody } from "@/tests/spells/arcanum-selection-source-model";

const sql = readFileSync("supabase/staged/arcanum-first-selection.sql", "utf8");
const authority = readFileSync("supabase/staged/hit-die-authority-and-writers.sql", "utf8");
const kernel = readFileSync("supabase/staged/hit-die-transaction.sql", "utf8");
const names = ["arcanum_request_shape_v1", "arcanum_capture_shape_v1", "arcanum_receipt_correspondence_v1",
  "arcanum_canonical_ready_v1", "arcanum_lineage_ready_v1", "arcanum_order_ready_v1", "arcanum_prerequisite_refusal_v1",
  "lock_arcanum_parent_v1", "read_locked_arcanum_selection_v1", "select_arcanum_spell_v1", "resolve_arcanum_selection_v1",
  "arcanum_immutable_row_v1", "arcanum_pair_closure_v1"];
describe("actual staged Arcanum v1 STATIC source only; no PostgreSQL compile/runtime proof", () => {
  it("keeps object definition order and all13 exact new functions private", () => {
    expect(sql).toContain("BEGIN;"); expect(sql.trim().endsWith("COMMIT;")).toBe(true);
    expect(sql.match(/CREATE FUNCTION private\./g)).toHaveLength(13); expect(sql).not.toMatch(/CREATE (?:OR REPLACE )?FUNCTION public\./);
    let last = -1;
    for (const name of names) { const at = sql.indexOf(`CREATE FUNCTION private.${name}(`); expect(at).toBeGreaterThan(last); last = at; }
    const selections = sql.indexOf("CREATE TABLE private.character_arcanum_selections_v1");
    const receipts = sql.indexOf("CREATE TABLE private.character_arcanum_selection_receipts_v1");
    const fk = sql.indexOf("ADD CONSTRAINT arcanum_selection_original_receipt");
    expect(receipts).toBeGreaterThan(selections); expect(fk).toBeGreaterThan(receipts);
    expect(sql.indexOf("CREATE FUNCTION private.arcanum_request_shape_v1")).toBeGreaterThan(fk);
    expect(sql.indexOf("CREATE TRIGGER arcanum_selection_immutable")).toBeGreaterThan(last);
  });
  it("checks isolated original owner and actual all-row parent visibility without caller/RI assumptions", () => {
    expect(sql).toContain("r.rolcanlogin OR r.rolsuper OR r.rolbypassrls OR r.rolinherit OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication");
    expect(sql).toContain("m.roleid=owner_oid OR m.member=owner_oid"); expect(sql).toContain("pg_catalog.has_schema_privilege(owner_oid,'private','CREATE')");
    expect(sql).toContain("pg_catalog.has_table_privilege(owner_oid,'public.characters','SELECT')");
    expect(sql).toContain("p.polname='hit_die_authority_character_read'"); expect(sql).toContain("pg_catalog.pg_get_expr(p.polqual,p.polrelid)='true'");
    expect(sql).toContain("NOT p.polpermissive"); expect(sql).not.toMatch(/current_setting|session_user|current_user\s*=|CREATE ROLE|ALTER ROLE/i);
  });
  it("forces private RLS with SELECT-only policies and no new runtime privileges", () => {
    for (const table of ["character_arcanum_selections_v1", "character_arcanum_selection_receipts_v1"]) {
      expect(sql).toContain(`ALTER TABLE private.${table} ENABLE ROW LEVEL SECURITY;`);
      expect(sql).toContain(`ALTER TABLE private.${table} FORCE ROW LEVEL SECURITY;`);
      expect(sql).toContain(`ALTER TABLE private.${table} OWNER TO inkborne_hit_die_authority_owner;`);
    }
    expect(sql.match(/CREATE POLICY/g)).toHaveLength(2); expect(sql.match(/FOR SELECT TO inkborne_hit_die_authority_owner USING\(true\)/g)).toHaveLength(2);
    expect(sql).not.toMatch(/^\s*GRANT\s/m); expect(sql).not.toContain("GRANT UPDATE(choices)");
    for (const name of names) {
      expect(sql).toMatch(new RegExp(`ALTER FUNCTION private\\.${name}\\([^;]*\\) OWNER TO inkborne_hit_die_authority_owner;`));
      expect(sql).toMatch(new RegExp(`REVOKE ALL ON FUNCTION private\\.${name}\\([^;]*\\) FROM PUBLIC,anon,authenticated,service_role;`));
    }
  });
  it("preserves actual frozen authority/kernel helper owners and checks existing effective rights", () => {
    for (const signature of ["hit_die_context_shape_v1(jsonb)", "require_verified_hit_die_auth_v1(jsonb)", "lock_character_writer_guard_v1()"]) {
      expect(authority).toContain(`ALTER FUNCTION private.${signature} OWNER TO inkborne_hit_die_authority_owner;`);
    }
    for (const signature of ["hit_die_exact_keys_v1(jsonb, text[])", "hit_die_native_v1(timestamptz)"]) {
      expect(kernel).toContain(`ALTER FUNCTION private.${signature} OWNER TO inkborne_hit_die_kernel_owner;`);
    }
    expect(authority).toContain("GRANT USAGE ON SCHEMA public, private TO inkborne_hit_die_authority_owner;");
    expect(authority).toContain("GRANT EXECUTE ON FUNCTION private.hit_die_exact_keys_v1(jsonb,text[]), private.hit_die_native_v1(timestamptz)");
    const preflight = sql.slice(0, sql.indexOf("CREATE TABLE"));
    expect(preflight).toContain("r.rolname='inkborne_hit_die_kernel_owner'");
    expect(preflight).toContain("p.proowner=owner_oid"); expect(preflight).toContain("p.proowner=kernel_oid");
    expect(preflight.match(/has_function_privilege\(owner_oid,pg_catalog.to_regprocedure\(required\),'EXECUTE'\)/g)).toHaveLength(2);
    for (const schema of ["public", "private"]) expect(preflight).toContain(`NOT pg_catalog.has_schema_privilege(owner_oid,'${schema}','USAGE')`);
    expect(preflight).toContain("'private.lock_character_writer_guard_v1()'] LOOP");
    expect(preflight).toContain("ARRAY['private.hit_die_exact_keys_v1(jsonb,text[])','private.hit_die_native_v1(timestamp with time zone)'] LOOP");
    expect(sql).not.toMatch(/ALTER FUNCTION private\.hit_die_|ALTER FUNCTION private\.require_verified_hit_die_auth|ALTER FUNCTION private\.lock_character_writer_guard/);
    expect(sql).not.toMatch(/^\s*GRANT\s/m);
  });
  it("keeps both reciprocal deferred identity FKs, occurrence uniqueness and no grant/catalog cascade", () => {
    expect(sql).toContain("UNIQUE(character_id,earned_occurrence_id)");
    expect(sql.match(/FOREIGN KEY\(character_id,selection_id,earned_occurrence_id,origin_id,operation_id,original_actor_id,accepted_at,before_revision,after_revision,original_feature_grant_id,controller_ref_id,controller_content_id,controller_version,derived_feature_ref_id,feature_content_id,feature_version,spell_content_id,spell_version\)/g)).toHaveLength(2);
    expect(sql.match(/DEFERRABLE INITIALLY DEFERRED;/g)).toHaveLength(2);
    expect(sql.match(/REFERENCES public\.characters\(id\) ON DELETE CASCADE/g)).toHaveLength(2);
    expect(sql).not.toMatch(/REFERENCES public\.(?:content_definitions|content_versions|character_feature_grants|character_content_refs)/);
    expect(sql).toContain("CHECK(capture_kind='first_choice')"); expect(sql).toContain("CHECK(after_revision=before_revision+1)");
  });
  it.each(["arcanum_immutable_row_v1", "arcanum_pair_closure_v1"])("%s executes under isolated owner with empty search path", name => {
    const body = arcanumFunctionBody(sql, name);
    expect(body).toContain("SECURITY DEFINER SET search_path=''"); expect(body).toContain("TG_TABLE_SCHEMA<>'private'");
    expect(body).toContain("parent.id="); expect(sql).toContain(`ALTER FUNCTION private.${name}() OWNER TO inkborne_hit_die_authority_owner;`);
    expect(body).not.toContain("current_setting");
  });
  it("lifetime guard binds exact physical OLD/NEW parent, scalar payload and operation kind", () => {
    const body = arcanumFunctionBody(sql, "arcanum_immutable_row_v1");
    expect(body).toContain("parent.id=OLD.character_id"); expect(body).toContain("parent.id=NEW.character_id AND parent.system_id=NEW.system_id");
    expect(body).toContain("IF TG_OP<>'INSERT'"); expect(body).toContain("NOT NEW.capture @> identity");
    expect(body).toContain("IF TG_TABLE_NAME='character_arcanum_selection_receipts_v1' THEN");
    expect(body).toContain("private.arcanum_receipt_correspondence_v1(NEW.capture,NEW.receipt)");
  });
  it("deferred closure rereads final paired rows under exact parent/operation/selection", () => {
    const body = arcanumFunctionBody(sql, "arcanum_pair_closure_v1");
    expect(body).toContain("selection.character_id=NEW.character_id AND selection.selection_id=NEW.selection_id AND selection.operation_id=NEW.operation_id");
    expect(body).toContain("command.character_id=NEW.character_id AND command.selection_id=NEW.selection_id AND command.operation_id=NEW.operation_id");
    expect(body).toContain("s.capture IS DISTINCT FROM r.capture");
    expect(sql.match(/CREATE CONSTRAINT TRIGGER arcanum_\w+_pair AFTER INSERT[^;]*DEFERRABLE INITIALLY DEFERRED/g)).toHaveLength(2);
  });
  it("uses actual native Auth/exclusive guard/current-owned parent prefix", () => {
    const body = arcanumFunctionBody(sql, "lock_arcanum_parent_v1");
    expect(body.indexOf("private.require_verified_hit_die_auth_v1")).toBeLessThan(body.indexOf("private.lock_character_writer_guard_v1"));
    expect(body.indexOf("private.lock_character_writer_guard_v1")).toBeLessThan(body.indexOf("SELECT parent.*"));
    expect(body).toContain("parent.id=p_character_id AND parent.user_id=(p_verified_context->>'actor_id')::uuid FOR UPDATE");
    expect(body.match(/PERFORM private\.require_verified_hit_die_auth_v1/g)).toHaveLength(2);
    expect(body).toContain("pg_catalog.clock_timestamp()>=(p_verified_context->>'jwt_expires_at')::timestamptz");
  });
  it.each(["select_arcanum_spell_v1", "resolve_arcanum_selection_v1", "read_locked_arcanum_selection_v1"])("%s rechecks Auth/owner/expiry after constructing response", name => {
    const body = arcanumFunctionBody(sql, name);
    const terminal = body.lastIndexOf("PERFORM private.require_verified_hit_die_auth_v1");
    expect(terminal).toBeGreaterThan(body.indexOf("result:=")); expect(body.indexOf("RETURN result;")).toBeGreaterThan(terminal);
    expect(body.slice(terminal)).toContain("parent.id=c.id AND parent.user_id="); expect(body.slice(terminal)).toContain("pg_catalog.clock_timestamp()>=");
    expect(body).not.toMatch(/\b(?:INSERT INTO|UPDATE public|DELETE FROM)\b/);
  });
  it("receipt-first qualified lookup precedes unconditional NEW refusal; constants never issue", () => {
    const body = arcanumFunctionBody(sql, "select_arcanum_spell_v1");
    expect(body).toContain("SELECT command.receipt,selection.capture"); expect(body).toContain("WHERE command.character_id=c.id AND command.operation_id=");
    expect(body.indexOf("SELECT command.receipt")).toBeLessThan(body.indexOf("result:=private.arcanum_prerequisite_refusal_v1"));
    expect(body).not.toContain("c.action_revision<>"); expect(body).not.toContain("read_locked_hit_die_graph_v1");
    for (const name of ["canonical", "lineage", "order"]) expect(sql).toContain(`arcanum_${name}_ready_v1(p_character_id uuid) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT false $$;`);
    expect(sql).toContain("AS $$ SELECT '{\"status\":\"unready\",\"reason\":\"canonical_lineage_order_unimplemented\"}'::jsonb $$;");
  });
  it("counted raw read retains state/exhausted rows and reports no current eligibility", () => {
    const body = arcanumFunctionBody(sql, "read_locked_arcanum_selection_v1");
    expect(body).toContain("FULL JOIN private.character_arcanum_selection_receipts_v1");
    expect(body).toContain("'selections',n_c::text,'receipts',n_r::text"); expect(body).toContain("'revision',c.action_revision::text");
    expect(body).toContain("'state',c.state"); expect(body).toContain("'reason','prerequisites_unimplemented'");
    expect(body).not.toContain("feature_uses"); expect(body).not.toContain("resolveAdvancedBinding");
    for (const token of ["s.system_id IS DISTINCT FROM c.system_id", "r.system_id IS DISTINCT FROM c.system_id",
      "s.capture->>'system_id' IS DISTINCT FROM c.system_id::text", "r.capture->>'system_id' IS DISTINCT FROM c.system_id::text",
      "r.receipt->'capture'->>'system_id' IS DISTINCT FROM c.system_id::text"]) expect(body).toContain(token);
    for (const name of ["select_arcanum_spell_v1", "resolve_arcanum_selection_v1"]) {
      const replay = arcanumFunctionBody(sql, name);
      expect(replay).not.toContain("c.system_id"); expect(replay).not.toContain("read_locked_arcanum_selection_v1");
    }
  });
});
