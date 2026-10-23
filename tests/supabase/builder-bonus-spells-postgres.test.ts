import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { builderStepInputSchema } from "../../lib/builder/builder-step-command";

// PostgreSQL helper vectors. Native Auth, triggers, receipts and browser
// persistence are exercised separately by the disposable local application.
const db = new PGlite();
const target = "10000000-0000-4000-8000-000000000001";
const id = (n: number) => `20000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
type Row = Record<string, unknown>;
const definitions: Row[] = [], refs: Row[] = [];
function source(n: number, slug: string, type: string, data: Row, effects: Row[] = []) {
  definitions.push({ content_id: id(n), version: 1, slug_snapshot: slug, name_snapshot: slug, content_type_snapshot: type,
    data_snapshot: { subclass: null, ...data }, effects_snapshot: effects, system_id_snapshot: id(999), source_snapshot: "srd",
    scope_snapshot: "platform", owner_id_snapshot: null, created_at: "2026-10-23T00:00:00Z" });
  if (type !== "spell") refs.push({ id: id(n + 100), character_id: target, content_id: id(n), content_version: 1,
    context: {}, choice_source: type === "class" ? "class" : `auto:feature-grant:${id(n + 200)}`,
    feature_grant_id: type === "class" ? null : id(n + 200), created_at: "2026-10-23T00:00:00Z" });
}
const descriptor = (choice_id: string, choose = 2, extra: Row = {}) => ({ choice_id, choose, min_spell_level: 0,
  max_spell_level: "class", list_class: null, ritual_only: false, spellbook_only: false, counts_known: false,
  always_prepared: false, mode: "known", ...extra });
const levels = (features: string[] = []) => Array.from({ length: 20 }, (_, i) => ({ level: i + 1, features,
  spellcasting: { spell_slots: Array.from({ length: 9 }, (_slot, index) => index < Math.ceil((i + 1) / 2) ? 2 : 0) } }));
source(1, "bard", "class", { levels: levels(["magical-secrets-1"]), starting_proficiencies: [] });
source(2, "magical-secrets-1", "feature", { class: "bard", level: 10,
  bonus_spells: [descriptor("magical-secrets-1", 2, { counts_known: true })] });
source(3, "additional-magical-secrets", "feature", { class: "bard", subclass: "lore", level: 6,
  bonus_spells: [descriptor("additional-magical-secrets")] });
source(4, "warlock", "class", { levels: levels() });
source(5, "pact-of-the-tome", "feature", { class: "warlock", level: 3,
  bonus_spells: [descriptor("pact-of-the-tome", 3, { max_spell_level: 0 })] });
source(6, "eldritch-invocation-book-of-ancient-secrets", "feature", { class: "warlock", level: 2,
  bonus_spells: [descriptor("eldritch-invocation-book-of-ancient-secrets", 2, { min_spell_level: 1, max_spell_level: 1, ritual_only: true, mode: "ritual" })] });
source(7, "mystic-arcanum-6th-level", "feature", { class: "warlock", level: 11,
  bonus_spells: [descriptor("mystic-arcanum-6th-level", 1, { min_spell_level: 6, max_spell_level: 6, list_class: "warlock", mode: "arcanum" })] });
source(8, "wizard", "class", { levels: levels() });
source(9, "spell-mastery", "feature", { class: "wizard", level: 18,
  bonus_spells: [descriptor("spell-mastery-1", 1, { min_spell_level: 1, max_spell_level: 1, spellbook_only: true, mode: "mastery" })] });
source(10, "signature-spell", "feature", { class: "wizard", level: 20,
  bonus_spells: [descriptor("signature-spell", 2, { min_spell_level: 3, max_spell_level: 3, spellbook_only: true, always_prepared: true, mode: "signature" })] });
source(11, "druid", "class", { levels: levels() });
source(12, "circle-of-the-land-forest", "feature", { class: "druid", subclass: "land", level: 2,
  bonus_spell_grants: [{ class_level: 3, spells: ["barkskin"], always_prepared: true }, { class_level: 5, spells: ["call-lightning"], always_prepared: true }] });
source(13, "bonus-proficiencies", "feature", { class: "bard", subclass: "lore", level: 3 }, [
  { type: "choice", choice_id: "bonus-proficiencies", choose: 3, from: ["skill-arcana", "skill-stealth", "skill-insight", "skill-nature"], grant_type: "proficiency" },
]);
source(14, "acolyte", "background", { skills: ["insight"] });
source(21, "guidance", "spell", { level: 0, classes: ["cleric", "druid"], ritual: false });
source(22, "fire-bolt", "spell", { level: 0, classes: ["wizard"], ritual: false });
source(23, "light", "spell", { level: 0, classes: ["cleric", "wizard"], ritual: false });
source(24, "identify", "spell", { level: 1, classes: ["wizard"], ritual: true });
source(25, "magic-missile", "spell", { level: 1, classes: ["wizard"], ritual: false });
source(26, "fireball", "spell", { level: 3, classes: ["wizard"], ritual: false });
source(27, "fly", "spell", { level: 3, classes: ["wizard", "warlock"], ritual: false });
source(28, "eyebite", "spell", { level: 6, classes: ["warlock", "wizard"], ritual: false });
source(29, "barkskin", "spell", { level: 2, classes: ["druid"], ritual: false });
source(30, "call-lightning", "spell", { level: 3, classes: ["druid"], ritual: false });
const tuple = (n: number) => ({ content_id: id(n), content_version: 1 });
const choices = (bonus_spells: Row = {}, level = 20) => ({ classes: ["bard", "warlock", "wizard", "druid"].map(slug => ({ slug, level })), bonus_spells });
const book = (n: number): Row => ({ id: id(n + 400), character_id: target, ...tuple(n), name: definitions.find(d => d.content_id === id(n))?.name_snapshot,
  class_slug: "wizard", source: "selection", is_known: true, is_prepared: false, always_prepared: false, in_spellbook: true,
  custom_data: { builder_class_controller_ref_id: id(108) }, spell_grant_id: null, created_at: "2026-10-23T00:00:00Z" });
const graph = (spells: Row[] = [], active = refs) => ({ refs: active, spells });

beforeAll(async () => {
  await db.exec(`CREATE SCHEMA private;
    CREATE TABLE private.character_builder_capabilities_v1(transaction_id xid8,character_id uuid,context jsonb,protected_graph jsonb);
    CREATE TABLE public.content_versions(content_id uuid,version integer,slug_snapshot text,name_snapshot text,content_type_snapshot text,
      data_snapshot jsonb,effects_snapshot jsonb,system_id_snapshot uuid,source_snapshot text,scope_snapshot text,owner_id_snapshot uuid,created_at timestamptz);
    CREATE TABLE public.content_definitions(id uuid,version integer,is_retired boolean DEFAULT false);
    CREATE TABLE public.character_content_refs(id uuid,character_id uuid,content_id uuid,content_version integer,context jsonb,choice_source text,
      feature_grant_id uuid,created_at timestamptz);
    CREATE TABLE public.character_spells(id uuid,character_id uuid,content_id uuid,content_version integer,name text,class_slug text,is_known boolean,
      is_prepared boolean,always_prepared boolean,in_spellbook boolean,source text,custom_data jsonb,created_at timestamptz,spell_grant_id uuid);
    CREATE FUNCTION private.lock_builder_character_rows_v1(jsonb,uuid) RETURNS void LANGUAGE sql AS 'SELECT';
    CREATE FUNCTION private.character_can_access_content_version(uuid,uuid,integer) RETURNS boolean LANGUAGE sql AS 'SELECT true';
    CREATE FUNCTION private.builder_role_definition_v1(uuid,jsonb,jsonb) RETURNS jsonb LANGUAGE sql AS 'SELECT $3';
    CREATE FUNCTION private.builder_progression_scores_v1(uuid,jsonb) RETURNS jsonb LANGUAGE sql AS 'SELECT ''{"intelligence":16}''::jsonb';
    CREATE FUNCTION private.builder_expertise_proficiency_v1(text) RETURNS text LANGUAGE sql AS
      'SELECT CASE WHEN $1 LIKE ''skill-%'' THEN $1 WHEN $1 IN (''arcana'',''stealth'',''insight'',''nature'') THEN ''skill-''||$1 ELSE NULL END';
    CREATE FUNCTION private.builder_uuid_v1(text) RETURNS boolean LANGUAGE sql AS 'SELECT $1 ~ ''^[0-9a-f-]{36}$''';
    CREATE FUNCTION private.builder_exact_keys_v1(value jsonb,keys text[]) RETURNS boolean LANGUAGE sql AS
      'SELECT jsonb_typeof(value)=''object'' AND (SELECT count(*) FROM jsonb_object_keys(value))=cardinality(keys) AND value ?& keys';`);
  const catalog = readFileSync("supabase/staged/character-builder-catalog.sql", "utf8").replaceAll("\r\n", "\n");
  await db.exec(catalog.slice(catalog.indexOf("CREATE FUNCTION private.builder_catalog_dependency_v1"), catalog.indexOf("-- Existing occurrence lifecycle/history")));
  const stage = readFileSync("supabase/staged/character-builder-bonus-spells.sql", "utf8");
  await db.exec(stage.slice(stage.indexOf("CREATE FUNCTION private.builder_bonus_known_reserve_v1"), stage.indexOf("CREATE FUNCTION private.prepare_builder_bonus_command_v1")));
  for (const definition of definitions) {
    await db.query("INSERT INTO public.content_versions SELECT * FROM jsonb_populate_record(NULL::public.content_versions,$1)", [definition]);
    await db.query("INSERT INTO public.content_definitions(id,version) VALUES($1,1)", [definition.content_id]);
  }
});
afterAll(async () => { await db.close(); });
async function apply(pending: Row, strict: string | null = null, expected = graph(), prior = expected) {
  const source = definitions.find(d => (d.data_snapshot as Row).bonus_spells && ((d.data_snapshot as Row).bonus_spells as Row[]).some(c => c.choice_id === strict));
  await db.exec("BEGIN");
  try {
    await db.query("INSERT INTO private.character_builder_capabilities_v1 VALUES(pg_current_xact_id(),$1,'{}',$2)", [target, prior]);
    const result = await db.query<{ result: { choices: { bonus_spells: Row }; graph: { refs: Row[]; spells: Row[] } } }>(
      "SELECT private.prepare_builder_bonus_spells_v1($1,$2,$3,$4,$5) AS result", [target, pending, expected, source?.slug_snapshot ?? null, strict]);
    return result.rows[0].result;
  } finally { await db.exec("ROLLBACK"); }
}

describe("finite source-owned bonus spell helper", () => {
  it("accepts partial drafts, preserves exact source/spell IDs and retires unearned choices", async () => {
    const pending = choices({ "pact-of-the-tome": [tuple(21), tuple(22)] });
    const first = await apply(pending, "pact-of-the-tome");
    const second = await apply(pending, null, first.graph, first.graph);
    expect(second.graph).toEqual(first.graph);
    expect(first.graph.spells.filter(s => (s.custom_data as Row)?.builder_bonus_choice_id === "pact-of-the-tome")).toHaveLength(2);
    const retired = await apply(choices(pending.bonus_spells, 2), null, first.graph, first.graph);
    expect(retired.choices.bonus_spells).toEqual({});
    expect(retired.graph.spells).toEqual([]);
  });
  it("rejects duplicates, over-capacity, wrong levels, lists and ritual claims", async () => {
    await expect(apply(choices({ "pact-of-the-tome": [tuple(21), tuple(21)] }), "pact-of-the-tome")).rejects.toThrow("builder_bonus_spell_unavailable");
    await expect(apply(choices({ "pact-of-the-tome": [tuple(24)] }), "pact-of-the-tome")).rejects.toThrow("builder_bonus_spell_unavailable");
    await expect(apply(choices({ "mystic-arcanum-6th-level": [tuple(26)] }), "mystic-arcanum-6th-level")).rejects.toThrow("builder_bonus_spell_unavailable");
    await expect(apply(choices({ "eldritch-invocation-book-of-ancient-secrets": [tuple(25)] }), "eldritch-invocation-book-of-ancient-secrets")).rejects.toThrow("builder_bonus_spell_unavailable");
    await expect(apply(choices({ "magical-secrets-1": [tuple(24), tuple(25), tuple(26)] }), "magical-secrets-1")).rejects.toThrow("builder_bonus_spell_unavailable");
  });
  it("validates book membership and annotates Signature without duplicating book rows", async () => {
    await expect(apply(choices({ "spell-mastery-1": [tuple(24)] }), "spell-mastery-1")).rejects.toThrow("builder_bonus_spell_unavailable");
    const expected = graph([book(24), book(26), book(27)]);
    const saved = await apply(choices({ "spell-mastery-1": [tuple(24)], "signature-spell": [tuple(26), tuple(27)] }), "signature-spell", expected);
    expect(saved.graph.spells.filter(s => s.class_slug === "wizard")).toHaveLength(3);
    expect(saved.graph.spells.filter(s => s.always_prepared === true)).toHaveLength(4); // Two Circle and two Signature spells.
    expect(saved.graph.spells.find(s => s.content_id === id(24))?.always_prepared).toBe(false);
    const pruned = await apply(choices({ "signature-spell": [tuple(26), tuple(27)] }), null,
      { ...saved.graph, spells: saved.graph.spells.filter(s => s.content_id !== id(27)) }, saved.graph);
    expect(pruned.choices.bonus_spells["signature-spell"]).toEqual([tuple(26)]);
  });
  it("gates fixed Circle spells by the selected terrain and own class level", async () => {
    const saved = await apply(choices({}, 3));
    expect(saved.graph.spells.map(s => s.name)).toEqual(["barkskin"]);
    expect(saved.graph.spells[0]).toMatchObject({ class_slug: "druid", source: "bonus", always_prepared: true, is_prepared: true });
    const removed = await apply(choices(), null, graph([], refs.filter(r => r.content_id !== id(12))));
    expect(removed.graph.spells).toEqual([]);
  });
  it("reserves the source's full Secrets count while excluding Lore's extra choices", async () => {
    const bard = definitions.find(d => d.slug_snapshot === "bard");
    const result = await db.query<{ reserve: number }>("SELECT private.builder_bonus_known_reserve_v1($1,$2,10) AS reserve", [target, bard]);
    expect(result.rows[0].reserve).toBe(2);
  });
  it("rejects already proficient Lore skills and prunes them after other source edits", async () => {
    const pending = { ...choices(), resolved_choices: { "bonus-proficiencies": ["skill-insight", "skill-stealth", "skill-arcana"] } };
    await expect(db.query("SELECT private.normalize_builder_lore_skills_v1($1,$2,$3,'bonus-proficiencies')", [target, pending, refs]))
      .rejects.toThrow("builder_lore_skill_already_proficient");
    const result = await db.query<{ choices: { resolved_choices: Row } }>("SELECT private.normalize_builder_lore_skills_v1($1,$2,$3,NULL) AS choices", [target, pending, refs]);
    expect(result.rows[0].choices.resolved_choices["bonus-proficiencies"]).toEqual(["skill-stealth", "skill-arcana"]);
  });
});

describe("bonus spell command boundary", () => {
  it("admits only a bounded exact tuple list and refuses client-authored grants", () => {
    const input = { command: "select_bonus_spells", fields: { feature_slug: "pact-of-the-tome", choice_id: "pact-of-the-tome", spells: [tuple(21)] } };
    expect(builderStepInputSchema.safeParse(input).success).toBe(true);
    expect(builderStepInputSchema.safeParse({ ...input, fields: { ...input.fields, always_prepared: true } }).success).toBe(false);
    expect(builderStepInputSchema.safeParse({ ...input, fields: { ...input.fields, spells: [tuple(21), tuple(21)] } }).success).toBe(false);
  });
});
