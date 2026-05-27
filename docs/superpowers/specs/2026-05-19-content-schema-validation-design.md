# Content schema validation — design spec

**Date:** 2026-05-19
**Status:** Design approved, ready for implementation plan
**Slice:** Second post-M2 refactor. Tackles candidate #2 from the architecture audit ([`docs/architecture/04-tests-and-tech-debt.md`](../../architecture/04-tests-and-tech-debt.md) — "`Record<string, unknown>` is the de-facto contract for `content_definitions.data`"). Closes the 21 pre-existing test typecheck errors that have been outstanding all milestone.

---

## Goal

Run the 15 existing Zod schemas in [`lib/schemas/content-types/`](../../../lib/schemas/content-types/) at the **server fetch boundary** so the 30+ `(data as Record<string, unknown>).field as T` reads across the codebase become typed property access. Centralise the parsing in a new module so every read of `content_definitions` goes through the same envelope-then-data validation path, with consistent log-and-skip behaviour on bad rows.

Pure refactor. No DB migration, no feature flag, no new schema authoring (the schemas already exist and are tested in [`tests/schemas/content-types.test.ts`](../../../tests/schemas/content-types.test.ts)). Failure semantics improve (today: silent `Record<string, unknown>` reads that surface as runtime errors deep in the UI; after: structured `console.error` at the fetch boundary, bad row omitted from the result set).

## Non-goals

- **`custom_data` Zod typing on inventory/spells.** Per-character JSONB overrides have no shared schema today — users can author arbitrary shapes for homebrew. A typed `custom_data` model needs its own design and is out of scope here.
- **`effects[].context` parsing at the evaluator boundary.** The engine's contract with the rest of the app is intentionally `Record<string, unknown>` end-to-end (see [`lib/engine/evaluator.ts:185`](../../../lib/engine/evaluator.ts), [`lib/engine/conditions.ts:11`](../../../lib/engine/conditions.ts), [`lib/engine/sandbox.ts:17`](../../../lib/engine/sandbox.ts)). Tightening that boundary is a separate, larger slice.
- **Bulk re-validation of existing DB rows.** The Zod schemas were authored from the SRD/MPMB import shapes; no drift is expected. If drift appears, the new log-and-skip path surfaces it at next page load and we patch the row manually. A `npm run validate-content` dev tool can land as a follow-up if real drift is found.
- **Parse-on-write at the SRD import boundary.** The transformers in [`scripts/transformers/`](../../../scripts/transformers/) already conform to the schema shape (the schemas were written from them). Hardening writes via the same schemas is a defensible follow-up but doesn't reduce reader cast count, which is the audit's stated concern.
- **Toast / user-visible UI on bad-row skips.** `console.error` matches the disposition set by PR-F and PR #56. Wiring a toast library is out of scope.
- **Refactoring the 18 typed Zod schemas themselves.** They've been tested via the existing 296-LOC [`tests/schemas/content-types.test.ts`](../../../tests/schemas/content-types.test.ts). If a schema turns out to be wrong against real DB rows, surface that as a brainstorm question rather than improvising; the schemas are not in scope to edit.

## Key decisions

| # | Decision | Choice |
|---|---|---|
| Q1 | Scope of `Record<string, unknown>` migration | `content_definitions.data` only. `custom_data` and `effects[].context` are explicitly out of scope (see Non-goals). |
| Q2 | Enforcement point | Server fetch boundary only. Parse once at the Supabase query site; client receives typed data. Browser components only WRITE (handled by PR #56's helpers); they never need to parse on the client. |
| Q3 | Failure handling | `safeParse` per row. On failure: `console.error("[content-definitions] Bad shape for <slug> (<content_type>):", issues)` and OMIT the row from the returned array. Caller sees a smaller list; UI degrades gracefully (missing entry, not crash). |
| Q4 | Existing-data migration | Parse-on-read only. No bulk script. If drift surfaces at runtime, log surfaces it. |
| Q5 | Test fixture remediation | In scope. Fold the 21 fixture errors in [`tests/resources/helpers.test.ts`](../../../tests/resources/helpers.test.ts) (17) and [`tests/spells/helpers.test.ts`](../../../tests/spells/helpers.test.ts) (4) into this PR via a new [`tests/fixtures/content.ts`](../../../tests/fixtures/content.ts) factory file. |
| Q6 | New helper module vs. extending `content-refs.ts` | New file [`lib/supabase/content-definitions.ts`](../../../lib/supabase/content-definitions.ts). Lives next to the existing CRUD helpers but with a single clear responsibility (parsed reads). Mirrors the PR #56 split-by-runtime convention. |
| Q7 | Discriminated-union return type | NOT materialized as a TS union over all 15 content-types. Instead, `ParsedContentDefinition` is generic over `TData` and call sites cast the inner `data` to the corresponding type (`ClassData`, `RaceData`, etc.) — the cast is now safe because parsing succeeded. |
| Q8 | Rollout | Stand-alone PR `refactor/content-schema-validation` → main. Squash merge. No feature flag. |

## File layout

### New source files

| File | Responsibility |
|---|---|
| [`lib/supabase/content-definitions.ts`](../../../lib/supabase/content-definitions.ts) | Server-side typed accessors. `getContentByType(systemId, contentType)`, `parseContentDefinition(raw)`. Returns `ParsedContentDefinition[]`. |

### New test files

| File | Coverage |
|---|---|
| [`tests/fixtures/content.ts`](../../../tests/fixtures/content.ts) | `makeContentDefinition(overrides)`, `makeContentRef(overrides)` factory functions for use in tests. Fills required fields (`id`, `slug`, `name`, `content_type`, `effects: []`, `version`, `source`) with sane defaults. |
| [`tests/lib/supabase/content-definitions.test.ts`](../../../tests/lib/supabase/content-definitions.test.ts) | Unit tests for the new accessors — happy path, envelope failure, data-schema failure, unknown content_type, all skip without throwing. ~6 tests. |

### Modified source files

| File | Changes |
|---|---|
| [`lib/schemas/content-types/index.ts`](../../../lib/schemas/content-types/index.ts) | Add `parseContentByType(contentType, data)` convenience that returns `{ ok: true, data } \| { ok: false, error }`. Saves boilerplate at call sites. |
| [`lib/supabase/content-refs.ts`](../../../lib/supabase/content-refs.ts) | Update `ContentRefWithContent.content_definitions.data` from `Record<string, unknown>` to the typed shape returned by `parseContentDefinition`. `getContentRefsByCharacter` parses each nested row, dropping bad ones with the same log+skip rule. |
| 5 server pages: [`app/(app)/characters/[id]/page.tsx`](../../../app/(app)/characters/[id]/page.tsx), [`builder/race/page.tsx`](../../../app/(app)/characters/[id]/builder/race/page.tsx), [`builder/class/page.tsx`](../../../app/(app)/characters/[id]/builder/class/page.tsx), [`builder/background/page.tsx`](../../../app/(app)/characters/[id]/builder/background/page.tsx), [`builder/equipment/page.tsx`](../../../app/(app)/characters/[id]/builder/equipment/page.tsx) | Replace inline `.from("content_definitions").select(...).eq("content_type", "X")` with `getContentByType(systemId, "X")` calls. |
| [`lib/supabase/spells.ts`](../../../lib/supabase/spells.ts) | Switch `Record<string, unknown>` `data` reads to typed access. |
| [`lib/supabase/inventory.ts`](../../../lib/supabase/inventory.ts) | Same. |
| [`lib/resources/helpers.ts`](../../../lib/resources/helpers.ts) | Same. |
| ~17 consumer files in [`components/builder/`](../../../components/builder/), [`components/sheet/`](../../../components/sheet/), [`components/builder/class-step-rail/`](../../../components/builder/class-step-rail/) | Replace `(data as Record<string, unknown>).field as T` casts with typed property access. Exact file list locked during plan-writing once the call sites are walked. |

### Modified test files

| File | Changes |
|---|---|
| [`tests/resources/helpers.test.ts`](../../../tests/resources/helpers.test.ts) | Migrate fixtures to use `makeContentDefinition` / `makeContentRef`. 17 typecheck errors → 0. |
| [`tests/spells/helpers.test.ts`](../../../tests/spells/helpers.test.ts) | Same. 4 errors → 0. |

## Architecture

### Helper contract

```ts
// lib/supabase/content-definitions.ts (NEW)

import type { Effect } from "@/lib/types/effects";

/**
 * Result of parsing a single content_definitions row. The outer envelope
 * (id, slug, name, content_type, effects, version, source) has been validated
 * by contentDefinitionSchema; the inner `data` has been validated by the
 * content-type-specific schema looked up via getContentTypeSchema(content_type).
 *
 * Generic over TData so callers that asked for a specific content_type (e.g.
 * "class") can cast the inner data to the corresponding type (ClassData) —
 * the cast is safe because parsing has already succeeded.
 */
export interface ParsedContentDefinition<TData = unknown> {
  id: string;
  name: string;
  slug: string;
  content_type: string;
  version: number;
  source: "srd" | "homebrew";
  data: TData;
  effects: Effect[];
}

/**
 * Server-side: fetch all content_definitions of one content_type for one
 * system, parse each row, drop bad rows. Returns the parsed array.
 *
 * Errors logged to console.error with the slug + issues. Caller never sees
 * the failures — just gets a smaller array.
 */
export async function getContentByType(
  systemId: string,
  contentType: string,
): Promise<ParsedContentDefinition[]>;

/**
 * Parse a single raw row (e.g. from a JOIN result like content_refs). Returns
 * null on any parse failure — caller filters nulls out of the array.
 */
export function parseContentDefinition(
  raw: unknown,
): ParsedContentDefinition | null;
```

### Two-stage parse

```
DB row → contentDefinitionSchema.safeParse(raw)   // envelope: id, slug, name, content_type, effects, version, source
         │
         ├─ fail   → console.error("[content-definitions] Bad envelope:", issues) → return null (drop)
         │
         └─ ok    → const schema = getContentTypeSchema(parsed.content_type)
                    │
                    ├─ undefined  → console.error("[content-definitions] Unknown content_type:", parsed.content_type) → return null
                    │
                    └─ found    → schema.safeParse(parsed.data)
                                  │
                                  ├─ fail  → console.error("[content-definitions] Bad data for <slug> (<content_type>):", issues) → return null
                                  │
                                  └─ ok   → return ParsedContentDefinition
```

### Call-site pattern

**Before (current):**

```tsx
// app/(app)/characters/[id]/builder/class/page.tsx
const { data: classContent } = await supabase
  .from("content_definitions")
  .select("id, name, slug, content_type, data, effects, version, source")
  .eq("system_id", systemId)
  .eq("content_type", "class")
  .order("name");

// downstream consumer
const hitDie = (classContent[0].data as Record<string, unknown>).hit_die as number;
```

**After:**

```tsx
// app/(app)/characters/[id]/builder/class/page.tsx
import { getContentByType } from "@/lib/supabase/content-definitions";
import type { ClassData } from "@/lib/schemas/content-types/class";

const classes = await getContentByType(systemId, "class");

// downstream consumer
const hitDie = (classes[0].data as ClassData).hit_die;
```

The single `as ClassData` cast at the consumer is the only loose link, and it's safe — parsing already verified the shape conforms to `ClassData`. Future improvement: introduce a `ContentByType<T>` overload signature that types the return based on the literal `contentType` argument; deferred until call-site usage settles.

### Why a new file instead of extending `content-refs.ts`

[`lib/supabase/content-refs.ts`](../../../lib/supabase/content-refs.ts) is the post-PR #56 server-side CRUD helpers file for `character_content_refs`. Mixing parsed-read accessors for `content_definitions` into it would smear two responsibilities (one per table). Same split-by-responsibility argument PR #56 made for the browser helpers, just applied to read-side parsing. The file is cheap to add and trivial to find.

## Tests

### New: `tests/lib/supabase/content-definitions.test.ts`

```ts
describe("getContentByType", () => {
  it("returns parsed rows when all envelope + data shapes are valid", async () => { ... });
  it("drops a row whose envelope fails validation (logs)", async () => { ... });
  it("drops a row whose content_type has no registered schema (logs)", async () => { ... });
  it("drops a row whose data fails the content-type schema (logs)", async () => { ... });
});

describe("parseContentDefinition", () => {
  it("returns ParsedContentDefinition for a valid row", () => { ... });
  it("returns null on any of the 3 parse failures", () => { ... });
});
```

~6 tests. The schemas themselves are already covered by [`tests/schemas/content-types.test.ts`](../../../tests/schemas/content-types.test.ts) (296 LOC).

### New: `tests/fixtures/content.ts`

A pair of factory functions, no tests of their own (covered indirectly by every test that uses them):

```ts
import type { Effect } from "@/lib/types/effects";

export interface ContentDefinitionFixture {
  id: string;
  name: string;
  slug: string;
  content_type: string;
  version: number;
  source: "srd" | "homebrew";
  data: Record<string, unknown>;
  effects: Effect[];
}

export function makeContentDefinition(
  overrides: Partial<ContentDefinitionFixture> = {},
): ContentDefinitionFixture {
  return {
    id: "fixture-content-id",
    name: "Fixture Content",
    slug: "fixture-content",
    content_type: "feature",
    version: 1,
    source: "srd",
    data: {},
    effects: [],
    ...overrides,
  };
}

export function makeContentRef(
  overrides: Partial<{
    id: string;
    character_id: string;
    content_id: string;
    content_version: number;
    context: Record<string, unknown>;
    choice_source: string | null;
    content_definitions: ContentDefinitionFixture;
  }> = {},
) {
  return {
    id: "fixture-ref-id",
    character_id: "fixture-character-id",
    content_id: "fixture-content-id",
    content_version: 1,
    context: {},
    choice_source: null,
    content_definitions: makeContentDefinition(),
    ...overrides,
  };
}
```

### Fixture sweep

`tests/resources/helpers.test.ts` and `tests/spells/helpers.test.ts` switch from inline-literal fixtures to factory calls. The 21 typecheck errors go to 0. Test counts stay the same (~579 baseline + 12 from PR #56 + ~6 new = ~597 file count varies; final number set during plan-writing).

### Browser smoke (manual, during PR review)

Test account: `test@inkborne.app` / `testpassword123`.

- **Voltee (Wizard 3):** open the builder, walk race/class/abilities/background/equipment. Every content list (races, classes, subclasses, backgrounds, features) should look identical to today. No "missing" entries means parsing is succeeding for every existing row.
- **Xero (Barbarian 10 / Fighter 5):** open the sheet. Class features, racial traits, spells, inventory items render identically.
- **Forced-failure smoke:** in the Supabase dashboard, temporarily edit ONE content_definitions row to remove a required field (e.g., delete `hit_die` from a class, or `level` from a feature). Reload the relevant builder page. Confirm:
  - The bad row disappears from the picker (no UI crash).
  - `console.error` logs `[content-definitions] Bad data for <slug> (<content_type>):` with the Zod issue array.
  - Other rows still render normally.
  - Restore the row after verification.

## Implementation order (informs plan-writing)

1. **Module + schema sweep first.** Write `lib/supabase/content-definitions.ts` (helper + `parseContentDefinition`); add `parseContentByType` convenience to `lib/schemas/content-types/index.ts`; write the unit tests.
2. **Fixture factory + test sweep.** Add `tests/fixtures/content.ts`; migrate `tests/resources/helpers.test.ts` and `tests/spells/helpers.test.ts` to use it; confirm `npx tsc --noEmit` drops by 21 errors.
3. **Migrate the 5 server pages.** One commit per page, biggest first: class (most queries) → race → background → equipment → character-page (sheet). Each replaces inline `.from("content_definitions").select(...)` with `getContentByType`.
4. **Update `content-refs.ts`.** Tighten the `ContentRefWithContent.content_definitions.data` type and apply per-row parsing in `getContentRefsByCharacter` (and any other JOIN paths).
5. **Migrate the 3 lib helpers.** `lib/supabase/spells.ts`, `lib/supabase/inventory.ts`, `lib/resources/helpers.ts` — switch from `Record<string, unknown>` reads to typed access.
6. **Migrate the ~17 component consumers.** One commit per file (or per directory if a cluster). Each removes the `as Record<string, unknown>` casts.
7. **Final regression + browser smoke + open PR.**

## Rollout

- **Branch:** `refactor/content-schema-validation` → `main`. Stand-alone, not stacked.
- **Squash-merge** per convention.
- **No DB migration, no feature flag.** Pure code change.
- **Verification gate:**
  - All 615 existing tests (post-PR #56) still pass.
  - ~6 new tests pass.
  - `npx tsc --noEmit` — the 21 errors in `tests/resources/helpers.test.ts` + `tests/spells/helpers.test.ts` go to 0. Other pre-existing errors (e.g., `tests/components/sheet/inventory-tab.test.tsx` `CharacterContextValue` import drift) are out of scope unless trivially closed in-passing.
  - `npm run build` clean.
  - Browser smoke per "Browser smoke" above (Voltee + Xero + forced-failure on one row).

## Open questions for engineering (none blocking)

All 8 scope questions closed during brainstorm. One implementation-time question worth flagging:

- **Do any current `content_definitions` rows actually fail the existing Zod schemas?** The schemas were authored from the SRD/MPMB import shapes, but drift could exist (e.g., a manually-edited row, or a schema field added after rows were imported). The forced-failure browser smoke is the test for this — if any production rows surface as failures during smoke, decide whether to patch the row, loosen the schema, or surface as a separate brainstorm. Don't quietly improvise.

If the answer is "yes, multiple rows fail," it would imply the schemas are not in sync with the DB and need a small audit pass before this refactor lands. Plan-writing should call out this verification step explicitly.

---

## Appendix · Audit cross-reference

This refactor directly addresses item #2 of the architecture audit ([`docs/architecture/00-overview.md`](../../architecture/00-overview.md) — "Top three refactor candidates"):

> **2. `Record<string, unknown>` is the de-facto contract for `content_definitions.data`.** 30+ casts of `(x.data as Record<string, unknown>).field as T` across builder rail, preview modal, and lib helpers, despite 18 typed Zod schemas living in `lib/schemas/content-types/`. Root cause of the pre-existing test typecheck errors in `tests/resources/helpers.test.ts` (17 errors) and `tests/spells/helpers.test.ts` (4). Running the schemas at the I/O boundary cleans both up.

Closing item #2 leaves item #3 (broader coverage gaps — `content-preview.tsx`, `narrative-actions.ts`, `admin/*` clients, the `narrative/` subtree) as the remaining audit item. Item #1 shipped in PR #56.
