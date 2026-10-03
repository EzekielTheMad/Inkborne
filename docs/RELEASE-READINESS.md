# Release-readiness checklist

Latest checkpoint: [HP locator proof and bounded play recovery](handoffs/2026-10-03-hp-locator-play-recovery.md). Fixed hyphen/em-dash test mismatch; actual desktop/mobile component regression passed. Fifth hosted fixture passed precommit HP rejection, independent temp HP and isolated hit-die response-loss/reload. Real Next Back did not retain the Rest dialog; hidden-settlement and two-tab scenarios remain unaccepted. **Five tracked fixtures cleaned; one final creation attempt reserved.** Final types/lint, 2,029 tests and fresh production build passed. **Not release-ready.**

October 3, 2026. Prior verified application source `71681c7`; branch `codex/playable-core-stability`. **Not release-ready.**
Current authority: [CURRENT-STATE](CURRENT-STATE.md); evidence: [current handoff](handoffs/2026-10-03-hp-locator-play-recovery.md).

## Latest bounded acceptance

- [x] Real hosted SRD race/class/abilities/background/equipment path, desktop sheet refresh and mobile 390x844 identity/navigation/reload.
- [x] Private owner reads; nonowner and anonymous character/ref denials; isolated nonowner 404 and anonymous login redirects.
- [x] Two SDK ability writes with application compare-and-set filters: one confirmed writer, one stale no-match; guarded baseline restoration.
- [x] First three recorded fixtures exact-ID cleaned; nine child scopes verified absent.
- [x] Fourth fixture exact-ID cleaned after approved single diagnostic retry; all nine child scopes verified absent. Four attempts used, two remain.
- [x] Fifth fixture: known precommit HP rejection and independent temp HP persisted; one hit die committed with lost response reconciled after reload without retry, one roll. Isolated outcome only.
- [x] Fifth fixture exact-ID cleaned; parent/nine child scopes absent. Five attempts used, final one reserved.
- [ ] Real Next retained Rest lifecycle failed at first Back before proving retention; hidden settlement and two-tab never reached. Cast, full rule correctness and broader authorization remain unaccepted.

## Historical first October 3 bounded checkpoint

- [x] Approved target, active/auth health, two existing distinct accounts and trusted exact-ID cleanup preflight.
- [x] Dedicated no-sweep runner, fsynced six-attempt journal outside browser output clearing, 18 dry-run regressions; types/lint and 210 files / 2,019 tests.
- [x] Real login/create/builder refresh; secondary-account update attempt left owner readback unchanged.
- [x] The one run-owned character and all inspected children verified absent after exact-ID cleanup; no residual fixture known.
- [ ] Complete journey failed on hosted 57014 timeouts after race/class/first skill. Later reads passed, cause unproven. Later bounded mobile/private-access checks passed; prior root cause remains unproven.

## Prior October 2 application verification

- [x] Full branch reviewed against local main `26e1f514693190e4afb2dc708ac97fb04a0f5814`; no main-only commits.
- [x] Strict types, zero-warning lint, 204 files / 2,001 tests; Next 16.2.10 production build, 24 static pages.
- [x] 23 builder + 6 play/effect installed-Chrome checks with fresh production CSS, simulated router/persistence,
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
- [ ] Verify `patch_character_state` behavior under denied/no-match writes and ambiguous outcomes. October 3 read-only inspection confirms both local 00031 and hosted bodies qualify `public.characters`; the earlier search-path suspicion was incorrect. Hosted body is SECURITY INVOKER, returns void and shallow-merges JSON. Seven relevant RPC bodies match local migration bodies. No SQL correction is authorized or implemented.
- [ ] Inject rejection before commit and loss of response after commit separately; verify reload/two-tab recovery,
  state/choice/pin synchronization and no repeated equipment/currency/roll-log consequences. Current local gates do not prove this.
- [ ] Run approved fresh lockfile/dependency and existing production UAT/security/privacy gates; confirm fixture cleanup by
  tracked IDs and record residual rows/errors. Prior historical hosted results do not accept this branch.

## Supported milestone and remaining content/product decisions

- [x] Required per-level/ASI/style, recorded-trait and explicit/category choices are validated from exact pins; existing
  all_languages and authoring-defined any/language options are resolved consistently. Generic feature/subclass choices are reachable in actual panes.
- [x] Missing active class features can explicitly reconcile from the existing immutable grant manifest, with
  pending/error/Activity retry. Valid historical pins remain intact. Fresh race parent-only persistence no longer
  causes false trait blocking; unpinned catalog choices are disclosed and are outside Saved validation.
- [x] Independent review findings fixed: strict builder reads reject unreadable/mismatched recorded snapshots,
  and race/subrace/trait conflicts gate edits. Actual fresh selection/refresh/Back path is covered.
- [ ] Other unknown custom category vocabularies and missing original core/race trait versions need authoritative content
  evidence/policy after source/provenance research. Conflicting/orphan references remain incomplete;
  unpinned current-catalog selection does not reconstruct an original version or prove full trait readiness.
  Saved remains limited validation, not a full playable-character verdict.
- [ ] Victor must settle legacy Manual/Average HP under rolled-only rules and ambiguous legacy partial grants.
  Normal copying already preserves state/pins/current inventory; it is not a new equipment award.

## Next approval boundary

Victor approved bounded acceptance on October 3 for `etcaodglvcspcmwecyxq`, up to six new characters and two existing approved accounts. Main_PC has existing settings for this exact project. Auth/account preflight and one real creation/builder refresh/nonowner denial check passed. Full builder-to-sheet/recovery/concurrency remains pending after hosted 57014 failures; exact-ID cleanup was verified for the single created fixture. The dedicated harness excludes legacy prefix sweeps and keeps durable run journals outside Playwright outputDir. This does not authorize SQL/schema/security changes, accounts, extra campaigns/content, deployment or publishing.

## Victor approval needed for durable work

- [ ] Approve the [equipment schema/hosted scope](specs/2026-10-02-equipment-atomicity-proposal.md#exact-approval-scope):
  one natural-key grant ledger, inventory provenance and a server-owned locked transaction for grant/currency/confirmation.
- [ ] Approve the [action schema/hosted scope](specs/2026-10-02-durable-character-actions-proposal.md#exact-approval-scope):
  shared character revision, operation receipts, participation by every relevant writer and accepted roll-history linkage.
- [ ] Approval must name the target DB/project, migrations/permissions/types/caller changes, disposable fixture and failure
  injection scope, receipt retention/roll authority/copy policy and cleanup. Existing trusted-server capability must be
  reviewed; credential/security changes are not implicitly authorized. Neither durable schema proposal was implemented here.
