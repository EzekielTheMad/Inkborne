# M1 private magic-item revalidation — October 11, 2026

## Source and ownership

- PR99 source: `4cbd70bb475d35421974851fedac2afb70480f84` (exact existing implementation; not reimplemented or integrated).
- Original `C:\Projects\Inkborne\worktrees\homebrew-magic-item-authoring` was inspected read-only and clean at that exact head.
- Isolated branch: `codex/m1-magic-item-revalidation` in `C:\Users\kaios\Documents\Codex\2026-10-11\task-2\m1-magic-item-worker`, created from that head using original Inkborne Git.
- Final tested app/harness checkpoint: `3d61ff3747dbb04da55d9fb436753e71b1596d29`. The following documentation-only commit records this handoff; it does not change tested application code. This standalone PR99-derived checkpoint is not integrated into current core.
- Work ownership: this handoff and `e2e/local-magic-items/*`, `scripts/verify-magic-items-local.mjs`. After the offline browser reproduced a draft-retention defect, the orchestrator authorized a narrow change to `components/library/magic-item-form.tsx` and its focused test. Server helpers, owner boundaries and existing migrations remain unchanged.
- Dependencies installed from the existing lockfile with `npm.cmd ci --ignore-scripts`. No environment files, credentials, hosted configuration or hosted data were accessed. Dependency audit reported 37 inherited advisories; no package changes made.

## Local contract evidence

The existing server tests confirm authentication before mutation, server-derived private magic-item envelope despite forged fields, owner/system/type/source/scope/active-row constraints on reads and edits, a version predicate on the update, and one stale update attempt followed by an identically constrained lookup returning a recoverable conflict. Existing form tests confirm finite accessible controls, version guidance, edit defaults and authored-value retention after a reset.

Existing content migration functions manage the version counter, insert complete snapshots after version changes, and reject snapshot updates. The migration tests check the SQL text and policy contracts; they do not execute PostgreSQL or prove installed trigger/grant/RLS behavior. Server tests return mocked database rows, so a version-2 response is not immutable snapshot persistence proof.

| Gate | Result | Evidence |
| --- | --- | --- |
| Magic-item mapper/server/actions/form and Homebrew page | 5 files / 25 tests passed | `..\verification\m1-focused.log` |
| Versioning migration contracts/policy contracts and Library page | 3 files / 20 tests passed | `..\verification\m1-contract-focused.log` |
| Original-source full check | TypeScript, lint and 198 files / 1,804 unit tests passed before the reproduced fix | `..\verification\m1-check.log` |
| Original-source dummy-config build | Passed before the reproduced fix | `..\verification\m1-build.log` |
| Real-action regression before fix | Failed: submitted Very Rare becomes Common after action settlement | `..\verification\m1-real-action-regression-before.log` |
| Native reset diagnosis | Cancelable event; delegated preventDefault not invoked; all option defaults unset | `..\verification\m1-reset-diagnosis.log` |
| Focused after fix | 5 files / 26 tests passed | `..\verification\m1-focused-after-fix.log` |
| Final-source full check | TypeScript, zero lint findings and 198 files / 1,805 tests passed | `..\verification\m1-check-after-fix.log` |
| Final-source dummy-config build | Passed | `..\verification\m1-build-after-fix.log` |
| Final-source real-form offline browser | 1 Playwright spec / 12 desktop/mobile checks passed; zero page errors or remote requests | `..\verification\m1-offline-ui.log`, `test-results\magic-items-local\evidence.json` |

Focused commands:

```powershell
npm.cmd test -- tests/lib/homebrew/magic-item-form.test.ts tests/supabase/homebrew-magic-items-server.test.ts tests/app/homebrew-magic-item-actions.test.ts tests/components/library/magic-item-form.test.tsx tests/app/homebrew-page.test.tsx
npm.cmd test -- tests/supabase/content-versioning-migration-contract.test.ts tests/supabase/content-version-policy-performance-contract.test.ts tests/app/library-page.test.tsx
```

The final `npm.cmd run check` contains the full unit run; no separate redundant unit suite was needed. Dummy build ran in a fresh process with only `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=ci-placeholder`, and `SUPABASE_SERVICE_ROLE_KEY=ci-placeholder`; those values are synthetic and were not saved to an environment file.

## Offline browser scope

The isolated Playwright config never imports default hosted configuration, account setup/cleanup, or environment files. The harness bundles the real `MagicItemForm`, React and UI controls with an explicitly simulated action boundary and saved-summary component. It serves only loopback fixture JS and synthetic-build CSS, aborts remote requests, and exercises desktop (1280×900) and mobile (390×844) behavior.

Checks per viewport: pending submission/finite payload; accessible validation with all drafts retained; recoverable persistence error/retry availability; successful simulated create retry; stale edit retaining its draft while disabling resubmit; explicit real reload initializing a latest-version fixture and submitting its expected version. Reload response and persistence are simulated. Homebrew/Library discovery, Server Action transport, auth, owner isolation across actual users, snapshot immutability and concurrent stale writes are not browser-verified by this harness.

The first harness run failed to resolve React from a stub namespace; the stub now supplies its real resolve directory (`m1-offline-ui-initial-harness-failure.log`). The next run reached the real form and failed because Rarity changed from submitted `Very Rare` to `Common` when an action returned validation (`m1-offline-ui-rarity-retention-failure.log`). The existing `fireEvent.reset` test merely dispatched an event and missed native reset behavior. A new test runs real `useActionState`, submits the form, and observes the actual action-settlement reset. It reproduced the same failure before a product change.

React resets an action form during its commit while delegated event handlers are suppressed; the existing React `onReset` did not prevent the cancelable native reset. Controlled select state remained authored but its native defaults were unset, allowing the DOM to return to the first rarity. The smallest fix installs a native reset listener through a stable callback ref with React 19 cleanup. It preserves the existing whole-draft policy and actual submit payload, and avoids changing persistence or content semantics.

The root orchestrator independently reviewed the minimal product/test diff and offline harness before the final gates; no blocking finding. Installed React 19.2.4 source confirms the commit suppresses delegated events and `recursivelyResetForms` calls the native form reset. The regression verifies native cancellation and retained values rather than merely repeating the new listener implementation.

After the fix, the browser log records all fields after real validation settlement at both sizes: `Lantern of Returning`, `Very Rare`, `It remembers every road home.`, `Wondrous item`, attunement checked. Mobile validation and conflict screenshots were visually inspected: readable field/summary errors and controls, no horizontal clipping. Screenshots remain under `test-results\magic-items-local\{desktop,mobile}-{validation,conflict}.png`.

Process metadata is preserved in sibling `verification\m1-{check-after-fix,build-after-fix,offline-ui-after-fix}-process.json`, the browser log and `evidence.json`. Final Playwright worker PID 35336 (parent 30596), harness PID 33652 (parent 35336), and headless Chrome PID 13320 (parent 33652) finished. Fixture port 52168 and loopback browser control port 52170 both refused connections after nested browser/server cleanup. Fresh OS inspection confirmed all three PIDs absent and both listeners closed (`..\verification\m1-cleanup.json`). No task-owned server/browser process remains.

```powershell
npm.cmd run test:e2e -- --config e2e/local-magic-items/playwright.config.ts
```

## Remaining acceptance and authority

Actual two-owner isolation, v1 snapshot preservation after an edit, trigger behavior, same-version concurrent writes and private Library discoverability need an explicitly approved disposable Supabase target or separately authorized hosted fixtures/accounts with exact cleanup. Default `npm.cmd run test:e2e` is excluded because its hosted setup can create/delete data.

The bounded acceptance proposal is: select the approved disposable target and named owner A/B fixtures; owner A creates one uniquely reserved private magic item; owner B cannot load/list/edit that definition; owner A edits v1 to v2 while the exact v1 snapshot remains unchanged; two independent connections submit against one expected version and only one update wins; Library exposes the current version to A and hides it from B. Cleanup must remove only that reserved unreferenced definition and explicitly approved accounts, then verify zero reserved definitions/accounts remain. No existing user content or prior exhausted fixture allowance may be reused. Target selection, new accounts/credentials, runtime/schema setup if needed, fixture writes and deletion all require fresh explicit authorization before execution.

No push, PR merge, deployment, schema/security change, account/credential creation, or hosted data change occurred. Approval is required for those operations. Continue independent queue work; do not treat local mock/static evidence as a completed hosted acceptance gate.
