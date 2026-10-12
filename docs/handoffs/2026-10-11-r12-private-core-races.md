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

**Browser passed:** after independent approval and root's exclusive UI-slot release, ran the isolated command on the unchanged approved source:

```text
npm.cmd run test:e2e -- --config e2e/local-races/playwright.config.ts
```

Result: **1 Playwright test / 16 behavioral checks passed** (5.5 seconds), installed Chrome, desktop 1280x900 and mobile 390x844. Each viewport verified fractional-speed rejection through the real mapper, pending duplicate-submit prevention and finite named controls, retained drafts/accessibly named validation errors, recoverable error/retry, canonical definition/snapshot parsing through the live evaluator and actual StatPreview, stale-edit lock/reload, latest expected-version submission, and legacy speed disabled/omitted from metadata submission. `pageErrors` and `blockedRemoteRequests` were empty.

Inspected all four preserved screenshots: `test-results/races-local/{desktop,mobile}-{validation,conflict}.png`. Retained values, errors, explicit reload, disabled stale submit and responsive button layout are visible and readable without horizontal clipping. CSS was compiled from the existing globals by the helper, not obtained from a production Next build; final combined-build styling remains root's gate. The preserved `test-results/races-local/evidence.json` records the simulated boundary and process/port receipts; generated fixture/screenshots remain in this worker.

Process receipt (2026-10-12 UTC): Playwright worker PID 43832, parent 49108, start 02:03:25.423; helper/server PID 58044, parent 43832, start 02:03:27.032, command `node scripts/verify-races-local.mjs`, this worktree, listening port 58857. Installed headless Chrome PID 32200, parent 58044, start 02:03:27.033, task profile `playwright_chromiumdev_profile-2KsYhS`; helper control port 58858. Before launch no suitable race worker/browser/server existed. After completion, exact PID/profile inspection found no remaining task processes and Windows listening-port inspection found neither port. The helper's own close checks both passed. No unrelated process was stopped. No production source fix was required by this browser run.

`scripts/verify-races-local.mjs` uses real form controls/mapper/StatPreview and canonical synthetic pins; actions, saves, summaries and conflicts are simulated. This proves isolated browser interaction/recovery and bounded parser/consumer parity, not Next authentication/routing, real database persistence, concurrent PostgreSQL CAS, RLS, snapshot triggers or hosted character selection.

No full check/build was authorized in this sibling; root owns combined gates and independent exact-SHA review. No live Supabase credentials, remote actions, SQL or migrations were used. Mock DAL tests do not establish real PostgreSQL/RLS/CAS/snapshot-trigger behavior. Remaining children must separately resolve scores/R06 parity, exact trait/subrace owner/system/entitlement/version validation and atomic graph pinning, advanced consumer mechanics, import and sharing.
