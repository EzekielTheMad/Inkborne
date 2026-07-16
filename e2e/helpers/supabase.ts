/**
 * Node-side Supabase helpers for the E2E smoke suite.
 *
 * These run in the Playwright test-runner process (never in the browser) and
 * are responsible for seeding fixtures and — critically — deleting every
 * character the suite creates, so the shared backend stays clean.
 *
 * Cleanup uses the service-role key because the `characters` table has no
 * DELETE RLS policy (the app itself only archives). The key comes from
 * `.env.local` / the environment and is never exposed to the page.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** All E2E-created characters carry this prefix so stale leftovers from
 *  crashed runs are identifiable and swept by global teardown. */
export const E2E_CHARACTER_PREFIX = "E2E Smoke";

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. See e2e/README.md for setup.`,
    );
  }
  return value;
}

export function createServiceClient(): SupabaseClient {
  return createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Signs in with the test credentials (anon key) and returns the user id.
 *  Doubles as an early validation that the credentials are correct. */
export async function getTestUserId(): Promise<string> {
  const client = createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await client.auth.signInWithPassword({
    email: env("E2E_TEST_EMAIL"),
    password: env("E2E_TEST_PASSWORD"),
  });
  if (error || !data.user) {
    throw new Error(`Could not sign in as E2E test user: ${error?.message}`);
  }
  return data.user.id;
}

/**
 * Inserts a fully-built level-1 Fighter for the test user and returns its id.
 * Shape mirrors what a completed builder pass writes (choices + base_stats),
 * which is all `/characters/[id]` needs to render a populated sheet.
 * Expected max HP: d10 max (10) + CON mod (+1 from 13) = 11.
 */
export async function seedSheetCharacter(name: string): Promise<string> {
  const service = createServiceClient();
  const userId = await getTestUserId();

  const { data: systems, error: systemsError } = await service
    .from("game_systems")
    .select("id")
    .eq("status", "published")
    .order("name")
    .limit(1);
  if (systemsError || !systems?.length) {
    throw new Error(
      `Could not find a published game system: ${systemsError?.message ?? "no rows"}`,
    );
  }

  const { data, error } = await service
    .from("characters")
    .insert({
      name,
      user_id: userId,
      system_id: systems[0].id,
      level: 1,
      base_stats: {
        strength: 15,
        dexterity: 14,
        constitution: 13,
        intelligence: 12,
        wisdom: 10,
        charisma: 8,
      },
      choices: {
        classes: [{ slug: "fighter", level: 1 }],
        race: "human",
        background: "soldier",
        ability_method: "standard_array",
      },
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Could not seed sheet character: ${error?.message}`);
  }
  return data.id;
}

/** Hard-deletes the given characters (service role — bypasses RLS).
 *  Dependent rows (content refs, inventory, spells) cascade. */
export async function deleteCharactersById(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const service = createServiceClient();
  const { error } = await service.from("characters").delete().in("id", ids);
  if (error) {
    throw new Error(
      `E2E cleanup failed for characters [${ids.join(", ")}]: ${error.message}`,
    );
  }
}

/** Safety net: removes any leftover E2E-prefixed characters owned by the test
 *  user (e.g. from a previous crashed run). */
export async function sweepE2ECharacters(): Promise<number> {
  const service = createServiceClient();
  const userId = await getTestUserId();
  const { data, error } = await service
    .from("characters")
    .delete()
    .eq("user_id", userId)
    .like("name", `${E2E_CHARACTER_PREFIX}%`)
    .select("id");
  if (error) {
    throw new Error(`E2E character sweep failed: ${error.message}`);
  }
  return data?.length ?? 0;
}
