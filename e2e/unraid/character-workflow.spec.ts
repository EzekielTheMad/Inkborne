import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test, expect, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { nativeJson } from "../../scripts/unraid/native";
import { verifyNativeParentFixture } from "../../scripts/unraid/native-parent";
import { asiOption, choiceGroup, choiceOption, hpOption, optionPicked, pickOption } from "../local-app/dropdown-helpers";

// One focused scratch-runtime workflow. Historical parent/A4/F3 acceptance is separate.
type Account = { id: string; email: string; password: string };
type Config = { appOrigin: string; supabaseOrigin: string; owner: Account; other: Account; anonKey: string; serviceRoleKey: string };
type Native = {
  characterId: string; actorId: string; level: number; actionRevision: string; enrolled: boolean; originalOccurrenceId: string;
  scores: Record<string, number>; state: Record<string, unknown>; fixtureFingerprint: string;
  choices: { race: string; background: string; ability_method: string; details_confirmed: boolean;
    classes: Array<{ slug: string; level: number; subclass: string; occurrence_id: string }>;
    asi_choices: Record<string, unknown>; hp_rolls: Record<string, unknown>; starting_equipment: { confirmed: boolean } };
  classRoles: { status: string; character_id: string; action_revision: string; original_occurrence_id: string;
    class_sources: Array<{ role: string; occurrence_id: string; controller_ref_id: string; content_id: string; content_version: number }> };
  firstClassProofs: Array<{ phase: string; actorId: string; beforeRevision: string; afterRevision: string }>;
  receipts: Array<{ operationId: string; command: string; receipt: unknown }>;
  startingAwards: Array<{ id: string; status: string; canonical_intent: { sources: {
    class: { id: string; version: number }; background: { id: string; version: number } } };
    receipt: { inventory_ids: string[]; plan: { items: unknown[] } } }>;
  orderBijections: Record<string, boolean>; parentOrderRevisionEqual: boolean; capsRemaining: number; sealsRemaining: number;
  readinessCount: number; readyCount: number; classGate: boolean; hitDieGate: boolean; servicePrivateUsage: boolean;
};
type Readback = { native: Native; family: Record<string, unknown> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const scores = { Strength: "15", Dexterity: "14", Constitution: "13", Intelligence: "12", Wisdom: "10", Charisma: "8" };
const familyChecks = ["all_pinned_versions_exact", "feature_grants_exact", "physical_feature_grant_links_exact", "active_feature_projections_exact",
  "spell_grants_exact", "all_spell_rows_exact", "active_spell_grants_projected", "all_choice_checks", "all_child_checks", "all_favored_checks",
  "all_five_order_bijections", "all_boundaries_closed"];

async function settings(): Promise<Config> {
  let config: Config;
  try {
    const path = process.env.INKBORNE_TEST_CONFIG; if (!path) throw Error();
    config = JSON.parse(await readFile(path, "utf8")) as Config;
  } catch { throw Error("Restricted scratch-test configuration unavailable; contents withheld"); }
  assert.equal(config.appOrigin, "http://127.0.0.1:3001"); assert.equal(config.supabaseOrigin, "http://127.0.0.1:9999");
  for (const account of [config.owner, config.other]) {
    if (!account || !uuid.test(account.id) || typeof account.email !== "string" || !account.email
      || typeof account.password !== "string" || !account.password) throw Error("Two genuine scratch-test accounts required; credentials withheld");
  }
  assert.notEqual(config.owner.id, config.other.id);
  if (typeof config.anonKey !== "string" || !config.anonKey || typeof config.serviceRoleKey !== "string" || !config.serviceRoleKey) {
    throw Error("Scratch-only API keys required; values withheld");
  }
  return config;
}
async function restrict(context: BrowserContext, config: Config, blocked: string[]) {
  const allowed = new Set([config.appOrigin, config.supabaseOrigin]);
  await context.route("**/*", route => {
    const origin = new URL(route.request().url()).origin;
    if (!allowed.has(origin)) { blocked.push(origin); return route.abort(); }
    return route.continue();
  });
}
async function login(page: Page, config: Config, account: Account) {
  try {
    await page.goto(config.appOrigin + "/login"); await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password); await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(config.appOrigin + "/dashboard", { timeout: 60000 });
  } catch { await page.close(); throw Error("Actual scratch-app sign-in failed; credentials withheld"); }
  expect((await page.context().cookies()).some(cookie => cookie.name.startsWith("sb-"))).toBe(true);
}
async function save(page: Page, change: () => Promise<unknown>) {
  const path = new URL(page.url()).pathname;
  const [response] = await Promise.all([page.waitForResponse(item => item.request().method() === "POST" && new URL(item.url()).pathname === path), change()]);
  expect(response.status(), "The real app save must finish before another edit").toBe(200);
}
async function choose(page: Page, option: Locator) {
  if (!await optionPicked(option)) await save(page, () => pickOption(option));
  await expect(option).toHaveJSProperty("selected", true); await expect(option).toBeEnabled();
}
async function openLevel(page: Page, level: number) {
  await page.getByRole("button", { name: new RegExp(`^Level ${level}:`) }).click();
  await expect(page.locator('section[aria-labelledby="class-level-title"]').getByRole("navigation", { name: "Breadcrumb", exact: true })).toContainText(`Level ${level}`);
}
async function readback(characterId: string, actorId: string): Promise<Readback> {
  const variables = { character_id: characterId, actor_id: actorId };
  const native = await nativeJson(await readFile(resolve(process.cwd(), "supabase/verification/builder-parent-admission-readback.sql"), "utf8"), variables) as Native;
  const family = await nativeJson(await readFile(resolve(process.cwd(), "supabase/verification/builder-class-choices-readback.sql"), "utf8"), variables) as Record<string, unknown>;
  expect(native.characterId).toBe(characterId); expect(native.actorId).toBe(actorId); expect(native.enrolled).toBe(true); expect(native.level).toBe(4);
  expect(native.originalOccurrenceId).toMatch(uuid); expect(native.classRoles.status).toBe("available");
  expect(native.classRoles.character_id).toBe(characterId); expect(native.classRoles.action_revision).toBe(native.actionRevision);
  expect(native.classRoles.original_occurrence_id).toBe(native.originalOccurrenceId); expect(native.classRoles.class_sources).toHaveLength(1);
  expect(native.classRoles.class_sources[0]).toMatchObject({ role: "original", occurrence_id: native.originalOccurrenceId });
  expect(native.classRoles.class_sources[0].controller_ref_id).toMatch(uuid); expect(native.classRoles.class_sources[0].content_version).toBeGreaterThan(0);
  expect(native.firstClassProofs).toHaveLength(1); expect(native.firstClassProofs[0]).toMatchObject({ phase: "observed", actorId });
  expect(BigInt(native.firstClassProofs[0].afterRevision)).toBeGreaterThan(BigInt(native.firstClassProofs[0].beforeRevision));
  expect(native.choices).toMatchObject({ race: "human", background: "acolyte", ability_method: "standard_array", details_confirmed: true,
    classes: [{ slug: "fighter", level: 4, subclass: "champion", occurrence_id: native.originalOccurrenceId }],
    hp_rolls: { "fighter-2": { method: "average", value: 6 }, "fighter-3": { method: "average", value: 6 }, "fighter-4": { method: "average", value: 6 } } });
  expect(native.scores).toEqual(Object.fromEntries(Object.entries(scores).map(([ability, value]) => [ability.toLowerCase(), Number(value)])));
  expect(Object.values(native.choices.asi_choices)).toEqual([{ mode: "asi", allocations: [{ ability: "strength", amount: 2 }] }]);
  expect(family.exact_frozen_pins).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "feature",
    slug: Object.keys(native.choices.asi_choices)[0], feature_grant_id: expect.any(String) })]));
  expect(Object.keys(native.orderBijections).sort()).toEqual(["feature_grants", "inventory", "pins", "spell_grants", "spells"]);
  expect(Object.values(native.orderBijections).every(Boolean)).toBe(true); expect(native.parentOrderRevisionEqual).toBe(true);
  expect(native.capsRemaining).toBe(0); expect(native.sealsRemaining).toBe(0); expect(native.readinessCount).toBe(13); expect(native.readyCount).toBe(0);
  expect(native.classGate).toBe(false); expect(native.hitDieGate).toBe(false); expect(native.servicePrivateUsage).toBe(false);
  for (const check of familyChecks) expect(family[check], check).toBe(true);
  for (const command of ["select_race", "save_abilities", "select_background", "background_choice", "fighting_style", "select_subclass", "set_class_level", "save_hp_roll", "select_asi", "save_details", "select_equipment"]) {
    expect(native.receipts.some(receipt => receipt.command === command), `genuine ${command} receipt`).toBe(true);
  }
  return { native, family };
}

async function directParentProbes(config: Config, before: Readback) {
  // All JWTs and keys stay in this Node worker, never in browser globals or evidence.
  let serviceClaims: { role?: string };
  try { serviceClaims = JSON.parse(Buffer.from(config.serviceRoleKey.split(".")[1], "base64url").toString("utf8")); }
  catch { throw Error("Scratch service JWT unavailable; key withheld"); }
  expect(serviceClaims.role).toBe("service_role");
  const token = async (account: Account) => {
    const response = await fetch(config.supabaseOrigin + "/auth/v1/token?grant_type=password", { method: "POST",
      headers: { apikey: config.anonKey, "Content-Type": "application/json" }, body: JSON.stringify({ email: account.email, password: account.password }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Error("Scratch JWT authentication failed; response and credentials withheld");
    const data = await response.json(); if (typeof data.access_token !== "string") throw Error("Scratch JWT unavailable");
    const claims = JSON.parse(Buffer.from(data.access_token.split(".")[1], "base64url").toString("utf8"));
    expect(claims.sub).toBe(account.id); expect(claims.role).toBe("authenticated");
    return data.access_token as string;
  };
  const owner = await token(config.owner), foreign = await token(config.other), attempts = [];
  for (const [actor, bearer] of [["owner", owner], ["service", config.serviceRoleKey], ["foreign", foreign]] as const) {
    const response = await fetch(config.supabaseOrigin + `/rest/v1/characters?id=eq.${before.native.characterId}`, { method: "PATCH",
      headers: { apikey: config.anonKey, Authorization: "Bearer " + bearer, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ state: { ...before.native.state, smoke_parent_bypass_probe: true } }), signal: AbortSignal.timeout(15000) });
    const body = await response.json();
    if (actor === "foreign") { expect(response.status).toBe(200); expect(body).toEqual([]); }
    else {
      if (response.ok) throw Error(`Protected ${actor} mechanical PATCH unexpectedly succeeded; stop verification`);
      expect(response.status).toBe(403); expect(body.code).toBe("42501");
    }
    expect(await readback(before.native.characterId, before.native.actorId)).toEqual(before);
    attempts.push({ actor, http: response.status, code: actor === "foreign" ? null : "42501", affectedRows: actor === "foreign" ? 0 : null,
      retainedFingerprint: before.native.fixtureFingerprint });
  }
  return attempts;
}

test("genuine Fighter completes the builder, receives its original award and reloads with owner isolation", async ({ page, context, browser }, info) => {
  test.setTimeout(720000);
  const config = await settings(), blockedOrigins: string[] = [], pageErrors: string[] = [], runId = randomUUID();
  await restrict(context, config, blockedOrigins); page.on("pageerror", () => pageErrors.push("owner browser error"));
  await login(page, config, config.owner); await page.goto(config.appOrigin + "/characters/new");
  const name = `Unraid Fighter ${runId.slice(0, 8)}`;
  await page.getByRole("textbox", { name: "What will they be called?" }).fill(name); await page.getByRole("button", { name: "Open the notebook", exact: true }).click();
  await page.waitForURL(/\/characters\/[a-f0-9-]+\/builder\/first-class$/);
  const characterId = new URL(page.url()).pathname.split("/")[2]; expect(characterId).toMatch(uuid);
  const base = `${config.appOrigin}/characters/${characterId}/builder`, sheet = `${config.appOrigin}/characters/${characterId}`;
  await page.getByRole("combobox", { name: "First class", exact: true }).selectOption({ label: "Fighter" });
  await page.getByRole("button", { name: "Save first class", exact: true }).click(); await expect(page.getByText("Fighter · Level 1", { exact: true })).toBeVisible();
  await page.reload(); await page.getByRole("link", { name: "Complete class choices", exact: true }).click(); await openLevel(page, 1);
  const skills = choiceGroup(page, "Choose 2 proficiency");
  await choose(page, choiceOption(skills, "Athletics")); await expect(choiceOption(skills, "Athletics")).toHaveCount(1);
  await choose(page, choiceOption(skills, "Perception")); await choose(page, choiceOption(page, /^Defense(?:\s|$)/));
  await page.goto(base + "/race"); await page.getByRole("combobox", { name: "Choose Race", exact: true }).selectOption({ label: "Human" });
  await save(page, () => page.getByRole("button", { name: "Add Race", exact: true }).click()); await expect(page.getByRole("button", { name: "Change Race", exact: true })).toBeEnabled();
  const humanLanguage = page.getByRole("combobox", { name: "Choose 1 language", exact: true });
  const humanLanguageOffered = await humanLanguage.count() > 0;
  if (humanLanguageOffered) { await expect(choiceOption(page, "Common")).toHaveCount(0); await choose(page, choiceOption(page, "Dwarvish")); }
  await page.goto(base + "/abilities"); await expect(page.getByRole("combobox", { name: "Method", exact: true })).toHaveValue("standard_array");
  for (const [ability, value] of Object.entries(scores)) {
    const control = page.getByRole("combobox", { name: `${ability} score`, exact: true });
    if (await control.inputValue() === value) continue;
    for (const other of Object.keys(scores)) if (other !== ability) {
      const occupied = page.getByRole("combobox", { name: `${other} score`, exact: true });
      if (await occupied.inputValue() === value) await save(page, () => occupied.selectOption(""));
    }
    await save(page, () => control.selectOption(value)); await expect(page.getByText("Changes save automatically.", { exact: true })).toBeVisible();
  }
  await page.reload(); for (const [ability, value] of Object.entries(scores)) await expect(page.getByRole("combobox", { name: `${ability} score`, exact: true })).toHaveValue(value);
  await page.goto(base + "/background"); await page.getByRole("combobox", { name: "Choose Background", exact: true }).selectOption({ label: "Acolyte" });
  await save(page, () => page.getByRole("button", { name: "Add Background", exact: true }).click());
  const languages = choiceGroup(page, "Choose 2 language"); await expect(choiceOption(languages, "Common")).toHaveCount(0);
  if (humanLanguageOffered) await expect(choiceOption(languages, "Dwarvish")).toHaveCount(0);
  for (const language of ["Celestial", "Elvish"]) await choose(page, choiceOption(languages, language));
  await choose(page, choiceOption(page, "Nothing can shake my optimistic attitude."));
  await page.goto(base + "/class"); const level = page.getByRole("combobox", { name: "Set level for Fighter", exact: true });
  await save(page, () => level.selectOption("4")); await expect(level).toHaveValue("4"); await expect(level).toBeEnabled();
  await openLevel(page, 3); await expect(choiceOption(page, /Evocation/)).toHaveCount(0); await choose(page, choiceOption(page, /^Champion(?:\s|$)/));
  for (const value of [2, 3, 4]) {
    await openLevel(page, value); const average = hpOption(page, "average");
    await save(page, () => pickOption(average)); await expect(average).toHaveJSProperty("selected", true); await expect(average).toBeEnabled();
  }
  await choose(page, asiOption(page, "strength")); await page.reload(); await openLevel(page, 4); await expect(asiOption(page, "strength")).toHaveJSProperty("selected", true);
  await page.goto(base + "/details"); await page.getByRole("textbox", { name: "Character name", exact: true }).fill(name);
  await page.getByRole("combobox", { name: "Alignment", exact: true }).selectOption("Neutral Good");
  await save(page, () => page.getByRole("button", { name: "Save details", exact: true }).click()); await expect(page.getByText("Character details saved.", { exact: true })).toBeVisible();
  await page.goto(base + "/equipment");
  const equipmentChoices = page.locator("select").filter({ has: page.locator('option[value="a"]') }); await expect(equipmentChoices.first()).toBeVisible();
  for (let index = 0; index < await equipmentChoices.count(); index++) await choose(page, equipmentChoices.nth(index).locator('option[value="a"]'));
  const slots = page.locator('button[data-slot="select-trigger"]');
  for (let index = 0; index < await slots.count(); index++) {
    const slot = slots.nth(index); await slot.click(); const menu = page.getByRole("listbox"); await expect(menu).toBeVisible();
    const sword = menu.getByRole("option", { name: "Longsword", exact: true });
    await save(page, async () => pickOption(await sword.count() ? sword : menu.getByRole("option").first())); await expect(slot).toBeEnabled();
  }
  const confirm = page.getByRole("button", { name: "Confirm Equipment", exact: true }); await expect(confirm).toBeEnabled();
  const unawarded = await readback(characterId, config.owner.id);
  expect(unawarded.native.choices.starting_equipment.confirmed).toBe(false); expect(unawarded.native.startingAwards.every(row => row.status === "eligible")).toBe(true);
  expect(unawarded.native.receipts.some(row => row.command === "award_equipment")).toBe(false); expect(unawarded.native.state).not.toHaveProperty("current_hp");
  expect(unawarded.family.order_domains).toMatchObject({ inventory: { physical_count: 0 } });
  const output = info.outputPath("character-workflow.json");
  const evidence: Record<string, unknown> = { kind: "unraid-character-workflow-v1", runId, characterId, actorId: config.owner.id,
    actualApp: true, actualAuthCookies: true, uiWritesOnly: true, passed: false, phase: "unawarded", unawarded, blockedOrigins, pageErrors,
    scope: "One focused scratch-runtime Fighter workflow; historical full-parent, A4 and F3 acceptance remain separate." };
  const checkpoint = async (phase: string) => { evidence.phase = phase; await writeFile(output, JSON.stringify(evidence, null, 2)); };
  await checkpoint("unawarded");
  const parentGuards = await verifyNativeParentFixture(characterId, config.owner.id);
  expect(parentGuards).toMatchObject({ passed: true, authenticationAccepted: false }); evidence.parentGuards = parentGuards;
  expect(await readback(characterId, config.owner.id)).toEqual(unawarded); await checkpoint("native-parent-guards-retained");
  evidence.directHttpProbes = await directParentProbes(config, unawarded); await checkpoint("direct-parent-http-refused");
  await save(page, () => confirm.click()); await expect(page.getByText("Starting equipment award recorded", { exact: true })).toBeVisible();
  const awarded = await readback(characterId, config.owner.id); evidence.awarded = awarded;
  expect(awarded.native.originalOccurrenceId).toBe(unawarded.native.originalOccurrenceId); expect(awarded.native.classRoles.class_sources).toEqual(unawarded.native.classRoles.class_sources);
  expect(awarded.native.firstClassProofs).toEqual(unawarded.native.firstClassProofs); expect(awarded.native.choices.classes).toEqual(unawarded.native.choices.classes);
  expect(awarded.native.choices.starting_equipment.confirmed).toBe(true); expect(awarded.native.startingAwards).toHaveLength(1);
  const award = awarded.native.startingAwards[0]; expect(award.status).toBe("awarded"); expect(award.receipt.inventory_ids.length).toBeGreaterThan(0);
  const original = awarded.native.classRoles.class_sources[0];
  expect(award.canonical_intent.sources.class).toEqual({ id: original.content_id, version: original.content_version });
  expect(awarded.family.exact_frozen_pins).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "background", slug: "acolyte",
    content_id: award.canonical_intent.sources.background.id, content_version: award.canonical_intent.sources.background.version })]));
  expect(new Set(award.receipt.inventory_ids).size).toBe(award.receipt.inventory_ids.length); expect(award.receipt.plan.items).toHaveLength(award.receipt.inventory_ids.length);
  expect(awarded.family.order_domains).toMatchObject({ inventory: { physical_count: award.receipt.inventory_ids.length } });
  const awardReceipts = awarded.native.receipts.filter(row => row.command === "award_equipment"); expect(awardReceipts).toHaveLength(1); expect(awardReceipts[0].receipt).toEqual(award.receipt);
  expect(BigInt(awarded.native.actionRevision)).toBeGreaterThan(BigInt(unawarded.native.actionRevision)); expect(awarded.native.state).toMatchObject({ currency: { gp: 15 } });
  expect(awarded.native.state).not.toHaveProperty("current_hp"); await checkpoint("awarded");
  await page.getByRole("button", { name: "Finish & View Character", exact: true }).click(); await expect(page).toHaveURL(sheet); await page.reload();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible(); await expect(page.getByRole("button", { name: "HP tracker — click to heal or damage", exact: true })).toBeVisible();
  const reloaded = await readback(characterId, config.owner.id); expect(reloaded).toEqual(awarded); evidence.reloaded = reloaded;
  const foreign = await browser.newContext();
  try {
    await restrict(foreign, config, blockedOrigins); const otherPage = await foreign.newPage(); otherPage.on("pageerror", () => pageErrors.push("foreign browser error"));
    await login(otherPage, config, config.other); const response = await otherPage.goto(sheet); expect(response?.status()).toBe(404);
    await expect(otherPage.getByText("This page could not be found.", { exact: true })).toBeVisible(); evidence.foreignRouteStatus = 404;
  } finally { await foreign.close(); }
  expect(await readback(characterId, config.owner.id)).toEqual(awarded); expect(blockedOrigins).toEqual([]); expect(pageErrors).toEqual([]);
  evidence.passed = true; await checkpoint("complete"); await info.attach("character-workflow", { path: output, contentType: "application/json" });
});
