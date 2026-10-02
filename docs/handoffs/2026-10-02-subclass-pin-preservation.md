# Preserve a selected subclass pin - October 2, 2026

> Historical milestone record. Counts/status describe this checkpoint. Use [CURRENT-STATE](../CURRENT-STATE.md) and the [release checklist](../RELEASE-READINESS.md) for current authority.

A real ClassStepClient regression clicked the already-selected pinned Champion after the mutable catalog changed Champion to another parent/version. The existing card unnecessarily sent the same class choices again and could replace the pinned reference using mutable catalog content. The regression failed before repair.

The selected subclass card is now inert, matching ordinary selection behavior and the fighting-style repair. Selecting a different subclass remains unchanged. The actual-client test verifies no choice, insert or removal call on re-click.

Full npm.cmd run check passed strict types, zero-warning lint and 203 files / 1,959 tests. Loopback-placeholder npm.cmd run build passed Next 16.2.10 compile, TypeScript and 24 static pages. Sixteen isolated Chrome builder checks passed, including the selected Champion card with a newer incompatible catalog record; it stays pressed without a save or error. No remote requests/page errors. Existing five play-save checks cover unchanged play code. No hosted operations, schema changes, installs, credentials or remote Git operations.

This prevents an accidental rewrite; it does not make intentional subclass changes, choices and pins one durable transaction. Partial/ambiguous writes, cross-client state and release readiness remain unresolved.
