# Spell Management — Phase 1: Selection & Read-Only Sheet Design

**Date:** 2026-04-16
**Status:** Approved
**Scope:** First of three spell management phases. Delivers spell selection (cantrips, known spells, prepared spells, wizard spellbook), read-only sheet display with spell DC / attack bonus / slot counters, concentration tracking, and fixes the SRD ritual_casting flag bug. Subsequent phases add casting actions + rests (Phase 2) and advanced class features (Phase 3).

---

## Audit Findings

- **319 SRD spells** with class tags, damage/heal shapes, AOE, DCs (119 rows per class overlap via `data.classes[]`)
- **All 8 SRD caster classes** have populated spellcasting metadata (type, ability, spells known arrays, cantrips known arrays, spell list level bounds)
- **Wizard, Cleric, Druid, Bard level data** has `spell_slots: [9 ints]` populated for levels 1-20
- **Warlock pact magic** is correctly modeled — `spellcastingList.level = [0, 5]`, slot arrays at one slot-level at a time, mystic arcanum flags in `class_specific`
- **`spell_slots_used: Record<string, number>`** exists on `CharacterState` but is a placeholder — no convention documented, no code reads or writes it
- **`components/sheet/tabs/spells-tab.tsx`** is a 59-line read-only placeholder
- **Zero spell selection UI** anywhere — no builder step, no tab selection flow
- **Zero spell tests** beyond transformer + Zod validation

**Data bugs to fix in this phase:**
- `ritual_casting` is `false` on all SRD classes — Wizard, Cleric, Druid, Bard should be `true` (Sorcerer Divine Soul is a subclass, handled in Phase 3)

**Data bugs out of scope:**
- Only 10 of 24 cantrips have `descriptionCantripDie` populated — Phase 2 handles cantrip scaling display
- Magic Missile scaling (extra darts per slot) not modeled — Phase 2 casting dialog handles upcast
- Subclass spellcasting overrides absent (Eldritch Knight / Arcane Trickster not in SRD anyway)

---

## Data Model

### New Table: `character_spells`

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `id` | uuid PK | `gen_random_uuid()` | Row ID |
| `character_id` | uuid FK → characters | — | Owner character |
| `content_id` | uuid FK → content_definitions | nullable | Spell definition (null for custom spells) |
| `name` | text | — | Display name (copied from content or user-entered) |
| `class_slug` | text | — | Which caster class this spell belongs to (`wizard`, `cleric`, etc.) |
| `is_known` | boolean | `false` | True for known casters and wizards' spellbook entries |
| `is_prepared` | boolean | `false` | True if currently prepared (prepared casters) or always-prepared |
| `always_prepared` | boolean | `false` | Auto-added from class/subclass/patron features; cannot un-prepare |
| `in_spellbook` | boolean | `false` | Wizard-only — spell is written in spellbook |
| `source` | text | `'selection'` | `selection` / `feature` / `feat` / `item` |
| `custom_data` | jsonb | nullable | Override fields or full data for custom spells |
| `created_at` | timestamptz | `now()` | When added |

**Indexes:**
- `(character_id)`
- `(character_id, is_prepared)`
- `(character_id, class_slug)`
- `(content_id)`

**RLS Policies:**
- Owner can SELECT/INSERT/UPDATE/DELETE where `character_id` belongs to a character with `user_id = auth.uid()`
- Same pattern as `character_inventory`

**Unique constraint:** `(character_id, content_id, class_slug)` where `content_id IS NOT NULL` — prevents duplicate spell entries for the same character+spell+class combo. Custom spells (null `content_id`) can duplicate.

### Slot State Convention

`CharacterState.spell_slots_used` gets refined typing:

```typescript
// In lib/types/character.ts
export interface SpellSlotsUsed {
  "1"?: number; "2"?: number; "3"?: number; "4"?: number; "5"?: number;
  "6"?: number; "7"?: number; "8"?: number; "9"?: number;
  pact?: number;
}

interface CharacterState {
  // existing fields...
  spell_slots_used?: SpellSlotsUsed;
  concentrating_on?: ConcentrationState;
}

export interface ConcentrationState {
  spell_slug: string;
  spell_name: string;      // denormalized for display without extra queries
  slot_level: number;      // the level it was cast at (for upcast awareness)
  started_at: string;      // ISO timestamp
}
```

Keys `"1"`-`"9"` are shared across non-Warlock caster classes (per 5e multi-class rules). `"pact"` is Warlock-only and separate from the regular pool.

---

## Ritual Casting Fix

Migration 00028 sets `data.spellcasting.ritual_casting = true` on:
- Wizard, Cleric, Druid, Bard

Other SRD casters (Paladin, Ranger, Sorcerer, Warlock) stay `false` per RAW (Sorcerer has the option via Divine Soul subclass, handled later).

---

## Always-Prepared Spell Sync

On character page load, the server resolves feature-granted spells:

1. Read character's classes and subclasses from `choices.classes[]`
2. For each subclass, fetch `content_definitions.data.spellcastingExtra`
3. `spellcastingExtra` is an array of tier groups; resolve entries that apply at or below the character's class level
4. For each resolved spell slug:
   - Check if `character_spells` already has a row with `(character_id, content_id, class_slug, source='feature')`
   - If not, upsert one with `always_prepared: true`, `is_prepared: true`, `source: 'feature'`
5. For each existing row with `source='feature'` whose slug is no longer in the resolved set (e.g. user changed subclass), delete it

This runs server-side before rendering. Idempotent, cheap (single query per char).

**Coverage caveat:** `spellcastingExtra` enrichment on subclasses needs spot-checked. If gaps exist (Life Domain domain spells missing, etc.), they get filled during implementation.

---

## Spell DC & Attack Bonus Computation

`lib/spells/helpers.ts`:

```typescript
export function computeSpellDc(
  casterClass: CasterClass,
  abilityScores: Record<string, number>,
  proficiencyBonus: number,
): number {
  const abilityMod = Math.floor((abilityScores[casterClass.ability] - 10) / 2);
  return 8 + proficiencyBonus + abilityMod;
}

export function computeSpellAttackBonus(
  casterClass: CasterClass,
  abilityScores: Record<string, number>,
  proficiencyBonus: number,
): number {
  const abilityMod = Math.floor((abilityScores[casterClass.ability] - 10) / 2);
  return proficiencyBonus + abilityMod;
}

export function computeMaxPrepared(
  classSlug: string,
  classLevel: number,
  abilityMod: number,
): number {
  // Paladin: CHA mod + (paladin level / 2, rounded down), min 1
  if (classSlug === "paladin") {
    return Math.max(1, abilityMod + Math.floor(classLevel / 2));
  }
  // Cleric, Druid, Wizard: ability mod + class level, min 1
  return Math.max(1, abilityMod + classLevel);
}

export function computeMaxSlots(
  classes: Array<{ slug: string; level: number; type: string | null }>,
  classData: Record<string, ClassSpellcastingData>,  // class slug → class content
): MaxSlotsByLevel {
  const result: MaxSlotsByLevel = {};

  // Warlock slots: separate, taken directly from warlock level data
  const warlock = classes.find((c) => c.slug === "warlock");
  if (warlock) {
    const warlockData = classData["warlock"];
    const slots = warlockData?.levels?.[warlock.level - 1]?.spellcasting?.spell_slots;
    if (slots) {
      // Warlock slots appear at exactly one slot level at a time
      const pactLevel = slots.findIndex((s) => s > 0) + 1;
      const count = slots[pactLevel - 1];
      if (count > 0) result.pact = count;
    }
  }

  // Multi-class non-Warlock: sum spellcaster levels per the 5e table
  const casterLevel = classes.reduce((sum, c) => {
    if (c.slug === "warlock") return sum;
    if (c.type === "full") return sum + c.level;                // Wizard, Cleric, Druid, Bard, Sorcerer
    if (c.type === "half" && c.level >= 2) return sum + Math.floor(c.level / 2);  // Paladin, Ranger — half slots, rounded down, no slots at L1
    // TODO Phase 3: third-casters (Eldritch Knight / Arcane Trickster)
    return sum;
  }, 0);

  if (casterLevel > 0) {
    // Look up slots from the multi-class spellcaster table (in helpers module)
    Object.assign(result, getMultiClassSlots(casterLevel));
  }

  return result;
}
```

The multi-class spellcaster table is a hardcoded 20-row constant (from PHB p164). Wizard-only / Cleric-only classes just use casterLevel = class level, so the table covers both single-class and multi-class cases uniformly.

---

## UI

### Spells Tab Layout

**Sticky header:**
```
╭─ Spellcasting Ability: Intelligence ───────────────╮
│  Save DC 16    Attack +8                           │
│  Cantrips Known: 4 / 4    Spells Prepared: 7 / 10  │
╰────────────────────────────────────────────────────╯
╭─ SLOTS ────────────────────────────────────────────╮
│  1st  ●●○○   2nd  ●●●   3rd  ●●○   4th  -   ...    │
│  Pact 5th  ●●○                                     │
╰────────────────────────────────────────────────────╯
```

Slot dots are read-only this phase. Filled = available, empty = used. Pact row only renders if character is Warlock.

**Search/filter bar:**
- Search input (filters by name)
- Filter pills: `All` / `Prepared` / `Cantrips` / `Rituals` / `Concentration`
- `+ Add Spell` button (opens inline add panel matching inventory's pattern)

**Level-grouped accordion body:**
Each level section has:
- Level label + slot summary (e.g. "1st Level (●●○○ 2/4 used)")
- Collapsible (cantrips default open, others level-by-level)

Each spell row:
- **Prepare checkbox** (prepared casters only; disabled if `always_prepared`, hidden for known casters)
- **Name** with school, components inline
- **Badges**: `[Always]` (locked always-prepared), `[Ritual]` (spell has ritual: true), `[Concentration]` (spell has concentration: true)
- **Remove button** (not for always-prepared spells)
- **Cast button** (disabled in Phase 1 — enabled in Phase 2)
- **Click to expand**: full description, components detail, save DC info, damage table

**Empty states:**
- Non-caster: "This character cannot cast spells. Casting classes: Bard, Cleric, Druid, Paladin, Ranger, Sorcerer, Warlock, Wizard."
- Caster with no spells: "You haven't picked any spells yet. Click **+ Add Spell** to get started."

### Add Spell Panel

Same inline pattern as inventory's `add-item-panel.tsx`. Props: `open`, `onClose`, `onAdd`, `character`, `casterClass` (if multi-class, user picks which class's list to add from).

**Layout:**
- Search input + level filter pills (Cantrip / 1st / 2nd / ... / 9th) + school filter dropdown
- Results scoped to character's caster class spell list (from `data.classes[]`)
- Multi-class: dropdown to pick the class context — determines which list shows and which `class_slug` gets stamped
- Each result shows name + school + components preview + save/attack shape
- Click result → expand detail card with full description and "Add to Spellbook" (wizard) or "Learn Spell" (known casters) or "Mark as Known" (prepared casters — for rare edge cases)
- For prepared casters (Cleric/Druid/Paladin/Wizard with spellbook): show all class spells they can cast, with a "Prepared" toggle; no explicit "learn" step needed except for wizards' spellbook

**Cantrip picker:** appears at the top when cantrips-known cap hasn't been filled. Same search UI but filtered to level 0.

**Wizard spellbook UX:**
- Wizard sees "In Spellbook" section separate from "Class Spells Available"
- To prepare a spell: it must be `in_spellbook: true` first
- Spells not in spellbook show "Add to Spellbook" button in the add panel
- Free-cost for Phase 1 (no gp/time tracking)

### Concentration Badge

Rendered near HP tracker in the sheet header:
- If `state.concentrating_on`: shows `🧠 Concentrating: {spell_name} ({slot_level} slot)` with an X button to cancel
- Clicking X clears `concentrating_on` via `patchState({ concentrating_on: null })`
- Cancelling is the only manual action this phase — Phase 2 casting dialog handles replace/auto-break

---

## Context Integration

Extend `CharacterContext`:

```typescript
// In CharacterContextValue:
spells: CharacterSpell[];
slotState: SpellSlotsUsed;
maxSlots: MaxSlotsByLevel;
casterInfo: CasterInfo;
addSpell: (payload: AddSpellPayload) => Promise<void>;
updateSpell: (id: string, updates: SpellUpdate) => Promise<void>;
removeSpell: (id: string) => Promise<void>;
setConcentration: (spell: { slug: string; name: string; slot_level: number } | null) => Promise<void>;
```

New consumer hook `useSpells()` returning just the spell-related slice — same pattern as `useInventory()`.

**Provider changes:**
- Accept `initialSpells: CharacterSpell[]` and `classData: Record<string, ClassData>` props from server
- `spells` state initialized from `initialSpells`
- `slotState` derived from `state.spell_slots_used`
- `maxSlots` computed via `useMemo` from `classes + classData`
- `casterInfo` computed via `useMemo` from `character.choices.classes + classData + state + evalResult.stats`
- `setConcentration` writes to `state.concentrating_on` via `patchState`

**Server page changes:**
- Fetch `character_spells` with `content_definitions` join
- Fetch caster class content for the character's classes
- Run `syncAlwaysPreparedSpells()` before rendering (idempotent upsert/delete)
- Pass `initialSpells` + `classData` (map keyed by slug) to `CharacterPageClient`

---

## File Structure

| File | Action |
|------|--------|
| `supabase/migrations/00027_character_spells.sql` | Create — table + indexes + RLS + unique constraint |
| `supabase/migrations/00028_fix_ritual_casting.sql` | Create — set `ritual_casting: true` on Wizard/Cleric/Druid/Bard |
| `lib/types/spells.ts` | Create — `CharacterSpell`, `SpellSlotsUsed`, `MaxSlotsByLevel`, `CasterInfo`, `ConcentrationState`, `AddSpellPayload`, `SpellUpdate` |
| `lib/types/character.ts` | Modify — add `concentrating_on?: ConcentrationState`, refine `spell_slots_used` type |
| `lib/supabase/spells.ts` | Create — CRUD + search + always-prepared sync |
| `lib/spells/helpers.ts` | Create — DC/attack/maxPrepared/maxSlots computation + multi-class slot table |
| `lib/spells/multiclass-slots.ts` | Create — hardcoded 20-row multi-class slot table (split out for readability + testing) |
| `tests/spells/helpers.test.ts` | Create — unit tests for all helpers |
| `tests/spells/multiclass-slots.test.ts` | Create — verify table values against PHB |
| `tests/supabase/spells.test.ts` | Create — mocked CRUD tests |
| `lib/character/character-context.tsx` | Modify — add spell state/handlers, `useSpells()` hook |
| `components/character/character-page-client.tsx` | Modify — thread `initialSpells` + `classData` to provider |
| `app/(app)/characters/[id]/page.tsx` | Modify — fetch `character_spells` + class data + run always-prepared sync |
| `components/sheet/spells/spell-header.tsx` | Create — DC/attack/prepared counters (~100 lines) |
| `components/sheet/spells/slot-tracker.tsx` | Create — read-only dot display (~80 lines) |
| `components/sheet/spells/spell-row.tsx` | Create — single spell row with prepare toggle, badges, expandable description (~180 lines) |
| `components/sheet/spells/spell-level-section.tsx` | Create — collapsible accordion per level (~80 lines) |
| `components/sheet/spells/add-spell-panel.tsx` | Create — inline search panel, mirrors add-item-panel (~250 lines) |
| `components/sheet/spells/concentration-badge.tsx` | Create — near HP, shows current concentration + cancel (~50 lines) |
| `components/sheet/tabs/spells-tab.tsx` | Rewrite — full UI composing the sub-components, uses `useSpells()` (~200 lines) |
| `tests/components/sheet/spells-tab.test.tsx` | Create — smoke test: renders, empty states, add spell, prepare toggle |

**Totals: 2 migrations, 3 new library files, 2 modified types, 6 new UI files, 1 rewritten tab, 3 modified core files, ~20 new tests.** ~15 new files, ~5 modified.

---

## Verification

1. **Tests**: `npx vitest run` — 182 + ~20 new = ~202 tests pass
2. **Build**: `npm run build` — clean
3. **Migrations applied**:
   - `SELECT count(*) FROM character_spells;` returns 0 (new table)
   - `SELECT slug, data->'spellcasting'->>'ritual_casting' FROM content_definitions WHERE content_type='class' AND slug IN ('wizard','cleric','druid','bard');` returns `true` for all four
4. **Manual smoke test**:
   - **Barbarian** character → Spells tab → "cannot cast spells" message
   - **Wizard L3** → Spells tab → empty state → Add Spell → filter to 1st → add Magic Missile → row shows in 1st Level section with [Prepared] toggle → check toggle → prepared count updates → spell DC / attack bonus show at top
   - **Cleric L1 Life Domain** → Spells tab → Bless and Cure Wounds auto-appear with `[Always]` badges
   - **Warlock L3 Fiend** → Spells tab → Burning Hands and Command auto-appear with `[Always]` → pact slot row shows 2 dots at 2nd level
   - **Multi-class Cleric 3 / Wizard 3** → slots reflect level-5 caster progression (not 3+3=6)
   - **Bard L5** → prepared casters don't show (known caster) → adding spells goes into "known" list directly → cantrip count respects cap
   - Concentration badge: cast Bless (or whatever triggers it via future dialog; for Phase 1 manually patch via dev tools) → badge shows → X cancels
   - Ritual spells show `[R]` badge; fix verified: Wizard has `ritual_casting: true`
5. **Line count check**: no new file over 300 lines; spells-tab.tsx stays under 250

---

## Out of Scope — Deferred to Phase 2

- **Interactive slot consumption** (click dot to mark used)
- **Cast button active** (slot picker, upcast, damage roller, ritual cast flow)
- **Short rest** (restore Warlock pact, hit dice HP option)
- **Long rest** (restore all slots + hit dice + exhaustion)
- **Cantrip scaling display** (requires enriching 14 more cantrips)
- **Concentration auto-break** prompt on damage

## Out of Scope — Deferred to Phase 3

- **Mystic Arcanum** (Warlock L11+)
- **Arcane Recovery** (Wizard L1+ short rest slot restore)
- **Spell Mastery** (Wizard L18)
- **Signature Spells** (Wizard L20)
- **Spellcasting bonuses** from feats/items (Fey Touched, Ring of Spell Storing)

## Out of Scope — Unchanged Future Work

- Database schema changes beyond `character_spells` and ritual_casting fix
- Builder step for spell selection (explicitly chose post-finish on sheet)
- Dice roller infrastructure (Phase 2's casting dialog will need one)
- Spell-sharing between characters (campaign feature)
- Homebrew spell authoring UI (separate homebrew spec later)
- Third-caster progression (Eldritch Knight / Arcane Trickster — not in SRD)
