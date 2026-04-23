# Feature Resources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship runtime tracking + UI for class-feature usage counters (Rage, Ki, Channel Divinity, Bardic Inspiration, Lay on Hands, Action Surge, Second Wind, Superiority Dice, Sorcery Points, Wild Shape uses, and any feature authored with `usages` + `recovery`).

**Architecture:** Data-driven — any feature content with `usages > 0` and `recovery` set produces a resource. State tracks *spent* uses (`feature_uses: Record<string, number>`); max is computed from data per render via a memoized helper. Shared `<ResourceCounter>` component renders in the left-column `<ResourcesWidget>` (grouped by recovery) and inline on Features-tab cards.

**Tech Stack:** TypeScript strict, React (client components), Vitest, React Testing Library, Tailwind. No DB migration required.

**Reference spec:** `docs/superpowers/specs/2026-04-23-feature-resources-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `lib/types/resources.ts` | Create | `FeatureResource`, `ResourceRecovery` types |
| `lib/types/character.ts` | Modify | Add `feature_uses?: Record<string, number>` to `CharacterState` |
| `lib/resources/helpers.ts` | Create | `normalizeRecovery`, `getMaxUses`, `computeResources`, `groupByRecovery` |
| `lib/character/character-context.tsx` | Modify | Add `useResources()` hook; compute resources via `useMemo`, expose spend/restore/setUsed |
| `components/sheet/resource-counter.tsx` | Create | Reusable counter with `layout="widget" \| "card"` variants |
| `components/sheet/resources-widget.tsx` | Create | Left-column grouped-by-recovery widget |
| `components/character/sheet-panel.tsx` | Modify | Insert `<ResourcesWidget />` between `<Defenses />` and `<Conditions />` |
| `components/sheet/tabs/features-tab.tsx` | Modify | Render inline `<ResourceCounter layout="card" />` where resource matches feature |
| `tests/resources/helpers.test.ts` | Create | Helper unit tests |
| `tests/components/sheet/resource-counter.test.tsx` | Create | Counter component tests |
| `tests/components/sheet/resources-widget.test.tsx` | Create | Widget tests (grouping, empty-state hide) |

---

## Task Order (Single Wave — Sequential Dependencies)

Tasks are sequential because each downstream task imports from the previous:

1. Types (defines shapes)
2. Helpers (TDD; depends on types)
3. Context integration (depends on helpers)
4. `ResourceCounter` component (depends on types)
5. `ResourcesWidget` component (depends on Counter + context)
6. SheetPanel integration (depends on Widget)
7. Features tab inline counter (depends on Counter + context)
8. End-to-end verification

---

### Task 1: Types & State Extension

**Files:**
- Create: `lib/types/resources.ts`
- Modify: `lib/types/character.ts`

- [ ] **Step 1: Create `lib/types/resources.ts`**

```typescript
// Feature Resources — shared types for class-feature usage counters.
//
// A FeatureResource represents one counter on the sheet (Rage, Ki, one entry
// from extraLimitedFeatures, etc.). Max is computed from content data; spent
// is tracked in CharacterState.feature_uses, keyed by `slug`.

export type ResourceRecovery = "short" | "long";

export interface FeatureResource {
  /** Key into CharacterState.feature_uses. For primary feature resources this is
   *  the feature content slug; for extraLimitedFeatures it is `${slug}.${extraKey}`. */
  slug: string;

  /** Display name, e.g. "Rage" or "Wild Shape: Rampage". */
  name: string;

  /** Maximum uses/points at the character's current level in the source class. */
  max: number;

  /** Normalized recovery type: "short" (short rest) or "long" (long rest).
   *  "dawn" and "day" from schema are both mapped to "long". */
  recovery: ResourceRecovery;

  /** Display label for source, e.g. "Barbarian 1". Shown on the feature card variant. */
  sourceLabel: string;

  /** Slug of the parent feature that owns this resource. Equals `slug` for primary
   *  resources; differs for extraLimitedFeatures (parent slug) vs sub-resource slug. */
  sourceFeatureSlug: string;
}
```

- [ ] **Step 2: Modify `lib/types/character.ts` — add `feature_uses` to `CharacterState`**

Add after the existing `spell_slots_used` / `concentrating_on` lines (around line 50-51) within the `CharacterState` interface:

```typescript
  /** Uses spent per feature resource. Key = FeatureResource.slug; value = spent count.
   *  Max is computed per render; spent clamped to [0, max] on read. */
  feature_uses?: Record<string, number>;
```

- [ ] **Step 3: Verify types compile**

Run: `npm run build`
Expected: build succeeds with no new type errors.

- [ ] **Step 4: Commit**

```bash
git add lib/types/resources.ts lib/types/character.ts
git commit -m "feat: FeatureResource type + feature_uses state field"
```

---

### Task 2: Helpers (TDD)

**Files:**
- Create: `lib/resources/helpers.ts`
- Create: `tests/resources/helpers.test.ts`

- [ ] **Step 1: Write failing test file `tests/resources/helpers.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import {
  normalizeRecovery,
  getMaxUses,
  computeResources,
  groupByRecovery,
} from "@/lib/resources/helpers";
import type { FeatureResource } from "@/lib/types/resources";

describe("normalizeRecovery", () => {
  it("maps short rest to short", () => {
    expect(normalizeRecovery("short rest")).toBe("short");
  });
  it("maps long rest to long", () => {
    expect(normalizeRecovery("long rest")).toBe("long");
  });
  it("maps dawn to long", () => {
    expect(normalizeRecovery("dawn")).toBe("long");
  });
  it("maps day to long", () => {
    expect(normalizeRecovery("day")).toBe("long");
  });
  it("returns null for null/undefined", () => {
    expect(normalizeRecovery(null)).toBe(null);
    expect(normalizeRecovery(undefined)).toBe(null);
  });
});

describe("getMaxUses", () => {
  it("returns fixed number as-is", () => {
    expect(getMaxUses(3, 1)).toBe(3);
  });
  it("resolves per-level array at classLevel-1 index", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    expect(getMaxUses(arr, 1)).toBe(1);
    expect(getMaxUses(arr, 5)).toBe(5);
    expect(getMaxUses(arr, 20)).toBe(20);
  });
  it("returns 0 for null entry in array", () => {
    const arr = [null, null, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
    expect(getMaxUses(arr, 1)).toBe(0);
    expect(getMaxUses(arr, 3)).toBe(2);
  });
  it("returns 0 for undefined usages", () => {
    expect(getMaxUses(undefined, 1)).toBe(0);
  });
  it("clamps classLevel below 1 to 0", () => {
    expect(getMaxUses([1, 2, 3], 0)).toBe(0);
  });
});

describe("computeResources", () => {
  // Synthetic feature fixture helper
  function feature(slug: string, data: Record<string, unknown>) {
    return {
      id: `id-${slug}`,
      content_id: `content-${slug}`,
      character_id: "char-1",
      content_version: 1,
      context: {},
      choice_source: null,
      created_at: "2026-04-23",
      content_definitions: {
        id: `content-${slug}`,
        slug,
        name: slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        content_type: "feature",
        data,
        version: 1,
      },
    };
  }

  it("returns empty array when no features", () => {
    expect(computeResources([], [])).toEqual([]);
  });

  it("excludes feature with no usages", () => {
    const refs = [feature("dummy", { class: "wizard", level: 1, description: "x" })];
    expect(computeResources(refs, [{ slug: "wizard", level: 3 }])).toEqual([]);
  });

  it("excludes feature with usages but no recovery", () => {
    const refs = [feature("dummy", { class: "wizard", level: 1, description: "x", usages: 3, recovery: null })];
    expect(computeResources(refs, [{ slug: "wizard", level: 3 }])).toEqual([]);
  });

  it("builds a resource from fixed-number usages", () => {
    const refs = [feature("action_surge", {
      class: "fighter",
      level: 2,
      description: "x",
      usages: 1,
      recovery: "short rest",
    })];
    const result = computeResources(refs, [{ slug: "fighter", level: 2 }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      slug: "action_surge",
      name: "Action Surge",
      max: 1,
      recovery: "short",
      sourceLabel: "Fighter 2",
      sourceFeatureSlug: "action_surge",
    });
  });

  it("resolves per-level array usages against class level", () => {
    const rageArr = [2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 99];
    const refs = [feature("rage", {
      class: "barbarian",
      level: 1,
      description: "x",
      usages: rageArr,
      recovery: "long rest",
    })];
    const result = computeResources(refs, [{ slug: "barbarian", level: 5 }]);
    expect(result[0].max).toBe(3); // index 4 -> rageArr[4] = 3
  });

  it("maps dawn and day to long recovery", () => {
    const refs = [
      feature("dawnfeat", { class: "wizard", level: 1, description: "x", usages: 1, recovery: "dawn" }),
      feature("dayfeat", { class: "wizard", level: 1, description: "x", usages: 1, recovery: "day" }),
    ];
    const result = computeResources(refs, [{ slug: "wizard", level: 1 }]);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.recovery === "long")).toBe(true);
  });

  it("includes extraLimitedFeatures as separate entries", () => {
    const refs = [feature("wild_shape", {
      class: "druid",
      level: 2,
      description: "x",
      usages: 2,
      recovery: "short rest",
      extraLimitedFeatures: [
        { name: "Primal Strike", usages: 1, recovery: "long rest" },
      ],
    })];
    const result = computeResources(refs, [{ slug: "druid", level: 2 }]);
    expect(result).toHaveLength(2);
    const parent = result.find((r) => r.slug === "wild_shape");
    const extra = result.find((r) => r.slug === "wild_shape.primal_strike");
    expect(parent).toBeDefined();
    expect(parent?.max).toBe(2);
    expect(parent?.recovery).toBe("short");
    expect(extra).toBeDefined();
    expect(extra?.max).toBe(1);
    expect(extra?.recovery).toBe("long");
    expect(extra?.name).toBe("Wild Shape: Primal Strike");
    expect(extra?.sourceFeatureSlug).toBe("wild_shape");
  });

  it("skips features for classes the character doesn't have", () => {
    const refs = [feature("rage", { class: "barbarian", level: 1, description: "x", usages: 2, recovery: "long rest" })];
    const result = computeResources(refs, [{ slug: "fighter", level: 5 }]);
    expect(result).toEqual([]);
  });

  it("skips features whose resolved max is 0", () => {
    const refs = [feature("nothing", {
      class: "fighter",
      level: 11,
      description: "x",
      usages: [null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      recovery: "long rest",
    })];
    const result = computeResources(refs, [{ slug: "fighter", level: 5 }]);
    expect(result).toEqual([]);
  });

  it("skips non-feature content types", () => {
    const refs = [{
      id: "id1", content_id: "c1", character_id: "ch", content_version: 1,
      context: {}, choice_source: null, created_at: "",
      content_definitions: {
        id: "c1", slug: "longsword", name: "Longsword", content_type: "weapon",
        data: { usages: 1, recovery: "long rest" }, version: 1,
      },
    }];
    expect(computeResources(refs as never, [{ slug: "fighter", level: 1 }])).toEqual([]);
  });
});

describe("groupByRecovery", () => {
  const mk = (slug: string, name: string, recovery: "short" | "long"): FeatureResource => ({
    slug, name, max: 1, recovery, sourceLabel: "", sourceFeatureSlug: slug,
  });

  it("groups and sorts alphabetically within each group", () => {
    const input = [
      mk("rage", "Rage", "long"),
      mk("ki", "Ki", "short"),
      mk("action_surge", "Action Surge", "short"),
      mk("lay_on_hands", "Lay on Hands", "long"),
    ];
    const result = groupByRecovery(input);
    expect(result.short.map((r) => r.name)).toEqual(["Action Surge", "Ki"]);
    expect(result.long.map((r) => r.name)).toEqual(["Lay on Hands", "Rage"]);
  });

  it("returns empty arrays when input empty", () => {
    expect(groupByRecovery([])).toEqual({ short: [], long: [] });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/resources/helpers.test.ts`
Expected: FAIL — module `@/lib/resources/helpers` cannot be found.

- [ ] **Step 3: Implement `lib/resources/helpers.ts`**

```typescript
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import type { FeatureResource, ResourceRecovery } from "@/lib/types/resources";

/** Normalize schema recovery values to short/long. Dawn and day both map to long. */
export function normalizeRecovery(value: string | null | undefined): ResourceRecovery | null {
  if (value === "short rest") return "short";
  if (value === "long rest" || value === "dawn" || value === "day") return "long";
  return null;
}

/** Resolve max uses from a usages field (number or per-level array) at the given class level. */
export function getMaxUses(
  usages: number | Array<number | null> | undefined,
  classLevel: number,
): number {
  if (usages === undefined || usages === null) return 0;
  if (typeof usages === "number") return usages;
  if (classLevel < 1) return 0;
  const idx = classLevel - 1;
  if (idx >= usages.length) return 0;
  const val = usages[idx];
  return typeof val === "number" ? val : 0;
}

/** Title-case a single word/slug. */
function titleCase(s: string): string {
  return s
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Slugify an extra's name for use as a compound key suffix. */
function slugifyExtra(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/** Compute the full list of active feature resources for the character. */
export function computeResources(
  contentRefs: ContentRefWithContent[],
  classes: Array<{ slug: string; level: number }>,
): FeatureResource[] {
  const out: FeatureResource[] = [];

  for (const ref of contentRefs) {
    const def = ref.content_definitions;
    if (!def || def.content_type !== "feature") continue;

    const data = def.data as Record<string, unknown> | undefined;
    if (!data) continue;

    const classSlug = data.class as string | undefined;
    if (!classSlug) continue;

    const classEntry = classes.find((c) => c.slug === classSlug);
    if (!classEntry) continue;

    const classLevel = classEntry.level;
    const usages = data.usages as number | Array<number | null> | undefined;
    const recoveryRaw = data.recovery as string | null | undefined;
    const recovery = normalizeRecovery(recoveryRaw ?? null);
    const featureGainLevel = typeof data.level === "number" ? data.level : 1;
    const sourceLabel = `${titleCase(classSlug)} ${featureGainLevel}`;

    // Primary resource from usages + recovery
    if (recovery != null) {
      const max = getMaxUses(usages, classLevel);
      if (max > 0) {
        out.push({
          slug: def.slug,
          name: def.name,
          max,
          recovery,
          sourceLabel,
          sourceFeatureSlug: def.slug,
        });
      }
    }

    // Extra limited features — each becomes its own resource
    const extras = data.extraLimitedFeatures as
      | Array<{ name: string; usages: number; recovery: string }>
      | undefined;
    if (Array.isArray(extras)) {
      for (const extra of extras) {
        const extraRecovery = normalizeRecovery(extra.recovery);
        if (extraRecovery == null) continue;
        const extraMax = typeof extra.usages === "number" ? extra.usages : 0;
        if (extraMax <= 0) continue;
        const extraSlug = `${def.slug}.${slugifyExtra(extra.name)}`;
        out.push({
          slug: extraSlug,
          name: `${def.name}: ${extra.name}`,
          max: extraMax,
          recovery: extraRecovery,
          sourceLabel,
          sourceFeatureSlug: def.slug,
        });
      }
    }
  }

  return out;
}

/** Group resources by recovery type; each group sorted alphabetically by name. */
export function groupByRecovery(resources: FeatureResource[]): {
  short: FeatureResource[];
  long: FeatureResource[];
} {
  const short: FeatureResource[] = [];
  const long: FeatureResource[] = [];
  for (const r of resources) {
    (r.recovery === "short" ? short : long).push(r);
  }
  const cmp = (a: FeatureResource, b: FeatureResource) => a.name.localeCompare(b.name);
  short.sort(cmp);
  long.sort(cmp);
  return { short, long };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/resources/helpers.test.ts`
Expected: PASS — all helper tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/resources/helpers.ts tests/resources/helpers.test.ts
git commit -m "feat: resources helpers — normalize/max/compute/group (TDD)"
```

---

### Task 3: CharacterContext — useResources hook

**Files:**
- Modify: `lib/character/character-context.tsx`

- [ ] **Step 1: Read existing context structure to locate insertion points**

Run: `grep -n "useSpells\|export function use\|useMemo\|patchState" lib/character/character-context.tsx | head -20`

You should see `useSpells`, other hook exports, and the `patchState` pattern. We'll mirror `useSpells`'s structure for `useResources`.

- [ ] **Step 2: Add imports**

At the top of `lib/character/character-context.tsx`, add to the existing imports:

```typescript
import { computeResources } from "@/lib/resources/helpers";
import type { FeatureResource } from "@/lib/types/resources";
```

- [ ] **Step 3: Add `resources` to the memoized context value**

Locate the `useMemo` that builds the context value (search for `useMemo(() => ({`). Before it, add:

```typescript
const resources = useMemo<FeatureResource[]>(() => {
  const classChoices = (character.choices?.classes ?? []).map((c) => ({
    slug: c.slug,
    level: c.level,
  }));
  return computeResources(contentRefs, classChoices);
}, [contentRefs, character.choices?.classes]);
```

Then add `resources` to the context value object alongside existing fields.

- [ ] **Step 4: Add `useResources()` hook below the existing hook exports**

At the bottom of the file, below `useSpells` (or wherever the other `use*` exports are grouped):

```typescript
/** Access character's feature-usage resources: read, spend, restore, set absolute. */
export function useResources(): {
  resources: FeatureResource[];
  uses: Record<string, number>;
  spend: (slug: string, amount?: number) => void;
  restore: (slug: string, amount?: number) => void;
  setUsed: (slug: string, newUsed: number) => void;
} {
  const ctx = useContext(CharacterContext);
  if (!ctx) throw new Error("useResources must be used inside CharacterProvider");

  const { resources, state, patchState } = ctx;
  const uses = (state.feature_uses ?? {}) as Record<string, number>;

  const clamp = (resource: FeatureResource | undefined, value: number) => {
    if (!resource) return Math.max(0, value);
    return Math.max(0, Math.min(resource.max, value));
  };

  const setUsed = (slug: string, newUsed: number) => {
    const resource = resources.find((r) => r.slug === slug);
    const clamped = clamp(resource, newUsed);
    patchState({
      feature_uses: { ...uses, [slug]: clamped },
    });
  };

  const spend = (slug: string, amount = 1) => {
    const current = uses[slug] ?? 0;
    setUsed(slug, current + amount);
  };

  const restore = (slug: string, amount = 1) => {
    const current = uses[slug] ?? 0;
    setUsed(slug, current - amount);
  };

  return { resources, uses, spend, restore, setUsed };
}
```

Note: ensure `CharacterContext` and `useContext` are imported at the top of the file (they already are for existing hooks — just confirm by searching `useContext(CharacterContext)` in the file).

- [ ] **Step 5: Expose `resources` from the context value**

In the `useMemo(() => ({` block that builds the context value, add `resources` to the returned object. Search for a line like `spells,` or `casterInfo,` and add `resources,` next to it. Also update the context value TypeScript type if there's an explicit interface — grep for `CharacterContextValue` to find and extend it.

- [ ] **Step 6: Run build + existing tests to ensure no regressions**

Run: `npm run build && npx vitest run`
Expected: PASS — no type errors, all existing tests still green. (We'll add `useResources`-specific component tests when testing the widget.)

- [ ] **Step 7: Commit**

```bash
git add lib/character/character-context.tsx
git commit -m "feat: useResources hook — spend/restore/setUsed with clamping"
```

---

### Task 4: `ResourceCounter` component (TDD)

**Files:**
- Create: `components/sheet/resource-counter.tsx`
- Create: `tests/components/sheet/resource-counter.test.tsx`

- [ ] **Step 1: Write failing test `tests/components/sheet/resource-counter.test.tsx`**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResourceCounter } from "@/components/sheet/resource-counter";
import type { FeatureResource } from "@/lib/types/resources";

function mk(overrides: Partial<FeatureResource> = {}): FeatureResource {
  return {
    slug: "rage",
    name: "Rage",
    max: 3,
    recovery: "long",
    sourceLabel: "Barbarian 1",
    sourceFeatureSlug: "rage",
    ...overrides,
  };
}

describe("ResourceCounter", () => {
  it("renders label and remaining/max", () => {
    render(<ResourceCounter resource={mk()} used={0} onChange={vi.fn()} />);
    expect(screen.getByText("Rage")).toBeInTheDocument();
    expect(screen.getByText("3/3")).toBeInTheDocument();
  });

  it("shows remaining as max minus used", () => {
    render(<ResourceCounter resource={mk()} used={1} onChange={vi.fn()} />);
    expect(screen.getByText("2/3")).toBeInTheDocument();
  });

  it("calls onChange(used+1) when decrement clicked", () => {
    const onChange = vi.fn();
    render(<ResourceCounter resource={mk()} used={1} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /use one/i }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("calls onChange(used-1) when increment clicked", () => {
    const onChange = vi.fn();
    render(<ResourceCounter resource={mk()} used={2} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /restore one/i }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("decrement button is disabled at used === max", () => {
    render(<ResourceCounter resource={mk()} used={3} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /use one/i })).toBeDisabled();
  });

  it("increment button is disabled at used === 0", () => {
    render(<ResourceCounter resource={mk()} used={0} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /restore one/i })).toBeDisabled();
  });

  it("card layout shows source label", () => {
    render(<ResourceCounter resource={mk()} used={0} onChange={vi.fn()} layout="card" />);
    expect(screen.getByText(/Barbarian 1/i)).toBeInTheDocument();
  });

  it("widget layout does not show source label", () => {
    render(<ResourceCounter resource={mk()} used={0} onChange={vi.fn()} layout="widget" />);
    expect(screen.queryByText(/Barbarian 1/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/sheet/resource-counter.test.tsx`
Expected: FAIL — module `@/components/sheet/resource-counter` cannot be found.

- [ ] **Step 3: Implement `components/sheet/resource-counter.tsx`**

```typescript
"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeatureResource } from "@/lib/types/resources";

interface ResourceCounterProps {
  resource: FeatureResource;
  used: number;
  onChange: (newUsed: number) => void;
  layout?: "widget" | "card";
}

/**
 * Shared counter UI for a single feature resource.
 * - widget: compact inline row (used in the left-column ResourcesWidget)
 * - card:   slightly roomier, includes source label (used on Features tab cards)
 */
export function ResourceCounter({
  resource,
  used,
  onChange,
  layout = "widget",
}: ResourceCounterProps) {
  const remaining = Math.max(0, Math.min(resource.max, resource.max - used));
  const exhausted = remaining === 0;
  const atFull = used <= 0;

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        layout === "widget" ? "text-sm" : "text-sm rounded border border-border/60 bg-muted/20 px-2 py-1.5",
        exhausted && "opacity-60",
      )}
    >
      <span className={cn("flex-1 min-w-0 truncate", layout === "card" && "font-medium")}>
        {resource.name}
        {layout === "card" && (
          <span className="ml-2 text-xs text-muted-foreground">{resource.sourceLabel}</span>
        )}
      </span>
      <span className="tabular-nums text-muted-foreground shrink-0">
        {remaining}/{resource.max}
      </span>
      <button
        type="button"
        onClick={() => onChange(used + 1)}
        disabled={exhausted}
        aria-label={`Use one ${resource.name}`}
        className={cn(
          "size-5 rounded border border-border flex items-center justify-center shrink-0",
          "text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-muted-foreground",
        )}
      >
        <Minus className="size-3" />
      </button>
      <button
        type="button"
        onClick={() => onChange(used - 1)}
        disabled={atFull}
        aria-label={`Restore one ${resource.name}`}
        className={cn(
          "size-5 rounded border border-border flex items-center justify-center shrink-0",
          "text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-muted-foreground",
        )}
      >
        <Plus className="size-3" />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/sheet/resource-counter.test.tsx`
Expected: PASS — all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add components/sheet/resource-counter.tsx tests/components/sheet/resource-counter.test.tsx
git commit -m "feat: ResourceCounter component — widget + card layouts with clamping"
```

---

### Task 5: `ResourcesWidget` component (TDD)

**Files:**
- Create: `components/sheet/resources-widget.tsx`
- Create: `tests/components/sheet/resources-widget.test.tsx`

- [ ] **Step 1: Write failing test `tests/components/sheet/resources-widget.test.tsx`**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResourcesWidget } from "@/components/sheet/resources-widget";
import type { FeatureResource } from "@/lib/types/resources";

const mkResource = (overrides: Partial<FeatureResource> = {}): FeatureResource => ({
  slug: "rage",
  name: "Rage",
  max: 3,
  recovery: "long",
  sourceLabel: "Barbarian 1",
  sourceFeatureSlug: "rage",
  ...overrides,
});

let useResourcesMock: () => {
  resources: FeatureResource[];
  uses: Record<string, number>;
  spend: (slug: string) => void;
  restore: (slug: string) => void;
  setUsed: (slug: string, n: number) => void;
};

vi.mock("@/lib/character/character-context", () => ({
  useResources: () => useResourcesMock(),
}));

describe("ResourcesWidget", () => {
  it("returns null when no resources", () => {
    useResourcesMock = () => ({
      resources: [],
      uses: {},
      spend: vi.fn(),
      restore: vi.fn(),
      setUsed: vi.fn(),
    });
    const { container } = render(<ResourcesWidget />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders Short Rest group when only short-rest resources exist", () => {
    useResourcesMock = () => ({
      resources: [mkResource({ slug: "ki", name: "Ki", recovery: "short", max: 5 })],
      uses: {},
      spend: vi.fn(),
      restore: vi.fn(),
      setUsed: vi.fn(),
    });
    render(<ResourcesWidget />);
    expect(screen.getByText(/Short Rest/i)).toBeInTheDocument();
    expect(screen.queryByText(/Long Rest/i)).not.toBeInTheDocument();
    expect(screen.getByText("Ki")).toBeInTheDocument();
  });

  it("renders both groups when resources span recovery types", () => {
    useResourcesMock = () => ({
      resources: [
        mkResource({ slug: "ki", name: "Ki", recovery: "short", max: 5 }),
        mkResource({ slug: "rage", name: "Rage", recovery: "long", max: 3 }),
      ],
      uses: {},
      spend: vi.fn(),
      restore: vi.fn(),
      setUsed: vi.fn(),
    });
    render(<ResourcesWidget />);
    expect(screen.getByText(/Short Rest/i)).toBeInTheDocument();
    expect(screen.getByText(/Long Rest/i)).toBeInTheDocument();
  });

  it("sorts resources alphabetically within groups", () => {
    useResourcesMock = () => ({
      resources: [
        mkResource({ slug: "rage", name: "Rage", recovery: "long" }),
        mkResource({ slug: "lay_on_hands", name: "Lay on Hands", recovery: "long" }),
      ],
      uses: {},
      spend: vi.fn(),
      restore: vi.fn(),
      setUsed: vi.fn(),
    });
    render(<ResourcesWidget />);
    const names = screen.getAllByText(/Rage|Lay on Hands/).map((el) => el.textContent);
    const lay = names.indexOf("Lay on Hands");
    const rage = names.indexOf("Rage");
    expect(lay).toBeLessThan(rage);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/sheet/resources-widget.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `components/sheet/resources-widget.tsx`**

```typescript
"use client";

import { Moon, Sun } from "lucide-react";
import { useResources } from "@/lib/character/character-context";
import { groupByRecovery } from "@/lib/resources/helpers";
import { ResourceCounter } from "@/components/sheet/resource-counter";
import type { FeatureResource } from "@/lib/types/resources";

/**
 * Left-column panel listing every active feature resource, grouped by recovery
 * type (short rest first). Renders nothing when the character has no resources.
 */
export function ResourcesWidget() {
  const { resources, uses, setUsed } = useResources();

  if (resources.length === 0) return null;

  const grouped = groupByRecovery(resources);

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 space-y-2">
      <p className="text-xs text-muted-foreground">Resources</p>

      {grouped.short.length > 0 && (
        <ResourceGroup
          label="Short Rest"
          icon={<Moon className="size-3" />}
          resources={grouped.short}
          uses={uses}
          setUsed={setUsed}
        />
      )}
      {grouped.long.length > 0 && (
        <ResourceGroup
          label="Long Rest"
          icon={<Sun className="size-3" />}
          resources={grouped.long}
          uses={uses}
          setUsed={setUsed}
        />
      )}
    </div>
  );
}

interface ResourceGroupProps {
  label: string;
  icon: React.ReactNode;
  resources: FeatureResource[];
  uses: Record<string, number>;
  setUsed: (slug: string, n: number) => void;
}

function ResourceGroup({ label, icon, resources, uses, setUsed }: ResourceGroupProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="space-y-1">
        {resources.map((r) => (
          <ResourceCounter
            key={r.slug}
            resource={r}
            used={uses[r.slug] ?? 0}
            onChange={(n) => setUsed(r.slug, n)}
            layout="widget"
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/sheet/resources-widget.test.tsx`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add components/sheet/resources-widget.tsx tests/components/sheet/resources-widget.test.tsx
git commit -m "feat: ResourcesWidget — grouped-by-recovery left-column panel"
```

---

### Task 6: Insert widget into SheetPanel

**Files:**
- Modify: `components/character/sheet-panel.tsx`

- [ ] **Step 1: Add import**

At the top of `components/character/sheet-panel.tsx`, add:

```typescript
import { ResourcesWidget } from "@/components/sheet/resources-widget";
```

- [ ] **Step 2: Insert in left column**

Find the line `<Defenses evalResult={evalResult} />` in the left-column `<div className="space-y-4 overflow-y-auto">`. Add `<ResourcesWidget />` on the next line, before `<ActivationToggles ...>`:

```typescript
<Defenses evalResult={evalResult} />
<ResourcesWidget />
<ActivationToggles
  ...
```

- [ ] **Step 3: Verify build + tests**

Run: `npm run build && npx vitest run`
Expected: PASS — all tests green, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/character/sheet-panel.tsx
git commit -m "feat: integrate ResourcesWidget into left column"
```

---

### Task 7: Inline counter in Features tab

**Files:**
- Modify: `components/sheet/tabs/features-tab.tsx`

- [ ] **Step 1: Add imports**

At the top of `components/sheet/tabs/features-tab.tsx`:

```typescript
import { useResources } from "@/lib/character/character-context";
import { ResourceCounter } from "@/components/sheet/resource-counter";
```

- [ ] **Step 2: Read resources + uses inside the component**

Inside the `FeaturesTab` component body (after the existing hook calls like `useState`), add:

```typescript
const { resources, uses, setUsed } = useResources();
```

- [ ] **Step 3: Render matching counters inline on each feature card**

Inside the `.map` that renders each feature card, after the `description` paragraph and before the `resolved_choices` block, add:

```typescript
{(() => {
  const featureSlug = ref.content_definitions?.slug;
  if (!featureSlug) return null;
  const matched = resources.filter((r) => r.sourceFeatureSlug === featureSlug);
  if (matched.length === 0) return null;
  return (
    <div className="space-y-1.5 pt-1">
      {matched.map((r) => (
        <ResourceCounter
          key={r.slug}
          resource={r}
          used={uses[r.slug] ?? 0}
          onChange={(n) => setUsed(r.slug, n)}
          layout="card"
        />
      ))}
    </div>
  );
})()}
```

- [ ] **Step 4: Verify build + existing tests**

Run: `npm run build && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/sheet/tabs/features-tab.tsx
git commit -m "feat: inline ResourceCounter on Features tab cards"
```

---

### Task 8: End-to-end verification

- [ ] **Step 1: Full test run**

Run: `npx vitest run`
Expected: PASS — full suite green, including Phase 1 spell tests and existing suites.

- [ ] **Step 2: Clean build**

Run: `npm run build`
Expected: PASS — no type errors, no lint errors.

- [ ] **Step 3: Manual smoke (dev server)**

Start dev server, open a Barbarian character sheet, verify:

1. Left column shows a "Resources" panel with "Long Rest" subheader and "Rage 2/2" (or appropriate max)
2. `[−]` decrements remaining
3. `[+]` increments back
4. Features tab → "Rage" card shows the same counter inline, in sync with the widget
5. Refresh the page — counter value persists

Then repeat with a Monk character (Ki short-rest) and a Cleric (Channel Divinity short-rest) to verify multi-class + multi-recovery behavior.

Also open a Rogue with no resources — verify the widget is hidden entirely.

- [ ] **Step 4: Open PR**

```bash
git push -u origin feat/feature-resources
gh pr create --title "feat: Feature Resources — runtime usage counters" --body "$(cat <<'EOF'
## Summary

First foundation phase before resuming Spell Management. Adds runtime tracking + UI for class-feature usage counters (Rage, Ki, Channel Divinity, Bardic Inspiration, Lay on Hands, Action Surge, Second Wind, Superiority Dice, Sorcery Points, Wild Shape uses, and any homebrew feature authored with `usages` + `recovery`).

- **Data-driven** — any feature with `usages > 0` and `recovery` set produces a resource. No curation.
- **Left-column widget** grouped by recovery (short rest first), sorted alphabetically within group
- **Inline counters** on Features-tab cards, sharing the same `<ResourceCounter>` component
- **State** tracked as `CharacterState.feature_uses: Record<string, number>` — spent tracked, max computed
- **Recovery mapping**: `short rest` → short, `long rest`/`dawn`/`day` → long (documented compromise)
- **No DB migration** — state extension is an additive JSONB field
- **Rest dialog** explicitly out of scope — next foundation phase consumes this one's recovery metadata

Reference spec: `docs/superpowers/specs/2026-04-23-feature-resources-design.md`

## Test plan
- [ ] Barbarian L1 character shows Rage counter in Long Rest group
- [ ] Monk shows Ki in Short Rest group
- [ ] Cleric shows Channel Divinity in Short Rest group
- [ ] Multiclass Fighter/Wizard shows Action Surge + Second Wind
- [ ] Counter `[−]`/`[+]` clamp at 0 and max
- [ ] Rogue (no class resources) hides widget entirely
- [ ] Features tab card shows the same counter inline
- [ ] Value persists across page reload

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Checklist (run after plan complete, fix issues inline)

**1. Spec coverage:** every requirement in the spec is implemented:
- [x] `feature_uses` added to CharacterState (Task 1)
- [x] `FeatureResource` type (Task 1)
- [x] `normalizeRecovery`, `getMaxUses`, `computeResources`, `groupByRecovery` helpers (Task 2)
- [x] `useResources()` hook with spend/restore/setUsed (Task 3)
- [x] `ResourceCounter` component with widget + card layouts (Task 4)
- [x] `ResourcesWidget` grouped + hidden-when-empty (Task 5)
- [x] SheetPanel integration (Task 6)
- [x] Features tab inline counter (Task 7)
- [x] `extraLimitedFeatures` become separate entries (covered in Task 2 helper + tests)
- [x] Recovery mapping (dawn/day → long) — Task 2 test + helper
- [x] All 15 verification criteria from spec mapped to test assertions or Task 8 smoke

**2. Placeholder scan:** every step has concrete code, exact paths, exact commands, expected outputs. No "similar to Task N", no "add appropriate error handling", no TBDs.

**3. Type consistency:** `FeatureResource` shape is defined once in Task 1 and referenced identically in Tasks 2-7. Method signatures (`spend(slug, amount?)`, `setUsed(slug, newUsed)`) are stable across plan.

---

## Out of Scope (do not implement in this phase)

- Rest dialog (short/long rest orchestration) — next foundation phase
- Dice rolling integration for spend actions — follow-up foundation phase
- Formula-based max values (e.g., Bardic Inspiration = CHA mod) — future schema extension
- Racial traits with usages — currently stored in `trait` content type, not `feature`; future scope
- Multi-class level aggregation for shared features (none exist today in D&D 5e)
