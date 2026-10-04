# Builder compatibility and independent review

> Historical checkpoint. Current counts, authority and remaining blockers are consolidated in [the closing project handoff](2026-10-04-consolidated-project-handoff.md). The acceptance permission section below describes October 2 only; later bounded hosted evidence completed and was cleaned, with zero attempts remaining.

October 2, 2026, around 19:44 UTC. Tested source `d69be9d32c74ccfb676836a143105bbc86bf7e49`; branch `codex/playable-core-stability`.
Started at clean `f2dce6f`. **Not release-ready.** [CURRENT-STATE](../CURRENT-STATE.md) and
[RELEASE-READINESS](../RELEASE-READINESS.md) are authoritative. Earlier milestone evidence is historical.

## Concrete corrections

1. Homebrew background authoring already defines `from: "any", grant_type: "language"` in canonical
   effects; its authoring tests confirm that shape. The prior resolver supported only `all_languages`.
   Both now resolve the accessible language catalog with fixed-language exclusions, and overview/layout
   load vocabulary for either form. `any` for other grant types remains unsupported; no generic meaning
   or new policy was invented. The actual authoring mapper output is tested through builder validation.
2. The checked-in race/subrace client writes only parent pins; the class feature manifest trigger explicitly
   excludes race/subrace. Race snapshots contain trait slugs without child IDs/versions. Requiring all
   those child pins and disabling every race choice falsely blocked the fresh selection/refresh path.
   Readiness now validates any recorded trait pins, but does not infer a missing immutable manifest from
   a bare slug. Unpinned choices retain the existing current-catalog contract with visible disclosure and
   current-catalog labels; Saved is explicitly limited to recorded evidence, not full trait validation.
   Existing unique historical trait snapshots still override catalog content. No trait pin is synthesized,
   no original version inferred, and no new persistence/schema contract introduced.
3. Unavailable or ambiguous trait catalog content remains a visible alert; those trait options are absent.
   Independent race choices stay usable. Duplicate or identity/version-conflicting recorded race/subrace/
   trait snapshots gate edits instead of falling back to a catalog replacement.
4. Independent review found that the ordinary ref reader omits malformed/unreadable nested snapshots,
   which could wrongly turn a recorded trait into an unpinned fallback. An opt-in `requireCompleteSnapshots`
   read now rejects omitted and mismatched envelopes for builder layout/overview/race and class-recovery
   reads. A failed builder read cannot show Saved or offer a replacement for that unreadable pin. The default
   omission contract for other readers, including the sheet, is unchanged. This cannot identify refs hidden
   entirely by RLS or truly deleted rows; real target acceptance/provenance review remains necessary.

## Independent review and tests

The requested independent read-only agent review found two P2 issues: parser omissions and editable
version mismatch. Both were repaired and re-reviewed. A remaining subrace predicate typo was corrected
with an explicit regression. Re-review reported no additional findings. The reviewer did not run tests,
edit files, access credentials or use hosted tools. Root executed validation below.

The original new subrace test initially confused a disabled catalog option with a selected replacement.
It now checks the actual contract: the option stays disabled and the selected-snapshot Change Subrace
control is absent. Earlier false-blocking and intermediate evidence are superseded by this checkpoint.

| Command | Final result |
| --- | --- |
| Focused authoring, real fetcher, actual race controls, overview/nav and choice validation | 5 files / 106 tests passed before the final subrace regression |
| `npm.cmd run check` | Strict types, zero-warning lint; 204 files / 2,001 tests passed |
| `npm.cmd run build` with loopback public placeholders | Next 16.2.10 compile/types; 24 static pages passed |
| `node scripts/verify-builder-local.mjs` after final build | 23 installed-Chrome checks passed |
| `node scripts/verify-play-save-local.mjs` after final build | 6 installed-Chrome checks passed |
| `git diff --check` and current document link checks | Passed |

Fresh path tests exercise the real client selecting a race, assert exactly one parent-pin write, remount
using that actual persisted shape, choose both a core language and an unpinned trait, and assert no child
pin writes. Actual overview/nav show Saved only for supported recorded evidence and disclose unpinned
traits. Real ref-fetcher tests reject null joins, wrong identities and wrong versions while accepting a
valid fresh parent-only race. The mobile Chrome test selects a fresh race, refreshes simulated server props,
navigates to overview and Back, then saves both choices without a false missing-reference block.

Browser fixtures use actual components, retained Activity, fresh production CSS, simulated router and
persistence, and block non-loopback requests. Final reports have no page errors or remote attempts.
Artifacts: `test-results/builder-local/evidence.json`, `fresh-race-traits-mobile.png`, and
`test-results/play-save-local/evidence.json`. Temp logs: `inkborne-compatibility-focused.txt`,
`inkborne-compatibility-check.txt`, `inkborne-compatibility-build.txt`, `inkborne-compatibility-browser.txt`,
`inkborne-compatibility-play.txt`. No installs, secrets/environment-file inspection, hosted writes/tests,
SQL/migrations, policy/credential changes, other worktree edits, push/merge or deployment occurred.

## Paused acceptance boundary and remaining decisions

Victor has been asked whether disposable staging exists or the configured project is live. Until the
answer and named target/accounts/fixture/cleanup scope are approved, hosted execution remains paused.
The documented project `etcaodglvcspcmwecyxq` is a candidate only, not established staging. Do not run the
existing hosted Playwright configuration unchanged: its prefix sweeps exceed run-ID cleanup scope.
The [preceding handoff](2026-10-02-builder-validation-recovery.md#remaining-boundary-and-precise-next-approval)
records the staging question; schema changes remain explicitly excluded from acceptance permission.

Existing refs and class manifests settle exact identity/version questions without owner decisions when
evidence survives. Unknown category strings require original author/schema/import research first;
language `any` is now resolved and needs no Victor vocabulary decision. True missing original core/trait
provenance cannot be reconstructed from current slugs alone. Approve a recovery policy only after an
authorized evidence audit cannot identify the original version uniquely. Normal copy behavior already
preserves choices, state, pins and current inventory; it is not a new starting-equipment award.

Minimal pending owner decisions: preserve historical Manual/Average HP when rules change (recommended;
rolled-only applies prospectively), and audit legacy partial equipment without automatic regrant or
fabricated receipts (recommended; ambiguous cases require explicit reconciliation). No policy changed.
New durable grant/receipt/shared-revision schema and hosted failure tests require the separate exact
[equipment](../specs/2026-10-02-equipment-atomicity-proposal.md#exact-approval-scope) and
[action](../specs/2026-10-02-durable-character-actions-proposal.md#exact-approval-scope) approvals.
The effective state RPC, owner/nonowner authorization, fresh full journey, concurrency, committed-response
loss, creation deduplication and cleanup still need real acceptance. Local passing tests do not establish them.
