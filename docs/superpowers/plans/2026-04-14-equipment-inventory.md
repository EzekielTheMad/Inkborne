# Equipment & Inventory System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full inventory management for D&D 5e characters — item tracking with equip/attune state, real AC from armor, weapon attacks, currency, weight tracking, and searchable item database.

**Architecture:** New `character_inventory` table with FK to `content_definitions` for item data inheritance. Inventory state drives the evaluator — equipped armor generates AC effects, equipped weapons populate the Actions tab. Currency lives in `character.state`. UI is a categorized-sections inventory tab with an add-item search modal.

**Tech Stack:** TypeScript, Next.js 16, Supabase (Postgres + RLS), Zod, Vitest

**Spec:** `docs/superpowers/specs/2026-04-14-equipment-inventory-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/00025_character_inventory.sql` | Create | Table, indexes, RLS policies |
| `lib/types/inventory.ts` | Create | InventoryItem type, Currency type |
| `lib/supabase/inventory.ts` | Create | CRUD: getInventory, addItem, updateItem, removeItem, searchItems |
| `lib/inventory/armor-effects.ts` | Create | Generate AC effects from equipped armor data |
| `tests/inventory/armor-effects.test.ts` | Create | Tests for AC effect generation |
| `lib/types/character.ts` | Modify | Add Currency to CharacterState |
| `components/sheet/tabs/inventory-tab.tsx` | Rewrite | Full categorized inventory UI |
| `components/sheet/inventory/inventory-section.tsx` | Create | Collapsible section component |
| `components/sheet/inventory/add-item-modal.tsx` | Create | Search + add item modal |
| `components/sheet/inventory/currency-tracker.tsx` | Create | Editable currency fields |
| `components/sheet/inventory/weight-bar.tsx` | Create | Weight total + carrying capacity bar |
| `app/(app)/characters/[id]/page.tsx` | Modify | Fetch inventory rows |
| `components/character/character-page-client.tsx` | Modify | Inventory state, equip/attune handlers, AC integration |
| `components/sheet/content-tabs.tsx` | Modify | Pass inventory props to InventoryTab |
| `components/sheet/tabs/actions-tab.tsx` | Modify | Read weapons from inventory instead of contentRefs |
| `supabase/migrations/00026_magic_item_enrichment.sql` | Create | Attunement flags + effects on magic items |

---

### Task 1: Database Migration — `character_inventory` Table

**Files:**
- Create: `supabase/migrations/00025_character_inventory.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Migration: Create character_inventory table for equipment tracking

CREATE TABLE character_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  content_id uuid REFERENCES content_definitions(id) ON DELETE SET NULL,
  name text NOT NULL,
  content_type text NOT NULL DEFAULT 'item',
  quantity int NOT NULL DEFAULT 1,
  equipped boolean NOT NULL DEFAULT false,
  attuned boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  notes text,
  custom_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_inventory_character ON character_inventory(character_id);
CREATE INDEX idx_inventory_character_equipped ON character_inventory(character_id, equipped);
CREATE INDEX idx_inventory_content ON character_inventory(content_id);

-- RLS
ALTER TABLE character_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage inventory"
ON character_inventory FOR ALL
TO authenticated
USING (
  character_id IN (
    SELECT id FROM characters WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  character_id IN (
    SELECT id FROM characters WHERE user_id = auth.uid()
  )
);
```

- [ ] **Step 2: Apply migration to Supabase**

Run via `execute_sql` MCP tool against project `etcaodglvcspcmwecyxq`.

- [ ] **Step 3: Verify table exists**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'character_inventory'
ORDER BY ordinal_position;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00025_character_inventory.sql
git commit -m "feat: create character_inventory table with indexes and RLS"
```

---

### Task 2: Inventory Types

**Files:**
- Create: `lib/types/inventory.ts`
- Modify: `lib/types/character.ts`

- [ ] **Step 1: Create inventory types**

```typescript
// lib/types/inventory.ts

export interface InventoryItem {
  id: string;
  character_id: string;
  content_id: string | null;
  name: string;
  content_type: string; // weapon | armor | item | magic_item
  quantity: number;
  equipped: boolean;
  attuned: boolean;
  sort_order: number;
  notes: string | null;
  custom_data: Record<string, unknown> | null;
  created_at: string;
  // Joined from content_definitions when fetched
  content_definitions?: {
    id: string;
    name: string;
    slug: string;
    content_type: string;
    data: Record<string, unknown>;
    effects: Array<Record<string, unknown>>;
  } | null;
}

export interface Currency {
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
}

export const DEFAULT_CURRENCY: Currency = {
  cp: 0,
  sp: 0,
  ep: 0,
  gp: 0,
  pp: 0,
};
```

- [ ] **Step 2: Add Currency to CharacterState**

In `lib/types/character.ts`, add to the `CharacterState` interface (before the index signature):

```typescript
  // Currency
  currency?: Currency;
```

And add the import at the top:

```typescript
import type { Currency } from "./inventory";
```

- [ ] **Step 3: Commit**

```bash
git add lib/types/inventory.ts lib/types/character.ts
git commit -m "feat: add InventoryItem and Currency types"
```

---

### Task 3: Inventory CRUD Helpers

**Files:**
- Create: `lib/supabase/inventory.ts`

- [ ] **Step 1: Create the CRUD module**

Follow the pattern from `lib/supabase/content-refs.ts`. All functions use the server Supabase client.

```typescript
// lib/supabase/inventory.ts
import { createClient } from "@/lib/supabase/client";
import type { InventoryItem } from "@/lib/types/inventory";

const INVENTORY_SELECT = "*, content_definitions(id, name, slug, content_type, data, effects)";

export async function getInventory(characterId: string): Promise<InventoryItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("character_inventory")
    .select(INVENTORY_SELECT)
    .eq("character_id", characterId)
    .order("sort_order")
    .order("name");

  if (error) {
    console.error("[getInventory] Error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function addInventoryItem(
  characterId: string,
  item: {
    content_id?: string | null;
    name: string;
    content_type: string;
    quantity?: number;
    custom_data?: Record<string, unknown> | null;
  },
): Promise<InventoryItem | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("character_inventory")
    .insert({
      character_id: characterId,
      content_id: item.content_id ?? null,
      name: item.name,
      content_type: item.content_type,
      quantity: item.quantity ?? 1,
      custom_data: item.custom_data ?? null,
    })
    .select(INVENTORY_SELECT)
    .single();

  if (error) {
    console.error("[addInventoryItem] Error:", error.message);
    return null;
  }
  return data;
}

export async function updateInventoryItem(
  itemId: string,
  updates: Partial<Pick<InventoryItem, "quantity" | "equipped" | "attuned" | "notes" | "sort_order" | "custom_data">>,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("character_inventory")
    .update(updates)
    .eq("id", itemId);

  if (error) {
    console.error("[updateInventoryItem] Error:", error.message);
  }
}

export async function removeInventoryItem(itemId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("character_inventory")
    .delete()
    .eq("id", itemId);

  if (error) {
    console.error("[removeInventoryItem] Error:", error.message);
  }
}

export async function searchItems(
  systemId: string,
  query: string,
  contentType?: string,
): Promise<Array<{ id: string; name: string; slug: string; content_type: string; data: Record<string, unknown> }>> {
  const supabase = createClient();
  let q = supabase
    .from("content_definitions")
    .select("id, name, slug, content_type, data")
    .eq("system_id", systemId)
    .in("content_type", contentType ? [contentType] : ["weapon", "armor", "item", "magic_item"])
    .or(`scope.eq.platform,and(scope.eq.personal,owner_id.eq.${(await supabase.auth.getUser()).data.user?.id})`)
    .ilike("name", `%${query}%`)
    .order("name")
    .limit(30);

  const { data, error } = await q;
  if (error) {
    console.error("[searchItems] Error:", error.message);
    return [];
  }
  return data ?? [];
}

/** Unequip all armor for a character (used when equipping new armor — only one at a time) */
export async function unequipAllArmor(characterId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("character_inventory")
    .update({ equipped: false })
    .eq("character_id", characterId)
    .eq("content_type", "armor")
    .eq("equipped", true);

  if (error) {
    console.error("[unequipAllArmor] Error:", error.message);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase/inventory.ts
git commit -m "feat: add inventory CRUD helpers (get, add, update, remove, search)"
```

---

### Task 4: Armor AC Effect Generator

**Files:**
- Create: `lib/inventory/armor-effects.ts`
- Create: `tests/inventory/armor-effects.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/inventory/armor-effects.test.ts
import { describe, it, expect } from "vitest";
import { generateArmorEffects } from "@/lib/inventory/armor-effects";

describe("generateArmorEffects", () => {
  it("generates set effect for heavy armor (no DEX)", () => {
    const effects = generateArmorEffects({
      armor_category: "Heavy",
      armor_class: { base: 16, dex_bonus: false },
    });
    expect(effects).toEqual([
      {
        type: "mechanical",
        stat: "armor_class",
        op: "formula",
        expr: "16",
        tag: "ac_formula",
        condition: { field: "equipped_armor", op: "neq", value: "none" },
      },
    ]);
  });

  it("generates formula effect for light armor (full DEX)", () => {
    const effects = generateArmorEffects({
      armor_category: "Light",
      armor_class: { base: 11, dex_bonus: true },
    });
    expect(effects).toEqual([
      {
        type: "mechanical",
        stat: "armor_class",
        op: "formula",
        expr: "11 + mod(dexterity)",
        tag: "ac_formula",
        condition: { field: "equipped_armor", op: "neq", value: "none" },
      },
    ]);
  });

  it("generates formula with max bonus for medium armor", () => {
    const effects = generateArmorEffects({
      armor_category: "Medium",
      armor_class: { base: 14, dex_bonus: true, max_bonus: 2 },
    });
    expect(effects).toEqual([
      {
        type: "mechanical",
        stat: "armor_class",
        op: "formula",
        expr: "14 + min(mod(dexterity), 2)",
        tag: "ac_formula",
        condition: { field: "equipped_armor", op: "neq", value: "none" },
      },
    ]);
  });

  it("generates +2 AC for shield", () => {
    const effects = generateArmorEffects({
      armor_category: "Shield",
      armor_class: { base: 2, dex_bonus: false },
    });
    expect(effects).toEqual([
      {
        type: "mechanical",
        stat: "armor_class",
        op: "add",
        value: 2,
      },
    ]);
  });

  it("returns empty array for null data", () => {
    expect(generateArmorEffects(null)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/inventory/armor-effects.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement generateArmorEffects**

```typescript
// lib/inventory/armor-effects.ts
import type { MechanicalEffect } from "@/lib/types/effects";

interface ArmorData {
  armor_category: string;
  armor_class: {
    base: number;
    dex_bonus: boolean;
    max_bonus?: number | null;
  };
}

/**
 * Generate mechanical effects from equipped armor data.
 * Returns effects that enter the AC best-of system.
 */
export function generateArmorEffects(
  data: ArmorData | null | undefined,
): MechanicalEffect[] {
  if (!data?.armor_class) return [];

  const { armor_category, armor_class: ac } = data;

  // Shield: flat +2 AC bonus (not a formula, stacks on top)
  if (armor_category === "Shield") {
    return [
      {
        type: "mechanical",
        stat: "armor_class",
        op: "add",
        value: ac.base,
      },
    ];
  }

  // Build AC formula based on armor type
  let expr: string;

  if (!ac.dex_bonus) {
    // Heavy armor: flat AC, no DEX
    expr = String(ac.base);
  } else if (ac.max_bonus != null) {
    // Medium armor: base + min(DEX mod, max_bonus)
    expr = `${ac.base} + min(mod(dexterity), ${ac.max_bonus})`;
  } else {
    // Light armor: base + full DEX mod
    expr = `${ac.base} + mod(dexterity)`;
  }

  return [
    {
      type: "mechanical",
      stat: "armor_class",
      op: "formula",
      expr,
      tag: "ac_formula",
      condition: { field: "equipped_armor", op: "neq", value: "none" },
    },
  ];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/inventory/armor-effects.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add lib/inventory/armor-effects.ts tests/inventory/armor-effects.test.ts
git commit -m "feat: generateArmorEffects — AC effects from equipped armor data"
```

---

### Task 5: Inventory UI Components

**Files:**
- Create: `components/sheet/inventory/inventory-section.tsx`
- Create: `components/sheet/inventory/currency-tracker.tsx`
- Create: `components/sheet/inventory/weight-bar.tsx`

- [ ] **Step 1: Create InventorySection (collapsible section)**

```typescript
// components/sheet/inventory/inventory-section.tsx
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface InventorySectionProps {
  title: string;
  count: number;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  highlight?: boolean;
  children: React.ReactNode;
}

export function InventorySection({
  title,
  count,
  badge,
  defaultOpen = true,
  highlight = false,
  children,
}: InventorySectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn(
      "rounded-lg border border-border overflow-hidden",
      highlight && "border-accent/30 bg-accent/5",
    )}>
      <button
        type="button"
        className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium hover:bg-accent/10 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-2">
          {title}
          <span className="text-xs text-muted-foreground">({count})</span>
          {badge}
        </span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1">
          {children}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create CurrencyTracker**

```typescript
// components/sheet/inventory/currency-tracker.tsx
"use client";

import type { Currency } from "@/lib/types/inventory";

interface CurrencyTrackerProps {
  currency: Currency;
  onChange: (currency: Currency) => void;
}

const DENOMINATIONS: Array<{ key: keyof Currency; label: string; color: string }> = [
  { key: "pp", label: "PP", color: "text-blue-300" },
  { key: "gp", label: "GP", color: "text-accent" },
  { key: "ep", label: "EP", color: "text-gray-300" },
  { key: "sp", label: "SP", color: "text-gray-400" },
  { key: "cp", label: "CP", color: "text-orange-400" },
];

export function CurrencyTracker({ currency, onChange }: CurrencyTrackerProps) {
  function handleChange(key: keyof Currency, value: string) {
    const num = parseInt(value) || 0;
    onChange({ ...currency, [key]: Math.max(0, num) });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs font-medium text-muted-foreground mb-2">Currency</p>
      <div className="flex gap-2">
        {DENOMINATIONS.map(({ key, label, color }) => (
          <div key={key} className="flex-1 text-center">
            <input
              type="number"
              min={0}
              value={currency[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              className="w-full h-7 rounded border border-input bg-background px-1 text-center text-sm font-medium"
            />
            <p className={cn("text-[10px] font-medium mt-0.5", color)}>{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
```

Wait — `cn` is already imported in other components from `@/lib/utils`. Fix the CurrencyTracker to import it:

```typescript
// Replace the local cn function at the bottom with an import at the top:
import { cn } from "@/lib/utils";
// And remove the local cn function definition
```

- [ ] **Step 3: Create WeightBar**

```typescript
// components/sheet/inventory/weight-bar.tsx
"use client";

interface WeightBarProps {
  totalWeight: number;
  carryingCapacity: number;
}

export function WeightBar({ totalWeight, carryingCapacity }: WeightBarProps) {
  const pct = carryingCapacity > 0 ? Math.min((totalWeight / carryingCapacity) * 100, 100) : 0;
  const isEncumbered = carryingCapacity > 0 && totalWeight > carryingCapacity / 3;
  const isHeavy = carryingCapacity > 0 && totalWeight > (carryingCapacity * 2) / 3;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Weight</span>
        <span className={isHeavy ? "text-destructive font-medium" : isEncumbered ? "text-yellow-500" : "text-muted-foreground"}>
          {totalWeight} lb / {carryingCapacity} lb
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isHeavy ? "bg-destructive" : isEncumbered ? "bg-yellow-500" : "bg-primary"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add components/sheet/inventory/inventory-section.tsx components/sheet/inventory/currency-tracker.tsx components/sheet/inventory/weight-bar.tsx
git commit -m "feat: inventory sub-components — collapsible section, currency tracker, weight bar"
```

---

### Task 6: Add Item Search Modal

**Files:**
- Create: `components/sheet/inventory/add-item-modal.tsx`

- [ ] **Step 1: Create the search modal component**

This component renders a dialog with a search input, category filter tabs, and results list. When an item is clicked, it calls `onAdd` with the content definition data. It also has a "Custom Item" form.

```typescript
// components/sheet/inventory/add-item-modal.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { searchItems } from "@/lib/supabase/inventory";

interface AddItemModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (item: {
    content_id: string | null;
    name: string;
    content_type: string;
    custom_data?: Record<string, unknown> | null;
  }) => void;
  systemId: string;
}

const FILTER_TABS = [
  { value: "", label: "All" },
  { value: "weapon", label: "Weapons" },
  { value: "armor", label: "Armor" },
  { value: "item", label: "Gear" },
  { value: "magic_item", label: "Magic Items" },
];

export function AddItemModal({ open, onClose, onAdd, systemId }: AddItemModalProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [results, setResults] = useState<Array<{ id: string; name: string; slug: string; content_type: string; data: Record<string, unknown> }>>([]);
  const [loading, setLoading] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customType, setCustomType] = useState("item");

  const doSearch = useCallback(async () => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const items = await searchItems(systemId, query, filter || undefined);
    setResults(items);
    setLoading(false);
  }, [systemId, query, filter]);

  useEffect(() => {
    const timer = setTimeout(doSearch, 300);
    return () => clearTimeout(timer);
  }, [doSearch]);

  function handleAdd(item: typeof results[number]) {
    onAdd({
      content_id: item.id,
      name: item.name,
      content_type: item.content_type,
    });
    onClose();
    setQuery("");
    setResults([]);
  }

  function handleAddCustom() {
    if (!customName.trim()) return;
    onAdd({
      content_id: null,
      name: customName.trim(),
      content_type: customType,
    });
    onClose();
    setCustomName("");
    setShowCustom(false);
  }

  function getItemSubtext(item: typeof results[number]): string {
    const data = item.data;
    if (item.content_type === "weapon") {
      const dmg = data.damage as { dice: string; type: string } | null;
      return dmg ? `${dmg.dice} ${dmg.type}` : "";
    }
    if (item.content_type === "armor") {
      const ac = data.armor_class as { base: number } | null;
      return ac ? `AC ${ac.base}` : "";
    }
    if (item.content_type === "magic_item") {
      return (data.rarity as string) ?? "";
    }
    const weight = data.weight as number | null;
    return weight ? `${weight} lb` : "";
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Item</DialogTitle>
        </DialogHeader>

        {showCustom ? (
          <div className="space-y-3">
            <Input
              placeholder="Item name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              autoFocus
            />
            <select
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="item">Gear</option>
              <option value="weapon">Weapon</option>
              <option value="armor">Armor</option>
              <option value="magic_item">Magic Item</option>
            </select>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCustom(false)}>
                Back
              </Button>
              <Button size="sm" onClick={handleAddCustom} disabled={!customName.trim()}>
                Add Custom Item
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            <div className="flex gap-1 flex-wrap">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setFilter(tab.value)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    filter === tab.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5">
              {loading && <p className="text-sm text-muted-foreground py-4 text-center">Searching...</p>}
              {!loading && query.length >= 2 && results.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No items found</p>
              )}
              {results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent/50 transition-colors text-left"
                  onClick={() => handleAdd(item)}
                >
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{getItemSubtext(item)}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {item.content_type === "magic_item" ? "Magic" : item.content_type}
                  </Badge>
                </button>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={() => setShowCustom(true)} className="w-full">
              <Plus className="size-4 mr-1" />
              Custom Item
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/sheet/inventory/add-item-modal.tsx
git commit -m "feat: add-item search modal with filter tabs and custom item form"
```

---

### Task 7: Inventory Tab (Full Rewrite)

**Files:**
- Rewrite: `components/sheet/tabs/inventory-tab.tsx`

- [ ] **Step 1: Rewrite the inventory tab**

This is the main component that renders the categorized sections, equipped items, currency, weight, and the add-item button.

```typescript
// components/sheet/tabs/inventory-tab.tsx
"use client";

import { useState } from "react";
import { Plus, Sword, Shield, Package, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { InventoryItem, Currency } from "@/lib/types/inventory";
import { DEFAULT_CURRENCY } from "@/lib/types/inventory";
import type { EvaluationResult } from "@/lib/engine/evaluator";
import { InventorySection } from "@/components/sheet/inventory/inventory-section";
import { CurrencyTracker } from "@/components/sheet/inventory/currency-tracker";
import { WeightBar } from "@/components/sheet/inventory/weight-bar";
import { AddItemModal } from "@/components/sheet/inventory/add-item-modal";

interface InventoryTabProps {
  inventory: InventoryItem[];
  currency: Currency;
  systemId: string;
  strengthScore: number;
  onAddItem: (item: { content_id: string | null; name: string; content_type: string }) => void;
  onUpdateItem: (itemId: string, updates: Partial<Pick<InventoryItem, "quantity" | "equipped" | "attuned" | "notes">>) => void;
  onRemoveItem: (itemId: string) => void;
  onCurrencyChange: (currency: Currency) => void;
}

function getItemWeight(item: InventoryItem): number {
  if (item.custom_data?.weight != null) return Number(item.custom_data.weight);
  const dataWeight = item.content_definitions?.data?.weight;
  return typeof dataWeight === "number" ? dataWeight : 0;
}

function getItemData(item: InventoryItem): Record<string, unknown> {
  return { ...(item.content_definitions?.data ?? {}), ...(item.custom_data ?? {}) };
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
  const [showAddModal, setShowAddModal] = useState(false);

  const equipped = inventory.filter((i) => i.equipped);
  const weapons = inventory.filter((i) => i.content_type === "weapon");
  const armor = inventory.filter((i) => i.content_type === "armor" || (i.content_definitions?.data as Record<string, unknown>)?.armor_category === "Shield");
  const gear = inventory.filter((i) => i.content_type === "item");
  const magicItems = inventory.filter((i) => i.content_type === "magic_item");

  const totalWeight = inventory.reduce((sum, i) => sum + getItemWeight(i) * i.quantity, 0);
  const carryingCapacity = strengthScore * 15;
  const attunedCount = inventory.filter((i) => i.attuned).length;

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Inventory</p>
        <Button size="sm" variant="outline" onClick={() => setShowAddModal(true)}>
          <Plus className="size-3.5 mr-1" />
          Add Item
        </Button>
      </div>

      {/* Equipped section */}
      {equipped.length > 0 && (
        <InventorySection title="Equipped" count={equipped.length} highlight defaultOpen>
          {equipped.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onUpdate={(updates) => onUpdateItem(item.id, updates)}
              onRemove={() => onRemoveItem(item.id)}
              showEquipToggle={false}
            />
          ))}
        </InventorySection>
      )}

      {/* Weapons */}
      {weapons.length > 0 && (
        <InventorySection title="Weapons" count={weapons.length}>
          {weapons.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onUpdate={(updates) => onUpdateItem(item.id, updates)}
              onRemove={() => onRemoveItem(item.id)}
            />
          ))}
        </InventorySection>
      )}

      {/* Armor & Shields */}
      {armor.length > 0 && (
        <InventorySection title="Armor & Shields" count={armor.length}>
          {armor.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onUpdate={(updates) => onUpdateItem(item.id, updates)}
              onRemove={() => onRemoveItem(item.id)}
            />
          ))}
        </InventorySection>
      )}

      {/* Gear */}
      {gear.length > 0 && (
        <InventorySection title="Gear" count={gear.length}>
          {gear.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onUpdate={(updates) => onUpdateItem(item.id, updates)}
              onRemove={() => onRemoveItem(item.id)}
              showQuantity
            />
          ))}
        </InventorySection>
      )}

      {/* Magic Items */}
      {magicItems.length > 0 && (
        <InventorySection
          title="Magic Items"
          count={magicItems.length}
          badge={<Badge variant="secondary" className="text-[10px]">{attunedCount}/3 attuned</Badge>}
        >
          {magicItems.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onUpdate={(updates) => onUpdateItem(item.id, updates)}
              onRemove={() => onRemoveItem(item.id)}
              showAttunement
              attunedCount={attunedCount}
            />
          ))}
        </InventorySection>
      )}

      {/* Currency */}
      <CurrencyTracker currency={currency} onChange={onCurrencyChange} />

      {/* Weight */}
      <WeightBar totalWeight={Math.round(totalWeight)} carryingCapacity={carryingCapacity} />

      {/* Add Item Modal */}
      <AddItemModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={onAddItem}
        systemId={systemId}
      />
    </div>
  );
}

// --- Item Row ---

interface ItemRowProps {
  item: InventoryItem;
  onUpdate: (updates: Partial<Pick<InventoryItem, "quantity" | "equipped" | "attuned">>) => void;
  onRemove: () => void;
  showEquipToggle?: boolean;
  showQuantity?: boolean;
  showAttunement?: boolean;
  attunedCount?: number;
}

function ItemRow({
  item,
  onUpdate,
  onRemove,
  showEquipToggle = true,
  showQuantity = false,
  showAttunement = false,
  attunedCount = 0,
}: ItemRowProps) {
  const data = getItemData(item);
  const weight = getItemWeight(item);

  // Weapon info
  const damage = data.damage as { dice: string; type: string } | null;
  const properties = (data.properties as string[]) ?? [];

  // Armor info
  const armorClass = data.armor_class as { base: number; dex_bonus?: boolean; max_bonus?: number } | null;
  const armorCategory = data.armor_category as string | undefined;

  // Magic item info
  const rarity = data.rarity as string | undefined;
  const requiresAttunement = data.requires_attunement as boolean | undefined;

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-accent/30 transition-colors group text-sm">
      {/* Equip toggle */}
      {showEquipToggle && (
        <button
          type="button"
          onClick={() => onUpdate({ equipped: !item.equipped })}
          className={`size-4 rounded border shrink-0 flex items-center justify-center text-[10px] ${
            item.equipped
              ? "bg-primary border-primary text-primary-foreground"
              : "border-muted-foreground/50 hover:border-primary"
          }`}
          title={item.equipped ? "Unequip" : "Equip"}
        >
          {item.equipped && "✓"}
        </button>
      )}

      {/* Name + details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">{item.name}</span>
          {item.quantity > 1 && !showQuantity && (
            <span className="text-xs text-muted-foreground">×{item.quantity}</span>
          )}
          {rarity && (
            <Badge variant="outline" className="text-[9px] shrink-0">{rarity}</Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {damage && <span>{damage.dice} {damage.type}</span>}
          {armorClass && <span>AC {armorClass.base}{armorCategory ? ` (${armorCategory})` : ""}</span>}
          {properties.length > 0 && <span> · {properties.join(", ")}</span>}
          {weight > 0 && <span> · {weight} lb</span>}
        </div>
      </div>

      {/* Quantity editor */}
      {showQuantity && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="size-5 rounded border border-input text-xs hover:bg-accent"
            onClick={() => onUpdate({ quantity: Math.max(1, item.quantity - 1) })}
          >
            -
          </button>
          <span className="text-xs w-5 text-center">{item.quantity}</span>
          <button
            type="button"
            className="size-5 rounded border border-input text-xs hover:bg-accent"
            onClick={() => onUpdate({ quantity: item.quantity + 1 })}
          >
            +
          </button>
        </div>
      )}

      {/* Attunement toggle */}
      {showAttunement && requiresAttunement && (
        <button
          type="button"
          onClick={() => {
            if (!item.attuned && attunedCount >= 3) return; // cap at 3
            onUpdate({ attuned: !item.attuned });
          }}
          className={`px-2 py-0.5 rounded text-[10px] font-medium ${
            item.attuned
              ? "bg-primary text-primary-foreground"
              : attunedCount >= 3
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
          title={item.attuned ? "Remove attunement" : attunedCount >= 3 ? "Max 3 attuned items" : "Attune"}
        >
          {item.attuned ? "Attuned" : "Attune"}
        </button>
      )}

      {/* Delete */}
      <button
        type="button"
        className="size-5 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={onRemove}
        title="Remove item"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/sheet/tabs/inventory-tab.tsx
git commit -m "feat: rewrite inventory tab — categorized sections, equip/attune/quantity controls"
```

---

### Task 8: Wire Inventory into Character Page

**Files:**
- Modify: `app/(app)/characters/[id]/page.tsx`
- Modify: `components/character/character-page-client.tsx`
- Modify: `components/sheet/content-tabs.tsx`

- [ ] **Step 1: Fetch inventory in the server page**

In `app/(app)/characters/[id]/page.tsx`, after fetching contentRefs, add:

```typescript
// Fetch inventory
const { data: inventoryRows } = await supabase
  .from("character_inventory")
  .select("*, content_definitions(id, name, slug, content_type, data, effects)")
  .eq("character_id", id)
  .order("sort_order")
  .order("name");
```

Pass `inventory={inventoryRows ?? []}` to `CharacterPageClient`.

- [ ] **Step 2: Add inventory state and handlers to CharacterPageClient**

Add to `CharacterPageClientProps`:
```typescript
inventory: InventoryItem[];
```

Add local inventory state and handlers:
```typescript
const [localInventory, setLocalInventory] = useState<InventoryItem[]>(inventory);

async function handleAddItem(item: { content_id: string | null; name: string; content_type: string }) {
  const newItem = await addInventoryItem(character.id, item);
  if (newItem) {
    setLocalInventory((prev) => [...prev, newItem]);
  }
}

async function handleUpdateItem(itemId: string, updates: Partial<Pick<InventoryItem, "quantity" | "equipped" | "attuned" | "notes">>) {
  // If equipping armor, unequip other armor first
  if (updates.equipped === true) {
    const item = localInventory.find((i) => i.id === itemId);
    const itemData = item?.content_definitions?.data as Record<string, unknown> | undefined;
    if (item?.content_type === "armor" && itemData?.armor_category !== "Shield") {
      await unequipAllArmor(character.id);
      setLocalInventory((prev) =>
        prev.map((i) =>
          i.content_type === "armor" && i.id !== itemId && (i.content_definitions?.data as Record<string, unknown>)?.armor_category !== "Shield"
            ? { ...i, equipped: false }
            : i
        )
      );
    }
  }

  await updateInventoryItem(itemId, updates);
  setLocalInventory((prev) =>
    prev.map((i) => (i.id === itemId ? { ...i, ...updates } : i))
  );
}

async function handleRemoveItem(itemId: string) {
  await removeInventoryItem(itemId);
  setLocalInventory((prev) => prev.filter((i) => i.id !== itemId));
}

function handleCurrencyChange(newCurrency: Currency) {
  patchState({ currency: newCurrency });
}
```

Add imports at top:
```typescript
import type { InventoryItem, Currency } from "@/lib/types/inventory";
import { DEFAULT_CURRENCY } from "@/lib/types/inventory";
import { addInventoryItem, updateInventoryItem, removeInventoryItem, unequipAllArmor } from "@/lib/supabase/inventory";
```

- [ ] **Step 3: Generate armor AC effects from equipped inventory**

In the `useMemo` that calls `evaluate()`, add armor effects from equipped items:

```typescript
import { generateArmorEffects } from "@/lib/inventory/armor-effects";

// Inside CharacterPageClient, before the evaluate useMemo:
const equippedArmorEffects = useMemo(() => {
  const equippedArmor = localInventory.find(
    (i) => i.equipped && i.content_type === "armor" &&
    (i.content_definitions?.data as Record<string, unknown>)?.armor_category !== "Shield"
  );
  if (!equippedArmor) return [];
  return generateArmorEffects(equippedArmor.content_definitions?.data as { armor_category: string; armor_class: { base: number; dex_bonus: boolean; max_bonus?: number } } | null);
}, [localInventory]);

// Derive equipped_armor state from inventory
const derivedState = useMemo(() => {
  const equippedArmor = localInventory.find(
    (i) => i.equipped && i.content_type === "armor" &&
    (i.content_definitions?.data as Record<string, unknown>)?.armor_category !== "Shield"
  );
  const hasShield = localInventory.some(
    (i) => i.equipped && (i.content_definitions?.data as Record<string, unknown>)?.armor_category === "Shield"
  );
  const armorCategory = equippedArmor
    ? ((equippedArmor.content_definitions?.data as Record<string, unknown>)?.armor_category as string)?.toLowerCase() ?? "none"
    : "none";
  return {
    ...state,
    equipped_armor: armorCategory,
    shield_equipped: hasShield,
  };
}, [localInventory, state]);

// Update the evaluate useMemo to use derivedState and include armor effects:
const evalResult = useMemo(() => {
  const combinedEffects = [...allEffects, ...equippedArmorEffects];
  return evaluate(baseStatsWithLevel, combinedEffects, schema, structuredSources, derivedState as Record<string, unknown>);
}, [baseStatsWithLevel, allEffects, equippedArmorEffects, schema, structuredSources, derivedState]);
```

- [ ] **Step 4: Pass inventory props through ContentTabs to InventoryTab**

In `content-tabs.tsx`, update the InventoryTab rendering to pass the new props. The ContentTabs component needs to receive and forward inventory-related props.

Add to `ContentTabsProps`:
```typescript
inventory: InventoryItem[];
currency: Currency;
systemId: string;
strengthScore: number;
onAddItem: (item: { content_id: string | null; name: string; content_type: string }) => void;
onUpdateItem: (itemId: string, updates: Partial<Pick<InventoryItem, "quantity" | "equipped" | "attuned" | "notes">>) => void;
onRemoveItem: (itemId: string) => void;
onCurrencyChange: (currency: Currency) => void;
```

Update the InventoryTab rendering in the switch/conditional:
```typescript
<InventoryTab
  inventory={inventory}
  currency={currency}
  systemId={systemId}
  strengthScore={strengthScore}
  onAddItem={onAddItem}
  onUpdateItem={onUpdateItem}
  onRemoveItem={onRemoveItem}
  onCurrencyChange={onCurrencyChange}
/>
```

- [ ] **Step 5: Run build to verify no type errors**

Run: `npm run build`
Expected: Clean build

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/characters/[id]/page.tsx" "components/character/character-page-client.tsx" "components/sheet/content-tabs.tsx"
git commit -m "feat: wire inventory into character page — fetch, state, equip/attune, AC integration"
```

---

### Task 9: Remove Old Equipment State Dropdown

**Files:**
- Modify: `components/character/character-page-client.tsx`
- Modify: `components/sheet/sheet-client.tsx` (if still used)

- [ ] **Step 1: Remove the EquipmentState dropdown from the sheet layout**

The old `EquipmentState` component (armor category dropdown + shield toggle) is now replaced by the inventory system. Remove it from the desktop and mobile layouts in `CharacterPageClient`. The evaluator now derives `equipped_armor` from actual inventory items.

Remove the `<EquipmentState>` component usage and its import. Keep the file in case it's needed as a fallback, but don't render it.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Clean build

- [ ] **Step 3: Commit**

```bash
git add "components/character/character-page-client.tsx"
git commit -m "fix: remove old armor category dropdown — replaced by inventory equip system"
```

---

### Task 10: Magic Item Enrichment Migration

**Files:**
- Create: `supabase/migrations/00026_magic_item_enrichment.sql`

- [ ] **Step 1: Research the magic item data**

Query all magic items and categorize them for enrichment:
```sql
SELECT name, slug, data->>'description' as description, data->>'rarity' as rarity, data->>'equipment_category' as category
FROM content_definitions
WHERE content_type = 'magic_item' AND source = 'srd'
ORDER BY name;
```

- [ ] **Step 2: Write the enrichment migration**

This is a large migration. Prioritize the most commonly used items first:

1. **+X weapons and ammunition** (Longsword +1/+2/+3, Arrow +1/+2/+3, etc.)
2. **+X armor and shields** (Plate +1/+2/+3, Shield +1/+2/+3, etc.)
3. **Stat-setting items** (Belt of Giant Strength variants, Headband of Intellect, Amulet of Health, etc.)
4. **AC/save bonus items** (Cloak of Protection, Ring of Protection)
5. **Resistance items** (Ring of Resistance, armor-based resistances)
6. **Add `requires_attunement` flag** to all items based on description text

Pattern for enrichment:
```sql
-- Example: Longsword +1
UPDATE content_definitions
SET
  data = data || '{"requires_attunement": false}'::jsonb,
  effects = '[
    {"type":"mechanical","stat":"attack_bonus","op":"add","value":1},
    {"type":"mechanical","stat":"damage_bonus","op":"add","value":1}
  ]'::jsonb
WHERE slug = 'longsword-1' AND content_type = 'magic_item' AND source = 'srd';
```

This task requires significant research and iteration. The migration should be built incrementally — start with the pattern-matchable items (+X weapons/armor, stat setters) and extend from there.

- [ ] **Step 3: Apply migration to Supabase**

- [ ] **Step 4: Verify enrichment**

```sql
SELECT name, data->>'requires_attunement' as attunement, jsonb_array_length(effects) as effect_count
FROM content_definitions
WHERE content_type = 'magic_item' AND source = 'srd'
AND effects != '[]'::jsonb
ORDER BY name
LIMIT 20;
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00026_magic_item_enrichment.sql
git commit -m "feat: enrich SRD magic items with attunement flags and mechanical effects"
```

---

### Task 11: Integration Verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Clean build

- [ ] **Step 3: Start dev server and test full flow**

Test scenarios:
1. Open character → Inventory tab shows empty or starting items
2. Click "Add Item" → search for "greataxe" → add to inventory
3. Equip the greataxe → appears in Equipped section → Actions tab shows attack roll
4. Search for "chain mail" → add → equip → AC updates to 16 (heavy, no DEX)
5. Unequip chain mail → AC reverts to Unarmored Defense formula
6. Add a magic item → toggle attunement → verify attunement counter
7. Try to attune a 4th item → UI blocks
8. Edit currency → values persist on reload
9. Check weight total updates as items are added/removed

- [ ] **Step 4: Push and create PR**

```bash
git push -u origin feat/equipment-inventory
gh pr create --title "feat: equipment & inventory system" --base main
```
