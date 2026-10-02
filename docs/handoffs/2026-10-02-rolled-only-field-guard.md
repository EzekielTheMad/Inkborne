# Respect the rolled-only picker boundary - October 2, 2026

> Historical milestone record. Counts/status describe this checkpoint. Use [CURRENT-STATE](../CURRENT-STATE.md) and the [release checklist](../RELEASE-READINESS.md) for current authority.

A real ClassStepClient regression with a stored Manual record and rolled-only campaign reproduced an editable Manual field even though the method controls offered only Roll. The regression failed before repair.

The Manual field is hidden under rolled-only and its commit handler refuses that method. A preexisting open Manual draft is also hidden if the campaign rule changes. Existing stored values remain visible as the current total gain and are not rewritten or rerolled. Rule resolution, sheet math and the existing confirmation rule are unchanged. Whether old Manual/Average records should satisfy confirmation is still a separate unanswered product-policy question.

Full npm.cmd run check passed strict types, zero-warning lint and 203 files / 1,968 tests. Loopback-placeholder build passed Next 16.2.10 compile, TypeScript and 24 static pages. Nineteen isolated builder Chrome checks passed with no remote requests/page errors, including mobile read-only display of the existing Manual value and zero saves. Existing five play-save checks cover unchanged play code. No hosted operations, schema/security/credential changes, installs or remote Git operations.

This repairs the existing picker boundary without deciding legacy-record policy or system-wide readiness. Durable grants, cross-client/ambiguous outcomes and choice/reference atomicity remain unresolved; not release-ready.
