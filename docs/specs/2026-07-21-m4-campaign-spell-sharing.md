# M4 — Campaign-Scoped Homebrew Spell Sharing

**Date:** 2026-07-21
**Status:** Implementation contract
**Depends on:** immutable content versioning (`codex/content-versioning-release`) and the private spell vertical (`codex/private-homebrew-spell`)

## 1. Goal

Complete Inkborne's first multiplayer homebrew loop:

1. A campaign member authors a private spell.
2. They share it with one or more campaigns they belong to.
3. Another member can discover the current shared version only while adding a spell to a character in that exact campaign.
4. The character pins that exact immutable version.
5. Later edits or unsharing affect new discovery, never an existing character pin.

This slice reuses the complete campaign membership system. It does not build a campaign stub and does not introduce public publishing.

## 2. Product rules

- Content remains owned by its author. A DM may view shared campaign content but does not gain permission to edit it.
- Any campaign member may share content they own with that campaign.
- A spell may be shared with multiple campaigns.
- The definition has `scope = 'shared'` while at least one `content_shares` row exists; it returns to `personal` after the last share is removed.
- Scope is part of the immutable snapshot. The first share and final unshare therefore create new versions through the existing database trigger. Adding or removing an additional campaign while scope remains `shared` does not create a version.
- Existing character pins survive edit and unshare. New character additions use only the current usable version.
- A user who belongs to campaigns A and B must not see campaign-B content while editing a campaign-A or unassigned character.
- Retired definitions never appear in current discovery.

## 3. Authorization boundaries

### 3.1 Share mutation

`public.set_content_campaign_share(...)` is the only application write path for this slice. It runs atomically and must:

- require an authenticated user;
- lock and verify an active homebrew definition owned by that user;
- reject a stale `expected_version`;
- require campaign membership when enabling a share;
- require the campaign and definition to use the same game system;
- insert/delete the exact share row;
- derive scope from the remaining share count;
- let the existing content trigger manage version and immutable snapshots;
- return the resulting definition version, scope, and share count.

The function uses an empty search path, explicit schema qualification, least-privilege grants, and no service-role client in application code.

### 3.2 Character-aware discovery

`public.search_usable_spells_for_character(...)` must require that the caller owns the target character and filter current definitions through `private.can_use_content_version(character_id, content_id, version)`.

This is intentionally stricter than ordinary RLS visibility. RLS allows a member to read content shared to any of their campaigns; the character picker must show only content usable by the target character's exact campaign.

The query also enforces:

- matching character/definition system;
- `content_type = 'spell'`;
- `is_retired = false`;
- bounded result count;
- existing class, level, school, ritual, concentration, and name filters.

## 4. Application behavior

### Library and editing

- Owned spell queries include both `personal` and `shared` scopes.
- Ordinary spell edits preserve the current scope; editing must never silently make shared content private.
- Library cards show **Private** or **Shared · N campaigns**.
- The spell edit page includes a separate campaign access panel. Rules editing and sharing are distinct actions.
- Each campaign control has a provider-specific accessible name such as `Share with Tuesday Group` or `Stop sharing with Tuesday Group`.
- Copy explains the immutable effect of scope changes and that existing pins remain unchanged.

### Character sheet discovery

- `SpellsTab` passes the target character id to `AddSpellPanel`.
- `searchSpells` requires that id and calls the character-aware RPC.
- Picker provenance continues to show `Homebrew · vN`.
- Existing pinned spells continue loading from `content_versions`; no change is made to their render/cast path.

## 5. Non-goals

- Public publishing or a global content marketplace.
- DM editing of player-owned content or character sheets.
- Sharing an entire custom content type.
- Generalizing the library to every content type.
- Archive/delete UX.
- Importer parsing or staging.
- Automatically upgrading a character pin to a newer shared version.

## 6. Verification

### Automated

- SQL contract tests cover auth, ownership, membership, system match, optimistic versioning, scope/share-count derivation, grants, search path, character ownership, `can_use_content_version`, and retired-content exclusion.
- Domain/action/component tests cover personal/shared parsing, scope-preserving edits, campaign option/share loading, RPC inputs/results, conflict handling, library badges, accessible controls, and version guidance.
- Spell-search tests assert the character-aware RPC and all filter arguments.
- Existing immutable-pin tests remain green.

### Live two-account UAT

1. DM creates a private v1 spell and shares it with campaign A, producing the shared current version.
2. Player A sees it from a campaign-A character, adds it, prepares/casts it, and sees the exact `Homebrew · vN` pin.
3. An unassigned character and a character in campaign B cannot discover it.
4. The owner edits the spell; Player A's existing pin remains on the old name/data/version.
5. The owner shares with campaign B, then removes campaign A; scope remains shared and new campaign-A discovery stops.
6. The owner removes the final campaign; scope returns to personal and creates a new version.
7. Player A's old pinned spell remains readable and castable after unsharing.
8. All disposable campaigns, characters, definitions, and shares are removed.

## 7. Definition of done

- The multiplayer loop above is proven against hosted RLS with two accounts.
- Wrong-campaign content is absent from search rather than merely rejected on insert.
- Existing pins survive unshare without leaking the content catalog to unrelated users.
- TypeScript, strict lint, unit/integration tests, production build, and full Playwright suite pass.
- Supabase security/performance advisors have no new errors caused by this migration.
