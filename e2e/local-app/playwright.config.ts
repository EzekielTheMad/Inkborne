import { defineConfig } from "@playwright/test";

// Existing app and isolated local backend only. No hosted setup/env/cleanup imports.
export default defineConfig({
  testDir: ".", testMatch: "character-saving.spec.ts", workers: 1, retries: 0,
  timeout: 240000, expect: { timeout: 30000 }, reporter: [["list"]],
  outputDir: "../../test-results/local-app/builder-" + new Date().toISOString().replace(/[:.]/g, "-"),
  use: { channel: "chrome", headless: true, actionTimeout: 30000, navigationTimeout: 60000,
    trace: "off", screenshot: "off", video: "off" },
});
