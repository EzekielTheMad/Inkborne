// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { classRoleFixture, roleId } from "@/tests/fixtures/class-role-effects";
import { collectClassRoleEffectsFromNativeGraph } from "@/lib/character/class-role-effects-native-graph";
import { classOriginGraphSchema, classOriginReceiptSchema, classOriginPlannedTransitionSchema } from "@/lib/character/class-origin-command-schema";

// Offline calculation and exact raw-row/save-evidence compatibility only. No
// production admission, RLS, materializer triggers, Auth replacement or journal.
const db = new PGlite();
const target = roleId(1), system = roleId(2), owner = roleId(9), content = roleId(110);
const feature = roleId(30), dormantFeature = roleId(31), spell = roleId(40), dormantSpell = roleId(41);
const producer = readFileSync("supabase/staged/class-origin-producer.sql", "utf8");
const authority = readFileSync("supabase/staged/hit-die-authority-and-writers.sql", "utf8");
const featureSql = readFileSync("supabase/migrations/20260720185127_feature_grant_integrity.sql", "utf8");
const featureTable = readFileSync("supabase/migrations/20260720173545_content_version_policy_performance.sql", "utf8");
const spellSql = readFileSync("supabase/migrations/20260720185149_feature_spell_grants.sql", "utf8");
type Row = Record<string, unknown>;
type Graph = { parent: Row; origin: Row; order: Row; occurrences: Row[]; refs: Row[]; inventory: Row[];
  spells: Row[]; feature_grants: Row[]; spell_grants: Row[]; versions: Row[] };
type Envelope = { envelope_version: number; acceptance_id: string; transaction_id: string; before_parent: Row;
  before_origin: Row; before_order: Row; expected_graph: Graph; native_rows: Record<string, Row[]>;
  planned_transitions: Row[]; receipt: Row };
function definition(sql: string, name: string) {
  const start = sql.indexOf(`CREATE FUNCTION ${name}(`) >= 0 ? sql.indexOf(`CREATE FUNCTION ${name}(`) : sql.indexOf(`CREATE OR REPLACE FUNCTION ${name}(`);
  const delimiter = sql.indexOf("AS $$", start), end = sql.indexOf("$$;", delimiter + 5);
  if (start < 0 || delimiter < 0 || end < 0) throw Error(`Missing original function ${name}`);
  return sql.slice(start, end + 3);
}
function table(sql: string, name: string) {
  const spaced = sql.indexOf(`CREATE TABLE ${name} (`);
  const start = spaced >= 0 ? spaced : sql.indexOf(`CREATE TABLE ${name}(`), end = sql.indexOf(";", start);
  if (start < 0 || end < 0) throw Error(`Missing original table ${name}`);
  return sql.slice(start, end + 1);
}
const intent = () => ({ contract_version: 1, character_id: target, operation_id: roleId(800), command: "add_class",
  expected_action_revision: "0", expected_class_revision: "0", fields: { content_id: content, content_version: 1, subclass: null } });
async function allocate(request: unknown = intent()) {
  return (await db.query<{ value: Envelope }>("SELECT private.allocate_first_class_save_envelope_v1($1) AS value", [request])).rows[0].value;
}
async function state() {
  const result: Record<string, unknown> = {};
  for (const relation of ["public.characters", "private.character_class_origin_v1", "private.character_class_occurrences_v1",
    "private.character_projection_order_v1", "public.character_content_refs", "public.character_inventory", "public.character_spells",
    "public.character_feature_grants", "public.character_spell_grants", "public.content_versions"]) {
    result[relation] = (await db.query(`SELECT COALESCE(jsonb_agg(to_jsonb(snapshot) ORDER BY to_jsonb(snapshot)::text),'[]') AS rows FROM ${relation} snapshot`)).rows;
  }
  return result;
}
async function refuses(code: string, request: unknown = intent()) {
  const before = await state();
  await db.exec("SAVEPOINT refusal");
  await expect(allocate(request)).rejects.toMatchObject({ code });
  await db.exec("ROLLBACK TO SAVEPOINT refusal; RELEASE SAVEPOINT refusal");
  expect(await state()).toEqual(before); // Fixture recovery, not production rollback proof.
}
async function seedVersion(id: string, type: string, slug: string, data: unknown, effects: unknown = []) {
  await db.query(`INSERT INTO public.content_versions VALUES($1,1,$2,$3,$4,$4,'platform','srd',NULL,$5,$6,'2026-01-01','{"untouched":[2,1]}')`,
    [id, system, type, slug, data, effects]);
}
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA private;
    CREATE TABLE public.characters(id uuid PRIMARY KEY,user_id uuid NOT NULL,system_id uuid NOT NULL,campaign_id uuid,
      name text NOT NULL,visibility text NOT NULL DEFAULT 'private',archived boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),
      level integer NOT NULL DEFAULT 1,base_stats jsonb NOT NULL DEFAULT '{}',choices jsonb NOT NULL DEFAULT '{}',state jsonb NOT NULL DEFAULT '{}',
      narrative jsonb NOT NULL DEFAULT '{}',narrative_rich jsonb NOT NULL DEFAULT '{}',primary_color text,action_revision bigint NOT NULL DEFAULT 0);
    CREATE TABLE public.content_versions(content_id uuid,version integer,system_id_snapshot uuid,content_type_snapshot text,
      slug_snapshot text,name_snapshot text,scope_snapshot text,source_snapshot text,owner_id_snapshot uuid,data_snapshot jsonb,
      effects_snapshot jsonb,created_at timestamptz,unparsed_snapshot jsonb,PRIMARY KEY(content_id,version));
    CREATE TABLE public.content_shares(content_id uuid,campaign_id uuid); CREATE TABLE public.campaign_members(campaign_id uuid,user_id uuid);
    CREATE TABLE public.character_content_refs(id uuid PRIMARY KEY,character_id uuid NOT NULL REFERENCES public.characters,
      content_id uuid NOT NULL,content_version integer NOT NULL,context jsonb NOT NULL,choice_source text,created_at timestamptz NOT NULL,
      feature_grant_id uuid UNIQUE,UNIQUE(id,character_id));
    CREATE TABLE public.character_spells(id uuid PRIMARY KEY,character_id uuid NOT NULL REFERENCES public.characters,content_id uuid,
      name text NOT NULL,class_slug text NOT NULL,is_known boolean NOT NULL,is_prepared boolean NOT NULL,always_prepared boolean NOT NULL,
      in_spellbook boolean NOT NULL,source text NOT NULL,custom_data jsonb,created_at timestamptz NOT NULL,content_version integer,
      spell_grant_id uuid UNIQUE,UNIQUE(character_id,content_id,class_slug));
    CREATE TABLE public.character_inventory(id uuid PRIMARY KEY,character_id uuid,content_id uuid,content_version integer);`);
  for (const name of ["private.character_class_origin_v1", "private.character_class_occurrences_v1", "private.character_class_commands_v1"]) await db.exec(table(producer, name));
  for (const name of ["private.character_projection_order_v1", "private.character_writer_guard_v1"]) await db.exec(table(authority, name));
  await db.exec("INSERT INTO private.character_writer_guard_v1(singleton) VALUES(true)");
  await db.exec(table(featureTable, "public.character_feature_grants"));
  await db.exec(table(spellSql, "public.character_spell_grants"));
  await db.exec("ALTER TABLE public.character_content_refs ADD FOREIGN KEY(feature_grant_id) REFERENCES public.character_feature_grants(id)");
  for (const [source, name] of [[featureSql, "private.character_can_access_content_version"],
    [authority, "private.lock_character_writer_guard_v1"], [producer, "private.class_origin_ids_match_v1"],
    [producer, "private.class_origin_read_final_graph_v1"], [producer, "private.class_origin_exact_keys_v1"],
    [producer, "private.class_origin_decimal_v1"], [producer, "private.class_origin_uuid_v1"],
    [producer, "private.class_origin_instant_v1"], [producer, "private.class_origin_receipt_shape_v1"]]) await db.exec(definition(source, name));
  await db.exec(readFileSync("supabase/staged/class-first-acquisition-dependencies.sql", "utf8"));
  await db.exec(readFileSync("supabase/staged/class-first-acquisition-allocation.sql", "utf8"));
}, 30_000);
beforeEach(async () => {
  await db.exec("BEGIN");
  await db.query("INSERT INTO public.characters(id,user_id,system_id,name,primary_color) VALUES($1,$2,$3,'Keep original name','#123456')", [target, owner, system]);
  await db.query(`INSERT INTO private.character_class_origin_v1 VALUES($1,1,$2,'draft',NULL,'new_character',$3,NULL,NULL,0)`, [target, system, roleId(4)]);
  await db.query(`INSERT INTO private.character_projection_order_v1 VALUES($1,1,0,'{}','{}','{}','{}','{}')`, [target]);
  const source = classRoleFixture().sources.find(pin => pin.content_id === content)!;
  await seedVersion(content, "class", source.resolved.slug, { ...source.resolved.data,
    levels: [{ level: 1, features: ["first"] }, { level: 4, features: ["later", "first"] }], spellcastingExtra: ["spark", ["nova"]] }, source.resolved.effects);
  await db.query("UPDATE public.content_versions SET created_at='2026-01-10' WHERE content_id=$1", [content]);
  const featureSource = classRoleFixture().sources.find(pin => pin.resolved.content_type === "feature")!;
  await seedVersion(feature, "feature", "first", featureSource.resolved.data, featureSource.resolved.effects);
  await seedVersion(dormantFeature, "feature", "later", featureSource.resolved.data);
  await seedVersion(spell, "spell", "spark", {}); await seedVersion(dormantSpell, "spell", "nova", {});
});
afterEach(async () => { await db.exec("ROLLBACK"); });
afterAll(async () => { await db.close(); });

async function insert(relation: string, record: unknown) {
  await db.query(`INSERT INTO ${relation} SELECT * FROM jsonb_populate_record(NULL::${relation},$1)`, [record]);
}
// Fixture-only writes materialize the returned rows with exact identities. No
// acceptance/trigger/RLS is weakened or replaced; those paths are absent here.
async function materialize(envelope: Envelope) {
  const graph = envelope.expected_graph;
  await db.query("UPDATE public.characters SET choices=$1,action_revision=1 WHERE id=$2", [graph.parent.choices, target]);
  await db.query("UPDATE private.character_class_origin_v1 SET command_revision=1 WHERE character_id=$1", [target]);
  await insert("public.character_content_refs", graph.refs[0]);
  for (const grant of graph.feature_grants) await insert("public.character_feature_grants", grant);
  for (const grant of graph.spell_grants) await insert("public.character_spell_grants", grant);
  for (const ref of graph.refs.slice(1)) await insert("public.character_content_refs", ref);
  for (const item of graph.spells) await insert("public.character_spells", item);
  await insert("private.character_class_occurrences_v1", graph.occurrences[0]);
  await db.query("DELETE FROM private.character_projection_order_v1 WHERE character_id=$1", [target]);
  await insert("private.character_projection_order_v1", graph.order);
  return (await db.query<{ graph: Graph }>("SELECT private.class_origin_read_final_graph_v1($1,$2::uuid[]) AS graph", [target, graph.occurrences.map(row => row.id)])).rows[0].graph;
}
function role(envelope: Envelope, graph: unknown = envelope.expected_graph, manifests: unknown = []) {
  return collectClassRoleEffectsFromNativeGraph({ graph, system: classRoleFixture().system, currentProficiencyBonus: 2, manifests });
}
describe("native first-class allocation and save compatibility: offline calculation only", () => {
  it("allocates all complete rows without mutation and matches the unchanged final graph reader exactly", async () => {
    const before = await state(), result = await allocate();
    expect(await state()).toEqual(before);
    expect(result.envelope_version).toBe(1);
    const graph = result.expected_graph;
    expect(graph.refs).toHaveLength(2); expect(graph.feature_grants).toHaveLength(2); expect(graph.spell_grants).toHaveLength(2);
    expect(graph.spells).toHaveLength(1); expect(graph.versions).toHaveLength(5);
    expect(graph.parent).toMatchObject({ name: "Keep original name", primary_color: "#123456", level: 1, action_revision: "1" });
    expect(graph.parent.choices).toEqual({ classes: [{ occurrence_id: graph.occurrences[0].id, slug: "lantern-keeper", level: 1 }] });
    expect(graph.origin).toEqual({ ...result.before_origin, command_revision: "1" });
    for (const domain of ["occurrences", "refs", "inventory", "spells", "feature_grants", "spell_grants"] as const) expect(result.native_rows[domain]).toEqual(graph[domain]);
    expect(graph.versions.map(row => row.content_id)).toEqual([feature, dormantFeature, spell, dormantSpell, content]);
    expect(graph.versions.every(row => JSON.stringify(row.unparsed_snapshot) === '{"untouched":[2,1]}')).toBe(true);
    expect(classOriginGraphSchema.safeParse(graph).success).toBe(true);
    expect(await materialize(result)).toEqual(graph);
  });
  it("generates native fresh unique IDs, binds derived rows to real grants, and preserves native clock defaults", async () => {
    const a = await allocate(), b = await allocate(), graph = a.expected_graph;
    const ids = Object.values(a.native_rows).flat().map(row => String(row.id));
    expect(ids).toHaveLength(8); expect(new Set(ids).size).toBe(8);
    for (const value of [a.acceptance_id, ...ids]) expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(new Set([...ids, ...Object.values(b.native_rows).flat().map(row => row.id)]).size).toBe(16);
    expect(graph.refs[1]).toMatchObject({ feature_grant_id: graph.feature_grants[0].id, choice_source: `auto:feature-grant:${graph.feature_grants[0].id}` });
    expect(graph.spells[0].spell_grant_id).toBe(graph.spell_grants[0].id);
    const times = [...graph.refs, ...graph.feature_grants, ...graph.spell_grants, ...graph.spells].map(row => row.created_at);
    for (const time of times) expect((await db.query<{ ok: boolean }>("SELECT $1::timestamptz=transaction_timestamp() AS ok", [time])).rows[0].ok).toBe(true);
    expect((await db.query<{ ok: boolean }>("SELECT $1::timestamptz=$2::timestamptz AND isfinite($1::timestamptz) AS ok", [graph.occurrences[0].selected_at, a.receipt.accepted_at])).rows[0].ok).toBe(true);
    expect(a.transaction_id).toBe((await db.query<{ xid: string }>("SELECT pg_current_xact_id()::text AS xid")).rows[0].xid);
  });
  it("produces an original strict receipt proposal and only the three private transitions", async () => {
    const result = await allocate();
    expect((await db.query<{ ok: boolean }>("SELECT private.class_origin_receipt_shape_v1($1) AS ok", [result.receipt])).rows[0].ok).toBe(true);
    expect(classOriginReceiptSchema.safeParse(result.receipt).success).toBe(true);
    expect(result.planned_transitions.every(row => classOriginPlannedTransitionSchema.safeParse(row).success)).toBe(true);
    expect(result.receipt).toMatchObject({ canonical_intent: intent(), verified_actor_id: owner, confirmation: null });
    expect(result.planned_transitions).toEqual([
      { relation_key: "origin", row_key: [target], before_row: result.before_origin, after_row: result.expected_graph.origin },
      { relation_key: "occurrence", row_key: [result.expected_graph.occurrences[0].id], before_row: null, after_row: result.expected_graph.occurrences[0] },
      { relation_key: "class_receipt", row_key: [target, intent().operation_id], before_row: null, after_row: { character_id: target, operation_id: intent().operation_id, receipt: result.receipt } },
    ]);
  });
  it("feeds the actual native graph into existing save classification without guessing manifests or confirmation", async () => {
    const result = await allocate(), before = structuredClone(result), model = role(result);
    expect(model.status).toBe("unavailable");
    if (model.status === "invalid_evidence") throw Error(model.messages.join(";"));
    expect(model.role_state).toBe("provisional"); expect(model.excluded).toEqual([]);
    expect(model.saveAvailability.strength.issues.map(issue => issue.reason)).toEqual(["DRAFT_UNCONFIRMED", "SAVE_OCCURRENCE_UNAVAILABLE"]);
    expect(model.saveAvailability.charisma.status).toBe("available");
    expect(model.originalEffects).toEqual(result.expected_graph.refs.flatMap(ref => result.expected_graph.versions.find(v => v.content_id === ref.content_id && v.version === ref.content_version)!.effects_snapshot as unknown[]));
    expect(model.evaluationEffects).toEqual(model.originalEffects); expect(result).toEqual(before);
  });
  it.each(["missing-version", "extra-version", "duplicate-version", "wrong-order", "foreign-pin", "wrong-controller",
    "invalid-revision", "unsupported-subclass", "wrong-feature-link", "wrong-spell-link", "wrong-grant-controller"])("refuses broken native save evidence: %s", async kind => {
    const result = await allocate(), graph = structuredClone(result.expected_graph);
    if (kind === "missing-version") graph.versions.pop();
    if (kind === "extra-version") graph.versions.push({ ...graph.versions[0], content_id: roleId(999) });
    if (kind === "duplicate-version") graph.versions.push(graph.versions[0]);
    if (kind === "wrong-order") (graph.order.pins as string[]).reverse();
    if (kind === "foreign-pin") graph.refs[0].character_id = roleId(999);
    if (kind === "wrong-controller") graph.occurrences[0].controller_ref_id = graph.refs[1].id;
    if (kind === "invalid-revision") graph.parent.action_revision = graph.order.producer_revision = "01";
    if (kind === "unsupported-subclass") graph.occurrences[0].subclass_ref_id = graph.refs[1].id;
    if (kind === "wrong-feature-link") graph.refs[1].feature_grant_id = graph.feature_grants[1].id;
    if (kind === "wrong-spell-link") graph.spells[0].spell_grant_id = graph.spell_grants[1].id;
    if (kind === "wrong-grant-controller") graph.feature_grants[0].controller_ref_id = graph.refs[1].id;
    expect(role(result, graph).status).toBe("invalid_evidence");
  });
  it("preserves raw legacy save namespaces and never invents a compatible effect", async () => {
    await db.query("UPDATE public.content_versions SET effects_snapshot=$1 WHERE content_id=$2", [[{ type: "grant", stat: "save_strength", value: "proficient", raw: [2, 1] }], content]);
    const result = await allocate(), model = role(result);
    if (model.status === "invalid_evidence") throw Error(model.messages.join(";"));
    expect(model.saveAvailability.strength.issues.some(issue => issue.reason === "LEGACY_SAVE_NAMESPACE")).toBe(true);
    expect(model.originalEffects[0]).toEqual({ type: "grant", stat: "save_strength", value: "proficient", raw: [2, 1] });
  });
  it("keeps the draft provisional even with an explicitly supplied matching advisory save manifest", async () => {
    const result = await allocate(), manifests = classRoleFixture().manifests.filter(row => row.content_id === content);
    const before = structuredClone(manifests), model = role(result, result.expected_graph, manifests);
    if (model.status === "invalid_evidence") throw Error(model.messages.join(";"));
    expect(model.role_state).toBe("provisional"); expect(model.excluded).toEqual([]);
    expect(model.saveAvailability.strength.issues.map(issue => issue.reason)).toEqual(["DRAFT_UNCONFIRMED"]);
    expect(model.evaluationEffects).toEqual(model.originalEffects); expect(manifests).toEqual(before);
  });
  it("refuses oversized request envelopes and unsupported non-JSON save evidence", async () => {
    await refuses("54000", { ...intent(), extra: "x".repeat(32768) });
    const result = await allocate();
    const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
    expect(role(result, cyclic).status).toBe("invalid_evidence");
    expect(collectClassRoleEffectsFromNativeGraph({ graph: result.expected_graph, system: classRoleFixture().system,
      currentProficiencyBonus: 2, manifests: undefined }).status).toBe("invalid_evidence");
  });
  it.each([null, {}, { ...intent(), actor_id: owner }, { ...intent(), expected_action_revision: "1" },
    { ...intent(), operation_id: "00000000-0000-0000-0000-000000000001" },
    { ...intent(), fields: { ...intent().fields, subclass: { content_id: feature, content_version: 1 } } },
    { ...intent(), fields: { ...intent().fields, content_version: 0 } },
  ])("refuses unsupported requests without dropping existing state: %j", async request => { await refuses("22023", request); });
  it("refuses an existing native graph even when parent/revision/order are reset to look empty", async () => {
    const result = await allocate(); await materialize(result);
    // A target with native rows is unsupported even if its parent choices and
    // revisions are reset to values that superficially resemble empty bootstrap.
    await db.query("UPDATE public.characters SET choices='{}',action_revision=0 WHERE id=$1", [target]);
    await db.query("UPDATE private.character_class_origin_v1 SET command_revision=0 WHERE character_id=$1", [target]);
    await db.query("UPDATE private.character_projection_order_v1 SET producer_revision=0,pins='{}',spells='{}',feature_grants='{}',spell_grants='{}' WHERE character_id=$1", [target]);
    await insert("public.character_inventory", { id: roleId(950), character_id: target, content_id: content, content_version: 1 });
    await refuses("23514");
  });
  it.each(["owner", "creation-operation"])("refuses stored UUIDs unsupported by strict receipt/evidence schemas: %s", async field => {
    if (field === "owner") await db.exec("UPDATE public.characters SET user_id='00000000-0000-0000-0000-000000000001'");
    else await db.exec("UPDATE private.character_class_origin_v1 SET creation_operation_id='00000000-0000-0000-0000-000000000001'");
    await refuses("23514");
  });
  it("has invoker volatility, empty path, postgres owner and no API execution in this model", async () => {
    const meta = (await db.query<Row>(`SELECT p.prosecdef,p.provolatile,p.proconfig,r.rolname,
      has_function_privilege('anon',p.oid,'EXECUTE') AS anon,has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated,
      has_function_privilege('service_role',p.oid,'EXECUTE') AS service_role FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
      WHERE p.oid='private.allocate_first_class_save_envelope_v1(jsonb)'::regprocedure`)).rows[0];
    expect(meta).toEqual({ prosecdef: false, provolatile: "v", proconfig: ['search_path=""'], rolname: "postgres", anon: false, authenticated: false, service_role: false });
  });
});
