import { defineConfig } from "@playwright/test";

// Source-reviewed offline authoring only. No default hosted/auth setup or env.
export default defineConfig({
  testDir: ".", testMatch: "*.spec.ts", workers: 1, retries: 0, timeout: 240_000,
  outputDir: "../../test-results/monster-authoring-offline-playwright", reporter: [["list"]],
});
