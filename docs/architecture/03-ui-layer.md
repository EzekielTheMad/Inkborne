# UI / Component Layer

The Inkborne UI is a Next.js 16 / TypeScript / Tailwind / shadcn-style codebase split into four regions: the **builder** flow ([components/builder/](../../components/builder)), the **sheet** ([components/sheet/](../../components/sheet)), shadcn **primitives** ([components/ui/](../../components/ui)), and a thin **app shell** ([components/nav/](../../components/nav), [components/character/](../../components/character)). Visual conventions and the design language for the recent M2 builder refactor live in [docs/design-briefs/builder-ux-polish.md](../design-briefs/builder-ux-polish.md) — this document maps the file layout, component contracts, and cross-cutting prop shapes a refactor session needs to orient.

## Builder layer

The builder owns the character creation flow under [app/(app)/characters/[id]/builder/](../../app/(app)/characters/%5Bid%5D/builder), with one page per step (`race`, `class`, `abilities`, `background`, `equipment`). Each step page is a server component that hydrates a `*-step-client.tsx` client component which wires server actions through to the components in [components/builder/](../../components/builder). [components/builder/builder-step-nav.tsx](../../components/builder/builder-step-nav.tsx) renders the breadcrumb at the top of every step.

### Top-level builder components

| File | Purpose |
| --- | --- |
| [components/builder/builder-step-nav.tsx](../../components/builder/builder-step-nav.tsx) | Top-of-page breadcrumb showing per-step `complete` / `in_progress` / `untouched` status. |
| [components/builder/content-browser.tsx](../../components/builder/content-browser.tsx) | Searchable card grid for race/class/background/equipment picking. Defines the canonical `ContentEntry` shape (see below). |
| [components/builder/content-preview.tsx](../../components/builder/content-preview.tsx) | Dialog confirming a `ContentEntry` selection — used for race/background; superseded for class by `ClassPreviewModal`. |
| [components/builder/class-preview-modal.tsx](../../components/builder/class-preview-modal.tsx) | M2 PR-A. Tabbed Dialog (Overview / Features / Subclasses / Spells) shown before committing to a class. Uses `useIsMobile()` to swap to a Drawer on small viewports. |
| [components/builder/class-preview-modal/{overview,features,subclasses,spells}-tab.tsx](../../components/builder/class-preview-modal) | Per-tab bodies for the modal above. |
| [components/builder/class-emblem.tsx](../../components/builder/class-emblem.tsx) | Letter-in-a-circle class glyph; tone (gold/purple) sourced from [lib/builder/class-tone.ts](../../lib/builder/class-tone.ts). |
| [components/builder/asi-selector.tsx](../../components/builder/asi-selector.tsx) | +2 to one ability OR +1 to two abilities picker. |
| [components/builder/choice-selector.tsx](../../components/builder/choice-selector.tsx) | Generic multi-select for `ChoiceEffect.from` with a `choose` budget. |
| [components/builder/subclass-selector.tsx](../../components/builder/subclass-selector.tsx) | `<select>` for subclass slug, filtered by `parent_class`. |
| [components/builder/stat-preview.tsx](../../components/builder/stat-preview.tsx) | Live read-out of derived stats from [lib/engine/evaluator.ts](../../lib/engine/evaluator.ts). |

### `class-step-rail/` subsystem

Self-contained subsystem that drives the class step (single-class through level-20 multiclass). Entry point [components/builder/class-step-rail/index.tsx](../../components/builder/class-step-rail/index.tsx) (~590 lines) is a stateful orchestrator: tracks the selected `(classIndex, level)`, the level-up `draft`, the picker open/close, and per-draft `hpRolls`. It branches on `useIsMobile()` from [lib/builder/use-is-mobile.ts](../../lib/builder/use-is-mobile.ts) (SSR-safe, returns `false` until post-hydration `matchMedia` settles) — desktop uses a 240px-rail-plus-pane grid, mobile stacks the rails and uses Drawers for the level-up + picker.

| File | Purpose |
| --- | --- |
| [class-step-rail/index.tsx](../../components/builder/class-step-rail/index.tsx) | Orchestrator. Owns `selected`, `levelUpDraft`, `showPicker`, `draftHpRolls`. Composes everything below. |
| [class-step-rail/level-rail.tsx](../../components/builder/class-step-rail/level-rail.tsx) | Desktop vertical rail of `LevelPill`s with class header, subclass label, level dropdown, remove button, level-up CTA. |
| [class-step-rail/level-rail-mobile.tsx](../../components/builder/class-step-rail/level-rail-mobile.tsx) | Mobile-first rail variant — kebab menu for set-level / remove, opens `LevelRailSetLevelSheet` Drawer for level changes. |
| [class-step-rail/level-rail-set-level-sheet.tsx](../../components/builder/class-step-rail/level-rail-set-level-sheet.tsx) | Mobile Drawer that wraps a stepper for `onLevelChange(classIndex, newLevel)`. |
| [class-step-rail/level-pill.tsx](../../components/builder/class-step-rail/level-pill.tsx) | Single row in a rail — level number, summary string, unmade-choice red dot, active-state highlight. |
| [class-step-rail/level-up-button.tsx](../../components/builder/class-step-rail/level-up-button.tsx) | Tone-aware "Level up to N" button. States: `idle` / `disabled` / `active-flow`. |
| [class-step-rail/level-up-action-bar.tsx](../../components/builder/class-step-rail/level-up-action-bar.tsx) | Cancel / Confirm bar at the bottom of `LevelUpPane`; aria-describedby wires a missing-prereq reason. |
| [class-step-rail/class-level-pane.tsx](../../components/builder/class-step-rail/class-level-pane.tsx) | Desktop right-pane for the **active** level — renders `FeatureCard`s and the relevant `ChoiceCard*`s for the current row. |
| [class-step-rail/level-up-pane.tsx](../../components/builder/class-step-rail/level-up-pane.tsx) | Desktop right-pane for an **in-flight** level-up draft — same content cards plus `HpPicker` and `LevelUpActionBar`. |
| [class-step-rail/level-up-sheet.tsx](../../components/builder/class-step-rail/level-up-sheet.tsx) | Mobile Drawer wrapper around `LevelUpPane`. |
| [class-step-rail/feature-card.tsx](../../components/builder/class-step-rail/feature-card.tsx) | Read-only feature display card (name + description). |
| [class-step-rail/choice-card-asi.tsx](../../components/builder/class-step-rail/choice-card-asi.tsx) | ASI choice card — single/split mode, +2 or +1/+1 picker. |
| [class-step-rail/choice-card-fighting-style.tsx](../../components/builder/class-step-rail/choice-card-fighting-style.tsx) | Fighting Style picker with class/feature scoping. |
| [class-step-rail/choice-card-subclass.tsx](../../components/builder/class-step-rail/choice-card-subclass.tsx) | Subclass picker, filtered by `parent_class === classSlug`. |
| [class-step-rail/choice-card-generic.tsx](../../components/builder/class-step-rail/choice-card-generic.tsx) | Wraps `ChoiceSelector` for any `ChoiceEffect`. |
| [class-step-rail/hp-picker.tsx](../../components/builder/class-step-rail/hp-picker.tsx) | HP method picker: average / roll / fixed; calls `crypto.getRandomValues` for rolls. |
| [class-step-rail/character-strip.tsx](../../components/builder/class-step-rail/character-strip.tsx) | Multiclass-only header strip showing initials, total level / 20, class badges. Renders `null` for single-class. |
| [class-step-rail/add-class-row.tsx](../../components/builder/class-step-rail/add-class-row.tsx) | Footer row under the rails — `unlocked` (accent border + plus) or `locked` (dashed + lock + reasons). |
| [class-step-rail/class-picker-panel.tsx](../../components/builder/class-step-rail/class-picker-panel.tsx) | Desktop right-pane multiclass picker — grid of `ClassPickerCard`s with `met` / `not-met` prereq state. |
| [class-step-rail/class-picker-sheet.tsx](../../components/builder/class-step-rail/class-picker-sheet.tsx) | Mobile Drawer wrapper around `ClassPickerPanel` (chrome=embedded). |
| [class-step-rail/class-picker-card.tsx](../../components/builder/class-step-rail/class-picker-card.tsx) | Per-class card in the picker — emblem, name, role/hit-die, lock icon when prereq unmet. |

The rail subsystem reads two important data shapes built outside it: `PerLevel[]` from [lib/builder/class-features-per-level.ts](../../lib/builder/class-features-per-level.ts) and prereq results from [lib/builder/multiclass-prereqs.ts](../../lib/builder/multiclass-prereqs.ts).

## Sheet layer

The sheet is the **sacred surface** per [docs/design-briefs/builder-ux-polish.md](../design-briefs/builder-ux-polish.md) — it should be cited for prop shapes, not redesigned. It renders inside the unified character page at [app/(app)/characters/[id]/page.tsx](../../app/(app)/characters/%5Bid%5D/page.tsx), which hydrates [components/character/character-page-client.tsx](../../components/character/character-page-client.tsx). That client wraps the page in `CharacterProvider` from [lib/character/character-context.tsx](../../lib/character/character-context.tsx) and renders [components/character/character-shell.tsx](../../components/character/character-shell.tsx), which switches between [components/character/sheet-panel.tsx](../../components/character/sheet-panel.tsx) and [components/character/narrative-panel.tsx](../../components/character/narrative-panel.tsx) via tabs. The legacy route [app/characters/[id]/sheet/page.tsx](../../app/characters/%5Bid%5D/sheet/page.tsx) just `redirect`s to `/characters/[id]`.

### Sheet ribbon + widgets

| File | Purpose |
| --- | --- |
| [components/sheet/character-header.tsx](../../components/sheet/character-header.tsx) | Top-of-page header — portrait, name, class line, inspiration star, back arrow, edit pencil. |
| [components/sheet/stat-ribbon.tsx](../../components/sheet/stat-ribbon.tsx) | Header strip composing `AbilityCard`s, `CombatStats`, `HPTracker`, `DeathSaves`, `RestButton`. |
| [components/sheet/ability-card.tsx](../../components/sheet/ability-card.tsx) | One STR/DEX/etc. card — score + signed modifier. |
| [components/sheet/combat-stats.tsx](../../components/sheet/combat-stats.tsx) | AC / Initiative / Speed / Prof bonus tiles. |
| [components/sheet/hp-tracker.tsx](../../components/sheet/hp-tracker.tsx) | HP popover — current / max / temp; uses `@base-ui/react/popover`. |
| [components/sheet/death-saves.tsx](../../components/sheet/death-saves.tsx) | Renders only at 0 HP; success/failure dots. |
| [components/sheet/rest-button.tsx](../../components/sheet/rest-button.tsx) | Stat-ribbon trigger that lazy-mounts `RestDialog`. |
| [components/sheet/rest-dialog.tsx](../../components/sheet/rest-dialog.tsx) | Two-pane Dialog (short rest / long rest) wired to `useRest` from the character context. |
| [components/sheet/saving-throws.tsx](../../components/sheet/saving-throws.tsx) | Six save rows with proficiency dots. |
| [components/sheet/passive-senses.tsx](../../components/sheet/passive-senses.tsx) | Passive perception / investigation / insight tiles. |
| [components/sheet/defenses.tsx](../../components/sheet/defenses.tsx) | Damage resistances + save advantages/immunities. Renders nothing if empty. |
| [components/sheet/conditions.tsx](../../components/sheet/conditions.tsx) | Toggleable booleans for the 5e conditions plus a leveled exhaustion pill. |
| [components/sheet/skills-list.tsx](../../components/sheet/skills-list.tsx) | All 18 skills with proficiency / expertise dots. |
| [components/sheet/proficiencies.tsx](../../components/sheet/proficiencies.tsx) | Armor / weapon / tool / language proficiencies pulled from `GrantEffect`s. |
| [components/sheet/activation-toggles.tsx](../../components/sheet/activation-toggles.tsx) | Generic on/off switch row for activatable effects. |
| [components/sheet/equipment-state.tsx](../../components/sheet/equipment-state.tsx) | Armor type + shield equipped selector (legacy; mostly superseded by inventory). |
| [components/sheet/quick-notes.tsx](../../components/sheet/quick-notes.tsx) | Debounced free-text scratchpad on the sheet. |
| [components/sheet/resources-widget.tsx](../../components/sheet/resources-widget.tsx) | Left-rail panel listing feature resources grouped by recovery (short/long). |
| [components/sheet/resource-counter.tsx](../../components/sheet/resource-counter.tsx) | Shared counter primitive used by widget + features-tab cards (`layout: "widget" | "card"`). |
| [components/sheet/mobile-sheet.tsx](../../components/sheet/mobile-sheet.tsx) | Mobile-only single-column sheet body with tab strip (`stats`, `skills`, `actions`, `spells`, `inventory`, `features`). |
| [components/sheet/content-tabs.tsx](../../components/sheet/content-tabs.tsx) | Desktop tab container for Actions / Spells / Inventory / Features / Notes. |

### Sheet tabs (`tabs/`)

| File | Purpose |
| --- | --- |
| [components/sheet/tabs/actions-tab.tsx](../../components/sheet/tabs/actions-tab.tsx) | Attack / cantrip / action listing with sub-filters. |
| [components/sheet/tabs/spells-tab.tsx](../../components/sheet/tabs/spells-tab.tsx) | Composes `SpellHeader`, `SlotTracker`, `SpellLevelSection`s, `AddSpellPanel`. |
| [components/sheet/tabs/inventory-tab.tsx](../../components/sheet/tabs/inventory-tab.tsx) | Inventory body — sections, currency, weight, add panel. |
| [components/sheet/tabs/features-tab.tsx](../../components/sheet/tabs/features-tab.tsx) | Class/race/background features + per-feature `ResourceCounter`s. |
| [components/sheet/tabs/notes-tab.tsx](../../components/sheet/tabs/notes-tab.tsx) | Long-form notes editor (debounced patch). |

### Inventory + spell sub-components

| File | Purpose |
| --- | --- |
| [components/sheet/inventory/inventory-section.tsx](../../components/sheet/inventory/inventory-section.tsx) | Collapsible category section with count badge. |
| [components/sheet/inventory/add-item-panel.tsx](../../components/sheet/inventory/add-item-panel.tsx) | Search + filter + add panel for items in the SRD. |
| [components/sheet/inventory/custom-item-form.tsx](../../components/sheet/inventory/custom-item-form.tsx) | Free-form item creation (name, weight, value, custom_data). |
| [components/sheet/inventory/item-detail-card.tsx](../../components/sheet/inventory/item-detail-card.tsx) | Expandable per-item card with quantity steppers. |
| [components/sheet/inventory/item-filters.tsx](../../components/sheet/inventory/item-filters.tsx) | Category pill filter row. |
| [components/sheet/inventory/currency-tracker.tsx](../../components/sheet/inventory/currency-tracker.tsx) | PP/GP/EP/SP/CP editable tracker. |
| [components/sheet/inventory/weight-bar.tsx](../../components/sheet/inventory/weight-bar.tsx) | Encumbrance progress bar. |
| [components/sheet/spells/spell-header.tsx](../../components/sheet/spells/spell-header.tsx) | "Cantrips known / Spells prepared" summary row. |
| [components/sheet/spells/slot-tracker.tsx](../../components/sheet/spells/slot-tracker.tsx) | Slot dots per level + pact slots. |
| [components/sheet/spells/spell-level-section.tsx](../../components/sheet/spells/spell-level-section.tsx) | Collapsible per-level grouping. |
| [components/sheet/spells/spell-row.tsx](../../components/sheet/spells/spell-row.tsx) | One-line spell entry with prepare toggle + remove. |
| [components/sheet/spells/add-spell-panel.tsx](../../components/sheet/spells/add-spell-panel.tsx) | Spell search / filter / add. |
| [components/sheet/spells/concentration-badge.tsx](../../components/sheet/spells/concentration-badge.tsx) | Floating purple pill showing the currently concentrated spell. |

## UI primitives

[components/ui/](../../components/ui) holds the shadcn primitives. Most wrap `@base-ui/react` (Anthropic's shadcn fork uses Base UI rather than Radix in places). Notable: `sheet.tsx` and `dialog.tsx` are Base UI; `drawer.tsx` is **`vaul`-based** and was added in PR-E (`feat(builder): mobile builder pattern — PR-E of M2 #47`) specifically to provide bottom-sheet UX for mobile.

| File | Backing primitive |
| --- | --- |
| [components/ui/accordion.tsx](../../components/ui/accordion.tsx) | `@base-ui/react` accordion |
| [components/ui/avatar.tsx](../../components/ui/avatar.tsx) | `@base-ui/react` avatar |
| [components/ui/badge.tsx](../../components/ui/badge.tsx) | CVA variants over a `<span>` |
| [components/ui/button.tsx](../../components/ui/button.tsx) | CVA variants over `<button>`; `asChild` slot |
| [components/ui/card.tsx](../../components/ui/card.tsx) | Bare `div`s with token classes |
| [components/ui/dialog.tsx](../../components/ui/dialog.tsx) | `@base-ui/react/dialog` |
| [components/ui/drawer.tsx](../../components/ui/drawer.tsx) | **`vaul`** — added in PR-E for mobile bottom-sheets |
| [components/ui/dropdown-menu.tsx](../../components/ui/dropdown-menu.tsx) | `@base-ui/react/menu` |
| [components/ui/input.tsx](../../components/ui/input.tsx) | Styled `<input>` |
| [components/ui/label.tsx](../../components/ui/label.tsx) | `@base-ui/react` label |
| [components/ui/select.tsx](../../components/ui/select.tsx) | `@base-ui/react/select` |
| [components/ui/separator.tsx](../../components/ui/separator.tsx) | Styled `<hr>` |
| [components/ui/sheet.tsx](../../components/ui/sheet.tsx) | `@base-ui/react/dialog` (side-anchored) |
| [components/ui/tabs.tsx](../../components/ui/tabs.tsx) | `@base-ui/react/tabs` with CVA `variant: "default" \| "line"` |
| [components/ui/tooltip.tsx](../../components/ui/tooltip.tsx) | `@base-ui/react/tooltip` |

## Tokens & styling conventions

Tokens are CSS custom properties on `:root` and `.dark` in [app/globals.css](../../app/globals.css), surfaced to Tailwind via an `@theme inline` block at the top of the same file (the Tailwind v4 config-in-CSS pattern). The token palette is **hex** (not HSL), e.g. `--primary: #7c3aed`, `--accent: #c9a44a`. Light mode currently mirrors dark mode.

Tailwind classes consume the tokens as semantic roles: `bg-background`, `bg-card`, `bg-muted`, `bg-primary`, `bg-accent`, `text-foreground`, `text-muted-foreground`, `text-accent`, `text-destructive`, `border-border`, `ring-ring`. Components use these names (not raw colors) almost everywhere — exceptions are the `class-tone` helper and `class-emblem` / `level-up-button`, which embed `rgba(201,164,74,…)` (gold) and `rgba(124,58,237,…)` (purple) literals to render translucent tone-tinted variants the token system doesn't express directly.

Editor-specific styling (Tiptap rich text) lives at the bottom of `globals.css` under `.tiptap.prose-editor *` rules — out of scope for the broader UI but worth knowing about when refactoring narrative components.

## Tests of components

Component-level tests live under [tests/components/](../../tests/components) and run with Vitest + Testing Library.

| File | Notes |
| --- | --- |
| [tests/components/builder/choice-selector.test.tsx](../../tests/components/builder/choice-selector.test.tsx) | Generic choice picker. |
| [tests/components/builder/class-emblem.test.tsx](../../tests/components/builder/class-emblem.test.tsx) | Tone + letter rendering. |
| [tests/components/builder/stat-preview.test.tsx](../../tests/components/builder/stat-preview.test.tsx) | Live-eval read-out. |
| [tests/components/builder/class-preview-modal.test.tsx](../../tests/components/builder/class-preview-modal.test.tsx) | Tab navigation, reset on open, mobile drawer swap. |
| [tests/components/builder/class-step-rail.test.tsx](../../tests/components/builder/class-step-rail.test.tsx) | **~2,400 lines, ~158 `it()` cases** — covers single-class, multiclass, level-up draft flow, picker open/close, mobile branch, HP rolls, prereq lockouts. By far the largest component test in the repo. |
| [tests/components/narrative/use-narrative-editor.test.ts](../../tests/components/narrative/use-narrative-editor.test.ts) | Hook for the narrative tiptap editor. |
| [tests/components/sheet/add-item-panel.test.tsx](../../tests/components/sheet/add-item-panel.test.tsx) | Inventory search / add. |
| [tests/components/sheet/conditions.test.tsx](../../tests/components/sheet/conditions.test.tsx) | Boolean conditions + exhaustion. |
| [tests/components/sheet/hp-tracker.test.tsx](../../tests/components/sheet/hp-tracker.test.tsx) | HP popover + temp HP arithmetic. |
| [tests/components/sheet/inventory-tab.test.tsx](../../tests/components/sheet/inventory-tab.test.tsx) | Tab body composition. |
| [tests/components/sheet/resource-counter.test.tsx](../../tests/components/sheet/resource-counter.test.tsx) | Shared counter primitive. |
| [tests/components/sheet/resources-widget.test.tsx](../../tests/components/sheet/resources-widget.test.tsx) | Recovery grouping + empty-state. |
| [tests/components/sheet/rest-dialog.test.tsx](../../tests/components/sheet/rest-dialog.test.tsx) | Short / long rest dialog wiring. |
| [tests/components/sheet/spells-tab.test.tsx](../../tests/components/sheet/spells-tab.test.tsx) | Spell list + slot tracker. |

## Sheet routes

| Route | File |
| --- | --- |
| `/characters/[id]` | [app/(app)/characters/[id]/page.tsx](../../app/(app)/characters/%5Bid%5D/page.tsx) — server component; loads character + schema + content refs, evaluates effects, renders `CharacterPageClient`. |
| `/characters/[id]/sheet` | [app/characters/[id]/sheet/page.tsx](../../app/characters/%5Bid%5D/sheet/page.tsx) — legacy redirect to `/characters/[id]`. |
| `/characters/[id]/sheet` layout | [app/characters/[id]/sheet/layout.tsx](../../app/characters/%5Bid%5D/sheet/layout.tsx) — minimal `min-h-screen` shell. |

The `CharacterShell` component renders the desktop / mobile `CharacterHeader`, then a tabbed switch between `SheetPanel` (the sacred surface) and `NarrativePanel` (the LegendKeeper-inspired narrative tab from [components/narrative/](../../components/narrative)).

## Cross-cutting prop shapes

These shapes flow between server, builder, and rail components and are the runtime currency of content browsing.

### `ContentEntry`

Defined in [components/builder/content-browser.tsx](../../components/builder/content-browser.tsx):

```ts
interface ContentEntry {
  id: string;
  name: string;
  slug: string;
  content_type: string;          // "race" | "class" | "subclass" | "feature" | "spell" | "item" | "background"
  data: Record<string, unknown>; // type-specific payload (hit_die, levels[], scores[], etc.)
  effects: Effect[];             // engine effects to apply when this is granted
  version: number;
  source: string;                // "srd" | "homebrew"
}
```

Used as the import target almost everywhere: `import type { ContentEntry } from "@/components/builder/content-browser"`.

### `PerLevel` / `PerLevelChoice`

Defined in [lib/builder/class-features-per-level.ts](../../lib/builder/class-features-per-level.ts):

```ts
type ChoiceType = "asi" | "subclass" | "fighting-style" | "generic";

interface PerLevelChoice {
  type: ChoiceType;
  featureSlug?: string;
  classSlug: string;
  label: string;
  isMade: boolean;
}

interface PerLevel {
  level: number;
  features: ContentEntry[];
  choices: PerLevelChoice[];
}
```

`PerLevel[]` is the per-class breakdown the rails render (one pill per level) and the panes consume (one row at a time). Driven by [lib/builder/class-features-per-level.ts](../../lib/builder/class-features-per-level.ts).

### Other recurring shapes

- `CharacterChoices`, `AsiChoice`, `AsiAllocation`, `HpRollRecord` — [lib/types/character.ts](../../lib/types/character.ts).
- `ChoiceEffect`, `GrantEffect`, `MechanicalEffect`, `Effect` — [lib/types/effects.ts](../../lib/types/effects.ts).
- `EvaluationResult` — [lib/engine/evaluator.ts](../../lib/engine/evaluator.ts), the engine output the sheet reads.
- `HpRule` — [lib/builder/level-up-rules.ts](../../lib/builder/level-up-rules.ts).
- `ContentRefWithContent` — [lib/supabase/content-refs.ts](../../lib/supabase/content-refs.ts), the joined-row form of a character's content selections.
- `ClassPrereqResult` — [lib/builder/multiclass-prereqs.ts](../../lib/builder/multiclass-prereqs.ts), `met` / `not-met` / `already-taken`.
- Class tone (`gold` / `purple`) — [lib/builder/class-tone.ts](../../lib/builder/class-tone.ts).
- Mobile detection — [lib/builder/use-is-mobile.ts](../../lib/builder/use-is-mobile.ts) (`(max-width: 767px)`, SSR-safe).

## App shell (top-level)

Outside the four main regions are a small set of cross-cutting shells:

| File | Purpose |
| --- | --- |
| [components/nav/app-nav.tsx](../../components/nav/app-nav.tsx) | Logged-in top bar — Logo, nav links, feedback / admin / user dropdown. |
| [components/nav/nav-link.tsx](../../components/nav/nav-link.tsx) | `usePathname`-aware active-state link. |
| [components/nav/user-dropdown.tsx](../../components/nav/user-dropdown.tsx) | Avatar dropdown — settings, sign out. |
| [components/nav/mobile-nav.tsx](../../components/nav/mobile-nav.tsx) | Mobile hamburger menu. |
| [components/nav/admin-button.tsx](../../components/nav/admin-button.tsx) | Conditional admin link in the nav. |
| [components/theme-provider.tsx](../../components/theme-provider.tsx) | Wraps the app in `next-themes`. |
| [components/landing/](../../components/landing) | Public landing page (Logo / nav / footer). |
| [components/character/](../../components/character) | Page-level shells for the unified character page (`character-shell`, `sheet-panel`, `narrative-panel`, `character-page-client`). |
| [components/narrative/](../../components/narrative) | Backstory + portrait + identity cards / forms — the LegendKeeper-style narrative surface. |
| [components/feedback/](../../components/feedback) | Floating feedback button + dialog used app-wide. |
| [components/editor/](../../components/editor) | Tiptap rich-text editor + renderer + @-mention list. |
| [components/alpha/alpha-banner.tsx](../../components/alpha/alpha-banner.tsx) | Alpha-program banner shown above the app shell. |
| [components/error/error-listeners.tsx](../../components/error/error-listeners.tsx) | Global window error / unhandledrejection capture. |
