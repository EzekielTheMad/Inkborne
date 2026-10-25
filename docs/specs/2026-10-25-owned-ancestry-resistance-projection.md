# Owned ancestry resistance projection

Status: finite source plan; implementation and actual acceptance pending.

The prepared Gold Dragonborn child trait already declares the mechanical grant
`{type: grant, stat: dmgres, value: fire}`. The current evaluator retains it as
a generic grant, while sheet and print resistance lists consume structured
`dmgres` only. This plan projects the existing explicit declaration. It changes
no catalog snapshot, native producer, character row, entitlement or historical
pin, and requires no new root publication. It supplies no Gold-to-fire mapping.

## Exact admitted closure

Use the character's selected race/subrace, the complete immutable ref read and
the same character/system identity already supplied to structured evaluation.
Do not use the mutable catalog or treat an incomplete read as confirmed absence.
Each root must have its exact content tuple, null feature grant/choice source
and native `{source: race}` or `{source: subrace}` context. A selected subrace
must belong to its selected parent race.

Walk each root's explicit `data.traits`, then only finite declared
`grant_type: trait` choices and their saved eligible, distinct selections.
Every dependency must be an exact owned trait pin with native
`{source: racial_trait, root_controller_ref_id: <root>}` context,
`builder:racial-trait:<slug>` choice source and null feature grant. Reject
duplicate, missing, conflicting, orphan or foreign dependency evidence; bound
the traversal and reject cycles. Validate declared ancestry scopes against the
root. Raw source arrays and definitions stay unchanged.

Project only explicit `dmgres` grants with one of the thirteen fixed damage
types. Feed a cloned structured resistance contribution into the existing union
used by sheet, builder preview and print. Ordinary class/feature/spell generic
grants cannot enter through this ancestry-only path. Selecting a replacement
ancestry or losing its owned source removes the old contribution naturally.

An unavailable closure must remain visible through the existing mechanics
readiness channel and sheet defenses; print must refuse an unconfirmed result.
It must not display a confirmed empty resistance list. A valid closure with no
resistance declaration remains an available empty contribution.

## Verification boundary

Focused tests must prove Gold fire, a different explicit selected resistance,
source replacement/loss, deduplication with structured sources, immutable inputs
and the invalid evidence cases above. They must show that unrelated generic
grants cannot authorize resistance and unavailable results reach the actual
consumer/readiness path. These are source checks, not actual app acceptance.

The A5 story in the remaining builder matrix must then save the real Gold
choice, finish all six steps, show fire resistance after sheet reload and pass
native ownership and foreign-account checks. Keep its independent HP, regular
and Pact slot, allowance and opposite-controller concurrency oracles intact.
No free-cast resource or rest automation is added. Global gates remain closed,
Vercel unchanged and M7 paused.
