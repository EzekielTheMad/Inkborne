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
export const E2E_HOMEBREW_PREFIX = "E2E Homebrew";

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

export async function seedHomebrewSharingCampaign(input: {
  name: string;
  playerEmail: string;
  playerPassword: string;
}): Promise<{ id: string; systemId: string }> {
  const service = createServiceClient();
  const [ownerId, playerId] = await Promise.all([
    getTestUserId(),
    getUserIdForCredentials(input.playerEmail, input.playerPassword),
  ]);
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

  const { data: campaign, error: campaignError } = await service
    .from("campaigns")
    .insert({
      name: input.name,
      description: "Disposable campaign-scoped homebrew acceptance fixture.",
      owner_id: ownerId,
      system_id: systems[0].id,
    })
    .select("id")
    .single();
  if (campaignError || !campaign) {
    throw new Error(`Could not seed homebrew campaign: ${campaignError?.message}`);
  }

  const { error: membershipError } = await service.from("campaign_members").upsert({
    campaign_id: campaign.id,
    user_id: playerId,
    role: "player",
  });
  if (membershipError) {
    throw new Error(`Could not seed campaign membership: ${membershipError.message}`);
  }
  return { id: campaign.id, systemId: systems[0].id };
}

export async function assignCharactersToCampaign(
  characterIds: string[],
  campaignId: string,
): Promise<void> {
  if (characterIds.length === 0) return;
  const service = createServiceClient();
  const { error } = await service
    .from("characters")
    .update({ campaign_id: campaignId })
    .in("id", characterIds);
  if (error) {
    throw new Error(`Could not assign E2E characters to campaign: ${error.message}`);
  }
}

async function seedClassContentRef(
  service: SupabaseClient,
  characterId: string,
  systemId: string,
  classSlug: string,
  level: number,
): Promise<void> {
  const { data: classDefinition, error: classError } = await service
    .from("content_definitions")
    .select("id, version")
    .eq("system_id", systemId)
    .eq("content_type", "class")
    .eq("slug", classSlug)
    .single();
  if (classError || !classDefinition) {
    throw new Error(
      `Could not resolve ${classSlug} class content: ${classError?.message ?? "no row"}`,
    );
  }

  const { error: refError } = await service.from("character_content_refs").insert({
    character_id: characterId,
    content_id: classDefinition.id,
    content_version: classDefinition.version,
    context: { source: "class", level },
  });
  if (refError) {
    throw new Error(`Could not seed ${classSlug} class content ref: ${refError.message}`);
  }
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
  await seedClassContentRef(service, data.id, input.systemId, "fighter", 1);
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

export async function setCharacterNarrativeLinks(input: {
  characterId: string;
  sharedNarrative: unknown;
  dmNotes?: unknown;
}): Promise<void> {
  const service = createServiceClient();
  const { error: characterError } = await service
    .from("characters")
    .update({ narrative_rich: input.sharedNarrative })
    .eq("id", input.characterId);
  if (characterError) {
    throw new Error(`Could not seed character narrative: ${characterError.message}`);
  }
  if (input.dmNotes === undefined) return;

  const { error: notesError } = await service.from("character_dm_notes").upsert({
    character_id: input.characterId,
    content: input.dmNotes,
  });
  if (notesError) {
    throw new Error(`Could not seed character DM notes: ${notesError.message}`);
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
  await seedClassContentRef(service, data.id, systems[0].id, "fighter", 1);
  return data.id;
}

/**
 * Inserts a fully-built level-3 Wizard for the M3 gameplay UAT and returns its
 * id. Mirrors a completed builder pass:
 *
 * - base stats give DEX +2 (base AC 12; Mage Armor 15), CON +2, INT +3;
 * - `character_spells` rows for Magic Missile and Mage Armor (known +
 *   prepared + in spellbook — content ids resolved from platform SRD content);
 * - the pinned Wizard class ref lets the page's feature-grant sync materialize
 *   Arcane Recovery exactly as the real builder flow does.
 *
 * Expected max HP: d6 max (6) + 2×d6 avg (4) + CON mod (+2) × 3 = 20.
 * Expected slots (wizard 3): 4× 1st, 2× 2nd.
 */
export async function seedWizardCharacter(name: string): Promise<string> {
  return seedWizardCharacterForUser(name, await getTestUserId());
}

export async function seedWizardCharacterForCredentials(
  name: string,
  email: string,
  password: string,
): Promise<string> {
  return seedWizardCharacterForUser(
    name,
    await getUserIdForCredentials(email, password),
  );
}

async function seedWizardCharacterForUser(
  name: string,
  userId: string,
): Promise<string> {
  const service = createServiceClient();

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
  await seedClassContentRef(service, character.id, systemId, "wizard", 3);

  // Known spells — content ids resolved from the platform SRD content.
  const spellSlugs = ["magic-missile", "mage-armor"];
  const { data: spellDefs, error: spellsError } = await service
    .from("content_definitions")
    .select("id, name, slug, version")
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
      content_version: def.version,
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

  return character.id;
}

/** Deletes only explicitly tracked E2E spell definitions owned by the
 * authenticated E2E user. Character references must be removed first. */
export async function deleteHomebrewSpellsById(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const service = createServiceClient();
  const userId = await getTestUserId();
  const { error } = await service
    .from("content_definitions")
    .delete()
    .in("id", ids)
    .eq("owner_id", userId)
    .eq("source", "homebrew")
    .eq("content_type", "spell")
    .like("name", `${E2E_HOMEBREW_PREFIX}%`);
  if (error) {
    throw new Error(
      `E2E cleanup failed for homebrew spells [${ids.join(", ")}]: ${error.message}`,
    );
  }
}

/** Safety net for homebrew left by interrupted E2E runs. */
export async function sweepE2EHomebrewSpells(): Promise<number> {
  const service = createServiceClient();
  const userId = await getTestUserId();
  const { data, error } = await service
    .from("content_definitions")
    .delete()
    .eq("owner_id", userId)
    .eq("source", "homebrew")
    .eq("content_type", "spell")
    .like("name", `${E2E_HOMEBREW_PREFIX}%`)
    .select("id");
  if (error) {
    throw new Error(`E2E homebrew sweep failed: ${error.message}`);
  }
  return data?.length ?? 0;
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

/** Safety net: removes leftover E2E-prefixed characters owned by either UAT
 *  account (e.g. from a previous crashed two-account run). */
export async function sweepE2ECharacters(): Promise<number> {
  const service = createServiceClient();
  const userIds = [await getTestUserId()];
  if (process.env.E2E_PLAYER_EMAIL && process.env.E2E_PLAYER_PASSWORD) {
    userIds.push(await getUserIdForCredentials(
      process.env.E2E_PLAYER_EMAIL,
      process.env.E2E_PLAYER_PASSWORD,
    ));
  }
  const { data, error } = await service
    .from("characters")
    .delete()
    .in("user_id", [...new Set(userIds)])
    .like("name", `${E2E_CHARACTER_PREFIX}%`)
    .select("id");
  if (error) {
    throw new Error(`E2E character sweep failed: ${error.message}`);
  }
  return data?.length ?? 0;
}
