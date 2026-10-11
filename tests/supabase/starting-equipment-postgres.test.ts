// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { equipmentFixtureSql } from "../fixtures/starting-equipment-postgres";

// Runs the entire real staged file, unchanged, in memory. These serial tests
// prove only this synthetic PostgreSQL-WASM model, not the full Supabase schema,
// multi-connection locking, hosted privileges, or rollout readiness.
const db = new PGlite();
const owner = "11111111-1111-4111-8111-111111111111";
const stranger = "22222222-2222-4222-8222-222222222222";
const character = "33333333-3333-4333-8333-333333333333";
const system = "44444444-4444-4444-8444-444444444444";
const classId = "55555555-5555-4555-8555-555555555555";
const itemId = "66666666-6666-4666-8666-666666666666";
const campaign = "77777777-7777-4777-8777-777777777777";
const picks = { selections: { "class:0": "a" }, picks: {} };
const choices = { classes: [{ slug: "fighter" }], starting_equipment: picks, notes: "Keep this" };
const state = { currency: { gp: 2 }, current_hp: 9 };
const refs = [{ content_id: classId, content_version: 3 }];
const plan = { items: [{ content_id: null, content_version: null, name: "Mace", content_type: "item", quantity: 1 }], currency: { gp: 15 } };
const intent = { selections: picks, sources: { class: { id: classId, version: 3 }, background: null }, plan };
type Award = { status: string; receipt?: { grant_id: string; inventory_ids: string[]; plan: typeof plan } };
type CharacterSnapshot = { choices: unknown; state: unknown; items: number; grant_status: string | null };

async function role(name: "service_role" | "authenticated" | "anon", actor = "") {
  await db.exec(`reset role; set local role ${name}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, true)", [actor]);
}
async function commit(nextIntent: unknown = intent, expectedChoices: unknown = choices, expectedRefs: unknown = refs, actor = owner, target = character) {
  return (await db.query<{ result: Award }>(
    "select public.commit_starting_equipment($1,$2,$3,$4,$5) as result",
    [actor, target, expectedChoices, expectedRefs, nextIntent],
  )).rows[0].result;
}
async function resolve(actor = owner, target = character, request: unknown = { selections: picks, sources: intent.sources }) {
  return (await db.query<{ result: Award }>("select public.resolve_starting_equipment($1,$2,$3) as result", [actor, target, request])).rows[0].result;
}
async function copy(target: string | null = null) {
  await role("authenticated", owner);
  return (await db.query<{ id: string }>("select public.copy_character($1,$2) as id", [character, target])).rows[0].id;
}
async function snapshot(target = character) {
  await db.exec("reset role");
  return (await db.query<CharacterSnapshot>("select choices,state,(select count(*)::int from public.character_inventory i where i.character_id=c.id) as items,(select status from public.character_starting_grants g where g.character_id=c.id) as grant_status from public.characters c where c.id=$1", [target])).rows[0];
}
async function rejectsWithoutChanges(operation: () => Promise<unknown>, code: string) {
  const before = await snapshot();
  await role("service_role");
  await db.exec("savepoint rejected");
  await expect(operation()).rejects.toMatchObject({ code });
  await db.exec("rollback to savepoint rejected");
  expect(await snapshot()).toEqual(before);
}

beforeAll(async () => {
  await db.exec(equipmentFixtureSql);
  await db.exec(readFileSync("supabase/staged/starting-equipment-transaction.sql", "utf8"));
  await db.query("insert into public.game_systems values ($1,'published')", [system]);
}, 30_000);
beforeEach(async () => {
  await db.exec("begin");
  await db.query("insert into public.characters(id,user_id,system_id,name,choices,state) values($1,$2,$3,'Synthetic fighter',$4,$5)", [character, owner, system, choices, state]);
  await db.query("insert into public.content_versions values($1,3,$2,'class','fighter','Fighter','platform',null)", [classId, system]);
  await db.query("insert into public.character_content_refs(character_id,content_id,content_version) values($1,$2,3)", [character, classId]);
  await db.query("insert into public.character_starting_grants(character_id,status) values($1,'eligible')", [character]);
  await role("service_role");
});
afterEach(async () => { await db.exec("rollback"); });
afterAll(async () => { await db.close(); });

describe("executable staged equipment transaction", () => {
  it("creates a character and exactly one eligible marker together", async () => {
    const id = (await db.query<{ id: string }>("select public.create_character_with_starting_grant($1,'  New fighter  ',$2) as id", [owner, system])).rows[0].id;
    expect((await db.query("select name,user_id from public.characters where id=$1", [id])).rows).toEqual([{ name: "New fighter", user_id: owner }]);
    expect((await db.query("select status from public.character_starting_grants where character_id=$1", [id])).rows).toEqual([{ status: "eligible" }]);
  });
  it("rolls back character creation when marker insertion fails", async () => {
    await db.exec("reset role; create function private.fail_marker() returns trigger language plpgsql as $$ begin raise exception 'fixture failure' using errcode='23514'; end $$; create trigger fixture_failure before insert on public.character_starting_grants for each row execute function private.fail_marker()");
    await rejectsWithoutChanges(() => db.query("select public.create_character_with_starting_grant($1,'Failed fighter',$2)", [owner, system]), "23514");
    expect((await db.query<{ count: number }>("select count(*)::int as count from public.characters")).rows[0].count).toBe(1);
  });
  it("awards inventory, currency, confirmation and the original receipt atomically", async () => {
    const awarded = await commit();
    expect(awarded.status).toBe("awarded");
    expect(awarded.receipt?.inventory_ids).toHaveLength(1);
    expect(awarded.receipt?.plan).toEqual(plan);
    expect(await snapshot()).toEqual({ choices: { ...choices, starting_equipment: { ...picks, confirmed: true } }, state: { ...state, currency: { cp: 0, sp: 0, ep: 0, gp: 17, pp: 0 } }, items: 1, grant_status: "awarded" });
  });
  it("replays the exact committed plan without duplicate items or currency", async () => {
    const first = await commit();
    const before = await snapshot();
    await role("service_role");
    expect(await commit()).toEqual(first);
    expect(await snapshot()).toEqual(before);
  });
  it("recovers the receipt after consumption, spent currency and pin deletion", async () => {
    const first = await commit();
    await db.exec("delete from public.character_inventory; delete from public.character_content_refs; update public.characters set state=jsonb_set(state,'{currency,gp}','0')");
    expect(await resolve()).toEqual(first);
    expect(await commit()).toEqual(first);
    const row = await snapshot();
    expect(row.items).toBe(0);
    expect(row.state).toEqual({ ...state, currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 } });
  });
  it("rejects a different request and a different canonical plan after completion", async () => {
    await commit();
    expect(await resolve(owner,character,{ selections: { selections: {}, picks: {} }, sources: intent.sources })).toEqual({ status: "conflict" });
    expect(await commit({ ...intent, plan: { ...plan, currency: { gp: 999 } } })).toEqual({ status: "conflict" });
  });
  it.each(["choices", "pins", "picks", "source"])("rejects changed %s before writing", async kind => {
    const before = await snapshot();
    await role("service_role");
    const result = kind === "choices" ? await commit(intent,{ ...choices, notes: "Stale" })
      : kind === "pins" ? await commit(intent,choices,[])
      : kind === "picks" ? await commit({ ...intent, selections: { selections: {}, picks: {} } })
      : await commit({ ...intent, sources: { class: { id: classId, version: 4 }, background: null } });
    expect(result).toEqual({ status: "conflict" });
    expect(await snapshot()).toEqual(before);
  });
  it.each(["first_item", "second_item", "character", "receipt"])("rolls back every award write when %s fails", async point => {
    await db.exec("reset role");
    const table = point === "character" ? "characters" : point === "receipt" ? "character_starting_grants" : "character_inventory";
    const condition = point === "second_item" ? "if NEW.name <> 'Second item' then return NEW; end if;" : "";
    await db.exec(`create function private.fail_award() returns trigger language plpgsql as $$ begin ${condition} raise exception 'fixture failure' using errcode='23514'; end $$; create trigger fixture_failure before ${table === "character_inventory" ? "insert" : "update"} on public.${table} for each row execute function private.fail_award()`);
    await rejectsWithoutChanges(() => commit({ ...intent, plan: { ...plan, items: [...plan.items, { ...plan.items[0], name: "Second item" }] } }), "23514");
  });
  it.each([null, [], { items: [], currency: [] }, { items: Array(201).fill(plan.items[0]), currency: {} }, { items: [], currency: { gold: 1 } }, { items: [], currency: { gp: -1 } }, { items: [], currency: { gp: 1.5 } }, { items: [], currency: { gp: 1000001 } }, { items: [], currency: { gp: "1" } }])("rejects invalid plan %j without partial writes", async invalid => {
    await rejectsWithoutChanges(() => commit({ ...intent, plan: invalid }), "22023");
  });
  it.each([0, 1.5, 10001, "1"])("rejects invalid item quantity %j", async quantity => {
    await rejectsWithoutChanges(() => commit({ ...intent, plan: { ...plan, items: [{ ...plan.items[0], quantity }] } }), "22023");
  });
  it("denies unauthorized immutable item content without granting", async () => {
    await db.query("insert into public.content_versions values($1,1,$2,'weapon','private-sword','Private sword','personal',$3)", [itemId, system, stranger]);
    await rejectsWithoutChanges(() => commit({ ...intent, plan: { ...plan, items: [{ content_id: itemId, content_version: 1, name: "Private sword", content_type: "weapon", quantity: 1 }] } }), "42501");
  });
  it("fails closed when a pinned source belongs to another owner", async () => {
    await db.exec("update public.content_versions set scope_snapshot='personal'");
    await db.query("update public.content_versions set owner_id_snapshot=$1",[stranger]);
    expect(await commit()).toEqual({ status: "conflict" });
    expect((await snapshot()).items).toBe(0);
  });
  it("allows an owner's private immutable item and preserves its exact version", async () => {
    await db.query("insert into public.content_versions values($1,1,$2,'weapon','private-sword','Private sword','personal',$3)", [itemId, system, owner]);
    const item = { content_id: itemId, content_version: 1, name: "Private sword", content_type: "weapon", quantity: 1 };
    expect((await commit({ ...intent, plan: { ...plan, items: [item] } })).status).toBe("awarded");
    expect((await db.query("select content_id,content_version,name from public.character_inventory")).rows).toEqual([{ content_id: itemId, content_version: 1, name: "Private sword" }]);
  });
  it("rejects mismatched pinned item metadata without partial writes", async () => {
    await db.query("insert into public.content_versions values($1,1,$2,'weapon','sword','Sword','platform',null)", [itemId, system]);
    await rejectsWithoutChanges(() => commit({ ...intent, plan: { ...plan, items: [{ content_id: itemId, content_version: 1, name: "Mismatched name", content_type: "weapon", quantity: 1 }] } }), "42501");
  });
  it("allows shared sources only in the character's authorized campaign", async () => {
    await db.exec("reset role");
    await db.query("insert into public.campaigns values($1,$2,$3)",[campaign,stranger,system]);
    await db.query("insert into public.campaign_members values($1,$2)",[campaign,owner]);
    await db.query("insert into public.content_shares values($1,$2)",[classId,campaign]);
    await db.query("update public.characters set campaign_id=$1 where id=$2",[campaign,character]);
    await db.query("update public.content_versions set scope_snapshot='shared',owner_id_snapshot=$1",[stranger]);
    await role("service_role");
    expect((await commit()).status).toBe("awarded");
  });
  it.each(["membership", "share"])("denies shared sources after %s withdrawal", async withdrawn => {
    await db.exec("reset role");
    await db.query("insert into public.campaigns values($1,$2,$3)",[campaign,stranger,system]);
    await db.query("update public.characters set campaign_id=$1 where id=$2",[campaign,character]);
    await db.query("update public.content_versions set scope_snapshot='shared',owner_id_snapshot=$1",[stranger]);
    if (withdrawn === "membership") await db.query("insert into public.content_shares values($1,$2)",[classId,campaign]);
    else await db.query("insert into public.campaign_members values($1,$2)",[campaign,owner]);
    await role("service_role");
    expect(await commit()).toEqual({ status: "conflict" });
    expect((await snapshot()).items).toBe(0);
  });
  it.each(["authenticated", "anon"] as const)("denies %s execution of privileged award/creation functions", async caller => {
    await role(caller, owner);
    for (const operation of [() => commit(), () => resolve(), () => db.query("select public.create_character_with_starting_grant($1,'No grant',$2)",[owner,system])]) {
      await db.exec("savepoint denied");
      await expect(operation()).rejects.toMatchObject({ code: "42501" });
      await db.exec("rollback to savepoint denied");
    }
  });
  it("denies foreign actor and missing actor at the trusted boundary", async () => {
    for (const actor of [stranger, null]) {
      await db.exec("savepoint denied");
      await expect(db.query("select public.resolve_starting_equipment($1,$2,$3)",[actor,character,{}])).rejects.toMatchObject({ code: "42501" });
      await db.exec("rollback to savepoint denied");
    }
  });
  it("allows only the owner to read the ledger and prevents owner ledger writes", async () => {
    await role("authenticated",owner);
    expect((await db.query("select status from public.character_starting_grants")).rows).toEqual([{ status: "eligible" }]);
    await role("authenticated",stranger);
    expect((await db.query("select * from public.character_starting_grants")).rows).toEqual([]);
    await db.exec("savepoint denied");
    await expect(db.exec("update public.character_starting_grants set status='eligible'")).rejects.toMatchObject({ code: "42501" });
    await db.exec("rollback to savepoint denied");
  });
  it("keeps completed receipts immutable and rejects forged inventory provenance", async () => {
    const awarded = await commit();
    await db.exec("savepoint immutable");
    await expect(db.exec("update public.character_starting_grants set receipt='{}'")).rejects.toMatchObject({ code: "23514" });
    await db.exec("rollback to savepoint immutable");
    await role("authenticated",owner);
    await db.exec("savepoint denied");
    await expect(db.query("insert into public.character_inventory(character_id,name,content_type,starting_grant_id) values($1,'Forged','item',$2)",[character,awarded.receipt?.grant_id])).rejects.toMatchObject({ code: "42501" });
    await db.exec("rollback to savepoint denied");
    await expect(db.exec("update public.character_inventory set starting_grant_id=null")).rejects.toMatchObject({ code: "23514" });
  });
  it("copies awarded completion and current inventory without a new award receipt", async () => {
    const awarded = await commit();
    const id = await copy();
    expect(await snapshot(id)).toMatchObject({ items: 1, grant_status: "inherited_completion", state: { ...state, currency: { cp: 0, sp: 0, ep: 0, gp: 17, pp: 0 } } });
    const ledger = (await db.query<{ id: string; receipt: unknown; canonical_intent: unknown }>("select id,receipt,canonical_intent from public.character_starting_grants where character_id=$1",[id])).rows[0];
    expect(ledger.receipt).toBeNull(); expect(ledger.canonical_intent).toBeNull();
    expect(ledger.id).not.toBe(awarded.receipt?.grant_id);
    expect((await db.query<{ starting_grant_id: string | null }>("select starting_grant_id from public.character_inventory where character_id=$1",[id])).rows[0].starting_grant_id).toBe(ledger.id);
    await role("service_role");
    expect(await resolve(owner,id)).toEqual({ status: "already_completed" });
  });
  it("copies after inventory consumption without resurrecting awarded items", async () => {
    await commit(); await db.exec("delete from public.character_inventory");
    await db.exec("update public.characters set state=jsonb_set(state,'{currency,gp}','5')");
    expect(await snapshot(await copy())).toMatchObject({ items: 0, grant_status: "inherited_completion", state: { currency: { gp: 5 } } });
  });
  it("copies eligibility without granting and leaves no-marker legacy characters unresolved", async () => {
    expect(await snapshot(await copy())).toMatchObject({ items: 0, grant_status: "eligible" });
    await db.query("delete from public.character_starting_grants where character_id=$1",[character]);
    const id = await copy();
    expect(await snapshot(id)).toMatchObject({ items: 0, grant_status: null });
    await role("service_role"); expect(await resolve(owner,id)).toEqual({ status: "not_eligible" });
  });
  it("copies confirmed legacy completion without fabricating a historical receipt", async () => {
    await db.exec("reset role");
    await db.query("delete from public.character_starting_grants where character_id=$1",[character]);
    await db.exec("update public.characters set choices=jsonb_set(choices,'{starting_equipment,confirmed}','true')");
    const id = await copy();
    expect(await snapshot(id)).toMatchObject({ items: 0, grant_status: "inherited_completion" });
    expect((await db.query("select receipt,canonical_intent from public.character_starting_grants where character_id=$1",[id])).rows).toEqual([{ receipt: null, canonical_intent: null }]);
  });
  it("preserves narrative children while resetting copied visibility", async () => {
    await db.exec("reset role");
    await db.query("insert into public.character_dm_notes values($1,$2)",[character,{ text: "Private notes" }]);
    await db.query("insert into public.character_timeline_events(character_id,created_by,title,visibility) values($1,$2,'Origin','campaign')",[character,owner]);
    await db.query("insert into public.npcs(character_id,created_by,name,visibility) values($1,$2,'Ally','campaign')",[character,owner]);
    const id = await copy(); await db.exec("reset role");
    expect((await db.query("select content from public.character_dm_notes where character_id=$1",[id])).rows).toEqual([{ content: { text: "Private notes" } }]);
    for (const table of ["character_timeline_events","npcs"]) expect((await db.query(`select visibility from public.${table} where character_id=$1`,[id])).rows).toEqual([{ visibility: "dm_only" }]);
  });
  it("denies non-owner copies and incompatible campaign copies without new rows", async () => {
    await db.exec("reset role"); await db.query("insert into public.campaigns values($1,$2,$3)",[campaign,stranger,system]);
    await role("authenticated",stranger); await db.exec("savepoint denied");
    await expect(db.query("select public.copy_character($1)",[character])).rejects.toMatchObject({ code: "42501" });
    await db.exec("rollback to savepoint denied");
    await role("authenticated",owner); await db.exec("savepoint denied");
    await expect(db.query("select public.copy_character($1,$2)",[character,campaign])).rejects.toMatchObject({ code: "42501" });
    await db.exec("rollback to savepoint denied"); await db.exec("reset role");
    expect((await db.query<{ count: number }>("select count(*)::int as count from public.characters")).rows[0].count).toBe(1);
  });
});
