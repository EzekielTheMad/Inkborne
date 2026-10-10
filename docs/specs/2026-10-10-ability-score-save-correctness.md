# Ability-score save correctness

## Bounded outcome

Keep the ability-score editor's displayed method and scores consistent with its
autosaved snapshot. The current editor resets methods only in browser state,
resets scores when reselecting the active method, cannot clear a standard-array
assignment, and starts unordered writes for rapid edits.

## Approach

- Treat method and scores as one draft; persist both for every actual change.
- Serialize immutable save snapshots per signed-in owner and character. Rapid
  edits stay responsive and accumulate in the latest draft.
- Retain a failed draft, show an accessible error and retry, and disable the
  editor's Previous/Next buttons until the latest draft is saved.
- Ignore an active-method reselection; allow the empty standard-array option.
- Give each character a keyed editor. Accepted saves keep their original
  character target when it unmounts; completions cannot update another editor.
- Keep pending/failed drafts in browser memory across in-app navigation. A
  return to the character restores the draft, save/error state, and retry;
  remounts share the same ordered queue. Server-authenticated owner IDs scope
  entries; sign-out/account changes discard drafts and cancel queued writes.
  Saved inactive entries are released, and retention is capped at the most
  recent 20 inactive character editors. No localStorage is used.
- Persist through `save_character_abilities`, a narrow SECURITY INVOKER RPC
  with existing RLS plus an explicit authenticated-owner predicate. It locks
  the row, compares raw persisted method/scores, validates the new method and
  score values against the character's ability schema, and updates only those
  values. Other choices and play state are preserved.
- Reject stale editor/remount snapshots with a nonretryable application
  conflict. Only successful returned snapshots advance the expected values;
  a conflict requires reloading instead of a blind overwrite.
- No equipment, authentication configuration, live-data or deployment changes.

## Release prerequisite and limits

Migration `20261010225355_save_character_abilities.sql` must be applied through
the normal reviewed release process before deploying the new client. There is
no fallback to unsafe whole-choices writes. Generated RPC types are reconciled
to the migration contract in this change; hosted regeneration is still a
release verification step.

Previous/Next buttons wait for saves. Other builder links and browser Back are
not a universal navigation blocker: accepted requests can complete for their
original character after unmount, and the database comparison prevents stale
overwrites. If saving fails while away, returning to Abilities restores the
unsaved draft and retry state. The store-level browser-unload warning remains
active even on another app page while retained changes are unsaved.

A closed tab can still interrupt requests, and ignoring the browser warning
discards browser-memory recovery. This is not a durable offline queue and does
not retain more than 20 inactive character drafts. Browser warnings themselves
are subject to browser support. Cross-tab updates from older clients
that still use direct whole-row writes are outside this boundary.

## Verification

Component regressions cover method switches and resets, no-op reselection,
clearing and reusing an assignment, rapid edits, pending method switches,
failure/retry, navigation while pending or failed, and character/unmount
isolation, sign-out/account isolation, and SPA-exit recovery. The real migration
runs in a disposable PGlite (Postgres WASM) fixture with
synthetic auth and owner RLS, covering stale writes, other-choice preservation,
invalid data, and unauthorized access. This is not a full hosted-schema replay
or proof of concurrent multi-connection scheduling. Run strict type/lint/unit
checks and a production build with synthetic configuration; hosted
authenticated browser acceptance remains separate.

Verification on 2026-10-10: focused component/client/Postgres-WASM coverage
passes 51 tests; `npm run check` passes TypeScript, zero-warning lint, and
1,847 tests across 198 files. A production build passes with the CI's synthetic
Supabase values. An additional synthetic Chromium harness could not start in
this cloud runtime because the browser's local socket was denied, including a
supported escalation attempt. No interactive browser acceptance is claimed.
