import { defineConfig, devices } from "@playwright/test";
import { readRunnerSettings, requireLiveGate } from "./settings";
import { BROWSER_OUTPUT_DIR } from "./run-paths";
requireLiveGate(process.env.INKBORNE_BOUNDED_LIVE_PROJECT, process.env.INKBORNE_BOUNDED_RUN_ID);
const envFile = process.env.INKBORNE_RUNNER_ENV_FILE;
if (!envFile)
    throw new Error("An existing approved runner configuration path is required");
const settings = readRunnerSettings(envFile);
// Process-local only. Browser bundles expose only Next's NEXT_PUBLIC_* settings.
for (const [name, value] of Object.entries(settings))
    process.env[name] = value;
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3015";
const url = new URL(baseURL);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.port || url.pathname !== "/" || url.search || url.hash || url.username || url.password)
    throw new Error("Bounded browser acceptance requires an explicit local origin");
export default defineConfig({
    testDir: "./specs", outputDir: BROWSER_OUTPUT_DIR, workers: 1, fullyParallel: false, retries: 0,
    timeout: 120000, expect: { timeout: 20000 }, reporter: [["list"]],
    // No old global setup, prefix teardown, storage-state files, traces or credential screenshots.
    use: { ...devices["Desktop Chrome"], channel: "chrome", baseURL, trace: "off", screenshot: "off", video: "off" },
    projects: [
        { name: "create", testMatch: /builder\.spec\.ts/ },
        { name: "journey", testMatch: /journey\.spec\.ts/, dependencies: ["create"] },
        { name: "access", testMatch: /access\.spec\.ts/, dependencies: ["journey"] },
    ],
    webServer: { command: `npm run dev -- -p ${url.port}`, cwd: "../..", url: baseURL, reuseExistingServer: false, timeout: 180000 },
});
