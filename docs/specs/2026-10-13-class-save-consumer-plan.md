# M3/R06 C2 saving-throw consumer prerequisite plan

2026-10-13. PLAN ONLY, independently challenge before implementation. Discovery
reads Git objects at **84b1834fa07491b7f07b4deb76693cfb19535575**, not the moving root
checkout. Owned documentation workspace starts at clean
**671d3e7be5c02d70c08fef71e8ab018c10a17b86**; its older application source is not the
discovery candidate. Magic source, harness, tests and receipts remain frozen.
No test, Node, server, native observer, SQL, provider or network execution occurred.

## What the actual consumers do

| Fixed-root source | Observed contract and limit |
| --- | --- |
| `scripts/transformers/classes.ts:99–100` | SRD class transformer emits `grant/save_<expanded ability>/proficient`. It does not emit an indexed immutable save manifest. |
| `lib/schemas/content-types/class.ts:51`; `lib/character/structured-sources.ts` | `saving_throws` is an open string array. Structured class input contributes attacks/improvements, not saving proficiency. Selecting the first class ref for that input is not historical starting-class proof. |
| `supabase/seed.sql:10–34` | Source-shipped published2014 schema has six abilities, proficient multiplier1 and a computed PB formula. It has no six `saving_throw_*` derived-stat definitions. This is source evidence, not verification of a hosted published row. |
| `app/(app)/characters/[id]/page.tsx:262–276`; `lib/character/character-context.tsx:404–442` | Page flattens all parsed refs; provider evaluates the same content effects followed by equipped armor and active effects. Neither calls the class-role classifier or receives class-role proof. |
| `lib/engine/evaluator.ts:191–239`; `lib/sheet/helpers.ts:39–80` | Evaluator collects grant tuples; `isProficient` matches exact stat/value. `getSaveModifier` adds PB once to ability modifier for an exact renderer-key proficiency grant. It neither aliases `save_*` nor reads class declarations. |
| `components/sheet/saving-throws.tsx:26–39`; `components/sheet/concentration-prompt.tsx:65–100`; `lib/character/print-model.ts:122` | All three request `saving_throw_<ability>`; concentration requests CON. They already use confirmed finite ability modifiers and the same save helper. Current admission guards cover ASI/ability/pin/write readiness, not class role. |
| `components/character/sheet-panel.tsx:110`; `components/sheet/mobile-sheet.tsx:216` | Desktop/mobile share the actual SavingThrows component. A fix belongs in that shared consumer, not duplicated screen calculators. |
| `components/builder/stat-preview.tsx`; builder class/abilities/race/background clients | Sidebar evaluates effects and displays raw proficiency chips, not numeric saving-throw cards. Plain `content-preview.tsx:334–347` displays declared starting saves/legacy grant labels; this is catalog description, not current-character effective proficiency. |

Correct current positive: WIS14 gives +2; a valid independent feature/feat/race
`saving_throw_wisdom/proficient` grant at finite PB2 gives +4 in sheet,
concentration when CON is substituted, and print. No structured-data repair is
needed for this positive. Preserve it. Mechanical conditions affecting ability
scores/modifiers already use saved state in evaluate; declared modifier formulas
remain authoritative, without a fallback to score-floor when declared results fail.

Two separate defects must not be conflated. A legacy `save_strength` class grant
at STR14/PB2 still yields +2, rather than +4, because its namespace is unconsumed.
Conversely, canonical renderer-key starting-save grants from two class pins are
all flattened: a secondary DEX grant at DEX10/PB2 yields +2, though a genuinely
proven secondary starting occurrence should yield +0. The latter is the existing
synthetic C1 counterexample (`tests/lib/character/class-role-effects.test.ts:28–34`),
not proof of a hosted legacy SRD secondary +2 bug. No tests ran in this discovery.

Adjacent source gap: migration `00026_magic_item_enrichment.sql:120,124,140`
emits mechanical `saving_throw_bonus`. Evaluate retains that numeric target, but
the three save helpers ignore it. This plan does not silently add it or introduce
new save formulas. A separate bounded participation/ordering repair is required
before claiming those item/conditional/formula save-bonus cases work. Conditional
grant extras are not a supported condition contract: canonical grant schema has
no condition field. Preserve raw extras without inventing their execution.

## Required real evidence; C1v1 is advisory

`lib/character/class-role-effects{,-schema}.ts` currently validates an internal
claimed DTO and projects only classified secondary starting-save indices. It is
not a reader, receipt authenticity proof, producer allowlist or permission check.
At the inspected SHA no application call site uses it. The current P1 graph in
`class-origin-command-schema.ts` carries raw parent/origin/occurrences, ordered
domain refs and exact versions; it is not the C1v1 DTO. Its richer command receipts,
controller_ref_id associations and copy lineage cannot be discarded or fabricated
into the simplified C1v1 receipt shape. The graph also does not provide a complete
save-manifest/source-admission read response. C1v2 and a real reader remain needed.

Proposed **ClassSaveSourceProof v2** is a server-derived, complete-or-unavailable
read boundary, whose concrete wire schema must be challenged with P1/R09 owners
before code. It binds character ID/owner/system; shared action revision and class
command revision as bounded decimal strings; full raw origin/occurrence/root and
immediate copy/confirmation/creation evidence; exact controller and subclass
associations; all raw refs with IDs/context/choice_source/nullable feature_grant_id;
all referenced immutable version envelopes; full immutable raw manifest data,
effects/declarations/indexed entries and actual allowed producer identity; current
published2014 schema and current use entitlement; exact domain counts and stored
producer order. Preserve unknown raw keys, effect positions and duplicate tuples.
Known schema validation is admission only; do not persist stripped output.
The wire version is2, with explicit complete/unavailable status, bounded decimal
BIGINT revisions, INT4 pin versions and the reviewed finite P1/C1 JSON and row
bounds. Resolve their differing graph/collector capacities before implementing
the adapter; exceeding supported capacity is unavailable, never silent truncation.

This full proof is server-internal. Private creation/class journals, raw Auth or
acceptance records and operational evidence never become client props or paper
output. C1v2 validates them server-side, then emits a finite client calculation
projection: existing entitled public pin/source/effect arrays in their order,
six save statuses/reasons, admitted projection indices and nonsecret loaded
character/system/revision/input identity. That UI identity is a staleness guard,
not writer authorization. Changed optimistic class inputs invalidate the projection
until a fresh coherent entitled read; the browser cannot mint authoritative proof.

One coherent protected reader must prove the returned revisions/order/rows belong
to the same admitted document and recheck current ownership/use entitlement after
waits. A successful ordinary content-ref/ASI read alone cannot establish that.
Read error, missing projection, count mismatch, unavailable Auth/readiness, partial
backup, unknown producer or mismatched version is unavailable, never empty proof.
No latest-catalog lookup, browser primary flag, source order, timestamp, matching
numbers, first class choice or first array entry supplies historical authority.

Prerequisites remain P1 genuine fresh/bootstrap and explicit confirmation,
add/level/subclass/remove/reorder transactions, reviewed basic-class compiler and
immutable manifests, all indirect/direct writer participation, exact copy lineage,
and the authenticated acquisition/read/permission protocol. Current staged Auth
is unavailable and all13 writer readiness rows are false. Installing disabled
stages/default-denial receipts does not satisfy these prerequisites or activate C2.
No new class creator, empty/zero-save class shortcut, imported legacy attestation,
automatic backfill, repin, proof repair or Auth substitute belongs in this child.

## Finite consumer contract

Reuse one bounded `lib/character/class-save-consumers.ts` adapter around the
reviewed C1v2 classifier and actual source proof, not a replacement evaluator.
Its result contains original ordered source/effect arrays, an evaluation projection,
and six explicit per-ability availability entries. Only an admitted, exact manifest
entry labelled starting_save in a proven nonorigin active occurrence is excluded.
Independent class-level occurrences, subclass/feature/feat/race/manual grants,
narratives, choices, conditions/formulas, raw metadata and duplicate positions stay
ordered. Never deduplicate equal grants or infer kind from their stat spelling.

Namespace is exact `saving_throw_` plus one of strength/dexterity/constitution/
intelligence/wisdom/charisma and value proficient. Require six unique actual
published ability definitions, one proficient multiplier1 and the actual finite
computed PB at consumption; no invented derived-save membership, PB0 fallback or
recomputed PB. Unknown ability declarations/candidates or an inconsistent/missing
complete class graph make all six saves unavailable. With a complete validated
graph, missing/unconfirmed/ended origin or an invalid manifest blocks the affected
known abilities; an independent grant cannot override another untrusted contribution
to that same save. Preserve its raw contribution for review. Legacy `save_*`
participation stays unavailable for affected abilities until a separately attested
compiler/consumer policy is reviewed; no automatic alias or source migration.

Unavailable means an explicit reason and “Unavailable” instead of a numeric save
or authoritative proficiency dot; no zero/base-only substitute. SavingThrows and
CON concentration Roll controls refuse before RNG, roll-log insert or state/DAL
write. Manual concentration Keep/Drop remain available under their existing state
writer guards. Unaffected ability checks/skills/attacks, narrative/inventory and
other independent actions retain existing readiness; do not globally disable them
because a particular saving throw lacks role proof.

Extend the existing MechanicsRequirement with an explicit save-ability dependency.
Provider must enforce current committed class proof/ref/revision/manifest/schema/
state identity in its retained callback guard before executeRoll/logging/DAL.
SavingThrows supplies that dependency for each save; concentration supplies CON
and rechecks the same pending check before resolving its rolled result. Native
active roll_save riders remain collected once at roll time; no dice rider is folded
into a paper/static modifier. State changes invalidate retained callbacks even if
raw base ability scores remain equal. Print consumes the same six save results and
requires all six available before opening its full mechanical print window. An
unavailable save displays a reason on the print control, not a manufactured paper
number; its captured callback must revalidate current source identity. Preserve
existing owner/pending/pin/ASI/casting/print privacy guards.

Builder sidebar should show effective save availability separately from unchanged
catalog declared starting saves, with draft labels for optimistic local choices.
Pass saved conditional state and the same ordered projection at class/abilities/
race/background previews. Draft values cannot authorize actions/prerequisites or
seal class origin. C2 does not reorder classes or alter HP/class ordering, raw rolls,
ASI/race arithmetic, temporary CON versus permanent HP, or existing R09 protocol.
Unhandled numeric save-bonus targets remain an explicit separate acceptance gap;
any later support needs a finite target/order contract, not a generic formula rewrite.

## Smallest useful rollout and exact touchset

First establish the challenged C1v2/real source-reader dependency, using existing
`lib/character/class-role-effects{,-schema}.ts`, P1 command/confirmation schemas and
`lib/supabase/content-refs.ts` as integration boundaries. Do not guess a public RPC
name, expose private rows or treat service-role reads/structural model fixtures as
authority. Source-only adapter tests may model unavailable/complete input expressly;
the enabled production path must wait for the real producer/reader/writer gates.

Then one finite **C2.1 actual consumer child**, after those dependencies are met:

- New shared adapter `lib/character/class-save-consumers.ts`; minimal typed proof/
  availability extension to the existing class-role schema and `ability-mechanics.ts`.
- Actual reader projection in `lib/supabase/content-refs.ts`; sheet server
  `app/(app)/characters/[id]/page.tsx`, `components/character/character-page-client.tsx`
  and `lib/character/character-context.tsx` carry only the finite client projection and evaluate the
  projection once; append armor/active effects in their existing relative order.
- Existing builder step server pages/read props and clients under
  `app/(app)/characters/[id]/builder/{class,abilities,race,background}` plus
  `components/builder/stat-preview.tsx` carry availability/draft state. Do not
  turn `content-preview.tsx` catalog descriptions into effective role proof.
- `components/sheet/saving-throws.tsx`, `components/sheet/concentration-prompt.tsx`,
  `lib/sheet/helpers.ts`, existing provider roll admission and
  `lib/character/print-model.ts`/`components/sheet/character-print-action.tsx`
  use one finite save result; the latter owns the retained print snapshot guard.
  Existing `components/sheet/character-print-view.tsx` consumes the admitted model
  without a new calculator. Shared SavingThrows covers both desktop and mobile.

No evaluator algorithm/schema-formula rewrite, effect migration, SQL activation,
deps, importer, generic calculator, class authoring or source writer is included.
R09 durable calculations retain original ordered snapshot contract until separately
reviewed alignment; if that model begins depending on saving proficiency, its
source-proof fingerprint/readiness must match C2 before claiming durable parity.
Implementation must reread the installed Next16.3.8 server/client and data mutation
guides before framework changes; local guide discovery/read and Supabase guidance
were used for this plan, with the explicit no-network/no-SQL scope retained.

## Meaningful acceptance and remaining gates

Preserve old arithmetic and original fixtures first. Actual canonical current and
immutable pin parsers, actual ref reader and actual CharacterPage/provider/component
paths must construct before failing assertions; a missing-new-module failure is
not a baseline. A model SourceProof is labelled simulation, never native acceptance.

| Required control | Exact acceptance |
| --- | --- |
| Published seed schema; independent canonical feature grant | WIS14/PB2 gives +4; six definitions but no derived saves required. Independent subclass/feat/race grants and effects/order unchanged. |
| Original synthetic transformer class; structured saving_throws only | Demonstrate +2 legacy STR14 result and missing namespace participation; no falsely claimed +4 or automatic alias. |
| Proven origin STR, secondary DEX; distinct matching indices | Current renderer-key DEX10 +2 before, projected +0 after. Same-value independent DEX grant keeps +2; only proven starting index removed. Reverse class/ref/manifest fetch order does not change origin. |
| Draft/legacy/removed origin; raw or indexed declaration/version/copy tamper | Affected save unavailable; unknown/incomplete graph all six unavailable. No exclusions inferred, no reseal/backfill/repin; original raw arrays unchanged. |
| Saved conditional ability/manual formula; temporary CON; active roll_save rider | Sheet, concentration, builder saved preview and print use identical admitted state/modifier/projection. Formula failure unavailable. Rider once at roll time; permanent HP and independent ASI/race order unchanged. Numeric saving_throw_bonus gap remains separately evidenced. |
| Retained save popover/concentration/print after proof-only change | Refuse before RNG/log/DAL/window creation with unchanged raw state; no auto reroll/drop. Keep/Drop and unrelated valid rolls remain usable. |
| Missing/count-truncated/foreign/retired entitlement/read error/unknown compiler | No accepted complete proof, zero protected action writes. Legitimate zero-save manifest does not manufacture fresh/confirmed origin. |
| Real first-class confirmation/remove/reinsert/reorder/copy/indirect writer races | Separately authorized G2 proves exact RLS/ACL/current-owner/use access, atomic revision/receipt/proof correspondence, rollback/replay/response loss, immutable version and source acquisition behavior. Default denial alone is insufficient. |

After independent plan/source challenge: narrow actual consumer/component tests,
meaningful old-source substitutions with exact finally byte restoration, typecheck/
lint and root combined gates; then guarded production CSS/font desktop/mobile
offline UI with actual components and disclosed Auth/DB/navigation boundaries.
This plan performs none of those gates. C1v2, P1 producers/compiler/all writers/copy,
the real SourceProof reader, actual C2 workflows and separately authorized G2 remain
open. The first child is not class-authoring completion or beta availability.
