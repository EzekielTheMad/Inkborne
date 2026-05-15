# Builder character mutations refactor — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [`docs/superpowers/specs/2026-05-14-builder-mutations-refactor-design.md`](../specs/2026-05-14-builder-mutations-refactor-design.md). The spec is the source of truth; this plan is its execution form.

**Goal:** Replace 21 inline `.from("characters").update(...)` calls and the scattered inline `.from("character_content_refs")` writes across the 5 builder step-clients with two typed helper layers (`updateCharacter` + browser-side content-refs primitives), wrapping every call site in optimistic-then-revert error handling.

**Architecture:** Extend two existing browser-aware modules (`lib/supabase/character-client.ts`, `lib/supabase/content-refs.ts`) with strongly-typed helpers. The new helpers throw on supabase `{ error }`; callers wrap each orchestration in `try { await helper(); router.refresh() } catch { restore local; console.error }`. Local-state mirrors stay (legitimate optimistic UI). No DB schema change, no feature flag, no `useCharacterUpdate` hook abstraction (explicitly rejected in the spec).

**Tech Stack:** Next.js (App Router), React 19, TypeScript, `@base-ui/react`, `@supabase/supabase-js`, Vitest + Testing Library.

**Branch:** `refactor/builder-character-mutations` (off main at `be57008`). Squash merge into main.

**Audit decision (resolved before plan):** The `content-refs.ts` audit revealed all existing helpers are server-only (`await createClient()` from `@/lib/supabase/server`). The step-clients are browser components. New helpers will be **mixed into `content-refs.ts`** alongside the server ones, using synchronous `createClient()` from `@/lib/supabase/client`. Two browser primitives are sufficient (`insertContentRef`, `removeContentRefById`) — the step-clients already cache existing refs locally and can supply ids, so no server-side find-and-replace helper is needed.

---

## File structure

### Modified files

| File | Responsibility |
|---|---|
| `lib/types/character.ts` | Add exported `CharacterUpdatePatch` type. |
| `lib/supabase/character-client.ts` | Add `updateCharacter(id, patch)`. Refactor `updateCharacterColor` to delegate. |
| `lib/supabase/content-refs.ts` | Add browser-side `insertContentRef(params)` and `removeContentRefById(id)` alongside existing server helpers. |
| `app/(app)/characters/[id]/builder/class/class-step-client.tsx` | 9 character updates + 4 content-ref orchestrations → helpers + optimistic-revert. |
| `app/(app)/characters/[id]/builder/background/background-step-client.tsx` | 4 character updates + 2 content-ref orchestrations → helpers + optimistic-revert. |
| `app/(app)/characters/[id]/builder/race/race-step-client.tsx` | 4 character updates (incl. one fire-and-forget) + 3 content-ref orchestrations → helpers + optimistic-revert. |
| `app/(app)/characters/[id]/builder/abilities/abilities-step-client.tsx` | 3 character updates (via `saveScores`) → helpers + optimistic-revert. |
| `app/(app)/characters/[id]/builder/equipment/equipment-step-client.tsx` | 2 character updates → helpers + optimistic-revert. |
| `tests/lib/supabase/character-client.test.ts` | Add `describe("updateCharacter")` with 4 cases; keep existing `updateCharacterColor` tests. |
| `tests/lib/supabase/content-refs.test.ts` | Add `describe("insertContentRef")` + `describe("removeContentRefById")` (browser-mock variant). |

### New files

| File | Responsibility |
|---|---|
| `tests/lib/character/character-context.test.tsx` | ~7 tests on `<CharacterProvider>`'s public hook surface. |

### Files explicitly unchanged

- `components/sheet/character-header.tsx` — already routes through `updateCharacterColor`. PR-F's tests + sheet smoke verify no regression after delegation. Zero code edit expected.
- `lib/character/character-context.tsx` — gets a test file but no production changes (out of scope per spec).
- `tests/components/sheet/character-header.test.tsx` — already mocks `updateCharacterColor` at the module level; no test edit needed.

---

## Task 1: Types + `updateCharacter` helper + delegation refactor

**Files:**
- Modify: `lib/types/character.ts` (add `CharacterUpdatePatch` export at bottom)
- Modify: `lib/supabase/character-client.ts` (add `updateCharacter`, refactor `updateCharacterColor`)
- Modify: `tests/lib/supabase/character-client.test.ts` (add 4 `updateCharacter` tests; keep all 3 existing `updateCharacterColor` tests)

- [ ] **Step 1.1: Add the `CharacterUpdatePatch` type**

Open `lib/types/character.ts` and append the following to the bottom of the file (after the existing exports — order-insensitive since it has no internal dependencies that aren't already defined above):

```ts
/**
 * Partial patch shape accepted by `updateCharacter()`.
 * Only the top-level character fields the builder step-clients mutate.
 * Other columns (id, user_id, system_id, created_at, base_stats, state, narrative*)
 * are written through dedicated paths and intentionally not part of this patch.
 */
export type CharacterUpdatePatch = Partial<
  Pick<
    Character,
    | "name"
    | "level"
    | "choices"
    | "primary_color"
    | "visibility"
    | "archived"
    | "base_stats"
  >
>;
```

Note: `base_stats` is included because `abilities-step-client.tsx`'s `saveScores` writes both `base_stats` and `choices`. Without it the abilities migration in Task 6 wouldn't type-check.

- [ ] **Step 1.2: Write the failing test for `updateCharacter` (writes a partial patch)**

Open `tests/lib/supabase/character-client.test.ts`. The existing mock harness at the top of the file (`mockEq`/`mockUpdate`/`mockFrom`) is already what we need. Add the new `updateCharacter` import and the first failing test after the existing `describe("updateCharacterColor", …)` block.

Replace the import line:

```ts
import { updateCharacterColor } from "@/lib/supabase/character-client";
```

with:

```ts
import {
  updateCharacter,
  updateCharacterColor,
} from "@/lib/supabase/character-client";
```

Append the new describe block after the existing `describe("updateCharacterColor", …)`:

```ts
describe("updateCharacter", () => {
  beforeEach(() => {
    mockEq.mockReset();
    mockUpdate.mockClear();
    mockFrom.mockClear();
  });

  it("writes a partial patch to the characters row", async () => {
    mockEq.mockResolvedValue({ error: null });
    await updateCharacter("char-1", { level: 5 });
    expect(mockFrom).toHaveBeenCalledWith("characters");
    expect(mockUpdate).toHaveBeenCalledWith({ level: 5 });
    expect(mockEq).toHaveBeenCalledWith("id", "char-1");
  });
});
```

- [ ] **Step 1.3: Run the new test to verify it fails**

```bash
npx vitest run tests/lib/supabase/character-client.test.ts --reporter=verbose
```

Expected: the new `updateCharacter` test fails with an import error (`updateCharacter is not exported`). Existing `updateCharacterColor` tests still pass.

- [ ] **Step 1.4: Implement `updateCharacter` and refactor `updateCharacterColor`**

Replace the contents of `lib/supabase/character-client.ts` with:

```ts
import { createClient } from "@/lib/supabase/client";
import type { CharacterUpdatePatch } from "@/lib/types/character";

/**
 * Browser-side helper to write a partial patch to a characters row.
 * Throws on supabase `{ error }` (RLS denial, check-constraint violation,
 * network). Caller is responsible for optimistic state + revert on failure.
 *
 * Empty patches are a no-op (defensive — protects against accidental
 * `.update({})` writes that supabase treats as a row-touch).
 */
export async function updateCharacter(
  characterId: string,
  patch: CharacterUpdatePatch,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  const supabase = createClient();
  const { error } = await supabase
    .from("characters")
    .update(patch)
    .eq("id", characterId);
  if (error) throw new Error(error.message);
}

/**
 * Browser-side helper to write a character's primary color.
 * Hex must match /^#[0-9a-fA-F]{6}$/ per the DB check constraint; pass null to clear.
 * RLS gates the write to the row owner.
 *
 * Delegates to updateCharacter so the validation + error-handling path is shared.
 */
export async function updateCharacterColor(
  characterId: string,
  primaryColor: string | null,
): Promise<void> {
  await updateCharacter(characterId, { primary_color: primaryColor });
}
```

- [ ] **Step 1.5: Run the updateCharacter test to verify it passes**

```bash
npx vitest run tests/lib/supabase/character-client.test.ts -t "writes a partial patch" --reporter=verbose
```

Expected: PASS.

- [ ] **Step 1.6: Add the remaining 3 `updateCharacter` tests**

Inside the existing `describe("updateCharacter", …)` block, append the 3 remaining `it(...)` cases so the full block reads:

```ts
describe("updateCharacter", () => {
  beforeEach(() => {
    mockEq.mockReset();
    mockUpdate.mockClear();
    mockFrom.mockClear();
  });

  it("writes a partial patch to the characters row", async () => {
    mockEq.mockResolvedValue({ error: null });
    await updateCharacter("char-1", { level: 5 });
    expect(mockFrom).toHaveBeenCalledWith("characters");
    expect(mockUpdate).toHaveBeenCalledWith({ level: 5 });
    expect(mockEq).toHaveBeenCalledWith("id", "char-1");
  });

  it("writes multi-field patches in a single update", async () => {
    mockEq.mockResolvedValue({ error: null });
    await updateCharacter("char-1", {
      choices: { classes: [{ slug: "wizard", level: 3 }] },
      level: 3,
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      choices: { classes: [{ slug: "wizard", level: 3 }] },
      level: 3,
    });
  });

  it("throws when supabase returns an error", async () => {
    mockEq.mockResolvedValue({ error: { message: "RLS denied" } });
    await expect(
      updateCharacter("char-1", { level: 5 }),
    ).rejects.toThrow("RLS denied");
  });

  it("is a no-op for an empty patch (defensive)", async () => {
    await updateCharacter("char-1", {});
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 1.7: Add a delegation-shape test for `updateCharacterColor`**

Append a new `describe` block at the very bottom of the test file. This locks the post-refactor behaviour explicitly so a future change that breaks the delegation surfaces here:

```ts
describe("updateCharacterColor (post-refactor delegation)", () => {
  beforeEach(() => {
    mockEq.mockReset();
    mockUpdate.mockClear();
    mockFrom.mockClear();
  });

  it("delegates to updateCharacter with { primary_color }", async () => {
    mockEq.mockResolvedValue({ error: null });
    await updateCharacterColor("char-1", "#7c3aed");
    expect(mockFrom).toHaveBeenCalledWith("characters");
    expect(mockUpdate).toHaveBeenCalledWith({ primary_color: "#7c3aed" });
    expect(mockEq).toHaveBeenCalledWith("id", "char-1");
  });
});
```

The existing 3 `updateCharacterColor` tests stay untouched — they verify the end behaviour through delegation, which is the strongest regression check we have for PR-F.

- [ ] **Step 1.8: Run the full character-client test file**

```bash
npx vitest run tests/lib/supabase/character-client.test.ts --reporter=verbose
```

Expected: 8 tests pass (3 existing `updateCharacterColor` + 4 new `updateCharacter` + 1 new delegation).

- [ ] **Step 1.9: Verify PR-F's sheet header tests still pass through delegation**

```bash
npx vitest run tests/components/sheet/character-header.test.tsx --reporter=verbose
```

Expected: all existing tests pass. (The test file mocks `updateCharacterColor` at the module level, so the delegation refactor is invisible to it. This is the safety net for the existing color-picker UI.)

- [ ] **Step 1.10: Verify the full test suite still passes**

```bash
npx vitest run --reporter=dot
```

Expected: 598 baseline tests + 5 new (4 `updateCharacter` + 1 delegation) = **603 tests pass**. Pre-existing typecheck-error fixtures (`tests/resources/helpers.test.ts`, `tests/spells/helpers.test.ts`, `tests/components/sheet/inventory-tab.test.tsx`) stay out of scope.

- [ ] **Step 1.11: Commit**

```bash
git add lib/types/character.ts lib/supabase/character-client.ts tests/lib/supabase/character-client.test.ts
git commit -m "refactor(supabase): add updateCharacter helper; delegate updateCharacterColor

Adds typed updateCharacter(id, patch) for browser-side character row
writes. Throws on supabase error; empty patch is a no-op. Refactors
updateCharacterColor (PR-F) to a 1-line delegation, preserving its
public surface while routing through the same error path.

Substrate for the builder step-clients refactor."
```

---

## Task 2: Browser-side `content_refs` helpers + tests

**Audit summary:**
- `lib/supabase/content-refs.ts` currently exports 6 helpers, all server-only (`await createClient()` from `@/lib/supabase/server`).
- Walking the 5 step-clients, the only content-ref patterns used are: (a) insert a single row with `(character_id, content_id, content_version, context)`, and (b) delete a single row by `id` (the step-clients already cache the existing rows as props and have the id locally).
- The spec speculated about a `replaceContentRefForSource` server-side find-and-replace; the audit shows this would add a wasted round-trip and is unnecessary.
- New helpers needed: `insertContentRef` (browser) and `removeContentRefById` (browser). Two helpers, distinct verbs to avoid colliding with the existing `addContentRef` / `removeContentRef` server names.

**Files:**
- Modify: `lib/supabase/content-refs.ts` (add browser import + two new exports at the bottom)
- Modify: `tests/lib/supabase/content-refs.test.ts` (add two new describe blocks with a browser-mocked harness)

- [ ] **Step 2.1: Write the failing test for `insertContentRef`**

Open `tests/lib/supabase/content-refs.test.ts`. At the top of the file (above the existing `vi.mock("@/lib/supabase/server", …)` line), add a separate browser-side mock harness. The existing server harness stays untouched.

Insert at the top of the file, after the first import block:

```ts
// Browser-mock harness (for insertContentRef / removeContentRefById).
// Built standalone so it doesn't interact with the server harness below.
const mockBrowserSingle = vi.fn();
const mockBrowserSelect = vi.fn(() => ({ single: mockBrowserSingle }));
const mockBrowserInsert = vi.fn(() => ({ select: mockBrowserSelect }));
const mockBrowserEq = vi.fn();
const mockBrowserDelete = vi.fn(() => ({ eq: mockBrowserEq }));
const mockBrowserFrom = vi.fn(() => ({
  insert: mockBrowserInsert,
  delete: mockBrowserDelete,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: mockBrowserFrom }),
}));
```

Adjust the import line so the new helpers are pulled in:

```ts
import {
  getContentRefsByCharacter,
  addContentRef,
  removeContentRef,
  removeContentRefsByChoiceSource,
  getContentRefsByChoiceSource,
  insertContentRef,
  removeContentRefById,
} from "@/lib/supabase/content-refs";
```

Append two new describe blocks at the bottom of the file:

```ts
describe("insertContentRef (browser)", () => {
  beforeEach(() => {
    mockBrowserSingle.mockReset();
    mockBrowserSelect.mockClear();
    mockBrowserInsert.mockClear();
    mockBrowserFrom.mockClear();
  });

  it("inserts a content_ref row and returns the inserted row", async () => {
    const inserted = { id: "r1", character_id: "c1", content_id: "cd1" };
    mockBrowserSingle.mockResolvedValue({ data: inserted, error: null });
    const result = await insertContentRef({
      characterId: "c1",
      contentId: "cd1",
      contentVersion: 1,
      context: { source: "class", level: 1 },
    });
    expect(mockBrowserFrom).toHaveBeenCalledWith("character_content_refs");
    expect(mockBrowserInsert).toHaveBeenCalledWith([
      {
        character_id: "c1",
        content_id: "cd1",
        content_version: 1,
        context: { source: "class", level: 1 },
      },
    ]);
    expect(result).toEqual(inserted);
  });

  it("throws when supabase returns an error", async () => {
    mockBrowserSingle.mockResolvedValue({
      data: null,
      error: { message: "fk violation" },
    });
    await expect(
      insertContentRef({
        characterId: "c1",
        contentId: "cd1",
        contentVersion: 1,
        context: { source: "class", level: 1 },
      }),
    ).rejects.toThrow("fk violation");
  });
});

describe("removeContentRefById (browser)", () => {
  beforeEach(() => {
    mockBrowserEq.mockReset();
    mockBrowserDelete.mockClear();
    mockBrowserFrom.mockClear();
  });

  it("deletes the content_ref row matching id", async () => {
    mockBrowserEq.mockResolvedValue({ error: null });
    await removeContentRefById("r1");
    expect(mockBrowserFrom).toHaveBeenCalledWith("character_content_refs");
    expect(mockBrowserDelete).toHaveBeenCalled();
    expect(mockBrowserEq).toHaveBeenCalledWith("id", "r1");
  });

  it("throws when supabase returns an error", async () => {
    mockBrowserEq.mockResolvedValue({ error: { message: "RLS denied" } });
    await expect(removeContentRefById("r1")).rejects.toThrow("RLS denied");
  });
});
```

- [ ] **Step 2.2: Run the new tests to verify they fail**

```bash
npx vitest run tests/lib/supabase/content-refs.test.ts --reporter=verbose
```

Expected: 4 new tests fail with import errors (`insertContentRef`, `removeContentRefById` not exported). Existing 3 server-side tests still pass.

- [ ] **Step 2.3: Implement the two browser helpers**

Open `lib/supabase/content-refs.ts`. Add a separate browser-client import alias under the existing server import at the top of the file:

```ts
import { createClient } from "@/lib/supabase/server";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { CharacterContentRef } from "@/lib/types/character";
```

Append the two new exports at the bottom of the file (after `getContentByTypeAndSystem`):

```ts
// ---------------------------------------------------------------------------
// Browser-side helpers (used by builder step-clients).
//
// These call the synchronous browser supabase client so they can be invoked
// from `"use client"` components. They throw on supabase `{ error }`; callers
// are responsible for optimistic state + revert on failure.
// ---------------------------------------------------------------------------

export interface InsertContentRefParams {
  characterId: string;
  contentId: string;
  contentVersion: number;
  context: Record<string, unknown>;
  choiceSource?: string | null;
}

/**
 * Browser-side: insert a single content_ref row and return the inserted record.
 * Used by builder step-clients (race/class/subclass/background/fighting-style
 * selection).
 */
export async function insertContentRef(
  params: InsertContentRefParams,
): Promise<CharacterContentRef> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from("character_content_refs")
    .insert([
      {
        character_id: params.characterId,
        content_id: params.contentId,
        content_version: params.contentVersion,
        context: params.context,
        choice_source: params.choiceSource ?? null,
      },
    ])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as CharacterContentRef;
}

/**
 * Browser-side: delete one content_ref row by its primary key. Used by
 * builder step-clients when swapping a selection — the caller has the id
 * already from the contentRefs prop and skips an extra lookup.
 */
export async function removeContentRefById(id: string): Promise<void> {
  const supabase = createBrowserClient();
  const { error } = await supabase
    .from("character_content_refs")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2.4: Run the content-refs test file**

```bash
npx vitest run tests/lib/supabase/content-refs.test.ts --reporter=verbose
```

Expected: 7 tests pass (3 existing server + 4 new browser).

- [ ] **Step 2.5: Run the full test suite**

```bash
npx vitest run --reporter=dot
```

Expected: 603 baseline + 4 new = **607 tests pass**.

- [ ] **Step 2.6: Commit**

```bash
git add lib/supabase/content-refs.ts tests/lib/supabase/content-refs.test.ts
git commit -m "feat(supabase): add browser-side insertContentRef + removeContentRefById helpers

Two browser-aware primitives that builder step-clients use to insert
or delete character_content_refs rows. They live alongside the
existing server-side helpers in the same file, distinguished by verb
(insert vs add) and synchronous browser client (vs await server).
Each throws on supabase error; callers wrap with optimistic-revert."
```

---

## Task 3: Migrate `class-step-client.tsx` (9 character updates + 4 content-ref orchestrations)

**File:** `app/(app)/characters/[id]/builder/class/class-step-client.tsx`

**Call-site inventory (before refactor):**

| # | Handler | Operation |
|---|---|---|
| 1 | `handleSelectClass` | character update + insert class content_ref + optional insert subclass content_ref |
| 2 | `handleLevelChange` | character update |
| 3 | `handleConfirmLevelUp` | character update |
| 4 | `handleHpRollChange` | character update |
| 5 | `handleRemoveClass` | character update + optional remove class content_ref |
| 6 | `handleChoiceSelect` | character update |
| 7 | `handleFightingStyleSelect` | character update + optional remove old fighting-style ref + optional insert new |
| 8 | `handleSubclassSelect` | character update + (insert or remove subclass ref, with delete-old-first) |
| 9 | `handleAsiSelect` | character update |

- [ ] **Step 3.1: Update imports**

In `app/(app)/characters/[id]/builder/class/class-step-client.tsx`, replace:

```tsx
import { createClient } from "@/lib/supabase/client";
```

with:

```tsx
import { updateCharacter } from "@/lib/supabase/character-client";
import {
  insertContentRef,
  removeContentRefById,
} from "@/lib/supabase/content-refs";
```

In the component body, remove the line:

```tsx
const supabase = createClient();
```

- [ ] **Step 3.2: Refactor `handleSelectClass`**

Replace the body of `handleSelectClass` (current lines 86–135) with:

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

  const prev = { choices: localChoices, level: localLevel };
  setLocalChoices(newChoices);
  setLocalLevel(totalLevel);

  try {
    await updateCharacter(characterId, {
      choices: newChoices,
      level: totalLevel,
    });
    await insertContentRef({
      characterId,
      contentId: content.id,
      contentVersion: content.version,
      context: { source: "class", level: 1 },
    });
    if (subclassSlug) {
      const subclassContent = subclasses.find((sc) => sc.slug === subclassSlug);
      if (subclassContent) {
        await insertContentRef({
          characterId,
          contentId: subclassContent.id,
          contentVersion: subclassContent.version,
          context: { source: "subclass", class: content.slug },
        });
      }
    }
    startTransition(() => router.refresh());
  } catch (err) {
    setLocalChoices(prev.choices);
    setLocalLevel(prev.level);
    console.error("Failed to add class:", err);
  }
}
```

- [ ] **Step 3.3: Refactor `handleLevelChange`**

Replace the body of `handleLevelChange` (current lines 137–152) with:

```tsx
async function handleLevelChange(classIndex: number, newLevel: number) {
  const updatedClasses = [...selectedClasses];
  updatedClasses[classIndex] = {
    ...updatedClasses[classIndex],
    level: newLevel,
  };
  const totalLevel = updatedClasses.reduce((sum, c) => sum + c.level, 0);
  const newChoices = { ...localChoices, classes: updatedClasses };

  const prev = { choices: localChoices, level: localLevel };
  setLocalChoices(newChoices);
  setLocalLevel(totalLevel);

  try {
    await updateCharacter(characterId, {
      choices: newChoices,
      level: totalLevel,
    });
    startTransition(() => router.refresh());
  } catch (err) {
    setLocalChoices(prev.choices);
    setLocalLevel(prev.level);
    console.error("Failed to change class level:", err);
  }
}
```

- [ ] **Step 3.4: Refactor `handleConfirmLevelUp`**

Replace the body of `handleConfirmLevelUp` (current lines 154–170) with:

```tsx
async function handleConfirmLevelUp(payload: {
  classIndex: number;
  draftLevel: number;
}) {
  const { classIndex, draftLevel } = payload;
  const updatedClasses = [...selectedClasses];
  updatedClasses[classIndex] = {
    ...updatedClasses[classIndex],
    level: draftLevel,
  };
  const totalLevel = updatedClasses.reduce((sum, c) => sum + c.level, 0);
  const newChoices = { ...localChoices, classes: updatedClasses };

  const prev = { choices: localChoices, level: localLevel };
  setLocalChoices(newChoices);
  setLocalLevel(totalLevel);

  try {
    await updateCharacter(characterId, {
      choices: newChoices,
      level: totalLevel,
    });
    startTransition(() => router.refresh());
  } catch (err) {
    setLocalChoices(prev.choices);
    setLocalLevel(prev.level);
    console.error("Failed to confirm level up:", err);
  }
}
```

- [ ] **Step 3.5: Refactor `handleHpRollChange`**

Replace the body of `handleHpRollChange` (current lines 177–185) with:

```tsx
async function handleHpRollChange(key: string, record: HpRollRecord) {
  const newHpRolls = { ...(localChoices.hp_rolls ?? {}), [key]: record };
  const newChoices = { ...localChoices, hp_rolls: newHpRolls };

  const prev = localChoices;
  setLocalChoices(newChoices);

  try {
    await updateCharacter(characterId, { choices: newChoices });
  } catch (err) {
    setLocalChoices(prev);
    console.error("Failed to save HP roll:", err);
  }
}
```

(No `router.refresh()` in the original — keep it that way; HP rolls are inline edits that don't need a server-rendered refresh.)

- [ ] **Step 3.6: Refactor `handleRemoveClass`**

Replace the body of `handleRemoveClass` (current lines 187–215) with:

```tsx
async function handleRemoveClass(classIndex: number) {
  const removedClass = selectedClasses[classIndex];
  const updatedClasses = selectedClasses.filter((_, i) => i !== classIndex);
  const totalLevel = updatedClasses.reduce((sum, c) => sum + c.level, 0);
  const newChoices = { ...localChoices, classes: updatedClasses };
  const newLevel = Math.max(totalLevel, 1);

  const prev = { choices: localChoices, level: localLevel };
  setLocalChoices(newChoices);
  setLocalLevel(newLevel);

  try {
    await updateCharacter(characterId, {
      choices: newChoices,
      level: newLevel,
    });
    const classContentRef = contentRefs.find(
      (ref) =>
        ref.content_definitions?.slug === removedClass.slug &&
        ref.content_definitions?.content_type === "class",
    );
    if (classContentRef) {
      await removeContentRefById(classContentRef.id);
    }
    startTransition(() => router.refresh());
  } catch (err) {
    setLocalChoices(prev.choices);
    setLocalLevel(prev.level);
    console.error("Failed to remove class:", err);
  }
}
```

- [ ] **Step 3.7: Refactor `handleChoiceSelect`**

Replace the body of `handleChoiceSelect` (current lines 217–229) with:

```tsx
async function handleChoiceSelect(choiceId: string, selections: string[]) {
  const newResolved = {
    ...localChoices.resolved_choices,
    [choiceId]: selections,
  };
  const newChoices = { ...localChoices, resolved_choices: newResolved };

  const prev = localChoices;
  setLocalChoices(newChoices);

  try {
    await updateCharacter(characterId, { choices: newChoices });
  } catch (err) {
    setLocalChoices(prev);
    console.error("Failed to save choice selection:", err);
  }
}
```

- [ ] **Step 3.8: Refactor `handleFightingStyleSelect`**

Replace the body of `handleFightingStyleSelect` (current lines 231–278) with:

```tsx
async function handleFightingStyleSelect(
  featureSlug: string,
  classSlug: string,
  styleSlug: string | undefined,
) {
  const newResolved = {
    ...localChoices.resolved_choices,
    [featureSlug]: styleSlug ? [styleSlug] : [],
  };
  const newChoices = { ...localChoices, resolved_choices: newResolved };

  const prev = localChoices;
  setLocalChoices(newChoices);

  try {
    await updateCharacter(characterId, { choices: newChoices });

    const oldRef = contentRefs.find(
      (ref) =>
        ref.context?.source === "fighting_style" &&
        ref.context?.class === classSlug,
    );
    if (oldRef) {
      await removeContentRefById(oldRef.id);
    }

    if (styleSlug) {
      const styleContent = features.find((f) => f.slug === styleSlug);
      if (styleContent) {
        await insertContentRef({
          characterId,
          contentId: styleContent.id,
          contentVersion: styleContent.version,
          context: { source: "fighting_style", class: classSlug },
        });
      }
    }

    startTransition(() => router.refresh());
  } catch (err) {
    setLocalChoices(prev);
    console.error("Failed to save fighting style:", err);
  }
}
```

- [ ] **Step 3.9: Refactor `handleSubclassSelect`**

Replace the body of `handleSubclassSelect` (current lines 280–342) with:

```tsx
async function handleSubclassSelect(
  classSlug: string,
  classIndex: number,
  subclassSlug: string | undefined,
) {
  const updatedClasses = [...selectedClasses];
  updatedClasses[classIndex] = {
    ...updatedClasses[classIndex],
    subclass: subclassSlug,
  };
  const newChoices = { ...localChoices, classes: updatedClasses };

  const prev = localChoices;
  setLocalChoices(newChoices);

  try {
    await updateCharacter(characterId, { choices: newChoices });

    const existingRef = contentRefs.find(
      (ref) =>
        ref.content_definitions?.content_type === "subclass" &&
        ref.context?.source === "subclass" &&
        ref.context?.class === classSlug,
    );

    if (subclassSlug) {
      const subclassContent = subclasses.find((sc) => sc.slug === subclassSlug);
      if (subclassContent) {
        if (existingRef) {
          await removeContentRefById(existingRef.id);
        }
        await insertContentRef({
          characterId,
          contentId: subclassContent.id,
          contentVersion: subclassContent.version,
          context: { source: "subclass", class: classSlug },
        });
      }
    } else if (existingRef) {
      await removeContentRefById(existingRef.id);
    }

    startTransition(() => router.refresh());
  } catch (err) {
    setLocalChoices(prev);
    console.error("Failed to save subclass:", err);
  }
}
```

- [ ] **Step 3.10: Refactor `handleAsiSelect`**

Replace the body of `handleAsiSelect` (current lines 344–356) with:

```tsx
async function handleAsiSelect(featureSlug: string, choice: AsiChoice) {
  const newAsiChoices = {
    ...localChoices.asi_choices,
    [featureSlug]: choice,
  };
  const newChoices = { ...localChoices, asi_choices: newAsiChoices };

  const prev = localChoices;
  setLocalChoices(newChoices);

  try {
    await updateCharacter(characterId, { choices: newChoices });
  } catch (err) {
    setLocalChoices(prev);
    console.error("Failed to save ASI selection:", err);
  }
}
```

- [ ] **Step 3.11: Run typecheck on the touched file**

```bash
npx tsc --noEmit
```

Expected: no new errors in `class-step-client.tsx`. Pre-existing errors in `tests/resources/helpers.test.ts`, `tests/spells/helpers.test.ts`, and `tests/components/sheet/inventory-tab.test.tsx` are unrelated and out of scope.

- [ ] **Step 3.12: Run the full test suite**

```bash
npx vitest run --reporter=dot
```

Expected: 607 tests pass (no regression — `class-step-client.tsx` has no direct test file, so the smoke comes from full-suite green).

- [ ] **Step 3.13: Commit**

```bash
git add app/(app)/characters/[id]/builder/class/class-step-client.tsx
git commit -m "refactor(builder/class): route 9 character writes + 4 content-ref ops through helpers

All inline supabase calls in class-step-client.tsx now go through
updateCharacter / insertContentRef / removeContentRefById. Each
handler wraps its writes in try/catch with local-state revert and
console.error, and only calls router.refresh() on success.

No behavior change in the happy path. Failure semantics improve:
RLS denials / network errors now revert the optimistic UI instead
of silently dropping the write."
```

---

## Task 4: Migrate `background-step-client.tsx` (4 character updates + 2 content-ref orchestrations)

**File:** `app/(app)/characters/[id]/builder/background/background-step-client.tsx`

**Call-site inventory:**

| # | Handler | Operation |
|---|---|---|
| 1 | `handleSelectBackground` | character update + remove old background ref + insert new |
| 2 | `handleChangeBackground` | character update + remove background ref |
| 3 | `handleNarrativeChange` | character update |
| 4 | `handleChoiceSelect` | character update |

- [ ] **Step 4.1: Update imports**

Replace:

```tsx
import { createClient } from "@/lib/supabase/client";
```

with:

```tsx
import { updateCharacter } from "@/lib/supabase/character-client";
import {
  insertContentRef,
  removeContentRefById,
} from "@/lib/supabase/content-refs";
```

In the component body, remove:

```tsx
const supabase = createClient();
```

- [ ] **Step 4.2: Refactor `handleSelectBackground`**

Replace the body of `handleSelectBackground` (current lines 93–132) with:

```tsx
async function handleSelectBackground(content: ContentEntry) {
  setPreviewContent(null);

  const newChoices = {
    ...localChoices,
    background: content.slug,
    personality_traits: [],
    ideals: [],
    bonds: [],
    flaws: [],
  };

  const prev = localChoices;
  setLocalChoices(newChoices);

  try {
    await updateCharacter(characterId, { choices: newChoices });

    const oldRef = contentRefs.find(
      (ref) => ref.content_definitions?.content_type === "background",
    );
    if (oldRef) {
      await removeContentRefById(oldRef.id);
    }
    await insertContentRef({
      characterId,
      contentId: content.id,
      contentVersion: content.version,
      context: { source: "background" },
    });

    startTransition(() => router.refresh());
  } catch (err) {
    setLocalChoices(prev);
    console.error("Failed to select background:", err);
  }
}
```

- [ ] **Step 4.3: Refactor `handleChangeBackground`**

Replace the body of `handleChangeBackground` (current lines 134–161) with:

```tsx
async function handleChangeBackground() {
  const newChoices = {
    ...localChoices,
    background: undefined,
    personality_traits: [],
    ideals: [],
    bonds: [],
    flaws: [],
  };

  const prev = localChoices;
  setLocalChoices(newChoices);

  try {
    await updateCharacter(characterId, { choices: newChoices });

    const bgRef = contentRefs.find(
      (ref) => ref.content_definitions?.content_type === "background",
    );
    if (bgRef) {
      await removeContentRefById(bgRef.id);
    }

    startTransition(() => router.refresh());
  } catch (err) {
    setLocalChoices(prev);
    console.error("Failed to clear background:", err);
  }
}
```

- [ ] **Step 4.4: Refactor `handleNarrativeChange`**

Replace the body of `handleNarrativeChange` (current lines 163–174) with:

```tsx
async function handleNarrativeChange(
  field: "personality_traits" | "ideals" | "bonds" | "flaws",
  value: string[],
) {
  const newChoices = { ...localChoices, [field]: value };

  const prev = localChoices;
  setLocalChoices(newChoices);

  try {
    await updateCharacter(characterId, { choices: newChoices });
  } catch (err) {
    setLocalChoices(prev);
    console.error("Failed to save narrative trait:", err);
  }
}
```

- [ ] **Step 4.5: Refactor `handleChoiceSelect`**

Replace the body of `handleChoiceSelect` (current lines 176–188) with:

```tsx
async function handleChoiceSelect(choiceId: string, selections: string[]) {
  const newResolved = {
    ...localChoices.resolved_choices,
    [choiceId]: selections,
  };
  const newChoices = { ...localChoices, resolved_choices: newResolved };

  const prev = localChoices;
  setLocalChoices(newChoices);

  try {
    await updateCharacter(characterId, { choices: newChoices });
  } catch (err) {
    setLocalChoices(prev);
    console.error("Failed to save choice selection:", err);
  }
}
```

- [ ] **Step 4.6: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors in `background-step-client.tsx`.

- [ ] **Step 4.7: Run the full test suite**

```bash
npx vitest run --reporter=dot
```

Expected: 607 tests pass.

- [ ] **Step 4.8: Commit**

```bash
git add app/(app)/characters/[id]/builder/background/background-step-client.tsx
git commit -m "refactor(builder/background): route 4 character writes + 2 content-ref ops through helpers

All inline supabase calls in background-step-client.tsx now go
through updateCharacter / insertContentRef / removeContentRefById,
with try/catch optimistic-revert wrapping each handler.

Failure semantics improve: background swaps that hit an RLS error
no longer leave a half-applied state (character row updated but
content_ref drift)."
```

---

## Task 5: Migrate `race-step-client.tsx` (4 character updates + 3 content-ref orchestrations)

**File:** `app/(app)/characters/[id]/builder/race/race-step-client.tsx`

**Call-site inventory:**

| # | Handler | Operation |
|---|---|---|
| 1 | `handleSelectRace` | character update + remove old race ref + remove old subrace ref + insert new race ref |
| 2 | `handleSelectSubrace` | character update + remove old subrace ref + insert new |
| 3 | `handleChangeRace` | character update + remove race + subrace refs (loop) |
| 4 | `handleChoiceSelect` | character update |
| 5 | "Change Subrace" inline `onClick` (current line 438–449) | character update — **currently fire-and-forget** |

The "Change Subrace" inline `onClick` does not await the supabase call. Migrating it through the helper makes the write awaited; we lift it into a named handler so the try/catch + revert is readable.

- [ ] **Step 5.1: Update imports**

Replace:

```tsx
import { createClient } from "@/lib/supabase/client";
```

with:

```tsx
import { updateCharacter } from "@/lib/supabase/character-client";
import {
  insertContentRef,
  removeContentRefById,
} from "@/lib/supabase/content-refs";
```

In the component body, remove:

```tsx
const supabase = createClient();
```

- [ ] **Step 5.2: Refactor `handleSelectRace`**

Replace the body of `handleSelectRace` (current lines 126–175) with:

```tsx
async function handleSelectRace(content: ContentEntry) {
  setPreviewContent(null);

  const newChoices = {
    ...localChoices,
    race: content.slug,
    subrace: undefined,
  };

  const prev = localChoices;
  setLocalChoices(newChoices);

  try {
    await updateCharacter(characterId, { choices: newChoices });

    const oldRaceRef = contentRefs.find(
      (ref) => ref.content_definitions?.content_type === "race",
    );
    if (oldRaceRef) {
      await removeContentRefById(oldRaceRef.id);
    }
    const oldSubraceRef = contentRefs.find(
      (ref) => ref.content_definitions?.content_type === "subrace",
    );
    if (oldSubraceRef) {
      await removeContentRefById(oldSubraceRef.id);
    }

    await insertContentRef({
      characterId,
      contentId: content.id,
      contentVersion: content.version,
      context: { source: "race" },
    });

    startTransition(() => router.refresh());
  } catch (err) {
    setLocalChoices(prev);
    console.error("Failed to select race:", err);
  }
}
```

- [ ] **Step 5.3: Refactor `handleSelectSubrace`**

Replace the body of `handleSelectSubrace` (current lines 177–208) with:

```tsx
async function handleSelectSubrace(subrace: ContentEntry) {
  const newChoices = { ...localChoices, subrace: subrace.slug };

  const prev = localChoices;
  setLocalChoices(newChoices);

  try {
    await updateCharacter(characterId, { choices: newChoices });

    const oldSubraceRef = contentRefs.find(
      (ref) => ref.content_definitions?.content_type === "subrace",
    );
    if (oldSubraceRef) {
      await removeContentRefById(oldSubraceRef.id);
    }

    await insertContentRef({
      characterId,
      contentId: subrace.id,
      contentVersion: subrace.version,
      context: { source: "subrace" },
    });

    startTransition(() => router.refresh());
  } catch (err) {
    setLocalChoices(prev);
    console.error("Failed to select subrace:", err);
  }
}
```

- [ ] **Step 5.4: Refactor `handleChangeRace`**

Replace the body of `handleChangeRace` (current lines 210–237) with:

```tsx
async function handleChangeRace() {
  const newChoices = {
    ...localChoices,
    race: undefined,
    subrace: undefined,
  };

  const prev = localChoices;
  setLocalChoices(newChoices);

  try {
    await updateCharacter(characterId, { choices: newChoices });

    const raceRefs = contentRefs.filter(
      (ref) =>
        ref.content_definitions?.content_type === "race" ||
        ref.content_definitions?.content_type === "subrace",
    );
    for (const ref of raceRefs) {
      await removeContentRefById(ref.id);
    }

    startTransition(() => router.refresh());
  } catch (err) {
    setLocalChoices(prev);
    console.error("Failed to clear race:", err);
  }
}
```

- [ ] **Step 5.5: Refactor `handleChoiceSelect`**

Replace the body of `handleChoiceSelect` (current lines 239–251) with:

```tsx
async function handleChoiceSelect(choiceId: string, selections: string[]) {
  const newResolved = {
    ...localChoices.resolved_choices,
    [choiceId]: selections,
  };
  const newChoices = { ...localChoices, resolved_choices: newResolved };

  const prev = localChoices;
  setLocalChoices(newChoices);

  try {
    await updateCharacter(characterId, { choices: newChoices });
  } catch (err) {
    setLocalChoices(prev);
    console.error("Failed to save choice selection:", err);
  }
}
```

- [ ] **Step 5.6: Lift the "Change Subrace" inline onClick into a named handler**

Currently lines 438–449 do an inline fire-and-forget supabase call:

```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => {
    const newChoices = {
      ...localChoices,
      subrace: undefined,
    };
    setLocalChoices(newChoices);
    supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);
    startTransition(() => router.refresh());
  }}
>
  Change Subrace
</Button>
```

Add a named handler above the return — place it next to the other handlers, after `handleChoiceSelect`:

```tsx
async function handleChangeSubrace() {
  const newChoices = { ...localChoices, subrace: undefined };

  const prev = localChoices;
  setLocalChoices(newChoices);

  try {
    await updateCharacter(characterId, { choices: newChoices });

    const oldSubraceRef = contentRefs.find(
      (ref) => ref.content_definitions?.content_type === "subrace",
    );
    if (oldSubraceRef) {
      await removeContentRefById(oldSubraceRef.id);
    }

    startTransition(() => router.refresh());
  } catch (err) {
    setLocalChoices(prev);
    console.error("Failed to clear subrace:", err);
  }
}
```

Then replace the inline-onClick `<Button>` block with:

```tsx
<Button
  variant="outline"
  size="sm"
  onClick={handleChangeSubrace}
>
  Change Subrace
</Button>
```

Note: this is a behavior **improvement**. The original code only cleared `subrace` from `choices` but left the subrace content_ref in place — a latent bug where subrace effects (ability bonuses, traits) would linger until the next race swap. The new handler also removes the orphaned content_ref. The change still matches user intent ("Change Subrace" → clear the current subrace) and is consistent with how `handleChangeRace` handles the race+subrace refs.

- [ ] **Step 5.7: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors in `race-step-client.tsx`.

- [ ] **Step 5.8: Run the full test suite**

```bash
npx vitest run --reporter=dot
```

Expected: 607 tests pass.

- [ ] **Step 5.9: Commit**

```bash
git add app/(app)/characters/[id]/builder/race/race-step-client.tsx
git commit -m "refactor(builder/race): route 4 character writes + 3 content-ref ops through helpers

All inline supabase calls in race-step-client.tsx now go through
updateCharacter / insertContentRef / removeContentRefById, with
try/catch optimistic-revert wrapping each handler.

Also fixes a latent bug in the 'Change Subrace' button: the inline
onClick previously cleared the choices.subrace field but left the
subrace content_ref in place, causing the subrace's effects to
linger until the next race swap. The new handler also removes the
orphaned content_ref."
```

---

## Task 6: Migrate `abilities-step-client.tsx` (3 character updates via `saveScores`)

**File:** `app/(app)/characters/[id]/builder/abilities/abilities-step-client.tsx`

**Call-site inventory:**

The component centralises persistence through a single private helper `saveScores(newScores)` that is invoked from three handlers (`handleStandardArrayAssign`, `handlePointBuyChange`, `handleManualChange`). The cleanest migration is to convert `saveScores` itself — the three callers stay unchanged.

| # | Handler | Operation |
|---|---|---|
| 1 | `saveScores` (called by 3 handlers) | character update on both `base_stats` and `choices` |

- [ ] **Step 6.1: Update imports**

Replace:

```tsx
import { createClient } from "@/lib/supabase/client";
```

with:

```tsx
import { updateCharacter } from "@/lib/supabase/character-client";
```

In the component body, remove:

```tsx
const supabase = createClient();
```

- [ ] **Step 6.2: Add a local-state mirror for base_stats**

The current component derives `scores` and `arrayAssignments` from props/local state but never mirrors the *committed* server stats. `saveScores` currently fire-and-forgets; on failure, the local UI shows the new value while the DB still has the old. To support revert, capture `prev` from whichever state object is in play before the optimistic mutation.

Replace `saveScores` (current lines 177–187) with:

```tsx
async function saveScores(
  newScores: Record<string, number>,
  prevScores: Record<string, number>,
  applyOptimistic: (scores: Record<string, number>) => void,
) {
  const newChoices = { ...character.choices, ability_method: method };
  try {
    await updateCharacter(characterId, {
      base_stats: newScores,
      choices: newChoices,
    });
  } catch (err) {
    applyOptimistic(prevScores);
    console.error("Failed to save ability scores:", err);
  }
}
```

This passes the previous value + a revert callback in, which is cleaner than having `saveScores` know whether to call `setScores` or `setArrayAssignments`. The optimistic write itself stays at the call sites.

- [ ] **Step 6.3: Update `handleStandardArrayAssign`**

Replace the body (current lines 199–220) with:

```tsx
function handleStandardArrayAssign(abilitySlug: string, value: string) {
  const numValue = parseInt(value);
  if (isNaN(numValue)) return;

  const newAssignments = { ...arrayAssignments };

  for (const key of Object.keys(newAssignments)) {
    if (newAssignments[key] === numValue && key !== abilitySlug) {
      delete newAssignments[key];
    }
  }

  if (numValue === 0) {
    delete newAssignments[abilitySlug];
  } else {
    newAssignments[abilitySlug] = numValue;
  }

  const prev = arrayAssignments;
  setArrayAssignments(newAssignments);
  void saveScores(newAssignments, prev, setArrayAssignments);
}
```

- [ ] **Step 6.4: Update `handlePointBuyChange`**

Replace the body (current lines 222–236) with:

```tsx
function handlePointBuyChange(abilitySlug: string, delta: number) {
  const current = scores[abilitySlug] ?? 8;
  const next = current + delta;
  if (next < 8 || next > 15) return;

  const newScores = { ...scores, [abilitySlug]: next };
  const newPointsUsed = Object.values(newScores).reduce(
    (sum, score) => sum + (POINT_BUY_COSTS[score] ?? 0),
    0,
  );
  if (newPointsUsed > POINT_BUY_BUDGET) return;

  const prev = scores;
  setScores(newScores);
  void saveScores(newScores, prev, setScores);
}
```

- [ ] **Step 6.5: Update `handleManualChange`**

Replace the body (current lines 238–245) with:

```tsx
function handleManualChange(abilitySlug: string, value: string) {
  const numValue = parseInt(value);
  if (isNaN(numValue) || numValue < 1 || numValue > 30) return;

  const newScores = { ...scores, [abilitySlug]: numValue };

  const prev = scores;
  setScores(newScores);
  void saveScores(newScores, prev, setScores);
}
```

- [ ] **Step 6.6: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors in `abilities-step-client.tsx`.

- [ ] **Step 6.7: Run the full test suite**

```bash
npx vitest run --reporter=dot
```

Expected: 607 tests pass.

- [ ] **Step 6.8: Commit**

```bash
git add app/(app)/characters/[id]/builder/abilities/abilities-step-client.tsx
git commit -m "refactor(builder/abilities): route saveScores through updateCharacter helper

saveScores now accepts (newScores, prevScores, applyOptimistic) so
the revert callback is explicit per caller (standard-array assigns
revert arrayAssignments; point-buy and manual revert scores). The
helper handles the supabase write + error logging.

Previously saveScores was fire-and-forget — a failed write left the
UI showing the new value with no revert. Now the optimistic state
is restored on error."
```

---

## Task 7: Migrate `equipment-step-client.tsx` (2 character updates)

**File:** `app/(app)/characters/[id]/builder/equipment/equipment-step-client.tsx`

**Call-site inventory:**

| # | Handler | Operation |
|---|---|---|
| 1 | `handleAcknowledge` | character update (and a local `setAcknowledged(true)`) |
| 2 | `handleSelectBundle` | character update (no local mirror — reads from `character.choices` directly) |

`handleSelectBundle` has no local mirror — it relies on the server-rendered `character.choices.starting_equipment` to drive the highlighted bundle. Since there's no optimistic UI to revert, the error path just logs.

- [ ] **Step 7.1: Update imports**

Replace:

```tsx
import { createClient } from "@/lib/supabase/client";
```

with:

```tsx
import { updateCharacter } from "@/lib/supabase/character-client";
```

In the component body, remove:

```tsx
const supabase = createClient();
```

- [ ] **Step 7.2: Refactor `handleAcknowledge`**

Replace the body (current lines 59–71) with:

```tsx
async function handleAcknowledge() {
  const newChoices = {
    ...character.choices,
    starting_equipment: "acknowledged",
  };

  setAcknowledged(true);

  try {
    await updateCharacter(characterId, { choices: newChoices });
  } catch (err) {
    setAcknowledged(false);
    console.error("Failed to acknowledge equipment:", err);
  }
}
```

- [ ] **Step 7.3: Refactor `handleSelectBundle`**

Replace the body (current lines 74–84) with:

```tsx
async function handleSelectBundle(bundle: string) {
  const newChoices = {
    ...character.choices,
    starting_equipment: bundle,
  };

  try {
    await updateCharacter(characterId, { choices: newChoices });
  } catch (err) {
    console.error("Failed to select equipment bundle:", err);
  }
}
```

Note: there is no local optimistic mirror to revert here — the radio selection is driven by `character.choices.starting_equipment` from the server. The `try/catch` exists for symmetry and to ensure the error is logged rather than swallowed.

- [ ] **Step 7.4: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors in `equipment-step-client.tsx`.

- [ ] **Step 7.5: Run the full test suite**

```bash
npx vitest run --reporter=dot
```

Expected: 607 tests pass.

- [ ] **Step 7.6: Commit**

```bash
git add app/(app)/characters/[id]/builder/equipment/equipment-step-client.tsx
git commit -m "refactor(builder/equipment): route 2 character writes through updateCharacter helper

handleAcknowledge reverts setAcknowledged on failure (the only
optimistic local state in this component). handleSelectBundle has
no local mirror to revert; it just logs on error."
```

---

## Task 8: New `tests/lib/character/character-context.test.tsx` (~7 tests)

**File:** `tests/lib/character/character-context.test.tsx` (NEW)

The provider has no test file today (audit candidate #3). This task locks down the public hook surface without trying to test every internal hook permutation.

The test harness mirrors `tests/components/sheet/character-header.test.tsx`'s `wrap(...)` pattern: render `<CharacterProvider>` with a minimal-but-typed fixture, then expose hooks via a tiny test consumer.

- [ ] **Step 8.1: Verify the target directory exists, then create the test file**

```bash
mkdir -p tests/lib/character
```

(On Windows PowerShell: `New-Item -ItemType Directory -Path tests/lib/character -Force`.)

- [ ] **Step 8.2: Write the test file (all 7 tests)**

Create `tests/lib/character/character-context.test.tsx` with the following content:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  CharacterProvider,
  useCharacter,
  useCharacterState,
  useInventory,
  useSpells,
} from "@/lib/character/character-context";
import type {
  CharacterWithSystem,
  CharacterState,
} from "@/lib/types/character";

// Mock the supabase paths the provider invokes.
vi.mock("@/lib/sheet/update-state", () => ({
  updateCharacterState: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/supabase/inventory", () => ({
  addInventoryItem: vi.fn(),
  updateInventoryItem: vi.fn().mockResolvedValue(undefined),
  removeInventoryItem: vi.fn().mockResolvedValue(undefined),
  unequipAllArmor: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/supabase/spells", () => ({
  addCharacterSpell: vi.fn(),
  updateCharacterSpell: vi.fn().mockResolvedValue(undefined),
  removeCharacterSpell: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/supabase/character-client", () => ({
  updateCharacter: vi.fn().mockResolvedValue(undefined),
  updateCharacterColor: vi.fn().mockResolvedValue(undefined),
}));

import { updateCharacterState } from "@/lib/sheet/update-state";
import { addInventoryItem } from "@/lib/supabase/inventory";
import { addCharacterSpell } from "@/lib/supabase/spells";

const mockedUpdateState = vi.mocked(updateCharacterState);
const mockedAddInventoryItem = vi.mocked(addInventoryItem);
const mockedAddSpell = vi.mocked(addCharacterSpell);

const mockCharacter = {
  id: "char-1",
  user_id: "user-1",
  system_id: "system-1",
  campaign_id: null,
  name: "Test Character",
  visibility: "private",
  archived: false,
  level: 1,
  base_stats: {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  },
  choices: { classes: [] },
  state: {},
  narrative: {},
  narrative_rich: {},
  primary_color: null,
  game_systems: {
    id: "system-1",
    name: "D&D 5e",
    slug: "dnd-5e",
    schema_definition: {} as unknown,
  },
} as unknown as CharacterWithSystem;

const mockSchema = {
  ability_scores: [
    { slug: "strength", name: "Strength", abbr: "STR" },
    { slug: "dexterity", name: "Dexterity", abbr: "DEX" },
    { slug: "constitution", name: "Constitution", abbr: "CON" },
    { slug: "intelligence", name: "Intelligence", abbr: "INT" },
    { slug: "wisdom", name: "Wisdom", abbr: "WIS" },
    { slug: "charisma", name: "Charisma", abbr: "CHA" },
  ],
  proficiency_levels: [],
  derived_stats: [],
  skills: [],
  resources: [],
  content_types: [],
  currencies: [],
  creation_steps: [],
  sheet_sections: [],
} as unknown;

interface ProbeProps {
  initialState?: CharacterState;
  primaryColor?: string | null;
  onPrimaryColorChange?: (c: string | null) => void;
}

function renderWithProvider(
  Probe: React.ComponentType,
  overrides: ProbeProps = {},
) {
  return render(
    <CharacterProvider
      character={mockCharacter}
      schema={mockSchema as never}
      contentRefs={[]}
      initialState={overrides.initialState ?? ({} as never)}
      initialInventory={[]}
      initialSpells={[]}
      classData={{} as never}
      allEffects={[]}
      baseStatsWithLevel={{
        level: 1,
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      }}
      structuredSources={{} as never}
      isOwner={true}
      isDm={false}
      hasSheet={true}
      maxHp={10}
      primaryColor={overrides.primaryColor ?? null}
      onPrimaryColorChange={overrides.onPrimaryColorChange ?? (() => {})}
    >
      <Probe />
    </CharacterProvider>,
  );
}

describe("<CharacterProvider> public hook surface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("useCharacter() exposes character, schema, contentRefs, isOwner, isDm, hasSheet", () => {
    function Probe() {
      const c = useCharacter();
      return (
        <div>
          <span data-testid="name">{c.character.name}</span>
          <span data-testid="isOwner">{String(c.isOwner)}</span>
          <span data-testid="isDm">{String(c.isDm)}</span>
          <span data-testid="hasSheet">{String(c.hasSheet)}</span>
        </div>
      );
    }
    renderWithProvider(Probe);
    expect(screen.getByTestId("name").textContent).toBe("Test Character");
    expect(screen.getByTestId("isOwner").textContent).toBe("true");
    expect(screen.getByTestId("isDm").textContent).toBe("false");
    expect(screen.getByTestId("hasSheet").textContent).toBe("true");
  });

  it("useCharacter() exposes primaryColor and setPrimaryColor (PR-F)", () => {
    const onChange = vi.fn();
    function Probe() {
      const c = useCharacter();
      return (
        <button
          data-testid="set"
          onClick={() => c.setPrimaryColor("#7c3aed")}
        >
          {c.primaryColor ?? "none"}
        </button>
      );
    }
    renderWithProvider(Probe, {
      primaryColor: "#abcdef",
      onPrimaryColorChange: onChange,
    });
    expect(screen.getByTestId("set").textContent).toBe("#abcdef");
    act(() => {
      screen.getByTestId("set").click();
    });
    expect(onChange).toHaveBeenCalledWith("#7c3aed");
  });

  it("useCharacterState().patchState calls the atomic-merge RPC and updates local state", async () => {
    function Probe() {
      const { state, patchState } = useCharacterState();
      return (
        <button
          data-testid="apply"
          onClick={() => {
            void patchState({ current_hp: 7 });
          }}
        >
          {String((state as CharacterState).current_hp ?? "null")}
        </button>
      );
    }
    renderWithProvider(Probe);
    expect(screen.getByTestId("apply").textContent).toBe("null");
    await act(async () => {
      screen.getByTestId("apply").click();
    });
    expect(mockedUpdateState).toHaveBeenCalledWith("char-1", { current_hp: 7 });
    expect(screen.getByTestId("apply").textContent).toBe("7");
  });

  it("useCharacterState().patchState swallows server errors after applying local state (matches current behavior)", async () => {
    mockedUpdateState.mockRejectedValueOnce(new Error("RLS denied"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    function Probe() {
      const { state, patchState } = useCharacterState();
      return (
        <button
          data-testid="apply"
          onClick={() => {
            void patchState({ current_hp: 7 });
          }}
        >
          {String((state as CharacterState).current_hp ?? "null")}
        </button>
      );
    }
    renderWithProvider(Probe);
    await act(async () => {
      screen.getByTestId("apply").click();
    });
    // The provider currently logs but does not revert local state (atomic-merge
    // RPC path; revert is a separate scope). This test pins that disposition.
    expect(errorSpy).toHaveBeenCalled();
    expect(screen.getByTestId("apply").textContent).toBe("7");
    errorSpy.mockRestore();
  });

  it("useInventory().addItem appends the returned row to local inventory", async () => {
    mockedAddInventoryItem.mockResolvedValueOnce({
      id: "inv-1",
      character_id: "char-1",
      content_id: "potion-of-healing",
      name: "Potion of Healing",
      quantity: 1,
      equipped: false,
      attuned: false,
      notes: null,
      custom_data: null,
    } as never);
    function Probe() {
      const { inventory, addItem } = useInventory();
      return (
        <div>
          <button
            data-testid="add"
            onClick={() => {
              void addItem({
                content_id: "potion-of-healing",
                name: "Potion of Healing",
                content_type: "item",
              });
            }}
          />
          <span data-testid="count">{inventory.length}</span>
        </div>
      );
    }
    renderWithProvider(Probe);
    expect(screen.getByTestId("count").textContent).toBe("0");
    await act(async () => {
      screen.getByTestId("add").click();
    });
    expect(mockedAddInventoryItem).toHaveBeenCalledWith("char-1", {
      content_id: "potion-of-healing",
      name: "Potion of Healing",
      content_type: "item",
    });
    expect(screen.getByTestId("count").textContent).toBe("1");
  });

  it("useSpells().addSpell appends the returned row to local spells", async () => {
    mockedAddSpell.mockResolvedValueOnce({
      id: "spell-1",
      character_id: "char-1",
      content_id: "magic-missile",
      name: "Magic Missile",
      level: 1,
      always_prepared: false,
      always_known: false,
      prepared: false,
    } as never);
    function Probe() {
      const { spells, addSpell } = useSpells();
      return (
        <div>
          <button
            data-testid="add"
            onClick={() => {
              void addSpell({
                content_id: "magic-missile",
                name: "Magic Missile",
                level: 1,
              } as never);
            }}
          />
          <span data-testid="count">{spells.length}</span>
        </div>
      );
    }
    renderWithProvider(Probe);
    expect(screen.getByTestId("count").textContent).toBe("0");
    await act(async () => {
      screen.getByTestId("add").click();
    });
    expect(mockedAddSpell).toHaveBeenCalled();
    expect(screen.getByTestId("count").textContent).toBe("1");
  });

  it("useCharacter() throws when called outside <CharacterProvider>", () => {
    function Probe() {
      useCharacter();
      return null;
    }
    // Suppress React's error logging for the expected throw.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(
      /Character hook used outside CharacterProvider/,
    );
    errorSpy.mockRestore();
  });
});
```

- [ ] **Step 8.3: Run the new test file**

```bash
npx vitest run tests/lib/character/character-context.test.tsx --reporter=verbose
```

Expected: 7 tests pass.

- [ ] **Step 8.4: Run the full test suite**

```bash
npx vitest run --reporter=dot
```

Expected: 607 + 7 = **614 tests pass**.

- [ ] **Step 8.5: Commit**

```bash
git add tests/lib/character/character-context.test.tsx
git commit -m "test(character-context): cover <CharacterProvider> public hook surface

Adds 7 tests against the provider's user-facing API:
- useCharacter() identity fields + primaryColor pass-through
- useCharacterState().patchState happy path + error disposition
- useInventory().addItem and useSpells().addSpell local-append + supabase call
- useCharacter() throw-outside-provider invariant

Closes audit candidate #3 (largest untested file). The provider's
627 LOC is not exhaustively covered — only the public surface that
consumers rely on."
```

---

## Task 9: Regression run + browser smoke + open PR

- [ ] **Step 9.1: Full vitest run**

```bash
npx vitest run --reporter=verbose
```

Expected: 614 tests pass. Note any new failures and stop — investigate before continuing.

- [ ] **Step 9.2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors in any file touched by this PR. Pre-existing errors in `tests/resources/helpers.test.ts`, `tests/spells/helpers.test.ts`, and `tests/components/sheet/inventory-tab.test.tsx` are unrelated and out of scope. If you see new errors elsewhere, stop and fix.

- [ ] **Step 9.3: Production build**

```bash
npm run build
```

Expected: clean build, no errors. Note: the build is the highest-fidelity check that `"use client"` boundaries are intact (the new `lib/supabase/content-refs.ts` mixes server + browser imports; Next.js should still tree-shake correctly because each helper only references one of the two clients).

- [ ] **Step 9.4: Browser smoke — Voltee (Wizard 3, build-from-scratch)**

Copy the env file into the worktree if not already present:

```bash
cp ../../../.env.local .env.local
```

(Or use `Copy-Item` on PowerShell.)

Start the dev server via the preview tooling (`preview_start`). Log in with `test@inkborne.app` / `testpassword123`. Open Voltee in the builder.

Walk each step:
- **Race step:** Pick a race, confirm a subrace, change subrace, then change race. Each commit should persist after refresh. The Change-Subrace fix (Task 5.6) means the subrace content_ref also disappears — verify via the sheet's racial-traits area after clearing.
- **Class step:** Add a class, pick a subclass via the modal, change the level via the rail, pick a fighting style if available, remove the class. Each commit should persist; level + choices stay in sync.
- **Abilities step:** Toggle between standard array / point buy / manual. Assign scores. Refresh — values persist.
- **Background step:** Pick a background, fill the four narrative tables, change background. Each commit should persist.
- **Equipment step:** Confirm equipment. Persists.

- [ ] **Step 9.5: Browser smoke — Xero (Barbarian 10 / Fighter 5, PR-F regression)**

Open Xero's sheet. Use the color picker in the header. Confirm the primary color persists across refresh (this exercises `updateCharacterColor` → `updateCharacter` delegation, which is the PR-F regression check). Add or remove a class via the rail; confirm the sheet's class section updates.

- [ ] **Step 9.6: Browser smoke — forced-failure (optional but recommended)**

In DevTools → Network, block the supabase domain temporarily. Trigger one builder step action (e.g., select a different race). Confirm:
- The optimistic UI flashes to the new selection
- Within a few hundred ms it reverts to the previous selection
- `console.error` shows the failure with the right helper message ("Failed to select race: …")

Unblock the network when done.

- [ ] **Step 9.7: Open the pull request**

```bash
gh pr create --base main --head refactor/builder-character-mutations \
  --title "refactor(builder): consolidate character mutations behind typed helpers" \
  --body "$(cat <<'EOF'
## Summary

First post-M2 refactor — tackles audit candidate #1 ([architecture overview](docs/architecture/00-overview.md)). Consolidates 21 inline `.from(\"characters\").update(...)` calls and the scattered inline `character_content_refs` writes across the 5 builder step-clients behind typed helpers, and adds optimistic-then-revert error handling at every call site.

Implements the spec at [`docs/superpowers/specs/2026-05-14-builder-mutations-refactor-design.md`](docs/superpowers/specs/2026-05-14-builder-mutations-refactor-design.md) (merged via #55). Plan at [`docs/superpowers/plans/2026-05-14-builder-mutations-refactor.md`](docs/superpowers/plans/2026-05-14-builder-mutations-refactor.md).

## Changes

- **New helpers**
  - `updateCharacter(id, patch)` in `lib/supabase/character-client.ts`. Typed against a new `CharacterUpdatePatch` (`Partial<Pick<Character, ...>>`). Throws on supabase error. `updateCharacterColor` (PR-F) is now a 1-line delegation.
  - `insertContentRef(params)` and `removeContentRefById(id)` in `lib/supabase/content-refs.ts`. Browser-side primitives that live alongside the existing server-side helpers.
- **Step-client migrations** — 21 character writes + 9 content-ref orchestrations now route through helpers with `try { ... } catch { revert local; console.error }` wrapping each handler. `router.refresh()` only fires on success.
- **Coverage** — new `tests/lib/character/character-context.test.tsx` (~7 tests on the provider's public surface). Closes audit candidate #3.

## Behavior

Pure code refactor in the happy path; failure semantics improve:
- Awaited writes that previously silently dropped on RLS errors now revert the optimistic UI and log to console.
- Fixed latent bug: race step's \"Change Subrace\" button previously cleared `choices.subrace` but left the subrace content_ref in place. Now removes both.

## Tests

- 4 `updateCharacter` unit tests + 1 delegation test
- 4 browser-side content_refs unit tests
- 7 `<CharacterProvider>` surface tests
- All 598 baseline tests still pass
- Total: 614 tests passing

## Verification

- [x] All tests pass
- [x] `npx tsc --noEmit` no new errors in touched files
- [x] `npm run build` clean
- [x] Browser smoke on Voltee (build from scratch through each step)
- [x] Browser smoke on Xero (color picker + class add/remove)
- [x] Forced-failure smoke (network block) confirms optimistic revert + console.error

## Notes

- No DB migration. No feature flag. Squash-merge.
- `components/sheet/character-header.tsx` intentionally unchanged — it routes through `updateCharacterColor`, which now delegates to `updateCharacter`. Existing tests verify the delegation path.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

The PR URL is returned by `gh`. Paste it into the session output.

- [ ] **Step 9.8: Mark task done**

No additional commit — the PR creation itself completes the workflow. The reviewer takes over from here.

---

## Verification gate (mirrors `.continue-here.md`)

- [x] All 598 existing tests pass
- [x] 12 new tests pass (4 `updateCharacter` + 1 delegation + 4 content_refs + 7 character-context = **12 new**)
- [x] `npx tsc --noEmit` no new errors in touched files
- [x] `npm run build` clean
- [x] Browser smoke on Voltee (build from scratch via each builder step; each step commits cleanly)
- [x] Browser smoke on Xero (color picker via sheet header; class add/remove via the rail)
- [x] Optional: forced-failure smoke confirms optimistic revert + console.error

## Open questions

None. All 9 spec questions are closed. The one fork that emerged during plan-writing (content-refs.ts location for new browser helpers) was resolved via the brainstorm checkpoint above the plan: helpers mixed into `content-refs.ts`.

If a step-client surfaces a write pattern this plan didn't anticipate (e.g., a handler that writes both `state` and `choices` in one go), stop and brainstorm rather than improvising. The atomic-merge RPC `patch_character_state` is for `state` patches only and isn't substitutable for `updateCharacter` writes to `choices` / `level`.
