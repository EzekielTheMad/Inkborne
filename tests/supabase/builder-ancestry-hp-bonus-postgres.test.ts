import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

// The complete real Draconic HP, parent and ancestry installers execute in order.
// Auth, complete builder graph admission/materializers, original choice guards
// score/original occurrence and B3 plan/journal collaborators are explicit doubles. This is not native
// JWT/compiler/concurrency/provider or actual-app acceptance.
type Json = Record<string, unknown>;
const read = (path: string) => readFileSync(path, "utf8").replaceAll("\r\n", "\n");
const md5 = (text: string) => createHash("md5").update(text).digest("hex");
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const target = id(1), actor = id(2), system = id(3);
const context = { actor_id: actor, session_id: id(7) };
const stage = read("supabase/staged/character-builder-parent-admission.sql");
const ancestryStage = read("supabase/staged/character-builder-ancestry-hp-bonus.sql");
function definition(path: string, name: string) {
  const source = read(path), match = new RegExp(`create(?: or replace)? function ${name.replaceAll(".", "\\.")}\\(`, "i").exec(source);
  if (!match) throw Error(`Missing ${name}`);
  const tail = source.slice(match.index), delimiter = /\bas\s+(\$[a-z_]*\$)/i.exec(tail)!;
  const end = tail.indexOf(delimiter[1], delimiter.index + delimiter[0].length);
  return { sql: tail.slice(0, end + delimiter[1].length + 1), body: tail.slice(delimiter.index + delimiter[0].length, end) };
}
const functionBody = (file: string, name: string) => definition(`supabase/staged/${file}`, name).body;
const dollar = (source: string, prefix: string, tag: string) => {
  const marker = `${prefix}$${tag}$`, start = source.indexOf(marker) + marker.length;
  if (start < marker.length) throw Error(`Missing ${prefix}/${tag}`);
  return source.slice(start, source.indexOf(`$${tag}$`, start));
};
function replaceOnce(source: string, needle: string, insertion: string) {
  if (source.split(needle).length !== 2) throw Error(`Unexpected source fragment ${needle.slice(0, 50)}`);
  return source.replace(needle, () => insertion);
}
function admittedCatalog() {
  let source = functionBody("character-builder-multiclass.sql", "private.apply_builder_catalog_command_v1");
  const choices = read("supabase/staged/character-builder-class-feature-choices.sql");
  for (const tag of ["count", "style"]) {
    const needle = dollar(choices, "needle:=", tag), insertion = dollar(choices, "insertion:=", tag);
    source = replaceOnce(source, needle, insertion + (tag === "count" ? needle : ""));
  }
  const from = source.indexOf("  -- Fighting styles are finite child feature choices on active pinned manifests."),
    to = source.indexOf("  -- Complete subclass manifests retain all frozen grants, activating");
  if (from < 0 || to < from) throw Error("Missing old style block");
  source = source.slice(0, from) + source.slice(to);
  const sort = dollar(choices, "needle:=", "sort");
  source = replaceOnce(source, sort, dollar(choices, "insertion:=", "catalog") + sort);
  if (md5(source) !== "8175fff619fa2ba56962e30fcb04a843") throw Error("Feature-choice profile drift");
  const repair = read("supabase/staged/character-builder-multiclass-integration-repair.sql"), needle = "  -- Retired subclass-owned choices are not carried into a replacement subclass.";
  source = replaceOnce(source, needle, dollar(repair, "revised:=", "pending") + needle);
  if (md5(source) !== "d55825fd6cf14472f9154a363991b62a") throw Error("Catalog profile drift");
  return source;
}
function admittedProgression() {
  let source = functionBody("character-builder-multiclass.sql", "private.apply_builder_progression_graph_v1");
  const needle = "in_spellbook=(entry->>'in_spellbook')::boolean WHERE id=(entry->>'id')::uuid AND character_id=target;";
  source = replaceOnce(source, needle, "in_spellbook=(entry->>'in_spellbook')::boolean,always_prepared=(entry->>'always_prepared')::boolean,custom_data=entry->'custom_data' WHERE id=(entry->>'id')::uuid AND character_id=target;");
  const removal = read("supabase/staged/character-builder-class-removal.sql");
  source = replaceOnce(source, dollar(removal, "needle:=", "apply"), dollar(removal, "insertion:=", "apply"));
  if (md5(source) !== "896866e89cf4c74a7a4098f053f5a1d8") throw Error("Progression profile drift");
  return source;
}
function admittedSimple() {
  const source = functionBody("character-builder-steps.sql", "public.character_builder_command_v1"), expertise = read("supabase/staged/character-builder-expertise.sql");
  const needle = "  saved:=private.finish_builder_step_v1(p_context,target);";
  const result = replaceOnce(source, needle, dollar(expertise, "insertion:=", "background") + needle);
  if (md5(result) !== "8cceb057257f8ce9eed3af251c0c3cb6") throw Error("Simple profile drift");
  return result;
}
const revisionNeedle = "IS DISTINCT FROM (OLD.state,OLD.base_stats,OLD.choices,OLD.level,OLD.system_id,OLD.campaign_id,OLD.archived,OLD.user_id) THEN";
const revision = replaceOnce(functionBody("class-first-acquisition-writer.sql", "private.hit_die_character_revision_v1"), revisionNeedle,
  revisionNeedle.replace(" THEN", " OR private.builder_subclass_update_revision_v1(pg_catalog.to_jsonb(OLD),pg_catalog.to_jsonb(NEW)) THEN"));
const db = new PGlite();
const schema = `CREATE SCHEMA private; CREATE SCHEMA auth;
  CREATE ROLE authenticated NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
  CREATE ROLE inkborne_class_origin_owner NOLOGIN NOBYPASSRLS NOINHERIT; CREATE ROLE inkborne_hit_die_authority_owner NOLOGIN NOBYPASSRLS NOINHERIT;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.actor',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO authenticated,service_role; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,service_role;
  CREATE TABLE public.characters(id uuid PRIMARY KEY,user_id uuid,system_id uuid,campaign_id uuid,name text,archived boolean DEFAULT false,level integer,
    choices jsonb,base_stats jsonb,state jsonb,action_revision bigint,updated_at timestamptz DEFAULT '2026-10-23T00:00:00Z');
  ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY; GRANT SELECT,UPDATE,DELETE ON public.characters TO authenticated,service_role;
  CREATE POLICY owner_select ON public.characters FOR SELECT TO authenticated USING(user_id=auth.uid());
  CREATE POLICY owner_update ON public.characters FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
  CREATE POLICY owner_delete ON public.characters FOR DELETE TO authenticated USING(user_id=auth.uid());
  CREATE TABLE public.game_systems(id uuid PRIMARY KEY,schema_definition jsonb);
  GRANT SELECT ON public.game_systems TO authenticated,service_role;
  CREATE TABLE public.content_versions(content_id uuid,version integer,content_type_snapshot text,slug_snapshot text,system_id_snapshot uuid,
    name_snapshot text,data_snapshot jsonb,effects_snapshot jsonb,source_snapshot text DEFAULT 'srd',scope_snapshot text DEFAULT 'platform',owner_id_snapshot uuid,PRIMARY KEY(content_id,version));
  CREATE TABLE public.content_definitions(id uuid PRIMARY KEY,system_id uuid,content_type text,is_retired boolean,version integer);
  CREATE TABLE public.character_content_refs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),character_id uuid,content_id uuid,content_version integer,context jsonb,
    choice_source text,feature_grant_id uuid,created_at timestamptz DEFAULT now());
  CREATE TABLE public.character_feature_grants(id uuid,character_id uuid,controller_ref_id uuid,controller_type text,controller_slug text,feature_slug text,feature_content_id uuid,feature_version integer,unlock_level integer,created_at timestamptz);
  CREATE TABLE public.character_spell_grants(id uuid,character_id uuid,controller_ref_id uuid,controller_type text,controller_slug text,class_slug text,spell_slug text,spell_content_id uuid,spell_version integer,spell_name text,unlock_level integer,created_at timestamptz);
  CREATE TABLE public.character_spells(id uuid,character_id uuid,content_id uuid,content_version integer,name text,class_slug text,is_known boolean,is_prepared boolean,always_prepared boolean,in_spellbook boolean,source text,custom_data jsonb,created_at timestamptz,spell_grant_id uuid);
  CREATE TABLE public.character_inventory(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),character_id uuid,content_id uuid,content_version integer,name text,content_type text,quantity integer,sort_order integer,created_at timestamptz DEFAULT now(),starting_grant_id uuid);
  CREATE TABLE public.character_starting_grants(id uuid,character_id uuid,grant_kind text,status text,canonical_intent jsonb,receipt jsonb,created_at timestamptz,completed_at timestamptz);
  CREATE TABLE private.character_class_occurrences_v1(id uuid,character_id uuid,system_id uuid,content_id uuid,content_version integer,class_slug text,lifecycle text,controller_ref_id uuid,subclass_ref_id uuid);
  CREATE TABLE private.character_class_origin_v1(character_id uuid PRIMARY KEY);
  ALTER TABLE private.character_class_origin_v1 ENABLE ROW LEVEL SECURITY; ALTER TABLE private.character_class_origin_v1 FORCE ROW LEVEL SECURITY;
  GRANT SELECT ON private.character_class_origin_v1 TO inkborne_class_origin_owner;
  CREATE POLICY class_origin_internal_read ON private.character_class_origin_v1 FOR SELECT TO inkborne_class_origin_owner USING(true);
  CREATE TABLE private.character_builder_capabilities_v1(transaction_id xid8,character_id uuid,actor_id uuid,command text,context jsonb,before_parent jsonb,before_order jsonb,
    protected_graph jsonb,expected_graph jsonb,expected_classes jsonb,expected_choices jsonb,expected_state jsonb,expected_level integer,expected_name text,before_inventory jsonb,
    correction_operation_id uuid,correction_preview_digest text,correction_revision_consumed boolean DEFAULT false,PRIMARY KEY(transaction_id,character_id));
  CREATE TABLE private.character_projection_order_v1(character_id uuid PRIMARY KEY,producer_revision bigint,pins uuid[],inventory uuid[],spells uuid[],feature_grants uuid[],spell_grants uuid[]);
  CREATE TABLE private.character_builder_receipts_v1(actor_id uuid,operation_id uuid,character_id uuid,request jsonb,receipt jsonb,created_at timestamptz,PRIMARY KEY(actor_id,operation_id));
  CREATE TABLE private.character_writer_guard_v1(singleton boolean PRIMARY KEY,marker integer); INSERT INTO private.character_writer_guard_v1 VALUES(true,0);
  ALTER TABLE private.character_writer_guard_v1 ENABLE ROW LEVEL SECURITY;
  GRANT SELECT,UPDATE(marker) ON private.character_writer_guard_v1 TO inkborne_hit_die_authority_owner;
  CREATE POLICY guard_owner ON private.character_writer_guard_v1 TO inkborne_hit_die_authority_owner USING(true) WITH CHECK(true);
  CREATE TABLE private.character_writer_readiness_v1(id integer,ready boolean); INSERT INTO private.character_writer_readiness_v1 SELECT i,false FROM generate_series(1,13)i;
  CREATE TABLE private.class_origin_gate_v1(enabled boolean); INSERT INTO private.class_origin_gate_v1 VALUES(false);
  CREATE TABLE private.hit_die_gate_v1(enabled boolean); INSERT INTO private.hit_die_gate_v1 VALUES(false);
  CREATE TABLE private.class_origin_revision_events_v1(transaction_id xid8,target_character_id uuid,phase text,before_action_revision bigint,after_action_revision bigint,verified_actor_id uuid,before_parent jsonb,expected_after_parent jsonb,acceptance_id uuid);
  CREATE TABLE private.class_first_acquisition_proofs_v1(acceptance_id uuid PRIMARY KEY,transaction_id xid8,target_character_id uuid,verified_actor_id uuid,operation_id uuid,
    mode text,before_action_revision bigint,after_action_revision bigint,before_class_revision bigint,after_class_revision bigint,before_parent jsonb,before_order jsonb,
    expected_after_graph jsonb,planned_rows jsonb,phase text,observed_parent jsonb,observed_order jsonb);
  CREATE TABLE private.test_first_inputs(acceptance_id uuid PRIMARY KEY,payload jsonb);
  GRANT USAGE ON SCHEMA private TO inkborne_class_origin_owner,inkborne_hit_die_authority_owner;
  GRANT SELECT ON private.class_first_acquisition_proofs_v1,private.test_first_inputs TO inkborne_class_origin_owner;
  GRANT SELECT,INSERT,UPDATE ON private.class_first_acquisition_proofs_v1,private.class_origin_revision_events_v1,private.character_projection_order_v1 TO inkborne_hit_die_authority_owner;
  CREATE FUNCTION private.class_first_acquisition_inputs_v1(key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE result jsonb;
    BEGIN SELECT payload INTO result FROM private.test_first_inputs WHERE acceptance_id=key; IF NOT FOUND THEN RAISE EXCEPTION 'first_class_journal_unavailable'; END IF; RETURN result; END $$;
  CREATE FUNCTION private.lock_builder_character_rows_v1(ctx jsonb,target uuid) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
    IF ctx IS DISTINCT FROM current_setting('test.context')::jsonb OR NOT EXISTS(SELECT 1 FROM public.characters WHERE id=target AND user_id=(ctx->>'actor_id')::uuid) THEN RAISE EXCEPTION 'builder_character_unavailable'; END IF; END $$;
  CREATE FUNCTION private.require_character_creation_context_v1(jsonb) RETURNS void LANGUAGE sql AS 'SELECT';
  CREATE FUNCTION private.builder_protected_graph_v1(uuid) RETURNS jsonb LANGUAGE sql AS 'SELECT ''{"retained":true}''::jsonb';
  CREATE FUNCTION private.assert_builder_catalog_graph_v1(uuid,boolean) RETURNS void LANGUAGE sql AS 'SELECT';
  CREATE FUNCTION private.builder_original_occurrence_v1(uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('id',current_setting('test.original',true)) $$;
  CREATE FUNCTION private.builder_progression_scores_v1(uuid,jsonb) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('constitution',COALESCE(NULLIF(current_setting('test.constitution',true),''),'14')::integer) $$;
  CREATE FUNCTION private.can_use_content_version(uuid,uuid,integer) RETURNS boolean LANGUAGE sql AS 'SELECT true';
  CREATE FUNCTION private.character_can_access_content_version(uuid,uuid,integer) RETURNS boolean LANGUAGE sql AS 'SELECT true';
  CREATE FUNCTION private.builder_exact_keys_v1(value jsonb,keys text[]) RETURNS boolean LANGUAGE sql AS $$ SELECT jsonb_typeof(value)='object' AND (SELECT count(*) FROM jsonb_object_keys(value))=cardinality(keys) AND value ?& keys $$;
  CREATE FUNCTION private.builder_uuid_v1(text) RETURNS boolean LANGUAGE sql AS $$ SELECT COALESCE($1 ~ '^[0-9a-f-]{36}$',false) $$;
  CREATE FUNCTION private.builder_string_map_v1(jsonb) RETURNS boolean LANGUAGE sql AS $$ SELECT jsonb_typeof($1)='object' $$;
  CREATE FUNCTION private.normalize_builder_expertise_v1(target uuid,choices jsonb,refs jsonb,strict_choice text) RETURNS jsonb LANGUAGE sql AS $$
    SELECT CASE WHEN current_setting('test.prune_expertise',true)='on' THEN choices-'expertise' ELSE choices END $$;
  CREATE FUNCTION private.begin_builder_step_v1(ctx jsonb,target uuid,command text,authenticated_call boolean) RETURNS public.characters LANGUAGE plpgsql AS $$
    DECLARE parent public.characters; BEGIN PERFORM private.lock_builder_character_rows_v1(ctx,target); SELECT * INTO parent FROM public.characters WHERE id=target; RETURN parent; END $$;
  CREATE FUNCTION private.mint_builder_step_v1(ctx jsonb,parent public.characters,cmd text) RETURNS void LANGUAGE sql AS $$
    INSERT INTO private.character_builder_capabilities_v1(transaction_id,character_id,actor_id,command,context,before_parent,before_order,protected_graph,expected_graph,expected_classes,expected_name,before_inventory)
    SELECT pg_current_xact_id(),parent.id,parent.user_id,cmd,ctx,to_jsonb(parent),(SELECT to_jsonb(o) FROM private.character_projection_order_v1 o WHERE character_id=parent.id),
      private.builder_protected_graph_v1(parent.id),private.builder_protected_graph_v1(parent.id),parent.choices->'classes',parent.name,'[]' $$;
  CREATE FUNCTION private.apply_builder_step_order_v1(target uuid) RETURNS void LANGUAGE sql AS $$ UPDATE private.character_projection_order_v1 SET
    pins=(SELECT COALESCE(array_agg(id ORDER BY id),'{}') FROM public.character_content_refs WHERE character_id=target) WHERE character_id=target $$;
  CREATE FUNCTION private.describe_builder_subclass_update_v1(uuid,uuid,integer) RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb';
  CREATE FUNCTION private.prepare_builder_class_removal_v1(uuid,jsonb) RETURNS void LANGUAGE sql AS 'SELECT';
  CREATE FUNCTION private.builder_subclass_update_revision_v1(before_row jsonb,after_row jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
    IF before_row=after_row AND EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_current_xact_id() AND character_id=(before_row->>'id')::uuid AND correction_operation_id IS NOT NULL AND NOT correction_revision_consumed) THEN
      UPDATE private.character_builder_capabilities_v1 SET correction_revision_consumed=true WHERE transaction_id=pg_current_xact_id() AND character_id=(before_row->>'id')::uuid; RETURN true; END IF; RETURN false; END $$;
  REVOKE ALL ON SCHEMA private FROM PUBLIC,anon,authenticated,service_role;`;

async function install(connection: PGlite, serviceExec = true, withParent = true, withAncestry = true) {
  let phase = "separate bootstrap and native identities";
  try {
  // PostgreSQL protects reserved bootstrap OID10 from demotion. Match the
  // existing native fixture pattern before any app-owned DDL is created.
  await connection.exec("CREATE ROLE supabase_admin SUPERUSER NOLOGIN; SET SESSION AUTHORIZATION supabase_admin; ALTER ROLE postgres RENAME TO fixture_bootstrap_owner; CREATE ROLE postgres SUPERUSER LOGIN; SET SESSION AUTHORIZATION postgres");
  phase = "baseline fixture schema";
  await connection.exec(schema);
  const definitions = [
    definition("supabase/staged/hit-die-authority-and-writers.sql", "private.lock_character_writer_guard_v1").sql,
    definition("supabase/staged/hit-die-authority-and-writers.sql", "private.hit_die_order_revision_rebind_v1").sql,
    definition("supabase/staged/character-builder-multiclass.sql", "private.builder_multiclass_max_hp_v1").sql,
    definition("supabase/staged/character-builder-progression.sql", "private.finish_builder_step_v1").sql,
    definition("supabase/staged/character-builder-catalog.sql", "private.apply_builder_details_v1").sql,
    definition("supabase/staged/character-builder-steps.sql", "public.commit_character_builder_equipment_v1").sql,
    definition("supabase/staged/class-first-acquisition-writer.sql", "private.observe_first_class_choices_revision_v1").sql,
    definition("supabase/migrations/20261010232200_save_character_abilities.sql", "public.save_character_abilities").sql,
    definition("supabase/migrations/20261003223252_conditional_character_state_owner_cas.sql", "public.patch_character_state_if_current").sql,
    definition("supabase/migrations/20260722221534_atomic_background_selection.sql", "public.set_character_background").sql,
    definition("supabase/migrations/20260721224742_restore_feat_choice_rpc_boundary.sql", "public.set_character_asi_choice").sql,
  ];
  for (const sql of definitions) {
    phase = `admitted definition ${/function ([^(]+)/i.exec(sql)?.[1]}`;
    await connection.exec(sql);
  }
  phase = "compiled catalog/progression/simple/revision profiles";
  await connection.exec(`CREATE FUNCTION private.apply_builder_catalog_command_v1(target uuid,command text,fields jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $admitted$${admittedCatalog()}$admitted$;
    CREATE FUNCTION private.apply_builder_progression_graph_v1(target uuid,choices jsonb,state jsonb,level integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $admitted$${admittedProgression()}$admitted$;
    CREATE FUNCTION public.character_builder_command_before_catalog_v1(p_context jsonb,p_request jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $admitted$${admittedSimple()}$admitted$;
    CREATE FUNCTION private.hit_die_character_revision_v1() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $admitted$${revision}$admitted$;`);
  phase = "explicit choice-callback doubles";
  for (const name of ["enforce_asi_choice_map_boundary", "enforce_background_choice_map_boundary", "prune_inactive_asi_choices_before_choices", "prune_inactive_feature_refs_after_choices", "validate_character_content_boundaries"]) {
    await connection.exec(`CREATE FUNCTION private.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;`);
  }
  phase = "baseline owners, trigger wires and ACLs";
  await connection.exec(`ALTER FUNCTION private.lock_character_writer_guard_v1() OWNER TO inkborne_hit_die_authority_owner;
    ALTER FUNCTION private.hit_die_character_revision_v1() OWNER TO inkborne_hit_die_authority_owner;
    ALTER FUNCTION private.hit_die_order_revision_rebind_v1() OWNER TO inkborne_hit_die_authority_owner;
    ALTER FUNCTION private.observe_first_class_choices_revision_v1(jsonb,uuid) OWNER TO inkborne_hit_die_authority_owner;
    GRANT EXECUTE ON FUNCTION private.class_first_acquisition_inputs_v1(uuid) TO inkborne_class_origin_owner,inkborne_hit_die_authority_owner;
    GRANT EXECUTE ON FUNCTION private.require_character_creation_context_v1(jsonb) TO inkborne_hit_die_authority_owner;
    GRANT EXECUTE ON FUNCTION private.builder_subclass_update_revision_v1(jsonb,jsonb) TO inkborne_hit_die_authority_owner;
    GRANT SELECT,UPDATE ON public.characters TO inkborne_hit_die_authority_owner;
    CREATE POLICY authority_select ON public.characters FOR SELECT TO inkborne_hit_die_authority_owner USING(true);
    CREATE POLICY authority_update ON public.characters FOR UPDATE TO inkborne_hit_die_authority_owner USING(true) WITH CHECK(true);
    CREATE TRIGGER enforce_asi_choice_map_boundary BEFORE UPDATE OF choices ON public.characters FOR EACH ROW EXECUTE FUNCTION private.enforce_asi_choice_map_boundary();
    CREATE TRIGGER enforce_background_choice_map_boundary BEFORE INSERT OR UPDATE OF choices ON public.characters FOR EACH ROW EXECUTE FUNCTION private.enforce_background_choice_map_boundary();
    CREATE TRIGGER hit_die_character_revision BEFORE UPDATE ON public.characters FOR EACH ROW EXECUTE FUNCTION private.hit_die_character_revision_v1();
    CREATE TRIGGER hit_die_order_revision_rebind AFTER UPDATE ON public.characters FOR EACH ROW EXECUTE FUNCTION private.hit_die_order_revision_rebind_v1();
    CREATE TRIGGER prune_inactive_asi_choices_before_choices BEFORE UPDATE OF choices ON public.characters FOR EACH ROW EXECUTE FUNCTION private.prune_inactive_asi_choices_before_choices();
    CREATE TRIGGER prune_inactive_feature_refs_after_choices AFTER UPDATE OF choices ON public.characters FOR EACH ROW EXECUTE FUNCTION private.prune_inactive_feature_refs_after_choices();
    CREATE TRIGGER validate_character_content_boundaries AFTER UPDATE OF campaign_id,system_id ON public.characters FOR EACH ROW EXECUTE FUNCTION private.validate_character_content_boundaries();
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC,anon,authenticated,service_role;
    GRANT EXECUTE ON FUNCTION private.observe_first_class_choices_revision_v1(jsonb,uuid) TO inkborne_class_origin_owner;
    REVOKE ALL ON FUNCTION public.character_builder_command_before_catalog_v1(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
    REVOKE ALL ON FUNCTION public.commit_character_builder_equipment_v1(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
    GRANT EXECUTE ON FUNCTION public.commit_character_builder_equipment_v1(jsonb,jsonb) TO service_role;
    REVOKE ALL ON FUNCTION public.save_character_abilities(uuid,text,jsonb,text,jsonb),public.patch_character_state_if_current(uuid,jsonb,jsonb),
      public.set_character_background(uuid,uuid,integer),public.set_character_asi_choice(uuid,text,text,jsonb,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
    GRANT EXECUTE ON FUNCTION public.save_character_abilities(uuid,text,jsonb,text,jsonb),public.patch_character_state_if_current(uuid,jsonb,jsonb),
      public.set_character_background(uuid,uuid,integer),public.set_character_asi_choice(uuid,text,text,jsonb,uuid,integer) TO authenticated;`);
  if (serviceExec) await connection.exec("GRANT EXECUTE ON FUNCTION public.patch_character_state_if_current(uuid,jsonb,jsonb) TO service_role");
  // Model the actual native role profile rather than PGlite's superuser
  // bootstrap identity. The installer session remains independently privileged.
  phase = "native postgres role posture";
  await connection.exec("SET SESSION AUTHORIZATION supabase_admin; ALTER ROLE postgres NOSUPERUSER BYPASSRLS");
  phase = "complete real Draconic HP companion";
  await connection.exec(read("supabase/staged/character-builder-hp-bonus.sql"));
  phase = "complete real parent companion";
  if (withParent) await connection.exec(stage);
  phase = "complete real ancestry companion";
  if (withAncestry) await connection.exec(ancestryStage);
  await connection.exec("SET ROLE postgres");
  } catch (error) {
    const selected = error as { code?: string; message?: string; where?: string; position?: string; internalPosition?: string; internalQuery?: string };
    throw new Error(`Parent fixture ${phase}: ${selected.code ?? "unknown"} ${selected.message ?? "failed"}; ${selected.where ?? "no context"}; position ${selected.position ?? selected.internalPosition ?? "none"}; ${selected.internalQuery?.slice(-300) ?? ""}`);
  }
}

const baseline = new PGlite();
const barbarian = id(10), sorcerer = id(11), barbarianRoot = id(20), sorcererRoot = id(21), subclassRoot = id(22);
const barbarianContent = id(30), sorcererContent = id(31), subclassContent = id(32), raceContent = id(40), subraceContent = id(41);
const raceRoot = id(50), subraceRoot = id(51);
const hpSignature = "private.builder_multiclass_max_hp_v1(uuid,jsonb,jsonb)";
const preimage = "6f4e810b99cfd755babcc0fc058c2431", postimage = "f1e31016bdf00414996ac0853ae5efc2";
let beforeHp: Json, beforeWires: Array<{ row: Json }>, beforeFunctions: Array<{ oid: number; row: Json }>;
function choices(level = 3): Json {
  return { race: "dwarf", subrace: "hill-dwarf", classes: [{ slug: "barbarian", level, occurrence_id: barbarian }], hp_rolls: {} };
}
function graph() {
  return { refs: [{ id: barbarianRoot, character_id: target, content_id: barbarianContent, content_version: 1,
    context: { source: "class", level: 1 }, feature_grant_id: null }],
  occurrences: [{ id: barbarian, character_id: target, system_id: system, content_id: barbarianContent, content_version: 1,
    class_slug: "barbarian", controller_ref_id: barbarianRoot, subclass_ref_id: null, lifecycle: "accepted" }] };
}
function mixedGraph() {
  const value = graph();
  value.refs.push({ id: sorcererRoot, character_id: target, content_id: sorcererContent, content_version: 1,
    context: { source: "class", level: 1 }, feature_grant_id: null });
  value.refs.push({ id: subclassRoot, character_id: target, content_id: subclassContent, content_version: 2,
    context: { source: "subclass", class: "sorcerer" }, feature_grant_id: null,
    choice_source: `builder:subclass:${sorcerer}` } as typeof value.refs[number]);
  value.occurrences.push({ id: sorcerer, character_id: target, system_id: system, content_id: sorcererContent, content_version: 1,
    class_slug: "sorcerer", controller_ref_id: sorcererRoot, subclass_ref_id: subclassRoot as unknown as null, lifecycle: "accepted" });
  return value;
}
async function maximum(next: Json = choices(), pendingGraph: Json = graph()) {
  return (await db.query<{ maximum: number }>("SELECT private.builder_multiclass_max_hp_v1($1,$2,$3) AS maximum", [target, next, pendingGraph])).rows[0].maximum;
}
async function profile(connection: PGlite = db) {
  return (await connection.query<{ row: Json }>("SELECT to_jsonb(p) AS row FROM pg_proc p WHERE oid=$1::regprocedure", [hpSignature])).rows[0].row;
}
async function rollback(run: () => Promise<void>, connection = db) {
  await connection.exec("BEGIN");
  try { await run(); } finally { await connection.exec("ROLLBACK"); }
}
beforeAll(async () => {
  await install(db, true, true, false);
  beforeHp = await profile();
  beforeWires = (await db.query<{ row: Json }>("SELECT to_jsonb(t) AS row FROM pg_trigger t WHERE tgrelid IN ('public.characters'::regclass,'private.character_parent_admissions_v1'::regclass,'private.character_builder_capabilities_v1'::regclass) ORDER BY oid")).rows;
  beforeFunctions = (await db.query<{ oid: number; row: Json }>("SELECT p.oid::integer AS oid,to_jsonb(p) AS row FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private') ORDER BY p.oid")).rows;
  await db.exec("SET ROLE supabase_admin"); await db.exec(ancestryStage); await db.exec("SET ROLE postgres");
  await install(baseline, true, true, false);
});
afterAll(async () => { await db.close(); await baseline.close(); });
beforeEach(async () => {
  await db.exec(`TRUNCATE public.characters,public.content_versions,public.character_content_refs,private.character_class_origin_v1,
    private.character_projection_order_v1,private.character_builder_capabilities_v1,private.character_parent_admissions_v1;
    SELECT set_config('test.constitution','16',false),set_config('test.original','${barbarian}',false);`);
  await db.query("SELECT set_config('test.actor',$1,false),set_config('test.context',$2,false)", [actor, JSON.stringify(context)]);
  await db.query("INSERT INTO public.characters(id,user_id,system_id,name,level,choices,base_stats,state,action_revision) VALUES($1,$2,$3,'Hill control',3,$4,'{\"constitution\":16}','{\"current_hp\":60}',10)", [target, actor, system, choices()]);
  for (const [content, kind, slug, data] of [
    [barbarianContent, "class", "barbarian", { hit_die: 12 }],
    [sorcererContent, "class", "sorcerer", { hit_die: 6, levels: [{ level: 1, subclass_level: true }] }],
    [raceContent, "race", "dwarf", { traits: ["dwarven-resilience"] }],
  ] as const) await db.query("INSERT INTO public.content_versions(content_id,version,content_type_snapshot,slug_snapshot,system_id_snapshot,data_snapshot) VALUES($1,1,$2,$3,$4,$5)", [content, kind, slug, system, data]);
  for (const version of [1, 2]) {
    await db.query("INSERT INTO public.content_versions(content_id,version,content_type_snapshot,slug_snapshot,system_id_snapshot,data_snapshot) VALUES($1,$2,'subrace','hill-dwarf',$3,$4)",
      [subraceContent, version, system, { parent_race: "dwarf", ...(version === 2 ? { hit_points_bonus_per_character_level: 1 } : {}) }]);
    await db.query("INSERT INTO public.content_versions(content_id,version,content_type_snapshot,slug_snapshot,system_id_snapshot,data_snapshot) VALUES($1,$2,'subclass','draconic',$3,$4)",
      [subclassContent, version, system, { parent_class: "sorcerer", levels: [{ level: 1 }], ...(version === 2 ? { hit_points_bonus_per_class_level: 1 } : {}) }]);
  }
  for (const [pin, content, version, kind] of [[raceRoot, raceContent, 1, "race"], [subraceRoot, subraceContent, 2, "subrace"]] as const) {
    await db.query("INSERT INTO public.character_content_refs(id,character_id,content_id,content_version,context,choice_source,feature_grant_id) VALUES($1,$2,$3,$4,$5,NULL,NULL)",
      [pin, target, content, version, { source: kind }]);
  }
  await db.query("INSERT INTO private.character_projection_order_v1 VALUES($1,10,$2,'{}','{}','{}','{}')", [target, [raceRoot, subraceRoot]]);
});

describe("real ordered ancestry HP companion with explicit compiler/Auth doubles", () => {
  it("adds HP38 and retains old immutable root HP35 with byte-identical snapshots", async () => {
    const before = (await db.query("SELECT to_jsonb(v) AS row FROM public.content_versions v ORDER BY content_id,version")).rows;
    expect(await maximum()).toBe(38);
    await db.query("UPDATE public.character_content_refs SET content_version=1,context='{}' WHERE id=$1", [subraceRoot]);
    expect(await maximum()).toBe(35);
    expect((await db.query("SELECT to_jsonb(v) AS row FROM public.content_versions v ORDER BY content_id,version")).rows).toEqual(before);
  });
  it("counts validated pending levels for down/up while the saved parent still has level three", async () => {
    expect(await maximum(choices(1))).toBe(16);
    expect(await maximum(choices(4))).toBe(49); //12+7+7+7 +4*3 +4
    expect((await db.query<{ level: number }>("SELECT level FROM public.characters WHERE id=$1", [target])).rows[0].level).toBe(3);
  });
  it("retains raw rolled/manual contributions and permanent Constitution arithmetic", async () => {
    const next = { ...choices(), hp_rolls: { "barbarian-2": { method: "rolled", value: 12 }, "barbarian-3": { method: "manual", value: 1 } } };
    expect(await maximum(next)).toBe(37);
    await db.exec("SELECT set_config('test.constitution','12',false)"); expect(await maximum(next)).toBe(31);
  });
  it("adds total ancestry once plus owning Sorcerer levels and preserves original occurrence under reordering/removal", async () => {
    const next = { ...choices(), classes: [{ slug: "sorcerer", level: 1, subclass: "draconic", occurrence_id: sorcerer }, ...(choices().classes as Json[])] };
    expect(await maximum(next, mixedGraph())).toBe(47);
    const removed = mixedGraph(); removed.refs = removed.refs.filter(ref => ref.id === barbarianRoot); removed.occurrences[1].lifecycle = "ended";
    expect(await maximum(choices(), removed)).toBe(38);
  });
  it("adds bonuses after ordinary per-level minimums", async () => {
    const next = { ...choices(), classes: [{ slug: "sorcerer", level: 3, subclass: "draconic", occurrence_id: sorcerer }] };
    const pending = mixedGraph(); pending.refs = pending.refs.filter(ref => ref.id !== barbarianRoot); pending.occurrences[0].lifecycle = "ended";
    await db.query("SELECT set_config('test.original',$1,false),set_config('test.constitution','1',false)", [sorcerer]);
    expect(await maximum(next, pending)).toBe(9); //3 minimum gains +3 Draconic +3 ancestry
  });
  it.each([null, 0, 2, -1, 1.5, "1", true, {}, []])("refuses explicit unsupported raw metadata %j", async value => {
    await db.query("UPDATE public.content_versions SET data_snapshot=jsonb_set(data_snapshot,'{hit_points_bonus_per_character_level}',$1) WHERE content_id=$2 AND version=2", [JSON.stringify(value), subraceContent]);
    await expect(maximum()).rejects.toThrow("builder_ancestry_hp_metadata_unavailable");
  });
  it.each(["missing-race", "missing-subrace", "duplicate", "wrong-parent", "wrong-system", "wrong-context", "choice-source", "grant", "foreign-character", "missing-version", "source", "scope"])("refuses %s actual ancestry evidence", async fault => {
    if (fault === "missing-race") await db.query("DELETE FROM public.character_content_refs WHERE id=$1", [raceRoot]);
    if (fault === "missing-subrace") await db.query("DELETE FROM public.character_content_refs WHERE id=$1", [subraceRoot]);
    if (fault === "duplicate") await db.query("INSERT INTO public.character_content_refs SELECT $1,character_id,content_id,content_version,context,choice_source,feature_grant_id,created_at FROM public.character_content_refs WHERE id=$2", [id(99), subraceRoot]);
    if (fault === "wrong-parent") await db.query("UPDATE public.content_versions SET data_snapshot=jsonb_set(data_snapshot,'{parent_race}','\"elf\"') WHERE content_id=$1", [subraceContent]);
    if (fault === "wrong-system") await db.query("UPDATE public.content_versions SET system_id_snapshot=$1 WHERE content_id=$2", [id(99), subraceContent]);
    if (fault === "wrong-context") await db.query("UPDATE public.character_content_refs SET context='{}' WHERE id=$1", [raceRoot]);
    if (fault === "choice-source") await db.query("UPDATE public.character_content_refs SET choice_source='legacy:other' WHERE id=$1", [subraceRoot]);
    if (fault === "grant") await db.query("UPDATE public.character_content_refs SET feature_grant_id=$1 WHERE id=$2", [id(99), subraceRoot]);
    if (fault === "foreign-character") await db.query("UPDATE public.character_content_refs SET character_id=$1 WHERE id=$2", [id(99), subraceRoot]);
    if (fault === "missing-version") await db.query("UPDATE public.character_content_refs SET content_version=99 WHERE id=$1", [subraceRoot]);
    if (fault === "source") await db.query("UPDATE public.content_versions SET source_snapshot='other' WHERE content_id=$1", [subraceContent]);
    if (fault === "scope") await db.query("UPDATE public.content_versions SET scope_snapshot=NULL WHERE content_id=$1", [subraceContent]);
    await expect(maximum()).rejects.toThrow("builder_ancestry_hp_roots_unavailable");
  });
  it("refuses prospective ancestry changes and orphan roots instead of treating them as zero", async () => {
    await expect(maximum({ ...choices(), subrace: "other" })).rejects.toThrow("builder_ancestry_hp_saved_ancestry_required");
    const noSelection = { ...choices() }; delete noSelection.subrace;
    await db.query("UPDATE public.characters SET choices=$1 WHERE id=$2", [noSelection, target]);
    await expect(maximum(noSelection)).rejects.toThrow("builder_ancestry_hp_roots_unavailable");
  });
  it("uses live frozen ancestry rows, never supplied protected-graph ancestry or mutable catalog heads", async () => {
    await db.query("UPDATE public.character_content_refs SET content_version=1 WHERE id=$1", [subraceRoot]);
    const pending = graph(); pending.refs.push({ id: subraceRoot, character_id: target, content_id: subraceContent, content_version: 2,
      context: { source: "subrace", level: 1 }, feature_grant_id: null });
    expect(await maximum(choices(), pending)).toBe(35);
  });
  it("honors readable frozen shared/homebrew roots without a race-name or author-equals-owner exception", async () => {
    const next = { ...choices(), subrace: "reviewed-resilience" };
    await db.query("UPDATE public.characters SET choices=$1 WHERE id=$2", [next, target]);
    await db.query("UPDATE public.content_versions SET slug_snapshot='reviewed-resilience',source_snapshot='homebrew',scope_snapshot='shared',owner_id_snapshot=$1 WHERE content_id=$2", [id(99), subraceContent]);
    expect(await maximum(next)).toBe(38);
  });
  it("preserves the actual parent seal/revision/order path and rolls back a later failure", async () => {
    await db.query("INSERT INTO private.character_class_origin_v1 VALUES($1)", [target]);
    const before = (await db.query("SELECT to_jsonb(c) AS row FROM public.characters c WHERE id=$1", [target])).rows;
    const beforeOrder = (await db.query("SELECT to_jsonb(o) AS row FROM private.character_projection_order_v1 o WHERE character_id=$1", [target])).rows;
    await expect(rollback(async () => {
      const next = choices(1), max = await maximum(next);
      expect(max).toBe(16);
      await db.query("SELECT private.mint_builder_step_v1($1,c,'set_class_level') FROM public.characters c WHERE id=$2", [context, target]);
      await db.query("UPDATE private.character_builder_capabilities_v1 SET expected_state=$1 WHERE character_id=$2", [{ current_hp: max }, target]);
      const expected = { ...before[0].row as Json, choices: next, state: { current_hp: max }, level: 1 };
      await db.query("SELECT private.seal_builder_parent_admission_v1($1,$2)", [target, expected]);
      await db.query("UPDATE public.characters SET choices=$1,state=$2,level=1 WHERE id=$3", [next, { current_hp: max }, target]);
      expect((await db.query<{ action_revision: string }>("SELECT action_revision::text AS action_revision FROM public.characters WHERE id=$1", [target])).rows[0].action_revision).toBe("11");
      await db.query("SELECT private.finish_parent_admission_v1($1,'builder')", [target]);
      await db.query("DELETE FROM private.character_builder_capabilities_v1 WHERE character_id=$1", [target]);
      await db.exec("SELECT 1/0");
    })).rejects.toThrow("division by zero");
    expect((await db.query("SELECT to_jsonb(c) AS row FROM public.characters c WHERE id=$1", [target])).rows).toEqual(before);
    expect((await db.query("SELECT to_jsonb(o) AS row FROM private.character_projection_order_v1 o WHERE character_id=$1", [target])).rows).toEqual(beforeOrder);
    expect((await db.query<{ n: number }>("SELECT ((SELECT count(*) FROM private.character_parent_admissions_v1)+(SELECT count(*) FROM private.character_builder_capabilities_v1))::integer AS n")).rows[0].n).toBe(0);
  });
  it("preserves exact attributes/owner ACL and every pre-existing parent wire while only replacing the calculator body", async () => {
    const before = structuredClone(beforeHp), after = await profile();
    expect(md5(String(before.prosrc))).toBe(preimage); expect(md5(String(after.prosrc))).toBe(postimage);
    const strip = (value: Json) => Object.fromEntries(Object.entries(value).filter(([key]) => key !== "prosrc"));
    expect(strip(after)).toEqual(strip(before));
    expect(after).toMatchObject({ prosecdef: true, provolatile: "s", proconfig: ['search_path=""'] });
    expect((await db.query<{ row: Json }>("SELECT to_jsonb(t) AS row FROM pg_trigger t WHERE tgrelid IN ('public.characters'::regclass,'private.character_parent_admissions_v1'::regclass,'private.character_builder_capabilities_v1'::regclass) ORDER BY oid")).rows).toEqual(beforeWires);
    for (const old of beforeFunctions) {
      const current = (await db.query<{ row: Json }>("SELECT to_jsonb(p) AS row FROM pg_proc p WHERE oid=$1", [old.oid])).rows[0].row;
      expect(String(old.row.proname) === "builder_multiclass_max_hp_v1" ? strip(current) : current).toEqual(String(old.row.proname) === "builder_multiclass_max_hp_v1" ? strip(old.row) : old.row);
    }
    for (const role of ["anon", "authenticated", "service_role", "inkborne_class_origin_owner", "inkborne_hit_die_authority_owner"]) {
      expect((await db.query<{ allowed: boolean }>("SELECT has_function_privilege($1,'private.builder_ancestry_hit_point_bonus_v1(uuid,jsonb)','EXECUTE') AS allowed", [role])).rows[0].allowed).toBe(false);
    }
  });
  it("rejects ancestry-before-parent and subsequently admits the proper chain with normalized CRLF HP source", async () => {
    const connection = new PGlite();
    try {
      await install(connection, true, false, false); await connection.exec("SET ROLE supabase_admin");
      await expect(connection.exec(ancestryStage)).rejects.toThrow("builder_ancestry_hp_installation_unavailable");
      await connection.exec("ROLLBACK");
      expect(md5(String((await profile(connection)).prosrc))).toBe(preimage);
      expect((await connection.query<{ missing: boolean }>("SELECT to_regprocedure('private.builder_ancestry_hit_point_bonus_v1(uuid,jsonb)') IS NULL AS missing")).rows[0].missing).toBe(true);
      const row = (await connection.query<{ definition: string; prosrc: string }>("SELECT pg_get_functiondef(oid) AS definition,prosrc FROM pg_proc WHERE oid=$1::regprocedure", [hpSignature])).rows[0];
      await connection.exec(row.definition.replace(row.prosrc,row.prosrc.replaceAll("\n","\r\n")));
      await connection.exec(stage); await connection.exec(ancestryStage);
      expect(md5(String((await profile(connection)).prosrc))).toBe(postimage);
    } finally { await connection.close(); }
  });
  it.each(["body", "owner", "config", "acl", "trigger", "deferred", "hp-body", "hp-acl", "ready"])("refuses %s profile drift transactionally", async fault => {
    await rollback(async () => {
      await baseline.exec("SET LOCAL ROLE supabase_admin");
      if (fault === "body" || fault === "hp-body") {
        const signature = fault === "body" ? "private.seal_builder_parent_admission_v1(uuid,jsonb)" : hpSignature;
        const row = (await baseline.query<{ definition: string; prosrc: string }>("SELECT pg_get_functiondef(oid) AS definition,prosrc FROM pg_proc WHERE oid=$1::regprocedure", [signature])).rows[0];
        await baseline.exec(row.definition.replace(row.prosrc, row.prosrc + "\n-- profile drift\n"));
      }
      if (fault === "owner") await baseline.exec("ALTER FUNCTION private.seal_builder_parent_admission_v1(uuid,jsonb) OWNER TO inkborne_hit_die_authority_owner");
      if (fault === "config") await baseline.exec("ALTER FUNCTION private.seal_builder_parent_admission_v1(uuid,jsonb) SET search_path=public");
      if (fault === "acl") await baseline.exec("GRANT EXECUTE ON FUNCTION private.seal_builder_parent_admission_v1(uuid,jsonb) TO authenticated");
      if (fault === "trigger") await baseline.exec("ALTER TABLE public.characters DISABLE TRIGGER aaa_enrolled_parent_admission");
      if (fault === "deferred") await baseline.exec("ALTER TABLE private.character_parent_admissions_v1 DISABLE TRIGGER parent_admission_finished");
      if (fault === "hp-acl") await baseline.exec(`GRANT EXECUTE ON FUNCTION ${hpSignature} TO authenticated`);
      if (fault === "ready") await baseline.exec("UPDATE private.character_writer_readiness_v1 SET ready=true WHERE id=1");
      const expected = fault === "ready" ? "builder_ancestry_hp_installation_unavailable" : fault.startsWith("hp-") ? "builder_ancestry_hp_dependency_changed"
        : ["trigger", "deferred"].includes(fault) ? "builder_ancestry_hp_parent_wires_changed" : "builder_ancestry_hp_parent_profile_changed";
      await expect(baseline.exec(ancestryStage)).rejects.toThrow(expected);
    }, baseline);
    expect(md5(String((await profile(baseline)).prosrc))).toBe(preimage);
  });
});
