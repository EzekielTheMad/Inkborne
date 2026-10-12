import { defineConfig } from "@playwright/test";
// Dedicated offline entry: no default hosted setup/environment or provider fixtures.
export default defineConfig({ testDir: ".", testMatch: "*.spec.ts", workers: 1, retries: 0, timeout: 180_000,
  outputDir: "../../test-results/traits-offline-playwright", reporter: [["list"]] });
