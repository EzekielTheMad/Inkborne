# Spell Management Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver spell selection + read-only spellbook display for caster characters — new `character_spells` table, D&D Beyond-style tab layout with DC/attack/slot counters, always-prepared spell sync from class/subclass features, concentration tracking.

**Architecture:** Follow the `character_inventory` pattern exactly — new table with FK to `content_definitions`, CRUD helpers in `lib/supabase/spells.ts`, helpers in `lib/spells/`, context state/handlers/hook in `character-context.tsx`, UI sub-components under `components/sheet/spells/`. Server page fetches spells + runs always-prepared sync before render.

**Tech Stack:** TypeScript, React 19, Next.js 16, Supabase (Postgres + RLS), Zod, Vitest, React Testing Library

**Spec:** `docs/superpowers/specs/2026-04-16-spell-management-phase-1-design.md`

---

## File Structure

| File | Action | Task |
|------|--------|------|
| `supabase/migrations/00029_character_spells.sql` | Create | 1 |
| `supabase/migrations/00030_spellcasting_fixes.sql` | Create | 2 |
| `lib/types/spells.ts` | Create | 3 |
| `lib/types/character.ts` | Modify | 3 |
| `lib/spells/multiclass-slots.ts` | Create | 4 |
| `tests/spells/multiclass-slots.test.ts` | Create | 4 |
| `lib/spells/helpers.ts` | Create | 5 |
| `tests/spells/helpers.test.ts` | Create | 5 |
| `lib/supabase/spells.ts` | Create | 6 |
| `tests/supabase/spells.test.ts` | Create | 6 |
| `lib/character/character-context.tsx` | Modify | 7 |
| `app/(app)/characters/[id]/page.tsx` | Modify | 8 |
| `components/character/character-page-client.tsx` | Modify | 8 |
| `components/sheet/spells/spell-header.tsx` | Create | 9 |
| `components/sheet/spells/slot-tracker.tsx` | Create | 9 |
| `components/sheet/spells/concentration-badge.tsx` | Create | 9 |
| `components/sheet/spells/spell-row.tsx` | Create | 10 |
| `components/sheet/spells/spell-level-section.tsx` | Create | 11 |
| `components/sheet/spells/add-spell-panel.tsx` | Create | 12 |
| `components/sheet/tabs/spells-tab.tsx` | Rewrite | 13 |
| `components/character/character-shell.tsx` | Modify | 14 |
| `tests/components/sheet/spells-tab.test.tsx` | Create | 15 |

---

### Task 1: Create `character_spells` Table

**Why first:** Everything else depends on this. Pure DB work, no code changes.

**Files:**
- Create: `supabase/migrations/00029_character_spells.sql`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/00029_character_spells.sql`:

```sql
-- Migration: Create character_spells table for spell tracking
-- Mirrors the character_inventory pattern.

CREATE TABLE character_spells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  content_id uuid REFERENCES content_definitions(id) ON DELETE SET NULL,
  name text NOT NULL,
  class_slug text NOT NULL,
  is_known boolean NOT NULL DEFAULT false,
  is_prepared boolean NOT NULL DEFAULT false,
  always_prepared boolean NOT NULL DEFAULT false,
  in_spellbook boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'selection',
  custom_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_spells_character ON character_spells(character_id);
CREATE INDEX idx_spells_character_prepared ON character_spells(character_id, is_prepared);
CREATE INDEX idx_spells_character_class ON character_spells(character_id, class_slug);
CREATE INDEX idx_spells_content ON character_spells(content_id);

-- Unique: no duplicate spell for the same character + spell + class combo.
-- Custom spells (null content_id) are allowed to duplicate.
CREATE UNIQUE INDEX idx_spells_character_spell_class_unique
  ON character_spells(character_id, content_id, class_slug)
  WHERE content_id IS NOT NULL;

ALTER TABLE character_spells ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage spells"
ON character_spells FOR ALL
TO authenticated
USING (
  character_id IN (SELECT id FROM characters WHERE user_id = auth.uid())
)
WITH CHECK (
  character_id IN (SELECT id FROM characters WHERE user_id = auth.uid())
);
```

- [ ] **Step 2: Apply migration to Supabase**

Use the `mcp__c36363d3-9454-4165-9c04-a1b85837d9e6__execute_sql` MCP tool against project `etcaodglvcspcmwecyxq`, passing the full SQL above.

- [ ] **Step 3: Verify table exists**

Run via MCP tool:
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'character_spells'
ORDER BY ordinal_position;
```
Expected: 12 columns including `id`, `character_id`, `content_id`, `name`, `class_slug`, `is_known`, `is_prepared`, `always_prepared`, `in_spellbook`, `source`, `custom_data`, `created_at`.

Also verify indexes:
```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'character_spells' ORDER BY indexname;
```
Expected: `character_spells_pkey`, `idx_spells_character`, `idx_spells_character_class`, `idx_spells_character_prepared`, `idx_spells_character_spell_class_unique`, `idx_spells_content`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00029_character_spells.sql
git commit -m "feat: create character_spells table with indexes and RLS"
```

---

### Task 2: Fix Spellcasting Data Bugs

**Why second:** Pure data migration. No code changes. Completing it early means the rest of the plan can rely on this data being correct.

**Files:**
- Create: `supabase/migrations/00030_spellcasting_fixes.sql`

Fixes two bugs:
1. `ritual_casting: false` on Wizard/Cleric/Druid/Bard — should be `true`
2. Subclass `spellcastingExtra` is `null` on Life (Cleric), Fiend (Warlock), and Devotion (Paladin) — needs enrichment so always-prepared sync has data to work with

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/00030_spellcasting_fixes.sql`:

```sql
-- Migration: Fix ritual_casting flag on SRD classes, enrich subclass spellcastingExtra.

-- 1. Set ritual_casting = true on Wizard, Cleric, Druid, Bard.
UPDATE content_definitions
SET data = jsonb_set(
  data,
  '{spellcasting,ritual_casting}',
  'true'::jsonb,
  true
)
WHERE content_type = 'class'
  AND source = 'srd'
  AND scope = 'platform'
  AND slug IN ('wizard', 'cleric', 'druid', 'bard');

-- 2. Enrich Life Domain (Cleric) with domain spells per PHB p60.
-- Format: array of tier objects, each tier = {level: N, spells: [slug, ...]}
-- L1: Bless, Cure Wounds; L3: Lesser Restoration, Spiritual Weapon;
-- L5: Beacon of Hope, Revivify; L7: Death Ward, Guardian of Faith;
-- L9: Mass Cure Wounds, Raise Dead
UPDATE content_definitions
SET data = jsonb_set(
  data,
  '{spellcastingExtra}',
  '[
    {"level": 1, "spells": ["bless", "cure-wounds"]},
    {"level": 3, "spells": ["lesser-restoration", "spiritual-weapon"]},
    {"level": 5, "spells": ["beacon-of-hope", "revivify"]},
    {"level": 7, "spells": ["death-ward", "guardian-of-faith"]},
    {"level": 9, "spells": ["mass-cure-wounds", "raise-dead"]}
  ]'::jsonb,
  true
)
WHERE content_type = 'subclass'
  AND source = 'srd'
  AND scope = 'platform'
  AND slug = 'life';

-- 3. Enrich Fiend (Warlock patron) with expanded spell list per PHB p109.
-- Class level tiers for Warlock expanded list:
-- L1: Burning Hands, Command; L3: Blindness/Deafness, Scorching Ray;
-- L5: Fireball, Stinking Cloud; L7: Fire Shield, Wall of Fire;
-- L9: Flame Strike, Hallow
UPDATE content_definitions
SET data = jsonb_set(
  data,
  '{spellcastingExtra}',
  '[
    {"level": 1, "spells": ["burning-hands", "command"]},
    {"level": 3, "spells": ["blindness-deafness", "scorching-ray"]},
    {"level": 5, "spells": ["fireball", "stinking-cloud"]},
    {"level": 7, "spells": ["fire-shield", "wall-of-fire"]},
    {"level": 9, "spells": ["flame-strike", "hallow"]}
  ]'::jsonb,
  true
)
WHERE content_type = 'subclass'
  AND source = 'srd'
  AND scope = 'platform'
  AND slug = 'fiend';

-- 4. Enrich Oath of Devotion (Paladin) with oath spells per PHB p86.
-- Paladin oath tiers use paladin levels:
-- L3: Protection from Evil and Good, Sanctuary;
-- L5: Lesser Restoration, Zone of Truth;
-- L9: Beacon of Hope, Dispel Magic;
-- L13: Freedom of Movement, Guardian of Faith;
-- L17: Commune, Flame Strike
UPDATE content_definitions
SET data = jsonb_set(
  data,
  '{spellcastingExtra}',
  '[
    {"level": 3, "spells": ["protection-from-evil-and-good", "sanctuary"]},
    {"level": 5, "spells": ["lesser-restoration", "zone-of-truth"]},
    {"level": 9, "spells": ["beacon-of-hope", "dispel-magic"]},
    {"level": 13, "spells": ["freedom-of-movement", "guardian-of-faith"]},
    {"level": 17, "spells": ["commune", "flame-strike"]}
  ]'::jsonb,
  true
)
WHERE content_type = 'subclass'
  AND source = 'srd'
  AND scope = 'platform'
  AND slug = 'devotion';
```

- [ ] **Step 2: Apply migration to Supabase**

Use the MCP tool to execute the full SQL above against project `etcaodglvcspcmwecyxq`.

- [ ] **Step 3: Verify ritual_casting fix**

```sql
SELECT slug, data->'spellcasting'->>'ritual_casting' as ritual
FROM content_definitions
WHERE content_type = 'class' AND source = 'srd' AND scope = 'platform'
  AND slug IN ('wizard', 'cleric', 'druid', 'bard');
```
Expected: all four rows have `ritual` = `true`.

- [ ] **Step 4: Verify subclass enrichment**

```sql
SELECT slug, data->'spellcastingExtra' as extra
FROM content_definitions
WHERE content_type = 'subclass' AND source = 'srd' AND scope = 'platform'
  AND slug IN ('life', 'fiend', 'devotion');
```
Expected: all three rows have non-null arrays with the tier objects from the migration.

Verify spell slugs exist in the spell table:
```sql
SELECT slug FROM content_definitions
WHERE content_type = 'spell' AND source = 'srd'
  AND slug IN (
    'bless', 'cure-wounds', 'lesser-restoration', 'spiritual-weapon',
    'beacon-of-hope', 'revivify', 'death-ward', 'guardian-of-faith',
    'mass-cure-wounds', 'raise-dead',
    'burning-hands', 'command', 'blindness-deafness', 'scorching-ray',
    'fireball', 'stinking-cloud', 'fire-shield', 'wall-of-fire',
    'flame-strike', 'hallow',
    'protection-from-evil-and-good', 'sanctuary', 'zone-of-truth',
    'dispel-magic', 'freedom-of-movement', 'commune'
  )
ORDER BY slug;
```
Expected: at least 24 rows (some spells are in multiple lists so there are duplicates in the spec above). If any slug is missing, the sync will silently skip it; verify here before continuing.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00030_spellcasting_fixes.sql
git commit -m "feat: fix ritual_casting on casters + enrich subclass spellcastingExtra"
```

---

### Task 3: Spell Types

**Why third:** Types are needed by every subsequent task. Pure TypeScript.

**Files:**
- Create: `lib/types/spells.ts`
- Modify: `lib/types/character.ts`

- [ ] **Step 1: Create `lib/types/spells.ts`**

```typescript
/**
 * Types for spell management.
 */

export interface CharacterSpell {
  id: string;
  character_id: string;
  content_id: string | null;
  name: string;
  class_slug: string;
  is_known: boolean;
  is_prepared: boolean;
  always_prepared: boolean;
  in_spellbook: boolean;
  source: "selection" | "feature" | "feat" | "item";
  custom_data: Record<string, unknown> | null;
  created_at: string;
  content_definitions?: {
    id: string;
    name: string;
    slug: string;
    content_type: string;
    data: Record<string, unknown>;
    effects: Array<Record<string, unknown>>;
  } | null;
}

export interface SpellSlotsUsed {
  "1"?: number;
  "2"?: number;
  "3"?: number;
  "4"?: number;
  "5"?: number;
  "6"?: number;
  "7"?: number;
  "8"?: number;
  "9"?: number;
  pact?: number;
}

export interface MaxSlotsByLevel {
  "1"?: number;
  "2"?: number;
  "3"?: number;
  "4"?: number;
  "5"?: number;
  "6"?: number;
  "7"?: number;
  "8"?: number;
  "9"?: number;
  pact?: number;
}

export interface ConcentrationState {
  spell_slug: string;
  spell_name: string;
  slot_level: number;
  started_at: string;
}

export type CasterType = "full" | "half" | "pact" | "third";

export interface CasterClass {
  slug: string;
  level: number;
  type: CasterType;
  ability: string;
  prepared: boolean;
  cantripsKnown: number;
  spellsKnown: number | "all";
  maxPrepared: number;
  ritualCasting: boolean;
  focus?: string;
}

export interface CasterInfo {
  isCaster: boolean;
  classes: CasterClass[];
  spellDc: number;
  spellAttackBonus: number;
}

export interface AddSpellPayload {
  content_id: string | null;
  name: string;
  class_slug: string;
  is_known?: boolean;
  is_prepared?: boolean;
  in_spellbook?: boolean;
  custom_data?: Record<string, unknown> | null;
}

export type SpellUpdate = Partial<
  Pick<CharacterSpell, "is_prepared" | "is_known" | "in_spellbook">
>;
```

- [ ] **Step 2: Modify `lib/types/character.ts` — refine spell_slots_used + add concentrating_on**

Read the current file first. Find the `CharacterState` interface. Add an import at the top:

```typescript
import type { SpellSlotsUsed, ConcentrationState } from "./spells";
```

Change the existing `spell_slots_used?: Record<string, number>;` line to:

```typescript
spell_slots_used?: SpellSlotsUsed;
concentrating_on?: ConcentrationState | null;
```

- [ ] **Step 3: Run build to verify types**

```
npm run build 2>&1 | tail -10
```
Expected: Clean build (no imports of the new types exist yet, so nothing else depends on them).

- [ ] **Step 4: Commit**

```bash
git add lib/types/spells.ts lib/types/character.ts
git commit -m "feat: add spell management types (CharacterSpell, slots, concentration, caster info)"
```

---

### Task 4: Multi-class Slot Table + Tests

**Why fourth:** Pure data + pure function. No dependencies beyond Task 3 types.

**Files:**
- Create: `lib/spells/multiclass-slots.ts`
- Create: `tests/spells/multiclass-slots.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/spells/multiclass-slots.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getMultiClassSlots } from "@/lib/spells/multiclass-slots";

describe("getMultiClassSlots", () => {
  it("returns empty object for level 0", () => {
    expect(getMultiClassSlots(0)).toEqual({});
  });

  it("returns level 1 slots for caster level 1", () => {
    expect(getMultiClassSlots(1)).toEqual({ "1": 2 });
  });

  it("returns level 3 slots correctly for caster level 3", () => {
    expect(getMultiClassSlots(3)).toEqual({ "1": 4, "2": 2 });
  });

  it("returns level 5 slots correctly for caster level 5", () => {
    expect(getMultiClassSlots(5)).toEqual({ "1": 4, "2": 3, "3": 2 });
  });

  it("returns level 9 slots correctly for caster level 9", () => {
    expect(getMultiClassSlots(9)).toEqual({ "1": 4, "2": 3, "3": 3, "4": 3, "5": 1 });
  });

  it("returns level 20 slots correctly for caster level 20", () => {
    expect(getMultiClassSlots(20)).toEqual({
      "1": 4, "2": 3, "3": 3, "4": 3, "5": 3,
      "6": 2, "7": 2, "8": 1, "9": 1,
    });
  });

  it("clamps levels above 20 to level 20", () => {
    expect(getMultiClassSlots(25)).toEqual(getMultiClassSlots(20));
  });

  it("returns empty object for negative levels", () => {
    expect(getMultiClassSlots(-1)).toEqual({});
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```
npx vitest run tests/spells/multiclass-slots.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

Create `lib/spells/multiclass-slots.ts`:

```typescript
import type { MaxSlotsByLevel } from "@/lib/types/spells";

/**
 * PHB p164 multiclass spellcaster table.
 * Rows are indexed by (casterLevel - 1). Each row is slots available at levels 1-9.
 * This table is also used for single-class casters (Wizard, Cleric, Druid, Bard, Sorcerer)
 * because their slot progression matches the full-caster column of the multiclass table.
 *
 * Half-casters (Paladin, Ranger) and pact-casters (Warlock) are NOT covered by this table.
 * - Paladin/Ranger contribute half their level (rounded down, no slots at L1) to casterLevel.
 * - Warlock uses its own slot progression from class data.
 */
const MULTICLASS_SLOT_TABLE: ReadonlyArray<readonly number[]> = [
  // L1
  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  // L2
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  // L3
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  // L4
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  // L5
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  // L6
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  // L7
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  // L8
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  // L9
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  // L10
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
  // L11
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  // L12
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  // L13
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  // L14
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  // L15
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  // L16
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  // L17
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  // L18
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  // L19
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  // L20
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/**
 * Returns the spell slots available at the given caster level (sum of spellcaster class levels
 * after the multiclass weighting: full caster = 1, half caster = 0.5 rounded down with no L1 slots).
 * Returns empty object for level 0 or negative; clamps to level 20 max.
 */
export function getMultiClassSlots(casterLevel: number): MaxSlotsByLevel {
  if (casterLevel <= 0) return {};
  const index = Math.min(casterLevel, 20) - 1;
  const row = MULTICLASS_SLOT_TABLE[index];
  const result: MaxSlotsByLevel = {};
  for (let i = 0; i < 9; i++) {
    const count = row[i];
    if (count > 0) {
      const key = String(i + 1) as "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
      result[key] = count;
    }
  }
  return result;
}
```

- [ ] **Step 4: Run tests — expect pass**

```
npx vitest run tests/spells/multiclass-slots.test.ts
```
Expected: 8/8 passed.

- [ ] **Step 5: Run full test suite**

```
npx vitest run 2>&1 | tail -5
```
Expected: 182 + 8 = 190 tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/spells/multiclass-slots.ts tests/spells/multiclass-slots.test.ts
git commit -m "feat: multiclass spellcaster slot table + tests"
```

---

### Task 5: Spell Helpers + Tests

**Why fifth:** Pure functions. Depends on Task 3 (types) and Task 4 (slot table).

**Files:**
- Create: `lib/spells/helpers.ts`
- Create: `tests/spells/helpers.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/spells/helpers.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  computeSpellDc,
  computeSpellAttackBonus,
  computeMaxPrepared,
  computeCasterLevel,
  resolveFeatureGrantedSpells,
} from "@/lib/spells/helpers";
import type { CasterClass } from "@/lib/types/spells";

function makeCasterClass(overrides: Partial<CasterClass>): CasterClass {
  return {
    slug: "wizard",
    level: 1,
    type: "full",
    ability: "intelligence",
    prepared: true,
    cantripsKnown: 3,
    spellsKnown: "all",
    maxPrepared: 4,
    ritualCasting: true,
    ...overrides,
  };
}

describe("computeSpellDc", () => {
  it("returns 8 + prof + ability mod", () => {
    // INT 16, prof +2 → DC = 8 + 2 + 3 = 13
    const caster = makeCasterClass({ ability: "intelligence" });
    expect(computeSpellDc(caster, { intelligence: 16 }, 2)).toBe(13);
  });

  it("handles low ability scores", () => {
    // INT 10, prof +2 → DC = 8 + 2 + 0 = 10
    const caster = makeCasterClass();
    expect(computeSpellDc(caster, { intelligence: 10 }, 2)).toBe(10);
  });

  it("handles high-level caster", () => {
    // INT 20, prof +6 (L17+) → DC = 8 + 6 + 5 = 19
    const caster = makeCasterClass();
    expect(computeSpellDc(caster, { intelligence: 20 }, 6)).toBe(19);
  });

  it("uses the caster's ability, not a fixed one", () => {
    // Cleric with WIS 14, prof +3 → DC = 8 + 3 + 2 = 13
    const cleric = makeCasterClass({ slug: "cleric", ability: "wisdom" });
    expect(computeSpellDc(cleric, { wisdom: 14, intelligence: 10 }, 3)).toBe(13);
  });
});

describe("computeSpellAttackBonus", () => {
  it("returns prof + ability mod", () => {
    // INT 16, prof +2 → attack = +5
    const caster = makeCasterClass();
    expect(computeSpellAttackBonus(caster, { intelligence: 16 }, 2)).toBe(5);
  });

  it("handles low prof bonus", () => {
    const caster = makeCasterClass();
    expect(computeSpellAttackBonus(caster, { intelligence: 14 }, 2)).toBe(4);
  });
});

describe("computeMaxPrepared", () => {
  it("cleric: ability mod + class level, minimum 1", () => {
    // WIS mod +3, Cleric L5 → 8 prepared
    expect(computeMaxPrepared("cleric", 5, 3)).toBe(8);
  });

  it("wizard: ability mod + class level, minimum 1", () => {
    // INT mod +4, Wizard L3 → 7 prepared
    expect(computeMaxPrepared("wizard", 3, 4)).toBe(7);
  });

  it("druid: ability mod + class level, minimum 1", () => {
    expect(computeMaxPrepared("druid", 10, 5)).toBe(15);
  });

  it("paladin: ability mod + floor(level/2), minimum 1", () => {
    // CHA mod +3, Paladin L5 → 3 + 2 = 5
    expect(computeMaxPrepared("paladin", 5, 3)).toBe(5);
  });

  it("paladin at L2 with low CHA: min 1", () => {
    // CHA mod +0, Paladin L2 → 0 + 1 = 1, min 1
    expect(computeMaxPrepared("paladin", 2, 0)).toBe(1);
  });

  it("paladin at L1 uses floor(1/2) = 0, min 1", () => {
    // Paladins get no prepared at L1 but we use min 1 as a floor
    expect(computeMaxPrepared("paladin", 1, 3)).toBe(3);
  });

  it("clamps to minimum 1 even for negative ability mods", () => {
    expect(computeMaxPrepared("cleric", 1, -2)).toBe(1);
  });
});

describe("computeCasterLevel", () => {
  it("full casters contribute full level", () => {
    // Wizard 5 → caster level 5
    expect(computeCasterLevel([
      { slug: "wizard", level: 5, type: "full" },
    ])).toBe(5);
  });

  it("half casters contribute floor(level/2) when level >= 2", () => {
    // Paladin 4 → 2
    expect(computeCasterLevel([
      { slug: "paladin", level: 4, type: "half" },
    ])).toBe(2);
  });

  it("half casters contribute 0 at level 1", () => {
    // Paladin 1 → 0 (no spells at L1)
    expect(computeCasterLevel([
      { slug: "paladin", level: 1, type: "half" },
    ])).toBe(0);
  });

  it("warlock does NOT contribute to multiclass caster level", () => {
    // Warlock 5 alone → 0 (pact is separate)
    expect(computeCasterLevel([
      { slug: "warlock", level: 5, type: "pact" },
    ])).toBe(0);
  });

  it("combines multiple casters correctly", () => {
    // Cleric 3 + Wizard 3 → 6
    expect(computeCasterLevel([
      { slug: "cleric", level: 3, type: "full" },
      { slug: "wizard", level: 3, type: "full" },
    ])).toBe(6);
  });

  it("combines full + half correctly", () => {
    // Cleric 3 + Paladin 4 → 3 + 2 = 5
    expect(computeCasterLevel([
      { slug: "cleric", level: 3, type: "full" },
      { slug: "paladin", level: 4, type: "half" },
    ])).toBe(5);
  });

  it("excludes non-casters (type null)", () => {
    // Cleric 3 + Fighter 2 → 3
    expect(computeCasterLevel([
      { slug: "cleric", level: 3, type: "full" },
      { slug: "fighter", level: 2, type: null as unknown as "full" },
    ])).toBe(3);
  });
});

describe("resolveFeatureGrantedSpells", () => {
  it("returns empty when no subclass spellcastingExtra", () => {
    const result = resolveFeatureGrantedSpells(
      [{ slug: "wizard", level: 3, subclass: "evocation" }],
      { evocation: { spellcastingExtra: null } },
    );
    expect(result).toEqual([]);
  });

  it("resolves tier spells at or below class level", () => {
    const result = resolveFeatureGrantedSpells(
      [{ slug: "cleric", level: 3, subclass: "life" }],
      {
        life: {
          spellcastingExtra: [
            { level: 1, spells: ["bless", "cure-wounds"] },
            { level: 3, spells: ["lesser-restoration", "spiritual-weapon"] },
            { level: 5, spells: ["beacon-of-hope", "revivify"] },
          ],
        },
      },
    );
    expect(result).toEqual([
      { spell_slug: "bless", class_slug: "cleric" },
      { spell_slug: "cure-wounds", class_slug: "cleric" },
      { spell_slug: "lesser-restoration", class_slug: "cleric" },
      { spell_slug: "spiritual-weapon", class_slug: "cleric" },
    ]);
  });

  it("excludes tiers above class level", () => {
    const result = resolveFeatureGrantedSpells(
      [{ slug: "cleric", level: 4, subclass: "life" }],
      {
        life: {
          spellcastingExtra: [
            { level: 1, spells: ["bless"] },
            { level: 5, spells: ["revivify"] },
          ],
        },
      },
    );
    expect(result).toEqual([{ spell_slug: "bless", class_slug: "cleric" }]);
  });

  it("handles multiple classes", () => {
    const result = resolveFeatureGrantedSpells(
      [
        { slug: "cleric", level: 3, subclass: "life" },
        { slug: "paladin", level: 5, subclass: "devotion" },
      ],
      {
        life: { spellcastingExtra: [{ level: 1, spells: ["bless"] }] },
        devotion: {
          spellcastingExtra: [
            { level: 3, spells: ["sanctuary"] },
            { level: 5, spells: ["zone-of-truth"] },
          ],
        },
      },
    );
    expect(result).toEqual([
      { spell_slug: "bless", class_slug: "cleric" },
      { spell_slug: "sanctuary", class_slug: "paladin" },
      { spell_slug: "zone-of-truth", class_slug: "paladin" },
    ]);
  });

  it("handles missing subclass data gracefully", () => {
    const result = resolveFeatureGrantedSpells(
      [{ slug: "cleric", level: 3, subclass: "life" }],
      {},
    );
    expect(result).toEqual([]);
  });

  it("skips classes without a subclass", () => {
    const result = resolveFeatureGrantedSpells(
      [{ slug: "cleric", level: 3, subclass: undefined }],
      { life: { spellcastingExtra: [{ level: 1, spells: ["bless"] }] } },
    );
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```
npx vitest run tests/spells/helpers.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helpers**

Create `lib/spells/helpers.ts`:

```typescript
import type { CasterClass, MaxSlotsByLevel } from "@/lib/types/spells";
import { getMultiClassSlots } from "@/lib/spells/multiclass-slots";

/**
 * Compute spell save DC: 8 + proficiency bonus + spellcasting ability mod.
 */
export function computeSpellDc(
  caster: CasterClass,
  abilityScores: Record<string, number>,
  proficiencyBonus: number,
): number {
  const abilityMod = Math.floor(((abilityScores[caster.ability] ?? 10) - 10) / 2);
  return 8 + proficiencyBonus + abilityMod;
}

/**
 * Compute spell attack bonus: proficiency bonus + spellcasting ability mod.
 */
export function computeSpellAttackBonus(
  caster: CasterClass,
  abilityScores: Record<string, number>,
  proficiencyBonus: number,
): number {
  const abilityMod = Math.floor(((abilityScores[caster.ability] ?? 10) - 10) / 2);
  return proficiencyBonus + abilityMod;
}

/**
 * Compute max prepared spells for prepared casters.
 * Paladin: ability mod + floor(level/2), min 1.
 * Cleric/Druid/Wizard: ability mod + class level, min 1.
 * Returns 0 for non-prepared casters (they don't prepare).
 */
export function computeMaxPrepared(
  classSlug: string,
  classLevel: number,
  abilityMod: number,
): number {
  if (classSlug === "paladin") {
    return Math.max(1, abilityMod + Math.floor(classLevel / 2));
  }
  return Math.max(1, abilityMod + classLevel);
}

/**
 * Compute the effective caster level for multiclass slot calculation.
 * - Full casters (Wizard, Cleric, Druid, Bard, Sorcerer): full class level
 * - Half casters (Paladin, Ranger): floor(classLevel / 2), 0 at level 1
 * - Pact casters (Warlock): 0 (their slots are separate)
 * - Third casters (Eldritch Knight, Arcane Trickster): floor(classLevel / 3) — not in SRD, deferred
 */
export function computeCasterLevel(
  classes: Array<{ slug: string; level: number; type: CasterClass["type"] | null }>,
): number {
  let total = 0;
  for (const c of classes) {
    if (!c.type) continue;
    if (c.type === "full") {
      total += c.level;
    } else if (c.type === "half") {
      if (c.level >= 2) total += Math.floor(c.level / 2);
    } else if (c.type === "third") {
      if (c.level >= 3) total += Math.floor(c.level / 3);
    }
    // pact contributes 0 to multiclass slots
  }
  return total;
}

/**
 * Compute max slots for a character.
 * - Warlock pact slots come from warlock class data (separate from regular pool)
 * - Non-warlock slots come from the multiclass spellcaster table with caster level
 *   summed from all full/half/third casters
 */
export function computeMaxSlots(
  classes: Array<{ slug: string; level: number; type: CasterClass["type"] | null }>,
  classData: Record<string, { levels?: Array<{ spellcasting?: { spell_slots?: number[] } | null }> }>,
): MaxSlotsByLevel {
  const result: MaxSlotsByLevel = {};

  // Warlock pact slots
  const warlock = classes.find((c) => c.slug === "warlock");
  if (warlock) {
    const warlockData = classData["warlock"];
    const slots = warlockData?.levels?.[warlock.level - 1]?.spellcasting?.spell_slots;
    if (slots) {
      // Warlock pact slots: one slot level populated at a time, count at that level
      let total = 0;
      for (const s of slots) total += s;
      if (total > 0) result.pact = total;
    }
  }

  // Non-warlock: multiclass caster level → slot table
  const casterLevel = computeCasterLevel(classes);
  if (casterLevel > 0) {
    Object.assign(result, getMultiClassSlots(casterLevel));
  }

  return result;
}

/**
 * Resolve feature-granted spells (always-prepared from class/subclass features).
 * Reads each class's subclass data.spellcastingExtra and returns entries at or below class level.
 */
export function resolveFeatureGrantedSpells(
  classes: Array<{ slug: string; level: number; subclass?: string }>,
  subclassData: Record<string, { spellcastingExtra?: Array<{ level: number; spells: string[] }> | null }>,
): Array<{ spell_slug: string; class_slug: string }> {
  const result: Array<{ spell_slug: string; class_slug: string }> = [];
  for (const cls of classes) {
    if (!cls.subclass) continue;
    const sub = subclassData[cls.subclass];
    const extras = sub?.spellcastingExtra;
    if (!extras) continue;
    for (const tier of extras) {
      if (tier.level <= cls.level) {
        for (const slug of tier.spells) {
          result.push({ spell_slug: slug, class_slug: cls.slug });
        }
      }
    }
  }
  return result;
}
```

- [ ] **Step 4: Run tests — expect pass**

```
npx vitest run tests/spells/helpers.test.ts
```
Expected: all ~20 tests pass.

- [ ] **Step 5: Run full suite**

```
npx vitest run 2>&1 | tail -5
```
Expected: 190 + 20 = 210 tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/spells/helpers.ts tests/spells/helpers.test.ts
git commit -m "feat: spell helpers (DC, attack bonus, maxPrepared, caster level, feature spells)"
```

---

### Task 6: Supabase Spell CRUD + Tests

**Why sixth:** Data access layer. Depends on Task 1 (table) and Task 3 (types).

**Files:**
- Create: `lib/supabase/spells.ts`
- Create: `tests/supabase/spells.test.ts`

- [ ] **Step 1: Implement the CRUD module**

Create `lib/supabase/spells.ts`:

```typescript
import { createClient } from "@/lib/supabase/client";
import type { CharacterSpell, AddSpellPayload, SpellUpdate } from "@/lib/types/spells";

const SPELLS_SELECT =
  "*, content_definitions(id, name, slug, content_type, data, effects)";

export async function getSpellsForCharacter(
  characterId: string,
): Promise<CharacterSpell[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("character_spells")
    .select(SPELLS_SELECT)
    .eq("character_id", characterId)
    .order("name");

  if (error) {
    console.error("[getSpellsForCharacter] Error:", error.message);
    return [];
  }
  return (data ?? []) as CharacterSpell[];
}

export async function addCharacterSpell(
  characterId: string,
  payload: AddSpellPayload,
): Promise<CharacterSpell | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("character_spells")
    .insert({
      character_id: characterId,
      content_id: payload.content_id ?? null,
      name: payload.name,
      class_slug: payload.class_slug,
      is_known: payload.is_known ?? false,
      is_prepared: payload.is_prepared ?? false,
      in_spellbook: payload.in_spellbook ?? false,
      source: "selection",
      custom_data: payload.custom_data ?? null,
    })
    .select(SPELLS_SELECT)
    .single();

  if (error) {
    console.error("[addCharacterSpell] Error:", error.message);
    return null;
  }
  return data as CharacterSpell;
}

export async function updateCharacterSpell(
  spellId: string,
  updates: SpellUpdate,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("character_spells")
    .update(updates)
    .eq("id", spellId);

  if (error) {
    console.error("[updateCharacterSpell] Error:", error.message);
  }
}

export async function removeCharacterSpell(spellId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("character_spells")
    .delete()
    .eq("id", spellId);

  if (error) {
    console.error("[removeCharacterSpell] Error:", error.message);
  }
}

export interface SearchSpellsOptions {
  classSlug?: string; // filter to spells available to this class
  level?: number; // exact level filter; use 0 for cantrips
  school?: string;
  ritualOnly?: boolean;
  concentrationOnly?: boolean;
}

export async function searchSpells(
  systemId: string,
  query: string,
  options?: SearchSpellsOptions,
): Promise<
  Array<{
    id: string;
    name: string;
    slug: string;
    content_type: string;
    data: Record<string, unknown>;
  }>
> {
  const supabase = createClient();
  let builder = supabase
    .from("content_definitions")
    .select("id, name, slug, content_type, data")
    .eq("system_id", systemId)
    .eq("content_type", "spell")
    .eq("scope", "platform")
    .ilike("name", `%${query}%`)
    .order("name")
    .limit(50);

  if (options?.classSlug) {
    // Filter to spells where data.classes array contains classSlug
    builder = builder.contains("data->classes", JSON.stringify([options.classSlug]));
  }
  if (options?.level != null) {
    builder = builder.eq("data->>level", String(options.level));
  }
  if (options?.school) {
    builder = builder.eq("data->>school", options.school);
  }
  if (options?.ritualOnly) {
    builder = builder.eq("data->>ritual", "true");
  }
  if (options?.concentrationOnly) {
    builder = builder.eq("data->>concentration", "true");
  }

  const { data, error } = await builder;
  if (error) {
    console.error("[searchSpells] Error:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Idempotently ensures `character_spells` has a row for each always-prepared spell
 * that the character's class/subclass features grant at the current level.
 * Removes rows whose source='feature' but are no longer in the resolved set
 * (e.g., subclass changed).
 */
export async function syncAlwaysPreparedSpells(
  characterId: string,
  granted: Array<{ spell_slug: string; class_slug: string }>,
  spellIdBySlug: Record<string, string>,
): Promise<void> {
  const supabase = createClient();

  // Load existing feature-sourced rows.
  const { data: existingRows } = await supabase
    .from("character_spells")
    .select("id, class_slug, content_id")
    .eq("character_id", characterId)
    .eq("source", "feature");

  const existing = (existingRows ?? []) as Array<{
    id: string;
    class_slug: string;
    content_id: string | null;
  }>;

  // Build the "desired" set using content IDs.
  const desired = new Set<string>();
  const toInsert: Array<{
    character_id: string;
    content_id: string;
    name: string;
    class_slug: string;
    is_prepared: boolean;
    always_prepared: boolean;
    source: string;
  }> = [];

  // Load spell names for the desired slugs (we need name for the row).
  const slugs = Array.from(new Set(granted.map((g) => g.spell_slug)));
  const { data: spellRows } = await supabase
    .from("content_definitions")
    .select("id, slug, name")
    .in("slug", slugs)
    .eq("content_type", "spell")
    .eq("scope", "platform");

  const nameBySlug: Record<string, string> = {};
  for (const r of spellRows ?? []) {
    nameBySlug[r.slug] = r.name;
    spellIdBySlug[r.slug] = r.id;
  }

  for (const g of granted) {
    const contentId = spellIdBySlug[g.spell_slug];
    if (!contentId) continue; // spell not in DB; skip silently
    const key = `${contentId}:${g.class_slug}`;
    desired.add(key);
    const alreadyHave = existing.some(
      (e) => e.content_id === contentId && e.class_slug === g.class_slug,
    );
    if (!alreadyHave) {
      toInsert.push({
        character_id: characterId,
        content_id: contentId,
        name: nameBySlug[g.spell_slug] ?? g.spell_slug,
        class_slug: g.class_slug,
        is_prepared: true,
        always_prepared: true,
        source: "feature",
      });
    }
  }

  // Insert new ones.
  if (toInsert.length > 0) {
    await supabase.from("character_spells").insert(toInsert);
  }

  // Delete stale ones (feature-sourced, no longer granted).
  const staleIds = existing
    .filter((e) => {
      if (!e.content_id) return false;
      return !desired.has(`${e.content_id}:${e.class_slug}`);
    })
    .map((e) => e.id);
  if (staleIds.length > 0) {
    await supabase.from("character_spells").delete().in("id", staleIds);
  }
}
```

- [ ] **Step 2: Write tests**

Create `tests/supabase/spells.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.fn();
const selectMock = vi.fn();
const insertMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
const eqMock = vi.fn();
const inMock = vi.fn();
const orderMock = vi.fn();
const limitMock = vi.fn();
const ilikeMock = vi.fn();
const containsMock = vi.fn();
const singleMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: (table: string) => fromMock(table) }),
}));

function makeChain() {
  return {
    select: selectMock,
    insert: insertMock,
    update: updateMock,
    delete: deleteMock,
    eq: eqMock,
    in: inMock,
    order: orderMock,
    limit: limitMock,
    ilike: ilikeMock,
    contains: containsMock,
    single: singleMock,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  const chain = makeChain();
  selectMock.mockReturnValue(chain);
  insertMock.mockReturnValue(chain);
  updateMock.mockReturnValue(chain);
  deleteMock.mockReturnValue(chain);
  eqMock.mockReturnValue(chain);
  inMock.mockReturnValue(chain);
  orderMock.mockReturnValue(chain);
  limitMock.mockResolvedValue({ data: [], error: null });
  ilikeMock.mockReturnValue(chain);
  containsMock.mockReturnValue(chain);
  singleMock.mockResolvedValue({ data: {}, error: null });
  fromMock.mockReturnValue(chain);
});

describe("getSpellsForCharacter", () => {
  it("queries character_spells with join and character_id filter", async () => {
    orderMock.mockResolvedValueOnce({ data: [], error: null });
    const { getSpellsForCharacter } = await import("@/lib/supabase/spells");
    await getSpellsForCharacter("char-1");
    expect(fromMock).toHaveBeenCalledWith("character_spells");
    expect(selectMock).toHaveBeenCalledWith(
      expect.stringContaining("content_definitions"),
    );
    expect(eqMock).toHaveBeenCalledWith("character_id", "char-1");
  });
});

describe("addCharacterSpell", () => {
  it("inserts with character_id, class_slug, and selection source", async () => {
    singleMock.mockResolvedValueOnce({
      data: {
        id: "spell-1",
        character_id: "char-1",
        content_id: "c1",
        name: "Fireball",
        class_slug: "wizard",
      },
      error: null,
    });
    const { addCharacterSpell } = await import("@/lib/supabase/spells");
    await addCharacterSpell("char-1", {
      content_id: "c1",
      name: "Fireball",
      class_slug: "wizard",
      is_known: true,
      is_prepared: true,
    });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        character_id: "char-1",
        content_id: "c1",
        name: "Fireball",
        class_slug: "wizard",
        is_known: true,
        is_prepared: true,
        source: "selection",
      }),
    );
  });
});

describe("updateCharacterSpell", () => {
  it("updates the spell with patch and eq by id", async () => {
    eqMock.mockResolvedValueOnce({ error: null });
    const { updateCharacterSpell } = await import("@/lib/supabase/spells");
    await updateCharacterSpell("spell-1", { is_prepared: true });
    expect(updateMock).toHaveBeenCalledWith({ is_prepared: true });
    expect(eqMock).toHaveBeenCalledWith("id", "spell-1");
  });
});

describe("removeCharacterSpell", () => {
  it("deletes the spell by id", async () => {
    eqMock.mockResolvedValueOnce({ error: null });
    const { removeCharacterSpell } = await import("@/lib/supabase/spells");
    await removeCharacterSpell("spell-1");
    expect(deleteMock).toHaveBeenCalled();
    expect(eqMock).toHaveBeenCalledWith("id", "spell-1");
  });
});

describe("searchSpells", () => {
  it("filters by class, level, and platform scope", async () => {
    const { searchSpells } = await import("@/lib/supabase/spells");
    await searchSpells("sys-1", "fire", { classSlug: "wizard", level: 3 });
    expect(fromMock).toHaveBeenCalledWith("content_definitions");
    expect(eqMock).toHaveBeenCalledWith("system_id", "sys-1");
    expect(eqMock).toHaveBeenCalledWith("content_type", "spell");
    expect(eqMock).toHaveBeenCalledWith("scope", "platform");
    expect(eqMock).toHaveBeenCalledWith("data->>level", "3");
    expect(ilikeMock).toHaveBeenCalledWith("name", "%fire%");
    expect(containsMock).toHaveBeenCalledWith("data->classes", JSON.stringify(["wizard"]));
  });
});
```

- [ ] **Step 3: Run tests**

```
npx vitest run tests/supabase/spells.test.ts
```
Expected: 5/5 pass.

- [ ] **Step 4: Run full suite**

```
npx vitest run 2>&1 | tail -5
```
Expected: 210 + 5 = 215 tests pass.

- [ ] **Step 5: Run build**

```
npm run build 2>&1 | tail -5
```
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/spells.ts tests/supabase/spells.test.ts
git commit -m "feat: spell CRUD helpers (get, add, update, remove, search, sync always-prepared)"
```

---

### Task 7: Extend CharacterContext with Spells

**Why seventh:** Now that we have helpers and CRUD, wire them into the provider. Every UI component downstream depends on this.

**Files:**
- Modify: `lib/character/character-context.tsx`

This is a surgical modification to an existing file. Follow the `useInventory` pattern exactly.

- [ ] **Step 1: Read the current file**

Read `lib/character/character-context.tsx` in full. It's ~326 lines. Understand:
- The `CharacterContextValue` interface
- `CharacterProviderProps`
- The inventory state/handlers pattern
- How `useInventory` is exported

- [ ] **Step 2: Add spell-related imports at top**

Add these imports after the existing inventory imports (around line 20):

```typescript
import type {
  CharacterSpell,
  AddSpellPayload,
  SpellUpdate,
  SpellSlotsUsed,
  MaxSlotsByLevel,
  CasterInfo,
  CasterClass,
  ConcentrationState,
} from "@/lib/types/spells";
import {
  addCharacterSpell,
  updateCharacterSpell,
  removeCharacterSpell,
} from "@/lib/supabase/spells";
import {
  computeSpellDc,
  computeSpellAttackBonus,
  computeMaxPrepared,
  computeMaxSlots,
} from "@/lib/spells/helpers";
```

- [ ] **Step 3: Add `ClassContentData` prop type near the top**

Add this type before `CharacterContextValue`:

```typescript
export type ClassContentData = Record<
  string,
  {
    slug: string;
    data: {
      spellcasting?: {
        ability?: string;
        type?: CasterClass["type"];
        focus?: string;
        ritual_casting?: boolean;
      } | null;
      spellcastingKnown?: {
        cantrips?: number[];
        spells?: number[] | "all";
        prepared?: boolean;
      };
      levels?: Array<{
        spellcasting?: { cantrips_known?: number; spell_slots?: number[] } | null;
      }>;
    };
  }
>;
```

- [ ] **Step 4: Extend `CharacterContextValue`**

Add these fields after the existing inventory fields in the interface:

```typescript
// Spells
spells: CharacterSpell[];
slotState: SpellSlotsUsed;
maxSlots: MaxSlotsByLevel;
casterInfo: CasterInfo;
concentration: ConcentrationState | null;
addSpell: (payload: AddSpellPayload) => Promise<void>;
updateSpell: (id: string, updates: SpellUpdate) => Promise<void>;
removeSpell: (id: string) => Promise<void>;
setConcentration: (spell: Omit<ConcentrationState, "started_at"> | null) => Promise<void>;
```

- [ ] **Step 5: Extend `CharacterProviderProps`**

Add these fields:

```typescript
initialSpells: CharacterSpell[];
classData: ClassContentData;
```

- [ ] **Step 6: Add spell state + handlers inside `CharacterProvider`**

Inside the component body, after the existing inventory state/handlers, add:

```typescript
// --- Spells ---
const [spells, setSpells] = useState<CharacterSpell[]>(initialSpells);

const addSpell = useCallback(
  async (payload: AddSpellPayload) => {
    const newSpell = await addCharacterSpell(character.id, payload);
    if (newSpell) {
      setSpells((prev) => [...prev, newSpell]);
    }
  },
  [character.id],
);

const updateSpell = useCallback(
  async (id: string, updates: SpellUpdate) => {
    await updateCharacterSpell(id, updates);
    setSpells((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  },
  [],
);

const removeSpell = useCallback(
  async (id: string) => {
    await removeCharacterSpell(id);
    setSpells((prev) => prev.filter((s) => s.id !== id));
  },
  [],
);

const setConcentration = useCallback(
  async (spell: Omit<ConcentrationState, "started_at"> | null) => {
    if (!spell) {
      await patchState({ concentrating_on: null });
    } else {
      await patchState({
        concentrating_on: {
          ...spell,
          started_at: new Date().toISOString(),
        },
      });
    }
  },
  [patchState],
);

// --- Derived caster info ---
const casterInfo = useMemo<CasterInfo>(() => {
  const classChoices =
    (character.choices as { classes?: Array<{ slug: string; level: number; subclass?: string }> })
      ?.classes ?? [];

  const profBonus = Number(evalResult.computed?.proficiency_bonus ?? 2);
  const abilityScores = (evalResult.stats ?? {}) as Record<string, number>;

  const classes: CasterClass[] = [];
  for (const cls of classChoices) {
    const cd = classData[cls.slug];
    const sc = cd?.data?.spellcasting;
    if (!sc || !sc.type) continue;

    const ability = sc.ability ?? "intelligence";
    const abilityMod = Math.floor(((abilityScores[ability] ?? 10) - 10) / 2);
    const prepared = cd.data.spellcastingKnown?.prepared ?? false;
    const cantripsArr = cd.data.spellcastingKnown?.cantrips ?? [];
    const knownArr = cd.data.spellcastingKnown?.spells ?? "all";
    const cantripsKnown = cantripsArr[cls.level - 1] ?? 0;
    const spellsKnown: number | "all" =
      knownArr === "all" ? "all" : knownArr[cls.level - 1] ?? 0;

    classes.push({
      slug: cls.slug,
      level: cls.level,
      type: sc.type,
      ability,
      prepared,
      cantripsKnown,
      spellsKnown,
      maxPrepared: prepared ? computeMaxPrepared(cls.slug, cls.level, abilityMod) : 0,
      ritualCasting: sc.ritual_casting ?? false,
      focus: sc.focus,
    });
  }

  // Spell DC and attack: highest across classes
  let spellDc = 0;
  let spellAttackBonus = 0;
  for (const c of classes) {
    const dc = computeSpellDc(c, abilityScores, profBonus);
    const atk = computeSpellAttackBonus(c, abilityScores, profBonus);
    if (dc > spellDc) spellDc = dc;
    if (atk > spellAttackBonus) spellAttackBonus = atk;
  }

  return {
    isCaster: classes.length > 0,
    classes,
    spellDc,
    spellAttackBonus,
  };
}, [character.choices, classData, evalResult]);

const maxSlots = useMemo<MaxSlotsByLevel>(() => {
  const classChoices =
    (character.choices as { classes?: Array<{ slug: string; level: number; subclass?: string }> })
      ?.classes ?? [];
  const forCalc = classChoices.map((c) => {
    const cd = classData[c.slug];
    const type = cd?.data?.spellcasting?.type ?? null;
    return { slug: c.slug, level: c.level, type };
  });
  return computeMaxSlots(forCalc, classData);
}, [character.choices, classData]);

const slotState = (state.spell_slots_used ?? {}) as SpellSlotsUsed;
const concentration = (state.concentrating_on ?? null) as ConcentrationState | null;
```

- [ ] **Step 7: Add the new fields to the value object returned from the provider**

Find the existing `const value: CharacterContextValue = { ... }` object. Add after the inventory fields:

```typescript
spells,
slotState,
maxSlots,
casterInfo,
concentration,
addSpell,
updateSpell,
removeSpell,
setConcentration,
```

- [ ] **Step 8: Add the `useSpells` hook export at the bottom of the file**

After the existing `useInventory` export:

```typescript
export function useSpells() {
  const ctx = useCharacterContext();
  return {
    spells: ctx.spells,
    slotState: ctx.slotState,
    maxSlots: ctx.maxSlots,
    casterInfo: ctx.casterInfo,
    concentration: ctx.concentration,
    addSpell: ctx.addSpell,
    updateSpell: ctx.updateSpell,
    removeSpell: ctx.removeSpell,
    setConcentration: ctx.setConcentration,
  };
}
```

- [ ] **Step 9: Run build**

```
npm run build 2>&1 | tail -15
```
Expected: will fail because `CharacterPageClient` doesn't pass the new props yet. That's fine — Task 8 adds them.

- [ ] **Step 10: Run test suite**

```
npx vitest run 2>&1 | tail -10
```
Expected: Still 215 passing if the types compile at the module level (but build TypeScript may still fail). If any test fails because of a required prop in a mocked context that's used by a test, STOP and report.

- [ ] **Step 11: Commit**

```bash
git add lib/character/character-context.tsx
git commit -m "feat: add spells to CharacterContext (useSpells hook, caster info, slot state)"
```

---

### Task 8: Wire Server Page + Client Component

**Why eighth:** Thread the new initialSpells + classData from server to provider. Fixes the build break from Task 7.

**Files:**
- Modify: `app/(app)/characters/[id]/page.tsx`
- Modify: `components/character/character-page-client.tsx`

- [ ] **Step 1: Modify the server page to fetch spells + class data + run always-prepared sync**

Read `app/(app)/characters/[id]/page.tsx`. Find the inventory fetch block (around line 46). Add after it:

```typescript
// Fetch spells for this character.
const { data: spellRows } = await supabase
  .from("character_spells")
  .select("*, content_definitions(id, name, slug, content_type, data, effects)")
  .eq("character_id", id)
  .order("name");

// Fetch class content for caster classes to derive spellcasting metadata.
const classChoices =
  ((character.choices as { classes?: Array<{ slug: string; level: number; subclass?: string }> })
    ?.classes) ?? [];
const classSlugs = classChoices.map((c) => c.slug);
const subclassSlugs = classChoices
  .map((c) => c.subclass)
  .filter((s): s is string => !!s);

const [classContentRes, subclassContentRes] = await Promise.all([
  classSlugs.length > 0
    ? supabase
        .from("content_definitions")
        .select("slug, data")
        .eq("system_id", character.system_id)
        .eq("content_type", "class")
        .in("slug", classSlugs)
    : Promise.resolve({ data: [] as Array<{ slug: string; data: Record<string, unknown> }> }),
  subclassSlugs.length > 0
    ? supabase
        .from("content_definitions")
        .select("slug, data")
        .eq("system_id", character.system_id)
        .eq("content_type", "subclass")
        .in("slug", subclassSlugs)
    : Promise.resolve({ data: [] as Array<{ slug: string; data: Record<string, unknown> }> }),
]);

const classData: Record<string, { slug: string; data: Record<string, unknown> }> = {};
for (const row of classContentRes.data ?? []) {
  classData[row.slug] = row;
}

const subclassData: Record<string, { spellcastingExtra?: Array<{ level: number; spells: string[] }> | null }> = {};
for (const row of subclassContentRes.data ?? []) {
  const extras = (row.data as Record<string, unknown>)?.spellcastingExtra;
  subclassData[row.slug] = {
    spellcastingExtra: Array.isArray(extras)
      ? (extras as Array<{ level: number; spells: string[] }>)
      : null,
  };
}

// Run always-prepared sync.
if (classChoices.length > 0) {
  const { resolveFeatureGrantedSpells } = await import("@/lib/spells/helpers");
  const { syncAlwaysPreparedSpells } = await import("@/lib/supabase/spells");
  const granted = resolveFeatureGrantedSpells(classChoices, subclassData);
  if (granted.length > 0) {
    await syncAlwaysPreparedSpells(id, granted, {});
  }
}

// Re-fetch spells after sync so the client gets the feature-granted rows.
const { data: spellRowsAfterSync } = await supabase
  .from("character_spells")
  .select("*, content_definitions(id, name, slug, content_type, data, effects)")
  .eq("character_id", id)
  .order("name");
```

Then find the `return <CharacterPageClient ... />` at the end of the function. Add these two new props:

```typescript
initialSpells={spellRowsAfterSync ?? spellRows ?? []}
classData={classData}
```

- [ ] **Step 2: Modify `CharacterPageClient` to accept and pass the new props**

Read `components/character/character-page-client.tsx`. Find `CharacterPageClientProps`. Add these props:

```typescript
initialSpells: CharacterSpell[];
classData: ClassContentData;
```

Add the imports:

```typescript
import type { CharacterSpell } from "@/lib/types/spells";
import type { ClassContentData } from "@/lib/character/character-context";
```

Find where `CharacterProvider` is rendered. Add `initialSpells` and `classData` to its props:

```typescript
<CharacterProvider
  ...existing props...
  initialSpells={initialSpells}
  classData={classData}
>
```

Also add `initialSpells` and `classData` to the destructuring of `props` at the top of the component.

- [ ] **Step 3: Run build**

```
npm run build 2>&1 | tail -15
```
Expected: clean.

- [ ] **Step 4: Run tests**

```
npx vitest run 2>&1 | tail -5
```
Expected: 215 passing.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/characters/[id]/page.tsx" components/character/character-page-client.tsx
git commit -m "feat: fetch spells and class data server-side, thread to CharacterProvider"
```

---

### Task 9: Small UI Components (header, slot tracker, concentration badge)

**Why ninth:** The three small leaf components. No dependencies on each other; each consumes the context directly.

**Files:**
- Create: `components/sheet/spells/spell-header.tsx`
- Create: `components/sheet/spells/slot-tracker.tsx`
- Create: `components/sheet/spells/concentration-badge.tsx`

- [ ] **Step 1: Create `spell-header.tsx`**

```typescript
"use client";

import { useSpells } from "@/lib/character/character-context";

export function SpellHeader() {
  const { casterInfo, spells } = useSpells();
  if (!casterInfo.isCaster) return null;

  const cantripsKnown = spells.filter(
    (s) => (s.content_definitions?.data?.level ?? 1) === 0,
  ).length;
  const preparedCount = spells.filter((s) => s.is_prepared).length;
  const totalCantripsAllowed = casterInfo.classes.reduce(
    (sum, c) => sum + c.cantripsKnown,
    0,
  );
  const totalPrepared = casterInfo.classes.reduce(
    (sum, c) => sum + (c.prepared ? c.maxPrepared : 0),
    0,
  );

  const abilityLabel = casterInfo.classes
    .map((c) => c.ability.charAt(0).toUpperCase() + c.ability.slice(1))
    .join(", ");

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 space-y-1">
      <p className="text-xs text-muted-foreground">Spellcasting Ability</p>
      <p className="text-sm font-medium">{abilityLabel}</p>
      <div className="flex items-center gap-4 text-sm pt-1">
        <span>
          Save DC <span className="font-semibold">{casterInfo.spellDc}</span>
        </span>
        <span>
          Attack{" "}
          <span className="font-semibold">
            {casterInfo.spellAttackBonus >= 0 ? "+" : ""}
            {casterInfo.spellAttackBonus}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
        <span>
          Cantrips: {cantripsKnown}/{totalCantripsAllowed}
        </span>
        {totalPrepared > 0 && (
          <span>
            Prepared: {preparedCount}/{totalPrepared}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `slot-tracker.tsx`**

```typescript
"use client";

import { cn } from "@/lib/utils";
import { useSpells } from "@/lib/character/character-context";

type SlotKey = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "pact";

const SLOT_KEYS: SlotKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

function SlotDots({ total, used }: { total: number; used: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "inline-block size-2 rounded-full",
            i < total - used
              ? "bg-primary"
              : "border border-primary/40 bg-transparent",
          )}
        />
      ))}
    </span>
  );
}

function levelLabel(key: string): string {
  if (key === "pact") return "Pact";
  const n = parseInt(key, 10);
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

export function SlotTracker() {
  const { maxSlots, slotState } = useSpells();

  const visibleKeys: SlotKey[] = [];
  for (const k of SLOT_KEYS) {
    if ((maxSlots[k] ?? 0) > 0) visibleKeys.push(k);
  }
  if ((maxSlots.pact ?? 0) > 0) visibleKeys.push("pact");

  if (visibleKeys.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Slots
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {visibleKeys.map((k) => {
          const total = maxSlots[k] ?? 0;
          const used = slotState[k] ?? 0;
          return (
            <div key={k} className="flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground w-10">{levelLabel(k)}</span>
              <SlotDots total={total} used={used} />
              <span className="text-xs text-muted-foreground tabular-nums">
                {total - used}/{total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `concentration-badge.tsx`**

```typescript
"use client";

import { X, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSpells } from "@/lib/character/character-context";

export function ConcentrationBadge() {
  const { concentration, setConcentration } = useSpells();
  if (!concentration) return null;

  return (
    <div className="flex items-center gap-2 rounded-full bg-purple-950/60 border border-purple-500/50 px-3 py-1 text-xs text-purple-200">
      <Brain className="size-3.5" />
      <span>
        Concentrating: <span className="font-medium">{concentration.spell_name}</span>{" "}
        ({concentration.slot_level === 0 ? "cantrip" : `${concentration.slot_level} slot`})
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-5 hover:bg-purple-800/50"
        onClick={() => setConcentration(null)}
        aria-label="End concentration"
      >
        <X className="size-3" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Run build**

```
npm run build 2>&1 | tail -5
```
Expected: clean. (The components are not yet rendered anywhere, so nothing consumes them.)

- [ ] **Step 5: Commit**

```bash
git add components/sheet/spells/
git commit -m "feat: SpellHeader, SlotTracker, ConcentrationBadge components"
```

---

### Task 10: `spell-row.tsx`

**Why tenth:** Main spell display. Rendered inside level sections.

**Files:**
- Create: `components/sheet/spells/spell-row.tsx`

- [ ] **Step 1: Implement the component**

```typescript
"use client";

import { useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CharacterSpell } from "@/lib/types/spells";

interface SpellRowProps {
  spell: CharacterSpell;
  /** Whether this character's class uses prepared spells (and this spell's class is a prepared caster). */
  allowPrepareToggle: boolean;
  onTogglePrepared: () => void;
  onRemove: () => void;
}

function formatSchool(school: string): string {
  if (!school) return "";
  return school.charAt(0).toUpperCase() + school.slice(1);
}

function formatComponents(components: string[] | undefined): string {
  if (!components || components.length === 0) return "";
  return components.join(", ");
}

export function SpellRow({
  spell,
  allowPrepareToggle,
  onTogglePrepared,
  onRemove,
}: SpellRowProps) {
  const [expanded, setExpanded] = useState(false);
  const data = (spell.content_definitions?.data ?? {}) as {
    level?: number;
    school?: string;
    components?: string[];
    material?: string;
    casting_time?: string;
    range?: string;
    duration?: string;
    concentration?: boolean;
    ritual?: boolean;
    description?: string;
    higher_level?: string;
  };

  const isCantrip = (data.level ?? 0) === 0;
  const school = formatSchool(data.school ?? "");
  const components = formatComponents(data.components);

  return (
    <div className="rounded border border-border/50 overflow-hidden text-sm">
      <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent/30">
        {allowPrepareToggle && !spell.always_prepared && !isCantrip && (
          <button
            type="button"
            onClick={onTogglePrepared}
            className={cn(
              "size-4 rounded border shrink-0 flex items-center justify-center text-[10px]",
              spell.is_prepared
                ? "bg-primary border-primary text-primary-foreground"
                : "border-muted-foreground/50 hover:border-primary",
            )}
            title={spell.is_prepared ? "Unprepare" : "Prepare"}
          >
            {spell.is_prepared && "\u2713"}
          </button>
        )}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 min-w-0 text-left flex items-center gap-2"
        >
          <ChevronDown
            className={cn("size-3 text-muted-foreground transition-transform", expanded && "rotate-180")}
          />
          <span className="truncate font-medium">{spell.name}</span>
          {school && <span className="text-xs text-muted-foreground shrink-0">{school}</span>}
          {components && <span className="text-xs text-muted-foreground shrink-0">{components}</span>}
          {spell.always_prepared && (
            <Badge variant="secondary" className="text-[9px] shrink-0">
              Always
            </Badge>
          )}
          {data.ritual && (
            <Badge variant="outline" className="text-[9px] shrink-0">
              R
            </Badge>
          )}
          {data.concentration && (
            <Badge variant="outline" className="text-[9px] shrink-0">
              C
            </Badge>
          )}
        </button>

        {!spell.always_prepared && (
          <button
            type="button"
            onClick={onRemove}
            className="size-5 rounded text-muted-foreground hover:text-destructive transition-colors shrink-0"
            aria-label="Remove spell"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="border-t border-border/50 bg-card/30 px-3 py-2 space-y-1.5 text-xs">
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            {data.casting_time && (
              <div>
                <span className="text-muted-foreground">Casting time: </span>
                {data.casting_time}
              </div>
            )}
            {data.range && (
              <div>
                <span className="text-muted-foreground">Range: </span>
                {data.range}
              </div>
            )}
            {data.duration && (
              <div>
                <span className="text-muted-foreground">Duration: </span>
                {data.duration}
              </div>
            )}
            {data.material && (
              <div>
                <span className="text-muted-foreground">Material: </span>
                {data.material}
              </div>
            )}
          </div>
          {data.description && (
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {data.description}
            </p>
          )}
          {data.higher_level && (
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
              <span className="font-medium text-foreground">At Higher Levels: </span>
              {data.higher_level}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run build**

```
npm run build 2>&1 | tail -5
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/sheet/spells/spell-row.tsx
git commit -m "feat: SpellRow component with prepare toggle, badges, expandable details"
```

---

### Task 11: `spell-level-section.tsx`

**Why eleventh:** Groups spell rows per level. Follows the same collapsible pattern as `inventory-section.tsx`.

**Files:**
- Create: `components/sheet/spells/spell-level-section.tsx`

- [ ] **Step 1: Implement the component**

```typescript
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CharacterSpell } from "@/lib/types/spells";
import { SpellRow } from "@/components/sheet/spells/spell-row";

interface SpellLevelSectionProps {
  level: number;
  spells: CharacterSpell[];
  maxSlots?: number;
  usedSlots?: number;
  isPactSection?: boolean;
  defaultOpen?: boolean;
  /** Whether to show prepare checkboxes on non-always-prepared, non-cantrip spells. */
  allowPrepareToggle: boolean;
  onTogglePrepared: (spell: CharacterSpell) => void;
  onRemove: (spell: CharacterSpell) => void;
}

function levelTitle(level: number, isPact: boolean): string {
  if (level === 0) return "Cantrips";
  if (isPact) return `Pact Slots (level ${level})`;
  if (level === 1) return "1st Level";
  if (level === 2) return "2nd Level";
  if (level === 3) return "3rd Level";
  return `${level}th Level`;
}

export function SpellLevelSection({
  level,
  spells,
  maxSlots,
  usedSlots,
  isPactSection = false,
  defaultOpen = false,
  allowPrepareToggle,
  onTogglePrepared,
  onRemove,
}: SpellLevelSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const slotSummary =
    maxSlots && maxSlots > 0
      ? ` (${(usedSlots ?? 0)}/${maxSlots} used)`
      : "";

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium hover:bg-accent/10 transition-colors"
      >
        <span className="flex items-center gap-2">
          {levelTitle(level, isPactSection)}
          <span className="text-xs text-muted-foreground">
            ({spells.length}){slotSummary}
          </span>
        </span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1">
          {spells.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">No spells at this level.</p>
          ) : (
            spells.map((spell) => (
              <SpellRow
                key={spell.id}
                spell={spell}
                allowPrepareToggle={allowPrepareToggle}
                onTogglePrepared={() => onTogglePrepared(spell)}
                onRemove={() => onRemove(spell)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run build**

```
npm run build 2>&1 | tail -5
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/sheet/spells/spell-level-section.tsx
git commit -m "feat: SpellLevelSection collapsible component grouping spells by level"
```

---

### Task 12: `add-spell-panel.tsx`

**Why twelfth:** Largest UI piece. Models `add-item-panel.tsx` exactly.

**Files:**
- Create: `components/sheet/spells/add-spell-panel.tsx`

- [ ] **Step 1: Implement the component**

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchSpells, type SearchSpellsOptions } from "@/lib/supabase/spells";
import { useSpells } from "@/lib/character/character-context";

interface SpellSearchResult {
  id: string;
  name: string;
  slug: string;
  content_type: string;
  data: Record<string, unknown>;
}

interface AddSpellPanelProps {
  open: boolean;
  onClose: () => void;
  systemId: string;
}

const LEVEL_PILLS: Array<{ key: string; label: string; level: number }> = [
  { key: "cantrip", label: "Cantrip", level: 0 },
  { key: "1", label: "1st", level: 1 },
  { key: "2", label: "2nd", level: 2 },
  { key: "3", label: "3rd", level: 3 },
  { key: "4", label: "4th", level: 4 },
  { key: "5", label: "5th", level: 5 },
  { key: "6", label: "6th", level: 6 },
  { key: "7", label: "7th", level: 7 },
  { key: "8", label: "8th", level: 8 },
  { key: "9", label: "9th", level: 9 },
];

export function AddSpellPanel({ open, onClose, systemId }: AddSpellPanelProps) {
  const { casterInfo, addSpell, spells } = useSpells();
  const [query, setQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(
    casterInfo.classes[0]?.slug ?? null,
  );
  const [results, setResults] = useState<SpellSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async () => {
    setLoading(true);
    const opts: SearchSpellsOptions = {};
    if (selectedClass) opts.classSlug = selectedClass;
    if (selectedLevel != null) opts.level = selectedLevel;
    const data = await searchSpells(systemId, query, opts);
    setResults(data);
    setLoading(false);
  }, [systemId, query, selectedClass, selectedLevel]);

  useEffect(() => {
    if (!open) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(runSearch, 200);
  }, [runSearch, open]);

  if (!open) return null;

  const selectedCaster = casterInfo.classes.find((c) => c.slug === selectedClass);

  const handleAdd = async (spell: SpellSearchResult, intent: "known" | "spellbook" | "available") => {
    if (!selectedClass) return;
    const level = (spell.data?.level as number | undefined) ?? 0;
    // Enforce cantrip cap: count existing cantrips known, block if at cap.
    // Spellbook intent (wizard) and available intent (prepared casters) don't get enforced for
    // non-cantrip levels in Phase 1 — spells known caps for known casters can be added later.
    if (level === 0 && intent === "known" && selectedCaster) {
      const existingCantrips = spells.filter(
        (s) =>
          s.class_slug === selectedClass &&
          ((s.content_definitions?.data?.level as number | undefined) ?? 0) === 0,
      ).length;
      if (existingCantrips >= selectedCaster.cantripsKnown) {
        alert(
          `You already know the maximum number of cantrips (${selectedCaster.cantripsKnown}) for ${selectedClass}.`,
        );
        return;
      }
    }
    await addSpell({
      content_id: spell.id,
      name: spell.name,
      class_slug: selectedClass,
      is_known: intent === "known",
      is_prepared: false,
      in_spellbook: intent === "spellbook",
    });
    setExpandedId(null);
  };

  return (
    <div className="rounded-lg border border-border bg-background space-y-3 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Add spell</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      {casterInfo.classes.length > 1 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Class</p>
          <div className="flex flex-wrap gap-1">
            {casterInfo.classes.map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => setSelectedClass(c.slug)}
                className={cn(
                  "text-xs px-2 py-1 rounded-full border capitalize",
                  selectedClass === c.slug
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50",
                )}
              >
                {c.slug}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search spells\u2026"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="flex flex-wrap gap-1">
        {LEVEL_PILLS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setSelectedLevel(selectedLevel === p.level ? null : p.level)}
            className={cn(
              "text-xs px-2 py-1 rounded-full border",
              selectedLevel === p.level
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="max-h-[400px] overflow-y-auto space-y-1">
        {loading && (
          <p className="text-xs text-muted-foreground text-center py-4">Searching\u2026</p>
        )}
        {!loading && results.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No spells found. Try adjusting filters.
          </p>
        )}
        {results.map((spell) => {
          const isExpanded = expandedId === spell.id;
          const level = (spell.data?.level as number | undefined) ?? 0;
          const school = (spell.data?.school as string | undefined) ?? "";
          const ritual = !!spell.data?.ritual;
          const concentration = !!spell.data?.concentration;
          return (
            <div key={spell.id} className="rounded border border-border/50 overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : spell.id)}
                className="w-full flex items-center justify-between px-2 py-1.5 text-left hover:bg-accent/30"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium truncate">{spell.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {level === 0 ? "Cantrip" : `L${level}`} \u00b7 {school}
                  </span>
                  {ritual && <span className="text-[9px] text-muted-foreground">R</span>}
                  {concentration && <span className="text-[9px] text-muted-foreground">C</span>}
                </span>
              </button>
              {isExpanded && (
                <div className="p-2 border-t border-border/50 space-y-2">
                  {spell.data?.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {String(spell.data.description)}
                    </p>
                  )}
                  <div className="flex gap-2">
                    {selectedCaster?.slug === "wizard" && level > 0 ? (
                      <Button size="sm" onClick={() => handleAdd(spell, "spellbook")}>
                        Add to Spellbook
                      </Button>
                    ) : selectedCaster?.prepared && level > 0 ? (
                      <Button size="sm" onClick={() => handleAdd(spell, "available")}>
                        Add (available to prepare)
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => handleAdd(spell, "known")}>
                        {level === 0 ? "Learn Cantrip" : "Learn Spell"}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run build**

```
npm run build 2>&1 | tail -10
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/sheet/spells/add-spell-panel.tsx
git commit -m "feat: AddSpellPanel inline search panel with class/level filters"
```

---

### Task 13: Rewrite `spells-tab.tsx`

**Why thirteenth:** Composes all the sub-components into the final tab. Consumes context directly.

**Files:**
- Rewrite: `components/sheet/tabs/spells-tab.tsx`

- [ ] **Step 1: Rewrite the file**

Replace the entire contents of `components/sheet/tabs/spells-tab.tsx` with:

```typescript
"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCharacter, useSpells } from "@/lib/character/character-context";
import { SpellHeader } from "@/components/sheet/spells/spell-header";
import { SlotTracker } from "@/components/sheet/spells/slot-tracker";
import { SpellLevelSection } from "@/components/sheet/spells/spell-level-section";
import { AddSpellPanel } from "@/components/sheet/spells/add-spell-panel";
import type { CharacterSpell } from "@/lib/types/spells";

const CASTER_CLASSES = [
  "Bard",
  "Cleric",
  "Druid",
  "Paladin",
  "Ranger",
  "Sorcerer",
  "Warlock",
  "Wizard",
];

export function SpellsTab() {
  const { character } = useCharacter();
  const { casterInfo, spells, slotState, maxSlots, updateSpell, removeSpell } = useSpells();
  const [showAddPanel, setShowAddPanel] = useState(false);

  const spellsByLevel = useMemo(() => {
    const groups: Record<number, CharacterSpell[]> = {};
    for (const s of spells) {
      const level = (s.content_definitions?.data?.level as number | undefined) ?? 0;
      if (!groups[level]) groups[level] = [];
      groups[level].push(s);
    }
    return groups;
  }, [spells]);

  const hasAnySpells = spells.length > 0;
  const anyClassPrepared = casterInfo.classes.some((c) => c.prepared);

  if (!casterInfo.isCaster) {
    return (
      <div className="p-3 space-y-3">
        <p className="text-sm font-medium">Spells</p>
        <div className="rounded-lg border border-border bg-card/50 p-4 text-center text-sm text-muted-foreground">
          <p>This character cannot cast spells.</p>
          <p className="text-xs mt-1">
            Casting classes: {CASTER_CLASSES.join(", ")}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Spells</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAddPanel((v) => !v)}
        >
          <Plus className="size-3.5 mr-1" />
          {showAddPanel ? "Close" : "Add Spell"}
        </Button>
      </div>

      {showAddPanel && (
        <AddSpellPanel
          open={showAddPanel}
          onClose={() => setShowAddPanel(false)}
          systemId={character.system_id}
        />
      )}

      <SpellHeader />
      <SlotTracker />

      {!hasAnySpells ? (
        <div className="rounded-lg border border-border bg-card/50 p-4 text-center text-sm text-muted-foreground">
          <p>You haven't picked any spells yet.</p>
          <p className="text-xs mt-1">
            Click <strong>+ Add Spell</strong> to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, level) => {
            const spellsAtLevel = spellsByLevel[level] ?? [];
            if (spellsAtLevel.length === 0 && level > 0) return null;
            const total = level === 0 ? undefined : maxSlots[String(level) as "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"];
            const used = level === 0 ? undefined : slotState[String(level) as "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"];
            return (
              <SpellLevelSection
                key={level}
                level={level}
                spells={spellsAtLevel}
                maxSlots={total}
                usedSlots={used}
                defaultOpen={level === 0}
                allowPrepareToggle={anyClassPrepared}
                onTogglePrepared={(spell) =>
                  updateSpell(spell.id, { is_prepared: !spell.is_prepared })
                }
                onRemove={(spell) => removeSpell(spell.id)}
              />
            );
          })}
          {(maxSlots.pact ?? 0) > 0 && (
            <SpellLevelSection
              level={0}
              isPactSection
              spells={[]}
              maxSlots={maxSlots.pact}
              usedSlots={slotState.pact}
              defaultOpen={false}
              allowPrepareToggle={false}
              onTogglePrepared={() => {}}
              onRemove={() => {}}
            />
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the component is exported and consumed correctly**

Check `components/sheet/content-tabs.tsx`. The current version calls `<SpellsTab contentRefs={contentRefs} />`. Since the rewritten tab takes NO props, update the call site:

In `components/sheet/content-tabs.tsx`, find:
```typescript
{activeTab === "spells" && <SpellsTab contentRefs={contentRefs} />}
```
Replace with:
```typescript
{activeTab === "spells" && <SpellsTab />}
```

Also check `components/sheet/mobile-sheet.tsx` for a similar call site and update it if present.

- [ ] **Step 3: Run build**

```
npm run build 2>&1 | tail -15
```
Expected: clean. If you see "Property 'contentRefs' is missing in type ..." that's the remaining call site.

- [ ] **Step 4: Run tests**

```
npx vitest run 2>&1 | tail -5
```
Expected: 215 passing.

- [ ] **Step 5: Commit**

```bash
git add components/sheet/tabs/spells-tab.tsx components/sheet/content-tabs.tsx components/sheet/mobile-sheet.tsx
git commit -m "feat: rewrite SpellsTab with context, sub-components, empty state, filters"
```

---

### Task 14: Add `ConcentrationBadge` to Sheet Header

**Why fourteenth:** The last UI piece — drop the badge into the sheet near HP.

**Files:**
- Modify: `components/character/character-shell.tsx`

- [ ] **Step 1: Read the file to find a good insertion point**

Read `components/character/character-shell.tsx`. Find the `CharacterHeader` or where HP tracker area is rendered. Identify a location above/below the tabs where a badge can live.

- [ ] **Step 2: Add the import and render**

Add import at top:
```typescript
import { ConcentrationBadge } from "@/components/sheet/spells/concentration-badge";
```

Render the badge. A simple placement: inside the Tabs `<TabsList>` area or in the top-right of the content wrapper. Example (adapt based on actual file structure):

If the file has a section like:
```tsx
<Tabs defaultValue="sheet" ...>
  <TabsList>...</TabsList>
  ...
</Tabs>
```

Wrap or position:
```tsx
<div className="flex items-center justify-between px-4">
  <TabsList>...</TabsList>
  <ConcentrationBadge />
</div>
```

Use discretion based on the file's actual layout. The badge returns `null` when there's no concentration, so placement is safe even when inactive.

- [ ] **Step 3: Run build**

```
npm run build 2>&1 | tail -5
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add components/character/character-shell.tsx
git commit -m "feat: show ConcentrationBadge in character sheet header"
```

---

### Task 15: Integration Tests + Manual Smoke + PR

**Why last:** Prove it all composes correctly.

**Files:**
- Create: `tests/components/sheet/spells-tab.test.tsx`

- [ ] **Step 1: Write a smoke test for non-caster and caster empty states**

Create `tests/components/sheet/spells-tab.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SpellsTab } from "@/components/sheet/tabs/spells-tab";

vi.mock("@/lib/character/character-context", () => {
  return {
    useCharacter: () => ({
      character: { id: "c1", name: "Test", system_id: "sys", choices: {} },
    }),
    useSpells: () => useSpellsMock(),
  };
});

let useSpellsMockData: ReturnType<typeof buildMock>;
function useSpellsMock() {
  return useSpellsMockData;
}

function buildMock(overrides: Partial<ReturnType<typeof buildMock>> = {}) {
  return {
    casterInfo: { isCaster: false, classes: [], spellDc: 0, spellAttackBonus: 0 },
    spells: [],
    slotState: {},
    maxSlots: {},
    concentration: null,
    addSpell: vi.fn(),
    updateSpell: vi.fn(),
    removeSpell: vi.fn(),
    setConcentration: vi.fn(),
    ...overrides,
  };
}

describe("SpellsTab", () => {
  it("renders non-caster message when isCaster is false", () => {
    useSpellsMockData = buildMock({
      casterInfo: { isCaster: false, classes: [], spellDc: 0, spellAttackBonus: 0 },
    });
    render(<SpellsTab />);
    expect(screen.getByText(/cannot cast spells/i)).toBeInTheDocument();
  });

  it("renders empty-state prompt for caster with no spells", () => {
    useSpellsMockData = buildMock({
      casterInfo: {
        isCaster: true,
        classes: [
          {
            slug: "wizard",
            level: 3,
            type: "full",
            ability: "intelligence",
            prepared: true,
            cantripsKnown: 3,
            spellsKnown: "all",
            maxPrepared: 6,
            ritualCasting: true,
          },
        ],
        spellDc: 13,
        spellAttackBonus: 5,
      },
    });
    render(<SpellsTab />);
    expect(screen.getByText(/haven't picked any spells yet/i)).toBeInTheDocument();
  });

  it("shows the Add Spell button for casters", () => {
    useSpellsMockData = buildMock({
      casterInfo: {
        isCaster: true,
        classes: [
          {
            slug: "wizard",
            level: 3,
            type: "full",
            ability: "intelligence",
            prepared: true,
            cantripsKnown: 3,
            spellsKnown: "all",
            maxPrepared: 6,
            ritualCasting: true,
          },
        ],
        spellDc: 13,
        spellAttackBonus: 5,
      },
    });
    render(<SpellsTab />);
    expect(screen.getByRole("button", { name: /add spell/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests**

```
npx vitest run tests/components/sheet/spells-tab.test.tsx
```
Expected: 3/3 pass.

- [ ] **Step 3: Run full suite**

```
npx vitest run 2>&1 | tail -5
```
Expected: 215 + 3 = 218 tests pass.

- [ ] **Step 4: Run build**

```
npm run build 2>&1 | tail -5
```
Expected: clean.

- [ ] **Step 5: Manual smoke test on dev server**

```
npm run dev
```

Test scenarios:
- **Barbarian**: Open Spells tab → "This character cannot cast spells" message
- **Wizard L3** (no spells): Open Spells tab → Spell DC / attack visible → empty state message → click Add Spell → panel appears → type "fireball" → filter to L3 → click Fireball → expand → click Add to Spellbook → spell appears in 3rd Level section
- **Cleric L3 Life Domain**: Open Spells tab → Bless, Cure Wounds, Lesser Restoration, Spiritual Weapon auto-appear with [Always] badge
- **Warlock L3 Fiend**: Burning Hands and Command auto-appear with [Always] badges → Pact slot row visible in tracker with 2 slots at 2nd level
- **Paladin L5 Oath of Devotion**: Sanctuary, Protection from Evil and Good, Lesser Restoration, Zone of Truth auto-appear with [Always] badges
- Prepared caster: toggle prepared on a spell → badge updates → counter in header updates
- Click trash icon on a non-always-prepared spell → spell removed
- Manually set `character.state.concentrating_on` via dev tools to `{ spell_slug: "bless", spell_name: "Bless", slot_level: 1, started_at: new Date().toISOString() }` → badge appears in header → click X → badge disappears

- [ ] **Step 6: Push branch + create PR**

```bash
git push -u origin feat/spell-management-phase-1
gh pr create --title "feat: spell management Phase 1 — selection + read-only sheet" --body "$(cat <<'EOF'
## Summary
Phase 1 of three spell management phases. Delivers:

- \`character_spells\` table with FK to content_definitions, RLS, indexes
- D&D Beyond-style Spells tab: header (DC/attack/counters) + slot tracker + level accordion
- Always-prepared sync from class/subclass features (Life/Fiend/Devotion enriched)
- Concentration badge (manual)
- Ritual casting flag fix on Wizard/Cleric/Druid/Bard
- \`useSpells()\` hook on \`CharacterContext\`

## What's in this PR
- Task 1: character_spells migration
- Task 2: ritual_casting fix + subclass spellcastingExtra enrichment
- Task 3: spell types (CharacterSpell, SpellSlotsUsed, CasterInfo, ConcentrationState)
- Task 4: multiclass spellcaster slot table + 8 tests
- Task 5: spell helpers (DC, attack, maxPrepared, caster level, feature spells) + 20 tests
- Task 6: Supabase CRUD + sync + 5 tests
- Task 7: CharacterContext extension with useSpells hook
- Task 8: Server page + CharacterPageClient wire-up
- Task 9-14: UI components (spell header, slot tracker, concentration badge, spell row, level section, add-spell panel, spells-tab rewrite, badge in shell)
- Task 15: Smoke tests

## Not in this PR
Phase 2 (casting dialog + slot consumption + short/long rest + cantrip scaling) and Phase 3 (Mystic Arcanum, Arcane Recovery, Spell Mastery, Signature Spells, spellcasting bonuses from feats/items) are deferred.

## Test plan
- [x] 215 existing + 36 new = 251 tests pass
- [x] Clean build
- [x] Smoke tests on Wizard, Cleric Life Domain, Warlock Fiend, Paladin Devotion, non-caster Barbarian

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" --base main
```
