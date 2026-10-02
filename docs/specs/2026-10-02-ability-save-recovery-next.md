# Next bounded task: ability-score save recovery

## Observed evidence

`app/(app)/characters/[id]/builder/abilities/abilities-step-client.tsx`
calls `void saveScores(...)` for each assignment/change. Each call writes the
entire `base_stats` object and `choices` snapshot independently. Its catch
restores `prevScores` and logs the error without player-visible recovery.
An earlier failed request can therefore restore an older local snapshot over a
newer edit, and concurrent whole-object requests can finish out of order.
Changing methods updates local state but persists only on a subsequent score edit.

## Proposed acceptance

First add local delayed/rejected-save regressions through the real ability UI.
Choose ordered saves or explicit pending-state interaction controls based on
those results. Keep the current method/ranges/point budget and system schema.
Show an accessible error and an explicit retry path. Preserve the latest edits
when an earlier request fails; define method changes and partial array saves
explicitly. Avoid rewriting character choices from stale snapshots where a
narrow existing write contract is available.

This is a proposed implementation slice, not proof that the races have been
reproduced in a browser. No schema, migration, dependency, hosted write or
equipment-grant changes are needed. Run scoped tests, full check and local build,
then update the current-state handoff. Equipment atomicity stays deferred.
