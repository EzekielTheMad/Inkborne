import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: ".", testMatch: "weapon-ui.spec.ts", outputDir: "../../test-results/canonical-weapon", workers: 1, fullyParallel: false, retries: 0, reporter: "list", use: { channel: "chrome", trace: "off", screenshot: "off", video: "off" } });
