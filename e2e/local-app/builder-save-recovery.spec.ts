import { test, expect, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";

const pendingPrefix = "inkborne:pending-builder-step:v1:";
type Settings = { appOrigin: string; supabaseOrigin: string; owner: { email: string; password: string; id: string } };
type Pending = { account_id: string; intent: { operation_id: string; character_id: string; command: string; fields: Record<string, unknown> } };
type Native = { characterId: string; actorId: string; actionRevision: string; scores: Record<string, number>; pins: string[];
  receiptCount: number; receipts: { operationId: string; actorId: string; request: Record<string, unknown>;
    receipt: { operation_id: string; character_id: string; actor_id: string; command: string; fields: Record<string, unknown>; action_revision: string } }[];
  hpDraws: { operationId: string; actorId: string; occurrenceId: string; level: number; die: number; value: number }[];
  progressionHistoryCount: number; orderBijections: Record<string, boolean>; parentOrderRevisionEqual: boolean;
  capsRemaining: number; readinessCount: number; writerReadiness: number; classGate: boolean; hitDieGate: boolean; servicePrivateUsage: boolean };
type Story = { config: Settings; characterId: string; name: string; blockedOrigins: string[]; pageErrors: string[]; snapshots: Native[] };

async function configuration(): Promise<Settings> {
  const file = process.env.INKBORNE_LOCAL_FLOW_CONFIG;
  if (!file) throw Error("Provide the isolated local browser configuration file");
  const config = JSON.parse(await readFile(file, "utf8")) as Settings;
  for (const origin of [config.appOrigin, config.supabaseOrigin]) {
    const url = new URL(origin);
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.origin !== origin) throw Error("Recovery stories require explicit local loopback origins");
  }
  if (!config.owner?.email || !config.owner.password || !/^[0-9a-f-]{36}$/.test(config.owner.id)) throw Error("Disposable owner required");
  return config;
}

async function save(page: Page, change: () => Promise<unknown>) {
  const pathname = new URL(page.url()).pathname;
  const [response] = await Promise.all([page.waitForResponse(item => item.request().method() === "POST" && new URL(item.url()).pathname === pathname), change()]);
  expect(response.status()).toBe(200);
}

async function begin(page: Page, context: BrowserContext, label: string): Promise<Story> {
  const config = await configuration(), blockedOrigins: string[] = [], pageErrors: string[] = [];
  const allowed = new Set([config.appOrigin, config.supabaseOrigin]);
  await context.route("**/*", route => {
    const origin = new URL(route.request().url()).origin;
    if (!allowed.has(origin)) { blockedOrigins.push(origin); return route.abort(); }
    return route.continue();
  });
  page.on("pageerror", () => pageErrors.push("browser error"));
  // The unsaved-ability warning is expected while intentionally reloading a lost response.
  page.on("dialog", dialog => dialog.accept());
  console.log(JSON.stringify({ workerPid: process.pid, parentPid: process.ppid, cwd: process.cwd(), startedUtc: new Date().toISOString(), story: label }));
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
  const name = `Recovery ${label} ${randomUUID().slice(0, 8)}`;
  await page.getByRole("textbox", { name: "What will they be called?" }).fill(name);
  await page.getByRole("button", { name: "Open the notebook", exact: true }).click();
  await page.waitForURL(/\/characters\/[0-9a-f-]+\/builder\/first-class$/);
  const characterId = new URL(page.url()).pathname.split("/")[2];
  await page.getByRole("combobox", { name: "First class", exact: true }).selectOption({ label: "Fighter" });
  await page.getByRole("button", { name: "Save first class", exact: true }).click();
  await expect(page.getByText("Fighter · Level 1", { exact: true })).toBeVisible();
  await page.goto(`${config.appOrigin}/characters/${characterId}/builder/abilities`);
  const strength = page.getByRole("combobox", { name: "Strength score", exact: true });
  await save(page, () => strength.selectOption("15"));
  await expect(page.getByText("Changes save automatically.", { exact: true })).toBeVisible();
  return { config, characterId, name, blockedOrigins, pageErrors, snapshots: [] };
}

async function pending(page: Page, story: Story): Promise<Pending | null> {
  return page.evaluate(({ prefix, owner, character }) => {
    const raw = sessionStorage.getItem(prefix + owner + ":" + character);
    return raw === null ? null : JSON.parse(raw);
  }, { prefix: pendingPrefix, owner: story.config.owner.id, character: story.characterId });
}

async function readback(info: TestInfo, story: Story, label: string): Promise<Native> {
  const configFile = process.env.INKBORNE_LOCAL_FLOW_CONFIG;
  if (!configFile || !/^[0-9a-f-]{36}$/.test(story.characterId)) throw Error("Local native evidence configuration required");
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
    if (result.status !== 0) throw Error(`Local read-only evidence failed: ${result.stderr.slice(0, 1200)}`);
    return result.stdout.trim();
  };
  expect(run(["info", "--format", "{{.ID}}"]).trim()).toBe(state.engineId);
  const inspected = JSON.parse(run(["inspect", "--format", '{"id":{{json .Id}},"labels":{{json .Config.Labels}}}', db.id]));
  expect(inspected.id).toBe(db.id); expect(inspected.labels["com.docker.compose.project"]).toBe(state.project);
  const sql = await readFile(resolve(process.cwd(), "supabase/verification/builder-save-recovery-readback.sql"), "utf8");
  const evidence = JSON.parse(run(["exec", "-i", db.id, "psql", "-X", "--no-password", "--host", "/var/run/postgresql", "--username", "supabase_admin",
    "--dbname", "postgres", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--set", `character_id=${story.characterId}`, "--file", "-"], sql)) as Native;
  expect(evidence.characterId).toBe(story.characterId); expect(evidence.actorId).toBe(story.config.owner.id);
  expect(Object.values(evidence.orderBijections)).toEqual([true, true, true, true, true]);
  expect(evidence.parentOrderRevisionEqual).toBe(true); expect(evidence.capsRemaining).toBe(0);
  expect(evidence.readinessCount).toBe(13); expect(evidence.writerReadiness).toBe(0);
  expect(evidence.classGate).toBe(false); expect(evidence.hitDieGate).toBe(false); expect(evidence.servicePrivateUsage).toBe(false);
  story.snapshots.push(evidence);
  await writeFile(info.outputPath(`native-recovery-${story.snapshots.length}-${label}.json`), JSON.stringify({ observedUtc: new Date().toISOString(), label, processes, ...evidence }, null, 2));
  return evidence;
}

/** route.fetch performs the real app write; only its delivery to the browser is lost. */
async function loseResponse(page: Page, story: Story, change: () => Promise<unknown>, commit: boolean): Promise<Pending> {
  const pathname = new URL(page.url()).pathname;
  let retained: Pending | null = null;
  let resolveIntercept!: () => void;
  const intercepted = new Promise<void>(done => { resolveIntercept = done; });
  await page.route(url => url.pathname === pathname, async route => {
    if (route.request().method() !== "POST") return route.continue();
    retained = await pending(page, story);
    expect(retained, "Original complete intent must exist before the request is sent").not.toBeNull();
    if (commit) expect((await route.fetch()).status()).toBe(200);
    await route.abort("failed");
    resolveIntercept();
  }, { times: 1 });
  await change(); await intercepted;
  const recovery = page.getByRole("region", { name: "Builder save recovery", exact: true });
  await expect(recovery.getByRole("button", { name: "Check save", exact: true })).toBeEnabled();
  expect(await pending(page, story)).toEqual(retained);
  return retained as unknown as Pending;
}

function sameCommit(before: Native, after: Native, original: Pending, expectedCommand: string) {
  expect(after.receiptCount).toBe(before.receiptCount + 1);
  expect(BigInt(after.actionRevision)).toBe(BigInt(before.actionRevision) + BigInt(1));
  expect(after.pins).toEqual(before.pins);
  const receipts = after.receipts.filter(receipt => receipt.operationId === original.intent.operation_id);
  expect(receipts).toHaveLength(1);
  expect(receipts[0].actorId).toBe(original.account_id);
  expect(receipts[0].request).toEqual(original.intent);
  expect(receipts[0].receipt).toMatchObject({ operation_id: original.intent.operation_id, character_id: original.intent.character_id,
    actor_id: original.account_id, command: expectedCommand, fields: original.intent.fields, action_revision: after.actionRevision });
}

async function finish(info: TestInfo, page: Page, story: Story, original: Pending) {
  await expect.poll(() => pending(page, story)).toBeNull();
  const confirmed = await readback(info, story, "confirmed");
  await page.reload();
  expect(await pending(page, story)).toBeNull();
  const repeated = await readback(info, story, "repeated-reload");
  expect(repeated).toEqual(confirmed);
  expect(story.blockedOrigins).toEqual([]); expect(story.pageErrors).toEqual([]);
  const file = info.outputPath("builder-save-recovery.json");
  await writeFile(file, JSON.stringify({ actualApp: true, actualAuthCookies: true, actualPostgrest: true,
    characterId: story.characterId, name: story.name, operationId: original.intent.operation_id, command: original.intent.command,
    originalIntentRetainedAcrossReload: true, exactlyOneCommit: true, reloadAddsNoReceiptOrRevision: true,
    blockedOrigins: story.blockedOrigins, pageErrors: story.pageErrors, snapshots: story.snapshots }, null, 2));
  await info.attach("builder-save-recovery", { path: file, contentType: "application/json" });
}

test("ordinary ability save recovers its committed receipt after response loss and reload", async ({ page, context }, info) => {
  const story = await begin(page, context, "committed-abilities");
  const before = await readback(info, story, "before");
  const original = await loseResponse(page, story, () => page.getByRole("combobox", { name: "Strength score", exact: true }).selectOption("14"), true);
  const committed = await readback(info, story, "committed-response-lost");
  sameCommit(before, committed, original, "save_abilities"); expect(committed.scores.strength).toBe(14);
  await page.reload(); expect(await pending(page, story)).toEqual(original);
  await expect(page.getByRole("combobox", { name: "Strength score", exact: true })).toHaveCount(0);
  await page.getByRole("region", { name: "Builder save recovery", exact: true }).getByRole("button", { name: "Check save", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Strength score", exact: true })).toBeEnabled();
  await expect(page.getByRole("combobox", { name: "Strength score", exact: true })).toHaveValue("14");
  await finish(info, page, story, original);
});

test("ordinary ability save retries the exact absent intent after response loss and reload", async ({ page, context }, info) => {
  const story = await begin(page, context, "absent-abilities");
  const before = await readback(info, story, "before");
  const original = await loseResponse(page, story, () => page.getByRole("combobox", { name: "Strength score", exact: true }).selectOption("14"), false);
  expect(await readback(info, story, "absent-request-lost")).toEqual(before);
  await page.reload(); expect(await pending(page, story)).toEqual(original);
  const recovery = page.getByRole("region", { name: "Builder save recovery", exact: true });
  await recovery.getByRole("button", { name: "Check save", exact: true }).click();
  await expect(recovery.getByRole("button", { name: "Retry original save", exact: true })).toBeEnabled();
  expect(await pending(page, story)).toEqual(original);
  expect(await readback(info, story, "absence-check-does-not-write")).toEqual(before);
  await recovery.getByRole("button", { name: "Retry original save", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Strength score", exact: true })).toBeEnabled();
  await expect(page.getByRole("combobox", { name: "Strength score", exact: true })).toHaveValue("14");
  const after = await readback(info, story, "original-retry-applied"); sameCommit(before, after, original, "save_abilities");
  await finish(info, page, story, original);
});

test("rolled HP recovers one server draw after its save response is lost and the builder reloads", async ({ page, context }, info) => {
  const story = await begin(page, context, "rolled-hp");
  await page.goto(`${story.config.appOrigin}/characters/${story.characterId}/builder/class`);
  await save(page, () => page.getByRole("combobox", { name: "Set level for Fighter", exact: true }).selectOption("2"));
  await page.getByRole("button", { name: /^Level 2:/ }).click();
  const before = await readback(info, story, "before"); expect(before.hpDraws).toHaveLength(0);
  const original = await loseResponse(page, story, () => page.getByRole("radio", { name: /^Roll d10/ }).click(), true);
  const committed = await readback(info, story, "committed-response-lost"); sameCommit(before, committed, original, "save_hp_roll");
  expect(committed.hpDraws).toHaveLength(1); expect(committed.hpDraws[0]).toMatchObject({ operationId: original.intent.operation_id, actorId: story.config.owner.id, level: 2, die: 10 });
  expect(committed.hpDraws[0].value).toBeGreaterThanOrEqual(1); expect(committed.hpDraws[0].value).toBeLessThanOrEqual(10);
  expect(committed.progressionHistoryCount).toBe(before.progressionHistoryCount + 1);
  await page.reload(); expect(await pending(page, story)).toEqual(original);
  await page.getByRole("region", { name: "Builder save recovery", exact: true }).getByRole("button", { name: "Check save", exact: true }).click();
  // Confirmation intentionally replaces the document. Wait for its fresh editor
  // before evaluating storage in that new execution context.
  await expect(page.getByRole("combobox", { name: "Set level for Fighter", exact: true })).toBeEnabled();
  expect(await pending(page, story)).toBeNull();
  await page.getByRole("button", { name: /^Level 2:/ }).click();
  const rolled = page.getByRole("radio", { name: /^Roll d10/ });
  await expect(rolled).toHaveAttribute("aria-checked", "true");
  // No Constitution assignment in this bounded draft: its default modifier is zero.
  await expect(rolled).toContainText(`(+${committed.hpDraws[0].value})`);
  await finish(info, page, story, original);
});
