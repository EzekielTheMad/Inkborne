# Locked HP rule confirmation — October 2, 2026

> Historical milestone record. Counts/status describe this checkpoint. Use [CURRENT-STATE](../CURRENT-STATE.md) and the [release checklist](../RELEASE-READINESS.md) for current authority.

Actual ClassStepClient tests under campaign average_only and max_for_all reproduced a level-up dead end: HP controls were read-only, but confirmation required a stored per-level record that those controls could not create. Both regressions failed before repair.

Level-up now recognizes values supplied by existing deterministic rules: primary first level, Average-only, Max-for-all, and first-class-level Max where applicable. These rules do not need a redundant HP record. Free/rolled selection handling and existing stored-record math are unchanged. No HP values or campaign settings are rewritten.

`npm.cmd run check`: strict types, zero-warning lint, 203 files / 1,946 tests passed. Loopback-placeholder build: Next 16.2.10, TypeScript and 24 static pages passed. Fourteen isolated builder Chrome checks passed, including mobile Average/Max confirmation with exact class/level patches and no fabricated HP record. No remote requests or page errors. Prior five play-save checks cover unchanged play code. No hosted operations, schema changes, installs or remote Git changes.

Existing Manual/Average records under a later rolled-only rule remain unchanged while their grandfathering policy is clarified. This fix does not answer that policy or full feature/system readiness. Cross-client/ambiguous outcomes and durable equipment grants remain unresolved; not release-ready.
