/**
 * Smoke 1 — auth: sign in with email/password via the real login form.
 *
 * Runs as the `setup` project. Besides being the auth smoke test, it saves the
 * authenticated storage state that the builder and sheet smokes reuse (so they
 * don't each repeat the login flow).
 */
import { test as setup, expect } from "@playwright/test";
import { STORAGE_STATE } from "../playwright.config";

setup("signs in with email/password and lands on the dashboard", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email").fill(process.env.E2E_TEST_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.E2E_TEST_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  // Login pushes to /dashboard on success; a slow first Supabase response
  // (project resuming from pause) is covered by the generous timeout.
  await page.waitForURL("**/dashboard", { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: /^Welcome/ })).toBeVisible();
  await expect(page.getByText("Your characters and campaigns.")).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
