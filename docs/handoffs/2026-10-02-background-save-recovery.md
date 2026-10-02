# Background save recovery — October 2, 2026

> Historical milestone record. Counts/status describe this checkpoint. Use [CURRENT-STATE](../CURRENT-STATE.md) and the [release checklist](../RELEASE-READINESS.md) for current authority.

Local checkpoint, following equipment save controls. No hosted writes or schema changes.

## Reproduction and change

Real ChoiceSelector controls reproduced overlapping background full-choice writes: a second subchoice could include an optimistic first choice that later failed. A synchronous gate now spans background replacement, narrative choices and resolved subchoices; the fieldset disables competing controls until settlement. A regression rejects the first skill save, then verifies an explicit independent tool save excludes that failed skill.

Custom narrative text previously wrote on each keystroke. It now stays in an editable local draft until blur or Enter. Failed saves retain that draft for explicit focus/blur retry. Saved values remain separate from unsaved drafts, and a successful save only clears the draft it submitted. Link/unload protection reuses the existing navigation guard with background-specific copy; explicit next/previous navigation checks pending/draft state. Native Back remains available. Activity hide/settle/reveal restores completed notes without duplicate writes.

## Verification

- `npm.cmd run check`: types, zero-warning lint, 203 files / 1,923 tests passed.
- `npm.cmd run build`: passed Next 16.2.10, TypeScript and 24 static pages using loopback-only Supabase placeholders.
- `node scripts/verify-builder-local.mjs`: nine simulated Chrome checks passed, including real background text blur save, failure, explicit retry and retained Activity completion. All remote requests blocked; no page errors. The mobile note screenshot was inspected.
- Prior `verify-play-save-local.mjs` five checks remain the HP/dialog checkpoint; no changed play implementation in this milestone.
- `git diff --check` clean.

## Limits

The gate is scoped to this retained editor instance. Full-choice writes still lack cross-client revision/atomicity guarantees; network rejection can remain ambiguous. No automatic retry or receipt protocol was added. Browser fixtures simulate routing/persistence and do not prove live Next/auth/RLS behavior. Equipment grant atomicity and required feature/subchoice readiness are separate risks. Not release-ready.
