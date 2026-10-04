import { defineConfig } from "@playwright/test";
// Fully offline: never imports the hosted config, environment or setup/cleanup.
export default defineConfig({
  testDir: ".", testMatch: "*.spec.ts", workers: 1, retries: 0,
  outputDir: "../../test-results/equipment-offline-playwright", timeout: 120000,
  reporter: [["list"]],
});
