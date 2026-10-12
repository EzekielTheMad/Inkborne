# R12 standalone TraitForm offline browser preparation

Source-only separate checkpoint after tested correction `fcb3c239ead1008b28332bf4914a6b7013825a2d` and its narrow evidence handoff `7d7ae1c`. **Harness has not run, bundled or been typechecked/linted.** No browser/server/build/install/full check or provider request. Existing product source is unchanged, and prior 128-test/typecheck/lint evidence applies only to correction source. Root must review this exact harness and release preparation/UI checks separately.

Owned files: `e2e/local-traits/fixture.tsx`, `playwright.config.ts`, `traits.spec.ts`, `scripts/trait-production-assets.mjs`, `verify-traits-local.mjs`, Node-environment preparation tests, this handoff. Reuses read-only reviewed root R16 asset/success-clean-build guards and bounded cooperative cleanup pattern; no shared helper/refactor/dependency/provider/schema/SQL/relations/sharing/import changes. Actual TraitForm, mapper, trait schema and native browser form behavior; actions, returned rows, private Homebrew list and router/anchor navigation are simulated. No character attachment/SQL/RLS/version trigger/hosted/exactly-once acceptance.

After review, preparation checks may run the Node harness test and normal typecheck/lint when explicitly released. Browser run interface remains the existing script:

```text
npm.cmd run test:e2e -- --config e2e/local-traits/playwright.config.ts
```

Root must supply ignored `test-results/traits-local/production-artifacts.json` using the **same R16 manifest shape**:

```json
{
  "kind": "next-production",
  "sourceCommit": "CURRENT_ROOT_40_HEX_SHA",
  "staticDirectory": "ABSOLUTE_ROOT/.next/static",
  "htmlClassName": "dark h-full antialiased ACTUAL_MARCELLUS_VARIABLE_CLASS ACTUAL_GARAMOND_VARIABLE_CLASS",
  "buildIdSha256": "SHA256_OF_ROOT_BUILD_ID_BYTES",
  "buildReceipt": {"sourceCommit": "CURRENT_ROOT_40_HEX_SHA", "path": "ABSOLUTE_SUCCESSFUL_BUILD_RECEIPT_JSON", "sha256": "SHA256_OF_RECEIPT_BYTES"},
  "assets": [{"relativePath": "chunks/actual.css", "sha256": "SHA256_OF_ASSET_BYTES"}]
}
```

Assets must include **every production CSS file** and all local font/image resources referenced by CSS (`chunks`/`media` contained real paths only, no JavaScript assets); one placeholder entry above is illustrative, insufficient to run. The hashed receipt must prove gate=`build`, exitCode=0, sourceSha matching current root HEAD, and clean `sourceStatus` as empty string/array. Runtime checks root HEAD, clean tracked status, exact BUILD_ID/receipt/asset hashes, complete CSS coverage, no remote CSS resource and real local fonts. It never compiles globals or fabricates styles. Four trait Git blobs in root and worker HEAD must exactly match approved `fcb3c239` (form/mapper/DAL/actions); this allows root cherry-picks without inventing ancestry. Requires read-only root `.next/BUILD_ID`, `.next/static`, clean-build JSON and Git source. Root must keep source/artifacts stable through the exclusive run. Future product corrections require a fresh approved source marker and build, not a stale artifact claim.

Planned **14 outcomes × desktop1280x900/mobile390x844 =28 evidence cases,16 screenshots**: create scalar, blank, explicit zero; edit safe integer; locked per-level/dawn; pending duplicate; actual mapper field error/focus; rejected-after-simulated-save, malformed and uncertain CREATE; saved ID navigation; navigation failure without reinsert; edit conflict/uncertainty with explicit native reload. Draft comparison/native `form.reset()` tests retain controlled values. Uncertain creates require a manual Check Homebrew anchor and acknowledgment; no automatic action retry, and deliberate second rejected attempt records two different simulated identities. Acknowledgment/list read is not absence/authorization/idempotency proof. Saved state disables repeat submission. Latest reload supplies a explicitly labelled simulated version4/locked legacy pair; no real owner query. Keyboard traversal, actual viewport width, body/control horizontal bounds and primary normal/italic FontFaces are checked. Local asset requests/hashes, loaded families/styles, labels/drafts/submissions/navigation, layout samples and screenshots are retained; genuine failures preserve DOM/layout/screenshot receipts rather than weakening assertions.

Check Homebrew is a navigation stub that records its anchor and displays a simulated list **while keeping the actual form mounted**. This does not prove real Next navigation/back behavior or durable draft recovery; the real form warns that leaving can lose its page-local draft. Router targets and simulated throw are observed, not an actual authenticated route transition. Local edit reload is a real same-origin browser reload with a simulated newer DTO. Fixture bundles components separately and applies verified production HTML font classes/body CSS, without authenticated Next shell/ThemeProvider/production hydration. No calculator or new game rules are introduced.

At eventual run, record resource before/after and helper/Chrome PID/parent/command/cwd/start/HTTP/control ports. Runner saves an early process receipt before loading assets, handles IPC stop/disconnect, closes private browser/server/HTTP in finally, records `browserExited` and both closed ports, and disconnects IPC. Spec waits ten seconds for cooperative stop then permits only freshly verified child PID/parent/script private-tree fallback, never executable-name cleanup. A forced termination may prevent final evidence; early receipt remains for exact readback. Browser run/visual inspection/external process readback still pending. No process has been started by this source preparation, and other worktrees/artifacts remain untouched.
