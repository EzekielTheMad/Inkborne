import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: ".", testMatch: "npc-authoring.spec.ts", workers: 1, retries: 0, timeout: 180_000,
  reporter: "list", outputDir: "../../test-results/npc-authoring-playwright" });
