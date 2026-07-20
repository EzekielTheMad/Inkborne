# Character timeline and relationships

**Status:** implemented, deployed, and UAT-covered
**Date:** 2026-07-19

## Goal

Extend the narrative tab from a static backstory into a living character
record. Timeline events and important people should use the same campaign
mentions and authorization model as the wiki without turning the character
sheet into a second campaign wiki.

## Data model

- `character_timeline_events` stores an owner-authored title, free-form date
  label, rich-text description, explicit ordering, and visibility.
- The existing unused `npcs` table becomes the character relationship store.
  Its `name`, `relationship`, rich description, visibility, and optional image
  already match the first-cut requirement; a second relationship table would
  create avoidable drift before the later library-NPC milestone.
- Rich descriptions use valid TipTap documents and inherit `#` campaign-page
  and `@` character mentions when the character belongs to a campaign.

## Authorization

- Only the character owner can create, edit, reorder, or delete entries.
- The character owner can always read every entry.
- A campaign DM can read every timeline/relationship entry for an assigned
  character but remains unable to edit the character.
- Other campaign members only see entries with `campaign` visibility.
- `dm_only` means character owner + campaign DM. Unassigned characters remain
  owner-only regardless of the stored visibility.

## UX

- Timeline and relationships appear below the existing narrative cards.
- Owners can add, edit, and remove entries inline. Other authorized viewers get
  read-only cards.
- Visibility language is product-facing: “Campaign” or “DM & me.”
- Empty states explain the value of each section without blocking the rest of
  the narrative profile.

## Verification

- Migration contracts cover valid rich documents, least-privilege grants, and
  owner/DM/member RLS boundaries.
- Server-action tests cover ownership, validation, and CRUD payloads.
- Component tests cover read-only rendering and owner controls.
- Two-account browser UAT proves campaign-shared entries appear to the DM and
  owner controls remain absent for the DM.
