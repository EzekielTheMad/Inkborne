import { choiceOption, pickOption, clearOption, setSpell, selectedSpell } from "./dropdown-helpers";
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
  await saveThroughApp(page, () => pickOption(option));
  await expect(option).toHaveJSProperty("selected", true);
  await expect(option).toBeEnabled();
}

function group(page: Page, label: string, option?: string): Locator {
  const article = page.getByRole("article").filter({ has: page.getByRole("heading", { name: label, exact: true, level: 4 }) });
  return option ? article.filter({ has: choiceOption(page, option) }) : article;
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

async function nativeReadback(info: TestInfo, family: Family) {
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
  const file = info.outputPath(`native-readback-${family.checkpoints.length}.json`);
  await writeFile(file, JSON.stringify({ observedUtc: new Date().toISOString(), label: family.checkpoints.at(-1), processes, ...evidence }, null, 2));
  expect(evidence.allChoicesValid).toBe(true); expect(evidence.allBonusRowsOwned).toBe(true);
  expect(Object.values(evidence.orderBijections).every(value => value === true)).toBe(true);
  expect(evidence.parentOrderRevisionEqual).toBe(true); expect(evidence.capsRemaining).toBe(0); expect(evidence.writerReadiness).toBe(0);
  expect(evidence.classGate).toBe(false); expect(evidence.hitDieGate).toBe(false); expect(evidence.servicePrivateUsage).toBe(false);
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

function bonusForm(page: Page, id: string) {
  return page.getByRole("form", { name: new RegExp(`: ${id}$`) });
}
async function pickSpell(form: Locator, name: string, checked = true) {
  await form.getByRole("textbox").last().fill(name);
  await setSpell(form, name, checked);
}
async function saveSpells(page: Page, form: Locator) {
  const save = form.getByRole("button", { name: /^Save / });
  await expect(save).toBeEnabled();
  await saveThroughApp(page, () => save.click());
  await expect(save).toBeEnabled();
}
async function bonus(page: Page, id: string, names: string[]) {
  const form = bonusForm(page, id);
  await expect(form).toBeVisible();
  for (const name of names) await pickSpell(form, name);
  await saveSpells(page, form);
}
async function reloadedBonus(page: Page, id: string, names: string[]) {
  const form = bonusForm(page, id);
  for (const name of names) {
    await form.getByRole("textbox").last().fill(name);
    await expect(selectedSpell(form, name)).toHaveCount(1);
  }
}
async function sheetSpells(page: Page, family: Family, present: string[], absent: string[] = []) {
  await page.goto(family.sheetUrl); await page.reload();
  await page.getByRole("button", { name: "Spells", exact: true }).click();
  for (const name of present) await expect(page.getByText(name, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  for (const name of absent) await expect(page.getByText(name, { exact: true }).filter({ visible: true })).toHaveCount(0);
}

test("bonus Bard Secrets budgets and Lore skills save reload and prune", async ({ page, context }, info) => {
  const family = await begin(page, context, info, "Bard", "bonus-bard-lore");
  for (const name of ["Arcana", "Perception", "Stealth"]) await choose(page, choiceOption(group(page, "Choose 3 proficiency", "Stealth"), name));
  await abilities(page, family, { Strength: "8", Dexterity: "14", Constitution: "13", Intelligence: "12", Wisdom: "10", Charisma: "15" });
  await setLevel(page, "Bard", 3); await openLevel(page, 3);
  await choose(page, choiceOption(page, /^Lore(?:\s|$)/));
  const lore = group(page, "Choose 3 proficiency", "Athletics");
  await expect(choiceOption(lore, "Arcana")).toHaveCount(0);
  for (const name of ["Athletics", "Medicine", "Nature"]) await choose(page, choiceOption(lore, name));
  await setLevel(page, "Bard", 18);
  const choices = { "additional-magical-secrets": ["Fireball", "Counterspell"], "magical-secrets-1": ["Guidance", "Bless"],
    "magical-secrets-2": ["Heal", "Disintegrate"], "magical-secrets-3": ["Wish", "Meteor Swarm"] };
  for (const [id, names] of Object.entries(choices)) await bonus(page, id, names);
  const ordinary = page.getByRole("form", { name: "Bard spell choices", exact: true });
  const names = ["Animal Friendship", "Animal Messenger", "Bane", "Bestow Curse", "Blindness/Deafness", "Calm Emotions", "Charm Person", "Clairvoyance", "Comprehend Languages", "Cure Wounds", "Detect Magic", "Detect Thoughts", "Disguise Self", "Dispel Magic", "Enhance Ability", "Enthrall"];
  for (const name of names) await pickSpell(ordinary, name);
  await expect(ordinary.getByRole("combobox", { name: "Add bard levelled spells", exact: true })).toHaveCount(0);
  await expect(ordinary.getByRole("button", { name: "Save spells", exact: true })).toBeEnabled();
  await saveSpells(page, ordinary);
  await page.reload();
  for (const [id, picks] of Object.entries(choices)) await reloadedBonus(page, id, picks);
  await openLevel(page, 3);
  for (const name of ["Athletics", "Medicine", "Nature"]) await expect(choiceOption(lore, name)).toHaveJSProperty("selected", true);
  await checkpoint(info, family, "all four Secrets groups and three Lore skills reloaded; ordinary allowance rejects seventeenth spell");
  await sheetSpells(page, family, Object.values(choices).flat());
  for (const name of ["Athletics", "Medicine", "Nature"]) await expect(page.getByRole("button", { name: `Roll ${name} check`, exact: true }).getByLabel("Proficient", { exact: true })).toBeVisible();
  await page.goto(family.builderUrl); await setLevel(page, "Bard", 5); await page.reload();
  for (const id of Object.keys(choices)) await expect(bonusForm(page, id)).toHaveCount(0);
  await sheetSpells(page, family, [], Object.values(choices).flat());
  await checkpoint(info, family, "level loss pruned unearned Secrets and retained earned Lore skill choices", true);
});

test("bonus Druid Land cantrip and conditional circle spells save reload and change", async ({ page, context }, info) => {
  const family = await begin(page, context, info, "Druid", "bonus-druid-land");
  await abilities(page, family, { Strength: "8", Dexterity: "14", Constitution: "13", Intelligence: "12", Wisdom: "15", Charisma: "10" });
  await setLevel(page, "Druid", 2); await openLevel(page, 2);
  await choose(page, choiceOption(page, /^Land(?:\s|$)/));
  await choose(page, choiceOption(group(page, "Choose 1 feature"), "Circle Of The Land Forest"));
  await bonus(page, "bonus-cantrip", ["Guidance"]);
  await setLevel(page, "Druid", 9); await page.reload();
  await reloadedBonus(page, "bonus-cantrip", ["Guidance"]);
  await sheetSpells(page, family, ["Guidance", "Barkskin", "Spider Climb", "Call Lightning", "Plant Growth", "Divination", "Freedom of Movement", "Commune With Nature", "Tree Stride"]);
  await checkpoint(info, family, "bonus cantrip and all four earned Forest spell tiers reloaded");
  await page.goto(family.builderUrl); await openLevel(page, 2);
  const terrain = group(page, "Choose 1 feature");
  await saveThroughApp(page, () => clearOption(choiceOption(terrain, "Circle Of The Land Forest")));
  await choose(page, choiceOption(terrain, "Circle Of The Land Coast"));
  await page.reload(); await reloadedBonus(page, "bonus-cantrip", ["Guidance"]);
  await sheetSpells(page, family, ["Guidance", "Mirror Image", "Misty Step", "Water Breathing", "Water Walk", "Control Water", "Freedom of Movement", "Conjure Elemental", "Scrying"], ["Spider Climb", "Tree Stride"]);
  await page.goto(family.builderUrl); await setLevel(page, "Druid", 1); await page.reload();
  await expect(bonusForm(page, "bonus-cantrip")).toHaveCount(0);
  await sheetSpells(page, family, [], ["Guidance", "Mirror Image", "Scrying"]);
  await checkpoint(info, family, "terrain change replaced conditional spells; subclass loss pruned bonus cantrip and grants", true);
});

test("bonus Warlock Tome rituals and four Arcanum choices save reload and prune", async ({ page, context }, info) => {
  const family = await begin(page, context, info, "Warlock", "bonus-warlock");
  await choose(page, choiceOption(page, /^Fiend(?:\s|$)/));
  await abilities(page, family, { Strength: "8", Dexterity: "14", Constitution: "13", Intelligence: "12", Wisdom: "10", Charisma: "15" });
  await setLevel(page, "Warlock", 17); await openLevel(page, 3);
  const pact = group(page, "Choose 1 feature");
  await choose(page, choiceOption(pact, "Pact Of The Tome"));
  await bonus(page, "pact-of-the-tome", ["Guidance", "Sacred Flame", "Shillelagh"]);
  await openLevel(page, 2);
  await choose(page, choiceOption(group(page, "Choose 7 invocation"), "Eldritch Invocation Book Of Ancient Secrets"));
  await bonus(page, "eldritch-invocation-book-of-ancient-secrets", ["Identify", "Find Familiar"]);
  const arcana = { "mystic-arcanum-6th-level": ["Mass Suggestion"], "mystic-arcanum-7th-level": ["Plane Shift"],
    "mystic-arcanum-8th-level": ["Demiplane"], "mystic-arcanum-9th-level": ["Foresight"] };
  for (const [id, names] of Object.entries(arcana)) await bonus(page, id, names);
  await page.reload();
  await reloadedBonus(page, "pact-of-the-tome", ["Guidance", "Sacred Flame", "Shillelagh"]);
  await reloadedBonus(page, "eldritch-invocation-book-of-ancient-secrets", ["Identify", "Find Familiar"]);
  for (const [id, names] of Object.entries(arcana)) await reloadedBonus(page, id, names);
  await sheetSpells(page, family, ["Guidance", "Sacred Flame", "Shillelagh", "Identify", "Find Familiar", ...Object.values(arcana).flat()]);
  await checkpoint(info, family, "Tome three cantrips, two rituals and all four Arcanum choices reloaded");
  await page.goto(family.builderUrl); await openLevel(page, 3);
  await saveThroughApp(page, () => clearOption(choiceOption(pact, "Pact Of The Tome")));
  await choose(page, choiceOption(pact, "Pact Of The Chain"));
  await page.reload();
  await expect(bonusForm(page, "pact-of-the-tome")).toHaveCount(0);
  await expect(bonusForm(page, "eldritch-invocation-book-of-ancient-secrets")).toHaveCount(0);
  for (const [id, names] of Object.entries(arcana)) await reloadedBonus(page, id, names);
  await setLevel(page, "Warlock", 10); await page.reload();
  for (const id of Object.keys(arcana)) await expect(bonusForm(page, id)).toHaveCount(0);
  await sheetSpells(page, family, [], ["Guidance", "Identify", "Find Familiar", ...Object.values(arcana).flat()]);
  await checkpoint(info, family, "pact loss pruned dependent cantrips and rituals; level loss pruned Arcanum", true);
});

test("bonus Wizard Mastery and Signature choices use saved book and reload", async ({ page, context }, info) => {
  const family = await begin(page, context, info, "Wizard", "bonus-wizard");
  await abilities(page, family, { Strength: "8", Dexterity: "14", Constitution: "13", Intelligence: "15", Wisdom: "12", Charisma: "10" });
  await setLevel(page, "Wizard", 20);
  const ordinary = page.getByRole("form", { name: "Wizard spell choices", exact: true });
  for (const name of ["Magic Missile", "Misty Step", "Fireball", "Counterspell"]) await pickSpell(ordinary, name);
  await saveSpells(page, ordinary);
  await bonus(page, "spell-mastery-1", ["Magic Missile"]);
  await bonus(page, "spell-mastery-2", ["Misty Step"]);
  await bonus(page, "signature-spell", ["Fireball", "Counterspell"]);
  await page.reload();
  for (const [id, names] of Object.entries({ "spell-mastery-1": ["Magic Missile"], "spell-mastery-2": ["Misty Step"], "signature-spell": ["Fireball", "Counterspell"] })) await reloadedBonus(page, id, names);
  await sheetSpells(page, family, ["Magic Missile", "Misty Step", "Fireball", "Counterspell"]);
  await checkpoint(info, family, "two Mastery choices and Signature pair reloaded from actual four-row spellbook");
  await page.goto(family.builderUrl);
  await pickSpell(ordinary, "Misty Step", false); await pickSpell(ordinary, "Fireball", false); await saveSpells(page, ordinary);
  await page.reload(); await reloadedBonus(page, "spell-mastery-1", ["Magic Missile"]);
  const mastery2 = bonusForm(page, "spell-mastery-2");
  await mastery2.getByRole("textbox").fill("Misty Step");
  await expect(choiceOption(mastery2, /^Misty Step —/)).toHaveCount(0);
  await setLevel(page, "Wizard", 17); await page.reload();
  for (const id of ["spell-mastery-1", "spell-mastery-2", "signature-spell"]) await expect(bonusForm(page, id)).toHaveCount(0);
  await sheetSpells(page, family, ["Magic Missile", "Counterspell"], ["Fireball", "Misty Step"]);
  await checkpoint(info, family, "book removal pruned dependent picks and level loss retained ordinary book rows", true);
});

