import assert from "node:assert/strict";
import { test, expect, type Browser, type Locator, type Page, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { captureAncestryHpSource as captureSource } from "../../scripts/ancestry-hp-acceptance";
import { choiceOption, choiceGroup, optionPicked, pickOption, asiOption } from "./dropdown-helpers";
import { actionResult, httpIdentity, inputs, login, reader, restrict, save,
  type AccessAttempt, type Inputs, type Intent, type Snapshot } from "./parent-admission-positive-helpers";

async function choose(page: Page, option: Locator) {
  if (!await optionPicked(option)) await save(page, () => pickOption(option));
  await expect(option).toHaveJSProperty("selected", true); await expect(option).toBeEnabled();
}
async function openLevel(page: Page, level: number) {
  await page.getByRole("button", { name: new RegExp(`^Level ${level}:`) }).click();
  await expect(page.locator('section[aria-labelledby="class-level-title"]').getByRole("navigation", { name: "Breadcrumb", exact: true })).toContainText(`Level ${level}`);
}

async function prepareRogue(page: Page, input: Inputs, evidence: ReturnType<typeof reader>, info: TestInfo) {
  await page.goto(input.config.appOrigin + "/characters/new");
  await page.getByRole("textbox", { name: "What will they be called?" }).fill(`Parent Rogue ${randomUUID().slice(0, 8)}`);
  await page.getByRole("button", { name: "Open the notebook", exact: true }).click();
  await page.waitForURL(/\/characters\/[a-f0-9-]+\/builder\/first-class$/);
  const characterId = new URL(page.url()).pathname.split("/")[2], base = `${input.config.appOrigin}/characters/${characterId}/builder`;
  await page.getByRole("combobox", { name: "First class", exact: true }).selectOption({ label: "Rogue" });
  await page.getByRole("button", { name: "Save first class", exact: true }).click();
  await expect(page.getByText("Rogue · Level 1", { exact: true })).toBeVisible();
  await page.reload(); await page.getByRole("link", { name: "Complete class choices", exact: true }).click(); await openLevel(page, 1);
  const skills = choiceGroup(page, "Choose 4 proficiency");
  for (const skill of ["Acrobatics", "Perception", "Sleight Of Hand", "Stealth"]) await choose(page, choiceOption(skills, new RegExp(`^${skill}$`, "i")));
  await page.goto(base + "/race"); await page.getByRole("combobox", { name: "Choose Race", exact: true }).selectOption({ label: "Human" });
  await save(page, () => page.getByRole("button", { name: "Add Race", exact: true }).click());
  await page.goto(base + "/abilities");
  const scores = { Strength: "10", Dexterity: "15", Constitution: "14", Intelligence: "12", Wisdom: "13", Charisma: "8" };
  for (const [ability, score] of Object.entries(scores)) {
    await save(page, () => page.getByRole("combobox", { name: `${ability} score`, exact: true }).selectOption(score));
    await expect(page.getByText("Changes save automatically.", { exact: true })).toBeVisible();
  }
  await page.goto(base + "/background"); await page.getByRole("combobox", { name: "Choose Background", exact: true }).selectOption({ label: "Acolyte" });
  await save(page, () => page.getByRole("button", { name: "Add Background", exact: true }).click());
  const languages = choiceGroup(page, "Choose 2 language");
  for (const name of ["Celestial", "Elvish"]) await choose(page, choiceOption(languages, name));
  await page.goto(base + "/class"); await openLevel(page, 1);
  const expertise = choiceGroup(page, "Choose 2 expertise");
  await choose(page, choiceOption(expertise, "Insight")); await choose(page, choiceOption(expertise, /^Thieves[’']? Tools$/i));
  await page.reload(); await openLevel(page, 1);
  await expect(choiceOption(expertise, "Insight")).toHaveJSProperty("selected", true);
  await expect(choiceOption(expertise, /^Thieves[’']? Tools$/i)).toHaveJSProperty("selected", true);
  const snapshots: Snapshot[] = [], snapshot = await evidence.snapshot("rogue-prepared", characterId, snapshots);
  expect(snapshot.data.native.level).toBe(1); expect(snapshot.data.native.choices.background).toBe("acolyte");
  expect(snapshot.data.native.choices.classes).toMatchObject([{ slug: "rogue", level: 1, occurrence_id: snapshot.data.native.originalOccurrenceId }]);
  expect(snapshot.data.native.choices.resolved_choices).toMatchObject({ "rogue-proficiency-choice-0": ["skill-acrobatics", "skill-perception", "skill-sleight-of-hand", "skill-stealth"],
    "rogue-expertise-1": ["skill-insight", "thieves-tools"] });
  expect(snapshot.data.detail.inventory).toEqual([]); expect(snapshot.data.native.startingAwards.every(row => row.status === "eligible")).toBe(true);
  expect(snapshot.data.native.receipts.some(row => row.command === "award_equipment")).toBe(false);
  expect(snapshot.data.native.state).not.toHaveProperty("current_hp");
  await info.attach("parent-native-background-genuine-rogue", { path: snapshot.path, contentType: "application/json" });
  return { characterId, snapshot };
}

async function accessChecks(input: Inputs, evidence: ReturnType<typeof reader>, characterId: string, before: Snapshot["data"], info: TestInfo) {
  const http = await httpIdentity(input), attempts: AccessAttempt[] = [];
  const expectedState = before.native.state, scores = before.native.scores;
  const asiChoices = before.native.choices.asi_choices as Record<string, unknown>, featureSlug = Object.keys(asiChoices)[0];
  assert(featureSlug);
  const probes = [
    { name: "state_patch", path: "/rest/v1/rpc/patch_character_state", method: "POST", body: { character_id: characterId, state_patch: { current_hp: 1 } } },
    { name: "state_cas", path: "/rest/v1/rpc/patch_character_state_if_current", method: "POST", body: { character_id: characterId, expected_state: expectedState, state_patch: { current_hp: 1 } } },
    { name: "ability_rpc", path: "/rest/v1/rpc/save_character_abilities", method: "POST", body: { target_character_id: characterId, ability_method: "manual",
      ability_scores: { ...scores, constitution: scores.constitution === 11 ? 12 : 11 }, expected_method: before.native.choices.ability_method, expected_scores: scores } },
    { name: "background_rpc", path: "/rest/v1/rpc/set_character_background", method: "POST", body: { target_character_id: characterId, target_content_id: null, target_content_version: null } },
    { name: "asi_rpc", path: "/rest/v1/rpc/set_character_asi_choice", method: "POST", body: { target_character_id: characterId, target_feature_slug: featureSlug,
      choice_mode: "asi", ability_allocations: [{ ability: "constitution", amount: 2 }], target_feat_id: null, target_feat_version: null } },
    { name: "direct_update", path: `/rest/v1/characters?id=eq.${characterId}`, method: "PATCH", body: { state: { ...expectedState, parent_verification_probe: true } } },
    { name: "direct_delete", path: `/rest/v1/characters?id=eq.${characterId}`, method: "DELETE", body: undefined },
  ];
  for (const actor of ["owner", "foreign", "service"] as const) {
    for (const probe of probes) {
      const response = await http.request(http[actor].token, probe.path, probe.method, probe.body);
      const code = response.data && !Array.isArray(response.data) && typeof response.data === "object" && "code" in response.data
        ? String(response.data.code) : null;
      let outcome: AccessAttempt["outcome"] = "refused", affectedRows: number | null = null;
      const filtered = actor !== "service" && probe.name === "direct_delete" || actor === "foreign" && probe.name === "direct_update";
      if (filtered) {
        expect(response.http).toBeGreaterThanOrEqual(200); expect(response.http).toBeLessThan(300); expect(response.data).toEqual([]); expect(code).toBeNull();
        outcome = "zero_rows"; affectedRows = 0;
      } else if (actor === "foreign" && probe.name === "state_patch") {
        expect(response.http).toBe(204); expect(response.data).toBeNull(); expect(code).toBeNull(); outcome = "void_unchanged";
      } else if (actor === "foreign" && probe.name === "state_cas") {
        expect(response.http).toBe(200); expect(response.data).toEqual([{ status: "missing", resulting_state: null }]); expect(code).toBeNull(); outcome = "missing";
      } else {
        if (response.http >= 200 && response.http < 300) throw Error(`Unexpected successful protected ${actor}/${probe.name}; stop verification`);
        expect(response.http).toBe(403); expect(code).toBe("42501");
      }
      const after = await evidence.sql("supabase/verification/builder-parent-admission-readback.sql", characterId);
      expect(after).toEqual(before.native);
      attempts.push({ actor, name: probe.name, http: response.http, code, affectedRows, outcome,
        beforeFingerprint: before.native.fixtureFingerprint, afterFingerprint: after.fixtureFingerprint });
      await writeFile(info.outputPath("parent-positive-access-probes.json"), JSON.stringify({ characterId, baselineLabel: "equipment-choice-saved", attempts }, null, 2));
    }
  }
  return { baselineLabel: "equipment-choice-saved" as const, attempts };
}

async function foreignRoute(browser: Browser, input: Inputs, characterId: string, blocked: string[], errors: string[]) {
  const foreign = await browser.newContext();
  try {
    await restrict(foreign, input.config, blocked); const otherPage = await foreign.newPage(); otherPage.on("pageerror", () => errors.push("foreign browser error"));
    await login(otherPage, input.config, input.config.other); const response = await otherPage.goto(`${input.config.appOrigin}/characters/${characterId}`);
    expect(response?.status()).toBe(404); await expect(otherPage.getByText("This page could not be found.", { exact: true })).toBeVisible();
  } finally { await foreign.close(); }
  return 404 as const;
}

test("parent fence admits six genuine builder steps, an original award and Fiend correction with strict replay", async ({ page, context, browser }, info) => {
  test.setTimeout(720000);
  const input = await inputs(), source = captureSource(process.cwd()), evidence = reader(input, info, source);
  const characterId: string = input.preparation.data.characterId, fiendId: string = input.fiendEvidence.data.controlId, retainedFiendId: string = input.fiendEvidence.data.targetId;
  const snapshots: Snapshot[] = [], fiendSnapshots: Snapshot[] = [], actions: Array<{ label: string; result?: unknown }> = [];
  const blockedOrigins: string[] = [], pageErrors: string[] = [];
  await restrict(context, input.config, blockedOrigins); page.on("pageerror", () => pageErrors.push("owner browser error"));
  console.log(JSON.stringify({ workerPid: process.pid, parentPid: process.ppid, cwd: process.cwd(), startedUtc: new Date().toISOString(), story: "parent positive app", runId: input.runId }));
  await login(page, input.config, input.config.owner);
  await evidence.identity();
  const archivedFiend = await evidence.sql("supabase/verification/subclass-content-update-readback.sql", retainedFiendId, fiendId);
  const withoutProfileCount = (value: Record<string, unknown>) => Object.fromEntries(Object.entries(value).filter(([key]) => key !== "profileCharacterCount"));
  expect(withoutProfileCount(archivedFiend)).toEqual(withoutProfileCount(input.fiendEvidence.data.freshNativeReadback));
  const controlSnapshots: Snapshot[] = [];
  const retainedFiendBefore = await evidence.snapshot("fiend-control-before", retainedFiendId, controlSnapshots);
  const retainedFiend = retainedFiendBefore.data;
  const prepared = await evidence.snapshot("prepared", characterId, snapshots);
  expect(prepared.data.native).toEqual(input.nativeEvidence.data.fixtureAfter);
  const base = `${input.config.appOrigin}/characters/${characterId}/builder`;
  await page.goto(base + "/race");
  await save(page, () => page.getByRole("button", { name: "Change Race", exact: true }).click()); actions.push({ label: "race clear through actual UI" });
  await page.getByRole("combobox", { name: "Choose Race", exact: true }).selectOption({ label: "Human" });
  await save(page, () => page.getByRole("button", { name: "Add Race", exact: true }).click()); actions.push({ label: "same exact Human selected through real preview" });
  await expect(page.getByRole("button", { name: "Change Race", exact: true })).toBeEnabled();
  await evidence.snapshot("race-saved", characterId, snapshots);
  await page.goto(base + "/abilities"); await save(page, () => page.getByRole("combobox", { name: "Method", exact: true }).selectOption("manual"));
  await expect(page.getByText("Changes save automatically.", { exact: true })).toBeVisible();
  await evidence.snapshot("abilities-saved", characterId, snapshots);
  await page.goto(base + "/class"); await openLevel(page, 4); await choose(page, asiOption(page, "dexterity"));
  await evidence.snapshot("asi-saved", characterId, snapshots);
  await page.goto(base + "/background"); await choose(page, choiceOption(choiceGroup(page, "Choose 2 language"), "Dwarvish").first());
  await evidence.snapshot("background-choice-saved", characterId, snapshots);
  const bonds = page.getByRole("combobox", { name: "Bonds", exact: true });
  const bond = await bonds.locator('option:not([value=""])').first().getAttribute("value"); assert(bond);
  await save(page, () => bonds.selectOption(bond)); await evidence.snapshot("background-narrative-saved", characterId, snapshots);
  await page.goto(base + "/details"); await page.getByRole("textbox", { name: "Character name", exact: true }).fill(`Parent accepted ${input.runId.slice(0, 8)}`);
  await save(page, () => page.getByRole("button", { name: "Save details", exact: true }).click());
  await expect(page.getByText("Character details saved.", { exact: true })).toBeVisible(); await evidence.snapshot("details-saved", characterId, snapshots);
  await page.goto(base + "/equipment"); await expect(page.getByRole("button", { name: "Confirm Equipment", exact: true })).toBeEnabled();
  const armorGroup = page.getByRole("group").filter({ has: page.locator('select option[value="b"]') }).filter({ hasText: /chain mail/i }).first();
  const armor = armorGroup.locator("select").first(); await expect(armor).toHaveValue("a");
  await save(page, () => armor.selectOption("b")); await expect(page.getByRole("button", { name: "Confirm Equipment", exact: true })).toBeEnabled();
  const selectedEquipment = await evidence.snapshot("equipment-choice-saved", characterId, snapshots);
  const accessProbes = await accessChecks(input, evidence, characterId, selectedEquipment.data, info);
  await save(page, () => page.getByRole("button", { name: "Confirm Equipment", exact: true }).click());
  await expect(page.getByText("Starting equipment award recorded", { exact: true })).toBeVisible();
  await evidence.snapshot("equipment-awarded", characterId, snapshots);
  await page.getByRole("button", { name: "Finish & View Character", exact: true }).click();
  await expect(page).toHaveURL(`${input.config.appOrigin}/characters/${characterId}`); await page.reload();
  await expect(page.getByText(`Parent accepted ${input.runId.slice(0, 8)}`, { exact: true }).first()).toBeVisible();
  await evidence.snapshot("sheet-reloaded", characterId, snapshots);
  const access = { ...accessProbes, foreignRouteStatus: await foreignRoute(browser, input, characterId, blockedOrigins, pageErrors) };
  await evidence.snapshot("access-refused", characterId, snapshots);

  await evidence.snapshot("fiend-before", fiendId, fiendSnapshots);
  await page.goto(`${input.config.appOrigin}/characters/${fiendId}/builder/class`);
  const review = page.getByRole("region", { name: "Fiend content update review", exact: true });
  await review.getByRole("button", { name: "Review content update", exact: true }).click();
  await expect(review.getByText("Fiend · version 1", { exact: true })).toBeVisible(); await expect(review.getByText("Fiend · version 2", { exact: true })).toBeVisible();
  await expect(review.getByText("This update learns no spells automatically. Expanded spells use your ordinary spells-known allowance.", { exact: true })).toBeVisible();
  const pathname = new URL(page.url()).pathname;
  let originalRequest: Intent | null = null;
  await page.route(url => url.pathname === pathname, async route => {
    if (route.request().method() !== "POST") return route.continue();
    const retained = await page.evaluate(({ owner, target }) => sessionStorage.getItem(`inkborne:pending-builder-step:v1:${owner}:${target}`), { owner: input.config.owner.id, target: fiendId });
    assert(retained, "Original retained UI intent required"); const pending = JSON.parse(retained);
    assert.equal(pending.account_id, input.config.owner.id); assert.equal(pending.intent.command, "update_subclass_version");
    assert.equal(pending.intent.character_id, fiendId); assert.equal(pending.intent.contract_version, 1); originalRequest = pending.intent;
    await route.continue();
  }, { times: 1 });
  const applied = actionResult(await (await save(page, () => review.getByRole("button", { name: "Confirm update for this character", exact: true }).click())).text());
  expect(applied.status).toBe("applied"); assert(originalRequest); actions.push({ label: "Fiend exact retained UI correction", result: applied });
  await evidence.snapshot("fiend-applied", fiendId, fiendSnapshots); expect(await evidence.observe(retainedFiendId)).toEqual(retainedFiend);
  const http = await httpIdentity(input), response = await http.request(http.owner.token, "/rest/v1/rpc/character_builder_command_v1", "POST", { p_context: http.owner.context, p_request: originalRequest });
  expect(response.http).toBe(200); const replayed = response.data as { status: string; receipt: Record<string, unknown> };
  expect(replayed.status).toBe("replayed"); expect(replayed.receipt).toEqual(applied.receipt); actions.push({ label: "Fiend strict original request replay", result: replayed });
  await evidence.snapshot("fiend-replayed", fiendId, fiendSnapshots); await page.reload();
  await evidence.snapshot("fiend-reloaded", fiendId, fiendSnapshots); expect(await evidence.observe(retainedFiendId)).toEqual(retainedFiend);
  const roguePreparation = await prepareRogue(page, input, evidence, info);
  expect(await evidence.observe(characterId)).toEqual(snapshots.at(-1)!.data); expect(await evidence.observe(retainedFiendId)).toEqual(retainedFiend);
  expect(await evidence.observe(fiendId)).toEqual(fiendSnapshots.at(-1)!.data);
  const retainedFiendAfter = await evidence.snapshot("fiend-control-after", retainedFiendId, controlSnapshots);
  expect(retainedFiendAfter.data).toEqual(retainedFiendBefore.data);
  await evidence.identity(); expect(captureSource(process.cwd())).toEqual(source); expect(blockedOrigins).toEqual([]); expect(pageErrors).toEqual([]);
  const link = ({ path, sha256 }: { path: string; sha256: string }) => ({ path, sha256 });
  const output = info.outputPath("parent-admission-positive.json");
  await writeFile(output, JSON.stringify({ actualApp: true, actualAuthCookies: true, actualPostgrest: true, uiWritesOnly: true,
    source, runId: input.runId, engineId: input.state.engineId, databaseId: input.db.id, actorId: input.config.owner.id, characterId, fiendId,
    preparation: link(input.preparation), nativeEvidence: link(input.nativeEvidence), fiendEvidence: link(input.fiendEvidence),
    fiendControl: { characterId: retainedFiendId, before: retainedFiendBefore, after: retainedFiendAfter }, snapshots, fiendSnapshots, roguePreparation,
    fiendAction: { originalRequest, applied, replayed }, access, blockedOrigins, pageErrors }, null, 2));
  const actionsPath = info.outputPath("parent-admission-positive-actions.json");
  await writeFile(actionsPath, JSON.stringify({ source, runId: input.runId, engineId: input.state.engineId, databaseId: input.db.id,
    actorId: input.config.owner.id, characterId, fiendId, retainedFiendId, rogueId: roguePreparation.characterId, fiendEvidence: link(input.fiendEvidence),
    uiMutationsOnly: true, replayAndAccessUseActualJwt: true, actions, processes: evidence.processes }, null, 2));
  await info.attach("parent-admission-positive", { path: output, contentType: "application/json" });
  await info.attach("parent-admission-positive-actions", { path: actionsPath, contentType: "application/json" });
});
