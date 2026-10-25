# Inkborne working handbook

Updated 2026-10-25 (America/Phoenix).

Use [CODEX-ORCHESTRATOR.md](CODEX-ORCHESTRATOR.md) to pick up operations, then
[the single current execution path](LAUNCH-ACCEPTANCE.md#current-execution-path)
and its linked handoff. The [milestone matrix](LAUNCH-ACCEPTANCE.md#milestone-matrix)
and requirement rows are the only current milestone/status/backlog definitions.
This handbook supplies working conventions, not a second A→D task queue.

## Names and current direction

The current character work is the **R06 builder workstream** (roadmap M3).
Reserve M1–M8 and M5.5 for the project milestones; retire `M1/R06` as an active
alias. Historical worker IDs, acceptance-story IDs, repair IDs and feature
subphases do not create milestones. Preserve accepted slices and follow the
current builder dependency order before moving to other requirements.

The ledger retains M1–M6/M5.5 before M8, the M7 PDF pause, the separate creature-
import pause, first-beta Daggerheart/public-publishing deferrals and unchanged
Vercel hosting. It owns the exact scope and release disposition; this page does
not create a new beta deadline or resume paused work.

## Working conventions

1. Confirm checkout, branch and Git status before editing. The continuation is
   `C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-verification`;
   preserve `C:\Projects\Inkborne` as the old backup and preserve inherited
   worktrees and unrelated changes. Use isolated workers and local checkpoints.
2. Read `AGENTS.md` and the relevant bundled Next.js guide before framework
   changes. Use existing `package.json` npm scripts. Honor the user's focused
   validation scope; exercise changed behavior in the actual app when required.
   Source, simulated, native, hosted and release evidence are distinct stages.
3. Use the exact resource/process/runtime plan in the current handoff. Check for
   suitable existing services before starting any. Record owned identities,
   enforce its memory guard and verify cleanup of only task-owned resources.
4. Preserve exact content pins, account ownership, receipts, raw effects and
   recovery behavior. Never infer whole-feature acceptance from a selected
   subcase or treat historical test totals as the current candidate's proof.
5. Reuse valid user authorization. Normal scoped local implementation, review,
   focused checks and documentation do not need repeated permission. Hosted
   data/security, publication, push/merge/deploy and new external actions retain
   their actual authorization boundaries. Keep secrets out of source/evidence.
6. Match established UI tokens and the relevant `docs/design-briefs/` references.
   Preserve existing campaign/narrative integration while finishing the builder.
7. Update the canonical ledger and linked handoff for durable outcomes; keep
   scope/acceptance changes there rather than creating another roadmap. Historical
   evidence and failed receipts remain available. GSD/superpowers process folders
   are archives, not active task-management instructions.

## Reference material

- [Architecture](architecture/00-overview.md)
- [Product requirement baseline](../inkborne-prd.md)
- [Release-gate reference](RELEASE-READINESS.md)
- [Prior handbook, tracks and dated status log](GAME-PLAN-HISTORY.md)

The previous handbook is preserved verbatim in the historical record. Its old
pickup order, invite-first tracks, counts and open-decision tables do not override
the current ledger or reactivate completed work.
