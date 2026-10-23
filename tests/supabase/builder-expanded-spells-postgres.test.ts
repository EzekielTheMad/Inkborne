import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

// Focused PostgreSQL helper vectors. Auth, receipts and browser reloads belong
// to the disposable real application profile and are checked separately.
const db = new PGlite();
type Row = Record<string, unknown>;
const target = "10000000-0000-4000-8000-000000000001";
const id = (n: number) => `20000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
const tuple = (n: number) => ({ content_id: id(n), content_version: 1, prepared: false });
const tiers = [{ level: 1, spells: ["command", "burning-hands"] }, { level: 5, spells: ["fireball", "fly"] }];
const choices = (level = 5, patron: string | null = "fiend") => ({ classes: [
  { slug: "fighter", level: 5, occurrence_id: id(801) },
  { slug: "warlock", level, occurrence_id: id(802), ...(patron === null ? {} : { subclass: patron }) },
], class_spell_selections: { warlock: [tuple(21), tuple(22), tuple(23)] } });
const definition = (n: number, slug: string, type: string, data: Row): Row => ({ content_id: id(n), version: 1,
  slug_snapshot: slug, name_snapshot: slug, content_type_snapshot: type, data_snapshot: data,
  system_id_snapshot: id(999), source_snapshot: "srd", scope_snapshot: "platform", owner_id_snapshot: null });
const catalog = [
  definition(1, "warlock", "class", { spellcasting: { ability: "charisma" }, spellcastingList: { class: "warlock", level: [0, 9] },
    spellcastingKnown: { cantrips: Array(20).fill(2), spells: Array(20).fill(3), prepared: false },
    levels: Array.from({ length: 20 }, (_, n) => ({ level: n + 1, spellcasting: {
      spell_slots: Array.from({ length: 9 }, (_, i) => i === Math.min(4, Math.floor(n / 2)) ? 2 : 0),
    } })),
  }),
  definition(2, "fiend", "subclass", { parent_class: "warlock", spellcastingExpanded: tiers }),
  definition(21, "command", "spell", { classes: ["cleric", "paladin"], level: 1 }),
  definition(22, "fireball", "spell", { classes: ["sorcerer", "wizard"], level: 3 }),
  definition(23, "fly", "spell", { classes: ["sorcerer", "wizard", "warlock"], level: 3 }),
  definition(24, "lightning-bolt", "spell", { classes: ["sorcerer", "wizard"], level: 3 }),
  definition(25, "hellish-rebuke", "spell", { classes: ["warlock"], level: 1 }),
  definition(26, "eldritch-blast", "spell", { classes: ["warlock"], level: 0 }),
  { ...definition(27, "fireball", "spell", { classes: ["wizard"], level: 3 }), scope_snapshot: "personal", owner_id_snapshot: id(888) },
];
const refs = [1, 2].map(n => ({ id: id(n + 100), character_id: target, content_id: id(n), content_version: 1 }));
const physical = (n: number): Row => ({ id: id(n + 400), character_id: target, content_id: id(n), content_version: 1,
  name: catalog.find(d => d.content_id === id(n))?.name_snapshot, class_slug: "warlock", is_known: true, is_prepared: n === 26,
  always_prepared: false, in_spellbook: false, source: "selection", custom_data: { builder_class_controller_ref_id: id(101) },
  created_at: "2026-10-23T00:00:00Z", spell_grant_id: null });
const graph = (patron: number | null = 1, spells: Row[] = []) => ({ refs: refs.filter(r => r.content_id !== id(2) || patron !== null)
  .map(r => r.content_id === id(2) ? { ...r, content_version: patron } : r),
  occurrences: [{ id: id(802), character_id: target, class_slug: "warlock", controller_ref_id: id(101), subclass_ref_id: patron === null ? null : id(102), lifecycle: "accepted" }], spells });
const read = (path: string) => readFileSync(path, "utf8").replaceAll("\r\n", "\n");
const body = (sql: string, signature: string) => {
  const start = sql.indexOf(signature), end = sql.indexOf("END $$;", start) + 7;
  return sql.slice(start, end);
};
const stage = read("supabase/staged/character-builder-expanded-spells.sql");
const fragments = [...stage.matchAll(/needle:='((?:[^']|'')*)';\n\s+insertion:='((?:[^']|'')*)';/g)]
  .map(match => [match[1].replaceAll("''", "'"), match[2].replaceAll("''", "'")]);
let ordinary = body(read("supabase/staged/character-builder-multiclass.sql"), "CREATE OR REPLACE FUNCTION private.builder_progression_class_spells_v1");
ordinary = ordinary.replace("  IF wizard THEN known_limit:=6+2*(level-1); END IF;", "  IF wizard THEN known_limit:=6+2*(level-1); END IF;\n  known_limit:=GREATEST(0,known_limit-private.builder_bonus_known_reserve_v1(target,definition,level));")
  .replace("IF prepare THEN prepared_count:=prepared_count+1; END IF;", "IF prepare AND NOT (wizard AND level>=20 AND COALESCE(choices#>'{bonus_spells,signature-spell}','[]'::jsonb) @> pg_catalog.jsonb_build_array(entry-'prepared')) THEN prepared_count:=prepared_count+1; END IF;");
ordinary = ordinary.replace(fragments[0][0], fragments[0][1]);

beforeAll(async () => {
  await db.exec(`CREATE SCHEMA private;
    CREATE TABLE private.character_builder_capabilities_v1(transaction_id xid8,character_id uuid,context jsonb,protected_graph jsonb,before_parent jsonb);
    CREATE TABLE public.content_versions(content_id uuid,version integer,slug_snapshot text,name_snapshot text,content_type_snapshot text,
      data_snapshot jsonb,system_id_snapshot uuid,source_snapshot text,scope_snapshot text,owner_id_snapshot uuid);
    CREATE TABLE public.content_definitions(id uuid,version integer,is_retired boolean DEFAULT false);
    CREATE TABLE public.character_content_refs(id uuid,character_id uuid,content_id uuid,content_version integer);
    CREATE TABLE public.character_spells(id uuid,character_id uuid,content_id uuid,content_version integer,name text,class_slug text,is_known boolean,
      is_prepared boolean,always_prepared boolean,in_spellbook boolean,source text,custom_data jsonb,created_at timestamptz,spell_grant_id uuid);
    CREATE FUNCTION private.lock_builder_character_rows_v1(jsonb,uuid) RETURNS void LANGUAGE sql AS 'SELECT';
    CREATE FUNCTION private.character_can_access_content_version(uuid,uuid,integer) RETURNS boolean LANGUAGE sql AS 'SELECT true';
    CREATE FUNCTION private.builder_progression_scores_v1(uuid,jsonb) RETURNS jsonb LANGUAGE sql AS 'SELECT ''{"charisma":16}''::jsonb';
    CREATE FUNCTION private.builder_bonus_known_reserve_v1(uuid,jsonb,integer) RETURNS integer LANGUAGE sql AS 'SELECT 0';
    CREATE FUNCTION private.builder_uuid_v1(text) RETURNS boolean LANGUAGE sql AS 'SELECT $1 ~ ''^[0-9a-f-]{36}$''';
    CREATE FUNCTION private.builder_exact_keys_v1(value jsonb,keys text[]) RETURNS boolean LANGUAGE sql AS
      'SELECT jsonb_typeof(value)=''object'' AND (SELECT count(*) FROM jsonb_object_keys(value))=cardinality(keys) AND value ?& keys';`);
  await db.exec(stage.slice(stage.indexOf("CREATE FUNCTION private.builder_expanded_spell_slugs_v1"), stage.indexOf("DO $profiles$")));
  await db.exec(ordinary);
  for (const d of catalog) {
    await db.query("INSERT INTO public.content_versions SELECT * FROM jsonb_populate_record(NULL::public.content_versions,$1)", [d]);
    await db.query("INSERT INTO public.content_definitions(id,version) VALUES($1,1)", [d.content_id]);
  }
  await db.query("INSERT INTO public.content_versions SELECT * FROM jsonb_populate_record(NULL::public.content_versions,$1)", [
    { ...catalog[1], version: 2, data_snapshot: { parent_class: "warlock" } },
  ]);
  for (const ref of refs) await db.query("INSERT INTO public.character_content_refs SELECT * FROM jsonb_populate_record(NULL::public.character_content_refs,$1)", [ref]);
});
afterAll(async () => { await db.close(); });
async function inCapability<T>(fn: () => Promise<T>, prior = graph(1, [physical(21), physical(22), physical(23)])) {
  await db.exec("BEGIN");
  try {
    await db.query("INSERT INTO private.character_builder_capabilities_v1 VALUES(pg_current_xact_id(),$1,'{}',$2,$3)", [target, prior, { choices: choices() }]);
    return await fn();
  } finally { await db.exec("ROLLBACK"); }
}
const select = (requested: Row[], level = 5, prior = graph()) => inCapability(async () => {
  const result = await db.query<{ spells: Row[] }>("SELECT private.builder_progression_class_spells_v1($1,$2,$3,$4,$5,'warlock') AS spells",
    [target, choices(level), level, requested, prior.spells]);
  return result.rows[0].spells;
}, prior);

describe("Fiend expanded ordinary spells", () => {
  it("accepts earned spells as ordinary known rows, retains exact IDs and creates no free grants", async () => {
    const first = await select([tuple(21), tuple(22), tuple(23)]);
    expect(first).toHaveLength(3);
    expect(first.every(row => row.source === "selection" && row.is_known && !row.is_prepared && !row.always_prepared && !row.spell_grant_id)).toBe(true);
    expect(await select([tuple(21), tuple(22), tuple(23)], 5, graph(1, first))).toEqual(first);
    expect(await select([])).toEqual([]);
  });
  it("retains ordinary level, known-count, preparation and exact-scope restrictions", async () => {
    await expect(select([tuple(22)], 4)).rejects.toThrow("builder_spell_not_on_current_list");
    await expect(select([tuple(24)])).rejects.toThrow("builder_spell_not_on_current_list");
    await expect(select([tuple(27)])).rejects.toThrow("builder_spell_not_on_current_list");
    await expect(select([tuple(21), tuple(22), tuple(23), tuple(25)])).rejects.toThrow("builder_spell_selection_budget_exceeded");
    await expect(select([{ ...tuple(21), prepared: true }])).rejects.toThrow("builder_known_spell_preparation_unavailable");
  });
  it("uses selected historical subclass metadata, never mutable heads or legacy free-grant interpretation", async () => {
    await db.query("UPDATE public.content_definitions SET version=2 WHERE id=$1", [id(2)]);
    try {
      expect(await select([tuple(22)])).toHaveLength(1);
      await expect(select([tuple(22)], 5, graph(2))).rejects.toThrow("builder_spell_not_on_current_list");
    } finally { await db.query("UPDATE public.content_definitions SET version=1 WHERE id=$1", [id(2)]); }
  });
  it("prunes lost expanded-only spells and choice tuples, preserving overlapping ordinary rows exactly", async () => {
    const prior = graph(1, [physical(21), physical(22), physical(23)]);
    const result = await inCapability(async () => {
      const saved = await db.query<{ result: { choices: ReturnType<typeof choices>; graph: ReturnType<typeof graph> } }>(
        "SELECT private.prepare_builder_expanded_spells_v1($1,$2,$3) AS result", [target, choices(5, null), graph(null, prior.spells)]);
      return saved.rows[0].result;
    }, prior);
    expect(result.graph.spells).toEqual([physical(23)]);
    expect(result.choices.class_spell_selections.warlock).toEqual([tuple(23)]);
  });
  it("gates expansion by Warlock's own class level and ignores other multiclass levels", async () => {
    const result = await inCapability(async () => {
      const saved = await db.query<{ result: { graph: ReturnType<typeof graph> } }>(
        "SELECT private.prepare_builder_expanded_spells_v1($1,$2,$3) AS result", [target, choices(4), graph(1, [physical(21), physical(22), physical(23)])]);
      return saved.rows[0].result;
    });
    expect(result.graph.spells).toEqual([physical(21), physical(23)]);
    await expect(db.query("SELECT private.builder_expanded_spell_slugs_v1($1,$2,$3,'warlock',5)", [target, choices(), graph()]))
      .rejects.toThrow("builder_expanded_capability_required");
  });
  it("pins exact admitted function profiles rather than patching unknown installations", () => {
    const md5 = (sql: string) => createHash("md5").update(sql.slice(sql.indexOf("AS $$") + 5, sql.indexOf("END $$;") + 4)).digest("hex");
    expect(md5(ordinary)).toBe("775ba0c2a3d98174e829174ed9319e8b");
    let normalizer = body(read("supabase/staged/character-builder-bonus-spells.sql"), "CREATE FUNCTION private.prepare_builder_bonus_spells_v1");
    normalizer = normalizer.replace(fragments[1][0], fragments[1][1]);
    expect(md5(normalizer)).toBe("6dca5fc876104521adf8f9127e6ec294");
  });
});
