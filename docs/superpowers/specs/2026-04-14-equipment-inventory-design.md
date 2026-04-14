# Equipment & Inventory System Design

**Date:** 2026-04-14  
**Status:** Approved  
**Scope:** Full inventory management for D&D 5e characters — item tracking, equip/attune state, AC/attack integration, weight/encumbrance, currency, search-based item addition, magic item enrichment.

---

## Data Model

### New Table: `character_inventory`

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `id` | uuid PK | gen_random_uuid() | Row ID |
| `character_id` | uuid FK → characters | — | Owner character |
| `content_id` | uuid FK → content_definitions | nullable | Item definition (null for custom items) |
| `name` | text | — | Display name (copied from content or user-entered) |
| `content_type` | text | — | weapon / armor / item / magic_item |
| `quantity` | int | 1 | Stack count |
| `equipped` | boolean | false | Currently equipped? |
| `attuned` | boolean | false | Attuned magic item? |
| `sort_order` | int | 0 | User ordering |
| `notes` | text | null | Per-item notes |
| `custom_data` | jsonb | null | Override fields or full data for custom items |
| `created_at` | timestamptz | now() | When added |

**Indexes:**
- `character_id` — all queries are per-character
- `(character_id, equipped)` — fast equipped-item lookups
- `content_id` — for content update propagation queries

**RLS Policies:**
- Owner can SELECT/INSERT/UPDATE/DELETE where `character_id` belongs to a character with `user_id = auth.uid()`
- No public access for MVP

### Currency

Stored in `character.state` as:

```typescript
currency?: {
  cp: number;  // copper
  sp: number;  // silver
  ep: number;  // electrum
  gp: number;  // gold
  pp: number;  // platinum
}
```

Not an inventory row — it's simple numeric state.

### Content References

Each inventory item references a `content_definitions` row via `content_id`. The item inherits all mechanical data (damage, AC, weight, cost, properties, effects) from the content definition. The `custom_data` JSONB field allows overriding any inherited field (e.g., DM-modified weapon damage).

Items without a `content_id` are fully custom — `name` and `custom_data` provide all data.

---

## Evaluator Integration

### AC from Equipped Armor

When armor is equipped from inventory:

1. Query the equipped armor's `content_definitions.data.armor_class` → `{base, dex_bonus, max_bonus}`
2. Generate an AC effect based on armor type:
   - **No DEX bonus** (heavy): `{op: "set", stat: "armor_class", value: base}`
   - **Full DEX** (light): `{op: "formula", stat: "armor_class", expr: "base + mod(dexterity)", tag: "ac_formula"}`
   - **Capped DEX** (medium): formula with `min(mod(dexterity), max_bonus)`
3. This effect enters the existing AC best-of system alongside Unarmored Defense formulas
4. Shield adds flat +2 AC (existing behavior, triggered by equipped shield item)
5. The current "armor category" dropdown is replaced by the actual equipped armor item — the evaluator derives the category from `data.armor_category`

### Attacks from Equipped Weapons

Equipped weapons show in the Actions tab:

- **Attack bonus** = ability mod + proficiency (if proficient in weapon type) + magic bonus
- **Ability mod**: STR for melee, DEX for ranged. Finesse weapons use higher of STR/DEX
- **Proficiency**: checked against class weapon proficiency grants
- **Damage**: dice from weapon data + ability mod + magic bonus
- **Properties**: displayed as tags (versatile, heavy, light, finesse, etc.)
- **Two-handed damage**: shown if weapon has `two_handed_damage` data

### Magic Item Effects

Attuned magic items with structured mechanical effects flow into the evaluator:

- Effects are stored on the `content_definitions.effects` array (enrichment adds these)
- Only apply when `attuned = true` (or if the item doesn't require attunement)
- Common patterns: +X to attack/damage, +X to AC, set ability score, grant resistance, grant proficiency

### Re-evaluation

Uses the existing client-side `useMemo` pattern in `CharacterPageClient`:

- Inventory changes (equip/unequip/attune) update local state
- State change triggers re-evaluation via `evaluate()`
- AC, attack bonuses, and other derived stats update instantly

---

## Inventory UI

### Layout: Categorized Sections (Character Sheet Tab)

The inventory tab replaces the current placeholder with categorized collapsible sections:

1. **Equipped** — highlighted section at top showing currently equipped weapons, armor, shield. Quick-glance combat readiness view.
2. **Weapons** — all owned weapons with equip/unequip toggle. Multiple can be equipped (dual wielding). Shows damage, properties.
3. **Armor & Shields** — all owned armor with equip toggle. Only one armor at a time (equipping unequips current). Shows AC, weight class.
4. **Gear** — adventuring equipment, tools, consumables. Quantity editable.
5. **Magic Items** — rarity badge, attunement toggle, X/3 attunement counter at section header. Items requiring attunement show a lock icon until attuned.
6. **Currency** — editable fields for GP/SP/CP/EP/PP. Pinned at bottom.
7. **Weight** — total weight sum displayed near currency. Carrying capacity = STR × 15.

Each section is collapsible. "Add Item" button at the top opens the search modal.

### Add Item Search Modal

1. Search input + category filter tabs (All / Weapons / Armor / Gear / Magic Items)
2. Queries `content_definitions` with `content_type IN ('weapon', 'armor', 'item', 'magic_item')` and `name ILIKE '%query%'`
3. Results show: name, type badge, key stats, weight, cost
4. Click item → adds to `character_inventory` with quantity 1, not equipped
5. "Custom Item" button → simple form: name, type, weight, description, notes
6. Scoped to platform + personal + shared content (matching builder content visibility)

### Equip/Unequip Rules

- **Weapons**: multiple can be equipped simultaneously
- **Armor**: only one at a time. Equipping new armor unequips current
- **Shield**: only one. Equipping sets `shield_equipped` in character state
- **Attunement**: toggle per magic item. Hard cap at 3 attuned items — UI blocks with message

---

## Weight & Encumbrance

- Weight from `content_definitions.data.weight` (or `custom_data.weight` override)
- Total weight = Σ(weight × quantity) for all inventory items
- Carrying capacity = STR score × 15
- Display: "84 lb / 240 lb" with progress bar
- Encumbrance thresholds displayed but not auto-enforced:
  - STR × 5 = encumbered (speed -10)
  - STR × 10 = heavily encumbered (speed -20, disadvantage)
- Enforcement is a future toggle — show the numbers for now

---

## Builder Integration

When a character finishes the Equipment builder step:

1. Parse equipment text by semicolons into groups
2. For each group, match items against `content_definitions` by name/slug
3. Exact matches → create `character_inventory` rows
4. Ambiguous choices (e.g., "any martial weapon") → skip, player adds manually via search
5. Starting gold from background `data.gold` → set in `character.state.currency.gp`
6. Best-effort parsing — the search modal handles anything the parser misses

---

## Magic Item Enrichment

All 362 SRD magic items get structured mechanical effects added to their `content_definitions.effects` array:

### Enrichment Categories

- **+X weapons** (e.g., Longsword +1): `{type: "mechanical", stat: "attack_bonus", op: "add", value: 1}` + `{stat: "damage_bonus", op: "add", value: 1}`
- **+X armor** (e.g., Plate Armor +2): modify `armor_class.base` in data
- **Stat-setting items** (Belt of Giant Strength): `{op: "set", stat: "strength", value: 21}`
- **Save/AC bonus items** (Cloak of Protection): `{stat: "armor_class", op: "add", value: 1}` + `{stat: "all_saves_bonus", op: "add", value: 1}`
- **Resistance items** (Ring of Resistance): grant damage resistance
- **Attunement flag**: `data.requires_attunement: true/false` added to all magic items

### Enrichment Approach

- Pattern-match common item types (+X weapons/armor, stat setters, resistance granters)
- AI-assisted parsing for complex descriptions
- Items that can't be cleanly parsed keep description-only with `effects: []`
- Migration SQL for the enrichment data

---

## Migration Plan

### Migration 1: `character_inventory` table + indexes + RLS
### Migration 2: Currency fields in character state type
### Migration 3: Magic item enrichment (attunement flags + mechanical effects)

---

## File Changes

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/00025_character_inventory.sql` | Create | Table, indexes, RLS |
| `supabase/migrations/00026_magic_item_enrichment.sql` | Create | Effects on 362 items |
| `lib/types/character.ts` | Modify | Add Currency type to CharacterState |
| `components/sheet/tabs/inventory-tab.tsx` | Rewrite | Full inventory UI |
| `components/sheet/add-item-modal.tsx` | Create | Search + add item modal |
| `components/sheet/currency-tracker.tsx` | Create | Editable currency fields |
| `components/sheet/equipment-state.tsx` | Modify | Replace dropdown with actual equipped items |
| `app/(app)/characters/[id]/page.tsx` | Modify | Fetch inventory data |
| `components/character/character-page-client.tsx` | Modify | Pass inventory, handle equip/attune |
| `lib/engine/evaluator.ts` | Modify | Generate AC effects from equipped armor data |
| `app/(app)/characters/[id]/builder/equipment/equipment-step-client.tsx` | Modify | Populate inventory on finish |
| `lib/supabase/inventory.ts` | Create | CRUD helpers for character_inventory |
