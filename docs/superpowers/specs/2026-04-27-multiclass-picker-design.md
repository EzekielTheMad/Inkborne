# Multiclass Picker (Variant C1) — design spec

**Date:** 2026-04-27
**Status:** Design approved, ready for implementation plan
**Slice:** PR-C of the Builder UX Polish phase (M2). Builds on PR-A's `<ClassPreviewModal>` and PR-B's `<ClassStepRail>`. PR-D ships the in-rail level-up flow; PR-E mobile; PR-F character color carry-through.

Source design bundle: [`docs/design-briefs/builder-ux-polish-design-files/`](../../design-briefs/builder-ux-polish-design-files/) (variant C1 in `multiclass-variants.jsx`, screenshot `03-multiclass-grouped.png`). Companion specs: [`2026-04-27-class-preview-modal-design.md`](2026-04-27-class-preview-modal-design.md), [`2026-04-27-class-step-rail-design.md`](2026-04-27-class-step-rail-design.md).

---

## Goal

Unlock the multiclass *add* path in the class step rail. `<AddClassRow>` becomes conditionally pickable based on SRD multiclassing prereqs (resolved ability scores ≥ 13 in the right ability for at least one new class). Click opens a `<ClassPickerPanel>` that *replaces the main pane* (not a modal), showing all 12 classes in a grid with per-class prereq state. Click a class card → existing `<ClassPreviewModal>` (PR-A) opens for that class. Modal Pick → existing `handleSelectClass` flow adds the class. Picker Cancel → main pane returns to the previously-selected class+level.

This makes "add a second class" work end-to-end. Existing multiclass characters already render correctly via PR-B's N-section rail; they just couldn't get there from a fresh single-class state.

## Non-goals

- **In-rail "+ Level up" button** — strict scope to keep PR-D coherent. PR-D builds the button alongside the elaborate "NEW LEVEL" ribbon + cancel-level-up flow as one unit. PR-C does not touch level-up affordance.
- **Class section collapse / expand** — the design's C1 includes collapsible class sections in the sidebar. Defer to a polish PR. Sections render always-open in PR-C, same as PR-B.
- **"Character" pinned entry at the top of the rail** showing aggregated info (total level, merged spell slots, prof bonus) — defer to a polish PR. The step header already shows total level via `<BuilderStepNav>`'s context.
- **Character primary color carry-through** — PR-F.
- **Mobile bottom-sheet picker** — PR-E.

## File layout

**New files:**
- `components/builder/class-step-rail/class-picker-panel.tsx` — the 3×4 grid of class cards with prereq state.
- `components/builder/class-step-rail/class-picker-card.tsx` — single card in the grid (emblem + name + role + prereq line).
- `lib/builder/multiclass-prereqs.ts` — pure helper that maps each class slug to its prereq spec, plus a function that takes a class + resolved ability scores + selectedClasses and returns the card's state (`met` | `not-met` | `already-in-build`).

**Modified files:**
- `components/builder/class-step-rail/index.tsx` — add picker state (`showPicker`), wire AddClassRow click → `setShowPicker(true)`, render `<ClassPickerPanel>` in main pane when `showPicker`. Add `onAddClass` prop emitted when a class card is clicked.
- `components/builder/class-step-rail/add-class-row.tsx` — accept new props for the conditional unlocked state. When unlocked, the row becomes a real button calling `onClick`. Locked state stays as it is in PR-B.
- `app/(app)/characters/[id]/builder/class/class-step-client.tsx` — run the engine to get `resolvedStats`, pass to `<ClassStepRail>`, and wire `onAddClass` → reuses existing `setPreviewContent` to open the existing `<ClassPreviewModal>`.

## Component shape

```
<ClassStepRail showPicker?>
├── <aside class="level-rail">
│   ├── <LevelRail /> (per-class)
│   ├── ...
│   └── <AddClassRow locked|unlocked />          — unlocked when ≥ 1 qualifying class exists
└── <main>
    ├── <ClassLevelPane /> (default)
    └── <ClassPickerPanel /> (when showPicker)   — REPLACES the level pane

<ClassPickerPanel>                                — full main pane
├── <header>
│   ├── <h2>Add a class</h2>
│   ├── description: "<n> levels remaining · ..."
│   └── <button>Cancel</button>
└── <div class="grid grid-cols-3">              — desktop; sm:grid-cols-2; one col mobile
    ├── <ClassPickerCard state="met" />
    ├── <ClassPickerCard state="not-met" />
    ├── <ClassPickerCard state="already-in-build" />
    └── ... (12 cards total)
```

### `<ClassPickerCard>`

Single card in the grid. Per the brief:

```
┌──────────────────────────────────────┐
│  [P emblem]  Paladin                 │
│              Defender / Striker      │
│              STR 13 · met            │
└──────────────────────────────────────┘
```

- 32×32 emblem (`<ClassEmblem size="md" />`)
- Class name (text-sm, font-medium)
- 1-line role description from `classContent.data.role` (text-xs, muted) — falls back to a derived string if absent
- Prereq line: green text + check for met (e.g. `STR 13 · met`); red + dot for not met (`INT 13 · not met`); muted for `Already in this build`
- States:
  - **met** → solid border, full opacity, clickable. Click emits `onSelect(classContent)`.
  - **not-met** → 0.55 opacity, dashed border, non-clickable, shows the unmet prereq.
  - **already-in-build** → 0.55 opacity, solid border, non-clickable, shows muted "Already in this build" text.

### `<AddClassRow>` updated

Two states for PR-C (was always-locked in PR-B):

- **Locked** (no class qualifies + no class would qualify with current stats) — same UI as PR-B (dashed border, lock icon, "Add a class · Locked", reason text). Click is no-op.
- **Unlocked** (at least one class is `met` AND character has remaining levels < 20) — solid border, accent-tinted bg, plus icon, "Add a class · X levels remaining". Click emits `onClick()`.

The rail's `<AddClassRow>` decides which state to render based on the picker output. Specifically, if `multiclassPrereqsForAll(...).some(p => p.state === "met")` AND `totalLevel < 20`, unlock; else lock.

## Data flow & state

### Inputs

`<ClassStepRail>` gains one new prop:

```ts
interface ClassStepRailProps {
  // ...existing props (PR-B)
  resolvedStats: Record<string, number>;
  onAddClass: (content: ContentEntry) => void;
}
```

`resolvedStats` carries the engine output (e.g., `{ strength: 14, dexterity: 12, ... }`). Wired by class-step-client.tsx running `evaluate` from `@/lib/engine/evaluator` once and passing the result.

`onAddClass` is the callback that triggers the existing `<ClassPreviewModal>` flow. Wired in class-step-client.tsx as:

```ts
onAddClass={(content) => setPreviewContent(content)}
```

This reuses the existing modal + `handleSelectClass` plumbing — no new mutation paths.

### Rail-local state

`showPicker: boolean` added to `<ClassStepRail>`'s state. `setShowPicker(true)` when AddClassRow click fires; `setShowPicker(false)` when the picker emits Cancel OR when the modal Picks (resets to show the new class's pane).

The picker's `onSelect(content)` calls the `onAddClass(content)` prop AND keeps `showPicker = true` until the modal returns. When the modal Pick fires, `handleSelectClass` updates state, the rail re-renders with the new class added, and the rail's `useEffect` watching `selectedClasses.length` resets `showPicker` to false so the user lands on the new class's pane.

> **Subtlety:** if the user opens the modal from the picker but Cancels the modal, the picker should still be visible. Only Pick should close the picker. Implementation: use a ref or "modal cancel doesn't close picker" by NOT calling `setShowPicker(false)` in the modal's onCancel — only in onPick (via the useEffect on `selectedClasses.length`).

## Multiclass prereq table

Hardcoded in `lib/builder/multiclass-prereqs.ts` per the design brief:

```ts
export type AbilityKey = "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma";

interface MulticlassPrereq {
  /** All abilities listed must meet the threshold (`AND`). */
  all?: Array<{ ability: AbilityKey; min: number }>;
  /** At least one ability must meet the threshold (`OR`). Used for Fighter (STR 13 OR DEX 13). */
  any?: Array<{ ability: AbilityKey; min: number }>;
}

export const MULTICLASS_PREREQ_TABLE: Record<string, MulticlassPrereq> = {
  barbarian: { all: [{ ability: "strength", min: 13 }] },
  bard: { all: [{ ability: "charisma", min: 13 }] },
  cleric: { all: [{ ability: "wisdom", min: 13 }] },
  druid: { all: [{ ability: "wisdom", min: 13 }] },
  fighter: { any: [{ ability: "strength", min: 13 }, { ability: "dexterity", min: 13 }] },
  monk: { all: [{ ability: "dexterity", min: 13 }, { ability: "wisdom", min: 13 }] },
  paladin: { all: [{ ability: "strength", min: 13 }, { ability: "charisma", min: 13 }] },
  ranger: { all: [{ ability: "dexterity", min: 13 }, { ability: "wisdom", min: 13 }] },
  rogue: { all: [{ ability: "dexterity", min: 13 }] },
  sorcerer: { all: [{ ability: "charisma", min: 13 }] },
  warlock: { all: [{ ability: "charisma", min: 13 }] },
  wizard: { all: [{ ability: "intelligence", min: 13 }] },
};
```

Helper functions:

```ts
export type ClassPrereqState = "met" | "not-met" | "already-in-build";

export interface ClassPrereqResult {
  classSlug: string;
  state: ClassPrereqState;
  /** Human-readable line like "STR 13 · met" or "STR 13 · not met". */
  line: string;
  /** When state is not-met, lists which abilities failed. */
  unmet?: Array<{ ability: AbilityKey; min: number; have: number }>;
}

export function evaluateMulticlassPrereq(
  classSlug: string,
  resolvedStats: Record<string, number>,
  selectedClasses: Array<{ slug: string }>,
): ClassPrereqResult;

export function multiclassPrereqsForAll(
  resolvedStats: Record<string, number>,
  selectedClasses: Array<{ slug: string }>,
  classes: ContentEntry[],
): ClassPrereqResult[];
```

## Interactions, animations, a11y

| Trigger | Behavior | Animation |
|---|---|---|
| AddClassRow click (unlocked) | `setShowPicker(true)` → main pane swaps to `<ClassPickerPanel>` | None (instant) |
| ClassPickerPanel Cancel | `setShowPicker(false)` → main pane returns to previous level | None |
| ClassPickerCard click (state=met) | Calls `onAddClass(classContent)` → parent opens `<ClassPreviewModal>` for that class. Picker stays open behind the modal. | Modal animation handled by Dialog primitive (PR-A) |
| ClassPreviewModal Pick | `handleSelectClass` adds the class. `selectedClasses.length` increments. Rail's `useEffect` detects increment and `setShowPicker(false)`. New class's pane is displayed. | None |
| ClassPreviewModal Cancel | Modal closes. Picker stays open. | None |
| ClassPickerCard click (state=not-met OR already-in-build) | No-op. Card is `aria-disabled="true"`. | None |

**A11y:**
- `<ClassPickerPanel>` is `<section aria-labelledby="class-picker-heading">` with the h2.
- Cancel button gets `autoFocus` so escape-via-Tab is one keypress.
- Each `<ClassPickerCard>` is a `<button aria-disabled={state !== "met"}>` (using `aria-disabled` instead of `disabled` so screen readers still announce the unmet prereq reason).
- Prereq line uses semantic colors but ALSO icons (✓ for met, • for not-met, lock for already-in-build) so users without color perception can distinguish states.
- `<AddClassRow>` unlocked state is a normal `<button>` with proper focus-visible ring (already added in PR-B for the locked variant; carry through).

## Tests

vitest + testing-library:

1. **`lib/builder/multiclass-prereqs.ts`** (TDD, pure):
   - `evaluateMulticlassPrereq` returns `met` when all `all` thresholds hit.
   - Returns `not-met` with unmet list when any `all` threshold misses.
   - Returns `met` for Fighter when only one of the `any` thresholds hits.
   - Returns `not-met` for Fighter when neither `any` threshold hits.
   - Returns `already-in-build` when `selectedClasses` contains the slug.
   - `multiclassPrereqsForAll` returns one result per class in the input list.
   - Result `line` text format: `STR 13 · met` etc.

2. **`<ClassPickerCard>`:**
   - Renders emblem + class name + role + prereq line for `met` state.
   - Renders prereq line `STR 13 · not met` and is `aria-disabled="true"` for `not-met` state.
   - Renders "Already in this build" muted text and is `aria-disabled="true"` for `already-in-build` state.
   - Calls `onSelect(classContent)` only when state=met; ignores click when not-met or already-in-build.

3. **`<ClassPickerPanel>`:**
   - Renders one card per class in the input list.
   - Cancel button calls `onCancel()`.
   - Card click in `met` state calls `onSelect(classContent)`.

4. **`<AddClassRow>` updated:**
   - Renders locked state when `unlocked={false}` (existing PR-B behavior).
   - Renders unlocked state with plus icon and "X levels remaining" when `unlocked={true}`.
   - Calls `onClick` only when unlocked.

5. **`<ClassStepRail>` integration:**
   - Default state: main pane shows `<ClassLevelPane>`.
   - Click unlocked AddClassRow → main pane shows `<ClassPickerPanel>`.
   - Click picker Cancel → main pane shows `<ClassLevelPane>` again.
   - Calling onAddClass from the picker triggers the parent callback (verify via prop spy).
   - When `selectedClasses.length` increments (simulated rerender), `showPicker` resets to `false`.

## Out of scope / follow-ups

| Item | Why deferred |
|---|---|
| In-rail "+ Level up" button | PR-D — strict scope to keep level-up flow coherent. |
| Class section collapse/expand | Polish PR. C1 grouped grouping is rendered always-open for now. |
| "Character" pinned entry at top of rail (aggregated info) | Polish PR. BuilderStepNav already shows total level via context. |
| Engine integration refinement (currently runs only on every render — could be memoized) | Optimization, not correctness. |
| Mobile bottom-sheet variant of ClassPickerPanel | PR-E. Sub-`md` falls through to a stacked column for now. |

## Implementation references

- Source design: [`docs/design-briefs/builder-ux-polish-design-files/multiclass-variants.jsx`](../../design-briefs/builder-ux-polish-design-files/multiclass-variants.jsx)
- PR-A spec (modal): [`2026-04-27-class-preview-modal-design.md`](2026-04-27-class-preview-modal-design.md)
- PR-B spec (rail): [`2026-04-27-class-step-rail-design.md`](2026-04-27-class-step-rail-design.md)
- Existing engine evaluator: `lib/engine/evaluator.ts` — `evaluate(baseStats, effects, schema, structuredSources, state)` returns `{ stats, ... }` where `stats.<ability>` is the resolved score.
- Existing class-step-client.tsx already imports `Effect` from `@/lib/types/effects` and computes `allEffects = contentRefs.flatMap(...)`. The engine call to add: pull `schema` from `character.game_systems.schema_definition` and pass `character.base_stats` + `allEffects` + `schema` + structured sources.
- Reused PR-A primitives: `<ClassEmblem>`, `<ClassPreviewModal>`, `lib/builder/class-tone.ts`.
- Reused PR-B primitives: `<ClassStepRail>`, `<AddClassRow>`, `<LevelRail>`, `<ClassLevelPane>`.
