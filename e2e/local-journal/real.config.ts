import { defineConfig } from "@playwright/test";

// Requires the separately coordinated disposable Unraid fixture package.
// No hosted setup, environment import, webServer or automatic fixture creation.
export default defineConfig({
  testDir: ".", testMatch: "real-journal.spec.ts", workers: 1, retries: 0,
  timeout: 240_000, expect: { timeout: 30_000 }, reporter: [["list"]],
  outputDir: "/output/journal",
  use: { browserName: "chromium", headless: true, trace: "off", screenshot: "off", video: "off",
    actionTimeout: 30_000, navigationTimeout: 60_000,
    launchOptions: { args: ["--js-flags=--max-old-space-size=512"] } },
});
