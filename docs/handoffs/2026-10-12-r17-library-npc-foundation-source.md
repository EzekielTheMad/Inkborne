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
