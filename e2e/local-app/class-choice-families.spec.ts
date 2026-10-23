import { test, expect, type BrowserContext, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

type Settings = { appOrigin: string; supabaseOrigin: string; owner: { email: string; password: string }; systemId: string };
type Family = { family: string; characterId: string; name: string; builderUrl: string; sheetUrl: string;
  config: Settings; blockedOrigins: string[]; pageErrors: string[]; checkpoints: string[] };

async function settings(): Promise<Settings> {
  const file = process.env.INKBORNE_LOCAL_FLOW_CONFIG;
  if (!file) throw Error("Provide the isolated local browser configuration file");
  const config = JSON.parse(await readFile(file, "utf8")) as Settings;
  for (const origin of [config.appOrigin, config.supabaseOrigin]) {
    const url = new URL(origin);
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.origin !== origin) {
      throw Error("Class choice workflows require explicit local loopback origins");
    }
  }
  if (!config.owner?.email || !config.owner.password) throw Error("An isolated local owner account is required");
  return config;
}

async function saveThroughApp(page: Page, change: () => Promise<unknown>) {
  const path = new URL(page.url()).pathname;
  const [response] = await Promise.all([
    page.waitForResponse(item => item.request().method() === "POST" && new URL(item.url()).pathname === path), change(),
  ]);
  expect(response.status(), "The actual application save must succeed before reloading").toBe(200);
}

async function choose(page: Page, option: Locator) {
  await saveThroughApp(page, () => option.click());
  await expect(option).toHaveAttribute("aria-pressed", "true");
  await expect(option).toBeEnabled();
}

function group(page: Page, label: string, option?: string): Locator {
  const article = page.getByRole("article").filter({ has: page.getByRole("heading", { name: label, exact: true, level: 4 }) });
  return option ? article.filter({ has: page.getByRole("button", { name: option, exact: true }) }) : article;
}

async function setLevel(page: Page, className: string, level: number) {
  const input = page.getByRole("combobox", { name: `Set level for ${className}`, exact: true });
  await saveThroughApp(page, () => input.selectOption(String(level)));
  await expect(input).toHaveValue(String(level));
  await expect(input).toBeEnabled();
}

async function openLevel(page: Page, level: number) {
  await page.getByRole("button", { name: new RegExp(`^Level ${level}:`) }).click();
  await expect(page.locator('section[aria-labelledby="class-level-title"]').getByRole("navigation", { name: "Breadcrumb", exact: true })).toContainText(`Level ${level}`);
}

async function checkpoint(info: TestInfo, family: Family, label: string, finished = false) {
  family.checkpoints.push(label);
  const path = info.outputPath("family-workflows.json");
  await writeFile(path, JSON.stringify({ family: family.family, characters: [{ characterId: family.characterId, name: family.name }],
    actualApp: true, actualAuthCookies: true, actualPostgrest: true, ordinaryUiSavesOnly: true, draftChoices: true,
    saveReloadPassed: finished, checkpoints: family.checkpoints, blockedOrigins: family.blockedOrigins, pageErrors: family.pageErrors }, null, 2));
  if (finished) {
    expect(family.blockedOrigins).toEqual([]); expect(family.pageErrors).toEqual([]);
    await info.attach("family-workflows", { path, contentType: "application/json" });
  }
}

async function begin(page: Page, context: BrowserContext, info: TestInfo, className: string, familyName: string): Promise<Family> {
  const config = await settings(), blockedOrigins: string[] = [], pageErrors: string[] = [];
  const allowed = new Set([config.appOrigin, config.supabaseOrigin]);
  await context.route("**/*", route => {
    const origin = new URL(route.request().url()).origin;
    if (!allowed.has(origin)) { blockedOrigins.push(origin); return route.abort(); }
    return route.continue();
  });
  page.on("pageerror", () => pageErrors.push("browser error"));
  console.log(JSON.stringify({ workerPid: process.pid, parentPid: process.ppid, cwd: process.cwd(),
    startedUtc: new Date().toISOString(), story: familyName }));
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
  const name = `SRD ${className} choices ${randomUUID().slice(0, 8)}`;
  await page.getByRole("textbox", { name: "What will they be called?" }).fill(name);
  await page.getByRole("button", { name: "Open the notebook", exact: true }).click();
  await page.waitForURL(/\/characters\/[0-9a-f-]+\/builder\/first-class$/);
  const characterId = new URL(page.url()).pathname.split("/")[2];
  const family: Family = { family: familyName, characterId, name, config, blockedOrigins, pageErrors, checkpoints: [],
    builderUrl: `${config.appOrigin}/characters/${characterId}/builder/class`, sheetUrl: `${config.appOrigin}/characters/${characterId}` };
  await checkpoint(info, family, "created through authenticated app");
  await page.getByRole("combobox", { name: "First class", exact: true }).selectOption({ label: className });
  await page.getByRole("button", { name: "Save first class", exact: true }).click();
  await expect(page.getByText(`${className} · Level 1`, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(`${className} · Level 1`, { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Complete class choices", exact: true }).click();
  await openLevel(page, 1);
  return family;
}

async function abilities(page: Page, family: Family, scores: Record<string, string>) {
  await page.goto(`${family.config.appOrigin}/characters/${family.characterId}/builder/abilities`);
  for (const [ability, score] of Object.entries(scores)) {
    await saveThroughApp(page, () => page.getByRole("combobox", { name: `${ability} score`, exact: true }).selectOption(score));
    await expect(page.getByText("Changes save automatically.", { exact: true })).toBeVisible();
  }
  await page.reload();
  for (const [ability, score] of Object.entries(scores)) await expect(page.getByRole("combobox", { name: `${ability} score`, exact: true })).toHaveValue(score);
  await page.goto(family.builderUrl);
}

test("Bard Expertise at three and ten saves and reloads earned skill selections", async ({ page, context }, info) => {
  const family = await begin(page, context, info, "Bard", "bard-expertise");
  const skills = group(page, "Choose 3 proficiency", "Stealth");
  for (const name of ["Arcana", "Perception", "Stealth"]) await choose(page, skills.getByRole("button", { name, exact: true }));
  await page.goto(`${family.config.appOrigin}/characters/${family.characterId}/builder/background`);
  await page.getByRole("button", { name: "Preview Acolyte", exact: true }).click();
  await saveThroughApp(page, () => page.getByRole("button", { name: "Add Background", exact: true }).click());
  await expect(page.getByRole("button", { name: "Change Background", exact: true })).toBeVisible();
  await abilities(page, family, { Strength: "8", Dexterity: "15", Constitution: "14", Intelligence: "13", Wisdom: "12", Charisma: "10" });
  await setLevel(page, "Bard", 3);
  await openLevel(page, 3);
  await choose(page, page.getByRole("button", { name: /^Lore(?:\s|$)/ }));
  const expertise = group(page, "Choose 2 expertise");
  await expect(expertise.getByRole("button", { name: "Athletics", exact: true })).toHaveCount(0);
  for (const name of ["Perception", "Stealth"]) await choose(page, expertise.getByRole("button", { name, exact: true }));
  await page.reload(); await openLevel(page, 3);
  for (const name of ["Perception", "Stealth"]) await expect(expertise.getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true");
  await checkpoint(info, family, "level three Expertise saved and reloaded");
  await setLevel(page, "Bard", 10); await openLevel(page, 10);
  for (const name of ["Perception", "Stealth"]) await expect(expertise.getByRole("button", { name, exact: true })).toHaveCount(0);
  for (const name of ["Arcana", "Insight"]) await choose(page, expertise.getByRole("button", { name, exact: true }));
  await page.reload(); await openLevel(page, 10);
  for (const name of ["Arcana", "Insight"]) await expect(expertise.getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.goto(family.sheetUrl); await page.reload();
  for (const [skill, bonus] of [["Arcana", "+9"], ["Insight", "+9"], ["Perception", "+9"], ["Stealth", "+10"]]) {
    const check = page.getByRole("button", { name: `Roll ${skill} check`, exact: true });
    await expect(check.getByLabel("Expertise", { exact: true })).toBeVisible(); await expect(check).toContainText(bonus);
  }
  await checkpoint(info, family, "level ten Expertise and sheet bonuses reloaded", true);
});

test("Ranger terrain Favored Enemy and Hunter choices save reload and prune on downgrade", async ({ page, context }, info) => {
  const family = await begin(page, context, info, "Ranger", "ranger-terrain-enemies-hunter");
  const skills = group(page, "Choose 3 proficiency");
  for (const name of ["Athletics", "Perception", "Survival"]) await choose(page, skills.getByRole("button", { name, exact: true }));
  const terrain = group(page, "Choose 1 favored terrain");
  await choose(page, terrain.getByRole("button", { name: "Forest", exact: true }));
  const enemy = page.getByRole("article").filter({ has: page.getByRole("button", { name: "Save favored enemy", exact: true }) });
  await enemy.getByRole("combobox", { name: "Favored enemy", exact: true }).selectOption("beasts");
  await saveThroughApp(page, () => enemy.getByRole("button", { name: "Save favored enemy", exact: true }).click());
  await expect(enemy.getByRole("button", { name: "Save favored enemy", exact: true })).toBeEnabled();
  await page.reload(); await openLevel(page, 1);
  await expect(terrain.getByRole("button", { name: "Forest", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(enemy.getByRole("combobox", { name: "Favored enemy", exact: true })).toHaveValue("beasts");
  await expect(enemy.getByRole("combobox", { name: "Language spoken by your favored enemies", exact: true })).toHaveValue("");
  await checkpoint(info, family, "first terrain and enemy reloaded with explicit no-language choice");
  await abilities(page, family, { Strength: "10", Dexterity: "14", Constitution: "13", Intelligence: "12", Wisdom: "15", Charisma: "8" });
  await setLevel(page, "Ranger", 3); await openLevel(page, 3);
  await choose(page, page.getByRole("button", { name: /^Hunter(?:\s|$)/ }));
  await choose(page, group(page, "Choose 1 feature").getByRole("button", { name: "Hunters Prey Colossus Slayer", exact: true }));
  await setLevel(page, "Ranger", 7); await openLevel(page, 7);
  await choose(page, group(page, "Choose 1 feature").getByRole("button", { name: "Defensive Tactics Escape The Horde", exact: true }));
  await page.reload(); await openLevel(page, 7);
  await expect(page.getByRole("button", { name: "Defensive Tactics Escape The Horde", exact: true })).toHaveAttribute("aria-pressed", "true");
  await openLevel(page, 6);
  await expect(terrain.getByRole("button", { name: "Forest", exact: true })).toHaveCount(0);
  await choose(page, terrain.getByRole("button", { name: "Swamp", exact: true }));
  await enemy.getByRole("combobox", { name: "Favored enemy", exact: true }).selectOption("humanoids");
  await enemy.getByRole("combobox", { name: "Humanoid race 1", exact: true }).selectOption("gnoll");
  await enemy.getByRole("combobox", { name: "Humanoid race 2", exact: true }).selectOption("orc");
  await enemy.getByRole("combobox", { name: "Language spoken by your favored enemies", exact: true }).selectOption("orc");
  await saveThroughApp(page, () => enemy.getByRole("button", { name: "Save favored enemy", exact: true }).click());
  await expect(enemy.getByRole("button", { name: "Save favored enemy", exact: true })).toBeEnabled();
  await page.reload(); await openLevel(page, 6);
  await expect(terrain.getByRole("button", { name: "Swamp", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(enemy.getByRole("combobox", { name: "Humanoid race 1", exact: true })).toHaveValue("gnoll");
  await expect(enemy.getByRole("combobox", { name: "Humanoid race 2", exact: true })).toHaveValue("orc");
  await expect(enemy.getByRole("combobox", { name: "Language spoken by your favored enemies", exact: true })).toHaveValue("orc");
  await page.goto(family.sheetUrl); await page.reload();
  const languages = page.getByText("Languages", { exact: true }).filter({ visible: true }).locator("..");
  await expect(languages).toContainText("Orc");
  await page.getByRole("button", { name: "Features", exact: true }).click();
  for (const name of ["Hunter's Prey: Colossus Slayer", "Defensive Tactics: Escape the Horde"]) await expect(page.getByText(name, { exact: true }).filter({ visible: true })).toBeVisible();
  await checkpoint(info, family, "Hunter options and second terrain humanoids language reloaded");
  await page.goto(family.builderUrl); await setLevel(page, "Ranger", 1); await page.reload(); await openLevel(page, 1);
  await expect(page.getByRole("button", { name: /^Level 6:/ })).toHaveCount(0);
  await expect(terrain.getByRole("button", { name: "Forest", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(enemy.getByRole("combobox", { name: "Favored enemy", exact: true })).toHaveValue("beasts");
  await page.goto(family.sheetUrl); await page.reload();
  await expect(page.getByText("Orc", { exact: true }).filter({ visible: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Features", exact: true }).click();
  for (const name of ["Hunter's Prey: Colossus Slayer", "Defensive Tactics: Escape the Horde"]) await expect(page.getByText(name, { exact: true }).filter({ visible: true })).toHaveCount(0);
  await checkpoint(info, family, "downgrade retained first choices and removed unearned source children language", true);
});

test("Sorcerer Draconic Ancestry and distinct Metamagic tiers save and reload", async ({ page, context }, info) => {
  const family = await begin(page, context, info, "Sorcerer", "sorcerer-ancestry-metamagic");
  const skills = group(page, "Choose 2 proficiency");
  for (const name of ["Arcana", "Insight"]) await choose(page, skills.getByRole("button", { name, exact: true }));
  await choose(page, page.getByRole("button", { name: /^Draconic(?:\s|$)/ }));
  await choose(page, group(page, "Choose 1 feature").getByRole("button", { name: /^Dragon Ancestor Gold\s+Fire Damage$/ }));
  await page.reload(); await openLevel(page, 1);
  await expect(page.getByRole("button", { name: /^Dragon Ancestor Gold\s+Fire Damage$/ })).toHaveAttribute("aria-pressed", "true");
  await checkpoint(info, family, "Draconic ancestry saved and reloaded");
  await abilities(page, family, { Strength: "8", Dexterity: "14", Constitution: "13", Intelligence: "12", Wisdom: "10", Charisma: "15" });
  await setLevel(page, "Sorcerer", 3); await openLevel(page, 3);
  const first = group(page, "Choose 2 feature");
  for (const name of ["Metamagic Quickened Spell", "Metamagic Subtle Spell"]) await choose(page, first.getByRole("button", { name, exact: true }));
  await page.reload(); await openLevel(page, 3);
  for (const name of ["Metamagic Quickened Spell", "Metamagic Subtle Spell"]) await expect(first.getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true");
  await setLevel(page, "Sorcerer", 10); await openLevel(page, 10);
  const second = group(page, "Choose 1 feature");
  for (const name of ["Metamagic Quickened Spell", "Metamagic Subtle Spell"]) await expect(second.getByRole("button", { name, exact: true })).toHaveCount(0);
  await choose(page, second.getByRole("button", { name: "Metamagic Careful Spell", exact: true }));
  await page.reload(); await openLevel(page, 10);
  await expect(second.getByRole("button", { name: "Metamagic Careful Spell", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.goto(family.sheetUrl); await page.reload();
  await page.getByRole("button", { name: "Features", exact: true }).click();
  for (const name of ["Dragon Ancestor: Gold - Fire Damage", "Metamagic: Quickened Spell", "Metamagic: Subtle Spell", "Metamagic: Careful Spell"]) {
    await expect(page.getByText(name, { exact: true }).filter({ visible: true })).toBeVisible();
  }
  await checkpoint(info, family, "distinct Metamagic choices at three and ten reloaded as actual child features", true);
});

test("Druid Circle of the Land choice saves and reloads its actual child feature", async ({ page, context }, info) => {
  const family = await begin(page, context, info, "Druid", "druid-land");
  const skills = group(page, "Choose 2 proficiency");
  for (const name of ["Nature", "Perception"]) await choose(page, skills.getByRole("button", { name, exact: true }));
  await abilities(page, family, { Strength: "8", Dexterity: "14", Constitution: "13", Intelligence: "12", Wisdom: "15", Charisma: "10" });
  await setLevel(page, "Druid", 2); await openLevel(page, 2);
  await choose(page, page.getByRole("button", { name: /^Land(?:\s|$)/ }));
  await choose(page, group(page, "Choose 1 feature").getByRole("button", { name: "Circle Of The Land Forest", exact: true }));
  await page.reload(); await openLevel(page, 2);
  await expect(page.getByRole("button", { name: "Circle Of The Land Forest", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.goto(family.sheetUrl); await page.reload();
  await page.getByRole("button", { name: "Features", exact: true }).click();
  await expect(page.getByText("Circle of the Land: Forest", { exact: true }).filter({ visible: true })).toBeVisible();
  await checkpoint(info, family, "land choice and pinned feature saved and reloaded; bonus spells remain separate", true);
});

test("Warlock pact and invocation choices respect saved spell prerequisites capacity and loss", async ({ page, context }, info) => {
  const family = await begin(page, context, info, "Warlock", "warlock-pact-invocations");
  const skills = group(page, "Choose 2 proficiency");
  for (const name of ["Arcana", "History"]) await choose(page, skills.getByRole("button", { name, exact: true }));
  await choose(page, page.getByRole("button", { name: /^Fiend(?:\s|$)/ }));
  await abilities(page, family, { Strength: "8", Dexterity: "14", Constitution: "13", Intelligence: "12", Wisdom: "10", Charisma: "15" });
  await setLevel(page, "Warlock", 2); await openLevel(page, 2);
  let invocations = group(page, "Choose 2 invocation");
  await expect(invocations.getByRole("button", { name: "Eldritch Invocation Agonizing Blast", exact: true })).toHaveCount(0);
  for (const name of ["Eldritch Invocation Armor Of Shadows", "Eldritch Invocation Beguiling Influence"]) await choose(page, invocations.getByRole("button", { name, exact: true }));
  await page.reload(); await openLevel(page, 2);
  for (const name of ["Eldritch Invocation Armor Of Shadows", "Eldritch Invocation Beguiling Influence"]) await expect(invocations.getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true");
  await checkpoint(info, family, "two level-two invocations saved and reloaded without unearned spell option");
  await setLevel(page, "Warlock", 3); await openLevel(page, 3);
  const pact = group(page, "Choose 1 feature");
  await choose(page, pact.getByRole("button", { name: "Pact Of The Blade", exact: true }));
  await setLevel(page, "Warlock", 5); await openLevel(page, 2);
  invocations = group(page, "Choose 3 invocation");
  await choose(page, invocations.getByRole("button", { name: "Eldritch Invocation Thirsting Blade", exact: true }));
  const spells = page.getByRole("form", { name: "Warlock spell choices", exact: true });
  await spells.getByRole("checkbox", { name: "Select Eldritch Blast", exact: true }).check();
  await saveThroughApp(page, () => spells.getByRole("button", { name: /^Save (?:spell choices|spells)$/ }).click());
  await expect(spells.getByText("Spell choices saved.", { exact: true })).toBeVisible();
  await page.reload(); await openLevel(page, 2);
  const armor = invocations.getByRole("button", { name: "Eldritch Invocation Armor Of Shadows", exact: true });
  await saveThroughApp(page, () => armor.click()); await expect(armor).toHaveAttribute("aria-pressed", "false");
  await choose(page, invocations.getByRole("button", { name: "Eldritch Invocation Agonizing Blast", exact: true }));
  await page.reload(); await openLevel(page, 2);
  for (const name of ["Eldritch Invocation Beguiling Influence", "Eldritch Invocation Thirsting Blade", "Eldritch Invocation Agonizing Blast"]) {
    await expect(invocations.getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true");
  }
  await checkpoint(info, family, "level-five capacity pact prerequisite and actual Eldritch Blast knowledge saved and reloaded");
  await openLevel(page, 3);
  const blade = pact.getByRole("button", { name: "Pact Of The Blade", exact: true });
  await saveThroughApp(page, () => blade.click()); await expect(blade).toHaveAttribute("aria-pressed", "false");
  await choose(page, pact.getByRole("button", { name: "Pact Of The Chain", exact: true }));
  await page.reload(); await openLevel(page, 3);
  await expect(pact.getByRole("button", { name: "Pact Of The Chain", exact: true })).toHaveAttribute("aria-pressed", "true");
  await openLevel(page, 2);
  await expect(invocations.getByRole("button", { name: "Eldritch Invocation Thirsting Blade", exact: true })).toHaveCount(0);
  await expect(invocations.getByText("2 / 3 selected", { exact: true })).toBeVisible();
  await page.goto(family.sheetUrl); await page.reload();
  for (const skill of ["Deception", "Persuasion"]) await expect(page.getByRole("button", { name: `Roll ${skill} check`, exact: true }).getByLabel("Proficient", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Features", exact: true }).click();
  await expect(page.getByText("Eldritch Invocation: Thirsting Blade", { exact: true }).filter({ visible: true })).toHaveCount(0);
  await expect(page.getByText("Eldritch Invocation: Beguiling Influence", { exact: true }).filter({ visible: true })).toBeVisible();
  await checkpoint(info, family, "pact replacement pruned only dependent invocation while earned proficiencies reloaded", true);
});
