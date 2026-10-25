# Finite native earned Infernal Legacy (F3)

The 48 focused PGlite checks pass; native installation, import/publication,
browser, provider and hosted execution remain unaccepted. R06 remains in
progress, M1–M6 retain priority, Vercel stays unchanged and M7 stays paused.
All13 writer readiness/class/hit-die gates remain closed.

## Admitted declaration and source

Only the meaningful immutable SRD/platform/null-owner Tiefling race root may
declare `earned_racial_spells`. It is the exact object:

```json
{"version":1,"source_trait":"infernal-legacy","spellcasting_ability":"charisma","grants":[{"character_level":3,"spell":"hellish-rebuke","spell_level":1,"cast_level":2},{"character_level":5,"spell":"darkness","spell_level":2,"cast_level":2}]}
```

There is no default, automatic migration or historical root upgrade. A valid
old root without this field remains cantrip-only. Explicit null, changed tier,
extra key, subrace declaration or other positive source refuses. A same-slug
root-version replacement involving this declaration requires a separate reviewed
correction workflow. Existing Fiend correction stays subclass-only.

The selected root must have exact native root context, null grant/choice
provenance, one mandatory Infernal Legacy edge and no selected/loaded subrace.
The owned Infernal Legacy pin must equal the existing immutable dependency
resolver's root-as-of result, with exact source/root context and choice source.
Its source is SRD/platform/null-owner in the same system, scopes are
`races:[tiefling]` and absent/empty subraces, and its only fixed spell/ability
grants are exactly Thaumaturgy/Charisma with no unsupported effect extensions.

Earned spell dependencies also resolve **as of the root**, preserving native
timestamp microseconds and existing source/access/dependency order. The older
trait timestamp does not select them. Mutable catalog heads do not supply a
saved entitlement. The existing bare-racial cantrip-only guard remains unchanged.

## Hook and transaction boundary

The installer changes only the final return of
`prepare_builder_class_feature_choices_v1(uuid,jsonb,jsonb,text,jsonb)`, after
the existing bonus normalizer. New owner-only source/reconciliation helpers
return the same `{choices,graph}` envelope; only `graph.spells` may differ.
No graph schema, API, role, state producer, writer seal or activation gate changes.

| Existing admitted path | Existing call site before sealing/applying |
| --- | --- |
| Catalog race/subrace/choice/subclass | Class-feature companion inserts the normalizer into `apply_builder_catalog_command_v1`; supplemental refs are pending `race_refs` plus saved background. |
| Ordinary class level/HP/ASI/spell progression | `prepare_builder_progression_v1`; supplemental refs are saved race/subrace/background, pending classes/occurrences are already compiled. |
| Secondary class addition | `prepare_builder_acquisition_v1`; the accepted pending occurrence/controller exists in the graph before its physical insert. |
| Secondary removal | `prepare_builder_class_removal_v1`; normalizer precedes pending total/HP calculation and final expected-plan seal. |
| Explicit Fiend correction | Its existing catalog `select_subclass` call reaches the same hook. Its byte-preserved unrelated-row and parent invariants must still pass. |

First class is the separate B3 `commit_character_class_transition_v1` lane,
reached from first-class actions through `addFirstClassForAccount`. Its own
`observe_first_class_choices_revision_v1` seals first choices/materializes the
graph. It never invokes the ordinary class-feature normalizer. Those bodies and
callbacks are frozen unchanged by the new installer. A no-race post-first-class
normalizer regression additionally checks the nonparticipating fast path.

Direct `select_bonus_spells` uses its existing bonus-only normalizer and retains
non-bonus racial rows. Simple ability/background/details/equipment writes do not
change ancestry or total levels and retain the spell graph. They need no extra
hook, repair behavior or authority. No new generalized state writer is added.

The reconciler reads actual pre-write ancestry roots under the existing admitted
guard/parent locks and binds them to `cap.before_parent.choices`. Prior trait and
spell rows come from the captured protected graph. Pending ancestry is validated
from the logical `graph.refs + supplemental_refs` union; it is not guessed from
the protected graph, which deliberately excludes ancestry roots. It requires the
entire current parent still equal the captured before-parent row.

With neither source participating and no earned marker, it returns the existing
normalizer graph unchanged before new original/class checks. Positive paths
validate saved and pending accepted occurrence/controller/version tuples, own
immutable class level rows and totals1–20. Pending class totals, never saved
`parent.level` or the not-yet-populated `expected_level`, earn the tiers. The
genuine original occurrence must remain selected; removing a secondary does not
promote it or manufacture a new starting class.

The nonparticipating fast path preserves existing unmarked rows; it does not
retroactively impose a new blanket validator on historical spell data. Existing
bare-racial cantrip-only production guards remain exactly as installed. Forged
earned markers still refuse without a positive owned source.

## Ownership, retention and refusal

Every prior earned row must be the complete exact set expected from the saved
root and saved total, including immutable dependency, name, source, group,
flags, grant-null and custom data. Missing or forged prior claims refuse before
pruning or allocation, including unrelated Fiend/class-choice operations. A
later operation cannot heal a missing historical row.

Rows use source `racial_trait`, group `race:tiefling`, known/prepared/always
prepared true, in-book false and null `spell_grant_id`. The four legacy custom
keys stay `builder_source_pin_id`, `builder_root_ref_id`, `builder_choice_id:null`
and `spellcasting_ability:charisma`. The sole added key is:

```json
{"builder_earned_racial_spell":{"contract_version":1,"grant_key":"infernal-legacy:3:hellish-rebuke","character_level":3,"spell_level":1,"cast_level":2}}
```

Darkness uses `infernal-legacy:5:darkness`, character_level5 and spell_level2;
cast_level remains2. No free-use counter, rest reset or M6 automation is created.

Retained exact rows keep their original IDs and timestamps even when catalog
compilation temporarily omits them from its rebuilt pending array. Threshold
crossing can add only the newly earned row. Downgrades5→4/3→2, race clear/change
and secondary removal prune only exact previously proved earned rows. Ordinary
learned copies with the same spell identity remain independent. An incoming
changed/foreign marker, extra prior claim or duplicate refuses. Output remains
bounded and uniquely sorted, then existing expected-plan, parent admission,
order, history and receipt finalizers provide the normal all-or-nothing write.

## Exact installation and focused evidence boundary

Required order is Draconic HP → parent admission → ancestry HP → this companion.
The installer reasserts all25 admitted parent profiles, the exact11 parent wires
and two deferred closure wires, native postgres visibility posture, finite
existing ACL variants and bridge union. F1 HP postimage is
`f1e31016bdf00414996ac0853ae5efc2`; ancestry helper is
`19594d15276862e6d8e2a8ff3f8376f8`. It pins the existing immutable dependency
resolver body `9e049a6c5039f785f8ec1c8ddec0431d`.

Normalizer preimage `ac38f1a56f22097481aa51ea3472d592` changes to
`ecd93787a191f3074ae6b458b763e932` by replacing one exact final return. Every
other pg_proc field/body and every trigger row is frozen pre/post. New helpers
are postgres-owned VOLATILE SECURITY DEFINER, empty search_path, owner-only
EXECUTE with exact body/profile postchecks. No caller private-schema access is
introduced. Closed caps/admissions/readiness and class/hit-die gates are required.

The new focused file executes the **complete actual installer**, original
normalizer final return, actual bonus normalizer and actual immutable dependency
resolver. Parent/HP installers and source reconstruction are inherited from the
existing focused harness. Auth, first-acquisition provenance/original proof,
capability minting, choice callbacks/materializers, Lore/Expertise/favored
collaborators and physical graph application are explicit doubles. There is no
claim of full genuine compiler/JWT/receipt/B3/concurrency or actual app acceptance.

Passing cases cover old v1, no-race nonparticipant, tier crossing/downlevels,
pending mixed addition/removal, pending new root before its physical insert,
ordinary same-spell copies, complete prior proof, forged incoming claims,
malformed declarations/owned sources/levels, same-slug correction refusal,
microsecond source cutoff, rollback, owner-only ACLs, exact profile drift,
wrong installer order and CRLF source normalization. Receipt
`local-racial-spells-native-20261025T071719Z` passes 48/48 in 11.90 seconds
including wrapper overhead; all six observed identities are gone. Preserved
failures exposed an unparenthesized PL/pgSQL CASE expression and fixture-only
timestamp text differences. The repaired fixture captures actual native JSON
timestamps, preserving offset and microseconds; production full-pin equality
remains exact. Stage LF-byte SHA256 is
`15ba6f048db128488d57b67616d8ea8dbbc3dfa9024abbff1e7339c6f738eb86`.
The reconciler normalized body MD5 is `05989bdb6d1683d31d781e67b302a04d`.

After root releases a serialized recorded check slot, use the existing script:

```text
npm.cmd test -- tests/supabase/builder-earned-racial-spells-postgres.test.ts --maxWorkers=1
```

Use the coordinated768MiB heap/resource wrapper and fresh headroom requirement.
Do not infer a pass from source hash/whitespace checks. Later native installation,
source publication and full A6 app story require their separate explicit releases,
fresh immutable readback, old-control preservation and foreign-account refusal.
