# Manual HP validation — October 2, 2026

> Historical milestone record. Counts/status describe this checkpoint. Use [CURRENT-STATE](../CURRENT-STATE.md) and the [release checklist](../RELEASE-READINESS.md) for current authority.

An actual ClassStepClient regression entered 3.5 and observed a persisted value of 3 through parseInt truncation. Blank, zero and above-die input were refused silently with no accessible correction. Four real-control regressions failed before repair.

Manual HP now converts the full numeric value and requires a nonempty whole number from 1 through the hit die. Invalid values produce an associated accessible error/aria-invalid state and no save. Correcting the value clears the field error and an explicit Enter saves the valid raw contribution through the existing gated callback. No HP rule or existing-record policy changed.

`npm.cmd run check`: strict types, zero-warning lint, 203 files / 1,944 tests passed. Loopback-placeholder build passed Next 16.2.10, TypeScript and 24 static pages. Twelve isolated builder Chrome checks passed; the mobile HP case now also verifies fractional rejection before correction/failure/retry. No remote requests or page errors. Prior five play-save checks cover unchanged play code. No hosted operations, schema changes, installs or remote Git changes.

Remaining: grandfathering of existing Manual/Average records when a campaign changes to rolled-only is a product policy question, not answered by this field validation. Locked deterministic HP rules and per-level/system readiness are separate review paths. Durable ambiguous/cross-client outcomes and equipment atomicity remain unresolved; not release-ready.
