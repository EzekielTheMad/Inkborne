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
  failed patch and keeps later changes. A shared accessible alert asks the player
  to retry the action. Cast results and rest completion wait for confirmed saves.
  Failed damage does not raise a concentration check. Character navigation resets
  the writer via the provider's character-ID key.
- Scope/acceptance: [save recovery design](specs/2026-10-02-character-save-recovery.md)
  and [character creation recovery](specs/2026-10-02-character-creation-recovery.md).
- Character creation now validates string fields, handles failed/empty inserts,
  maps stable error codes to readable copy, and blocks submission while game
  systems are unavailable. Existing single-system entry is preserved.
- The separate alpha-readiness candidate remains unmerged and preserved. It
  contains dependency/auth/E2E/security work; this branch does not absorb it.

## Verification

- Final `npm.cmd run check`: strict typecheck, zero-warning lint, 197 files /
  1,817 tests passed on the final combined character-save and creation source.
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
2. Continue [the prepared builder journey task](specs/2026-10-02-builder-journey-next.md):
   consolidate duplicate status rules and cover the local journey before changing readiness semantics.
3. Equipment grant retry safety is deferred: separate inserts/currency/confirmed
   writes need durable atomic/idempotent provenance. Session-only tracking is
   insufficient after reload or ambiguous network completion. No schema change
   is authorized; migration-history reconciliation remains a prerequisite.

## Authority

Local scoped edits, tests/builds and local commits are authorized. No push, merge,
deploy, hosted writes, existing-worktree deletion or production migration. Preserve
all unrelated work. Stop new changes near the owner's usage-reset cutoff and
leave a verified handoff; do not spend quota for its own sake.
