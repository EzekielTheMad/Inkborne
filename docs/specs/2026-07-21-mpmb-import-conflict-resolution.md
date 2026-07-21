# MPMB import conflict resolution

## Goal

Let an import owner explicitly resolve a staged spell or feat whose normalized
name matches active homebrew they already own. The first release supports two
auditable choices:

- **Keep both** creates a distinct private definition.
- **Replace** creates a new immutable version on one exact private definition.

Automatic JSON merge is intentionally excluded. It cannot preserve semantic
intent safely across normalized rules payloads.

## Conflict identity

A conflict is an active actor-owned homebrew definition with the same game
system, content type, and case-insensitive trimmed name. MPMB source keys are
not identity: community files do not guarantee they are globally unique.

Platform/SRD content, retired definitions, and content owned by another user
are never replacement targets. They do not block keep-both.

## Resolution semantics

Keep-both uses the importer's collision-resistant slug allocation and creates a
new personal definition.

Replace preserves the target definition ID and slug, updates only its name,
data, and effects, and relies on the existing version trigger to append an
immutable version. Existing character selections remain pinned to the version
they chose. The resulting definition is import-derived and private-only.

A target with `scope = 'shared'` or any campaign share row is not replaceable.
The workflow never withdraws campaign access implicitly; the owner must unshare
it first or choose keep-both.

## Persistence and provenance

`content_import_items` gains server-owned resolution intent:

- `conflict_resolution`: `keep_both` or `replace`;
- `replacement_content_id`;
- `replacement_expected_version`;
- `conflict_resolved_at`.

`content_import_origins` becomes immutable event history rather than one row per
definition. It gains a surrogate primary key, exact `content_version`,
`disposition` (`created` or `replaced`), and nullable
`replaced_from_version`. `import_item_id` remains unique so one staged item can
commit only once. Existing provenance backfills as created version 1.

The completed-import retry path returns the exact version recorded by the
origin event, not the definition's current version.

## Mutation boundaries

`list_mpmb_import_item_conflicts(target_import_id)` returns sanitized candidates
only for an owned open import. It filters ownership, system, type, active
homebrew source, and normalized name, and reports version/private/shared state
without returning definition rules payloads.

`resolve_mpmb_import_item_conflict(...)` is an authenticated
`SECURITY DEFINER` RPC with an empty search path. It:

1. derives the actor from `auth.uid()`;
2. locks the owned open import and verifies its revision;
3. locks the valid uncommitted item;
4. validates keep-both without trusting a target from the browser; or
5. locks and revalidates the exact actor-owned replacement target, including
   system, type, normalized name, version, personal scope, and zero shares;
6. persists only the validated IDs, versions, and strategy;
7. increments the import revision atomically.

`commit_mpmb_import` preflights every selected item in ordinal order before any
definition write. It recomputes live conflicts, requires an explicit strategy,
and revalidates replacement targets under lock. Keep-both inserts; replace
updates the exact definition rules payload as a unit. Every commit writes exact
version provenance. Any failure rolls back all replacements, creations, item
links, provenance, and import status changes.

Rows are locked in stable order to avoid deadlocks. Foreign-key/filter columns
used by the new conflict and provenance paths are indexed. Direct authenticated
table mutation remains unavailable; RPC execution is revoked from `PUBLIC`,
`anon`, and `service_role`, then granted only to `authenticated`.

## Application flow

- The review page badges unresolved and resolved conflicts and disables commit
  only for selected unresolved conflicts.
- `/library/import/[id]/items/[itemId]/conflict` shows the incoming item and
  sanitized matching owned definitions.
- The form requires an explicit keep-both or exact replace choice. Shared
  targets render disabled with guidance to unshare or keep both.
- Replacement copy states that the definition ID/slug remain stable, a new
  version is created, existing characters stay pinned, and imported content is
  private-only.
- The Server Action accepts only import/item IDs, expected revisions, strategy,
  and optional target ID/version. Ownership, target state, and all candidate
  data are re-read in the server-only data layer and database RPC.
- Revalidation happens before redirect. Stale import/target revisions return a
  recoverable visible conflict.

## Deferred

- Field-level conflict editing and semantic merge assistance.
- Automatic unsharing or access withdrawal.
- Candidate-less reconstruction for unsupported spell/feat shapes.
- Preview-character evaluation, which remains the next importer correctness
  slice after conflicts.

## Verification

- Migration-contract tests cover provenance cardinality/backfill, exact version
  history, constraints, indexes, RLS/grants, ownership, stable locks, shared
  target rejection, unresolved conflict rejection, keep-both, replacement,
  rollback, and completed retry idempotency.
- Server/action tests prove malformed strategies/IDs/versions never reach the
  RPC, candidate JSON never crosses the action boundary, and stale/shared
  failures map to recoverable states.
- Component/page tests cover private/shared targets, explicit choice, pending
  and error states, badges, unresolved counts, and commit gating.
- Hosted rollback smoke covers private replacement, identity preservation,
  exact provenance version, unchanged character pins, shared-target denial,
  keep-both, stale revisions, and all-or-nothing multi-item commit.
- Browser UAT covers keep-both, private replace, shared-target denial, and a
  two-tab stale-revision conflict with disposable accounts and exact cleanup.
