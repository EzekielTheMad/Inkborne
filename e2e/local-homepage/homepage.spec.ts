import { expect, test as base, type Page } from "@playwright/test";

const test = base.extend<{ localBrowserEvidence: void }>({
  localBrowserEvidence: [async ({ context, page }, use) => {
    const errors: string[] = [];
    const blockedRequests: string[] = [];
    const mutations: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" || /hydrat|did not match|server rendered HTML/i.test(message.text())) {
        errors.push(message.text());
      }
    });
    await context.route("**/*", async (route) => {
      if (!["GET", "HEAD"].includes(route.request().method())) mutations.push(route.request().method());
      const url = new URL(route.request().url());
      if (["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
        await route.continue();
      } else {
        blockedRequests.push(`${url.origin}${url.pathname}`);
        await route.abort("blockedbyclient");
      }
    });
    await use();
    expect(blockedRequests, "The anonymous homepage must not contact a hosted service").toEqual([]);
    expect(errors, "No browser errors or hydration warnings").toEqual([]);
    expect(mutations, "The public notebook must not write to any service").toEqual([]);
  }, { auto: true }],
});

async function openHomepage(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("homepage")).toBeVisible();
  await expect(page.getByRole("button", { name: "Appearance", exact: true })).toBeEnabled();
}

async function chooseAppearance(page: Page, theme: string) {
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.getByRole("menuitemradio", { name: theme.charAt(0).toUpperCase() + theme.slice(1), exact: true }).click();
  await expect(page.getByRole("menu")).toBeHidden();
}

async function expectTheme(page: Page, theme: "light" | "dark") {
  const document = page.locator("html");
  if (theme === "dark") await expect(document).toHaveClass(/\bdark\b/);
  else await expect(document).not.toHaveClass(/\bdark\b/);

  const logos = page.getByRole("img", { name: "Inkborne", exact: true });
  await expect(logos).toHaveCount(2);
  for (const logo of await logos.all()) {
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute("data-logo-theme", theme);
    await expect(logo).toHaveAttribute("src", theme === "dark" ? /reverse\.svg$/ : /ink\.svg$/);
    await expect.poll(() => logo.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  }
}

test("keeps the notebook story and factual private-alpha copy", async ({ page }) => {
  await openHomepage(page);
  const home = page.getByTestId("homepage");
  await expect(home.getByRole("heading", { level: 1 })).toHaveText(/Your character sheet[\s\S]*character.s story[\s\S]*in the same notebook\./);
  await expect(home).toContainText(/private alpha/i);
  const notebook = home.getByRole("region", { name: "Explore Thalindra’s notebook" });
  for (const [tab, title] of [["Character", "Thalindra Voss"], ["Journal", "The Tolling at Shadepoint"], ["Homebrew", "Lantern of the Lost"]]) {
    await notebook.getByRole("tab", { name: tab, exact: true }).click();
    const panel = notebook.getByRole("tabpanel");
    await expect(panel).toHaveCount(1);
    await expect(panel.getByRole("heading", { name: title })).toBeVisible();
    await expect(panel.locator("figcaption")).toContainText(/fictional/i);
  }
  const illustration = home.getByRole("img", { name: /ink illustration of Thalindra/ });
  await expect.poll(() => illustration.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  await expect(home).not.toContainText(/D&D Beyond|LegendKeeper|From the table|playtest group|custom classes|no syncing|no contradictions|characters made today are kept|self-hostable|offline/i);
  await expect(home.locator('a[href*="character-study"], a[href*="character-preview"]')).toHaveCount(0);
  await expect(home).not.toContainText(/Design study|Character preview/i);
});

test("preserves section links and the real sign-in and signup destinations", async ({ page }) => {
  await openHomepage(page);
  await page.locator('a[href="#features"]').first().click();
  await expect(page).toHaveURL(/\/#features$/);
  await expect(page.locator("#features")).toBeInViewport();
  await page.locator('a[href="#open-source"]').first().click();
  await expect(page).toHaveURL(/\/#open-source$/);
  await expect(page.locator("#open-source")).toBeInViewport();

  await page.goto("/");
  const signIn = page.getByRole("link", { name: /^Sign in/ }).first();
  await expect(signIn).toHaveAttribute("href", "/login");
  await signIn.click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Email", exact: true })).toBeVisible();

  await page.goto("/");
  const start = page.getByRole("link", { name: /^Start building/ }).first();
  await expect(start).toHaveAttribute("href", "/signup");
  await start.click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByRole("heading", { name: "Open a notebook." })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Email", exact: true })).toBeVisible();
});

test("defaults to Dark and persists the accessible keyboard appearance choice", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await openHomepage(page);
  const appearance = page.getByRole("button", { name: "Appearance", exact: true });
  await expect(appearance).toHaveAttribute("data-appearance", "dark");
  await expectTheme(page, "dark");

  await appearance.focus();
  await expect(appearance).toBeFocused();
  await appearance.press("Enter");
  const darkChoice = page.getByRole("menuitemradio", { name: "Dark", exact: true });
  await expect(darkChoice).toHaveAttribute("aria-checked", "true");
  await darkChoice.press("Home");
  const lightChoice = page.getByRole("menuitemradio", { name: "Light", exact: true });
  await expect(lightChoice).toBeFocused();
  await lightChoice.press("Enter");
  await expect(appearance).toHaveAttribute("data-appearance", "light");
  await expectTheme(page, "light");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("inkborne-theme"))).toBe("light");

  await page.reload();
  await expect(appearance).toHaveAttribute("data-appearance", "light");
  await expectTheme(page, "light");
  await chooseAppearance(page, "dark");
  await expectTheme(page, "dark");
  await page.reload();
  await expect(appearance).toHaveAttribute("data-appearance", "dark");
  await expectTheme(page, "dark");
  await appearance.click();
  await page.getByRole("menuitemradio", { name: "Dark", exact: true }).press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(appearance).toBeFocused();
});

test("respects saved Light even when the OS prefers Dark", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("inkborne-theme", "light"));
  await page.emulateMedia({ colorScheme: "dark" });
  await openHomepage(page);
  await expect(page.getByRole("button", { name: "Appearance", exact: true })).toHaveAttribute("data-appearance", "light");
  await expectTheme(page, "light");
});

test("falls back safely for an invalid saved preference", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("inkborne-theme", "unexpected-theme"));
  await page.emulateMedia({ colorScheme: "light" });
  await openHomepage(page);
  await expect(page.getByRole("button", { name: "Appearance", exact: true })).toHaveAttribute("data-appearance", "dark");
  await expectTheme(page, "dark");
});

test("System follows OS changes in both directions and survives a reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await openHomepage(page);
  const appearance = page.getByRole("button", { name: "Appearance", exact: true });
  await chooseAppearance(page, "system");
  await expectTheme(page, "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expectTheme(page, "light");
  await expect(appearance).toHaveAttribute("data-appearance", "system");
  await page.reload();
  await expect(appearance).toHaveAttribute("data-appearance", "system");
  await expectTheme(page, "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expectTheme(page, "dark");
});

test("fits desktop, tablet, and narrow phones in both themes", async ({ page }, testInfo) => {
  await openHomepage(page);
  for (const width of [1440, 840, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["dark", "light"] as const) {
      await chooseAppearance(page, theme);
      await expectTheme(page, theme);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const select = await page.getByRole("button", { name: "Appearance", exact: true }).boundingBox();
      expect(select).not.toBeNull();
      expect(select!.x).toBeGreaterThanOrEqual(0);
      expect(select!.x + select!.width).toBeLessThanOrEqual(width);
      expect(select!.width).toBe(44);
      const header = page.locator("header");
      await expect(header.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
      await expect(header.getByRole("link", { name: "Start building", exact: true })).toHaveCount(0);
      await expect(header.getByRole("combobox")).toHaveCount(0);
      await page.getByRole("button", { name: "Appearance", exact: true }).click();
      const menu = page.getByRole("menu");
      await expect(menu).toBeVisible();
      await expect(menu).toHaveCSS("background-color", theme === "dark" ? "rgb(26, 22, 38)" : "rgb(255, 252, 245)");
      const menuBounds = await menu.boundingBox();
      expect(menuBounds!.x).toBeGreaterThanOrEqual(0);
      expect(menuBounds!.x + menuBounds!.width).toBeLessThanOrEqual(width);
      await menu.press("Escape");
      const notebook = page.getByRole("region", { name: "Explore Thalindra’s notebook" });
      const colorControl = await notebook.getByLabel("Custom accent", { exact: true }).boundingBox();
      expect(colorControl!.x).toBeGreaterThanOrEqual(0);
      expect(colorControl!.x + colorControl!.width).toBeLessThanOrEqual(width);
      for (const tab of ["Character", "Journal", "Homebrew"]) {
        await notebook.getByRole("tab", { name: tab, exact: true }).click();
        const panel = notebook.getByRole("tabpanel");
        await expect(panel).toBeVisible();
        const bounds = await panel.boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
        await expect.poll(() => panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      }
      await notebook.getByRole("tab", { name: "Character", exact: true }).click();
      if (width === 1440 || width === 390) {
        await page.screenshot({
          path: testInfo.outputPath(`homepage-${theme}-${width}.png`),
          fullPage: true,
        });
      }
    }
  }
});

test("notebook bookmarks support pointer and keyboard navigation", async ({ page }) => {
  await openHomepage(page);
  const notebook = page.getByRole("region", { name: "Explore Thalindra’s notebook" });
  const character = notebook.getByRole("tab", { name: "Character", exact: true });
  await character.focus();
  await character.press("ArrowRight");
  const journal = notebook.getByRole("tab", { name: "Journal", exact: true });
  await expect(journal).toBeFocused();
  await expect(journal).toHaveAttribute("aria-selected", "true");
  await expect(notebook.getByRole("tabpanel")).toHaveAccessibleName("Journal");
  await journal.press("End");
  const homebrew = notebook.getByRole("tab", { name: "Homebrew", exact: true });
  await expect(homebrew).toBeFocused();
  await expect(notebook.getByRole("tabpanel")).toHaveAccessibleName("Homebrew");
  await homebrew.press("ArrowRight");
  await expect(character).toBeFocused();
  await character.press("ArrowLeft");
  await expect(homebrew).toBeFocused();
  await homebrew.press("Home");
  await expect(character).toBeFocused();
  await expect(character).toHaveAttribute("aria-selected", "true");
  await character.press("Tab");
  await expect(notebook.getByRole("tabpanel")).toBeFocused();
});

test("character accent follows chapters and themes while global branding stays stable", async ({ page }) => {
  await openHomepage(page);
  const notebook = page.getByRole("region", { name: "Explore Thalindra’s notebook" });
  const appearance = page.getByRole("button", { name: "Appearance", exact: true });
  const globalAction = page.getByRole("link", { name: "Start building", exact: true }).first();
  const original = await globalAction.evaluate((element) => getComputedStyle(element).backgroundColor);
  await notebook.getByRole("radio", { name: "Purple", exact: true }).check();
  for (const tab of ["Character", "Journal", "Homebrew"]) {
    await notebook.getByRole("tab", { name: tab, exact: true }).click();
    await expect(notebook.getByRole("radio", { name: "Purple", exact: true })).toBeChecked();
  }
  expect(await globalAction.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(original);
  await chooseAppearance(page, "light");
  await expect(notebook.getByRole("radio", { name: "Purple", exact: true })).toBeChecked();
  await expect(notebook.getByLabel("Custom accent", { exact: true })).toHaveValue("#7c3aed");
  await expectTheme(page, "light");
  await chooseAppearance(page, "system");
  await page.emulateMedia({ colorScheme: "dark" });
  await expectTheme(page, "dark");
  await expect(notebook.getByRole("radio", { name: "Purple", exact: true })).toBeChecked();
  await page.emulateMedia({ colorScheme: "light" });
  await expectTheme(page, "light");
  await expect(notebook.getByLabel("Custom accent", { exact: true })).toHaveValue("#7c3aed");
  await notebook.getByRole("button", { name: "Use site accent" }).click();
  await expect(notebook.getByRole("radio", { name: "Site gold", exact: true })).toBeChecked();
  await expect(notebook.getByLabel("Custom accent", { exact: true })).toHaveValue("#785923");
  await chooseAppearance(page, "dark");
  await expect(notebook.getByLabel("Custom accent", { exact: true })).toHaveValue("#c9a44a");
  await notebook.getByRole("radio", { name: "Emerald", exact: true }).check();
  await page.reload();
  await expect(notebook.getByRole("radio", { name: "Site gold", exact: true })).toBeChecked();
  await expect(appearance).toHaveAttribute("data-appearance", "dark");
});

test("custom accent extremes retain readable rendered text and selection", async ({ page }) => {
  await openHomepage(page);
  const notebook = page.getByRole("region", { name: "Explore Thalindra’s notebook" });
  const character = notebook.getByRole("tab", { name: "Character", exact: true });
  for (const theme of ["dark", "light"]) {
    await chooseAppearance(page, theme);
    for (const color of ["#ffff00", "#ff0000", "#ffffff", "#000000", "#059669"]) {
      await notebook.getByLabel("Custom accent", { exact: true }).fill(color);
      await expect(notebook.getByLabel("Custom accent", { exact: true })).toHaveValue(color);
      const ratios = await character.evaluate((element) => {
        const luminance = (rgb: string) => {
          const channels = rgb.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((value) => {
            const channel = value / 255;
            return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
          });
          return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
        };
        const contrast = (first: string, second: string) => {
          const a = luminance(first), b = luminance(second);
          return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        };
        const tab = getComputedStyle(element);
        const panel = document.querySelector('[role="tabpanel"]:not([hidden])')!;
        const label = panel.querySelector("h4")!;
        // Walk to the opaque page surface, as the panel itself is transparent.
        let surface: Element | null = panel;
        while (surface && getComputedStyle(surface).backgroundColor === "rgba(0, 0, 0, 0)") surface = surface.parentElement;
        return { tab: contrast(tab.color, tab.backgroundColor), label: contrast(getComputedStyle(label).color, getComputedStyle(surface!).backgroundColor) };
      });
      expect(ratios.tab).toBeGreaterThanOrEqual(4.5);
      expect(ratios.label).toBeGreaterThanOrEqual(4.5);
      await expect(character).toHaveAttribute("aria-selected", "true");
    }
  }
});

test("reduced motion keeps every notebook chapter and accent usable", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openHomepage(page);
  const notebook = page.getByRole("region", { name: "Explore Thalindra’s notebook" });
  await notebook.getByRole("radio", { name: "Emerald", exact: true }).check();
  await notebook.getByRole("tab", { name: "Journal", exact: true }).click();
  await expect(notebook.getByRole("tabpanel")).toContainText("The Tolling at Shadepoint");
  await page.screenshot({ path: testInfo.outputPath("notebook-journal-dark.png"), fullPage: true });
  await chooseAppearance(page, "light");
  await notebook.getByRole("tab", { name: "Homebrew", exact: true }).click();
  await expect(notebook.getByRole("tabpanel")).toContainText("Lantern of the Lost");
  await expect(notebook.getByRole("radio", { name: "Emerald", exact: true })).toBeChecked();
  await page.screenshot({ path: testInfo.outputPath("notebook-homebrew-light.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({ path: testInfo.outputPath("notebook-homebrew-light-mobile.png"), fullPage: true });
  await chooseAppearance(page, "dark");
  await notebook.getByRole("tab", { name: "Journal", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("notebook-journal-dark-mobile.png"), fullPage: true });
});
