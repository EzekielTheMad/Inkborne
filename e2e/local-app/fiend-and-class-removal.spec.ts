import { test, expect, type BrowserContext, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";

type Settings = { appOrigin: string; supabaseOrigin: string; owner: { email: string; password: string }; systemId: string };
type Family = { family: string; characterId: string; name: string; builderUrl: string; sheetUrl: string;
  config: Settings; blockedOrigins: string[]; pageErrors: string[]; checkpoints: string[] };

async function settings(): Promise<Settings> {
  const file = process.env.INKBORNE_LOCAL_FLOW_CONFIG;
  if (!file) throw Error("Provide the isolated local browser configuration file");
  const config = JSON.parse(await readFile(file, "utf8")) as Settings;
  for (const origin of [config.appOrigin, config.supabaseOrigin]) {
    const url = new URL(origin);
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.origin !== origin) {
      throw Error("Class choice workflows require explicit local loopback origins");
    }
  }
  if (!config.owner?.email || !config.owner.password) throw Error("An isolated local owner account is required");
  return config;
}

async function saveThroughApp(page: Page, change: () => Promise<unknown>) {
  const path = new URL(page.url()).pathname;
  const [response] = await Promise.all([
    page.waitForResponse(item => item.request().method() === "POST" && new URL(item.url()).pathname === path), change(),
  ]);
  expect(response.status(), "The actual application save must succeed before reloading").toBe(200);
}

async function choose(page: Page, option: Locator) {
  await saveThroughApp(page, () => option.click());
  await expect(option).toHaveAttribute("aria-pressed", "true");
  await expect(option).toBeEnabled();
}

function group(page: Page, label: string, option?: string): Locator {
  const article = page.getByRole("article").filter({ has: page.getByRole("heading", { name: label, exact: true, level: 4 }) });
  return option ? article.filter({ has: page.getByRole("button", { name: option, exact: true }) }) : article;
}

async function setLevel(page: Page, className: string, level: number) {
  const input = page.getByRole("combobox", { name: `Set level for ${className}`, exact: true });
  await saveThroughApp(page, () => input.selectOption(String(level)));
  await expect(input).toHaveValue(String(level));
  await expect(input).toBeEnabled();
}

async function openLevel(page: Page, level: number) {
  await page.getByRole("button", { name: new RegExp(`^Level ${level}:`) }).click();
  await expect(page.locator('section[aria-labelledby="class-level-title"]').getByRole("navigation", { name: "Breadcrumb", exact: true })).toContainText(`Level ${level}`);
}

async function checkpoint(info: TestInfo, family: Family, label: string, finished = false) {
  family.checkpoints.push(label);
  if (!label.startsWith("created")) await nativeReadback(info, family);
  const path = info.outputPath("family-workflows.json");
  await writeFile(path, JSON.stringify({ family: family.family, characters: [{ characterId: family.characterId, name: family.name }],
    actualApp: true, actualAuthCookies: true, actualPostgrest: true, ordinaryUiSavesOnly: true, draftChoices: true,
    saveReloadPassed: finished, checkpoints: family.checkpoints, blockedOrigins: family.blockedOrigins, pageErrors: family.pageErrors }, null, 2));
  if (finished) {
    expect(family.blockedOrigins).toEqual([]); expect(family.pageErrors).toEqual([]);
    await info.attach("family-workflows", { path, contentType: "application/json" });
  }
}

async function nativeReadback(info: TestInfo, family: Family, phase = "checkpoint") {
  const configFile = process.env.INKBORNE_LOCAL_FLOW_CONFIG;
  if (!configFile || !/^[0-9a-f-]{36}$/.test(family.characterId)) throw Error("Local native evidence configuration required");
  const state = JSON.parse(await readFile(resolve(dirname(configFile), "../state.json"), "utf8"));
  if (state.project !== "inkborne-app-flow-20261022" || state.ready !== true || state.stoppedUtc) throw Error("Wrong disposable runtime");
  const db = state.containers.find((item: { name: string }) => item.name === `/${state.project}-db`);
  if (!db || !/^[a-f0-9]{64}$/.test(db.id)) throw Error("Missing owned database identity");
  const processes: unknown[] = [];
  const run = (args: string[], input?: string) => {
    const startedUtc = new Date().toISOString();
    const result = spawnSync("C:/Users/kaios/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe", ["--context", "desktop-linux", ...args],
      { input, encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 });
    processes.push({ pid: result.pid, parentPid: process.pid, cwd: process.cwd(), args, startedUtc, exitCode: result.status });
    if (result.status !== 0) throw Error(`Local read-only database evidence failed: ${result.stderr.slice(0, 1200)}`);
    return result.stdout.trim();
  };
  expect(run(["info", "--format", "{{.ID}}"])).toBe(state.engineId);
  const inspected = JSON.parse(run(["inspect", "--format", '{"id":{{json .Id}},"labels":{{json .Config.Labels}}}', db.id]));
  expect(inspected.id).toBe(db.id); expect(inspected.labels["com.docker.compose.project"]).toBe(state.project);
  const sql = await readFile(resolve(process.cwd(), "supabase/verification/builder-bonus-spells-readback.sql"), "utf8");
  const evidence = JSON.parse(run(["exec", "-i", db.id, "psql", "-X", "--no-password", "--host", "/var/run/postgresql", "--username", "supabase_admin",
    "--dbname", "postgres", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--set", `character_id=${family.characterId}`, "--file", "-"], sql));
  const file = info.outputPath(`native-readback-${family.checkpoints.length}-${phase}.json`);
  await writeFile(file, JSON.stringify({ observedUtc: new Date().toISOString(), label: `${family.checkpoints.at(-1)} (${phase})`, processes, ...evidence }, null, 2));
  expect(evidence.allChoicesValid).toBe(true); expect(evidence.allBonusRowsOwned).toBe(true);
  expect(Object.values(evidence.orderBijections).every(value => value === true)).toBe(true);
  expect(evidence.parentOrderRevisionEqual).toBe(true); expect(evidence.capsRemaining).toBe(0); expect(evidence.writerReadiness).toBe(0);
  expect(evidence.classGate).toBe(false); expect(evidence.hitDieGate).toBe(false); expect(evidence.servicePrivateUsage).toBe(false);
  expect(evidence.ordinaryClassListsValid).toBe(true); expect(evidence.fiendFreeSpellRows).toBe(0);
  return evidence;
}

async function begin(page: Page, context: BrowserContext, info: TestInfo, className: string, familyName: string): Promise<Family> {
  const config = await settings(), blockedOrigins: string[] = [], pageErrors: string[] = [];
  const allowed = new Set([config.appOrigin, config.supabaseOrigin]);
  await context.route("**/*", route => {
    const origin = new URL(route.request().url()).origin;
    if (!allowed.has(origin)) { blockedOrigins.push(origin); return route.abort(); }
    return route.continue();
  });
  page.on("pageerror", () => pageErrors.push("browser error"));
  console.log(JSON.stringify({ workerPid: process.pid, parentPid: process.ppid, cwd: process.cwd(),
    startedUtc: new Date().toISOString(), story: familyName }));
  try {
    await page.goto(config.appOrigin + "/login");
    await page.getByLabel("Email", { exact: true }).fill(config.owner.email);
    await page.getByLabel("Password", { exact: true }).fill(config.owner.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(config.appOrigin + "/dashboard", { timeout: 60000 });
  } catch {
    await page.close();
    throw Error("Actual local sign-in failed; credentials withheld");
  }
  expect((await context.cookies()).some(cookie => cookie.name.startsWith("sb-"))).toBe(true);
  await page.locator('a[href="/characters/new"]').first().click();
  const name = `SRD ${className} choices ${randomUUID().slice(0, 8)}`;
  await page.getByRole("textbox", { name: "What will they be called?" }).fill(name);
  await page.getByRole("button", { name: "Open the notebook", exact: true }).click();
  await page.waitForURL(/\/characters\/[0-9a-f-]+\/builder\/first-class$/);
  const characterId = new URL(page.url()).pathname.split("/")[2];
  const family: Family = { family: familyName, characterId, name, config, blockedOrigins, pageErrors, checkpoints: [],
    builderUrl: `${config.appOrigin}/characters/${characterId}/builder/class`, sheetUrl: `${config.appOrigin}/characters/${characterId}` };
  await checkpoint(info, family, "created through authenticated app");
  await page.getByRole("combobox", { name: "First class", exact: true }).selectOption({ label: className });
  await page.getByRole("button", { name: "Save first class", exact: true }).click();
  await expect(page.getByText(`${className} · Level 1`, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(`${className} · Level 1`, { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Complete class choices", exact: true }).click();
  await openLevel(page, 1);
  return family;
}

async function abilities(page: Page, family: Family, scores: Record<string, string>) {
  await page.goto(`${family.config.appOrigin}/characters/${family.characterId}/builder/abilities`);
  for (const [ability, score] of Object.entries(scores)) {
    await saveThroughApp(page, () => page.getByRole("combobox", { name: `${ability} score`, exact: true }).selectOption(score));
    await expect(page.getByText("Changes save automatically.", { exact: true })).toBeVisible();
  }
  await page.reload();
  for (const [ability, score] of Object.entries(scores)) await expect(page.getByRole("combobox", { name: `${ability} score`, exact: true })).toHaveValue(score);
  await page.goto(family.builderUrl);
}

async function pickSpell(form: Locator, name: string, checked = true, cantrip = false) {
  const searches = form.getByRole("textbox");
  await (cantrip ? searches.first() : searches.last()).fill(name);
  await form.getByRole("checkbox", { name: `Select ${name}`, exact: true }).setChecked(checked);
}
async function saveSpells(page: Page, form: Locator) {
  const button = form.getByRole("button", { name: "Save spells", exact: true });
  await expect(button).toBeEnabled(); await saveThroughApp(page, () => button.click());
  await expect(form.getByText("Spell choices saved.", { exact: true })).toBeVisible(); await expect(button).toBeEnabled();
}
async function sheetSpells(page: Page, family: Family, present: string[], absent: string[] = []) {
  await page.goto(family.sheetUrl); await page.reload(); await page.getByRole("button", { name: "Spells", exact: true }).click();
  for (const name of present) await expect(page.getByText(name, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  for (const name of absent) await expect(page.getByText(name, { exact: true }).filter({ visible: true })).toHaveCount(0);
}

test("Fiend expanded spells use ordinary budgets and save reload across all five tiers", async ({ page, context }, info) => {
  const family = await begin(page, context, info, "Warlock", "fiend-expanded-list");
  await choose(page, page.getByRole("button", { name: /^Fiend(?:\s|$)/ }));
  await abilities(page, family, { Strength: "8", Dexterity: "14", Constitution: "13", Intelligence: "12", Wisdom: "10", Charisma: "15" });
  const panel = page.getByRole("form", { name: "Warlock spell choices", exact: true });
  await expect(panel.getByText("Spells known: 0 / 2", { exact: true })).toBeVisible();
  await panel.getByRole("textbox").last().fill("Command");
  await expect(panel.getByRole("checkbox", { name: "Select Command", exact: true })).toBeEnabled();
  await panel.getByRole("textbox").last().fill("Fireball");
  await expect(panel.getByRole("checkbox", { name: "Select Fireball", exact: true })).toHaveCount(0);
  await checkpoint(info, family, "patron expands earned options without granting free known or prepared spells");
  for (const name of ["Eldritch Blast", "Mage Hand"]) await pickSpell(panel, name, true, true);
  for (const name of ["Burning Hands", "Charm Person"]) await pickSpell(panel, name);
  await pickSpell(panel, "Command");
  await expect(panel.getByRole("button", { name: "Save spells", exact: true })).toBeDisabled();
  await pickSpell(panel, "Command", false); await saveSpells(page, panel);
  const selected = ["Burning Hands", "Charm Person"];
  for (const [level, names] of [[3, ["Blindness/Deafness", "Scorching Ray"]], [5, ["Fireball", "Stinking Cloud"]],
    [7, ["Fire Shield", "Wall of Fire"]], [9, ["Flame Strike", "Hallow"]]] as const) {
    await setLevel(page, "Warlock", level);
    for (const name of names) { await pickSpell(panel, name); selected.push(name); }
    await saveSpells(page, panel); await page.reload();
    for (const name of names) { await panel.getByRole("textbox").last().fill(name); await expect(panel.getByRole("checkbox", { name: `Select ${name}`, exact: true })).toBeChecked(); }
  }
  await expect(panel.getByText("Spells known: 10 / 10", { exact: true })).toBeVisible();
  await sheetSpells(page, family, [...selected, "Eldritch Blast", "Mage Hand"], ["Command"]);
  await expect(page.getByText("Ordinary Spells Known: 10/10", { exact: true }).filter({ visible: true })).toBeVisible();
  await checkpoint(info, family, "all five Fiend tiers save reload inside ten ordinary known places with no free grants");
  await page.goto(family.builderUrl); await setLevel(page, "Warlock", 1); await page.reload();
  await sheetSpells(page, family, ["Burning Hands", "Charm Person", "Eldritch Blast", "Mage Hand"], selected.slice(2));
  await page.goto(family.builderUrl); await openLevel(page, 1);
  await saveThroughApp(page, () => page.getByRole("button", { name: "Clear subclass", exact: true }).click());
  await page.reload();
  await sheetSpells(page, family, ["Charm Person", "Eldritch Blast", "Mage Hand"], ["Burning Hands", ...selected.slice(2)]);
  await checkpoint(info, family, "level and patron loss prune only expanded choices and preserve ordinary Warlock spells", true);
});

async function addCleric(page: Page) {
  await page.getByRole("button", { name: /^Add a class/ }).click();
  await page.getByRole("button", { name: /^Cleric\s/ }).click();
  await saveThroughApp(page, () => page.getByRole("button", { name: "Pick this class", exact: true }).click());
  await expect(page.getByRole("combobox", { name: "Set level for Cleric", exact: true })).toHaveValue("1");
}
test("added class removal retains starting class and re-adds a fresh occurrence", async ({ page, context }, info) => {
  const family = await begin(page, context, info, "Fighter", "secondary-class-removal");
  await abilities(page, family, { Strength: "15", Dexterity: "12", Constitution: "13", Intelligence: "8", Wisdom: "14", Charisma: "10" });
  await setLevel(page, "Fighter", 4); await openLevel(page, 3);
  await choose(page, page.getByRole("button", { name: /^Champion(?:\s|$)/ }));
  await openLevel(page, 4); await choose(page, page.getByRole("button", { name: "STR +2", exact: true }));
  await expect(page.getByRole("button", { name: "Remove Fighter", exact: true })).toHaveCount(0);
  await addCleric(page);
  const clericRail = page.getByRole("combobox", { name: "Set level for Cleric", exact: true }).locator("..").locator("..").locator("..");
  await clericRail.getByRole("button", { name: /^Level 1:/ }).click();
  await choose(page, page.getByRole("button", { name: /^Life(?:\s|$)/ }));
  await setLevel(page, "Cleric", 2);
  const panel = page.getByRole("form", { name: "Cleric spell choices", exact: true });
  for (const name of ["Guidance", "Resistance", "Sacred Flame"]) await pickSpell(panel, name, true, true);
  for (const name of ["Command", "Guiding Bolt"]) await pickSpell(panel, name);
  await saveSpells(page, panel); await page.reload();
  await sheetSpells(page, family, ["Guidance", "Resistance", "Sacred Flame", "Command", "Guiding Bolt", "Bless", "Cure Wounds"]);
  await page.goto(family.builderUrl);
  await checkpoint(info, family, "Fighter four and Life Cleric two with selected and domain spells saved");
  const before = await nativeReadback(info, family, "before-removal");
  const oldCleric = before.occurrences.find((entry: { classSlug: string; lifecycle: string }) => entry.classSlug === "cleric" && entry.lifecycle === "accepted");
  const original = before.originalOccurrenceId;
  const retainedPinIds = before.pins.filter((pin: { context: Record<string, string>; kind: string; slug: string }) => pin.kind === "class" && pin.slug === "fighter" || pin.context.class === "fighter").map((pin: { id: string }) => pin.id);
  const stale = await context.newPage(); await stale.goto(family.builderUrl);
  page.once("dialog", dialog => dialog.accept());
  await saveThroughApp(page, () => page.getByRole("button", { name: "Remove Cleric", exact: true }).click());
  await expect(page.getByRole("combobox", { name: "Set level for Cleric", exact: true })).toHaveCount(0);
  stale.once("dialog", dialog => dialog.accept());
  await stale.getByRole("button", { name: "Remove Cleric", exact: true }).click();
  await expect(stale.getByText(/could not be confirmed/).first()).toBeVisible(); await stale.close();
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Set level for Fighter", exact: true })).toHaveValue("4");
  await expect(page.getByRole("button", { name: "Remove Fighter", exact: true })).toHaveCount(0);
  const removed = await nativeReadback(info, family, "after-removal");
  expect(removed.originalOccurrenceId).toBe(original);
  expect(removed.occurrences.find((entry: { id: string }) => entry.id === oldCleric.id).lifecycle).toBe("ended");
  expect(removed.spells).toHaveLength(0);
  for (const id of retainedPinIds) expect(removed.pins.some((pin: { id: string }) => pin.id === id)).toBe(true);
  await page.goto(family.sheetUrl); await page.reload();
  await expect(page.getByRole("button", { name: "Roll Strength check", exact: true }).locator("p").last()).toHaveText("17");
  await expect(page.getByRole("button", { name: "HP tracker — click to heal or damage", exact: true })).toContainText("/32");
  await page.goto(family.builderUrl); await addCleric(page); await page.reload();
  const readded = await nativeReadback(info, family, "after-readd");
  const newCleric = readded.occurrences.find((entry: { classSlug: string; lifecycle: string }) => entry.classSlug === "cleric" && entry.lifecycle === "accepted");
  expect(newCleric.id).not.toBe(oldCleric.id); expect(newCleric.controllerRefId).not.toBe(oldCleric.controllerRefId);
  expect(readded.originalOccurrenceId).toBe(original); expect(readded.spells).toHaveLength(0);
  for (const id of retainedPinIds) expect(readded.pins.some((pin: { id: string }) => pin.id === id)).toBe(true);
  await checkpoint(info, family, "secondary removal and fresh re-acquisition retain original role HP ASI pins and history", true);
});

