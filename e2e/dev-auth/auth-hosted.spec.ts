import { expect, test as base, type Page } from "@playwright/test";

const appOrigin = "https://dev.inkborne.app";
const fictionalEmail = "reviewer@example.test";
type ReadOnlyEvidence = { mutations: string[]; external: string[] };

const test = base.extend<{ readOnlyEvidence: ReadOnlyEvidence }>({
  readOnlyEvidence: [async ({ context, page }, use) => {
    const errors: string[] = [];
    const mutations: string[] = [];
    const external: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" || /hydrat|did not match|server rendered HTML/i.test(message.text())) {
        errors.push(message.text());
      }
    });
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const safeMethod = ["GET", "HEAD"].includes(request.method());
      const sameOrigin = url.origin === appOrigin;
      if (!safeMethod) mutations.push(`${request.method()} ${url.origin}${url.pathname}`);
      if (!sameOrigin) external.push(`${request.method()} ${url.origin}${url.pathname}`);
      if (safeMethod && sameOrigin) await route.continue();
      else await route.abort("blockedbyclient");
    });
    await use({ mutations, external });
    expect(mutations, "No auth submission, Server Action POST, or other write was attempted").toEqual([]);
    expect(external, "No external service or provider was contacted").toEqual([]);
    expect(errors, "No console errors, browser errors, or hydration warnings").toEqual([]);
  }, { auto: true }],
});

async function openAuth(page: Page, path: string, title: string) {
  const response = await page.goto(path);
  expect(response?.ok(), `Dev must serve ${path} successfully`).toBe(true);
  expect(new URL(page.url()).origin).toBe(appOrigin);
  await expect(page.getByTestId("auth-notebook")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Appearance", exact: true })).toBeEnabled();
}

async function chooseAppearance(page: Page, theme: "Light" | "Dark" | "System") {
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.getByRole("menuitemradio", { name: theme, exact: true }).click();
  await expect(page.getByRole("menu")).toBeHidden();
}

async function expectTheme(page: Page, theme: "light" | "dark") {
  if (theme === "dark") await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  else await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  const logo = page.getByRole("img", { name: "Inkborne", exact: true });
  await expect(logo).toHaveCount(1);
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute("data-logo-theme", theme);
  await expect(logo).toHaveAttribute("src", theme === "dark" ? /reverse\.svg$/ : /ink\.svg$/);
  await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
}

async function expectFits(page: Page, width: number) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const control of await page.locator("main input, main button, header button").all()) {
    if (!await control.isVisible()) continue;
    const bounds = await control.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
  }
}

test("dev auth routes retain notebook, logos, and responsive light/dark layouts", async ({ page }, testInfo) => {
  const routes = [
    { path: "/login", title: "Welcome back.", shot: "login" },
    { path: "/signup", title: "Open a notebook.", shot: "signup" },
    { path: "/auth/forgot-password", title: "Reset your password.", shot: "recovery" },
    { path: "/auth/reset-password", title: "Set a new password.", shot: "reset" },
    { path: "/auth/verify", title: "We sent you a letter.", shot: "verify-no-email" },
    { path: `/auth/verify?email=${encodeURIComponent(fictionalEmail)}`, title: "We sent you a letter.", shot: "verify" },
  ];
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ["dark", "light"] as const) {
      await openAuth(page, "/login", "Welcome back.");
      await chooseAppearance(page, theme === "dark" ? "Dark" : "Light");
      for (const route of routes) {
        await openAuth(page, route.path, route.title);
        await expectTheme(page, theme);
        await expectFits(page, width);
        if (route.shot === "verify-no-email") {
          await expect(page.getByRole("button", { name: "Resend email", exact: true })).toBeDisabled();
        } else if (route.shot === "verify") {
          await expect(page.getByText(fictionalEmail, { exact: true })).toBeVisible();
          await expect(page.getByRole("button", { name: "Resend email", exact: true })).toBeEnabled();
        }
        if ((width === 1440 && theme === "dark" && route.shot === "login")
          || (width === 1440 && theme === "light" && route.shot === "signup")
          || (width === 390 && theme === "light" && route.shot === "recovery")
          || (width === 320 && theme === "dark" && route.shot === "verify")) {
          await page.screenshot({
            path: testInfo.outputPath(`dev-${route.shot}-${theme}-${width}.png`),
            fullPage: true,
          });
        }
      }
    }
  }
});

test("dev appearance survives keyboard choice, auth navigation, reload, and System changes", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await openAuth(page, "/login", "Welcome back.");
  const appearance = page.getByRole("button", { name: "Appearance", exact: true });
  await expect(appearance).toHaveAttribute("data-appearance", "dark");
  await expectTheme(page, "dark");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to form", exact: true })).toBeFocused();
  await appearance.focus();
  await appearance.press("Enter");
  const dark = page.getByRole("menuitemradio", { name: "Dark", exact: true });
  await expect(dark).toHaveAttribute("aria-checked", "true");
  await dark.press("Home");
  const light = page.getByRole("menuitemradio", { name: "Light", exact: true });
  await expect(light).toBeFocused();
  await light.press("Enter");
  await expectTheme(page, "light");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("inkborne-theme"))).toBe("light");
  await page.getByRole("link", { name: "Begin a notebook", exact: true }).click();
  await expect(page).toHaveURL(`${appOrigin}/signup`);
  await expectTheme(page, "light");
  await page.reload();
  await expectTheme(page, "light");
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: "Forgot?", exact: true }).click();
  await expect(page).toHaveURL(`${appOrigin}/auth/forgot-password`);
  await expectTheme(page, "light");
  await page.getByRole("link", { name: "Back to login", exact: true }).click();
  await expect(page).toHaveURL(`${appOrigin}/login`);
  await chooseAppearance(page, "System");
  await expect(appearance).toHaveAttribute("data-appearance", "system");
  await expectTheme(page, "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expectTheme(page, "dark");
  await page.reload();
  await expect(appearance).toHaveAttribute("data-appearance", "system");
  await expectTheme(page, "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expectTheme(page, "light");
  await appearance.click();
  await page.getByRole("menuitemradio", { name: "System", exact: true }).press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(appearance).toBeFocused();
});

test("dev empty auth forms retain native required validation without a POST", async ({ page, readOnlyEvidence }) => {
  for (const form of [
    { path: "/login", title: "Welcome back.", submit: "Sign in →", first: "Email" },
    { path: "/signup", title: "Open a notebook.", submit: "Create account →", first: "What should we call you?" },
    { path: "/auth/forgot-password", title: "Reset your password.", submit: "Send reset link", first: "Email" },
    { path: "/auth/reset-password", title: "Set a new password.", submit: "Update password", first: "New password" },
  ]) {
    await openAuth(page, form.path, form.title);
    const first = page.getByLabel(form.first, { exact: true });
    await expect(first).toHaveValue("");
    expect(await first.evaluate((input: HTMLInputElement) => input.required && input.validity.valueMissing)).toBe(true);
    // The browser rejects this empty form before any submit handler runs. The
    // network guard still aborts/fails any POST if validation ever regresses.
    await page.getByRole("button", { name: form.submit, exact: true }).click();
    await expect(first).toBeFocused();
    await expect(first).toHaveValue("");
    expect(readOnlyEvidence.mutations).toEqual([]);
    expect(readOnlyEvidence.external).toEqual([]);
  }
});
