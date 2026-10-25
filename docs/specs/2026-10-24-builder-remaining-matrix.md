# Finite remaining local builder matrix

Selected for the current **M1/R06 builder queue** on 2026-10-24
America/Phoenix. This label does not redefine roadmap M1/R01–R04. This is a
bounded acceptance plan and source audit, not executed browser evidence. No
tests, native SQL, services or hosted changes were started by this audit.
Preserve the continuation checkout, old backup, inherited worktrees and accepted
work. Vercel stays unchanged, M7/creature imports paused and all global
readiness/class-origin/hit-die gates closed.

## Coverage already accepted or queued

- Accepted complete builders: Fighter/Half-Elf/Acolyte and Life Cleric/High
  Elf/Acolyte, including actual gear, details, finish and sheet reload. The
  accepted Rogue Expertise story is bounded acquisition/pruning evidence, not a
  complete Rogue builder. See the [real SRD](../handoffs/2026-10-23-real-srd-builder.md)
  and [Expertise](../handoffs/2026-10-23-rogue-expertise.md) handoffs.
- Accepted bounded coverage includes Fighter → Cleric acquisition/progression,
  original/secondary roles, five class-choice families, all fourteen bonus-spell
  groups, Fiend expansion, secondary removal/re-addition and ordinary
  response-loss/reload recovery. Do not relabel these as full builders or redo
  them as missing work. See the [current handoff](../handoffs/2026-10-24-builder-correction-and-casters.md).
- Eight queued complete Human/Acolyte stories at level three: Bard/Lore, Life
  Cleric, Forest Land Druid, Gold Draconic Sorcerer, Blade/Fiend Warlock,
  Evocation Wizard, Devotion Paladin and Hunter Ranger. Independent spell
  budgets, options, six Saved steps, completion, reload and native provenance
  remain required. Source preparation is not actual acceptance.
- The separate queued [Draconic story](../../e2e/local-app/draconic-resilience.spec.ts)
  preserves an old v1 control across atomic publication, verifies new 23 HP/AC
  15, one retained raw d6 across reload/reselection/down/up progression, and
  original Fighter 1/secondary Sorcerer 1 native-awarded armor parity. It does
  not duplicate any of the six cases below or admit generic sheet inventory
  insertion. Its [readback](../../supabase/verification/draconic-resilience-readback.sql)
  requires all five physical row-order bijections.

The cached genuine catalog contains twelve classes and twelve corresponding
SRD subclasses, nine races and exactly four subraces: **High Elf, Hill Dwarf,
Lightfoot Halfling and Rock Gnome**. Wood Elf, Mountain Dwarf, Eldritch Knight
and Arcane Trickster are not fixtures in this catalog. The six cases below add
the six remaining races and complete the three martial classes lacking full
builder acceptance. Together with accepted/queued work they cover every listed
class/subclass/race/subrace representatively, not every level or combination.

## Exactly six additional actual stories

Base arrays below are STR/DEX/CON/INT/WIS/CHA, before racial contributions. Each
uses the real standard-array editor, Acolyte and native starting awards; no
synthetic character writes, hidden storage edits or order waiver. Finish all
six steps, open the sheet and reload. Every story checks immutable version and
source ownership, exact choices, original occurrence and secondary profiles,
receipts/history, current parent/order revision, all five row-ID bijections,
closed gates/empty capabilities and an authenticated other-account 404.

| Priority / ID | Genuine build and base array | Independent 2014 outcomes | Gate |
| --- | --- | --- | --- |
| 1 / A1 | Lightfoot Halfling Rogue 3 / Thief; `10/15/14/12/13/8` | DEX 17, CHA 9; HP 24; equipped Leather AC 14; speed 25. Four original Rogue skills, thieves' tools, two eligible Expertise picks, Thief features and naturally-stealthy provenance. | Ready after current queued acceptance and root runtime release. |
| 2 / A2 | Rock Gnome Monk 3 / Open Hand; `12/15/13/8/14/10` | CON 14, INT 10; HP 24; unarmored/no-shield AC 14; speed 35; Ki capacity 3. Exact Open Hand features, tinker tool proficiency, gnome defenses and subrace pins. | Ready. The level-three unarmored speed path is supported through structured `data.speed.walk`, despite no speed effect. |
| 3 / A3 | Half-Orc original Fighter 1 → secondary Rogue 3 / Thief; `15/14/13/8/12/10` | STR 17, CON 14; HP 33; equipped Leather AC 13. Original Fighter STR/CON saves remain; secondary Rogue gets one skill and thieves' tools, then earned Expertise. Select an original-class skill plus thieves' tools for Expertise. Menacing and Relentless Endurance remain owned racial sources. One original starting award, no secondary award. | Ready. Preserve original Fighter controller/occurrence; do not give Rogue original saves/four skills/maximal first d8. |
| 4 / A4 | Hill Dwarf Barbarian 3 / Berserker; `15/13/14/8/12/10` | CON 16, WIS 13; HP **38**; unarmored AC 14; speed 25; Rage capacity 3. Save the dwarf artisan-tool choice and Berserker features. HP is `12+7+7+3×3+3`, including Toughness once per character level. | Blocked by F1 below. Do not lower HP to 35. |
| 5 / A5 | Gold Dragonborn original Paladin 2 → Sorcerer 1 / Draconic → Warlock 3 / Fiend; `13/10/14/8/12/15` | STR 15, CHA 16; HP **48** using new Draconic root's own-Sorcerer-level bonus **1**; unarmored AC 13. Regular slots **3×L1**; separate Pact slots **2×L2**. Gold ancestry must show fire resistance. | Blocked by F2; also depends on accepted new Draconic publication. No six-level Draconic bonus and no Pact contribution to regular caster level. |
| 6 / A6 | Tiefling original Bard 3 / Lore → Wizard 2 / Evocation; `8/13/12/14/10/15` | INT 15, CHA 17; HP **31**. Regular slots **4/3/2** at spell levels 1/2/3. Earn Thaumaturgy, Hellish Rebuke at fixed cast level 2 from character level 3, and Darkness from character level 5, with racial CHA/source ownership separate from both classes. | Blocked by F3. Shared L3 slots authorize upcasting, not L3 learned spells. |

A5 has effective regular caster level `1+floor(2/2)=2`; Warlock contributes zero.
Its Paladin 2 prepares four level-one ordinary spells; Sorcerer 1 knows two
level-one spells/four cantrips; Warlock 3 knows four spells through level two/two
cantrips. Select Blade rather than Tome to keep this case's allowances finite.
Its CHA casting DC is 14 and attack +6 at total level six. HP is original
Paladin `10+6`, secondary Sorcerer `4`, secondary Warlock `5+5+5`, plus six CON
modifiers of +2 and one earned Draconic HP. A Paladin 2 → 1 → 2 checkpoint must
remove/restore only that half-caster's allowance and regular contribution while
retaining Sorcerer choices and Pact Magic.

A6 has effective caster level five. Bard 3 retains two cantrips/six ordinary
known spells through level two; Wizard 2 retains three cantrips/eight spellbook
entries, all level one, and four prepared spells. CHA casting DC is 14/+6;
Wizard INT casting DC is 13/+5. Racial spells consume neither ordinary budget
nor the Wizard book/preparation allowance. Hellish Rebuke's acquisition/cast
level is distinct from implementing its free use/recovery transaction.

## Three finite R06 source findings

These are the initial independently inspected source findings, **not actual-app
reproductions**. F1 source is now integrated in `dbafbc4`, its staged native
companion passes 41 focused checks, and the A4 browser/readback source is
registered in `79843fc`. F2 source is integrated in `3524785` with strict
ownership/consumer checks; A5 browser/readback source is registered through
`5bfc44d`. F3 TypeScript source is integrated in `0627553`, with input-type
corrections in `55640b1`; its staged native companion through `5baf432` passes
48 focused checks. Final F3 source through `40a6f84` passes all 221 focused
tests. All three actual workflows remain pending. These checkpoints do not open
their actual acceptance gates.

1. **F1 — Dwarven Toughness HP:** the genuine cached
   `responses/traits/dwarven-toughness.json` says maximum HP increases by one
   initially and at every level. [Trait transformation](../../scripts/transformers/traits.ts)
   and the prepared trait retain only narrative; enrichment supplies no HP
   declaration. [Maximum HP](../../lib/character/max-hp.ts) adds class
   contributions and only a validated subclass bonus; sheet, class preview and
   durable callers provide no ancestry HP term. Source predicts 35 instead of
   A4's 38. A finite, owned ancestry-per-character-level contract and parity
   acceptance are needed; no generalized bonus system is selected here.
2. **F2 — selected Dragonborn resistance projection:** the genuine Gold
   ancestry selection emits `grant {stat:dmgres,value:fire}`. Prepared selected
   trait data has no `dmgres`; root Dragonborn data has an empty list.
   [Evaluator defenses](../../lib/engine/evaluator.ts) union structured data
   while [sheet Defenses](../../components/sheet/defenses.tsx) reads that result,
   not generic grants. Thus the selected fire-resistance display is predicted
   missing. Fix only the proven source/projection mismatch with exact saved
   ancestry ownership, including source loss/replacement; retain the real choice.
3. **F3 — earned Tiefling racial spells:** genuine Infernal Legacy prose earns
   Hellish Rebuke at character three and Darkness at five. Current enrichment
   supplies only Thaumaturgy/CHA. The [native racial-spell compiler](../../supabase/staged/character-builder-multiclass.sql)
   admits only level-zero racial spells and explicitly refuses levelled ones.
   A6 requires a finite reviewed tier/cast-level/source policy and producer;
   adding arbitrary non-cantrip grants or borrowing class budgets is insufficient.

Each repair must preserve immutable old snapshots and saved pins. Publishing a
new trait alone must not silently change an old root's dependency closure.
Meaningful new root/version semantics and any historical correction policy need
explicit review; the existing correction command remains Fiend-only. No class
controller upgrade, automatic repin, backfill or historical snapshot rewrite is
authorized by this matrix.

## Finite opposite-controller concurrency checks

Add one two-operation race to A5 (Sorcerer versus Warlock) and one to A6 (Bard
versus Wizard). Two actual pages load the same saved baseline and submit valid,
different controller-owned `select_class_spells` changes together. Each must
produce its own original operation/accepted receipt; native serialization must
leave **both** changes present, two mechanical revision advances, exact unchanged
unrelated selections, current role/order proof and all five bijections. Reload
both pages and verify the independent budgets/slots again. Record actual receipt
order rather than claim a scheduler order. Do not fake a response or replace Auth.

These are new logical lost-update checks across controllers. They do not redo
the accepted extended 25 selected-row cases/28 native lock edges or nine pinned
provider lifecycle cases, and do not replace the existing ordinary same-operation
lost-response/reload recovery acceptance. They are not a universal concurrency,
provider/RI or writer-fence verdict.

## Boundaries and exit

- Source inspection found Bardic Inspiration capacity fixed at one in prepared
  data, while CHA 16/17 requires three. The resource helper does not evaluate an
  ability-based maximum. Record this as separate **R08 capacity/gameplay** work;
  a builder acquisition/slot pass does not accept that capacity or spending/rest.
- The existing shield-bonus source finding remains **R07/R09** without an
  actual-app reproduction. Native-awarded armor may be equipped; leave shields
  unequipped in these oracles. Direct sheet Add Item is not an accepted inventory
  order producer and cannot replace a native starting award or waive bijections.
- Monk level-three unarmored speed is supported. Armor/shield speed gating and
  higher-level scaling are not accepted by A2; neither are automatic Martial
  Arts/Sneak Attack/Savage Attacks resolution or every narrative combat feature.
- Current Fiend correction, Draconic mechanics and the eight complete casters
  must first earn their full actual receipts. Prepare A1–A3 without weakening
  A4–A6; finish their finite source blockers before claiming this matrix passed.
- Update the existing ledger/handoff with exact source, full stories/native
  checks, preserved failures, runtime budget and owned-resource cleanup. M1/R06
  remains **in progress** until its selected local acceptance work is accepted.
  This representative matrix does not close wider enrolled parent/child/access/
  copy/campaign/lifecycle fences or open any of thirteen readiness gates.
  Hosted/provider configuration, backup/restore, release and roadmap M1 remain
  separate acceptance/access lanes.
