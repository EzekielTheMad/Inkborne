import { defineConfig } from "@playwright/test";

// Fully offline: use only local component fixtures, never hosted setup or cleanup.
export default defineConfig({
  testDir: "..",
  testMatch: ["**/local-equipment/*.spec.ts", "**/local-lint/*.spec.ts"],
  workers: 1,
  retries: 0,
  outputDir: "../../test-results/lint-offline-playwright",
  timeout: 120000,
  reporter: [["list"]],
});
