# Inkborne cutoff checkpoint - October 2, 2026

> Historical milestone record. Counts/status describe this checkpoint. Use [CURRENT-STATE](../CURRENT-STATE.md) and the [release checklist](../RELEASE-READINESS.md) for current authority.

Prepared after restored-source verification around 17:27 UTC for the requested 18:00 UTC cutoff
(literal 10 a.m. PST). Source development stopped at 17:25 UTC. Branch:
`codex/playable-core-stability`; verified source: `1f4967f96c8d01447256280d98b65352f481a85d`. Later
commits consolidate documentation only. The final response supplies exact final branch HEAD.

## Outcome

The independent P1 numeric relative-HP and P2 retained React Activity findings are fixed with actual
provider/dialog dependency regressions. State-dependent actions reject busy/stale state before
rolls/spends; independent absolute edits remain supported. Hidden sessions retain success/failure
and reconcile once on return without repeating persistence.

Builder continuation repaired local overlapping saves, pinned definition display, explicit choice
progress/recovery, first-level choices without feature rows, failed incremental HP rollback, mobile
save feedback, Manual validation, deterministic HP confirmation, HP gain display and the rolled-only
Manual field boundary. Narrative/worldbuilding and LegendKeeper integration remain intact. This is
local work, not release certification.

The last failed-note/background-replacement guard passed temporary unit/check/build verification but
failed clean Chrome visibility checks. All three uncommitted files for that attempt were restored to
HEAD. The [cutoff review](2026-10-02-cutoff-review.md) records the remaining issue and failed
attempt. No newest unverified change remains in source.

## Final evidence

| Command | Result |
| --- | --- |
| `npm.cmd run check` | Strict types; zero-warning lint; 203 files / 1,968 tests passed |
| `npm.cmd run build` | Next 16.2.10 compile, TypeScript and 24 static pages passed |
| `node scripts/verify-builder-local.mjs` | 19 simulated installed-Chrome checks passed |
| `node scripts/verify-play-save-local.mjs` | 5 simulated installed-Chrome critical play checks passed |
| `git diff --check` | Passed; source clean before documentation-only handoff |

Final logs under `C:/Users/kaios/AppData/Local/Temp/`: `inkborne-final-check.txt`,
`inkborne-final-build.txt`, `inkborne-final-builder-browser.txt`; critical play log
`inkborne-browser.txt`. Test log clocks are about seven hours behind UTC; tool UTC time was used for
checkpoints.

Artifacts: `test-results/builder-local/evidence.json`, `test-results/play-save-local/evidence.json`
and screenshots in each folder. Fixtures use real components/React Activity with mocked
persistence/router, production CSS and installed Chrome. Final evidence has no page errors or remote
attempts. These do not exercise live Next/auth/RLS/Supabase. Hosted Playwright setup writes to
Supabase and was not run. Builds use loopback public placeholders; dependencies were reused with
matching manifests, no install. Fresh installation, deployment, privacy/security and production
acceptance remain unverified.

## Prioritized next task and blockers

1. **Next local task:** finish the failed-note -> background-replacement recovery case in the cutoff
   review. Preserve the draft and require clean real-control/browser verification. Do not add
   discard/product behavior without the parent.
2. Validate required per-level/ASI/category-backed choices and missing/retired/orphan references.
   Current Complete covers core saved identities and explicit arrays, not full readiness.
3. Before approved hosted/schema implementation, reconcile migration history and review equipment
   provenance/atomicity plus shared receipts/revisions/locking across state, choices, pins and
   inventory. Separate inserts/local rollback cannot prove replay safety after reload, another tab
   or a lost committed response. See [equipment
   design](../specs/2026-10-02-equipment-atomicity-proposal.md) and [durable
   actions](../specs/2026-10-02-durable-character-actions-proposal.md); neither is implemented.
4. Resolve old Manual/Average HP grandfathering under rolled-only. Values/math and confirmation
   handling remain intact; the UI prevents new Manual edits under that picker rule.

No active execution/connection blocker. Two transient execution-transport interruptions (around
17:00 and 17:29 UTC) recovered; the second prevented a documentation process from starting and
smaller writes succeeded. No automatic approval rejection. Local source/tests/builds/docs/commits
only: no hosted writes/tests, schema/migrations, installs, credentials/security changes,
other-worktree operations, remote push/merge/deploy or observable backend-routing claim. **Not
release-ready.**

The maintained [current-state index](../CURRENT-STATE.md) links detailed milestones. The earlier
fast-continuation handoff is historical.
