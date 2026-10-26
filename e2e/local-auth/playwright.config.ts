import { defineConfig, devices } from "@playwright/test";

// Build first with this same loopback SDK placeholder. No hosted setup, dotenv,
// storage state, account fixtures, teardown, or authenticated actions are used.
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3192";
const target = new URL(baseURL);
if (target.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname)) {
  throw new Error("The local auth suite only accepts an HTTP loopback E2E_BASE_URL.");
}
const port = target.port || "80";

export default defineConfig({
  testDir: ".",
  testMatch: "auth.spec.ts",
  outputDir: "../../test-results/local-auth",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: [["list"]],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
  },
  projects: [{
    name: "local-chromium",
    use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
  }],
  webServer: {
    command: `npm run start -- --port ${port} --hostname 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54999",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-auth-review-placeholder-not-a-credential",
      NEXT_PUBLIC_SITE_URL: baseURL,
      INKBORNE_CLASS_ORIGIN_CREATION_UI: "false",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
  },
});
