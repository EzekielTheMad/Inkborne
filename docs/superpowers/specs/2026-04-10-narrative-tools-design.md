# Narrative Tools — Design Spec

**Date:** 2026-04-10
**Sub-project:** 6 of 20 — Narrative Tools
**Scope:** Character portrait/token upload, rich narrative fields with Tiptap editor, @mentions, NPC data model, edit/view mode toggle

---

## Overview

This sub-project transforms the character dashboard's Narrative tab from a placeholder into a rich character identity and backstory tool. Players can upload portraits and VTT tokens, fill in detailed character information across prompted sections, write backstory content with a rich text editor that supports @mentions, and toggle between a clean view mode (showing only filled fields) and a full edit mode.

The narrative tools are designed for both light users (fill in a name and a few traits) and power users (write detailed backstory across multiple prompted sections with entity linking). Empty fields are hidden in view mode, so the page never feels overwhelming.

---

## Data Model

### Alter `characters` Table

Add two JSONB columns:

**`narrative`** — plain text fields for short-form character identity:

```json
{
  "full_name": "Xero, The Drowned Man",
  "aliases": "The Wraith of Crown's Wake",
  "age": "32",
  "build": "Lean, wiry",
  "origin": "Saltmarsh",
  "one_liner": "Disgraced naval officer",
  "motivation": "Find the crew that betrayed him",
  "mannerisms": "Taps his ring finger on tables",
  "fear": "Deep water, ironically",
  "portrait_url": "https://storage.supabase.co/...",
  "token_url": "https://storage.supabase.co/...",
  "fun_traits": {
    "favorite_food": "Salted pork",
    "least_favorite_food": "Eels",
    "hobby": "Whittling",
    "zodiac": "Scorpio"
  }
}
```

**`narrative_rich`** — rich text fields stored as Tiptap JSON (supports @mentions):

```json
{
  "distinguishing_features": { "type": "doc", "content": [...] },
  "backstory_origin": { "type": "doc", "content": [...] },
  "backstory_turning_point": { "type": "doc", "content": [...] },
  "backstory_left_behind": { "type": "doc", "content": [...] },
  "backstory_dm_notes": { "type": "doc", "content": [...] }
}
```

### New Table: `npcs` (data model only, no management UI)

NPCs belong to characters. Campaign visibility is derived from the character's campaign membership.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| character_id | uuid FK → characters | The character this NPC belongs to |
| created_by | uuid FK → profiles | Player who created it |
| name | text | |
| description | jsonb | Tiptap JSON for rich description |
| relationship | text | "Father", "Mentor", "Enemy" |
| visibility | text | "private", "dm_only", "campaign" |
| portrait_url | text | Nullable |
| metadata | jsonb | `{status: "alive", location: "Saltmarsh"}` etc. |
| created_at | timestamptz | |

**Visibility rules:**
- **private** — only the player sees it, even if the character is in a campaign
- **dm_only** — player + DM of the character's campaign
- **campaign** — all members of the character's campaign

Campaign association is derived from `characters.campaign_id` — not stored on the NPC. If the character moves campaigns, NPC visibility automatically applies to the new campaign's members.

**RLS policies:**
- Select: NPC creator always sees their own. DM sees `dm_only` + `campaign` NPCs for characters in their campaign. Campaign members see `campaign` NPCs.
- Insert/Update/Delete: creator only

**Future note:** DM-created NPCs will belong to campaigns (not characters) with a `campaign_id` FK. That column is added in the NPC Management sub-project (13). For now, all NPCs are player-created and character-owned.

### New Supabase Storage Bucket: `character-portraits`

Stores both portraits and VTT tokens. File naming: `{character_id}/portrait.{ext}` and `{character_id}/token.{ext}`.

---

## Character Portrait & Token

### Upload Flow

- Click the portrait area on the Narrative tab (or camera/edit icon overlay)
- File picker opens — accepts JPEG, PNG, WebP (max 5MB)
- Image uploads to Supabase Storage (`character-portraits` bucket)
- URL saved to `characters.narrative.portrait_url` or `characters.narrative.token_url`
- Displayed immediately after upload

### Portrait/Token Tab Switcher

The portrait area has two tabs: **Portrait | Token**

- Click a tab to toggle which image is displayed
- Each tab shows the image at display size, or an upload prompt if empty
- **Download button** on each — lets players grab the file for use in other platforms (Foundry, Roll20, etc.)
- Upload/replace button on each

### Display Sizes & Locations

| Location | Size | Shape |
|---|---|---|
| Narrative tab (hero) | 160x160px | Rounded square |
| Character sheet header | 40x40px | Circle |
| Characters list card | 48x48px | Circle |
| Dashboard overview | 64x64px | Circle |

All use `object-fit: cover` for framing. No cropping UI — CSS handles it.

### Fallback

When no portrait is uploaded, show the character's initials on a colored background (using the character name's first letter(s), consistent with the avatar pattern used elsewhere in the app).

---

## Tiptap Rich Text Editor Component

A shared component (`components/editor/rich-text-editor.tsx`) used for all long-form narrative fields and reusable in future sub-projects (NPC descriptions, session notes, lore wiki).

### Dependencies

```
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-placeholder @tiptap/extension-mention
```

### Toolbar

Minimal, clean toolbar above the editor area:

**B** | *I* | ~~S~~ | H2 | H3 | • | 1. | ❝ | — | 🔗

(Bold, Italic, Strikethrough, Heading 2, Heading 3, Bullet List, Ordered List, Blockquote, Horizontal Rule, Link)

### @Mentions

- Type `@` to trigger a mention dropdown
- Dropdown searches across:
  - Player characters in the same campaign (if the character is in a campaign)
  - NPCs the player has created or can see (once NPC management exists)
  - For now (no NPC UI yet): only campaign characters
- Selecting an entity inserts a mention node: `{type: "mention", attrs: {id: "uuid", label: "Xero", entityType: "character"}}`
- Mention renders as a clickable gold-accented chip/link
- Clicking navigates to that entity's page

### Storage Format

- **Tiptap JSON** for rich text fields — preserves mention nodes with entity IDs
- If an entity is renamed, the label in existing mentions becomes stale. This is acceptable for now — a mention-label-sync job can be added later if needed.

### Rendering

- In view mode: Tiptap JSON renders as styled HTML (read-only, non-editable)
- Mentions render as clickable gold-accent links
- Standard Markdown-style formatting (headings, bold, lists, etc.) rendered with appropriate typography

### Component Props

```typescript
interface RichTextEditorProps {
  content: JSONContent | null;       // Tiptap JSON content
  onChange: (content: JSONContent) => void;
  placeholder?: string;
  minHeight?: string;                // "100px" for short fields, "200px" for backstory
  campaignId?: string;               // for @mention search scope
  editable?: boolean;                // false for view mode rendering
}
```

---

## Narrative Tab Layout

### View Mode (default)

The Narrative tab renders as a clean, readable character profile. **Only sections with content are shown.** Empty sections are hidden entirely.

**Layout (top to bottom):**

1. **Portrait area** — large portrait with Portrait/Token tab switcher + download button. Initials fallback if empty.

2. **Core Identity card** — displayed as a formatted summary:
   - Full name (large, gold accent)
   - Aliases (muted, italic)
   - One-liner / former life (below name)
   - Age, Build, Origin (inline metadata row)

3. **Personality Snapshot card** — if any personality fields are filled:
   - Personality traits (from `choices` — editable here)
   - Motivation / what they want most
   - Bond / who they'd die for
   - Flaw / what gets them in trouble
   - Mannerisms
   - Fear or secret

4. **Distinguishing Features** — rendered rich text (if filled)

5. **Backstory sections** — each as its own card with a header, only shown if content exists:
   - "Where They Came From" (backstory_origin)
   - "The Turning Point" (backstory_turning_point)
   - "What They Left Behind" (backstory_left_behind)
   - "What the DM Should Know" (backstory_dm_notes)

6. **Fun Traits card** — if any fun traits filled:
   - Favorite food, least favorite food, hobby, zodiac, etc.
   - Displayed as a casual grid/chips

### Edit Mode (toggle button)

A prominent **"Edit"** button at the top of the Narrative tab toggles into edit mode.

In edit mode:
- **All sections visible** including empty ones, so the player can fill them in
- Short fields become text inputs
- Rich text fields become Tiptap editors with toolbars
- Personality traits/ideals/bonds/flaws become editable text areas (changes sync back to `characters.choices`)
- Sections grouped into collapsible categories:
  - **Core Identity** (always expanded in edit mode)
  - **Personality Snapshot**
  - **Backstory** (4 prompted sections with helper text explaining what each is for)
  - **Fun Traits** (collapsed by default — power user content)

- **Save button** at the bottom persists all changes
- **Cancel** reverts to view mode without saving
- Auto-save with debounce (500ms) as the primary save mechanism — the save button is a fallback/confirmation

### Backstory Section Prompts

Each backstory section has helper text visible in edit mode to guide the player:

| Section | Prompt |
|---|---|
| Where They Came From | Childhood, upbringing, family. What was life like before adventuring? |
| The Turning Point | What event set them on this path? What changed everything? |
| What They Left Behind | Unfinished business, people, places. What haunts them? |
| What the DM Should Know | Secrets, plot hooks, things you're handing the DM to use. Only visible to you and the DM. |

The "What the DM Should Know" section has special visibility: in a campaign, this field is visible to the player and the campaign's DM, but **not** to other players. The view mode respects this — other campaign members viewing the character don't see this section.

---

## Field Inventory

### Plain Text Fields (stored in `narrative` JSONB)

| Field | Label | Input Type |
|---|---|---|
| full_name | Full Name | Text input |
| aliases | Known Aliases / Nicknames | Text input |
| age | Age | Text input |
| build | Height / Build | Text input |
| origin | Hometown / Place of Origin | Text input |
| one_liner | Who They Were Before | Text input (placeholder: "blacksmith's apprentice, disgraced noble...") |
| motivation | What They Want Most | Text area (2 lines) |
| mannerisms | Mannerisms or Habits | Text area (2 lines, placeholder: "how they talk, nervous tics, catchphrases") |
| fear | Fear or Secret | Text area (2 lines) |
| portrait_url | — | File upload (handled separately) |
| token_url | — | File upload (handled separately) |
| fun_traits.favorite_food | Favorite Food | Text input |
| fun_traits.least_favorite_food | Least Favorite Food | Text input |
| fun_traits.hobby | Downtime Hobby | Text input |
| fun_traits.zodiac | Zodiac Sign | Text input |

### Rich Text Fields (stored in `narrative_rich` JSONB as Tiptap JSON)

| Field | Label | Editor Size | Prompt Text |
|---|---|---|---|
| distinguishing_features | Distinguishing Features | Short (100px) | Scars, tattoos, unusual physical traits |
| backstory_origin | Where They Came From | Large (200px) | Childhood, upbringing, family |
| backstory_turning_point | The Turning Point | Large (200px) | What event set them on this path? |
| backstory_left_behind | What They Left Behind | Large (200px) | Unfinished business, people, places |
| backstory_dm_notes | What the DM Should Know | Large (200px) | Secrets, plot hooks — only visible to you and the DM |

### From Builder Choices (stored in `choices` JSONB, editable on Narrative tab)

| Field | Label | Input Type |
|---|---|---|
| personality_traits | Personality Traits | Text area |
| ideals | Ideals | Text area |
| bonds | Bonds | Text area |
| flaws | Flaws | Text area |

---

## Coding Standards

- All Tailwind classes use semantic colors (bg-background, text-foreground, text-accent, etc.)
- Character name displayed in `text-accent` (gold)
- Section headers in `text-accent`
- Mention chips rendered with `text-accent` styling
- Edit mode toggle uses `bg-primary` button
- Tiptap editor border uses `border-input`, focus ring uses `ring-ring`

---

## What This Sub-Project Delivers

1. **Database migration** — add `narrative` + `narrative_rich` JSONB columns to characters; create `npcs` table with RLS; create `character-portraits` Supabase Storage bucket
2. **Character portrait upload** — portrait + VTT token with tab switcher, download button, initials fallback
3. **Tiptap rich text editor component** — shared toolbar editor with @mention support, Tiptap JSON storage, read-only rendering
4. **Narrative tab redesign** — full field layout with Core Identity, Personality, Backstory (4 prompted sections), Distinguishing Features, Fun Traits
5. **Edit/view mode toggle** — view mode hides empty fields; edit mode shows all with inputs/editors and section prompts
6. **Personality editing** — traits/ideals/bonds/flaws editable on Narrative tab, syncs to `characters.choices`
7. **@mention search** — searches campaign characters in the Tiptap editor
8. **DM-only backstory section** — "What the DM Should Know" visible only to player + campaign DM
9. **Portrait display updates** — portrait shown on character sheet header, characters list cards, dashboard overview
10. **Auto-save** — debounced save on field changes

## What This Sub-Project Does NOT Deliver

- NPC creation/management UI (sub-project 13)
- Session notes / journal / chronicling (sub-project 9)
- Character timeline / milestones (sub-project 9)
- Relationship mapping / visual web (sub-project 14)
- Goals tracker (sub-project 9)
- Portrait cropping/editing tool
- Token generation from portrait
- @mention for NPCs (NPC management not built yet — only campaign characters searchable)

---

## Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| Data storage | Two JSONB columns: `narrative` (plain text) + `narrative_rich` (Tiptap JSON) | Simple fields don't need Tiptap overhead; rich fields need entity references |
| Rich text editor | Tiptap with Markdown-style toolbar | Familiar to Discord/Notion users; toolbar for non-technical players; @mentions built-in |
| Storage format | Tiptap JSON (not Markdown) | Preserves @mention entity references; cleaner than parsing custom Markdown syntax |
| NPC ownership | NPCs belong to characters, not campaigns | NPCs travel with the character; campaign visibility derived from character's campaign |
| NPC visibility | private / dm_only / campaign | Player controls who sees their NPCs; DM gets access when character joins campaign |
| Portrait/token | Tab switcher with download button | Players need both formats; download lets them grab files for other platforms |
| Edit UX | Toggle between view/edit mode | View mode is clean (hides empty); edit mode shows everything for filling in |
| Power user fields | Fun Traits collapsed by default in edit mode | Light users aren't overwhelmed; power users expand when ready |
| DM notes visibility | Player + DM only | Plot hooks and secrets shouldn't be visible to other party members |
| Personality editing | Editable on Narrative tab, syncs to choices | Players shouldn't have to go back to the builder to tweak personality |
| @mention scope | Campaign characters only (for now) | NPCs added when NPC management UI is built |
| Auto-save | Debounced 500ms | No lost work; save button as fallback |
