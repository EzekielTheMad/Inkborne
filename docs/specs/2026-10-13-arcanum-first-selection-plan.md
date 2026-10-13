# M6 Arcanum first selection — proposed disabled producer/read/storage contract

2026-10-13. Read-only discovery used frozen root9f848d4658ac9c523d548d51c0f5a19710de95d8.
This recommendation is NOT an already approved storage contract or live authority.
M5 worker basis62a86a23fa5c040cf62eb7ab475b64aefbc5e364 remains unchanged; this child
writes only this plan and its handoff. No Node/npm/tests/SQL/network/runtime ran.
Independent m1 AND original R09-owner plan challenge is required before code.

## Actual source and exact blocker

- lib/spells/advanced-binding.ts12–34/78–145 supplies advisory ready/unselected/
  unavailable from raw controller/feature/spell pins and modeled captured grants.
  Production imports are absent; only its fixtures/tests import it. Its ready result
  has payment intent, not authorization, saved binding, state patch or receipt.
- lib/spells/advanced-descriptor.ts6–33 requires the same original immutable feature
  data_snapshot.advanced_casting: strict kind/arcanum, listClass, spellLevel6–9,
  selectionCount1, castLevel equal spellLevel, usages1/recovery"long rest", no conflicting
  bonus/free/fixed casting policy. No current definition lookup may replace this pin.
- lib/supabase/content-refs.ts22–88/148–163 NOW reads feature_grant_id and count-checked
  feature grants for ASI. The older Arcanum handoff's omitted-field claim is stale.
  However parseContentRefWithContent returns the canonical parsed definition; raw
  advanced_casting is stripped by the existing feature parser. ASI complete evidence
  is not protected Arcanum producer lineage or native execution authority.
- lib/supabase/spells-server.ts15–30/76–101 returns active content/version/class tuples,
  not full grant/controller identity. Migration20260720185149_feature_spell_grants.sql
  88–112 captures class/subclass spellcastingExtra, not chosen Arcanum spells. Its
  selected acquisition version overlay deliberately stays independent (109–133).
- lib/types/character.ts79–103 contains generic resolved_choices string arrays; no
  durable exact advanced selection. There is no protected first-choice receipt/
  lineage producer in migrations/stages. Names, levels, resource slugs or readable
  historical grants alone cannot create that provenance.
- lib/spells/casting.ts33–37/297–341 and actual cast-dialog.tsx124–194 offer only
  cantrip/slot/Pact/ritual. Provider641–676 runs state-only conditional computation;
  state-writer.ts asserts current local state, not complete cross-client binding
  dependencies. Extending CastChoice now would invent authority.
- Staged hit-die-authority-and-writers.sql17–24/80–112 still unconditionally denies
  Auth and initializes all13 readiness families false. Version2 graph counts/order
  contain public refs/grants/spells, not the proposed private advanced bindings.
  P1's joint metadata event supports class-origin confirmation, not arbitrary choices.

Accepted local slots/source/subclass math does not close these blockers. Do not add
a diagnostic status UI as a substitute for advanced gameplay, reuse an ordinary
known-spell acquisition as free-cast permission, or bootstrap from legacy classes.

## Recommended durable storage and genuine revision participation

Use a NEW private captured first-selection table, not resolved_choices slugs:
private.character_arcanum_selections_v1. One immutable row per character + exact
earned feature_grant_id; selection_id is a server-generated UUID. Record exact
character/system, controller ref/content/version, derived feature ref/content/version,
feature slug/unlock, selected spell content/version, descriptor/list/base level,
original raw immutable controller/feature/spell envelopes, native accepted time,
original actor and original first-selection operation. Record the authoritative
captured grant tuple and provenance correspondence. Native constraints/closed
identity guards must prevent reparenting, rewriting or deleting to choose again.
Do not FK-cascade from catalog/controller removal; only reviewed character-lifetime
deletion may remove the selection/receipt. Historical versions stay embedded; current
source retirement or removal affects NEW acquisition/activity, not original receipts.

private.character_arcanum_selection_receipts_v1 is immutable per(character,operation),
retaining versioned canonical intent, original actor/time, selection ID, exact before/
after shared revision and source/binding readback. Preserve raw arrays/order/extensions;
do not serialize JSONB text as a cross-language canonical hash. Any digest/serialization
must reuse a separately frozen versioned protocol, with source-bound equality tests.

A genuine public choices projection is recommended solely to make the saved choice
participate in existing watched-field revision semantics: proposed
choices.advanced_spell_selections maps earned grant UUID to private selection UUID.
This stores actual choice identity, not a no-op touch or caller authority. Private
row/receipt remains authoritative. Producer atomically inserts selection, merges
ONLY that choice projection preserving all other raw choices/absence, obtains actual
RETURNING revision/order, then records the receipt. Native normal R09 trigger must
produce exactly before+1 and rebind order once; no manual counter assignment,
artificial class reorder, confirm-origin event or starting-class bootstrap inference.
Replays/definite refusals do not bump. Existing unsupported public projection edits
must refuse or make evidence unavailable; they cannot bless a forged private binding.

This projection is a PROPOSED technical policy requiring R09-owner review. Before
any positive producer can be accepted, coordinated reader/order/fence source must
include private bindings and their selected spell versions in exact required sets,
counts, dependency freshness and source-access lock unions. Do not invoke the old
reader then append lower-ordered source locks; all source lock domains require one
reviewed stable union/order. New bindings fall within character_choices/version/
refs/spell-source participation, not an invented readiness14 or mark-ready shortcut.
Frozen R09/P1 base stages remain unchanged in the first additive storage stage.

## First-selection transaction, read and recovery contract

Proposed strict internal request: command_version1, operation_id, expected shared
revision as decimal BIGINT string, feature_grant_id, spell_content_id, spell_version.
No actor, class/unlock labels, snapshot, payment count, resource key, privilege or
readiness assertions come from the caller. No replacement/respec/cast command.

Private entry derives context solely through the unavailable native verified-Auth
seam, shared exclusive writer guard and actual current-owned parent lock. Recheck
current owner/session/native expiry after waits (equality expired). Matching receipt
lookup/replay precedes ALL NEW binding/source/permission/expected-revision gates;
preserve original receipt identity/time, and reject changed canonical intent. Read
immutable receipt bytes under the owned parent; do not assume SELECT grants row-lock
privilege. NEW work must recheck native Auth immediately before acceptance as well.

For NEW work require current expected revision, complete ordered controller/derived
ref/grant closure, exact selected parent/subclass association and class-level unlock,
native same-system/version identity, protected historical canonical/materializer
lineage and current spell acquisition permission after source lock waits. Derive the
descriptor from the SAME raw feature version and selected spell level/list from the
locked immutable spell version. Preserve complete raw resource contributors before
deduplication; collision/malformed usage cannot certify eligibility. Do not reset
existing feature_uses or spend anything merely by selecting. First-choice insertion
and genuine projection/revision/order + immutable receipt are one transaction; fault
at any step rolls everything back. No sequential browser writes or alternate public
writer grant. An already bound grant refuses another first-choice operation.

Canonical admitted snapshots must be certified through the actual supported parser/
source producer contract; sparse JSONB field checks are not full canonical admission.
Current raw counts/tuple agreement alone cannot establish protected historical
winner/materializer lineage. Missing lineage, canonical admission, order or writer
proof stays unavailable, not inferred from creation timestamps/current catalog/
getUser()/caller UUIDs. No positive issuer is introduced to make examples pass.

Read projection retains original raw envelopes and complete counts for all retained
bindings/grants/controllers/derived refs/required spell versions, including inactive
entries. Every pointer has an exact unique relation and same parent/system; extra,
missing, duplicate, mismatched, malformed or legacy-unproven tuples fail closed.
Preserve original order; stable receipt/UUID metadata ordering must not reorder
mechanical sources. Readable other-author historical pins are not owner equality.
Read DTO completeness is advisory, not execution permission. Existing model can be
adapted only with explicit persisted private-spell-pin provenance, never fabricated
public ref IDs or a separately supplied descriptor.

Commit/resolve recovery retains SAME operation + immutable intent after uncertainty;
absence is not cancellation, no automatic retry/new UUID or first-choice recreation.
Accepted saved selection ID survives navigation/storage/readback failure. Future
account-scoped reload recovery without original intent is resolve-only. These are
contracts for later actual UI, not implemented by this plan or its modeled fixtures.

## Copy, lifecycle and unsupported historical data

Copies need an explicit transaction mapping from source controller/ref/grant/selection
IDs to NEW target IDs. Retain exact original spell/controller/feature versions/raw
envelopes and original selection character/operation/actor/time lineage; separately
record immediate source character/selection and the map, including copy-of-copy.
Never reuse source character/grant IDs or mint a target first-choice receipt pretending
the human chose it again. Preserve current approved copied state, including spent
feature_uses; copy cannot grant an extra free use. Removal/re-add/respec does not
erase choice history or restore a selection slot; activity must revalidate exact
current controller relation. Reordered arrays never prove new origin or entitlement.

Legacy slug choices, unpaired grants, old imported/compiler records, orphan pointers
and copies without this mapping remain explicitly unavailable. No migration/backfill/
adoption/removal or use reset is authorized. Copy/lifecycle/all-choice writer fences
are separately required BEFORE any cutover; first source child need not implement
their runtime producers and must therefore stay disabled.

## Finite next source child and ownership boundaries

After both independent plan challenges, recommend ONE sole writer for:

- NEW supabase/staged/arcanum-first-selection.sql: additive unapplied private storage,
  immutable ACL/constraints, counted raw read and actual disabled first-selection
  transaction source; exact function families read_locked_arcanum_selection_v1,
  select_arcanum_spell_v1, resolve_arcanum_selection_v1 are proposed private only.
- NEW lib/spells/arcanum-selection-schema.ts: strict internal request/receipt/read
  variants, decimal revision bounds, canonical intent correspondences and raw budgets.
- NEW tests/fixtures/arcanum-selection.ts, tests/spells/arcanum-selection-source-model.ts,
  tests/spells/arcanum-selection.test.ts and tests/supabase/arcanum-selection-staged.test.ts:
  original canonical fixtures, actual staged-body binding and distinct semantic controls.
  New model composes existing descriptor/binding validation; no production calculator rewrite.
- One bounded handoff; NO UI/DAL/page/provider/CastChoice, production feature parser,
  P1/C2/compiler/base R09 stage, public RPC, migrations, deps, legacy privilege or flag edits.

Object order must be concrete before implementation: prerequisites/owner identity
preflight→private tables/constraints/ownership/RLS→new validators/read helpers→private
producer/resolve functions after dependencies exist→immutable triggers→exact same-
transaction ACL closure. Recommend original R09 authority owner for new private
objects, subject to original-owner review; no new memberships, PUBLIC/anon/
authenticated/service_role execute, grants or GUC/current_user authority bypass.
Auth remains unconditionally unavailable, all13 readiness false. Missing coordinated
lineage/order/canonical prerequisites MUST have an explicit refusal, not undefined
forward function dependencies or assumed positive data. Source can prepare the real
transaction/storage/read seam locally; no live selection acceptance follows.

Separate coordinated child(s) must finalize genuine projection revision/order and
complete graph/source-lock extensions under original R09 ownership, all choice/ref/
grant/spell/copy/lifecycle writers, canonical/protected provenance issuer and runtime
G2 acceptance. Do not call the first disabled source child a complete producer.
Only afterward implement player-facing chooser, then one advanced CastChoice/payment
through existing effect/concentration flow and a confirmed dependency-receipted
native operation. Use spent increment+effects/concentration atomically; rest reset
remains existing behavior. Mastery/Signature require separate saved choices/payment
semantics; Signature's pooled2 counter is not two independently selected free casts.

## Measurable controls and product decisions

Source/model controls must distinguish static token/constructor checks from semantic
results; no PostgreSQL proof from models. Exercise four tiers/class unlocks, wrong
total-level unlock, same-raw descriptor, exact derived/controller/grant/selected-spell
relations, list/level/version, duplicate raw contributors, malformed/exhausted usage,
full count/extra/inactive closure, self-consistent foreign graphs and missing private
lineage. Test metadata/new-choice revision exactly+1, replay/refusal0, source/access
drift after waits, native expiry equality, changed intent, late receipt/absence,
insertion/projection/receipt fault rollback, copy-of-copy map/spent-use retention and
legacy refusal. Positive fixtures are ORIGINAL modeled producer inputs only until
real roles/locks/RI/Auth/transactions/receipt/recovery concurrency run under G2.

No new human decision is needed to propose first-selection-only private storage
and disabled source preparation. It is a recommendation for technical challenge,
not approval to change existing accounts/data. Material future decisions: offering
replacement/respec and its permitted timing/use-history continuity; any legacy
adoption/reselection or spent-use reset; fork/copy semantics that change the current
preserve-state contract. Do not silently decide or offer them. Basic chooser/evidence
recovery details are bounded implementation choices after contract approval. M6
gameplay, Mastery/Signature and launch acceptance remain explicitly incomplete.
