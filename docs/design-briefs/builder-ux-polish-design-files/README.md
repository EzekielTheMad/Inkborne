# Handoff: Builder UX Polish

## Overview

This package contains the design exploration for two Inkbourne Character Builder surfaces:

1. **Content Preview Modal** — a richer modal that opens when a player taps a class / race / background in the builder. Shows the full feature set (not just a marketing blurb) so a player can decide before committing.
2. **Class Step** — the screen where the player picks class + level + subclass + level-by-level features. Includes a full multiclass flow, level-up flow, and a character-color exploration that affects how class color is applied across the rest of the app.

Both surfaces have multiple variants. The recommended directions are called out below; everything else is preserved as exploration so trade-offs are visible.

---

## About the Design Files

The `.html` and `.jsx` files in this bundle are **design references** built as a Babel-transpiled React prototype that runs from a single `Builder UX Polish.html` file in the browser. They are not production code to copy directly.

The implementation task is to **recreate these designs in the Inkbourne Next.js codebase** (`EzekielTheMad/Inkborne` on GitHub), using its existing patterns:

- Next.js + React (existing app) — use the existing routing, page structure, and server component patterns
- Tailwind + the existing tokens in `globals.css` (HSL CSS variables: `--primary`, `--accent`, `--card`, etc.) — do not import the prototype's `inkborne-tokens.css`; map the values into the existing token system
- The existing shadcn-style component layer (`components/ui/*`, `components/builder/*`, `components/sheet/*`)
- `lib/types/character.ts` and `lib/data.ts` for data shapes and SRD content lookups

The prototype is **a visual + behavioral spec**, not a code template.

---

## Fidelity

**High-fidelity.** Final colors, typography, spacing, interactions, copy, and motion are all settled. Recreate the UI as closely as possible to the prototype using the codebase's existing libraries (Tailwind classes mapped to the tokens listed below, shadcn primitives where applicable). The visual decisions in this bundle have been reviewed and approved.

The prototype uses inline `style={{ ... }}` for ergonomics in a single-file demo; that is **not** the convention to ship. Translate every inline style into Tailwind classes against the existing token system.

---

## Design Tokens

These are the canonical values used throughout the design. All exist (or should exist) in the codebase's HSL-based Tailwind tokens. The prototype's `inkborne-tokens.css` is a hex-based mirror for self-contained rendering — **use the codebase's existing variables, not these literal values, unless a value is missing.**

### Color

| Token | Hex | Use |
|---|---|---|
| `--background` | `#0b0a10` | Page surface |
| `--card` | `#13111d` | Modals, side rails, raised surfaces |
| `--foreground` | `#f0eef5` | Primary text |
| `--muted-foreground` | rgba(255,255,255,0.55) | Secondary text, subtitles |
| `--border` | rgba(255,255,255,0.1) | All hairline borders |
| `--accent` (gold) | `#c9a44a` | Primary CTA, gold class chrome (Paladin, Fighter, etc.) |
| `--primary` (purple) | `#7c3aed` | Casters' class chrome (Wizard, Sorcerer, Warlock) |

### Class color tone (for emblems and rails)

| Class tone | Background | Border | Foreground |
|---|---|---|---|
| `gold` | rgba(201,164,74,0.18) | rgba(201,164,74,0.5) | `#c9a44a` |
| `purple` | rgba(124,58,237,0.2) | rgba(124,58,237,0.55) | `#c7b0ff` |

The two tones are sufficient for the v1 multiclass flow. If/when more classes need distinct tones, use `oklch()` values seeded from the brand purple at the same lightness/chroma.

### Character primary color

The character has **one user-pickable primary color** that is set on the character page (`/characters/[id]`), not in the builder. The builder reads it from character state. Picker UI is out of scope for this handoff.

### Spacing

Use the existing Tailwind scale. The prototype's hand-tuned values:

- Card padding: `12px 14px` (`p-3` / `p-3.5`)
- Step header padding: `16px 28px`
- Sidebar rail width (desktop): `240px` for grouped, `216px` for unified
- Modal artboard: `1120 × 820`
- Mobile artboard: `390 × 844` (iPhone 14/15 logical)
- Gap between rail items: `3–4px` for level pills inside a class group, `10–12px` between class sections

### Typography

| Role | Size | Weight | Family |
|---|---|---|---|
| Step eyebrow | 10px / 0.1em tracking / uppercase | 600 | system stack |
| Step title | 24px | 600, -0.01em tracking | Georgia (serif) for class headers; system for generic |
| Body | 13px | 400 | system stack |
| Subtitle / muted | 11–12.5px | 400 | system stack |
| Tabular | 11–14px | 600 | system stack with `font-variant-numeric: tabular-nums` (HP, levels, ASIs) |
| Class emblem letter | round(size × 0.55) | 700 | Georgia (serif) |

Class emblems are the only place Georgia/serif is used. Everything else is system / `var(--font-sans)`.

### Border radius

- Tiny chips & pills: `4–6px`
- Cards & list rows: `7–10px`
- Modals: `12px`
- Bottom sheet top corners: `20px`
- Phone frame: `48px` (handled by `IOSDevice`, ignore)

### Shadows

The dark theme is mostly borderless in raised surfaces — we use **rgba-tinted backgrounds + 1px borders** instead of shadows. The two exceptions:

- Bottom sheet: `0 -20px 40px rgba(0,0,0,0.4)`
- Hi-fi modal lift: `0 24px 60px rgba(0,0,0,0.5)`

---

## Surface 1 · Content Preview Modal

### Purpose

When the user is choosing a class/race/background and taps a content card, this modal opens. Goal: surface enough information for the choice to be meaningful — feature list, ability synergies, class color — without dumping the SRD on them.

### Recommended variant: **Variant B (top tabs + emblem)**

Selected by stakeholder review. The other two variants in `preview-variants.jsx` (A · left-nav tabs with portrait, C · scroll + sticky section nav, type-only) are preserved as exploration but **do not implement them** unless explicitly requested.

### Layout (Variant B)

```
┌─────────────────────────────────────────────────────────────────┐
│  [✕]                                                          │ ← header bar (40px)
├─────────────────────────────────────────────────────────────────┤
│  ╔═══╗  Paladin                                                 │
│  ║ P ║  d10 hit die · STR + CHA                                 │ ← class identity strip
│  ╚═══╝  Defender / Striker · 14 levels of features              │
├─────────────────────────────────────────────────────────────────┤
│  [Overview] [Features] [Subclasses] [Spells]                    │ ← top tabs
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   <Active tab body — scrollable>                                │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [Preview as Lv 1 ▾]                          [Cancel] [Pick]  │ ← sticky footer
└─────────────────────────────────────────────────────────────────┘
```

### Components

- **Class emblem (large)** — 56×56px rounded-rect, gold or purple tone, Georgia serif letter at 32px. Same shape as the small badges, scaled up.
- **Identity strip** — `flex items-center gap-4`, padding `16px 24px`, no background fill. Right-aligned dim text shows `Hit die · Primary ability · Saves`.
- **Top tabs** — full-width row of pill-style tabs, active state is `bg-accent/12 text-accent border-accent/40`. Inactive is `text-muted-foreground bg-transparent`. Border-bottom on the row separates from body.
- **Tab body** — scroll region. Content per tab:
  - **Overview** — short prose summary + ability chip row + role tags (Defender/Striker/Healer)
  - **Features** — virtual list of features grouped by level (1, 2, 3...). Each row: level pill, feature name (bold), description. Choices are flagged with a small "Choose" tag.
  - **Subclasses** — grid of subclass cards; tapping a card pre-selects it and highlights its features in the Features tab when you switch.
  - **Spells** — for casters only. Filterable by level + school.
- **Preview-as level dropdown (footer-left)** — controls what level the preview shows (Lv 1 default; clamped to `1..maxLevelForClass`). Affects which features in the Features tab are visible.
- **Cancel / Pick this class** — Cancel is outline; Pick is solid accent (gold).

### Interactions

- Open: fade + scale-from-95% over 180ms, easing `cubic-bezier(0.16, 1, 0.3, 1)`. Content stays mounted; only opacity/transform animate.
- Tab switch: 120ms cross-fade on tab body.
- Preview level change: instant re-render of Features tab; no animation.
- Cancel: closes modal, no state change.
- Pick: closes modal AND advances builder state — class is now selected. Confirmation toast at the bottom of the builder ("Picked Paladin").

### State

```ts
interface PreviewModalState {
  open: boolean;
  contentId: string | null;          // class id, race id, etc.
  contentType: "class" | "race" | "background";
  activeTab: "overview" | "features" | "subclasses" | "spells";
  previewLevel: number;              // 1..maxLevel (only used for class type)
}
```

### Accessibility

- Focus traps inside modal while open. First focusable element on open is the `[Cancel]` button (so a stray Enter/Space doesn't auto-pick).
- `Escape` closes (same as `Cancel`).
- Tabs use a real `[role="tablist"]` with arrow-key navigation.
- The class identity strip is a `<header>`; the emblem letter has `aria-hidden` (the class name is already in text).

---

## Surface 2 · Class Step

### Purpose

The screen in the builder flow where a player commits to one or more classes and their levels. Shows what each level grants, lets the player make per-level choices (subclass, ASI, fighting style, metamagic, ...), and surfaces the running cost (out of the L20 character budget) clearly.

### Recommended variant: **Variant C — Sidebar by level + main pane**

C scales to multiclass cleanly; A and B (single-scroll, accordion) are preserved as exploration in `class-step-variants.jsx`.

C has **two multiclass forks** in `multiclass-variants.jsx`:

- **C1 · Grouped by class (recommended).** Each class has its own collapsible section in the sidebar, each with its own level rail (Pal 1–6, Sor 1–3). A "Character" entry pinned at the top shows aggregated information (total level, merged spell slots, prof bonus). At the bottom, a locked-or-pickable "+ Add a class" row.
- **C2 · Unified character-level rail.** A single 1..N rail showing levels in the order taken; each pill carries the class emblem. Add-class is the same picker, just opened from a "+ New class" button at the end of the rail.

C1 won review. C2 stays in the artboard for reference.

### Layout (C1, desktop)

```
┌─────────────────────────────────────────────────────────────────┐
│ Step 4 of 7 · Class                                             │ ← step header
├──────────────┬──────────────────────────────────────────────────┤
│ ╭───────────╮│                                                  │
│ │ KV  Char  ││  <Main pane: selected level's content>          │
│ │ Lv 9/20  ││                                                  │
│ ╰───────────╯│                                                  │
│              │                                                  │
│ ╔═════════╗ │                                                  │
│ ║ P  Paladin ║ ← collapsible header with level dropdown        │
│ ╚═════════╝ │                                                  │
│  1 Divine    │                                                  │
│  2 Style     │                                                  │
│  3 Oath      │                                                  │
│  4 ASI ●     │ ← red dot = unmade choice                       │
│  5 Extra     │                                                  │
│  6 Aura ✓    │                                                  │
│  + Level up  │ ← gold tonal button                             │
│              │                                                  │
│ ╔═════════╗ │                                                  │
│ ║ S Sorcerer ║                                                 │
│ ╚═════════╝ │                                                  │
│  1 Origin    │                                                  │
│  2 Font      │                                                  │
│  3 Meta      │                                                  │
│  + Level up  │ ← purple tonal button                           │
│              │                                                  │
│  + Add class │ ← dashed (locked if no class meets prereq)      │
└──────────────┴──────────────────────────────────────────────────┘
```

### Components

#### `ClassStepHeader`

Top row, full-width, `padding: 14px 28px`, border-bottom 1px.

- Eyebrow: `STEP 4 OF 7` (10px, 0.1em, muted)
- Title: `Class` (20px, 600)
- Right side: progress crumbs `[1 Identity] [2 Race] [3 Background] [4 Class] [5 Abilities] [6 Skills] [7 Review]` — current is bold + accent color, others are muted.

#### `RailSectionHead` (per-class, collapsible)

- 22px class emblem (gold/purple tone)
- Class name (12.5px, 600) + subtitle (10.5px, muted, e.g. "Oath of Devotion")
- Chevron (rotates on collapse)
- **Level dropdown** on the right edge — a numeric `<select>` styled to match. Range: `1..maxAllowed` where `maxAllowed = currentClassLevel + (20 - totalCharacterLevel)`. Changing this value adds or removes the trailing levels from this class. Removing levels triggers a confirmation if any of the removed levels has a player-made choice.

#### `LevelPill`

- 28px tall, full-width inside the rail
- Left: level number (12px, tabular)
- Optional class emblem (only shown in the unified C2 variant)
- Center: level summary string (e.g. "Sacred Oath", "ASI", "Aura of Protection") truncated with ellipsis
- Right: choice indicator dot (6px, accent color) if the level has an unmade choice

Active pill: gold background tint + gold border. Hover: subtle background brighten.

#### `LevelUpButton` (in-rail, per class)

The primary affordance for adding a level. Lives directly under each class's level pill list.

- 100% width within the rail
- Gold or purple tone matching the class
- Icon: filled circle with `+`, 16px
- Label: `Level up Paladin`
- Right: `Lv 7` (the level it would add)

Disabled state: dashed outline, muted, with a `reason` string on the right ("In progress", "Finish Pal 7 first", "Char level cap").

#### `AddClassRow`

Appears once at the bottom of the sidebar. Two states:

- **Locked** (default): dashed `border-muted`, `bg-transparent`, lock icon + "Add a class · Locked", with reason inline ("Requires CHA 13 for Bard, INT 13 for Wizard, …" — show top 2-3 unmet reasons). Click does nothing.
- **Unlocked** (some class qualifies): solid `border-accent/40`, accent-tinted bg, plus icon, "Add a class · 11 levels remaining". Click opens the **Class Picker panel** in the main pane (not a modal).

#### `ClassPickerPanel` (replaces main pane)

Full grid of all 12 classes, 3 columns × 4 rows. Each card:
- 32px emblem
- Class name (14px, 600)
- 1-line role description (11px, muted)
- Prereq line: `STR 13 · met` (green) or `INT 13 · not met` (red) or `Already in this build` (muted)

Disabled cards (prereq not met or already in build) get 0.55 opacity. The "Cancel" button at the bottom returns to the previous selected level.

#### `ClassLevelPane` (the main pane content)

Shows everything for the selected `(class, level)`:

- Breadcrumb: `[P emblem] Paladin › Level 6`
- Title: feature name (24px, 600, accent color)
- Description (13px, muted, `max-width: 520px`)
- "What this level grants" — list of feature cards (passive features, choices, spell-slot upgrades)
- Choice cards: when a level has a choice (subclass, ASI, fighting style), the card embeds the picker UI inline. Made choices show `Chosen` badge; unmade show red `Choose` badge.

When a NEW level is being added (level-up flow), the pane gets a `NEW LEVEL` ribbon next to the breadcrumb and a sticky footer row: `[Cancel level-up] [Confirm level N]`.

#### `AbilityChip` (used in class identity strips and ability rows)

- Pill, `padding: 4px 10px`, rounded-full
- Tone: matches active class (gold or purple for class context; accent gold for general)
- Content: `STR · 16 (+3)` — label tabular, 11.5px

### Interactions

- **Level pill click**: switches the main pane content. URL updates with `#pal-6` so it's deep-linkable.
- **Class section collapse**: animates over 180ms (`max-height` + opacity).
- **Level dropdown change**: if shrinking, prompt "Removing Pal 5–6 will discard your ASI choice at Lv 4. Continue?"
- **Level up button click**: instantly adds the next level to the class's pill list, switches main pane to that level, opens with the `NEW LEVEL` state. The level-up button on this class becomes "In progress"; the other class's becomes "Finish Pal 7 first".
- **Cancel level-up**: removes the in-progress level, returns to the previous level.
- **Confirm level**: persists the level + any choices, returns level-up button to its enabled state on both classes.

### State

```ts
interface ClassStepState {
  classes: Array<{
    id: ClassId;
    levels: number;                  // 1..N
    subclassId: SubclassId | null;
    perLevelChoices: Record<number, LevelChoice>;
  }>;
  selected: { classId: ClassId; level: number } | null;
  inProgress: { classId: ClassId; level: number } | null;  // level-up flow
  picker: { open: boolean } | null;
}
```

`totalLevel = sum(classes[].levels)` — clamp to ≤ 20 everywhere.

### Multiclass prereqs (D&D 5e SRD)

Standard 5e rules; lift from the codebase's existing data layer. For reference:

| Class | Prereq |
|---|---|
| Barbarian | STR 13 |
| Bard | CHA 13 |
| Cleric | WIS 13 |
| Druid | WIS 13 |
| Fighter | STR 13 *or* DEX 13 |
| Monk | DEX 13 *and* WIS 13 |
| Paladin | STR 13 *and* CHA 13 |
| Ranger | DEX 13 *and* WIS 13 |
| Rogue | DEX 13 |
| Sorcerer | CHA 13 |
| Warlock | CHA 13 |
| Wizard | INT 13 |

Multiclassing is **gated** — players cannot add a class they don't meet the prereq for. The lock state explains why; no error states or "you can't do this" toasts are needed.

---

## Mobile (sub-`md` breakpoint)

The desktop sidebar pattern translates directly:

- The sidebar becomes a **horizontal scrolling top rail** of level pills.
- Multiclass = **two rails stacked**, one per class, each with its own `+ Level up` pill at the end.
- The character strip moves to the very top of the screen (above the rails).
- The main pane becomes the body below.
- Add-class is a **bottom sheet** (74% screen height) with a search and the same prereq-aware list. Reachable via a `+ New class` pill at the end of the last class rail.

See `mobile-variants.jsx` for M1–M4 and `level-up-flow.jsx` for L3.

Bottom sheet: 20px top-corner radius, 36×4 grabber, `padding: 0 16px`, list rows with hairline borders, each row ends with a one-tap `Add` button (or `—` if disabled). Background uses `var(--card)`; the page beneath is blurred (`filter: blur(3px) saturate(0.7)`) and dimmed (`rgba(10,8,16,0.55)`).

Bottom action bar (Back / Continue): position-absolute, full width, `padding: 10px 14px 30px` (extra bottom padding for the home indicator), gradient fade from `var(--background)` 70% to transparent at the top so scrolled content fades behind the bar.

---

## Character Color Carry-Through

The character has one primary color, set on the character page. The builder and character sheet both **read** this color and apply it to:

- Step header underline / accent
- Stepper active state
- Selected-row highlights and primary CTAs (NOT the gold "Pick" / "Confirm" — that stays accent gold to remain readable on any character color)
- Character sheet header gradient
- Stat tile borders (when selected/edited)

Class color (gold/purple) is **independent** of character color. Class color stays consistent across all characters; character color is the player's identity expression. They coexist: a Paladin/Sorcerer character with a teal primary color renders class-tinted gold/purple emblems alongside teal step accents.

When the character has not picked a color (new character), default to gold (`var(--accent)`).

---

## Screenshots

Reference shots of the recommended directions live in `screenshots/`. The HTML prototype is the source of truth for interaction; these are for fast scanning.

| File | What it shows |
|---|---|
| `screenshots/01-preview-modal-recommended.png` | **Surface 1.** Variant B preview modal — top tabs + emblem (recommended). |
| `screenshots/02-class-step-recommended.png` | **Surface 2.** Variant C single-class — sidebar by level + main pane (recommended foundation). |
| `screenshots/03-multiclass-grouped.png` | **Surface 2 · multiclass.** C1 — grouped by class with character section + add-class row (recommended). |
| `screenshots/04-level-up-flow.png` | **Level-up flow** L2 — desktop new-level choice pane after Pal 7 added. |
| `screenshots/05-character-color.png` | **Color carry-through** D2 — character-primary color set on the character page, read by the builder. |
| `screenshots/06-mobile-multiclass.png` | **Mobile** M2 — two rails stacked + character strip. |
| `screenshots/07-mobile-add-class-sheet.png` | **Mobile** M3 — add-class bottom sheet with prereq checks. |

## Files in this bundle

The HTML prototype renders by loading `Builder UX Polish.html` and Babel-transpiling each JSX file at runtime. Open it in any modern browser to interact with every variant.

| File | Contents |
|---|---|
| `Builder UX Polish.html` | Top-level shell. Imports React + Babel + every JSX file. Wraps the canvas. |
| `inkborne-tokens.css` | Hex-mirror of the codebase's HSL tokens. **Don't import; use the codebase's tokens.** |
| `inkborne-data.js` | Sample SRD-adjacent data (Paladin to Lv 6, Sorcerer to Lv 3, sample race + background). |
| `inkborne-ui.jsx` | Shared primitives: `Frame`, `Icon`, `IX` (icon path map), `Tabs`, `Button`, etc. |
| `design-canvas.jsx` | The `<DesignCanvas>` / `<DCSection>` / `<DCArtboard>` host. Not part of the product. |
| `ios-frame.jsx` | iPhone bezel for mobile artboards. Not part of the product. |
| `preview-variants.jsx` | **Surface 1.** Three preview-modal variants (A, B-recommended, C). |
| `class-step-variants.jsx` | **Surface 2.** Three single-class variants (A, B, C). C is the recommended foundation. |
| `multiclass-variants.jsx` | **Surface 2 · multiclass.** C1-grouped (recommended) and C2-unified. Includes `RailSectionHead`, `LevelDropdown`, `ClassPickerPanel`. |
| `color-exploration.jsx` | Class-tinted vs. character-primary direction. **D2 with carry-through is the chosen direction.** |
| `mobile-variants.jsx` | Mobile pattern: M1 single-class, M2 multiclass, M3 add-class sheet, M4 ASI choice. |
| `level-up-flow.jsx` | Level-up flow (Model B): L1 idle rail, L2 new-level choice pane, L3 mobile. |
| `mobile-and-recs.jsx` | Earlier mobile + recommendations sketches. **Superseded by `mobile-variants.jsx`** — keep for reference but don't implement from this file. |

### What's the priority for first PR?

1. Surface 1 / Variant B — the preview modal is the most independent piece and will unlock content browsing.
2. Surface 2 / Variant C — single-class first; do not ship multiclass yet.
3. Multiclass C1 — once single-class C is shipped and stable. The Add-class picker panel is part of this.
4. Level-up flow — ships alongside multiclass, since the in-rail "+ Level up" pattern is the same affordance whether you have one or many classes.
5. Mobile — once desktop is in production, port to the breakpoint. The patterns are direct translations; no separate logic.
6. Character color carry-through — a separate, smaller PR. Touches the character settings page, the builder shell, and the character sheet header. Class color (gold/purple) is independent — don't conflate them.

---

## Open questions for engineering

- **Per-level snapshot vs. derived state:** the prototype assumes choices are stored per-level (`perLevelChoices: Record<number, LevelChoice>`). If your existing model derives spell slots / proficiencies from a flat list, that's fine, but level-pill "choice dot" indicators need a fast-lookup `hasUnmadeChoiceAt(class, level)`.
- **Subclass timing:** the SRD lets each class pick a subclass at a different level (Cleric 1, Fighter 3, Wizard 2, etc.). The prototype shows Paladin's at Lv 3. The Features tab in the preview modal needs to render the subclass picker as a feature row at the right level, not as a separate page.
- **Removing levels:** the level dropdown supports shrinking. Confirm the data model supports rolling back. If not, gate the dropdown to non-decreasing in v1 and hide the choice with "Use builder back-out flow to remove levels."

If anything in this README disagrees with the working code, the working code in `Builder UX Polish.html` is the source of truth.
