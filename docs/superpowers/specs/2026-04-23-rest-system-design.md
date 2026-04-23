# Rest System Design

**Date:** 2026-04-23
**Status:** Approved
**Scope:** Second of three foundation phases preceding Spell Management Phase 2. Delivers short/long rest orchestration covering: Warlock pact slots, all spell slots, HP to max, death saves reset, exhaustion tracking, concentration break, and feature resources reset. Additionally redesigns the Conditions widget (dropdown picker + applied-only pills + Exhaustion as a leveled pill) and hides Death Saves until `current_hp === 0`. Does **not** build dice rolling, HD tracking, or HD spend-to-heal — those are explicitly deferred to the Dice Rolling foundation phase. Also does not build class-specific refreshes beyond what's covered by Feature Resources.

---

## Audit Findings

- **CharacterState has all prerequisites except two:**
  - `current_hp`, `temp_hp`, `death_saves`, `spell_slots_used`, `concentrating_on`, `feature_uses` exist ✓
  - `exhaustion` missing — needs to be added
  - `hit_dice_spent` — **intentionally NOT added this phase** (HD spend deferred to Dice Rolling phase)
- **No rest logic or UI exists today** — zero buttons, zero dialogs, zero orchestration
- **`maxHp` is computed via the engine** and accessible through `useCharacter()` — long rest can use it directly
- **`useResources()` hook** (from Feature Resources phase) exposes `setUsed(slug, newUsed)` — long rest uses this to bulk-reset resources
- **Spell slots** use shared `spell_slots_used: SpellSlotsUsed` state keyed by level + "pact" for Warlock — both rest types can target specific keys

**Out of scope for this phase:**
- Hit Dice tracking (state, UI, spend-to-heal). Deferred to Dice Rolling phase where we can roll real dice + compute HP heal properly. Adding read-only HD display now would be purely decorative without any interactive value.
- Class-specific refreshes outside Feature Resources (e.g., Paladin Cleansing Touch per long rest is tracked via `usages`/`recovery` on the feature — already handled)
- RAW enforcement of "one long rest per 24 hours" (DM discretion)
- Undo / accidental-rest reversal (user can manually edit state if needed)

---

## Data Model

### Character state additions (`lib/types/character.ts`)

Add one new optional field to `CharacterState`:

```ts
/** Current exhaustion level (RAW 0-6). Incremented by DM/triggers; decremented by 1 on long rest. */
exhaustion?: number;
```

**Nothing else changes.** `hit_dice_spent` and HD-related state are explicitly deferred.

### Rest effects (pure computation)

Rest orchestration is expressed as pure functions that produce a `CharacterState` patch plus a per-resource-slug reset map. The context hook calls these, then writes via `patchState` + `useResources().setUsed`.

```ts
// lib/rest/helpers.ts

export interface ShortRestEffects {
  slotPatch: Partial<CharacterState["spell_slots_used"]>;  // keys to zero out
  resourceResets: string[];  // feature_uses slugs to zero out
}

export interface LongRestEffects {
  statePatch: Partial<CharacterState>;  // current_hp, temp_hp, death_saves, exhaustion, concentrating_on, spell_slots_used
  resourceResets: string[];  // feature_uses slugs to zero out
}

export function computeShortRestEffects(
  hasPactSlots: boolean,
  resources: FeatureResource[],
): ShortRestEffects;

export function computeLongRestEffects(
  maxHp: number,
  currentExhaustion: number,
  slotUsageKeys: string[],  // all current keys of spell_slots_used
  resources: FeatureResource[],
): LongRestEffects;
```

These helpers know nothing about React or DB — they take inputs and return a patch shape. Rest execution wires them up in the context hook.

### Short rest semantics

Applies:
- `spell_slots_used.pact = 0` (if Warlock — i.e., pact key exists in current state)
- `feature_uses[slug] = 0` for every resource where `recovery === "short"`

Does **not** touch:
- Regular spell slots (leveled 1-9)
- HP, temp HP, death saves
- Exhaustion
- Concentration
- Long-rest resources

**"Nothing happens" case:** if the character has no pact slots and no short-rest resources, the Take Short Rest button is disabled with a tooltip explaining why.

### Long rest semantics

Applies:
- `current_hp = maxHp`
- `temp_hp = 0`
- `death_saves = { successes: 0, failures: 0 }`
- `exhaustion = max(0, (exhaustion ?? 0) - 1)` (assumes food + water available; DM adjudicates otherwise)
- `concentrating_on = null` (long rest breaks concentration — RAW: concentration breaks after 1 hour without active casting anyway)
- All `spell_slots_used` entries → 0 (includes pact)
- `feature_uses[slug] = 0` for every resource with `recovery === "short"` OR `"long"`

Does **not** touch:
- HD (deferred phase)
- Conditions (other than exhaustion — handled as a stepper in the Conditions widget)
- Currency, inventory, equipment, portrait, notes, etc.

---

## UI

### 1. `RestButton` — stat ribbon trigger

New component `components/sheet/rest-button.tsx` inserted at the right end of the stat ribbon (`components/sheet/stat-ribbon.tsx`) after `HPTracker`.

```
[STR 16] [DEX 14] ... | AC 18 | Init +2 | Speed 30 | Prof +3 | HP 18/50 | [☾☀ Rest]
```

Icon + label ("Rest"). Clicking opens the `RestDialog`.

Mobile: stat ribbon is already horizontally-scrollable — button appears at the end.

### 2. `RestDialog` — two-pane layout

New component `components/sheet/rest-dialog.tsx`. Uses the existing `Dialog` primitive (or equivalent; check `components/ui/` for the convention).

Layout: side-by-side panes on desktop, stacked on mobile.

```
╭────────────── Rest ──────────────────────────────────╮
│                                                       │
│  ☾ Short Rest          ☀ Long Rest                    │
│  ──────────            ─────────                      │
│  • Warlock pact slots  • Restore all spell slots      │
│    restored              • 1st: 4/4                   │
│  • Reset short-rest      • 2nd: 2/2                   │
│    resources:            • Pact: 2/2                  │
│    - Ki                • Restore HP: 18 → 50          │
│    - Channel Div.      • Clear death saves (2 → 0)    │
│                        • Exhaustion 1 → 0             │
│                        • Reset long-rest resources:   │
│                          - Rage                       │
│                          - Lay on Hands               │
│                        • Break concentration          │
│                                                       │
│  [ Take Short Rest ]   [ Take Long Rest ]             │
╰───────────────────────────────────────────────────────╯
```

**Pane behaviour:**
- Each pane renders only bullet points relevant to the current character state.
- If nothing would happen on short rest (e.g., Rogue, no Warlock slots, no short-rest resources), the short-rest button is disabled with tooltip "You don't have any short-rest recovery — short rests only restore Warlock pact slots and short-rest features."
- If nothing would happen on long rest (theoretical edge case — max HP already, no slots used, no resources spent, no exhaustion, no death saves, no concentration), the long-rest button is disabled with tooltip "Fully rested."

**Execution:** Clicking "Take X Rest" executes the rest immediately and closes the dialog. No separate confirmation step — the preview IS the confirmation. Dialog dismisses via X button or Esc or clicking outside.

**No success toast** in this phase — the sheet updates visibly (HP bar, slot tracker, widget counters) and that's sufficient feedback. Toast/log integration can come with the Activity Log phase.

### 3. Conditions widget redesign + Exhaustion integration

**Current state:** `components/sheet/conditions.tsx` renders all 15 conditions as a flat grid of toggle pills — including "Exhaustion" as a binary toggle (incorrect per RAW, which treats Exhaustion as level 1–6). The grid always takes ~6 rows of vertical space even when the character has zero conditions.

**Redesign to dropdown-picker pattern:**

```
╭─ CONDITIONS ─────────────────────────────────╮
│                                               │
│  [Poisoned ×]  [Exhaustion 2/6  −  +]        │
│                                               │
│  [+ Add Condition ▼]                          │
╰───────────────────────────────────────────────╯
```

Empty state:
```
╭─ CONDITIONS ─────────────────────────────────╮
│  No active conditions                         │
│  [+ Add Condition ▼]                          │
╰───────────────────────────────────────────────╯
```

**Behavior:**
- Applied conditions render as pills at the top of the widget. Clicking the `×` removes it.
- Below the pills: a small `[+ Add Condition]` button that opens a popover listing only conditions NOT currently applied. Click one to add.
- **Exhaustion is special-cased in two places:**
  1. In the popover, clicking "Exhaustion" adds it with `level = 1`
  2. When applied, the pill renders with an inline stepper: `Exhaustion 2/6 [−][+]` — clicking `[−]` at level 1 removes it (sets `exhaustion = 0`, which is interpreted as "not applied")
- When `exhaustion >= 5`, the pill gets warning styling (amber or destructive color) to surface the severity.
- Tooltip on the Exhaustion pill's label summarizes RAW levels (disadv on checks at 1, speed halved at 2, disadv on attacks + saves at 3, HP max halved at 4, speed 0 at 5, death at 6).

**State model:**
- Boolean conditions remain in `state.conditions: string[]` (existing)
- Exhaustion lives separately as `state.exhaustion: number` (new this phase)
- The widget considers Exhaustion "applied" when `exhaustion > 0`; absent when `exhaustion === 0 | undefined`

**Benefits:** Widget shrinks dramatically for characters with zero conditions (which is most of the time). Exhaustion gets proper level tracking without a separate widget. Discoverability of the 14 other conditions preserved through the picker.

### 4. Death Saves visibility

**Currently** `<DeathSaves>` always renders in the left column. **Change: only render when `current_hp === 0`.**

Additionally, **auto-reset saves when HP transitions from 0 to > 0.** Implementation: modify the HP tracker (or the `patchState` wrapper call-site) so any patch that sets `current_hp > 0` while the prior value was `0` AND `death_saves` has non-zero values also clears `death_saves` in the same patch. This matches RAW: healing at 0 HP resets death saves.

Edge case: a DM might edit saves directly (e.g., for roleplay). The auto-reset only fires on the `0 → >0` HP transition, not on direct save edits, so direct editing still works.

### 5. No HD display

Per the scope decision: HD state is not tracked this phase, so no HP tracker sub-row, no widget. The Dice Rolling phase will add HD tracking, display, spend-to-heal, and long-rest HD restoration together.

---

## Context Integration

Extend `lib/character/character-context.tsx` with a new hook:

```ts
export function useRest(): {
  exhaustion: number;
  shortRest: () => void;
  longRest: () => void;
  setExhaustion: (level: number) => void;
  /** Returns whether either rest type would have any visible effect for the current character. */
  canShortRest: boolean;
  canLongRest: boolean;
};
```

The hook:
- Reads `character`, `state`, `maxHp`, `resources` from the CharacterContext
- Calls pure helpers to compute the patch shape
- Applies via existing `patchState` (which now uses the atomic `patch_character_state` RPC)
- For resource resets, loops and calls `useResources().setUsed(slug, 0)` for each
- `setExhaustion(level)` clamps to [0, 6]; `level === 6` is a death trigger but Rest System doesn't enforce death handling (separate concern — character just shows level 6)

### Rest execution: single atomic patch

Because `feature_uses` is a top-level state field and the `patch_character_state` RPC does shallow merge on top-level keys, all rest state changes — HP, death saves, exhaustion, concentration, slots, feature_uses — can be batched into a single `patchState` call:

```ts
patchState({
  current_hp: maxHp,
  temp_hp: 0,
  death_saves: { successes: 0, failures: 0 },
  exhaustion: Math.max(0, exhaustion - 1),
  concentrating_on: null,
  spell_slots_used: {},  // all keys zeroed out — shallow merge replaces wholesale
  feature_uses: { ...existingUses, [slug1]: 0, [slug2]: 0, ... },
});
```

One RPC call, atomic. `useResources().setUsed` is for single-resource updates driven by UI; `useRest()` bulk-resets directly via `patchState` for efficiency.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `lib/types/character.ts` | Modify | Add `exhaustion?: number` to `CharacterState` |
| `lib/rest/helpers.ts` | Create | `computeShortRestEffects`, `computeLongRestEffects` — pure functions |
| `lib/character/character-context.tsx` | Modify | Add `useRest()` hook |
| `components/sheet/rest-button.tsx` | Create | Stat-ribbon trigger button |
| `components/sheet/rest-dialog.tsx` | Create | Two-pane short/long dialog with execution buttons |
| `components/sheet/stat-ribbon.tsx` | Modify | Insert `<RestButton />` after HP tracker |
| `components/sheet/conditions.tsx` | Rewrite | Dropdown-picker pattern; applied-only pills; exhaustion stepper pill |
| `components/sheet/hp-tracker.tsx` | Modify | Auto-reset death saves on 0→>0 HP transition |
| `components/character/sheet-panel.tsx` | Modify | Conditional render of `<DeathSaves>` only when `current_hp === 0` |
| `components/sheet/mobile-sheet.tsx` | Modify | Mirror Rest button + DeathSaves visibility rule |
| `tests/rest/helpers.test.ts` | Create | Pure-logic tests for both effect computations |
| `tests/components/sheet/rest-dialog.test.tsx` | Create | Dialog render + execution tests |
| `tests/components/sheet/conditions.test.tsx` | Create | Redesigned picker + exhaustion stepper behavior |

No DB migration needed — state change is additive JSONB.

---

## Verification Criteria (13)

**Rest:**
1. **Rest button visible** in stat ribbon on desktop and mobile; icon + label readable
2. **Dialog opens** showing two panes (Short Rest / Long Rest)
3. **Short Rest pane** accurately previews effects based on character class and current state; disabled with tooltip if nothing would happen
4. **Short Rest executes** — Warlock pact slots set to 0, short-rest feature_uses cleared, regular slots/HP/death saves/exhaustion unchanged
5. **Long Rest pane** accurately previews current → target values for HP, slots, death saves, exhaustion, resources
6. **Long Rest executes** — single atomic patch; all fields updated correctly
7. **Concentration breaks** on long rest (concentrating_on becomes null)

**Conditions redesign:**
8. **Empty state** — Conditions widget shows "No active conditions" + Add button only when no conditions applied
9. **Add flow** — clicking Add Condition opens a popover listing only unapplied conditions; clicking one adds it as a pill
10. **Exhaustion** — applying Exhaustion from the picker sets level = 1; pill shows `Exhaustion L/6` with functioning `[−]`/`[+]` stepper; `[−]` at level 1 removes it
11. **Warning styling** at exhaustion level 5+

**Death Saves:**
12. **Hidden** when `current_hp > 0`; **visible** when `current_hp === 0`
13. **Auto-reset** on 0 → >0 HP transition — previously non-zero death saves clear in the same patchState call

**Scope discipline:**
14. **No HD UI or HD logic** shipped — confirms the Dice Rolling phase carries HD

---

## Testing Strategy

**Unit (`tests/rest/helpers.test.ts`)**:
- `computeShortRestEffects` with no pact, no resources → empty patch
- `computeShortRestEffects` with pact only → sets pact slot
- `computeShortRestEffects` with short-rest resources → includes those slugs
- `computeShortRestEffects` ignores long-rest resources
- `computeLongRestEffects` sets HP to max, clears death saves, decrements exhaustion
- `computeLongRestEffects` clears all slot keys (including pact)
- `computeLongRestEffects` includes both short + long recovery resources in reset list
- `computeLongRestEffects` clamps exhaustion at 0 (doesn't go negative)
- `computeLongRestEffects` sets concentrating_on to null

**Component (`tests/components/sheet/rest-dialog.test.tsx`)**:
- Dialog renders two panes
- Short Rest button disabled when canShortRest=false
- Long Rest button disabled when canLongRest=false
- Clicking Short Rest calls `shortRest()` and closes dialog
- Clicking Long Rest calls `longRest()` and closes dialog

**Component (`tests/components/sheet/conditions.test.tsx`)**:
- Empty state renders when conditions=[] and exhaustion=0
- Applied condition pill renders with × remove button
- Clicking Add Condition opens popover listing only unapplied conditions (applied ones filtered out)
- Exhaustion popover click sets exhaustion = 1
- Exhaustion pill shows level + stepper; `[+]` increments; `[−]` at level > 1 decrements; `[−]` at level 1 removes (sets to 0)
- Warning styling class applied at exhaustion >= 5
- Preview text includes accurate before/after values

**Smoke (manual)**:
- Warlock L3: short rest restores pact slots
- Monk L5 with Ki spent: short rest restores Ki
- Barbarian L5 with Rage spent + damage taken: long rest restores all
- Rogue L3 with no short-rest features: Short Rest button disabled
- Full HP, no damage, no spent resources: Long Rest button disabled (and explains why)

---

## Follow-Up Phases

**Foundation Phase 3 — Dice Rolling** (next):
- HD tracking state (`hit_dice_spent: Record<string, number>`)
- HD display on HP tracker (or dedicated widget)
- HD spend-to-heal flow (inside a short rest or standalone)
- Long rest HD restoration (half total, min 1)
- Cross-cutting roll engine + roll log

**Spell Phase 2** — uses `useRest()` hooks for slot restoration in the casting dialog's test flow. The atomic patch approach used here also applies to slot-consumption logic.

**Collaborative sync (Phase 2.5 backlog)** — when multiple tabs / players view the same character, resource resets in one surface don't auto-update another. Needs realtime subscription pattern. Not blocking.
