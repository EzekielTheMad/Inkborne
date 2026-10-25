import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";

type Account = { id: string; email: string; password: string };
type Settings = { appOrigin: string; supabaseOrigin: string; owner: Account; other: Account };
type Owner = "Paladin" | "Sorcerer" | "Warlock";
type Phase = "baseline" | "concurrent";
type Spell = { id: string; slug: string; classSlug: string; contentId: string; version: number; level: number; source: string;
  known: boolean; prepared: boolean; alwaysPrepared: boolean; book: boolean; grantId: string | null; custom: Record<string, unknown>; snapshotFingerprint: string };
type Receipt = { operationId: string; actorId: string; characterId: string; command: string; actionRevision: string;
  fields: { class_slug?: string; spells?: Array<{ content_id: string; content_version: number; prepared: boolean }> }; request: Record<string, unknown>; receipt: Record<string, unknown> };
type Native = {
  evidenceKind: string; characterId: string; actorId: string; level: number; actionRevision: string; originalOccurrenceId: string;
  maximumHp: number; baseScores: Record<string, number>; effectiveScores: Record<string, number>; hasStoredCurrentHp: boolean;
  choices: Record<string, unknown>; state: Record<string, unknown>; classRoots: Array<{ slug: string; level: number; occurrenceId: string;
    controllerRefId: string; contentId: string; version: number; subclassPinId: string | null; subclassSlug: string | null }>;
  pins: unknown[]; inventory: unknown[]; spells: Spell[]; receipts: Receipt[]; historyCount: number; completeFingerprint: string;
  castingInputs: unknown[]; independentExpectations: { hp: number; regularSlots: Record<string, number>; pactSlots: number; pactLevel: number; dc: number; attack: number };
  checks: Record<string, boolean>;
};
type Story = { config: Settings; id: string; blockedOrigins: string[]; pageErrors: string[]; checkpoints: string[];
  snapshots: Array<{ label: string; path: string; data: Native }> };
const scores = { Strength: "13", Dexterity: "10", Constitution: "14", Intelligence: "8", Wisdom: "12", Charisma: "15" };
const effective = { strength: 15, dexterity: 10, constitution: 14, intelligence: 8, wisdom: 12, charisma: 16 };
const plans: Record<Owner, { cantrips: string[]; spells: string[] }> = {
  Paladin: { cantrips: [], spells: ["Bless", "Cure Wounds", "Divine Favor", "Shield of Faith"] },
  Sorcerer: { cantrips: ["Acid Splash", "Fire Bolt", "Light", "Ray of Frost"], spells: ["Magic Missile", "Shield"] },
  Warlock: { cantrips: ["Eldritch Blast", "Mage Hand"], spells: ["Charm Person", "Hellish Rebuke", "Burning Hands", "Scorching Ray"] },
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const nativeChecks = ["oneExpectedCharacter", "exactOriginalAndSecondaryRoles", "exactClassAndSubclassPins", "allFrozenSrdPinsExact",
  "exactGoldAncestryClosure", "standardArrayAndScores", "finiteClassChoicesAndFeatures", "ordinarySpellsExactByOwner",
  "ordinaryRowsHaveExactController", "independentOwnCastingInputs", "explicitAverageHpAndMaximum", "oneOriginalNativeAward",
  "inventoryFromAcceptedAward", "detailsConfirmed", "noAutomaticOrBonusSpells", "ownedReceiptsAndHistory", "fiveOrderBijections", "currentParentAndRoleOrder", "boundariesClosed"];

async function configuration(): Promise<Settings> {
  const file = process.env.INKBORNE_LOCAL_FLOW_CONFIG;
  if (!file) throw Error("Provide the isolated local browser configuration file");
  const config = JSON.parse(await readFile(file, "utf8")) as Settings;
  for (const origin of [config.appOrigin, config.supabaseOrigin]) {
    const url = new URL(origin);
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.origin !== origin) throw Error("Explicit loopback origins required");
  }
  for (const account of [config.owner, config.other]) if (!account?.email || !account.password || !uuid.test(account.id)) throw Error("Disposable accounts required");
  if (config.owner.id === config.other.id) throw Error("Distinct disposable accounts required"); return config;
}
async function restrictOrigins(context: BrowserContext, story: Story) {
  const allowed = new Set([story.config.appOrigin, story.config.supabaseOrigin]);
  await context.route("**/*", route => {
    const origin = new URL(route.request().url()).origin;
    if (!allowed.has(origin)) { story.blockedOrigins.push(origin); return route.abort(); } return route.continue();
  });
}
async function login(page: Page, config: Settings, account: Account) {
  try {
    await page.goto(config.appOrigin + "/login"); await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password); await page.getByRole("button", { name: /sign in/i }).click();
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
const builder = (story: Story) => `${story.config.appOrigin}/characters/${story.id}/builder`;
function group(page: Page, title: string, option?: string) {
  const article = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title, exact: true, level: 4 }) });
  return option ? article.filter({ has: page.getByRole("button", { name: option, exact: true }) }) : article;
}
async function openLevel(page: Page, owner: Owner, level: number) {
  const rail = page.getByRole("combobox", { name: `Set level for ${owner}`, exact: true }).locator("..").locator("..").locator("..");
  await rail.getByRole("button", { name: new RegExp(`^Level ${level}:`) }).click();
  await expect(page.locator('section[aria-labelledby="class-level-title"]').getByRole("navigation", { name: "Breadcrumb", exact: true })).toContainText(`Level ${level}`);
}
async function setLevel(page: Page, story: Story, owner: Owner, level: number) {
  await page.goto(builder(story) + "/class"); const control = page.getByRole("combobox", { name: `Set level for ${owner}`, exact: true });
  await save(page, () => control.selectOption(String(level))); await expect(control).toHaveValue(String(level)); await expect(control).toBeEnabled();
}
async function average(page: Page, owner: Owner, level: number) {
  await openLevel(page, owner, level); const radio = page.getByRole("radio", { name: /^Average \(\+/ });
  await save(page, () => radio.click()); await expect(radio).toHaveAttribute("aria-checked", "true"); await expect(radio).toBeEnabled();
}
async function addClass(page: Page, story: Story, owner: "Sorcerer" | "Warlock") {
  await page.goto(builder(story) + "/class"); await page.getByRole("button", { name: /^Add a class/ }).click();
  await page.getByRole("button", { name: new RegExp(`^${owner}\\s`) }).click();
  await save(page, () => page.getByRole("button", { name: "Pick this class", exact: true }).click());
  await expect(page.getByRole("combobox", { name: `Set level for ${owner}`, exact: true })).toHaveValue("1");
  await openLevel(page, owner, 1);
  await choose(page, page.getByRole("button", { name: owner === "Sorcerer" ? /^Draconic(?:\s|$)/ : /^Fiend(?:\s|$)/ }));
  if (owner === "Sorcerer") await choose(page, group(page, "Choose 1 feature").getByRole("button", { name: /^Dragon Ancestor Gold\s+Fire Damage$/ }));
  await average(page, owner, 1);
}
const form = (page: Page, owner: Owner) => page.getByRole("form", { name: `${owner} spell choices`, exact: true });
async function spellOption(page: Page, owner: Owner, name: string, cantrip: boolean) {
  const area = form(page, owner);
  await area.getByRole("textbox", { name: `Search ${owner.toLowerCase()} ${cantrip ? "cantrips" : "levelled spells"}`, exact: true }).fill(name);
  return area.getByRole("checkbox", { name: `Select ${name}`, exact: true });
}
async function saveSpells(page: Page, owner: Owner) {
  const area = form(page, owner); await expect(area.getByRole("button", { name: "Save spells", exact: true })).toBeEnabled();
  await save(page, () => area.getByRole("button", { name: "Save spells", exact: true }).click());
  await expect(area.getByText("Spell choices saved.", { exact: true })).toBeVisible(); await expect(area.getByRole("button", { name: "Save spells", exact: true })).toBeEnabled();
}
async function selectSpells(page: Page, owner: Owner) {
  for (const name of plans[owner].cantrips) await (await spellOption(page, owner, name, true)).check();
  for (const name of plans[owner].spells) {
    await (await spellOption(page, owner, name, false)).check();
    if (owner === "Paladin") await form(page, owner).getByRole("checkbox", { name: `Prepare ${name}`, exact: true }).check();
  }
  await assertBudget(page, owner); await saveSpells(page, owner); await page.reload();
  for (const name of [...plans[owner].cantrips, ...plans[owner].spells]) await expect(await spellOption(page, owner, name, plans[owner].cantrips.includes(name))).toBeChecked();
}
async function assertBudget(page: Page, owner: Owner) {
  const area = form(page, owner);
  await expect(area.getByText(`Cantrips: ${plans[owner].cantrips.length} / ${plans[owner].cantrips.length}`, { exact: true })).toBeVisible();
  if (owner === "Paladin") await expect(area.getByText(/^Prepared spells: 4 \/ 4\./)).toBeVisible();
  else await expect(area.getByText(`Spells known: ${owner === "Sorcerer" ? 2 : 4} / ${owner === "Sorcerer" ? 2 : 4}`, { exact: true })).toBeVisible();
}
async function createAndComplete(page: Page, story: Story) {
  await page.goto(story.config.appOrigin + "/characters/new"); const name = `Mixed A5 ${randomUUID().slice(0, 8)}`;
  await page.getByRole("textbox", { name: "What will they be called?" }).fill(name); await page.getByRole("button", { name: "Open the notebook", exact: true }).click();
  await page.waitForURL(/\/characters\/[0-9a-f-]+\/builder\/first-class$/); story.id = new URL(page.url()).pathname.split("/")[2]; expect(story.id).toMatch(uuid);
  await page.getByRole("combobox", { name: "First class", exact: true }).selectOption({ label: "Paladin" });
  await page.getByRole("button", { name: "Save first class", exact: true }).click(); await expect(page.getByText("Paladin · Level 1", { exact: true })).toBeVisible();
  await page.reload(); await page.getByRole("link", { name: "Complete class choices", exact: true }).click(); await openLevel(page, "Paladin", 1);
  for (const skill of ["Athletics", "Persuasion"]) await choose(page, group(page, "Choose 2 proficiency", "Athletics").getByRole("button", { name: skill, exact: true }));
  await page.goto(builder(story) + "/race"); await page.getByRole("button", { name: "Preview Dragonborn", exact: true }).click();
  await save(page, () => page.getByRole("button", { name: "Add Race", exact: true }).click()); await expect(page.getByRole("button", { name: "Change Race", exact: true })).toBeVisible();
  const ancestry = page.getByText("Draconic Ancestry: Choose 1", { exact: true }).locator("..").locator("..");
  await choose(page, ancestry.getByRole("button", { name: "Draconic Ancestry Gold", exact: true })); await page.reload();
  await expect(ancestry.getByRole("button", { name: "Draconic Ancestry Gold", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Next: Abilities", exact: true }).click();
  for (const [ability, score] of Object.entries(scores)) {
    const control = page.getByRole("combobox", { name: `${ability} score`, exact: true }); if (await control.inputValue() === score) continue;
    for (const other of Object.keys(scores)) if (other !== ability) {
      const occupied = page.getByRole("combobox", { name: `${other} score`, exact: true });
      if (await occupied.inputValue() === score) { await save(page, () => occupied.selectOption("")); await expect(page.getByText("Changes save automatically.", { exact: true })).toBeVisible(); }
    }
    await save(page, () => control.selectOption(score)); await expect(page.getByText("Changes save automatically.", { exact: true })).toBeVisible();
  }
  await page.reload(); for (const [ability, score] of Object.entries(scores)) await expect(page.getByRole("combobox", { name: `${ability} score`, exact: true })).toHaveValue(score);
  await page.getByRole("button", { name: "Next: Background", exact: true }).click(); await page.getByRole("button", { name: "Preview Acolyte", exact: true }).click();
  await save(page, () => page.getByRole("button", { name: "Add Background", exact: true }).click());
  const languages = page.getByText("Choose 2 language", { exact: true }).locator("..").locator("..");
  for (const language of ["Celestial", "Elvish"]) await choose(page, languages.getByRole("button", { name: language, exact: true }));
  await save(page, () => page.getByRole("button", { name: "Nothing can shake my optimistic attitude.", exact: true }).click());
  await setLevel(page, story, "Paladin", 2); await average(page, "Paladin", 2); await openLevel(page, "Paladin", 2);
  await choose(page, page.getByRole("button", { name: /^Dueling(?:\s|$)/ })); await selectSpells(page, "Paladin");
  // The one real starting award belongs to the original class before adding
  // secondary casters. No sheet inventory insertion or second award is used.
  await page.goto(builder(story) + "/equipment"); const groups = page.getByRole("group").filter({ has: page.getByRole("button", { name: /^\(a\)/ }) });
  await expect(groups.first()).toBeVisible(); for (let index = 0; index < await groups.count(); index++) await choose(page, groups.nth(index).getByRole("button").first());
  const slots = page.getByRole("combobox"); for (let index = 0; index < await slots.count(); index++) {
    const slot = slots.nth(index); await slot.click(); await expect(page.getByRole("listbox")).toBeVisible();
    const sword = page.getByRole("option", { name: "Longsword", exact: true }); const option = await sword.count() ? sword : page.getByRole("option").first();
    await save(page, () => option.click()); await expect(slot).toBeEnabled();
  }
  await expect(page.getByRole("button", { name: "Confirm Equipment", exact: true })).toBeEnabled(); await page.getByRole("button", { name: "Confirm Equipment", exact: true }).click();
  await expect(page.getByText("Starting equipment award recorded", { exact: true })).toBeVisible(); await page.reload(); await expect(page.getByText("Starting equipment award recorded", { exact: true })).toBeVisible();
  await addClass(page, story, "Sorcerer"); await selectSpells(page, "Sorcerer"); await addClass(page, story, "Warlock");
  await setLevel(page, story, "Warlock", 3); await openLevel(page, "Warlock", 3); await choose(page, group(page, "Choose 1 feature").getByRole("button", { name: "Pact Of The Blade", exact: true }));
  await average(page, "Warlock", 2); await average(page, "Warlock", 3); await selectSpells(page, "Warlock"); await openLevel(page, "Warlock", 2);
  for (const name of ["Eldritch Invocation Agonizing Blast", "Eldritch Invocation Repelling Blast"]) await choose(page, group(page, "Choose 2 invocation").getByRole("button", { name, exact: true }));
  await page.goto(builder(story) + "/details"); await page.getByRole("textbox", { name: "Character name", exact: true }).fill(name);
  await page.getByRole("combobox", { name: "Alignment", exact: true }).selectOption("Neutral Good"); await save(page, () => page.getByRole("button", { name: "Save details", exact: true }).click());
  await expect(page.getByText("Character details saved.", { exact: true })).toBeVisible(); await page.reload();
  const nav = page.getByRole("navigation", { name: "Character builder", exact: true }); for (const step of ["class", "race", "abilities", "background", "equipment", "details"]) await expect(nav.locator(`a[href$="/builder/${step}"]`)).toContainText("Saved");
  await page.getByRole("button", { name: "Review & Finish", exact: true }).click(); await page.getByRole("button", { name: "Finish & View Character", exact: true }).click();
  await expect(page).toHaveURL(`${story.config.appOrigin}/characters/${story.id}`); await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}
async function inspectSheet(page: Page, story: Story, paladinLevel: 1 | 2, phase: Phase) {
  await page.goto(`${story.config.appOrigin}/characters/${story.id}`);
  await expect(page.getByRole("button", { name: "HP tracker — click to heal or damage", exact: true })).toContainText(paladinLevel === 2 ? "/48" : "/40");
  await expect(page.getByText("AC", { exact: true }).filter({ visible: true }).first().locator("..").locator("p").last()).toHaveText("13");
  for (const [ability, value] of Object.entries(effective)) await expect(page.getByRole("button", { name: `Roll ${ability[0].toUpperCase() + ability.slice(1)} check`, exact: true }).locator("p").last()).toHaveText(String(value));
  const defenses = page.getByRole("heading", { name: "Defenses", exact: true }).locator(".."); await expect(defenses.getByText("fire", { exact: true })).toBeVisible();
  for (const ability of ["Wisdom", "Charisma"]) await expect(page.getByRole("button", { name: `Roll ${ability} saving throw`, exact: true }).getByLabel("Proficient", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Roll Constitution saving throw", exact: true }).getByLabel("Proficient", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Spells", exact: true }).click();
  for (const text of ["Cantrips: 6/6", "Ordinary Spells Known: 6/6", ...(paladinLevel === 2 ? ["Prepared: 4/4"] : [])]) await expect(page.getByText(text, { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText(/^Save DC\s*14$/).filter({ visible: true })).toBeVisible(); await expect(page.getByText(/^Attack\s*\+6$/).filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark 1st slot used", exact: true }).filter({ visible: true })).toHaveCount(paladinLevel === 2 ? 3 : 2);
  await expect(page.getByRole("button", { name: "Mark 2nd slot used", exact: true }).filter({ visible: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mark Pact slot used", exact: true }).filter({ visible: true })).toHaveCount(2);
  for (const owner of ["Sorcerer", "Warlock"] as const) for (const name of [...plans[owner].cantrips, ...plans[owner].spells]) {
    const replaced = phase === "concurrent" && (name === "Shield" || name === "Charm Person"); await expect(page.getByText(name, { exact: true }).filter({ visible: true })).toHaveCount(replaced ? 0 : 1);
  }
  if (phase === "concurrent") for (const name of ["Sleep", "Shatter"]) await expect(page.getByText(name, { exact: true }).filter({ visible: true })).toHaveCount(1);
  for (const name of plans.Paladin.spells) await expect(page.getByText(name, { exact: true }).filter({ visible: true })).toHaveCount(paladinLevel === 2 ? 1 : 0);
  // Read-only configuration preview proves Pact's actual level independently
  // from the two dots. No cast, slot spend, resource or state write is made.
  await page.getByRole("button", { name: "Cast Scorching Ray", exact: true }).click(); const dialog = page.getByRole("dialog", { name: "Cast: Scorching Ray", exact: true });
  await expect(dialog).toContainText("Cast as Warlock (Charisma)."); await expect(dialog).toContainText("Ranged spell attack +6");
  await expect(dialog.getByRole("radio", { name: /^Pact 2nd/ })).toBeVisible(); await expect(dialog.getByRole("radio")).toHaveCount(1); await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
}
async function readback(info: TestInfo, story: Story, label: string, paladinLevel: 1 | 2 = 2, phase: Phase = "baseline"): Promise<Native> {
  const file = process.env.INKBORNE_LOCAL_FLOW_CONFIG; if (!file || !uuid.test(story.id)) throw Error("Local native evidence configuration required");
  const state = JSON.parse(await readFile(resolve(dirname(file), "../state.json"), "utf8"));
  if (state.project !== "inkborne-app-flow-20261022" || state.ready !== true || state.stoppedUtc) throw Error("Wrong disposable runtime");
  const db = state.containers.find((item: { name: string }) => item.name === `/${state.project}-db`); if (!db || !/^[a-f0-9]{64}$/.test(db.id)) throw Error("Missing owned database identity");
  const processes: unknown[] = []; const run = (args: string[], input?: string) => {
    const startedUtc = new Date().toISOString(); const result = spawnSync("C:/Users/kaios/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe", ["--context", "desktop-linux", ...args],
      { cwd: process.cwd(), input, encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 3 * 1024 * 1024 });
    processes.push({ pid: result.pid, parentPid: process.pid, cwd: process.cwd(), args, startedUtc, finishedUtc: new Date().toISOString(), exitCode: result.status });
    if (result.status !== 0) throw Error("Owned read-only mixed-caster evidence failed; raw output withheld"); return result.stdout.trim();
  };
  expect(run(["info", "--format", "{{.ID}}"])).toBe(state.engineId); const identity = JSON.parse(run(["inspect", "--format", '{"id":{{json .Id}},"labels":{{json .Config.Labels}},"status":{{json .State.Status}}}', db.id]));
  expect(identity.id).toBe(db.id); expect(identity.labels["com.docker.compose.project"]).toBe(state.project); expect(identity.status).toBe("running");
  const reports: Record<string, Record<string, unknown>> = {};
  for (const reader of ["mixed-caster-builders-readback.sql", "builder-class-choices-readback.sql", "builder-bonus-spells-readback.sql"]) {
    const sql = await readFile(resolve(process.cwd(), "supabase/verification", reader), "utf8");
    reports[reader] = JSON.parse(run(["exec", "-i", db.id, "psql", "-X", "--no-password", "--host", "/var/run/postgresql", "--username", "supabase_admin", "--dbname", "postgres", "--quiet", "--tuples-only", "--no-align",
      "--set", "ON_ERROR_STOP=1", "--set", `character_id=${story.id}`, "--set", `paladin_level=${paladinLevel}`, "--set", `spell_phase=${phase}`, "--file", "-"], sql));
  }
  const data = reports["mixed-caster-builders-readback.sql"] as unknown as Native, path = info.outputPath(`mixed-caster-native-${story.snapshots.length + 1}-${label}.json`);
  await writeFile(path, JSON.stringify({ observedUtc: new Date().toISOString(), label, processes, reports }, null, 2)); story.snapshots.push({ label, path, data });
  expect(data.evidenceKind).toBe("read_only_after_actual_A5_mixed_caster_app_actions"); expect(data.characterId).toBe(story.id); expect(data.actorId).toBe(story.config.owner.id);
  expect(data.level).toBe(paladinLevel + 4); expect(data.maximumHp).toBe(paladinLevel === 2 ? 48 : 40); expect(data.hasStoredCurrentHp).toBe(false);
  expect(data.baseScores).toEqual(Object.fromEntries(Object.entries(scores).map(([key, value]) => [key.toLowerCase(), Number(value)]))); expect(data.effectiveScores).toEqual(effective);
  expect(data.independentExpectations).toEqual({ hp: paladinLevel === 2 ? 48 : 40, regularSlots: { "1": paladinLevel === 2 ? 3 : 2 }, pactSlots: 2, pactLevel: 2, dc: 14, attack: 6 });
  expect(Object.keys(data.checks).sort()).toEqual([...nativeChecks].sort()); for (const key of nativeChecks) expect(data.checks[key], `${label}: ${key}`).toBe(true);
  const family = reports["builder-class-choices-readback.sql"]; for (const key of ["all_pinned_versions_exact", "feature_grants_exact", "physical_feature_grant_links_exact", "active_feature_projections_exact", "spell_grants_exact", "all_spell_rows_exact", "active_spell_grants_projected", "all_choice_checks", "all_child_checks", "all_favored_checks", "all_five_order_bijections", "all_boundaries_closed"]) expect(family[key], `${label}: ${key}`).toBe(true);
  const bonus = reports["builder-bonus-spells-readback.sql"]; for (const key of ["ordinaryClassListsValid", "allChoicesValid", "allBonusRowsOwned", "parentOrderRevisionEqual"]) expect(bonus[key], `${label}: ${key}`).toBe(true);
  expect(bonus.fiendFreeSpellRows).toBe(0); expect(bonus.bonusRows).toEqual([]); expect(bonus.capsRemaining).toBe(0); expect(bonus.writerReadiness).toBe(0);
  expect(bonus.classGate).toBe(false); expect(bonus.hitDieGate).toBe(false); expect(bonus.servicePrivateUsage).toBe(false);
  return data;
}
async function checkpoint(info: TestInfo, story: Story, label: string) {
  story.checkpoints.push(label); await writeFile(info.outputPath("mixed-caster-progress.json"), JSON.stringify({ actualApp: true, observedUtc: new Date().toISOString(), characterId: story.id,
    checkpoints: story.checkpoints, blockedOrigins: story.blockedOrigins, pageErrors: story.pageErrors }, null, 2));
}
const ownerSpells = (data: Native, owner: string) => data.spells.filter(spell => spell.classSlug === owner);
function sameOwnerSources(before: Native, after: Native, owner: string) {
  expect(after.classRoots.find(root => root.slug === owner)).toEqual(before.classRoots.find(root => root.slug === owner)); expect(ownerSpells(after, owner)).toEqual(ownerSpells(before, owner));
}
async function foreign404(browser: Browser, story: Story) {
  const context = await browser.newContext(); await restrictOrigins(context, story);
  try { const page = await context.newPage(); page.on("pageerror", () => story.pageErrors.push("other-account browser error")); await login(page, story.config, story.config.other);
    expect((await page.goto(`${story.config.appOrigin}/characters/${story.id}`))?.status()).toBe(404);
  } finally { await context.close(); }
}

test("A5 full half-pact caster keeps independent budgets and both concurrent owner saves", async ({ page, context, browser }, info) => {
  test.setTimeout(600000); const story: Story = { config: await configuration(), id: "", blockedOrigins: [], pageErrors: [], checkpoints: [], snapshots: [] };
  await restrictOrigins(context, story); page.on("pageerror", () => story.pageErrors.push("owner browser error"));
  console.log(JSON.stringify({ workerPid: process.pid, parentPid: process.ppid, cwd: process.cwd(), startedUtc: new Date().toISOString(), story: "A5 mixed casters" }));
  await login(page, story.config, story.config.owner); expect((await context.cookies()).some(cookie => cookie.name.startsWith("sb-"))).toBe(true);
  await createAndComplete(page, story); await inspectSheet(page, story, 2, "baseline"); await page.reload();
  const initial = await readback(info, story, "all-six-saved-finished-reloaded"); await checkpoint(info, story, "full Gold Dragonborn Paladin2 Sorcerer1 Warlock3 HP48 AC13 regular3L1 Pact2L2 fire-resistance");
  await setLevel(page, story, "Paladin", 1);
  // The genuine frozen Paladin1 row explicitly has zero slots, so the generic
  // form may remain. It must offer no levelled spells or retained preparation.
  await expect(form(page, "Paladin").locator('section[aria-label="Paladin levelled spells"]')).toHaveCount(0);
  const down = await readback(info, story, "paladin-one-prunes-only-own-preparation", 1);
  for (const owner of ["sorcerer", "warlock"]) sameOwnerSources(initial, down, owner); expect(down.originalOccurrenceId).toBe(initial.originalOccurrenceId); expect(down.inventory).toEqual(initial.inventory); expect(ownerSpells(down, "paladin")).toEqual([]);
  await inspectSheet(page, story, 1, "baseline"); await setLevel(page, story, "Paladin", 2); await average(page, "Paladin", 2); await openLevel(page, "Paladin", 2);
  await choose(page, page.getByRole("button", { name: /^Dueling(?:\s|$)/ })); await expect(form(page, "Paladin").getByText(/^Prepared spells: 0 \/ 4\./)).toBeVisible(); await selectSpells(page, "Paladin");
  const restored = await readback(info, story, "paladin-two-spells-reselected"); for (const owner of ["sorcerer", "warlock"]) sameOwnerSources(initial, restored, owner);
  expect(restored.originalOccurrenceId).toBe(initial.originalOccurrenceId); expect(restored.inventory).toEqual(initial.inventory); await checkpoint(info, story, "half-caster down/up changes only own preparation and regular contribution; secondary identities retained");
  const second = await context.newPage(); second.on("pageerror", () => story.pageErrors.push("second owner page error"));
  try {
    await page.goto(builder(story) + "/class"); await second.goto(builder(story) + "/class");
    for (const owner of ["Paladin", "Sorcerer", "Warlock"] as const) { await assertBudget(page, owner); await assertBudget(second, owner); }
    const before = await readback(info, story, "two-pages-same-baseline"); expect(before.completeFingerprint).toBe(restored.completeFingerprint);
    await (await spellOption(page, "Sorcerer", "Shield", false)).uncheck(); await (await spellOption(page, "Sorcerer", "Sleep", false)).check();
    await (await spellOption(second, "Warlock", "Charm Person", false)).uncheck(); await (await spellOption(second, "Warlock", "Shatter", false)).check();
    await assertBudget(page, "Sorcerer"); await assertBudget(second, "Warlock");
    await Promise.all([saveSpells(page, "Sorcerer"), saveSpells(second, "Warlock")]);
    const after = await readback(info, story, "both-controller-saves-retained", 2, "concurrent"); expect(BigInt(after.actionRevision)).toBe(BigInt(before.actionRevision) + 2n); expect(after.historyCount).toBe(before.historyCount + 2);
    const prior = new Set(before.receipts.map(receipt => receipt.operationId)), accepted = after.receipts.filter(receipt => !prior.has(receipt.operationId)); expect(accepted).toHaveLength(2);
    expect(accepted.map(receipt => receipt.fields.class_slug).sort()).toEqual(["sorcerer", "warlock"]); expect(new Set(accepted.map(receipt => receipt.operationId)).size).toBe(2);
    expect(accepted.map(receipt => receipt.actionRevision)).toEqual([String(BigInt(before.actionRevision) + 1n), String(BigInt(before.actionRevision) + 2n)]);
    for (const receipt of accepted) {
      expect(receipt.operationId).toMatch(uuid); expect(receipt.actorId).toBe(story.config.owner.id); expect(receipt.characterId).toBe(story.id); expect(receipt.command).toBe("select_class_spells");
      expect(receipt.receipt).toMatchObject({ actor_id: receipt.actorId, character_id: story.id, operation_id: receipt.operationId, command: receipt.command, fields: receipt.fields, action_revision: receipt.actionRevision });
      expect(receipt.request).toMatchObject({ command: receipt.command, fields: receipt.fields });
      const pins = ownerSpells(after, receipt.fields.class_slug!).map(spell => ({ content_id: spell.contentId, content_version: spell.version, prepared: false }));
      expect([...(receipt.fields.spells ?? [])].sort((a, b) => a.content_id.localeCompare(b.content_id))).toEqual(pins.sort((a, b) => a.content_id.localeCompare(b.content_id)));
    }
    const unrelated = (choices: Record<string, unknown>) => { const result = structuredClone(choices), selections = { ...(result.class_spell_selections as Record<string, unknown>) }; delete selections.sorcerer; delete selections.warlock; return { ...result, class_spell_selections: selections }; };
    expect(unrelated(after.choices)).toEqual(unrelated(before.choices)); expect(after.state).toEqual(before.state); expect(after.maximumHp).toBe(before.maximumHp); expect(after.inventory).toEqual(before.inventory); expect(after.pins).toEqual(before.pins); expect(after.classRoots).toEqual(before.classRoots); sameOwnerSources(before, after, "paladin");
    for (const owner of ["sorcerer", "warlock"]) { const removed = owner === "sorcerer" ? "shield" : "charm-person", added = owner === "sorcerer" ? "sleep" : "shatter";
      expect(ownerSpells(after, owner).filter(spell => spell.slug !== added)).toEqual(ownerSpells(before, owner).filter(spell => spell.slug !== removed)); }
    await page.reload(); await second.reload(); for (const tab of [page, second]) {
      await expect(await spellOption(tab, "Sorcerer", "Sleep", false)).toBeChecked(); await expect(await spellOption(tab, "Sorcerer", "Shield", false)).not.toBeChecked();
      await expect(await spellOption(tab, "Warlock", "Shatter", false)).toBeChecked(); await expect(await spellOption(tab, "Warlock", "Charm Person", false)).not.toBeChecked();
      for (const owner of ["Paladin", "Sorcerer", "Warlock"] as const) await assertBudget(tab, owner);
    }
    await inspectSheet(page, story, 2, "concurrent"); await page.reload(); const reloaded = await readback(info, story, "both-pages-and-sheet-reloaded", 2, "concurrent"); expect(reloaded).toEqual(after);
    await foreign404(browser, story); const foreign = await readback(info, story, "foreign404-current-source-unchanged", 2, "concurrent"); expect(foreign).toEqual(after);
    expect(story.blockedOrigins).toEqual([]); expect(story.pageErrors).toEqual([]); await checkpoint(info, story, "two real opposite-controller operations both accepted at +2 revisions; both sources retained after two-page and sheet reload; foreign404");
    const path = info.outputPath("mixed-caster-workflow.json"); await writeFile(path, JSON.stringify({ actualApp: true, actualAuthCookies: true, actualPostgrest: true, uiWritesOnly: true, caseId: "A5", characterId: story.id,
      allSixBuilderStepsSaved: true, completedSheetReloadPassed: true, foreignAccountRefused: true, independent2014Expectations: { hp: 48, paladinOneHp: 40, ac: 13, regularL1: 3, paladinOneRegularL1: 2, pactCount: 2, pactLevel: 2, dc: 14, attack: 6 },
      concurrency: { baselineRevision: before.actionRevision, resultingRevision: after.actionRevision, actualReceiptOrder: accepted, schedulerOrderAssumed: false },
      stateScope: "stored current_hp remains absent; no Heal, cast, spend, state producer or present-state clamp acceptance", snapshots: story.snapshots, checkpoints: story.checkpoints, blockedOrigins: story.blockedOrigins, pageErrors: story.pageErrors }, null, 2));
    await info.attach("mixed-caster-workflow", { path, contentType: "application/json" });
  } finally { await second.close(); }
});
