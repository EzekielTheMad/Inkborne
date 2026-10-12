# R06.2 notice correction and offline browser preparation

Product correction: **`c2df697fadb767a97f19b2946a81104c12329325`**, on approved source `e6513b2`. An undeclared all-zero six-slot scores array adds nothing, so it no longer shows overlap ambiguity. Nonzero arrays remain conservative; mechanics/effects are unchanged. Frozen wording, resolver assertion and rendered no-notice regression are updated. Affected command passed **2 files / 20 tests**:

```text
npm.cmd test -- --maxWorkers=2 tests/lib/engine/race-ability-scores.test.ts tests/components/builder/race-ability-notice.test.tsx
```

Prepared harness checkpoint: **`2060a306d048bb87048f0277bf667d549f4a83fc`**, branch `codex/r06-race-parity`, isolated `r06-race-parity-worker`. Six new fixture/config/runner/helper/test files only. **Browser remains held and has not run.** No server/browser/watcher started, no listening ports, all foreground checks exited; exact worker-path Node/esbuild inspection found none remaining. Existing worktrees and evidence were preserved.

## Reviewed run interface and production artifact requirement

After independent harness review, successful root production build and explicit UI release, run:

```text
npm.cmd run test:e2e -- --config e2e/local-race-parity/playwright.config.ts
```

Root must supply **`test-results/race-parity-build.json` in this worker** with exactly three fields:

```json
{
  "buildRoot": "ABSOLUTE_ROOT_CHECKOUT_PATH",
  "sourceSha": "FORTY_LOWERCASE_HEX_DIGITS_OF_BUILT_ROOT_HEAD",
  "buildId": "TRIMMED_ROOT_NEXT_BUILD_ID"
}
```

`buildRoot` is the actual root Git checkout after its completed production build. Needed read-only artifacts: `.next/BUILD_ID` and entire `.next/static` CSS/font/media tree. The runner checks current root Git HEAD against sourceSha and BUILD_ID against the receipt, requires actual built CSS and records each stylesheet's hash/size. It serves those styles/fonts locally and extracts the actual Next font-variable classes from production CSS. **No compiling globals fallback, additional Next build/server, env files or credentials.** Keep root HEAD/artifacts stable during the exclusive run; a changed root HEAD/build ID requires a fresh exact receipt.

## Planned browser proof and limitations

- Real RaceStepClient, AbilitiesStepClient, ClassStepClient/ClassStepRail, StatPreview, shared RaceAbilityNotice used by the sheet, canonical definition/snapshot parsers, actual transformer and evaluator. The sheet-notice view receives the associated content refs, complete flat effect list, first-race structured sources and identical state, then renders the real shared notice and StatPreview. This is not the complete authenticated SheetPanel shell.
- Ten original synthetic scenarios: new imported, frozen historical dual, scores-only, independent equal manual bonus, conditional inactive/active, formula, zero scores, separately labelled saved ASI, separately labelled raw-only subrace projection. Four views at desktop1280x900/mobile390x844 produce **80 planned checks and16 selected screenshots**. Values/notices, actual STR13 class threshold, identical state, pin/snapshot immutability and absence of writes/navigation are asserted.
- New/legacy/scores-only main pins pass actual canonical definition and immutable snapshot parsing. The raw subrace case explicitly verifies canonical score stripping, then supplies a labelled compatibility projection solely to the broad component input; it is not canonical-pin or hosted loss acceptance. ASI/subrace differences remain labelled R06.3/R06.4, not new live scoring modes. Class fixtures are noncasting original data; no spell/casting/game-rule extension.
- Navigation, ability draft/save/discard and character/ref/class action boundaries are stubbed. An attempted write/action is recorded and rejected; actual hosted modules are forbidden at bundling, and remote/non-GET network requests are blocked. No auth, persistence, selection save, database concurrency/trigger/receipt/RLS or hosted workflow claim. Mobile builder sidebars remain hidden under real product CSS; their DOM values are checked, and visible mobile StatPreview values are separately checked in the shared sheet-notice view.
- Runner records server/helper PID/parent/command/cwd/start/port, installed headless Chrome PID/profile/control port, early process receipt, final cleanup checks, blocked requests/errors and screenshots in `test-results/race-parity-local`. It preserves partial failure evidence. Root/worker must inspect screenshots and independently verify exact owned PIDs/ports after the eventual run.

## Preparation checks and failures preserved

Final preparation command passed **3 files / 23 tests** (2.39 seconds). It bundles the actual clients with declared stubs without executing UI and tests production receipt/CSS validation plus contained static asset access. Typecheck and zero-warning lint passed; whitespace checks passed.

```text
npm.cmd test -- --maxWorkers=2 tests/lib/engine/race-parity-browser-harness.test.ts tests/lib/engine/race-ability-scores.test.ts tests/components/builder/race-ability-notice.test.tsx
npm.cmd run typecheck
npm.cmd run lint
git diff --cached --check
```

Initial preparation failures were fixture defects: esbuild's TextEncoder invariant under jsdom (test moved to Node environment), a draft-stub closing brace and relative class-action import that bypassed the declared alias (fixed explicitly; live server imports were refused before execution), then React lint rejected external observer mutation during render (moved to a post-commit effect with stable fixture model/baselines). All were repaired and checked; no API/unauthenticated request ran. No broad check/build/browser or dependency mutation in this worker. Root owns combined production gates and subsequent UI release.

## Separate review correction after historical 2060a306

The interruption/font correction accompanies this handoff; historical `2060a306` is unchanged. The spec now opens IPC, sends cooperative stop and waits at most ten seconds. Runner stop/disconnect closes the current browser, exits through owned Chrome-server/HTTP cleanup, records `browserExited`, `portClosed`, and `browserPortClosed`, then disconnects IPC. A timed-out cooperative stop may force-close only the exact child tree after fresh Windows PID/parent/script command verification, following read-only reviewed R16 `09f6af3`; no executable-name cleanup. Forced termination may prevent final evidence writing, so the early process receipt remains available for independent inspection. This interruption path is prepared, not yet exercised in Chrome.

The loader now requires exactly one actual generated class per production variable, contained local assets, Marcellus normal and EB Garamond normal/italic FontFaces. It records families/styles/asset paths/bytes/SHA256 and refuses missing variables/faces/assets or remote sources before launch. Each desktop/mobile context must have the generated classes and matching computed variables, load/check the expected faces, and record loaded families/style/status. Actual served CSS/font requests carry their byte hashes; each expected family/style must request an asset matching production bytes. Added a viewport meta and explicit viewport-width assertion so the mobile fixture uses 390 CSS pixels.

Read-only receipt inspection succeeded against root source `2e20658bf1ea05cd5eba80ea8d6c9a62df38df74`, BUILD_ID `ZW0iZ-r_y_ff7iB_VoNy9`: three stylesheets, Marcellus normal two assets, EB Garamond normal/italic fourteen assets. No browser/server started. CSS/font artifacts are the actual root production output, but the fixture bundles clients separately with explicit boundary stubs and reconstructs only root HTML classes/body. It does not exercise Next production routing/hydration, ThemeProvider, the full authenticated builder/sheet shell, persistence or database behavior. Font loading, responsive rendering and cleanup still await the released browser run.

Correction narrow command above now passes **3 files / 27 tests** (2.39 seconds), including seven preparation cases and prior notice/zero-array controls. Typecheck and zero-warning lint pass. No dependency/provider/schema/SQL changes and no full check/build/browser. Existing config and run interface are unchanged.
