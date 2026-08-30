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
/** The 2014 SRD exposes Acolyte as its canonical platform background. */
const E2E_PLATFORM_BACKGROUND_SLUG = "acolyte";

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
  return (await getAuthenticatedUserForCredentials(
    env("E2E_TEST_EMAIL"),
    env("E2E_TEST_PASSWORD"),
  )).userId;
}

export async function getUserIdForCredentials(
  email: string,
  password: string,
): Promise<string> {
  return (await getAuthenticatedUserForCredentials(email, password)).userId;
}

interface AuthenticatedE2EUser {
  client: SupabaseClient;
  userId: string;
}

async function getAuthenticatedUserForCredentials(
  email: string,
  password: string,
): Promise<AuthenticatedE2EUser> {
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
  return { client, userId: data.user.id };
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
    const { error: cleanupError } = await service
      .from("campaigns")
      .delete()
      .eq("id", campaign.id);
    throw new Error(
      `Could not seed campaign membership: ${membershipError.message}`
        + (cleanupError ? `; cleanup also failed: ${cleanupError.message}` : ""),
    );
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

async function seedCharacterWithBackground(input: {
  service: SupabaseClient;
  authenticatedUser: AuthenticatedE2EUser;
  systemId: string;
  backgroundSlug: string;
  character: Record<string, unknown>;
  fixtureLabel: string;
  seedRelated: (characterId: string) => Promise<void>;
}): Promise<string> {
  const { data: background, error: backgroundLookupError } = await input.service
    .from("content_definitions")
    .select("id, version")
    .eq("system_id", input.systemId)
    .eq("content_type", "background")
    .eq("slug", input.backgroundSlug)
    .eq("source", "srd")
    .eq("scope", "platform")
    .eq("is_retired", false)
    .single();
  if (backgroundLookupError || !background) {
    throw new Error(
      `Could not resolve ${input.backgroundSlug} background content: `
        + `${backgroundLookupError?.message ?? "no row"}`,
    );
  }

  const { data: character, error: characterError } = await input.service
    .from("characters")
    .insert({
      ...input.character,
      user_id: input.authenticatedUser.userId,
      system_id: input.systemId,
    })
    .select("id")
    .single();
  if (characterError || !character) {
    throw new Error(
      `Could not seed ${input.fixtureLabel}: ${characterError?.message}`,
    );
  }

  try {
    const { error: backgroundError } = await input.authenticatedUser.client.rpc(
      "set_character_background",
      {
        target_character_id: character.id,
        target_content_id: background.id,
        target_content_version: background.version,
      },
    );
    if (backgroundError) {
      throw new Error(
        `Could not apply ${input.backgroundSlug} background: ${backgroundError.message}`,
      );
    }

    await input.seedRelated(character.id);
  } catch (error) {
    const { error: cleanupError } = await input.service
      .from("characters")
      .delete()
      .eq("id", character.id);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      message + (cleanupError
        ? `; cleanup also failed: ${cleanupError.message}`
        : ""),
    );
  }

  return character.id;
}

export async function seedCampaignCharacter(input: {
  name: string;
  systemId: string;
  email: string;
  password: string;
}): Promise<string> {
  const service = createServiceClient();
  const authenticatedUser = await getAuthenticatedUserForCredentials(
    input.email,
    input.password,
  );
  return seedCharacterWithBackground({
    service,
    authenticatedUser,
    systemId: input.systemId,
    backgroundSlug: E2E_PLATFORM_BACKGROUND_SLUG,
    fixtureLabel: "campaign character",
    character: {
      name: input.name,
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
        ability_method: "standard_array",
      },
    },
    seedRelated: (characterId) => seedClassContentRef(
      service,
      characterId,
      input.systemId,
      "fighter",
      1,
    ),
  });
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
  const authenticatedUser = await getAuthenticatedUserForCredentials(
    env("E2E_TEST_EMAIL"),
    env("E2E_TEST_PASSWORD"),
  );

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

  return seedCharacterWithBackground({
    service,
    authenticatedUser,
    systemId: systems[0].id,
    backgroundSlug: E2E_PLATFORM_BACKGROUND_SLUG,
    fixtureLabel: "sheet character",
    character: {
      name,
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
        ability_method: "standard_array",
      },
    },
    seedRelated: (characterId) => seedClassContentRef(
      service,
      characterId,
      systems[0].id,
      "fighter",
      1,
    ),
  });
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
  return seedWizardCharacterForUser(
    name,
    await getAuthenticatedUserForCredentials(
      env("E2E_TEST_EMAIL"),
      env("E2E_TEST_PASSWORD"),
    ),
  );
}

export async function seedWizardCharacterForCredentials(
  name: string,
  email: string,
  password: string,
): Promise<string> {
  return seedWizardCharacterForUser(
    name,
    await getAuthenticatedUserForCredentials(email, password),
  );
}

async function seedWizardCharacterForUser(
  name: string,
  authenticatedUser: AuthenticatedE2EUser,
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

  return seedCharacterWithBackground({
    service,
    authenticatedUser,
    systemId,
    backgroundSlug: E2E_PLATFORM_BACKGROUND_SLUG,
    fixtureLabel: "wizard character",
    character: {
      name,
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
        ability_method: "standard_array",
      },
    },
    seedRelated: async (characterId) => {
      await seedClassContentRef(service, characterId, systemId, "wizard", 3);

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

      const { error: spellInsertError } = await service
        .from("character_spells")
        .insert(spellDefs!.map((def) => ({
          character_id: characterId,
          content_id: def.id,
          content_version: def.version,
          name: def.name,
          class_slug: "wizard",
          is_known: true,
          is_prepared: true,
          in_spellbook: true,
          source: "selection",
        })));
      if (spellInsertError) {
        throw new Error(`Could not seed character spells: ${spellInsertError.message}`);
      }
    },
  });
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
