import { choiceOption, choiceGroup, optionPicked, pickOption, hpOption, setSpell, selectedSpell, setPrepared } from "./dropdown-helpers";
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { nativeJson, testRuntime } from "../../scripts/unraid/native";

type Account = { id: string; email: string; password: string };
type Settings = { appOrigin: string; supabaseOrigin: string; owner: Account; other: Account };
type Story = {
  slug: string; name: string; subclass: string; subclassLevel: number; ability: string;
  scores: Record<string, string>; skills: string[]; cantrips: string[]; spells: string[];
  prepared?: string[]; fixed?: string[]; bonus?: string[]; features: string[]; inventory: string[];
  maxHp: number; dc: number; attack: number; known?: number; book?: number; preparedLimit?: number;
  slots: [number, number]; savingThrows: string[];
};
const charisma = { Strength: "8", Dexterity: "13", Constitution: "14", Intelligence: "12", Wisdom: "10", Charisma: "15" };
const wisdom = { Strength: "10", Dexterity: "13", Constitution: "14", Intelligence: "12", Wisdom: "15", Charisma: "8" };
// Fixed 2014 level-three expectations. Do not derive these budgets from the app's
// progression tables: these stories are independent acceptance oracles.
const stories: Story[] = [
  { slug: "bard", name: "Bard", subclass: "Lore", subclassLevel: 3, ability: "Charisma", scores: charisma,
    skills: ["Arcana", "Perception", "Stealth"], cantrips: ["Mage Hand", "Vicious Mockery"],
    spells: ["Animal Friendship", "Charm Person", "Cure Wounds", "Detect Magic", "Healing Word", "Shatter"], known: 6,
    features: ["Bardic Inspiration (d6)", "Jack of All Trades", "Cutting Words", "Bonus Proficiencies"],
    inventory: ["Rapier", "Leather Armor", "Dagger", "Lute"], maxHp: 24, dc: 13, attack: 5, slots: [4, 2], savingThrows: ["Dexterity", "Charisma"] },
  { slug: "cleric", name: "Cleric", subclass: "Life", subclassLevel: 1, ability: "Wisdom", scores: wisdom,
    skills: ["History", "Medicine"], cantrips: ["Guidance", "Resistance", "Sacred Flame"],
    spells: ["Bane", "Command", "Detect Magic", "Guiding Bolt", "Healing Word", "Hold Person"],
    prepared: ["Bane", "Command", "Detect Magic", "Guiding Bolt", "Healing Word", "Hold Person"], preparedLimit: 6,
    fixed: ["Bless", "Cure Wounds", "Lesser Restoration", "Spiritual Weapon"],
    features: ["Disciple of Life", "Channel Divinity: Preserve Life"], inventory: ["Mace", "Scale Mail", "Shield"],
    maxHp: 24, dc: 13, attack: 5, slots: [4, 2], savingThrows: ["Wisdom", "Charisma"] },
  { slug: "druid", name: "Druid", subclass: "Land", subclassLevel: 2, ability: "Wisdom", scores: wisdom,
    skills: ["Nature", "Perception"], cantrips: ["Produce Flame", "Shillelagh"], bonus: ["Guidance"],
    spells: ["Animal Friendship", "Entangle", "Faerie Fire", "Goodberry", "Healing Word", "Flaming Sphere"],
    prepared: ["Animal Friendship", "Entangle", "Faerie Fire", "Goodberry", "Healing Word", "Flaming Sphere"], preparedLimit: 6,
    fixed: ["Barkskin", "Spider Climb"], features: ["Druidic", "Natural Recovery", "Circle of the Land: Forest"],
    inventory: ["Shield", "Scimitar", "Leather Armor"], maxHp: 24, dc: 13, attack: 5, slots: [4, 2], savingThrows: ["Intelligence", "Wisdom"] },
  { slug: "sorcerer", name: "Sorcerer", subclass: "Draconic", subclassLevel: 1, ability: "Charisma", scores: charisma,
    skills: ["Arcana", "Persuasion"], cantrips: ["Acid Splash", "Fire Bolt", "Light", "Ray of Frost"],
    spells: ["Burning Hands", "Charm Person", "Magic Missile", "Scorching Ray"], known: 4,
    features: ["Dragon Ancestor: Gold - Fire Damage", "Draconic Resilience", "Metamagic: Quickened Spell", "Metamagic: Subtle Spell"],
    inventory: ["Component Pouch", "Dagger"], maxHp: 23, dc: 13, attack: 5, slots: [4, 2], savingThrows: ["Constitution", "Charisma"] },
  { slug: "warlock", name: "Warlock", subclass: "Fiend", subclassLevel: 1, ability: "Charisma", scores: charisma,
    skills: ["Arcana", "History"], cantrips: ["Eldritch Blast", "Mage Hand"],
    spells: ["Charm Person", "Hellish Rebuke", "Burning Hands", "Scorching Ray"], known: 4,
    features: ["Dark One's Blessing", "Pact of the Blade", "Eldritch Invocation: Agonizing Blast", "Eldritch Invocation: Repelling Blast"],
    inventory: ["Component Pouch", "Dagger", "Leather Armor"], maxHp: 24, dc: 13, attack: 5, slots: [0, 2], savingThrows: ["Wisdom", "Charisma"] },
  { slug: "wizard", name: "Wizard", subclass: "Evocation", subclassLevel: 2, ability: "Intelligence",
    scores: { Strength: "8", Dexterity: "13", Constitution: "14", Intelligence: "15", Wisdom: "12", Charisma: "10" },
    skills: ["Arcana", "History"], cantrips: ["Fire Bolt", "Light", "Mage Hand"],
    // Eight level-one entries and two level-two entries are reachable through
    // the normal six-at-one, plus-two-per-level spellbook progression.
    spells: ["Burning Hands", "Charm Person", "Comprehend Languages", "Detect Magic", "Feather Fall", "Identify", "Magic Missile", "Shield", "Misty Step", "Scorching Ray"],
    prepared: ["Burning Hands", "Charm Person", "Magic Missile", "Shield", "Misty Step", "Scorching Ray"], preparedLimit: 6, book: 10,
    features: ["Arcane Recovery", "Evocation Savant", "Sculpt Spells"], inventory: ["Quarterstaff", "Component Pouch", "Spellbook"],
    maxHp: 20, dc: 13, attack: 5, slots: [4, 2], savingThrows: ["Intelligence", "Wisdom"] },
  { slug: "paladin", name: "Paladin", subclass: "Devotion", subclassLevel: 3, ability: "Charisma",
    scores: { Strength: "14", Dexterity: "12", Constitution: "13", Intelligence: "8", Wisdom: "10", Charisma: "15" },
    skills: ["Athletics", "Persuasion"], cantrips: [], spells: ["Bless", "Cure Wounds", "Divine Favor", "Shield of Faith"],
    prepared: ["Bless", "Cure Wounds", "Divine Favor", "Shield of Faith"], preparedLimit: 4,
    fixed: ["Protection from Evil and Good", "Sanctuary"], features: ["Divine Smite", "Divine Health", "Channel Divinity: Sacred Weapon", "Channel Divinity: Turn the Unholy"],
    inventory: ["Longsword", "Shield", "Javelin", "Chain Mail"], maxHp: 28, dc: 13, attack: 5, slots: [3, 0], savingThrows: ["Wisdom", "Charisma"] },
  { slug: "ranger", name: "Ranger", subclass: "Hunter", subclassLevel: 3, ability: "Wisdom",
    scores: { Strength: "12", Dexterity: "15", Constitution: "13", Intelligence: "10", Wisdom: "14", Charisma: "8" },
    skills: ["Athletics", "Perception", "Survival"], cantrips: [], spells: ["Animal Friendship", "Hunter's Mark", "Longstrider"], known: 3,
    features: ["Favored Enemy (1 type)", "Natural Explorer (1 terrain type)", "Hunter's Prey: Colossus Slayer", "Primeval Awareness"],
    inventory: ["Scale Mail", "Shortsword", "Longbow"], maxHp: 28, dc: 12, attack: 4, slots: [3, 0], savingThrows: ["Strength", "Dexterity"] },
];

async function settings(): Promise<Settings> {
  const runtime = process.env.INKBORNE_TEST_RUNTIME ? testRuntime() : undefined;
  const file = runtime ? process.env.INKBORNE_TEST_CONFIG : process.env.INKBORNE_LOCAL_FLOW_CONFIG;
  if (!file) throw Error("Provide the isolated local browser configuration file");
  let config: Settings;
  try { config = JSON.parse(await readFile(file, "utf8")) as Settings; }
  catch { throw Error("Restricted browser configuration unavailable; contents withheld"); }
  if (runtime && (file !== "/run/inkborne/test-config.json" || config.appOrigin !== "http://127.0.0.1:3001"
    || config.supabaseOrigin !== "http://127.0.0.1:9999")) throw Error("Dedicated scratch-test origins and configuration required");
  for (const origin of [config.appOrigin, config.supabaseOrigin]) {
    const url = new URL(origin);
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.origin !== origin) throw Error("Complete caster stories require explicit loopback origins");
  }
  for (const account of [config.owner, config.other]) if (!account?.email || !account.password
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(account.id)) throw Error("Disposable verification accounts required");
  if (config.owner.id === config.other.id) throw Error("Two distinct isolated accounts are required");
  return config;
}
async function restrictOrigins(context: BrowserContext, config: Settings, blocked: string[]) {
  const allowed = new Set([config.appOrigin, config.supabaseOrigin]);
  await context.route("**/*", route => {
    const origin = new URL(route.request().url()).origin;
    if (!allowed.has(origin)) { blocked.push(origin); return route.abort(); }
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
  } catch {
    await page.close(); // Never capture credential-bearing sign-in documents.
    throw Error("Actual local sign-in failed; credentials withheld");
  }
}
async function save(page: Page, change: () => Promise<unknown>) {
  const path = new URL(page.url()).pathname;
  const [response] = await Promise.all([page.waitForResponse(item => item.request().method() === "POST"
    && new URL(item.url()).pathname === path), change()]);
  expect(response.status(), "An actual app save must succeed before the next edit").toBe(200);
}
async function choose(page: Page, option: Locator) {
  if (!await optionPicked(option)) await save(page, () => pickOption(option));
  await expect(option).toHaveJSProperty("selected", true); await expect(option).toBeEnabled();
}
function group(page: Page, label: string, option?: string) {
  const article = page.getByRole("article").filter({ has: page.getByRole("heading", { name: label, exact: true, level: 4 }) });
  return option ? article.filter({ has: page.locator("option").filter({ hasText: new RegExp(`^${option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }) }) : article;
}
async function openLevel(page: Page, level: number) {
  await page.getByRole("button", { name: new RegExp(`^Level ${level}:`) }).click();
  await expect(page.locator('section[aria-labelledby="class-level-title"]').getByRole("navigation", { name: "Breadcrumb", exact: true })).toContainText(`Level ${level}`);
}
async function chooseRootClassOptions(page: Page, story: Story) {
  await openLevel(page, 1);
  for (const name of story.skills) await choose(page, choiceOption(group(page, `Choose ${story.skills.length} proficiency`, story.skills[0]), name));
  if (story.slug === "bard") for (const name of ["Drum", "Flute", "Lute"]) await choose(page, choiceOption(group(page, "Choose 3 proficiency", "Lute"), name));
  if (story.subclassLevel === 1) await choose(page, choiceOption(page, new RegExp(`^${story.subclass}(?:\\s|$)`)));
  if (story.slug === "sorcerer") await choose(page, choiceOption(group(page, "Choose 1 feature"), /^Dragon Ancestor Gold(?:\s|$)/));
  if (story.slug === "ranger") {
    await choose(page, choiceOption(group(page, "Choose 1 favored terrain"), "Forest"));
    const enemy = page.getByRole("article").filter({ has: page.getByRole("button", { name: "Save favored enemy", exact: true }) });
    await enemy.getByRole("combobox", { name: "Favored enemy", exact: true }).selectOption("beasts");
    await save(page, () => enemy.getByRole("button", { name: "Save favored enemy", exact: true }).click());
    await expect(enemy.getByRole("button", { name: "Save favored enemy", exact: true })).toBeEnabled();
  }
}
async function chooseHumanAbilitiesAndBackground(page: Page, base: string, story: Story) {
  await page.goto(base + "/race");
  await page.getByRole("combobox", { name: "Choose Race", exact: true }).selectOption({ label: "Human" });
  await save(page, () => page.getByRole("button", { name: "Add Race", exact: true }).click());
  await expect(page.getByRole("button", { name: "Change Race", exact: true })).toBeVisible();
  const languages = choiceGroup(page, "Choose 1 language");
  await choose(page, choiceOption(languages, "Dwarvish"));
  await page.reload(); await expect(choiceOption(languages, "Dwarvish").first()).toHaveJSProperty("selected", true);
  await page.getByRole("button", { name: "Next: Abilities", exact: true }).click();
  for (const [ability, score] of Object.entries(story.scores)) {
    const control = page.getByRole("combobox", { name: `${ability} score`, exact: true });
    if (await control.inputValue() === score) continue;
    for (const other of Object.keys(story.scores)) if (other !== ability) {
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
  for (const [ability, score] of Object.entries(story.scores)) await expect(page.getByRole("combobox", { name: `${ability} score`, exact: true })).toHaveValue(score);
  await page.getByRole("button", { name: "Next: Background", exact: true }).click();
  await page.getByRole("combobox", { name: "Choose Background", exact: true }).selectOption({ label: "Acolyte" });
  await save(page, () => page.getByRole("button", { name: "Add Background", exact: true }).click());
  await expect(page.getByRole("button", { name: "Change Background", exact: true })).toBeVisible();
  const choices = choiceGroup(page, "Choose 2 language");
  for (const name of ["Celestial", "Elvish"]) await choose(page, choiceOption(choices, name));
  await save(page, () => pickOption(choiceOption(page, "Nothing can shake my optimistic attitude.")));
  await page.reload();
  for (const name of ["Celestial", "Elvish"]) await expect(choiceOption(choices, name)).toHaveJSProperty("selected", true);
}
async function chooseLevelThreeOptions(page: Page, base: string, story: Story) {
  await page.goto(base + "/class");
  const level = page.getByRole("combobox", { name: `Set level for ${story.name}`, exact: true });
  await save(page, () => level.selectOption("3")); await expect(level).toHaveValue("3"); await expect(level).toBeEnabled();
  if (story.subclassLevel > 1) {
    await openLevel(page, story.subclassLevel);
    await choose(page, choiceOption(page, new RegExp(`^${story.subclass}(?:\\s|$)`)));
  }
  if (story.slug === "bard") {
    await openLevel(page, 3);
    for (const name of ["Perception", "Stealth"]) await choose(page, choiceOption(group(page, "Choose 2 expertise"), name));
    for (const name of ["Athletics", "Medicine", "Nature"]) await choose(page, choiceOption(group(page, "Choose 3 proficiency", "Athletics"), name));
  } else if (story.slug === "druid") {
    await openLevel(page, 2); await choose(page, choiceOption(group(page, "Choose 1 feature"), "Circle Of The Land Forest"));
    const bonus = page.getByRole("form", { name: /: bonus-cantrip$/ });
    await bonus.getByRole("textbox").last().fill("Guidance"); await setSpell(bonus, "Guidance", true);
    await save(page, () => bonus.getByRole("button", { name: /^Save / }).click()); await expect(bonus.getByRole("button", { name: /^Save / })).toBeEnabled();
  } else if (story.slug === "sorcerer") {
    await openLevel(page, 3);
    for (const name of ["Metamagic Quickened Spell", "Metamagic Subtle Spell"]) await choose(page, choiceOption(group(page, "Choose 2 feature"), name));
  } else if (story.slug === "warlock") {
    await openLevel(page, 3); await choose(page, choiceOption(group(page, "Choose 1 feature"), "Pact Of The Blade"));
  } else if (story.slug === "paladin" || story.slug === "ranger") {
    await openLevel(page, 2); await choose(page, choiceOption(page, story.slug === "paladin" ? /^Defense(?:\s|$)/ : /^Archery(?:\s|$)/));
    if (story.slug === "ranger") {
      await openLevel(page, 3); await choose(page, choiceOption(group(page, "Choose 1 feature"), "Hunters Prey Colossus Slayer"));
    }
  }
  for (const value of [2, 3]) {
    await openLevel(page, value);
    const average = hpOption(page, "average");
    await save(page, () => pickOption(average)); await expect(average).toHaveJSProperty("selected", true); await expect(average).toBeEnabled();
  }
}
async function chooseSpells(page: Page, story: Story) {
  const form = page.getByRole("form", { name: `${story.name} spell choices`, exact: true });
  await expect(form.getByText(`Cantrips: 0 / ${story.cantrips.length}`, { exact: true })).toBeVisible();
  async function find(name: string, cantrip: boolean) {
    await form.getByRole("textbox", { name: `Search ${story.name.toLowerCase()} ${cantrip ? "cantrips" : "levelled spells"}`, exact: true }).fill(name);
    return selectedSpell(form, name);
  }
  for (const name of story.cantrips) await setSpell(form, name, true);
  for (const name of story.spells) {
    await setSpell(form, name, true);
    if (story.prepared && !story.prepared.includes(name)) await setPrepared(form, name, false);
  }
  if (story.known !== undefined) await expect(form.getByText(`Spells known: ${story.known} / ${story.known}`, { exact: true })).toBeVisible();
  if (story.book) await expect(form.getByText(`Spellbook: ${story.book} / ${story.book} spells`, { exact: true })).toBeVisible();
  if (story.preparedLimit) await expect(form.getByText(new RegExp(`^Prepared spells: ${story.prepared!.length} / ${story.preparedLimit}\\.`))).toBeVisible();
  await expect(form.getByRole("button", { name: "Save spells", exact: true })).toBeEnabled();
  await save(page, () => form.getByRole("button", { name: "Save spells", exact: true }).click());
  await expect(form.getByText("Spell choices saved.", { exact: true })).toBeVisible();
  await page.reload();
  for (const name of story.cantrips) await expect(await find(name, true)).toHaveCount(1);
  for (const name of story.spells) {
    await expect(await find(name, false)).toHaveCount(1);
    if (story.prepared) {
      const prepared = form.getByRole("combobox", { name: `Prepare ${name}`, exact: true });
      if (story.prepared.includes(name)) await expect(prepared).toHaveValue("prepared"); else await expect(prepared).toHaveValue("not-prepared");
    }
  }
  if (story.slug === "warlock") {
    await openLevel(page, 2);
    for (const name of ["Eldritch Invocation Agonizing Blast", "Eldritch Invocation Repelling Blast"]) await choose(page, choiceOption(group(page, "Choose 2 invocation"), name));
    await page.reload();
  }
  await expect(page.getByRole("navigation", { name: "Character builder", exact: true }).locator('a[href$="/builder/class"]')).toContainText("Saved");
}
async function chooseEquipmentAndDetails(page: Page, base: string, name: string) {
  await page.goto(base + "/equipment");
  const groups = page.locator("select").filter({ has: page.locator('option[value="a"]') });
  await expect(groups.first()).toBeVisible();
  for (let index = 0; index < await groups.count(); index++) {
    const option = groups.nth(index).locator('option[value="a"]');
    if (!await optionPicked(option)) await choose(page, option);
  }
  const slots = page.locator('button[data-slot="select-trigger"]');
  for (let index = 0; index < await slots.count(); index++) {
    const slot = slots.nth(index); await slot.click(); const menu = page.getByRole("listbox"); await expect(menu).toBeVisible();
    const longsword = menu.getByRole("option", { name: "Longsword", exact: true });
    const option = await longsword.count() ? longsword : menu.getByRole("option").first();
    await save(page, () => pickOption(option));
    await expect(slot).toBeEnabled();
  }
  await expect(page.getByRole("button", { name: "Confirm Equipment", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Confirm Equipment", exact: true }).click();
  await expect(page.getByText("Starting equipment award recorded", { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText("Starting equipment award recorded", { exact: true })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: /^15 gp$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm Equipment", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Next: Character Details", exact: true }).click();
  await page.getByRole("textbox", { name: "Character name", exact: true }).fill(name);
  await page.getByRole("combobox", { name: "Alignment", exact: true }).selectOption("Neutral Good");
  await save(page, () => page.getByRole("button", { name: "Save details", exact: true }).click());
  await expect(page.getByText("Character details saved.", { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole("textbox", { name: "Character name", exact: true })).toHaveValue(name);
  const nav = page.getByRole("navigation", { name: "Character builder", exact: true });
  for (const path of ["class", "race", "abilities", "background", "equipment", "details"]) await expect(nav.locator(`a[href$="/builder/${path}"]`)).toContainText("Saved");
}
async function inspectSheet(page: Page, story: Story, name: string) {
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  for (const [ability, raw] of Object.entries(story.scores)) await expect(page.getByRole("button", { name: `Roll ${ability} check`, exact: true }).locator("p").last()).toHaveText(String(Number(raw) + 1));
  await expect(page.getByRole("button", { name: "HP tracker — click to heal or damage", exact: true })).toContainText(`/${story.maxHp}`);
  if (story.slug === "sorcerer") await expect(page.getByText("AC", { exact: true }).filter({ visible: true }).first().locator("..").locator("p").last()).toHaveText("15");
  for (const ability of story.savingThrows) await expect(page.getByRole("button", { name: `Roll ${ability} saving throw`, exact: true }).getByLabel("Proficient", { exact: true })).toBeVisible();
  for (const skill of [...story.skills, "Insight", "Religion"]) await expect(page.getByRole("button", { name: `Roll ${skill} check`, exact: true }).getByLabel(story.slug === "bard" && ["Perception", "Stealth"].includes(skill) ? "Expertise" : "Proficient", { exact: true })).toBeVisible();
  const languages = page.getByText("Languages", { exact: true }).filter({ visible: true }).locator("..");
  for (const language of ["Common", "Dwarvish", "Celestial", "Elvish", ...(story.slug === "druid" ? ["Druidic"] : story.slug === "sorcerer" ? ["Draconic"] : [])]) await expect(languages).toContainText(language);
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "GP amount", exact: true })).toHaveValue("15");
  for (const item of story.inventory) await expect(page.getByText(item, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Features", exact: true }).click();
  for (const feature of [...story.features, "Shelter of the Faithful"]) await expect(page.getByText(feature, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Spells", exact: true }).click();
  await expect(page.getByText(`Cantrips: ${story.cantrips.length}/${story.cantrips.length}`, { exact: true }).filter({ visible: true })).toBeVisible();
  if (story.known !== undefined) await expect(page.getByText(`Ordinary Spells Known: ${story.known}/${story.known}`, { exact: true }).filter({ visible: true })).toBeVisible();
  if (story.preparedLimit) await expect(page.getByText(`Prepared: ${story.prepared!.length}/${story.preparedLimit}`, { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText(new RegExp(`^Save DC\\s*${story.dc}$`)).filter({ visible: true })).toBeVisible();
  await expect(page.getByText(new RegExp(`^Attack\\s*\\+${story.attack}$`)).filter({ visible: true })).toBeVisible();
  for (const spell of [...story.cantrips, ...story.spells, ...(story.fixed ?? []), ...(story.bonus ?? [])]) await expect(page.getByText(spell, { exact: true }).filter({ visible: true })).toHaveCount(1);
  if (story.slug === "warlock") {
    await expect(page.getByRole("button", { name: "Mark Pact slot used", exact: true }).filter({ visible: true })).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Mark 1st slot used", exact: true }).filter({ visible: true })).toHaveCount(0);
  } else {
    await expect(page.getByRole("button", { name: "Mark 1st slot used", exact: true }).filter({ visible: true })).toHaveCount(story.slots[0]);
    await expect(page.getByRole("button", { name: "Mark 2nd slot used", exact: true }).filter({ visible: true })).toHaveCount(story.slots[1]);
  }
}
async function nativeReadback(info: TestInfo, characterId: string, actorId: string, phase: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(characterId)) throw Error("Native character identity required");
  const runtime = process.env.INKBORNE_TEST_RUNTIME ? testRuntime() : undefined;
  const readers = ["complete-caster-builders-readback.sql", "builder-class-choices-readback.sql", "builder-bonus-spells-readback.sql"];
  const reports: Record<string, Record<string, unknown>> = {};
  const processes: unknown[] = [];
  if (runtime) {
    for (const file of readers) {
      const sql = await readFile(resolve(process.cwd(), "supabase/verification", file), "utf8");
      reports[file] = await nativeJson(sql, { character_id: characterId }) as Record<string, unknown>;
    }
  } else {
    const configFile = process.env.INKBORNE_LOCAL_FLOW_CONFIG;
    if (!configFile) throw Error("Local native evidence configuration required");
    const state = JSON.parse(await readFile(resolve(dirname(configFile), "../state.json"), "utf8"));
    if (state.project !== "inkborne-app-flow-20261022" || state.ready !== true || state.stoppedUtc) throw Error("Wrong disposable runtime");
    const db = state.containers.find((item: { name: string }) => item.name === `/${state.project}-db`);
    if (!db || !/^[a-f0-9]{64}$/.test(db.id)) throw Error("Missing owned database identity");
    const run = (args: string[], input?: string) => {
      const startedUtc = new Date().toISOString();
      const result = spawnSync("C:/Users/kaios/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe", ["--context", "desktop-linux", ...args],
        { input, encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
      processes.push({ pid: result.pid, parentPid: process.pid, cwd: process.cwd(), args, startedUtc, exitCode: result.status });
      if (result.status !== 0) throw Error(`Local read-only caster evidence failed: ${result.stderr.slice(0, 1200)}`);
      return result.stdout.trim();
    };
    expect(run(["info", "--format", "{{.ID}}"])).toBe(state.engineId);
    const inspected = JSON.parse(run(["inspect", "--format", '{"id":{{json .Id}},"labels":{{json .Config.Labels}}}', db.id]));
    expect(inspected.id).toBe(db.id); expect(inspected.labels["com.docker.compose.project"]).toBe(state.project);
    for (const file of readers) {
      const sql = await readFile(resolve(process.cwd(), "supabase/verification", file), "utf8");
      reports[file] = JSON.parse(run(["exec", "-i", db.id, "psql", "-X", "--no-password", "--host", "/var/run/postgresql", "--username", "supabase_admin",
        "--dbname", "postgres", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--set", `character_id=${characterId}`, "--file", "-"], sql));
    }
  }
  const report = reports["complete-caster-builders-readback.sql"];
  const path = info.outputPath(`complete-caster-native-${phase}.json`);
  await writeFile(path, JSON.stringify({ observedUtc: new Date().toISOString(), characterId, runtime, processes, reports }, null, 2));
  await info.attach(`native-${phase}`, { path, contentType: "application/json" });
  expect(report.characterId).toBe(characterId); expect(report.actorId).toBe(actorId);
  for (const [label, passed] of Object.entries(report.checks as Record<string, unknown>)) expect(passed, label).toBe(true);
  const family = reports["builder-class-choices-readback.sql"];
  for (const key of ["all_pinned_versions_exact", "feature_grants_exact", "physical_feature_grant_links_exact", "active_feature_projections_exact", "spell_grants_exact",
    "active_spell_grants_projected", "all_choice_checks", "all_child_checks", "all_favored_checks", "all_five_order_bijections", "all_boundaries_closed"]) expect(family[key], key).toBe(true);
  // The earlier family oracle predates source='bonus'. Its row-level exact-pin
  // checks still apply; the source-owned bonus oracle below supplies authority
  // for that additional row family instead of treating it as unknown legacy data.
  for (const row of family.spell_rows as Array<Record<string, unknown>>) {
    expect(row.exact_spell_version).toBe(true);
    if (row.source !== "bonus") expect(row.native_provenance_valid).toBe(true);
  }
  const bonus = reports["builder-bonus-spells-readback.sql"];
  for (const key of ["ordinaryClassListsValid", "allChoicesValid", "allBonusRowsOwned", "parentOrderRevisionEqual"]) expect(bonus[key], key).toBe(true);
  expect(bonus.capsRemaining).toBe(0); expect(bonus.writerReadiness).toBe(0); expect(bonus.classGate).toBe(false); expect(bonus.hitDieGate).toBe(false); expect(bonus.servicePrivateUsage).toBe(false);
  return report;
}
async function rejectOtherAccount(browser: Browser, config: Settings, sheetUrl: string, blocked: string[], errors: string[]) {
  const other = await browser.newContext();
  try {
    await restrictOrigins(other, config, blocked); const page = await other.newPage(); page.on("pageerror", () => errors.push("other-account browser error"));
    await login(page, config, config.other); const response = await page.goto(sheetUrl);
    expect(response?.status()).toBe(404); await expect(page.getByText("This page could not be found.", { exact: true })).toBeVisible();
  } finally { await other.close(); }
}

for (const story of stories) test(`complete SRD ${story.name} level-three caster finishes and reloads all six builder steps`, async ({ page, context, browser }, info) => {
  const config = await settings(), runtime = process.env.INKBORNE_TEST_RUNTIME ? testRuntime() : undefined, blocked: string[] = [], errors: string[] = [];
  await restrictOrigins(context, config, blocked); page.on("pageerror", () => errors.push("owner browser error"));
  console.log(JSON.stringify({ workerPid: process.pid, parentPid: process.ppid, cwd: process.cwd(), startedUtc: new Date().toISOString(), story: `complete-${story.slug}` }));
  await login(page, config, config.owner); expect((await context.cookies()).some(cookie => cookie.name.startsWith("sb-"))).toBe(true);
  await page.locator('a[href="/characters/new"]').first().click();
  const name = `Complete SRD ${story.name} ${randomUUID().slice(0, 8)}`;
  await page.getByRole("textbox", { name: "What will they be called?" }).fill(name);
  await page.getByRole("button", { name: "Open the notebook", exact: true }).click();
  await page.waitForURL(/\/characters\/[0-9a-f-]+\/builder\/first-class$/);
  const characterId = new URL(page.url()).pathname.split("/")[2], sheetUrl = `${config.appOrigin}/characters/${characterId}`, base = sheetUrl + "/builder";
  const checkpoints: string[] = [];
  const checkpoint = async (phase: string) => {
    checkpoints.push(phase);
    await writeFile(info.outputPath("complete-caster-progress.json"), JSON.stringify({ classSlug: story.slug, characterId, name,
      observedUtc: new Date().toISOString(), runtime, actualApp: true, checkpoints, blockedOrigins: blocked, pageErrors: errors }, null, 2));
  };
  await checkpoint("created through authenticated app");
  await page.getByRole("combobox", { name: "First class", exact: true }).selectOption({ label: story.name });
  await page.getByRole("button", { name: "Save first class", exact: true }).click();
  await expect(page.getByText(`${story.name} · Level 1`, { exact: true })).toBeVisible();
  await page.reload(); await page.getByRole("link", { name: "Complete class choices", exact: true }).click();
  await chooseRootClassOptions(page, story); await checkpoint("first class and initial options saved");
  await chooseHumanAbilitiesAndBackground(page, base, story); await checkpoint("Human race, standard array and Acolyte saved and reloaded");
  await chooseLevelThreeOptions(page, base, story); await checkpoint("level three subclass, feature and average HP choices saved");
  await chooseSpells(page, story); await checkpoint("complete class spell choices and allowances saved and reloaded");
  await chooseEquipmentAndDetails(page, base, name);
  if (story.slug === "sorcerer") {
    // Starting awards create unequipped items. The known no-equipped-gear
    // class sidebar must agree with the independently expected sheet scales.
    await page.goto(base + "/class");
    const stats = page.getByRole("heading", { name: "Stats", exact: true }).locator("..");
    await expect(stats.getByText("Armor Class", { exact: true }).locator("..").locator("span").last()).toHaveText("15");
    await page.goto(base + "/details");
  }
  await checkpoint("all six builder steps display Saved");
  const before = await nativeReadback(info, characterId, config.owner.id, "builder-complete");
  await page.getByRole("button", { name: "Review & Finish", exact: true }).click();
  await page.getByRole("button", { name: "Finish & View Character", exact: true }).click();
  await expect(page).toHaveURL(sheetUrl); await inspectSheet(page, story, name); await page.reload(); await inspectSheet(page, story, name);
  const after = await nativeReadback(info, characterId, config.owner.id, "sheet-reloaded");
  expect(after.graphFingerprint, "Reading/reloading a completed sheet must not mutate its source graph").toBe(before.graphFingerprint);
  await rejectOtherAccount(browser, config, sheetUrl, blocked, errors); expect(blocked).toEqual([]); expect(errors).toEqual([]);
  await checkpoint("finished sheet reload and foreign-account refusal passed");
  await page.screenshot({ path: info.outputPath("complete-caster-sheet.png"), fullPage: true });
  const path = info.outputPath("complete-caster-workflow.json");
  await writeFile(path, JSON.stringify({ runtime, actualApp: true, actualAuthCookies: true, actualPostgrest: true, uiWritesOnly: true,
    classSlug: story.slug, subclass: story.subclass, classLevel: 3, characterId, name, race: "Human", background: "Acolyte", standardArray: story.scores,
    allSixBuilderStepsSaved: true, completedSheetReloadPassed: true, foreignAccountRefused: true,
    independent2014Expectations: { cantrips: story.cantrips, ordinarySpells: story.spells, ordinaryKnown: story.known,
      spellbook: story.book, ordinaryPrepared: story.prepared, preparedLimit: story.preparedLimit, fixedGrants: story.fixed ?? [], bonusCantrips: story.bonus ?? [],
      maxHp: story.maxHp, spellDc: story.dc, spellAttack: story.attack, spellSlots: story.slots,
      pactSlots: story.slug === "warlock" ? { count: 2, level: 2 } : null }, blockedOrigins: blocked, pageErrors: errors }, null, 2));
  await info.attach("complete-caster-workflow", { path, contentType: "application/json" });
});
