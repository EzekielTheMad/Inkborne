import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

type Account = { email: string; password: string; id: string };
type Settings = { appOrigin: string; supabaseOrigin: string; owner: Account; other: Account; systemId: string };
type Story = {
  className: "Fighter" | "Cleric";
  race: "Half-Elf" | "Elf";
  baseScores: Record<string, string>;
  finalScores: Record<string, string>;
  classSkills: string[];
  proficientSkills: string[];
  features: string[];
  inventory: string[];
};

async function settings(): Promise<Settings> {
  const file = process.env.INKBORNE_LOCAL_FLOW_CONFIG;
  if (!file) throw Error("Provide the isolated local browser configuration file");
  const value = JSON.parse(await readFile(file, "utf8")) as Settings;
  for (const origin of [value.appOrigin, value.supabaseOrigin]) {
    const url = new URL(origin);
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.origin !== origin) {
      throw Error("This workflow accepts only explicit local loopback origins");
    }
  }
  if (!value.owner?.email || !value.owner.password || !value.other?.email || !value.other.password
    || value.owner.id === value.other.id) throw Error("Two distinct isolated accounts are required");
  return value;
}

async function login(page: Page, origin: string, account: Account) {
  try {
    await page.goto(origin + "/login");
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(origin + "/dashboard", { timeout: 60000 });
  } catch {
    await page.close(); // Credential-bearing login pages must never enter screenshots or DOM evidence.
    throw Error("Actual local app sign-in failed; credentials withheld");
  }
}

async function saveThroughApp(page: Page, change: () => Promise<unknown>) {
  const pathname = new URL(page.url()).pathname;
  const [response] = await Promise.all([
    page.waitForResponse(item => item.request().method() === "POST" && new URL(item.url()).pathname === pathname),
    change(),
  ]);
  expect(response.status(), "The application save must succeed before another choice or reload").toBe(200);
}

async function choose(page: Page, option: Locator) {
  await saveThroughApp(page, () => option.click());
  await expect(option).toHaveAttribute("aria-pressed", "true");
  await expect(option).toBeEnabled();
}

function choiceGroup(page: Page, label: string) {
  // The displayed choice label and its ordinary buttons share this small UI container.
  return page.getByText(label, { exact: true }).locator("..").locator("..");
}

async function chooseClass(page: Page, story: Story, info: TestInfo) {
  await page.getByRole("combobox", { name: "First class", exact: true }).selectOption({ label: story.className });
  await page.getByRole("button", { name: "Save first class", exact: true }).click();
  await expect(page.getByText(story.className + " · Level 1", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(story.className + " · Level 1", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Complete class choices", exact: true }).click();
  await page.getByRole("button", { name: /^Level 1:/ }).click();
  for (const skill of story.classSkills) await choose(page, page.getByRole("button", { name: skill, exact: true }));
  if (story.className === "Fighter") {
    await choose(page, page.getByRole("button", { name: /^Defense(?:\s|$)/ }));
  } else {
    await choose(page, page.getByRole("button", { name: /^Life(?:\s|$)/ }));
  }
  await page.reload();
  for (const skill of story.classSkills) await expect(page.getByRole("button", { name: skill, exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: story.className === "Fighter" ? /^Defense(?:\s|$)/ : /^Life(?:\s|$)/ })).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: info.outputPath("class-choices-after-reload.png"), fullPage: true });
  await page.getByRole("button", { name: "Next: Race", exact: true }).click();
}

async function chooseRace(page: Page, story: Story) {
  await page.getByRole("button", { name: "Preview " + story.race, exact: true }).click();
  await saveThroughApp(page, () => page.getByRole("button", { name: "Add Race", exact: true }).click());
  await expect(page.getByRole("button", { name: "Change Race", exact: true })).toBeVisible();
  if (story.race === "Half-Elf") {
    const bonuses = choiceGroup(page, "Choose 2 ability bonus");
    for (const ability of ["Strength", "Constitution"]) await choose(page, bonuses.getByRole("button", { name: ability, exact: true }));
    const skills = choiceGroup(page, "Skill Versatility: Choose 2");
    for (const skill of ["Arcana", "Stealth"]) await choose(page, skills.getByRole("button", { name: skill, exact: true }));
    await choose(page, choiceGroup(page, "Choose 1 language").getByRole("button", { name: "Dwarvish", exact: true }));
  } else {
    await saveThroughApp(page, () => page.getByRole("button", { name: "Select High Elf", exact: true }).click());
    await expect(page.getByRole("button", { name: "Change Subrace", exact: true })).toBeVisible();
    await choose(page, choiceGroup(page, "High Elf Cantrip: Choose 1").getByRole("button", { name: "Light", exact: true }));
    await choose(page, choiceGroup(page, "Extra Language: Choose 1").getByRole("button", { name: "Dwarvish", exact: true }));
  }
  await page.reload();
  await expect(page.getByRole("button", { name: "Change Race", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dwarvish", exact: true })).toHaveAttribute("aria-pressed", "true");
  if (story.race === "Half-Elf") {
    for (const option of ["Strength", "Constitution", "Arcana", "Stealth"]) {
      await expect(page.getByRole("button", { name: option, exact: true })).toHaveAttribute("aria-pressed", "true");
    }
  } else {
    await expect(page.getByRole("button", { name: "Light", exact: true })).toHaveAttribute("aria-pressed", "true");
  }
  await page.getByRole("button", { name: "Next: Abilities", exact: true }).click();
}

async function chooseAbilities(page: Page, story: Pick<Story, "baseScores">) {
  await expect(page).toHaveURL(/\/builder\/abilities$/);
  await page.reload(); // The first interaction must also work after a fresh document load.
  for (const [ability, score] of Object.entries(story.baseScores)) {
    await saveThroughApp(page, () => page.getByRole("combobox", { name: ability + " score", exact: true }).selectOption(score));
    await expect(page.getByText("Changes save automatically.", { exact: true })).toBeVisible();
  }
  await page.reload();
  for (const [ability, score] of Object.entries(story.baseScores)) {
    await expect(page.getByRole("combobox", { name: ability + " score", exact: true })).toHaveValue(score);
  }
  await page.getByRole("button", { name: "Next: Background", exact: true }).click();
}

const clericCantrips = ["Guidance", "Resistance", "Sacred Flame"];
const clericPrepared = ["Bane", "Command", "Guiding Bolt"];
async function chooseClericSpells(page: Page, info: TestInfo) {
  // Preparing spells needs confirmed ability scores. Return through the real
  // builder navigation after choosing them, then continue through saved steps.
  await page.getByRole("navigation", { name: "Character builder", exact: true }).locator('a[href$="/builder/class"]').click();
  const panel = page.getByRole("form", { name: "Cleric spell choices", exact: true });
  await expect(page.getByRole("navigation", { name: "Character builder", exact: true }).locator('a[href$="/builder/class"]')).toContainText("In progress");
  await expect(panel.getByText("Cantrips: 0 / 3", { exact: true })).toBeVisible();
  for (const name of [...clericCantrips, ...clericPrepared]) {
    await panel.getByRole("checkbox", { name: "Select " + name, exact: true }).check();
  }
  await expect(panel.getByText("Cantrips: 3 / 3", { exact: true })).toBeVisible();
  await expect(panel.getByText(/^Prepared spells: 3 \/ 3\./)).toBeVisible();
  await expect(page.getByRole("button", { name: "Next: Race", exact: true })).toBeDisabled();
  await saveThroughApp(page, () => panel.getByRole("button", { name: "Save spells", exact: true }).click());
  await expect(panel.getByText("Spell choices saved.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("navigation", { name: "Character builder", exact: true }).locator('a[href$="/builder/class"]')).toContainText("Saved");
  for (const name of [...clericCantrips, ...clericPrepared]) {
    await expect(panel.getByRole("checkbox", { name: "Select " + name, exact: true })).toBeChecked();
  }
  for (const name of clericPrepared) await expect(panel.getByRole("checkbox", { name: "Prepare " + name, exact: true })).toBeChecked();
  await page.screenshot({ path: info.outputPath("class-spells-after-reload.png"), fullPage: true });
  await page.getByRole("button", { name: "Next: Race", exact: true }).click();
  await page.getByRole("button", { name: "Next: Abilities", exact: true }).click();
  await page.getByRole("button", { name: "Next: Background", exact: true }).click();
}

const personality = "Nothing can shake my optimistic attitude.";
async function chooseBackground(page: Page) {
  await page.getByRole("button", { name: "Preview Acolyte", exact: true }).click();
  await saveThroughApp(page, () => page.getByRole("button", { name: "Add Background", exact: true }).click());
  await expect(page.getByRole("button", { name: "Change Background", exact: true })).toBeVisible();
  for (const language of ["Celestial", "Draconic"]) {
    await choose(page, choiceGroup(page, "Choose 2 language").getByRole("button", { name: language, exact: true }));
  }
  await saveThroughApp(page, () => page.getByRole("button", { name: personality, exact: true }).click());
  await expect(page.getByText("Personality Traits (1/2)", { exact: true })).toBeVisible();
  await page.reload();
  for (const language of ["Celestial", "Draconic"]) await expect(page.getByRole("button", { name: language, exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Personality Traits (1/2)", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next: Equipment", exact: true }).click();
}

async function chooseEquipment(page: Page) {
  const selectedOptions: string[] = [], categoryPicks: string[] = [];
  const groups = page.getByRole("group").filter({ has: page.getByRole("button", { name: /^\(a\)/ }) });
  await expect(groups.first()).toBeVisible();
  for (let index = 0; index < await groups.count(); index++) {
    const option = groups.nth(index).getByRole("button").first();
    selectedOptions.push((await option.innerText()).trim());
    if (await option.getAttribute("aria-pressed") !== "true") await choose(page, option);
  }
  // Category placeholders use the actual catalog-backed menu. Prefer Longsword
  // for the Fighter's martial slot, and ordinary first entries for other slots.
  const slots = page.getByRole("combobox");
  for (let index = 0; index < await slots.count(); index++) {
    const slot = slots.nth(index);
    await slot.click();
    await expect(page.getByRole("listbox")).toBeVisible();
    const longsword = page.getByRole("option", { name: "Longsword", exact: true });
    const option = await longsword.count() ? longsword : page.getByRole("option").first();
    categoryPicks.push((await option.innerText()).trim());
    await saveThroughApp(page, () => option.click());
    await expect(slot).toBeEnabled();
  }
  await expect(page.getByRole("button", { name: "Confirm Equipment", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Confirm Equipment", exact: true }).click();
  await expect(page.getByText("Starting equipment award recorded", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Starting equipment award recorded", { exact: true })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: /^15 gp$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm Equipment", exact: true })).toHaveCount(0);
  return { selectedOptions, categoryPicks };
}

async function inspectSheet(page: Page, story: Story, name: string) {
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  for (const [ability, score] of Object.entries(story.finalScores)) {
    await expect(page.getByRole("button", { name: "Roll " + ability + " check", exact: true }).locator("p").last()).toHaveText(score);
  }
  for (const skill of story.proficientSkills) {
    await expect(page.getByRole("button", { name: "Roll " + skill + " check", exact: true }).getByLabel("Proficient", { exact: true })).toBeVisible();
  }
  for (const ability of story.className === "Fighter" ? ["Strength", "Constitution"] : ["Wisdom", "Charisma"]) {
    await expect(page.getByRole("button", { name: `Roll ${ability} saving throw`, exact: true }).getByLabel("Proficient", { exact: true })).toBeVisible();
  }
  const languages = page.getByText("Languages", { exact: true }).filter({ visible: true }).locator("..");
  for (const language of ["Common", "Elvish", "Dwarvish", "Celestial", "Draconic"]) await expect(languages).toContainText(language);
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "GP amount", exact: true })).toHaveValue("15");
  for (const item of story.inventory) await expect(page.getByText(item, { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Features", exact: true }).click();
  for (const feature of [...story.features, "Shelter of the Faithful"]) await expect(page.getByText(feature, { exact: true }).first()).toBeVisible();
  if (story.className === "Cleric") {
    await page.getByRole("button", { name: "Spells", exact: true }).click();
    await expect(page.getByText("Cantrips: 3/3", { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByText("Prepared: 3/3", { exact: true }).filter({ visible: true })).toBeVisible();
    for (const name of [...clericCantrips, ...clericPrepared, "Light", "Bless", "Cure Wounds"]) {
      const spell = page.getByText(name, { exact: true }).filter({ visible: true });
      await expect(spell).toHaveCount(1);
      await expect(spell).toBeVisible();
    }
  }
}

async function rejectOtherAccount(browser: Browser, config: Settings, sheetUrl: string, allowed: Set<string>, blocked: string[], errors: string[]) {
  const other = await browser.newContext();
  try {
    await restrictOrigins(other, allowed, blocked);
    const page = await other.newPage();
    page.on("pageerror", () => errors.push("browser error in other account"));
    await login(page, config.appOrigin, config.other);
    const response = await page.goto(sheetUrl);
    expect(response?.status()).toBe(404);
    await expect(page.getByText("This page could not be found.", { exact: true })).toBeVisible();
  } finally { await other.close(); }
}

async function restrictOrigins(context: BrowserContext, allowed: Set<string>, blocked: string[]) {
  await context.route("**/*", route => {
    const origin = new URL(route.request().url()).origin;
    if (!allowed.has(origin)) { blocked.push(origin); return route.abort(); }
    return route.continue();
  });
}

async function runStory(page: Page, context: BrowserContext, browser: Browser, info: TestInfo, story: Story) {
  const config = await settings();
  const allowed = new Set([config.appOrigin, config.supabaseOrigin]);
  const blockedOrigins: string[] = [], pageErrors: string[] = [];
  await restrictOrigins(context, allowed, blockedOrigins);
  page.on("pageerror", () => pageErrors.push("browser error"));
  console.log(JSON.stringify({ workerPid: process.pid, parentPid: process.ppid, cwd: process.cwd(),
    startedUtc: new Date().toISOString(), story: "real SRD " + story.className + " builder" }));
  await page.goto(config.appOrigin + "/characters/new");
  await expect(page).toHaveURL(config.appOrigin + "/login");
  await login(page, config.appOrigin, config.owner);
  expect((await context.cookies()).some(cookie => cookie.name.startsWith("sb-"))).toBe(true);
  await page.locator('a[href="/characters/new"]').first().click();
  const originalName = "SRD " + story.className + " " + randomUUID().slice(0, 8);
  await page.getByRole("textbox", { name: "What will they be called?" }).fill(originalName);
  await page.getByRole("button", { name: "Open the notebook", exact: true }).click();
  await page.waitForURL(/\/characters\/[0-9a-f-]+\/builder\/first-class$/);
  const characterId = new URL(page.url()).pathname.split("/")[2];
  const sheetUrl = config.appOrigin + "/characters/" + characterId;
  await chooseClass(page, story, info);
  await chooseRace(page, story);
  await chooseAbilities(page, story);
  if (story.className === "Cleric") await chooseClericSpells(page, info);
  await chooseBackground(page);
  const equipment = await chooseEquipment(page);
  await page.screenshot({ path: info.outputPath("equipment-after-reload.png"), fullPage: true });
  await page.getByRole("button", { name: "Next: Character Details", exact: true }).click();
  const name = originalName + " Acolyte";
  await page.getByRole("textbox", { name: "Character name", exact: true }).fill(name);
  await page.getByRole("combobox", { name: "Alignment", exact: true }).selectOption("Neutral Good");
  await saveThroughApp(page, () => page.getByRole("button", { name: "Save details", exact: true }).click());
  await expect(page.getByText("Character details saved.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Character name", exact: true })).toHaveValue(name);
  await expect(page.getByRole("combobox", { name: "Alignment", exact: true })).toHaveValue("Neutral Good");
  await page.getByRole("button", { name: "Review & Finish", exact: true }).click();
  await page.getByRole("button", { name: "Finish & View Character", exact: true }).click();
  await expect(page).toHaveURL(sheetUrl);
  await inspectSheet(page, story, name);
  await page.reload();
  await inspectSheet(page, story, name);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath("finished-sheet-after-reload.png"), fullPage: true, caret: "initial" });
  await rejectOtherAccount(browser, config, sheetUrl, allowed, blockedOrigins, pageErrors);
  expect(blockedOrigins).toEqual([]);
  expect(pageErrors).toEqual([]);
  const evidence = info.outputPath("real-catalog-workflow.json");
  await writeFile(evidence, JSON.stringify({ actualNextApp: true, actualAuthCookies: true, actualPostgrest: true,
    catalog: "normalized public D&D 5e 2014 SRD", characterId, name, className: story.className, race: story.race,
    subclass: story.className === "Cleric" ? "Life" : null, subrace: story.race === "Elf" ? "High Elf" : null,
    finalScores: story.finalScores, classChoicesReloadPassed: true, raceReloadPassed: true, abilitiesReloadPassed: true,
    backgroundReloadPassed: true, equipmentReloadPassed: true, detailsReloadPassed: true, finishedSheetReloadPassed: true,
    ...(story.className === "Cleric" ? { classSpellsReloadPassed: true, classCantrips: clericCantrips,
      preparedSpells: clericPrepared, racialCantrip: "Light", alwaysPrepared: ["Bless", "Cure Wounds"] } : {}),
    foreignAccountRefused: true, equipment, gp: 15, blockedOrigins, pageErrors }, null, 2));
  await info.attach("real-catalog-workflow", { contentType: "application/json", path: evidence });
}

test("real SRD Fighter, Half-Elf, and Acolyte finish and reload in the actual app", async ({ page, context, browser }, info) => {
  await runStory(page, context, browser, info, {
    className: "Fighter", race: "Half-Elf",
    baseScores: { Strength: "15", Dexterity: "14", Constitution: "13", Intelligence: "12", Wisdom: "10", Charisma: "8" },
    finalScores: { Strength: "16", Dexterity: "14", Constitution: "14", Intelligence: "12", Wisdom: "10", Charisma: "10" },
    classSkills: ["Athletics", "Perception"], proficientSkills: ["Athletics", "Perception", "Arcana", "Stealth", "Insight", "Religion"],
    features: ["Second Wind", "Fey Ancestry", "Skill Versatility"],
    inventory: ["Longsword", "Chain Mail", "Shield", "Dungeoneer's Pack", "Pouch"],
  });
});

test("real SRD Life Cleric, High Elf, and Acolyte finish and reload in the actual app", async ({ page, context, browser }, info) => {
  await runStory(page, context, browser, info, {
    className: "Cleric", race: "Elf",
    baseScores: { Strength: "10", Dexterity: "12", Constitution: "14", Intelligence: "13", Wisdom: "15", Charisma: "8" },
    finalScores: { Strength: "10", Dexterity: "14", Constitution: "14", Intelligence: "14", Wisdom: "15", Charisma: "8" },
    classSkills: ["History", "Medicine"], proficientSkills: ["History", "Medicine", "Perception", "Insight", "Religion"],
    features: ["Disciple of Life", "Fey Ancestry", "High Elf Cantrip", "Elf Weapon Training"],
    inventory: ["Mace", "Scale Mail", "Shield", "Priest's Pack", "Pouch"],
  });
});

test("saved Fighter advances to Champion level four with HP and an ability improvement", async ({ page, context }, info) => {
  const evidenceFile = process.env.INKBORNE_LOCAL_FIGHTER_EVIDENCE;
  test.skip(!evidenceFile, "Provide the successful local Fighter walkthrough evidence for this continuation");
  const prior = JSON.parse(await readFile(evidenceFile!, "utf8")) as { characterId: string; name: string; className: string; finishedSheetReloadPassed: boolean };
  if (prior.className !== "Fighter" || prior.finishedSheetReloadPassed !== true || !/^[0-9a-f-]{36}$/.test(prior.characterId)) throw Error("A confirmed Fighter walkthrough is required");
  const config = await settings(), blocked: string[] = [], errors: string[] = [];
  await restrictOrigins(context, new Set([config.appOrigin, config.supabaseOrigin]), blocked);
  page.on("pageerror", () => errors.push("browser error"));
  await login(page, config.appOrigin, config.owner);
  const builderUrl = `${config.appOrigin}/characters/${prior.characterId}/builder/class`;
  await page.goto(builderUrl);
  await saveThroughApp(page, () => page.getByRole("combobox", { name: "Set level for Fighter", exact: true }).selectOption("4"));
  await expect(page.getByRole("combobox", { name: "Set level for Fighter", exact: true })).toHaveValue("4");
  await page.getByRole("button", { name: /^Level 3:/ }).click();
  await choose(page, page.getByRole("button", { name: /^Champion(?:\s|$)/ }));
  for (const level of [2, 3, 4]) {
    await page.getByRole("button", { name: new RegExp(`^Level ${level}:`) }).click();
    const average = page.getByRole("radio", { name: "Average (+8)", exact: true });
    await saveThroughApp(page, () => average.click());
    await expect(average).toHaveAttribute("aria-checked", "true");
    await expect(average).toBeEnabled();
  }
  await choose(page, page.getByRole("button", { name: "STR +2", exact: true }));
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Set level for Fighter", exact: true })).toHaveValue("4");
  await expect(page.getByRole("button", { name: "STR +2", exact: true })).toHaveAttribute("aria-pressed", "true");
  for (const level of [2, 3, 4]) {
    await page.getByRole("button", { name: new RegExp(`^Level ${level}:`) }).click();
    await expect(page.getByRole("radio", { name: "Average (+8)", exact: true })).toHaveAttribute("aria-checked", "true");
  }
  await page.goto(`${config.appOrigin}/characters/${prior.characterId}`);
  for (let reload = 0; reload < 2; reload++) {
    await expect(page.getByRole("heading", { name: prior.name, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Roll Strength check", exact: true }).locator("p").last()).toHaveText("18");
    await expect(page.getByRole("button", { name: "HP tracker — click to heal or damage", exact: true })).toContainText("/36");
    await page.reload();
  }
  expect(blocked).toEqual([]); expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath("fighter-level-four-after-reload.png"), fullPage: true });
  await writeFile(info.outputPath("fighter-progression-workflow.json"), JSON.stringify({ characterId: prior.characterId,
    level: 4, subclass: "Champion", hpMethods: { 2: "average", 3: "average", 4: "average" }, strength: 18, maxHp: 36,
    actualApp: true, savedReloadPassed: true, blockedOrigins: blocked, pageErrors: errors }, null, 2));
});

test("saved Fighter can choose a feat and retains one server HP roll across reloads", async ({ page, context }, info) => {
  const evidenceFile = process.env.INKBORNE_LOCAL_FIGHTER_EVIDENCE;
  test.skip(!evidenceFile, "Provide the successful local Fighter walkthrough evidence");
  const prior = JSON.parse(await readFile(evidenceFile!, "utf8")) as { characterId: string; className: string };
  if (prior.className !== "Fighter" || !/^[0-9a-f-]{36}$/.test(prior.characterId)) throw Error("A confirmed Fighter walkthrough is required");
  const config = await settings(), blocked: string[] = [], errors: string[] = [];
  await restrictOrigins(context, new Set([config.appOrigin, config.supabaseOrigin]), blocked);
  page.on("pageerror", () => errors.push("browser error"));
  await login(page, config.appOrigin, config.owner);
  const builderUrl = `${config.appOrigin}/characters/${prior.characterId}/builder/class`;
  await page.goto(builderUrl);
  await expect(page.getByRole("combobox", { name: "Set level for Fighter", exact: true })).toHaveValue("4");
  await page.getByRole("button", { name: "Feat", exact: true }).click();
  await page.getByRole("textbox", { name: "Search feats", exact: true }).fill("Grappler");
  await choose(page, page.getByRole("button", { name: /^Grappler\b/ }));
  await page.reload();
  await expect(page.getByRole("button", { name: /^Grappler\b/ })).toHaveAttribute("aria-pressed", "true");
  await page.goto(`${config.appOrigin}/characters/${prior.characterId}`);
  await expect(page.getByRole("button", { name: "Roll Strength check", exact: true }).locator("p").last()).toHaveText("16");
  await page.getByRole("button", { name: "Features", exact: true }).click();
  await expect(page.getByText("Grappler", { exact: true }).first()).toBeVisible();
  await page.goto(builderUrl);
  await page.getByRole("button", { name: "Ability scores", exact: true }).click();
  await choose(page, page.getByRole("button", { name: "STR +2", exact: true }));
  await page.getByRole("button", { name: /^Level 2:/ }).click();
  const rolled = page.getByRole("radio", { name: /^Roll d10/ });
  await saveThroughApp(page, () => rolled.click());
  await expect(rolled).toHaveAttribute("aria-checked", "true");
  await expect(rolled).toBeEnabled();
  const firstRoll = await rolled.innerText();
  await page.reload();
  await page.getByRole("button", { name: /^Level 2:/ }).click();
  await expect(rolled).toHaveText(firstRoll);
  const average = page.getByRole("radio", { name: "Average (+8)", exact: true });
  await saveThroughApp(page, () => average.click());
  await expect(average).toBeEnabled();
  await saveThroughApp(page, () => rolled.click());
  await expect(rolled).toHaveText(firstRoll);
  await expect(rolled).toBeEnabled();
  await saveThroughApp(page, () => average.click());
  await expect(average).toHaveAttribute("aria-checked", "true");
  await page.goto(`${config.appOrigin}/characters/${prior.characterId}`);
  await expect(page.getByRole("button", { name: "Roll Strength check", exact: true }).locator("p").last()).toHaveText("18");
  await expect(page.getByRole("button", { name: "HP tracker — click to heal or damage", exact: true })).toContainText("/36");
  expect(blocked).toEqual([]); expect(errors).toEqual([]);
  await writeFile(info.outputPath("fighter-feat-hp-workflow.json"), JSON.stringify({ characterId: prior.characterId,
    featSelectionReloadPassed: true, featReplacedByAsi: true, rolledResultRetained: true, finalHpMethod: "average",
    firstRoll, strength: 18, maxHp: 36, actualApp: true, blockedOrigins: blocked, pageErrors: errors }, null, 2));
});

test("saved Fighter primary saving throws remain proficient after reload", async ({ page, context }) => {
  const evidenceFile = process.env.INKBORNE_LOCAL_FIGHTER_EVIDENCE;
  test.skip(!evidenceFile, "Provide the successful local Fighter walkthrough evidence");
  const prior = JSON.parse(await readFile(evidenceFile!, "utf8")) as { characterId: string };
  if (!/^[0-9a-f-]{36}$/.test(prior.characterId)) throw Error("A saved local Fighter is required");
  const config = await settings(), blocked: string[] = [], errors: string[] = [];
  await restrictOrigins(context, new Set([config.appOrigin, config.supabaseOrigin]), blocked);
  page.on("pageerror", () => errors.push("browser error"));
  await login(page, config.appOrigin, config.owner);
  await page.goto(`${config.appOrigin}/characters/${prior.characterId}`);
  for (let reload = 0; reload < 2; reload++) {
    for (const [ability, bonus] of [["Strength", "+6"], ["Constitution", "+4"]] as const) {
      const save = page.getByRole("button", { name: `Roll ${ability} saving throw`, exact: true });
      await expect(save.getByLabel("Proficient", { exact: true })).toBeVisible();
      await expect(save).toContainText(bonus);
    }
    await page.reload();
  }
  expect(blocked).toEqual([]); expect(errors).toEqual([]);
});

test("real SRD Rogue Expertise saves, reloads and follows its source proficiencies", async ({ page, context }, info) => {
  const config = await settings(), blocked: string[] = [], errors: string[] = [];
  await restrictOrigins(context, new Set([config.appOrigin, config.supabaseOrigin]), blocked);
  page.on("pageerror", () => errors.push("browser error"));
  await login(page, config.appOrigin, config.owner);
  await page.locator('a[href="/characters/new"]').first().click();
  const name = "SRD Rogue " + randomUUID().slice(0, 8);
  await page.getByRole("textbox", { name: "What will they be called?" }).fill(name);
  await page.getByRole("button", { name: "Open the notebook", exact: true }).click();
  await page.waitForURL(/\/characters\/[0-9a-f-]+\/builder\/first-class$/);
  const characterId = new URL(page.url()).pathname.split("/")[2];
  const builderUrl = `${config.appOrigin}/characters/${characterId}/builder/class`;
  const sheetUrl = `${config.appOrigin}/characters/${characterId}`;
  await page.getByRole("combobox", { name: "First class", exact: true }).selectOption({ label: "Rogue" });
  await page.getByRole("button", { name: "Save first class", exact: true }).click();
  await expect(page.getByText("Rogue · Level 1", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Complete class choices", exact: true }).click();
  await page.getByRole("button", { name: /^Level 1:/ }).click();
  const skills = choiceGroup(page, "Choose 4 proficiency");
  for (const skill of ["Acrobatics", "Perception", "Sleight Of Hand", "Stealth"]) {
    await choose(page, skills.getByRole("button", { name: skill, exact: true }));
  }
  const expertise = choiceGroup(page, "Choose 2 expertise");
  await expect(expertise.getByRole("button", { name: "Arcana", exact: true })).toHaveCount(0);
  for (const skill of ["Stealth", "Thieves Tools"]) await choose(page, expertise.getByRole("button", { name: skill, exact: true }));
  await page.reload();
  for (const skill of ["Stealth", "Thieves Tools"]) await expect(expertise.getByRole("button", { name: skill, exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.goto(`${config.appOrigin}/characters/${characterId}/builder/abilities`);
  await chooseAbilities(page, { baseScores: { Strength: "10", Dexterity: "15", Constitution: "14", Intelligence: "13", Wisdom: "12", Charisma: "8" } });
  await page.goto(sheetUrl);
  const stealth = page.getByRole("button", { name: "Roll Stealth check", exact: true });
  await expect(stealth.getByLabel("Expertise", { exact: true })).toBeVisible();
  await expect(stealth).toContainText("+6");
  await page.reload();
  await expect(stealth).toContainText("+6");
  await page.screenshot({ path: info.outputPath("rogue-expertise-after-reload.png"), fullPage: true, caret: "initial" });

  await page.goto(builderUrl);
  await page.getByRole("button", { name: /^Level 1:/ }).click();
  await saveThroughApp(page, () => skills.getByRole("button", { name: "Stealth", exact: true }).click());
  await expect(skills.getByRole("button", { name: "Stealth", exact: true })).toHaveAttribute("aria-pressed", "false");
  await choose(page, skills.getByRole("button", { name: "Deception", exact: true }));
  await page.reload();
  await expect(expertise.getByRole("button", { name: "Stealth", exact: true })).toHaveCount(0);
  await expect(expertise.getByText("1 / 2 selected", { exact: true })).toBeVisible();
  await page.goto(sheetUrl);
  await expect(stealth.getByLabel("Expertise", { exact: true })).toHaveCount(0);
  await expect(stealth).toContainText("+2");
  await page.goto(builderUrl);
  await page.getByRole("button", { name: /^Level 1:/ }).click();
  await choose(page, expertise.getByRole("button", { name: "Acrobatics", exact: true }));
  await saveThroughApp(page, () => page.getByRole("combobox", { name: "Set level for Rogue", exact: true }).selectOption("6"));
  await expect(page.getByRole("combobox", { name: "Set level for Rogue", exact: true })).toHaveValue("6");
  await page.getByRole("button", { name: /^Level 6:/ }).click();
  await expect(expertise.getByRole("button", { name: "Acrobatics", exact: true })).toHaveCount(0);
  await expect(expertise.getByRole("button", { name: "Thieves Tools", exact: true })).toHaveCount(0);
  for (const skill of ["Perception", "Sleight Of Hand"]) await choose(page, expertise.getByRole("button", { name: skill, exact: true }));
  await page.reload();
  for (const skill of ["Perception", "Sleight Of Hand"]) await expect(expertise.getByRole("button", { name: skill, exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.goto(sheetUrl);
  await page.reload();
  for (const skill of ["Acrobatics", "Perception", "Sleight of Hand"]) {
    const check = page.getByRole("button", { name: `Roll ${skill} check`, exact: true });
    await expect(check.getByLabel("Expertise", { exact: true })).toBeVisible();
    await expect(check).toContainText(skill === "Perception" ? "+7" : "+8");
  }
  await expect(stealth.getByLabel("Expertise", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Thieves.*Tools.*expertise/i).filter({ visible: true })).toBeVisible();
  expect(blocked).toEqual([]); expect(errors).toEqual([]);
  await writeFile(info.outputPath("rogue-expertise-workflow.json"), JSON.stringify({ characterId, name,
    actualApp: true, level: 6, firstExpertiseReloadPassed: true, lostProficiencyPruned: true,
    additionalExpertiseReloadPassed: true, duplicatePicksUnavailable: true, toolExpertiseVisible: true,
    blockedOrigins: blocked, pageErrors: errors }, null, 2));
});
