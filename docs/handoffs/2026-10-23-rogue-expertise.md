# Rogue Expertise source checkpoint

Implements the bounded single-class Rogue Expertise choices at class levels 1
and 6. Canonical source/choice IDs are `rogue-expertise-1` and
`rogue-expertise-2`; the latter is the actual level-six API slug.

The importer preserves the reviewed API alternatives (two skill proficiencies,
or one skill proficiency plus thieves' tools) as distinct choose-two from the
18 skill proficiency slugs plus `thieves-tools`. It rejects other nested source
shapes and validates proficiency dependencies before atomic publication. These
are choice effects on the genuine Expertise feature snapshots, without invented
feature children or grant lineage. Previously pinned narrative-only versions
are not changed; use the normal importer/versioning path for new snapshots.

The existing generic class control and finite `class_choice` save remain in
use. Shared UI/completion/sheet eligibility derives actual proficiency from
active immutable sources and valid saved proficiency choices. Expertise does
not establish its own prerequisite, duplicate assignments are unavailable, and
class data requires the current sole matching class. The sheet labels thieves'
tools Expertise; skill modifiers use the existing double-proficiency helper.

Install the new disposable-profile companion in this order:

1. Existing reviewed baseline and first-acquisition stages.
2. `character-builder-steps.sql`.
3. `character-builder-catalog.sql`.
4. `character-builder-progression.sql`.
5. `character-builder-race-score-repair.sql`.
6. `character-builder-expertise.sql`.

The companion profiles exact existing planner bodies, prunes invalid older
Expertise before sealing expected choices, rejects invalid new Expertise
submissions, and includes background changes before their existing finisher
and receipt. Existing stages, finishers, source pins, immutable histories,
readiness gates and API role grants retain their contracts. A future multiclass
stage that changes these planner preimages needs an explicit reviewed rebase.

Worker validation is static inspection and `git diff --check`; no dependencies,
services, credentials, database writes or hosted changes were created here.
Root runs the focused importer/eligibility/UI tests and actual app/native
acceptance after integration. This checkpoint does not claim runtime acceptance.
The actual story must save/reload the skill-plus-tool choice, prune a skill
after its proficiency is replaced, show incomplete status and replacement
options, then save two additional level-six choices without duplicate Expertise.

Remaining limits: Bard Expertise and other advanced choice families are not
mapped by this slice. Multiclass proficiency roles remain separately guarded;
this source does not enable class acquisition/removal or claim general builder
completion. Vercel remains unchanged and M7 remains paused.
