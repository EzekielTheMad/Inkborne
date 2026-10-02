# Class level-up HP draft recovery — October 2, 2026

> Historical milestone record. Counts/status describe this checkpoint. Use [CURRENT-STATE](../CURRENT-STATE.md) and the [release checklist](../RELEASE-READINESS.md) for current authority.

Actual ClassStepClient controls reproduced a failed manual HP save still appearing selected and enabling Confirm. The rail's separate draftHpRolls overlay masked rollback from the parent save state. Visible and Activity hide/fail/reveal regressions failed before repair.

The rail now reads the parent-owned HP selections in both desktop and mobile level-up views. Incremental save semantics remain unchanged: the parent supplies optimistic selections and removes them on rejected saves; no second snapshot can retain failed HP. Confirmation remains disabled after failure until an explicit retry supplies HP. The bare-rail test now proves that dispatching its callback alone does not acknowledge a saved selection.

Chrome also reproduced manual input blur dispatching a competing retry when the user explicitly selected Average. Method switches now supersede the unsaved manual draft instead of blur-writing it first; identical already selected manual values avoid redundant writes. The actual failure regression includes the blur relatedTarget and verifies only the explicitly retried Average record.

Verification: `npm.cmd run check` passed strict types, zero-warning lint and 1,938 tests / 203 files. Loopback-placeholder build passed Next 16.2.10, TypeScript and 24 static pages. Twelve isolated builder Chrome checks passed, including real mobile HP failure/method retry; no remote requests or page errors. Prior five play-save checks cover unchanged play code. No hosted operations, schema changes, installs or remote Git operations.

Limits: no durable ambiguous-write receipt, cross-client version check or atomic class/ref transaction. Mobile modal error visibility and numeric manual-input validation are being reviewed separately; parent errors are still behind the open drawer in this checkpoint. Equipment durable atomicity remains deferred. Not release-ready.
