# Auth notebook refresh: dev deployment receipt

23 October 2026. The approved sign-in, signup, recovery/reset, and verification
refresh is deployed to [dev.inkborne.app](https://dev.inkborne.app/login).

## Verified release

- Status: **READY**.
- Environment: **Preview**, assigned to the existing dev custom domain.
- Framework: Next.js **16.2.10**, retaining the dev dependency lockfile.
- Release commit: `99acb2cf4515b8346997849ccafdc081a6f7228f`.
- Remote branch: `fix/builder-ability-save-order`.
- Deployment: `dpl_EXbznyqzLHGXboJSzfFTjfQ1DaLB`.
- Immutable URL: `https://inkborne-47ybxbtet-ezekielthemads-projects.vercel.app`.
- Vercel build-to-ready interval: 47.199 seconds; build logs report the build
  completed in 40 seconds.
- Project: `prj_LWMhTpauZDDqLACtHhvIg6vTQ0W1` (`inkborne`).
- Team: `team_gZZdNu24Ux7R6F93mtOzojtj`.
- Dev alias resolves to this deployment and exact commit.
- Apex `inkborne.app` remains on `dpl_HAxoR5oLVQ23fvsnLETZ6pxwjptA`; remote
  `main` remains `6b8601f976d3ee121d11f2ec33c7383393024b91`.

The [release preparation record](2026-10-23-auth-dev-release.md) contains the
six-file runtime allowlist, independent review, all prepublication commands,
and rollback procedure. Login/signup handlers, callback/signout, origin handling,
Supabase infrastructure, proxy, global/shared theme code, dependencies, database,
and unrelated integration ancestry are preserved. The hosted Discord option
remains enabled by the existing dev configuration; the offline preview did not
enable it. No hosted configuration was changed for this release.

## Validation

- Candidate `npm run check`: typecheck, zero-warning lint, all **202 files /
  1,873 unit tests passed**.
- Candidate production build: passed.
- Candidate local auth browser suite: **5 passed** in 36.2 seconds.
- Candidate local homepage regression suite: **11 passed** in 28.9 seconds.
- Final hosted auth browser suite: **3 passed** in 26.7 seconds.
- Typecheck and zero-warning lint passed again after the hosted fixture repairs.

Hosted checks exercised six auth route variants at 1440, 390, and 320 px in both
themes; actual logo loading; appearance keyboard navigation; saved preference;
System changes and reload; auth cross-page links; no-email verification gating;
and native required validation. All app browser errors/hydration warnings fail
the fixture. The final run reported no unexpected external requests and no
POST/auth mutations.

The initial fresh browser reached the existing Vercel protection gate. Connected
Vercel fetch then returned the expected Inkborne markup with HTTP 200. For browser
verification, the connected integration reused existing temporary dev access;
its private URL was passed through echo-disabled standard input into a child
environment, kept only in memory, and never written to source/diagnostic files.
The fixture validates the exact dev origin, `/login`, and share marker and makes
one GET without redirects to initialize its temporary Vercel cookie. Tracing is
off for private access; no cookie/storage state is saved. Vercel protection and
Inkborne authentication are separate, and neither setting was weakened.

The CDN injects Cloudflare beacon and Vercel toolbar scripts. The smoke fixture
substitutes local empty responses for only those two platform-script patterns, avoiding
telemetry/toolbar traffic. Cloudflare's integrity check correctly rejects the
substitute; only the known substituted URL and computed placeholder digest are
exempted from console failure. All other console/hydration failures and external
traffic remain failures. These are test-only adjustments; no runtime fix or
second deployment was required. Telemetry/toolbar behavior is not verified.

A deployment-scoped Preview error/fatal log-count query over the latest 20 minutes
returned no matching groups after the hosted requests. This is a bounded log
observation, not evidence of provider, email, or account acceptance.

Real sign-in, signup, Google/Discord handoff, email delivery, and password changes
were deliberately not submitted; those remain for user testing. Existing Vercel
access protection still applies, so a fresh browser may request Vercel sign-in.

## Screenshots and local state

Actual deployed pages were captured and visually reviewed:

- [Dark sign in, desktop](../design-briefs/auth-notebook-dev/screenshots/dev-login-dark-1440.png)
- [Light signup, desktop](../design-briefs/auth-notebook-dev/screenshots/dev-signup-light-1440.png)
- [Light recovery, mobile](../design-briefs/auth-notebook-dev/screenshots/dev-recovery-light-390.png)
- [Dark verification, 320 px](../design-briefs/auth-notebook-dev/screenshots/dev-verify-dark-320.png)

All task-owned candidate servers and hosted browser runners have exited. Candidate
port 3193 and SDK placeholder 54999 are closed. The requested local review server
on 3192, PID `191580`, remains running. The whole-computer Node inventory was
30 processes / 2452635648 bytes before validation and 41 / 3306442752 afterward;
other active worktrees contribute to those totals and were preserved. No
remaining candidate listener or hosted runner was found.

This receipt, hosted fixture refinements, screenshots, and brand-status update are
committed locally after verification. They are not a second deployment; the live
release remains `99acb2c`.

Rollback remains a dev-only alias assignment to
`dpl_7g7gQEg35deV8ZJguWJrtN42ZaKT`, followed by repairing the mapped branch before
another push. No rollback was needed.
