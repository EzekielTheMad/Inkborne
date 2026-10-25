import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

// Execute the complete real companion and its actual admitted old max-HP body.
// Origin/score collaborators are explicit doubles. Full Auth, sealed compiler,
// protected triggers and browser acceptance remain disposable-runtime checks.
type Json = Record<string, unknown>;
const read = (path: string) => readFileSync(path, "utf8").replaceAll("\r\n", "\n");
const stage = read("supabase/staged/character-builder-hp-bonus.sql");
const multiclass = read("supabase/staged/character-builder-multiclass.sql");
const start = multiclass.indexOf("CREATE FUNCTION private.builder_multiclass_max_hp_v1");
const original = multiclass.slice(start, multiclass.indexOf("END $$;", start) + 7);
const body = (sql: string) => sql.slice(sql.indexOf("AS $$") + 5, sql.indexOf("END $$;") + 4);
const md5 = (value: string) => createHash("md5").update(value).digest("hex");
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const target = id(1), system = id(2), sorcerer = id(10), fighter = id(11);
const sorcererRoot = id(20), fighterRoot = id(21), subclassRoot = id(22);
const sorcererContent = id(30), fighterContent = id(31), subclassContent = id(32);
const db = new PGlite();
const choices = { classes: [{ slug: "sorcerer", level: 3, subclass: "draconic", occurrence_id: sorcerer }], hp_rolls: {} };
function graph() {
  return { refs: [
    { id: sorcererRoot, character_id: target, content_id: sorcererContent, content_version: 1,
      context: { source: "class", level: 1 }, feature_grant_id: null },
    { id: subclassRoot, character_id: target, content_id: subclassContent, content_version: 2,
      context: { source: "subclass", class: "sorcerer" }, choice_source: `builder:subclass:${sorcerer}`, feature_grant_id: null },
  ], occurrences: [{ id: sorcerer, character_id: target, system_id: system, content_id: sorcererContent, content_version: 1,
    class_slug: "sorcerer", controller_ref_id: sorcererRoot, subclass_ref_id: subclassRoot, lifecycle: "accepted" }] };
}
const schema = `CREATE SCHEMA private;
  CREATE ROLE supabase_admin SUPERUSER NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
  CREATE TABLE public.characters(id uuid PRIMARY KEY,system_id uuid);
  CREATE TABLE public.content_versions(content_id uuid,version integer,content_type_snapshot text,slug_snapshot text,system_id_snapshot uuid,data_snapshot jsonb,PRIMARY KEY(content_id,version));
  CREATE TABLE private.character_builder_capabilities_v1(character_id uuid);
  CREATE TABLE private.character_writer_readiness_v1(id integer,ready boolean);
  INSERT INTO private.character_writer_readiness_v1 SELECT i,false FROM generate_series(1,13) i;
  CREATE TABLE private.class_origin_gate_v1(enabled boolean); INSERT INTO private.class_origin_gate_v1 VALUES(false);
  CREATE TABLE private.hit_die_gate_v1(enabled boolean); INSERT INTO private.hit_die_gate_v1 VALUES(false);
  CREATE FUNCTION private.describe_builder_subclass_update_v1(uuid,uuid,integer) RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb';
  CREATE FUNCTION private.prepare_builder_class_removal_v1(uuid,jsonb) RETURNS void LANGUAGE sql AS 'SELECT';
  CREATE FUNCTION private.builder_uuid_v1(text) RETURNS boolean LANGUAGE sql AS 'SELECT COALESCE($1 ~ ''^[0-9a-f-]{36}$'',false)';
  CREATE FUNCTION private.builder_original_occurrence_v1(uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('id',current_setting('test.original')) $$;
  CREATE FUNCTION private.builder_progression_scores_v1(uuid,jsonb) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('constitution',current_setting('test.constitution')::integer) $$;
  REVOKE ALL ON SCHEMA private FROM PUBLIC,anon,authenticated,service_role;`;
async function install(connection: PGlite) {
  await connection.exec(schema);
  await connection.exec(original);
  await connection.exec("REVOKE ALL ON FUNCTION private.builder_multiclass_max_hp_v1(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role; SET ROLE supabase_admin;");
  await connection.exec(stage);
  await connection.exec("RESET ROLE");
}
beforeAll(async () => { await install(db); });
afterAll(async () => { await db.close(); });
beforeEach(async () => {
  await db.exec("TRUNCATE public.characters,public.content_versions;");
  await db.query("INSERT INTO public.characters VALUES($1,$2)", [target, system]);
  await db.query("SELECT set_config('test.original',$1,false),set_config('test.constitution','14',false)", [sorcerer]);
  for (const version of [1, 2]) await db.query("INSERT INTO public.content_versions VALUES($1,$2,'subclass','draconic',$3,$4)",
    [subclassContent, version, system, { parent_class: "sorcerer", levels: [{ level: 1, features: ["draconic-resilience"] }],
      ...(version === 2 ? { hit_points_bonus_per_class_level: 1 } : {}) }]);
  await db.query("INSERT INTO public.content_versions VALUES($1,1,'class','sorcerer',$2,$4),($3,1,'class','fighter',$2,'{\"hit_die\":10}')",
    [sorcererContent, system, fighterContent, { hit_die: 6, levels: Array.from({ length: 20 }, (_, i) => ({ level: i + 1, ...(i === 0 ? { subclass_level: true } : {}) })) }]);
});
async function maximum(nextChoices: Json = choices, nextGraph: Json = graph()) {
  return (await db.query<{ maximum: number }>("SELECT private.builder_multiclass_max_hp_v1($1,$2,$3) AS maximum", [target, nextChoices, nextGraph])).rows[0].maximum;
}
function multiclassGraph() {
  const result = graph();
  result.refs.push({ id: fighterRoot, character_id: target, content_id: fighterContent, content_version: 1,
    context: { source: "class", level: 1 }, feature_grant_id: null });
  result.occurrences.push({ id: fighter, character_id: target, system_id: system, content_id: fighterContent, content_version: 1,
    class_slug: "fighter", controller_ref_id: fighterRoot, subclass_ref_id: null as unknown as string, lifecycle: "accepted" });
  return result;
}

describe("immutable subclass HP bonus native parity", () => {
  it("adds the own-class bonus after base average HP and leaves old pinned snapshots unchanged", async () => {
    expect(await maximum()).toBe(23); // (6+2)+(4+2)+(4+2)+3
    const old = graph(); old.refs[1].content_version = 1;
    expect(await maximum(choices, old)).toBe(20);
    const rows = await db.query<{ version: number; data_snapshot: Json }>("SELECT version,data_snapshot FROM public.content_versions WHERE content_id=$1 ORDER BY version", [subclassContent]);
    expect(rows.rows).toEqual([{ version: 1, data_snapshot: { parent_class: "sorcerer", levels: [{ level: 1, features: ["draconic-resilience"] }] } },
      { version: 2, data_snapshot: { parent_class: "sorcerer", levels: [{ level: 1, features: ["draconic-resilience"] }], hit_points_bonus_per_class_level: 1 } }]);
  });
  it("preserves raw rolled/manual die contributions and recalculates Constitution", async () => {
    const rolled = { ...choices, hp_rolls: { "sorcerer-2": { method: "rolled", value: 6 }, "sorcerer-3": { method: "manual", value: 1 } } };
    expect(await maximum(rolled)).toBe(22); // (6+2)+(6+2)+(1+2)+3
    await db.exec("SELECT set_config('test.constitution','18',false)");
    expect(await maximum(rolled)).toBe(28);
  });
  it("applies the bonus after each ordinary minimum even for extremely negative Constitution", async () => {
    await db.exec("SELECT set_config('test.constitution','1',false)");
    expect(await maximum()).toBe(6); // three ordinary minimum gains plus three bonus HP
  });
  it("uses only the owning sorcerer levels and preserves original occurrence when array order changes", async () => {
    const mixed = { ...choices, classes: [{ slug: "fighter", level: 2, occurrence_id: fighter }, ...choices.classes] };
    expect(await maximum(mixed, multiclassGraph())).toBe(39); //20+3 sorcerer, (6+2)*2 fighter
    await db.query("SELECT set_config('test.original',$1,false)", [fighter]);
    expect(await maximum(mixed, multiclassGraph())).toBe(41); //sorcerer secondary loses2, fighter original gains4
  });
  it("returns the correct next-graph current-HP cap for downlevel and secondary removal", async () => {
    const down = { ...choices, classes: [{ ...choices.classes[0], level: 1 }] };
    expect(await maximum(down)).toBe(9);
    const removed = multiclassGraph(); removed.occurrences[0].lifecycle = "ended";
    removed.refs = removed.refs.filter(ref => ref.id === fighterRoot);
    await db.query("SELECT set_config('test.original',$1,false)", [fighter]);
    const remaining = { classes: [{ slug: "fighter", level: 2, occurrence_id: fighter }], hp_rolls: {} };
    const result = (await db.query<{ current_hp: number }>("SELECT LEAST(60,private.builder_multiclass_max_hp_v1($1,$2,$3)) AS current_hp", [target, remaining, removed])).rows[0];
    expect(result.current_hp).toBe(20); // 10+2 original,6+2
  });
  it.each([null, 0, 2, "1", true, {}, []])("refuses unsupported explicit bonus %j", async value => {
    await db.query("UPDATE public.content_versions SET data_snapshot=data_snapshot||jsonb_build_object('hit_points_bonus_per_class_level',$1::jsonb) WHERE content_id=$2 AND version=2", [JSON.stringify(value), subclassContent]);
    await expect(maximum()).rejects.toThrow("builder_hp_bonus_metadata_unavailable");
  });
  it.each(["class_gate_unearned", "subclass_start_unearned", "class_gate_missing", "class_rows_missing", "subclass_rows_missing", "duplicate_level"])("refuses a positive bonus with %s", async mode => {
    if (mode === "class_gate_unearned") await db.query("UPDATE public.content_versions SET data_snapshot=jsonb_set(data_snapshot,'{levels}',$1) WHERE content_id=$2", [[{ level: 3 }, { level: 4, subclass_level: true }], sorcererContent]);
    if (mode === "subclass_start_unearned") await db.query("UPDATE public.content_versions SET data_snapshot=jsonb_set(data_snapshot,'{levels}',$1) WHERE content_id=$2 AND version=2", [[{ level: 6 }], subclassContent]);
    if (mode === "class_gate_missing") await db.query("UPDATE public.content_versions SET data_snapshot=jsonb_set(data_snapshot,'{levels}',$1) WHERE content_id=$2", [[{ level: 3 }], sorcererContent]);
    if (mode === "class_rows_missing") await db.query("UPDATE public.content_versions SET data_snapshot=data_snapshot-'levels' WHERE content_id=$1", [sorcererContent]);
    if (mode === "subclass_rows_missing") await db.query("UPDATE public.content_versions SET data_snapshot=data_snapshot-'levels' WHERE content_id=$1 AND version=2", [subclassContent]);
    if (mode === "duplicate_level") await db.query("UPDATE public.content_versions SET data_snapshot=jsonb_set(data_snapshot,'{levels}',$1) WHERE content_id=$2", [[{ level: 3, subclass_level: true }, { level: 3 }], sorcererContent]);
    await expect(maximum()).rejects.toThrow("builder_hp_bonus_graph_unavailable");
  });
  it.each(["duplicate_ref", "duplicate_occurrence", "orphan_subclass", "wrong_class", "wrong_character", "wrong_context", "wrong_choice_source", "wrong_system", "ended", "missing_original", "wrong_class_tuple"])("refuses %s source evidence", async mode => {
    const changed = graph();
    if (mode === "duplicate_ref") changed.refs.push(changed.refs[1]);
    if (mode === "duplicate_occurrence") changed.occurrences.push(changed.occurrences[0]);
    if (mode === "orphan_subclass") changed.refs.push({ ...changed.refs[1], id: id(99) });
    if (mode === "wrong_class") await db.query("UPDATE public.content_versions SET data_snapshot='{\"parent_class\":\"fighter\",\"hit_points_bonus_per_class_level\":1}' WHERE content_id=$1 AND version=2", [subclassContent]);
    if (mode === "wrong_character") changed.refs[1].character_id = id(99);
    if (mode === "wrong_context") changed.refs[1].context = { source: "subclass", class: "fighter" };
    if (mode === "wrong_choice_source") changed.refs[1].choice_source = `builder:subclass:${id(99)}`;
    if (mode === "wrong_system") changed.occurrences[0].system_id = id(99);
    if (mode === "ended") changed.occurrences[0].lifecycle = "ended";
    if (mode === "missing_original") await db.query("SELECT set_config('test.original',$1,false)", [id(99)]);
    if (mode === "wrong_class_tuple") changed.occurrences[0].content_version = 2;
    await expect(maximum(choices, changed)).rejects.toThrow("builder_hp_bonus_graph_unavailable");
  });
  it("uses metadata from a paired immutable source, never a hardcoded subclass slug or current catalog", async () => {
    await db.query("UPDATE public.content_versions SET slug_snapshot='reviewed-origin' WHERE content_id=$1 AND version=2", [subclassContent]);
    expect(await maximum({ ...choices, classes: [{ ...choices.classes[0], subclass: "reviewed-origin" }] })).toBe(23);
  });
  it("preserves the admitted function owner, ACL, attributes and closed gates with the exact postimage", async () => {
    expect(md5(body(original))).toBe("59eac94525f960c399a080e6c758cb12");
    const result = (await db.query<{ prosrc: string; owner: string; prosecdef: boolean; provolatile: string; proconfig: string[]; proacl: string[] }>(
      "SELECT prosrc,proowner::regrole::text AS owner,prosecdef,provolatile,proconfig,proacl FROM pg_proc WHERE oid='private.builder_multiclass_max_hp_v1(uuid,jsonb,jsonb)'::regprocedure")).rows[0];
    expect(md5(result.prosrc)).toBe("6f4e810b99cfd755babcc0fc058c2431");
    expect(result).toMatchObject({ owner: "postgres", prosecdef: true, provolatile: "s", proconfig: ['search_path=""'], proacl: ["postgres=X/postgres"] });
    for (const role of ["anon", "authenticated", "service_role"]) expect((await db.query<{ allowed: boolean }>(
      "SELECT has_function_privilege($1,'private.builder_multiclass_max_hp_v1(uuid,jsonb,jsonb)','EXECUTE') AS allowed", [role])).rows[0].allowed).toBe(false);
    expect((await db.query<{ open: boolean }>("SELECT EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled) OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready) AS open")).rows[0].open).toBe(false);
  });
  it("refuses installer drift rather than replacing an unrecognized helper", async () => {
    await db.exec("BEGIN");
    try {
      await db.exec("SET ROLE supabase_admin");
      await expect(db.exec(stage)).rejects.toThrow("builder_hp_bonus_dependency_changed");
    } finally { await db.exec("ROLLBACK; RESET ROLE"); }
  });
});
