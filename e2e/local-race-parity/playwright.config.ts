import { defineConfig } from "@playwright/test";

// Isolated offline entry: never imports hosted setup/env/default config.
export default defineConfig({ testDir: ".", testMatch: "*.spec.ts", workers: 1, retries: 0,
  timeout: 180_000, outputDir: "../../test-results/race-parity-offline-playwright", reporter: [["list"]] });
