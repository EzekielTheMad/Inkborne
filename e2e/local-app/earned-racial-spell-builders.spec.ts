import { choiceOption, choiceGroup, optionPicked, pickOption, hpOption, setSpell, selectedSpell, setPrepared } from "./dropdown-helpers";
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { nativeJson, testRuntime } from "../../scripts/unraid/native";

type Account = { id: string; email: string; password: string };
type Settings = { appOrigin: string; supabaseOrigin: string; owner: Account; other: Account };
type Owner = "Bard" | "Wizard";
type Stage = "complete" | "trimmed-five" | "wizard-one" | "below-three" | "restored-four";
type Phase = "baseline" | "concurrent";
type Spell = { id: string; slug: string; classSlug: string; contentId: string; version: number; level: number; source: string;
  known: boolean; prepared: boolean; alwaysPrepared: boolean; book: boolean; grantId: string | null; custom: Record<string, unknown>;
  createdAt: string; snapshotFingerprint: string };
type Receipt = { operationId: string; actorId: string; characterId: string; command: string; actionRevision: string;
  fields: { class_slug?: string; spells?: Array<{ content_id: string; content_version: number; prepared: boolean }> }; request: Record<string, unknown>; receipt: Record<string, unknown> };
type Native = { evidenceKind: string; characterId: string; actorId: string; level: number; actionRevision: string; originalOccurrenceId: string;
  maximumHp: number; hasStoredCurrentHp: boolean; choices: Record<string, unknown>; state: Record<string, unknown>;
  classRoots: Array<{ slug: string; level: number; occurrenceId: string; controllerRefId: string; contentId: string; version: number; subclassPinId: string | null }>;
  rootVersion: number; racePinId: string; traitPinId: string; pins: unknown[]; inventory: unknown[]; spells: Spell[]; receipts: Receipt[]; historyCount: number; completeFingerprint: string;
  oldControl: { characterId: string; actorId: string; rootVersion: number; rootDeclaration: unknown; maximumHp: number; racialSlugs: string[]; fingerprint: string };
  catalog: { definitions: number; versions: number; tiefling: { contentId: string; version: number }; rootSnapshots: Array<{ version: number; fingerprint: string; declaration: unknown }>;
    traitSnapshots: Array<{ version: number; fingerprint: string }> }; checks: Record<string, boolean> };
type Story = { config: Settings; id: string; controlId: string; controlBaseline?: Native["oldControl"]; blockedOrigins: string[]; gameplayStateRequests: string[]; pageErrors: string[]; checkpoints: string[]; snapshots: Array<{ label: string; path: string; data: Native; runtime?: ReturnType<typeof runtimeBinding> }> };
const freshCurrent = !!process.env.INKBORNE_TEST_RUNTIME;
const targetRootVersion: 1 | 2 = freshCurrent ? 1 : 2;
const earnedDeclaration = { version: 1, source_trait: "infernal-legacy", spellcasting_ability: "charisma", grants: [
  { character_level: 3, spell: "hellish-rebuke", spell_level: 1, cast_level: 2 }, { character_level: 5, spell: "darkness", spell_level: 2, cast_level: 2 },
] };
function runtimeBinding() {
  if (!freshCurrent) return undefined;
  const { kind, runId, sourceHead, engineId, databaseId, pgSystemId } = testRuntime();
  return { kind, runId, sourceHead, engineId, databaseId, pgSystemId };
}
const scores = { Strength: "8", Dexterity: "13", Constitution: "12", Intelligence: "14", Wisdom: "10", Charisma: "15" };
const plans = {
  Bard: { cantrips: ["Minor Illusion", "Vicious Mockery"], spells: ["Charm Person", "Cure Wounds", "Detect Magic", "Healing Word", "Hold Person", "Shatter"], prepared: [] as string[] },
  Wizard: { cantrips: ["Fire Bolt", "Light", "Mage Hand"], spells: ["Burning Hands", "Charm Person", "Comprehend Languages", "Detect Magic", "Feather Fall", "Identify", "Magic Missile", "Shield"], prepared: ["Burning Hands", "Charm Person", "Magic Missile", "Shield"] },
};
const stageRules = { complete: { bard: 3, wizard: 2, total: 5, hp: 31, slots: [4, 3, 2], bardKnown: 6, book: 8, prepared: 4 },
  "trimmed-five": { bard: 3, wizard: 2, total: 5, hp: 31, slots: [4, 3, 2], bardKnown: 6, book: 6, prepared: 3 },
  "wizard-one": { bard: 3, wizard: 1, total: 4, hp: 26, slots: [4, 3, 0], bardKnown: 6, book: 6, prepared: 3 },
  "below-three": { bard: 1, wizard: 1, total: 2, hp: 14, slots: [3, 0, 0], bardKnown: 4, book: 6, prepared: 3 },
  "restored-four": { bard: 3, wizard: 1, total: 4, hp: 26, slots: [4, 3, 0], bardKnown: 6, book: 6, prepared: 3 } };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const nativeChecks = ["oneExpectedCharacterAndOldControl", "exactOriginalAndSecondaryRoles", "exactClassAndSubclassPins", "allFrozenSrdPinsExact", "allFrozenSpellRowsExact",
  "exactTieflingInfernalSource", "standardArrayAndScores", "finiteClassChoicesAndFeatures", "ordinaryBudgetsAndRowsExact", "ordinaryRowsHaveExactController",
  "earnedRacialRowsExact", "exactCantripAndNoOtherGrants", "independentOwnCastingInputs", "explicitAverageHpAndMaximum", "oneOriginalNativeAward", "inventoryFromAcceptedAward",
  "detailsConfirmed", "ownedReceiptsAndHistory", "fiveOrderBijections", "currentParentAndRoleOrder", "boundariesClosed"];

async function configuration(): Promise<Settings> {
  const file = freshCurrent ? process.env.INKBORNE_TEST_CONFIG : process.env.INKBORNE_LOCAL_FLOW_CONFIG; if (!file) throw Error("Provide the isolated local browser configuration file");
  if (freshCurrent) { testRuntime(); expect(file).toBe("/run/inkborne/test-config.json"); }
  const config = JSON.parse(await readFile(file, "utf8")) as Settings;
  for (const origin of [config.appOrigin, config.supabaseOrigin]) { const url = new URL(origin); if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.origin !== origin) throw Error("Explicit loopback origins required"); }
  for (const account of [config.owner, config.other]) if (!account?.email || !account.password || !uuid.test(account.id)) throw Error("Disposable accounts required");
  if (config.owner.id === config.other.id) throw Error("Distinct disposable accounts required"); return config;
}
async function restrictOrigins(context: BrowserContext, story: Story) {
  const allowed = new Set([story.config.appOrigin, story.config.supabaseOrigin]); await context.route("**/*", route => { const url = new URL(route.request().url()), origin = url.origin;
    if (url.pathname.startsWith("/rest/v1/rpc/patch_character_state")) story.gameplayStateRequests.push(url.pathname);
    if (!allowed.has(origin)) { story.blockedOrigins.push(origin); return route.abort(); } return route.continue(); });
}
async function login(page: Page, config: Settings, account: Account) {
  try { await page.goto(config.appOrigin + "/login"); await page.getByLabel("Email", { exact: true }).fill(account.email); await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: /sign in/i }).click(); await page.waitForURL(config.appOrigin + "/dashboard", { timeout: 60000 });
  } catch { await page.close(); throw Error("Actual local sign-in failed; credentials withheld"); }
}
async function save(page: Page, change: () => Promise<unknown>) {
  const path = new URL(page.url()).pathname; const [response] = await Promise.all([page.waitForResponse(item => item.request().method() === "POST" && new URL(item.url()).pathname === path), change()]); expect(response.status()).toBe(200);
}
async function choose(page: Page, option: Locator) { if (!await optionPicked(option)) await save(page, () => pickOption(option)); await expect(option).toHaveJSProperty("selected", true); await expect(option).toBeEnabled(); }
const builder = (story: Story) => `${story.config.appOrigin}/characters/${story.id}/builder`;
const form = (page: Page, owner: Owner) => page.getByRole("form", { name: `${owner} spell choices`, exact: true });
function group(page: Page, label: string, option?: string) { const article = page.getByRole("article").filter({ has: page.getByRole("heading", { name: label, exact: true, level: 4 }) }); return option ? article.filter({ has: choiceOption(page, option) }) : article; }
async function openLevel(page: Page, owner: Owner, level: number) {
  await page.getByRole("combobox", { name: `Set level for ${owner}`, exact: true }).locator("..").locator("..").locator("..").getByRole("button", { name: new RegExp(`^Level ${level}:`) }).click();
  await expect(page.locator('section[aria-labelledby="class-level-title"]').getByRole("navigation", { name: "Breadcrumb", exact: true })).toContainText(`Level ${level}`);
}
async function setLevel(page: Page, story: Story, owner: Owner, level: number) {
  await page.goto(builder(story) + "/class"); const control = page.getByRole("combobox", { name: `Set level for ${owner}`, exact: true }); await save(page, () => control.selectOption(String(level))); await expect(control).toHaveValue(String(level)); await expect(control).toBeEnabled();
}
async function average(page: Page, owner: Owner, level: number) { await openLevel(page, owner, level); const option = hpOption(page, "average"); await save(page, () => pickOption(option)); await expect(option).toHaveJSProperty("selected", true); await expect(option).toBeEnabled(); }
async function lore(page: Page) {
  await openLevel(page, "Bard", 3); await choose(page, choiceOption(page, /^Lore(?:\s|$)/));
  for (const name of ["Perception", "Stealth"]) await choose(page, choiceOption(group(page, "Choose 2 expertise"), name));
  for (const name of ["Athletics", "Medicine", "Nature"]) await choose(page, choiceOption(group(page, "Choose 3 proficiency", "Athletics"), name));
}
async function option(page: Page, owner: Owner, name: string, cantrip = false) { await form(page, owner).getByRole("textbox", { name: `Search ${owner.toLowerCase()} ${cantrip ? "cantrips" : "levelled spells"}`, exact: true }).fill(name); return selectedSpell(form(page, owner), name); }
async function saveSpells(page: Page, owner: Owner) { await expect(form(page, owner).getByRole("button", { name: "Save spells", exact: true })).toBeEnabled(); await save(page, () => form(page, owner).getByRole("button", { name: "Save spells", exact: true }).click()); await expect(form(page, owner).getByText("Spell choices saved.", { exact: true })).toBeVisible(); await expect(form(page, owner).getByRole("button", { name: "Save spells", exact: true })).toBeEnabled(); }
async function selectSpells(page: Page, owner: Owner) {
  for (const name of plans[owner].cantrips) await setSpell(form(page, owner), name, true);
  for (const name of plans[owner].spells) { await setSpell(form(page, owner), name, true); if (owner === "Wizard") await setPrepared(form(page, owner), name, plans.Wizard.prepared.includes(name)); }
  await saveSpells(page, owner); await page.reload();
}
async function budgets(page: Page, stage: Stage) {
  const rule = stageRules[stage]; await expect(form(page, "Bard").getByText("Cantrips: 2 / 2", { exact: true })).toBeVisible();
  await expect(form(page, "Bard").getByText(`Spells known: ${rule.bardKnown} / ${rule.bardKnown}`, { exact: true })).toBeVisible();
  await expect(form(page, "Wizard").getByText("Cantrips: 3 / 3", { exact: true })).toBeVisible(); await expect(form(page, "Wizard").getByText(`Spellbook: ${rule.book} / ${rule.wizard === 2 ? 8 : 6} spells`, { exact: true })).toBeVisible();
  await expect(form(page, "Wizard").getByText(new RegExp(`^Prepared spells: ${rule.prepared} / ${rule.wizard === 2 ? 4 : 3}\\.`))).toBeVisible();
}
async function createComplete(page: Page, story: Story, label: string) {
  await page.goto(story.config.appOrigin + "/characters/new"); const name = `Earned A6 ${label} ${randomUUID().slice(0, 8)}`;
  await page.getByRole("textbox", { name: "What will they be called?" }).fill(name); await page.getByRole("button", { name: "Open the notebook", exact: true }).click(); await page.waitForURL(/\/characters\/[0-9a-f-]+\/builder\/first-class$/); story.id = new URL(page.url()).pathname.split("/")[2]; expect(story.id).toMatch(uuid);
  await page.getByRole("combobox", { name: "First class", exact: true }).selectOption({ label: "Bard" }); await page.getByRole("button", { name: "Save first class", exact: true }).click(); await expect(page.getByText("Bard · Level 1", { exact: true })).toBeVisible();
  await page.reload(); await page.getByRole("link", { name: "Complete class choices", exact: true }).click(); await openLevel(page, "Bard", 1);
  for (const name of ["Arcana", "Perception", "Stealth"]) await choose(page, choiceOption(group(page, "Choose 3 proficiency", "Arcana"), name));
  for (const name of ["Drum", "Flute", "Lute"]) await choose(page, choiceOption(group(page, "Choose 3 proficiency", "Lute"), name));
  await page.goto(builder(story) + "/race"); await page.getByRole("combobox", { name: "Choose Race", exact: true }).selectOption({ label: "Tiefling" }); await save(page, () => page.getByRole("button", { name: "Add Race", exact: true }).click()); await expect(page.getByRole("button", { name: "Change Race", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next: Abilities", exact: true }).click();
  for (const [ability, score] of Object.entries(scores)) { const control = page.getByRole("combobox", { name: `${ability} score`, exact: true }); if (await control.inputValue() === score) continue;
    for (const other of Object.keys(scores)) if (other !== ability) { const occupied = page.getByRole("combobox", { name: `${other} score`, exact: true }); if (await occupied.inputValue() === score) { await save(page, () => occupied.selectOption("")); await expect(page.getByText("Changes save automatically.", { exact: true })).toBeVisible(); } }
    await save(page, () => control.selectOption(score)); await expect(page.getByText("Changes save automatically.", { exact: true })).toBeVisible(); }
  await page.reload(); for (const [ability, score] of Object.entries(scores)) await expect(page.getByRole("combobox", { name: `${ability} score`, exact: true })).toHaveValue(score);
  await page.getByRole("button", { name: "Next: Background", exact: true }).click(); await page.getByRole("combobox", { name: "Choose Background", exact: true }).selectOption({ label: "Acolyte" }); await save(page, () => page.getByRole("button", { name: "Add Background", exact: true }).click());
  const languages = choiceGroup(page, "Choose 2 language"); for (const name of ["Celestial", "Elvish"]) await choose(page, choiceOption(languages, name)); await save(page, () => pickOption(choiceOption(page, "Nothing can shake my optimistic attitude.")));
  await setLevel(page, story, "Bard", 3); await lore(page); await average(page, "Bard", 2); await average(page, "Bard", 3); await selectSpells(page, "Bard");
  await page.goto(builder(story) + "/equipment"); const groups = page.locator("select").filter({ has: page.locator('option[value="a"]') }); await expect(groups.first()).toBeVisible();
  for (let index = 0; index < await groups.count(); index++) await choose(page, groups.nth(index).locator('option[value="a"]'));
  const slots = page.locator('button[data-slot="select-trigger"]'); for (let index = 0; index < await slots.count(); index++) { const slot = slots.nth(index); await slot.click(); await expect(page.getByRole("listbox")).toBeVisible(); await save(page, () => page.getByRole("listbox").getByRole("option").first().click()); await expect(slot).toBeEnabled(); }
  await expect(page.getByRole("button", { name: "Confirm Equipment", exact: true })).toBeEnabled(); await page.getByRole("button", { name: "Confirm Equipment", exact: true }).click(); await expect(page.getByText("Starting equipment award recorded", { exact: true })).toBeVisible(); await page.reload();
  await page.goto(builder(story) + "/class"); await page.getByRole("button", { name: /^Add a class/ }).click(); await page.getByRole("combobox", { name: "Choose an additional class", exact: true }).selectOption({ label: "Wizard" }); await save(page, () => page.getByRole("button", { name: "Pick this class", exact: true }).click()); await average(page, "Wizard", 1);
  await setLevel(page, story, "Wizard", 2); await average(page, "Wizard", 2); await openLevel(page, "Wizard", 2); await choose(page, choiceOption(page, /^Evocation(?:\s|$)/)); await selectSpells(page, "Wizard"); await budgets(page, "complete");
  await page.goto(builder(story) + "/details"); await page.getByRole("textbox", { name: "Character name", exact: true }).fill(name); await page.getByRole("combobox", { name: "Alignment", exact: true }).selectOption("Neutral Good"); await save(page, () => page.getByRole("button", { name: "Save details", exact: true }).click()); await expect(page.getByText("Character details saved.", { exact: true })).toBeVisible(); await page.reload();
  const nav = page.getByRole("navigation", { name: "Character builder", exact: true }); for (const step of ["class", "race", "abilities", "background", "equipment", "details"]) await expect(nav.locator(`a[href$="/builder/${step}"]`)).toContainText("Saved");
  await page.getByRole("button", { name: "Review & Finish", exact: true }).click(); await page.getByRole("button", { name: "Finish & View Character", exact: true }).click(); await expect(page).toHaveURL(`${story.config.appOrigin}/characters/${story.id}`); await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}
async function inspectSheet(page: Page, story: Story, stage: Stage, rootVersion: 1 | 2) {
  const rule = stageRules[stage], proficiency = rule.total >= 5 ? 3 : 2; await page.goto(`${story.config.appOrigin}/characters/${story.id}`);
  await expect(page.getByRole("button", { name: "HP tracker — click to heal or damage", exact: true })).toContainText(`/${rule.hp}`);
  await expect(page.getByRole("button", { name: "Roll Intelligence check", exact: true }).locator("p").last()).toHaveText("15"); await expect(page.getByRole("button", { name: "Roll Charisma check", exact: true }).locator("p").last()).toHaveText("17");
  await page.getByRole("button", { name: "Spells", exact: true }).click(); for (const [index, label] of ["1st", "2nd", "3rd"].entries()) await expect(page.getByRole("button", { name: `Mark ${label} slot used`, exact: true }).filter({ visible: true })).toHaveCount(rule.slots[index]);
  await expect(page.getByRole("button", { name: "Mark Pact slot used", exact: true })).toHaveCount(0); await expect(page.getByText("Cantrips: 5/5", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText(`Ordinary Spells Known: ${rule.bardKnown}/${rule.bardKnown}`, { exact: true }).filter({ visible: true })).toBeVisible(); await expect(page.getByText(`Prepared: ${rule.prepared}/${rule.wizard === 2 ? 4 : 3}`, { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText(new RegExp(`^Save DC\\s*${11 + proficiency}$`)).filter({ visible: true })).toBeVisible(); await expect(page.getByText(new RegExp(`^Attack\\s*\\+${3 + proficiency}$`)).filter({ visible: true })).toBeVisible();
  await expect(page.getByText("Thaumaturgy", { exact: true }).filter({ visible: true })).toHaveCount(1);
  for (const [name, threshold] of [["Hellish Rebuke", 3], ["Darkness", 5]] as const) {
    const earned = (freshCurrent || rootVersion === 2) && rule.total >= threshold; await expect(page.getByText(name, { exact: true }).filter({ visible: true })).toHaveCount(earned ? 1 : 0);
    await expect(page.getByRole("button", { name: `Cast ${name}`, exact: true })).toHaveCount(0);
    if (earned) { const title = page.getByText(name, { exact: true }).filter({ visible: true }), row = title.locator("..").locator("..").locator(".."); await title.click();
      await expect(row.getByText("Racial trait", { exact: true })).toBeVisible(); await expect(row.getByText(`Charisma · save DC ${11 + proficiency} · spell attack +${3 + proficiency}.`, { exact: true })).toBeVisible();
      await expect(row.getByText("Cast at 2nd level · once per long rest. Casting and use tracking are not available in this spell dialog.", { exact: true })).toBeVisible(); }
  }
  // Real class configuration previews demonstrate INT and CHA remain separate.
  for (const [spell, owner, math] of [["Vicious Mockery", "Bard", `Wisdom save DC ${11 + proficiency}`], ["Fire Bolt", "Wizard", `Ranged spell attack +${2 + proficiency}`]]) {
    await page.getByRole("button", { name: `Cast ${spell}`, exact: true }).click(); const dialog = page.getByRole("dialog", { name: `Cast: ${spell}`, exact: true });
    await expect(dialog).toContainText(`Cast as ${owner} (${owner === "Bard" ? "Charisma" : "Intelligence"}).`); await expect(dialog).toContainText(math); await dialog.getByRole("button", { name: "Cancel", exact: true }).click(); }
}
async function readback(info: TestInfo, story: Story, label: string, stage: Stage = "complete", phase: Phase = "baseline", rootVersion: 1 | 2 = targetRootVersion): Promise<Native> {
  if (!uuid.test(story.id) || !uuid.test(story.controlId)) throw Error("Local native evidence configuration required");
  const processes: unknown[] = [], reports: Record<string, Record<string, unknown>> = {}, runtime = runtimeBinding();
  if (freshCurrent) {
    for (const reader of ["earned-racial-spell-builders-readback.sql", "builder-class-choices-readback.sql"]) {
      const sql = await readFile(resolve(process.cwd(), "supabase/verification", reader), "utf8");
      reports[reader] = await nativeJson(sql, { character_id: story.id, control_id: story.controlId, stage, spell_phase: phase, root_version: String(rootVersion), current_catalog: "1" }, "supabase_admin") as Record<string, unknown>;
    }
  } else {
  const file = process.env.INKBORNE_LOCAL_FLOW_CONFIG; if (!file) throw Error("Local native evidence configuration required");
  const state = JSON.parse(await readFile(resolve(dirname(file), "../state.json"), "utf8")); if (state.project !== "inkborne-app-flow-20261022" || state.ready !== true || state.stoppedUtc) throw Error("Wrong disposable runtime");
  const db = state.containers.find((item: { name: string }) => item.name === `/${state.project}-db`); if (!db || !/^[a-f0-9]{64}$/.test(db.id)) throw Error("Missing owned database identity");
  const run = (args: string[], input?: string) => { const startedUtc = new Date().toISOString(); const result = spawnSync("C:/Users/kaios/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe", ["--context", "desktop-linux", ...args], { cwd: process.cwd(), input, encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 3 * 1024 * 1024 });
    processes.push({ pid: result.pid, parentPid: process.pid, cwd: process.cwd(), args, startedUtc, finishedUtc: new Date().toISOString(), exitCode: result.status }); if (result.status !== 0) throw Error("Owned read-only earned-racial evidence failed; raw output withheld"); return result.stdout.trim(); };
  expect(run(["info", "--format", "{{.ID}}"])).toBe(state.engineId); const identity = JSON.parse(run(["inspect", "--format", '{"id":{{json .Id}},"labels":{{json .Config.Labels}},"status":{{json .State.Status}}}', db.id])); expect(identity.id).toBe(db.id); expect(identity.labels["com.docker.compose.project"]).toBe(state.project); expect(identity.status).toBe("running");
  for (const reader of ["earned-racial-spell-builders-readback.sql", "builder-class-choices-readback.sql"]) { const sql = await readFile(resolve(process.cwd(), "supabase/verification", reader), "utf8"); reports[reader] = JSON.parse(run(["exec", "-i", db.id, "psql", "-X", "--no-password", "--host", "/var/run/postgresql", "--username", "supabase_admin", "--dbname", "postgres", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--set", `character_id=${story.id}`, "--set", `control_id=${story.controlId}`, "--set", `stage=${stage}`, "--set", `spell_phase=${phase}`, "--set", `root_version=${rootVersion}`, "--file", "-"], sql)); }
  }
  const data = reports["earned-racial-spell-builders-readback.sql"] as unknown as Native, path = info.outputPath(`earned-racial-native-${story.snapshots.length + 1}-${label}.json`); await writeFile(path, JSON.stringify({ observedUtc: new Date().toISOString(), label, runtime, processes, reports }, null, 2)); story.snapshots.push({ label, path, data, ...(runtime ? { runtime } : {}) });
  expect(data.evidenceKind).toBe("read_only_after_actual_A6_earned_racial_app_actions"); expect(data.characterId).toBe(story.id); expect(data.actorId).toBe(story.config.owner.id); expect(data.level).toBe(stageRules[stage].total); expect(data.maximumHp).toBe(stageRules[stage].hp); expect(data.rootVersion).toBe(rootVersion); expect(data.hasStoredCurrentHp).toBe(false);
  expect(data.oldControl).toMatchObject({ characterId: story.controlId, actorId: story.config.owner.id, rootVersion: 1, rootDeclaration: freshCurrent ? earnedDeclaration : null, maximumHp: 31, racialSlugs: freshCurrent ? ["darkness", "hellish-rebuke", "thaumaturgy"] : ["thaumaturgy"] });
  if (story.controlBaseline) expect(data.oldControl).toEqual(story.controlBaseline);
  if (freshCurrent) {
    expect(data.catalog).toMatchObject({ definitions: 1535, versions: 1535, tiefling: { version: 1 } });
    expect(data.catalog.rootSnapshots).toHaveLength(1); expect(data.catalog.rootSnapshots[0]).toMatchObject({ version: 1, declaration: earnedDeclaration }); expect(data.catalog.traitSnapshots).toHaveLength(1);
  }
  expect(Object.keys(data.checks).sort()).toEqual([...nativeChecks].sort()); for (const key of nativeChecks) expect(data.checks[key], `${label}: ${key}`).toBe(true);
  // The old family reader's all_spell_rows_exact is intentionally cantrip-only.
  // This new reader supplies strict finite F3 earned-row provenance instead;
  // the original cantrip guard and shared verification file stay unchanged.
  const family = reports["builder-class-choices-readback.sql"]; for (const key of ["all_pinned_versions_exact", "feature_grants_exact", "physical_feature_grant_links_exact", "active_feature_projections_exact", "spell_grants_exact", "active_spell_grants_projected", "all_choice_checks", "all_child_checks", "all_favored_checks", "all_five_order_bijections", "all_boundaries_closed"]) expect(family[key], `${label}: ${key}`).toBe(true); return data;
}
async function checkpoint(info: TestInfo, story: Story, label: string) { story.checkpoints.push(label); await writeFile(info.outputPath("earned-racial-progress.json"), JSON.stringify({ actualApp: true, observedUtc: new Date().toISOString(), characterId: story.id, controlId: story.controlId, checkpoints: story.checkpoints, blockedOrigins: story.blockedOrigins, pageErrors: story.pageErrors }, null, 2)); }
async function publish(info: TestInfo, story: Story) {
  if (freshCurrent) throw Error("Fresh current catalog runs do not publish historical roots");
  // Separate EXTERNAL guarded publisher, root-approved installation order and
  // actual atomic publisher. One meaningful Tiefling root; no graph/state write.
  const helper = resolve(dirname(process.env.INKBORNE_LOCAL_FLOW_CONFIG!), "../earned-racial-spells-control.mjs"), startedUtc = new Date().toISOString(); const result = spawnSync(process.execPath, ["--import", "tsx", helper, "publish-corrected", story.controlId], { cwd: process.cwd(), encoding: "utf8", windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024 });
  await writeFile(info.outputPath("earned-racial-publication-process.json"), JSON.stringify({ pid: result.pid, parentPid: process.pid, cwd: process.cwd(), helper, startedUtc, finishedUtc: new Date().toISOString(), exitCode: result.status }, null, 2)); if (result.status !== 0) throw Error("Guarded Tiefling publication failed; inspect the local fixture receipt"); expect(JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1) ?? "null")).toEqual({ onlyChangedIdentity: "race/tiefling", tieflingVersion: 2, characterRowsUnchanged: true, historicalSnapshotsPreserved: true });
}
const classSpells = (data: Native, owner: string) => data.spells.filter(spell => spell.classSlug === owner);
const racialSpells = (data: Native) => data.spells.filter(spell => spell.classSlug === "race:tiefling");
function sameRoots(before: Native, after: Native) { expect(after.originalOccurrenceId).toBe(before.originalOccurrenceId); expect(after.racePinId).toBe(before.racePinId); expect(after.traitPinId).toBe(before.traitPinId); for (const owner of ["bard", "wizard"]) { const left = before.classRoots.find(root => root.slug === owner)!, right = after.classRoots.find(root => root.slug === owner)!; for (const key of ["occurrenceId", "controllerRefId", "contentId", "version"] as const) expect(right[key]).toBe(left[key]); } expect(after.state).toEqual(before.state); expect(after.inventory).toEqual(before.inventory); expect(after.oldControl).toEqual(before.oldControl); }
async function foreign404(browser: Browser, story: Story) { const context = await browser.newContext(); await restrictOrigins(context, story); try { const page = await context.newPage(); page.on("pageerror", () => story.pageErrors.push("other-account browser error")); await login(page, story.config, story.config.other); for (const id of [story.controlId, story.id]) expect((await page.goto(`${story.config.appOrigin}/characters/${id}`))?.status()).toBe(404); } finally { await context.close(); } }

test("A6 owns Tiefling tiers and preserves its control, class budgets and concurrent saves", async ({ page, context, browser }, info) => {
  test.setTimeout(900000); const story: Story = { config: await configuration(), id: "", controlId: "", blockedOrigins: [], gameplayStateRequests: [], pageErrors: [], checkpoints: [], snapshots: [] }; await restrictOrigins(context, story); page.on("pageerror", () => story.pageErrors.push("owner browser error")); console.log(JSON.stringify({ workerPid: process.pid, parentPid: process.ppid, cwd: process.cwd(), startedUtc: new Date().toISOString(), story: "A6 earned racial spells" }));
  await login(page, story.config, story.config.owner); expect((await context.cookies()).some(cookie => cookie.name.startsWith("sb-"))).toBe(true); await createComplete(page, story, freshCurrent ? "current v1 control" : "old v1"); story.controlId = story.id; await inspectSheet(page, story, "complete", 1); await page.reload(); const old = await readback(info, story, freshCurrent ? "current-v1-control-full-builder" : "old-v1-full-builder", "complete", "baseline", 1);
  story.controlBaseline = old.oldControl;
  expect(old.catalog.tiefling.version).toBe(1); expect(old.catalog.rootSnapshots).toHaveLength(1);
  if (freshCurrent) {
    // This full native target readback has already checked every control row's
    // owned source pins, declaration, exact spell versions/metadata and budgets.
    // Its complete graph fingerprint must remain unchanged at every later read.
    expect(racialSpells(old).map(spell => spell.slug).sort()).toEqual(["darkness", "hellish-rebuke", "thaumaturgy"]);
    await checkpoint(info, story, "current-v1 control has full owned Infernal Legacy tiers, Bard3 Wizard2 budgets and31HP; catalog remains1535 v1 snapshots");
  } else {
    await checkpoint(info, story, "oldv1 completeBard3 Wizard2 has31HP andonlyracialThaumaturgy"); await publish(info, story); const published = await readback(info, story, "new-root-publication-old-unchanged", "complete", "baseline", 1);
    expect(published.oldControl).toEqual(old.oldControl); expect(published.completeFingerprint).toBe(old.completeFingerprint); expect(published.pins).toEqual(old.pins); expect(published.spells).toEqual(old.spells); expect(published.catalog.definitions).toBe(old.catalog.definitions); expect(published.catalog.versions).toBe(old.catalog.versions + 1); expect(published.catalog.tiefling).toEqual({ contentId: old.catalog.tiefling.contentId, version: 2 }); expect(published.catalog.rootSnapshots).toHaveLength(2); expect(published.catalog.rootSnapshots[0]).toEqual(old.catalog.rootSnapshots[0]); expect(published.catalog.traitSnapshots).toEqual(old.catalog.traitSnapshots);
  }
  await createComplete(page, story, freshCurrent ? "current v1 target" : "new v2"); expect(story.id).not.toBe(story.controlId); await inspectSheet(page, story, "complete", targetRootVersion); await page.reload(); const initial = await readback(info, story, freshCurrent ? "current-v1-target-full-builder" : "new-v2-full-builder"); expect(racialSpells(initial).map(spell => spell.slug).sort()).toEqual(["darkness", "hellish-rebuke", "thaumaturgy"]);
  await checkpoint(info, story, "newrootfullbuilder separates Bard6known Wizard8book4prepared andthreeownedracialrows; CHA14+6 INT13+5");
  await page.goto(builder(story) + "/class"); for (const name of ["Feather Fall", "Identify"]) await setSpell(form(page, "Wizard"), name, false); await option(page, "Wizard", "Charm Person"); await setPrepared(form(page, "Wizard"), "Charm Person", false); await saveSpells(page, "Wizard"); const trimmed = await readback(info, story, "explicit-valid-wizard-subset-before-down", "trimmed-five"); expect(racialSpells(trimmed)).toEqual(racialSpells(initial)); sameRoots(initial, trimmed);
  await setLevel(page, story, "Wizard", 1); await budgets(page, "wizard-one"); const downFour = await readback(info, story, "below-five-darkness-pruned", "wizard-one"); expect(racialSpells(downFour).find(spell => spell.slug === "hellish-rebuke")).toEqual(racialSpells(initial).find(spell => spell.slug === "hellish-rebuke")); sameRoots(initial, downFour); await inspectSheet(page, story, "wizard-one", targetRootVersion);
  await setLevel(page, story, "Bard", 1); await budgets(page, "below-three"); const downTwo = await readback(info, story, "below-three-hellish-pruned", "below-three"); expect(racialSpells(downTwo).map(spell => spell.slug)).toEqual(["thaumaturgy"]); expect(racialSpells(downTwo)[0]).toEqual(racialSpells(initial).find(spell => spell.slug === "thaumaturgy")); sameRoots(initial, downTwo); await inspectSheet(page, story, "below-three", targetRootVersion);
  await setLevel(page, story, "Bard", 3); await lore(page); await average(page, "Bard", 2); await average(page, "Bard", 3); await selectSpells(page, "Bard"); await budgets(page, "restored-four"); const backFour = await readback(info, story, "earned-three-returned-on-mixed-total-four", "restored-four"); expect(racialSpells(backFour).map(spell => spell.slug).sort()).toEqual(["hellish-rebuke", "thaumaturgy"]); expect(racialSpells(backFour).find(spell => spell.slug === "hellish-rebuke")!.id).not.toBe(racialSpells(initial).find(spell => spell.slug === "hellish-rebuke")!.id); sameRoots(initial, backFour);
  await setLevel(page, story, "Wizard", 2); await average(page, "Wizard", 2); await openLevel(page, "Wizard", 2); await choose(page, choiceOption(page, /^Evocation(?:\s|$)/)); await selectSpells(page, "Wizard"); await budgets(page, "complete"); const restored = await readback(info, story, "five-restored-with-full-class-budgets"); expect(racialSpells(restored).find(spell => spell.slug === "hellish-rebuke")).toEqual(racialSpells(backFour).find(spell => spell.slug === "hellish-rebuke")); expect(racialSpells(restored).find(spell => spell.slug === "darkness")!.id).not.toBe(racialSpells(initial).find(spell => spell.slug === "darkness")!.id); sameRoots(initial, restored);
  await checkpoint(info, story, "mixedtotal5→4→2→4→5 prunesonlyunearnedtiers; retainedHellishid/time andoriginalcontrollerstable; restoredclassbudgets");
  const second = await context.newPage(); second.on("pageerror", () => story.pageErrors.push("second owner page error")); try {
    await page.goto(builder(story) + "/class"); await second.goto(builder(story) + "/class"); await budgets(page, "complete"); await budgets(second, "complete"); const before = await readback(info, story, "two-pages-same-baseline"); expect(before.completeFingerprint).toBe(restored.completeFingerprint);
    await setSpell(form(page, "Bard"), "Charm Person", false); await setSpell(form(page, "Bard"), "Faerie Fire", true); await setSpell(form(second, "Wizard"), "Identify", false); await setSpell(form(second, "Wizard"), "Alarm", true); await setPrepared(form(second, "Wizard"), "Alarm", false);
    await Promise.all([saveSpells(page, "Bard"), saveSpells(second, "Wizard")]); const after = await readback(info, story, "both-source-operations-retained", "complete", "concurrent"); expect(BigInt(after.actionRevision)).toBe(BigInt(before.actionRevision) + BigInt(2)); expect(after.historyCount).toBe(before.historyCount + 2);
    const prior = new Set(before.receipts.map(receipt => receipt.operationId)), accepted = after.receipts.filter(receipt => !prior.has(receipt.operationId)); expect(accepted).toHaveLength(2); expect(accepted.map(receipt => receipt.fields.class_slug).sort()).toEqual(["bard", "wizard"]); expect(new Set(accepted.map(receipt => receipt.operationId)).size).toBe(2); expect(accepted.map(receipt => receipt.actionRevision)).toEqual([String(BigInt(before.actionRevision) + BigInt(1)), String(BigInt(before.actionRevision) + BigInt(2))]);
    for (const receipt of accepted) { expect(receipt.operationId).toMatch(uuid); expect(receipt.actorId).toBe(story.config.owner.id); expect(receipt.characterId).toBe(story.id); expect(receipt.command).toBe("select_class_spells"); expect(receipt.request).toMatchObject({ command: receipt.command, fields: receipt.fields }); expect(receipt.receipt).toMatchObject({ actor_id: receipt.actorId, character_id: story.id, operation_id: receipt.operationId, command: receipt.command, fields: receipt.fields, action_revision: receipt.actionRevision }); const expected = classSpells(after, receipt.fields.class_slug!).map(spell => ({ content_id: spell.contentId, content_version: spell.version, prepared: spell.level > 0 && spell.prepared })); expect([...(receipt.fields.spells ?? [])].sort((a, b) => a.content_id.localeCompare(b.content_id))).toEqual(expected.sort((a, b) => a.content_id.localeCompare(b.content_id))); }
    const unrelated = (choices: Record<string, unknown>) => { const result = structuredClone(choices), selections = { ...(result.class_spell_selections as Record<string, unknown>) }; delete selections.bard; delete selections.wizard; return { ...result, class_spell_selections: selections }; }; expect(unrelated(after.choices)).toEqual(unrelated(before.choices)); expect(after.state).toEqual(before.state); expect(after.pins).toEqual(before.pins); expect(after.inventory).toEqual(before.inventory); expect(after.maximumHp).toBe(before.maximumHp); expect(after.classRoots).toEqual(before.classRoots); expect(racialSpells(after)).toEqual(racialSpells(before)); sameRoots(before, after);
    for (const owner of ["bard", "wizard"]) { const removed = owner === "bard" ? "charm-person" : "identify", added = owner === "bard" ? "faerie-fire" : "alarm"; expect(classSpells(after, owner).filter(spell => spell.slug !== added)).toEqual(classSpells(before, owner).filter(spell => spell.slug !== removed)); }
    await page.reload(); await second.reload(); for (const tab of [page, second]) { await budgets(tab, "complete"); await expect(await option(tab, "Bard", "Faerie Fire")).toHaveCount(1); await expect(await option(tab, "Bard", "Charm Person")).toHaveCount(0); await expect(await option(tab, "Wizard", "Alarm")).toHaveCount(1); await expect(await option(tab, "Wizard", "Identify")).toHaveCount(0); }
    await inspectSheet(page, story, "complete", targetRootVersion); await page.reload(); const reloaded = await readback(info, story, "both-pages-and-sheet-reloaded", "complete", "concurrent"); expect(reloaded).toEqual(after); const newId = story.id; story.id = story.controlId; await inspectSheet(page, story, "complete", 1); story.id = newId; await foreign404(browser, story); const foreign = await readback(info, story, freshCurrent ? "current-v1-control-preserved-and-foreign404" : "old-v1-preserved-and-foreign404", "complete", "concurrent"); expect(foreign).toEqual(after); expect(story.blockedOrigins).toEqual([]); expect(story.pageErrors).toEqual([]); await checkpoint(info, story, "bothoppositeclasssavesretainedat+2revisions; racialrows/controlunchanged; two-pageandsheetreload/foreign404");
    const path = info.outputPath("earned-racial-spell-workflow.json"); await writeFile(path, JSON.stringify({ actualApp: true, actualAuthCookies: true, actualPostgrest: true, uiWritesOnly: true, caseId: "A6", characterId: story.id,
      ...(freshCurrent ? { controlCharacterId: story.controlId } : { oldControlId: story.controlId }), runtime: runtimeBinding(), catalogMode: freshCurrent ? "fresh-current-v1" : "historical-v1-to-v2",
      allSixBuilderStepsSaved: true, completedSheetReloadPassed: true, foreignAccountRefused: true,
      independent2014Expectations: { finalHp: 31, level4Hp: 26, level2Hp: 14, slots: [4, 3, 2], bardKnown: 6, wizardBook: 8, wizardPrepared: 4, bardDc: 14, bardAttack: 6, wizardDc: 13, wizardAttack: 5, racialAbility: "charisma", hellishCharacterLevel: 3, darknessCharacterLevel: 5, fixedCastLevel: 2 },
      concurrency: { baselineRevision: before.actionRevision, resultingRevision: after.actionRevision, actualReceiptOrder: accepted, schedulerOrderAssumed: false }, stateScope: "no gameplay state writes; native starting-award currency unchanged after full builder; storedcurrentHPabsent; earnedfixedcast/free-useinformationdescriptiveonly; no cast/spend/recovery/M6 acceptance", gameplayStateRequests: story.gameplayStateRequests, snapshots: story.snapshots, checkpoints: story.checkpoints, blockedOrigins: story.blockedOrigins, pageErrors: story.pageErrors }, null, 2)); expect(story.gameplayStateRequests).toEqual([]); await info.attach("earned-racial-spell-workflow", { path, contentType: "application/json" });
  } finally { await second.close(); }
});
