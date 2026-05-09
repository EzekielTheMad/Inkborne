# Inkborne · Architecture Overview

> **Purpose:** Read-cold orientation for future sessions. Pre-refactor inventory, not a spec or recommendation. Pure factual map of the Inkborne codebase as of M2 close (PR-A through PR-E shipped, May 2026).
>
> **Companion docs in this folder:**
> - [`01-app-and-data-flow.md`](01-app-and-data-flow.md) — routing, middleware, server/client split, Supabase clients, server actions, API routes
> - [`02-domain-layer.md`](02-domain-layer.md) — type model, content schema, engine, builder/character helpers, migrations
> - [`03-ui-layer.md`](03-ui-layer.md) — `components/builder`, `components/sheet`, `components/ui`, tokens, test coverage of components
> - [`04-tests-and-tech-debt.md`](04-tests-and-tech-debt.md) — test suite map, large files, TODO clusters, type escape hatches, refactor candidates

---

## At a glance

Inkborne is a TTRPG character + campaign management platform — D&D 5e first, designed to extend to other game systems via a `system_schema` registry. Stack:

| Layer | Choice |
|---|---|
| Runtime | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| UI | React + Tailwind CSS (HSL CSS variable tokens) + shadcn/ui primitives |
| State | Server components for data, `*-client.tsx` peers for interaction; React context for character-page-level shared state |
| DB / Auth | Supabase (Postgres + Auth + RLS) |
| Test | Vitest + Testing Library |
| Hosting | Vercel |

Domain shape: **content-as-data**. Classes, races, features, spells live as rows in `content_definitions` with a typed `effects[]` JSON. A character holds `choices` (which classes/levels/subclasses/etc. they picked) plus `character_content_refs` linking back to the content rows. The engine in `lib/engine/evaluator.ts` folds effects to compute derived stats.

---

## How a typical request flows

1. URL → `proxy.ts` (middleware) → `lib/supabase/middleware.ts` refreshes Supabase session cookie + applies redirect rules.
2. Server component (e.g., `app/(app)/characters/[id]/builder/class/page.tsx`) creates a server Supabase client, runs the queries, hands typed props to `class-step-client.tsx`.
3. Client component holds local state + interaction logic; on user action, calls the *browser* Supabase client (`lib/supabase/client.ts`) directly to write back. `router.refresh()` re-runs the server fetch and re-hydrates.
4. Server actions (in 6 files under `app/(app)/...`, `"use server"` enabled) handle navigation-triggering or admin-only mutations.

Two consequences:
- Most builder writes go through the **browser client**, not server actions. Persistence is deliberately client-side for fast optimistic feel.
- The auth check is layered: middleware redirects, then each server page does its own `getUser()` + ownership check.

---

## What just shipped (M2 — Builder UX Polish)

The recent milestone added a new builder subsystem: the **class step rail**.

- Variant C (sidebar by level + main pane) — desktop layout, shipped in PR-B (#40)
- C1 multiclass (one rail per class + character section + add-class row) — PR-C (#43)
- Level-up flow with in-rail "+ Level up" button (Model B) — PR-D (#45)
- Mobile pattern (sub-`md`): horizontal pill rails + character strip + bottom-sheet variants of preview/picker/level-up — PR-E (#47)
- A small set of regressions closed (Remove Class button, class-level proficiency choices) — PR-B fixes (#48, originally #41)

The `components/builder/class-step-rail/` directory now has 21 files; the test file `tests/components/builder/class-step-rail.test.tsx` is ~2300+ lines. Mobile vs. desktop layout selection is driven by a `useIsMobile()` hook (deferred-state pattern, SSR-safe).

The remaining M2 slice — **PR-F, character primary color carry-through** — has its brainstorm prep at [`../superpowers/specs/2026-05-08-pr-f-character-color-prep.md`](../superpowers/specs/2026-05-08-pr-f-character-color-prep.md).

---

## Key files to know

| Area | Entry point | Why |
|---|---|---|
| Auth + session | [`proxy.ts`](../../proxy.ts), [`lib/supabase/middleware.ts`](../../lib/supabase/middleware.ts) | Every request goes through here. |
| Effect engine | [`lib/engine/evaluator.ts`](../../lib/engine/evaluator.ts) | The `evaluate()` fold over `Effect[]`. |
| Type model | [`lib/types/character.ts`](../../lib/types/character.ts), [`lib/types/effects.ts`](../../lib/types/effects.ts) | Top-level shapes. |
| Builder shell | [`components/builder/builder-step-nav.tsx`](../../components/builder/builder-step-nav.tsx) | Stepper for race/class/abilities/background/equipment. |
| Class rail (M2) | [`components/builder/class-step-rail/index.tsx`](../../components/builder/class-step-rail/index.tsx) | The big M2 surface. ~600+ lines, mobile/desktop branch. |
| Character sheet | [`components/character/character-page-client.tsx`](../../components/character/character-page-client.tsx), [`components/character/character-shell.tsx`](../../components/character/character-shell.tsx) | "Sacred" surface per design brief. Don't redesign. |
| Tokens | [`app/globals.css`](../../app/globals.css) | Tailwind 4 + HSL CSS vars. Always use semantic tokens (`text-accent`, etc.), never raw colors. |
| Migrations | [`supabase/migrations/`](../../supabase/migrations/) | 36 migrations as of M2 close. Most recent: `00036_campaigns_hp_rule.sql`. |

---

## Testing posture

- Unit tests on every shipped builder component since M2 started; coverage is dense for `class-step-rail/` (the `tests/components/builder/class-step-rail.test.tsx` file exceeds 2,300 lines and hosts most of the rail's behavioral verification).
- Engine + content-resolution tests in `tests/lib/` and `tests/character/`.
- Integration tests run against a local Supabase via `tests/resources/` helpers — note: a couple of fixture-shape mismatches in `tests/resources/helpers.test.ts` and `tests/spells/helpers.test.ts` predate M2 and are tracked in `04-tests-and-tech-debt.md`.
- No E2E framework yet (Playwright / Cypress not installed); browser smoke tests are run manually via the test account during PR review.

---

## Quick numbers

| Metric | Value |
|---|---|
| Total source LOC (`app + components + lib`) | 25,580 |
| Source files | 239 |
| Test files | 51 |
| Passing tests | 579 (all green via Vitest) |
| Migrations | 36 |
| `// TODO` markers in source | 2 (both in `scripts/`) |
| `@ts-ignore` / `@ts-expect-error` | 0 |
| `as unknown as` casts (source) | 8 |
| Largest single file | `tests/components/builder/class-step-rail.test.tsx` (2,417 LOC) |
| Largest source file | `lib/character/character-context.tsx` (627 LOC, 0 tests) |

## Top three refactor candidates (synthesis)

The tech-debt scan surfaced these as the highest-leverage items. Detail in [`04-tests-and-tech-debt.md`](04-tests-and-tech-debt.md).

1. **Builder step-clients duplicate the read-merge-write pattern.** 21 inline `from("characters").update(...)` calls across 5 step-clients (9 in `class-step-client.tsx` alone), with hand-rolled local-state mirroring 18 times. The atomic-merge RPC from `00031_patch_character_state_rpc.sql` and the helpers in `lib/supabase/content-refs.ts` exist but aren't being used. Clearest consolidation target.

2. **`Record<string, unknown>` is the de-facto contract for `content_definitions.data`.** 30+ casts of `(x.data as Record<string, unknown>).field as T` across builder rail, preview modal, and lib helpers, despite 18 typed Zod schemas living in `lib/schemas/content-types/`. Root cause of the pre-existing test typecheck errors in `tests/resources/helpers.test.ts` (17 errors) and `tests/spells/helpers.test.ts` (4). Running the schemas at the I/O boundary cleans both up.

3. **Coverage gaps around the largest source files.** Zero tests on: `lib/character/character-context.tsx` (627 LOC, the canonical character state hub), `components/builder/content-preview.tsx` (423 LOC), the `app/(app)/admin/*` clients (655 LOC across 3 files), the entire `components/narrative/` subtree (1,595 LOC across 12 files), and `narrative-actions.ts` (240 LOC).

A bonus signal: the codebase is unusually clean on TODO/FIXME comments and has zero `@ts-ignore`/`@ts-expect-error`. Type debt routes through `as unknown as` (8 in source) and `Record<string, unknown>` instead — both narrow, addressable patterns.

---

## Where to start for common tasks

| You want to… | Read first |
|---|---|
| Add a new content type (e.g., feat, item) | `02-domain-layer.md` § Content data model + § Engine |
| Add a new builder step | `03-ui-layer.md` § Builder layer + `01-app-and-data-flow.md` § App router |
| Touch the character sheet | `03-ui-layer.md` § Sheet layer (note: design says "sacred") |
| Hunt a bug in effect resolution | `02-domain-layer.md` § Engine |
| Find the largest / messiest files | `04-tests-and-tech-debt.md` § Large files |
| Understand auth | `01-app-and-data-flow.md` § Middleware + auth gate |

---

*Generated on 2026-05-08 as part of M2 close-out preparation for an upcoming refactor or larger body of work.*
