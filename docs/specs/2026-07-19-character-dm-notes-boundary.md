# Character DM-notes security boundary

**Status:** implemented and hosted-RLS verified
**Date:** 2026-07-19

## Problem

`backstory_dm_notes` is currently nested inside `characters.narrative_rich`.
The UI hides that field from other players, but a campaign-visible character
row is readable through Supabase, so UI-only hiding is not a security boundary.

## Contract

- Move DM notes into `character_dm_notes`, keyed one-to-one by character.
- Only the character owner and that character's campaign DM may read the row.
- Only the character owner may create, update, or delete it. A DM remains a
  read-only character viewer.
- Existing notes are migrated, then removed from `characters.narrative_rich`.
- Server rendering merges an authorized note back into the UI view model so
  the existing narrative experience remains intact.
- Character copy includes the note in the same transaction as the rest of the
  character snapshot.
- Character-to-campaign backlinks may scan shared narrative fields, while DM
  notes are queried separately and can only contribute backlinks for the owner
  or campaign DM.

## Verification

- Migration contracts cover backfill, removal from shared JSON, RLS grants,
  and copy behavior.
- Server-action tests cover separate shared narrative and DM-note writes.
- Authenticated database UAT proves another campaign player cannot select the
  note while the owner and DM can.
- Shared narrative and DM notes save through one owner-only RPC transaction so
  one half cannot persist without the other.
