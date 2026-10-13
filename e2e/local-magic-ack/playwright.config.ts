import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: ".", testMatch: "magic-ack.spec.mjs", workers: 1, retries: 0, timeout: 900_000,
  reporter: "list", outputDir: "../../test-results/magic-ack-playwright" });
