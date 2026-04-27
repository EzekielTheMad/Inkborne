# Class Step Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing accordion-style class step's "has class" branch with a sidebar of level pills + main pane showing the selected level's content. Choice cards (ASI / subclass / fighting style) rebuilt fresh per design.

**Architecture:** New `<ClassStepRail>` root holds modal-local state for selected class+level. Renders one `<LevelRail>` per class in `selectedClasses` (multi-class characters render N sections; the *add* flow is gated by a locked `<AddClassRow>`, but display works for existing multiclass chars). Main pane (`<ClassLevelPane>`) reads a `PerLevel[]` from a pure helper (`class-features-per-level.ts`) and renders feature cards or rebuilt choice cards. Existing handler signatures (`onLevelChange`, `onSubclassSelect`, `onAsiSelect`, `onFightingStyleSelect`, `onChoiceSelect`, `onRemoveClass`) are passed through from `class-step-client.tsx` unchanged.

**Tech Stack:** Next.js 16 App Router (client component), TypeScript strict, Tailwind v4 with HSL tokens, vitest + `@testing-library/react`. Reuses `<ClassEmblem>` and `lib/builder/class-tone.ts` from PR-A.

**Spec:** [`docs/superpowers/specs/2026-04-27-class-step-rail-design.md`](../specs/2026-04-27-class-step-rail-design.md). Source design files: [`docs/design-briefs/builder-ux-polish-design-files/`](../../design-briefs/builder-ux-polish-design-files/).

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `lib/builder/class-features-per-level.ts` | Create | Pure helper: `(classContent, features, subclassContent, characterChoices, classIndex) → PerLevel[]`. |
| `tests/lib/builder/class-features-per-level.test.ts` | Create | TDD coverage for the helper. |
| `components/builder/class-step-rail/index.tsx` | Create | Root: sidebar + main pane wrapper. Holds `selectedKey` state. Renders one `<LevelRail>` per class + `<ClassLevelPane>`. |
| `components/builder/class-step-rail/level-rail.tsx` | Create | One class section: header + level pills + level dropdown. |
| `components/builder/class-step-rail/level-pill.tsx` | Create | Single pill: number + summary + unmade-choice red dot + active state. |
| `components/builder/class-step-rail/class-level-pane.tsx` | Create | Main pane: breadcrumb + title + feature/choice card stack. |
| `components/builder/class-step-rail/feature-card.tsx` | Create | Passive feature row (name + description). |
| `components/builder/class-step-rail/choice-card-asi.tsx` | Create | ASI choice card rebuilt from design. |
| `components/builder/class-step-rail/choice-card-subclass.tsx` | Create | Subclass picker card rebuilt from design. |
| `components/builder/class-step-rail/choice-card-fighting-style.tsx` | Create | Fighting style choice card rebuilt from design. |
| `components/builder/class-step-rail/add-class-row.tsx` | Create | Locked "+ Add a class" row at the bottom of the rail. |
| `tests/components/builder/class-step-rail.test.tsx` | Create | Behavior coverage for the rail + each card. |
| `app/(app)/characters/[id]/builder/class/class-step-client.tsx` | Modify | Replace the "has class" branch (accordion + per-class card + bottom multiclass picker) with `<ClassStepRail>`. |

---

## Task 1 — `class-features-per-level` helper

**Files:**
- Create: `lib/builder/class-features-per-level.ts`
- Test: `tests/lib/builder/class-features-per-level.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
// tests/lib/builder/class-features-per-level.test.ts
import { describe, it, expect } from "vitest";
import {
  classFeaturesPerLevel,
  type PerLevel,
} from "@/lib/builder/class-features-per-level";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { CharacterChoices } from "@/lib/types/character";

function feature(slug: string, name: string, level: number, classSlug: string, extras: Record<string, unknown> = {}): ContentEntry {
  return {
    id: `feat-${slug}`,
    slug,
    name,
    content_type: "feature",
    data: { level, class: classSlug, ...extras },
    effects: [],
    version: 1,
    source: "srd",
  };
}

function makeClass(): ContentEntry {
  return {
    id: "c-paladin",
    slug: "paladin",
    name: "Paladin",
    content_type: "class",
    data: {
      hit_die: 10,
      levels: [
        { level: 1, features: ["divine-sense"] },
        { level: 3, features: ["sacred-oath"] },
        { level: 4, features: ["paladin-asi-4"] },
      ],
    },
    effects: [],
    version: 1,
    source: "srd",
  };
}

describe("classFeaturesPerLevel", () => {
  const baseArgs = {
    classContent: makeClass(),
    features: [
      feature("divine-sense", "Divine Sense", 1, "paladin"),
      feature("sacred-oath", "Sacred Oath", 3, "paladin", { feature_type: "subclass" }),
      feature("paladin-asi-4", "Ability Score Improvement", 4, "paladin", { feature_type: "asi" }),
    ],
    subclassContent: null,
    characterChoices: {} as CharacterChoices,
    classIndex: 0,
  };

  it("returns per-level rows in level order", () => {
    const result = classFeaturesPerLevel(baseArgs);
    expect(result.map((r) => r.level)).toEqual([1, 3, 4]);
  });

  it("attaches passive features to their level row", () => {
    const result = classFeaturesPerLevel(baseArgs);
    expect(result[0].features.map((f) => f.slug)).toEqual(["divine-sense"]);
  });

  it("flags an unmade subclass choice on the level it gates", () => {
    const result = classFeaturesPerLevel(baseArgs);
    const lv3 = result.find((r) => r.level === 3)!;
    expect(lv3.choices).toEqual([
      expect.objectContaining({
        type: "subclass",
        classSlug: "paladin",
        label: "Sacred Oath",
        isMade: false,
      }),
    ]);
  });

  it("flags an unmade ASI choice on the level it gates", () => {
    const result = classFeaturesPerLevel(baseArgs);
    const lv4 = result.find((r) => r.level === 4)!;
    expect(lv4.choices).toEqual([
      expect.objectContaining({
        type: "asi",
        featureSlug: "paladin-asi-4",
        classSlug: "paladin",
        label: "Ability Score Improvement",
        isMade: false,
      }),
    ]);
  });

  it("marks subclass choice as made when characterChoices.classes[classIndex].subclass is set", () => {
    const result = classFeaturesPerLevel({
      ...baseArgs,
      characterChoices: {
        classes: [{ slug: "paladin", level: 5, subclass: "devotion" }],
      },
    });
    const lv3 = result.find((r) => r.level === 3)!;
    expect(lv3.choices[0].isMade).toBe(true);
  });

  it("marks ASI choice as made when asi_choices contains the feature slug", () => {
    const result = classFeaturesPerLevel({
      ...baseArgs,
      characterChoices: {
        asi_choices: {
          "paladin-asi-4": {
            mode: "asi",
            allocations: [{ ability: "strength", amount: 2 }],
          },
        },
      },
    });
    const lv4 = result.find((r) => r.level === 4)!;
    expect(lv4.choices[0].isMade).toBe(true);
  });

  it("merges subclass features into their level row when a subclass is provided", () => {
    const subclass: ContentEntry = {
      id: "sc-devotion",
      slug: "devotion",
      name: "Oath of Devotion",
      content_type: "subclass",
      data: {
        parent_class: "paladin",
        levels: [{ level: 3, features: ["cd-sacred-weapon"] }],
      },
      effects: [],
      version: 1,
      source: "srd",
    };
    const features = [
      ...baseArgs.features,
      feature("cd-sacred-weapon", "Channel Divinity: Sacred Weapon", 3, "paladin", { subclass: "devotion" }),
    ];
    const result = classFeaturesPerLevel({
      ...baseArgs,
      features,
      subclassContent: subclass,
      characterChoices: {
        classes: [{ slug: "paladin", level: 5, subclass: "devotion" }],
      },
    });
    const lv3 = result.find((r) => r.level === 3)!;
    expect(lv3.features.map((f) => f.slug)).toContain("cd-sacred-weapon");
  });

  it("flags an unmade fighting style choice using the parent feature slug", () => {
    const fighter: ContentEntry = {
      id: "c-fighter",
      slug: "fighter",
      name: "Fighter",
      content_type: "class",
      data: {
        hit_die: 10,
        levels: [{ level: 1, features: ["fighter-fighting-style"] }],
      },
      effects: [],
      version: 1,
      source: "srd",
    };
    const features = [
      feature("fighter-fighting-style", "Fighting Style", 1, "fighter", { feature_type: "fighting_style" }),
      feature("fighter-fs-archery", "Fighting Style: Archery", 1, "fighter", { feature_type: "fighting_style" }),
    ];
    const result = classFeaturesPerLevel({
      classContent: fighter,
      features,
      subclassContent: null,
      characterChoices: {},
      classIndex: 0,
    });
    const lv1 = result.find((r) => r.level === 1)!;
    expect(lv1.choices).toEqual([
      expect.objectContaining({
        type: "fighting-style",
        featureSlug: "fighter-fighting-style",
        isMade: false,
      }),
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail.**

Run: `npx vitest run tests/lib/builder/class-features-per-level.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper.**

```ts
// lib/builder/class-features-per-level.ts
import type { ContentEntry } from "@/components/builder/content-browser";
import type { CharacterChoices } from "@/lib/types/character";

export type ChoiceType = "asi" | "subclass" | "fighting-style" | "generic";

export interface PerLevelChoice {
  type: ChoiceType;
  /** Feature slug that gates this choice — used as the choice id for ASI / fighting-style. */
  featureSlug?: string;
  classSlug: string;
  /** Display label for level pill summary + breadcrumb title. */
  label: string;
  /** True if the user has already made this choice. */
  isMade: boolean;
}

export interface PerLevel {
  level: number;
  features: ContentEntry[];
  choices: PerLevelChoice[];
}

interface LevelRow {
  level: number;
  features: string[];
}

export interface ClassFeaturesPerLevelArgs {
  classContent: ContentEntry;
  features: ContentEntry[];
  subclassContent: ContentEntry | null;
  characterChoices: CharacterChoices;
  classIndex: number;
}

export function classFeaturesPerLevel(args: ClassFeaturesPerLevelArgs): PerLevel[] {
  const { classContent, features, subclassContent, characterChoices, classIndex } = args;
  const classData = classContent.data as Record<string, unknown>;
  const classLevels = (classData.levels as LevelRow[] | undefined) ?? [];
  const subclassLevels =
    ((subclassContent?.data as Record<string, unknown> | undefined)?.levels as LevelRow[] | undefined) ?? [];

  // Merge feature slugs by level.
  const slugsByLevel = new Map<number, string[]>();
  for (const row of classLevels) {
    slugsByLevel.set(row.level, [...(slugsByLevel.get(row.level) ?? []), ...row.features]);
  }
  for (const row of subclassLevels) {
    slugsByLevel.set(row.level, [...(slugsByLevel.get(row.level) ?? []), ...row.features]);
  }

  const featureBySlug = new Map<string, ContentEntry>();
  for (const f of features) {
    featureBySlug.set(f.slug, f);
  }

  const classSlug = classContent.slug;
  const pickedSubclass = characterChoices.classes?.[classIndex]?.subclass;
  const asiChoices = characterChoices.asi_choices ?? {};
  const resolvedChoices = characterChoices.resolved_choices ?? {};

  const result: PerLevel[] = [];
  for (const [level, slugs] of slugsByLevel.entries()) {
    const featureEntries: ContentEntry[] = [];
    const choices: PerLevelChoice[] = [];

    for (const slug of slugs) {
      const f = featureBySlug.get(slug);
      if (!f) continue;
      const fdata = f.data as Record<string, unknown>;
      const featureType = fdata.feature_type as string | undefined;

      if (featureType === "subclass") {
        choices.push({
          type: "subclass",
          classSlug,
          label: f.name,
          isMade: !!pickedSubclass,
        });
        continue;
      }
      if (featureType === "asi") {
        choices.push({
          type: "asi",
          featureSlug: f.slug,
          classSlug,
          label: f.name,
          isMade: !!asiChoices[f.slug],
        });
        continue;
      }
      if (featureType === "fighting_style" && f.name === "Fighting Style") {
        const isMade = (resolvedChoices[f.slug] ?? []).length > 0;
        choices.push({
          type: "fighting-style",
          featureSlug: f.slug,
          classSlug,
          label: f.name,
          isMade,
        });
        continue;
      }
      // Skip child fighting-style entries (e.g. "Fighting Style: Archery") — those are
      // options under the parent choice, not their own per-level features.
      if (featureType === "fighting_style") continue;

      featureEntries.push(f);
    }

    if (featureEntries.length === 0 && choices.length === 0) continue;
    result.push({ level, features: featureEntries, choices });
  }

  result.sort((a, b) => a.level - b.level);
  return result;
}
```

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `npx vitest run tests/lib/builder/class-features-per-level.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit.**

```bash
git add lib/builder/class-features-per-level.ts tests/lib/builder/class-features-per-level.test.ts
git commit -m "feat(builder): class-features-per-level helper"
```

---

## Task 2 — `<LevelPill>` component

**Files:**
- Create: `components/builder/class-step-rail/level-pill.tsx`
- Test: append to `tests/components/builder/class-step-rail.test.tsx`

- [ ] **Step 1: Write the failing test.**

Create `tests/components/builder/class-step-rail.test.tsx` (this file will accumulate tests across tasks):

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LevelPill } from "@/components/builder/class-step-rail/level-pill";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LevelPill", () => {
  it("renders the level number and summary", () => {
    render(<LevelPill level={3} summary="Sacred Oath" hasUnmadeChoice={false} active={false} onClick={vi.fn()} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Sacred Oath")).toBeInTheDocument();
  });

  it("shows the unmade-choice indicator when hasUnmadeChoice is true", () => {
    render(<LevelPill level={4} summary="ASI" hasUnmadeChoice={true} active={false} onClick={vi.fn()} />);
    expect(screen.getByLabelText("Has unmade choice")).toBeInTheDocument();
  });

  it("hides the unmade-choice indicator when hasUnmadeChoice is false", () => {
    render(<LevelPill level={1} summary="Divine Sense" hasUnmadeChoice={false} active={false} onClick={vi.fn()} />);
    expect(screen.queryByLabelText("Has unmade choice")).not.toBeInTheDocument();
  });

  it("marks the active pill with aria-current='true'", () => {
    render(<LevelPill level={2} summary="Fighting Style" hasUnmadeChoice={false} active={true} onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: /level 2/i })).toHaveAttribute("aria-current", "true");
  });

  it("calls onClick when activated", () => {
    const onClick = vi.fn();
    render(<LevelPill level={2} summary="Fighting Style" hasUnmadeChoice={false} active={false} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: /level 2/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement.**

```tsx
// components/builder/class-step-rail/level-pill.tsx
import { cn } from "@/lib/utils";

interface LevelPillProps {
  level: number;
  summary: string;
  hasUnmadeChoice: boolean;
  active: boolean;
  onClick: () => void;
}

export function LevelPill({ level, summary, hasUnmadeChoice, active, onClick }: LevelPillProps) {
  return (
    <button
      type="button"
      aria-current={active ? "true" : undefined}
      aria-label={`Level ${level}: ${summary}`}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
        "border border-transparent hover:bg-muted/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-accent/12 border-accent text-accent",
      )}
    >
      <span className="w-5 text-center font-semibold tabular-nums">{level}</span>
      <span className="flex-1 truncate">{summary}</span>
      {hasUnmadeChoice && (
        <span
          aria-label="Has unmade choice"
          className="size-1.5 shrink-0 rounded-full bg-destructive"
        />
      )}
    </button>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit.**

```bash
git add components/builder/class-step-rail/level-pill.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "feat(builder): LevelPill component"
```

---

## Task 3 — `<FeatureCard>` component

**Files:**
- Create: `components/builder/class-step-rail/feature-card.tsx`
- Test: append to `tests/components/builder/class-step-rail.test.tsx`

- [ ] **Step 1: Append failing tests.**

```tsx
import { FeatureCard } from "@/components/builder/class-step-rail/feature-card";
import type { ContentEntry } from "@/components/builder/content-browser";

function passiveFeature(): ContentEntry {
  return {
    id: "f1",
    slug: "divine-sense",
    name: "Divine Sense",
    content_type: "feature",
    data: { description: "Detect celestials, fiends, undead.", level: 1, class: "paladin" },
    effects: [],
    version: 1,
    source: "srd",
  };
}

describe("FeatureCard", () => {
  it("renders the feature name and description", () => {
    render(<FeatureCard feature={passiveFeature()} />);
    expect(screen.getByText("Divine Sense")).toBeInTheDocument();
    expect(screen.getByText("Detect celestials, fiends, undead.")).toBeInTheDocument();
  });

  it("renders without a description if absent", () => {
    const f = passiveFeature();
    f.data = { level: 1, class: "paladin" };
    render(<FeatureCard feature={f} />);
    expect(screen.getByText("Divine Sense")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "FeatureCard"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement.**

```tsx
// components/builder/class-step-rail/feature-card.tsx
import type { ContentEntry } from "@/components/builder/content-browser";

interface FeatureCardProps {
  feature: ContentEntry;
}

export function FeatureCard({ feature }: FeatureCardProps) {
  const data = feature.data as Record<string, unknown>;
  const description = typeof data.description === "string" ? data.description : null;
  return (
    <article className="rounded-md border border-border bg-card/40 px-3 py-2.5">
      <h4 className="text-sm font-medium">{feature.name}</h4>
      {description && (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      )}
    </article>
  );
}
```

- [ ] **Step 4: Run tests.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "FeatureCard"`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit.**

```bash
git add components/builder/class-step-rail/feature-card.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "feat(builder): FeatureCard component for class step rail"
```

---

## Task 4 — `<ChoiceCardASI>`

**Files:**
- Create: `components/builder/class-step-rail/choice-card-asi.tsx`
- Test: append to `tests/components/builder/class-step-rail.test.tsx`

- [ ] **Step 1: Append failing tests.**

```tsx
import { ChoiceCardASI } from "@/components/builder/class-step-rail/choice-card-asi";

describe("ChoiceCardASI", () => {
  it("shows 'Choose' badge when no choice is made", () => {
    render(
      <ChoiceCardASI featureSlug="paladin-asi-4" currentChoice={undefined} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("Choose")).toBeInTheDocument();
  });

  it("shows 'Chosen' badge when a choice exists", () => {
    render(
      <ChoiceCardASI
        featureSlug="paladin-asi-4"
        currentChoice={{ mode: "asi", allocations: [{ ability: "strength", amount: 2 }] }}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Chosen")).toBeInTheDocument();
  });

  it("calls onSelect with a +2 allocation when the user picks +2 to strength", () => {
    const onSelect = vi.fn();
    render(
      <ChoiceCardASI featureSlug="paladin-asi-4" currentChoice={undefined} onSelect={onSelect} />,
    );
    // Toggle to "Increase one ability by 2" mode (default in this test) and click STR.
    fireEvent.click(screen.getByRole("button", { name: /^STR \+2$/ }));
    expect(onSelect).toHaveBeenCalledWith({
      mode: "asi",
      allocations: [{ ability: "strength", amount: 2 }],
    });
  });

  it("calls onSelect with two +1 allocations in two-stat mode", () => {
    const onSelect = vi.fn();
    render(
      <ChoiceCardASI featureSlug="paladin-asi-4" currentChoice={undefined} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /two abilities by \+1/i }));
    fireEvent.click(screen.getByRole("button", { name: /^STR \+1$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^DEX \+1$/ }));
    // The last call carries the final state: STR+1 + DEX+1.
    const lastCall = onSelect.mock.calls.at(-1)?.[0];
    expect(lastCall).toEqual({
      mode: "asi",
      allocations: expect.arrayContaining([
        { ability: "strength", amount: 1 },
        { ability: "dexterity", amount: 1 },
      ]),
    });
  });
});
```

- [ ] **Step 2: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "ChoiceCardASI"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement.**

```tsx
// components/builder/class-step-rail/choice-card-asi.tsx
"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { AsiChoice, AsiAllocation } from "@/lib/types/character";

interface ChoiceCardASIProps {
  featureSlug: string;
  currentChoice: AsiChoice | undefined;
  onSelect: (choice: AsiChoice) => void;
}

const ABILITIES = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const;
const ABBR: Record<(typeof ABILITIES)[number], string> = {
  strength: "STR",
  dexterity: "DEX",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "WIS",
  charisma: "CHA",
};

type Mode = "single" | "split";

function inferMode(allocations: AsiAllocation[] | undefined): Mode {
  if (!allocations || allocations.length === 0) return "single";
  return allocations.length === 1 ? "single" : "split";
}

export function ChoiceCardASI({ featureSlug, currentChoice, onSelect }: ChoiceCardASIProps) {
  const [mode, setMode] = useState<Mode>(inferMode(currentChoice?.allocations));
  const [splitPicks, setSplitPicks] = useState<string[]>(() =>
    (currentChoice?.allocations ?? []).filter((a) => a.amount === 1).map((a) => a.ability),
  );

  // If parent state changes externally, sync.
  useEffect(() => {
    setMode(inferMode(currentChoice?.allocations));
    setSplitPicks((currentChoice?.allocations ?? []).filter((a) => a.amount === 1).map((a) => a.ability));
  }, [currentChoice, featureSlug]);

  const isMade = !!currentChoice && currentChoice.allocations.length > 0;

  function pickSingle(ability: string) {
    onSelect({ mode: "asi", allocations: [{ ability, amount: 2 }] });
  }

  function toggleSplit(ability: string) {
    let next: string[];
    if (splitPicks.includes(ability)) {
      next = splitPicks.filter((a) => a !== ability);
    } else if (splitPicks.length < 2) {
      next = [...splitPicks, ability];
    } else {
      // Drop the first, add the new — keep at most 2 picks.
      next = [splitPicks[1], ability];
    }
    setSplitPicks(next);
    onSelect({
      mode: "asi",
      allocations: next.map((a) => ({ ability: a, amount: 1 })),
    });
  }

  return (
    <article className="rounded-md border border-border bg-card/40 p-4" data-feature-slug={featureSlug}>
      <header className="flex items-center justify-between gap-3 mb-3">
        <h4 className="text-sm font-medium">Ability Score Improvement</h4>
        <span
          aria-label={isMade ? "Choice made" : "Choice not yet made"}
          className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide",
            isMade ? "bg-accent/15 text-accent" : "bg-destructive/15 text-destructive",
          )}
        >
          {isMade ? "Chosen" : "Choose"}
        </span>
      </header>

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setMode("single")}
          aria-pressed={mode === "single"}
          className={cn(
            "px-2.5 py-1 rounded-full text-xs border transition-colors",
            mode === "single" ? "bg-accent/15 border-accent/50 text-accent" : "bg-transparent border-border text-muted-foreground hover:text-foreground",
          )}
        >
          One ability by +2
        </button>
        <button
          type="button"
          onClick={() => setMode("split")}
          aria-pressed={mode === "split"}
          className={cn(
            "px-2.5 py-1 rounded-full text-xs border transition-colors",
            mode === "split" ? "bg-accent/15 border-accent/50 text-accent" : "bg-transparent border-border text-muted-foreground hover:text-foreground",
          )}
        >
          Two abilities by +1
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {ABILITIES.map((ability) => {
          const label = ABBR[ability];
          if (mode === "single") {
            const selected =
              currentChoice?.allocations.length === 1 &&
              currentChoice.allocations[0].ability === ability &&
              currentChoice.allocations[0].amount === 2;
            return (
              <button
                key={ability}
                type="button"
                aria-pressed={selected}
                onClick={() => pickSingle(ability)}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                  selected ? "border-accent bg-accent/10 text-accent" : "border-border bg-card/30 hover:border-accent/50",
                )}
              >
                {label} +2
              </button>
            );
          }
          // split mode
          const selected = splitPicks.includes(ability);
          return (
            <button
              key={ability}
              type="button"
              aria-pressed={selected}
              onClick={() => toggleSplit(ability)}
              className={cn(
                "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                selected ? "border-accent bg-accent/10 text-accent" : "border-border bg-card/30 hover:border-accent/50",
              )}
            >
              {label} +1
            </button>
          );
        })}
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "ChoiceCardASI"`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit.**

```bash
git add components/builder/class-step-rail/choice-card-asi.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "feat(builder): ChoiceCardASI rebuilt for class step rail"
```

---

## Task 5 — `<ChoiceCardSubclass>`

**Files:**
- Create: `components/builder/class-step-rail/choice-card-subclass.tsx`
- Test: append to `tests/components/builder/class-step-rail.test.tsx`

- [ ] **Step 1: Append failing tests.**

```tsx
import { ChoiceCardSubclass } from "@/components/builder/class-step-rail/choice-card-subclass";

function subclass(slug: string, name: string, parentClass: string, description?: string): ContentEntry {
  return {
    id: `sc-${slug}`,
    slug,
    name,
    content_type: "subclass",
    data: { parent_class: parentClass, description },
    effects: [],
    version: 1,
    source: "srd",
  };
}

describe("ChoiceCardSubclass", () => {
  it("renders subclass cards filtered to the matching class", () => {
    render(
      <ChoiceCardSubclass
        classSlug="paladin"
        subclasses={[
          subclass("devotion", "Oath of Devotion", "paladin"),
          subclass("ancients", "Oath of the Ancients", "paladin"),
          subclass("evocation", "Evocation", "wizard"),
        ]}
        currentSelection={undefined}
        onSelect={vi.fn()}
        label="Sacred Oath"
      />,
    );
    expect(screen.getByText("Oath of Devotion")).toBeInTheDocument();
    expect(screen.getByText("Oath of the Ancients")).toBeInTheDocument();
    expect(screen.queryByText("Evocation")).not.toBeInTheDocument();
  });

  it("shows 'Chosen' when a subclass is selected", () => {
    render(
      <ChoiceCardSubclass
        classSlug="paladin"
        subclasses={[subclass("devotion", "Oath of Devotion", "paladin")]}
        currentSelection="devotion"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Chosen")).toBeInTheDocument();
  });

  it("calls onSelect with the slug when a card is clicked", () => {
    const onSelect = vi.fn();
    render(
      <ChoiceCardSubclass
        classSlug="paladin"
        subclasses={[subclass("devotion", "Oath of Devotion", "paladin")]}
        currentSelection={undefined}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Oath of Devotion/i }));
    expect(onSelect).toHaveBeenCalledWith("devotion");
  });
});
```

- [ ] **Step 2: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "ChoiceCardSubclass"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement.**

```tsx
// components/builder/class-step-rail/choice-card-subclass.tsx
"use client";

import { cn } from "@/lib/utils";
import type { ContentEntry } from "@/components/builder/content-browser";

interface ChoiceCardSubclassProps {
  classSlug: string;
  subclasses: ContentEntry[];
  currentSelection: string | undefined;
  onSelect: (slug: string) => void;
  /** Optional override label (defaults to "Subclass"). */
  label?: string;
}

export function ChoiceCardSubclass({
  classSlug,
  subclasses,
  currentSelection,
  onSelect,
  label = "Subclass",
}: ChoiceCardSubclassProps) {
  const matching = subclasses.filter(
    (sc) => (sc.data as Record<string, unknown>).parent_class === classSlug,
  );
  const isMade = !!currentSelection;

  return (
    <article className="rounded-md border border-border bg-card/40 p-4">
      <header className="flex items-center justify-between gap-3 mb-3">
        <h4 className="text-sm font-medium">{label}</h4>
        <span
          aria-label={isMade ? "Choice made" : "Choice not yet made"}
          className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide",
            isMade ? "bg-accent/15 text-accent" : "bg-destructive/15 text-destructive",
          )}
        >
          {isMade ? "Chosen" : "Choose"}
        </span>
      </header>

      {matching.length === 0 ? (
        <p className="text-sm text-muted-foreground">No subclasses available for this class.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {matching.map((sc) => {
            const data = sc.data as Record<string, unknown>;
            const description = typeof data.description === "string" ? data.description : null;
            const selected = currentSelection === sc.slug;
            return (
              <button
                key={sc.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(sc.slug)}
                className={cn(
                  "text-left rounded-md border bg-card/30 px-3 py-3 transition-colors",
                  "border-border hover:border-accent/50",
                  selected && "border-accent bg-accent/10",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <p className="text-sm font-medium">{sc.name}</p>
                {description && (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-3">{description}</p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
}
```

- [ ] **Step 4: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "ChoiceCardSubclass"`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit.**

```bash
git add components/builder/class-step-rail/choice-card-subclass.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "feat(builder): ChoiceCardSubclass rebuilt for class step rail"
```

---

## Task 6 — `<ChoiceCardFightingStyle>`

**Files:**
- Create: `components/builder/class-step-rail/choice-card-fighting-style.tsx`
- Test: append to `tests/components/builder/class-step-rail.test.tsx`

- [ ] **Step 1: Append failing tests.**

```tsx
import { ChoiceCardFightingStyle } from "@/components/builder/class-step-rail/choice-card-fighting-style";

function styleEntry(slug: string, name: string, description?: string): ContentEntry {
  return {
    id: `style-${slug}`,
    slug,
    name,
    content_type: "feature",
    data: { feature_type: "fighting_style", description },
    effects: [],
    version: 1,
    source: "srd",
  };
}

describe("ChoiceCardFightingStyle", () => {
  it("renders style options stripped of the 'Fighting Style: ' prefix", () => {
    render(
      <ChoiceCardFightingStyle
        featureSlug="fighter-fighting-style"
        classSlug="fighter"
        styleOptions={[
          styleEntry("fs-archery", "Fighting Style: Archery"),
          styleEntry("fs-defense", "Fighting Style: Defense"),
        ]}
        currentStyleSlug={undefined}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Archery")).toBeInTheDocument();
    expect(screen.getByText("Defense")).toBeInTheDocument();
  });

  it("shows 'Chosen' when a style is selected", () => {
    render(
      <ChoiceCardFightingStyle
        featureSlug="fighter-fighting-style"
        classSlug="fighter"
        styleOptions={[styleEntry("fs-archery", "Fighting Style: Archery")]}
        currentStyleSlug="fs-archery"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Chosen")).toBeInTheDocument();
  });

  it("calls onSelect with the style slug + class slug when a style is picked", () => {
    const onSelect = vi.fn();
    render(
      <ChoiceCardFightingStyle
        featureSlug="fighter-fighting-style"
        classSlug="fighter"
        styleOptions={[styleEntry("fs-archery", "Fighting Style: Archery")]}
        currentStyleSlug={undefined}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Archery/i }));
    expect(onSelect).toHaveBeenCalledWith("fighter-fighting-style", "fighter", "fs-archery");
  });
});
```

- [ ] **Step 2: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "ChoiceCardFightingStyle"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement.**

```tsx
// components/builder/class-step-rail/choice-card-fighting-style.tsx
"use client";

import { cn } from "@/lib/utils";
import type { ContentEntry } from "@/components/builder/content-browser";

interface ChoiceCardFightingStyleProps {
  featureSlug: string;
  classSlug: string;
  styleOptions: ContentEntry[];
  currentStyleSlug: string | undefined;
  onSelect: (featureSlug: string, classSlug: string, styleSlug: string | undefined) => void;
}

export function ChoiceCardFightingStyle({
  featureSlug,
  classSlug,
  styleOptions,
  currentStyleSlug,
  onSelect,
}: ChoiceCardFightingStyleProps) {
  const isMade = !!currentStyleSlug;

  return (
    <article className="rounded-md border border-border bg-card/40 p-4">
      <header className="flex items-center justify-between gap-3 mb-3">
        <h4 className="text-sm font-medium">Fighting Style</h4>
        <span
          aria-label={isMade ? "Choice made" : "Choice not yet made"}
          className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide",
            isMade ? "bg-accent/15 text-accent" : "bg-destructive/15 text-destructive",
          )}
        >
          {isMade ? "Chosen" : "Choose"}
        </span>
      </header>

      {styleOptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No fighting styles available.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {styleOptions.map((style) => {
            const data = style.data as Record<string, unknown>;
            const description = typeof data.description === "string" ? data.description : null;
            const displayName = style.name.replace(/^Fighting Style:\s*/, "");
            const selected = currentStyleSlug === style.slug;
            return (
              <button
                key={style.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(featureSlug, classSlug, style.slug)}
                className={cn(
                  "text-left rounded-md border bg-card/30 px-3 py-3 transition-colors",
                  "border-border hover:border-accent/50",
                  selected && "border-accent bg-accent/10",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <p className="text-sm font-medium">{displayName}</p>
                {description && (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-3">{description}</p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
}
```

- [ ] **Step 4: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "ChoiceCardFightingStyle"`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit.**

```bash
git add components/builder/class-step-rail/choice-card-fighting-style.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "feat(builder): ChoiceCardFightingStyle rebuilt for class step rail"
```

---

## Task 7 — `<AddClassRow>` (locked state)

**Files:**
- Create: `components/builder/class-step-rail/add-class-row.tsx`
- Test: append to `tests/components/builder/class-step-rail.test.tsx`

The locked-state row shows a lock icon, "Add a class · Locked" text, and an inline reason hinting at multiclass prereqs. PR-B always renders it locked.

- [ ] **Step 1: Append failing tests.**

```tsx
import { AddClassRow } from "@/components/builder/class-step-rail/add-class-row";

describe("AddClassRow", () => {
  it("renders the locked label and reasons text", () => {
    render(<AddClassRow reasons={["Requires CHA 13 for Bard", "Requires INT 13 for Wizard"]} />);
    expect(screen.getByText(/Add a class · Locked/i)).toBeInTheDocument();
    expect(screen.getByText(/Requires CHA 13 for Bard/i)).toBeInTheDocument();
  });

  it("is aria-disabled and click is a no-op", () => {
    render(<AddClassRow reasons={["Requires CHA 13 for Bard"]} />);
    const btn = screen.getByRole("button", { name: /Add a class/i });
    expect(btn).toHaveAttribute("aria-disabled", "true");
    // Clicking does nothing observable — just confirm no error and no state change.
    fireEvent.click(btn);
    expect(btn).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "AddClassRow"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement.**

```tsx
// components/builder/class-step-rail/add-class-row.tsx
import { Lock } from "lucide-react";

interface AddClassRowProps {
  reasons: string[];
}

export function AddClassRow({ reasons }: AddClassRowProps) {
  const reasonText = reasons.slice(0, 3).join(" · ");
  return (
    <button
      type="button"
      aria-disabled="true"
      aria-describedby="add-class-reason"
      title={reasons.join("\n")}
      className="w-full rounded-md border border-dashed border-muted px-3 py-2 text-left transition-colors cursor-not-allowed"
      onClick={(e) => e.preventDefault()}
    >
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="size-3.5" aria-hidden="true" />
        <span>Add a class · Locked</span>
      </span>
      {reasonText && (
        <p id="add-class-reason" className="mt-1 text-[11px] leading-relaxed text-muted-foreground/70">
          {reasonText}
        </p>
      )}
    </button>
  );
}
```

- [ ] **Step 4: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "AddClassRow"`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit.**

```bash
git add components/builder/class-step-rail/add-class-row.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "feat(builder): AddClassRow (locked state) for class step rail"
```

---

## Task 8 — `<LevelRail>` (per-class section)

**Files:**
- Create: `components/builder/class-step-rail/level-rail.tsx`
- Test: append to `tests/components/builder/class-step-rail.test.tsx`

- [ ] **Step 1: Append failing tests.**

```tsx
import { LevelRail } from "@/components/builder/class-step-rail/level-rail";
import type { PerLevel } from "@/lib/builder/class-features-per-level";

function makePerLevel(): PerLevel[] {
  return [
    { level: 1, features: [], choices: [] },
    {
      level: 3,
      features: [],
      choices: [
        { type: "subclass", classSlug: "paladin", label: "Sacred Oath", isMade: false },
      ],
    },
    {
      level: 4,
      features: [],
      choices: [
        { type: "asi", featureSlug: "paladin-asi-4", classSlug: "paladin", label: "Ability Score Improvement", isMade: true },
      ],
    },
  ];
}

describe("LevelRail", () => {
  it("renders one pill per level row", () => {
    render(
      <LevelRail
        classSlug="paladin"
        className_={"Paladin"}
        subclassName={undefined}
        currentLevel={4}
        perLevel={makePerLevel()}
        activeLevel={1}
        onSelectLevel={vi.fn()}
        onLevelChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /level 1/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /level 3/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /level 4/i })).toBeInTheDocument();
  });

  it("shows the unmade-choice red dot only on rows with isMade=false", () => {
    render(
      <LevelRail
        classSlug="paladin"
        className_={"Paladin"}
        subclassName={undefined}
        currentLevel={4}
        perLevel={makePerLevel()}
        activeLevel={1}
        onSelectLevel={vi.fn()}
        onLevelChange={vi.fn()}
      />,
    );
    // Level 3 has unmade subclass → dot present
    // Level 4 has made ASI → dot absent
    const indicators = screen.getAllByLabelText("Has unmade choice");
    expect(indicators.length).toBe(1);
  });

  it("calls onSelectLevel when a pill is clicked", () => {
    const onSelectLevel = vi.fn();
    render(
      <LevelRail
        classSlug="paladin"
        className_={"Paladin"}
        subclassName={undefined}
        currentLevel={4}
        perLevel={makePerLevel()}
        activeLevel={1}
        onSelectLevel={onSelectLevel}
        onLevelChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /level 3/i }));
    expect(onSelectLevel).toHaveBeenCalledWith(3);
  });

  it("calls onLevelChange with parsed integer when the level dropdown changes", () => {
    const onLevelChange = vi.fn();
    render(
      <LevelRail
        classSlug="paladin"
        className_={"Paladin"}
        subclassName={undefined}
        currentLevel={4}
        perLevel={makePerLevel()}
        activeLevel={1}
        onSelectLevel={vi.fn()}
        onLevelChange={onLevelChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("Set level for Paladin"), { target: { value: "6" } });
    expect(onLevelChange).toHaveBeenCalledWith(6);
  });
});
```

Note: prop name `className_` (with trailing underscore) is intentional to avoid colliding with React's reserved `className`.

- [ ] **Step 2: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "LevelRail"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement.**

```tsx
// components/builder/class-step-rail/level-rail.tsx
"use client";

import { ClassEmblem } from "@/components/builder/class-emblem";
import { LevelPill } from "@/components/builder/class-step-rail/level-pill";
import type { PerLevel } from "@/lib/builder/class-features-per-level";

interface LevelRailProps {
  classSlug: string;
  className_: string;
  subclassName: string | undefined;
  currentLevel: number;
  perLevel: PerLevel[];
  activeLevel: number;
  onSelectLevel: (level: number) => void;
  onLevelChange: (newLevel: number) => void;
}

function summarizeLevel(row: PerLevel): string {
  if (row.choices.length > 0) return row.choices[0].label;
  if (row.features.length === 1) return row.features[0].name;
  if (row.features.length > 1) return `${row.features.length} features`;
  return `Level ${row.level}`;
}

export function LevelRail({
  classSlug,
  className_,
  subclassName,
  currentLevel,
  perLevel,
  activeLevel,
  onSelectLevel,
  onLevelChange,
}: LevelRailProps) {
  return (
    <section className="space-y-2">
      <header className="flex items-center gap-2 px-2 py-1.5">
        <ClassEmblem slug={classSlug} name={className_} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{className_}</p>
          {subclassName && (
            <p className="text-[11px] text-muted-foreground truncate">{subclassName}</p>
          )}
        </div>
        <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <span className="sr-only">Set level for {className_}</span>
          <select
            aria-label={`Set level for ${className_}`}
            value={currentLevel}
            onChange={(e) => onLevelChange(parseInt(e.target.value, 10))}
            className="h-6 rounded-md border border-input bg-background px-1.5 text-xs"
          >
            {Array.from({ length: 20 }, (_, i) => i + 1).map((lvl) => (
              <option key={lvl} value={lvl}>{lvl}</option>
            ))}
          </select>
        </label>
      </header>

      <div className="flex flex-col gap-1">
        {perLevel.map((row) => (
          <LevelPill
            key={row.level}
            level={row.level}
            summary={summarizeLevel(row)}
            hasUnmadeChoice={row.choices.some((c) => !c.isMade)}
            active={activeLevel === row.level}
            onClick={() => onSelectLevel(row.level)}
          />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "LevelRail"`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit.**

```bash
git add components/builder/class-step-rail/level-rail.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "feat(builder): LevelRail (per-class section)"
```

---

## Task 9 — `<ClassLevelPane>` (main pane)

**Files:**
- Create: `components/builder/class-step-rail/class-level-pane.tsx`
- Test: append to `tests/components/builder/class-step-rail.test.tsx`

`ClassLevelPane` receives the active class + level row and decides which cards to render. It owns the title selection logic from the spec ("Title rules in `<ClassLevelPane>`").

- [ ] **Step 1: Append failing tests.**

```tsx
import { ClassLevelPane } from "@/components/builder/class-step-rail/class-level-pane";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { PerLevel } from "@/lib/builder/class-features-per-level";

function f(slug: string, name: string, description?: string): ContentEntry {
  return {
    id: `f-${slug}`,
    slug,
    name,
    content_type: "feature",
    data: { description },
    effects: [],
    version: 1,
    source: "srd",
  };
}

const noopHandlers = {
  onAsiSelect: vi.fn(),
  onSubclassSelect: vi.fn(),
  onFightingStyleSelect: vi.fn(),
};

describe("ClassLevelPane", () => {
  it("titles the pane after the choice when present", () => {
    const row: PerLevel = {
      level: 3,
      features: [f("divine-health", "Divine Health"), f("oath-spells", "Oath Spells")],
      choices: [{ type: "subclass", classSlug: "paladin", label: "Sacred Oath", isMade: false }],
    };
    render(
      <ClassLevelPane
        classSlug="paladin"
        className_={"Paladin"}
        classIndex={0}
        row={row}
        subclasses={[]}
        styleOptions={[]}
        localChoices={{}}
        currentSubclass={undefined}
        {...noopHandlers}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Sacred Oath" })).toBeInTheDocument();
  });

  it("titles the pane after the single feature when there are no choices", () => {
    const row: PerLevel = {
      level: 1,
      features: [f("divine-sense", "Divine Sense", "Detect celestials.")],
      choices: [],
    };
    render(
      <ClassLevelPane
        classSlug="paladin"
        className_={"Paladin"}
        classIndex={0}
        row={row}
        subclasses={[]}
        styleOptions={[]}
        localChoices={{}}
        currentSubclass={undefined}
        {...noopHandlers}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Divine Sense" })).toBeInTheDocument();
  });

  it("falls back to 'Level N' for multi-feature levels with no choices", () => {
    const row: PerLevel = {
      level: 3,
      features: [f("divine-health", "Divine Health"), f("channel-divinity", "Channel Divinity")],
      choices: [],
    };
    render(
      <ClassLevelPane
        classSlug="paladin"
        className_={"Paladin"}
        classIndex={0}
        row={row}
        subclasses={[]}
        styleOptions={[]}
        localChoices={{}}
        currentSubclass={undefined}
        {...noopHandlers}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Level 3" })).toBeInTheDocument();
  });

  it("renders feature cards and choice cards together", () => {
    const row: PerLevel = {
      level: 4,
      features: [f("divine-health", "Divine Health")],
      choices: [{ type: "asi", featureSlug: "paladin-asi-4", classSlug: "paladin", label: "Ability Score Improvement", isMade: false }],
    };
    render(
      <ClassLevelPane
        classSlug="paladin"
        className_={"Paladin"}
        classIndex={0}
        row={row}
        subclasses={[]}
        styleOptions={[]}
        localChoices={{}}
        currentSubclass={undefined}
        {...noopHandlers}
      />,
    );
    expect(screen.getByText("Divine Health")).toBeInTheDocument();
    expect(screen.getByText("Ability Score Improvement")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "ClassLevelPane"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement.**

```tsx
// components/builder/class-step-rail/class-level-pane.tsx
"use client";

import { ClassEmblem } from "@/components/builder/class-emblem";
import { FeatureCard } from "@/components/builder/class-step-rail/feature-card";
import { ChoiceCardASI } from "@/components/builder/class-step-rail/choice-card-asi";
import { ChoiceCardSubclass } from "@/components/builder/class-step-rail/choice-card-subclass";
import { ChoiceCardFightingStyle } from "@/components/builder/class-step-rail/choice-card-fighting-style";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { PerLevel } from "@/lib/builder/class-features-per-level";
import type { CharacterChoices, AsiChoice } from "@/lib/types/character";

interface ClassLevelPaneProps {
  classSlug: string;
  className_: string;
  classIndex: number;
  row: PerLevel;
  subclasses: ContentEntry[];
  styleOptions: ContentEntry[];
  localChoices: CharacterChoices;
  currentSubclass: string | undefined;
  onAsiSelect: (featureSlug: string, choice: AsiChoice) => void;
  onSubclassSelect: (classSlug: string, classIndex: number, subclassSlug: string | undefined) => void;
  onFightingStyleSelect: (featureSlug: string, classSlug: string, styleSlug: string | undefined) => void;
}

function paneTitle(row: PerLevel): string {
  if (row.choices.length > 0) return row.choices[0].label;
  if (row.features.length === 1) return row.features[0].name;
  return `Level ${row.level}`;
}

export function ClassLevelPane({
  classSlug,
  className_,
  classIndex,
  row,
  subclasses,
  styleOptions,
  localChoices,
  currentSubclass,
  onAsiSelect,
  onSubclassSelect,
  onFightingStyleSelect,
}: ClassLevelPaneProps) {
  const title = paneTitle(row);

  return (
    <section aria-labelledby="class-level-title" className="space-y-4">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted-foreground">
        <ClassEmblem slug={classSlug} name={className_} size="sm" />
        <span>{className_}</span>
        <span aria-hidden="true">›</span>
        <span>Level {row.level}</span>
      </nav>

      <h2 id="class-level-title" className="text-2xl font-semibold text-accent">
        {title}
      </h2>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          What this level grants
        </h3>
        <div className="space-y-2">
          {row.features.map((feature) => (
            <FeatureCard key={feature.id} feature={feature} />
          ))}
          {row.choices.map((choice, idx) => {
            if (choice.type === "asi") {
              return (
                <ChoiceCardASI
                  key={`${choice.type}-${idx}`}
                  featureSlug={choice.featureSlug!}
                  currentChoice={localChoices.asi_choices?.[choice.featureSlug!]}
                  onSelect={(c) => onAsiSelect(choice.featureSlug!, c)}
                />
              );
            }
            if (choice.type === "subclass") {
              return (
                <ChoiceCardSubclass
                  key={`${choice.type}-${idx}`}
                  classSlug={classSlug}
                  subclasses={subclasses}
                  currentSelection={currentSubclass}
                  onSelect={(slug) => onSubclassSelect(classSlug, classIndex, slug)}
                  label={choice.label}
                />
              );
            }
            if (choice.type === "fighting-style") {
              const currentStyle = localChoices.resolved_choices?.[choice.featureSlug!]?.[0];
              return (
                <ChoiceCardFightingStyle
                  key={`${choice.type}-${idx}`}
                  featureSlug={choice.featureSlug!}
                  classSlug={classSlug}
                  styleOptions={styleOptions}
                  currentStyleSlug={currentStyle}
                  onSelect={onFightingStyleSelect}
                />
              );
            }
            return null;
          })}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "ClassLevelPane"`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit.**

```bash
git add components/builder/class-step-rail/class-level-pane.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "feat(builder): ClassLevelPane main pane component"
```

---

## Task 10 — `<ClassStepRail>` root + integration tests

**Files:**
- Create: `components/builder/class-step-rail/index.tsx`
- Test: append to `tests/components/builder/class-step-rail.test.tsx`

The root holds `selectedKey` state ({classIndex, level}), iterates `selectedClasses` to render N rails, and renders the ClassLevelPane for whichever (class, level) is active.

- [ ] **Step 1: Append failing tests.**

```tsx
import { ClassStepRail } from "@/components/builder/class-step-rail";

function classEntry(slug: string, name: string, levels: Array<{ level: number; features: string[] }>): ContentEntry {
  return {
    id: `c-${slug}`,
    slug,
    name,
    content_type: "class",
    data: { hit_die: 10, levels },
    effects: [],
    version: 1,
    source: "srd",
  };
}

describe("ClassStepRail", () => {
  function setup(overrides: Partial<Parameters<typeof ClassStepRail>[0]> = {}) {
    const handlers = {
      onLevelChange: vi.fn(),
      onRemoveClass: vi.fn(),
      onSubclassSelect: vi.fn(),
      onAsiSelect: vi.fn(),
      onFightingStyleSelect: vi.fn(),
      onChoiceSelect: vi.fn(),
    };
    const props = {
      classes: [
        classEntry("paladin", "Paladin", [
          { level: 1, features: ["divine-sense"] },
          { level: 2, features: [] },
          { level: 3, features: ["sacred-oath"] },
        ]),
      ],
      subclasses: [],
      features: [
        { id: "f1", slug: "divine-sense", name: "Divine Sense", content_type: "feature", data: { level: 1, class: "paladin" }, effects: [], version: 1, source: "srd" } as ContentEntry,
        { id: "f2", slug: "sacred-oath", name: "Sacred Oath", content_type: "feature", data: { level: 3, class: "paladin", feature_type: "subclass" }, effects: [], version: 1, source: "srd" } as ContentEntry,
      ],
      selectedClasses: [{ slug: "paladin", level: 3 }],
      localChoices: {} as CharacterChoices,
      contentRefs: [],
      ...handlers,
      ...overrides,
    };
    const utils = render(<ClassStepRail {...props} />);
    return { ...utils, ...handlers, props };
  }

  it("renders one rail per selected class and an AddClassRow", () => {
    setup();
    expect(screen.getByRole("button", { name: /level 1/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /level 3/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add a class/i })).toBeInTheDocument();
  });

  it("starts with the highest level of the (only) class as the active level", () => {
    setup();
    // Level 3's pill should be aria-current=true.
    const lv3Pill = screen.getByRole("button", { name: /level 3/i });
    expect(lv3Pill).toHaveAttribute("aria-current", "true");
  });

  it("switches the main pane content when a different level pill is clicked", () => {
    setup();
    // Initially: Sacred Oath title (lv 3 has subclass choice).
    expect(screen.getByRole("heading", { level: 2, name: "Sacred Oath" })).toBeInTheDocument();
    // Click Lv 1 → title becomes "Divine Sense".
    fireEvent.click(screen.getByRole("button", { name: /level 1/i }));
    expect(screen.getByRole("heading", { level: 2, name: "Divine Sense" })).toBeInTheDocument();
  });

  it("forwards onLevelChange with the right classIndex when the level dropdown changes", () => {
    const { onLevelChange } = setup();
    fireEvent.change(screen.getByLabelText("Set level for Paladin"), { target: { value: "5" } });
    expect(onLevelChange).toHaveBeenCalledWith(0, 5);
  });

  it("renders multiple class sections for a multiclass character", () => {
    setup({
      classes: [
        classEntry("barbarian", "Barbarian", [{ level: 1, features: [] }]),
        classEntry("fighter", "Fighter", [{ level: 1, features: [] }]),
      ],
      selectedClasses: [
        { slug: "barbarian", level: 10 },
        { slug: "fighter", level: 5 },
      ],
    });
    expect(screen.getByText("Barbarian")).toBeInTheDocument();
    expect(screen.getByText("Fighter")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "ClassStepRail"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement.**

```tsx
// components/builder/class-step-rail/index.tsx
"use client";

import { useState } from "react";
import { LevelRail } from "@/components/builder/class-step-rail/level-rail";
import { ClassLevelPane } from "@/components/builder/class-step-rail/class-level-pane";
import { AddClassRow } from "@/components/builder/class-step-rail/add-class-row";
import { Separator } from "@/components/ui/separator";
import { classFeaturesPerLevel } from "@/lib/builder/class-features-per-level";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { CharacterChoices, AsiChoice } from "@/lib/types/character";

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
  contentRefs: Array<{
    id: string;
    content_definitions?: { slug: string; content_type: string };
  }>;
  onLevelChange: (classIndex: number, newLevel: number) => Promise<void> | void;
  onRemoveClass: (classIndex: number) => Promise<void> | void;
  onSubclassSelect: (classSlug: string, classIndex: number, subclassSlug: string | undefined) => Promise<void> | void;
  onAsiSelect: (featureSlug: string, choice: AsiChoice) => Promise<void> | void;
  onFightingStyleSelect: (featureSlug: string, classSlug: string, styleSlug: string | undefined) => Promise<void> | void;
  onChoiceSelect: (choiceId: string, selections: string[]) => Promise<void> | void;
}

interface SelectedKey {
  classIndex: number;
  level: number;
}

const MULTICLASS_PREREQS = [
  "Requires CHA 13 for Bard / Sorcerer / Warlock",
  "Requires INT 13 for Wizard",
  "Requires WIS 13 for Cleric / Druid / Ranger",
  "Requires STR 13 for Barbarian / Paladin",
  "Requires DEX 13 for Rogue",
];

export function ClassStepRail(props: ClassStepRailProps) {
  const {
    classes,
    subclasses,
    features,
    selectedClasses,
    localChoices,
    onLevelChange,
    onSubclassSelect,
    onAsiSelect,
    onFightingStyleSelect,
  } = props;

  const initialClassIndex = 0;
  const initialLevel = selectedClasses[0]?.level ?? 1;
  const [selected, setSelected] = useState<SelectedKey>({
    classIndex: initialClassIndex,
    level: initialLevel,
  });

  const activeClass = selectedClasses[selected.classIndex];
  const activeClassContent = activeClass ? classes.find((c) => c.slug === activeClass.slug) : undefined;
  const activeSubclassContent = activeClass?.subclass
    ? subclasses.find((sc) => sc.slug === activeClass.subclass) ?? null
    : null;

  const activePerLevel = activeClassContent
    ? classFeaturesPerLevel({
        classContent: activeClassContent,
        features,
        subclassContent: activeSubclassContent,
        characterChoices: localChoices,
        classIndex: selected.classIndex,
      })
    : [];

  const activeRow = activePerLevel.find((r) => r.level === selected.level);

  // Style options for any class — used by ClassLevelPane when rendering a Fighting Style choice card.
  const styleOptionsForActiveClass = activeClass
    ? features.filter((f) => {
        const data = f.data as Record<string, unknown>;
        return (
          data.class === activeClass.slug &&
          data.feature_type === "fighting_style" &&
          f.name !== "Fighting Style"
        );
      })
    : [];

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
          return (
            <LevelRail
              key={`${cls.slug}-${idx}`}
              classSlug={cls.slug}
              className_={classContent.name}
              subclassName={subclassContent?.name}
              currentLevel={cls.level}
              perLevel={perLevel.filter((r) => r.level <= cls.level)}
              activeLevel={selected.classIndex === idx ? selected.level : -1}
              onSelectLevel={(level) => setSelected({ classIndex: idx, level })}
              onLevelChange={(newLevel) => onLevelChange(idx, newLevel)}
            />
          );
        })}
        <Separator />
        <AddClassRow reasons={MULTICLASS_PREREQS} />
      </aside>

      <main className="min-w-0">
        {activeRow && activeClass && activeClassContent ? (
          <ClassLevelPane
            classSlug={activeClass.slug}
            className_={activeClassContent.name}
            classIndex={selected.classIndex}
            row={activeRow}
            subclasses={subclasses}
            styleOptions={styleOptionsForActiveClass}
            localChoices={localChoices}
            currentSubclass={activeClass.subclass}
            onAsiSelect={onAsiSelect}
            onSubclassSelect={onSubclassSelect}
            onFightingStyleSelect={onFightingStyleSelect}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No class data for the selected level.</p>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx`
Expected: PASS — all tests.

- [ ] **Step 5: Commit.**

```bash
git add components/builder/class-step-rail/index.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "feat(builder): ClassStepRail root component"
```

---

## Task 11 — Wire `<ClassStepRail>` into `class-step-client.tsx`

**Files:**
- Modify: `app/(app)/characters/[id]/builder/class/class-step-client.tsx`

The "has class" branch (currently rendering an Accordion-backed Card per class plus a bottom multiclass `<ContentBrowser>`) is replaced with `<ClassStepRail>`. The "no class" branch stays.

- [ ] **Step 1: Replace the class-related imports.**

In `class-step-client.tsx` find this block:

```tsx
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ContentBrowser, type ContentEntry } from "@/components/builder/content-browser";
import { ContentPreview } from "@/components/builder/content-preview";
import { ChoiceSelector } from "@/components/builder/choice-selector";
import { SubclassSelector } from "@/components/builder/subclass-selector";
import { AsiSelector } from "@/components/builder/asi-selector";
```

(Note: `ContentPreview` was already removed in PR-A's integration; the actual current file has `ClassPreviewModal` instead. Adapt the find/replace to the current file content.)

Replace with:

```tsx
import { ContentBrowser, type ContentEntry } from "@/components/builder/content-browser";
import { ClassPreviewModal } from "@/components/builder/class-preview-modal";
import { ClassStepRail } from "@/components/builder/class-step-rail";
```

Remove imports for `Accordion`, `AccordionContent`, `AccordionItem`, `AccordionTrigger`, `Badge`, `Separator`, `ChoiceSelector`, `SubclassSelector`, `AsiSelector` from the top of the file. They are no longer used.

> Note: `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Button` may still be used by other parts of the file (e.g., the "no class" branch's wrapping or the Previous/Next buttons). Keep them.

- [ ] **Step 2: Delete the helper functions that are now unused.**

Delete `getFeatureType`, `getFeaturesForClass`, and `getFightingStyleOptions` from the file body — they are no longer used because the rail computes its own per-level data.

- [ ] **Step 3: Replace the "has class" branch JSX.**

Find the `{hasClass ? (...) : (...)}` ternary in the JSX. Replace the `hasClass`-true branch (the `<div className="space-y-4">...</div>` containing the per-class `<Card>` and the bottom multiclass `<ContentBrowser>`) with:

```tsx
{hasClass ? (
  <ClassStepRail
    classes={classes}
    subclasses={subclasses}
    features={features}
    selectedClasses={selectedClasses}
    localChoices={localChoices}
    contentRefs={contentRefs}
    onLevelChange={handleLevelChange}
    onRemoveClass={handleRemoveClass}
    onSubclassSelect={handleSubclassSelect}
    onAsiSelect={handleAsiSelect}
    onFightingStyleSelect={handleFightingStyleSelect}
    onChoiceSelect={handleChoiceSelect}
  />
) : (
  <ContentBrowser
    entries={classes}
    contentTypeLabel="Class"
    onSelect={setPreviewContent}
  />
)}
```

The `<ClassPreviewModal>` block already exists below the ternary (from PR-A); leave it untouched.

- [ ] **Step 4: Run the build to confirm clean compilation.**

Run: `npm run build 2>&1 | tail -10`
Expected: clean build (no TypeScript errors).

- [ ] **Step 5: Run the full test suite.**

Run: `npm test -- --run 2>&1 | tail -10`
Expected: all suites green. The class-step-client itself has no direct tests; rail tests carry the new behavior coverage.

- [ ] **Step 6: Commit.**

```bash
git add app/\(app\)/characters/\[id\]/builder/class/class-step-client.tsx
git commit -m "feat(builder): swap class step has-class branch to ClassStepRail"
```

---

## Task 12 — Browser smoke test

**Files:** verification only.

- [ ] **Step 1: Confirm preview server is running.**

Run: `mcp__Claude_Preview__preview_list`. Note the `serverId` for `inkborne-dev`.

- [ ] **Step 2: Navigate to Voltee's class step.**

Voltee's id is `f453f7dc-37fe-44fa-b0a7-399c9eea7f9b` (single-class Wizard L1).

```js
window.location.href = "http://localhost:3000/characters/f453f7dc-37fe-44fa-b0a7-399c9eea7f9b/builder/class"
```

Take a snapshot and confirm:
- The sidebar shows "Wizard" header + a single Lv 1 pill + AddClassRow at the bottom (locked).
- The main pane shows the Lv 1 features.

- [ ] **Step 3: Bump Voltee to Lv 3 via the level dropdown.**

```js
const select = document.querySelector('select[aria-label="Set level for Wizard"]');
const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
setter.call(select, "3");
select.dispatchEvent(new Event('change', { bubbles: true }));
```

Confirm the rail now shows pills 1, 2, 3 and the main pane reflects the new active level.

- [ ] **Step 4: Click Lv 2 pill → main pane updates.**

```js
const lv2 = Array.from(document.querySelectorAll('button')).find(b => /^Level 2:/i.test(b.getAttribute('aria-label') ?? ''));
lv2.click();
```

Confirm the main pane title and content swap.

- [ ] **Step 5: Test multiclass rendering with Xero (Barbarian 10 / Fighter 5).**

Navigate to Xero's class step. Confirm:
- Two class sections in the sidebar (Barbarian + Fighter), each with their own pills and level dropdown.
- Selecting a Fighter level pill switches the main pane to a Fighter level (not a Barbarian level).
- AddClassRow at the bottom is still locked.

- [ ] **Step 6: Restore Voltee to Lv 1.**

```js
const select = document.querySelector('select[aria-label="Set level for Wizard"]');
const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
setter.call(select, "1");
select.dispatchEvent(new Event('change', { bubbles: true }));
```

(Native confirm dialog will fire — accept it.)

- [ ] **Step 7: Confirm console is clean.**

```
mcp__Claude_Preview__preview_console_logs serverId=<id> level=error
```

Expected: no new errors introduced by the rail.

---

## Task 13 — Open the PR

- [ ] **Step 1: Final test + build.**

Run: `npm test -- --run 2>&1 | tail -5 && npm run build 2>&1 | tail -5`
Expected: tests green; clean build.

- [ ] **Step 2: Push the branch.**

```bash
git push -u origin feat/class-step-rail
```

- [ ] **Step 3: Open the PR.**

```bash
gh pr create --base main --title "feat(builder): class step rail (Variant C, single-class)" --body "$(cat <<'EOF'
## Summary
Implements **PR-B of M2 Builder UX Polish**: replaces the existing accordion-style class step "has class" branch with the design team's Variant C layout — sidebar of level pills + main pane showing the selected level's content.

Single-class only; multiclass *adds* are gated by a locked AddClassRow. Existing multiclass characters render correctly via N rail sections (one per class). PR-C will unlock the multiclass picker.

Spec: [docs/superpowers/specs/2026-04-27-class-step-rail-design.md](docs/superpowers/specs/2026-04-27-class-step-rail-design.md). Plan: [docs/superpowers/plans/2026-04-27-class-step-rail.md](docs/superpowers/plans/2026-04-27-class-step-rail.md).

## What changed
- New `lib/builder/class-features-per-level.ts` — pure helper that returns `PerLevel[]` (features + choices) for a class+subclass combo. Walks merged class + subclass `data.levels[]`. Tested.
- New `components/builder/class-step-rail/` — root `<ClassStepRail>` + `<LevelRail>` + `<LevelPill>` + `<ClassLevelPane>` + `<FeatureCard>` + `<ChoiceCardASI>` + `<ChoiceCardSubclass>` + `<ChoiceCardFightingStyle>` + `<AddClassRow>`. All choice cards rebuilt fresh per design (not wrapping legacy selectors).
- Reuses `<ClassEmblem>` and `lib/builder/class-tone.ts` from PR-A.
- One-file integration in `class-step-client.tsx`: swaps the "has class" branch for `<ClassStepRail>`. Existing handlers are forwarded unchanged.
- Legacy `<AsiSelector>` / `<SubclassSelector>` / `<ChoiceSelector>` components remain in the codebase but are no longer imported in this step. A separate cleanup PR can delete them once we confirm no other call sites.

## Test plan
- [x] `npm test` — all suites green; ~30 new tests across the rail + helper.
- [x] `npm run build` — clean.
- [x] Browser smoke (Voltee + Xero):
  - Single-class rendering on Voltee.
  - Multiclass rendering on Xero (two class sections).
  - Level pill click switches main pane.
  - Level dropdown change calls existing `handleLevelChange`.
  - AddClassRow is visibly locked with prereq reasons.

## Out of scope (future PRs)
- Multiclass picker panel + class section grouping (`+ Add a class` unlock + Character pin) — **PR-C**.
- In-rail "+ Level up" button + NEW LEVEL ribbon + cancel-level-up flow — **PR-D**.
- Mobile bottom-sheet treatment — **PR-E**.
- Character primary color carry-through — **PR-F**.
- Replacing native `confirm()` with shadcn AlertDialog for level shrink — polish PR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Wait for review. Address feedback in follow-up commits on the same branch; rebase only if requested.**

---

## Notes for the implementer

- **`ContentEntry`** is exported from `components/builder/content-browser.tsx`. Always import it from there (not duplicated).
- **`@base-ui/react/dialog` and `@base-ui/react/tabs`** are not used in this PR — the rail is a plain layout, no portals.
- **The `className_` prop** (with trailing underscore) is intentional on `LevelRail` and `ClassLevelPane` — `className` is reserved by React for CSS classes on host elements.
- **Existing handler signatures** (`handleLevelChange(classIndex, newLevel)`, `handleSubclassSelect(classSlug, classIndex, subclassSlug)`, `handleAsiSelect(featureSlug, choice)`, `handleFightingStyleSelect(featureSlug, classSlug, styleSlug)`) — these are the EXACT signatures called by the rail. Don't refactor them in this PR.
- **The "shrink-and-discard" confirm** for the level dropdown: native `confirm()` is fine for v1. The rail does not implement the dialog itself — it just calls `onLevelChange(idx, newLevel)`. The parent's `handleLevelChange` decides whether to prompt. (Currently the parent doesn't prompt, but that's a pre-existing gap unrelated to this PR.)
- **CRLF on Windows**: the repo's `.gitattributes` already forces LF for the new files via project-wide rules. No new attribute additions needed.
- **One commit per task.** Per-task commits keep PR review tractable and let bisect pinpoint regressions.
