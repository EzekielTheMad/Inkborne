import { defineConfig } from "@playwright/test";

// Offline component flow only; never import hosted auth/setup or credentials.
export default defineConfig({
  testDir: ".", testMatch: "journal.spec.ts", workers: 1, retries: 0,
  timeout: 90_000, reporter: [["list"]],
  outputDir: "../../test-results/journal-browser",
});
