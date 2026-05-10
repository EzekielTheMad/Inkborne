# Tests and tech debt

Inventory of the test suite plus tech-debt + refactor candidates ahead of the next refactor pass. Numbers are exact at scan time. 51 test files / 579 passing tests. 239 source files (`app + components + lib`), 25 580 LOC. Six test files have pre-existing TS errors (TS-clean test transpile is broken at HEAD); all 579 tests still execute green via Vitest.

## Part A — Test suite map

### A.1 Framework setup

| File | Notes |
| --- | --- |
| [vitest.config.ts](vitest.config.ts) | Vitest 4.1.2; `globals: true`, `environment: "jsdom"`, single setup file, `@/` alias → repo root. |
| [tests/setup.ts](tests/setup.ts) | One line: `import "@testing-library/jest-dom/vitest"`. No global mocks, no test fixtures, no MSW. |
| [package.json](package.json) | `test` → `vitest run`; `test:watch` → `vitest`. Deps: `@testing-library/react@16.3.2`, `@testing-library/jest-dom@6.9.1`, `jsdom@29.0.1`. |

No tsconfig override for tests, no separate `tsconfig.test.json`, no `setupFilesAfterEach`. No browser/E2E framework (Playwright/Cypress) is configured. No coverage tool wired (no `--coverage` script, no `@vitest/coverage-*` dep).

### A.2 Test directory structure

21 test subdirectories under `tests/`. Each row is a file with line count.

#### tests/components/ (12 files, 1718 LOC)

| File | LOC |
| --- | --- |
| [tests/components/builder/class-step-rail.test.tsx](tests/components/builder/class-step-rail.test.tsx) | 2417 |
| [tests/components/builder/class-preview-modal.test.tsx](tests/components/builder/class-preview-modal.test.tsx) | 550 |
| [tests/components/sheet/inventory-tab.test.tsx](tests/components/sheet/inventory-tab.test.tsx) | 106 |
| [tests/components/sheet/conditions.test.tsx](tests/components/sheet/conditions.test.tsx) | 94 |
| [tests/components/sheet/spells-tab.test.tsx](tests/components/sheet/spells-tab.test.tsx) | 92 |
| [tests/components/sheet/resources-widget.test.tsx](tests/components/sheet/resources-widget.test.tsx) | 89 |
| [tests/components/sheet/hp-tracker.test.tsx](tests/components/sheet/hp-tracker.test.tsx) | 85 |
| [tests/components/builder/choice-selector.test.tsx](tests/components/builder/choice-selector.test.tsx) | 85 |
| [tests/components/sheet/add-item-panel.test.tsx](tests/components/sheet/add-item-panel.test.tsx) | 79 |
| [tests/components/narrative/use-narrative-editor.test.ts](tests/components/narrative/use-narrative-editor.test.ts) | 75 |
| [tests/components/sheet/rest-dialog.test.tsx](tests/components/sheet/rest-dialog.test.tsx) | 73 |
| [tests/components/sheet/resource-counter.test.tsx](tests/components/sheet/resource-counter.test.tsx) | 63 |
| [tests/components/builder/stat-preview.test.tsx](tests/components/builder/stat-preview.test.tsx) | 55 |
| [tests/components/builder/class-emblem.test.tsx](tests/components/builder/class-emblem.test.tsx) | 32 |

`class-step-rail.test.tsx` alone is 2 417 lines — 4× the next-largest file in the entire `tests/` tree.

#### tests/engine/ (5 files)

| File | LOC |
| --- | --- |
| [tests/engine/evaluator.test.ts](tests/engine/evaluator.test.ts) | 264 |
| [tests/engine/evaluator-conditions.test.ts](tests/engine/evaluator-conditions.test.ts) | 209 |
| [tests/engine/parser.test.ts](tests/engine/parser.test.ts) | 61 |
| [tests/engine/conditions.test.ts](tests/engine/conditions.test.ts) | 51 |
| [tests/engine/effects.test.ts](tests/engine/effects.test.ts) | 48 |

#### tests/lib/ (6 files)

| File | LOC |
| --- | --- |
| [tests/lib/builder/class-features-per-level.test.ts](tests/lib/builder/class-features-per-level.test.ts) | 220 |
| [tests/lib/builder/multiclass-prereqs.test.ts](tests/lib/builder/multiclass-prereqs.test.ts) | 127 |
| [tests/lib/builder/level-up-rules.test.ts](tests/lib/builder/level-up-rules.test.ts) | 100 |
| [tests/lib/supabase/characters.test.ts](tests/lib/supabase/characters.test.ts) | 99 |
| [tests/lib/supabase/content-refs.test.ts](tests/lib/supabase/content-refs.test.ts) | 86 |
| [tests/lib/builder/use-is-mobile.test.ts](tests/lib/builder/use-is-mobile.test.ts) | 70 |
| [tests/lib/builder/class-tone.test.ts](tests/lib/builder/class-tone.test.ts) | 38 |

#### tests/schemas/ (3 files)

| File | LOC |
| --- | --- |
| [tests/schemas/content-types.test.ts](tests/schemas/content-types.test.ts) | 296 |
| [tests/schemas/effects.test.ts](tests/schemas/effects.test.ts) | 204 |
| [tests/schemas/system.test.ts](tests/schemas/system.test.ts) | 64 |

#### tests/transformers/ (5 files)

| File | LOC |
| --- | --- |
| [tests/transformers/common.test.ts](tests/transformers/common.test.ts) | 89 |
| [tests/transformers/spells.test.ts](tests/transformers/spells.test.ts) | 67 |
| [tests/transformers/races.test.ts](tests/transformers/races.test.ts) | 67 |
| [tests/transformers/equipment.test.ts](tests/transformers/equipment.test.ts) | 61 |
| [tests/transformers/classes.test.ts](tests/transformers/classes.test.ts) | 55 |

These import `@/scripts/transformers/...`, so `scripts/` is partially covered by tests despite being out-of-app.

#### Other domain dirs

| Dir | Files | Notable |
| --- | --- | --- |
| tests/inventory/ | 3 | helpers (157), armor-effects (74), rarity-colors (40) |
| tests/spells/ | 2 | helpers (237) — has TS errors, multiclass-slots (39) |
| tests/resources/ | 1 | helpers (318) — has TS errors |
| tests/rest/ | 1 | helpers (161) |
| tests/supabase/ | 4 | inventory (134), spells (132), errors (96), feedback (89) |
| tests/auth/ | 2 | callback-route (66), is-admin (56) |
| tests/character/ | 1 | max-hp (240) |
| tests/sheet/ | 1 | update-state (49) |
| tests/utils/ | 1 | character-helpers (144) — actually tests `lib/sheet/helpers.ts` |
| tests/app/ | 1 | characters-new-actions (126) |

### A.3 Coverage gaps

`lib/` modules **with no matching test file**:

| Module | Reason it's a gap |
| --- | --- |
| [lib/character/character-context.tsx](lib/character/character-context.tsx) | 627 LOC React provider, the canonical client-side state hub. Untested. |
| [lib/engine/sandbox.ts](lib/engine/sandbox.ts) | Effect-expression sandbox helper. No direct test. |
| [lib/inventory/helpers.ts](lib/inventory/helpers.ts) | Has a test, but [lib/inventory/armor-effects.ts](lib/inventory/armor-effects.ts) and [lib/inventory/rarity-colors.ts](lib/inventory/rarity-colors.ts) are tested — `helpers.ts` itself is the only one of the three covered. |
| [lib/supabase/server.ts](lib/supabase/server.ts) / [middleware.ts](lib/supabase/middleware.ts) / [client.ts](lib/supabase/client.ts) / [storage.ts](lib/supabase/storage.ts) | Auth + I/O glue. No tests. |
| [lib/types/*](lib/types/) (10 files) | Type-only. No runtime to cover. |

`components/` directories with **zero** tests anywhere:

- [components/character/](components/character/) (4 files: character-page-client, character-shell, narrative-panel, sheet-panel)
- [components/editor/](components/editor/) (4 files including 211-LOC rich-text-editor)
- [components/error/](components/error/), [components/feedback/](components/feedback/)
- [components/landing/](components/landing/), [components/nav/](components/nav/) (4 files), [components/settings/](components/settings/) (6 files)
- [components/narrative/edit/](components/narrative/edit/) (5 forms), [components/narrative/view/](components/narrative/view/) (5 cards), [components/narrative/character-portrait.tsx](components/narrative/character-portrait.tsx) (325 LOC), [narrative-tab.tsx](components/narrative/narrative-tab.tsx) (318 LOC)
- [components/sheet/spells/](components/sheet/spells/) (6 files including 343-LOC add-spell-panel) — only the parent `tests/components/sheet/spells-tab.test.tsx` exists
- [components/sheet/inventory/](components/sheet/inventory/) (7 files) — only `add-item-panel` and parent `inventory-tab` covered
- [components/builder/asi-selector.tsx](components/builder/asi-selector.tsx), [content-browser.tsx](components/builder/content-browser.tsx), [content-preview.tsx](components/builder/content-preview.tsx) (423 LOC), [subclass-selector.tsx](components/builder/subclass-selector.tsx)
- [components/ui/*](components/ui/) (16 shadcn primitives, untested)

App/server-action gaps:

- All 5 builder server pages and their step-clients except indirectly via `class-step-rail`/`class-preview-modal` mounting them.
- [app/(app)/admin/*](app/(app)/admin/) — three admin clients (errors 246, users 205, feedback 204 LOC) all untested.
- [app/(app)/characters/[id]/narrative-actions.ts](app/(app)/characters/[id]/narrative-actions.ts) — 240 LOC of server actions, untested. Only `characters/new/actions.ts` has a server-action test.
- [app/(auth)/](app/(auth)/) — only the callback route is tested ([tests/auth/callback-route.test.ts](tests/auth/callback-route.test.ts)). Login/signup/forgot-password/reset-password pages are untested.

### A.4 Known broken / skipped tests

No `it.skip`, `it.todo`, `describe.skip`, `test.only`, or `it.only` exist anywhere in `tests/` (clean grep). No `// FIXME` / `// XXX` either.

`npm test` → **579/579 green in 11.84 s.** Tests pass at runtime; Vitest's transform is permissive.

`npx tsc --noEmit` → **30 errors across 6 test files.** These are the type-only failures the user already knows about, summarised:

| File | Error count | Cause |
| --- | --- | --- |
| [tests/resources/helpers.test.ts](tests/resources/helpers.test.ts) | 17 | Test fixtures construct `content_definitions` rows without the `effects: Effect[]` field that `ContentRefWithContent` now requires. |
| [tests/engine/evaluator-conditions.test.ts](tests/engine/evaluator-conditions.test.ts) | 6 | Fixtures pass `abbreviation` to `AbilityScoreDefinition`; the type no longer has that property. |
| [tests/spells/helpers.test.ts](tests/spells/helpers.test.ts) | 4 | Same effects-field omission pattern as `resources/helpers`. |
| [tests/components/sheet/inventory-tab.test.tsx](tests/components/sheet/inventory-tab.test.tsx) | 1 | Imports `CharacterContextValue` which is no longer exported by [lib/character/character-context.tsx](lib/character/character-context.tsx). |
| [tests/components/sheet/rest-dialog.test.tsx](tests/components/sheet/rest-dialog.test.tsx) | 1 | `'overrides' is referenced directly or indirectly in its own type annotation` — circular type inference from a test helper. |
| [tests/components/sheet/spells-tab.test.tsx](tests/components/sheet/spells-tab.test.tsx) | 1 | Same circular `overrides` pattern. |

Workarounds in tests:
- [tests/components/sheet/inventory-tab.test.tsx:19,31](tests/components/sheet/inventory-tab.test.tsx) — `as unknown as CharacterContextValue["character"|"evalResult"]`.
- [tests/spells/helpers.test.ts:149](tests/spells/helpers.test.ts) — `type: null as unknown as "full"`.
- [tests/components/narrative/use-narrative-editor.test.ts:27](tests/components/narrative/use-narrative-editor.test.ts) — `as unknown as CharacterWithSystem`.

## Part B — Tech debt + refactor candidates

### B.1 Large files (>500 LOC)

Top 10 by line count across `app/`, `components/`, `lib/`. Anything ≥ 400 LOC included for context.

| LOC | File | One-liner |
| --- | --- | --- |
| 933 | [lib/supabase/database.types.ts](lib/supabase/database.types.ts) | Generated Supabase types. Auto-generated; not a refactor target but worth excluding from any general "large file" sweep. |
| 627 | [lib/character/character-context.tsx](lib/character/character-context.tsx) | Client-side character provider — owns derived state, persistence, optimistic mutations. **No test.** Candidate: split orchestration vs. derivation. |
| 587 | [components/builder/class-step-rail/index.tsx](components/builder/class-step-rail/index.tsx) | Hub component for the level-rail UI, threading 20+ props into ~20 sibling components in same dir. Candidate: extract derivation hooks. |
| 550 | [tests/components/builder/class-preview-modal.test.tsx](tests/components/builder/class-preview-modal.test.tsx) | Test file (informational). |
| 545 | [app/(app)/characters/[id]/builder/race/race-step-client.tsx](app/(app)/characters/[id]/builder/race/race-step-client.tsx) | Race step client; 5 distinct `from("characters")` writes + 4 `character_content_refs` writes inline. Candidate: extract per-action helpers. |
| 448 | [app/(app)/characters/[id]/builder/abilities/abilities-step-client.tsx](app/(app)/characters/[id]/builder/abilities/abilities-step-client.tsx) | Abilities step client. Same step-client pattern as race/class. |
| 441 | [app/(app)/characters/[id]/builder/class/class-step-client.tsx](app/(app)/characters/[id]/builder/class/class-step-client.tsx) | Class step client; **9** inline `from("characters")` writes (highest in the codebase). Candidate: clear duplication target. |
| 427 | [app/(app)/characters/[id]/builder/background/background-step-client.tsx](app/(app)/characters/[id]/builder/background/background-step-client.tsx) | Background step client. |
| 423 | [components/builder/content-preview.tsx](components/builder/content-preview.tsx) | Generic content card preview. **No test.** |
| 362 | [lib/engine/evaluator.ts](lib/engine/evaluator.ts) | Effect evaluator core. Tested. |
| 343 | [components/sheet/spells/add-spell-panel.tsx](components/sheet/spells/add-spell-panel.tsx) | Sheet add-spell flow. **No test.** |
| 325 | [components/narrative/character-portrait.tsx](components/narrative/character-portrait.tsx) | Portrait crop/upload UI. **No test.** |
| 318 | [components/narrative/narrative-tab.tsx](components/narrative/narrative-tab.tsx) | Narrative tab shell. **No test.** |
| 308 | [components/narrative/use-narrative-editor.ts](components/narrative/use-narrative-editor.ts) | Tiptap-based editor hook. Tested (75-LOC test). |
| 273 | [lib/engine/parser.ts](lib/engine/parser.ts) | Expression parser. Tested. |

For the `class-step-rail/` subdirectory, the 21 sibling files total 2 458 LOC (`index.tsx` is 24 % of that).

### B.2 TODO/FIXME/HACK comments

Codebase is unusually clean here. Total 2 hits, both in `scripts/`:

| Location | Note |
| --- | --- |
| [scripts/transformers/classes.ts:149](scripts/transformers/classes.ts) | `// TODO: attacks array is MPMB-seeded via SQL migration 00013_mpmb_class_enrichment.sql` |
| [scripts/transformers/features.ts:14](scripts/transformers/features.ts) | `// TODO: Phase 1 mechanical fields (action, usages, recovery, additional, speed, ...)` |

No `FIXME`, `XXX`, or `HACK` markers anywhere in `app`, `components`, `lib`, `tests`, or `scripts`.

### B.3 Type-system escape hatches

#### `as unknown as` (raw escape — 8 occurrences in source, 4 in tests)

| Location | Context |
| --- | --- |
| [app/(app)/dashboard/page.tsx:66](app/(app)/dashboard/page.tsx) | `character.game_systems as unknown as { name: string }[] \| { name: string } \| null` — Supabase relation typing. |
| [app/(app)/characters/[id]/builder/class/class-step-client.tsx:70](app/(app)/characters/[id]/builder/class/class-step-client.tsx) | `(character as unknown as { campaigns?: { hp_rule?: HpRule \| null } \| null }).campaigns?.hp_rule` |
| [app/(app)/characters/[id]/builder/class/class-step-client.tsx:71](app/(app)/characters/[id]/builder/class/class-step-client.tsx) | `(schema as unknown as { hp_rule?: HpRule } \| undefined)?.hp_rule` |
| [tests/components/sheet/inventory-tab.test.tsx:19,31](tests/components/sheet/inventory-tab.test.tsx) | Two casts to bypass `CharacterContextValue` type drift. |
| [tests/spells/helpers.test.ts:149](tests/spells/helpers.test.ts) | `null as unknown as "full"`. |
| [tests/components/narrative/use-narrative-editor.test.ts:27](tests/components/narrative/use-narrative-editor.test.ts) | Cast to `CharacterWithSystem`. |

#### `eslint-disable` (3 occurrences, all single-line)

| Location | Rule |
| --- | --- |
| [app/(app)/characters/[id]/narrative-actions.ts:121](app/(app)/characters/[id]/narrative-actions.ts) | `@typescript-eslint/no-explicit-any` — `(character.choices as Record<string, any>) ?? {}` |
| [components/builder/class-preview-modal.tsx:49](components/builder/class-preview-modal.tsx) | `react-hooks/set-state-in-effect, react-hooks/exhaustive-deps` (block disable) |
| [components/editor/rich-text-editor.tsx:195](components/editor/rich-text-editor.tsx) | `react-hooks/exhaustive-deps` |

#### `@ts-ignore` / `@ts-expect-error`

Zero occurrences. The codebase routes around the type-checker via `as unknown as` and `Record<string, unknown>` instead.

#### `: any` (precise type annotation)

Zero occurrences. The single `any` reference (above) is `Record<string, any>` cast inside a server action.

### B.4 Duplication candidates

| Pattern | Scatter | Why it's a candidate |
| --- | --- | --- |
| `await supabase.from("characters").update({ ... }).eq("id", characterId)` followed by `router.refresh()` | **21 occurrences** across 5 builder step-clients ([class:9](app/(app)/characters/[id]/builder/class/class-step-client.tsx), [race:5](app/(app)/characters/[id]/builder/race/race-step-client.tsx), [background:4](app/(app)/characters/[id]/builder/background/background-step-client.tsx), [equipment:2](app/(app)/characters/[id]/builder/equipment/equipment-step-client.tsx), [abilities:1](app/(app)/characters/[id]/builder/abilities/abilities-step-client.tsx)). | Same read-merge-write to `characters.choices` ± `level`, with hand-rolled local-state mirroring. Already has a server-side helper (`update-state.ts` + `00031` RPC) but the builder ignores it. |
| `setLocalChoices({ ...localChoices, ... })` mirroring the persisted value | 18 hits across the same 5 step-clients (4 files matched, 13 in Grep with extra trivia). | Optimistic update boilerplate. |
| `await supabase.from("character_content_refs").insert([{...}])` (and matching `.delete().eq("id", oldRef.id)`) | 11 inline writes in client step files; 5 properly wrapped helpers in [lib/supabase/content-refs.ts](lib/supabase/content-refs.ts). | The helper exists; the clients aren't using it. Race/class steps keep redoing it inline. |
| `find((c) => c.slug === ...)` lookups against arrays of `ContentEntry` | **18 hits** across builder rail, builder step-clients, sheet panels, lib helpers. Top files: [components/builder/class-step-rail/index.tsx](components/builder/class-step-rail/index.tsx) (8), [class-step-client.tsx](app/(app)/characters/[id]/builder/class/class-step-client.tsx) (3), [content-preview.tsx](components/builder/content-preview.tsx) (2). | A `bySlug` map built once would replace the linear scan. Same shape every time. |
| `find((sc) => sc.slug === cls.subclass)` (subclass lookup) | 4 nearly-identical occurrences in [class-step-rail/index.tsx](components/builder/class-step-rail/index.tsx) lines 156, 263, 413, 489. | Could be a single utility. |
| `(x.data as Record<string, unknown>).field as T` — read JSONB shape and cast | 30+ occurrences across builder step-clients, class-preview-modal, class-step-rail, sheet panels (sample at B.5). | Each call site reinvents narrowing for the same `content_definitions.data` blob. |
| `console.log("[scope] ...")` instrumentation in server actions | 13 in [narrative-actions.ts](app/(app)/characters/[id]/narrative-actions.ts), 11 in [class-step-client](app/(app)/characters/[id]/builder/class/class-step-client.tsx)-adjacent files, 81 total across `app + components + lib`. | No structured logger; raw `console.*` even in production-shipped server actions. |

### B.5 Loose-type clusters

`Record<string, unknown>` usages — 64+ matches. The hot paths:

| Theme | Files | Notes |
| --- | --- | --- |
| `content_definitions.data` shape | [class-step-rail/index.tsx:279,429,502,512](components/builder/class-step-rail/index.tsx); [class-step-rail/level-up-pane.tsx:47,64](components/builder/class-step-rail/level-up-pane.tsx); [class-step-rail/class-picker-card.tsx:15,24](components/builder/class-step-rail/class-picker-card.tsx); [class-step-rail/feature-card.tsx:8](components/builder/class-step-rail/feature-card.tsx); [class-step-rail/choice-card-subclass.tsx:23,47](components/builder/class-step-rail/choice-card-subclass.tsx); [class-step-rail/choice-card-fighting-style.tsx:43](components/builder/class-step-rail/choice-card-fighting-style.tsx); [class-preview-modal/*-tab.tsx](components/builder/class-preview-modal/) (overview/features/spells/subclasses); [lib/builder/class-features-per-level.ts:38,41,70](lib/builder/class-features-per-level.ts); [lib/resources/helpers.ts:64](lib/resources/helpers.ts); [lib/supabase/spells.ts:97](lib/supabase/spells.ts); [lib/supabase/inventory.ts:104](lib/supabase/inventory.ts); [lib/supabase/content-refs.ts:10,104](lib/supabase/content-refs.ts) | The "real" type lives in [lib/schemas/content-types/](lib/schemas/content-types/) (18 zod schemas — class.ts 70 LOC, feature.ts 103 LOC) but call sites cast from Postgres JSONB and don't validate. |
| `effects[].context` | [lib/types/character.ts:116](lib/types/character.ts), [lib/types/system.ts:85](lib/types/system.ts) (`expression_context: Record<string, unknown>`), and downstream evaluator state (`lib/engine/evaluator.ts:185`, `lib/engine/conditions.ts:11`, `lib/engine/sandbox.ts:17`). | Engine's contract with the rest of the app is `Record<string, unknown>` end-to-end. |
| `custom_data` on inventory/spells | [lib/types/inventory.ts:12](lib/types/inventory.ts), [lib/types/spells.ts:16,90](lib/types/spells.ts), [lib/character/character-context.tsx:69](lib/character/character-context.tsx), [components/sheet/inventory/custom-item-form.tsx:13,38](components/sheet/inventory/custom-item-form.tsx), [components/sheet/inventory/add-item-panel.tsx:43](components/sheet/inventory/add-item-panel.tsx). | Per-character JSONB overrides with no schema. |
| `effects: Array<Record<string, unknown>>` | [lib/types/inventory.ts:20](lib/types/inventory.ts), [lib/types/spells.ts:24](lib/types/spells.ts), [lib/supabase/inventory.ts:105](lib/supabase/inventory.ts), [components/sheet/inventory/item-detail-card.tsx:15](components/sheet/inventory/item-detail-card.tsx). | The `Effect` zod schema is in [lib/schemas/effects.ts](lib/schemas/effects.ts) but inventory/spells flatten back to `Record<string, unknown>` at the boundary — contributes directly to the test fixture errors in §A.4. |

### B.6 Migration list

34 SQL migrations. All numbered `00001` – `00036` with two gaps (no `00027`, no `00028`).

| # | File | Subject |
| --- | --- | --- |
| 00001 | [profiles.sql](supabase/migrations/00001_profiles.sql) | `profiles` table + auth.users trigger |
| 00002 | [game_systems.sql](supabase/migrations/00002_game_systems.sql) | `game_systems` registry |
| 00003 | [content.sql](supabase/migrations/00003_content.sql) | `content_definitions` (the JSONB content blob) |
| 00004 | [campaigns.sql](supabase/migrations/00004_campaigns.sql) | `campaigns` |
| 00005 | [homebrew_sharing.sql](supabase/migrations/00005_homebrew_sharing.sql) | `custom_content_types` for homebrew |
| 00006 | [rls_policies.sql](supabase/migrations/00006_rls_policies.sql) | RLS rollout across earlier tables |
| 00007 | [character_builder.sql](supabase/migrations/00007_character_builder.sql) | Builder columns on `characters` |
| 00008 | [profile_preferences.sql](supabase/migrations/00008_profile_preferences.sql) | `profiles.preferences` JSONB |
| 00009 | [narrative_tools.sql](supabase/migrations/00009_narrative_tools.sql) | Narrative columns + `npcs` table |
| 00010 | [feature_types.sql](supabase/migrations/00010_feature_types.sql) | `feature_type` taxonomy |
| 00011 | [race_enrichment.sql](supabase/migrations/00011_race_enrichment.sql) | MPMB race data backfill |
| 00012 | [feature_enrichment.sql](supabase/migrations/00012_feature_enrichment.sql) | MPMB feature data backfill |
| 00013 | [class_enrichment.sql](supabase/migrations/00013_class_enrichment.sql) | Attacks/improvements arrays |
| 00014 | [spellcasting_enrichment.sql](supabase/migrations/00014_spellcasting_enrichment.sql) | Spellcasting known/list/prepared |
| 00015 | [cantrip_scaling.sql](supabase/migrations/00015_cantrip_scaling.sql) | Cantrip die + descriptions |
| 00016 | [feat_enrichment.sql](supabase/migrations/00016_feat_enrichment.sql) | Feat (Grappler) enrichment |
| 00017 | [background_enrichment.sql](supabase/migrations/00017_background_enrichment.sql) | Backgrounds (skills, langs, equipment) |
| 00018 | [class_detail_enrichment.sql](supabase/migrations/00018_class_detail_enrichment.sql) | Class details (primaryAbility, equipment, profs) |
| 00019 | [monk_choice_fix.sql](supabase/migrations/00019_monk_choice_fix.sql) | Monk proficiency choice patch |
| 00020 | [class_descriptions.sql](supabase/migrations/00020_class_descriptions.sql) | Class flavor text |
| 00021 | [fighting_style_effects.sql](supabase/migrations/00021_fighting_style_effects.sql) | Fighting-style mechanical effects |
| 00022 | [feature_effects.sql](supabase/migrations/00022_feature_effects.sql) | Feature effects rollout |
| 00023 | [remove_details_step.sql](supabase/migrations/00023_remove_details_step.sql) | Drop "Character Details" builder step |
| 00024 | [storage_policies.sql](supabase/migrations/00024_storage_policies.sql) | Portrait bucket RLS |
| 00025 | [character_inventory.sql](supabase/migrations/00025_character_inventory.sql) | `character_inventory` table |
| 00026 | [magic_item_enrichment.sql](supabase/migrations/00026_magic_item_enrichment.sql) | Magic items: attunement, effects |
| 00029 | [character_spells.sql](supabase/migrations/00029_character_spells.sql) | `character_spells` table |
| 00030 | [spellcasting_fixes.sql](supabase/migrations/00030_spellcasting_fixes.sql) | Ritual flag + subclass spellcasting extras |
| 00031 | [patch_character_state_rpc.sql](supabase/migrations/00031_patch_character_state_rpc.sql) | Atomic JSONB shallow-merge RPC for `characters.state` |
| 00032 | [feedback_table.sql](supabase/migrations/00032_feedback_table.sql) | Alpha feedback table |
| 00033 | [app_errors_table.sql](supabase/migrations/00033_app_errors_table.sql) | Self-hosted error capture |
| 00034 | [feature_resource_data_enrichment.sql](supabase/migrations/00034_feature_resource_data_enrichment.sql) | Resource data round 1 |
| 00035 | [feature_resource_data_enrichment_2.sql](supabase/migrations/00035_feature_resource_data_enrichment_2.sql) | Resource data round 2 |
| 00036 | [campaigns_hp_rule.sql](supabase/migrations/00036_campaigns_hp_rule.sql) | Per-campaign HP rule override |

Numbering gaps at 27 and 28 — drop or renamed migrations not in current tree.

## Part C — Quick stats

### LOC totals

| Tree | LOC | Files |
| --- | --- | --- |
| `app/` | 5 691 | 45 |
| `components/` | 13 886 | 130 |
| `lib/` | 6 000 | 64 |
| `tests/` | 8 330 | 52 (1 setup + 51 test files) |
| **Total source** (`app+components+lib`) | **25 577** | **239** |
| `scripts/` | 1 105 | 13 |
| `supabase/migrations/` | n/a | 34 SQL |

### Coverage ratio

- Source files: 239 (`app + components + lib`)
- Test files: 51
- Ratio: **0.21 tests per source file** (one test file per ~4.7 source files)
- 579 passing tests over those 51 files → ~11 tests per test file on average.

### Component count

130 React components in [components/](components/) across 13 subdirectories (alpha, builder, character, characters, editor, error, feedback, landing, narrative, nav, settings, sheet, ui). 16 are unstyled `components/ui/` shadcn primitives.

### Big-rock concentration

| Slice | LOC | % of source |
| --- | --- | --- |
| 5 builder step-clients | 2 062 | 8.1 % |
| `class-step-rail/` (21 files) | 2 458 | 9.6 % |
| `narrative/` (12 files) | 1 595 | 6.2 % |
| `database.types.ts` (generated) | 933 | 3.6 % |
| `character-context.tsx` | 627 | 2.5 % |
