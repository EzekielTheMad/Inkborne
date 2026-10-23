import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

// Helper-level PostgreSQL vectors only. These deliberately do not prove the
// command actor, native graph triggers, receipts, ownership or application UI.
const db = new PGlite();
const character = "10000000-0000-4000-8000-000000000001";
const id = (n: number) => `20000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
type Row = Record<string, unknown>;
const definitions: Row[] = [];
const refs: Row[] = [];
function source(n: number, slug: string, type: string, data: Row, effects: Row[] = [], active = true) {
  definitions.push({ content_id: id(n), version: 1, slug_snapshot: slug, name_snapshot: slug, content_type_snapshot: type,
    data_snapshot: { subclass: null, ...data }, effects_snapshot: effects, system_id_snapshot: id(999), source_snapshot: "srd",
    scope_snapshot: "platform", owner_id_snapshot: null, created_at: "2026-10-23T00:00:00Z" });
  if (active) refs.push({ id: id(n + 100), character_id: character, content_id: id(n), content_version: 1,
    context: {}, choice_source: type === "class" ? "class" : `auto:feature-grant:${id(n + 200)}`,
    feature_grant_id: type === "class" ? null : id(n + 200), created_at: "2026-10-23T00:00:00Z" });
}
const feature = (choice_id: string, from: string[], choose = 1, grant_type = "feature") => ({ type: "choice", choice_id, choose, grant_type, from });
source(1, "warlock", "class", { levels: [{ level: 2, class_specific: { invocations_known: 2 } }, { level: 5, class_specific: { invocations_known: 3 } }] });
source(2, "metamagic-1", "feature", { class: "sorcerer", choices: [{ count: 2, options: ["metamagic-careful", "metamagic-subtle"] }] },
  [feature("metamagic-1", ["metamagic-careful", "metamagic-subtle"], 2)]);
source(3, "metamagic-2", "feature", { class: "sorcerer", choices: [{ count: 1, options: ["metamagic-careful", "metamagic-subtle"] }] },
  [feature("metamagic-2", ["metamagic-careful", "metamagic-subtle"])]);
source(4, "metamagic-careful", "feature", { class: "sorcerer" }, [], false);
source(5, "metamagic-subtle", "feature", { class: "sorcerer" }, [], false);
source(6, "pact-boon", "feature", { class: "warlock", choices: [{ count: 1, options: ["pact-of-the-blade", "pact-of-the-chain"] }] },
  [feature("pact-boon", ["pact-of-the-blade", "pact-of-the-chain"])]);
source(7, "pact-of-the-blade", "feature", { class: "warlock" }, [], false);
source(8, "pact-of-the-chain", "feature", { class: "warlock" }, [], false);
source(9, "eldritch-invocations", "feature", { class: "warlock", choices: [{ count: 2, options: ["ordinary", "requires-pact", "requires-spell", "requires-level"] }] },
  [feature("eldritch-invocations", ["ordinary", "requires-pact", "requires-spell", "requires-level"], 2, "invocation")]);
source(10, "ordinary", "feature", { class: "warlock", selection_prerequisites: [{ kind: "class_level", minimum: 2 }] }, [], false);
source(11, "requires-pact", "feature", { class: "warlock", selection_prerequisites: [{ kind: "class_level", minimum: 5 }, { kind: "feature", slug: "pact-of-the-blade" }] }, [], false);
source(12, "requires-spell", "feature", { class: "warlock", selection_prerequisites: [{ kind: "class_level", minimum: 2 }, { kind: "spell", slug: "eldritch-blast" }] }, [], false);
source(13, "requires-level", "feature", { class: "warlock", selection_prerequisites: [{ kind: "class_level", minimum: 9 }] }, [], false);
source(14, "eldritch-blast", "spell", { level: 0 }, [], false);
source(15, "terrain-1", "feature", { class: "ranger" }, [feature("terrain-1", ["forest", "swamp"], 1, "favored_terrain")]);
source(16, "terrain-2", "feature", { class: "ranger" }, [feature("terrain-2", ["forest", "swamp"], 1, "favored_terrain")]);
source(17, "fighter-fighting-style", "feature", { class: "fighter", feature_type: "fighting_style",
  choices: [{ count: 1, options: ["fighter-defense", "fighter-archery"] }] });
source(18, "additional-fighting-style", "feature", { class: "fighter", subclass: "champion", feature_type: "fighting_style",
  choices: [{ count: 1, options: ["fighter-defense", "fighter-archery"] }] });
source(19, "fighter-defense", "feature", { class: "fighter", feature_type: "passive" }, [], false);
source(20, "fighter-archery", "feature", { class: "fighter", feature_type: "passive" }, [], false);
const choices = (resolved_choices: Row = {}, level = 5) => ({ classes: [{ slug: "warlock", level }, { slug: "sorcerer", level: 10 },
  { slug: "ranger", level: 6 }], resolved_choices });
const graph = (spells: Row[] = []) => ({ refs, spells });

beforeAll(async () => {
  await db.exec(`CREATE SCHEMA private;
    CREATE TABLE private.character_builder_capabilities_v1(transaction_id xid8,character_id uuid,context jsonb,protected_graph jsonb);
    CREATE TABLE public.content_versions(content_id uuid,version integer,slug_snapshot text,name_snapshot text,content_type_snapshot text,
      data_snapshot jsonb,effects_snapshot jsonb,system_id_snapshot uuid,source_snapshot text,scope_snapshot text,owner_id_snapshot uuid,created_at timestamptz);
    CREATE TABLE public.character_content_refs(id uuid,character_id uuid,content_id uuid,content_version integer,context jsonb,choice_source text,
      feature_grant_id uuid,created_at timestamptz);
    CREATE FUNCTION private.lock_builder_character_rows_v1(jsonb,uuid) RETURNS void LANGUAGE sql AS 'SELECT';
    CREATE FUNCTION private.character_can_access_content_version(uuid,uuid,integer) RETURNS boolean LANGUAGE sql AS 'SELECT true';
    CREATE FUNCTION private.builder_exact_keys_v1(value jsonb,keys text[]) RETURNS boolean LANGUAGE sql AS
      'SELECT jsonb_typeof(value)=''object'' AND (SELECT count(*) FROM jsonb_object_keys(value))=cardinality(keys) AND value ?& keys';`);
  const catalog = readFileSync("supabase/staged/character-builder-catalog.sql", "utf8").replaceAll("\r\n", "\n");
  await db.exec(catalog.slice(catalog.indexOf("CREATE FUNCTION private.builder_catalog_dependency_v1"), catalog.indexOf("-- Existing occurrence lifecycle/history")));
  const stage = readFileSync("supabase/staged/character-builder-class-feature-choices.sql", "utf8");
  await db.exec(stage.slice(stage.indexOf("CREATE FUNCTION private.builder_invocation_choice_v1"), stage.indexOf("-- The installation profile")));
  for (const definition of definitions) {
    await db.query(`INSERT INTO public.content_versions SELECT * FROM jsonb_populate_record(NULL::public.content_versions,$1)`, [definition]);
  }
});
afterAll(async () => { await db.close(); });

async function apply(pending: Row, strict: string | null = null, expected: Row = graph(), prior: Row = graph()) {
  await db.exec("BEGIN");
  try {
    await db.query(`INSERT INTO private.character_builder_capabilities_v1 VALUES(pg_current_xact_id(),$1,'{}',$2)`, [character, prior]);
    const result = await db.query<{ result: { choices: { resolved_choices: Record<string, string[]> }; graph: { refs: Row[] } } }>(
      `SELECT private.prepare_builder_class_feature_choices_v1($1,$2,$3,$4) AS result`, [character, pending, expected, strict]);
    return result.rows[0].result;
  } finally { await db.exec("ROLLBACK"); }
}

describe("native class feature choice helpers", () => {
  it("materializes exact child pins and retains their identities when unrelated choices save", async () => {
    const selected = choices({ "metamagic-1": ["metamagic-careful", "metamagic-subtle"] });
    const first = await apply(selected, "metamagic-1");
    const children = first.graph.refs.filter(ref => String(ref.choice_source).startsWith("builder:feature-choice:"));
    expect(children).toHaveLength(2);
    expect(children.every(ref => ref.feature_grant_id === null && ref.content_version === 1)).toBe(true);
    const second = await apply(selected, null, first.graph, first.graph);
    expect(second.graph.refs).toEqual(first.graph.refs);
  });
  it("rejects duplicate additional options and terrain, while pruning an existing conflict symmetrically", async () => {
    await expect(apply(choices({ "metamagic-1": ["metamagic-careful"], "metamagic-2": ["metamagic-careful"] }), "metamagic-2"))
      .rejects.toThrow("builder_feature_choice_prerequisite_unavailable");
    const terrain = choices({ "terrain-1": ["forest"], "terrain-2": ["forest"] });
    await expect(apply(terrain, "terrain-2")).rejects.toThrow("builder_feature_choice_prerequisite_unavailable");
    expect((await apply(terrain)).choices.resolved_choices).toEqual({ "terrain-1": [], "terrain-2": [] });
  });
  it("uses pinned invocation capacity and actual level, spell and pact prerequisites", async () => {
    const selected = choices({ "pact-boon": ["pact-of-the-blade"], "eldritch-invocations": ["ordinary", "requires-pact", "requires-spell"] });
    const spells = [{ id: id(500), character_id: character, content_id: id(14), content_version: 1, is_known: true }];
    expect((await apply(selected, "eldritch-invocations", graph(spells))).choices.resolved_choices["eldritch-invocations"])
      .toEqual(["ordinary", "requires-pact", "requires-spell"]);
    await expect(apply(selected, "eldritch-invocations")).rejects.toThrow("builder_feature_choice_prerequisite_unavailable");
    await expect(apply(choices({ "eldritch-invocations": ["requires-level"] }), "eldritch-invocations"))
      .rejects.toThrow("builder_feature_choice_prerequisite_unavailable");
  });
  it("prunes only invocations whose newly saved pact or spell knowledge stopped qualifying", async () => {
    const saved = choices({ "pact-boon": ["pact-of-the-blade"], "eldritch-invocations": ["ordinary", "requires-pact", "requires-spell"] });
    const spells = [{ id: id(500), character_id: character, content_id: id(14), content_version: 1, is_known: true }];
    const first = await apply(saved, "eldritch-invocations", graph(spells));
    const changed = choices({ ...saved.resolved_choices, "pact-boon": ["pact-of-the-chain"] });
    const next = await apply(changed, "pact-boon", { ...first.graph, spells: [] }, first.graph);
    expect(next.choices.resolved_choices["eldritch-invocations"]).toEqual(["ordinary"]);
    expect(next.graph.refs.some(ref => ref.content_id === id(11) || ref.content_id === id(12))).toBe(false);
  });
  it("supports subclass-owned Additional Fighting Style and rejects the same style twice", async () => {
    const selected = choices({ "fighter-fighting-style": ["fighter-defense"], "additional-fighting-style": ["fighter-archery"] });
    const saved = await apply(selected, "additional-fighting-style");
    const styles = saved.graph.refs.filter(ref => String(ref.choice_source).startsWith("builder:fighting-style:"));
    expect(styles).toHaveLength(2);
    expect(styles.map(ref => ref.content_id).sort()).toEqual([id(19), id(20)]);
    await expect(apply(choices({ "fighter-fighting-style": ["fighter-defense"], "additional-fighting-style": ["fighter-defense"] }), "additional-fighting-style"))
      .rejects.toThrow("builder_feature_choice_prerequisite_unavailable");
  });
});
