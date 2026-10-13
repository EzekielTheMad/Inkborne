import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

const stage = readFileSync("supabase/staged/class-origin-fresh-bootstrap.sql", "utf8").replace(/\r\n/g, "\n");
const p1 = readFileSync("supabase/staged/class-origin-producer.sql", "utf8").replace(/\r\n/g, "\n");
const joint = readFileSync("supabase/staged/class-origin-joint-revision.sql", "utf8").replace(/\r\n/g, "\n");
const authority = readFileSync("supabase/staged/hit-die-authority-and-writers.sql", "utf8").replace(/\r\n/g, "\n");
const kernel = readFileSync("supabase/staged/hit-die-transaction.sql", "utf8").replace(/\r\n/g, "\n");
const owned = [
  ["class_origin_empty_parent_allowed_v1", "public.characters", "inkborne_class_origin_owner"],
  ["class_origin_empty_order_allowed_v1", "private.character_projection_order_v1", "inkborne_class_origin_owner"],
  ["class_origin_empty_order_inputs_v1", "uuid", "inkborne_class_origin_owner"],
  ["class_bootstrap_verified_prefix_v1", "jsonb", "inkborne_hit_die_authority_owner"],
  ["lock_class_bootstrap_system_v1", "jsonb,uuid", "inkborne_hit_die_authority_owner"],
  ["initialize_empty_class_order_v1", "uuid", "inkborne_hit_die_authority_owner"],
  ["create_empty_class_origin_character_v1", "jsonb,jsonb", "inkborne_class_origin_owner"],
  ["resolve_empty_class_origin_creation_v1", "jsonb,uuid", "inkborne_class_origin_owner"],
] as const;
function definition(source: string, name: string) {
  const start = source.indexOf(`FUNCTION private.${name}(`);
  const bodyStart = source.indexOf("AS $$", start) + 5;
  const end = source.indexOf("$$;", bodyStart);
  if (start < 0 || bodyStart < 5 || end < 0) throw new Error(`Missing source definition ${name}`);
  return { header: source.slice(start, bodyStart - 5), body: source.slice(bodyStart, end) };
}
const body = (name: string) => definition(stage, name).body;

describe("fresh bootstrap actual staged source STATIC controls; NO SQL/native authority proof", () => {
  it("binds fixed production dependency Git blobs without spawning Git/runtime", () => {
    for (const [path, blob] of [
      ["supabase/staged/class-origin-producer.sql", "3e39a6c96e638aea87e39ee9fbd34f915a20758d"],
      ["supabase/staged/class-origin-joint-revision.sql", "d07ce2f53b0af06950ae3eb46006906e804701ed"],
      ["supabase/staged/class-origin-confirmation-producer.sql", "7d0d7db1d3988e94de5143b84e7f3c89b8cb3176"],
      ["supabase/staged/hit-die-authority-and-writers.sql", "7f8650efc96617063cf03e6ea4c5763f684ce72c"],
      ["supabase/staged/hit-die-transaction.sql", "5d9fc835b0b8b957ca88e8fedf2ff6cc4b752faf"],
      ["lib/character/class-origin-command-schema.ts", "d935b7c1bb14dedce381499ab3f21abb50efa96a"],
    ]) {
      const bytes = Buffer.from(readFileSync(path, "utf8").replace(/\r\n/g, "\n"));
      expect(createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex")).toBe(blob);
      expect(stage).toContain(blob);
    }
  });
  it("checks 23 actual frozen function bodies/owner modes and existing effective privileges", () => {
    const tuples = [...stage.matchAll(/\('private\.([^']+)','([^']+)','([0-9a-f]{32})',(true|false)\)/g)];
    expect(tuples).toHaveLength(23);
    for (const [, signature, owner, md5, isDefiner] of tuples) {
      const name = signature.split("(")[0];
      const source = name === "class_origin_acceptance_guard_v1" ? joint : owner === "inkborne_hit_die_kernel_owner" ? kernel
        : owner === "inkborne_hit_die_authority_owner" ? authority : p1;
      const frozen = definition(source, name);
      expect(createHash("md5").update(frozen.body).digest("hex")).toBe(md5);
      expect(frozen.header.includes("SECURITY DEFINER")).toBe(isDefiner === "true");
    }
    expect(stage).toContain("p.prosecdef=item.is_definer");
    expect(stage).toContain("has_function_privilege(CASE WHEN item.owner_name");
    expect(stage).toContain("'private.hit_die_exact_keys_v1(jsonb,text[])','inkborne_hit_die_kernel_owner'");
    expect(stage).toContain("'private.hit_die_native_v1(timestamp with time zone)','inkborne_hit_die_kernel_owner'");
  });
  it.each(owned)("%s has exact original SECURITY DEFINER owner and empty qualified search_path", (name, signature, owner) => {
    expect(definition(stage, name).header).toContain("SECURITY DEFINER SET search_path=''");
    expect(stage).toContain(`ALTER FUNCTION private.${name}(${signature}) OWNER TO ${owner};`);
    expect(stage).toContain(`private.${name}(${signature})`);
  });
  it("defines only eight additive functions and no original role/helper replacements", () => {
    expect(stage.match(/CREATE FUNCTION private\./g)).toHaveLength(8);
    expect(stage).not.toMatch(/CREATE OR REPLACE|CREATE ROLE|ALTER ROLE|CREATE FUNCTION public\.|current_setting|session_user/);
    expect(stage.trim().endsWith("COMMIT;")).toBe(true);
    expect(stage).toContain("SET LOCAL search_path='';");
  });
  it("closes exactly five EXECUTE pairs without extra journal/system/finalizer grants", () => {
    const grants = stage.match(/GRANT EXECUTE ON FUNCTION[^;]+;/g);
    expect(grants).toEqual([
      "GRANT EXECUTE ON FUNCTION private.class_origin_empty_order_allowed_v1(private.character_projection_order_v1),private.class_origin_empty_order_inputs_v1(uuid) TO inkborne_hit_die_authority_owner;",
      "GRANT EXECUTE ON FUNCTION private.class_bootstrap_verified_prefix_v1(jsonb),private.lock_class_bootstrap_system_v1(jsonb,uuid),private.initialize_empty_class_order_v1(uuid) TO inkborne_class_origin_owner;",
    ]);
    expect(stage.match(/GRANT /g)).toHaveLength(4);
    expect(stage).not.toMatch(/GRANT (?:SELECT|UPDATE|DELETE|ALL|USAGE)\b/);
    expect(stage).toContain("FROM PUBLIC,anon,authenticated,service_role;");
  });
  it.each(["class_origin_empty_parent_allowed_v1", "class_origin_empty_order_allowed_v1"])("%s denies even a self-consistent forged journal before structural inspection", name => {
    const sql = body(name);
    expect(sql).toContain("WHERE singleton AND enabled) THEN RETURN false; END IF;");
    expect(sql).toMatch(/END IF;\s+RETURN false; -- Native bootstrap admission is unconditionally unavailable\./);
    expect(sql.indexOf("RETURN false; -- Native")).toBeLessThan(sql.indexOf("PERFORM private.lock_character_writer_guard_v1"));
  });
  it("order helper cannot bypass the independently unavailable class input validator", () => {
    const input = body("class_origin_empty_order_inputs_v1");
    expect(input).toContain("WHERE singleton AND enabled) THEN RAISE EXCEPTION 'bootstrap_admission_unavailable'");
    expect(input).toMatch(/END IF;\s+RAISE EXCEPTION 'bootstrap_admission_unavailable'/);
    expect(input.indexOf("RAISE EXCEPTION 'bootstrap_admission_unavailable'")).toBeLessThan(input.indexOf("SELECT * INTO j"));
    const order = body("initialize_empty_class_order_v1");
    expect(order.indexOf("inputs:=private.class_origin_empty_order_inputs_v1(p_acceptance)")).toBeLessThan(order.indexOf("INSERT INTO private.character_projection_order_v1"));
  });
  it("keeps unavailable original Auth/class gate/all13false and rejects RLS owner/hidden absence drift", () => {
    expect(p1).toContain("RAISE EXCEPTION 'auth_unavailable'"); expect(authority).toContain("RAISE EXCEPTION 'auth_unavailable'");
    expect(stage).toContain("relowner IN(class_oid,authority_oid) OR NOT relrowsecurity");
    expect(stage).toContain("roleid IN(class_oid,authority_oid) OR member IN(class_oid,authority_oid)");
    expect(stage).toContain("NOT polpermissive"); expect(stage).toContain("Native absence visibility drift");
    expect(stage).toContain("private.class_origin_gate_v1 WHERE singleton AND NOT enabled");
    expect(stage).toContain("private.character_writer_readiness_v1)<>13");
    expect(stage).not.toMatch(/UPDATE private\.(?:class_origin_gate|character_writer_readiness)|INSERT INTO private\.character_writer_readiness/);
  });
  it("uses only 15 non-revision parent columns and eight order columns with two guarded policy checks each", () => {
    expect(stage).toContain("GRANT INSERT(id,user_id,system_id,campaign_id,name,visibility,archived,created_at,level,base_stats,choices,state,narrative,narrative_rich,primary_color) ON public.characters TO inkborne_class_origin_owner;");
    expect(stage).toContain("GRANT INSERT(character_id,producer_version,producer_revision,pins,inventory,spells,feature_grants,spell_grants) ON private.character_projection_order_v1 TO inkborne_hit_die_authority_owner;");
    expect(stage.match(/WITH CHECK\(private.class_origin_empty_parent_allowed_v1\(characters\)\)/g)).toHaveLength(2);
    expect(stage.match(/WITH CHECK\(private.class_origin_empty_order_allowed_v1\(character_projection_order_v1\)\)/g)).toHaveLength(2);
    expect(stage.match(/AS RESTRICTIVE FOR INSERT/g)).toHaveLength(2);
    expect(stage.indexOf("GRANT INSERT")).toBeGreaterThan(stage.indexOf("CREATE FUNCTION private.resolve_empty_class_origin_creation_v1"));
  });
  it("preserves real preinsert journal constraints and original immediate/deferred bootstrap finalizer", () => {
    const journal = p1.slice(p1.indexOf("CREATE TABLE private.class_writer_acceptance_v1"), p1.indexOf("CREATE TABLE private.class_writer_row_transitions_v1"));
    expect(journal).not.toContain("REFERENCES public.characters");
    expect(p1).toContain("REFERENCES private.class_writer_acceptance_v1(acceptance_id) ON DELETE RESTRICT");
    expect(stage).toContain("Preinsert journal RI ordering drift"); expect(stage).toContain("Immediate target FK required");
    expect(stage).toContain("tgdeferrable AND tginitdeferred");
    expect(stage).not.toMatch(/ALTER TABLE|CREATE TRIGGER|CREATE CONSTRAINT TRIGGER/);
    expect(body("create_empty_class_origin_character_v1")).toContain("PERFORM private.class_origin_finalize_acceptance_v1(acceptance)");
    expect(p1).toContain("PERFORM private.class_origin_finalize_bootstrap_v1(p_acceptance)");
  });
  it("actual transaction journal/proof INSERTs precede native parent, origin/receipt/order and finalization", () => {
    const sql = body("create_empty_class_origin_character_v1");
    const positions = ["INSERT INTO private.class_writer_acceptance_v1", "INSERT INTO private.class_writer_row_transitions_v1",
      "INSERT INTO public.characters", "RETURNING * INTO inserted", "INSERT INTO private.character_class_origin_v1",
      "INSERT INTO private.character_creation_commands_v1", "order_json:=private.initialize_empty_class_order_v1(acceptance)",
      "private.class_origin_read_final_graph_v1(target,ARRAY[]::uuid[])", "SET finalized=true", "PERFORM private.class_origin_finalize_acceptance_v1(acceptance)"]
      .map(token => sql.indexOf(token));
    expect(positions.every(at => at >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(sql).toContain("'bootstrap_new',NULL,NULL,NULL,expected_graph,transitions,receipt");
    expect(sql).toContain("target:=pg_catalog.gen_random_uuid(); acceptance:=pg_catalog.gen_random_uuid(); accepted:=pg_catalog.clock_timestamp()");
    expect(sql).toContain("c.created_at:=pg_catalog.transaction_timestamp()");
    expect(sql).toContain("'initial_action_revision','0','initial_class_revision','0','initial_producer_revision','0'");
    expect(sql).not.toMatch(/UPDATE public\.characters|SET consumed|revision_transition_consumed=true|class_origin_revision_events/);
    expect(sql).not.toContain("INSERT INTO private.character_class_occurrences_v1");
    expect(sql).not.toContain("INSERT INTO public.character_content_refs");
  });
  it("actual order reads all five source domains and retained occurrences rather than inferring emptiness", () => {
    const sql = body("initialize_empty_class_order_v1");
    for (const domain of ["content_refs", "inventory", "spells", "feature_grants", "spell_grants"]) expect(sql).toContain(`FROM public.character_${domain} WHERE character_id=c.id`);
    expect(body("class_origin_empty_order_inputs_v1")).toContain("FROM private.character_class_occurrences_v1 WHERE character_id=j.target_character_id");
    expect(sql).toContain("VALUES(c.id,1,0,ARRAY[]::uuid[],ARRAY[]::uuid[],ARRAY[]::uuid[],ARRAY[]::uuid[],ARRAY[]::uuid[])");
    expect(sql).toContain("RETURNING * INTO ordering"); expect(sql).not.toMatch(/\bUPDATE\s+(?:public|private)\.|ON CONFLICT/);
  });
  it("receipt-FIRST replay retains historical evidence before all NEW gates/source/system/revision", () => {
    const sql = body("create_empty_class_origin_character_v1");
    const replay = sql.slice(sql.indexOf("SELECT creation.* INTO prior"), sql.indexOf("IF p_intent#>'{fields,campaign_id}'"));
    expect(replay).toContain("FOR UPDATE"); expect(replay).toContain("j.finalized AND j.receipt=prior.receipt");
    expect(replay).toContain("completed.preinsert_proof->>'transaction_id' IS DISTINCT FROM completed.transaction_id::text");
    expect(replay).toContain("NOT consumed OR before_row IS NOT NULL");
    expect(replay).toContain("'status','recorded','receipt',prior.receipt");
    expect(replay).not.toContain("WHERE singleton AND enabled"); expect(replay).not.toContain("lock_class_bootstrap_system_v1");
    expect(replay).not.toContain("c.action_revision"); expect(replay).not.toContain("class_origin_read_final_graph_v1");
    expect(replay.lastIndexOf("class_bootstrap_verified_prefix_v1(p_context)")).toBeGreaterThan(replay.indexOf("result:="));
    expect(replay.lastIndexOf("pg_catalog.clock_timestamp()>=" )).toBeGreaterThan(replay.indexOf("result:="));
  });
  it("resolve shares native Auth/guard/history/terminal expiry, absence never executes NEW creation", () => {
    const sql = body("resolve_empty_class_origin_creation_v1");
    expect(sql).toContain("creation.verified_actor_id=actor AND creation.operation_id=p_operation");
    expect(sql).toContain("WHERE id=prior.target_character_id AND user_id=actor FOR UPDATE");
    expect(sql).toContain("t.acceptance_id=completed.acceptance_id ORDER BY t.relation_key,t.row_key FOR SHARE");
    expect(sql).toContain("result:='{\"status\":\"absent\"}'::jsonb");
    expect(sql.lastIndexOf("pg_catalog.clock_timestamp()>=" )).toBeGreaterThan(sql.indexOf("result:="));
    expect(sql).not.toMatch(/INSERT INTO|\bUPDATE\s+(?:public|private)\.|lock_class_bootstrap_system_v1|WHERE singleton AND enabled/);
  });
});
