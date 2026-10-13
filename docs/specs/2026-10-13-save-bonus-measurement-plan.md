# Save-bonus measurement-only release plan

2026-10-13. PLAN ONLY on clean worker ac6578f1ad6510aefe44803e07938796cf6b4531.
Parent reports root534 full359/4839 plus3UNVERIFIED/build passed and actual bonus
asset binding prepared; this document does not independently execute those gates.
Existing seven executable files, production, original verifier/six fixtures,
assertions and historical receipts remain unchanged. No descriptor is generated,
and no Node/Python/npm/browser/measurement/SQL/network execution is authorized here.
Implementation and runtime each require a separate exact-source review/release.

## Decision and existing circular gate

Use the existing harness in a separately reviewed **measurement-only** mode, not a
second runner or QA framework. Current verify-save-bonus-local.mjs requires hashed
ACTUAL receipts for all nine phases before expensive entry. Those receipts do not
exist yet. Missing receipts must continue to deny the ordinary acceptance mode;
they must not be replaced by invented observations, old Magic timing or a permissive
budgetReview. Current spec module's Date.now clock starts after the Playwright CLI
has already loaded framework code, so it is not the whole-launch clock.

Measurement mode observes the real workflow and always records acceptance:false,
status:pending_measurement_review. Passing assertions is a useful observation, not
release acceptance. Failed, interrupted or cap-exhausted runs additionally record
their real failure; missing phases stay missing rather than receiving fabricated0.
The ordinary mode stays default, with its measured-receipt gate and900000ms outer
budget. Measurement receipts never change ordinary mode or authorize another run.

## Small future touchset and explicit release input

Only these four existing owned files need implementation changes:

| Path | Finite change |
| --- | --- |
| e2e/local-save-bonus/playwright.config.ts | Read a bounded explicit root-reviewed measurement invocation before constructing config; default retains existing900000ms. Measurement outer cap is a separate observation cap, not a product wait. |
| e2e/local-save-bonus/save-bonus.spec.mjs | Validate measurement release/whole-launch anchor through builtin entry, propagate exact mode/deadline/run identity, preserve all assertions, record pending result and complete timings including its final/cleanup. |
| scripts/verify-save-bonus-local.mjs | Keep ordinary budgetReview unchanged; admit only the separate strict measurement contract, instrument actual phases, preserve source proof and every case/export/QA oracle, and never emit acceptance:true in measurement mode. |
| scripts/save-bonus-inputs.mjs | Bind the separate release and launch-anchor bytes into the initial/fresh whole envelope. Reopen them at both finals and before force; keep seven own files, fixed producers,0841/e405 helpers, installed closure/build/CSS/fonts/output inventory binding unchanged. |

Fixture, scenarios, bonus Python verifier, original verifier, print data and all
general helpers are read-only. No replacement package command, app entry or new
launcher framework. Root uses its existing exact-process PowerShell orchestration
around npm.cmd run test:e2e -- --config e2e/local-save-bonus/playwright.config.ts.

Future ignored release input is separate from budgetReview, strictly versioned and
bounded<=32KiB UTF8: kind:save-bonus-measurement-only, contract_version1,
mode:measurement-only, acceptance:false, reviewed harness commit plus all seven
canonical OIDs/raw checkout SHA256, fixed producer/helper/lock/runtime identity,
exact clean root/build/asset manifest SHA256, run_id, and provisional whole/phase
caps. Root explicitly authorizes its exact hash before launch. A matching UUID,
file existence, env flag or time passage alone grants no runtime permission.
Reject unknown keys, missing/partial source binding, mode conflicts, stale build,
unreviewed caps or measuredReceipts presented as fabricated permission. The same
release bytes/hash must agree in config/spec/runner, initial IPC/disk and finals.
Only a nonsecret local release-file path is passed to the package process.

## One actual whole clock and provisional caps

Root's builtin orchestration starts ONE monotonic Stopwatch immediately before
spawning npm, before any package/framework/owned executable import. It records
native UTC anchor, Stopwatch ticks/frequency as decimal strings, exact command/cwd,
actual fork identities and deadline. Preparation of reviewed source/build/release
inputs happens before this clock; later receipt writes/readbacks and cleanup happen
inside it. Launch anchor is a run-bound observation, never a measured prior receipt.
Spec/runner consume its deadline instead of restarting900000 at module entry.
Root's monotonic clock enforces the outer cap; UTC correlates receipts and never
replaces elapsed measurement. Local process monotonic durations are retained with
UTC bounds/process identities; do not assume Node/.NET tick origins are identical.

Propose a bounded ONE-OFF measurement-only whole cap1800000ms (30min) for review,
separate from the unchanged ordinary900000ms cap. Historical Magic observations
are approximately379s combined entry,28s cases and301s combined finals:708s.
Those are planning context, NOT observed bonus receipts, and do not measure native
PDF/QA, the additional full force-proof probe, or all this run's cleanup. Reserve
450s for three unknown150s export/originalQA/bonusQA ceilings,180s for the unknown
additional complete proof component, and120s for native cleanup/readbacks. This
adds750s; the remaining342s is explicit headroom across known-category ceilings.
708+750+342=1800s motivates a finite observation window rather than an arbitrary
doubling or an ordinary runtime approval. Unknown costs may exceed these ceilings;
then the observation is incomplete/HOLD, not evidence that the missing work costs0.

Proposed exclusive ceilings (ms), summing EXACTLY1800000:

| Phase | Ceiling | Rationale/reservation |
| --- | ---: | --- |
| wrapperEntry | 240000 | Includes external startup and actual wrapper proof. Together with runnerEntry,540s allows161s over the historical379s entry total; their actual split is unknown. |
| runnerEntry | 300000 | All repeated runner entry proof/build/start work, not another restarted whole clock. |
| cases | 90000 | Historical28s plus62s planning headroom; all30 cases retained. |
| exports | 150000 | Unobserved eight-export ceiling, no asserted completion time. |
| originalQA | 150000 | Unobserved six-original QA work; cleanup/proof time is charged separately below. |
| bonusQA | 150000 | Unobserved two-bonus QA work; cleanup/proof time is charged separately below. |
| runnerFinal | 210000 | Complete fresh final/inventory; no claim that the historical301s total splits evenly. |
| wrapperFinal | 210000 | Independent complete fresh final/inventory. Together finals420s provide119s over historical301s; either210s cap can still HOLD. |
| forceAndCleanup | 300000 | Fixed sub-reserves:180000 for ALL actual full force-proof/proof-only calls,120000 for ALL native waits/close/force/readbacks/final I/O. Neither may borrow the other's reserve silently. |

The initial mandatory proof/cleanup reservation is210000+210000+180000+120000=
720000ms, leaving1080000ms for startup/entries/cases/eight exports/two QAs, rather
than the prior erroneous300000ms work window. The six work ceilings sum exactly
1080000. No600000 final reserve is retained while declaring a smaller hidden reserve.

Maintain a run-bound reservation ledger. Before admitting EACH phase, IPC probe or
native spawn, require external monotonic remaining time >= that operation's full
unspent declared ceiling PLUS every remaining mandatory phase/sub-reserve; initially
all nine total1800000. Keep the full210000 for each unfinished final, full remaining
180000 proof component and120000 cleanup component, plus the ceilings of other
unstarted work phases. Actual elapsed consumes its owning component exactly once;
completed work releases only genuinely unused capacity. A prediction, empty branch,
missing measurement or unobserved forced-kill path releases no future reservation.
During work enforce both its own remaining ceiling and the whole remaining-reserve
boundary. If either cannot be maintained, stop new work and perform complete reserved
finals/cleanup as possible, recording missing phases and a truthful incomplete HOLD.
No temporary cap increase or reserve borrowing; any proposal needs new source/release
review. No product timeout exceeds existing10000ms, retries, case reduction, export
omission, skipped proof, cache or source fallback.

All nine phases must be actually observed before a complete measurement is usable:

| Phase | Required included work |
| --- | --- |
| wrapperEntry | External npm/framework startup and discovery plus builtin wrapper bootstrap, owned/inherited/runtime entry proof; record startup separately within this phase. |
| runnerEntry | Actual child launch, builtin bootstrap, all repeated source/runtime/assets/transitive proofs, bundle preparation and private HTTP/Chrome startup. |
| cases | All30 actual desktop/mobile cases and their existing screenshots/font samples; combined case/export count remains43. Retain request/state/pin/refusal/privacy/native-RNG oracles. |
| exports | All six original Letter/A4 exports plus the two actual+1 provider exports, original assertions and unchanged provider raw-pin/state snapshot. |
| originalQA | Unchanged original verifier on all six exports, every rendered page/contact sheet and actual native process receipts. No Python-module hash claim for this verifier. |
| bonusQA | Existing bonus verifier on both exports, exact six values, geometry/privacy, every page/contact sheet, reported byte hashes and its actual module receipts. |
| runnerFinal | After teardown, complete fresh source/runtime/root/build/assets/fonts/bundle/metafile/CSS-map proof and bounded BOTH-QA output inventory, equal initial rendered proof. |
| wrapperFinal | Its independent complete fresh final proof, reopening both QA directories and deepEqual against runner evidence/disk inventory. It does not consume the separate force-proof reserve. |
| forceAndCleanup | ALL actual full pre-force/proof-only rebinds in its180000 proof component; QA cooperative wait/individual native cleanup, browser/HTTP close, wrapper stop/wait/identity/ancestry checks, any force, package exit, resource/PID/listener/port readbacks and final receipt I/O in its120000 native component. |

Keep both inclusive raw intervals and exclusive ownership components so nested QA
cleanup is not silently counted twice in a proposed allocation. Record external
whole elapsed and startup/gaps explicitly; do not subtract inconvenient overhead.
Incrementally preserve timings/failure/evidence before teardown. Final launcher
receipt closes the whole clock only after final writes and fresh owned-resource
readback. A package exit0 remains pending, never acceptance.

## Force-proof cost and failed-run cancellation

Normal measurement preserves the current strict force adapter: fresh complete
rendered proof before force, exact original/current OS birth/PID/parent/command/cwd,
owned private ancestry, immediate identity checks; absent proof/identity refuses
force. Do not deliberately force a healthy browser just to produce a timing.

To measure the expensive force-proof component without a kill, add a finite
measurement-only IPC checkpoint after runner teardown/final evidence, before its
exit. The runner remains alive cooperatively, with no browser/HTTP/QA work active.
Wrapper invokes the SAME full rebind used before force, measures it separately in
the180000 forceAndCleanup proof component and
checks the actual still-live runner identity. It records proof-only:true,
forceInvoked:false, then acknowledges exit. The normal wrapper final still runs
independently after exit. Bound this handshake by the reviewed phase/whole deadline;
stop/deadline takes precedence. It certifies only proof cost/identity observation,
not Windows taskkill behavior or an interruption outcome. All proof calls, including
an unexpected real pre-force call, consume that SAME aggregate180000 ceiling; no
extra unreserved proof may be appended after a healthy probe. If another fresh full
proof cannot fit the remaining declared component/whole reservation, refuse normal
force and record HOLD; only a separately reviewed failed-run cancellation adapter
can supply its distinct strict failure cleanup policy. No new cached proof or
alternate acceptance oracle. This additional measurement work is reported honestly
and is not presented as ordinary-mode elapsed time.

Successful measurement records unexercised forced-kill time as unobserved, not a
positive zero-cost sample. Before full release, root must either review an explicit
conservative cancellation reserve with this limitation or separately release a
controlled FAILED-run cancellation measurement. That separate adapter may use
only the exact fork/original OS birth/PID/parent/command/cwd and freshly complete
current private ancestry; every parent birth<=child birth, no missing/reused/reparented
identity, and immediate recheck before individual force. Unknown descendants or
incomplete ancestry refuse force. It never certifies rendered acceptance or replaces
normal complete-source force proof. No executable-name kill, broad tree guess or
authority over the active Codex/shared/unrelated processes. Its source/protocol and
failure point need independent review and root release before execution.

## Receipts and full-run decision

Archive prior outputs. Reuse current evidence/phase/wrapper-cleanup/QA inventory
receipts with explicit mode, acceptance:false, exact source/release/build/run hashes,
whole-launch anchor and complete/incomplete phase observations. Retain initial
IPC+disk and BOTH fresh final envelopes; every current raw/index/runtime/asset/font
and bounded output proof remains mandatory. Capture actual Python/Poppler/browser/
HTTP/package identities and all fresh readbacks; missing rapid native identity is
a real measurement failure, not an invented birth. No accepted PDF/page counts or
visual inspection is claimed until observed; historical33 pages remain historical.

Root reviews actual timings and all source/oracle/cleanup failures, then independently
freezes a NEW ordinary budgetReview with real hashed observed receipts. Allocate
900000ms only if framework/startup, all work, both complete finals, actual force-proof
component/reserve, cleanup/readbacks and honest margin fit. Otherwise HOLD and revise
only a separately reviewed orchestration plan; never trim tests/proofs or relabel a
measurement as accepted. Measurement alone does not establish native dialog/mobile
print interoperability, live Auth/DAL/persistence/G2 or class-origin authority.

This plan changes only this new Markdown file. All code and existing evidence remain
exact ac/d9/46c. No implementation, measurement input generation or execution occurs.
