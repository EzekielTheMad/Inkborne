# Ordinary builder save recovery

Continuation: `equipment-verification`, branch
`codex/launch-integration-20261011`, from checkpoint `753e9bd`.
The old `C:\Projects\Inkborne` backup, accepted work and inherited worktrees
remain untouched. New isolated workers retain their local checkpoints and
dependency junctions. Vercel is unchanged; M1–M6/M5.5 precede M8 and
M7/creature imports remain paused.

## Implementation

The browser retains one complete, validated, deeply frozen original intent in
account/character-scoped session storage before sending any ordinary builder
save. All six ordinary steps share this boundary. Unknown results retain the
operation across reload; **Check save** resolves only that operation and
**Retry original save** resends exactly the original request. Absence never
permits silently replacing its operation ID or expectations.

Server submit/check actions reverify the current account/session and preserve
the native owner/session locks. Both server and browser verify actor, character,
operation, command and exact raw domain fields before clearing the exact local
record. The old bound adapter fails closed without a supplied operation ID;
the server no longer mints ordinary-save operation IDs. No SQL, migration,
privilege or activation gate changed.

Sign-out/account changes use the existing creation-session lease and namespace
cleanup. Storage failures prevent sending; malformed pending records remain
blocked and retained. Unknown saves show recovery controls and unmount editors,
including their portalled dialogs/drawers, so they cannot obscure recovery.

Confirmed recovery unmounts editor guards, releases only the target ability
draft and reloads the document from current saved values. It does not apply a
historical receipt snapshot as current character state. The shared delegate
reads current committed readiness, and retained ability queues update their
future-write adapter after SPA remounts. Focused tests cover historical score 14
versus current score 17 and the following edit's expected score 17.

Source: server contract/actions `9933f1a`, deeply frozen intent `736beb8`,
integrated UI `20a682d`, actual-app/readback `36749ee` with exact-request,
recovery-only and TypeScript corrections through `d6c55b5`; framework-navigation
fixture correction `2cb5c89`.
Workers retain UI `541f9c2` and E2E `6cea0d5`.
[Contract](../specs/2026-10-23-builder-save-recovery.md).

## Focused verification

- Final integrated eight-file sweep: **142 pass**,
  `local-builder-recovery-focused-20261024T001909Z`, 24.1 seconds;
  all 16 recorded identities exited. This includes server actions, pending
  storage, boundary/real ability recovery, Auth lifecycle, first class,
  ability drafts and class regressions.
- Worker eleven-file sweep: **190 pass**, 29.55 seconds, also covering
  background, equipment, details, race and first-class storage. Its tool output
  is retained in session 82006; no separate worker log/resource snapshot exists.
  Worker command-line inspection found no remaining Node process.
- Initial server/ability/race sweep: **79 pass**,
  `local-builder-transport-20261024T000648Z`, all 8 identities exited.
- Unchanged class baseline: **14 pass**,
  `local-builder-recovery-class-baseline-20261024T001424Z`, all 6 identities exited.
- Final `npm.cmd run typecheck` and zero-warning `npm.cmd run lint` pass:
  `local-creation-browser-check-20261024T002436Z`, 48.0 seconds, all 8 recorded
  identities exited. The task-only heap cap was 1536 MiB; no runtime setting changed.
  This final run follows the accepted browser test synchronization correction.

Independent server/E2E review found no blocker. Independent UI review found
initial/cached ability callback capture and stale module-draft recovery problems;
the stable delegate, committed adapter and document reload corrections passed
the final source review and focused regressions. Portal teardown is tested.

Preserved failures: the first worker sweep passed 188 with two class fixture
failures. It clicked Level up before the previous save completed and left a
one-shot mock response for the next test. One explicit enabled-control wait
corrected the fixture; no class product behavior changed. The first typecheck
hit the task-only 768 MiB heap limit; all 5 identities exited. The 1536 MiB retry
found a new E2E BigInt literal incompatible with the repository target, corrected
to `BigInt(1)` at `d6c55b5`. Typecheck then passed, but lint required the new
navigation fixture to use Next `Link`; corrected at `2cb5c89`, followed by the
final 142-test rerun above and the accepted typecheck/lint receipt.

## Actual application acceptance and teardown

All three actual local Next/Auth/PostgREST/PostgreSQL stories pass at
`0f1a4e6`: receipt `local-builder-recovery-app-20261024T002222Z`, 47.7 seconds,
all 85 observed browser/test identities exited. Product source is unchanged
from `20a682d`; later corrections affect fixtures only.

1. A real ability save commits with its response dropped, survives reload and
   resolves the exact original receipt and saved score.
2. A request dropped before dispatch remains absent after reload. Checking adds
   no write; retry sends the same UUID/expectations and commits once.
3. A server HP roll commits with its response dropped, survives reload and
   recovers the same draw, operation and history row.

Fourteen read-only native snapshots agree with all three browser stories.
Each mutation has one exact original request/receipt and one parent revision
increment; retained pin identities and all five row-order bijections agree.
Recovery and subsequent reload add no receipt, revision or HP draw. All thirteen
readiness gates remain false, class/hit-die gates false, capabilities absent
and service_role private-schema usage false. No external browser origins or
page errors were observed.

The first run accepted both ability stories and established the HP draw, then
the HP fixture evaluated session storage during the intentional hard reload
and lost its execution context. Receipt
`local-builder-recovery-app-20261024T002058Z` preserves that failure (49.0 seconds,
all 46 identities exited). The test now waits for the refreshed enabled Fighter
control before reading storage, `0f1a4e6`; the final three-story rerun passes.

Runtime preparation replayed the existing disposable baseline and staged
companions, importing 1,535 real definitions and version-one snapshots.
Fresh progression already contains the legacy ASI repair. Its redundant repair
preflight refused the old preimage before mutation; native MD5
`8a2ec6e2c40616af169619a897fa190b` confirmed the expected installed body.
This is recorded in `builder-recovery-profile-fresh-skip.json`.

Accepted browser/native directory:
`test-results/local-app/builder-2026-10-24T00-22-26-418Z`.
Checked aggregation:
`..\equipment-runtime\app-flow-runtime\builder-recovery-actual-readback.json`.
It binds source `0f1a4e6`, three accepted stories and fourteen accepted snapshots,
with exact-operation and repeat-reload checks true. Accepted disposable IDs:

| Story | Character | Operation |
| --- | --- | --- |
| Committed ability | `acff8712-7ec4-4b32-abdc-33b4489cbe66` | `61851fed-82ba-4ddc-bb36-68f4dca3fcc0` |
| Absent/original retry | `24450d4b-da7d-4d7f-a079-9f5222bd444a` | `100b4fa3-ffcf-47ff-a1ef-58a00a4402ea` |
| Rolled HP | `c30955c0-2f3c-4302-a00a-4bf679229c66` | `abfce42f-e1ee-4f78-a757-9ea91fe6060c` |

The accepted HP draw is 2 on d10. The disposable database also retained the
initial run's three drafts and partial HP evidence until teardown; these are
excluded from the accepted-story/snapshot count. Existing Next Gzip listener
warnings and injected failed-network console messages were preserved; no
listener-limit or unrelated runtime setting changed.

Fresh teardown readback at `2026-10-24T00:24:26.5001803Z` confirms all five owned
containers, two networks, two volumes and three private credential files absent;
the recorded proxy identity is absent and ports 3001/9997/9998/9999 are closed.
`runtime-teardown-readback.json` retains those checks and resource comparison:
717 processes/7.31 GiB free before runtime versus 734 processes/5.88 GiB free
after, 85% committed. Those totals include unrelated user activity; no remaining
task identity is inferred from the count difference. The fresh
`builder-recovery-final-process-readback.json` at `00:24:46Z` confirms all 25
recorded Next identities exited. Both files are under the same external
`app-flow-runtime` directory. Test wrapper identities also exited as recorded.
Shared Docker engine/cache, all worktrees and dependency junctions remain.
No push, deployment, hosted migration or live configuration change occurred.

## Remaining work

M1/R06 remains **in progress**. Next is reviewed historical correction/repin,
complete playable caster drafts, broader combinations/concurrency and enrolled
writer/copy/campaign lifecycle fences before general activation. Hosted/provider
and backup/restore acceptance remain separate gates. Arcanum/Mastery/Signature
free-cast spending and rest recovery remain M6 gameplay work. The full suite
and production build are outside this focused verification slice.
