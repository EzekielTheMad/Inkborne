import { defineConfig } from "@playwright/test";

// Isolated source-reviewed harness only; never imports hosted setup/environment.
export default defineConfig({
  testDir: ".", testMatch: "*.spec.ts", workers: 1, retries: 0, timeout: 180_000,
  outputDir: "../../test-results/monsters-offline-playwright", reporter: [["list"]],
});
