import { defineConfig } from "@playwright/test";

// Existing app and isolated local backend only. No hosted setup/env/cleanup imports.
export default defineConfig({
  testDir: ".", testMatch: ["character-saving.spec.ts", "real-catalog-builder.spec.ts", "class-choice-families.spec.ts", "bonus-spell-choices.spec.ts", "fiend-and-class-removal.spec.ts", "builder-save-recovery.spec.ts", "subclass-content-update.spec.ts", "complete-caster-builders.spec.ts", "draconic-resilience.spec.ts", "complete-martial-builders.spec.ts", "ancestry-hit-points.spec.ts", "mixed-caster-builders.spec.ts"], workers: 1, retries: 0,
  timeout: 240000, expect: { timeout: 30000 }, reporter: [["list"]],
  outputDir: "../../test-results/local-app/builder-" + new Date().toISOString().replace(/[:.]/g, "-"),
  use: { channel: "chrome", headless: true, actionTimeout: 30000, navigationTimeout: 60000,
    // Per-renderer V8 old-generation bound for this disposable local profile.
    // Native/DOM/young-generation memory remains subject to the outer OS guard.
    launchOptions: { args: ["--js-flags=--max-old-space-size=512"] },
    trace: "off", screenshot: "off", video: "off" },
});
