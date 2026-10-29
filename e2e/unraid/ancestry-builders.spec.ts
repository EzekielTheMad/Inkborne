import { choiceOption, choiceGroup, optionPicked, pickOption, hpOption } from "../local-app/dropdown-helpers";
import { test, expect, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { observeParent } from "../../scripts/unraid/parent-positive";
import { nativeJson, testRuntime } from "../../scripts/unraid/native";
type Account = { id: string; email: string; password: string };
type Settings = { appOrigin: string; supabaseOrigin: string; owner: Account; other: Account };
type Story = { config: Settings; blockedOrigins: string[]; pageErrors: string[] };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const scores = { Strength: "15", Dexterity: "13", Constitution: "14", Intelligence: "8", Wisdom: "12", Charisma: "10" };
const effective = { strength: 15, dexterity: 13, constitution: 16, intelligence: 8, wisdom: 13, charisma: 10 };
async function configuration(): Promise<Settings> {
  const file = process.env.INKBORNE_TEST_CONFIG;
  if (!file) throw Error("Provide the isolated local browser configuration file");
  const config = JSON.parse(await readFile(file, "utf8")) as Settings;
  for (const origin of [config.appOrigin, config.supabaseOrigin]) {
    const url = new URL(origin);
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.origin !== origin) throw Error("Explicit loopback origins required");
  }
  for (const account of [config.owner, config.other]) if (!account?.email || !account.password || !uuid.test(account.id)) throw Error("Disposable accounts required");
  if (config.owner.id === config.other.id) throw Error("Distinct disposable accounts required");
  return config;
}
async function restrictOrigins(context: BrowserContext, story: Story) {
  const allowed = new Set([story.config.appOrigin, story.config.supabaseOrigin]);
  await context.route("**/*", route => {
    const origin = new URL(route.request().url()).origin;
    if (!allowed.has(origin)) { story.blockedOrigins.push(origin); return route.abort(); }
    return route.continue();
  });
}
async function login(page: Page, config: Settings, account: Account) {
  try {
    await page.goto(config.appOrigin + "/login");
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(config.appOrigin + "/dashboard", { timeout: 60000 });
  } catch { await page.close(); throw Error("Actual local sign-in failed; credentials withheld"); }
}
async function save(page: Page, change: () => Promise<unknown>) {
  const pathname = new URL(page.url()).pathname;
  const [response] = await Promise.all([page.waitForResponse(item => item.request().method() === "POST" && new URL(item.url()).pathname === pathname), change()]);
  expect(response.status()).toBe(200);
}
async function choose(page: Page, option: Locator) {
  if (!await optionPicked(option)) await save(page, () => pickOption(option));
  await expect(option).toHaveJSProperty("selected", true); await expect(option).toBeEnabled();
}
function group(page: Page, title: string, option?: string) {
  const article = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title, exact: true, level: 4 }) });
  return option ? article.filter({ has: choiceOption(page, option) }) : article;
}
const builder = (story: Story, id: string) => `${story.config.appOrigin}/characters/${id}/builder`;
async function openLevel(page: Page, level: number) {
  await page.getByRole("button", { name: new RegExp(`^Level ${level}:`) }).click();
  await expect(page.locator('section[aria-labelledby="class-level-title"]').getByRole("navigation", { name: "Breadcrumb", exact: true })).toContainText(`Level ${level}`);
}
async function average(page: Page, level: number) {
  await openLevel(page, level);
  const option = hpOption(page, "average");
  await save(page, () => pickOption(option)); await expect(option).toHaveJSProperty("selected", true); await expect(option).toBeEnabled();
}
async function setLevel(page: Page, story: Story, id: string, value: number) {
  await page.goto(builder(story, id) + "/class");
  const control = page.getByRole("combobox", { name: "Set level for Barbarian", exact: true });
  await save(page, () => control.selectOption(String(value))); await expect(control).toHaveValue(String(value)); await expect(control).toBeEnabled();
}
async function createComplete(page: Page, story: Story, label: string) {
  await page.goto(story.config.appOrigin + "/characters/new");
  const name = `Hill Toughness ${label} ${randomUUID().slice(0, 8)}`;
  await page.getByRole("textbox", { name: "What will they be called?" }).fill(name);
  await page.getByRole("button", { name: "Open the notebook", exact: true }).click();
  await page.waitForURL(/\/characters\/[0-9a-f-]+\/builder\/first-class$/);
  const id = new URL(page.url()).pathname.split("/")[2]; expect(id).toMatch(uuid);
  await page.getByRole("combobox", { name: "First class", exact: true }).selectOption({ label: "Barbarian" });
  await page.getByRole("button", { name: "Save first class", exact: true }).click();
  await expect(page.getByText("Barbarian · Level 1", { exact: true })).toBeVisible();
  await page.reload(); await page.getByRole("link", { name: "Complete class choices", exact: true }).click(); await openLevel(page, 1);
  for (const skill of ["Athletics", "Perception"]) await choose(page, choiceOption(group(page, "Choose 2 proficiency", "Athletics"), skill));
  await page.goto(builder(story, id) + "/race");
  await page.getByRole("combobox", { name: "Choose Race", exact: true }).selectOption({ label: "Dwarf" });
  await save(page, () => page.getByRole("button", { name: "Add Race", exact: true }).click());
  await expect(page.getByRole("button", { name: "Change Race", exact: true })).toBeVisible();
  await save(page, () => page.getByRole("combobox", { name: "Subrace", exact: true }).selectOption({ label: "Hill Dwarf" }));
  await expect(page.getByRole("button", { name: "Change Subrace", exact: true })).toBeVisible();
  const tool = choiceOption(choiceGroup(page, "Tool Proficiency: Choose 1"), "Smiths Tools");
  await choose(page, tool);
  await page.reload();
  await expect(tool).toHaveJSProperty("selected", true);
  await page.getByRole("button", { name: "Next: Abilities", exact: true }).click();
  for (const [ability, score] of Object.entries(scores)) {
    const control = page.getByRole("combobox", { name: `${ability} score`, exact: true });
    if (await control.inputValue() === score) continue;
    for (const other of Object.keys(scores)) if (other !== ability) {
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
  for (const [ability, score] of Object.entries(scores)) await expect(page.getByRole("combobox", { name: `${ability} score`, exact: true })).toHaveValue(score);
  await page.getByRole("button", { name: "Next: Background", exact: true }).click();
  await page.getByRole("combobox", { name: "Choose Background", exact: true }).selectOption({ label: "Acolyte" });
  await save(page, () => page.getByRole("button", { name: "Add Background", exact: true }).click());
  const languages = choiceGroup(page, "Choose 2 language");
  for (const language of ["Celestial", "Elvish"]) await choose(page, choiceOption(languages, language));
  await save(page, () => pickOption(choiceOption(page, "Nothing can shake my optimistic attitude.")));
  await setLevel(page, story, id, 3); await openLevel(page, 3);
  await choose(page, choiceOption(page, /^Berserker(?:\s|$)/));
  await average(page, 2); await average(page, 3);
  await page.goto(builder(story, id) + "/equipment");
  const groups = page.locator("select").filter({ has: page.locator('option[value="a"]') });
  await expect(groups.first()).toBeVisible();
  for (let index = 0; index < await groups.count(); index++) await choose(page, groups.nth(index).locator('option[value="a"]'));
  const slots = page.locator('button[data-slot="select-trigger"]');
  for (let index = 0; index < await slots.count(); index++) {
    const slot = slots.nth(index); await slot.click(); await expect(page.getByRole("listbox")).toBeVisible();
    await save(page, () => page.getByRole("listbox").getByRole("option").first().click()); await expect(slot).toBeEnabled();
  }
  await expect(page.getByRole("button", { name: "Confirm Equipment", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Confirm Equipment", exact: true }).click();
  await expect(page.getByText("Starting equipment award recorded", { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText("Starting equipment award recorded", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm Equipment", exact: true })).toHaveCount(0);
  await page.goto(builder(story, id) + "/details");
  await page.getByRole("textbox", { name: "Character name", exact: true }).fill(name);
  await page.getByRole("combobox", { name: "Alignment", exact: true }).selectOption("Neutral Good");
  await save(page, () => page.getByRole("button", { name: "Save details", exact: true }).click());
  await expect(page.getByText("Character details saved.", { exact: true })).toBeVisible(); await page.reload();
  const nav = page.getByRole("navigation", { name: "Character builder", exact: true });
  for (const step of ["class", "race", "abilities", "background", "equipment", "details"]) await expect(nav.locator(`a[href$="/builder/${step}"]`)).toContainText("Saved");
  await page.getByRole("button", { name: "Review & Finish", exact: true }).click();
  await page.getByRole("button", { name: "Finish & View Character", exact: true }).click();
  await expect(page).toHaveURL(`${story.config.appOrigin}/characters/${id}`);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible(); return id;
}
async function inspectSheet(page: Page, story: Story, id: string, hp: number, level = 3) {
  await page.goto(`${story.config.appOrigin}/characters/${id}`);
  const tracker = page.getByRole("button", { name: "HP tracker — click to heal or damage", exact: true });
  await expect(tracker).toContainText(`/${hp}`);
  await expect(page.getByText("AC", { exact: true }).filter({ visible: true }).first().locator("..").locator("p").last()).toHaveText("14");
  await expect(page.getByText("SPEED", { exact: true }).filter({ visible: true }).first().locator("..").locator("p").last()).toHaveText("25ft");
  for (const [ability, value] of Object.entries(effective)) await expect(page.getByRole("button", { name: `Roll ${ability[0].toUpperCase() + ability.slice(1)} check`, exact: true }).locator("p").last()).toHaveText(String(value));
  await expect(page.getByRole("button", { name: "Use one Rage", exact: true }).filter({ visible: true }).first().locator("..")).toContainText(level === 3 ? "3/3" : "2/2");
  const tools = page.getByText("Tools", { exact: true }).filter({ visible: true }).locator(".."); await expect(tools).toContainText("Smiths Tools");
  await page.getByRole("button", { name: "Features", exact: true }).click();
  for (const feature of ["Dwarven Toughness", "Rage", "Unarmored Defense", "Reckless Attack", "Danger Sense", ...(level === 3 ? ["Frenzy"] : []), "Shelter of the Faithful"])
    await expect(page.getByText(feature, { exact: true }).filter({ visible: true }).first()).toBeVisible();
}
async function inspectClass(page: Page, story: Story, id: string, hp: number) {
  await page.goto(builder(story, id) + "/class");
  const stats = page.getByRole("heading", { name: "Stats", exact: true }).locator("..");
  await expect(stats.getByText("Hit Point Maximum", { exact: true }).locator("..").locator("span").last()).toHaveText(String(hp));
  await expect(stats.getByText("Armor Class", { exact: true }).locator("..").locator("span").last()).toHaveText("14");
}

test("Hill Dwarf Barbarian completes creation with Toughness, correct HP and a retained sheet", async ({page,context,browser},info)=>{
  const runtime=testRuntime(), story:Story={config:await configuration(),blockedOrigins:[],pageErrors:[]};
  await restrictOrigins(context,story);page.on("pageerror",()=>story.pageErrors.push("owner browser error"));
  await login(page,story.config,story.config.owner);const id=await createComplete(page,story,"current");
  await inspectClass(page,story,id,38);await inspectSheet(page,story,id,38);
  const before=await observeParent(id,story.config.owner.id);
  const hp=await nativeJson(`BEGIN READ ONLY; SELECT jsonb_build_object('maximumHp',private.builder_multiclass_max_hp_v1(t.id,t.choices,private.builder_protected_graph_v1(t.id)),
    'ancestry',(SELECT jsonb_agg(jsonb_build_object('version',r.content_version,'bonus',v.data_snapshot->'hit_points_bonus_per_character_level'))
      FROM public.character_content_refs r JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
      WHERE r.character_id=t.id AND v.slug_snapshot='hill-dwarf' AND v.content_type_snapshot='subrace' AND v.source_snapshot='srd' AND v.scope_snapshot='platform' AND v.owner_id_snapshot IS NULL))
    FROM public.characters t WHERE id=:'character_id'::uuid AND user_id=:'actor_id'::uuid; ROLLBACK;`,{character_id:id,actor_id:story.config.owner.id});
  expect(hp).toEqual({maximumHp:38,ancestry:[{version:1,bonus:1}]});
  expect(before.native.choices).toMatchObject({race:"dwarf",subrace:"hill-dwarf",classes:[{slug:"barbarian",level:3,subclass:"berserker"}],
    hp_rolls:{"barbarian-2":{method:"average",value:7},"barbarian-3":{method:"average",value:7}},details_confirmed:true});
  expect(before.detail.inventory.length).toBeGreaterThan(0);expect(before.native.state).not.toHaveProperty("current_hp");
  await page.reload();await inspectSheet(page,story,id,38);expect(await observeParent(id,story.config.owner.id)).toEqual(before);
  await page.locator("main").screenshot({path:info.outputPath("hill-dwarf-sheet.png")});
  const other=await browser.newContext();try{await restrictOrigins(other,story);const p=await other.newPage();await login(p,story.config,story.config.other);
    expect((await p.goto(`${story.config.appOrigin}/characters/${id}`))?.status()).toBe(404);}finally{await other.close();}
  expect(await observeParent(id,story.config.owner.id)).toEqual(before);expect(story.blockedOrigins).toEqual([]);expect(story.pageErrors).toEqual([]);
  const output=info.outputPath("ancestry-builder.json");await writeFile(output,JSON.stringify({passed:true,runtime,characterId:id,hp,allSixStepsSaved:true,
    sheetReloadPassed:true,foreign404:true,before,blockedOrigins:story.blockedOrigins,pageErrors:story.pageErrors,
    scope:"Fresh current Hill Dwarf; historical old35/new38 publication remains separate."},null,2));await info.attach("ancestry-builder",{path:output,contentType:"application/json"});
});
