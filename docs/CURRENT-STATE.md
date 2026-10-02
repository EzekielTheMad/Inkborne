# Inkborne current work

Updated 2026-10-02. This is a local development checkpoint, not deployment proof.

## Direction

Victor prioritizes character building and the fresh-character-to-play-sheet
journey. Character mechanics and narrative/worldbuilding stay integrated. The
group already uses LegendKeeper; preserve existing campaign/narrative behavior
and compatibility, but defer expanding those surfaces.

## Baseline and work

- Verified GitHub main: `0a4acb93ab5fcda94d8efa13a87568c3315da108`.
- Local branch: `codex/playable-core-stability`, isolated from existing worktrees.
- Save recovery: ordered optimistic state patches; failure removes only the
  failed top-level patch and keeps later changes. Later absolute nested maps can
  still carry failed optimistic spends; see the critical review below.
  A shared accessible alert asks the player
  to retry the action. Cast results and rest completion wait for confirmed saves.
  Failed damage does not raise a concentration check. Character navigation resets
  the writer via the provider's character-ID key.
- Scope/acceptance: [save recovery design](specs/2026-10-02-character-save-recovery.md)
  and [character creation recovery](specs/2026-10-02-character-creation-recovery.md).
- Character creation now validates string fields, handles failed/empty inserts,
  maps stable error codes to readable copy, and blocks submission while game
  systems are unavailable. Existing single-system entry is preserved.
- Builder overview/navigation now share saved-choice status rules and expose
  accessible status/active-step text. The character-return label is corrected.
  Local journey cases include new-fighter sheet initialization and save retry.
- Ability-score edits now save in order and retain failed drafts for explicit
  retry, with visible saving/error status. Current unrelated choices are merged
  at dispatch and guarded against changes in the read/write window.
- The separate alpha-readiness candidate remains unmerged and preserved. It
  contains dependency/auth/E2E/security work; this branch does not absorb it.

## Verification

- Final `npm.cmd run check`: strict typecheck, zero-warning lint, 200 files /
  1,840 tests passed including ability-save recovery and initialization review.
- `npm.cmd run build`: passed Next 16.2.10 compile, TypeScript and 24 static pages.
  Used loopback-only Supabase placeholders and existing Google Fonts. Initial
  restricted-network attempt failed to download the two fonts; authorized network
  access resolved that build prerequisite. No production credentials were used.
- Dependencies were copied from an existing checkout with identical package and
  lock manifests. No install occurred; runtime Vitest reported 4.1.10. This is
  validation with reused dependencies, not proof of a fresh lockfile installation.
- Hosted/browser tests were not run: existing Playwright fixtures write to
  Supabase. Production availability and privacy/release gates remain unverified.

## Next bounded work

1. Character creation validation/recovery is complete locally: malformed values,
   rejected/empty inserts, readable errors and unavailable game systems are covered.
2. Builder overview/navigation consolidation is complete locally; see the
   [milestone handoff](handoffs/2026-10-02-builder-journey.md). Ability-score
   recovery is also complete locally; see its
   [handoff](handoffs/2026-10-02-ability-save-recovery.md).
3. Equipment grant retry safety is deferred: separate inserts/currency/confirmed
   writes need durable atomic/idempotent provenance. Session-only tracking is
   insufficient after reload or ambiguous network completion. No schema change
   is authorized; migration-history reconciliation remains a prerequisite.
4. [Critical save review](handoffs/2026-10-02-critical-save-review.md) reproduced
   dependent nested-map spending after a failed earlier save. Domain-level
   action rebasing remains unresolved; next small repair is pending HP controls.

## Authority

Local scoped edits, tests/builds and local commits are authorized. No push, merge,
deploy, hosted writes, existing-worktree deletion or production migration. Preserve
all unrelated work. Stop new changes near the owner's usage-reset cutoff and
leave a verified handoff; do not spend quota for its own sake.
