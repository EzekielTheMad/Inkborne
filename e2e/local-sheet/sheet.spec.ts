import { test as base, expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { expectRenderedContrast } from "./contrast";

const test = base.extend<{ safety: void }>({
  safety: [async ({ page, baseURL }, use) => {
    const external: string[] = [], errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin !== baseURL || !["GET", "HEAD"].includes(route.request().method())) { external.push(`${route.request().method()} ${url.origin}${url.pathname}`); return route.abort(); }
      return route.continue();
    });
    await use();
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
    if (await page.evaluate(() => Boolean(window.sheetReview)).catch(() => false)) expect(await page.evaluate(() => window.sheetReview.unexpected)).toEqual([]);
  }, { auto: true }],
});

async function open(page: Page, kind: "martial" | "caster" = "martial") {
  await page.goto(`/?character=${kind}`);
  await expect(page.getByRole("button", { name: "Change character color" }).filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 }).filter({ visible: true })).toContainText(kind === "martial" ? "Mara Stonepath" : "Iven Lanternkeeper");
  await page.evaluate(() => document.fonts.ready);
}
async function appearance(page: Page, mode: "Light" | "Dark" | "System") {
  const trigger = page.getByRole("button", { name: /appearance/i }).filter({ visible: true });
  await trigger.click();
  await page.getByRole("menuitemradio", { name: mode, exact: true }).click();
  if (mode !== "System") await expect(page.locator("html")).toHaveClass(mode === "Dark" ? /dark/ : /^(?!.*\bdark\b)/);
}
async function visibleButton(page: Page, name: string | RegExp) { return page.getByRole("button", { name, exact: typeof name === "string" }).filter({ visible: true }).first(); }
async function click(page: Page, name: string | RegExp) { await (await visibleButton(page, name)).click(); }
async function state(page: Page) { return page.evaluate(() => window.sheetReview.read()!.state); }
async function closePopup(page: Page) { await page.keyboard.press("Escape"); }
async function tab(page: Page, name: string) {
  const mobile = page.viewportSize()!.width < 768;
  if (mobile) await page.getByRole("navigation").filter({ has: page.getByRole("button", { name: "Stats", exact: true }) }).getByRole("button", { name, exact: true }).click();
  else await click(page, name);
}
async function noHorizontalOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); }
async function screenshot(page: Page, testInfo: TestInfo, name: string) { await page.screenshot({ path: testInfo.outputPath(name), fullPage: true, animations: "disabled" }); }
// The retained dev currency widget autosaves, and its denomination text is a
// paragraph rather than an input label. Do not add newer Save-button behavior.
function goldInput(page: Page) {
  return page.getByText("Currency", { exact: true }).filter({ visible: true }).locator("..").locator('input[type="number"]').nth(1);
}
async function expectCastPortalRoles(page: Page, dialog: Locator) {
  const roles = ["--background", "--foreground", "--character-color", "--character-fg"];
  const expected = await page.locator("[data-character-notebook]").evaluate((node, keys) => keys.map(key => getComputedStyle(node).getPropertyValue(key).trim()), roles);
  const actual = await dialog.evaluate((node, keys) => ({
    roles: keys.map(key => getComputedStyle(node).getPropertyValue(key).trim()),
    scoped: Boolean(node.closest("[data-character-portal]")),
    background: getComputedStyle(node).backgroundColor,
  }), roles);
  expect(actual.roles).toEqual(expected);
  expect(actual.roles[2]).toBe("#2563eb");
  expect(actual.scoped).toBe(true);
  expect(actual.background).not.toBe("rgba(0, 0, 0, 0)");
  await expectRenderedContrast(dialog.getByRole("button", { name: "Cast", exact: true }));
}

test("loaded sheet stays usable at six widths in both modes", async ({ page }, testInfo) => {
  for (const mode of ["Dark", "Light"] as const) {
    for (const width of [1440, 1024, 820, 768, 390, 320]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      await open(page);
      await appearance(page, mode);
      if (width === 1440) {
        await click(page, "Change character color");
        await click(page, "Set character color to Blue");
        await closePopup(page);
      }
      await expect(page.getByRole("tab", { name: "Character Sheet", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Open roll log" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Roll Strength check", exact: true }).filter({ visible: true })).toBeEnabled();
      const logos = page.locator('header img[src*="/brand/"]').filter({ visible: true });
      expect(await logos.count()).toBeGreaterThan(0);
      expect(await logos.evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
      await noHorizontalOverflow(page);
      if (width === 1440 || width === 390) await screenshot(page, testInfo, `sheet-${mode.toLowerCase()}-${width}.png`);
    }
  }
});

test("character accents persist independently, reset to brand default, and follow theme", async ({ page }) => {
  await open(page);
  await appearance(page, "Light"); await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: "light" }); await appearance(page, "System");
  await page.emulateMedia({ colorScheme: "dark" }); await expect(page.locator("html")).toHaveClass(/dark/);
  for (const value of ["#ffffff", "#000000", "#ff00ff"]) {
    await click(page, "Change character color");
    const hex = page.getByPlaceholder("#xxxxxx");
    await hex.fill(value); await hex.press("Enter");
    await expect.poll(() => page.evaluate(() => window.sheetReview.read()!.character.primary_color)).toBe(value);
    await closePopup(page);
    await appearance(page, "Light"); await appearance(page, "Dark");
    await noHorizontalOverflow(page);
  }
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.sheetReview.read()!.character.primary_color)).toBe("#ff00ff");
  await page.getByLabel("Review character").selectOption("caster");
  await expect.poll(() => page.evaluate(() => window.sheetReview.read()!.character.primary_color)).toBe(null);
  await click(page, "Change character color"); await click(page, "Set character color to Emerald"); await closePopup(page);
  await page.getByLabel("Review character").selectOption("martial");
  await expect.poll(() => page.evaluate(() => window.sheetReview.read()!.character.primary_color)).toBe("#ff00ff");
  await click(page, "Change character color"); await click(page, "Reset character color to default"); await closePopup(page);
  await expect.poll(() => page.evaluate(() => window.sheetReview.read()!.character.primary_color)).toBe(null);
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.sheetReview.read()!.character.primary_color)).toBe(null);
});

test("tablet navigation and long administrator names stay reachable", async ({ page }) => {
  for (const width of [768, 820, 1024, 1100, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/?navigation=long-admin");
    await noHorizontalOverflow(page);
    if (width < 1100) {
      await click(page, "Open menu");
      await expect(page.getByRole("link", { name: "Admin", exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
    } else {
      await expect(page.getByRole("link", { name: "Admin dashboard", exact: true })).toBeVisible();
      const groups = await page.locator("header > div > div").filter({ visible: true }).all();
      const left = await groups[0].boundingBox(), right = await groups[1].boundingBox();
      expect(left!.x + left!.width).toBeLessThanOrEqual(right!.x + 1);
    }
  }
});

test("HP, temp HP and inspiration use the existing dev controls", async ({ page }) => {
  await open(page);
  const initial = await state(page);
  await click(page, /Grant inspiration/);
  await expect.poll(async () => (await state(page)).inspiration).toBe(true);
  // HP trigger has the existing accessible label used by the production tracker.
  const hp = page.getByRole("button", { name: "HP tracker — click to heal or damage", exact: true }).filter({ visible: true }).first();
  await hp.click(); await page.getByPlaceholder("Amount").fill("7"); await click(page, "Damage");
  await expect.poll(async () => (await state(page)).current_hp).toBe((initial.current_hp ?? 0) - 3);
  await expect.poll(async () => (await state(page)).temp_hp).toBe(0);
  await hp.click(); await page.getByPlaceholder("Amount").fill("5"); await click(page, "Set Temp HP");
  await expect.poll(async () => (await state(page)).temp_hp).toBe(5);
  await hp.click(); await page.getByPlaceholder("Amount").fill("2"); await click(page, "Heal");
  await expect.poll(async () => (await state(page)).current_hp).toBe((initial.current_hp ?? 0) - 1);
  await click(page, "Remove inspiration");
  await expect.poll(async () => (await state(page)).inspiration).toBe(false);
  await page.reload();
  await expect.poll(async () => (await state(page)).current_hp).toBe((initial.current_hp ?? 0) - 1);
});

test("rolls, inventory currency, quick notes and session notes remain interactive", async ({ page }) => {
  await open(page);
  await click(page, "Roll Strength check");
  await click(page, "Roll");
  await expect.poll(() => page.evaluate(() => window.sheetReview.read()!.rolls.length)).toBe(1);
  await click(page, "Open roll log");
  await expect(page.getByRole("list", { name: "Roll history" })).toContainText("Strength Check");
  await closePopup(page);
  await click(page, "Quick Notes");
  const quick = page.getByPlaceholder("Quick reminders, initiative order, HP tracking...").filter({ visible: true });
  await quick.fill("Keep the lantern lit."); await quick.blur();
  await expect.poll(async () => (await state(page)).quick_notes).toBe("Keep the lantern lit.");
  await tab(page, "Inventory");
  await goldInput(page).fill("53");
  await expect.poll(async () => (await state(page)).currency?.gp).toBe(53);
  await tab(page, "Notes");
  const notes = page.getByPlaceholder("Session notes, story beats, reminders...").filter({ visible: true });
  await notes.fill("Ask about the bridge at Bellmere."); await notes.blur();
  await expect.poll(async () => (await state(page)).notes).toBe("Ask about the bridge at Bellmere.");
  await page.reload();
  await expect.poll(async () => (await state(page)).notes).toBe("Ask about the bridge at Bellmere.");
});

test("caster spell details, slots and narrative editing use real loaded surfaces", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "caster");
  await appearance(page, "Light");
  await click(page, "Change character color"); await click(page, "Set character color to Blue"); await closePopup(page);
  await tab(page, "Spells");
  await expect(page.getByText("Guiding Lantern", { exact: true }).filter({ visible: true })).toBeVisible();
  await click(page, "Mark 1st slot used");
  await expect.poll(async () => (await state(page)).spell_slots_used?.["1"]).toBe(2);
  await page.getByText("Guiding Lantern", { exact: true }).filter({ visible: true }).click();
  await expect(page.getByText("A gentle lantern illuminates a path through the mist.", { exact: true }).filter({ visible: true })).toBeVisible();
  await screenshot(page, testInfo, "sheet-caster-spells.png");
  await click(page, "Cast Guiding Lantern");
  const dialog = page.getByRole("dialog", { name: "Cast: Guiding Lantern", exact: true });
  await expect(dialog).toBeVisible();
  await expectCastPortalRoles(page, dialog);
  await click(page, "Cast");
  await expect.poll(async () => (await state(page)).spell_slots_used?.["1"]).toBe(3);
  await expect.poll(async () => (await state(page)).concentrating_on?.spell_slug).toBe("guiding-lantern");
  await click(page, "Done");
  await page.getByRole("tab", { name: "Narrative", exact: true }).click();
  await expect(page.getByText("The foothill villages of Bellmere")).toBeVisible();
  await click(page, "Edit Character");
  await page.getByLabel("One-Liner", { exact: true }).fill("A lantern for anyone still on the road.");
  await click(page, "Save");
  await expect.poll(() => page.evaluate(() => window.sheetReview.read()!.character.narrative.one_liner)).toBe("A lantern for anyone still on the road.");
  await expect(page.getByText("A lantern for anyone still on the road.", { exact: true })).toBeVisible();
  await screenshot(page, testInfo, "sheet-narrative-light.png");
});

test("portaled color and roll controls inherit character roles", async ({ page }) => {
  await open(page, "caster");
  await appearance(page, "Light");
  await click(page, "Change character color"); await click(page, "Set character color to Blue");
  // The color picker is portaled; inspect its live custom properties rather
  // than assuming descendant CSS can reach it through the React tree.
  const colorPopup = page.getByPlaceholder("#xxxxxx").locator("..").locator("..");
  expect(await colorPopup.evaluate(node => getComputedStyle(node).getPropertyValue("--character-color").trim())).not.toBe("");
  await closePopup(page);
  await click(page, "Roll Intelligence check");
  const rollPopup = page.getByRole("button", { name: "Roll", exact: true }).locator("..");
  expect(await rollPopup.evaluate(node => getComputedStyle(node).getPropertyValue("--character-color").trim())).not.toBe("");
  await closePopup(page);
});

test("rendered accent text, inputs and portal controls remain readable in both modes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  for (const value of ["#ffffff", "#000000", "#ff00ff", "#facc15", "#b91c1c", "#2563eb", "#059669"]) {
    await click(page, "Change character color");
    await page.getByPlaceholder("#xxxxxx").fill(value);
    await page.getByPlaceholder("#xxxxxx").press("Enter");
    await closePopup(page);
    for (const mode of ["Light", "Dark"] as const) {
      await appearance(page, mode);
      const notebook = page.locator("[data-character-notebook]");
      expect(await notebook.evaluate(node => getComputedStyle(node).getPropertyValue("--character-color").trim())).toBe(value);
      await expectRenderedContrast(page.getByRole("heading", { level: 1 }).filter({ visible: true }));
      await expectRenderedContrast(notebook.getByText("Character notebook", { exact: true }).filter({ visible: true }));
      await expectRenderedContrast(notebook.getByText("MS", { exact: true }).filter({ visible: true }));
      await expectRenderedContrast(page.getByRole("button", { name: "Edit", exact: true }).filter({ visible: true }));
      const inspiration = page.getByRole("button", { name: "Grant inspiration", exact: true }).filter({ visible: true });
      await page.getByRole("button", { name: "Change character color" }).filter({ visible: true }).focus();
      await page.keyboard.press("Tab");
      await expect(inspiration).toBeFocused();
      await expectRenderedContrast(inspiration, { focus: true });
      await inspiration.click();
      const activeInspiration = page.getByRole("button", { name: "Remove inspiration", exact: true }).filter({ visible: true });
      await expectRenderedContrast(activeInspiration);
      await activeInspiration.click();
      await expectRenderedContrast(page.getByRole("tab", { name: "Character Sheet", exact: true }));
      await tab(page, "Inventory");
      for (const label of await notebook.locator("label").all()) if (await label.isVisible()) await expectRenderedContrast(label);
      const gold = goldInput(page);
      await gold.focus();
      await expectRenderedContrast(gold, { boundary: true, focus: true });
      await click(page, "Change character color");
      const hex = page.getByPlaceholder("#xxxxxx");
      await hex.focus();
      await expectRenderedContrast(hex, { boundary: true, focus: true });
      await expectRenderedContrast(hex, { placeholder: true });
      await expectRenderedContrast(page.getByRole("button", { name: "Reset character color to default" }));
      await closePopup(page);
      await click(page, "HP tracker — click to heal or damage");
      await expectRenderedContrast(page.getByPlaceholder("Amount"), { boundary: true });
      await expectRenderedContrast(page.getByRole("button", { name: "Damage", exact: true }));
      await closePopup(page);
      await page.getByRole("tab", { name: "Narrative", exact: true }).click();
      for (const card of await notebook.locator(".j-card-paper").all()) await expectRenderedContrast(card);
      await page.getByRole("tab", { name: "Character Sheet", exact: true }).click();
    }
  }
});

test("mobile sections keep one navigation and usable controls, including reduced motion", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "caster");
  await appearance(page, "Light");
  await click(page, "Change character color"); await click(page, "Set character color to Blue"); await closePopup(page);
  const navigation = page.getByRole("navigation", { name: "Sheet sections" });
  for (const name of ["Skills", "Actions", "Spells", "Inventory", "Features", "Notes", "Stats"]) {
    await tab(page, name);
    await expect(navigation.getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("region", { name, exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Character content" })).toBeHidden();
    await noHorizontalOverflow(page);
  }
  await tab(page, "Spells");
  await click(page, "Mark 1st slot used");
  await expect.poll(async () => (await state(page)).spell_slots_used?.["1"]).toBe(2);
  await screenshot(page, testInfo, "sheet-mobile-spells-light.png");
  for (const [index, mode] of (["Light", "Dark"] as const).entries()) {
    await appearance(page, mode);
    await click(page, "Cast Guiding Lantern");
    const dialog = page.getByRole("dialog", { name: "Cast: Guiding Lantern", exact: true });
    await expect(dialog).toBeVisible();
    await expectCastPortalRoles(page, dialog);
    await click(page, "Cast");
    await expect.poll(async () => (await state(page)).spell_slots_used?.["1"]).toBe(3 + index);
    await expect.poll(async () => (await state(page)).concentrating_on?.spell_slug).toBe("guiding-lantern");
    await click(page, "Done");
  }
  await appearance(page, "Light");
  await tab(page, "Inventory");
  await goldInput(page).fill("61");
  await expect.poll(async () => (await state(page)).currency?.gp).toBe(61);
  await tab(page, "Stats");
  await click(page, "HP tracker — click to heal or damage");
  await page.getByPlaceholder("Amount").fill("3"); await click(page, "Heal");
  await expect.poll(async () => (await state(page)).current_hp).toBe(26);
});

test("death-save pips retain visible filled and empty states in both themes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await click(page, "HP tracker — click to heal or damage");
  await page.getByPlaceholder("Amount").fill("99"); await click(page, "Damage");
  await expect.poll(async () => (await state(page)).current_hp).toBe(0);
  for (const mode of ["Light", "Dark"] as const) {
    await appearance(page, mode);
    for (const pip of await page.getByRole("button", { name: /^(Success|Failure) [123] \((filled|empty)\)$/ }).filter({ visible: true }).all()) {
      await expectRenderedContrast(pip, { graphical: true, boundary: true });
    }
  }
  await click(page, "Success 1 (empty)");
  await expect.poll(async () => (await state(page)).death_saves?.successes).toBe(1);
  await click(page, "Failure 1 (empty)");
  await expect.poll(async () => (await state(page)).death_saves?.failures).toBe(1);
  for (const mode of ["Light", "Dark"] as const) {
    await appearance(page, mode);
    for (const pip of await page.getByRole("button", { name: /^(Success|Failure) [123] \((filled|empty)\)$/ }).filter({ visible: true }).all()) {
      await expectRenderedContrast(pip, { graphical: true, boundary: true });
    }
  }
});

test("rest dialog fits desktop and mobile and retains the long-rest action", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const mode of ["Light", "Dark"] as const) {
      await appearance(page, mode);
      await click(page, "Rest");
      const dialog = page.getByRole("dialog", { name: "Rest", exact: true });
      await expect(dialog).toBeVisible();
      expect(await dialog.evaluate(node => {
        const bounds = node.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight;
      })).toBe(true);
      const spend = page.getByRole("button", { name: "Spend & Roll", exact: true });
      expect(await spend.evaluate(node => {
        const bounds = node.getBoundingClientRect(), section = node.closest("section")!.getBoundingClientRect();
        return bounds.left >= section.left && bounds.right <= section.right;
      })).toBe(true);
      await expectRenderedContrast(page.getByRole("button", { name: "Take Long Rest", exact: true }));
      if (width === 390 && mode === "Light") await screenshot(page, testInfo, "sheet-rest-mobile-light.png");
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
    }
  }
  await click(page, "Rest"); await click(page, "Take Long Rest");
  await expect(page.getByRole("dialog", { name: "Rest", exact: true })).toBeHidden();
  await expect.poll(async () => (await state(page)).current_hp).toBe(38);
  await expect.poll(async () => (await state(page)).temp_hp).toBe(0);
  await expect.poll(async () => (await state(page)).hit_dice_spent?.fighter).toBe(0);
});

test("long character identity and story content wrap at the smallest review width", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await open(page);
  await page.evaluate(() => {
    const record = window.sheetReview.read()!;
    record.character.name = "Seraphina Amberweather of the Seven Lanterns, Keeper of the Northern Road";
    record.character.narrative_rich.backstory_origin = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "The old road winds through Bellmere. Travelers leave a lantern at each crossing and record the names of everyone who helped them home. ".repeat(15) }] }] };
    localStorage.setItem(`inkborne-dev-sheet-review-v1:${record.character.id}`, JSON.stringify(record));
  });
  await page.reload();
  for (const mode of ["Light", "Dark"] as const) {
    await appearance(page, mode);
    await expect(page.getByRole("heading", { level: 1 }).filter({ visible: true })).toContainText("Keeper of the Northern Road");
    await noHorizontalOverflow(page);
    await page.getByRole("tab", { name: "Narrative", exact: true }).click();
    await expect(page.getByText("The old road winds through Bellmere.", { exact: false })).toBeVisible();
    await noHorizontalOverflow(page);
  await page.getByRole("tab", { name: "Character Sheet", exact: true }).click();
  }
});
