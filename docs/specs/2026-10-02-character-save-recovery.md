# Character save recovery

## Product decision

Prioritize a fresh character's builder-to-play-sheet journey. Preserve the
integrated character narrative/campaign surfaces; the group already uses
LegendKeeper, so worldbuilding expansion is deferred.

## Scope and persistence contract

Keep the existing shallow `patch_character_state` RPC and optimistic UI.
Serialize writes in each mounted character session. Maintain confirmed state
plus pending patches; remove failed patches and recompute the visible state
without restoring an old snapshot over later edits. Return an explicit success
result for workflows that present completion. Ordinary controls may ignore the
result, because the shared accessible error message remains visible.

Casts show results only after a successful state save. Rests close only after a
successful save; failures leave the dialog available for another attempt.
Damage triggers concentration checks only after successful persistence. A failed
concentration-drop save keeps its pending prompt. Key the provider by character
ID so a writer cannot target a previous character after navigation.

No automatic retry, offline persistence, new service, schema change, provider
configuration, hosted test or deployment is part of this milestone. A failed
network response can be ambiguous about remote completion; the existing RPC
uses absolute patches, but this change is not a cross-client consistency model.

## Equipment follow-up boundary

Starting-equipment confirmation performs separate inventory inserts, currency
patching and a final confirmed flag. The existing schema offers no transaction
covering the whole grant. Tracking successful inserts only in a React session
would not prove safety after reloads, multiple tabs or a committed insert whose
response was lost. Do not claim retry safety from that approach. A later bounded
task should define an authorized, idempotent atomic grant and its provenance,
after migration-history reconciliation and separate schema authorization.

## Acceptance

- Earlier failed saves cannot overwrite later pending or successful edits.
- Failed keys return to confirmed values; another explicit attempt can succeed.
- Cast failures stay in configuration and offer retry rather than results.
- Rest actions wait, prevent duplicate clicks, and stay open on failure.
- Existing rules, builder, sheet, authorization and worldbuilding tests pass.
- Validation records distinguish local checks from hosted behavior.
