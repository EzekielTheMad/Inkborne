# R06 finite saving_throw_bonus consumer repair plan

2026-10-13. PLAN ONLY; independent challenge before code. Actual source inspected
through fixed root Git objects **84b1834fa07491b7f07b4deb76693cfb19535575**. Owned
Magic worker begins this plan at3085239880bde23c1adc2cf014d1e4f0611686a3, with
production/harness/tests/receipts unchanged. This is separate from the class-role
plan bd05/308; it does not activate C2, manufacture class proof or fix save_* keys.

## Grounded defect and useful first child

`00026_magic_item_enrichment.sql:120,124,140` defines numeric mechanical
`saving_throw_bonus` adds. Independently, the actual runtime producer
`lib/active-effects/helpers.ts:buildCustomActiveEffect` can snapshot a numeric
custom add targeting this stat into state.active_effects. Provider collects those
nonexpired entries, evaluates them after content and body-armor effects with
derived saved state (`character-context.tsx:397–418`), and produces
result.stats.saving_throw_bonus under the shipped schema. Conditional mechanical
effects are filtered by evaluate; static operation priority and formula-last
ordering already exist. Do not reimplement that calculation in a save helper.

Actual `getSaveModifier` in `lib/sheet/helpers.ts:56` accepts only ability/PB/grants/
save slug. `SavingThrows`, `ConcentrationPrompt` and `print-model.ts:122` omit the
evaluated bonus. With an admitted six-ability character at CON14/PB2 and an
independent renderer-key CON proficiency, the helper yields +4 despite an actually
produced/evaluated +1 bonus; intended finite repair yields +5. No hosted data or
runtime was inspected/executed; this is a source-derived baseline to reproduce.

First implementation child consumes **only saving_throw_bonus** for the six ability
saves and CON concentration, plus the same printed six save values. No generic
stat-key repair, class provenance/namespace alias, effect migration, schema/formula
rewrite or new source acquisition. It uses actual active/content effect paths;
source eligibility and existing pin/owner/ASI/write guards remain required.

Important limits: provider currently generates body-armor effects from inventory;
it does not collect arbitrary equipped ring/cloak magic-item effects. Fixing this
helper cannot prove those inventory items work. Content-ref effects and active
snapshots that actually reach evaluate are the positive workflow for this child.
Inventory participation remains a separately required source/attunement/acquisition
contract. `rollModifierKindFor` explicitly puts death_save in the existing save
dice-rider bucket, but DeathSaves currently requests an unmodified flat death roll.
Death-save numeric bonus participation/resolution/persistence is a named follow-on,
not silently included here. Do not claim all saving-throw workflows complete.

## Frozen finite numeric and availability policy

Propose a small evaluated-bonus resolver in existing `lib/sheet/helpers.ts`, returning
available with numeric bonus or unavailable with a player-facing reason. Its inputs
are the actual EvaluationResult, saved system schema and the ordered effects used
for that evaluation, not a fabricated CharacterStats object or manually summed
effect list. Canonical effect validation remains admission only; raw arrays unchanged.

- Exactly zero schema declarations for saving_throw_bonus: read own result.stats
  key. Its absence means neutral0 for the target, including an inactive conditional
  effect. Present0 and negative values remain valid. A computed target without a
  schema declaration is unexpected and unavailable; do not choose a convenient copy.
- Exactly one declaration: its actual finite computed value is authoritative,
  whether formula or base. Missing/nonfinite result is unavailable; no fallback to
  stats, rederive/reparse or default0. Duplicate declarations are unavailable.
- Validate only mechanical entries whose stat is exactly saving_throw_bonus:
  existing add/set/multiply/max/min operations require an actual finite numeric
  value; formula requires the existing nonblank expr contract. A numeric-looking
  string, dice string or mechanical grant op is unsupported for this numeric target,
  never accepted as evaluator's implicit0. Conservative refusal includes an
  unsupported raw candidate even if inactive; no condition interpretation is invented.
  A saving_throw_bonus formula with tag ac_formula is also unavailable: actual
  evaluator.ts:268–290 routes every such tagged formula to armor_class regardless
  of its stat. Its absent bonus result cannot be accepted as neutral0. Validate
  this raw routing conflict before the absence/computed branches, including when
  another numeric bonus already exists. Do not remove the tag, rerun the formula,
  change AC or rewrite the evaluator; retain the raw entry for recovery/review.
  Valid fractional intermediate operands may remain in the evaluator, but the final
  evaluated bonus and final ability+PB+bonus modifier must be safe integers.
- Existing dice/parser.ts permits plain integer modifiers, not decimal terms.
  Reject NaN/Infinity/noninteger/unsafe-integer bonus or final sum before request,
  RNG/log/DAL; never round, clamp or rewrite saved input. Safe integer decimal
  formatting fits existing expression grammar. Preserve negative/zero handling.
- Require six unique shipped ability definitions, a confirmed finite ability
  modifier (declared formulas authoritative), actual finite computed PB and exact
  renderer-key proficiency. PB is consumed once through current grant behavior.
  No PB0 fallback, save_* alias, proficiency stacking or new proficiency rule.

Keep the existing grant-only helper signature for pure callers/old C1 controls;
new actual save consumers must explicitly resolve and pass the admitted bonus.
This compatibility default is not production evidence. A missing/invalid new
resolver input must not silently select old grant-only arithmetic in app paths.
One common final-modifier admission boundary returns the numeric result or a reason;
it must not introduce different sheet/CON/print fallback rules.

Unavailable bonus/final modifier makes affected numeric save controls display
Unavailable and blocks automatic save/CON roll before side effects. A global target
failure affects all six saves; an invalid ability modifier affects that ability.
Manual CON Keep/Drop, unrelated checks/attacks/notes/inventory and existing state
recovery remain usable. Full mechanical print refuses before model/window creation
if any included save is unavailable; show a clear reason. No class-role availability
claim follows from this numeric readiness.

## Actual consumer touchset and retained callback protection

Minimal planned production paths: `lib/sheet/helpers.ts` for the bounded resolver/
final admission; `components/sheet/saving-throws.tsx` and
`components/sheet/concentration-prompt.tsx`; `lib/character/print-model.ts`;
`lib/character/ability-mechanics.ts` for a named save dependency in the existing
MechanicsRequirement; `lib/character/character-context.tsx` for current-input
provider enforcement; and `components/sheet/character-print-action.tsx` for its
retained print guard. Existing CharacterPrintView remains a model renderer.

The named dependency identifies the ability save(s), allowing later C2 to add role
readiness without replacing this numeric contract. Provider checks the same resolver
using current evalResult/schema/full ordered evaluation effects before executeRoll,
log insert or DAL. Extend the existing committedMechanics snapshot to retain those
bonus inputs, preserving current pending/reload/ownership/pin/ASI guards. A retained
popover, open concentration prompt or captured print callback must refuse after
effect/state/schema/source inputs change even when base stats are identical.
Concentration's pending-check correspondence, failure recovery, separate roll/state
write disclosure and atomic drop behavior remain unchanged.

No effect reordering/summing: content → equipped armor → active effects, existing
condition evaluation and static/formula phases remain. Apply the global bonus once
to the modifier already based on the current evaluated ability and proficiency.
`roll_save` is separate: existing collectRollModifiers appends active Bless/Bane
dice once at roll time for normal/advantage/disadvantage and concentration. Those
dice never become a fixed bonus, trigger a second application or appear as a paper
numeric modifier. Preserve original rider attribution and expiry behavior.

Builder StatPreview currently shows evaluated stats/proficiency chips, not six
numeric save cards. Do not add new builder mechanics UI for this first child;
test evaluate's saved conditional state/result and retain its existing display.
Future C2 builder save summaries must consume this same numeric boundary when
admitted role proof exists. Existing HP/temporary CON, race/ASI nonlinear ordering,
casting and R09 durable protocol stay unchanged.

## Required meaningful baseline and acceptance

First construct a rights-safe original canonical character/ref/immutable snapshot
with complete existing ASI/ability evidence and the shipped schema. Produce an
active bonus using actual buildCustomActiveEffect; feed it through actual collection,
evaluate, CharacterProvider and actual SavingThrows/ConcentrationPrompt/print model.
Before controls use old actual helper/consumers with valid positives; failures must
be the observed +4 versus +5 or omitted modifier in the real request/model, not
missing modules, unusable fixtures or fabricated direct result fields. Retain each
failure and exact finally source-byte restoration, with separate before/after SHAs.

| Finite control | Acceptance |
| --- | --- |
| Actual custom active +1; valid pinned content +1; independent proficient/nonproficient saves | CON14/PB2 +4→+5 when proficient, +2→+3 without grant; all six ability saves use global bonus once. Current no-bonus valid positives unchanged. |
| Absent, explicit0, negative; two distinct +1 effects | Neutral absent/zero retained; negative reduces; evaluator's +2 aggregate consumed once, no content/effect dedup or helper sum. Raw sources/order unchanged. |
| Existing condition true/false; inactive/expired active entries | Use actual saved/derived state and collection; true +1, false/expired neutral0; no helper predicate rewrite. |
| set/add/multiply plus formula-last; declared computed target | Consume evaluator's exact finite integer output; preserve nonlinear ordering. Unique declared computed value wins; missing/duplicate/nonfinite declarations never fallback. |
| Real evaluate of formula stat saving_throw_bonus, expr1, with/without tag ac_formula | Untagged actual evaluation produces bonus1 and the proficient CON modifier +5. Tagged evaluation has no bonus key under the shipped schema, but raw admission must make all six saves unavailable rather than accept neutral0/+4. Repeat with an existing numeric bonus to prevent a convenient-value fallback; original routing/tag/effects and AC result remain untouched. |
| Numeric-looking/dice string, unsupported op, fractional output, overflow sum | Unavailable before RNG/log/DAL/window; no rounding/clamping/default0. Valid fractional intermediate yielding integer is a positive control. |
| CON +1 and active roll_save 1d4/-1d4 | Requests retain one flat +1 contribution plus one rider occurrence/attribution; advantage/disadvantage and existing keep/drop recovery remain. Paper modifier contains no rolled rider. |
| Retained save/CON/print after active input/state/proof-only change | Zero protected side effects; original logs/state unchanged. Independent action and manual CON controls remain usable. |
| Actual desktop/mobile/print workflow | Same admitted six saves and CON modifier, native controls and truthful unavailable reason; private narrative/campaign data excluded from print. |

After independent plan challenge, scoped implementation/source review, narrow real
consumer tests/typecheck/lint, root combined checks and guarded offline desktop/
mobile actual UI. DB/Auth/actions/navigation are disclosed simulations there;
existing provider-UAT/persistence authority remains separate. No SQL migration,
dependency/install, generic dice change or test/runtime execution is authorized by
this plan. Inventory source participation, death-save numeric participation, C2
class role/legacy namespaces and real G2 remain explicitly open.
