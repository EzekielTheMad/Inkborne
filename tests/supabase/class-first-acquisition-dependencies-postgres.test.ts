// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Offline, single-connection PostgreSQL-WASM calculation proof only. The fixture
// schema omits production RLS/triggers/Auth/locks. Real legacy SQL functions and
// projection INSERTs are executed unchanged; no substitute authorization helper.
const db = new PGlite();
const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const owner = uuid(1), stranger = uuid(2), character = uuid(3), system = uuid(4), campaign = uuid(5), controller = uuid(6);
const feature = uuid(100), laterFeature = uuid(101), spell = uuid(200), laterSpell = uuid(201);
const cutoff = "2026-01-10T00:00:00Z";
const featureSql = readFileSync("supabase/migrations/20260720185127_feature_grant_integrity.sql", "utf8");
const featureTableSql = readFileSync("supabase/migrations/20260720173545_content_version_policy_performance.sql", "utf8");
const spellSql = readFileSync("supabase/migrations/20260720185149_feature_spell_grants.sql", "utf8");
const boundarySql = readFileSync("supabase/migrations/20260720185305_character_content_boundary_guards.sql", "utf8");
function definition(sql: string, name: string) {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION ${name}(`);
  const delimiter = sql.indexOf("AS $$", start), end = sql.indexOf("$$;", delimiter + 5);
  if (start < 0 || delimiter < 0 || end < 0) throw new Error(`Missing real SQL ${name}`);
  return sql.slice(start, end + 3);
}
function table(sql: string, name: string) {
  const start = sql.indexOf(`CREATE TABLE public.${name} (`), end = sql.indexOf("\n);", start);
  if (start < 0 || end < 0) throw new Error(`Missing real table ${name}`);
  return sql.slice(start, end + 3);
}
function projection(sql: string, name: string, relation: string) {
  const body = definition(sql, name), start = body.indexOf(`INSERT INTO public.${relation} (`);
  const end = body.indexOf("GET DIAGNOSTICS", start);
  if (start < 0 || end < 0) throw new Error(`Missing real projection ${relation}`);
  return body.slice(start, end);
}
type Grant = { feature_slug?: string; feature_content_id?: string; feature_version?: number; spell_slug?: string;
  spell_content_id?: string; spell_version?: number; spell_name?: string; unlock_level: number; source_ordinal: number };
type Descriptor = { descriptor_version: number; character_id: string; system_id: string; class_slug: string;
  controller: Record<string, unknown>; feature_grants: Grant[]; spell_grants: Grant[];
  active_feature_refs: Record<string, unknown>[]; active_spells: Record<string, unknown>[]; versions: Record<string, unknown>[] };
type VersionOptions = { id: string; type: string; slug: string; version?: number; system?: string; source?: string;
  scope?: string; owner?: string | null; created?: string; name?: string; data?: unknown };
async function version(v: VersionOptions) {
  await db.query(`INSERT INTO public.content_versions(content_id,version,system_id_snapshot,content_type_snapshot,slug_snapshot,
    name_snapshot,scope_snapshot,source_snapshot,owner_id_snapshot,data_snapshot,created_at,unparsed_snapshot)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'{"retained":true}')`,
  [v.id, v.version ?? 1, v.system ?? system, v.type, v.slug, v.name ?? v.slug, v.scope ?? "platform", v.source ?? "srd",
    v.owner ?? null, v.data ?? {}, v.created ?? "2026-01-01T00:00:00Z"]);
}
async function classData(data: unknown, homebrew = false) {
  await db.query("UPDATE public.content_versions SET data_snapshot=$1,source_snapshot=$2,scope_snapshot=$3,owner_id_snapshot=$4 WHERE content_id=$5",
    [data, homebrew ? "homebrew" : "srd", homebrew ? "private" : "platform", homebrew ? owner : null, controller]);
}
async function resolve(target: string | null = character, content: string | null = controller, revision: number | null = 1) {
  return (await db.query<{ result: Descriptor }>("SELECT private.resolve_first_class_dependencies_v1($1,$2,$3) AS result",
    [target, content, revision])).rows[0].result;
}
async function counts() {
  return (await db.query(`SELECT (SELECT count(*)::int FROM public.character_content_refs) AS refs,
    (SELECT count(*)::int FROM public.character_feature_grants) AS features,
    (SELECT count(*)::int FROM public.character_spell_grants) AS spells,
    (SELECT count(*)::int FROM public.character_spells) AS physical,
    (SELECT choices FROM public.characters WHERE id='${character}') AS choices`)).rows[0];
}
async function refused(code: string, call: () => Promise<unknown> = () => resolve()) {
  const before = await counts();
  await db.exec("SAVEPOINT refused");
  await expect(call()).rejects.toMatchObject({ code });
  await db.exec("ROLLBACK TO SAVEPOINT refused; RELEASE SAVEPOINT refused");
  expect(await counts()).toEqual(before);
}
async function legacyProjection() {
  await db.query("UPDATE public.characters SET choices=$1 WHERE id=$2", [{ classes: [{ slug: "mage", level: 1 }] }, character]);
  const ref = (await db.query<{ id: string }>(`INSERT INTO public.character_content_refs(character_id,content_id,content_version,context)
    VALUES($1,$2,1,'{"source":"class","level":1}') RETURNING id`, [character, controller])).rows[0].id;
  await db.query("SELECT private.materialize_feature_grants_for_ref($1)", [ref]);
  await db.query("SELECT private.materialize_spell_grants_for_ref($1)", [ref]);
  await db.query("SELECT private.fixture_project_dependencies($1)", [character]);
  return {
    features: (await db.query<Omit<Grant, "source_ordinal">>("SELECT feature_slug,feature_content_id,feature_version,unlock_level FROM public.character_feature_grants ORDER BY feature_slug")).rows,
    spells: (await db.query<Omit<Grant, "source_ordinal">>("SELECT spell_slug,spell_content_id,spell_version,spell_name,unlock_level FROM public.character_spell_grants ORDER BY spell_slug")).rows,
    refs: (await db.query(`SELECT g.feature_slug,r.content_id,r.content_version,r.context FROM public.character_content_refs r
      JOIN public.character_feature_grants g ON g.id=r.feature_grant_id ORDER BY g.feature_slug`)).rows,
    physical: (await db.query<Record<string, unknown>>(`SELECT g.spell_slug,s.content_id,s.content_version,s.name,s.class_slug,s.is_known,s.is_prepared,
      s.always_prepared,s.in_spellbook,s.source,s.custom_data FROM public.character_spells s
      JOIN public.character_spell_grants g ON g.id=s.spell_grant_id ORDER BY g.spell_slug`)).rows,
  };
}
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA private;
    CREATE TABLE public.characters(id uuid PRIMARY KEY,user_id uuid NOT NULL,system_id uuid NOT NULL,campaign_id uuid,choices jsonb);
    CREATE TABLE public.content_versions(content_id uuid,version integer,system_id_snapshot uuid,content_type_snapshot text,
      slug_snapshot text,name_snapshot text,scope_snapshot text,source_snapshot text,owner_id_snapshot uuid,data_snapshot jsonb,
      created_at timestamptz,unparsed_snapshot jsonb,PRIMARY KEY(content_id,version));
    CREATE TABLE public.content_shares(content_id uuid,campaign_id uuid);
    CREATE TABLE public.campaign_members(campaign_id uuid,user_id uuid);
    CREATE TABLE public.character_content_refs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),character_id uuid REFERENCES public.characters,
      content_id uuid,content_version integer,context jsonb,choice_source text,feature_grant_id uuid UNIQUE,
      created_at timestamptz DEFAULT now(),UNIQUE(id,character_id));
    CREATE TABLE public.character_spells(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),character_id uuid,content_id uuid,
      content_version integer,name text,class_slug text,is_known boolean DEFAULT false,is_prepared boolean DEFAULT false,
      always_prepared boolean DEFAULT false,in_spellbook boolean DEFAULT false,source text DEFAULT 'selection',custom_data jsonb,
      created_at timestamptz DEFAULT now(),spell_grant_id uuid UNIQUE,UNIQUE(character_id,content_id,class_slug));`);
  await db.exec(table(featureTableSql, "character_feature_grants"));
  await db.exec(table(spellSql, "character_spell_grants"));
  for (const [source, name] of [[featureSql, "private.character_can_access_content_version"],
    [featureSql, "private.materialize_feature_grants_for_ref"], [spellSql, "private.materialize_spell_grants_for_ref"],
    [boundarySql, "private.is_character_feature_grant_active"], [spellSql, "private.is_character_spell_grant_active"],
    [spellSql, "private.active_character_spell_grant_representatives"]]) await db.exec(definition(source, name));
  // Only the production INSERT substatements are isolated here. This deliberately
  // does not execute/replace auth.uid(), the public RPC admission, or its locks.
  await db.exec(`CREATE FUNCTION private.fixture_project_dependencies(target_character_id uuid) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
    ${projection(boundarySql, "public.sync_character_feature_refs", "character_content_refs")}
    ${projection(spellSql, "public.sync_character_spell_grants", "character_spells")} END $$;`);
  await db.exec(readFileSync("supabase/staged/class-first-acquisition-dependencies.sql", "utf8"));
}, 30_000);
beforeEach(async () => {
  await db.exec("BEGIN");
  await db.query("INSERT INTO public.characters VALUES($1,$2,$3,NULL,$4)", [character, owner, system, { untouched: true, classes: [{ slug: "unrelated", level: 17 }] }]);
  await version({ id: controller, type: "class", slug: "mage", created: cutoff, data: { levels: [{ level: 1, features: ["first"] }] } });
  await version({ id: feature, type: "feature", slug: "first" });
  await version({ id: laterFeature, type: "feature", slug: "later" });
  await version({ id: spell, type: "spell", slug: "spark", name: "Spark" });
  await version({ id: laterSpell, type: "spell", slug: "nova", name: "Nova" });
});
afterEach(async () => { await db.exec("ROLLBACK"); });
afterAll(async () => { await db.close(); });

describe("first-class dependency descriptor: offline SQL calculation, no allocation/authority proof", () => {
  it("matches real legacy materialization/projections, retaining all dormant grants and raw snapshots", async () => {
    await classData({ levels: [{ level: 5, features: ["first", "later"] }, { level: 1, features: ["first"] }],
      spellcastingExtra: [{ level: 7, spells: ["spark", "nova"] }, { level: 1, spells: ["spark"] }] });
    const before = await counts(), result = await resolve();
    expect(await counts()).toEqual(before);
    expect(result).toMatchObject({ descriptor_version: 1, character_id: character, system_id: system, class_slug: "mage" });
    expect(result.feature_grants.map(g => [g.feature_slug, g.unlock_level, g.source_ordinal])).toEqual([["first", 1, 1], ["later", 5, 2]]);
    expect(result.spell_grants.map(g => [g.spell_slug, g.unlock_level, g.source_ordinal])).toEqual([["spark", 1, 1], ["nova", 7, 2]]);
    const legacy = await legacyProjection();
    const strip = (grant: Grant): Omit<Grant, "source_ordinal"> => {
      const result = { ...grant };
      Reflect.deleteProperty(result, "source_ordinal");
      return result;
    };
    expect(result.feature_grants.map(strip).sort((a, b) => a.feature_slug!.localeCompare(b.feature_slug!))).toEqual(legacy.features);
    expect(result.spell_grants.map(strip).sort((a, b) => a.spell_slug!.localeCompare(b.spell_slug!))).toEqual(legacy.spells);
    expect(result.active_feature_refs).toEqual(legacy.refs);
    expect(result.active_spells).toEqual(legacy.physical);
    expect(result.versions.map(v => v.content_id).sort()).toEqual([controller, feature, laterFeature, spell, laterSpell].sort());
    expect(result.versions.every(v => JSON.stringify(v.unparsed_snapshot) === '{"retained":true}')).toBe(true);
  });
  it.each([
    ["objects", [{ level: 1, spells: [" spark "] }, { level: "4", spells: ["nova", "spark"] }]],
    ["arrays", [[" spark "], ["nova", "spark"]]], ["strings", [" spark ", "nova", "spark"]],
  ])("matches native spell manifest form: %s", async (_name, entries) => {
    await classData({ levels: [], spellcastingExtra: entries });
    const result = await resolve(), legacy = await legacyProjection();
    expect(result.spell_grants.map(g => ({ spell_slug: g.spell_slug, spell_content_id: g.spell_content_id,
      spell_version: g.spell_version, spell_name: g.spell_name, unlock_level: g.unlock_level }))
      .sort((a, b) => a.spell_slug!.localeCompare(b.spell_slug!))).toEqual(legacy.spells);
    expect(result.active_spells).toEqual(legacy.physical);
  });
  it("excludes newer and wrong-system snapshots and retains exact original snapshot metadata", async () => {
    await version({ id: feature, version: 2, type: "feature", slug: "first", created: "2026-01-11T00:00:00Z" });
    await version({ id: uuid(102), system: uuid(999), type: "feature", slug: "first", created: "2026-01-09T00:00:00Z" });
    const result = await resolve();
    expect(result.feature_grants[0]).toMatchObject({ feature_content_id: feature, feature_version: 1 });
    expect(result.versions).toHaveLength(2);
    expect(result.controller.unparsed_snapshot).toEqual({ retained: true });
  });
  it("refuses a genuinely tied highest feature rank without rejecting duplicate manifest references", async () => {
    await version({ id: uuid(102), type: "feature", slug: "first" });
    await refused("23514");
    await version({ id: feature, version: 2, type: "feature", slug: "first", created: "2026-01-09T00:00:00Z" });
    await classData({ levels: [{ level: 3, features: ["first", "first"] }, { level: 1, features: ["first"] }] });
    const result = await resolve();
    expect(result.feature_grants).toHaveLength(1);
    expect(result.feature_grants[0]).toMatchObject({ feature_content_id: feature, feature_version: 2, unlock_level: 1, source_ordinal: 1 });
  });
  it("uses homebrew owner preference for feature and spell candidates", async () => {
    await classData({ levels: [{ level: 1, features: ["first"] }], spellcastingExtra: ["spark"] }, true);
    await version({ id: uuid(102), type: "feature", slug: "first", owner, scope: "private", source: "homebrew" });
    await version({ id: uuid(202), type: "spell", slug: "spark", owner, scope: "private", source: "homebrew" });
    const result = await resolve();
    expect(result.feature_grants[0].feature_content_id).toBe(uuid(102));
    expect(result.spell_grants[0].spell_content_id).toBe(uuid(202));
    const legacy = await legacyProjection();
    expect(legacy.features[0].feature_content_id).toBe(uuid(102));
    expect(legacy.spells[0].spell_content_id).toBe(uuid(202));
  });
  it("uses the native total spell ordering, including final content ID", async () => {
    await classData({ levels: [], spellcastingExtra: ["spark"] });
    await version({ id: uuid(199), type: "spell", slug: "spark" });
    const result = await resolve(), legacy = await legacyProjection();
    expect(result.spell_grants[0].spell_content_id).toBe(uuid(199));
    expect(legacy.spells[0].spell_content_id).toBe(uuid(199));
  });
  it("refuses allocation-dependent active spell representatives after historical slug changes", async () => {
    await version({ id: spell, version: 2, type: "spell", slug: "renamed", name: "Renamed", created: "2026-01-09T00:00:00Z" });
    await classData({ levels: [], spellcastingExtra: [{ level: 1, spells: ["spark", "renamed"] }] });
    await refused("23514");
    // The actual native projection emits one row, selected by grant UUID at
    // equal unlock level. A calculation that has allocated no IDs cannot choose.
    const legacy = await legacyProjection();
    expect(legacy.spells).toHaveLength(2);
    expect(legacy.physical).toHaveLength(1);
    expect(legacy.physical[0].content_id).toBe(spell);
  });
  it("keeps dormant historical slug variants while collapsing harmless repeated slugs", async () => {
    await version({ id: spell, version: 2, type: "spell", slug: "renamed", name: "Renamed", created: "2026-01-09T00:00:00Z" });
    await classData({ levels: [], spellcastingExtra: [{ level: 1, spells: ["spark", "spark"] }, { level: 3, spells: ["renamed"] }] });
    const result = await resolve(), legacy = await legacyProjection();
    expect(result.spell_grants).toHaveLength(2);
    expect(result.active_spells).toEqual(legacy.physical);
    expect(result.versions.filter(v => v.content_id === spell)).toHaveLength(2);
  });
  it("requires an existing target and exact accessible class version in the target system", async () => {
    await refused("23503", () => resolve(uuid(999)));
    await refused("23503", () => resolve(character, controller, 2));
    await refused("23503", () => resolve(character, feature));
    await db.query("UPDATE public.content_versions SET system_id_snapshot=$1 WHERE content_id=$2", [uuid(999), controller]);
    await refused("23503");
    await db.query("UPDATE public.content_versions SET system_id_snapshot=$1,scope_snapshot='private',owner_id_snapshot=$2 WHERE content_id=$3", [system, stranger, controller]);
    await refused("23503");
  });
  it("permits current campaign-shared homebrew spells only while character owner is a member", async () => {
    await classData({ levels: [], spellcastingExtra: ["shared"] }, true);
    await version({ id: uuid(203), type: "spell", slug: "shared", owner: stranger, scope: "shared", source: "homebrew" });
    await db.query("UPDATE public.characters SET campaign_id=$1 WHERE id=$2", [campaign, character]);
    await db.query("INSERT INTO public.content_shares VALUES($1,$2)", [uuid(203), campaign]);
    await refused("23503");
    await db.query("INSERT INTO public.campaign_members VALUES($1,$2)", [campaign, owner]);
    expect((await resolve()).spell_grants[0].spell_content_id).toBe(uuid(203));
    await db.exec("DELETE FROM public.campaign_members");
    await refused("23503");
  });
  it("preserves different SRD candidate-source rules for features and spells", async () => {
    await db.query("UPDATE public.content_versions SET source_snapshot='homebrew' WHERE content_id=$1", [feature]);
    expect((await resolve()).feature_grants[0].feature_content_id).toBe(feature);
    await classData({ levels: [], spellcastingExtra: ["spark"] });
    await db.query("UPDATE public.content_versions SET source_snapshot='homebrew' WHERE content_id=$1", [spell]);
    await refused("23503");
  });
  it("does not trim feature identity but trims spell names in native manifests", async () => {
    await classData({ levels: [{ level: 1, features: [" first "] }], spellcastingExtra: [" spark "] });
    await refused("23503");
    await version({ id: uuid(103), type: "feature", slug: " first " });
    const result = await resolve();
    expect(result.feature_grants[0].feature_slug).toBe(" first ");
    expect(result.spell_grants[0].spell_slug).toBe("spark");
  });
  it("requires dormant dependencies too and never expands a feature's nested grants", async () => {
    await classData({ levels: [{ level: 20, features: ["missing"] }] });
    await refused("23503");
    await classData({ levels: [{ level: 1, features: ["first"] }] });
    await db.query("UPDATE public.content_versions SET data_snapshot=$1 WHERE content_id=$2", [{ levels: [{ level: 1, features: ["unresolved-child"] }], spellcastingExtra: ["unresolved-spell"] }, feature]);
    const result = await resolve();
    expect(result.feature_grants).toHaveLength(1); expect(result.spell_grants).toEqual([]); expect(result.versions).toHaveLength(2);
  });
  it.each([{}, { levels: null }, { levels: [{ level: 1.5, features: [] }] }, { levels: [{ level: 0, features: [] }] },
    { levels: [{ level: 1, features: [7] }] }, { levels: [{ level: 1, features: [" "] }] },
    { levels: [], spellcastingExtra: null }, { levels: [], spellcastingExtra: [7] },
    { levels: [], spellcastingExtra: [{ level: 21, spells: [] }] }, { levels: [], spellcastingExtra: [{ level: 1, spells: [null] }] },
  ])("refuses malformed finite manifests: %j", async data => { await classData(data); await refused("22023"); });
  it("refuses excessive raw references rather than truncating duplicated grants", async () => {
    await classData({ levels: [{ level: 1, features: Array(4097).fill("first") }] }); await refused("54000");
    await classData({ levels: [], spellcastingExtra: [{ level: 1, spells: Array(4097).fill("spark") }] }); await refused("54000");
  });
  it("refuses oversized raw snapshots before returning a partial graph", async () => {
    await classData({ levels: [], raw: "x".repeat(4 * 1024 * 1024) }); await refused("54000");
  });
  it("refuses oversized dependency snapshots and the combined output envelope", async () => {
    await db.query("UPDATE public.content_versions SET unparsed_snapshot=$1 WHERE content_id=$2", [{ raw: "x".repeat(4 * 1024 * 1024) }, feature]);
    await refused("54000");
    await db.query("UPDATE public.content_versions SET unparsed_snapshot='{}' WHERE content_id=$1", [feature]);
    // Controller is present both as the explicit pin and in the version set.
    // Each individual snapshot fits; the complete output must still be bounded.
    await classData({ levels: [], raw: "x".repeat(2200000) }); await refused("54000");
  });
  it("refuses excessive feature and spell candidate domains rather than choosing a truncated rank", async () => {
    await db.query(`INSERT INTO public.content_versions SELECT gen_random_uuid(),1,$1,'feature','first','First','platform','srd',NULL,'{}','2026-01-01','{}' FROM generate_series(1,4096)`, [system]);
    await refused("54000");
    await classData({ levels: [], spellcastingExtra: ["spark"] });
    await db.query(`INSERT INTO public.content_versions SELECT gen_random_uuid(),1,$1,'spell','spark','Spark','platform','srd',NULL,'{}','2026-01-01','{}' FROM generate_series(1,4096)`, [system]);
    await refused("54000");
  });
  it("is explicitly invoker/stable with empty path and no API-role execution in this model", async () => {
    const meta = (await db.query(`SELECT p.prosecdef,p.provolatile,p.proconfig,r.rolname,
      has_function_privilege('anon',p.oid,'EXECUTE') AS anon,
      has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated,
      has_function_privilege('service_role',p.oid,'EXECUTE') AS service_role
      FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
      WHERE p.oid='private.resolve_first_class_dependencies_v1(uuid,uuid,integer)'::regprocedure`)).rows[0];
    expect(meta).toEqual({ prosecdef: false, provolatile: "s", proconfig: ['search_path=""'], rolname: "postgres", anon: false, authenticated: false, service_role: false });
  });
});
