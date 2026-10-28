import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, resolve, sep } from "node:path";
import { expect, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { ANCESTRY_FAMILY_CHECKS } from "../../scripts/ancestry-hp-acceptance";
import type { ParentObservation } from "../../scripts/parent-admission-acceptance";

export type Account = { id: string; email: string; password: string };
export type Settings = { appOrigin: string; supabaseOrigin: string; owner: Account; other: Account };
export type Snapshot = { label: string; path: string; data: ParentObservation };
export type Link = { path: string; sha256: string };
export type Outcome = { status: string; receipt: Record<string, unknown> };
export type Intent = { contract_version: 1; operation_id: string; character_id: string; command: "update_subclass_version"; fields: Record<string, unknown> };
export type AccessAttempt = { actor: "owner" | "foreign" | "service"; name: string; http: number; code: string | null;
  affectedRows: number | null; outcome: "refused" | "zero_rows" | "missing" | "void_unchanged";
  beforeFingerprint: string; afterFingerprint: string };
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const hash = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");

export async function publicArtifact(file: string, roots: string[], expectedName?: RegExp) {
  const path = await realpath(resolve(file)), name = basename(path);
  assert(!path.toLowerCase().split(sep).includes("private"), "Public evidence only");
  if (expectedName) assert(expectedName.test(name), "Unexpected evidence filename");
  const allowed = await Promise.all(roots.map(root => realpath(root)));
  assert(allowed.some(root => path.toLowerCase().startsWith((root + sep).toLowerCase())), "Evidence escapes its admitted directory");
  const bytes = await readFile(path); assert(bytes.byteLength < 8 * 1024 * 1024, "Bounded evidence only");
  return { path, sha256: hash(bytes), data: JSON.parse(bytes.toString("utf8")) };
}

export async function inputs() {
  const configFile = process.env.INKBORNE_LOCAL_FLOW_CONFIG, runId = process.env.INKBORNE_LOCAL_FLOW_RUN_ID;
  assert(configFile && runId && uuid.test(runId), "Use the bounded parent-positive-app wrapper");
  const config = JSON.parse(await readFile(configFile, "utf8")) as Settings;
  for (const origin of [config.appOrigin, config.supabaseOrigin]) {
    const url = new URL(origin); assert(url.protocol === "http:" && url.hostname === "127.0.0.1" && url.origin === origin, "Exact loopback origins required");
  }
  for (const account of [config.owner, config.other]) assert(account && uuid.test(account.id) && account.email && account.password, "Two disposable accounts required");
  assert.notEqual(config.owner.id, config.other.id);
  const runtime = resolve(dirname(configFile), ".."), roots = [runtime, resolve(runtime, "../evidence"), resolve(process.cwd(), "test-results/local-app")];
  const state = JSON.parse(await readFile(resolve(runtime, "state.json"), "utf8"));
  assert(state.project === "inkborne-app-flow-20261022" && state.catalogMode === "real-srd" && state.ready === true && !state.stoppedUtc);
  const db = state.containers.find((item: { name: string }) => item.name === `/${state.project}-db`);
  assert(db && /^[a-f0-9]{64}$/.test(db.id));
  const readInput = async (key: string, name: RegExp) => {
    const file = process.env[key]; assert(file, `Required scoped public artifact: ${key}`); return publicArtifact(file, roots, name);
  };
  const preparation = await readInput("INKBORNE_PARENT_FIXTURE", /^parent-admission-fixture-[a-zA-Z0-9-]+\.json$/);
  const nativeEvidence = await readInput("INKBORNE_PARENT_NATIVE_EVIDENCE", /^parent-admission-native-[a-zA-Z0-9-]+\.json$/);
  const fiendEvidence = await readInput("INKBORNE_PARENT_FIEND_EVIDENCE", /^subclass-content-update-actual-readback\.json$/);
  for (const item of [preparation.data, nativeEvidence.data, fiendEvidence.data]) {
    assert.equal(item.engineId, state.engineId); assert.equal(item.databaseId, db.id);
  }
  assert.equal(preparation.data.purpose, "parent-admission-genuine-fighter4"); assert.equal(preparation.data.actorId, config.owner.id);
  assert(uuid.test(preparation.data.characterId));
  assert.equal(nativeEvidence.data.kind, "builder-parent-admission-native-actual-v1"); assert.equal(nativeEvidence.data.passed, true);
  assert.equal(nativeEvidence.data.authenticationAccepted, false); assert.equal(nativeEvidence.data.fixture.characterId, preparation.data.characterId);
  assert.equal(nativeEvidence.data.fixtureBefore.fixtureFingerprint, preparation.data.fixtureFingerprint);
  assert.deepEqual(nativeEvidence.data.fixtureAfter, nativeEvidence.data.fixtureBefore);
  assert.equal(nativeEvidence.data.prerequisites.descriptor.sha256, preparation.sha256);
  assert.equal(fiendEvidence.data.accepted, true); assert.equal(fiendEvidence.data.acceptedNativeSnapshots, 11);
  assert.equal(fiendEvidence.data.wrapper.exitCode, 0); assert.deepEqual(fiendEvidence.data.wrapper.remainingIdentities, []);
  assert(uuid.test(fiendEvidence.data.targetId) && uuid.test(fiendEvidence.data.controlId));
  assert.notEqual(fiendEvidence.data.targetId, fiendEvidence.data.controlId);
  const linked = async (link: Link) => { const item = await publicArtifact(link.path, roots); assert.equal(item.sha256, link.sha256); return item; };
  const preparedStory = await linked(preparation.data.story), preparedWrapper = await linked(preparation.data.wrapper);
  assert.equal(preparedStory.data.actualApp, true); assert.equal(preparedStory.data.actualAuthCookies, true);
  assert.equal(preparedStory.data.characterId, preparation.data.characterId); assert.equal(preparedStory.data.actorId, config.owner.id);
  assert.equal(preparedWrapper.data.exitCode, 0); assert.deepEqual(preparedWrapper.data.remainingIdentities, []);
  const installation = await linked(preparation.data.parentInstall);
  assert.equal(installation.data.installed, true); assert.equal(installation.data.file, "supabase/staged/character-builder-parent-admission.sql");
  assert.equal(hash(await readFile(resolve(process.cwd(), installation.data.file))), installation.data.sourceSha256);
  return { config, configFile, runtime, state, db, runId, preparation, nativeEvidence, fiendEvidence };
}
export type Inputs = Awaited<ReturnType<typeof inputs>>;

export async function restrict(context: BrowserContext, config: Settings, blocked: string[]) {
  const allowed = new Set([config.appOrigin, config.supabaseOrigin]);
  await context.route("**/*", route => {
    const origin = new URL(route.request().url()).origin;
    if (!allowed.has(origin)) { blocked.push(origin); return route.abort(); }
    return route.continue();
  });
}
export async function login(page: Page, config: Settings, account: Account) {
  try {
    await page.goto(config.appOrigin + "/login"); await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password); await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(config.appOrigin + "/dashboard", { timeout: 60000 });
  } catch { await page.close(); throw Error("Actual local sign-in failed; credentials withheld"); }
  expect((await page.context().cookies()).some(cookie => cookie.name.startsWith("sb-"))).toBe(true);
}
export function actionResult(body: string): Outcome {
  for (const line of body.split("\n")) {
    try {
      const value = JSON.parse(line.slice(line.indexOf(":") + 1));
      if (value && typeof value === "object" && ["applied", "replayed", "recorded"].includes(value.status) && value.receipt) return value as Outcome;
    } catch { /* Flight metadata is not a mutation outcome. Never log response bodies. */ }
  }
  throw Error("No strict mutation outcome in the actual Server Action response");
}
export async function save(page: Page, change: () => Promise<unknown>) {
  const pathname = new URL(page.url()).pathname;
  const [response] = await Promise.all([page.waitForResponse(item => item.request().method() === "POST" && new URL(item.url()).pathname === pathname), change()]);
  expect(response.status()).toBe(200);
  return response;
}

export function reader(input: Inputs, info: TestInfo, source: { head: string; diffSha256: string }) {
  const processes: unknown[] = [];
  const run = (lane: "engine" | "container" | "native" | "detail" | "family" | "fiend-guard", args: string[], sql?: string) => {
    const startedUtc = new Date().toISOString();
    const result = spawnSync("C:/Users/kaios/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe", ["--context", "desktop-linux", ...args],
      { cwd: process.cwd(), input: sql, encoding: "utf8", windowsHide: true, timeout: 45000, maxBuffer: 8 * 1024 * 1024 });
    processes.push({ lane, pid: result.pid, parentPid: process.pid, cwd: process.cwd(),
      executable: "C:/Users/kaios/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe",
      args: ["--context", "desktop-linux", ...args], startedUtc, finishedUtc: new Date().toISOString(), exitCode: result.status });
    if (result.status !== 0) throw Error("Owned read-only parent evidence failed; raw output withheld");
    return result.stdout.trim();
  };
  const identity = async () => {
    const state = JSON.parse(await readFile(resolve(input.runtime, "state.json"), "utf8"));
    assert.equal(state.engineId, input.state.engineId); assert.equal(state.ready, true); assert(!state.stoppedUtc);
    assert.equal(state.containers.find((row: { name: string }) => row.name === `/${state.project}-db`)?.id, input.db.id);
    assert.equal(run("engine", ["info", "--format", "{{.ID}}"]), input.state.engineId);
    const inspected = JSON.parse(run("container", ["inspect", "--format", '{"id":{{json .Id}},"labels":{{json .Config.Labels}},"status":{{json .State.Status}}}', input.db.id]));
    assert.equal(inspected.id, input.db.id); assert.equal(inspected.labels["com.docker.compose.project"], input.state.project); assert.equal(inspected.status, "running");
  };
  const sql = async (file: string, characterId: string, controlId?: string) => {
    assert(uuid.test(characterId) && (!controlId || uuid.test(controlId)));
    const query = await readFile(resolve(process.cwd(), file), "utf8");
    const lane = file.endsWith("builder-parent-admission-readback.sql") ? "native" : file.endsWith("builder-parent-positive-detail.sql") ? "detail"
      : file.endsWith("builder-class-choices-readback.sql") ? "family" : "fiend-guard";
    return JSON.parse(run(lane, ["exec", "-i", "--env", "PGOPTIONS=-c statement_timeout=15000 -c lock_timeout=5000 -c default_transaction_read_only=on",
      input.db.id, "psql", "-X", "--no-password", "--host", "/var/run/postgresql", "--username", "postgres", "--dbname", "postgres", "--quiet", "--tuples-only", "--no-align",
      "--set", "ON_ERROR_STOP=1", "--set", `character_id=${characterId}`, "--set", `actor_id=${input.config.owner.id}`,
      ...(controlId ? ["--set", `control_id=${controlId}`] : []), "--file", "-"], query));
  };
  const observe = async (characterId: string): Promise<ParentObservation> => {
    await identity();
    const native = await sql("supabase/verification/builder-parent-admission-readback.sql", characterId);
    const detail = await sql("supabase/verification/builder-parent-positive-detail.sql", characterId);
    const family = await sql("supabase/verification/builder-class-choices-readback.sql", characterId);
    for (const value of [native, detail]) { expect(value.characterId).toBe(characterId); expect(value.actorId).toBe(input.config.owner.id); }
    expect(native.enrolled).toBe(true); expect(native.firstClassProofs).toHaveLength(1); expect(native.firstClassProofs[0].phase).toBe("observed");
    expect(native.capsRemaining).toBe(0); expect(native.sealsRemaining).toBe(0); expect(native.readyCount).toBe(0); expect(native.readinessCount).toBe(13);
    expect(native.classGate).toBe(false); expect(native.hitDieGate).toBe(false); expect(native.servicePrivateUsage).toBe(false);
    expect(native.parentOrderRevisionEqual).toBe(true); expect(Object.values(native.orderBijections)).toEqual([true, true, true, true, true]);
    for (const check of ANCESTRY_FAMILY_CHECKS) expect(family[check], check).toBe(true);
    expect(detail.inventoryFromAcceptedAward).toBe(true);
    return { native, detail, family };
  };
  const snapshot = async (label: string, characterId: string, into: Snapshot[]) => {
    const firstProcess = processes.length;
    const data = await observe(characterId), path = info.outputPath(`parent-positive-${label}.json`);
    const captured = processes.slice(firstProcess);
    expect(captured).toHaveLength(5);
    await writeFile(path, JSON.stringify({ label, data, runId: input.runId, source, engineId: input.state.engineId, databaseId: input.db.id, processes: captured }, null, 2), { flag: "wx" });
    const item = { label, path, data }; into.push(item); return item;
  };
  return { observe, snapshot, sql, identity, processes };
}

export async function httpIdentity(input: Inputs) {
  // Keys/tokens stay in the test worker, never in browser globals or artifacts.
  const environment = JSON.parse(await readFile(resolve(dirname(input.configFile), "server-env.json"), "utf8"));
  assert.equal(environment.NEXT_PUBLIC_SUPABASE_URL, input.config.supabaseOrigin);
  const apikey = environment.NEXT_PUBLIC_SUPABASE_ANON_KEY, service = environment.SUPABASE_SERVICE_ROLE_KEY;
  assert(typeof apikey === "string" && apikey && typeof service === "string" && service, "Scoped local API keys required; values withheld");
  const serviceClaims = JSON.parse(Buffer.from(service.split(".")[1], "base64url").toString("utf8"));
  assert.equal(serviceClaims.role, "service_role", "The scoped service JWT must identify its actual role");
  const authenticate = async (account: Account) => {
    const response = await fetch(input.config.supabaseOrigin + "/auth/v1/token?grant_type=password", { method: "POST",
      headers: { apikey, "Content-Type": "application/json" }, body: JSON.stringify({ email: account.email, password: account.password }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Error("Local JWT authentication failed; credentials/response withheld");
    const session = await response.json(); assert(typeof session.access_token === "string", "Local JWT unavailable");
    const claims = JSON.parse(Buffer.from(session.access_token.split(".")[1], "base64url").toString("utf8"));
    assert.equal(claims.sub, account.id); assert.equal(claims.role, "authenticated"); assert(uuid.test(claims.session_id)); assert(Number.isInteger(claims.exp));
    assert.equal(claims.is_anonymous, false); assert.equal(claims.iss, input.config.supabaseOrigin + "/auth/v1");
    assert(claims.exp * 1000 > Date.now(), "Fresh local JWT required");
    return { token: session.access_token as string, context: { context_version: 1, actor_id: account.id, session_id: claims.session_id as string,
      jwt_expires_at: new Date(claims.exp * 1000).toISOString().replace(".000Z", ".000000Z") } };
  };
  const owner = await authenticate(input.config.owner), foreign = await authenticate(input.config.other);
  const request = async (token: string, path: string, method: string, body?: unknown) => {
    assert(path.startsWith("/rest/v1/"));
    const response = await fetch(input.config.supabaseOrigin + path, { method, headers: { apikey, Authorization: "Bearer " + token,
      "Content-Type": "application/json", Prefer: "return=representation" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
    const text = await response.text(); let data: unknown = null;
    if (text) { try { data = JSON.parse(text); } catch { throw Error("Scoped local HTTP result was not JSON; response withheld"); } }
    return { http: response.status, data };
  };
  return { owner, foreign, service: { token: service as string }, request };
}
