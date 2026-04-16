# Cleanup Pass Before Spell Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up accumulated tech debt before adding spell management — remove dead code, introduce React Context for shared character state, split three large components, extract duplicated logic, and add component tests.

**Architecture:** A single `CharacterContext` in `lib/character/character-context.tsx` owns all shared state (inventory, play state, portrait, derived effects). Consumer hooks (`useCharacter`, `useCharacterState`, `useInventory`, `usePortrait`) replace the 8-prop pass-through through `ContentTabs` and `MobileSheet`. Large components split into sub-components and custom hooks: `character-page-client` → provider + panels, `narrative-tab` → hook + view/edit components, `add-item-modal` → panel + detail card + filters + custom form.

**Tech Stack:** TypeScript, React 19, Next.js 16, Vitest, React Testing Library, Supabase

**Spec:** `docs/superpowers/specs/2026-04-15-cleanup-before-spells-design.md`

---

## File Structure

**Task ordering rationale:** Context provider (Task 3) must be created before anything else can consume its hooks. Inventory helpers (Task 2) feed into context. Component splits happen one at a time after context is in place. Tests come last because they validate the final shape.

| File | Action | Task |
|------|--------|------|
| `components/sheet/sheet-client.tsx` | Delete | 1 |
| `app/(app)/characters/[id]/builder/details/` | Delete | 1 |
| `lib/inventory/helpers.ts` | Create | 2 |
| `tests/inventory/helpers.test.ts` | Create | 2 |
| `tests/inventory/rarity-colors.test.ts` | Create | 2 |
| `lib/character/character-context.tsx` | Create | 3 |
| `app/(app)/characters/[id]/page.tsx` | Modify | 4 |
| `components/character/character-page-client.tsx` | Rewrite | 4 |
| `components/character/sheet-panel.tsx` | Create | 5 |
| `components/character/narrative-panel.tsx` | Create | 5 |
| `components/sheet/content-tabs.tsx` | Modify | 6 |
| `components/sheet/mobile-sheet.tsx` | Modify | 6 |
| `components/sheet/tabs/inventory-tab.tsx` | Modify | 7 |
| `components/sheet/tabs/actions-tab.tsx` | Modify | 7 |
| `components/sheet/tabs/spells-tab.tsx` | Modify | 7 |
| `components/narrative/use-narrative-editor.ts` | Create | 8 |
| `components/narrative/narrative-view.tsx` | Create | 9 |
| `components/narrative/narrative-edit.tsx` | Create | 9 |
| `components/narrative/narrative-tab.tsx` | Rewrite | 9 |
| `components/sheet/inventory/item-filters.tsx` | Create | 10 |
| `components/sheet/inventory/custom-item-form.tsx` | Create | 10 |
| `components/sheet/inventory/item-detail-card.tsx` | Create | 10 |
| `components/sheet/inventory/add-item-panel.tsx` | Create (renamed) | 10 |
| `components/sheet/inventory/add-item-modal.tsx` | Delete | 10 |
| `tests/sheet/update-state.test.ts` | Create | 11 |
| `tests/supabase/inventory.test.ts` | Create | 11 |
| `tests/components/narrative/use-narrative-editor.test.ts` | Create | 12 |
| `tests/components/sheet/inventory-tab.test.tsx` | Create | 12 |
| `tests/components/sheet/add-item-panel.test.tsx` | Create | 12 |

---

### Task 1: Delete Dead Code

**Why first:** Reduces mental surface area for every subsequent task. Zero dependencies on other tasks.

**Files:**
- Delete: `components/sheet/sheet-client.tsx` (195 lines, zero importers)
- Delete: `app/(app)/characters/[id]/builder/details/page.tsx` (75 lines)
- Delete: `app/(app)/characters/[id]/builder/details/details-step-client.tsx` (236 lines)

- [ ] **Step 1: Verify sheet-client.tsx has zero runtime importers**

Run: `grep -rn "sheet-client" components/ app/ lib/ --include="*.tsx" --include="*.ts"`
Expected: Only `components/sheet/sheet-client.tsx` matches itself. No import statements referring to it.

- [ ] **Step 2: Verify details builder step is unreachable**

Run: `grep -rn "builder/details" components/ app/ --include="*.tsx" --include="*.ts"`
Expected: No matches. Migration 00023 already removed the step from `creation_steps`.

- [ ] **Step 3: Delete the files**

```bash
rm components/sheet/sheet-client.tsx
rm -rf "app/(app)/characters/[id]/builder/details"
```

- [ ] **Step 4: Verify build still passes**

Run: `npm run build 2>&1 | tail -15`
Expected: Clean build. No "module not found" errors.

- [ ] **Step 5: Verify tests still pass**

Run: `npx vitest run`
Expected: All 143 tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: delete dead code — sheet-client.tsx and builder/details step"
```

---

### Task 2: Create Inventory Helpers + Tests

**Why second:** Pure functions with no dependencies. Tests establish the contract that context (Task 3) will rely on. Also tests the existing `rarity-colors.ts` file.

**Files:**
- Create: `lib/inventory/helpers.ts`
- Create: `tests/inventory/helpers.test.ts`
- Create: `tests/inventory/rarity-colors.test.ts`

- [ ] **Step 1: Write the failing helpers tests**

Create `tests/inventory/helpers.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  getItemData,
  getItemWeight,
  isShield,
  isBodyArmor,
} from "@/lib/inventory/helpers";
import type { InventoryItem } from "@/lib/types/inventory";

function makeItem(overrides: Partial<InventoryItem>): InventoryItem {
  return {
    id: "test",
    character_id: "char1",
    content_id: null,
    name: "Test",
    content_type: "item",
    quantity: 1,
    equipped: false,
    attuned: false,
    sort_order: 0,
    notes: null,
    custom_data: null,
    created_at: "2026-01-01",
    content_definitions: null,
    ...overrides,
  };
}

describe("getItemData", () => {
  it("returns content_definitions.data when no custom_data", () => {
    const item = makeItem({
      content_definitions: {
        id: "c1",
        name: "Longsword",
        slug: "longsword",
        content_type: "weapon",
        data: { damage: "1d8", weight: 3 },
        effects: [],
      },
    });
    expect(getItemData(item)).toEqual({ damage: "1d8", weight: 3 });
  });

  it("merges custom_data over content_definitions.data", () => {
    const item = makeItem({
      content_definitions: {
        id: "c1",
        name: "Longsword",
        slug: "longsword",
        content_type: "weapon",
        data: { damage: "1d8", weight: 3 },
        effects: [],
      },
      custom_data: { weight: 5 },
    });
    expect(getItemData(item)).toEqual({ damage: "1d8", weight: 5 });
  });

  it("returns empty object when no data at all", () => {
    const item = makeItem({});
    expect(getItemData(item)).toEqual({});
  });
});

describe("getItemWeight", () => {
  it("returns custom_data.weight when set", () => {
    const item = makeItem({
      custom_data: { weight: 10 },
      content_definitions: {
        id: "c1", name: "X", slug: "x", content_type: "item",
        data: { weight: 2 }, effects: [],
      },
    });
    expect(getItemWeight(item)).toBe(10);
  });

  it("returns content_definitions.data.weight when no custom", () => {
    const item = makeItem({
      content_definitions: {
        id: "c1", name: "X", slug: "x", content_type: "item",
        data: { weight: 2 }, effects: [],
      },
    });
    expect(getItemWeight(item)).toBe(2);
  });

  it("returns 0 when no weight anywhere", () => {
    const item = makeItem({});
    expect(getItemWeight(item)).toBe(0);
  });

  it("returns 0 when weight is non-numeric", () => {
    const item = makeItem({
      content_definitions: {
        id: "c1", name: "X", slug: "x", content_type: "item",
        data: { weight: "heavy" }, effects: [],
      },
    });
    expect(getItemWeight(item)).toBe(0);
  });
});

describe("isShield", () => {
  it("returns true for item with armor_category Shield", () => {
    const item = makeItem({
      content_definitions: {
        id: "c1", name: "Shield", slug: "shield", content_type: "armor",
        data: { armor_category: "Shield" }, effects: [],
      },
    });
    expect(isShield(item)).toBe(true);
  });

  it("returns false for item with armor_category Heavy", () => {
    const item = makeItem({
      content_definitions: {
        id: "c1", name: "Plate", slug: "plate", content_type: "armor",
        data: { armor_category: "Heavy" }, effects: [],
      },
    });
    expect(isShield(item)).toBe(false);
  });

  it("returns false for item with no armor_category", () => {
    const item = makeItem({});
    expect(isShield(item)).toBe(false);
  });
});

describe("isBodyArmor", () => {
  it("returns true for armor content_type that is not a shield", () => {
    const item = makeItem({
      content_type: "armor",
      content_definitions: {
        id: "c1", name: "Plate", slug: "plate", content_type: "armor",
        data: { armor_category: "Heavy" }, effects: [],
      },
    });
    expect(isBodyArmor(item)).toBe(true);
  });

  it("returns false for shield", () => {
    const item = makeItem({
      content_type: "armor",
      content_definitions: {
        id: "c1", name: "Shield", slug: "shield", content_type: "armor",
        data: { armor_category: "Shield" }, effects: [],
      },
    });
    expect(isBodyArmor(item)).toBe(false);
  });

  it("returns false for non-armor content_type", () => {
    const item = makeItem({ content_type: "weapon" });
    expect(isBodyArmor(item)).toBe(false);
  });
});
```

- [ ] **Step 2: Write the failing rarity-colors test**

Create `tests/inventory/rarity-colors.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { rarityTextClass } from "@/lib/inventory/rarity-colors";

describe("rarityTextClass", () => {
  it("returns default for Common", () => {
    expect(rarityTextClass("Common")).toBe("text-foreground");
  });

  it("returns green for Uncommon", () => {
    expect(rarityTextClass("Uncommon")).toBe("text-green-400");
  });

  it("returns blue for Rare", () => {
    expect(rarityTextClass("Rare")).toBe("text-blue-400");
  });

  it("returns purple for Very Rare", () => {
    expect(rarityTextClass("Very Rare")).toBe("text-purple-400");
  });

  it("returns orange for Legendary", () => {
    expect(rarityTextClass("Legendary")).toBe("text-orange-400");
  });

  it("returns red for Artifact", () => {
    expect(rarityTextClass("Artifact")).toBe("text-red-400");
  });

  it("returns default for null", () => {
    expect(rarityTextClass(null)).toBe("text-foreground");
  });

  it("returns default for undefined", () => {
    expect(rarityTextClass(undefined)).toBe("text-foreground");
  });

  it("returns default for unknown rarity", () => {
    expect(rarityTextClass("Mythical")).toBe("text-foreground");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/inventory/helpers.test.ts tests/inventory/rarity-colors.test.ts`
Expected: `helpers.test.ts` fails with "module not found" for `@/lib/inventory/helpers`. `rarity-colors.test.ts` passes (module already exists).

- [ ] **Step 4: Implement the helpers**

Create `lib/inventory/helpers.ts`:

```typescript
import type { InventoryItem } from "@/lib/types/inventory";

/**
 * Merged item data: content_definitions.data plus custom_data overrides.
 * custom_data fields win over inherited fields.
 */
export function getItemData(item: InventoryItem): Record<string, unknown> {
  const base = (item.content_definitions?.data ?? {}) as Record<string, unknown>;
  const custom = (item.custom_data ?? {}) as Record<string, unknown>;
  return { ...base, ...custom };
}

/**
 * Item weight in pounds. custom_data.weight wins over content definition weight.
 * Returns 0 if no numeric weight is available.
 */
export function getItemWeight(item: InventoryItem): number {
  const data = getItemData(item);
  const weight = data.weight;
  return typeof weight === "number" ? weight : 0;
}

/**
 * True if the item's armor_category is "Shield". Works for items stored as
 * either content_type="armor" or content_type="magic_item" with armor category.
 */
export function isShield(item: InventoryItem): boolean {
  const data = getItemData(item);
  return data.armor_category === "Shield";
}

/**
 * True if the item is body armor (content_type="armor" and not a shield).
 */
export function isBodyArmor(item: InventoryItem): boolean {
  return item.content_type === "armor" && !isShield(item);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/inventory/helpers.test.ts tests/inventory/rarity-colors.test.ts`
Expected: All tests pass.

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: 143 + 13 = 156 tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/inventory/helpers.ts tests/inventory/helpers.test.ts tests/inventory/rarity-colors.test.ts
git commit -m "feat: extract inventory helpers (getItemData, isShield, isBodyArmor) + tests"
```

---

### Task 3: Create CharacterContext Provider

**Why third:** This is the foundation for Tasks 4-7. Create it complete before any consumer touches it.

**Files:**
- Create: `lib/character/character-context.tsx`

- [ ] **Step 1: Create the context module**

Create `lib/character/character-context.tsx`:

```typescript
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CharacterWithSystem, CharacterState } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type {
  EvaluationResult,
  StructuredSources,
} from "@/lib/engine/evaluator";
import { evaluate } from "@/lib/engine/evaluator";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import type { Effect } from "@/lib/types/effects";
import type { InventoryItem, Currency } from "@/lib/types/inventory";
import { DEFAULT_CURRENCY } from "@/lib/types/inventory";
import type { CropArea } from "@/components/narrative/character-portrait";
import { updateCharacterState } from "@/lib/sheet/update-state";
import {
  addInventoryItem,
  updateInventoryItem,
  removeInventoryItem,
  unequipAllArmor,
} from "@/lib/supabase/inventory";
import { generateArmorEffects } from "@/lib/inventory/armor-effects";
import { isBodyArmor, isShield, getItemData } from "@/lib/inventory/helpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AddItemPayload {
  content_id: string | null;
  name: string;
  content_type: string;
  quantity?: number;
  custom_data?: Record<string, unknown> | null;
}

export type InventoryUpdate = Partial<
  Pick<InventoryItem, "quantity" | "equipped" | "attuned" | "notes">
>;

interface PortraitData {
  url?: string;
  crop?: CropArea | null;
}

interface CharacterContextValue {
  // Identity
  character: CharacterWithSystem;
  schema: SystemSchemaDefinition;
  contentRefs: ContentRefWithContent[];
  isOwner: boolean;
  isDm: boolean;
  hasSheet: boolean;
  maxHp: number;

  // Play state
  state: CharacterState;
  patchState: (patch: Partial<CharacterState>) => Promise<void>;

  // Evaluation
  evalResult: EvaluationResult;

  // Portrait
  portrait: PortraitData;
  setPortrait: (updates: PortraitData) => void;

  // Inventory
  inventory: InventoryItem[];
  currency: Currency;
  addItem: (item: AddItemPayload) => Promise<void>;
  updateItem: (id: string, updates: InventoryUpdate) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  setCurrency: (currency: Currency) => void;
}

const CharacterContext = createContext<CharacterContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface CharacterProviderProps {
  character: CharacterWithSystem;
  schema: SystemSchemaDefinition;
  contentRefs: ContentRefWithContent[];
  initialState: CharacterState;
  initialInventory: InventoryItem[];
  allEffects: Effect[];
  baseStatsWithLevel: Record<string, number>;
  structuredSources: StructuredSources;
  isOwner: boolean;
  isDm: boolean;
  hasSheet: boolean;
  maxHp: number;
  children: ReactNode;
}

export function CharacterProvider({
  character,
  schema,
  contentRefs,
  initialState,
  initialInventory,
  allEffects,
  baseStatsWithLevel,
  structuredSources,
  isOwner,
  isDm,
  hasSheet,
  maxHp,
  children,
}: CharacterProviderProps) {
  const [state, setState] = useState<CharacterState>(initialState);
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [portrait, setPortraitState] = useState<PortraitData>({
    url: character.narrative?.portrait_url as string | undefined,
    crop: (character.narrative?.portrait_crop as CropArea | undefined) ?? null,
  });

  // Patch character.state (immediate server write)
  const patchState = useCallback(
    async (patch: Partial<CharacterState>) => {
      setState((prev) => ({ ...prev, ...patch }));
      try {
        await updateCharacterState(character.id, patch);
      } catch (err) {
        console.error("Failed to save state:", err);
      }
    },
    [character.id],
  );

  // Inventory handlers
  const addItem = useCallback(
    async (item: AddItemPayload) => {
      const newItem = await addInventoryItem(character.id, item);
      if (newItem) {
        setInventory((prev) => [...prev, newItem]);
      }
    },
    [character.id],
  );

  const updateItem = useCallback(
    async (id: string, updates: InventoryUpdate) => {
      // Armor mutual exclusion: equipping body armor unequips other body armor
      if (updates.equipped === true) {
        const item = inventory.find((i) => i.id === id);
        if (item && isBodyArmor(item)) {
          await unequipAllArmor(character.id);
          setInventory((prev) =>
            prev.map((i) =>
              isBodyArmor(i) && i.id !== id ? { ...i, equipped: false } : i,
            ),
          );
        }
      }
      await updateInventoryItem(id, updates);
      setInventory((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...updates } : i)),
      );
    },
    [inventory, character.id],
  );

  const removeItem = useCallback(
    async (id: string) => {
      await removeInventoryItem(id);
      setInventory((prev) => prev.filter((i) => i.id !== id));
    },
    [],
  );

  const setCurrency = useCallback(
    (newCurrency: Currency) => {
      patchState({ currency: newCurrency });
    },
    [patchState],
  );

  // Portrait updates (merges partial updates)
  const setPortrait = useCallback((updates: PortraitData) => {
    setPortraitState((prev) => ({
      url: updates.url !== undefined ? updates.url : prev.url,
      crop: updates.crop !== undefined ? updates.crop : prev.crop,
    }));
  }, []);

  // Derived: AC effects from equipped body armor
  const equippedArmorEffects = useMemo(() => {
    const equipped = inventory.find((i) => i.equipped && isBodyArmor(i));
    if (!equipped) return [];
    const data = getItemData(equipped) as {
      armor_category: string;
      armor_class: { base: number; dex_bonus: boolean; max_bonus?: number };
    };
    return generateArmorEffects(data);
  }, [inventory]);

  // Derived: state augmented with equipment-derived fields
  const derivedState = useMemo(() => {
    const equippedBody = inventory.find((i) => i.equipped && isBodyArmor(i));
    const hasShield = inventory.some((i) => i.equipped && isShield(i));
    const armorCategory = equippedBody
      ? String(getItemData(equippedBody).armor_category ?? "none").toLowerCase()
      : "none";
    return {
      ...state,
      equipped_armor: armorCategory,
      shield_equipped: hasShield,
    };
  }, [inventory, state]);

  // Derived: evaluation result
  const evalResult = useMemo(() => {
    const combinedEffects = [...allEffects, ...equippedArmorEffects];
    return evaluate(
      baseStatsWithLevel,
      combinedEffects,
      schema,
      structuredSources,
      derivedState as Record<string, unknown>,
    );
  }, [
    baseStatsWithLevel,
    allEffects,
    equippedArmorEffects,
    schema,
    structuredSources,
    derivedState,
  ]);

  const currency = (state.currency as Currency) ?? DEFAULT_CURRENCY;

  const value: CharacterContextValue = {
    character,
    schema,
    contentRefs,
    isOwner,
    isDm,
    hasSheet,
    maxHp,
    state,
    patchState,
    evalResult,
    portrait,
    setPortrait,
    inventory,
    currency,
    addItem,
    updateItem,
    removeItem,
    setCurrency,
  };

  return (
    <CharacterContext.Provider value={value}>
      {children}
    </CharacterContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Consumer hooks
// ---------------------------------------------------------------------------

function useCharacterContext(): CharacterContextValue {
  const ctx = useContext(CharacterContext);
  if (!ctx) {
    throw new Error(
      "Character hook used outside CharacterProvider. Wrap the tree in <CharacterProvider>.",
    );
  }
  return ctx;
}

export function useCharacter() {
  const ctx = useCharacterContext();
  return {
    character: ctx.character,
    schema: ctx.schema,
    contentRefs: ctx.contentRefs,
    isOwner: ctx.isOwner,
    isDm: ctx.isDm,
    hasSheet: ctx.hasSheet,
    evalResult: ctx.evalResult,
    maxHp: ctx.maxHp,
  };
}

export function useCharacterState() {
  const ctx = useCharacterContext();
  return {
    state: ctx.state,
    patchState: ctx.patchState,
  };
}

export function useInventory() {
  const ctx = useCharacterContext();
  return {
    inventory: ctx.inventory,
    currency: ctx.currency,
    addItem: ctx.addItem,
    updateItem: ctx.updateItem,
    removeItem: ctx.removeItem,
    setCurrency: ctx.setCurrency,
  };
}

export function usePortrait() {
  const ctx = useCharacterContext();
  return {
    portrait: ctx.portrait,
    setPortrait: ctx.setPortrait,
  };
}
```

- [ ] **Step 2: Run build to verify types**

Run: `npm run build 2>&1 | tail -20`
Expected: Clean build. The new file compiles; no existing file imports it yet so no breaking changes.

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: All 156 tests pass.

- [ ] **Step 4: Commit**

```bash
git add lib/character/character-context.tsx
git commit -m "feat: add CharacterContext provider with 4 consumer hooks"
```

---

### Task 4: Rewire Character Page to Use Provider

**Why fourth:** After this, every subsequent task can consume context hooks. This task replaces the heavy state/handler logic in `character-page-client.tsx` with a thin provider wrapper.

**Files:**
- Modify: `app/(app)/characters/[id]/page.tsx`
- Rewrite: `components/character/character-page-client.tsx`
- Create: `components/character/character-shell.tsx`

- [ ] **Step 1: Update the server page to pass `initialInventory` instead of `inventory`**

Read `app/(app)/characters/[id]/page.tsx` (it's 127 lines, currently passes `inventory={inventoryRows ?? []}`).

Replace the single line prop `inventory={inventoryRows ?? []}` with `initialInventory={inventoryRows ?? []}`:

```typescript
// In the <CharacterPageClient /> render (around line 124):
// Change: inventory={inventoryRows ?? []}
// To:     initialInventory={inventoryRows ?? []}
```

Full render section:

```tsx
return (
  <CharacterPageClient
    character={character}
    schema={schema}
    evalResult={evalResult}
    contentRefs={contentRefs}
    initialState={initialState}
    maxHp={maxHp}
    allEffects={allEffects}
    baseStatsWithLevel={baseStatsWithLevel}
    structuredSources={structuredSources}
    isOwner={isOwner}
    isDm={isDm}
    hasSheet={hasSheet ?? false}
    initialInventory={inventoryRows ?? []}
  />
);
```

- [ ] **Step 2: Rewrite `character-page-client.tsx` as a thin provider wrapper**

Replace the entire file `components/character/character-page-client.tsx` (currently 330 lines) with:

```typescript
"use client";

import type { CharacterWithSystem, CharacterState } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { EvaluationResult, StructuredSources } from "@/lib/engine/evaluator";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import type { Effect } from "@/lib/types/effects";
import type { InventoryItem } from "@/lib/types/inventory";
import { CharacterProvider } from "@/lib/character/character-context";
import { CharacterShell } from "@/components/character/character-shell";

interface CharacterPageClientProps {
  character: CharacterWithSystem;
  schema: SystemSchemaDefinition;
  evalResult: EvaluationResult;
  contentRefs: ContentRefWithContent[];
  initialState: CharacterState;
  maxHp: number;
  allEffects: Effect[];
  baseStatsWithLevel: Record<string, number>;
  structuredSources: StructuredSources;
  isOwner: boolean;
  isDm: boolean;
  hasSheet: boolean;
  initialInventory: InventoryItem[];
}

export function CharacterPageClient(props: CharacterPageClientProps) {
  const {
    character,
    schema,
    contentRefs,
    initialState,
    maxHp,
    allEffects,
    baseStatsWithLevel,
    structuredSources,
    isOwner,
    isDm,
    hasSheet,
    initialInventory,
  } = props;

  return (
    <CharacterProvider
      character={character}
      schema={schema}
      contentRefs={contentRefs}
      initialState={initialState}
      initialInventory={initialInventory}
      allEffects={allEffects}
      baseStatsWithLevel={baseStatsWithLevel}
      structuredSources={structuredSources}
      isOwner={isOwner}
      isDm={isDm}
      hasSheet={hasSheet}
      maxHp={maxHp}
    >
      <CharacterShell />
    </CharacterProvider>
  );
}
```

Note: `evalResult` prop is no longer used (context computes its own). It's left in the interface for now so the server page doesn't need to change, but the prop is ignored.

- [ ] **Step 3: Create a minimal `CharacterShell` component (Task 5 will replace its contents)**

Create `components/character/character-shell.tsx` as a placeholder that exactly mirrors the pre-refactor render output:

```typescript
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CharacterHeader } from "@/components/sheet/character-header";
import { StatRibbon } from "@/components/sheet/stat-ribbon";
import { SavingThrows } from "@/components/sheet/saving-throws";
import { PassiveSenses } from "@/components/sheet/passive-senses";
import { Defenses } from "@/components/sheet/defenses";
import { Conditions } from "@/components/sheet/conditions";
import { DeathSaves } from "@/components/sheet/death-saves";
import { SkillsList } from "@/components/sheet/skills-list";
import { Proficiencies } from "@/components/sheet/proficiencies";
import { ContentTabs } from "@/components/sheet/content-tabs";
import { QuickNotes } from "@/components/sheet/quick-notes";
import { ActivationToggles } from "@/components/sheet/activation-toggles";
import { MobileSheet } from "@/components/sheet/mobile-sheet";
import { NarrativeTab } from "@/components/narrative/narrative-tab";
import {
  useCharacter,
  useCharacterState,
  useInventory,
  usePortrait,
} from "@/lib/character/character-context";

export function CharacterShell() {
  const { character, schema, contentRefs, isOwner, isDm, hasSheet, evalResult, maxHp } =
    useCharacter();
  const { state, patchState } = useCharacterState();
  const { inventory, currency, addItem, updateItem, removeItem, setCurrency } =
    useInventory();
  const { portrait, setPortrait } = usePortrait();

  const availableToggles = (() => {
    const toggles: Array<{ key: string; label: string; active: boolean }> = [];
    const hasBarbarian = character.choices?.classes?.some(
      (c: { slug: string }) => c.slug === "barbarian",
    );
    if (hasBarbarian) {
      toggles.push({
        key: "rage_active",
        label: "Rage",
        active: (state.rage_active as boolean) ?? false,
      });
    }
    return toggles;
  })();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <div className="hidden md:block">
        <CharacterHeader
          character={character}
          inspiration={state.inspiration ?? false}
          onToggleInspiration={() =>
            patchState({ inspiration: !(state.inspiration ?? false) })
          }
          portraitUrl={portrait.url}
          portraitCrop={portrait.crop}
        />
      </div>
      <div className="md:hidden">
        <CharacterHeader
          character={character}
          inspiration={state.inspiration ?? false}
          onToggleInspiration={() =>
            patchState({ inspiration: !(state.inspiration ?? false) })
          }
          portraitUrl={portrait.url}
          portraitCrop={portrait.crop}
          mobile
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="sheet" className="flex-1 flex flex-col">
        <TabsList className="border-b bg-transparent rounded-none w-full justify-start h-auto p-0 shrink-0">
          <TabsTrigger
            value="sheet"
            className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary px-4 py-2"
          >
            Character Sheet
          </TabsTrigger>
          <TabsTrigger
            value="narrative"
            className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary px-4 py-2"
          >
            Narrative
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sheet" className="flex-1 flex flex-col mt-0">
          {hasSheet ? (
            <>
              <div className="hidden md:block px-4 py-3 border-b border-border">
                <StatRibbon
                  schema={schema}
                  evalResult={evalResult}
                  state={state}
                  patchState={patchState}
                  maxHp={maxHp}
                />
              </div>

              <div className="hidden md:grid grid-cols-[280px_1fr_1fr] gap-4 flex-1 p-4 overflow-hidden">
                <div className="space-y-4 overflow-y-auto">
                  <SavingThrows schema={schema} evalResult={evalResult} />
                  <PassiveSenses evalResult={evalResult} schema={schema} />
                  <Defenses evalResult={evalResult} />
                  <ActivationToggles
                    toggles={availableToggles}
                    onToggle={(key, active) => patchState({ [key]: active })}
                  />
                  <Conditions state={state} patchState={patchState} />
                  <DeathSaves state={state} patchState={patchState} />
                  <Proficiencies evalResult={evalResult} schema={schema} />
                  <QuickNotes state={state} patchState={patchState} />
                </div>
                <div className="overflow-y-auto">
                  <SkillsList schema={schema} evalResult={evalResult} />
                </div>
                <div className="overflow-hidden rounded-lg border border-border bg-card flex flex-col">
                  <ContentTabs
                    character={character}
                    schema={schema}
                    evalResult={evalResult}
                    contentRefs={contentRefs}
                    state={state}
                    patchState={patchState}
                    inventory={inventory}
                    currency={currency}
                    systemId={character.system_id}
                    strengthScore={evalResult.stats.strength ?? 10}
                    onAddItem={addItem}
                    onUpdateItem={updateItem}
                    onRemoveItem={removeItem}
                    onCurrencyChange={setCurrency}
                  />
                </div>
              </div>

              <MobileSheet
                character={character}
                schema={schema}
                evalResult={evalResult}
                contentRefs={contentRefs}
                state={state}
                patchState={patchState}
                maxHp={maxHp}
                inventory={inventory}
                currency={currency}
                systemId={character.system_id}
                strengthScore={evalResult.stats.strength ?? 10}
                onAddItem={addItem}
                onUpdateItem={updateItem}
                onRemoveItem={removeItem}
                onCurrencyChange={setCurrency}
              />
            </>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <p>Character has no sheet yet. Complete the builder first.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="narrative" className="flex-1 overflow-y-auto mt-0">
          <div className="max-w-4xl mx-auto p-4">
            <NarrativeTab
              character={character}
              isOwner={isOwner}
              isDm={isDm}
              onPortraitChange={(url) => setPortrait({ url: url ?? undefined })}
              onCropChange={(crop) => setPortrait({ crop })}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

Note: `ContentTabs` and `MobileSheet` still receive inventory props in this step. Task 6 removes them.

- [ ] **Step 3: Run build**

Run: `npm run build 2>&1 | tail -20`
Expected: Clean build. All types resolve.

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: All 156 tests pass.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`, navigate to a character page. Verify:
- Sheet tab renders (AC, stats, skills)
- Narrative tab renders
- Equipping armor updates AC
- Adding/removing inventory items works
- Portrait upload still updates header

- [ ] **Step 6: Commit**

```bash
git add app/\(app\)/characters/\[id\]/page.tsx components/character/character-page-client.tsx components/character/character-shell.tsx
git commit -m "refactor: move character page state to CharacterContext provider"
```

---

### Task 5: Extract Sheet and Narrative Panels

**Why fifth:** Splits the large `CharacterShell` into focused panels. Each panel consumes only the context slices it needs.

**Files:**
- Create: `components/character/sheet-panel.tsx`
- Create: `components/character/narrative-panel.tsx`
- Modify: `components/character/character-shell.tsx`

- [ ] **Step 1: Create `sheet-panel.tsx`**

Create `components/character/sheet-panel.tsx`:

```typescript
"use client";

import { StatRibbon } from "@/components/sheet/stat-ribbon";
import { SavingThrows } from "@/components/sheet/saving-throws";
import { PassiveSenses } from "@/components/sheet/passive-senses";
import { Defenses } from "@/components/sheet/defenses";
import { Conditions } from "@/components/sheet/conditions";
import { DeathSaves } from "@/components/sheet/death-saves";
import { SkillsList } from "@/components/sheet/skills-list";
import { Proficiencies } from "@/components/sheet/proficiencies";
import { ContentTabs } from "@/components/sheet/content-tabs";
import { QuickNotes } from "@/components/sheet/quick-notes";
import { ActivationToggles } from "@/components/sheet/activation-toggles";
import { MobileSheet } from "@/components/sheet/mobile-sheet";
import {
  useCharacter,
  useCharacterState,
} from "@/lib/character/character-context";

export function SheetPanel() {
  const { character, schema, contentRefs, hasSheet, evalResult, maxHp } =
    useCharacter();
  const { state, patchState } = useCharacterState();

  if (!hasSheet) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Character has no sheet yet. Complete the builder first.</p>
      </div>
    );
  }

  const availableToggles = (() => {
    const toggles: Array<{ key: string; label: string; active: boolean }> = [];
    const hasBarbarian = character.choices?.classes?.some(
      (c: { slug: string }) => c.slug === "barbarian",
    );
    if (hasBarbarian) {
      toggles.push({
        key: "rage_active",
        label: "Rage",
        active: (state.rage_active as boolean) ?? false,
      });
    }
    return toggles;
  })();

  return (
    <>
      <div className="hidden md:block px-4 py-3 border-b border-border">
        <StatRibbon
          schema={schema}
          evalResult={evalResult}
          state={state}
          patchState={patchState}
          maxHp={maxHp}
        />
      </div>

      <div className="hidden md:grid grid-cols-[280px_1fr_1fr] gap-4 flex-1 p-4 overflow-hidden">
        <div className="space-y-4 overflow-y-auto">
          <SavingThrows schema={schema} evalResult={evalResult} />
          <PassiveSenses evalResult={evalResult} schema={schema} />
          <Defenses evalResult={evalResult} />
          <ActivationToggles
            toggles={availableToggles}
            onToggle={(key, active) => patchState({ [key]: active })}
          />
          <Conditions state={state} patchState={patchState} />
          <DeathSaves state={state} patchState={patchState} />
          <Proficiencies evalResult={evalResult} schema={schema} />
          <QuickNotes state={state} patchState={patchState} />
        </div>
        <div className="overflow-y-auto">
          <SkillsList schema={schema} evalResult={evalResult} />
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-card flex flex-col">
          <ContentTabs
            character={character}
            schema={schema}
            evalResult={evalResult}
            contentRefs={contentRefs}
            state={state}
            patchState={patchState}
          />
        </div>
      </div>

      <MobileSheet
        character={character}
        schema={schema}
        evalResult={evalResult}
        contentRefs={contentRefs}
        state={state}
        patchState={patchState}
        maxHp={maxHp}
      />
    </>
  );
}
```

Note: `ContentTabs` and `MobileSheet` no longer receive inventory props. Task 6 makes them pull from context directly.

- [ ] **Step 2: Create `narrative-panel.tsx`**

Create `components/character/narrative-panel.tsx`:

```typescript
"use client";

import { NarrativeTab } from "@/components/narrative/narrative-tab";
import { useCharacter, usePortrait } from "@/lib/character/character-context";

export function NarrativePanel() {
  const { character, isOwner, isDm } = useCharacter();
  const { setPortrait } = usePortrait();

  return (
    <div className="max-w-4xl mx-auto p-4">
      <NarrativeTab
        character={character}
        isOwner={isOwner}
        isDm={isDm}
        onPortraitChange={(url) => setPortrait({ url: url ?? undefined })}
        onCropChange={(crop) => setPortrait({ crop })}
      />
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `character-shell.tsx` to use the new panels**

Replace `components/character/character-shell.tsx` with:

```typescript
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CharacterHeader } from "@/components/sheet/character-header";
import { SheetPanel } from "@/components/character/sheet-panel";
import { NarrativePanel } from "@/components/character/narrative-panel";
import {
  useCharacter,
  useCharacterState,
  usePortrait,
} from "@/lib/character/character-context";

export function CharacterShell() {
  const { character } = useCharacter();
  const { state, patchState } = useCharacterState();
  const { portrait } = usePortrait();

  const onToggleInspiration = () =>
    patchState({ inspiration: !(state.inspiration ?? false) });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="hidden md:block">
        <CharacterHeader
          character={character}
          inspiration={state.inspiration ?? false}
          onToggleInspiration={onToggleInspiration}
          portraitUrl={portrait.url}
          portraitCrop={portrait.crop}
        />
      </div>
      <div className="md:hidden">
        <CharacterHeader
          character={character}
          inspiration={state.inspiration ?? false}
          onToggleInspiration={onToggleInspiration}
          portraitUrl={portrait.url}
          portraitCrop={portrait.crop}
          mobile
        />
      </div>

      <Tabs defaultValue="sheet" className="flex-1 flex flex-col">
        <TabsList className="border-b bg-transparent rounded-none w-full justify-start h-auto p-0 shrink-0">
          <TabsTrigger
            value="sheet"
            className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary px-4 py-2"
          >
            Character Sheet
          </TabsTrigger>
          <TabsTrigger
            value="narrative"
            className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary px-4 py-2"
          >
            Narrative
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sheet" className="flex-1 flex flex-col mt-0">
          <SheetPanel />
        </TabsContent>

        <TabsContent value="narrative" className="flex-1 overflow-y-auto mt-0">
          <NarrativePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 4: Run build**

Run: `npm run build 2>&1 | tail -20`
Expected: Build fails because `ContentTabs` and `MobileSheet` expect inventory props that are no longer being passed. This is expected — Task 6 fixes it.

If build breaks, do NOT proceed to step 5. Go directly to Task 6.

If build succeeds (e.g., because TypeScript infers required props differently than expected), continue.

- [ ] **Step 5: Commit the panel extraction**

```bash
git add components/character/sheet-panel.tsx components/character/narrative-panel.tsx components/character/character-shell.tsx
git commit -m "refactor: extract SheetPanel and NarrativePanel from CharacterShell"
```

---

### Task 6: Remove Pass-Through Props from ContentTabs and MobileSheet

**Why sixth:** Must follow Task 5 because `SheetPanel` no longer passes inventory props down. This task makes `ContentTabs` and `MobileSheet` pull from context instead.

**Files:**
- Modify: `components/sheet/content-tabs.tsx`
- Modify: `components/sheet/mobile-sheet.tsx`

- [ ] **Step 1: Modify `ContentTabs` to consume inventory via context**

Read `components/sheet/content-tabs.tsx` to see the current props. It has 15 props, 8 of which are inventory-related pass-throughs.

Before replacing, verify the tab component imports match the actual filenames. Run:
```
ls components/sheet/tabs/
```
Confirm: `actions-tab.tsx`, `spells-tab.tsx`, `inventory-tab.tsx`, `features-tab.tsx`, `notes-tab.tsx` all exist. If any differ, adjust the import paths in the replacement code accordingly.

Replace the file contents with:

```typescript
"use client";

import { useState } from "react";
import type { CharacterWithSystem, CharacterState } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { EvaluationResult } from "@/lib/engine/evaluator";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import { ActionsTab } from "@/components/sheet/tabs/actions-tab";
import { SpellsTab } from "@/components/sheet/tabs/spells-tab";
import { InventoryTab } from "@/components/sheet/tabs/inventory-tab";
import { FeaturesTab } from "@/components/sheet/tabs/features-tab";
import { NotesTab } from "@/components/sheet/tabs/notes-tab";

type TabId = "actions" | "spells" | "inventory" | "features" | "notes";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "actions", label: "Actions" },
  { id: "spells", label: "Spells" },
  { id: "inventory", label: "Inventory" },
  { id: "features", label: "Features" },
  { id: "notes", label: "Notes" },
];

interface ContentTabsProps {
  character: CharacterWithSystem;
  schema: SystemSchemaDefinition;
  evalResult: EvaluationResult;
  contentRefs: ContentRefWithContent[];
  state: CharacterState;
  patchState: (patch: Partial<CharacterState>) => Promise<void>;
  initialTab?: TabId;
}

export function ContentTabs({
  character,
  schema,
  evalResult,
  contentRefs,
  state,
  patchState,
  initialTab = "actions",
}: ContentTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex border-b border-border bg-background shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "actions" && (
          <ActionsTab
            character={character}
            schema={schema}
            evalResult={evalResult}
            contentRefs={contentRefs}
          />
        )}
        {activeTab === "spells" && <SpellsTab contentRefs={contentRefs} />}
        {activeTab === "inventory" && <InventoryTab />}
        {activeTab === "features" && <FeaturesTab contentRefs={contentRefs} />}
        {activeTab === "notes" && <NotesTab state={state} patchState={patchState} />}
      </div>
    </div>
  );
}
```

Note: `InventoryTab` now takes zero props. Task 7 updates `InventoryTab` to read from context.

- [ ] **Step 2: Modify `MobileSheet` to consume inventory via context**

Read `components/sheet/mobile-sheet.tsx` (268 lines). The file passes the same 8 inventory props through to its nested `ContentTabs`.

Update the file to:
1. Remove the 8 inventory-related props from `MobileSheetProps`
2. Remove the corresponding forwarding to `ContentTabs` (since the next task makes `ContentTabs` and `InventoryTab` pull from context)

Find the `MobileSheetProps` interface and remove these props:
- `inventory`
- `currency`
- `systemId`
- `strengthScore`
- `onAddItem`
- `onUpdateItem`
- `onRemoveItem`
- `onCurrencyChange`

Find every `<ContentTabs>` usage inside `MobileSheet` and remove those 8 props from the JSX (they're no longer needed).

- [ ] **Step 3: Run build**

Run: `npm run build 2>&1 | tail -20`
Expected: Build may fail due to `InventoryTab` still expecting props. This is expected — Task 7 fixes it.

- [ ] **Step 4: Commit**

```bash
git add components/sheet/content-tabs.tsx components/sheet/mobile-sheet.tsx
git commit -m "refactor: remove inventory pass-through props from ContentTabs and MobileSheet"
```

---

### Task 7: Migrate Tab Components to Context

**Why seventh:** Depends on Tasks 3, 6. With context in place and `ContentTabs` no longer passing props, the tab components must read from context.

**Files:**
- Modify: `components/sheet/tabs/inventory-tab.tsx`
- Modify: `components/sheet/tabs/actions-tab.tsx`
- Modify: `components/sheet/tabs/spells-tab.tsx`

- [ ] **Step 1: Update `InventoryTab` to read from context**

Read `components/sheet/tabs/inventory-tab.tsx` (290 lines). The component currently receives 8 inventory-related props.

Make these targeted changes:

Remove the `InventoryTabProps` interface entirely. Remove the destructuring. Add context hook calls at the top of the component body.

Replace the component signature and the first block:

Find:
```typescript
interface InventoryTabProps {
  inventory: InventoryItem[];
  currency: Currency;
  systemId: string;
  strengthScore: number;
  onAddItem: (item: { content_id: string | null; name: string; content_type: string; quantity?: number; custom_data?: Record<string, unknown> | null }) => void;
  onUpdateItem: (itemId: string, updates: Partial<Pick<InventoryItem, "quantity" | "equipped" | "attuned" | "notes">>) => void;
  onRemoveItem: (itemId: string) => void;
  onCurrencyChange: (currency: Currency) => void;
}

export function InventoryTab({
  inventory,
  currency,
  systemId,
  strengthScore,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onCurrencyChange,
}: InventoryTabProps) {
```

Replace with:
```typescript
export function InventoryTab() {
  const { inventory, currency, addItem, updateItem, removeItem, setCurrency } =
    useInventory();
  const { character, evalResult } = useCharacter();
  const systemId = character.system_id;
  const strengthScore = evalResult.stats.strength ?? 10;
```

Then throughout the file, replace:
- `onAddItem` → `addItem`
- `onUpdateItem` → `updateItem`
- `onRemoveItem` → `removeItem`
- `onCurrencyChange` → `setCurrency`

Update imports:
- Remove `import type { InventoryItem, Currency }` if only used in props interface. Keep it if still used in `ItemRow` or local types.
- Add: `import { useInventory, useCharacter } from "@/lib/character/character-context";`

Also replace the local `getItemWeight` and `getItemData` definitions with imports from `@/lib/inventory/helpers`:

Find and delete:
```typescript
function getItemWeight(item: InventoryItem): number { ... }
function getItemData(item: InventoryItem): Record<string, unknown> { ... }
```

Add to imports:
```typescript
import { getItemData, getItemWeight, isShield, isBodyArmor } from "@/lib/inventory/helpers";
```

Update the filtering logic to use the helpers. Replace:
```typescript
const armor = inventory.filter(
  (i) =>
    i.content_type === "armor" ||
    (i.content_definitions?.data as Record<string, unknown>)?.armor_category === "Shield",
);
```

With:
```typescript
const armor = inventory.filter((i) => isBodyArmor(i) || isShield(i));
```

- [ ] **Step 2: Update `ActionsTab` to use inventory helpers**

Read `components/sheet/tabs/actions-tab.tsx` (234 lines).

Currently, `ActionsTab` accesses `ref.content_definitions.data` via manual cast. Does not need full context refactor — but should use `getItemData` pattern via `lib/inventory/helpers` if we're touching it.

For this pass, only make a minimal change: replace the one `as Record<string, unknown>` cast on line ~53 with a direct type assertion to the specific weapon data shape. Leave the props interface alone — `ActionsTab` still takes `contentRefs` (not inventory-based yet).

Find:
```typescript
const data = (ref.content_definitions?.data ?? {}) as Record<string, unknown>;
```

Replace with:
```typescript
const data = (ref.content_definitions?.data ?? {}) as {
  range?: { normal: number; long?: number };
  damage?: { dice: string; type: string };
  properties?: string[];
};
```

No other behavioral changes. This removes one `as Record<string, unknown>` cast from the audit count.

- [ ] **Step 3: Update `SpellsTab`**

Read `components/sheet/tabs/spells-tab.tsx` (60 lines).

Replace the one `as Record<string, unknown>` cast similarly. Find:
```typescript
const data = (ref.content_definitions?.data ?? {}) as Record<string, unknown>;
```

Replace with:
```typescript
const data = (ref.content_definitions?.data ?? {}) as {
  level?: number;
  school?: string;
};
```

- [ ] **Step 4: Run build**

Run: `npm run build 2>&1 | tail -20`
Expected: Clean build. All three tab components compile with their new shapes.

- [ ] **Step 5: Run tests**

Run: `npx vitest run`
Expected: All 156 tests pass.

- [ ] **Step 6: Manual smoke test**

Run: `npm run dev`, navigate to inventory tab, verify:
- Items render correctly
- Equip/unequip still works
- Add item still works
- Currency editor still works

- [ ] **Step 7: Commit**

```bash
git add components/sheet/tabs/inventory-tab.tsx components/sheet/tabs/actions-tab.tsx components/sheet/tabs/spells-tab.tsx
git commit -m "refactor: inventory/actions/spells tabs use context and inventory helpers"
```

---

### Task 8: Extract Narrative Editor Hook

**Why eighth:** Isolates the 486-line `narrative-tab.tsx` logic before splitting the view/edit components. The hook has no UI dependencies, so it can be tested in isolation.

**Files:**
- Create: `components/narrative/use-narrative-editor.ts`

- [ ] **Step 1: Read the existing `narrative-tab.tsx` to understand the state shape**

Read `components/narrative/narrative-tab.tsx` from lines 1-260 to understand all useState, useRef, handlers, and save logic.

- [ ] **Step 2: Create the extracted hook**

Create `components/narrative/use-narrative-editor.ts`:

```typescript
"use client";

import { useCallback, useRef, useState } from "react";
import type { CharacterWithSystem } from "@/lib/types/character";
import type {
  NarrativeData,
  NarrativeRichData,
  CharacterChoices,
} from "@/lib/types/character";
import {
  saveNarrative,
  saveNarrativeRich,
  saveChoices,
} from "@/app/(app)/characters/[id]/narrative-actions";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UseNarrativeEditorArgs {
  character: CharacterWithSystem;
  onPortraitChange?: (url: string | null) => void;
  onTokenChange?: (url: string | null) => void;
}

interface UseNarrativeEditorReturn {
  // Mode
  editMode: boolean;
  enterEdit: () => void;

  // Values (for rendering)
  savedNarrative: NarrativeData;
  savedRich: NarrativeRichData;
  savedChoices: CharacterChoices;
  localNarrative: NarrativeData;
  localRich: NarrativeRichData;
  localChoices: CharacterChoices;

  // Save status
  saveStatus: SaveStatus;

  // Portrait URLs (local optimistic values)
  portraitUrl: string | null;
  tokenUrl: string | null;

  // Handlers
  handleNarrativeChange: (field: keyof NarrativeData, value: unknown) => void;
  handleFunTraitChange: (field: string, value: string) => void;
  handleRichChange: (field: keyof NarrativeRichData, content: unknown) => void;
  handleChoiceChange: (field: keyof CharacterChoices, value: string[]) => void;
  handlePortraitChange: (url: string | null) => void;
  handleTokenChange: (url: string | null) => void;
  handleManualSave: () => Promise<void>;
  handleCancel: () => void;
}

export function useNarrativeEditor({
  character,
  onPortraitChange,
  onTokenChange,
}: UseNarrativeEditorArgs): UseNarrativeEditorReturn {
  const [editMode, setEditMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const initialNarrative = (character.narrative ?? {}) as NarrativeData;
  const initialRich = (character.narrative_rich ?? {}) as NarrativeRichData;
  const initialChoices = (character.choices ?? {}) as CharacterChoices;

  const [savedNarrative, setSavedNarrative] = useState<NarrativeData>(initialNarrative);
  const [savedRich, setSavedRich] = useState<NarrativeRichData>(initialRich);
  const [savedChoices, setSavedChoices] = useState<CharacterChoices>(initialChoices);

  const [localNarrative, setLocalNarrative] = useState<NarrativeData>(initialNarrative);
  const [localRich, setLocalRich] = useState<NarrativeRichData>(initialRich);
  const [localChoices, setLocalChoices] = useState<CharacterChoices>(initialChoices);

  const [portraitUrl, setPortraitUrl] = useState<string | null>(
    (initialNarrative.portrait_url as string | null) ?? null,
  );
  const [tokenUrl, setTokenUrl] = useState<string | null>(
    (initialNarrative.token_url as string | null) ?? null,
  );

  const dirtyNarrative = useRef(false);
  const dirtyRich = useRef(false);
  const dirtyChoices = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const narrativeRef = useRef(localNarrative);
  const richRef = useRef(localRich);
  const choicesRef = useRef(localChoices);

  narrativeRef.current = localNarrative;
  richRef.current = localRich;
  choicesRef.current = localChoices;

  const flushSave = useCallback(async () => {
    setSaveStatus("saving");
    try {
      const promises: Promise<unknown>[] = [];
      if (dirtyNarrative.current) {
        promises.push(saveNarrative(character.id, narrativeRef.current));
        setSavedNarrative(narrativeRef.current);
        dirtyNarrative.current = false;
      }
      if (dirtyRich.current) {
        promises.push(saveNarrativeRich(character.id, richRef.current));
        setSavedRich(richRef.current);
        dirtyRich.current = false;
      }
      if (dirtyChoices.current) {
        promises.push(saveChoices(character.id, choicesRef.current));
        setSavedChoices(choicesRef.current);
        dirtyChoices.current = false;
      }
      await Promise.all(promises);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1500);
    } catch (err) {
      console.error("Narrative save failed:", err);
      setSaveStatus("error");
    }
  }, [character.id]);

  const scheduleAutoSave = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      flushSave();
    }, 500);
  }, [flushSave]);

  const handleNarrativeChange = useCallback(
    (field: keyof NarrativeData, value: unknown) => {
      setLocalNarrative((prev) => ({ ...prev, [field]: value }));
      dirtyNarrative.current = true;
      scheduleAutoSave();
    },
    [scheduleAutoSave],
  );

  const handleFunTraitChange = useCallback(
    (field: string, value: string) => {
      setLocalNarrative((prev) => ({
        ...prev,
        fun_traits: { ...(prev.fun_traits ?? {}), [field]: value },
      }));
      dirtyNarrative.current = true;
      scheduleAutoSave();
    },
    [scheduleAutoSave],
  );

  const handleRichChange = useCallback(
    (field: keyof NarrativeRichData, content: unknown) => {
      setLocalRich((prev) => ({ ...prev, [field]: content }));
      dirtyRich.current = true;
      scheduleAutoSave();
    },
    [scheduleAutoSave],
  );

  const handleChoiceChange = useCallback(
    (field: keyof CharacterChoices, value: string[]) => {
      setLocalChoices((prev) => ({ ...prev, [field]: value }));
      dirtyChoices.current = true;
      scheduleAutoSave();
    },
    [scheduleAutoSave],
  );

  const handlePortraitChange = useCallback(
    (url: string | null) => {
      setPortraitUrl(url);
      setLocalNarrative((prev) => ({ ...prev, portrait_url: url }));
      dirtyNarrative.current = true;
      scheduleAutoSave();
      onPortraitChange?.(url);
    },
    [scheduleAutoSave, onPortraitChange],
  );

  const handleTokenChange = useCallback(
    (url: string | null) => {
      setTokenUrl(url);
      setLocalNarrative((prev) => ({ ...prev, token_url: url }));
      dirtyNarrative.current = true;
      scheduleAutoSave();
      onTokenChange?.(url);
    },
    [scheduleAutoSave, onTokenChange],
  );

  const handleManualSave = useCallback(async () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    await flushSave();
    setEditMode(false);
  }, [flushSave]);

  const handleCancel = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setLocalNarrative(savedNarrative);
    setLocalRich(savedRich);
    setLocalChoices(savedChoices);
    dirtyNarrative.current = false;
    dirtyRich.current = false;
    dirtyChoices.current = false;
    setEditMode(false);
    setSaveStatus("idle");
  }, [savedNarrative, savedRich, savedChoices]);

  const enterEdit = useCallback(() => {
    setLocalNarrative(savedNarrative);
    setLocalRich(savedRich);
    setLocalChoices(savedChoices);
    setEditMode(true);
  }, [savedNarrative, savedRich, savedChoices]);

  return {
    editMode,
    enterEdit,
    savedNarrative,
    savedRich,
    savedChoices,
    localNarrative,
    localRich,
    localChoices,
    saveStatus,
    portraitUrl,
    tokenUrl,
    handleNarrativeChange,
    handleFunTraitChange,
    handleRichChange,
    handleChoiceChange,
    handlePortraitChange,
    handleTokenChange,
    handleManualSave,
    handleCancel,
  };
}
```

- [ ] **Step 2: Run build**

Run: `npm run build 2>&1 | tail -20`
Expected: Clean build. Hook is created but not yet consumed.

- [ ] **Step 3: Commit**

```bash
git add components/narrative/use-narrative-editor.ts
git commit -m "refactor: extract narrative editor logic to useNarrativeEditor hook"
```

---

### Task 9: Split Narrative Tab into View + Edit + Rewritten Tab

**Why ninth:** Depends on Task 8. With the hook extracted, the rendering can be cleanly split.

**Files:**
- Create: `components/narrative/narrative-view.tsx`
- Create: `components/narrative/narrative-edit.tsx`
- Rewrite: `components/narrative/narrative-tab.tsx`

- [ ] **Step 1: Create `narrative-view.tsx`**

Read the current `components/narrative/narrative-tab.tsx` from line ~260 onwards (the view-mode rendering) to find which cards render.

Create `components/narrative/narrative-view.tsx` that renders all view-mode cards. It takes values as props:

```typescript
"use client";

import type { CharacterWithSystem } from "@/lib/types/character";
import type {
  NarrativeData,
  NarrativeRichData,
  CharacterChoices,
} from "@/lib/types/character";
import { CoreIdentityCard } from "@/components/narrative/view/core-identity-card";
import { PersonalityCard } from "@/components/narrative/view/personality-card";
import { DistinguishingFeaturesCard } from "@/components/narrative/view/distinguishing-features-card";
import { BackstoryCard } from "@/components/narrative/view/backstory-card";
import { FunTraitsCard } from "@/components/narrative/view/fun-traits-card";

interface NarrativeViewProps {
  character: CharacterWithSystem;
  narrative: NarrativeData;
  rich: NarrativeRichData;
  choices: CharacterChoices;
  isDm: boolean;
}

export function NarrativeView({
  character,
  narrative,
  rich,
  choices,
  isDm,
}: NarrativeViewProps) {
  return (
    <div className="space-y-6">
      <CoreIdentityCard character={character} narrative={narrative} />
      <PersonalityCard choices={choices} />
      <DistinguishingFeaturesCard content={rich.distinguishing_features} />
      <BackstoryCard
        title="Where They Came From"
        content={rich.backstory_origin}
      />
      <BackstoryCard
        title="The Turning Point"
        content={rich.backstory_turning_point}
      />
      <BackstoryCard
        title="What They Left Behind"
        content={rich.backstory_left_behind}
      />
      {isDm && (
        <BackstoryCard
          title="What the DM Should Know"
          content={rich.backstory_dm_notes}
          dmOnly
        />
      )}
      <FunTraitsCard narrative={narrative} />
    </div>
  );
}
```

Note: Preserve the exact cards and order from the current `narrative-tab.tsx`. If the import paths for cards differ (e.g., `./view/core-identity-card` vs `./core-identity-card`), use whatever paths are in the existing file.

- [ ] **Step 2: Create `narrative-edit.tsx`**

Create `components/narrative/narrative-edit.tsx` that renders all edit-mode forms. Takes the hook's return value as props:

```typescript
"use client";

import type { CharacterWithSystem } from "@/lib/types/character";
import type {
  NarrativeData,
  NarrativeRichData,
  CharacterChoices,
} from "@/lib/types/character";
import { CoreIdentityForm } from "@/components/narrative/edit/core-identity-form";
import { PersonalityForm } from "@/components/narrative/edit/personality-form";
import { DistinguishingFeaturesForm } from "@/components/narrative/edit/distinguishing-features-form";
import { BackstoryForm } from "@/components/narrative/edit/backstory-form";
import { FunTraitsForm } from "@/components/narrative/edit/fun-traits-form";

interface NarrativeEditProps {
  character: CharacterWithSystem;
  narrative: NarrativeData;
  rich: NarrativeRichData;
  choices: CharacterChoices;
  isDm: boolean;
  onNarrativeChange: (field: keyof NarrativeData, value: unknown) => void;
  onFunTraitChange: (field: string, value: string) => void;
  onRichChange: (field: keyof NarrativeRichData, content: unknown) => void;
  onChoiceChange: (field: keyof CharacterChoices, value: string[]) => void;
}

export function NarrativeEdit({
  character,
  narrative,
  rich,
  choices,
  isDm,
  onNarrativeChange,
  onFunTraitChange,
  onRichChange,
  onChoiceChange,
}: NarrativeEditProps) {
  return (
    <div className="space-y-6">
      <CoreIdentityForm
        character={character}
        narrative={narrative}
        onChange={onNarrativeChange}
      />
      <PersonalityForm choices={choices} onChange={onChoiceChange} />
      <DistinguishingFeaturesForm
        content={rich.distinguishing_features}
        onChange={(content) => onRichChange("distinguishing_features", content)}
      />
      <BackstoryForm
        title="Where They Came From"
        content={rich.backstory_origin}
        onChange={(content) => onRichChange("backstory_origin", content)}
      />
      <BackstoryForm
        title="The Turning Point"
        content={rich.backstory_turning_point}
        onChange={(content) => onRichChange("backstory_turning_point", content)}
      />
      <BackstoryForm
        title="What They Left Behind"
        content={rich.backstory_left_behind}
        onChange={(content) => onRichChange("backstory_left_behind", content)}
      />
      {isDm && (
        <BackstoryForm
          title="What the DM Should Know"
          content={rich.backstory_dm_notes}
          onChange={(content) => onRichChange("backstory_dm_notes", content)}
          dmOnly
        />
      )}
      <FunTraitsForm narrative={narrative} onChange={onFunTraitChange} />
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `narrative-tab.tsx` to use the hook + view/edit components**

Replace `components/narrative/narrative-tab.tsx` entirely:

```typescript
"use client";

import { Edit, Save, X, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CharacterWithSystem } from "@/lib/types/character";
import type { CropArea } from "@/components/narrative/character-portrait";
import { CharacterPortrait } from "@/components/narrative/character-portrait";
import {
  uploadPortrait,
  uploadToken,
  deletePortrait,
  deleteToken,
} from "@/app/(app)/characters/[id]/narrative-actions";
import {
  useNarrativeEditor,
  type SaveStatus,
} from "@/components/narrative/use-narrative-editor";
import { NarrativeView } from "@/components/narrative/narrative-view";
import { NarrativeEdit } from "@/components/narrative/narrative-edit";

interface NarrativeTabProps {
  character: CharacterWithSystem;
  campaignId?: string | null;
  isOwner: boolean;
  isDm: boolean;
  onPortraitChange?: (url: string | null) => void;
  onCropChange?: (crop: CropArea) => void;
}

function SaveStatusBadge({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  if (status === "saving") {
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Loader2 className="size-3 animate-spin" /> Saving…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="text-xs text-green-500 flex items-center gap-1">
        <CheckCircle className="size-3" /> Saved
      </span>
    );
  }
  if (status === "error") {
    return <span className="text-xs text-destructive">Save failed</span>;
  }
  return null;
}

export function NarrativeTab({
  character,
  isOwner,
  isDm,
  onPortraitChange,
  onCropChange,
}: NarrativeTabProps) {
  const editor = useNarrativeEditor({
    character,
    onPortraitChange,
  });

  const {
    editMode,
    enterEdit,
    savedNarrative,
    savedRich,
    savedChoices,
    localNarrative,
    localRich,
    localChoices,
    saveStatus,
    portraitUrl,
    tokenUrl,
    handleNarrativeChange,
    handleFunTraitChange,
    handleRichChange,
    handleChoiceChange,
    handlePortraitChange,
    handleTokenChange,
    handleManualSave,
    handleCancel,
  } = editor;

  const narrative = editMode ? localNarrative : savedNarrative;
  const rich = editMode ? localRich : savedRich;
  const choices = editMode ? localChoices : savedChoices;

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CharacterPortrait
            characterId={character.id}
            characterName={character.name}
            portraitUrl={portraitUrl}
            tokenUrl={tokenUrl}
            portraitCrop={
              (savedNarrative.portrait_crop as CropArea | null) ?? null
            }
            editable={editMode && isOwner}
            onPortraitChange={handlePortraitChange}
            onTokenChange={handleTokenChange}
            onCropChange={(crop) => {
              handleNarrativeChange("portrait_crop", crop);
              onCropChange?.(crop);
            }}
            uploadAction={async (formData) => {
              const type = formData.get("type") as "portrait" | "token";
              if (type === "token") return uploadToken(character.id, formData);
              return uploadPortrait(character.id, formData);
            }}
            deleteAction={async (_id, type) => {
              if (type === "token") return deleteToken(character.id);
              return deletePortrait(character.id);
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          <SaveStatusBadge status={saveStatus} />
          {editMode ? (
            <>
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X className="size-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleManualSave}>
                <Save className="size-4 mr-1" />
                Save
              </Button>
            </>
          ) : (
            isOwner && (
              <Button size="sm" onClick={enterEdit}>
                <Edit className="size-4 mr-1" />
                Edit
              </Button>
            )
          )}
        </div>
      </div>

      {/* View / Edit switch */}
      {editMode ? (
        <NarrativeEdit
          character={character}
          narrative={narrative}
          rich={rich}
          choices={choices}
          isDm={isDm}
          onNarrativeChange={handleNarrativeChange}
          onFunTraitChange={handleFunTraitChange}
          onRichChange={handleRichChange}
          onChoiceChange={handleChoiceChange}
        />
      ) : (
        <NarrativeView
          character={character}
          narrative={narrative}
          rich={rich}
          choices={choices}
          isDm={isDm}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run build**

Run: `npm run build 2>&1 | tail -25`
Expected: May surface type errors if the component/form imports don't match the paths in the original file. Fix them by:
1. Reading the original file's imports to find the correct paths (e.g., `./edit/core-identity-form` vs `./core-identity-form`)
2. Updating `narrative-view.tsx` and `narrative-edit.tsx` to match

Repeat until clean.

- [ ] **Step 5: Run tests**

Run: `npx vitest run`
Expected: All 156 tests pass.

- [ ] **Step 6: Manual smoke test**

Run: `npm run dev`, go to narrative tab, verify:
- View mode renders (if there's saved narrative content)
- Click Edit → edit mode renders
- Change a field → see "Saving…" → "Saved" badge
- Click Save → exits edit mode
- Click Edit again → values persist
- Click Cancel → reverts to saved

- [ ] **Step 7: Commit**

```bash
git add components/narrative/
git commit -m "refactor: split narrative-tab into hook + view + edit components"
```

---

### Task 10: Split Add Item Panel

**Why tenth:** Independent from the context refactor — touches only inventory UI. Safe to do after Task 7 is stable.

**Files:**
- Create: `components/sheet/inventory/item-filters.tsx`
- Create: `components/sheet/inventory/custom-item-form.tsx`
- Create: `components/sheet/inventory/item-detail-card.tsx`
- Create: `components/sheet/inventory/add-item-panel.tsx`
- Delete: `components/sheet/inventory/add-item-modal.tsx`

- [ ] **Step 1: Read the current `add-item-modal.tsx`**

Read `components/sheet/inventory/add-item-modal.tsx` fully (585 lines). Identify the three self-contained sections:
- Filter pills + magical checkbox (lines ~300-400 approximately)
- Custom item form (lines ~440-480)
- Item detail card (currently the `ItemDetailCard` inner component)

- [ ] **Step 2: Create `item-filters.tsx`**

Create `components/sheet/inventory/item-filters.tsx`:

```typescript
"use client";

import { cn } from "@/lib/utils";

export type CategoryPill =
  | "Armor"
  | "Weapon"
  | "Potion"
  | "Ring"
  | "Rod"
  | "Scroll"
  | "Staff"
  | "Wand"
  | "Wondrous"
  | "Gear";

export const CATEGORY_PILLS: CategoryPill[] = [
  "Armor",
  "Weapon",
  "Potion",
  "Ring",
  "Rod",
  "Scroll",
  "Staff",
  "Wand",
  "Wondrous",
  "Gear",
];

interface ItemFiltersProps {
  selected: CategoryPill | null;
  onSelect: (pill: CategoryPill | null) => void;
  magicalOnly: boolean;
  onMagicalToggle: (value: boolean) => void;
}

export function ItemFilters({
  selected,
  onSelect,
  magicalOnly,
  onMagicalToggle,
}: ItemFiltersProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {CATEGORY_PILLS.map((pill) => (
          <button
            key={pill}
            type="button"
            onClick={() => onSelect(selected === pill ? null : pill)}
            className={cn(
              "text-xs px-2 py-1 rounded-full border transition-colors",
              selected === pill
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50",
            )}
          >
            {pill}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={magicalOnly}
          onChange={(e) => onMagicalToggle(e.target.checked)}
          className="rounded border-border"
        />
        Magical only
      </label>
    </div>
  );
}
```

- [ ] **Step 3: Create `custom-item-form.tsx`**

Create `components/sheet/inventory/custom-item-form.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CustomItemFormProps {
  onAdd: (item: {
    content_id: null;
    name: string;
    content_type: string;
    quantity?: number;
    custom_data: Record<string, unknown>;
  }) => void;
  onCancel: () => void;
}

const ITEM_TYPES = [
  { value: "item", label: "Gear" },
  { value: "weapon", label: "Weapon" },
  { value: "armor", label: "Armor" },
  { value: "magic_item", label: "Magic Item" },
];

export function CustomItemForm({ onAdd, onCancel }: CustomItemFormProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState("item");
  const [weight, setWeight] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");

  const canSubmit = name.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const customData: Record<string, unknown> = {};
    if (weight.trim()) {
      const w = parseFloat(weight);
      if (!Number.isNaN(w)) customData.weight = w;
    }
    if (description.trim()) {
      customData.description = description.trim();
    }

    onAdd({
      content_id: null,
      name: name.trim(),
      content_type: type,
      quantity: parseInt(quantity) || 1,
      custom_data: customData,
    });

    setName("");
    setType("item");
    setWeight("");
    setDescription("");
    setQuantity("1");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Add custom item</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
      <Input
        placeholder="Item name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {ITEM_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <Input
          placeholder="Weight (lb)"
          type="number"
          step="0.1"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="w-24"
        />
        <Input
          placeholder="Qty"
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-16"
        />
      </div>
      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <Button type="submit" size="sm" disabled={!canSubmit} className="w-full">
        Add Custom Item
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Create `item-detail-card.tsx`**

Extract the existing `ItemDetailCard` component from `add-item-modal.tsx` (about 180 lines) into its own file. Keep the same props interface:

```typescript
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";
import { rarityTextClass } from "@/lib/inventory/rarity-colors";

export interface SearchResult {
  id: string;
  name: string;
  slug: string;
  content_type: string;
  data: Record<string, unknown>;
  effects: Array<Record<string, unknown>>;
}

interface ItemDetailCardProps {
  item: SearchResult;
  quantity: number;
  onQuantityChange: (q: number) => void;
  onAdd: () => void;
}

function formatCost(cost: unknown): string {
  if (!cost || typeof cost !== "object") return "";
  const c = cost as { quantity?: number; unit?: string };
  if (c.quantity == null) return "";
  return `${c.quantity} ${c.unit ?? "gp"}`;
}

export function ItemDetailCard({
  item,
  quantity,
  onQuantityChange,
  onAdd,
}: ItemDetailCardProps) {
  const [showFullDescription, setShowFullDescription] = useState(false);
  const data = item.data;
  const rarity = data.rarity as string | undefined;
  const damage = data.damage as { dice?: string; type?: string } | null;
  const armorClass = data.armor_class as
    | { base?: number; dex_bonus?: boolean; max_bonus?: number }
    | null;
  const armorCategory = data.armor_category as string | undefined;
  const weight = data.weight as number | undefined;
  const cost = data.cost;
  const properties = (data.properties as string[] | undefined) ?? [];
  const description = data.description as string | undefined;
  const sourceRefs = data.source_refs as Array<{ book?: string; page?: number }> | undefined;

  const displayDesc = description
    ? showFullDescription
      ? description
      : description.slice(0, 200) + (description.length > 200 ? "…" : "")
    : null;

  return (
    <div className="rounded-md border border-border bg-card/50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[9px] uppercase">
            {item.content_type === "magic_item" ? "Magic" : item.content_type}
          </Badge>
          {rarity && (
            <span className={`text-xs font-medium ${rarityTextClass(rarity)}`}>
              {rarity}
            </span>
          )}
          {armorCategory && (
            <span className="text-xs text-muted-foreground">
              {armorCategory} armor
            </span>
          )}
        </div>
      </div>

      {damage && (damage.dice || damage.type) && (
        <p className="text-xs">
          <span className="text-muted-foreground">Damage:</span>{" "}
          <span className="font-medium">
            {damage.dice ?? "?"} {damage.type ?? ""}
          </span>
        </p>
      )}

      {armorClass?.base != null && (
        <p className="text-xs">
          <span className="text-muted-foreground">AC:</span>{" "}
          <span className="font-medium">
            {armorClass.base}
            {armorClass.dex_bonus &&
              (armorClass.max_bonus != null
                ? ` + Dex (max +${armorClass.max_bonus})`
                : " + Dex")}
          </span>
        </p>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {weight != null && weight > 0 && <span>{weight} lb</span>}
        {formatCost(cost) && <span>{formatCost(cost)}</span>}
        {properties.length > 0 && <span>{properties.join(", ")}</span>}
      </div>

      {displayDesc && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {displayDesc}
          {description && description.length > 200 && (
            <button
              type="button"
              onClick={() => setShowFullDescription(!showFullDescription)}
              className="ml-1 text-primary underline"
            >
              {showFullDescription ? "less" : "more"}
            </button>
          )}
        </p>
      )}

      {sourceRefs && sourceRefs.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          Source:{" "}
          {sourceRefs
            .map((r) => `${r.book ?? "?"} p${r.page ?? "?"}`)
            .join(", ")}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-6 w-6"
            onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
          >
            <Minus className="size-3" />
          </Button>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => onQuantityChange(parseInt(e.target.value) || 1)}
            className="w-12 h-6 text-center text-xs rounded border border-input bg-background"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-6 w-6"
            onClick={() => onQuantityChange(quantity + 1)}
          >
            <Plus className="size-3" />
          </Button>
        </div>
        <Button type="button" size="sm" onClick={onAdd} className="flex-1">
          Add to Inventory
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `add-item-panel.tsx`**

Create `components/sheet/inventory/add-item-panel.tsx`. This is the main panel composing the three extracted pieces. Start with this skeleton based on the old `add-item-modal.tsx`:

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  searchItems,
  type SearchItemsOptions,
} from "@/lib/supabase/inventory";
import { rarityTextClass } from "@/lib/inventory/rarity-colors";
import {
  ItemFilters,
  type CategoryPill,
} from "@/components/sheet/inventory/item-filters";
import { CustomItemForm } from "@/components/sheet/inventory/custom-item-form";
import {
  ItemDetailCard,
  type SearchResult,
} from "@/components/sheet/inventory/item-detail-card";

const CATEGORY_TO_CONTENT_TYPE: Record<CategoryPill, SearchItemsOptions> = {
  Armor: { equipmentCategory: "Armor" },
  Weapon: { equipmentCategory: "Weapon" },
  Potion: { equipmentCategory: "Potion" },
  Ring: { equipmentCategory: "Ring" },
  Rod: { equipmentCategory: "Rod" },
  Scroll: { equipmentCategory: "Scroll" },
  Staff: { equipmentCategory: "Staff" },
  Wand: { equipmentCategory: "Wand" },
  Wondrous: { equipmentCategory: "Wondrous" },
  Gear: { equipmentCategory: "Gear" },
};

export interface AddItemPanelProps {
  open: boolean;
  onClose: () => void;
  onAdd: (item: {
    content_id: string | null;
    name: string;
    content_type: string;
    quantity?: number;
    custom_data?: Record<string, unknown> | null;
  }) => void;
  systemId: string;
}

export function AddItemPanel({
  open,
  onClose,
  onAdd,
  systemId,
}: AddItemPanelProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryPill | null>(null);
  const [magicalOnly, setMagicalOnly] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [showCustom, setShowCustom] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async () => {
    setLoading(true);
    const opts: SearchItemsOptions = {
      ...(category ? CATEGORY_TO_CONTENT_TYPE[category] : {}),
      magicalOnly: magicalOnly || undefined,
    };
    const data = await searchItems(systemId, query, opts);
    setResults(data);
    setLoading(false);
  }, [systemId, query, category, magicalOnly]);

  useEffect(() => {
    if (!open) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(runSearch, 200);
  }, [runSearch, open]);

  if (!open) return null;

  const getQuantity = (id: string) => quantities[id] ?? 1;
  const setQuantity = (id: string, q: number) =>
    setQuantities((prev) => ({ ...prev, [id]: q }));

  const handleAdd = (item: SearchResult, qty: number) => {
    onAdd({
      content_id: item.id,
      name: item.name,
      content_type: item.content_type,
      quantity: qty,
    });
    setExpandedId(null);
  };

  return (
    <div className="rounded-lg border border-border bg-background space-y-3 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Add item</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search items…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      <ItemFilters
        selected={category}
        onSelect={setCategory}
        magicalOnly={magicalOnly}
        onMagicalToggle={setMagicalOnly}
      />

      <div className="max-h-[400px] overflow-y-auto space-y-1">
        {loading && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Searching…
          </p>
        )}
        {!loading && results.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No items found. Try adjusting filters.
          </p>
        )}
        {results.map((item) => {
          const rarity = item.data?.rarity as string | undefined;
          const isExpanded = expandedId === item.id;
          return (
            <div
              key={item.id}
              className="rounded border border-border/50 overflow-hidden"
            >
              <button
                type="button"
                onClick={() =>
                  setExpandedId(isExpanded ? null : item.id)
                }
                className="w-full flex items-center justify-between px-2 py-1.5 text-left hover:bg-accent/30"
              >
                <span
                  className={`text-sm font-medium ${rarityTextClass(rarity)}`}
                >
                  {item.name}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase">
                  {item.content_type === "magic_item"
                    ? "Magic"
                    : item.content_type}
                </span>
              </button>
              {isExpanded && (
                <div className="p-2 border-t border-border/50">
                  <ItemDetailCard
                    item={item}
                    quantity={getQuantity(item.id)}
                    onQuantityChange={(q) => setQuantity(item.id, q)}
                    onAdd={() => handleAdd(item, getQuantity(item.id))}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showCustom ? (
        <CustomItemForm
          onAdd={(item) => {
            onAdd(item);
            setShowCustom(false);
          }}
          onCancel={() => setShowCustom(false)}
        />
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setShowCustom(true)}
        >
          + Add custom item
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Update importers to use the new file**

Find everywhere `add-item-modal` is imported:

```
grep -rn "add-item-modal" components/ app/ --include="*.tsx" --include="*.ts"
```

Update each import to `add-item-panel`. Most likely `components/sheet/tabs/inventory-tab.tsx` is the only importer.

- [ ] **Step 7: Delete the old file**

```bash
rm components/sheet/inventory/add-item-modal.tsx
```

- [ ] **Step 8: Run build**

Run: `npm run build 2>&1 | tail -20`
Expected: Clean build.

- [ ] **Step 9: Run tests**

Run: `npx vitest run`
Expected: All 156 tests pass.

- [ ] **Step 10: Manual smoke test**

Run: `npm run dev`, open the inventory tab, click Add Item:
- Panel opens inline
- Search returns results
- Filter pills toggle
- "Magical only" checkbox filters
- Expanding an item shows detail card with quantity controls
- Click Add → item appears in inventory
- Custom item form works

- [ ] **Step 11: Commit**

```bash
git add components/sheet/inventory/ components/sheet/tabs/inventory-tab.tsx
git commit -m "refactor: split add-item panel into filters + custom-form + detail-card"
```

---

### Task 11: Add CRUD + State Helper Tests

**Why eleventh:** After the refactor is stable, add tests to lock in the new contracts.

**Files:**
- Create: `tests/sheet/update-state.test.ts`
- Create: `tests/supabase/inventory.test.ts`

- [ ] **Step 1: Write `update-state.test.ts`**

Create `tests/sheet/update-state.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateCharacterState } from "@/lib/sheet/update-state";

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: (name: string, args: unknown) => rpcMock(name, args),
    from: (table: string) => fromMock(table),
  }),
}));

beforeEach(() => {
  rpcMock.mockReset();
  fromMock.mockReset();
});

describe("updateCharacterState", () => {
  it("calls patch_character_state RPC with character_id and state_patch", async () => {
    rpcMock.mockResolvedValue({ error: null });
    await updateCharacterState("char-123", { current_hp: 42 });

    expect(rpcMock).toHaveBeenCalledWith("patch_character_state", {
      character_id: "char-123",
      state_patch: { current_hp: 42 },
    });
  });

  it("falls back to select+update when RPC fails", async () => {
    rpcMock.mockResolvedValue({ error: { message: "no rpc" } });

    const updateSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const selectSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { state: { current_hp: 10, conditions: ["prone"] } },
          error: null,
        }),
      }),
    });

    fromMock.mockReturnValue({
      select: selectSpy,
      update: updateSpy,
    });

    await updateCharacterState("char-456", { current_hp: 20 });

    // fromMock is called for both select and update paths
    expect(fromMock).toHaveBeenCalledWith("characters");
    expect(selectSpy).toHaveBeenCalledWith("state");
    expect(updateSpy).toHaveBeenCalledWith({
      state: { current_hp: 20, conditions: ["prone"] },
    });
  });
});
```

- [ ] **Step 2: Write `inventory.test.ts`**

Create `tests/supabase/inventory.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.fn();
const orderMock = vi.fn();
const eqMock = vi.fn();
const selectMock = vi.fn();
const insertMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
const singleMock = vi.fn();
const ilikeMock = vi.fn();
const limitMock = vi.fn();
const inMock = vi.fn();
const orMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => fromMock(table),
  }),
}));

function makeChain() {
  const chain = {
    select: selectMock,
    insert: insertMock,
    update: updateMock,
    delete: deleteMock,
    order: orderMock,
    eq: eqMock,
    single: singleMock,
    ilike: ilikeMock,
    limit: limitMock,
    in: inMock,
    or: orMock,
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  const chain = makeChain();
  selectMock.mockReturnValue(chain);
  insertMock.mockReturnValue(chain);
  updateMock.mockReturnValue(chain);
  deleteMock.mockReturnValue(chain);
  orderMock.mockReturnValue(chain);
  eqMock.mockReturnValue(chain);
  singleMock.mockResolvedValue({ data: {}, error: null });
  ilikeMock.mockReturnValue(chain);
  limitMock.mockResolvedValue({ data: [], error: null });
  inMock.mockReturnValue(chain);
  orMock.mockReturnValue(chain);
  fromMock.mockReturnValue(chain);
});

describe("getInventoryForCharacter", () => {
  it("selects by character_id with content_definitions join", async () => {
    orderMock.mockReturnValueOnce({
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    const { getInventoryForCharacter } = await import("@/lib/supabase/inventory");
    await getInventoryForCharacter("char-1");
    expect(fromMock).toHaveBeenCalledWith("character_inventory");
    expect(selectMock).toHaveBeenCalledWith(
      expect.stringContaining("content_definitions"),
    );
    expect(eqMock).toHaveBeenCalledWith("character_id", "char-1");
  });
});

describe("addInventoryItem", () => {
  it("inserts with character_id and defaults quantity to 1", async () => {
    singleMock.mockResolvedValue({
      data: {
        id: "inv-1",
        character_id: "char-1",
        content_id: "c1",
        name: "Longsword",
        content_type: "weapon",
        quantity: 1,
      },
      error: null,
    });
    const { addInventoryItem } = await import("@/lib/supabase/inventory");
    const result = await addInventoryItem("char-1", {
      content_id: "c1",
      name: "Longsword",
      content_type: "weapon",
    });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        character_id: "char-1",
        content_id: "c1",
        name: "Longsword",
        content_type: "weapon",
        quantity: 1,
      }),
    );
    expect(result?.name).toBe("Longsword");
  });
});

describe("updateInventoryItem", () => {
  it("updates the item by id with the patch", async () => {
    eqMock.mockResolvedValueOnce({ error: null });
    const { updateInventoryItem } = await import("@/lib/supabase/inventory");
    await updateInventoryItem("inv-1", { equipped: true });
    expect(updateMock).toHaveBeenCalledWith({ equipped: true });
    expect(eqMock).toHaveBeenCalledWith("id", "inv-1");
  });
});

describe("removeInventoryItem", () => {
  it("deletes the item by id", async () => {
    eqMock.mockResolvedValueOnce({ error: null });
    const { removeInventoryItem } = await import("@/lib/supabase/inventory");
    await removeInventoryItem("inv-1");
    expect(deleteMock).toHaveBeenCalled();
    expect(eqMock).toHaveBeenCalledWith("id", "inv-1");
  });
});

describe("unequipAllArmor", () => {
  it("updates equipped=false for all armor rows of a character", async () => {
    eqMock.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const { unequipAllArmor } = await import("@/lib/supabase/inventory");
    await unequipAllArmor("char-1");
    expect(updateMock).toHaveBeenCalledWith({ equipped: false });
  });
});
```

- [ ] **Step 3: Run the new tests**

Run: `npx vitest run tests/sheet/update-state.test.ts tests/supabase/inventory.test.ts`
Expected: All pass. If any tests fail, adjust the mocks to match the actual implementation's chain calls.

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: 156 + ~12 = ~168 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/sheet/update-state.test.ts tests/supabase/inventory.test.ts
git commit -m "test: cover updateCharacterState RPC fallback and inventory CRUD"
```

---

### Task 12: Component Smoke Tests

**Why last:** Locks in the refactored shapes with actual UI tests.

**Files:**
- Create: `tests/components/narrative/use-narrative-editor.test.ts`
- Create: `tests/components/sheet/inventory-tab.test.tsx`
- Create: `tests/components/sheet/add-item-panel.test.tsx`

- [ ] **Step 1: Write the narrative hook test**

Create `tests/components/narrative/use-narrative-editor.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNarrativeEditor } from "@/components/narrative/use-narrative-editor";
import type { CharacterWithSystem } from "@/lib/types/character";

vi.mock("@/app/(app)/characters/[id]/narrative-actions", () => ({
  saveNarrative: vi.fn().mockResolvedValue({ success: true }),
  saveNarrativeRich: vi.fn().mockResolvedValue({ success: true }),
  saveChoices: vi.fn().mockResolvedValue({ success: true }),
}));

function makeChar(): CharacterWithSystem {
  return {
    id: "char-1",
    name: "Test",
    narrative: { full_name: "Saved Name" },
    narrative_rich: {},
    choices: {},
  } as unknown as CharacterWithSystem;
}

describe("useNarrativeEditor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("starts in view mode", () => {
    const { result } = renderHook(() => useNarrativeEditor({ character: makeChar() }));
    expect(result.current.editMode).toBe(false);
  });

  it("enters edit mode and copies saved values to local", () => {
    const { result } = renderHook(() => useNarrativeEditor({ character: makeChar() }));
    act(() => result.current.enterEdit());
    expect(result.current.editMode).toBe(true);
    expect(result.current.localNarrative.full_name).toBe("Saved Name");
  });

  it("handleNarrativeChange marks dirty and schedules save", async () => {
    const { saveNarrative } = await import(
      "@/app/(app)/characters/[id]/narrative-actions"
    );
    const { result } = renderHook(() =>
      useNarrativeEditor({ character: makeChar() }),
    );
    act(() => result.current.enterEdit());
    act(() => result.current.handleNarrativeChange("full_name", "New"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(saveNarrative).toHaveBeenCalledWith(
      "char-1",
      expect.objectContaining({ full_name: "New" }),
    );
  });

  it("handleCancel reverts local to saved and exits edit mode", () => {
    const { result } = renderHook(() =>
      useNarrativeEditor({ character: makeChar() }),
    );
    act(() => result.current.enterEdit());
    act(() => result.current.handleNarrativeChange("full_name", "Draft"));
    act(() => result.current.handleCancel());
    expect(result.current.editMode).toBe(false);
    expect(result.current.localNarrative.full_name).toBe("Saved Name");
  });
});
```

- [ ] **Step 2: Write the inventory tab test**

Create `tests/components/sheet/inventory-tab.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InventoryTab } from "@/components/sheet/tabs/inventory-tab";
import type {
  CharacterContextValue,
} from "@/lib/character/character-context";

const mockCtx: Partial<CharacterContextValue> = {
  inventory: [],
  currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
  addItem: vi.fn().mockResolvedValue(undefined),
  updateItem: vi.fn().mockResolvedValue(undefined),
  removeItem: vi.fn().mockResolvedValue(undefined),
  setCurrency: vi.fn(),
  character: {
    id: "char-1",
    name: "Test",
    system_id: "sys-1",
  } as unknown as CharacterContextValue["character"],
  evalResult: {
    stats: { strength: 14 },
    computed: {},
    narratives: [],
    grants: [],
    speed: { walk: 30 },
    vision: [],
    dmgres: [],
    savetxt: { adv_vs: [], immune: [] },
    attacks: 1,
    improvements: false,
  } as unknown as CharacterContextValue["evalResult"],
};

vi.mock("@/lib/character/character-context", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/character/character-context")
  >("@/lib/character/character-context");
  return {
    ...actual,
    useCharacter: () => ({
      character: mockCtx.character,
      evalResult: mockCtx.evalResult,
      schema: {},
      contentRefs: [],
      isOwner: true,
      isDm: false,
      hasSheet: true,
      maxHp: 10,
    }),
    useInventory: () => ({
      inventory: mockCtx.inventory,
      currency: mockCtx.currency,
      addItem: mockCtx.addItem,
      updateItem: mockCtx.updateItem,
      removeItem: mockCtx.removeItem,
      setCurrency: mockCtx.setCurrency,
    }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("InventoryTab", () => {
  it("renders an empty inventory message", () => {
    mockCtx.inventory = [];
    render(<InventoryTab />);
    // At minimum, the "Add Item" button should be visible
    expect(
      screen.getByRole("button", { name: /add item/i }),
    ).toBeInTheDocument();
  });

  it("renders a weapons section when a weapon is equipped", () => {
    mockCtx.inventory = [
      {
        id: "inv-1",
        character_id: "char-1",
        content_id: "c1",
        name: "Longsword",
        content_type: "weapon",
        quantity: 1,
        equipped: false,
        attuned: false,
        sort_order: 0,
        notes: null,
        custom_data: null,
        created_at: "2026-01-01",
        content_definitions: {
          id: "c1",
          name: "Longsword",
          slug: "longsword",
          content_type: "weapon",
          data: {
            damage: { dice: "1d8", type: "slashing" },
            weight: 3,
          },
          effects: [],
        },
      },
    ];
    render(<InventoryTab />);
    expect(screen.getByText("Longsword")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Write the add-item-panel test**

Create `tests/components/sheet/add-item-panel.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AddItemPanel } from "@/components/sheet/inventory/add-item-panel";

vi.mock("@/lib/supabase/inventory", () => ({
  searchItems: vi.fn().mockResolvedValue([
    {
      id: "c1",
      name: "Longsword",
      slug: "longsword",
      content_type: "weapon",
      data: { damage: { dice: "1d8", type: "slashing" }, weight: 3 },
      effects: [],
    },
  ]),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AddItemPanel", () => {
  it("returns null when closed", () => {
    const { container } = render(
      <AddItemPanel
        open={false}
        onClose={() => {}}
        onAdd={() => {}}
        systemId="sys-1"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders search input and filter pills when open", () => {
    render(
      <AddItemPanel
        open={true}
        onClose={() => {}}
        onAdd={() => {}}
        systemId="sys-1"
      />,
    );
    expect(
      screen.getByPlaceholderText(/search items/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /armor/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /weapon/i })).toBeInTheDocument();
  });

  it("clicking a filter pill toggles it", () => {
    render(
      <AddItemPanel
        open={true}
        onClose={() => {}}
        onAdd={() => {}}
        systemId="sys-1"
      />,
    );
    const armorPill = screen.getByRole("button", { name: /armor/i });
    fireEvent.click(armorPill);
    // The pill's class should reflect selected state (presence of bg-primary class)
    expect(armorPill.className).toContain("bg-primary");
  });

  it("clicking custom item button shows the form", () => {
    render(
      <AddItemPanel
        open={true}
        onClose={() => {}}
        onAdd={() => {}}
        systemId="sys-1"
      />,
    );
    const button = screen.getByRole("button", { name: /custom item/i });
    fireEvent.click(button);
    expect(screen.getByPlaceholderText(/item name/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run new tests**

Run: `npx vitest run tests/components/narrative/ tests/components/sheet/`
Expected: All pass. If component tests fail due to DOM/jsdom setup issues, verify `vitest.config.ts` uses `environment: "jsdom"` and Testing Library is installed.

- [ ] **Step 5: Run full suite**

Run: `npx vitest run`
Expected: ~168 + ~10 = ~178 tests pass.

- [ ] **Step 6: Commit**

```bash
git add tests/components/
git commit -m "test: add smoke tests for useNarrativeEditor, InventoryTab, AddItemPanel"
```

---

### Task 13: Final Verification

**Why last:** Sanity check that everything composes correctly.

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (target ~175-180).

- [ ] **Step 2: Run production build**

Run: `npm run build 2>&1 | tail -20`
Expected: Clean build, no type errors.

- [ ] **Step 3: Count lines on refactored files**

Run: `wc -l components/character/character-page-client.tsx components/character/character-shell.tsx components/character/sheet-panel.tsx components/narrative/narrative-tab.tsx components/sheet/inventory/add-item-panel.tsx`

Expected:
- `character-page-client.tsx`: under 150
- `character-shell.tsx`: under 120
- `sheet-panel.tsx`: under 130
- `narrative-tab.tsx`: under 200
- `add-item-panel.tsx`: under 300

- [ ] **Step 4: Verify dead code is gone**

```bash
test ! -e components/sheet/sheet-client.tsx && echo "sheet-client.tsx removed"
test ! -d "app/(app)/characters/[id]/builder/details" && echo "builder/details removed"
test ! -e components/sheet/inventory/add-item-modal.tsx && echo "add-item-modal.tsx removed"
```

Expected: All three confirmations print.

- [ ] **Step 5: Count cast patterns**

Run: `grep -rn "as Record<string, unknown>" components/ app/ --include="*.tsx" --include="*.ts" | wc -l`
Expected: Under 10 (down from 17).

Run: `grep -rn "as any" components/ app/ --include="*.tsx" --include="*.ts" | grep -v "comment"`
Expected: Zero matches.

- [ ] **Step 6: Manual smoke test on dev server**

Run: `npm run dev`. On a character page:
- Sheet tab renders with correct AC, stats, skills
- Narrative tab: click Edit → change name → see auto-save → Save → value persists on refresh
- Portrait upload on narrative updates header instantly
- Add inventory item → appears in correct section
- Equip armor → AC updates
- Equip shield → AC +2
- Attune magic item → counter updates
- Mobile viewport: all tabs still work

- [ ] **Step 7: Push the branch**

```bash
git push -u origin feat/cleanup-before-spells
```

- [ ] **Step 8: Open PR**

```bash
gh pr create --title "refactor: cleanup pass before spell management" --body "See docs/superpowers/specs/2026-04-15-cleanup-before-spells-design.md for the full design. This PR removes 506 lines of dead code, introduces CharacterContext + 4 consumer hooks to replace 8-prop pass-throughs, splits three large files (add-item-modal 585, narrative-tab 486, character-page-client 329) into hooks + sub-components, adds ~25 new tests covering inventory CRUD, state updates, hooks, and components."
```
