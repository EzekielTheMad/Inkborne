# Character core stability handoff

> Historical milestone record. Counts/status describe this checkpoint. Use [CURRENT-STATE](../CURRENT-STATE.md) and the [release checklist](../RELEASE-READINESS.md) for current authority.

## Outcome

Local branch `codex/playable-core-stability`, based on verified GitHub main
`0a4acb93ab5fcda94d8efa13a87568c3315da108`. Read the exact local HEAD with
`git rev-parse HEAD`; this record belongs to that branch's checkpoint.

Two bounded changes are complete: recoverable character play-state saves and
safe/readable new-character creation failures. Current product direction and
open boundaries live in [CURRENT-STATE.md](../CURRENT-STATE.md).

## Changes

- New session-local state writer serializes existing shallow RPC patches and
  rebuilds optimistic state from successful writes plus remaining pending edits.
  Failure returns false and raises an accessible shared error; no automatic retry.
- Cast results wait for successful persistence. Rests wait, disable duplicate
  submission and stay open on failure. Failed damage does not open a concentration
  check; a failed concentration drop keeps the pending check.
- Character-ID provider key prevents a retained writer targeting another
  character after navigation. Sheet callback props accept explicit save results.
- Creation validates string form fields, handles rejected/empty inserts, hides
  database internals from URLs, and renders recovery copy for unknown/malformed
  error queries. Unavailable game systems disable Begin and explain recovery.
- Roadmap/game plan record the builder-first decision; historical architecture
  documentation is explicitly marked as a snapshot. Existing worldbuilding
  integration is preserved; its expansion remains deferred.

## Verified commands

- `npm.cmd run check`: strict typecheck and zero-warning lint passed;
  **197 files / 1,817 tests passed** on the final combined source.
- Narrow suites covered state-writer ordering/rollback/retry, public hook cast
  and rest failures, damage/concentration behavior, cast/rest dialogs and new
  character form/page recovery. One newly added cast fixture initially omitted
  `duration: Instantaneous`, creating an extra active-effect patch; correcting
  that fixture produced the intended instantaneous-spell assertion.
- `npm.cmd run build`: **passed** Next 16.2.10 compile, TypeScript and 24 static
  pages on final source. Set `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:1`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=local-build-placeholder`, and
  `SITE_URL=http://127.0.0.1:3000` in the child PowerShell process. Existing
  Google Fonts require network access; the initial restricted attempt failed
  there, and the authorized network build succeeded. No real credentials used.
- `git diff --check`: passed. React review covered client boundaries, stable
  writer initialization, explicit async completion, accessible alerts and
  character lifetime. No new packages/frameworks were introduced.

Dependencies were copied from an existing checkout with matching package/lock
manifests, rather than installed. Installed Vitest reported 4.1.10. The results
are with reused dependencies; a fresh lockfile install is not verified.

## Untested and deferred

No hosted Playwright run, provider UAT, database migration or production state
change occurred. Existing hosted fixtures mutate Supabase. No push, merge or
deployment occurred; existing dirty worktrees and alpha candidate remain intact.

Equipment grants still comprise separate inventory/currency/confirmation writes.
Session-only retry tracking cannot prove safety after reloads, concurrent tabs or
ambiguous remote completion. An atomic/idempotent grant requires separate schema
authorization and migration-history reconciliation. Do not present it as fixed.

State patches retain the existing shallow replacement contract, and the writer
orders one mounted browser session only. No cross-client conflict resolution,
offline persistence or cancellation is claimed. Ambiguous network completion of
a creation insert can still create a character whose response was lost; no
automatic creation retry was added.

## Next safe task and rollback

Continue [builder overview/navigation and the local journey](../specs/2026-10-02-builder-journey-next.md).
It identifies duplicated status rules and a character-return link incorrectly
labelled "Back to Dashboard". Audit required choices before redefining readiness.

To abandon this candidate, stop using this isolated branch and return to the
verified base. If the local change later needs reversal, revert its local commit;
no live rollback or migration is necessary. Do not reset or delete other worktrees.
