import { expect, test as base, type Page } from "@playwright/test";
import { expectAuthFormContrast, expectRenderedContrast } from "./contrast";

const appOrigin = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3192";
const sdkOrigin = "http://127.0.0.1:54999";
const email = "reviewer@example.test";

type AuthMock = {
  endpoint: "recover" | "resend";
  status: number;
  body: Record<string, unknown>;
  wait?: Promise<void>;
};
type MockedRequest = { endpoint: string; url: string; body: Record<string, unknown> };
type OfflineEvidence = { enqueue: (mock: AuthMock) => void; requests: MockedRequest[] };

// Browser interception is the only response source for the two explicitly armed
// SDK calls. Even loopback requests are rejected unless they are app GET/HEAD or
// one of these queued mocks. In particular, no Server Action POST can escape.
const test = base.extend<{ offlineEvidence: OfflineEvidence }>({
  offlineEvidence: [async ({ context, page }, use) => {
    const errors: string[] = [];
    const unexpectedRequests: string[] = [];
    const queue: AuthMock[] = [];
    const requests: MockedRequest[] = [];
    const intentionalHttpErrors = new Set<string>();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      // Chromium reports the deliberately mocked HTTP 400 as a resource error.
      // Exempt only that exact URL; application errors still fail the fixture.
      if (message.type() === "error" && intentionalHttpErrors.has(message.location().url)
        && /^Failed to load resource: the server responded with a status of 400\b/.test(message.text())) return;
      if (message.type() === "error" || /hydrat|did not match|server rendered HTML/i.test(message.text())) {
        errors.push(message.text());
      }
    });
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method();
      const queued = queue[0];
      const isArmedMock = url.origin === sdkOrigin && queued
        && url.pathname === `/auth/v1/${queued.endpoint}`;
      const corsHeaders = {
        "access-control-allow-origin": appOrigin,
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
      };
      if (isArmedMock && method === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      if (isArmedMock && method === "POST") {
        const mock = queue.shift()!;
        requests.push({ endpoint: mock.endpoint, url: url.href, body: request.postDataJSON() as Record<string, unknown> });
        if (mock.status === 400) intentionalHttpErrors.add(url.href);
        if (mock.wait) await mock.wait;
        await route.fulfill({ status: mock.status, headers: corsHeaders, json: mock.body });
        return;
      }
      if (url.origin === appOrigin && ["GET", "HEAD"].includes(method)) {
        await route.continue();
        return;
      }
      unexpectedRequests.push(`${method} ${url.origin}${url.pathname}`);
      await route.abort("blockedbyclient");
    });
    await use({ enqueue: (mock) => queue.push(mock), requests });
    expect(unexpectedRequests, "No hosted requests, unmocked SDK calls, or real form submissions").toEqual([]);
    expect(queue, "Every armed mock must have been exercised").toEqual([]);
    expect(errors, "No application console errors, page errors, or hydration warnings").toEqual([]);
  }, { auto: true }],
});

async function openAuth(page: Page, route: string, heading: string) {
  await page.goto(route);
  await expect(page.getByTestId("auth-notebook")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: heading, exact: true })).toBeVisible();
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
  await expect.poll(() => logo.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
}

async function expectFits(page: Page, width: number) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const controls = page.locator("main input, main button, header button");
  for (const control of await controls.all()) {
    if (!await control.isVisible()) continue;
    const bounds = await control.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
  }
}

test("all auth notebook routes fit desktop and narrow phones in both themes", async ({ page }, testInfo) => {
  const routes = [
    { path: "/login", title: "Welcome back.", shot: "login" },
    { path: "/signup", title: "Open a notebook.", shot: "signup" },
    { path: "/auth/forgot-password", title: "Reset your password.", shot: "recovery" },
    { path: "/auth/reset-password", title: "Set a new password.", shot: "reset" },
    { path: "/auth/verify", title: "We sent you a letter.", shot: "verify-no-email" },
    { path: `/auth/verify?email=${encodeURIComponent(email)}`, title: "We sent you a letter.", shot: "verify-email" },
  ];
  for (const width of [1440, 840, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ["dark", "light"] as const) {
      await page.goto("/login");
      await chooseAppearance(page, theme === "dark" ? "Dark" : "Light");
      for (const route of routes) {
        await openAuth(page, route.path, route.title);
        await expectTheme(page, theme);
        await expectFits(page, width);
        if (width === 1440 && route.shot === "signup") await expectAuthFormContrast(page);
        if ((width === 1440 && theme === "dark" && route.shot === "login")
          || (width === 1440 && theme === "light" && route.shot === "signup")
          || (width === 390 && theme === "light" && route.shot === "recovery")
          || (width === 320 && theme === "dark" && route.shot === "verify-email")) {
          await page.screenshot({ path: testInfo.outputPath(`${route.shot}-${theme}-${width === 1440 ? "desktop" : "mobile"}.png`), fullPage: true });
        }
      }
    }
  }
});

test("appearance supports keyboard, saved preference, System, and auth navigation", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await openAuth(page, "/login", "Welcome back.");
  const appearance = page.getByRole("button", { name: "Appearance", exact: true });
  await expect(appearance).toHaveAttribute("data-appearance", "dark");
  await expectTheme(page, "dark");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to form", exact: true });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
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
  await expect(page).toHaveURL(/\/signup$/);
  await expectTheme(page, "light");
  await page.reload();
  await expectTheme(page, "light");
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: "Forgot?", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/forgot-password$/);
  await expectTheme(page, "light");
  await page.getByRole("link", { name: "Back to login", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
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

test("native form validation and reset mismatch retain inputs without an SDK call", async ({ page, offlineEvidence }, testInfo) => {
  for (const form of [
    { path: "/login", title: "Welcome back.", submit: "Sign in →", first: "Email" },
    { path: "/signup", title: "Open a notebook.", submit: "Create account →", first: "What should we call you?" },
    { path: "/auth/forgot-password", title: "Reset your password.", submit: "Send reset link", first: "Email" },
    { path: "/auth/reset-password", title: "Set a new password.", submit: "Update password", first: "New password" },
  ]) {
    await openAuth(page, form.path, form.title);
    await page.getByRole("button", { name: form.submit, exact: true }).click();
    const first = page.getByLabel(form.first, { exact: true });
    await expect(first).toBeFocused();
    expect(await first.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await chooseAppearance(page, "Light");
  await page.getByLabel("New password", { exact: true }).fill("local-review-password-one");
  await page.getByLabel("Confirm password", { exact: true }).fill("local-review-password-two");
  await page.getByRole("button", { name: "Update password", exact: true }).click();
  await expect(page.getByTestId("auth-notebook").getByRole("alert")).toContainText("Passwords do not match.");
  await expect(page.getByLabel("New password", { exact: true })).toHaveValue("local-review-password-one");
  await expect(page.getByLabel("Confirm password", { exact: true })).toHaveValue("local-review-password-two");
  await expect(page.getByRole("button", { name: "Update password", exact: true })).toBeEnabled();
  await expectFits(page, 390);
  expect(offlineEvidence.requests).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("reset-error-light-mobile.png"), fullPage: true });
});

test("recovery shows pending, retained error, retry, and confirmation using only loopback mocks", async ({ page, offlineEvidence }, testInfo) => {
  await openAuth(page, "/auth/forgot-password", "Reset your password.");
  await page.getByLabel("Email", { exact: true }).fill(email);
  let release = () => {};
  const wait = new Promise<void>((resolve) => { release = resolve; });
  offlineEvidence.enqueue({ endpoint: "recover", status: 400, body: { msg: "Local review: please try again." }, wait });
  try {
    await page.getByRole("button", { name: "Send reset link", exact: true }).click();
    await expect(page.getByRole("button", { name: "Sending...", exact: true })).toBeDisabled();
    await expect(page.getByRole("status")).toContainText("Sending reset link");
    await page.screenshot({ path: testInfo.outputPath("recovery-pending-dark.png"), fullPage: true });
  } finally { release(); }
  await expect(page.getByTestId("auth-notebook").getByRole("alert")).toContainText("Local review: please try again.");
  await expectRenderedContrast(page.getByTestId("auth-notebook").getByRole("alert"));
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email);
  await expect(page.getByRole("button", { name: "Send reset link", exact: true })).toBeEnabled();
  await chooseAppearance(page, "Light");
  await expectRenderedContrast(page.getByTestId("auth-notebook").getByRole("alert"));
  await page.screenshot({ path: testInfo.outputPath("recovery-error-light.png"), fullPage: true });
  offlineEvidence.enqueue({ endpoint: "recover", status: 200, body: {} });
  await page.getByRole("button", { name: "Send reset link", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Check your email for a password reset link.");
  await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
  await expectRenderedContrast(page.getByRole("status"));
  await page.screenshot({ path: testInfo.outputPath("recovery-success-light.png"), fullPage: true });
  await chooseAppearance(page, "Dark");
  await expectRenderedContrast(page.getByRole("status"));
  expect(offlineEvidence.requests).toHaveLength(2);
  for (const request of offlineEvidence.requests) {
    expect(request.endpoint).toBe("recover");
    expect(request.body.email).toBe(email);
    expect(new URL(request.url).searchParams.get("redirect_to")).toBe(`${appOrigin}/auth/reset-password`);
  }
});

test("verification handles absent email and mocked resend pending, error, and success", async ({ page, offlineEvidence }, testInfo) => {
  await openAuth(page, "/auth/verify", "We sent you a letter.");
  await expect(page.getByRole("button", { name: "Resend email", exact: true })).toBeDisabled();
  await expect(page.getByText("Check your inbox for a confirmation link.", { exact: false })).toBeVisible();
  expect(offlineEvidence.requests).toEqual([]);
  await openAuth(page, `/auth/verify?email=${encodeURIComponent(email)}`, "We sent you a letter.");
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  let release = () => {};
  const wait = new Promise<void>((resolve) => { release = resolve; });
  offlineEvidence.enqueue({ endpoint: "resend", status: 400, body: { msg: "Local review: resend is unavailable." }, wait });
  try {
    await page.getByRole("button", { name: "Resend email", exact: true }).click();
    await expect(page.getByRole("button", { name: "Resending...", exact: true })).toBeDisabled();
    await expect(page.getByRole("status")).toContainText("Resending verification email");
    await page.screenshot({ path: testInfo.outputPath("verify-pending-dark.png"), fullPage: true });
  } finally { release(); }
  await expect(page.getByTestId("auth-notebook").getByRole("alert")).toContainText("Local review: resend is unavailable.");
  await expectRenderedContrast(page.getByTestId("auth-notebook").getByRole("alert"));
  await expect(page.getByRole("button", { name: "Resend email", exact: true })).toBeEnabled();
  await chooseAppearance(page, "Light");
  await expectRenderedContrast(page.getByTestId("auth-notebook").getByRole("alert"));
  await page.screenshot({ path: testInfo.outputPath("verify-error-light.png"), fullPage: true });
  offlineEvidence.enqueue({ endpoint: "resend", status: 200, body: {} });
  await page.getByRole("button", { name: "Resend email", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Verification email resent.");
  await expectRenderedContrast(page.getByRole("status"));
  await expect(page.getByRole("button", { name: "Resend email", exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("verify-success-light.png"), fullPage: true });
  expect(offlineEvidence.requests).toHaveLength(2);
  for (const request of offlineEvidence.requests) {
    expect(request.endpoint).toBe("resend");
    expect(request.body).toMatchObject({ email, type: "signup" });
  }
  await page.getByRole("link", { name: "Restart", exact: true }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expectTheme(page, "light");
});
