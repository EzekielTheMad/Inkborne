# R12.3 private armor authoring

Source checkpoint: `c0ae7b1449afd3b6b36e52964d0d3e14c167686e`, based on `d17d0216e596d7a19a5db7314a58c7c8c6f8357b`. Branch: `codex/r12-private-armor`. Isolated workspace: `C:\Users\kaios\Documents\Codex\2026-10-11\task-2\r12-armor-worker`.

The form authors the existing armor schema: category, cost/weight, nested `armor_class` (`base`, `dex_bonus`, nullable `max_bonus`), `str_minimum`, and `stealth_disadvantage`. It accepts finite nonnegative numeric values within safe-number bounds and requires whole numbers for AC, Dexterity caps, and Strength. Empty cost/weight/cap remain null; blank Strength becomes the canonical zero. Explicit zero survives. Required base AC has no invented default. Decimal scientific notation supports tiny persisted cost/weight values when editing.

Server actions derive the private envelope from authenticated context. Published system resolution uses `.single()`. Owned reads and expected-version CAS writes retain owner/system/type/homebrew/personal/active filters. Editing first reads the exact expected-version row, preserves its original raw JSON and existing effects, and overlays only validated controls. Top-level imported lore/custom metadata and unknown nested `armor_class`/non-null cost metadata survive. Clearing nullable cost deliberately clears its whole cost object. Canonical validation does not serialize stripped parser output. Conflict detection uses a constrained `id, version` reread and never retries an overwrite.

Create/edit routes and Homebrew discovery/listing are included. Typed form records exclude raw extras; forged browser authority, raw objects, effects, lore, and metadata controls cannot replace stored originals. Existing inventory pins and snapshots are not rewritten.

## Validation at this checkpoint

- `npm.cmd ci --ignore-scripts`: existing lockfile installed, 800 packages / 35 seconds; 24 baseline audit findings, no dependency edits. Root owns its separate final lockfile/security changes.
- `npm.cmd test -- tests/lib/homebrew/armor-form.test.ts tests/components/library/armor-form.test.tsx tests/supabase/homebrew-armors-server.test.ts tests/app/homebrew-armor-actions.test.ts tests/app/homebrew-armor-pages.test.tsx tests/app/homebrew-page.test.tsx tests/inventory/armor-effects.test.ts`: 7 files / 59 tests passed.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run test:e2e -- --config e2e/local-armors/playwright.config.ts`: 1 test / 16 desktop and mobile checks passed after root released the browser slot. No source changes were needed.
- `git diff --cached --check`: passed before the source checkpoint.
- Installed Next 16.3.8 server/client and mutation documentation was read; Supabase and React skill guidance followed. No schemas, provider logic, armor helpers, dependencies, migrations, SQL, credentials, remote writes, push, or deployment changed.

The tests establish finite mapping, private query boundaries, expected-version conflict behavior, original raw metadata/effect retention, draft recovery, and canonical parser parity with the existing **body armor** helper's generated formula strings. They do not prove real database policy, trigger, evaluator, or browser-to-server persistence.

The isolated browser harness at `e2e/local-armors/playwright.config.ts` and `scripts/verify-armors-local.mjs` ran the real form/mapper with simulated persistence and blocked remote requests. Its 16 checks cover shield limitation disclosure, actual mapper rejection of fractional AC, pending submission, native-reset draft retention, recoverable save retry, stale conflict/reload, and tiny persisted cost/weight mapping. No page errors, remote requests, or horizontal overflow occurred.

Evidence remains in `test-results/armors-local/evidence.json` and all four desktop/mobile validation/conflict PNGs in that directory. All screenshots were visually inspected. Styling came from compiled application globals; the harness will prefer production CSS when a combined build exists. No Next development server was started.

Browser worker PID `54092` (parent `6840`, start `2026-10-12T01:21:35.258Z`), fixture server PID `42844` (parent `54092`, command `node scripts/verify-armors-local.mjs`, start `2026-10-12T01:21:36.682Z`, port `53775`), and Chrome PID `56412` (parent `42844`, start `2026-10-12T01:21:36.683Z`, control port `53776`) were recorded in the workspace above. The fixture/control ports were verified closed and those processes exited. Full Chrome command arguments are in the evidence receipt. Lint PID `44664` (parent `34472`, start `2026-10-12T01:18:04.545Z`) also finished; other install/test/typecheck commands completed.

## Observed consumer limitations and remaining acceptance

`lib/character/character-context.tsx:360` selects the first equipped body armor and passes that data into `generateArmorEffects`. Its shield path only sets `shield_equipped`; no numerical shield contribution is wired into the evaluated effects there. A shield helper branch by itself is not proof of working sheet shield AC. This slice does not change that provider/helper gap or claim to fix it. The form explicitly discloses the gap when Shield is selected and labels stored shield AC as a bonus.

Minimum Strength and stealth-disadvantage flags are stored armor details; this slice does not add movement or roll automation. The form states that limitation. Body helper/parser parity is narrower than full sheet AC acceptance.

Actual Supabase owner/RLS denial, immutable version triggers, two-account/two-session concurrency, Library-to-character inventory discovery, pin-after-edit behavior, full body-armor AC evaluation, and shield mechanics remain unverified. Root independently approved the source and initial handoff; root still owns integration, combined checks/build, production-CSS comparison, and later acceptance. Full R12 and sharing extensions remain open.
