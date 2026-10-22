import { test, expect, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

type Account = { email: string; password: string; id: string };
type Settings = { appOrigin: string; supabaseOrigin: string; owner: Account; other: Account;
  classId: string; className: string; systemId: string };

async function settings(): Promise<Settings> {
  const file = process.env.INKBORNE_LOCAL_FLOW_CONFIG;
  if (!file) throw Error("Provide the isolated local browser configuration file");
  const value = JSON.parse(await readFile(file, "utf8")) as Settings;
  for (const origin of [value.appOrigin, value.supabaseOrigin]) {
    const url = new URL(origin);
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.origin !== origin) {
      throw Error("This workflow accepts only explicit local loopback origins");
    }
  }
  if (!value.owner?.email || !value.owner.password || !value.other?.email || !value.other.password
    || value.owner.id === value.other.id) throw Error("Two distinct isolated accounts are required");
  return value;
}

async function login(page: Page, origin: string, account: Account) {
  try {
    await page.goto(origin + "/login");
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(origin + "/dashboard", { timeout: 60000 });
  } catch {
    await page.close(); // No failure screenshot/DOM can retain credential inputs.
    throw Error("Actual local app sign-in failed; credentials withheld");
  }
}

async function saveThroughApp(page: Page, change: () => Promise<unknown>) {
  const path = new URL(page.url()).pathname;
  const [response] = await Promise.all([
    page.waitForResponse(item => item.request().method() === "POST" && new URL(item.url()).pathname === path), change(),
  ]);
  expect(response.status(), "The real application save must succeed before reloading").toBe(200);
}

test("sign in, build a character, save and reload every step in the actual app", async ({ page, context, browser }, info) => {
  const config = await settings();
  const allowed = new Set([config.appOrigin, config.supabaseOrigin]);
  const blockedOrigins: string[] = [], pageErrors: string[] = [];
  await context.route("**/*", route => {
    const origin = new URL(route.request().url()).origin;
    if (!allowed.has(origin)) { blockedOrigins.push(origin); return route.abort(); }
    return route.continue();
  });
  page.on("pageerror", () => pageErrors.push("browser error"));
  console.log(JSON.stringify({ workerPid: process.pid, parentPid: process.ppid, cwd: process.cwd(),
    startedUtc: new Date().toISOString(), story: "actual local app saving" }));
  await page.goto(config.appOrigin + "/characters/new");
  await expect(page).toHaveURL(config.appOrigin + "/login");
  await login(page, config.appOrigin, config.owner);
  // Follow the real in-app link after the Server Action redirects; a forced
  // document navigation here would hide client account-boundary bugs.
  await page.locator('a[href="/characters/new"]').first().click();
  await expect(page).toHaveURL(config.appOrigin + "/characters/new");
  const name = "Saved notebook " + randomUUID().slice(0, 8);
  await page.getByRole("textbox", { name: "What will they be called?" }).fill(name);
  await page.getByRole("button", { name: "Open the notebook", exact: true }).click();
  await page.waitForURL(/\/characters\/[0-9a-f-]+\/builder\/first-class$/);
  const savedUrl = page.url(), characterId = new URL(savedUrl).pathname.split("/")[2];
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "First class", exact: true }).selectOption(config.classId);
  await page.getByRole("button", { name: "Save first class", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Saved class", exact: true })).toBeVisible();
  await expect(page.getByText(config.className + " · Level 1", { exact: true })).toBeVisible();
  await page.reload(); // Real document request, server cookies and database reads.
  await expect(page.getByRole("heading", { name: "Saved class", exact: true })).toBeVisible();
  await expect(page.getByText(config.className + " · Level 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key =>
    key.startsWith("inkborne:pending-creation:") || key.startsWith("inkborne:pending-first-class:")))).toEqual([]);
  await page.screenshot({ path: info.outputPath("saved-class-after-reload.png"), fullPage: true });
  const notebook = config.appOrigin + "/characters/" + characterId;
  await page.getByRole("link", { name: "Continue to race", exact: true }).click();
  await page.getByRole("button", { name: "Preview Human", exact: true }).click();
  await saveThroughApp(page, () => page.getByRole("button", { name: "Add Race", exact: true }).click());
  await expect(page.getByText("Saving race choices. Keep this page open.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Change Race", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Change Race", exact: true })).toBeVisible();
  await expect(page.getByText("Human", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: info.outputPath("saved-race-after-reload.png"), fullPage: true });
  await page.getByRole("button", { name: "Next: Abilities", exact: true }).click();
  await expect(page).toHaveURL(notebook + "/builder/abilities");
  await page.reload(); // Exercise the first edit on a freshly hydrated abilities page.
  const abilityValues = { Strength: "15", Dexterity: "14", Constitution: "13", Intelligence: "12", Wisdom: "10", Charisma: "8" };
  for (const [ability, value] of Object.entries(abilityValues)) {
    await saveThroughApp(page, () => page.getByRole("combobox", { name: ability + " score", exact: true }).selectOption(value));
    await expect(page.getByText("Changes save automatically.", { exact: true })).toBeVisible();
  }
  await page.reload();
  for (const [ability, value] of Object.entries(abilityValues)) {
    await expect(page.getByRole("combobox", { name: ability + " score", exact: true })).toHaveValue(value);
  }
  await page.screenshot({ path: info.outputPath("saved-abilities-after-reload.png"), fullPage: true });
  await page.getByRole("button", { name: "Next: Background", exact: true }).click();
  await expect(page).toHaveURL(notebook + "/builder/background");
  await page.getByRole("button", { name: "Preview Soldier", exact: true }).click();
  await saveThroughApp(page, () => page.getByRole("button", { name: "Add Background", exact: true }).click());
  await expect(page.getByRole("button", { name: "Change Background", exact: true })).toBeVisible();
  await saveThroughApp(page, () => page.getByRole("button", { name: "I keep my word.", exact: true }).click());
  await expect(page.getByText("Personality Traits (1/2)", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Change Background", exact: true })).toBeVisible();
  await expect(page.getByText("Soldier", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Personality Traits (1/2)", { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("saved-background-after-reload.png"), fullPage: true });
  await page.getByRole("button", { name: "Next: Equipment", exact: true }).click();
  await expect(page).toHaveURL(notebook + "/builder/equipment");
  await saveThroughApp(page, () => page.getByRole("button", { name: /^\(a\)\s*A backpack$/ }).click());
  await expect(page.getByRole("button", { name: "Confirm Equipment", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Confirm Equipment", exact: true }).click();
  await expect(page.getByText("Starting equipment award recorded", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Starting equipment award recorded", { exact: true })).toBeVisible();
  for (const item of ["Backpack", "Bedroll", "Pouch", "10 gp"]) {
    await expect(page.getByRole("listitem").filter({ hasText: new RegExp("^" + item + "$") })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Confirm Equipment", exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("saved-equipment-after-reload.png"), fullPage: true });
  // Return through the builder overview and a fresh class read after all later
  // choices; no earlier class selection may be lost by a whole-object write.
  await page.goto(notebook + "/builder");
  for (const type of ["race", "abilities", "first-class", "background", "equipment"]) {
    await expect(page.locator('nav[aria-label="Character builder"] a[href="' + notebook.replace(config.appOrigin, "") + "/builder/" + type + '"]')).toBeVisible();
  }
  await page.goto(savedUrl);
  await expect(page.getByText(config.className + " · Level 1", { exact: true })).toBeVisible();
  const other = await browser.newContext();
  try {
    await other.route("**/*", route => allowed.has(new URL(route.request().url()).origin) ? route.continue() : route.abort());
    const otherPage = await other.newPage();
    await login(otherPage, config.appOrigin, config.other);
    await otherPage.goto(savedUrl);
    await expect(otherPage.getByRole("heading", { name: "Saved class", exact: true })).toHaveCount(0);
    await expect(otherPage.getByText("This page could not be found.", { exact: true })).toBeVisible();
  } finally { await other.close(); }
  expect(blockedOrigins).toEqual([]); expect(pageErrors).toEqual([]);
  const evidencePath = info.outputPath("actual-workflow.json");
  await writeFile(evidencePath, JSON.stringify({
    actualNextApp: true, actualAuthCookies: true, actualPostgrest: true, syntheticLocalContent: true,
    characterId, classId: config.classId, name, savedUrl, reloadPassed: true, foreignAccountRefused: true,
    raceReloadPassed: true, abilitiesReloadPassed: true, backgroundReloadPassed: true, equipmentReloadPassed: true,
    blockedOrigins, pageErrors,
  }, null, 2));
  await info.attach("actual-workflow", { contentType: "application/json", path: evidencePath });
});
