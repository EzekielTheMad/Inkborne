import { defineConfig, configDefaults } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    // Don't scan git worktrees under .claude/ — they hold full repo copies on
    // other branches, which would run stale/divergent duplicate test files.
    // e2e/ holds Playwright specs (run via `npm run test:e2e`), not vitest tests.
    exclude: [...configDefaults.exclude, ".claude/**", "e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
