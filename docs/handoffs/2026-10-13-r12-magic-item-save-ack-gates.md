# R12 magic-item acknowledgment — completed bounded gates

2026-10-13. Owned r12-magic-ack-worker / codex/r12-magic-save-ack.
This supersedes the unrun status of the source handoff for the commands below.
Base81629ce and approved plan7b9002a remain unchanged; no import/M7/PDF work resumed.
Root owns integration/full/build/UI/G2; this checkpoint is not browser/hosted acceptance.

Reviewed production/source2532f7c; attribution-only comment/handoff5d8d672;
reviewed test factory correction464f6e7c380932ca5857f8fab7e53ea96c5a7d6e.
All successful behavioral/type gates below ran at464f6e7. Root independently
approved finite JSX entity escape6aa858ac57fe518c236e5baa2497ce425c47839e. It changes
only `form's` to `form&apos;s` in an existing alert; rendered text and all assertions/
fixtures/control flow are unchanged. Lint passed at clean docs-only successor
66a575f9948d7cf83d5370a5c7cb100285a91b9d (production6aa858a). Unchanged behavioral
tests/typecheck were not rerun on that source; root combined check will cover it.
This document is a later docs-only commit, not a new production/test change.

| Command / source | Observed result |
| --- | --- |
| Controlled original baseline, current5d8d672 tests with only actual816 DAL/action/form bytes |33fail /2pass /78skip;28 substantive failures plus5 excluded action setup failures |
| Same controlled baseline after reviewed464f6e7 test reset fix |32 substantive fail /3pass /78skip, no setup/collection failure |
| Restored `npm.cmd test -- tests/supabase/homebrew-magic-items-server.test.ts tests/app/homebrew-magic-item-actions.test.ts tests/components/library/magic-item-form.test.tsx tests/lib/homebrew/magic-item-form.test.ts --maxWorkers=2` at464f6e7 |4files /143tests PASS |
| `npm.cmd run typecheck` at464f6e7 |PASS |
| `npm.cmd run lint` at464f6e7 |1error /0warnings: react/no-unescaped-entities at magic-item-form.tsx249 |
| `npm.cmd run lint` at66a575f (approved production6aa858a) |PASS /0warnings |

Baseline selection (three actual suites, maxWorkers2):
`-t "actual-old-export acknowledgment baseline|preserves effects/raw nested extensions|retains all fields after a real action settles"`.
Initial logs were not overwritten. The corrected run is separately labeled
baseline-reviewed. Restored bytes and original/current Git OIDs/raw SHA256 are
bound in each manifest; finally restoration verified exact equality and clean Git.

Nine old otherwise-valid create body controls reproduce wrong admission:
id/owner/system/retired/version/name/slug/data/effects. Three old literal-envelope
controls (spell/srd/shared) reproduce retryable-error to post-write uncertainty
classification, not old admission. Twelve immutable-pin controls show old omission
of confirmation. Actual raw UPDATE drops nested metadata while its effects omission
positive remains. Four actual action malformed/idle/wrong-operation cases now
reach DAL response handling (including malformed missing-response handling, not a
missing helper). Three actual form controls show unlocked idle retry, editable
pending fieldset and hidden expected_version rebasing1->2. Passing old positives
are valid CREATE construction, recoverable action field refusal and actual React
native-reset draft retention. No new-module/constructor failure is counted as proof.

The initial five action cases failed before those observations because broad
vi.resetAllMocks erased the module-level createClient vi.fn factory.464f6e7 resets
only per-case mocks and retains that constructor; every assertion/input is intact.
Both initial and corrected evidence are preserved. No production correction was
needed for the143-test or typecheck runs. Lint's sole failure is preserved before
the separately reviewed text-entity correction; the authorized lint-only repeat
passed without any further source correction.

Ignored local evidence: test-results/magic-ack-gates/.

- baseline.{stdout.log,stderr.log,receipt.json,manifest.json} (initial)
- baseline-reviewed.{stdout.log,stderr.log,receipt.json,manifest.json}
- focused/typecheck/lint.{stdout.log,stderr.log,receipt.json}
- lint-reviewed.{stdout.log,stderr.log,receipt.json} (passing repeat)
- exact original/current byte backups for each substituted actual module
- readback-partial.json (all35 observed OS identities, command/resource receipts,
  final readback and exact restored hashes)
- readback-final.json (all40 identities; per-command SHA/receipt hashes/resources,
  approved-source blobs/raw hashes, unchanged dependency lock and final cleanup)

Manifest SHA256: baseline1aa670ecadfc72baddfdd82396e5c88b5c933b5dada808157b32c89efb1ae70b;
corrected baseline8ee3c205596de3ee7330f7dbdd98950984520f671fad0a36591daa9441e75b73;
partial aggregate5f3957d19ff306d5b31d8226dd9e6afea51394e75cc607506f61d2de0e2d8d71.
Final aggregate d06195860aca5d9bac1b3ff7fddf4eb674ab6fd68fa7524a307dda52b514b62e;
passing lint receipt f0fb3f3b9d51f80df9dd9eeb9b51acc2d87cd706c861072ea503b55a722aa835.

Each process receipt records actual PID, OS CreationDate/birthUTC, parent, command,
known inherited workspace/cwd, launch/end, before/after CPU/memory/process/listener
snapshot and exact readback. Commands ran sequentially via hidden task-owned cmd
wrappers; captured identities8+8+9+5+5+5, each ended. Final union40 identities:
0still alive,0owned listeners, no forced termination. Global process/memory counts
fluctuated across commands and are recorded without attributing unrelated processes
to this task. All producer/source bytes, root/other worktrees and earlier receipts
remain preserved. package.json/lock unchanged; no install/full/build/browser/server/
network/SQL/provider action. Exclusive heavy slot released promptly after passing
lint/final readback (lint UTC17:20:51–17:21:29). No runtime is left running.

Remaining: root integration/combined check/build and separately reviewed actual
desktop/mobile form harness. Model tests simulate Auth/PostgREST/
actions/cache/navigation; they do not prove real RLS/version triggers/transactions/
rollback/exactly-once/latest-private status. Real-role race/rollback acceptance is G2.
