# Conditional Mechanical Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a condition system to mechanical effects so features like Unarmored Defense, Fighting Style: Defense, Rage, and speed bonuses correctly apply based on equipment state and activation toggles.

**Architecture:** Effects gain an optional `condition` field checked against `character.state` during evaluation. AC formulas use a "best of" system via `tag: "ac_formula"`. Equipment state (armor category, shield) and activation state (rage) live in the existing `state` jsonb column. The evaluator stays a pure function — state is passed in as a parameter.

**Tech Stack:** TypeScript, Zod validation, Supabase (Postgres jsonb), Next.js 16, Vitest

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/types/effects.ts` | Modify | Add `StateCondition` type, `condition` + `tag` fields to `MechanicalEffect` |
| `lib/engine/conditions.ts` | Create | `checkCondition()` helper — pure function, isolated for testing |
| `lib/engine/evaluator.ts` | Modify | Accept `state` param, filter effects by condition, AC "best of" logic |
| `lib/types/character.ts` | Modify | Add typed equipment/activation fields to `CharacterState` |
| `components/sheet/equipment-state.tsx` | Create | Armor category dropdown + shield toggle |
| `components/sheet/activation-toggles.tsx` | Create | Rage toggle button (extensible for future toggles) |
| `components/sheet/sheet-client.tsx` | Modify | Client-side re-evaluation on state change, add equipment/toggle UI |
| `app/(app)/characters/[id]/sheet/page.tsx` | Modify | Thread raw effects + sources to SheetClient for client re-eval |
| `supabase/migrations/00022_feature_effects.sql` | Create | Add mechanical/grant effects to ~25 features |
| `tests/engine/conditions.test.ts` | Create | Tests for condition checking |
| `tests/engine/evaluator-conditions.test.ts` | Create | Tests for conditional evaluation + AC best-of |

---

### Task 1: State Condition Type System

**Files:**
- Modify: `lib/types/effects.ts`
- Modify: `lib/types/character.ts`

- [ ] **Step 1: Add StateCondition type and update MechanicalEffect**

```typescript
// Add to lib/types/effects.ts, after the StatCondition interface

export type StateConditionOp = "eq" | "neq";

export interface StateCondition {
  field: string;
  op: StateConditionOp;
  value: string | boolean;
}

// Update MechanicalEffect — add optional condition and tag
export interface MechanicalEffect {
  type: "mechanical";
  stat: string;
  op: EffectOp | "formula";
  value?: number | string;
  expr?: string;
  condition?: StateCondition | StateCondition[]; // array = AND semantics
  tag?: string; // grouping tag, e.g., "ac_formula" for best-of selection
}
```

- [ ] **Step 2: Add typed equipment/activation fields to CharacterState**

```typescript
// Add to CharacterState in lib/types/character.ts
export interface CharacterState {
  current_hp?: number;
  temp_hp?: number;
  conditions?: string[];
  death_saves?: { successes: number; failures: number };
  inspiration?: boolean;
  quick_notes?: string;
  notes?: string;
  spell_slots_used?: Record<string, number>;
  // Equipment state
  equipped_armor?: "none" | "light" | "medium" | "heavy";
  shield_equipped?: boolean;
  // Activation toggles
  rage_active?: boolean;
  [key: string]: unknown;
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/types/effects.ts lib/types/character.ts
git commit -m "feat: add StateCondition type and equipment/activation state fields"
```

---

### Task 2: Condition Checker

**Files:**
- Create: `lib/engine/conditions.ts`
- Create: `tests/engine/conditions.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/engine/conditions.test.ts
import { describe, it, expect } from "vitest";
import { checkCondition } from "@/lib/engine/conditions";
import type { StateCondition } from "@/lib/types/effects";

describe("checkCondition", () => {
  it("returns true when no condition is provided", () => {
    expect(checkCondition(undefined, {})).toBe(true);
  });

  it("checks eq operator", () => {
    const condition: StateCondition = { field: "equipped_armor", op: "eq", value: "none" };
    expect(checkCondition(condition, { equipped_armor: "none" })).toBe(true);
    expect(checkCondition(condition, { equipped_armor: "heavy" })).toBe(false);
  });

  it("checks neq operator", () => {
    const condition: StateCondition = { field: "equipped_armor", op: "neq", value: "heavy" };
    expect(checkCondition(condition, { equipped_armor: "light" })).toBe(true);
    expect(checkCondition(condition, { equipped_armor: "heavy" })).toBe(false);
  });

  it("checks boolean values", () => {
    const condition: StateCondition = { field: "shield_equipped", op: "eq", value: false };
    expect(checkCondition(condition, { shield_equipped: false })).toBe(true);
    expect(checkCondition(condition, { shield_equipped: true })).toBe(false);
  });

  it("uses defaults for missing fields", () => {
    const condition: StateCondition = { field: "equipped_armor", op: "eq", value: "none" };
    expect(checkCondition(condition, {})).toBe(true); // default is "none"

    const shieldCondition: StateCondition = { field: "shield_equipped", op: "eq", value: false };
    expect(checkCondition(shieldCondition, {})).toBe(true); // default is false
  });

  it("handles array conditions with AND semantics", () => {
    const conditions: StateCondition[] = [
      { field: "equipped_armor", op: "eq", value: "none" },
      { field: "shield_equipped", op: "eq", value: false },
    ];
    expect(checkCondition(conditions, { equipped_armor: "none", shield_equipped: false })).toBe(true);
    expect(checkCondition(conditions, { equipped_armor: "none", shield_equipped: true })).toBe(false);
    expect(checkCondition(conditions, { equipped_armor: "light", shield_equipped: false })).toBe(false);
  });

  it("checks rage_active boolean", () => {
    const condition: StateCondition = { field: "rage_active", op: "eq", value: true };
    expect(checkCondition(condition, { rage_active: true })).toBe(true);
    expect(checkCondition(condition, {})).toBe(false); // default is false
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/conditions.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement checkCondition**

```typescript
// lib/engine/conditions.ts
import type { StateCondition } from "@/lib/types/effects";

const STATE_DEFAULTS: Record<string, string | boolean> = {
  equipped_armor: "none",
  shield_equipped: false,
  rage_active: false,
};

export function checkCondition(
  condition: StateCondition | StateCondition[] | undefined,
  state: Record<string, unknown>,
): boolean {
  if (!condition) return true;
  const conditions = Array.isArray(condition) ? condition : [condition];
  return conditions.every((c) => {
    const actual = state[c.field] ?? STATE_DEFAULTS[c.field] ?? null;
    switch (c.op) {
      case "eq":
        return actual === c.value;
      case "neq":
        return actual !== c.value;
      default:
        return true;
    }
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/conditions.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add lib/engine/conditions.ts tests/engine/conditions.test.ts
git commit -m "feat: add checkCondition helper for state-based effect filtering"
```

---

### Task 3: Evaluator — Condition Filtering + AC Best-Of

**Files:**
- Modify: `lib/engine/evaluator.ts`
- Create: `tests/engine/evaluator-conditions.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/engine/evaluator-conditions.test.ts
import { describe, it, expect } from "vitest";
import { evaluate } from "@/lib/engine/evaluator";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { Effect } from "@/lib/types/effects";

const schema: SystemSchemaDefinition = {
  ability_scores: [
    { slug: "strength", name: "Strength", abbreviation: "STR" },
    { slug: "dexterity", name: "Dexterity", abbreviation: "DEX" },
    { slug: "constitution", name: "Constitution", abbreviation: "CON" },
    { slug: "intelligence", name: "Intelligence", abbreviation: "INT" },
    { slug: "wisdom", name: "Wisdom", abbreviation: "WIS" },
    { slug: "charisma", name: "Charisma", abbreviation: "CHA" },
  ],
  derived_stats: [
    { slug: "armor_class", name: "Armor Class", formula: "10 + mod(dexterity)" },
    { slug: "movement_speed", name: "Speed", base: 30 },
  ],
  content_types: [],
  creation_steps: [],
};

const baseStats = { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 };

describe("conditional effects", () => {
  it("applies unconditional effect (no condition field)", () => {
    const effects: Effect[] = [
      { type: "mechanical", stat: "armor_class", op: "add", value: 1 },
    ];
    const result = evaluate(baseStats, effects, schema, undefined, {});
    // AC = 10 + mod(14) + 1 = 10 + 2 + 1 = 13
    expect(result.computed.armor_class).toBe(13);
  });

  it("applies effect when condition is met", () => {
    const effects: Effect[] = [
      {
        type: "mechanical", stat: "armor_class", op: "add", value: 1,
        condition: { field: "equipped_armor", op: "neq", value: "none" },
      },
    ];
    const result = evaluate(baseStats, effects, schema, undefined, { equipped_armor: "medium" });
    expect(result.computed.armor_class).toBe(13); // 10 + 2 + 1
  });

  it("skips effect when condition is NOT met", () => {
    const effects: Effect[] = [
      {
        type: "mechanical", stat: "armor_class", op: "add", value: 1,
        condition: { field: "equipped_armor", op: "neq", value: "none" },
      },
    ];
    const result = evaluate(baseStats, effects, schema, undefined, { equipped_armor: "none" });
    expect(result.computed.armor_class).toBe(12); // 10 + 2, no +1
  });

  it("skips effect when state is empty and default fails condition", () => {
    const effects: Effect[] = [
      {
        type: "mechanical", stat: "armor_class", op: "add", value: 1,
        condition: { field: "equipped_armor", op: "neq", value: "none" },
      },
    ];
    // No state → defaults to equipped_armor="none" → condition fails
    const result = evaluate(baseStats, effects, schema);
    expect(result.computed.armor_class).toBe(12);
  });
});

describe("AC best-of with tagged formulas", () => {
  it("picks the best AC formula", () => {
    const effects: Effect[] = [
      // Barbarian Unarmored Defense: 10 + DEX + CON = 10 + 2 + 2 = 14
      {
        type: "mechanical", stat: "armor_class", op: "formula",
        expr: "10 + mod(dexterity) + mod(constitution)",
        tag: "ac_formula",
        condition: { field: "equipped_armor", op: "eq", value: "none" },
      },
    ];
    const result = evaluate(baseStats, effects, schema, undefined, { equipped_armor: "none" });
    // Schema default: 10 + mod(14) = 12
    // Barbarian formula: 10 + 2 + 2 = 14
    // Best of: 14
    expect(result.computed.armor_class).toBe(14);
  });

  it("uses schema default when formula condition fails", () => {
    const effects: Effect[] = [
      {
        type: "mechanical", stat: "armor_class", op: "formula",
        expr: "10 + mod(dexterity) + mod(constitution)",
        tag: "ac_formula",
        condition: { field: "equipped_armor", op: "eq", value: "none" },
      },
    ];
    // Wearing armor → condition fails → formula skipped → use schema default
    const result = evaluate(baseStats, effects, schema, undefined, { equipped_armor: "medium" });
    expect(result.computed.armor_class).toBe(12); // 10 + mod(14) = 12
  });

  it("applies additive bonus on top of best AC formula", () => {
    const effects: Effect[] = [
      // Unarmored Defense formula
      {
        type: "mechanical", stat: "armor_class", op: "formula",
        expr: "10 + mod(dexterity) + mod(constitution)",
        tag: "ac_formula",
        condition: { field: "equipped_armor", op: "eq", value: "none" },
      },
      // Shield bonus (unconditional add, no tag)
      { type: "mechanical", stat: "armor_class", op: "add", value: 2 },
    ];
    const result = evaluate(baseStats, effects, schema, undefined, { equipped_armor: "none" });
    // Best formula: 14, then +2 shield = 16
    expect(result.computed.armor_class).toBe(16);
  });
});

describe("conditional speed bonus", () => {
  it("applies speed bonus when condition met", () => {
    const effects: Effect[] = [
      {
        type: "mechanical", stat: "movement_speed", op: "add", value: 10,
        condition: { field: "equipped_armor", op: "neq", value: "heavy" },
      },
    ];
    const result = evaluate(baseStats, effects, schema, undefined, { equipped_armor: "light" });
    expect(result.computed.movement_speed).toBe(40);
  });

  it("skips speed bonus when wearing heavy armor", () => {
    const effects: Effect[] = [
      {
        type: "mechanical", stat: "movement_speed", op: "add", value: 10,
        condition: { field: "equipped_armor", op: "neq", value: "heavy" },
      },
    ];
    const result = evaluate(baseStats, effects, schema, undefined, { equipped_armor: "heavy" });
    expect(result.computed.movement_speed).toBe(30);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/evaluator-conditions.test.ts`
Expected: FAIL — evaluate() doesn't accept state parameter, no condition filtering

- [ ] **Step 3: Update evaluator — add state parameter and condition filtering**

In `lib/engine/evaluator.ts`:

1. Add import: `import { checkCondition } from "@/lib/engine/conditions";`

2. Update `evaluate` signature:
```typescript
export function evaluate(
  baseStats: Record<string, number>,
  effects: Effect[],
  schema: SystemSchemaDefinition,
  sources?: StructuredSources,
  state?: Record<string, unknown>,
): EvaluationResult {
```

3. In the effect separation loop (step 1), add condition filtering:
```typescript
for (const effect of allEffects) {
  switch (effect.type) {
    case "mechanical":
      if (checkCondition(effect.condition, state ?? {})) {
        mechanical.push(effect);
      }
      break;
    // narrative and grant unchanged
  }
}
```

4. After formula effects are split, add AC best-of logic:
```typescript
// Split formula effects: ac_formula tagged vs regular
const acFormulaEffects: MechanicalEffect[] = [];
const regularFormulaEffects: MechanicalEffect[] = [];

for (const effect of formulaEffects) {
  if (effect.tag === "ac_formula") {
    acFormulaEffects.push(effect);
  } else {
    regularFormulaEffects.push(effect);
  }
}

// AC best-of: evaluate all ac_formula alternatives and pick the max
if (acFormulaEffects.length > 0) {
  const context = { ...stats, ...computed };
  const baseAC = computed.armor_class ?? 10;
  let bestAC = baseAC;
  for (const effect of acFormulaEffects) {
    if (effect.expr) {
      const val = parseExpression(effect.expr, context, builtins);
      bestAC = Math.max(bestAC, val);
    }
  }
  computed.armor_class = bestAC;
}

// Apply regular formula effects
for (const effect of regularFormulaEffects) {
  // ... existing formula application logic
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/evaluator-conditions.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Run all tests to verify no regressions**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add lib/engine/evaluator.ts tests/engine/evaluator-conditions.test.ts
git commit -m "feat: evaluator supports conditional effects and AC best-of formulas"
```

---

### Task 4: SQL Migration — Feature Effects

**Files:**
- Create: `supabase/migrations/00022_feature_effects.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration: Add mechanical/grant effects to SRD features
-- Covers: fighting styles, unarmored defense, speed bonuses, save profs, critical bonuses

BEGIN;

-- ============================================================================
-- FIGHTING STYLES — Defense (add condition: wearing armor)
-- ============================================================================

-- Update ALL Defense fighting styles to require armor
UPDATE content_definitions
SET effects = effects || '[{"type":"mechanical","stat":"armor_class","op":"add","value":1,"condition":{"field":"equipped_armor","op":"neq","value":"none"}}]'::jsonb
WHERE slug LIKE '%-fighting-style-defense'
  AND content_type = 'feature'
  AND source = 'srd'
  AND scope = 'platform';

-- Also fix the paladin one with different slug pattern
UPDATE content_definitions
SET effects = effects || '[{"type":"mechanical","stat":"armor_class","op":"add","value":1,"condition":{"field":"equipped_armor","op":"neq","value":"none"}}]'::jsonb
WHERE slug = 'fighting-style-defense'
  AND content_type = 'feature'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- UNARMORED DEFENSE
-- ============================================================================

-- Barbarian: AC = 10 + DEX mod + CON mod (no armor, shield OK)
UPDATE content_definitions
SET effects = effects || '[{"type":"mechanical","stat":"armor_class","op":"formula","expr":"10 + mod(dexterity) + mod(constitution)","tag":"ac_formula","condition":{"field":"equipped_armor","op":"eq","value":"none"}}]'::jsonb
WHERE slug = 'barbarian-unarmored-defense'
  AND content_type = 'feature'
  AND source = 'srd'
  AND scope = 'platform';

-- Monk: AC = 10 + DEX mod + WIS mod (no armor, no shield)
UPDATE content_definitions
SET effects = effects || '[{"type":"mechanical","stat":"armor_class","op":"formula","expr":"10 + mod(dexterity) + mod(wisdom)","tag":"ac_formula","condition":[{"field":"equipped_armor","op":"eq","value":"none"},{"field":"shield_equipped","op":"eq","value":false}]}]'::jsonb
WHERE slug = 'monk-unarmored-defense'
  AND content_type = 'feature'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- DRACONIC RESILIENCE (Sorcerer)
-- ============================================================================

-- AC = 13 + DEX mod when not wearing armor
UPDATE content_definitions
SET effects = effects || '[{"type":"mechanical","stat":"armor_class","op":"formula","expr":"13 + mod(dexterity)","tag":"ac_formula","condition":{"field":"equipped_armor","op":"eq","value":"none"}}]'::jsonb
WHERE slug = 'draconic-resilience'
  AND content_type = 'feature'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- SPEED BONUSES
-- ============================================================================

-- Fast Movement (Barbarian L5): +10 speed, not heavy armor
UPDATE content_definitions
SET effects = effects || '[{"type":"mechanical","stat":"movement_speed","op":"add","value":10,"condition":{"field":"equipped_armor","op":"neq","value":"heavy"}}]'::jsonb
WHERE slug = 'fast-movement'
  AND content_type = 'feature'
  AND source = 'srd'
  AND scope = 'platform';

-- Unarmored Movement (Monk L2): +10 speed, no armor no shield
UPDATE content_definitions
SET effects = effects || '[{"type":"mechanical","stat":"movement_speed","op":"add","value":10,"condition":[{"field":"equipped_armor","op":"eq","value":"none"},{"field":"shield_equipped","op":"eq","value":false}]}]'::jsonb
WHERE slug = 'unarmored-movement-1'
  AND content_type = 'feature'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- SAVING THROW PROFICIENCIES
-- ============================================================================

-- Slippery Mind (Rogue L15): WIS save proficiency
UPDATE content_definitions
SET effects = effects || '[{"type":"grant","stat":"saving_throw_wisdom","value":"proficient"}]'::jsonb
WHERE slug = 'slippery-mind'
  AND content_type = 'feature'
  AND source = 'srd'
  AND scope = 'platform';

-- Diamond Soul (Monk L14): all 6 save proficiencies
UPDATE content_definitions
SET effects = effects || '[{"type":"grant","stat":"saving_throw_strength","value":"proficient"},{"type":"grant","stat":"saving_throw_dexterity","value":"proficient"},{"type":"grant","stat":"saving_throw_constitution","value":"proficient"},{"type":"grant","stat":"saving_throw_intelligence","value":"proficient"},{"type":"grant","stat":"saving_throw_wisdom","value":"proficient"},{"type":"grant","stat":"saving_throw_charisma","value":"proficient"}]'::jsonb
WHERE slug = 'diamond-soul'
  AND content_type = 'feature'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- RAGE (Barbarian L1) — conditional on rage_active
-- ============================================================================

-- B/P/S damage resistance while raging
UPDATE content_definitions
SET effects = effects || '[{"type":"mechanical","stat":"dmgres_bludgeoning","op":"grant","value":"bludgeoning","condition":{"field":"rage_active","op":"eq","value":true}},{"type":"mechanical","stat":"dmgres_piercing","op":"grant","value":"piercing","condition":{"field":"rage_active","op":"eq","value":true}},{"type":"mechanical","stat":"dmgres_slashing","op":"grant","value":"slashing","condition":{"field":"rage_active","op":"eq","value":true}}]'::jsonb
WHERE slug = 'rage'
  AND content_type = 'feature'
  AND source = 'srd'
  AND scope = 'platform';

COMMIT;
```

- [ ] **Step 2: Apply migration to Supabase**

Run via `execute_sql` MCP tool against project `etcaodglvcspcmwecyxq`

- [ ] **Step 3: Verify effects were applied**

```sql
SELECT slug, jsonb_array_length(effects) as effect_count
FROM content_definitions
WHERE slug IN ('barbarian-unarmored-defense', 'monk-unarmored-defense', 'fast-movement', 'slippery-mind', 'diamond-soul', 'rage', 'draconic-resilience')
AND source = 'srd';
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00022_feature_effects.sql
git commit -m "feat: add conditional mechanical effects to SRD features (migration 00022)"
```

---

### Task 5: Sheet Page — Thread Data for Client Re-evaluation

**Files:**
- Modify: `app/(app)/characters/[id]/sheet/page.tsx`
- Modify: `components/sheet/sheet-client.tsx`

- [ ] **Step 1: Read the current sheet page to understand data flow**

Read: `app/(app)/characters/[id]/sheet/page.tsx`

- [ ] **Step 2: Update sheet page to pass raw data alongside evalResult**

The sheet page currently calls `evaluate()` server-side and passes `evalResult` to `SheetClient`. We need to also pass `allEffects`, `baseStats`, `schema`, `structuredSources`, and `character.state` so the client can re-evaluate when state changes.

Add these as props to `SheetClient`:
```typescript
<SheetClient
  character={character}
  evalResult={evalResult}
  // For client-side re-evaluation on state change:
  allEffects={allEffects}
  baseStatsWithLevel={baseStatsWithLevel}
  schema={schema}
  structuredSources={structuredSources}
/>
```

- [ ] **Step 3: Update SheetClient to re-evaluate on state change**

In `components/sheet/sheet-client.tsx`, add:
```typescript
import { evaluate } from "@/lib/engine/evaluator";

// Add local state for equipment/activation
const [localState, setLocalState] = useState<Record<string, unknown>>(
  character.state ?? {}
);

// Re-evaluate when state changes
const evalResult = useMemo(() => {
  return evaluate(baseStatsWithLevel, allEffects, schema, structuredSources, localState);
}, [baseStatsWithLevel, allEffects, schema, structuredSources, localState]);

// Handler to update state and persist
async function handleStateChange(updates: Record<string, unknown>) {
  const newState = { ...localState, ...updates };
  setLocalState(newState);
  await supabase.from("characters").update({ state: newState }).eq("id", character.id);
}
```

- [ ] **Step 4: Run build to verify no type errors**

Run: `npm run build`
Expected: Clean build

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/characters/[id]/sheet/page.tsx" "components/sheet/sheet-client.tsx"
git commit -m "feat: thread evaluation data to SheetClient for state-reactive re-evaluation"
```

---

### Task 6: Equipment State UI

**Files:**
- Create: `components/sheet/equipment-state.tsx`
- Modify: `components/sheet/sheet-client.tsx`

- [ ] **Step 1: Create EquipmentState component**

```typescript
// components/sheet/equipment-state.tsx
"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface EquipmentStateProps {
  equippedArmor: string;
  shieldEquipped: boolean;
  onArmorChange: (armor: string) => void;
  onShieldChange: (shield: boolean) => void;
}

const ARMOR_OPTIONS = [
  { value: "none", label: "No Armor" },
  { value: "light", label: "Light Armor" },
  { value: "medium", label: "Medium Armor" },
  { value: "heavy", label: "Heavy Armor" },
];

export function EquipmentState({
  equippedArmor,
  shieldEquipped,
  onArmorChange,
  onShieldChange,
}: EquipmentStateProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Equipment</p>
      <div className="space-y-2">
        <div>
          <Label className="text-xs text-muted-foreground">Armor</Label>
          <select
            value={equippedArmor}
            onChange={(e) => onArmorChange(e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {ARMOR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Shield</Label>
          <Switch checked={shieldEquipped} onCheckedChange={onShieldChange} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add EquipmentState to SheetClient**

Place it in the combat stats area of the sheet, near AC and speed. Wire it to `handleStateChange`:
```typescript
<EquipmentState
  equippedArmor={(localState.equipped_armor as string) ?? "none"}
  shieldEquipped={(localState.shield_equipped as boolean) ?? false}
  onArmorChange={(armor) => handleStateChange({ equipped_armor: armor })}
  onShieldChange={(shield) => handleStateChange({ shield_equipped: shield })}
/>
```

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Clean

- [ ] **Step 4: Commit**

```bash
git add components/sheet/equipment-state.tsx components/sheet/sheet-client.tsx
git commit -m "feat: add equipment state UI (armor category + shield toggle)"
```

---

### Task 7: Activation Toggles UI (Rage)

**Files:**
- Create: `components/sheet/activation-toggles.tsx`
- Modify: `components/sheet/sheet-client.tsx`

- [ ] **Step 1: Create ActivationToggles component**

```typescript
// components/sheet/activation-toggles.tsx
"use client";

import { Button } from "@/components/ui/button";

interface ActivationToggle {
  key: string;
  label: string;
  active: boolean;
}

interface ActivationTogglesProps {
  toggles: ActivationToggle[];
  onToggle: (key: string, active: boolean) => void;
}

export function ActivationToggles({ toggles, onToggle }: ActivationTogglesProps) {
  if (toggles.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Active Effects</p>
      <div className="flex flex-wrap gap-2">
        {toggles.map((toggle) => (
          <Button
            key={toggle.key}
            variant={toggle.active ? "default" : "outline"}
            size="sm"
            onClick={() => onToggle(toggle.key, !toggle.active)}
            className={toggle.active ? "bg-destructive hover:bg-destructive/90" : ""}
          >
            {toggle.label}
            {toggle.active && " (Active)"}
          </Button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into SheetClient**

Derive available toggles from the character's features (check if Rage feature is attached via content refs):
```typescript
const availableToggles = useMemo(() => {
  const toggles: Array<{ key: string; label: string; active: boolean }> = [];
  // Check if character has Rage
  const hasRage = contentRefs.some(
    (ref) => ref.content_definitions?.slug === "rage"
  );
  if (hasRage) {
    toggles.push({
      key: "rage_active",
      label: "Rage",
      active: (localState.rage_active as boolean) ?? false,
    });
  }
  return toggles;
}, [contentRefs, localState]);

// In the render:
<ActivationToggles
  toggles={availableToggles}
  onToggle={(key, active) => handleStateChange({ [key]: active })}
/>
```

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Clean

- [ ] **Step 4: Commit**

```bash
git add components/sheet/activation-toggles.tsx components/sheet/sheet-client.tsx
git commit -m "feat: add rage activation toggle on character sheet"
```

---

### Task 8: Integration Verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Clean

- [ ] **Step 3: Start dev server and test**

Run: `npm run dev`

Test scenarios:
1. Create/use a Barbarian character → set no armor → AC should show Unarmored Defense (10 + DEX + CON)
2. Toggle armor to "medium" → AC should revert to base formula (10 + DEX)
3. Add Fighter multiclass → select Defense fighting style → toggle to "light armor" → AC should get +1 bonus
4. Toggle armor to "none" → Defense +1 should disappear (wearing armor required)
5. Select Monk → no armor, no shield → AC should show 10 + DEX + WIS
6. Barbarian Fast Movement → speed should show +10 when not heavy armor, disappear with heavy armor
7. Toggle Rage button on Barbarian → should show rage as active (damage resistance via UI)

- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "feat: conditional effects system — equipment state, AC formulas, rage toggle"
git push
```
