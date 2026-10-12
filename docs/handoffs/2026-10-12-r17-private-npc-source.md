# R17.2 private NPC source checkpoint — unverified

2026-10-12, owned `r17-library-npc-worker`, branch
`codex/r17-library-npc-plan-20261012`, base `293c3d1` approved authoring plan over
reviewed R17.1. No root changes cherry-picked. Existing strict NPC schema,
canonical empty-effects parser, story/private/copy/pins/table and algorithms
remain unchanged.

New NPC mapper/form/DAL/actions/new/edit routes and minimal Homebrew family.
Bounded narrative controls preserve optional object/list absence, empty lists,
order and duplicate ideas; local row keys stay out of JSON. Native draft reset,
pending single submission, invalid field focus, uncertain-create manual check/
acknowledgment and edit reload lock follow the approved passive-feature pattern.
Confirmed saved version is retained before navigation to plain `/homebrew`, with
no unconditional created/updated query notice or latest-version/private claim.

Server derives authentication/system/private envelope and freezes UUID/slug
before INSERT. Raw group merge validates without serializing stripped parser
output; invalid raw extensions/effects/missing effects refuse without repair.
UPDATE omits effects; owner/system/type/source/scope/active expected-version read,
CAS and missing reread remain scoped. Only strictly newer eligible reread is
conflict; same/older is uncertain. No-op asserts only no write by this invocation;
changed pg MAX refuses. Saved response requires exact returned v1/v+1 plus exact
immutable version snapshot/owner/system/type/scope/raw data, never latest. A later
v+2/scope race does not alter the saved pin or imply its current privacy.

Prepared tests: finite mapper/intent/shape/order/transport/name/version/response,
modeled DAL authority/CAS and isolated immutable confirmation failures, raw
unsupported originals/no-op/MAX/foreign denial, actions revalidation, routes,
actual form/native reset/pending/conflict/uncertainty/no-reinsert and Homebrew
discovery/read-error isolation. All are SOURCE ONLY; no test/type/lint or browser
result claimed. Modeled PostgREST/auth/actions/nav do not prove SQL/RLS/CAS races.

Static `git diff --check` only; root owns heavy/build/UI, no install/server/test/
typecheck/lint/full/build/browser/network/SQL/provider/hosted action. No owned
process/listener started. Next source preparation is separately guarded actual
form offline fixture/config. G2 authorities/snapshot triggers/concurrency/cleanup
and remaining sharing/import/DM/lifecycle children remain open. Independent exact
source review precedes resource/browser release.


Source correction checkpoint: `1fc362009f260ca3469fb4440a4f884b702c2e79` independently approved by root. Unexpected nonblank idle responses now become create/edit uncertainty. Mapper reserves two edit control paths within the total 100-field feedback bound. Mapper/form/DAL regressions prepared; no validation executed at this checkpoint.

Offline harness source preparation (not browser acceptance): explicit config `e2e/local-npc-authoring/playwright.config.ts`, command after separate release `npm.cmd run test:e2e -- --config e2e/local-npc-authoring/playwright.config.ts`. Artifact directory `test-results/npc-authoring-local`, default manifest `test-results/npc-authoring-local/production-artifacts.json`. Six owned executable/fixture/config files; two inherited executable helper receipts (`npc-process.mjs` and `passive-feature-production-assets.mjs`). Passive helper exact Git blob `e4058f8a31cd911583a312e59fedcf4c3fd4adae`; both helpers independently bound to reviewed correction checkpoint/root/index/actual Git-filter checkout bytes before shared validator use. Eight explicit form/mapper/schema/DAL/action/route/Homebrew source paths separately bound to correction checkpoint, current root and raw mounted bytes; actual metafile transitive project inputs, installed Next helper and lock bound as well. Existing read-only NPC loader is not invoked as new-form authority.

Intent: nine original scenarios on desktop1280/mobile390 = 18 grouped case receipts and 20 viewport screenshots/font samples. Structured presence/empty/duplicate/order/long narrative/reachable controls; invalid focus; pending duplicate; undefined/malformed/idle create uncertainty, idle edit lock; saved version with modeled navigation failure/no second insertion; native reset draft retention; explicit Check Homebrew plus acknowledgment; edit conflict/native reload modeled stored version. No tests/browser/build/install executed for this harness checkpoint. Needs reviewed source closure present in frozen root plus new successful clean production build receipt, actual BUILD_ID, complete compiled CSS and local font asset/hash manifest. All actions/Auth/DAL/pin confirmation/navigation/latest read are explicit models; native form/reset/reload and production styling are real. No SQL/RLS/persistence/server-shell/hosted/concurrency acceptance.


Released narrow validation, product exact `1fc362009f260ca3469fb4440a4f884b702c2e79` (harness64b/a30): old5da mapper only with corrected tests/form produced seven semantic failures and47 positive passes across3files54tests; no collection/module failure. Idle controls observed unlocked buttons; many-path feedback observed102keys and actual-form uncertainty. Baseline finally restored approved raw mapper SHA256 `0e15cdcdfab0e51c6b253f2bf3f21e10fc9f5a9a08f08196113cf49a5d7df405`; clean status. Exact failing receipt/stdout/stderr and restoration preserved in ignored `test-results/r17-npc-authoring-gates`.

Corrected focus command `npm.cmd test -- tests/lib/homebrew/npc-form.test.ts tests/components/library/npc-form.test.tsx tests/supabase/homebrew-npcs-server.test.ts tests/app/homebrew-npc-actions.test.ts tests/app/homebrew-npc-pages.test.tsx tests/app/homebrew-page.test.tsx tests/schemas/npc.test.ts --maxWorkers=2`: 7files95tests PASS. `npm.cmd run typecheck` PASS at64b. Initial repository lint failed only new harness helper identifier module; separate two-line rename commit `a30f203a56e478bf13ae3e8587ad998802bf4907`; `npm.cmd run lint` then PASS zero warnings. Five gate receipts record OS birth/PID/parent/exact command/cwd/start/resources/readback; final51 captured identities including wrappers, zero exact live task processes/listeners. No install/full/build/browser/SQL/provider call; lock unchanged. Heavy slot released to root.

Subsequent source-only harness review corrections: stub namespace now supplies explicit workspace resolveDir for React and actual unstable_rethrow resolution. Both runner and Playwright wrapper independently verify fixed helper Git blobs, clean index/working tree, raw anchored checkout bytes plus narrow configuration/attributes BEFORE dynamic process-helper import/first call; repeated proof at asset binding/end and before forced cleanup. All six own harness raw mounted bytes are separately recorded/rechecked alongside Git blobs. These new source guard changes have static diff validation only; do not inherit earlier typecheck/lint as execution proof for the amended harness. Browser remains pending root source review/fresh build/release.
