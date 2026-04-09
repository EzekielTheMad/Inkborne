# Character Sheet (Play Mode) — Design Spec

**Date:** 2026-04-09
**Sub-project:** 5 of 10 — Character Sheet
**Scope:** Full-page play-mode character sheet with stat display, HP tracking, conditions, skills, features, and mobile swipeable tabs

---

## Overview

This sub-project builds the play-mode character sheet — the page players have open at the table during a game session. It displays all computed stats, skills, features, and proficiencies from the expression engine, and provides interactive elements for HP tracking, conditions, death saves, and quick notes.

The sheet lives at its own URL (`/characters/[id]/sheet`) as a full-page view optimized for screen real estate. On desktop it uses a three-column layout; on mobile it uses swipeable tab sections. The character dashboard is updated to link to the sheet instead of rendering it inline.

---

## Routing

- `/characters/[id]/sheet` — Full-page character sheet (no app navigation bar, maximum viewport)
- Back button in the sheet header returns to `/characters/[id]` (dashboard)
- Dashboard Overview tab updated: remove "Sheet" tab, add prominent "Open Character Sheet" CTA button

---

## Desktop Layout: Three Columns

### Character Header (full width, top)

- Avatar (placeholder circle, image-ready)
- Character name (large, gold accent)
- Race/species, class(es) + levels, campaign name
- Inspiration toggle (near header, simple on/off)
- Action buttons: "Edit" (links to builder), back to dashboard

### Stat Ribbon (full width, below header)

Horizontal row containing:

**6 Ability Score cards** — each shows:
- Ability name (small, uppercase, muted)
- Modifier (large, prominent, e.g., "+5")
- Score (small, below modifier, e.g., "21")

**Divider**

**Combat stats** — Proficiency Bonus (gold accent), AC (gold accent, purple border), Initiative, Speed

**HP Tracker** — Current / Max with Temp below. Clickable to open a heal/damage quick-input: player types a number, clicks "Damage" or "Heal", HP updates immediately in the database.

### Left Column: Reference Stats

- **Saving Throws** — 2-column grid of individual chips. Each chip shows: proficiency indicator dot (filled purple = proficient, filled gold = expertise, hollow = not proficient), ability abbreviation, modifier value. Proficient saves have a purple border and brighter text. Non-proficient saves are muted.
- **Passive Senses** — Perception, Investigation, Insight as numbered cards with labels
- **Conditions** — toggleable condition badges. Click to activate/deactivate. Active conditions highlighted. Saved to `character.state.conditions` array.
- **Death Saves** — only visible when current HP = 0. Three success circles (green) and three failure circles (red). Clickable to toggle. Saved to `character.state.death_saves`.
- **Quick Notes** — collapsible text area for session notes. Persisted to `character.state.quick_notes`. Future connection: these notes will surface on the character dashboard's narrative tab.
- **Proficiencies** — labeled text lists for Armor, Weapons, Tools, Languages. No special visual treatment — plain categorized text.

### Center Column: Skills

Full skills list from the system schema. Each skill row shows:
- Proficiency indicator (● proficient, ◐ half/expertise marker, ○ none)
- Ability abbreviation (DEX, WIS, etc.)
- Skill name
- Computed modifier

Proficient skills: foreground text color + gold modifier. Non-proficient skills: muted text color. Subtle background difference on proficient skill rows for quick scanning.

Custom skills (from the builder) appear in alphabetical order alongside system skills with no visual distinction.

### Right Column: Tabbed Content

Tab bar with: **Actions, Spells, Inventory, Features, Notes**

**Actions tab:**
- Sub-filter pills: All, Attack, Action, Bonus Action, Reaction, Other
- Attack table: Attack name (with weapon type), Range, Hit/DC bonus, Damage dice, Notes/properties
- Attacks derived from: weapons in starting equipment (from `choices.starting_equipment`) + any weapon content refs
- Non-attack actions from class features that have action-type metadata (Second Wind, Action Surge, etc.) — displayed with descriptions
- Since full equipment management is deferred, the attack list may be limited to starting equipment for this sub-project

**Spells tab (placeholder):**
- Shows "Spell management coming soon" message
- Lists any spells from content refs with basic info (name, level, school)
- No spell slot tracking, no preparation, no casting UI

**Inventory tab (placeholder):**
- Shows starting equipment from choices
- Basic list with name, weight, quantity
- No equip/unequip, no attunement, no full inventory management

**Features tab:**
- Filter pills: All, Class Features, Species Traits, Feats
- Dynamic pills for custom content types from the character's campaign (Ship Roles, Org Ranks, etc.)
- Features listed with: name (gold accent), source citation (class + level or trait origin), description, indented sub-selections
- Custom content type entries show progression tier status (current tier highlighted, locked tiers shown but muted)

**Notes tab:**
- Full-page text area for extended notes
- Persisted to `character.state.notes`
- Separate from Quick Notes (which is always accessible in the left column)

---

## Mobile Layout: Swipeable Tabs

On viewports below `md` breakpoint, the layout transforms to swipeable tab sections:

### Tab Bar
Fixed at the top (below the compact header). Horizontally scrollable tab labels:
**Stats · Skills · Actions · Spells · Inventory · Features · Notes**

Swipe left/right to navigate between sections, or tap a tab label.

### Stats Section (mobile)
- Ability scores in a 3x2 grid
- Combat stats row (Proficiency, AC, Initiative, Speed)
- HP tracker (full-width, interactive)
- Inspiration toggle
- Saving throws (2-column grid, same chip style as desktop)
- Passive senses (3 cards in a row)
- Conditions (toggle grid)
- Death saves (only when HP = 0)
- Quick notes (collapsible)
- Proficiencies (labeled lists)

### Other Sections (mobile)
Skills, Actions, Spells, Inventory, Features, Notes — each renders as a full-screen section matching the desktop right-column tab content, adapted to full-width single-column layout.

### Mobile Character Header
Compact: character name + class/level on one line. HP prominent. Back button. Edit link. No avatar on mobile (save space).

---

## Shared Components

### CharacterHeader

Used by both the dashboard Overview tab and the sheet page. Props: character data (name, race, class, level, campaign, avatar). Renders the identity row. On the dashboard it links to the sheet; on the sheet it links back to the dashboard.

### HP Tracker

Interactive component used in the stat ribbon. Shows current/max/temp HP. Click opens a popover with:
- Number input
- "Damage" button (subtracts from current, applying to temp HP first)
- "Heal" button (adds to current, capped at max)
- "Set Temp" button
- Saves to `character.state.current_hp`, `character.state.temp_hp` via Supabase

### StatRibbon

Renders the ability score cards + combat stats + HP tracker in a horizontal row. Used only on the sheet page (dashboard uses a simpler summary).

---

## Data Flow

1. Sheet page (Server Component) fetches: character + system schema + all content refs with their content definitions
2. Runs the expression engine server-side to compute stats (for initial render)
3. Passes computed stats + raw data to client components
4. Client components render the display
5. Interactive elements (HP, conditions, death saves, notes) update `character.state` via Supabase client and optimistically update local state
6. No real-time subscriptions for this sub-project — DM view and multiplayer come in the campaign sub-project

---

## Database Changes

### Alter `character.state` Usage

The `state` JSONB column already exists. This sub-project defines its expected shape:

```typescript
interface CharacterState {
  current_hp: number;
  temp_hp: number;
  conditions: string[];          // active condition slugs
  death_saves: {
    successes: number;           // 0-3
    failures: number;            // 0-3
  };
  inspiration: boolean;
  quick_notes: string;
  notes: string;
}
```

No migration needed — the column exists with default `'{}'`. The sheet initializes missing fields with defaults on first load.

---

## Asset Specifications

The following graphical assets can be added later to enhance the sheet's visual quality. The component architecture supports drop-in replacement — no layout changes needed.

### Character Portrait
- **Location:** Sheet header, left of character name
- **Current:** 40x40px circle placeholder with border
- **Target:** User-uploaded image from Supabase Storage
- **Format:** JPEG/PNG/WebP, auto-cropped to circle via CSS `border-radius: 50%`
- **Sizes needed:** 40x40 (sheet header), 64x64 (dashboard), 120x120 (full profile view)
- **Implementation:** `<Avatar>` component already accepts `src` prop; connect to `profile.avatar_url`

### Ability Score Card Frames
- **Location:** Each of the 6 ability score cards in the stat ribbon
- **Current:** Simple bordered cards with `bg-card border-border`
- **Target:** Decorative frames (ornate borders, corner flourishes) like Foundry's shield-style ability displays
- **Format:** SVG preferred (scalable, themeable). One frame SVG reused for all 6 scores.
- **Size:** ~80x100px viewport area per card. SVG should be designed at 2x for retina.
- **Implementation:** Apply as CSS `background-image` on the card container, or wrap content in an SVG frame component

### Section Header Icons
- **Location:** Next to section titles (Saving Throws, Senses, Skills, etc.)
- **Current:** Text-only section headers with gold accent color
- **Target:** Small icons next to each section header (shield for saves, eye for senses, star for skills, etc.)
- **Format:** SVG, 16x16 or 20x20, single-color (should inherit `currentColor` for theming)
- **Implementation:** Import as React components or inline SVGs. Place before the header text.

### Condition Icons
- **Location:** Condition toggle badges
- **Current:** Text labels for each condition
- **Target:** Small icons representing each condition (eye with X for blinded, chains for restrained, etc.)
- **Format:** SVG, 16x16, single-color
- **Count:** 15 standard D&D conditions (Blinded, Charmed, Deafened, Exhaustion, Frightened, Grappled, Incapacitated, Invisible, Paralyzed, Petrified, Poisoned, Prone, Restrained, Stunned, Unconscious)
- **Implementation:** Map condition slug to icon component. Display alongside or instead of text label.

### Class Icons
- **Location:** Character header, next to class name
- **Current:** Text only ("Rogue 8")
- **Target:** Small class emblem/icon next to class name
- **Format:** SVG, 20x20, could be multi-color
- **Count:** One per class (12 for SRD classes)
- **Implementation:** Map class slug to icon. Render in header and on dashboard character cards.

### Race/Species Icons
- **Location:** Character header, next to race name
- **Current:** Text only ("Human")
- **Target:** Small race silhouette or emblem
- **Format:** SVG, 20x20
- **Count:** One per SRD race (9 for 2014 SRD)

### Mobile Tab Bar Icons
- **Location:** Mobile swipeable tab bar
- **Current:** Text labels only
- **Target:** Icons with optional text labels (shield for Stats, star for Skills, sword for Actions, etc.)
- **Format:** SVG, 20x20, single-color (inherits active/inactive color)
- **Count:** 7 (Stats, Skills, Actions, Spells, Inventory, Features, Notes)
- **Implementation:** Icon + label in tab, icon-only on very small screens

### Background Textures
- **Location:** Sheet page background, card backgrounds
- **Current:** Solid `bg-background` and `bg-card` colors
- **Target:** Subtle parchment, leather, or dark stone textures overlaid at low opacity
- **Format:** PNG/WebP, tileable, ~256x256 or ~512x512 base tile
- **Implementation:** CSS `background-image` with `opacity` or `mix-blend-mode`. Applied to `body` or card containers. Must not reduce text readability.

### Dice/Roll Icons
- **Location:** Future — next to rollable values (skill modifiers, attack bonuses, save modifiers)
- **Current:** Not implemented (dice rolling deferred)
- **Target:** Small d20 icon indicating "click to roll"
- **Format:** SVG, 14x14, single-color
- **Implementation:** Future sub-project. Placed after modifier values when dice rolling is enabled.

---

## What This Sub-Project Delivers

1. **Character sheet page** (`/characters/[id]/sheet`) — full-page play-mode view
2. **CharacterHeader component** — shared between dashboard and sheet (name, race, class, level)
3. **StatRibbon component** — ability scores + combat stats + HP tracker in horizontal row
4. **HP Tracker** — interactive heal/damage input, updates database, handles temp HP
5. **Saving throws** — card-style chips with proficiency indicators, prominent modifiers
6. **Passive senses** — perception, investigation, insight as numbered cards
7. **Conditions** — toggleable badges, saved to character state
8. **Death saves** — only visible at HP 0, clickable success/fail circles
9. **Inspiration toggle** — simple on/off in the header area
10. **Skills list** — full 18+ skills with proficiency indicators, ability labels, computed modifiers, proficient row highlighting
11. **Tabbed content** — Actions, Spells (placeholder), Inventory (placeholder), Features, Notes
12. **Features tab** — class features, species traits, feats + dynamic custom content type filter pills
13. **Quick notes** — collapsible persistent notes in the left column
14. **Proficiencies** — categorized text lists (armor, weapons, tools, languages)
15. **Desktop layout** — three-column with stat ribbon
16. **Mobile layout** — swipeable tab sections with fixed tab bar
17. **Dashboard update** — remove Sheet tab, add "Open Character Sheet" CTA on Overview
18. **Asset specifications** — documented requirements for future graphical enhancements

## What This Sub-Project Does NOT Deliver

- Dice rolling / clickable modifiers (future sub-project)
- Spell slot tracking / spell preparation / casting UI (future)
- Full inventory management / equip-unequip / attunement (future)
- Rest buttons (short/long rest resource reset) (future)
- Real-time multiplayer / DM view (campaign sub-project)
- Any graphical assets (specs documented, implementation is CSS/SVG drop-in when ready)

---

## Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| Sheet location | Own page at `/characters/[id]/sheet` | Maximum viewport for play mode; dashboard is for management |
| Dashboard integration | "Open Sheet" CTA on Overview, not a tab | Tab felt wasted showing just a button; CTA is more direct |
| Desktop layout | Three columns — saves/senses/conditions, skills, tabbed content | D&D Beyond pattern; stat ribbon keeps core stats always visible |
| Mobile layout | Swipeable tab sections with fixed tab bar | Better than long scroll; players do one thing at a time on mobile |
| Saving throws visual | Individual chips with proficiency dots and borders | More visual weight than a plain list; proficient vs non-proficient is instantly scannable |
| Death saves visibility | Hidden unless HP = 0 | No reason to show when irrelevant; cleaner sheet |
| HP interaction | Click to open heal/damage popover | Faster than field editing during combat |
| Play state scope | Display + HP + conditions + death saves + notes | Proof of concept; spell slots, rests, dice rolling layered later |
| Inline editing | HP, conditions, death saves, inspiration, notes only | Structural changes (class, race, abilities) go through the builder |
| Quick notes | Left column, always accessible, syncs to narrative later | Session notes during play feed into character story |
| Custom content in Features | Dynamic filter pills from campaign content types | Ship Roles, Org Ranks appear as their own category |
| Skills highlighting | Proficient rows get subtle background + gold modifier | Quick scan to find what you're good at |
| Asset approach | Document specs now, implement as CSS/SVG drop-in later | Don't block development on asset creation |
| Shared components | CharacterHeader used by dashboard + sheet | DRY; character identity is system-agnostic |
