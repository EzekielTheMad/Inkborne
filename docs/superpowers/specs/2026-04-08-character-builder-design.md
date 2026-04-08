# D&D 5e Character Builder — Design Spec

**Date:** 2026-04-08
**Sub-project:** 3 of 9 — Character Builder
**Scope:** Characters list, character dashboard, D&D 5e creation flow, level up, live stat computation

---

## Overview

This sub-project builds the character management experience and D&D 5e character creation flow. Players can create characters, view them in a dashboard, and build their mechanical character sheet through a step-based wizard. The builder adapts to the game system's schema definition, though the UI components are D&D 5e-specific. It also handles leveling up using the same step/choice infrastructure.

The character dashboard is the hub for a character — it links to the builder, narrative tools (placeholder), and character sheet (future sub-project). The builder is transient: it's prominent when no sheet exists, and accessed via "Edit" once a sheet is created.

---

## Page Structure & Routing

```
/characters                         → Characters list (all your characters)
/characters/new                     → Create character (name, system, optional campaign)
/characters/[id]                    → Character dashboard (hub)
/characters/[id]/builder            → Builder overview (step nav + completion status)
/characters/[id]/builder/class      → Class selection & management
/characters/[id]/builder/race       → Race/Species selection
/characters/[id]/builder/background → Background selection
/characters/[id]/builder/abilities  → Ability score assignment
/characters/[id]/builder/equipment  → Starting equipment selection
```

### Characters List (`/characters`)

Shows all characters owned by the logged-in user. Each character card displays name, system, class/level (if sheet exists), and campaign (if assigned). "Create New Character" button navigates to `/characters/new`.

### Create Character (`/characters/new`)

Minimal form: character name + system selection (dropdown of published game systems). Optional campaign assignment. Submitting creates the character row in the database and redirects to the character dashboard.

### Character Dashboard (`/characters/[id]`)

The hub for a character. Three tabs:

- **Overview** — character summary: name, class, level, quick stats (if sheet exists), or a prompt to build the sheet
- **Narrative** — placeholder text fields for backstory and appearance. Personality traits, ideals, bonds, and flaws are set during the Background builder step and displayed here read-only (editable in the builder). Functional but not the polished LegendKeeper-inspired experience (that gets its own sub-project)
- **Sheet** — if no sheet exists, shows a prominent "Build Character Sheet" button that navigates to the builder. If sheet exists, shows a summary with an "Edit" button for leveling up / modifying choices. The full character sheet play-mode view is built in the next sub-project.

The tab structure supports adding more tabs in the future (images, timeline, relationships, etc.).

### Builder Overview (`/characters/[id]/builder`)

Shows all creation steps with completion indicators:
- Green check — step completed, all choices resolved
- Blue dot — step has unresolved choices
- Gray — step not yet touched

Clicking a step navigates to that step's page. Steps can be completed in any order (non-linear), though a suggested order is shown (matching D&D Beyond: Class → Background → Race → Abilities → Equipment).

### Builder Step Pages

Each step page has:
- Persistent top bar with character name + step navigation links
- Step-specific content area
- Next/Previous navigation buttons at bottom

---

## Database Changes

### Alter `characters` Table

Add columns:

| Column | Type | Default | Purpose |
|---|---|---|---|
| level | int | 1 | Total character level |
| base_stats | jsonb | '{}' | Raw ability scores: `{strength: 16, dexterity: 14, ...}` |
| choices | jsonb | '{}' | Builder selections: selected race, class(es) + levels, background, ability method, resolved choices |
| state | jsonb | '{}' | Mutable play state: current HP, spell slots used, etc. (created now, used by sheet sub-project) |

### New Table: `character_content_refs`

Tracks which content entries a character has selected, with version pinning.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| character_id | uuid FK → characters | |
| content_id | uuid FK → content_definitions | |
| content_version | int | Pinned to this version |
| context | jsonb | Metadata: `{source: "race", level: 1}`, `{source: "class", class: "fighter", level: 3}` |
| choice_source | text | Nullable. Links to `choice_id` from a choice effect, enabling reversal |

When the builder resolves a `choice` effect (e.g., player picks 2 skills), each selected grant is stored as a content ref with `choice_source` set to the `choice_id`. To change the choice later, the builder finds all refs with that `choice_source`, removes them, re-presents the choice, and creates new refs.

### RLS for `character_content_refs`

- **Select:** owner of the character + DM of the character's campaign (if campaign visibility allows)
- **Insert/Update/Delete:** character owner only

---

## Builder Step Components

### Class Step (`/characters/[id]/builder/class`)

**Initial state (no class selected):**
- `ContentBrowser` showing all class content entries for this system
- Search/filter by name
- Clicking a class opens `ContentPreview` modal showing: class name, description, hit die, primary ability, saving throws, level 1 features preview
- "Add Class" button in the modal confirms the selection

**After class selected (management view):**
- Class card showing name, icon, level dropdown (1-20)
- "Class Features" section with expandable accordions for each feature at the current level
- Features with unresolved choices show a blue indicator badge ("2 Choices")
- Expanding a feature with choices reveals a `ChoiceSelector` component
- "Level Up" — increment the level dropdown, which reveals new features and any choices they require
- "Add Another Class" link (checks multiclass prerequisites from class data against current ability scores)
- Subclass selection prompt appears when reaching the subclass level (level 3 for most classes)

### Race Step (`/characters/[id]/builder/race`)

**Initial state:**
- `ContentBrowser` showing all race content entries (labeled "Race" for 2014, "Species" for 2024 — reads from system schema `content_types`)
- Clicking a race opens `ContentPreview` showing: traits, ability bonuses, speed, size, languages

**After race selected:**
- Summary of selected race with traits listed
- Subrace selector if subraces exist
- `ChoiceSelector` components for any choice effects (language choices, tool proficiency choices)
- "Change Race" button to re-select

### Background Step (`/characters/[id]/builder/background`)

**Initial state:**
- `ContentBrowser` or dropdown showing available backgrounds
- Preview shows: feature name/description, granted proficiencies, languages

**After background selected:**
- Summary of background feature and proficiencies
- `ChoiceSelector` for language/tool choices
- Personality traits selector: pick 2 from the background's table (or write custom)
- Ideals: pick 1 (with alignment associations shown)
- Bonds: pick 1
- Flaws: pick 1
- These are stored in the character's `choices` JSONB, not as content refs

### Abilities Step (`/characters/[id]/builder/abilities`)

**Method selector dropdown:**
- Standard Array: assign [15, 14, 13, 12, 10, 8] to the six ability scores via dropdowns per stat
- Point Buy: increment/decrement buttons per stat with a point budget (27 points, scores 8-15)
- Manual Entry: direct number input per stat

**Ability score grid (3x2):**
- Each card shows: base score, racial bonus (from race effects), total, modifier
- Updates live as values change

**Saves to:** `characters.base_stats` JSONB and `characters.choices.ability_method`

### Equipment Step (`/characters/[id]/builder/equipment`)

**Placeholder implementation:**
- Starting equipment bundles from class data shown as radio buttons (A / B / C)
- Or starting gold option
- Selected equipment stored in `choices.starting_equipment`
- No full inventory management UI (deferred)

---

## Shared Components

### `ContentBrowser`

Searchable, filterable list of content entries for a given content type and system. Used by class, race, and background steps.

- Props: `systemId`, `contentType`, `onSelect`
- Fetches content_definitions from Supabase filtered by system + type + scope (platform + user's personal + shared to user's campaigns)
- Search input filters by name
- Renders as a card list with name, source, and expand arrow
- Clicking a card calls `onSelect` with the content entry

### `ContentPreview`

Modal showing full details of a content entry before the player commits to selecting it.

- Props: `content`, `onConfirm`, `onCancel`
- Displays: name, description, key stats (hit die for classes, speed for races, etc.), effects summary
- "Add [Type]" / "Cancel" buttons

### `ChoiceSelector`

Handles "choose N from these options" interactions. Used for skill proficiencies, languages, tool proficiencies, fighting styles, etc.

- Props: `choiceEffect` (the choice effect from content), `currentSelections`, `onSelect`
- Renders the available options as a selectable list/grid
- Tracks how many have been selected vs how many are required
- Validates: can't select more than `choose` count
- Saves selections as grant-type content refs with `choice_source` set to the choice effect's `choice_id`

### `BuilderStepNav`

Navigation bar showing all creation steps with completion status.

- Props: `characterId`, `steps` (from system schema), `completionStatus`
- Renders horizontal nav links with status indicators (green check, blue dot, gray)
- Highlights current step
- Steps are clickable regardless of completion order (non-linear)

### `StatPreview`

Live-computed stat summary that updates as the player makes choices.

- Props: `character`, `contentRefs`, `systemSchema`
- Runs the expression engine (evaluator) with current base stats + all effects from content refs
- Displays: ability modifiers, AC, HP, initiative, speed, proficiency bonus, saving throws
- Re-renders when base stats or content refs change
- Shown on each builder step as a sidebar or collapsible section

---

## Expression Engine Integration

The builder runs the expression engine client-side on every meaningful change:

1. Player makes a choice (selects race, picks a skill proficiency, assigns ability scores)
2. Database is updated (character row or content ref)
3. Client re-fetches or optimistically updates local state
4. Collects all effects from all `character_content_refs` for this character
5. Runs `evaluate(baseStats, allEffects, systemSchema)` from `lib/engine/evaluator.ts`
6. `StatPreview` component displays the result

For `choice` effects:
1. Builder encounters a choice effect in a content entry's effects array
2. Renders a `ChoiceSelector` with the options from the choice
3. Player selects their picks
4. For each selection, creates a `character_content_ref` with `choice_source` = the choice's `choice_id`
5. Or creates grant entries in the character's `choices` JSONB for simpler grants (proficiencies)

For level up:
1. Player clicks "Level Up" on the class management view
2. Class level increments in `choices` JSONB
3. Character `level` column increments
4. New features for that class level are revealed with any choices they require
5. Expression engine re-evaluates (proficiency bonus may change, new features apply)

---

## Data Flow: Character Creation

1. **Create character** (`/characters/new`): INSERT into `characters` with name, system_id, user_id. Redirect to dashboard.
2. **Dashboard** (`/characters/[id]`): No sheet data yet → show "Build Character Sheet" prompt. Click navigates to builder.
3. **Builder overview** (`/characters/[id]/builder`): All steps shown gray/incomplete.
4. **Class step**: Player browses classes → previews Fighter → confirms. Creates `character_content_ref` linking character to Fighter class content. Updates `choices.classes` to `[{slug: "fighter", level: 1}]`. Updates `level` to 1.
5. **Race step**: Player selects Elf → creates content ref. Resolves language/trait choices → creates grant refs with `choice_source`.
6. **Background step**: Player selects Acolyte → creates content ref. Picks personality/ideals/bonds/flaws → stored in `choices`.
7. **Abilities step**: Player picks Standard Array, assigns scores → updates `base_stats`.
8. **Equipment step**: Player picks bundle A → stored in `choices.starting_equipment`.
9. **Back to dashboard**: All steps complete. Sheet tab now shows character summary with "Edit" option.

---

## Data Flow: Level Up

1. **Dashboard** → Sheet tab → "Edit" → navigates to builder
2. **Class step**: Player changes level dropdown from 1 to 2 (or clicks "Level Up")
3. `choices.classes[0].level` updates to 2. `characters.level` updates to 2.
4. New features for Fighter level 2 appear (Action Surge)
5. If features have choices, `ChoiceSelector` components appear
6. Expression engine re-evaluates — stats update in `StatPreview`
7. Player can continue leveling or navigate to other steps

---

## Schema-Driven Adaptation

The builder reads from the system schema to adapt its labels and behavior:

- **Step labels**: reads `creation_steps` for step names ("Choose Race" vs "Choose Species")
- **Content type labels**: reads `content_types` for the display name of each type
- **Ability scores**: reads `ability_scores` for which stats exist and their names/abbreviations
- **Proficiency levels**: reads `proficiency_levels` for what proficiency options exist
- **Skills**: reads `skills` for the skill list used in `ChoiceSelector`

This means the same builder components work for both D&D 5e 2014 ("Race") and 2024 ("Species") — the system schema drives the differences.

---

## What This Sub-Project Delivers

1. **Database migration** — add `level`, `base_stats`, `choices`, `state` to `characters`; create `character_content_refs` table with RLS
2. **Characters list page** (`/characters`) — view all characters, create new
3. **Character creation flow** (`/characters/new`) — name + system selection
4. **Character dashboard** (`/characters/[id]`) — Overview, Narrative (placeholder), Sheet tabs
5. **Builder step pages** — Class, Race, Background, Abilities, Equipment (placeholder) under `/characters/[id]/builder/`
6. **Shared components** — ContentBrowser, ContentPreview, ChoiceSelector, BuilderStepNav, StatPreview
7. **Level up flow** — increment class level, resolve new feature choices
8. **Live stat computation** — expression engine runs client-side, StatPreview updates on every change
9. **Save as you go** — every choice persisted to Supabase immediately
10. **Choice reversal support** — `choice_source` field on content refs enables re-selecting choices

## What This Sub-Project Does NOT Deliver

- Polished narrative editing experience (own sub-project — LegendKeeper-inspired)
- Character sheet play-mode view (next sub-project)
- Spell selection UI (deferred — complex enough for its own sub-project)
- Full equipment/inventory management (deferred)
- Multiclass spell slot calculation UI (deferred)
- Print/PDF export (later sub-project)
- Dice roller

---

## Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| Builder scope | D&D 5e-specific, schema-driven | Builder components are D&D-specific but read labels/structure from system schema for 2014/2024 adaptation |
| Character dashboard | Hub with Overview/Narrative/Sheet tabs | Character is more than a stat sheet; dashboard is extensible for future tabs |
| Builder visibility | Transient — prominent when no sheet, accessed via "Edit" once sheet exists | Builder is a tool, not a permanent destination |
| Step navigation | Non-linear, suggested order | Players can jump between steps; matches D&D Beyond UX expectations |
| Step order | Class → Background → Race → Abilities → Equipment | Matches D&D Beyond; background before abilities matters for 2024 rules |
| Persistence | Save to database on each step | No lost work; matches D&D Beyond behavior |
| Level up | Same builder infrastructure | Class management view + feature choices are the same components |
| Stat preview | Live client-side computation | Expression engine runs on every change; instant feedback |
| Choice reversal | `choice_source` field on content refs | Links grants back to the choice that produced them; enables re-selection |
| Narrative tools | Functional placeholder | Basic text fields now; polished experience in dedicated sub-project |
| Equipment step | Placeholder — bundle selection only | Full inventory management deferred |
| Spell selection | Deferred | Complex enough for its own sub-project |
