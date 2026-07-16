/**
 * Smoke 3 — character sheet: a built character's sheet renders its core
 * elements (header identity, saving throws, skills, HP tracker with the
 * correct computed max HP).
 *
 * A fully-built level-1 Fighter is seeded directly through Supabase (walking
 * the whole builder in-browser is beyond a smoke net) and deleted in afterAll.
 */
import { test, expect } from "@playwright/test";
import {
  seedSheetCharacter,
  deleteCharactersById,
  E2E_CHARACTER_PREFIX,
} from "./helpers/supabase";

let characterId: string | undefined;
let characterName: string;

test.beforeAll(async () => {
  characterName = `${E2E_CHARACTER_PREFIX} Sheet ${Date.now()}`;
  characterId = await seedSheetCharacter(characterName);
});

test.afterAll(async () => {
  if (characterId) await deleteCharactersById([characterId]);
});

test("renders core character sheet elements", async ({ page }) => {
  await page.goto(`/characters/${characterId}`);

  // Header identity (desktop + mobile headers both exist in the DOM; at the
  // desktop viewport the first/desktop one is the visible one).
  await expect(page.getByText(characterName).first()).toBeVisible();
  await expect(page.getByText("Fighter 1").first()).toBeVisible();

  // Sheet/Narrative tabs render with the sheet active.
  await expect(page.getByRole("tab", { name: "Character Sheet" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Narrative" })).toBeVisible();

  // Core sheet widgets.
  await expect(page.getByText("Saving Throws").first()).toBeVisible();
  await expect(page.getByText("Skills", { exact: true }).first()).toBeVisible();

  // HP tracker shows the computed max: Fighter L1 = d10 max (10) + CON mod (+1) = 11.
  const hpTracker = page
    .getByLabel("HP tracker — click to heal or damage")
    .first();
  await expect(hpTracker).toBeVisible();
  await expect(hpTracker).toContainText("11/11");
});
