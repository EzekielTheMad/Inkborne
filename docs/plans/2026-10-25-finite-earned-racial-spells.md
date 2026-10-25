# F3: finite earned Infernal Legacy spells

This source checkpoint declares acquisitions and read-only spell details. Native
production, publication and actual-app acceptance remain separate gated work.
The accepted actual-app story is Bard 3 (Lore) + Wizard 2.

The new optional race-root `earned_racial_spells` field is exactly version 1,
Infernal Legacy, Charisma, and these ordered grants:

| Total character level | Spell | Base spell level | Fixed cast level |
| --- | --- | --- | --- |
| 3 | Hellish Rebuke | 1 | 2 |
| 5 | Darkness | 2 | 2 |

The transformer fingerprints complete genuine cached Tiefling, Infernal Legacy,
Thaumaturgy, Hellish Rebuke and Darkness API inputs in a stable canonical order.
Changed source prose, membership or spell data fails closed. The meaningful new
Tiefling root contains the policy; existing Infernal Legacy enrichment remains
only Thaumaturgy and Charisma. No trait, old root or frozen catalog is rewritten.

Native producer contract: `source=racial_trait`, `class_slug=race:tiefling`,
`spell_grant_id=null`, known/prepared/always-prepared true, spellbook false. The
four legacy custom-data keys remain unchanged, plus exactly:

```text
builder_earned_racial_spell = {
  contract_version: 1,
  grant_key: infernal-legacy:3:hellish-rebuke | infernal-legacy:5:darkness,
  character_level: 3 | 5,
  spell_level: 1 | 2,
  cast_level: 2
}
```

Each correlated tuple is strict. The reader requires complete saved refs,
current native class roles matching the parent revision, finite accepted total
level, exact selected Tiefling root without a subrace, its mandatory owned trait,
the fixed legacy Thaumaturgy/Charisma effects, and genuine SRD/platform/null-owner
spell snapshots. Each selected class level must appear exactly once in its finite
immutable level manifest. Conditional or extended legacy grants fail before
generic immutable parsing can strip their unsupported raw keys. Trait and spell
cutoff is the ROOT timestamp; microseconds are compared without rounding. The
reader proves loaded tuples are no newer than this root; only the native producer
resolves the latest immutable dependency as of the root. Missing positive evidence never falls back to slugs,
other class budgets, trait timestamps or role-derived parent revisions. The
existing strict racial-cantrip reader is unchanged.

The native reconciler belongs at the final class-feature normalizer return after
bonus normalization. Pending roots are in graph refs plus supplemental refs;
before-root ownership must be proved separately against the sealed prior graph,
old parent choices and exact pre-write ancestry roots. Reuse retained row IDs and
creation times. Prune only proved owned earned rows when total level drops below
3/5 or race changes, including class removal; malformed claims refuse. Preserve
ordinary class spell selections, preparation, spellbooks, cantrips, HP draws,
inventory and all unrelated projections. Existing ordinary receipts/order tokens
remain the only command protocol. No SQL is changed by this TS checkpoint.

Both ordinary slot/ritual eligibility and forced dialog/provider execution refuse
earned leveled racial casts before state/effect/resource/roll work. Displayed
Charisma, fixed cast level and once-per-long-rest text is descriptive only. No
resource metadata, use counters, rest behavior or new CastChoice is introduced.
The separate R09 authority cohort is not expanded.

The genuine cached spell API uses an array damage payload. This checkpoint only
makes the importer's input type truthful and preserves its existing neutral
array output (`type: null`, empty dice map). Interpreting multi-part damage remains
a separate source finding; this does not add casting or damage execution.

Publish only race/tiefling v2 after a genuine app-created old-v1 control. Derive
from the current accepted catalog chain, preserving Draconic and Hill Dwarf
corrections. Definitions stay constant and versions increase by one. Preserve all
older snapshots and all fifteen character/projection tables exactly. Old pinned
v1 characters remain cantrip-only; no implicit repin is introduced.

Focused source sweep (root owns the execution slot):

```text
npm.cmd test -- tests/schemas/earned-racial-spells.test.ts tests/transformers/earned-racial-spells.test.ts tests/lib/character/earned-racial-spells.test.ts tests/lib/character/earned-racial-spells-provider.test.tsx tests/spells/casting-ability.test.ts tests/spells/casting.test.ts tests/lib/character/source-casting-ability.test.tsx tests/lib/supabase/content-definitions-parser.test.ts tests/transformers/races.test.ts tests/transformers/catalog-enrichment.test.ts tests/transformers/dwarven-toughness.test.ts --maxWorkers=1
```

Then typecheck and zero-warning lint use the existing npm scripts. Native
installer/pruning/order/receipt tests and full actual-app proof remain required.
