import { expect, test, type Browser, type Page } from "@playwright/test";

import {
  assignCharactersToCampaign,
  deleteCampaignsById,
  deleteCharactersById,
  deleteHomebrewSpellsById,
  E2E_CAMPAIGN_PREFIX,
  E2E_CHARACTER_PREFIX,
  E2E_HOMEBREW_PREFIX,
  seedHomebrewSharingCampaign,
  seedWizardCharacterForCredentials,
} from "./helpers/supabase";

test.describe.configure({ mode: "serial" });

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const runId = Date.now();
const campaignIds: string[] = [];
const characterIds: string[] = [];
const definitionIds: string[] = [];
const campaignAName = `${E2E_CAMPAIGN_PREFIX} Homebrew A ${runId}`;
const campaignBName = `${E2E_CAMPAIGN_PREFIX} Homebrew B ${runId}`;
let campaignAId: string;
let campaignBId: string;
let campaignACharacterId: string;
let campaignBCharacterId: string;
let unassignedCharacterId: string;

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
  await page.getByLabel("Password", { exact: true }).fill(
    playerCredential("E2E_PLAYER_PASSWORD"),
  );
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 60_000 });
  return { page, close: () => context.close() };
}

async function openSpellPicker(page: Page, characterId: string): Promise<void> {
  await page.goto(`/characters/${characterId}`);
  await page.getByRole("button", { name: "Spells", exact: true }).click();
  await page.getByRole("button", { name: "Add Spell", exact: true }).click();
  await expect(page.getByPlaceholder("Search spells…")).toBeVisible();
}

async function expectSearchResult(page: Page, name: string, version: number): Promise<void> {
  await page.getByPlaceholder("Search spells…").fill(name);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await expect(page.getByText(`Homebrew · v${version}`, { exact: true })).toBeVisible();
}

async function expectNoSearchResult(page: Page, name: string): Promise<void> {
  await page.getByPlaceholder("Search spells…").fill(name);
  await expect(page.getByText("No spells found. Try adjusting filters.")).toBeVisible();
}

async function toggleCampaignShare(
  page: Page,
  editHref: string,
  accessibleName: string,
): Promise<void> {
  await page.goto(editHref);
  await page.getByRole("button", { name: accessibleName }).click();
  await expect(page.getByRole("status")).toContainText("Campaign access");
  await page.reload();
}

test.beforeAll(async () => {
  const playerEmail = playerCredential("E2E_PLAYER_EMAIL");
  const playerPassword = playerCredential("E2E_PLAYER_PASSWORD");
  const [campaignA, campaignB] = await Promise.all([
    seedHomebrewSharingCampaign({ name: campaignAName, playerEmail, playerPassword }),
    seedHomebrewSharingCampaign({ name: campaignBName, playerEmail, playerPassword }),
  ]);
  campaignAId = campaignA.id;
  campaignBId = campaignB.id;
  campaignIds.push(campaignAId, campaignBId);

  [campaignACharacterId, campaignBCharacterId, unassignedCharacterId] = await Promise.all([
    seedWizardCharacterForCredentials(
      `${E2E_CHARACTER_PREFIX} Shared A ${runId}`,
      playerEmail,
      playerPassword,
    ),
    seedWizardCharacterForCredentials(
      `${E2E_CHARACTER_PREFIX} Shared B ${runId}`,
      playerEmail,
      playerPassword,
    ),
    seedWizardCharacterForCredentials(
      `${E2E_CHARACTER_PREFIX} Shared Unassigned ${runId}`,
      playerEmail,
      playerPassword,
    ),
  ]);
  characterIds.push(campaignACharacterId, campaignBCharacterId, unassignedCharacterId);
  await Promise.all([
    assignCharactersToCampaign([campaignACharacterId], campaignAId),
    assignCharactersToCampaign([campaignBCharacterId], campaignBId),
  ]);
});

test.afterAll(async () => {
  await deleteCharactersById(characterIds);
  await deleteCampaignsById(campaignIds);
  await deleteHomebrewSpellsById(definitionIds);
});

test("shares exact spell versions with exact campaign characters and preserves pins", async ({
  browser,
  page: ownerPage,
}) => {
  test.setTimeout(180_000);
  const originalName = `${E2E_HOMEBREW_PREFIX} Campaign Thread ${runId}`;
  const revisedName = `${originalName} Revised`;

  await ownerPage.goto("/library/spells/new");
  await ownerPage.getByLabel("Name", { exact: true }).fill(originalName);
  await ownerPage.getByLabel("Level", { exact: true }).selectOption("1");
  await ownerPage.getByLabel("Casting time", { exact: true }).fill("1 action");
  await ownerPage.getByLabel("Range", { exact: true }).fill("60 feet");
  await ownerPage.getByLabel("Duration", { exact: true }).fill("Instantaneous");
  await ownerPage
    .getByLabel("Spell description", { exact: true })
    .fill("A campaign-bound thread of fire lashes the target.");
  await ownerPage.getByLabel("Wizard", { exact: true }).check();
  await ownerPage.getByText("Optional automation", { exact: true }).click();
  await ownerPage.getByLabel("Spell attack", { exact: true }).selectOption("ranged");
  await ownerPage.getByLabel("Damage type", { exact: true }).selectOption("fire");
  await ownerPage.getByLabel("Damage dice", { exact: true }).fill("2d6");
  await ownerPage.getByRole("button", { name: "Create private spell" }).click();
  await expect(ownerPage.getByRole("status")).toHaveText("Private spell created.");

  const editLink = ownerPage.getByRole("link", { name: new RegExp(originalName) });
  const editHref = await editLink.getAttribute("href");
  const definitionId = editHref?.match(/\/library\/spells\/([^/]+)\/edit/)?.[1];
  if (!editHref || !definitionId) throw new Error("Could not capture homebrew spell id");
  definitionIds.push(definitionId);

  await toggleCampaignShare(ownerPage, editHref, `Share with ${campaignAName}`);
  await expect(
    ownerPage.getByRole("button", { name: `Stop sharing with ${campaignAName}` }),
  ).toBeVisible();
  await expect(ownerPage.getByText("v2", { exact: true })).toBeVisible();

  const player = await signInPlayer(browser);
  try {
    await openSpellPicker(player.page, unassignedCharacterId);
    await expectNoSearchResult(player.page, originalName);

    await openSpellPicker(player.page, campaignBCharacterId);
    await expectNoSearchResult(player.page, originalName);

    await openSpellPicker(player.page, campaignACharacterId);
    await expectSearchResult(player.page, originalName, 2);
    await player.page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(player.page.getByRole("button", { name: "Remove", exact: true })).toBeVisible();

    await ownerPage.goto(editHref);
    await ownerPage.getByLabel("Name", { exact: true }).fill(revisedName);
    await ownerPage
      .getByLabel("Spell description", { exact: true })
      .fill("The revised campaign thread strikes with greater force.");
    await ownerPage.getByText("Optional automation", { exact: true }).click();
    await ownerPage.getByLabel("Damage dice", { exact: true }).fill("3d6");
    await ownerPage.getByRole("button", { name: "Save new version" }).click();
    await expect(ownerPage.getByRole("status")).toContainText("new spell version");
    await expect(ownerPage.getByRole("link", { name: new RegExp(revisedName) })).toContainText(
      "v3",
    );

    await toggleCampaignShare(ownerPage, editHref, `Share with ${campaignBName}`);
    await toggleCampaignShare(ownerPage, editHref, `Stop sharing with ${campaignAName}`);
    await expect(ownerPage.getByText("Shared", { exact: true }).first()).toBeVisible();
    await expect(ownerPage.getByText("v3", { exact: true })).toBeVisible();

    await openSpellPicker(player.page, campaignBCharacterId);
    await expectSearchResult(player.page, revisedName, 3);

    await openSpellPicker(player.page, campaignACharacterId);
    await expectNoSearchResult(player.page, revisedName);

    await toggleCampaignShare(ownerPage, editHref, `Stop sharing with ${campaignBName}`);
    await expect(ownerPage.getByText("Private", { exact: true }).first()).toBeVisible();
    await expect(ownerPage.getByText("v4", { exact: true })).toBeVisible();

    await openSpellPicker(player.page, campaignBCharacterId);
    await expectNoSearchResult(player.page, revisedName);

    await player.page.goto(`/characters/${campaignACharacterId}`);
    await player.page.getByRole("button", { name: "Spells", exact: true }).click();
    await expect(player.page.getByText(originalName, { exact: true }).first()).toBeVisible();
    await expect(player.page.getByText("Homebrew · v2", { exact: true }).first()).toBeVisible();
    await player.page.getByRole("button", { name: "Prepare", exact: true }).first().click();
    await player.page.getByRole("button", { name: `Cast ${originalName}` }).first().click();
    await expect(player.page.getByRole("dialog", { name: `Cast: ${originalName}` })).toContainText(
      "2d6",
    );
  } finally {
    await player.close();
  }
});
