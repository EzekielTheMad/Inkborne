import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test, expect, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { nativeJson, testRuntime } from "../../scripts/unraid/native";
import { observeParent, otherParentRows, requireParentSave, retainParentOrigins } from "../../scripts/unraid/parent-positive";
import { PARENT_POSITIVE_LABELS, type ParentObservation } from "../../scripts/parent-admission-acceptance";
import { verifyNativeBackground } from "../../scripts/unraid/native-background";
import { verifyNativeParentFixture } from "../../scripts/unraid/native-parent";
import { asiOption, choiceGroup, choiceOption, hpOption, optionPicked, pickOption, setSpell } from "../local-app/dropdown-helpers";

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
  return response;
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
  for (const command of ["select_race", "save_abilities", "select_background", "background_choice", "background_narrative", "fighting_style", "select_subclass", "set_class_level", "save_hp_roll", "select_asi", "save_details", "select_equipment"]) {
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
  const featureSlug = Object.keys(before.native.choices.asi_choices)[0]; assert(featureSlug);
  const characterId = before.native.characterId, scores = before.native.scores;
  const detailSql = await readFile("supabase/verification/builder-parent-positive-detail.sql", "utf8");
  const detailVariables = { character_id: characterId, actor_id: before.native.actorId };
  const detail = await nativeJson(detailSql, detailVariables);
  const probes = [
    { name: "state_patch", path: "/rest/v1/rpc/patch_character_state", method: "POST", body: { character_id: characterId, state_patch: { current_hp: 1 } } },
    { name: "state_cas", path: "/rest/v1/rpc/patch_character_state_if_current", method: "POST", body: { character_id: characterId, expected_state: before.native.state, state_patch: { current_hp: 1 } } },
    { name: "ability_rpc", path: "/rest/v1/rpc/save_character_abilities", method: "POST", body: { target_character_id: characterId, ability_method: "manual",
      ability_scores: { ...scores, constitution: scores.constitution === 11 ? 12 : 11 }, expected_method: before.native.choices.ability_method, expected_scores: scores } },
    { name: "background_rpc", path: "/rest/v1/rpc/set_character_background", method: "POST", body: { target_character_id: characterId, target_content_id: null, target_content_version: null } },
    { name: "asi_rpc", path: "/rest/v1/rpc/set_character_asi_choice", method: "POST", body: { target_character_id: characterId, target_feature_slug: featureSlug,
      choice_mode: "asi", ability_allocations: [{ ability: "constitution", amount: 2 }], target_feat_id: null, target_feat_version: null } },
    { name: "direct_update", path: `/rest/v1/characters?id=eq.${characterId}`, method: "PATCH", body: { state: { ...before.native.state, smoke_parent_bypass_probe: true } } },
    { name: "direct_delete", path: `/rest/v1/characters?id=eq.${characterId}`, method: "DELETE", body: undefined },
  ];
  for (const [actor, bearer] of [["owner", owner], ["service", config.serviceRoleKey], ["foreign", foreign]] as const) {
    for (const probe of probes) {
      const response = await fetch(config.supabaseOrigin + probe.path, { method: probe.method,
        headers: { apikey: config.anonKey, Authorization: "Bearer " + bearer, "Content-Type": "application/json", Prefer: "return=representation" },
        body: probe.body === undefined ? undefined : JSON.stringify(probe.body), signal: AbortSignal.timeout(15000) });
      const text = await response.text(), body = text ? JSON.parse(text) : null;
      const code = body && !Array.isArray(body) && typeof body === "object" && "code" in body ? String(body.code) : null;
      let outcome = "refused", affectedRows: number | null = null;
      const filtered = actor !== "service" && probe.name === "direct_delete" || actor === "foreign" && probe.name === "direct_update";
      if (filtered) {
        expect(response.ok).toBe(true); expect(body).toEqual([]); expect(code).toBeNull(); outcome = "zero_rows"; affectedRows = 0;
      } else if (actor === "foreign" && probe.name === "state_patch") {
        expect(response.status).toBe(204); expect(body).toBeNull(); expect(code).toBeNull(); outcome = "void_unchanged";
      } else if (actor === "foreign" && probe.name === "state_cas") {
        expect(response.status).toBe(200); expect(body).toEqual([{ status: "missing", resulting_state: null }]); expect(code).toBeNull(); outcome = "missing";
      } else {
        if (response.ok) throw Error(`Protected ${actor}/${probe.name} unexpectedly succeeded; stop verification`);
        expect(response.status).toBe(403); expect(code).toBe("42501");
      }
      expect(await readback(characterId, before.native.actorId)).toEqual(before);
      expect(await nativeJson(detailSql, detailVariables)).toEqual(detail);
      attempts.push({ actor, name: probe.name, http: response.status, code, affectedRows, outcome, retainedFingerprint: before.native.fixtureFingerprint });
    }
  }
  expect(attempts).toHaveLength(21);
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
  const bonds = page.getByRole("combobox", { name: "Bonds", exact: true });
  const bond = await bonds.locator('option:not([value=""])').first().getAttribute("value"); assert(bond);
  await save(page, () => bonds.selectOption(bond));
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
    runtime: testRuntime(), actualApp: true, actualAuthCookies: true, uiWritesOnly: true, passed: false, phase: "unawarded", unawarded, blockedOrigins, pageErrors,
    scope: "One focused scratch-runtime Fighter workflow; historical full-parent, A4 and F3 acceptance remain separate." };
  const checkpoint = async (phase: string) => { evidence.phase = phase; await writeFile(output, JSON.stringify(evidence, null, 2)); };
  await checkpoint("unawarded");
  const parentGuards = await verifyNativeParentFixture(characterId, config.owner.id);
  expect(parentGuards).toMatchObject({ passed: true, authenticationAccepted: false }); evidence.parentGuards = parentGuards;
  expect(await readback(characterId, config.owner.id)).toEqual(unawarded); await checkpoint("native-parent-guards-retained");
  evidence.directHttpProbes = await directParentProbes(config, unawarded); await checkpoint("direct-parent-http-refused");
  const parentSnapshots: Array<{ label: string; data: ParentObservation }> = [];
  evidence.parentSnapshots = parentSnapshots;
  const parentSnapshot = async (label: string) => {
    const data = await observeParent(characterId, config.owner.id); parentSnapshots.push({ label, data });
    await writeFile(info.outputPath(`parent-${label}.json`), JSON.stringify({ runtime: testRuntime(), label, data }, null, 2), { flag: "wx" });
    await checkpoint(label); return data;
  };
  const prepared = await parentSnapshot("prepared"), otherRows = await otherParentRows(characterId);
  await page.goto(base + "/race");
  await save(page, () => page.getByRole("button", { name: "Change Race", exact: true }).click());
  await page.getByRole("combobox", { name: "Choose Race", exact: true }).selectOption({ label: "Human" });
  await save(page, () => page.getByRole("button", { name: "Add Race", exact: true }).click());
  if (humanLanguageOffered) await choose(page, choiceOption(page, "Dwarvish"));
  const raceSaved = await parentSnapshot("race-saved");
  requireParentSave(prepared, raceSaved, ["clear_race", "select_race", ...(humanLanguageOffered ? ["race_choice"] : [])]);
  expect(raceSaved.native.choices).toEqual(prepared.native.choices);
  await page.goto(base + "/abilities");
  await save(page, () => page.getByRole("combobox", { name: "Method", exact: true }).selectOption("manual"));
  await save(page, () => page.getByRole("spinbutton", { name: "Constitution score", exact: true }).fill("14"));
  const abilitiesSaved = await parentSnapshot("abilities-saved"); requireParentSave(raceSaved, abilitiesSaved, ["save_abilities", "save_abilities"]);
  expect(abilitiesSaved.native.choices.ability_method).toBe("manual"); expect(abilitiesSaved.native.scores.constitution).toBe(14);
  expect(abilitiesSaved.native.scores).not.toEqual(raceSaved.native.scores);
  await page.goto(base + "/class"); await openLevel(page, 4); await choose(page, asiOption(page, "dexterity"));
  const asiSaved = await parentSnapshot("asi-saved"); requireParentSave(abilitiesSaved, asiSaved, ["select_asi"]);
  expect(Object.values(asiSaved.native.choices.asi_choices as Record<string, unknown>)).toEqual([{ mode: "asi", allocations: [{ ability: "dexterity", amount: 2 }] }]);
  await page.goto(base + "/background"); await choose(page, choiceOption(choiceGroup(page, "Choose 2 language"), "Giant"));
  const backgroundSaved = await parentSnapshot("background-choice-saved"); requireParentSave(asiSaved, backgroundSaved, ["background_choice"]);
  expect(backgroundSaved.native.choices).not.toEqual(asiSaved.native.choices);
  const savedBonds = page.getByRole("combobox", { name: "Bonds", exact: true }), oldBond = await savedBonds.inputValue();
  const nextBond = await savedBonds.locator('option:not([value=""])').evaluateAll((options, old) => options.map(option => (option as HTMLOptionElement).value).find(value => value !== old), oldBond);
  assert(nextBond); await save(page, () => savedBonds.selectOption(nextBond));
  const narrativeSaved = await parentSnapshot("background-narrative-saved"); requireParentSave(backgroundSaved, narrativeSaved, ["background_narrative"]);
  expect(narrativeSaved.native.choices).not.toEqual(backgroundSaved.native.choices);
  const acceptedName = `Parent accepted ${runId.slice(0, 8)}`;
  await page.goto(base + "/details"); await page.getByRole("textbox", { name: "Character name", exact: true }).fill(acceptedName);
  await page.getByRole("combobox", { name: "Alignment", exact: true }).selectOption("Chaotic Good");
  await save(page, () => page.getByRole("button", { name: "Save details", exact: true }).click());
  const detailsSaved = await parentSnapshot("details-saved"); requireParentSave(narrativeSaved, detailsSaved, ["save_details"]);
  expect(detailsSaved.native.name).toBe(acceptedName); expect(detailsSaved.native.name).not.toBe(narrativeSaved.native.name);
  expect(detailsSaved.native.choices.alignment).toBe("Chaotic Good"); expect(detailsSaved.native.choices.alignment).not.toBe(narrativeSaved.native.choices.alignment);
  await page.goto(base + "/equipment");
  const armor = page.locator("select").filter({ has: page.locator("option").filter({ hasText: /chain mail/i }) }).filter({ has: page.locator('option[value="b"]') }).first();
  await expect(armor).toHaveValue("a"); await save(page, () => armor.selectOption("b")); await expect(confirm).toBeEnabled();
  const equipmentSaved = await parentSnapshot("equipment-choice-saved"); requireParentSave(detailsSaved, equipmentSaved, ["select_equipment"]);
  expect(equipmentSaved.native.choices).not.toEqual(detailsSaved.native.choices);
  expect(await otherParentRows(characterId)).toEqual(otherRows);
  await save(page, () => confirm.click()); await expect(page.getByText("Starting equipment award recorded", { exact: true })).toBeVisible();
  const awarded = await parentSnapshot("equipment-awarded"); evidence.awarded = awarded;
  retainParentOrigins(equipmentSaved, awarded);
  expect(awarded.native.scores).toEqual(equipmentSaved.native.scores);
  expect(awarded.native.choices.classes).toEqual(equipmentSaved.native.choices.classes);
  expect(awarded.native.receipts.filter(row => !equipmentSaved.native.receipts.some(old => old.operationId === row.operationId)).map(row => row.command)).toEqual(["award_equipment"]);
  expect(awarded.native.originalOccurrenceId).toBe(unawarded.native.originalOccurrenceId); expect(awarded.native.classRoles.class_sources).toEqual(unawarded.native.classRoles.class_sources);
  expect(awarded.native.firstClassProofs).toEqual(unawarded.native.firstClassProofs); expect(awarded.native.choices.classes).toEqual(unawarded.native.choices.classes);
  expect(awarded.native.choices.starting_equipment).toMatchObject({ confirmed: true }); expect(awarded.native.startingAwards).toHaveLength(1);
  const award = awarded.native.startingAwards[0] as Native["startingAwards"][number]; expect(award.status).toBe("awarded"); expect(award.receipt.inventory_ids.length).toBeGreaterThan(0);
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
  await expect(page.getByText(acceptedName, { exact: true }).first()).toBeVisible(); await expect(page.getByRole("button", { name: "HP tracker — click to heal or damage", exact: true })).toBeVisible();
  const reloaded = await parentSnapshot("sheet-reloaded"); expect(reloaded).toEqual(awarded); evidence.reloaded = reloaded;
  const foreign = await browser.newContext();
  try {
    await restrict(foreign, config, blockedOrigins); const otherPage = await foreign.newPage(); otherPage.on("pageerror", () => pageErrors.push("foreign browser error"));
    await login(otherPage, config, config.other); const response = await otherPage.goto(sheet); expect(response?.status()).toBe(404);
    await expect(otherPage.getByText("This page could not be found.", { exact: true })).toBeVisible(); evidence.foreignRouteStatus = 404;
  } finally { await foreign.close(); }
  expect(await parentSnapshot("access-refused")).toEqual(awarded);
  expect(parentSnapshots.map(row => row.label)).toEqual([...PARENT_POSITIVE_LABELS]);
  expect(await otherParentRows(characterId)).toEqual(otherRows); expect(blockedOrigins).toEqual([]); expect(pageErrors).toEqual([]);
  evidence.passed = true; await checkpoint("complete"); await info.attach("character-workflow", { path: output, contentType: "application/json" });
});

test("genuine Rogue background changes retain or prune Expertise with exact native writes and full rollback", async ({ page, context }, info) => {
  test.setTimeout(360000);
  const config = await settings(), runtime = testRuntime(), blockedOrigins: string[] = [], pageErrors: string[] = [];
  await restrict(context, config, blockedOrigins); page.on("pageerror", () => pageErrors.push("Rogue browser error"));
  await login(page, config, config.owner); await page.goto(config.appOrigin + "/characters/new");
  await page.getByRole("textbox", { name: "What will they be called?" }).fill(`Unraid Rogue ${runtime.runId.slice(0, 8)}`);
  await page.getByRole("button", { name: "Open the notebook", exact: true }).click();
  await page.waitForURL(/\/characters\/[a-f0-9-]+\/builder\/first-class$/);
  const characterId = new URL(page.url()).pathname.split("/")[2], base = `${config.appOrigin}/characters/${characterId}/builder`;
  expect(characterId).toMatch(uuid);
  await page.getByRole("combobox", { name: "First class", exact: true }).selectOption({ label: "Rogue" });
  await page.getByRole("button", { name: "Save first class", exact: true }).click();
  await expect(page.getByText("Rogue · Level 1", { exact: true })).toBeVisible();
  await page.reload(); await page.getByRole("link", { name: "Complete class choices", exact: true }).click(); await openLevel(page, 1);
  const skills = choiceGroup(page, "Choose 4 proficiency");
  for (const skill of ["Acrobatics", "Perception", "Sleight Of Hand", "Stealth"]) await choose(page, choiceOption(skills, new RegExp(`^${skill}$`, "i")));
  await page.goto(base + "/race"); await page.getByRole("combobox", { name: "Choose Race", exact: true }).selectOption({ label: "Human" });
  await save(page, () => page.getByRole("button", { name: "Add Race", exact: true }).click());
  await page.goto(base + "/abilities");
  const rogueScores = { Strength: "10", Dexterity: "15", Constitution: "14", Intelligence: "12", Wisdom: "13", Charisma: "8" };
  for (const [ability, value] of Object.entries(rogueScores)) {
    const control = page.getByRole("combobox", { name: `${ability} score`, exact: true });
    if (await control.inputValue() === value) continue;
    for (const other of Object.keys(rogueScores)) if (other !== ability) {
      const occupied = page.getByRole("combobox", { name: `${other} score`, exact: true });
      if (await occupied.inputValue() === value) await save(page, () => occupied.selectOption(""));
    }
    await save(page, () => control.selectOption(value)); await expect(page.getByText("Changes save automatically.", { exact: true })).toBeVisible();
  }
  await page.goto(base + "/background"); await page.getByRole("combobox", { name: "Choose Background", exact: true }).selectOption({ label: "Acolyte" });
  await save(page, () => page.getByRole("button", { name: "Add Background", exact: true }).click());
  for (const language of ["Celestial", "Elvish"]) await choose(page, choiceOption(choiceGroup(page, "Choose 2 language"), language));
  await page.goto(base + "/class"); await openLevel(page, 1);
  const expertise = choiceGroup(page, "Choose 2 expertise");
  await choose(page, choiceOption(expertise, "Insight")); await choose(page, choiceOption(expertise, /^Thieves[’']? Tools$/i));
  await page.reload(); await openLevel(page, 1);
  await expect(choiceOption(expertise, "Insight")).toHaveJSProperty("selected", true);
  await expect(choiceOption(expertise, /^Thieves[’']? Tools$/i)).toHaveJSProperty("selected", true);
  const result = await verifyNativeBackground(characterId, config.owner.id);
  const native = result.before.native as Native;
  expect(native).toMatchObject({ characterId, actorId: config.owner.id, level: 1, enrolled: true,
    choices: { background: "acolyte", race: "human", classes: [{ slug: "rogue", level: 1, occurrence_id: native.originalOccurrenceId }],
      resolved_choices: { "rogue-proficiency-choice-0": ["skill-acrobatics", "skill-perception", "skill-sleight-of-hand", "skill-stealth"],
        "rogue-expertise-1": ["skill-insight", "thieves-tools"] } },
    capsRemaining: 0, sealsRemaining: 0, readinessCount: 13, readyCount: 0, classGate: false, hitDieGate: false,
    servicePrivateUsage: false, parentOrderRevisionEqual: true });
  expect(Object.keys(native.orderBijections).sort()).toEqual(["feature_grants", "inventory", "pins", "spell_grants", "spells"]);
  expect(Object.values(native.orderBijections).every(Boolean)).toBe(true); expect(native.originalOccurrenceId).toMatch(uuid);
  expect(native.classRoles).toMatchObject({ status: "available", character_id: characterId, action_revision: native.actionRevision,
    original_occurrence_id: native.originalOccurrenceId, class_sources: [{ role: "original", occurrence_id: native.originalOccurrenceId }] });
  expect(native.firstClassProofs).toHaveLength(1); expect(native.firstClassProofs[0]).toMatchObject({ phase: "observed", actorId: config.owner.id });
  expect(native.startingAwards.every(row => row.status === "eligible")).toBe(true);
  expect(native.receipts.some(row => row.command === "award_equipment")).toBe(false); expect(native.state).not.toHaveProperty("current_hp");
  expect(result.before.detail).toMatchObject({ inventory: [], inventoryFromAcceptedAward: true, catalog: { count: 1535 }, snapshots: { count: 1535 } });
  for (const check of familyChecks) expect((result.before.family as Record<string, unknown>)[check], check).toBe(true);
  expect(blockedOrigins).toEqual([]); expect(pageErrors).toEqual([]);
  const output = info.outputPath("parent-background-workflow.json");
  await writeFile(output, JSON.stringify({ kind: "unraid-parent-background-app-v1", passed: true, runtime, characterId, actorId: config.owner.id,
    actualApp: true, actualAuthCookies: true, uiFixtureWritesOnly: true, nativeVectorAuthenticationAccepted: false,
    backgroundVectorReport: "/output/native-background.json", blockedOrigins, pageErrors,
    scope: "Genuine Rogue preparation and rollback-only native background vector; historical full-parent/A4/F3 gate unchanged." }, null, 2));
  await info.attach("parent-background-workflow", { path: output, contentType: "application/json" });
});

test("parent Fiend correction applies once and exact JWT replay retains the updated character and current control", async ({ page, context }, info) => {
  test.setTimeout(480000);
  const config = await settings(), runtime = testRuntime(), blockedOrigins: string[] = [], pageErrors: string[] = [];
  await restrict(context, config, blockedOrigins); page.on("pageerror", () => pageErrors.push("Fiend browser error"));
  await login(page, config, config.owner);
  const publicationProcesses: unknown[] = [];
  const publish = async (mode: "legacy" | "corrected") => {
    const startedUtc = new Date().toISOString(), args = ["--import", "tsx", "scripts/unraid/fiend-fixture.ts", mode];
    const child = spawn(process.execPath, args, { cwd: process.cwd(), stdio: "ignore", detached: true });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; if (child.pid) try { process.kill(-child.pid, "SIGKILL"); } catch {} }, 180000);
    const exitCode = await new Promise<number | null>((resolve, reject) => { child.once("error", reject); child.once("close", resolve); }).finally(() => clearTimeout(timer));
    publicationProcesses.push({ pid: child.pid, parentPid: process.pid, cwd: process.cwd(), args, startedUtc, finishedUtc: new Date().toISOString(), exitCode, timedOut });
    await writeFile(info.outputPath("fiend-publication-processes.json"), JSON.stringify(publicationProcesses, null, 2));
    expect(timedOut).toBe(false); expect(exitCode, "Scratch publication failed; details kept private").toBe(0);
  };
  const create = async (label: string) => {
    await page.goto(config.appOrigin + "/characters/new");
    await page.getByRole("textbox", { name: "What will they be called?" }).fill(`Parent Fiend ${label} ${runtime.runId.slice(0, 8)}`);
    await page.getByRole("button", { name: "Open the notebook", exact: true }).click(); await page.waitForURL(/\/characters\/[a-f0-9-]+\/builder\/first-class$/);
    const id = new URL(page.url()).pathname.split("/")[2]; expect(id).toMatch(uuid);
    await page.getByRole("combobox", { name: "First class", exact: true }).selectOption({ label: "Warlock" });
    await page.getByRole("button", { name: "Save first class", exact: true }).click(); await expect(page.getByText("Warlock · Level 1", { exact: true })).toBeVisible();
    await page.reload(); await page.getByRole("link", { name: "Complete class choices", exact: true }).click(); await openLevel(page, 1);
    await choose(page, choiceOption(page, /^Fiend(?:\s|$)/));
    for (const skill of ["Arcana", "Intimidation"]) await choose(page, choiceOption(choiceGroup(page, "Choose 2 proficiency"), skill));
    await page.goto(`${config.appOrigin}/characters/${id}/builder/abilities`);
    const assigned = { Strength: "10", Dexterity: "13", Constitution: "14", Intelligence: "12", Wisdom: "8", Charisma: "15" };
    for (const [ability, value] of Object.entries(assigned)) {
      const control = page.getByRole("combobox", { name: `${ability} score`, exact: true });
      if (await control.inputValue() === value) continue;
      for (const other of Object.keys(assigned)) if (other !== ability) {
        const occupied = page.getByRole("combobox", { name: `${other} score`, exact: true });
        if (await occupied.inputValue() === value) await save(page, () => occupied.selectOption(""));
      }
      await save(page, () => control.selectOption(value));
    }
    for (const [ability, value] of Object.entries(assigned)) await expect(page.getByRole("combobox", { name: `${ability} score`, exact: true })).toHaveValue(value);
    await page.goto(`${config.appOrigin}/characters/${id}/builder/class`); await openLevel(page, 1);
    const panel = page.getByRole("form", { name: "Warlock spell choices", exact: true });
    for (const name of ["Eldritch Blast", "Mage Hand", "Comprehend Languages", "Charm Person"]) await setSpell(panel, name);
    await save(page, () => panel.getByRole("button", { name: "Save spells", exact: true }).click());
    await expect(panel.getByText("Spell choices saved.", { exact: true })).toBeVisible(); return id;
  };
  await publish("legacy");
  const characterId = await create("legacy"), base = `${config.appOrigin}/characters/${characterId}/builder`;
  await page.goto(base + "/race"); await page.getByRole("combobox", { name: "Choose Race", exact: true }).selectOption({ label: "Human" });
  await save(page, () => page.getByRole("button", { name: "Add Race", exact: true }).click()); await choose(page, choiceOption(page, "Dwarvish"));
  await page.goto(base + "/background"); await page.getByRole("combobox", { name: "Choose Background", exact: true }).selectOption({ label: "Acolyte" });
  await save(page, () => page.getByRole("button", { name: "Add Background", exact: true }).click());
  for (const language of ["Celestial", "Elvish"]) await choose(page, choiceOption(choiceGroup(page, "Choose 2 language"), language));
  await choose(page, choiceOption(page, "Nothing can shake my optimistic attitude."));
  await page.goto(base + "/equipment");
  const equipment = page.locator("select").filter({ has: page.locator('option[value="a"]') });
  await expect(equipment.first()).toBeVisible();
  for (let index = 0; index < await equipment.count(); index++) await choose(page, equipment.nth(index).locator('option[value="a"]'));
  const slots = page.locator('button[data-slot="select-trigger"]');
  for (let index = 0; index < await slots.count(); index++) {
    const slot = slots.nth(index); await slot.click(); const menu = page.getByRole("listbox"); await expect(menu).toBeVisible();
    await save(page, () => pickOption(menu.getByRole("option").first())); await expect(slot).toBeEnabled();
  }
  await save(page, () => page.getByRole("button", { name: "Confirm Equipment", exact: true }).click());
  await expect(page.getByText("Starting equipment award recorded", { exact: true })).toBeVisible();
  await page.goto(base + "/class");
  await save(page, () => page.getByRole("combobox", { name: "Set level for Warlock", exact: true }).selectOption("2"));
  await openLevel(page, 2); await save(page, () => pickOption(hpOption(page, "average")));
  for (const invocation of ["Eldritch Invocation Agonizing Blast", "Eldritch Invocation Repelling Blast"]) await choose(page, choiceOption(choiceGroup(page, "Choose 2 invocation"), invocation));
  await save(page, () => page.getByRole("combobox", { name: "Set level for Warlock", exact: true }).selectOption("3"));
  await openLevel(page, 3); await save(page, () => pickOption(hpOption(page, "rolled"))); await choose(page, choiceOption(page, /Pact Of The Blade/i));
  const panel = page.getByRole("form", { name: "Warlock spell choices", exact: true });
  for (const name of ["Expeditious Retreat", "Hellish Rebuke"]) await setSpell(panel, name);
  await save(page, () => panel.getByRole("button", { name: "Save spells", exact: true }).click());
  const legacy = await observeParent(characterId, config.owner.id, 1536);
  expect(legacy.detail.inventory.length).toBeGreaterThan(0); expect(legacy.detail.hpDraws).toHaveLength(1);
  expect(legacy.detail.spells.filter(row => row.source === "selection")).toHaveLength(6);
  await publish("corrected");
  const published = await observeParent(characterId, config.owner.id, 1537);
  expect(published.native).toEqual(legacy.native);
  for (const key of ["pins", "inventory", "hpDraws", "featureGrants", "spellGrants", "spells", "updateReceipts"] as const) expect(published.detail[key]).toEqual(legacy.detail[key]);
  const controlId = await create("current"), control = await observeParent(controlId, config.owner.id, 1537);
  const publication = JSON.parse(await readFile("/output/fiend-publication-corrected.json", "utf8"));
  expect(publication).toMatchObject({ passed: true, mode: "corrected", after: { fiend: { version: 3 } } });
  expect(publication.after.fiend.data.spellcastingExpanded).toHaveLength(5); expect(publication.after.fiend.data).not.toHaveProperty("spellcastingExtra");
  const controlPins = control.detail.pins.filter(pin => pin.content_id === publication.after.fiend.id);
  expect(controlPins).toHaveLength(1); expect(controlPins[0]).toMatchObject({ content_version: 3, feature_grant_id: null, context: { source: "subclass", class: "warlock" } });
  expect(control.family.exact_frozen_pins).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "subclass", slug: "fiend", content_id: publication.after.fiend.id, content_version: 3 })]));
  const before = await observeParent(characterId, config.owner.id, 1537), otherRows = await otherParentRows(characterId);
  const profileSql = await readFile("supabase/verification/earned-racial-installation-profile.sql", "utf8"), profileBefore = await nativeJson(profileSql) as Record<string, unknown>;
  await page.goto(base + "/class"); const review = page.getByRole("region", { name: "Fiend content update review", exact: true });
  await review.getByRole("button", { name: "Review content update", exact: true }).click();
  await expect(review.getByText("Fiend · version 2", { exact: true })).toBeVisible(); await expect(review.getByText("Fiend · version 3", { exact: true })).toBeVisible();
  let originalRequest: { operation_id: string; character_id: string; command: string; fields: Record<string, unknown> } | undefined;
  const pathname = new URL(page.url()).pathname;
  await page.route(url => url.pathname === pathname, async route => {
    if (route.request().method() !== "POST") return route.continue();
    const retained = await page.evaluate(({ owner, target }) => sessionStorage.getItem(`inkborne:pending-builder-step:v1:${owner}:${target}`), { owner: config.owner.id, target: characterId });
    assert(retained); const pending = JSON.parse(retained); expect(pending.account_id).toBe(config.owner.id); originalRequest = pending.intent;
    expect(originalRequest).toMatchObject({ contract_version: 1, character_id: characterId, command: "update_subclass_version", fields: { expected_content_version: 2, target_content_version: 3 } });
    await route.continue();
  }, { times: 1 });
  const response = await save(page, () => review.getByRole("button", { name: "Confirm update for this character", exact: true }).click());
  let applied: { status: string; receipt: unknown } | undefined;
  for (const line of (await response.text()).split("\n")) try {
    const value = JSON.parse(line.slice(line.indexOf(":") + 1)); if (value?.status === "applied" && value.receipt) applied = value;
  } catch { /* Ignore Flight metadata; never record the response body. */ }
  assert(applied); assert(originalRequest); const exactRequest = originalRequest;
  await expect(review).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Set level for Warlock", exact: true })).toBeEnabled();
  await expect.poll(() => page.evaluate(({ owner, target }) => sessionStorage.getItem(`inkborne:pending-builder-step:v1:${owner}:${target}`),
    { owner: config.owner.id, target: characterId })).toBeNull();
  const after = await observeParent(characterId, config.owner.id, 1537); retainParentOrigins(before, after);
  expect(BigInt(after.native.actionRevision) - BigInt(before.native.actionRevision)).toBe(BigInt(1));
  for (const key of ["choices", "scores", "state", "level", "startingAwards"] as const) expect(after.native[key]).toEqual(before.native[key]);
  expect(after.detail.inventory).toEqual(before.detail.inventory);
  const added = after.native.receipts.filter(row => !before.native.receipts.some(old => old.operationId === row.operationId));
  expect(added).toHaveLength(1); expect(added[0]).toMatchObject({ operationId: originalRequest.operation_id, command: "update_subclass_version" });
  expect(after.detail.updateReceipts).toHaveLength(before.detail.updateReceipts.length + 1);
  expect(after.detail.updateReceipts.find(row => row.operationId === exactRequest.operation_id)).toMatchObject({ request: originalRequest, receipt: applied.receipt });
  const oldPin = before.detail.pins.find(pin => pin.id === exactRequest.fields.subclass_ref_id); assert(oldPin); expect(oldPin.content_version).toBe(2);
  const newPins = after.detail.pins.filter(pin => pin.content_id === oldPin.content_id && pin.content_version === 3); expect(newPins).toHaveLength(1); expect(newPins[0].id).not.toBe(oldPin.id);
  const related = (value: ParentObservation, root: string) => value.detail.pins.filter(pin => pin.id === root || value.detail.featureGrants.some(grant => grant.controller_ref_id === root && grant.id === pin.feature_grant_id));
  expect(after.detail.pins.filter(pin => !related(after, newPins[0].id).includes(pin))).toEqual(before.detail.pins.filter(pin => !related(before, oldPin.id).includes(pin)));
  for (const key of ["featureGrants", "spellGrants"] as const) expect(after.detail[key].filter(row => row.controller_ref_id !== newPins[0].id)).toEqual(before.detail[key].filter(row => row.controller_ref_id !== oldPin.id));
  const retainedSpells = (value: ParentObservation) => value.detail.spells.filter(row => row.source === "selection" || row.class_slug !== "warlock");
  expect(retainedSpells(after)).toEqual(retainedSpells(before));
  const auth = await fetch(config.supabaseOrigin + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: config.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: config.owner.email, password: config.owner.password }), signal: AbortSignal.timeout(15000) });
  if (!auth.ok) throw Error("Scratch replay sign-in failed; credentials withheld");
  const session = await auth.json(), claims = JSON.parse(Buffer.from(session.access_token.split(".")[1], "base64url").toString("utf8"));
  expect(claims.sub).toBe(config.owner.id); expect(claims.role).toBe("authenticated"); expect(claims.session_id).toMatch(uuid); expect(claims.exp * 1000).toBeGreaterThan(Date.now());
  const replay = await fetch(config.supabaseOrigin + "/rest/v1/rpc/character_builder_command_v1", { method: "POST",
    headers: { apikey: config.anonKey, Authorization: "Bearer " + session.access_token, "Content-Type": "application/json" },
    body: JSON.stringify({ p_context: { context_version: 1, actor_id: config.owner.id, session_id: claims.session_id,
      jwt_expires_at: new Date(claims.exp * 1000).toISOString().replace(".000Z", ".000000Z") }, p_request: originalRequest }), signal: AbortSignal.timeout(15000) });
  expect(replay.status).toBe(200); const replayed = await replay.json(); expect(replayed.status).toBe("replayed"); expect(replayed.receipt).toEqual(applied.receipt);
  const replayReadback = await observeParent(characterId, config.owner.id, 1537); expect(replayReadback).toEqual(after);
  await page.reload(); const reloaded = await observeParent(characterId, config.owner.id, 1537); expect(reloaded).toEqual(after);
  expect(await observeParent(controlId, config.owner.id, 1537)).toEqual(control); expect(await otherParentRows(characterId)).toEqual(otherRows);
  const profileAfter = await nativeJson(profileSql) as Record<string, unknown>;
  for (const key of ["functions", "wires", "roles", "schemas", "policies", "relationPrivileges", "memberships", "closure", "firstClassProofs", "catalog", "snapshots", "chainRoots"]) expect(profileAfter[key]).toEqual(profileBefore[key]);
  expect(blockedOrigins).toEqual([]); expect(pageErrors).toEqual([]);
  const output = info.outputPath("parent-fiend-replay.json");
  await writeFile(output, JSON.stringify({ kind: "unraid-parent-fiend-replay-v1", passed: true, runtime, characterId, actorId: config.owner.id, controlId,
    actualApp: true, actualAuthCookies: true, actualJwtReplay: true, originalRequest, applied, replayed, legacy, published, before, after, replayReadback, reloaded,
    retainedCurrentControl: control, controlSource: { contentId: publication.after.fiend.id, version: 3 }, otherRowsBefore: otherRows, otherRowsAfter: await otherParentRows(characterId), publicationProcesses, blockedOrigins, pageErrors,
    scope: "Current-state parent acceptance with explicit Fiend legacy-v2 to current-v3; historical v1-to-v2 aggregator and ancestry/F3 upgrade gates unchanged." }, null, 2));
  await info.attach("parent-fiend-replay", { path: output, contentType: "application/json" });
});
