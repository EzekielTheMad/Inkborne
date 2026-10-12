import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: ".", testMatch: "slots.spec.ts", outputDir: "../../test-results/r21-slots/browser", workers: 1, fullyParallel: false, retries: 0, reporter: "list", use: { channel: "chrome", trace: "off", screenshot: "off", video: "off" } });
