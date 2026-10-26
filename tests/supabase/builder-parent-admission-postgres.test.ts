import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

// The full real companion and exact admitted source profiles execute here.
// Auth, complete builder graph admission/materializers, original choice guards
// and B3 plan/journal collaborators are explicit doubles. This is not native
// JWT/compiler/concurrency/provider or actual-app acceptance.
type Json = Record<string, unknown>;
const read = (path: string) => readFileSync(path, "utf8").replaceAll("\r\n", "\n");
const md5 = (text: string) => createHash("md5").update(text).digest("hex");
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const target = id(1), actor = id(2), system = id(3), background = id(4), nextBackground = id(5), acceptance = id(6);
const context = { actor_id: actor, session_id: id(7) };
const stage = read("supabase/staged/character-builder-parent-admission.sql");
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
let operationNumber = 80;
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
    name_snapshot text,data_snapshot jsonb,effects_snapshot jsonb,PRIMARY KEY(content_id,version));
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
  CREATE FUNCTION private.builder_original_occurrence_v1(uuid) RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb';
  CREATE FUNCTION private.builder_progression_scores_v1(uuid,jsonb) RETURNS jsonb LANGUAGE sql AS 'SELECT ''{"constitution":14}''::jsonb';
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

async function install(connection: PGlite, serviceExec = true, authenticatedPrivateUsage = false) {
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
    definition("supabase/staged/character-builder-hp-bonus.sql", "private.builder_multiclass_max_hp_v1").sql,
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
  if (authenticatedPrivateUsage) await connection.exec("GRANT USAGE ON SCHEMA private TO authenticated");
  const schemaBefore = (await connection.query<{ profile: Json }>("SELECT to_jsonb(n) AS profile FROM pg_namespace n WHERE nspname='private'")).rows[0].profile;
  // Model the actual native role profile rather than PGlite's superuser
  // bootstrap identity. The installer session remains independently privileged.
  phase = "native postgres role posture";
  await connection.exec("SET SESSION AUTHORIZATION supabase_admin; ALTER ROLE postgres NOSUPERUSER BYPASSRLS");
  phase = "complete real parent companion";
  await connection.exec(stage);
  await connection.exec("SET ROLE postgres");
  return { schemaBefore };
  } catch (error) {
    const selected = error as { code?: string; message?: string; where?: string; position?: string; internalPosition?: string; internalQuery?: string };
    throw new Error(`Parent fixture ${phase}: ${selected.code ?? "unknown"} ${selected.message ?? "failed"}; ${selected.where ?? "no context"}; position ${selected.position ?? selected.internalPosition ?? "none"}; ${selected.internalQuery?.slice(-300) ?? ""}`);
  }
}

beforeAll(async () => { await install(db); });
afterAll(async () => { await db.close(); });
beforeEach(async () => {
  operationNumber = 80;
  await db.exec(`TRUNCATE public.characters,public.game_systems,public.content_definitions,public.content_versions,public.character_content_refs,public.character_inventory,
    private.character_class_origin_v1,private.character_builder_capabilities_v1,private.character_parent_admissions_v1,private.character_projection_order_v1,
    private.character_builder_receipts_v1,private.class_first_acquisition_proofs_v1,private.class_origin_revision_events_v1,private.test_first_inputs;
    SELECT set_config('test.prune_expertise','off',false);`);
  await db.query("SELECT set_config('test.actor',$1,false),set_config('test.context',$2,false)", [actor, JSON.stringify(context)]);
  await db.query("INSERT INTO public.characters(id,user_id,system_id,name,level,choices,base_stats,state,action_revision) VALUES($1,$2,$3,'Saved notebook',3,$4,$5,$6,10)",
    [target, actor, system, { classes: [{ slug: "bard", level: 3 }], background: "old-background", expertise: ["old-skill"] }, { constitution: 14 }, { current_hp: 21 }]);
  await db.query("INSERT INTO private.character_class_origin_v1 VALUES($1)", [target]);
  await db.query("INSERT INTO public.game_systems VALUES($1,$2)", [system, { ability_scores: ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"].map(slug => ({ slug })) }]);
  for (const [content, slug] of [[background, "old-background"], [nextBackground, "new-background"]]) {
    await db.query("INSERT INTO public.content_definitions VALUES($1,$2,'background',false,1)", [content, system]);
    await db.query("INSERT INTO public.content_versions VALUES($1,1,'background',$2,$3,$2,'{}','[]')", [content, slug, system]);
  }
  await db.query("INSERT INTO public.character_content_refs(id,character_id,content_id,content_version,context,feature_grant_id) VALUES($1,$2,$3,1,'{\"source\":\"background\"}',NULL)", [id(10), target, background]);
  await db.query("INSERT INTO private.character_projection_order_v1 VALUES($1,10,$2,'{}','{}','{}','{}')", [target, [id(10)]]);
});

async function parent(connection = db) { return (await connection.query<{ row: Json }>("SELECT to_jsonb(c)||jsonb_build_object('action_revision',c.action_revision::text) AS row FROM public.characters c WHERE id=$1", [target])).rows[0].row; }
async function administrator(run: () => Promise<void>) {
  await db.exec("SET ROLE supabase_admin");
  try { await run(); } finally { await db.exec("SET ROLE postgres"); }
}
async function order() { return (await db.query<{ row: Json }>("SELECT to_jsonb(o)||jsonb_build_object('producer_revision',o.producer_revision::text) AS row FROM private.character_projection_order_v1 o WHERE character_id=$1", [target])).rows[0].row; }
async function arm(next: Json, correction = false) {
  const before = await parent();
  await db.query("SELECT private.mint_builder_step_v1($1,c,'test') FROM public.characters c WHERE id=$2", [context, target]);
  if (next.state !== undefined) await db.query("UPDATE private.character_builder_capabilities_v1 SET expected_state=$1 WHERE character_id=$2", [next.state, target]);
  if (correction) await db.query("UPDATE private.character_builder_capabilities_v1 SET correction_operation_id=$1 WHERE character_id=$2", [id(99), target]);
  await db.query("SELECT private.seal_builder_parent_admission_v1($1,$2)", [target, { ...before, ...next }]);
}
async function transaction(run: () => Promise<void>) {
  await db.exec("BEGIN");
  try { await run(); await db.exec("COMMIT"); }
  catch (error) { await db.exec("ROLLBACK"); throw error; }
}
async function command(name: string, fields: Json) {
  return (await db.query<{ result: Json }>("SELECT public.character_builder_command_before_catalog_v1($1,$2) AS result",
    [context, { contract_version: 1, operation_id: id(operationNumber++), character_id: target, command: name, fields }])).rows[0].result;
}

describe("finite enrolled parent admission", () => {
  it("installs exact source profiles and preserves original trigger/native revision bodies", async () => {
    expect(md5(revision)).toBe("857950f1a88305838220494f068e5cf5");
    const names = (await db.query<{ tgname: string }>("SELECT tgname FROM pg_trigger WHERE tgrelid='public.characters'::regclass AND NOT tgisinternal ORDER BY tgname")).rows.map(row => row.tgname);
    expect(names[0]).toBe("aaa_enrolled_parent_admission"); expect(names.at(-1)).toBe("zzz_enrolled_parent_observed"); expect(names).toHaveLength(11);
    const source = (await db.query<{ prosrc: string }>("SELECT prosrc FROM pg_proc WHERE oid='public.save_character_abilities(uuid,text,jsonb,text,jsonb)'::regprocedure")).rows[0].prosrc;
    expect(source.indexOf("public.lock_character_parent_write_guard_v1()")).toBeLessThan(source.indexOf("for update;"));
  });
  it.each(["state", "base_stats", "choices", "level", "system_id", "campaign_id", "archived", "user_id", "id", "action_revision"])("refuses direct enrolled %s changes atomically", async field => {
    const before = await parent(), beforeOrder = await order();
    const values: Json = { state: { current_hp: 1 }, base_stats: { constitution: 20 }, choices: {}, level: 4, system_id: id(99), campaign_id: id(99), archived: true, user_id: id(99), id: id(99), action_revision: "11" };
    await expect(db.query(`UPDATE public.characters SET ${field}=$1 WHERE id=$2`, [values[field], target])).rejects.toThrow("enrolled_parent_update_not_admitted");
    expect(await parent()).toEqual(before); expect(await order()).toEqual(beforeOrder);
  });
  it("retains unrelated metadata-only edits and refuses enrolled deletion", async () => {
    await db.query("UPDATE public.characters SET name='Renamed notebook',updated_at=now() WHERE id=$1", [target]);
    expect(await parent()).toMatchObject({ name: "Renamed notebook", action_revision: "10" });
    await expect(db.query("DELETE FROM public.characters WHERE id=$1", [target])).rejects.toThrow("enrolled_parent_delete_unavailable");
  });
  it.each(["authenticated", "service_role"])("refuses actual %s mechanical DML while retaining allowed metadata behavior", async role => {
    await db.exec(`SET ROLE ${role}`);
    try {
      await expect(db.query("UPDATE public.characters SET state='{\"current_hp\":1}' WHERE id=$1", [target])).rejects.toThrow("enrolled_parent_update_not_admitted");
      await expect(db.query("DELETE FROM public.characters WHERE id=$1", [target])).rejects.toThrow("enrolled_parent_delete_unavailable");
      await db.query("UPDATE public.characters SET name='Visible metadata edit' WHERE id=$1", [target]);
    } finally { await db.exec("SET ROLE postgres"); }
    expect(await parent()).toMatchObject({ name: "Visible metadata edit", action_revision: "10", state: { current_hp: 21 } });
  });
  it("keeps actual enrollment visible after restrictive or changed origin SELECT policies", async () => {
    for (const fault of ["restrictive", "changed_read_policy"]) {
      await administrator(async () => {
        if (fault === "restrictive") await db.exec("CREATE POLICY test_parent_origin_hidden ON private.character_class_origin_v1 AS RESTRICTIVE FOR SELECT TO PUBLIC USING(false)");
        else await db.exec("ALTER POLICY class_origin_internal_read ON private.character_class_origin_v1 USING(false)");
      });
      try {
        expect((await db.query<{ enrolled: boolean }>("SELECT private.enrolled_character_parent_v1($1) AS enrolled", [target])).rows[0].enrolled).toBe(true);
        await expect(db.query("UPDATE public.characters SET state='{\"current_hp\":1}' WHERE id=$1", [target])).rejects.toThrow("enrolled_parent_update_not_admitted");
        expect(await parent()).toMatchObject({ action_revision: "10", state: { current_hp: 21 } });
      } finally {
        await administrator(async () => {
          if (fault === "restrictive") await db.exec("DROP POLICY test_parent_origin_hidden ON private.character_class_origin_v1");
          else await db.exec("ALTER POLICY class_origin_internal_read ON private.character_class_origin_v1 USING(true)");
        });
      }
    }
  });
  it("faults on lookup owner or BYPASSRLS posture drift before apparent absence", async () => {
    for (const fault of ["owner", "bypass", "superuser"]) {
      await administrator(async () => {
        if (fault === "owner") await db.exec("ALTER FUNCTION private.enrolled_character_parent_v1(uuid) OWNER TO inkborne_class_origin_owner; GRANT EXECUTE ON FUNCTION private.enrolled_character_parent_v1(uuid) TO postgres");
        else if (fault === "bypass") await db.exec("ALTER ROLE postgres NOBYPASSRLS");
        else await db.exec("ALTER ROLE postgres SUPERUSER");
      });
      try {
        await expect(db.query("SELECT private.enrolled_character_parent_v1($1)", [target])).rejects.toThrow("parent_enrollment_visibility_unavailable");
        await expect(db.query("UPDATE public.characters SET state='{\"current_hp\":1}' WHERE id=$1", [target])).rejects.toThrow("parent_enrollment_visibility_unavailable");
        expect(await parent()).toMatchObject({ action_revision: "10", state: { current_hp: 21 } });
      } finally {
        await administrator(async () => {
          await db.exec("ALTER FUNCTION private.enrolled_character_parent_v1(uuid) OWNER TO postgres; ALTER ROLE postgres NOSUPERUSER BYPASSRLS");
        });
      }
    }
  });
  it("observes an exact native mechanical transition and consumes only after finish", async () => {
    await transaction(async () => {
      await arm({ state: { current_hp: 20 } });
      await db.query("UPDATE public.characters SET state='{\"current_hp\":20}' WHERE id=$1", [target]);
      expect((await db.query<{ phase: string }>("SELECT phase FROM private.character_parent_admissions_v1")).rows).toEqual([{ phase: "observed" }]);
      expect(await parent()).toMatchObject({ action_revision: "11", state: { current_hp: 20 } });
      await db.query("SELECT private.finish_builder_step_v1($1,$2)", [context, target]);
    });
    expect((await db.query<{ count: number }>("SELECT count(*)::integer AS count FROM private.character_parent_admissions_v1")).rows[0].count).toBe(0);
  });
  it("requires a seal even for native no-op UPDATE and refuses caller-assigned revision", async () => {
    await expect(transaction(async () => {
      await db.query("SELECT private.mint_builder_step_v1($1,c,'test') FROM public.characters c WHERE id=$2", [context, target]);
      await db.query("UPDATE public.characters SET name=name WHERE id=$1", [target]);
    })).rejects.toThrow("enrolled_parent_update_not_admitted");
    await expect(transaction(async () => { await arm({ state: { current_hp: 20 } }); await db.query("UPDATE public.characters SET state='{\"current_hp\":20}',action_revision=11 WHERE id=$1", [target]); })).rejects.toThrow("enrolled_parent_update_not_admitted");
  });
  it("rolls back pending, observed and deleted-proof early-return capability leaks at COMMIT", async () => {
    for (const mode of ["pending", "observed", "deleted_proof", "no_proof"]) {
      await expect(transaction(async () => {
        if (mode === "no_proof") await db.query("SELECT private.mint_builder_step_v1($1,c,'test') FROM public.characters c WHERE id=$2", [context, target]);
        else {
          await arm({ state: { current_hp: 20 } });
          if (mode !== "pending") await db.query("UPDATE public.characters SET state='{\"current_hp\":20}' WHERE id=$1", [target]);
          if (mode === "deleted_proof") await db.exec("DELETE FROM private.character_parent_admissions_v1");
        }
      })).rejects.toThrow("parent_admission_unfinished");
      expect(await parent()).toMatchObject({ action_revision: "10", state: { current_hp: 21 } });
    }
  });
  it("allows exact simple ability/equipment paths through preserved invoker validation", async () => {
    expect(await command("save_abilities", { method: "manual", scores: { constitution: 16 }, expected_method: null, expected_scores: { constitution: 14 } })).toMatchObject({ status: "applied" });
    expect(await parent()).toMatchObject({ action_revision: "11", base_stats: { constitution: 16 } });
    expect(await command("select_equipment", { selections: {}, picks: {} })).toMatchObject({ status: "applied" });
    expect(await parent()).toMatchObject({ action_revision: "12" });
  });
  it("observes the actual simple background-choice, narrative and details source sites", async () => {
    await db.query("UPDATE public.content_versions SET effects_snapshot=$1 WHERE content_id=$2", [[{ type: "choice", choice_id: "background-skill", choose: 1, from: ["skill-history"], grant_type: "proficiency" }], background]);
    expect(await command("background_choice", { choice_id: "background-skill", selections: ["skill-history"] })).toMatchObject({ status: "applied" });
    expect(await command("background_narrative", { key: "ideals", values: ["Preserve the notebook"] })).toMatchObject({ status: "applied" });
    await transaction(async () => {
      await db.query("SELECT private.mint_builder_step_v1($1,c,'save_details') FROM public.characters c WHERE id=$2", [context, target]);
      await db.query("SELECT private.apply_builder_details_v1($1,$2)", [target, { name: "Reviewed notebook", alignment: "neutral" }]);
      await db.query("SELECT private.finish_builder_step_v1($1,$2)", [context, target]);
    });
    expect(await parent()).toMatchObject({ name: "Reviewed notebook", action_revision: "13", choices: { ideals: ["Preserve the notebook"], details_confirmed: true } });
  });
  it.each([false, true])("preserves changed-background %s Expertise pruning with one/two native increments", async prune => {
    await db.query("SELECT set_config('test.prune_expertise',$1,false)", [prune ? "on" : "off"]);
    expect(await command("select_background", { content_id: nextBackground, content_version: 1 })).toMatchObject({ status: "applied" });
    expect(await parent()).toMatchObject({ action_revision: prune ? "12" : "11", choices: { background: "new-background" } });
  });
  it.each([false, true])("preserves unchanged-background %s Expertise pruning with zero/one native increments", async prune => {
    await db.query("SELECT set_config('test.prune_expertise',$1,false)", [prune ? "on" : "off"]);
    expect(await command("select_background", { content_id: background, content_version: 1 })).toMatchObject({ status: "applied" });
    expect(await parent()).toMatchObject({ action_revision: prune ? "11" : "10" });
  });
  it("never turns an observed no-write proof into later unsealed UPDATE authority", async () => {
    await expect(transaction(async () => {
      await db.query("SELECT private.mint_builder_step_v1($1,c,'test') FROM public.characters c WHERE id=$2", [context, target]);
      await db.query("SELECT * FROM public.set_character_background($1,$2,1)", [target, background]);
      await db.query("UPDATE public.characters SET state='{\"current_hp\":1}' WHERE id=$1", [target]);
    })).rejects.toThrow("enrolled_parent_update_not_admitted");
  });
  it("uses the actual B3 native observer and preserves later B3 finalizer responsibility", async () => {
    await db.exec("ALTER TABLE public.characters DISABLE TRIGGER ALL; UPDATE public.characters SET choices='{}',base_stats='{}',state='{}',level=1,action_revision=0; ALTER TABLE public.characters ENABLE TRIGGER ALL; UPDATE private.character_projection_order_v1 SET producer_revision=0,pins='{}'");
    const before = await parent(), beforeOrder = await order();
    const payload = { before_parent: { ...before, action_revision: "0" }, before_order: { ...beforeOrder, producer_revision: "0" },
      expected_after_graph: { parent: { ...before, choices: { classes: [{ slug: "bard", level: 1, occurrence_id: id(11) }] }, action_revision: "1" } },
      planned_rows: [], verified_context: context, target_character_id: target, operation_id: id(80) };
    await db.query("INSERT INTO private.test_first_inputs VALUES($1,$2)", [acceptance, payload]);
    await expect(transaction(async () => {
      await db.exec("SET LOCAL ROLE inkborne_class_origin_owner");
      const result = (await db.query<{ result: Json }>("SELECT private.observe_first_class_choices_revision_v1($1,$2) AS result", [context, acceptance])).rows[0].result;
      await db.exec("SET LOCAL ROLE postgres");
      expect(result).toMatchObject({ phase: "assigned", parent: { action_revision: "1" } });
      expect((await db.query<{ count: number }>("SELECT count(*)::integer AS count FROM private.character_parent_admissions_v1")).rows[0].count).toBe(0);
      expect((await db.query<{ phase: string }>("SELECT phase FROM private.class_first_acquisition_proofs_v1")).rows).toEqual([{ phase: "assigned" }]);
      // Full B3 graph/proof finalization is intentionally still its existing
      // native producer's job. A failure after our parent observation rolls back.
      throw Error("later B3 finalizer failed");
    })).rejects.toThrow("later B3 finalizer failed");
    expect(await parent()).toEqual(before); expect(await order()).toEqual(beforeOrder);
  });
  it("keeps native root-only correction revision assignment and exhaustion semantics", async () => {
    await transaction(async () => { await arm({}, true); await db.query("UPDATE public.characters SET choices=choices WHERE id=$1", [target]); await db.query("SELECT private.finish_builder_step_v1($1,$2)", [context, target]); });
    expect(await parent()).toMatchObject({ action_revision: "11" });
    await db.exec("ALTER TABLE public.characters DISABLE TRIGGER ALL; UPDATE public.characters SET action_revision=9223372036854775807; UPDATE private.character_projection_order_v1 SET producer_revision=9223372036854775807; ALTER TABLE public.characters ENABLE TRIGGER ALL");
    await expect(transaction(async () => { await arm({ state: { current_hp: 20 } }); await db.query("UPDATE public.characters SET state='{\"current_hp\":20}' WHERE id=$1", [target]); })).rejects.toThrow("Revision exhausted");
    await transaction(async () => { await arm({}); await db.query("UPDATE public.characters SET choices=choices WHERE id=$1", [target]); await db.query("SELECT private.finish_builder_step_v1($1,$2)", [context, target]); });
  });
  it("limits the exact linked chain to two observed updates and rejects ABA/third writes", async () => {
    await expect(transaction(async () => {
      await arm({ state: { current_hp: 20 } }); await db.query("UPDATE public.characters SET state='{\"current_hp\":20}' WHERE id=$1", [target]);
      await db.query("SELECT private.seal_builder_parent_admission_v1($1,$2)", [target, { ...await parent(), state: { current_hp: 21 } }]);
      await db.query("UPDATE public.characters SET state='{\"current_hp\":21}' WHERE id=$1", [target]);
      await db.query("SELECT private.seal_builder_parent_admission_v1($1,$2)", [target, await parent()]);
    })).rejects.toThrow("parent_admission_chain_unavailable");
  });
  it("preserves unenrolled invoker state CAS and blocks enrolled legacy CAS before mutation", async () => {
    await expect(db.query("SELECT * FROM public.patch_character_state_if_current($1,$2,$3)", [target, { current_hp: 21 }, { current_hp: 20 }])).rejects.toThrow("enrolled_parent_update_not_admitted");
    await db.query("DELETE FROM private.character_class_origin_v1 WHERE character_id=$1", [target]);
    await db.exec("SET ROLE authenticated");
    try { expect((await db.query<{ status: string }>("SELECT * FROM public.patch_character_state_if_current($1,$2,$3)", [target, { current_hp: 21 }, { current_hp: 20 }])).rows[0].status).toBe("applied"); }
    finally { await db.exec("SET ROLE postgres"); }
    expect(await parent()).toMatchObject({ action_revision: "11", state: { current_hp: 20 } });
  });
  it("keeps bridge execution exactly the original invoker role union and never grants private admission", async () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      const row = (await db.query<{ bridge: boolean; seal: boolean; private_usage: boolean }>("SELECT has_function_privilege($1,'public.lock_character_parent_write_guard_v1()','EXECUTE') AS bridge,has_function_privilege($1,'private.seal_builder_parent_admission_v1(uuid,jsonb)','EXECUTE') AS seal,has_schema_privilege($1,'private','USAGE') AS private_usage", [role])).rows[0];
      expect(row).toEqual({ bridge: role !== "anon", seal: false, private_usage: false });
    }
  });
  it("does not grant service bridge execution when neither original invoker RPC grants it", async () => {
    const isolated = new PGlite();
    try {
      await install(isolated, false);
      expect((await isolated.query<{ allowed: boolean }>("SELECT has_function_privilege('service_role','public.lock_character_parent_write_guard_v1()','EXECUTE') AS allowed")).rows[0].allowed).toBe(false);
    } finally { await isolated.close(); }
  });
  it("preserves migration 00041 authenticated schema usage without granting private admission", async () => {
    const isolated = new PGlite();
    try {
      const { schemaBefore } = await install(isolated, true, true);
      const schemaAfter = (await isolated.query<{ profile: Json }>("SELECT to_jsonb(n) AS profile FROM pg_namespace n WHERE nspname='private'")).rows[0].profile;
      expect(schemaAfter).toEqual(schemaBefore);
      for (const role of ["anon", "authenticated", "service_role"]) {
        const profile = (await isolated.query<{ usage: boolean; create: boolean; bridge: boolean; enrollment: boolean; seal: boolean; guard: boolean }>(`
          SELECT has_schema_privilege($1,'private','USAGE') AS usage,has_schema_privilege($1,'private','CREATE') AS create,
            has_function_privilege($1,'public.lock_character_parent_write_guard_v1()','EXECUTE') AS bridge,
            has_function_privilege($1,'private.enrolled_character_parent_v1(uuid)','EXECUTE') AS enrollment,
            has_function_privilege($1,'private.seal_builder_parent_admission_v1(uuid,jsonb)','EXECUTE') AS seal,
            has_function_privilege($1,'private.lock_enrolled_parent_guard_v1()','EXECUTE') AS guard`, [role])).rows[0];
        expect(profile).toEqual({ usage: role === "authenticated", create: false, bridge: role !== "anon", enrollment: false, seal: false, guard: false });
      }
    } finally { await isolated.close(); }
  });
});
