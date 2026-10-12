# R16 mobile Library grid — reproduced and bounded fix

Worker source `4bb6def` plus the independently root-approved one-class fix;
unchanged verified production assets from root
`2e20658bf1ea05cd5eba80ea8d6c9a62df38df74`. No root edits, build, install, full
gate, authoring code, schema/fixture changes, data writes or assertion relaxation.
Installed Next CSS guide/source inspected before editing.

## Exact cause and change

At mobile width **390 px**, Library's results wrapper was **358 px** wide, but its
grid had no base column definition (`grid gap-3 sm:grid-cols-2 xl:grid-cols-3`).
The implicit `auto` track used the long unbroken card title's intrinsic minimum:
computed `grid-template-columns: 10432.5px`. Every actual CompendiumRow link
became **10432.453125 px** wide with `min-width: auto`, right edge
**10448.453125 px**. Document scroll width was **10448**, not 390. The wrapper's
existing `min-w-0` did not constrain that implicit inner track.

Only product change: add **`grid-cols-1`** to that results grid in
`components/compendium/compendium-browser.tsx`. Its existing compiled rule uses
`repeat(1,minmax(0,1fr))`, allowing the track to fit the available space.
Existing `sm` two-column / `xl` three-column behavior, card markup, full fixture
name/data, detail wrapping and unchanged overflow assertion remain intact.
No new truncation, clipping, hidden overflow or fixture reduction was introduced.
The utility already exists in verified `chunks/1lt466zx3qk4x.css`, so the bounded
before/after experiment used exactly the same CSS/font bytes, with no stylesheet
override or recompilation.

Diagnostic runner now persists actual node/ancestor bounds, client/scroll widths,
min-width, overflow/wrapping and grid/flex rules on failure. Console output is a
bounded three-offender summary; `failure-layout.json` holds detailed dimensions.
Passing layout samples also retain computed grid width/columns and document width.
This changes diagnostics, not the assertion or fixtures.

## Exact bounded verification

Same command both runs:
`npm.cmd run test:e2e -- --config e2e/local-monsters/playwright.config.ts`.

- Diagnostic before run: reproduced mobile failure after **10 desktop checks**;
  zero page errors, blocked/remote requests or unexpected writes; cleanup passed.
- Approved source after run: **20/20 checks, 1 Playwright test PASS**, desktop
  1440x900 and mobile 390x844. Mobile document width **390**, results width and
  computed grid track **358 px**. No layout failures/errors/remote requests/writes.
- Both widths retain original **62,138-byte** multibyte/unbroken long data and
  complete last rule visibility, all sections/duplicate order, declared zero/
  negative values, inert literal markup and actual root-produced font loading.
- `node --check scripts/verify-monsters-local.mjs` and `git diff --check` pass.
  No implementation-mirroring CSS unit test added. Root owns fresh final-source
  combined gates/build and representative acceptance after integration.

All source bindings and three CSS/twenty asset hashes match the reviewed root
manifest (manifest SHA-256
`0229724acf30511585673cb1b949a9af5f73d9e085a29fb912597b33ea54eef8`). No fallback.

Failure and passing evidence are preserved separately under the parent task's
`verification/r16-mobile-overflow/`:

- `initial-root-run/`: original untouched root failure; evidence SHA-256
  `962da6971eb1c7abd62298ca33cdb75a4c7fbad721271892478239d3abde8e34`.
- `diagnostic-before/`: reproduced failure with full offending node/ancestor
  dimensions and the same manifest/screenshots.
- `candidate-pass/`: passing receipt/layout samples and desktop/mobile
  Library/small/all-fields/long-top/long-final screenshots; evidence SHA-256
  `dab9db7ef19004471865f1d933c3a0bd2e25797bba708586a96303d8f19a20fe`.

The scratch directory deliberately retains old failure image/layout files;
they are not a new failure in the pass run. The pass receipt's `failure: null`,
empty `layoutFailures` and twenty checks identify its result. Archives prevent
overwriting the original failure evidence while allowing the runner's ordinary
output filenames to be reused.

## Process cleanup and limitations

Before browser startup no Node process belonging to this worktree was running.
Diagnostics recorded Node/browser PID, parent, argv, cwd, start and actual ports.
After run: task Node **35912** (parent **53012**), start
`2026-10-12T03:22:10.818Z`, HTTP **59971**; private Chrome **40008**, parent
35912, control port **59972**. Browser/server close proof is in the receipt.
Exact readback at `03:23:24.707 UTC`: **owned Node count 0**, no remaining
diagnostic/after-run ports, browser exited. Root was notified immediately that
the serialized UI slot/HEAD hold could release. No unrelated process was stopped.

This is actual mounted component geometry with current root build assets.
Account/data and native navigation remain explicitly mocked; authenticated Next
router/app-shell behavior, RLS, provider/SQL persistence, sharing/import/DM use
and whole R16/M5 acceptance remain unavailable. The source fix must still be
integrated and built with the final combined product before release acceptance.
