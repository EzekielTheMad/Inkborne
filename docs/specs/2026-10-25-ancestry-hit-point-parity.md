# Finite ancestry maximum-HP parity (F1)

This is the current R06 builder workstream's Dwarven Toughness repair. The source
finding is not an actual-app reproduction. R06 remains in progress; M1–M6 retain
priority, Vercel stays unchanged, M7 stays paused and all activation gates remain
closed. This slice does not claim hosted, provider, lifecycle or launch acceptance.

## Source and immutable declaration

The genuine cached 2014 Hill Dwarf subrace owns the mandatory Dwarven Toughness
trait. Its exact prose increases maximum HP by one initially and at every level.
The existing transform retained only narrative, so the independently expected
Hill Dwarf Barbarian3 with effective CON16 was missing three maximum HP.

`subrace.data.hit_points_bonus_per_character_level` is optional literal **1**.
Absence means zero for a valid historical root. Explicit null, 0, 2, fractional,
string or boolean declarations are unsupported. There is no default, variable
bonus, trait-slug lookup or Hill Dwarf exception in a runtime consumer.

`subraceHitPointMechanics` requires the genuine Hill Dwarf→Dwarf relationship,
one mandatory Dwarven Toughness edge and the exact genuine trait identity, owner
and prose. `transformRaces` obtains that actual trait resource through the existing
2014 API/cache loader. It writes the meaningful declaration on the subrace root;
the trait's original narrative representation is unchanged. Normal atomic
publication determines a new root version because its data changed. No forced
version bump, historical mutation, automatic repin or child-only upgrade is used.

Old saved Hill Dwarf roots remain at zero and retain their raw snapshots/pins.
The existing explicit correction command remains Fiend-only. Correcting historical
ancestry is a separate reviewed policy/workflow, not implied by this repair.

## Saved TS inputs and arithmetic

`resolveAncestryHitPointBonus` consumes the actual loaded immutable refs and an
explicit complete-read flag. A query/visibility/parse failure cannot become
confirmed metadata absence. Selected ancestry roots must be unique exact
character/system/content/version tuples, with the saved selected slugs and
subrace parent pair. Positive declarations additionally require exact ordinary
root context `{source:'race'|'subrace'}`, null choice/grant provenance, valid
complete class levels and the existing current original/secondary role proof.
Historical readable shared/homebrew pins retain the existing continuity policy;
the helper makes no current-catalog or author-equals-character-owner decision.

The ancestry term counts **total character levels**, once, after every ordinary
per-level die-plus-CON minimum. The independently validated subclass term still
counts its owning class levels and adds separately. Barbarian3 CON16 is
`12+7+7 + 3×3 + 3 = 38`; the old root remains35. Three d6 levels at CON1 have
three minimum gains plus ancestry3, yielding6. Classes may be reordered without promoting
a secondary class to original or granting the original maximum twice.

The same term reaches the class `StatPreview`, sheet maximum and pure durable
planner. The sheet uses actual complete snapshot status. The class preview uses
its existing complete ASI/readiness evidence and saved local build comparison.
The durable DTO already contains every actual frozen ancestry pin and raw
definition data/effects. Its strict schema validates the new optional field;
raw metadata remains in the existing dependency fingerprint. No DTO/graph fields,
reader projection filters or browser authority are added. A positive ancestry
bonus needs the same original-occurrence proof used by positive subclass bonuses.
Permanent CON determines maximum HP; temporary live CON affects hit-die healing
only. Production durable routing and gates remain unchanged.

## Native companion and installer ordering

Native SQL is a separate owned companion. The canonical installation order is:

1. Existing Draconic `character-builder-hp-bonus.sql`, whose helper postimage is
   `6f4e810b99cfd755babcc0fc058c2431`.
2. Existing `character-builder-parent-admission.sql`, which deliberately pins
   that HP body as a dependency.
3. New finite ancestry companion, requiring the exact HP preimage/profile and
   installed parent admission/seal/trigger profiles before replacing calculation.

Do not broaden parent preflight to hide an order change. Ancestry-before-parent
must reject; altered dependency/owner/config/ACL/trigger profiles must reject.
The companion preserves the existing writer bodies, exact mechanical seals,
revision assignment, protected graph schema, receipts and full order closure.
It must finish with empty capabilities/admissions and all13/class/hit-die gates
closed. It grants no new public/private-schema or caller mutation authority.

There are exactly two production `builder_multiclass_max_hp_v1` call sites:
the common progression tail in `character-builder-multiclass.sql` and class
removal in `character-builder-class-removal.sql`. They clamp only an existing
`state.current_hp`, preserving missing HP. Acquisition currently preserves state.
Readback/test calls do not introduce another production writer.

Their pending protected graph omits ancestry roots. The native companion must
read the actual pinned ancestry/version rows under the already admitted guard
and parent locks, validate the full selected pair and require pending race/subrace
keys to equal saved keys. Prospective ancestry changes refuse rather than guess
zero. The bonus uses the validated **pending classes' total**, not `OLD.level`:
the target level has not been written during level changes or removal. No graph
widening, request-provided ancestry or second parent UPDATE is needed.

## Separate R09 state limitation

Race/subrace selection/clearing, racial ability-choice changes and ability saves
do not currently clamp stored current HP when their mechanics lower the maximum.
Sheet initialization preserves a saved over-max value; the durable planner
refuses it. F1 repairs maximum HP and only the two existing native clamp sites.
It adds no race/ability current-HP writes, prospective-CON calculator, synthetic
state repair or additional parent seal. This existing behavior remains a separate
R09/state finding, just as the earlier Draconic slice did not accept that lane.

## Focused proofs and actual acceptance

Focused source coverage must exercise meaningful root transformation and unchanged
trait inputs; optional schema/raw parser preservation; HP38 versus old35; finite
invalid metadata; incomplete/missing/ambiguous/mismatched ancestry; selected root
ownership and existing shared-pin continuity; level totals and original proof;
reordered multiclass and additive subclass terms; low-CON minima; actual class
sidebar/sheet inputs; durable raw fingerprint and baseline-versus-live CON. A
sheet regression must preserve the explicitly separate over-max state behavior.

After a serialized check slot, require the focused tests and reviewed type/lint
evidence. Native companion tests need pending up/down/removal, exact ancestry
reads, invalid positive evidence, installer order/closure and no seal bypass.
Actual acceptance needs a genuine old Hill control before an atomic one-root
publication, a new full Hill Dwarf Barbarian3/CON16 build at HP38, sheet reload,
exact native HP/pins/order readback and preserved old HP35/raw fingerprints.
Any current-HP clamp claim must stay within an already accepted writer path.
No tests, native installation, import/publication or browser process are implied
by committing this source plan; record exact later receipts separately.

Dragonborn resistance projection, earned Tiefling spell tiers, R07 inventory and
R08 resource/combat automation remain outside F1.
