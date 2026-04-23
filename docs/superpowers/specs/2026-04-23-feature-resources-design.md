# Feature Resources Design

**Date:** 2026-04-23
**Status:** Approved
**Scope:** First of three foundation systems preceding Spell Management Phase 2. Delivers runtime tracking + UI for class feature usage counters (Rage, Ki, Channel Divinity, Bardic Inspiration, Lay on Hands, Action Surge, Second Wind, Superiority Dice, Sorcery Points, Wild Shape uses, and any homebrew feature authored with `usages` + `recovery`). Does **not** build the Rest system itself — that is the next foundation phase and consumes this one's recovery metadata. Does **not** build dice rolling, spell casting flow, or class-specific spell advanced features — those are later phases.

---

## Audit Findings

- **Feature schema already supports usage tracking** (`lib/schemas/content-types/feature.ts`):
  - `usages: number | number[20]` — fixed count or per-level array
  - `recovery: "short rest" | "long rest" | "dawn" | "day"`
  - `extraLimitedFeatures: Array<{ name, usages, recovery }>` — for features with secondary pools
- **Recovery enum defined** in `lib/schemas/content-types/mechanical.ts` (`RECOVERY_TYPES`)
- **No runtime consumes these fields** — no state, no UI, no counter logic
- **Only existing resource-adjacent state** is `rage_active: boolean` (a toggle, not a counter)
- **Features tab** (`components/sheet/tabs/features-tab.tsx`) renders feature descriptions but has no counter widget
- **Sheet left column** already hosts similar compact widgets: Defenses, Conditions, DeathSaves, Proficiencies, QuickNotes

**Out of scope for this phase:**
- Rest dialog UI and orchestration (next foundation phase)
- Formula-based max values (e.g., Bardic Inspiration = CHA mod) — addressed via future schema extension (`usagesFormula: string`) if needed; initial data can be enriched with a per-level array as a workaround
- Class features without `usages` data in current content (they render as non-interactive cards as today)
- Dice rolling integration for spend actions

---

## Data Model

### Character state extension (`lib/types/character.ts`)

Add to `CharacterState`:

```ts
feature_uses?: Record<string, number>  // key: feature slug (or compound), value: uses spent
```

Follows the same pattern as `spell_slots_used` from Phase 1: **spent is tracked, max is computed.** On read we clamp to `[0, max]` so stale state (e.g., level loss shrinks max) self-heals.

**Key format:**
- Primary feature: `feature.slug` (e.g., `rage`)
- `extraLimitedFeatures` sub-resource: `${feature.slug}.${extra.name.toLowerCase().replace(/\s+/g, '_')}` (e.g., `wild_shape.rampage`)

### Recovery mapping

| Schema value | Maps to |
|---|---|
| `"short rest"` | Reset on short rest |
| `"long rest"` | Reset on long rest |
| `"dawn"` | Reset on long rest (documented compromise for MVP; dawn is typically racial and close enough) |
| `"day"` | Reset on long rest (rare — treated same as long) |

Normalization lives in `lib/resources/helpers.ts` → `normalizeRecovery(recovery) → "short" | "long"`.

### Engine integration (`lib/engine/evaluator.ts`)

Extend `evalResult` with a new field:

```ts
resources: FeatureResource[]
```

Where:

```ts
interface FeatureResource {
  slug: string;              // key in feature_uses map
  name: string;              // display name (e.g., "Rage")
  max: number;               // computed from usages at character level
  recovery: "short" | "long";
  sourceLabel: string;       // display hint, e.g., "Barbarian 1"
  sourceFeatureSlug: string; // parent feature slug (same as slug for primary, different for extras)
}
```

**Max computation:**
- If `usages` is `number` → use as-is
- If `usages` is `number[20]` → index `[characterLevel - 1]`, clamp to ≥0, treat `null` entries as 0
- For extras: each `extraLimitedFeatures` entry becomes its own `FeatureResource` with its own `usages` field

**Inclusion criteria:** A feature contributes a resource when `usages > 0` AND `recovery` is non-null. Passive features (no usages) render as non-interactive cards in the Features tab as today.

---

## UI

### 1. `ResourcesWidget` (new, left column)

New panel component `components/sheet/resources-widget.tsx`. Inserted in `sheet-panel.tsx` left column between `Defenses` and `Conditions`.

Hidden entirely when `resources.length === 0`.

**Layout:**

```
┌─ Resources ──────────────────────┐
│ ☾ Short Rest                     │
│   Ki              4/6  [−] [+]   │
│   Channel Div.    1/2  [−] [+]   │
│ ☀ Long Rest                      │
│   Rage            2/3  [−] [+]   │
│   Lay on Hands   15/25 [−] [+]   │
└──────────────────────────────────┘
```

- Grouped by recovery, short-rest section first (recharges more often → more relevant in play)
- Subheader row uses muted text + icon (lucide `Moon` for short, `Sun` for long)
- Sorted alphabetically within each group
- Exhausted resources (used === max) shown with `opacity-60`; buttons still work

### 2. `ResourceCounter` (reusable)

Shared component `components/sheet/resource-counter.tsx` used by both the widget and the Features tab cards.

```tsx
<ResourceCounter resource={resource} used={used} onChange={(newUsed) => ...} />
```

Renders:
- Label (resource name)
- `{max - used}/{max}` display (remaining out of total)
- `[−]` button: clamped at 0 remaining (i.e., used === max); calls `onChange(used + 1)`
- `[+]` button: clamped at max remaining (used === 0); calls `onChange(used - 1)`

Variants via prop:
- `layout="widget"` — compact row (used in left-column widget)
- `layout="card"` — slightly roomier, includes recovery badge (used inline in features tab cards)

### 3. Features tab inline counter

`components/sheet/tabs/features-tab.tsx` modified: for each feature card where `resources` includes a matching slug, render a `<ResourceCounter layout="card" />` beneath the description.

For `extraLimitedFeatures`, render one counter per sub-resource (e.g., Wild Shape card shows a "Wild Shape Uses" counter; a Druid with Circle of the Moon extra gets additional counters).

### 4. Mobile

`MobileSheet` already mirrors the desktop left column in its Combat view. Adding the widget to the left-column slot automatically picks it up on mobile — no separate mobile layout needed.

---

## Context Integration

Extend `CharacterContext` in `lib/character/character-context.tsx`:

```ts
// New hook
export function useResources(): {
  resources: FeatureResource[];         // from evalResult.resources
  uses: Record<string, number>;         // current feature_uses state
  spend: (slug: string, amount?: number) => Promise<void>;  // default 1
  restore: (slug: string, amount?: number) => Promise<void>;  // default 1
  setUsed: (slug: string, newUsed: number) => Promise<void>;  // absolute set (used by Rest later)
}
```

- `spend(slug, 1)` = increment `feature_uses[slug]` by 1, clamped to `max`
- `restore(slug, 1)` = decrement `feature_uses[slug]` by 1, clamped to 0
- `setUsed(slug, n)` = absolute set (used by Rest phase to zero-out on recovery)

All three persist via existing `patchState` pipeline (debounced save pattern already used by Phase 1 spell state).

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `lib/types/resources.ts` | Create | `FeatureResource`, `ResourceRecovery` types |
| `lib/types/character.ts` | Modify | Add `feature_uses?: Record<string, number>` to `CharacterState` |
| `lib/resources/helpers.ts` | Create | `computeResources(character, evalResult)`, `getMaxUses`, `normalizeRecovery`, `groupByRecovery`, `getResourcesByRecovery` |
| `lib/engine/evaluator.ts` | Modify | Produce `resources: FeatureResource[]` alongside existing grants/effects |
| `lib/character/character-context.tsx` | Modify | Add `useResources()` hook |
| `components/sheet/resource-counter.tsx` | Create | Reusable counter with widget/card variants |
| `components/sheet/resources-widget.tsx` | Create | Left-column grouped widget |
| `components/character/sheet-panel.tsx` | Modify | Insert `<ResourcesWidget />` between `<Defenses />` and `<Conditions />` |
| `components/sheet/tabs/features-tab.tsx` | Modify | Render inline counter on cards with matching resources |
| `tests/resources/helpers.test.ts` | Create | Max computation, recovery normalization, grouping, per-level array resolution, extraLimitedFeatures handling |
| `tests/components/sheet/resource-counter.test.tsx` | Create | Spend/restore/clamp behavior |
| `tests/components/sheet/resources-widget.test.tsx` | Create | Grouping, empty state hide, exhausted dim styling |

No DB migration required — state extension is an additive JSONB field change.

---

## Verification Criteria

1. **Barbarian L1 character** sees a Resources widget with "Rage 2/2" in the Long Rest group
2. **Monk L5 character** sees "Ki 5/5" in the Short Rest group
3. **Cleric L2 character** sees "Channel Divinity 1/1" in the Short Rest group
4. **Multiclass Fighter 2 / Wizard 3** sees "Action Surge 1/1" and "Second Wind 1/1" both in Short Rest group
5. **Non-resource character** (e.g., L1 Rogue with only passive features) does NOT render the Resources widget
6. **Paladin L5 Lay on Hands** shows "Lay on Hands 25/25" (pool with large max)
7. `[−]` on "Rage 2/2" → "Rage 1/2", persisted across reload
8. `[−]` on "Rage 0/2" → stays at 0/2 (clamped)
9. `[+]` on "Rage 2/2" → stays at 2/2 (clamped)
10. Features tab card for "Rage" shows an inline counter matching the widget's value
11. Widget hidden on character with no class features with `usages`
12. `dawn` and `day` recovery features appear in Long Rest group
13. `extraLimitedFeatures` on Wild Shape produces separate counter(s) on the Wild Shape card
14. Engine `resources` array is deterministic: same character input → same resource list
15. State persists across page reload (server-hydrated via existing `patchState` pipeline)

---

## Testing Strategy

**Unit (`tests/resources/helpers.test.ts`):**
- `getMaxUses` with fixed number
- `getMaxUses` with per-level array (picks correct index)
- `getMaxUses` with per-level array and null entries (returns 0)
- `normalizeRecovery` maps dawn/day → long
- `computeResources` builds list from synthetic feature data
- `computeResources` includes `extraLimitedFeatures` as separate entries
- `computeResources` excludes features with `usages === 0` or null `recovery`
- `groupByRecovery` splits and sorts alphabetically

**Component (`tests/components/sheet/resource-counter.test.tsx`):**
- Renders label + counter + buttons
- Clicks `[−]` calls onChange with used+1
- Clicks `[+]` calls onChange with used-1
- `[−]` disabled visually when used === max
- `[+]` disabled visually when used === 0

**Component (`tests/components/sheet/resources-widget.test.tsx`):**
- Renders grouped sections when resources exist
- Returns null when empty
- Exhausted resources have dimmed styling

**Smoke:**
- Barbarian L1 character fixture shows Rage counter
- Rogue L1 fixture hides widget
- Multiclass Fighter/Cleric shows Action Surge + Channel Divinity in correct groups

---

## Follow-Up Phases

**Foundation Phase 2 — Rest System** (next):
- Dedicated Rest dialog (short / long)
- Calls `useResources().setUsed(slug, 0)` for every resource matching `normalizeRecovery(recovery) === restType`
- Also resets: spell slots (including Warlock pact on short), HP to max (long), HD restored (long), death saves (long), exhaustion −1 (long)

**Foundation Phase 3 — Dice Rolling** (after Rest):
- Cross-cutting roll engine + log
- Resource spend actions may optionally link to a roll (e.g., Bardic Inspiration spend → offer to roll the inspiration die)

**Spell Phase 2 — Casting + Slots + Rests:** Uses Rest system for slot restoration. Concentration/casting dialog. Dice integration where available.

**Spell Phase 3 — Class-advanced:** Mystic Arcanum, Arcane Recovery, Spell Mastery, Signature Spells. All consume the Feature Resources pattern.
