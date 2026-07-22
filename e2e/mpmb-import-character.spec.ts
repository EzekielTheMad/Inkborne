/**
 * MPMB importer exit-flow UAT.
 *
 * Exercises the real authenticated path from static upload through review,
 * calculation confirmation, commit, library discovery, an earned level-4 ASI
 * feat choice, and an imported Wizard spell on the live character sheet.
 *
 * The character and committed definitions are hard-deleted in afterAll. The
 * completed content_imports row is an intentionally immutable audit record;
 * its exact UUID is emitted at the end for privileged protected-preview
 * teardown (DELETE is denied to both authenticated and service-role clients).
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  createServiceClient,
  deleteCharactersById,
  E2E_CHARACTER_PREFIX,
  getTestUserId,
  seedWizardCharacter,
} from "./helpers/supabase";

test.describe.configure({ mode: "serial" });

const stamp = `${Date.now()}-${process.pid}`;
const characterName = `${E2E_CHARACTER_PREFIX} __e2e__ MPMB Exit ${stamp}`;
const featName = "__e2e__ Lantern Keeper";
const spellName = "__e2e__ Prism Spark";
const filename = `__e2e__-mpmb-character-exit-${stamp}.mpmb`;
const parityFixture = readFileSync(
  path.resolve(__dirname, "../tests/fixtures/mpmb/representative-parity.mpmb"),
  "utf8",
);

let characterId: string | undefined;
let importId: string | undefined;
const definitionIds: string[] = [];

function visible(locator: Locator): Locator {
  return locator.filter({ visible: true });
}

function acCard(page: Page): Locator {
  return visible(page.locator("div").filter({ hasText: /^AC\s*\d+\s*$/ })).first();
}

function mpmbSource(): string {
  // Keep parity and E2E on the same canonical rules while making this durable
  // import's source hash unique and therefore safely rerunnable.
  return `${parityFixture}\n// __e2e__ upload nonce ${stamp}\n`;
}

async function makeWizardLevelFour(): Promise<string> {
  const id = await seedWizardCharacter(characterName);
  const service = createServiceClient();
  const { error } = await service
    .from("characters")
    .update({
      level: 4,
      choices: {
        classes: [{ slug: "wizard", level: 4 }],
        race: "human",
        background: "sage",
        ability_method: "standard_array",
      },
    })
    .eq("id", id);
  if (error) throw new Error(`Could not advance E2E Wizard to level 4: ${error.message}`);
  return id;
}

async function loadImportedDefinition(name: string): Promise<{
  id: string;
  version: number;
}> {
  const service = createServiceClient();
  const ownerId = await getTestUserId();
  const { data, error } = await service
    .from("content_definitions")
    .select("id, version")
    .eq("owner_id", ownerId)
    .eq("source", "homebrew")
    .eq("scope", "personal")
    .eq("name", name)
    .single();
  if (error || !data) {
    throw new Error(`Could not load committed E2E definition: ${error?.message ?? "no row"}`);
  }
  return data;
}

async function deleteImportedDefinitions(): Promise<void> {
  const service = createServiceClient();
  const ownerId = await getTestUserId();
  if (definitionIds.length > 0) {
    const { error } = await service
      .from("content_definitions")
      .delete()
      .eq("owner_id", ownerId)
      .in("id", definitionIds);
    if (error) throw new Error(`E2E imported-definition cleanup failed: ${error.message}`);
  }

  // Name fallback covers a failure after commit but before the ids were read.
  const { error: fallbackError } = await service
    .from("content_definitions")
    .delete()
    .eq("owner_id", ownerId)
    .eq("source", "homebrew")
    .in("name", [featName, spellName]);
  if (fallbackError) {
    throw new Error(`E2E imported-definition fallback cleanup failed: ${fallbackError.message}`);
  }
}

test.beforeAll(async () => {
  characterId = await makeWizardLevelFour();
});

test.afterAll(async () => {
  if (characterId) await deleteCharactersById([characterId]);
  await deleteImportedDefinitions();
  if (importId) {
    console.log(`[e2e] Completed MPMB audit row requires privileged cleanup: ${importId}`);
  }
});

test("imports MPMB rules and uses their exact pins on a level-4 Wizard", async ({
  page,
}) => {
  if (!characterId) throw new Error("The E2E character was not seeded.");

  await page.goto("/library/import");
  await expect(page.getByRole("heading", { name: "Import MPMB content" })).toBeVisible();
  await page.getByLabel("MPMB import file").setInputFiles({
    name: filename,
    mimeType: "text/javascript",
    buffer: Buffer.from(mpmbSource(), "utf8"),
  });
  await page.getByRole("checkbox", { name: /private-use attestation/i }).check();
  await page.getByRole("button", { name: "Review import" }).click();

  await page.waitForURL(/\/library\/import\/[0-9a-f-]{36}$/);
  importId = page.url().match(/\/library\/import\/([0-9a-f-]{36})$/)?.[1];
  if (!importId) throw new Error("Could not capture the staged MPMB import id.");

  await expect(page.getByRole("heading", { name: filename })).toBeVisible();
  await expect(page.getByText("Sheet 13.1.14", { exact: true })).toBeVisible();
  for (const name of [featName, spellName]) {
    const item = page.locator("article").filter({ hasText: name });
    await expect(item).toContainText("Ready");
    await expect(item.getByRole("button", { name: "Selected" })).toBeVisible();
  }

  await page.getByRole("link", { name: "Preview calculations" }).click();
  await expect(page.getByRole("heading", { name: "Preview imported content" })).toBeVisible();
  const featPreview = page.locator("article").filter({ hasText: featName });
  await expect(featPreview).toContainText(/10\s*→\s*11/);
  await expect(featPreview).toContainText("(+1)");
  const spellPreview = page.locator("article").filter({ hasText: spellName });
  await expect(spellPreview).toContainText("1d8 + 3");
  await expect(spellPreview).toContainText("2d8 + 3");
  await page.getByRole("button", { name: "Confirm calculations" }).click();

  await page.waitForURL(`**/library/import/${importId}?previewed=1`);
  await expect(page.getByText(/Calculations confirmed for revision/)).toBeVisible();
  await page.getByRole("button", { name: "Import 2" }).click();
  await page.waitForURL(`**/library/import/${importId}?committed=2`);
  await expect(page.getByText("2 definitions added to your private library.")).toBeVisible();
  await page.getByRole("link", { name: "View library" }).click();

  const featCard = page.getByRole("link").filter({ hasText: featName });
  const spellCard = page.getByRole("link").filter({ hasText: spellName });
  await expect(featCard).toContainText("Private");
  await expect(featCard).toContainText("v1");
  await expect(spellCard).toContainText("Private");
  await expect(spellCard).toContainText("v1");

  const feat = await loadImportedDefinition(featName);
  const spell = await loadImportedDefinition(spellName);
  definitionIds.push(feat.id, spell.id);
  expect(feat.version).toBe(1);
  expect(spell.version).toBe(1);

  // Loading the sheet synchronizes the earned class-feature grants used by
  // the ASI transaction boundary before the choice is made in the builder.
  await page.goto(`/characters/${characterId}`);
  await expect(page.getByRole("tab", { name: /character sheet/i })).toBeVisible();

  await page.goto(`/characters/${characterId}/builder/class`);
  await page.getByRole("button", { name: /^Level 4:/ }).click();
  await expect(page.getByRole("heading", { name: "Ability Score Improvement" })).toBeVisible();
  await page
    .getByRole("group", { name: "Improvement type" })
    .getByRole("button", { name: "Feat" })
    .click();
  await page.getByPlaceholder("Search available feats").fill(featName);
  const featOption = page.getByRole("button").filter({ hasText: featName });
  await expect(featOption).toContainText("v1");
  await expect(featOption).toContainText("Private");
  await featOption.click();
  await expect(page.getByLabel("Choice made")).toBeVisible();

  await expect.poll(async () => {
    const { data } = await createServiceClient()
      .from("character_content_refs")
      .select("content_version")
      .eq("character_id", characterId!)
      .eq("content_id", feat.id)
      .maybeSingle();
    return data?.content_version ?? null;
  }).toBe(1);

  await page.goto(`/characters/${characterId}`);
  await expect(acCard(page)).toHaveText(/^\s*AC\s*13\s*$/);
  await visible(page.getByRole("button", { name: "Features", exact: true })).first().click();
  await expect(visible(page.getByText(featName, { exact: true })).first()).toBeVisible();

  await visible(page.getByRole("button", { name: "Spells", exact: true })).first().click();
  await page.getByRole("button", { name: "Add Spell", exact: true }).click();
  await page.getByPlaceholder("Search spells…").fill(spellName);
  const addButton = page.getByRole("button", { name: "Add", exact: true });
  const spellResult = page.locator("div").filter({ has: addButton }).filter({ hasText: spellName }).last();
  await expect(spellResult).toBeVisible();
  await expect(spellResult).toContainText("Homebrew · v1");
  await addButton.click();
  await expect(page.getByRole("button", { name: /Added|Using v1/ })).toBeVisible();

  await expect.poll(async () => {
    const { data } = await createServiceClient()
      .from("character_spells")
      .select("content_version")
      .eq("character_id", characterId!)
      .eq("content_id", spell.id)
      .maybeSingle();
    return data?.content_version ?? null;
  }).toBe(1);

  await page.goto(`/characters/${characterId}`);
  await visible(page.getByRole("button", { name: "Spells", exact: true })).first().click();
  await expect(visible(page.getByText("Save DC 13", { exact: false })).first()).toBeVisible();
  await expect(visible(page.getByText("Attack +5", { exact: false })).first()).toBeVisible();
  await expect(visible(page.getByText(spellName, { exact: true })).first()).toBeVisible();
  await expect(visible(page.getByText("Homebrew · v1", { exact: true })).first()).toBeVisible();
  await visible(page.getByRole("button", { name: "Prepare" })).first().click();
  await visible(page.getByRole("button", { name: `Cast ${spellName}` })).first().click();
  const castDialog = page.getByRole("dialog", { name: `Cast: ${spellName}` });
  await expect(castDialog).toContainText("+5");
  await expect(castDialog).toContainText("1d8 + 3");
});
