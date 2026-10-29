import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "..", testMatch: ["local-app/complete-caster-builders.spec.ts", "local-app/complete-martial-builders.spec.ts",
    "unraid/ancestry-builders.spec.ts", "local-app/mixed-caster-builders.spec.ts", "local-app/earned-racial-spell-builders.spec.ts"],
  workers: 1, retries: 0, timeout: 480000, expect: { timeout: 30000 }, reporter: [["list"]], outputDir: "/output/builders",
  use: { browserName: "chromium", headless: true, trace: "off", screenshot: "off", video: "off", actionTimeout: 30000,
    navigationTimeout: 60000, launchOptions: { args: ["--js-flags=--max-old-space-size=512"] } },
});
