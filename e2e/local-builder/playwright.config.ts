import { defineConfig } from "@playwright/test";

// Local rendered components and simulated persistence; no hosted setup or data.
export default defineConfig({ testDir: ".", testMatch: "*.spec.ts", workers: 1, retries: 0, timeout: 180000,
  outputDir: "../../test-results/builder-dropdowns-playwright-" + new Date().toISOString().replace(/[:.]/g, "-"), reporter: [["list"]] });
