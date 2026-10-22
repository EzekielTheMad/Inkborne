// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { classRoleFixture, roleId } from "@/tests/fixtures/class-role-effects";
import { collectClassRoleEffectsFromNativeGraph } from "@/lib/character/class-role-effects-native-graph";
import { classOriginGraphSchema, classOriginReceiptSchema, classOriginPlannedTransitionSchema } from "@/lib/character/class-origin-command-schema";

// Offline calculation and exact raw-row/save-evidence compatibility only. No
// production admission/RLS/materializer triggers or Auth replacement. Historical
// rows below are explicitly synthetic; new calculation guards run unchanged.
const db = new PGlite();
const target = roleId(1), system = roleId(2), owner = roleId(9), content = roleId(110);
const feature = roleId(30), dormantFeature = roleId(31), spell = roleId(40), dormantSpell = roleId(41);
const producer = readFileSync("supabase/staged/class-origin-producer.sql", "utf8");
const authority = readFileSync("supabase/staged/hit-die-authority-and-writers.sql", "utf8");
const featureSql = readFileSync("supabase/migrations/20260720185127_feature_grant_integrity.sql", "utf8");
const featureTable = readFileSync("supabase/migrations/20260720173545_content_version_policy_performance.sql", "utf8");
const spellSql = readFileSync("supabase/migrations/20260720185149_feature_spell_grants.sql", "utf8");
let historicalTransaction = "";
let fixtureDump: Blob;
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
  for (const name of ["private.character_class_origin_v1", "private.character_class_occurrences_v1", "private.character_class_commands_v1",
    "private.character_creation_commands_v1", "private.class_writer_acceptance_v1", "private.class_writer_row_transitions_v1"]) await db.exec(table(producer, name));
  for (const name of ["private.character_projection_order_v1", "private.character_writer_guard_v1"]) await db.exec(table(authority, name));
  await db.exec(table(producer, "private.class_origin_gate_v1"));
  await db.exec("INSERT INTO private.class_origin_gate_v1(singleton) VALUES(true)");
  await db.exec(table(authority, "private.character_writer_readiness_v1"));
  for (const family of ["auth", "order", "state", "character_choices", "refs", "feature_grants", "spell_grants", "inventory", "spells", "shared_rules_access", "version_identity", "copy_award", "lifecycle"]) {
    await db.query("INSERT INTO private.character_writer_readiness_v1(family) VALUES($1)", [family]);
  }
  await db.exec("INSERT INTO private.character_writer_guard_v1(singleton) VALUES(true)");
  await db.exec(table(featureTable, "public.character_feature_grants"));
  await db.exec(table(spellSql, "public.character_spell_grants"));
  await db.exec("ALTER TABLE public.character_content_refs ADD FOREIGN KEY(feature_grant_id) REFERENCES public.character_feature_grants(id)");
  for (const [source, name] of [[featureSql, "private.character_can_access_content_version"],
    [authority, "private.lock_character_writer_guard_v1"], [producer, "private.class_origin_ids_match_v1"],
    [producer, "private.class_origin_read_final_graph_v1"], [producer, "private.class_origin_exact_keys_v1"],
    [producer, "private.class_origin_decimal_v1"], [producer, "private.class_origin_uuid_v1"],
    [producer, "private.class_origin_instant_v1"], [producer, "private.class_origin_receipt_shape_v1"],
    [producer, "private.require_class_origin_auth_v1"], [authority, "private.require_verified_hit_die_auth_v1"]]) await db.exec(definition(source, name));
  await db.exec(readFileSync("supabase/staged/class-first-acquisition-dependencies.sql", "utf8"));
  await db.exec(readFileSync("supabase/staged/class-first-acquisition-allocation.sql", "utf8"));
  await db.exec(readFileSync("supabase/staged/class-first-acquisition-calculations.sql", "utf8"));
  historicalTransaction = (await db.query<{ xid: string }>("SELECT pg_current_xact_id()::text AS xid")).rows[0].xid;
  fixtureDump = await db.dumpDataDir("gzip");
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

type BootstrapHistory = { before_parent: Row; before_origin: Row; before_order: Row; creation_receipt_row: Row;
  bootstrap_acceptance_id: string; bootstrap_journal: Row; bootstrap_transitions: Row[] };
type Calculation = { calculation_id: string; calculation_kind: string; transaction_id: string; target_character_id: string;
  subject_owner_id: string; operation_id: string; bootstrap_acceptance_id: string; canonical_intent: Row;
  bootstrap_history: BootstrapHistory; allocation_envelope: Envelope; created_at: string };
const bootstrapId = roleId(900);
async function readHistory() {
  return (await db.query<{ history: BootstrapHistory }>("SELECT private.read_first_class_bootstrap_history_v1($1) AS history", [target])).rows[0].history;
}
async function prepare(request: unknown = intent()) {
  return (await db.query<{ calculation: Calculation }>("SELECT private.prepare_first_class_calculation_v1($1) AS calculation", [request])).rows[0].calculation;
}
async function historyState() {
  const before = await state();
  for (const relation of ["private.character_creation_commands_v1", "private.character_class_commands_v1",
    "private.class_writer_acceptance_v1", "private.class_writer_row_transitions_v1"]) {
    before[relation] = (await db.query(`SELECT COALESCE(jsonb_agg(to_jsonb(snapshot) ORDER BY to_jsonb(snapshot)::text),'[]') AS rows FROM ${relation} snapshot`)).rows;
  }
  return before;
}
async function calculationRows() {
  return (await db.query<{ row: Calculation }>("SELECT to_jsonb(record) AS row FROM private.class_first_allocation_calculations_v1 record ORDER BY calculation_id")).rows.map(row => row.row);
}
async function refusal(code: string, action: () => Promise<unknown>) {
  const before = await historyState(), records = await calculationRows();
  await db.exec("SAVEPOINT calculation_refusal");
  await expect(action()).rejects.toMatchObject({ code });
  await db.exec("ROLLBACK TO SAVEPOINT calculation_refusal; RELEASE SAVEPOINT calculation_refusal");
  expect(await historyState()).toEqual(before); expect(await calculationRows()).toEqual(records);
}
async function seedHistory() {
  // Manually persisted synthetic historical correspondence. This deliberately
  // does not call/replace Auth or pretend the disabled bootstrap issuer ran.
  const parent = (await db.query<{ row: Row }>("SELECT to_jsonb(c)||jsonb_build_object('action_revision',c.action_revision::text) AS row FROM public.characters c WHERE id=$1", [target])).rows[0].row;
  const origin = (await db.query<{ row: Row }>("SELECT to_jsonb(o)||jsonb_build_object('command_revision',o.command_revision::text) AS row FROM private.character_class_origin_v1 o WHERE character_id=$1", [target])).rows[0].row;
  const order = (await db.query<{ row: Row }>("SELECT to_jsonb(o)||jsonb_build_object('producer_revision',o.producer_revision::text) AS row FROM private.character_projection_order_v1 o WHERE character_id=$1", [target])).rows[0].row;
  const instant = (await db.query<{ time: string }>(`SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS time`)).rows[0].time;
  const receipt = { receipt_version: 1, receipt_kind: "bootstrap_new", operation_id: roleId(4), verified_actor_id: owner,
    target_character_id: target, accepted_at: instant, canonical_intent: { contract_version: 1, operation_id: roleId(4), command: "create_character",
      fields: { name: parent.name, system_id: system, campaign_id: null } }, initial_action_revision: "0", initial_class_revision: "0",
    initial_producer_revision: "0", copy_lineage: null };
  const creation = { verified_actor_id: owner, operation_id: roleId(4), target_character_id: target, receipt };
  const transitions = [{ relation_key: "origin", row_key: [target], before_row: null, after_row: origin },
    { relation_key: "creation_receipt", row_key: [owner, roleId(4)], before_row: null, after_row: creation }];
  const graph = { parent, origin, order, occurrences: [], refs: [], inventory: [], spells: [], feature_grants: [], spell_grants: [], versions: [] };
  const journal = { acceptance_id: bootstrapId, transaction_id: historicalTransaction, verified_actor_id: owner, target_character_id: target,
    acceptance_kind: "bootstrap_new", before_parent: null, before_origin: null,
    preinsert_proof: { acceptance_id: bootstrapId, target_character_id: target, transaction_id: historicalTransaction, captured_at: instant },
    expected_graph: graph, planned_transitions: transitions, receipt, revision_transition_consumed: false, finalized: true };
  await insert("private.character_creation_commands_v1", creation);
  await insert("private.class_writer_acceptance_v1", journal);
  for (const transition of transitions) await insert("private.class_writer_row_transitions_v1", { acceptance_id: bootstrapId, ...transition, consumed: true });
  return { parent, origin, order, creation, journal, transitions };
}

describe("immutable preacceptance calculations over synthetic bootstrap history, no admission", () => {
  beforeEach(async () => { await seedHistory(); });
  it("reads exact original receipt/journal/two-proof correspondence without a future acceptance", async () => {
    const before = await historyState(), history = await readHistory();
    expect(history.bootstrap_acceptance_id).toBe(bootstrapId);
    expect(history.bootstrap_transitions.map(row => row.relation_key)).toEqual(["origin", "creation_receipt"]);
    expect(history.bootstrap_transitions.every(row => row.consumed === true)).toBe(true);
    expect(history.before_parent).toEqual(history.bootstrap_journal.expected_graph && (history.bootstrap_journal.expected_graph as Row).parent);
    expect(await historyState()).toEqual(before); expect(await calculationRows()).toEqual([]);
  });
  it("derives and stores the exact complete envelope and history without changing original rows", async () => {
    const before = await historyState(), calculation = await prepare();
    expect(calculation.calculation_kind).toBe("unverified_preacceptance_calculation");
    expect(calculation).toMatchObject({ target_character_id: target, subject_owner_id: owner, operation_id: intent().operation_id,
      bootstrap_acceptance_id: bootstrapId, canonical_intent: intent() });
    expect(calculation.transaction_id).toBe(calculation.allocation_envelope.transaction_id);
    expect(calculation.allocation_envelope.before_parent).toEqual(calculation.bootstrap_history.before_parent);
    expect(calculation.allocation_envelope.before_origin).toEqual(calculation.bootstrap_history.before_origin);
    expect(calculation.allocation_envelope.before_order).toEqual(calculation.bootstrap_history.before_order);
    expect(await calculationRows()).toEqual([calculation]); expect(await historyState()).toEqual(before);
    expect(calculation.allocation_envelope.expected_graph.feature_grants).toHaveLength(2);
    expect(calculation.allocation_envelope.expected_graph.spell_grants).toHaveLength(2);
  });
  it("reuses only the same transaction's original exact-intent record and refuses changed intent", async () => {
    const first = await prepare();
    expect(await prepare()).toEqual(first); expect(await calculationRows()).toHaveLength(1);
    await refusal("23514", () => prepare({ ...intent(), operation_id: roleId(801) }));
  });
  it("same-transaction retrieval returns historical evidence without pretending to revalidate changed sources", async () => {
    const first = await prepare();
    await db.query("DELETE FROM public.content_versions WHERE content_id=$1", [feature]);
    expect(await prepare()).toEqual(first);
    expect((await prepare()).calculation_kind).toBe("unverified_preacceptance_calculation");
  });
  it("rejects caller-provided protected fields even through direct INSERT", async () => {
    await refusal("42501", () => db.query(`INSERT INTO private.class_first_allocation_calculations_v1(canonical_intent,allocation_envelope)
      VALUES($1,'{"caller":"forged"}')`, [intent()]));
    await refusal("42501", () => db.query(`INSERT INTO private.class_first_allocation_calculations_v1(canonical_intent,calculation_kind)
      VALUES($1,'unverified_preacceptance_calculation')`, [intent()]));
    await refusal("22023", () => prepare({ ...intent(), actor_id: owner }));
  });
  it("derives all protected fields for a direct intent-only INSERT as well", async () => {
    const record = (await db.query<{ row: Calculation }>(`INSERT INTO private.class_first_allocation_calculations_v1(canonical_intent)
      VALUES($1) RETURNING to_jsonb(class_first_allocation_calculations_v1) AS row`, [intent()])).rows[0].row;
    expect(record.calculation_kind).toBe("unverified_preacceptance_calculation");
    expect(record.allocation_envelope.receipt.canonical_intent).toEqual(intent());
    expect(await prepare()).toEqual(record);
  });
  it.each(["UPDATE", "DELETE", "TRUNCATE"])("rejects %s of retained evidence", async operation => {
    await prepare();
    const command = operation === "UPDATE" ? "UPDATE private.class_first_allocation_calculations_v1 SET calculation_kind='verified'"
      : operation === "DELETE" ? "DELETE FROM private.class_first_allocation_calculations_v1" : "TRUNCATE private.class_first_allocation_calculations_v1";
    await refusal("42501", () => db.exec(command));
  });
  it.each(["missing-creation", "missing-journal", "duplicate-journal", "unfinalized", "wrong-proof-target", "bad-capture-time",
    "missing-proof", "extra-proof", "unconsumed-proof", "wrong-after-row", "planned-set-mismatch", "changed-parent", "nonempty-order"])("refuses mismatched stored history: %s", async kind => {
    if (kind === "missing-creation") await db.exec("DELETE FROM private.character_creation_commands_v1");
    if (kind === "missing-journal") { await db.exec("DELETE FROM private.class_writer_row_transitions_v1"); await db.exec("DELETE FROM private.class_writer_acceptance_v1"); }
    if (kind === "duplicate-journal") {
      const journal = (await readHistory()).bootstrap_journal;
      await insert("private.class_writer_acceptance_v1", { ...journal, acceptance_id: roleId(901), transaction_id: String(BigInt(historicalTransaction) + BigInt(1)) });
    }
    if (kind === "unfinalized") await db.exec("UPDATE private.class_writer_acceptance_v1 SET finalized=false");
    if (kind === "wrong-proof-target") await db.query("UPDATE private.class_writer_acceptance_v1 SET preinsert_proof=jsonb_set(preinsert_proof,'{target_character_id}',to_jsonb($1::text))", [roleId(999)]);
    if (kind === "bad-capture-time") await db.exec(`UPDATE private.class_writer_acceptance_v1 SET preinsert_proof=jsonb_set(preinsert_proof,'{captured_at}','"infinity"')`);
    if (kind === "missing-proof") await db.exec("DELETE FROM private.class_writer_row_transitions_v1 WHERE relation_key='origin'");
    if (kind === "extra-proof") await insert("private.class_writer_row_transitions_v1", { acceptance_id: bootstrapId, relation_key: "class_receipt", row_key: [target, roleId(800)], before_row: null, after_row: {}, consumed: true });
    if (kind === "unconsumed-proof") await db.exec("UPDATE private.class_writer_row_transitions_v1 SET consumed=false WHERE relation_key='origin'");
    if (kind === "wrong-after-row") await db.exec(`UPDATE private.class_writer_row_transitions_v1 SET after_row='{}' WHERE relation_key='origin'`);
    if (kind === "planned-set-mismatch") await db.exec(`UPDATE private.class_writer_acceptance_v1 SET planned_transitions=jsonb_set(planned_transitions,'{0,after_row}','{}')`);
    if (kind === "changed-parent") await db.exec("UPDATE public.characters SET name='Changed after bootstrap'");
    if (kind === "nonempty-order") await db.query("UPDATE private.character_projection_order_v1 SET pins=ARRAY[$1::uuid]", [roleId(999)]);
    await refusal("23514", () => prepare()); expect(await calculationRows()).toEqual([]);
  });
  it("preserves the original bootstrap constraint against a fabricated consumed revision", async () => {
    await refusal("23514", () => db.exec("UPDATE private.class_writer_acceptance_v1 SET revision_transition_consumed=true"));
    expect(await calculationRows()).toEqual([]);
  });
  it("checks existing command identity before NEW history/source conditions and leaves recovery to Auth", async () => {
    await insert("private.character_class_commands_v1", { character_id: target, operation_id: intent().operation_id, receipt: { historical: true } });
    await db.exec("DELETE FROM private.character_creation_commands_v1");
    await db.query("UPDATE public.characters SET choices=$1,action_revision=9", [{ changed: true }]);
    await refusal("23514", () => prepare());
    await db.exec("SAVEPOINT prefix_message");
    await expect(prepare()).rejects.toThrow("existing_command_requires_authenticated_recovery");
    await db.exec("ROLLBACK TO SAVEPOINT prefix_message; RELEASE SAVEPOINT prefix_message");
    await db.exec("SAVEPOINT direct_prefix");
    await expect(db.query("INSERT INTO private.class_first_allocation_calculations_v1(canonical_intent) VALUES($1)", [intent()]))
      .rejects.toThrow("existing_command_requires_authenticated_recovery");
    await db.exec("ROLLBACK TO SAVEPOINT direct_prefix; RELEASE SAVEPOINT direct_prefix");
  });
  it("rolls back a failed derivation without storing partial evidence", async () => {
    await db.query("DELETE FROM public.content_versions WHERE content_id=$1", [feature]);
    await refusal("23503", () => prepare()); expect(await calculationRows()).toEqual([]);
  });
  it("enforces native record bounds atomically for large historical data", async () => {
    // The original journal graph is bounded separately at4MiB. Extra preinsert
    // data can exceed the new history budget and must not be silently dropped.
    await db.query("UPDATE private.class_writer_acceptance_v1 SET preinsert_proof=preinsert_proof||jsonb_build_object('raw',$1::text)", ["x".repeat(8 * 1024 * 1024)]);
    await refusal("54000", () => prepare());
  });
  it("has closed table/function ACLs, FORCE RLS and explicitly scoped postgres policy in this model", async () => {
    const acl = (await db.query<Row>(`SELECT c.relrowsecurity,c.relforcerowsecurity,
      has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS anon,
      has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS authenticated,
      has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS service_role
      FROM pg_class c WHERE c.oid='private.class_first_allocation_calculations_v1'::regclass`)).rows[0];
    expect(acl).toEqual({ relrowsecurity: true, relforcerowsecurity: true, anon: false, authenticated: false, service_role: false });
    for (const roleName of ["anon", "authenticated", "service_role"]) {
      expect((await db.query<{ allowed: boolean }>("SELECT has_function_privilege($1,'private.prepare_first_class_calculation_v1(jsonb)','EXECUTE') AS allowed", [roleName])).rows[0].allowed).toBe(false);
    }
    const policies = (await db.query<{ roles: string[] }>("SELECT roles FROM pg_policies WHERE schemaname='private' AND tablename='class_first_allocation_calculations_v1'")).rows;
    expect(policies).toEqual([{ roles: ["postgres"] }]);
  });
  it("uses the explicit owner policy under active RLS in this model", async () => {
    // PostgreSQL role attributes are not inherited. This transaction-local
    // fixture role inherits owner privileges/policy, not SUPERUSER/BYPASSRLS.
    // No native/hosted role, source ownership or policy definition is changed.
    await db.exec("CREATE ROLE fixture_calculation_owner INHERIT NOSUPERUSER NOBYPASSRLS");
    await db.exec("GRANT postgres TO fixture_calculation_owner");
    await db.exec("SET LOCAL ROLE fixture_calculation_owner");
    const flags = (await db.query<Row>(`SELECT current_user::text AS actor,rolsuper,rolbypassrls,
      row_security_active('private.class_first_allocation_calculations_v1'::regclass) AS active
      FROM pg_roles WHERE rolname=current_user`)).rows[0];
    expect(flags).toEqual({ actor: "fixture_calculation_owner", rolsuper: false, rolbypassrls: false, active: true });
    const calculation = await prepare();
    expect(await calculationRows()).toEqual([calculation]);
  });
  it.each(["anon", "authenticated", "service_role"])("denies actual calculation calls by %s in this model", async apiRole => {
    await refusal("42501", async () => {
      await db.exec(`SET LOCAL ROLE ${apiRole}`);
      return prepare();
    });
  });
  it("does not enable Auth, acquisition admission or any readiness family", async () => {
    await prepare();
    const gates = (await db.query<Row>(`SELECT (SELECT enabled FROM private.class_origin_gate_v1 WHERE singleton) AS enabled,
      (SELECT count(*)::int FROM private.character_writer_readiness_v1) AS families,
      (SELECT count(*)::int FROM private.character_writer_readiness_v1 WHERE ready) AS ready`)).rows[0];
    expect(gates).toEqual({ enabled: false, families: 13, ready: 0 });
    await refusal("P0001", () => db.query("SELECT private.require_class_origin_auth_v1($1)", [{ actor_id: owner }]));
    await refusal("P0001", () => db.query("SELECT private.require_verified_hit_die_auth_v1($1)", [{ actor_id: owner }]));
  });
  it("retains historical calculations across commits while deriving a fresh record for a new transaction", async () => {
    // Separate cloned in-memory database: committing this test cannot pollute
    // the shared rollback fixture or create native/hosted persistence evidence.
    const isolated = new PGlite({ loadDataDir: fixtureDump });
    try {
      await isolated.exec("BEGIN");
      for (const relation of ["public.characters", "public.content_versions", "private.character_class_origin_v1",
        "private.character_projection_order_v1", "private.character_creation_commands_v1", "private.class_writer_acceptance_v1",
        "private.class_writer_row_transitions_v1"]) {
        const rows = (await db.query<{ row: Row }>(`SELECT to_jsonb(snapshot) AS row FROM ${relation} snapshot`)).rows;
        for (const row of rows) await isolated.query(`INSERT INTO ${relation} SELECT * FROM jsonb_populate_record(NULL::${relation},$1)`, [row.row]);
      }
      const first = (await isolated.query<{ row: Calculation }>("SELECT private.prepare_first_class_calculation_v1($1) AS row", [intent()])).rows[0].row;
      await isolated.exec("COMMIT; BEGIN");
      await isolated.query("DELETE FROM public.content_versions WHERE content_id=$1", [feature]);
      await expect(isolated.query("SELECT private.prepare_first_class_calculation_v1($1)", [intent()])).rejects.toMatchObject({ code: "23503" });
      await isolated.exec("ROLLBACK; BEGIN");
      const second = (await isolated.query<{ row: Calculation }>("SELECT private.prepare_first_class_calculation_v1($1) AS row", [intent()])).rows[0].row;
      expect(second.transaction_id).not.toBe(first.transaction_id); expect(second.calculation_id).not.toBe(first.calculation_id);
      expect(second.allocation_envelope.acceptance_id).not.toBe(first.allocation_envelope.acceptance_id);
      const records = (await isolated.query<{ row: Calculation }>("SELECT to_jsonb(record) AS row FROM private.class_first_allocation_calculations_v1 record")).rows.map(row => row.row);
      expect(records).toHaveLength(2); expect(records).toContainEqual(first); expect(records).toContainEqual(second);
      expect(records.every(row => row.calculation_kind === "unverified_preacceptance_calculation")).toBe(true);
      await isolated.exec("ROLLBACK");
    } finally { await isolated.close(); }
  }, 15_000);
});
