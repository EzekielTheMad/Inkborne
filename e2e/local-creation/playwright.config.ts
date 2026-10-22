import { defineConfig } from "@playwright/test";
// Separate offline entrypoint: no hosted config, setup, env or cleanup imports.
export default defineConfig({
  testDir: ".", testMatch: "*.spec.ts", workers: 1, retries: 0, timeout: 120000,
  outputDir: "../../test-results/creation-offline-playwright", reporter: [["list"]],
});
