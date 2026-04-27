# Class Step Rail (Variant C, single-class) — design spec

**Date:** 2026-04-27
**Status:** Design approved, ready for implementation plan
**Slice:** PR-B of the Builder UX Polish phase (M2). Single-class only; multiclass, level-up flow, mobile, and character color carry-through ship in PR-C / PR-D / PR-E / PR-F respectively.

Source design bundle: [`docs/design-briefs/builder-ux-polish-design-files/`](../../design-briefs/builder-ux-polish-design-files/) (Variant C in `class-step-variants.jsx`, screenshot `02-class-step-recommended.png`). Companion to PR-A's modal: [`docs/superpowers/specs/2026-04-27-class-preview-modal-design.md`](2026-04-27-class-preview-modal-design.md).

---

## Goal

Replace the existing accordion-style class step (`app/(app)/characters/[id]/builder/class/class-step-client.tsx`'s "has class" branch) with the design team's Variant C layout: a sidebar of level pills + a main pane that shows the selected level's content. Choice cards (ASI, subclass, fighting style) render inline in the main pane and are rebuilt fresh per the design instead of reusing the legacy selectors.

The "no class yet" entry state stays as it is today: `<ContentBrowser>` grid → `<ClassPreviewModal>` (from PR-A) on click.

## Non-goals

- **Multiclass.** AddClassRow renders in a *locked* state showing prereq reasons, but clicks are no-ops. Multiclass picker panel + class section grouping ship in PR-C.
- **Level-up flow.** No in-rail "+ Level up" button, no "NEW LEVEL" ribbon, no level-up choice pane. Level changes go through the existing `<select>` dropdown carried into the new layout. PR-D rebuilds the level-up affordance.
- **Mobile bottom-sheet treatment.** At sub-`md` the rail stacks above the main pane. PR-E ships the horizontal-scrolling rail + bottom sheet.
- **Character color carry-through.** PR-F.
- **Crumbs in the step header.** The existing `<BuilderStepNav>` continues to be the step indicator across the whole builder; introducing the design's `[1 Race] [2 Class] …` crumbs would touch every step, not just class. Defer to a separate PR if Victor wants the crumb style.
- **URL deep-linking** (`#pal-6` to a specific level) — polish PR.
- **Replacement of native `confirm()` with shadcn AlertDialog** for level shrink confirmation — polish PR.
- **Deletion of the now-unused legacy selectors** (`<AsiSelector>`, `<SubclassSelector>`, `<ChoiceSelector>`) — separate cleanup PR after confirming no other call sites.

## File layout

**New files (under `components/builder/class-step-rail/`):**
- `index.tsx` — root layout: sidebar + main pane wrapper.
- `level-rail.tsx` — sidebar's class section (header + level pills + level dropdown). For PR-B there is exactly one section (single-class).
- `level-pill.tsx` — individual level pill: number + summary + unmade-choice red dot + active state.
- `class-level-pane.tsx` — main pane: breadcrumb + title + feature/choice cards.
- `feature-card.tsx` — passive feature row.
- `choice-card-asi.tsx` — ASI choice card.
- `choice-card-subclass.tsx` — subclass picker card.
- `choice-card-fighting-style.tsx` — fighting style choice card.
- `add-class-row.tsx` — locked-state-only for PR-B.

**New helper:**
- `lib/builder/class-features-per-level.ts` — pure helper that returns `PerLevel[]` for a `(class, subclass, characterChoices)` tuple. Reused by `level-rail.tsx` (for unmade-choice red dots + pill summary text) and `class-level-pane.tsx` (for what to render when a level is selected).

**Modified files:**
- `app/(app)/characters/[id]/builder/class/class-step-client.tsx` — replace the existing "has class" branch JSX (the accordion + level-and-subclass controls + ASI/fighting-style pickers) with `<ClassStepRail>`. Keep the "no class" entry state (the `<ContentBrowser>` → `<ClassPreviewModal>` flow from PR-A). Keep all existing handlers (`handleSelectClass`, `handleLevelChange`, `handleRemoveClass`, `handleSubclassSelect`, `handleAsiSelect`, `handleFightingStyleSelect`, `handleChoiceSelect`) — pass them as props into the rail.

**Untouched:**
- `<AsiSelector>` / `<SubclassSelector>` / `<ChoiceSelector>` — left in place. The rail's choice cards are rebuilt rather than wrapping these.
- The "no class yet" path through `<ContentBrowser>` and `<ClassPreviewModal>`.

## Component shape

```
<ClassStepRail>                                          — root, fills the step body
├── <aside class="level-rail" aria-label="Class levels"> — 240px desktop
│   └── <LevelRail classContent={...} ...>
│       ├── <ClassSectionHead>
│       │   ├── <ClassEmblem size="md" />                 ← reused from PR-A
│       │   ├── class name + subclass name (subtitle)
│       │   ├── <CollapseChevron />
│       │   └── <LevelDropdown 1..maxAllowed />           — for shrinking, native <select>
│       ├── <LevelPill level={1} hasUnmadeChoice={false} active={...} />
│       ├── <LevelPill level={2} ... />
│       │   …
│       └── (no in-rail "+ Level up" button — strict scope; PR-D adds it)
├── <Separator />
└── <AddClassRow locked reasons={["Requires CHA 13 for Bard", ...]} /> — bottom

<main class="class-level-pane" aria-labelledby="class-level-title">
  <Breadcrumb>P · Paladin › Level 4</Breadcrumb>
  <h2 id="class-level-title">{title}</h2>     — see Title rules below
  <p class="description max-w-[520px]">{description}</p>
  <h3>What this level grants</h3>
  <stack>
    <FeatureCard /> | <ChoiceCardASI /> | <ChoiceCardSubclass /> | <ChoiceCardFightingStyle />
  </stack>
</main>
```

### Title rules in `<ClassLevelPane>`

The brief specifies "title: feature name (24px, accent color)" but a level can have multiple features. Resolve by:

- If the level has **exactly one feature**, the title is that feature's name.
- If the level has **multiple features**, the title is `Level {N}` (and the feature names show as cards below).
- If the level has **a primary choice** (ASI, subclass), the title is the choice label (`Ability Score Improvement`, `Sacred Oath`).

This keeps the title meaningful at a glance without needing per-class curation.

### `<LevelPill>` summary

The pill's center text is a one-line summary, derived as:

- Primary feature name if exactly one: `"Divine Sense"`.
- `"ASI"` if the level has an ASI choice.
- `"Sacred Oath"` if the level has a subclass-pick choice.
- `"Fighting Style"` if the level has a fighting-style choice.
- Otherwise the count: `"3 features"`.

Right side: 6px red dot (`bg-destructive`) if any choice at this level is unmade. `aria-label="Has unmade choice"`.

Active state: `bg-accent/12 border-accent text-accent`. Hover: `hover:bg-muted/40`.

### `<AddClassRow>` (locked)

For PR-B the row is always locked. Renders:

- Dashed border (`border-dashed border-muted`)
- Lock icon + "Add a class · Locked"
- Reason text inline: "Requires CHA 13 for Bard, INT 13 for Wizard…" — show top 2–3 unmet prereqs from the SRD multiclassing table (data already in our class definitions where available; otherwise hardcode the table per the brief).
- `<button type="button" aria-disabled="true" aria-describedby="add-class-reason">` — click is a no-op. Native browser tooltip via `title=""` carries the full reason list.

### Choice cards (rebuilt, not wrapping legacy selectors)

Each card has the same shell:

```
<article class="rounded-md border border-border bg-card/40 p-4">
  <header>
    <h3>{choiceTitle}</h3>
    <Badge variant={isMade ? "default" : "destructive"}>
      {isMade ? "Chosen" : "Choose"}
    </Badge>
  </header>
  {/* Picker UI specific to choice type, built fresh per design */}
</article>
```

Specifics per type:

- **`<ChoiceCardASI>`** — toggles between "Increase one ability by 2" and "Increase two abilities by 1" mode (existing data shape on `AsiChoice`). Each ability shown as a chip that bumps; remaining points indicator. Calls `onAsiSelect` on commit.
- **`<ChoiceCardSubclass>`** — grid of subclass cards (same shape used in `ClassPreviewModal`'s Subclasses tab — extract `<SubclassCard>` to share if natural). Click = pick. Calls `onSubclassSelect`.
- **`<ChoiceCardFightingStyle>`** — radio-style list of fighting styles available to the class. Calls `onFightingStyleSelect`.

These use the **existing handler signatures** unchanged. The rebuild is the chrome and presentation.

## Data flow & state

### Inputs (props on `<ClassStepRail>`)

```ts
interface ClassStepRailProps {
  classes: ContentEntry[];
  subclasses: ContentEntry[];
  features: ContentEntry[];
  selectedClasses: Array<{
    slug: string;
    level: number;
    subclass?: string;
  }>;
  localChoices: CharacterChoices;
  contentRefs: Array<{
    id: string;
    content_definitions?: { slug: string; content_type: string };
  }>;
  onLevelChange: (classIndex: number, newLevel: number) => Promise<void>;
  onRemoveClass: (classIndex: number) => Promise<void>;
  onSubclassSelect: (classSlug: string, classIndex: number, subclassSlug: string | undefined) => Promise<void>;
  onAsiSelect: (featureSlug: string, choice: AsiChoice) => Promise<void>;
  onFightingStyleSelect: (featureSlug: string, classSlug: string, styleSlug: string | undefined) => Promise<void>;
  onChoiceSelect: (choiceId: string, selections: string[]) => Promise<void>;
}
```

The rail receives all handlers from the parent. No Supabase calls inside the rail. Same pattern as `<ClassPreviewModal>`.

### Rail-local state

```ts
const [selectedLevel, setSelectedLevel] = useState<number>(initialLevel);
const [collapsed, setCollapsed] = useState<boolean>(false);
```

`initialLevel` defaults to the highest level in `selectedClasses[0]` so the rail lands on "what's current."

### Per-level helper

```ts
// lib/builder/class-features-per-level.ts
import type { ContentEntry } from "@/components/builder/content-browser";
import type { CharacterChoices, AsiChoice } from "@/lib/types/character";

export interface PerLevelChoice {
  type: "asi" | "subclass" | "fighting-style" | "generic";
  /** For ASI / fighting-style — the gating feature slug (used as choice id). */
  featureSlug?: string;
  classSlug: string;
  /** Display label for the level pill summary + breadcrumb title. */
  label: string;
  /** True if the user has already made this choice. */
  isMade: boolean;
}

export interface PerLevel {
  level: number;
  features: ContentEntry[];      // rendered as <FeatureCard>
  choices: PerLevelChoice[];     // rendered as <ChoiceCard*>
}

export function classFeaturesPerLevel(args: {
  classContent: ContentEntry;
  features: ContentEntry[];
  subclassContent: ContentEntry | null;
  characterChoices: CharacterChoices;
  classIndex: number;
}): PerLevel[];
```

Implementation walks the merged class + subclass `data.levels[]` (same approach used in `ClassPreviewModal`'s `FeaturesTab`), correlates each feature row against `characterChoices.asi_choices` / `characterChoices.classes[i].subclass` / `characterChoices.resolved_choices` to determine `isMade`.

## Interactions, animations, a11y

| Trigger | Behavior | Animation |
|---|---|---|
| Level pill click | `setSelectedLevel(level)` → main pane re-renders | None |
| Level dropdown change | `onLevelChange(classIndex, newLevel)`. If shrinking AND any of the removed levels has a player-made choice, `confirm()` first | None |
| Class section collapse | Toggle `collapsed`, hide level pills | 180ms `max-height` + opacity, easing `cubic-bezier(0.16, 1, 0.3, 1)` |
| Choice card change | Call respective handler. Card flips `Choose` → `Chosen` once parent state updates and re-renders | Instant |
| AddClassRow click | No-op when locked. `title` attribute carries reason text | None |

A11y:
- `<aside aria-label="Class levels">` for the rail
- `<button aria-expanded={!collapsed}>` for the class section header
- `<button aria-current="true">` on the active level pill (rest are `aria-current="false"` or omitted)
- Red dot has `aria-label="Has unmade choice"`
- AddClassRow has `aria-disabled="true"` + `aria-describedby` pointing at the reason text
- `<select aria-label="Set level for {className}">` on the level dropdown
- Main pane `<section aria-labelledby="class-level-title">` with `<h2 id="class-level-title">`
- Choice cards: each is `<article aria-labelledby="choice-{id}-title">`. The `Choose`/`Chosen` badge is `<span aria-label="Choice not yet made">` / `<span aria-label="Choice made">` so screen readers announce the state.

Mobile (sub-`md`): rail stacks above the main pane (column layout). Functional but not designed-to-spec. Replaced cleanly in PR-E.

## Tests

vitest + testing-library:

1. **`lib/builder/class-features-per-level.ts`** (TDD, pure):
   - Class with no choices → `PerLevel[]` with empty `choices` arrays.
   - Class with ASI at Lv 4 (no choice made) → that level's `choices` includes `{type: "asi", isMade: false}`.
   - Class with subclass at Lv 3 (no subclass picked) → `{type: "subclass", isMade: false}`. After picking, `isMade: true` AND subclass features are merged into subsequent levels.
   - Class with multiple choices at one level (ASI + fighting style) → both render in `choices`.

2. **`<LevelPill>`:**
   - Renders number + summary text.
   - Shows red dot when `hasUnmadeChoice`.
   - Applies active styling when `aria-current="true"`.

3. **`<ClassStepRail>`:**
   - Initial `selectedLevel` = highest level of the only class.
   - Click level pill → main pane shows that level's content.
   - Choice card with `isMade=true` shows "Chosen" badge.
   - Choice card with `isMade=false` shows "Choose" badge.
   - AddClassRow renders in locked state with prereq reasons text.
   - Level dropdown change calls `onLevelChange` with `(classIndex, newLevel)`.

4. **`<ChoiceCardASI>` / `<ChoiceCardSubclass>` / `<ChoiceCardFightingStyle>`:**
   - Renders the picker UI.
   - Selecting an option fires the right handler with the right args.
   - Badge swaps `Choose` ↔ `Chosen` based on `isMade` prop.

## Implementation references

- Source design: [`docs/design-briefs/builder-ux-polish-design-files/`](../../design-briefs/builder-ux-polish-design-files/)
- PR-A spec (modal, sets the visual language): [`2026-04-27-class-preview-modal-design.md`](2026-04-27-class-preview-modal-design.md)
- Existing class step (to be partially replaced): `app/(app)/characters/[id]/builder/class/class-step-client.tsx`
- Existing handler signatures (kept verbatim): `handleSelectClass`, `handleLevelChange`, `handleRemoveClass`, `handleSubclassSelect`, `handleAsiSelect`, `handleFightingStyleSelect`, `handleChoiceSelect`
- Reused PR-A primitives: `<ClassEmblem>`, `lib/builder/class-tone.ts`
