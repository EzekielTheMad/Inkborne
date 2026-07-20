# MPMB import review and private persistence

## Goal

Turn a statically parsed MPMB file into a durable, owner-only review session,
then atomically commit selected schema-valid spells and feats to the existing
versioned homebrew library. Raw JavaScript is never executed or persisted.

This slice depends on the static parser, schema mapper, immutable content
versioning, private homebrew spell, and campaign-sharing foundations.

## User flow

1. An authenticated user opens `/library/import` and chooses one `.js` or
   `.mpmb` file no larger than the parser's 2 MiB ceiling.
2. The user attests, under the versioned `private_use_v1` statement, that they
   have the right to use the file and understands imported definitions remain
   private.
3. A server-only data layer authenticates the request, sanitizes the filename,
   hashes the bytes, decodes UTF-8, runs the fail-closed parser, and maps the
   parsed source. Parser failures create no review session.
4. The database atomically stages normalized source metadata, candidates,
   provenance, and bounded diagnostics. It never receives the source text.
5. `/library/import/[id]` shows summary counts and ordered items. Valid items are
   selected by default; review-required and unsupported items cannot be
   committed in this first slice and remain visible as diagnostics.
6. The user may select or skip valid items and commit once. The database locks
   the import, rechecks ownership/status, creates personal homebrew definitions,
   lets the existing triggers snapshot version 1, and records an immutable
   import origin for every created definition in one transaction.

## Persistence model

### `content_imports`

Owner-only review-session envelope: system, format, sanitized original filename,
SHA-256, byte count, parser/mapper versions, required sheet version, normalized
`SourceList` metadata, file diagnostics, summary, attestation version/time,
status (`review`, `completed`, `cancelled`), timestamps, and a monotonic revision.

The source hash is unique per owner/system/format so accidental re-upload can
return the existing review instead of duplicating content.

### `content_import_items`

Ordered owner-derived staging rows: registry/key/type/location, mapping status,
candidate name/slug/data/effects, source references, diagnostics, selected flag,
and optional committed definition id. Candidate fields are nullable only for
non-valid mappings. JSON shape and aggregate byte budgets are enforced in the
staging RPC in addition to the parser's hard ceilings.

### `content_import_origins`

Immutable provenance for committed content: definition id, import/item ids,
format, source hash/key/registry, safe filename, parser/mapper versions, and
sharing-rights state. This table is not directly writable through the Data API.

All three public tables have RLS enabled. Authenticated users receive only the
minimum `SELECT` access needed for their own review data; staging, selection,
commit, and cancellation mutations go through narrowly granted RPCs that repeat
authentication and ownership checks. Functions revoke `PUBLIC`, `anon`, and
`service_role` execution before granting `authenticated` where required.

## Rights and sharing boundary

`private_use_v1` is an audit statement, not a campaign-sharing license. Imported
definitions are always created with `source = 'homebrew'`, `scope = 'personal'`,
and the authenticated actor as owner. Clients cannot supply those values.

`set_content_campaign_share` must reject enabling a share whenever an import
origin lacks an explicit `sharing_rights_status = 'granted'`. No grant workflow
is included here, so imported content is owner-use only. Unsharing remains
allowed. This restriction is database-enforced because hiding the sharing UI is
not an authorization boundary.

## Conflict and retry policy

- Filename, source key, or candidate slug is never trusted as database identity.
- Commit generates a stable, collision-resistant owner slug from the candidate
  slug plus a short import/item suffix.
- A completed import cannot be committed again; retries return its existing
  committed ids.
- Selection updates require the expected import revision.
- Duplicate source hashes return the existing owner review/completion record.
- Existing same-name homebrew is shown as a warning in a later conflict-resolution
  slice; this slice keeps both using distinct immutable slugs.

## Limits and privacy

- Existing Server Action request limit: 6 MiB, leaving multipart overhead above
  the parser's stricter, non-raiseable 2 MiB source limit.
- Maximum staged imports/items/JSON sizes are enforced in SQL.
- Raw source bytes and source text are discarded after hashing, parsing, and
  mapping. They are never logged, uploaded to Storage, returned to the client,
  or persisted in Postgres.
- Diagnostics retain only mapper-authored messages, paths, locations, and the
  mapper's bounded excerpts.

## Verification

- unit tests cover file validation, sanitization, UTF-8 rejection, hashing,
  parser failure, deterministic staging payloads, and safe action results;
- migration contract tests cover RLS, grants, immutable provenance, atomic
  commit, private server-derived ownership/scope/source, idempotency, size
  limits, and the database sharing prohibition;
- server data-layer tests prove auth is rechecked and raw source is absent from
  every database payload;
- component/page tests cover upload errors, review summaries, disabled invalid
  items, selection, and completed state;
- full lint, typecheck, Vitest, production build, hosted advisors, and an
  authenticated browser UAT run before rollout.

## Deferred

Editing missing fields, merge/replace conflict resolution, feat authoring UI,
preview characters, raw-file retention, public publishing, and a legally
reviewed sharing-rights grant workflow remain separate slices.
