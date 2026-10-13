import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const stage = read("supabase/staged/class-origin-first-acquisition-prerequisites.sql");
const joint = read("supabase/staged/class-origin-joint-revision.sql");
const p1 = read("supabase/staged/class-origin-producer.sql");
const authority = read("supabase/staged/hit-die-authority-and-writers.sql");
const kernel = read("supabase/staged/hit-die-transaction.sql");
const dependencies = [
  ["lib/character/class-origin-command-schema.ts", "d935b7c1bb14dedce381499ab3f21abb50efa96a"],
  ["supabase/staged/class-origin-producer.sql", "3e39a6c96e638aea87e39ee9fbd34f915a20758d"],
  ["supabase/staged/class-origin-joint-revision.sql", "d07ce2f53b0af06950ae3eb46006906e804701ed"],
  ["supabase/staged/class-origin-fresh-bootstrap.sql", "e0e86688e7d75a392e40edd94165b0445ca41f1d"],
  ["supabase/staged/hit-die-authority-and-writers.sql", "7f8650efc96617063cf03e6ea4c5763f684ce72c"],
  ["supabase/migrations/20260720185127_feature_grant_integrity.sql", "57aeceb8b06aa0dd13a597e3e24747991ef58a73"],
  ["supabase/migrations/20260720185149_feature_spell_grants.sql", "2c1a957971b0b677e48d3303c0ea99c4285b482d"],
  ["supabase/migrations/20260720185305_character_content_boundary_guards.sql", "7a99c4e92fbb3005f13c7fd2052e6d06a96017b5"],
] as const;
function definition(source: string, name: string) {
  const start = source.indexOf(`FUNCTION private.${name}(`);
  const delimiter = source.indexOf("AS $$", start);
  const end = source.indexOf("$$;", delimiter + 5);
  if (start < 0 || delimiter < 0 || end < 0) throw new Error(`Missing actual staged definition ${name}`);
  return { header: source.slice(start, delimiter), body: source.slice(delimiter + 5, end) };
}
const body = (name: string) => definition(stage, name).body;
const owned = [
  ["class_first_acquisition_inputs_v1", "uuid", "inkborne_class_origin_owner"],
  ["observe_first_class_choices_revision_v1", "jsonb,uuid", "inkborne_hit_die_authority_owner"],
  ["class_first_acquisition_proof_guard_v1", "", "inkborne_hit_die_authority_owner"],
  ["class_first_acquisition_observed_v1", "uuid", "inkborne_class_origin_owner"],
  ["assert_first_class_choices_revision_v1", "uuid", "inkborne_class_origin_owner"],
  ["consume_first_class_choices_revision_v1", "uuid", "inkborne_class_origin_owner"],
  ["class_first_acquisition_proof_closure_v1", "", "inkborne_class_origin_owner"],
] as const;

describe("first acquisition prerequisite actual SOURCE/STATIC contract only; SQL never executed", () => {
  it.each(dependencies)("preserves fixed root710 dependency %s", (path, blob) => {
    const bytes = Buffer.from(read(path));
    expect(createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex")).toBe(blob);
    expect(stage).toContain(blob);
  });
  it("binds all 23 bootstrap plus four joint frozen prosrc/config/mode/owner/language declarations", () => {
    const baseline = [...stage.matchAll(/\('private\.([^']+)','([^']+)','([0-9a-f]{32})',(true|false),'([^']+)','([^']+)','([isv])'\)/g)];
    expect(baseline).toHaveLength(23);
    for (const [, signature, owner, md5, isDefiner, language, returnType] of baseline) {
      const name = signature.split("(")[0];
      const original = name === "class_origin_acceptance_guard_v1" ? joint : owner === "inkborne_hit_die_kernel_owner" ? kernel
        : owner === "inkborne_hit_die_authority_owner" ? authority : p1;
      const frozen = definition(original, name);
      expect(createHash("md5").update(frozen.body).digest("hex")).toBe(md5);
      expect(frozen.header.includes("SECURITY DEFINER")).toBe(isDefiner === "true");
      expect(frozen.header.match(/LANGUAGE\s+(\w+)/)?.[1].toLowerCase()).toBe(language);
      expect(frozen.header.match(/RETURNS\s+(\w+)/)?.[1].toLowerCase()).toBe(returnType);
    }
    const added = [...stage.matchAll(/\('private\.([^']+)','([^']+)','([0-9a-f]{32})',(true|false),'([^']+)'\)/g)];
    expect(added).toHaveLength(4);
    for (const [, signature, , md5, isDefiner] of added) {
      const frozen = definition(joint, signature.split("(")[0]);
      expect(createHash("md5").update(frozen.body).digest("hex")).toBe(md5);
      expect(frozen.header.includes("SECURITY DEFINER")).toBe(isDefiner === "true");
    }
    expect(stage).toContain("p.proconfig IS NOT DISTINCT FROM ARRAY['search_path=\"\"']::text[]");
    expect(stage).toContain("l.lanname='plpgsql'");
    expect(stage).toContain("t.tgdeferrable,t.tginitdeferred,t.tgnargs,pg_catalog.encode(t.tgargs,'hex'),t.tgattr::text");
    expect(stage).toContain("Original private bootstrap trigger wiring drift");
    expect(stage).toContain("installation_owner IS DISTINCT FROM current_user::regrole::oid");
    expect(stage).toContain("installation_owner IN(class_oid,authority_oid)");
  });
  it.each(owned)("%s preserves isolated original owner and empty definer search_path", (name, signature, owner) => {
    expect(definition(stage, name).header).toContain("SECURITY DEFINER SET search_path=''");
    expect(stage).toContain(`ALTER FUNCTION private.${name}(${signature}) OWNER TO ${owner};`);
  });
  it("defines one additive transaction and no positive class writer or readiness/Auth activation", () => {
    expect(stage.match(/CREATE FUNCTION private\./g)).toHaveLength(7);
    expect(stage.match(/CREATE OR REPLACE FUNCTION private\./g)).toHaveLength(2);
    expect(stage.trim().endsWith("COMMIT;")).toBe(true);
    expect(stage).not.toMatch(/CREATE ROLE|ALTER ROLE|CREATE FUNCTION public\.|current_setting|set_config|session_user/);
    expect(stage).not.toMatch(/(?:UPDATE|INSERT INTO|DELETE FROM) public\./);
    expect(stage).not.toMatch(/UPDATE private\.(?:class_origin_gate|character_writer_readiness)/);
  });
  it("has exactly two cross-owner helper EXECUTE pairs and bounded new-table rights", () => {
    expect(stage.match(/GRANT EXECUTE ON FUNCTION[^;]+;/g)).toEqual([
      "GRANT EXECUTE ON FUNCTION private.class_first_acquisition_inputs_v1(uuid) TO inkborne_hit_die_authority_owner;",
      "GRANT EXECUTE ON FUNCTION private.observe_first_class_choices_revision_v1(jsonb,uuid) TO inkborne_class_origin_owner;",
    ]);
    expect(stage.match(/GRANT /g)).toHaveLength(5);
    expect(stage).toContain("GRANT UPDATE(phase,observed_parent,observed_order) ON private.class_first_acquisition_proofs_v1");
    expect(stage).not.toMatch(/GRANT[^;]+ON (?:public\.|private\.class_writer|private\.character_class|private\.character_projection)/);
    expect(stage).toContain("FORCE ROW LEVEL SECURITY");
    expect(stage).toContain("AS RESTRICTIVE FOR INSERT TO inkborne_hit_die_authority_owner WITH CHECK(false)");
    expect(stage).toContain("AS RESTRICTIVE FOR UPDATE TO inkborne_hit_die_authority_owner USING(true) WITH CHECK(false)");
    expect(stage).toContain("FROM PUBLIC,anon,authenticated,service_role;");
  });
  it("independently denies class input, native write observation and forged direct proof DML", () => {
    const inputs = body("class_first_acquisition_inputs_v1");
    expect(inputs.indexOf("RAISE EXCEPTION 'first_acquisition_prerequisite_unavailable'", inputs.indexOf("END IF;")))
      .toBeLessThan(inputs.indexOf("SELECT * INTO j"));
    const guard = body("class_first_acquisition_proof_guard_v1");
    expect(guard.indexOf("RAISE EXCEPTION 'first_acquisition_prerequisite_unavailable'"))
      .toBeLessThan(guard.indexOf("inputs:=private.class_first_acquisition_inputs_v1"));
    const observer = body("observe_first_class_choices_revision_v1");
    expect(observer).toContain("PERFORM private.require_verified_hit_die_auth_v1(p_context);");
    expect(observer).toContain("PERFORM private.lock_character_writer_guard_v1();");
    expect(observer).toContain("FOR UPDATE;");
    expect(observer).toContain("pg_catalog.clock_timestamp()>=(p_context->>'jwt_expires_at')::timestamptz");
    expect(observer.indexOf("RAISE EXCEPTION 'first_acquisition_write_provenance_unavailable'"))
      .toBeLessThan(observer.indexOf("SELECT * INTO ordering"));
    expect(observer).not.toMatch(/INSERT INTO|UPDATE (?:public|private)\.|RETURN inputs/);
    expect(observer).toContain("c.action_revision<>(inputs#>>'{before_parent,action_revision}')::bigint+1");
    expect(observer).toContain("IS NOT DISTINCT FROM (pg_catalog.to_jsonb(c)#>'{choices,classes}')");
  });
  it("requires exact genuine empty bootstrap receipt/journal/two consumed proofs, never adopts a legacy class", () => {
    const inputs = body("class_first_acquisition_inputs_v1");
    for (const token of ["original.acceptance_kind='bootstrap_new' AND original.finalized", "matches<>1",
      "bootstrap.before_parent IS NOT NULL OR bootstrap.before_origin IS NOT NULL OR bootstrap.revision_transition_consumed",
      "bootstrap.preinsert_proof->>'transaction_id'", "creation.receipt->>'receipt_kind' IS DISTINCT FROM 'bootstrap_new'",
      "t.relation_key='creation_receipt'", "t.relation_key='origin'", "AND t.consumed",
      "bootstrap.expected_graph->'parent' IS DISTINCT FROM j.before_parent", "j.before_origin->>'creation_provenance' IS DISTINCT FROM 'new_character'",
      "j.receipt#>'{canonical_intent,fields,subclass}' IS DISTINCT FROM 'null'::jsonb", "'producer_revision','0','pins','[]'::jsonb"]) {
      expect(inputs).toContain(token);
    }
  });
  it("binds every observed identity/raw graph/order to protected inputs and actual stored rows", () => {
    const observed = body("class_first_acquisition_observed_v1");
    for (const field of ["transaction_id", "target_character_id", "verified_actor_id", "operation_id"]) {
      expect(observed).toContain(`proof.${field}::text IS DISTINCT FROM inputs->>'${field}'`);
    }
    expect(observed).toContain("proof.transaction_id IS DISTINCT FROM pg_catalog.pg_current_xact_id()");
    expect(observed).toContain("proof.planned_rows IS DISTINCT FROM inputs->'planned_rows'");
    expect(observed).toContain("FROM public.characters c WHERE c.id=proof.target_character_id AND c.user_id=proof.verified_actor_id");
    expect(observed).toContain("graph IS DISTINCT FROM proof.expected_after_graph");
    expect(observed).toContain("SELECT (value->>'id')::uuid FROM pg_catalog.jsonb_array_elements(proof.expected_after_graph->'occurrences')");
    expect(observed).not.toContain("proof.expected_after_graph->'versions'");
    expect(observed).toContain("order_json IS DISTINCT FROM proof.observed_order");
    expect(stage).toContain("<=4194304");
    expect(stage).toContain(">8388608");
    expect(stage).toContain("pg_catalog.jsonb_array_length(j.expected_graph->name)>4096");
    expect(stage).toContain("BETWEEN 1 AND 1024");
  });
  it("first acquisition stays provisional and binds the requested tuple to the exact frozen class controller", () => {
    const inputs = body("class_first_acquisition_inputs_v1");
    for (const token of ["occurrence->>'lifecycle' IS DISTINCT FROM 'provisional'", "occurrence->'accepted_at' IS DISTINCT FROM 'null'::jsonb",
      "occurrence->'acquired_character_level' IS DISTINCT FROM 'null'::jsonb", "occurrence->'acquisition_operation_id' IS DISTINCT FROM 'null'::jsonb",
      "occurrence->>'content_id' IS DISTINCT FROM j.receipt#>>'{canonical_intent,fields,content_id}'",
      "occurrence->>'system_id' IS DISTINCT FROM j.before_parent->>'system_id'", "ref->'id'=occurrence->'controller_ref_id'",
      "version->>'system_id_snapshot'=j.before_parent->>'system_id'", "version->>'slug_snapshot'=occurrence->>'class_slug'",
      "IF matches<>1 THEN RAISE EXCEPTION 'Frozen exact first controller version required'"]) expect(inputs).toContain(token);
  });
  it("consumption uses pre-finalized observation; final closure separately requires retained receipt/common graph", () => {
    const observed = body("class_first_acquisition_observed_v1");
    expect(observed).not.toMatch(/\.finalized|\.revision_transition_consumed|FROM private.character_class_commands/);
    const consume = body("consume_first_class_choices_revision_v1");
    expect(consume).toContain("PERFORM private.class_first_acquisition_observed_v1(p_acceptance);");
    expect(consume).toContain("AND NOT finalized AND NOT revision_transition_consumed");
    expect(consume).toContain("IF changed<>1");
    expect(consume).not.toContain("assert_first_class_choices_revision_v1");
    const finalized = body("assert_first_class_choices_revision_v1");
    expect(finalized).toContain("NOT j.finalized OR NOT j.revision_transition_consumed");
    expect(finalized).toContain("command.receipt=j.receipt");
    expect(finalized).toContain("private.class_origin_assert_common_v1(p_acceptance)");
    expect(body("class_first_acquisition_proof_closure_v1")).toContain("private.assert_first_class_choices_revision_v1(NEW.acceptance_id)");
    expect(stage).toContain("DEFERRABLE INITIALLY DEFERRED FOR EACH ROW");
  });
  it("changes only the two approved callback dispatch points and preserves all original bodies/modes", () => {
    const originalGuard = definition(joint, "class_origin_acceptance_guard_v1");
    const newGuard = definition(stage, "class_origin_acceptance_guard_v1");
    expect(newGuard.header).toBe(originalGuard.header);
    const expectedGuard = originalGuard.body.replace("      PERFORM private.class_origin_observed_revision_v1(NEW.acceptance_id);", [
      "      IF NEW.receipt#>>'{canonical_intent,command}'='add_class' THEN",
      "        PERFORM private.class_first_acquisition_observed_v1(NEW.acceptance_id);",
      "      ELSIF NEW.receipt#>>'{canonical_intent,command}'='confirm_origin' THEN",
      "        PERFORM private.class_origin_observed_revision_v1(NEW.acceptance_id);",
      "      ELSE RAISE EXCEPTION 'Class command prerequisite unavailable' USING ERRCODE='P0001'; END IF;",
    ].join("\n"));
    expect(newGuard.body).toBe(expectedGuard);
    const originalFinal = definition(joint, "class_origin_finalize_transition_v1");
    const newFinal = definition(stage, "class_origin_finalize_transition_v1");
    expect(newFinal.header).toBe(originalFinal.header);
    expect(newFinal.header).not.toContain("SECURITY DEFINER");
    expect(newFinal.body).toBe(originalFinal.body.replace("  PERFORM private.class_origin_assert_metadata_revision_v1(p_acceptance);", [
      "  SELECT * INTO j FROM private.class_writer_acceptance_v1 WHERE acceptance_id=p_acceptance;",
      "  IF NOT FOUND THEN RAISE EXCEPTION 'Exact acceptance required' USING ERRCODE='23514'; END IF;",
      "  IF j.receipt#>>'{canonical_intent,command}'='add_class' THEN",
      "    PERFORM private.assert_first_class_choices_revision_v1(p_acceptance);",
      "  ELSIF j.receipt#>>'{canonical_intent,command}'='confirm_origin' THEN",
      "    PERFORM private.class_origin_assert_metadata_revision_v1(p_acceptance);",
      "  ELSE RAISE EXCEPTION 'Class command prerequisite unavailable' USING ERRCODE='P0001'; END IF;",
    ].join("\n")));
    expect(stage).not.toContain("CREATE OR REPLACE FUNCTION private.hit_die_character_revision_v1");
    expect(stage).not.toContain("CREATE OR REPLACE FUNCTION private.class_origin_finalize_bootstrap_v1");
  });
  it("preserves original receipt-first/current-owner/native-expiry recovery without adding an issuer", () => {
    const confirmation = read("supabase/staged/class-origin-confirmation-producer.sql");
    const fresh = read("supabase/staged/class-origin-fresh-bootstrap.sql");
    expect(confirmation.indexOf("SELECT command.receipt INTO previous")).toBeLessThan(confirmation.indexOf("sources:=private.lock_class_confirmation_sources_v1"));
    expect(fresh.indexOf("-- FIRST recovery")).toBeLessThan(fresh.indexOf("-- Unreachable REAL transaction body"));
    expect(stage).not.toMatch(/CREATE(?: OR REPLACE)? FUNCTION private\.(?:confirm_already|create_empty|resolve_empty|require_class_origin_auth)/);
  });
});
