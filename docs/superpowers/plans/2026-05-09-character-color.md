# Character Primary Color Carry-Through Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship PR-F — every character has one user-pickable primary color stored as hex on the row; the color tints active states across the builder shell, class rail, primary CTAs, sheet header gradient, stat/ability accents, and action dots.

**Architecture:** One nullable `primary_color text` column on `public.characters`. Five CSS variables (`--character-color` plus four derived tones) set on two layout wrappers (sheet page + builder layout) and surfaced as Tailwind 4 theme tokens (`bg-character-bg`, `text-character-fg`, etc.). A click-the-avatar `<ColorPickerPopover>` on the sheet header writes hex back via a single `updateCharacterColor` helper. Default fallback to gold (`var(--accent)`) when null — existing characters render unchanged.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS 4 (`@theme inline`), shadcn/ui (adds `popover` primitive), Supabase Postgres (migration `00037`), Vitest + Testing Library.

**Spec:** [`docs/superpowers/specs/2026-05-09-character-color-design.md`](../specs/2026-05-09-character-color-design.md).

---

## File structure

### New files

| File | Responsibility |
|---|---|
| `supabase/migrations/00037_characters_primary_color.sql` | DB column + hex regex check constraint |
| `lib/character/character-color-style.ts` | `characterColorStyle(color)` → React.CSSProperties for layout wrappers |
| `lib/supabase/character-client.ts` | `updateCharacterColor(id, color)` — browser-side write helper used by the picker |
| `components/ui/popover.tsx` | shadcn `Popover` primitive (added via `npx shadcn add popover`) |
| `components/character/color-picker-popover.tsx` | Owner-only popover — 6 preset swatches + hex input + native color picker + reset |
| `tests/lib/character/character-color-style.test.ts` | Unit tests for the helper |
| `tests/lib/supabase/character-client.test.ts` | Unit tests for `updateCharacterColor` (mocked supabase) |
| `tests/components/character/color-picker-popover.test.tsx` | Unit tests for the picker |
| `tests/components/character/character-shell.test.tsx` | Snapshot test for sheet header gradient |

### Modified files

| File | What changes |
|---|---|
| `app/globals.css` | Add 5 `--character-*` variables to `:root` and `.dark`; register 5 `--color-character-*` Tailwind theme tokens in `@theme inline` |
| `lib/types/character.ts` | Add `primary_color: string \| null` to `Character` interface |
| `components/character/character-page-client.tsx` | Lift `primary_color` to local state; wrap `<CharacterProvider>` children in `<div style={characterColorStyle(primaryColor)}>`; pass `primaryColor` + `onPrimaryColorChange` to `<CharacterProvider>` |
| `lib/character/character-context.tsx` | Add `primaryColor` and `onPrimaryColorChange` to `CharacterProviderProps` and `CharacterContextValue`; expose via existing `useCharacter()` hook (or a new `useCharacterColor()` hook for explicit consumers) |
| `components/sheet/character-header.tsx` | Header background = gradient using `var(--character-color)`; avatar becomes `<ColorPickerPopover>` trigger for owners; rename to support tinting if existing classes conflict |
| `app/(app)/characters/[id]/builder/layout.tsx` | Fetch `character.primary_color`; wrap children in `<div style={characterColorStyle(...)}>` |
| `components/builder/builder-step-nav.tsx` | Active step link uses `bg-character-bg text-character-fg border-character-border`; in_progress dot uses `bg-character-fg` |
| `components/builder/class-step-rail/level-pill.tsx` | Active pill: character tone instead of class tone |
| `components/builder/class-step-rail/level-rail.tsx` | `<LevelUpButton>` idle state uses `bg-character-fg text-background` |
| `components/builder/class-step-rail/level-rail-mobile.tsx` | Same active-pill + level-up swaps as desktop |
| `components/builder/class-step-rail/class-level-pane.tsx` | Primary ability + saving throw chips use character tone (if chips render here) |
| `components/builder/class-step-rail/level-up-action-bar.tsx` | "Confirm level N" button uses `bg-character-fg text-background` |
| `components/builder/class-preview-modal.tsx` | "Pick this class" button uses `bg-character-fg text-background` |
| `app/(app)/characters/[id]/builder/race/race-step-client.tsx` | Continue button + selected card tint |
| `app/(app)/characters/[id]/builder/class/class-step-client.tsx` | Continue button (already touched in #49) |
| `app/(app)/characters/[id]/builder/abilities/abilities-step-client.tsx` | Continue button + any selected-state tinting |
| `app/(app)/characters/[id]/builder/background/background-step-client.tsx` | Continue button + selected card tint |
| `app/(app)/characters/[id]/builder/equipment/equipment-step-client.tsx` | Continue button |
| `tests/components/builder/class-step-rail.test.tsx` | New describe block: "character color carry-through" (~3 tests) |

---

## Task 1: Schema migration

**Files:**
- Create: `supabase/migrations/00037_characters_primary_color.sql`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/00037_characters_primary_color.sql`:

```sql
-- Add per-character primary color (hex string) for the carry-through UX.
-- Nullable; null renders as gold (var(--accent)) via the CSS fallback.
alter table public.characters
  add column primary_color text;

alter table public.characters
  add constraint characters_primary_color_format
  check (primary_color is null or primary_color ~ '^#[0-9a-fA-F]{6}$');
```

- [ ] **Step 2: Apply the migration to dev DB**

Use the Supabase MCP tool (CLI is not linked on this machine):

```
mcp__c36363d3-9454-4165-9c04-a1b85837d9e6__apply_migration
  project_id: etcaodglvcspcmwecyxq
  name: 00037_characters_primary_color
  query: <contents of the SQL file above>
```

Expected: success response from the MCP tool.

- [ ] **Step 3: Verify the column exists**

Use Supabase MCP `execute_sql`:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'characters' and column_name = 'primary_color';
```

Expected one row: `primary_color | text | YES`.

- [ ] **Step 4: Verify the check constraint fires on invalid input**

```sql
-- pick any existing character id (replace <ID>)
-- This should fail
update public.characters set primary_color = 'not-a-hex' where id = '<ID>';
```

Expected: error mentioning `characters_primary_color_format`.

Re-run with a valid hex to confirm it accepts:

```sql
update public.characters set primary_color = '#7c3aed' where id = '<ID>';
-- then reset for cleanliness:
update public.characters set primary_color = null where id = '<ID>';
```

Expected: first succeeds, second succeeds.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00037_characters_primary_color.sql
git commit -m "feat(db): add characters.primary_color column with hex check constraint"
```

---

## Task 2: Add primary_color to the Character type

**Files:**
- Modify: `lib/types/character.ts`

- [ ] **Step 1: Read the current Character interface**

```bash
grep -n "interface Character" lib/types/character.ts
```

Locate the `Character` interface (top of file). The current fields are: `id`, `user_id`, `system_id`, `campaign_id`, `name`, `visibility`, `archived`, `level`, `base_stats`, `choices`, `state`, `narrative`, `narrative_rich`.

- [ ] **Step 2: Add the new field after `narrative_rich`**

In `lib/types/character.ts`, modify the `Character` interface:

```ts
interface Character {
  // ... existing fields ...
  narrative_rich: NarrativeRichData;
  primary_color: string | null;
}
```

Comment for clarity:

```ts
  /** Per-character primary color (hex `#xxxxxx`) or null for the gold default. */
  primary_color: string | null;
```

- [ ] **Step 3: Confirm `CharacterWithSystem` picks it up automatically**

It extends `Character`, so no edit needed. Verify by grep:

```bash
grep -n "interface CharacterWithSystem" lib/types/character.ts
```

Confirms it extends `Character`.

- [ ] **Step 4: Run typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "character\.ts|primary_color" | head -10
```

Expected: no errors mentioning `character.ts` or `primary_color`. (Pre-existing fixture errors in `tests/resources/helpers.test.ts` and `tests/spells/helpers.test.ts` are unrelated.)

- [ ] **Step 5: Commit**

```bash
git add lib/types/character.ts
git commit -m "feat(types): add primary_color to Character interface"
```

---

## Task 3: `characterColorStyle` helper + tests (TDD)

**Files:**
- Create: `lib/character/character-color-style.ts`
- Create: `tests/lib/character/character-color-style.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/character/character-color-style.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { characterColorStyle } from "@/lib/character/character-color-style";

describe("characterColorStyle", () => {
  it("returns an empty object when primaryColor is null", () => {
    expect(characterColorStyle(null)).toEqual({});
  });

  it("returns a CSS variable map for a lowercase hex", () => {
    expect(characterColorStyle("#7c3aed")).toEqual({
      "--character-color": "#7c3aed",
    });
  });

  it("returns a CSS variable map for an uppercase hex", () => {
    expect(characterColorStyle("#7C3AED")).toEqual({
      "--character-color": "#7C3AED",
    });
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

```bash
npx vitest run tests/lib/character/character-color-style.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/character/character-color-style'" or similar.

- [ ] **Step 3: Implement the helper**

Create `lib/character/character-color-style.ts`:

```ts
import type { CSSProperties } from "react";

/**
 * Returns an inline-style object that sets `--character-color` for descendant
 * components to consume via the `--character-bg`, `--character-border`,
 * `--character-fg`, and `--character-muted` Tailwind theme tokens.
 *
 * When `primaryColor` is null, returns an empty object — descendants fall back
 * to the gold default defined in `app/globals.css`.
 */
export function characterColorStyle(
  primaryColor: string | null,
): CSSProperties {
  if (!primaryColor) return {};
  return { ["--character-color" as string]: primaryColor };
}
```

- [ ] **Step 4: Run the test — verify it passes**

```bash
npx vitest run tests/lib/character/character-color-style.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/character/character-color-style.ts tests/lib/character/character-color-style.test.ts
git commit -m "feat(character): add characterColorStyle helper + tests"
```

---

## Task 4: CSS variables + Tailwind theme tokens

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add the 5 character variables to `:root`**

Open `app/globals.css`. Locate the `:root { ... }` block (around line 51).

After the existing `--sidebar-ring: #7c3aed;` line and before the closing brace, add:

```css
  /* Character primary color — overridden per-character on a layout wrapper. */
  --character-color:  var(--accent);
  --character-bg:     color-mix(in oklab, var(--character-color) 14%, transparent);
  --character-border: color-mix(in oklab, var(--character-color) 45%, transparent);
  --character-fg:     var(--character-color);
  --character-muted:  color-mix(in oklab, var(--character-color) 70%, var(--muted-foreground));
```

- [ ] **Step 2: Add the same 5 variables to `.dark`**

Locate the `.dark { ... }` block (around line 88). Add the same five lines before the closing brace.

- [ ] **Step 3: Register the 5 Tailwind theme tokens**

Locate the `@theme inline { ... }` block at the top of the file (around line 7). Before the existing `--radius-sm: ...` line, add:

```css
  --color-character:        var(--character-color);
  --color-character-bg:     var(--character-bg);
  --color-character-border: var(--character-border);
  --color-character-fg:     var(--character-fg);
  --color-character-muted:  var(--character-muted);
```

- [ ] **Step 4: Verify Tailwind compiles**

```bash
npm run build 2>&1 | tail -15
```

Expected: build succeeds. If `color-mix` errors appear, check the syntax against the spec.

- [ ] **Step 5: Smoke-verify the utilities exist (manual)**

Quick check: create a throwaway HTML file or add a temporary `<div className="bg-character-bg">` somewhere and run dev. The div should render with a faint gold tint. Revert any throwaway changes. (Optional sanity check.)

- [ ] **Step 6: Commit**

```bash
git add app/globals.css
git commit -m "feat(styles): add --character-* CSS variables and Tailwind theme tokens"
```

---

## Task 5: Add shadcn `popover` primitive

**Files:**
- Create: `components/ui/popover.tsx` (via shadcn add)
- Modify: `package.json` (adds `@radix-ui/react-popover`)

- [ ] **Step 1: Add the popover primitive**

```bash
npx shadcn@latest add popover
```

If the CLI is interactive and asks about overwrite/config, accept defaults. The command creates `components/ui/popover.tsx` and installs `@radix-ui/react-popover`.

- [ ] **Step 2: Verify the file exists**

```bash
ls components/ui/popover.tsx
```

Expected: file exists.

- [ ] **Step 3: Run typecheck and tests to confirm nothing else broke**

```bash
npx tsc --noEmit 2>&1 | grep "popover\|character" | head -5
npx vitest run 2>&1 | tail -5
```

Expected: no new errors; existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add components/ui/popover.tsx package.json package-lock.json
git commit -m "feat(ui): add shadcn popover primitive (@radix-ui/react-popover)"
```

---

## Task 6: `updateCharacterColor` helper + tests (TDD)

**Files:**
- Create: `lib/supabase/character-client.ts`
- Create: `tests/lib/supabase/character-client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/supabase/character-client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the browser supabase client BEFORE importing the helper.
const mockEq = vi.fn();
const mockUpdate = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ update: mockUpdate }));
const mockClient = { from: mockFrom };

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

import { updateCharacterColor } from "@/lib/supabase/character-client";

describe("updateCharacterColor", () => {
  beforeEach(() => {
    mockEq.mockReset();
    mockUpdate.mockClear();
    mockFrom.mockClear();
  });

  it("writes the hex to the characters row", async () => {
    mockEq.mockResolvedValue({ error: null });
    await updateCharacterColor("char-123", "#7c3aed");
    expect(mockFrom).toHaveBeenCalledWith("characters");
    expect(mockUpdate).toHaveBeenCalledWith({ primary_color: "#7c3aed" });
    expect(mockEq).toHaveBeenCalledWith("id", "char-123");
  });

  it("writes null to clear the color", async () => {
    mockEq.mockResolvedValue({ error: null });
    await updateCharacterColor("char-123", null);
    expect(mockUpdate).toHaveBeenCalledWith({ primary_color: null });
  });

  it("throws when the supabase write errors", async () => {
    mockEq.mockResolvedValue({ error: { message: "RLS violation" } });
    await expect(updateCharacterColor("char-123", "#7c3aed")).rejects.toThrow("RLS violation");
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

```bash
npx vitest run tests/lib/supabase/character-client.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement the helper**

Create `lib/supabase/character-client.ts`:

```ts
import { createClient } from "@/lib/supabase/client";

/**
 * Browser-side helper to write a character's primary color.
 * Hex must match /^#[0-9a-fA-F]{6}$/ per the DB check constraint; pass null to clear.
 * RLS gates the write to the row owner.
 */
export async function updateCharacterColor(
  characterId: string,
  primaryColor: string | null,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("characters")
    .update({ primary_color: primaryColor })
    .eq("id", characterId);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4: Run the test — verify it passes**

```bash
npx vitest run tests/lib/supabase/character-client.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/character-client.ts tests/lib/supabase/character-client.test.ts
git commit -m "feat(character): add updateCharacterColor browser-side helper + tests"
```

---

## Task 7: `<ColorPickerPopover>` component + tests (TDD)

**Files:**
- Create: `components/character/color-picker-popover.tsx`
- Create: `tests/components/character/color-picker-popover.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/character/color-picker-popover.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorPickerPopover } from "@/components/character/color-picker-popover";

function renderPicker(overrides?: Partial<React.ComponentProps<typeof ColorPickerPopover>>) {
  const onChange = vi.fn();
  const utils = render(
    <ColorPickerPopover
      currentColor={null}
      onChange={onChange}
      {...overrides}
    >
      <button type="button">avatar</button>
    </ColorPickerPopover>,
  );
  return { onChange, ...utils };
}

describe("<ColorPickerPopover>", () => {
  it("renders the trigger children", () => {
    renderPicker();
    expect(screen.getByText("avatar")).toBeInTheDocument();
  });

  it("commits a preset hex on click", async () => {
    const { onChange } = renderPicker();
    fireEvent.click(screen.getByText("avatar"));
    const purpleBtn = await screen.findByLabelText(/Set character color to Purple/i);
    fireEvent.click(purpleBtn);
    expect(onChange).toHaveBeenCalledWith("#7c3aed");
  });

  it("commits a valid hex from the text input on blur", async () => {
    const { onChange } = renderPicker();
    fireEvent.click(screen.getByText("avatar"));
    const input = await screen.findByPlaceholderText("#xxxxxx");
    fireEvent.change(input, { target: { value: "#abc123" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith("#abc123");
  });

  it("flags an invalid hex via aria-invalid and does not commit", async () => {
    const { onChange } = renderPicker();
    fireEvent.click(screen.getByText("avatar"));
    const input = await screen.findByPlaceholderText("#xxxxxx");
    fireEvent.change(input, { target: { value: "not-hex" } });
    fireEvent.blur(input);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("commits null on Reset", async () => {
    const { onChange } = renderPicker({ currentColor: "#7c3aed" });
    fireEvent.click(screen.getByText("avatar"));
    const resetBtn = await screen.findByLabelText(/Reset character color/i);
    fireEvent.click(resetBtn);
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

```bash
npx vitest run tests/components/character/color-picker-popover.test.tsx
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement the component**

Create `components/character/color-picker-popover.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const PRESETS = [
  { name: "Gold", hex: "#c9a44a" },
  { name: "Purple", hex: "#7c3aed" },
  { name: "Red", hex: "#b91c1c" },
  { name: "Emerald", hex: "#059669" },
  { name: "Blue", hex: "#2563eb" },
  { name: "Magenta", hex: "#db2777" },
] as const;

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

export interface ColorPickerPopoverProps {
  currentColor: string | null;
  onChange: (color: string | null) => void;
  children: React.ReactNode; // the trigger (e.g., avatar)
}

export function ColorPickerPopover({
  currentColor,
  onChange,
  children,
}: ColorPickerPopoverProps) {
  const [hexInput, setHexInput] = useState(currentColor ?? "");

  // Keep the input in sync when the parent's color changes externally.
  useEffect(() => {
    setHexInput(currentColor ?? "");
  }, [currentColor]);

  const isHexValid = hexInput === "" || HEX_RE.test(hexInput);

  const commit = (color: string | null) => {
    onChange(color);
  };

  const commitHex = () => {
    if (hexInput === "") return;
    if (!isHexValid) return;
    const normalized = hexInput.startsWith("#") ? hexInput : `#${hexInput}`;
    commit(normalized.toLowerCase());
  };

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-3">
        <div className="space-y-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Character color
          </div>
          <div className="flex gap-1.5">
            {PRESETS.map((p) => {
              const isSelected = currentColor?.toLowerCase() === p.hex.toLowerCase();
              return (
                <button
                  key={p.hex}
                  type="button"
                  aria-label={`Set character color to ${p.name}`}
                  onClick={() => commit(p.hex)}
                  className={cn(
                    "h-[18px] w-[18px] rounded-full border border-border transition-shadow",
                    isSelected && "ring-1 ring-white/70 ring-offset-1 ring-offset-popover",
                  )}
                  style={{ backgroundColor: p.hex }}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              onBlur={commitHex}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitHex();
                }
              }}
              aria-invalid={!isHexValid}
              className={cn(
                "h-7 w-24 rounded border px-2 font-mono text-xs uppercase",
                "bg-background text-foreground",
                isHexValid ? "border-border" : "border-destructive",
              )}
              placeholder="#xxxxxx"
              maxLength={7}
              spellCheck={false}
            />
            <label
              className="relative h-6 w-6 cursor-pointer overflow-hidden rounded border border-border"
              style={{ backgroundColor: currentColor ?? "transparent" }}
              aria-label="Open native color picker"
            >
              <input
                type="color"
                value={currentColor ?? "#c9a44a"}
                onChange={(e) => commit(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
            <button
              type="button"
              aria-label="Reset character color to default"
              onClick={() => commit(null)}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            >
              Reset
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Run the test — verify it passes**

```bash
npx vitest run tests/components/character/color-picker-popover.test.tsx
```

Expected: 5 passed.

If anything fails, check the test selectors match the rendered output (Testing Library's a11y queries).

- [ ] **Step 5: Commit**

```bash
git add components/character/color-picker-popover.tsx tests/components/character/color-picker-popover.test.tsx
git commit -m "feat(character): add <ColorPickerPopover> with preset/hex/native picker + tests"
```

---

## Task 8: Plumb `primaryColor` through `CharacterPageClient` + `CharacterProvider`

**Background:** `<CharacterShell>` takes no props — it reads everything from `useCharacter()` (the context exposed by `<CharacterProvider>` in `lib/character/character-context.tsx`). So the color state must be lifted into `CharacterPageClient` and threaded through `CharacterProvider`'s prop list + context value, then consumed by the header via `useCharacter()`.

**Files:**
- Modify: `components/character/character-page-client.tsx`
- Modify: `lib/character/character-context.tsx`

- [ ] **Step 1: Add fields to `CharacterProviderProps` and `CharacterContextValue` in `lib/character/character-context.tsx`**

Open `lib/character/character-context.tsx`. In `CharacterProviderProps` (around line 154):

```ts
export interface CharacterProviderProps {
  // ... existing fields ...
  primaryColor: string | null;
  onPrimaryColorChange: (color: string | null) => void;
}
```

In `CharacterContextValue` (search for the interface — it's the value returned by `useCharacter()`):

```ts
interface CharacterContextValue {
  // ... existing fields ...
  primaryColor: string | null;
  setPrimaryColor: (color: string | null) => void;
}
```

In the `CharacterProvider` function body, destructure the new props and include them in the context `value`:

```tsx
export function CharacterProvider({
  // ... existing fields ...
  primaryColor,
  onPrimaryColorChange,
  children,
}: CharacterProviderProps) {
  // ... existing state and helpers ...

  const value: CharacterContextValue = {
    // ... existing fields ...
    primaryColor,
    setPrimaryColor: onPrimaryColorChange,
  };

  return <CharacterContext.Provider value={value}>{children}</CharacterContext.Provider>;
}
```

- [ ] **Step 2: Lift `primaryColor` state in `CharacterPageClient`**

Open `components/character/character-page-client.tsx`. Add `useState` import. Inside the component body, before the `return`:

```tsx
import { useState } from "react";
import { characterColorStyle } from "@/lib/character/character-color-style";

// ... inside CharacterPageClient ...
const [primaryColor, setPrimaryColor] = useState<string | null>(
  character.primary_color ?? null,
);
```

- [ ] **Step 3: Pass the new props to `<CharacterProvider>` and wrap in the style div**

Replace the existing `return` with:

```tsx
return (
  <div style={characterColorStyle(primaryColor)}>
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
      initialSpells={initialSpells}
      classData={classData}
      primaryColor={primaryColor}
      onPrimaryColorChange={setPrimaryColor}
    >
      <CharacterShell />
    </CharacterProvider>
  </div>
);
```

- [ ] **Step 4: Run typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "character-page-client|character-context" | head -10
```

Expected: no errors.

- [ ] **Step 5: Run existing character tests**

```bash
npx vitest run tests/components/character/ tests/components/sheet/ 2>&1 | tail -10
```

Expected: passing. Any test that builds a `CharacterProvider` directly with hand-rolled props will need the two new fields added — update those test fixtures.

If a test fixture file like `tests/__fixtures__/character-context.ts` exists, add the new props with defaults (`primaryColor: null`, `onPrimaryColorChange: () => {}`).

- [ ] **Step 6: Commit**

```bash
git add components/character/character-page-client.tsx lib/character/character-context.tsx tests/
git commit -m "feat(character): lift primaryColor state in CharacterPageClient + thread through CharacterProvider context"
```

---

## Task 9: Sheet header gradient + integrate `<ColorPickerPopover>`

**Background:** The header is `components/sheet/character-header.tsx` (NOT `character-shell.tsx`). It currently takes `character`, `inspiration`, `onToggleInspiration`, `mobile`, `portraitUrl`, `portraitCrop` as props. It does NOT yet consume `useCharacter()` for color — we'll add that consumption in this task.

**Files:**
- Modify: `components/sheet/character-header.tsx`
- Create: `tests/components/sheet/character-header.test.tsx`

- [ ] **Step 1: Locate the header element in `character-header.tsx`**

```bash
sed -n '50,140p' components/sheet/character-header.tsx
```

Find the outer `<header>` (or `<div>` acting as header) plus the `PortraitAvatar` element. Note its existing className/style so you don't lose layout.

- [ ] **Step 2: Pull `primaryColor`, `setPrimaryColor`, `isOwner` from `useCharacter()`**

At the top of the file, import:

```tsx
import { useCharacter } from "@/lib/character/character-context";
import { ColorPickerPopover } from "@/components/character/color-picker-popover";
import { updateCharacterColor } from "@/lib/supabase/character-client";
```

Inside the `CharacterHeader` function body, before the return:

```tsx
const { primaryColor, setPrimaryColor, isOwner } = useCharacter();

const handleColorChange = async (color: string | null) => {
  const prev = primaryColor;
  setPrimaryColor(color); // optimistic
  try {
    await updateCharacterColor(character.id, color);
  } catch (err) {
    setPrimaryColor(prev); // revert
    console.error("Failed to save character color:", err);
  }
};
```

- [ ] **Step 3: Apply the gradient to the outer header element**

Find the outermost element that visually represents the header bar (the one with the avatar + name + level). Add the inline style:

```tsx
<header
  style={{
    background:
      "linear-gradient(135deg, var(--character-color) 0%, color-mix(in oklab, var(--character-color) 55%, var(--background)) 100%)",
  }}
  className={cn(
    /* ... existing classes minus any conflicting bg-* class */
  )}
>
```

Remove any existing `bg-card` / `bg-primary` / `bg-background` from the className on this element.

- [ ] **Step 4: Wrap `<PortraitAvatar>` (or whatever the avatar element is) in `<ColorPickerPopover>` for owners**

```tsx
const avatarEl = (
  <PortraitAvatar
    /* existing props — keep them all */
  />
);

return (
  <header style={{ background: /* gradient from Step 3 */ }} className={/* ... */}>
    {/* ... back button or eyebrow ... */}
    {isOwner ? (
      <ColorPickerPopover currentColor={primaryColor} onChange={handleColorChange}>
        <button
          type="button"
          className="rounded-full focus-visible:ring-2 focus-visible:ring-white/60"
          aria-label="Change character color"
        >
          {avatarEl}
        </button>
      </ColorPickerPopover>
    ) : (
      avatarEl
    )}
    {/* ... rest of header (name, level, etc.) ... */}
  </header>
);
```

If the avatar already lives inside another wrapper (e.g., a `<Link>`), preserve that wrapper — put the popover trigger BETWEEN the wrapper and the avatar, not around the wrapper.

- [ ] **Step 5: Update text contrast inside the header**

Find name + level + tagline text. Replace `text-foreground` (or whatever the current foreground class is) with `text-white`:

```tsx
<h1 className={cn("text-white text-lg font-semibold", /* preserve existing layout classes */)}>
  {character.name}
</h1>
<p className="text-white/85 text-xs">{classDisplay}</p>
```

(Use the existing structure — don't restructure the header. Just swap text color classes.)

If the header has an Edit / Pencil button or Back arrow that was `text-foreground`, switch those to `text-white` (or `text-white/85`) too.

- [ ] **Step 6: Write a snapshot test**

Create `tests/components/sheet/character-header.test.tsx`. This component requires `<CharacterProvider>` context to render — wrap it in the test:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CharacterProvider } from "@/lib/character/character-context";
import { CharacterHeader } from "@/components/sheet/character-header";
import type { CharacterWithSystem } from "@/lib/types/character";

const mockCharacter = {
  id: "char-1",
  user_id: "user-1",
  system_id: "system-1",
  campaign_id: null,
  name: "Test Character",
  visibility: "private",
  archived: false,
  level: 1,
  base_stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
  choices: { classes: [] },
  state: {},
  narrative: {},
  narrative_rich: {},
  primary_color: null,
  game_systems: { id: "system-1", name: "D&D 5e", slug: "dnd-5e", schema_definition: { abilities: ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] } as any },
} as unknown as CharacterWithSystem;

function wrap(children: React.ReactNode, providerOverrides: Partial<React.ComponentProps<typeof CharacterProvider>> = {}) {
  return render(
    <CharacterProvider
      character={mockCharacter}
      schema={{ abilities: ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] } as any}
      contentRefs={[]}
      initialState={{} as any}
      initialInventory={[]}
      initialSpells={[]}
      classData={{} as any}
      allEffects={[]}
      baseStatsWithLevel={{ level: 1, strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 }}
      structuredSources={{} as any}
      isOwner={false}
      isDm={false}
      hasSheet={true}
      maxHp={10}
      primaryColor={null}
      onPrimaryColorChange={() => {}}
      {...providerOverrides}
    >
      {children}
    </CharacterProvider>,
  );
}

describe("<CharacterHeader> color carry-through", () => {
  it("applies the gradient backed by --character-color", () => {
    const { container } = wrap(
      <CharacterHeader
        character={mockCharacter}
        inspiration={false}
        onToggleInspiration={() => {}}
      />,
    );
    const header = container.querySelector("header");
    expect(header).toBeTruthy();
    expect(header!.getAttribute("style")).toContain("var(--character-color)");
    expect(header!.getAttribute("style")).toContain("linear-gradient(135deg");
  });

  it("renders the avatar as a button for owners and a plain element for non-owners", () => {
    const { container: ownerContainer, rerender } = wrap(
      <CharacterHeader
        character={mockCharacter}
        inspiration={false}
        onToggleInspiration={() => {}}
      />,
      { isOwner: true },
    );
    expect(ownerContainer.querySelector('[aria-label="Change character color"]')).toBeTruthy();

    const { container: nonOwnerContainer } = wrap(
      <CharacterHeader
        character={mockCharacter}
        inspiration={false}
        onToggleInspiration={() => {}}
      />,
      { isOwner: false },
    );
    expect(nonOwnerContainer.querySelector('[aria-label="Change character color"]')).toBeFalsy();
  });
});
```

If `<CharacterProvider>` requires additional fields you didn't expect, copy them from `lib/character/character-context.tsx`'s `CharacterProviderProps` and add `as any` casts liberally — this is a snapshot test, not a full integration test.

- [ ] **Step 7: Run the test**

```bash
npx vitest run tests/components/sheet/character-header.test.tsx
```

Expected: 2 passed. If render crashes, simplify the test by mocking dependent hooks (`useCharacterState`, etc.) — copy patterns from `tests/components/sheet/hp-tracker.test.tsx` or `tests/components/sheet/conditions.test.tsx`.

- [ ] **Step 8: Commit**

```bash
git add components/sheet/character-header.tsx tests/components/sheet/character-header.test.tsx
git commit -m "feat(sheet): gradient + color picker popover in CharacterHeader"
```

---

## Task 10: Layout wrapper — builder layout

**Files:**
- Modify: `app/(app)/characters/[id]/builder/layout.tsx`

- [ ] **Step 1: Read the existing layout**

```bash
cat "app/(app)/characters/[id]/builder/layout.tsx"
```

Identify the route params, what's fetched, and where children render.

- [ ] **Step 2: Add the primary_color fetch**

If the layout already fetches the character, ensure `primary_color` is in the SELECT (already `select("*")` per `lib/supabase/characters.ts`). If not, add the minimal SELECT:

```tsx
const { data: character } = await supabase
  .from("characters")
  .select("primary_color")
  .eq("id", id)
  .single();
```

- [ ] **Step 3: Wrap children in the style div**

```tsx
import { characterColorStyle } from "@/lib/character/character-color-style";

// inside the return:
return (
  <div style={characterColorStyle(character?.primary_color ?? null)}>
    {children}
  </div>
);
```

Preserve any existing wrappers — this `<div>` becomes the outermost in the layout's return.

- [ ] **Step 4: Run typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "builder/layout" | head -5
```

Expected: no errors.

- [ ] **Step 5: Run a quick `npm run build`**

```bash
npm run build 2>&1 | tail -8
```

Expected: clean build.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/characters/[id]/builder/layout.tsx"
git commit -m "feat(builder): wrap builder layout with characterColorStyle"
```

---

## Task 11: Builder step nav tinting

**Files:**
- Modify: `components/builder/builder-step-nav.tsx`

- [ ] **Step 1: Open the file and locate the active-link classes**

```bash
sed -n '25,65p' components/builder/builder-step-nav.tsx
```

Two `cn(...)` calls render with `isActive`/active style. They currently use `bg-primary text-primary-foreground`.

- [ ] **Step 2: Swap the active state**

Replace **both** occurrences:

```tsx
// before:
isActive
  ? "bg-primary text-primary-foreground"
  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"

// after:
isActive
  ? "bg-character-bg text-character-fg border border-character-border"
  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
```

Note: the `Overview` link at the top uses `pathname === ...` while the step links use `pathname.endsWith(...)` — both need the swap.

- [ ] **Step 3: Swap the in_progress status dot**

The status dot block currently maps `in_progress` to `bg-blue-500`. Replace:

```tsx
// before:
status === "in_progress" && "bg-blue-500",

// after:
status === "in_progress" && "bg-character-fg",
```

Leave the `complete` (green) and `untouched` (muted) cases alone.

- [ ] **Step 4: Run typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "builder-step-nav" | head -5
```

Expected: no errors.

- [ ] **Step 5: Run existing tests (if any)**

```bash
npx vitest run tests/components/builder/ 2>&1 | tail -5
```

Expected: passing.

- [ ] **Step 6: Commit**

```bash
git add components/builder/builder-step-nav.tsx
git commit -m "feat(builder): tint BuilderStepNav active state with character color"
```

---

## Task 12: Class step rail tinting

**Files:**
- Modify: `components/builder/class-step-rail/level-pill.tsx`
- Modify: `components/builder/class-step-rail/level-rail.tsx`
- Modify: `components/builder/class-step-rail/level-rail-mobile.tsx`
- Modify: `components/builder/class-step-rail/level-up-button.tsx`
- Modify: `components/builder/class-step-rail/level-up-action-bar.tsx`
- Modify: `components/builder/class-step-rail/class-level-pane.tsx`
- Modify: `tests/components/builder/class-step-rail.test.tsx`

- [ ] **Step 1: `level-pill.tsx` — swap the active pill tone**

Open the file. Locate the active-state classNames (likely a conditional like `active ? "bg-gold-xxx border-gold-xxx text-gold-xxx" : "neutral"` or driven by a `tone` prop).

Replace the active state's bg/border/fg with:

```
bg-character-bg border-character-border text-character-fg
```

Leave inactive state alone. Leave the small class-emblem letter (`P`/`S`/etc.) alone — its gold/purple is class identity, not character.

- [ ] **Step 2: `level-up-button.tsx` — swap idle primary fill**

Locate the idle-state classNames (state === "idle"). The current primary fill is class-toned (gold or purple). Replace with:

```
bg-character-fg text-background hover:opacity-90
```

Leave `disabled` and `active-flow` states unchanged (they're outline / dashed).

- [ ] **Step 3: `level-rail.tsx` — confirm no other class-toned active states**

```bash
grep -nE "rgba\(201|rgba\(124|class-tone|gold|purple" components/builder/class-step-rail/level-rail.tsx
```

If any remaining active-state class-tone references exist, replace them with `character` equivalents per the spec table. Inactive class chrome (header strip emblem letter, subtitle) stays per-class.

- [ ] **Step 4: `level-rail-mobile.tsx` — same swaps**

Apply the same active-pill + level-up-button changes as the desktop. Check the file for both.

- [ ] **Step 5: `level-up-action-bar.tsx` — swap "Confirm level N" button**

Open the file. The "Confirm" button currently uses a class-tone or accent fill. Replace with:

```
bg-character-fg text-background hover:opacity-90
```

Cancel button stays outline / muted.

- [ ] **Step 6: `class-level-pane.tsx` — primary ability + saving throw chips**

Search the file for ability-chip rendering (likely `STR`, `DEX`, `CON`, etc. or an `AbilityChip` sub-component).

If the pane renders chips highlighted as "primary" or "save", apply:

```
bg-character-bg border-character-border text-character-fg
```

to those chips. Other ability chips stay neutral.

If the current implementation does not render primary/save highlight chips on this surface, skip — note in commit message that the chip surface isn't currently rendered.

- [ ] **Step 7: Add the carry-through describe block to the rail test**

Open `tests/components/builder/class-step-rail.test.tsx`. Find the end of the existing describes (file is large; scroll to the bottom).

Append:

```tsx
describe("character color carry-through", () => {
  it("active level pill uses character color tokens", () => {
    const { container } = render(
      // reuse an existing renderRail() helper or fixture from the file
      renderRail({ /* defaults */ }),
    );
    const activePill = container.querySelector("[aria-current=\"true\"]")
      ?? container.querySelector("[data-active=\"true\"]");
    expect(activePill).toBeTruthy();
    expect(activePill?.className).toMatch(/bg-character-bg/);
    expect(activePill?.className).toMatch(/border-character-border/);
    expect(activePill?.className).toMatch(/text-character-fg/);
  });

  it("idle level-up button uses character color fill", () => {
    const { container } = render(renderRail({ /* not at lv 20 */ }));
    const levelUpBtn = container.querySelector("button[data-level-up-state=\"idle\"]")
      ?? screen.getByRole("button", { name: /level up/i });
    expect(levelUpBtn?.className).toMatch(/bg-character-fg/);
    expect(levelUpBtn?.className).toMatch(/text-background/);
  });

  it("inactive pills stay neutral (no character classes)", () => {
    const { container } = render(renderRail());
    const inactivePill = container.querySelector("[data-active=\"false\"]")
      ?? container.querySelectorAll("[role=\"button\"]")[0];
    expect(inactivePill?.className ?? "").not.toMatch(/character/);
  });
});
```

If selectors above don't match the rail's actual markup, adjust to the conventions already used in the rail tests. Reuse helpers and fixtures — don't reinvent.

- [ ] **Step 8: Run the rail tests**

```bash
npx vitest run tests/components/builder/class-step-rail.test.tsx
```

Expected: previous count (158) + 3 new = 161 passed. If any pre-existing pill/button tests fail because they asserted on the old `bg-gold-*` classes, update those expectations to match the new `bg-character-*` classes.

- [ ] **Step 9: Commit**

```bash
git add components/builder/class-step-rail/ tests/components/builder/class-step-rail.test.tsx
git commit -m "feat(builder): tint class step rail active states with character color"
```

---

## Task 13: Class preview modal + builder step Continue buttons

**Files:**
- Modify: `components/builder/class-preview-modal.tsx`
- Modify: 5 step-client files

- [ ] **Step 1: `class-preview-modal.tsx` — "Pick this class" button**

Locate the Pick CTA (sticky footer, gold-toned). Replace its background with:

```
bg-character-fg text-background hover:opacity-90
```

Cancel stays outline.

- [ ] **Step 2: Find all step-client Continue buttons**

```bash
grep -nE "Continue|Next" "app/(app)/characters/[id]/builder/race/race-step-client.tsx" "app/(app)/characters/[id]/builder/class/class-step-client.tsx" "app/(app)/characters/[id]/builder/abilities/abilities-step-client.tsx" "app/(app)/characters/[id]/builder/background/background-step-client.tsx" "app/(app)/characters/[id]/builder/equipment/equipment-step-client.tsx"
```

(Some files may not exist or have different names — note the actual file list and apply to each.)

- [ ] **Step 3: For each step-client file, replace the Continue/Next button's `<Button>` default variant**

Most Continue buttons use the bare `<Button>` (defaults to `bg-primary`). Replace each with a className override:

```tsx
<Button
  className="bg-character-fg text-background hover:opacity-90"
  onClick={...}
>
  Next: Abilities
</Button>
```

Leave Back / Cancel buttons as `variant="outline"`.

- [ ] **Step 4: Selected-card highlights in race / class / background steps**

The selected race / class / background card highlight currently uses gold accent. Open each step-client and find the card rendering (look for `selected` or `isSelected` props on cards or `ContentBrowser` usage).

If the highlight is in `ContentBrowser` itself, modify `components/builder/content-browser.tsx` instead — once, not per step. Swap the selected card classes:

```
bg-character-bg border-character-border text-character-fg
```

(Verify which file owns the selected highlight before editing.)

- [ ] **Step 5: Run typecheck + the rail/preview tests**

```bash
npx tsc --noEmit 2>&1 | grep -E "step-client|class-preview" | head -5
npx vitest run tests/components/builder/class-preview-modal.test.tsx
```

Expected: no new typecheck errors; modal tests still pass.

- [ ] **Step 6: Commit**

```bash
git add components/builder/class-preview-modal.tsx "app/(app)/characters/[id]/builder/" components/builder/content-browser.tsx
git commit -m "feat(builder): tint primary CTAs + selected cards with character color across steps + modal"
```

---

## Task 14: Sheet stat tiles + ability tiles + action dots tinting

**Files (candidates — verify in Step 1):**
- Modify: `components/sheet/combat-stats.tsx` (HP/AC/Init stat tiles)
- Modify: `components/sheet/ability-card.tsx` (ability tiles)
- Modify: `components/sheet/stat-ribbon.tsx` (the ribbon-style stat row, if it has tinted states)
- Modify: `components/sheet/hp-tracker.tsx` (HP tracker variant)
- Modify: `components/sheet/saving-throws.tsx` (if it has tinted "advantage"/"highlighted" states)
- Possibly: `components/sheet/activation-toggles.tsx`, `components/sheet/defenses.tsx`, `components/sheet/passive-senses.tsx` (skim for "selected" / "editing" states)

The exact files depend on which currently render a "selected" / "editing" / "highlighted" state. Step 1 confirms.

- [ ] **Step 1: Identify which sheet components have an active state worth tinting**

```bash
grep -rnE "selected|editing|highlighted|isActive|active" components/sheet/ --include="*.tsx" | head -40
```

For each hit, open the file and check whether the active state uses a gold accent (e.g., `bg-accent`, `border-accent`, `text-accent`, `bg-gold-`, or hex literals like `#c9a44a`). Make a short list of files to edit.

If a file's "active" state is purely structural (e.g., a different layout, not a color change), skip it.

- [ ] **Step 2: For each file with a gold-accent active state, swap to character tone**

For each identified file, replace the gold accent classes in the active branch with:

```
border-character-border bg-character-bg text-character-fg
```

Keep the default (non-active) styling unchanged.

If a file uses CSS variables directly (e.g., `style={{ borderColor: "var(--accent)" }}`), swap those to `var(--character-border)`, `var(--character-bg)`, `var(--character-fg)` as appropriate.

- [ ] **Step 3: Find and tint action item bullet dots**

```bash
grep -rnE "rounded-full|w-2 h-2|w-1.5 h-1.5" components/sheet/ --include="*.tsx" | head -20
```

For dots that represent a status indicator (typically `bg-muted-foreground` or `bg-foreground/50`), swap to `bg-character-fg` ONLY for "active" / "available" / "current" states. Leave purely structural dots (e.g., decorative bullets in a list) alone.

If no action-item dots are found in the sheet today, skip this step.

- [ ] **Step 4: Run all sheet tests**

```bash
npx vitest run tests/components/sheet/ 2>&1 | tail -15
```

Expected: passing. If snapshot tests fail because they asserted on `bg-accent` and now see `bg-character-bg`, the swap is correct — update the snapshot (`-u` flag or accept-prompt) and confirm visually.

```bash
npx vitest run tests/components/sheet/ -u
```

- [ ] **Step 5: Commit**

```bash
git add components/sheet/ tests/components/sheet/
git commit -m "feat(sheet): tint active stat/ability tiles + action dots with character color"
```

If Step 1 found no tintable sheet states beyond the header gradient (Task 9), this task is a no-op and commits nothing. Note that in the smoke test (Task 15).

---

## Task 15: Browser smoke verification

**Files:**
- No code changes — manual verification + final commit if anything else turns up.

- [ ] **Step 1: Start the dev server**

If using the Claude Preview MCP, call `mcp__Claude_Preview__preview_start { name: "inkborne-dev" }`. Otherwise:

```bash
npm run dev
```

Wait for "Ready in <ms>" output.

- [ ] **Step 2: Resize to mobile and log in**

If using preview MCP, set viewport mobile (375×812). Navigate to `http://localhost:3000/login` and log in as `test@inkborne.app` / `testpassword123`.

- [ ] **Step 3: Test on Voltee (single-class Wizard)**

Navigate to Voltee's character page. Verify:
- [ ] Sheet header renders gold gradient (no color picked yet)
- [ ] Avatar is clickable for owner; opens popover
- [ ] Click each preset swatch in turn — sheet re-tints instantly
- [ ] Type a custom hex (e.g., `#22c55e`) — sheet re-tints, optimistically
- [ ] Type invalid hex (`zzz`) — input shows destructive border
- [ ] Click Reset — sheet returns to gold

- [ ] **Step 4: Test on Xero (Barbarian 10 / Fighter 5 multiclass)**

Navigate to Xero. Set a color (e.g., teal `#0d9488`). Verify:
- [ ] Sheet header gradient + avatar reflect the color
- [ ] Builder nav: navigate to `/characters/<xero-id>/builder/race` → active step link uses character color
- [ ] `/builder/class` → active class step link tinted; level rail active pill tinted; class emblem (B / F) stays gold; level-up button tinted; Confirm-level (if in level-up flow) tinted
- [ ] Class preview modal "Pick this class" tinted
- [ ] Builder step Continue buttons tinted

- [ ] **Step 5: Test owner gating**

Open a different browser profile (or use incognito + sign up as a second test user). Try to view a character that user doesn't own (need to either set visibility to public on Xero or use an existing public character).

- [ ] Avatar is NOT clickable; no popover opens

(If no shared character is available, this step is skipped — note in PR description.)

- [ ] **Step 6: Verify desktop renders the same**

Resize to desktop (1280×800). Repeat a subset of the above. Visual rules should be identical; only layout differs.

- [ ] **Step 7: Stop the dev server**

```bash
# If using preview MCP:
mcp__Claude_Preview__preview_stop
# Otherwise: Ctrl+C the npm run dev terminal
```

- [ ] **Step 8: Final commit (if any test refinements landed during smoke)**

If any small fixes emerged from smoke testing:

```bash
git add <files>
git commit -m "fix(<area>): smoke-test refinement"
```

If smoke passed clean, no extra commit needed.

---

## Done criteria

- [ ] Migration applied; `primary_color text` column exists with hex check constraint
- [ ] `npx tsc --noEmit` shows no new errors in touched files
- [ ] `npx vitest run` reports all tests passing (existing 579 + new ones)
- [ ] `npm run build` clean
- [ ] Browser smoke (Voltee + Xero) verified across builder + sheet
- [ ] All commits pushed to `feat/character-color`
- [ ] PR opened against `main`, references spec PR #51 in the description
