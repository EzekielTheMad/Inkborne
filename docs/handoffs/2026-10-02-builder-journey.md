# Builder overview and navigation checkpoint

> Historical milestone record. Counts/status describe this checkpoint. Use [CURRENT-STATE](../CURRENT-STATE.md) and the [release checklist](../RELEASE-READINESS.md) for current authority.

Base for this milestone: local save/creation commit
`8e52fc99a7154a58eb522f4e6f1f8799569b0985`, built on verified remote main
`0a4acb93ab5fcda94d8efa13a87568c3315da108`.
Checkout: `C:\Users\kaios\Documents\Codex\2026-10-02\task\inkborne-core`;
branch: `codex/playable-core-stability`.

## Result

The builder layout and overview share `lib/builder/step-status.ts`. Current
status semantics are preserved, including legacy equipment acknowledgements,
sparse saved ability stats and class selections with unresolved later choices.
They are saved-choice indicators, not full readiness validation.
The former "Back to Dashboard" label now says "View Character". Navigation has
an accessible name, active-page/step markers and screen-reader status text;
overview cards expose matching status text.

Nine local mocked server/component cases exercise fresh entry, ability-method
selection, saved core choices, draft/confirmed equipment, matching card/nav
links, active step, login and layout ownership gates, and compatibility semantics.
One additional provider case uses the real max-HP and initialization helpers
for a new fighter, verifies 12 HP, failed first damage-save rollback and retry
to 9 HP through the real public state hook.

These are local boundary tests. They do not submit all builder UIs or prove
authenticated routing, hydration, equipment grants or remote persistence.
Equipment remains separate inventory/currency/confirmation writes and needs
durable atomic/idempotent provenance under separately authorized schema work.

## Verification

`npm.cmd run check` passed strict typecheck, zero-warning lint, 198 test files
and 1,827 tests. `npm.cmd run build` passed Next 16.2.10 compile, TypeScript and
24 static pages with loopback-only placeholders and authorized font access.
`git diff --check` passed. Dependencies remain the existing copied tree; no
install, hosted tests, migration, push, merge or deployment occurred.

## Next slice

[Ability-score save recovery](../specs/2026-10-02-ability-save-recovery-next.md)
has concrete evidence of concurrent full-object saves and silent snapshot
rollback. Preserve current validation semantics until required-choice readiness
has been audited against actual schemas. Keep all existing worktrees intact.
