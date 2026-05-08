# Mobile builder pattern (PR-E) — design spec

**Date:** 2026-05-05
**Status:** Design approved, ready for implementation plan
**Slice:** PR-E of the Builder UX Polish phase (M2). Builds on PR-A's `<ClassPreviewModal>`, PR-B's `<ClassStepRail>`, PR-C's `<ClassPickerPanel>`, and PR-D's `<LevelUpPane>`. PR-F ships character primary color carry-through.

Source design bundle: [`docs/design-briefs/builder-ux-polish-design-files/`](../../design-briefs/builder-ux-polish-design-files/) — variants in `mobile-variants.jsx` (artboards M1 SingleClass, M2 Multiclass, M3 AddClassSheet, M4 LevelDetail) and `level-up-flow.jsx` (artboard L3 Mobile). Screenshots: [`06-mobile-multiclass.png`](../../design-briefs/builder-ux-polish-design-files/screenshots/06-mobile-multiclass.png), [`07-mobile-add-class-sheet.png`](../../design-briefs/builder-ux-polish-design-files/screenshots/07-mobile-add-class-sheet.png). Companion specs: [`2026-04-27-class-preview-modal-design.md`](2026-04-27-class-preview-modal-design.md), [`2026-04-27-class-step-rail-design.md`](2026-04-27-class-step-rail-design.md), [`2026-04-27-multiclass-picker-design.md`](2026-04-27-multiclass-picker-design.md), [`2026-05-01-level-up-flow-design.md`](2026-05-01-level-up-flow-design.md).

---

## Goal

Ship the full mobile builder pattern for sub-`md` viewports (< 768px). The class step rail switches from the desktop sidebar layout to a horizontal pill-rail-per-class layout with character strip at top (when multiclass), inline add-class CTA, and bottom-sheet variants of all three confirm-style surfaces (`<ClassPreviewModal>`, `<ClassPickerPanel>`, `<LevelUpPane>`). Drag-down dismisses any sheet (= Cancel).

This is purely a UI / responsive-layout slice — no engine changes, no DB migration, no new state shapes. Same `<ClassStepRail>` props, same persistence handlers. Mobile reuses every existing PR-A/B/C/D component contract verbatim; new mobile-specific components share the same prop shapes as their desktop siblings so the rail's parent doesn't care which renders.

## Non-goals

- **`<BuilderStepNav>` becomes a bottom-sheet drawer.** Mobile builder shell is its own slice. The current top stepper stays; on sub-`md` it scrolls horizontally as it does today.
- **Tablet-specific layout (md to lg).** Tablets in landscape get the desktop layout (≥768px); tablets in portrait fall sub-`md`. No middle-ground layout.
- **Mobile-specific class preview redesign.** The 4-tab structure (Overview / Features / Subclasses / Spells) inside the preview modal stays as-is on mobile. The sheet adds chrome around it; the body is unchanged.
- **Pinch-to-zoom on the rail.** Default mobile zoom behavior is fine.
- **Deep-link routing for sheets** (e.g. `?picker=open` URL state). Sheet state stays in-memory.
- **Custom mobile picker** for "Set level" (number wheel etc.). Native `<select>` renders an OS-optimal picker.
- **Mobile haptic feedback.** Browser haptic APIs are inconsistent.
- **Character primary color carry-through.** PR-F.

## Key decisions (from brainstorm)

| # | Decision | Choice |
|---|---|---|
| Q1 | Scope | Full mobile pattern — layout overhaul + bottom sheets (not strict-scope sheet-only). |
| Q2 | Which surfaces become sheets | All three: `<ClassPreviewModal>`, `<ClassPickerPanel>`, `<LevelUpPane>`. |
| Q3 | Breakpoint | Sub-`md` (< 768px) — matches existing rail breakpoint. |
| Q4 | Sheet height | ~85% viewport (tall sheet). |
| Q5 | Rail structure | Per design source: character strip only when multiclass; one horizontal scroll rail per class; sticky add-class CTA at end of rails (inline, not viewport-sticky). |
| Q6 | Componentization | Separate `<LevelRailMobile>` component (sibling of `<LevelRail>`), same prop contract. |
| Q7 | Drag-down dismiss | = Cancel for all three sheets. Tap targets (Cancel button) preserved alongside drag affordance. |

## File layout

**New files:**

| File | Responsibility |
|---|---|
| `components/builder/class-step-rail/level-rail-mobile.tsx` | Horizontal-rail variant of `<LevelRail>`. Same prop contract (`classSlug`, `className_`, `subclassName`, `currentLevel`, `perLevel`, `activeLevel`, `onSelectLevel`, `onLevelChange`, `onRemoveClass`, `disabled`, `onLevelUpClick`, `levelUpButtonState`, `levelUpButtonReason`). Renders class header strip + horizontal scroll rail + trailing `<LevelUpButton>` + "Set level" trigger + kebab menu. |
| `components/builder/class-step-rail/character-strip.tsx` | Mobile-only header strip for multiclass characters. Avatar + name + total level + per-class chip badges. Renders only when `selectedClasses.length > 1`. |
| `components/builder/class-step-rail/level-rail-set-level-sheet.tsx` | Small bottom sheet that opens when the user taps "Set level" inside `<LevelRailMobile>`. Hosts the existing `<select>` element. On confirm: fires `onLevelChange(classIndex, newLevel)` then dismisses. |
| `components/builder/class-step-rail/class-picker-sheet.tsx` | Bottom-sheet wrapper around `<ClassPickerPanel chrome="embedded">` for sub-`md`. Drag handle + close button in sheet header. |
| `components/builder/class-step-rail/level-up-sheet.tsx` | Bottom-sheet wrapper around `<LevelUpPane chrome="embedded" renderFooter={...}>` for sub-`md`. Hoists the action bar to a sticky sheet footer. |
| `components/ui/sheet.tsx` (or wrapper) | Thin wrapper using `vaul`'s `<Drawer>` to provide drag-to-dismiss bottom sheet. Same API surface as the existing shadcn `<Sheet>`. |
| `lib/builder/use-is-mobile.ts` | SSR-safe `useIsMobile()` hook backed by `matchMedia('(max-width: 767px)')`. Used by `<ClassPreviewModal>` to choose between `<Dialog>` and `<Sheet>` at mount time. Initial value matches viewport synchronously on the client (no flash). |

**Modified files:**

| File | Changes |
|---|---|
| `components/builder/class-preview-modal.tsx` (PR-A) | Conditionally render Radix `<Dialog>` (desktop) or `<Drawer>` (mobile) based on `useIsMobile()`. Same body content (4 tabs) in both. |
| `components/builder/class-step-rail/class-picker-panel.tsx` (PR-C) | Add `chrome?: "default" \| "embedded"` prop. When `embedded`, skip rendering the heading + description (the sheet header provides them). Default `"default"` = current desktop behavior. |
| `components/builder/class-step-rail/level-up-pane.tsx` (PR-D) | Add `chrome?: "default" \| "embedded"` and `renderFooter?: (footer: ReactNode) => ReactNode` props. When `embedded`, the breadcrumb stays in the body but the action bar gets rendered via `renderFooter` instead of inline (so the sheet can sticky-pin it at the bottom). Default behavior unchanged. |
| `components/builder/class-step-rail/index.tsx` | Render `<LevelRail>` (`hidden md:block`) AND `<LevelRailMobile>` (`md:hidden`) per class. Wrap in `<CharacterStrip />` (multiclass only). For the picker and level-up surfaces, render `<ClassPickerPanel>`/`<LevelUpPane>` (desktop) AND `<ClassPickerSheet>`/`<LevelUpSheet>` (mobile) — only one is visible at a time per Tailwind responsive classes. Mobile rails are inside a flex column (no grid). |
| `package.json` | Add `vaul` dependency (~5 KB gzip). |
| `tests/components/builder/class-step-rail.test.tsx` | Append integration + atomic-component tests. Uses `matchMedia` mock to simulate sub-`md` viewport. |
| `tests/components/builder/class-preview-modal.test.tsx` | Append a test that mocks `useIsMobile()` to true and verifies the modal renders as a Drawer. |

## Component shape (sub-`md`)

```
┌──────────────────────────────────────────────────┐
│  <CharacterStrip />     (only when multiclass)   │
├──────────────────────────────────────────────────┤
│  <LevelRailMobile> for class[0]                  │
│  ┌─────────────────────────────────────────────┐ │
│  │ [P] Paladin   Lv 6  [Set level]   [⋯]      │ │
│  │ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐  │ │
│  │ │ 1│ │ 2│ │ 3│●│ 4│●│ 5│ │ 6│ │ +│       │ │ scroll-x
│  │ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘  │ │
│  └─────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────┤
│  <LevelRailMobile> for class[1]   (when multiclass) │
├──────────────────────────────────────────────────┤
│  <AddClassRow />  (inline at end of rail content)│
├──────────────────────────────────────────────────┤
│  <ClassLevelPane /> (body for selected level)    │
│  ↓ scrollable                                    │
│   • feature cards                                │
│   • choice cards                                 │
│   • HpPicker (Q9 retrofit)                       │
└──────────────────────────────────────────────────┘
```

### `<LevelRailMobile>`

Same prop contract as `<LevelRail>` so the parent can render both:

```tsx
<LevelRail {...railProps} className="hidden md:block" />
<LevelRailMobile {...railProps} className="md:hidden" />
```

Internal layout:

- **Header strip** (single row): `<ClassEmblem size="sm">` · class name · current-level glyph · "Set level" button · kebab menu (⋯). Subclass name (if present) shown muted under the class name.
- **Horizontal scroll rail**: flex-row, `overflow-x-auto`, `scroll-snap-type: x proximity`. Pills are `scroll-snap-align: center`. Width fixed at ~58px each (matches design source's M2). Unmade-choice red dot rendered absolutely positioned per pill.
- **Trailing `<LevelUpButton>`**: rendered as the last item in the scroll rail. Idle/disabled/active-flow states unchanged from PR-D.

When `disabled={true}` is passed:
- All level pills become non-interactive (`aria-disabled="true"`, no click handlers).
- "Set level" button is disabled (`disabled` attribute).
- Kebab menu is disabled.
- `<LevelUpButton>` receives the disabled state with reason text.

### `<CharacterStrip>`

```
┌──────────────────────────────────────────────────┐
│  [KV]  Kaelith Vex                          [P]6 │
│        Lv 9/20 · merged slots · +4 prof    [S]3  │
└──────────────────────────────────────────────────┘
```

- Avatar: shadcn `<Avatar>` with character initials fallback (32×32 circle).
- Character name (text-sm, font-semibold) + level/slot summary (text-[10.5px] muted).
- Right side: per-class chip badges in a flex row. Each badge = `<ClassEmblem size="sm">` + tabular-nums level number. Decorative (`aria-hidden="true"`).

Renders only when `selectedClasses.length > 1`.

### `<LevelRailSetLevelSheet>`

Small bottom sheet (~30% viewport height) that opens on "Set level" tap. Body: a `<select>` with options 1..20 (capped at remaining levels for the current class). On confirm: fires `onLevelChange(classIndex, newLevel)` and dismisses.

Drag-down or close button = dismiss without firing onLevelChange.

### `<ClassPickerSheet>`

Bottom sheet (~85% viewport) wrapping `<ClassPickerPanel chrome="embedded">`. Sheet chrome:

- Drag handle (4px tall, centered, top of sheet).
- Header: `<SheetTitle>"Add a class"</SheetTitle>` + close button (✕).
- Body: scrollable; the picker panel's 1-column grid renders inside (existing `grid-cols-1 sm:grid-cols-2` already handles this — no change).
- No footer; Cancel = drag-down or close button or backdrop tap.

When a card is tapped, `<ClassPreviewSheet>` (= `<ClassPreviewModal>` rendered as Drawer) stacks on top. Both sheets are mounted.

### `<LevelUpSheet>`

Bottom sheet (~85% viewport) wrapping `<LevelUpPane chrome="embedded" renderFooter={...}>`. Sheet chrome:

- Drag handle.
- Header: `<SheetTitle>` showing the breadcrumb-equivalent ("Paladin · Level 7" + NEW LEVEL ribbon).
- Body: feature cards + choice cards + HpPicker, all from `<LevelUpPane>`.
- Sticky footer: `<LevelUpActionBar>` from PR-D (Cancel + summary + Confirm) — pinned at the bottom of the sheet so Confirm is always reachable.
- Drag-down = `onCancelLevelUp`.

### `<ClassPreviewModal>` (modified)

Internally chooses Radix `<Dialog>` or `<Drawer>` based on `useIsMobile()` at mount time. Same body in both. Footer (Cancel + Pick) stays in both variants. Drag-down on the Drawer = onCancel.

## Sheet primitive

We add `vaul` (~5 KB gzip) as the canonical mobile-bottom-sheet primitive:

- Drag-down to dismiss with a 30% threshold (snap back below threshold).
- Drag from inside a scrollable body → scrolls the body, doesn't drag the sheet (vaul handles this natively).
- Backdrop tap = dismiss.
- Esc key = dismiss (when paired physical keyboard present).
- Hardware Back (Android) = dismiss the topmost sheet (single sheet at a time on the stack closes one per back press).

A thin wrapper at `components/ui/sheet.tsx` (or a new `drawer.tsx` if the existing `sheet.tsx` is preserved for non-mobile uses) exports `<Drawer>`, `<DrawerTrigger>`, `<DrawerContent>`, `<DrawerHeader>`, `<DrawerTitle>`, `<DrawerDescription>`, `<DrawerFooter>` matching shadcn's pattern.

## Responsive switching mechanism

**Tailwind responsive classes** (preferred): for `<LevelRail>` vs. `<LevelRailMobile>`, `<ClassPickerPanel>` vs. `<ClassPickerSheet>`, `<LevelUpPane>` vs. `<LevelUpSheet>` — both render server-side, one is hidden by Tailwind class. SSR-safe, no flash on first paint.

```tsx
<LevelRail className="hidden md:block" {...props} />
<LevelRailMobile className="md:hidden" {...props} />
```

**`useIsMobile()` hook** (used only where Tailwind classes can't help): for `<ClassPreviewModal>`, where Radix `<Dialog>` and `<Drawer>` mount different React roots — we have to pick one at render time. The hook reads `matchMedia('(max-width: 767px)')`:

- On the server, returns `false` (desktop default). Server renders `<Dialog>`.
- On the client, the initial state is read synchronously from `matchMedia` so the first client paint matches the actual viewport — no flash if the user is on mobile (because the dialog and drawer are conditionally mounted only when the modal is open, and the user can't open a modal until after hydration).
- Updates via `matchMedia.addEventListener('change', ...)` so resize between mobile/desktop ranges (rare) re-renders the modal in the right primitive — the modal will re-mount in that case, which is acceptable.

The hook lives at `lib/builder/use-is-mobile.ts`. Single responsibility. Trivial to test.

## State machine

No new state. Same backend state as PR-D (`levelUpDraft`, `showPicker`, `selected`). Mobile rendering is a pure visual variant — clicks call the same handlers, the same `useEffect`s drive the same transitions.

The picker/level-up sheet OPEN state is implicit: when `showPicker` is true on sub-`md`, the sheet is mounted and visible. When false, the sheet is unmounted. Same for `levelUpDraft`. Tailwind's `hidden md:block` / `md:hidden` toggles which surface is mounted (only one renders at a time per breakpoint).

## Interactions

| Trigger | Behavior |
|---|---|
| Tap a level pill in `<LevelRailMobile>` | Same as desktop — calls `onSelectLevel(level)`. Body content updates. Pill scroll-snaps to center. |
| Tap "Set level" in rail header | Opens `<LevelRailSetLevelSheet>`. On confirm: `onLevelChange(classIndex, newLevel)` + dismiss. |
| Tap kebab (⋯) in rail header | Opens `<DropdownMenu>` with "Remove [Class]". Tap fires `onRemoveClass(classIndex)`. |
| Tap trailing `<LevelUpButton>` (idle) | Opens `<LevelUpSheet>`. Hard-lock kicks in on all rails. |
| Tap unlocked `<AddClassRow>` (inline) | Opens `<ClassPickerSheet>`. |
| Tap a met card in picker sheet | Stacks `<ClassPreviewSheet>` (= modal) on top. Picker stays mounted underneath. |
| Tap "Pick this class" in preview sheet | Both sheets dismiss. `selectedClasses.length` increments. Rail's `useEffect` lands user on new class's pane. |
| Tap Cancel in preview sheet | Only preview dismisses. Picker remains. |
| Drag down on any sheet | Same as the explicit Cancel button — fires `onCancel` / `onCancelLevelUp`. Sheet animates down and dismisses. |
| Tap close (✕) in any sheet header | Same as drag-down. |
| Tap backdrop | Same as drag-down. |
| Hardware Back (Android) | Closes topmost sheet. |
| Esc (paired keyboard) | Same as drag-down. |

**Hard-lock during a level-up flow on mobile:** Same as desktop:
- Other class's `<LevelRailMobile>` gets `disabled={true}` — pills non-interactive, "Set level" disabled, kebab disabled, `<LevelUpButton>` disabled with reason text.
- Active class's `<LevelRailMobile>` shows the draft pill at the new level position (last pill in scroll rail with active+choice treatment).
- `<AddClassRow>` shows "Finish active level-up first".
- The body underneath the level-up sheet still shows the regular `<ClassLevelPane>` for the previously-selected level.

**Mutual exclusion with multiclass picker:** Opening one closes the other (same as desktop).

## A11y

- `<LevelRailMobile>` rail: `<nav aria-label="Class levels">` wrapping the scroll-rail. Each pill is a `<button role="tab" aria-selected={isActive}>`. `aria-controls` points to the body section for that level. Keyboard arrow keys navigate left/right between pills.
- `<CharacterStrip>`: `<div role="region" aria-label="Character summary">`. Per-class chip badges are decorative (`aria-hidden="true"`) — level info is duplicated in the rail headers below.
- Sheet a11y: Radix's `<Drawer>` provides `role="dialog"` + `aria-modal="true"` + `aria-labelledby` pointing to `<DrawerTitle>`. Focus trap inside the sheet. Esc / drag-down / backdrop / close button all dismiss with proper focus restoration.
- Drag handle: `role="button" aria-label="Close sheet"`, `tabIndex={0}` so keyboard users can focus it and press Enter/Space to dismiss.
- NEW LEVEL ribbon inside `<LevelUpSheet>`: same `role="status" aria-label="Pending new level"` as desktop. Sheet's `aria-live` region announces it on open.
- Tab order in sheets: header (close button) → body (top-down through content) → footer (Cancel → Confirm).
- The Dialog ↔ Drawer swap on `<ClassPreviewModal>` happens at mount time. If the user resizes from mobile to desktop mid-flow (rare), the modal stays in whichever variant was mounted; closing and re-opening picks the correct one for the new size.

## Animations

- Sheet slide-up: 250ms cubic-bezier ease-out (vaul default). On `prefers-reduced-motion: reduce`, drop to 120ms with no spring.
- Sheet dismiss: same in reverse.
- NEW LEVEL ribbon fade-in inside the level-up sheet: same as desktop (200ms ease-out), wrapped in `motion-safe:`.
- HP picker value change inside the level-up sheet: same +/- delta count animation as desktop.
- Pill scroll-snap-align with smooth scroll behavior (`scroll-behavior: smooth`); reduced-motion users get instant snap.

## Tests

vitest + testing-library. New tests use a `matchMedia` mock from `vi.fn()` set up in `beforeEach` per describe block to control mobile/desktop rendering.

1. **`<LevelRailMobile>`:**
   - Renders class header strip with name, current level, "Set level", kebab.
   - Renders horizontal pill scroll rail with one pill per `perLevel` row.
   - Renders trailing `<LevelUpButton>`.
   - `disabled` prop locks pill interaction + "Set level" + kebab.
   - `onSelectLevel` fires on pill tap.
   - `onLevelUpClick` fires on trailing button tap when idle.
   - Active pill has `aria-selected="true"`.
   - Has-unmade-choice red dot on the right pills.

2. **`<CharacterStrip>`:**
   - Renders only when `selectedClasses.length > 1`.
   - Avatar shows character initials.
   - Name + level summary present.
   - Per-class chip badges render with correct `<ClassEmblem>` letter + tabular-nums level.
   - Badges marked `aria-hidden`.

3. **`<LevelRailSetLevelSheet>`:**
   - Renders sheet with `aria-labelledby` pointing to "Set level for {Class}".
   - Hosts a level select.
   - On confirm, fires `onLevelChange(classIndex, newLevel)` and dismisses.
   - Drag-down dismisses without firing onLevelChange.

4. **`<ClassPickerSheet>`:**
   - Renders Radix `<Drawer>` with drag handle + close button.
   - `<ClassPickerPanel chrome="embedded">` inside hides its own heading.
   - Cancel button + drag-down + close X all fire `onCancel`.
   - Card tap fires `onSelect(content)`.

5. **`<LevelUpSheet>`:**
   - Same chrome as picker sheet.
   - `<LevelUpPane chrome="embedded" renderFooter={...}>` puts the action bar in the sheet footer.
   - Drag-down fires `onCancel`.

6. **`<ClassPreviewModal>`:**
   - Mocks `useIsMobile()` to return false → verifies `<Dialog>` renders.
   - Mocks true → verifies `<Drawer>` renders.
   - Same body content (4 tabs) renders identically in both variants.

7. **`<ClassStepRail>` integration (sub-`md`):**
   - Mocks viewport via `matchMedia`.
   - Verifies `<LevelRailMobile>` renders for each class section, `<LevelRail>` does not.
   - `<CharacterStrip>` renders only when multiclass.
   - Tap `<LevelUpButton>` → `<LevelUpSheet>` opens.
   - Drag-down on the sheet → `onCancelLevelUp` fires + sheet dismisses.
   - Pick HP + ASI + Confirm → `onConfirmLevelUp` fires with right payload.
   - Mid-flow hard-lock disables other rails (other class's pills + Set level + kebab + `<LevelUpButton>`).

8. **Manual UAT** (browser, mobile emulation in Chrome DevTools):
   - Full picker → preview → pick flow.
   - Full level-up flow.
   - Hard-lock during level-up flow.
   - Character strip on multiclass.
   - Sticky add-class CTA at end of rail.
   - Drag-down dismiss on all three sheets.
   - Kebab → Remove Class flow.

## Implementation references

- Source design: [`docs/design-briefs/builder-ux-polish-design-files/mobile-variants.jsx`](../../design-briefs/builder-ux-polish-design-files/mobile-variants.jsx) (artboards M1–M4) and [`level-up-flow.jsx`](../../design-briefs/builder-ux-polish-design-files/level-up-flow.jsx) (L3 mobile).
- Screenshots: [`06-mobile-multiclass.png`](../../design-briefs/builder-ux-polish-design-files/screenshots/06-mobile-multiclass.png), [`07-mobile-add-class-sheet.png`](../../design-briefs/builder-ux-polish-design-files/screenshots/07-mobile-add-class-sheet.png).
- PR-A (modal): [`2026-04-27-class-preview-modal-design.md`](2026-04-27-class-preview-modal-design.md).
- PR-B (rail): [`2026-04-27-class-step-rail-design.md`](2026-04-27-class-step-rail-design.md).
- PR-C (multiclass picker): [`2026-04-27-multiclass-picker-design.md`](2026-04-27-multiclass-picker-design.md).
- PR-D (level-up flow): [`2026-05-01-level-up-flow-design.md`](2026-05-01-level-up-flow-design.md).
- vaul docs: <https://vaul.emilkowal.ski/>
- Reused PR-A primitives: `<ClassEmblem>`, `<ClassPreviewModal>` (modified for Dialog↔Drawer swap).
- Reused PR-B primitives: `<LevelPill>`, `<FeatureCard>`, `<ChoiceCard*>`, `<LevelRail>` (kept for desktop).
- Reused PR-C primitives: `<ClassPickerPanel>` (modified with `chrome` prop), `<ClassPickerCard>`.
- Reused PR-D primitives: `<LevelUpPane>` (modified with `chrome` + `renderFooter` props), `<LevelUpButton>`, `<LevelUpActionBar>`, `<HpPicker>`.

## Out of scope / deferred (recap)

| Item | When |
|---|---|
| `<BuilderStepNav>` mobile drawer | Mobile builder shell slice |
| Tablet-specific intermediate layout | Out of M2 scope |
| Class preview modal mobile redesign (swipe tabs etc.) | Out of M2 scope |
| Pinch-to-zoom on the rail | Not useful |
| Deep-link routing for sheets | Separate slice |
| Custom mobile picker for "Set level" | Native `<select>` is sufficient |
| Mobile haptic feedback | Out of scope |
| Character primary color carry-through | PR-F |
