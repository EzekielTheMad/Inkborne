# Creation pending-state checkpoint

> Historical milestone record. Counts/status describe this checkpoint. Use [CURRENT-STATE](../CURRENT-STATE.md) and the [release checklist](../RELEASE-READINESS.md) for current authority.

Base: local cast-conflict gate `c26ba1819d1e704d025d26a828b78fc669abb90e`.
Branch and isolated checkout remain `codex/playable-core-stability` at
`C:\Users\kaios\Documents\Codex\2026-10-02\task\inkborne-core`.

The creation form now renders a small client submit component using the existing
React `useFormStatus` contract, read from the local Next forms guide. While the
action is pending, the button is disabled, says "Creating character…" and an
accessible status asks the player to wait. The unavailable-system guard is
preserved. The server action, validation, name/system fields and single-system
shortcut are unchanged.

The real React form test holds an async action open, observes its pending state,
verifies a second button click does not invoke the action again, and verifies
the button is enabled when the action settles. Another test preserves the idle
unavailable-system guard. Existing mocked error-page cases now also verify the
Begin button is available for recovery after redirected creation failures.
That is not an authenticated redirect/UAT test or a database idempotency proof.

The scoped submission/page/writer/provider run passed 34 tests, including the
cast release regression. Final `npm.cmd run check` passed strict typecheck,
zero-warning lint and 201 files / 1,851 tests. Production build passed Next
16.2.10 compile, TypeScript and 24 static pages with loopback-only placeholders.
`git diff --check` passed; existing dependencies were reused.

## Critical review and boundaries

The hook is inside the action form, so it observes that form's submission state;
it has no separate client save state that could hide a server rejection. UI
disablement does not prevent independent tabs, programmatic requests, submissions
before hydration or a retry after a lost creation response. Durable insert
idempotency and remote outcomes remain separate design/UAT items.

The [cast conflict gate](2026-10-02-cast-conflict-gate.md) stays a release test,
with no relaxation for the form milestone. Equipment atomicity, cross-client
reconciliation and remaining async gameplay lifetimes remain explicit blockers
to a general reliability/release claim. No hosted writes, schema changes,
dependencies, push, deploy or worktree cleanup occurred.
