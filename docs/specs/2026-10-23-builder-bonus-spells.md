# Source-owned bonus spells and Lore skills

This local companion follows steps, catalog, progression, race-score repair,
Expertise, multiclass, class-feature choices, Favored Enemy and multiclass
integration repair. It does not activate the general class or hit-die writers.
Hosted installation remains a separate acceptance and authorization step.

The importer identifies genuine cached 2014 SRD features, checks their class,
unlock level, subclass and relevant source text, and publishes typed acquisition
policies inside new immutable feature snapshots. Lore's three new skills use
the existing proficiency choice mechanism. Land's 56 subclass spell edges keep
both terrain and class-level predicates: seven terrains, four tiers and two
spells per tier. Selecting Land never grants every terrain's spells.

| Source | Acquisition | Ordinary allowance |
| --- | --- | --- |
| Land 2 | One Druid cantrip | Separate cantrip allowance |
| Selected Land terrain 3/5/7/9 | Two fixed, always-prepared spells per tier | Exempt from preparation |
| Lore 6 | Two spells from any class, up to the Bard's own maximum | Separate from Bard known spells |
| Bard 10/14/18 | Two spells or cantrips from any class per tier | Reserves two published known-spell places per tier |
| Pact of the Tome | Three cantrips from any class | Separate from Warlock cantrips |
| Book of Ancient Secrets | Two first-level rituals from any class | Requires Tome; separate ritual allowance |
| Warlock 11/13/15/17 | One Warlock spell of exactly level 6/7/8/9 | Separate from pact known spells and slots |
| Wizard 18 | One first-level and one second-level saved book spell | Marks existing book entries |
| Wizard 20 | Two third-level saved book spells | Existing entries become always prepared and preparation exempt |

`select_bonus_spells` accepts only `feature_slug`, `choice_id` and a bounded
array of exact `content_id`/`content_version` tuples. The database derives the
earned source, class, level, filters and allowance from immutable evidence.
The character stores `choices.bonus_spells[choice_id]`. Empty and partial picks
are permitted drafts; completion requires the full eligible selection and its
exact physical projection. Duplicate picks, cross-choice collisions, missing
book entries, invalid ritual/list/level choices and unearned sources fail.

Known, ritual, Arcanum and conditional Land acquisitions use physical spell
source `bonus`, exact spell refs and feature-owner provenance. Mastery adds
choice refs without copying known spells. Signature annotates existing Wizard
book rows. Their ordinary preparation intent remains separate from forced
preparation, so replacing or losing Signature cannot increase the ordinary
prepared allowance. Class, subclass, pact, invocation, ordinary spellbook and
level changes rebuild dependent choices. Losing one source removes only its
derived choices and rows. Existing accepted exact pins retain their versions;
fixed grants and book choices also accept their evidenced historical tuples.

Lore excludes skills already provided by active class, race, background or
other choices. Source loss retires Lore choices; proficiency changes prune
invalid picks and revalidate dependent Expertise.

All writes retain authenticated admission, same-transaction private capability,
row locks, sealed expected graph, receipt/history checks and projection ordering.
New helpers are owned by postgres with owner-only execution. The old public
wrapper loses API execution. The new finite wrapper is executable only by
authenticated. All thirteen readiness gates and class/hit-die gates remain off;
service_role has no private-schema usage. Installation requires exact function
preimages and postimages and preserves prior owner, ACL and attributes.

The UI separates ordinary and bonus budgets, disables acquisition controls
until saved mechanics are available, retains failed drafts and refreshes the
confirmed choices after every save. The sheet identifies ritual and Arcanum
acquisitions. Book rituals use the ritual path. Arcanum has no generic slot-cast
button: its separate durable resource-spending acceptance remains open. Mastery
and Signature acquisition do not claim automated free casts or recovery.

Focused helper vectors use an in-memory PostgreSQL environment with stubbed
admission and locks. They cannot establish actual application persistence or
native authorization. The companion browser stories use real local Auth cookies,
Next actions, PostgREST and PostgreSQL, and take read-only native snapshots
before and after source loss. The readback checks earned owners, immutable
choices and rows, revision/receipt closure and all five row-order bijections.
Actual results and resource cleanup belong in the dated handoff.
