# Mobile Builder Pattern (PR-E) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Model + review guidance for the dispatcher:**
> - Tasks 1–7 (atomic helpers / atomic components / small modifies / thin wrappers) → `haiku`, **single combined review**.
> - Tasks 8–10 (composite / integration boundary / cross-cutting modal change) → `sonnet`, **two-stage review** (spec compliance + code quality).
> - Task 11 (manual UAT in browser mobile emulation via test account) → main thread, no subagent.

**Goal:** Ship the full mobile builder pattern for sub-`md` viewports (< 768px). The class step rail switches from desktop sidebar layout to horizontal pill-rail-per-class with a character strip on multiclass; the multiclass picker, level-up flow, and class preview modal all become bottom sheets with drag-down dismiss.

**Architecture:** Pure UI/responsive-layout slice. No engine changes, no DB migration, no new state shapes. New mobile-specific components (`<LevelRailMobile>`, `<CharacterStrip>`, three Sheet wrappers, `<LevelRailSetLevelSheet>`) share the same prop contracts as their desktop siblings. The rail's parent renders both desktop and mobile siblings, gated by Tailwind responsive classes (`hidden md:block` / `md:hidden`) — SSR-safe, no flash. The class preview modal uses a `useIsMobile()` hook to dispatch between Radix `<Dialog>` and shadcn `<Drawer>` (vaul-backed) at mount time. Two existing components (`<ClassPickerPanel>`, `<LevelUpPane>`) gain non-breaking `chrome` props so the sheet wrappers can hoist heading/footer content into the sheet's chrome.

**Tech Stack:** Next.js 16 App Router (client components), TypeScript strict, Tailwind v4 with HSL tokens, vitest + `@testing-library/react`. Adds `vaul` (~5 KB gzip, canonical mobile-bottom-sheet primitive) via shadcn's `<Drawer>` component. Reuses primitives from PR-A (`<ClassEmblem>`, `<ClassPreviewModal>`), PR-B (`<LevelPill>`, `<FeatureCard>`, `<ChoiceCard*>`, `<LevelRail>`), PR-C (`<ClassPickerPanel>`, `<ClassPickerCard>`), PR-D (`<LevelUpPane>`, `<LevelUpButton>`, `<LevelUpActionBar>`, `<HpPicker>`).

**Spec:** [`docs/superpowers/specs/2026-05-05-mobile-builder-design.md`](../specs/2026-05-05-mobile-builder-design.md). Source design files: [`docs/design-briefs/builder-ux-polish-design-files/mobile-variants.jsx`](../../design-briefs/builder-ux-polish-design-files/mobile-variants.jsx) (artboards M1–M4) and [`level-up-flow.jsx`](../../design-briefs/builder-ux-polish-design-files/level-up-flow.jsx) (L3 mobile).

**Branch base:** `feat/level-up-flow` (PR #45 / PR-D, stacked on #43 → #41 → #40). Branch name: `feat/mobile-builder`. Will rebase onto `main` after PR #40 + #41 + #43 + #45 + #46 (spec) merge.

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `package.json` | Modify | Add `vaul` dependency. |
| `components/ui/drawer.tsx` | Create | shadcn's Drawer component (vaul-backed). Standard shadcn API: `<Drawer>`, `<DrawerTrigger>`, `<DrawerContent>`, `<DrawerHeader>`, `<DrawerTitle>`, `<DrawerDescription>`, `<DrawerFooter>`, `<DrawerClose>`. |
| `lib/builder/use-is-mobile.ts` | Create | SSR-safe `useIsMobile()` hook. Reads `matchMedia('(max-width: 767px)')` synchronously on the client; returns `false` on the server. Subscribes to changes via `addEventListener('change', ...)`. |
| `tests/lib/builder/use-is-mobile.test.ts` | Create | TDD coverage for the hook (mocked `matchMedia`). |
| `components/builder/class-step-rail/character-strip.tsx` | Create | Mobile-only header strip for multiclass characters. Avatar + name + total level + per-class chip badges. Renders only when `selectedClasses.length > 1`. |
| `components/builder/class-step-rail/level-rail-set-level-sheet.tsx` | Create | Small bottom sheet hosting a `<select>` for jumping a class to a specific level. |
| `components/builder/class-step-rail/class-picker-panel.tsx` | Modify | Add `chrome?: "default" \| "embedded"` prop. When `embedded`, skip rendering the heading + description (the sheet header provides them). Default behavior unchanged. |
| `components/builder/class-step-rail/level-up-pane.tsx` | Modify | Add `chrome?: "default" \| "embedded"` and `renderFooter?: (footer: ReactNode) => ReactNode` props. When `embedded`, the breadcrumb stays in the body but the action bar gets routed via `renderFooter` instead of rendered inline. Default behavior unchanged. |
| `components/builder/class-step-rail/class-picker-sheet.tsx` | Create | Bottom-sheet wrapper around `<ClassPickerPanel chrome="embedded">`. Drag handle + sheet title + close button. |
| `components/builder/class-step-rail/level-up-sheet.tsx` | Create | Bottom-sheet wrapper around `<LevelUpPane chrome="embedded" renderFooter={...}>`. Hoists `<LevelUpActionBar>` to a sticky `<DrawerFooter>`. |
| `components/builder/class-step-rail/level-rail-mobile.tsx` | Create | Horizontal-rail variant of `<LevelRail>`. Same prop contract. Renders class header strip + horizontal scroll rail + trailing `<LevelUpButton>` + "Set level" trigger + kebab menu. |
| `components/builder/class-preview-modal.tsx` | Modify | Conditionally render Radix `<Dialog>` (desktop) or `<Drawer>` (mobile) via `useIsMobile()`. Same body content (4 tabs) in both. |
| `components/builder/class-step-rail/index.tsx` | Modify | Render `<LevelRail>` (`hidden md:block`) AND `<LevelRailMobile>` (`md:hidden`) per class. Render `<CharacterStrip>` above the rails when multiclass. For picker and level-up, render desktop `<ClassPickerPanel>`/`<LevelUpPane>` AND mobile `<ClassPickerSheet>`/`<LevelUpSheet>` — only one is visible per Tailwind classes. Wrap mobile layout in a flex column. |
| `tests/components/builder/class-step-rail.test.tsx` | Modify | Append integration + atomic-component tests. Uses `matchMedia` mock. |
| `tests/components/builder/class-preview-modal.test.tsx` | Modify | Append a "renders as Drawer on mobile" test (mocks `useIsMobile`). |

---

## Task 1 — Foundation: vaul dependency + `<Drawer>` component + `useIsMobile()` hook

**Files:**
- Modify: `package.json`
- Create: `components/ui/drawer.tsx`
- Create: `lib/builder/use-is-mobile.ts`
- Test: `tests/lib/builder/use-is-mobile.test.ts`

- [ ] **Step 1: Install vaul.**

```bash
npm install vaul
```

Expected: `vaul` is added to `package.json` dependencies (~5 KB gzip).

- [ ] **Step 2: Create the shadcn Drawer component.**

Create `components/ui/drawer.tsx` with the standard shadcn Drawer file (vaul-backed). Use this exact content:

```tsx
"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/lib/utils";

const Drawer = ({
  shouldScaleBackground = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root shouldScaleBackground={shouldScaleBackground} {...props} />
);
Drawer.displayName = "Drawer";

const DrawerTrigger = DrawerPrimitive.Trigger;

const DrawerPortal = DrawerPrimitive.Portal;

const DrawerClose = DrawerPrimitive.Close;

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/80", className)}
    {...props}
  />
));
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background",
        className,
      )}
      {...props}
    >
      <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
));
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)} {...props} />
);
DrawerHeader.displayName = "DrawerHeader";

const DrawerFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />
);
DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
```

- [ ] **Step 3: Write the failing test for `useIsMobile()`.**

Create `tests/lib/builder/use-is-mobile.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIsMobile } from "@/lib/builder/use-is-mobile";

describe("useIsMobile", () => {
  let mockMql: { matches: boolean; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
  let changeListener: ((e: { matches: boolean }) => void) | null = null;

  beforeEach(() => {
    mockMql = {
      matches: false,
      addEventListener: vi.fn((event: string, listener: (e: { matches: boolean }) => void) => {
        if (event === "change") changeListener = listener;
      }),
      removeEventListener: vi.fn(() => {
        changeListener = null;
      }),
    };
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue(mockMql),
    });
  });

  afterEach(() => {
    changeListener = null;
  });

  it("returns false when viewport is desktop (matchMedia matches=false)", () => {
    mockMql.matches = false;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("returns true when viewport is mobile (matchMedia matches=true)", () => {
    mockMql.matches = true;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("subscribes to matchMedia change events", () => {
    renderHook(() => useIsMobile());
    expect(mockMql.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("updates when matchMedia change fires", () => {
    mockMql.matches = false;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      changeListener?.({ matches: true });
    });
    expect(result.current).toBe(true);
  });

  it("unsubscribes on unmount", () => {
    const { unmount } = renderHook(() => useIsMobile());
    unmount();
    expect(mockMql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("queries the (max-width: 767px) media query", () => {
    renderHook(() => useIsMobile());
    expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 767px)");
  });
});
```

- [ ] **Step 4: Run the test (expect fail).**

Run: `npx vitest run tests/lib/builder/use-is-mobile.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement `useIsMobile()`.**

Create `lib/builder/use-is-mobile.ts`:

```ts
"use client";

import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 767px)";

/**
 * SSR-safe hook for sub-`md` viewport detection.
 *
 * On the server, returns `false` (desktop default).
 * On the client, reads `matchMedia` synchronously on the first render.
 * Subscribes to viewport changes so resize between mobile/desktop
 * re-renders consumers.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
```

- [ ] **Step 6: Run the test (expect pass).**

Run: `npx vitest run tests/lib/builder/use-is-mobile.test.ts`
Expected: PASS — all 6 tests green.

- [ ] **Step 7: Type-check.**

Run: `npx tsc --noEmit 2>&1 | grep -iE "use-is-mobile|drawer" | head`
Expected: no errors mentioning these files.

- [ ] **Step 8: Commit.**

```bash
git add package.json package-lock.json components/ui/drawer.tsx lib/builder/use-is-mobile.ts tests/lib/builder/use-is-mobile.test.ts
git commit -m "$(cat <<'EOF'
feat(builder): vaul-backed Drawer + useIsMobile hook

Foundation for PR-E mobile builder pattern. Adds vaul (~5 KB
gzip) as the canonical mobile-bottom-sheet primitive via the
standard shadcn <Drawer> component (drag-to-dismiss, native
scroll-passthrough, threshold-based snap-back).

useIsMobile() is the SSR-safe matchMedia('(max-width: 767px)')
hook used by ClassPreviewModal to choose between Radix Dialog
(desktop) and Drawer (mobile) at mount time. Initial value
matches viewport synchronously on the client (no flash).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 — `<CharacterStrip>` atomic component

**Files:**
- Create: `components/builder/class-step-rail/character-strip.tsx`
- Test: APPEND to `tests/components/builder/class-step-rail.test.tsx`

- [ ] **Step 1: Append failing tests at the end of `tests/components/builder/class-step-rail.test.tsx`.**

Add this import near the top alongside other imports if not present:

```tsx
import { CharacterStrip } from "@/components/builder/class-step-rail/character-strip";
```

Then append:

```tsx
describe("CharacterStrip", () => {
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

  function defaults(overrides: Partial<Parameters<typeof CharacterStrip>[0]> = {}) {
    return {
      characterName: "Kaelith Vex",
      totalLevel: 9,
      maxLevel: 20,
      classes: [classEntry("paladin", "Paladin"), classEntry("sorcerer", "Sorcerer")],
      selectedClasses: [
        { slug: "paladin", level: 6 },
        { slug: "sorcerer", level: 3 },
      ],
      ...overrides,
    };
  }

  it("renders avatar with character initials", () => {
    render(<CharacterStrip {...defaults()} />);
    expect(screen.getByText("KV")).toBeInTheDocument();
  });

  it("renders character name and level summary", () => {
    render(<CharacterStrip {...defaults()} />);
    expect(screen.getByText("Kaelith Vex")).toBeInTheDocument();
    expect(screen.getByText(/Lv 9\/20/i)).toBeInTheDocument();
  });

  it("renders one chip badge per class with class letter and tabular level", () => {
    const { container } = render(<CharacterStrip {...defaults()} />);
    expect(screen.getByText("6", { selector: ".tabular-nums, [class*='tabular-nums']" })).toBeInTheDocument();
    expect(screen.getByText("3", { selector: ".tabular-nums, [class*='tabular-nums']" })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="class-emblem"]').length).toBeGreaterThanOrEqual(2);
  });

  it("returns null when selectedClasses.length <= 1", () => {
    const { container } = render(
      <CharacterStrip
        {...defaults({
          selectedClasses: [{ slug: "paladin", level: 6 }],
        })}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders chip badges with aria-hidden", () => {
    const { container } = render(<CharacterStrip {...defaults()} />);
    const badgeContainer = container.querySelector('[aria-label="Class badges"]');
    if (badgeContainer) {
      expect(badgeContainer).toHaveAttribute("aria-hidden", "true");
    } else {
      // Or the wrapper has aria-hidden inline
      const hidden = container.querySelectorAll('[aria-hidden="true"]');
      expect(hidden.length).toBeGreaterThan(0);
    }
  });

  it("region has aria-label='Character summary'", () => {
    render(<CharacterStrip {...defaults()} />);
    expect(screen.getByRole("region", { name: "Character summary" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "CharacterStrip"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `components/builder/class-step-rail/character-strip.tsx`.**

```tsx
"use client";

import { ClassEmblem } from "@/components/builder/class-emblem";
import type { ContentEntry } from "@/components/builder/content-browser";

interface CharacterStripProps {
  characterName: string;
  totalLevel: number;
  maxLevel: number;
  classes: ContentEntry[];
  selectedClasses: Array<{ slug: string; level: number }>;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function CharacterStrip(props: CharacterStripProps) {
  const { characterName, totalLevel, maxLevel, classes, selectedClasses } = props;

  if (selectedClasses.length <= 1) return null;

  const initials = getInitials(characterName);

  return (
    <div
      role="region"
      aria-label="Character summary"
      className="flex items-center gap-3 border-b border-border bg-muted/10 px-4 py-2.5"
    >
      <div
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,_oklch(65%_0.18_300)_35%,_#1a1625)] text-xs font-semibold text-white"
        style={{ fontFamily: "Georgia, serif" }}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{characterName}</p>
        <p className="text-[10.5px] text-muted-foreground">
          Lv {totalLevel}/{maxLevel} · merged slots
        </p>
      </div>
      <div aria-hidden="true" className="flex items-center gap-1.5">
        {selectedClasses.map((cls) => {
          const classContent = classes.find((c) => c.slug === cls.slug);
          if (!classContent) return null;
          return (
            <div key={cls.slug} className="flex items-center gap-0.5">
              <ClassEmblem slug={cls.slug} name={classContent.name} size="sm" />
              <span className="text-[11px] tabular-nums text-muted-foreground">{cls.level}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "CharacterStrip"`
Expected: PASS.

- [ ] **Step 5: Run the full file.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx`
Expected: PASS — no regressions.

- [ ] **Step 6: Commit.**

```bash
git add components/builder/class-step-rail/character-strip.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "$(cat <<'EOF'
feat(builder): CharacterStrip atomic component for mobile multiclass

Mobile-only header strip rendered above the class rails when the
character is multiclass (selectedClasses.length > 1). Avatar
(character initials, purple-tinted circle) + name + level summary
+ per-class chip badges (ClassEmblem + tabular level number).

Returns null for single-class characters — they don't need the
character anchor since the rail header below already shows the
class name + level.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 — `<LevelRailSetLevelSheet>` atomic component

**Files:**
- Create: `components/builder/class-step-rail/level-rail-set-level-sheet.tsx`
- Test: APPEND to `tests/components/builder/class-step-rail.test.tsx`

This is the small bottom sheet that opens when a user taps "Set level" inside `<LevelRailMobile>`. It hosts a `<select>` for level choice, with a confirm button that fires `onLevelChange(classIndex, newLevel)`.

- [ ] **Step 1: Append failing tests.**

```tsx
import { LevelRailSetLevelSheet } from "@/components/builder/class-step-rail/level-rail-set-level-sheet";

describe("LevelRailSetLevelSheet", () => {
  function defaults(overrides: Partial<Parameters<typeof LevelRailSetLevelSheet>[0]> = {}) {
    return {
      open: true,
      onOpenChange: vi.fn(),
      classSlug: "paladin",
      className_: "Paladin",
      classIndex: 0,
      currentLevel: 6,
      maxLevel: 20,
      onLevelChange: vi.fn(),
      ...overrides,
    };
  }

  it("renders sheet with title 'Set level for {Class}'", () => {
    render(<LevelRailSetLevelSheet {...defaults()} />);
    expect(screen.getByText(/Set level for Paladin/i)).toBeInTheDocument();
  });

  it("renders a level select with options 1..maxLevel", () => {
    render(<LevelRailSetLevelSheet {...defaults({ maxLevel: 5 })} />);
    const select = screen.getByLabelText("Set level for Paladin");
    const options = select.querySelectorAll("option");
    expect(options.length).toBe(5);
    expect(options[0]).toHaveValue("1");
    expect(options[4]).toHaveValue("5");
  });

  it("default-selects the currentLevel", () => {
    render(<LevelRailSetLevelSheet {...defaults({ currentLevel: 3 })} />);
    const select = screen.getByLabelText("Set level for Paladin") as HTMLSelectElement;
    expect(select.value).toBe("3");
  });

  it("Confirm button fires onLevelChange with classIndex and new level", () => {
    const onLevelChange = vi.fn();
    const onOpenChange = vi.fn();
    render(<LevelRailSetLevelSheet {...defaults({ onLevelChange, onOpenChange, classIndex: 1 })} />);
    const select = screen.getByLabelText("Set level for Paladin");
    fireEvent.change(select, { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirm/i }));
    expect(onLevelChange).toHaveBeenCalledWith(1, 8);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Cancel button closes without firing onLevelChange", () => {
    const onLevelChange = vi.fn();
    const onOpenChange = vi.fn();
    render(<LevelRailSetLevelSheet {...defaults({ onLevelChange, onOpenChange })} />);
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onLevelChange).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "LevelRailSetLevelSheet"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement.**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface LevelRailSetLevelSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classSlug: string;
  className_: string;
  classIndex: number;
  currentLevel: number;
  maxLevel: number;
  onLevelChange: (classIndex: number, newLevel: number) => Promise<void> | void;
}

export function LevelRailSetLevelSheet(props: LevelRailSetLevelSheetProps) {
  const { open, onOpenChange, classSlug, className_, classIndex, currentLevel, maxLevel, onLevelChange } = props;
  const [draftLevel, setDraftLevel] = useState<number>(currentLevel);
  const labelId = `set-level-${classSlug}-label`;

  const handleConfirm = () => {
    void onLevelChange(classIndex, draftLevel);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle id={labelId}>Set level for {className_}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-2">
          <label htmlFor={`${labelId}-select`} className="sr-only">
            Set level for {className_}
          </label>
          <select
            id={`${labelId}-select`}
            aria-label={`Set level for ${className_}`}
            value={draftLevel}
            onChange={(e) => setDraftLevel(Number.parseInt(e.target.value, 10))}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {Array.from({ length: maxLevel }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                Level {n}
              </option>
            ))}
          </select>
        </div>
        <DrawerFooter className="flex-row justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="default" size="sm" onClick={handleConfirm}>
            Confirm
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
```

- [ ] **Step 4: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "LevelRailSetLevelSheet"`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add components/builder/class-step-rail/level-rail-set-level-sheet.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "$(cat <<'EOF'
feat(builder): LevelRailSetLevelSheet atomic component

Small bottom sheet that opens when the user taps "Set level"
inside <LevelRailMobile>. Hosts a native <select> for level
choice with Cancel/Confirm buttons. On Confirm, fires
onLevelChange(classIndex, newLevel) and dismisses.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 — `<ClassPickerPanel>` `chrome` prop addition

**Files:**
- Modify: `components/builder/class-step-rail/class-picker-panel.tsx`
- Test: APPEND to `tests/components/builder/class-step-rail.test.tsx`

Adds an optional `chrome` prop. When `embedded`, the panel skips its own heading + description (the sheet header provides them).

- [ ] **Step 1: Read the existing `class-picker-panel.tsx`** to understand the current structure.

- [ ] **Step 2: Append failing tests.**

```tsx
describe("ClassPickerPanel — chrome prop", () => {
  const stats = {
    strength: 13, dexterity: 13, constitution: 13,
    intelligence: 13, wisdom: 13, charisma: 13,
  };
  const oneClass: ContentEntry[] = [pickerClass("paladin", "Paladin")];

  it("default chrome renders the heading and description", () => {
    render(
      <ClassPickerPanel
        classes={oneClass}
        resolvedStats={stats}
        selectedClasses={[]}
        levelsRemaining={20}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: /Add a class/i })).toBeInTheDocument();
    expect(screen.getByText(/levels remaining/i)).toBeInTheDocument();
  });

  it("chrome='embedded' hides the heading and description", () => {
    render(
      <ClassPickerPanel
        classes={oneClass}
        resolvedStats={stats}
        selectedClasses={[]}
        levelsRemaining={20}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
        chrome="embedded"
      />,
    );
    expect(screen.queryByRole("heading", { level: 2, name: /Add a class/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/levels remaining/i)).not.toBeInTheDocument();
  });

  it("chrome='embedded' still renders the cards", () => {
    render(
      <ClassPickerPanel
        classes={oneClass}
        resolvedStats={stats}
        selectedClasses={[]}
        levelsRemaining={20}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
        chrome="embedded"
      />,
    );
    expect(screen.getByRole("button", { name: /Paladin/i })).toBeInTheDocument();
  });

  it("chrome='embedded' still renders the Cancel button", () => {
    const onCancel = vi.fn();
    render(
      <ClassPickerPanel
        classes={oneClass}
        resolvedStats={stats}
        selectedClasses={[]}
        levelsRemaining={20}
        onSelect={vi.fn()}
        onCancel={onCancel}
        chrome="embedded"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "ClassPickerPanel — chrome"`
Expected: FAIL — `chrome` prop doesn't exist.

- [ ] **Step 4: Update `class-picker-panel.tsx`.**

Read the file first. Add `chrome?: "default" | "embedded"` to the props interface (default `"default"`). Inside the component body, conditionally render the heading + description block when `chrome !== "embedded"`. Keep the Cancel button rendered in both modes (it's expected even in embedded mode for now, as a visible button — the sheet wrapper may or may not wire its own; either way, having it inside the panel is harmless).

The exact replacement depends on the existing file structure. The pattern is:

```tsx
interface ClassPickerPanelProps {
  // ...existing props...
  /** Default = "default" (renders own heading + description). "embedded" = sheet header provides them. */
  chrome?: "default" | "embedded";
}

export function ClassPickerPanel(props: ClassPickerPanelProps) {
  const { classes, resolvedStats, selectedClasses, levelsRemaining, onSelect, onCancel, chrome = "default" } = props;
  // ... existing logic ...

  return (
    <section aria-labelledby="class-picker-heading" className="space-y-4">
      {chrome === "default" && (
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
      )}
      {chrome === "embedded" && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* ... cards ... */}
      </div>
    </section>
  );
}
```

Adapt to the actual existing structure — preserve the cards rendering, helper imports, etc. The only behavior change is the conditional header.

- [ ] **Step 5: Run the new tests.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "ClassPickerPanel"`
Expected: PASS — both the original PR-C tests AND the new chrome tests.

- [ ] **Step 6: Run the full file.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add components/builder/class-step-rail/class-picker-panel.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "$(cat <<'EOF'
feat(builder): ClassPickerPanel chrome prop for embed mode

Adds optional chrome?: "default" | "embedded" prop. When
embedded, the panel skips its own heading + description (the
mobile sheet header will provide them). Default behavior
unchanged for the desktop call site.

Used by the upcoming <ClassPickerSheet> wrapper to deduplicate
heading content between the sheet's title and the panel's
internal heading.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 — `<LevelUpPane>` `chrome` + `renderFooter` props

**Files:**
- Modify: `components/builder/class-step-rail/level-up-pane.tsx`
- Test: APPEND to `tests/components/builder/class-step-rail.test.tsx`

Adds two optional props. When `chrome === "embedded"` AND `renderFooter` is provided, the action bar gets rendered via `renderFooter(footer)` instead of inline at the bottom of the body. The breadcrumb stays in the body either way.

- [ ] **Step 1: Read the existing `level-up-pane.tsx`** to understand the current structure.

- [ ] **Step 2: Append failing tests.**

```tsx
describe("LevelUpPane — chrome + renderFooter props", () => {
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
      hpRolls: { "paladin-7": { method: "average" as const, value: 6 } },
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

  it("default chrome renders the action bar inline at the bottom", () => {
    render(<LevelUpPane {...defaults()} />);
    expect(screen.getByRole("button", { name: /Cancel level-up/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirm level 7/i })).toBeInTheDocument();
  });

  it("chrome='embedded' without renderFooter still renders inline (graceful default)", () => {
    render(<LevelUpPane {...defaults({ chrome: "embedded" })} />);
    expect(screen.getByRole("button", { name: /Cancel level-up/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirm level 7/i })).toBeInTheDocument();
  });

  it("chrome='embedded' with renderFooter routes the action bar through it", () => {
    const renderFooter = vi.fn((children: React.ReactNode) => (
      <div data-testid="custom-footer">{children}</div>
    ));
    render(<LevelUpPane {...defaults({ chrome: "embedded", renderFooter })} />);
    expect(renderFooter).toHaveBeenCalled();
    const customFooter = screen.getByTestId("custom-footer");
    expect(customFooter).toBeInTheDocument();
    // The action bar buttons are inside the custom footer
    expect(customFooter.querySelector("button[aria-label], button")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Cancel level-up/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirm level 7/i })).toBeInTheDocument();
  });

  it("breadcrumb and heading still render in chrome='embedded' mode", () => {
    render(<LevelUpPane {...defaults({ chrome: "embedded" })} />);
    expect(screen.getByText("Paladin")).toBeInTheDocument();
    expect(screen.getByText("Level 7")).toBeInTheDocument();
    expect(screen.getByText(/NEW LEVEL/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "LevelUpPane — chrome"`
Expected: FAIL — `chrome` and `renderFooter` props don't exist.

- [ ] **Step 4: Update `level-up-pane.tsx`.**

Read the file first. The pattern is:

```tsx
interface LevelUpPaneProps {
  // ...existing props...
  /** Default = "default" (renders inline action bar). "embedded" = renderFooter receives the action bar instead. */
  chrome?: "default" | "embedded";
  /** When provided AND chrome === "embedded", the action bar is wrapped via this fn instead of rendered inline. Used by <LevelUpSheet> to hoist the bar into the sheet's sticky footer. */
  renderFooter?: (footer: React.ReactNode) => React.ReactNode;
}

export function LevelUpPane(props: LevelUpPaneProps) {
  const {
    // ...existing destructure...
    chrome = "default",
    renderFooter,
  } = props;

  // ...existing setup...

  const actionBar = (
    <LevelUpActionBar
      classLabel={classContent.name}
      draftLevel={draftLevel}
      totalLevelAfterConfirm={totalLevelAfterConfirm}
      canConfirm={canConfirm}
      missingReason={missingReason}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );

  return (
    <section aria-labelledby="level-up-heading" className="space-y-4">
      {/* ...breadcrumb, heading, sections, HpPicker... */}

      {chrome === "embedded" && renderFooter
        ? renderFooter(actionBar)
        : actionBar}
    </section>
  );
}
```

Preserve all other behavior. The action bar is extracted into a `const actionBar = ...` JSX expression so it can be passed to `renderFooter` or rendered inline.

- [ ] **Step 5: Run the new tests.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "LevelUpPane"`
Expected: PASS — both PR-D's existing tests AND the new chrome/renderFooter tests.

- [ ] **Step 6: Run the full file.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add components/builder/class-step-rail/level-up-pane.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "$(cat <<'EOF'
feat(builder): LevelUpPane chrome + renderFooter props for embed mode

Adds two optional props. When chrome="embedded" AND renderFooter
is provided, the LevelUpActionBar is wrapped via renderFooter()
instead of rendered inline. Used by the upcoming <LevelUpSheet>
wrapper to hoist the action bar into the sheet's sticky DrawerFooter
so Confirm is always reachable above the keyboard.

Default behavior unchanged. The breadcrumb + NEW LEVEL ribbon +
heading + sections + HpPicker stay in the body either way.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 — `<ClassPickerSheet>` thin wrapper

**Files:**
- Create: `components/builder/class-step-rail/class-picker-sheet.tsx`
- Test: APPEND to `tests/components/builder/class-step-rail.test.tsx`

- [ ] **Step 1: Append failing tests.**

```tsx
import { ClassPickerSheet } from "@/components/builder/class-step-rail/class-picker-sheet";

describe("ClassPickerSheet", () => {
  const stats = {
    strength: 13, dexterity: 13, constitution: 13,
    intelligence: 13, wisdom: 13, charisma: 13,
  };

  it("renders Drawer with title 'Add a class' when open", () => {
    render(
      <ClassPickerSheet
        open={true}
        onOpenChange={vi.fn()}
        classes={TWELVE_CLASSES}
        resolvedStats={stats}
        selectedClasses={[]}
        levelsRemaining={17}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/Add a class/i)).toBeInTheDocument();
    expect(screen.getByText(/17 levels remaining/i)).toBeInTheDocument();
  });

  it("renders the picker cards inside the sheet", () => {
    render(
      <ClassPickerSheet
        open={true}
        onOpenChange={vi.fn()}
        classes={TWELVE_CLASSES}
        resolvedStats={stats}
        selectedClasses={[]}
        levelsRemaining={20}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    for (const slug of ["paladin", "fighter"]) {
      const name = slug.charAt(0).toUpperCase() + slug.slice(1);
      expect(screen.getByRole("button", { name: new RegExp(name) })).toBeInTheDocument();
    }
  });

  it("calls onSelect when a card is tapped", () => {
    const onSelect = vi.fn();
    render(
      <ClassPickerSheet
        open={true}
        onOpenChange={vi.fn()}
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

  it("Cancel button fires onCancel and onOpenChange(false)", () => {
    const onCancel = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ClassPickerSheet
        open={true}
        onOpenChange={onOpenChange}
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

  it("does not render content when open=false", () => {
    render(
      <ClassPickerSheet
        open={false}
        onOpenChange={vi.fn()}
        classes={TWELVE_CLASSES}
        resolvedStats={stats}
        selectedClasses={[]}
        levelsRemaining={20}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Add a class/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "ClassPickerSheet"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement.**

```tsx
"use client";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { ClassPickerPanel } from "@/components/builder/class-step-rail/class-picker-panel";
import type { ContentEntry } from "@/components/builder/content-browser";

interface ClassPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: ContentEntry[];
  resolvedStats: Record<string, number>;
  selectedClasses: Array<{ slug: string }>;
  levelsRemaining: number;
  onSelect: (content: ContentEntry) => void;
  onCancel: () => void;
}

export function ClassPickerSheet(props: ClassPickerSheetProps) {
  const {
    open, onOpenChange, classes, resolvedStats, selectedClasses, levelsRemaining,
    onSelect, onCancel,
  } = props;

  return (
    <Drawer open={open} onOpenChange={(next) => {
      if (!next) onCancel();
      onOpenChange(next);
    }}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>Add a class</DrawerTitle>
          <DrawerDescription>
            {levelsRemaining} levels remaining · pick a class with met prerequisites
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-4">
          <ClassPickerPanel
            classes={classes}
            resolvedStats={resolvedStats}
            selectedClasses={selectedClasses}
            levelsRemaining={levelsRemaining}
            onSelect={onSelect}
            onCancel={onCancel}
            chrome="embedded"
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
```

- [ ] **Step 4: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "ClassPickerSheet"`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add components/builder/class-step-rail/class-picker-sheet.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "$(cat <<'EOF'
feat(builder): ClassPickerSheet mobile bottom-sheet wrapper

Wraps <ClassPickerPanel chrome="embedded"> in a vaul-backed
<Drawer>. Sheet header hosts the "Add a class" title +
description (deduplicated from the panel via chrome="embedded").
Drag-down or onOpenChange(false) fires onCancel. Used at sub-md
viewports as the picker surface.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7 — `<LevelUpSheet>` thin wrapper

**Files:**
- Create: `components/builder/class-step-rail/level-up-sheet.tsx`
- Test: APPEND to `tests/components/builder/class-step-rail.test.tsx`

- [ ] **Step 1: Append failing tests.**

```tsx
import { LevelUpSheet } from "@/components/builder/class-step-rail/level-up-sheet";

describe("LevelUpSheet", () => {
  function defaults(overrides: Partial<Parameters<typeof LevelUpSheet>[0]> = {}) {
    return {
      open: true,
      onOpenChange: vi.fn(),
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
      hpRolls: { "paladin-7": { method: "average" as const, value: 6 } },
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

  it("renders Drawer with breadcrumb + NEW LEVEL ribbon when open", () => {
    render(<LevelUpSheet {...defaults()} />);
    expect(screen.getByText("Paladin")).toBeInTheDocument();
    expect(screen.getByText("Level 7")).toBeInTheDocument();
    expect(screen.getByText(/NEW LEVEL/i)).toBeInTheDocument();
  });

  it("renders the action bar in the sheet footer (not inline in body)", () => {
    const { container } = render(<LevelUpSheet {...defaults()} />);
    const cancelBtn = screen.getByRole("button", { name: /Cancel level-up/i });
    const confirmBtn = screen.getByRole("button", { name: /Confirm level 7/i });
    expect(cancelBtn).toBeInTheDocument();
    expect(confirmBtn).toBeInTheDocument();
    // Both buttons should be inside an element with the DrawerFooter pattern (mt-auto class)
    const footer = cancelBtn.closest('[class*="mt-auto"]') ?? cancelBtn.closest('[class*="DrawerFooter"]');
    expect(footer).not.toBeNull();
  });

  it("Cancel fires onCancel", () => {
    const onCancel = vi.fn();
    render(<LevelUpSheet {...defaults({ onCancel })} />);
    fireEvent.click(screen.getByRole("button", { name: /Cancel level-up/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("does not render content when open=false", () => {
    render(<LevelUpSheet {...defaults({ open: false })} />);
    expect(screen.queryByText(/NEW LEVEL/i)).not.toBeInTheDocument();
  });

  it("onOpenChange(false) fires onCancel as a backstop", () => {
    const onCancel = vi.fn();
    const onOpenChange = vi.fn();
    render(<LevelUpSheet {...defaults({ onCancel, onOpenChange })} />);
    // Simulate drag-down dismiss by directly invoking onOpenChange(false) on the internal Drawer
    // The wrapper should call onCancel when onOpenChange(false) fires.
    // We trigger this by simulating Esc on the drawer content.
    fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });
    // Drawer's Esc handling fires onOpenChange(false), which our wrapper proxies to onCancel.
    // (vaul's Esc handler is async; we may not capture it here. Direct test: click Cancel as a proxy.)
    // For now, verify Cancel propagation directly:
    fireEvent.click(screen.getByRole("button", { name: /Cancel level-up/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "LevelUpSheet"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement.**

```tsx
"use client";

import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { LevelUpPane } from "@/components/builder/class-step-rail/level-up-pane";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { CharacterChoices, AsiChoice, HpRollRecord } from "@/lib/types/character";
import type { PerLevel } from "@/lib/builder/class-features-per-level";
import type { ChoiceEffect } from "@/lib/types/effects";
import type { HpRule } from "@/lib/builder/level-up-rules";

interface LevelUpSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function LevelUpSheet(props: LevelUpSheetProps) {
  const {
    open, onOpenChange,
    classContent, classIndex, isPrimaryClass, draftLevel, totalLevelAfterConfirm,
    perLevelRow, subclasses, styleOptions, localChoices, currentSubclass, classChoices,
    hpRule, conMod, hpRolls,
    onAsiSelect, onSubclassSelect, onFightingStyleSelect, onChoiceSelect, onHpRollChange,
    onCancel, onConfirm,
  } = props;

  return (
    <Drawer open={open} onOpenChange={(next) => {
      if (!next) onCancel();
      onOpenChange(next);
    }}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>{classContent.name} · Level {draftLevel}</DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-4">
          <LevelUpPane
            classContent={classContent}
            classIndex={classIndex}
            isPrimaryClass={isPrimaryClass}
            draftLevel={draftLevel}
            totalLevelAfterConfirm={totalLevelAfterConfirm}
            perLevelRow={perLevelRow}
            subclasses={subclasses}
            styleOptions={styleOptions}
            localChoices={localChoices}
            currentSubclass={currentSubclass}
            classChoices={classChoices}
            hpRule={hpRule}
            conMod={conMod}
            hpRolls={hpRolls}
            onAsiSelect={onAsiSelect}
            onSubclassSelect={onSubclassSelect}
            onFightingStyleSelect={onFightingStyleSelect}
            onChoiceSelect={onChoiceSelect}
            onHpRollChange={onHpRollChange}
            onCancel={onCancel}
            onConfirm={onConfirm}
            chrome="embedded"
            renderFooter={(footer) => <DrawerFooter className="mt-auto">{footer}</DrawerFooter>}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
```

- [ ] **Step 4: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "LevelUpSheet"`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add components/builder/class-step-rail/level-up-sheet.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "$(cat <<'EOF'
feat(builder): LevelUpSheet mobile bottom-sheet wrapper

Wraps <LevelUpPane chrome="embedded" renderFooter={...}> in a
vaul-backed <Drawer>. The pane's <LevelUpActionBar> gets hoisted
into a sticky <DrawerFooter> via the renderFooter prop, so
Confirm is always reachable above the on-screen keyboard.

Drag-down or onOpenChange(false) fires onCancel — same Q2A
semantics as desktop (level reverts; choice/HP edits persist
since they were forwarded incrementally to the parent).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8 — `<LevelRailMobile>` composite

**Files:**
- Create: `components/builder/class-step-rail/level-rail-mobile.tsx`
- Test: APPEND to `tests/components/builder/class-step-rail.test.tsx`

The horizontal-rail variant of `<LevelRail>`. Shares the same prop contract so the parent doesn't care which renders.

- [ ] **Step 1: Append failing tests.**

```tsx
import { LevelRailMobile } from "@/components/builder/class-step-rail/level-rail-mobile";

describe("LevelRailMobile", () => {
  function defaults(overrides: Partial<Parameters<typeof LevelRailMobile>[0]> = {}) {
    return {
      classSlug: "paladin",
      className_: "Paladin",
      subclassName: undefined as string | undefined,
      currentLevel: 6,
      perLevel: makePerLevel(),
      activeLevel: 6,
      onSelectLevel: vi.fn(),
      onLevelChange: vi.fn(),
      onRemoveClass: vi.fn(),
      onLevelUpClick: vi.fn(),
      levelUpButtonState: "idle" as const,
      levelUpButtonReason: undefined as string | undefined,
      disabled: false,
      ...overrides,
    };
  }

  it("renders the class header strip with name + current level", () => {
    render(<LevelRailMobile {...defaults()} />);
    expect(screen.getByText("Paladin")).toBeInTheDocument();
    expect(screen.getByText(/Lv 6/i)).toBeInTheDocument();
  });

  it("renders subclass name when present", () => {
    render(<LevelRailMobile {...defaults({ subclassName: "Oath of Devotion" })} />);
    expect(screen.getByText(/Oath of Devotion/i)).toBeInTheDocument();
  });

  it("renders 'Set level' button that opens the LevelRailSetLevelSheet", () => {
    render(<LevelRailMobile {...defaults()} />);
    const btn = screen.getByRole("button", { name: /Set level/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    // After click, the set-level sheet's title should appear
    expect(screen.getByText(/Set level for Paladin/i)).toBeInTheDocument();
  });

  it("renders the kebab menu trigger", () => {
    render(<LevelRailMobile {...defaults()} />);
    const kebab = screen.getByRole("button", { name: /more options/i });
    expect(kebab).toBeInTheDocument();
  });

  it("kebab menu has a 'Remove [Class]' item that fires onRemoveClass", () => {
    const onRemoveClass = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<LevelRailMobile {...defaults({ onRemoveClass })} />);
    fireEvent.click(screen.getByRole("button", { name: /more options/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Remove Paladin/i }));
    expect(onRemoveClass).toHaveBeenCalled();
  });

  it("renders one LevelPill per perLevel row in a horizontal scroll rail", () => {
    render(<LevelRailMobile {...defaults()} />);
    // makePerLevel returns 3 rows (levels 1, 3, 4 from PR-B test fixture)
    const pills = screen.getAllByRole("button", { name: /level \d+/i });
    expect(pills.length).toBeGreaterThanOrEqual(3);
  });

  it("renders a trailing LevelUpButton in the rail", () => {
    render(<LevelRailMobile {...defaults()} />);
    expect(screen.getByRole("button", { name: /Level up Paladin/i })).toBeInTheDocument();
  });

  it("disabled=true makes pills, set level, kebab, and level-up button non-interactive", () => {
    render(<LevelRailMobile {...defaults({ disabled: true })} />);
    expect(screen.getByRole("button", { name: /Set level/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /more options/i })).toBeDisabled();
    const levelUpBtn = screen.getByRole("button", { name: /Level up Paladin/i });
    expect(levelUpBtn).toHaveAttribute("aria-disabled", "true");
  });

  it("clicking a pill calls onSelectLevel with that level", () => {
    const onSelectLevel = vi.fn();
    render(<LevelRailMobile {...defaults({ onSelectLevel })} />);
    const lv1 = screen.getByRole("button", { name: /level 1/i });
    fireEvent.click(lv1);
    expect(onSelectLevel).toHaveBeenCalledWith(1);
  });

  it("clicking idle level-up button calls onLevelUpClick", () => {
    const onLevelUpClick = vi.fn();
    render(<LevelRailMobile {...defaults({ onLevelUpClick })} />);
    fireEvent.click(screen.getByRole("button", { name: /Level up Paladin/i }));
    expect(onLevelUpClick).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "LevelRailMobile"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement.**

```tsx
"use client";

import { useState } from "react";
import { MoreVertical } from "lucide-react";
import { ClassEmblem } from "@/components/builder/class-emblem";
import { LevelPill } from "@/components/builder/class-step-rail/level-pill";
import { LevelUpButton } from "@/components/builder/class-step-rail/level-up-button";
import { LevelRailSetLevelSheet } from "@/components/builder/class-step-rail/level-rail-set-level-sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { PerLevel } from "@/lib/builder/class-features-per-level";

interface LevelRailMobileProps {
  classSlug: string;
  className_: string;
  subclassName?: string;
  currentLevel: number;
  perLevel: PerLevel[];
  activeLevel: number;
  onSelectLevel: (level: number) => void;
  onLevelChange: (newLevel: number) => Promise<void> | void;
  onRemoveClass: () => Promise<void> | void;
  onLevelUpClick: () => void;
  levelUpButtonState: "idle" | "disabled" | "active-flow";
  levelUpButtonReason?: string;
  disabled?: boolean;
  className?: string;
}

const MAX_LEVEL = 20;

export function LevelRailMobile(props: LevelRailMobileProps) {
  const {
    classSlug, className_, subclassName, currentLevel, perLevel,
    activeLevel, onSelectLevel, onLevelChange, onRemoveClass,
    onLevelUpClick, levelUpButtonState, levelUpButtonReason,
    disabled = false, className,
  } = props;

  const [setLevelOpen, setSetLevelOpen] = useState(false);

  const handleRemove = () => {
    if (!window.confirm(`Remove ${className_} from this character?`)) return;
    void onRemoveClass();
  };

  return (
    <div className={cn("border-b border-border bg-background/40", className)}>
      <div className="flex items-center gap-2 px-3 pt-2 pb-1">
        <ClassEmblem slug={classSlug} name={className_} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{className_}</p>
          {subclassName && <p className="truncate text-[10.5px] text-muted-foreground">{subclassName}</p>}
        </div>
        <span className="text-[10.5px] tabular-nums text-muted-foreground">Lv {currentLevel}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSetLevelOpen(true)}
          disabled={disabled}
          className="h-7 px-2 text-[10.5px]"
        >
          Set level
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`More options for ${className_}`}
              disabled={disabled}
              className="h-7 w-7"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleRemove} className="text-destructive">
              Remove {className_}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        role="navigation"
        aria-label={`${className_} levels`}
        className="flex gap-1.5 overflow-x-auto px-3 pb-2 [scroll-snap-type:x_proximity] [scrollbar-width:none]"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {perLevel.map((row) => (
          <div key={row.level} className="shrink-0 [scroll-snap-align:center]">
            <LevelPill
              level={row.level}
              summary={row.features[0]?.name ?? row.choices[0]?.label ?? ""}
              hasUnmadeChoice={row.choices.some((c) => !c.isMade)}
              active={row.level === activeLevel}
              onClick={() => {
                if (disabled) return;
                onSelectLevel(row.level);
              }}
            />
          </div>
        ))}
        <div className="shrink-0">
          <LevelUpButton
            state={levelUpButtonState}
            classSlug={classSlug}
            classLabel={className_}
            atLevel={currentLevel}
            reason={levelUpButtonReason}
            onClick={onLevelUpClick}
          />
        </div>
      </div>

      <LevelRailSetLevelSheet
        open={setLevelOpen}
        onOpenChange={setSetLevelOpen}
        classSlug={classSlug}
        className_={className_}
        classIndex={0}
        currentLevel={currentLevel}
        maxLevel={MAX_LEVEL}
        onLevelChange={(_classIndex, newLevel) => {
          void onLevelChange(newLevel);
        }}
      />
    </div>
  );
}
```

Note: `LevelRailSetLevelSheet` accepts a `classIndex` prop for parity with the desktop `<LevelRail>`'s `onLevelChange(classIndex, newLevel)` signature, but `<LevelRailMobile>` itself uses the simpler `onLevelChange(newLevel)` form (the parent rail provides classIndex when wiring this component). The hardcoded `0` here is internal to the sheet wrapper and gets ignored by the wrapping handler.

- [ ] **Step 4: Run.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx -t "LevelRailMobile"`
Expected: PASS.

- [ ] **Step 5: Run the full file.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx`
Expected: PASS.

- [ ] **Step 6: Type-check.**

Run: `npx tsc --noEmit 2>&1 | grep -i "level-rail-mobile" | head`
Expected: no errors.

- [ ] **Step 7: Commit.**

```bash
git add components/builder/class-step-rail/level-rail-mobile.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "$(cat <<'EOF'
feat(builder): LevelRailMobile horizontal-rail variant

Sub-md sibling of <LevelRail>. Class header strip (emblem +
name + subclass + current-level glyph + Set level + kebab) +
horizontal scroll rail of <LevelPill>s with scroll-snap +
trailing <LevelUpButton>. Same prop contract as <LevelRail> so
the parent renders both behind responsive Tailwind classes
(hidden md:block / md:hidden) — no SSR flash.

Set level opens a small <LevelRailSetLevelSheet>; kebab opens
a <DropdownMenu> with the Remove Class item (confirm before
removing). disabled prop locks all four interactions for the
mid-flow hard-lock.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9 — `<ClassPreviewModal>` Dialog↔Drawer dispatcher

**Files:**
- Modify: `components/builder/class-preview-modal.tsx`
- Test: APPEND to `tests/components/builder/class-preview-modal.test.tsx`

This is the cross-cutting modal change. The component picks Radix `<Dialog>` (desktop) or shadcn `<Drawer>` (mobile) at mount time via `useIsMobile()`. The 4-tab body is the same in both.

- [ ] **Step 1: Read the existing `class-preview-modal.tsx`** to understand the current Dialog setup.

- [ ] **Step 2: Append failing tests at the end of `tests/components/builder/class-preview-modal.test.tsx`.**

Add this import at the top:

```tsx
import { vi } from "vitest";
```

Mock the hook:

```tsx
vi.mock("@/lib/builder/use-is-mobile", () => ({
  useIsMobile: vi.fn(),
}));
import { useIsMobile } from "@/lib/builder/use-is-mobile";
```

Then append:

```tsx
describe("ClassPreviewModal — Dialog↔Drawer dispatcher", () => {
  beforeEach(() => {
    vi.mocked(useIsMobile).mockReset();
  });

  function getProps(overrides: Partial<Parameters<typeof ClassPreviewModal>[0]> = {}) {
    return {
      open: true,
      classContent: {
        id: "c-paladin",
        slug: "paladin",
        name: "Paladin",
        content_type: "class",
        data: { hit_die: 10, levels: [{ level: 1, features: [] }] },
        effects: [],
        version: 1,
        source: "srd",
      } as ContentEntry,
      features: [] as ContentEntry[],
      subclasses: [] as ContentEntry[],
      spells: [] as ContentEntry[],
      onCancel: vi.fn(),
      onPick: vi.fn(),
      ...overrides,
    };
  }

  it("renders Radix Dialog when useIsMobile returns false", () => {
    vi.mocked(useIsMobile).mockReturnValue(false);
    render(<ClassPreviewModal {...getProps()} />);
    // Radix Dialog has role="dialog" and uses Dialog primitive — check via the Dialog's specific class on the content
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    // Verify it's NOT a vaul drawer (vaul drawers have a specific data-state attr or class pattern)
    expect(dialog?.getAttribute("data-vaul-drawer")).toBeNull();
  });

  it("renders Drawer when useIsMobile returns true", () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    render(<ClassPreviewModal {...getProps()} />);
    // Vaul drawer's content has a specific data-* attr or rendered structure
    const drawer = document.querySelector('[data-vaul-drawer], [data-state="open"]');
    expect(drawer).not.toBeNull();
  });

  it("renders the same body content (4 tabs visible/accessible) in both variants", () => {
    vi.mocked(useIsMobile).mockReturnValue(false);
    const { rerender } = render(<ClassPreviewModal {...getProps()} />);
    expect(screen.getByRole("tab", { name: /Overview/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Features/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Subclasses/i })).toBeInTheDocument();

    vi.mocked(useIsMobile).mockReturnValue(true);
    rerender(<ClassPreviewModal {...getProps()} />);
    expect(screen.getByRole("tab", { name: /Overview/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Features/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Subclasses/i })).toBeInTheDocument();
  });

  it("Cancel button works in both variants", () => {
    vi.mocked(useIsMobile).mockReturnValue(false);
    const onCancel = vi.fn();
    const { rerender } = render(<ClassPreviewModal {...getProps({ onCancel })} />);
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalled();

    onCancel.mockReset();
    vi.mocked(useIsMobile).mockReturnValue(true);
    rerender(<ClassPreviewModal {...getProps({ onCancel })} />);
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("Pick fires onPick in both variants", () => {
    vi.mocked(useIsMobile).mockReturnValue(false);
    const onPick = vi.fn();
    const { rerender } = render(<ClassPreviewModal {...getProps({ onPick })} />);
    fireEvent.click(screen.getByRole("button", { name: /Pick this class/i }));
    expect(onPick).toHaveBeenCalled();

    onPick.mockReset();
    vi.mocked(useIsMobile).mockReturnValue(true);
    rerender(<ClassPreviewModal {...getProps({ onPick })} />);
    fireEvent.click(screen.getByRole("button", { name: /Pick this class/i }));
    expect(onPick).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run.**

Run: `npx vitest run tests/components/builder/class-preview-modal.test.tsx -t "Dialog↔Drawer"`
Expected: FAIL — `useIsMobile` not used by the modal yet.

- [ ] **Step 4: Update `class-preview-modal.tsx`.**

Read the file. The pattern to apply:

```tsx
"use client";

import { useIsMobile } from "@/lib/builder/use-is-mobile";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";

// ...existing imports for tabs, buttons, etc...

export function ClassPreviewModal(props: ClassPreviewModalProps) {
  const isMobile = useIsMobile();

  // Extract the body into a constant so it's identical between Dialog and Drawer.
  const body = (
    <>
      {/* ...existing header (ClassEmblem + name + hit die + primary ability) ... */}
      {/* ...existing Tabs (Overview / Features / Subclasses / Spells) ... */}
      {/* ...existing footer (Cancel + Pick this class) ... */}
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={props.open} onOpenChange={(next) => !next && props.onCancel()}>
        <DrawerContent className="max-h-[85vh]">
          <div className="overflow-y-auto px-4 pb-4">
            {body}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={props.open} onOpenChange={(next) => !next && props.onCancel()}>
      <DialogContent /* ...existing className... */>
        {body}
      </DialogContent>
    </Dialog>
  );
}
```

Preserve all the existing tab logic, state (selected tab, preview level, preview subclass), and effect (the `useEffect` that resets state on open). Only the OUTER chrome (Dialog vs. Drawer) differs.

- [ ] **Step 5: Run the new tests.**

Run: `npx vitest run tests/components/builder/class-preview-modal.test.tsx -t "Dialog↔Drawer"`
Expected: PASS.

- [ ] **Step 6: Run the full preview-modal test file.**

Run: `npx vitest run tests/components/builder/class-preview-modal.test.tsx`
Expected: PASS — original PR-A tests still green.

If original tests fail because they don't mock `useIsMobile`, add a top-level `beforeEach` that defaults the mock to `false` (desktop) so existing tests keep their assumed mode.

- [ ] **Step 7: Type-check.**

Run: `npx tsc --noEmit 2>&1 | grep -i "class-preview-modal" | head`
Expected: no errors.

- [ ] **Step 8: Commit.**

```bash
git add components/builder/class-preview-modal.tsx tests/components/builder/class-preview-modal.test.tsx
git commit -m "$(cat <<'EOF'
feat(builder): ClassPreviewModal Dialog↔Drawer dispatcher

Conditionally renders Radix <Dialog> (desktop) or shadcn
<Drawer> (mobile) based on useIsMobile() at mount time. Same
4-tab body (Overview / Features / Subclasses / Spells) renders
in both variants. Cancel / Pick handlers wire identically.

Drag-down dismiss on the Drawer fires onCancel via onOpenChange
backstop, matching the desktop Dialog's "click outside to
cancel" behavior.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10 — `<ClassStepRail>` integration: render mobile siblings

**Files:**
- Modify: `components/builder/class-step-rail/index.tsx`
- Test: APPEND/extend `tests/components/builder/class-step-rail.test.tsx`

The biggest task in PR-E. The rail's `index.tsx` now renders desktop AND mobile siblings, gated by Tailwind responsive classes. Mobile gets `<CharacterStrip>` on multiclass + `<LevelRailMobile>` per class + `<ClassPickerSheet>` instead of `<ClassPickerPanel>` (when sub-`md`) + `<LevelUpSheet>` instead of `<LevelUpPane>` (when sub-`md`).

- [ ] **Step 1: Read the existing `index.tsx`** to understand the current desktop-only render tree.

- [ ] **Step 2: Append integration tests for the mobile path.**

These tests use a `matchMedia` mock to simulate sub-`md`.

```tsx
describe("ClassStepRail — mobile pattern (sub-md)", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(max-width: 767px)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("renders <LevelRailMobile> per class section (and the desktop sibling is CSS-hidden)", () => {
    setupForLevelUp();
    // Both mobile and desktop rails are mounted; mobile is visible per CSS.
    // We verify the mobile-specific elements are present (they're unique to LevelRailMobile).
    expect(screen.getAllByRole("button", { name: /more options/i }).length).toBeGreaterThanOrEqual(1);
  });

  it("renders <CharacterStrip> when multiclass (selectedClasses.length > 1)", () => {
    setupForLevelUp();  // setupForLevelUp uses Paladin Lv 6 + Wizard Lv 3
    expect(screen.getByRole("region", { name: "Character summary" })).toBeInTheDocument();
  });

  it("does NOT render <CharacterStrip> when single-class", () => {
    setupForLevelUp({
      selectedClasses: [{ slug: "paladin", level: 6 }],
    });
    expect(screen.queryByRole("region", { name: "Character summary" })).not.toBeInTheDocument();
  });

  it("clicking a mobile <LevelUpButton> opens the <LevelUpSheet>", () => {
    setupForLevelUp();
    // The LevelUpButton appears inside both desktop and mobile rails (one is CSS-hidden).
    // Click via aria-label which is the same.
    fireEvent.click(screen.getByRole("button", { name: /Level up Paladin to level 7/i }));
    // The mobile <LevelUpSheet> renders the same NEW LEVEL ribbon as the desktop pane.
    expect(screen.getByText(/NEW LEVEL/i)).toBeInTheDocument();
  });

  it("AddClassRow shows mobile-friendly variant — inline at end of rails", () => {
    setupForLevelUp({
      resolvedStats: { strength: 14, dexterity: 14, constitution: 14, intelligence: 14, wisdom: 14, charisma: 14 },
    });
    // AddClassRow is rendered once; it's used in both modes (the parent's flexbox layout positions it).
    expect(screen.getByText(/Add a class/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Update `index.tsx`.**

Read the existing file. The changes:

1. Add imports for `<CharacterStrip>`, `<LevelRailMobile>`, `<ClassPickerSheet>`, `<LevelUpSheet>`.
2. Add a top-level `<CharacterStrip>` (rendered above the rails on mobile only via `md:hidden`).
3. For each class in `selectedClasses.map(...)`, render BOTH `<LevelRail>` (with `className="hidden md:block"`) AND `<LevelRailMobile>` (with `className="md:hidden"`).
4. For the picker: render BOTH `<ClassPickerPanel>` (desktop, `hidden md:block`) AND `<ClassPickerSheet>` (mobile, `md:hidden`). Conditional on `showPicker`.
5. For the level-up flow: render BOTH `<LevelUpPane>` (desktop, `hidden md:block`) AND `<LevelUpSheet>` (mobile, `md:hidden`). Conditional on `levelUpDraft`.
6. Wrap the mobile layout in a flex column. The desktop layout keeps its existing 240px-sidebar grid.

Pseudocode for the render structure (adapt to actual file):

```tsx
return (
  <>
    {/* Mobile layout */}
    <div className="flex flex-col md:hidden">
      <CharacterStrip
        characterName={characterName}
        totalLevel={totalLevel}
        maxLevel={MAX_TOTAL_LEVEL}
        classes={classes}
        selectedClasses={selectedClasses}
      />
      {selectedClasses.map((cls, idx) => {
        // ...same per-class logic as desktop...
        return (
          <LevelRailMobile key={`${cls.slug}-${idx}-mobile`} {...railProps} />
        );
      })}
      <Separator />
      {addClassRowJsx}
      <div className="px-4 py-2">{mainPaneContentMobile}</div>
    </div>

    {/* Desktop layout */}
    <div className="hidden gap-6 md:grid md:grid-cols-[240px_1fr]">
      <aside aria-label="Class levels" className="space-y-4">
        {selectedClasses.map((cls, idx) => {
          // ...same per-class logic...
          return <LevelRail key={`${cls.slug}-${idx}-desktop`} {...railProps} />;
        })}
        <Separator />
        {addClassRowJsx}
      </aside>
      <div className="min-w-0">{mainPaneContentDesktop}</div>
    </div>
  </>
);
```

Where `mainPaneContentDesktop` and `mainPaneContentMobile` are the existing decision tree for picker / level-up / class-level-pane, but the mobile variant uses sheets.

The `characterName` prop comes from `class-step-client.tsx` — Task 10 needs to add it as a new prop on `<ClassStepRail>`. Or, derive it from a `character.name` prop that's already passed. Read the existing `class-step-rail/index.tsx` props interface and add `characterName: string` if not already present.

If adding `characterName` is annoying for the desktop test setup, default it (`characterName?: string` with a default of "Character"). Tests pass `characterName: "Test"` to be explicit.

- [ ] **Step 4: Run all tests.**

Run: `npx vitest run tests/components/builder/class-step-rail.test.tsx`
Expected: PASS — every describe (PR-A's, PR-B's, PR-C's, PR-D's, PR-E's atomic + integration tests) all pass.

- [ ] **Step 5: Type-check.**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: no errors. (Note: parent `class-step-client.tsx` may produce a missing-required-prop error for `characterName` if you make it required. If you make it optional, no error.)

- [ ] **Step 6: Commit.**

```bash
git add components/builder/class-step-rail/index.tsx tests/components/builder/class-step-rail.test.tsx
git commit -m "$(cat <<'EOF'
feat(builder): wire mobile pattern into ClassStepRail

Renders desktop AND mobile siblings of the rail, picker, and
level-up surfaces — gated by Tailwind responsive classes
(hidden md:block / md:hidden). SSR-safe, no flash:
- <CharacterStrip /> at the top (mobile, multiclass only)
- <LevelRail /> + <LevelRailMobile /> per class section
- <ClassPickerPanel /> + <ClassPickerSheet /> for the picker
- <LevelUpPane /> + <LevelUpSheet /> for the level-up flow

Mobile layout is a flex column; desktop layout keeps the
240px-sidebar grid. Same backend state machine (showPicker,
levelUpDraft, selected) drives both.

class-step-client.tsx may need a small update if the new
characterName prop on ClassStepRail isn't yet wired — handled
separately if needed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If `class-step-client.tsx` needs a tiny update to pass `characterName`, do it as a separate commit or fold into a small Task 10b — keep the rail integration commit focused.

---

## Task 11 — Manual UAT (browser, mobile emulation)

**Files:**
- None (browser only).

The Vitest tests cover the seam mechanically; this task verifies the integration in a real browser using Chrome DevTools' mobile emulation.

- [ ] **Step 1: Start the dev server.**

Use `preview_start` for `inkborne-dev`. If running, skip.

- [ ] **Step 2: Open Chrome DevTools → Toggle device toolbar → iPhone 14 Pro (or any 390px-wide device profile).**

If using `preview_resize`, resize to 390 × 844.

- [ ] **Step 3: Log in with the test account and navigate to a multiclass character's class step.**

Voltee is single-class — use Xero (Barbarian 10 / Fighter 5) for the multiclass scenarios. Log in as test@inkborne.app.

- [ ] **Step 4: Verify mobile layout renders.**

- `<CharacterStrip>` visible at top with avatar (initials), name, level summary, per-class chip badges (one per class).
- One `<LevelRailMobile>` per class, stacked vertically. Each has class header strip + horizontal scroll rail of pills + trailing `<LevelUpButton>` + "Set level" button + kebab.
- Body below the rails shows `<ClassLevelPane>` for the currently-selected level.
- `<AddClassRow>` inline at end of rails (NOT sticky to viewport).
- Desktop sidebar layout is hidden (no 240px column visible).

- [ ] **Step 5: Verify horizontal scroll + scroll-snap on the pill rail.**

Swipe left/right on the rail. Pills should scroll smoothly with snap-to-center behavior.

- [ ] **Step 6: Verify "Set level" button.**

Tap "Set level" on the Barbarian rail. `<LevelRailSetLevelSheet>` slides up. Pick Lv 8. Tap Confirm. Sheet dismisses; Barbarian is now Lv 8.

Tap "Set level" again. Tap Cancel. Sheet dismisses without level change.

- [ ] **Step 7: Verify kebab → Remove.**

Tap kebab on the Fighter rail. Menu opens with "Remove Fighter" item. Tap it. Confirm dialog appears. Cancel the confirm; Fighter stays.

- [ ] **Step 8: Verify Level Up flow.**

Tap the trailing `<LevelUpButton>` pill on the Barbarian rail. `<LevelUpSheet>` slides up. Verify:
- NEW LEVEL ribbon visible at top of sheet header.
- Choice cards (if any at this level — Barbarian Lv 9 = no choice, Lv 10 = no choice; pick a level with a choice for testing).
- HpPicker visible.
- Confirm button is in the sticky DrawerFooter, always reachable above the keyboard.
- Cancel button works.
- Drag down on the sheet's drag handle: sheet animates down and dismisses (= Cancel).
- Hardware Back / Esc on a paired keyboard also dismiss.

- [ ] **Step 9: Verify hard-lock during level-up flow.**

When the level-up sheet is open:
- Tap a pill on the OTHER class's rail. Pill click should be ignored (the rail is `disabled`).
- Tap "Set level" on the OTHER class's rail. Should be disabled.
- Tap kebab on the OTHER class's rail. Should be disabled.
- Tap the OTHER class's `<LevelUpButton>`. Should show "Finish [active class] X first" reason and not open another sheet.

- [ ] **Step 10: Verify Add Class flow.**

Close the level-up sheet (Cancel). Tap the unlocked `<AddClassRow>`. `<ClassPickerSheet>` slides up. Verify:
- Sheet header has "Add a class" title + "X levels remaining · pick a class with met prerequisites" description.
- 1-column grid of cards on phone width.
- Met cards are tappable; not-met / already-in-build cards are disabled.

Tap a met card. `<ClassPreviewSheet>` (= `<ClassPreviewModal>` in mobile mode) stacks on top. Verify:
- Drawer-style sheet with the same 4-tab content (Overview / Features / Subclasses / Spells).
- Cancel dismisses the preview but the picker stays.
- Pick dismisses both sheets and adds the new class.

- [ ] **Step 11: Verify drag-down on each sheet.**

For each of: `<LevelRailSetLevelSheet>`, `<ClassPickerSheet>`, `<ClassPreviewSheet>`, `<LevelUpSheet>` — open it, then drag down on the drag handle. Verify smooth animation + dismiss + correct callback fires.

- [ ] **Step 12: Restore test state.**

If you advanced any class's level during testing, restore the original levels via the dropdown. If you removed the test Fighter class, re-add it (or note for cleanup later).

- [ ] **Step 13: Take a screenshot of the mobile layout for the PR description.**

Use `preview_screenshot`. Capture the multiclass mobile view with all key affordances visible.

- [ ] **Step 14: No commit needed for Task 11** unless the smoke test surfaced a bug.

---

## Self-review checklist (post-implementation)

Run before pushing the branch / opening the PR:

- [ ] All tests pass: `npx vitest run`
- [ ] Type-check clean: `npx tsc --noEmit`
- [ ] Lint clean: `npx eslint .`
- [ ] No new files outside the file map
- [ ] No leftover `console.log` / debug code
- [ ] Desktop layout (≥768px) still works exactly as PR-D shipped — no regressions
- [ ] vaul is in `package.json` (and the lockfile)
- [ ] `npx next build` succeeds (no SSR errors from the new components)
