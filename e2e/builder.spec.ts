/**
 * Smoke 2 — character creation: the "New Character" form creates a character
 * and drops the user into the builder overview.
 *
 * Uses the authenticated storage state from auth.setup.ts. The created
 * character is deleted in afterAll so the shared backend stays clean.
 */
import { test, expect } from "@playwright/test";
import { deleteCharactersById, E2E_CHARACTER_PREFIX } from "./helpers/supabase";

const createdCharacterIds: string[] = [];

test.afterAll(async () => {
  await deleteCharactersById(createdCharacterIds);
});

test("creates a character and steps into the builder", async ({ page }) => {
  const characterName = `${E2E_CHARACTER_PREFIX} Builder ${Date.now()}`;

  await page.goto("/characters/new");
  await expect(page.getByRole("heading", { name: /begin a new character/i })).toBeVisible();

  await page.getByLabel(/what will they be called/i).fill(characterName);

  // With a single published game system the form uses a hidden input; if more
  // systems ever get published a <select> appears instead — handle both.
  const systemSelect = page.locator("select#system_id");
  if ((await systemSelect.count()) > 0) {
    await systemSelect.selectOption({ index: 1 });
  }

  await page.getByRole("button", { name: /begin/i }).click();

  // The createCharacter server action inserts the row and redirects to the builder.
  await page.waitForURL(/\/characters\/[0-9a-f-]{36}\/builder/, { timeout: 60_000 });
  const characterId = page.url().match(/\/characters\/([0-9a-f-]{36})\/builder/)![1];
  createdCharacterIds.push(characterId);

  // Builder chrome: character name heading + builder overview copy.
  await expect(page.getByRole("heading", { name: characterName })).toBeVisible();
  await expect(page.getByText("Character Builder").first()).toBeVisible();
  await expect(
    page.getByText("Complete each step to build your character", { exact: false }),
  ).toBeVisible();

  // Creation steps are linked (step nav + overview cards both link; take first).
  await expect(
    page.locator(`a[href="/characters/${characterId}/builder/race"]`).first(),
  ).toBeVisible();
  await expect(
    page.locator(`a[href="/characters/${characterId}/builder/class"]`).first(),
  ).toBeVisible();
});
