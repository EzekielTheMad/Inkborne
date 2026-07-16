/**
 * Global setup: validate required env vars and wait for the Supabase project
 * to be reachable. Free-tier Supabase projects pause when idle and take a few
 * minutes to restore — polling the auth health endpoint here keeps that
 * cold-start out of individual test timeouts.
 */
const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY", // cleanup: characters table has no DELETE RLS policy
  "E2E_TEST_EMAIL",
  "E2E_TEST_PASSWORD",
];

const HEALTH_TIMEOUT_MS = 4 * 60_000;
const HEALTH_POLL_INTERVAL_MS = 5_000;

export default async function globalSetup(): Promise<void> {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required env vars for the E2E suite: ${missing.join(", ")}.\n` +
        `See e2e/README.md — Supabase values come from .env.local; ` +
        `E2E_TEST_EMAIL / E2E_TEST_PASSWORD must be supplied by the runner.`,
    );
  }

  const healthUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`;
  const apikey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let lastError = "";

  for (;;) {
    try {
      const res = await fetch(healthUrl, { headers: { apikey } });
      if (res.ok) return;
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `Supabase did not become reachable within ${HEALTH_TIMEOUT_MS / 1000}s ` +
          `(${healthUrl}): ${lastError}. If the project was paused it may still ` +
          `be restoring — wait a few minutes and retry.`,
      );
    }
    console.log(`[e2e] Waiting for Supabase to be reachable (${lastError})...`);
    await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_INTERVAL_MS));
  }
}
