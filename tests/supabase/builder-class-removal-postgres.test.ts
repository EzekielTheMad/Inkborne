import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { builderStepInputSchema } from "../../lib/builder/builder-step-command";

// Bounded compiler vectors with authorization/projection collaborators stubbed.
// The real local app separately exercises JWT admission, protected triggers,
// ownership, receipts, occurrence retirement and re-addition through PostgreSQL.
const db = new PGlite();
type Row = Record<string, unknown>;
const target = "10000000-0000-4000-8000-000000000001", actor = "10000000-0000-4000-8000-000000000002";
const id = (n: number) => `20000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
const read = (path: string) => readFileSync(path, "utf8").replaceAll("\r\n", "\n");
const stage = read("supabase/staged/character-builder-class-removal.sql");
const beforeChoices = { classes: [
  { slug: "fighter", level: 4, occurrence_id: id(1) }, { slug: "cleric", level: 4, occurrence_id: id(2), subclass: "life" },
], hp_rolls: { "fighter-2": { method: "manual", value: 8 }, "cleric-1": { method: "rolled", value: 7 }, "cleric-4": { method: "average", value: 5 } },
resolved_choices: { "fighter-skills": ["skill-athletics"], "cleric-skills": ["skill-religion"], "life-choice": ["skill-medicine"] },
asi_choices: { "fighter-asi": { mode: "asi", allocations: [{ ability: "strength", amount: 2 }] }, "cleric-asi": { mode: "asi", allocations: [{ ability: "wisdom", amount: 2 }] } },
class_spell_selections: { cleric: [{ content_id: id(91), content_version: 1, prepared: true }] },
starting_equipment: { confirmed: true, selections: { armor: "chain-mail" } }, details: { alignment: "neutral" } };
const occurrences = [1, 2].map(n => ({ id: id(n), character_id: target, class_slug: n === 1 ? "fighter" : "cleric",
  lifecycle: "accepted", controller_ref_id: id(n + 10), subclass_ref_id: n === 1 ? null : id(13),
  acquisition_operation_id: id(n + 100), accepted_at: "2026-10-23T00:00:00+00:00", ended_at: null }));
const pin = (n: number, extra: Row = {}): Row => ({ id: id(n), character_id: target, content_id: id(n + 1000), content_version: 1,
  feature_grant_id: null, choice_source: "class", context: {}, ...extra });
const refs = [pin(11), pin(12), pin(13), pin(21, { feature_grant_id: id(31), choice_source: `auto:feature-grant:${id(31)}` }),
  pin(22, { feature_grant_id: id(32), choice_source: `auto:feature-grant:${id(32)}` }),
  pin(23, { choice_source: `builder:feature-choice:${id(22)}:life-choice:child`, context: { source_ref_id: id(22), class: "cleric" } }),
  pin(24, { choice_source: `choice:asi:${id(32)}` }), pin(25, { choice_source: `choice:asi:${id(31)}` })];
const featureGrants = [{ id: id(31), controller_ref_id: id(11), feature_slug: "fighter-asi", unlock_level: 4 },
  { id: id(32), controller_ref_id: id(12), feature_slug: "cleric-asi", unlock_level: 4 },
  { id: id(33), controller_ref_id: id(13), feature_slug: "life-choice", unlock_level: 1 }];
const protectedGraph = { refs, feature_grants: featureGrants, spell_grants: [{ id: id(41), controller_ref_id: id(13) }], occurrences,
  spells: [{ id: id(51), class_slug: "cleric", source: "selection", content_id: id(91), content_version: 1, is_prepared: true,
    custom_data: { builder_class_controller_ref_id: id(12) }, spell_grant_id: null },
  { id: id(52), class_slug: "cleric", source: "feature", spell_grant_id: id(41), custom_data: null },
  { id: id(53), class_slug: null, source: "racial_trait", custom_data: null, spell_grant_id: null }],
  origin: { immutable: true }, commands: [{ immutable: true }] };
beforeAll(async () => {
  await db.exec(`CREATE SCHEMA private;
    CREATE TABLE public.characters(id uuid,user_id uuid,choices jsonb,state jsonb,level integer,action_revision bigint);
    CREATE TABLE private.character_builder_capabilities_v1(transaction_id xid8,character_id uuid,actor_id uuid,command text,context jsonb,before_parent jsonb,
      protected_graph jsonb,expected_graph jsonb,expected_classes jsonb,expected_choices jsonb,expected_state jsonb,expected_level integer);
    CREATE TABLE public.character_content_refs(id uuid,character_id uuid,content_id uuid,content_version integer);
    CREATE TABLE public.content_versions(content_id uuid,version integer,content_type_snapshot text,effects_snapshot jsonb);
    CREATE FUNCTION private.lock_builder_character_rows_v1(jsonb,uuid) RETURNS void LANGUAGE sql AS 'SELECT';
    CREATE FUNCTION private.builder_class_roles_v1(uuid) RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb';
    CREATE FUNCTION private.builder_original_occurrence_v1(uuid) RETURNS jsonb LANGUAGE sql AS 'SELECT jsonb_build_object(''id'',''${id(1)}'')';
    CREATE FUNCTION private.builder_uuid_v1(text) RETURNS boolean LANGUAGE sql AS 'SELECT $1 ~ ''^[0-9a-f-]{36}$''';
    CREATE FUNCTION private.builder_exact_keys_v1(value jsonb,keys text[]) RETURNS boolean LANGUAGE sql AS
      'SELECT jsonb_typeof(value)=''object'' AND (SELECT count(*) FROM jsonb_object_keys(value))=cardinality(keys) AND value ?& keys';
    CREATE FUNCTION private.builder_controller_level_v1(jsonb,jsonb,text) RETURNS integer LANGUAGE sql AS 'SELECT 4';
    CREATE FUNCTION private.builder_progression_class_spells_v1(uuid,jsonb,integer,jsonb,jsonb,text) RETURNS jsonb LANGUAGE sql AS 'SELECT ''[]''::jsonb';
    CREATE FUNCTION private.prepare_builder_class_feature_choices_v1(uuid,jsonb,jsonb,text,jsonb) RETURNS jsonb LANGUAGE sql AS 'SELECT jsonb_build_object(''choices'',$2,''graph'',$3)';
    CREATE FUNCTION private.builder_multiclass_max_hp_v1(uuid,jsonb,jsonb) RETURNS integer LANGUAGE sql AS 'SELECT 32';
    CREATE FUNCTION private.apply_builder_progression_graph_v1(uuid,jsonb,jsonb,integer) RETURNS void LANGUAGE sql AS 'SELECT';`);
  await db.exec(stage.slice(stage.indexOf("CREATE FUNCTION private.prepare_builder_class_removal_v1"), stage.indexOf("-- Exact finite profile amendments")));
  await db.query("INSERT INTO public.characters VALUES($1,$2,$3,$4,8,10)", [target, actor, beforeChoices, { current_hp: 60, currency: { gp: 15 } }]);
  const sourceChoices: Record<number, string[]> = { 11: ["fighter-skills"], 12: ["cleric-skills"], 13: ["life-choice"] };
  for (const r of refs) await db.query("INSERT INTO public.content_versions VALUES($1,1,'feature',$2)", [r.content_id,
    (sourceChoices[Number((r.id as string).slice(-12))] ?? []).map(choice_id => ({ type: "choice", choice_id }))]);
});
afterAll(async () => { await db.close(); });
async function compile(fields: Row = { occurrence_id: id(2), expected_action_revision: "10" }, graph = protectedGraph) {
  await db.exec("BEGIN");
  try {
    await db.query("INSERT INTO private.character_builder_capabilities_v1(transaction_id,character_id,actor_id,command,context,before_parent,protected_graph) VALUES(pg_current_xact_id(),$1,$2,'remove_class','{}',$3,$4)",
      [target, actor, { choices: beforeChoices }, graph]);
    await db.query("SELECT private.prepare_builder_class_removal_v1($1,$2)", [target, fields]);
    const result = await db.query<{ expected_graph: typeof protectedGraph; expected_choices: typeof beforeChoices; expected_state: Row; expected_level: number }>(
      "SELECT expected_graph,expected_choices,expected_state,expected_level FROM private.character_builder_capabilities_v1");
    return result.rows[0];
  } finally { await db.exec("ROLLBACK"); }
}

describe("finite added-class removal compiler", () => {
  it("keeps the original class fixed and refuses stale, malformed, foreign and ended occurrence targets", async () => {
    await expect(compile({ occurrence_id: id(1), expected_action_revision: "10" })).rejects.toThrow("builder_starting_class_is_fixed");
    await expect(compile({ occurrence_id: id(2), expected_action_revision: "9" })).rejects.toThrow("builder_stale_action_revision");
    await expect(compile({ occurrence_id: id(2), expected_action_revision: 10 })).rejects.toThrow("builder_invalid_class_removal");
    await expect(compile({ occurrence_id: id(999), expected_action_revision: "10" })).rejects.toThrow("builder_added_class_unavailable");
    await expect(compile(undefined, { ...protectedGraph, occurrences: occurrences.map(o => o.id === id(2) ? { ...o, lifecycle: "ended" } : o) }))
      .rejects.toThrow("builder_added_class_unavailable");
  });
  it("seals only the removed secondary source closure and an ended historical occurrence", async () => {
    const saved = await compile();
    expect(saved.expected_choices.classes).toEqual([beforeChoices.classes[0]]);
    expect(saved.expected_level).toBe(4);
    expect(saved.expected_graph.refs).toEqual([refs[0], refs[3], refs[7]]);
    expect(saved.expected_graph.feature_grants).toEqual([featureGrants[0]]);
    expect(saved.expected_graph.spell_grants).toEqual([]);
    expect(saved.expected_graph.spells).toEqual([protectedGraph.spells[2]]);
    expect(saved.expected_graph.occurrences[0]).toEqual(occurrences[0]);
    expect(saved.expected_graph.occurrences[1]).toMatchObject({ ...occurrences[1], lifecycle: "ended", ended_at: expect.any(String) });
    expect(saved.expected_graph.origin).toEqual(protectedGraph.origin);
    expect(saved.expected_graph.commands).toEqual(protectedGraph.commands);
  });
  it("retires owned skill, spell, ASI and HP choices, while retaining inventory intent and other class choices", async () => {
    const saved = await compile();
    expect(saved.expected_choices.hp_rolls).toEqual({ "fighter-2": beforeChoices.hp_rolls["fighter-2"] });
    expect(saved.expected_choices.resolved_choices).toEqual({ "fighter-skills": ["skill-athletics"] });
    expect(saved.expected_choices.asi_choices).toEqual({ "fighter-asi": beforeChoices.asi_choices["fighter-asi"] });
    expect(saved.expected_choices.class_spell_selections).toEqual({});
    expect(saved.expected_choices.starting_equipment).toEqual(beforeChoices.starting_equipment);
    expect(saved.expected_choices.details).toEqual(beforeChoices.details);
    expect(saved.expected_state).toEqual({ current_hp: 32, currency: { gp: 15 } });
  });
  it("retains unrelated spells when the removed class has no subclass", async () => {
    const noSubclass = { ...protectedGraph, occurrences: occurrences.map(o => o.id === id(2) ? { ...o, subclass_ref_id: null } : o) };
    const saved = await compile(undefined, noSubclass);
    expect(saved.expected_graph.spells).toEqual([protectedGraph.spells[2]]);
  });
});

describe("native removal command and exact profile amendments", () => {
  it("admits only an exact occurrence and string revision, never caller-authored projections", () => {
    const fields = { occurrence_id: id(2), expected_action_revision: "10" };
    expect(builderStepInputSchema.safeParse({ command: "remove_class", fields }).success).toBe(true);
    expect(builderStepInputSchema.safeParse({ command: "remove_class", fields: { ...fields, expected_action_revision: 10 } }).success).toBe(false);
    expect(builderStepInputSchema.safeParse({ command: "remove_class", fields: { ...fields, classes: [] } }).success).toBe(false);
  });
  it("pins all five before/after function bodies, including occurrence-scoped HP recovery", () => {
    const multi = read("supabase/staged/character-builder-multiclass.sql"), progression = read("supabase/staged/character-builder-progression.sql");
    const body = (sql: string, name: string) => sql.slice(sql.indexOf("AS $$", sql.indexOf(name)) + 5, sql.indexOf("END $$;", sql.indexOf(name)) + 4);
    const bodies: Record<string, string> = {
      transition: body(multi, "CREATE OR REPLACE FUNCTION private.builder_catalog_occurrence_transition_v1"),
      apply: body(multi, "CREATE OR REPLACE FUNCTION private.apply_builder_progression_graph_v1"),
      asi: body(progression, "CREATE FUNCTION private.builder_progression_asi_write_v1"),
      history: body(multi, "CREATE OR REPLACE FUNCTION private.check_builder_progression_history_v1"),
      hp: body(multi, "CREATE OR REPLACE FUNCTION private.prepare_builder_progression_v1"),
    };
    bodies.apply = bodies.apply.replace("in_spellbook=(entry->>'in_spellbook')::boolean WHERE id=(entry->>'id')::uuid AND character_id=target;",
      "in_spellbook=(entry->>'in_spellbook')::boolean,always_prepared=(entry->>'always_prepared')::boolean,custom_data=entry->'custom_data' WHERE id=(entry->>'id')::uuid AND character_id=target;");
    const injection = read("supabase/staged/character-builder-class-feature-choices.sql").match(/insertion:=\$progression\$([\s\S]*?)\$progression\$;/)![1];
    const sort = "  FOREACH domain IN ARRAY ARRAY['refs','feature_grants','spell_grants','spells','occurrences'] LOOP";
    bodies.hp = bodies.hp.replace(sort, injection + sort);
    const expected = [...stage.matchAll(/'([a-f0-9]{32})','([a-f0-9]{32})','(transition|apply|asi|history|hp)'/g)];
    const fragments = [...stage.matchAll(/needle:=\$(\w+)\$([\s\S]*?)\$\1\$;\n\s+insertion:=\$\1\$([\s\S]*?)\$\1\$;/g)];
    const hash = (sql: string) => createHash("md5").update(sql).digest("hex");
    expect(expected).toHaveLength(5);
    for (const fragment of fragments) {
      const [, kind, needle, insertion] = fragment, wanted = expected.find(item => item[3] === kind)!;
      expect(hash(bodies[kind]), kind).toBe(wanted[1]);
      expect(bodies[kind].split(needle)).toHaveLength(2);
      expect(hash(bodies[kind].replace(needle, insertion)), kind).toBe(wanted[2]);
    }
  });
});
