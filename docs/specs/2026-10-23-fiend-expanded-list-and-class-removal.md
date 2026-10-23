# Fiend expanded choices and added-class removal

This is a bounded M1/R06 builder contract. Vercel is unchanged and M7/creature
imports stay paused. The original starting class remains fixed, as selected by
the user; replacing it and rebuilding starting proficiencies/equipment is outside
this flow.

## Expanded spell eligibility

The genuine 2014 Fiend subclass publishes `spellcastingExpanded`, not
`spellcastingExtra`. Its five earned tiers add candidates to the Warlock's
ordinary spell choices:

| Warlock level | Additional candidates |
| --- | --- |
| 1 | Burning Hands, Command |
| 3 | Blindness/Deafness, Scorching Ray |
| 5 | Fireball, Stinking Cloud |
| 7 | Fire Shield, Wall of Fire |
| 9 | Flame Strike, Hallow |

These candidates consume the normal known-spell allowance. Choosing Fiend does
not grant spells, prepared rows, another casting source, slots or a larger
allowance. The importer removes Fiend's obsolete enrichment overlay and checks
the ten source references. Life/Devotion prepared grants and Land's conditional
grants retain their existing contracts.

UI, completion and native admission require the selected earned Fiend pin and
the candidate's exact system/source/scope/owner provenance. A personal spell
with a matching slug cannot impersonate a published off-list candidate. Class
level and spell level remain bounded by the selected Warlock's own progression.
Ordinary Warlock-list eligibility retains its independent path.

Loss of expanded eligibility removes expanded-only choices that become
ineligible. Normal level and budget pruning also applies when reducing a class
level. Clearing the patron preserves independently eligible base-list selections
and their row IDs. The subclass card provides an explicit **Clear subclass** action; a
click on the selected card remains idempotent. Historical immutable Fiend
snapshots are preserved and show a warning. Updating those snapshots requires
a separate reviewed content-version/repin policy.

## Added-class removal

`remove_class` accepts an exact occurrence UUID and expected action revision.
The native writer derives ownership and original/secondary roles from the
accepted immutable acquisition evidence. A stale revision, missing/inactive
occurrence or original occurrence is rejected. The UI exposes removal only for
an evidenced added class and waits for a confirmed receipt before adopting the
new graph.

Removal ends that occurrence and retires its class/subclass controllers,
features, ASIs, nested choices, spell grants/selections and current HP choices.
It preserves accepted acquisition receipts, journal/history and previous HP
draw evidence. Retained classes keep their exact content pins and valid choices;
their budgets and derived HP are recalculated. If losing an ASI lowers another
class's preparation allowance, excess preparation is removed while valid book
membership remains. Current HP is clamped to the new maximum.

Re-adding the same class creates a new occurrence and controller. It does not
restore old subclass/spell choices or reuse the ended occurrence's HP rolls.
The starting class, starting equipment, inventory and currency are unaffected.

Both native companions require exact preimage/postimage guards and preserve
function ownership, ACLs and attributes. They retain transaction capabilities,
row locks, sealed graph validation, receipts and row ordering. All thirteen
writer readiness gates and the class/hit-die gates remain disabled; service_role
has no private-schema usage. Installing a disposable companion does not enable
hosted routes or alter hosted data.

Focused helper tests use an in-memory PostgreSQL fixture with stubbed admission
and locking. Actual local browser workflows separately exercise Auth cookies,
Next actions, PostgREST and PostgreSQL, followed by read-only native evidence.
The dated handoff records observed results, limitations and cleanup.
