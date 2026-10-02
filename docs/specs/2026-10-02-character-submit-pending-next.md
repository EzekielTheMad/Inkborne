# Next bounded builder entry task: pending creation submission

> Historical proposal/task plan; may include unimplemented work. Use [CURRENT-STATE](../CURRENT-STATE.md) and the [release checklist](../RELEASE-READINESS.md) for current priorities.

`app/(app)/characters/new/page.tsx` renders a normal server-action form. Its
Begin button is disabled only when game systems cannot be loaded/are absent.
There is no pending submission indicator or per-form duplicate-click guard.
The create action inserts a new row on each valid invocation. Recovery copy
does not itself prevent a second click while the first request is pending.

Use the existing React/Next form-pending contract to disable the submit action
and announce pending creation. Keep the current server action, validation and
single-system shortcut. Add local UI tests proving one submission interaction
while pending and restoration after a failed action; do not infer database
idempotency from disabled UI. A lost creation response and independent tabs
remain ambiguous without a separately designed durable idempotency key.

Read local Next form documentation first. No schema, dependency install, hosted
write or remote publication is required. Preserve the original source checkout
and all worktrees; run scoped tests, full check/build and update handoff docs.
