# Character sheet refresh: dev deployment receipt

23 October 2026. The approved second sheet composition is deployed to
[dev.inkborne.app](https://dev.inkborne.app/characters).

## Verified release

- Status: **READY**, existing Preview environment and dev custom domain.
- Release commit: `0142f3eb0e6c6ea0e782bb516d309e48991c3627`.
- Remote branch: `fix/builder-ability-save-order`.
- Deployment: `dpl_FANnMYKadWQG66gEbjbCCgmpnJc5`.
- Immutable URL: `https://inkborne-bsm07ja72-ezekielthemads-projects.vercel.app`.
- Project: `prj_LWMhTpauZDDqLACtHhvIg6vTQ0W1` (`inkborne`).
- Team: `team_gZZdNu24Ux7R6F93mtOzojtj`.
- Framework: Next.js **16.2.10**, retaining the current dev lockfile.
- Vercel logs report build completion in 56 seconds. Build-to-ready interval
  from deployment timestamps: 64.484 seconds.
- The dev alias and remote branch resolve to this exact release commit.
- Apex `inkborne.app` remains on `dpl_HAxoR5oLVQ23fvsnLETZ6pxwjptA`; `main`
  remains `6b8601f976d3ee121d11f2ec33c7383393024b91`.

The [release preparation record](2026-10-23-sheet-dev-release.md) records the
29-file runtime allowlist, source adaptation, complete publication action and
rollback procedure. Only the approved visual delta was brought into the dev
baseline. Existing gameplay contracts, persistence calls, auth, root/shared
theme code, dependency lockfile, hosted settings and database remain unchanged.
No newer integration mechanics or print feature was imported.

## Candidate verification

- `npm run check`: typecheck, zero-warning lint, **204 files / 1,902 tests passed**.
- Final production build passed with loopback public placeholders. That local
  build was not uploaded; Vercel built the pushed commit using existing settings.
- Local sheet browser suite: **12 passed**, including six widths, both themes,
  theme/System persistence, custom accent extremes and independent characters,
  HP/temp HP/inspiration, rolls/history, currency/notes, spells, desktop/mobile
  casting, concentration, portals, rest, Narrative and long content.
- Homepage regression suite: **11 passed**; auth regression suite: **5 passed**.
- Final typecheck and zero-warning lint passed after fixture refinements.
- Independent read-only reviews found no blocking issue in runtime scope,
  gameplay preservation, portal behavior or isolated verification boundaries.

The fixture-only weapon range mismatch was corrected as described in the release
record. Production gameplay was not altered to satisfy test data.

## Hosted observations and limits

Connected Vercel fetch checks against the new dev alias returned HTTP 200 for the
homepage, sign-in page, and both Scribe SVG variants. The homepage contains its
fictional notebook example. Sign in contains the expected auth notebook and
welcome heading. An anonymous request to the fictional character route resolves
to sign in, with no character notebook rendered: Inkborne's authentication
boundary remains in place.

A fresh isolated hosted browser reached the existing Vercel access gate, so its
auth smoke suite stopped after the first blocked test; two cases did not run.
External requests from the gate were aborted by the test guard. This is not an
Inkborne page regression or a completed hosted browser pass. The in-app browser
also shows the existing Vercel sign-in gate for the dev character list and is
left open for user sign-in and review.

No access protection was weakened, no new share link/credential was created, and
no account/provider/password/mail or hosted character mutation was submitted.
Authenticated hosted gameplay, saved colors and real-account persistence remain
for user testing. Candidate browser-local persistence proves the scoped client
workflows, not hosted RLS, concurrency or real-account acceptance.

A deployment-scoped Preview error/fatal log-count query covering the latest
15 minutes returned no matching groups after these requests. This is a bounded
observation, not proof of unexercised authenticated workflows.

## Local state and rollback

Candidate Next server PID `120712` (parent `179524`, port 3196) was stopped before
the sheet fixture server. Final fixture PID `76752` (parent `207684`, started
`2026-10-23T22:51:47.286Z`) was stopped after checks. Candidate port **3196 is
closed**. Build, unit and browser workers have exited.

The requested earlier review/reference servers remain: auth 3192/PID `191580`,
sheet 3194/PID `15256`, original comparison 3195/PID `159840`. Their source
worktrees are preserved. The final whole-computer Node inventory was 40 processes
and 1,589,739,520 bytes working set; this includes unrelated work, which was not
stopped. No before/after resource delta is claimed.

Rollback is the dev-only alias assignment to
`dpl_EXbznyqzLHGXboJSzfFTjfQ1DaLB`, followed by repairing the mapped branch before
another push. No rollback was needed. This receipt and the final brand-status
update are local documentation after verification, not a second deployment.
