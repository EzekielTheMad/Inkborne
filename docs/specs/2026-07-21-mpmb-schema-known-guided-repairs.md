# MPMB schema-known guided repairs

## Goal

Broaden the owner-only import repair workflow without accepting arbitrary JSON,
introducing a partial candidate schema, or allowing the browser to choose data
paths or diagnostic codes.

This slice repairs only finite fields for which the mapper already produces a
complete, schema-valid staged candidate. Required fields that currently prevent
a candidate from being created, and feat fields whose edits require effect
regeneration, remain deferred.

## Supported repairs

Spell repairs retain the existing material and save controls and add explicit
boolean choices for:

- `spell.concentration.invalid` → `concentration`;
- `spell.ritual.invalid` → `ritual`.

Feat repairs add:

- `feat.prerequisite.ambiguous`, `.compound`, `.unsupported`, `.invalid`, and
  blocking `feat.prereqeval.not_automated` → zero or one exact ability-score
  prerequisite;
- `feat.action.invalid` → a supported action or no tracked action;
- `feat.recovery.invalid` → a supported recovery or no recovery;
- `feat.spellcastingAbility.invalid` → a standard ability or no spellcasting
  ability.

The prerequisite replacement is `[]` or one strict
`{ stat, op: "gte", value }` condition. The ability is one of the six standard
abilities and the integer threshold is 1–30. Action and recovery values use the
existing finite schema enums. Clearing `spellcastingAbility` removes the JSON
key because that field is optional rather than nullable.

## Candidate invariant

The feat mapper currently discards every candidate with a blocking diagnostic,
even when `featDataSchema` and every effect are valid. It will instead retain a
candidate whenever identity, data, and effects are valid while leaving the item
status as `needs_info` until every blocking diagnostic is resolved. Missing feat
descriptions and any other schema-invalid candidate remain unstaged.

The mapper version is bumped. Import deduplication becomes
`(owner, system, format, source hash, mapper version)` so re-uploading a file
under the improved mapper creates a new review while same-version uploads remain
idempotent. Old reviews remain immutable audit records; raw source is not stored
and cannot be remapped in place.

## Mutation boundary

The public spell RPC is extended and a matching authenticated feat RPC is added.
Both delegate to private retryable implementations and translate optimistic
revision conflicts into non-retryable application conflicts at the public
boundary.

Each implementation:

1. derives the actor from `auth.uid()`;
2. locks the owned, open import and rejects a stale revision;
3. locks the exact uncommitted `needs_info` item;
4. requires a complete schema-shaped staged candidate;
5. rejects empty patches, unknown keys, and fields without their unresolved
   blocking diagnostic;
6. patches only the canonical allowlisted field;
7. moves resolved diagnostics to the append-only audit array and records only
   server-owned canonical field names;
8. leaves candidate effects unchanged;
9. derives status and selection from all remaining blocking diagnostics;
10. recomputes summary counts and increments the import revision atomically,
    invalidating any earlier calculation preview.

Internal implementations are executable by no API role. Public wrappers are
revoked from `PUBLIC`, `anon`, and `service_role` and granted only to
`authenticated`.

## Application boundary

The server-only data layer returns a discriminated spell/feat repair DTO. Full
candidate JSON and effects never cross into the client. The shared route renders
one of two finite forms and returns 404 for non-owned, completed, committed,
candidate-less, or unsupported repairs.

Forms use strict Zod schemas and send only the fields rendered for unresolved
diagnostics. Boolean spell fields use explicit Yes/No controls so an unchecked
control is never mistaken for a repair. Server Actions revalidate only after a
successful mutation and redirect back to the review, which must be previewed
again before commit.

## Deferred

- Candidate-less spell level, school, casting time, range, duration, and
  description repairs.
- Candidate-less feat name and description repairs.
- Feat description, scores, score maximums, and AC repairs, which must
  regenerate effects server-side to preserve preview/sheet parity.
- Cross-field spell components/material, damage, healing, area, and class-list
  repair.
- Warning-only advanced automation.

Those require an explicit partial-draft contract or a server-owned candidate and
effect rebuild; they must not be implemented as generic JSON patching.

## Verification

- Mapper tests prove safe blocked candidates are retained and schema-invalid
  candidates are not.
- Migration contracts cover version-aware deduplication, allowlists, diagnostic
  binding, ownership/locks, optimistic revision handling, audit movement,
  summary/selection transitions, preview invalidation, and grants.
- Data-layer, action, route, and component tests prove type-aware repair loading,
  strict finite inputs, no candidate leakage, explicit booleans, field errors,
  and revalidate-before-redirect.
- Hosted rollback smoke covers a mixed spell/feat review, cross-owner denial,
  extra/wrong key denial, stale-tab conflict, audit transitions, mandatory
  re-preview, private v1 commit/provenance, sharing denial, and zero residue.
