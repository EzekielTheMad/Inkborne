# R16/M5 campaign monster instance — UNVERIFIED source freeze

2026-10-13. Sole writer m5-campaign-monster-worker/codex/campaign-monster-instances,
basis72296a3a6a53ed6e68035975bcfcc039e82d5d65. Approved plan6074992 is present in
this basis. Independent review BEFORE narrow gates, integration or activation.
No tests/typecheck/lint/build/browser/install, SQL/PGlite/CLI/provider/network or
credential/environment operations ran. Source, fixtures and static inspection only.
Existing package-lock Git blob8f064e62b49975deb60de5f2b75be8c9809106d2 matches HEAD;
package.json unchanged. Existing stages/migrations and other worktrees unchanged.

## Actual useful source, default off

New campaign schema/mapper, staged types, cookie-authenticated DAL, server actions,
actual controlled DM form/panel and owner-only list/detail routes. Minimal existing
CampaignPage change adds a link ONLY under actual owner AND product gate. Product
CAMPAIGN_MONSTERS_ENABLED=false; native campaign_monster_enabled_v1()=false.
Neither is remotely configurable or activated by caller input. DM-labelled member
is never treated as owner. Player route branch fetches no new DM instance props.
Missing/unsupported/failed reads are unavailable/errors, not fabricated empty lists.

Instances keep immutable complete source snapshot/digest/content/version/system,
declared max HP and creation identity. Name/manual currentHP0..max/plain notes and
archive/restore have changed+1/no-op exact bigint revision; no JS numeric revision.
Canonical parseContentVersionSnapshot AND strict monsterDataSchema are mandatory
before preview and detail/form stat-block rendering. Explicit raw format1/effects[]
only. Native integrity checks are identity/current-version/active platform-or-owned-
personal entitlement/digest/raw budgets/HP/controls/revision, NOT complete Zod
descriptive parity. Existing MonsterStatBlock/MonsterData/Library/characters/refs/
effects/NPCs/R09/P1 source and authority unchanged. M7/imports remain paused.

## Dedicated unapplied transaction/ACL source

Only new supabase/staged/campaign-monster-instances.sql. Installation prerequisites:
existing campaign authorization/content versions/import-origin schema, privileged
installer able to create/assign isolated NOLOGIN/NOBYPASSRLS/NOINHERIT owner and
grant narrowly scoped row-lock rights. No runtime CREATE or role memberships;
explicit preflight refuses unsafe existing role or inherited PUBLIC CREATE rights,
without changing existing roles/global ACLs. Four source/parent domains must already
have RLS enabled before lock-only grants; stage refuses rather than activating old
table RLS. Actual installer/roles remain G2.

Order: isolated role preflight→instance/receipt tables/indexes/ownership→FORCE RLS
and owner-only policies→private gate/Auth/owner/bounds/source helpers→immutable
row/native revision and receipt guards→triggers→public functions→exact14-signature
ownership/EXECUTE revocation and runtime-CREATE refusal→narrow authenticated grants,
all one transaction. No prefix-based ownership sweep. Source row locks have SELECT
and UPDATE(id/content_id) rights with restrictive WITH CHECK(false); no source DML.
The runtime role reads only campaign id/owner/system and import-origin content_id;
all-row parent existence is needed to distinguish actual campaign cascade from
RLS-hidden absence. Instance/receipt direct authenticated DML is denied. Native
role/policy/trigger/RI/row-lock compatibility is UNRUN, not established by this file.

Dedicated internally namespaced campaign+operation transaction advisory lock plus
unique receipt PK serializes same-operation commit/resolve. Different operations
serialize by actual instance FOR UPDATE and expected revision. Source creation /
preview locks definition→system→campaign→version, grounded in existing native
item-sharing lock order; platform or current owner personal only, no monster share
producer assumed. Exact version tuple/data/effects/owner/scope rechecked after waits;
native expiry equality denied. Replay rechecks current campaign owner/Auth after
waits and returns original receipt BEFORE NEW source/retirement/revision gates.
DAL recovery/commit/read context likewise avoids fresh published-system/source
queries; published unique-system lookup applies only to new source picker/preview.
Roster source-picker failure is explicitly shown as new-acquisition unavailable,
without blocking historical instance rendering or original-operation recovery.
INSERT/UPDATE and immutable receipt insert occur in ONE trusted RPC transaction:
any exception rolls back both. No P1-style pending proof/journal/deferred kernel.
Immediate source/identity/native revision/receipt guards support ordinary grants;
no claim of resistance to a privileged DB administrator or unavailable native fences.

Public functions, authenticated EXECUTE only, no PUBLIC/anon/service_role EXECUTE:

- read_campaign_monster_source_v1(uuid,uuid,integer): exact source preview.
- commit_campaign_monster_instance_v1(uuid,jsonb): strict create/update, receipt-first.
- resolve_campaign_monster_command_v1(uuid,uuid): matching receipt or observation absent.
- list_campaign_monster_instances_v1(uuid,boolean,text,integer): approved extra read
  projection, bounded20/name-filter/page0..500/stable name+immutable-ID sort, excludes
  notes/source snapshots and casts native revision::text BEFORE JSON.
- get_campaign_monster_instance_v1(uuid,uuid): approved extra owner-only single-record
  projection; text revision before JSON; DAL fully parses snapshot before owner props.

Read projection refinement was explicitly approved by root during source work;
staged-only return interfaces document all five signatures. No generated hosted
types, migration filename or SQL application. Campaign-only cascade includes both
instance and receipt; deferred instance FK and actual parent-absence delete guards
require native G2 rollback/RI proof. Own/platform catalog deletion does not cascade
through source IDs. Shared/cross-owner lifecycle and ownership transfer remain open.

## Controlled recovery and native field boundary

Form uses actual native name/HP/notes/source/archived controls and rejects mismatch,
duplicate/unknown/File DOM controls before submission. Server accepts one strict
intent, bounded cumulative40KiB transport before parse; no actor/source snapshot/
calculated maximum controls. Pending synchronous ref blocks duplicate calls; controls
and source selection lock, native reset prevented, revision/context drift does not
rebase draft. Literal source text remains escaped in unchanged stat block.

Rejected/missing/malformed response becomes uncertain with retained SAME operation
and immutable submitted intent; Check resolves that operation, explicit same-operation
resubmit only while its original in-memory intent exists. Absence never permits new
UUID even with acknowledgement; delayed original may still commit. No cancellation/
tombstone invented. Account/campaign/editor-scoped session storage retains ONLY
operation/saved ID, never notes/source/full intent. Reload without original intent
is recovery-only, cannot rebase/recreate; malformed/unavailable storage blocks new
submission. A definite initial refusal can expose conflict Reload latest, but an
operation that ever became uncertain is never released by subsequent error/conflict.
Validated saved receipt/ID survives cache, storage-update or navigation failure.
Creating another deliberate instance is available ONLY after validated accepted
receipt, explicit new-instance action. Form keys bind owner/campaign/editor identity.

## Prepared focused gates — NOT RUN

Seven focused suites: tests/campaigns/monster-instance-schema.test.ts;
tests/campaigns/monster-instance-stage-model.test.ts;
tests/supabase/campaign-monster-instances-staged.test.ts;
tests/supabase/campaign-monster-instances-server.test.ts;
tests/components/campaigns/monster-instance-form.test.tsx;
tests/app/campaign-monster-actions.test.ts;
tests/app/campaign-monster-pages.test.tsx (seven files; default-off route controls).
Run existing npm test -- <these paths> --maxWorkers=2, then npm run typecheck/lint
ONLY after root grants slot; preserve first failures and exact tested SHA/resources.
Root owns combined check/build and later reviewed actual offline/current CSS browser
matrix; native browser→API→DB proof is separately authorized G2/G3, not that harness.

Original Mossglass Sentinel fixture parses actual monster schema and includes explicit
HP/zero/negative modifiers and literal script-looking narrative. Canonical DTO tests
cover bigint/intent/readback/tampering, native fields/transport, complete parser refusal;
mounted actual form covers preview/manualHP0/clear/archive/pending/reset/drift/reject/
malformed/missing/absence/same-intent replay/reload/navigation/conflict. Mocked DAL
asserts owner/system/personal-only source queries, one mutation RPC, text revisions,
readback/preview identity and no direct catalog/character/instance/receipt writes.

Test-only stage review model constructor binds actual SQL critical fragments; token
removal refusal is STATIC source binding. Model semantic fault/receipt-first/absence/
CAS/source-continuity/owner cases are model_checked ONLY, simulate future enabled
transaction, not SQL interpretation, native atomicity/Auth/lock proof or readiness.
SQL static suite independently inspects actual critical function bodies/ACLs/order/
guards. No semantic-before receipt claimed: feature is additive and all gates unrun.

Remaining: exact dual source review, narrow/combined/type/lint/build and offline real
form UI; native staged installation/ACL/RLS/constraints/locks/race/rollback/receipt/
lost-response/campaign-cascade/real session-owner privacy acceptance; reviewed gate
enablement. Shared sources/cross-owner lifecycle, full native descriptive parity if
required, imports, automation, other M5 instance families and launch remain open.
This source does NOT make M5 or the project complete or authorize external actions.

## Source-only HOLD correction over immutable1825fe2

Synchronous lifetime operation/intent/accepted-receipt/ever-uncertain refs now admit
submit; React-rendered locked state is additional presentation, never the sole
admission. Matching call-token pending=false layout commit releases the mutex.
Initial definite prewrite refusal retains original refs/marker through settlement,
then clears only at that matching committed state; uncertainty never clears them.
Explicit same-operation replay remains available after committed settlement.

Committed mounted owner/campaign/editor/system/source-list refs and separate preview
request/selection tokens bind replies. Stale preview/context/version/system tuples
cannot update draft or silently pin. Command reply validation uses ORIGINAL scope,
operation and immutable captured intent; accepted old-context receipts retain their
saved ID under original scoped storage, without applying data to a different editor.
If a newer operation occupies that active marker, its marker is preserved and the
older accepted ID is retained in a separate operation-scoped accepted metadata key
(ID only, no raw receipt/notes/source; no new database recovery journal or RPC).
Same-editor accepted old-source receipt is shown even if source version later changed.

DAL source list requires an actual array; null/undefined/false/scalar no-error data
is unavailable, not []. Native detail null alone means not found; undefined/false/
0/empty string are malformed and refused. Genuine [] and null positives are prepared.
Mounted native settlement-gap saved/uncertain/prewrite-refusal controls assert
uncommitted DOM plus ONE call/original UUID/intent/marker; stale preview and accepted
old-context/source controls and strict DAL read cases are added. All remain UNRUN.
Only owned form, two route prop bindings, DAL, focused tests and this handoff changed;
SQL/ACL/default gates/source schemas/package lock remain exact1825 bytes. No gates,
network, SQL/runtime, new processes or other worktree writes.

Separate observed follow-on: ordinary edit after a confirmed saved receipt needs
an explicit fresh server latest-detail editor mount; current accepted edit marker
blocks subsequent HP edits. Root requires a finite reviewed proposal AFTER this
HOLD correction freeze. No new transition/auto-rebase/unknown marker clearing has
been implemented here; this source is still incomplete for repeat-edit acceptance.

## Repeat-edit transition proposal ONLY — quick review before implementation

Basis clean a316454; both initial HOLD groups independently source-approved, all
tests still UNRUN. Smallest follow-on uses the existing resolve/get-detail RPCs and
one deliberate new editor mount; no new RPC, SQL, journal, authority or auto-rebase.

1. In edit mode only, after validated saved/no-op receipt is committed, show
   **Edit latest instance**. Existing saved-instance link remains available. Button
   admission synchronously requires no active call/navigation transition, current
   mounted owner/campaign/editor/system correspondence, and acceptedReceipt ref
   matching committed receipt/operation and this instance. Unknown/uncertain/absent/
   error/conflict without accepted receipt never exposes or admits this transition.
2. On explicit click, first persist accepted operation+saved instance ID in its
   existing operation-scoped accepted metadata key. Inspect active marker: only
   the accepted operation may be removed (optional saved_id must match). A newer,
   malformed or unavailable marker refuses navigation/clearing. If the marker is
   already absent, accepted receipt still permits this deliberate transition;
   absence alone NEVER permits it. Do not clear the lifetime accepted receipt,
   intent or operation refs in the old form. Keep that form locked through failure.
3. Navigate via ordinary native `window.location.assign` to the internal detail
   URL `/campaigns/{campaign}/monsters/{instance}?editAfter={acceptedOperation}`.
   Use validated UUIDs/URLSearchParams, not arbitrary destination input. Hard
   navigation deliberately obtains a new server render and new client mount.
   On a thrown navigation failure retain receipt/ID/link, restore the original
   active marker ONLY if absent (never overwrite newer operation), and release
   the navigation mutex so **Edit latest instance** can explicitly retry. If a
   navigation hangs, remain locked with the same saved link/evidence; no new save.
4. Detail route remains default-off and cookie-authenticated current-owner-only.
   `editAfter` is one strict scalar canonical UUID, not read authority. Make this
   route explicitly dynamic/no cached detail response. Resolve that operation
   using existing owner-checked resolver BEFORE get-detail; require a validated
   saved receipt whose campaign/instance matches this route. Absent/refused/error/
   malformed resolution produces unavailable, never an editor reset. Then obtain
   the actual latest record through existing get-detail (full canonical snapshot
   admission), require current revision >= original receipt revision using bigint,
   and render the fresh values/revision. No guessed +1, historic receipt readback
   substitution or Library repin. A later concurrent edit is still native CAS.
5. Form key adds the validated accepted operation to owner/campaign/instance:
   `{owner}:{campaign}:{instance}:{editAfter || initial}`. This is a deliberate
   generation boundary even for a no-op at the same revision. Fresh component
   starts from actual server record; its ordinary storage read still checks any
   active operation marker. A manually entered editAfter URL cannot clear an
   uncertain marker or bypass recovery: the server does not touch session storage.
   Old accepted reply metadata cannot recreate a cleared active marker or overwrite
   a newer operation (a316 guard already enforces that).

Exact follow-on touchset: owned monster-instance-form.tsx, detail page.tsx, mounted
form and page tests, this handoff only. Existing source/DAL/SQL/ACL/schema/default-
off gates unchanged. No new generic navigation or recovery subsystem. Optional
`editAfter` changes page props/key only; current-cookie session and native owner
checks remain on every existing RPC. Native session/RLS/freshness proof stays G2/G3.

Prepared acceptance required before claiming repeat-edit: accepted edit→explicit
button→existing resolver+fresh detail→new mount with exact current revision→second
manual HP/notes/archive command; no-op→new mount despite unchanged revision;
unrelated concurrent revision newer than receipt, with fresh CAS/refusal; source
retirement/edit preserves embedded source. Negative controls: uncertainty/absent/
malformed/foreign receipt cannot clear; changed editor/owner/system, newer active
marker and storage failure refuse; navigation throw/hang retains saved ID and old
locked draft, retry cannot resubmit old save; direct editAfter URL with unresolved
marker remains recovery-only; stale/invalid latest revision/detail/receipt mismatch
unavailable. Test actual form controls/route functions, not a standalone DTO claim.
No implementation, tests, navigation, browser, heavy or runtime work ran for this
proposal. Freeze for independent source-plan challenge before bounded implementation.

## Approved repeat-edit follow-on — implemented source, UNVERIFIED

Independent approval of exact b038a0a authorized only the four source/test paths
above plus this handoff. This follow-on implements **Edit latest instance** after
an accepted edit receipt, with synchronous mounted owner/campaign/editor/system,
operation/receipt/target correspondence and navigation mutex. Accepted ID metadata
is persisted under its original scoped operation key BEFORE clearing only a
matching active marker. Newer/malformed markers or storage faults refuse the
transition; absent marker is sufficient only WITH the retained accepted receipt.
The old form never clears lifetime intent/operation/receipt or admits another save.
Thrown navigation restores the original marker only when absent, preserves the
saved link/accepted metadata, and permits explicit navigation retry. Returned or
hung navigation keeps that editor locked. No automatic retry or rebase occurs.

The existing detail route now accepts scalar lowercase UUID `editAfter`, resolves
its accepted receipt before latest detail, and checks exact campaign/instance plus
fresh owner/detail system identity and bigint revision >= receipt revision. It
uses the actual latest detail values and an operation-specific mount key even for
no-op saves. Current source acquisition is never requested for existing embedded
historical detail or receipt replay. Uncertain markers still force recovery-only
client admission when the URL is entered directly; this route never clears storage.

Installed Next guides read: route-segment-config, caching-without-cache-components,
page, and connection. Repository next.config.ts does not enable cacheComponents;
`dynamic = "force-dynamic"` follows the installed previous-cache-model guide and
requires each detail request to read freshly. This configured behavior is not
native cookie/session/RLS/cache runtime proof. React checklist: transition writes
occur only on explicit click, ref mutex protects synchronous clicks, native button retains the
saved link/status, storage holds IDs only, and dependent resolver→detail reads are
intentionally sequential. No new dependency or shared state is introduced.

Prepared mounted controls cover updated/no-op first save→explicit transition→new
editor with independently supplied latest revision→second manual HP command;
persist/clear/navigation order; hung and thrown navigation; absent restoration
without overwriting newer markers; malformed/foreign/newer markers; storage
persist/read/clear faults; and unresolved edit/reload absence staying locked.
Route controls cover scalar UUID/duplicate parameter rejection, owner denial,
receipt-before-detail ordering, foreign/missing/malformed/absent receipt refusal,
older/invalid/foreign latest detail refusal, >2^53 exact revisions, unchanged no-op
generation, and historical source continuity without fresh acquisition. Transport,
navigation, owner/DAL reads and fresh mount are simulated in these tests; they do
not prove a server request, native transaction, real Auth or persistence.

Only the approved four source/test paths and this handoff changed from b038a0a.
`git diff --check` is the sole static check so far. All npm tests/typecheck/lint,
browser/full/build, SQL/native/provider/runtime validation remain UNRUN on root's
heavy hold. SQL/ACL/DAL/schema/mapper/dependencies, default-off gate and all other
worktrees are unchanged. Freeze this exact source for independent review before
gates. M5 workflow source is reviewable; M5 and native G2/G3/recovery acceptance
remain incomplete.

## First narrow run — fixture admission failure preserved, correction UNRUN

Exact clean 5f124136f7142e16b8e9f8a9087c928e044f8a90 was independently reviewed
before root released the exclusive narrow slot. Command (existing package script):
`npm.cmd test -- tests/campaigns/monster-instance-schema.test.ts tests/campaigns/monster-instance-stage-model.test.ts tests/supabase/campaign-monster-instances-staged.test.ts tests/supabase/campaign-monster-instances-server.test.ts tests/components/campaigns/monster-instance-form.test.tsx tests/app/campaign-monster-actions.test.ts tests/app/campaign-monster-pages.test.tsx --maxWorkers=2`.
Exit1, 30.20s: six suites failed collection at original shared fixture admission;
one static-stage suite passed6/6. Actual unchanged monsterDataSchema uses canonical
CREATURE_SIZES with `Medium`; original fixture declared lowercase `medium`. No
behavioral regression result or semantic-before proof can be inferred from these
collection failures. Correction changes ONLY that fixture value to `Medium`, not
schema/product logic/SQL/assertions. Correction itself remains UNRUN for exact review.

Preserved local evidence directory: test-results/m5-campaign-monsters-local.
focused-5f-first stdout/stderr/process/result and source.json are hashed in
focused-5f-first.manifest.json, SHA256
`0371C32C8DDC261F1A5234C4AD75534458CE8F55BBBAB50C99203E34C45E80D8`.
Outer helper records actual OS birth/PID/parent/command, inherited cwd and UTC start;
12 captured identities freshly absent after exit, owned listeners0. Global process
count503→468, CPU43→63%, free physical memory5166192→5021460KiB. Package lock SHA256
unchanged before/after `7225AA9026EB747C5626204C9E5E5901809F95B33A1AACABA35CD139E86A2EB6`.
No cleanup kill needed. Typecheck/lint and all further gates stopped after first
failure; root heavy slot explicitly released. Native SQL/Auth/G2/provider acceptance
unchanged and unrun. Freeze fixture+handoff for independent review BEFORE rerun.

## Second narrow run — scheduling precondition failure, correction UNRUN

Exact clean 0aec1242c911bc35f92ba413fd37f483b6b83f03 fixture-only correction was
independently approved before rerunning the same seven-suite command/maxWorkers2.
Exit1,9.48s: 134passed/3failed (137); six suites passed, mounted form39cases had
three failures ONLY at settlement-gap enabled-DOM precondition. Actual discrete
initial submit already committed pending=true, so expected fieldset.disabled=false
was false reasoning about test scheduling; those three controls never reached their
one-call/original-identity assertions. All repeat-edit/route cases passed, without
claiming native server/DB authority. No assertion is removed or reversed to green.

Prepared test-only correction places FIRST actual native submit dispatch inside
real React startTransition within existing async act, deliberately delaying its
pending/operation render. Response getters record access by the ACTUAL parser;
assert observed response (and saved-ID storage for saved case) before the SECOND
native dispatch. Enabled old DOM, one-call, original operation/intent/marker and
post-commit refusal/replay controls stay intact. This is an explicit adversarial
React scheduling control, not a claim that ordinary discrete submits always defer.
Product source and canonical fixtures stay unchanged. Correction is UNRUN and
requires exact review before rerun; no semantic-before result is claimed.

Preserved focused-0aec-second stdout/stderr/process/result in the same local
evidence directory; focused-0aec-second.manifest.json SHA256
`575A551693CB31EB482514F6E903FEB4C416073447480738AF7FD53D92FC286C`.
All12 captured OS identities freshly absent, owned listeners0; global processes
508→498, CPU48→41%, free memory4604524→4979564KiB. Lock SHA256 unchanged7225AA…A2EB6.
No kills or other worktree writes. Typecheck/lint remain unrun; gates stopped and
heavy slot released pending independent correction review. Native/default-off
boundaries and all missing G2/G3 acceptance remain unchanged.

Exact8749 test review identified ONLY its expression callback returning dispatchEvent's
boolean, incompatible with installed React TransitionFunction's void/undefined contract.
Correction uses a block callback with no return; scheduling and every oracle stay
unchanged. This test-only line plus handoff remains UNRUN for quick exact review.
Product5f/fixture0aec/SQL/default-off bytes remain unchanged; no heavy work executed.

## Third narrow run preserved; approved outside-act scheduling correction UNRUN

Approved587c145 rerun of the same seven-suite command/maxWorkers2 exited1,8.49s:
134passed/3failed (137). ResponseObserved succeeded; the three enabled-old-DOM
preconditions still failed before their lifetime assertions, despite startTransition
inside async act. No product defect/native proof or semantic-before result is claimed.
focused-587-third stdout/stderr/process/result are preserved; manifest SHA256
`A92EF2ACEC9C71D29DD81AB6F911562A1F6FB3D190515DB615EFF6A7C8ECFF6A`.
All12 OS identities absent/owned listeners0, global count467→468, CPU29→27%,
free memory7160772→7076640KiB, lock SHA256 unchanged7225AA…A2EB6. Type/lint stopped.

Root/m1 approved finite TEST-only proposal: installed react-dom-client.development.js
scheduleCallback$1 reads ReactSharedInternals.actQueue directly (lines18749ff);
when null it calls the normal Scheduler. Warning flag is a separate check in
warnIfUpdatesNotWrappedWithActDEV, not the scheduling selector. No internals or
Scheduler are modified. FIRST native startTransition block callback is now OUTSIDE
act, followed by ONLY two Promise microticks, observed-parser/saved-ID/enabled-DOM/
original-operation/intent/marker assertions and SECOND native dispatch before a
host task. Existing one-call and committed refusal/same-operation replay controls
remain intact. IS_REACT_ACT_ENVIRONMENT=false suppresses only stress-window warnings;
finally restores its EXACT prior own property descriptor (or prior absence), then
always awaits actual act flush even on assertion failure. No hooks/ref/DOM/timer,
Input or Scheduler mocks. Product/fixture/source SQL bytes unchanged.

This correction is source-only UNRUN, frozen for exact review before gates. If the
next enabled-DOM precondition fails, preserve/STOP; no additional scaffolding or
assertion flipping is authorized. Prior failures remain immutable and fully
distinguished from the prepared scheduling control and native acceptance gaps.

## Final bounded scheduling attempt — STOP, remaining condition UNPROVEN

Independent exact0e8eab9 review approved the outside-act control before root released
the final bounded attempt. Same seven-suite package command/maxWorkers2 at clean
0e8eab9ee6cfd27abeb16bbe59061a1398345bb5 exited1,8.63s:134passed/3failed (137).
Six suites passed; mounted form39cases had36passed and the same three stress
preconditions failed. Actual responseObserved succeeded; old fieldset was already
disabled instead of remaining enabled before second native dispatch. Therefore
these three enabled-old-DOM settlement-gap lifetime assertions remain UNPROVEN.
Passing ordinary pending/duplicate/recovery and repeat-edit/route controls are
retained but cannot substitute for that exact adversarial condition. No product
invariant failure, semantic-before or native SQL/Auth proof is claimed from these
scheduling precondition failures. No disabled assertion was flipped or removed.

Per root's final bound: STOP. No additional scheduling scaffold/source rewrite,
retry or assertion reversal; no typecheck/lint/full/build/browser run. Existing
red controls/source remain frozen for root's next explicit acceptance decision.
All prior failure receipts remain immutable, including first fixture collection
failure5f, collected134/137 at0aec, and collected134/137 at587.

Preserved focused-0e8-fourth stdout/stderr/process/result manifest SHA256
`7BE4E0B8968BC395C7D48BD17F87D915E47AFEF04BDC6947482D696B5689A563` under
test-results/m5-campaign-monsters-local. Actual12 OS identities freshly absent,
owned listeners0, no cleanup kill needed; processes471→469, CPU28→35%, free memory
6559972→6681052KiB. Package-lock SHA256 remained
7225AA9026EB747C5626204C9E5E5901809F95B33A1AACABA35CD139E86A2EB6.
Heavy slot explicitly released immediately after readback. This final follow-up
is docs-only; all0e8 source/test/SQL/default-off bytes unchanged. M5/native G2/G3/
recovery acceptance and tests/type/lint closure are still incomplete.

## Independent pending disposition — LOCAL DISABLED SOURCE ONLY

Root/m1 explicitly approved marking exactly three retained stress cases `.skip`,
UNVERIFIED, after the bounded attempts. Their complete bodies, scheduling setup,
response getter/ID, enabled-DOM, original UUID/intent/marker, one-call, committed
definite-refusal and same-operation replay oracles are preserved unchanged. No
assertion is removed/reversed, no product behavior or scaffolding is added. This
is NOT M5 acceptance, a risk waiver, stress proof or native/default-gate enablement.
The three generated cases remain required acceptance items:

- **M5-STRESS-SAVED — UNVERIFIED:** `actual DM monster form with simulated transport only > native settlement-gap submit after immediate saved cannot replace lifetime operation/intent/marker`.
- **M5-STRESS-UNCERTAIN — UNVERIFIED:** `actual DM monster form with simulated transport only > native settlement-gap submit after immediate uncertain cannot replace lifetime operation/intent/marker`.
- **M5-STRESS-ERROR — UNVERIFIED:** `actual DM monster form with simulated transport only > native settlement-gap submit after immediate error cannot replace lifetime operation/intent/marker`.

Exact failed setup condition in each collected attempt: after two Promise microticks,
`form.querySelector("fieldset").disabled` was true; oracle requires false (old enabled
controls before second native submit). The0aec attempt had no responseObserved
instrumentation. Explicit actual-parser getter observation/assertion was added8749
and succeeded in587/0e8 before their enabled-DOM precondition failures.
The test stops there before second dispatch/lifetime oracles; ordinary pending,
recovery and explicit accepted repeat-edit positives do NOT prove that stress gap.
Required closure remains actual browser/native proof of settlement-gap duplicate
admission and original-operation/intent/marker retention, saved/uncertain denial,
and definite initial refusal release only after matching committed settlement;
same-operation recovery stays explicit. Root canonical ledger will retain these
requirements after its integration unfreeze. No native/runtime approval is inferred.

All four immutable attempts remain preserved:5f fixture collection failure with
only static6passed;0aec,587,0e8 each collected134passed/3failed. Future narrow output
is EXPECTED134passed/3SKIPPED, not137passed; this is NOT observed yet. This skip-only
test line/comments plus handoff requires exact source review BEFORE any gate;
typecheck/lint and new focused count remain UNRUN. Product/native gates remain
FALSE. All11 production paths, fixture0aec, staged SQL, DAL/schema/ACL/dependencies
are unchanged. No processes/heavy/SQL/network/runtime work ran for this disposition.

## Observed pending-gate run; fixture type annotation correction UNRUN

After exact skip-only/accuracy review and explicit root lane release, same seven-suite
package command/maxWorkers2 at clean4faca6e2189ffb15dfaf03a646ffc040c4d281ca exited0,
8.84s:7suites passed,134tests passed/3SKIPPED (137). This is the observed count, NOT
137passed or closure of the three UNVERIFIED M5 stress/native requirements. Their
bodies/names/oracles and default-off product/native flags remain unchanged.

Sequential `npm.cmd run typecheck` exited2: two TS2345 test-only errors at
monster-instance-schema.test.ts34 and monster-instance-stage-model.test.ts22.
Shared fixture monsterCreate declared InstanceRequest's create|update union despite
always returning literal command:create; spreading name therefore admits a type-level
update alternative that cannot have that top-level property. Minimal correction
narrows ONLY its return annotation to Extract<InstanceRequest,{command:"create"}>.
No runtime fixture value, assertion, test body, product/schema/SQL behavior changes.
This correction is UNRUN and frozen for independent review BEFORE rerun. Lint did
not run after type failure; no full/build/browser/SQL/native validation ran.

Local focused-type-4faca.manifest.json SHA256
`0FB678F3E0529AFF293EA50D9D4080B8727F98B65583F69447B7F38EF96779B8` binds focused and
type stdout/stderr/process/result under the existing evidence directory. Focused
12/type5 captured OS identities absent and both owned-listener readbacks0; lock
SHA256 unchanged7225AA…A2EB6. Focused global processes465→466,CPU57→65%,freeKiB
6853812→6827752; type466→468,CPU27→59%,freeKiB6950856→6716916. No kills needed;
heavy slot released immediately. All prior failed receipts preserved. Remaining
type/lint/review/root combined gates and M5/G2/G3/recovery acceptance remain open.

## Type pass; single intentional hard-navigation lint policy warning preserved

Root exact6b793 fixture annotation review approved remaining sequential gates only.
At clean6b793fe8b3e35e4e6ac2297509a2f4ec5023f5c6 `npm.cmd run typecheck` exited0.
No focused rerun was needed after a type-only annotation; actual4faca134passed/
3skipped remains the reported observed focused result. Then `npm.cmd run lint`
exited1 due solely to one recommended Next rule warning (0 errors):
@next/next/no-location-assign-relative-destination at actual form's deliberate
globalThis.location.assign(target). max-warnings=0 makes that warning a gate failure.
Installed rule source explicitly flags relative hard navigation mechanically.

Reviewed repeat-edit design deliberately requires native navigation for a fresh
current-owner server read and new component lifetime after validated saved receipt.
Smallest proposed correction is ONE eslint-disable-next-line for this exact call
with that rationale; runtime code, URL/receipt/storage/mutex/restore and tests stay
unchanged. No global lint configuration or alternative alias evades the rule. This
scoped policy exception is UNRUN and frozen for exact source review before lint
rerun. Native cache/owner/session/navigation proof remains unrun; a comment does not
certify it or close the three skipped stress requirements/default-off gates.

type-lint-6b793.manifest.json SHA256
`ED1A7CDEA519ABFBE3ABC56D54E9827F8F8A0E06BF6799B6F8202133FE9749C8` binds both gate
stdout/stderr/process/result in the existing local evidence directory. Both type5/
lint5 OS identities absent, owned listeners0, package-lock SHA256 unchanged7225AA…
A2EB6. Type global count465→465,CPU35→63%,freeKiB6811748→6720504; lint465→467,
CPU29→57%,freeKiB6802456→6992864. No kills; lane released after readback. All first
failures, pass receipts and unverified acceptance items remain preserved. No native
SQL/Auth/engine/provider/network/build/full/browser or unrelated source changes ran.

## Observed final local gates — disabled integration ONLY

After independent exactd43 comment-only approval, ONLY `npm.cmd run lint` reran
at clean d43c3b688abeb4e4765b4f46ba62aa915b5b73dc: exit0, outer receipt39.80s.
Observed local closure therefore binds focused134PASSED/3SKIPPED at4faca (7files,
Vitest8.84s), typecheckPASS at6b793, lintPASS atd43. Root explicitly required no
test rerun after the type-only fixture annotation or type rerun after comment-only
lint exception. These are exact separate source heads, not a claim all three gates
ran on one HEAD. Final source changes after each successful gate are reviewed
type/comment annotations only; root owns exact combined integration gates.

All9 gate executions across7 source heads and failures are retained:

| Exact source HEAD | Gate | Observed result |
| --- | --- | --- |
| 5f124136f7142e16b8e9f8a9087c928e044f8a90 | seven focused | exit1; six collection failures, static6passed |
| 0aec1242c911bc35f92ba413fd37f483b6b83f03 | seven focused | exit1;134passed/3failed setup |
| 587c1456a3714bfd61da96e1729fd2094acc96a6 | seven focused | exit1;134passed/3failed setup, parser observed |
| 0e8eab9ee6cfd27abeb16bbe59061a1398345bb5 | seven focused | exit1;134passed/3failed setup, parser observed |
| 4faca6e2189ffb15dfaf03a646ffc040c4d281ca | seven focused; typecheck |134passed/3SKIPPED; exit2 two fixture TS2345 errors |
| 6b793fe8b3e35e4e6ac2297509a2f4ec5023f5c6 | typecheck; lint | type exit0; lint exit1 single intentional hard-nav warning |
| d43c3b688abeb4e4765b4f46ba62aa915b5b73dc | lint | exit0 |

Aggregate final-manifest.json SHA256
`324DAE06989BE4CC88A1B2B19DB360C75D25CB9E84E069AFD0903518FE534177`
in test-results/m5-campaign-monsters-local binds all stdout/stderr, source/process/
resource/result receipts, prior failure manifests, gate-index-final.json and fresh
final-readback-d43.json. Gate index retains exact commands/UTC starts/ends/source
status and OS birth/PID/parent/command/inherited-cwd identity receipts. Final fresh
readback2026-10-13T19:57:19Z confirms ALL80 recorded identities absent and recorded-
PID listeners0; no kills needed. Lint515→520processes,CPU25→34%,freeKiB6645196→
6642812; fresh readback507processes/CPU52%/free6673512KiB. Lock SHA256 unchanged
7225AA9026EB747C5626204C9E5E5901809F95B33A1AACABA35CD139E86A2EB6 in all9 gates.
Heavy slot explicitly released immediately after final readback. This final tested
handoff is docs-only; code/test/fixture/SQL bytes remain d43 source.

This permits LOCAL DISABLED SOURCE integration only. M5-STRESS-SAVED, M5-STRESS-
UNCERTAIN, M5-STRESS-ERROR remain required UNVERIFIED items with exact retained
bodies/names/oracles;134passed/3skipped is NOT137passed or a waiver. Product/native
flags are FALSE. Actual browser/source-build acceptance, native G2/G3 Auth/RLS/
transaction/recovery/fault/concurrency/cascade proof and reviewed enablement remain
open. No SQL/engine/provider/network/hosted operation or M5-complete claim follows.
