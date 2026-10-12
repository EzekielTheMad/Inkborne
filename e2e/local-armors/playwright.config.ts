import { defineConfig } from "@playwright/test";

// Never imports hosted setup, cleanup, credentials, or environment files.
export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 120_000,
  outputDir: "../../test-results/armors-offline-playwright",
  reporter: [["list"]],
});
