# Release-readiness checklist

October 2, 2026. Source `e209583`; branch `codex/playable-core-stability`. **Not release-ready.**
Current authority: [CURRENT-STATE](CURRENT-STATE.md); evidence: [latest handoff](handoffs/2026-10-02-builder-validation-recovery.md).

## Verified locally

- [x] Full branch reviewed against local main `26e1f514693190e4afb2dc708ac97fb04a0f5814`; no main-only commits.
- [x] Strict types, zero-warning lint, 204 files / 1,990 tests; Next 16.2.10 production build, 24 static pages.
- [x] 22 builder + 6 play/effect installed-Chrome checks with fresh production CSS, simulated router/persistence,
  actual components/Activity; no page errors or remote attempts. Covers pending/rejected saves, Back/reveal,
  note replacement, exact HP failure recovery and effect-draft retry. Creation remains unit-tested, not real-browser accepted.
- [x] Exact saved core, active feature/trait, ASI/style and supported category checks shared by overview/navigation; **Saved** labels disclose limited readiness.
  Orphan core pins show **In progress**. Clean local source/docs checkpoints; no publication or hosted mutation.

## Required real Next/auth/backend acceptance

- [ ] Approved disposable target and account/content/character fixture IDs; confirm effective migrations, generated types,
  RPC definitions/grants/RLS and cleanup plan before writes. Do not run hosted Playwright setup under local-only authority.
- [ ] Real authenticated creation -> builder -> sheet on desktop/mobile: fresh inserts, exact immutable pins, all required
  choices, equipment, HP/slots/resources, keyboard/dialog behavior, real Next refresh/history/cache and character switching.
- [ ] Owner/nonowner/anonymous, private/campaign-shared/retired content and guessed IDs: rejected/no-match writes must not
  appear successful. Expired auth, offline interruption, denied content and failed reference reads need readable recovery.
- [ ] Verify `patch_character_state` specifically: local 00031 returns void/no affected-row receipt; 00041 sets empty
  search_path while the earlier body uses unqualified `characters`. Inspect effective definition and replay the local chain
  in an approved disposable DB. No hosted behavior is claimed. Any SQL/contract correction requires separate approval.
- [ ] Inject rejection before commit and loss of response after commit separately; verify reload/two-tab recovery,
  state/choice/pin synchronization and no repeated equipment/currency/roll-log consequences. Current local gates do not prove this.
- [ ] Run approved fresh lockfile/dependency and existing production UAT/security/privacy gates; confirm fixture cleanup by
  tracked IDs and record residual rows/errors. Prior historical hosted results do not accept this branch.

## Supported milestone and remaining content/product decisions

- [x] Required per-level/ASI/style/trait and explicit/category choices are validated from exact pins; existing
  all_languages options are resolved consistently. Generic feature/subclass choices are reachable in actual panes.
- [x] Missing active class features can explicitly reconcile from the existing immutable grant manifest, with
  pending/error/Activity retry. Valid historical pins remain intact. Missing race trait history blocks dependent choices.
- [ ] Unknown custom category vocabularies and missing original core/race trait versions need authoritative content
  evidence/policy. Conflicting/orphan references remain incomplete; display fallbacks do not repair saved pins.
  Saved remains limited validation, not a full playable-character verdict.
- [ ] Victor must settle legacy Manual/Average HP under rolled-only rules and how legacy partial grants/copies are reconciled.

## Next approval boundary

- [ ] Approve a named disposable staging project, owner/nonowner accounts, tracked creation/builder/sheet and
  exact-pin recovery fixtures, denial/no-match and before/after-commit/two-tab tests, and cleanup by ID.
  The [latest handoff](handoffs/2026-10-02-builder-validation-recovery.md) contains the precise proposed question. This does not authorize SQL/schema changes.

## Victor approval needed for durable work

- [ ] Approve the [equipment schema/hosted scope](specs/2026-10-02-equipment-atomicity-proposal.md#exact-approval-scope):
  one natural-key grant ledger, inventory provenance and a server-owned locked transaction for grant/currency/confirmation.
- [ ] Approve the [action schema/hosted scope](specs/2026-10-02-durable-character-actions-proposal.md#exact-approval-scope):
  shared character revision, operation receipts, participation by every relevant writer and accepted roll-history linkage.
- [ ] Approval must name the target DB/project, migrations/permissions/types/caller changes, disposable fixture and failure
  injection scope, receipt retention/roll authority/copy policy and cleanup. Existing trusted-server capability must be
  reviewed; credential/security changes are not implicitly authorized. No schema/hosted change was implemented here.
