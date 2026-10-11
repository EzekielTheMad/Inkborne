import { defineConfig } from "@playwright/test";

// Offline fixtures only; never imports hosted setup, environment or cleanup.
export default defineConfig({
  testDir: "..",
  testMatch: ["**/local-abilities/*.spec.ts", "**/local-lint/*.spec.ts"],
  workers: 1,
  retries: 0,
  outputDir: "../../test-results/abilities-offline-playwright",
  timeout: 120000,
  reporter: [["list"]],
});
