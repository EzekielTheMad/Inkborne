# Builder choice validation and reference recovery

October 2, 2026, around 19:30 UTC. Source `e209583b9cf208305305f33a62653de38c358d88`.
Branch `codex/playable-core-stability`; pass began at clean `3da50703cb9fa3546c7a2db8f0620605eb653c9d`.
**Not release-ready.** [CURRENT-STATE](../CURRENT-STATE.md) and [RELEASE-READINESS](../RELEASE-READINESS.md)
are authoritative. Earlier handoffs record historical checkpoints.

## Result and review

- Overview and navigation use exact unique historical core, active level-feature and race/subrace trait pins.
  They validate required explicit/category selections, subclass/style selection, ASI allocation shape and
  matching feat ID/version/provenance. Missing, duplicate, mismatched or unsupported inputs stay In progress.
  Future level features do not block the current level. This is supported saved-choice validation, not a
  complete playability, prerequisite, ability-cap or backend-authorization verdict.
- Shared choice vocabulary resolves existing `all_languages` through accessible language definitions and
  excludes fixed language grants/data. Class, race/trait and background editors use the same rule. Explicit
  lists remain pinned. Unknown category strings remain unavailable with readable feedback; saved strings
  cannot make an unknown source valid. Cross-choice language/source policy is not newly invented here.
- Actual class panes now render generic feature-owned choices and selected subclass-owned choices at the
  existing subclass gate (or its first defined level). Core class choices participate in level-one readiness
  and draft confirmation. Per-level rails and ASI cards reject invalid allocation totals/duplicate abilities.
  A malformed null allocation is safely rejected rather than crashing readiness.
- Missing active class features behind a valid class pin block dependent edits and expose an explicit
  Restore saved class features action. It calls the existing owner-checked `sync_character_feature_refs`
  RPC through `syncClassFeatureRefs`, then refetches parsed immutable refs. The RPC's existing grant manifest
  supplies the exact version. No SQL, schema, permissions, catalog-based version replacement or new writer
  framework was added. Failed recovery keeps selections, releases pending controls and supports explicit retry.
- Missing race/subrace trait history is visible; dependent choice controls stay disabled and current catalog
  traits are not substituted for missing saved traits. Change Race remains available for an intentional new
  selection. Valid historical pins, including snapshots absent from the current catalog, remain intact.

This was manual critical review plus concrete tests, not an independent agent audit. Reviewed action auth,
RPC ownership guard/immutable grant reconciliation, duplicate gates, retained Activity, version identities,
category membership and UI reachability. Review corrected gate self-selection, disabled dependent race
buttons, malformed ASI data and otherwise unreachable subclass/feature choices. A browser fixture initially
timed out because it had not opened the mobile level drawer; the final fixture performs that real interaction.
An intermediate full test run exercised the new null-allocation regression before its loaded helper had
the guard; final frozen-source checks below supersede intermediate runs.

## Final local evidence

| Command | Result |
| --- | --- |
| Focused level/choice/recovery tests | 3 files / 77 tests passed |
| Malformed ASI choice regression | 1 file / 7 tests passed |
| `npm.cmd run check` | Strict types, zero-warning lint; 204 files / 1,990 tests passed |
| `npm.cmd run build` with loopback public placeholders | Next 16.2.10 production compile/types; 24 static pages passed |
| `node scripts/verify-builder-local.mjs` after final build | 22 installed-Chrome checks passed |
| `node scripts/verify-play-save-local.mjs` after final build | 6 installed-Chrome checks passed |
| `git diff --check` | Passed |

Browser tests use real components, retained React Activity and fresh production CSS, with simulated
router/persistence and non-loopback requests blocked. Both report no page errors or remote attempts.
New checks cover mobile hide -> reject -> Back -> retry -> exact old feature/choice, plus fixed-language
exclusion and actual selection persistence. Unit/component tests exercise real overview/navigation,
actual controls and the authenticated Server Action boundary with mocked existing RPC/ref reads.
The RPC's live owner/nonowner behavior is not accepted by these mocks.

Artifacts: `test-results/builder-local/evidence.json`, `feature-recovery-mobile.png`, and
`test-results/play-save-local/evidence.json` (ignored, reproducible). Screenshot inspection confirmed the
historical feature and selected old option remain readable in the mobile drawer. Temp logs:
`inkborne-category-final-check.txt`, `inkborne-category-build.txt`, `inkborne-category-browser.txt`,
`inkborne-category-play-browser.txt`, `inkborne-category-subclass-check.txt`, `inkborne-category-shape-check.txt`.
Only installed dependencies/Chrome were used. No secrets/environment files, hosted writes/tests, installs,
schema/migrations, other worktrees, remote push/merge or deployment were touched.

Read installed Next use-client/use-server guidance. Existing getUser/RPC conventions were checked against
[getUser docs](https://supabase.com/docs/reference/javascript/auth-getuser) and
[RPC docs](https://supabase.com/docs/reference/javascript/rpc), plus the Supabase skill. The web reader
rejected the changelog.md content type; no successful changelog scan is claimed. The user's local-only
restriction takes precedence over the skill's live test-query guidance; no hosted query was run.

## Remaining boundary and precise next approval

The supported per-level/category validation and existing class-manifest recovery milestone is complete.
There is no newly known critical local data-loss regression after this bounded pass. This does not assert
that every custom mechanic, unknown category or legacy character is fully validated. Missing original core
pins, missing race trait history, duplicate/orphan references and unavailable content cannot be safely
reconstructed from today's catalog. Some existing class/race selection display fallbacks remain; they do
not repair pins or make readiness Saved. Exact recovery requires original version/provenance evidence,
not a speculative local replacement. Legacy rolled-only Manual/Average HP and old grants/copies remain
product decisions. Unknown custom category vocabulary needs authoritative content/product direction.

The next major release blockers genuinely require approved backend acceptance and, for durable guarantees,
schema work. Further generic local cleanup is not a substitute. Suggested question for Victor:

> May we use a named disposable Supabase staging project and specified owner/nonowner test accounts to
> inspect effective migrations/RPCs/grants/RLS, then run tracked fresh creation -> builder -> sheet tests,
> exact pin recovery, denied/no-match writes, interruption before commit and response loss after commit,
> two-tab conflicts, and cleanup by recorded fixture IDs? This approval would permit those staging tests
> and reads/writes only; SQL/schema/security/credential changes would still need separate approval.

First verify the effective `patch_character_state` definition against local 00031/00041: void/no row receipt
and unqualified `characters` with later empty search_path remain unaccepted risks. Verify the existing
feature reconciliation RPC preserves valid historical pins and rejects nonowners on that target.

Separately approve the exact [equipment atomicity scope](../specs/2026-10-02-equipment-atomicity-proposal.md#exact-approval-scope)
and [durable action scope](../specs/2026-10-02-durable-character-actions-proposal.md#exact-approval-scope)
before migrations, ledger/provenance/receipts/shared revision or all-writer changes. Existing specs cover
fixture cleanup, failure injection and roll/copy policy; neither proposal is implemented. No automatic
replay is justified by a simulated rejection. Creation deduplication remains a separate contract risk.
