# Real application character saving

Executable checkpoint: `49460f0` on `codex/launch-integration-20261011` in
`C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-verification`.

The requested core flow now passes in the actual Next application against an
isolated local Supabase database, Auth and PostgREST. This supersedes the prior
native-only checkpoint's missing HTTP/browser proof for this finite flow.
Vercel is unchanged; M1–M6/M5.5 remain active and M7/creature imports paused.

## User-visible result

The browser starts unauthenticated and is redirected to sign-in. Actual
email/password sign-in reaches the dashboard; its normal creation link opens
the new-character form without a forced reload. Naming a character creates a
real database row. Selecting Fighter and saving displays the saved class. A
full document reload retains the character name and Fighter at level 1.
Another independently signed-in account receives a 404 for that same notebook.
Confirmed creation/class saves leave neither pending request in session storage.

The first real run exposed a product bug missed by the earlier simulated Auth
events: server-action sign-in changed the cookies/server account but did not
emit browser `SIGNED_IN`, leaving creation on “Checking your signed-in browser
session”. The mounted account boundary now checks the new account through a
fresh browser `getUser()` call. Old leases are invalidated first; unmount,
sign-out or another account transition disqualifies late results. Same-account
refreshes and already established browser sign-in preserve the existing lease;
stale remounts and token refreshes cannot reactivate an ended lease.

The first-class route now reads the saved pinned class through the existing
complete snapshot reader. Confirmed saves refresh that server view, and the
confirmation link returns to it. Incomplete/conflicting saved data retains
recovery controls without showing a successful saved class.

## Focused evidence

- `local-actual-app-20261022T213111Z`: one actual browser story passes in
  16.54 seconds including wrapper overhead (12.4 seconds Playwright). Actual
  Next server actions, SSR cookies, Auth and PostgREST are used, with no mocked
  action, router, Auth response or saved row. All 17 recorded test identities exit.
- `local-app-read-view-20261022T213058Z`: 57 focused page/form/account-boundary
  tests pass; all eight recorded identities exit. Auth/query dependencies in
  these unit tests are doubles, distinct from the actual app story.
- `local-creation-browser-check-20261022T213150Z`: typecheck and zero-warning
  lint pass; all ten recorded identities exit. The full project test suite was
  intentionally not repeated under the user's focused-testing instruction.
- One direct read of the saved target confirms one owned character, level 1,
  action/class/order revisions 1, one Fighter pin, one feature pin, one class
  receipt, one finalized/revision-consumed journal and one observed class proof.
- Independent narrow reviews passed for the saved reader/form and account
  transition. The actual saved-class screenshot was visually inspected.

Evidence is under sibling `equipment-runtime/evidence`. The screenshot is
`test-results/local-app/character-saving-sign-in-c-f7348-e-and-reload-the-actual-app/saved-class-after-reload.png`.
Direct readback is `equipment-runtime/app-flow-runtime/database-readback.json`.
The failed first real run `local-actual-app-20261022T212517Z` retains its stalled
creation DOM in `creation-session-stall.md`; all 22 recorded identities exited.
The earlier page-test parameterization/typecheck failure is preserved in
`local-creation-browser-check-20261022T211830Z`; its corrected tests are included
in the final 57 passing cases.

## Runtime and remaining work

The disposable runtime replayed the existing 83 baseline migrations and 17
stages once. It used two actual local accounts and synthetic parser-valid
Fighter/Second Wind content created through normal content-version triggers.
No character, receipt or snapshot was inserted to simulate a successful save.
This does not establish full SRD catalog, remaining builder steps, gameplay,
class concurrency, browser recovery under a lost response, provider UAT or
hosted acceptance. M1 remains incomplete.

The UI flag was enabled only in the temporary Next process environment against
loopback services. Its repository default, general gates and readiness flags
remain closed. No hosted environment, data, schema, security or Vercel setting
changed, and no push or deployment occurred. Wider writer-fence work remains a
production activation requirement; it did not prevent this controlled local
route from being exercised.

The single story uses the existing npm E2E script with
`--config e2e/local-app/playwright.config.ts` and an explicit restricted local
configuration file supplied via `INKBORNE_LOCAL_FLOW_CONFIG`. It refuses
non-loopback origins and does not import the hosted/default E2E setup. Never run
the default hosted setup as a substitute for this local verification.

Cleanup is verified: all ten recorded Next identities, the proxy, five
containers, two networks and two volumes are absent. Ports 3001/9997/9998/9999
are closed and the three private credential files are removed. The shared
Docker engine and cached images remain. `runtime-teardown-readback.json`, the
Next launch evidence and `resources-after-runtime-cleanup.json` record cleanup
separately from the successful application assertions. The launcher's first
shutdown comparison refused safely because PowerShell had already deserialized
JSON dates; the corrected typed-date/parent comparison stopped only the recorded
identities. Both the refused attempt and successful correction are retained.
