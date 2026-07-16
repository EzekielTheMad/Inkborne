# E2E smoke suite (Playwright)

A smoke net over the core user journey (GAME-PLAN Track A7 /
test-coverage-audit item G1) plus the M3 gameplay UAT — **not** a full E2E
suite:

1. **`auth.setup.ts`** — sign in with email/password via the real login form,
   land on the dashboard. Also saves the authenticated storage state
   (`e2e/.auth/user.json`, gitignored) that the other specs reuse.
2. **`builder.spec.ts`** — create a character through the "New Character" form
   and land in the builder overview.
3. **`sheet.spec.ts`** — seed a fully-built level-1 Fighter directly through
   Supabase and verify the character sheet renders its core elements
   (header identity, saving throws, skills, HP tracker with correct max HP).
4. **`m3-gameplay.spec.ts`** — M3 gameplay UAT (design §10, task T9): seed a
   level-3 Wizard with Magic Missile + Mage Armor and prove casting (slot
   consumption, active effects, AC change), the dice engine (upcast damage
   roll, toast, roll log, `character_rolls` persistence), concentration
   non-firing for non-concentration effects, hit-die spending, and short rest
   with Arcane Recovery. The three scenarios share the character and run in
   serial mode.

The tests run against the **real Supabase backend** — there is no test double.
Every character the suite creates is deleted afterwards (per-spec `afterAll`
cleanup plus a global-teardown sweep of leftover `E2E Smoke*`-named characters
on the test account).

## Running

```bash
npm run test:e2e
```

Playwright's `webServer` starts `npm run dev` on port 3000 automatically (and
reuses an already-running dev server outside CI).

One-time setup: `npm install` then `npx playwright install chromium`.

## Required environment variables

The suite refuses to run without all of these:

| Variable | Source | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` (repo root) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` | Browser/auth client key |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` | Fixture seeding + cleanup — the `characters` table has **no DELETE RLS policy**, so deleting test characters requires the service role. Never exposed to the page. |
| `E2E_TEST_EMAIL` | **runner-supplied** | Test account email |
| `E2E_TEST_PASSWORD` | **runner-supplied** | Test account password |

`playwright.config.ts` loads `.env.local` from the repo root; already-set
environment variables take precedence, so CI can inject everything and skip
the file. **Credentials are never committed** — supply them per run, e.g.
(PowerShell):

```powershell
$env:E2E_TEST_EMAIL = "<test account email>"
$env:E2E_TEST_PASSWORD = "<test account password>"
npm run test:e2e
```

The local test-account credentials are held by Victor (see the untracked
`.continue-here.md` on his machine); ask him — never hardcode or commit them.

## Notes

- The suite runs with `workers: 1` and one retry: it shares a single test
  account against a live backend, and the Supabase free tier can need a couple
  of minutes to resume from pause (global setup polls the auth health endpoint
  for up to 4 minutes before tests start).
- Vitest explicitly excludes `e2e/**`; Playwright specs never run under
  `npx vitest run` and vice versa.
- Test characters are named `E2E Smoke …` so stale leftovers from crashed runs
  are identifiable; the global teardown sweeps them.
