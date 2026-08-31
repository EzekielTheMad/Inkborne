import { expect, test, type Page } from "@playwright/test";

import {
  createServiceClient,
  E2E_HOMEBREW_PREFIX,
  getTestUserId,
} from "./helpers/supabase";

test.describe.configure({ mode: "serial" });

const runId = Date.now();
const originalName = `${E2E_HOMEBREW_PREFIX} Oathbound Compass ${runId}`;
const revisedName = `${originalName} Revised`;
let definitionId: string | null = null;

function libraryEntry(page: Page, name: string) {
  return page.getByRole("link").filter({ hasText: name });
}

test.afterAll(async () => {
  const service = createServiceClient();
  const ownerId = await getTestUserId();
  let cleanup = service
    .from("content_definitions")
    .delete()
    .eq("owner_id", ownerId)
    .eq("source", "homebrew")
    .eq("content_type", "magic_item")
    .in("name", [originalName, revisedName]);
  if (definitionId) cleanup = cleanup.eq("id", definitionId);
  const { data: removed, error: cleanupError } = await cleanup.select("id");
  if (cleanupError) {
    throw new Error(`E2E magic-item cleanup failed: ${cleanupError.message}`);
  }

  const { count, error: countError } = await service
    .from("content_definitions")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("source", "homebrew")
    .eq("content_type", "magic_item")
    .in("name", [originalName, revisedName]);
  if (countError) {
    throw new Error(`E2E magic-item cleanup verification failed: ${countError.message}`);
  }
  if ((count ?? 0) !== 0) {
    throw new Error(`E2E magic-item cleanup left ${count} reserved fixture row(s).`);
  }
  console.log(
    `[e2e] Removed ${removed?.length ?? 0} reserved magic-item fixture row(s); 0 remain.`,
  );
});

test("creates a private magic item, saves v2, and discovers it in Library", async ({
  page,
}) => {
  await page.goto("/homebrew/magic-items/new");
  await page.getByLabel("Name", { exact: true }).fill(originalName);
  await page.getByLabel("Rarity", { exact: true }).selectOption("Rare");
  await page
    .getByLabel("Magic item description", { exact: true })
    .fill("A compass that points toward the last promise its bearer made.");
  await page
    .getByLabel("Equipment category", { exact: true })
    .fill("Wondrous item");
  await page.getByLabel("Requires attunement", { exact: true }).check();
  await page.getByRole("button", { name: "Create private magic item" }).click();

  await expect(page.getByRole("status")).toHaveText("Private homebrew created.");
  const editLink = page.getByRole("link", { name: new RegExp(originalName) });
  await expect(editLink).toContainText("Private");
  await expect(editLink).toContainText("Rare · Requires attunement");
  await expect(editLink).toContainText("v1");
  const editHref = await editLink.getAttribute("href");
  definitionId = editHref?.match(/\/homebrew\/magic-items\/([^/]+)\/edit/)?.[1] ?? null;
  if (!definitionId || !editHref) {
    throw new Error("Could not capture the created homebrew magic-item id.");
  }

  await page.goto(editHref);
  await expect(page.getByText("Private homebrew · version 1")).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill(revisedName);
  await page.getByLabel("Rarity", { exact: true }).selectOption("Very Rare");
  await page
    .getByLabel("Magic item description", { exact: true })
    .fill("A brighter compass that remembers every road home.");
  await page.getByLabel("Requires attunement", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Save new version" }).click();

  await expect(page.getByRole("status")).toContainText("new homebrew version");
  const revisedLink = page.getByRole("link", { name: new RegExp(revisedName) });
  await expect(revisedLink).toContainText("Very Rare · No attunement required");
  await expect(revisedLink).toContainText("v2");

  await page.goto("/library");
  await page
    .getByRole("navigation", { name: "Library categories" })
    .getByRole("link", { name: "Items", exact: true })
    .click();
  await page.getByLabel("Access", { exact: true }).selectOption("mine");
  await page.getByLabel("Search by name", { exact: true }).fill(revisedName);
  await page.getByRole("button", { name: "Apply", exact: true }).click();

  const entry = libraryEntry(page, revisedName);
  await expect(entry).toBeVisible();
  await expect(entry).toContainText("Very Rare item");
  await expect(entry).toContainText("A brighter compass that remembers every road home.");
  await expect(entry).toContainText("Your homebrew");
  await expect(entry).toContainText("v2");
});
