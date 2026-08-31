# Private homebrew magic-item authoring

## Contract

- An authenticated owner can author a private D&D 5e (2014) `magic_item` with a name, rarity, description, optional equipment category, and attunement requirement.
- The browser submits only those named fields plus edit identity/version. The server derives the authenticated `owner_id`, canonical published `dnd-5e-2014` system, `content_type = magic_item`, collision-safe slug, `source = homebrew`, `scope = personal`, `effects = []`, and initial version.
- Create returns a version-1 record. Edit updates only an active private homebrew magic item owned by the caller and only when its current version matches `expected_version`; the existing content-version trigger produces the next immutable version.
- Invalid identifiers and rows outside the owner, system, source, scope, type, or active-row boundary are indistinguishable from missing content. A stale version returns a recoverable conflict and does not overwrite the current row.
- Homebrew lists each owned item with its private scope, rarity, attunement state, exact version, and edit link. Library discovery continues through the existing personal-content entitlement query and exposes only the current version.

## Validation and safety

- Name and description are required and bounded. Rarity is one of the existing item rarities. Equipment category is optional and bounded. Attunement is parsed from a finite checkbox value.
- Server Actions authenticate independently, validate `FormData`, return only constrained user-facing errors, and never use a service-role client.
- No schema, migration, campaign-sharing, publishing, effect-authoring, weapon, armor, or general-item changes are part of this slice.

## Acceptance flow

Create a reserved private magic item, confirm it on Homebrew as version 1, save an edited version 2, discover that current personal version in Library, then delete only the reserved E2E definition.
