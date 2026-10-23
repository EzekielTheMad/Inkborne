# Real SRD Fighter and Cleric builder delivery

Executable checkpoint: `9158162e9feed7f771c8523e5937c4d3a6d4956e` on
`codex/launch-integration-20261011` in
`C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-verification`.
This supersedes the synthetic-content limit of the
[October 22 checkpoint](2026-10-22-real-app-builder-saving.md).
Vercel is unchanged; M1–M6/M5.5 remain active and M7/creature imports paused.

## Delivered behavior

The actual Next application signs in through its form, creates a notebook and
saves complete real SRD Fighter/Half-Elf/Acolyte and Cleric/Life/High Elf/Acolyte
builds. Class/race choices, abilities, background, actual starting gear, one 15 gp
award, name and alignment survive full document reloads. A second authenticated
account receives a 404 for each notebook. These stories use real local Auth,
PostgREST and PostgreSQL without mocked actions or synthetic catalog rows.

Fighter selects Defense, class skills and Half-Elf skills, ability increases and
language. The saved build advances to Champion 4 with HP at levels 2–4 and STR +2.
Grappler can replace the ASI and the ASI can replace the feat. A server-generated
d10 result remains identical after reload and Average → Rolled; subsequent
average saves leave the original draw immutable. Final sheet: STR 18, max HP 36,
STR/CON saving-throw proficiency.

Cleric selects Life, skills, three class cantrips and three prepared spells.
Bless/Cure Wounds are always prepared from Life; High Elf Light uses INT. All
nine physical spell rows survive reload. Counters correctly show 3/3 cantrips and
3/3 prepared spells, excluding racial/domain grants. WIS/CHA save proficiency
appears on the sheet. Unsaved spells block navigation; saved incomplete spell
selections remain an editable draft and prevent final builder completion.

The source supports single-class draft levels 1–20, exact subclass/style
controllers, finite spell selection, HP and ASI/feat commands. Wider combinations
are not all accepted by these builds. Native Add/Remove Class stays unavailable
until a genuine multiclass transition preserves original roles, grants,
prerequisites and history.

## Catalog and staging

`import:srd` normalizes the public 2014 D&D API, validates schemas/reference
closure and promotes immutable snapshots atomically. The disposable runtime has
**1,535 real definitions and 1,535 exact version 1 snapshots**, zero pending rows:
12 classes, 12 subclasses, 407 features, 319 spells, 9 races, 4 subraces, 38 traits, 
16 languages, 117 proficiencies, Acolyte, Grappler, 237 equipment, 362 magic items.
Monsters are excluded. Packs remain actual pack items; contents expansion is not
claimed. Reviewed Acolyte enrichment includes the complete award with one 15 gp.

Final prepared catalog SHA256:
`7a5985d96ee2b231ae6ea6668c0bbc7c6d1a720e69c1883303e7507dffca6de7`.
Source manifest SHA256:
`60e35087457442e13b2ca8404b129baa934684a02937720a22770894c207e40e`.
Native comparison covers every definition, effect, envelope and snapshot.

Fresh staging after the unchanged 83 + 17 baseline files:

1. `supabase/staged/character-builder-steps.sql`
2. `supabase/staged/character-builder-catalog.sql`
3. `supabase/staged/character-builder-progression.sql`
4. `supabase/staged/character-builder-race-score-repair.sql`

The installed older disposable stage needed exact-preimage style and ASI-pruner
repairs; corrected logic is present in the fresh catalog/progression sources.
Do not replay CREATE stages over an installed runtime. The race-score repair is
required after progression and retains owner/ACL/configuration and character rows.
No hosted SQL was applied.

## Focused verification

Evidence is under sibling `equipment-runtime/evidence/`; browser attachments are
in this checkout's ignored `test-results/local-app/`.

| Evidence run | Accepted result |
| --- | --- |
| `local-actual-catalog-20261023T180001Z` | Complete Fighter, sheet reload, foreign 404; 33.0s browser/37.54s wrapper. |
| `local-actual-catalog-20261023T181714Z` | Final complete Cleric, counters/saves, sheet reload, foreign 404; 37.7s/42.25s. |
| `local-actual-catalog-20261023T180220Z` | Saved Fighter → Champion 4, HP, STR +2 ASI and sheet reload; 13.0s/17.13s. |
| `local-actual-catalog-20261023T180457Z` | Feat/ASI replacement and retained server HP draw; 15.8s/20.72s. |
| `local-actual-catalog-20261023T181538Z` | Fighter sheet reload confirms STR+6/CON+4 saves. Earlier Cleric case in this run hit a hidden/mobile duplicate locator; final rerun above passes. |
| `local-catalog-builder-20261023T164816Z` | 11 files / 69 focused importer and consumer tests pass. |
| `local-catalog-builder-20261023T170802Z` | Six files / 62 focused UI, choice, casting and completion tests pass. |
| `local-catalog-builder-20261023T180943Z` | Three files / 32 focused completion/navigation tests pass. |
| `local-catalog-builder-20261023T182137Z` | Five choice-effect cases pass, including sole-class save alias and multiclass fail-closed guard. |
| `local-creation-browser-check-20261023T182219Z` | Final implementation typecheck/zero-warning lint pass; 49.72s, all 8 observed identities exited. |

Runs overlap; do not sum them as distinct tests. Existing npm `test`, `test:e2e`,
`typecheck`, `lint` scripts were used. The user requested focused testing; no
repeated full suite/build was added. Browser stories reject nonlocal origins,
disable sensitive traces/video and use normal forms/actions. Accepted stories
have no blocked remote requests or page errors. Final screenshots were inspected.
Independent narrow source reviews passed for SQL/importer/consumer changes.

Native final readback agrees with the UI: Fighter
`60c2599b-6b9a-41a7-9e20-af7b70f56c0c` level 4; Cleric
`a4843764-334a-47a7-85a0-9f74ae13eb65` level 1. All six effective scores, exact
pins, one award each, inventory provenance, five physical row/order bijections,
parent/order revisions and progression receipt correspondence pass. Original
class revision remains 1; Fighter has one immutable level 2 d10 draw; Cleric has
six ordinary selected spells plus three grants. Readback:
`app-flow-runtime/real-catalog-builder-final-readback.json`.

All 13 global readiness rows and class/hit-die gates remain closed; zero builder
capabilities remain. Only authenticated can execute the finite builder endpoint;
anon/service cannot, and service lacks private schema USAGE. Imported immutable
snapshots remain unchanged. The six `save_ability` aliases translate only for an
exact sole selected class; this is not multiclass role attestation.

## Preserved failures, cleanup and next work

Actual execution fixed passive style manifest handling, ASI-pruner SQL NULL
fallthrough that changed a sealed plan, and native race-score NULL handling that
omitted fixed bonuses. Exact-preimage repairs preserve row fingerprints and
function metadata. Choice effects, casting ability, completion/navigation and
allowance counters now use source-aware consumers.

Harness failures remain recorded: hydration/redirect timing, nested equipment
rendering, pack-item expectations, dynamic HP labels and hidden duplicate counters.
An owned REST container exited 1 (OOM false; no application logs available). It
was started once. Its process limit alone increased 64→128 after 62 threads were
observed; CPU/memory limits stayed unchanged. Process pressure is an inference,
not an established exit cause. Later full stories pass. The initial native-score
failure remains in state history with the successful readback resolving it.

Cleanup verified at `2026-10-23T18:25:57Z`: recorded Next/proxy identities absent,
five task containers/two networks/two volumes removed, all three credential files
deleted, ports 3001/9997/9998/9999 closed, zero task resources. Shared Docker
engine/cache, socket backups and inherited worktrees remain. Free memory after
cleanup: about 5.74 GiB; 595 processes. Receipt:
`app-flow-runtime/runtime-teardown-readback.json`; first-cycle receipt retained.

Next: genuine multiclass acquisition with original role evidence, then remaining
catalog choice families such as expertise, Ranger selections, invocations and
metamagic. `native-multiclass-worker`/`codex/native-multiclass-20261023` starts at
`9158162`; no work from that branch is yet activated. Wider recovery/concurrency,
provider/hosted acceptance and release gates remain open. M1/R06 is incomplete.
No push, deployment, hosted change or public beta happened. M7 remains paused.

## Continuing builder work

The class picker now checks the existing classes' ability prerequisites as well
as the candidate's, following [SRD 5.1 page 56](https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf).
For example, WIS15 alone cannot qualify a STR10/DEX10 Fighter to add Cleric.
This remains an advisory numeric check; native class acquisition still requires
its own locked source/provenance validation and Add Class stays unavailable for
enrolled characters. Independent narrow source review passes.
`local-catalog-builder-20261023T183009Z` passes two files / 28 tests. The first
run preserved a stale reproduction expectation that subrace structured data was
excluded; the assertion now follows the shipped real-catalog subrace consumer.
No further runtime was started for this pure helper change.

Subsequent delivery at `4279067` adds working Rogue Expertise and correct
compound skill grants, with final Fighter/Cleric walkthroughs passing again.
Use the [Rogue application checkpoint](2026-10-23-rogue-expertise.md) for current
catalog hash, accepted source, evidence, cleanup and remaining boundaries. The
earlier level-four Fighter evidence and control/readbacks above remain preserved.
