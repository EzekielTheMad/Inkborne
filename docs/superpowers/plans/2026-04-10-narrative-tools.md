# Narrative Tools — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the character narrative experience with portrait/token upload, Tiptap rich text editor with @mentions, comprehensive narrative fields, and edit/view mode toggle on the character dashboard.

**Architecture:** Character narrative data stored in two JSONB columns (narrative for plain text, narrative_rich for Tiptap JSON). Portraits stored in Supabase Storage. Tiptap editor component shared across all rich text fields. Dashboard Narrative tab redesigned with collapsible sections that hide empty fields in view mode.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (Storage + DB), Tiptap (@tiptap/react, @tiptap/starter-kit, @tiptap/extension-mention, @tiptap/extension-link, @tiptap/extension-placeholder), Tailwind CSS (semantic colors only)

**Spec:** `docs/superpowers/specs/2026-04-10-narrative-tools-design.md`

---

## File Map

### Types (modify + create)
- `lib/types/character.ts` — Add `narrative`, `narrative_rich` to `Character` interface; add `NarrativeData`, `NarrativeRichData`, `FunTraits`, `Npc` types
- `lib/types/narrative.ts` — (create) Standalone narrative type definitions, Tiptap JSON content type alias, mention node types

### Database Migration (create)
- `supabase/migrations/00009_narrative_tools.sql` — Add `narrative` + `narrative_rich` JSONB columns to characters; create `npcs` table with RLS; storage bucket policy notes

### Supabase Storage (create)
- `lib/supabase/storage.ts` — (create) `uploadCharacterPortrait()`, `uploadCharacterToken()`, `deleteCharacterImage()`, `getCharacterImageUrl()` helper functions

### Server Actions (create)
- `app/(app)/characters/[id]/narrative-actions.ts` — (create) `saveNarrative()`, `saveNarrativeRich()`, `savePersonalityChoices()`, `uploadPortrait()`, `uploadToken()`, `deletePortrait()`, `deleteToken()` server actions

### API Routes (create)
- `app/api/characters/search/route.ts` — (create) GET endpoint for @mention search: `?q=term&campaignId=uuid` returning `{id, name, entityType}[]`

### Tiptap Editor (create)
- `components/editor/rich-text-editor.tsx` — (create) Shared Tiptap editor with toolbar, @mention, read-only mode
- `components/editor/mention-list.tsx` — (create) Dropdown suggestion list for @mention autocomplete
- `components/editor/rich-text-renderer.tsx` — (create) Read-only renderer that converts Tiptap JSON to styled HTML with clickable mention links
- `components/editor/editor-toolbar.tsx` — (create) Formatting toolbar: Bold, Italic, Strikethrough, H2, H3, Bullet List, Ordered List, Blockquote, Horizontal Rule, Link

### Portrait Components (create)
- `components/narrative/character-portrait.tsx` — (create) Portrait/Token tab switcher with upload, download, initials fallback (hero 160x160 rounded-square)
- `components/narrative/portrait-avatar.tsx` — (create) Reusable portrait circle for header/card/overview sizes (40/48/64px)

### Narrative Tab Components (create)
- `components/narrative/narrative-tab.tsx` — (create) Top-level client component managing edit/view toggle, auto-save state
- `components/narrative/view/core-identity-card.tsx` — (create) View mode: full name (gold accent), aliases, one-liner, age/build/origin
- `components/narrative/view/personality-card.tsx` — (create) View mode: personality traits, motivation, bond, flaw, mannerisms, fear
- `components/narrative/view/backstory-card.tsx` — (create) View mode: single backstory section rendered as rich text
- `components/narrative/view/fun-traits-card.tsx` — (create) View mode: casual chip/grid of fun traits
- `components/narrative/view/distinguishing-features-card.tsx` — (create) View mode: rich text rendered features
- `components/narrative/edit/core-identity-form.tsx` — (create) Edit mode: text inputs for all core identity fields
- `components/narrative/edit/personality-form.tsx` — (create) Edit mode: text areas for personality traits/ideals/bonds/flaws + motivation/mannerisms/fear
- `components/narrative/edit/backstory-form.tsx` — (create) Edit mode: 4 Tiptap editors with section prompts, collapsible
- `components/narrative/edit/fun-traits-form.tsx` — (create) Edit mode: text inputs for fun trait fields, collapsible
- `components/narrative/edit/distinguishing-features-form.tsx` — (create) Edit mode: short Tiptap editor

### Existing Files (modify)
- `app/(app)/characters/[id]/page.tsx` — Replace Narrative tab placeholder with NarrativeTab component; fetch narrative + narrative_rich columns; pass campaign context
- `components/sheet/character-header.tsx` — Add portrait circle (40px) replacing the initials-only placeholder
- `components/characters/character-card.tsx` — Add portrait circle (48px) to the left of card content
- `app/(app)/characters/page.tsx` — Fetch `narrative` column to get portrait_url; pass to CharacterCard

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/00009_narrative_tools.sql`

**Steps:**
- [ ] 1.1 Create migration file `supabase/migrations/00009_narrative_tools.sql`
- [ ] 1.2 Add `narrative jsonb not null default '{}'` column to `characters` table
- [ ] 1.3 Add `narrative_rich jsonb not null default '{}'` column to `characters` table
- [ ] 1.4 Create the `npcs` table with columns: `id` (uuid PK), `character_id` (uuid FK to characters ON DELETE CASCADE), `created_by` (uuid FK to profiles), `name` (text NOT NULL), `description` (jsonb default '{}'), `relationship` (text), `visibility` (text NOT NULL default 'private' CHECK in 'private','dm_only','campaign'), `portrait_url` (text), `metadata` (jsonb default '{}'), `created_at` (timestamptz default now())
- [ ] 1.5 Enable RLS on `npcs`
- [ ] 1.6 Create index `idx_npcs_character_id` on `npcs(character_id)`
- [ ] 1.7 Create index `idx_npcs_created_by` on `npcs(created_by)`
- [ ] 1.8 Create RLS SELECT policy "Creator can view own NPCs" — `created_by = auth.uid()`
- [ ] 1.9 Create RLS SELECT policy "Campaign DM can view dm_only and campaign NPCs" — joins through `npcs.character_id -> characters.campaign_id -> campaigns.owner_id` where `visibility IN ('dm_only', 'campaign')` and `campaigns.owner_id = auth.uid()`
- [ ] 1.10 Create RLS SELECT policy "Campaign members can view campaign NPCs" — joins through `npcs.character_id -> characters.campaign_id -> campaign_members.user_id` where `visibility = 'campaign'` and `campaign_members.user_id = auth.uid()`
- [ ] 1.11 Create RLS INSERT policy "Creator can insert NPCs" — `created_by = auth.uid()` and `character_id` owned by user
- [ ] 1.12 Create RLS UPDATE policy "Creator can update own NPCs" — `created_by = auth.uid()`
- [ ] 1.13 Create RLS DELETE policy "Creator can delete own NPCs" — `created_by = auth.uid()`
- [ ] 1.14 Apply migration to Supabase using the Supabase MCP `apply_migration` tool (project ID from `.env` or previous migrations)

**Acceptance:**
- The `characters` table has `narrative` and `narrative_rich` JSONB columns with `'{}'` defaults
- The `npcs` table exists with correct schema and RLS policies
- Existing character rows are unaffected (empty JSONB default)

---

## Task 2: Supabase Storage Bucket + Upload Helpers

**Files:**
- Create: `lib/supabase/storage.ts`

**Steps:**
- [ ] 2.1 Create the `character-portraits` storage bucket in Supabase. Use the Supabase dashboard or MCP tooling. The bucket should be **public** (portraits are displayed without auth tokens in `<img>` tags). Set file size limit to 5MB. Allow MIME types: `image/jpeg`, `image/png`, `image/webp`.
- [ ] 2.2 Create `lib/supabase/storage.ts` with the following exported functions:

```typescript
// uploadCharacterImage(characterId: string, file: File, type: 'portrait' | 'token'): Promise<{url: string} | {error: string}>
// - Validates file type (jpeg, png, webp) and size (5MB max)
// - Uploads to character-portraits bucket at path: {characterId}/{type}.{ext}
// - Uses upsert: true to replace existing
// - Returns public URL with cache-busting timestamp

// deleteCharacterImage(characterId: string, type: 'portrait' | 'token'): Promise<{success: true} | {error: string}>
// - Lists files matching {characterId}/{type}.* pattern
// - Removes the matching file

// getCharacterImageUrl(characterId: string, type: 'portrait' | 'token'): string | null
// - Constructs the public URL for a character image if it exists in the narrative data
// - This is a pure utility — the actual URL is stored in narrative.portrait_url / narrative.token_url
```

- [ ] 2.3 Follow the same pattern as `app/(app)/settings/actions.ts` `uploadAvatar()` for the upload flow: validate file, construct path, call `supabase.storage.from('character-portraits').upload()` with upsert, get publicUrl, append cache-busting `?t=`

**Acceptance:**
- `character-portraits` bucket exists in Supabase Storage
- `uploadCharacterImage` successfully uploads and returns a public URL
- `deleteCharacterImage` removes the stored file
- Functions handle validation errors gracefully

---

## Task 3: Install Tiptap Dependencies

**Steps:**
- [ ] 3.1 Run: `npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-placeholder @tiptap/extension-mention @tiptap/pm`
- [ ] 3.2 Verify all packages install without conflicts (check for React peer dependency issues)
- [ ] 3.3 Run `npm run build` to confirm no build regressions

**Acceptance:**
- All Tiptap packages listed in `package.json` dependencies
- `npm run build` succeeds

---

## Task 4: Narrative Types

**Files:**
- Create: `lib/types/narrative.ts`
- Modify: `lib/types/character.ts`

**Steps:**
- [ ] 4.1 Create `lib/types/narrative.ts` with the following type definitions:

```typescript
import type { JSONContent } from '@tiptap/react';

export interface FunTraits {
  favorite_food?: string;
  least_favorite_food?: string;
  hobby?: string;
  zodiac?: string;
}

export interface NarrativeData {
  full_name?: string;
  aliases?: string;
  age?: string;
  build?: string;
  origin?: string;
  one_liner?: string;
  motivation?: string;
  mannerisms?: string;
  fear?: string;
  portrait_url?: string;
  token_url?: string;
  fun_traits?: FunTraits;
}

export interface NarrativeRichData {
  distinguishing_features?: JSONContent | null;
  backstory_origin?: JSONContent | null;
  backstory_turning_point?: JSONContent | null;
  backstory_left_behind?: JSONContent | null;
  backstory_dm_notes?: JSONContent | null;
}

// Fields from CharacterChoices that are editable on the Narrative tab
export interface PersonalityFields {
  personality_traits?: string[];
  ideals?: string[];
  bonds?: string[];
  flaws?: string[];
}

export interface MentionItem {
  id: string;
  label: string;
  entityType: 'character' | 'npc';
}
```

- [ ] 4.2 Modify `lib/types/character.ts`: Add `narrative` and `narrative_rich` fields to the `Character` interface:

```typescript
import type { NarrativeData, NarrativeRichData } from './narrative';

// In Character interface, add:
narrative: NarrativeData;
narrative_rich: NarrativeRichData;
```

- [ ] 4.3 Update `CharacterWithSystem` if needed (it extends Character, so should inherit automatically — verify)
- [ ] 4.4 Update `updateCharacter()` in `lib/supabase/characters.ts` to include `narrative` and `narrative_rich` in the allowed update fields `Pick<>` type

**Acceptance:**
- All narrative types export correctly
- `Character` interface includes `narrative` and `narrative_rich` fields
- `updateCharacter` accepts narrative fields
- No TypeScript errors in existing code (new fields have defaults in DB so existing queries return `{}`)

---

## Task 5: Tiptap RichTextEditor Component

**Files:**
- Create: `components/editor/rich-text-editor.tsx`
- Create: `components/editor/editor-toolbar.tsx`
- Create: `components/editor/mention-list.tsx`
- Create: `components/editor/rich-text-renderer.tsx`

**Steps:**
- [ ] 5.1 Create `components/editor/editor-toolbar.tsx`:
  - "use client" component
  - Receives a Tiptap `editor` instance as prop
  - Renders a horizontal toolbar with icon buttons for: Bold, Italic, Strikethrough, H2, H3, Bullet List, Ordered List, Blockquote, Horizontal Rule, Link
  - Each button calls the corresponding Tiptap chain command (e.g., `editor.chain().focus().toggleBold().run()`)
  - Active state styling: buttons show `bg-secondary` when their mark/node is active
  - Use `lucide-react` icons where appropriate: `Bold`, `Italic`, `Strikethrough`, `Heading2`, `Heading3`, `List`, `ListOrdered`, `Quote`, `Minus`, `Link`
  - For Link: prompt for URL via `window.prompt()` (simple for now)
  - All Tailwind classes use semantic colors: `bg-card`, `border-input`, `text-foreground`, `text-muted-foreground`, `hover:bg-secondary`
  - Toolbar hidden when `editable` is false

- [ ] 5.2 Create `components/editor/mention-list.tsx`:
  - "use client" component
  - Implements Tiptap's `MentionList` suggestion renderer using `forwardRef` and `useImperativeHandle`
  - Displays a dropdown list of `MentionItem[]` with character name and type label
  - Arrow key navigation, Enter to select
  - Styled as a floating popover: `bg-popover`, `border-border`, `text-foreground`, gold accent (`text-accent`) on selected item
  - Shows "No results" when list is empty

- [ ] 5.3 Create `components/editor/rich-text-editor.tsx`:
  - "use client" component
  - Props: `{ content: JSONContent | null, onChange: (content: JSONContent) => void, placeholder?: string, minHeight?: string, campaignId?: string, editable?: boolean }`
  - Uses `@tiptap/react` `useEditor` with extensions: StarterKit, Link (openOnClick in view mode, autolink), Placeholder, Mention
  - Mention extension configured with:
    - `suggestion.items`: async fetch from `/api/characters/search?q=${query}&campaignId=${campaignId}` (only if campaignId provided)
    - `suggestion.render`: renders the MentionList component
    - Mention node attrs: `{ id, label, entityType }`
  - Mention nodes rendered with `renderHTML` returning a `<span>` with class `mention` and `data-id`, `data-entity-type`, `data-label` attributes
  - When `editable` is false: renders the editor in read-only mode (no toolbar, no cursor)
  - When `editable` is true: shows toolbar above editor, border around editor area
  - Editor area styled: `bg-card`, `border border-input rounded-md`, `focus-within:ring-2 ring-ring`, padding, min-height from prop
  - Prose content styling: headings get `text-foreground font-bold`, lists get proper indentation, blockquotes get `border-l-2 border-accent pl-4 italic text-muted-foreground`

- [ ] 5.4 Create `components/editor/rich-text-renderer.tsx`:
  - "use client" component
  - A thin wrapper that uses `RichTextEditor` with `editable={false}` and no onChange
  - Mention spans rendered as clickable links: `<Link href="/characters/{id}">` styled with `text-accent font-medium hover:underline cursor-pointer`
  - This is the component used in view mode cards

- [ ] 5.5 Add Tiptap prose styles to `app/globals.css`:
  - `.tiptap` class styles for editor content: paragraph spacing, heading sizes, list styling, blockquote appearance, horizontal rule styling
  - `.mention` class: `text-accent font-medium` inline styling for mention nodes
  - All colors using CSS variables (semantic)

**Acceptance:**
- RichTextEditor renders in both editable and read-only modes
- Toolbar buttons toggle formatting correctly
- @mention dropdown appears when typing `@` (when campaignId is provided)
- Mention nodes display as gold-accented inline elements
- Read-only mode shows clean formatted HTML without editing capabilities
- All colors use semantic theme variables

---

## Task 6: Character Portrait Upload Component

**Files:**
- Create: `components/narrative/character-portrait.tsx`
- Create: `components/narrative/portrait-avatar.tsx`

**Steps:**
- [ ] 6.1 Create `components/narrative/character-portrait.tsx`:
  - "use client" component
  - Props: `{ characterId: string, characterName: string, portraitUrl?: string | null, tokenUrl?: string | null, editable: boolean, onPortraitChange: (url: string | null) => void, onTokenChange: (url: string | null) => void }`
  - Renders a 160x160px rounded-lg container (hero portrait area on Narrative tab)
  - Two tabs at top: "Portrait" | "Token" — styled as small pill buttons
  - Displays the active image with `object-fit: cover` in the container
  - If no image: shows character initials (first letter(s) of name) on a `bg-muted` background, large text
  - **Upload**: When editable, clicking the image area opens a hidden `<input type="file">` accept="image/jpeg,image/png,image/webp"
  - After file selected: calls the `uploadPortrait` / `uploadToken` server action via a client-side wrapper, then calls `onPortraitChange`/`onTokenChange` with the new URL
  - **Download button**: visible on hover or always in view mode if an image exists, triggers a download of the file via constructing an anchor element
  - **Delete button**: visible in edit mode if an image exists, small trash icon, calls delete action and sets URL to null
  - Show a loading spinner during upload
  - Tailwind: `bg-card border border-border rounded-lg`, image container `rounded-md overflow-hidden`

- [ ] 6.2 Create `components/narrative/portrait-avatar.tsx`:
  - "use client" component
  - Props: `{ portraitUrl?: string | null, characterName: string, size: 'sm' | 'md' | 'lg', className?: string }`
  - Sizes: sm = 40px (header), md = 48px (card), lg = 64px (dashboard overview)
  - Renders as a circle: `rounded-full overflow-hidden`
  - If portraitUrl exists: `<img>` with `object-fit: cover`
  - If no portraitUrl: initials on `bg-muted` background (same pattern as the existing avatar placeholder in `character-header.tsx`)
  - This component is reused in character-header, character-card, and dashboard overview

**Acceptance:**
- Hero portrait area shows portrait or initials fallback at 160x160
- Tab switcher toggles between portrait and token display
- Upload works: file picker opens, image uploads, display updates
- Download button saves the image file
- Delete removes the image and shows initials fallback
- PortraitAvatar renders at all three sizes correctly

---

## Task 7: Narrative Server Actions

**Files:**
- Create: `app/(app)/characters/[id]/narrative-actions.ts`

**Steps:**
- [ ] 7.1 Create `app/(app)/characters/[id]/narrative-actions.ts` with `"use server"` directive
- [ ] 7.2 Implement `saveNarrative(characterId: string, narrative: NarrativeData)`:
  - Auth check: get user, verify user owns the character
  - Merge provided fields into existing narrative JSONB (fetch current, spread, update)
  - Use `supabase.from('characters').update({ narrative: merged }).eq('id', characterId)`
  - Return `{ success: true }` or `{ error: string }`

- [ ] 7.3 Implement `saveNarrativeRich(characterId: string, narrativeRich: Partial<NarrativeRichData>)`:
  - Same auth pattern
  - Merge with existing narrative_rich JSONB
  - Persist the Tiptap JSON content for each provided field

- [ ] 7.4 Implement `savePersonalityChoices(characterId: string, fields: PersonalityFields)`:
  - Auth check
  - Fetch current `choices` JSONB
  - Merge personality_traits, ideals, bonds, flaws into choices
  - Update the `choices` column

- [ ] 7.5 Implement `uploadPortraitAction(formData: FormData)`:
  - Extract characterId and file from FormData
  - Auth check + ownership verification
  - Call `uploadCharacterImage` from `lib/supabase/storage.ts`
  - On success, update `narrative.portrait_url` in the character record
  - Return `{ success: true, url: string }` or `{ error: string }`

- [ ] 7.6 Implement `uploadTokenAction(formData: FormData)` — same pattern as portrait but for token_url

- [ ] 7.7 Implement `deletePortraitAction(characterId: string)`:
  - Auth check + ownership
  - Call `deleteCharacterImage`
  - Set `narrative.portrait_url` to null in the character record

- [ ] 7.8 Implement `deleteTokenAction(characterId: string)` — same pattern

**Acceptance:**
- All actions verify user ownership before mutating
- `saveNarrative` merges partial updates (does not overwrite unrelated fields)
- `saveNarrativeRich` merges partial updates per-field
- `savePersonalityChoices` syncs back to the `choices` JSONB column
- Portrait/token upload and delete actions work end-to-end

---

## Task 8: @Mention Search Endpoint

**Files:**
- Create: `app/api/characters/search/route.ts`

**Steps:**
- [ ] 8.1 Create `app/api/characters/search/route.ts` as a GET route handler
- [ ] 8.2 Extract query params: `q` (search term, required), `campaignId` (uuid, required)
- [ ] 8.3 Auth check using `createClient()` from `lib/supabase/server.ts`
- [ ] 8.4 Query characters where:
  - `campaign_id` equals the provided campaignId
  - `name` ilike `%${q}%` (case-insensitive partial match)
  - Limit to 10 results
  - Select only `id` and `name`
- [ ] 8.5 Return results as JSON array: `[{ id: string, label: string, entityType: 'character' }]`
- [ ] 8.6 Handle edge cases: empty query returns empty array, missing campaignId returns empty array, SQL injection prevented by parameterized Supabase query

**Acceptance:**
- `GET /api/characters/search?q=xero&campaignId=uuid` returns matching campaign characters
- Results include `id`, `label` (character name), and `entityType: 'character'`
- Empty or missing params return empty array, not errors
- Only authenticated users can query

---

## Task 9: Narrative Tab — View Mode

**Files:**
- Create: `components/narrative/narrative-tab.tsx`
- Create: `components/narrative/view/core-identity-card.tsx`
- Create: `components/narrative/view/personality-card.tsx`
- Create: `components/narrative/view/backstory-card.tsx`
- Create: `components/narrative/view/distinguishing-features-card.tsx`
- Create: `components/narrative/view/fun-traits-card.tsx`

**Steps:**
- [ ] 9.1 Create `components/narrative/narrative-tab.tsx`:
  - "use client" component
  - Props: `{ character: Character (with narrative, narrative_rich, choices), campaignId?: string | null, isOwner: boolean, isDm: boolean }`
  - State: `editMode` boolean (default false)
  - Renders an "Edit" button (only if `isOwner`) at the top-right that toggles edit mode
  - In view mode: renders view components (only sections with content)
  - In edit mode: renders edit form components (all sections visible)
  - Layout order: Portrait, Core Identity, Personality Snapshot, Distinguishing Features, Backstory sections, Fun Traits

- [ ] 9.2 Create `components/narrative/view/core-identity-card.tsx`:
  - Props: `{ narrative: NarrativeData }`
  - Only renders if at least one core identity field is filled
  - Full name in large `text-accent font-bold` text
  - Aliases in `text-muted-foreground italic` below name
  - One-liner below aliases in `text-foreground`
  - Age, Build, Origin as an inline metadata row: `text-sm text-muted-foreground` with middot separators
  - Wrapped in a `Card` component

- [ ] 9.3 Create `components/narrative/view/personality-card.tsx`:
  - Props: `{ choices: CharacterChoices, narrative: NarrativeData }`
  - Only renders if any personality field is filled
  - Displays: personality_traits (from choices), motivation, ideals (from choices), bonds (from choices), flaws (from choices), mannerisms, fear
  - Each filled field shown as: label in `text-sm text-muted-foreground font-medium`, value in `text-sm text-foreground`
  - Wrapped in a `Card` with header "Personality"

- [ ] 9.4 Create `components/narrative/view/distinguishing-features-card.tsx`:
  - Props: `{ content: JSONContent | null }`
  - Only renders if content is not null/empty
  - Uses `RichTextRenderer` to display the Tiptap JSON
  - Wrapped in a `Card` with header "Distinguishing Features"

- [ ] 9.5 Create `components/narrative/view/backstory-card.tsx`:
  - Props: `{ fieldKey: string, title: string, content: JSONContent | null }`
  - Only renders if content is not null/empty
  - Uses `RichTextRenderer` to display the Tiptap JSON
  - Wrapped in a `Card` with header showing the title (e.g., "Where They Came From")
  - Section header in `text-accent`

- [ ] 9.6 Create `components/narrative/view/fun-traits-card.tsx`:
  - Props: `{ funTraits?: FunTraits }`
  - Only renders if at least one fun trait is filled
  - Displays traits as a grid of labeled chips/badges: `bg-secondary rounded-md px-3 py-1`
  - Labels: Favorite Food, Least Favorite Food, Downtime Hobby, Zodiac Sign
  - Wrapped in a `Card` with header "Fun Traits"

- [ ] 9.7 Wire view mode in `narrative-tab.tsx`:
  - When `editMode` is false, render the following in order:
    1. `CharacterPortrait` (editable=false)
    2. `CoreIdentityCard` (if has data)
    3. `PersonalityCard` (if has data)
    4. `DistinguishingFeaturesCard` (if has data)
    5. `BackstoryCard` for each of the 4 backstory sections (if has data)
    6. For `backstory_dm_notes`: only render if `isOwner || isDm`
    7. `FunTraitsCard` (if has data)
  - If NO sections have any content at all, show a friendly empty state: "No narrative details yet. Click Edit to bring your character to life."

**Acceptance:**
- View mode only shows sections that have content
- Empty narrative shows a clean empty state with guidance
- DM notes section hidden from non-owner/non-DM viewers
- All text uses semantic colors
- Character name displays in gold accent
- Rich text fields render formatted content with clickable mentions

---

## Task 10: Narrative Tab — Edit Mode

**Files:**
- Create: `components/narrative/edit/core-identity-form.tsx`
- Create: `components/narrative/edit/personality-form.tsx`
- Create: `components/narrative/edit/backstory-form.tsx`
- Create: `components/narrative/edit/distinguishing-features-form.tsx`
- Create: `components/narrative/edit/fun-traits-form.tsx`

**Steps:**
- [ ] 10.1 Create `components/narrative/edit/core-identity-form.tsx`:
  - "use client" component
  - Props: `{ narrative: NarrativeData, onChange: (field: string, value: string) => void }`
  - Renders text inputs (using shadcn `Input` + `Label`) for: full_name, aliases, age, build, origin, one_liner
  - Each input fires `onChange(fieldName, value)` on change
  - Placeholders from the spec (e.g., one_liner: "blacksmith's apprentice, disgraced noble...")
  - Section header "Core Identity" in `text-accent font-semibold`
  - Always expanded in edit mode (no collapsible wrapper)

- [ ] 10.2 Create `components/narrative/edit/personality-form.tsx`:
  - Props: `{ choices: CharacterChoices, narrative: NarrativeData, onChoiceChange: (field: string, value: string[]) => void, onNarrativeChange: (field: string, value: string) => void }`
  - Wrapped in an `Accordion` (collapsible), default open
  - **From choices (text areas):** personality_traits, ideals, bonds, flaws — each as a text area where items are newline-separated. On change, split by newline and call `onChoiceChange` with the array.
  - **From narrative (text areas/inputs):** motivation (2-line textarea), mannerisms (2-line textarea with placeholder "how they talk, nervous tics, catchphrases"), fear (2-line textarea)
  - Section header "Personality Snapshot" in `text-accent`

- [ ] 10.3 Create `components/narrative/edit/backstory-form.tsx`:
  - Props: `{ narrativeRich: NarrativeRichData, campaignId?: string | null, onRichChange: (field: string, content: JSONContent) => void, isOwner: boolean }`
  - Wrapped in an `Accordion` (collapsible), default open
  - Renders 4 Tiptap `RichTextEditor` components, one for each backstory field:
    - "Where They Came From" — placeholder from spec, minHeight="200px"
    - "The Turning Point" — placeholder from spec, minHeight="200px"
    - "What They Left Behind" — placeholder from spec, minHeight="200px"
    - "What the DM Should Know" — placeholder from spec, minHeight="200px", labeled with a note "(Only visible to you and the DM)"
  - Each editor's `onChange` calls `onRichChange(fieldKey, content)`
  - Each section has its helper prompt text displayed above the editor in `text-sm text-muted-foreground italic`
  - Section header "Backstory" in `text-accent`

- [ ] 10.4 Create `components/narrative/edit/distinguishing-features-form.tsx`:
  - Props: `{ content: JSONContent | null, campaignId?: string | null, onChange: (content: JSONContent) => void }`
  - Single `RichTextEditor` with placeholder "Scars, tattoos, unusual physical traits", minHeight="100px"
  - Section header "Distinguishing Features" in `text-accent`

- [ ] 10.5 Create `components/narrative/edit/fun-traits-form.tsx`:
  - Props: `{ funTraits?: FunTraits, onChange: (field: string, value: string) => void }`
  - Wrapped in an `Accordion` (collapsible), **default collapsed**
  - Text inputs for: favorite_food, least_favorite_food, hobby, zodiac
  - Section header "Fun Traits" in `text-accent`

- [ ] 10.6 Wire edit mode in `narrative-tab.tsx`:
  - When `editMode` is true:
    - Show `CharacterPortrait` with `editable={true}`
    - Show all edit form components in order, each in a `Card`
    - Maintain local state for all form fields (narrative, narrativeRich, personality choices)
    - **Auto-save with debounce (500ms)**: use a `useEffect` + `setTimeout` pattern. When any field changes, start a 500ms debounce timer. When it fires, call the appropriate server action (`saveNarrative`, `saveNarrativeRich`, or `savePersonalityChoices`). Track dirty fields to only save what changed.
    - Show a "Save" button at the bottom as a manual fallback — calls all pending saves immediately
    - Show a "Cancel" button that reverts local state to the original character data and exits edit mode
    - Show a subtle save status indicator: "Saving...", "Saved", or "Unsaved changes"
  - On toggling back to view mode after save, the view updates to reflect changes

**Acceptance:**
- All edit form sections render with correct input types
- Auto-save debounce fires after 500ms of inactivity
- Manual Save button persists all changes
- Cancel reverts all local changes
- Fun Traits section is collapsed by default
- Backstory sections show helper prompts
- DM Notes section labeled with visibility note
- Save status indicator shows current state

---

## Task 11: Integrate Narrative Tab into Character Dashboard

**Files:**
- Modify: `app/(app)/characters/[id]/page.tsx`

**Steps:**
- [ ] 11.1 Update the Supabase query in the page to also select `narrative` and `narrative_rich` columns (they should come through with `select("*")` after migration, but verify)
- [ ] 11.2 Determine `isOwner` by comparing `character.user_id === user.id`
- [ ] 11.3 Determine `isDm` by checking if the user is the DM of the character's campaign (query `campaigns` table if `character.campaign_id` exists, check `owner_id === user.id`)
- [ ] 11.4 Replace the entire Narrative `TabsContent` placeholder with the `NarrativeTab` component:

```tsx
<TabsContent value="narrative" className="space-y-4 mt-4">
  <NarrativeTab
    character={character}
    campaignId={character.campaign_id}
    isOwner={isOwner}
    isDm={isDm}
  />
</TabsContent>
```

- [ ] 11.5 Remove the old hardcoded personality traits display code from the Narrative tab
- [ ] 11.6 Add portrait to the Overview tab header area: show `PortraitAvatar` (size="lg", 64px) next to the character name in the page header at the top

**Acceptance:**
- Narrative tab loads the new NarrativeTab component
- View mode works: shows filled fields, hides empty ones
- Edit mode works: all fields editable, auto-save + manual save work
- DM notes visibility enforced based on isOwner/isDm
- Portrait shows in dashboard overview header
- No regressions on the Overview tab

---

## Task 12: Portrait Display Updates (Header, Card, List)

**Files:**
- Modify: `components/sheet/character-header.tsx`
- Modify: `components/characters/character-card.tsx`
- Modify: `app/(app)/characters/page.tsx`

**Steps:**
- [ ] 12.1 Modify `components/sheet/character-header.tsx`:
  - Import `PortraitAvatar`
  - Replace the hardcoded initials `<div>` (the 12x12 circle with initial) with `<PortraitAvatar portraitUrl={character.narrative?.portrait_url} characterName={character.name} size="sm" />`
  - For mobile header: also add a small portrait avatar (can be even smaller, but use size="sm")
  - This requires `character.narrative` to be available — the `CharacterWithSystem` type already includes narrative after Task 4 type updates

- [ ] 12.2 Modify `components/characters/character-card.tsx`:
  - Import `PortraitAvatar`
  - Add a portrait avatar (size="md", 48px circle) to the left of the card header content
  - Update the Card layout to use `flex` with the avatar on the left and title/description on the right
  - Props: the character already includes narrative from the query in the parent page

- [ ] 12.3 Modify `app/(app)/characters/page.tsx`:
  - Update the Supabase query to include `narrative` in the select: currently selects `"*, game_systems (name), campaigns (name)"` — narrative comes through `*` but verify the data is passed correctly to `CharacterCard`
  - If `CharacterCard` needs the portrait URL separately, extract it and pass it

**Acceptance:**
- Character sheet header shows portrait circle (40px) instead of just an initial letter
- Character cards on the list page show portrait circle (48px) aligned left
- Fallback initials show when no portrait is uploaded
- No layout shifts or broken styling

---

## Task 13: DM-Only Backstory Section Visibility

**Steps:**
- [ ] 13.1 Verify in `narrative-tab.tsx` view mode that `backstory_dm_notes` only renders when `isOwner || isDm` (should be handled in Task 9.7, but double-check)
- [ ] 13.2 Verify in edit mode that the DM notes editor only shows for the character owner (isDm should not see the edit form — they can only read it)
- [ ] 13.3 Add a visual indicator on the DM notes section: a small lock/eye icon and text "Only visible to you and the DM" in `text-muted-foreground text-xs`
- [ ] 13.4 Test scenario: when viewing another player's character in a campaign (as a non-DM player), the DM notes section should be completely hidden in view mode

**Acceptance:**
- Character owner sees DM notes in both view and edit mode
- Campaign DM sees DM notes in view mode only
- Other campaign members do NOT see DM notes at all
- Visual label clearly communicates restricted visibility

---

## Task 14: Final Verification

**Steps:**
- [ ] 14.1 Run `npm run build` — confirm zero TypeScript errors and successful build
- [ ] 14.2 Run `npm run lint` — fix any linting issues
- [ ] 14.3 Run `npm test` — confirm no test regressions
- [ ] 14.4 Manual verification checklist:
  - [ ] Create a character, go to Narrative tab — see empty state
  - [ ] Click Edit — see all sections with input fields
  - [ ] Fill in core identity fields — see auto-save indicator
  - [ ] Upload a portrait — see it displayed immediately
  - [ ] Switch to Token tab, upload a token — see it displayed
  - [ ] Download the portrait — file downloads
  - [ ] Fill in personality fields — verify they save
  - [ ] Write in a backstory section with formatting (bold, lists) — verify toolbar works
  - [ ] If in a campaign, type @ in a backstory editor — see mention dropdown with campaign characters
  - [ ] Select a mention — see gold-accented mention chip
  - [ ] Cancel edit — changes revert
  - [ ] Save and switch to view mode — only filled sections visible
  - [ ] Check character header on sheet page — portrait shows (40px circle)
  - [ ] Check characters list page — portrait shows on cards (48px circle)
  - [ ] Verify DM notes hidden for non-owner, non-DM viewers
- [ ] 14.5 Commit all changes with a descriptive commit message

**Acceptance:**
- Build, lint, and tests all pass
- Full narrative editing flow works end-to-end
- Portrait upload/display works across all locations
- Tiptap editor formatting and @mentions function correctly
- View/edit mode toggle works cleanly
- Auto-save debounce works without data loss
- DM notes visibility properly restricted

---

## Dependency Graph

```
Task 1 (DB Migration)
  |
  +---> Task 2 (Storage Bucket) ---> Task 6 (Portrait Component) ---> Task 12 (Portrait Display)
  |
  +---> Task 3 (Tiptap Install) ---> Task 5 (Tiptap Editor) ---> Task 10 (Edit Mode)
  |                                                                   |
  +---> Task 4 (Narrative Types) ---> Task 7 (Server Actions) -------+---> Task 11 (Dashboard Integration)
  |                                                                   |
  +---> Task 8 (@Mention Search) -----> (used by Task 5)             |
  |                                                                   |
  +---> Task 9 (View Mode) ------------------------------------------+
                                                                      |
                                                              Task 13 (DM Visibility)
                                                                      |
                                                              Task 14 (Final Verification)
```

**Parallelizable groups:**
- Tasks 1, 3 can run in parallel (no code dependencies)
- Tasks 2, 4, 8 can run in parallel after Task 1 (only DB migration needed)
- Tasks 5, 6 can run in parallel after their dependencies
- Tasks 9, 10 can run in parallel (view and edit are independent, both need Task 5)
- Task 11 depends on Tasks 9 + 10
- Task 12 depends on Task 6 + Task 4
- Task 13 depends on Task 11
- Task 14 is always last

---

## Coding Standards Reminders

1. **ALL Tailwind classes use semantic colors** — `bg-background`, `text-foreground`, `text-accent`, `bg-card`, `border-border`, `text-muted-foreground`, `bg-secondary`, `bg-muted`, `border-input`, `ring-ring`. NEVER use raw hex/color values like `bg-amber-500` or `text-gray-300`.
2. **Gold accent (`text-accent`)** used for: character full names, section headers in view mode, mention chips/links, active tab indicators.
3. **shadcn/ui components**: Card, Button, Input, Label, Tabs, Accordion, Avatar, Badge, Separator. Import from `@/components/ui/`.
4. **Server Components** for data fetching (page.tsx). **Client Components** (`"use client"`) for interactivity (forms, editors, toggles).
5. **Server actions** use `"use server"` directive, authenticate with Supabase, verify ownership before mutations.
6. **No placeholder code** — every step produces working, complete code.
7. **Tiptap editor** handles all formatting through the toolbar — users should not need to know Markdown syntax.
8. **File uploads** follow the pattern established in `app/(app)/settings/actions.ts` — validate type/size, upload to Supabase Storage with upsert, return public URL with cache-busting timestamp.
