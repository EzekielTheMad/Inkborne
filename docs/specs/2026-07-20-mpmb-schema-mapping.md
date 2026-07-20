# MPMB schema mapping and diagnostics

## Purpose

Convert the fail-closed parser's static `SourceList`, `SpellsList`, and
`FeatsList` entries into schema-validated Inkborne candidates without uploading,
persisting, sharing, or executing anything. Mapping is deterministic and
non-throwing per item: a malformed item becomes `needs_info` or `unsupported`
without preventing trustworthy siblings from being reviewed.

## Boundary

This slice accepts only `ParsedMpmbSource` from the static parser. It does not
accept raw JavaScript, does not weaken parser failures, and does not interpret
functions or arbitrary helpers. It has no React, Next.js, Supabase, filesystem,
network, upload, or database dependency.

`SourceList` is provenance metadata, not a content definition. Its name,
abbreviation, group, URL, date, and default-exclusion flag are retained for the
future import audit. None of those fields proves a license or sharing right.

## Result contract

The mapper returns:

- normalized source metadata with source-level diagnostics;
- ordered spell and feat items;
- for each item, a schema-valid candidate or `null`, source references,
  diagnostics, and a `valid`, `needs_info`, or `unsupported` status;
- file diagnostics and deterministic summary counts;
- explicit parser-compatibility and mapper version identifiers.

Issues distinguish blocking missing/invalid/schema/source failures from warning
diagnostics for unmapped, lossy, or not-yet-automated mechanics. Unknown input
properties are detected before Zod validation and never copied into candidates.
Zod validation remains the final validity gate for both content data and every
effect.

## Spell policy

- Map name, level, school aliases, casting time, range, components/material,
  duration/concentration, ritual, descriptions, class/subclass/dependency slugs,
  attack type, and already-structured damage/healing/DC/AOE/cantrip scaling.
- Never infer damage, healing, save outcomes, effects, or cantrip dice from prose.
- An `M` component without material is blocking.
- MPMB source references remain mapper provenance because `SpellData` currently
  has no `source_refs` field.
- Spells produce no effects in this slice.

## Feat policy

- Map descriptions, source refs, exact single-ability prerequisites, six-value
  score arrays, action/recovery/usages, supported speed/vision/save/proficiency
  shapes, extra AC, and already schema-shaped advanced mechanics.
- Every mapped feat receives a narrative effect. Numeric score improvements and
  extra AC also receive explicit mechanical effects.
- Compound/free-text prerequisites and executable mechanics are never silently
  dropped; they block or emit `not_automated` diagnostics.
- Seven-element MPMB score arrays are rejected rather than truncated.

## Persistence and rights follow-up

Before any later commit, the server must retain the safe original filename,
SHA-256, parser/mapper versions, sheet version, SourceList metadata, per-item
location/diagnostics, and a versioned user rights attestation. The server derives
actor, system, `source: homebrew`, and `scope: personal`; imported definitions
start private and database versioning creates v1.

Campaign sharing must be blocked in the database for imported definitions until
an explicit, legally reviewed sharing-rights grant exists. UI-only hiding is not
sufficient because the campaign-sharing RPC can otherwise share ordinary
homebrew.

## Verification

- valid spell and feat candidates pass their current Zod schemas and all effects
  pass `effectSchema`;
- aliases and static helpers normalize deterministically;
- source resolution, unknown fields, missing material, compound prerequisites,
  lossy tuples, and prose-only automation gaps emit exact diagnostics;
- mixed files preserve valid siblings when another item needs information;
- mapping is deterministic and does not mutate parser output;
- architectural tests prohibit runtime, framework, persistence, and network
  dependencies.
