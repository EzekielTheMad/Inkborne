import { defineConfig } from "@playwright/test";
// No hosted configuration, global auth setup or data cleanup.
export default defineConfig({
  testDir: ".", testMatch: "*.spec.ts", workers: 1, retries: 0,
  outputDir: "../../test-results/e2e-drift-offline-playwright", timeout: 120000,
  reporter: [["list"]],
});
