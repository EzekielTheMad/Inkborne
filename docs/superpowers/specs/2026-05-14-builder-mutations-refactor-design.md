# Builder character mutations refactor — design spec

**Date:** 2026-05-14
**Status:** Design approved, ready for implementation plan
**Slice:** First post-M2 refactor. Tackles candidate #1 from the architecture audit ([`docs/architecture/04-tests-and-tech-debt.md`](../../architecture/04-tests-and-tech-debt.md) — "Builder step-clients duplicate read-merge-write pattern"). Lays substrate for any future builder work and partially addresses the test-coverage gap on `lib/character/character-context.tsx`.

---

## Goal

Replace 21 inline `.from("characters").update(...)` calls plus the scattered `.from("character_content_refs").insert/delete(...)` calls across the five builder step-clients with three typed helpers in `lib/supabase/character-client.ts` and `lib/supabase/content-refs.ts`. Add optimistic-then-revert error handling at every call site so silent DB failures stop dropping writes. Add a focused test file covering the `<CharacterProvider>` public surface (the largest untested file the audit flagged).

Pure code refactor: no schema change, no behavior change in the happy path, no feature flag, no rollback story. The failure semantics get *better* (revert + log instead of silent drop).

## Non-goals

- **A `useCharacterUpdate(id)` React hook wrapping state + persistence + revert.** Considered and rejected — each step-client's orchestration is too case-specific (race vs. class vs. equipment all interleave character writes with content-ref writes differently). A generic hook would either be too thin to earn the indirection or too complex to type. Helper + inline orchestration keeps each step-client readable in one place.
- **Running the Zod schemas in [`lib/schemas/content-types/`](../../../lib/schemas/content-types/)** at the I/O boundary. That's candidate #2 of the audit — a separate, larger slice that's better tackled once the helpers exist as the parsing anchor.
- **Refactoring `lib/character/character-context.tsx` itself.** The 627-LOC provider gets a *test file* but no production changes in this PR. Restructuring it is a separate scope.
- **Toast / user-visible error UI.** `console.error` matches today's disposition and PR-F's `handleColorChange`. Wiring a toast library is out of scope.
- **Concurrency / race-condition hardening.** The optimistic-then-revert pattern is already inherently racy under rapid clicks; this refactor doesn't make it worse but doesn't fix it either. The atomic-merge RPC `patch_character_state` ([`supabase/migrations/00031_patch_character_state_rpc.sql`](../../../supabase/migrations/00031_patch_character_state_rpc.sql)) is for the `state` column and isn't relevant to top-level field overwrites on `choices` / `level` / `primary_color`.
- **E2E framework (Playwright / Cypress).** Inkborne doesn't have one yet; not in scope.

## Key decisions

| # | Decision | Choice |
|---|---|---|
| Q1 | Refactor target | Builder step-clients consolidation (audit candidate #1). |
| Q2 | Helper shape | Single `updateCharacter(id, patch)` typed against `Partial<Pick<Character, ...>>`. No per-field helpers proliferation. |
| Q3 | Scope of migration | All 5 step-clients + all 21 inline character updates + all inline content-refs writes, one PR. |
| Q4 | Local-state mirrors | Leave them. Optimistic UI is a legitimate concern; hook abstraction rejected (see Non-goals). |
| Q5 | content-refs migration | In scope. Use existing helpers in `lib/supabase/content-refs.ts`; add new ones if needed. |
| Q6 | Error handling | Helper throws on supabase `{ error }`. Caller `try { … } catch { revert local + console.error }`. `router.refresh()` only fires on success. |
| Q7 | Tests | Unit-test new helpers + add a focused test file for the `<CharacterProvider>` public surface (the audit-coverage tweak). |
| Q8 | File location | Extend existing `lib/supabase/character-client.ts` and `lib/supabase/content-refs.ts`. No new source files (one new test file). |
| Q9 | Rollout | Stand-alone PR `refactor/builder-character-mutations` → main. Squash merge. No feature flag. |

## File layout

### Modified files (no new source files)

| File | Changes |
|---|---|
| [`lib/supabase/character-client.ts`](../../../lib/supabase/character-client.ts) | Add `updateCharacter(id, patch)` exported function. Refactor `updateCharacterColor` to be a 1-liner delegating to it. |
| [`lib/supabase/content-refs.ts`](../../../lib/supabase/content-refs.ts) | Audit existing helpers; add any missing ones step-clients need (most likely a `replaceContentRefForSource(charId, source, contentDef)` for subclass / fighting-style / background swaps where the pattern is "delete old by `(content_type, context.source, …)`, insert new"). |
| [`lib/types/character.ts`](../../../lib/types/character.ts) | Export `CharacterUpdatePatch` type for stable call-site naming. |
| [`app/(app)/characters/[id]/builder/class/class-step-client.tsx`](../../../app/(app)/characters/[id]/builder/class/class-step-client.tsx) | 9 inline character updates + ~4 content-ref writes → helper calls. Add optimistic-revert pattern around each. Biggest file in the PR. |
| [`app/(app)/characters/[id]/builder/race/race-step-client.tsx`](../../../app/(app)/characters/[id]/builder/race/race-step-client.tsx) | ~3 character updates + 1 content-ref pattern → helpers + revert. |
| [`app/(app)/characters/[id]/builder/abilities/abilities-step-client.tsx`](../../../app/(app)/characters/[id]/builder/abilities/abilities-step-client.tsx) | ~3 character updates → helpers + revert. |
| [`app/(app)/characters/[id]/builder/background/background-step-client.tsx`](../../../app/(app)/characters/[id]/builder/background/background-step-client.tsx) | ~4 character updates + 1 content-ref pattern → helpers + revert. |
| [`app/(app)/characters/[id]/builder/equipment/equipment-step-client.tsx`](../../../app/(app)/characters/[id]/builder/equipment/equipment-step-client.tsx) | ~2 character updates → helpers + revert. |
| [`components/sheet/character-header.tsx`](../../../components/sheet/character-header.tsx) | Already uses `updateCharacterColor` (PR-F). Verify no regression after the delegation refactor. Likely zero code change. |

### Modified test files

| File | Changes |
|---|---|
| [`tests/lib/supabase/character-client.test.ts`](../../../tests/lib/supabase/character-client.test.ts) | Add `describe("updateCharacter")` with 4 cases. Existing `updateCharacterColor` tests stay — they exercise the same end behavior through the delegated call. |
| [`tests/lib/supabase/content-refs.test.ts`](../../../tests/lib/supabase/content-refs.test.ts) | Add one describe block per new helper introduced in `content-refs.ts`. The plan-writing session audits the existing file and decides which helpers to add; tests track 1:1 with helpers added (estimate 0–3). |

### New test files

| File | Coverage |
|---|---|
| [`tests/lib/character/character-context.test.tsx`](../../../tests/lib/character/character-context.test.tsx) | Focused tests on `<CharacterProvider>` public surface — `useCharacter()`, `useCharacterState.patchState`, `useInventory.addItem`, `useSpells.addSpell`. ~7 tests. Locks the surface area without trying to test the full 627 LOC. |

## Helper contracts

### `updateCharacter(id, patch)`

```ts
// lib/types/character.ts
export type CharacterUpdatePatch = Partial<
  Pick<
    Character,
    | "name"
    | "level"
    | "choices"
    | "primary_color"
    | "visibility"
    | "archived"
  >
>;

// lib/supabase/character-client.ts
import { createClient } from "@/lib/supabase/client";
import type { CharacterUpdatePatch } from "@/lib/types/character";

/**
 * Browser-side helper to write a partial patch to the characters row.
 * Throws on supabase error (RLS denial, check-constraint violation, network).
 * Caller is responsible for optimistic state + revert on failure.
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
 * Convenience wrapper preserved from PR-F. Delegates to updateCharacter.
 */
export async function updateCharacterColor(
  characterId: string,
  primaryColor: string | null,
): Promise<void> {
  await updateCharacter(characterId, { primary_color: primaryColor });
}
```

### Content-refs helpers (audit-and-extend)

The plan-writing session reads [`lib/supabase/content-refs.ts`](../../../lib/supabase/content-refs.ts) and decides which existing helpers cover each call site. Likely shape of new additions:

```ts
// lib/supabase/content-refs.ts (extends existing file)

/**
 * Replace the existing content_ref for (character, context.source) with a new one,
 * if any exists. Used for race / class / subclass / background / fighting-style swaps.
 */
export async function replaceContentRefForSource(params: {
  characterId: string;
  source: string;                              // e.g. "background", "subclass", "fighting_style"
  scopeKeys?: Record<string, unknown>;         // e.g. { class: "fighter" } for subclass-by-class
  newContent: { id: string; version: number; contentSlug: string };
  contextExtras?: Record<string, unknown>;     // extra fields on the new ref's context
}): Promise<void>;

/**
 * Delete all content_refs for (character, context.source [, scopeKeys])
 * without inserting a new one. Used when clearing a choice.
 */
export async function clearContentRefForSource(params: {
  characterId: string;
  source: string;
  scopeKeys?: Record<string, unknown>;
}): Promise<void>;
```

Exact signatures get finalized in the plan-writing session after reading the existing file. The principle: **one helper per orchestration pattern**, not per inline call.

## Call-site pattern

**Before (current):**

```ts
async function handleSelectClass(content: ContentEntry) {
  const newClasses = [...selectedClasses, { slug: content.slug, level: 1 }];
  const totalLevel = newClasses.reduce((s, c) => s + c.level, 0);
  const newChoices = { ...localChoices, classes: newClasses };

  setLocalChoices(newChoices);
  setLocalLevel(totalLevel);

  await supabase
    .from("characters")
    .update({ choices: newChoices, level: totalLevel })
    .eq("id", characterId);

  await supabase.from("character_content_refs").insert([{
    character_id: characterId,
    content_id: content.id,
    content_version: content.version,
    context: { source: "class", level: 1 },
  }]);

  startTransition(() => router.refresh());
}
```

**After:**

```ts
async function handleSelectClass(content: ContentEntry) {
  const newClasses = [...selectedClasses, { slug: content.slug, level: 1 }];
  const totalLevel = newClasses.reduce((s, c) => s + c.level, 0);
  const newChoices = { ...localChoices, classes: newClasses };

  const prev = { choices: localChoices, level: localLevel };
  setLocalChoices(newChoices);
  setLocalLevel(totalLevel);

  try {
    await updateCharacter(characterId, { choices: newChoices, level: totalLevel });
    await insertContentRef({
      characterId,
      contentId: content.id,
      contentVersion: content.version,
      context: { source: "class", level: 1 },
    });
    startTransition(() => router.refresh());
  } catch (err) {
    setLocalChoices(prev.choices);
    setLocalLevel(prev.level);
    console.error("Failed to add class:", err);
  }
}
```

**Three semantic guarantees this enforces (vs. today's silent drop):**

1. **DB writes are awaited and checked.** The helper throws on `{ error }`, so the `await` in the caller is meaningful.
2. **Local state reverts on failure.** `prev` is captured before the optimistic write; the catch restores it.
3. **`router.refresh()` only fires on success.** No more "refresh after silent failure" flicker.

When a handler does multiple sequential helper calls (character update + content-ref insert), they share one try/catch — if either fails, the unit reverts. We don't attempt cross-call rollback (e.g., if character update succeeds but content-ref insert fails, the character is updated and we surface the error; the next user action will re-sync). This matches today's failure mode and isn't degrading anything; truly atomic multi-table writes would need a server-side RPC (out of scope).

## Tests

### Helper unit tests (extend `tests/lib/supabase/character-client.test.ts`)

```ts
describe("updateCharacter", () => {
  it("writes a partial patch to the characters row", async () => {
    mockEq.mockResolvedValue({ error: null });
    await updateCharacter("char-1", { level: 5 });
    expect(mockFrom).toHaveBeenCalledWith("characters");
    expect(mockUpdate).toHaveBeenCalledWith({ level: 5 });
    expect(mockEq).toHaveBeenCalledWith("id", "char-1");
  });

  it("writes multi-field patches atomically", async () => {
    mockEq.mockResolvedValue({ error: null });
    await updateCharacter("char-1", { choices: { classes: [] }, level: 3 });
    expect(mockUpdate).toHaveBeenCalledWith({
      choices: { classes: [] },
      level: 3,
    });
  });

  it("throws when supabase returns an error", async () => {
    mockEq.mockResolvedValue({ error: { message: "RLS denied" } });
    await expect(updateCharacter("char-1", { level: 5 })).rejects.toThrow("RLS denied");
  });

  it("is a no-op for an empty patch (defensive)", async () => {
    await updateCharacter("char-1", {});
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe("updateCharacterColor (post-refactor)", () => {
  it("delegates to updateCharacter with { primary_color: hex }", async () => {
    mockEq.mockResolvedValue({ error: null });
    await updateCharacterColor("char-1", "#7c3aed");
    expect(mockUpdate).toHaveBeenCalledWith({ primary_color: "#7c3aed" });
  });
  // existing 3 PR-F tests stay — they verify the end behavior through delegation
});
```

### Content-refs helper tests

Extend [`tests/lib/supabase/content-refs.test.ts`](../../../tests/lib/supabase/content-refs.test.ts) with one describe block per new helper. Exact test count finalized once we audit what's already there.

### `<CharacterProvider>` surface coverage (NEW: `tests/lib/character/character-context.test.tsx`)

Mock `@/lib/supabase/client` to a chainable stub the same way `character-header.test.tsx` does. Render `<CharacterProvider>` with a minimal-but-typed fixture. Pull each hook through a tiny test consumer component.

```ts
describe("<CharacterProvider> public hook surface", () => {
  it("useCharacter() exposes the character + isOwner + isDm + hasSheet", () => { ... });
  it("useCharacter() exposes primaryColor and setPrimaryColor (PR-F)", () => { ... });
  it("useCharacterState.patchState calls the atomic-merge RPC + updates local state", async () => { ... });
  it("useCharacterState.patchState reverts local on RPC error", async () => { ... });
  it("useInventory().addItem appends to local + calls supabase", async () => { ... });
  it("useSpells().addSpell appends to local + calls supabase", async () => { ... });
  it("useCharacterContext throws when called outside a provider", () => { ... });
});
```

~7 tests. Lock down the public hook surface; don't try to test every internal hook permutation.

### Browser smoke (manual, during PR review)

- Test account: `test@inkborne.app` / `testpassword123`
- Voltee (Wizard 3): rebuild from scratch via the builder — exercise each step (race, class, abilities, background, equipment). Confirm each commit persists, level/choices stay in sync.
- Xero (Barbarian 10 / Fighter 5): pick a color via the sheet picker (regression check for PR-F's `updateCharacterColor` after delegation). Pick / unpick a class via the rail. Confirm content_refs round-trip.
- Force a failure: in DevTools, temporarily set a network block on the supabase update endpoint and confirm one of the step actions reverts local state + logs to console (per the new error pattern).

## Implementation order (informs plan-writing)

1. **Helpers first** — `updateCharacter` + its tests + `updateCharacterColor` delegation refactor. Run PR-F-touched tests to confirm the sheet picker still works through the new code path.
2. **Content-refs helper audit** — read the existing file, add any missing helpers identified during migration, with tests.
3. **Migrate step-clients biggest first** — `class-step-client.tsx` (9 sites) → `background-step-client.tsx` (~4) → `race-step-client.tsx` (~3) → `abilities-step-client.tsx` (~3) → `equipment-step-client.tsx` (~2). Commit per file so each is independently revertable.
4. **`<CharacterProvider>` test file** at the end — independent of the refactor but groups thematically with "leave substrate cleaner".
5. **Regression + smoke + open PR.**

## Rollout

- **Branch:** `refactor/builder-character-mutations` → `main`. Stand-alone, not stacked.
- **Squash-merge** per convention.
- **No DB migration, no feature flag.** Pure code change; failure semantics improve, not degrade.
- **Verification gate:**
  - All 598 existing tests pass
  - ~11–14 new tests pass
  - `npm run build` clean
  - Browser smoke on Voltee + Xero per "Tests > Browser smoke" above

## Open questions for engineering (none)

All 9 scope questions closed during brainstorm. If anything emerges during implementation that reshapes scope (e.g., a step-client has a write pattern that doesn't fit `updateCharacter`'s shape), surface it back to brainstorm — don't quietly improvise.

---

## Appendix · Audit cross-reference

This refactor directly addresses item #1 of the architecture audit ([`docs/architecture/00-overview.md`](../../architecture/00-overview.md) — "Top three refactor candidates"):

> **1. Builder step-clients duplicate the read-merge-write pattern.** 21 inline `from("characters").update(...)` calls across 5 step-clients (9 in `class-step-client.tsx` alone), with hand-rolled local-state mirroring 18 times. The atomic-merge RPC from `00031_patch_character_state_rpc.sql` and `lib/supabase/content-refs.ts` helpers exist but aren't being used. Clearest consolidation target.

This PR partially addresses item #3 (test coverage) via the new `tests/lib/character/character-context.test.tsx`. Item #2 (Zod schemas at the content boundary) stays untouched — the helpers shipped here will be the parsing anchor when that work lands.
