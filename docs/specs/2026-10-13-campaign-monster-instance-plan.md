# R16/M5 — campaign-owned DM monster instances

2026-10-13, PLAN ONLY. Sole documentation writer in r12-passive-feature-worker,
clean basis53b69fc85afa537fd3582c776a3bd9534373ee38. Frozen source inventory ONLY:
d3f5ed63778386246b6c1b440dd820a346ca92af, read through Git objects while root owns
full check. No root/worktree source writes, implementation, dependencies, gates,
network, SQL/runtime, credentials or new background work. Independent challenge
precedes code; native and hosted acceptance remain separately authorized.

## Smallest useful product boundary

An actual campaign OWNER can add one supported monster from an exact admitted,
currently readable catalog version to a DM-only roster alongside Characters.
Each instance has its own name, manually entered current HP and plain-text notes,
plus archive/restore to manage the roster without deleting recovery evidence.
Multiple deliberate instances of the same template are valid; one command cannot
accidentally create a second one. Display the original source stat block with the
existing MonsterStatBlock; keep current HP/notes outside that declared stat block.

No character row, roll, inventory, ref, class/ASI/effect, Library definition/version,
NPC relationship, companion or narrative page is mutated. No combat/RNG/damage
automation, encounter turns, summon/beast-form/sidekick logic, batch allocation,
import/M7, monster sharing/public publishing or player-visible instance state.
Other included M5 types/instances and real acceptance remain open, not dropped.

## Actual source and authority evidence

| Frozen source | Existing contract and implication |
| --- | --- |
| ROADMAP M5/R16 ledger | Monsters must be separately usable in DM campaign management; current Library/schema/authoring does not close that gap. |
| `app/(app)/campaigns/[id]/page.tsx` | Authenticated cookie getUser; campaign read under RLS; `isOwner = campaign.owner_id === user.id` chooses DM workspace/settings. Character ownership/visibility stays separate. Only this branch may query/render instance props. |
| `lib/campaigns/permissions.ts` | isCampaignOwner is exact current owner identity. Page creator permissions do not grant DM workspace authority and cannot be repurposed for instance access. |
| `00004_campaigns.sql`; `00041_campaign_authorization_foundation.sql` | Members carry dm/player labels, but private.is_campaign_owner checks actual owner. Owner membership is inserted; protect_campaign_identity forbids ordinary owner/system changes. No ownership-transfer feature is added here. |
| `lib/supabase/compendium-server.ts` | Active current catalog reads use authenticated RLS and is_retired=false; general visible union is wider than exact target campaign entitlement. A visible entry in another campaign is not sufficient for new acquisition here. |
| `lib/supabase/content-definitions-parser.ts` | parseContentVersionSnapshot→canonical envelope/type parser; monsterDataSchema is strict format1 with validated-data64KiB cap. Current monster parser accepts canonical effect arrays; it does not enforce an empty-effects instance profile. |
| `lib/supabase/homebrew-monsters-server.ts` | Published dnd-5e-2014 `.single()`, personal active owner CRUD/CAS; private creation emits effects[]. Its admitted record is not a native instance-transaction authority. |
| `components/compendium/monster-stat-block.tsx` | Takes only MonsterData, displays declared AC/HP/actions/saves/etc, escapes untrusted text, preserves ordered entries/zero modifiers. No current HP override or command execution belongs inside it. |
| `20260720171627_content_version_pinning_and_rls.sql` | Immutable snapshot envelope and source version; definition owner FK now ON DELETE CASCADE and version follows definition deletion. A new catalog FK would tie campaign instance lifetime to another owner's account/content. |
| Existing character can_use_content_version | Character-specific authorization/fallback; cannot invent a monster character/ref or use historical pin-read permission as fresh instance acquisition. |
| `supabase/staged/item-campaign-sharing.sql` | Only spell/feat/background/item sharing support; no monster sharing/API expansion is inferred. Existing legitimate shared source may be admitted only for this exact campaign. |

No new human product decision blocks this first child. Current-owner DM control,
historical snapshot continuity, explicit manual HP and reversible archive follow
the existing campaign/privacy/version conventions. Multi-DM delegation, ownership
transfer, sharing/player visibility, automated mechanics and campaign-copy/export
require separately reviewed future contracts; none are guessed into this child.

## Concrete storage and lifecycle proposal

NEW unapplied stage `supabase/staged/campaign-monster-instances.sql`. Later CLI
migration/type generation is a separate authorized stage after native acceptance.
NEW public.campaign_monster_instances:

| Column | Native semantics |
| --- | --- |
| id | UUID, DB generated on first accepted create; immutable |
| campaign_id | UUID FK campaigns(id) ON DELETE CASCADE; immutable; no reparent/copy shortcut |
| system_id | UUID FK game_systems(id) ON DELETE RESTRICT; campaign system equality checked under native parent lock; immutable |
| created_by / created_at | Native auth.uid UUID/native time of original create; immutable provenance, NOT current read authority. No profile FK that deletes evidence or blocks unrelated old-owner account lifecycle. |
| source_content_id / source_version | Immutable UUID/int1..2147483647 provenance; no FK/cascade to catalog definitions or versions |
| source_snapshot / source_digest | Exact complete locked version row JSONB + server-computed SHA256 of its native JSONB representation; immutable, arrays/order/absence/raw identity preserved. Hash is integrity/correspondence, NOT Auth. |
| declared_max_hp | Immutable integer1..1000000, derived ONLY from admitted snapshot data.hit_points.average; native guard requires exact equality, no dice/default/formula |
| name | Mutable explicit nonblank100 UTF-16-code-unit text, max400 UTF8 bytes; no implicit normalization/truncation |
| current_hp | Mutable native integer0..declared_max_hp; zero supported. No temp HP, max override, rolling or negative HP in this first profile |
| notes | Mutable plain text, empty means clear, max8000 UTF-16 units/32000 UTF8 bytes; never HTML/JSON editor/effect input |
| archived | Mutable boolean, initial false; archive hides roster entry, owner can inspect/restore via CAS |
| revision | Native bigint0..9223372036854775807, initial0; decimal string DTO only; exact+1 on changed update, no increment on genuine no-op |

Indexes: campaign_id/archived/name/id roster key and unique instance ID. No changes
to existing campaigns/characters constraints merely to supply a composite FK:
creation guard locks actual campaign/system and rejects mismatches; update guard
rejects all immutable identity/source/max-HP changes even from alternate DML.

NEW private.campaign_monster_commands_v1 stores immutable original command intent,
operation UUID, target instance, original actor/native time and exact outcome/after
revision/readback identity. Natural key(campaign_id,operation_id); one operation
with a changed intent conflicts. Instance link is deferred NO ACTION; campaign FK
cascades both subordinate instances and command history only on actual campaign
deletion. No actor/catalog FK cascade. Direct instance hard deletion is not exposed.
Native delete/history guard accepts cascade ONLY when the actual campaign is absent
under an internal all-row read; caller RLS invisibility cannot manufacture absence.
Campaign-delete RI order/rollback and profile lifecycle need actual G2/G3 proof.

Existing source edits/revocation/retirement/catalog-owner deletion never rewrite
an accepted instance or its embedded source. The current campaign owner controls
read/edit/replay through campaign authority, not original created_by. Ordinary
owner transfer is currently prohibited; any later accepted transfer must explicitly
carry these DM-only assets as part of that separate lifecycle contract.

## Source admission is a prerequisite, not caller attestation

First instance profile supports ONLY format1 monsters with an explicit empty raw
effects_snapshot array. Do not default missing effects to[] or silently drop a
nonempty effect. Effectful templates remain readable in the existing Library but
receive a clear unsupported-instance message; no automated effect semantics are
invented. Future supported effectful instance profiles remain a named requirement.

Native validation must cover every current monsterDataSchema required/optional/
null/strict-key invariant: six abilities1..30, taxonomy sizes/damage/vision/movement,
finite integer bounds, hover/fly, attack kind/reach/range/long ordering, damage
average-or-display-text, ordered sections and legendary/lair constraints. Strings
need JS-compatible UTF16 bounds and nonblank semantics, without rewriting raw text.
Original canonical parsers are reused in DAL/rendering; native source validators
are a separately reviewed implementation prerequisite, not a new generic evaluator.

Instance source budget: original Zod data<=65536 UTF8 bytes; native additionally
requires data_snapshot::text<=65536 bytes and full version-row JSONB text<=131072
bytes, bounded name/slug envelope<=200 UTF16 units. SQL's conservative text budget
can reject some JS-valid maximum payloads because of representation whitespace;
report unsupported-source explicitly, never claim exact budget equivalence or
truncate. Original >60KiB/all-fields fixtures must be measured at G2. Semantic
validator parity applies to this explicit common representable subset. Unknown
schema versions/data keys, explicit null for optional nonnull fields, partial
envelopes and malformed taxonomies fail BEFORE any command write.

NEW authenticated source-preview RPC reads an EXACT content/version tuple under
current campaign-owner/source permission locks, validates native profile, returns
snapshot+digest/max HP. Server also validates that exact snapshot through existing
parser+monsterDataSchema before showing Add. Preview creates no marker/admission
authority; commit independently repeats native reads/admission/access after waits.
No JS-admitted boolean, client snapshot, calculated HP or service-role actor input.

Fresh create requires current active definition.version equal the shown exact
source_version, complete snapshot identity/system/type/slug correspondence and
matching preview digest. Both current AND snapshot entitlement must be platform,
same authenticated owner, or legitimate shared access in THIS target campaign;
same-system published dnd-5e-2014 must be uniquely selected. No another-campaign
union, linked-character fallback, current-v2 substitution or automatic repin.
Existing instance read/update/replay uses its immutable embedded snapshot after
access loss; it does not reacquire a template. Imported/unsupported rights profiles
remain unavailable, with no importer or public distribution added.

## Native commands, authorization and shared lock order

Use a new NOLOGIN/NOBYPASSRLS/NOINHERIT function owner with no runtime CREATE or
caller membership. Cookie-authenticated DAL uses getUser and the SAME signed-in
Supabase client; SQL derives actor from existing auth.uid/current-owner convention,
never request actor UUID, user_metadata, service role client or caller GUC bypass.
Actual gateway JWT/session/RLS behavior remains G3; trusted SQL role simulation
is not its proof. Do not replace/activate unavailable R09/P1 verified-Auth seams.

Proposed concrete public functions, authenticated EXECUTE only; PUBLIC/anon/
service_role revoked, empty search_path and narrow owner source/instance rights:

- read_campaign_monster_source_v1(campaign uuid,content uuid,version integer)
- commit_campaign_monster_instance_v1(campaign uuid,request jsonb)
- resolve_campaign_monster_command_v1(campaign uuid,operation uuid)

Strict command_version1 create fields: operation_id, command=create, source_id,
source_version, source_digest, name,current_hp,notes. Update fields: operation_id,
command=update, instance_id, expected_revision decimal string and nonempty patch
subset of name/current_hp/notes/archived. No authority/provenance/source on update.
Unknown/duplicate/File controls and cumulative relevant form+intent>40KiB reject
before parse. No number conversion for revision and no unbounded snapshot request.

Reuse the EXACT existing private.lock_character_writer_guard_v1 exclusive helper
as source-access prefix; this stage therefore depends on frozen R09 authority/kernel
installation, without changing their source/readiness/roles. New runtime owner
needs separately reviewed EXECUTE plus SELECT/UPDATE(marker) lock-only guard
policies; no guard mutation. Original R09 owner must challenge this new ACL bridge.
Stable prefix after native signed-in context: shared guard; definition ID (create/
preview only), system, campaign, exact share/member source-access rows, version
tuple, then target instance on update. Use FOR SHARE source locks that block
permission changes, current parent owner/system recheck after waits. This matches
existing definition-before-campaign sharing order; do not invert it with a campaign
FOR UPDATE while waiting on catalog edits. Current campaign owner is sufficient,
membership dm labels never authorize. No alternate/optional fallback guard.

Replay prefix: signed-in user→shared guard→current campaign-owner eligibility READ
(without an early row lock)→operation lookup. If a receipt exists, FOR SHARE-lock
the actual campaign and recheck current owner BEFORE intent-conflict classification
or any receipt return. Matching receipt returns BEFORE all fresh-source/expected-
version/revision/exhaustion gates, preserving original actor/time. If no receipt
exists, CREATE acquires definition→system→campaign FOR SHARE in that order, then
rechecks ownership before further access/version locks or mutation; it never holds
a campaign lock while waiting for a source definition. Update has no catalog
acquisition and locks campaign→instance. The shared guard serializes all accepted
instance command/receipt producers; direct receipt DML is denied. Native replay/
ownership/unique-command races and any nonparticipating writer still need G2.
No global writer-ready or phantom/access/lifecycle closure is claimed.

Single atomic commit derives locked source snapshot/max HP/current owner and native
time, inserts ONE instance and ONE receipt on create, or locks instance/compares
expected_revision then updates only declared patch fields and inserts ONE receipt.
Source/member/share drift or stale expected revision refuses without partial writes.
No-op records a stable no-op outcome at the same revision; changed update requires
exact+1 and native readback. Exhausted revision refuses changed work but not replay.
No sequential insert→receipt or confirm-only read followed by unfenced creation,
catch/fallback retry, manual counter assignment or silent rollback of used evidence.

Only RPC mutation capability, authenticated owner-only SELECT RLS on instances via
private.is_campaign_owner; no authenticated DML/receipt table access. Runtime-owner
RLS/key-lock policies stay narrow. Immediate immutable/revision/source bounds and
receipt/provenance guards also protect alternate DML. Signed-out/foreign/player/
non-owner member carrying dm label cannot see instance names/notes/snapshots/counts.

## Player-facing workflow and uncertainty

Gate default-off until native schema/RLS/transaction/recovery acceptance. DM branch
on CampaignPage gets a separate Monsters section and link /campaigns/[id]/monsters.
Player branch does not fetch serialized DM props at all; controls hidden alone are
not privacy. List paginated20 summary rows (no notes/full snapshots), name search,
active/archived filter; detail loads one source snapshot on demand. No allocation
proportional to HP, duplicate “monster characters” or standalone second catalog.

Add uses same-system entitled source picker + readonly preview, then explicit
instance name/currentHP/notes. Details reuse unchanged MonsterStatBlock beneath
source name/version/provenance and distinct currentHP/notes editing controls.
Source HP remains declared, current HP visibly manual; full arrays/text/zero bonuses
preserved. Keyboard labels/focus, small viewport wrapping and long-text tails are
required; existing Library/general entitled player browsing stays unchanged.

Controlled draft/operation UUID persists while pending; disable duplicate action,
preserve values/order/native reset protections. Rejected/lost/missing/malformed
response means UNCERTAIN, never success/retry-new-operation. Explicit Check campaign
monsters resolves the SAME operation under current owner and validated intent.
Only confirmed absence AND explicit user acknowledgement permits a new manual
attempt; unknown/error remains blocked. Saved ID survives failed navigation so
retry cannot insert again. Conflict keeps draft plus Reload latest without silently
reapplying an old HP/notes overwrite. Archive/restore is explicit same CAS path.

## Finite implementation and acceptance children

1. Pure original instance/request/result/mapper fixtures and native admission
   profile proposal with actual schema/taxonomy parity controls; no app routing.
2. Unapplied staged transaction/storage/RLS/source admission/receipt/guard text;
   independent campaign/content/R09-owner challenge, strict source/model tests.
   No migration filename/CLI or SQL execution before separately approved G2.
3. DAL/controlled form/actions/list/detail/DM CampaignPage integration gated off;
   focused auth/response/conflict tests and reviewed offline actual form harness
   using current production CSS/fonts with simulated actions ONLY.
4. Separate authorized native and real browser→API→DB owner/player/private-data/
   version/access-race/lost-response/cleanup proof, then reviewed activation.

Proposed exact future touchset: new lib/campaigns/monster-instance-schema.ts,
monster-instance-form.ts and new lib/supabase/campaign-monster-instances-server.ts;
components/campaigns/monster-instance-form.tsx and monster-instance-panel.tsx;
app/(app)/campaigns/[id]/monsters/{page.tsx,actions.ts,[instanceId]/page.tsx};
minimal existing CampaignPage owner branch; new staged SQL plus staged-only type
declarations as necessary; original fixtures and focused schema/DAL/form/action/
static-stage tests and e2e/local-campaign-monsters harness. MonsterData/schema,
MonsterStatBlock, Library sources, character/ref/evaluator/NPC providers unchanged.
Narrow package tests/type/lint then root full/build/offline current UI on released
slots, independent source reviews before integration; no heavy work in planning.

Measurable positives: platform/own template exact v1 with later catalog v2, explicit
HP0/max and Unicode name/notes, two intentional same-template instances, concurrent
same-op one ID/receipt, changed-op distinct IDs, CAS no-op/+1, archive/reload/replay,
source retirement/revocation/deletion after capture retains full source/notes.
Negatives: player/non-owner dm-labelled/foreign/anonymous, other campaign/system,
missing/duplicate published system, unsupported schema/effects/null/unknown keys,
oversize/native budget differences, malformed attack/legendary fields, forged raw
snapshot/digest/actor/maxHP, changed operation intent, stale/exhausted revisions,
source catalog/access drift after waits and revoked current campaign ownership.
Inject faults at instance/receipt boundary and after commit-response loss; compare
both tables and unrelated character/catalog/campaign state. G2 barriers/locks and
expected SQLSTATE/readback must distinguish genuine denial from arbitrary failure.

Real lifecycle checks include catalog-owner account deletion and campaign deletion
with subordinate instance/receipt cascade only, no orphan/deletion of player data;
no caller-hidden-row absence shortcut. Frontend tests cover pending/native reset,
uncertainty/manual recovery/navigation failure, stale props/draft binding, mobile
control reachability and no DM data in player HTML/network serialization. Schema
mirrors/model/offline actions never count as native transaction/RLS/Auth proof.

This closes only a bounded monster campaign-management child when all its own
gates pass. It does not complete M5, imports, NPC/companion/sidekick instances,
automated gameplay, public visibility or launch. No live operation is authorized
by the plan; maintain existing G1/G2/G3/G4 separation and default-off source.
