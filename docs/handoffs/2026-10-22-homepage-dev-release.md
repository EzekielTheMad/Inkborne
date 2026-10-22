# Homepage refresh: scoped dev release

22 October 2026. Victor approved the reviewed homepage and requested deployment
to `dev.inkborne.app`. This authorizes this dev release, not an apex production
release or the unrelated integration work on the design branch.

## Source and target

- Existing dev source: `794fd87849b715ee5497599409bc0c0d2f88c1d0`.
- Reviewed design source: `da9b4f6`, following `e6e4ecd`, `736b6d0`, and `7ccfc39`.
- Isolated preparation branch: `codex/homepage-dev-20261022`, based on existing dev.
- Vercel team: `team_gZZdNu24Ux7R6F93mtOzojtj` (EzekielTheMad's projects).
- Vercel project: `prj_LWMhTpauZDDqLACtHhvIg6vTQ0W1` (`inkborne`).
- Existing mapped dev branch: `fix/builder-ability-save-order`.
- Previous dev deployment: `dpl_DhxZx9rpL8Yy4TAd2EunPoUD1Es9`,
  `inkborne-944ak151n-ezekielthemads-projects.vercel.app`.
- Apex deployment to preserve: `dpl_HAxoR5oLVQ23fvsnLETZ6pxwjptA`.

The scoped transplant contains the homepage, shared theme preference handling,
logo/icons, illustration, brand guide/reference assets, and homepage tests.
Package/lock files, global CSS, proxy, auth/data implementations, UI primitives,
and database migrations match existing dev. Independent review found no blocking
scope, dependency, or credential-signature issue. Runtime/test source and binary
assets match the reviewed design source.

## Deployment procedure and rollback

After the isolated checks pass, recheck the remote mapped branch and fast-forward
it from the verified dev source to this release commit. Vercel's existing Git
integration builds a Preview using its existing branch-specific environment,
including the dev site URL, and assigns `dev.inkborne.app`. No manual service
restart, environment change, migration, production promotion, or apex reassignment
is part of this release. The local placeholder build is never uploaded.

Verify the resulting deployment's exact SHA and Preview status, then exercise the
anonymous homepage, images, appearance/reload, notebook chapters and keyboard
navigation, accent/reset, mobile layout, and login navigation. Confirm the apex
still targets the recorded deployment. Do not submit auth forms or create data.

If the dev release fails its smoke checks, restore only `dev.inkborne.app` to the
previous dev deployment above and verify it. Fix the mapped branch before another
push so a future build does not silently replace the rollback.

## Evidence boundary

Isolated validation passed before publication:

- `npm ci --no-audit --no-fund`: 814 packages installed from existing lockfile.
- `VITEST_MAX_WORKERS=4 npm run check`: typecheck and zero-warning lint passed;
  all 200 Vitest files / 1,862 tests passed (101.99 seconds for Vitest).
- `npm run build`: Next.js 16.2.10 production build passed.
- `E2E_BASE_URL=http://127.0.0.1:3191 npm run test:e2e -- --config e2e/local-homepage/playwright.config.ts`:
  all 11 browser tests passed (29.5 seconds).
- Playwright's managed server was PID `66564`, parent `195116`, started
  `2026-10-22T16:06:10.3257610-07:00`, command
  `next start --port 3191 --hostname 127.0.0.1`, in the isolated release worktree.
  Playwright stopped it after the run. Process details are retained in task artifacts.

The original design worktree uses Next.js 16.3.8. This isolated dev candidate keeps
existing Next.js 16.2.10 and is validated separately. Its local build uses loopback
public placeholders, while the hosted build uses the existing Vercel Preview
configuration. No hosted persistence, provider sign-in, or broader app launch
acceptance is claimed. The deployment result and hosted verification are recorded
in a follow-up receipt in the maintained design worktree after completion.
