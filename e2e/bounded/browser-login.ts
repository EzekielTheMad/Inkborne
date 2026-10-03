import { type Page } from "@playwright/test";
import { type RunnerSettings } from "./settings";
export async function browserLogin(page: Page, settings: RunnerSettings) {
    try {
        await page.goto("/login");
        await page.getByLabel("Email").fill(settings.E2E_TEST_EMAIL);
        await page.getByLabel("Password", { exact: true }).fill(settings.E2E_TEST_PASSWORD);
        await page.getByRole("button", { name: /sign in/i }).click();
        await page.waitForURL("**/dashboard");
    }
    catch {
        // Prevent automatic failure context from retaining credential input values.
        await page.close().catch(() => { });
        throw new Error("Existing account browser login failed; credential details withheld");
    }
}
