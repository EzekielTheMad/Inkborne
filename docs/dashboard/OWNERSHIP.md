# Inkborne reporting ownership

This is the maintained assignment record for project `inkborne`. Current
assignments are below; the partial release record states the transferred scope.
Instructions and lane handoffs link here instead of maintaining separate writer
tables. Report `owner` fields mirror these assignments for display.

The [canonical ledger](C:/Users/kaios/Documents/Codex/2026-10-11/task-2/equipment-verification/docs/LAUNCH-ACCEPTANCE.md#current-execution-path)
owns scope, priorities and acceptance. The overview summarizes that authority;
lane reports describe their own evidence and do not confer project acceptance.

| Lane ID | Reporting role | Current writer / thread | Authoritative checkout | Report | Handoff |
| --- | --- | --- | --- | --- | --- |
| `overview` | `integration` | Inkborne Project Coordinator — pickup pending; thread ID pending | `C:/Users/kaios/Documents/Codex/2026-10-11/task-2/equipment-verification` | [overview.json](C:/Users/kaios/Documents/Codex/2026-10-11/task-2/equipment-verification/docs/dashboard/overview.json) | [Coordinator handoff](C:/Users/kaios/Documents/Codex/2026-10-11/task-2/equipment-verification/docs/handoffs/2026-10-29-project-coordinator.md) |
| `character-flow` | `lane` | Character Flow — `01a1790d-be90-73d1-91f6-84e48a557ee1` | `C:/Users/kaios/Documents/Codex/2026-10-11/task-2/equipment-verification` | [character-flow.json](C:/Users/kaios/Documents/Codex/2026-10-11/task-2/equipment-verification/docs/dashboard/character-flow.json) | [Character Flow handoff](C:/Users/kaios/Documents/Codex/2026-10-11/task-2/equipment-verification/docs/handoffs/2026-10-24-builder-correction-and-casters.md) |
| `library` | `lane` | Library / Encyclopedia — `01a1888d-9110-7e90-8ee0-516640d33539` | `C:/Users/kaios/Documents/Codex/2026-10-11/task-2/library-encyclopedia` | [library.json](C:/Users/kaios/Documents/Codex/2026-10-11/task-2/library-encyclopedia/docs/dashboard/library.json) | [Library handoff](C:/Users/kaios/Documents/Codex/2026-10-11/task-2/library-encyclopedia/docs/handoffs/2026-10-29-library-encyclopedia.md) |
| `journal` | `lane` | Character Journal — `01a1888e-2454-7633-b5f5-57c36e522a82` | `C:/Users/kaios/Documents/Codex/2026-10-11/task-2/character-journal` | [journal.json](C:/Users/kaios/Documents/Codex/2026-10-11/task-2/character-journal/docs/dashboard/journal.json) | [Journal handoff](C:/Users/kaios/Documents/Codex/2026-10-11/task-2/character-journal/docs/handoffs/2026-10-29-character-journal.md) |

At every continuation, including a former writer's return, check the current
assignment before writing. Inherited instructions, an idle chat or a copied
worktree do not transfer ownership. Preserve one writer per report/worktree;
resolve an assignment/report disagreement before editing either source.

Use [Project Dashboard SOP v1](<C:/Projects/Project Dashboard/docs/REPORTING-SOP.md>)
for validation, atomic report updates and any explicitly authorized thread
replacement. Record an authorized reassignment and its handoff/release basis
here before the new writer updates report ownership. Preserve lane/report and
deliverable IDs, evidence, acceptance, registration and history. Reporting adds
no product-test or runtime requirement.

## Partial coordinator release — 2026-10-29

Effective 2026-10-29, 11:55:04 America/Phoenix (2026-10-29T18:55:04.496Z). The user explicitly requested this partial handoff.

- Former integration writer: Character Flow (`01a1790d-be90-73d1-91f6-84e48a557ee1`). Released only `inkborne/overview` (`role=integration`), the project-wide integration queue/cross-lane coordination and existing integration/acceptance responsibility.
- Reserved successor: **Inkborne Project Coordinator**, pickup/thread ID pending. Overview is `awaiting_adoption`; its former `owner.threadId` is omitted. Record the verified successor on pickup, without inventing an ID. This is a prepared release, not an observed successor checkpoint.
- Character Flow retains `inkborne/character-flow` and character product work, including the existing R08 next action. Library and Journal retain their reports, owners, worktrees and work unchanged.
- The former integration writer stops overview/global-queue writes and new project-wide acceptance decisions after this validated checkpoint. Later continuations may resume only retained Character Flow work and must recheck this record.
- Release basis, exact boundaries and pickup: [Project Coordinator handoff](C:/Users/kaios/Documents/Codex/2026-10-11/task-2/equipment-verification/docs/handoffs/2026-10-29-project-coordinator.md). Evidence requirements and approval limits remain; the transfer grants no new external, deployment, hosted/security, credential, scope or messaging permission.
- Overview and Character Flow remain in one authoritative checkout. Serialize source/document/index/commit write windows; agree exact file ownership before shared changes. No concurrent writers, new checkout or report relink is authorized by this transfer.
