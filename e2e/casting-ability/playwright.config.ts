import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: ".", testMatch: "casting-ability.spec.ts", outputDir: "../../test-results/r21-ability/browser", workers: 1, fullyParallel: false, retries: 0, reporter: "list", use: { channel: "chrome", trace: "off", screenshot: "off", video: "off" } });
