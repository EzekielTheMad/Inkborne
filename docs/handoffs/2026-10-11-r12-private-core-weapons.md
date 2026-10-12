# R12.2 private core weapon authoring

Source checkpoint: `40ca7d4561b1d2f034c7fa94acd16d1eb66aa47c`, following implementation `4a3873c464c0e8c6056c9e6f2e40c62a93f602a6` on base `40f13abcc87c5973d9beb8dfc4b19e4df8155049`. Branch: `codex/r12-private-weapon`. Isolated workspace: `C:\Users\kaios\Documents\Codex\2026-10-11\task-2\r12-weapon-worker`.

The finite form authors canonical weapon category/range, cost/weight, nested damage, range distances, known properties, and optional two-handed damage. Creation requires a parser-valid damage expression and an actual damage type; it never invents missing damage. Ranged/thrown weapons require positive normal range; long range cannot be shorter. Optional cost/weight distinguish blank from zero and accept finite scientific notation on edit reload.

Writes derive owner/system/type/source/private scope from authenticated server context. Published system resolution uses `.single()`. Editing reads the exact owned active expected-version row, then performs one expected-version CAS update. A concurrent change uses a constrained `id, version` reread without retrying an overwrite.

Metadata editing preserves existing effects, schema extensions (`ability`, `monkweapon`, `ammo`, `baseWeapon`, `source_refs`), and unknown existing property strings. The correction preserves the original persisted JSON object, including imported description/custom nested metadata, and overlays only validated core fields. Canonical validation does not serialize its stripped parser output. Raw extras remain internal and cannot be replaced by forged browser fields.

Routes/actions, Homebrew discovery/listing, mapper/form/DAL tests, and an isolated real-form browser harness are included. Character snapshots, inventory, evaluators, print helpers, schemas, migrations, dependencies, and provider state were not changed.

## Validation

- `npm.cmd ci --ignore-scripts` installed the existing lockfile; dependency audit reported 24 baseline vulnerabilities. No dependency mutation was attempted.
- `npm.cmd test -- tests/lib/homebrew/weapon-form.test.ts tests/components/library/weapon-form.test.tsx tests/supabase/homebrew-weapons-server.test.ts tests/app/homebrew-weapon-actions.test.ts tests/app/homebrew-weapon-pages.test.tsx tests/app/homebrew-page.test.tsx`: 6 files / 57 tests passed at the implementation checkpoint.
- After the persistence correction, `npm.cmd test -- tests/supabase/homebrew-weapons-server.test.ts tests/lib/homebrew/weapon-form.test.ts`: 2 files / 38 tests passed, including raw description/custom metadata preservation with the real mapper and forged replacement controls.
- `npm.cmd run typecheck`: passed after the correction.
- `npm.cmd run lint`: blocked only by inherited `components/sheet/character-print-action.tsx:42` ref-cleanup warning. Root separately fixed this in `3bfc90b`; that fix is not present in this isolated worker. No weapon-file lint findings were reported.
- `npm.cmd run test:e2e -- --config e2e/local-weapons/playwright.config.ts`: 1 test / 14 desktop and mobile checks passed. The real WeaponForm and mapper ran; actions/saved summaries were simulated and remote requests were blocked. Checks cover invalid damage, pending submission, native-reset draft retention, retry, stale conflict, latest-version reload, and tiny persisted numeric values.
- `git diff --check`: passed.

The offline browser evidence is in `test-results/weapons-local/evidence.json` and four `desktop/mobile-validation/conflict.png` screenshots, preserved in the worker. Screenshots were visually inspected. The run used compiled application globals; the harness prefers production CSS if a combined build is present. Server PID `47044`, Chrome PID `47260`, worker PID `28448`, and parent PID `41344` were recorded. Server/control ports `63521` and `63522` were verified closed; server/Chrome processes exited. No task-owned development server remains.

## Acceptance still required

Actual Supabase owner/RLS denial, immutable version-trigger behavior, two-account/two-session concurrency, Library-to-character inventory discovery, and character pins after editing remain unverified. Offline mocks/parser tests do not establish those database behaviors. Root owns independent review, integration, combined check/build, and production-CSS comparison.

This is a bounded core child of R12. Ability overrides, monk-weapon flags, ammunition identifiers, base weapons, source references, and effects are preserved on existing records but are not exposed as creation controls. Sharing extensions and full R12 completion remain open. No live SQL, migrations, credentials, default hosted E2E, remote writes, push, or deployment occurred.
