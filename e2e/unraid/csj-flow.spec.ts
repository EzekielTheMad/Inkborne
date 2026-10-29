import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { assertNativeIdentity, nativeJson, testRuntime } from "../../scripts/unraid/native";
import { basicSnapshot, basicHash, assertBasicTransition, openBasicClients, verifyBasicRollback,
  verifyBasicRefusals, verifyBasicConcurrency } from "../../scripts/unraid/native-basic-sheet";
import { choiceOption, choiceGroup, optionPicked, pickOption, hpOption, asiOption, setSpell, selectedSpell } from "../local-app/dropdown-helpers";

const account = z.object({ id: z.uuid(), email: z.string().min(1), password: z.string().min(1) });
const configurationSchema = z.object({ runId: z.uuid(), systemId: z.uuid(), campaignId: z.uuid(),
  appOrigin: z.literal("http://127.0.0.1:3001"), supabaseOrigin: z.literal("http://127.0.0.1:9999"),
  anonKey: z.string().min(1), serviceRoleKey: z.string().min(1),
  accounts: z.object({ owner: account, dm: account, member: account, outsider: account }) });
type Config = z.infer<typeof configurationSchema>;
type Story = { className: "Fighter" | "Bard"; race: "Half-Elf" | "Human"; level: number; maxHp: number; weapon: string;
  base: Record<string, string>; scores: Record<string, number>; skills: string[] };
const fighter: Story = { className: "Fighter", race: "Half-Elf", level: 4, maxHp: 36, weapon: "Longsword",
  base: { Strength: "15", Dexterity: "14", Constitution: "13", Intelligence: "12", Wisdom: "10", Charisma: "8" },
  scores: { Strength: 18, Dexterity: 14, Constitution: 14, Intelligence: 12, Wisdom: 10, Charisma: 10 }, skills: ["Athletics", "Perception"] };
const bard: Story = { className: "Bard", race: "Human", level: 3, maxHp: 24, weapon: "Rapier",
  base: { Strength: "8", Dexterity: "13", Constitution: "14", Intelligence: "12", Wisdom: "10", Charisma: "15" },
  scores: { Strength: 9, Dexterity: 14, Constitution: 15, Intelligence: 13, Wisdom: 11, Charisma: 16 }, skills: ["Arcana", "Perception", "Stealth"] };
const bardCantrips = ["Mage Hand", "Vicious Mockery"];
const bardSpells = ["Animal Friendship", "Charm Person", "Cure Wounds", "Detect Magic", "Healing Word", "Shatter"];
async function configuration(): Promise<Config> {
  const runtime = testRuntime(); assertNativeIdentity();
  const parsed = configurationSchema.safeParse(JSON.parse(await readFile("/run/inkborne/test-config.json", "utf8")));
  if (!parsed.success || parsed.data.runId !== runtime.runId) throw Error("Current restricted CSJ scratch configuration required; contents withheld");
  expect(new Set(Object.values(parsed.data.accounts).map(value => value.id)).size).toBe(4);
  return parsed.data;
}
async function fixtureBudget(config: Config, expectedIds: string[]) {
  const data = await nativeJson(`BEGIN READ ONLY; SELECT jsonb_build_object(
    'accounts',(SELECT jsonb_agg(id ORDER BY id) FROM auth.users),
    'characters',(SELECT COALESCE(jsonb_agg(id ORDER BY id),'[]') FROM public.characters),
    'campaigns',(SELECT jsonb_agg(jsonb_build_object('id',id,'owner',owner_id,'system',system_id) ORDER BY id) FROM public.campaigns),
    'members',(SELECT jsonb_agg(jsonb_build_object('user',user_id,'role',role) ORDER BY user_id) FROM public.campaign_members),
    'journal',(SELECT count(*) FROM public.character_timeline_events)); ROLLBACK;`) as Record<string, unknown>;
  expect(data.accounts).toEqual(Object.values(config.accounts).map(value => value.id).sort());
  expect(data.characters).toEqual([...expectedIds].sort()); expect(data.journal).toBe(0);
  expect(data.campaigns).toEqual([{ id: config.campaignId, owner: config.accounts.dm.id, system: config.systemId }]);
  expect(data.members).toEqual([{ user: config.accounts.dm.id, role: "dm" }, { user: config.accounts.owner.id, role: "player" },
    { user: config.accounts.member.id, role: "player" }].sort((a, b) => a.user.localeCompare(b.user)));
}
async function login(page: Page, config: Config) {
  try {
    await page.goto(config.appOrigin + "/login");
    await page.getByLabel("Email", { exact: true }).fill(config.accounts.owner.email);
    await page.getByLabel("Password", { exact: true }).fill(config.accounts.owner.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(config.appOrigin + "/dashboard");
  } catch { await page.close(); throw Error("Disposable CSJ owner sign-in failed; credentials withheld"); }
}
async function save(page: Page, change: () => Promise<unknown>) {
  const path = new URL(page.url()).pathname;
  const [response] = await Promise.all([page.waitForResponse(value => value.request().method() === "POST" && new URL(value.url()).pathname === path), change()]);
  expect(response.status(), "actual app save must acknowledge before next edit").toBe(200);
}
async function choose(page: Page, option: Locator) {
  if (!await optionPicked(option)) await save(page, () => pickOption(option));
  await expect(option).toHaveJSProperty("selected", true); await expect(option).toBeEnabled();
}
function group(page: Page, label: string, candidate?: string) {
  const article = page.getByRole("article").filter({ has: page.getByRole("heading", { name: label, exact: true, level: 4 }) });
  return candidate ? article.filter({ has: choiceOption(page, candidate) }) : article;
}
async function openLevel(page: Page, level: number) {
  await page.getByRole("button", { name: new RegExp(`^Level ${level}:`) }).click();
  await expect(page.locator('section[aria-labelledby="class-level-title"]').getByRole("navigation", { name: "Breadcrumb", exact: true })).toContainText(`Level ${level}`);
}
async function normalCreation(page: Page, config: Config, story: Story): Promise<string> {
  await page.goto(config.appOrigin + "/characters/new");
  const name = `CSJ ${story.className} ${config.runId.slice(0, 8)}`;
  await page.getByRole("textbox", { name: "What will they be called?" }).fill(name);
  // One actual creation intent. No repeat on uncertain results or prebuilt rows.
  await page.getByRole("button", { name: "Open the notebook", exact: true }).click();
  await page.waitForURL(/\/characters\/[0-9a-f-]+\/builder\/first-class$/);
  const id = z.uuid().parse(new URL(page.url()).pathname.split("/")[2]);
  const sheet = `${config.appOrigin}/characters/${id}`, base = sheet + "/builder";
  await page.getByRole("combobox", { name: "First class", exact: true }).selectOption({ label: story.className });
  await page.getByRole("button", { name: "Save first class", exact: true }).click();
  await expect(page.getByText(`${story.className} · Level 1`, { exact: true })).toBeVisible();
  await page.reload(); await page.getByRole("link", { name: "Complete class choices", exact: true }).click();
  await openLevel(page, 1);
  for (const skill of story.skills) await choose(page, choiceOption(group(page, `Choose ${story.skills.length} proficiency`, story.skills[0]), skill));
  if (story.className === "Fighter") await choose(page, choiceOption(page, /^Defense(?:\s|$)/));
  else for (const instrument of ["Drum", "Flute", "Lute"]) await choose(page, choiceOption(group(page, "Choose 3 proficiency", "Lute"), instrument));
  await page.goto(base + "/race");
  await page.getByRole("combobox", { name: "Choose Race", exact: true }).selectOption({ label: story.race });
  await save(page, () => page.getByRole("button", { name: "Add Race", exact: true }).click());
  await expect(page.getByRole("button", { name: "Change Race", exact: true })).toBeVisible();
  if (story.race === "Half-Elf") {
    for (const ability of ["Strength", "Constitution"]) await choose(page, choiceOption(choiceGroup(page, "Choose 2 ability bonus"), ability));
    for (const skill of ["Arcana", "Stealth"]) await choose(page, choiceOption(choiceGroup(page, "Skill Versatility: Choose 2"), skill));
  }
  await choose(page, choiceOption(choiceGroup(page, "Choose 1 language"), "Dwarvish"));
  await page.reload(); await expect(choiceOption(page, "Dwarvish").first()).toHaveJSProperty("selected", true);
  await page.getByRole("button", { name: "Next: Abilities", exact: true }).click();
  for (const [ability, score] of Object.entries(story.base)) {
    const control = page.getByRole("combobox", { name: `${ability} score`, exact: true });
    if (await control.inputValue() === score) continue;
    for (const other of Object.keys(story.base)) if (other !== ability) {
      const occupied = page.getByRole("combobox", { name: `${other} score`, exact: true });
      if (await occupied.inputValue() === score) {
        await save(page, () => occupied.selectOption(""));
        await expect(page.getByText("Changes save automatically.", { exact: true })).toBeVisible();
      }
    }
    await save(page, () => control.selectOption(score));
    await expect(page.getByText("Changes save automatically.", { exact: true })).toBeVisible();
  }
  await page.reload();
  for (const [ability, score] of Object.entries(story.base)) await expect(page.getByRole("combobox", { name: `${ability} score`, exact: true })).toHaveValue(score);
  await page.getByRole("button", { name: "Next: Background", exact: true }).click();
  await page.getByRole("combobox", { name: "Choose Background", exact: true }).selectOption({ label: "Acolyte" });
  await save(page, () => page.getByRole("button", { name: "Add Background", exact: true }).click());
  await expect(page.getByRole("button", { name: "Change Background", exact: true })).toBeVisible();
  // Half-Elf already knows Elvish; every selected language must be valid/free.
  for (const language of ["Celestial", story.race === "Half-Elf" ? "Gnomish" : "Elvish"])
    await choose(page, choiceOption(choiceGroup(page, "Choose 2 language"), language));
  await choose(page, choiceOption(page, "Nothing can shake my optimistic attitude."));
  await page.reload();
  await page.goto(base + "/class");
  const level = page.getByRole("combobox", { name: `Set level for ${story.className}`, exact: true });
  await save(page, () => level.selectOption(String(story.level))); await expect(level).toBeEnabled();
  await openLevel(page, 3);
  await choose(page, choiceOption(page, story.className === "Fighter" ? /^Champion(?:\s|$)/ : /^Lore(?:\s|$)/));
  if (story.className === "Bard") {
    for (const skill of ["Perception", "Stealth"]) await choose(page, choiceOption(group(page, "Choose 2 expertise"), skill));
    for (const skill of ["Athletics", "Medicine", "Nature"]) await choose(page, choiceOption(group(page, "Choose 3 proficiency", "Athletics"), skill));
  }
  for (let value = 2; value <= story.level; value++) {
    await openLevel(page, value); await choose(page, hpOption(page, "average"));
    if (value === 4) await choose(page, asiOption(page, "strength"));
  }
  if (story.className === "Bard") {
    const form = page.getByRole("form", { name: "Bard spell choices", exact: true });
    for (const spell of [...bardCantrips, ...bardSpells]) await setSpell(form, spell);
    await expect(form.getByText("Spells known: 6 / 6", { exact: true })).toBeVisible();
    await save(page, () => form.getByRole("button", { name: "Save spells", exact: true }).click());
    await expect(form.getByText("Spell choices saved.", { exact: true })).toBeVisible();
    await page.reload(); for (const spell of [...bardCantrips, ...bardSpells]) await expect(selectedSpell(form, spell)).toHaveCount(1);
  }
  await page.goto(base + "/equipment");
  const groups = page.locator("select").filter({ has: page.locator('option[value="a"]') });
  await expect(groups.first()).toBeVisible();
  for (let index = 0; index < await groups.count(); index++) await choose(page, groups.nth(index).locator('option[value="a"]'));
  const slots = page.locator('button[data-slot="select-trigger"]');
  for (let index = 0; index < await slots.count(); index++) {
    const slot = slots.nth(index); await slot.click(); const menu = page.getByRole("listbox"); await expect(menu).toBeVisible();
    const longsword = menu.getByRole("option", { name: "Longsword", exact: true });
    const option = await longsword.count() ? longsword : menu.getByRole("option").first();
    await save(page, () => pickOption(option));
    await expect(slot).toBeEnabled();
  }
  await page.getByRole("button", { name: "Confirm Equipment", exact: true }).click();
  await expect(page.getByText("Starting equipment award recorded", { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText("Starting equipment award recorded", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm Equipment", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Next: Character Details", exact: true }).click();
  await page.getByRole("textbox", { name: "Character name", exact: true }).fill(name);
  await page.getByRole("combobox", { name: "Alignment", exact: true }).selectOption("Neutral Good");
  await save(page, () => page.getByRole("button", { name: "Save details", exact: true }).click());
  await expect(page.getByText("Character details saved.", { exact: true })).toBeVisible(); await page.reload();
  const nav = page.getByRole("navigation", { name: "Character builder", exact: true });
  for (const path of ["class", "race", "abilities", "background", "equipment", "details"]) await expect(nav.locator(`a[href$="/builder/${path}"]`)).toContainText("Saved");
  await page.getByRole("button", { name: "Review & Finish", exact: true }).click();
  await page.getByRole("button", { name: "Finish & View Character", exact: true }).click();
  await expect(page).toHaveURL(sheet); await inspectSheet(page, config, id, story);
  return id;
}
async function inspectSheet(page: Page, config: Config, id: string, story: Story) {
  await page.goto(`${config.appOrigin}/characters/${id}`);
  const mobile = (page.viewportSize()?.width ?? 1280) < 768;
  const stats = mobile ? page.locator("section").filter({ has: page.getByRole("heading", { name: "Ability Scores", exact: true }) }) : page;
  const mobileSections = mobile ? (stats as Locator).locator("..").locator(":scope > section") : null;
  // Mobile has five separate content panels in its scroll strip; scope the
  // hydration guard and spell controls to their actual panel, not offscreen duplicates.
  await expect((mobileSections ? mobileSections.nth(2) : page).getByRole("button", { name: "Inventory", exact: true })).toBeEnabled();
  for (const [ability, score] of Object.entries(story.scores))
    await expect(stats.getByRole("button", { name: `Roll ${ability} check`, exact: true }).locator("p").last()).toHaveText(String(score));
  await expect(stats.getByRole("button", { name: "HP tracker — click to heal or damage", exact: true })).toContainText(`/${story.maxHp}`);
  if (story.className === "Bard") {
    await expect(stats.getByRole("button", { name: "Use one Bardic Inspiration (d6)", exact: true }).first().locator("..")).toContainText("3/3");
    const spells = mobileSections ? mobileSections.nth(3) : page;
    const nav = mobile ? (stats as Locator).locator("..").locator("..").locator(":scope > nav") : page;
    await nav.getByRole("button", { name: "Spells", exact: true }).click();
    if (mobileSections) await expect(mobileSections.nth(3)).toBeInViewport();
    await expect(spells.getByText(/^Save DC\s*13$/).filter({ visible: true })).toBeVisible();
    await expect(spells.getByText(/^Attack\s*\+5$/).filter({ visible: true })).toBeVisible();
    await expect(spells.getByRole("button", { name: "Mark 1st slot used", exact: true }).filter({ visible: true })).toHaveCount(4);
    await expect(spells.getByRole("button", { name: "Mark 2nd slot used", exact: true }).filter({ visible: true })).toHaveCount(2);
  }
  const native = await basicSnapshot(id, config.accounts.owner.id);
  expect(native.maximum).toBe(story.maxHp); expect(native.parent.level).toBe(story.level);
  expect(native.parent.choices).toMatchObject({ race: story.race === "Human" ? "human" : "half-elf", background: "acolyte",
    classes: [{ slug: story.className.toLowerCase(), level: story.level, subclass: story.className === "Bard" ? "lore" : "champion" }] });
  const family = await nativeJson(await readFile("supabase/verification/builder-class-choices-readback.sql", "utf8"), { character_id: id }) as Record<string, unknown>;
  for (const key of ["all_pinned_versions_exact", "feature_grants_exact", "physical_feature_grant_links_exact", "active_feature_projections_exact",
    "spell_grants_exact", "active_spell_grants_projected", "all_choice_checks", "all_child_checks", "all_favored_checks", "all_five_order_bijections", "all_boundaries_closed"])
    expect(family[key], key).toBe(true);
}

async function equipAndRoll(page: Page, config: Config, id: string, story: Story) {
  const before = await basicSnapshot(id, config.accounts.owner.id);
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  const row = page.locator("div.group").filter({ has: page.getByText(story.weapon, { exact: true }) }).filter({ has: page.getByTitle("Equip", { exact: true }) });
  await expect(row).toHaveCount(1);
  const [equipped] = await Promise.all([page.waitForResponse(value => value.request().method() === "PATCH" && new URL(value.url()).pathname === "/rest/v1/character_inventory"),
    row.getByTitle("Equip", { exact: true }).click()]);
  expect(equipped.status()).toBe(204);
  const afterEquip = await basicSnapshot(id, config.accounts.owner.id), inventory = before.children.inventory as Array<Record<string, unknown>>;
  const selected = inventory.filter(value => value.name === story.weapon); expect(selected).toHaveLength(1); expect(selected[0].equipped).toBe(false);
  expect(z.uuid().safeParse(selected[0].starting_grant_id).success).toBe(true);
  expect(basicHash(afterEquip)).toBe(basicHash({ ...before, children: { ...before.children,
    inventory: inventory.map(value => value.id === selected[0].id ? { ...value, equipped: true } : value) } }));
  // Reopen confirmed inputs before using the equipped weapon.
  await page.goto(`${config.appOrigin}/characters/${id}`);
  for (const [button, kind] of [["Roll Strength check", "check"], [`Roll ${story.weapon} attack`, "attack"]] as const) {
    if (kind === "attack") await page.getByRole("button", { name: "Actions", exact: true }).click();
    await page.getByRole("button", { name: button, exact: true }).click();
    const [response] = await Promise.all([page.waitForResponse(value => value.request().method() === "POST" && new URL(value.url()).pathname === "/rest/v1/character_rolls"),
      page.getByRole("button", { name: "Roll", exact: true }).click()]);
    expect(response.status()).toBe(201);
  }
  const after = await basicSnapshot(id, config.accounts.owner.id), rolls = after.children.rolls as Array<Record<string, unknown>>;
  expect(rolls).toHaveLength(2); expect(rolls.map(value => value.kind).sort()).toEqual(["attack", "check"]);
  for (const row of rolls) {
    expect(row.character_id).toBe(id); expect(row.user_id).toBe(config.accounts.owner.id);
    const result = row.result as { total: number; modifier: number; groups: Array<{ sides: number; kept: number[] }>; request: { kind: string; label: string; expression: string } };
    expect(result.request.kind).toBe(row.kind); expect(result.request.label).toBe(row.label); expect(result.total).toBe(row.total);
    expect(result.request.expression).toBe(row.expression); expect(result.groups).toHaveLength(1);
    expect(result.groups[0].sides).toBe(20); expect(result.groups[0].kept).toHaveLength(1);
    expect(Number.isInteger(result.groups[0].kept[0])).toBe(true); expect(result.groups[0].kept[0]).toBeGreaterThanOrEqual(1); expect(result.groups[0].kept[0]).toBeLessThanOrEqual(20);
    expect(result.groups.reduce((sum, group) => sum + group.kept.reduce((subtotal, face) => subtotal + face, 0), result.modifier)).toBe(row.total);
  }
  expect(basicHash(after)).toBe(basicHash({ ...afterEquip, children: { ...afterEquip.children, rolls } }));
  await inspectRollLog(page, config, id, story);
  return { equippedItemId: selected[0].id, rolls: rolls.map(row => ({ id: row.id, kind: row.kind, label: row.label, total: row.total })), retainedUnrelatedNativeFields: true };
}
async function inspectRollLog(page: Page, config: Config, id: string, story: Story) {
  await page.goto(`${config.appOrigin}/characters/${id}`);
  await page.getByRole("button", { name: "Open roll log", exact: true }).click();
  const history = page.getByRole("list", { name: "Roll history", exact: true });
  await expect(history).toContainText("Strength"); await expect(history).toContainText(story.weapon);
  await page.keyboard.press("Escape");
}
async function hpEdit(page: Page, config: Config, id: string, button: "Damage" | "Heal" | "Set Temp HP", amount: number, state: Record<string, unknown>, reopen = true) {
  const before = await basicSnapshot(id, config.accounts.owner.id);
  await page.getByRole("button", { name: "HP tracker — click to heal or damage", exact: true }).click();
  await page.getByPlaceholder("Amount", { exact: true }).fill(String(amount));
  await page.getByRole("button", { name: button, exact: true }).click();
  await expect.poll(async () => basicHash((await basicSnapshot(id, config.accounts.owner.id)).parent.state)).toBe(basicHash(state));
  await expect(page.getByPlaceholder("Amount", { exact: true })).toHaveCount(0);
  if (reopen) await page.goto(`${config.appOrigin}/characters/${id}`);
  const after = await basicSnapshot(id, config.accounts.owner.id); assertBasicTransition(before, after, { state });
  return { action: button, amount, before: basicHash(before), after: basicHash(after), exactFieldChildRevisionOrder: true };
}

test("CSJ-v1 normal creation and basic sheet use supplies the same two IDs to Journal", async ({ browser }) => {
  const config = await configuration(), runtime = testRuntime();
  await fixtureBudget(config, []);
  const clients = await openBasicClients(config), context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const blocked: string[] = [], errors: string[] = [], ids: string[] = [], proofs: unknown[] = [];
  const allowed = new Set<string>([config.appOrigin, config.supabaseOrigin]);
  await context.route("**/*", route => allowed.has(new URL(route.request().url()).origin) ? route.continue() : (blocked.push("unexpected origin"), route.abort()));
  const page = await context.newPage(); page.on("pageerror", () => errors.push("unexpected browser error"));
  let closed = false;
  try {
    await login(page, config);
    for (const story of [fighter, bard]) {
      const id = await normalCreation(page, config, story); ids.push(id);
      proofs.push({ characterId: id, story: story.className, normalUiCreated: true, normalSixStepsFinished: true });
      const baseline = await basicSnapshot(id, config.accounts.owner.id);
      proofs.push(await verifyBasicRollback(clients, baseline, "hp", config.campaignId));
      if (story.className === "Bard") {
        proofs.push(await verifyBasicRollback(clients, baseline, "campaign", config.campaignId));
        await page.goto(`${config.appOrigin}/campaigns/${config.campaignId}`);
        await page.getByRole("combobox", { name: "Character to add", exact: true }).selectOption(id);
        await page.getByRole("button", { name: "Add character", exact: true }).click();
        await expect.poll(async () => (await basicSnapshot(id, config.accounts.owner.id)).parent.campaign_id).toBe(config.campaignId);
        const assigned = await basicSnapshot(id, config.accounts.owner.id); assertBasicTransition(baseline, assigned, { campaign_id: config.campaignId });
        // Approved fixture-only visibility setup. No character visibility UI
        // exists; genuine owner auth changes only this exact field/character.
        const owner = await clients.owner.client.auth.getUser(); expect(owner.data.user?.id).toBe(config.accounts.owner.id);
        const result = await clients.owner.client.from("characters").update({ visibility: "campaign" }).eq("id", id)
          .eq("user_id", config.accounts.owner.id).eq("campaign_id", config.campaignId).select("id,visibility").single();
        expect(Boolean(result.error)).toBe(false); expect(result.data).toEqual({ id, visibility: "campaign" });
        const visible = await basicSnapshot(id, config.accounts.owner.id);
        expect(basicHash(visible)).toBe(basicHash({ ...assigned, parent: { ...assigned.parent, visibility: "campaign" } }));
        proofs.push({ fixtureOnly: "owner-authenticated visibility setup", onlyField: "visibility", characterId: id,
          before: basicHash(assigned), after: basicHash(visible), assignmentViaExistingUi: true });
        await inspectSheet(page, config, id, story);
      }
      proofs.push(await equipAndRoll(page, config, id, story));
      let current = await basicSnapshot(id, config.accounts.owner.id);
      proofs.push(await hpEdit(page, config, id, "Damage", 6, { ...current.parent.state, current_hp: story.maxHp - 6, temp_hp: 0 }));
      current = await basicSnapshot(id, config.accounts.owner.id);
      proofs.push(await hpEdit(page, config, id, "Heal", 4, { ...current.parent.state, current_hp: story.maxHp - 2 }));
      current = await basicSnapshot(id, config.accounts.owner.id);
      proofs.push(await hpEdit(page, config, id, "Set Temp HP", 5, { ...current.parent.state, temp_hp: 5 }));
      current = await basicSnapshot(id, config.accounts.owner.id);
      proofs.push(await hpEdit(page, config, id, "Damage", 3, { ...current.parent.state, temp_hp: 2, current_hp: story.maxHp - 2 }));
      current = await basicSnapshot(id, config.accounts.owner.id);
      proofs.push({ characterId: id, refusals: await verifyBasicRefusals(clients, current, config.campaignId) });
    }
    expect(ids).toHaveLength(2); expect(new Set(ids).size).toBe(2);
    // Real committed response loss; the mounted writer must refuse a repeat.
    await page.goto(`${config.appOrigin}/characters/${ids[0]}`);
    const beforeLoss = await basicSnapshot(ids[0], config.accounts.owner.id);
    let dropped = false, submissions = 0;
    const matcher = (url: URL) => url.origin === config.appOrigin && url.pathname === `/characters/${ids[0]}`;
    await page.route(matcher, async route => {
      if (route.request().method() === "POST" && route.request().headers()["next-action"]) {
        submissions++;
        if (!dropped) { await route.fetch(); dropped = true; await route.abort("failed"); return; }
      }
      await route.continue();
    });
    try {
      await page.getByRole("button", { name: "HP tracker — click to heal or damage", exact: true }).click();
      await page.getByPlaceholder("Amount", { exact: true }).fill("1");
      await page.getByRole("button", { name: "Damage", exact: true }).click();
      await expect(page.getByRole("alert").filter({ hasText: /could not be confirmed/ }).first()).toBeVisible();
      expect(dropped).toBe(true); expect(submissions).toBe(1);
      const afterLoss = await basicSnapshot(ids[0], config.accounts.owner.id);
      assertBasicTransition(beforeLoss, afterLoss, { state: { ...beforeLoss.parent.state, temp_hp: 1 } });
      await page.getByRole("button", { name: "Damage", exact: true }).click();
      await expect(page.getByText("Saving HP change.", { exact: true })).toHaveCount(0);
      expect(submissions).toBe(1); expect(basicHash(await basicSnapshot(ids[0], config.accounts.owner.id))).toBe(basicHash(afterLoss));
      proofs.push({ committedHpResponseLost: true, automaticReplay: false, explicitReloadRequired: true,
        before: basicHash(beforeLoss), after: basicHash(afterLoss) });
    } finally { await page.unroute(matcher); }
    await page.goto(`${config.appOrigin}/characters/${ids[0]}`);
    proofs.push(await verifyBasicConcurrency(clients, await basicSnapshot(ids[0], config.accounts.owner.id)));
    // Real editor + real native HP refresh, with no fourth Journal entry.
    await page.goto(`${config.appOrigin}/characters/${ids[0]}`);
    await page.getByRole("tab", { name: "Narrative", exact: true }).click();
    await page.getByRole("button", { name: "Write entry", exact: true }).click();
    const draft = page.getByRole("group", { name: "New journal entry", exact: true });
    await draft.getByLabel("Entry title", { exact: true }).fill("Unsaved CSJ draft survives HP refresh");
    await draft.locator('.tiptap[contenteditable="true"]').fill("The same draft stays in this editor.");
    await page.getByRole("tab", { name: "Character Sheet", exact: true }).click();
    const draftBeforeHp = await basicSnapshot(ids[0], config.accounts.owner.id);
    proofs.push(await hpEdit(page, config, ids[0], "Damage", 1,
      { ...draftBeforeHp.parent.state, temp_hp: Number(draftBeforeHp.parent.state.temp_hp) - 1 }, false));
    await expect(page.getByRole("button", { name: "Reload character", exact: true })).toHaveCount(0);
    await page.getByRole("tab", { name: "Narrative", exact: true }).click();
    await expect(draft.getByLabel("Entry title", { exact: true })).toHaveValue("Unsaved CSJ draft survives HP refresh");
    await expect(draft.locator('.tiptap[contenteditable="true"]')).toHaveText("The same draft stays in this editor.");
    page.once("dialog", dialog => dialog.accept());
    await draft.getByRole("button", { name: "Cancel", exact: true }).click();
    proofs.push({ actualBrowserDraftSurvivesTabsAndNativeHpRefresh: true, draftNeverSubmitted: true, extraJournalRows: 0 });
    // Same IDs on both viewports. No second fixture set, roll or journal row.
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [index, story] of [fighter, bard].entries()) {
        const beforeRead = await basicSnapshot(ids[index], config.accounts.owner.id);
        await inspectSheet(page, config, ids[index], story); await inspectRollLog(page, config, ids[index], story);
        expect(basicHash(await basicSnapshot(ids[index], config.accounts.owner.id))).toBe(basicHash(beforeRead));
      }
    }
    expect(blocked).toEqual([]); expect(errors).toEqual([]);
  } finally {
    try { await context.close(); closed = true; }
    finally { await writeFile("/output/csj-flow-cleanup.json", JSON.stringify({ browserContextClosed: closed, complete: false, runtimeTeardownStillRequired: true })); }
  }
  await fixtureBudget(config, ids);
  const profile = await nativeJson(await readFile("supabase/verification/character-basic-sheet-profile.sql", "utf8")) as { checks: Record<string, boolean> };
  for (const [name, value] of Object.entries(profile.checks)) expect(value, name).toBe(true);
  await writeFile("/run/inkborne/journal-config.json", JSON.stringify({ runId: runtime.runId, appOrigin: config.appOrigin, supabaseOrigin: config.supabaseOrigin,
    accounts: config.accounts, standaloneCharacterId: ids[0], campaignCharacterId: ids[1], campaignId: config.campaignId }), { mode: 0o600, flag: "wx" });
  await writeFile("/output/csj-flow-evidence.json", JSON.stringify({ runId: runtime.runId, sourceHead: runtime.sourceHead,
    workerPid: process.pid, parentPid: process.ppid, cwd: process.cwd(), proofs, profile, sameIdsAcrossDesktopMobile: true }, null, 2));
  await writeFile("/output/csj-flow-cleanup.json", JSON.stringify({ runId: runtime.runId, sourceHead: runtime.sourceHead,
    browserContextClosed: closed, complete: true, fixtureBudgetConfirmed: true, runtimeTeardownStillRequired: true }));
  await writeFile("/output/csj-flow.json", JSON.stringify({ kind: "inkborne-csj-flow-v1", runId: runtime.runId, sourceHead: runtime.sourceHead,
    normalUiCreation: true, basicSheetPassed: true, standaloneCharacterId: ids[0], campaignCharacterId: ids[1] }), { flag: "wx" });
});
