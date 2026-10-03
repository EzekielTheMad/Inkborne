import { type Page } from "@playwright/test";
import { type RunnerSettings } from "./settings";
export async function browserLogin(page: Page, settings: RunnerSettings, account: "primary" | "secondary" = "primary") {
    try {
        await page.goto("/login");
        await page.getByLabel("Email").fill(account === "primary" ? settings.E2E_TEST_EMAIL : settings.E2E_PLAYER_EMAIL);
        await page.getByLabel("Password", { exact: true }).fill(account === "primary" ? settings.E2E_TEST_PASSWORD : settings.E2E_PLAYER_PASSWORD);
        await page.getByRole("button", { name: /sign in/i }).click();
        await page.waitForURL("**/dashboard");
    }
    catch {
        // Prevent automatic failure context from retaining credential input values.
        await page.close().catch(() => { });
        throw new Error("Existing account browser login failed; credential details withheld");
    }
}
