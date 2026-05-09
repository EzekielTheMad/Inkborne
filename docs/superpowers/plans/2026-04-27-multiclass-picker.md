# Multiclass Picker (PR-C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Model + review guidance for the dispatcher:**
> - Tasks 1–4 (atomic helpers / components) → `haiku`, **single combined review** (skip the planning-stage review).
> - Tasks 5–6 (integration: rail wire-up + class-step-client engine wiring) → `sonnet`, **two-stage review** (planning + impl) — these are the integration boundaries where regressions hurt.
> - Task 7 (manual verification + ship) → main-thread, no subagent.

**Goal:** Unlock the multiclass *add* path. `<AddClassRow>` becomes conditionally pickable based on resolved ability scores. Click → `<ClassPickerPanel>` replaces the main pane with a 3×4 grid of class cards. Click a `met` card → existing PR-A `<ClassPreviewModal>` opens. Modal Pick → existing `handleSelectClass` adds the class.

**Architecture:** New pure helper (`multiclass-prereqs.ts`) maps each class slug to its SRD prereq spec and computes per-class state (`met` / `not-met` / `already-in-build`) from resolved stats + selected classes. Two new components (`<ClassPickerCard>`, `<ClassPickerPanel>`) render the grid. `<ClassStepRail>` gains rail-local `showPicker` state and two new props (`resolvedStats`, `onAddClass`). `class-step-client.tsx` runs the engine to compute `resolvedStats` and wires `onAddClass={setPreviewContent}` to reuse the existing PR-A modal flow. The picker stays open behind the modal; only modal Pick (which increments `selectedClasses.length`) closes it.

**Tech Stack:** Next.js 16 App Router (client component), TypeScript strict, Tailwind v4 with HSL tokens, vitest + `@testing-library/react`. Reuses `<ClassEmblem>` and `lib/builder/class-tone.ts` from PR-A; reuses `<ClassPreviewModal>` flow from PR-A; reuses PR-B's `<ClassStepRail>`/`<AddClassRow>` and the engine evaluator from `lib/engine/evaluator.ts`.

**Spec:** [`docs/superpowers/specs/2026-04-27-multiclass-picker-design.md`](../specs/2026-04-27-multiclass-picker-design.md). Source design files: [`docs/design-briefs/builder-ux-polish-design-files/`](../../design-briefs/builder-ux-polish-design-files/).

**Branch base:** `fix/class-step-rail-regressions` (PR #41, stacked on PR #40 / `feat/class-step-rail`). Branch name: `feat/multiclass-picker`. Will rebase onto `main` after PR #40 + #41 merge.

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `lib/builder/multiclass-prereqs.ts` | Create | Pure helper. Hardcoded `MULTICLASS_PREREQ_TABLE`. `evaluateMulticlassPrereq(slug, resolvedStats, selectedClasses)` + `multiclassPrereqsForAll(...)`. |
| `tests/lib/builder/multiclass-prereqs.test.ts` | Create | TDD coverage for the helper. |
| `components/builder/class-step-rail/class-picker-card.tsx` | Create | One card in the picker grid: emblem + name + role + prereq line. Three states: `met` / `not-met` / `already-in-build`. |
| `components/builder/class-step-rail/class-picker-panel.tsx` | Create | Full-width main-pane panel: header + Cancel + 3-col grid of cards + budget line. |
| `components/builder/class-step-rail/add-class-row.tsx` | Modify | Extend props with `unlocked` + `levelsRemaining` + `onClick`. Render unlocked variant (plus icon, accent border, "Add a class · X levels remaining"). Locked variant unchanged. |
| `components/builder/class-step-rail/index.tsx` | Modify | Add `showPicker` state + `resolvedStats` and `onAddClass` props. Compute prereqs, decide `unlocked`, wire AddClassRow click → `setShowPicker(true)`, render `<ClassPickerPanel>` when `showPicker`. `useEffect` on `selectedClasses.length` to close picker after a successful Pick. |
| `app/(app)/characters/[id]/builder/class/class-step-client.tsx` | Modify | Compute `resolvedStats` via `evaluate(...)` (memoized). Pass `resolvedStats` + `onAddClass={setPreviewContent}` to `<ClassStepRail>`. |
| `tests/components/builder/class-step-rail.test.tsx` | Modify | Append describes for `ClassPickerCard`, `ClassPickerPanel`, `AddClassRow — unlocked state`, `ClassStepRail — multiclass picker`. |

---

## Task 1 — `multiclass-prereqs` helper

**Files:**
- Create: `lib/builder/multiclass-prereqs.ts`
- Test: `tests/lib/builder/multiclass-prereqs.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
// tests/lib/builder/multiclass-prereqs.test.ts
import { describe, it, expect } from "vitest";
import {
  MULTICLASS_PREREQ_TABLE,
  evaluateMulticlassPrereq,
  multiclassPrereqsForAll,
  type ClassPrereqResult,
} from "@/lib/builder/multiclass-prereqs";
import type { ContentEntry } from "@/components/builder/content-browser";

function classEntry(slug: string, name: string): ContentEntry {
  return {
    id: `c-${slug}`,
    slug,
    name,
    content_type: "class",
    data: {},
    effects: [],
    version: 1,
    source: "srd",
  };
}

describe("MULTICLASS_PREREQ_TABLE", () => {
  it("has an entry for every SRD class", () => {
    const expected = [
      "barbarian", "bard", "cleric", "druid", "fighter", "monk",
      "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard",
    ];
    expect(Object.keys(MULTICLASS_PREREQ_TABLE).sort()).toEqual(expected.sort());
  });
});

describe("evaluateMulticlassPrereq", () => {
  const stats13 = {
    strength: 13, dexterity: 13, constitution: 13,
    intelligence: 13, wisdom: 13, charisma: 13,
  };
  const stats10 = {
    strength: 10, dexterity: 10, constitution: 10,
    intelligence: 10, wisdom: 10, charisma: 10,
  };

  it("returns met when all `all` thresholds are hit", () => {
    const result = evaluateMulticlassPrereq("paladin", stats13, []);
    expect(result.state).toBe("met");
    expect(result.line).toBe("STR 13 · met");
  });

  it("returns not-met when any `all` threshold misses", () => {
    const result = evaluateMulticlassPrereq("paladin", { ...stats13, charisma: 12 }, []);
    expect(result.state).toBe("not-met");
    expect(result.line).toBe("CHA 13 · not met");
    expect(result.unmet).toEqual([
      { ability: "charisma", min: 13, have: 12 },
    ]);
  });

  it("lists multiple unmet abilities when several `all` thresholds miss", () => {
    const result = evaluateMulticlassPrereq("paladin", stats10, []);
    expect(result.state).toBe("not-met");
    // Line shows the first/primary unmet ability.
    expect(result.line).toBe("STR 13 · not met");
    expect(result.unmet?.length).toBe(2);
  });

  it("returns met for Fighter when only one of the `any` thresholds is hit", () => {
    const result = evaluateMulticlassPrereq("fighter", { ...stats10, dexterity: 13 }, []);
    expect(result.state).toBe("met");
    expect(result.line).toBe("DEX 13 · met");
  });

  it("returns not-met for Fighter when neither `any` threshold is hit", () => {
    const result = evaluateMulticlassPrereq("fighter", stats10, []);
    expect(result.state).toBe("not-met");
    expect(result.line).toBe("STR 13 or DEX 13 · not met");
  });

  it("returns already-in-build when selectedClasses contains the slug", () => {
    const result = evaluateMulticlassPrereq("paladin", stats13, [{ slug: "paladin" }]);
    expect(result.state).toBe("already-in-build");
    expect(result.line).toBe("Already in this build");
  });

  it("uses STR/DEX/CON/INT/WIS/CHA abbreviations in the line", () => {
    expect(evaluateMulticlassPrereq("rogue", stats13, []).line).toBe("DEX 13 · met");
    expect(evaluateMulticlassPrereq("wizard", stats13, []).line).toBe("INT 13 · met");
    expect(evaluateMulticlassPrereq("cleric", stats13, []).line).toBe("WIS 13 · met");
    expect(evaluateMulticlassPrereq("bard", stats13, []).line).toBe("CHA 13 · met");
    expect(evaluateMulticlassPrereq("barbarian", stats13, []).line).toBe("STR 13 · met");
  });

  it("missing ability score (e.g. undefined) is treated as 0 (not met)", () => {
    const result = evaluateMulticlassPrereq("paladin", {} as Record<string, number>, []);
    expect(result.state).toBe("not-met");
  });
});

describe("multiclassPrereqsForAll", () => {
  const stats = {
    strength: 13, dexterity: 13, constitution: 13,
    intelligence: 8, wisdom: 8, charisma: 8,
  };

  it("returns one result per class in the input list", () => {
    const classes = [
      classEntry("barbarian", "Barbarian"),
      classEntry("wizard", "Wizard"),
    ];
    const results = multiclassPrereqsForAll(stats, [], classes);
    expect(results).toHaveLength(2);
    expect(results.map((r: ClassPrereqResult) => r.classSlug)).toEqual(["barbarian", "wizard"]);
  });

  it("preserves input order", () => {
    const classes = [
      classEntry("wizard", "Wizard"),
      classEntry("barbarian", "Barbarian"),
    ];
    const results = multiclassPrereqsForAll(stats, [], classes);
    expect(results.map((r) => r.classSlug)).toEqual(["wizard", "barbarian"]);
  });

  it("respects selectedClasses for the already-in-build state", () => {
    const classes = [classEntry("barbarian", "Barbarian")];
    const results = multiclassPrereqsForAll(stats, [{ slug: "barbarian" }], classes);
    expect(results[0].state).toBe("already-in-build");
  });
});
```

- [ ] **Step 2: Run the failing test.**

Run: `npx vitest run tests/lib/builder/multiclass-prereqs.test.ts`
Expected: FAIL — module not found (`Cannot find module '@/lib/builder/multiclass-prereqs'`).

- [ ] **Step 3: Implement the helper.**

```ts
// lib/builder/multiclass-prereqs.ts
import type { ContentEntry } from "@/components/builder/content-browser";

export type AbilityKey =
  | "strength"
  | "dexterity"
  | "constitution"
  | "intelligence"
  | "wisdom"
  | "charisma";

interface MulticlassPrereq {
  /** All abilities listed must meet the threshold (`AND`). Used for most classes. */
  all?: Array<{ ability: AbilityKey; min: number }>;
  /** At least one ability must meet the threshold (`OR`). Used for Fighter (STR 13 OR DEX 13). */
  any?: Array<{ ability: AbilityKey; min: number }>;
}

export const MULTICLASS_PREREQ_TABLE: Record<string, MulticlassPrereq> = {
  barbarian: { all: [{ ability: "strength", min: 13 }] },
  bard: { all: [{ ability: "charisma", min: 13 }] },
  cleric: { all: [{ ability: "wisdom", min: 13 }] },
  druid: { all: [{ ability: "wisdom", min: 13 }] },
  fighter: { any: [{ ability: "strength", min: 13 }, { ability: "dexterity", min: 13 }] },
  monk: { all: [{ ability: "dexterity", min: 13 }, { ability: "wisdom", min: 13 }] },
  paladin: { all: [{ ability: "strength", min: 13 }, { ability: "charisma", min: 13 }] },
  ranger: { all: [{ ability: "dexterity", min: 13 }, { ability: "wisdom", min: 13 }] },
  rogue: { all: [{ ability: "dexterity", min: 13 }] },
  sorcerer: { all: [{ ability: "charisma", min: 13 }] },
  warlock: { all: [{ ability: "charisma", min: 13 }] },
  wizard: { all: [{ ability: "intelligence", min: 13 }] },
};

export type ClassPrereqState = "met" | "not-met" | "already-in-build";

export interface ClassPrereqResult {
  classSlug: string;
  state: ClassPrereqState;
  /** Human-readable line: e.g. "STR 13 · met", "STR 13 · not met", "Already in this build". */
  line: string;
  /** When state is not-met, lists which abilities failed. Empty for met / already-in-build. */
  unmet?: Array<{ ability: AbilityKey; min: number; have: number }>;
}

const ABILITY_ABBR: Record<AbilityKey, string> = {
  strength: "STR",
  dexterity: "DEX",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "WIS",
  charisma: "CHA",
};

function abbr(ability: AbilityKey): string {
  return ABILITY_ABBR[ability];
}

export function evaluateMulticlassPrereq(
  classSlug: string,
  resolvedStats: Record<string, number>,
  selectedClasses: Array<{ slug: string }>,
): ClassPrereqResult {
  if (selectedClasses.some((c) => c.slug === classSlug)) {
    return {
      classSlug,
      state: "already-in-build",
      line: "Already in this build",
    };
  }

  const prereq = MULTICLASS_PREREQ_TABLE[classSlug];
  if (!prereq) {
    return { classSlug, state: "met", line: "" };
  }

  if (prereq.all) {
    const unmet = prereq.all
      .map((req) => ({ ...req, have: resolvedStats[req.ability] ?? 0 }))
      .filter((req) => req.have < req.min);

    if (unmet.length === 0) {
      const primary = prereq.all[0];
      return {
        classSlug,
        state: "met",
        line: `${abbr(primary.ability)} ${primary.min} · met`,
      };
    }

    const primaryUnmet = unmet[0];
    return {
      classSlug,
      state: "not-met",
      line: `${abbr(primaryUnmet.ability)} ${primaryUnmet.min} · not met`,
      unmet,
    };
  }

  // `any` form (Fighter): at least one threshold must hit.
  const checks = (prereq.any ?? []).map((req) => ({
    ...req,
    have: resolvedStats[req.ability] ?? 0,
  }));
  const hit = checks.find((req) => req.have >= req.min);

  if (hit) {
    return {
      classSlug,
      state: "met",
      line: `${abbr(hit.ability)} ${hit.min} · met`,
    };
  }

  const summary = checks.map((c) => `${abbr(c.ability)} ${c.min}`).join(" or ");
  return {
    classSlug,
    state: "not-met",
    line: `${summary} · not met`,
    unmet: checks,
  };
}

export function multiclassPrereqsForAll(
  resolvedStats: Record<string, number>,
  selectedClasses: Array<{ slug: string }>,
  classes: ContentEntry[],
): ClassPrereqResult[] {
  return classes.map((c) => evaluateMulticlassPrereq(c.slug, resolvedStats, selectedClasses));
}
```

- [ ] **Step 4: Run the test to verify it passes.**

Run: `npx vitest run tests/lib/builder/multiclass-prereqs.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 5: Type-check.**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit.**

```bash
git add lib/builder/multiclass-prereqs.ts tests/lib/builder/multiclass-prereqs.test.ts
git commit -m "$(cat <<'EOF'
feat(builder): multiclass prereq helper

Pure helper mapping each SRD class slug to its multiclassing
prerequisite (e.g. paladin → STR 13 AND CHA 13). Returns one of
three states per class: met, not-met, or already-in-build, with a
human-readable line for the picker card prereq display.

Used by the upcoming ClassPickerPanel (PR-C of M2) and by
ClassStepRail to decide whether AddClassRow is unlocked.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 — `<ClassPickerCard>`

**Files:**
- Create: `components/builder/class-step-rail/class-picker-card.tsx`
- Test: append to `tests/components/builder/class-step-rail.test.tsx`

- [ ] **Step 1: Append failing tests.**

Append at the end of `tests/components/builder/class-step-rail.test.tsx`:

```tsx
import { ClassPickerCard } from "@/components/builder/class-step-rail/class-picker-card";
import type { ClassPrereqResult } from "@/lib/builder/multiclass-prereqs";

function pickerClass(slug: string, name: string, data: Record<string, unknown> = {}): ContentEntry {
  return {
    id: `c-${slug}`,
    slug,
    name,
    content_type: "class",
    data,
    effects: [],
    version: 1,
    source: "srd",
  };
}

function prereq(state: ClassPrereqResult["state"], line: string, classSlug = "paladin"): ClassPrereqResult {
  return { classSlug, state, line };
}

describe("ClassPickerCard", () => {
  it("renders emblem letter, class name, and prereq line for met state", () => {
    render(
      <ClassPickerCard
        classContent={pickerClass("paladin", "Paladin", { role: "Defender / Striker" })}
        prereq={prereq("met", "STR 13 · met")}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Paladin")).toBeInTheDocument();
    expect(screen.getByText(/Defender \/ Striker/i)).toBeInTheDocument();
    expect(screen.getByText("STR 13 · met")).toBeInTheDocument();
  });

  it("falls back to a derived role string when classContent.data.role is absent", () => {
    render(
      <ClassPickerCard
        classContent={pickerClass("rogue", "Rogue", { hit_die: 8 })}
        prereq={prereq("met", "DEX 13 · met", "rogue")}
        onSelect={vi.fn()}
      />,
    );
    // Fallback: hit-die label.
    expect(screen.getByText(/d8 hit die/i)).toBeInTheDocument();
  });

  it("is aria-disabled and shows the unmet line for not-met state", () => {
    render(
      <ClassPickerCard
        classContent={pickerClass("wizard", "Wizard")}
        prereq={prereq("not-met", "INT 13 · not met", "wizard")}
        onSelect={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", { name: /Wizard/i });
    expect(btn).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("INT 13 · not met")).toBeInTheDocument();
  });

  it("is aria-disabled and shows 'Already in this build' for already-in-build state", () => {
    render(
      <ClassPickerCard
        classContent={pickerClass("paladin", "Paladin")}
        prereq={prereq("already-in-build", "Already in this build")}
        onSelect={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", { name: /Paladin/i });
    expect(btn).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Already in this build")).toBeInTheDocument();
  });

  it("calls onSelect(classContent) when met card is clicked", () => {
    const onSelect = vi.fn();
    const content = pickerClass("paladin", "Paladin");
    render(
      <ClassPickerCard
        classContent={content}
        prereq={prereq("met", "STR 13 · met")}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Paladin/i }));
    expect(onSelect).toHaveBeenCalledWith(content);
  });

  it("does not call onSelect when not-met card is clicked", () => {
    const onSelect = vi.fn();
    render(
      <ClassPickerCard
        classContent={pickerClass("wizard", "Wizard")}
        prereq={prereq("not-met", "INT 13 · not met", "wizard")}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Wizard/i }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not call onSelect when already-in-build card is clicked", () => {
    const onSelect = vi.fn();
    render(
      <ClassPickerCard
        classContent={pickerClass("paladin", "Paladin")}
        prereq={prereq("already-in-build", "Already in this build")}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Paladin/i }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "ClassPickerCard"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement.**

```tsx
// components/builder/class-step-rail/class-picker-card.tsx
"use client";

import { Check, Lock } from "lucide-react";
import { ClassEmblem } from "@/components/builder/class-emblem";
import { cn } from "@/lib/utils";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { ClassPrereqResult } from "@/lib/builder/multiclass-prereqs";

interface ClassPickerCardProps {
  classContent: ContentEntry;
  prereq: ClassPrereqResult;
  onSelect: (content: ContentEntry) => void;
}

function deriveRole(data: Record<string, unknown>): string | null {
  const role = data.role;
  if (typeof role === "string" && role.length > 0) return role;
  const hitDie = data.hit_die;
  if (typeof hitDie === "number") return `d${hitDie} hit die`;
  return null;
}

export function ClassPickerCard({ classContent, prereq, onSelect }: ClassPickerCardProps) {
  const data = classContent.data as Record<string, unknown>;
  const role = deriveRole(data);

  const disabled = prereq.state !== "met";

  const lineClass =
    prereq.state === "met"
      ? "text-emerald-500"
      : prereq.state === "not-met"
        ? "text-red-500"
        : "text-muted-foreground";

  return (
    <button
      type="button"
      aria-disabled={disabled ? "true" : "false"}
      onClick={() => {
        if (!disabled) onSelect(classContent);
      }}
      className={cn(
        "flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        disabled
          ? cn(
              "opacity-55 cursor-not-allowed",
              prereq.state === "not-met" ? "border-dashed border-muted" : "border-muted",
            )
          : "border-border hover:bg-accent/40 cursor-pointer",
      )}
    >
      <ClassEmblem slug={classContent.slug} name={classContent.name} size="md" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{classContent.name}</p>
        {role && <p className="mt-0.5 text-xs text-muted-foreground">{role}</p>}
        <p className={cn("mt-1 flex items-center gap-1 text-xs", lineClass)}>
          {prereq.state === "met" && <Check className="size-3" aria-hidden="true" />}
          {prereq.state === "not-met" && <span aria-hidden="true">•</span>}
          {prereq.state === "already-in-build" && <Lock className="size-3" aria-hidden="true" />}
          <span>{prereq.line}</span>
        </p>
      </div>
    </button>
  );
}
```

- [ ] **Step 4: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "ClassPickerCard"`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add components/builder/class-step-rail/class-picker-card.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "$(cat <<'EOF'
feat(builder): ClassPickerCard atomic component

Single card in the multiclass picker grid: 32×32 ClassEmblem +
class name + role line + prereq state line. Renders three
states (met, not-met, already-in-build) with appropriate
border/opacity/icon treatment. aria-disabled on non-met states
so screen readers still announce the unmet prereq reason.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 — `<ClassPickerPanel>`

**Files:**
- Create: `components/builder/class-step-rail/class-picker-panel.tsx`
- Test: append to `tests/components/builder/class-step-rail.test.tsx`

- [ ] **Step 1: Append failing tests.**

```tsx
import { ClassPickerPanel } from "@/components/builder/class-step-rail/class-picker-panel";

const TWELVE_CLASSES: ContentEntry[] = [
  "barbarian", "bard", "cleric", "druid", "fighter", "monk",
  "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard",
].map((slug) => pickerClass(slug, slug.charAt(0).toUpperCase() + slug.slice(1)));

describe("ClassPickerPanel", () => {
  const stats = {
    strength: 13, dexterity: 13, constitution: 13,
    intelligence: 13, wisdom: 13, charisma: 13,
  };

  it("renders one card per class in the input list", () => {
    render(
      <ClassPickerPanel
        classes={TWELVE_CLASSES}
        resolvedStats={stats}
        selectedClasses={[]}
        levelsRemaining={20}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    for (const slug of ["barbarian", "wizard", "paladin", "fighter"]) {
      const name = slug.charAt(0).toUpperCase() + slug.slice(1);
      expect(screen.getByRole("button", { name: new RegExp(name) })).toBeInTheDocument();
    }
  });

  it("renders the heading and a Cancel button", () => {
    render(
      <ClassPickerPanel
        classes={TWELVE_CLASSES}
        resolvedStats={stats}
        selectedClasses={[]}
        levelsRemaining={17}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: /Add a class/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
    expect(screen.getByText(/17 levels remaining/i)).toBeInTheDocument();
  });

  it("Cancel button calls onCancel", () => {
    const onCancel = vi.fn();
    render(
      <ClassPickerPanel
        classes={TWELVE_CLASSES}
        resolvedStats={stats}
        selectedClasses={[]}
        levelsRemaining={20}
        onSelect={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("clicking a met card calls onSelect with that class content", () => {
    const onSelect = vi.fn();
    render(
      <ClassPickerPanel
        classes={TWELVE_CLASSES}
        resolvedStats={stats}
        selectedClasses={[]}
        levelsRemaining={20}
        onSelect={onSelect}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Paladin/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].slug).toBe("paladin");
  });

  it("clicking a not-met card does not call onSelect", () => {
    const onSelect = vi.fn();
    const lowStats = {
      strength: 8, dexterity: 8, constitution: 8,
      intelligence: 8, wisdom: 8, charisma: 8,
    };
    render(
      <ClassPickerPanel
        classes={TWELVE_CLASSES}
        resolvedStats={lowStats}
        selectedClasses={[]}
        levelsRemaining={20}
        onSelect={onSelect}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Paladin/i }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("marks already-selected classes as already-in-build", () => {
    render(
      <ClassPickerPanel
        classes={TWELVE_CLASSES}
        resolvedStats={stats}
        selectedClasses={[{ slug: "paladin" }]}
        levelsRemaining={20}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    // Paladin card now shows "Already in this build" prereq line.
    expect(screen.getByText(/Already in this build/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "ClassPickerPanel"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement.**

```tsx
// components/builder/class-step-rail/class-picker-panel.tsx
"use client";

import { Button } from "@/components/ui/button";
import { ClassPickerCard } from "@/components/builder/class-step-rail/class-picker-card";
import { multiclassPrereqsForAll } from "@/lib/builder/multiclass-prereqs";
import type { ContentEntry } from "@/components/builder/content-browser";

interface ClassPickerPanelProps {
  classes: ContentEntry[];
  resolvedStats: Record<string, number>;
  selectedClasses: Array<{ slug: string }>;
  levelsRemaining: number;
  onSelect: (content: ContentEntry) => void;
  onCancel: () => void;
}

export function ClassPickerPanel({
  classes,
  resolvedStats,
  selectedClasses,
  levelsRemaining,
  onSelect,
  onCancel,
}: ClassPickerPanelProps) {
  const prereqs = multiclassPrereqsForAll(resolvedStats, selectedClasses, classes);

  return (
    <section
      aria-labelledby="class-picker-heading"
      className="space-y-4"
    >
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="class-picker-heading" className="text-xl font-semibold">
            Add a class
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {levelsRemaining} levels remaining · pick a class with met prerequisites
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onCancel} autoFocus>
          Cancel
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {classes.map((c, i) => (
          <ClassPickerCard
            key={c.slug}
            classContent={c}
            prereq={prereqs[i]}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "ClassPickerPanel"`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add components/builder/class-step-rail/class-picker-panel.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "$(cat <<'EOF'
feat(builder): ClassPickerPanel for multiclass picker

Full-width main-pane panel: heading + remaining-levels
description + Cancel button + 3-column grid of
ClassPickerCard. Uses multiclassPrereqsForAll to derive
per-card state from resolvedStats + selectedClasses.

Cancel autofocuses for one-keypress escape via Tab.
sm:grid-cols-2, lg:grid-cols-3 — single column on mobile
(mobile bottom-sheet variant deferred to PR-E).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 — `<AddClassRow>` unlocked variant

**Files:**
- Modify: `components/builder/class-step-rail/add-class-row.tsx`
- Test: append to `tests/components/builder/class-step-rail.test.tsx`

The PR-B locked variant takes only `reasons: string[]`. We extend the props with an `unlocked` discriminator + `levelsRemaining` + `onClick`. Locked variant unchanged so existing PR-B tests keep passing.

- [ ] **Step 1: Append failing tests.**

```tsx
describe("AddClassRow — unlocked state", () => {
  it("renders the unlocked label with X levels remaining", () => {
    render(
      <AddClassRow
        unlocked
        levelsRemaining={17}
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByText(/Add a class · 17 levels remaining/i)).toBeInTheDocument();
  });

  it("is not aria-disabled in unlocked state", () => {
    render(<AddClassRow unlocked levelsRemaining={20} onClick={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /Add a class/i });
    expect(btn).not.toHaveAttribute("aria-disabled", "true");
  });

  it("calls onClick when unlocked button is clicked", () => {
    const onClick = vi.fn();
    render(<AddClassRow unlocked levelsRemaining={20} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: /Add a class/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onClick when locked button is clicked", () => {
    const onClick = vi.fn();
    render(
      <AddClassRow
        reasons={["Requires CHA 13 for Bard"]}
        onClick={onClick}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Add a class/i }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "AddClassRow — unlocked"`
Expected: FAIL — `unlocked`/`levelsRemaining`/`onClick` props don't exist.

- [ ] **Step 3: Update the component.**

```tsx
// components/builder/class-step-rail/add-class-row.tsx
import { Lock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type AddClassRowProps =
  | {
      /** Locked state — same as PR-B. Renders the dashed-border, lock-icon row with reasons. */
      unlocked?: false;
      reasons: string[];
      onClick?: () => void;
      levelsRemaining?: never;
    }
  | {
      /** Unlocked state — renders the accent-border row with plus icon. */
      unlocked: true;
      levelsRemaining: number;
      onClick: () => void;
      reasons?: never;
    };

export function AddClassRow(props: AddClassRowProps) {
  if (props.unlocked) {
    return (
      <button
        type="button"
        onClick={props.onClick}
        className={cn(
          "w-full rounded-md border px-3 py-2 text-left transition-colors",
          "border-[rgba(201,164,74,0.45)] bg-[rgba(201,164,74,0.06)]",
          "hover:bg-[rgba(201,164,74,0.12)] cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <span className="flex items-center gap-2 text-xs text-foreground">
          <Plus className="size-3.5 text-[#c9a44a]" aria-hidden="true" />
          <span>Add a class · {props.levelsRemaining} levels remaining</span>
        </span>
      </button>
    );
  }

  const { reasons, onClick } = props;
  const reasonText = reasons.slice(0, 3).join(" · ");
  return (
    <button
      type="button"
      aria-disabled="true"
      aria-describedby="add-class-reason"
      title={reasons.join("\n")}
      className="w-full rounded-md border border-dashed border-muted px-3 py-2 text-left transition-colors cursor-not-allowed"
      onClick={(e) => {
        e.preventDefault();
        // Locked: ignore onClick. Provided so the rail can pass a single handler unconditionally.
        void onClick;
      }}
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

- [ ] **Step 4: Run all rail tests to verify the locked-variant tests still pass.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "AddClassRow"`
Expected: PASS — both `AddClassRow` (locked, from PR-B) and `AddClassRow — unlocked state` describes pass.

- [ ] **Step 5: Type-check.**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit.**

```bash
git add components/builder/class-step-rail/add-class-row.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "$(cat <<'EOF'
feat(builder): AddClassRow unlocked variant

Discriminated-union props: locked variant unchanged from PR-B
(reasons + cursor-not-allowed). Unlocked variant accepts
levelsRemaining + onClick, renders accent border + plus icon
+ "Add a class · X levels remaining". Used by ClassStepRail
when at least one class has met prereqs and totalLevel < 20.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 — Wire `<ClassPickerPanel>` into `<ClassStepRail>`

This is the integration boundary. Two new props (`resolvedStats`, `onAddClass`), one piece of rail-local state (`showPicker`), and a `useEffect` watching `selectedClasses.length` to close the picker after a successful Pick.

**Files:**
- Modify: `components/builder/class-step-rail/index.tsx`
- Test: append to `tests/components/builder/class-step-rail.test.tsx`

- [ ] **Step 1: Append failing integration tests.**

```tsx
describe("ClassStepRail — multiclass picker", () => {
  function setupForPicker(overrides: Partial<Parameters<typeof ClassStepRail>[0]> = {}) {
    const handlers = {
      onLevelChange: vi.fn(),
      onRemoveClass: vi.fn(),
      onSubclassSelect: vi.fn(),
      onAsiSelect: vi.fn(),
      onFightingStyleSelect: vi.fn(),
      onChoiceSelect: vi.fn(),
      onAddClass: vi.fn(),
    };
    const allClasses = [
      "barbarian", "bard", "cleric", "druid", "fighter", "monk",
      "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard",
    ].map((slug) =>
      classEntry(slug, slug.charAt(0).toUpperCase() + slug.slice(1), [
        { level: 1, features: [] },
      ]),
    );
    const props = {
      classes: allClasses,
      subclasses: [],
      features: [],
      selectedClasses: [{ slug: "paladin", level: 3 }],
      localChoices: {} as CharacterChoices,
      contentRefs: [],
      resolvedStats: {
        strength: 13, dexterity: 12, constitution: 14,
        intelligence: 8, wisdom: 10, charisma: 13,
      },
      ...handlers,
      ...overrides,
    };
    const utils = render(<ClassStepRail {...props} />);
    return { ...utils, ...handlers, props };
  }

  it("renders the locked AddClassRow when no class qualifies", () => {
    setupForPicker({
      resolvedStats: {
        strength: 8, dexterity: 8, constitution: 8,
        intelligence: 8, wisdom: 8, charisma: 8,
      },
    });
    expect(screen.getByText(/Add a class · Locked/i)).toBeInTheDocument();
  });

  it("renders the unlocked AddClassRow when at least one class qualifies", () => {
    setupForPicker();
    expect(screen.getByText(/Add a class · 17 levels remaining/i)).toBeInTheDocument();
  });

  it("opens the ClassPickerPanel when the unlocked AddClassRow is clicked", () => {
    setupForPicker();
    fireEvent.click(screen.getByRole("button", { name: /Add a class · 17 levels remaining/i }));
    expect(screen.getByRole("heading", { level: 2, name: /Add a class/i })).toBeInTheDocument();
  });

  it("closes the picker when its Cancel button is clicked", () => {
    setupForPicker();
    fireEvent.click(screen.getByRole("button", { name: /Add a class · 17 levels remaining/i }));
    expect(screen.getByRole("heading", { level: 2, name: /Add a class/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(screen.queryByRole("heading", { level: 2, name: /Add a class/i })).not.toBeInTheDocument();
  });

  it("calls onAddClass when a met card in the picker is clicked", () => {
    const { onAddClass } = setupForPicker();
    fireEvent.click(screen.getByRole("button", { name: /Add a class · 17 levels remaining/i }));
    // Barbarian needs STR 13 — our resolvedStats has STR 13, so met.
    fireEvent.click(screen.getByRole("button", { name: /Barbarian/i }));
    expect(onAddClass).toHaveBeenCalledTimes(1);
    expect(onAddClass.mock.calls[0][0].slug).toBe("barbarian");
  });

  it("does not auto-close the picker when onAddClass is invoked (modal will close it via length increment)", () => {
    setupForPicker();
    fireEvent.click(screen.getByRole("button", { name: /Add a class · 17 levels remaining/i }));
    fireEvent.click(screen.getByRole("button", { name: /Barbarian/i }));
    // Picker must still be visible — only modal Pick should close it.
    expect(screen.getByRole("heading", { level: 2, name: /Add a class/i })).toBeInTheDocument();
  });

  it("closes the picker when selectedClasses.length increments (simulated Pick)", () => {
    const { rerender, props } = setupForPicker();
    fireEvent.click(screen.getByRole("button", { name: /Add a class · 17 levels remaining/i }));
    expect(screen.getByRole("heading", { level: 2, name: /Add a class/i })).toBeInTheDocument();

    // Simulate parent re-render with a new class added (modal Pick path).
    rerender(
      <ClassStepRail
        {...props}
        selectedClasses={[
          { slug: "paladin", level: 3 },
          { slug: "barbarian", level: 1 },
        ]}
      />,
    );
    expect(screen.queryByRole("heading", { level: 2, name: /Add a class/i })).not.toBeInTheDocument();
  });

  it("locks AddClassRow when totalLevel reaches 20", () => {
    setupForPicker({
      selectedClasses: [{ slug: "paladin", level: 20 }],
    });
    expect(screen.getByText(/Add a class · Locked/i)).toBeInTheDocument();
  });
});
```

Also extend the existing `setup` helpers inside the existing `describe("ClassStepRail", ...)` block by adding `resolvedStats` and `onAddClass` defaults so existing tests don't crash on the new required props. The minimal additions (paste into the existing `setup()` and `setupRail()` `props` object — see lines 494 and 599 in the current test file):

```tsx
resolvedStats: {
  strength: 10, dexterity: 10, constitution: 10,
  intelligence: 10, wisdom: 10, charisma: 10,
},
onAddClass: vi.fn(),
```

- [ ] **Step 2: Run new tests + existing rail tests to confirm scope of failures.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx`
Expected: New `multiclass picker` describe FAILs. Existing `ClassStepRail`/`Remove Class` describes still PASS (helper additions keep them green).

- [ ] **Step 3: Update `index.tsx` with picker state and props.**

Replace the entire contents of `components/builder/class-step-rail/index.tsx` with:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { LevelRail } from "@/components/builder/class-step-rail/level-rail";
import { ClassLevelPane } from "@/components/builder/class-step-rail/class-level-pane";
import { AddClassRow } from "@/components/builder/class-step-rail/add-class-row";
import { ClassPickerPanel } from "@/components/builder/class-step-rail/class-picker-panel";
import { Separator } from "@/components/ui/separator";
import { classFeaturesPerLevel } from "@/lib/builder/class-features-per-level";
import { multiclassPrereqsForAll } from "@/lib/builder/multiclass-prereqs";
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
  /** Engine-resolved ability scores for the current build. */
  resolvedStats: Record<string, number>;
  onLevelChange: (classIndex: number, newLevel: number) => Promise<void> | void;
  onRemoveClass: (classIndex: number) => Promise<void> | void;
  onSubclassSelect: (classSlug: string, classIndex: number, subclassSlug: string | undefined) => Promise<void> | void;
  onAsiSelect: (featureSlug: string, choice: AsiChoice) => Promise<void> | void;
  onFightingStyleSelect: (featureSlug: string, classSlug: string, styleSlug: string | undefined) => Promise<void> | void;
  onChoiceSelect: (choiceId: string, selections: string[]) => Promise<void> | void;
  /** Called when a met card in the picker is clicked. Parent opens the existing ClassPreviewModal. */
  onAddClass: (content: ContentEntry) => void;
}

interface SelectedKey {
  classIndex: number;
  level: number;
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
    classes,
    subclasses,
    features,
    selectedClasses,
    localChoices,
    resolvedStats,
    onLevelChange,
    onRemoveClass,
    onSubclassSelect,
    onAsiSelect,
    onFightingStyleSelect,
    onChoiceSelect,
    onAddClass,
  } = props;

  const initialClassIndex = 0;
  const initialLevel = selectedClasses[0]?.level ?? 1;
  const [selected, setSelected] = useState<SelectedKey>({
    classIndex: initialClassIndex,
    level: initialLevel,
  });
  const [showPicker, setShowPicker] = useState(false);

  // Close picker after a successful add (selectedClasses.length increments
  // via parent's handleSelectClass) and focus the new class's pane.
  const prevLengthRef = useRef(selectedClasses.length);
  useEffect(() => {
    if (selectedClasses.length > prevLengthRef.current) {
      setShowPicker(false);
      setSelected({ classIndex: selectedClasses.length - 1, level: 1 });
    }
    prevLengthRef.current = selectedClasses.length;
  }, [selectedClasses.length]);

  const totalLevel = selectedClasses.reduce((sum, c) => sum + c.level, 0);
  const levelsRemaining = MAX_TOTAL_LEVEL - totalLevel;

  // Compute prereq state for every class — used to decide AddClassRow lock state.
  const prereqs = multiclassPrereqsForAll(resolvedStats, selectedClasses, classes);
  const anyMet = prereqs.some((p) => p.state === "met");
  const canAddClass = anyMet && levelsRemaining > 0;

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

  const activeClassChoices = activeClassContent
    ? (activeClassContent.effects ?? []).filter(
        (e): e is import("@/lib/types/effects").ChoiceEffect => e.type === "choice",
      )
    : [];

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
              activeLevel={selected.classIndex === idx && !showPicker ? selected.level : -1}
              onSelectLevel={(level) => {
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
            />
          );
        })}
        <Separator />
        {canAddClass ? (
          <AddClassRow
            unlocked
            levelsRemaining={levelsRemaining}
            onClick={() => setShowPicker(true)}
          />
        ) : (
          <AddClassRow reasons={MULTICLASS_PREREQS_LOCKED_REASONS} />
        )}
      </aside>

      <div className="min-w-0">
        {showPicker ? (
          <ClassPickerPanel
            classes={classes}
            resolvedStats={resolvedStats}
            selectedClasses={selectedClasses}
            levelsRemaining={levelsRemaining}
            onSelect={onAddClass}
            onCancel={() => setShowPicker(false)}
          />
        ) : activeRow && activeClass && activeClassContent ? (
          <ClassLevelPane
            classSlug={activeClass.slug}
            className_={activeClassContent.name}
            classIndex={selected.classIndex}
            row={activeRow}
            subclasses={subclasses}
            styleOptions={styleOptionsForActiveClass}
            localChoices={localChoices}
            currentSubclass={activeClass.subclass}
            classChoices={activeClassChoices}
            onAsiSelect={onAsiSelect}
            onSubclassSelect={onSubclassSelect}
            onFightingStyleSelect={onFightingStyleSelect}
            onChoiceSelect={onChoiceSelect}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No class data for the selected level.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run all rail tests.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx`
Expected: ALL describes PASS — new `multiclass picker`, plus existing `ClassStepRail`/`Remove Class`/component-level tests.

- [ ] **Step 5: Type-check.**

Run: `npx tsc --noEmit`
Expected: no errors. (Note: parent `class-step-client.tsx` will produce a "missing required prop" error for `resolvedStats`/`onAddClass` until Task 6 lands. That's expected and gets fixed there.)

If `tsc` errors arise from the parent call site only, that's fine — they'll be resolved in Task 6. If errors arise from the rail or its children, fix before committing.

- [ ] **Step 6: Commit.**

```bash
git add components/builder/class-step-rail/index.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "$(cat <<'EOF'
feat(builder): wire multiclass picker into ClassStepRail

Adds resolvedStats + onAddClass props and rail-local
showPicker state. AddClassRow toggles between locked
(no class qualifies OR totalLevel >= 20) and unlocked
(at least one class met AND levels remaining > 0).
Click unlocked → ClassPickerPanel replaces the level pane.
Click a met card → onAddClass(content) bubbles up to the
parent (which opens the PR-A modal). useEffect on
selectedClasses.length closes the picker after a successful
modal Pick and focuses the newly-added class's pane.

Modal Cancel does not close the picker (only Pick does, via
the length-increment effect) — matches design spec subtlety
about cancel vs pick semantics.

Note: class-step-client.tsx still owes resolvedStats and
onAddClass — fixed in the next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 — Wire engine-resolved stats + onAddClass in `class-step-client.tsx`

Final integration point. Run the engine to compute `resolvedStats`, pass it + `onAddClass={setPreviewContent}` to the rail. The PR-A modal flow already exists; we're just hooking the picker's `onSelect` into the same `setPreviewContent` mutation.

**Files:**
- Modify: `app/(app)/characters/[id]/builder/class/class-step-client.tsx`

There are no new test cases for this task — `class-step-client` is a thin server-state wrapper around `<ClassStepRail>` and `<ClassPreviewModal>`, both of which are unit-tested independently. Manual verification (Task 7) covers the seam.

- [ ] **Step 1: Locate the section to modify.**

Open `app/(app)/characters/[id]/builder/class/class-step-client.tsx`. Find:
1. The imports block (top of file) — needs `useMemo` from React and `evaluate` from `@/lib/engine/evaluator`.
2. The `<ClassStepRail ... />` JSX inside the `hasClass ?` branch — needs two new props.

- [ ] **Step 2: Add imports.**

Find the existing import:
```tsx
import { useState, useTransition } from "react";
```

Replace with:
```tsx
import { useMemo, useState, useTransition } from "react";
```

Add a new import line after the existing `import type { Effect } ...` line:
```tsx
import { evaluate } from "@/lib/engine/evaluator";
```

- [ ] **Step 3: Compute `resolvedStats` via memoized engine call.**

After this existing line:
```tsx
const allEffects: Effect[] = contentRefs.flatMap(
  (ref) => ref.content_definitions?.effects ?? [],
);
```

Add:
```tsx
const resolvedStats = useMemo(() => {
  if (!schema) return character.base_stats ?? {};
  const baseWithLevel = { ...(character.base_stats ?? {}), level: localLevel };
  return evaluate(baseWithLevel, allEffects, schema).stats;
}, [character.base_stats, localLevel, allEffects, schema]);
```

This mirrors the pattern already used in `<StatPreview>` (see [stat-preview.tsx](../../../components/builder/stat-preview.tsx)). The fallback for missing `schema` returns raw `base_stats` — picker still works, just without race/feat ASI bonuses applied.

- [ ] **Step 4: Pass `resolvedStats` and `onAddClass` to `<ClassStepRail>`.**

Find the `<ClassStepRail>` JSX:
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
```

Replace with:
```tsx
{hasClass ? (
  <ClassStepRail
    classes={classes}
    subclasses={subclasses}
    features={features}
    selectedClasses={selectedClasses}
    localChoices={localChoices}
    contentRefs={contentRefs}
    resolvedStats={resolvedStats}
    onLevelChange={handleLevelChange}
    onRemoveClass={handleRemoveClass}
    onSubclassSelect={handleSubclassSelect}
    onAsiSelect={handleAsiSelect}
    onFightingStyleSelect={handleFightingStyleSelect}
    onChoiceSelect={handleChoiceSelect}
    onAddClass={(content) => setPreviewContent(content)}
  />
) : (
```

- [ ] **Step 5: Type-check.**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Run the full test suite.**

Run: `npx vitest run`
Expected: all tests PASS. No regressions in PR-A modal tests, PR-B rail tests, or new picker tests.

- [ ] **Step 7: Commit.**

```bash
git add "app/(app)/characters/[id]/builder/class/class-step-client.tsx"
git commit -m "$(cat <<'EOF'
feat(builder): wire engine resolvedStats + onAddClass

Runs evaluate(baseStats, allEffects, schema) once per render
(memoized on stats/level/effects/schema) to derive the
resolved ability scores used by the multiclass picker for
prereq gating. Passes resolvedStats + onAddClass to
ClassStepRail. onAddClass={setPreviewContent} reuses the
existing PR-A ClassPreviewModal flow — modal Pick still goes
through handleSelectClass with no new mutation paths.

This completes the multiclass add path end-to-end.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7 — Manual verification

**Files:**
- None (browser test only).

The picker only renders correctly when wired to a real character with effects + schema. Unit tests cover the components in isolation; this task verifies the seam.

- [ ] **Step 1: Start the dev server.**

Use `preview_start` (the standard verification workflow). If a server is already running, skip.

- [ ] **Step 2: Open a character that has at least one class and reasonable ability scores.**

Navigate to `/characters/<id>/builder/class` for a level-3 Paladin or similar. The character's resolved stats must include at least one ability ≥ 13 (paladin's STR is enough since paladin is multiclass-eligible into anything sharing STR or non-prereq, but for a *new* class to be `met` we need a different ability ≥ 13).

If you don't have a fixture: create a Paladin level-3 with STR 14 / DEX 14 / CHA 14. STR/CHA satisfy paladin re-add (already-in-build), DEX 14 meets fighter/rogue/ranger.

- [ ] **Step 3: Verify the locked vs unlocked AddClassRow.**

- With low stats (all 8s): AddClassRow shows "Add a class · Locked" + reasons. Clicking is a no-op.
- With at least one ability ≥ 13: AddClassRow shows "Add a class · X levels remaining" with the gold accent border + plus icon.

- [ ] **Step 4: Open the picker and verify the grid.**

Click the unlocked AddClassRow. Main pane should swap from `<ClassLevelPane>` to `<ClassPickerPanel>`. Verify:
- Heading "Add a class".
- Description with "X levels remaining".
- Cancel button (top-right) is autofocused.
- 12 cards in a 3-col grid (lg:), 2-col (sm:), 1-col (mobile).
- Met cards: solid border, full opacity, green check + "ABBR 13 · met".
- Not-met cards: dashed border, 0.55 opacity, red dot + "ABBR 13 · not met".
- Already-in-build (the existing class): solid border, 0.55 opacity, lock icon + "Already in this build".

- [ ] **Step 5: Verify Cancel.**

Click the Cancel button. Picker disappears, the previously-selected `<ClassLevelPane>` returns. (Selected level should still be the same as before opening.)

- [ ] **Step 6: Verify card click → modal opens, picker stays under.**

Re-open the picker. Click a `met` card (e.g., Fighter if DEX or STR ≥ 13). The PR-A `<ClassPreviewModal>` opens for that class. Inspect the DOM under devtools — `<ClassPickerPanel>` is still mounted in the main pane behind the modal overlay.

- [ ] **Step 7: Verify modal Cancel keeps picker open.**

In the modal, click the X / press Escape. Modal closes. Picker should still be visible in the main pane.

- [ ] **Step 8: Verify modal Pick closes both and lands on the new class.**

Re-open the picker, click a met card, then click "Pick this class" in the modal. Both modal AND picker should close. The rail should now show two LevelRail sections (the original class and the new one). Selected level should be the new class at level 1 (its `<ClassLevelPane>` showing).

- [ ] **Step 9: Verify the lock kicks in at total level 20.**

Use the level dropdown on the existing class's LevelRail to take it to 20. AddClassRow should immediately re-render as locked. Reset the level afterwards.

- [ ] **Step 10: Take a screenshot for the PR description.**

Use `preview_screenshot` of the open picker. Save the path for the PR body.

- [ ] **Step 11: No commit needed for Task 7.** If any bugs surface during verification, file a follow-up task or fix in a new commit before opening the PR.

---

## Self-review checklist (post-implementation)

Run before opening the PR:

- [ ] All tests pass: `npx vitest run`
- [ ] Type-check clean: `npx tsc --noEmit`
- [ ] Lint clean: `npx eslint .` (or the project's lint script)
- [ ] No new files outside the file map (search for untracked: `git status -s`)
- [ ] No leftover `console.log` / debug code
- [ ] PR-A modal still works for first-class flow (no class yet → ContentBrowser → modal → Pick)
- [ ] PR-B rail still works for single-class characters (no picker visible, locked AddClassRow if stats are low)
- [ ] Existing multiclass characters still render correctly (the rail had this from PR-B; verify nothing regressed)
