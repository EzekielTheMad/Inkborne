# R17 library NPC plan handoff

2026-10-12. Assigned clean worker `r17-library-npc-worker`, branch
`codex/r17-library-npc-plan-20261012`, inspected base
`df8c303dbb92275c1649311e165d492e31c43df1`.

Owned changes only:

- [Foundation plan](../specs/2026-10-12-library-npc-foundation-plan.md).
- This handoff.

Static inventory covered roadmap/ledger, current character NPC table/types,
story actions/page/cards, story RLS, latest captured character-copy function,
campaign access/mention boundary, canonical definitions/version parser/trigger,
catalog/Homebrew and supported sharing/import type boundaries. Existing NPC rows
are relationships; no hosted row inventory was performed. Historical zero-row
comments were not accepted as current state.

Proposed first child: strict v1 narrative NPC schema, canonical `npc`/`npcs`
registry/catalog/detail and original rights-safe fixtures, read-only. No migration,
catalog insert, gameplay, authoring or campaign instance in that child. Plan lists
finite fields/bounds, exact production/test touchset, actual offline Library
acceptance and separately required private authoring, sharing/import, DM exact-pin
instances/relationships, lifecycle/copy and G2 real-role acceptance. Templates
contain only entitled-visible narrative/personality/relationship ideas. Actual
campaign relations and DM secrets remain instance state, never template content.

No existing `npcs` rows/backfill/character privacy/copy behavior is changed. No
automatic relation resolution, source repin, public publishing, new payments,
dependency/schema/provider changes or foreign worktree edits. Generic current
and historical content-read eligibility are explicitly insufficient to authorize
new campaign instances; pinned version deletion and narrow sharing/import DTOs
remain named dependencies.

Validation: documentation-only source reading and `git diff --check`. No install,
tests/typecheck/lint/full/build/browser, SQL/runtime/hosted writes or credentials.
No long-running process/port was started, so no task-owned listener cleanup was
needed. Root continues owning heavy/UI lanes. Plan requires independent challenge
before implementation; it does not claim R17/M5/beta acceptance.
