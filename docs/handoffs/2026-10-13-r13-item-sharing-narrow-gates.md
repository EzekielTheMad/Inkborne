# R13.1 narrow local gates and preserved before controls

Tested clean checkpoint c0f09b58c37c3d5ce6ffa3b396de389e0f705fe8 in r13-item-sharing-worker / codex/r13-item-campaign-sharing. Production remains independently reviewed b569b8f050cc61b565a46b89c064b299d48535e3; isolated basefccfc1d and original source471 remain preserved. Separate offline harness919066d remains browser-UNRUN; approved correctionab1fde4a754484a2509057421c2de298f8924bd5 is test-only, approvedc0f09b5 is fixture-only. No production/SQL/dependency correction was needed during these gates.

Meaningful before controls, same new tests/interfaces/mocks retained:
- Old DAL runtime row envelope and original owned query scope portions only (new sharing exports retained):6 failed/47 passed. Actual received valid shared owned row rejected by the old personal-only parser; actual metadata update returned refusal; scope query controls expose personal-only filters. Ordinary private/create/effects/Auth/received sharing controls retained. No missing export failure.
- Exact old ItemForm blob fromfccfc1d:2 failed/5 passed. Actual mounted typed name/description remain first; hidden version silently becomes3 instead of retained2, or ID becomes the different item ID; original/same-version controls pass. No replacement constructor or missing form.
- Exact old campaign action blob fromfccfc1d:2 failed/15 passed. Actual original revoke enum rejects item and routes invalid_content_share; original feat/background/other campaign behaviors remain. New test mocks stay present.
- Exact original471 panel blob with valid new action mock and same-tick native submit test:1 failed/25 skipped. Two actual native submit events in the same act tick queue2 action invocations after a valid first response. Hidden tuple/real component/actions remain present; no fake pending constructor/import substitute.

Four original mounted byte buffers restored in finally before current-source gates; exact before=after hashes:
DAL14885bytes 5101cef2c85b0b2d7bbefd682f1d8a570f93b18d124aacfa7b08c8e8f73453ce;
ItemForm6205bytes 30ea6a720ebf885ffbd87b691cadee9d0e798ed6484f47e9c12dd4aa1b2fb761;
campaign actions14598bytes a3e8db180db77358b05456987e73a83d37cf8127ac43d87c2e7430a1383cab77;
panel12012bytes 63d364bb07b7d92ba5772f7ad8487689dfe8ef4843d0736294a8aa0ab407f50d.
All exact hashes/restoration assertions are preserved in restoration.json.

First current run at919:12 files,195 tests,192pass/3fail; failures were test setup/oracle ambiguity only. beforeEach returned share.mockReset(), which Vitest treated as a cleanup function and called the action mock with no arguments or created a rejected promise after the test. Approvedab1 removes that returned function; the actual edit page has2 legitimate identical pin notices, now both required visible with exact count2. First typecheck passed; first lint failed only new offline fixture unused Set ternary and render-time module revalidate assignment. Approvedc0 changes to explicit Set if/else and a registered CustomEvent useEffect listener with cleanup/functional updates. Tests/scenarios/authority admission oracles unchanged. First failures/logs preserved, not replaced by later pass.

Final sequential local gates at cleanc0:
npm.cmd test -- tests/supabase/homebrew-items-server.test.ts tests/app/homebrew-item-actions.test.ts tests/app/campaign-actions.test.ts tests/app/homebrew-page.test.tsx tests/components/library/item-form.test.tsx tests/components/library/item-sharing-panel.test.tsx tests/app/homebrew-item-edit-page.test.tsx tests/supabase/campaign-shared-content-server.test.ts tests/supabase/item-campaign-sharing-staged-contract.test.ts tests/supabase/campaign-homebrew-spell-sharing-migration-contract.test.ts tests/supabase/background-authoring-sharing-migration-contract.test.ts tests/supabase/feat-selection-sharing-migration-contract.test.ts --maxWorkers=2 --reporter=verbose
PASS12files/195tests (9 scoped suites +3 retained original-family SQL source oracles),13.11s Vitest duration.
npm.cmd run typecheck PASS.
npm.cmd run lint PASS.
Git clean and diff hygiene passed. Required broader check/build and actual offline browser are parent-owned queued gates, not claimed here.

Evidence directory test-results/r13-narrow-20261013 preserves10 gate JSON/stdout/stderr receipts, exact restoration, monitor/baseline source scripts and final readback. Manifest SHA256752808c577529b7857cbe74b3e14ca3e33497a2a44e876d88933d3d57d197995 binds every receipt/log/script. First7 gates recorded53 process identities; final3 recorded27, total80 distinct PID+OS birth/parent/command identities. All10 gate cleanup readbacks0remaining/0ownedlisteners; final fresh OS readback2026-10-13T17:31:41.1227999Z confirms all80 absent. Command/cwd/start/resources recorded per gate; cwd established by Start-Process.WorkingDirectory and actual Vitest RUN own-worktree path. Global process count458→504, aggregate working set33065631744→34242793472bytes, CPU107988.484375→109138.578125s, listeners46→46; unrelated/shared host growth was preserved. No broad executable-name kill, server/browser or provider process. Exclusive heavy slot released to root immediately after readback.

No SQL/DB/PGlite, install/dependency change, build/browser/server/network/provider operation ran. SQL proof remains source-static; real PostgreSQL/Auth/RLS/current permission/CAS/snapshot rollback/revoke/history/pins acceptance remains G2. Offline harness browser review/execution and parent full/build still pending; no full R13 or beta-completion claim. M7/PDF importer remains paused; this child follows M1–M6 includingM5.5 thenM8 priority.
