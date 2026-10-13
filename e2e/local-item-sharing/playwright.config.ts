import { defineConfig } from "@playwright/test";
// The outer budget includes full installed-file proofs before imports and after
// teardown. Individual form/response assertions keep their existing time limits.
export default defineConfig({ testDir: ".", testMatch: "item-sharing.spec.ts", workers: 1, retries: 0, timeout: 600_000, reporter: "list", outputDir: "../../test-results/item-sharing-playwright" });
