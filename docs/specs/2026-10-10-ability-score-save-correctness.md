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

## Release status and limits

The reviewed SQL was applied to the Inkborne hosted project on 2026-10-10 at
23:22 UTC and verified at 23:23 UTC. Supabase recorded live migration version
`20261010232200`; the original PR file used source version `20261010225355`.
The repository file is now `20261010232200_save_character_abilities.sql` to
match the existing ledger entry. Its SQL bytes are unchanged:
`b31702903d0fc8fb1a31b86a5d3c0d54c01e0b69e8c57d4ba9c5a970f725e6c1` (SHA-256).

This is repository bookkeeping only: no SQL was reapplied, no live migration
history was repaired, and no other migration was renamed. Available repository
history/configuration contains no evidence that another environment applied the
original source version. Inventory every target environment before a future
broad CLI push; any other recorded source-version mapping needs deliberate
reconciliation.

**Broad CLI migration pushes still require separate reconciliation of
preexisting, unrelated history drift**, including older timestamp mismatches and
remote-only October 3 entries. This rename resolves only the ability migration's version pair. Do not
use a blanket push, forced `--include-all`, or live-history repair as a shortcut.

The live function signature, permissions and missing-identity denial were
verified without mutating characters. Successful live owner saves, integration
with the existing trigger happy path, multi-connection races, and authenticated
browser acceptance remain unverified. The live generated contract confirms the
argument/result shape; the reviewed client intentionally also permits a null
expected method for a character with no persisted allocation method. No unsafe
whole-choices fallback is used. The application PR remains draft and unmerged.

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
