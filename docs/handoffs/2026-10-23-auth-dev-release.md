# Auth notebook refresh: scoped dev release

23 October 2026. The user approved the local auth refresh and requested deployment
of sign-in, signup, and recovery pages to `dev.inkborne.app`, preserving existing
authentication behavior. This authorizes this bounded dev release.

## Source and target

- Current hosted dev source: `bc858897648acf6ee70530b23a26d9e5b28dd387`.
- Reviewed local source: `f07c0c5` in `feat/auth-notebook-refresh-20261022`.
- Release branch: `codex/auth-dev-20261023`, using the existing idle isolated
  release checkout `C:\Users\kaios\Documents\Codex\2026-10-22\inkborne-homepage-dev`.
- Existing mapped remote dev branch: `fix/builder-ability-save-order`.
- Vercel team: `team_gZZdNu24Ux7R6F93mtOzojtj`.
- Vercel project: `prj_LWMhTpauZDDqLACtHhvIg6vTQ0W1` (`inkborne`).
- Current dev deployment / rollback target:
  `dpl_7g7gQEg35deV8ZJguWJrtN42ZaKT`,
  `inkborne-rnifn85uz-ezekielthemads-projects.vercel.app`.
- Apex deployment to preserve: `dpl_HAxoR5oLVQ23fvsnLETZ6pxwjptA`.

Live Vercel reads confirmed the project, dev alias, mapped branch, READY Preview
deployment, and exact source SHA. The remote mapped branch still matches it.
The existing Preview environment and dev site origin will be used unchanged.

## Scoped change and dry run

The release contains only these six runtime files from the reviewed local commit:

- `app/(auth)/auth/forgot-password/page.tsx`
- `app/(auth)/auth/reset-password/page.tsx`
- `app/(auth)/auth/verify/page.tsx`
- `components/auth/auth-shell.tsx`
- `components/auth/auth-shell.module.css`
- `components/auth/oauth-buttons.tsx`

The remaining files are auth tests, a loopback-only browser suite, the brand
guide, review references/screenshots, and this release record. The local auth
suite now accepts a validated loopback `E2E_BASE_URL`, allowing the dev candidate
to be tested on port 3193 without reusing the separate review server on 3192.

Independent read-only review confirms that login/signup pages and actions,
callback/signout routes, site-origin handling, Supabase clients/middleware,
proxy, shared theme/menu/UI primitives, global CSS, package/lock files, and
database migrations retain the dev baseline. The approved runtime files match
the local review. The homepage already supplies the required logos and appearance
menu. No root-layout, creation-session, builder, or other integration ancestry is
transplanted; the root creation-boundary test is excluded for the same reason.
The local review used Next 16.3.8; this candidate retains dev's Next 16.2.10 and
will be checked independently.

The complete external change list is one fast-forward push of the verified
candidate to `fix/builder-ability-save-order`. Vercel's existing Git integration
then builds Preview and assigns the existing dev domain. There is no manual
restart/reload, hosted environment change, migration, security-setting change,
production promotion, apex reassignment, account creation, or mail submission.
The local placeholder build is never uploaded.

## Validation, release, and rollback

Run `npm ci --no-audit --no-fund`, `npm run check`, a production build with
loopback public placeholders, and both dedicated local-auth and local-homepage
browser suites on port 3193. Reconfirm remote and alias state immediately before
pushing. A concurrent branch/alias change must be reconciled before release.

After deployment, confirm READY Preview with the exact release SHA. Exercise
anonymous auth routes, new logos, Light/Dark/System, saved preference/reload,
keyboard/mobile bounds, native validation, and homepage navigation. Read-only
hosted checks block unexpected POSTs, SDK requests, and external origins; no real
credentials or hosted account/mail/password changes are used. Confirm the apex
still points to the recorded deployment. Report real sign-in/provider/mail UAT as
unverified for the user to test.

If hosted smoke checks fail, restore only `dev.inkborne.app` to the recorded
rollback deployment and verify it; then repair the mapped branch before another
push. Do not promote or roll back the apex production deployment.

## Candidate results

All candidate checks passed before publication:

- `npm ci --no-audit --no-fund`: installed 814 packages from the unchanged lockfile.
- `VITEST_MAX_WORKERS=4 npm run check`: typecheck and zero-warning lint passed;
  all 202 Vitest files / 1,873 tests passed in 129.38 seconds.
- `npm run build`: Next 16.2.10 production build passed with loopback public
  placeholders (`127.0.0.1:54999` SDK and `127.0.0.1:3193` site origin).
- `E2E_BASE_URL=http://127.0.0.1:3193 npm run test:e2e -- --config e2e/local-auth/playwright.config.ts`:
  all five browser tests passed in 36.2 seconds, including both themes, four
  viewport widths, loaded logos, rendered text/boundary/focus contrast, native
  validation, appearance persistence/System, and simulated recovery/resend states.
- The same command with `e2e/local-homepage/playwright.config.ts`: all 11 homepage
  regression tests passed in 28.9 seconds.
- Independent review found no blocking runtime, auth-contract, dependency,
  integration-scope, local-origin, or hosted read-only test issue.

Playwright managed the temporary candidate servers on port 3193. The auth-suite
server was PID `108656`, parent `99036`, started
`2026-10-23T09:58:08.9209830-07:00`, command
`next start --port 3193 --hostname 127.0.0.1` in the release checkout. Its port
was verified closed before the homepage run. The homepage server was PID `91092`;
it exited before the metadata snapshot, so parent/start time were not captured.
Port 3193 and the SDK placeholder are verified closed after the runs. The separate
review server on 3192 is preserved.

The new `e2e/dev-auth` suite performs only anonymous GET/HEAD requests against the
fixed dev origin, including empty native validation with zero POSTs. It is run
after the new deployment is READY; no hosted test outcome is claimed yet.
The final deployment receipt is recorded after hosted verification.
