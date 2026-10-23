import { defineConfig, devices } from "@playwright/test";

// Anonymous, read-only browser smoke against the dev alias. No Inkborne
// credentials/storage state, setup projects, dotenv, auth-response mocks, or server.
// Optional private Vercel access is kept in process memory; never trace its URL.
export default defineConfig({
  testDir: ".",
  testMatch: "auth-hosted.spec.ts",
  outputDir: "../../test-results/dev-auth",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: [["list"]],
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: "https://dev.inkborne.app",
    trace: process.env.AUTH_SMOKE_ACCESS_URL ? "off" : "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
  },
  projects: [{
    name: "dev-anonymous-chromium",
    use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
  }],
});
