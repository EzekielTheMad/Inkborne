import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// The Next.js app reads `.env.local` on its own; the E2E helpers (Supabase
// seeding/cleanup) need the same values in the test-runner process, so load it
// here too. Real environment variables win over the file, so CI can inject
// everything without a `.env.local`.
dotenv.config({ path: path.resolve(__dirname, ".env.local"), quiet: true });

/** Storage state produced by e2e/auth.setup.ts and reused by the other smokes. */
export const STORAGE_STATE = path.resolve(__dirname, "e2e/.auth/user.json");
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const DEV_PORT = new URL(BASE_URL).port || "3000";
const VERCEL_BYPASS_SECRET = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  // Smoke net against the real Supabase backend with a single shared test
  // account — run serially so tests never race each other's data.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // One retry absorbs cold-start hiccups (paused Supabase project resuming,
  // first Next.js dev-mode compile of a route).
  retries: 1,
  reporter: [["list"]],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: BASE_URL,
    extraHTTPHeaders: VERCEL_BYPASS_SECRET
      ? {
          "x-vercel-protection-bypass": VERCEL_BYPASS_SECRET,
          "x-vercel-set-bypass-cookie": "true",
        }
      : undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      // Signs in once via the real login form (this IS the auth smoke test)
      // and saves the session for the remaining specs.
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: `npm run dev -- -p ${DEV_PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    // Dev-mode Next.js can take a while on first boot.
    timeout: 180_000,
  },
});
