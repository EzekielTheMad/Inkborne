// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Characterization of current SQL, not acceptance of the proposed durable API.
// One synthetic WASM connection proves ordered interleavings, not lock races.
const db = new PGlite();
const owner = "11111111-1111-4111-8111-111111111111";
const character = "33333333-3333-4333-8333-333333333333";
const baseline = { current_hp: 10, hit_dice_spent: { fighter: 0 } };

beforeAll(async () => {
  await db.exec(`
    create role authenticated;
    create role anon;
    create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql as
      $$ select current_setting('request.jwt.claim.sub', true)::uuid $$;
    create table public.characters (
      id uuid primary key, user_id uuid not null, state jsonb,
      base_stats jsonb default '{}'::jsonb, choices jsonb default '{}'::jsonb
    );
    grant usage on schema auth to authenticated;
    grant select, update on public.characters to authenticated;
    alter table public.characters enable row level security;
    create policy fixture_owner on public.characters to authenticated
      using (user_id=auth.uid()) with check (user_id=auth.uid());
  `);
  await db.exec(readFileSync("supabase/migrations/00031_patch_character_state_rpc.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/20261003223252_conditional_character_state_owner_cas.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/20261003223324_conditional_character_state_authenticated_only.sql", "utf8"));
}, 30_000);
beforeEach(async () => {
  await db.exec("begin");
  await db.query("insert into public.characters(id,user_id,state) values($1,$2,$3)", [character, owner, baseline]);
  await db.exec("set local role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]);
});
afterEach(async () => { await db.exec("rollback"); });
afterAll(async () => { await db.close(); });

async function conditional(expected: unknown, patch: unknown) {
  return (await db.query<{ status: string; resulting_state: unknown }>(
    "select * from public.patch_character_state_if_current($1,$2,$3)", [character, expected, patch],
  )).rows[0];
}

describe("current durable-action gaps: observed SQL behavior", () => {
  it("rejects two ordered intents from one baseline when the first changes state", async () => {
    expect((await conditional(baseline, { current_hp: 13 })).status).toBe("applied");
    expect((await conditional(baseline, { current_hp: 14 })).status).toBe("conflict");
  });
  it("accepts stale intent after another writer changes A to B and back to A (ABA)", async () => {
    await db.query("select public.patch_character_state($1,$2)", [character, { current_hp: 5 }]);
    await db.query("select public.patch_character_state($1,$2)", [character, { current_hp: 10 }]);
    expect((await conditional(baseline, { current_hp: 13, hit_dice_spent: { fighter: 1 } })).status).toBe("applied");
  });
  it.each(["base_stats", "choices"] as const)("does not compare changed %s used for derived effects", async column => {
    // Closed enum is the only interpolated identifier; all values are bound.
    await db.query(`update public.characters set ${column}=$1 where id=$2`, [
      column === "base_stats" ? { constitution: 6 } : { classes: [{ slug: "fighter", level: 2 }] }, character,
    ]);
    expect((await conditional(baseline, { current_hp: 13, hit_dice_spent: { fighter: 1 } })).status).toBe("applied");
  });
  it("allows an older unconditional writer to overwrite an accepted conditional HP patch", async () => {
    expect((await conditional(baseline, { current_hp: 13 })).status).toBe("applied");
    await db.query("select public.patch_character_state($1,$2)", [character, { current_hp: 8 }]);
    expect((await db.query<{ state: unknown }>("select state from public.characters where id=$1", [character])).rows[0].state)
      .toEqual({ ...baseline, current_hp: 8 });
  });
});
