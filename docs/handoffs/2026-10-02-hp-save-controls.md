# HP save-control regression repair

> Historical milestone record. Counts/status describe this checkpoint. Use [CURRENT-STATE](../CURRENT-STATE.md) and the [release checklist](../RELEASE-READINESS.md) for current authority.

Base: `829bc4f9f09760daa33509ac7eb8ef6b39d05871`; branch
`codex/playable-core-stability`, isolated workspace checkout.

Critical review of the earlier save-recovery changes found that waiting for
damage confirmation left the HP popup's controls active. Four new cases failed
against that source: pending controls stayed enabled, failed heal/temp saves
closed and erased input, and a rejected damage save escaped as an unhandled
promise rejection.

`components/sheet/hp-tracker.tsx` now shares confirmed-save handling for damage,
healing and temp HP. A synchronous ref prevents a second action even before a
render; the amount field and actions are disabled while pending, and controlled
popover dismissal is ignored until completion. Failures (false or rejection)
keep the amount and show a readable alert for explicit retry. No raw error is
shown. Successful damage raises concentration checks only after confirmation.

Existing damage absorption, max-heal clamping, 0-to-positive death-save reset,
temp HP assignment and concentration-drop patches are preserved. The scoped
HP/provider/rest run passed 61 tests. Final `npm.cmd run check` passed typecheck,
zero-warning lint and 200 files / 1,844 tests. Production build passed Next
16.2.10 compile, TypeScript and 24 static pages with loopback-only placeholders.
`git diff --check` passed. Dependencies remain reused.

This is a local control guard, not a sheet-wide transaction coordinator. Other
components/tabs can still act while a save is pending; dependent nested-map
spending and stale async dialog lifetimes remain in the
[critical review](2026-10-02-critical-save-review.md). Equipment atomicity remains
unresolved. No hosted tests, migration, dependency, push, deploy or cleanup.
