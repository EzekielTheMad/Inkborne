import { defineConfig } from "@playwright/test";

// One two-character producer. Mobile reopens the same IDs instead of creating
// another viewport fixture set. The assembled runner invokes Journal afterward.
export default defineConfig({
  testDir: ".", testMatch: "csj-flow.spec.ts", workers: 1, retries: 0, timeout: 900000,
  expect: { timeout: 30000 }, reporter: [["list"]], outputDir: "/output/csj-browser",
  use: { browserName: "chromium", viewport: { width: 1280, height: 900 }, headless: true,
    trace: "off", screenshot: "off", video: "off", actionTimeout: 30000, navigationTimeout: 60000,
    launchOptions: { args: ["--js-flags=--max-old-space-size=512"] } },
});
