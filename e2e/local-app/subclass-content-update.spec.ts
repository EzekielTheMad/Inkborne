import { test, expect, type Browser, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";

const pendingPrefix = "inkborne:pending-builder-step:v1:";
const reviewName = "Fiend content update review";
const warning = "Your saved Fiend content uses an earlier spell-list version. Your choices are preserved. Correct expanded spell choices require a reviewed content-version update.";
type Account = { email: string; password: string; id: string };
type Settings = { appOrigin: string; supabaseOrigin: string; owner: Account; other: Account };
type Pending = { account_id: string; intent: { contract_version: number; operation_id: string; character_id: string; command: string; fields: Record<string, unknown> } };
type Native = {
  characterId: string; actorId: string; actionRevision: string; level: number; choices: Record<string, unknown>;
  scores: Record<string, number>; state: Record<string, unknown>; originalOccurrenceId: string;
  occurrences: Array<Record<string, unknown>>; classRoots: Array<Record<string, unknown>>;
  subclassRoots: Array<{ id: string; contentId: string; slug: string; version: number }>;
  pins: Array<Record<string, unknown>>; featureGrants: Array<Record<string, unknown>>; spellGrants: Array<Record<string, unknown>>;
  spells: Array<{ id: string; slug: string; classSlug: string; source: string; level: number; grantId: string | null }>;
  fiendFreeRows: number; warlockCantrips: number; warlockKnown: number; inventory: Array<Record<string, unknown>>;
  startingAwards: Array<Record<string, unknown>>; hpDraws: Array<Record<string, unknown>>;
  receiptCount: number; updateReceipts: Array<{ operationId: string; request: unknown; receipt: { action_revision: string; fields: unknown } }>;
  updateHistoryCount: number; fiendDefinitionVersion: number; fiendSnapshots: Array<{ id: string; version: number; digest: string; extra: boolean; expanded: boolean }>;
  profileCharacterCount: number; controlFingerprint: string; controlCharacterId: string; controlActorId: string; controlOriginalOccurrenceId: string; controlFiendVersion: number;
  orderBijections: Record<string, boolean>; parentOrderRevisionEqual: boolean;
  capsRemaining: number; readinessCount: number; writerReadiness: number; classGate: boolean; hitDieGate: boolean; servicePrivateUsage: boolean;
};
type Story = { config: Settings; targetId: string; controlId: string; blockedOrigins: string[]; pageErrors: string[];
  actionsPath: string; snapshots: Array<{ label: string; path: string; data: Native }>; actions: Array<{ label: string; result: Record<string, unknown> }> };
const originalScores = { Strength: "8", Dexterity: "14", Constitution: "12", Intelligence: "10", Wisdom: "13", Charisma: "15" };
const ordinarySpells = ["Comprehend Languages", "Charm Person", "Expeditious Retreat", "Hellish Rebuke"];

async function settings(): Promise<Settings> {
  const file = process.env.INKBORNE_LOCAL_FLOW_CONFIG;
  if (!file) throw Error("Provide the isolated local browser configuration file");
  const config = JSON.parse(await readFile(file, "utf8")) as Settings;
  for (const origin of [config.appOrigin, config.supabaseOrigin]) {
    const url = new URL(origin);
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.origin !== origin) throw Error("Content update stories require explicit local loopback origins");
  }
  for (const account of [config.owner, config.other]) {
    if (!account?.email || !account.password || !/^[0-9a-f-]{36}$/.test(account.id)) throw Error("Disposable verification accounts required");
  }
  if (config.owner.id === config.other.id) throw Error("Distinct disposable accounts required");
  return config;
}
async function save(page: Page, change: () => Promise<unknown>) {
  const pathname = new URL(page.url()).pathname;
  const [response] = await Promise.all([page.waitForResponse(item => item.request().method() === "POST" && new URL(item.url()).pathname === pathname), change()]);
  expect(response.status()).toBe(200);
}
async function choose(page: Page, option: Locator) {
  await save(page, () => option.click());
  await expect(option).toHaveAttribute("aria-pressed", "true"); await expect(option).toBeEnabled();
}
async function openLevel(page: Page, level: number) {
  await page.getByRole("button", { name: new RegExp(`^Level ${level}:`) }).first().click();
}
async function selectSpell(panel: Locator, name: string, checked = true, cantrip = false) {
  const searches = panel.getByRole("textbox"); await (cantrip ? searches.first() : searches.last()).fill(name);
  await panel.getByRole("checkbox", { name: `Select ${name}`, exact: true }).setChecked(checked);
}
async function saveSpells(page: Page, panel: Locator) {
  await save(page, () => panel.getByRole("button", { name: "Save spells", exact: true }).click());
  await expect(panel.getByText("Spell choices saved.", { exact: true })).toBeVisible();
}
function classUrl(story: Story, id = story.targetId) { return `${story.config.appOrigin}/characters/${id}/builder/class`; }
async function createFiend(page: Page, story: Story, name: string) {
  await page.goto(story.config.appOrigin + "/characters/new");
  await page.getByRole("textbox", { name: "What will they be called?" }).fill(name);
  await page.getByRole("button", { name: "Open the notebook", exact: true }).click();
  await page.waitForURL(/\/characters\/[0-9a-f-]+\/builder\/first-class$/);
  const id = new URL(page.url()).pathname.split("/")[2];
  await page.getByRole("combobox", { name: "First class", exact: true }).selectOption({ label: "Warlock" });
  await page.getByRole("button", { name: "Save first class", exact: true }).click();
  await expect(page.getByText("Warlock · Level 1", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Complete class choices", exact: true }).click(); await openLevel(page, 1);
  await choose(page, page.getByRole("button", { name: /^Fiend(?:\s|$)/ }));
  await expect(page.getByText(warning, { exact: true })).toBeVisible();
  return id;
}
async function abilities(page: Page, story: Story, id: string, scores: Record<string, string>) {
  await page.goto(`${story.config.appOrigin}/characters/${id}/builder/abilities`);
  for (const [ability, score] of Object.entries(scores)) {
    if (await page.getByRole("combobox", { name: `${ability} score`, exact: true }).inputValue() === score) continue;
    // The real standard-array editor reserves an assigned value. Release its
    // existing assignment through the app before a deliberate concurrent swap.
    for (const other of Object.keys(originalScores)) {
      if (other !== ability && await page.getByRole("combobox", { name: `${other} score`, exact: true }).inputValue() === score) {
        await save(page, () => page.getByRole("combobox", { name: `${other} score`, exact: true }).selectOption(""));
        await expect(page.getByText("Changes save automatically.", { exact: true })).toBeVisible();
      }
    }
    await save(page, () => page.getByRole("combobox", { name: `${ability} score`, exact: true }).selectOption(score));
    await expect(page.getByText("Changes save automatically.", { exact: true })).toBeVisible();
  }
}
async function awardGear(page: Page, story: Story) {
  await page.goto(`${story.config.appOrigin}/characters/${story.targetId}/builder/race`);
  await page.getByRole("button", { name: "Preview Human", exact: true }).click();
  await save(page, () => page.getByRole("button", { name: "Add Race", exact: true }).click());
  await expect(page.getByRole("button", { name: "Change Race", exact: true })).toBeVisible();
  const language = page.getByText("Choose 1 language", { exact: true }).locator("..").locator("..");
  await choose(page, language.getByRole("button", { name: "Dwarvish", exact: true }));
  await page.goto(`${story.config.appOrigin}/characters/${story.targetId}/builder/background`);
  await page.getByRole("button", { name: "Preview Acolyte", exact: true }).click();
  await save(page, () => page.getByRole("button", { name: "Add Background", exact: true }).click());
  const languages = page.getByText("Choose 2 language", { exact: true }).locator("..").locator("..");
  for (const name of ["Celestial", "Draconic"]) await choose(page, languages.getByRole("button", { name, exact: true }));
  await save(page, () => page.getByRole("button", { name: "Nothing can shake my optimistic attitude.", exact: true }).click());
  await page.goto(`${story.config.appOrigin}/characters/${story.targetId}/builder/equipment`);
  const groups = page.getByRole("group").filter({ has: page.getByRole("button", { name: /^\(a\)/ }) });
  await expect(groups.first()).toBeVisible();
  for (let index = 0; index < await groups.count(); index++) {
    const option = groups.nth(index).getByRole("button").first();
    if (await option.getAttribute("aria-pressed") !== "true") await choose(page, option);
  }
  const slots = page.getByRole("combobox");
  for (let index = 0; index < await slots.count(); index++) {
    await slots.nth(index).click(); await expect(page.getByRole("listbox")).toBeVisible();
    await save(page, () => page.getByRole("option").first().click()); await expect(slots.nth(index)).toBeEnabled();
  }
  await page.getByRole("button", { name: "Confirm Equipment", exact: true }).click();
  await expect(page.getByText("Starting equipment award recorded", { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText("Starting equipment award recorded", { exact: true })).toBeVisible();
}
async function prepareTarget(page: Page, story: Story) {
  story.targetId = await createFiend(page, story, `Repin target ${randomUUID().slice(0, 8)}`);
  for (const skill of ["Arcana", "Intimidation"]) await choose(page, page.getByRole("button", { name: skill, exact: true }));
  await abilities(page, story, story.targetId, originalScores);
  await page.goto(classUrl(story));
  const panel = page.getByRole("form", { name: "Warlock spell choices", exact: true });
  for (const name of ["Eldritch Blast", "Mage Hand"]) await selectSpell(panel, name, true, true);
  for (const name of ordinarySpells.slice(0, 2)) await selectSpell(panel, name);
  await saveSpells(page, panel); await awardGear(page, story); await page.goto(classUrl(story));
  await save(page, () => page.getByRole("combobox", { name: "Set level for Warlock", exact: true }).selectOption("2"));
  await openLevel(page, 2); await save(page, () => page.getByRole("radio", { name: /^Average/ }).click());
  await save(page, () => page.getByRole("combobox", { name: "Set level for Warlock", exact: true }).selectOption("3"));
  await openLevel(page, 3); await save(page, () => page.getByRole("radio", { name: /^Roll d8/ }).click());
  await expect(page.getByRole("radio", { name: /^Roll d8/ })).toHaveAttribute("aria-checked", "true");
  for (const name of ordinarySpells.slice(2)) await selectSpell(panel, name);
  await saveSpells(page, panel);
  await page.getByRole("button", { name: /^Add a class/ }).click();
  await page.getByRole("button", { name: /^Cleric\s/ }).click();
  await save(page, () => page.getByRole("button", { name: "Pick this class", exact: true }).click());
  const rail = page.getByRole("combobox", { name: "Set level for Cleric", exact: true }).locator("..").locator("..").locator("..");
  await rail.getByRole("button", { name: /^Level 1:/ }).click();
  await choose(page, page.getByRole("button", { name: /^Life(?:\s|$)/ }));
  await page.reload();
}
async function readback(info: TestInfo, story: Story, label: string): Promise<Native> {
  const file = process.env.INKBORNE_LOCAL_FLOW_CONFIG;
  if (!file || ![story.targetId, story.controlId].every(id => /^[0-9a-f-]{36}$/.test(id))) throw Error("Local native evidence configuration required");
  const state = JSON.parse(await readFile(resolve(dirname(file), "../state.json"), "utf8"));
  if (state.project !== "inkborne-app-flow-20261022" || !state.ready || state.stoppedUtc) throw Error("Wrong disposable runtime");
  const db = state.containers.find((item: { name: string }) => item.name === `/${state.project}-db`);
  if (!db || !/^[a-f0-9]{64}$/.test(db.id)) throw Error("Owned database identity missing");
  const processes: unknown[] = [];
  const run = (args: string[], input?: string) => {
    const startedUtc = new Date().toISOString();
    const out = spawnSync("C:/Users/kaios/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe", ["--context", "desktop-linux", ...args],
      { input, encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
    processes.push({ pid: out.pid, parentPid: process.pid, cwd: process.cwd(), args, startedUtc, exitCode: out.status });
    if (out.status !== 0) throw Error("Local read-only subclass evidence failed");
    return out.stdout.trim();
  };
  expect(run(["info", "--format", "{{.ID}}"]).trim()).toBe(state.engineId);
  const identity = JSON.parse(run(["inspect", "--format", '{"id":{{json .Id}},"labels":{{json .Config.Labels}}}', db.id]));
  expect(identity.id).toBe(db.id); expect(identity.labels["com.docker.compose.project"]).toBe(state.project);
  const sql = await readFile(resolve(process.cwd(), "supabase/verification/subclass-content-update-readback.sql"), "utf8");
  const data = JSON.parse(run(["exec", "-i", db.id, "psql", "-X", "--no-password", "--host", "/var/run/postgresql", "--username", "supabase_admin", "--dbname", "postgres",
    "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--set", `character_id=${story.targetId}`, "--set", `control_id=${story.controlId}`, "--file", "-"], sql)) as Native;
  expect(data.characterId).toBe(story.targetId); expect(data.actorId).toBe(story.config.owner.id);
  expect(data.controlCharacterId).toBe(story.controlId); expect(data.controlActorId).toBe(story.config.owner.id); expect(data.controlFiendVersion).toBe(1);
  expect(data.controlOriginalOccurrenceId).toMatch(/^[0-9a-f-]{36}$/);
  expect(data.parentOrderRevisionEqual).toBe(true); expect(Object.values(data.orderBijections)).toEqual([true, true, true, true, true]);
  expect(data.capsRemaining).toBe(0); expect(data.readinessCount).toBe(13); expect(data.writerReadiness).toBe(0);
  expect(data.classGate).toBe(false); expect(data.hitDieGate).toBe(false); expect(data.servicePrivateUsage).toBe(false);
  const output = info.outputPath(`native-subclass-${story.snapshots.length + 1}-${label}.json`);
  story.snapshots.push({ label, path: output, data });
  await writeFile(output, JSON.stringify({ observedUtc: new Date().toISOString(), label, processes, ...data }, null, 2));
  return data;
}
async function pending(page: Page, story: Story): Promise<Pending | null> {
  return page.evaluate(({ prefix, owner, character }) => {
    const value = sessionStorage.getItem(prefix + owner + ":" + character); return value === null ? null : JSON.parse(value);
  }, { prefix: pendingPrefix, owner: story.config.owner.id, character: story.targetId });
}
function actionResult(body: string): Record<string, unknown> {
  for (const line of body.split("\n")) {
    try {
      const value: unknown = JSON.parse(line.slice(line.indexOf(":") + 1));
      if (value && typeof value === "object" && "status" in value
        && ["applied", "replayed", "recorded", "rejected", "absent", "available"].includes(String(value.status))) return value as Record<string, unknown>;
    } catch { /* Ignore Flight metadata/module rows. Never log a response body. */ }
  }
  throw Error("A strict action outcome was not found in the actual app response");
}
async function dropConfirmation(page: Page, story: Story, label: string): Promise<Pending> {
  const pathname = new URL(page.url()).pathname;
  let retained: Pending | null = null;
  let done!: () => void; const intercepted = new Promise<void>(resolveDone => { done = resolveDone; });
  await page.route(url => url.pathname === pathname, async route => {
    if (route.request().method() !== "POST") return route.continue();
    retained = await pending(page, story); expect(retained).not.toBeNull(); expect(retained?.intent.command).toBe("update_subclass_version");
    const response = await route.fetch(); expect(response.status()).toBe(200);
    story.actions.push({ label, result: actionResult(await response.text()) });
    await writeFile(story.actionsPath, JSON.stringify(story.actions, null, 2));
    await route.abort("failed"); done();
  }, { times: 1 });
  await page.getByRole("region", { name: reviewName, exact: true }).getByRole("button", { name: "Confirm update for this character", exact: true }).click();
  await intercepted;
  await expect(page.getByRole("region", { name: "Builder save recovery", exact: true }).getByRole("button", { name: "Check save", exact: true })).toBeEnabled();
  expect(await pending(page, story)).toEqual(retained); return retained as unknown as Pending;
}
async function checkOriginal(page: Page, story: Story, label: string) {
  const pathname = new URL(page.url()).pathname;
  const [response] = await Promise.all([
    page.waitForResponse(item => item.request().method() === "POST" && new URL(item.url()).pathname === pathname),
    page.getByRole("region", { name: "Builder save recovery", exact: true }).getByRole("button", { name: "Check save", exact: true }).click(),
  ]);
  expect(response.status()).toBe(200); const result = actionResult(await response.text()); story.actions.push({ label, result });
  await writeFile(story.actionsPath, JSON.stringify(story.actions, null, 2));
  await expect(page.getByRole("combobox", { name: "Set level for Warlock", exact: true })).toBeEnabled();
  expect(await pending(page, story)).toBeNull(); return result;
}
async function review(page: Page) {
  const region = page.getByRole("region", { name: reviewName, exact: true });
  await region.getByRole("button", { name: "Review content update", exact: true }).click();
  await expect(region.getByRole("button", { name: "Confirm update for this character", exact: true })).toBeEnabled();
  await expect(region.getByText("Fiend · version 1", { exact: true })).toBeVisible();
  await expect(region.getByText("Fiend · version 2", { exact: true })).toBeVisible();
  await expect(region.getByText("This update learns no spells automatically. Expanded spells use your ordinary spells-known allowance.", { exact: true })).toBeVisible();
  for (const group of ["Retained", "Removed", "Added"]) await expect(region.getByRole("region", { name: group, exact: true })).toBeVisible();
  for (const name of ["Burning Hands", "Command", "Blindness/Deafness", "Scorching Ray"]) {
    await expect(region.getByRole("region", { name: "Removed", exact: true }).getByText(name, { exact: true })).toBeVisible();
    await expect(region.getByRole("region", { name: "Added", exact: true }).getByText(name, { exact: true })).toBeVisible();
  }
  return region;
}
function sameCharacter(left: Native, right: Native) {
  expect({ ...right, fiendDefinitionVersion: left.fiendDefinitionVersion, fiendSnapshots: left.fiendSnapshots }).toEqual(left);
}
function rejectedOriginal(result: Record<string, unknown>, original: Pending, observed: Native) {
  expect(result.status).toBe("rejected");
  expect(result.rejection).toEqual({ actor_id: original.account_id, character_id: original.intent.character_id,
    operation_id: original.intent.operation_id, command: original.intent.command, fields: original.intent.fields,
    reason: "stale_review", observed_action_revision: observed.actionRevision });
  expect(BigInt(observed.actionRevision)).toBeGreaterThan(BigInt(String(original.intent.fields.expected_action_revision)));
}
function preserved(before: Native, after: Native) {
  for (const key of ["level", "choices", "scores", "state", "originalOccurrenceId", "classRoots", "inventory", "startingAwards", "hpDraws", "controlFingerprint"] as const) expect(after[key], key).toEqual(before[key]);
  const oldRoot = before.subclassRoots.find(root => root.slug === "fiend")!, nextRoot = after.subclassRoots.find(root => root.slug === "fiend")!;
  expect(oldRoot.version).toBe(1); expect(nextRoot.version).toBe(2); expect(nextRoot.contentId).toBe(oldRoot.contentId); expect(nextRoot.id).not.toBe(oldRoot.id);
  expect(after.subclassRoots.filter(root => root.slug !== "fiend")).toEqual(before.subclassRoots.filter(root => root.slug !== "fiend"));
  expect(after.featureGrants.filter(grant => grant.controller_ref_id !== nextRoot.id)).toEqual(before.featureGrants.filter(grant => grant.controller_ref_id !== oldRoot.id));
  expect(after.spellGrants.filter(grant => grant.controller_ref_id !== nextRoot.id)).toEqual(before.spellGrants.filter(grant => grant.controller_ref_id !== oldRoot.id));
  expect(after.spells.filter(spell => spell.source === "selection" || spell.classSlug !== "warlock")).toEqual(before.spells.filter(spell => spell.source === "selection" || spell.classSlug !== "warlock"));
  expect(after.fiendFreeRows).toBe(0); expect(before.fiendFreeRows).toBe(4); expect(after.warlockKnown).toBe(4); expect(after.warlockCantrips).toBe(2);
  expect(after.fiendSnapshots).toEqual(before.fiendSnapshots);
}

async function foreignRefusal(page: Page, browser: Browser, story: Story, saved: Native) {
  await page.goto(classUrl(story, story.controlId));
  const panel = page.getByRole("region", { name: reviewName, exact: true });
  const pathname = new URL(page.url()).pathname;
  const [response] = await Promise.all([
    page.waitForResponse(item => item.request().method() === "POST" && new URL(item.url()).pathname === pathname),
    panel.getByRole("button", { name: "Review content update", exact: true }).click(),
  ]);
  expect(response.status()).toBe(200);
  const available = actionResult(await response.text()) as { status: string; preview: { actor_id: string; character_id: string; fields: Record<string, unknown> } };
  expect(available.status).toBe("available"); expect(available.preview.actor_id).toBe(story.config.owner.id);
  expect(available.preview.character_id).toBe(story.controlId);
  expect(available.preview.fields).toMatchObject({ expected_content_version: 1, target_content_version: 2,
    content_id: saved.subclassRoots.find(root => root.slug === "fiend")!.contentId });
  await expect(panel.getByRole("button", { name: "Confirm update for this character", exact: true })).toBeEnabled();
  await panel.getByRole("button", { name: "Keep saved version", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Confirm update for this character", exact: true })).toHaveCount(0);

  const configPath = process.env.INKBORNE_LOCAL_FLOW_CONFIG!;
  const environment = JSON.parse(await readFile(resolve(dirname(configPath), "server-env.json"), "utf8"));
  expect(environment.NEXT_PUBLIC_SUPABASE_URL).toBe(story.config.supabaseOrigin);
  const apikey: string = environment.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (typeof apikey !== "string") throw Error("Local anonymous API key required; value withheld");
  async function authenticate(account: Account) {
    const result = await fetch(story.config.supabaseOrigin + "/auth/v1/token?grant_type=password", {
      method: "POST", headers: { apikey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: account.email, password: account.password }), signal: AbortSignal.timeout(15000),
    });
    if (!result.ok) throw Error("Scoped local authentication failed; credentials and response withheld");
    const session = await result.json();
    if (typeof session.access_token !== "string") throw Error("Local JWT unavailable; response withheld");
    const claims = JSON.parse(Buffer.from(session.access_token.split(".")[1], "base64url").toString("utf8"));
    expect(claims.sub).toBe(account.id); expect(claims.role).toBe("authenticated");
    expect(claims.session_id).toMatch(/^[0-9a-f-]{36}$/); expect(Number.isInteger(claims.exp)).toBe(true);
    return { token: session.access_token as string, context: { context_version: 1, actor_id: account.id, session_id: claims.session_id as string,
      jwt_expires_at: new Date(claims.exp * 1000).toISOString().replace(".000Z", ".000000Z") } };
  }
  const owner = await authenticate(story.config.owner), other = await authenticate(story.config.other);
  async function rpc(token: string, name: string, input: Record<string, unknown>) {
    const result = await fetch(story.config.supabaseOrigin + "/rest/v1/rpc/" + name, { method: "POST",
      headers: { apikey, Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(input), signal: AbortSignal.timeout(15000) });
    return { http: result.status, body: await result.json() as Record<string, unknown> };
  }
  const previewInput = { p_character_id: story.controlId, p_subclass_ref_id: available.preview.fields.subclass_ref_id, p_target_content_version: 2 };
  const ownerPreview = await rpc(owner.token, "character_builder_subclass_update_preview_v1", { ...previewInput, p_context: owner.context });
  expect(ownerPreview.http).toBe(200); expect(ownerPreview.body).toEqual(available);
  const original = saved.updateReceipts[0].request;
  const recorded = await rpc(owner.token, "character_builder_subclass_update_resolution_v1", { p_context: owner.context, p_request: original });
  expect(recorded).toEqual({ http: 200, body: { status: "recorded", receipt: saved.updateReceipts[0].receipt } });
  const refusals: Array<{ rpc: string; context: string; http: number; code: unknown }> = [];
  for (const [contextLabel, nativeContext] of [["other account", other.context], ["owner context mismatch", owner.context]] as const) {
    for (const [name, input] of [
      ["character_builder_subclass_update_preview_v1", previewInput],
      ["character_builder_subclass_update_resolution_v1", { p_request: original }],
      ["character_builder_command_v1", { p_request: original }],
    ] as const) {
      const denied = await rpc(other.token, name, { ...input, p_context: nativeContext });
      if (denied.http === 200) throw Error("Foreign account access unexpectedly succeeded; stop verification");
      expect(denied.http).toBe(403); expect(denied.body.code).toBe("42501");
      refusals.push({ rpc: name, context: contextLabel, http: denied.http, code: denied.body.code });
    }
  }
  const foreign = await browser.newContext();
  try {
    const allowed = new Set([story.config.appOrigin, story.config.supabaseOrigin]);
    await foreign.route("**/*", route => {
      const origin = new URL(route.request().url()).origin;
      if (!allowed.has(origin)) { story.blockedOrigins.push(origin); return route.abort(); } return route.continue();
    });
    const foreignPage = await foreign.newPage(); foreignPage.on("pageerror", () => story.pageErrors.push("browser error in other account"));
    try {
      await foreignPage.goto(story.config.appOrigin + "/login");
      await foreignPage.getByLabel("Email", { exact: true }).fill(story.config.other.email);
      await foreignPage.getByLabel("Password", { exact: true }).fill(story.config.other.password);
      await foreignPage.getByRole("button", { name: /sign in/i }).click();
      await foreignPage.waitForURL(story.config.appOrigin + "/dashboard", { timeout: 60000 });
    } catch { await foreignPage.close(); throw Error("Actual other-account sign-in failed; credentials withheld"); }
    expect((await foreign.cookies()).some(cookie => cookie.name.startsWith("sb-"))).toBe(true);
    const inaccessible = await foreignPage.goto(`${story.config.appOrigin}/characters/${story.targetId}`);
    expect(inaccessible?.status()).toBe(404);
    await expect(foreignPage.getByText("This page could not be found.", { exact: true })).toBeVisible();
  } finally { await foreign.close(); }
  return { ownerControlPreview: available, ownerRecordedReceipt: recorded.body, foreignRouteStatus: 404, foreignRpcRefusals: refusals };
}

test("owner reviews historical Fiend content, recovers stale and applied responses, and preserves other saved sources", async ({ page, context, browser }, info) => {
  test.setTimeout(480000);
  const config = await settings();
  const story: Story = { config, targetId: "", controlId: "", blockedOrigins: [], pageErrors: [], snapshots: [], actions: [], actionsPath: info.outputPath("subclass-action-outcomes.json") };
  const allowed = new Set([config.appOrigin, config.supabaseOrigin]);
  await context.route("**/*", route => {
    const origin = new URL(route.request().url()).origin;
    if (!allowed.has(origin)) { story.blockedOrigins.push(origin); return route.abort(); } return route.continue();
  });
  const watch = (watched: Page) => { watched.on("pageerror", () => story.pageErrors.push("browser error")); watched.on("dialog", dialog => dialog.accept()); };
  watch(page);
  console.log(JSON.stringify({ workerPid: process.pid, parentPid: process.ppid, cwd: process.cwd(), startedUtc: new Date().toISOString(), story: "historical Fiend owner update" }));
  try {
    await page.goto(config.appOrigin + "/login"); await page.getByLabel("Email", { exact: true }).fill(config.owner.email);
    await page.getByLabel("Password", { exact: true }).fill(config.owner.password); await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(config.appOrigin + "/dashboard", { timeout: 60000 });
  } catch { await page.close(); throw Error("Actual local sign-in failed; credentials withheld"); }
  expect((await context.cookies()).some(cookie => cookie.name.startsWith("sb-"))).toBe(true);
  await prepareTarget(page, story);
  story.controlId = await createFiend(page, story, `Old Fiend control ${randomUUID().slice(0, 8)}`);
  await page.goto(classUrl(story));
  const historical = await readback(info, story, "old-v1-before-publication");
  expect(historical.profileCharacterCount).toBe(2);
  expect(historical.fiendDefinitionVersion).toBe(1); expect(historical.fiendSnapshots).toHaveLength(1); expect(historical.fiendSnapshots[0].extra).toBe(true);
  expect(historical.fiendFreeRows).toBe(4); expect(historical.inventory.length).toBeGreaterThan(0); expect(historical.startingAwards).toHaveLength(1);
  expect(historical.hpDraws).toHaveLength(1); expect(historical.hpDraws[0]).toMatchObject({ level: 3, die: 8 });
  await page.goto(`${config.appOrigin}/characters/${story.targetId}`);
  const hpDisplay = await page.getByRole("button", { name: "HP tracker — click to heal or damage", exact: true }).innerText();
  const configFile = process.env.INKBORNE_LOCAL_FLOW_CONFIG!;
  const helper = resolve(dirname(configFile), "../subclass-content-update-control.mjs");
  const startedUtc = new Date().toISOString();
  const publication = spawnSync(process.execPath, ["--import", "tsx", helper, "publish-corrected", story.targetId, story.controlId],
    { encoding: "utf8", windowsHide: true, timeout: 90000, maxBuffer: 1024 * 1024 });
  await writeFile(info.outputPath("publication-process.json"), JSON.stringify({ pid: publication.pid, parentPid: process.pid, cwd: process.cwd(), startedUtc, exitCode: publication.status }, null, 2));
  if (publication.status !== 0) throw Error("Corrected catalog publication failed; inspect the guarded local fixture receipt");
  const published = await readback(info, story, "v2-published-no-character-write"); sameCharacter(historical, published);
  expect(published.fiendDefinitionVersion).toBe(2); expect(published.fiendSnapshots).toHaveLength(2);
  expect(published.fiendSnapshots[0]).toEqual(historical.fiendSnapshots[0]); expect(published.fiendSnapshots[1]).toMatchObject({ version: 2, extra: false, expanded: true });
  await page.goto(classUrl(story));
  const panel = await review(page); await panel.getByRole("button", { name: "Keep saved version", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Confirm update for this character", exact: true })).toHaveCount(0);
  expect(await readback(info, story, "cancel-no-write")).toEqual(published);

  await review(page);
  const concurrent = await context.newPage(); watch(concurrent);
  await abilities(concurrent, story, story.targetId, { Strength: "10", Intelligence: "8" });
  const changed = await readback(info, story, "concurrent-ordinary-edit"); expect(BigInt(changed.actionRevision)).toBeGreaterThan(BigInt(published.actionRevision));
  const staleIntent = await dropConfirmation(page, story, "stale-rejection-response-lost");
  rejectedOriginal(story.actions.at(-1)!.result, staleIntent, changed);
  expect(await readback(info, story, "stale-refusal-no-write")).toEqual(changed);
  await page.reload(); expect(await pending(page, story)).toEqual(staleIntent);
  const terminal = await checkOriginal(page, story, "stale-rejection-recovered"); rejectedOriginal(terminal, staleIntent, changed);
  expect(terminal).toEqual(story.actions.find(action => action.label === "stale-rejection-response-lost")!.result);
  await expect(page.getByRole("region", { name: reviewName, exact: true }).getByRole("button", { name: "Review content update", exact: true })).toBeEnabled();
  expect(await readback(info, story, "terminal-proof-no-write")).toEqual(changed);

  await review(page); const original = await dropConfirmation(page, story, "applied-response-lost");
  expect(story.actions.at(-1)?.result.status).toBe("applied");
  const applied = await readback(info, story, "applied-response-lost"); preserved(changed, applied);
  expect(applied.receiptCount).toBe(changed.receiptCount + 1); expect(applied.updateHistoryCount).toBe(1);
  expect(BigInt(applied.actionRevision)).toBe(BigInt(changed.actionRevision) + BigInt(1));
  expect(applied.updateReceipts).toHaveLength(1); expect(applied.updateReceipts[0].operationId).toBe(original.intent.operation_id);
  expect(applied.updateReceipts[0].request).toEqual(original.intent);
  expect(story.actions.at(-1)!.result.receipt).toEqual(applied.updateReceipts[0].receipt);
  await abilities(concurrent, story, story.targetId, { Strength: "8", Intelligence: "10" }); await concurrent.close();
  const later = await readback(info, story, "later-edit-before-recovery");
  expect(BigInt(later.actionRevision)).toBeGreaterThan(BigInt(applied.actionRevision));
  expect(later.updateReceipts).toEqual(applied.updateReceipts);
  await page.reload(); expect(await pending(page, story)).toEqual(original);
  const recovered = await checkOriginal(page, story, "applied-receipt-first-after-later-edit");
  expect(recovered).toEqual({ status: "recorded", receipt: applied.updateReceipts[0].receipt });
  await expect(page.getByText(warning, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Review content update", exact: true })).toHaveCount(0);
  expect(await readback(info, story, "recovery-no-additional-write")).toEqual(later);
  await page.goto(`${config.appOrigin}/characters/${story.targetId}/builder/abilities`);
  await expect(page.getByRole("combobox", { name: "Strength score", exact: true })).toHaveValue("8");
  await expect(page.getByRole("combobox", { name: "Intelligence score", exact: true })).toHaveValue("10");
  await page.goto(classUrl(story));
  const spells = page.getByRole("form", { name: "Warlock spell choices", exact: true });
  await expect(spells.getByText("Spells known: 4 / 4", { exact: true })).toBeVisible();
  await selectSpell(spells, "Burning Hands"); await expect(spells.getByRole("button", { name: "Save spells", exact: true })).toBeDisabled();
  await selectSpell(spells, "Hellish Rebuke", false); await saveSpells(page, spells); await page.reload();
  const selected = await readback(info, story, "expanded-choice-spends-ordinary-place");
  expect(selected.warlockKnown).toBe(4); expect(selected.fiendFreeRows).toBe(0);
  expect(selected.spells.filter(spell => spell.classSlug === "warlock" && spell.source === "selection").map(spell => spell.slug)).toContain("burning-hands");
  for (const key of ["classRoots", "inventory", "startingAwards", "hpDraws", "controlFingerprint"] as const) expect(selected[key]).toEqual(applied[key]);
  await page.goto(`${config.appOrigin}/characters/${story.targetId}`);
  await expect(page.getByRole("button", { name: "HP tracker — click to heal or damage", exact: true })).toHaveText(hpDisplay, { useInnerText: true });
  await page.getByRole("button", { name: "Inventory", exact: true }).click(); await expect(page.getByText("Pouch", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "HP tracker — click to heal or damage", exact: true })).toHaveText(hpDisplay, { useInnerText: true });
  await page.getByRole("button", { name: "Inventory", exact: true }).click(); await expect(page.getByText("Pouch", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  const authorization = await foreignRefusal(page, browser, story, selected);
  expect(await readback(info, story, "repeat-sheet-reload-and-foreign-refusal-no-write")).toEqual(selected);
  expect(story.blockedOrigins).toEqual([]); expect(story.pageErrors).toEqual([]);
  const output = info.outputPath("subclass-content-update.json");
  await writeFile(output, JSON.stringify({ actualApp: true, actualAuthCookies: true, actualPostgrest: true, characterWritesThroughAppOnly: true,
    oldCatalogPublishedBeforeCapture: true, correctedCatalogThroughAtomicPublisher: true, historicalSnapshotsUnchanged: true,
    cancelNoWrite: true, staleOriginalTerminalProofReadOnly: true, sameCharacterFreshReview: true, lostAppliedResponseRecovered: true,
    appliedReceiptBeforeLaterStaleCheck: true, exactlyOneUpdateReceipt: true, ordinarySpellAllowancePreserved: true,
    targetId: story.targetId, controlId: story.controlId, staleOperationId: staleIntent.intent.operation_id, operationId: original.intent.operation_id,
    snapshots: story.snapshots, actions: story.actions, authorization, blockedOrigins: story.blockedOrigins, pageErrors: story.pageErrors }, null, 2));
  await info.attach("subclass-content-update", { path: output, contentType: "application/json" });
});
