import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: ".", testMatch: "npc-json.spec.ts", workers: 1, retries: 0, timeout: 180_000,
  reporter: "list", outputDir: "../../test-results/npc-json-playwright" });
