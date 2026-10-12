import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: ".", testMatch: "print.spec.ts", outputDir: "../../test-results/character-print", workers: 1, fullyParallel: false, retries: 0, reporter: "list", use: { channel: "chrome", trace: "off", screenshot: "off", video: "off" } });
