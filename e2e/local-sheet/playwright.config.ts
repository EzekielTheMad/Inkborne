import { defineConfig } from "@playwright/test";

// No environment-file loading, global auth setup, hosted user, or data cleanup.
// The review server bundles the actual client UI with explicit local adapters.
export default defineConfig({
  testDir: ".", testMatch: "sheet.spec.ts", outputDir: "../../test-results/local-sheet",
  workers: 1, fullyParallel: false, retries: 0, forbidOnly: true,
  timeout: 90_000, expect: { timeout: 10_000 }, reporter: "list",
  use: { baseURL: "http://127.0.0.1:3196", channel: "chrome", trace: "retain-on-failure", screenshot: "only-on-failure", video: "off", viewport: { width: 1440, height: 1000 } },
  webServer: { command: "node scripts/serve-sheet-review.mjs", url: "http://127.0.0.1:3196/", reuseExistingServer: true, timeout: 60_000 },
});
