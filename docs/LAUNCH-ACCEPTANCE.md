# Inkborne project-wide acceptance ledger

## Active continuation — 2026-10-12 UTC

The human requested execution of the attached kickoff. The sole integration owner
resumed the clean recorded worktree at `628283318394f08992d7fc397390119611cc03ab`
and created local branch `codex/launch-integration-20261011` in that same worktree.
The original root and all inherited workers remain preserved. Fresh remote readback
found main `6b8601f976d3ee121d11f2ec33c7383393024b91`; PR99 and PR101 remain open
drafts at their recorded heads. No remote publication or live change is authorized.

R11's independent review found no blocking issue. Its exact three source commits
(`6bbd17d`, `4cbd70b`, `3d61ff3`) were cherry-picked as `82bfdb1`, `fb6f14c`,
`72fb420`. Current database types, lockfile, equipment, ability and state paths were
preserved. The combined focused run passed **8 files / 46 tests** at `72fb420`.
The first integration full check passed **230 files / 2,315 tests** at `72fb420`.
Later changes require a new combined check/build/browser gate; actual database
acceptance remains open.
Nonsecret receipts are in sibling `verification/launch-20261012/`.

Victor answered the scope and durable-gameplay questions on 2026-10-12 UTC:

| Decision | Explicit human answer / disposition |
| --- | --- |
| S1 | **Wait for every included milestone before beta.** Beta is not a staged midpoint for included milestones. |
| S2 / R24 | **Defer Daggerheart from first beta; retain project backlog.** This is a beta deferral, not removal from the total documented project. |
| S3 / R26 | **Defer public publishing from first beta; retain project backlog.** Private and campaign sharing continue; public licensing/visibility/moderation still need a later contract. |
| S4 / R22 | **Include PDF importing before beta.** First supported layout/content matrix is being requested; print/export R23 continues independently. |
| S5 | No blanket P1-P3 disposition was given. Individual ambitions remain visible and require selected contracts or explicit dated dispositions. |
| R09 product policies | Human delegated choice to the orchestrator: **"whichever is the best long term option"**. Adopt one hit-die command first, trusted server-generated accepted roll, immutable receipts for the character lifetime, and account-scoped operation-ID recovery surviving reload and clearing on sign-out/account change. Local implementation stays disabled until writer participation, database and browser recovery acceptance pass. |

Independent R12.1 review blocked initial `889afdf` for effects erasure and small
decimal create/edit roundtrip failure. Both were corrected at `c2b7132` and the
independent exact-source reviewer approved. The inherited R11 editor had the same
effects erasure; root corrected it at `861cab6`, with a failing-before regression
and **3 files / 21 focused tests** passing after. The independent reviewer approved
that fix. Real database/version acceptance is still open.

| Child requirement | Owner / isolated branch / base | Bounded acceptance and remaining boundary |
| --- | --- | --- |
| R12.1 — ordinary private item authoring (R12) | Item worker, `../r12-item-worker`, `codex/r12-private-item`, base `72fb420` | Existing item schema fields only; authenticated private create/edit, finite validation, constrained expected-version conflicts, draft retention, Homebrew discovery, exact-pin consumer compatibility. Focused/full/build/offline real-form evidence; real two-owner/snapshot/race acceptance stays open for approved runtime. Other R12 families remain open. |
| R23.1 — print / Save as PDF (R23) | Print worker, `../r23-print-worker`, `codex/r23-character-print`, base `72fb420` | Current confirmed evaluated values and immutable pins; strict printable allowlist excluding DM notes/secrets; martial/caster/long-content fixtures at Letter/A4, complete readable lists/page breaks, no editing controls/clipping. Rendered PDFs and layout inspection; real approved-account data acceptance stays open. Fillable standard PDF remains separate P2 scope. |

Runtime discovery still finds the Docker Linux engine unavailable and no Supabase or
psql executable on PATH. The preparation lane is resolving a minimal official,
digest-pinned PostgreSQL plus Auth/Storage migration bootstrap with no host ports;
no runtime was started, image pulled, credential created or SQL executed.

The concrete [G1/G2 runtime plan](specs/2026-10-12-equipment-runtime-plan.md)
and [digest-pinned Compose](specs/2026-10-12-equipment-runtime.compose.yaml)
are prepared. G1 permission was requested for one shared-engine startup and three
exact image pulls/metadata reads only; the full runtime/SQL/fixtures/ephemeral
credential package remains separate G2 preparation. Unanswered G1 is not approval.

R03.1 removed the **11 production dependency issues** (one critical, eight high,
two moderate). Independently reviewed source `4048184` was integrated as `8fc7a3b`:
Next/ESLint `16.3.8`, coherent Tiptap `3.30.5` and scoped compatible transitive
patches. The updated production-only audit reports **zero**; the full audit still
reports **24 development-tool findings**, including one critical through shadcn's
MCP/Express/proxy-addr chain. That remaining risk is open, not accepted or hidden.
Root subsequently confirmed the maintainer's [critical advisory and patched version](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h)
and changed only locked development `proxy-addr` from `2.0.7` to `2.0.8` at
`12290be`. The refreshed lockfile audit reports **23 findings / zero critical**
(15 high, seven moderate, one low); independent review, locked installation and
four proxy-trust regressions passed. Remaining development findings are undergoing
a separate scoped remediation plan. Production findings remain zero. Earlier 24/one-critical counts
above describe the preceding checkpoint, not the current lockfile.
The real mounted editor harness was reviewed/integrated as `2bca782`; its 12 offline
checks passed on the combined `edac6d7` product with build CSS.

Additional reviewed local checkpoints:

| Child | Integrated commit(s) / source | Evidence and remaining boundary |
| --- | --- | --- |
| R12.1 ordinary items | `91bf266`, `ff39986`; source `889afdf`, `c2b7132` | Private create/edit and constrained CAS, effects and finite numeric roundtrip preserved; focused tests and offline forms. Actual database/owner/version races remain open. |
| R23.1 print/PDF | `06ddf31`, `40f13ab`; source `d9bdae4`, `f84d391` | Owner-only allowlisted loaded snapshot, exact-pin completeness and identity guards. Six Letter/A4 Chrome PDFs, 33 rendered/inspected pages. Loaded values are not an atomic/latest DB snapshot; native dialog, live data and other browser engines remain untested. |
| R08.1 canonical weapons | `736b1d6`; source `bb7fa3d` | Six failing-before regressions corrected: nested range crash, fabricated print damage, wrong ability/category proficiency. Shared sheet/print helper; 53 focused tests, actual RollPopover/dice-engine crit browser test and six rerendered PDFs. Special ability/monk/versatile modes remain open. |
| R07.1 runtime preparation | `16880b4`, `7331248`; source `d54cd3b`, `248b80d` | Frozen exact-source replay/stage harness, explicit G2 target/manifest authorization and complete grant-table privilege assertions; 33 injected tests. No Docker/SQL execution or product concurrency fixtures; not PostgreSQL acceptance. |
| R09.1 writer plan | `fffea05`; source `aabf2d0` | Independently challenged writer/fence/revision/expiry/recovery plan. Pure hit-die model child in progress; no provider routing, RPC or database authority enabled. |

Root corrected the print effect cleanup warning at `3bfc90b`; the existing five
focus/title/guard tests passed. R12.2 private core weapon authoring was independently
reviewed, corrected for raw extension-key preservation, and integrated as `dd39a79`,
`e4293f3`, `d17d021` (source `4a3873c`, `40ca7d4`, docs `bcdb0bf`). Six files / 57
focused tests preceded the correction; 38 focused tests covered the correction.
Its real form/mapper passed 14 offline desktop/mobile checks with simulated actions;
actual owner/RLS/version-trigger/race and inventory-pin continuity remain open.
R12.3 private armor authoring and corrected R09.2 pure modeling are now integrated
as recorded below. R21.1a single-source slots is also integrated; R21.1b per-class
casting ability is the next bounded planning child.
These are implementation checkpoints, not complete milestone or beta acceptance.

At clean `9ae5a65`, the root combined `npm.cmd run check` passed TypeScript,
zero-warning lint and **247 files / 2,508 tests**. The gate observed 320 owned
processes; two remained momentarily at command exit, and fresh readback found both
gone with no owned listener. Exact source/log/process/cleanup receipts remain in
`../verification/launch-20261012/`. No build/browser or live acceptance is inferred
from this gate.

After that gate completed, independently approved R09.2 source `512e02e`, corrected
`fc3d0eb`, was integrated as `b698e2b`, `9d90077`. Its **98 focused tests** cover
the service-internal schemas/planner and existing helpers, including selected
race/subrace/subclass/background pin completeness and canonical result-intent
tampering. Default-disabled modules have no current application/action/RPC route.
Coherent locked snapshots, authority/access, monotonic writer fences, atomic roll
receipts and account recovery remain unimplemented acceptance gates. This later
source requires new combined acceptance.

R12.3 source `c0ae7b1` plus documentation passed independent review, 59 focused
tests/typecheck/lint and 16 actual-form offline checks. Integrated commits are
`c885782`, `e1b8e24`, `edac6d7`. Canonical armor metadata edits preserve raw effects
and extensions. Shield AC, strength and stealth automation are separate open gaps.

At `edac6d7`, the root full check passed **253 files / 2,605 tests**, typecheck and
zero-warning lint; the synthetic-config Next 16.3.8 build also passed. Nine bounded
offline configurations passed: magic items 12, items 12, weapons 14, armor 16,
editor 12, core 43, drift 10, canonical weapon play one, and six print/PDF cases.
The drift harness required only four new read-only list stubs at `7b78b35`.
All 33 generated PDF pages passed privacy/margin checks and visual inspection.
These are simulated action/persistence and loaded-snapshot boundaries, not live
provider/database acceptance. Gate process readbacks found no owned processes or
listeners; PDF renderer children closed, with incomplete Python-parent metadata
explicitly recorded in its cleanup receipt.

R07.2 source `38fd0fc` passed independent source review and 60 focused harness
tests and was integrated as `794e5ba`. Its canonical real-role/create/award/consume/
replay/catalog-drift/copy fixture preparation enforces immutable predecessor
receipts, phase freshness, exact IDs and approved budgets. No Docker or SQL was
executed; actual G2 runtime authorization and database evidence remain open.

R21.1a source `6f9b39c`, corrected `e54ef40`, passed independent review and was
integrated as `5012383`, `85f8ee9`. One validated selected-pin SlotResolution now
feeds casting, trackers, acquisition, rests and print. Missing/ambiguous data stays
unavailable. Large pools use bounded dots and preserve numeric totals. The review
correction passed 86 affected tests and five actual-provider offline browser cases
with seven inspected desktop/mobile screenshots; persistence was simulated.
R12.4 private core race source `bf3bfe3` passed independent review, 82 focused
tests and 16 desktop/mobile real-form offline checks; four screenshots were
inspected and worker ports/processes closed. Plan/source/docs were integrated as
`400bf0b`, `97b2cde`, `41012a6`, `c77cdfd`. The drift harness gained one exact
read-only race-list stub at `00ca346`.

The first combined check at `00ca346` failed 11 tests in two inherited fixtures
which lacked saved class pins. Root `1cf00ca` supplies explicit pinned progression
and system identity; 21 affected tests and independent fixture review passed,
without changing product fallback or unavailable assertions. A fresh full check
at clean `1cf00ca` passed **263 files / 2,754 tests**, typecheck and zero-warning
lint. Its PID-only process recorder briefly misclassified a reused PID as owned;
the unrelated connector was not stopped. Delayed readback found the PID absent
and no listener. Historical recorder process totals/cwd are limited evidence;
the future recorder matches PID, creation time and live parent identity.
Five actual-provider slot browser cases also passed on `1cf00ca`, with simulated
persistence. New dependency/per-class ability work requires later combined gates.

R21.1b per-class casting plan `69a8823` passed independent challenge with unique
ability identity, finite derived math and forged-snapshot negative controls;
implementation is in progress. R03.3 development dependency plan `91b4ff8` was
independently approved, but initial lock resolution changed an unapproved compiler
subtree. Installation stopped pending revised compatible preservation constraints.
Eight unpatched braces-chain high findings remain open, without risk acceptance.
R06.1 source-proven race-score representation reproduction/planning is underway;
no evaluator, schema, historical pin or manual-effect correction is inferred.

R21's canonical-parser child `3ceeb59` preserves absent level casting data instead
of turning it into explicit `null`. Two actual-snapshot regressions failed before;
four files / 98 focused tests and typecheck passed after, and independent source
review approved. Explicit inactive rows and normal importer output are preserved.
Root `5ecb9a1` also repaired two older offline recovery harnesses with exact class
pins; the fresh combined **43 core**, **16 race**, and **10 drift** checks passed.
These gates retained simulated persistence and closed their owned processes/ports.

R03.3 reviewed source `2b23ed9`, plans `91b4ff8`/`3e8e7a4`, was integrated as
`e718032`, `199371b`, `0c37775`. The final npm-generated diff changes 30 package
nodes plus root metadata, adds four required development helpers, and changes no
production-node metadata. Vitest and its companions are coherent at `4.1.11`;
the original Vite/Rolldown/OXC/Next/Tiptap/shadcn families are preserved. Worker
installed validation passed 101 tests, 11 offline probes, typecheck and lint.
Audit now reports **eight high / zero critical**, all in the unpatched braces
chain, and **zero production findings**. These remaining risks are unaccepted.
Six unchanged optional WASM entries are reported extraneous, with no invalid
ranges. Root's fresh locked install passed: 804 packages in 47 seconds, no owned
process or listener remaining. New source still requires combined gates/build.

R06.1 source `7403cb0`, handoff `ac258f2`, reproduced the actual transformer and
canonical-pin defect in 24 characterization tests: original STR12/CON14 becomes
live STR14/CON16 and max HP27 instead of24. Actual builder consumers differ;
manual, conditional, formula and separate-source controls reject blanket dedup.
Independent review approved explicit parsed representation modes and a new
effects-only importer, while retaining unmarked legacy live arithmetic visibly.
R06.2 is implementing this bounded contract in isolation. Historical correction,
SQL parity, size and subrace expansion remain open. Adjacent **R06.3 saved ASI
parity** is also open: Abilities displays allocations not synthesized by the live
evaluator. Its existing attribution/value will be preserved and disclosed, rather
than silently removed by this race repair.

The [R16.1 monster foundation plan](specs/2026-10-12-monster-foundation-plan.md)
at `9d103d5` passed independent design-scope challenge. A worker is finalizing
concrete schema fields/bounds/defaults before code. This child is read-only schema/
stat-block/Library foundation; authoring, import and DM campaign instances remain
required later children, with real privacy/version acceptance still open.

### Latest combined checkpoints — 2026-10-12 UTC

R21.1b source `7209772` and scoped fixture correction `92e3045` were independently
approved and integrated as `2d627f7` / `0b8ade1`. Casting uses the current loaded
acquisition, exact class pin and validated per-class evaluated ability; dialog and
execution share MOD/DC/attack math. The committed-input guard rejects stale local
callbacks after source/math/viewer changes; it is not a database revision fence.
The `0b8ade1` combined check passed **265 files / 2,799 tests**, typecheck and lint.

R06.2 source `e6513b2`, precision correction `c2df697` and their frozen contract/
reproduction were reviewed and integrated through `b4496ce`. Explicit effects/scores
representation prevents duplicate new-import awards; unmarked legacy arithmetic
and snapshots are retained with a visible ambiguity notice. Zero-only metadata
does not show that notice. Saved ASI and raw-only subrace differences remain
separately attributed and disclosed; they are not silently removed or repaired.
The combined five-file evaluator/provider/durable-model run passed **143 tests**.

R16.1 concrete contract `9d53f08` and read-only source `7e25581` were independently
approved and integrated as `ca65bfb` / `cda325a`. Strict format-one declared monster
data has a **65,536-byte validated-data** budget (not a transport/envelope cap),
ordered entries and inert text; declared saves/attacks are not recalculated.
Worker evidence was 12 files / 206 tests, typecheck and lint. No authoring/import/
campaign instance or real permission/persistence acceptance follows from it.

The first combined `cda325a` check failed all 12 legacy ability-save recovery
cases because their partial system fixture omitted required schema collections.
Root fixture-only `2e20658` completes typed empty collections; all original
assertions remain, and the 12 focused cases pass. A first repeat then hit one
five-second fixture-cleanup timeout; its 27-case file passes alone. A recorded
four-worker repeat (`VITEST_MAX_WORKERS=4`, unchanged npm scripts) passed **274
files / 3,023 tests**, typecheck and zero-warning lint on clean `2e20658`.
Synthetic production build on that same clean SHA passed in 45 seconds.
Both failed receipts remain in `../verification/launch-20261012/history/`;
successful check/build owned-process and listener readbacks are empty.

Root casting fixture repair `159441e` fixes absent optional CSS bundle output and
uses an intercepted loopback document with real secure-context UUID APIs.
The six actual provider/dialog behavior cases pass: strong/weak Wizard/Warlock
math, preview/execution/roll agreement, slot/concentration/effect writes, and
missing-source/viewer denial. Earlier setup and blank-origin failures are retained.
Persistence is in-memory and styling simplified, so this is not production layout,
server authority, RLS or durable-roll proof. Product was `2e20658` with the exact
test repair subsequently committed as `159441e`; do not call that browser run a
clean `2e20658` source run. Its final owned-process/port readback is empty.

R06 browser source `2060a30` / `5b15ae3` / selector repair `4f84db1` was independently
inspected and integrated as `29c7f1b` / `ba911f2` / `8999361` (handoff `6c42f2e`).
It passed **80 checks / 16 inspected screenshots** with actual builder consumers,
transformer/canonical pins/evaluator, `2e20658` production CSS and loaded hashed
local fonts. All matrix assertions remain; wrapped-label setup failures were
retained before explicit label association. Errors/remotes/unexpected writes were
zero; exact HTTP/Chrome ports and processes closed. Draft, navigation, persistence,
full sheet shell and canonical subrace-score support remain unproved. The mobile
Class rail screenshot partly shows its existing horizontal-scroll Level Up label;
rail interaction/accessibility remains an R25 acceptance task, not a proved defect.
Receipts are in `../r06-race-parity-worker/test-results/race-parity-local/`.

R16 browser preparation `09f6af3` / successful-clean-build guard `2ebf857` were
reviewed and integrated as `c8777bc` / `e5263ec`; root ran all **17 receipt controls**.
The first real mobile run found a Library implicit grid track expanding to 10,432
px around the full long title, giving body width 10,448 at a 390 px viewport.
Independently approved one-class source fix `688944c` adds only `grid-cols-1`,
preserving sm/xl columns, card behavior, full data and assertions; integrated as
`f88d421`. The unchanged-build-assets before/after browser proof passed **20 checks**,
including 62,138-byte multibyte/unbroken data and the complete final rule.
Mobile body width is 390; errors/remotes/writes are zero, owned processes/ports
closed. Root inspected small/final mobile screenshots. Mocked auth/data/native
routing and padded shell do not prove actual Next/RLS/persistence or full M5.
Immutable failure/pass receipts and all original build asset bytes/hashes are in
`../verification/r16-mobile-overflow/`. Later combined source needs new gates/build.

R21.1c subclass implementation is in its isolated worker after an independently
approved revised plan preserving shipped object-tier grants. Locked install passed
(804 packages); all four canonical parser/slot/ability baseline regressions failed
before as intended. Focused implementation checks are now released; full/build/UI
and source acceptance remain pending. Private monster plan `4bb6def` / `3e382d5`
passed independent challenge and is integrated as `96ed8f9` / `1f1d1ef`. Standalone
trait plan `3a4f216` / `29150bd` / `c229658` also passed independent challenge,
including PostgreSQL version bounds, unchanged raw resource absence/null/zero and
uncertain CREATE response controls. Both are released for scoped local code,
not accepted implementations; their isolated writers hold heavy gates while the
subclass worker owns the focused-check slot. G1 remains unanswered; a fresh
read-only Docker version request still cannot connect to the Linux-engine pipe.
No daemon startup, image pull, SQL execution, hosted or publication action occurred.

### Historical review / resource queue before `bc6a4b2`

| Child / isolated owner | Source and observed local evidence | Current gate / next action |
| --- | --- | --- |
| R21.1c subclass casting; `../r21-subclass-worker`, base `0b8ade1` | Original `a26fd843` plus correction `447d376` passed independent exact-source review and were integrated as `a6d7efb` / `a41e186`. Correction baseline: 8 failures / 1 existing pass; affected first run 503/506, then 29 unaffected files / 489 passes plus repaired 3 files / 17 passes. Final typecheck/lint passed; original failures remain preserved. | Current source/list/pins/query/search generation and integer learnable bounds reject stale results before DAL. Shared finite unique math governs execution/preparation/summary/print; invalid active math is unavailable while ordinary martial print and independent valid slots/rest remain. Nine-case secure-origin browser is unrun; fresh combined check/build and actual database/session acceptance remain open. No broader HP/grant/recovery or SQL change. |
| R16.2 private monster authoring; `../r16-monster-worker` | Original `80a64c8`, test-only `222864d` / `50300b6`, handoff `f460679` remain **unintegrated**. Original six-file 106/106, typecheck/lint passed. Response correction `7765abf` is prepared; its checks are now the sole released heavy slot. | Review approved fields/caps/raw intent/CAS/effects but required retained-draft handling for rejected/missing/malformed responses. Correction uses installed Next `unstable_rethrow` before ordinary uncertainty handling so framework navigation propagates. Exact correction review, actual form browser/current build and DB/RLS acceptance remain pending. |
| R12.5 standalone private traits; `../r12-trait-worker`, base `2e20658` | Original `a7fb204` / handoff `8df6ee7` passed locked install (804 packages), 7 files / 115 tests, typecheck/lint. Independent review found two DAL defects; prepared correction `fcb3c239` remains **unintegrated and untested**. | Changed writes must confirm next version; old version is only valid for genuine no-op. Original effects must pass canonical validation before edit while raw extensions/order remain and effects are omitted from UPDATE. Thirteen regression cases are prepared; correction gates follow monster gates. Exact review, actual form browser and combined acceptance remain pending; relations/application/per-level/extra counters/clock recovery remain separate children. |

No rejected review source is treated as accepted. Root remains the sole integration
writer; worker code edits proceed in parallel while expensive checks and browsers
are serialized. Root `7945136` contains only earlier reviewed source, harnesses,
plans and evidence updates. Reviewed subclass source is now integrated through
`a41e186`; its later combined check/build is still pending. All three workers
reported no owned processes/listeners before the resumed serialized gate sequence.

### Accepted local integration checkpoint — 2026-10-12 UTC

Private monster original/correction sequence was independently approved and
integrated as `2c4a704` / `e1f378e` / `664037d` / `14287f2` / `c075564` / `6029274`.
Exact correction `7765abf` passed 28 response/form controls and the full bounded
seven-file **127-test** authoring set, typecheck/lint; its final owned process/port
readback is empty. Actual framework error helpers remain real in the correction.
Actual form browser preparation is separate; no DB or hosted acceptance follows.

Trait `a7fb204` / `8df6ee7`, correction `fcb3c239` and tested handoff `7d7ae1c` were
independently approved and integrated as `d9d8bc0` / `146baa7` / `baf3079` / `bc6a4b2`.
The original-DAL/new-regression baseline reproduced **11 failures / 39 passes**:
three changed-write old-version false confirmations and eight malformed-effect
write admissions. The corrected exact source passes **50 DAL tests**, then
**7 files / 128 tests**, typecheck and zero-warning lint. Source was restored
byte-for-byte after the bounded baseline and all receipts retained; no owned
process/listener remained. The Homebrew monster/trait integration conflict was
resolved preserving both families, tuple positions, independent load failures,
empty-state conditions and every prior test; exact root `bc6a4b2` seam review passed.

Clean combined `bc6a4b28046b31db04c809aaf045ea2c53fe83c8` passed unchanged
`npm.cmd run check` with recorded four-worker limit: **295 files / 3,369 tests**,
typecheck and zero-warning lint. No source repair was needed. Its nine-case actual
provider/subclass/cast/rest/print offline browser also passed, with native secure
crypto and no remote requests. The original third/prepared/inactive/missing,
full/half/Pact grant inheritance, viewer and multiclass assertions are retained.
Root inspected the original third-caster preview. Styling is intentionally
simplified and persistence modeled; this is behavior proof, not production
geometry, database authority or multi-session freshness. Both gate readbacks
have zero owned processes/listeners. New production build/current-CSS form and
PDF/browser acceptance remain open at that historical checkpoint. All runtime/hosted/publication gates are unchanged.

### Current source and review queue — 2026-10-12 UTC

Clean root `821eb1aec1ffb26ae1101f1ebad01f41cae33867` passed repository
`npm.cmd run check`: **297 files / 3,461 tests**, typecheck and zero-warning lint
with four workers. The expected temporary-Git guard tests emit pathspec/line-ending
diagnostics while their assertions pass. The exact source also passed the synthetic
production build. Build-ID SHA256 is
`3dde33efae8631679fd42c215e9e099e9cf9e86ee8040a922f63ff4d12828992`;
successful build receipt SHA256 is
`338362fd5655f861fb36d7562014e3d8a690d31424cc2a96b65462f88d0fc5cf`.
Receipts and process readbacks are retained under
`../verification/launch-20261012` outside the integration checkout. Build credentials
are synthetic placeholders; this is no hosted/provider acceptance.

| Child / isolated owner | Reviewed source and local evidence | Remaining acceptance |
| --- | --- | --- |
| R21 subclass casting | Integrated `a6d7efb` / `a41e186`; combined check plus nine offline provider/cast/rest/print cases passed at `bc6a4b2`. | Actual database/session authority and concurrent freshness remain open; browser styling was intentionally simplified. |
| R16 private monster authoring | Integrated through `6029274`; actual-form harness `1db182e` / `7a2479d` passed **28 checks / 12 screenshots** at `821eb1a`, desktop 1280x900 and mobile 390x844, exact production CSS/fonts and source hashes. Native over-limit input is verified before submit; rejected/malformed responses retain the draft. | Native Next error helper bytes are real, but action HTTP, auth, persistence and routing are simulated. Root inspected the mobile near-budget tail; the very long full-field screenshot was overview only. Actual RLS/CAS and supported importer/DM workflows remain open. |
| R12 standalone traits | Integrated through `bc6a4b2`; actual-form harness `8496083` / `821eb1a` passed **28 checks / 16 screenshots** at the exact current build. Strong source/transitive-byte/lock guards and OS process-birth checks passed; mobile rejection/locked edit and desktop saved-ID navigation failure were inspected. | Simulated action/navigation/list/reload. Raw-effect preservation, uncertain CREATE acknowledgement and no duplicate reinsertion are locally covered; PostgreSQL ownership/version/CAS remain open. |
| R21 advanced binding | Advisory source `ad73021` / `1a3acf4` includes 88 focused cases and is in the 3,461-test combined run. Exact captured feature/grant/controller provenance and native resource state are modeled. | No production parser/provider/CastChoice/UI/SQL consumer; Mystic Arcanum, Spell Mastery and Signature Spells are not accepted gameplay implementations. |
| R12 passive feature authoring | Isolated `6f43b57`; test-only `48584ab` / `531e116` / `400d638`, handoff `ff3e452` independently approved. **Six files / 145 tests**, typecheck and lint passed. Earlier crypto-mock failures are preserved; package/lock unchanged. | Root integration and actual-form preparation are next. Standalone association is explicitly unverified; no feature application/grant/reference/mechanics or database acceptance is implied. |
| R09 staged hit-die kernel | Approved finite plan `ade6a34` / `4003a45`; staged source `ec5b4d6` plus fixture-only `16a8d11` is under independent review and serialized narrow checks. | No SQL/PGlite execution. Default-off gate and deliberately unavailable production dependency reader prevent command acceptance. Complete writer/access participation, canonical/native clock proof, profile/character lifetime behavior and real PostgreSQL recovery acceptance remain mandatory. |
| R06 saved ASI consumer parity | Plan `b172882` amended by `6fcd21e` is awaiting exact independent challenge. | No code yet. Required evidence DTO, nullable feat-grant provenance, durable fingerprint, six finite abilities and stale-callback/whole-rest side-effect guards precede implementation. |

Monster and trait harnesses recorded zero page errors, blocked/unexpected remote
requests and cleanup leaks. Exact server/browser PID, birth, parent and command
receipts are retained; each listener closed. These are local real-component proofs
with stated simulated boundaries, not a running authenticated Next application.

Six print cases at clean `9943f51` generated **33 pages** (A4/Letter caster,
martial and long-content pairs). All pages rendered at 90 DPI; privacy exclusions,
end markers, dimensions and at least 20-point text margins passed. Root inspected
all six contact sheets plus the full caster A4 first page. Print uses its own
production print CSS module and a context shim, so global production-font/provider
acceptance remains open. Python/render child process readbacks are empty.

The sole root writer continues approved integration while expensive checks remain
serialized. Any root HEAD change makes the `821eb1a` browser build manifests stale;
rebuild and rebind before using them for later source. G1/PDF input/P1-P3 decisions
remain unanswered. No engine start, image pull, container, SQL execution, hosted
write, deployment or publication occurred in these gates.

Updated 2026-10-12 UTC. This is the single durable development backlog and completion ledger. [CODEX-ORCHESTRATOR](CODEX-ORCHESTRATOR.md) is the operating entrypoint; [ROADMAP](ROADMAP.md), [PRD](../inkborne-prd.md), [GAME-PLAN](GAME-PLAN.md) and existing specs define requirements. The October 11 bounded queue is complete; the project is not. The active continuation above includes local product changes; no runtime, hosted database or publication action has occurred.

## Finite scope and decisions

**User-selected project-wide objective:** complete ALL documented M1-M8 milestones (including M5.5) and account for every documented PRD requirement, including P1-P3. Every documented ambition must have an explicit included/completed/deferred/out-of-scope disposition; all included requirements must be accepted. Deferral or removal requires an explicit dated Victor decision, remains visible, and cannot be described as implemented. No documented requirement disappears merely because it was not selected for an earlier beta. This finite documented scope is not a license to invent new features.

**Selected beta sequence:** every included M1-M8 milestone, including M5/M6 and M7 PDF importing, precedes beta. Daggerheart and public publishing are explicitly deferred from first beta and retained in the total project backlog. Already-shipped narrative/wiki functionality is retained. Unselected P1-P3 contracts remain explicit open decisions; no blanket exclusion or acceptance is inferred.

| Decision | Conflict / concrete choice | Recommended resolution and execution effect |
| --- | --- | --- |
| S1 | Launch sequencing | Victor selected every included milestone before beta on 2026-10-12 UTC. No staged midpoint is selected. |
| S2 | Daggerheart / second-system timing | Victor explicitly deferred Daggerheart from first beta on 2026-10-12 UTC; retain R24 in project backlog. Preserve system-agnostic architecture; generic schemas do not prove second-system play. |
| S3 | Public publishing timing | Victor explicitly deferred public publishing from first beta on 2026-10-12 UTC; retain R26. Private/campaign sharing continues; public visibility/redaction/licensing/moderation still needs a later contract. |
| S4 | M7 PDF importing | Victor selected PDF importing before beta on 2026-10-12 UTC. Supported input matrix is pending; define finite rights-safe fixtures, extraction/review/corrections/provenance and existing calculation/commit gates. Unsupported layouts stay explicit. This is distinct from character export. |
| S5 | P1-P3 ambitions, 2024 content, public licensing and pricing remain open. | Confirm which belong to this release/project target. Keep explicit deferred records; no new payments/analytics/public distribution by implication. Ordinary implementation choices within a selected requirement are the orchestrator's job. |

Batch these scope choices early; continue unambiguous M1/core/M4/print work while answers are pending. Ask only where the answer changes the product contract. Do not ask permission for routine local code/SQL-file edits, offline tests, review or planning within the chosen task.

## Checkpoint and evidence vocabulary

- Integration worktree: `C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-verification`, active branch `codex/launch-integration-20261011`. Prior handoff branch `codex/equipment-executable-verification`, documentation `c5370eb` and tested application `ada6c9b` are historical checkpoints. Read the active continuation and actual HEAD for new source/evidence.
- [Closing evidence](handoffs/2026-10-11-orchestrator-local-queue.md): full check 226 files / 2,292 tests, zero-warning lint/typecheck, dummy build, 43 core + 10 drift offline checks. L1/A1/T1 integrated. D1/E1 are characterization/proposals, not durable schema/runtime acceptance.
- [M1 magic-item worker](handoffs/2026-10-11-m1-magic-item-revalidation.md): `..\m1-magic-item-worker`, `codex/m1-magic-item-revalidation`, tested `3d61ff3747dbb04da55d9fb436753e71b1596d29`, docs HEAD `6c740f0281a3268bee5a0074a891a453af7c09a2`. Historical 1,805 tests/build/12 offline checks. Its reviewed PR99-derived slice is now integrated locally, with combined evidence above; publication and real database acceptance remain open. “M1” here is an old worker ID; roadmap M1 is pre-alpha consolidation.
- Existing shipped main/deployed surfaces have historical UAT receipts. Those receipts do not accept the new combined candidate. Latest dev deployment is still PR101 `794fd878`, not `ada6c9b` or the standalone magic-item fix.

Stage columns: **I** implemented source; **T** tested at stated boundary; **G** integrated into candidate; **D** deployed; **A** accepted against that exact release/target. `P` partial; `H` historical; `U` unknown/uninventoried; `-` absent/unverified. An aggregate green suite does not fill a requirement's acceptance column. Every completion record must include source SHA, test command/result, real data/runtime target where applicable, cleanup receipt and accepted/deferred decision.

## Milestone matrix

| Milestone / requirement IDs | I / T / G / D / A now | Evidence and concrete remaining exit |
| --- | --- | --- |
| M1 consolidation + operations: R01-R04 | P / local+H / P / H / open | [Current release checklist](RELEASE-READINESS.md), [backup implementation/runbook](../infra/backup/README.md). Local defects fixed; candidate publication, provider/admin acceptance, fresh scheduled backup/offsite evidence and actual restore drill remain. |
| M2 visual implementation: R05 | yes / offline+H / yes / H / H, current open | [Journey references](design-briefs/design_handoff_journey_alpha/README.md), merged #67, current 53 offline checks. Preserve design; accept current desktop/mobile/tablet auth/dashboard/builder/sheet flows and accessibility rather than rebuild. |
| M3 gameplay: R06-R09 | P / local+model+H / P / H / open | [Gameplay plan](specs/2026-07-15-m3-gameplay-foundations-plan.md), [durable gaps/contract](specs/2026-10-11-durable-roll-state-contract.md), [equipment evidence](handoffs/2026-10-11-equipment-postgres-wasm.md). Core play is present; atomic equipment/full-trigger/concurrency and durable roll/state outcomes remain. Fresh real builder-to-play acceptance required. |
| M4 homebrew/import/compendium: R10-R15 | P / local+H / P / H subset / open | [Spell](specs/2026-07-20-m4-private-homebrew-spell.md), [feat](specs/2026-07-21-m4-private-homebrew-feat.md), [background](specs/2026-07-21-m4-background-authoring-sharing.md), [compendium](specs/2026-07-22-closed-alpha-feedback-and-compendium-contract.md), [MPMB parity](specs/2026-07-21-mpmb-representative-parity.md). Remaining authoring families, magic-item integration, sharing/custom-type decisions and supported importer coverage; don't declare whole M4 shipped. |
| M5 monsters/library NPCs/companions/sidekicks: R16-R19 | -/U / - / - / - / open | [Roadmap M5](ROADMAP.md), [schema area](../lib/schemas). No completed authoring/catalog/DM-management acceptance located. Sequence monsters, library NPCs, companions, sidekicks; distinguish current character relationships from library NPCs. |
| M5.5 campaigns + narrative: R20 | foundation / local+H / yes / H / H, current open | [Campaign design](specs/2026-07-19-campaign-foundation-design.md), [backlinks](specs/2026-07-19-campaign-backlinks-design.md), [timeline/relationships](specs/2026-07-19-character-timeline-relationships.md). Reaccept real DM/player membership, private/shared content, copy/assignment and revision conflicts on candidate. Optional publishing/presence remain S3/S5 decisions. |
| M6 advanced spellcasting: R21 | P / some local / P / H subset / open | [Arcane Recovery implementation](../lib/rest/arcane-recovery.ts), [its tests](../tests/rest/arcane-recovery.test.ts), roadmap M6. Recovery has code; inventory Mystic Arcanum, Spell Mastery, Signature Spells and Eldritch Knight/Arcane Trickster progression before adding missing UI/rules. |
| M7 PDF import: R22 | -/U / - / - / - / open S4 | Roadmap M7 and [existing import architecture](../lib/import). Supported PDF extraction -> review/repair -> immutable commit -> calculation/character parity required. Keep provenance and unsupported-input errors; paid AI/provider choices are not implicit. |
| M8 public beta/community launch: R23-R27 | P / P / P / splash only+H / open | Roadmap M8, [release checklist](RELEASE-READINESS.md), [alpha evidence](alpha). Current performance/accessibility/onboarding/feedback/ops audits, rights/licensing/scope and actual reviewed deployment/auth acceptance remain. Splash readiness is not app launch. |

## Requirement backlog and acceptance

Rows are finite bundles of existing requirements, not a feature wishlist. Split a bundle into child IDs before assigning workers; retain parent roll-up and source linkage. For missing implementation/tests, `-` is an honest open cell, not evidence. All PRD P0s are represented below; P1-P3 crosswalk follows.

| ID / source | Requirement / present implementation and test evidence | Acceptance and next dependency |
| --- | --- | --- |
| R01 PRD §1; M1 | Email/OAuth registration/login; profile display name/avatar/bio; player+DM account; settings. [Profile](../components/settings/profile-section.tsx), [auth tests](../tests/auth), PR80 branch. I=P/T=local/G=baseline, PR80 pending/D=H/A=open. | Review exact PR80 recovery changes; real email/Google/Discord linking/unlink/relink/recovery/session/account-isolation and profile persistence. Approved accounts/auth setup only; no credential extraction. |
| R02 M1 | Backup/offsite/retention/restore. [Runbook](../infra/backup/README.md). I=yes/T=code/G=shipped/D=Unraid unaccepted/A=open. | Fresh scheduled encrypted backup + failure signal + authorized restore into an isolated target; verify schema/content/permissions and documented recovery. Hardware/secret/offsite access approval G5. |
| R03 M1/P0 safety | Reviewed dependencies, error/privacy boundaries, release/recovery compatibility. [Dependency evidence](handoffs/2026-10-12-r03-devtools-remediation-plan.md), [release checklist](RELEASE-READINESS.md). I=P/T=local/G=yes patches/D=- candidate/A=open. | Production audit zero; eight unpatched development-chain highs remain unaccepted. Final combined source/renderer gates, restore/migration replay and old-client compatibility remain required; audit counts do not prove exploit absence. |
| R04 M1/M8 | Feedback capture/admin triage and alpha checkpoint A-D evidence. [Contract](specs/2026-07-22-closed-alpha-feedback-and-compendium-contract.md), [alpha records](alpha). I=yes/T=local+H/G=yes/D=H/A=admin/current open. | Exact originating context/mobile feedback and permitted admin triage; record feedback rounds, disposition/blockers and Victor acceptance, not invented users or elapsed-time substitutes. |
| R05 M2/PRD §11 | Established visual identity, responsive web, mobile/tablet workflows. [Journey](design-briefs/design_handoff_journey_alpha/README.md), [UI](../components), [offline configs](../e2e). I=yes/T=offline+H/G=yes/D=H/A=current open. | Real current routes at desktop/mobile/tablet; reachable controls, no clipping, keyboard/focus/labels/errors/contrast/zoom and screen-reader checks. Preserve shipped #67; no redesign. |
| R06 PRD §2/§3 | D&D 5e 2014 builder/calculations/races/classes/background/level-up. [A1](handoffs/2026-10-11-a1-ability-integration.md), [race representation](handoffs/2026-10-11-r06-race-representation-local.md). I=P/T=local/G=yes bounded patches/D=old/H/A=current open. | New race imports contribute once; legacy dual arithmetic stays visibly preserved. Historical correction/repin, ASI and subrace/source/SQL parity remain open. Fresh supported character -> reload -> play, exact pins/allocations and role denials require real target acceptance. |
| R07 PRD §5; M3 | Equipment/custom inventory/equip/currency, atomic starting awards/copy. [Inventory](../lib/supabase/inventory.ts), [staged SQL/readme](../supabase/staged/README.md), [45-case executable test](../tests/supabase/starting-equipment-postgres.test.ts). I=staged/P/T=model+offline/G=yes, gate off/D=-/A=open. | Full migration/grants/triggers, per-write rollback, concurrent same/different intent, ownership/pin/copy races, replay after consumption and lost responses. No fabricated legacy eligibility/receipts. E1 runtime + approved legacy policy; rollout after actual acceptance. |
| R08 PRD §3/§4/§9; M3 | HP/temp HP, death saves, conditions, dice/logs, cast/slots/resources, effects/concentration, rests/hit dice. [Provider](../lib/character/character-context.tsx), [sheet](../components/sheet), [core checks](handoffs/2026-10-11-orchestrator-local-queue.md). I=yes/P/T=offline+H/G=yes/D=H/A=current open. | Real multi-class play/rest/roll/calculation scenarios, pending/failure/conflict/reload/offline/expiration paths, no silent duplicate or lost spend. Do not confuse a simulated router/provider with hosted success. |
| R09 M3 safety/D1 | Durable rolled action + revision/dependency/old-writer participation. [Contract and executable gaps](specs/2026-10-11-durable-roll-state-contract.md), [current gap tests](../tests/supabase/durable-action-current-gaps.test.ts). I=proposal/T=characterization/G=proposal/D=-/A=open. | Implement one hit-die command locally with operation identity/receipt and revision/dependency checks; prove rollback/lost-response replay/ABA/legacy-writer behavior, then reviewed death-save/concentration adapters. Local SQL-file edits/tests are ordinary work; actual DB/security execution uses G2/G3. |
| R10 M4/PRD §7 | Spell/feat/background forms, immutable versioning, private + campaign sharing/discovery/revocation. [Forms](../components/library), [server boundaries](../lib/supabase), linked M4 specs above. I=yes/T=local+H/G=yes/D=H/A=current open. | Actual owner/non-owner, stale-version races, historical pins after edit/revoke, Library/builder/sheet effects parity. Preserve platform/personal/exact-campaign authorization and calculations. |
| R11 M4/PRD §5/§7 | Reviewed/integrated private magic-item authoring, draft retention and raw effects preservation. [Original M1 evidence](handoffs/2026-10-11-m1-magic-item-revalidation.md), active combined receipts above. I=yes/T=local+12 offline/G=yes/D=-/A=open. | Actual two-owner discovery, immutable v1/v2, historical inventory pins and competing expected-version writes remain unaccepted. Candidate final gates must include later shared consumers; the old worker's standalone pass is historical. |
| R12 M4/PRD MVP | Bounded private item/weapon/armor/core-race forms are reviewed/integrated; class/subclass/feature/trait and advanced race relations remain. [Core race evidence](handoffs/2026-10-11-r12-private-core-races.md), [schemas](../lib/schemas). I=P/T=local+offline forms/G=P/D=-/A=open. | Real owner/version races and pin continuity; exact race dependency manifests/atomic selection; remaining authoring families and supported mechanics. Private owned-book entry is retained; no guessed relations, effect deletion or public distribution promises. |
| R13 M4 | Cross-type sharing, Homebrew filters/search/sort, custom-content-type registry UI. [Homebrew domain](../lib/homebrew), roadmap M4. I=P/-/T=P/G=P/D=H subset/A=open. | Extend selected type contracts without weakening isolation; verify registry-defined fields/evaluator compatibility and explicit unsupported mechanics. Public sharing is S3/R26, not implied by campaign sharing. |
| R14 M4 | MPMB upload/static parse, validation/repair, audit, keep-both/replace, mandatory calculation preview and exact-pin character exit. [Parser/mapping](../lib/import/mpmb), [parity spec](specs/2026-07-21-mpmb-representative-parity.md), [T1](handoffs/2026-10-11-t1-e2e-drift.md). I=P/T=offline+H/G=yes/D=H/A=supported cases H, current open. | Publish explicit supported type/fixture matrix; extend documented gaps only with original schema/source evidence. Unsupported effect-coupled/candidate-less cases fail closed. Current owner/isolation/stale-preview/replace/race/calculation and builder-to-cast parity on a real approved target. Field-level merge was deliberately out of scope. |
| R15 M4 | Entitlement-aware encyclopedia for all authenticated players/DMs. [Compendium contract](specs/2026-07-22-closed-alpha-feedback-and-compendium-contract.md), [Library tests](../tests/app/library-page.test.tsx). I=yes baseline/T=H+local/G=yes/D=H #96/#97/A=H, extensions open. | Platform/private/campaign visibility and legacy redirects/state preservation current UAT; every new M4/M5 type joins the same catalog rather than DM-only browsing. |
| R16 M5 | Reviewed monster schema/read-only stat block/catalog source is integrated; 206 focused tests and 20 offline geometry checks passed, including the mobile grid fix. [Design scope](specs/2026-10-12-monster-foundation-plan.md). I=P/T=local+offline/G=foundation/D=-/A=open. | Reaccept latest combined source/build; implement reviewed private authoring, supported import and DM campaign instances. Actual owner/player/DM/privacy/version acceptance remains separately required. |
| R17 M5 | Library NPCs distinct from character-attached relationship records. [Roadmap](ROADMAP.md), [existing narrative](../components/narrative). I=character relationships only/T=H subset/G=foundation/D=H subset/A=library open. | Library identity/personality/relationships + entitlement discovery/import and campaign DM management. Preserve current character privacy/copy records; no silent repurposing/backfill. |
| R18 M5 | Character-tied companions (mounts, beast forms, summons). [Roadmap](ROADMAP.md), [character domain](../lib/character). I=-/U/T=-/G=-/D=-/A=open. | Explicit hybrid schema/ownership/lifecycle; character and campaign linkage, supported stat blocks, transformations/summon dependencies, discovery and persistence/denial tests. Use existing effects contracts; spec uncertain rule semantics before coding. |
| R19 M5 | Expert/Spellcaster/Warrior sidekicks. [Roadmap](ROADMAP.md), [builder domain](../lib/builder). I=-/U/T=-/G=-/D=-/A=open. | Simplified archetype/level schemas and render/build/play behavior; entitled catalog/DM use and isolation/level/progression tests. Do not equate generic full-PC code with accepted sidekick rules. |
| R20 PRD §6/§8; M5.5 | Campaign membership/roles/invites/assignment; rich backstory/personality, wiki/backlinks/timeline/relationships/secrets. [Campaign spec](specs/2026-07-19-campaign-foundation-design.md), [DM-note boundary](specs/2026-07-19-character-dm-notes-boundary.md), [narrative](../components/narrative). I=foundation/T=H+local/G=yes/D=H/A=current open. | One real DM/player campaign with linked characters/wiki; permitted read-only DM view, privacy, conflicting revisions, copy/leave/removal/invite rotation and portrait/storage permissions. Optional live presence/public wiki waits S3/S5. |
| R21 M6 | Reviewed single-source slots and per-acquisition casting math are integrated; [M6 inventory](handoffs/2026-10-11-m6-advanced-spellcasting-inventory.md), [source casting](handoffs/2026-10-11-source-casting-ability.md). I=P/T=local+slots browser/G=P/D=H subset/A=open. | Subclass profile plan must preserve shipped object-tier grants; advanced exact selected-spell payment/usage choices and current real conflict/recovery acceptance remain. Retain Arcane Recovery; no duplicate counter or guessed subclass unlock. |
| R22 M7 | Supported PDF content import through reviewed M4 pipeline. [Roadmap](ROADMAP.md), [import domain](../lib/import). I=-/U/T=-/G=-/D=-/A=open S4. | Finite layouts/types/fixtures; reproducible extraction/provenance, manual corrections, validation/audit/calculation and atomic immutable commit. Reject unsupported inputs safely. No autonomous paid AI or broad external content ingestion. |
| R23 PRD §10 P0/MVP | Owner print/PDF snapshot is integrated; six Letter/A4 fixture PDFs, 33 inspected pages and privacy/margin checks passed. [Sheet source](../components/sheet), active receipts above. I=yes bounded/T=local PDFs/G=yes/D=-/A=open. | Reaccept after calculation changes, then real approved-account snapshots/native dialog and supported browser/device behavior. Loaded values are not an atomic DB snapshot. Character JSON/fillable-standard/campaign exports remain separate undecided ambitions. |
| R24 PRD §2 P0/MVP | Second playable SRD system (Daggerheart) and schema/system selection. [PRD](../inkborne-prd.md), [system schema](../lib/schemas/system.ts). I=generic registry, second U/T=generic/G=P/D=5e only known/A=open S2. | Approved system/content/version/license matrix; end-to-end creation/calculation/sheet/homebrew/print fixtures without 5e leakage. An explicit Victor deferral is needed to remove this launch P0. |
| R25 M8 | Current performance, accessibility, onboarding and feedback-driven polish. [Roadmap](ROADMAP.md), [design references](design-briefs), [alpha records](alpha). I=P/T=P/G=P/D=H/A=open. | Measure representative current routes/data shapes/devices, agree budgets from evidence, resolve material findings; test signup->builder->play->recovery plus accessibility, register real feedback/disposition. No made-up users, load results or blanket “polished” verdict. |
| R26 PRD §7; M4/M8 | Public visibility/publishing, copyright/licensing/redaction/moderation contract if selected. [PRD](../inkborne-prd.md), [sharing decisions](GAME-PLAN.md). I=-/P/T=-/G=-/D=-/A=open S3. | Decide contract before public exposure; owner controls/default-private, explicit consent, withdrawal/version preservation, redaction and abuse handling verified. Private owned-book entry is not public distribution authority. Repository license file was not located; license choice needs owner decision. |
| R27 M8 release/ops | Auth/provider/admin/storage/backup acceptance, reviewed publication, root/dev routing and rollback. [Release checklist](RELEASE-READINESS.md), [orchestrator release snapshot](CODEX-ORCHESTRATOR.md). I=P/T=local+H/G=core partial/D=old app+protected dev+splash/A=open. | G3-G5 actions on exact accepted SHA, migration ledger, URLs/data targets; HTTPS/DNS, login/session/recovery/callback/permissions and backup restoration verified. Explicit launch sign-off and known limitations. Local-ready or splash-ready is not launched. |

### PRD P1-P3 crosswalk (decision register, not silent exclusions)

| PRD sections | Documented ambitions and mapped evidence / next disposition |
| --- | --- |
| §1-§2 | Preferences/profile/portfolio, new systems/versions/validation -> R01/R24. Public profiles and 2024/system rollout remain S5 decisions, never implied by current schema support. |
| §3-§5 | Multiclass/death saves/conditions/copy/archive, quick presets, wizard spellbook/upcast/concentration, attunement/encumbrance/charges, party inventory -> R06-R08/R11/R21. Some shipped; inventory/test individually before accepting; presets/party inventory/charge semantics require finite selected scope. |
| §6/§8 | Notes/appearance/portraits/relationships/timeline/journals; sessions/calendar/quests/maps/gallery/wiki/live presence -> R20. Shipped subsets keep evidence; calendar/quests/maps/gallery/presence are not magically covered by wiki. |
| §7 | JSON content import/export, packs, marketplace, arbitrary mechanics and moderation -> R12-R14/R26. Keep original validation/versioning; public marketplace/arbitrary mechanics are S3/S5, not v1 requirements by implication. |
| §9 | Shared party/DM rolls, custom formulas, animations -> R08/R09. Existing dice/log evidence does not accept live sharing or animations. |
| §10 | Character JSON export/import, fillable-standard PDF and campaign export -> R23. Print P0 stays open; these are distinct data/format requirements needing acceptance or explicit deferral. |
| §11-§12 | PWA/offline writes, native/desktop apps, Discord bot, VTT, embeds/public API, external character migration -> S5 future register. Existing responsive web and MPMB imports are not these features. Specify selected targets/contracts before adding platform/service scope. |
| §13-§14 | Public roadmap/voting/open-source license, creator/community profiles/forums; system-admin tools, moderation/abuse, analytics -> R04/R26/R27 + S5. Feedback exists; remaining capabilities need inventory and owner choices. No analytics or external messages/services by implication. |

Before saying the **total documented project** is finished, every documented ambition has an explicit included/completed/deferred/out-of-scope disposition; all included requirements are accepted. Every PRD requirement, including unselected P1-P3 ambitions, must have a child requirement ID and accepted evidence or an explicit dated Victor disposition. A narrower public-beta verdict is an intermediate checkpoint only; automatically continue the remaining milestone/requirement queue. Do not indefinitely expand “finish” with new unrequested ideas.

## First actions and dependency-driven execution

1. **Review M1 integration now (R11):** refresh both Git common directories/clean states; review full PR99-derived delta plus `3d61ff3`; integrate in a new local branch off current core, preserving A1/equipment/conditional types. Run combined focused/full/build/offline magic-item/core checks and independent review. No push or deployment. Ordinary local integration does not need a second permission question.
2. **Batch actual decisions/approvals early:** present S1-S5 and prepared G1-G5 requests, with concrete target/version/operation/resource manifest where ready. Resolve E1 supported bind/CLI/version details before asking to start it. Keep working on unambiguous R12/R23 inventory and missing forms/print/acceptance harnesses while access is pending.
3. **Enable the real evidence lane (R07/R09/R11):** after actual runtime approval, replay full frozen migrations + reviewed stage on isolated PostgreSQL 17/Supabase; inspect baseline grants/triggers/ASI copy and multiple real connections. Fix discovered code/SQL-file defects locally; apply only approved fixture/schema operations to the named disposable target. Do not “repair” live history.
4. **Continue milestone implementation:** authoring families and selected import matrix -> M5 types -> remaining M6 adapters; M7 follows S4 and can run independently where dependencies permit. Use measured requirement gaps to formulate the next bounded task even when the original local queue is empty. Plans without corresponding implementation/acceptance do not close rows.
5. **Accept then release:** real browser->API->DB privacy/correctness/recovery tests, feedback and ops; approved publication of exact candidate, then verify actual deployed routes and record launch sign-off. Loop defect resolution and acceptance until the scope gate below passes.

## Grouped approvals: exact operation, target, risk, cleanup

This pass authorizes none of these actions. The next orchestrator prepares a concrete reviewable package and asks for only the approvals actually required. Reuse valid human authorization already present; local source/SQL-file edits, offline PGlite/unit/UI tests, planning and local commits need no extra invented approval.

| Group | Concrete package to request | Risk / limits / cleanup |
| --- | --- | --- |
| G1 runtime provisioning | Existing Docker Desktop Linux engine startup; if needed one pinned Supabase CLI/runtime download/install with exact version/checksum/image digest and reviewed host-bind plan. Target scratch `C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-runtime`, prefix `inkborne-equipment-e1-20261011`; frozen current candidate SHA. [E1 proposal](specs/2026-10-11-equipment-runtime-proposal.md). | Shared-daemon/resources/install effects; current engine unavailable and Supabase/psql not PATH. Resolve exact versions/compose bindings first, not generic “approve Docker.” Loopback 55430/55431/55432 only if needed/free, or no published ports. Never start broadly then fix bindings; no global stop/prune/firewall change. Record actual IDs and remove only owned resources. |
| G2 disposable full DB acceptance | Include this bounded scratch test plan in the G1 runtime package: complete migration replay, reviewed staged equipment SQL, synthetic fixtures, real-role grants/triggers/ASI-copy checks, concurrent sessions and receipt-preserving rollback. Include D1 local implementation when ready; manifest files/hashes and operations. Once this runtime/test scope is approved, ordinary local SQL/test iterations inside it need no repeated permission. | Disposable schema/data and test-only bootstrap material stay inside owned resources. Persistent credentials/access expansion need actual explicit approval. No hosted keys, login/link/PAT, `.env` copy, `db push` or live history repair. Retain receipts; clean only exact scratch resources/IDs after readback; no data-loss rollback shortcuts. Offline in-process tests are ordinary local work. |
| G3 hosted/browser acceptance | Prefer an explicitly selected nonproduction target; never invent one. If Victor selects existing Inkborne `etcaodglvcspcmwecyxq`, ask for that exact shared-target risk. Named approved owner A/B accounts; explicit caps/run ID: at most 2 characters, 1 campaign, 1 private item, 1 feat, 1 spell and 1 import job per approved attempt, plus separately approved account creation only if necessary. Freeze failure injection/read/write/cleanup scenarios. | Mutates real data, could expose private data or send auth mail. No existing user records or exhausted historical allowances. Record actual IDs before writes, do not reuse spent attempts; delete only approved run-owned IDs and verify absence. No “all tests” blanket permission; provider/account UI handoff as required. |
| G4 reviewed schema/security/auth/publication | Separate subsections: exact new migration versions/SQL/grants and data-preserving rollback; exact Supabase redirect/template/provider/settings deltas; exact Git branch/SHA/diff, PR action and Vercel project/environment/domain assignment. Request after concrete implementation/test evidence exists. | Persistent/live security or public release effect. Ability migration `20261010232200` is already applied: no reapply, blanket push/`--include-all` or ledger repair. Preserve SSO, RLS/private defaults, receipts, unrelated aliases/DNS/email. No credentials/tokens, broader access or merge/deploy by implication. |
| G5 ops/domain/launch | Exact existing Unraid backup/restore target/runbook, isolated restore destination and bounded cleanup; any offsite cost/credentials separately selected. Exact owned Cloudflare zone and apex/dev records plus auth-safe cutover/rollback. Final release sign-off after R01-R27/S decisions. | Real backups/infra, authentication routes and public exposure. No new paid service/account, global deletion, nameserver/protection change or external invitations without explicit authorization. Verify restore, DNS/TLS, app login/recovery, rollback and named cleanup; user signs in without credential extraction. |

All requests identify owner, frozen source, action/target, remaining uncertainty, risk, resource/data cap, exact cleanup and acceptance. If not concrete yet, do preparatory read-only/local work before asking. An access blocker closes only its dependency lane, not the project.

## Completion gates and durable tracking

### Mandatory total documented project completion gate

This gate is separate from local readiness and any launch/beta checkpoint. Every M1-M8 exit, including M5.5, and every documented PRD requirement must have accepted evidence or an explicit dated Victor disposition. Every documented ambition has an explicit included/completed/deferred/out-of-scope disposition; **all included requirements are accepted**. No open, unknown, blocked or merely unselected requirement may silently vanish. Deferrals/out-of-scope decisions name Victor, UTC date, exact requirement, rationale and remaining follow-up; never count them as implementation. After a staged beta, automatically continue all remaining documented milestone/requirement work. Only this total-completion gate, a user pause, or actual blockers affecting all remaining work can end the project-wide execution loop.

**Local readiness:** selected code integrated; meaningful focused tests, zero-warning full check, build and representative UI pass on one exact SHA; reviews done; reproducible data/runtime contracts with limitations recorded. This is a prerequisite, not launch.

**Actual launch:** (1) S1-S5 scope and every selected requirement disposition are explicit; (2) all selected rows reach accepted evidence on the frozen candidate, including full DB/real-role/concurrency/rollback where applicable; (3) real account/provider/session/privacy/builder/play/import/print/campaign/device workflows pass with cleanup; (4) backup/offsite/restore and performance/accessibility/feedback gates are satisfied; (5) no unresolved critical loss/leak/duplicate-write defect or unreviewed legacy policy; (6) publication/schema/auth/domain actions authorized and exact deployment/HTTPS/DNS/login/redirect behavior verified; (7) rollback, known limitations and Victor's dated launch acceptance are recorded. Deferred milestones keep their actual status; never call all milestones implemented if some are deferred.

Every work item records: ID and source requirement, owner/worktree/base, current stage, acceptance/dependencies, exact commits, commands/results/artifact paths, target/fixture budget/cleanup, remaining defects and next action. Append progress below and update the row evidence; history remains immutable. Fresh thread reads latest HEAD/status/ledger and resumes first ready dependency. Context/host/budget interruption is a resumable pause, not scope completion.

If no queued task is ready, inspect open requirement evidence and derive the next bounded implementation/integration/defect/acceptance task. Batch real approvals. Stop only for a human pause, an unresolved scope/approval/access dependency affecting **all** remaining work, or verified total documented project completion. Record blocked rows with exact next actions and continue unaffected work. Never stop merely because the prior local queue ended or offline tests are green.

| UTC date | Owner/source | Result | Next |
| --- | --- | --- | --- |
| 2026-10-11 | Tested core `ada6c9b`; docs `c5370eb`; standalone M1 `3d61ff3` / `6c740f0` | Bounded local queue complete, not launch. Existing evidence/limitations retained. | M1 integration review and real runtime plan; unresolved milestone/P0 inventory. |
| 2026-10-12 | Project-wide handoff, docs only | All M1-M8/P0 and future-scope decisions indexed; persistent loop replaces bounded-queue stop rule. No implementation/tests/runtime/hosting restarted. | Fresh owner refreshes state, works R11 and ready requirements, batches S/G packages. |
