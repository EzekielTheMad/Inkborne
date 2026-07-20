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
export const E2E_CAMPAIGN_PREFIX = "E2E Campaign";

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
  return getUserIdForCredentials(
    env("E2E_TEST_EMAIL"),
    env("E2E_TEST_PASSWORD"),
  );
}

export async function getUserIdForCredentials(
  email: string,
  password: string,
): Promise<string> {
  const client = createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user) {
    throw new Error(`Could not sign in as E2E test user: ${error?.message}`);
  }
  return data.user.id;
}

export async function getCampaignFixture(campaignId: string): Promise<{
  inviteCode: string;
  systemId: string;
}> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("campaigns")
    .select("invite_code, system_id")
    .eq("id", campaignId)
    .single();
  if (error || !data) {
    throw new Error(`Could not load E2E campaign: ${error?.message ?? "no row"}`);
  }
  return { inviteCode: data.invite_code, systemId: data.system_id };
}

export async function seedCampaignCharacter(input: {
  name: string;
  systemId: string;
  email: string;
  password: string;
}): Promise<string> {
  const service = createServiceClient();
  const userId = await getUserIdForCredentials(input.email, input.password);
  const { data, error } = await service
    .from("characters")
    .insert({
      name: input.name,
      user_id: userId,
      system_id: input.systemId,
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
    throw new Error(`Could not seed campaign character: ${error?.message}`);
  }
  return data.id;
}

export async function setCampaignPageContent(pageId: string, content: unknown): Promise<void> {
  const service = createServiceClient();
  const { error } = await service
    .from("campaign_pages")
    .update({ content })
    .eq("id", pageId);
  if (error) {
    throw new Error(`Could not seed campaign page content: ${error.message}`);
  }
}

export async function deleteCampaignsById(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const service = createServiceClient();
  const { error } = await service.from("campaigns").delete().in("id", ids);
  if (error) {
    throw new Error(`E2E campaign cleanup failed: ${error.message}`);
  }
}

export async function sweepE2ECampaigns(): Promise<number> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("campaigns")
    .delete()
    .like("name", `${E2E_CAMPAIGN_PREFIX}%`)
    .select("id");
  if (error) {
    throw new Error(`E2E campaign sweep failed: ${error.message}`);
  }
  return data?.length ?? 0;
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

/**
 * Inserts a fully-built level-3 Wizard for the M3 gameplay UAT and returns its
 * id. Mirrors a completed builder pass:
 *
 * - base stats give DEX +2 (base AC 12; Mage Armor 15), CON +2, INT +3;
 * - `character_spells` rows for Magic Missile and Mage Armor (known +
 *   prepared + in spellbook — content ids resolved from platform SRD content);
 * - a `character_content_refs` row for the Arcane Recovery feature, which is
 *   what surfaces it as a feature resource (the builder writes feature refs;
 *   `computeResources` derives resources from content refs only).
 *
 * Expected max HP: d6 max (6) + 2×d6 avg (4) + CON mod (+2) × 3 = 20.
 * Expected slots (wizard 3): 4× 1st, 2× 2nd.
 */
export async function seedWizardCharacter(name: string): Promise<string> {
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
  const systemId = systems[0].id;

  const { data: character, error: characterError } = await service
    .from("characters")
    .insert({
      name,
      user_id: userId,
      system_id: systemId,
      level: 3,
      base_stats: {
        strength: 8,
        dexterity: 14,
        constitution: 14,
        intelligence: 16,
        wisdom: 12,
        charisma: 10,
      },
      choices: {
        classes: [{ slug: "wizard", level: 3 }],
        race: "human",
        background: "sage",
        ability_method: "standard_array",
      },
    })
    .select("id")
    .single();
  if (characterError || !character) {
    throw new Error(`Could not seed wizard character: ${characterError?.message}`);
  }

  // Known spells — content ids resolved from the platform SRD content.
  const spellSlugs = ["magic-missile", "mage-armor"];
  const { data: spellDefs, error: spellsError } = await service
    .from("content_definitions")
    .select("id, name, slug")
    .eq("system_id", systemId)
    .eq("content_type", "spell")
    .eq("scope", "platform")
    .in("slug", spellSlugs);
  if (spellsError || (spellDefs?.length ?? 0) !== spellSlugs.length) {
    throw new Error(
      `Could not resolve spell content for [${spellSlugs.join(", ")}]: ` +
        `${spellsError?.message ?? `found ${spellDefs?.length ?? 0} of ${spellSlugs.length}`}`,
    );
  }

  const { error: spellInsertError } = await service.from("character_spells").insert(
    spellDefs!.map((def) => ({
      character_id: character.id,
      content_id: def.id,
      name: def.name,
      class_slug: "wizard",
      is_known: true,
      is_prepared: true,
      in_spellbook: true,
      source: "selection",
    })),
  );
  if (spellInsertError) {
    throw new Error(`Could not seed character spells: ${spellInsertError.message}`);
  }

  // Arcane Recovery feature ref → feature resource (short-rest slot recovery).
  const { data: feature, error: featureError } = await service
    .from("content_definitions")
    .select("id")
    .eq("system_id", systemId)
    .eq("content_type", "feature")
    .eq("scope", "platform")
    .eq("slug", "arcane-recovery")
    .single();
  if (featureError || !feature) {
    throw new Error(
      `Could not resolve the arcane-recovery feature: ${featureError?.message ?? "no row"}`,
    );
  }
  const { error: refError } = await service.from("character_content_refs").insert({
    character_id: character.id,
    content_id: feature.id,
    content_version: 1,
    context: {},
    choice_source: "class",
  });
  if (refError) {
    throw new Error(`Could not seed arcane-recovery content ref: ${refError.message}`);
  }

  return character.id;
}

/** Counts persisted `character_rolls` rows for a character (service role),
 *  optionally filtered by roll kind. Used to assert roll-log persistence and
 *  that deleting the character cascades its rolls. */
export async function countCharacterRolls(
  characterId: string,
  kind?: string,
): Promise<number> {
  const service = createServiceClient();
  let query = service
    .from("character_rolls")
    .select("id", { count: "exact", head: true })
    .eq("character_id", characterId);
  if (kind) query = query.eq("kind", kind);
  const { count, error } = await query;
  if (error) {
    throw new Error(`Could not count character_rolls: ${error.message}`);
  }
  return count ?? 0;
}

/** Hard-deletes the given characters (service role — bypasses RLS).
 *  Dependent rows (content refs, inventory, spells, rolls) cascade. */
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
