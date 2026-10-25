import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

// Complete real Draconic HP, parent, ancestry and F3 installers execute in order.
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
const racialStage = read("supabase/staged/character-builder-earned-racial-spells.sql");
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

// The actual final normalizer, bonus normalizer and dependency resolver run.
// Auth/initial acquisition/capability minting, feature/expertise/favored choice
// collaborators and physical graph application remain the explicit doubles
// above/below. These cases do not establish JWT/full compiler/receipt acceptance.
const baseline = new PGlite();
const normalizer = "private.prepare_builder_class_feature_choices_v1(uuid,jsonb,jsonb,text,jsonb)";
const normalizerPreimage = "ac38f1a56f22097481aa51ea3472d592", normalizerPostimage = "ecd93787a191f3074ae6b458b763e932";
const raceContent = id(40), raceRoot = id(50), traitContent = id(41), traitRoot = id(51);
const classContent = id(30), classRoot = id(20), original = id(10), secondary = id(11), secondaryRoot = id(21), secondaryContent = id(31);
const contract = { version: 1, source_trait: "infernal-legacy", spellcasting_ability: "charisma", grants: [
  { character_level: 3, spell: "hellish-rebuke", spell_level: 1, cast_level: 2 },
  { character_level: 5, spell: "darkness", spell_level: 2, cast_level: 2 },
] };
let beforeFunctions: Array<{ oid: number; row: Json }>, beforeWires: Array<{ oid: number; row: Json }>;
let savedGraph: Json, savedChoices: Json;
const snapshotTime = "2026-10-25T01:00:00.000001Z", sourceTime = "2026-10-25T01:00:01.000001Z";
const pin = (ref: string, content: string, context: Json, choice_source: string | null = null, version = 1) => ({
  id: ref, character_id: target, content_id: content, content_version: version, feature_grant_id: null, context, choice_source, created_at: snapshotTime,
});
const racePin = (version = 2) => pin(raceRoot, raceContent, { source: "race" }, null, version);
const traitPin = () => pin(traitRoot, traitContent, { source: "racial_trait", root_controller_ref_id: raceRoot }, "builder:racial-trait:infernal-legacy");
const classPin = () => pin(classRoot, classContent, { source: "class", level: 1 });
const occurrence = (which = original, root = classRoot, content = classContent, slug = "warlock") => ({
  id: which, character_id: target, system_id: system, content_id: content, content_version: 1, class_slug: slug,
  lifecycle: "accepted", controller_ref_id: root, subclass_ref_id: null,
});
const choices = (level = 2, race = true) => ({ classes: [{ slug: "warlock", level, occurrence_id: original }], resolved_choices: {}, ...(race ? { race: "tiefling" } : {}) });
const spell = (n: number, source = "racial_trait", group = "race:tiefling", content = id(60), custom_data: Json | null = {
  builder_source_pin_id: traitRoot, builder_root_ref_id: raceRoot, builder_choice_id: null, spellcasting_ability: "charisma",
}) => ({ id: id(n), character_id: target, content_id: content, content_version: 1, name: content === id(60) ? "Thaumaturgy" : "Original ordinary spell",
  class_slug: group, is_known: true, is_prepared: true, always_prepared: source === "racial_trait", in_spellbook: false,
  source, custom_data, created_at: snapshotTime, spell_grant_id: null });
const graph = (spells: Json[] = [spell(70)], racial = true): Json => ({ refs: [classPin(), ...(racial ? [traitPin()] : [])],
  spells, occurrences: [occurrence()], feature_grants: [], spell_grants: [], origin: { original: true }, commands: [], unrelated: { preserved: [1, 2] } });
const earned = (value: Json) => (value.spells as Json[]).filter(row => (row.custom_data as Json | null)?.builder_earned_racial_spell);

async function installBaseline(connection: PGlite, ancestry = true) {
  await install(connection, true, true, ancestry);
  await connection.exec("ALTER TABLE public.content_versions ADD COLUMN created_at timestamptz DEFAULT '2026-10-25T00:00:00Z'");
  await connection.exec(definition("supabase/staged/character-builder-catalog.sql", "private.builder_catalog_dependency_v1").sql);
  await connection.exec(definition("supabase/staged/character-builder-bonus-spells.sql", "private.prepare_builder_bonus_spells_v1").sql);
  let body = functionBody("character-builder-class-feature-choices.sql", "private.prepare_builder_class_feature_choices_v1");
  body = replaceOnce(body, "RETURN pg_catalog.jsonb_build_object('choices',pending_choices,'graph',graph||pg_catalog.jsonb_build_object('refs',refs));",
    "pending_choices:=private.normalize_builder_lore_skills_v1(target,pending_choices,refs||supplemental_refs,strict_choice_id); pending_choices:=private.normalize_builder_expertise_v1(target,pending_choices,refs||supplemental_refs,NULL); projected:=private.prepare_builder_favored_enemies_v1(target,pending_choices,graph||pg_catalog.jsonb_build_object('refs',refs),NULL); RETURN private.prepare_builder_bonus_spells_v1(target,projected->'choices',projected->'graph',NULL,NULL);");
  expect(md5(body)).toBe(normalizerPreimage);
  await connection.exec(`CREATE FUNCTION private.prepare_builder_class_feature_choices_v1(target uuid,pending_choices jsonb,graph jsonb,strict_choice_id text,supplemental_refs jsonb DEFAULT '[]')
    RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $normalizer$${body}$normalizer$;
    CREATE FUNCTION private.normalize_builder_lore_skills_v1(uuid,jsonb,jsonb,text) RETURNS jsonb LANGUAGE sql AS 'SELECT $2';
    CREATE FUNCTION private.prepare_builder_favored_enemies_v1(uuid,jsonb,jsonb,text) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('choices',$2,'graph',$3) $$;
    REVOKE ALL ON FUNCTION private.prepare_builder_class_feature_choices_v1(uuid,jsonb,jsonb,text,jsonb),private.builder_catalog_dependency_v1(uuid,jsonb,text,text),
      private.prepare_builder_bonus_spells_v1(uuid,jsonb,jsonb,text,text) FROM PUBLIC,anon,authenticated,service_role;`);
}
async function profile(connection = db) {
  return (await connection.query<{ oid: number; row: Json }>("SELECT p.oid::integer AS oid,to_jsonb(p) AS row FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private') ORDER BY p.oid")).rows;
}
async function seed(level = 2, spells: Json[] = [spell(70)], version = 2, racial = true, classes?: Json[]) {
  await db.exec(`TRUNCATE public.characters,public.content_versions,public.character_content_refs,public.character_spells,
    private.character_class_origin_v1,private.character_projection_order_v1,private.character_builder_capabilities_v1,private.character_parent_admissions_v1;
    SELECT set_config('test.original','${original}',false),set_config('test.prune_expertise','off',false);`);
  await db.query("SELECT set_config('test.actor',$1,false),set_config('test.context',$2,false)", [actor, JSON.stringify(context)]);
  savedChoices = { ...choices(level, racial), ...(classes ? { classes } : {}) }; savedGraph = graph(spells, racial);
  if (classes?.some(row => row.occurrence_id === secondary)) {
    (savedGraph.refs as Json[]).push(pin(secondaryRoot, secondaryContent, { source: "class", level: 1 }, `builder:class-acquisition:${id(90)}`));
    (savedGraph.occurrences as Json[]).push(occurrence(secondary, secondaryRoot, secondaryContent, "fighter"));
  }
  await db.query("INSERT INTO public.characters(id,user_id,system_id,name,level,choices,base_stats,state,action_revision) VALUES($1,$2,$3,'Original racial source',$4,$5,'{\"constitution\":14}','{\"current_hp\":1}',10)", [target, actor, system, level, savedChoices]);
  const sourceEffects = [{ type: "grant", stat: "spell", value: "thaumaturgy" }, { type: "grant", stat: "spellcasting_ability", value: "charisma" }];
  for (const [content, kind, slug, data, effects, at, rowVersion] of [
    [classContent, "class", "warlock", { levels: Array.from({ length: 20 }, (_, n) => ({ level: n + 1, features: [] })), hit_die: 8 }, [], snapshotTime, 1],
    [secondaryContent, "class", "fighter", { levels: Array.from({ length: 20 }, (_, n) => ({ level: n + 1, features: [] })), hit_die: 10 }, [], snapshotTime, 1],
    [raceContent, "race", "tiefling", { traits: ["infernal-legacy"] }, [], snapshotTime, 1],
    [raceContent, "race", "tiefling", { traits: ["infernal-legacy"], earned_racial_spells: contract }, [], sourceTime, 2],
    [traitContent, "trait", "infernal-legacy", { races: ["tiefling"], subraces: [] }, sourceEffects, snapshotTime, 1],
    [id(60), "spell", "thaumaturgy", { level: 0 }, [], snapshotTime, 1],
    [id(61), "spell", "hellish-rebuke", { level: 1 }, [], snapshotTime, 1],
    [id(62), "spell", "darkness", { level: 2 }, [], snapshotTime, 1],
  ] as const) await db.query("INSERT INTO public.content_versions(content_id,version,content_type_snapshot,slug_snapshot,name_snapshot,system_id_snapshot,data_snapshot,effects_snapshot,created_at) VALUES($1,$2,$3,$4,$4,$5,$6,$7,$8)",
    [content, rowVersion, kind, slug, system, data, effects, at]);
  for (const row of [...savedGraph.refs as Json[], ...(racial ? [racePin(version)] : [])]) {
    await db.query("INSERT INTO public.character_content_refs SELECT * FROM jsonb_populate_record(NULL::public.character_content_refs,$1)", [row]);
  }
  for (const row of spells) await db.query("INSERT INTO public.character_spells SELECT * FROM jsonb_populate_record(NULL::public.character_spells,$1)", [row]);
  await db.query("INSERT INTO private.character_projection_order_v1 VALUES($1,10,'{}','{}','{}','{}','{}')", [target]);
}
async function compile(next: Json = choices(3), projected: Json = savedGraph, supplemental: Json[] = [racePin()], command = "set_class_level") {
  await db.exec("BEGIN");
  try {
    await db.query("INSERT INTO private.character_builder_capabilities_v1(transaction_id,character_id,actor_id,command,context,before_parent,before_order,protected_graph,expected_graph,expected_classes,expected_choices,expected_state,expected_level,expected_name,before_inventory) SELECT pg_current_xact_id(),id,user_id,$2,$3,to_jsonb(c),'{}',$4,$4,choices->'classes',choices,state,level,name,'[]' FROM public.characters c WHERE id=$1", [target, command, context, savedGraph]);
    return (await db.query<{ result: { choices: Json; graph: Json } }>("SELECT private.prepare_builder_class_feature_choices_v1($1,$2,$3,NULL,$4) AS result", [target, next, projected, supplemental])).rows[0].result;
  } finally { await db.exec("ROLLBACK"); }
}
async function initialFive() {
  await seed();
  return (await compile(choices(5))).graph.spells as Json[];
}
beforeAll(async () => {
  await installBaseline(db);
  beforeFunctions = await profile();
  beforeWires = (await db.query<{ oid: number; row: Json }>("SELECT oid::integer AS oid,to_jsonb(t) AS row FROM pg_trigger t ORDER BY oid")).rows;
  await db.exec("SET ROLE supabase_admin"); await db.exec(racialStage); await db.exec("SET ROLE postgres");
  await installBaseline(baseline);
});
afterAll(async () => { await db.close(); await baseline.close(); });
beforeEach(async () => { await seed(); });

describe("finite earned racial spell compiler and real installer", () => {
  it("freezes every preexisting pg_proc attribute/body except the one final-return hook, all wires and closed gates", async () => {
    const after = await profile();
    for (const before of beforeFunctions) {
      const current = after.find(row => row.oid === before.oid)!.row;
      if (before.row.proname === "prepare_builder_class_feature_choices_v1") {
        expect(md5(current.prosrc as string)).toBe(normalizerPostimage);
        expect({ ...current, prosrc: before.row.prosrc }).toEqual(before.row);
      } else expect(current).toEqual(before.row);
    }
    expect((await db.query("SELECT oid::integer AS oid,to_jsonb(t) AS row FROM pg_trigger t ORDER BY oid")).rows).toEqual(beforeWires);
    expect((await db.query("SELECT count(*)::integer AS count FROM private.character_parent_admissions_v1")).rows).toEqual([{ count: 0 }]);
  });
  it("keeps old root v1 cantrip-only at pending character level5", async () => {
    await seed(2, [spell(70)], 1);
    const output = await compile(choices(5), savedGraph, [racePin(1)]);
    expect(earned(output.graph)).toEqual([]); expect(output.graph.spells).toEqual(savedGraph.spells);
  });
  it("keeps a post-first-class no-race builder's real normalizer result without a new original-proof dependency", async () => {
    await seed(1, [], 2, false); await db.exec("SELECT set_config('test.original','',false)");
    const result = await compile(choices(1, false), savedGraph, [], "class_choice");
    expect(result.choices).toEqual(savedChoices); expect(result.graph).toEqual(savedGraph);
  });
  it("earns only Hellish Rebuke at pending total3 and preserves all unrelated graph data and raw inputs", async () => {
    const before = structuredClone(savedGraph), next = choices(3), output = await compile(next);
    expect(output.choices).toEqual(next); expect(savedGraph).toEqual(before); expect({ ...output.graph, spells: before.spells }).toEqual(before);
    expect(earned(output.graph)).toHaveLength(1);
    expect(earned(output.graph)[0]).toMatchObject({ character_id: target, content_id: id(61), content_version: 1, class_slug: "race:tiefling", source: "racial_trait",
      is_known: true, is_prepared: true, always_prepared: true, in_spellbook: false, spell_grant_id: null,
      custom_data: { builder_source_pin_id: traitRoot, builder_root_ref_id: raceRoot, builder_choice_id: null, spellcasting_ability: "charisma",
        builder_earned_racial_spell: { contract_version: 1, grant_key: "infernal-legacy:3:hellish-rebuke", character_level: 3, spell_level: 1, cast_level: 2 } } });
  });
  it("keeps retained IDs/created_at at5→4→3 and prunes only the proved owned tier at3→2", async () => {
    const spells = await initialFive(), originalRows = spells.filter(row => row.source !== "racial_trait" || row.content_id === id(60));
    expect(earned({ spells })).toHaveLength(2); await seed(5, spells);
    const four = await compile(choices(4)); expect(earned(four.graph)).toEqual(earned({ spells }).filter(row => row.content_id === id(61)));
    await seed(4, four.graph.spells as Json[]); const three = await compile(choices(3)); expect(three.graph.spells).toEqual(four.graph.spells);
    await seed(3, three.graph.spells as Json[]); const two = await compile(choices(2)); expect(earned(two.graph)).toEqual([]); expect(two.graph.spells).toEqual(originalRows);
  });
  it("uses pending mixed-class totals for add/remove and never late expected_level or old parent.level", async () => {
    const secondaryPin = pin(secondaryRoot, secondaryContent, { source: "class", level: 1 }, `builder:class-acquisition:${id(90)}`);
    const projected = structuredClone(savedGraph); (projected.refs as Json[]).push(secondaryPin); (projected.occurrences as Json[]).push(occurrence(secondary, secondaryRoot, secondaryContent, "fighter"));
    const mixed = { ...choices(2), classes: [...choices(2).classes, { slug: "fighter", level: 1, occurrence_id: secondary }] };
    expect(earned((await compile(mixed, projected, [racePin()], "add_class")).graph)).toHaveLength(1);
    const five = await initialFive();
    await seed(5, five, 2, true, [...choices(2).classes, { slug: "fighter", level: 3, occurrence_id: secondary }]);
    const removal = structuredClone(savedGraph); removal.refs = (removal.refs as Json[]).filter(row => row.id !== secondaryRoot);
    (removal.occurrences as Json[]).find(row => row.id === secondary)!.lifecycle = "ended";
    expect(earned((await compile(choices(2), removal, [racePin()], "remove_class")).graph)).toEqual([]);
    await seed(5, five);
    const withoutRace = structuredClone(savedGraph); withoutRace.spells = (withoutRace.spells as Json[]).filter(row => row.source !== "racial_trait");
    withoutRace.refs = (withoutRace.refs as Json[]).filter(row => row.id !== traitRoot);
    const cleared = { ...choices(5) } as Json; delete cleared.race;
    expect(earned((await compile(cleared, withoutRace, [], "clear_race")).graph)).toEqual([]);
  });
  it("adds earned rows only after a genuine pending new race projection, without requiring already-written roots", async () => {
    await seed(3, [], 2, false);
    const projected = graph([spell(70)]);
    const output = await compile(choices(3), projected, [racePin()], "select_race");
    expect(earned(output.graph)).toHaveLength(1); expect((output.graph.spells as Json[]).find(row => row.id === id(70))).toEqual(spell(70));
    expect((await db.query("SELECT count(*)::integer AS count FROM public.character_content_refs WHERE context->>'source'='race'")).rows).toEqual([{ count: 0 }]);
  });
  it("preserves an ordinary learned copy of the same spell independently of the racial grant", async () => {
    const ordinary = spell(80, "selection", "warlock", id(61), { builder_class_controller_ref_id: classRoot });
    await seed(2, [spell(70), ordinary]);
    const result = await compile(choices(5)); expect((result.graph.spells as Json[]).find(row => row.id === ordinary.id)).toEqual(ordinary);
    expect(earned(result.graph)).toHaveLength(2);
  });
  it.each(["missing", "flags", "foreign", "source", "group", "metadata", "version", "duplicate", "naked-levelled"])("refuses prior %s claims instead of healing an unrelated mutation", async fault => {
    const rows = await initialFive(), broken = structuredClone(rows), claim = earned({ spells: broken })[0];
    if (fault === "missing") broken.splice(broken.indexOf(claim), 1);
    if (fault === "flags") claim.is_known = false;
    if (fault === "foreign") claim.character_id = id(999);
    if (fault === "source") claim.source = "selection";
    if (fault === "group") claim.class_slug = "warlock";
    if (fault === "metadata") (claim.custom_data as Json).extra = true;
    if (fault === "version") claim.content_version = 2;
    if (fault === "duplicate") broken.push({ ...claim, id: id(998) });
    if (fault === "naked-levelled") delete (claim.custom_data as Json).builder_earned_racial_spell;
    await seed(5, broken);
    await expect(compile(choices(5), savedGraph, [racePin()], "select_subclass")).rejects.toThrow(/builder_earned_racial_/);
  });
  it("refuses a caller-changed incoming earned claim even when old proof is intact", async () => {
    const rows = await initialFive(); await seed(5, rows); const projected = structuredClone(savedGraph);
    earned(projected)[0].is_known = false; await expect(compile(choices(5), projected)).rejects.toThrow("builder_earned_racial_pending_claim_changed");
  });
  it.each([null, {}, { ...contract, version: 2 }, { ...contract, extra: true }, { ...contract, grants: [] }])("refuses malformed explicit contract %j", async value => {
    await db.query("UPDATE public.content_versions SET data_snapshot=jsonb_set(data_snapshot,'{earned_racial_spells}',$1) WHERE content_id=$2 AND version=2", [JSON.stringify(value), raceContent]);
    await expect(compile()).rejects.toThrow("builder_earned_racial_contract_unavailable");
  });
  it.each(["root-context", "trait-context", "trait-source", "trait-grant", "trait-missing", "trait-foreign", "ability", "trait-scope", "duplicate-root", "pending-occurrence", "pending-level"])("refuses %s source/level evidence", async fault => {
    const projected = structuredClone(savedGraph), root = racePin(), trait = (projected.refs as Json[]).find(row => row.id === traitRoot)!;
    if (fault === "root-context") root.context.source = "other";
    if (fault === "trait-context") trait.context = { source: "racial_trait", root_controller_ref_id: id(99) };
    if (fault === "trait-source") trait.choice_source = "other";
    if (fault === "trait-grant") trait.feature_grant_id = id(99);
    if (fault === "trait-missing") projected.refs = (projected.refs as Json[]).filter(row => row.id !== traitRoot);
    if (fault === "trait-foreign") trait.character_id = id(99);
    if (fault === "ability") await db.query("UPDATE public.content_versions SET effects_snapshot='[{\"type\":\"grant\",\"stat\":\"spell\",\"value\":\"thaumaturgy\"},{\"type\":\"grant\",\"stat\":\"spellcasting_ability\",\"value\":\"wisdom\"}]' WHERE content_id=$1", [traitContent]);
    if (fault === "trait-scope") await db.query("UPDATE public.content_versions SET data_snapshot='{\"races\":[\"human\"],\"subraces\":[]}' WHERE content_id=$1", [traitContent]);
    if (fault === "duplicate-root") (projected.refs as Json[]).push({ ...root, id: id(99) });
    if (fault === "pending-occurrence") (projected.occurrences as Json[])[0].lifecycle = "provisional";
    const next: Json = choices(3); if (fault === "pending-level") (next.classes as Json[])[0].level = "3";
    await expect(compile(next, projected, [root])).rejects.toThrow(/builder_(earned_racial_|feature_choice_sources_unavailable)/);
  });
  it("rejects same-slug root version replacement without a correction workflow", async () => {
    await seed(2, [spell(70)], 1); await expect(compile(choices(3), savedGraph, [racePin(2)], "select_race")).rejects.toThrow("builder_earned_racial_root_correction_required");
  });
  it("uses exact root-as-of microseconds rather than the trait cutoff or current spell head", async () => {
    await db.query("INSERT INTO public.content_versions SELECT content_id,2,content_type_snapshot,slug_snapshot,system_id_snapshot,name_snapshot,data_snapshot,effects_snapshot,source_snapshot,scope_snapshot,owner_id_snapshot,$1 FROM public.content_versions WHERE content_id=$2 AND version=1", [sourceTime, id(61)]);
    await db.query("INSERT INTO public.content_versions SELECT content_id,3,content_type_snapshot,slug_snapshot,system_id_snapshot,name_snapshot,data_snapshot,effects_snapshot,source_snapshot,scope_snapshot,owner_id_snapshot,'2026-10-25T01:00:01.000002Z'::timestamptz FROM public.content_versions WHERE content_id=$1 AND version=1", [id(61)]);
    expect(earned((await compile()).graph)[0].content_version).toBe(2);
  });
  it("restores actual parent/ref/spell/capability rows after a compiler failure", async () => {
    const before = (await db.query("SELECT to_jsonb(c) AS row FROM public.characters c")).rows;
    await expect(compile(choices(21))).rejects.toThrow(/builder_earned_racial_/);
    expect((await db.query("SELECT to_jsonb(c) AS row FROM public.characters c")).rows).toEqual(before);
    expect((await db.query("SELECT count(*)::integer AS count FROM private.character_builder_capabilities_v1")).rows).toEqual([{ count: 0 }]);
    expect((await db.query("SELECT to_jsonb(s) AS row FROM public.character_spells s ORDER BY id")).rows).toEqual((savedGraph.spells as Json[]).map(row => ({ row })));
  });
  it.each(["anon", "authenticated", "service_role", "inkborne_class_origin_owner", "inkborne_hit_die_authority_owner"])("grants %s no execution or new authority", async role => {
    expect((await db.query<{ allowed: boolean }>("SELECT has_function_privilege($1,'private.prepare_builder_earned_racial_spells_v1(uuid,jsonb,jsonb,jsonb)','EXECUTE') AS allowed", [role])).rows[0].allowed).toBe(false);
  });
  it.each(["normalizer-body", "normalizer-acl", "ancestry-hp", "parent-wire", "gate"])("rejects installer drift %s atomically", async fault => {
    await baseline.exec("BEGIN; SET LOCAL ROLE supabase_admin");
    try {
      if (fault === "normalizer-body") {
        const row = (await baseline.query<{ definition: string; prosrc: string }>("SELECT pg_get_functiondef(oid) AS definition,prosrc FROM pg_proc WHERE oid=$1::regprocedure", [normalizer])).rows[0];
        await baseline.exec(row.definition.replace(row.prosrc, () => row.prosrc + "\n-- changed\n"));
      }
      if (fault === "normalizer-acl") await baseline.exec(`GRANT EXECUTE ON FUNCTION ${normalizer} TO authenticated`);
      if (fault === "ancestry-hp") await baseline.exec("ALTER FUNCTION private.builder_ancestry_hit_point_bonus_v1(uuid,jsonb) STABLE SECURITY INVOKER");
      if (fault === "parent-wire") await baseline.exec("ALTER TABLE public.characters DISABLE TRIGGER zzz_enrolled_parent_after_revision");
      if (fault === "gate") await baseline.exec("UPDATE private.hit_die_gate_v1 SET enabled=true");
      await expect(baseline.exec(racialStage)).rejects.toThrow(/builder_earned_racial_/);
    } finally { await baseline.exec("ROLLBACK"); }
    expect((await baseline.query("SELECT to_regprocedure('private.prepare_builder_earned_racial_spells_v1(uuid,jsonb,jsonb,jsonb)') AS helper")).rows).toEqual([{ helper: null }]);
  });
  it("rejects before the required ancestry companion, then accepts the exact order and CRLF normalizer", async () => {
    const connection = new PGlite();
    try {
      await installBaseline(connection, false); await connection.exec("SET ROLE supabase_admin");
      await expect(connection.exec(racialStage)).rejects.toThrow("builder_earned_racial_dependency_changed"); await connection.exec("ROLLBACK");
      await connection.exec(ancestryStage);
      const row = (await connection.query<{ definition: string; prosrc: string }>("SELECT pg_get_functiondef(oid) AS definition,prosrc FROM pg_proc WHERE oid=$1::regprocedure", [normalizer])).rows[0];
      await connection.exec(row.definition.replace(row.prosrc, () => row.prosrc.replaceAll("\n", "\r\n")));
      await connection.exec(racialStage);
      const installed = (await connection.query<{ prosrc: string }>("SELECT prosrc FROM pg_proc WHERE oid=$1::regprocedure", [normalizer])).rows[0];
      expect(md5(installed.prosrc)).toBe(normalizerPostimage);
    } finally { await connection.close(); }
  });
});

