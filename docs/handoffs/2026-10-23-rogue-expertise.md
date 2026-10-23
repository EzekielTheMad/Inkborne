# Rogue Expertise application checkpoint

Root delivery: `4279067` on `codex/launch-integration-20261011`, following
`f80cfc3` (worker integration), `8c21a9d` (actual app story) and `7f8c99f`
(portable SQL insertion profiles). **The actual Rogue workflow now passes.**
Final Fighter and Cleric walkthroughs also pass again against these shared
changes. Vercel is unchanged; M7 remains paused and M1/R06 remains in progress.

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

Worker preparation used static inspection and `git diff --check`; no dependencies,
services, credentials, database writes or hosted changes were created here.
Root acceptance after integration is recorded below. The actual story saves and
reloads the skill-plus-tool choice, prunes a skill after its proficiency is
replaced, shows the incomplete choice, then saves two additional level-six
choices without duplicate Expertise.

## Root application and database verification

| Run under sibling `equipment-runtime/evidence/` | Accepted result |
| --- | --- |
| `local-catalog-builder-20261023T184138Z` | Six files / 31 tests pass: importer, dependency closure, eligibility, completion, shared choice effects and tool display. |
| `local-catalog-builder-20261023T185017Z` | Two files / 12 tests pass after the compound skill correction; overlaps the earlier subset. |
| `local-actual-catalog-20261023T185038Z` | Actual Rogue story passes: 31.9 seconds browser, 36.30 seconds wrapper; all 18 observed identities exit. |
| `local-actual-catalog-20261023T185232Z` | Final Fighter and Cleric complete builder stories both pass: 34.4 / 36.1 seconds browser, 75.25 seconds wrapper; all 27 observed identities exit. |
| `local-creation-browser-check-20261023T185445Z` | Final source typecheck and zero-warning lint pass in 47.34 seconds; all 10 observed identities exit. |

Rogue `8c2f2527-94ed-4cc4-a47b-79fff77f8555` saves Stealth plus thieves' tools
Expertise at level 1. The sheet retains Stealth +6 after reload with DEX15/PB2.
Changing the class proficiency from Stealth to Deception removes only the obsolete
Expertise pick; the tool pick remains. The class choice displays 1/2 selected,
and Stealth returns to +2 on the sheet. Acrobatics replaces that pick. At level 6,
Perception and Sleight of Hand are selected separately, excluding prior picks.
After reload the sheet has Acrobatics +8, Perception +7, Sleight of Hand +8,
Stealth +2, and `Thieves Tools (Expertise)`.

The actual final Fighter/Half-Elf/Acolyte and Life Cleric/High Elf/Acolyte stories
again cover sign-in, creation, all relevant selections, real starting gear and one
15 gp award, details, sheet reload and a second account's 404. Current characters:
Fighter `e31570c4-96c0-4af3-9a9e-0c7eacde3d5a`; Cleric
`a9b06722-3816-4b3a-9689-ebf118fe1512`. These final reruns are level-one builds;
the earlier Champion4/ASI/feat/retained-HP acceptance remains in the
[first real catalog checkpoint](2026-10-23-real-srd-builder.md).

Native readbacks independently confirm saved choices, all six scores, genuine
immutable feature pins/grant IDs, all five projection order bijections,
parent/order revision correspondence and unchanged original class revision1.
Read-only native normalizer controls preserve the saved canonical choices and
reject an untrained Arcana pick and a duplicate Acrobatics pick with SQLSTATE22023.
These controls test the native helper, not a full hostile client/recovery matrix.
No capability remains; all 13 readiness rows/class/hit-die gates stay closed,
service lacks private USAGE, and the finite endpoint remains authenticated-only.
Readbacks: `app-flow-runtime/rogue-expertise-final-readback.json` and
`app-flow-runtime/real-catalog-builder-final-readback.json`.

The fresh catalog still has 1,535 definitions and 1,535 exact immutable snapshots,
with zero pending rows. Prepared SHA256:
`cb429d67131b6cc02a66b22eb0133220d58a55e971e54fc3c3ab856488a40ff4`.
Original Fighter/Cleric control, catalog and readbacks are preserved under
`app-flow-runtime/real-srd-fighter-cleric-20261023/`; no prior snapshot was patched.
The corrected Expertise stage's applied raw source SHA256 is
`0474566010e7a55be36927deb3084ce6baf961791f5d9deff146ed0a9a184ff6`.
Existing character row fingerprints and function permissions are preserved.
Independent source review reconstructed all three exact planner profiles and
passed eligibility, pruning, the portable insertion correction and skill mapping.

## Real failures fixed

The first native stage attempt rolled back with a postimage hash refusal:
dollar-quoted SQL fragments retained CRLF while existing bodies were normalized
to LF. The correction normalizes the insertion before replacement; exact preimage,
single-match, postimage and privilege checks remain intact. Installation then
passes against real PostgreSQL. The failed attempt remains in evidence/history.

The first Rogue story reached the final level-six sheet and exposed a product
defect: `skill-sleight-of-hand` was projected as `sleight-of-hand`, while the
published sheet key is `sleight_of_hand`. The shared consumer now maps that alias
and `skill-animal-handling` to their exact sheet keys for fixed, selected and
Expertise grants. Other values and immutable raw sources remain unchanged. The
final story verifies the corrected result. Failure evidence remains at
`local-actual-catalog-20261023T184755Z`.

## Cleanup

At `2026-10-23T18:56:21Z`, owned Next/proxy processes and ports were closed,
five task containers/two networks/two volumes were removed, and all three
restricted credential files were deleted. Task resource counts are zero and
ports3001/9997/9998/9999 have no listener. Shared Docker engine/cache, all inherited
worktrees and the completed evidence remain. Free memory after cleanup is about
5.58 GiB with602 processes; the final check workers have all exited. Receipt:
`app-flow-runtime/runtime-teardown-readback.json`. No services were left for idle
verification and no hosted configuration, data or security setting changed.

## Remaining boundaries

Class skill prerequisite loss is exercised in the actual app. Wider race and
background loss, downgrade/recovery/concurrency and direct full-command negative
matrices remain open. M1/R06 and general builder completion are not accepted.
The closed multiclass proof seam is parked separately at
`codex/native-multiclass-20261023`, SHA `6b4d778568ee024a9e82f0754977daef1b7d000f`.
It is not merged, installed or activated. Its six source checks/typecheck/lint pass;
an unnecessary broad worker suite was stopped and its partial results are excluded.
Its 23 recorded check descendants and temporary dependency junction were removed.
Actual second-class acquisition, secondary role profiles, per-controller
progression and consumer integration remain future work. No push or hosted change.

Remaining limits: Bard Expertise and other advanced choice families are not
mapped by this slice. Multiclass proficiency roles remain separately guarded;
this source does not enable class acquisition/removal or claim general builder
completion. Vercel remains unchanged and M7 remains paused.
