import { defineConfig, devices } from "@playwright/test";

// A real anonymous Next.js page, with no hosted setup, account fixtures,
// storage state, dotenv imports, or database cleanup. Run `npm run build` first;
// this suite starts or reuses the production server.
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3190";
const target = new URL(baseURL);
if (target.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname)) {
  throw new Error("The local homepage suite only accepts an HTTP loopback E2E_BASE_URL.");
}
const port = target.port || "80";

export default defineConfig({
  testDir: ".",
  testMatch: "homepage.spec.ts",
  outputDir: "../../test-results/local-homepage",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
  },
  projects: [{ name: "local-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } }],
  webServer: {
    command: `npm run start -- --port ${port} --hostname 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-homepage-public-placeholder-not-a-credential",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
  },
});
