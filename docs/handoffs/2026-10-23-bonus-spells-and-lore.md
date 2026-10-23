# Bonus spell choices and Lore skills: actual app checkpoint

The 14 remaining source-owned bonus-spell groups and Lore's three bonus skills
save and reload in the actual local app. The four focused browser stories pass,
with eight native PostgreSQL readbacks agreeing on earned source owners, exact
immutable tuples, physical rows, receipts, revisions and all five row-order
bijections. This accepts the bounded bonus-acquisition slice. R06/M1 remains in
progress; Vercel and hosted data/configuration are unchanged and M7 is paused.

The continuation is `equipment-verification`, branch
`codex/launch-integration-20261011`, based on `dc13dbf`. Product and verification
source is integrated through `1323c18`; the import-cycle correction is
`8c73538`. The old `C:\Projects\Inkborne` backup and inherited worktrees were
preserved. Worker branches `codex/bonus-catalog-20261023`,
`codex/bonus-native-20261023` and `codex/bonus-ui-20261023` retain their checkpoints.

## Verified application behavior

| Actual authenticated draft | Saved, reloaded and checked in the sheet | Source-loss result |
| --- | --- | --- |
| Bard 18 / Lore | Three new Lore skills; Lore 6 Additional Magical Secrets; regular Secrets at 10/14/18. Eight bonus spells plus 16 ordinary known spells. A seventeenth ordinary selection disables saving. Secrets cantrips reserve known places without consuming ordinary cantrip slots. | Bard 5 loses unearned Secrets, retains three earned Lore skills and eight permitted ordinary spells. |
| Druid 9 / Land | One bonus Druid cantrip; all eight Forest spells at 3/5/7/9. Coast replacement changes the conditional spell list and retains the independent bonus cantrip. | Druid 1 removes the subclass's cantrip, terrain and fixed spells. |
| Warlock 17 | Three Tome cantrips, two first-level Book rituals and all four exact-level Arcanum picks. Their separate allowances and source labels appear in the builder/sheet. | Chain replaces Tome, removing dependent cantrips, rituals and invocation; level 10 removes Arcanum. |
| Wizard 20 | First- and second-level Mastery plus two third-level Signature choices use four saved book rows. Signature annotates two existing rows as always prepared; Mastery creates no duplicate known rows. | Removing book spells prunes dependent choices. Level 17 removes all advanced annotations/choices and retains the two remaining ordinary book rows. |

These are deliberately bounded draft workflows, not claims that every required
ordinary spell/ASI/proficiency choice in every character was completed. The
Wizard draft uses four of its potential 44 book entries. The existing broader
Fighter/Cleric and multiclass acceptance remains in the previous handoff.

Accepted disposable character IDs, now removed with the owned database volume:

- Bard: `71d4fa6e-b287-421c-bf95-04e748886920`.
- Druid: `1d18db57-70eb-42f8-bf86-867e58cc8616`.
- Warlock: `70b9a849-1760-40f3-b33e-6d1784fb91c2`.
- Wizard: `259e1777-85d3-4e2f-bd5d-8b419a9fe88c`.

## Source, native installation and focused checks

The genuine cached 2014 catalog validates all 1,535 definitions and reference
closure. Prepared SHA256:
`1a0d379f8f0a79c3331b43b79d16873e9c890777ae20fc6d4fe413d4a4fa0820`.
The source manifest remains
`60e35087457442e13b2ca8404b129baa934684a02937720a22770894c207e40e`.
The prior prepared catalog was preserved in
`..\equipment-runtime\catalog-data\bonus-before-20261023`.

The fresh disposable official PostgreSQL/Auth/Storage/PostgREST profile applied
83 baseline migrations, 17 prior native stages, the current builder/class-choice
companions and `character-builder-bonus-spells.sql`. New catalog snapshots are
all version 1 in this fresh runtime; this is separate from the previous run's
historical Land publication. No hosted snapshots were changed. Final companion
SHA256 is `57b5d817f128164aff89660f2e20aa59c7bababb96c4b47d7f6bffc4c23867b2`.
The final bonus normalizer body MD5 is `0a58bc2691fb4586a753ae2e8c7701b8`.
Two exact owner/ACL-preserving helper repairs happened before any app characters
were created; the fresh source includes both corrections.

- Eight relevant unit/helper/transformer/casting files: **85 tests pass**,
  receipt `local-catalog-builder-20261023T210321Z`.
- After the final immutable-version collision correction and schema import
  separation, three affected files: **21 tests pass**, receipt
  `local-catalog-builder-20261023T211558Z`. This overlaps the earlier 85 and must
  not be summed into a unique-test total.
- `npm.cmd run typecheck` and zero-warning `npm.cmd run lint` pass on the final
  source; receipt `local-creation-browser-check-20261023T211716Z`, 130.8 seconds,
  all eight observed check process identities exited.
- `npm.cmd run test:e2e -- --config e2e/local-app/playwright.config.ts bonus-spell-choices.spec.ts`:
  **4 pass**, 203.8 seconds including wrapper overhead, receipt
  `local-actual-catalog-20261023T211131Z`. All 84 observed browser/check process
  identities exited. No external origins or browser page errors were observed.
- Browser/native files:
  `test-results/local-app/builder-2026-10-23T21-11-37-592Z`.
  Aggregated checked evidence:
  `..\equipment-runtime\app-flow-runtime\bonus-spells-actual-readback.json`.
- Readback source:
  [builder-bonus-spells-readback.sql](../../supabase/verification/builder-bonus-spells-readback.sql).
  Acquisition and budget contract:
  [bonus-spell specification](../specs/2026-10-23-builder-bonus-spells.md).

The final native snapshots leave zero transaction capabilities, all thirteen
readiness gates false, class/hit-die gates false and service_role without private
schema usage. The helper tests use an in-memory PostgreSQL environment with
stubbed admission/locking; the browser/native readbacks supply separate actual
local application evidence. Hosted/provider, broader concurrency and recovery
acceptance is still open. No broad suite or repeat production build was run.

Preserved failures led to bounded fixes: the installation's budget postimage
guard initially rejected an incorrectly calculated expected hash and rolled
back; typecheck caught a missing sheet JSX brace; actual login then caught the
feature-schema/helper import cycle. Both code issues were fixed before the
successful four-story run. The interrupted first browser receipt is
`local-actual-catalog-20261023T210908Z`; its 27 observed identities exited.
Independent review also corrected Signature preparation intent/overflow,
historical fixed/book tuples, malformed class-list eligibility, cross-choice
duplicates and fixed-grant collisions with newer ordinary copies.

## Cleanup and next work

Memory pressure reached the local guard, so the task's server was stopped.
After the user freed headroom, the verified browser run stayed within the
available budget. Unrelated applications were not controlled. Next dev emitted
Gzip listener-count warnings; there were no browser errors or failed workflow
requests in the accepted run. No listener limit or unrelated runtime setting
was changed.

At `2026-10-23T21:18:00.9235175Z`, fresh teardown inspection confirmed all five
owned containers, two networks, two volumes and three private credential files
were absent; the recorded proxy identity was absent and ports 3001/9997/9998/9999
were closed. Evidence is `..\equipment-runtime\app-flow-runtime\runtime-teardown-readback.json`.
The shared Docker engine/cache and all worktrees/dependency junctions remain.
No dependency-junction cleanup was retried after the prior automatic review
block. No push, deployment, hosted migration or live configuration change occurred.

R06/M1 still needs class removal, broader combinations/recovery/concurrency,
historical correction/repin policy and hosted/provider acceptance. The Warlock
readback also exposed an existing catalog correction for the next builder
slice: Fiend's ten expanded-list spells currently appear as always-prepared
feature grants. They should extend ordinary selection eligibility instead of
being free acquisitions. The accepted new nine bonus rows are separately owned
and correctly pruned; the existing ten subclass rows remain explicitly open.
Do not count this checkpoint as complete Warlock spell-list or overall M1
acceptance. Arcanum/Mastery/Signature free-cast spending and recovery are also
separate gameplay work. M1–M6/M5.5 continue before M8; M7/creature import remains paused.
