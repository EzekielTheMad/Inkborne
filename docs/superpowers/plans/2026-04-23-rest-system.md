# Rest System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the short/long rest orchestration (button + dialog + hook + state + bulk reset), plus the Conditions widget redesign (dropdown picker + applied-only pills + Exhaustion as a leveled pill), plus Death Saves hide-until-HP-0 with auto-reset.

**Architecture:** Pure effect-computation helpers (`computeShortRestEffects`, `computeLongRestEffects`) produce a single atomic `CharacterState` patch. The `useRest()` hook calls them and applies via one `patchState` call (leveraging the `patch_character_state` RPC's shallow JSONB merge to bulk-reset `feature_uses` and `spell_slots_used` top-level keys). Conditions and Death Saves changes are UI-level — no new state beyond `exhaustion?: number`.

**Tech Stack:** TypeScript strict, React (client components), Vitest, React Testing Library, Tailwind. No DB migration.

**Reference spec:** `docs/superpowers/specs/2026-04-23-rest-system-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `lib/types/character.ts` | Modify | Add `exhaustion?: number` to `CharacterState` |
| `lib/rest/helpers.ts` | Create | `computeShortRestEffects`, `computeLongRestEffects` — pure functions returning `{ statePatch, canApply }` |
| `lib/character/character-context.tsx` | Modify | Add `useRest()` hook |
| `components/sheet/rest-button.tsx` | Create | Stat-ribbon trigger button + dialog state |
| `components/sheet/rest-dialog.tsx` | Create | Two-pane short/long preview with execution buttons |
| `components/sheet/stat-ribbon.tsx` | Modify | Insert `<RestButton />` after HP tracker |
| `components/sheet/mobile-sheet.tsx` | Modify | Mirror Rest button on mobile |
| `components/sheet/conditions.tsx` | Rewrite | Dropdown picker; applied-only pills; Exhaustion leveled pill |
| `components/sheet/hp-tracker.tsx` | Modify | Wrap patchState: auto-clear death saves on 0→>0 transition |
| `components/character/sheet-panel.tsx` | Modify | Conditional render of `<DeathSaves>` only when `current_hp === 0` |
| `tests/rest/helpers.test.ts` | Create | Pure-logic tests for both effect computations |
| `tests/components/sheet/rest-dialog.test.tsx` | Create | Dialog tests |
| `tests/components/sheet/conditions.test.tsx` | Create | Picker + exhaustion pill tests |

---

## Task Order

Sequential — each downstream task imports or depends on the previous:

1. Types (+ exhaustion state)
2. Rest helpers (TDD)
3. `useRest()` hook
4. `RestButton` + `RestDialog` components (TDD for dialog)
5. Integrate RestButton into StatRibbon + MobileSheet
6. Conditions widget rewrite (TDD)
7. Death Saves visibility + HP tracker auto-reset
8. End-to-end verification + PR

---

### Task 1: Add `exhaustion` to CharacterState

**Files:**
- Modify: `lib/types/character.ts`

- [ ] **Step 1: Add the field**

In `CharacterState` interface (alongside `conditions`, `death_saves`, etc.), add:

```typescript
  /** RAW exhaustion level 0-6. Applied via Conditions widget picker; decremented by 1 on long rest. */
  exhaustion?: number;
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add lib/types/character.ts
git commit -m "feat: exhaustion field on CharacterState"
```

---

### Task 2: Rest helpers (TDD)

**Files:**
- Create: `lib/rest/helpers.ts`
- Create: `tests/rest/helpers.test.ts`

- [ ] **Step 1: Write failing test `tests/rest/helpers.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import {
  computeShortRestEffects,
  computeLongRestEffects,
} from "@/lib/rest/helpers";
import type { CharacterState } from "@/lib/types/character";
import type { FeatureResource } from "@/lib/types/resources";

const mkResource = (
  slug: string,
  recovery: "short" | "long",
): FeatureResource => ({
  slug,
  name: slug,
  max: 3,
  recovery,
  sourceLabel: "",
  sourceFeatureSlug: slug,
});

describe("computeShortRestEffects", () => {
  it("canApply=false with no pact slot and no short-rest resources", () => {
    const state: CharacterState = {};
    const result = computeShortRestEffects(state, []);
    expect(result.canApply).toBe(false);
  });

  it("canApply=false when pact slot exists but is not used", () => {
    const state: CharacterState = { spell_slots_used: { pact: 0 } };
    const result = computeShortRestEffects(state, []);
    expect(result.canApply).toBe(false);
  });

  it("zeroes pact slot when it has been used", () => {
    const state: CharacterState = {
      spell_slots_used: { pact: 2, "1": 1 },
    };
    const result = computeShortRestEffects(state, []);
    expect(result.canApply).toBe(true);
    expect(result.statePatch.spell_slots_used).toEqual({ pact: 0, "1": 1 });
  });

  it("zeroes short-rest feature uses but leaves long-rest uses alone", () => {
    const state: CharacterState = {
      feature_uses: { ki: 3, rage: 1, channel_divinity: 1 },
    };
    const resources = [
      mkResource("ki", "short"),
      mkResource("channel_divinity", "short"),
      mkResource("rage", "long"),
    ];
    const result = computeShortRestEffects(state, resources);
    expect(result.canApply).toBe(true);
    expect(result.statePatch.feature_uses).toEqual({
      ki: 0,
      rage: 1,
      channel_divinity: 0,
    });
  });

  it("does not touch HP, death saves, or exhaustion", () => {
    const state: CharacterState = {
      current_hp: 10,
      death_saves: { successes: 1, failures: 2 },
      exhaustion: 3,
      spell_slots_used: { pact: 1 },
    };
    const result = computeShortRestEffects(state, []);
    expect(result.statePatch.current_hp).toBeUndefined();
    expect(result.statePatch.death_saves).toBeUndefined();
    expect(result.statePatch.exhaustion).toBeUndefined();
  });
});

describe("computeLongRestEffects", () => {
  it("sets HP to max and clears temp HP", () => {
    const state: CharacterState = { current_hp: 10, temp_hp: 5 };
    const result = computeLongRestEffects(state, 50, []);
    expect(result.statePatch.current_hp).toBe(50);
    expect(result.statePatch.temp_hp).toBe(0);
  });

  it("clears death saves", () => {
    const state: CharacterState = {
      current_hp: 0,
      death_saves: { successes: 2, failures: 1 },
    };
    const result = computeLongRestEffects(state, 50, []);
    expect(result.statePatch.death_saves).toEqual({ successes: 0, failures: 0 });
  });

  it("decrements exhaustion, clamped at 0", () => {
    expect(
      computeLongRestEffects({ exhaustion: 3 }, 50, []).statePatch.exhaustion,
    ).toBe(2);
    expect(
      computeLongRestEffects({ exhaustion: 0 }, 50, []).statePatch.exhaustion,
    ).toBe(0);
    expect(
      computeLongRestEffects({}, 50, []).statePatch.exhaustion,
    ).toBe(0);
  });

  it("clears concentration", () => {
    const state: CharacterState = {
      concentrating_on: { spellId: "bless", hash: "x" } as never,
    };
    const result = computeLongRestEffects(state, 50, []);
    expect(result.statePatch.concentrating_on).toBeNull();
  });

  it("zeroes ALL spell_slots_used keys (including pact)", () => {
    const state: CharacterState = {
      spell_slots_used: { "1": 4, "2": 2, "3": 1, pact: 2 },
    };
    const result = computeLongRestEffects(state, 50, []);
    expect(result.statePatch.spell_slots_used).toEqual({
      "1": 0,
      "2": 0,
      "3": 0,
      pact: 0,
    });
  });

  it("zeroes feature_uses for both short + long recovery resources", () => {
    const state: CharacterState = {
      feature_uses: { ki: 3, rage: 1, lay_on_hands: 15 },
    };
    const resources = [
      mkResource("ki", "short"),
      mkResource("rage", "long"),
      mkResource("lay_on_hands", "long"),
    ];
    const result = computeLongRestEffects(state, 50, resources);
    expect(result.statePatch.feature_uses).toEqual({
      ki: 0,
      rage: 0,
      lay_on_hands: 0,
    });
  });

  it("canApply=false when fully rested with no resources used", () => {
    const state: CharacterState = {
      current_hp: 50,
      temp_hp: 0,
      death_saves: { successes: 0, failures: 0 },
      exhaustion: 0,
      concentrating_on: null,
      spell_slots_used: {},
      feature_uses: {},
    };
    const result = computeLongRestEffects(state, 50, []);
    expect(result.canApply).toBe(false);
  });

  it("canApply=true when HP below max", () => {
    const state: CharacterState = { current_hp: 10 };
    const result = computeLongRestEffects(state, 50, []);
    expect(result.canApply).toBe(true);
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run tests/rest/helpers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/rest/helpers.ts`**

```typescript
import type { CharacterState } from "@/lib/types/character";
import type { FeatureResource } from "@/lib/types/resources";

export interface RestEffects {
  statePatch: Partial<CharacterState>;
  canApply: boolean;
}

/**
 * Compute the state patch for a short rest.
 *
 * Applies:
 * - `spell_slots_used.pact = 0` (if pact key exists and is > 0)
 * - Zero every `feature_uses[slug]` where the resource has `recovery === "short"`
 *
 * Does NOT touch: HP, temp HP, death saves, exhaustion, concentration,
 * regular (leveled 1-9) spell slots, long-rest resources.
 *
 * `canApply` is true when any field would actually change.
 */
export function computeShortRestEffects(
  state: CharacterState,
  resources: FeatureResource[],
): RestEffects {
  const patch: Partial<CharacterState> = {};

  // Pact slot restoration
  const slots = state.spell_slots_used ?? {};
  const pactUsed = (slots.pact as number | undefined) ?? 0;
  if (pactUsed > 0) {
    patch.spell_slots_used = { ...slots, pact: 0 };
  }

  // Short-rest feature resources
  const shortSlugs = resources
    .filter((r) => r.recovery === "short")
    .map((r) => r.slug);
  const uses = (state.feature_uses ?? {}) as Record<string, number>;
  const hasShortUsed = shortSlugs.some((slug) => (uses[slug] ?? 0) > 0);
  if (hasShortUsed) {
    const nextUses: Record<string, number> = { ...uses };
    for (const slug of shortSlugs) nextUses[slug] = 0;
    patch.feature_uses = nextUses;
  }

  return {
    statePatch: patch,
    canApply: Object.keys(patch).length > 0,
  };
}

/**
 * Compute the state patch for a long rest.
 *
 * Applies:
 * - `current_hp = maxHp`
 * - `temp_hp = 0`
 * - `death_saves = { successes: 0, failures: 0 }`
 * - `exhaustion = max(0, (state.exhaustion ?? 0) - 1)`
 * - `concentrating_on = null`
 * - All `spell_slots_used[*]` → 0 (includes pact)
 * - All `feature_uses[slug]` → 0 where recovery is "short" OR "long"
 *
 * Does NOT touch: HD (deferred phase), conditions (other than exhaustion),
 * currency, inventory, notes.
 */
export function computeLongRestEffects(
  state: CharacterState,
  maxHp: number,
  resources: FeatureResource[],
): RestEffects {
  const currentHp = state.current_hp ?? maxHp;
  const tempHp = state.temp_hp ?? 0;
  const deathSaves = state.death_saves ?? { successes: 0, failures: 0 };
  const exhaustion = state.exhaustion ?? 0;
  const concentrating = state.concentrating_on ?? null;
  const slots = (state.spell_slots_used ?? {}) as Record<string, number>;
  const uses = (state.feature_uses ?? {}) as Record<string, number>;

  // Spell slots reset: zero every existing key
  const zeroedSlots: Record<string, number> = {};
  for (const key of Object.keys(slots)) zeroedSlots[key] = 0;
  const slotsChanged = Object.values(slots).some((v) => v > 0);

  // Feature uses reset: zero every resource slug (short + long)
  const allResourceSlugs = resources.map((r) => r.slug);
  const zeroedUses: Record<string, number> = { ...uses };
  let usesChanged = false;
  for (const slug of allResourceSlugs) {
    if ((uses[slug] ?? 0) > 0) {
      zeroedUses[slug] = 0;
      usesChanged = true;
    }
  }

  const patch: Partial<CharacterState> = {
    current_hp: maxHp,
    temp_hp: 0,
    death_saves: { successes: 0, failures: 0 },
    exhaustion: Math.max(0, exhaustion - 1),
    concentrating_on: null,
    spell_slots_used: zeroedSlots,
    feature_uses: zeroedUses,
  };

  // Detect no-op: every field would be unchanged
  const canApply =
    currentHp !== maxHp ||
    tempHp !== 0 ||
    deathSaves.successes !== 0 ||
    deathSaves.failures !== 0 ||
    exhaustion > 0 ||
    concentrating !== null ||
    slotsChanged ||
    usesChanged;

  return { statePatch: patch, canApply };
}
```

- [ ] **Step 4: Verify tests pass**

Run: `npx vitest run tests/rest/helpers.test.ts`
Expected: all tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/rest/helpers.ts tests/rest/helpers.test.ts
git commit -m "feat: rest effect helpers — short/long statePatch computation (TDD)"
```

---

### Task 3: `useRest()` hook in CharacterContext

**Files:**
- Modify: `lib/character/character-context.tsx`

- [ ] **Step 1: Add imports at the top**

```typescript
import {
  computeShortRestEffects,
  computeLongRestEffects,
} from "@/lib/rest/helpers";
```

- [ ] **Step 2: Add `useRest()` below existing `useResources` hook**

```typescript
/** Orchestrate short and long rests: compute effects, apply atomic state patch. */
export function useRest(): {
  exhaustion: number;
  shortRest: () => void;
  longRest: () => void;
  setExhaustion: (level: number) => void;
  canShortRest: boolean;
  canLongRest: boolean;
} {
  const ctx = useCharacterContext();
  const { state, resources, maxHp, patchState } = ctx;
  const exhaustion = (state.exhaustion as number | undefined) ?? 0;

  const shortEffects = computeShortRestEffects(state, resources);
  const longEffects = computeLongRestEffects(state, maxHp, resources);

  const shortRest = () => {
    if (!shortEffects.canApply) return;
    patchState(shortEffects.statePatch);
  };

  const longRest = () => {
    if (!longEffects.canApply) return;
    patchState(longEffects.statePatch);
  };

  const setExhaustion = (level: number) => {
    const clamped = Math.max(0, Math.min(6, Math.floor(level)));
    patchState({ exhaustion: clamped });
  };

  return {
    exhaustion,
    shortRest,
    longRest,
    setExhaustion,
    canShortRest: shortEffects.canApply,
    canLongRest: longEffects.canApply,
  };
}
```

Note: depends on `ctx.resources` and `ctx.maxHp` being exposed on the context value. `resources` was added by the Feature Resources phase. `maxHp` — **verify by grepping** the existing `CharacterProvider` useMemo context-value block. If `maxHp` isn't on the context value, add it alongside the existing fields (it's already passed as a prop to the provider at the page level).

- [ ] **Step 3: Confirm `maxHp` is exposed on the context**

Run: `grep -n "maxHp" lib/character/character-context.tsx | head -10`

If `maxHp` appears as a prop and is passed to context value, you're fine. If it's a prop but not exposed, add it to the `CharacterContextValue` interface and the `useMemo(() => ({...}))` block.

- [ ] **Step 4: Verify build + tests**

Run: `npm run build && npx vitest run`
Expected: clean; all 279+ existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/character/character-context.tsx
git commit -m "feat: useRest hook — orchestrate short/long rest via single patchState"
```

---

### Task 4: `RestDialog` + `RestButton` components (TDD for dialog)

**Files:**
- Create: `components/sheet/rest-dialog.tsx`
- Create: `components/sheet/rest-button.tsx`
- Create: `tests/components/sheet/rest-dialog.test.tsx`

- [ ] **Step 1: Write failing test `tests/components/sheet/rest-dialog.test.tsx`**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RestDialog } from "@/components/sheet/rest-dialog";

let mockUseRest: () => ReturnType<typeof buildMock>;
function buildMock(overrides: Partial<ReturnType<typeof buildMock>> = {}) {
  return {
    shortRest: vi.fn(),
    longRest: vi.fn(),
    canShortRest: true,
    canLongRest: true,
    exhaustion: 0,
    setExhaustion: vi.fn(),
    ...overrides,
  };
}

vi.mock("@/lib/character/character-context", () => ({
  useRest: () => mockUseRest(),
  useCharacter: () => ({
    character: {},
    maxHp: 50,
  }),
  useCharacterState: () => ({ state: { current_hp: 30 } }),
}));

describe("RestDialog", () => {
  it("renders two panes with Short Rest and Long Rest buttons", () => {
    mockUseRest = () => buildMock();
    render(<RestDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /take short rest/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /take long rest/i })).toBeInTheDocument();
  });

  it("disables Short Rest button when canShortRest is false", () => {
    mockUseRest = () => buildMock({ canShortRest: false });
    render(<RestDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /take short rest/i })).toBeDisabled();
  });

  it("disables Long Rest button when canLongRest is false", () => {
    mockUseRest = () => buildMock({ canLongRest: false });
    render(<RestDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /take long rest/i })).toBeDisabled();
  });

  it("calls shortRest() and onClose when short rest button clicked", () => {
    const shortRest = vi.fn();
    const onClose = vi.fn();
    mockUseRest = () => buildMock({ shortRest });
    render(<RestDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /take short rest/i }));
    expect(shortRest).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("calls longRest() and onClose when long rest button clicked", () => {
    const longRest = vi.fn();
    const onClose = vi.fn();
    mockUseRest = () => buildMock({ longRest });
    render(<RestDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /take long rest/i }));
    expect(longRest).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run tests/components/sheet/rest-dialog.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `components/sheet/rest-dialog.tsx`**

Before writing, check what Dialog primitives exist:

Run: `ls components/ui/ | grep -i dialog`

If a `dialog.tsx` exists (shadcn pattern), use it:

```typescript
"use client";

import { Moon, Sun } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRest, useCharacter, useCharacterState } from "@/lib/character/character-context";

interface RestDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Two-pane rest dialog. Left pane: short rest preview + execute. Right pane:
 * long rest preview + execute. Buttons disable when the rest would have no
 * visible effect. Executing a rest closes the dialog.
 */
export function RestDialog({ open, onClose }: RestDialogProps) {
  const { shortRest, longRest, canShortRest, canLongRest } = useRest();
  const { maxHp } = useCharacter();
  const { state } = useCharacterState();

  const currentHp = state.current_hp ?? maxHp;
  const tempHp = state.temp_hp ?? 0;
  const exhaustion = (state.exhaustion as number | undefined) ?? 0;
  const deathSaves = state.death_saves ?? { successes: 0, failures: 0 };

  const onShortRest = () => {
    shortRest();
    onClose();
  };
  const onLongRest = () => {
    longRest();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Rest</DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Short Rest pane */}
          <section className="space-y-3 p-4 rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <Moon className="size-4 text-muted-foreground" />
              <h3 className="font-semibold">Short Rest</h3>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>Restore Warlock pact slots</li>
              <li>Reset short-rest resources (Ki, Channel Divinity, etc.)</li>
            </ul>
            <Button
              className="w-full"
              onClick={onShortRest}
              disabled={!canShortRest}
              title={
                !canShortRest
                  ? "No short-rest recovery available for this character"
                  : undefined
              }
            >
              Take Short Rest
            </Button>
          </section>

          {/* Long Rest pane */}
          <section className="space-y-3 p-4 rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <Sun className="size-4 text-muted-foreground" />
              <h3 className="font-semibold">Long Rest</h3>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>HP {currentHp} → {maxHp}</li>
              {tempHp > 0 && <li>Clear {tempHp} temp HP</li>}
              <li>Restore all spell slots</li>
              <li>Reset all feature resources</li>
              {(deathSaves.successes > 0 || deathSaves.failures > 0) && (
                <li>Clear death saves</li>
              )}
              {exhaustion > 0 && <li>Exhaustion {exhaustion} → {exhaustion - 1}</li>}
            </ul>
            <Button
              className="w-full"
              onClick={onLongRest}
              disabled={!canLongRest}
              title={!canLongRest ? "Fully rested" : undefined}
            >
              Take Long Rest
            </Button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**If no `Dialog` primitive exists** under `components/ui/`, report back as BLOCKED — a Dialog primitive is a pre-existing dependency.

- [ ] **Step 4: Implement `components/sheet/rest-button.tsx`**

```typescript
"use client";

import { useState } from "react";
import { Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RestDialog } from "@/components/sheet/rest-dialog";

/**
 * Stat-ribbon trigger for the rest dialog. Keeps dialog open/close state local
 * so the dialog mounts only when the button is clicked.
 */
export function RestButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="shrink-0"
      >
        <Moon className="size-4 mr-1.5" />
        Rest
      </Button>
      <RestDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
```

- [ ] **Step 5: Verify tests pass**

Run: `npx vitest run tests/components/sheet/rest-dialog.test.tsx`
Expected: all 5 tests green.

- [ ] **Step 6: Commit**

```bash
git add components/sheet/rest-dialog.tsx components/sheet/rest-button.tsx tests/components/sheet/rest-dialog.test.tsx
git commit -m "feat: RestDialog + RestButton — two-pane rest preview with execution (TDD)"
```

---

### Task 5: Integrate RestButton into StatRibbon + MobileSheet

**Files:**
- Modify: `components/sheet/stat-ribbon.tsx`
- Modify: `components/sheet/mobile-sheet.tsx`

- [ ] **Step 1: StatRibbon — add import and render**

At the top of `components/sheet/stat-ribbon.tsx`, add:

```typescript
import { RestButton } from "@/components/sheet/rest-button";
```

Inside the outer `<div className="flex items-center gap-3 overflow-x-auto pb-1">`, add `<RestButton />` as the LAST child (after the HP tracker / combat stats):

```typescript
{/* ... existing children including HPTracker ... */}
<RestButton />
```

- [ ] **Step 2: MobileSheet — add the button**

Open `components/sheet/mobile-sheet.tsx`. Find where the stat ribbon is rendered (search for `StatRibbon` or the abilities/combat stats block). The mobile sheet has its own rendering that mirrors the desktop — locate the equivalent insertion site (likely after a mobile HP tracker or combat stats block). Add `<RestButton />`.

If the mobile sheet reuses `<StatRibbon>` directly, no changes needed (step 1 covers it). Verify by reading the file; add only if needed.

- [ ] **Step 3: Build + test**

Run: `npm run build && npx vitest run`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add components/sheet/stat-ribbon.tsx components/sheet/mobile-sheet.tsx
git commit -m "feat: mount RestButton in StatRibbon + MobileSheet"
```

---

### Task 6: Conditions widget rewrite (TDD)

**Files:**
- Rewrite: `components/sheet/conditions.tsx`
- Create: `tests/components/sheet/conditions.test.tsx`

This task rewrites the Conditions widget from a flat toggle grid to a picker-driven pattern with applied-only pills, plus special-cased Exhaustion rendering.

- [ ] **Step 1: Write failing test file `tests/components/sheet/conditions.test.tsx`**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Conditions } from "@/components/sheet/conditions";

function setup(
  overrides: Partial<{
    conditions: string[];
    exhaustion: number;
  }> = {},
) {
  const patchState = vi.fn();
  const props = {
    conditions: overrides.conditions ?? [],
    exhaustion: overrides.exhaustion ?? 0,
    patchState,
  };
  render(<Conditions {...props} />);
  return { patchState };
}

describe("Conditions widget (redesigned)", () => {
  it("renders empty state with Add Condition button when nothing applied", () => {
    setup();
    expect(screen.getByText(/no active conditions/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add condition/i })).toBeInTheDocument();
  });

  it("renders a pill for each applied boolean condition", () => {
    setup({ conditions: ["Poisoned", "Prone"] });
    expect(screen.getByText("Poisoned")).toBeInTheDocument();
    expect(screen.getByText("Prone")).toBeInTheDocument();
    expect(screen.queryByText(/no active conditions/i)).not.toBeInTheDocument();
  });

  it("removes a condition when its × is clicked", () => {
    const { patchState } = setup({ conditions: ["Poisoned", "Prone"] });
    fireEvent.click(screen.getByRole("button", { name: /remove poisoned/i }));
    expect(patchState).toHaveBeenCalledWith({ conditions: ["Prone"] });
  });

  it("opens popover when Add Condition is clicked", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /add condition/i }));
    // Popover items should now be visible
    expect(screen.getByText("Blinded")).toBeInTheDocument();
    expect(screen.getByText("Exhaustion")).toBeInTheDocument();
  });

  it("popover hides conditions that are already applied", () => {
    setup({ conditions: ["Blinded"] });
    fireEvent.click(screen.getByRole("button", { name: /add condition/i }));
    // Blinded should only appear as the applied pill, not in the popover list
    const blindedElements = screen.getAllByText("Blinded");
    // Exactly one instance (the pill), since popover filters applied conditions
    expect(blindedElements).toHaveLength(1);
  });

  it("clicking Exhaustion in popover sets level = 1", () => {
    const { patchState } = setup();
    fireEvent.click(screen.getByRole("button", { name: /add condition/i }));
    fireEvent.click(screen.getByRole("button", { name: /^exhaustion$/i }));
    expect(patchState).toHaveBeenCalledWith({ exhaustion: 1 });
  });

  it("exhaustion pill shows level/6 with stepper buttons", () => {
    setup({ exhaustion: 2 });
    expect(screen.getByText(/2\/6/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /increase exhaustion/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /decrease exhaustion/i })).toBeInTheDocument();
  });

  it("[+] increments exhaustion by 1, clamped at 6", () => {
    const { patchState } = setup({ exhaustion: 5 });
    fireEvent.click(screen.getByRole("button", { name: /increase exhaustion/i }));
    expect(patchState).toHaveBeenCalledWith({ exhaustion: 6 });
  });

  it("[−] at level > 1 decrements exhaustion", () => {
    const { patchState } = setup({ exhaustion: 3 });
    fireEvent.click(screen.getByRole("button", { name: /decrease exhaustion/i }));
    expect(patchState).toHaveBeenCalledWith({ exhaustion: 2 });
  });

  it("[−] at level 1 removes exhaustion (sets to 0)", () => {
    const { patchState } = setup({ exhaustion: 1 });
    fireEvent.click(screen.getByRole("button", { name: /decrease exhaustion/i }));
    expect(patchState).toHaveBeenCalledWith({ exhaustion: 0 });
  });

  it("exhaustion pill applies warning styling at level >= 5", () => {
    const { container } = render(
      <Conditions conditions={[]} exhaustion={5} patchState={vi.fn()} />,
    );
    // Warning class should appear somewhere on the exhaustion pill.
    // We look for "destructive" or "warning" class tokens.
    const hasWarning = container.innerHTML.match(/destructive|warning|amber/i);
    expect(hasWarning).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run tests/components/sheet/conditions.test.tsx`
Expected: many failures — the current widget has the old API (no exhaustion prop).

- [ ] **Step 3: Rewrite `components/sheet/conditions.tsx`**

```typescript
"use client";

import { useState } from "react";
import { X, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CharacterState } from "@/lib/types/character";

// Core 5e conditions (excludes Exhaustion — it's handled separately as a leveled pill).
const BOOLEAN_CONDITIONS = [
  "Blinded",
  "Charmed",
  "Deafened",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious",
] as const;

const EXHAUSTION_TOOLTIP =
  "1: Disadv on ability checks • 2: Speed halved • 3: Disadv on attacks + saves • 4: HP max halved • 5: Speed 0 • 6: Death";

interface ConditionsProps {
  conditions: string[];
  exhaustion: number;
  patchState: (patch: Partial<CharacterState>) => Promise<void> | void;
}

/**
 * Conditions widget (redesigned):
 * - Applied boolean conditions shown as pills with × removal
 * - Exhaustion shown as a leveled pill with [−]/[+] stepper when > 0
 * - "+ Add Condition" button opens a popover listing only unapplied conditions
 *   (Exhaustion is listed in the popover only when current level is 0)
 */
export function Conditions({ conditions, exhaustion, patchState }: ConditionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const exhaustionApplied = exhaustion > 0;
  const hasAnyApplied = conditions.length > 0 || exhaustionApplied;

  const removeCondition = (name: string) => {
    patchState({ conditions: conditions.filter((c) => c !== name) });
  };

  const addCondition = (name: string) => {
    setPickerOpen(false);
    if (name === "Exhaustion") {
      patchState({ exhaustion: 1 });
    } else {
      patchState({ conditions: [...conditions, name] });
    }
  };

  const incExhaustion = () => {
    patchState({ exhaustion: Math.min(6, exhaustion + 1) });
  };
  const decExhaustion = () => {
    // At level 1, [−] removes entirely (sets to 0).
    patchState({ exhaustion: Math.max(0, exhaustion - 1) });
  };

  // Available conditions for the picker: exclude those already applied
  // AND exclude Exhaustion if already applied.
  const availableConditions = BOOLEAN_CONDITIONS.filter(
    (c) => !conditions.includes(c),
  );
  const showExhaustionInPicker = !exhaustionApplied;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <h3 className="text-accent font-semibold text-sm uppercase tracking-wide">
        Conditions
      </h3>

      {!hasAnyApplied ? (
        <p className="text-xs text-muted-foreground italic">No active conditions</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {conditions.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => removeCondition(c)}
              aria-label={`Remove ${c}`}
              className="text-xs px-2 py-1 rounded-md bg-destructive/10 text-destructive border border-destructive/50 hover:bg-destructive/20 flex items-center gap-1"
            >
              {c}
              <X className="size-3" />
            </button>
          ))}
          {exhaustionApplied && (
            <div
              title={EXHAUSTION_TOOLTIP}
              className={cn(
                "text-xs px-2 py-1 rounded-md border flex items-center gap-1.5",
                exhaustion >= 5
                  ? "bg-destructive/20 text-destructive border-destructive"
                  : "bg-destructive/10 text-destructive border-destructive/50",
              )}
            >
              <span>Exhaustion</span>
              <button
                type="button"
                onClick={decExhaustion}
                aria-label="Decrease exhaustion"
                className="size-4 inline-flex items-center justify-center rounded hover:bg-destructive/20"
              >
                <Minus className="size-3" />
              </button>
              <span className="tabular-nums">{exhaustion}/6</span>
              <button
                type="button"
                onClick={incExhaustion}
                aria-label="Increase exhaustion"
                disabled={exhaustion >= 6}
                className="size-4 inline-flex items-center justify-center rounded hover:bg-destructive/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="size-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Picker */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="text-xs px-2 py-1 rounded-md border border-dashed border-muted-foreground/40 text-muted-foreground hover:text-foreground hover:border-muted-foreground flex items-center gap-1"
        >
          <Plus className="size-3" />
          Add Condition
        </button>

        {pickerOpen && (
          <div className="absolute z-20 mt-1 w-48 rounded-md border border-border bg-popover p-1 shadow-md">
            <div className="max-h-60 overflow-y-auto">
              {availableConditions.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => addCondition(c)}
                  className="w-full text-left text-xs px-2 py-1 rounded hover:bg-accent"
                >
                  {c}
                </button>
              ))}
              {showExhaustionInPicker && (
                <button
                  type="button"
                  onClick={() => addCondition("Exhaustion")}
                  className="w-full text-left text-xs px-2 py-1 rounded hover:bg-accent"
                  title={EXHAUSTION_TOOLTIP}
                >
                  Exhaustion
                </button>
              )}
              {availableConditions.length === 0 && !showExhaustionInPicker && (
                <p className="text-xs text-muted-foreground italic px-2 py-1">
                  All conditions applied
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update call sites**

The component's props changed — it now accepts `exhaustion` in addition to `conditions`. Search for render sites:

Run: `grep -n "<Conditions" components/ --include="*.tsx" -r`

Update each site to pass `exhaustion={state.exhaustion ?? 0}`. Likely sites: `components/character/sheet-panel.tsx` and possibly `components/sheet/mobile-sheet.tsx`.

Example (sheet-panel.tsx):

```typescript
<Conditions
  conditions={state.conditions ?? []}
  exhaustion={(state.exhaustion as number | undefined) ?? 0}
  patchState={patchState}
/>
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/components/sheet/conditions.test.tsx && npm run build`
Expected: all new tests pass; build clean; no regressions.

- [ ] **Step 6: Commit**

```bash
git add components/sheet/conditions.tsx components/character/sheet-panel.tsx components/sheet/mobile-sheet.tsx tests/components/sheet/conditions.test.tsx
git commit -m "feat: redesign Conditions widget — picker + pills + leveled Exhaustion (TDD)"
```

---

### Task 7: Death Saves visibility + HP tracker auto-reset

**Files:**
- Modify: `components/character/sheet-panel.tsx`
- Modify: `components/sheet/mobile-sheet.tsx` (if it renders DeathSaves separately)
- Modify: `components/sheet/hp-tracker.tsx`

- [ ] **Step 1: Conditional render DeathSaves in sheet-panel.tsx**

Find the existing `<DeathSaves ... />` render and wrap it:

```typescript
{(state.current_hp ?? 0) === 0 && (
  <DeathSaves
    currentHp={state.current_hp ?? 0}
    deathSaves={state.death_saves ?? { successes: 0, failures: 0 }}
    patchState={patchState}
  />
)}
```

- [ ] **Step 2: Same treatment in MobileSheet**

Check if `mobile-sheet.tsx` renders `<DeathSaves>`. If yes, apply the same conditional wrapper. If it delegates to sheet-panel or another shared component, no change needed.

- [ ] **Step 3: HP tracker auto-reset on 0→>0 transition**

Read `components/sheet/hp-tracker.tsx` to find where HP changes are patched to state. Locate the function that calls `patchState({ current_hp: newValue })` (could be in a damage/heal button handler, or an input onChange).

Wrap each such call to include a `death_saves` reset when the transition applies. Example pattern:

```typescript
function applyHpChange(newHp: number) {
  const wasAtZero = (state.current_hp ?? 0) === 0;
  const patch: Partial<CharacterState> = { current_hp: newHp };
  // Auto-reset death saves on 0 → >0 transition if saves have values
  if (wasAtZero && newHp > 0) {
    const ds = state.death_saves ?? { successes: 0, failures: 0 };
    if (ds.successes > 0 || ds.failures > 0) {
      patch.death_saves = { successes: 0, failures: 0 };
    }
  }
  patchState(patch);
}
```

If there are multiple HP-changing handlers, extract a helper or apply the wrap to each.

**Note:** do NOT auto-reset on every HP change — only on the 0→>0 transition. This keeps DM-granted edits (e.g., setting saves directly without HP change) working.

- [ ] **Step 4: Build + test**

Run: `npm run build && npx vitest run`
Expected: clean; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/character/sheet-panel.tsx components/sheet/mobile-sheet.tsx components/sheet/hp-tracker.tsx
git commit -m "feat: hide Death Saves unless HP=0 + auto-reset on 0→>0 transition"
```

---

### Task 8: End-to-end verification + PR

- [ ] **Step 1: Full suite + build**

Run: `npx vitest run && npm run build`
Expected: all tests pass; clean build.

- [ ] **Step 2: Manual smoke (dev server)**

Start dev server; verify:

1. **Rest button** appears in stat ribbon on desktop + mobile
2. **Dialog opens** with two panes showing preview bullets
3. **Short Rest** on a Warlock zeroes pact slots
4. **Long Rest** on a level 5 Fighter with damage: HP goes to max, HD unchanged (scope!), death saves cleared, exhaustion decremented
5. **Conditions widget** empty state shows "No active conditions" + Add button
6. **Popover** opens, lists conditions alphabetically, applied ones are absent
7. **Apply Exhaustion** → pill shows `Exhaustion 1/6` with stepper; `[+]` → 2/6; `[−]` at 1 → removes
8. **Exhaustion level 5** styled with destructive/warning color
9. **Death Saves** hidden at full HP; visible at 0 HP
10. **HP 0 → 1** (heal) clears any accumulated death saves automatically

- [ ] **Step 3: Open PR**

```bash
git push -u origin feat/rest-system
gh pr create --base main --title "feat: Rest System — short/long rest + Conditions redesign + Death Saves visibility" --body "$(cat <<'EOF'
## Summary

Second foundation phase before Spell Management Phase 2. Ships:

1. **Rest System** — stat-ribbon button opens a two-pane dialog. Short rest restores Warlock pact slots + short-rest feature resources. Long rest: HP to max, all spell slots, all feature resources, death saves cleared, exhaustion -1, concentration broken. Single atomic patchState call via `patch_character_state` RPC.
2. **Conditions widget redesign** — dropdown picker pattern. Applied conditions shown as removable pills; unapplied hidden until you hit Add. Exhaustion special-cased as a leveled (1-6) pill with `[−]`/`[+]` stepper and warning styling at level 5+.
3. **Death Saves visibility** — widget hidden unless `current_hp === 0`; auto-resets on 0→>0 HP transition.
4. **Exhaustion state** — new `exhaustion?: number` field on `CharacterState`.

HD tracking + spend-to-heal **explicitly deferred** to the Dice Rolling foundation phase — HD only becomes interactive once we can roll real dice.

Reference: `docs/superpowers/specs/2026-04-23-rest-system-design.md`

## Test plan

- [x] Unit tests for both rest effect computations (short + long)
- [x] Component tests for RestDialog, Conditions redesign
- [x] Full suite passing
- [x] Clean build
- [ ] Manual smoke: Barbarian long rest, Warlock short rest, Rogue disabled buttons, exhaustion stepper, death saves visibility transitions

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Checklist

**1. Spec coverage:** every requirement in the spec implemented:
- [x] `exhaustion` state field (Task 1)
- [x] Short rest computation (Task 2)
- [x] Long rest computation (Task 2)
- [x] `useRest()` hook (Task 3)
- [x] RestButton + RestDialog (Task 4)
- [x] Stat ribbon + mobile integration (Task 5)
- [x] Conditions redesign (Task 6)
- [x] Death Saves visibility (Task 7)
- [x] HP auto-reset on 0→>0 (Task 7)
- [x] All 14 verification criteria addressable

**2. Placeholder scan:** every step has concrete code, exact paths, exact commands. No TBDs, no "similar to task N", no "add appropriate handling".

**3. Type consistency:** `RestEffects` defined once; `useRest()` signature stable; `Conditions` props shape consistent with updated call-sites.

---

## Out of Scope

- HD state, HD display, HD spend-to-heal, HD long-rest restoration — Dice Rolling phase
- Dice rolls for anything (attacks, saves, ability checks, death saves) — Dice Rolling phase
- Toast/success notification on rest completion — visible state change is sufficient; Activity Log phase can add explicit logging
- RAW enforcement of "one long rest per 24h" — DM discretion
- Effects / buffs with durations (Bless, Mage Armor, etc.) — separate follow-up
- Realtime multi-tab sync for rest state — separate concern
