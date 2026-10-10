// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Execute the real migration against disposable Postgres, with synthetic auth,
// schema, characters, and owner RLS. No network or hosted database is used.
const db = new PGlite();
const owner = "11111111-1111-4111-8111-111111111111";
const stranger = "22222222-2222-4222-8222-222222222222";
const character = "33333333-3333-4333-8333-333333333333";
const system = "44444444-4444-4444-8444-444444444444";
const initialScores = { str: 12, dex: 14 };

async function save(method: unknown, scores: unknown, expectedMethod: unknown = "manual", expectedScores: unknown = initialScores, id = character) {
  return db.query<{ saved_method: string; saved_scores: Record<string, number> }>(
    "select * from public.save_character_abilities($1::uuid, $2::text, $3::jsonb, $4::text, $5::jsonb)",
    [id, method, JSON.stringify(scores), expectedMethod, JSON.stringify(expectedScores)],
  );
}

beforeAll(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth, public to authenticated, anon;
    create table public.game_systems (id uuid primary key, schema_definition jsonb);
    create table public.characters (
      id uuid primary key, user_id uuid not null, system_id uuid not null,
      choices jsonb, base_stats jsonb, state jsonb
    );
    alter table public.characters enable row level security;
    create policy owner_read on public.characters for select to authenticated using (user_id = auth.uid());
    create policy owner_update on public.characters for update to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
    grant select, update on public.characters to authenticated;
    grant select on public.game_systems to authenticated;
    insert into public.game_systems values ('${system}', '{"ability_scores":[{"slug":"str"},{"slug":"dex"},{"slug":"con"},{"slug":"int"},{"slug":"wis"},{"slug":"cha"}]}');
  `);
  await db.exec(readFileSync(resolve("supabase/migrations/20261010232200_save_character_abilities.sql"), "utf8"));
}, 30_000);

beforeEach(async () => {
  await db.exec("begin");
  await db.query("insert into public.characters values ($1, $2, $3, $4, $5, $6)", [
    character, owner, system,
    { race: "human", background: "acolyte", ability_method: "manual", starting_equipment: { confirmed: true } },
    initialScores, { current_hp: 8 },
  ]);
  await db.exec("set local role authenticated");
  await db.query("select set_config('request.jwt.claim.sub', $1, true)", [owner]);
});
afterEach(async () => { await db.exec("rollback"); });
afterAll(async () => { await db.close(); });

describe("ability-score transaction", () => {
  it("saves method/scores together and preserves unrelated choices and play state", async () => {
    const result = await save("point_buy", { str: 8, dex: 8 });
    expect(result.rows).toEqual([{ saved_method: "point_buy", saved_scores: { str: 8, dex: 8 } }]);
    const row = (await db.query("select choices, base_stats, state from public.characters")).rows[0];
    expect(row).toEqual({
      choices: { race: "human", background: "acolyte", ability_method: "point_buy", starting_equipment: { confirmed: true } },
      base_stats: { str: 8, dex: 8 }, state: { current_hp: 8 },
    });
  });

  it("preserves an unrelated choice changed after the editor snapshot", async () => {
    await db.exec(`update public.characters set choices = choices || '{"background":"sage"}'::jsonb`);
    await save("manual", { str: 16, dex: 14 });
    expect((await db.query<{ background: string }>("select choices->>'background' as background from public.characters")).rows[0].background).toBe("sage");
  });

  it("rejects stale same-character editors without overwriting the first save", async () => {
    await save("manual", { str: 16, dex: 14 });
    await db.exec("savepoint stale");
    await expect(save("manual", { str: 12, dex: 18 })).rejects.toMatchObject({ code: "P0001", message: "ABILITY_SCORES_CHANGED" });
    await db.exec("rollback to savepoint stale");
    expect((await db.query<{ base_stats: unknown }>("select base_stats from public.characters")).rows[0].base_stats).toEqual({ str: 16, dex: 14 });
  });

  it("accepts raw absent method and empty scores as initial expectations", async () => {
    await db.exec("update public.characters set choices = choices - 'ability_method', base_stats = '{}'::jsonb");
    expect((await save("standard_array", { str: 15 }, null, {})).rows[0].saved_scores).toEqual({ str: 15 });
  });

  it("allows clearing standard-array assignments", async () => {
    expect((await save("standard_array", {})).rows[0].saved_scores).toEqual({});
  });

  it.each([
    ["unknown", { str: 12 }], [null, { str: 12 }], ["manual", null], ["manual", []],
    ["manual", { str: "12" }], ["manual", { str: 12.5 }], ["manual", { str: 31 }],
    ["manual", { str: 0 }], ["manual", { secret: 12 }],
    ["standard_array", { str: 15, dex: 15 }], ["standard_array", { str: 16 }],
    ["point_buy", { str: 7 }], ["point_buy", { str: 16 }],
    ["point_buy", { str: 15, dex: 15, con: 15, int: 15 }],
  ])("rejects invalid method/scores (%j, %j) atomically", async (method, scores) => {
    await db.exec("savepoint invalid");
    await expect(save(method, scores)).rejects.toMatchObject({ code: "22023" });
    await db.exec("rollback to savepoint invalid");
    expect((await db.query<{ base_stats: unknown }>("select base_stats from public.characters")).rows[0].base_stats).toEqual(initialScores);
  });

  it("rejects an unrelated authenticated user even if a character is readable", async () => {
    await db.exec("reset role; create policy readable_character on public.characters for select to authenticated using (true); set local role authenticated");
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [stranger]);
    await expect(save("manual", { str: 16 })).rejects.toMatchObject({ code: "42501" });
  });

  it("denies anonymous execution", async () => {
    await db.exec("reset role; set local role anon");
    await expect(save("manual", { str: 16 })).rejects.toMatchObject({ code: "42501" });
  });

  it("rejects a missing character instead of reporting a zero-row success", async () => {
    await expect(save("manual", { str: 16 }, "manual", initialScores, stranger)).rejects.toMatchObject({ code: "42501" });
  });
});
