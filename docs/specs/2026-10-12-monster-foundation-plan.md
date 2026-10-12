# R16.1 — monster schema and compendium foundation

Planning source `5ecb9a1`, integration branch `codex/launch-integration-20261011`.
Documentation only; independent challenge precedes implementation. This is the
first child of the documented M5 monster requirement, not acceptance of all M5.

## Existing boundaries

`docs/ROADMAP.md` requires monster AC, HP, attacks, saves, abilities, lair and
legendary actions, shared entitlement-aware discovery, import and separate DM
campaign use. No monster schema or renderer was located in the current registry.
`lib/schemas/content-types/index.ts` rejects unknown types. The content database
envelope stores a nonempty text type, rather than an enumerated monster exclusion;
effective target constraints and grants still need actual runtime inspection.

`lib/compendium/catalog.ts` lists eight fixed categories. Library authenticates
before browsing; `compendium-server.ts` keeps system/type/active filters and relies
on the existing account RLS for platform/private/campaign visibility. Do not add a
DM-only guard to monster browsing or create a second catalog. Current content and
version parsers can validate an added registered payload without a new table.

The MPMB mapper and persisted review constraint explicitly support spells/feats.
Monster import is a later child with a named supported input and reviewed schema
boundary; adding a registry entry does not accept importer support. Existing
character-attached NPCs are unrelated records and must remain unchanged.

## First implementation child

Own a new canonical `monster` data schema, registry entry, read-only stat-block
component, minimal compendium category/presentation/detail integration, original
fixtures and meaningful tests. No form, campaign instance, importer, combat state,
SQL, seed/source promotion, dependencies, public publishing or live data writes.

Propose an explicit versioned payload contract using existing creature-size and
damage taxonomies where appropriate: identity description/type/alignment; AC with
optional explanatory text; HP average with optional displayed dice; movement;
six named ability scores; optional declared saving-throw and skill bonuses; senses,
languages and challenge label; ordered traits/actions/reactions/legendary/lair
entries with names and original descriptions. Structured attack fields may declare
bonus, reach/range, damage and save DC/ability where present. The implementation
plan must finalize field names, required/optional/null semantics and bounds before
coding; do not invent defaults for omitted AC/HP/abilities or derive a bonus twice.

Validate finite safe numeric fields and bounded text/arrays. Display declared
values and descriptions as escaped text, without evaluating formulas, generating
rolls, inferring omitted attacks/saves or applying monster effects to a PC. This
child is a library stat block, not a combat automation claim. Preserve action order
and duplicate names where their distinct entries are intentional. Unsupported
structured inputs fail validation; no raw HTML or arbitrary runtime expression.

The new category reuses current query, pagination, provenance, system and active
filters. Add size filtering only if the canonical field agrees with the existing
query contract. CR filters, advanced combat search and DM campaign controls remain
explicit later children. Do not use category/schema availability as evidence that
current hosted definitions or entitlements exist.

## Acceptance and remaining children

Use original small/large/long-content monster fixtures, including ranged attacks,
negative modifiers, zero declared bonuses and optional legendary/lair sections.
Test canonical definition and immutable version parsing, malformed numeric/array
inputs, missing required fields, unknown/type mismatch, plain-text injection and
no execution. Test category/query preservation and existing authenticated server
filters with platform/private/shared fixture responses, clearly labeled mocked
RLS rather than actual authorization proof. Existing categories must retain their
behavior and snapshots.

Render the real detail/stat block on desktop/mobile, keyboard-reachable Library
navigation and long content with no clipping. Root owns UI/resource release,
combined check/build and independent exact-source review. All task-owned processes
must close; default hosted E2E remains prohibited without its actual approval.

Next children: private authoring with raw metadata/effect preservation and immutable
CAS; supported monster import/review/commit; separate DM campaign assignment and
instance state with exact immutable pins and membership authorization. Real owner/
foreign owner/DM/player/anonymous privacy, version races and browser-to-database
acceptance stay open. NPCs, companions and sidekicks retain their separate R17–R19
contracts and cannot be counted as implemented by this foundation.
