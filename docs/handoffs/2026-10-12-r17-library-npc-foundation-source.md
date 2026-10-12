# R17.1 NPC Library source checkpoint — unverified

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
The shared-fixture browser check now asserts the actual visible `Campaign shared`
badge rather than claiming it solely from escaped text.

Root released install/narrow/typecheck/lint, with browser/full/build still held.
Locked install passed: 804 packages in 35 seconds, four captured OS identities,
zero remaining exact processes/listeners. No lock/dependency edits. Receipt/logs
are ignored `test-results/r17-focused-gates/ci.*`; core failing-before and focused
gates follow this separate correction freeze. Existing claims above describe the
earlier source-only checkpoints, not completed test/browser acceptance.
