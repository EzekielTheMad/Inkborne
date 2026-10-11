# Inkborne Codex orchestration entrypoint

Updated October 11, 2026. This file owns the execution queue and operating rules. Product direction stays in [GAME-PLAN](GAME-PLAN.md) and [ROADMAP](ROADMAP.md); evidence stays in [CURRENT-STATE](CURRENT-STATE.md), [RELEASE-READINESS](RELEASE-READINESS.md) and their handoffs. Old approval quotes, counts and milestone wording are historical, not fresh authorization.

## Start and claim sole ownership

Use Main_PC and this resume directory:

```text
C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-verification
```

Branch `codex/equipment-executable-verification`; implementation checkpoint `77e9a95687d83523cbdf3618620def2648e9d297`, based on local core `7b7f45bd9f64dbe847238ac108eaed9fa6bcdc32`. Later branch commits contain the handoff. Read actual HEAD before editing. This worktree shares Git with the isolated `...\task-2\dev-candidate` clone, **not** the original repository's Git common directory.

The registered original repository is `C:\Projects\Inkborne`; its root is an old backup branch with user changes, not the current app checkpoint. Read applicable checkout AGENTS/skills and the original root's AGENTS worktree/process conventions. Original `.agents` was empty at inspection. Relevant local history is in `C:\Users\kaios\.codex\memories\MEMORY.md` under Inkborne; treat it as context, not permission. Do not read credential files.

Refresh state before dispatch:

```powershell
git rev-parse --show-toplevel --git-common-dir HEAD
git branch --show-current
git status --short --untracked-files=all
git worktree list --porcelain
git --no-optional-locks -C C:\Projects\Inkborne worktree list --porcelain
```

[Worktree inventory](handoffs/2026-10-11-worktree-inventory.json) records all inspected original/task-owned paths, branches, SHAs and tracked/untracked entries at the implementation checkpoint. Refresh every selected candidate; the handoff commit itself is newer than the snapshot. Root untracked directories were preserved as directory entries rather than recursively flattening active nested checkouts.

Preserved dirty work includes root `AGENTS.md`, `.codex/`, two generated build directories and `worktrees/`; two importer-spec files; three alpha-readiness documents; and substantial equipment/content/parser/test/migration work under `.codex/worktrees/content-versioning-rls`. That last worktree also reported missing/permission-denied auth paths: investigate before treating reported deletions as intentional. Do not reset, stash, clean, overwrite or publish any of it. Original core at `...\2026-10-02\task\inkborne-core` is clean at `7b7f45b`. `dev-candidate` is clean/detached at `5c85e5f` (optional local dev-label patch, not deployed). `splash` is a separate clean repository at `0837d829c739ecf8b767005f78ad71aa11f5f0ea`; splash implementation is finished.

The prior worker has paused development and stopped its owned test/browser/server processes. The new thread becomes sole integration owner. Other tasks and unrelated processes remain outside its ownership.

## Ready and blocked queue

Keep character-builder-to-play first. Preserve mechanics, narrative, campaigns and existing LegendKeeper use; no broad redesign or new sharing/effect/worldbuilding scope.

| ID | Status | Bounded result / acceptance |
| --- | --- | --- |
| L1 | **Complete locally** | [Lint repair](handoffs/2026-10-11-l1-lint.md), worker `0f0f993`, integrated as `7e1c831`: all ten findings fixed without rule disables; full check 221 files / 2,231 tests, dummy build and 40 offline component checks passed. |
| E1 | Local slice done; runtime lane blocked | [Equipment checkpoint](handoffs/2026-10-11-equipment-postgres-wasm.md): 45 executable SQL-WASM cases; copy ledger variable renamed to avoid the existing feature-grant alias. Remaining: complete disposable Supabase migration-chain/grant/trigger replay, multi-connection award/pin/owner/copy races and rollback. Prepare exact runtime proposal; obtain approval before runtime/schema/fixture operations. Keep rollout default-off. |
| A1 | Local integration in progress; hosted acceptance blocked | Isolated `codex/core-ability-save-integration` from `7e1c831`. Integrate reviewed [PR101](https://github.com/EzekielTheMad/Inkborne/pull/101) without losing core guards. Head `794fd87849b715ee5497599409bc0c0d2f88c1d0`; base main `6b8601f976d3ee121d11f2ec33c7383393024b91`. Preserve draft/navigation/account-change recovery and existing owner RPC; focused/full gates and offline UI, review conflict resolutions. Real owner/trigger/multi-connection/browser acceptance requires new named accounts/fixtures permission. |
| T1 | Offline reproduction in progress | Isolated `codex/t1-e2e-drift`. Reproduce campaign heading, two homebrew success expectations, Spells label and MPMB feat-navigation timeout. Fix semantic selectors/synchronization only after evidence; record/skip currently valid selectors. No default hosted E2E or timeout inflation. |
| M1 | Independent local revalidation ready | Revalidate existing [PR99](https://github.com/EzekielTheMad/Inkborne/pull/99), head `4cbd70bb475d35421974851fedac2afb70480f84`, in its own clean worktree. Preserve immutable private magic-item versions, owner isolation, stale-edit conflicts. Focused/full gates and offline UI; report remaining hosted acceptance. No new sharing/effects/migrations. |
| D1 | Local characterization/proposal complete; schema implementation blocked | [One-command contract](specs/2026-10-11-durable-roll-state-contract.md) and [E1 runtime proposal](specs/2026-10-11-equipment-runtime-proposal.md), worker `4b3d9d3`, integrated as `ad3af15`. Eight focused provider/current-SQL gap checks pass; TypeScript passes. Combined full gate is pending assembly. No schema/API implementation or service startup. |
| R1 | Blocked deployment/access lane | Exact auth cutover prerequisites below. [PR80](https://github.com/EzekielTheMad/Inkborne/pull/80) provider UAT, admin-feedback UAT and Unraid backup/restore need access. Continue independent local work while they are blocked. |

Verified shipped: [#67 journey polish](https://github.com/EzekielTheMad/Inkborne/pull/67), [#98 canonical E2E fixture repair](https://github.com/EzekielTheMad/Inkborne/pull/98), #100 documentation hygiene; compendium #96/#97. Do not rebuild them. GitHub had zero open issues and draft/unmerged PRs #80/#99/#101 at inspection; recheck before publication. [Existing milestone](https://trello.com/c/kuytlqFp/13-select-and-deliver-inkbornes-next-playable-milestone) is context, not authority/current evidence.

## Verification facts and commands

At `77e9a956`: 73/73 focused SQL/application tests, 221 files / 2,230 separate full unit tests, dummy-config optimized build, and one offline Playwright spec containing 24 real-component desktop/mobile checks passed. UI persistence/router were simulated; zero page errors/remote requests. `npm run check` passed TypeScript then failed L1 lint and never reached Vitest. **Full quality gate is not green.** PGlite is synthetic/single-connection: full baseline/feature triggers/ASI-copy execution, live grants and concurrent locks remain unverified. No hosted data/schema/auth changes occurred.

Node requirement is `>=22`; this checkpoint used installed 24.14.0. Use the lockfile and repository scripts:

```powershell
npm test -- tests/supabase/starting-equipment-postgres.test.ts tests/supabase/starting-equipment-staged-contract.test.ts tests/app/starting-equipment-actions.test.ts tests/app/starting-equipment-page.test.ts
npm run check
$env:NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co'
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY='ci-placeholder'
$env:SUPABASE_SERVICE_ROLE_KEY='ci-placeholder'
npm run build
npm run test:e2e -- --config e2e/local-equipment/playwright.config.ts
```

Those values are synthetic. Use a fresh build process so they cannot become a live server configuration. Offline UI needs build CSS. **Default `npm run test:e2e` loads hosted config and can create/delete data; do not run it under local-only authority.** For a separately approved dev data target, use `npm run dev -- --hostname 127.0.0.1 --port <free-port>` with process-scoped config; otherwise use offline fixtures.

Logs are in sibling `..\verification\equipment-{postgres-focused,unit-suite,check,build,offline-ui}.log` (expand each name); browser evidence is `test-results\builder-local\evidence.json`. Preserve failures/receipts/generated evidence. Record PID/parent/cwd/command/port/start time for long-lived processes, stop only owned trees and verify ports close.

## Operating and approval loop

Refresh HEAD/status/instructions, declare task owner/base/paths/acceptance, then assign one writer per clean isolated worktree/branch. Delegate self-contained tasks with invariants and prohibitions. Parallelize independent work only; serialize integration, expensive checks and shared UI as needed. Obtain read-only review for consequential changes. Do not edit active unrelated worktrees or interfere with Steam/other desktop tasks; coordinate sole UI ownership first.

Run narrow tests, required full gates and representative UI; classify product/harness/environment failures and report exact tested source plus limits. Integrate only reviewed local results, commit logical checkpoints, append the progress log below and update existing evidence links. Continue ready independent tasks until the authorized queue is exhausted or Victor pauses it; blocked release work does not stop local progress.

Local implementation/testing and local commits are authorized. **Remote pushes/publication, PR merges, deployments, migration/history changes, hosted fixture/data writes, database/auth/security settings, credentials/access expansion, new paid services and external messages need explicit approval.** No blanket migration push, forced `--include-all`, credential inspection/copying or protection disabling. The ten earlier hosted fixture allowances are exhausted and cleaned; never reuse/reset them.

For actual approval, ownership or private-data blockers, stop dependent work and record exact operation/target/risk, concrete proposed diff/rollout, evidence and smallest decision. Continue unaffected work. Do not bypass automatic review rejection through another path. On handoff, checkpoint cleanly, preserve uncommitted work if any, and stop owned workers/servers.

## Precise blocked release lane

- Domain is **inkborne.app**, final e. Unrelated `inkborn.app` must not be touched. Apex still serves old app; no DNS change occurred.
- Vercel team `team_gZZdNu24Ux7R6F93mtOzojtj` (`ezekielthemads-projects`), app `prj_LWMhTpauZDDqLACtHhvIg6vTQ0W1`.
- [Dev](https://dev.inkborne.app): READY alias `dpl_DhxZx9rpL8Yy4TAd2EunPoUD1Es9`, PR101 SHA `794fd87849b715ee5497599409bc0c0d2f88c1d0`, branch `fix/builder-ability-save-order`. Branch-only preview public URL is dev; production public URL remains apex. Normal browser requires Vercel SSO. Authenticated connector confirmed login HTML HTTP200; real app/provider/PKCE login acceptance is not done.
- [Splash](https://inkborne-splash.vercel.app): project `prj_quNoruR1m6Y9bFckSOfxAd0ob9Jd`, READY `dpl_3c3kLsgnrNbTVm4aXuNEtJQkckX7`, source `0837d829c739ecf8b767005f78ad71aa11f5f0ea`. Library ZIP `libfile_34ae192c3a308191a54b25b853080e66`, version 1. Finished; separately owned.
- Supabase `etcaodglvcspcmwecyxq` was healthy. **Ability migration `20261010232200_save_character_abilities` is already applied/verified; do not reapply.** URL config/email templates are uninspected. Cloudflare auth is pending; Vercel/Supabase dashboard browser sessions were signed out. Native browser tools previously failed initialization. Recheck supported access; never extract sessions/tokens.

Before apex cutover, verify owned Cloudflare zone/records and approved non-secret auth config; exact dev `/auth/callback`, `/auth/reset-password`, and `/auth/callback?next=%2Fsettings&linked=google` / Discord when enabled. Inspect Site URL and `.SiteURL`/`.RedirectTo` email behavior; accept actual dev-origin PKCE/session/login/sign-out/recovery through SSO with separately approved accounts. Prepare an app-capable production origin, request exact auth/security changes, and create/test new deployments as approved (env changes do not update old deployments). Preserve SSO/database access/unrelated DNS/email records. Prepare rollback to the previous apex app association before any domain move. **Do not blindly switch apex.**

## Resumable progress log

Append rows here; detailed bounded handoffs link from current-state, not competing roadmaps.

| UTC date | Owner / source | Result | Next / blocker |
| --- | --- | --- | --- |
| 2026-10-11 | Previous local worker; `77e9a95687d83523cbdf3618620def2648e9d297` | Equipment executable slice + copy alias fix; 73 focused, 2,230 unit, build and 24 offline UI checks passed. | L1 ten inherited lint findings; full Supabase/race acceptance blocked. |
| 2026-10-11 | Handoff preparation on this branch | Development paused for a fresh sole-owner Codex orchestrator; no owned servers/workers active. | Refresh status and start L1. |
| 2026-10-11 | Sole orchestrator; refreshed `56db57e` | Claimed clean integration checkout; original backup checkout and all inherited changes preserved. [Refreshed inventory](handoffs/2026-10-11-orchestrator-worktree-inventory.json). L1, M1 and D1/E1 assigned to separate isolated workers. GitHub readback confirms #99/#101 remain draft/unmerged at recorded heads. | L1 full gate first; serialize expensive verification and integration. Local-only scope; release/runtime/hosted approvals remain pending. |
| 2026-10-11 | Sole orchestrator; `ad3af15`, `7e1c831` | Reviewed/integrated D1/E1 characterization and proposals, then L1 lint fix. L1 full check 2,231 tests, build and 40 offline checks passed; D1 eight focused checks/typecheck passed. | M1 expensive validation active; A1 integration and T1 reproduction in isolated workers. Final combined gate pending. |

## Pasteable kickoff

Act as Inkborne's sole Codex orchestrator on Main_PC. Start in `C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-verification` and read `docs\CODEX-ORCHESTRATOR.md`, applicable AGENTS/skills, linked current-state/backlog/evidence and worktree inventory. Refresh HEAD and candidate tracked/untracked changes. Delegate bounded ready tasks to workers in clean isolated worktrees, preserve unrelated work/established behavior, verify focused/full gates and representative offline UI, review results, commit local checkpoints and append progress. Start with L1's lint failures; continue independent ready work without rebuilding completed features. Do not push, merge PRs, deploy, apply migrations, mutate hosted data/auth/security or create credentials without my explicit approval. Stop dependent work for actual approval/ownership blockers, record exact proposed actions, and continue unaffected work. Pause owned workers/servers cleanly on handoff.
