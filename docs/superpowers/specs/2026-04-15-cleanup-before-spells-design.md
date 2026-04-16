# Cleanup Pass Before Spell Management Design

**Date:** 2026-04-15
**Status:** Approved
**Scope:** Focused refactor pass to remove accumulated technical debt before adding spell management. Dead code removal, React Context for character sheet state, splitting large components into hooks + sub-components, extracting duplicated logic, and adding component/helper tests. Goal: spell management gets a clean foundation to build on.

---

## Audit Findings

Concrete data from pre-spec audit:

- **506 lines of dead code**: `components/sheet/sheet-client.tsx` (195 lines, zero importers) and `app/(app)/characters/[id]/builder/details/` (311 lines, schema migration `00023_remove_details_step.sql` already removed the step from `creation_steps`)
- **8-prop pass-through** in `ContentTabs` and `MobileSheet` — both forward 8 inventory props unchanged to `InventoryTab`. Mobile path is 4 layers deep.
- **17 `as Record<string, unknown>` casts** — 6 in `character-page-client.tsx` repeating armor detection logic
- **43% test coverage** on `lib/` implementation files; **zero component tests** outside of `tests/components/builder/`
- **3 large files**: `add-item-modal.tsx` (585), `narrative-tab.tsx` (486), `character-page-client.tsx` (329)
- **1 `as any`** at `character-page-client.tsx:130` and **1 unused destructured prop** (`serverEvalResult`)
- **New untested code**: `lib/supabase/inventory.ts` (6 CRUD functions), `lib/sheet/update-state.ts`, `lib/inventory/rarity-colors.ts`

---

## Architecture

### React Context for Character Sheet State

Introduce a single `CharacterContext` that holds all state shared across the unified character page (sheet tab + narrative tab + header). Child components consume state via purpose-specific hooks, never the raw context.

**Context value shape:**

```typescript
interface CharacterContextValue {
  // Identity (read-only)
  character: CharacterWithSystem;
  schema: SystemSchemaDefinition;
  isOwner: boolean;
  isDm: boolean;

  // Play state + updater
  state: CharacterState;
  patchState: (patch: Partial<CharacterState>) => Promise<void>;

  // Evaluation result (re-computes when state/inventory change)
  evalResult: EvaluationResult;

  // Portrait (shared between header and narrative tab)
  portrait: { url?: string; crop?: CropArea | null };
  setPortrait: (updates: { url?: string; crop?: CropArea | null }) => void;

  // Inventory + handlers
  inventory: InventoryItem[];
  currency: Currency;
  addItem: (item: AddItemPayload) => Promise<void>;
  updateItem: (id: string, updates: InventoryUpdate) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  setCurrency: (currency: Currency) => void;
}
```

**Consumer hooks** (purpose-specific slices):

- `useCharacter()` — identity, role flags, evalResult, schema
- `useCharacterState()` — state + patchState
- `useInventory()` — inventory, currency, handlers
- `usePortrait()` — portrait + setPortrait

**Why Context (not Zustand, not prop bundles):**
- State is scoped to one character sheet at a time — no cross-page requirement
- 8 props already threading through 3-4 layers — bundles just delay the problem
- No new dependencies — context handles this scope natively
- Each new feature (spells next) adds one hook, not another prop drill

**Narrative tab stays partially self-contained:**
- Reads/writes the portrait (URL + crop) via context — this is the only field currently shared with the header
- Keeps its own internal edit state (narrative form values, dirty flags, debounced save, Tiptap state, NPCs)
- Different save pattern (debounced server actions via `narrative-actions.ts`) doesn't mix with context's immediate-save pattern
- Character name editing currently happens in the builder details step (deleted in this pass) — not a concern for the narrative tab. Future character name editing from the narrative tab would add `character.name` writes through context.

---

## Deletions

### `components/sheet/sheet-client.tsx` (195 lines)

Superseded by `components/character/character-page-client.tsx` when the unified page was introduced. Zero imports outside itself. Delete the file.

### `app/(app)/characters/[id]/builder/details/` (311 lines)

- `page.tsx` (75 lines)
- `details-step-client.tsx` (236 lines)

Migration `supabase/migrations/00023_remove_details_step.sql` removed the `details` step from `creation_steps` schema. Builder step nav no longer links to this route. Delete the directory.

---

## Extractions

### `lib/inventory/helpers.ts` (new)

Consolidates duplicated patterns from `inventory-tab.tsx`, `character-page-client.tsx`, `actions-tab.tsx`, and `spells-tab.tsx`:

```typescript
/** Merged item data: content_definitions.data + custom_data overrides */
export function getItemData(item: InventoryItem): Record<string, unknown>;

/** Item weight (custom_data override wins over content definition weight) */
export function getItemWeight(item: InventoryItem): number;

/** True if item is a shield (armor_category === "Shield") */
export function isShield(item: InventoryItem): boolean;

/** True if item is body armor (content_type === "armor" and not a shield) */
export function isBodyArmor(item: InventoryItem): boolean;
```

All four are pure functions, easy to test, and remove ~7 `as Record<string, unknown>` casts and 5 duplicate armor-category checks.

### `lib/character/character-context.tsx` (new)

Provider + 4 hooks described above. Contains:
- `CharacterProvider` — wraps the unified page, owns all state and handlers
- `useCharacter()`, `useCharacterState()`, `useInventory()`, `usePortrait()` — consumer hooks
- Internal `useMemo` chains for `equippedArmorEffects`, `derivedState`, and `evalResult`
- Internal handlers: `addItem`, `updateItem` (with armor mutual-exclusion), `removeItem`, `setCurrency`, `setPortrait`, `patchState`

---

## File Splits

### `character-page-client.tsx`: 329 → ~100 lines

**Responsibilities moved to `character-context.tsx`:**
- All `useState` hooks
- All handlers (`handleAddItem`, `handleUpdateItem`, `handleRemoveItem`, `handleCurrencyChange`, `patchState`)
- `equippedArmorEffects` useMemo
- `derivedState` useMemo
- `evalResult` useMemo
- `availableToggles` useMemo

**What remains in `character-page-client.tsx`:**
- Renders `<CharacterProvider>` with initial data from server
- Layout: `<CharacterHeader>` + `<Tabs>` with `<SheetPanel>` and `<NarrativePanel>` as children

### `sheet-panel.tsx` (new, ~120 lines)

Extracts the desktop 3-column layout (stat ribbon, left column, center column, right column) and mobile layout dispatcher. Reads from `useCharacter()`, `useCharacterState()`, `useInventory()`. No props.

### `narrative-panel.tsx` (new, ~20 lines)

Thin wrapper around `NarrativeTab` with padding/max-width. Reads `character`, `isOwner`, `isDm` from `useCharacter()`.

### `narrative-tab.tsx`: 486 → ~180 lines

**Hook extraction: `components/narrative/use-narrative-editor.ts`** (new, ~180 lines)
- Owns: 11 useState, 7 useRef, debounced save timer, 10 handlers
- Returns: `{values, dirty, saveStatus, handlers: {...}, manualSave, cancelEdits}`
- Consumed by the rewritten narrative-tab

**`narrative-tab.tsx` rewrite (~180 lines):**
- Top-level component managing edit/view mode toggle
- Delegates to `<NarrativeView>` or `<NarrativeEdit>` based on mode
- Pulls portrait from `usePortrait()` (not props)

**`narrative-view.tsx` (new, ~150 lines):**
- All the view-mode cards (Core Identity, Personality, Distinguishing Features, Backstory cards, DM notes, Fun Traits)
- Pure rendering — no state

**`narrative-edit.tsx` (new, ~150 lines):**
- All the edit-mode forms
- Consumes the hook's handlers
- Pure rendering — no state

### `add-item-modal.tsx`: 585 → ~250 lines, renamed to `add-item-panel.tsx`

File rename fixes the "modal" misnomer (it's an inline panel). Plus extractions:

**`item-detail-card.tsx`** (new, ~180 lines) — the expanded item detail view with damage/AC/weight/cost/properties/description/source/quantity selector

**`custom-item-form.tsx`** (new, ~80 lines) — name, type, weight, description form for custom items

**`item-filters.tsx`** (new, ~80 lines) — filter pills + "Magical" checkbox

**`add-item-panel.tsx` rewrite (~250 lines):**
- Main panel shell with search, compositing the extracted filter/detail/custom-form components
- Handles search debouncing and results pagination

---

## TypeScript Tightening

1. **Remove `as any` at `character-page-client.tsx:130`** — replaced with proper `ArmorData` type from `lib/schemas/content-types/armor.ts`
2. **Remove unused `evalResult: serverEvalResult` destructured param** at `character-page-client.tsx:51`
3. **Replace remaining `as Record<string, unknown>` casts** in `character-page-client.tsx` (6 → 0) — now use `getItemData()` and `isShield()` helpers
4. **Leave legitimate casts** alone (e.g., `InventoryItem.custom_data` is inherently `Record<string, unknown> | null` — that's the right type)

---

## Tests

### New test files (engine + helpers)

- **`tests/inventory/helpers.test.ts`** — `getItemData` (merges content + custom_data), `getItemWeight` (custom wins over definition), `isShield` (detects shield category), `isBodyArmor` (armor content_type, not shield)
- **`tests/inventory/rarity-colors.test.ts`** — `rarityTextClass` returns correct class for all 6 rarities, handles null/undefined/unknown rarity
- **`tests/sheet/update-state.test.ts`** — `updateCharacterState` correctly merges state patches into existing state
- **`tests/supabase/inventory.test.ts`** — mocked Supabase client; verifies query shape for `getInventoryForCharacter`, `addInventoryItem`, `updateInventoryItem`, `removeInventoryItem`, `searchItems`, `unequipAllArmor`. Not integration tests — asserts the Supabase calls made, not database results.

### New test files (components)

- **`tests/components/sheet/inventory-tab.test.tsx`** — renders inventory sections with mock data, equip toggle fires expected handler, attunement cap blocks 4th attunement, remove button fires remove handler
- **`tests/components/sheet/add-item-panel.test.tsx`** — search input debounces (fake timers), filter pills toggle on/off, custom item form submits with correct payload
- **`tests/components/narrative/use-narrative-editor.test.ts`** — dirty flag tracking, debounced save fires after 500ms timeout, cancel edits reverts form values

### Testing approach

- **Mock Supabase** via `vi.mock("@/lib/supabase/client")` returning a chainable mock — verify `.from().insert()`, `.from().update()`, etc. were called with expected arguments
- **Mock context** for component tests via a test-only `<CharacterProvider>` wrapper accepting override values
- **React Testing Library** for component tests (already in project)
- **Skip**: full integration tests, `sandbox.ts` (not used yet), `storage.ts` (tied to Supabase Storage — covered by manual flow)

### Target coverage

- 100% coverage on new helpers (`lib/inventory/helpers.ts`, `rarity-colors.ts`)
- Smoke coverage on key components (at least one test per major user interaction)
- ~20 new tests bringing total from 143 to ~163

---

## Files Changed Summary

| File | Action | Notes |
|------|--------|-------|
| `components/sheet/sheet-client.tsx` | **Delete** | 195 lines, zero importers |
| `app/(app)/characters/[id]/builder/details/` | **Delete** | 311 lines, schema already removed step |
| `lib/character/character-context.tsx` | **Create** | Provider + 4 hooks |
| `lib/inventory/helpers.ts` | **Create** | getItemData, getItemWeight, isShield, isBodyArmor |
| `components/character/character-page-client.tsx` | **Rewrite** | ~100 lines |
| `components/character/sheet-panel.tsx` | **Create** | Desktop/mobile layout, ~120 lines |
| `components/character/narrative-panel.tsx` | **Create** | ~20 lines |
| `components/narrative/use-narrative-editor.ts` | **Create** | Extracted hook, ~180 lines |
| `components/narrative/narrative-tab.tsx` | **Rewrite** | ~180 lines |
| `components/narrative/narrative-view.tsx` | **Create** | View mode, ~150 lines |
| `components/narrative/narrative-edit.tsx` | **Create** | Edit mode, ~150 lines |
| `components/sheet/inventory/add-item-panel.tsx` | **Rename + rewrite** | From add-item-modal.tsx, ~250 lines |
| `components/sheet/inventory/item-detail-card.tsx` | **Extract** | ~180 lines |
| `components/sheet/inventory/custom-item-form.tsx` | **Extract** | ~80 lines |
| `components/sheet/inventory/item-filters.tsx` | **Extract** | ~80 lines |
| `components/sheet/content-tabs.tsx` | **Modify** | Remove 8 pass-through props, consume context |
| `components/sheet/mobile-sheet.tsx` | **Modify** | Same — remove inventory prop drilling |
| `components/sheet/tabs/inventory-tab.tsx` | **Modify** | Props → useInventory() |
| `components/sheet/tabs/actions-tab.tsx` | **Modify** | Props → context hooks |
| `components/sheet/tabs/spells-tab.tsx` | **Modify** | Remove `content_definitions?.data ?? {}` cast — use getItemData helper pattern |
| `app/(app)/characters/[id]/page.tsx` | **Modify** | Pass initial data to CharacterProvider instead of prop-drilling to CharacterPageClient |
| `tests/inventory/helpers.test.ts` | **Create** | Helper tests |
| `tests/inventory/rarity-colors.test.ts` | **Create** | Rarity color tests |
| `tests/sheet/update-state.test.ts` | **Create** | State merge tests |
| `tests/supabase/inventory.test.ts` | **Create** | Mocked CRUD tests |
| `tests/components/sheet/inventory-tab.test.tsx` | **Create** | Inventory component smoke tests |
| `tests/components/sheet/add-item-panel.test.tsx` | **Create** | Add-item panel smoke tests |
| `tests/components/narrative/use-narrative-editor.test.ts` | **Create** | Narrative editor hook tests |

---

## Verification

1. **Tests**: `npx vitest run` — all tests pass (143 existing + ~20 new = ~163)
2. **Build**: `npm run build` — clean build, no type errors
3. **Manual smoke test** on dev server:
   - Open character → sheet tab renders correctly (AC, speed, saves, skills)
   - Navigate to narrative tab → edit name → save → header updates instantly
   - Upload portrait from narrative → header avatar updates without refresh
   - Add item from inventory → appears in correct section
   - Equip armor → AC updates immediately
   - Equip shield → AC updates with +2
   - Attune magic item → counter updates, effects apply
   - Mobile viewport → all layouts work
4. **Line count check**: `add-item-panel.tsx` under 300, `character-page-client.tsx` under 150, `narrative-tab.tsx` under 200
5. **Cast count check**: `as any` = 0, `as Record<string, unknown>` reduced from 17 to <10 (legitimate remaining cases only)
6. **Dead code check**: `components/sheet/sheet-client.tsx` and `app/(app)/characters/[id]/builder/details/` no longer exist

---

## Out of Scope (Deferred)

- Database schema changes — none needed
- Evaluator refactoring — architecture is good
- Builder refactoring — separate scope
- Spell management — explicitly the next feature, not this pass
- State management library migration — context handles current scope
- Full integration tests — mocked tests provide enough confidence for this pass
- `sandbox.ts` tests — feature not in use yet
- `storage.ts` tests — covered by manual portrait upload flow
