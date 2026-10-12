# R17.1 NPC Library source and narrow gates — browser pending

2026-10-12. Worker `r17-library-npc-worker`, branch
`codex/r17-library-npc-plan-20261012`, product base `df8c303`; approved plan
`ecf5ccf` plus NPC envelope correction `b4c55a5`.

First source checkpoint implements only registered strict narrative NPC v1 data,
explicit empty effects at current and immutable canonical boundaries before
generic defaults, NPC Library category/fallback/facts, read-only profile/detail,
and long NPC name containment on the existing row. Other types retain behavior;
no engine/schema SQL, story relationship, copy, provider, writer, seed, Auth,
authoring/import/sharing or campaign-instance changes.

Original synthetic fixtures and source-prepared tests cover field/count/aggregate
validation, ordered text/absence/empty values, immutable v1 vs current v2,
independently effectSchema-valid mechanical/proficiency/choice/narrative negatives
without stripping, missing/null/wrong effect shapes, ordinary monster effects,
actual ref-reader incomplete admission, actual CharacterPage collector/evaluator
and complete earned ASI control, actual Library query/profile/browser and UUID
detail/auth return controls. Mocked actions/reads/reconciliation do not prove
database roles or concurrency. The CharacterPage client mount is stubbed; its
real server page, parser, ref reader, structured collector and evaluator execute.
Bad NPC pins retain the existing degraded-read/ASI-unavailable behavior.

Static preparation only: `git diff --check` passes. No install, tests, typecheck,
lint, full check, build or browser run yet; root owns those resource lanes.
Tests and exact observed before/after evidence remain pending, not green.

Planned narrow sequence after explicit release: locked
`npm.cmd ci --ignore-scripts --no-audit --no-fund`; `npm.cmd test -- --maxWorkers=2`
with NPC schema/parser/profile/ref-reader/CharacterPage/Library detail and changed
Library/query tests, plus inherited monster and ref reader regressions; sequential
`npm.cmd run typecheck`, `npm.cmd run lint`. Root handles combined gates/build.
Offline `e2e/local-npcs/playwright.config.ts` preparation follows in a separate
checkpoint; no browser until independent source review, exact fresh root build
receipt and explicit UI release. Preserve every failed receipt.

Full R17 and G2 role/lifecycle/CAS/persistence acceptance remain open. No hosted
credentials/environment copied or requests made. No long-running task-owned
process or listener has been started. Only this worker was edited.

## Source-only offline harness checkpoint

Core `4c077c62b45c1c713617905e9065e26d9cbe6224` was independently source-reviewed
and approved; it remains immutable and untested. The separate harness owns only
`e2e/local-npcs/{fixture.tsx,playwright.config.ts,npcs.spec.ts}` and
`scripts/{npc-process.mjs,npc-production-inputs.mjs,verify-npcs-local.mjs}`.

Explicit command after root's release:
`npm.cmd run test:e2e -- --config e2e/local-npcs/playwright.config.ts`.
No automatic server/setup or default hosted E2E is used. Expected finite matrix:
desktop 1280/mobile 390, actual Library category and keyboard link, actual NPC
detail/personality/relationship ideas, native search/minimal absent fields,
maximum bounded long profile/name and reachable final hook, escaped original
text/shared provenance label, empty/malformed/denied read boundaries. Planned
14 grouped checks and 18 viewport screenshots including long-profile top/end;
these are expected counts, not observed passes. Denied-read alert/query/auth/
entitlements and native anchors replacing Next router are expressly simulated;
the server Library route/error boundary and real sharing are not browser-proven.
Actual UUID route/auth boundaries remain source-prepared unit tests.

Reuse reviewed `passive-feature-production-assets.mjs` exports for successful
clean current-root build receipt, complete production CSS/fonts, asset hashes,
dependency lock/installed runtime checks and actual esbuild byte capture. The
inherited passive source checks remain enforced (not bypassed); the NPC wrapper
additionally binds every NPC product file to exact core Git blobs, all actual
bundled project/metafile inputs to current root mounted bytes and HEAD (including
index drift), runtime configuration/lock and committed synthetic fixture/harness
source. No fallback styles or mirrored product copies. Root must first integrate
reviewed NPC source and produce a fresh build receipt/manifest at
`test-results/npcs-local/production-artifacts.json` containing the reviewed helper's
`kind`, absolute static directory, current source commit, actual HTML font
classes, BUILD_ID hash, build receipt path/source/hash, dependency lock hash and
full compiled CSS/font asset list/hashes. Stale/mismatched inputs refuse execution.

The runner permits only private loopback GET routes/assets, denies remote/unexpected
writes, records expected malformed-NPC console diagnostics separately from page
errors, checks horizontal overflow, actual generated font variables and three
loaded FontFaces/families/local hashes, preserves old evidence/screenshots, and
records exact task/browser OS CreationDate/PID/parent/command/cwd/start/ports plus
before/after process/memory/CPU/listener snapshots. Cooperative IPC stops private
browser and HTTP resources; after 10 seconds spec can force only a freshly
identical original OS birth/PID/parent/exact command tree. Missing birth refuses
force. Receipt must show both ports closed and browser exited. No process has
been started while preparing this checkpoint.

Static diff check only. Install, all unit/type/lint gates, build and offline browser
remain held by root; source review is not workflow or database acceptance.

## Harness review correction / gate release

The inherited executable asset helper is now verified independently before dynamic
import or validator invocation: reviewed `5fedd622` blob
`e4058f8a31cd911583a312e59fedcf4c3fd4adae`, exact current worker/root HEAD OIDs,
tracked HEAD-to-index/working-tree status, and actual mounted raw bytes against
Git's checkout-filtered reviewed blob and each other. Both canonical LF blob hash
and executed CRLF byte hash are recorded as a separate inherited-helper receipt,
rechecked after bundling. Six owned harness files remain separately receipted.
No speculative newline normalization or reliance on the helper's self-check.
Narrow non-sensitive `core.autocrlf`/`core.eol`/`core.safecrlf`/attributes-file
origins and effective text/eol/filter/encoding/ident attributes are recorded,
required identical across worker/root and rechecked; executable custom filters
and unexpected encoding refuse. No broad configuration or environment dump.
The shared-fixture browser check now asserts the actual visible `Campaign shared`
badge rather than claiming it solely from escaped text.

Root released install/narrow/typecheck/lint, with browser/full/build still held.
Locked install passed: 804 packages in 35 seconds, four captured OS identities,
zero remaining exact processes/listeners. No lock/dependency edits. Receipt/logs
are ignored `test-results/r17-focused-gates/ci.*`; core failing-before and focused
gates follow this separate correction freeze. Existing claims above describe the
earlier source-only checkpoints, not completed test/browser acceptance.

The next finite review correction separately checks staged-vs-HEAD and
working-vs-index diffs, rejects unmerged entries, and records/rechecks actual
stage-0 helper index OIDs with HEAD OIDs against the reviewed blob. This closes
the net-diff case where a modified index is hidden by a working file restored to
HEAD. The protected helper itself remains unchanged.

Observed core gates through `7137fad`: baseline exact old-parser substitution
produced nine substantive failures / nine passes in two files, with actual page
STR16, athletics grant and accepted/complete effectful NPC refs; current parser
bytes and all seven recorded inputs restored exactly in finally. The initial
14-file run retained one stale-category failure plus three suites blocked by a
missing profile bracket (205 passes). One bracket/category assertion correction
is separate `7137fad`; subsequent 14 files / 215 tests pass with explicitly
forwarded `--maxWorkers=2`, zero task-owned processes/listeners remaining. The
baseline npm filter/worker flags were not forwarded, so both selected files ran
fully; only two files could run concurrently. Original receipts were preserved,
not relabeled. Typecheck/lint follow this clean harness-stage-guard checkpoint;
no browser/full/build/DB acceptance has run.

`a9b994a` actual-consumer test reorder and `7137fad` profile/category correction
were independently approved. Root explicitly authorized advancing the eight-file
NPC product anchor to full `7137fad54bc300ed051f1025877e6eb54eb26603`; only profile
blob `93cd187fe94bef813765ad33830389e3a812fc17` differs from original core among
those eight files. Harness helper/spec now bind that precise source, retaining
every inherited/raw/metafile/index/build/lock check; no current-HEAD fallback.

Initial typecheck at clean `75d8600` found only unsupported Testing Library role
query option `exact`. It is removed from the test; the name remains an exact
string matcher, and the assertion is unchanged. No production behavior change.
Receipt preserves that type failure separately. Focused profile recheck and
sequential typecheck/lint follow this clean correction/anchor checkpoint.

## Final narrow results and exact handoff

Tested source: `7137fad54bc300ed051f1025877e6eb54eb26603` passed all 14 selected
files / 215 tests; final `846860209041819deb27b1547c06a77720ad3037` changes only
reviewed harness anchor strings, the staged-helper guard carried through `75d8600`,
documentation and a test role-query type option. The affected profile tests were
rechecked at final source: 1 file / 4 tests passed. Repository typecheck and
zero-warning lint passed at clean `8468602`. No additional production correction
beyond independently approved one-character profile fix `7137fad`.

Exact package commands (the ignored ownership wrapper records arguments, cwd,
source/status, PID/parent/command/OS birth and resources for each phase):

```powershell
npm.cmd ci --ignore-scripts --no-audit --no-fund
npm.cmd test -- --maxWorkers=2 tests/schemas/npc.test.ts tests/lib/supabase/npc-parser.test.ts tests/components/compendium/npc-profile.test.tsx tests/app/npc-character-admission.test.tsx tests/app/library-npc-detail-page.test.tsx tests/lib/supabase/compendium-server.test.ts tests/app/library-page.test.tsx tests/lib/compendium/catalog.test.ts tests/lib/compendium/presentation.test.ts tests/lib/supabase/monster-parser.test.ts tests/lib/supabase/content-refs.test.ts tests/schemas/monster.test.ts tests/components/compendium/compendium-detail.test.tsx tests/components/compendium/compendium-browser.test.tsx
npm.cmd test -- --maxWorkers=2 tests/components/compendium/npc-profile.test.tsx
npm.cmd run typecheck
npm.cmd run lint
```

Preserved ignored evidence: `test-results/r17-focused-gates/ci.*`, `baseline.*`,
`baseline-inputs.json`, `baseline-restoration.json`, parser before/current binary
bytes, `focused-initial.*`, `focused-after.*`, `typecheck-initial.*`,
`profile-type-fix.*`, `typecheck-after.*`, `lint-initial.*`, and
`final-readback.json`. Original failed initial focused run was 205 passing tests,
one category assertion failure and three source parse-blocked suites; initial
typecheck failed on the unsupported test option. None was deleted or relabeled.

The meaningful before run used only exact old parser module from plan base
`b4c55a55`, Git blob `4006598f7686a648fb2a320f49051e09318dadf3`, SHA256
`9ae56e20e8008628e15bfb7b7f1db85518b7d0a601a4e0c08284847193d921a4`, with new
NPC registry/schema/fixtures/test bytes retained. Actual CharacterPage consumer
executed before fence assertions: effectful NPC pins were accepted/complete,
mechanical STR16 vs ordinary accepted NPC STR14, proficiency grant present,
choice/narrative effects collected. Nine substantive baseline failures; no missing
module/import failure. Current parser SHA256
`7c5050612cf395483ebfbbc98019adbe8d2371cf4246f5491435b19a112cc617` and all seven
recorded source/lock input hashes restored in finally, clean source. After fence,
rejected pins are incomplete/ASI-unavailable, STR12 under existing degraded-read
contract, no NPC grant/effect contribution; positive empty NPC STR14 and ordinary
non-NPC stat/proficiency effect STR16 controls remain intact.

Final same-birth/exact-command readback included 95 recorded identities and all
eight gate shells: zero remaining, zero owned listeners. No process was killed;
none left running. Before/after process count/memory/CPU/listener snapshots are in
receipts. Dependency lock unchanged at SHA256
`7225aa9026eb747c5626204c9e5e5901809f95b33a1aacaba35cd139e86a2eb6`.
Root's heavy slot was released immediately after lint/readback; this final edit
is documentation only.

Remaining: independent exact harness/source correction review; root combined
check/fresh build and separately released offline UI run with production asset
manifest. No browser screenshots/checks are claimed. Actual DB/RLS/privacy,
entitlements/concurrency/copy/lifecycle remain G2; private NPC authoring, supported
import/sharing and DM instances are separate required R17 children. This bounded
read-only foundation does not complete R17, M5 or beta acceptance.
