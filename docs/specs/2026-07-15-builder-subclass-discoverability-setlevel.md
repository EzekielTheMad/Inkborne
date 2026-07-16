# Builder: subclass discoverability + set-level choice gating + dialog a11y (UAT A3–A5)

**Date:** 2026-07-15 · **Track:** A (alpha #1 punch list, 2026-06-19 UAT) · **Scope:** class step rail only.

## Problems

- **A3 — Subclass discoverability.** Required subclass choices (Cleric Divine Domain, Wizard Arcane Tradition, …) are effectively invisible outside the step-by-step level-up flow. On desktop the only cue is a 1.5px red dot on the level pill; on mobile there is *no* static per-level body at all — tapping a level pill updates internal state but renders nothing, so a required choice can never be made outside the level-up sheet.
- **A4 — Direct "Set level" skips required choices.** Confirmed by code reading and a reproducing test: both the desktop level `<select>` in `LevelRail` and the mobile `LevelRailSetLevelSheet` call `onLevelChange` → the parent persists the new level with **no** required-choice checks and no surfacing of the skipped choices (this is how "Voltee", Wizard 3, ended up with no Arcane Tradition).
- **A5 — Residual `DialogTitle` warning.** `LevelRailSetLevelSheet` *has* a `DrawerTitle`, but overrides its `id`. Radix's a11y check looks up its own generated `titleId` (also used for `aria-labelledby`), finds nothing, and warns — the dialog also loses its accessible name.

## Decision

Surface pending required choices, don't hard-gate the jump. Gating the set-level sheet on choices would dead-end (choices can't be made inside that small sheet, and the guided path for that already exists: the level-up flow). Instead the set-level jump lands the user directly on the first pending choice, and a persistent, visible affordance remains until every required choice is made. This reuses the existing per-level choice cards (`ChoiceCardSubclass` etc.) rather than building a second selector.

## Changes

1. **`pendingChoicesUpTo(perLevel, level)`** (`lib/builder/class-features-per-level.ts`): returns `{ level, choice }` for every unmade required choice at or below `level`.
2. **`<PendingChoiceCallout>`** (new): gold "Choose your {label} · Lv {n}" button list rendered by both `LevelRail` (desktop, between pills and the level-up button) and `LevelRailMobile` (under the pill rail). Click → `onSelectLevel(level)`. Hidden while a level-up flow has the rail locked.
3. **`<ClassLevelSheet>`** (new, mobile): vaul Drawer wrapping the existing `ClassLevelPane` — gives mobile the missing static per-level body. Tapping a level pill or a callout on mobile opens it.
4. **Set-level surfacing** (`class-step-rail/index.tsx`): on any set-level change, select the first pending-choice level (else the new level) so the desktop pane — or the mobile sheet, opened automatically — shows the skipped choice immediately.
5. **A5 fix**: drop the `id` override on the sheet's `DrawerTitle` so Radix's generated `titleId` / `aria-labelledby` wiring works.

Out of scope: HP rolls for skipped levels (tracked by the HP picker per level, not by the required-choice model), stranded choices when setting a level *down*, equipment chooser (A2).
