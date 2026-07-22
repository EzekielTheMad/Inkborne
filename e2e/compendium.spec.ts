import { expect, test, type Browser, type Page } from "@playwright/test";

import {
  createServiceClient,
  deleteCampaignsById,
  deleteHomebrewSpellsById,
  E2E_CAMPAIGN_PREFIX,
  E2E_HOMEBREW_PREFIX,
  getTestUserId,
  seedHomebrewSharingCampaign,
} from "./helpers/supabase";

test.describe.configure({ mode: "serial" });

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const runId = Date.now();
const campaignName = `${E2E_CAMPAIGN_PREFIX} Compendium ${runId}`;
const privateSpellName = `${E2E_HOMEBREW_PREFIX} Compendium Private ${runId}`;
const sharedSpellName = `${E2E_HOMEBREW_PREFIX} Compendium Shared ${runId}`;
const definitionIds: string[] = [];

let campaignId: string | null = null;
let privateSpellId: string | null = null;
let sharedSpellId: string | null = null;
let srdSpellName = "";
let srdMagicItemName = "";

function playerCredential(name: "E2E_PLAYER_EMAIL" | "E2E_PLAYER_PASSWORD"): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}; see e2e/README.md.`);
  return value;
}

async function signInPlayer(
  browser: Browser,
  viewport?: { width: number; height: number },
): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    storageState: { cookies: [], origins: [] },
    viewport,
  });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(playerCredential("E2E_PLAYER_EMAIL"));
  await page
    .getByLabel("Password", { exact: true })
    .fill(playerCredential("E2E_PLAYER_PASSWORD"));
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 60_000 });
  return { page, close: () => context.close() };
}

function compendiumEntry(page: Page, name: string) {
  return page.getByRole("link").filter({ hasText: name });
}

function spellData(description: string) {
  return {
    level: 1,
    school: "evocation",
    casting_time: "1 action",
    range: "60 feet",
    components: ["V", "S"],
    duration: "Instantaneous",
    concentration: false,
    ritual: false,
    description,
    damage: null,
    dc: null,
    area_of_effect: null,
    classes: ["wizard"],
    subclasses: [],
    dependencies: [],
  };
}

test.beforeAll(async () => {
  const playerEmail = playerCredential("E2E_PLAYER_EMAIL");
  const playerPassword = playerCredential("E2E_PLAYER_PASSWORD");
  const ownerId = await getTestUserId();
  const campaign = await seedHomebrewSharingCampaign({
    name: campaignName,
    playerEmail,
    playerPassword,
  });
  campaignId = campaign.id;

  const service = createServiceClient();
  const [spellResult, magicItemResult] = await Promise.all([
    service
      .from("content_definitions")
      .select("name")
      .eq("system_id", campaign.systemId)
      .eq("content_type", "spell")
      .eq("source", "srd")
      .eq("scope", "platform")
      .eq("is_retired", false)
      .order("name")
      .limit(1)
      .single(),
    service
      .from("content_definitions")
      .select("name")
      .eq("system_id", campaign.systemId)
      .eq("content_type", "magic_item")
      .eq("source", "srd")
      .eq("scope", "platform")
      .eq("is_retired", false)
      .order("name")
      .limit(1)
      .single(),
  ]);
  if (spellResult.error || !spellResult.data) {
    throw new Error(`Could not resolve an SRD spell: ${spellResult.error?.message ?? "no row"}`);
  }
  if (magicItemResult.error || !magicItemResult.data) {
    throw new Error(
      `Could not resolve an SRD magic item: ${magicItemResult.error?.message ?? "no row"}`,
    );
  }
  srdSpellName = spellResult.data.name;
  srdMagicItemName = magicItemResult.data.name;

  const { data: definitions, error: definitionError } = await service
    .from("content_definitions")
    .insert([
      {
        system_id: campaign.systemId,
        content_type: "spell",
        slug: `e2e-compendium-private-${runId}`,
        name: privateSpellName,
        data: spellData("A private compendium fixture visible only to its author."),
        effects: [],
        source: "homebrew",
        scope: "personal",
        owner_id: ownerId,
        version: 1,
      },
      {
        system_id: campaign.systemId,
        content_type: "spell",
        slug: `e2e-compendium-shared-${runId}`,
        name: sharedSpellName,
        data: spellData("A read-only compendium fixture shared with one campaign."),
        effects: [],
        source: "homebrew",
        scope: "shared",
        owner_id: ownerId,
        version: 1,
      },
    ])
    .select("id, name");
  if (definitionError || definitions?.length !== 2) {
    throw new Error(
      `Could not seed compendium homebrew: ${definitionError?.message ?? "missing rows"}`,
    );
  }

  privateSpellId = definitions.find((definition) => definition.name === privateSpellName)?.id ?? null;
  sharedSpellId = definitions.find((definition) => definition.name === sharedSpellName)?.id ?? null;
  if (!privateSpellId || !sharedSpellId) {
    throw new Error("Could not identify seeded compendium homebrew rows.");
  }
  definitionIds.push(privateSpellId, sharedSpellId);

  const { error: shareError } = await service.from("content_shares").insert({
    content_id: sharedSpellId,
    campaign_id: campaign.id,
    shared_by: ownerId,
  });
  if (shareError) throw new Error(`Could not share compendium fixture: ${shareError.message}`);
});

test.afterAll(async () => {
  if (campaignId) await deleteCampaignsById([campaignId]);
  await deleteHomebrewSpellsById(definitionIds);
});

test("shows authorized SRD and homebrew entries to the DM and campaign player", async ({
  browser,
  page: ownerPage,
}) => {
  await ownerPage.goto(
    `/library?category=spells&provenance=mine&q=${encodeURIComponent(privateSpellName)}`,
  );
  const privateEntry = compendiumEntry(ownerPage, privateSpellName);
  await expect(privateEntry).toBeVisible();
  await expect(privateEntry).toContainText("Your homebrew");

  await ownerPage.goto(`/library/${sharedSpellId}?category=spells`);
  await expect(ownerPage.getByRole("heading", { name: sharedSpellName, exact: true })).toBeVisible();
  await expect(ownerPage.getByText("Your homebrew", { exact: true })).toBeVisible();
  await expect(ownerPage.getByText(/This view is read-only/)).toBeVisible();

  const player = await signInPlayer(browser);
  try {
    await player.page.goto(
      `/library?category=spells&provenance=srd&q=${encodeURIComponent(srdSpellName)}`,
    );
    const srdSpell = compendiumEntry(player.page, srdSpellName);
    await expect(srdSpell).toBeVisible();
    await expect(srdSpell).toContainText("SRD");

    await player.page.goto(
      `/library?category=items&provenance=srd&q=${encodeURIComponent(srdMagicItemName)}`,
    );
    const srdMagicItem = compendiumEntry(player.page, srdMagicItemName);
    await expect(srdMagicItem).toBeVisible();
    await expect(srdMagicItem).toContainText("SRD");

    await player.page.goto(
      `/library?category=spells&provenance=shared&q=${encodeURIComponent(sharedSpellName)}`,
    );
    const sharedEntry = compendiumEntry(player.page, sharedSpellName);
    await expect(sharedEntry).toBeVisible();
    await expect(sharedEntry).toContainText("Campaign shared");
    await sharedEntry.click();
    await expect(
      player.page.getByRole("heading", { name: sharedSpellName, exact: true }),
    ).toBeVisible();
    await expect(player.page.getByText("Campaign shared", { exact: true })).toBeVisible();
    await expect(player.page.getByText(/This view is read-only/)).toBeVisible();
    await player.page.getByRole("link", { name: "Back to Library" }).click();
    const returnedUrl = new URL(player.page.url());
    expect(returnedUrl.pathname).toBe("/library");
    expect(returnedUrl.searchParams.get("category")).toBe("spells");
    expect(returnedUrl.searchParams.get("provenance")).toBe("shared");
    expect(returnedUrl.searchParams.get("q")).toBe(sharedSpellName);
    await expect(compendiumEntry(player.page, sharedSpellName)).toBeVisible();

    await player.page.goto(
      `/library?category=spells&q=${encodeURIComponent(privateSpellName)}`,
    );
    await expect(compendiumEntry(player.page, privateSpellName)).toHaveCount(0);
    await expect(player.page.getByRole("heading", { name: "No matching rules" })).toBeVisible();
  } finally {
    await player.close();
  }
});

test("redirects an old Library authoring deep link to Homebrew", async ({ page }) => {
  await page.goto(`/library/spells/${privateSpellId}/edit`);
  await expect(page).toHaveURL(new RegExp(`/homebrew/spells/${privateSpellId}/edit$`));
  await expect(page.getByRole("heading", { name: `Edit ${privateSpellName}` })).toBeVisible();
});

test("lets a player navigate categories and open a rule on a mobile viewport", async ({
  browser,
}) => {
  const player = await signInPlayer(browser, { width: 390, height: 844 });
  try {
    await player.page.goto("/library");
    await player.page
      .getByRole("navigation", { name: "Library categories" })
      .getByRole("link", { name: "Items", exact: true })
      .click();
    await expect(player.page).toHaveURL(/\/library\?.*category=items/);

    await player.page.getByLabel("Search by name").fill(srdMagicItemName);
    await player.page.getByRole("button", { name: "Apply", exact: true }).click();
    const itemEntry = compendiumEntry(player.page, srdMagicItemName);
    await expect(itemEntry).toBeVisible();
    await itemEntry.click();
    await expect(
      player.page.getByRole("heading", { name: srdMagicItemName, exact: true }),
    ).toBeVisible();
    await expect(player.page.getByText(/This view is read-only/)).toBeVisible();
  } finally {
    await player.close();
  }
});
