import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  deleteCampaignsById,
  deleteCharactersById,
  E2E_CAMPAIGN_PREFIX,
  E2E_CHARACTER_PREFIX,
  getCampaignFixture,
  seedCampaignCharacter,
} from "./helpers/supabase";

const BASE_URL = "http://localhost:3000";
const runId = Date.now();
const campaignName = `${E2E_CAMPAIGN_PREFIX} ${runId}`;
const playerCharacterName = `${E2E_CHARACTER_PREFIX} Campaign Player ${runId}`;
const dmSecretTitle = `DM Secret ${runId}`;
const sharedPageTitle = `Shared Lore ${runId}`;
const playerSecretTitle = `Player Secret ${runId}`;

let campaignId: string | null = null;
let playerCharacterId: string | null = null;

function playerCredential(name: "E2E_PLAYER_EMAIL" | "E2E_PLAYER_PASSWORD"): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}; see e2e/README.md.`);
  return value;
}

async function signInPlayer(browser: Browser): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(playerCredential("E2E_PLAYER_EMAIL"));
  await page.getByLabel("Password", { exact: true }).fill(playerCredential("E2E_PLAYER_PASSWORD"));
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 60_000 });
  return { page, close: () => context.close() };
}

async function createCampaignPage(
  page: Page,
  targetCampaignId: string,
  title: string,
  visibility: "campaign" | "dm_only",
): Promise<string> {
  await page.goto(`/campaigns/${targetCampaignId}/pages/new`);
  await page.getByLabel("Page title").fill(title);
  await page.getByLabel("Who can see it?").selectOption(visibility);
  await Promise.all([
    page.waitForURL((url) =>
      new RegExp(`^/campaigns/${targetCampaignId}/pages/[0-9a-f-]{36}$`).test(url.pathname),
    ),
    page.getByRole("button", { name: "Create page" }).click(),
  ]);
  const pageId = new URL(page.url()).pathname.split("/").at(-1);
  if (!pageId) throw new Error(`Could not read page id from ${page.url()}`);
  return pageId;
}

test.describe("campaign DM/player UAT", () => {
  test.afterAll(async () => {
    if (campaignId) await deleteCampaignsById([campaignId]);
    if (playerCharacterId) await deleteCharactersById([playerCharacterId]);
  });

  test("enforces ownership, membership, visibility, and character boundaries", async ({
    browser,
    page: dmPage,
  }) => {
    await dmPage.goto("/campaigns");
    await dmPage.getByRole("link", { name: "+ Begin a campaign" }).click();
    await dmPage.getByLabel("Campaign name").fill(campaignName);
    await dmPage.getByLabel("Game system").selectOption({ index: 1 });
    await dmPage.getByLabel("Opening note").fill("Disposable two-role campaign acceptance test.");
    await Promise.all([
      dmPage.waitForURL((url) => /^\/campaigns\/[0-9a-f-]{36}$/.test(url.pathname)),
      dmPage.getByRole("button", { name: "Create campaign" }).click(),
    ]);

    campaignId = new URL(dmPage.url()).pathname.split("/").at(-1) ?? null;
    expect(campaignId).toBeTruthy();
    await expect(dmPage.getByRole("heading", { name: campaignName })).toBeVisible();
    await expect(dmPage.getByText("DM workspace")).toBeVisible();

    const fixture = await getCampaignFixture(campaignId!);
    await expect(dmPage.getByText(fixture.inviteCode, { exact: true })).toBeVisible();

    const dmSecretId = await createCampaignPage(dmPage, campaignId!, dmSecretTitle, "dm_only");
    const sharedPageId = await createCampaignPage(dmPage, campaignId!, sharedPageTitle, "campaign");

    playerCharacterId = await seedCampaignCharacter({
      name: playerCharacterName,
      systemId: fixture.systemId,
      email: playerCredential("E2E_PLAYER_EMAIL"),
      password: playerCredential("E2E_PLAYER_PASSWORD"),
    });

    const player = await signInPlayer(browser);
    try {
      await player.page.goto("/campaigns");
      await player.page.getByLabel("Join with an invite code").fill(fixture.inviteCode);
      await player.page.getByRole("button", { name: "Join campaign" }).click();
      await player.page.waitForURL(`**/campaigns/${campaignId}`);
      await expect(player.page.getByText("Player view")).toBeVisible();
      await expect(player.page.getByRole("link", { name: sharedPageTitle })).toBeVisible();
      await expect(player.page.getByRole("link", { name: dmSecretTitle })).toHaveCount(0);

      await player.page.getByLabel("Character to add").selectOption(playerCharacterId);
      await player.page.getByRole("button", { name: "Add character" }).click();
      await expect(player.page.getByRole("link", { name: playerCharacterName })).toBeVisible();

      const playerSecretId = await createCampaignPage(
        player.page,
        campaignId!,
        playerSecretTitle,
        "dm_only",
      );
      await player.page.goto(`/campaigns/${campaignId}/pages/${sharedPageId}`);
      await expect(player.page.getByRole("heading", { name: sharedPageTitle })).toBeVisible();
      await expect(player.page.getByLabel("Title")).toHaveCount(0);

      await dmPage.goto(`/campaigns/${campaignId}`);
      await expect(dmPage.getByRole("link", { name: playerSecretTitle })).toBeVisible();
      await expect(dmPage.getByRole("link", { name: playerCharacterName })).toBeVisible();

      await dmPage.goto(`/campaigns/${campaignId}/pages/${playerSecretId}`);
      await expect(dmPage.getByLabel("Title")).toHaveValue(playerSecretTitle);

      await dmPage.goto(`/campaigns/${campaignId}/pages/${dmSecretId}`);
      await expect(dmPage.getByLabel("Title")).toHaveValue(dmSecretTitle);

      await dmPage.goto(`/characters/${playerCharacterId}`);
      await expect(dmPage.getByText(playerCharacterName, { exact: true }).first()).toBeVisible();
      await expect(dmPage.getByRole("button", { name: "Edit character" })).toHaveCount(0);
      await expect(dmPage.getByRole("button", { name: "Copy character" })).toHaveCount(0);
      await expect(dmPage.getByRole("button", { name: "Change character color" })).toHaveCount(0);
    } finally {
      await player.close();
    }
  });
});
