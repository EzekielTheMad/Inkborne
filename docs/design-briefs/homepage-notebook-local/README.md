# Illustrated homepage and explorable notebook — local review

Revision 5, portrait alignment · 22 October 2026 · [Brand guide v2.3](../../brand-reference.md)

Branch: `feat/homepage-notebook-refresh-20261022`. This is a local review checkpoint. Nothing was pushed, merged, or deployed, and no hosted data or configuration changed. The preceding local homepage checkpoint was `e6e4ecd`.

## What to review

The introduction now pairs Inkborne's expressive type with an original illustration of Thalindra at Shadepoint, a readable character-sheet leaf, and a separate session note. The illustration is a warm-paper artifact in both themes. The surrounding page, sheets, journal, controls, and logo treatment follow the active appearance.

The header now has one account entry, **Sign in**, which stays visible on mobile. **Start building** remains in the hero and closing section. A 44 px sun/moon button opens a compact, keyboard-accessible Light/Dark/System menu; its selected choice uses the same shared preference. The portaled menu has its own matching light/dark palette and keeps brand focus styling.

The three former feature blocks now share one explorable notebook. Character, Journal, and Homebrew bookmarks change the page and its accompanying explanation. The same character, session, and spell connect the material. Keyboard Left/Right wraps between bookmarks; Home/End selects the first/last, and Tab enters the active page. Mobile deliberately stacks identity and reading areas.

The [portrait alignment repair](screenshots/notebook-portrait-aligned.png) places the name and portrait in a shared grid instead of floats with negative offsets. The arched frame is straight, and the image uses its original headroom rather than a zoomed crop. The caption stays below both elements; the narrow tablet layout stacks the identity deliberately and mobile returns to side-by-side placement.

The accent selector defaults to site gold and supports named presets, a native custom-color control, and reset. It recolors the character-owned details in the hero and notebook while global actions, logos, focus, and navigation retain brand colors. Readable foreground and control colors are derived for both themes before hydration. The selected source remains intact across chapters and Light/Dark/System changes.

This is fictional, illustrative content. Accent changes stay in this page's React state and reset on reload. They do not update a player's character. Authentication, the signed-in `/dashboard` redirect, saved character data, shared app colors, and authenticated character screens remain outside this change.

The original [illustration and complete generation prompt](../../../public/illustrations/README.md) are saved in the repo. Production uses a 900 × 1200 WebP, generated with the built-in image tool and optimized with the existing Sharp dependency. No new runtime dependency or external image host was added.

## Review screenshots

These screenshots show the production build of the actual application, not a separate mockup:

The [compact appearance menu](screenshots/homepage-appearance-menu.png) shows the current header controls and selected theme.

| State | Desktop | Mobile |
| --- | --- | --- |
| Character, site gold, Dark | [Open](screenshots/homepage-dark-desktop.png) | [Open](screenshots/homepage-dark-mobile.png) |
| Character, site gold, Light | [Open](screenshots/homepage-light-desktop.png) | [Open](screenshots/homepage-light-mobile.png) |
| Journal, Emerald, Dark | [Open](screenshots/notebook-journal-dark.png) | [Open](screenshots/notebook-journal-dark-mobile.png) |
| Homebrew, Emerald, Light | [Open](screenshots/notebook-homebrew-light.png) | [Open](screenshots/notebook-homebrew-light-mobile.png) |

## Run the interactive page locally

Use this checkout in a separate PowerShell terminal. Dependencies are already installed; use `npm ci` if setting up a fresh checkout.

```powershell
Set-Location 'C:\Users\kaios\Documents\Codex\2026-10-22\inkborne-brand-guide'
$env:NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = 'local-homepage-public-placeholder-not-a-credential'
npm.cmd run dev -- --port 3190 --hostname 127.0.0.1
```

Open `http://127.0.0.1:3190` in a clean browser without a session. The placeholder configuration supports anonymous homepage review without a backend. It cannot exercise provider sign-in, account creation, or authenticated persistence. The server binds only to loopback; stop it with Ctrl+C after review. Keep these process-local placeholders in a separate terminal so they do not replace another development shell's settings.

## Verification

Use the existing scripts:

```powershell
$env:VITEST_MAX_WORKERS = '2'
npm.cmd run check
npm.cmd run build
npm.cmd run test:e2e -- --config e2e/local-homepage/playwright.config.ts
```

Build and browser tests use the loopback placeholders above. The dedicated browser configuration exercises the real anonymous Next.js route without hosted account fixtures or database cleanup. The root E2E configuration uses hosted setup and is outside this local review.

The focused browser suite checks factual copy, section/auth navigation without submitting forms, theme persistence and System changes, active/inactive chapter semantics, keyboard navigation, accent retention and reset, actual rendered contrast at yellow/red/white/black extremes, global branding stability, reduced motion, and layout bounds at 1440/840/390/320 px. It rejects nonloopback requests, non-GET/HEAD requests, console errors, and hydration warnings. Existing mocked tests protect the server's anonymous render and signed-in redirect.

Independent code review found no blocking issue. Review caught and corrected the mobile name spacing, and visual review corrected a hero paper overlap that obscured statistics.

| Check | Outcome |
| --- | --- |
| Original illustrated-notebook checkpoint | At `736b6d0`, `npm run check` passed all 376 Vitest files: 5,358 tests passed and 3 skipped. The Vitest phase took 489.80 seconds with two workers. Compact-header validation is recorded below. |
| Compact-header repository check | Typecheck and lint passed. Vitest finished with 375 files passed and 1 failed: 5,357 tests passed, 1 failed, and 3 skipped (516.97 seconds, two workers). The untouched `tests/components/library/monster-form.test.tsx:32` could not find the simulated recoverable-response text within its wait. |
| Isolated failure rerun | `npm run test -- tests/components/library/monster-form.test.tsx` passed all 13 tests in 15.33 seconds. No monster-form implementation or test files were changed; the full run remains recorded as non-green. |
| Final lint | `npm run lint` passed again after the menu close behavior and final browser-test updates. |
| Production build | `npm run build` passed after the final source changes. |
| Focused production-browser suite | All 11 compact-header tests passed in 35.1 seconds after the final source/test changes, including the appearance menu, keyboard activation/Escape/focus return, mobile Sign in, theme persistence, and all notebook/accent behavior. |
| Theme provider contracts | All 13 focused tests passed. Provider persistence, blocked storage, System changes, and hydration remain covered independently of menu pointer behavior. |
| Visual review | Reviewed Dark and Light desktop/mobile renders, plus Journal and Homebrew custom-accent states. All eight screenshots above are from the final production build. |
| Browser request boundaries | No hosted requests, network mutations, console errors, or hydration warnings were observed. |
| Independent review | No blocking compact-header findings in portal theme colors, prepaint icon visibility, selected state, keyboard focus, or mobile Sign in. |
| Portrait alignment repository check | `npm run check` passed typecheck, lint, and all 376 Vitest files: 5,358 tests passed and 3 skipped. Vitest took 237.98 seconds with four workers. The earlier monster-form timeout did not recur; no unrelated implementation or tests were changed. |
| Portrait alignment production build | `npm run build` passed after the portrait source changes. |
| Portrait alignment browser checks | The existing responsive and reduced-motion tests passed together in 13.2 seconds. They exercised all notebook chapters at desktop, tablet, and phone widths in both themes. All eight notebook review screenshots were refreshed from this production build, and the separate portrait crop was reviewed in the interactive browser. |

The compact-header review server (PID `40088`) was identified and stopped before rebuilding the portrait fix. The user requested an interactive review server, so the updated production build was started with `next start --port 3190 --hostname 127.0.0.1` and left running: PID `129252`, parent PID `86672`, start `2026-10-22T15:54:19.4444830-07:00`, working directory this checkout. The final browser checks reused this server. Its process record is saved in this task's local review artifacts. The unrelated integration worktree's server was preserved.

The first compact-header browser iteration caught the menu remaining open after selection; explicit close-on-selection fixed it, and the complete focused suite passed afterward. The initial TypeScript run also caught a test-only locator option mismatch, which was corrected before the successful production build.

## Implementation map

- `components/landing/landing-content.tsx`: server-rendered page shell and illustrative page content.
- `components/landing/notebook-experience.tsx` and its CSS module: hero composition, bookmark interaction, responsive notebook, and page-local accent controls.
- `components/landing/homepage-appearance.tsx` and its CSS module: compact sun/moon trigger and matching portaled Light/Dark/System menu.
- `lib/landing/notebook-accent.ts`: pure landing-scoped color derivation with both theme variants emitted before paint.
- `public/illustrations/`: selected illustration and its complete generation prompt.
- `e2e/local-homepage/homepage.spec.ts`: real anonymous production-browser coverage.
- `docs/brand-reference.md` and the homepage spec: current direction and scope for future work.

Provider sign-in, hosted persistence, deployment, and the wider authenticated-app light-theme migration were not exercised by this local-only change.
