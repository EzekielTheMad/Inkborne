import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  deleteCharactersById,
  deleteHomebrewSpellsById,
  E2E_CHARACTER_PREFIX,
  E2E_HOMEBREW_PREFIX,
  seedWizardCharacter,
} from "./helpers/supabase";

test.describe.configure({ mode: "serial" });

const characterIds: string[] = [];
const definitionIds: string[] = [];
let firstCharacterId: string;
let secondCharacterId: string;

function visible(locator: Locator): Locator {
  return locator.filter({ visible: true });
}

test.beforeAll(async () => {
  const stamp = Date.now();
  firstCharacterId = await seedWizardCharacter(
    `${E2E_CHARACTER_PREFIX} Homebrew v1 ${stamp}`,
  );
  secondCharacterId = await seedWizardCharacter(
    `${E2E_CHARACTER_PREFIX} Homebrew v2 ${stamp}`,
  );
  characterIds.push(firstCharacterId, secondCharacterId);
});

test.afterAll(async () => {
  await deleteCharactersById(characterIds);
  await deleteHomebrewSpellsById(definitionIds);
});

async function openSpellPicker(page: Page, characterId: string): Promise<void> {
  await page.goto(`/characters/${characterId}`);
  await page.getByRole("button", { name: "Spells", exact: true }).click();
  await page.getByRole("button", { name: "Add Spell", exact: true }).click();
  await expect(page.getByPlaceholder("Search spells…")).toBeVisible();
}

async function addSearchedSpell(page: Page, name: string, version: number): Promise<void> {
  await page.getByPlaceholder("Search spells…").fill(name);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await expect(page.getByText(`Homebrew · v${version}`, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove", exact: true })).toBeVisible();
}

test("private spell versions stay pinned while new characters discover the latest", async ({
  page,
}) => {
  const stamp = Date.now();
  const originalName = `${E2E_HOMEBREW_PREFIX} Ember Thread ${stamp}`;
  const revisedName = `${originalName} Revised`;

  await page.goto("/library/spells/new");
  await page.getByLabel("Name", { exact: true }).fill(originalName);
  await page.getByLabel("Level", { exact: true }).selectOption("1");
  await page.getByLabel("Casting time", { exact: true }).fill("1 action");
  await page.getByLabel("Range", { exact: true }).fill("60 feet");
  await page.getByLabel("Duration", { exact: true }).fill("1 minute");
  await page.getByLabel("Concentration", { exact: true }).check();
  await page
    .getByLabel("Spell description", { exact: true })
    .fill("A bright thread of fire lashes the target.");
  await page.getByLabel("Wizard", { exact: true }).check();
  await page.getByText("Optional automation", { exact: true }).click();
  await page.getByLabel("Spell attack", { exact: true }).selectOption("ranged");
  await page.getByLabel("Damage type", { exact: true }).selectOption("fire");
  await page.getByLabel("Damage dice", { exact: true }).fill("2d6");
  await page.getByRole("button", { name: "Create private spell" }).click();

  await expect(page.getByRole("status")).toHaveText("Private spell created.");
  const editLink = page.getByRole("link", { name: new RegExp(originalName) });
  await expect(editLink).toContainText("v1");
  const editHref = await editLink.getAttribute("href");
  const definitionId = editHref?.match(/\/library\/spells\/([^/]+)\/edit/)?.[1];
  if (!definitionId) throw new Error("Could not capture created homebrew spell id");
  definitionIds.push(definitionId);

  await openSpellPicker(page, firstCharacterId);
  await addSearchedSpell(page, originalName, 1);

  await page.goto(editHref!);
  await page.getByLabel("Name", { exact: true }).fill(revisedName);
  await page
    .getByLabel("Spell description", { exact: true })
    .fill("A revised thread of fire lashes the target with greater force.");
  await page.getByText("Optional automation", { exact: true }).click();
  await page.getByLabel("Damage dice", { exact: true }).fill("3d6");
  await page.getByRole("button", { name: "Save new version" }).click();

  await expect(page.getByRole("status")).toContainText("new spell version");
  await expect(page.getByRole("link", { name: new RegExp(revisedName) })).toContainText("v2");

  await page.goto(`/characters/${firstCharacterId}`);
  await page.getByRole("button", { name: "Spells", exact: true }).click();
  await expect(visible(page.getByText(originalName, { exact: true })).first()).toBeVisible();
  await expect(visible(page.getByText("Homebrew · v1", { exact: true })).first()).toBeVisible();
  await visible(page.getByRole("button", { name: "Prepare", exact: true })).first().click();
  await visible(page.getByRole("button", { name: `Cast ${originalName}` })).first().click();
  const castDialog = page.getByRole("dialog", { name: `Cast: ${originalName}` });
  await expect(castDialog).toContainText("2d6");
  await castDialog.getByRole("button", { name: "Cancel" }).click();

  await openSpellPicker(page, secondCharacterId);
  await addSearchedSpell(page, revisedName, 2);
  await page.goto(`/characters/${secondCharacterId}`);
  await page.getByRole("button", { name: "Spells", exact: true }).click();
  await expect(visible(page.getByText(revisedName, { exact: true })).first()).toBeVisible();
  await expect(visible(page.getByText("Homebrew · v2", { exact: true })).first()).toBeVisible();
  await visible(page.getByRole("button", { name: "Prepare", exact: true })).first().click();
  await visible(page.getByRole("button", { name: `Cast ${revisedName}` })).first().click();
  await expect(page.getByRole("dialog", { name: `Cast: ${revisedName}` })).toContainText(
    "3d6",
  );
});
