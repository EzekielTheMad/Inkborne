# Level-up flow (PR-D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Model + review guidance for the dispatcher:**
> - Tasks 1–6, 9, 12 (atomic helpers / atomic components / small carryovers) → `haiku`, **single combined review**.
> - Tasks 7, 8, 10, 11 (composite or integration) → `sonnet`, **two-stage review** (spec compliance + code quality).
> - Task 13 (manual browser UAT via test account) → main thread, no subagent.

**Goal:** Ship the in-rail "+ Level up [Class]" button + new-level choice pane (NEW LEVEL ribbon, choice cards inline, HP picker) + Confirm/Cancel-level-up flow + HP-rule precedence chain (campaign → system → default) + lazy per-level HP roll storage. The existing PR-B level `<select>` dropdown remains as the power-user / multi-jump / level-down path; going up via the dropdown does NOT trigger the flow.

**Architecture:** Rail-local React state holds an optional `levelUpDraft = { classIndex, draftLevel } | null`. When non-null, the main pane swaps from `<ClassLevelPane>` to a new `<LevelUpPane>` that composes the same choice cards used elsewhere + a new `<HpPicker>` + a new `<LevelUpActionBar>`. Choices and HP rolls persist to `localChoices` *immediately* on edit (matches PR-B level-down behavior); only the *level number itself* is held as preview and committed on Confirm. Cancel discards the draft but keeps choice/HP edits. A hard lock during the flow disables all other rail mutators (other LevelUpButtons, level dropdowns, Remove buttons, AddClassRow). Engine extension: `computeMaxHp` now accepts `hpRolls` + `hpRule` and delegates per-level math to a pure `hpContributionForLevel` helper that respects RAW Lv1-primary-max + the resolved rule + stored rolls.

**Tech Stack:** Next.js 16 App Router (client components), TypeScript strict, Tailwind v4 with HSL tokens, vitest + `@testing-library/react`, Supabase migration via `supabase/migrations/`. Reuses primitives from PR-A (`<ClassEmblem>`, `lib/builder/class-tone.ts`), PR-B (`<FeatureCard>`, `<ChoiceCard*>`, `<LevelPill>`, `<LevelRail>`, `<ClassLevelPane>`), PR-C (`<ClassStepRail>`, `<AddClassRow>`).

**Spec:** [`docs/superpowers/specs/2026-05-01-level-up-flow-design.md`](../specs/2026-05-01-level-up-flow-design.md). Source design files: [`docs/design-briefs/builder-ux-polish-design-files/level-up-flow.jsx`](../../design-briefs/builder-ux-polish-design-files/level-up-flow.jsx).

**Branch base:** `feat/multiclass-picker` (PR #43, stacked on PR #41 / #40). Branch name: `feat/level-up-flow`. Will rebase onto `main` after PR #40 + #41 + #43 + #44 (spec) merge.

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `lib/builder/level-up-rules.ts` | Create | Pure helpers. `HpRule` enum, `HpContributionInput` type, `resolveHpRule(campaign, system)` precedence resolver, `hpContributionForLevel(input)` per-level decision tree returning raw die contribution. |
| `tests/lib/builder/level-up-rules.test.ts` | Create | TDD coverage. |
| `lib/types/character.ts` | Modify | Add `HpRollMethod` + `HpRollRecord` types. Add `hp_rolls?: Record<string, HpRollRecord>` to `CharacterChoices`. Add `hp_rule?: HpRule \| null` to `Campaign`. |
| `lib/character/max-hp.ts` | Modify | Extend `computeMaxHp(...)` to accept `hpRolls` + `hpRule`. Delegate per-level math to `hpContributionForLevel`. |
| `tests/lib/character/max-hp.test.ts` | Modify | Extend with `hpRolls`/`hpRule` cases + backwards-compat case. |
| `app/(app)/characters/[id]/page.tsx` | Modify | Pass `hpRolls` and resolved `hpRule` into the `computeMaxHp` call. Join campaign HP rule. |
| `supabase/migrations/00036_campaigns_hp_rule.sql` | Create | `ALTER TABLE campaigns ADD COLUMN hp_rule TEXT NULL;` plus a check-constraint to validate against the enum. |
| `components/builder/class-step-rail/hp-picker.tsx` | Create | Average/Roll/Manual radiogroup + value display. Reused by `<LevelUpPane>` AND `<ClassLevelPane>` retrofit. |
| `components/builder/class-step-rail/level-up-button.tsx` | Create | Rail tile with idle / disabled-with-reason / active-flow states. Tone-coded via existing `classTone()` helper. |
| `components/builder/class-step-rail/level-up-action-bar.tsx` | Create | "Cancel level-up" + "Confirm level N" bar with summary text and gated Confirm. |
| `components/builder/class-step-rail/level-up-pane.tsx` | Create | Main-pane content during flow: breadcrumb + NEW LEVEL ribbon + feature cards + (optional) choice cards + HP picker + action bar. |
| `components/builder/class-step-rail/class-level-pane.tsx` | Modify | Surface `<HpPicker>` for non-Lv1-primary levels (lazy retrofit). Add empty-state message when level has no features (PR-B carryover follow-up). |
| `components/builder/class-step-rail/level-rail.tsx` | Modify | Accept `disabled` (mid-flow lock) + `onLevelUpClick` props. Disable level dropdown + Remove button when `disabled`. Render the trailing `<LevelUpButton>`. |
| `components/builder/class-step-rail/add-class-row.tsx` | Modify | Accept `disabledReason` prop on the locked variant to override the existing prereq lock messaging during a level-up flow. |
| `components/builder/class-step-rail/index.tsx` | Modify | Add `levelUpDraft` state, render `<LevelUpButton>` per class via `<LevelRail>`, swap main pane to `<LevelUpPane>` when draft active, propagate hard-lock disabled props. Mutually exclusive with PR-C's `showPicker`. Drop dead `contentRefs` prop (PR-C reviewer note carryover). |
| `app/(app)/characters/[id]/builder/class/class-step-client.tsx` | Modify | Resolve `hpRule` via the precedence chain. Pass `hpRule`, `hpRolls`, and Confirm/Cancel handlers to the rail. |
| `app/(app)/characters/[id]/builder/class/page.tsx` | Modify | Join `campaigns.hp_rule` when the character is in a campaign and pass through. |
| `tests/components/builder/class-step-rail.test.tsx` | Modify | Append integration + atomic-component tests. Patch `setupRail()` to expose `onAddClass` in `handlers` (PR-C carryover). Patch `setup()`/`setupRail()` to add `hpRolls`/`hpRule`/`onAddClass`/`onConfirmLevelUp`/`onCancelLevelUp` defaults. |

---

## Task 1 — `level-up-rules` helper + foundation types

**Files:**
- Create: `lib/builder/level-up-rules.ts`
- Modify: `lib/types/character.ts`
- Test: `tests/lib/builder/level-up-rules.test.ts`

- [ ] **Step 1: Add foundation types to `lib/types/character.ts`.**

Find the existing `CharacterChoices` interface and add `hp_rolls`. Also add the new types and the `Campaign.hp_rule` field.

After the existing `AsiChoice` interface, add the HP rule + roll types. We define `HpRule` here in `character.ts` (not in `level-up-rules.ts`) so the rules helper can import the type one-way without a circular dep. The rules helper only re-exports `HpRule` for ergonomics:

```ts
/** Campaign/system-level HP rule. Drives picker behavior and engine math.
 *  - free_choice: user picks Average / Roll / Manual per level
 *  - average_only: engine pins to averageHitDie; picker read-only
 *  - rolled_only: user must roll; engine falls back to average until rolled
 *  - max_first_level_each_class: every class's level 1 = max die; rest follow free_choice
 *  - max_for_all: every level = max die; picker read-only */
export type HpRule =
  | "free_choice"
  | "average_only"
  | "rolled_only"
  | "max_first_level_each_class"
  | "max_for_all";

/** Method used to determine HP gain at a given level. Stored value is always
 *  the raw die contribution (before CON), so CON changes from later ASIs
 *  automatically reflect in total HP without invalidating stored rolls. */
export type HpRollMethod = "average" | "rolled" | "manual";

export interface HpRollRecord {
  method: HpRollMethod;
  /** Raw die contribution for this level, BEFORE CON modifier (1..die). */
  value: number;
}
```

Inside `CharacterChoices`, after the existing `asi_choices` line, add:

```ts
  /** Per-level HP rolls keyed as `{classSlug}-{level}` (e.g. "paladin-7").
   *  Lv 1 of the primary class is NOT stored — RAW pins it to max die.
   *  Engine reads from this map when present, falls back to averageHitDie. */
  hp_rolls?: Record<string, HpRollRecord>;
```

Inside `Campaign`, after the existing `created_at` line, add:

```ts
  /** Optional campaign-wide HP rule override. NULL = inherit from system. */
  hp_rule?: HpRule | null;
```

No new imports needed — `HpRule` is now defined in this file alongside the other character types.

- [ ] **Step 2: Write the failing test for the helper.**

Create `tests/lib/builder/level-up-rules.test.ts` with this exact content:

```ts
import { describe, it, expect } from "vitest";
import {
  resolveHpRule,
  hpContributionForLevel,
  type HpRule,
} from "@/lib/builder/level-up-rules";
import type { HpRollRecord } from "@/lib/types/character";

describe("resolveHpRule", () => {
  it("returns campaign rule when present (campaign overrides system)", () => {
    expect(resolveHpRule("max_for_all", "free_choice")).toBe("max_for_all");
  });

  it("falls back to system rule when campaign is null", () => {
    expect(resolveHpRule(null, "average_only")).toBe("average_only");
  });

  it("falls back to system rule when campaign is undefined", () => {
    expect(resolveHpRule(undefined, "rolled_only")).toBe("rolled_only");
  });

  it("falls back to free_choice when both are null/undefined", () => {
    expect(resolveHpRule(null, null)).toBe("free_choice");
    expect(resolveHpRule(undefined, undefined)).toBe("free_choice");
  });
});

describe("hpContributionForLevel", () => {
  function input(overrides: Partial<Parameters<typeof hpContributionForLevel>[0]> = {}) {
    return {
      classSlug: "paladin",
      level: 2,
      die: 10,
      isFirstLevelOfPrimary: false,
      isFirstLevelOfClass: false,
      storedRoll: undefined as HpRollRecord | undefined,
      rule: "free_choice" as HpRule,
      ...overrides,
    };
  }

  it("returns max die for Lv1 of primary class regardless of rule or stored roll", () => {
    expect(
      hpContributionForLevel(
        input({ isFirstLevelOfPrimary: true, level: 1, rule: "average_only", storedRoll: { method: "rolled", value: 1 } }),
      ),
    ).toBe(10);
  });

  it("returns max die for every level when rule is max_for_all", () => {
    expect(hpContributionForLevel(input({ rule: "max_for_all", level: 7 }))).toBe(10);
    expect(hpContributionForLevel(input({ rule: "max_for_all", die: 6 }))).toBe(6);
  });

  it("returns max die for Lv1 of any class when rule is max_first_level_each_class", () => {
    expect(
      hpContributionForLevel(input({ rule: "max_first_level_each_class", isFirstLevelOfClass: true, level: 1 })),
    ).toBe(10);
  });

  it("falls through to free_choice for non-Lv1 levels under max_first_level_each_class", () => {
    expect(
      hpContributionForLevel(input({ rule: "max_first_level_each_class", level: 5 })),
    ).toBe(6); // averageHitDie(10) = 6
  });

  it("returns averageHitDie under average_only regardless of stored roll", () => {
    expect(
      hpContributionForLevel(input({ rule: "average_only", storedRoll: { method: "rolled", value: 9 } })),
    ).toBe(6);
    expect(hpContributionForLevel(input({ rule: "average_only", die: 8 }))).toBe(5);
  });

  it("uses stored roll under rolled_only when present", () => {
    expect(
      hpContributionForLevel(input({ rule: "rolled_only", storedRoll: { method: "rolled", value: 8 } })),
    ).toBe(8);
  });

  it("falls back to averageHitDie under rolled_only when no stored roll", () => {
    expect(hpContributionForLevel(input({ rule: "rolled_only", storedRoll: undefined }))).toBe(6);
  });

  it("uses stored roll value under free_choice", () => {
    expect(
      hpContributionForLevel(input({ rule: "free_choice", storedRoll: { method: "rolled", value: 7 } })),
    ).toBe(7);
  });

  it("falls back to averageHitDie under free_choice when no stored roll", () => {
    expect(hpContributionForLevel(input({ rule: "free_choice", storedRoll: undefined }))).toBe(6);
  });

  it("returns averageHitDie correctly for all standard hit dice", () => {
    expect(hpContributionForLevel(input({ die: 6 }))).toBe(4);  // d6 → 4
    expect(hpContributionForLevel(input({ die: 8 }))).toBe(5);  // d8 → 5
    expect(hpContributionForLevel(input({ die: 10 }))).toBe(6); // d10 → 6
    expect(hpContributionForLevel(input({ die: 12 }))).toBe(7); // d12 → 7
  });
});
```

- [ ] **Step 3: Run the failing test.**

Run: `npx vitest run tests/lib/builder/level-up-rules.test.ts`
Expected: FAIL — `Cannot find module '@/lib/builder/level-up-rules'`.

- [ ] **Step 4: Implement the helper.**

Create `lib/builder/level-up-rules.ts`. Note: `HpRule` is defined in `lib/types/character.ts` (Step 1) and re-exported here for ergonomics, so consumers can grab the type alongside the helper functions:

```ts
import type { HpRollRecord, HpRule } from "@/lib/types/character";

export type { HpRule } from "@/lib/types/character";

export interface HpContributionInput {
  classSlug: string;
  level: number;
  /** Hit die value, e.g. 10 for d10. */
  die: number;
  /** True only when this is level 1 AND the class is the primary (first) class. */
  isFirstLevelOfPrimary: boolean;
  /** True for level === 1 of any class. */
  isFirstLevelOfClass: boolean;
  storedRoll: HpRollRecord | undefined;
  rule: HpRule;
}

export function resolveHpRule(
  campaignRule: HpRule | null | undefined,
  systemRule: HpRule | null | undefined,
): HpRule {
  return campaignRule ?? systemRule ?? "free_choice";
}

function averageHitDie(die: number): number {
  return Math.floor(die / 2) + 1;
}

export function hpContributionForLevel(input: HpContributionInput): number {
  const { die, isFirstLevelOfPrimary, isFirstLevelOfClass, storedRoll, rule } = input;

  if (isFirstLevelOfPrimary) return die;
  if (rule === "max_for_all") return die;
  if (rule === "max_first_level_each_class" && isFirstLevelOfClass) return die;
  if (rule === "average_only") return averageHitDie(die);
  if (rule === "rolled_only") {
    return storedRoll?.value ?? averageHitDie(die);
  }
  return storedRoll?.value ?? averageHitDie(die);
}
```

- [ ] **Step 5: Run the test to verify it passes.**

Run: `npx vitest run tests/lib/builder/level-up-rules.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 6: Type-check.**

Run: `npx tsc --noEmit 2>&1 | grep -i "level-up-rules\|character.ts" | head`
Expected: No errors mentioning these files.

- [ ] **Step 7: Commit.**

```bash
git add lib/builder/level-up-rules.ts lib/types/character.ts tests/lib/builder/level-up-rules.test.ts
git commit -m "$(cat <<'EOF'
feat(builder): HP rule helper + foundation types

Pure helper for the level-up flow's HP-rule precedence chain
(campaign → system → free_choice default) and the per-level
contribution decision tree that respects RAW Lv1-primary-max
+ the resolved rule + stored rolls.

HpRollRecord stores the raw die contribution (1..die) BEFORE
CON modifier; computeMaxHp adds CON separately so a later ASI
that raises CON automatically reflects in total HP without
invalidating stored rolls.

Used by the upcoming computeMaxHp extension and the level-up
pane's HP picker (PR-D of M2).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 — Engine extension (`computeMaxHp`)

**Files:**
- Modify: `lib/character/max-hp.ts`
- Modify: `tests/lib/character/max-hp.test.ts`
- Modify: `app/(app)/characters/[id]/page.tsx` (call site)

- [ ] **Step 1: Read the existing `lib/character/max-hp.ts` and `tests/lib/character/max-hp.test.ts` to understand the current shape.**

The existing helper has signature `computeMaxHp(classes, classContent, constitutionScore)`. We're extending it with two optional new parameters that default to the current behavior.

- [ ] **Step 2: Append failing tests to `tests/lib/character/max-hp.test.ts`.**

Add a new describe block at the end of the file (DO NOT touch existing describes — they verify the backwards-compat path):

```ts
import { computeMaxHp } from "@/lib/character/max-hp";
import type { HpRollRecord } from "@/lib/types/character";
// (existing imports already cover ClassChoice / class content shape)

describe("computeMaxHp — hpRolls + hpRule extension", () => {
  const paladinClass = {
    paladin: { slug: "paladin", data: { hit_die: 10 } },
  };

  it("backwards compat: empty hpRolls + free_choice rule matches the legacy output exactly", () => {
    const classes = [{ slug: "paladin", level: 5 }];
    const legacy = computeMaxHp(classes, paladinClass, 14);
    const extended = computeMaxHp(classes, paladinClass, 14, {}, "free_choice");
    expect(extended).toBe(legacy);
  });

  it("uses stored roll values when present (free_choice)", () => {
    // CON 14 → +2 mod. Lv1 primary always max die = 10. Lv2-5 use stored or fallback.
    // Stored: paladin-3 = 8 (rolled), paladin-5 = 10 (rolled). Others fall back to avg(d10) = 6.
    const hpRolls: Record<string, HpRollRecord> = {
      "paladin-3": { method: "rolled", value: 8 },
      "paladin-5": { method: "rolled", value: 10 },
    };
    const classes = [{ slug: "paladin", level: 5 }];
    // Lv1: max(1, 10 + 2) = 12
    // Lv2: max(1, 6 + 2) = 8
    // Lv3: max(1, 8 + 2) = 10
    // Lv4: max(1, 6 + 2) = 8
    // Lv5: max(1, 10 + 2) = 12
    // Total: 12 + 8 + 10 + 8 + 12 = 50
    expect(computeMaxHp(classes, paladinClass, 14, hpRolls, "free_choice")).toBe(50);
  });

  it("max_for_all rule pins every level to max die regardless of stored rolls", () => {
    const hpRolls: Record<string, HpRollRecord> = {
      "paladin-3": { method: "rolled", value: 1 },
    };
    const classes = [{ slug: "paladin", level: 4 }];
    // Every level: 10 + 2 = 12. Total: 48.
    expect(computeMaxHp(classes, paladinClass, 14, hpRolls, "max_for_all")).toBe(48);
  });

  it("average_only rule pins every level to avg die regardless of stored rolls", () => {
    const hpRolls: Record<string, HpRollRecord> = {
      "paladin-3": { method: "rolled", value: 10 },
    };
    const classes = [{ slug: "paladin", level: 4 }];
    // Lv1 (primary) is still RAW max-die. Lv2-4: avg = 6, +CON 2 = 8 each.
    // Total: 12 + 8 + 8 + 8 = 36.
    expect(computeMaxHp(classes, paladinClass, 14, hpRolls, "average_only")).toBe(36);
  });

  it("rolled_only rule uses stored roll, falls back to avg when missing", () => {
    const hpRolls: Record<string, HpRollRecord> = {
      "paladin-2": { method: "rolled", value: 9 },
      // Lv3, Lv4 not yet rolled.
    };
    const classes = [{ slug: "paladin", level: 4 }];
    // Lv1: 10 + 2 = 12
    // Lv2: 9 + 2 = 11
    // Lv3: 6 (avg fallback) + 2 = 8
    // Lv4: 6 + 2 = 8
    // Total: 12 + 11 + 8 + 8 = 39
    expect(computeMaxHp(classes, paladinClass, 14, hpRolls, "rolled_only")).toBe(39);
  });

  it("max_first_level_each_class gives Lv1 of every class max die; rest follow free_choice", () => {
    const classes = [
      { slug: "paladin", level: 3 },
      { slug: "wizard", level: 2 },
    ];
    const classContent = {
      paladin: { slug: "paladin", data: { hit_die: 10 } },
      wizard: { slug: "wizard", data: { hit_die: 6 } },
    };
    // Paladin Lv1 (also primary): max d10 = 10. +2 CON = 12.
    // Paladin Lv2,Lv3: avg(10) = 6. +2 CON = 8 each.
    // Wizard Lv1 (Lv1 of class, even though not primary): max d6 = 6. +2 CON = 8.
    // Wizard Lv2: avg(6) = 4. +2 CON = 6.
    // Total: 12 + 8 + 8 + 8 + 6 = 42.
    expect(computeMaxHp(classes, classContent, 14, {}, "max_first_level_each_class")).toBe(42);
  });

  it("multiclass with mixed rolls handles primary vs non-primary correctly", () => {
    const classes = [
      { slug: "paladin", level: 2 },
      { slug: "wizard", level: 1 },
    ];
    const classContent = {
      paladin: { slug: "paladin", data: { hit_die: 10 } },
      wizard: { slug: "wizard", data: { hit_die: 6 } },
    };
    const hpRolls: Record<string, HpRollRecord> = {
      "paladin-2": { method: "rolled", value: 7 },
      "wizard-1": { method: "manual", value: 4 },
    };
    // Paladin Lv1 (primary): max 10 + 2 = 12.
    // Paladin Lv2: stored 7 + 2 = 9.
    // Wizard Lv1 (NOT primary, not first-of-each rule): stored 4 + 2 = 6.
    // Total: 12 + 9 + 6 = 27.
    expect(computeMaxHp(classes, classContent, 14, hpRolls, "free_choice")).toBe(27);
  });

  it("CON penalty (negative mod) still floors at +1 per level", () => {
    const classes = [{ slug: "paladin", level: 3 }];
    // CON 4 → mod -3.
    // Lv1: max(1, 10 + -3) = 7.
    // Lv2: max(1, 6 + -3) = 3.
    // Lv3: max(1, 6 + -3) = 3.
    // Total: 13.
    expect(computeMaxHp(classes, paladinClass, 4, {}, "free_choice")).toBe(13);
  });

  it("severe CON penalty floors per-level contribution at 1", () => {
    const classes = [{ slug: "paladin", level: 3 }];
    // CON 1 → mod -5. Lv1: max(1, 10-5) = 5. Lv2: max(1, 6-5) = 1. Lv3: max(1, 6-5) = 1.
    // Total: 7.
    expect(computeMaxHp(classes, paladinClass, 1, {}, "free_choice")).toBe(7);
  });
});
```

- [ ] **Step 3: Run the failing tests.**

Run: `npx vitest run tests/lib/character/max-hp.test.ts`
Expected: PASS for the existing legacy tests; FAIL for the new describe (signature mismatch).

- [ ] **Step 4: Update `lib/character/max-hp.ts`.**

Replace the entire file contents with:

```ts
// Maximum HP computation for D&D 5e characters.
//
// Why a standalone helper instead of the engine's derived-stat formula?
// The schema defines `hit_points_max` as `hit_die_total + (mod(constitution) * level)`,
// but `hit_die_total` is per-class and can't be expressed by the existing expression
// parser (which operates on scalar stats). Computing HP directly in TypeScript with
// access to class content is cleaner than extending the parser to handle class
// iteration.
//
// RAW (Player's Handbook, multiclassing):
//  - First (primary) class, level 1: gain MAX of hit die
//  - All other levels (including multiclass L1s): gain average of hit die by default
//  - Average hit die = floor(die/2) + 1 → d6=4, d8=5, d10=6, d12=7
//  - CON modifier applied per character level (total)
//  - Minimum +1 HP per level even if CON modifier is very negative
//
// PR-D extension: per-level HP rolls (`hpRolls`) and a campaign/system HP rule
// (`hpRule`) override the default per-level math via `hpContributionForLevel`.

import { hpContributionForLevel, type HpRule } from "@/lib/builder/level-up-rules";
import type { HpRollRecord } from "@/lib/types/character";

interface ClassChoice {
  slug: string;
  level: number;
}

interface ClassContentEntry {
  slug: string;
  data: Record<string, unknown>;
}

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

function hitDieFor(slug: string, classContent: Record<string, ClassContentEntry>): number {
  const entry = classContent[slug];
  return typeof entry?.data?.hit_die === "number" ? (entry.data.hit_die as number) : 8;
}

/**
 * Compute maximum hit points for a character.
 *
 * @param classes Character's class choices in order taken. `classes[0]` is the primary class.
 * @param classContent Map of class slug → content definition (with `data.hit_die`).
 * @param constitutionScore Character's current CON score (post-effects).
 * @param hpRolls Optional per-level HP rolls keyed as `{classSlug}-{level}`. Stored values are raw die contributions (BEFORE CON).
 * @param hpRule Optional resolved HP rule. Defaults to "free_choice" (matches legacy behavior).
 * @returns Total maximum hit points. Returns 0 if no classes.
 */
export function computeMaxHp(
  classes: ClassChoice[],
  classContent: Record<string, ClassContentEntry>,
  constitutionScore: number,
  hpRolls: Record<string, HpRollRecord> = {},
  hpRule: HpRule = "free_choice",
): number {
  if (classes.length === 0) return 0;
  const conMod = abilityMod(constitutionScore);

  let total = 0;
  classes.forEach((cls, classIndex) => {
    const die = hitDieFor(cls.slug, classContent);
    const isPrimary = classIndex === 0;

    for (let level = 1; level <= cls.level; level++) {
      const contribution = hpContributionForLevel({
        classSlug: cls.slug,
        level,
        die,
        isFirstLevelOfPrimary: isPrimary && level === 1,
        isFirstLevelOfClass: level === 1,
        storedRoll: hpRolls[`${cls.slug}-${level}`],
        rule: hpRule,
      });
      total += Math.max(1, contribution + conMod);
    }
  });

  return total;
}
```

- [ ] **Step 5: Run the tests to verify all pass.**

Run: `npx vitest run tests/lib/character/max-hp.test.ts`
Expected: PASS — both legacy describes and the new extension describe all green.

- [ ] **Step 6: Update the call site in `app/(app)/characters/[id]/page.tsx`.**

Find the existing line (around line 176):

```tsx
const maxHp = computeMaxHp(classChoices, classData, constitutionScore);
```

Replace with:

```tsx
const hpRolls = (character.choices?.hp_rolls ?? {}) as Record<string, import("@/lib/types/character").HpRollRecord>;
const hpRule = (character.game_systems?.schema_definition as { hp_rule?: import("@/lib/builder/level-up-rules").HpRule } | undefined)?.hp_rule ?? "free_choice";
const maxHp = computeMaxHp(classChoices, classData, constitutionScore, hpRolls, hpRule);
```

This task only handles the system-level rule at this call site (no campaign join here yet — Task 11 adds the campaign join in the builder page). For the character sheet page, system rule is sufficient until campaign-aware HP becomes a sheet-level concern.

- [ ] **Step 7: Type-check.**

Run: `npx tsc --noEmit 2>&1 | grep -E "max-hp|page.tsx" | head -10`
Expected: no errors mentioning these files.

- [ ] **Step 8: Run all engine tests.**

Run: `npx vitest run tests/lib/character`
Expected: PASS.

- [ ] **Step 9: Commit.**

```bash
git add lib/character/max-hp.ts tests/lib/character/max-hp.test.ts "app/(app)/characters/[id]/page.tsx"
git commit -m "$(cat <<'EOF'
feat(engine): extend computeMaxHp with hpRolls + hpRule

Adds optional hpRolls and hpRule parameters that delegate
per-level math to hpContributionForLevel from level-up-rules.
Defaults preserve the legacy behavior exactly (free_choice
rule + empty rolls = today's average + Lv1-primary-max
formula). Character sheet page now passes both.

Backwards compat verified by an explicit test that compares
the extended call to the legacy 3-arg call for the same
inputs and confirms identical output.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 — Database migration: `campaigns.hp_rule`

**Files:**
- Create: `supabase/migrations/00036_campaigns_hp_rule.sql`

- [ ] **Step 1: Create the migration file.**

Write `supabase/migrations/00036_campaigns_hp_rule.sql`:

```sql
-- Campaign-level HP rule override for the level-up flow (PR-D of M2).
--
-- Adds an optional per-campaign HP rule that the builder respects when a
-- character is in a campaign. NULL = inherit from the game system's default
-- (read from `game_systems.schema_definition.hp_rule`).
--
-- Allowed values match the HpRule TypeScript enum in
-- lib/builder/level-up-rules.ts. The CHECK constraint enforces this at the
-- database level so application bugs can't insert garbage values.
--
-- Per-character HP rolls live in `characters.choices.hp_rolls` (JSONB);
-- no migration needed for that part.

ALTER TABLE campaigns
  ADD COLUMN hp_rule TEXT NULL;

ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_hp_rule_check
  CHECK (
    hp_rule IS NULL
    OR hp_rule IN (
      'free_choice',
      'average_only',
      'rolled_only',
      'max_first_level_each_class',
      'max_for_all'
    )
  );

COMMENT ON COLUMN campaigns.hp_rule IS
  'Per-campaign HP rule override. NULL inherits from game_systems.schema_definition.hp_rule. See lib/builder/level-up-rules.ts HpRule enum.';
```

- [ ] **Step 2: Apply the migration locally.**

Run: `npx supabase migration up`
Expected: migration applied; "00036" listed in `supabase migration list`.

(If the local Supabase instance isn't running, run `npx supabase start` first.)

- [ ] **Step 3: Verify the column exists with the constraint.**

Run: `npx supabase db --help` to find the right local-DB connection command, or use the studio at http://localhost:54323. Alternatively, run a quick query:

```bash
npx supabase db query "SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'hp_rule';"
```

Expected: one row, `column_name=hp_rule`, `is_nullable=YES`, `data_type=text`.

If `npx supabase db query` isn't available in this CLI version, just verify by attempting an insert with a bad value:

```bash
npx supabase db query "INSERT INTO campaigns (id, system_id, owner_id, name, description, invite_code, hp_rule) VALUES ('00000000-0000-0000-0000-000000000999', (SELECT id FROM game_systems LIMIT 1), (SELECT id FROM profiles LIMIT 1), 'test', 'test', 'TEST999', 'bogus_value');"
```

Expected: INSERT fails with a constraint violation referencing `campaigns_hp_rule_check`.

If neither verification path works in your local setup, manual inspection of the SQL is acceptable — the migration is small and obviously correct.

- [ ] **Step 4: Commit.**

```bash
git add supabase/migrations/00036_campaigns_hp_rule.sql
git commit -m "$(cat <<'EOF'
feat(db): campaigns.hp_rule nullable column

Adds the campaign-level HP rule override column for the
level-up flow's precedence chain (campaign → system →
default). NULL = inherit from system. CHECK constraint
enforces the enum at the DB level to backstop the Zod
validator at the API boundary.

DM-facing UI for setting this column is deferred to a future
campaign-settings PR. PR-D ships the read path only.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 — `<HpPicker>` atomic component

**Files:**
- Create: `components/builder/class-step-rail/hp-picker.tsx`
- Test: append to `tests/components/builder/class-step-rail.test.tsx`

- [ ] **Step 1: Append failing tests at the end of `tests/components/builder/class-step-rail.test.tsx`.**

```tsx
import { HpPicker } from "@/components/builder/class-step-rail/hp-picker";
import type { HpRollRecord } from "@/lib/types/character";

describe("HpPicker", () => {
  function defaults(overrides: Partial<Parameters<typeof HpPicker>[0]> = {}) {
    return {
      classSlug: "paladin",
      level: 2,
      hitDie: 10,
      conMod: 2,
      isFirstLevelOfPrimary: false,
      hpRule: "free_choice" as const,
      storedRoll: undefined as HpRollRecord | undefined,
      onChange: vi.fn(),
      ...overrides,
    };
  }

  it("does not render when isFirstLevelOfPrimary is true", () => {
    const { container } = render(<HpPicker {...defaults({ isFirstLevelOfPrimary: true })} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders all three method buttons under free_choice", () => {
    render(<HpPicker {...defaults()} />);
    expect(screen.getByRole("radio", { name: /Average/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Roll d10/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Manual/i })).toBeInTheDocument();
  });

  it("Average button shows displayed value avg + conMod (d10 + CON 2 → +8)", () => {
    render(<HpPicker {...defaults()} />);
    expect(screen.getByRole("radio", { name: /Average.*\+8/i })).toBeInTheDocument();
  });

  it("clicking Average calls onChange with raw die contribution (no conMod)", () => {
    const onChange = vi.fn();
    render(<HpPicker {...defaults({ onChange })} />);
    fireEvent.click(screen.getByRole("radio", { name: /Average/i }));
    expect(onChange).toHaveBeenCalledWith({ method: "average", value: 6 }); // floor(10/2)+1 = 6
  });

  it("clicking Roll d{die} writes a roll in [1, die]", () => {
    const onChange = vi.fn();
    render(<HpPicker {...defaults({ onChange })} />);
    fireEvent.click(screen.getByRole("radio", { name: /Roll d10/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const record = onChange.mock.calls[0][0] as HpRollRecord;
    expect(record.method).toBe("rolled");
    expect(record.value).toBeGreaterThanOrEqual(1);
    expect(record.value).toBeLessThanOrEqual(10);
  });

  it("re-clicking Roll re-rolls (overwrites stored value)", () => {
    const onChange = vi.fn();
    render(<HpPicker {...defaults({ onChange })} />);
    fireEvent.click(screen.getByRole("radio", { name: /Roll d10/i }));
    fireEvent.click(screen.getByRole("radio", { name: /Roll d10/i }));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("clicking Manual reveals a numeric input and onChange fires on Enter", () => {
    const onChange = vi.fn();
    render(<HpPicker {...defaults({ onChange })} />);
    fireEvent.click(screen.getByRole("radio", { name: /Manual/i }));
    const input = screen.getByLabelText("Manual HP value");
    fireEvent.change(input, { target: { value: "7" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(onChange).toHaveBeenCalledWith({ method: "manual", value: 7 });
  });

  it("Manual input out-of-range (0 or > die) does not fire onChange", () => {
    const onChange = vi.fn();
    render(<HpPicker {...defaults({ onChange })} />);
    fireEvent.click(screen.getByRole("radio", { name: /Manual/i }));
    const input = screen.getByLabelText("Manual HP value");
    fireEvent.change(input, { target: { value: "11" } });  // > d10
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("rendered method shows aria-checked on the right radio when storedRoll is present", () => {
    render(<HpPicker {...defaults({ storedRoll: { method: "rolled", value: 8 } })} />);
    const rollBtn = screen.getByRole("radio", { name: /Roll d10/i });
    expect(rollBtn).toHaveAttribute("aria-checked", "true");
  });

  it("rolled_only rule renders only the Roll button + read-only display when no roll yet", () => {
    render(<HpPicker {...defaults({ hpRule: "rolled_only" })} />);
    expect(screen.queryByRole("radio", { name: /Average/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Manual/i })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Roll d10/i })).toBeInTheDocument();
  });

  it("average_only rule renders read-only display, no interactive radios", () => {
    const { container } = render(<HpPicker {...defaults({ hpRule: "average_only" })} />);
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.getByText(/Campaign rule: Average/i)).toBeInTheDocument();
    // Display should show "+8" (avg 6 + CON 2)
    expect(container.textContent).toContain("+8");
  });

  it("max_for_all rule renders read-only display showing max + conMod", () => {
    const { container } = render(<HpPicker {...defaults({ hpRule: "max_for_all" })} />);
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.getByText(/Campaign rule: Max/i)).toBeInTheDocument();
    expect(container.textContent).toContain("+12"); // 10 + 2
  });

  it("max_first_level_each_class at level 1 of any class renders read-only display", () => {
    render(<HpPicker {...defaults({ hpRule: "max_first_level_each_class", level: 1 })} />);
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.getByText(/First level of class.*Max/i)).toBeInTheDocument();
  });

  it("max_first_level_each_class at level > 1 renders the full free_choice picker", () => {
    render(<HpPicker {...defaults({ hpRule: "max_first_level_each_class", level: 5 })} />);
    expect(screen.getByRole("radio", { name: /Average/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Roll d10/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Manual/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "HpPicker"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `components/builder/class-step-rail/hp-picker.tsx`.**

```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { HpRollRecord } from "@/lib/types/character";
import type { HpRule } from "@/lib/builder/level-up-rules";

interface HpPickerProps {
  classSlug: string;
  level: number;
  hitDie: number;
  conMod: number;
  isFirstLevelOfPrimary: boolean;
  hpRule: HpRule;
  storedRoll: HpRollRecord | undefined;
  onChange: (record: HpRollRecord) => void;
}

function averageHitDie(die: number): number {
  return Math.floor(die / 2) + 1;
}

function rollDie(die: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % die) + 1;
}

export function HpPicker(props: HpPickerProps) {
  const { classSlug, level, hitDie, conMod, isFirstLevelOfPrimary, hpRule, storedRoll, onChange } = props;

  if (isFirstLevelOfPrimary) return null;

  const avg = averageHitDie(hitDie);
  const isLevelOneOfClass = level === 1;
  const labelId = `hp-method-label-${classSlug}-${level}`;

  // Decide which renderer to use based on rule + level context.
  const isMaxLocked =
    hpRule === "max_for_all" ||
    (hpRule === "max_first_level_each_class" && isLevelOneOfClass);
  const isAverageLocked = hpRule === "average_only";
  const isRolledOnly = hpRule === "rolled_only";

  if (isAverageLocked) {
    const display = avg + conMod;
    return (
      <div className="rounded-md border border-border bg-card/40 p-4">
        <p id={labelId} className="text-xs font-medium uppercase text-muted-foreground tracking-wider">
          Hit points
        </p>
        <p className="mt-2 text-sm">
          <span className="text-muted-foreground">Campaign rule: Average</span>
          <span className="ml-2 font-semibold text-foreground">+{display}</span>
        </p>
      </div>
    );
  }

  if (isMaxLocked) {
    const display = hitDie + conMod;
    const ruleLabel =
      hpRule === "max_for_all"
        ? "Campaign rule: Max"
        : "First level of class — Max";
    return (
      <div className="rounded-md border border-border bg-card/40 p-4">
        <p id={labelId} className="text-xs font-medium uppercase text-muted-foreground tracking-wider">
          Hit points
        </p>
        <p className="mt-2 text-sm">
          <span className="text-muted-foreground">{ruleLabel}</span>
          <span className="ml-2 font-semibold text-foreground">+{display}</span>
        </p>
      </div>
    );
  }

  return (
    <HpPickerInteractive
      labelId={labelId}
      hitDie={hitDie}
      avg={avg}
      conMod={conMod}
      storedRoll={storedRoll}
      onChange={onChange}
      onlyRoll={isRolledOnly}
    />
  );
}

interface InteractiveProps {
  labelId: string;
  hitDie: number;
  avg: number;
  conMod: number;
  storedRoll: HpRollRecord | undefined;
  onChange: (record: HpRollRecord) => void;
  onlyRoll: boolean;
}

function HpPickerInteractive(props: InteractiveProps) {
  const { labelId, hitDie, avg, conMod, storedRoll, onChange, onlyRoll } = props;
  const [showManualInput, setShowManualInput] = useState(storedRoll?.method === "manual");
  const [manualValue, setManualValue] = useState<string>(
    storedRoll?.method === "manual" ? String(storedRoll.value) : "",
  );

  function isChecked(method: HpRollRecord["method"]): boolean {
    return storedRoll?.method === method;
  }

  function handleAverage() {
    setShowManualInput(false);
    onChange({ method: "average", value: avg });
  }

  function handleRoll() {
    setShowManualInput(false);
    onChange({ method: "rolled", value: rollDie(hitDie) });
  }

  function handleManualToggle() {
    setShowManualInput(true);
  }

  function commitManual() {
    const n = Number.parseInt(manualValue, 10);
    if (!Number.isInteger(n) || n < 1 || n > hitDie) return;
    onChange({ method: "manual", value: n });
  }

  const displayValue = storedRoll ? storedRoll.value + conMod : null;

  return (
    <div className="rounded-md border border-border bg-card/40 p-4">
      <p id={labelId} className="text-xs font-medium uppercase text-muted-foreground tracking-wider">
        Hit points
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="mt-3 flex flex-wrap items-center gap-2">
        {!onlyRoll && (
          <button
            type="button"
            role="radio"
            aria-checked={isChecked("average") ? "true" : "false"}
            onClick={handleAverage}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              isChecked("average") ? "border-accent bg-accent/10 text-accent-foreground" : "border-border hover:bg-accent/5",
            )}
          >
            Average (+{avg + conMod})
          </button>
        )}
        <button
          type="button"
          role="radio"
          aria-checked={isChecked("rolled") ? "true" : "false"}
          onClick={handleRoll}
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm transition-colors",
            isChecked("rolled") ? "border-accent bg-accent/10 text-accent-foreground" : "border-border hover:bg-accent/5",
          )}
        >
          Roll d{hitDie}
          {isChecked("rolled") && storedRoll && (
            <span className="ml-1 text-muted-foreground">(+{storedRoll.value + conMod})</span>
          )}
        </button>
        {!onlyRoll && (
          <button
            type="button"
            role="radio"
            aria-checked={isChecked("manual") ? "true" : "false"}
            onClick={handleManualToggle}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              isChecked("manual") ? "border-accent bg-accent/10 text-accent-foreground" : "border-border hover:bg-accent/5",
            )}
          >
            Manual
            {isChecked("manual") && storedRoll && (
              <span className="ml-1 text-muted-foreground">(+{storedRoll.value + conMod})</span>
            )}
          </button>
        )}
      </div>
      {showManualInput && (
        <div className="mt-3">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={hitDie}
            aria-label="Manual HP value"
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitManual();
            }}
            onBlur={commitManual}
            className="w-24 rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
          <span className="ml-2 text-xs text-muted-foreground">
            Enter a value in [1, {hitDie}]
          </span>
        </div>
      )}
      {displayValue !== null && (
        <p className="mt-2 text-xs text-muted-foreground">
          Total HP gain this level: <span className="font-semibold text-foreground">+{displayValue}</span>
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the new tests.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "HpPicker"`
Expected: PASS — all 14 tests green.

- [ ] **Step 5: Run the full file to confirm no regressions.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx`
Expected: PASS for all describes including PR-A/B/C ones.

- [ ] **Step 6: Type-check.**

Run: `npx tsc --noEmit 2>&1 | grep -i "hp-picker\|class-step-rail" | head`
Expected: no errors.

- [ ] **Step 7: Commit.**

```bash
git add components/builder/class-step-rail/hp-picker.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "$(cat <<'EOF'
feat(builder): HpPicker atomic component for level-up flow

Average / Roll d{die} / Manual radiogroup with crypto-backed
roll randomness. Stored value is the raw die contribution
(1..die); display shows value + conMod so CON changes from
later ASIs reflect automatically.

Five rule branches:
- free_choice: all three buttons interactive
- rolled_only: only Roll button visible
- average_only: read-only "Campaign rule: Average — +N"
- max_for_all: read-only "Campaign rule: Max — +N"
- max_first_level_each_class at L1: read-only "First level of class — Max — +N"
- max_first_level_each_class at L>1: falls through to free_choice

Returns null when isFirstLevelOfPrimary so RAW Lv1-primary-max
is engine-only (not user-editable).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 — `<LevelUpButton>` atomic component

**Files:**
- Create: `components/builder/class-step-rail/level-up-button.tsx`
- Test: append to `tests/components/builder/class-step-rail.test.tsx`

- [ ] **Step 1: Append failing tests.**

```tsx
import { LevelUpButton } from "@/components/builder/class-step-rail/level-up-button";

describe("LevelUpButton", () => {
  it("renders idle state with 'Level up [Class]' label and 'Lv {N+1}' glyph", () => {
    render(
      <LevelUpButton state="idle" classSlug="paladin" classLabel="Paladin" atLevel={6} onClick={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /Level up Paladin to level 7/i })).toBeInTheDocument();
    expect(screen.getByText(/Lv 7/i)).toBeInTheDocument();
  });

  it("idle state is not aria-disabled and click fires onClick", () => {
    const onClick = vi.fn();
    render(
      <LevelUpButton state="idle" classSlug="paladin" classLabel="Paladin" atLevel={6} onClick={onClick} />,
    );
    const btn = screen.getByRole("button", { name: /Level up Paladin/i });
    expect(btn).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disabled-with-reason state renders reason text + aria-disabled true; click is no-op", () => {
    const onClick = vi.fn();
    render(
      <LevelUpButton
        state="disabled"
        classSlug="paladin"
        classLabel="Paladin"
        atLevel={6}
        reason="Finish Pal 7 first"
        onClick={onClick}
      />,
    );
    const btn = screen.getByRole("button", { name: /Level up Paladin/i });
    expect(btn).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/Finish Pal 7 first/i)).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("active-flow state renders 'In progress' reason and is aria-disabled", () => {
    render(
      <LevelUpButton
        state="active-flow"
        classSlug="paladin"
        classLabel="Paladin"
        atLevel={6}
        onClick={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", { name: /Level up Paladin/i });
    expect(btn).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/In progress/i)).toBeInTheDocument();
  });

  it("tone-codes by class slug (gold for martial, purple for caster) via classTone()", () => {
    const { rerender } = render(
      <LevelUpButton state="idle" classSlug="paladin" classLabel="Paladin" atLevel={1} onClick={vi.fn()} />,
    );
    const goldBtn = screen.getByRole("button", { name: /Level up Paladin/i });
    expect(goldBtn).toHaveAttribute("data-tone", "gold");

    rerender(
      <LevelUpButton state="idle" classSlug="wizard" classLabel="Wizard" atLevel={1} onClick={vi.fn()} />,
    );
    const purpleBtn = screen.getByRole("button", { name: /Level up Wizard/i });
    expect(purpleBtn).toHaveAttribute("data-tone", "purple");
  });
});
```

- [ ] **Step 2: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "LevelUpButton"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement.**

```tsx
"use client";

import { Lock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { classTone } from "@/lib/builder/class-tone";

type LevelUpButtonState = "idle" | "disabled" | "active-flow";

interface LevelUpButtonProps {
  state: LevelUpButtonState;
  classSlug: string;
  classLabel: string;
  /** Current level of this class (button shows "Lv {atLevel + 1}"). */
  atLevel: number;
  /** Reason text for the disabled state (e.g. "Finish Pal 7 first", "Lv 20 (max)"). Ignored for idle/active-flow. */
  reason?: string;
  onClick: () => void;
}

const TONE_BORDER_IDLE: Record<"gold" | "purple", string> = {
  gold: "border-[rgba(201,164,74,0.45)] bg-[rgba(201,164,74,0.06)] hover:bg-[rgba(201,164,74,0.12)] text-[#c9a44a]",
  purple: "border-[rgba(124,58,237,0.55)] bg-[rgba(124,58,237,0.08)] hover:bg-[rgba(124,58,237,0.14)] text-[#c7b0ff]",
};

const TONE_BORDER_ACTIVE: Record<"gold" | "purple", string> = {
  gold: "border-[rgba(201,164,74,0.25)] bg-transparent text-muted-foreground",
  purple: "border-[rgba(124,58,237,0.25)] bg-transparent text-muted-foreground",
};

export function LevelUpButton(props: LevelUpButtonProps) {
  const { state, classSlug, classLabel, atLevel, reason, onClick } = props;
  const tone = classTone(classSlug);
  const nextLevel = atLevel + 1;
  const ariaLabel = `Level up ${classLabel} to level ${nextLevel}`;

  if (state === "idle") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        data-tone={tone}
        className={cn(
          "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-xs font-semibold transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          TONE_BORDER_IDLE[tone],
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex size-4 items-center justify-center rounded-full font-bold leading-none",
            tone === "gold" ? "bg-[#c9a44a] text-[#1a1625]" : "bg-[#c7b0ff] text-[#1a1625]",
          )}
        >
          <Plus className="size-3" />
        </span>
        <span className="flex-1 text-left">Level up {classLabel}</span>
        <span aria-hidden="true" className="text-[10px] tabular-nums opacity-80">Lv {nextLevel}</span>
      </button>
    );
  }

  // disabled or active-flow share the same DOM shape; reason text differs.
  const reasonText = state === "active-flow" ? "In progress" : reason ?? "";
  const borderClass =
    state === "active-flow" ? TONE_BORDER_ACTIVE[tone] : "border-dashed border-muted text-muted-foreground";

  return (
    <button
      type="button"
      aria-disabled="true"
      aria-label={ariaLabel}
      aria-describedby={`level-up-reason-${classSlug}`}
      onClick={(e) => e.preventDefault()}
      data-tone={tone}
      className={cn(
        "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-xs cursor-not-allowed transition-colors",
        borderClass,
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex size-4 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-[10px] opacity-60"
      >
        +
      </span>
      <span className="flex-1 text-left">Level up {classLabel}</span>
      <span id={`level-up-reason-${classSlug}`} aria-hidden="false" className="text-[10px] opacity-70">
        {reasonText}
      </span>
    </button>
  );
}
```

- [ ] **Step 4: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "LevelUpButton"`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add components/builder/class-step-rail/level-up-button.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "$(cat <<'EOF'
feat(builder): LevelUpButton atomic component

Three states for the in-rail level-up tile: idle (accent
border + plus glyph + "Lv N" right-side label), disabled
(dashed border + reason text inline), active-flow (muted
accent border + "In progress" label). Tone-coded gold/purple
via the existing classTone() helper.

aria-disabled (not the disabled attribute) on non-idle states
so screen readers still announce the reason. Reason rendered
inline (not tooltip-only) so the lock is discoverable without
hover.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 — `<LevelUpActionBar>` atomic component

**Files:**
- Create: `components/builder/class-step-rail/level-up-action-bar.tsx`
- Test: append to `tests/components/builder/class-step-rail.test.tsx`

- [ ] **Step 1: Append failing tests.**

```tsx
import { LevelUpActionBar } from "@/components/builder/class-step-rail/level-up-action-bar";

describe("LevelUpActionBar", () => {
  function defaults(overrides: Partial<Parameters<typeof LevelUpActionBar>[0]> = {}) {
    return {
      classLabel: "Paladin",
      draftLevel: 7,
      totalLevelAfterConfirm: 10,
      canConfirm: true,
      missingReason: "",
      onCancel: vi.fn(),
      onConfirm: vi.fn(),
      ...overrides,
    };
  }

  it("renders Cancel button + summary text + Confirm button", () => {
    render(<LevelUpActionBar {...defaults()} />);
    expect(screen.getByRole("button", { name: /Cancel level-up/i })).toBeInTheDocument();
    expect(screen.getByText(/Will set Paladin to Lv 7/i)).toBeInTheDocument();
    expect(screen.getByText(/character to Lv 10/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirm level 7/i })).toBeInTheDocument();
  });

  it("Confirm is disabled and aria-describedby points to missingReason when canConfirm is false", () => {
    render(<LevelUpActionBar {...defaults({ canConfirm: false, missingReason: "Pick a subclass to enable Confirm" })} />);
    const confirm = screen.getByRole("button", { name: /Confirm level 7/i });
    expect(confirm).toBeDisabled();
    const describedById = confirm.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();
    expect(document.getElementById(describedById!)?.textContent).toMatch(/Pick a subclass/i);
  });

  it("Confirm is enabled when canConfirm is true and onConfirm fires", () => {
    const onConfirm = vi.fn();
    render(<LevelUpActionBar {...defaults({ onConfirm })} />);
    fireEvent.click(screen.getByRole("button", { name: /Confirm level 7/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("Cancel button calls onCancel", () => {
    const onCancel = vi.fn();
    render(<LevelUpActionBar {...defaults({ onCancel })} />);
    fireEvent.click(screen.getByRole("button", { name: /Cancel level-up/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "LevelUpActionBar"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement.**

```tsx
"use client";

import { Button } from "@/components/ui/button";

interface LevelUpActionBarProps {
  classLabel: string;
  draftLevel: number;
  totalLevelAfterConfirm: number;
  canConfirm: boolean;
  /** Human-readable text describing what's missing when canConfirm is false. Ignored when canConfirm is true. */
  missingReason: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function LevelUpActionBar(props: LevelUpActionBarProps) {
  const { classLabel, draftLevel, totalLevelAfterConfirm, canConfirm, missingReason, onCancel, onConfirm } = props;
  const reasonId = `level-up-confirm-reason-${classLabel.toLowerCase()}-${draftLevel}`;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-4">
      <Button variant="outline" size="sm" onClick={onCancel}>
        Cancel level-up
      </Button>
      <p className="text-xs text-muted-foreground">
        Will set {classLabel} to Lv {draftLevel} · character to Lv {totalLevelAfterConfirm}
      </p>
      <Button
        variant="default"
        onClick={onConfirm}
        disabled={!canConfirm}
        aria-describedby={canConfirm ? undefined : reasonId}
        className="ml-auto"
      >
        Confirm level {draftLevel}
      </Button>
      {!canConfirm && (
        <span id={reasonId} className="sr-only">
          {missingReason}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "LevelUpActionBar"`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add components/builder/class-step-rail/level-up-action-bar.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "$(cat <<'EOF'
feat(builder): LevelUpActionBar atomic component

Cancel + summary + gated Confirm bar for the level-up flow.
Confirm is disabled when canConfirm is false, with an
aria-describedby pointing to a screen-reader-only span that
explains what's missing (so SR users get the gating context
without hover).

Summary text uses the "Will set X to Lv N · character to
Lv M" format from the design brief.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7 — `<LevelUpPane>` composite component

**Files:**
- Create: `components/builder/class-step-rail/level-up-pane.tsx`
- Test: append to `tests/components/builder/class-step-rail.test.tsx`

This composite reuses `<FeatureCard>`, `<ChoiceCardASI>`, `<ChoiceCardSubclass>`, `<ChoiceCardFightingStyle>`, `<ChoiceCardGeneric>` from PR-B. It composes them with `<HpPicker>`, the NEW LEVEL ribbon, and `<LevelUpActionBar>`.

The pane derives `canConfirm` from:
1. All required choices for that level have values in `localChoices`.
2. Either `isFirstLevelOfPrimary` is true (no HP picker) OR `hpRolls[key]` is set.

- [ ] **Step 1: Append failing tests.**

```tsx
import { LevelUpPane } from "@/components/builder/class-step-rail/level-up-pane";
import type { PerLevel } from "@/lib/builder/class-features-per-level";

describe("LevelUpPane", () => {
  function classEntryWithHitDie(slug: string, name: string, hitDie: number, levels: Array<{ level: number; features: string[] }>): ContentEntry {
    return {
      id: `c-${slug}`,
      slug,
      name,
      content_type: "class",
      data: { hit_die: hitDie, levels },
      effects: [],
      version: 1,
      source: "srd",
    };
  }

  function passiveLevelRow(level: number, featureSlug: string, featureName: string): PerLevel {
    return {
      level,
      features: [
        {
          id: `f-${featureSlug}`,
          slug: featureSlug,
          name: featureName,
          content_type: "feature",
          data: { level, class: "paladin" },
          effects: [],
          version: 1,
          source: "srd",
        },
      ],
      choices: [],
    };
  }

  function defaults(overrides: Partial<Parameters<typeof LevelUpPane>[0]> = {}) {
    return {
      classContent: classEntryWithHitDie("paladin", "Paladin", 10, [
        { level: 7, features: ["aura-improvement"] },
      ]),
      classIndex: 0,
      isPrimaryClass: true,
      draftLevel: 7,
      totalLevelAfterConfirm: 10,
      perLevelRow: passiveLevelRow(7, "aura-improvement", "Aura improvement"),
      subclasses: [] as ContentEntry[],
      styleOptions: [] as ContentEntry[],
      localChoices: {} as CharacterChoices,
      currentSubclass: undefined as string | undefined,
      classChoices: [] as Array<import("@/lib/types/effects").ChoiceEffect>,
      hpRule: "free_choice" as const,
      conMod: 2,
      hpRolls: {} as Record<string, import("@/lib/types/character").HpRollRecord>,
      onAsiSelect: vi.fn(),
      onSubclassSelect: vi.fn(),
      onFightingStyleSelect: vi.fn(),
      onChoiceSelect: vi.fn(),
      onHpRollChange: vi.fn(),
      onCancel: vi.fn(),
      onConfirm: vi.fn(),
      ...overrides,
    };
  }

  it("renders the breadcrumb with class name and draft level + NEW LEVEL ribbon", () => {
    render(<LevelUpPane {...defaults()} />);
    expect(screen.getByText("Paladin")).toBeInTheDocument();
    expect(screen.getByText("Level 7")).toBeInTheDocument();
    expect(screen.getByText(/NEW LEVEL/i)).toBeInTheDocument();
  });

  it("renders the heading and description from the level row", () => {
    render(<LevelUpPane {...defaults()} />);
    expect(screen.getByRole("heading", { level: 2, name: /Aura improvement/i })).toBeInTheDocument();
  });

  it("renders 'What this level grants' feature cards", () => {
    render(<LevelUpPane {...defaults()} />);
    // FeatureCard renders the feature.name; checking presence is enough.
    expect(screen.getAllByText("Aura improvement").length).toBeGreaterThanOrEqual(1);
  });

  it("renders 'Choices for this level' section ONLY when row has choices", () => {
    const { rerender } = render(<LevelUpPane {...defaults()} />);
    expect(screen.queryByText(/Choices for this level/i)).not.toBeInTheDocument();

    const rowWithChoice: PerLevel = {
      level: 3,
      features: [],
      choices: [
        { type: "subclass", classSlug: "paladin", label: "Sacred Oath", isMade: false },
      ],
    };
    rerender(<LevelUpPane {...defaults({ draftLevel: 3, perLevelRow: rowWithChoice })} />);
    expect(screen.getByText(/Choices for this level/i)).toBeInTheDocument();
  });

  it("renders the HP picker for non-Lv1-primary draft levels", () => {
    render(<LevelUpPane {...defaults()} />);
    expect(screen.getByRole("radio", { name: /Average/i })).toBeInTheDocument();
  });

  it("does NOT render the HP picker when draft is Lv1 of primary class", () => {
    // Edge case: this scenario should never occur via the in-rail "+ Level up" button
    // (the button only appears when level >= 1 already), but the prop-driven component
    // must handle it for forward-compat with future entry points.
    render(<LevelUpPane {...defaults({ draftLevel: 1, isPrimaryClass: true })} />);
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("Confirm is disabled when there is an unmade required choice", () => {
    const rowWithUnmadeChoice: PerLevel = {
      level: 3,
      features: [],
      choices: [
        { type: "subclass", classSlug: "paladin", label: "Sacred Oath", isMade: false },
      ],
    };
    render(<LevelUpPane {...defaults({ draftLevel: 3, perLevelRow: rowWithUnmadeChoice })} />);
    expect(screen.getByRole("button", { name: /Confirm level 3/i })).toBeDisabled();
  });

  it("Confirm is disabled when HP is unset (free_choice, non-Lv1-primary)", () => {
    render(<LevelUpPane {...defaults()} />);
    expect(screen.getByRole("button", { name: /Confirm level 7/i })).toBeDisabled();
  });

  it("Confirm is enabled when all choices made + HP set", () => {
    const hpRolls = { "paladin-7": { method: "average" as const, value: 6 } };
    render(<LevelUpPane {...defaults({ hpRolls })} />);
    expect(screen.getByRole("button", { name: /Confirm level 7/i })).toBeEnabled();
  });

  it("clicking Cancel calls onCancel", () => {
    const onCancel = vi.fn();
    render(<LevelUpPane {...defaults({ onCancel })} />);
    fireEvent.click(screen.getByRole("button", { name: /Cancel level-up/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("clicking HP picker Average fires onHpRollChange", () => {
    const onHpRollChange = vi.fn();
    render(<LevelUpPane {...defaults({ onHpRollChange })} />);
    fireEvent.click(screen.getByRole("radio", { name: /Average/i }));
    expect(onHpRollChange).toHaveBeenCalledWith("paladin-7", { method: "average", value: 6 });
  });
});
```

- [ ] **Step 2: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "LevelUpPane"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement.**

```tsx
"use client";

import { ClassEmblem } from "@/components/builder/class-emblem";
import { ChevronRight } from "lucide-react";
import { FeatureCard } from "@/components/builder/class-step-rail/feature-card";
import { ChoiceCardSubclass } from "@/components/builder/class-step-rail/choice-card-subclass";
import { ChoiceCardASI } from "@/components/builder/class-step-rail/choice-card-asi";
import { ChoiceCardFightingStyle } from "@/components/builder/class-step-rail/choice-card-fighting-style";
import { ChoiceCardGeneric } from "@/components/builder/class-step-rail/choice-card-generic";
import { HpPicker } from "@/components/builder/class-step-rail/hp-picker";
import { LevelUpActionBar } from "@/components/builder/class-step-rail/level-up-action-bar";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { CharacterChoices, AsiChoice, HpRollRecord } from "@/lib/types/character";
import type { PerLevel } from "@/lib/builder/class-features-per-level";
import type { ChoiceEffect } from "@/lib/types/effects";
import type { HpRule } from "@/lib/builder/level-up-rules";

interface LevelUpPaneProps {
  classContent: ContentEntry;
  classIndex: number;
  isPrimaryClass: boolean;
  draftLevel: number;
  totalLevelAfterConfirm: number;
  perLevelRow: PerLevel;
  subclasses: ContentEntry[];
  styleOptions: ContentEntry[];
  localChoices: CharacterChoices;
  currentSubclass: string | undefined;
  classChoices: ChoiceEffect[];
  hpRule: HpRule;
  conMod: number;
  hpRolls: Record<string, HpRollRecord>;
  onAsiSelect: (featureSlug: string, choice: AsiChoice) => Promise<void> | void;
  onSubclassSelect: (classSlug: string, classIndex: number, subclassSlug: string | undefined) => Promise<void> | void;
  onFightingStyleSelect: (featureSlug: string, classSlug: string, styleSlug: string | undefined) => Promise<void> | void;
  onChoiceSelect: (choiceId: string, selections: string[]) => Promise<void> | void;
  onHpRollChange: (key: string, record: HpRollRecord) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

function getFeatureDescription(features: ContentEntry[]): string | null {
  for (const f of features) {
    const desc = (f.data as Record<string, unknown>).description;
    if (typeof desc === "string" && desc.length > 0) return desc;
  }
  return null;
}

export function LevelUpPane(props: LevelUpPaneProps) {
  const {
    classContent,
    classIndex,
    isPrimaryClass,
    draftLevel,
    totalLevelAfterConfirm,
    perLevelRow,
    subclasses,
    styleOptions,
    localChoices,
    currentSubclass,
    classChoices,
    hpRule,
    conMod,
    hpRolls,
    onAsiSelect,
    onSubclassSelect,
    onFightingStyleSelect,
    onChoiceSelect,
    onHpRollChange,
    onCancel,
    onConfirm,
  } = props;

  const hitDie = (classContent.data as Record<string, unknown>).hit_die as number | undefined ?? 8;
  const isFirstLevelOfPrimary = isPrimaryClass && draftLevel === 1;
  const hpKey = `${classContent.slug}-${draftLevel}`;
  const storedRoll = hpRolls[hpKey];

  const headingText = perLevelRow.features[0]?.name ?? `Level ${draftLevel}`;
  const description = getFeatureDescription(perLevelRow.features);

  const allChoicesMade = perLevelRow.choices.every((c) => c.isMade);
  const hpSet = isFirstLevelOfPrimary || storedRoll != null;
  const canConfirm = allChoicesMade && hpSet;

  const missingReasons: string[] = [];
  if (!allChoicesMade) {
    const unmadeLabels = perLevelRow.choices.filter((c) => !c.isMade).map((c) => c.label);
    missingReasons.push(`Pick: ${unmadeLabels.join(", ")}`);
  }
  if (!hpSet) missingReasons.push("Set HP for this level");
  const missingReason = missingReasons.join(" · ");

  return (
    <section aria-labelledby="level-up-heading" className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ClassEmblem slug={classContent.slug} name={classContent.name} size="sm" />
        <span>{classContent.name}</span>
        <ChevronRight className="size-3" aria-hidden="true" />
        <span>Level {draftLevel}</span>
        <span
          role="status"
          aria-label="Pending new level"
          className="ml-2 rounded-sm border border-[rgba(201,164,74,0.4)] bg-[rgba(201,164,74,0.15)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#c9a44a] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        >
          NEW LEVEL
        </span>
      </div>

      <h2 id="level-up-heading" className="text-2xl font-semibold leading-tight">
        {headingText}
      </h2>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}

      {perLevelRow.features.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            What this level grants
          </p>
          <div className="mt-2 space-y-2">
            {perLevelRow.features.map((f) => (
              <FeatureCard key={f.slug} feature={f} />
            ))}
          </div>
        </div>
      )}

      {perLevelRow.choices.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Choices for this level
          </p>
          <div className="mt-2 space-y-2">
            {perLevelRow.choices.map((choice) => {
              if (choice.type === "subclass") {
                return (
                  <ChoiceCardSubclass
                    key={`${choice.classSlug}-subclass`}
                    classSlug={choice.classSlug}
                    subclasses={subclasses}
                    currentSelection={currentSubclass}
                    onSelect={(slug) => onSubclassSelect(choice.classSlug, classIndex, slug)}
                    label={choice.label}
                  />
                );
              }
              if (choice.type === "asi" && choice.featureSlug) {
                return (
                  <ChoiceCardASI
                    key={choice.featureSlug}
                    featureSlug={choice.featureSlug}
                    currentChoice={localChoices.asi_choices?.[choice.featureSlug]}
                    onSelect={(c) => onAsiSelect(choice.featureSlug!, c)}
                  />
                );
              }
              if (choice.type === "fighting-style" && choice.featureSlug) {
                return (
                  <ChoiceCardFightingStyle
                    key={choice.featureSlug}
                    featureSlug={choice.featureSlug}
                    classSlug={choice.classSlug}
                    styleOptions={styleOptions}
                    currentSelection={localChoices.resolved_choices?.[choice.featureSlug]?.[0]}
                    onSelect={(slug) => onFightingStyleSelect(choice.featureSlug!, choice.classSlug, slug)}
                  />
                );
              }
              if (choice.type === "generic") {
                const choiceEffect = classChoices.find((e) => e.id === choice.featureSlug);
                if (!choiceEffect) return null;
                return (
                  <ChoiceCardGeneric
                    key={choice.featureSlug}
                    choiceEffect={choiceEffect}
                    currentSelections={localChoices.resolved_choices?.[choiceEffect.id] ?? []}
                    onSelect={(selections) => onChoiceSelect(choiceEffect.id, selections)}
                  />
                );
              }
              return null;
            })}
          </div>
        </div>
      )}

      <HpPicker
        classSlug={classContent.slug}
        level={draftLevel}
        hitDie={hitDie}
        conMod={conMod}
        isFirstLevelOfPrimary={isFirstLevelOfPrimary}
        hpRule={hpRule}
        storedRoll={storedRoll}
        onChange={(record) => onHpRollChange(hpKey, record)}
      />

      <LevelUpActionBar
        classLabel={classContent.name}
        draftLevel={draftLevel}
        totalLevelAfterConfirm={totalLevelAfterConfirm}
        canConfirm={canConfirm}
        missingReason={missingReason}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </section>
  );
}
```

- [ ] **Step 4: Run the new tests.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "LevelUpPane"`
Expected: PASS.

- [ ] **Step 5: Run the full test file to confirm no regressions.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx`
Expected: PASS.

- [ ] **Step 6: Type-check.**

Run: `npx tsc --noEmit 2>&1 | grep -i "level-up-pane" | head`
Expected: no errors.

- [ ] **Step 7: Commit.**

```bash
git add components/builder/class-step-rail/level-up-pane.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "$(cat <<'EOF'
feat(builder): LevelUpPane composite component

Main-pane content for the level-up flow: breadcrumb +
NEW LEVEL ribbon + heading + feature cards + (conditional)
choice cards + HP picker + action bar. Reuses every choice
card from PR-B verbatim — same instances, same handlers,
same localChoices shape.

Computes canConfirm from (a) all required choices made and
(b) HP set OR isFirstLevelOfPrimary (no picker). Builds a
human-readable missingReason for the screen-reader-only
gating hint on Confirm.

The NEW LEVEL ribbon has role="status" so it announces
politely on flow open.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8 — `<ClassLevelPane>` updates (HpPicker retrofit + empty-state polish)

**Files:**
- Modify: `components/builder/class-step-rail/class-level-pane.tsx`
- Test: append to `tests/components/builder/class-step-rail.test.tsx`

This task adds two things:

1. The `<HpPicker>` retrofit: surface the picker for non-Lv1-primary levels in the regular level pane (so users can edit HP retroactively per Q9).
2. The empty-state polish: when a level has no features and no choices (e.g. Voltee at Wizard Lv 3 — only spell-slot upgrades), show a friendly message instead of "No class data for the selected level."

- [ ] **Step 1: Read the existing `class-level-pane.tsx`.**

Note the current props shape and the JSX that decides what to render. We'll be adding new props for HP plus a graceful empty-state branch.

- [ ] **Step 2: Append failing tests to `tests/components/builder/class-step-rail.test.tsx`.**

```tsx
describe("ClassLevelPane — HP picker retrofit", () => {
  function defaults(overrides: Partial<Parameters<typeof ClassLevelPane>[0]> = {}) {
    return {
      classSlug: "paladin",
      className_: "Paladin",
      classIndex: 0,
      isPrimaryClass: true,
      row: { level: 3, features: [], choices: [] } as PerLevel,
      subclasses: [] as ContentEntry[],
      styleOptions: [] as ContentEntry[],
      localChoices: {} as CharacterChoices,
      currentSubclass: undefined as string | undefined,
      classChoices: [] as Array<import("@/lib/types/effects").ChoiceEffect>,
      hitDie: 10,
      hpRule: "free_choice" as const,
      conMod: 2,
      hpRolls: {} as Record<string, import("@/lib/types/character").HpRollRecord>,
      onAsiSelect: vi.fn(),
      onSubclassSelect: vi.fn(),
      onFightingStyleSelect: vi.fn(),
      onChoiceSelect: vi.fn(),
      onHpRollChange: vi.fn(),
      ...overrides,
    };
  }

  it("renders the HP picker for non-Lv1-primary levels", () => {
    render(<ClassLevelPane {...defaults({ row: { level: 5, features: [], choices: [] } })} />);
    expect(screen.getByRole("radio", { name: /Average/i })).toBeInTheDocument();
  });

  it("does NOT render the HP picker for Lv1 of primary class", () => {
    render(<ClassLevelPane {...defaults({ row: { level: 1, features: [], choices: [] }, isPrimaryClass: true })} />);
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("renders HP picker for Lv1 of non-primary class (multiclass first level)", () => {
    render(<ClassLevelPane {...defaults({ row: { level: 1, features: [], choices: [] }, isPrimaryClass: false })} />);
    expect(screen.getByRole("radio", { name: /Average/i })).toBeInTheDocument();
  });

  it("clicking the HP picker fires onHpRollChange with the right key", () => {
    const onHpRollChange = vi.fn();
    render(<ClassLevelPane {...defaults({ row: { level: 5, features: [], choices: [] }, onHpRollChange })} />);
    fireEvent.click(screen.getByRole("radio", { name: /Average/i }));
    expect(onHpRollChange).toHaveBeenCalledWith("paladin-5", { method: "average", value: 6 });
  });
});

describe("ClassLevelPane — empty-state polish", () => {
  it("shows a friendly empty-state when row has no features and no choices", () => {
    render(
      <ClassLevelPane
        classSlug="wizard"
        className_="Wizard"
        classIndex={0}
        isPrimaryClass={true}
        row={{ level: 3, features: [], choices: [] }}
        subclasses={[]}
        styleOptions={[]}
        localChoices={{} as CharacterChoices}
        currentSubclass={undefined}
        classChoices={[]}
        hitDie={6}
        hpRule="free_choice"
        conMod={1}
        hpRolls={{}}
        onAsiSelect={vi.fn()}
        onSubclassSelect={vi.fn()}
        onFightingStyleSelect={vi.fn()}
        onChoiceSelect={vi.fn()}
        onHpRollChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/No new features at this level/i)).toBeInTheDocument();
    // Empty-state should NOT show the legacy "No class data" message.
    expect(screen.queryByText(/No class data for the selected level/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "ClassLevelPane"`
Expected: FAIL — props mismatch + missing empty-state behavior.

- [ ] **Step 4: Update `class-level-pane.tsx`.**

Read the existing file first, then apply changes:
- Add new props: `isPrimaryClass`, `hitDie`, `hpRule`, `conMod`, `hpRolls`, `onHpRollChange`.
- Add `<HpPicker>` rendering at the bottom of the existing render branch (after the choice cards), gated on row being defined.
- Add the empty-state branch: when `row.features.length === 0 && row.choices.length === 0`, show a friendly message.

The exact replacement depends on the existing file structure. The pattern is:

1. Find the existing function signature and add the new props.
2. Replace the existing `<p className="text-sm text-muted-foreground">No class data for the selected level.</p>` (or whatever the current empty-state text is — verify by reading the file) with a check on whether the row is *missing* (truly no data) vs. *empty* (level exists but has no content). Missing → keep "No class data" but with a less stark message. Empty → "No new features at this level. {className}'s level {N} grants spell-slot upgrades only — no decisions to make here."
3. Render `<HpPicker>` after the existing content tree, gated on `row != null`.

If the file uses an early-return pattern for "no row", restructure into a single render path:

```tsx
"use client";

import { Separator } from "@/components/ui/separator";
import { HpPicker } from "@/components/builder/class-step-rail/hp-picker";
import { FeatureCard } from "@/components/builder/class-step-rail/feature-card";
import { ChoiceCardSubclass } from "@/components/builder/class-step-rail/choice-card-subclass";
import { ChoiceCardASI } from "@/components/builder/class-step-rail/choice-card-asi";
import { ChoiceCardFightingStyle } from "@/components/builder/class-step-rail/choice-card-fighting-style";
import { ChoiceCardGeneric } from "@/components/builder/class-step-rail/choice-card-generic";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { CharacterChoices, AsiChoice, HpRollRecord } from "@/lib/types/character";
import type { PerLevel } from "@/lib/builder/class-features-per-level";
import type { ChoiceEffect } from "@/lib/types/effects";
import type { HpRule } from "@/lib/builder/level-up-rules";

interface ClassLevelPaneProps {
  classSlug: string;
  className_: string;
  classIndex: number;
  isPrimaryClass: boolean;
  /** May be undefined if the level has no row in the per-level helper output. */
  row: PerLevel | undefined;
  subclasses: ContentEntry[];
  styleOptions: ContentEntry[];
  localChoices: CharacterChoices;
  currentSubclass: string | undefined;
  classChoices: ChoiceEffect[];
  hitDie: number;
  hpRule: HpRule;
  conMod: number;
  hpRolls: Record<string, HpRollRecord>;
  onAsiSelect: (featureSlug: string, choice: AsiChoice) => Promise<void> | void;
  onSubclassSelect: (classSlug: string, classIndex: number, subclassSlug: string | undefined) => Promise<void> | void;
  onFightingStyleSelect: (featureSlug: string, classSlug: string, styleSlug: string | undefined) => Promise<void> | void;
  onChoiceSelect: (choiceId: string, selections: string[]) => Promise<void> | void;
  onHpRollChange: (key: string, record: HpRollRecord) => void;
}

export function ClassLevelPane(props: ClassLevelPaneProps) {
  const {
    classSlug, className_, classIndex, isPrimaryClass, row,
    subclasses, styleOptions, localChoices, currentSubclass, classChoices,
    hitDie, hpRule, conMod, hpRolls,
    onAsiSelect, onSubclassSelect, onFightingStyleSelect, onChoiceSelect, onHpRollChange,
  } = props;

  if (!row) {
    return (
      <p className="text-sm text-muted-foreground">
        No class data for the selected level.
      </p>
    );
  }

  const isEmpty = row.features.length === 0 && row.choices.length === 0;
  const isFirstLevelOfPrimary = isPrimaryClass && row.level === 1;
  const hpKey = `${classSlug}-${row.level}`;
  const storedRoll = hpRolls[hpKey];

  const headingText = row.features[0]?.name ?? row.choices[0]?.label ?? `Level ${row.level}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{className_}</span>
        <span aria-hidden="true">›</span>
        <span>Level {row.level}</span>
      </div>
      <h2 className="text-2xl font-semibold leading-tight">{headingText}</h2>

      {isEmpty ? (
        <p className="text-sm text-muted-foreground">
          No new features at this level. {className_}&apos;s level {row.level} grants spell-slot or proficiency upgrades only.
        </p>
      ) : (
        <>
          {row.features.length > 0 && (
            <div className="space-y-2">
              {row.features.map((f) => (
                <FeatureCard key={f.slug} feature={f} />
              ))}
            </div>
          )}
          {row.choices.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                {row.choices.map((choice) => {
                  if (choice.type === "subclass") {
                    return (
                      <ChoiceCardSubclass
                        key={`${choice.classSlug}-subclass`}
                        classSlug={choice.classSlug}
                        subclasses={subclasses}
                        currentSelection={currentSubclass}
                        onSelect={(slug) => onSubclassSelect(choice.classSlug, classIndex, slug)}
                        label={choice.label}
                      />
                    );
                  }
                  if (choice.type === "asi" && choice.featureSlug) {
                    return (
                      <ChoiceCardASI
                        key={choice.featureSlug}
                        featureSlug={choice.featureSlug}
                        currentChoice={localChoices.asi_choices?.[choice.featureSlug]}
                        onSelect={(c) => onAsiSelect(choice.featureSlug!, c)}
                      />
                    );
                  }
                  if (choice.type === "fighting-style" && choice.featureSlug) {
                    return (
                      <ChoiceCardFightingStyle
                        key={choice.featureSlug}
                        featureSlug={choice.featureSlug}
                        classSlug={choice.classSlug}
                        styleOptions={styleOptions}
                        currentSelection={localChoices.resolved_choices?.[choice.featureSlug]?.[0]}
                        onSelect={(slug) => onFightingStyleSelect(choice.featureSlug!, choice.classSlug, slug)}
                      />
                    );
                  }
                  if (choice.type === "generic") {
                    const choiceEffect = classChoices.find((e) => e.id === choice.featureSlug);
                    if (!choiceEffect) return null;
                    return (
                      <ChoiceCardGeneric
                        key={choice.featureSlug}
                        choiceEffect={choiceEffect}
                        currentSelections={localChoices.resolved_choices?.[choiceEffect.id] ?? []}
                        onSelect={(selections) => onChoiceSelect(choiceEffect.id, selections)}
                      />
                    );
                  }
                  return null;
                })}
              </div>
            </>
          )}
        </>
      )}

      <HpPicker
        classSlug={classSlug}
        level={row.level}
        hitDie={hitDie}
        conMod={conMod}
        isFirstLevelOfPrimary={isFirstLevelOfPrimary}
        hpRule={hpRule}
        storedRoll={storedRoll}
        onChange={(record) => onHpRollChange(hpKey, record)}
      />
    </div>
  );
}
```

If the existing file's structure differs significantly from this template (e.g. it doesn't have a header section, or uses different class/element names), preserve the existing surrounding structure and only change:
- Add the new props.
- Replace the empty-state branch.
- Add the `<HpPicker>` at the bottom.

The behavior is the goal; the exact JSX layout can stay close to the original.

- [ ] **Step 5: Run the new tests.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "ClassLevelPane"`
Expected: PASS.

- [ ] **Step 6: Run the full file.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx`
Expected: PASS — but existing `ClassStepRail` integration tests may FAIL if they don't pass the new required props. That's fine and expected; Task 10 wires those defaults.

If a large number of existing tests fail because of the new props, add `hitDie: 8, hpRule: "free_choice", conMod: 0, hpRolls: {}, onHpRollChange: vi.fn(), isPrimaryClass: true` to the existing `setupRail()` and `setup()` helpers. That's part of Task 10's helper extension; landing it here is optional but acceptable.

- [ ] **Step 7: Commit.**

```bash
git add components/builder/class-step-rail/class-level-pane.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "$(cat <<'EOF'
feat(builder): ClassLevelPane HP picker retrofit + empty-state polish

Surfaces the HpPicker for non-Lv1-primary levels (Q9 lazy
retrofit so users can edit HP retroactively without forcing
a level-up flow).

Adds a friendly empty-state when a level has no features and
no choices (e.g. Voltee Wizard Lv 3 — spell-slot upgrades
only). Replaces the bleak "No class data for the selected
level." message that appeared in PR-B for these cases.

The original "No class data" message stays for the truly
no-row case (row prop is undefined).

Carryover from PR-B reviewer notes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9 — `<LevelRail>` + `<AddClassRow>` extensions

**Files:**
- Modify: `components/builder/class-step-rail/level-rail.tsx`
- Modify: `components/builder/class-step-rail/add-class-row.tsx`
- Test: append to `tests/components/builder/class-step-rail.test.tsx`

These two updates together complete the rail-tile changes the integration task (Task 10) needs.

- [ ] **Step 1: Append failing tests.**

```tsx
describe("LevelRail — disabled mid-flow + LevelUpButton", () => {
  function defaults(overrides: Partial<Parameters<typeof LevelRail>[0]> = {}) {
    return {
      classSlug: "paladin",
      className_: "Paladin",
      subclassName: undefined,
      currentLevel: 6,
      perLevel: makePerLevel(),
      activeLevel: 6,
      onSelectLevel: vi.fn(),
      onLevelChange: vi.fn(),
      onRemoveClass: vi.fn(),
      onLevelUpClick: vi.fn(),
      levelUpButtonState: "idle" as const,
      levelUpButtonReason: undefined,
      disabled: false,
      ...overrides,
    };
  }

  it("renders a LevelUpButton tile beneath the level pills (idle state)", () => {
    render(<LevelRail {...defaults()} />);
    expect(screen.getByRole("button", { name: /Level up Paladin/i })).toBeInTheDocument();
  });

  it("clicking the idle LevelUpButton fires onLevelUpClick", () => {
    const onLevelUpClick = vi.fn();
    render(<LevelRail {...defaults({ onLevelUpClick })} />);
    fireEvent.click(screen.getByRole("button", { name: /Level up Paladin/i }));
    expect(onLevelUpClick).toHaveBeenCalledTimes(1);
  });

  it("disables level dropdown + Remove button when disabled prop is true", () => {
    render(<LevelRail {...defaults({ disabled: true })} />);
    expect(screen.getByLabelText("Set level for Paladin")).toBeDisabled();
    expect(screen.getByRole("button", { name: /Remove Paladin/i })).toBeDisabled();
  });

  it("renders LevelUpButton in active-flow state when levelUpButtonState='active-flow'", () => {
    render(<LevelRail {...defaults({ levelUpButtonState: "active-flow" })} />);
    expect(screen.getByText(/In progress/i)).toBeInTheDocument();
  });

  it("renders LevelUpButton in disabled state with the provided reason", () => {
    render(<LevelRail {...defaults({ levelUpButtonState: "disabled", levelUpButtonReason: "Finish Pal 7 first" })} />);
    expect(screen.getByText(/Finish Pal 7 first/i)).toBeInTheDocument();
  });
});

describe("AddClassRow — disabledReason override", () => {
  it("renders the provided disabledReason instead of the default reasons list", () => {
    render(<AddClassRow reasons={["Requires CHA 13 for Bard"]} disabledReason="Finish active level-up first" />);
    expect(screen.getByText(/Finish active level-up first/i)).toBeInTheDocument();
    expect(screen.queryByText(/Requires CHA 13 for Bard/i)).not.toBeInTheDocument();
  });

  it("falls back to reasons list when disabledReason is undefined (locked variant)", () => {
    render(<AddClassRow reasons={["Requires CHA 13 for Bard"]} />);
    expect(screen.getByText(/Requires CHA 13 for Bard/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "LevelRail — disabled\\|AddClassRow — disabledReason"`
Expected: FAIL — props mismatch.

- [ ] **Step 3: Update `level-rail.tsx`.**

Read the existing file. Add the new props (`disabled`, `onLevelUpClick`, `levelUpButtonState`, `levelUpButtonReason`) to the props interface. Pass `disabled` to the level dropdown and Remove button. Render `<LevelUpButton>` at the bottom of the tile.

Pseudocode (adapt to the file's actual structure):

```tsx
import { LevelUpButton } from "@/components/builder/class-step-rail/level-up-button";

interface LevelRailProps {
  // existing props...
  /** Disables level dropdown + Remove button (used during a level-up flow on another class). */
  disabled?: boolean;
  onLevelUpClick: () => void;
  levelUpButtonState: "idle" | "disabled" | "active-flow";
  /** Reason text for the disabled state (ignored for idle/active-flow). */
  levelUpButtonReason?: string;
}

// Inside the component:
//   <select ... disabled={disabled || existingDisabledLogic} ... />
//   <button onClick={onRemoveClass} disabled={disabled} ...>Remove Paladin</button>
//
// At the end of the rendered tile:
//   <LevelUpButton
//     state={levelUpButtonState}
//     classSlug={classSlug}
//     classLabel={className_}
//     atLevel={currentLevel}
//     reason={levelUpButtonReason}
//     onClick={onLevelUpClick}
//   />
```

Apply these changes carefully, preserving the existing tile structure. Do not change PR-B level-pill rendering or the dropdown's other behavior.

- [ ] **Step 4: Update `add-class-row.tsx`.**

Add `disabledReason?: string` to the locked variant of the discriminated union. When present, render that text instead of the joined reasons list.

```tsx
type AddClassRowProps =
  | {
      unlocked?: false;
      reasons: string[];
      onClick?: () => void;
      levelsRemaining?: never;
      /** Override for the reasons list. When present, renders instead of joined reasons. */
      disabledReason?: string;
    }
  | {
      unlocked: true;
      levelsRemaining: number;
      onClick: () => void;
      reasons?: never;
      disabledReason?: never;
    };

// Inside the locked branch:
//   const reasonText = disabledReason ?? reasons.slice(0, 3).join(" · ");
//   {reasonText && <p ...>{reasonText}</p>}
```

- [ ] **Step 5: Run the new tests.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "LevelRail — disabled\\|AddClassRow — disabledReason"`
Expected: PASS.

- [ ] **Step 6: Run the full file.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx`
Expected: PASS — though some existing `ClassStepRail` integration tests may FAIL if they pass `onLevelUpClick` etc. as undefined. Task 10's helper update fixes that. Don't fix these here.

- [ ] **Step 7: Commit.**

```bash
git add components/builder/class-step-rail/level-rail.tsx components/builder/class-step-rail/add-class-row.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "$(cat <<'EOF'
feat(builder): LevelRail + AddClassRow extensions for level-up flow

LevelRail accepts a `disabled` prop (mid-flow lock for other
classes) that disables the level dropdown and Remove button,
plus `onLevelUpClick` + `levelUpButtonState` + `levelUpButtonReason`
to render the new LevelUpButton tile. AddClassRow accepts an
optional `disabledReason` to override the prereq-list text
during an active level-up flow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10 — `<ClassStepRail>` integration

**Files:**
- Modify: `components/builder/class-step-rail/index.tsx`
- Test: append/extend `tests/components/builder/class-step-rail.test.tsx`

This is the big rail-level integration. It introduces `levelUpDraft` state, the hard-lock propagation, the pane swap, and mutual exclusion with PR-C's `showPicker`. It also drops the dead `contentRefs` prop (PR-C reviewer carryover).

- [ ] **Step 1: Update the existing `setup()` and `setupRail()` helpers + the PR-C `setupForPicker()` helper to add the new required props as defaults.**

In each helper's `props` literal, add:

```tsx
hpRule: "free_choice" as const,
hpRolls: {} as Record<string, import("@/lib/types/character").HpRollRecord>,
onConfirmLevelUp: vi.fn(),
onCancelLevelUp: vi.fn(),
onHpRollChange: vi.fn(),
```

In the `handlers` object that gets returned, add:

```tsx
onConfirmLevelUp: vi.fn(),
onCancelLevelUp: vi.fn(),
onHpRollChange: vi.fn(),
onAddClass: vi.fn(),  // PR-C carryover — was missing from setupRail()'s handlers
```

This is also where the PR-C `setupRail()` carryover lands (exposing `onAddClass` in `handlers`).

- [ ] **Step 2: Append failing integration tests.**

```tsx
describe("ClassStepRail — level-up flow", () => {
  function setupForLevelUp(overrides: Partial<Parameters<typeof ClassStepRail>[0]> = {}) {
    const handlers = {
      onLevelChange: vi.fn(),
      onRemoveClass: vi.fn(),
      onSubclassSelect: vi.fn(),
      onAsiSelect: vi.fn(),
      onFightingStyleSelect: vi.fn(),
      onChoiceSelect: vi.fn(),
      onAddClass: vi.fn(),
      onConfirmLevelUp: vi.fn(),
      onCancelLevelUp: vi.fn(),
      onHpRollChange: vi.fn(),
    };
    const allClasses = ["paladin", "wizard", "fighter"].map((slug) =>
      classEntry(slug, slug.charAt(0).toUpperCase() + slug.slice(1), [
        { level: 1, features: [] },
        { level: 2, features: [] },
        { level: 3, features: [] },
        { level: 4, features: [] },
        { level: 5, features: [] },
        { level: 6, features: [] },
        { level: 7, features: ["aura-improvement"] },
      ]),
    );
    const props = {
      classes: allClasses,
      subclasses: [],
      features: [
        { id: "f-aura-imp", slug: "aura-improvement", name: "Aura improvement", content_type: "feature", data: { level: 7, class: "paladin", description: "Your aura range increases." }, effects: [], version: 1, source: "srd" } as ContentEntry,
      ],
      selectedClasses: [
        { slug: "paladin", level: 6 },
        { slug: "wizard", level: 3 },
      ],
      localChoices: {} as CharacterChoices,
      resolvedStats: {
        strength: 14, dexterity: 12, constitution: 14,
        intelligence: 13, wisdom: 10, charisma: 14,
      },
      hpRule: "free_choice" as const,
      hpRolls: {} as Record<string, import("@/lib/types/character").HpRollRecord>,
      ...handlers,
      ...overrides,
    };
    const utils = render(<ClassStepRail {...props} />);
    return { ...utils, ...handlers, props };
  }

  it("renders a LevelUpButton tile per class section in idle state by default", () => {
    setupForLevelUp();
    expect(screen.getByRole("button", { name: /Level up Paladin/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Level up Wizard/i })).toBeInTheDocument();
  });

  it("clicking idle LevelUpButton opens the LevelUpPane in main pane", () => {
    setupForLevelUp();
    fireEvent.click(screen.getByRole("button", { name: /Level up Paladin to level 7/i }));
    expect(screen.getByRole("heading", { level: 2, name: /Aura improvement/i })).toBeInTheDocument();
    expect(screen.getByText(/NEW LEVEL/i)).toBeInTheDocument();
  });

  it("opening flow disables ALL other rail mutators (hard lock)", () => {
    setupForLevelUp();
    fireEvent.click(screen.getByRole("button", { name: /Level up Paladin to level 7/i }));
    // Other class's LevelUpButton: disabled with "Finish Paladin 7 first"
    const wizardBtn = screen.getByRole("button", { name: /Level up Wizard/i });
    expect(wizardBtn).toHaveAttribute("aria-disabled", "true");
    expect(screen.getAllByText(/Finish Paladin 7 first/i).length).toBeGreaterThan(0);
    // All level dropdowns: disabled
    expect(screen.getByLabelText("Set level for Paladin")).toBeDisabled();
    expect(screen.getByLabelText("Set level for Wizard")).toBeDisabled();
    // All Remove buttons: disabled
    expect(screen.getByRole("button", { name: /Remove Paladin/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Remove Wizard/i })).toBeDisabled();
  });

  it("AddClassRow shows 'Finish active level-up first' during flow", () => {
    setupForLevelUp({
      // Need stats that meet at least one prereq so AddClassRow would normally be unlocked.
      resolvedStats: { strength: 14, dexterity: 14, constitution: 14, intelligence: 14, wisdom: 14, charisma: 14 },
    });
    fireEvent.click(screen.getByRole("button", { name: /Level up Paladin to level 7/i }));
    expect(screen.getByText(/Finish active level-up first/i)).toBeInTheDocument();
  });

  it("clicking 'Cancel level-up' returns to ClassLevelPane and re-enables the rail", () => {
    setupForLevelUp();
    fireEvent.click(screen.getByRole("button", { name: /Level up Paladin to level 7/i }));
    expect(screen.getByText(/NEW LEVEL/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Cancel level-up/i }));
    expect(screen.queryByText(/NEW LEVEL/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Set level for Paladin")).not.toBeDisabled();
  });

  it("clicking Confirm fires onConfirmLevelUp with the right payload", () => {
    const { onConfirmLevelUp, onHpRollChange } = setupForLevelUp();
    fireEvent.click(screen.getByRole("button", { name: /Level up Paladin to level 7/i }));
    // Pick HP first (no choices at Paladin Lv 7 — passive level)
    fireEvent.click(screen.getByRole("radio", { name: /Average/i }));
    expect(onHpRollChange).toHaveBeenCalledWith("paladin-7", { method: "average", value: 6 });
    // Now Confirm should be enabled
    const confirmBtn = screen.getByRole("button", { name: /Confirm level 7/i });
    expect(confirmBtn).toBeEnabled();
    fireEvent.click(confirmBtn);
    expect(onConfirmLevelUp).toHaveBeenCalledWith({ classIndex: 0, draftLevel: 7 });
  });

  it("opening flow closes the multiclass picker if it was open", () => {
    setupForLevelUp({
      resolvedStats: { strength: 14, dexterity: 14, constitution: 14, intelligence: 14, wisdom: 14, charisma: 14 },
    });
    // Open picker first
    fireEvent.click(screen.getByRole("button", { name: /Add a class/i }));
    expect(screen.getByRole("heading", { level: 2, name: /Add a class/i })).toBeInTheDocument();
    // Now open level-up flow
    fireEvent.click(screen.getByRole("button", { name: /Level up Paladin to level 7/i }));
    // Picker should be closed
    expect(screen.queryByRole("heading", { level: 2, name: /Add a class/i })).not.toBeInTheDocument();
    // Level-up pane should be open
    expect(screen.getByText(/NEW LEVEL/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "level-up flow"`
Expected: FAIL — rail doesn't yet handle `levelUpDraft`.

- [ ] **Step 4: Update `index.tsx`.**

Replace the entire contents (this is a big change — read the existing file first to preserve PR-C's `showPicker` logic):

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { LevelRail } from "@/components/builder/class-step-rail/level-rail";
import { ClassLevelPane } from "@/components/builder/class-step-rail/class-level-pane";
import { LevelUpPane } from "@/components/builder/class-step-rail/level-up-pane";
import { AddClassRow } from "@/components/builder/class-step-rail/add-class-row";
import { ClassPickerPanel } from "@/components/builder/class-step-rail/class-picker-panel";
import { Separator } from "@/components/ui/separator";
import { classFeaturesPerLevel } from "@/lib/builder/class-features-per-level";
import { multiclassPrereqsForAll } from "@/lib/builder/multiclass-prereqs";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { CharacterChoices, AsiChoice, HpRollRecord } from "@/lib/types/character";
import type { HpRule } from "@/lib/builder/level-up-rules";

export interface ClassStepRailProps {
  classes: ContentEntry[];
  subclasses: ContentEntry[];
  features: ContentEntry[];
  selectedClasses: Array<{
    slug: string;
    level: number;
    subclass?: string;
  }>;
  localChoices: CharacterChoices;
  resolvedStats: Record<string, number>;
  hpRule: HpRule;
  hpRolls: Record<string, HpRollRecord>;
  onLevelChange: (classIndex: number, newLevel: number) => Promise<void> | void;
  onRemoveClass: (classIndex: number) => Promise<void> | void;
  onSubclassSelect: (classSlug: string, classIndex: number, subclassSlug: string | undefined) => Promise<void> | void;
  onAsiSelect: (featureSlug: string, choice: AsiChoice) => Promise<void> | void;
  onFightingStyleSelect: (featureSlug: string, classSlug: string, styleSlug: string | undefined) => Promise<void> | void;
  onChoiceSelect: (choiceId: string, selections: string[]) => Promise<void> | void;
  onAddClass: (content: ContentEntry) => void;
  onConfirmLevelUp: (payload: { classIndex: number; draftLevel: number }) => void;
  onCancelLevelUp: () => void;
  onHpRollChange: (key: string, record: HpRollRecord) => void;
}

interface SelectedKey {
  classIndex: number;
  level: number;
}

interface LevelUpDraft {
  classIndex: number;
  draftLevel: number;
}

const MULTICLASS_PREREQS_LOCKED_REASONS = [
  "Requires CHA 13 for Bard / Sorcerer / Warlock",
  "Requires INT 13 for Wizard",
  "Requires WIS 13 for Cleric / Druid / Ranger",
  "Requires STR 13 for Barbarian / Paladin",
  "Requires DEX 13 for Rogue",
];

const MAX_TOTAL_LEVEL = 20;

export function ClassStepRail(props: ClassStepRailProps) {
  const {
    classes, subclasses, features, selectedClasses, localChoices,
    resolvedStats, hpRule, hpRolls,
    onLevelChange, onRemoveClass, onSubclassSelect, onAsiSelect, onFightingStyleSelect, onChoiceSelect,
    onAddClass, onConfirmLevelUp, onCancelLevelUp, onHpRollChange,
  } = props;

  const initialClassIndex = 0;
  const initialLevel = selectedClasses[0]?.level ?? 1;
  const [selected, setSelected] = useState<SelectedKey>({ classIndex: initialClassIndex, level: initialLevel });
  const [showPicker, setShowPicker] = useState(false);
  const [levelUpDraft, setLevelUpDraft] = useState<LevelUpDraft | null>(null);

  // PR-C: close picker after a successful add (selectedClasses.length increment)
  const prevLengthRef = useRef(selectedClasses.length);
  useEffect(() => {
    if (selectedClasses.length > prevLengthRef.current) {
      setShowPicker(false);
      setSelected({ classIndex: selectedClasses.length - 1, level: 1 });
    }
    prevLengthRef.current = selectedClasses.length;
  }, [selectedClasses.length]);

  // Level-up flow: clear draft when the parent confirms (selectedClasses[i].level bumps)
  // We track per-index level so we know which class's confirm landed.
  const prevLevelsRef = useRef(selectedClasses.map((c) => c.level));
  useEffect(() => {
    if (levelUpDraft) {
      const prevLevel = prevLevelsRef.current[levelUpDraft.classIndex];
      const currLevel = selectedClasses[levelUpDraft.classIndex]?.level;
      if (currLevel !== undefined && prevLevel !== undefined && currLevel > prevLevel) {
        // Level bumped — confirm landed.
        setLevelUpDraft(null);
        setSelected({ classIndex: levelUpDraft.classIndex, level: currLevel });
      }
    }
    prevLevelsRef.current = selectedClasses.map((c) => c.level);
  }, [selectedClasses, levelUpDraft]);

  const totalLevel = selectedClasses.reduce((sum, c) => sum + c.level, 0);
  const levelsRemaining = MAX_TOTAL_LEVEL - totalLevel;

  const prereqs = multiclassPrereqsForAll(resolvedStats, selectedClasses, classes);
  const anyMet = prereqs.some((p) => p.state === "met");
  const canAddClass = anyMet && levelsRemaining > 0;

  const isMidFlow = levelUpDraft !== null;
  const activeFlowClassLabel = isMidFlow
    ? classes.find((c) => c.slug === selectedClasses[levelUpDraft!.classIndex]?.slug)?.name ?? "class"
    : null;

  const conMod = Math.floor(((resolvedStats.constitution ?? 10) - 10) / 2);

  // Active-pane decision tree.
  let mainPaneContent: React.ReactNode;

  if (isMidFlow) {
    const draft = levelUpDraft!;
    const cls = selectedClasses[draft.classIndex];
    const classContent = classes.find((c) => c.slug === cls?.slug);
    const subclassContent = cls?.subclass ? subclasses.find((sc) => sc.slug === cls.subclass) ?? null : null;

    if (classContent && cls) {
      const perLevel = classFeaturesPerLevel({
        classContent,
        features,
        subclassContent,
        characterChoices: localChoices,
        classIndex: draft.classIndex,
      });
      const draftRow = perLevel.find((r) => r.level === draft.draftLevel) ?? {
        level: draft.draftLevel,
        features: [],
        choices: [],
      };
      const styleOptions = features.filter((f) => {
        const data = f.data as Record<string, unknown>;
        return data.class === cls.slug && data.feature_type === "fighting_style" && f.name !== "Fighting Style";
      });
      const classChoices = (classContent.effects ?? []).filter(
        (e): e is import("@/lib/types/effects").ChoiceEffect => e.type === "choice",
      );
      const totalAfter = totalLevel - cls.level + draft.draftLevel;

      mainPaneContent = (
        <LevelUpPane
          classContent={classContent}
          classIndex={draft.classIndex}
          isPrimaryClass={draft.classIndex === 0}
          draftLevel={draft.draftLevel}
          totalLevelAfterConfirm={totalAfter}
          perLevelRow={draftRow}
          subclasses={subclasses}
          styleOptions={styleOptions}
          localChoices={localChoices}
          currentSubclass={cls.subclass}
          classChoices={classChoices}
          hpRule={hpRule}
          conMod={conMod}
          hpRolls={hpRolls}
          onAsiSelect={onAsiSelect}
          onSubclassSelect={onSubclassSelect}
          onFightingStyleSelect={onFightingStyleSelect}
          onChoiceSelect={onChoiceSelect}
          onHpRollChange={onHpRollChange}
          onCancel={() => {
            setLevelUpDraft(null);
            onCancelLevelUp();
          }}
          onConfirm={() => onConfirmLevelUp(draft)}
        />
      );
    }
  } else if (showPicker) {
    mainPaneContent = (
      <ClassPickerPanel
        classes={classes}
        resolvedStats={resolvedStats}
        selectedClasses={selectedClasses}
        levelsRemaining={levelsRemaining}
        onSelect={onAddClass}
        onCancel={() => setShowPicker(false)}
      />
    );
  } else {
    const activeClass = selectedClasses[selected.classIndex];
    const activeClassContent = activeClass ? classes.find((c) => c.slug === activeClass.slug) : undefined;
    const activeSubclassContent = activeClass?.subclass
      ? subclasses.find((sc) => sc.slug === activeClass.subclass) ?? null
      : null;

    if (activeClassContent && activeClass) {
      const activePerLevel = classFeaturesPerLevel({
        classContent: activeClassContent,
        features,
        subclassContent: activeSubclassContent,
        characterChoices: localChoices,
        classIndex: selected.classIndex,
      });
      const activeRow = activePerLevel.find((r) => r.level === selected.level);
      const styleOptionsForActive = features.filter((f) => {
        const data = f.data as Record<string, unknown>;
        return data.class === activeClass.slug && data.feature_type === "fighting_style" && f.name !== "Fighting Style";
      });
      const activeClassChoices = (activeClassContent.effects ?? []).filter(
        (e): e is import("@/lib/types/effects").ChoiceEffect => e.type === "choice",
      );
      const hitDie = (activeClassContent.data as Record<string, unknown>).hit_die as number | undefined ?? 8;

      mainPaneContent = (
        <ClassLevelPane
          classSlug={activeClass.slug}
          className_={activeClassContent.name}
          classIndex={selected.classIndex}
          isPrimaryClass={selected.classIndex === 0}
          row={activeRow}
          subclasses={subclasses}
          styleOptions={styleOptionsForActive}
          localChoices={localChoices}
          currentSubclass={activeClass.subclass}
          classChoices={activeClassChoices}
          hitDie={hitDie}
          hpRule={hpRule}
          conMod={conMod}
          hpRolls={hpRolls}
          onAsiSelect={onAsiSelect}
          onSubclassSelect={onSubclassSelect}
          onFightingStyleSelect={onFightingStyleSelect}
          onChoiceSelect={onChoiceSelect}
          onHpRollChange={onHpRollChange}
        />
      );
    } else {
      mainPaneContent = <p className="text-sm text-muted-foreground">No class data for the selected level.</p>;
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      <aside aria-label="Class levels" className="space-y-4">
        {selectedClasses.map((cls, idx) => {
          const classContent = classes.find((c) => c.slug === cls.slug);
          if (!classContent) return null;
          const subclassContent = cls.subclass ? subclasses.find((sc) => sc.slug === cls.subclass) ?? null : null;
          const perLevel = classFeaturesPerLevel({
            classContent,
            features,
            subclassContent,
            characterChoices: localChoices,
            classIndex: idx,
          });

          // Levels rendered in the rail: confirmed levels (1..cls.level) plus, if this is the
          // active flow class, an extra draft pill at draftLevel.
          const renderedPerLevel = isMidFlow && levelUpDraft!.classIndex === idx
            ? [...perLevel.filter((r) => r.level <= cls.level), { level: levelUpDraft!.draftLevel, features: [], choices: [] }]
            : perLevel.filter((r) => r.level <= cls.level);

          // Hard-lock disabled state: this rail is disabled if the flow is active on a DIFFERENT class.
          const railDisabled = isMidFlow && levelUpDraft!.classIndex !== idx;

          // LevelUpButton state per rail.
          let buttonState: "idle" | "disabled" | "active-flow";
          let buttonReason: string | undefined;
          if (isMidFlow && levelUpDraft!.classIndex === idx) {
            buttonState = "active-flow";
          } else if (isMidFlow) {
            buttonState = "disabled";
            buttonReason = `Finish ${activeFlowClassLabel} ${selectedClasses[levelUpDraft!.classIndex].level + 1} first`;
          } else if (cls.level >= 20) {
            buttonState = "disabled";
            buttonReason = "Lv 20 (max)";
          } else if (totalLevel >= MAX_TOTAL_LEVEL) {
            buttonState = "disabled";
            buttonReason = "Character at Lv 20 (max)";
          } else {
            buttonState = "idle";
          }

          return (
            <LevelRail
              key={`${cls.slug}-${idx}`}
              classSlug={cls.slug}
              className_={classContent.name}
              subclassName={subclassContent?.name}
              currentLevel={cls.level}
              perLevel={renderedPerLevel}
              activeLevel={
                (isMidFlow && levelUpDraft!.classIndex === idx)
                  ? levelUpDraft!.draftLevel
                  : (selected.classIndex === idx && !showPicker ? selected.level : -1)
              }
              onSelectLevel={(level) => {
                if (railDisabled) return;
                if (isMidFlow && levelUpDraft!.classIndex === idx && level !== levelUpDraft!.draftLevel) {
                  // Active-class non-draft pill click during flow: no-op (keep flow on draft).
                  return;
                }
                setShowPicker(false);
                setSelected({ classIndex: idx, level });
              }}
              onLevelChange={(newLevel) => {
                if (selected.classIndex === idx && selected.level > newLevel) {
                  setSelected({ classIndex: idx, level: newLevel });
                }
                onLevelChange(idx, newLevel);
              }}
              onRemoveClass={() => onRemoveClass(idx)}
              disabled={railDisabled}
              onLevelUpClick={() => {
                if (buttonState !== "idle") return;
                setShowPicker(false);
                setLevelUpDraft({ classIndex: idx, draftLevel: cls.level + 1 });
              }}
              levelUpButtonState={buttonState}
              levelUpButtonReason={buttonReason}
            />
          );
        })}
        <Separator />
        {isMidFlow ? (
          <AddClassRow
            reasons={MULTICLASS_PREREQS_LOCKED_REASONS}
            disabledReason="Finish active level-up first"
          />
        ) : canAddClass ? (
          <AddClassRow
            unlocked
            levelsRemaining={levelsRemaining}
            onClick={() => setShowPicker(true)}
          />
        ) : (
          <AddClassRow reasons={MULTICLASS_PREREQS_LOCKED_REASONS} />
        )}
      </aside>

      <div className="min-w-0">{mainPaneContent}</div>
    </div>
  );
}
```

Note: this version drops the dead `contentRefs` prop entirely (PR-C reviewer carryover). Task 11 will update the page-level call site to stop passing it.

- [ ] **Step 5: Update the existing helper functions in the test file.**

`setup()` and `setupRail()` had a `contentRefs: []` field. Remove it from both helper objects. Also, ensure the new required props (`hpRule`, `hpRolls`, `onConfirmLevelUp`, `onCancelLevelUp`, `onHpRollChange`) are present in both helpers' default props.

- [ ] **Step 6: Run all tests in the file.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx`
Expected: PASS — every describe (PR-A's, PR-B's, PR-C's, plus the new level-up flow describe) passes. If existing PR-B/C tests fail because they used `contentRefs`, just remove those `contentRefs` references in the test file (the prop is gone now).

- [ ] **Step 7: Type-check.**

Run: `npx tsc --noEmit 2>&1 | head -30`

The rail itself should be error-free. The PARENT `class-step-client.tsx` will produce missing-required-prop errors for `hpRule`, `hpRolls`, `onConfirmLevelUp`, `onCancelLevelUp`, `onHpRollChange`. That's expected and Task 11 fixes it. If errors appear inside the rail or its children, fix before committing.

- [ ] **Step 8: Commit.**

```bash
git add components/builder/class-step-rail/index.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "$(cat <<'EOF'
feat(builder): wire level-up flow into ClassStepRail

Adds levelUpDraft rail-local state and the corresponding
pane-swap, hard-lock, and confirm/cancel propagation:
- LevelUpButton per class section with idle / disabled-with-
  reason / active-flow states
- Click idle button -> levelUpDraft set, main pane swaps to
  LevelUpPane, all other rail mutators disabled
- Confirm fires onConfirmLevelUp({ classIndex, draftLevel })
- Cancel clears the draft + fires onCancelLevelUp
- useEffect on selectedClasses[i].level increment clears the
  draft after a parent-confirmed level bump
- Mutual exclusion with the multiclass picker — opening one
  closes the other
- AddClassRow shows "Finish active level-up first" mid-flow

Also drops the dead `contentRefs` prop on ClassStepRail
(PR-C reviewer carryover — replaced by direct selectedClasses
reads).

Note: class-step-client.tsx still needs hpRule, hpRolls,
onConfirmLevelUp, onCancelLevelUp, onHpRollChange — fixed in
the next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11 — `class-step-client.tsx` + `page.tsx` page-level wiring

**Files:**
- Modify: `app/(app)/characters/[id]/builder/class/class-step-client.tsx`
- Modify: `app/(app)/characters/[id]/builder/class/page.tsx`

This task wires the page-level state: HP rule precedence resolution, HP rolls passthrough, Confirm/Cancel persistence, and the campaign join.

- [ ] **Step 1: Update `page.tsx` to join the campaign and pass HP rule + rolls down.**

Read the existing `page.tsx`. Find the character query and add a join:

```tsx
const { data: character } = await supabase
  .from("characters")
  .select(`
    *,
    game_systems(...existing...),
    campaigns(id, hp_rule)
  `)
  .eq("id", id)
  .single();
```

(Existing select pattern in this file uses parenthesized join syntax; preserve it. Just add `campaigns(id, hp_rule)` to the select.)

The `Character` type already has `campaign_id: string | null`; the join produces a nested `campaigns: { id, hp_rule } | null` field. Pass it to the client component as a new prop (or mutate the existing character prop shape if the file does that pattern).

In the `ClassStepClient` invocation at the bottom of the page:

```tsx
<ClassStepClient
  characterId={...}
  character={character}
  classes={...}
  ...existing props...
  campaignHpRule={character.campaigns?.hp_rule ?? null}
/>
```

If the existing page passes `character` as a single object that already has `campaigns` joined (because the join is part of the select), `character.campaigns?.hp_rule` is the access path — no separate prop needed. Use whichever pattern matches the existing file's shape.

- [ ] **Step 2: Update `class-step-client.tsx`.**

Read the existing file. The changes:

1. Import `resolveHpRule` and `HpRule` from `@/lib/builder/level-up-rules`.
2. Compute the resolved `hpRule`:

```tsx
const hpRule = resolveHpRule(
  // campaign source: from character.campaigns?.hp_rule (joined in page.tsx)
  (character as unknown as { campaigns?: { hp_rule?: HpRule | null } | null }).campaigns?.hp_rule,
  // system source:
  (schema as unknown as { hp_rule?: HpRule } | undefined)?.hp_rule,
);
```

(The casts here exist because `character`'s type doesn't yet include the joined campaign shape. If the codebase has a stronger type for the page-level character + joins, prefer that. Otherwise the casts are acceptable for this slice — they'll get tightened when a future PR formalizes the type.)

3. Pull `hpRolls` from `localChoices`:

```tsx
const hpRolls = localChoices.hp_rolls ?? {};
```

4. Add the Confirm + Cancel + HP-roll-change handlers:

```tsx
async function handleConfirmLevelUp(payload: { classIndex: number; draftLevel: number }) {
  const { classIndex, draftLevel } = payload;
  const updatedClasses = [...selectedClasses];
  updatedClasses[classIndex] = { ...updatedClasses[classIndex], level: draftLevel };
  const totalLevel = updatedClasses.reduce((sum, c) => sum + c.level, 0);
  const newChoices = { ...localChoices, classes: updatedClasses };

  setLocalChoices(newChoices);
  setLocalLevel(totalLevel);

  await supabase
    .from("characters")
    .update({ choices: newChoices, level: totalLevel })
    .eq("id", characterId);

  startTransition(() => router.refresh());
}

function handleCancelLevelUp() {
  // No persistence — the rail's useEffect on selectedClasses[i].level handles the
  // post-confirm cleanup. Cancel is purely a UI state revert.
}

async function handleHpRollChange(key: string, record: HpRollRecord) {
  const newHpRolls = { ...(localChoices.hp_rolls ?? {}), [key]: record };
  const newChoices = { ...localChoices, hp_rolls: newHpRolls };
  setLocalChoices(newChoices);
  await supabase
    .from("characters")
    .update({ choices: newChoices })
    .eq("id", characterId);
}
```

5. Pass the new props to `<ClassStepRail>`:

```tsx
<ClassStepRail
  classes={classes}
  subclasses={subclasses}
  features={features}
  selectedClasses={selectedClasses}
  localChoices={localChoices}
  resolvedStats={resolvedStats}
  hpRule={hpRule}
  hpRolls={hpRolls}
  onLevelChange={handleLevelChange}
  onRemoveClass={handleRemoveClass}
  onSubclassSelect={handleSubclassSelect}
  onAsiSelect={handleAsiSelect}
  onFightingStyleSelect={handleFightingStyleSelect}
  onChoiceSelect={handleChoiceSelect}
  onAddClass={(content) => setPreviewContent(content)}
  onConfirmLevelUp={handleConfirmLevelUp}
  onCancelLevelUp={handleCancelLevelUp}
  onHpRollChange={handleHpRollChange}
/>
```

6. Drop the `contentRefs={contentRefs}` prop from the rail invocation (matches Task 10's interface change).

7. Update the `<StatPreview>` usage at the bottom of the file to also pass `hpRolls` and `hpRule` if those are needed by it. (`<StatPreview>` calls `evaluate` for ability scores; max-HP isn't its concern here. Only update if it uses `computeMaxHp` itself — verify by reading the StatPreview source. If it doesn't call `computeMaxHp`, no change needed.)

- [ ] **Step 3: Type-check.**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: no errors mentioning `class-step-client.tsx`, `page.tsx`, `ClassStepRail`, or any of the new components.

- [ ] **Step 4: Run the full test suite.**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 5: Commit.**

```bash
git add "app/(app)/characters/[id]/builder/class/class-step-client.tsx" "app/(app)/characters/[id]/builder/class/page.tsx"
git commit -m "$(cat <<'EOF'
feat(builder): wire HP rule + level-up handlers in class-step-client

Joins campaigns.hp_rule on the character query, resolves the
HP rule via the precedence chain (campaign → system →
free_choice default), and threads it + the per-character
hp_rolls map through to ClassStepRail.

Adds three new persistence handlers:
- handleConfirmLevelUp: bumps selectedClasses[i].level, sums
  total level, persists choices + level in one update
- handleCancelLevelUp: no-op for persistence (rail handles
  the UI revert)
- handleHpRollChange: writes per-key HP roll record into
  choices.hp_rolls and persists immediately (matches Q9 lazy
  retrofit + per-edit persistence semantics)

Drops the dead contentRefs prop pass-through (PR-C reviewer
carryover).

This completes the level-up flow end-to-end.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12 — Manual UAT (browser, via test account)

**Files:**
- None (browser-only)

The component-level tests cover the seam mechanically; this task verifies the integration with real character data.

- [ ] **Step 1: Start the dev server.**

Use `preview_start` for `inkborne-dev`. If running, skip.

- [ ] **Step 2: Log in as the test account and open Voltee's class step.**

Test account creds will be provided by the user separately. Navigate to `/characters/{voltee-id}/builder/class`.

- [ ] **Step 3: Verify the LevelUpButton appears under the Wizard rail.**

Should show "Level up Wizard" with the purple accent + "Lv 4" right-side glyph. Click triggers the level-up flow.

- [ ] **Step 4: Verify the LevelUpPane renders correctly.**

- Breadcrumb: ClassEmblem · "Wizard" › "Level 4" · NEW LEVEL ribbon (gold pill).
- "What this level grants" section with feature cards (likely an ASI at Wizard Lv 4).
- "Choices for this level" section with the ASI card.
- "Hit points" section with HP picker (Average / Roll d6 / Manual).
- LevelUpActionBar at the bottom: "Cancel level-up" button + summary text + "Confirm level 4" button (disabled because ASI not yet picked).

- [ ] **Step 5: Verify hard lock during flow.**

Other classes' LevelUpButtons (if Voltee is multiclass) should show "Finish Wizard 4 first". Level dropdowns disabled. AddClassRow shows "Finish active level-up first". Remove buttons disabled.

- [ ] **Step 6: Pick an ASI + HP, then Confirm.**

After picking the ASI and clicking Average for HP, Confirm should enable. Click Confirm. Pane swaps back to ClassLevelPane showing the new Wizard Lv 4. Sidebar pill for Lv 4 is now permanent. Total HP reflects the new level (verify against StatPreview sidebar).

- [ ] **Step 7: Open the flow again, click Cancel.**

Click "Level up Wizard" again. In the LevelUpPane, click an ASI selection or change the HP value. Then click "Cancel level-up". The pane returns to the previous level. Choice/HP edits stick (verify by re-opening the flow — the previously-selected values are still there).

- [ ] **Step 8: Verify backwards compat.**

Visit Xero (existing multiclass character). Ability to level up should work without surprises. HP picker should appear in the regular level pane on non-Lv1-primary levels (Q9 lazy retrofit). If existing levels' HP wasn't stored, the picker shows the average default; clicking it persists the value.

- [ ] **Step 9: Verify level-20 cap.**

If Xero has rooms to level (or use the dropdown to push him to total 20), confirm both the LevelUpButton and AddClassRow show appropriate "max" reasons.

- [ ] **Step 10: Verify mutual exclusion with the multiclass picker (PR-C).**

Open the picker via "+ Add a class" first. Then click any "Level up [Class]" button. Picker should close; level-up flow opens. (Note: if the picker is open, the level-up buttons should still be clickable — only their *idle* state criteria depend on the flow.) Verify by reading the AddClassRow disabled-during-flow state.

- [ ] **Step 11: Restore test state.**

If you advanced Voltee's level during testing, level him back down to 3 using the dropdown. Remove any test classes added during the multiclass picker check.

- [ ] **Step 12: Take a screenshot of the open LevelUpPane for the PR description.**

Use `preview_screenshot`.

- [ ] **Step 13: Post a verification comment to the PR.**

Use the same pattern as PR-C verification comment: results table, what was confirmed, edge cases tested, "ready for your final pass".

- [ ] **Step 14: No commit needed for this task** unless the smoke test surfaced a bug — then file the fix as a new commit before proceeding.

---

## Self-review checklist (post-implementation)

Run before pushing the branch / opening the PR:

- [ ] All tests pass: `npx vitest run`
- [ ] Type-check clean: `npx tsc --noEmit`
- [ ] Lint clean: `npx eslint .` (or the project's lint script)
- [ ] No new files outside the file map (`git status -s` returns clean working tree apart from expected paths)
- [ ] No leftover `console.log` / debug code
- [ ] PR-A modal still works (open a fresh-no-class character → ContentBrowser → modal → Pick)
- [ ] PR-B rail still works for single-class characters (level pills, dropdown, choice cards)
- [ ] PR-C multiclass picker still works (AddClassRow → picker → met card → modal → Pick)
- [ ] Migration `00036_campaigns_hp_rule.sql` is in `supabase/migrations/`
