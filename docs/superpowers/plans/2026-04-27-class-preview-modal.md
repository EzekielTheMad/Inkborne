# Class Preview Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing class preview dialog with the design team's Variant B layout (4 tabs, class identity strip, preview-level dropdown, sticky footer) while keeping race + background previews on the existing component.

**Architecture:** New `ClassPreviewModal` component beside the existing `ContentPreview`. Uses the existing shadcn `Dialog` (which wraps `@base-ui/react/dialog`) and `Tabs` (`@base-ui/react/tabs`) primitives. Class metadata (tone, emblem letter) extracted into a small reusable layer (`class-tone.ts` + `<ClassEmblem>`) so the Class Step rail in PR-B can reuse it. Integration is a one-file swap in `class-step-client.tsx` — the class step is the only call site; race + background steps are untouched.

**Tech Stack:** Next.js 16 App Router (client component), TypeScript strict, Tailwind v4 with HSL tokens in `globals.css`, `@base-ui/react/dialog` + `@base-ui/react/tabs` via shadcn wrappers, vitest + `@testing-library/react` for tests.

**Spec:** [`docs/superpowers/specs/2026-04-27-class-preview-modal-design.md`](../specs/2026-04-27-class-preview-modal-design.md). Source design files: [`docs/design-briefs/builder-ux-polish-design-files/`](../../design-briefs/builder-ux-polish-design-files/).

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `lib/builder/class-tone.ts` | Create | Slug → tone (`gold`/`purple`) + emblem letter helpers. |
| `tests/lib/builder/class-tone.test.ts` | Create | Pure-helper tests (TDD). |
| `components/builder/class-emblem.tsx` | Create | Rounded-rect emblem with Georgia letter, tone-tinted bg/border. |
| `tests/components/builder/class-emblem.test.tsx` | Create | Render test (size variants + tone). |
| `components/builder/class-preview-modal.tsx` | Create | The modal component itself: identity strip, tabs, footer. |
| `components/builder/class-preview-modal/overview-tab.tsx` | Create | Overview tab body. |
| `components/builder/class-preview-modal/features-tab.tsx` | Create | Features tab — features grouped by level, filtered by previewLevel + subclass. |
| `components/builder/class-preview-modal/subclasses-tab.tsx` | Create | Grid of subclass cards. |
| `components/builder/class-preview-modal/spells-tab.tsx` | Create | Caster-only spell list with level + school filter chips. |
| `tests/components/builder/class-preview-modal.test.tsx` | Create | Behavior tests: tab switching, level filter, subclass selection, pick callback, reset on open. |
| `app/(app)/characters/[id]/builder/class/class-step-client.tsx` | Modify | Swap `<ContentPreview>` for `<ClassPreviewModal>`; wire `subclassSlug` from `onPick` into the existing `handleSubclassSelect` flow. |

The modal is split into one wrapper file + one file per tab so each file has a single responsibility and stays small. The wrapper holds modal-local state and routes props to the tab bodies.

---

## Task 1 — Class tone helper

**Files:**
- Create: `lib/builder/class-tone.ts`
- Test: `tests/lib/builder/class-tone.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
// tests/lib/builder/class-tone.test.ts
import { describe, it, expect } from "vitest";
import { classTone, classEmblemLetter } from "@/lib/builder/class-tone";

describe("classTone", () => {
  it("returns purple for canonical caster classes", () => {
    expect(classTone("wizard")).toBe("purple");
    expect(classTone("sorcerer")).toBe("purple");
    expect(classTone("warlock")).toBe("purple");
    expect(classTone("bard")).toBe("purple");
    expect(classTone("cleric")).toBe("purple");
    expect(classTone("druid")).toBe("purple");
  });

  it("returns gold for non-caster (martial) classes", () => {
    expect(classTone("paladin")).toBe("gold");
    expect(classTone("fighter")).toBe("gold");
    expect(classTone("barbarian")).toBe("gold");
    expect(classTone("monk")).toBe("gold");
    expect(classTone("ranger")).toBe("gold");
    expect(classTone("rogue")).toBe("gold");
  });

  it("falls back to gold for unknown slugs", () => {
    expect(classTone("artificer")).toBe("gold");
    expect(classTone("homebrew-class")).toBe("gold");
  });
});

describe("classEmblemLetter", () => {
  it("returns the uppercased first letter of the class name", () => {
    expect(classEmblemLetter("paladin", "Paladin")).toBe("P");
    expect(classEmblemLetter("wizard", "Wizard")).toBe("W");
  });

  it("falls back to the first letter of the slug when no name given", () => {
    expect(classEmblemLetter("rogue")).toBe("R");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `npx vitest run tests/lib/builder/class-tone.test.ts`
Expected: FAIL with `Failed to load url @/lib/builder/class-tone` or "module not found".

- [ ] **Step 3: Implement the helper.**

```ts
// lib/builder/class-tone.ts
export type ClassTone = "gold" | "purple";

const PURPLE_TONE_SLUGS = new Set([
  "wizard",
  "sorcerer",
  "warlock",
  "bard",
  "cleric",
  "druid",
]);

export function classTone(slug: string): ClassTone {
  return PURPLE_TONE_SLUGS.has(slug) ? "purple" : "gold";
}

export function classEmblemLetter(slug: string, name?: string): string {
  const source = name ?? slug;
  return source.charAt(0).toUpperCase();
}
```

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `npx vitest run tests/lib/builder/class-tone.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit.**

```bash
git add lib/builder/class-tone.ts tests/lib/builder/class-tone.test.ts
git commit -m "feat(builder): add class-tone helper for emblem styling"
```

---

## Task 2 — Class emblem component

**Files:**
- Create: `components/builder/class-emblem.tsx`
- Test: `tests/components/builder/class-emblem.test.tsx`

- [ ] **Step 1: Write the failing test.**

```tsx
// tests/components/builder/class-emblem.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClassEmblem } from "@/components/builder/class-emblem";

describe("ClassEmblem", () => {
  it("renders the emblem letter for the given class", () => {
    render(<ClassEmblem slug="paladin" name="Paladin" size="md" />);
    expect(screen.getByText("P")).toBeInTheDocument();
  });

  it("applies the gold tone to martial classes", () => {
    const { container } = render(
      <ClassEmblem slug="paladin" name="Paladin" size="md" />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.dataset.tone).toBe("gold");
  });

  it("applies the purple tone to caster classes", () => {
    const { container } = render(
      <ClassEmblem slug="wizard" name="Wizard" size="md" />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.dataset.tone).toBe("purple");
  });

  it("hides the emblem letter from screen readers", () => {
    render(<ClassEmblem slug="paladin" name="Paladin" size="md" />);
    const letter = screen.getByText("P");
    expect(letter.parentElement?.getAttribute("aria-hidden")).toBe("true");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `npx vitest run tests/components/builder/class-emblem.test.tsx`
Expected: FAIL with "module not found".

- [ ] **Step 3: Implement the component.**

```tsx
// components/builder/class-emblem.tsx
import { cn } from "@/lib/utils";
import { classTone, classEmblemLetter, type ClassTone } from "@/lib/builder/class-tone";

interface ClassEmblemProps {
  slug: string;
  name?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<ClassEmblemProps["size"]>, string> = {
  sm: "size-6 text-[13px]",
  md: "size-8 text-[16px]",
  lg: "size-14 text-[32px]",
};

const TONE_CLASSES: Record<ClassTone, string> = {
  gold: "bg-[rgba(201,164,74,0.18)] border-[rgba(201,164,74,0.5)] text-[#c9a44a]",
  purple: "bg-[rgba(124,58,237,0.2)] border-[rgba(124,58,237,0.55)] text-[#c7b0ff]",
};

export function ClassEmblem({ slug, name, size = "md", className }: ClassEmblemProps) {
  const tone = classTone(slug);
  const letter = classEmblemLetter(slug, name);

  return (
    <div
      data-slot="class-emblem"
      data-tone={tone}
      aria-hidden="true"
      className={cn(
        "inline-flex items-center justify-center rounded-md border font-bold leading-none",
        "font-[Georgia,serif]",
        SIZE_CLASSES[size],
        TONE_CLASSES[tone],
        className,
      )}
    >
      <span>{letter}</span>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes.**

Run: `npx vitest run tests/components/builder/class-emblem.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit.**

```bash
git add components/builder/class-emblem.tsx tests/components/builder/class-emblem.test.tsx
git commit -m "feat(builder): add ClassEmblem component"
```

---

## Task 3 — Modal scaffold + props interface

**Files:**
- Create: `components/builder/class-preview-modal.tsx`
- Test: `tests/components/builder/class-preview-modal.test.tsx`

- [ ] **Step 1: Write a failing render test.**

```tsx
// tests/components/builder/class-preview-modal.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClassPreviewModal } from "@/components/builder/class-preview-modal";
import type { ContentEntry } from "@/components/builder/content-browser";

function makeClass(overrides: Partial<ContentEntry> = {}): ContentEntry {
  return {
    id: "c1",
    name: "Paladin",
    slug: "paladin",
    content_type: "class",
    data: {
      hit_die: 10,
      primaryAbility: "STR + CHA",
      saving_throws: ["wisdom", "charisma"],
      levels: [
        { level: 1, features: ["divine-sense"] },
        { level: 2, features: ["divine-smite"] },
      ],
    },
    effects: [],
    version: 1,
    source: "srd",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ClassPreviewModal", () => {
  it("renders the class name when open", () => {
    render(
      <ClassPreviewModal
        open={true}
        classContent={makeClass()}
        features={[]}
        subclasses={[]}
        spells={[]}
        onCancel={vi.fn()}
        onPick={vi.fn()}
      />,
    );
    expect(screen.getByText("Paladin")).toBeInTheDocument();
  });

  it("renders nothing when classContent is null", () => {
    const { container } = render(
      <ClassPreviewModal
        open={true}
        classContent={null}
        features={[]}
        subclasses={[]}
        spells={[]}
        onCancel={vi.fn()}
        onPick={vi.fn()}
      />,
    );
    // Nothing is portaled to body either.
    expect(document.body.textContent).not.toContain("Paladin");
    expect(container.textContent).toBe("");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `npx vitest run tests/components/builder/class-preview-modal.test.tsx`
Expected: FAIL with "module not found".

- [ ] **Step 3: Implement the scaffold (no tabs yet — just the Dialog shell + identity strip).**

```tsx
// components/builder/class-preview-modal.tsx
"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ClassEmblem } from "@/components/builder/class-emblem";
import type { ContentEntry } from "@/components/builder/content-browser";

export interface ClassPreviewModalProps {
  open: boolean;
  classContent: ContentEntry | null;
  features: ContentEntry[];
  subclasses: ContentEntry[];
  spells: ContentEntry[];
  onCancel: () => void;
  onPick: (selection: { classSlug: string; subclassSlug: string | null }) => void;
}

type TabId = "overview" | "features" | "subclasses" | "spells";

export function ClassPreviewModal({
  open,
  classContent,
  features,
  subclasses,
  spells,
  onCancel,
  onPick,
}: ClassPreviewModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [previewLevel, setPreviewLevel] = useState<number>(1);
  const [previewSubclassSlug, setPreviewSubclassSlug] = useState<string | null>(null);

  // Reset modal-local state whenever a new class is opened.
  useEffect(() => {
    if (open && classContent) {
      setActiveTab("overview");
      setPreviewLevel(1);
      setPreviewSubclassSlug(null);
    }
  }, [open, classContent?.id]);

  if (!classContent) return null;

  const data = classContent.data as Record<string, unknown>;
  const hitDie = data.hit_die as number | undefined;
  const primaryAbility = data.primaryAbility as string | undefined;
  const levels = (data.levels as Array<{ level: number; features: string[] }>) ?? [];
  const maxLevel = levels.length > 0 ? levels[levels.length - 1].level : 20;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent
        showCloseButton
        className="grid grid-rows-[auto_1fr_auto] gap-0 p-0 max-w-[1120px] w-[min(1120px,90vw)] max-h-[820px] h-[min(820px,85vh)] rounded-xl shadow-[0_24px_60px_rgba(0,0,0,0.5)] data-open:duration-[180ms] data-open:[animation-timing-function:cubic-bezier(0.16,1,0.3,1)]"
      >
        <header className="flex items-center gap-4 px-6 py-4 border-b border-border">
          <ClassEmblem slug={classContent.slug} name={classContent.name} size="lg" />
          <div className="flex-1 min-w-0">
            <h2 id="class-preview-title" className="text-2xl font-semibold leading-tight font-serif">
              {classContent.name}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {[
                hitDie ? `d${hitDie} hit die` : null,
                primaryAbility ? primaryAbility : null,
                `${maxLevel} levels of features`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </header>

        {/* Tab body placeholder — Task 4 fills in tabs. */}
        <div className="overflow-y-auto px-6 py-4 text-sm">
          <p className="text-muted-foreground">Coming up: tabs.</p>
        </div>

        <footer className="flex items-center justify-between gap-3 px-6 py-3 border-t border-border bg-muted/30">
          <div data-slot="preview-level-slot" />
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} autoFocus>
              Cancel
            </Button>
            <Button
              onClick={() =>
                onPick({
                  classSlug: classContent.slug,
                  subclassSlug: previewSubclassSlug,
                })
              }
            >
              Pick this class
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `npx vitest run tests/components/builder/class-preview-modal.test.tsx`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit.**

```bash
git add components/builder/class-preview-modal.tsx tests/components/builder/class-preview-modal.test.tsx
git commit -m "feat(builder): scaffold ClassPreviewModal with identity strip"
```

---

## Task 4 — Tabs scaffold + tab visibility (caster gating)

**Files:**
- Modify: `components/builder/class-preview-modal.tsx`
- Modify: `tests/components/builder/class-preview-modal.test.tsx`

- [ ] **Step 1: Add failing tests for tab rendering + caster gating.**

Append to `tests/components/builder/class-preview-modal.test.tsx`:

```tsx
import { fireEvent } from "@testing-library/react";

describe("ClassPreviewModal — tabs", () => {
  it("shows 4 tabs when the class is a caster (has spellsKnown)", () => {
    const wizard = makeClass({
      slug: "wizard",
      name: "Wizard",
      data: {
        hit_die: 6,
        primaryAbility: "INT",
        spellsKnown: "all",
        levels: [{ level: 1, features: ["arcane-recovery"] }],
      },
    });
    render(
      <ClassPreviewModal
        open={true}
        classContent={wizard}
        features={[]}
        subclasses={[]}
        spells={[]}
        onCancel={vi.fn()}
        onPick={vi.fn()}
      />,
    );
    expect(screen.getByRole("tab", { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /features/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /subclasses/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /spells/i })).toBeInTheDocument();
  });

  it("hides the Spells tab when the class is not a caster", () => {
    render(
      <ClassPreviewModal
        open={true}
        classContent={makeClass()}
        features={[]}
        subclasses={[]}
        spells={[]}
        onCancel={vi.fn()}
        onPick={vi.fn()}
      />,
    );
    expect(screen.queryByRole("tab", { name: /spells/i })).not.toBeInTheDocument();
  });

  it("switches the visible tab body when a different tab is clicked", () => {
    render(
      <ClassPreviewModal
        open={true}
        classContent={makeClass()}
        features={[]}
        subclasses={[]}
        spells={[]}
        onCancel={vi.fn()}
        onPick={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /features/i }));
    expect(screen.getByRole("tabpanel", { name: /features/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail.**

Run: `npx vitest run tests/components/builder/class-preview-modal.test.tsx -t "tabs"`
Expected: FAIL — no tabs rendered yet.

- [ ] **Step 3: Wire up tabs in the modal. Replace the placeholder div with a real Tabs primitive.**

Replace this block in `components/builder/class-preview-modal.tsx`:

```tsx
        {/* Tab body placeholder — Task 4 fills in tabs. */}
        <div className="overflow-y-auto px-6 py-4 text-sm">
          <p className="text-muted-foreground">Coming up: tabs.</p>
        </div>
```

with:

```tsx
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabId)}
          className="flex flex-col min-h-0"
        >
          <TabsList variant="line" className="px-6 border-b border-border rounded-none w-full justify-start">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="subclasses">Subclasses</TabsTrigger>
            {isCaster && <TabsTrigger value="spells">Spells</TabsTrigger>}
          </TabsList>

          <TabsContent value="overview" className="overflow-y-auto px-6 py-4">
            <p className="text-sm text-muted-foreground">Overview tab — Task 5.</p>
          </TabsContent>
          <TabsContent value="features" className="overflow-y-auto px-6 py-4">
            <p className="text-sm text-muted-foreground">Features tab — Task 6.</p>
          </TabsContent>
          <TabsContent value="subclasses" className="overflow-y-auto px-6 py-4">
            <p className="text-sm text-muted-foreground">Subclasses tab — Task 7.</p>
          </TabsContent>
          {isCaster && (
            <TabsContent value="spells" className="overflow-y-auto px-6 py-4">
              <p className="text-sm text-muted-foreground">Spells tab — Task 8.</p>
            </TabsContent>
          )}
        </Tabs>
```

Also add the imports + caster derivation. At the top of the file, replace the existing import block with:

```tsx
"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ClassEmblem } from "@/components/builder/class-emblem";
import type { ContentEntry } from "@/components/builder/content-browser";
```

And inside the component body, after the `levels`/`maxLevel` derivation, add:

```tsx
  const isCaster = data.spellcasting != null || data.spellsKnown != null;
```

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `npx vitest run tests/components/builder/class-preview-modal.test.tsx`
Expected: PASS — all 5 tests.

- [ ] **Step 5: Commit.**

```bash
git add components/builder/class-preview-modal.tsx tests/components/builder/class-preview-modal.test.tsx
git commit -m "feat(builder): add tabs to ClassPreviewModal with caster gating"
```

---

## Task 5 — Overview tab body

**Files:**
- Create: `components/builder/class-preview-modal/overview-tab.tsx`
- Modify: `components/builder/class-preview-modal.tsx` (use the new tab component)

- [ ] **Step 1: Implement the Overview tab.**

```tsx
// components/builder/class-preview-modal/overview-tab.tsx
import type { ContentEntry } from "@/components/builder/content-browser";

interface OverviewTabProps {
  classContent: ContentEntry;
}

export function OverviewTab({ classContent }: OverviewTabProps) {
  const data = classContent.data as Record<string, unknown>;
  const description = typeof data.description === "string" ? data.description : null;
  const primaryAbility = typeof data.primaryAbility === "string" ? data.primaryAbility : null;
  const savingThrows = (data.saving_throws as string[] | undefined) ?? [];
  const hitDie = data.hit_die as number | undefined;

  return (
    <div className="space-y-4">
      {description && (
        <p className="text-sm leading-relaxed text-foreground">{description}</p>
      )}

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {hitDie != null && (
          <div className="flex justify-between sm:block">
            <dt className="text-muted-foreground">Hit die</dt>
            <dd className="sm:mt-0.5 font-medium">d{hitDie}</dd>
          </div>
        )}
        {primaryAbility && (
          <div className="flex justify-between sm:block">
            <dt className="text-muted-foreground">Primary ability</dt>
            <dd className="sm:mt-0.5 font-medium">{primaryAbility}</dd>
          </div>
        )}
        {savingThrows.length > 0 && (
          <div className="flex justify-between sm:block">
            <dt className="text-muted-foreground">Saving throws</dt>
            <dd className="sm:mt-0.5 font-medium capitalize">
              {savingThrows.join(", ")}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the modal — replace the Overview placeholder.**

In `components/builder/class-preview-modal.tsx`, add the import:

```tsx
import { OverviewTab } from "@/components/builder/class-preview-modal/overview-tab";
```

Replace this:

```tsx
          <TabsContent value="overview" className="overflow-y-auto px-6 py-4">
            <p className="text-sm text-muted-foreground">Overview tab — Task 5.</p>
          </TabsContent>
```

with:

```tsx
          <TabsContent value="overview" className="overflow-y-auto px-6 py-4">
            <OverviewTab classContent={classContent} />
          </TabsContent>
```

- [ ] **Step 3: Add a test that the Overview tab shows the description.**

Append to `tests/components/builder/class-preview-modal.test.tsx`:

```tsx
describe("ClassPreviewModal — overview tab", () => {
  it("shows the class description when present", () => {
    const paladin = makeClass({
      data: {
        hit_die: 10,
        primaryAbility: "STR + CHA",
        saving_throws: ["wisdom", "charisma"],
        description: "A holy warrior bound by an oath.",
        levels: [{ level: 1, features: [] }],
      },
    });
    render(
      <ClassPreviewModal
        open={true}
        classContent={paladin}
        features={[]}
        subclasses={[]}
        spells={[]}
        onCancel={vi.fn()}
        onPick={vi.fn()}
      />,
    );
    expect(
      screen.getByText("A holy warrior bound by an oath."),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the tests.**

Run: `npx vitest run tests/components/builder/class-preview-modal.test.tsx`
Expected: PASS — all 6 tests.

- [ ] **Step 5: Commit.**

```bash
git add components/builder/class-preview-modal/ components/builder/class-preview-modal.tsx tests/components/builder/class-preview-modal.test.tsx
git commit -m "feat(builder): Overview tab in ClassPreviewModal"
```

---

## Task 6 — Features tab body

**Files:**
- Create: `components/builder/class-preview-modal/features-tab.tsx`
- Modify: `components/builder/class-preview-modal.tsx`

- [ ] **Step 1: Implement the Features tab.**

```tsx
// components/builder/class-preview-modal/features-tab.tsx
import type { ContentEntry } from "@/components/builder/content-browser";

interface FeaturesTabProps {
  classContent: ContentEntry;
  features: ContentEntry[];
  previewLevel: number;
  previewSubclassSlug: string | null;
}

export function FeaturesTab({
  classContent,
  features,
  previewLevel,
  previewSubclassSlug,
}: FeaturesTabProps) {
  const data = classContent.data as Record<string, unknown>;
  const levels = (data.levels as Array<{ level: number; features: string[] }> | undefined) ?? [];

  const visibleByLevel = levels
    .filter((row) => row.level <= previewLevel)
    .map((row) => {
      const featureEntries = row.features
        .map((slug) => features.find((f) => f.slug === slug))
        .filter((f): f is ContentEntry => !!f)
        .filter((f) => {
          // Subclass-locked features only show if the user has previewed that subclass.
          const featureSubclass = (f.data as Record<string, unknown>).subclass as string | undefined;
          if (!featureSubclass) return true;
          return previewSubclassSlug === featureSubclass;
        });
      return { level: row.level, features: featureEntries };
    })
    .filter((row) => row.features.length > 0);

  if (visibleByLevel.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No features at this preview level.</p>
    );
  }

  return (
    <div className="space-y-5">
      {visibleByLevel.map(({ level, features: rowFeatures }) => (
        <section key={level}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Level {level}
          </h3>
          <ul className="space-y-2">
            {rowFeatures.map((feature) => {
              const featureData = feature.data as Record<string, unknown>;
              const description = typeof featureData.description === "string" ? featureData.description : null;
              return (
                <li
                  key={feature.id}
                  className="rounded-md border border-border bg-card/40 px-3 py-2"
                >
                  <p className="text-sm font-medium">{feature.name}</p>
                  {description && (
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {description}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Wire it in.**

In `components/builder/class-preview-modal.tsx`, add the import:

```tsx
import { FeaturesTab } from "@/components/builder/class-preview-modal/features-tab";
```

Replace the Features placeholder:

```tsx
          <TabsContent value="features" className="overflow-y-auto px-6 py-4">
            <FeaturesTab
              classContent={classContent}
              features={features}
              previewLevel={previewLevel}
              previewSubclassSlug={previewSubclassSlug}
            />
          </TabsContent>
```

- [ ] **Step 3: Add tests for level filter + subclass gate.**

Append to `tests/components/builder/class-preview-modal.test.tsx`:

```tsx
describe("ClassPreviewModal — features tab", () => {
  function setupPaladinWithFeatures() {
    const features: ContentEntry[] = [
      {
        id: "f1",
        name: "Divine Sense",
        slug: "divine-sense",
        content_type: "feature",
        data: { description: "Detect celestials, fiends, undead." },
        effects: [],
        version: 1,
        source: "srd",
      },
      {
        id: "f2",
        name: "Sacred Oath",
        slug: "sacred-oath",
        content_type: "feature",
        data: { description: "Pick an oath at level 3." },
        effects: [],
        version: 1,
        source: "srd",
      },
      {
        id: "f3",
        name: "Channel Divinity: Sacred Weapon",
        slug: "cd-sacred-weapon",
        content_type: "feature",
        data: { description: "Devotion oath feature.", subclass: "oath-of-devotion" },
        effects: [],
        version: 1,
        source: "srd",
      },
    ];
    const paladin = makeClass({
      data: {
        hit_die: 10,
        primaryAbility: "STR + CHA",
        levels: [
          { level: 1, features: ["divine-sense"] },
          { level: 3, features: ["sacred-oath", "cd-sacred-weapon"] },
        ],
      },
    });
    return { paladin, features };
  }

  it("hides features above the preview level", () => {
    const { paladin, features } = setupPaladinWithFeatures();
    render(
      <ClassPreviewModal
        open={true}
        classContent={paladin}
        features={features}
        subclasses={[]}
        spells={[]}
        onCancel={vi.fn()}
        onPick={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /features/i }));
    expect(screen.getByText("Divine Sense")).toBeInTheDocument();
    expect(screen.queryByText("Sacred Oath")).not.toBeInTheDocument();
  });

  it("hides subclass-locked features until the matching subclass is previewed", () => {
    const { paladin, features } = setupPaladinWithFeatures();
    const subclasses: ContentEntry[] = [
      {
        id: "sc1",
        name: "Oath of Devotion",
        slug: "oath-of-devotion",
        content_type: "subclass",
        data: { class: "paladin" },
        effects: [],
        version: 1,
        source: "srd",
      },
    ];
    render(
      <ClassPreviewModal
        open={true}
        classContent={paladin}
        features={features}
        subclasses={subclasses}
        spells={[]}
        onCancel={vi.fn()}
        onPick={vi.fn()}
      />,
    );
    // Bump the preview level to 3.
    fireEvent.change(screen.getByLabelText("Preview level"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("tab", { name: /features/i }));
    expect(screen.getByText("Sacred Oath")).toBeInTheDocument();
    // Subclass-locked feature is hidden until subclass picked.
    expect(screen.queryByText("Channel Divinity: Sacred Weapon")).not.toBeInTheDocument();

    // Pick the subclass on the Subclasses tab.
    fireEvent.click(screen.getByRole("tab", { name: /subclasses/i }));
    fireEvent.click(screen.getByRole("button", { name: /Oath of Devotion/i }));
    fireEvent.click(screen.getByRole("tab", { name: /features/i }));
    expect(screen.getByText("Channel Divinity: Sacred Weapon")).toBeInTheDocument();
  });
});
```

These tests **also** exercise the preview-level dropdown and the subclass tab interactions added in subsequent tasks — they will fail until those tasks land. That's intentional: it means a single suite verifies the integration end-to-end.

- [ ] **Step 4: Run the existing tests (the new tab-tests will fail; that's expected).**

Run: `npx vitest run tests/components/builder/class-preview-modal.test.tsx -t "features tab" --reporter=verbose 2>&1 | head -40`
Expected: At least the level-filter test FAILS at "Preview level" lookup (no dropdown yet); subclass test fails for the same reason. Other tests remain passing.

- [ ] **Step 5: Commit (with failing tests acknowledged).**

```bash
git add components/builder/class-preview-modal/features-tab.tsx components/builder/class-preview-modal.tsx tests/components/builder/class-preview-modal.test.tsx
git commit -m "feat(builder): Features tab in ClassPreviewModal (level + subclass aware)"
```

---

## Task 7 — Subclasses tab body

**Files:**
- Create: `components/builder/class-preview-modal/subclasses-tab.tsx`
- Modify: `components/builder/class-preview-modal.tsx`

- [ ] **Step 1: Implement the Subclasses tab.**

```tsx
// components/builder/class-preview-modal/subclasses-tab.tsx
import { cn } from "@/lib/utils";
import type { ContentEntry } from "@/components/builder/content-browser";

interface SubclassesTabProps {
  classContent: ContentEntry;
  subclasses: ContentEntry[];
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
}

export function SubclassesTab({
  classContent,
  subclasses,
  selectedSlug,
  onSelect,
}: SubclassesTabProps) {
  // Defensive filter — parent should have already filtered by class, but in
  // case it didn't.
  const matching = subclasses.filter(
    (sc) => (sc.data as Record<string, unknown>).class === classContent.slug,
  );

  if (matching.length === 0) {
    return <p className="text-sm text-muted-foreground">No subclasses found.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {matching.map((sc) => {
        const data = sc.data as Record<string, unknown>;
        const description = typeof data.description === "string" ? data.description : null;
        const isSelected = selectedSlug === sc.slug;
        return (
          <button
            key={sc.id}
            type="button"
            data-selected={isSelected || undefined}
            onClick={() => onSelect(isSelected ? null : sc.slug)}
            className={cn(
              "text-left rounded-md border bg-card/40 px-3 py-3 transition-colors",
              "border-border hover:border-accent/50",
              "data-[selected=true]:border-accent data-[selected=true]:bg-accent/10",
            )}
          >
            <p className="text-sm font-medium">{sc.name}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-3">
                {description}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Wire it in.**

In `components/builder/class-preview-modal.tsx`, add the import:

```tsx
import { SubclassesTab } from "@/components/builder/class-preview-modal/subclasses-tab";
```

Replace the Subclasses placeholder:

```tsx
          <TabsContent value="subclasses" className="overflow-y-auto px-6 py-4">
            <SubclassesTab
              classContent={classContent}
              subclasses={subclasses}
              selectedSlug={previewSubclassSlug}
              onSelect={setPreviewSubclassSlug}
            />
          </TabsContent>
```

- [ ] **Step 3: Add a test for subclass selection.**

Append to `tests/components/builder/class-preview-modal.test.tsx`:

```tsx
describe("ClassPreviewModal — subclasses tab", () => {
  it("toggles subclass selection on click", () => {
    const subclasses: ContentEntry[] = [
      {
        id: "sc1",
        name: "Oath of Devotion",
        slug: "oath-of-devotion",
        content_type: "subclass",
        data: { class: "paladin", description: "Holy paladin." },
        effects: [],
        version: 1,
        source: "srd",
      },
    ];
    render(
      <ClassPreviewModal
        open={true}
        classContent={makeClass()}
        features={[]}
        subclasses={subclasses}
        spells={[]}
        onCancel={vi.fn()}
        onPick={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /subclasses/i }));
    const card = screen.getByRole("button", { name: /Oath of Devotion/i });
    expect(card.dataset.selected).toBeUndefined();
    fireEvent.click(card);
    expect(card.dataset.selected).toBe("true");
    fireEvent.click(card);
    expect(card.dataset.selected).toBeUndefined();
  });
});
```

- [ ] **Step 4: Run the tests. The earlier subclass-gate Features tab test should now pass too.**

Run: `npx vitest run tests/components/builder/class-preview-modal.test.tsx -t "subclasses"`
Expected: subclasses tab test PASSES; features-tab subclass-locked test still fails (still no preview-level dropdown rendered — Task 9).

- [ ] **Step 5: Commit.**

```bash
git add components/builder/class-preview-modal/subclasses-tab.tsx components/builder/class-preview-modal.tsx tests/components/builder/class-preview-modal.test.tsx
git commit -m "feat(builder): Subclasses tab in ClassPreviewModal"
```

---

## Task 8 — Spells tab body (caster-only, with filters)

**Files:**
- Create: `components/builder/class-preview-modal/spells-tab.tsx`
- Modify: `components/builder/class-preview-modal.tsx`

- [ ] **Step 1: Implement the Spells tab.**

```tsx
// components/builder/class-preview-modal/spells-tab.tsx
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { ContentEntry } from "@/components/builder/content-browser";

interface SpellsTabProps {
  classContent: ContentEntry;
  spells: ContentEntry[];
}

const SCHOOLS = [
  "abjuration",
  "conjuration",
  "divination",
  "enchantment",
  "evocation",
  "illusion",
  "necromancy",
  "transmutation",
] as const;

export function SpellsTab({ classContent, spells }: SpellsTabProps) {
  const [levelFilter, setLevelFilter] = useState<number | "all">("all");
  const [schoolFilter, setSchoolFilter] = useState<string | "all">("all");

  // Spells are eligible for this class if the spell's `data.classes` array
  // includes the class slug. Tolerant if the array is missing.
  const eligible = useMemo(
    () =>
      spells.filter((spell) => {
        const classes = (spell.data as Record<string, unknown>).classes as string[] | undefined;
        return Array.isArray(classes) && classes.includes(classContent.slug);
      }),
    [spells, classContent.slug],
  );

  const filtered = useMemo(
    () =>
      eligible.filter((spell) => {
        const data = spell.data as Record<string, unknown>;
        const level = data.level as number | undefined;
        const school = (data.school as string | undefined)?.toLowerCase();
        if (levelFilter !== "all" && level !== levelFilter) return false;
        if (schoolFilter !== "all" && school !== schoolFilter) return false;
        return true;
      }),
    [eligible, levelFilter, schoolFilter],
  );

  const levels = Array.from(new Set(eligible.map((s) => (s.data as Record<string, unknown>).level as number | undefined)))
    .filter((l): l is number => typeof l === "number")
    .sort((a, b) => a - b);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          active={levelFilter === "all"}
          onClick={() => setLevelFilter("all")}
        >
          Level: all
        </FilterChip>
        {levels.map((lvl) => (
          <FilterChip
            key={lvl}
            active={levelFilter === lvl}
            onClick={() => setLevelFilter(lvl)}
          >
            {lvl === 0 ? "Cantrip" : `Lv ${lvl}`}
          </FilterChip>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          active={schoolFilter === "all"}
          onClick={() => setSchoolFilter("all")}
        >
          School: all
        </FilterChip>
        {SCHOOLS.map((s) => (
          <FilterChip
            key={s}
            active={schoolFilter === s}
            onClick={() => setSchoolFilter(s)}
          >
            <span className="capitalize">{s}</span>
          </FilterChip>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "spell" : "spells"}
      </p>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No spells match these filters.</p>
      ) : (
        <ul className="space-y-1.5">
          {filtered.map((spell) => {
            const data = spell.data as Record<string, unknown>;
            const level = data.level as number | undefined;
            const school = data.school as string | undefined;
            return (
              <li
                key={spell.id}
                className="flex items-baseline justify-between gap-3 rounded-md border border-border bg-card/40 px-3 py-2"
              >
                <span className="text-sm font-medium">{spell.name}</span>
                <span className="text-xs text-muted-foreground capitalize whitespace-nowrap">
                  {level === 0 ? "Cantrip" : `Lv ${level}`}
                  {school && ` · ${school}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-full text-xs border transition-colors",
        active
          ? "bg-accent/15 border-accent/50 text-accent"
          : "bg-transparent border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Wire it in.**

In `components/builder/class-preview-modal.tsx`, add the import:

```tsx
import { SpellsTab } from "@/components/builder/class-preview-modal/spells-tab";
```

Replace the Spells placeholder:

```tsx
          {isCaster && (
            <TabsContent value="spells" className="overflow-y-auto px-6 py-4">
              <SpellsTab classContent={classContent} spells={spells} />
            </TabsContent>
          )}
```

- [ ] **Step 3: Add a Spells filter test.**

Append to `tests/components/builder/class-preview-modal.test.tsx`:

```tsx
describe("ClassPreviewModal — spells tab", () => {
  it("filters spells by level chip", () => {
    const wizard = makeClass({
      slug: "wizard",
      name: "Wizard",
      data: {
        hit_die: 6,
        primaryAbility: "INT",
        spellsKnown: "all",
        levels: [{ level: 1, features: [] }],
      },
    });
    const spells: ContentEntry[] = [
      {
        id: "s1",
        name: "Mage Hand",
        slug: "mage-hand",
        content_type: "spell",
        data: { level: 0, school: "conjuration", classes: ["wizard"] },
        effects: [],
        version: 1,
        source: "srd",
      },
      {
        id: "s2",
        name: "Magic Missile",
        slug: "magic-missile",
        content_type: "spell",
        data: { level: 1, school: "evocation", classes: ["wizard"] },
        effects: [],
        version: 1,
        source: "srd",
      },
    ];
    render(
      <ClassPreviewModal
        open={true}
        classContent={wizard}
        features={[]}
        subclasses={[]}
        spells={spells}
        onCancel={vi.fn()}
        onPick={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /spells/i }));
    expect(screen.getByText("Mage Hand")).toBeInTheDocument();
    expect(screen.getByText("Magic Missile")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Cantrip$/ }));
    expect(screen.getByText("Mage Hand")).toBeInTheDocument();
    expect(screen.queryByText("Magic Missile")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the tests.**

Run: `npx vitest run tests/components/builder/class-preview-modal.test.tsx -t "spells tab"`
Expected: PASS — 1 test.

- [ ] **Step 5: Commit.**

```bash
git add components/builder/class-preview-modal/spells-tab.tsx components/builder/class-preview-modal.tsx tests/components/builder/class-preview-modal.test.tsx
git commit -m "feat(builder): Spells tab in ClassPreviewModal with level + school filters"
```

---

## Task 9 — Preview-level dropdown in footer

**Files:**
- Modify: `components/builder/class-preview-modal.tsx`

- [ ] **Step 1: Replace the empty footer slot with a real dropdown.**

In `components/builder/class-preview-modal.tsx`, replace this:

```tsx
          <div data-slot="preview-level-slot" />
```

with:

```tsx
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Preview as</span>
            <select
              aria-label="Preview level"
              value={previewLevel}
              onChange={(e) => setPreviewLevel(Number(e.target.value))}
              className="h-8 rounded-md border border-border bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {Array.from({ length: maxLevel }, (_, i) => i + 1).map((lvl) => (
                <option key={lvl} value={lvl}>
                  Lv {lvl}
                </option>
              ))}
            </select>
          </label>
```

- [ ] **Step 2: Run the suite — the previously-failing Features-tab tests should now pass.**

Run: `npx vitest run tests/components/builder/class-preview-modal.test.tsx`
Expected: PASS — all tests, including the level filter + subclass-gate combination test from Task 6.

- [ ] **Step 3: Commit.**

```bash
git add components/builder/class-preview-modal.tsx
git commit -m "feat(builder): preview-level dropdown in ClassPreviewModal footer"
```

---

## Task 10 — Pick / Cancel callback tests + reset-on-open test

**Files:**
- Modify: `tests/components/builder/class-preview-modal.test.tsx`

- [ ] **Step 1: Add tests for the callbacks and reset-on-open.**

Append to `tests/components/builder/class-preview-modal.test.tsx`:

```tsx
describe("ClassPreviewModal — callbacks", () => {
  it("calls onPick with the class slug and the current subclass selection", () => {
    const onPick = vi.fn();
    const subclasses: ContentEntry[] = [
      {
        id: "sc1",
        name: "Oath of Devotion",
        slug: "oath-of-devotion",
        content_type: "subclass",
        data: { class: "paladin" },
        effects: [],
        version: 1,
        source: "srd",
      },
    ];
    render(
      <ClassPreviewModal
        open={true}
        classContent={makeClass()}
        features={[]}
        subclasses={subclasses}
        spells={[]}
        onCancel={vi.fn()}
        onPick={onPick}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /subclasses/i }));
    fireEvent.click(screen.getByRole("button", { name: /Oath of Devotion/i }));
    fireEvent.click(screen.getByRole("button", { name: /Pick this class/i }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith({
      classSlug: "paladin",
      subclassSlug: "oath-of-devotion",
    });
  });

  it("calls onCancel and never onPick when Cancel is clicked", () => {
    const onCancel = vi.fn();
    const onPick = vi.fn();
    render(
      <ClassPreviewModal
        open={true}
        classContent={makeClass()}
        features={[]}
        subclasses={[]}
        spells={[]}
        onCancel={onCancel}
        onPick={onPick}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe("ClassPreviewModal — reset on open", () => {
  it("resets active tab and previewLevel when a different class is opened", () => {
    const paladin = makeClass();
    const wizard = makeClass({
      id: "c2",
      slug: "wizard",
      name: "Wizard",
      data: {
        hit_die: 6,
        primaryAbility: "INT",
        spellsKnown: "all",
        levels: [{ level: 1, features: [] }, { level: 2, features: [] }],
      },
    });
    const { rerender } = render(
      <ClassPreviewModal
        open={true}
        classContent={paladin}
        features={[]}
        subclasses={[]}
        spells={[]}
        onCancel={vi.fn()}
        onPick={vi.fn()}
      />,
    );
    // Move to features tab and bump level.
    fireEvent.click(screen.getByRole("tab", { name: /features/i }));
    fireEvent.change(screen.getByLabelText("Preview level"), { target: { value: "2" } });

    // Re-render with a different class (mimics opening a new card).
    rerender(
      <ClassPreviewModal
        open={true}
        classContent={wizard}
        features={[]}
        subclasses={[]}
        spells={[]}
        onCancel={vi.fn()}
        onPick={vi.fn()}
      />,
    );
    // Active tab should be reset to overview, preview level to 1.
    expect(screen.getByRole("tabpanel", { name: /overview/i })).toBeInTheDocument();
    expect((screen.getByLabelText("Preview level") as HTMLSelectElement).value).toBe("1");
  });
});
```

- [ ] **Step 2: Run the tests.**

Run: `npx vitest run tests/components/builder/class-preview-modal.test.tsx`
Expected: PASS — all tests.

- [ ] **Step 3: Commit.**

```bash
git add tests/components/builder/class-preview-modal.test.tsx
git commit -m "test(builder): callback + reset-on-open coverage for ClassPreviewModal"
```

---

## Task 11 — Wire ClassPreviewModal into the class step

**Files:**
- Modify: `app/(app)/characters/[id]/builder/class/class-step-client.tsx`
- Modify: `app/(app)/characters/[id]/builder/class/page.tsx`

The class step currently renders `<ContentPreview content={previewContent} ... />`. We replace that with `<ClassPreviewModal>`, load spells in the server component, and **extend `handleSelectClass`** to accept an optional `subclassSlug` so the class + subclass writes happen atomically. (Calling the existing `handleSubclassSelect` immediately after `handleSelectClass` would read stale closure state — `selectedClasses` doesn't reflect the just-added class until the next render.)

- [ ] **Step 1: Read the existing imports and `<ContentPreview>` render block to confirm the call site.**

Run: `grep -n "ContentPreview\|handleSelectClass" app/\(app\)/characters/\[id\]/builder/class/class-step-client.tsx`
Expected: shows the import line, the render line, and the `handleSelectClass` definition.

- [ ] **Step 2: Replace the `ContentPreview` import in `class-step-client.tsx`.**

Find:

```tsx
import { ContentPreview } from "@/components/builder/content-preview";
```

Replace with:

```tsx
import { ClassPreviewModal } from "@/components/builder/class-preview-modal";
```

- [ ] **Step 3: Add a `spells` prop loaded by the server `page.tsx`.**

In `app/(app)/characters/[id]/builder/class/page.tsx`, add a query for spells alongside the existing class/subclass/feature loads:

```ts
const { data: spells } = await supabase
  .from("content_definitions")
  .select("id, slug, name, content_type, data, effects, version, source")
  .eq("system_id", character.system_id)
  .eq("content_type", "spell")
  .order("name");
```

Then pass `spells={spells ?? []}` to `<ClassStepClient>`.

In `class-step-client.tsx`, add `spells: ContentEntry[];` to `ClassStepClientProps` and destructure it from props.

> If `class/page.tsx` does not follow this pattern, mirror `app/(app)/characters/[id]/builder/race/page.tsx`. The codebase convention is one server `page.tsx` + one client `*-step-client.tsx` per builder step.

- [ ] **Step 4: Extend `handleSelectClass` to accept an optional subclass.**

Find the existing `async function handleSelectClass(content: ContentEntry) { ... }` and replace it with:

```tsx
  async function handleSelectClass(
    content: ContentEntry,
    opts?: { subclassSlug?: string | null },
  ) {
    setPreviewContent(null);

    const subclassSlug = opts?.subclassSlug ?? undefined;
    const newClasses = [
      ...selectedClasses,
      { slug: content.slug, level: 1, subclass: subclassSlug },
    ];
    const totalLevel = newClasses.reduce((sum, c) => sum + c.level, 0);
    const newChoices = { ...localChoices, classes: newClasses };

    setLocalChoices(newChoices);
    setLocalLevel(totalLevel);

    // Persist character.choices + level
    await supabase
      .from("characters")
      .update({ choices: newChoices, level: totalLevel })
      .eq("id", characterId);

    // Class content_ref
    await supabase.from("character_content_refs").insert([
      {
        character_id: characterId,
        content_id: content.id,
        content_version: content.version,
        context: { source: "class", level: 1 },
      },
    ]);

    // Optional subclass content_ref — same shape handleSubclassSelect uses.
    if (subclassSlug) {
      const subclassContent = subclasses.find((sc) => sc.slug === subclassSlug);
      if (subclassContent) {
        await supabase.from("character_content_refs").insert([
          {
            character_id: characterId,
            content_id: subclassContent.id,
            content_version: subclassContent.version,
            context: { source: "subclass", class: content.slug },
          },
        ]);
      }
    }

    startTransition(() => router.refresh());
  }
```

This preserves the existing single-arg call sites (e.g. anywhere else that calls `handleSelectClass(content)` keeps working) while letting the modal pass a subclass through atomically.

- [ ] **Step 5: Replace the `<ContentPreview>` render block with `<ClassPreviewModal>`.**

In the JSX return, find the existing `<ContentPreview ...>` element and replace it with:

```tsx
      <ClassPreviewModal
        open={previewContent !== null}
        classContent={previewContent}
        features={features}
        subclasses={subclasses}
        spells={spells}
        onCancel={() => setPreviewContent(null)}
        onPick={({ subclassSlug }) => {
          if (!previewContent) return;
          // classSlug from the modal == previewContent.slug. We pass the
          // full ContentEntry to keep the existing handler signature.
          handleSelectClass(previewContent, { subclassSlug });
        }}
      />
```

- [ ] **Step 6: Run the build to confirm the swap compiles.**

Run: `npm run build 2>&1 | tail -10`
Expected: clean build (no TS errors). If `spells` isn't wired through `page.tsx`, fix that before continuing.

- [ ] **Step 7: Run the existing class-step tests (if any) + the new modal tests.**

Run: `npm test -- --run 2>&1 | tail -10`
Expected: all suites green, total count = previous count + new modal tests.

- [ ] **Step 8: Commit.**

```bash
git add app/\(app\)/characters/\[id\]/builder/class/class-step-client.tsx app/\(app\)/characters/\[id\]/builder/class/page.tsx
git commit -m "feat(builder): swap class step preview to ClassPreviewModal"
```

---

## Task 12 — Browser smoke test

**Files:**
- (no code changes — verification only)

- [ ] **Step 1: Start the dev server (or confirm one is running).**

Run: `mcp__Claude_Preview__preview_list`
If `inkborne-dev` is running, note the `serverId`. Otherwise: `mcp__Claude_Preview__preview_start name=inkborne-dev`.

- [ ] **Step 2: Navigate to the class step of a test character.**

In the dev preview: navigate to `/characters/<test-character-id>/builder/class`. Use any existing test character with no class yet, or create one via the dashboard.

- [ ] **Step 3: Click a class card to open the new modal.**

Verify the snapshot via `preview_snapshot`:
- Class name + emblem visible in identity strip.
- 4 tabs (or 3 for non-casters) rendered.
- Cancel + "Pick this class" buttons in the footer.
- Preview level dropdown in the footer left.

- [ ] **Step 4: Walk through interactions.**

- Click each tab; verify the body changes.
- On Features tab: change the preview level dropdown; verify higher-level features appear/disappear.
- On Subclasses tab: click a subclass; verify the card highlights. Switch to Features tab; verify subclass-locked features now appear.
- On Spells tab (caster only): click a level chip and a school chip; verify the list filters.

- [ ] **Step 5: Pick a class.**

Click "Pick this class". Verify:
- The modal closes.
- The selected class appears in the class step's existing list.
- If a subclass was picked in the modal, it is also reflected on the character.

- [ ] **Step 6: Take a screenshot for the PR.**

Run: `mcp__Claude_Preview__preview_screenshot serverId=<id>` and save the result. Attach in the PR description.

- [ ] **Step 7: Confirm Discord / console errors are clean.**

Run: `mcp__Claude_Preview__preview_console_logs serverId=<id> level=error`
Expected: no new errors introduced by the modal (pre-existing warnings are OK).

- [ ] **Step 8: Commit nothing (verification-only task), but post the screenshot in the PR description when opening the PR.**

---

## Task 13 — Open the PR

- [ ] **Step 1: Run the full test + build one last time.**

Run: `npm test -- --run 2>&1 | tail -5 && npm run build 2>&1 | tail -5`
Expected: tests green; clean build.

- [ ] **Step 2: Push the branch.**

```bash
git push -u origin feat/class-preview-modal
```

- [ ] **Step 3: Open the PR.**

```bash
gh pr create --base main --title "feat(builder): class preview modal (Variant B)" --body "$(cat <<'EOF'
## Summary
Implements PR-A of the Builder UX Polish phase (M2): the class preview dialog now uses the design team's Variant B layout — class identity strip with emblem, 4 tabs (Overview / Features / Subclasses / Spells), preview-as-level dropdown, sticky footer.

Spec: [docs/superpowers/specs/2026-04-27-class-preview-modal-design.md](docs/superpowers/specs/2026-04-27-class-preview-modal-design.md). Plan: [docs/superpowers/plans/2026-04-27-class-preview-modal.md](docs/superpowers/plans/2026-04-27-class-preview-modal.md).

## What changed
- New `components/builder/class-preview-modal.tsx` (and one file per tab) replaces the existing `ContentPreview` for the class step only. Race + background still use the old `ContentPreview`.
- New `components/builder/class-emblem.tsx` (reusable for the Class Step rail in PR-B).
- New `lib/builder/class-tone.ts` (gold/purple mapping).
- One-file integration in `class-step-client.tsx`. The existing `handleSelectClass` + `handleSubclassSelect` flow is reused — when the modal's Pick fires with a subclass, both wires run in sequence.

## Test plan
- [x] `npm test` — all tests green; ~10 new tests for the modal.
- [x] `npm run build` — clean.
- [x] Browser smoke: opened the modal in dev preview, walked all four tabs, level filter, subclass gating, and Pick. Screenshot below.

## Out of scope
- Race + background previews using the new pattern (later PR).
- Mobile bottom-sheet variant (PR-E in slice plan).
- Class Step rail / multiclass / level-up (PR-B+).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Wait for review. Address feedback in follow-up commits on the same branch; rebase only if requested.**

---

## Notes for the implementer

- **Don't extract a `ContentEntry` type yourself** — it's already exported from `components/builder/content-browser.tsx`. Import it from there.
- **The shadcn `Tabs` primitive (`@base-ui/react/tabs`) exposes `value` and `onValueChange`** — same API as Radix. Tabs render with `[role=tab]` / `[role=tabpanel]` automatically.
- **`autoFocus` on Cancel** sometimes fights with the Dialog's own focus restore. If you see Cancel not focused on first open, replace `autoFocus` with a `useEffect` that calls `cancelRef.current?.focus()` when `open` flips from false to true.
- **CRLF on Windows** — the repo's `.gitattributes` already forces LF for these files via project-wide rules. If a future contributor hits a CRLF warning on these files, add the path to `.gitattributes` rather than disable autocrlf.
- **Don't open multiple PRs from this plan.** It's a single branch (`feat/class-preview-modal`) producing a single PR. Each task = one commit.
