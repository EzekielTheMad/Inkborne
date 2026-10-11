# Inkborne Codex orchestration entrypoint

Updated October 11, 2026. The authorized local queue is complete at [the final checkpoint](handoffs/2026-10-11-orchestrator-local-queue.md): core 2,292 tests/build/53 offline checks; independent M1 1,805 tests/build/12 offline checks. Only gated runtime/hosted/release lanes remain. This file owns the queue and operating rules. Product direction stays in [GAME-PLAN](GAME-PLAN.md) and [ROADMAP](ROADMAP.md); evidence stays in [CURRENT-STATE](CURRENT-STATE.md), [RELEASE-READINESS](RELEASE-READINESS.md) and their handoffs. Old approval quotes, counts and milestone wording are historical, not fresh authorization.

## Start and claim sole ownership

Use Main_PC and this resume directory:

```text
C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-verification
```

Branch `codex/equipment-executable-verification`; exact tested application checkpoint `ada6c9b8c51c8d674c6a76dbf4df1f9955ce5cdf`, based on local core `7b7f45bd9f64dbe847238ac108eaed9fa6bcdc32`. Equipment baseline `77e9a956` is historical; later commits integrate lint/durable-gap/selector/ability work. Closing documentation follows the tested application commit; read actual HEAD before editing. This worktree shares Git with `...\task-2\dev-candidate`, **not** original Git.

The registered original repository is `C:\Projects\Inkborne`; its root is an old backup branch with user changes, not the current app checkpoint. Read applicable checkout AGENTS/skills and the original root's AGENTS worktree/process conventions. Original `.agents` was empty at inspection. Relevant local history is in `C:\Users\kaios\.codex\memories\MEMORY.md` under Inkborne; treat it as context, not permission. Do not read credential files.

Refresh state before dispatch:

```powershell
git rev-parse --show-toplevel --git-common-dir HEAD
git branch --show-current
git status --short --untracked-files=all
git worktree list --porcelain
git --no-optional-locks -C C:\Projects\Inkborne worktree list --porcelain
```

[Final inventory](handoffs/2026-10-11-orchestrator-final-worktree-inventory.json) records 31 checkouts; all 23 inherited HEAD/branch/status entries match discovery, and all five workers are clean/completed. The earlier [equipment inventory](handoffs/2026-10-11-worktree-inventory.json) is historical. Refresh every selected candidate; closing documentation follows the final snapshot. Root untracked directories remain directory entries, not flattened nested checkouts.

Preserved dirty work includes root `AGENTS.md`, `.codex/`, two generated build directories and `worktrees/`; two importer-spec files; three alpha-readiness documents; and substantial equipment/content/parser/test/migration work under `.codex/worktrees/content-versioning-rls`. That last worktree also reported missing/permission-denied auth paths: investigate before treating reported deletions as intentional. Do not reset, stash, clean, overwrite or publish any of it. Original core at `...\2026-10-02\task\inkborne-core` is clean at `7b7f45b`. `dev-candidate` is clean/detached at `5c85e5f` (optional local dev-label patch, not deployed). `splash` is a separate clean repository at `0837d829c739ecf8b767005f78ad71aa11f5f0ea`; splash implementation is finished.

The sole orchestrator completed the local queue and stopped its owned work; no task workers/servers remain active. Retained worker branches are review artifacts. Other tasks and unrelated processes remain outside its ownership.

## Ready and blocked queue

Keep character-builder-to-play first. Preserve mechanics, narrative, campaigns and existing LegendKeeper use; no broad redesign or new sharing/effect/worldbuilding scope.

| ID | Status | Bounded result / acceptance |
| --- | --- | --- |
| L1 | **Complete locally** | [Lint repair](handoffs/2026-10-11-l1-lint.md), worker `0f0f993`, integrated as `7e1c831`: all ten findings fixed without rule disables; full check 221 files / 2,231 tests, dummy build and 40 offline component checks passed. |
| E1 | Local slice/proposal done; runtime lane blocked | [Equipment checkpoint](handoffs/2026-10-11-equipment-postgres-wasm.md): 45 SQL-WASM cases and copy alias fix. [Runtime proposal](specs/2026-10-11-equipment-runtime-proposal.md) separates provisioning, verified bind/resource plan, scratch SQL/fixtures/ephemeral credentials and hosted gates. Full migration-chain/grant/trigger replay, multi-connection races and rollback remain. Keep rollout default-off. |
| A1 | **Complete locally; hosted acceptance blocked** | [PR101 integration](handoffs/2026-10-11-a1-ability-integration.md), worker `4922740`, integrated `ada6c9b`; core guards/types retained, independently reviewed. Exact PR head `794fd87849b715ee5497599409bc0c0d2f88c1d0`, base `6b8601f976d3ee121d11f2ec33c7383393024b91`. Fresh combined full check 2,292 tests/build/53 offline checks covers final wording and T1. No RPC reapplication. Actual owner/trigger/race/browser acceptance needs named accounts/fixtures approval. |
| T1 | **Complete locally** | [Current-source reproduction](handoffs/2026-10-11-t1-e2e-drift.md), worker `370476a`, integrated as `6452fc8`. Repaired two Homebrew notices, mobile Spells multiplicity and ASI option provenance. Campaign heading/Level 4 path pass unchanged. Full check 223 files / 2,239 tests; 10 offline checks. Historical hosted timeout causes remain unproved. |
| M1 | **Complete independently; hosted acceptance blocked** | [PR99 revalidation/fix](handoffs/2026-10-11-m1-magic-item-revalidation.md), tested source `3d61ff3747dbb04da55d9fb436753e71b1596d29`, documentation HEAD `6c740f0`. Native reset listener fixes reproduced Rarity loss after action validation. Final full check 1,805 tests/build/12 offline checks pass. Original PR99 `4cbd70bb` unchanged; fix is standalone, not in core/published. Actual owner/immutable-version/race/Library acceptance remains gated. |
| D1 | Local characterization/proposal complete; schema implementation blocked | [One-command contract](specs/2026-10-11-durable-roll-state-contract.md) and [E1 runtime proposal](specs/2026-10-11-equipment-runtime-proposal.md), worker `4b3d9d3`, integrated `ad3af15`. Eight provider/current-SQL gap checks pass and are included in the final 2,292-test full gate. No durable schema/API implementation or service startup. |
| R1 | Blocked deployment/access lane | Exact auth cutover prerequisites below. [PR80](https://github.com/EzekielTheMad/Inkborne/pull/80) provider UAT, admin-feedback UAT and Unraid backup/restore need access. Continue independent local work while they are blocked. |

Verified shipped: [#67 journey polish](https://github.com/EzekielTheMad/Inkborne/pull/67), [#98 canonical E2E fixture repair](https://github.com/EzekielTheMad/Inkborne/pull/98), #100 documentation hygiene; compendium #96/#97. Do not rebuild them. GitHub had zero open issues and draft/unmerged PRs #80/#99/#101 at inspection; recheck before publication. [Existing milestone](https://trello.com/c/kuytlqFp/13-select-and-deliver-inkbornes-next-playable-milestone) is context, not authority/current evidence.

## Verification facts and commands

Fresh `ada6c9b` combined root gate: **226 files / 2,292 tests**, TypeScript/zero-warning lint, synthetic optimized build and **4 offline specs / 53 checks** pass. Independent M1: 198 files / 1,805 tests, build and 12 offline checks. [Final handoff](handoffs/2026-10-11-orchestrator-local-queue.md) indexes exact commands/logs/process receipts and limits. These are local acceptance, not release approval.

**Historical baseline:** at `77e9a956`, 73 focused tests, 2,230 separate full unit tests, build and 24 offline checks passed; `npm run check` stopped at ten inherited lint errors. L1 repaired them. PGlite remains synthetic/single-connection: full baseline/feature triggers/ASI-copy, live grants and concurrent locks are unverified. No hosted data/schema/auth changes occurred in this continuation.

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

The deployment/DNS/session snapshot below is inherited from the prior worker, not refreshed acceptance. This continuation only refreshed Supabase project metadata (`ACTIVE_HEALTHY`) and PR99/101 heads/status; recheck exact targets and supported access before any live action.

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
| 2026-10-11 | Sole orchestrator; `6452fc8` | T1 reviewed/integrated after 2,239-test full gate and 10 offline checks. PR101 independent read-only review approved; its full gates running. M1 real-action form regression prompted a scoped reviewed draft-retention repair. Read-only project metadata confirms Inkborne `ACTIVE_HEALTHY`. | Finish A1/M1 verification and final combined gate. Healthy metadata does not accept auth/trigger/concurrent behavior; no hosted writes. |
| 2026-10-11 | Sole orchestrator; tested core `ada6c9b`; M1 source `3d61ff3` | Authorized local queue complete. Fresh combined 2,292-test full gate, build and 53 offline checks; independent M1 1,805/build/12 checks. [Closing handoff](handoffs/2026-10-11-orchestrator-local-queue.md). All 23 inherited checkouts unchanged; five workers clean/completed; observed task processes/ports closed. | Only runtime/hosted/publication/auth/domain/backup approval/access lanes remain. No push, PR merge, deployment, hosted mutation or credentials. |

## Pasteable kickoff

Act as Inkborne's sole Codex orchestrator on Main_PC. Start in `C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-verification` and read `docs\CODEX-ORCHESTRATOR.md`, applicable AGENTS and the October 11 closing handoff/inventory. Refresh actual HEAD/status. L1/A1/T1 local work and D1/E1 proposals are complete; M1 is a separately tested PR99-derived branch. Do not rebuild them or invent new features. Reconcile the exact next approved runtime/hosted/publication lane, present concrete targets/dry-run/rollback/verification and request required approval. Preserve unrelated work and exhausted fixture journals. Do not push, merge PRs, deploy, apply migrations, mutate hosted data/auth/security or create credentials without explicit approval. Delegate only bounded approved work in isolated clean worktrees, record exact evidence, update this handoff and stop owned processes cleanly.
