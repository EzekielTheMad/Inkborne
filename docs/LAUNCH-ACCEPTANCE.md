# Inkborne project-wide acceptance ledger

## Current execution path

Reconciled 2026-10-25 (America/Phoenix). **This is the single current plan:**
milestone meanings, requirement status, execution order, scope decisions and
completion gates live here. [CODEX-ORCHESTRATOR](CODEX-ORCHESTRATOR.md) is the
operational entrypoint; its linked handoff supplies the exact source/runtime
procedure. ROADMAP is a navigation page, GAME-PLAN is a handbook, the PRD is a
feature baseline, and dated handoffs are evidence. None defines another backlog
or overrides this queue. Historical completion counts are not current acceptance.

### Names have one meaning

- **M1–M8, including M5.5:** only the project milestones in the
  [milestone matrix](#milestone-matrix). M1 is consolidation/operations (R01–R04).
- **R06 builder workstream:** the character-builder work we have been following,
  within roadmap M3's builder/gameplay foundation. Earlier notes called this
  `M1/R06`; that alias is retired. Renaming it does not restart or redirect it.
- **Legacy worker ID M1:** the historical magic-item worker, now tracked as R11
  under M4. Its filenames, branch names and commits remain evidence, not another
  milestone. A1–A6 story IDs, F1–F3 repairs, G1/G2 runtime steps, PRD "Phase 1"
  and spell-management subphases are also not project milestone numbers.

### Continue the existing queue

1. **Preserve the completed current-state R06 creation slice.** Its Fiend,
   Draconic, native parent, ancestry and complete caster/martial checkpoints
   retain their exact evidence in the
   [current handoff](handoffs/2026-10-24-builder-correction-and-casters.md) and
   [finite remaining matrix](specs/2026-10-24-builder-remaining-matrix.md).
   Fiend and Draconic pass actual local acceptance. Current-state parent
   acceptance now passes at`13dde07c`, including genuine edits/reload, native
   guards/background writes, actual HTTP access and Fiend correction/replay.
   Current ancestry/A4 and all fourteen queued full creation journeys now pass
   compositionally, covering all twelve classes. A6 passes at `1f15a44` with
   zero memory restarts; stop this finite verification slice and preserve every
   accepted story. The existing R08 Bardic Inspiration capacity source correction
   now passes focused helper/provider/widget checks at `ce7330f`; actual selected
   sheet use and Journal integration remain pending under approved CSJ-v1.
   Historical parent/A4/F3 upgrade aggregators and old installer prerequisites
   remain separately open; retain their exact gates, resource and cleanup rules.
2. **Continue remaining M1–M6 work, including M5.5**, from open requirement rows
   after the builder work. Preserve accepted saving/recovery, Fiend eligibility,
   class acquisition/removal and other accepted slices; do not queue them again
   as missing implementation. Continue unaffected local work when a real
   access/resource dependency blocks one lane.
3. **M8 follows the required core acceptance**, including release/operations
   gates and an explicit scope disposition. M7 PDF importing stays paused and
   tracked as R22; the separately paused creature-import subset belongs to M5.
   The PDF pause is neither completion nor a new post-beta deadline. Resolve its
   beta disposition explicitly before launch, without resuming PDF work or
   asking for layouts now. Daggerheart and public publishing remain deferred
   from first beta under S2/S3, with their project backlog retained.

### Cross-lane integration queue — 2026-10-29

This queue assigns dependencies within the existing R08/R15/R20 scope. It does
not change the milestone order, reopen acceptance or authorize implementation,
fixtures, credentials, runtime starts or hosted changes.
[Ownership and report sources](dashboard/OWNERSHIP.md) remain canonical for writers.

| Shared issue | Responsible owner and consumer | Next useful action and integration order | Current boundary |
| --- | --- | --- | --- |
| Journal update acknowledgement/conflicts (R20) | Coordinator: shared `app/(app)/characters/[id]/story-actions.ts`; Journal: `components/narrative/timeline-section.tsx` consumer and its tests | First review the unapplied update-ack proposal against current source for compile validity, conditional owner/event/character/expected-time matching, strictly advancing timestamps, returned-row acknowledgement and old-client reopen behavior. Agree the exact action/UI write window before any implementation; then check stale, removed, foreign and genuine two-tab outcomes together. | Proposal only; source/applicability evidence is not an applied or accepted safeguard. Narrative writes must preserve all mechanics and native character data. |
| Journal uncertain-create recovery (R20) | Coordinator: shared persistence/recovery contract; Journal: draft/retry presentation | Resolve structured pre-write-rejected, unknown and conflict outcomes plus stable operation identity/owner-scoped readback after the update review and before claiming recovery acceptance. Reuse existing contracts and record compatibility; response loss must preserve the draft and pause replay. | Unresolved. No title/body identity matching or blind automatic replay; no new global save framework. |
| Journal fixture and runner package (R20) | Coordinator: authorization, fixture producer, private runtime config and `scripts/unraid/` lifecycle; Journal: `e2e/local-journal/real.config.ts` and `real-journal.spec.ts` | After persistence dispositions, apply Victor's 2026-10-29 approval recorded below and confirm explicit producer/runner file ownership for four distinct roles, two owner characters, one campaign and at most three journal entries. Only an authorized later task refreshes live guards, prepares the package and runs the single real story with exact cleanup. | Runtime occupancy is released, not blocked. Victor approved the bounded fixture/account package on 2026-10-29; persistence review, file ownership and lifecycle checks still gate execution. Real save/reopen, audience/denial, conflict and recovery acceptance remain open. |
| Library related definitions (R15) | Coordinator: `lib/supabase/content-definitions.ts` and `lib/supabase/compendium-server.ts`; Library: `app/(app)/library/[id]/page.tsx`, `components/compendium/compendium-detail.tsx`, `components/compendium/class-profile.tsx` consumers | Review relation identity/version/access for class-feature, trait and subrace references as the next independent shared-contract review after Journal persistence disposition. Establish current-authorized versus unavailable/ambiguous behavior; never let historical-pin fallback broaden discovery. Agree reader/consumer writes, then bound real allow/deny checks before acceptance. | No relation policy/reader change adopted. Slugs are not exact version pins. Display improvements stay isolated with simulated evidence. |
| Shared checkout serialization | Coordinator schedules each write window; Character Flow retains character product files/report | This coordinator checkpoint uses only overview, ownership, ledger, orchestrator pointer and coordinator handoff. Release that window after its commit; agree later producer/consumer/index windows before shared edits. | One writer per worktree. No concurrent shared edits, lane report takeover or registration relink. |

Character Flow's next action remains **R08 Bardic Inspiration capacity** (prepared
1 versus expected 3 at CHA 16/17), with its existing resource authority. It is
unblocked by these coordination dependencies. Library's **declared armor
Dexterity-cap presentation** is independently ready in
`lib/compendium/presentation.ts`; the relation proposal does not block it.
Journal retains its feature/report ownership and prepared story; its real
acceptance is blocked on coordinator persistence and fixture dispositions above.
No lane is instructed to start additional feature work in this first run.

Preserve the fourteen locally accepted creation journeys and their separate
source/catalog bindings. Library's four display slices remain simulated and
isolated; Journal UI remains simulated and its real story source-reviewed/unrun.
Neither reported implementation nor a prepared test is integration acceptance.
**Journal authorization — 2026-10-29:** Victor states, “Journal is good to
proceed,” in direct response to the bounded setup described at the prior
checkpoint. This approves four disposable test identities, two owner characters,
one DM-owned campaign and at most three journal entries in the existing isolated
scratch lifecycle, including the temporary credentials/test data and disposable
app/database/browser runner. No production restart or hosted-data/security
change is included; existing services/data must remain unchanged.

Coordinator still owns shared-save/conflict/create-recovery disposition and
fixture/runner producer integration; Journal retains its consumer/test/report
ownership. Agree exact write windows and refresh live lifecycle guards before
execution. Verify the single owner/DM/member/outsider save/reopen/denial story,
native mechanics retention and exact fixture/runtime/private-file cleanup.
This is authorization to proceed within those gates, not test execution or
integration acceptance. No repeat user approval is needed for this same bounded
package; material expansion requires a new decision. Existing S5/P1-P3 decisions retain their
place in the [decision register](#prd-p1-p3-crosswalk-decision-register-not-silent-exclusions).

### Approved CSJ-v1 — creation, basic sheet use and Journal

Victor explicitly approved CSJ-v1 and dispatch in Inkborne Coordinator on
2026-10-29. This bounded outcome sits within R06/R08/R20 and preserves the
existing milestone priorities, accepted creation receipts, paused/deferred work
and external-action gates. The preceding queue's pending ownership references
are superseded only by these explicit implementation assignments.

| Criterion | Required observable result | Implementation owner |
| --- | --- | --- |
| CSJ-1 creation continuity | Normal UI creation of Half-Elf Fighter4/Acolyte standalone and Human Lore Bard3/Acolyte campaign; saved builder steps, completed sheet, reopen and exact identity/pin/choice retention. Those same two IDs feed Journal acceptance. | Character Flow |
| CSJ-2 basic sheet | Ability check and equipped weapon attack appear in the successful roll log; nonlethal damage, healing and temporary HP persist on reopen. Narrative remains unchanged. Bard CHA16 has Inspiration capacity3, maxHP24, spellDC13, attack+5, slots4/2 using the accepted fixture. | Character Flow |
| CSJ-3 narrative continuity | At most three entries: standalone, campaign Owner & DM, campaign-visible. Create/edit/save/reopen preserves title/date/rich body/audience/order, the same character IDs, mechanics/choices/pins/equipment/spells/resources. | Journal |
| CSJ-4 audience | Owner edits; DM reads allowed entries without mutation; campaign member sees campaign entries only; outsider/anonymous denied. Genuine identities and real database behavior required. | Journal; Character Flow fixture producer |
| CSJ-5 conflict/recovery | Stale/removed UPDATE cannot falsely succeed; known rejection and uncertain results retain drafts. Lost committed edit is read back by exact identity; uncertain CREATE uses stable operation identity and owner-scoped readback with no blind retry/title-body matching/duplicate insertion. | Journal action/UI pair |
| CSJ-6 assembled acceptance | Desktop1280/mobile390 selected workflow, exact candidate/lane/content/runtime binding, focused security/data-integrity checks, one independent read-only review and exact fixture/runtime/private-file cleanup. | Coordinator accepts; lane owners implement/run |

Environment remains the approved disposable local Unraid lifecycle: exactly four
roles, two owner characters, one DM-owned campaign and at most three Journal
rows. Use normal UI creation rather than prebuilt replacements for the connection
criterion. Refresh live resource/identity guards and serialize heavy runs.

Explicit exclusions: durable resource/slot spending, rests/hit dice, death-save/
concentration transactions, new equipment award/copy/purchase policies, new
multiclass coverage, broader all-class play, advanced Homebrew, new Library
relation discovery, campaign-management features, publishing/imports and hosted/
release acceptance. No push, PR merge, deployment, hosted data/security change,
production restart, new threads or interruption of active work.

Character Flow owns selected source and bounded runner/fixture adaptation.
Journal is explicitly assigned the bounded shared narrative save-action plus
consumer implementation, subject to coordinator-approved shared contracts.
Coordinator keeps contract decisions, overview/queue/checkpoint and acceptance;
lanes keep their reports and source. Library provides existing-content
compatibility clarification only if needed. Feedback is independent of this goal.

Messaging/replies are authorized only with Character Flow
`01a1790d-be90-73d1-91f6-84e48a557ee1`, Character Journal
`01a1888e-2454-7633-b5f5-57c36e522a82`, Library / Encyclopedia
`01a1888d-9110-7e90-8ee0-516640d33539`, and this coordinator
`01a1890b-d3ee-7231-94de-6eb24a755f70` as the return destination.
One central bounded independent read-only subagent review is authorized.
No automatic new-thread creation, scheduling or model changes.

Retain all fourteen accepted creation journeys and their separate source/catalog
bindings; reuse unchanged evidence. New two-character integration evidence
closes the missing connection, not the whole creation matrix or R06/R08/R20.
The cycle ends at CSJ-v1 local acceptance or a precise blocked checkpoint; it
does not auto-start the next milestone. Live assignment/evidence state is in
the [single coordinator checkpoint](handoffs/2026-10-29-project-coordinator.md#csj-v1-coordination-checkpoint).

**Previous CSJ-v1 checkpoint — source blocked, 2026-10-29T20:13:03.529Z.**

The capacity correction `ce7330f` and Journal `a3842f4` have clear central
exact-source review and their recorded focused checks. All ten reviewed Journal
product/test blobs are assembled in `31222a1`; four partial runner files are
saved, but the normal-creation producer is deliberately absent and CSJ preflight
refuses execution. This is source preparation, not assembled workflow acceptance.

Two committed-source prerequisites block CSJ-2/CSJ-4 and the same-ID connection:

- **CSJ-NATIVE-HP:** the existing owner state CAS acquires the singleton guard but
  creates no enrolled-parent admission. Changed `state` is protected; the existing
  workflow intentionally expects owner generic CAS refusal403/42501. Next bounded
  contract: an owner-only manual currentHP/tempHP producer and sheet consumer,
  exact preimage/revision/mechanical-input binding, unrelated-field retention and
  coherent native projection/order. Keep generic state patches denied; no rolled
  spending, rest or global writer admission.
- **CSJ-NATIVE-CAMPAIGN:** existing assignment directly patches protected
  `campaign_id` without an admission. Next bounded contract: existing action/UI
  paired with an exact owner producer, prior-assignment check and destination
  membership/system/content validation; change only authorized assignment plus
  required revision/order bookkeeping. Keep direct generic PATCH, foreign/DM
  mutation and unrelated lifecycle operations denied.

Coordinator owns these shared-contract dispositions; Character Flow is the
proposed native/consumer implementation owner after an exact boundary is agreed.
These next packages are identified, not dispatched or implemented in this run.
Both require exact-source review and real scratch checks for valid owner success,
stale/conflicting inputs, foreign/service/old-writer denial, rollback, response
loss, unrelated parent/child retention and revision/order advancement. Do not
un-enroll, fabricate builder proofs, substitute prebuilt characters or use
privileged fixture repair. Existing builder seals cannot admit campaign changes;
origin creation also rejects preassigned campaign IDs.

The same central independent reviewer confirmed this native prerequisite from
committed source, not a new runtime reproduction. No CSJ runtime, new credentials
or fixtures were created; no native/schema/security changes or guard relaxation
occurred. The approved disposable setup remains authorized, so this is a
technical blocker rather than a repeat user-approval request. All fourteen
accepted creation journeys and prior source clearances remain intact. Stop this
cycle at the approved precise-blocked boundary; resume only the next agreed
native package, then complete/review the runner and return to unchanged CSJ-v1
criteria. [Exact checkpoint and source references](handoffs/2026-10-29-project-coordinator.md#csj-v1-final-blocked-checkpoint).

### CSJ-v1 resumed — native prerequisite implementation

2026-10-29T20:31:09.316Z: Victor explicitly resumes approved CSJ-v1 in Coordinate mode
under the updated installed coordinator blocker-resolution rules. Existing scope,
acceptance, owners, recipients/replies, four-role/two-character/one-campaign/
max-three-entry disposable approval and external restrictions remain in force.
The historical blocked checkpoint is preserved; missing implementation is now
classified as an assigned technical dependency, not a new scope or approval gap.

Coordinator adopts the following routine compatible contracts and dispatches
both assignments to Character Flow `01a1790d-be90-73d1-91f6-84e48a557ee1`:

| Assignment | Adopted finite boundary | Required preservation |
| --- | --- | --- |
| CSJ-NATIVE-HP | Owner-authenticated native producer for existing manual `current_hp`/`temp_hp` operations, paired with sheet/provider state writer. Exact confirmed preimage/revision and relevant trusted mechanical inputs; explicit finite field allowlist; acknowledged resulting state/revision. | No generic CAS admission, rolled spending/rest/death-save/concentration producer or duplicate calculation engine. Preserve unrelated state, narrative, parent/child content/order, current owner and existing builder/first-class protections. Stale/conflict refuses; uncertain response requires reload/exact readback with no blind replay. |
| CSJ-NATIVE-CAMPAIGN | Existing action/UI paired with exact native owner unassigned-to-destination producer. Expected prior assignment/revision, destination membership/system/content boundaries and precise acknowledgement. | Only assignment plus required coherent revision/order bookkeeping changes. Generic direct PATCH, foreign/DM/service/old-writer paths stay denied. No transfer/unassignment/delete/copy/archive or broader campaign-management scope. |

Character Flow owns the exact compatible producer names/staged native installer/
admission plumbing, relevant types, source consumers and focused tests using
existing conventions. Local source/native/scratch-profile implementation of these
two finite paths is assigned; hosted/security/production changes remain forbidden.
The coordinator retains shared-contract decisions, overview/queue/checkpoint and
acceptance. Lane reports/source remain lane-owned. Existing reviewed capacity
`ce7330f` and Journal `a3842f4` work and all14 accepted creation journeys
are retained; no baseline suite is repeated merely to resume.

Sequence: finish the two finite native/source boundaries and focused checks;
return a frozen source checkpoint for the same central independent reviewer;
complete/review the existing partial runner and same-ID normal-creation producer;
refresh live resource guards, run the approved real CSJ workflow, require both
successful Flow/Journal exits and final cleanup proof, then evaluate CSJ-1..6.
Actual valid owner success, stale/conflict, foreign/service/old-writer refusals,
rollback, lost response, field/child retention and coherent revision/order must
be verified in the actual scratch database. Preserve failing evidence and stop
on unexpected unauthenticated access. Missing code or effort alone does not end
this resumed cycle; escalate only a real material tradeoff or missing authority.

[Current assignment/result checkpoint](handoffs/2026-10-29-project-coordinator.md#csj-v1-native-resolution-resumed).

**Native source checkpoint — 2026-10-29T21:05:21.613Z:** Character Flow reports both
finite native/source paths implemented at `afe56e534cf13be2f3956a45a0ed0a6bd0026c6c`
(base `20ddd3b`), metadata `c9abaef`. All19 canonical manifest file hashes
and sizes match; focused source cases62/typecheck/lint pass. Exact new delta
SHA256 `e7d04c8a88bf8d7df27bba43a61df11c35c99a364b700687ea8ffeb57f8c4290`.
The same central reviewer is checking this frozen native/consumer delta. SQL
installation, actual owner/denied/rollback/response-loss/retention/revision cases
and CSJ browser acceptance are unrun; neither prerequisite is accepted yet.

Selected native entries are `character_manual_hp_command_v1(jsonb,jsonb)` and
`character_campaign_assignment_v1(jsonb,jsonb)` in the bounded staged overlay.
Existing verified same-cookie context and locks, trusted existing native maxHP,
exact bigint/preimage checks, original revision/order callbacks and default-off
server-only `INKBORNE_BASIC_SHEET_COMMANDS` activation are required. CSJ
bootstrap alone enables that flag privately after validated overlay installation.
Historical native stages/hashes and other profiles/hosted configuration remain
unchanged. Coherent settled writer refresh keeps child identity stable; Narrative
uses supported keepMounted/hidden behavior, preserving open draft/attempt UUID.
No Journal source change or global draft framework was needed.

Character Flow is dispatched to finish the existing normal-creation/basic-sheet
producer and thin actual native verification oracles using the same approved
actors/characters/campaign; no extra fixture set or acceptance framework. Pair
runner successful-exit checks with final cleanup records. Review the frozen
runner/native verification source before guarded actual scratch execution, then
resolve concrete failures and continue CSJ-1..6.

**Runner/native delta review and actual dispatch — 2026-10-29T21:56:35.153Z:**
Character Flow freezes complete source at `28b9333308840b66c1a383c47a22787138586b12` (base
`a7ff40d`), metadata `a6a88c0`. Six manifest files and selected diff
SHA256 `508321f1cd98c36c8ae066cdd03c4b6c1e4f16e3053256e636c7edc0c788f622`
match independently. Typecheck, lint, syntax and one-test discovery pass. The
same authorized read-only reviewer is CLEAR for these exact six files, with no
actionable P1/P2 findings. A focused parser probe found22P02 in the original HP
JSONB allowlist expression; explicit extraction grouping fixes that expression
and preserves the finite allowlist. Original native clearance is superseded for
the changed SQL/bootstrap/remote paths;16 other native paths and all10 frozen
Journal blobs remain identical. Expression/source checks do not prove native
installation or real access behavior.

CSJ-FLOW-2 / CSJ-NATIVE-VERIFY now advance to the already-approved actual
disposable Unraid run, assigned to Character Flow after this docs/index release.
Current read-only preflight reports about30.5GiB available physical memory,
23.3GiB Docker free and no competing Inkborne runtime; recheck before mutation.
Keep4roles/2normal-UI-created characters/1DMcampaign/max3Journal entries, exact
source/content/runtime binding, one heavy run and all existing access guards.
The same two IDs must pass native owner/refusal/rollback/concurrency/recovery,
basic sheet and unchanged Journal consumer checks at1280/390. Both test process
exits, final cleanup records/fresh native counts and supported host teardown
are mandatory. Coordinator accepts CSJ-1..6 only after inspecting that actual
evidence. All14 accepted creation journeys and exclusions remain retained.
No user decision or new permission is needed at this source-clear checkpoint.

**CSJ selector correction and retry — 2026-10-29T22:14:21.752Z:** actual run
`bcc589d0-9cf6-42e2-9e42-e9828f9ad79a` remains failed. Its first normal
Fighter reached the checked sheet; a selector counted visible desktop plus
hidden mobile inventory. Bootstrap1535 and ten native closure checks passed,
but full HP/second-character/Journal acceptance was not established. The sole
source change at `3d70442ad2687d5445c91263845de8aa0d32edf3` selects the visible row while retaining
exact count1/item/grant/native assertions. Same reviewer CLEAR exact one-file
diff SHA256`823de6ea93829209b7c3b00a560a0f585ed8838f02fed6804acd9830fd4578d7`.
Discovery/diff pass; unchanged source evidence reused. All eight linked evidence
hashes and14 retained output hashes match. Recorded cleanup removes runtime/
private inputs,13 planned images and six source/archive paths; original56
containers/95volumes/27networks/53images remain unchanged. Remote removal is
supported by captured host/cleanup comparisons, not a new independent live probe.
[Source/failure/cleanup manifest](handoffs/2026-10-29-csj-visible-inventory-fix.json).
Character Flow is dispatched to retry the existing approved workflow after this
docs/index release, with refreshed guards and unchanged fixture/access limits.
No new user decision, product/native/Journal change or local acceptance.

**CSJ equipped-inventory weapon connection — 2026-10-29T22:38:56.958Z:** failed run
`20f99479-7134-4307-90c1-517f2f9263ee` passed normal Fighter creation,
exact equipped starting-grant retention and Strength roll201, then found no
Longsword attack. Actions read weapon content refs while normal starting awards
populate inventory. This is an implementation gap within approved CSJ-2.
Character Flow implements the existing Actions consumer at
`301c5a652e10f8c10bbfaea395374c930de39a40` (base`74d505a`), three-file
diff SHA256`bbc1d79ce6716c0d4823d1e22d58434a4e04a67ea6c003005cfbf6ae76ecfb1d`.
Exact current-character/system/contentID/version, equipped and positive quantity
are required; existing item-data/attack calculations and mechanics snapshot
apply. Legacy refs, custom/renamed instances and other pins remain; only plain
same-pin duplicates are suppressed. No award/autoequip/calculator/SQL/access/
E2E/Journal change. Causal regression red-before/green-after;31 focused cases,
typecheck/lint/diff pass. Same reviewer CLEAR exact source and recorded cleanup;
six runner/native and10 Journal blobs unchanged. Eight linked/14 output hashes
match.13 introduced images/six source-archive paths/helper/transport/runtime/
private inputs removed; original56containers/95volumes/27networks/53imageIDs
and existing services retained. Second run remains failed, not full acceptance.
[Source/failure/cleanup manifest](handoffs/2026-10-29-csj-inventory-attacks-fix.json).
Flow is dispatched to the corrected actual story after this docs/index closure,
with refreshed guards and all existing budgets/oracles/external restrictions.
No user decision is needed. Accept only actual CSJ-1..6 plus final cleanup.

**CSJ popup transition retry — 2026-10-29T22:54:04.454Z:** run
`59205f2e-3deb-41a2-9004-69ab8181fb63` remains failed. The corrected
equipped-weapon popup appears, but the closing ability popup overlapped it after
actual201 and caused a strict Roll-button ambiguity. Minimal runner source
`6b395388d60648c3f3d36a25a7b35f5f03504cf4` waits for zero exact Roll
controls after each201; both actual rolls/two-row log/native retention remain.
Same reviewer CLEAR exact diff SHA256
`eeef3c162f3be2598f19dfd60594232240c94a61be4ac2a820a1cdf9f66976ef`;
discovery/diff pass, prior product/native/Journal evidence reused unchanged.
Eight linked/14 output hashes and recorded cleanup verified:13 introducedimages,
six source/archive paths, runtime/private/helper/transport removed; original
containers/volumes/networks/all53images and services preserved.
[Exact correction/failure/cleanup manifest](handoffs/2026-10-29-csj-roll-popup-fix.json).
Flow is dispatched after this docs/index closure to the corrected existing CSJ
workflow with fresh guards and all existing oracles/budgets. Full weapon-log,
HP/campaign/Journal acceptance remains pending. No new user decision/scope.

Hosting remains Vercel. This reconciliation changes documentation and names,
not product scope, feature priority, runtime permissions or release authority.
The [scope decisions](#finite-scope-and-decisions), requirement rows and final
completion gates remain mandatory. No roadmap milestone is accepted merely
because an earlier dated document called its code complete.

Documentation reconciliation evidence (2026-10-25): 18 Markdown files checked,
275 relative links resolve, original ROADMAP/GAME-PLAN text preserved verbatim,
and milestone/requirement ID assignments unchanged. Independent review found no
scope or continuation-order conflict. Receipt:
`../equipment-runtime/roadmap-reconciliation-20261025.json`, source baseline
`5f99574`. This docs-only checkpoint ran no app tests, services or deployments
and changes no implementation/native/browser acceptance result.

## Active continuation — 2026-10-29 UTC

### Character Flow: fourteen creation journeys accepted

Shared domain contract **v1** and the updated continuation are adopted through
documentation commit`4261f27` (integration`f300b7a`). The assigned lane remains
Character Flow / R06. Source`1f15a44` passes typecheck/lint, six focused files and
actual A6, retaining eight named workflows from`10e77c7` and five from`b4a13cb`.
Together they accept fourteen existing creation journeys, with their source and
catalog identities separately bound. Druidic, Rogue tool proficiency, sheet
readiness, source-specific casting math and confirmed class-state synchronization
now have actual consumer coverage. A5 retains both genuine concurrent saves at
revision42→44, down/up allowances, reload and foreign-account refusal.

A6 run`ca6fab2e-6ede-4539-8d37-e4c32bacc690` passes eleven native snapshots,
tier/HP down-up restoration, exact owned racial/class budgets, both genuine
Bard/Wizard saves at revision51→53, reload and foreign404. There are zero memory
restarts. Independent final source/evidence review is clear; the finite creation
queue is accepted and its verification stops. Earlier failed batches retain
their failed status; each reused story keeps its own source/catalog binding.
All task runtimes/private files,14 introduced images,45 server inputs,27 local
bundles and one helper are removed;311 evidence hashes remain unchanged.
Original56 containers/95 volumes/53 images are retained, Docker23.3 GiB free,
build cache0. Next is the existing **R08 Bardic Inspiration capacity** product
finding. Historical upgrades/installers, wider R06 writer/lifecycle closure and
gameplay/hosted/release acceptance remain separate and open.
[Exact scope, sources, checks and stopping point](handoffs/2026-10-24-builder-correction-and-casters.md#latest-continuation--2026-10-29-complete-creation-journeys).

### User decision: simplify development testing and use Unraid

**Current-state parent acceptance passes at`13dde07c`.** One disposable Unraid
run passes typecheck/lint, six focused files and three actual browser stories:
eleven Fighter edit/award/reload/access checkpoints,34 native guards/eight
contention cases/21 HTTP outcomes, Rogue1/0/2-write rollback and genuine Fiend
v2→v3 correction with exact JWT replay, retained spells/inventory/draw and an
unchanged current-v3 control. Final evidence review is clear. All task runtime,
ten introduced images,25 server inputs and15 local archives are removed;
56 original containers/95 volumes/53 images are retained, Docker23.2 GiB
free/cache0. Next is current-state ancestry acceptance. Historical parent1→2,
A4/F3 upgrade/installer and hosted/release gates stay separate and open.
[Exact evidence and compositional receipt](handoffs/2026-10-24-builder-correction-and-casters.md#remaining-current-state-parent-checks-accepted).

The earlier focused parent slice passes at`1de39d9`: actual Rogue preparation,
unchanged native background1/0/2-write/revision vector with Expertise retention/
pruning and complete rollback/profile equality, plus all21 actual HTTP access
cases during the Fighter story, followed by award/reload. Typecheck/lint, six focused files,
34 guard cases and eight contention cases pass. Source review is clear. All
task runtime, six introduced images and temporary inputs are removed;56 original
containers/95 volumes/53 images are retained, Docker23.2 GiB free/cache0.
This closes those fresh-state slices; full historical parent aggregation,
ancestry/A4 and F3 upgrade gates remain open. The then-next parent
positive edit/reload work is accepted above. Exact earlier run,
scope and cleanup receipts are in the
[current handoff](handoffs/2026-10-24-builder-correction-and-casters.md#focused-parent-background-and-access-slice-accepted).

The user explicitly selected both on October28. Recurring heavy verification
now targets the existing Unraid server, with an isolated SSD-backed disposable
database and browser runner. `npm run verify:unraid -- workflow` replaces the
Windows resource hold and historical recorder chain as the default development
check. Source is committed/frozen, scratch credentials are server-generated,
ports are private, resources capped, and all task containers/volumes cleaned.
**Focused actual verification passes at `6226bca`**. The fresh database accepts
83 migrations plus 34 stages and imports 1,535 current SRD definitions/snapshots,
with no staging leftovers and unchanged security/gate profiles. Typecheck,
zero-warning lint and five focused dropdown/protocol test files pass. The real
Fighter4 flow saves the six builder areas, explicit HP/ASI choices, original
equipment award, reload and foreign-account404. All 34 native guard cases,
eight real contention scenarios and owner/service/foreign HTTP probes pass.
Native sessions exit and full fixture/catalog retention checks pass.

The user-requested final cleanup removed every task container/network/volume,
private credentials/logs, 14 newly introduced images and 55 temporary source/
archive paths. Reports remain. All 56 original containers (45 running with the
same PIDs/start times/restart counts), 95 volumes and 53 original image IDs are
preserved. Docker has23.3 GiB free in the unchanged70 GiB disk, build cache zero;
minimum available RAM during the passing workflow was25.5 GiB. No existing
service restart, disk resize or hosted change occurred. Shared automatic prune
is still outside the runner's scope.
[Runner procedure and limits](../scripts/unraid/README.md).

Fresh current-state bootstrap installs reviewed SQL directly and imports the
real cached SRD through current transformers. It does not rerun accepted Fiend/
Draconic stories solely to install already-reviewed stages. The focused actual
Fighter workflow retains native ownership/transaction guards. Historical
full-parent, ancestry/A4, F3 upgrade and broader caster/martial acceptance remain
open and separately tracked. Vercel hosting and release gates are unchanged.
[Exact source, passing evidence, earlier failures and cleanup](handoffs/2026-10-24-builder-correction-and-casters.md#latest-continuation--2026-10-28-unraid-and-proportional-testing).

### Parent positive acceptance and F3 installer — source ready, actual run held

Source `b1a096a` supplies the missing full parent UI story, strict aggregate,
genuine Rogue preparation and explicitly scoped rollback-only private background
vector. Eighteen standalone checkpoints bind source/run/engine/database and
reader identities. The six-step saves/ASI, native award, retained Fiend control,
strict correction replay and21 HTTP probes retain exact receipts and rows.
Native SQL claims remain explicitly unauthenticated; the background vector must
observe1/0/2 physical writes and revision increments and prove full rollback.

The guarded F3 installer is integrated as `bd0b2a1`/`01fecf9`. It requires full
parent/A4 acceptance, exact stage/profile bytes, preserved schema/table-policy
and ACL baselines, two owner-only helpers and independent cleanup. The external
publisher now admits only the exact reviewed LF/CRLF F3 source variants.

All **84 focused evidence-validator checks**, typecheck and zero-warning lint
pass. Independent review clears the exact16-file manifest at `b1a096a` after
recording/source-binding and security-baseline fixes. These are source checks:
**full parent, A4 and F3 actual installation/app acceptance remain open**.
No runtime/SQL/browser/credentials or hosted changes were performed this turn.

The prior runtime is removed; a concrete fresh-cycle proposal includes five
containers, two networks/volumes each, two disposable Auth accounts, three
restricted credential files, exact public-evidence archive list and targeted
cleanup. The user approved this exact cycle on October28 ("Yeah"); no repeated
credential/runtime approval is needed within that scope. Execution is held for
resources: at15:09UTC only2.09GiB physical/8.74GiB commit headroom were free.
No archive/runtime/credential mutation has begun. Keep the8/14GiB guard and dependency
order; do not repeat accepted historical slices as missing implementation.
[Exact sources, checks, limitations and proposal](handoffs/2026-10-24-builder-correction-and-casters.md#latest-continuation--2026-10-28-parent-acceptance-source).

### Character creation dropdowns — local UI complete

The user's creation UX requirement is now implemented through `7311ca2`:
**finite choices use dropdowns with only currently valid options** across
languages/skills, ancestry, class features, ASI/feats, HP, spells, personality
presets and equipment. Menus honor current prerequisites, earned source/level,
occupied picks, score caps and spell budgets; retired discovery options are
excluded. Saved unavailable picks remain visible and require explicit recovery.
Rich previews, save recovery and custom text/manual number fields remain.

All **392 focused checks**, typecheck and zero-warning lint pass. **27
desktop/mobile browser scenarios** pass using actual components with simulated
persistence/routing; no new database/Auth or hosted acceptance is claimed.
Independent exact-source review is clear. Fourteen actual-app stories are
adapted with all 129 native checkpoint/readback/publication calls retained,
but were not rerun. Owned UI processes/ports are closed; two isolated dependency
junctions remain after an automatic cleanup rejection. Exact evidence and
limitations: [latest handoff](handoffs/2026-10-24-builder-correction-and-casters.md#latest-continuation--2026-10-26-dropdown-refinement).

The next dependency remains full parent actual acceptance, then ancestry/A4 and
the existing walkthrough queue. Its positive aggregation and F3 installer source
are now ready as recorded above. Vercel unchanged; global gates closed,
M7/creature imports paused.

### Fiend and Draconic accepted locally; full parent acceptance next

Actual local app stories at `7c31afb` now accept Fiend's historical correction,
stale-review refusal and lost-response recovery, plus Draconic immutable old/new
HP, retained real die, multiclass bonus and equipped-armor AC. Each passed eleven
native checkpoints; all 76/99 respective observed test identities exited. Final
receipts are `subclass-content-update-actual-readback.json` and
`draconic-resilience-actual-readback.json` under
`../equipment-runtime/app-flow-runtime`. The earlier failed attempts stay failed.

The parent safeguard installs with the intended existing authenticated campaign
schema grant preserved (`8610d6a`). A genuine unawarded Fighter4 is app-created
and strictly recorded (`1f77901`/`c6d98fb`), with all 40 test identities exited.
Native source `c705d5f` passes 34 exact outcomes and eight actual three-session
guard-before-parent scenarios, with unchanged fixture/catalog/profile and
verified backend/client closure. Authenticated DELETE is explicitly a measured
zero-row RLS filter; reachable service DELETE still refuses. These native reports
retain `authenticationAccepted:false` and do not establish full parent acceptance.

The 43 focused PGlite/simulated tests, typecheck and zero-warning lint pass;
independent exact-source review is clear. Two Draconic oracle errors and the
parent schema/delete assumptions were corrected with native unchanged-fixture
probes and meaningful regressions, without weakening product gates or altering
live policies. Sources, exact IDs, receipts, review and failed evidence:
[latest handoff](handoffs/2026-10-24-builder-correction-and-casters.md#latest-continuation--2026-10-26-2103-utc).

All owned runtime resources/credentials are removed and task ports closed at
21:01:23 UTC; shared Docker/cache and inherited worktrees remain. Twenty-eight
public checkpoint files are hash-archived. The final closure is 6 app-created
characters, 1,535 definitions/1,537 snapshots, zero capabilities/seals and all
readiness/class/hit-die gates closed. No hosted acceptance or deployment occurred.

The next actual dependency is full parent acceptance; its positive story,
background vector and strict aggregator source are now ready through `b1a096a`,
alongside the F3 installer. Ancestry installation/A4 must wait for full parent
acceptance, then the existing caster/martial/A5/A6 queue.
Preserve Fiend/Draconic acceptance; a new disposable runtime may require a fresh
same-database prerequisite chain. R06 stays in progress, Vercel unchanged and
M7/creature imports paused. Older sections below retain their then-current status.

### A4 acceptance recorder — source prerequisite complete, actual run pending

Source `bcfa8a6` adds the previously missing strict A4 aggregation tool and
binds its browser story to the exact source and unique bounded-wrapper run.
It requires all eleven ordered native snapshots, old Hill Dwarf HP35/new HP38,
one retained original d12, unchanged source/inventory identities and reloads,
all native/family checks, a fresh owned native readback and installed-profile
comparison. Its accepted catalog contract supplies the subsequent A6 publisher.
Current-HP coverage remains **absence preserved only**, without a present-value
clamp claim. No actual-app or native acceptance follows from this source work.

The 12 focused evidence-validation tests, typecheck and zero-warning lint pass;
all six/eight respective observed process identities exited. Independent review
of base `a90bc97` to the recorded five-file/wrapper hashes found three initial
blockers (wrapper binding, native profile/A6 contract, timeout cleanup), all fixed
and re-reviewed with no remaining concrete blocker. Exact evidence and commands:
[current handoff](handoffs/2026-10-24-builder-correction-and-casters.md#latest-continuation--2026-10-26-1650-utc),
`../equipment-runtime/a4-acceptance-source-20261026.json`.

At 16:49:05 UTC, live headroom was 7.46 GiB physical-free/12.56 GiB commit-free,
below the unchanged 8/14 GiB fresh-app guard. Task ports were closed, no actual
runtime was started, and existing runtime-state bytes were preserved. Keep the
same finite Fiend → Draconic → parent → ancestry/A4 → caster/martial/A5/A6 order.
Genuine Fighter4 preparation/full parent aggregation and the F3 native installer
remain missing source prerequisites. R06 stays in progress; Vercel unchanged,
global gates closed and M7/creature imports paused.

### Current builder correction and complete caster work — in progress

The user explicitly selected continuation through the current **R06 builder
workstream** (formerly called `M1/R06`). Fiend's explicit per-character
v1→v2 review/update and exact stale-review resolution are integrated through
`63899a6`; the ordinary lost-response checkpoint below remains accepted. The
correction's focused UI/action/protocol sweep passes **137 tests**, native
companion tests pass **23**, and integrated typecheck/zero-warning lint pass.
The actual local app has proved immutable v1 preservation, an atomic v2
publication without character changes, both recovery paths and exactly one
native update. Its self-contained complete receipt remains pending after
preserved fixture failures and a host-memory interruption; this is not full
actual-flow acceptance yet. The prior paused profile was archived and removed;
a later 3 GiB continuation also remains failed after four native checkpoints:
the stale review disappeared during first dev compilation of the other-tab
editor, before any correction. `961b50b` warms that editor before review. The
old continuation guard is inadmissible; the exact owned runtime was removed
after public failure archival.
The earlier 2 GiB dev restart failure stays failed.
The next fresh attempt `local-subclass-update-app-20261025T062148Z` stopped at
the OS commit guard after four native checkpoints, with zero correction
receipts/history. Its failed evidence is preserved. Local Chrome's V8 old
generation is bounded by `7de8248` and an actual heap/cleanup probe passes;
the unchanged full acceptance story remains pending. F1 ancestry HP source is
integrated as `dbafbc4` with 157 focused passes plus the affected 62-test durable
rerun; typecheck/zero-warning lint pass. Native companion and actual acceptance
remain open. The later capped-Chrome attempt
`local-subclass-update-app-20261025T063955Z` stopped at 93.781% system commit
after five fresh native checkpoints and one exact stale-rejection wire.
It remains failed, with zero correction receipts/history. All five containers,
two networks, two volumes, three private credential files and the proxy are
absent; task ports closed at 06:45:34 UTC. Shared engine/cache remain. A fresh
actual run waits for at least 14 GiB commit-free and 8 GiB physical-free.
F1's native companion through `a8c40ec` passes 41 PGlite checks; its A4
browser/readback source is registered in `79843fc`, without actual execution.
F2 owned ancestry defense projection (`3524785`) passes 115 core checks and
70 final ASI/HP checks after source-complete fixture repairs. The remaining
ten affected consumer files passed in the earlier 194-test sweep. F3 earned
Tiefling source through `40a6f84` passes 221 focused tests, and its staged native
companion through `5baf432` passes 48 PGlite checks. A5 mixed-caster source is
registered through `5bfc44d`; A6 is registered in `1066b52`. The final absent-
subrace boundary (`cbaee5a`) passes its 60-test reader suite. Neither new native
companion has been installed in the actual runtime. Six external guarded
publication/parent-session tools are source-reviewed; all five JavaScript parser
checks pass, with no runtime/SQL/publication execution. Genuine parent app
preparation/full aggregation, A4 aggregation and the F3 native installer remain
pending. Final typecheck/zero-warning lint pass at `1066b52` in
`local-creation-browser-check-20261025T072834Z`. Latest host headroom is 9.60 GiB
physical-free/12.45 GiB commit-free, below the fourteen-GiB commit threshold;
task ports remain closed.
Eight complete caster walkthroughs are prepared.
The reviewed Draconic HP/AC repair is integrated through `72ce5cf`, with fixture
fixes in `a4700ce`; 266 focused checks, typecheck and zero-warning lint pass.
Actual new-root publication, HP/AC and raw-roll retention remain unaccepted.
The parent safeguard is staged in `d614952` with 32 focused checks; its prepared
contention runner has seven simulated checks. Native installation and contention
remain unaccepted. The [six-story remaining matrix](specs/2026-10-24-builder-remaining-matrix.md)
records three ready martial cases and three ancestry source blockers.
[Current sources, evidence and remaining work](handoffs/2026-10-24-builder-correction-and-casters.md).

### Actual application character builder save/reload

**Latest bounded checkpoint: `0f1a4e6`.** All six ordinary builder steps retain
their complete original operation before sending. Lost responses survive reload;
check/retry uses only the original request and exact receipt, then reloads current
server values. Account transitions invalidate stale callbacks and clear scoped
records; unknown saves close editor portals and block replacement operations.
Three actual local Next/Auth/PostgREST/PostgreSQL stories and 14 native snapshots
pass, including absent-request retry and exactly one retained server HP draw.
The integrated 142 focused checks, worker 190 checks, typecheck and zero-warning
lint pass. The full suite and production build were not repeated.
[Evidence, preserved failures and cleanup](handoffs/2026-10-23-builder-save-recovery.md).

R06/M1 remains **IN PROGRESS**: reviewed historical correction/repin, complete
caster drafts, broader combinations/concurrency, enrolled writer/lifecycle fences
and hosted/provider/backup-restore acceptance. Global gates stay closed. No hosted
change, push or deployment. Vercel unchanged; M1–M6/M5.5 precede M8;
M7/creature imports paused.
That ordinary-save checkpoint and the latest failed correction attempt removed
their task resources. Use the external cleanup identity receipts; shared
engine/cache and worktrees remain.

### Prior Fiend and class-removal checkpoint

**Latest bounded checkpoint: `7c16608`.** Fiend's ten expanded spells use
ordinary Warlock selection budgets and earned tiers, save/reload and prune on
level/patron loss. Added-class removal/re-addition preserves the fixed starting
Fighter, its ASI/HP/pin identities, rejects a stale tab and creates a fresh Cleric
occurrence. Two actual local Next/Auth/PostgREST/PostgreSQL stories and eight
native readbacks pass. The starting class stays fixed by the user's decision.
The 68 focused Fiend and 34 removal/UI checks, typecheck and zero-warning lint
pass; no broad suite/build repetition was run.
[Evidence and remaining gates](handoffs/2026-10-23-fiend-and-class-removal.md).

R06/M1 remains **IN PROGRESS**: ordinary save-response/reload recovery, reviewed
historical correction/repin, complete caster drafts, broader combinations/
concurrency, enrolled writer/lifecycle fences and hosted/provider acceptance.
Global gates stay closed. Owned services/containers/networks/volumes/credentials
are removed and task ports closed; shared engine/cache and worktrees remain.
No hosted change, push or deployment. Vercel unchanged; M1–M6/M5.5 precede M8;
M7/creature imports paused.

### Prior bonus-acquisition checkpoint

**Latest accepted bonus-acquisition checkpoint: `1323c18`.** All 14 source-owned
bonus-spell groups and Lore's three new skills save/reload in the actual local
Next/Auth/PostgREST/PostgreSQL app. Four focused stories cover Bard/Lore,
conditional Land spells, Tome/rituals/Arcanum and Wizard book-based
Mastery/Signature. Eight native snapshots verify exact earned owners,
projections, pruning, receipts/revisions and all five row-order bijections.
85 relevant tests pass; the final affected three-file rerun passes 21 overlapping
tests. Typecheck and zero-warning lint pass. Full-suite/build repetition was
omitted. [Evidence and limitations](handoffs/2026-10-23-bonus-spells-and-lore.md).

R06/M1 remains **IN PROGRESS**: next is correcting Fiend expanded-list spells
currently treated as free prepared grants, followed by class removal, broader
combinations/recovery/concurrency, historical correction/repin and hosted/provider
acceptance. New bonus acquisitions do not accept automated Arcanum/Mastery/
Signature free casts or recovery. The fresh disposable catalog has 1,535 exact
definitions/snapshots. All global gates remain closed. Task services, containers,
networks, volumes and credentials were removed; task ports are closed. Shared
engine/cache and worktrees remain. No hosted change, push or deployment. Vercel
unchanged; M1–M6/M5.5 precede M8; M7/creature imports paused.

### Prior multiclass and class-family checkpoint

**Prior accepted checkpoint: `f5d7439`.** Six actual local Next/Auth/
PostgREST/PostgreSQL stories pass: Fighter → Cleric acquisition and independent
progression, Bard Expertise, Ranger terrain/Favored Enemy/Hunter, Sorcerer
ancestry/Metamagic, Druid Land and Warlock pacts/invocations. Reloads, pruning,
retained secondary first-level HP roll, stale acquisition refusal, original-only
saving throws, equipment retention and foreign-account denial pass. Native
readbacks agree with exact immutable source/grant provenance, receipts, roles,
revisions and all five physical row-ID order bijections. 102 focused tests,
typecheck and zero-warning lint pass. Full-suite repetition was omitted.
[Exact evidence, preserved failures and outstanding requirements](handoffs/2026-10-23-multiclass-and-class-choices.md).

R06/M1 stays **IN PROGRESS**: special bonus-spell choices and budgets, Lore
bonus skills, class removal, broader combinations/recovery/concurrency/provider
matrices and hosted acceptance remain. The catalog has 1,535 current definitions
and 1,536 snapshots after the isolated Land publication; prior snapshots and
characters were preserved. Global readiness/class/hit-die gates remain closed.
Task app/backend resources and credentials are removed and ports closed. Shared
engine/cache and worktrees remain. Automatic approval review left one temporary
worker dependency junction in place. No hosted change, push or deployment.
Vercel unchanged; M1–M6/M5.5 precede M8; M7/creature imports paused.

### Prior single-class checkpoint

**Real SRD Fighter and Cleric workflows save and reload in the actual local app
at `4279067`.** Both stories cover sign-in, creation, class/race/ability/background
choices, actual gear, one 15 gp award, details, sheet reload and a second account's
404. Earlier Fighter verification reaches Champion 4 with HP, ASI/feat replacement and a retained server
HP roll. Cleric retains class/racial/domain spells with correct casting ability,
completion guards, allowance counters and saving-throw proficiency.

The local runtime contains 1,535 real definitions and matching immutable snapshots;
native database readback agrees with the browser. Focused tests, typecheck and
zero-warning lint pass. No repeated full suite/build was added.
Rogue Expertise also saves/reloads at levels 1/6, excludes untrained/duplicate
picks and prunes a pick when its underlying proficiency is lost. Shared fixed,
selected and Expertise grants now use the correct compound skill keys. Final
Fighter/Cleric reruns pass after those changes; native readbacks agree for all
three workflows. [Latest evidence, preserved failures and remaining acceptance](handoffs/2026-10-23-rogue-expertise.md),
[earlier catalog/progression evidence](handoffs/2026-10-23-real-srd-builder.md).

R06/M1 remains **IN PROGRESS**: genuine multiclass acquisition, remaining catalog
choice families, wider recovery/concurrency/provider matrices and hosted acceptance
remain open. Global readiness/class/hit-die gates remain closed. Wider
[writer fences](specs/2026-10-22-enrolled-character-writer-fences.md) remain required
before production activation. Task services/credentials were removed and ports
closed; shared Docker engine/cache and inherited worktrees remain. No push,
deployment or hosted change occurred. Vercel unchanged; M1–M6/M5.5 precede M8;
M7/creature imports paused.

Earlier preparation evidence follows.

### Three native-verification preparation checkpoints — local only

`96e1197` completes the five-file metadata/fixture pack, eight-case three-session
runner/persistent psql transport, and strict new-scope frozen launch package.
Independent source/fixture/controller review passed; 68 focused tests passed:
12 reduced-schema SQL, 40 SIMULATED runner/transport, 16 SIMULATED freeze/admission.
There is no successful native profile or successful full wrapper orchestration
test. The eight cases are a finite first subset; wider row-race/provider/config
requirements remain explicit. Original Auth seams/gates still deny and saving is
disabled. Previous baseline-only G2 permission is not expanded. [Delivery, failure history and remaining acceptance](handoffs/2026-10-22-character-command-three-checkpoints.md).
Full check at `96e1197` passed typecheck, zero-warning lint, **370 files / 5,187
passes / three UNVERIFIED M5 skips**; all 528 observed identities exited. Final
readback finds all nine attempts' identities absent and no workspace service.
Documentation-only successor records that evidence before the final external freeze.
Vercel unchanged; M1–M6/M5.5 precede M8, M7/creature imports paused.

### Database session/ownership rows — source complete, native admission open

Source `3d25ac3` adds only two closed postgres-owned invoker functions. The exact
user→session→profile→writer guard→owned character lock sequence checks native
expiry after waits and selected status/ownership before returning void. No API
grant, new role/table/policy, original Auth helper, readiness or save path changed.
`95e9c90`: **62/62 focused tests passed**, independent source/fixture review passed.
Full check passed typecheck, zero-warning lint, **366 files /5119 tests /three
UNVERIFIED M5 skips**; all425 observed identities exited. The reduced fixture proves none of the live
provider/configuration/lock-race or native privilege/RLS requirements.

The hosted connector's read-only metadata call failed28P01, returning no schema
or user/session data. Pinned Auth2.196.0 source supports the selected columns;
native target metadata/provider acceptance remains open. Same-token verification
is a precondition, and row success does not validate configured session lifetime
or enable saving. [Checkpoint](handoffs/2026-10-22-character-command-row-locks.md),
[finite proposed native profile](specs/2026-10-22-character-command-native-row-check-plan.md).
Vercel unchanged; M1–M6/M5.5 precede M8, M7/creature imports paused.

### Same-token server boundary — source complete, native save admission open

Source `0dc7a4b` implements the accepted no-argument server token-context boundary:
one untrusted cookie token, explicit SDK claims/user verification of those same
bytes, strict selected identity/config/profile checks and expiry after waits.
Only the frozen four-field context or generic unavailable result escapes.
Test checkpoint `f534bfb`: **75/75 passed**, including seven installed-SDK cases
with ephemeral keys and strict in-process Auth transport. Independent source
review passed. Full project check at `f534bfb` passed typecheck, zero-warning lint,
**365 files / 5057 tests / three UNVERIFIED M5 skips**; all432 observed identities
exited. The skips remain open requirements.

This is an unused internal helper, with no route/service client/RPC or SQL changes.
Native Auth/session/configuration/current-owner and acceptance locks remain open;
both original Auth seams still refuse. G2 baseline history did not close those
requirements. The finite nonanonymous/issuer/audience/time restrictions and
modeled-provider limits are explicit in the [checkpoint](handoffs/2026-10-22-character-command-token-context.md).
Continue genuine bootstrap and verified B1/B2/B3 only after their required native
closure. Vercel unchanged; M1–M6/M5.5 precede M8; M7/creature imports paused.

### Creation-history correspondence and immutable calculation evidence — staged only

Source `8e113c5` adds a closed native history reader and calculation table. The
reader checks exact original receipt/journal/preinsert/two-consumed-proof sets
against the complete actual empty before rows. Before-insert derivation accepts
only strict intent and constructs every protected field natively; same-transaction
exact-intent lookup retains original evidence, while a new transaction derives
anew. An existing class command refuses before NEW history/source checks and
requires the future authenticated recovery path.

Test checkpoint `5b0da64`: **62 focused tests passed**, 33 new; independent review
passed. Tests cover direct-insert protection, immutable kind/UPDATE/DELETE/TRUNCATE,
history mismatches, cross-commit fresh derivation, denied API-role calls and original
Auth/admission/readiness denials. A fixture owner-role member with SUPERUSER and
BYPASSRLS false exercised the unchanged owner policy with RLS active. This is
synthetic offline policy/storage evidence, not native installation or Auth proof.
No production role or policy was changed. [Receipts and remaining work](handoffs/2026-10-22-class-calculation-storage.md).

Records are fixed `unverified_preacceptance_calculation`, with no adoption path
into verified planning. A future producer must rederive a new typed plan under
real Auth/locks/content/fences. Native installation additionally needs retention/
lifecycle acceptance: this staged evidence intentionally has no live-parent,
historical-journal or future-acceptance FK. Vercel stays the host; M1–M6/M5.5
precede M8; M7/creature importing stay paused.
Full project check at `0ac97c3` passed typecheck/lint,
**363 files / 4982 tests / three UNVERIFIED M5 skips**; all 435 observed identities
exited. Preserve the first full run's existing prepared-spell probe failure;
independently reviewed waitFor synchronization passed isolated19 then the full gate.

### Native allocation and saving-throw input integration — source complete, admission open

Source `743a4b3` allocates the full finite first-class native row envelope before
journal acceptance, deriving the parent/choices/header/order/receipt proposal from
actual empty structural rows and the exact dependency resolver. `0a91a3d` projects
complete native graph evidence into the existing advisory class-role save reader.
Raw effects/data stay unchanged; missing manifests and unconfirmed draft saves
stay unavailable. No starting-save compiler or authenticated producer is invented.

Independent source/fixture review passed. All 29 focused tests passed: native UUID/
time/default links, exact unchanged final-reader full graph, original SQL and
TypeScript receipt/transition shape compatibility, rejection of bad source/order/
grant evidence and retention of provisional/legacy save behavior. Manual fixture
insertion/revision/order updates are compatibility evidence only; actual Auth,
RLS, full triggers/FKs, materializers, protected plan storage and B3 save are open.
[Exact checkpoint and verification limits](handoffs/2026-10-22-class-allocation-save-integration.md).
Vercel remains the host; M1–M6/M5.5 precede M8 and M7/creature imports remain paused.
Full project gate at executable checkpoint `0a91a3d` passed typecheck/lint,
**363 files / 4949 tests / three UNVERIFIED M5 skips**; all 380 observed process
identities exited. No actual save, materialization, native stage or rollout follows.

### First-class dependency calculation — staged implementation, acceptance open

Source `cae1499` adds only an internal invoker/stable descriptor, with no runtime
caller or grants to application actors. It resolves complete dormant feature/spell
grants and exact raw snapshots, and describes hypothetical level-one projections.
Independent source/fixture review passed; 30 focused PostgreSQL-WASM tests compare
the admitted calculation with original SQL materializers/projection INSERTs and
exercise malformed, access, tie and bound refusals. A discovered whole-row alias
bug was fixed; the first two failing tests are preserved. This is no native graph
allocation, locked provenance, acceptance/receipt producer or choices writer.
[Detailed checkpoint and limits](handoffs/2026-10-21-class-dependency-descriptor.md).
Full project check at executable checkpoint `4b35ec7`: typecheck/zero-warning lint,
**362 files / 4920 passed / three UNVERIFIED M5 skips**. All424 observed identities
exited. No new build or E2E claim; the new calculation has no application caller.

Independent review of the existing G2 evidence passed the 13 function bodies/
metadata, 52 privilege rows and 11 trigger declarations. Five trigger function
bindings were captured; six other bodies/bindings, native column-name mappings,
WHEN/constraint relationships and actual stage execution remain future preflight.
No native profile was rerun. M1–M6/M5.5 continue; M7/creature imports stay paused,
Vercel remains the host, and M8 follows core acceptance.

### G2 baseline/catalog COMPLETE — native source 29b6cc8

After the preserved bootstrap failures/correction, actual PostgreSQL17.11 and both
official migration jobs passed. All **83 frozen application migrations**, R07
preflight/assertions/catalog audit passed: **85 steps, one audit, complete true**.
60 audited tables/counts; only Auth77/Storage70 official history counts nonempty.
13 fixed materializer function bodies/security declarations match source; native
owner is postgres in this disposable cluster. Effective privileges/default ACLs
and 11 enabled trigger rows captured. Root comparison is not independent review.

All three containers, internal network and two volumes removed; independent
same-daemon readback found zero containers and only preserved default networks/
unrelated volume. All 543 recorded clients plus controller absent. Shared G1
engine/cache remain running as approved. Full check passed **4,890 / 361 files**,
typecheck/lint; three M5 stress requirements remain UNVERIFIED, not waived.

[Exact source, receipts, limitations](handoffs/2026-10-21-g2-baseline-complete.md).
[Next B design slice](specs/2026-10-21-first-class-materializer-next-slice.md)
now uses observed owner/capability facts. Actual acquisition, staged gameplay,
equipment fixtures/races, native disabled-profile/source installation and browser/
provider/hosted acceptance remain open. No broader SQL profile or deployment is
authorized by this baseline-only run. Vercel stays the host; M7/creature importing
stay paused and M1–M6/M5.5 precede M8. Earlier pending G2 status below is historical.

### Approved G2 baseline attempt — FAILED, correction prepared

Victor approved the original prepared baseline/catalog scope in this chat.
One preflight timeout and two fresh DB initialization failures are preserved;
the diagnostic attempt showed missing `supabase_functions_admin`, required by
the official roles file. The reduced recipe omitted official `98-webhooks.sql`.
No Auth/Storage job or application migration ran. Temporary DB initialization SQL
did run before failure. All owned containers/network/volumes were removed; all
95 recorded clients and three controllers were independently absent.

Local candidate now adds the full pinned official prerequisite and exact fifth
read-only mount; 63 focused transport tests passed. Native baseline, class-owner
metadata and gameplay acceptance remain UNVERIFIED. Final `npm.cmd run check`
passed typecheck, zero-warning lint, 361 files / 4,890 tests with three UNVERIFIED
M5 skips; all 398 observed identities exited. Preserve the first full check's
ten legacy-fixture failures; focused core recovery passed 60/60 with 43 exited.
The [initialization correction](specs/2026-10-21-g2-bootstrap-amendment.md) adds the
complete official prerequisite inside the same approved disposable baseline.
Use a new freeze, preserve old failures and infer no hosted/stage authority.
[Failure receipts and limits](handoffs/2026-10-21-g2-bootstrap-failure.md).
Vercel remains the host; M1–M6/M5.5 precede M8, M7/creature importing stay paused.
Earlier statements that G2 was entirely unapproved are historical.

### Latest human approval and runtime checkpoint

Victor: "Okay, go ahead with G1. Keep hosting on Vercel and continue working on
M1–M6, with M7 paused." **G1 completed** on October 21: installed Linux engine
started once and three pinned linux/amd64 images verified; 637,510,394 combined
Docker-reported image bytes, disk floor respected, all pull clients absent.
No test containers/network/volumes, credentials, SQL or hosted changes. Shared
daemon/cache remain running as approved. [Receipt and limitations](handoffs/2026-10-21-g1-complete.md).

M1–M6 including M5.5 precede M8; M7 and proposed creature imports stay paused.
Next native prerequisite is original class materializer ownership/privilege/trigger
metadata. A [narrow G2 baseline/catalog package](specs/2026-10-21-g2-baseline-catalog-plan.md)
is prepared, **unapproved/unexecuted**. Staged SQL, fixtures, G3 hosted work,
backup/restore, deployment and publication remain separate. Local executable
acceptance stays at 236ebcf; G1 is provisioning evidence only.

Earlier dated status below is preserved history; G1 approval/completion above
supersedes older statements that G1 was pending or Docker unavailable.

### Latest human priority — 2026-10-13 (America/Phoenix)

Victor explicitly said: "Let's pause on M7 but continue on the rest. I think we
need to focus on M1-M6 before we can do M8." Prioritize **M1–M6 including M5.5,
then M8**. **M7/R22 PDF importing is paused**, retained in the project backlog.
Its earlier before-beta instruction is superseded for active execution; do not
implement extraction/layout/import or pursue the pending input matrix until
resumed. No automatic post-beta schedule or implementation completion is inferred.
Character print/PDF export remains distinct and preserved.

Victor also said to skip the proposed monster/NPC imports for now. Pause those
R16/R17 import children, retain them in the backlog and keep the completed local
JSON reader/profile prototype unused. No app upload/staging/commit path or further
format implementation. Existing supported spell/feat MPMB behavior and import
provenance safeguards remain preserved.

Continue ordinary-item campaign sharing, magic-item acknowledgement recovery and
private class-provenance source/review/testing within M3/M4. Earlier accepted local
candidate was `81629ce` (339 files / 4,266 tests plus build and eight local JSON
browser cases); later source children are not yet combined acceptance. No SQL,
hosted write, deployment or publication is authorized by this sequencing change.

### Current core checkpoint — 2026-10-13

Latest combined tested source **`236ebcfec319bef476a0de6ddcabdb998c9c3121`**
passed focused **60 tests / three files**, then `npm.cmd run check`: typecheck,
zero-warning lint, **361 files / 4,887 passed / three UNVERIFIED M5 skips**.
Production build passed at the same clean source. All 10 focused / 371 check /
22 build recorded identities exited. Five integrated source blobs match both
reviewed workers; app, components, lib, migrations and package files were unchanged.

Disabled first-class revision-observation stage `fa57f71` is integrated after M1
and original R09 source approval. It preserves independent input/proof refusals,
separate observed versus finalized receipt checks, original owners/security modes
and two narrow cross-owner EXECUTE pairs. It implements no writer or positive
proof issuer. Native SQL, Auth and actual acquisition remain unverified.

Reviewed guard correction `e63bc3d` is integrated and its actual third guard-only
attempt **FAILED**: the native observer classified `ancestry-missing`; child exit
and fresh recorded-identity absence were observed, but local handle release did
not produce `close` within 40 seconds. The supervisor required separate exact
held-object cleanup. Independent readback at 22:54:28 UTC found all 42 recorded
identities absent and zero listeners. Descriptor SHA256
`11b10c57de41e51f53c109c03d9fb000f9b4aa30ea6e3c877683d66f54ba1eca`
remains pending; no phase allocation, cancellation adapter or browser acceptance
follows. Preserve all three failed runs; no fourth run is released.

Next class materializer work is blocked on original owner/privilege/trigger
capture under G2. A bounded catalog-only query is prepared; it reads no user rows
or application function bodies and invokes no application functions. Docker API
was unavailable in the read-only 22:30 UTC check. G1/G2 remain unapproved.
Saving-bonus measurement remains worker-only on FIRST-bootstrap clock HOLD.
See [latest checkpoint](handoffs/2026-10-13-core-checkpoint-236ebcf.md) and
[native metadata prerequisite](handoffs/2026-10-13-class-materializer-native-metadata.md).

### Preserved earlier checkpoint — 710c3fc

Latest combined tested source **`710c3fcf6e85cbaeb46b72f38b7d835e4eab59ec`**
passed `npm.cmd run check`: typecheck, zero-warning lint, **360 files / 4,862
passed / three UNVERIFIED M5 skips**. The production build passed at the same
clean source using synthetic build credentials. All 386 check and 22 build
recorded identities exited; owned readbacks were empty.

The genuine fresh-character bootstrap is integrated from reviewed source `4694b2d`
and tested handoff `ac67f98`. Its focused 35 tests, typecheck and lint passed;
21 receipt hashes and 17 original process identities were independently checked.
This is staged, unavailable SQL: no native execution, actual character creation,
class acquisition, writer cutover or Auth acceptance is implied.

M5 has a real pending descriptor for this source, SHA256
`89e78f557f32c3213712fc549957a0fec48a4020fb6d133de75975e8581f1972`.
Two guard-only attempts **failed**. The first stopped before fork on a relative
launcher command; its 18 recorded identities exited. A reviewed absolute-path
driver correction reached the child, then a native observer error stopped the
child in built-in source binding. Its supervisor stalled awaiting close. A separate
reviewed one-off cleanup terminated only that exact held supervisor after proving
no descendants or listeners; all 55 recorded identities were independently absent
at 22:25:47 UTC. The parser's first zero-action refusal is preserved. This cleanup
does not accept the guard, its cancellation adapter, phase allocations, or the
44 browser cases. No browser, server, bundle execution or SQL ran in these attempts.

The saving-throw measurement correction `ade9854` / handoff `e9ac35f` remains in
its worker. Finite source fixes passed review and byte checks; FIRST-bootstrap
residual-clock assurance remains **HOLD**, so no measurement release or integration
is inferred. The ordinary 30-case / 43-screenshot / eight-PDF gate remains UNRUN.
The first-class prerequisite plan `bc9ec36` passed M1 and original R09 owner
review. Its disabled revision-observation source child is underway. Native materializers and the actual issuer
remain separate requirements. See [checkpoint evidence](handoffs/2026-10-13-core-checkpoint-710c3fc.md).

### Preserved earlier checkpoint — 534b5d8

Latest combined tested source `534b5d87d99fd3d3b5dea3ea7ebddb1bdc759173` passed
`npm.cmd run check` with two workers: **359 files / 4,839 passed / three skipped**,
typecheck and zero-warning lint. The three skips remain UNVERIFIED M5 stress
requirements. Fresh synthetic build passed at the same clean source. All 378 check
and 22 build recorded identities exited; owned process/listener readbacks were empty.

M6's seven final source/handoff blobs match reviewed worker `9a9d2f0`; all 28
aggregate receipt hashes and all 36 original-plus-retry process identities were
independently checked. Worker focused **157 tests / three files**, typecheck and
lint passed at `baaa8b7`. Aggregate SHA256 is
`EE5DBECA774A22A1EB936C7FCDA1E05A0E837FDF486BF885A23C3DECFA2000F0`.
First collection failure and its manifest remain immutable. Existing app, engine,
character, DAL, importer, migration and package paths were unchanged by this M6
integration. Private staged SQL remains unapplied, Auth denied and all 13 readiness
families false; no selection issuer, casting, copy or native acceptance follows.

M5 guard-only preparation `7bd6608` passed independent review and is integrated;
its six original harness files remain unchanged. Fresh M5 and save-bonus asset
manifests bind the tested build's generated HTML/font classes, three CSS files and
19 assets. Neither browser/PDF gate nor guard measurement ran. Pending descriptor
preparation preserved two setup refusals: first a multiple-Node-path selection
error, then the clean-worker guard while the separately authorized launcher was
being written. The one-line first-PATH correction passed review; no descriptor was
created. A separately reviewed launcher and actual measured allocations remain
required. Do not infer a measured budget from this static/build checkpoint.

All eight saving-throw browser/print source blobs match reviewed worker `ac6578f`;
its prepared **30 cases / 43 screenshots / eight PDFs remain UNRUN**. The original
fixture type failure, M1 full-check timeout and same-source narrow recovery remain
preserved. The independently reviewed local 15-second M1 test-budget correction is
included in the passing combined check; native caps and every oracle are unchanged.

Next genuine producer is empty fresh-character bootstrap. Initial plan `42ef8db`
was held for missing definer-owner details and direct-DML admission bypass. The
docs-only successor `10e295c` proposes exact cross-family capabilities and independent
always-unavailable NEW parent/order admission; both-family challenge is pending.
No issuer code or privilege change is accepted. Creation, class acquisition and
earned-feature lineage remain separate transactions; existing rows are not adopted.

Read-only runtime observation at 21:23 UTC found Docker's desktop-linux API pipe
unavailable and 178.9 GiB free on C:. No engine startup, image pull, provisioning,
native SQL, provider write, publication or deployment occurred. G1/G2 authority and
actual database/Auth/concurrency/rollback/restore acceptance remain open.

### Current read-only hosted metadata — 2026-10-13 21:37 UTC

Connected project `Inkborne` (`etcaodglvcspcmwecyxq`, us-west-1) reported
ACTIVE_HEALTHY. Its inventory has 69 recorded migrations; the repository has 83
migration files. Sixteen local migration names are unmatched, but name comparison
does not establish effective schema gaps: `characters.primary_color` is present
despite its unmatched migration name. Hosted `characters` has the expected 15 base
columns and no staged `action_revision`; refs include `feature_grant_id`, and grant
rows retain their current generation/controller/feature fields without protected
earned-occurrence lineage. RLS is enabled on these three tables by metadata.
No user rows, policies, real Auth or workflow outcomes were read/tested. No hosted
mutation or stage application occurred. Metadata evidence SHA256:
`1F7FDB5350A1A129D6F4239B8FBAC762D89457912E6A4AA55D9481A366A10F03`;
see [read-only evidence limits](handoffs/2026-10-13-hosted-core-metadata.md).

### Preserved earlier static preparation — 2026-10-13

Current integrated source `28966b4388509a17b5e5ee6ec9e2d5cc0c9bccb1` passed
`npm.cmd run typecheck` and `npm.cmd run lint`; all five recorded process identities
exited for each gate, with no remaining owned processes. All eight saving-throw
browser/print harness blobs match reviewed worker `ac6578f`; its valid narrative
fixture uses the declared `motivation` field. The preceding unsupported `backstory`
type failure remains preserved. These are static gates, not the prepared 30 browser
cases, 43 screenshots or eight PDF exports, which remain UNRUN. Fresh combined
check/build and measured browser allocations remain open.

The local 15-second M1 missing-identity test budget in `30632ac` passed independent
source review; assertions and native verification caps are unchanged. Combined
verification of that correction remains pending. The failed full check and same-
source narrow repeat below remain separate evidence.

M6 disabled first-selection source `ee3d261` passed both source reviews. Its first
narrow gate passed the existing 88 advanced-binding tests but failed collection of
the two new suites on the `server-only` test sentinel; zero new tests collected.
Typecheck and lint passed, and all 18 recorded identities exited with no owned
listeners. Manifest SHA256 is
`4C01349F9043C72273D1D6C146B69EC88D154B722F1737CA5C28795CCD0CA874`.
The separate TEST-only correction `baaa8b7` passed independent review: conventional
hoisted sentinel mocks in the two entrypoints, with every actual validator, model,
parser, stage and assertion unchanged. A focused retry is authorized in the sole
heavy lane; results and root integration remain pending. Native SQL, current Auth,
positive issuance, copy and casting acceptance remain open.

M5 guard measurement preparation `7bd6608` is frozen for source review only. It
adds two new files and preserves the six reviewed browser harness files. No probe,
descriptor generation, browser cases or acceptance promotion has run. A guaranteed
bound through inherited synchronous operations remains unverified.

### Preserved preceding checkpoints — 2026-10-13

Later M5 harness static corrections775/50ec are reviewed/integrated; typecheck and
zero-warning lint passed, five identities exited for each gate. Combined rootb89
preserved **4,769PASS/oneFAIL/threeUNVERIFIED skips (357 files)**: the unchanged M1
injected missing-identity case exceeded its local5s at5,013ms. All389 identities
exited/listeners zero. SAMEb89 unchanged narrow repeat passed66 tests/two files,
all21 identities exited/listeners zero. Source review found two real synchronous
Git/source admission passes before the immediate model refusal, no child lifecycle
poll/sleep/native SQL. A local15s budget for ONLY that fault is prepared for exact
independent review; body/oracles and native900000ms/500-command/10MiB caps unchanged.
Earlier9f acceptance and both failure/repeat receipts remain separate. Bonus46c
source corrections now passed review;30/43/eight runtime results remain UNRUN.
M6 source828dfee is frozen for both reviewers; no source/runtime acceptance yet.

Tested core source `9f848d4658ac9c523d548d51c0f5a19710de95d8` passed
`npm.cmd run check`: **357 files / 4,770 passed / three skipped**, typecheck and
zero-warning lint. Fresh synthetic build passed. All368 check/22 build recorded
process identities exited; owned listener readbacks were empty. The three skips
are retained **UNVERIFIED** M5 stress requirements, not acceptance or waivers.

The reviewed Magic900-second test-budget retry at SAME9f passed the **whole**
offline gate:34 cases/36 screenshots/36 font samples, complete final rendered
proof equality, zero page/blocked/unexpected requests and closed browser/server
ports. All739 recorded identities exited/listeners zero. Desktop saved and mobile
lost-response views were inspected. Receipt wall time20:11:27–20:26:36 UTC remains
recorded; no measured900-second allocation for the separate M5/bonus gates is
inferred. Preserve the preceding84b600-second whole failure and its inner results.
Auth/DAL/cache/persistence are modeled; no native or hosted authority is accepted.

M5 disabled source through worker62a86a2 is integrated through9f: all21 Git blobs
match, all45 aggregate receipt hashes verified (manifest
324DAE06989BE4CC88A1B2B19DB360C75D25CB9E84E069AFD0903518FE534177), and all80 earlier
exact process identities were independently absent. Worker ordinary134PASS/three
UNVERIFIED skips, corrected typecheck/lint passed. Flags remain off/SQL unapplied.
Reviewed browser source2cb/288 plus mounted-byte evidence14ea is integrated locally.
Its three immediate native-transition probes retain every old-enabled-DOM/parser/
operation oracle; none has run. First root604 narrow typecheck retained one TS2345
Buffer-to-JSON parse error, allfive identities exited. Independently approved775
explicitly decodes UTF-8 AFTER the unchanged raw SHA check; integrated28bd0c0,
retry pending. Full measured allocation/build/descriptor/browser proof remains open.

Numeric-save production remains the reviewed7acc integration. Prepared bonus
browser/PDF source995 is held for bounded stop/QA cleanup, bundle-size proof and
fresh inventories of BOTH QA output directories. Original six PDF fixtures and
verifier remain preserved; prepared30 cases/43 screens/eight PDFs are UNRUN.
M6 first-selection plan32675eb passed both reviews for private storage/strict
readers/compiled unconditional-refusal seams only. Stable earned-occurrence
lineage, positive issuance, choices-write privileges, copy bridge, casting and G2
remain unavailable; valid exhausted selections must remain readable without reset.

M1–M6 including M5.5 remain the active sequence. M7 and proposed monster/NPC imports
stay paused; M8 follows core acceptance. No provisioning, SQL execution, provider
write, merge, publication or deployment occurred. Source preparation is ongoing.

### Historical core checkpoints — 2026-10-13

Latest combined source `84b1834fa07491b7f07b4deb76693cfb19535575` passed
**345 files / 4,529 tests**, typecheck and zero-warning lint with two workers.
Fresh synthetic build passed. All349 check/22 build identities exited, listeners
zero. R13's offline gate passed **24 desktop/mobile cases /38 screenshots /38 font
samples**, full final equality and zero page/blocked/unexpected errors. All451
identities exited/listeners zero. Root inspected desktop workflow and mobile
workflow/uncertainty/draft views. Auth/DAL/RPC/cache/time/reload remain modeled;
SQL/current authority/concurrency remain unaccepted.

Magic's first explicit actual-form whole gate at SAME84b is **FAILED**: outer
600,000ms expired during complete dependency-proof finalization. Inner34 cases/
36 screenshots/font samples passed: failure=null, errors zero, final
matchedRenderedProof=true, Chrome/both ports closed. Installed closure is27
packages/86 edges/11,121 files/358,871,558 bytes, compared freshly across required
phases. All612 outer identities exited/listeners zero. Inner results are NOT
whole-gate acceptance. Preserve failure receipts/artifacts. A finite outer-budget
amendment needs independent challenge; form waits/oracles/proofs stay unchanged.

M1 corrected additive runner96081a3 over42247aa passed exact-source review.
First64 controls preserved60PASS/4FAIL plus owned type errors; lint passed.
Reviewed5d7916 fixes correlated settled completion evidence/narrowing and only two
local cap-test budgets. Corrected **66 tests/typecheck/lint PASS**, all19 observed
identities absent/listeners/model temporary directories zero. Original failures
remain. Tested handoff018b5c3 integrated throughbe54bf0: six Git blobs equal worker,
all12 receipt files/manifest58c76ec5450453421976432dc3d96951b8d227d4472d0fb64fe0498a01dcf9d6
verified. Protected R07 helpers/migrations/staged SQL/package/lock unchanged.
Root combined acceptance is pending; native execution remains UNRUN. M5
default-off instance source1825fe2/correctiona316454 passed source review: operation
lifetime/committed readiness, stale replies and malformed reads corrected. Tests
and explicit confirmed-save-to-fresh-latest editing remain open; SQL unapplied.

Class-save prerequisite/private-proof plans bd05fe8/3085239 and numeric save-bonus
plan/correction0d1d94f/5b76418 passed independent plan review, not new authority or
C2 activation. Actual bonus source advances in ../save-bonus-consumer-worker,
codex/saving-throw-bonus-consumers, base353858c (84b plus exact approved docs).
Seven production paths and one authorized print fixture are scoped; gates/install
UNRUN. Ring/cloak inventory acquisition, numeric death saves, genuine class
producers/reader/compiler/all13 writers/copy remain required separate gaps.
M7 and monster/NPC imports remain paused; M8 follows included core acceptance.

Independent review approved exact root3f8a835's ONLY Magic outer600→900-second
budget/historical handoff amendment. Product waits/oracles/full fresh dependency
proof/source/force-cleanup guards unchanged. Retry UNRUN. Bonus locked install
passed804 packages/43seconds; allthree process identities absent/listeners zero,
package/lock unchanged. This is dependency setup, not source/product acceptance.

The following records preserve earlier failures and their corrections.

At548e62b, the combined M1+numeric-save source passed typecheck/zero-warning lint,
but full tests retained **4,635PASS/oneFAIL (350 files)**: unchanged offline race
esbuild preparation exceeded its default5s at5,013ms. All389 observed identities
exited/listeners zero. Same-source focused race+monster gate passed20 tests with
unchanged deadlines, allsix identities absent. Independent review approved a
local15s deadline for ONLY the bundle-preparation test, which launches no UI and
measures no product response. Inputs/plugins/errors/parser/stub assertions and
other global/native/product waits unchanged; amended combined gate is pending.
Original failure and focused pass remain separate immutable receipts.

Numeric-save sourcea807 plus typed-selector9e28 and tested handoff7acc22 are now
integrated through548e62b: all14 Git blobs equal worker and all aggregate manifest
files verified (SHA256A4879B9FC30157D30DBB2848968CED762E420F7A59B7A7E56D7B211AF3D6A454).
Five substantive old-seven-API numeric failures/one no-bonus positive and exact raw
restoration observed; restored113 tests and correctedtype/lint passed, all34
sampled identities absent/listeners zero/lock unchanged. Engine/parser/schemas/SQL/
dependencies unchanged. Fresh actual browser/CON and print/PDF acceptance remain.

M5 source remains unintegrated/default-off. Four preserved attempts could not
observe the old enabled-DOM settlement setup (the first also failed collection).
The three exact stress bodies/oracles are now explicitly skipped UNVERIFIED and
tracked as M5-STRESS-SAVED/UNCERTAIN/ERROR in the worker handoff, not passes/waivers.
At4faca6e actual ordinary result134PASS/threeSKIP was observed; two fixture union
typing errors led to reviewed type-only6b793fe correction, type/lint pending.
Actual browser case08 retains all three required preconditions; no44-case success
may be inferred by omitting them. Neither product/native gate may be enabled.

Root `6e09f6a` combined check preserved one strict-lint unused-variable warning
after typecheck; Vitest did not run. All10 recorded identities exited. Reviewed
root-only `b2bae28` removes just the unused path declaration; Magic worker mirrored
it as `671d3e7`. At `b2bae28`, combined typecheck/zero-warning lint passed and
Vitest preserved **one failure / 4,528 passes (345 files)** with two workers:
the sequential sharing fixture submitted after a changed label without waiting
for its still-pending button. All351 observed identities exited/listeners zero.
Independent diagnosis found no demonstrated product defect. Reviewed `4e7d4a7`
adds two pure enabled-button waits before existing single submissions; all
version/call-count/same-tick/uncertainty assertions and timeouts remain. Corrected
three-suite gate passed **36 tests**, all eight observed identities exited.
Fresh full-check acceptance remains pending; original failures are retained.

M1 source `42247aa` is held for exact cross-owner EXECUTE assertions (recorded
ACL text alone is insufficient) and meaningful exported lineage/freeze/runtime/
cap/first-failure pipeline tests. Corrections remain within its six new files;
no native execution or acceptance. M5 instance source implementation is underway
in its separate worker, with dedicated receipts/CAS and no R09 journal coupling.

Current gate source is integrated through `8b62b8e`: the Magic actual-form harness
and its bounded complete installed-runtime correction `e51b957` passed independent
review; all14 Magic production/test/harness blobs match the frozen worker.
Intended34 desktop/mobile cases/36 screenshots remain UNRUN. R13's first browser
attempt at `dcda49d` exhausted its240-second outer budget during complete dependency
proofs, before any render/Chrome/case; all166 recorded identities absent/listeners
zero. Independently reviewed `b7469c3` gives only that outer budget600 seconds;
the Magic correction uses the same proactive outer bound. All product waits,
form assertions and source/cleanup guards remain unchanged. Root's next gate
sequence is combined check with two workers, fresh synthetic build, then the two
explicit offline browser configs; no database/provider route is exercised.

M1 additive runner source `42247aa` is frozen in `../r13-item-sharing-worker` on
`codex/core-db-verification`, unintegrated and awaiting independent review/gates.
It adds six files only; original R07, protected migrations/stages and product
bytes are unchanged. Native observer/SQL/profile behavior is UNRUN.
M5 campaign-instance plan `c8f2b4c` / correction `6074992` passed independent
re-review and is integrated as `c78ee18` / `9eafb0b`. The correction removes R09
coupling, uses platform/owned personal sources, and preserves the same operation
and intent after uncertainty. Native validation is bounded honestly; full
canonical parser admission remains required for preview/render. Actual DM-only
instance storage/DAL/form/routes are being implemented in isolated
`../m5-campaign-monster-worker`, branch `codex/campaign-monster-instances`, clean
base `72296a3`. Its locked install passed804 packages/41seconds; allthree process
identities exited and lock SHA256 remained
`7225AA9026EB747C5626204C9E5E5901809F95B33A1AACABA35CD139E86A2EB6`.
No instance/source/native/browser acceptance is inferred from that setup.

Magic-item acknowledgment source is now integrated through `b8f1d44`. All eight
source/test Git blobs match reviewed worker `f313c1b`; its final gate-manifest
SHA256 is `D06195860ACA5D9BAC1B3FF7FDDF4EB674AB6FD68FA7524A307DDA52B514B62E`.
The corrected baseline produced **32 substantive failures / three positives**;
restored source passed **four files / 143 tests**, typecheck and zero-warning lint.
All 40 recorded process identities exited, owned listeners zero. The original
setup/lint failures remain preserved. Root combined and new actual-form browser
acceptance are pending; no database or exactly-once claim.

R13 ordinary-item campaign-sharing source `4710fe8` / `b569b8f` and independently
reviewed offline harness `919066d` are integrated as `f2a4819` / `95ce6c7` /
`7952aae`. Root independently approved and integrated test-only `ab1fde4` /
fixture-only `c0f09b5` as `25ef20f` / `53b09cc`: the mock reset no longer returns
a Vitest teardown, both legitimate pin notices must remain visible, and modeled
revalidation now registers outside render. Product bytes and all browser
assertions remain unchanged. The first narrow run (192/195) and fixture lint
failures are preserved. Corrected source passed **12 suites / 195 tests**,
typecheck and zero-warning lint; all 80 recorded identities absent/listeners zero.
Tested handoff `1a8965e` is integrated as `a9ce9dc`; its manifest SHA256 is
`752808C577529B7857CBE74B3E14CA3E33497A2A44E876D88933D3D57D197995`.
SQL is staged only.

Root full check at clean `d3f5ed6` passed typecheck/lint but preserved **two failures /
4,527 passing tests (345 files)**: unchanged monster-form roundtrip exceeded its
five-second limit under four workers, and the old item-route fixture omitted the
new campaign-access mock export. All 369 recorded processes exited/listeners zero.
Root test-only `19e0d79` passed independent review: preserve the four original
route assertions, explicitly model campaign access and panel props, and verify
denied routes never read campaign metadata. The separate actual-form/panel suite
is unchanged. At clean `11d2df9`, the three affected suites passed **23 tests**
with two workers and unchanged timeouts; all eight process identities exited.
Contention is a plausible explanation for the monster timeout, not a proved cause.
Fresh combined/build and both browser gates remain pending.

M1 additive disabled-install profile plan `53b69fc` is integrated as `11d2df9`
after independent runtime/class and original R09 owner review. Only its local
runner/assertion/test preparation is authorized; original R07 manifests/receipts,
83 migrations and equipment remain frozen. Native G1/G2/G5 approval and real
database acceptance remain open. New profile never proves unreachable Auth,
class-history, locking, replay or writer-cutover bodies.

P1b.2 source `bdc9086` and qualified lookup correction `bf171408` passed independent
class and original authority-family review. Integrated as `9ad6f9f` / `221b1e3`;
tested handoff `0517fde` as `881dfc9`. All six source/test Git blobs match reviewed
`bf171408`; ignored root identity receipt is
`test-results/class-confirmation-integration-source-proof.json`.

Worker `npm.cmd test` on confirmation/P1a/joint model+static suites with
`--maxWorkers=2` passed **six files / 172 tests**, 28.06 seconds. Typecheck and
zero-warning lint passed at the same clean source. All **21** recorded process
identities absent, owned listeners zero. Evidence manifest is sibling
`verification/r06-class-origin-confirmation-20261013/manifest.json`, verified
SHA256 `B4584A133A9E3AAD5A7A0C4238E42A3E61F2E6D75B7DF1ECBB439CA74B6267FD`.
Root combined check/build remain pending. Constructor/token-removal checks are
STATIC binding, not semantic before/native SQL evidence. SQL remains unapplied,
Auth unavailable, all13 readiness false; bootstrap/compiler/all writers/copy/C2
and real PostgreSQL acceptance remain mandatory.

R13 source `4710fe8` initially held action-result uncertainty/correlation,
synchronous duplicate-submit protection and malformed static-test literals.
Correction `b569b8f` passed independent review; actual SQL/DAL/mounted item-form
bytes and original three-family SQL core/grants remain unchanged. Its narrow
gates are queued behind magic-item acknowledgement checks; separate actual-form
browser harness is source-only. No SQL execution or real sharing acceptance.

Magic-item source `2532f7c` passed independent review. Attribution-only `5d8d672`
preserves all assertions and labels wrong type/source/scope as old retryable-error
classification cases, not old wrong-row acceptance. Initial baseline had 33
failures / two positives / 78 filtered skips: **28 substantive DAL/UI failures**
and **five action test-factory setup errors**, excluded from product evidence.
Exact source restoration and eight absent process identities/listeners zero were
verified. Test-only `464f6e7` retains the module client factory while resetting
per-case mocks; independent review approved. Repeated baseline and restored
focused/type/lint gates are active, original failed receipts preserved. This
record does not claim those pending gates passed.

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

Victor answered the scope and durable-gameplay questions on 2026-10-12 UTC (historical answers; the later M7 pause in [current scope decisions](#finite-scope-and-decisions) controls execution, so no PDF-layout prompt is active):

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
| R12 passive feature authoring | Approved source through `ff3e452` integrated through `02c7b53`; six files / 145 narrow tests. Reviewed actual-form harness `5fedd62` integrated as `b4e308f`; **44 checks / 44 screenshots** passed with that exact build's CSS/fonts. | Standalone association is explicitly unverified. Writes, navigation and readback are simulated; no feature application/grant/reference/mechanics or database acceptance is implied. |
| R09 staged hit-die kernel | Plan `ade6a34` / `4003a45`, corrected source `859d3db` and handoff `cbeb963` independently approved; integrated through `26e674e`. **144 focused tests**, typecheck/lint and historical combined `b4e308f` acceptance. Kernel fixture amendments `3a9ec34` / `f385002` preserve all 36 assertions, now passing. | No SQL/PGlite execution. Reader/writer amended plan `3a34169` is integrated; source `5367243` / correction `6662133` reviewed for explicitly unready staged scope only, untested and unintegrated. Actual shared ASI/spell authority binding, Auth, thirteen writer readiness families, lifetime and PostgreSQL acceptance remain open. |
| R06 saved ASI consumer parity | Independently reviewed worker chain through `f680749` integrated through `b2e45de`; worker **68 focused / 205 cascade tests**, typecheck/lint passed. Actual earned-choice DTO, nullable grant provenance, fingerprint, six finite abilities and stale-callback/whole-rest guards are present. | Fresh root `f385002` typecheck/lint pass, combined tests fail as recorded below. Canonical actual-consumer browser preparation underway; no SQL or hosted acceptance. Class prerequisite plan `87e3a30` permits C1 pure work only; original-role producer, precise manifest authority and actual C2 consumers are still mandatory before new class authoring. |

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

Passive source/corrections/handoff were independently approved and integrated as
`f100bc4` / `1073865` / `de05e42` / `c894e2d` / `02c7b53`. Exact Homebrew seam
review at `02c7b53284524d4060736d50e631ee9203309dfc` confirms all eleven families'
tuple positions, independent error paths and global empty-state conditions.
Clean root at that SHA passed **302 files / 3,591 tests**, typecheck and zero-warning
lint, four workers, 148.93 seconds test duration. The gate observed 357 task process
identities; exit/readback processes and listeners are empty. Fresh build and actual
passive form acceptance remain pending. ASI plan `6fcd21e` passed independent exact
challenge; scoped source implementation is now underway in `../r06-asi-consumer-worker`.

Kernel review identified two blockers: accepted responses require the retained
request/operation correlation and lookup-status consistency; the offline model
must enforce candidate acceptance time at or before native acceptance, like the
staged SQL. Original modeled/static **139 tests**, typecheck/lint passed at
`aeea1e4`; they did not detect these boundaries. Reproduction `f8b7cd1` on unchanged
product preserved **3 failures / 2 passes / 31 skips**. Correction `859d3db` passed
**144 focused tests** and typecheck; independent correction review and final lint
are pending. No SQL was executed and production remains disabled.

The sole root writer continues approved integration while expensive checks remain
serialized. Any root HEAD change makes the `821eb1a` browser build manifests stale;
rebuild and rebind before using them for later source. G1/PDF input/P1-P3 decisions
remain unanswered. No engine start, image pull, container, SQL execution, hosted
write, deployment or publication occurred in these gates.

### Fresh combined and passive-form acceptance — 2026-10-12 UTC

Clean `b4e308fe7c9b0279b25f42035603579afb67cebb` passed `npm.cmd run check`:
**305 files / 3,645 tests**, typecheck, zero-warning lint, four workers and 153.57
seconds test duration. Recorded identities: 368; process/listener readback empty.
Its synthetic build passed in 28.3 seconds, 23 observed identities/readback empty.
Build-ID SHA256:
`2c48eb336d9111d1bf11338feb918be8899d9edba29142a90609178b82fb0b65`;
build receipt SHA256:
`fe47382609db75c23a4eb6d168b60ae7c230f98d3245c45fa022e7816b462acf`.

The reviewed actual `PassiveFeatureForm` harness passed **44 checks / 44 screenshots**
(22 cases per desktop 1280x900/mobile 390x844), one Playwright case in 28.4 seconds.
Actual CSS/fonts, installed Next browser error helper, lock and bundled transitive
project bytes are hash-bound. Native over-limit controlled/serialized 101-name
rejection, pending/reset protection, actual rejected/missing/malformed responses,
manual acknowledgement/relock, saved-ID navigation failure, immutable edit fields,
raw metadata/effect preservation simulation, no-op and native conflict reload passed.
Root inspected mobile basic/rejected/preserved-edit and desktop navigation-failure
screenshots. Zero page errors, remote/unexpected requests or layout failures.
Node 23088/parent 18696 birth `2026-10-12T16:25:21.0113460Z`, Chrome 13824;
HTTP 65477/control 65478 closed and browser exited. Outer 38 identities/readback empty.
Fixture auth/actions/CAS/readback/navigation remain simulated, not Server Actions
HTTP, RLS, PostgreSQL, real attachment or authenticated application-shell acceptance.

Five slot and six casting browser cases also passed at `b4e308f` with nineteen
observed identities/readback empty for each gate. They retain simplified styling
and simulated endpoint/state boundaries. Broader core run preserved **one failure /
two passes**: builder Strength input never appeared, while seven play-save and nine
casting-resource controls passed. Diagnostic-only `0eb1b81` reproduced the failure
and captured `Cannot read properties of undefined (reading 'map')` with empty root
DOM, zero completed checks and zero remote requests. The old inline synthetic
schema omitted required `derived_stats`; current ability display calls the real
evaluator. Original failed logs/DOM/screenshot and cleanup receipts are archived.

Independently approved harness-only `9fb0877` supplies all eight missing system
collections, preserves the original generic two-ability setup and **all 27 original
assertions**, and marks receipts running/passed/failed with start time to prevent
stale success reuse. Narrow builder rerun passed **27 controls**, zero page errors
or remote requests, one Playwright case in 13.1 seconds, eighteen identities and
empty cleanup. Production source was unchanged. This is generic editor/CAS proof,
not canonical six-ability D&D/ASI evidence. A fresh combined check after this harness
change subsequently passed at `259bcd8`: **305 files / 3,645 tests**, typecheck,
zero-warning lint, 152.80 seconds tests, 351 identities and empty cleanup. Do not call the original
three-case core run green or all 43 controls one exact-source run.

### ASI integration and preserved combined failure — 2026-10-12 UTC

Reviewed ASI worker chain `c6a66cd` / `0981675` / `1e8a6ec` / `822b034` /
`129e768` / `c37e5b3` / `c2b2099` / `f680749` is integrated through `b2e45de`.
Worker receipts retain the original admission, provenance, CON-formula, Background
draft/state, nested picker and dependency fixture failures, followed by 68 focused
and 205 cascade passes, typecheck/lint. These are separate from root acceptance.

Root `b2e45de` combined check first stopped at a kernel class fixture missing
required nullable `feature_grant_id`. Fixture-only `3a9ec34` added null, then
preserved **18 failures / 18 passes**: its old CON-only schema/base cannot establish
six-ability mechanics. Independently approved fixture-only `f385002` adds the other
five neutral base scores and schema abilities, leaving CON14 and every one of 36
assertions unchanged. Narrow kernel rerun passed **36/36**, seven identities and
empty cleanup; no production guard or receipt/native-clock/revision oracle changed.

Clean `f385002853fb4a200615dde55ff13b8204f6128b` ran `npm.cmd run check` with
four workers: typecheck and zero-warning lint passed; **24 files failed / 289
passed**, **168 tests failed / 3,546 passed**, **14 unhandled errors**, 177.29
seconds tests. Recorded 365 process identities, empty process/listener readback.
Exact failed logs/result/resource/cleanup remain in sibling `verification/launch-20261012`.
Older partial-score/schema fixtures, absent mechanics mock contracts, selectors
colliding with new status disclosures and server snapshot mocks are being
classified; fixture repair must preserve original behavioral oracles and explicit
negative evidence. Product defects require separate failing-before corrections.
Canonical actual ASI browser/source-asset binding and print reacceptance remain due.
No SQL, engine, container, hosted write, deployment or publication occurred.

### Reviewed fixture and recovery closure — 2026-10-12 UTC

Root original content-ref query-error test exposed a product regression: a caught
raw read error became an empty ordinary ref list. Reviewed `2dab2d6` retains the
same original exception for ordinary readers while the explicit sheet snapshot
reports incomplete/unavailable. Exact count and ordinary null-grant fixtures were
completed without weakening that error identity or malformed-pin controls.

Reviewed root fixture chain through `5a46eab` retains original request expressions,
crit/riders, CAS/call-order, raw choices, anonymous denial and request-cache ref
read assertions. Explicit finite mechanics requirements accompany existing roll
requests; generic draft recovery selectors name the actual status text. The
unearned saved-ASI negative now correctly leaves STR12 and its raw choice intact,
rather than displaying an unaccepted STR14. Root's first targeted run preserved
**369 passes / seven failures**; corrected `5a46eab` passed **12 files / 376 tests**
in 24.60 seconds, eighteen identities/readback empty. A required fixture system-ID
type guard followed at `1fb0fcd`; typecheck passed, seven identities/readback empty.

Provider fixture chain `62a56c8` / `e136adb` / `609e7c5` / `60aed1c` / `8ff5a79`
was independently reviewed and integrated through `b2e513b`. Complete original
six-score/schema/ref models use the actual ASI resolver. Hydrated HP/temp defaults
are distinct from unchanged raw CAS/absence controls; slot evidence stays available
when only caster ability math is invalid. Worker failed runs retained **52 failed /
146 passed / ten unhandled errors**, then **19 failed / 179 passed / zero errors**;
two fixture failures were corrected and seventeen product/recovery assertions stayed
unchanged. Worker typecheck/lint receipts retain their exact source limitations.

Reviewed root `deb8909` reuses the state writer's original settled-state preflight
for mechanics: exact stored typed reload error first, then pending/stale refusal,
before RNG or computing a patch. Cast retains its read-only refusal. Long rest
keeps unavailable/ordinary refusal as `Promise(false)` and validates every original
CON/HP/temp/resource/die input inside the same single whole-patch action. Oracle
correction `2dd3ecd` retains all no-RNG/log/DAL/raw-state assertions. Root intermediate
recovery run retained **31 passes / eight old-fixture failures / one error** before
provider fixture integration. Subsequent provider run retained **214 passes / seven
failures**: three missing ordinary raw null-grant fields and four unavailable-message
checks. Reviewed `2467388` changes only that fixture field and two explicit guidance
prefixes; guard predicates and all behavioral assertions remain unchanged.

Clean root `7a68def578f4f3221ee884c085eafbca3e293b8a` passed **15 files / 221 tests**
in 25.39 seconds, 22 process identities and empty process/listener readback. This
accepts the targeted local recovery/provider fixtures, not the next full/build/UI
or database gate. The full `f385002` failure remains historical evidence.

C1 pure class-role chain through worker `78ceecb` is integrated through `7a68def`;
exact module/fixture/test/handoff hashes match independent review. Original scoped
save-denial and extra-class-source failures were reproduced through byte-substitution
controls with exact restoration. A later fixture aliasing mistake was retained and
corrected: strict unknown manifest rejection differs from canonically admitted raw
unknown class declarations, which require explicit graph denial. Final worker
**60/60 tests**, typecheck and lint passed, lock unchanged/cleanup empty. No app
imports, producer authority, C2 renderer/concentration/print integration or new
class-authoring completion is claimed. P1 producer inventory/plan proceeds next.

ASI offline harness `b7eed3f` and boolean-refusal compatibility `4848a7d` passed
source review only: 44 desktop/mobile cases / 46 screenshots remain **unrun**.
Final source anchor must bind approved `deb8909` character-context bytes and current
transitive inputs, followed by clean full/check/build, asset binding and actual UI.
R09 earned-authority plan `9ffa886` is reviewed/integrated as `6300764`; parent merge
`0384e1c` supplies reviewed ASI dependencies to its isolated worker, with only the
already reviewed neutral kernel fixture conflict resolved. Actual shared-validator
binding and frozen spell/version-time/acquisition closure are source work in progress;
Auth remains unavailable and all thirteen readiness families false. No SQL/runtime,
hosted writes, deployment or publication occurred.

### Local NPC JSON reader/profile acceptance — 2026-10-12 20:57 UTC

Test-only native byte-realm correction `7f3f021` and callback-void correction
`53bb0a4` are integrated as `b48ff2e` / `2ec882b`. Tested handoff additions
`a51060b`, `131b0b1`, `b1ecfa9` are `d6a61f8`, `c33734b`, `8ab7aff`.
R13 sharing plan `8a19ab6` is `7ce212a`; P1b.2 producer plan `5058187` / replay
amendment `f2da014` is `a7d6550` / `81629ce`. Plans passed independent review;
their actual source children are now separate isolated work, not accepted runtime.

Worker unsafe-reader-only control at `2594379` produced **nine substantive
admission/profile failures and one valid positive**, with unchanged candidate
schema/review/native hash/actual profile and exact eight-byte-file restoration.
First restored run had **59 failures / 21 passes** because direct TextEncoder
fixtures supplied foreign-realm bytes; reviewed identical-byte ownership fix
yielded **four files / 80 tests PASS** at `a51060b`. Typecheck then found one
table callback return-type error; reviewed void-only correction leaves all input
vectors/assertions unchanged. Typecheck/lint passed at docs-only `131b0b1` over
that correction. Original failure/restoration receipts remain in worker
`test-results/r17-npc-json-gates/`; baseline manifest SHA256
`2aa1f5ad799b46c228045ac6005cca7cd35aad2ee482519bd13c9bfa60704c49`.
All **60** captured worker identities absent; owned processes/listeners zero.

Clean root `81629ce050f9818827dc88008d6362cd6479435f` passed
`npm.cmd run check`: **339 files / 4,266 tests**, 200.38 seconds, four workers,
typecheck/zero-warning lint; all **374** identities absent. Fresh synthetic
production build passed at the same source; all **24** identities absent. Exact
build/root/lock/generated font classes, three CSS files and nineteen assets bound.

Explicit `npm.cmd run test:e2e -- --config e2e/local-npc-json/playwright.config.ts`
passed **eight desktop/mobile cases / eight screenshots / eight real-font samples**
in 2.5 minutes. Native original file bytes/hash, duplicate story ideas/escaped
text, Unicode byte-offset refusal with old preview retained, valid pair/declared
empty groups, pending one-read guard and truthful prior-source status passed.
Only result-delay timing is modeled. Complete own/inherited/transitive/source/
root/build/manifest/assets/fonts/lock/installed-package envelope was freshly
rebound after teardown and matched the rendered proof. Page/network/console errors
zero, failure null; HTTP/CDP closed and browser exited. All **234** recorded gate
identities absent; owned listeners zero. Mobile original/refused-retained and
desktop pending screenshots inspected: readable contained content and explicit
old source/hash. Receipts are in sibling `verification/launch-20261012/`, browser
artifacts `test-results/npc-json-local/`. No OS file-dialog acceptance is claimed.

This is a provisional LOCAL codec/review/profile; no Auth, app upload action,
persisted ID/version, staging/commit/import/save, SQL or authenticated shell path.
Human format preference and supported PDF matrix remain pending. Prior NPC,
authoring/companion/ASI/print evidence retains its earlier exact-source bounds.
This change added no app route or changed their production components.

R13 worker's locked dependency setup also passed at `8a19ab6`: 804 packages,
34 seconds, all five identities absent, unchanged lock SHA256 `7225aa90…2eb6`.
No postinstall scripts, service/runtime or provider action. Item sharing source
and private P1b.2 producer source now proceed without heavy gates. Independent
R12 discovery recorded weak save acknowledgements/mounted-draft binding in older
magic-item/item/weapon/armor/core-race families; a magic-item-only plan proceeds
first, preserving family-specific raw/effect merge contracts. No beta or total
project completion is implied; database activation and release gates stay open.

### Local NPC JSON prototype integrated, gates pending — 2026-10-12 20:36 UTC

Reviewed local codec/review/profile source `0f3ee66`, meaningful unsafe-reader
controls `7cdce9a`, initial harness `75e3563`, truthful retained-status correction
`101027b` and final artifact-rebind correction `2594379` are integrated as
`de26e09`, `be64bd4`, `073cb9b`, `9ce5d6b`, `d4fc0a7`. Independent review held
the initial harness's final helper-only check, then approved complete fresh
transitive/source/root/build/manifest/CSS/font/lock/runtime equality after teardown.
All eight source inputs remain: changed preview component fixed at `101027b`,
other seven fixed at `0f3ee66`; no moving-HEAD source fallback. Retained status
now accurately covers changed, pending and rejected selections.

All **16** changed Git blobs match approved `2594379`; ignored identity receipt
is `test-results/npc-json-integration-source-proof.json`. This is source identity,
not runtime acceptance. Worker exclusively owns narrow semantic-before/restored
tests/typecheck/lint; root combined check/build and eight intended offline browser
cases remain pending. No case count is accepted yet. Human format preference and
PDF matrix remain unanswered. This provisional local reader/profile has no app
upload route/action, persisted identity/version, staging/commit or import authority.

Next finite plans proceed independently: P1b.2 genuine already-first confirmation
producer and R13.1 ordinary-item campaign sharing. Discovery found an item-form
stale-draft/version-prop mismatch that must be addressed by the sharing child.
Existing item create/update uses parsed current-row responses, not NPC-style exact
immutable snapshot confirmation; malformed/lost create acknowledgement recovery
remains a separate R12 gap. No SQL/runtime/hosted operation or release occurred.

### P1b.1 integrated joint revision local acceptance — 2026-10-12 20:27 UTC

Reviewed source `27bb36a` and model correction `760101b` are integrated as
`35c763e` / `25cf735`; tested worker handoff `22d826e` as `d62667d`.
All six new source/schema/SQL/fixture/test Git blobs match exact reviewed
`760101b`. The handoff has only the later tested receipt addition. Frozen P1a
and R09 files remain unchanged; the sole added SQL stage is unapplied.

Worker acceptance passed **five files / 194 tests**, typecheck and zero-warning
lint. Meaningful BEFORE replaced only exact `27bb36a` model bytes: all four
positive/ordinary controls passed, four selfconsistent actor/target identity
controls failed because the old model admitted them. Exact restoration, unchanged
SQL and final clean status were verified. All 30 OS process identities absent,
owned listeners zero. Immutable evidence is in
`verification/r06-class-origin-joint-20261012/manifest.json`, SHA256
`6FF702F73ADCBC5EF188948A4976213181D77F677B704D765B9708B6C15B4CA9`.

Clean root `d62667d2ab634ef0c6b37a931560a1817029cf5c` passed
`npm.cmd run check`: **335 files / 4,186 tests**, 170.37 seconds, four workers,
typecheck and zero-warning lint. All **363** recorded identities absent. Fresh
`npm.cmd run build` passed at the same clean source; all **24** identities absent.
Both owned listener readbacks are empty. Receipts remain in sibling
`verification/launch-20261012/`. No new application import or browser behavior was
introduced by this joint stage; preceding `414f49e` browser/print evidence below
retains its exact source and simulated boundaries.

Actual PostgreSQL syntax/effective ACL/RLS/trigger timing, native time, Auth,
locks/concurrency/rollback remain unproved. No SQL/runtime/hosted action occurred.
Auth remains unavailable, gates default false and all13 readiness families false.
P1b actual already-first transaction producer, fresh/bootstrap, compiler, all-writer
participation, copy/C1v2/C2 and R09 closure remain mandatory. Producer discovery
continues read-only while the independently reviewed local NPC JSON prototype
prepares its separate offline harness. Human import-format preference and PDF
matrix remain pending; no app upload/durable import or beta acceptance is implied.

### R18.1 integrated template acceptance and regression gates — 2026-10-12 20:16 UTC

Reviewed companion production `5cc9aad` is integrated as `2901bee`; harness
`ee3119e` / `74414e0` as `c266a8e` / `414f49e`. The fixed NPC shared-source
checkpoint amendment `fe236db` passed independent review: exact approved `5cc9aad`,
all eight bindings retained, unchanged NPC schema/profile/row, five reviewed
additive companion registry/parser/catalog/presentation/detail changes. Existing
monster guards use approved root/full transitive receipt binding and were unchanged.

Worker old-parser-only baseline retained new companion registry/schema/tests and
ran real ref reader/CharacterPage before assertions: **four semantic failures /
four positive controls / three filtered skips**. All effectful rows were accepted/
collected and complete; mechanical STR16, other grant/choice/narrative controls STR14,
actual athletics grant retained. Empty-role/ordinary-effect positives passed. The
new fence rejects intact/incomplete and yields the existing degraded STR12 behavior.
Exact 8,667-byte parser restored, SHA256
`f38653f869724148878f5ad8fd7626f45bd5b92514febc386e8a146a8e98e700`.
Corrected **six files / 77 tests**, typecheck and zero-warning lint passed at
`ee3119e`; all 33 recorded OS identities absent and owned listeners zero. Resource
and exact source/command/restoration receipts remain in sibling
`verification/r18-companion-20261012/`. New final guards `74414e0` were initially
source-only and then verified by the following combined and browser gates.

Clean `414f49ef30899e382405607edb8eef1ddad9c5e2` passed
`npm.cmd run check`: **333 files / 4,136 tests**, typecheck/lint, four workers,
167.01 seconds, all 370 recorded identities absent. Fresh synthetic build passed,
all 24 identities absent. Each browser bind checked generated HTML/font classes,
three CSS files, nineteen assets and exact clean build/root/lock inputs.

- Companion explicit offline config passed **22 desktop/mobile cases / 22 screens**
  and 22 real-font samples. All three descriptive roles, exact stat display, absence,
  keyboard/search, long final-action reachability, escaped text/shared badge and
  empty/malformed/denied cases passed. Final mounted six-harness/helper/source/build/
  asset rebind passed after teardown; page/network errors zero. Inspected mobile
  mount/long-bottom/escaped and desktop beast profile: contained readable content.
  All 180 identities absent; HTTP/CDP closed, Chrome exited.
- NPC Library rerun passed **14 controls / 18 screens**, 44.8 seconds, same exact
  source/real asset binding and zero unexpected errors; all 75 identities absent,
  owned ports closed and browser exited.
- Earned-ASI consumers passed **44 cases / 226 assertions / 46 screens**, 1.9 minutes,
  unchanged native-RNG/simulated accepted-critical policy and zero unexpected
  errors; all 164 identities absent, HTTP/CDP closed and browser exited.
- Fresh print gate passed **six Letter/A4 exports** in five seconds, all 24
  identities absent. Independent text/privacy/end-marker/margin/dimension checks
  and 90-DPI rendering passed **33 pages**. Current caster A4 and long Letter
  contact sheets inspected; print product/layout is unchanged since prior full
  six-fixture inspection. All seven QA/renderer PIDs absent; original QA receipts
  record observed start, not OS birth, and no process was killed.

All Auth/entitlement/query/action/CAS/navigation/print-invocation boundaries remain
explicit simulations; print uses loaded values, not an atomic/latest DB snapshot.
No SQL, actor-role/RLS/native triggers/locks/concurrency/actual instance or mechanics
acceptance is claimed. R18 templates do not complete character/campaign/controller/
lifecycle/transform/summon requirements; R19 remains open.

P1b.1 SQL source `27bb36a` passed class and original R09-owner reviews. One phase-model
identity mismatch was corrected at `760101b`: protected receipt and actual origin/
occurrence actor/target bindings, with matching rebuilt graph/proof negatives. SQL
and all frozen bases unchanged. Correction passed independent review; focused/
semantic-before/type/lint gates now own the sole released heavy slot. Auth remains
unavailable/readiness false/no app imports; no SQL execution.

Import discovery confirms current MPMB parser, mapping, persisted format/type and
preview contracts are SourceList/SpellsList/FeatsList and spell/feat-only. No observed
creature/NPC registry is supported. Optional human JSON-versus-evidenced-MPMB format
preference was requested and remains unanswered. Reviewed local prototype plan
`831ca79` is integrated as `fd10c13` after proposed `c96df74`: bounded strict UTF-8
NPC JSON codec and read-only profile review only, rejecting decoded NUL/unpaired
surrogates under the [PostgreSQL 17 JSONB string rules](https://www.postgresql.org/docs/17/datatype-json.html). This is a local working assumption,
not human format approval. App route/link/upload/stage/commit and durable acceptance
remain later format/review/G2 gates; PDF input matrix remains independently pending.
No deployment, publication or beta acceptance occurred.

### R17.2 private NPC local acceptance — 2026-10-12 19:52 UTC

Reviewed worker product `5da83a6` / `1fc3620` is integrated as `c944668` /
`1068b1d`; harness `64b7751` / `a30f203` / `48af0f6` as `2ed39e5` / `0e00d64` /
`10b06c8`. All eight guarded production Git blobs match approved `1fc3620`;
proof retained in `test-results/npc-authoring-integration-source-proof.json`.
Private owner create/edit, structured narrative fields with presence/order/duplicates,
strict raw preservation, eligible version CAS/no-op/MAX checks and exact returned
immutable snapshot confirmation are included. Existing relationship/privacy/copy
and gameplay semantics are unchanged.

Initial source review held two finite response defects: unexpected idle response
unlocked retry, and schema error paths plus identity/intent could exceed 100 keys.
Reviewed correction rejects idle as uncertainty in both modes and reserves identity/
intent within one total feedback bound. Meaningful old-mapper-only baseline kept
new form/tests: **seven semantic failures / 47 positive controls** across three
files; exact raw SHA256 bytes restored in finally. Corrected worker **seven files /
95 tests**, typecheck and lint passed. Initial lint's reserved helper binding name
was preserved and fixed by identifier-only `a30f203`. All 51 captured identities,
including wrappers, absent at readback; owned listeners zero, lock unchanged.

Harness review separately required `resolveDir: root` and independent immutable
helper proof before dynamic process-helper import/use in both runner and wrapper.
Reviewed `48af0f6` closes these and rechecks all six mounted harness bytes, inherited
helpers, root/index/config/source closure and forced-cleanup proof. Earlier gate
evidence stays scoped to `64b7751` / `a30f203`; the new guards were accepted by the
following fresh combined and actual-browser gates.

Clean `10b06c8401fb442e65e1af0e68b75617c1135061` passed
`npm.cmd run check`: **329 files / 4,079 tests**, typecheck and zero-warning lint,
four Vitest workers, 170.80 seconds, all 365 recorded identities absent. Fresh
synthetic production build passed, all 23 identities absent. Asset bind checked
actual generated HTML/root font classes, three CSS files and nineteen assets.
`npm.cmd run test:e2e -- --config e2e/local-npc-authoring/playwright.config.ts`
passed **18 desktop/mobile cases / 20 screenshots** in 50 seconds. Twenty real-font
samples passed, page/blocked/unexpected errors zero, failure null. Native structured
draft/reset/pending duplicate prevention, validation/focus, conflict, uncertain/idle
create acknowledgment and edit reload lock, confirmed reference/plain navigation
and no reinsert controls passed. Inspected representative mobile pending/uncertain
and structured/mobile/desktop views: readable contained controls and retained draft.
All 86 recorded identities absent; HTTP/CDP ports closed, Chrome exited.

Actions/Auth/persistence/CAS/latest-row reload/navigation are explicitly modeled.
No SQL, actor-role/RLS/concurrency/real snapshot-trigger or hosted acceptance is
claimed. NPC import, campaign instances and actual authority remain required.
Receipts/failures preserved in sibling `verification/launch-20261012/` and ignored
worker/root `test-results/`; no live write, deployment or beta acceptance.

P1b.1 plan `5883d76` initially held object-definition order; `4c62885` made one
additive joint stage after unchanged bases, then held a redundant cross-owner
finalizer call without EXECUTE. `4bd378b` removes that call without new grants;
existing class-owned deferred triggers retain full closure. Amended plan passed
independent review; disabled joint source implementation proceeds, SQL unexecuted.
R18 production `5cc9aad` passed independent source review and now owns the released
focused/model/type/lint slot. Its harness `ee3119e` is held for final mounted-byte/
source/helper closure and fresh helper proof before forced cleanup. Instances,
controller/lifecycle rules, transformations/summons and R19 remain open.

### P1a combined local acceptance and next children — 2026-10-12 19:33 UTC

Reviewed class-origin P1a source `7fb4dae` and correction `00dce154` are integrated
as `bed0e24` / `477c20b`; tested handoff `4a955c1` as `1d02806`. All six source,
fixture and test Git blobs match the exact reviewed correction. Proof is retained
in ignored root `test-results/class-origin-integration-source-proof.json`.

Worker semantic baseline replaced all three mutually coherent earlier model,
schema and staged-SQL byte inputs while retaining corrected tests/fixtures:
**27 invariant assertion failures / three positive controls passed**, with no
constructor/collection substitute. All exact SHA256 bytes were restored in finally.
Corrected **three files / 144 focused tests**, typecheck and lint passed. All 28
recorded OS identities were absent, owned listeners zero. Additive receipts:
`verification/r06-class-origin-p1a-20261012/manifest.json`, SHA256
`5da96133711df7f4e3b2a97484aaf008fbb7111c90c617db2a80f383f2464d7d`.

Clean integrated `1d028063b8bc5bf2e82bc4de54b80999f44862fa` passed
`npm.cmd run check`: **324 files / 4,015 tests**, typecheck and zero-warning lint,
four Vitest workers, 197.17 seconds. All 379 recorded identities were absent.
Fresh synthetic production build passed; all 23 identities absent. New P1a modules
have no application imports; no new UI behavior is claimed. NPC/ASI browser
acceptance remains at `42abdbb`; print remains six exports / 33 pages at `7ff6185`.
These models/static source tests do not execute SQL or prove PostgreSQL roles,
native times, triggers, locks, concurrency, Auth or producer authority. All thirteen
readiness flags remain false. No SQL, live write, deployment or publication.

R17.2 source `5da83a6` is held for two response-contract fixes: reject unexpected
idle responses as uncertain and cap total validation feedback across all stages.
Remainder passed independent source review; gates and integration are pending.
P1b.1 jointly protected genuine metadata revision plan proceeds without changing
frozen kernel or P1a source. R18.1 template plan `fb2ac9a` passed root independent
challenge against actual strict monster schema/renderer/registry. Its isolated
`../r18-companion-worker`, branch `codex/r18-companion-foundation-20261012`, is based
on `1d02806` with plan-only `eaec7be`; locked dependency installation is underway.
This read-only template slice leaves instances, controller/lifecycle rules,
transformations/summons and all R19 progression requirements open.

### R17.1 combined local acceptance — 2026-10-12 19:23 UTC

Clean root `c18cf445b4ce7df24aa3e973330979f036f55c1e` passed
`npm.cmd run check`: **322 files / 3,931 tests**, typecheck and zero-warning lint,
with four Vitest workers. All 375 recorded process identities were absent at
cleanup. Its synthetic production build passed with 24 identities, none left.

First NPC UI attempt failed before browser/HTTP launch: the synthetic native-link
module omitted React's resolution directory (27 identities, empty cleanup).
Independently reviewed harness-only `42abdbb` sets `resolveDir: root`; product,
fixtures, assertions and guards are unchanged. Its fresh build passed (24
identities, empty cleanup). Asset binds verified actual generated HTML/font
classes, three CSS files and nineteen assets before each browser gate.

`npm.cmd run test:e2e -- --config e2e/local-npcs/playwright.config.ts` passed
**14 desktop/mobile grouped controls / 18 screenshots** in 48.2 seconds. All 18
font samples loaded real required production FontFaces. Keyboard/detail/search,
minimal/absent fields, maximum content/final-hook reachability, escaped text,
exact simulated shared badge and empty/malformed/denied reads passed. Two exact
expected parser diagnostics, zero other page/network/unexpected-request errors.
Inspected mobile Library/profile/long-bottom and desktop escaped screenshots:
contained readable text and reachable end. Auth/entitlement/query responses and
Next links remain modeled; no database, write, sharing or authenticated-shell
acceptance. All 73 recorded identities absent; HTTP/CDP closed, Chrome exited.

At the same `42abdbb`, existing earned-ASI consumers were reaccepted after the NPC
parser integration: **44 desktop/mobile cases / 226 assertions / 46 screenshots**,
44 loaded-font samples, zero page/network/unexpected-boundary errors. Existing
Auth/action/CAS/navigation/print simulation and native RNG limits remain. All 175
recorded identities absent; HTTP/CDP closed, Chrome exited. Print source is
unchanged since six exports / 33 rendered pages at `7ff6185`; no new PDF run is
claimed. Receipts and failure archives remain in sibling
`verification/launch-20261012/` and ignored root `test-results/`.

Latest full check is `c18cf445`; later executable change is the one-line reviewed
NPC harness fix. Repeat combined acceptance after next source integration.
Reviewed R17.2 plan `293c3d1` is integrated as `5bdb03e`; private NPC authoring
proceeds in its worker. P1a `00dce154` passed independent source review of five
closure defects and now owns the released semantic-before/focused/type/lint slot.
SQL unexecuted, Auth unavailable/all readiness false. No live write or publication.

### R17.1 reviewed local integration — 2026-10-12 19:02 UTC

R17 plan/source/harness chain through worker `fa8aa7b` is integrated locally as
`c99c8ab` / `3775a52` / `b3d4e3f` / `f533628` / `998f03a` / `368d7d4` /
`9307fee` / `4bfd55c` / `4447614` / `307e381` / `640be46`. All production and
harness amendments passed independent exact source review. This adds strict v1
narrative NPC schema, canonical current/snapshot empty-effects fence, read-only
NPC Library category/detail/profile and original fixtures. Existing character
relationship rows/privacy/copy are unchanged; no seed/catalog insert, authoring,
sharing/import writer, campaign instance or database migration is included.

Meaningful worker baseline substituted only the exact old canonical parser while
retaining registered NPC/schema/new test bytes. **Nine tests failed / nine passed**;
actual CharacterPage evaluated an otherwise valid effectful NPC as STR16 and
accepted/collected stat, proficiency, choice and narrative effects. Empty NPC14
and ordinary non-NPC16 controls passed. The correction rejects that raw evidence
and preserves it unavailable. Exact source/input hashes were restored and clean.
The baseline command omitted npm's forwarding separator, so both targeted files
ran fully; no claim is made that its name filter or worker argument was forwarded.

Initial focused run preserved three collection failures from one missing JSX
array bracket and one old category-list assertion (**205 passed / one failed**).
Reviewed one-character profile repair and explicit NPC category/URI expectation
retain all prior monster coverage. Corrected worker **14 files / 215 tests** passed
at `7137fad`; profile **four tests**, typecheck and zero-warning lint passed at
`8468602`. The initial typecheck's unsupported role-query option is preserved;
removing that option keeps exact string-name matching and the aria-current oracle.
Locked CI installed 804 packages with scripts/audit/fund disabled, no lock change.
All 95 recorded verification identities, including gate shells, were absent at
final readback, with no owned listener. Receipts remain in the worker's ignored
`test-results/r17-focused-gates`; its final handoff records precise source scopes.

NPC browser preparation (14 grouped receipts / 18 screenshots) remains **unrun**.
Its inherited executable asset helper is independently bound to reviewed Git OID,
actual checkout-filtered/raw bytes, root equality and explicit staged/unstaged/
unmerged/index proofs before dynamic import and after bundling. Current/immutable
NPC source binds exact reviewed `7137fad`, not arbitrary HEAD. Actual visible
Campaign shared badge is required before recording that simulated provenance.
Fresh root full check/build, NPC UI and ASI reacceptance follow this integration;
worker gates do not accept the combined candidate. P1a source review found five
finite closure/admission defects; corrections remain isolated and unintegrated,
Auth unavailable/all readiness false. No SQL execution, hosted write or publication.

### Canonical ASI UI acceptance — 2026-10-12 18:47 UTC

Clean root `7ff61851440581710cc6de1dfe1900e6c820ead9` passed a fresh synthetic
production build, then `npm.cmd run test:e2e -- --config e2e/local-asi-parity/playwright.config.ts`:
**44 desktop/mobile cases / 226 recorded assertions / 46 screenshots** in 1.9
minutes. All 44 font receipts record real loaded production faces; compiled CSS,
actual generated HTML font classes, Next navigation rethrow, exact reviewed
dependency blobs and every bundled project input/lock/build/source were bound.
Page errors, blocked remote requests, unexpected requests/calls and failure are
empty. One private Chrome/HTTP/control-port run closed both ports/browser; all
163 observed process identities were absent at gate readback. Original three
failed attempts remain archived with their source/status and failure artifacts.

Independent root corrections `b231e9a`, `ddc4ecf` and `7ff6185` address desktop versus
hidden-mobile control scoping, the actual named spell Cast button, and native
pending ability-navigation refusal. Product, fixture/RNG, immutable data and
original gameplay/draft/recovery expectations are unchanged. Native pending
background controls, explicit ability retry/remount, real crit dice, permanent
versus temporary CON/HP, preparation/casting/rest and retained callback/print
refusals all passed in both viewports. Independent dice/toggle remain usable when
dependent ASI evidence is unavailable. Root inspected six representative actual
desktop/mobile cast, class prerequisite, unavailable sheet, draft and print preview
screens; controls/text were readable within the tested layouts.

Auth, inbound counts/grants, transport/CAS/navigation/print invocation and one
named accepted critical result are explicitly simulated. Actual native RNG runs
first and its original result is retained; no injected RNG or mechanical calculator
substitution. This does not accept real ServerAction HTTP, SQL/RLS/atomic snapshots,
historical lineage/writer authority, hosted accounts or the complete app shell.
C1 class role/save-prefix producer/consumer work remains open. Print-preview
screens do not prove full PDF page layout or native dialog behavior.

At the same `7ff6185`, fresh print gate passed **six A4/Letter exports** in 5.6
seconds (nineteen identities/readback empty). pypdf/pdfplumber/Poppler verified
privacy, complete long-list markers, dimensions/margins and rendered all **33
pages**. Current caster and long-Letter contact sheets were visually checked;
all six sheets had been inspected at unchanged print-product `c29c368`. Fresh
PDF/script hashes and recorded renderer/QA process metadata are retained, with
empty PID readback. These remain loaded context-shim print fixtures and local
print CSS, not a latest atomic database snapshot or other-engine acceptance.

Latest full combined gate remains **317 files / 3,885 tests** at `df8c303`; the
later harness source has exact review/build/actual UI acceptance. Repeat full
combined acceptance after the next integrated source freeze before finishing.
R17 core `4c077c6` passed independent source review; harness `346c5b6` is under
separate review. Its isolated worker now owns serialized locked installation,
meaningful failing-before/parser/ref/character controls, focused tests/type/lint.
P1a private staged source is still being prepared without SQL execution. No
deployment, hosted write, runtime provision or publication occurred.

### Latest combined gates and continued UI iteration — 2026-10-12 18:34 UTC

Clean `df8c303dbb92275c1649311e165d492e31c43df1` passed typecheck, zero-warning
lint and **317 files / 3,885 tests** with four workers in 176.02 seconds; 362
observed identities/readback empty. Its fresh synthetic production build passed,
23 identities/readback empty. Earlier same-source full run omitted the established
worker limit: **315 files / 3,883 tests passed, two tests failed**, no unhandled
errors, 458 identities/readback empty. Failures were a five-second actual-client
bundle timeout and a missing asynchronous monster form response. Both original
tests passed unchanged in the two-worker focused reproduction (**20/20**, 11.75
seconds, nine identities/readback empty). The four-worker full rerun then passed.
Failed receipts are retained in external history; runner now defaults check gates
to four workers when unset. No production or test oracle change was made for
these resource-sensitive failures.

ASI rerun at `df8c303` passed **twelve desktop cases / 71 assertions**, including
native fieldset/descendant disabling, no pending duplicate/navigation, rejected
background recovery and actual weapon crit. Casting preparation stopped before
any write: an unscoped title locator matched both desktop and hidden mobile
Unprepare buttons. Failure DOM/screenshot/journals and build/source/font hashes
are preserved; private ports/browser closed, 121 identities/readback empty.
Root `b231e9a` scopes actual desktop tab controls to the unique visible sheet grid,
retaining StatRibbon and native mobile scopes, all original assertions and source
guards. Independent exact review approved it; fresh build-bound UI is next.
**44-case/46-screen acceptance remains open**. Full check is accepted at `df8c303`,
not this later harness iteration; repeat combined acceptance after source freeze.

R17 library NPC plan `ecf5ccf` initially failed independent review because generic
record effects would reach the existing character evaluator. Amendment `b4c55a55`
passed review: narrative NPC current/immutable envelopes require explicit empty
effects before defaulting; malformed/nonempty evidence is rejected intact. Bounded
schema/canonical parser/category/profile and actual parser/ref/character/UI controls
proceed in new isolated `r17-library-npc-worker`, branch
`codex/r17-library-npc-plan-20261012`, base `df8c303`. Existing character relationship
privacy/copy remains intact. Private authoring, import/sharing, campaign DM instances,
lifecycle, exact-pin deletion and G2 remain later children. No hosted catalog rows,
schema or runtime were changed. P1a additive source remains in progress separately.

### Latest integration awaiting fresh combined gates — 2026-10-12 18:23 UTC

Independent P1 amendment review approved `cf69b854`; original plan `48d9256` and
amendment are integrated as `32d56ad` / `1d2ceea`. Both metadata-only revision and
bootstrap revision-zero contradictions are resolved in the contract. Additive
P1a private storage/admission/finalizer source proceeds in its isolated worker;
the joint R09 revision branch, actual producers/materializers, full writer fences,
versioned multi-hop lineage bridge and G2 are future dependencies.

The ASI failure was confirmed as an oracle error: installed Playwright excludes
FIELDSET from `isNativelyDisabled`, while the captured actual fieldset is disabled
and busy. Independently reviewed `871ccbd` is integrated as `1ca8bf3`; it checks
native reflected state, effective descendant disabling, pending no-second-action/
navigation behavior, and rejected-save recovery without changing product source
or the original draft/raw-data assertions. Full 44-case rerun remains pending.

Reviewed R09 source `5367243` / `6662133` / `f9891e4` is now integrated as
`8c393f4` / `7845c1b` / `77cb820`. Worker reproduced three substantive received-v2
failures against exact old product bytes, then restored exact hashes. First narrow
run preserved one collection failure with 139 tests passing; reviewed marker-only
test isolation `d1bd508` (root `46f0e38`) corrected it. Final worker **five files /
185 tests**, typecheck and zero-warning lint passed; every owned process/listener
readback was empty. Evidence handoff `5bdd9c1` is integrated as `ccd3bb3`.
Actual ASI and frozen-spell validators remain real imports. Staged SQL is unapplied,
Auth unconditionally unavailable and all thirteen readiness families false.
Fresh root check/build/UI is next; individual worker gates are not combined
acceptance. No SQL/runtime, hosted write or publication occurred.

### Combined acceptance and first canonical UI run — 2026-10-12 18:17 UTC

Independently reviewed ASI harness freeze `dddff0d`, including actual recovery and
guidance blob bindings, is integrated as `c887238` / `9965d8d` / `c29c368`.
Clean root `c29c368080088f2ddffd0b0cefe05014b89d90dd` passed `npm.cmd run check`:
typecheck, zero-warning lint, **314 files / 3,775 tests** with four workers
(175.10 seconds). The synthetic production build passed in 35.34 seconds.
Check observed 371 process identities; build observed 24; both readbacks were empty.
These replace the historical full-suite failure as current local suite evidence.

Root-only ASI asset binding verified actual generated login HTML font classes,
three production CSS files, nineteen assets and exact clean build/source receipts.
The first `npm.cmd run test:e2e -- --config e2e/local-asi-parity/playwright.config.ts`
run preserved **ten completed desktop scenarios / sixty assertions**, then failed
at pending background selection: Playwright's fieldset `isDisabled()` returned
false while the actual page showed saving and a draft notice. This is under
investigation; no full 44-case acceptance is claimed. Original failure screenshot,
DOM, journals, source/asset/font hashes and ten-case evidence remain in ignored
`test-results/asi-parity-local`; external gate receipts are in sibling
`verification/launch-20261012/asiparity.*`. The runner closed its private HTTP and
browser control ports/browser; all 124 observed process identities were absent
at gate readback. No RNG/log/state/spell/print writes occurred in the failed
background scenario. Next: independently review the cause/correction, rebuild
and rebind the changed exact source, then complete desktop/mobile cases.

At the same clean `c29c368`, `npm.cmd run test:e2e -- --config e2e/print/playwright.config.ts`
passed **six exports** in 5.1 seconds, twenty identities/readback empty. Fresh
Letter/A4 martial, caster and long-content PDFs contain **33 pages** (2/2/12/13/2/2).
Bundled pypdf/pdfplumber/Poppler checked privacy, complete end markers, page sizes
and at least twenty-point margins, rendered every page, and produced six contact
sheets. Root visually inspected all six sheets and a full caster page: readable
tables/lists, deliberate page breaks, no clipping. PDF hashes, QA script hash,
recorded renderer PIDs/parent/command/cwd/observed starts and empty PID readback
are in `test-results/character-print/qa-*.json`. OS birth was not captured for
the short QA renderer jobs. These are loaded-value/context-shim print fixtures,
with locally bundled print CSS; no atomic/latest database snapshot, live account,
native print dialog or other browser-engine acceptance is claimed.

R09 worker frozen `f9891e4` earned-graph/shared-ASI/spell/version-time binding is
independently approved as disabled staged source only and is not integrated.
Focused actual-consumer/model controls and typecheck/lint are next; SQL/Auth
authority is untested, Auth remains unavailable and all thirteen readiness
families false. P1 producer plan `48d9256` is held for a joint metadata-only
revision bump, distinct INSERT/bootstrap revision/finalizer contract, and explicit
copy-of-copy original-confirmation versus immediate-copy lineage. These ordinary
source refinements continue independently of G1/G2. No SQL/runtime, hosted writes,
deployment, remote publication or new approval occurred.

Updated 2026-10-12 UTC. This is the single durable development backlog and completion ledger. [CODEX-ORCHESTRATOR](CODEX-ORCHESTRATOR.md) is the operating entrypoint; [ROADMAP](ROADMAP.md), [PRD](../inkborne-prd.md), [GAME-PLAN](GAME-PLAN.md) and existing specs define requirements. The October 11 bounded queue is complete; the project is not. The active continuation above includes local product changes; no runtime, hosted database or publication action has occurred.

## Finite scope and decisions

**User-selected project-wide objective:** complete ALL documented M1-M8 milestones (including M5.5) and account for every documented PRD requirement, including P1-P3. Every documented ambition must have an explicit included/completed/deferred/out-of-scope disposition; all included requirements must be accepted. Deferral or removal requires an explicit dated Victor decision, remains visible, and cannot be described as implemented. No documented requirement disappears merely because it was not selected for an earlier beta. This finite documented scope is not a license to invent new features.

**Selected execution sequence:** Victor's 2026-10-13 priority is M1–M6 (including M5.5), then M8; continue the current R06 builder workstream first as recorded in the [current execution path](#current-execution-path). M7 PDF importing is paused in the backlog. This supersedes active PDF-before-beta execution without inventing a new post-beta deadline or silently completing/dropping R22; reconcile its beta disposition explicitly before launch. Daggerheart and public publishing remain explicitly deferred from first beta. Monster/NPC import work is paused separately within M5. Already-shipped narrative/wiki functionality is retained. Unselected P1-P3 contracts remain explicit open decisions; no blanket exclusion or acceptance is inferred.

| Decision | Conflict / concrete choice | Recommended resolution and execution effect |
| --- | --- | --- |
| S1 | Launch sequencing | Updated by Victor on 2026-10-13 (America/Phoenix): focus M1–M6 including M5.5 before M8; M7 is paused. No launch or deployment authorization is implied. |
| S2 | Daggerheart / second-system timing | Victor explicitly deferred Daggerheart from first beta on 2026-10-12 UTC; retain R24 in project backlog. Preserve system-agnostic architecture; generic schemas do not prove second-system play. |
| S3 | Public publishing timing | Victor explicitly deferred public publishing from first beta on 2026-10-12 UTC; retain R26. Private/campaign sharing continues; public visibility/redaction/licensing/moderation still needs a later contract. |
| S4 | M7 PDF importing | Victor explicitly paused M7 on 2026-10-13 (America/Phoenix), superseding the earlier active before-beta instruction. Retain R22 and its future input/extraction/review/commit requirements; no work or input-matrix prompting until resumed. Character PDF export is distinct. |
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
| M2 visual implementation: R05 | yes / offline+H / yes / H / H, current open | [Journey references](design-briefs/design_handoff_journey_alpha/README.md), merged #67 and historical 53 offline checks. Current desktop/mobile/tablet auth/dashboard/builder/sheet journeys and accessibility still require acceptance after later gameplay changes. Preserve the established design. |
| M3 builder + gameplay foundations: R06-R09 | P / local+model+H / P / H / open | **Current workstream: R06 builder**, with the exact continuation above; this is the work previously called `M1/R06`. [Gameplay plan](specs/2026-07-15-m3-gameplay-foundations-plan.md), [durable gaps/contract](specs/2026-10-11-durable-roll-state-contract.md), [equipment evidence](handoffs/2026-10-11-equipment-postgres-wasm.md). Core play is present; atomic equipment/full-trigger/concurrency and durable roll/state outcomes remain. Fresh real builder-to-play acceptance required. |
| M4 homebrew/import/compendium: R10-R15 | P / local+H / P / H subset / open | [Spell](specs/2026-07-20-m4-private-homebrew-spell.md), [feat](specs/2026-07-21-m4-private-homebrew-feat.md), [background](specs/2026-07-21-m4-background-authoring-sharing.md), [compendium](specs/2026-07-22-closed-alpha-feedback-and-compendium-contract.md), [MPMB parity](specs/2026-07-21-mpmb-representative-parity.md). Remaining authoring families, magic-item owner/version/pin/race acceptance, sharing/custom-type decisions and supported importer coverage; don't declare whole M4 shipped. |
| M5 monsters/library NPCs/companions/sidekicks: R16-R19 | P / local+model / P / - / open | [Roadmap M5](ROADMAP.md), [monster plan](specs/2026-10-12-monster-foundation-plan.md), [NPC plan](specs/2026-10-12-private-npc-authoring-plan.md), [companion plan](specs/2026-10-12-companion-library-foundation-plan.md). Library/private authoring and read-only companion templates have local acceptance. DM monster instances are staged/default-off with 134 focused passes and three UNVERIFIED stress requirements; their 44 browser cases and native authority remain open. Playable NPC actors, companion lifecycle/transformations/summons and sidekicks remain. Monster/NPC imports are paused; existing story relationships retain their identity. |
| M5.5 campaigns + narrative: R20 | foundation / local+H / yes / H / H, current open | [Campaign design](specs/2026-07-19-campaign-foundation-design.md), [backlinks](specs/2026-07-19-campaign-backlinks-design.md), [timeline/relationships](specs/2026-07-19-character-timeline-relationships.md). Reaccept real DM/player membership, private/shared content, copy/assignment and revision conflicts on candidate. Optional publishing/presence remain S3/S5 decisions. |
| M6 advanced spellcasting: R21 | P / local+model+actual acquisition / P / H subset / open | [Inventory](handoffs/2026-10-11-m6-advanced-spellcasting-inventory.md), [Arcane Recovery](../lib/rest/arcane-recovery.ts), [accepted bonus acquisitions](handoffs/2026-10-23-bonus-spells-and-lore.md). Slots/source/subclass math and ordinary recovery have local acceptance. Arcanum, Mastery and Signature **acquisition** save/reload locally; do not queue those choices again as unimplemented. Their durable advanced free-cast/payment/usage/recovery, copy and native authority acceptance remain open. |
| M7 PDF import: R22 | -/U / - / - / - / paused S4 | Victor paused M7 on 2026-10-13. Retain [Roadmap M7](ROADMAP.md) and [import architecture](../lib/import) requirements for later resume: supported extraction -> review/repair -> immutable commit -> calculation parity. No current implementation or layout prompting. |
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
| R06 M3; PRD §2/§3 | D&D 5e 2014 builder/calculations/races/classes/background/level-up. [A1](handoffs/2026-10-11-a1-ability-integration.md), [race representation](handoffs/2026-10-11-r06-race-representation-local.md), [native multiclass/class-choice acceptance](handoffs/2026-10-23-multiclass-and-class-choices.md), [bonus/Lore actual app acceptance](handoffs/2026-10-23-bonus-spells-and-lore.md), [Fiend/removal actual app acceptance](handoffs/2026-10-23-fiend-and-class-removal.md), [ordinary save recovery](handoffs/2026-10-23-builder-save-recovery.md), [correction/Draconic/parent evidence](handoffs/2026-10-24-builder-correction-and-casters.md#latest-continuation--2026-10-26-2103-utc). I=P/T=focused+actual local app+native/G=yes bounded patches/H/A=hosted open. | Fighter/Cleric complete builders, Rogue/Bard Expertise, native Fighter → Cleric acquisition/progression, five class-choice families and all 14 special bonus-spell groups/Lore skills save/reload with exact pins, roles, budgets, pruning, receipts and ordering. Fiend expanded candidates and secondary removal/re-addition also pass actual save/reload; the original class stays fixed. Ordinary save-response/reload recovery passes three actual local stories and 14 native snapshots, including absent retry and a retained HP draw. Fiend historical correction/recovery and Draconic immutable HP/AC/retained-die stories now pass actual local acceptance. Finite creation choices now use eligible dropdowns with visible retained unavailable picks; 392 focused and 27 simulated-persistence browser scenarios pass. Parent installation, genuine Fighter4 preparation, 34 native outcomes and eight actual contention scenarios pass. Current-state parent acceptance passes at13dde07c, including positive edit/reload, native guards/contention/HTTP and Fiend correction/replay. All fourteen current creation journeys (all twelve classes, including ancestry/A4 and A5/A6 concurrent saves) are accepted compositionally at the exact sources in the current handoff; the finite creation verification slice is complete. Historical parent/A4/F3 upgrade/installer chains, broader combinations/writer/lifecycle closure and hosted/provider acceptance remain open. Next Character Flow product action is the existing R08 Bardic Inspiration capacity finding. Legacy race dual arithmetic stays visibly preserved. |
| R07 PRD §5; M3 | Equipment/custom inventory/equip/currency, atomic starting awards/copy. [Inventory](../lib/supabase/inventory.ts), [staged SQL/readme](../supabase/staged/README.md), [45-case executable test](../tests/supabase/starting-equipment-postgres.test.ts). I=staged/P/T=model+offline/G=yes, gate off/D=-/A=open. | Full migration/grants/triggers, per-write rollback, concurrent same/different intent, ownership/pin/copy races, replay after consumption and lost responses. No fabricated legacy eligibility/receipts. E1 runtime + approved legacy policy; rollout after actual acceptance. |
| R08 PRD §3/§4/§9; M3 | HP/temp HP, death saves, conditions, dice/logs, cast/slots/resources, effects/concentration, rests/hit dice. [Provider](../lib/character/character-context.tsx), [sheet](../components/sheet), [core checks](handoffs/2026-10-11-orchestrator-local-queue.md). I=yes/P/T=offline+H/G=yes/D=H/A=current open. | Real multi-class play/rest/roll/calculation scenarios, pending/failure/conflict/reload/offline/expiration paths, no silent duplicate or lost spend. Do not confuse a simulated router/provider with hosted success. |
| R09 M3 safety/D1 | Durable rolled action + revision/dependency/old-writer participation. [Contract and executable gaps](specs/2026-10-11-durable-roll-state-contract.md), [current gap tests](../tests/supabase/durable-action-current-gaps.test.ts). I=proposal/T=characterization/G=proposal/D=-/A=open. | Implement one hit-die command locally with operation identity/receipt and revision/dependency checks; prove rollback/lost-response replay/ABA/legacy-writer behavior, then reviewed death-save/concentration adapters. Local SQL-file edits/tests are ordinary work; actual DB/security execution uses G2/G3. |
| R10 M4/PRD §7 | Spell/feat/background forms, immutable versioning, private + campaign sharing/discovery/revocation. [Forms](../components/library), [server boundaries](../lib/supabase), linked M4 specs above. I=yes/T=local+H/G=yes/D=H/A=current open. | Actual owner/non-owner, stale-version races, historical pins after edit/revoke, Library/builder/sheet effects parity. Preserve platform/personal/exact-campaign authorization and calculations. |
| R11 M4/PRD §5/§7 | Reviewed/integrated private magic-item authoring, draft retention and raw effects preservation. [Original magic-item worker evidence (legacy ID M1)](handoffs/2026-10-11-m1-magic-item-revalidation.md), active combined receipts above. I=yes/T=local+12 offline/G=yes/D=-/A=open. | Actual two-owner discovery, immutable v1/v2, historical inventory pins and competing expected-version writes remain unaccepted. Candidate final gates must include later shared consumers; the old worker's standalone pass is historical. |
| R12 M4/PRD MVP | Bounded private item/weapon/armor/core-race/trait/standalone-passive-feature forms are reviewed/integrated with local form acceptance. Class/subclass, feature application/relations/advanced mechanics and advanced race relations remain. [Core race evidence](handoffs/2026-10-11-r12-private-core-races.md), [schemas](../lib/schemas). I=P/T=local+offline forms/G=P/D=-/A=open. | Real owner/version races and pin continuity; exact race dependency manifests/atomic selection. New class authoring needs proven original-primary role and classified starting-save grants before meaningful creation. Private owned-book entry is retained; no guessed relations, effect deletion or public distribution promises. |
| R13 M4 | Cross-type sharing, Homebrew filters/search/sort, custom-content-type registry UI. [Homebrew domain](../lib/homebrew), roadmap M4. I=P/-/T=P/G=P/D=H subset/A=open. | Extend selected type contracts without weakening isolation; verify registry-defined fields/evaluator compatibility and explicit unsupported mechanics. Public sharing is S3/R26, not implied by campaign sharing. |
| R14 M4 | MPMB upload/static parse, validation/repair, audit, keep-both/replace, mandatory calculation preview and exact-pin character exit. [Parser/mapping](../lib/import/mpmb), [parity spec](specs/2026-07-21-mpmb-representative-parity.md), [T1](handoffs/2026-10-11-t1-e2e-drift.md). I=P/T=offline+H/G=yes/D=H/A=supported cases H, current open. | Publish explicit supported type/fixture matrix; extend documented gaps only with original schema/source evidence. Unsupported effect-coupled/candidate-less cases fail closed. Current owner/isolation/stale-preview/replace/race/calculation and builder-to-cast parity on a real approved target. Field-level merge was deliberately out of scope. |
| R15 M4 | Entitlement-aware encyclopedia for all authenticated players/DMs. [Compendium contract](specs/2026-07-22-closed-alpha-feedback-and-compendium-contract.md), [Library tests](../tests/app/library-page.test.tsx). I=yes baseline/T=H+local/G=yes/D=H #96/#97/A=H, extensions open. | Platform/private/campaign visibility and legacy redirects/state preservation current UAT; every new M4/M5 type joins the same catalog rather than DM-only browsing. |
| R16 M5 | Reviewed monster schema/read-only stat block/catalog and private authoring are integrated. Foundation 206 focused/20 geometry controls plus authoring 127 focused/28 actual-form controls passed at their stated sources, including mobile grid and transport/recovery fixes. [Design scope](specs/2026-10-12-monster-foundation-plan.md). I=P/T=local+offline/G=P/D=-/A=open. | Supported import and DM campaign instances remain. Actual owner/player/DM/privacy/version/CAS acceptance and authenticated-shell geometry remain separately required; local action/persistence simulations do not fill them. |
| R17 M5 | Strict narrative schema, effects fence, Library/profile and private create/edit integrated. Worker 95 authoring tests; root 329-file check plus 18 form cases/20 screens at `10b06c8`; Library 14 controls at `42abdbb`. [Authoring handoff](handoffs/2026-10-12-r17-private-npc-source.md). I=P/T=local+offline/G=P/D=-/A=open. | Import, real entitlements/owner/version races and campaign DM instances remain. Existing character relationship privacy/copy unchanged; simulations do not prove actual writes or authority. |
| R18 M5 | Character-tied companions (mounts, beast forms, summons). [Foundation plan](specs/2026-10-12-companion-library-foundation-plan.md). I=integrated template source/T=77 worker tests and 22 offline cases/G=bounded local/D=-/A=open. | Read-only templates do not complete hybrid ownership/lifecycle, character/campaign linkage, controller/copy/visibility, transformations or summon dependencies. Actual role/persistence/denial acceptance remains; freeze rule contracts before automatic mechanics. |
| R19 M5 | Expert/Spellcaster/Warrior sidekicks. [Roadmap](ROADMAP.md), [builder domain](../lib/builder). I=-/U/T=-/G=-/D=-/A=open. | Simplified archetype/level schemas and render/build/play behavior; entitled catalog/DM use and isolation/level/progression tests. Do not equate generic full-PC code with accepted sidekick rules. |
| R20 PRD §6/§8; M5.5 | Campaign membership/roles/invites/assignment; rich backstory/personality, wiki/backlinks/timeline/relationships/secrets. [Campaign spec](specs/2026-07-19-campaign-foundation-design.md), [DM-note boundary](specs/2026-07-19-character-dm-notes-boundary.md), [narrative](../components/narrative). I=foundation/T=H+local/G=yes/D=H/A=current open. | One real DM/player campaign with linked characters/wiki; permitted read-only DM view, privacy, conflicting revisions, copy/leave/removal/invite rotation and portrait/storage permissions. Optional live presence/public wiki waits S3/S5. |
| R21 M6 | Reviewed single-source slots and per-acquisition casting math are integrated; [M6 inventory](handoffs/2026-10-11-m6-advanced-spellcasting-inventory.md), [source casting](handoffs/2026-10-11-source-casting-ability.md). I=P/T=local+slots browser/G=P/D=H subset/A=open. | Subclass profile plan must preserve shipped object-tier grants; advanced exact selected-spell payment/usage choices and current real conflict/recovery acceptance remain. Retain Arcane Recovery; no duplicate counter or guessed subclass unlock. |
| R22 M7 | Supported PDF content import through reviewed M4 pipeline. [Roadmap](ROADMAP.md), [import domain](../lib/import). I=-/U/T=-/G=-/D=-/A=paused S4. | Paused by Victor on 2026-10-13. Retain finite layouts/types/fixtures, extraction/provenance, correction, validation and atomic immutable commit for later resume; no active PDF importer work or decision prompt. |
| R23 PRD §10 P0/MVP | Owner print/PDF snapshot is integrated; six Letter/A4 fixture PDFs, 33 inspected pages and privacy/margin checks passed. [Sheet source](../components/sheet), active receipts above. I=yes bounded/T=local PDFs/G=yes/D=-/A=open. | Reaccept after calculation changes, then real approved-account snapshots/native dialog and supported browser/device behavior. Loaded values are not an atomic DB snapshot. Character JSON/fillable-standard/campaign exports remain separate undecided ambitions. |
| R24 PRD §2 P0/MVP | Second playable SRD system (Daggerheart) and schema/system selection. [PRD](../inkborne-prd.md), [system schema](../lib/schemas/system.ts). I=generic registry, second U/T=generic/G=P/D=5e only known/A=deferred first beta S2. | Victor explicitly deferred first-beta Daggerheart on 2026-10-12; retain total project backlog. Later approved system/content/version/license matrix and end-to-end creation/calculation/sheet/homebrew/print fixtures without 5e leakage remain. |
| R25 M8 | Current performance, accessibility, onboarding and feedback-driven polish. [Roadmap](ROADMAP.md), [design references](design-briefs), [alpha records](alpha). I=P/T=P/G=P/D=H/A=open. | Measure representative current routes/data shapes/devices, agree budgets from evidence, resolve material findings; test signup->builder->play->recovery plus accessibility, register real feedback/disposition. No made-up users, load results or blanket “polished” verdict. |
| R26 PRD §7; M4/M8 | Public visibility/publishing, copyright/licensing/redaction/moderation contract if selected. [PRD](../inkborne-prd.md), [sharing decisions](GAME-PLAN.md). I=-/P/T=-/G=-/D=-/A=deferred first beta S3. | Victor explicitly deferred first-beta public publishing on 2026-10-12; retain total project backlog. Later contract must cover owner controls/default-private, explicit consent, withdrawal/version preservation, redaction and abuse handling. Private owned-book entry is not public distribution authority. Repository license choice remains an owner decision. |
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

The live queue is the [current execution path](#current-execution-path), not the
old October 12 R11 integration plan. That magic-item integration is already
recorded above; its legacy worker ID M1 is not a new milestone-one task.

1. Refresh the authoritative checkout/status and read the latest linked handoff.
   Resume its first ready R06 dependency; preserve accepted slices and failures.
2. Reuse existing human authorization and the exact resource/runtime guards.
   Batch only genuinely missing scope/access approvals into concrete packages.
   G1/G2 history is not a reason to restart or provision another environment.
3. Require the evidence appropriate to the changed behavior: source tests do not
   replace actual native/browser acceptance. Continue unaffected ready local work
   when one access/resource lane is blocked. Do not repair live history.
4. Continue remaining M1–M6/M5.5 requirements, then M8, under the selected scope.
   Retain M7 and creature-import pauses without layout/contract prompting now.
5. Accept the frozen candidate and release only after real workflow, privacy,
   recovery, operations and explicit publication/deployment/sign-off gates pass.

## Grouped approvals: exact operation, target, risk, cleanup

These October 12 operation categories retain external-action boundaries, not a
current setup queue or live availability report. G1/G2 subsequently received
authorization and actual local execution evidence above. Reuse valid human
authorization and the current handoff's exact target/resource manifest; do not
restart setup, copy an obsolete port/fixture budget or ask for the same approval
because of the historical templates below. Prepare a fresh concrete package
only where a genuinely new external action needs it. Local source/SQL-file
edits, focused tests, planning and local commits need no invented approval.

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
