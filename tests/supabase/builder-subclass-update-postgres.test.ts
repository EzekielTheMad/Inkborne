import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

// Actual new SQL descriptor/wrapper/revision profile with finite Auth and graph
// writer collaborators. Real JWT/grants/triggers/compiler and browser acceptance
// are separate disposable-runtime gates, not established by these doubles.
const db = new PGlite();
type Json = Record<string, unknown>;
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const actor = id(1), target = id(2), system = id(3), occurrence = id(4), root = id(5), subclass = id(6), subclassContent = id(7);
const context = { actor_id: actor, session_id: id(8) };
const choices = { classes: [{ slug: "warlock", level: 3, subclass: "fiend", occurrence_id: occurrence }],
  hp_rolls: { "warlock-2": { method: "rolled", value: 7 } }, asi_choices: {}, resolved_choices: { invocation: ["agonizing-blast"] },
  class_spell_selections: { warlock: [{ content_id: id(40), content_version: 1, prepared: false }] } };
const tiers = [{ level: 1, spells: ["burning-hands", "command"] }, { level: 3, spells: ["blindness-deafness", "scorching-ray"] },
  { level: 5, spells: ["fireball", "stinking-cloud"] }, { level: 7, spells: ["fire-shield", "wall-of-fire"] }, { level: 9, spells: ["flame-strike", "hallow"] }];
const read = (file: string) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const stage = read("supabase/staged/character-builder-subclass-update.sql");
const body = (source: string, name: string) => {
  const start = source.indexOf(name), end = source.indexOf("END $$;", start) + 7;
  if (start < 0 || end < 7) throw Error("Missing SQL function");
  return source.slice(start, end);
};
const originalRevision = body(read("supabase/staged/class-first-acquisition-writer.sql"), "CREATE OR REPLACE FUNCTION private.hit_die_character_revision_v1()");
const hash = (source: string) => createHash("md5").update(source).digest("hex");
const snapshot = (content: string, version: number, slug: string, type: string, data: Json, when = "2026-10-23T00:00:00Z") => ({
  content_id: content, version, name_snapshot: slug, slug_snapshot: slug, content_type_snapshot: type, system_id_snapshot: system,
  source_snapshot: "srd", scope_snapshot: "platform", owner_id_snapshot: null, effects_snapshot: [], data_snapshot: data, created_at: when,
});
const ref = (key: string, content: string, extra: Json = {}) => ({ id: key, character_id: target, content_id: content, content_version: 1,
  context: {}, choice_source: null, feature_grant_id: null, created_at: "2026-10-23T00:00:00+00:00", ...extra });

const fixtureSchema = `CREATE SCHEMA private;
    CREATE ROLE inkborne_hit_die_authority_owner NOLOGIN;
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
    CREATE TABLE public.characters(id uuid PRIMARY KEY,user_id uuid,system_id uuid,campaign_id uuid,name text,level integer,choices jsonb,state jsonb,base_stats jsonb,action_revision bigint,archived boolean);
    CREATE TABLE public.content_versions(content_id uuid,version integer,name_snapshot text,slug_snapshot text,content_type_snapshot text,system_id_snapshot uuid,
      source_snapshot text,scope_snapshot text,owner_id_snapshot uuid,effects_snapshot jsonb,data_snapshot jsonb,created_at timestamptz,PRIMARY KEY(content_id,version));
    CREATE TABLE public.content_definitions(id uuid PRIMARY KEY,version integer,is_retired boolean DEFAULT false);
    CREATE TABLE public.character_content_refs(id uuid PRIMARY KEY,character_id uuid,content_id uuid,content_version integer,context jsonb,choice_source text,feature_grant_id uuid,created_at timestamptz);
    CREATE TABLE public.character_feature_grants(id uuid PRIMARY KEY,character_id uuid,controller_ref_id uuid,controller_type text,controller_slug text,feature_slug text,
      feature_content_id uuid,feature_version integer,unlock_level integer,created_at timestamptz);
    CREATE TABLE public.character_spell_grants(id uuid PRIMARY KEY,character_id uuid,controller_ref_id uuid,spell_name text,spell_content_id uuid,spell_version integer,unlock_level integer);
    CREATE TABLE public.character_spells(id uuid PRIMARY KEY,character_id uuid,content_id uuid,content_version integer,name text,class_slug text,source text,
      spell_grant_id uuid,custom_data jsonb,is_known boolean,is_prepared boolean,always_prepared boolean);
    CREATE TABLE public.character_inventory(id uuid PRIMARY KEY,character_id uuid,quantity integer);
    CREATE TABLE private.character_class_occurrences_v1(id uuid PRIMARY KEY,character_id uuid,class_slug text,controller_ref_id uuid,subclass_ref_id uuid,lifecycle text);
    CREATE TABLE private.character_projection_order_v1(character_id uuid PRIMARY KEY,producer_revision bigint,pins uuid[],feature_grants uuid[],spell_grants uuid[],spells uuid[],inventory uuid[]);
    CREATE TABLE private.character_builder_capabilities_v1(transaction_id xid8,character_id uuid,actor_id uuid,command text,context jsonb,before_parent jsonb,before_order jsonb,
      protected_graph jsonb,expected_graph jsonb,expected_classes jsonb,expected_choices jsonb,correction_operation_id uuid,correction_preview_digest text,correction_revision_consumed boolean DEFAULT false);
    CREATE TABLE private.character_builder_receipts_v1(actor_id uuid,operation_id uuid,character_id uuid,request jsonb,receipt jsonb,created_at timestamptz,PRIMARY KEY(actor_id,operation_id));
    CREATE TABLE private.character_builder_progression_history_v1(actor_id uuid,operation_id uuid,character_id uuid,command text,before_parent jsonb,after_parent jsonb,
      before_graph jsonb,after_graph jsonb,before_order jsonb,after_order jsonb,receipt jsonb,created_at timestamptz);
    CREATE TABLE private.class_origin_revision_events_v1(transaction_id xid8,target_character_id uuid,phase text,before_action_revision bigint,after_action_revision bigint,
      verified_actor_id uuid,before_parent jsonb,expected_after_parent jsonb,acceptance_id uuid);
    CREATE TABLE private.class_first_acquisition_proofs_v1(transaction_id xid8,target_character_id uuid,phase text,verified_actor_id uuid,before_parent jsonb,acceptance_id uuid);
    GRANT USAGE ON SCHEMA private TO inkborne_hit_die_authority_owner;
    GRANT SELECT,UPDATE ON private.class_origin_revision_events_v1,private.class_first_acquisition_proofs_v1 TO inkborne_hit_die_authority_owner;
    CREATE FUNCTION private.lock_builder_character_rows_v1(ctx jsonb,target uuid) RETURNS void LANGUAGE plpgsql AS $$
      BEGIN IF ctx IS DISTINCT FROM current_setting('test.context')::jsonb OR NOT EXISTS(SELECT 1 FROM public.characters WHERE id=target AND user_id=(ctx->>'actor_id')::uuid)
        THEN RAISE EXCEPTION 'builder_character_unavailable' USING ERRCODE='42501'; END IF; END $$;
    CREATE FUNCTION private.begin_builder_step_v1(ctx jsonb,target uuid,command text,authenticated_call boolean) RETURNS public.characters LANGUAGE plpgsql AS $$
      DECLARE parent public.characters; BEGIN PERFORM private.lock_builder_character_rows_v1(ctx,target); SELECT * INTO parent FROM public.characters WHERE id=target; RETURN parent; END $$;
    CREATE FUNCTION private.builder_class_roles_v1(uuid) RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb';
    CREATE FUNCTION private.character_can_access_content_version(uuid,uuid,integer) RETURNS boolean LANGUAGE sql AS 'SELECT true';
    CREATE FUNCTION private.builder_exact_keys_v1(value jsonb,keys text[]) RETURNS boolean LANGUAGE sql AS
      'SELECT jsonb_typeof(value)=''object'' AND (SELECT count(*) FROM jsonb_object_keys(value))=cardinality(keys) AND value ?& keys';
    CREATE FUNCTION private.builder_uuid_v1(text) RETURNS boolean LANGUAGE sql AS 'SELECT $1 ~ ''^[0-9a-f-]{36}$''';
    CREATE FUNCTION private.builder_progression_full_graph_v1(target uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object(
      'origin','{"retained":true}'::jsonb,'commands','[{"retained":true}]'::jsonb,
      'refs',(SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY id),'[]') FROM public.character_content_refs r WHERE character_id=target),
      'feature_grants',(SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY id),'[]') FROM public.character_feature_grants r WHERE character_id=target),
      'spell_grants',(SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY id),'[]') FROM public.character_spell_grants r WHERE character_id=target),
      'spells',(SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY id),'[]') FROM public.character_spells r WHERE character_id=target),
      'occurrences',(SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY id),'[]') FROM private.character_class_occurrences_v1 r WHERE character_id=target),
      'inventory',(SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY id),'[]') FROM public.character_inventory r WHERE character_id=target)) $$;
    CREATE FUNCTION private.mint_builder_step_v1(ctx jsonb,parent public.characters,cmd text) RETURNS void LANGUAGE sql AS $$
      INSERT INTO private.character_builder_capabilities_v1(transaction_id,character_id,actor_id,command,context,before_parent,before_order,protected_graph,expected_graph)
      SELECT pg_current_xact_id(),parent.id,parent.user_id,cmd,ctx,to_jsonb(parent),(SELECT to_jsonb(o) FROM private.character_projection_order_v1 o WHERE character_id=parent.id),
        private.builder_progression_full_graph_v1(parent.id),private.builder_progression_full_graph_v1(parent.id) $$;
    CREATE FUNCTION private.finish_builder_step_v1(ctx jsonb,target uuid) RETURNS public.characters LANGUAGE plpgsql AS $$
      DECLARE parent public.characters; BEGIN PERFORM private.lock_builder_character_rows_v1(ctx,target);
      DELETE FROM private.character_builder_capabilities_v1 WHERE character_id=target AND transaction_id=pg_current_xact_id();
      SELECT * INTO parent FROM public.characters WHERE id=target; RETURN parent; END $$;
    CREATE FUNCTION private.apply_builder_catalog_command_v1(target uuid,command text,fields jsonb) RETURNS void LANGUAGE plpgsql AS $$
      DECLARE cap private.character_builder_capabilities_v1; graph jsonb; next_graph jsonb; old_ref uuid; new_ref uuid; pin jsonb; pending jsonb;
      BEGIN
        SELECT * INTO cap FROM private.character_builder_capabilities_v1 WHERE character_id=target AND transaction_id=pg_current_xact_id();
        graph:=cap.protected_graph; old_ref:='${subclass}'; new_ref:='${id(300)}';
        SELECT value||jsonb_build_object('id',new_ref,'content_version',(fields->>'content_version')::integer) INTO pin FROM jsonb_array_elements(graph->'refs') WHERE value->>'id'=old_ref::text;
        next_graph:=graph||jsonb_build_object(
          'refs',(SELECT jsonb_agg(CASE WHEN value->>'id'=old_ref::text THEN pin ELSE value END ORDER BY CASE WHEN value->>'id'=old_ref::text THEN new_ref::text ELSE value->>'id' END) FROM jsonb_array_elements(graph->'refs')),
          'occurrences',(SELECT jsonb_agg(value||jsonb_build_object('subclass_ref_id',new_ref)) FROM jsonb_array_elements(graph->'occurrences')),
          'feature_grants',(SELECT jsonb_agg(CASE WHEN value->>'controller_ref_id'=old_ref::text THEN value||jsonb_build_object('controller_ref_id',new_ref) ELSE value END ORDER BY value->>'id') FROM jsonb_array_elements(graph->'feature_grants')),
          'spell_grants','[]'::jsonb,'spells',(SELECT jsonb_agg(value ORDER BY value->>'id') FROM jsonb_array_elements(graph->'spells') WHERE value->>'source'='selection'));
        SELECT choices INTO pending FROM public.characters WHERE id=target;
        IF current_setting('test.bad_delta',true)='choices' THEN pending:=pending||'{"unexpected":true}'::jsonb; END IF;
        UPDATE private.character_builder_capabilities_v1 SET expected_graph=next_graph,expected_choices=pending,expected_classes=pending->'classes' WHERE character_id=target;
        DELETE FROM public.character_spells WHERE spell_grant_id IS NOT NULL AND character_id=target;
        DELETE FROM public.character_spell_grants WHERE controller_ref_id=old_ref AND character_id=target;
        DELETE FROM public.character_content_refs WHERE id=old_ref;
        UPDATE public.characters SET choices=pending WHERE id=target;
        IF current_setting('test.bad_delta',true)='second_update' THEN UPDATE public.characters SET choices=pending WHERE id=target; END IF;
        INSERT INTO public.character_content_refs SELECT * FROM jsonb_populate_record(NULL::public.character_content_refs,pin);
        UPDATE public.character_feature_grants SET controller_ref_id=new_ref WHERE controller_ref_id=old_ref AND character_id=target;
        UPDATE private.character_class_occurrences_v1 SET subclass_ref_id=new_ref WHERE id='${occurrence}';
        IF current_setting('test.bad_delta',true)='unrelated' THEN UPDATE public.character_content_refs SET context='{"changed":true}' WHERE id='${root}'; END IF;
      END $$;
    CREATE FUNCTION private.hit_die_order_revision_rebind_v1() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      UPDATE private.character_projection_order_v1 SET producer_revision=NEW.action_revision WHERE character_id=NEW.id; RETURN NEW; END $$;
    CREATE TRIGGER hit_die_order_revision_rebind AFTER UPDATE ON public.characters FOR EACH ROW EXECUTE FUNCTION private.hit_die_order_revision_rebind_v1();`;
beforeAll(async () => {
  await db.exec(fixtureSchema);
  const catalog = read("supabase/staged/character-builder-catalog.sql");
  await db.exec(body(catalog, "CREATE FUNCTION private.builder_catalog_dependency_v1"));
  await db.exec(originalRevision);
  await db.exec(`ALTER FUNCTION private.hit_die_character_revision_v1() OWNER TO inkborne_hit_die_authority_owner;
    REVOKE ALL ON FUNCTION private.hit_die_character_revision_v1() FROM PUBLIC,anon,authenticated,service_role;
    CREATE TRIGGER hit_die_character_revision BEFORE UPDATE ON public.characters FOR EACH ROW EXECUTE FUNCTION private.hit_die_character_revision_v1();`);
  await db.exec(stage.slice(stage.indexOf("CREATE FUNCTION private.require_builder_subclass_update_request_v1"), stage.indexOf("DO $revision_profile$")));
  await db.exec(stage.slice(stage.indexOf("DO $revision_profile$"), stage.indexOf("ALTER TABLE private.character_builder_progression_history_v1 DROP")));
  await db.exec(body(stage, "CREATE FUNCTION public.character_builder_command_v1"));
  await db.exec(`REVOKE ALL ON FUNCTION private.builder_subclass_update_revision_v1(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
    GRANT EXECUTE ON FUNCTION private.builder_subclass_update_revision_v1(jsonb,jsonb) TO inkborne_hit_die_authority_owner;`);
});
afterAll(async () => { await db.close(); });

beforeEach(async () => {
  await db.exec(`TRUNCATE public.characters,public.content_versions,public.content_definitions,public.character_content_refs,public.character_feature_grants,
    public.character_spell_grants,public.character_spells,public.character_inventory,private.character_class_occurrences_v1,private.character_projection_order_v1,
    private.character_builder_capabilities_v1,private.character_builder_receipts_v1,private.character_builder_progression_history_v1;
    SELECT set_config('test.bad_delta','',false);`);
  await db.query("SELECT set_config('test.context',$1,false)", [JSON.stringify(context)]);
  await db.query("INSERT INTO public.characters VALUES($1,$2,$3,NULL,'Saved notebook',3,$4,$5,$6,10,false)",
    [target, actor, system, choices, { current_hp: 21, currency: { gp: 15 } }, { strength: 15, constitution: 14 }]);
  const levels = [{ level: 1, features: ["dark-ones-blessing"] }];
  for (const version of [1, 2]) {
    await db.query("INSERT INTO public.content_versions SELECT * FROM jsonb_populate_record(NULL::public.content_versions,$1)", [snapshot(subclassContent, version, "fiend", "subclass",
      { parent_class: "warlock", levels, [version === 1 ? "spellcastingExtra" : "spellcastingExpanded"]: tiers }, version === 1 ? "2026-10-23T00:00:00Z" : "2026-10-24T00:00:00Z")]);
  }
  const entries = [snapshot(id(20), 1, "dark-ones-blessing", "feature", {}), snapshot(id(40), 1, "hellish-rebuke", "spell", { classes: ["warlock"], level: 1 }),
    ...tiers.flatMap((tier, i) => tier.spells.map((slug, j) => snapshot(id(50 + i * 2 + j), 1, slug, "spell", { level: (tier.level + 1) / 2 })))];
  for (const entry of entries) await db.query("INSERT INTO public.content_versions SELECT * FROM jsonb_populate_record(NULL::public.content_versions,$1)", [entry]);
  await db.query("INSERT INTO public.content_definitions VALUES($1,2,false)", [subclassContent]);
  await db.query("INSERT INTO private.character_class_occurrences_v1 VALUES($1,$2,'warlock',$3,$4,'accepted')", [occurrence, target, root, subclass]);
  const refs = [ref(root, id(19)), ref(subclass, subclassContent, { context: { source: "subclass", class: "warlock" }, choice_source: `builder:subclass:${occurrence}` }),
    ref(id(22), id(20), { feature_grant_id: id(21), choice_source: `auto:feature-grant:${id(21)}` })];
  for (const pin of refs) await db.query("INSERT INTO public.character_content_refs SELECT * FROM jsonb_populate_record(NULL::public.character_content_refs,$1)", [pin]);
  await db.query("INSERT INTO public.character_feature_grants VALUES($1,$2,$3,'subclass','fiend','dark-ones-blessing',$4,1,1,'2026-10-23')", [id(21), target, subclass, id(20)]);
  for (const [index, entry] of entries.slice(2).entries()) {
    await db.query("INSERT INTO public.character_spell_grants VALUES($1,$2,$3,$4,$5,1,$6)", [id(100 + index), target, subclass, entry.name_snapshot, entry.content_id, tiers[Math.floor(index / 2)].level]);
    if (index < 4) await db.query("INSERT INTO public.character_spells VALUES($1,$2,$3,1,$4,'warlock','feature',$5,NULL,false,true,true)", [id(200 + index), target, entry.content_id, entry.name_snapshot, id(100 + index)]);
  }
  await db.query("INSERT INTO public.character_spells VALUES($1,$2,$3,1,'Hellish Rebuke','warlock','selection',NULL,$4,true,false,false)", [id(41), target, id(40), { builder_class_controller_ref_id: root }]);
  await db.query("INSERT INTO public.character_inventory VALUES($1,$2,2)", [id(42), target]);
  await db.query("INSERT INTO private.character_projection_order_v1 VALUES($1,10,$2,$3,$4,$5,$6)", [target, refs.map(r => r.id), [id(21)],
    Array.from({ length: 10 }, (_, n) => id(100 + n)), [id(41), ...Array.from({ length: 4 }, (_, n) => id(200 + n))], [id(42)]]);
});

async function preview(ctx = context, refId = subclass, toVersion = 2) {
  const result = await db.query<{ result: { status: string; reason?: string; preview?: { fields: Json; removed: Json[]; retained: Json[]; added: Json[] } } }>(
    "SELECT public.character_builder_subclass_update_preview_v1($1,$2,$3,$4) AS result", [ctx, target, refId, toVersion]);
  return result.rows[0].result;
}
async function intent() { return { contract_version: 1, character_id: target, operation_id: id(500), command: "update_subclass_version", fields: (await preview()).preview!.fields }; }
async function execute(request: Json, ctx = context) {
  const result = await db.query<{ result: { status: string; receipt: Json } }>("SELECT public.character_builder_command_v1($1,$2) AS result", [ctx, request]); return result.rows[0].result;
}
async function state() {
  return (await db.query<{ result: Json }>(`SELECT jsonb_build_object('graph',private.builder_progression_full_graph_v1($1),
    'parent',(SELECT to_jsonb(c) FROM public.characters c WHERE id=$1),
    'receipts',(SELECT count(*) FROM private.character_builder_receipts_v1),'history',(SELECT count(*) FROM private.character_builder_progression_history_v1),
    'caps',(SELECT count(*) FROM private.character_builder_capabilities_v1)) AS result`, [target])).rows[0].result;
}

describe("explicit Fiend correction SQL boundary", () => {
  it("previews complete old/new source closure and exact expected tuple without writing", async () => {
    const before = await state(), first = await preview(); expect(first.status).toBe("available");
    expect(first.preview!.fields).toMatchObject({ class_slug: "warlock", occurrence_id: occurrence, subclass_ref_id: subclass,
      content_id: subclassContent, expected_content_version: 1, target_content_version: 2, expected_action_revision: "10", preview_digest: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(first.preview!.removed).toHaveLength(10); expect(first.preview!.added).toHaveLength(4);
    expect(await preview()).toEqual(first); expect(await state()).toEqual(before);
  });
  it.each(["root_data", "feature_version", "retired", "not_latest", "wrong_source"])("refuses unsupported %s without touching historical pins", async mode => {
    const before = await state();
    if (mode === "root_data") await db.query("UPDATE public.content_versions SET data_snapshot=data_snapshot||'{\"unrelated\":true}' WHERE content_id=$1 AND version=2", [subclassContent]);
    if (mode === "feature_version") await db.query("INSERT INTO public.content_versions SELECT * FROM jsonb_populate_record(NULL::public.content_versions,$1)", [snapshot(id(20), 2, "dark-ones-blessing", "feature", { changed: true }, "2026-10-23T12:00:00Z")]);
    if (mode === "retired") await db.query("UPDATE public.content_definitions SET is_retired=true WHERE id=$1", [subclassContent]);
    if (mode === "not_latest") await db.query("UPDATE public.content_definitions SET version=3 WHERE id=$1", [subclassContent]);
    if (mode === "wrong_source") await db.query("UPDATE public.content_versions SET source_snapshot='homebrew' WHERE content_id=$1 AND version=2", [subclassContent]);
    expect(await preview()).toEqual({ status: "unavailable", reason: "unavailable" }); expect(await state()).toEqual(before);
  });
  it("binds dependency row bodies, full graph and current revision into the preview digest", async () => {
    const before = (await preview()).preview!.fields.preview_digest;
    await db.query("UPDATE public.content_versions SET data_snapshot=data_snapshot||'{\"description\":\"new\"}' WHERE content_id=$1", [id(50)]);
    expect((await preview()).preview!.fields.preview_digest).not.toBe(before);
    await db.query("UPDATE public.character_inventory SET quantity=3 WHERE character_id=$1", [target]);
    expect((await preview()).preview!.fields.preview_digest).not.toBe(before);
  });
  it("applies once, preserves parent choices/state/HP/inventory and ordinary spell identity, then replays the old receipt", async () => {
    const request = await intent(), before = await state(); const result = await execute(request);
    expect(result.status).toBe("applied"); expect(result.receipt).toMatchObject({ operation_id: id(500), command: "update_subclass_version", fields: request.fields, action_revision: "11" });
    const after = await state(); expect(after).toMatchObject({ caps: 0, receipts: 1, history: 1,
      parent: { choices, action_revision: 11, state: { current_hp: 21, currency: { gp: 15 } } } });
    const beforeGraph = before.graph as { inventory: Json[]; spells: Json[] }, afterGraph = after.graph as { inventory: Json[]; spells: Json[] };
    expect(afterGraph.inventory).toEqual(beforeGraph.inventory); expect(afterGraph.spells).toEqual(beforeGraph.spells.filter(s => s.source === "selection"));
    expect(await execute(request)).toEqual({ ...result, status: "replayed" }); expect(await state()).toEqual(after);
    await expect(execute({ ...request, fields: { ...(request.fields as Json), preview_digest: "b".repeat(64) } })).rejects.toThrow("builder_operation_intent_conflict");
  });
  it.each(["expected_content_version", "subclass_ref_id", "content_id", "occurrence_id", "preview_digest"])("refuses a stale or substituted %s atomically", async field => {
    const request = await intent(), before = await state();
    const replacement = field === "expected_action_revision" ? "9" : field === "expected_content_version" ? 2 : field === "preview_digest" ? "b".repeat(64) : id(999);
    await expect(execute({ ...request, fields: { ...(request.fields as Json), [field]: replacement } })).rejects.toThrow(/builder_(invalid_subclass_update|stale_action_revision|subclass_update_preview_changed)/);
    expect(await state()).toEqual(before);
  });
  it("refuses changed Auth/account before preview or replay and never grants access from the stored actor", async () => {
    const request = await intent(), before = await state();
    await expect(preview({ ...context, actor_id: id(999) })).rejects.toThrow("builder_character_unavailable");
    await expect(execute(request, { ...context, session_id: id(999) })).rejects.toThrow("builder_character_unavailable");
    expect(await state()).toEqual(before);
  });
  it("proves only the exact monotonically stale original is terminal without writing, preserving plain absence", async () => {
    const request = await intent();
    const resolve = async (input: Json = request, ctx = context) => (await db.query<{ result: Json }>(
      "SELECT public.character_builder_subclass_update_resolution_v1($1,$2) AS result", [ctx, input])).rows[0].result;
    const baseline = await state(); expect(await resolve()).toEqual({ status: "absent" }); expect(await state()).toEqual(baseline);
    await db.query("UPDATE public.characters SET base_stats=base_stats||'{\"strength\":16}' WHERE id=$1", [target]);
    const advanced = await state();
    const terminal = { status: "rejected", rejection: { actor_id: actor, character_id: target, operation_id: id(500), command: "update_subclass_version",
      fields: request.fields, reason: "stale_review", observed_action_revision: "11" } };
    expect(await resolve()).toEqual(terminal); expect(await execute(request)).toEqual(terminal); expect(await state()).toEqual(advanced);
    await expect(resolve(request, { ...context, actor_id: id(999) })).rejects.toThrow("builder_character_unavailable");
    expect(await resolve({ ...request, fields: { ...(request.fields as Json), expected_action_revision: "12" } })).toEqual({ status: "absent" });
  });
  it("returns the accepted exact receipt before considering later revision drift or stale proof", async () => {
    const request = await intent(), applied = await execute(request);
    await db.query("UPDATE public.characters SET base_stats=base_stats||'{\"strength\":16}' WHERE id=$1", [target]);
    const before = await state();
    const resolved = (await db.query<{ result: Json }>("SELECT public.character_builder_subclass_update_resolution_v1($1,$2) AS result", [context, request])).rows[0].result;
    expect(resolved).toEqual({ ...applied, status: "recorded" }); expect(await execute(request)).toEqual({ ...applied, status: "replayed" });
    expect(await state()).toEqual(before);
  });
  it.each(["choices", "unrelated", "second_update"])("rolls back an unexpected compiler %s mutation including revision/receipt/capability", async mode => {
    const request = await intent(), before = await state(); await db.query("SELECT set_config('test.bad_delta',$1,false)", [mode]);
    await expect(execute(request)).rejects.toThrow(/builder_subclass_update_(revision_missing|revision_invalid|preservation_failed)/);
    expect(await state()).toEqual(before);
  });
  it("rolls back revision exhaustion after a complete valid preview", async () => {
    await db.exec("ALTER TABLE public.characters DISABLE TRIGGER hit_die_character_revision; UPDATE public.characters SET action_revision=9223372036854775807; ALTER TABLE public.characters ENABLE TRIGGER hit_die_character_revision; UPDATE private.character_projection_order_v1 SET producer_revision=9223372036854775807");
    const request = await intent(), before = await state(); await expect(execute(request)).rejects.toThrow("Revision exhausted"); expect(await state()).toEqual(before);
  });
  it("preserves the old revision branches byte-for-byte except the finite condition and native attributes/ACL", async () => {
    const original = originalRevision.slice(originalRevision.indexOf("AS $$") + 5, originalRevision.indexOf("END $$;") + 4);
    expect(hash(original)).toBe("2daf275513b60cc98818f07a7e982946");
    const { rows } = await db.query<{ prosrc: string; owner: string; prosecdef: boolean; provolatile: string; proconfig: string[] }>(
      "SELECT prosrc,proowner::regrole::text AS owner,prosecdef,provolatile,proconfig FROM pg_proc WHERE oid='private.hit_die_character_revision_v1()'::regprocedure");
    expect(hash(rows[0].prosrc)).toBe("857950f1a88305838220494f068e5cf5");
    expect(rows[0]).toMatchObject({ owner: "inkborne_hit_die_authority_owner", prosecdef: true, provolatile: "v", proconfig: ['search_path=""'] });
    for (const role of ["anon", "authenticated", "service_role"]) {
      expect((await db.query<{ permitted: boolean }>("SELECT has_function_privilege($1,'private.builder_subclass_update_revision_v1(jsonb,jsonb)','EXECUTE') AS permitted", [role])).rows[0].permitted).toBe(false);
    }
  });
  it("executes the complete real installer against exact admitted native function profiles", async () => {
    const isolated = new PGlite();
    try {
      await isolated.exec(fixtureSchema);
      await isolated.exec(`CREATE ROLE inkborne_class_origin_owner NOLOGIN; CREATE ROLE supabase_admin SUPERUSER NOLOGIN;
        ALTER TABLE private.character_builder_capabilities_v1 DROP COLUMN correction_operation_id,DROP COLUMN correction_preview_digest,DROP COLUMN correction_revision_consumed;
        ALTER TABLE private.character_builder_progression_history_v1 ADD CONSTRAINT character_builder_progression_history_v1_command_check
          CHECK(command IN ('add_class','remove_class','set_class_level','save_hp_roll','select_asi','select_class_spells'));
        CREATE TABLE private.character_writer_readiness_v1(id integer,ready boolean); INSERT INTO private.character_writer_readiness_v1 SELECT i,false FROM generate_series(1,13) i;
        CREATE TABLE private.class_origin_gate_v1(enabled boolean); CREATE TABLE private.hit_die_gate_v1(enabled boolean);
        CREATE FUNCTION private.prepare_builder_expanded_spells_v1(uuid,jsonb,jsonb) RETURNS jsonb LANGUAGE sql AS 'SELECT $3';
        CREATE FUNCTION private.prepare_builder_class_removal_v1(uuid,jsonb) RETURNS void LANGUAGE sql AS 'SELECT';`);
      const multi = read("supabase/staged/character-builder-multiclass.sql"), feature = read("supabase/staged/character-builder-class-feature-choices.sql");
      let compiler = body(multi, "CREATE OR REPLACE FUNCTION private.apply_builder_catalog_command_v1");
      const countNeedle = feature.match(/needle:=\$count\$([\s\S]*?)\$count\$;/)![1];
      const countInsertion = feature.match(/insertion:=\$count\$([\s\S]*?)\$count\$\|\|needle;/)![1];
      compiler = compiler.replace(countNeedle, () => countInsertion + countNeedle);
      const style = feature.match(/needle:=\$style\$([\s\S]*?)\$style\$;\n\s+insertion:=\$style\$([\s\S]*?)\$style\$;/)!;
      compiler = compiler.replace(style[1], () => style[2]);
      compiler = compiler.slice(0, compiler.indexOf("  -- Fighting styles are finite child feature choices on active pinned manifests."))
        + compiler.slice(compiler.indexOf("  -- Complete subclass manifests retain all frozen grants, activating"));
      compiler = compiler.replace("  FOREACH domain IN ARRAY ARRAY['refs','feature_grants','spell_grants','spells','occurrences'] LOOP",
        feature.match(/insertion:=\$catalog\$([\s\S]*?)\$catalog\$;/)![1] + "  FOREACH domain IN ARRAY ARRAY['refs','feature_grants','spell_grants','spells','occurrences'] LOOP");
      compiler = compiler.replace("  -- Retired subclass-owned choices are not carried into a replacement subclass.",
        read("supabase/staged/character-builder-multiclass-integration-repair.sql").match(/revised:=\$pending\$([\s\S]*?)\$pending\$\|\|needle;/)![1]
          + "  -- Retired subclass-owned choices are not carried into a replacement subclass.");
      const compilerBody = compiler.slice(compiler.indexOf("AS $$") + 5, compiler.indexOf("END $$;") + 4);
      expect(hash(compilerBody)).toBe("d55825fd6cf14472f9154a363991b62a");
      await isolated.exec(originalRevision);
      await isolated.exec(compiler);
      await isolated.exec("DROP FUNCTION private.finish_builder_step_v1(jsonb,uuid)");
      await isolated.exec(body(read("supabase/staged/character-builder-progression.sql"), "CREATE OR REPLACE FUNCTION private.finish_builder_step_v1"));
      await isolated.exec(body(read("supabase/staged/character-builder-class-removal.sql"), "CREATE FUNCTION public.character_builder_command_v1"));
      await isolated.exec(`ALTER FUNCTION private.hit_die_character_revision_v1() OWNER TO inkborne_hit_die_authority_owner;
        REVOKE ALL ON FUNCTION private.hit_die_character_revision_v1() FROM PUBLIC,anon,authenticated,service_role;
        REVOKE ALL ON FUNCTION private.apply_builder_catalog_command_v1(uuid,text,jsonb),private.finish_builder_step_v1(jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;
        REVOKE ALL ON FUNCTION public.character_builder_command_v1(jsonb,jsonb) FROM PUBLIC,anon,service_role;
        GRANT EXECUTE ON FUNCTION public.character_builder_command_v1(jsonb,jsonb) TO authenticated;
        SET ROLE supabase_admin;`);
      await isolated.exec(stage);
      const { rows } = await isolated.query<{ digest: string; owner: string; prosecdef: boolean; proconfig: string[] }>(
        "SELECT md5(prosrc) AS digest,proowner::regrole::text AS owner,prosecdef,proconfig FROM pg_proc WHERE oid='private.hit_die_character_revision_v1()'::regprocedure");
      expect(rows[0]).toMatchObject({ digest: "857950f1a88305838220494f068e5cf5", owner: "inkborne_hit_die_authority_owner", prosecdef: true, proconfig: ['search_path=""'] });
      for (const role of ["anon", "service_role"]) expect((await isolated.query<{ allowed: boolean }>(
        "SELECT has_function_privilege($1,'public.character_builder_subclass_update_preview_v1(jsonb,uuid,uuid,integer)','EXECUTE') AS allowed", [role])).rows[0].allowed).toBe(false);
      expect((await isolated.query<{ allowed: boolean }>("SELECT has_function_privilege('authenticated','public.character_builder_subclass_update_preview_v1(jsonb,uuid,uuid,integer)','EXECUTE') AS allowed")).rows[0].allowed).toBe(true);
    } finally { await isolated.close(); }
  });
});
