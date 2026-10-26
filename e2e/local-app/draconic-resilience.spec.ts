import { choiceOption, choiceGroup, optionPicked, pickOption, hpOption } from "./dropdown-helpers";
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { captureAncestryHpSource as captureSource } from "../../scripts/ancestry-hp-acceptance";

type Account = { id: string; email: string; password: string };
type Settings = { appOrigin: string; supabaseOrigin: string; owner: Account; other: Account };
type Draw = { operationId: string; actorId: string; occurrenceId: string; level: number; die: number; value: number; createdAt: string };
type Pin = { id: string; kind: string; slug: string; contentId: string; version: number; snapshotFingerprint: string };
type Item = { id: string; slug: string; name: string; version: number; contentId: string; equipped: boolean; quantity: number; startingGrantId: string; snapshotFingerprint: string };
type Native = {
  characterId: string; actorId: string; level: number; actionRevision: string; maximumHp: number;
  baseScores: Record<string, number>; effectiveScores: Record<string, number>; hpRolls: Record<string, { method: string; value: number }>;
  graphFingerprint: string; originalOccurrenceId: string; sorcererOccurrenceId: string; sorcererLevel: number;
  subclassPinId: string; subclassContentId: string; subclassVersion: number; subclassHpBonus: number | null;
  subclassEffects: unknown[]; classRoots: Array<{ occurrenceId: string; controllerRefId: string; slug: string; level: number; contentId: string; version: number }>;
  pins: Pin[]; hpDraws: Draw[]; inventory: Item[]; startingAwards: unknown[]; receiptCount: number; progressionHistoryCount: number;
  oldControl: { characterId: string; actorId: string; maximumHp: number; subclassVersion: number; fingerprint: string };
  catalog: { definitions: number; versions: number; draconic: { contentId: string; version: number };
    draconicSnapshots: Array<{ version: number; fingerprint: string; hpBonus: number | null; effects: unknown[] }>;
    resilienceSnapshots: Array<{ version: number; fingerprint: string }> };
  checks: Record<string, boolean>;
};
type Story = { config: Settings; controlId: string; snapshots: Array<{ label: string; path: string; data: Native }>;
  blockedOrigins: string[]; pageErrors: string[]; checkpoints: string[] };
const sorcererScores = { Strength: "8", Dexterity: "13", Constitution: "14", Intelligence: "12", Wisdom: "10", Charisma: "15" };
const armorScores = { Strength: "13", Dexterity: "14", Constitution: "15", Intelligence: "8", Wisdom: "10", Charisma: "12" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function configuration(): Promise<Settings> {
  const file = process.env.INKBORNE_LOCAL_FLOW_CONFIG;
  if (!file) throw Error("Provide the isolated local browser configuration file");
  const config = JSON.parse(await readFile(file, "utf8")) as Settings;
  for (const origin of [config.appOrigin, config.supabaseOrigin]) {
    const url = new URL(origin);
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.origin !== origin) throw Error("Explicit loopback origins required");
  }
  for (const account of [config.owner, config.other]) if (!account?.email || !account.password || !uuid.test(account.id)) throw Error("Disposable accounts required");
  if (config.owner.id === config.other.id) throw Error("Distinct disposable accounts required");
  return config;
}
async function restrictOrigins(context: BrowserContext, story: Story) {
  const allowed = new Set([story.config.appOrigin, story.config.supabaseOrigin]);
  await context.route("**/*", route => {
    const origin = new URL(route.request().url()).origin;
    if (!allowed.has(origin)) { story.blockedOrigins.push(origin); return route.abort(); }
    return route.continue();
  });
}
async function login(page: Page, config: Settings, account: Account) {
  try {
    await page.goto(config.appOrigin + "/login");
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(config.appOrigin + "/dashboard");
  } catch { await page.close(); throw Error("Actual local sign-in failed; credentials withheld"); }
}
async function save(page: Page, change: () => Promise<unknown>) {
  const pathname = new URL(page.url()).pathname;
  const [response] = await Promise.all([page.waitForResponse(item => item.request().method() === "POST" && new URL(item.url()).pathname === pathname), change()]);
  expect(response.status()).toBe(200);
}
async function choose(page: Page, option: Locator) {
  if (!await optionPicked(option)) await save(page, () => pickOption(option));
  await expect(option).toHaveJSProperty("selected", true); await expect(option).toBeEnabled();
}
const base = (story: Story, id: string) => `${story.config.appOrigin}/characters/${id}/builder`;
async function openLevel(page: Page, level: number) {
  await page.getByRole("button", { name: new RegExp(`^Level ${level}:`) }).click();
  await expect(page.locator('section[aria-labelledby="class-level-title"]').getByRole("navigation", { name: "Breadcrumb", exact: true })).toContainText(`Level ${level}`);
}
function group(page: Page, title: string, option?: string) {
  const article = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title, exact: true, level: 4 }) });
  return option ? article.filter({ has: choiceOption(page, option) }) : article;
}
async function humanAndAbilities(page: Page, story: Story, id: string, scores: Record<string, string>) {
  await page.goto(base(story, id) + "/race");
  await page.getByRole("combobox", { name: "Choose Race", exact: true }).selectOption({ label: "Human" });
  await save(page, () => page.getByRole("button", { name: "Add Race", exact: true }).click());
  await expect(page.getByRole("button", { name: "Change Race", exact: true })).toBeVisible();
  await choose(page, choiceOption(choiceGroup(page, "Choose 1 language"), "Dwarvish"));
  await page.goto(base(story, id) + "/abilities");
  for (const [ability, score] of Object.entries(scores)) {
    const control = page.getByRole("combobox", { name: `${ability} score`, exact: true });
    if (await control.inputValue() === score) continue;
    // Release an occupied standard-array value through ordinary saved app edits.
    for (const other of Object.keys(scores)) if (other !== ability) {
      const occupied = page.getByRole("combobox", { name: `${other} score`, exact: true });
      if (await occupied.inputValue() === score) {
        await save(page, () => occupied.selectOption(""));
        await expect(page.getByText("Changes save automatically.", { exact: true })).toBeVisible();
      }
    }
    await save(page, () => control.selectOption(score));
    await expect(page.getByText("Changes save automatically.", { exact: true })).toBeVisible();
  }
  await page.reload();
  for (const [ability, score] of Object.entries(scores)) await expect(page.getByRole("combobox", { name: `${ability} score`, exact: true })).toHaveValue(score);
}
async function create(page: Page, story: Story, first: "Sorcerer" | "Fighter", label: string) {
  await page.goto(story.config.appOrigin + "/characters/new");
  await page.getByRole("textbox", { name: "What will they be called?" }).fill(`Draconic ${label} ${randomUUID().slice(0, 8)}`);
  await page.getByRole("button", { name: "Open the notebook", exact: true }).click();
  await page.waitForURL(/\/characters\/[0-9a-f-]+\/builder\/first-class$/);
  const id = new URL(page.url()).pathname.split("/")[2]; expect(id).toMatch(uuid);
  await page.getByRole("combobox", { name: "First class", exact: true }).selectOption({ label: first });
  await page.getByRole("button", { name: "Save first class", exact: true }).click();
  await expect(page.getByText(`${first} · Level 1`, { exact: true })).toBeVisible();
  await page.reload(); await page.getByRole("link", { name: "Complete class choices", exact: true }).click(); await openLevel(page, 1);
  for (const skill of first === "Sorcerer" ? ["Arcana", "Persuasion"] : ["Athletics", "Perception"]) {
    await choose(page, choiceOption(group(page, "Choose 2 proficiency"), skill));
  }
  if (first === "Fighter") await choose(page, choiceOption(page, /^Archery(?:\s|$)/));
  else await draconicOptions(page);
  await humanAndAbilities(page, story, id, first === "Sorcerer" ? sorcererScores : armorScores);
  return id;
}
async function draconicOptions(page: Page) {
  await choose(page, choiceOption(page, /^Draconic(?:\s|$)/));
  await choose(page, choiceOption(group(page, "Choose 1 feature"), /^Dragon Ancestor Gold(?:\s|$)/));
}
async function setSorcererLevel(page: Page, story: Story, id: string, level: number) {
  await page.goto(base(story, id) + "/class");
  const control = page.getByRole("combobox", { name: "Set level for Sorcerer", exact: true });
  await save(page, () => control.selectOption(String(level))); await expect(control).toHaveValue(String(level)); await expect(control).toBeEnabled();
}
async function average(page: Page, level: number) {
  await openLevel(page, level);
  const option = hpOption(page, "average");
  await save(page, () => pickOption(option)); await expect(option).toHaveJSProperty("selected", true); await expect(option).toBeEnabled();
}
async function levelThree(page: Page, story: Story, id: string) {
  await setSorcererLevel(page, story, id, 3); await openLevel(page, 3);
  for (const name of ["Metamagic Quickened Spell", "Metamagic Subtle Spell"]) await choose(page, choiceOption(group(page, "Choose 2 feature"), name));
  await average(page, 2); await average(page, 3);
}
async function inspectClass(page: Page, story: Story, id: string, hp: number, ac: number) {
  await page.goto(base(story, id) + "/class");
  const stats = page.getByRole("heading", { name: "Stats", exact: true }).locator("..");
  await expect(stats.getByText("Hit Point Maximum", { exact: true }).locator("..").locator("span").last()).toHaveText(String(hp));
  await expect(stats.getByText("Armor Class", { exact: true }).locator("..").locator("span").last()).toHaveText(String(ac));
}
async function inspectSheet(page: Page, story: Story, id: string, hp: number, ac: number) {
  await page.goto(`${story.config.appOrigin}/characters/${id}`);
  await sheetStats(page, hp, ac);
}
async function sheetStats(page: Page, hp: number, ac: number) {
  await expect(page.getByRole("button", { name: "HP tracker — click to heal or damage", exact: true })).toContainText(`/${hp}`);
  await expect(page.getByText("AC", { exact: true }).filter({ visible: true }).first().locator("..").locator("p").last()).toHaveText(String(ac));
}
async function checkpoint(info: TestInfo, story: Story, label: string) {
  story.checkpoints.push(label);
  await writeFile(info.outputPath("draconic-progress.json"), JSON.stringify({ observedUtc: new Date().toISOString(), actualApp: true,
    controlId: story.controlId, checkpoints: story.checkpoints, blockedOrigins: story.blockedOrigins, pageErrors: story.pageErrors }, null, 2));
}
async function readback(info: TestInfo, story: Story, id: string, label: string): Promise<Native> {
  const file = process.env.INKBORNE_LOCAL_FLOW_CONFIG;
  if (!file || !uuid.test(id) || !uuid.test(story.controlId)) throw Error("Local native evidence configuration required");
  const state = JSON.parse(await readFile(resolve(dirname(file), "../state.json"), "utf8"));
  if (state.project !== "inkborne-app-flow-20261022" || state.ready !== true || state.stoppedUtc) throw Error("Wrong disposable runtime");
  const db = state.containers.find((item: { name: string }) => item.name === `/${state.project}-db`);
  if (!db || !/^[a-f0-9]{64}$/.test(db.id)) throw Error("Missing owned database identity");
  const processes: unknown[] = [];
  const run = (args: string[], input?: string) => {
    const startedUtc = new Date().toISOString();
    const result = spawnSync("C:/Users/kaios/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe", ["--context", "desktop-linux", ...args],
      { input, encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 });
    processes.push({ pid: result.pid, parentPid: process.pid, cwd: process.cwd(), args, startedUtc, finishedUtc: new Date().toISOString(), exitCode: result.status });
    if (result.status !== 0) throw Error("Owned read-only native evidence failed; inspect the task receipt");
    return result.stdout.trim();
  };
  expect(run(["info", "--format", "{{.ID}}"])).toBe(state.engineId);
  const actual = JSON.parse(run(["inspect", "--format", '{"id":{{json .Id}},"labels":{{json .Config.Labels}},"status":{{json .State.Status}}}', db.id]));
  expect(actual.id).toBe(db.id); expect(actual.labels["com.docker.compose.project"]).toBe(state.project); expect(actual.status).toBe("running");
  const sql = await readFile(resolve(process.cwd(), "supabase/verification/draconic-resilience-readback.sql"), "utf8");
  const data = JSON.parse(run(["exec", "-i", db.id, "psql", "-X", "--no-password", "--host", "/var/run/postgresql", "--username", "supabase_admin",
    "--dbname", "postgres", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--set", `character_id=${id}`, "--set", `control_id=${story.controlId}`, "--file", "-"], sql)) as Native;
  const path = info.outputPath(`native-draconic-${story.snapshots.length + 1}-${label}.json`);
  await writeFile(path, JSON.stringify({ observedUtc: new Date().toISOString(), label, processes, ...data }, null, 2));
  story.snapshots.push({ label, path, data });
  expect(data.characterId).toBe(id); expect(data.actorId).toBe(story.config.owner.id);
  expect(data.oldControl.characterId).toBe(story.controlId); expect(data.oldControl.actorId).toBe(story.config.owner.id);
  const checks = ["oneOwnedTargetAndOldControl", "oneEarnedDraconicSorcerer", "exactSelectedClassRoots", "originalProofAndCurrentRoles",
    "exactFrozenSubclassOwner", "everyPinHasExactSrdSnapshot", "humanStandardArray", "drawsBindOriginalReceipts", "inventoryFromAcceptedStartingAward",
    "fiveOrderBijections", "parentOrderRevision", "boundariesClosed"];
  expect(Object.keys(data.checks).sort()).toEqual([...checks].sort());
  for (const check of checks) expect(data.checks[check], `${label}: ${check}`).toBe(true);
  return data;
}
function sameSources(left: Native, right: Native) {
  expect(right.originalOccurrenceId).toBe(left.originalOccurrenceId); expect(right.sorcererOccurrenceId).toBe(left.sorcererOccurrenceId);
  expect(right.subclassPinId).toBe(left.subclassPinId); expect(right.subclassContentId).toBe(left.subclassContentId);
  expect(right.subclassVersion).toBe(left.subclassVersion); expect(right.catalog).toEqual(left.catalog);
}
async function publish(info: TestInfo, story: Story) {
  const file = process.env.INKBORNE_LOCAL_FLOW_CONFIG!;
  const helper = resolve(dirname(file), "../draconic-resilience-control.mjs"), startedUtc = new Date().toISOString();
  const result = spawnSync(process.execPath, ["--import", "tsx", helper, "publish-corrected", story.controlId],
    { cwd: process.cwd(), encoding: "utf8", windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024 });
  await writeFile(info.outputPath("draconic-publication-process.json"), JSON.stringify({ pid: result.pid, parentPid: process.pid, cwd: process.cwd(), helper,
    startedUtc, finishedUtc: new Date().toISOString(), exitCode: result.status }, null, 2));
  if (result.status !== 0) throw Error("Guarded Draconic publication failed; inspect its local fixture receipt");
  const resultLine = result.stdout.trim().split(/\r?\n/).at(-1);
  expect(JSON.parse(resultLine ?? "null")).toMatchObject({ onlyChangedIdentity: "subclass/draconic", draconicVersion: 2,
    characterRowsUnchanged: true, historicalSnapshotsPreserved: true });
}
async function armorControl(page: Page, story: Story) {
  const id = await create(page, story, "Fighter", "native armor control");
  await page.goto(base(story, id) + "/background");
  await page.getByRole("combobox", { name: "Choose Background", exact: true }).selectOption({ label: "Acolyte" });
  await save(page, () => page.getByRole("button", { name: "Add Background", exact: true }).click());
  await expect(page.getByRole("button", { name: "Change Background", exact: true })).toBeVisible();
  const languages = choiceGroup(page, "Choose 2 language");
  for (const name of ["Celestial", "Elvish"]) await choose(page, choiceOption(languages, name));
  await page.goto(base(story, id) + "/equipment");
  const groups = page.getByRole("group").filter({ has: page.locator('select option[value="a"]') });
  await expect(groups.first()).toBeVisible();
  for (let index = 0; index < await groups.count(); index++) {
    const leather = choiceOption(groups.nth(index), /leather/i);
    await choose(page, await leather.count() ? leather : groups.nth(index).locator('select option[value="a"]'));
  }
  const slots = page.locator('button[data-slot="select-trigger"]');
  for (let index = 0; index < await slots.count(); index++) {
    const slot = slots.nth(index); await slot.click(); await expect(page.getByRole("listbox")).toBeVisible();
    const sword = page.getByRole("option", { name: "Longsword", exact: true });
    const option = await sword.count() ? sword : page.getByRole("option").first();
    await save(page, () => pickOption(option));
    await expect(slot).toBeEnabled();
  }
  await expect(page.getByRole("button", { name: "Confirm Equipment", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Confirm Equipment", exact: true }).click();
  await expect(page.getByText("Starting equipment award recorded", { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText("Starting equipment award recorded", { exact: true })).toBeVisible();
  await page.goto(base(story, id) + "/class");
  await page.getByRole("button", { name: /^Add a class/ }).click();
  await page.getByRole("combobox", { name: "Choose an additional class", exact: true }).selectOption({ label: "Sorcerer" });
  await save(page, () => page.getByRole("button", { name: "Pick this class", exact: true }).click());
  const rail = page.getByRole("combobox", { name: "Set level for Sorcerer", exact: true }).locator("..").locator("..").locator("..");
  await expect(rail.getByRole("combobox")).toHaveValue("1"); await rail.getByRole("button", { name: /^Level 1:/ }).click();
  await draconicOptions(page);
  const average = hpOption(page, "average");
  await save(page, () => pickOption(average)); await expect(average).toHaveJSProperty("selected", true); await expect(average).toBeEnabled();
  return id;
}
async function equipLeather(page: Page, equipped: boolean) {
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  // InventoryRow's visible title is the actual equip control; scope to the
  // Armor & Shields section so the Equipped summary cannot duplicate the row.
  const section = page.getByRole("button", { name: /^Armor & Shields/ }).locator("..");
  const row = section.getByText("Leather Armor", { exact: true }).locator("..").locator("..").locator("..");
  const toggle = row.getByTitle(equipped ? "Equip" : "Unequip", { exact: true });
  const [response] = await Promise.all([page.waitForResponse(item => item.request().method() === "PATCH" && new URL(item.url()).pathname === "/rest/v1/character_inventory"), toggle.click()]);
  expect(response.ok()).toBe(true);
  await expect(row.getByTitle(equipped ? "Unequip" : "Equip", { exact: true })).toBeVisible();
}
async function otherAccount(browser: Browser, story: Story, ids: string[]) {
  const context = await browser.newContext(); await restrictOrigins(context, story);
  try {
    const page = await context.newPage(); page.on("pageerror", () => story.pageErrors.push("other-account browser error"));
    await login(page, story.config, story.config.other);
    for (const id of ids) {
      const response = await page.goto(`${story.config.appOrigin}/characters/${id}`);
      expect(response?.status()).toBe(404);
    }
  } finally { await context.close(); }
}

test("new Draconic mechanics preserve historical pins, one raw HP draw and native awarded armor parity", async ({ page, context, browser }, info) => {
  test.setTimeout(360000);
  const runId = process.env.INKBORNE_LOCAL_FLOW_RUN_ID;
  if (!runId || !uuid.test(runId)) throw Error("Use the bounded draconic-app wrapper");
  const source = captureSource(process.cwd());
  const story: Story = { config: await configuration(), controlId: "", snapshots: [], blockedOrigins: [], pageErrors: [], checkpoints: [] };
  await restrictOrigins(context, story); page.on("pageerror", () => story.pageErrors.push("owner browser error"));
  console.log(JSON.stringify({ workerPid: process.pid, parentPid: process.ppid, cwd: process.cwd(), startedUtc: new Date().toISOString(), story: "Draconic immutable HP and AC" }));
  await login(page, story.config, story.config.owner); expect((await context.cookies()).some(cookie => cookie.name.startsWith("sb-"))).toBe(true);
  story.controlId = await create(page, story, "Sorcerer", "old v1 control"); await levelThree(page, story, story.controlId);
  await inspectClass(page, story, story.controlId, 20, 12); await inspectSheet(page, story, story.controlId, 20, 12); await page.reload();
  await sheetStats(page, 20, 12);
  const old = await readback(info, story, story.controlId, "old-v1-before-publication");
  expect(old.subclassVersion).toBe(1); expect(old.subclassHpBonus).toBeNull(); expect(old.maximumHp).toBe(20); expect(old.hpDraws).toEqual([]);
  expect(old.catalog.draconic.version).toBe(1); expect(old.catalog.draconicSnapshots).toHaveLength(1); expect(old.catalog.definitions).toBe(1535); expect(old.catalog.versions).toBe(1536);
  await checkpoint(info, story, "genuine old-v1 Sorcerer control saved and read");
  await publish(info, story);
  const published = await readback(info, story, story.controlId, "v2-publication-old-control-unchanged");
  expect(published.oldControl).toEqual(old.oldControl); expect(published.pins).toEqual(old.pins); expect(published.graphFingerprint).toBe(old.graphFingerprint);
  expect(published.catalog.draconic).toEqual({ contentId: old.subclassContentId, version: 2 });
  expect(published.catalog.definitions).toBe(1535); expect(published.catalog.versions).toBe(1537);
  expect(published.catalog.draconicSnapshots).toHaveLength(2); expect(published.catalog.draconicSnapshots[0]).toEqual(old.catalog.draconicSnapshots[0]);
  expect(published.catalog.draconicSnapshots[1].hpBonus).toBe(1); expect(published.catalog.resilienceSnapshots).toEqual(old.catalog.resilienceSnapshots);
  await inspectClass(page, story, story.controlId, 20, 12); await inspectSheet(page, story, story.controlId, 20, 12);
  await checkpoint(info, story, "atomic Draconic-only publication preserved old root, feature and character");

  const id = await create(page, story, "Sorcerer", "new v2"); await levelThree(page, story, id);
  await inspectClass(page, story, id, 23, 15); await inspectSheet(page, story, id, 23, 15); await page.reload();
  await sheetStats(page, 23, 15);
  const initial = await readback(info, story, id, "new-v2-average");
  expect(initial.maximumHp).toBe(23); expect(initial.subclassVersion).toBe(2); expect(initial.subclassHpBonus).toBe(1);
  expect(initial.subclassEffects).toContainEqual({ type: "mechanical", stat: "armor_class", op: "formula", expr: "13 + mod(dexterity)",
    tag: "ac_formula", condition: { field: "equipped_armor", op: "eq", value: "none" } });
  expect(initial.effectiveScores).toMatchObject({ dexterity: 14, constitution: 15 }); expect(initial.hpDraws).toEqual([]);
  expect(initial.baseScores).toEqual(Object.fromEntries(Object.entries(sorcererScores).map(([ability, score]) => [ability.toLowerCase(), Number(score)])));
  expect(initial.originalOccurrenceId).toBe(initial.sorcererOccurrenceId); expect(initial.classRoots).toHaveLength(1);
  await page.goto(base(story, id) + "/class"); await openLevel(page, 2);
  const roll = hpOption(page, "rolled");
  await save(page, () => pickOption(roll)); await expect(roll).toHaveJSProperty("selected", true); await expect(roll).toBeEnabled();
  const rolled = await readback(info, story, id, "new-v2-server-roll");
  expect(rolled.hpDraws).toHaveLength(1); const draw = rolled.hpDraws[0];
  expect(draw).toMatchObject({ actorId: story.config.owner.id, occurrenceId: initial.sorcererOccurrenceId, level: 2, die: 6 });
  expect(draw.value).toBeGreaterThanOrEqual(1); expect(draw.value).toBeLessThanOrEqual(6);
  expect(rolled.hpRolls["sorcerer-2"]).toEqual({ method: "rolled", value: draw.value }); expect(rolled.maximumHp).toBe(19 + draw.value); sameSources(initial, rolled);
  await page.reload(); await openLevel(page, 2); await expect(roll).toHaveJSProperty("selected", true); await expect(roll).toContainText(`(+${draw.value + 2})`);
  await average(page, 2); await save(page, () => pickOption(roll)); await expect(roll).toBeEnabled();
  const reused = await readback(info, story, id, "same-draw-after-average-and-reselection");
  expect(reused.hpDraws).toEqual(rolled.hpDraws); expect(reused.hpRolls["sorcerer-2"]).toEqual(rolled.hpRolls["sorcerer-2"]); expect(reused.maximumHp).toBe(19 + draw.value);
  await inspectClass(page, story, id, 19 + draw.value, 15); await inspectSheet(page, story, id, 19 + draw.value, 15);
  await setSorcererLevel(page, story, id, 2); await inspectClass(page, story, id, 12 + draw.value, 15);
  const down = await readback(info, story, id, "downlevel-two");
  expect(down.maximumHp).toBe(12 + draw.value); expect(down.hpDraws).toEqual(rolled.hpDraws); expect(down.hpRolls["sorcerer-2"]).toEqual(rolled.hpRolls["sorcerer-2"]); sameSources(initial, down);
  await setSorcererLevel(page, story, id, 3); await average(page, 3);
  const restored = await readback(info, story, id, "restored-three");
  expect(restored.maximumHp).toBe(19 + draw.value); expect(restored.hpDraws).toEqual(rolled.hpDraws); sameSources(initial, restored);
  await average(page, 2); await inspectClass(page, story, id, 23, 15); await inspectSheet(page, story, id, 23, 15); await page.reload();
  await sheetStats(page, 23, 15);
  const final = await readback(info, story, id, "averages-restored-draw-retained");
  expect(final.maximumHp).toBe(23); expect(final.hpDraws).toEqual(rolled.hpDraws); expect(final.oldControl).toEqual(old.oldControl);
  await checkpoint(info, story, "new-root 23HP AC15 and one immutable d6 survive reload, reselection and down/up progression");

  const armorId = await armorControl(page, story); await inspectClass(page, story, armorId, 21, 15); await inspectSheet(page, story, armorId, 21, 15);
  const bare = await readback(info, story, armorId, "fighter-original-sorcerer-secondary-native-armor-award");
  expect(bare.effectiveScores).toMatchObject({ dexterity: 15, constitution: 16, charisma: 13, strength: 14 });
  expect(bare.maximumHp).toBe(21); expect(bare.originalOccurrenceId).not.toBe(bare.sorcererOccurrenceId); expect(bare.classRoots).toHaveLength(2);
  expect(bare.classRoots.map(root => ({ slug: root.slug, level: root.level }))).toEqual([{ slug: "fighter", level: 1 }, { slug: "sorcerer", level: 1 }]);
  expect(bare.subclassVersion).toBe(2); expect(bare.subclassHpBonus).toBe(1); expect(bare.hpDraws).toEqual([]);
  expect(bare.classRoots.find(root => root.slug === "fighter")?.occurrenceId).toBe(bare.originalOccurrenceId);
  expect(bare.startingAwards).toHaveLength(1); expect(bare.inventory.filter(item => item.slug === "leather-armor")).toHaveLength(1);
  expect(bare.inventory.every(item => !item.equipped)).toBe(true);
  await equipLeather(page, true); await inspectSheet(page, story, armorId, 21, 13); await page.reload(); await sheetStats(page, 21, 13); await inspectClass(page, story, armorId, 21, 13);
  const armored = await readback(info, story, armorId, "leather-equipped-sheet-class-reload"); sameSources(bare, armored);
  expect(armored.maximumHp).toBe(21); expect(armored.hpDraws).toEqual(bare.hpDraws);
  expect(armored.inventory).toEqual(bare.inventory.map(item => item.slug === "leather-armor" ? { ...item, equipped: true } : item));
  await inspectSheet(page, story, armorId, 21, 13); await equipLeather(page, false);
  await inspectSheet(page, story, armorId, 21, 15); await page.reload(); await sheetStats(page, 21, 15); await inspectClass(page, story, armorId, 21, 15);
  const unequipped = await readback(info, story, armorId, "leather-unequipped-sheet-class-reload");
  expect(unequipped.inventory).toEqual(bare.inventory); expect(unequipped.hpDraws).toEqual(bare.hpDraws); expect(unequipped.oldControl).toEqual(old.oldControl); sameSources(bare, unequipped);
  await otherAccount(browser, story, [story.controlId, id, armorId]); expect(story.blockedOrigins).toEqual([]); expect(story.pageErrors).toEqual([]);
  await checkpoint(info, story, "native awarded armor switches AC15 to13 to15 without changing HP, draw, pins or order; foreign account404");
  const path = info.outputPath("draconic-resilience-workflow.json");
  expect(captureSource(process.cwd())).toEqual(source);
  await writeFile(path, JSON.stringify({ actualApp: true, actualAuthCookies: true, actualPostgrest: true, uiWritesOnly: true,
    source, runId,
    oldControlId: story.controlId, newSorcererId: id, armorControlId: armorId, rawDraw: draw,
    independent2014Expectations: { oldLevel3Hp: 20, newLevel3Hp: 23, rolledLevel3Hp: 19 + draw.value,
      rolledLevel2Hp: 12 + draw.value, fighter1Sorcerer1Hp: 21, unarmoredAc: 15, leatherAc: 13 },
    checkpoints: story.checkpoints, snapshots: story.snapshots, blockedOrigins: story.blockedOrigins, pageErrors: story.pageErrors }, null, 2));
  await info.attach("draconic-resilience-workflow", { path, contentType: "application/json" });
});
