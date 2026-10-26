# Auth notebook refresh — local review

22 October 2026 · [Brand guide](../../brand-reference.md)

This is the historical local-review record. The later authorized dev release has
its own [scoped release record](../../handoffs/2026-10-23-auth-dev-release.md).

Review the actual application at [Sign in](http://127.0.0.1:3192/login),
[Sign up](http://127.0.0.1:3192/signup),
[Recover password](http://127.0.0.1:3192/auth/forgot-password),
[Set a new password](http://127.0.0.1:3192/auth/reset-password), and
[Verify email](http://127.0.0.1:3192/auth/verify).
The compact header button retains Light, Dark, and System and shares the
homepage's saved preference.

## Scope and source

Branch `feat/auth-notebook-refresh-20261022`, worktree
`C:\Users\kaios\Documents\Codex\2026-10-22\inkborne-auth-refresh`.
This starts from the current development checkpoint `0339e9c`, then integrates
the approved homepage release `bc85889` locally as `491b62d`. The root-layout
merge retains the creation-account lookup and `CreationSessionBoundary` and adds
the reviewed prepaint theme script. The source integration is local; it does not
release the unfinished feature work.

The shared auth shell now uses the selected Scribe lockups, ink-purple and warm
gold, Marcellus headings, Garamond marginalia, ruled page edges, and a desktop
notebook spread. Mobile concentrates on the form. Scoped semantic tokens supply
distinct warm-paper Light and ink Dark surfaces without changing the wider app's
global palette or shared UI primitives. Inputs and buttons have at least 44 px
targets. Link/focus, error, and confirmation colors are readable in both themes.

Auth actions, handlers, field names, password rules, callback origins, redirects,
OAuth feature gating, Supabase clients, session logic, proxy, and database code
are unchanged by the auth styling commit. Recovery and verification retain their
existing branches, with consistent error styling and accessible pending/success
announcements. The Google/optional Discord handlers remain the existing ones.

No push, merge into a shared branch, deployment, account creation, email delivery,
credential change, or hosted configuration/data change is part of this work.

## Local review configuration

This is an offline presentation review. The SDK points to an unused loopback
placeholder, so the review server cannot complete real authentication or deliver
mail. Do not enter real credentials. Automated feedback-state checks intercept
only explicitly queued recovery/resend calls and return local test responses.
These are not successful hosted-authentication or mail-delivery evidence.

```powershell
Set-Location 'C:\Users\kaios\Documents\Codex\2026-10-22\inkborne-auth-refresh'
$env:NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54999'
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = 'local-auth-review-placeholder-not-a-credential'
$env:NEXT_PUBLIC_SITE_URL = 'http://127.0.0.1:3192'
$env:INKBORNE_CLASS_ORIGIN_CREATION_UI = 'false'
npm.cmd run build
npm.cmd run start -- --port 3192 --hostname 127.0.0.1
```

Use a separate terminal for these process-local placeholders. No `.env` file or
remote setting was modified. Port 54999 was checked unused before the build.
The production server can start from this build without additional environment
assignments because the public placeholder values are compiled into the build.

## Verification and evidence

Run the repository scripts:

```powershell
$env:VITEST_MAX_WORKERS = '4'
npm.cmd run check
npm.cmd run test:e2e -- --config e2e/local-auth/playwright.config.ts
```

The dedicated browser suite uses real Next.js routes and production CSS/fonts,
without the root E2E configuration's hosted setup, account fixtures, environment
loading, or cleanup. Unexpected requests and mutations are blocked. Recovery and
resend HTTP responses are explicitly simulated; intentionally mocked HTTP 400
resource messages are identified by exact URL, while application console errors
and hydration warnings fail the run. Reset mismatch is tested before any SDK call.

Existing login/signup action and callback tests protect their unchanged contracts.
New mocked page tests protect recovery, reset, and verification pending/error/
success branches; provider tests cover enabled and disabled Discord behavior.

Independent read-only source review found no blocking auth-contract, theme portal,
React, focus, or merge-preservation issue. The first browser iteration exposed a
test locator matching both the form alert and Next.js's route announcer; the
locator was scoped to the auth shell. No product behavior changed for that repair.
The initial new unit success assertion also matched pending status too early;
it now waits for the expected resolved status.

The rendered contrast check also caught primitive controls animating their focus
outline from a faint base color. Auth fields/buttons now limit transitions to
background, border, and text colors, so the 3 px keyboard outline is immediate.
Both themes pass the unchanged contrast thresholds: 4.5:1 for sampled text,
3:1 for sampled field/provider boundaries and keyboard focus, including hover
and recovery/resend error/confirmation feedback. This is a focused check of the
auth reading/form surfaces, not a complete accessibility certification.

| Validation | Result |
| --- | --- |
| `npm.cmd run build` with local placeholders | Passed after the focus fix. |
| `npm.cmd run typecheck` | Passed. |
| `npm.cmd run lint` | Passed with no warnings. |
| Auth, theme-provider, and root creation-boundary tests | 62 passed across 11 files. |
| Creation-session-boundary tests | 15 passed. |
| Dedicated local-auth browser suite | All 5 passed in 28.8 s after the focus fix. |
| Existing local-homepage browser suite | All 11 passed in 29.2 s on this integration. |
| `npm.cmd run check` | Not green; baseline failures described below. |

The local browser suite exercises six auth routes/variants in both themes at
1440, 840, 390, and 320 px, loaded logos, overflow/control bounds, native required
validation, reset mismatch retention, keyboard appearance selection, persisted
preference, System changes/reload, cross-page navigation, and mocked recovery/
resend pending/error/retry/success states. Application/hydration errors fail it.
The in-app browser was also visually reviewed in Light and Dark at a narrow
viewport. Desktop, mobile, and feedback screenshots are saved below.

The full check initially reported 389 passed files, four failed files,
5654 passed tests, three failed tests, and three skipped tests. Two test files
failed before collection. One failure belonged to the integrated layout test:
`character-origin-root-boundary.test.tsx` assumed `<html>` contained only `<body>`.
The reviewed homepage also has `<head>` for prepaint appearance. The test now
selects `<body>` explicitly and retains all three boundary assertions; all pass.

The remaining failures reproduce unchanged at the clean development baseline
`0339e9c` in a separate detached checkout:

- `builder-journey.test.tsx` and `starting-equipment-page.test.tsx`: collection
  fails on the existing `server-only` import through `creation-ui-server`.
- `race-parity-browser-harness.test.ts`: its existing bundler guard rejects
  `@/lib/supabase/client` through `ability-scores-client`; six other tests pass.

The baseline layout test passes all three tests. The baseline test files,
relevant source imports, test configuration, and dependency files match the
development checkpoint; the auth refresh does not alter those import chains.
These unrelated guards/tests were preserved. The full suite was not rerun after
the scoped layout-test/focus repair; final focused checks above passed. Hosted
sign-in, OAuth handoff, email delivery, and real password changes were not tested.

### Screenshots

- [Dark sign in, desktop](screenshots/login-dark-desktop.png)
- [Light signup with keyboard focus, desktop](screenshots/signup-light-desktop.png)
- [Light recovery, mobile](screenshots/recovery-light-mobile.png)
- [Dark verification, 320 px](screenshots/verify-email-dark-mobile.png)
- [Reset validation, mobile](screenshots/reset-error-light-mobile.png)
- Recovery: [pending](screenshots/recovery-pending-dark.png),
  [error](screenshots/recovery-error-light.png),
  [confirmation](screenshots/recovery-success-light.png)
- Verification: [pending](screenshots/verify-pending-dark.png),
  [error](screenshots/verify-error-light.png),
  [confirmation](screenshots/verify-success-light.png)

### Review process

The requested review server remains running at loopback port 3192:
PID `191580`, parent `149552`, started
`2026-10-22T21:31:14.8644260-07:00`, working directory as above,
command `next start --port 3192 --hostname 127.0.0.1` (npm start),
Codex execution session `45302`. The earlier task-owned server was stopped by
exact PID/command/path identity and its port was verified closed before rebuild.
The initial Node process inventory was 13 processes / 934735872 bytes; after
validation it was 17 / 1317109760 bytes across the whole computer. The review
listener belongs to the recorded process, and the SDK placeholder 54999 has no
listener. Other worktrees' processes were preserved.

Automatic approval review blocked removal of the temporary baseline checkout
without providing a reason. It remains intact at
`C:\Users\kaios\Documents\Codex\2026-10-22\inkborne-auth-baseline-check`,
detached at `0339e9c`, with a task-created `node_modules` junction pointing to this
review worktree's dependencies. No server runs there. Remove that junction
without following it before removing the disposable checkout in a future cleanup.

## Implementation map

- `components/auth/auth-shell.tsx` and its CSS module: scoped notebook, selected
  logos, appearance entry, fields, controls, and feedback presentation.
- `components/auth/oauth-buttons.tsx`: styling only; provider gating/callbacks unchanged.
- Recovery/reset/verify page JSX: consistent feedback and live announcements.
- `tests/auth/`: unchanged action/callback contracts plus page-state/provider coverage.
- `e2e/local-auth/`: offline browser behavior and review screenshots.

The wider app navigation, character appearance, saved character accents, builder,
authentication providers/configuration, and database activation remain separate.
