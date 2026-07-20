# Campaign wiki links and backlinks

**Status:** approved implementation slice
**Date:** 2026-07-19

## Goal

Campaign pages should feel interconnected without adding a second navigation
system. While editing a page, authors can reference campaign entities inline;
the referenced wiki page then shows every visible page that points back to it.

## Authoring contract

- `#` opens campaign-page suggestions scoped to the current campaign.
- `@` continues to open campaign-character suggestions.
- Suggestions are filtered by the same Supabase RLS policies as normal page
  and character reads. A user cannot discover a hidden entity through search.
- Stored TipTap mention nodes keep the target UUID, current label, and trigger
  character. Page renames do not break navigation because links use UUIDs.
- Rendered mentions link to the referenced page or character.

## Backlink contract

- A backlink is derived from a `#` mention in another campaign page.
- The backlink panel appears beneath the referenced page and links to each
  source page once, even if it contains multiple mentions.
- Backlinks are computed from the campaign pages visible to the current user.
  This is deliberate: a shared page must not reveal the title or existence of
  a DM-only source page to a player.
- The first alpha implementation scans the already-RLS-filtered page documents
  at render time. This avoids a second authorization surface and is appropriate
  for small campaign wikis. Add a normalized link index only after profiling
  shows the scan is material.

## Verification

- Unit tests cover recursive page-mention extraction and deduplication.
- Route tests cover authentication, page/character filtering, and result shape.
- Component tests cover separate `#` and `@` suggestion URLs.
- Two-account Playwright UAT proves a shared backlink is visible and a backlink
  from a DM-only page is absent from the player view.
