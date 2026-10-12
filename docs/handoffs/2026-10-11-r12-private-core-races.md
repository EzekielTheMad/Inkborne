# R12.4 bounded private race core authoring

Source checkpoint: `bf3bfe353dec88b9cf6a1a608de83d1e737aa773` on `codex/r12-private-race`, isolated workspace `C:\Users\kaios\Documents\Codex\2026-10-11\task-2\r12-race-worker`. Base: `edac6d7942c9152e60d7c462468b1a694bf979a4`; independently challenged plan: `3090f91154e2f457839f3136114382fcc3320edd`. This is the first bounded child, not complete species/R12 acceptance.

## Delivered scope and invariants

- Private create/edit routes, real `RaceForm`, finite mapper, authenticated owner-scoped DAL/actions, and Homebrew discovery/list. Controls are name, canonical size metadata, positive safe-integer walking speed, and the four existing description fields. New controls start blank; descriptions do not grant languages or mechanics.
- Creation derives the personal/homebrew/race envelope, synchronized flat/walking data and one numeric walking effect. Published canonical system resolution uses `.single()`. Reads/writes filter owner, system, type, source, scope and active row; edits also require the expected version. A CAS conflict performs one constrained identity/version reread and no retry. Browser authority, effects, raw metadata and eligibility flags are ignored.
- `_inkborne_race_core` and `inkborne:race-core:v1:walking-speed` form a **validated editing annotation**, not proof of provenance or authorization. Owners with DML access can alter JSON. Eligibility comes only from the authenticated expected-version row: exact version/tag/target/op/numeric payload, strict raw fields, one matching entry, matching flat/walk values, and no competing movement target.
- Eligible edits replace that effect at its original array position. Metadata-only legacy/altered/duplicate/competing edits omit effects from UPDATE. Both paths preserve original unedited raw JSON, nested movement extensions, relationship arrays, scores and unrelated/manual effect fields. Known canonical data is validated without serializing stripped parser output. No guessed adoption, effect deduplication or migration occurs.
- Native form reset preserves drafts after errors. Pending submission is blocked; stale conflicts lock resubmission until an explicit latest-version reload. Existing IDs/slugs and supplied historical snapshots remain stable.
- Size stays metadata. Ability bonuses, trait/subrace/language grants, advanced movement, sharing, dependency authoring and exact dependency-graph selection are disclosed as outside this child. Existing imported calculation/pinning limitations are retained. No provider/evaluator/schema/SQL/dependency/runtime changes.

## Narrow verification

Executed sequentially after root released the resource slot:

```text
npm.cmd ci --ignore-scripts
npm.cmd test -- --maxWorkers=2 tests/lib/homebrew/race-authoring.test.ts tests/lib/homebrew/race-form.test.ts tests/components/library/race-form.test.tsx tests/components/library/race-core-parity.test.tsx tests/supabase/homebrew-races-server.test.ts tests/app/homebrew-race-actions.test.ts tests/app/homebrew-race-pages.test.tsx tests/app/homebrew-page.test.tsx
npm.cmd run typecheck
npm.cmd run lint
git diff --cached --check
```

Install: 800 packages, no lockfile/dependency edits. Final focused run: **8 files / 82 tests passed** (6.95 seconds); typecheck, lint and whitespace check passed. An initial test setup run found two test-fixture errors (parenthesized expectation and Vite URL filesystem handling); both were corrected before the recorded pass. No application failure was hidden.

Meaningful consumer negative control: using the actual canonical 2014 seed definition and parsed synthetic immutable race pin, `effects: []` gives structured `speed.walk = 40` while live `computed.movement_speed` and the actual `StatPreview` remain 30. The isolated derived walking effect makes all three 40. A supplied parsed v1 pin remains 40 after synthetic latest content advances to v2/55. This proves the bounded parser/source/evaluator/preview contract; it does not prove a database snapshot trigger or hosted selection workflow. The separate R06 score/enrichment overlap still requires its actual parsed-pin reproduction.

## Browser and remaining acceptance

**Browser pending:** root held this slot while R21 used Chrome. No race server, watcher or browser has been started. Prepared isolated command:

```text
npm.cmd run test:e2e -- --config e2e/local-races/playwright.config.ts
```

`scripts/verify-races-local.mjs` uses the real form/mapper/StatPreview with simulated actions and canonical synthetic pins, blocks remote page requests, and records desktop/mobile screenshots, process metadata, ports and cleanup in `test-results/races-local`. Until this command runs and its screenshots/cleanup are inspected, the form browser workflow is unverified.

No full check/build was authorized in this sibling; root owns combined gates and independent exact-SHA review. No live Supabase credentials, remote actions, SQL or migrations were used. Mock DAL tests do not establish real PostgreSQL/RLS/CAS/snapshot-trigger behavior. Remaining children must separately resolve scores/R06 parity, exact trait/subrace owner/system/entitlement/version validation and atomic graph pinning, advanced consumer mechanics, import and sharing.
