# Bounded acceptance runner

Current runs are closed: all ten fixtures exact-ID cleaned, zero attempts remain. The separate replacement completed the selected state-only matrix; actual Next Back remounted in all 32 cases. See [replacement acceptance](../../docs/handoffs/2026-10-04-replacement-state-controls-acceptance.md). The earlier eight-attempt and ninth journals remain unchanged/exhausted. Each separate state-controls journal permanently allows one reservation, including after cleanup/restart. No deployment or durable roll/equipment/legacy-writer guarantee follows.

This is separate from the legacy smoke suite. It imports neither its setup nor its prefix-wide teardown.
Use existing configured sources and existing approved accounts only. Never copy secrets into a worktree,
print credential values, enroll accounts, or change persistent runner configuration.

Preflight (auth health, two distinct existing account logins, trusted read access; no application fixtures):

```powershell
npm run test:e2e:bounded:runner -- preflight --env-file C:\Projects\Inkborne\.env.local
```

Live browser execution requires current target/fixture approval, a successful contract/account preflight,
installed Chrome, and an unused local port. Set only these non-secret gates before running:

```powershell
$env:INKBORNE_RUNNER_ENV_FILE = 'C:\Projects\Inkborne\.env.local'
$env:INKBORNE_BOUNDED_LIVE_PROJECT = 'etcaodglvcspcmwecyxq'
$env:INKBORNE_BOUNDED_RUN_ID = '<new run UUID>'
$env:E2E_BASE_URL = 'http://localhost:3015'
npm run test:e2e:bounded
```

The process loads only seven allowlisted settings; inherited values take precedence. Configuration
is not persisted. Browser traces, videos and screenshots are disabled. Login failures are sanitized
because Playwright input errors can include supplied values. Secrets remain internal to the runner.

`test-results/bounded-runs/<run UUID>/fixtures.jsonl` is an exclusive, fsynced, append-only journal. A unique
owner/name reservation precedes each creation click. Six attempts are allowed by default, even after restart
or cleanup. An unresolved attempt blocks further creation and cleanup. A stale `.lock` is not removed
automatically; verify that its process has stopped before manually reconciling it. Truncated/invalid
journals fail closed. Retain them for reconciliation instead of starting another run to bypass a budget.

Lost navigation responses trigger a read of only the exact reserved owner/name; one match records its ID.
Zero or multiple matches remain unresolved. Never sweep a prefix or infer cleanup from a failed test.
No automatic deletion occurs in test hooks. Keep the recorded run-owned IDs until cleanup is verified.

Plan exact-ID cleanup separately:

```powershell
npm run test:e2e:bounded:runner -- cleanup-plan --env-file C:\Projects\Inkborne\.env.local --project etcaodglvcspcmwecyxq --run-id '<run UUID>' --manifest 'test-results/bounded-runs/<run UUID>/fixtures.jsonl'
```

After reviewing those IDs under the current deletion authorization, use `cleanup` instead of
`cleanup-plan` and add `--confirm-cleanup-run '<same UUID>'`. If action-time approval rejects deletion,
stop and report that exact scope. Cleanup validates the complete scope against the two approved owners,
reads each exact row's owner/name before deletion, filters deletion by all three, and verifies parent
and character-child absence before writing a cleanup receipt. Ambiguous deletions remain pending.

The `create` project precedes `journey` through an explicit dependency. To continue an already recorded fixture,
use `npm run test:e2e:bounded -- --project journey --no-deps`; grep alone can still run dependencies.
An `audit` runner mode accepts the same project/run/manifest arguments and captures only run-owned child IDs.
DM notes use character_id as their row ID. Browser output clearing cannot remove persistent run journals.

Observed coverage: real login, fresh creation, builder entry/refresh, and a secondary-account update attempt
with owner readback unchanged passed. The fuller existing-SRD builder journey failed on hosted 57014 statement
timeouts after race/class and the first class skill. Later bounded reads succeeded; root cause is unproven.
Full builder-to-sheet, equipment, concurrency and after-commit interruption remain unaccepted. See the
[October 3 handoff](../../docs/handoffs/2026-10-03-bounded-acceptance.md).

October 3 follow-up: desktop builder-to-sheet assertions and persisted equipment/refs passed without a reproduced timeout. The journey suite still failed its mobile name locator; its final visible-text correction is not live-verified. Two of six attempts used, both exact-ID cleaned. See [deduplication handoff](../../docs/handoffs/2026-10-03-request-deduplication.md) for timings and limits.

Historical mobile/private-access checkpoint passed per scenario; three of six attempts used and all cleaned. See [mobile acceptance handoff](../../docs/handoffs/2026-10-03-mobile-access-acceptance.md). The access project depends on journey; for a recorded existing fixture use `npm run test:e2e:bounded -- --project access --no-deps`. It verifies private SDK/browser denials and guarded ability-filter concurrency, restores only recognized fixture state, and creates no new fixture. The current handoff supersedes this historical scope: two-tab gameplay overwrite is now reproduced; durable conflict and ambiguous-write safety remain unaccepted.

## Remaining-only play scope (final fixture held)

INKBORNE_BOUNDED_PLAY_SCOPE=remaining selects the sole remaining play project; run --project remaining with the existing create/journey dependencies. Default full scope selects play instead, never both flavors. Invalid scopes fail. Do not reset the journal or run both flavors on one fixture: replay guards conservatively reject spent dice/roll history. Remaining scope deliberately seeds one spent die as fixture setup, then verifies known rest rejection across real navigation, clean reopen or retained error, one explicit confirmed retry/reload and the two-tab relative-write diagnostic. It does not claim a hit-die action. See [the reviewed plan](../../docs/handoffs/2026-10-03-rest-remount-final-plan.md); the final hosted creation remains held. No automatic retry follows ambiguous outcomes.

The default journal ceiling remains six. The single separately approved seventh attempt requires `INKBORNE_BOUNDED_SEVENTH_APPROVED_RUN_ID` equal to the existing run ID and all six predecessor cleanup receipts. A separately approved eighth attempt requires `INKBORNE_BOUNDED_EIGHTH_APPROVED_RUN_ID` matching the original run and all seven predecessor cleanup receipts. Hard ceiling is eight; no gate permits a ninth. Cleanup can reopen the eight-attempt journal without either creation gate.

`INKBORNE_BOUNDED_PLAY_SCOPE=conditional` selects only the conditional acceptance project, with creation/journey dependencies. Never rerun creation after a committed or ambiguous attempt; continuation must explicitly use the recorded fixture and scope.


`INKBORNE_BOUNDED_PLAY_SCOPE=state-controls` is a dedicated package A scope: only create and state-controls projects, never the old journey/equipment project. Creation additionally requires `INKBORNE_STATE_CONTROLS_APPROVED_RUN_ID` matching the separately approved run ID and an empty `OneAttemptManifest`. Both ninth and replacement journals are consumed and cleaned; setting gates is not approval and cannot revive either. Any future run needs new trusted fixture authorization. Same-fixture continuation must explicitly use `--project state-controls --no-deps`, never creation dependencies. The prepared full matrix is not a claim of acceptance; consult the closed-run handoff for actual evidence.


Explicit same-fixture continuation may set `INKBORNE_STATE_CONTROLS_RESUME_COMPLETED=1` to skip only the latest accepted case receipt. Prior results must match both the run and active recorded character, and default execution does not skip cases. This is an execution checkpoint, not permission to create another fixture or reuse evidence after unrelated product changes. The completed replacement is cleaned and cannot continue. Notes are instrumented separately from conditional writes; the acceptance runner aborts unexpected unconditional browser state writes. Native background-note events under modals are controlled caller stimulation, not a user-accessibility claim.
