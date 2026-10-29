import { choiceOption, choiceGroup, optionPicked, pickOption, hpOption } from "./dropdown-helpers";
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { nativeJson, testRuntime } from "../../scripts/unraid/native";

type Account = { id: string; email: string; password: string };
type Settings = { appOrigin: string; supabaseOrigin: string; owner: Account; other: Account };
type Story = {
  id: "A1" | "A2" | "A3"; first: "Rogue" | "Monk" | "Fighter"; race: string; subrace?: string;
  scores: Record<string, string>; effective: Record<string, number>; initialSkills: string[];
  hp: number; ac: number; speed: number; saves: string[]; skills: string[]; expertise: string[];
  tools: string[]; languages: string[]; features: string[]; inventory: string[];
};
// Independent 2014 acceptance values from the reviewed A1–A3 matrix. These do
// not use the application's score, HP, AC, acquisition or progression planners.
const stories: Story[] = [
  { id: "A1", first: "Rogue", race: "Halfling", subrace: "Lightfoot Halfling",
    scores: { Strength: "10", Dexterity: "15", Constitution: "14", Intelligence: "12", Wisdom: "13", Charisma: "8" },
    effective: { Strength: 10, Dexterity: 17, Constitution: 14, Intelligence: 12, Wisdom: 13, Charisma: 9 },
    initialSkills: ["Acrobatics", "Perception", "Sleight Of Hand", "Stealth"], hp: 24, ac: 14, speed: 25,
    saves: ["Dexterity", "Intelligence"], skills: ["Acrobatics", "Perception", "Sleight of Hand", "Stealth", "Insight", "Religion"],
    expertise: ["Perception", "Stealth"], tools: ["Thieves Tools"], languages: ["Common", "Halfling", "Celestial", "Elvish"],
    features: ["Naturally Stealthy", "Expertise", "Sneak Attack", "Thieves' Cant", "Cunning Action", "Fast Hands", "Second-Story Work"],
    inventory: ["Rapier", "Leather Armor", "Dagger", "Thieves' Tools"] },
  { id: "A2", first: "Monk", race: "Gnome", subrace: "Rock Gnome",
    scores: { Strength: "12", Dexterity: "15", Constitution: "13", Intelligence: "8", Wisdom: "14", Charisma: "10" },
    effective: { Strength: 12, Dexterity: 15, Constitution: 14, Intelligence: 10, Wisdom: 14, Charisma: 10 },
    initialSkills: ["Acrobatics", "Stealth"], hp: 24, ac: 14, speed: 35, saves: ["Strength", "Dexterity"],
    skills: ["Acrobatics", "Stealth", "Insight", "Religion"], expertise: [], tools: ["Smiths Tools", "Tinkers Tools"],
    languages: ["Common", "Gnomish", "Celestial", "Elvish"],
    features: ["Gnome Cunning", "Artificer's Lore", "Tinker", "Martial Arts", "Ki", "Deflect Missiles", "Open Hand Technique"],
    inventory: ["Dart"] },
  { id: "A3", first: "Fighter", race: "Half-Orc",
    scores: { Strength: "15", Dexterity: "14", Constitution: "13", Intelligence: "8", Wisdom: "12", Charisma: "10" },
    effective: { Strength: 17, Dexterity: 14, Constitution: 14, Intelligence: 8, Wisdom: 12, Charisma: 10 },
    initialSkills: ["Athletics", "Perception"], hp: 33, ac: 13, speed: 30, saves: ["Strength", "Constitution"],
    skills: ["Athletics", "Perception", "Stealth", "Intimidation", "Insight", "Religion"], expertise: ["Athletics"],
    tools: ["Thieves Tools (Expertise)"], languages: ["Common", "Orc", "Celestial", "Elvish"],
    features: ["Menacing", "Relentless Endurance", "Second Wind", "Expertise", "Thieves' Cant", "Cunning Action", "Fast Hands", "Second-Story Work"],
    inventory: ["Leather Armor", "Longsword"] },
];
type Native = {
  evidenceKind: string; caseId: string; characterId: string; actorId: string; level: number; actionRevision: string;
  graphFingerprint: string; completeFingerprint: string; originalOccurrenceId: string;
  independent2014Expected: { maximumHp: number; armorClass: number; speed: number; baseScores: Record<string, number>; effectiveScores: Record<string, number> };
  observed: { maximumHp: number; baseScores: Record<string, number>; effectiveScores: Record<string, number>; roles: Record<string, unknown>; choices: Record<string, unknown> };
  inventory: Array<{ id: string; slug: string; equipped: boolean; startingGrantId: string }>;
  pins: Array<Record<string, unknown>>; checks: Record<string, boolean>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const nativeChecks = ["oneExpectedCharacter", "exactOriginalAndSecondaryProvenance", "expectedClassesAndSubclass", "allPinnedVersionsExact",
  "exactAncestryAndTraitOwners", "standardArrayAndAncestryScores", "allExpectedChoicesExact", "allRequiredFeaturesPresent",
  "roleProficienciesAndExpertise", "explicitAverageHpRecords", "maximumHpMatches2014", "noSpellRows", "oneOriginalEquipmentAward",
  "inventoryFromAcceptedStartingAward", "detailsConfirmed", "ownedOrdinaryReceipts", "ownedProgressionHistory", "fiveOrderBijections", "currentParentAndRoleOrder", "boundariesClosed"];

async function settings(): Promise<Settings> {
  const runtime = process.env.INKBORNE_TEST_RUNTIME ? testRuntime() : undefined;
  const file = runtime ? process.env.INKBORNE_TEST_CONFIG : process.env.INKBORNE_LOCAL_FLOW_CONFIG;
  if (!file) throw Error("Provide the isolated local browser configuration file");
  let config: Settings;
  try { config = JSON.parse(await readFile(file, "utf8")) as Settings; }
  catch { throw Error("Restricted browser configuration unavailable; contents withheld"); }
  if (runtime && (file !== "/run/inkborne/test-config.json" || config.appOrigin !== "http://127.0.0.1:3001"
    || config.supabaseOrigin !== "http://127.0.0.1:9999")) throw Error("Dedicated scratch-test origins and configuration required");
  for (const origin of [config.appOrigin, config.supabaseOrigin]) {
    const url = new URL(origin);
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.origin !== origin) throw Error("Explicit loopback origins required");
  }
  for (const account of [config.owner, config.other]) if (!account?.email || !account.password || !uuid.test(account.id)) throw Error("Disposable verification accounts required");
  if (config.owner.id === config.other.id) throw Error("Distinct disposable accounts required");
  return config;
}
async function restrictOrigins(context: BrowserContext, config: Settings, blocked: string[]) {
  const allowed = new Set([config.appOrigin, config.supabaseOrigin]);
  await context.route("**/*", route => {
    const origin = new URL(route.request().url()).origin;
    if (!allowed.has(origin)) { blocked.push(origin); return route.abort(); }
    return route.continue();
  });
}
async function login(page: Page, config: Settings, account: Account) {
  try {
    await page.goto(config.appOrigin + "/login");
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(config.appOrigin + "/dashboard", { timeout: 60000 });
  } catch { await page.close(); throw Error("Actual local sign-in failed; credentials withheld"); }
}
async function save(page: Page, change: () => Promise<unknown>) {
  const pathname = new URL(page.url()).pathname;
  const [response] = await Promise.all([page.waitForResponse(item => item.request().method() === "POST" && new URL(item.url()).pathname === pathname), change()]);
  expect(response.status(), "Actual app save before the next edit").toBe(200);
}
async function choose(page: Page, option: Locator) {
  if (!await optionPicked(option)) await save(page, () => pickOption(option));
  await expect(option).toHaveJSProperty("selected", true); await expect(option).toBeEnabled();
}
function group(page: Page, label: string, option?: string) {
  const article = page.getByRole("article").filter({ has: page.getByRole("heading", { name: label, exact: true, level: 4 }) });
  return option ? article.filter({ has: page.locator("option").filter({ hasText: new RegExp(`^${option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }) }) : article;
}
async function openLevel(page: Page, level: number, className?: string) {
  const rail = className ? page.getByRole("combobox", { name: `Set level for ${className}`, exact: true }).locator("..").locator("..").locator("..") : page;
  await rail.getByRole("button", { name: new RegExp(`^Level ${level}:`) }).click();
  await expect(page.locator('section[aria-labelledby="class-level-title"]').getByRole("navigation", { name: "Breadcrumb", exact: true })).toContainText(`Level ${level}`);
}
async function ancestryAbilitiesBackground(page: Page, base: string, story: Story) {
  await page.goto(base + "/race");
  await page.getByRole("combobox", { name: "Choose Race", exact: true }).selectOption({ label: story.race });
  await save(page, () => page.getByRole("button", { name: "Add Race", exact: true }).click());
  await expect(page.getByRole("button", { name: "Change Race", exact: true })).toBeVisible();
  if (story.subrace) {
    await save(page, () => page.getByRole("combobox", { name: "Subrace", exact: true }).selectOption({ label: story.subrace }));
    await expect(page.getByRole("button", { name: "Change Subrace", exact: true })).toBeVisible();
  }
  await page.reload({ waitUntil: "domcontentloaded" }); await expect(page.getByRole("button", { name: "Change Race", exact: true })).toBeVisible();
  if (story.subrace) await expect(page.getByRole("button", { name: "Change Subrace", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next: Abilities", exact: true }).click();
  for (const [ability, score] of Object.entries(story.scores)) {
    const control = page.getByRole("combobox", { name: `${ability} score`, exact: true });
    if (await control.inputValue() === score) continue;
    for (const other of Object.keys(story.scores)) if (other !== ability) {
      const occupied = page.getByRole("combobox", { name: `${other} score`, exact: true });
      if (await occupied.inputValue() === score) {
        await save(page, () => occupied.selectOption(""));
        await expect(page.getByText("Changes save automatically.", { exact: true })).toBeVisible();
      }
    }
    await save(page, () => control.selectOption(score));
    await expect(page.getByText("Changes save automatically.", { exact: true })).toBeVisible();
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  for (const [ability, score] of Object.entries(story.scores)) await expect(page.getByRole("combobox", { name: `${ability} score`, exact: true })).toHaveValue(score);
  await page.getByRole("button", { name: "Next: Background", exact: true }).click();
  await page.getByRole("combobox", { name: "Choose Background", exact: true }).selectOption({ label: "Acolyte" });
  await save(page, () => page.getByRole("button", { name: "Add Background", exact: true }).click());
  const languages = choiceGroup(page, "Choose 2 language");
  for (const name of ["Celestial", "Elvish"]) await choose(page, choiceOption(languages, name));
  await save(page, () => pickOption(choiceOption(page, "Nothing can shake my optimistic attitude.")));
  await page.reload({ waitUntil: "domcontentloaded" });
  for (const name of ["Celestial", "Elvish"]) await expect(choiceOption(languages, name)).toHaveJSProperty("selected", true);
}
async function awardEquipment(page: Page, base: string) {
  await page.goto(base + "/equipment");
  const groups = page.locator("select").filter({ has: page.locator('option[value="a"]') });
  await expect(groups.first()).toBeVisible();
  for (let index = 0; index < await groups.count(); index++) {
    const leather = groups.nth(index).locator("option").filter({ hasText: /leather/i });
    await choose(page, await leather.count() ? leather : groups.nth(index).locator('option[value="a"]'));
  }
  const slots = page.locator('button[data-slot="select-trigger"]');
  for (let index = 0; index < await slots.count(); index++) {
    const slot = slots.nth(index); await slot.click(); const menu = page.getByRole("listbox"); await expect(menu).toBeVisible();
    const sword = menu.getByRole("option", { name: "Longsword", exact: true });
    const option = await sword.count() ? sword : menu.getByRole("option").first();
    await save(page, () => pickOption(option));
    await expect(slot).toBeEnabled();
  }
  await expect(page.getByRole("button", { name: "Confirm Equipment", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Confirm Equipment", exact: true }).click();
  await expect(page.getByText("Starting equipment award recorded", { exact: true })).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" }); await expect(page.getByText("Starting equipment award recorded", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm Equipment", exact: true })).toHaveCount(0);
  await expect(page.getByRole("listitem").filter({ hasText: /^15 gp$/ })).toBeVisible();
}
async function completeClass(page: Page, base: string, story: Story) {
  await page.goto(base + "/class");
  if (story.id === "A3") {
    await page.getByRole("button", { name: /^Add a class/ }).click();
    await page.getByRole("combobox", { name: "Choose an additional class", exact: true }).selectOption({ label: "Rogue" });
    await save(page, () => page.getByRole("button", { name: "Pick this class", exact: true }).click());
    const rail = page.getByRole("combobox", { name: "Set level for Rogue", exact: true }).locator("..").locator("..").locator("..");
    await rail.getByRole("button", { name: /^Level 1:/ }).click();
    await choose(page, choiceOption(group(page, "Choose 1 proficiency", "Stealth"), "Stealth"));
    for (const name of ["Athletics", "Thieves Tools"]) await choose(page, choiceOption(group(page, "Choose 2 expertise"), name));
  }
  const className = story.id === "A2" ? "Monk" : "Rogue";
  const level = page.getByRole("combobox", { name: `Set level for ${className}`, exact: true });
  await save(page, () => level.selectOption("3")); await expect(level).toHaveValue("3"); await expect(level).toBeEnabled();
  await openLevel(page, 3, className);
  await choose(page, choiceOption(page, story.id === "A2" ? /^Open Hand(?:\s|$)/ : /^Thief(?:\s|$)/));
  for (const value of story.id === "A3" ? [1, 2, 3] : [2, 3]) {
    await openLevel(page, value, className);
    const average = hpOption(page, "average");
    await save(page, () => pickOption(average)); await expect(average).toHaveJSProperty("selected", true); await expect(average).toBeEnabled();
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(level).toHaveValue("3"); await expect(level).toBeEnabled();
  await expect(page.getByRole("navigation", { name: "Character builder", exact: true }).locator('a[href$="/builder/class"]')).toContainText("Saved");
}
async function details(page: Page, base: string, name: string) {
  await page.goto(base + "/details");
  await page.getByRole("textbox", { name: "Character name", exact: true }).fill(name);
  await page.getByRole("combobox", { name: "Alignment", exact: true }).selectOption("Neutral Good");
  await save(page, () => page.getByRole("button", { name: "Save details", exact: true }).click());
  await expect(page.getByText("Character details saved.", { exact: true })).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" }); await expect(page.getByRole("textbox", { name: "Character name", exact: true })).toHaveValue(name);
  const nav = page.getByRole("navigation", { name: "Character builder", exact: true });
  for (const step of ["class", "race", "abilities", "background", "equipment", "details"]) await expect(nav.locator(`a[href$="/builder/${step}"]`)).toContainText("Saved");
}
async function equipAwardedLeather(page: Page, config: Settings) {
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  const section = page.getByRole("button", { name: /^Armor & Shields \(\d+\)$/ }).locator("..");
  const row = section.getByText("Leather Armor", { exact: true }).locator("..").locator("..").locator("..");
  await expect(row.getByTitle("Equip", { exact: true })).toBeVisible();
  const [response] = await Promise.all([page.waitForResponse(item => item.request().method() === "PATCH"
    && item.url().startsWith(config.supabaseOrigin + "/rest/v1/character_inventory")), row.getByTitle("Equip", { exact: true }).click()]);
  expect(response.ok()).toBe(true); await expect(row.getByTitle("Unequip", { exact: true })).toBeVisible();
}
async function inspectSheet(page: Page, story: Story, name: string) {
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  for (const [ability, value] of Object.entries(story.effective)) await expect(page.getByRole("button", { name: `Roll ${ability} check`, exact: true }).locator("p").last()).toHaveText(String(value));
  await expect(page.getByRole("button", { name: "HP tracker — click to heal or damage", exact: true })).toContainText(`/${story.hp}`);
  await expect(page.getByText("AC", { exact: true }).filter({ visible: true }).first().locator("..").locator("p").last()).toHaveText(String(story.ac));
  await expect(page.getByText("SPEED", { exact: true }).filter({ visible: true }).first().locator("..").locator("p").last()).toHaveText(`${story.speed}ft`);
  for (const ability of ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"]) {
    const proficient = page.getByRole("button", { name: `Roll ${ability} saving throw`, exact: true }).getByLabel("Proficient", { exact: true });
    if (story.saves.includes(ability)) await expect(proficient).toBeVisible(); else await expect(proficient).toHaveCount(0);
  }
  for (const skill of story.skills) await expect(page.getByRole("button", { name: `Roll ${skill} check`, exact: true }).getByLabel(story.expertise.includes(skill) ? "Expertise" : "Proficient", { exact: true })).toBeVisible();
  const tools = page.getByText("Tools", { exact: true }).filter({ visible: true }).locator("..");
  for (const tool of story.tools) await expect(tools).toContainText(tool);
  const languages = page.getByText("Languages", { exact: true }).filter({ visible: true }).locator("..");
  for (const language of story.languages) await expect(languages).toContainText(language);
  if (story.id === "A2") {
    await expect(page.getByRole("button", { name: "Use one Ki", exact: true }).filter({ visible: true }).first().locator("..")).toContainText("3/3");
    const defenses = page.getByRole("heading", { name: "Defenses", exact: true }).locator("..");
    for (const ability of ["Intelligence", "Wisdom", "Charisma"]) await expect(defenses).toContainText(`${ability} saves vs magic`);
  }
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "GP amount", exact: true })).toHaveValue("15");
  for (const item of story.inventory) await expect(page.getByText(item, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Features", exact: true }).click();
  for (const feature of [...story.features, "Shelter of the Faithful"]) await expect(page.getByText(feature, { exact: true }).filter({ visible: true }).first()).toBeVisible();
}
async function readback(info: TestInfo, config: Settings, story: Story, id: string, label: string): Promise<Native> {
  if (!uuid.test(id)) throw Error("Native character identity required");
  const runtime = process.env.INKBORNE_TEST_RUNTIME ? testRuntime() : undefined;
  const readers = ["complete-martial-builders-readback.sql", "builder-class-choices-readback.sql"];
  const reports: Record<string, Record<string, unknown>> = {};
  const processes: unknown[] = [];
  if (runtime) {
    for (const reader of readers) {
      const sql = await readFile(resolve(process.cwd(), "supabase/verification", reader), "utf8");
      reports[reader] = await nativeJson(sql, { character_id: id, case_id: story.id }) as Record<string, unknown>;
    }
  } else {
    const file = process.env.INKBORNE_LOCAL_FLOW_CONFIG;
    if (!file) throw Error("Local native evidence configuration required");
    const state = JSON.parse(await readFile(resolve(dirname(file), "../state.json"), "utf8"));
    if (state.project !== "inkborne-app-flow-20261022" || state.ready !== true || state.stoppedUtc) throw Error("Wrong disposable runtime");
    const db = state.containers.find((item: { name: string }) => item.name === `/${state.project}-db`);
    if (!db || !/^[a-f0-9]{64}$/.test(db.id)) throw Error("Missing owned database identity");
    const run = (args: string[], input?: string) => {
      const startedUtc = new Date().toISOString();
      const result = spawnSync("C:/Users/kaios/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe", ["--context", "desktop-linux", ...args],
        { cwd: process.cwd(), input, encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
      processes.push({ pid: result.pid, parentPid: process.pid, cwd: process.cwd(), args, startedUtc, finishedUtc: new Date().toISOString(), exitCode: result.status });
      if (result.status !== 0) throw Error("Owned read-only martial evidence failed; raw output withheld");
      return result.stdout.trim();
    };
    expect(run(["info", "--format", "{{.ID}}"])).toBe(state.engineId);
    const identity = JSON.parse(run(["inspect", "--format", '{"id":{{json .Id}},"labels":{{json .Config.Labels}},"status":{{json .State.Status}}}', db.id]));
    expect(identity.id).toBe(db.id); expect(identity.labels["com.docker.compose.project"]).toBe(state.project); expect(identity.status).toBe("running");
    for (const reader of readers) {
      const sql = await readFile(resolve(process.cwd(), "supabase/verification", reader), "utf8");
      reports[reader] = JSON.parse(run(["exec", "-i", db.id, "psql", "-X", "--no-password", "--host", "/var/run/postgresql", "--username", "supabase_admin",
        "--dbname", "postgres", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--set", `character_id=${id}`, "--set", `case_id=${story.id}`, "--file", "-"], sql));
    }
  }
  const report = reports["complete-martial-builders-readback.sql"] as unknown as Native;
  const path = info.outputPath(`complete-martial-native-${label}.json`);
  await writeFile(path, JSON.stringify({ observedUtc: new Date().toISOString(), label, runtime, processes, reports }, null, 2));
  await info.attach(`native-${label}`, { path, contentType: "application/json" });
  expect(report.evidenceKind).toBe("read_only_after_complete_actual_app_martial_builder"); expect(report.caseId).toBe(story.id);
  expect(report.characterId).toBe(id); expect(report.actorId).toBe(config.owner.id); expect(report.level).toBe(story.id === "A3" ? 4 : 3);
  expect(Object.keys(report.checks).sort()).toEqual([...nativeChecks].sort());
  for (const key of nativeChecks) expect(report.checks[key], `${label}: ${key}`).toBe(true);
  expect(report.observed.maximumHp).toBe(story.hp); expect(report.independent2014Expected.maximumHp).toBe(story.hp);
  expect(report.independent2014Expected.armorClass).toBe(story.ac); expect(report.independent2014Expected.speed).toBe(story.speed);
  const lower = (values: Record<string, number | string>) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key.toLowerCase(), Number(value)]));
  expect(report.observed.baseScores).toEqual(lower(story.scores)); expect(report.observed.effectiveScores).toEqual(lower(story.effective));
  const family = reports["builder-class-choices-readback.sql"];
  for (const key of ["all_pinned_versions_exact", "feature_grants_exact", "physical_feature_grant_links_exact", "active_feature_projections_exact", "spell_grants_exact",
    "active_spell_grants_projected", "all_choice_checks", "all_child_checks", "all_favored_checks", "all_five_order_bijections", "all_boundaries_closed"]) expect(family[key], key).toBe(true);
  return report;
}
async function rejectOtherAccount(browser: Browser, config: Settings, sheet: string, blocked: string[], errors: string[]) {
  const context = await browser.newContext();
  try {
    await restrictOrigins(context, config, blocked); const page = await context.newPage(); page.on("pageerror", () => errors.push("other-account browser error"));
    await login(page, config, config.other); const response = await page.goto(sheet);
    expect(response?.status()).toBe(404); await expect(page.getByText("This page could not be found.", { exact: true })).toBeVisible();
  } finally { await context.close(); }
}

for (const story of stories) test(`complete martial ${story.id} ${story.race} ${story.first} finishes all six steps and reloads`, async ({ page, context, browser }, info) => {
  test.setTimeout(480000);
  const config = await settings(), runtime = process.env.INKBORNE_TEST_RUNTIME ? testRuntime() : undefined, blocked: string[] = [], errors: string[] = [], checkpoints: string[] = [];
  await restrictOrigins(context, config, blocked); page.on("pageerror", () => errors.push("owner browser error"));
  console.log(JSON.stringify({ workerPid: process.pid, parentPid: process.ppid, cwd: process.cwd(), startedUtc: new Date().toISOString(), story: story.id }));
  await login(page, config, config.owner); expect((await context.cookies()).some(cookie => cookie.name.startsWith("sb-"))).toBe(true);
  await page.goto(config.appOrigin + "/characters/new");
  const name = `Complete martial ${story.id} ${randomUUID().slice(0, 8)}`;
  await page.getByRole("textbox", { name: "What will they be called?" }).fill(name);
  await page.getByRole("button", { name: "Open the notebook", exact: true }).click();
  await page.waitForURL(/\/characters\/[0-9a-f-]+\/builder\/first-class$/);
  const id = new URL(page.url()).pathname.split("/")[2]; expect(id).toMatch(uuid);
  const sheet = `${config.appOrigin}/characters/${id}`, base = sheet + "/builder";
  const checkpoint = async (label: string) => {
    checkpoints.push(label);
    await writeFile(info.outputPath("complete-martial-progress.json"), JSON.stringify({ observedUtc: new Date().toISOString(), runtime, actualApp: true,
      caseId: story.id, characterId: id, name, checkpoints, blockedOrigins: blocked, pageErrors: errors }, null, 2));
  };
  await page.getByRole("combobox", { name: "First class", exact: true }).selectOption({ label: story.first });
  await page.getByRole("button", { name: "Save first class", exact: true }).click();
  await expect(page.getByText(`${story.first} · Level 1`, { exact: true })).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" }); await page.getByRole("link", { name: "Complete class choices", exact: true }).click(); await openLevel(page, 1);
  for (const skill of story.initialSkills) await choose(page, choiceOption(group(page, `Choose ${story.initialSkills.length} proficiency`, story.initialSkills[0]), skill));
  if (story.id === "A1") for (const skill of story.expertise) await choose(page, choiceOption(group(page, "Choose 2 expertise"), skill));
  if (story.id === "A2") await choose(page, choiceOption(group(page, "Choose 1 proficiency", "Smiths Tools"), "Smiths Tools"));
  if (story.id === "A3") await choose(page, choiceOption(page, /^Dueling(?:\s|$)/));
  await checkpoint("genuine first class and starting proficiency choices saved");
  await ancestryAbilitiesBackground(page, base, story); await checkpoint("race, subrace, standard array and Acolyte saved and reloaded");
  // Award from the original Fighter before adding Rogue. Secondary acquisition
  // must preserve this exact award and cannot receive a second starting bundle.
  if (story.id === "A3") await awardEquipment(page, base);
  await completeClass(page, base, story); await checkpoint("level three subclass, eligible Expertise and explicit average HP saved");
  if (story.id !== "A3") await awardEquipment(page, base);
  else {
    await page.goto(base + "/equipment"); await expect(page.getByText("Starting equipment award recorded", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm Equipment", exact: true })).toHaveCount(0);
  }
  await details(page, base, name); await checkpoint("all six builder steps display Saved");
  const before = await readback(info, config, story, id, "builder-complete");
  await page.getByRole("button", { name: "Review & Finish", exact: true }).click();
  await page.getByRole("button", { name: "Finish & View Character", exact: true }).click(); await expect(page).toHaveURL(sheet);
  if (story.id !== "A2") await equipAwardedLeather(page, config);
  await inspectSheet(page, story, name);
  const equipped = await readback(info, config, story, id, "sheet-complete");
  expect(equipped.graphFingerprint).toBe(before.graphFingerprint); expect(equipped.originalOccurrenceId).toBe(before.originalOccurrenceId);
  expect(equipped.pins).toEqual(before.pins);
  const worn = equipped.inventory.filter(item => item.equipped);
  if (story.id === "A2") expect(worn).toEqual([]); else { expect(worn).toHaveLength(1); expect(worn[0].slug).toBe("leather-armor"); }
  await page.reload({ waitUntil: "domcontentloaded" }); await inspectSheet(page, story, name);
  const after = await readback(info, config, story, id, "sheet-reloaded"); expect(after).toEqual(equipped);
  await rejectOtherAccount(browser, config, sheet, blocked, errors);
  const foreign = await readback(info, config, story, id, "foreign-refused"); expect(foreign).toEqual(after);
  expect(blocked).toEqual([]); expect(errors).toEqual([]); await checkpoint("finished sheet reload and actual foreign-account 404 passed");
  await page.screenshot({ path: info.outputPath("complete-martial-sheet.png"), fullPage: true });
  const path = info.outputPath("complete-martial-workflow.json");
  await writeFile(path, JSON.stringify({ runtime, actualApp: true, actualAuthCookies: true, actualPostgrest: true, uiWritesOnly: true,
    caseId: story.id, characterId: id, name, firstClass: story.first, secondaryRogue: story.id === "A3", race: story.race, subrace: story.subrace ?? null,
    background: "Acolyte", allSixBuilderStepsSaved: true, completedSheetReloadPassed: true, foreignAccountRefused: true,
    independent2014Expectations: { baseScores: story.scores, effectiveScores: story.effective, maximumHp: story.hp, armorClass: story.ac,
      speed: story.speed, savingThrows: story.saves, expertiseSkills: story.expertise, kiCapacity: story.id === "A2" ? 3 : null },
    scope: "builder persistence, source provenance and passive sheet values; no combat or condition activation claim", blockedOrigins: blocked, pageErrors: errors }, null, 2));
  await info.attach("complete-martial-workflow", { path, contentType: "application/json" });
});
