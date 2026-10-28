import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".", testMatch: "character-workflow.spec.ts", workers: 1, retries: 0, timeout: 480000,
  expect: { timeout: 30000 }, reporter: [["list"]], outputDir: "/output/browser",
  use: { browserName: "chromium", headless: true, trace: "off", screenshot: "off", video: "off",
    actionTimeout: 30000, navigationTimeout: 60000, launchOptions: { args: ["--js-flags=--max-old-space-size=512"] } },
});
