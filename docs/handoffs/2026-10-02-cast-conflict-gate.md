# Failed-cast conflict release gate

> Historical milestone record. Counts/status describe this checkpoint. Use [CURRENT-STATE](../CURRENT-STATE.md) and the [release checklist](../RELEASE-READINESS.md) for current authority.

Milestone base: `db7bdab2cede1898785e600e3056e574425a834c` on
`codex/playable-core-stability`, in the isolated workspace checkout.

## Provenance and regression

The preserved public-provider test starts a cast, waits for its optimistic slot
update, attempts another cast, fails the first save, and then retries from the
settled sheet. Before this correction, the second cast fulfilled and wrote two
slots spent even though the first rejected. The lower-level full-map reproduction
is also preserved as a regression in `tests/lib/character/state-writer.test.ts`.

For attribution, the provider source from verified main
`0a4acb93ab5fcda94d8efa13a87568c3315da108` was copied to a temporary local file
and exercised with the same fixture and mocked persistence boundary. Its first
save failed, both cast promises fulfilled (the old helper swallowed errors),
and the visible slot count was two. That characterization passed. The temporary
source/test were removed; no original checkout or repository metadata changed.
The bug predated this branch. Our first recovery change exposed the failure but
left a later absolute map able to carry its spend; that correction was incomplete.

## Smallest safe strategy chosen

Use conflict rejection under the existing shallow RPC, rather than infer deltas:

- Casts use a guarded state-dependent action. A busy writer or stale render
  snapshot rejects before cast effects or slots are computed. Accepted casts
  compute once from confirmed state and return their outcome only after saving.
- A failed nested-map/list patch invalidates overlapping queued full snapshots.
  Those snapshots are removed from the optimistic view and return failure without
  being sent to persistence. Unrelated maps and later scalar edits retain the
  existing behavior. The user explicitly retries from settled state.
- Dialog copy tells the player to wait for pending character saves before retry.

This closes the reproduced failed-first/queued-second cast path and also prevents
same-render/stale-callback casts from reporting duplicate outcomes. Conservative
rejection can discard an otherwise independent change inside the same full map;
that is preferable to a false success, and the failure is visible. No automatic
retry or new domain math is introduced.

## Remaining release boundaries

This is a session-local guard, not a cross-tab transaction or reconciliation of
ambiguous responses. Raw scalar patches or stale commands from other gameplay
surfaces can still embody dependencies the shallow API cannot identify. Their
domain-specific review remains open. Equipment atomicity and async dialog
lifetimes are separate outstanding items. Actual authenticated browser/RLS UAT
has not run under the no-hosted-writes boundary. Do not call saving universally
reliable or treat local test passes as authorization to publish.

The specific regression must stay green for every later milestone. Final
`npm.cmd run check` passed strict typecheck, zero-warning lint and 200 test files /
1,849 tests. The scoped provider/writer/dialog run passed 43 tests. Production
build passed Next 16.2.10 compile, TypeScript and 24 static pages with loopback
placeholders. `git diff --check` passed. No hosted write/test, schema change,
dependency install, push, merge or deployment occurred; dependencies are reused.
