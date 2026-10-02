# History navigation and fresh builder recovery

> Historical milestone record. Counts/status describe this checkpoint. Use [CURRENT-STATE](../CURRENT-STATE.md) and the [release checklist](../RELEASE-READINESS.md) for current authority.

This is a verified local milestone on `codex/playable-core-stability`, not a hosted acceptance result. All original worktrees and the separate alpha candidate remain preserved. No migration, dependency installation, hosted write, push, merge or deployment occurred.

## History behavior and implemented recovery

The installed Next 16.2.10 App Router documentation exposes push/replace/back/forward/refresh and route observation, but no supported cancellable Back/Forward hook. The Link documentation supports `onNavigate` for links. The installed `next/dist/client/components/app-router.js` handles `popstate` by restoring the destination; `layout-router.js` preserves recent route segments inside hidden React Activity boundaries. This application uses that App Router.

No synthetic history entries, forced history traversal, interception of Next's internal history metadata or `popstate` cancellation were added. Browser Back/Forward continue to navigate normally.

An actual-editor React Activity regression initially failed: hide the editor during a pending save, resolve the old request while hidden, then reveal it. Its score remained visible but the status stayed “saving” indefinitely. The writer now identifies each active editor session, drops unsent work from earlier sessions, ignores their responses, and reconciles an interrupted draft to an accessible unconfirmed-save alert after cached route restoration. Retained drafts can be explicitly retried with a new request signal. This also covers a late old response after the editor is visible again.

The saving copy asks users to wait before Back, Forward or refresh. An unconfirmed-save alert explains that reloading checks persisted character data and discards the draft. No browser storage/outbox was introduced.

| Action | Current behavior | Practical limit |
| --- | --- | --- |
| Header/app same-window link | Existing confirmation can keep the draft open; declining shows recovery text. | Direct router commands require their own guard; the ability step's own Previous/Next controls are disabled. |
| Back/Forward within the app | Native history navigation; interrupted cached editors retain the draft and resume as unconfirmed, with explicit retry. | No promise that navigation can be prevented or an accepted server write undone. Cache eviction can discard the draft. |
| Refresh, tab close, external document navigation | Existing `beforeunload` handler requests the browser's warning while saving/failed. | Browser-controlled, depends on user activation; not guaranteed for process termination or mobile shutdown. Accepting refresh discards memory-only drafts. |
| Successful confirmed save | Normal navigation without a draft warning. | Cross-client reconciliation and ambiguous server completion remain separate prerequisites. |

Request abortion prevents later local work and an ability patch after an aborted read; it cannot roll back an already accepted write. This milestone does not cancel the other steps' multi-write operations partway through.

## Concrete fresh-builder findings and repairs

- Shared content cards were clickable `div` elements without keyboard activation. Their selection controls are now native named buttons, with visible focus styling; the search input has an accessible name. Subrace selection uses the same native-button approach. Choice toggle buttons now expose `aria-pressed`.
- Race save failures were console-only. All five race/subrace/choice actions now provide an accessible generic error that warns about possible partial persistence. A synchronous lock and disabled fieldset prevent competing actions and step buttons during a race save. Tests cover initial failure, successful character update followed by failed content-reference insertion, and competing actions during subrace selection.
- Class action failures were console-only. Failed class operations now expose an accessible generic alert without database details; a real fresh-class preview interaction is covered. This does not serialize all class actions or make their writes atomic.
- Background selection already has an atomic selection RPC and error recovery. Narrative/subchoice failures still had console-only recovery; those now also expose an accessible error. A real choice-button interaction covers rollback and announced failure. Rapid unrelated background choice writes remain a separate issue.
- General browser `updateCharacter` writes previously checked only an error and requested no returned row. They now request a single returned `id` and reject absent confirmation. The real Supabase client with mocked fetch verifies returned-row requests and missing-row rejection; existing color and canonical-update tests pass. This requires the caller's existing row read permission and is not an optimistic-concurrency guard. [Supabase's update documentation](https://supabase.com/docs/reference/javascript/update) documents returning updated rows through `select()`.
- Equipment completeness accepted any nonempty category pick, even a deleted catalog slug. A local execution of the actual helpers returned `complete: true` for a deleted holy-symbol pick and produced only Mace and Shield grants. The builder now validates each pick against the category's currently offered catalog/custom options, blocks confirmation, and announces unavailable picks. Real equipment UI regressions cover deleted and wrong-category picks; current valid/legacy flows remain covered.

## Remaining priorities before release

1. **Equipment grant atomicity and recovery.** `equipment-step-client.tsx` still saves selections independently, permits confirmation while a selection save is pending, then inserts items, updates currency and writes `confirmed` separately. A later failure can leave partial grants; repeated confirmation can duplicate them. Selection failures are still console-only and confirmation errors can expose low-level detail. The [atomicity proposal](../specs/2026-10-02-equipment-atomicity-proposal.md) remains a design, requiring schema/migration reconciliation and separate authorization before implementation. Current category validation does not repair this transaction boundary.
2. **Race/class choice and reference synchronization.** Their multiple writes can diverge, and locally restoring old UI state cannot undo successful earlier writes. The tested partial race failure demonstrates this. Reconcile saved choices and exact pinned references before introducing an automatic retry. Class actions and background subchoice writes can also overlap and overwrite complete `choices` snapshots. No cross-tab protection is claimed.
3. **Readiness validation and pinned-content consistency.** Shared status indicators intentionally report saved choices, not complete playable readiness. A race/class/background slug or sparse ability map can receive “Complete” without all required subchoices. Race display/choice effects currently come from the catalog lookup by slug while stat effects come from pinned references; reconcile versions before treating that screen as authoritative for older characters. Define system-specific readiness rules before changing navigation into a hard gate.

## Verification and access limits

- `npm.cmd run check`: TypeScript and zero-warning lint passed; **1,870 tests across 202 files** passed.
- `npm.cmd run build`: Next 16.2.10 compile, TypeScript and 24 static pages passed with loopback Supabase placeholders. Reused matching dependencies; no fresh install was performed.
- `node scripts/verify-builder-local.mjs` passed four installed-Chrome checks: declined link navigation; native Back/Forward with Activity retention and explicit retry; keyboard selection plus mobile race error; and activated refresh's native warning with draft disposal.
- The browser fixture bundles the real ability editor, race controls and preview dialog. Its router and persistence are simulated; it is **not** the running Next application, authentication, RLS, a live Supabase backend or complete end-to-end builder acceptance. Existing hosted Playwright config/global setup/teardown were never loaded. Class/background/equipment interaction coverage uses real components under jsdom with mocked persistence, not Chrome or hosted writes.
- Browser requests were restricted to a random loopback port; no remote requests or page errors were recorded. Chrome and the existing Playwright/esbuild dependencies were reused. The skill's `agent-browser` CLI was absent; Playwright was used directly. The filesystem sandbox blocked esbuild ancestor traversal, so the scoped browser command required authorized execution outside that restriction. There was no installation or automatic-review rejection.
- Screenshots were visually inspected at desktop and mobile sizes. They use the latest local compiled CSS with fallback fonts and fixture layout; do not infer complete app typography or layout acceptance from them.
- Reproduction script: `scripts/verify-builder-local.mjs`. Generated evidence and screenshots: `test-results/builder-local/evidence.json`, `pending-navigation.png`, `race-failure-mobile.png` (ignored local artifacts). The script closes its owned browser and loopback server in `finally`.

Hosted authenticated UAT, RLS/transaction verification, multi-client conflicts and true app router end-to-end coverage remain unrun under the no-hosted-writes boundary.
