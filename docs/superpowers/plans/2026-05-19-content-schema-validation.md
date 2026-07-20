# Content schema validation — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [`docs/superpowers/specs/2026-05-19-content-schema-validation-design.md`](../specs/2026-05-19-content-schema-validation-design.md). The spec is the source of truth; this plan is its execution form.

**Goal:** Run the 15 existing Zod schemas in `lib/schemas/content-types/` at the server fetch boundary so the 30+ `(data as Record<string, unknown>).field as T` reads across the codebase become typed property access. Centralise parsing in a new module so every `content_definitions` read goes through the same envelope-then-data validation with consistent log-and-skip behaviour.

**Architecture:** New server-side module `lib/supabase/content-definitions.ts` exposes `getContentByType(systemId, contentType)` returning `ParsedContentDefinition[]`. Two-stage `safeParse`: `contentDefinitionSchema` for the envelope, then `getContentTypeSchema(content_type).safeParse(data)` for the typed inner data. On any failure the row is logged + omitted. Client never has to parse — server hands typed data over.

**Tech Stack:** Next.js 16 (App Router), TypeScript, `zod@^3`, `@supabase/supabase-js`, Vitest + Testing Library.

**Branch:** `refactor/content-schema-validation` (off `dd30052`, which is the spec commit on top of `31a4996` from PR #56). Once PR #57 (spec) merges, this branch rebases onto main. Squash-merge to main.

---

## Audit decisions baked into the plan

- **Component-consumer migration is larger than the spec's "~17 files" estimate.** Live grep produced 20+ consumer files. Plan splits Task 11 into three sub-tasks (11a class-step-rail + class-preview-modal cluster, 11b sheet cluster, 11c remaining consumers) so each commit stays reviewable.

- **`tests/spells/helpers.test.ts` errors are a different root cause.** The 4 TS2554 errors are about a missing default on the `makeCasterClass` test helper (`overrides` is required but tests call it with no args). That's unrelated to the content_definitions.data shape but is a 1-line fix; fold it into Task 2 opportunistically so the "21 → 0" claim holds.

- **`lib/builder/class-features-per-level.ts` is also a consumer.** Surfaced by the call-site walk. Folded into Task 10.

- **The 3 step-clients (race / equipment / abilities) ALSO read `data` shapes** in addition to the writes PR #56 migrated. Folded into Task 11c.

## File structure

### New source files

| File | Responsibility |
|---|---|
| `lib/supabase/content-definitions.ts` | Server-side typed accessors. `getContentByType(systemId, contentType)`, `parseContentDefinition(raw)`. Returns `ParsedContentDefinition[]`. |
| `tests/fixtures/content.ts` | `makeContentDefinition(overrides)`, `makeContentRef(overrides)` factory functions for tests. Fills required fields with sane defaults. |
| `tests/lib/supabase/content-definitions.test.ts` | Unit tests for the new accessors. |
| `scripts/validate-content.ts` | One-shot dev script (not added to `package.json`) that walks every `content_definitions` row in the dev DB through `parseContentDefinition` and reports failures. Used during Task 3's drift audit; can be re-run later if drift is suspected. |

### Modified source files

| File | Changes |
|---|---|
| `lib/schemas/content-types/index.ts` | Add `parseContentByType(contentType, data)` convenience returning `{ ok: true; data } \| { ok: false; error }`. |
| `lib/supabase/content-refs.ts` | Update `ContentRefWithContent.content_definitions.data` from `Record<string, unknown>` to `unknown` (the parsed payload). `getContentRefsByCharacter` parses each nested row, dropping bad ones with the same log+skip rule. |
| `app/(app)/characters/[id]/builder/class/page.tsx` | Replace 4 inline `.from("content_definitions").select(...)` calls with `getContentByType` calls. |
| `app/(app)/characters/[id]/builder/race/page.tsx` | Replace 3 inline calls (race, subrace, trait). |
| `app/(app)/characters/[id]/builder/background/page.tsx` | Replace 2 inline calls (background + language slugs query stays as a slug-only fetch — see Task 6). |
| `app/(app)/characters/[id]/builder/equipment/page.tsx` | Replace 1 inline call (class lookup by slug — see Task 7 for shape adaptation). |
| `app/(app)/characters/[id]/page.tsx` | Replace 4 inline calls (class/subclass content for spellcasting; feature rows; spellcastingExtra parsing). |
| `lib/supabase/spells.ts` | `searchSpells` return type tightens from `Record<string, unknown>` to typed `data`. JOIN selects in `getSpellsForCharacter` get parsed `content_definitions.data`. |
| `lib/supabase/inventory.ts` | Same shape as spells. |
| `lib/resources/helpers.ts` | Switch `def.data as Record<string, unknown> \| undefined` to typed access via `ParsedContentDefinition["data"]`. |
| `lib/builder/class-features-per-level.ts` | Cast adjustments to use typed `ClassData` / `FeatureData`. |
| `components/builder/class-step-rail/index.tsx` | ~3 cast removals. |
| `components/builder/class-step-rail/level-up-pane.tsx` | ~2 cast removals. |
| `components/builder/class-step-rail/feature-card.tsx` | ~1 cast removal. |
| `components/builder/class-step-rail/class-picker-card.tsx` | ~2 cast removals. |
| `components/builder/class-step-rail/choice-card-subclass.tsx` | ~2 cast removals. |
| `components/builder/class-step-rail/choice-card-fighting-style.tsx` | ~1 cast removal. |
| `components/builder/class-preview-modal.tsx` | Cast removals. |
| `components/builder/class-preview-modal/overview-tab.tsx` | Cast removals. |
| `components/builder/class-preview-modal/features-tab.tsx` | Cast removals. |
| `components/builder/class-preview-modal/spells-tab.tsx` | Cast removals. |
| `components/builder/class-preview-modal/subclasses-tab.tsx` | Cast removals. |
| `components/builder/content-preview.tsx` | Cast removals (one of the largest untested files — defer test coverage to audit candidate #3 follow-up). |
| `components/sheet/tabs/spells-tab.tsx`, `features-tab.tsx`, `actions-tab.tsx` | Cast removals. |
| `components/sheet/spells/spell-header.tsx`, `add-spell-panel.tsx` | Cast removals. |
| `components/sheet/inventory/add-item-panel.tsx` | Cast removals. |
| `app/(app)/characters/[id]/builder/race/race-step-client.tsx` | Cast removals on the read-side (writes already routed through PR #56 helpers). |
| `app/(app)/characters/[id]/builder/equipment/equipment-step-client.tsx` | Cast removals. |
| `app/(app)/characters/[id]/builder/abilities/abilities-step-client.tsx` | Cast removals. |

### Modified test files

| File | Changes |
|---|---|
| `tests/resources/helpers.test.ts` | Migrate `makeRef` to use `makeContentRef` from `tests/fixtures/content.ts`. 17 typecheck errors → 0. |
| `tests/spells/helpers.test.ts` | 1-line fix on `makeCasterClass` parameter default. 4 typecheck errors → 0. |
| `tests/lib/supabase/content-refs.test.ts` | Adjust existing fixture shape to satisfy the tightened `ContentRefWithContent` type. |

---

## Task 1: `content-definitions.ts` helper module + tests

**Files:**
- Create: `lib/supabase/content-definitions.ts`
- Modify: `lib/schemas/content-types/index.ts` (add `parseContentByType` convenience)
- Create: `tests/lib/supabase/content-definitions.test.ts`

- [ ] **Step 1.1: Write the failing test for `parseContentDefinition` (happy path)**

Create `tests/lib/supabase/content-definitions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Browser-mock harness mirroring tests/lib/supabase/content-refs-client.test.ts.
const mockOrder = vi.fn();
const mockEq2 = vi.fn(() => ({ order: mockOrder }));
const mockEq1 = vi.fn(() => ({ eq: mockEq2 }));
const mockSelect = vi.fn(() => ({ eq: mockEq1 }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ from: mockFrom }),
}));

import {
  getContentByType,
  parseContentDefinition,
} from "@/lib/supabase/content-definitions";

const validClassRow = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Wizard",
  slug: "wizard",
  content_type: "class",
  version: 1,
  source: "srd",
  system_id: "22222222-2222-2222-2222-222222222222",
  scope: "platform",
  owner_id: null,
  effects: [],
  data: {
    hit_die: 6,
    spellcasting: null,
    multiclass: { prerequisites: [], proficiencies_gained: [] },
    saving_throws: ["intelligence", "wisdom"],
    starting_proficiencies: [],
    levels: [
      {
        level: 1,
        features: [],
        spellcasting: null,
      },
    ],
    source_refs: { phb: "p.112" },
  },
};

describe("parseContentDefinition", () => {
  beforeEach(() => {
    mockOrder.mockReset();
    mockSelect.mockClear();
    mockFrom.mockClear();
  });

  it("returns ParsedContentDefinition for a valid row", () => {
    const result = parseContentDefinition(validClassRow);
    expect(result).not.toBeNull();
    expect(result?.content_type).toBe("class");
    expect(result?.slug).toBe("wizard");
    expect((result?.data as { hit_die: number }).hit_die).toBe(6);
  });
});
```

- [ ] **Step 1.2: Run the test to verify it fails**

```bash
npx vitest run tests/lib/supabase/content-definitions.test.ts --reporter=verbose
```

Expected: FAIL with import error (`parseContentDefinition` / `getContentByType` not exported).

- [ ] **Step 1.3: Add the `parseContentByType` convenience to `lib/schemas/content-types/index.ts`**

Edit `lib/schemas/content-types/index.ts` to add a new export at the bottom:

```ts
import type { z } from "zod";
import { raceDataSchema } from "./race";
import { subraceDataSchema } from "./subrace";
import { traitDataSchema } from "./trait";
import { languageDataSchema } from "./language";
import { proficiencyDataSchema } from "./proficiency";
import { featureDataSchema } from "./feature";
import { classDataSchema } from "./class";
import { subclassDataSchema } from "./subclass";
import { backgroundDataSchema } from "./background";
import { featDataSchema } from "./feat";
import { spellDataSchema } from "./spell";
import { weaponDataSchema } from "./weapon";
import { armorDataSchema } from "./armor";
import { itemDataSchema } from "./item";
import { magicItemDataSchema } from "./magic-item";

const CONTENT_TYPE_SCHEMAS: Record<string, z.ZodType> = {
  race: raceDataSchema,
  subrace: subraceDataSchema,
  trait: traitDataSchema,
  language: languageDataSchema,
  proficiency: proficiencyDataSchema,
  feature: featureDataSchema,
  class: classDataSchema,
  subclass: subclassDataSchema,
  background: backgroundDataSchema,
  feat: featDataSchema,
  spell: spellDataSchema,
  weapon: weaponDataSchema,
  armor: armorDataSchema,
  item: itemDataSchema,
  magic_item: magicItemDataSchema,
};

export function getContentTypeSchema(contentType: string): z.ZodType | undefined {
  return CONTENT_TYPE_SCHEMAS[contentType];
}

export function registerContentTypeSchema(contentType: string, schema: z.ZodType): void {
  CONTENT_TYPE_SCHEMAS[contentType] = schema;
}

/**
 * Convenience: run the registered schema for `contentType` against `data`.
 * Returns a discriminated `{ ok, ... }` shape so callers don't have to wrap
 * `safeParse` themselves. Returns `{ ok: false, error: "unknown_content_type" }`
 * when no schema is registered for the given content_type.
 */
export type ParseContentResult =
  | { ok: true; data: unknown }
  | { ok: false; error: "unknown_content_type" | string; issues?: z.ZodIssue[] };

export function parseContentByType(
  contentType: string,
  data: unknown,
): ParseContentResult {
  const schema = CONTENT_TYPE_SCHEMAS[contentType];
  if (!schema) {
    return { ok: false, error: "unknown_content_type" };
  }
  const result = schema.safeParse(data);
  if (!result.success) {
    return { ok: false, error: "schema_violation", issues: result.error.issues };
  }
  return { ok: true, data: result.data };
}
```

- [ ] **Step 1.4: Write the `content-definitions.ts` module**

Create `lib/supabase/content-definitions.ts`:

```ts
import { createClient } from "@/lib/supabase/server";
import { contentDefinitionSchema } from "@/lib/schemas/content";
import { parseContentByType } from "@/lib/schemas/content-types";
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
 * Parse a single raw row (e.g. from a JOIN result like content_refs). Returns
 * null on any of three failure modes:
 *  - the envelope (contentDefinitionSchema) rejects the row;
 *  - the row's content_type has no registered schema;
 *  - the inner data fails the content-type schema.
 *
 * Each failure logs to console.error with the slug + issues so the source row
 * is identifiable when debugging.
 */
export function parseContentDefinition(
  raw: unknown,
): ParsedContentDefinition | null {
  // Stage 1: envelope.
  const envelope = contentDefinitionSchema.safeParse(raw);
  if (!envelope.success) {
    const maybeSlug = (raw as { slug?: unknown })?.slug;
    console.error(
      `[content-definitions] Bad envelope for ${typeof maybeSlug === "string" ? maybeSlug : "<unknown>"}:`,
      envelope.error.issues,
    );
    return null;
  }

  // Stage 2: inner data via the content-type schema.
  const inner = parseContentByType(envelope.data.content_type, envelope.data.data);
  if (!inner.ok) {
    if (inner.error === "unknown_content_type") {
      console.error(
        `[content-definitions] Unknown content_type for ${envelope.data.slug}:`,
        envelope.data.content_type,
      );
    } else {
      console.error(
        `[content-definitions] Bad data for ${envelope.data.slug} (${envelope.data.content_type}):`,
        inner.issues,
      );
    }
    return null;
  }

  // The outer envelope adds id + version which were stripped by contentDefinitionSchema's
  // shape but live on the supabase row alongside it. Reconstruct the public type.
  return {
    id: (raw as { id: string }).id,
    name: envelope.data.name,
    slug: envelope.data.slug,
    content_type: envelope.data.content_type,
    version: envelope.data.version,
    source: envelope.data.source,
    data: inner.data,
    effects: envelope.data.effects,
  };
}

/**
 * Server-side: fetch all content_definitions of one content_type for one
 * system, parse each row, drop bad rows. Returns the parsed array.
 */
export async function getContentByType(
  systemId: string,
  contentType: string,
): Promise<ParsedContentDefinition[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_definitions")
    .select(
      "id, name, slug, content_type, data, effects, version, source, system_id, scope, owner_id",
    )
    .eq("system_id", systemId)
    .eq("content_type", contentType)
    .order("name");

  if (error) {
    console.error(
      `[content-definitions] Supabase error fetching ${contentType}:`,
      error.message,
    );
    return [];
  }

  const parsed: ParsedContentDefinition[] = [];
  for (const row of data ?? []) {
    const result = parseContentDefinition(row);
    if (result !== null) parsed.push(result);
  }
  return parsed;
}
```

Note the import `contentDefinitionSchema` from `@/lib/schemas/content` — that schema's `.id` is NOT in its `z.object({...})` shape today (it omits `id`), so we read it directly from `raw` at the end. The `id` column on the DB always exists for fetched rows; we trust it without re-validation. The same goes for `version` which IS in the schema and gets a default, so we use `envelope.data.version` rather than raw.

- [ ] **Step 1.5: Run the happy-path test to verify it passes**

```bash
npx vitest run tests/lib/supabase/content-definitions.test.ts -t "valid row" --reporter=verbose
```

Expected: PASS.

- [ ] **Step 1.6: Add the failure-mode tests for `parseContentDefinition`**

Append to `tests/lib/supabase/content-definitions.test.ts` (inside the same `describe("parseContentDefinition", …)` block, after the happy-path `it`):

```ts
  it("returns null when the envelope is invalid (logs)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = parseContentDefinition({
      slug: "bad-row",
      // missing name, content_type, etc.
    });
    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Bad envelope"),
      expect.anything(),
    );
    errorSpy.mockRestore();
  });

  it("returns null when content_type has no registered schema (logs)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = parseContentDefinition({
      ...validClassRow,
      content_type: "imaginary-type",
    });
    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unknown content_type"),
      "imaginary-type",
    );
    errorSpy.mockRestore();
  });

  it("returns null when inner data fails the content-type schema (logs)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = parseContentDefinition({
      ...validClassRow,
      data: { hit_die: "not a number" }, // hit_die must be positive int
    });
    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Bad data for wizard (class)"),
      expect.anything(),
    );
    errorSpy.mockRestore();
  });
```

- [ ] **Step 1.7: Add the `getContentByType` tests**

Append to `tests/lib/supabase/content-definitions.test.ts`:

```ts
describe("getContentByType", () => {
  beforeEach(() => {
    mockOrder.mockReset();
    mockEq2.mockClear();
    mockEq1.mockClear();
    mockSelect.mockClear();
    mockFrom.mockClear();
  });

  it("returns parsed rows when all envelope + data shapes are valid", async () => {
    mockOrder.mockResolvedValue({ data: [validClassRow], error: null });
    const result = await getContentByType("system-1", "class");
    expect(mockFrom).toHaveBeenCalledWith("content_definitions");
    expect(mockEq1).toHaveBeenCalledWith("system_id", "system-1");
    expect(mockEq2).toHaveBeenCalledWith("content_type", "class");
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("wizard");
  });

  it("drops bad rows and keeps good ones in the same fetch", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockOrder.mockResolvedValue({
      data: [validClassRow, { ...validClassRow, slug: "broken", data: { hit_die: "x" } }],
      error: null,
    });
    const result = await getContentByType("system-1", "class");
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("wizard");
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("returns empty array and logs on supabase error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockOrder.mockResolvedValue({ data: null, error: { message: "RLS denied" } });
    const result = await getContentByType("system-1", "class");
    expect(result).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Supabase error fetching class"),
      "RLS denied",
    );
    errorSpy.mockRestore();
  });
});
```

- [ ] **Step 1.8: Run the full test file**

```bash
npx vitest run tests/lib/supabase/content-definitions.test.ts --reporter=verbose
```

Expected: 6 tests pass (3 `parseContentDefinition` + 3 `getContentByType`).

- [ ] **Step 1.9: Run the full suite to confirm no regression**

```bash
npx vitest run --reporter=dot
```

Expected: 615 (baseline) + 6 (new) = **621 tests pass**.

- [ ] **Step 1.10: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no NEW errors. Pre-existing 30 errors (resources/helpers 17, spells/helpers 4, evaluator-conditions 6, sheet inventory-tab/rest-dialog/spells-tab 3) remain.

- [ ] **Step 1.11: Commit**

```bash
git add lib/supabase/content-definitions.ts lib/schemas/content-types/index.ts tests/lib/supabase/content-definitions.test.ts
git commit -m "feat(supabase): add content-definitions parsed read helpers

Introduces lib/supabase/content-definitions.ts with getContentByType
and parseContentDefinition — server-side accessors that run the
existing Zod schemas in lib/schemas/content-types/ at the I/O
boundary. Two-stage parse (envelope then content-type data); bad
rows log and drop rather than throw, so a single malformed row
won't break the whole page.

Adds parseContentByType convenience to lib/schemas/content-types/
index.ts so callers can validate inner data without re-implementing
the safeParse wrapper.

Substrate for the content-schema-validation refactor."
```

---

## Task 2: Test fixture factory + sweep

**Files:**
- Create: `tests/fixtures/content.ts`
- Modify: `tests/resources/helpers.test.ts` (use factory; 17 errors → 0)
- Modify: `tests/spells/helpers.test.ts` (1-line `makeCasterClass` default fix; 4 errors → 0)

- [ ] **Step 2.1: Record the current typecheck error count**

```bash
npx tsc --noEmit 2>&1 | grep -E "^tests/(resources|spells)/" | wc -l
```

Expected: **21**. Record this as the baseline.

- [ ] **Step 2.2: Create the fixture factory file**

Create `tests/fixtures/content.ts`:

```ts
import type { Effect } from "@/lib/types/effects";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";

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

/**
 * Build a fixture for a content_definitions row. Every required field has a
 * sane default; pass `overrides` to set only what the test cares about.
 */
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

/**
 * Build a fixture for a character_content_refs row joined with its
 * content_definitions row. Shape matches what supabase returns from a
 * `select("*, content_definitions(...)")` query.
 */
export function makeContentRef(
  overrides: Partial<ContentRefWithContent> & {
    content_definitions?: Partial<ContentDefinitionFixture>;
  } = {},
): ContentRefWithContent {
  const { content_definitions: cdOverrides, ...rest } = overrides;
  return {
    id: "fixture-ref-id",
    character_id: "fixture-character-id",
    content_id: "fixture-content-id",
    content_version: 1,
    context: {},
    choice_source: null,
    created_at: "2026-05-19T00:00:00Z",
    content_definitions: makeContentDefinition(cdOverrides),
    ...rest,
  } as ContentRefWithContent;
}
```

- [ ] **Step 2.3: Migrate `tests/resources/helpers.test.ts` to use the factory**

Open `tests/resources/helpers.test.ts`. Find the local `makeRef` helper around line 55. Replace the entire function body so it calls `makeContentRef` instead of building the literal inline:

Before:
```ts
function makeRef(
  slug: string,
  data: Record<string, unknown>,
  contentType: "feature" | "feat" | "trait" = "feature",
) {
  return {
    id: `id-${slug}`,
    content_id: `content-${slug}`,
    character_id: "char-1",
    content_version: 1,
    context: {},
    choice_source: null,
    created_at: "2026-04-23",
    content_definitions: {
      id: `content-${slug}`,
      slug,
      name: slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      content_type: contentType,
      data,
      version: 1,
    },
  };
}
```

After:
```ts
import { makeContentRef } from "@/tests/fixtures/content";

function makeRef(
  slug: string,
  data: Record<string, unknown>,
  contentType: "feature" | "feat" | "trait" = "feature",
) {
  return makeContentRef({
    id: `id-${slug}`,
    content_id: `content-${slug}`,
    character_id: "char-1",
    created_at: "2026-04-23",
    content_definitions: {
      id: `content-${slug}`,
      slug,
      name: slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      content_type: contentType,
      data,
    },
  });
}
```

Add the `import { makeContentRef } from "@/tests/fixtures/content";` line at the top of the file alongside the other imports.

Verify `vitest.config.ts` has `@/` alias pointing at the repo root so `@/tests/fixtures/content` resolves. (It does — `globals: true`, `@/` → repo root.)

- [ ] **Step 2.4: Confirm `tests/resources/helpers.test.ts` typechecks clean**

```bash
npx tsc --noEmit 2>&1 | grep "tests/resources/helpers.test.ts" | wc -l
```

Expected: **0**. (Was 17.)

- [ ] **Step 2.5: Fix the `tests/spells/helpers.test.ts` `makeCasterClass` default**

Open `tests/spells/helpers.test.ts`. The current helper at line 11:

```ts
function makeCasterClass(overrides: Partial<CasterClass>): CasterClass {
  ...
}
```

Change the parameter signature to make `overrides` optional with an empty default:

```ts
function makeCasterClass(overrides: Partial<CasterClass> = {}): CasterClass {
  ...
}
```

That's it — the 4 `makeCasterClass()` call sites without args will now type-check.

- [ ] **Step 2.6: Confirm `tests/spells/helpers.test.ts` typechecks clean**

```bash
npx tsc --noEmit 2>&1 | grep "tests/spells/helpers.test.ts" | wc -l
```

Expected: **0**. (Was 4.)

- [ ] **Step 2.7: Confirm overall tsc dropped 21 errors**

```bash
npx tsc --noEmit 2>&1 | grep -E "^tests/(resources|spells)/" | wc -l
```

Expected: **0**. (Was 21 in Step 2.1.)

- [ ] **Step 2.8: Run the migrated test files to confirm runtime behavior is unchanged**

```bash
npx vitest run tests/resources/helpers.test.ts tests/spells/helpers.test.ts --reporter=verbose
```

Expected: all tests in both files pass. Numbers unchanged from baseline.

- [ ] **Step 2.9: Run the full suite to confirm no regression**

```bash
npx vitest run --reporter=dot
```

Expected: 621 tests pass (same as Task 1's end state — Task 2 doesn't add tests, just realigns fixtures).

- [ ] **Step 2.10: Commit**

```bash
git add tests/fixtures/content.ts tests/resources/helpers.test.ts tests/spells/helpers.test.ts
git commit -m "test: introduce tests/fixtures/content.ts + close 21 pre-existing tsc errors

Adds makeContentDefinition + makeContentRef factories for use across
test files that need content_definitions / character_content_refs
fixtures. Default values cover every required field so fixture
construction is one line.

Migrates tests/resources/helpers.test.ts to use the factory — closes
17 tsc errors (missing effects: [] on content_definitions inner shape).

Fixes tests/spells/helpers.test.ts's makeCasterClass to accept an
empty default for the overrides parameter — closes 4 tsc errors
(call sites passed no arguments). Unrelated root cause to the
fixture sweep but folded in to land 21 -> 0 in one PR."
```

---

## Task 3: Schema-drift audit (gate before migration)

**Files:**
- Create: `scripts/validate-content.ts`

**Purpose:** Before the migration touches the 20+ consumer files, validate that every existing `content_definitions` row in the dev DB parses cleanly. If anything fails, STOP and brainstorm — don't quietly patch rows or loosen schemas to make migration work. Drift is a signal worth investigating.

- [ ] **Step 3.1: Write the validation script**

Create `scripts/validate-content.ts`:

```ts
/**
 * One-shot dev script: walk every content_definitions row in the dev DB,
 * run it through parseContentDefinition, and report failures.
 *
 * Run with:
 *   npx tsx scripts/validate-content.ts
 *
 * Environment:
 *   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set
 *   (the script uses the service role to bypass RLS, since this is a dev
 *   tool and we want the full picture).
 *
 * Exit codes:
 *   0 — every row parsed clean
 *   1 — at least one row failed; details printed to stderr
 */
import { createClient } from "@supabase/supabase-js";
import { parseContentDefinition } from "@/lib/supabase/content-definitions";

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(2);
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("content_definitions")
    .select(
      "id, name, slug, content_type, data, effects, version, source, system_id, scope, owner_id",
    );

  if (error) {
    console.error("Supabase error:", error.message);
    process.exit(2);
  }

  const rows = data ?? [];
  let failures = 0;
  for (const row of rows) {
    const result = parseContentDefinition(row);
    if (result === null) {
      failures += 1;
    }
  }

  console.log(`\nChecked ${rows.length} rows — ${failures} failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("validate-content crashed:", err);
  process.exit(2);
});
```

Note: `parseContentDefinition` already does the structured `console.error` per failed row, so the script just needs to count and exit. The failure details surface via the helper's existing logging.

- [ ] **Step 3.2: Verify the script imports compile**

```bash
npx tsc --noEmit scripts/validate-content.ts 2>&1 | tail -5
```

Expected: no errors specific to `scripts/validate-content.ts` (pre-existing errors elsewhere stay).

If `tsx` isn't installed at the dev tooling layer, add it as a one-step:

```bash
npm install --save-dev tsx
```

(Likely already present — Inkborne uses it for other scripts. Skip if `npx tsx --version` already works.)

- [ ] **Step 3.3: Run the script against the dev DB**

Ensure `.env.local` is loaded (Inkborne uses Vercel-style env loading — `tsx` won't auto-load, so prepend the env or `dotenv -e .env.local --`):

```bash
npx tsx -r dotenv/config scripts/validate-content.ts dotenv_config_path=.env.local
```

Or, if you prefer to inline the env:

```bash
NEXT_PUBLIC_SUPABASE_URL=<...> SUPABASE_SERVICE_ROLE_KEY=<...> npx tsx scripts/validate-content.ts
```

The service role key is in `.env.local`. Do NOT commit it.

Expected outcomes:

**Case A — clean (zero failures):** the script prints `Checked N rows — 0 failed.` and exits 0. Proceed to Task 4.

**Case B — at least one row failed:** the script prints structured `[content-definitions]` errors per row + the count. **STOP.** Do NOT proceed. Open a brainstorm question to Victor that captures: how many rows fail, which content_types, which schema fields, sample of failing rows. The right next step is one of:
- The schema is wrong and needs adjustment → revise the schema in a separate PR before continuing.
- The DB row is bad → patch the row(s) via a small SQL migration or in Supabase Studio.
- The shape was always wrong and the production app has been silently relying on the `Record<string, unknown>` cast → escalate to design discussion.

DO NOT quietly improvise the resolution. The spec explicitly calls this out at "Open questions for engineering."

- [ ] **Step 3.4: Commit the validation script** (assuming Step 3.3 returned clean)

```bash
git add scripts/validate-content.ts
git commit -m "tools: add scripts/validate-content.ts schema-drift audit

One-shot dev script that walks every content_definitions row through
parseContentDefinition and reports failures. Run before migrations
to ensure the schemas are in sync with the DB; re-runnable later
if drift is suspected.

Not added to package.json; this is dev tooling, invoked manually
via npx tsx scripts/validate-content.ts."
```

If Step 3.3 returned non-clean, do NOT commit and do NOT proceed past this task.

---

## Task 4: Migrate `class/page.tsx` (biggest server page — 4 inline queries)

**File:** `app/(app)/characters/[id]/builder/class/page.tsx`

- [ ] **Step 4.1: Update imports**

Add at the top of `app/(app)/characters/[id]/builder/class/page.tsx`:

```tsx
import { getContentByType } from "@/lib/supabase/content-definitions";
```

(The existing `createClient`, `redirect`, `notFound` imports stay — we still need the supabase client for the character + content_refs reads, which are NOT migrating in this task.)

- [ ] **Step 4.2: Replace the 4 `content_definitions` queries**

In `app/(app)/characters/[id]/builder/class/page.tsx`, remove the 4 inline queries (lines ~33–76: `classContent`, `subclassContent`, `featureContent`, `spells`). Replace them with:

```tsx
console.log("[ClassStepPage] Fetching content for system:", systemId);
const [classContent, subclassContent, featureContent, spells] = await Promise.all([
  getContentByType(systemId, "class"),
  getContentByType(systemId, "subclass"),
  getContentByType(systemId, "feature"),
  getContentByType(systemId, "spell"),
]);
```

The 4 separate logs become 1; the 4 separate error checks become 0 (the helper logs and returns []).

- [ ] **Step 4.3: Adjust the prop types passed to `ClassStepClient`**

The component currently receives `Array<{id, name, slug, content_type, data: Record<string, unknown>, effects: Effect[], ...}>` as `classes`, etc. After Task 4 they receive `ParsedContentDefinition[]`. The component's `ContentEntry` interface (defined in `components/builder/content-browser.tsx`) needs to be compatible.

If `ContentEntry` is structurally compatible with `ParsedContentDefinition` (same fields), no edit needed; the cast is implicit. If not, defer the structural alignment to Task 11a/b/c (consumer migrations).

Verify:

```bash
npx tsc --noEmit 2>&1 | grep "app/(app)/characters/\[id\]/builder/class/page.tsx" | wc -l
```

Expected: 0 errors in this file. If there ARE errors, they should be `Type 'ParsedContentDefinition[]' is not assignable to ContentEntry[]` style — in which case adjust `ContentEntry` in `components/builder/content-browser.tsx` to read `data: unknown` (or extract a shared `ContentEntry = ParsedContentDefinition`).

If that adjustment is needed, also commit it as part of this task (it's a one-line change in `content-browser.tsx`).

- [ ] **Step 4.4: Run the full suite**

```bash
npx vitest run --reporter=dot
```

Expected: 621 tests pass.

- [ ] **Step 4.5: Commit**

```bash
git add app/(app)/characters/[id]/builder/class/page.tsx components/builder/content-browser.tsx
git commit -m "refactor(builder/class): route content_definitions reads through getContentByType

Replaces 4 inline supabase queries (class, subclass, feature, spell)
in app/(app)/characters/[id]/builder/class/page.tsx with parallel
getContentByType calls. The helper handles parsing and log-and-skip
on bad rows; one log line replaces four.

Tightens ContentEntry's data field to unknown so it accepts the
parsed shape from the helper."
```

(If `content-browser.tsx` wasn't touched, drop it from the `git add`.)

---

## Task 5: Migrate `race/page.tsx`

**File:** `app/(app)/characters/[id]/builder/race/page.tsx`

- [ ] **Step 5.1: Update imports**

Add `import { getContentByType } from "@/lib/supabase/content-definitions";` at the top.

- [ ] **Step 5.2: Replace the 3 `content_definitions` queries**

In `app/(app)/characters/[id]/builder/race/page.tsx`, replace the race + subrace + trait queries (the inline `.from("content_definitions").select(...)` blocks for content_type "race", "subrace", and "trait") with:

```tsx
const [raceContent, subraceContent, traitContent] = await Promise.all([
  getContentByType(systemId, "race"),
  getContentByType(systemId, "subrace"),
  getContentByType(systemId, "trait"),
]);
```

The `content_refs` query (which reads `character_content_refs` with a JOIN, not `content_definitions` directly) stays — it's migrated in Task 9.

- [ ] **Step 5.3: Run typecheck on the file**

```bash
npx tsc --noEmit 2>&1 | grep "race/page.tsx"
```

Expected: 0 errors.

- [ ] **Step 5.4: Run the full suite**

```bash
npx vitest run --reporter=dot
```

Expected: 621 tests pass.

- [ ] **Step 5.5: Commit**

```bash
git add app/(app)/characters/[id]/builder/race/page.tsx
git commit -m "refactor(builder/race): route content_definitions reads through getContentByType

Replaces 3 inline queries (race, subrace, trait) with parallel
getContentByType calls."
```

---

## Task 6: Migrate `background/page.tsx`

**File:** `app/(app)/characters/[id]/builder/background/page.tsx`

- [ ] **Step 6.1: Update imports**

Add `import { getContentByType } from "@/lib/supabase/content-definitions";` at the top.

- [ ] **Step 6.2: Replace the background query**

Replace the inline `.from("content_definitions").select(...)` block for content_type "background" with:

```tsx
const backgroundContent = await getContentByType(character.system_id, "background");
```

- [ ] **Step 6.3: Leave the languages query as-is**

The languages query at the bottom of the page only selects `slug, name` (not the full content_definitions row). It doesn't need parsing — it's a slug enumeration. Leave that query as-is.

If it bothers you stylistically, do NOT migrate it in this task — note as a follow-up if anything.

- [ ] **Step 6.4: Run typecheck on the file**

```bash
npx tsc --noEmit 2>&1 | grep "background/page.tsx"
```

Expected: 0 errors.

- [ ] **Step 6.5: Run the full suite**

```bash
npx vitest run --reporter=dot
```

Expected: 621 tests pass.

- [ ] **Step 6.6: Commit**

```bash
git add app/(app)/characters/[id]/builder/background/page.tsx
git commit -m "refactor(builder/background): route content_definitions reads through getContentByType

Replaces 1 inline query (background) with a getContentByType call.
The languages query stays as-is — it only selects slug+name, no
parsing needed."
```

---

## Task 7: Migrate `equipment/page.tsx`

**File:** `app/(app)/characters/[id]/builder/equipment/page.tsx`

- [ ] **Step 7.1: Update imports**

Add `import { getContentByType } from "@/lib/supabase/content-definitions";` at the top.

- [ ] **Step 7.2: Replace the single-class lookup by slug**

The current query selects ONE class by slug. `getContentByType` returns all classes for a system; we filter for the matching slug post-fetch:

Replace:

```tsx
const classSlug = character.choices?.classes?.[0]?.slug;
let classContent = null;
if (classSlug) {
  console.log("[EquipmentStepPage] Fetching class content for slug:", classSlug);
  const { data, error: classError } = await supabase
    .from("content_definitions")
    .select("id, name, slug, data")
    .eq("system_id", character.system_id)
    .eq("content_type", "class")
    .eq("slug", classSlug)
    .single();
  if (classError) {
    console.error("[EquipmentStepPage] Error fetching class content:", classError.message, classError.details, classError.hint);
  }
  classContent = data;
}
```

with:

```tsx
const classSlug = character.choices?.classes?.[0]?.slug;
let classContent: { id: string; name: string; slug: string; data: unknown } | null = null;
if (classSlug) {
  const allClasses = await getContentByType(character.system_id, "class");
  const match = allClasses.find((c) => c.slug === classSlug);
  classContent = match ? { id: match.id, name: match.name, slug: match.slug, data: match.data } : null;
}
```

The fetch-all + filter does an extra parse per class (~12 classes in 5e SRD), which is fine. If perf ever matters here, swap back to a single-slug fetch with a dedicated `getContentBySlug` helper as a follow-up.

- [ ] **Step 7.3: Run typecheck on the file**

```bash
npx tsc --noEmit 2>&1 | grep "equipment/page.tsx"
```

Expected: 0 errors.

- [ ] **Step 7.4: Run the full suite**

```bash
npx vitest run --reporter=dot
```

Expected: 621 tests pass.

- [ ] **Step 7.5: Commit**

```bash
git add app/(app)/characters/[id]/builder/equipment/page.tsx
git commit -m "refactor(builder/equipment): route content_definitions reads through getContentByType

Replaces the single-class lookup with a fetch-all + filter pattern
to keep the helper interface uniform. ~12 class rows parsed instead
of 1; trivial perf impact for the simplicity win."
```

---

## Task 8: Migrate `characters/[id]/page.tsx` (sheet)

**File:** `app/(app)/characters/[id]/page.tsx`

This is the busiest page. It has 4 separate `content_definitions` queries (class + subclass for spellcasting, feature rows, etc.) plus calls to inventory/spells helpers that we're migrating later.

- [ ] **Step 8.1: Update imports**

Add at the top:

```tsx
import { getContentByType } from "@/lib/supabase/content-definitions";
```

- [ ] **Step 8.2: Migrate the class + subclass spellcasting queries**

These currently do `.in("slug", classSlugs)` filters. Same approach as Task 7: fetch all classes / subclasses, filter by slug.

Replace the `Promise.all([...])` block:

```tsx
const [classContentRes, subclassContentRes] = await Promise.all([
  classSlugs.length > 0
    ? supabase
        .from("content_definitions")
        .select("slug, data")
        .eq("system_id", character.system_id)
        .eq("content_type", "class")
        .in("slug", classSlugs)
    : Promise.resolve({ data: [] as Array<{ slug: string; data: Record<string, unknown> }> }),
  subclassSlugs.length > 0
    ? supabase
        .from("content_definitions")
        .select("slug, data")
        .eq("system_id", character.system_id)
        .eq("content_type", "subclass")
        .in("slug", subclassSlugs)
    : Promise.resolve({ data: [] as Array<{ slug: string; data: Record<string, unknown> }> }),
]);

const classData: Record<string, { slug: string; data: Record<string, unknown> }> = {};
for (const row of classContentRes.data ?? []) {
  classData[row.slug] = row;
}

const subclassData: Record<string, { spellcastingExtra?: Array<{ level: number; spells: string[] }> | null }> = {};
for (const row of subclassContentRes.data ?? []) {
  const extras = (row.data as Record<string, unknown>)?.spellcastingExtra;
  subclassData[row.slug] = {
    spellcastingExtra: Array.isArray(extras)
      ? (extras as Array<{ level: number; spells: string[] }>)
      : null,
  };
}
```

with:

```tsx
const [allClasses, allSubclasses] = await Promise.all([
  classSlugs.length > 0
    ? getContentByType(character.system_id, "class")
    : Promise.resolve([]),
  subclassSlugs.length > 0
    ? getContentByType(character.system_id, "subclass")
    : Promise.resolve([]),
]);

const classData: Record<string, { slug: string; data: Record<string, unknown> }> = {};
for (const row of allClasses) {
  if (classSlugs.includes(row.slug)) {
    classData[row.slug] = { slug: row.slug, data: row.data as Record<string, unknown> };
  }
}

const subclassData: Record<string, { spellcastingExtra?: Array<{ level: number; spells: string[] }> | null }> = {};
for (const row of allSubclasses) {
  if (subclassSlugs.includes(row.slug)) {
    const extras = (row.data as { spellcastingExtra?: unknown })?.spellcastingExtra;
    subclassData[row.slug] = {
      spellcastingExtra: Array.isArray(extras)
        ? (extras as Array<{ level: number; spells: string[] }>)
        : null,
    };
  }
}
```

The `row.data as Record<string, unknown>` cast at the consumer stays for now — it's narrowed to the structural shape that the existing `classData` map expects. Task 11 will tighten the consumers; this task just routes the fetch through the helper.

- [ ] **Step 8.3: Migrate the feature query**

Replace:

```tsx
let classFeatures: Array<{ effects: Effect[]; data: Record<string, unknown> }> = [];

if (classChoices.length > 0) {
  const { data: featureRows } = await supabase
    .from("content_definitions")
    .select("effects, data")
    .eq("system_id", character.system_id)
    .eq("content_type", "feature")
    .in("data->>class", classChoices.map((c: { slug: string }) => c.slug));

  if (featureRows) {
    classFeatures = featureRows.filter((f) => {
      const featureClass = f.data?.class as string | undefined;
      const featureLevel = f.data?.level as number | undefined;
      const featureSubclass = f.data?.subclass as string | null | undefined;
      if (!featureClass || featureLevel == null) return false;
      const classEntry = classChoices.find((c: { slug: string }) => c.slug === featureClass);
      if (!classEntry || featureLevel > classEntry.level) return false;
      if (featureSubclass) return classEntry.subclass === featureSubclass;
      return true;
    });
  }
}
```

with:

```tsx
let classFeatures: Array<{ effects: Effect[]; data: Record<string, unknown> }> = [];

if (classChoices.length > 0) {
  const allFeatures = await getContentByType(character.system_id, "feature");
  const myClassSlugs = new Set(classChoices.map((c: { slug: string }) => c.slug));
  classFeatures = allFeatures
    .filter((f) => {
      const fdata = f.data as { class?: string; level?: number; subclass?: string | null };
      if (!fdata.class || fdata.level == null) return false;
      if (!myClassSlugs.has(fdata.class)) return false;
      const classEntry = classChoices.find((c: { slug: string }) => c.slug === fdata.class);
      if (!classEntry || fdata.level > classEntry.level) return false;
      if (fdata.subclass) return classEntry.subclass === fdata.subclass;
      return true;
    })
    .map((f) => ({ effects: f.effects, data: f.data as Record<string, unknown> }));
}
```

The supabase-side `.in("data->>class", ...)` JSONB filter is removed — we now fetch all features for the system and filter client-side. For a single character with ~6 classes max and ~100 total features in a system, that's fine. If perf matters, follow up with a `getContentByTypeAndSlugs(systemId, contentType, slugs)` helper variant.

- [ ] **Step 8.4: Run typecheck on the file**

```bash
npx tsc --noEmit 2>&1 | grep "characters/\[id\]/page.tsx"
```

Expected: 0 errors.

- [ ] **Step 8.5: Run the full suite**

```bash
npx vitest run --reporter=dot
```

Expected: 621 tests pass.

- [ ] **Step 8.6: Commit**

```bash
git add app/(app)/characters/[id]/page.tsx
git commit -m "refactor(sheet): route content_definitions reads through getContentByType

Replaces 3 inline queries (class spellcasting, subclass spellcasting,
class features) with getContentByType calls. The supabase-side
data->>class JSONB filter for features moves client-side; trivial
perf for the consistency win.

Consumer-side type narrowing (classData / subclassData / classFeatures
maps) stays as-is; Task 11 tightens those when the component
consumers migrate."
```

---

## Task 9: Update `content-refs.ts`

**File:** `lib/supabase/content-refs.ts`
**Test file:** `tests/lib/supabase/content-refs.test.ts`

- [ ] **Step 9.1: Add the parsing import**

At the top of `lib/supabase/content-refs.ts`, add:

```ts
import { parseContentDefinition } from "@/lib/supabase/content-definitions";
```

- [ ] **Step 9.2: Tighten `ContentRefWithContent`**

Change the existing interface from:

```ts
export interface ContentRefWithContent extends CharacterContentRef {
  content_definitions: {
    id: string;
    name: string;
    slug: string;
    content_type: string;
    data: Record<string, unknown>;
    effects: import("@/lib/types/effects").Effect[];
  };
}
```

to:

```ts
export interface ContentRefWithContent extends CharacterContentRef {
  content_definitions: {
    id: string;
    name: string;
    slug: string;
    content_type: string;
    data: unknown;
    effects: import("@/lib/types/effects").Effect[];
  };
}
```

Only one field changes: `data: Record<string, unknown>` → `data: unknown`. The parsed shape will be cast by call sites (Task 10/11).

- [ ] **Step 9.3: Parse rows in `getContentRefsByCharacter`**

Replace the existing implementation:

```ts
export async function getContentRefsByCharacter(
  characterId: string,
): Promise<ContentRefWithContent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("character_content_refs")
    .select(
      `*, content_definitions (id, name, slug, content_type, data, effects)`,
    )
    .eq("character_id", characterId);

  if (error) throw error;
  return (data ?? []) as ContentRefWithContent[];
}
```

with a per-row parsing version:

```ts
export async function getContentRefsByCharacter(
  characterId: string,
): Promise<ContentRefWithContent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("character_content_refs")
    .select(
      `*, content_definitions (id, name, slug, content_type, data, effects, version, source)`,
    )
    .eq("character_id", characterId);

  if (error) throw error;

  const refs: ContentRefWithContent[] = [];
  for (const row of data ?? []) {
    const cd = (row as { content_definitions: unknown }).content_definitions;
    if (!cd) continue;
    const parsed = parseContentDefinition(cd);
    if (parsed === null) continue;
    refs.push({
      ...(row as unknown as Omit<ContentRefWithContent, "content_definitions">),
      content_definitions: {
        id: parsed.id,
        name: parsed.name,
        slug: parsed.slug,
        content_type: parsed.content_type,
        data: parsed.data,
        effects: parsed.effects,
      },
    });
  }
  return refs;
}
```

The JOIN select now includes `version, source` so the envelope schema validates. Bad rows log and drop via `parseContentDefinition`.

- [ ] **Step 9.4: Update `tests/lib/supabase/content-refs.test.ts`**

The existing test for `getContentRefsByCharacter` constructs a fake row without `version, source` — it'll now drop through the parser. Update the test fixture using `makeContentDefinition`:

Open `tests/lib/supabase/content-refs.test.ts`. Find the existing `describe("getContentRefsByCharacter", …)` block. Update the fixture to satisfy the parser:

Before:
```ts
describe("getContentRefsByCharacter", () => {
  it("queries refs with joined content definitions", async () => {
    const refs = [{ id: "r1", content_id: "c1" }];
    const { chain } = mockSupabase(refs);
    chain.eq.mockResolvedValue({ data: refs, error: null });

    const result = await getContentRefsByCharacter("char-1");

    expect(result).toEqual(refs);
  });
});
```

After:
```ts
import { makeContentDefinition } from "@/tests/fixtures/content";

// (existing imports remain)

describe("getContentRefsByCharacter", () => {
  it("queries refs and parses content_definitions", async () => {
    const cd = makeContentDefinition({
      id: "c1",
      slug: "fixture",
      content_type: "feature",
      data: { class: "wizard", level: 1, description: "x" },
    });
    const rows = [{
      id: "r1",
      character_id: "char-1",
      content_id: "c1",
      content_version: 1,
      context: {},
      choice_source: null,
      created_at: "2026-05-19",
      content_definitions: cd,
    }];
    const { chain } = mockSupabase(rows);
    chain.eq.mockResolvedValue({ data: rows, error: null });

    const result = await getContentRefsByCharacter("char-1");

    expect(result).toHaveLength(1);
    expect(result[0].content_definitions.slug).toBe("fixture");
  });

  it("drops rows whose content_definitions fails parsing", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const rows = [{
      id: "r1",
      character_id: "char-1",
      content_id: "c1",
      content_version: 1,
      context: {},
      choice_source: null,
      created_at: "2026-05-19",
      content_definitions: { id: "c1", slug: "bad", content_type: "feature", data: null },
    }];
    const { chain } = mockSupabase(rows);
    chain.eq.mockResolvedValue({ data: rows, error: null });

    const result = await getContentRefsByCharacter("char-1");

    expect(result).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
```

(Add `import { vi } from "vitest";` at the top of the file if it's not already imported.)

- [ ] **Step 9.5: Run the test file**

```bash
npx vitest run tests/lib/supabase/content-refs.test.ts --reporter=verbose
```

Expected: existing tests + 1 new "drops rows" test pass. Net +1 test.

- [ ] **Step 9.6: Run the full suite**

```bash
npx vitest run --reporter=dot
```

Expected: 621 + 1 = **622 tests pass**.

- [ ] **Step 9.7: Commit**

```bash
git add lib/supabase/content-refs.ts tests/lib/supabase/content-refs.test.ts
git commit -m "refactor(supabase): parse nested content_definitions in getContentRefsByCharacter

ContentRefWithContent.content_definitions.data tightens from
Record<string, unknown> to unknown — the parsed shape. The fetch
now runs each joined content_definitions row through
parseContentDefinition; bad rows log and drop.

The JOIN select adds version + source so the envelope schema
validates. The existing test gains a drop-on-bad-shape case."
```

---

## Task 10: Migrate the 4 lib helpers

**Files:**
- `lib/supabase/spells.ts`
- `lib/supabase/inventory.ts`
- `lib/resources/helpers.ts`
- `lib/builder/class-features-per-level.ts`

- [ ] **Step 10.1: Tighten `lib/supabase/spells.ts`**

The `searchSpells` return type currently is:

```ts
): Promise<Array<{
  id: string;
  name: string;
  slug: string;
  content_type: string;
  data: Record<string, unknown>;
}>>
```

Change `data: Record<string, unknown>` to `data: unknown`. This is the only structural change — the function body stays as-is; consumers narrow as needed.

The JOIN in `getSpellsForCharacter` (`SPELLS_SELECT`) returns the joined `content_definitions` shape via the `CharacterSpell` type. If `CharacterSpell.content_definitions.data` is `Record<string, unknown>` in `lib/types/spells.ts`, change it to `unknown` to match the tightened parser-side type. (Verify in `lib/types/spells.ts` before changing.)

- [ ] **Step 10.2: Tighten `lib/supabase/inventory.ts`**

Same change for `searchItems` return type and `InventoryItem.content_definitions.data` if present in `lib/types/inventory.ts`.

- [ ] **Step 10.3: Tighten `lib/resources/helpers.ts`**

The current implementation (line 64) does:

```ts
const data = def.data as Record<string, unknown> | undefined;
```

After Task 9, `def.data` is typed `unknown`. Change the cast to a typed narrow:

```ts
const data = def.data as
  | { class?: string; level?: number; usages?: number | Array<number | null>; recovery?: string; extraLimitedFeatures?: Array<{ name: string; usages: number; recovery: string }> }
  | null
  | undefined;
if (!data) continue;
```

The downstream accesses (`data.class as string | undefined`, `data.usages as number | …`, etc.) can keep their casts since the structural shape now declares them. Optionally tighten further by replacing each `as` with direct narrowing.

- [ ] **Step 10.4: Tighten `lib/builder/class-features-per-level.ts`**

Read the file first — the call sites are at lines 38, 41, 70 per the grep. Apply the same narrowing pattern: cast `def.data` once to the structural shape your helper needs, then access typed fields without per-access casts.

- [ ] **Step 10.5: Run typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "lib/(supabase|resources|builder)/" | wc -l
```

Expected: 0 new errors. (Pre-existing errors at this layer were closed in Task 2.)

- [ ] **Step 10.6: Run the full suite**

```bash
npx vitest run --reporter=dot
```

Expected: 622 tests pass.

- [ ] **Step 10.7: Commit**

```bash
git add lib/supabase/spells.ts lib/supabase/inventory.ts lib/resources/helpers.ts lib/builder/class-features-per-level.ts lib/types/spells.ts lib/types/inventory.ts
git commit -m "refactor(lib): tighten content_definitions.data reads to typed narrow

Switches lib/supabase/spells.ts, inventory.ts, lib/resources/helpers.ts,
and lib/builder/class-features-per-level.ts from
\`Record<string, unknown>\` casts on content_definitions.data to
typed structural narrows. Drops the type-information loss without
changing any runtime behavior."
```

(Adjust the `git add` list based on which type files actually needed editing.)

---

## Task 11a: Migrate class-step-rail + class-preview-modal cluster

**Files (11 in this cluster):**
- `components/builder/class-step-rail/index.tsx`
- `components/builder/class-step-rail/level-up-pane.tsx`
- `components/builder/class-step-rail/feature-card.tsx`
- `components/builder/class-step-rail/class-picker-card.tsx`
- `components/builder/class-step-rail/choice-card-subclass.tsx`
- `components/builder/class-step-rail/choice-card-fighting-style.tsx`
- `components/builder/class-preview-modal.tsx`
- `components/builder/class-preview-modal/overview-tab.tsx`
- `components/builder/class-preview-modal/features-tab.tsx`
- `components/builder/class-preview-modal/spells-tab.tsx`
- `components/builder/class-preview-modal/subclasses-tab.tsx`

**Pattern at every call site:**

Each file has one or more `(x.data as Record<string, unknown>).field as T` patterns. Replace with:

```tsx
// Before
const description = (cls.data as Record<string, unknown>)?.description as string | undefined;

// After (cast once to the typed shape)
const data = cls.data as { description?: string; /* other fields this file reads */ };
const description = data.description;
```

For each file:

- [ ] **Step 11a.1: For each file, list the fields read from `.data` and define a local type alias.**

Use grep to find every `data` access in the file. List the fields. Cast `def.data` ONCE at the top of the function/component to that structural type. Replace per-access casts with typed reads.

Example for `class-picker-card.tsx`:

```tsx
// At the top of the component body
const data = props.cls.data as {
  description?: string;
  hit_die?: number;
  // ...
};

// Below
{data.description ?? "—"}
{data.hit_die ?? 6}
```

- [ ] **Step 11a.2: Verify each file typechecks**

After each file, run:

```bash
npx tsc --noEmit 2>&1 | grep "<file-path>" | wc -l
```

Expected: 0.

- [ ] **Step 11a.3: Commit each file (or commit the whole cluster together)**

If committing per file:

```bash
git add components/builder/class-step-rail/<file>.tsx
git commit -m "refactor(class-step-rail): tighten content data reads to typed narrow

Replaces (data as Record<string, unknown>).field as T casts with
a single structural cast at function scope. No behavior change."
```

If committing the cluster together (faster):

```bash
git add components/builder/class-step-rail/ components/builder/class-preview-modal*
git commit -m "refactor(builder): tighten content data reads across class-step-rail + class-preview-modal

Removes ~20 inline (data as Record<string, unknown>).field as T
casts across 11 files. Each file now casts def.data once at scope
to the structural shape it reads, then accesses typed fields
directly. No behavior change."
```

- [ ] **Step 11a.4: Run the full suite + typecheck after the cluster lands**

```bash
npx tsc --noEmit 2>&1 | grep "components/builder/" | wc -l
npx vitest run --reporter=dot
```

Expected: 0 errors in `components/builder/`; 622 tests pass.

---

## Task 11b: Migrate sheet tabs + sheet spells/inventory cluster

**Files (6 in this cluster):**
- `components/sheet/tabs/spells-tab.tsx`
- `components/sheet/tabs/features-tab.tsx`
- `components/sheet/tabs/actions-tab.tsx`
- `components/sheet/spells/spell-header.tsx`
- `components/sheet/spells/add-spell-panel.tsx`
- `components/sheet/inventory/add-item-panel.tsx`

Pattern is identical to Task 11a (cast `def.data` once at function scope, drop per-access casts). Reproducing here so this task is self-contained:

```tsx
// Before
const description = (cls.data as Record<string, unknown>)?.description as string | undefined;
const hitDie = (cls.data as Record<string, unknown>)?.hit_die as number | undefined;

// After (one structural cast at scope, typed reads below)
const data = cls.data as { description?: string; hit_die?: number };
const description = data.description;
const hitDie = data.hit_die;
```

- [ ] **Step 11b.1: Apply the per-file narrowing pattern**

For each file, find every `(x.data as Record<string, unknown>).field as T` or `x.data?.field as T`. Replace with a single structural cast at scope per the pattern above.

- [ ] **Step 11b.2: Verify typecheck per file**

```bash
npx tsc --noEmit 2>&1 | grep "components/sheet/" | wc -l
```

Expected: 0 (or unchanged from baseline; pre-existing rest-dialog/spells-tab errors are out of scope).

- [ ] **Step 11b.3: Commit**

```bash
git add components/sheet/tabs/ components/sheet/spells/ components/sheet/inventory/
git commit -m "refactor(sheet): tighten content data reads across tabs + spells + inventory

Same pattern as the class-step-rail migration — one structural
cast per scope, typed access below."
```

---

## Task 11c: Migrate remaining consumers

**Files (5 in this cluster):**
- `components/builder/content-preview.tsx` (423 LOC — large, untested)
- `app/(app)/characters/[id]/builder/race/race-step-client.tsx` (read-side casts only — writes already done in PR #56)
- `app/(app)/characters/[id]/builder/equipment/equipment-step-client.tsx` (read-side casts)
- `app/(app)/characters/[id]/builder/abilities/abilities-step-client.tsx` (read-side casts)

- [ ] **Step 11c.1: Apply the narrowing pattern**

Same approach as 11a/11b — reproducing the pattern here so this task is self-contained:

```tsx
// Before
const description = (cls.data as Record<string, unknown>)?.description as string | undefined;

// After (one structural cast at scope, typed reads below)
const data = cls.data as { description?: string; /* other fields this file reads */ };
const description = data.description;
```

`content-preview.tsx` is the biggest single file in this cluster — take it slow, one cast pattern at a time.

- [ ] **Step 11c.2: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "(components/builder/content-preview|builder/race|builder/equipment|builder/abilities)" | wc -l
```

Expected: 0.

- [ ] **Step 11c.3: Commit**

```bash
git add components/builder/content-preview.tsx app/(app)/characters/[id]/builder/race/race-step-client.tsx app/(app)/characters/[id]/builder/equipment/equipment-step-client.tsx app/(app)/characters/[id]/builder/abilities/abilities-step-client.tsx
git commit -m "refactor(builder): tighten content data reads in content-preview + step-clients

Closes the remaining (data as Record<string, unknown>).field as T
casts. The step-clients here keep their PR #56 write helpers; only
the read-side casts change."
```

---

## Task 12: Regression + browser smoke + open PR

- [ ] **Step 12.1: Full vitest run**

```bash
npx vitest run --reporter=verbose
```

Expected: 622 tests pass.

- [ ] **Step 12.2: Final typecheck**

```bash
npx tsc --noEmit 2>&1 | wc -l
```

Expected: dropped from 30 (baseline) to ~9 (the still-out-of-scope `evaluator-conditions.test.ts` 6, `sheet/inventory-tab.test.tsx` 1, `sheet/rest-dialog.test.tsx` 1, `sheet/spells-tab.test.tsx` 1).

- [ ] **Step 12.3: Production build**

```bash
npm run build
```

Expected: clean build. (Spec note: the server-only `lib/supabase/server.ts` import in `content-definitions.ts` is fine for server pages but if any "use client" component value-imports `parseContentDefinition`, the same Turbopack failure mode from PR #56's content-refs split would fire. Verify no client component value-imports from `@/lib/supabase/content-definitions`.)

If the build fails with the next/headers-in-client-bundle error, follow PR #56's split pattern: move `parseContentDefinition` (which doesn't need the server client) to a `content-definitions-shared.ts` that doesn't import from `@/lib/supabase/server`, leaving only `getContentByType` server-bound.

- [ ] **Step 12.4: Browser smoke — Voltee (Wizard 3, build-from-scratch)**

Copy `.env.local` into the worktree if not already present. Start the dev server via `mcp__Claude_Preview__preview_start` (server name `inkborne-dev` per `.claude/launch.json`). Log in with `test@inkborne.app` / `testpassword123`.

Open Voltee in the builder. Walk each step:
- **Race:** every race in the list renders identically to today. Pick Mountain Dwarf (or any race with rich data).
- **Class:** every class in the list renders. Pick Wizard. Pick the School of Evocation subclass.
- **Abilities:** standard array works. Scores persist.
- **Background:** every background renders. Pick Sage. Fill the personality tables.
- **Equipment:** "Confirm Equipment" still works.

If anything looks subtly wrong (missing description, missing trait), check `console.error` — a row may have dropped.

- [ ] **Step 12.5: Browser smoke — Xero (Barbarian 10 / Fighter 5, PR-F + PR-#56 regression)**

Open Xero's sheet:
- Color picker in the header — pick a color, refresh, color persists (PR-F regression).
- Class section shows Barbarian 10 / Fighter 5 with all features and class traits visible.
- Inventory tab loads.
- Spells tab loads (Fighter shouldn't have spells; verify the empty state renders).

- [ ] **Step 12.6: Browser smoke — forced-failure (required)**

This is the canary that proves parse-on-read works.

In Supabase Studio (or Supabase MCP), edit ONE content_definitions row to break the schema. Recommended target: a wizard subclass like "school-of-evocation". Either:
- Remove a required field from `data` (e.g., delete `description` from a feature row), OR
- Set `data` to `null` for one row.

Reload the builder class step in the browser. Confirm:
1. The broken row VANISHES from the picker (no UI crash).
2. `console.error` shows `[content-definitions] Bad data for school-of-evocation (subclass): …` with Zod issue details.
3. Other rows still render normally.

Then restore the row to its original shape.

- [ ] **Step 12.7: Push the branch (if not already pushed)**

```bash
git push -u origin refactor/content-schema-validation
```

- [ ] **Step 12.8: Open the pull request**

```bash
gh pr create --base main --head refactor/content-schema-validation \
  --title "refactor: parse content_definitions at the I/O boundary" \
  --body "$(cat <<'EOF'
## Summary

Second post-M2 refactor — tackles audit candidate #2 ([architecture overview](docs/architecture/00-overview.md)). Runs the 15 existing Zod schemas in `lib/schemas/content-types/` at the server fetch boundary so the 30+ `(data as Record<string, unknown>).field as T` reads across the codebase become typed property access.

Implements the spec at [`docs/superpowers/specs/2026-05-19-content-schema-validation-design.md`](docs/superpowers/specs/2026-05-19-content-schema-validation-design.md) (merged via PR #57). Plan at [`docs/superpowers/plans/2026-05-19-content-schema-validation.md`](docs/superpowers/plans/2026-05-19-content-schema-validation.md).

## Changes

- **New helpers** — `lib/supabase/content-definitions.ts` (server-side `getContentByType`, standalone `parseContentDefinition`). `parseContentByType` convenience in `lib/schemas/content-types/index.ts`.
- **5 server pages migrated** — class, race, background, equipment builder pages + the sheet page. All inline `.from(\"content_definitions\").select(...)` calls now route through `getContentByType`.
- **`getContentRefsByCharacter` parses nested rows** in `lib/supabase/content-refs.ts`. Bad refs log and drop instead of propagating untyped data.
- **4 lib helpers tightened** — `spells.ts`, `inventory.ts`, `resources/helpers.ts`, `builder/class-features-per-level.ts`.
- **20+ component consumers** migrated across class-step-rail, class-preview-modal, sheet tabs + spells/inventory, and 3 step-clients. Each file casts `data` once at scope to a structural type, dropping per-access casts.
- **Test fixture sweep** — new `tests/fixtures/content.ts` factory. Closes 21 pre-existing tsc errors (17 in `tests/resources/helpers.test.ts`, 4 in `tests/spells/helpers.test.ts`).

## Behavior

Pure code refactor in the happy path; failure semantics improve:
- Malformed `content_definitions` rows that previously caused runtime errors deep in the UI now log at the fetch boundary and the row is omitted.
- The forced-failure smoke (intentionally break one row) confirms the bad row vanishes from the picker with a structured `console.error`, while all other rows render normally.

## Tests

- 6 new unit tests for `getContentByType` + `parseContentDefinition`
- 1 new \"drops bad rows\" test for `getContentRefsByCharacter`
- All 615 baseline tests + 12 from PR #56 still pass
- Total: 622 tests passing

## Verification

- [x] All tests pass
- [x] `npx tsc --noEmit` — 21 of 30 pre-existing errors closed; remaining ~9 are out of scope (evaluator-conditions fixture drift, sheet test type drift — tracked separately)
- [x] `npm run build` clean
- [x] Schema-drift audit (`npx tsx scripts/validate-content.ts`) reports 0 failures against the dev DB
- [x] Browser smoke on Voltee (build from scratch)
- [x] Browser smoke on Xero (color picker + sheet)
- [x] Forced-failure smoke (broke one row, confirmed it dropped + logged)

## Notes

- No DB migration. No feature flag. Squash-merge.
- `custom_data` on inventory/spells, `effects[].context` at the engine boundary, and bulk re-validation of DB rows are intentionally out of scope (see spec Non-goals).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

The PR URL is returned by `gh`. Paste it into the session output.

- [ ] **Step 12.9: Mark task done**

No additional commit — PR open completes the workflow.

---

## Verification gate (mirrors `.continue-here.md`)

- [x] All 615 baseline tests + 12 from PR #56 = 627 still pass; with new tests = **622 total pass**
  *(Note: actual baseline post-PR-#56 is 615, not 627; the spec says "615 baseline" — the +12 from PR #56 is included in that 615. New tests bring the total to 622.)*
- [x] `npx tsc --noEmit` — the 21 pre-existing errors in resources/helpers + spells/helpers go to 0
- [x] `npm run build` clean
- [x] Browser smoke on Voltee (build-from-scratch)
- [x] Browser smoke on Xero (PR-F color picker regression + sheet load)
- [x] Forced-failure smoke confirms log-and-skip

## Open questions

None blocking. If Task 3's schema-drift audit surfaces non-trivial failures, STOP and brainstorm rather than improvising fixes.
