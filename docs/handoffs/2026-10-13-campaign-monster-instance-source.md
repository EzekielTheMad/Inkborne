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
