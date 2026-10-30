import { test, expect, type Page } from "@playwright/test";
import type { CharacterChoices } from "../../lib/types/character";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { assertNativeIdentity, nativeJson, testRuntime } from "../../scripts/unraid/native";

type Account = { id: string; email: string; password: string };
type Role = "owner" | "dm" | "member" | "outsider";
type Config = { runId: string; appOrigin: string; supabaseOrigin: string;
  accounts: Record<Role, Account>; standaloneCharacterId: string; campaignCharacterId: string; campaignId: string };
const roles: Role[] = ["owner", "dm", "member", "outsider"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const permissionDenied = (result: { error: { code?: string } | null; status: number }, anonymous = false) =>
  result.error?.code === "42501" && (result.status === 403 || (anonymous && result.status === 401));

async function configuration(): Promise<Config> {
  // testRuntime verifies Linux and the existing private scratch-runtime contract;
  // nativeJson independently verifies the actual database system identity.
  const runtime = testRuntime();
  assertNativeIdentity();
  const config = JSON.parse(await readFile("/run/inkborne/journal-config.json", "utf8")) as Config;
  if (config.runId !== runtime.runId) throw Error("Journal fixtures must belong to this disposable run");
  for (const origin of [config.appOrigin, config.supabaseOrigin]) {
    const url = new URL(origin);
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.origin !== origin) throw Error("Explicit loopback origins required");
  }
  for (const account of roles.map(role => config.accounts?.[role])) {
    if (!account || !uuid.test(account.id) || !account.email || !account.password) throw Error("Four disposable journal identities required");
  }
  if (new Set(roles.map(role => config.accounts[role].id)).size !== 4) throw Error("Journal identities must be distinct");
  if (![config.standaloneCharacterId, config.campaignCharacterId, config.campaignId].every(id => uuid.test(id)) ||
      config.standaloneCharacterId === config.campaignCharacterId) throw Error("Distinct journal fixture IDs required");
  const flow = JSON.parse(await readFile("/output/csj-flow.json", "utf8")) as Record<string, unknown>;
  if (flow.kind !== "inkborne-csj-flow-v1" || flow.runId !== runtime.runId || flow.sourceHead !== runtime.sourceHead ||
      flow.normalUiCreation !== true || flow.basicSheetPassed !== true || flow.standaloneCharacterId !== config.standaloneCharacterId ||
      flow.campaignCharacterId !== config.campaignCharacterId) throw Error("Matching successful CSJ normal-creation/sheet receipt required");
  return config;
}

type Snapshot = { mechanics: { character: Record<string, unknown> }; story: unknown; journal: Array<{ id: string; title: string; visibility: string }> };
async function snapshot(characterId: string): Promise<Snapshot> {
  return await nativeJson(`BEGIN READ ONLY;
    SELECT jsonb_build_object('mechanics', jsonb_build_object(
      'character',(SELECT to_jsonb(c) FROM public.characters c WHERE c.id=:'character_id'::uuid),
      'refs',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]') FROM public.character_content_refs r WHERE r.character_id=:'character_id'::uuid),
      'inventory',(SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]') FROM public.character_inventory i WHERE i.character_id=:'character_id'::uuid),
      'spells',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]') FROM public.character_spells s WHERE s.character_id=:'character_id'::uuid),
      'rolls',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]') FROM public.character_rolls r WHERE r.character_id=:'character_id'::uuid)),
      'story',jsonb_build_object(
        'relationships',(SELECT coalesce(jsonb_agg(to_jsonb(n) ORDER BY n.id),'[]') FROM public.npcs n WHERE n.character_id=:'character_id'::uuid),
        'dmNotes',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.character_id),'[]') FROM public.character_dm_notes d WHERE d.character_id=:'character_id'::uuid)),
      'journal',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id),'[]') FROM public.character_timeline_events e WHERE e.character_id=:'character_id'::uuid));
    ROLLBACK;`, { character_id: characterId }) as Snapshot;
}

async function login(page: Page, config: Config, account: Account) {
  try {
    await page.goto(config.appOrigin + "/login");
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(config.appOrigin + "/dashboard");
  } catch {
    await page.close();
    throw Error("Disposable journal sign-in failed; credentials withheld");
  }
}

async function openJournal(page: Page, config: Config, characterId: string) {
  await page.goto(`${config.appOrigin}/characters/${characterId}`);
  await page.getByRole("tab", { name: "Narrative", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Journal & timeline", exact: true })).toBeVisible();
}

async function expectJournalAlert(page: Page, editorName: string, expectedText: string) {
  const editor = page.getByRole("group", { name: editorName, exact: true });
  await expect(editor).toHaveCount(1);
  // Next's route announcer is also an alert, outside the journal editor.
  const alert = editor.getByRole("alert");
  await expect(alert).toHaveCount(1);
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(expectedText);
  return editor;
}

async function loseNextAction(page: Page, config: Config, characterId: string, editorName: string, trigger: () => Promise<unknown>) {
  let dropped = false;
  const matcher = (url: URL) => url.origin === config.appOrigin && url.pathname === `/characters/${characterId}`;
  await page.route(matcher, async route => {
    if (!dropped && route.request().method() === "POST" && route.request().headers()["next-action"]) {
      await route.fetch(); dropped = true; await route.abort("failed");
    } else await route.continue();
  });
  try {
    await trigger();
    const editor = await expectJournalAlert(page, editorName, "Save status unknown");
    expect(dropped).toBe(true);
    await expect(editor.getByRole("button", { name: "Save entry", exact: true })).toBeDisabled();
  } finally { await page.unroute(matcher); }
}
async function closeDraft(page: Page) {
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
}

test("actual journal saves and reopens without a campaign; real roles enforce its audience", async ({ browser }, info) => {
  const config = await configuration(), runtime = testRuntime();
  // Use only the publishable key already supplied to the same scratch app.
  // Never import hosted E2E helpers or a service-role client.
  const server = JSON.parse(await readFile("/run/inkborne/server-env.json", "utf8")) as Record<string, string>;
  const publicKey = server.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!publicKey || server.NEXT_PUBLIC_SUPABASE_URL !== config.supabaseOrigin) throw Error("Scratch public API settings required");
  const clients = {} as Record<Role, SupabaseClient>;
  for (const role of roles) {
    const client = createClient(config.supabaseOrigin, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.signInWithPassword(config.accounts[role]);
    if (error || data.user?.id !== config.accounts[role].id) throw Error("Disposable journal JWT identity mismatch; details withheld");
    clients[role] = client;
  }
  const ownerId = config.accounts.owner.id;
  for (const [characterId, campaignId] of [[config.standaloneCharacterId, null], [config.campaignCharacterId, config.campaignId]]) {
    const { data, error } = await clients.owner.from("characters").select("user_id,campaign_id,visibility,level,choices").eq("id", characterId!).single();
    expect(Boolean(error), "Fixture owner character must be readable").toBe(false);
    expect(data?.user_id).toBe(ownerId); expect(data?.campaign_id).toBe(campaignId);
    if (campaignId) expect(data?.visibility).toBe("campaign");
    expect(data?.level).toBe(campaignId ? 3 : 4);
    const choices = data?.choices as CharacterChoices;
    expect(choices?.race).toBe(campaignId ? "human" : "half-elf");
    expect(choices?.background).toBe("acolyte");
    expect(choices?.classes).toHaveLength(1);
    expect(choices?.classes?.[0]).toMatchObject(campaignId ? { slug: "bard", level: 3, subclass: "lore" } : { slug: "fighter", level: 4 });
  }
  const { data: campaign } = await clients.dm.from("campaigns").select("owner_id").eq("id", config.campaignId).single();
  expect(campaign?.owner_id).toBe(config.accounts.dm.id);
  // Inspect fixture memberships natively rather than assuming role labels grant access.
  const members = await nativeJson(`BEGIN READ ONLY;
    SELECT coalesce(jsonb_agg(user_id ORDER BY user_id),'[]') FROM public.campaign_members
    WHERE campaign_id=(SELECT campaign_id FROM public.characters WHERE id=:'character_id'::uuid);
    ROLLBACK;`, { character_id: config.campaignCharacterId }) as string[];
  expect(members).toContain(ownerId); expect(members).toContain(config.accounts.member.id);
  expect(members).not.toContain(config.accounts.outsider.id);

  const ids = [config.standaloneCharacterId, config.campaignCharacterId];
  const before = new Map(await Promise.all(ids.map(async id => [id, await snapshot(id)] as const)));
  const created: Array<{ id: string; characterId: string; title: string; visibility: "dm_only" | "campaign" }> = [];
  for (const id of ids) expect(before.get(id)!.journal).toEqual([]);
  const cleanupMechanics = new Map(ids.map(id => [id, before.get(id)!.mechanics]));
  const deliberatelyRemoved = new Set<string>();
  const contexts = [], pageErrors: string[] = [], blockedOrigins: string[] = [];
  const allowed = new Set([config.appOrigin, config.supabaseOrigin]);
  let passed = false;
  try {
    const ownerContext = await browser.newContext(); contexts.push(ownerContext);
    await ownerContext.route("**/*", route => allowed.has(new URL(route.request().url()).origin) ? route.continue() : (blockedOrigins.push("unexpected origin"), route.abort()));
    const page = await ownerContext.newPage(); page.on("pageerror", () => pageErrors.push("browser error"));
    await login(page, config, config.accounts.owner);
    for (const [index, characterId, visibility] of [
      [0, config.standaloneCharacterId, "dm_only"], [1, config.campaignCharacterId, "dm_only"], [2, config.campaignCharacterId, "campaign"],
    ] as const) {
      await page.setViewportSize({ width: index === 0 ? 1280 : 390, height: 900 });
      const title = `Journal ${runtime.runId.slice(0, 8)} ${index} ${randomUUID().slice(0, 8)}`;
      await openJournal(page, config, characterId);
      await page.getByRole("button", { name: "Write entry", exact: true }).click();
      await page.getByLabel("Entry title", { exact: true }).fill(title);
      await page.getByLabel("When", { exact: true }).fill("After the river crossing");
      await page.locator('.tiptap[contenteditable="true"]').fill("We found the way home.");
      // The wrapping label also contains native option text; an exact label
      // lookup cannot match its short caption. Keep the control unique to this editor.
      const audience = page.getByRole("group", { name: "New journal entry", exact: true })
        .getByLabel(index === 0 ? /^Audience if assigned to a campaign/ : /^Audience/);
      await expect(audience).toHaveCount(1);
      await audience.selectOption(visibility);
      await expect(audience).toHaveValue(visibility);
      if (index === 0) {
        await loseNextAction(page, config, characterId, "New journal entry", () => page.getByRole("button", { name: "Save entry", exact: true }).click());
        await expect(page.getByLabel("Entry title", { exact: true })).toHaveValue(title);
        const downloadPromise = page.waitForEvent("download");
        await page.getByRole("button", { name: "Download draft", exact: true }).click();
        const draftPath = info.outputPath("create-unknown-draft.json");
        await (await downloadPromise).saveAs(draftPath);
        const draft = JSON.parse(await readFile(draftPath, "utf8")) as { characterId: string; entryId: string };
        expect(draft.characterId).toBe(characterId); expect(uuid.test(draft.entryId)).toBe(true);
        created.push({ id: draft.entryId, characterId, title, visibility });
        await page.getByRole("button", { name: "Check saved entry", exact: true }).click();
        await expect(page.getByRole("complementary", { name: "Saved entry readback" })).toContainText(title);
        await expect(page.getByRole("button", { name: "Save entry", exact: true })).toBeDisabled();
        const exact = await clients.owner.from("character_timeline_events").select("id").eq("id", draft.entryId).eq("character_id", characterId).eq("created_by", ownerId);
        expect(Boolean(exact.error)).toBe(false); expect(exact.data).toEqual([{ id: draft.entryId }]);
        expect((await snapshot(characterId)).journal).toHaveLength(1);
        await closeDraft(page);
      } else {
        await page.getByRole("button", { name: "Save entry", exact: true }).click();
        await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
        // Normal acknowledged creates use fixture-owned row-ID set difference,
        // not title/body matching. Recovery above is exact attempted-ID only.
        const rows = await clients.owner.from("character_timeline_events").select("id").eq("character_id", characterId).eq("created_by", ownerId);
        expect(Boolean(rows.error)).toBe(false);
        const newIds = rows.data?.filter(row => !created.some(entry => entry.id === row.id));
        expect(newIds).toHaveLength(1);
        created.push({ id: newIds![0].id, characterId, title, visibility });
      }
      await openJournal(page, config, characterId); // Fresh document request and database read.
      await page.getByRole("button", { name: `Edit ${title}`, exact: true }).click();
      await expect(page.locator('.tiptap[contenteditable="true"]')).toContainText("We found the way home.");
      await page.locator('.tiptap[contenteditable="true"]').fill("The crossing changed us.");
      await page.getByRole("button", { name: "Save entry", exact: true }).click();
      await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await openJournal(page, config, characterId);
        const article = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
        await expect(article).toContainText("The crossing changed us.");
        await expect(article).toContainText("After the river crossing");
        const row = await clients.owner.from("character_timeline_events").select("id,title,date_label,visibility,sort_order,description").eq("id", created[index].id).single();
        expect(Boolean(row.error)).toBe(false);
        expect(row.data).toMatchObject({ title, date_label: "After the river crossing", visibility, sort_order: index === 2 ? 1 : 0 });
        expect(JSON.stringify(row.data?.description)).toContain("The crossing changed us.");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    }

    // Let the real app/database commit an edit, then lose only the browser's
    // response. A generic HTTP 200 alone is not evidence of the resulting row.
    const standalone = created[0];
    await openJournal(page, config, standalone.characterId);
    await page.getByRole("button", { name: `Edit ${standalone.title}`, exact: true }).click();
    await page.locator('.tiptap[contenteditable="true"]').fill("This edit survived a lost response.");
    await loseNextAction(page, config, standalone.characterId, `Edit ${standalone.title}`, () => page.getByRole("button", { name: "Save entry", exact: true }).click());
    await expect(page.locator('.tiptap[contenteditable="true"]')).toContainText("This edit survived a lost response.");
    await page.getByRole("button", { name: "Check saved entry", exact: true }).click();
    await expect(page.getByRole("complementary", { name: "Saved entry readback" })).toContainText("This edit survived a lost response.");
    const committed = await clients.owner.from("character_timeline_events").select("description").eq("id", standalone.id).single();
    expect(Boolean(committed.error)).toBe(false);
    expect(JSON.stringify(committed.data?.description)).toContain("This edit survived a lost response.");
    await closeDraft(page);
    await openJournal(page, config, standalone.characterId);
    await expect(page.getByRole("article").filter({ has: page.getByRole("heading", { name: standalone.title, exact: true }) })).toContainText("This edit survived a lost response.");

    await openJournal(page, config, standalone.characterId);
    await page.getByRole("button", { name: `Edit ${standalone.title}`, exact: true }).click();
    await page.locator('.tiptap[contenteditable="true"]').fill("Stale draft must survive.");
    const concurrentContext = await browser.newContext(); contexts.push(concurrentContext);
    await concurrentContext.route("**/*", route => allowed.has(new URL(route.request().url()).origin) ? route.continue() : (blockedOrigins.push("unexpected origin"), route.abort()));
    const otherTab = await concurrentContext.newPage(); otherTab.on("pageerror", () => pageErrors.push("browser error"));
    await login(otherTab, config, config.accounts.owner);
    await openJournal(otherTab, config, standalone.characterId);
    await otherTab.getByRole("button", { name: `Edit ${standalone.title}`, exact: true }).click();
    await otherTab.locator('.tiptap[contenteditable="true"]').fill("Newer owner tab wins.");
    await otherTab.getByRole("button", { name: "Save entry", exact: true }).click();
    await expect(otherTab.getByRole("heading", { name: standalone.title, exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Save entry", exact: true }).click();
    await expectJournalAlert(page, `Edit ${standalone.title}`, "changed or was removed");
    await expect(page.locator('.tiptap[contenteditable="true"]')).toContainText("Stale draft must survive.");
    await expect(page.getByRole("button", { name: "Save entry", exact: true })).toBeDisabled();
    const newer = await clients.owner.from("character_timeline_events").select("description").eq("id", standalone.id).single();
    expect(Boolean(newer.error)).toBe(false); expect(JSON.stringify(newer.data?.description)).toContain("Newer owner tab wins.");
    await closeDraft(page);
    expect(created).toHaveLength(3); expect(new Set(created.map(entry => entry.id)).size).toBe(3);
    for (const id of ids) expect((await snapshot(id)).journal).toHaveLength(id === config.standaloneCharacterId ? 1 : 2);

    const afterWrites = new Map(await Promise.all(ids.map(async id => [id, await snapshot(id)] as const)));
    for (const id of ids) expect(hash(afterWrites.get(id)!.mechanics), "Journal writes must preserve the entire character and supporting mechanics").toBe(hash(before.get(id)!.mechanics));

    for (const role of roles) {
      for (const entry of created) {
        const readable = role === "owner" || (entry.characterId === config.campaignCharacterId && (role === "dm" || (role === "member" && entry.visibility === "campaign")));
        const { data, error } = await clients[role].from("character_timeline_events").select("id").eq("id", entry.id);
        expect(Boolean(error), "Authenticated role read must complete").toBe(false);
        expect(data?.length, `${role} audience read`).toBe(readable ? 1 : 0);
        if (role === "owner") continue;
        const update = await clients[role].from("character_timeline_events").update({ title: "Forbidden edit" }).eq("id", entry.id).select("id");
        expect(permissionDenied(update) || (!update.error && update.status === 200 && update.data?.length === 0), "Non-owner edit must reach authorization and be denied").toBe(true);
        const removal = await clients[role].from("character_timeline_events").delete().eq("id", entry.id).select("id");
        expect(permissionDenied(removal) || (!removal.error && removal.status === 200 && removal.data?.length === 0), "Non-owner delete must reach authorization and be denied").toBe(true);
        const insert = await clients[role].from("character_timeline_events").insert({ character_id: entry.characterId, created_by: config.accounts[role].id,
          title: "Forbidden insert", description: { type: "doc", content: [] }, visibility: entry.visibility, sort_order: 0 }).select("id");
        expect(permissionDenied(insert), "Non-owner create must return the expected permission rejection").toBe(true);
        for (const id of ids) expect(hash(await snapshot(id)), "Denied writes must leave every row unchanged").toBe(hash(afterWrites.get(id)));
      }
      if (role === "owner") continue;
      const context = await browser.newContext(); contexts.push(context);
      await context.route("**/*", route => allowed.has(new URL(route.request().url()).origin) ? route.continue() : (blockedOrigins.push("unexpected origin"), route.abort()));
      const viewer = await context.newPage(); viewer.on("pageerror", () => pageErrors.push("browser error"));
      await login(viewer, config, config.accounts[role]);
      await viewer.goto(`${config.appOrigin}/characters/${config.standaloneCharacterId}`);
      await expect(viewer.getByText("This page could not be found.", { exact: true })).toBeVisible();
      if (role === "outsider") {
        await viewer.goto(`${config.appOrigin}/characters/${config.campaignCharacterId}`);
        await expect(viewer.getByText("This page could not be found.", { exact: true })).toBeVisible();
      } else {
        for (const width of [1280, 390]) {
          await viewer.setViewportSize({ width, height: 900 });
          await openJournal(viewer, config, config.campaignCharacterId);
        for (const entry of created.filter(entry => entry.characterId === config.campaignCharacterId)) {
          await expect(viewer.getByRole("heading", { name: entry.title, exact: true })).toHaveCount(role === "dm" || entry.visibility === "campaign" ? 1 : 0);
        }
        await expect(viewer.getByRole("button", { name: "Write entry", exact: true })).toHaveCount(0);
        await expect(viewer.getByRole("button", { name: /^Edit Journal / })).toHaveCount(0);
        await expect(viewer.getByRole("button", { name: /^Delete Journal / })).toHaveCount(0);
        }
      }
    }
    const anonymous = createClient(config.supabaseOrigin, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    for (const entry of created) {
      const result = await anonymous.from("character_timeline_events").select("id").eq("id", entry.id);
      expect(permissionDenied(result, true) || (!result.error && result.status === 200 && result.data?.length === 0), "Anonymous reads must reach authorization and return no journal rows").toBe(true);
    }
    // Reverse isolation on the SAME two normal-created characters while all
    // three entries still exist, using a normal nonlethal sheet edit/reopen.
    // Mechanics are deliberately changed only here; Journal writes above must
    // already have matched the post-Flow baseline exactly.
    const narrativeOf = (value: Snapshot) => ({ journal: value.journal, story: value.story,
      narrative: value.mechanics.character.narrative, rich: value.mechanics.character.narrative_rich,
      choices: value.mechanics.character.choices });
    for (const [characterId, width] of [[config.standaloneCharacterId, 1280], [config.campaignCharacterId, 390]] as const) {
      const previous = await snapshot(characterId);
      const state = previous.mechanics.character.state as { current_hp?: number; temp_hp?: number };
      const hp = state.current_hp, tempHp = state.temp_hp ?? 0;
      expect(typeof hp).toBe("number"); expect(hp!).toBeGreaterThan(1);
      const nextHp = hp! - (tempHp > 0 ? 0 : 1), nextTemp = Math.max(0, tempHp - 1);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${config.appOrigin}/characters/${characterId}`);
      await page.getByRole("button", { name: "HP tracker — click to heal or damage", exact: true }).click();
      await page.getByPlaceholder("Amount", { exact: true }).fill("1");
      await page.getByRole("button", { name: "Damage", exact: true }).click();
      await expect.poll(async () => {
        const result = await clients.owner.from("characters").select("state").eq("id", characterId).single();
        if (result.error) throw Error("HP readback unavailable");
        return result.data?.state;
      }).toMatchObject({ current_hp: nextHp, temp_hp: nextTemp });
      await page.goto(`${config.appOrigin}/characters/${characterId}`);
      await page.getByRole("button", { name: "HP tracker — click to heal or damage", exact: true }).click();
      await expect(page.getByText(new RegExp(`^HP: ${nextHp} / `))).toBeVisible();
      await page.keyboard.press("Escape");
      const afterHp = await snapshot(characterId);
      expect(hash(narrativeOf(afterHp)), "Later sheet edits must preserve every narrative row/field and choices").toBe(hash(narrativeOf(previous)));
      cleanupMechanics.set(characterId, afterHp.mechanics);
      await openJournal(page, config, characterId);
      for (const entry of created.filter(entry => entry.characterId === characterId)) await expect(page.getByRole("heading", { name: entry.title, exact: true })).toBeVisible();
    }

    // Remove one of the same planned rows after its read/denial cases. A stale
    // editor must not recreate it or claim its zero-row UPDATE succeeded.
    const removed = created[1];
    await openJournal(page, config, removed.characterId);
    await page.getByRole("button", { name: `Edit ${removed.title}`, exact: true }).click();
    await page.locator('.tiptap[contenteditable="true"]').fill("Removed entry draft survives.");
    const removal = await clients.owner.from("character_timeline_events").delete().eq("id", removed.id).eq("character_id", removed.characterId).select("id");
    expect(Boolean(removal.error)).toBe(false); expect(removal.data).toEqual([{ id: removed.id }]);
    deliberatelyRemoved.add(removed.id);
    await page.getByRole("button", { name: "Save entry", exact: true }).click();
    await expectJournalAlert(page, `Edit ${removed.title}`, "changed or was removed");
    await expect(page.locator('.tiptap[contenteditable="true"]')).toContainText("Removed entry draft survives.");
    await page.getByRole("button", { name: "Check saved entry", exact: true }).click();
    await expectJournalAlert(page, `Edit ${removed.title}`, "no longer available");
    await expect(page.getByRole("button", { name: "Save entry", exact: true })).toBeDisabled();
    const absent = await clients.owner.from("character_timeline_events").select("id").eq("id", removed.id);
    expect(Boolean(absent.error)).toBe(false); expect(absent.data).toEqual([]);
    await closeDraft(page);
    for (const id of ids) expect(hash((await snapshot(id)).mechanics)).toBe(hash(cleanupMechanics.get(id)));

    expect(pageErrors).toEqual([]); expect(blockedOrigins).toEqual([]);
    passed = true;
    await writeFile(info.outputPath("journal-real.json"), JSON.stringify({ runId: runtime.runId, sourceHead: runtime.sourceHead,
      actualNextApp: true, actualAuth: true, actualPostgrest: true, actualDatabaseIdentity: true,
      entries: created, journalWritesPreserveMechanics: true, laterHpEditPreservesNarrative: true,
      mechanicBindings: ids.map(id => ({ id, before: hash(before.get(id)!.mechanics), afterJournal: hash(afterWrites.get(id)!.mechanics), afterIntentionalHpEdit: hash(cleanupMechanics.get(id)) })), audienceMatrixPassed: true, nonOwnerWritesDenied: true, lostResponseDraftRetained: true, createResponseLostReadbackPassed: true,
      staleOwnerTabPassed: true, removedEntryConflictPassed: true, noExtraJournalRow: true, flowReceipt: "/output/csj-flow.json",
      limitations: ["Mounted-editor recovery only; no browser-crash draft durability or project-wide/hosted acceptance implied"] }, null, 2));
  } finally {
    const contextResults = await Promise.allSettled(contexts.map(context => context.close()));
    const cleanup: boolean[] = [];
    for (const entry of created) {
      try {
        const result = await clients.owner.from("character_timeline_events").delete().eq("id", entry.id).eq("character_id", entry.characterId).eq("created_by", ownerId).select("id");
        cleanup.push(!result.error && result.data?.length === (deliberatelyRemoved.has(entry.id) ? 0 : 1));
      } catch { cleanup.push(false); }
    }
    // On a failed write/denial, the surrounding disposable runner must still
    // destroy the entire owned runtime; never broaden deletion to unknown IDs.
    const contextsClosed = contextResults.every(result => result.status === "fulfilled");
    await writeFile(info.outputPath("journal-cleanup.json"), JSON.stringify({ contextsClosed, recordedEntries: created.length, removed: cleanup, runtimeTeardownStillRequired: true }));
    if (passed) {
      expect(contextsClosed, "Browser contexts must close").toBe(true);
      expect(cleanup.every(Boolean), "Recorded journal entries must clean up").toBe(true);
      for (const id of ids) expect(hash(await snapshot(id)), "Cleanup must restore the fixture exactly").toBe(hash({ ...before.get(id)!, mechanics: cleanupMechanics.get(id) }));
    }
  }
});
