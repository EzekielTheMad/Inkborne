# Explicit custom-note clearing - October 2, 2026

> Historical milestone record. Counts/status describe this checkpoint. Use [CURRENT-STATE](../CURRENT-STATE.md) and the [release checklist](../RELEASE-READINESS.md) for current authority.

Real BackgroundStepClient controls reproduced saving an empty or whitespace-only custom note as a one-entry array and displaying a selected entry after clearing. Both regressions failed before repair.

An explicitly submitted narrative edit filters blank entries to an empty selection. Nonblank text, including its whitespace, remains exact. Displayed selection counts and limits use nonblank entries. Raw failed drafts remain available for retry rather than reverting the input to the old saved note. The tests hide the editor with React Activity, reject the save, reveal it and explicitly retry; successful retry removes the unsaved notice and confirms an empty selection. No existing records are automatically rewritten.

npm.cmd run check passed strict types, zero-warning lint and 203 files / 1,961 tests. Loopback-placeholder build passed Next 16.2.10 compile, TypeScript and 24 static pages. Seventeen isolated builder Chrome checks passed with no remote requests/page errors, including clear, hide, failed completion, native Back and explicit retry. The first new browser assertion matched a retained hidden panel too; it was scoped to visible text and the full fixture passed. The final script lint passed. Five earlier play-save checks cover unchanged play code.

The fixture uses simulated persistence and guaranteed injected rejection. Actual ambiguous completion and concurrent full-choice writers still need a durable boundary. No hosted operations, installs, schema/security/credential changes or remote Git operations. LegendKeeper and existing worldbuilding integration remain intact; not release-ready.
