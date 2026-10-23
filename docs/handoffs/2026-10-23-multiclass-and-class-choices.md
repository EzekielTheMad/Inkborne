# Native multiclass acquisition and SRD class choices

This continuation keeps Vercel unchanged, M1–M6/M5.5 active and M7/creature imports paused. It uses the authoritative `equipment-verification` worktree and disposable loopback Next/Auth/PostgREST/PostgreSQL runtime. No hosted schema, data, security, credentials, deployment or publication is changed.

## Delivered behavior

The app adds a secondary class through a finite native command carrying the revision loaded by the UI. The database verifies the real owner/session, original consumed acquisition proof, accessible immutable class snapshot, prerequisites for both existing and incoming classes and the total level limit. It retains the original origin journal, class commands, inventory and award. A separate acquisition profile records each secondary occurrence and its role-specific evaluation data. Readers pair that evidence with exact saved versions and producer ordering; original snapshots are never rewritten.

Class levels, subclasses, HP, ASIs, spells and derived feature pins are compiled per owning occurrence/controller. Original saving throws, starting proficiencies and equipment stay original-only; secondary classes gain their multiclass subset. Extra Attack uses each class's own level. Secondary first-level HP can use an average or a retained server draw, while original first-level HP remains fixed.

Bard Expertise at 3/10, Ranger terrain at 1/6/10, Metamagic, Pact Boons, Hunter options, Draconic Ancestry, Circle of the Land and invocations use real immutable sources. Child choices create separate durable pins. Invocation counts come from the saved Warlock table; level, actual known spell and accepted pact prerequisites are checked on save and pruned when lost. Additional Fighting Style uses its actual class/subclass owner and rejects duplicate logical styles.

Favored Enemy saves one atomic type-or-two-humanoid selection and an associated language or explicit no-language value. The supported humanoid vocabulary is visible in the UI. Native validation checks the earned source, exact branch/cardinality, distinct enemies across tiers and an accessible system language. It does not invent universal creature-language associations. Conditional tracking/recall benefits remain narrative; a chosen language has its own immutable pin. Downlevel removes retired source selections and their pins.

The class editor waits for hydration before enabling controls, preventing an initial level selection from submitting the server-rendered level. Its preview calculates saved HP through the existing HP helper and shows separate class-specific spell DC/attack values.

## Actual acceptance

The Fighter → Cleric app walkthrough passes sign-in, full initial builder, class acquisition, stale-tab refusal, independent advancement to Fighter 4/Champion and Cleric 2/Life, saved cantrips/prepared/domain spells, original-only Strength/Constitution save proficiency, HP 44 and one retained equipment award/15 gp. Lowering Fighter to 3 prunes its ASI and restores Strength 16/HP 37 while retaining Cleric spells and levels. Reloads and a foreign account's 404 pass. Administrative read-only evidence agrees with the app on exact sources, original/acquired roles, receipts/history, all five physical order bijections, revisions and closed boundaries.

Accepted family walkthroughs cover Bard Expertise 3/10 with actual sheet bonuses; Ranger terrain/Favored Enemy/Hunter selections and downlevel pruning; Sorcerer ancestry/Metamagic 3/10; Druid Land/Forest through version 2 of the genuine manifest; and Warlock invocation counts, actual Eldritch Blast knowledge, pact requirements and pruning after pact replacement. These family stories accept their changed draft choices; they do not claim a complete playable character for every class.

## Catalog and runtime installation

The prepared catalog contains 1,535 genuine normalized entries. The Land API level manifest omitted its separate genuine level-2 terrain controller. The importer now reads and validates that source and restores the controller once. A second local publication changed only `subclass/land`, producing version 2: there are 1,535 current definitions and 1,536 historical snapshots. Every original version-1 snapshot and existing character/graph row fingerprint was preserved. Exact current-head/snapshot/schema/reference checks pass.

Prepared catalog SHA256: `02805f9d1dde2281c5468671fb20bbb36f6a229555f14f8fa1407f3bed056ea6`. The earlier class-choice catalog `9e566448e9682625afd4da2e7a22bd491978f2be6728cf56a009f6ae7ddbbf6f` is archived in the held runtime's `catalog-data/class-choices-before-land-20261023/` directory. Original version-1 fingerprint before/after the Land publication: `f6ca22f51458c31f19506f10d72c921e`.

Fresh disposable stage order after the unchanged baseline is:

1. Builder steps, catalog, progression, race-score repair and Expertise companions.
2. `character-builder-multiclass.sql` (current corrected source).
3. `character-builder-class-feature-choices.sql` (current sibling-tag correction).
4. `character-builder-favored-enemy.sql` (current language-variable correction).
5. `character-builder-multiclass-integration-repair.sql`, which binds pending subclass activity and uses a prompt permanent stale-revision refusal.

The acquisition-array, class-feature-pin and Favored-language repair files apply only to their earlier exact installed preimages. Do not replay them against fresh corrected functions. Each checks exact body hashes, routine identity/ACL/attributes and closed boundaries. No general readiness/class/hit-die gate or service-role private-schema access is opened.

Independent review checked native authentication/ownership, revision checks, original-role proof, immutable source projection, per-controller graphs, receipts/history, privilege closure and helper composition. Native installation and the actual app exposed issues beyond source checks; those failures were preserved and repaired before acceptance.

## Focused verification and preserved failures

Integrated focused command: `npm.cmd test -- tests/app/builder-step-actions.test.ts tests/app/first-class-page.test.tsx tests/components/builder/stat-preview.test.tsx tests/lib/character/builder-class-roles.test.ts tests/lib/builder/class-feature-choices.test.ts tests/lib/builder/class-features-per-level.test.ts tests/lib/builder/favored-enemy.test.ts tests/character/max-hp.test.ts tests/lib/character/structured-sources.test.ts tests/transformers/subclass-choice-manifest.test.ts --maxWorkers=1`: **10 files / 102 tests pass**. Worker transformer/helper vectors and focused component checks passed separately; their counts overlap and are not added to the integrated total. Full `npm run check` and a broad repeated build/suite are intentionally omitted under the user's focused-testing instruction.

The held runtime receipts live under sibling `equipment-runtime/evidence/` and `equipment-runtime/app-flow-runtime/`; browser artifacts remain in ignored `test-results/local-app/`. Relevant successful runs before the final combined rerun:

- `local-actual-catalog-20261023T200419Z`: native multiclass actual app, one pass, 68.3 s, 26 recorded identities and none remaining.
- `local-actual-catalog-20261023T200702Z`: Bard passes; Ranger language-variable error and omitted Land controller preserved.
- `local-actual-catalog-20261023T201014Z`: Ranger, Sorcerer and Warlock pass, 103.5 s, 25 identities and none remaining.
- `local-catalog-builder-20261023T201458Z`: integrated 102 tests pass, 20.6 s, 15 identities and none remaining.

Preserved failed runs also demonstrate the empty acquisition array, subclass-link ordering, stale-revision retry delay, hydration race, sibling provenance collision and missing Land controller. Initial installation failures rolled back. Fixes retain the exact protected state and do not treat HTTP success, source tests or a health response alone as product acceptance.

## Remaining acceptance

M1/R06 remains **in progress**. Remaining class choices include special bonus spell selections and their budgets/provenance: Land bonus cantrip and conditional circle spells; Lore bonus skills; Bard Magical Secrets and Lore Additional Magical Secrets; Tome cantrips and Book of Ancient Secrets rituals; Mystic Arcanum; Wizard Spell Mastery and Signature Spells. Selecting a parent feature is not acceptance of these nested acquisitions or every combat mechanic described in its text.

Class removal, broader multiclass combinations, recovery/concurrency/provider matrices and hosted acceptance also remain open. The finite Add command is not a general class lifecycle writer. The wider enrolled-character writer fences remain required before production activation. M7 stays paused and M8 follows M1–M6/M5.5.

## Final accepted checkpoint

Implementation and browser assertions are committed through `f5d7439`. The final command uses the existing `test:e2e` script with `e2e/local-app/playwright.config.ts`, the real-catalog and class-family files, and a grep selecting only these six stories. **All six pass** in 223.3 s. Receipt: `local-actual-catalog-20261023T201751Z`; 43 recorded process identities, none remaining. The final Warlock story also asserts actual preview HP 15, DC 12 and attack +4. The final multiclass story verifies the secondary first-level server roll survives reload/reselection, then restores average HP for the expected final 37 HP. An unmet-prerequisite Bard option is unavailable and stale Add is refused promptly with native `builder_stale_action_revision`/`22023`.

Final `npm.cmd run typecheck` and `npm.cmd run lint` pass with zero warnings. Receipt: `local-creation-browser-check-20261023T201547Z`, 65.2 s, eight identities and none remaining. The integrated focused tests are the 102-test receipt above; no broader repetition was added.

The final multiclass character is `8ff834e1-5563-4b26-92dd-ba4a2dbbb515`. `supabase/verification/builder-multiclass-readback.sql` confirms the expected Fighter 3/Champion + Cleric 2/Life, Strength 16, maximum HP 37 and 15 gp; exact original/secondary roles and provenance, authentic atomic acquisition, unchanged original proof/pins, spell projections, all five row-ID bijections and closed boundaries pass. A separate read-only query confirms exactly one genuine secondary-level-one d8 draw. Receipts: `multiclass-final-native-readback.json` and `multiclass-hp-draw-final-readback.json` in the held runtime directory.

`supabase/verification/builder-class-choices-readback.sql` passes for all five final family drafts, including exact frozen pins, finite source/child authority, distinct sibling tags, Favored language pruning, spell/feature projections, Expertise eligibility, parent/producer/source-order agreement and all five row-ID bijections. The `final-family-*.json` receipts and `final-class-choices-acceptance.json` retain that evidence. These are administrative readbacks after real browser actions, not substitutes for Auth/UI acceptance.

At **2026-10-23T20:25:13Z**, teardown confirms five task containers, two networks and two volumes removed; the recorded proxy is absent; ports 3001/9997/9998/9999 are closed; and all three private credential files are gone. The shared engine/cache and inherited worktrees remain. Final free memory is 7,709,244 KiB and the process count is 605. The runtime's teardown receipt is `runtime-teardown-readback.json`.

The guard caught a timestamp-format change caused by PowerShell's automatic JSON date conversion during the final evidence write. Exact PID, parent, command, executable and creation ticks were verified before restoring the original timestamp representation and performing cleanup. The guard was not weakened.

Automatic approval review rejected removal of the task-created `class-choices-worker/node_modules` junction with only “blocked by policy” stated. It remains; no alternate deletion method was attempted. The worker has no Node processes, its dependency target and commits remain, and this does not leave the temporary app/backend running.
