import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { captureAncestryHpSource } from "../../scripts/ancestry-hp-acceptance";

type Account = { id: string; email: string; password: string };
type Settings = { appOrigin: string; supabaseOrigin: string; owner: Account; other: Account };
type Draw = { operationId: string; actorId: string; occurrenceId: string; level: number; die: number; value: number; createdAt: string };
type Pin = { id: string; kind: string; slug: string; contentId: string; version: number; snapshotFingerprint: string };
type Native = {
  evidenceKind: string; characterId: string; actorId: string; level: number; actionRevision: string; maximumHp: number;
  independentMaximumHp: number; currentHp: number | null; hasStoredCurrentHp: boolean; baseScores: Record<string, number>; effectiveScores: Record<string, number>;
  originalOccurrenceId: string; barbarianOccurrenceId: string; classControllerRefId: string; subclassPinId: string | null;
  racePinId: string; subracePinId: string; subraceContentId: string; subraceVersion: number; ancestryHpBonus: number | null;
  hpRolls: Record<string, { method: string; value: number }>; hpDraws: Draw[]; pins: Pin[]; inventory: unknown[];
  graphFingerprint: string; completeFingerprint: string; receiptCount: number; progressionHistoryCount: number;
  oldControl: { characterId: string; actorId: string; maximumHp: number; subraceVersion: number; fingerprint: string };
  catalog: { definitions: number; versions: number; hillDwarf: { contentId: string; version: number };
    hillSnapshots: Array<{ version: number; fingerprint: string; hpBonus: number | null }>;
    toughnessSnapshots: Array<{ version: number; fingerprint: string }> };
  checks: Record<string, boolean>;
};
type Story = { config: Settings; controlId: string; snapshots: Array<{ label: string; path: string; data: Native }>;
  blockedOrigins: string[]; pageErrors: string[]; checkpoints: string[] };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const scores = { Strength: "15", Dexterity: "13", Constitution: "14", Intelligence: "8", Wisdom: "12", Charisma: "10" };
const effective = { strength: 15, dexterity: 13, constitution: 16, intelligence: 8, wisdom: 13, charisma: 10 };
const nativeChecks = ["oneOwnedTargetAndControl", "originalBarbarianProvenance", "exactSelectedAncestry", "allFrozenSrdPinsExact",
  "exactOwnedAncestryTraits", "standardArrayAndScores", "savedChoicesAndRequiredFeatures", "finiteSubclassAndHpRecords",
  "maximumHpMatchesIndependent2014", "drawsBindOriginalReceipts", "oneNativeStartingAward", "inventoryFromAcceptedAward",
  "noSpellsOrEquippedGear", "detailsConfirmed", "ownedReceiptsAndHistory", "fiveOrderBijections", "currentParentAndRoleOrder", "boundariesClosed"];

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
    await page.waitForURL(config.appOrigin + "/dashboard", { timeout: 60000 });
  } catch { await page.close(); throw Error("Actual local sign-in failed; credentials withheld"); }
}
async function save(page: Page, change: () => Promise<unknown>) {
  const pathname = new URL(page.url()).pathname;
  const [response] = await Promise.all([page.waitForResponse(item => item.request().method() === "POST" && new URL(item.url()).pathname === pathname), change()]);
  expect(response.status()).toBe(200);
}
async function choose(page: Page, option: Locator) {
  if (await option.getAttribute("aria-pressed") !== "true") await save(page, () => option.click());
  await expect(option).toHaveAttribute("aria-pressed", "true"); await expect(option).toBeEnabled();
}
function group(page: Page, title: string, option?: string) {
  const article = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title, exact: true, level: 4 }) });
  return option ? article.filter({ has: page.getByRole("button", { name: option, exact: true }) }) : article;
}
const builder = (story: Story, id: string) => `${story.config.appOrigin}/characters/${id}/builder`;
async function openLevel(page: Page, level: number) {
  await page.getByRole("button", { name: new RegExp(`^Level ${level}:`) }).click();
  await expect(page.locator('section[aria-labelledby="class-level-title"]').getByRole("navigation", { name: "Breadcrumb", exact: true })).toContainText(`Level ${level}`);
}
async function average(page: Page, level: number) {
  await openLevel(page, level);
  const option = page.getByRole("radio", { name: /^Average \(\+/ });
  await save(page, () => option.click()); await expect(option).toHaveAttribute("aria-checked", "true"); await expect(option).toBeEnabled();
}
async function setLevel(page: Page, story: Story, id: string, value: number) {
  await page.goto(builder(story, id) + "/class");
  const control = page.getByRole("combobox", { name: "Set level for Barbarian", exact: true });
  await save(page, () => control.selectOption(String(value))); await expect(control).toHaveValue(String(value)); await expect(control).toBeEnabled();
}
async function createComplete(page: Page, story: Story, label: string) {
  await page.goto(story.config.appOrigin + "/characters/new");
  const name = `Hill Toughness ${label} ${randomUUID().slice(0, 8)}`;
  await page.getByRole("textbox", { name: "What will they be called?" }).fill(name);
  await page.getByRole("button", { name: "Open the notebook", exact: true }).click();
  await page.waitForURL(/\/characters\/[0-9a-f-]+\/builder\/first-class$/);
  const id = new URL(page.url()).pathname.split("/")[2]; expect(id).toMatch(uuid);
  await page.getByRole("combobox", { name: "First class", exact: true }).selectOption({ label: "Barbarian" });
  await page.getByRole("button", { name: "Save first class", exact: true }).click();
  await expect(page.getByText("Barbarian · Level 1", { exact: true })).toBeVisible();
  await page.reload(); await page.getByRole("link", { name: "Complete class choices", exact: true }).click(); await openLevel(page, 1);
  for (const skill of ["Athletics", "Perception"]) await choose(page, group(page, "Choose 2 proficiency", "Athletics").getByRole("button", { name: skill, exact: true }));
  await page.goto(builder(story, id) + "/race");
  await page.getByRole("button", { name: "Preview Dwarf", exact: true }).click();
  await save(page, () => page.getByRole("button", { name: "Add Race", exact: true }).click());
  await expect(page.getByRole("button", { name: "Change Race", exact: true })).toBeVisible();
  await save(page, () => page.getByRole("button", { name: "Select Hill Dwarf", exact: true }).click());
  await expect(page.getByRole("button", { name: "Change Subrace", exact: true })).toBeVisible();
  const tool = page.getByText("Tool Proficiency: Choose 1", { exact: true }).locator("..").locator("..").getByRole("button", { name: "Smiths Tools", exact: true });
  await choose(page, tool);
  await page.reload();
  await expect(tool).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Next: Abilities", exact: true }).click();
  for (const [ability, score] of Object.entries(scores)) {
    const control = page.getByRole("combobox", { name: `${ability} score`, exact: true });
    if (await control.inputValue() === score) continue;
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
  await page.getByRole("button", { name: "Next: Background", exact: true }).click();
  await page.getByRole("button", { name: "Preview Acolyte", exact: true }).click();
  await save(page, () => page.getByRole("button", { name: "Add Background", exact: true }).click());
  const languages = page.getByText("Choose 2 language", { exact: true }).locator("..").locator("..");
  for (const language of ["Celestial", "Elvish"]) await choose(page, languages.getByRole("button", { name: language, exact: true }));
  await save(page, () => page.getByRole("button", { name: "Nothing can shake my optimistic attitude.", exact: true }).click());
  await setLevel(page, story, id, 3); await openLevel(page, 3);
  await choose(page, page.getByRole("button", { name: /^Berserker(?:\s|$)/ }));
  await average(page, 2); await average(page, 3);
  await page.goto(builder(story, id) + "/equipment");
  const groups = page.getByRole("group").filter({ has: page.getByRole("button", { name: /^\(a\)/ }) });
  await expect(groups.first()).toBeVisible();
  for (let index = 0; index < await groups.count(); index++) await choose(page, groups.nth(index).getByRole("button").first());
  const slots = page.getByRole("combobox");
  for (let index = 0; index < await slots.count(); index++) {
    const slot = slots.nth(index); await slot.click(); await expect(page.getByRole("listbox")).toBeVisible();
    await save(page, () => page.getByRole("option").first().click()); await expect(slot).toBeEnabled();
  }
  await expect(page.getByRole("button", { name: "Confirm Equipment", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Confirm Equipment", exact: true }).click();
  await expect(page.getByText("Starting equipment award recorded", { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText("Starting equipment award recorded", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm Equipment", exact: true })).toHaveCount(0);
  await page.goto(builder(story, id) + "/details");
  await page.getByRole("textbox", { name: "Character name", exact: true }).fill(name);
  await page.getByRole("combobox", { name: "Alignment", exact: true }).selectOption("Neutral Good");
  await save(page, () => page.getByRole("button", { name: "Save details", exact: true }).click());
  await expect(page.getByText("Character details saved.", { exact: true })).toBeVisible(); await page.reload();
  const nav = page.getByRole("navigation", { name: "Character builder", exact: true });
  for (const step of ["class", "race", "abilities", "background", "equipment", "details"]) await expect(nav.locator(`a[href$="/builder/${step}"]`)).toContainText("Saved");
  await page.getByRole("button", { name: "Review & Finish", exact: true }).click();
  await page.getByRole("button", { name: "Finish & View Character", exact: true }).click();
  await expect(page).toHaveURL(`${story.config.appOrigin}/characters/${id}`);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible(); return id;
}
async function inspectSheet(page: Page, story: Story, id: string, hp: number, level = 3) {
  await page.goto(`${story.config.appOrigin}/characters/${id}`);
  const tracker = page.getByRole("button", { name: "HP tracker — click to heal or damage", exact: true });
  await expect(tracker).toContainText(`/${hp}`);
  await expect(page.getByText("AC", { exact: true }).filter({ visible: true }).first().locator("..").locator("p").last()).toHaveText("14");
  await expect(page.getByText("SPEED", { exact: true }).filter({ visible: true }).first().locator("..").locator("p").last()).toHaveText("25ft");
  for (const [ability, value] of Object.entries(effective)) await expect(page.getByRole("button", { name: `Roll ${ability[0].toUpperCase() + ability.slice(1)} check`, exact: true }).locator("p").last()).toHaveText(String(value));
  await expect(page.getByRole("button", { name: "Use one Rage", exact: true }).filter({ visible: true }).first().locator("..")).toContainText(level === 3 ? "3/3" : "2/2");
  const tools = page.getByText("Tools", { exact: true }).filter({ visible: true }).locator(".."); await expect(tools).toContainText("Smiths Tools");
  await page.getByRole("button", { name: "Features", exact: true }).click();
  for (const feature of ["Dwarven Toughness", "Rage", "Unarmored Defense", "Reckless Attack", "Danger Sense", ...(level === 3 ? ["Frenzy"] : []), "Shelter of the Faithful"])
    await expect(page.getByText(feature, { exact: true }).filter({ visible: true }).first()).toBeVisible();
}
async function inspectClass(page: Page, story: Story, id: string, hp: number) {
  await page.goto(builder(story, id) + "/class");
  const stats = page.getByRole("heading", { name: "Stats", exact: true }).locator("..");
  await expect(stats.getByText("Hit Point Maximum", { exact: true }).locator("..").locator("span").last()).toHaveText(String(hp));
  await expect(stats.getByText("Armor Class", { exact: true }).locator("..").locator("span").last()).toHaveText("14");
}
async function checkpoint(info: TestInfo, story: Story, label: string) {
  story.checkpoints.push(label);
  await writeFile(info.outputPath("ancestry-hp-progress.json"), JSON.stringify({ observedUtc: new Date().toISOString(), actualApp: true,
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
      { cwd: process.cwd(), input, encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
    processes.push({ pid: result.pid, parentPid: process.pid, cwd: process.cwd(), args, startedUtc, finishedUtc: new Date().toISOString(), exitCode: result.status });
    if (result.status !== 0) throw Error("Owned read-only ancestry evidence failed; raw output withheld");
    return result.stdout.trim();
  };
  expect(run(["info", "--format", "{{.ID}}"])).toBe(state.engineId);
  const identity = JSON.parse(run(["inspect", "--format", '{"id":{{json .Id}},"labels":{{json .Config.Labels}},"status":{{json .State.Status}}}', db.id]));
  expect(identity.id).toBe(db.id); expect(identity.labels["com.docker.compose.project"]).toBe(state.project); expect(identity.status).toBe("running");
  const sql = await readFile(resolve(process.cwd(), "supabase/verification/ancestry-hit-points-readback.sql"), "utf8");
  const data = JSON.parse(run(["exec", "-i", db.id, "psql", "-X", "--no-password", "--host", "/var/run/postgresql", "--username", "supabase_admin",
    "--dbname", "postgres", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--set", `character_id=${id}`, "--set", `control_id=${story.controlId}`, "--file", "-"], sql)) as Native;
  const familySql = await readFile(resolve(process.cwd(), "supabase/verification/builder-class-choices-readback.sql"), "utf8");
  const family = JSON.parse(run(["exec", "-i", db.id, "psql", "-X", "--no-password", "--host", "/var/run/postgresql", "--username", "supabase_admin",
    "--dbname", "postgres", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--set", `character_id=${id}`, "--file", "-"], familySql)) as Record<string, unknown>;
  const path = info.outputPath(`native-ancestry-hp-${story.snapshots.length + 1}-${label}.json`);
  await writeFile(path, JSON.stringify({ observedUtc: new Date().toISOString(), label, processes, ...data, family }, null, 2)); story.snapshots.push({ label, path, data });
  expect(data.evidenceKind).toBe("read_only_after_actual_ancestry_hp_app_actions"); expect(data.characterId).toBe(id); expect(data.actorId).toBe(story.config.owner.id);
  expect(data.oldControl.characterId).toBe(story.controlId); expect(data.oldControl.actorId).toBe(story.config.owner.id); expect(data.oldControl.maximumHp).toBe(35);
  expect(Object.keys(data.checks).sort()).toEqual([...nativeChecks].sort()); for (const key of nativeChecks) expect(data.checks[key], `${label}: ${key}`).toBe(true);
  for (const key of ["all_pinned_versions_exact", "feature_grants_exact", "physical_feature_grant_links_exact", "active_feature_projections_exact",
    "spell_grants_exact", "all_spell_rows_exact", "active_spell_grants_projected", "all_choice_checks", "all_child_checks", "all_favored_checks",
    "all_five_order_bijections", "all_boundaries_closed"]) expect(family[key], `${label}: ${key}`).toBe(true);
  expect(data.maximumHp).toBe(data.independentMaximumHp);
  // These genuine builders start without stored current HP. Existing class
  // writes preserve that absence; sheet initialization may display the maximum.
  // The parent fence intentionally refuses unsealed sheet HP writes. Do not
  // seed state to claim actual-app coverage of the separate present-value clamp.
  expect(data.hasStoredCurrentHp, `${label}: current_hp key remains absent`).toBe(false);
  expect(data.currentHp, `${label}: no stored current_hp was materialized`).toBeNull(); return data;
}
async function publish(info: TestInfo, story: Story) {
  // Separate guarded EXTERNAL fixture publisher: one meaningful Hill-root v2,
  // all historical versions and all 15 character/projection tables unchanged.
  // Requires reviewed Draconic HP -> parent admission -> ancestry stage order.
  const file = process.env.INKBORNE_LOCAL_FLOW_CONFIG!, helper = resolve(dirname(file), "../ancestry-hit-points-control.mjs");
  const startedUtc = new Date().toISOString();
  const result = spawnSync(process.execPath, ["--import", "tsx", helper, "publish-corrected", story.controlId],
    { cwd: process.cwd(), encoding: "utf8", windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024 });
  await writeFile(info.outputPath("ancestry-publication-process.json"), JSON.stringify({ pid: result.pid, parentPid: process.pid, cwd: process.cwd(), helper,
    startedUtc, finishedUtc: new Date().toISOString(), exitCode: result.status }, null, 2));
  if (result.status !== 0) throw Error("Guarded Hill Dwarf publication failed; inspect the local fixture receipt");
  expect(JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1) ?? "null")).toEqual({ onlyChangedIdentity: "subrace/hill-dwarf", hillDwarfVersion: 2,
    characterRowsUnchanged: true, historicalSnapshotsPreserved: true });
}
function samePersistentSources(before: Native, after: Native) {
  for (const key of ["originalOccurrenceId", "barbarianOccurrenceId", "classControllerRefId", "racePinId", "subracePinId", "subraceContentId", "subraceVersion"] as const) expect(after[key]).toBe(before[key]);
  expect(after.pins.filter(pin => ["race", "subrace", "trait", "class", "background"].includes(pin.kind))).toEqual(before.pins.filter(pin => ["race", "subrace", "trait", "class", "background"].includes(pin.kind)));
  expect(after.inventory).toEqual(before.inventory); expect(after.catalog).toEqual(before.catalog); expect(after.oldControl).toEqual(before.oldControl);
}
async function foreign404(browser: Browser, story: Story, ids: string[]) {
  const context = await browser.newContext(); await restrictOrigins(context, story);
  try {
    const page = await context.newPage(); page.on("pageerror", () => story.pageErrors.push("other-account browser error")); await login(page, story.config, story.config.other);
    for (const id of ids) expect((await page.goto(`${story.config.appOrigin}/characters/${id}`))?.status()).toBe(404);
  } finally { await context.close(); }
}

test("A4 full Hill Dwarf Barbarian preserves old HP35 and new HP38 with one retained native d12", async ({ page, context, browser }, info) => {
  test.setTimeout(600000);
  const runId = process.env.INKBORNE_LOCAL_FLOW_RUN_ID;
  if (!runId || !uuid.test(runId)) throw Error("Run A4 through its bounded ancestry-hp-app wrapper");
  const source = captureAncestryHpSource(process.cwd());
  const story: Story = { config: await configuration(), controlId: "", snapshots: [], blockedOrigins: [], pageErrors: [], checkpoints: [] };
  await restrictOrigins(context, story); page.on("pageerror", () => story.pageErrors.push("owner browser error"));
  console.log(JSON.stringify({ workerPid: process.pid, parentPid: process.ppid, cwd: process.cwd(), startedUtc: new Date().toISOString(), story: "A4 ancestry HP" }));
  await login(page, story.config, story.config.owner); expect((await context.cookies()).some(cookie => cookie.name.startsWith("sb-"))).toBe(true);
  story.controlId = await createComplete(page, story, "old v1"); await inspectSheet(page, story, story.controlId, 35); await page.reload();
  await inspectClass(page, story, story.controlId, 35);
  const old = await readback(info, story, story.controlId, "old-v1-complete-before-publication");
  expect(old.subraceVersion).toBe(1); expect(old.ancestryHpBonus).toBeNull(); expect(old.maximumHp).toBe(35); expect(old.hpDraws).toEqual([]);
  expect(old.catalog.hillDwarf).toEqual({ contentId: old.subraceContentId, version: 1 }); expect(old.catalog.hillSnapshots).toHaveLength(1);
  await checkpoint(info, story, "genuine old Hill Dwarf Barbarian3 completed all six Saved steps at35HP"); await publish(info, story);
  const published = await readback(info, story, story.controlId, "hill-root-v2-old-control-unchanged");
  expect(published.oldControl).toEqual(old.oldControl); expect(published.completeFingerprint).toBe(old.completeFingerprint); expect(published.pins).toEqual(old.pins);
  expect(published.catalog.definitions).toBe(old.catalog.definitions); expect(published.catalog.versions).toBe(old.catalog.versions + 1);
  expect(published.catalog.hillDwarf).toEqual({ contentId: old.subraceContentId, version: 2 }); expect(published.catalog.hillSnapshots).toHaveLength(2);
  expect(published.catalog.hillSnapshots[0]).toEqual(old.catalog.hillSnapshots[0]); expect(published.catalog.hillSnapshots[1].hpBonus).toBe(1);
  expect(published.catalog.toughnessSnapshots).toEqual(old.catalog.toughnessSnapshots); await inspectSheet(page, story, story.controlId, 35); await page.reload();
  await checkpoint(info, story, "atomic one-root publication preserves old character, root, mandatory trait and immutable snapshots");

  const id = await createComplete(page, story, "new v2"); await inspectSheet(page, story, id, 38); await page.reload(); await inspectClass(page, story, id, 38);
  const initial = await readback(info, story, id, "new-v2-complete-average");
  expect(initial.maximumHp).toBe(38); expect(initial.subraceVersion).toBe(2); expect(initial.ancestryHpBonus).toBe(1); expect(initial.effectiveScores).toEqual(effective);
  expect(initial.baseScores).toEqual(Object.fromEntries(Object.entries(scores).map(([ability, score]) => [ability.toLowerCase(), Number(score)]))); expect(initial.hpDraws).toEqual([]);
  await page.goto(builder(story, id) + "/class"); await openLevel(page, 2);
  const roll = page.getByRole("radio", { name: /^Roll d12/ });
  await save(page, () => roll.click()); await expect(roll).toHaveAttribute("aria-checked", "true"); await expect(roll).toBeEnabled();
  const rolled = await readback(info, story, id, "server-d12-original-operation"); expect(rolled.hpDraws).toHaveLength(1); const draw = rolled.hpDraws[0];
  expect(draw).toMatchObject({ actorId: story.config.owner.id, occurrenceId: initial.barbarianOccurrenceId, level: 2, die: 12 });
  expect(draw.value).toBeGreaterThanOrEqual(1); expect(draw.value).toBeLessThanOrEqual(12);
  expect(rolled.hpRolls["barbarian-2"]).toEqual({ method: "rolled", value: draw.value }); expect(rolled.maximumHp).toBe(31 + draw.value);
  samePersistentSources(initial, rolled);
  await page.reload(); await openLevel(page, 2); await expect(roll).toHaveAttribute("aria-checked", "true"); await expect(roll).toContainText(`(+${draw.value + 3})`);
  await average(page, 2); const averaged = await readback(info, story, id, "average-with-original-draw-retained");
  expect(averaged.maximumHp).toBe(38);
  await save(page, () => roll.click()); await expect(roll).toBeEnabled();
  const reused = await readback(info, story, id, "reselected-original-draw"); expect(reused.hpDraws).toEqual(rolled.hpDraws); expect(reused.maximumHp).toBe(31 + draw.value);
  samePersistentSources(initial, reused);
  await setLevel(page, story, id, 2); await inspectClass(page, story, id, 20 + draw.value);
  const down = await readback(info, story, id, "downlevel-two"); expect(down.maximumHp).toBe(20 + draw.value); expect(down.hpDraws).toEqual(rolled.hpDraws);
  samePersistentSources(initial, down);
  await inspectSheet(page, story, id, 20 + draw.value, 2);
  await setLevel(page, story, id, 3); await openLevel(page, 3); await choose(page, page.getByRole("button", { name: /^Berserker(?:\s|$)/ })); await average(page, 3);
  const restored = await readback(info, story, id, "restored-three-original-draw"); expect(restored.maximumHp).toBe(31 + draw.value); expect(restored.hpDraws).toEqual(rolled.hpDraws);
  samePersistentSources(initial, restored);
  await average(page, 2); await inspectClass(page, story, id, 38);
  const final = await readback(info, story, id, "averages-restored-draw-and-current-retained");
  expect(final.maximumHp).toBe(38); expect(final.hpDraws).toEqual(rolled.hpDraws); samePersistentSources(initial, final);
  await inspectSheet(page, story, id, 38); await page.reload();
  await expect(page.getByRole("button", { name: "HP tracker — click to heal or damage", exact: true })).toContainText("/38");
  const reloaded = await readback(info, story, id, "completed-sheet-reload"); expect(reloaded).toEqual(final);
  await inspectSheet(page, story, story.controlId, 35); await page.reload();
  await foreign404(browser, story, [story.controlId, id]); const foreign = await readback(info, story, id, "old-control-preserved-and-foreign404"); expect(foreign).toEqual(final);
  expect(story.blockedOrigins).toEqual([]); expect(story.pageErrors).toEqual([]);
  await checkpoint(info, story, "new38HP AC14 speed25 Rage3; one native d12 retained through reload/reselection/down/up; old35 and foreign404 preserved");
  const path = info.outputPath("ancestry-hit-points-workflow.json");
  expect(captureAncestryHpSource(process.cwd())).toEqual(source);
  await writeFile(path, JSON.stringify({ actualApp: true, actualAuthCookies: true, actualPostgrest: true, uiWritesOnly: true, caseId: "A4",
    source, runId,
    oldControlId: story.controlId, newCharacterId: id, allSixBuilderStepsSaved: true, completedSheetReloadPassed: true, foreignAccountRefused: true, rawDraw: draw,
    independent2014Expectations: { oldLevel3Hp: 35, newLevel3Hp: 38, rolledLevel3Hp: 31 + draw.value, rolledLevel2Hp: 20 + draw.value,
      unarmoredAc: 14, speed: 25, rageCapacity: 3, baseScores: scores, effectiveScores: effective },
    storedCurrentHp: { initial: initial.currentHp, final: final.currentHp, actualAcceptance: "initial absence preserved through existing class writes" },
    clampScope: "no actual-app present-current-HP clamp claim; finite native F1 tests cover that existing class path separately; no race/ability clamp claim",
    checkpoints: story.checkpoints, snapshots: story.snapshots, blockedOrigins: story.blockedOrigins, pageErrors: story.pageErrors }, null, 2));
  await info.attach("ancestry-hit-points-workflow", { path, contentType: "application/json" });
});
