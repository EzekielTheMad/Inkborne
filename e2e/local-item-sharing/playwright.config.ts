import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: ".", testMatch: "item-sharing.spec.ts", workers: 1, retries: 0, timeout: 240_000, reporter: "list", outputDir: "../../test-results/item-sharing-playwright" });
