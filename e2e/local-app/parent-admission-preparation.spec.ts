import { test, expect, type Locator, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { captureAncestryHpSource as captureSource } from "../../scripts/ancestry-hp-acceptance";
import { PARENT_ASI_ELIGIBILITY_SQL, validateParentPreparationNative } from "../../scripts/parent-admission-fixture";

type Account = { id: string; email: string; password: string };
type Settings = { appOrigin: string; supabaseOrigin: string; owner: Account };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const scores = { Strength: "15", Dexterity: "14", Constitution: "13", Intelligence: "12", Wisdom: "10", Charisma: "8" };
async function save(page: Page, change: () => Promise<unknown>) {
  const route = new URL(page.url()).pathname;
  const [response] = await Promise.all([page.waitForResponse(item => item.request().method() === "POST" && new URL(item.url()).pathname === route), change()]);
  expect(response.status()).toBe(200);
}
async function choose(page: Page, button: Locator) {
  if (await button.getAttribute("aria-pressed") !== "true") await save(page, () => button.click());
  await expect(button).toHaveAttribute("aria-pressed", "true"); await expect(button).toBeEnabled();
}

test("genuine unawarded Fighter4 and Acolyte prepare the parent-admission native fixture", async ({ page, context }, info) => {
  test.setTimeout(360000);
  const runId = process.env.INKBORNE_LOCAL_FLOW_RUN_ID, configFile = process.env.INKBORNE_LOCAL_FLOW_CONFIG;
  if (!runId || !uuid.test(runId) || !configFile) throw Error("Use the bounded parent-preparation-app wrapper and isolated local configuration");
  const source = captureSource(process.cwd()), config = JSON.parse(await readFile(configFile, "utf8")) as Settings;
  const runtime = resolve(dirname(configFile), ".."), initialState = JSON.parse(await readFile(resolve(runtime, "state.json"), "utf8"));
  const installation = JSON.parse(await readFile(resolve(runtime, "install-parent-admission-readback.json"), "utf8"));
  const initialDb = initialState.containers?.find((item: { name: string }) => item.name === "/inkborne-app-flow-20261022-db");
  if (initialState.project !== "inkborne-app-flow-20261022" || initialState.catalogMode !== "real-srd" || initialState.ready !== true || initialState.stoppedUtc
    || !initialDb || installation.installed !== true || installation.engineId !== initialState.engineId || installation.databaseId !== initialDb.id
    || installation.file !== "supabase/staged/character-builder-parent-admission.sql"
    || installation.sourceSha256 !== "43988b054442805577b8e97be14b82c365c4d5b580d32e6abcc9bfcbab331e19"
    || createHash("sha256").update(await readFile(resolve(process.cwd(), installation.file))).digest("hex") !== installation.sourceSha256)
    throw Error("The exact reviewed parent fence must be installed before app preparation");
  const allowed = new Set([config.appOrigin, config.supabaseOrigin]), blockedOrigins: string[] = [], pageErrors: string[] = [];
  for (const origin of allowed) { const url = new URL(origin); if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.origin !== origin) throw Error("Explicit loopback origins required"); }
  if (!config.owner?.email || !config.owner.password || !uuid.test(config.owner.id)) throw Error("Disposable owner required");
  await context.route("**/*", route => { const origin = new URL(route.request().url()).origin;
    if (!allowed.has(origin)) { blockedOrigins.push(origin); return route.abort(); } return route.continue(); });
  page.on("pageerror", () => pageErrors.push("owner browser error"));
  console.log(JSON.stringify({ workerPid: process.pid, parentPid: process.ppid, cwd: process.cwd(), startedUtc: new Date().toISOString(), story: "genuine unawarded Fighter4 parent fixture" }));
  try {
    await page.goto(config.appOrigin + "/login"); await page.getByLabel("Email", { exact: true }).fill(config.owner.email);
    await page.getByLabel("Password", { exact: true }).fill(config.owner.password); await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(config.appOrigin + "/dashboard", { timeout: 60000 });
  } catch { await page.close(); throw Error("Actual local sign-in failed; credentials withheld"); }
  expect((await context.cookies()).some(cookie => cookie.name.startsWith("sb-"))).toBe(true);
  await page.goto(config.appOrigin + "/characters/new"); const name = `Parent Fighter ${randomUUID().slice(0, 8)}`;
  await page.getByRole("textbox", { name: "What will they be called?" }).fill(name);
  await page.getByRole("button", { name: "Open the notebook", exact: true }).click(); await page.waitForURL(/\/characters\/[a-f0-9-]+\/builder\/first-class$/);
  const characterId = new URL(page.url()).pathname.split("/")[2]; expect(characterId).toMatch(uuid);
  await page.getByRole("combobox", { name: "First class", exact: true }).selectOption({ label: "Fighter" });
  await page.getByRole("button", { name: "Save first class", exact: true }).click(); await expect(page.getByText("Fighter · Level 1", { exact: true })).toBeVisible();
  await page.reload(); await page.getByRole("link", { name: "Complete class choices", exact: true }).click();
  await page.getByRole("button", { name: /^Level 1:/ }).click();
  for (const skill of ["Athletics", "Perception"]) await choose(page, page.getByRole("button", { name: skill, exact: true }));
  await choose(page, page.getByRole("button", { name: /^Defense(?:\s|$)/ }));
  const base = `${config.appOrigin}/characters/${characterId}/builder`;
  await page.goto(base + "/race"); await page.getByRole("button", { name: "Preview Human", exact: true }).click();
  await save(page, () => page.getByRole("button", { name: "Add Race", exact: true }).click());
  await expect(page.getByRole("button", { name: "Change Race", exact: true })).toBeVisible();
  await page.goto(base + "/abilities");
  for (const [ability, score] of Object.entries(scores)) {
    const control = page.getByRole("combobox", { name: `${ability} score`, exact: true });
    if (await control.inputValue() === score) continue;
    for (const other of Object.keys(scores)) if (other !== ability) {
      const occupied = page.getByRole("combobox", { name: `${other} score`, exact: true });
      if (await occupied.inputValue() === score) await save(page, () => occupied.selectOption(""));
    }
    await save(page, () => control.selectOption(score)); await expect(page.getByText("Changes save automatically.", { exact: true })).toBeVisible();
  }
  await page.reload(); for (const [ability, score] of Object.entries(scores)) await expect(page.getByRole("combobox", { name: `${ability} score`, exact: true })).toHaveValue(score);
  await page.goto(base + "/background"); await page.getByRole("button", { name: "Preview Acolyte", exact: true }).click();
  await save(page, () => page.getByRole("button", { name: "Add Background", exact: true }).click());
  const languages = page.getByText("Choose 2 language", { exact: true }).locator("..").locator("..");
  for (const language of ["Celestial", "Elvish"]) await choose(page, languages.getByRole("button", { name: language, exact: true }));
  await save(page, () => page.getByRole("button", { name: "Nothing can shake my optimistic attitude.", exact: true }).click());
  await page.goto(base + "/class"); const level = page.getByRole("combobox", { name: "Set level for Fighter", exact: true });
  await save(page, () => level.selectOption("4")); await expect(level).toHaveValue("4"); await expect(level).toBeEnabled();
  await page.getByRole("button", { name: /^Level 3:/ }).click(); await choose(page, page.getByRole("button", { name: /^Champion(?:\s|$)/ }));
  for (const value of [2, 3, 4]) {
    await page.getByRole("button", { name: new RegExp(`^Level ${value}:`) }).click();
    const average = page.getByRole("radio", { name: "Average (+8)", exact: true });
    await save(page, () => average.click()); await expect(average).toHaveAttribute("aria-checked", "true"); await expect(average).toBeEnabled();
  }
  await choose(page, page.getByRole("button", { name: "STR +2", exact: true }));
  await page.reload(); await expect(level).toHaveValue("4"); await page.getByRole("button", { name: /^Level 4:/ }).click();
  await expect(page.getByRole("button", { name: "STR +2", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.goto(base + "/details"); await page.getByRole("textbox", { name: "Character name", exact: true }).fill(name);
  await page.getByRole("combobox", { name: "Alignment", exact: true }).selectOption("Neutral Good");
  await save(page, () => page.getByRole("button", { name: "Save details", exact: true }).click());
  await expect(page.getByText("Character details saved.", { exact: true })).toBeVisible();
  await page.goto(base + "/equipment");
  const groups = page.getByRole("group").filter({ has: page.getByRole("button", { name: /^\(a\)/ }) });
  await expect(groups.first()).toBeVisible();
  for (let index = 0; index < await groups.count(); index++) await choose(page, groups.nth(index).getByRole("button").first());
  const slots = page.getByRole("combobox");
  for (let index = 0; index < await slots.count(); index++) {
    const slot = slots.nth(index); await slot.click(); await expect(page.getByRole("listbox")).toBeVisible();
    const sword = page.getByRole("option", { name: "Longsword", exact: true });
    const option = await sword.count() ? sword : page.getByRole("option").first();
    await save(page, () => option.click());
    await expect(slot).toBeEnabled();
  }
  await expect(page.getByRole("button", { name: "Confirm Equipment", exact: true })).toBeEnabled();
  await page.reload(); await expect(page.getByRole("button", { name: "Confirm Equipment", exact: true })).toBeEnabled();
  await expect(page.getByText("Starting equipment award recorded", { exact: true })).toHaveCount(0);

  const state = JSON.parse(await readFile(resolve(dirname(configFile), "../state.json"), "utf8"));
  if (state.project !== "inkborne-app-flow-20261022" || state.catalogMode !== "real-srd" || state.ready !== true || state.stoppedUtc) throw Error("Wrong disposable runtime");
  const db = state.containers.find((item: { name: string }) => item.name === `/${state.project}-db`);
  if (!db || !/^[a-f0-9]{64}$/.test(db.id)) throw Error("Missing owned database identity");
  expect(state.engineId).toBe(initialState.engineId); expect(db.id).toBe(initialDb.id);
  const processes: unknown[] = [];
  const run = (args: string[], input?: string) => {
    const startedUtc = new Date().toISOString(), result = spawnSync("C:/Users/kaios/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe", ["--context", "desktop-linux", ...args],
      { cwd: process.cwd(), input, encoding: "utf8", windowsHide: true, timeout: 45000, maxBuffer: 4 * 1024 * 1024 });
    processes.push({ pid: result.pid, parentPid: process.pid, cwd: process.cwd(), args, startedUtc, finishedUtc: new Date().toISOString(), exitCode: result.status });
    if (result.status !== 0) throw Error("Owned preparation readback failed; raw output withheld"); return result.stdout.trim();
  };
  expect(run(["info", "--format", "{{.ID}}"])).toBe(state.engineId);
  const identity = JSON.parse(run(["inspect", "--format", '{"id":{{json .Id}},"labels":{{json .Config.Labels}},"status":{{json .State.Status}}}', db.id]));
  expect(identity.id).toBe(db.id); expect(identity.labels["com.docker.compose.project"]).toBe(state.project); expect(identity.status).toBe("running");
  const sql = (query: string) => JSON.parse(run(["exec", "-i", "--env", "PGOPTIONS=-c statement_timeout=15000 -c lock_timeout=5000 -c default_transaction_read_only=on",
    db.id, "psql", "-X", "--no-password", "--host", "/var/run/postgresql", "--username", "postgres", "--dbname", "postgres", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1",
    "--set", `character_id=${characterId}`, "--set", `actor_id=${config.owner.id}`, "--file", "-"], query)) as unknown;
  const native = sql(await readFile(resolve(process.cwd(), "supabase/verification/builder-parent-admission-readback.sql"), "utf8")), eligibility = sql(PARENT_ASI_ELIGIBILITY_SQL);
  validateParentPreparationNative(native, eligibility, characterId, config.owner.id);
  const nativePath = info.outputPath("parent-admission-preparation-native.json");
  await writeFile(nativePath, JSON.stringify({ observedUtc: new Date().toISOString(), processes, native, eligibility }, null, 2));
  expect(blockedOrigins).toEqual([]); expect(pageErrors).toEqual([]); expect(captureSource(process.cwd())).toEqual(source);
  const output = info.outputPath("parent-admission-preparation.json");
  await writeFile(output, JSON.stringify({ actualApp: true, actualAuthCookies: true, actualPostgrest: true, uiWritesOnly: true,
    fixtureKind: "unawarded-fighter4-acolyte", allSixAbilityScoresSaved: true, equipmentConfirmEnabledButNotClicked: true,
    runId, source, actorId: config.owner.id, characterId, native, eligibility, nativePath, blockedOrigins, pageErrors,
    physicalEligibleGrantCreated: false, fullParentAcceptance: false, nativeContentionAccepted: false }, null, 2));
  await info.attach("parent-admission-preparation", { path: output, contentType: "application/json" });
});
