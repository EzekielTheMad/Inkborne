# Fiend expanded choices and added-class removal: actual app checkpoint

Fiend's ten expanded spells now extend ordinary Warlock selection eligibility
and consume the normal known-spell allowance. Added-class removal and fresh
re-acquisition also save/reload in the actual local app. Two browser stories
and eight read-only native snapshots pass. The starting class remains fixed,
as the user selected. This accepts these bounded M1/R06 builder flows; M1 is
still in progress. Vercel is unchanged and M7/creature imports remain paused.

The continuation remains `equipment-verification`, branch
`codex/launch-integration-20261011`, based on `655db92`. Product changes are
integrated through `9d27f35`; actual-workflow/readback/spec source is `7c16608`.
The profile test fixture correction is `1e3a7c8`; final query/unused-helper
corrections are `be40e4c`. The old
`C:\Projects\Inkborne` backup and all inherited worktrees/junctions remain.
Worker branches `codex/fiend-catalog-20261023`, `codex/fiend-native-20261023` and
`codex/fiend-ui-20261023` retain their local checkpoints.

## Verified actual application behavior

| Authenticated local draft | Saved, reloaded and checked in the sheet | Source/role result |
| --- | --- | --- |
| Fiend Warlock 1 → 3 → 5 → 7 → 9 | All five earned tiers expose their two ordinary candidates. Ten selected leveled spells and two ordinary cantrips save/reload. A third level-one known pick disables saving. Choosing the patron creates zero free spell rows. | Dropping to level one prunes higher expanded choices. Clearing the subclass removes Burning Hands while retaining Charm Person, Eldritch Blast and Mage Hand. |
| Starting Fighter 4 / Champion with STR +2; added Life Cleric 2 | Cleric cantrips, ordinary prepared spells and Life's fixed grants save/reload. Removing Cleric retains Fighter 4, STR 17, maximum HP 32, the original occurrence and every retained Fighter pin ID. | The old Cleric occurrence ends; a stale tab is rejected. Re-adding Cleric creates a different accepted occurrence/controller and restores none of the old subclass/spell choices. The original Fighter has no removal control. |

These are bounded drafts. They do not claim completed race/background/equipment
and every class choice in these two characters. Prior full Fighter/Cleric and
multiclass acceptance remains in the earlier handoffs. Rolled-HP recovery for
an ended/re-added occurrence is bound in the reviewed native profile; this
actual browser story uses average HP and does not claim a new rolled-HP UAT.

Accepted disposable character IDs, removed with the owned database volume:

- Fiend: `be372d2a-0397-4dea-9de4-384f1f17a6f1`.
- Removal/re-addition: `56a77cd1-291c-4dcf-af1e-88ae66794925`.

Fiend's accepted story is in the two-story receipt
`local-actual-catalog-20261023T220136Z`: Fiend passed, while the removal fixture
requested a nonexistent standard-array value of 16 and failed before removal.
The fixture now assigns the valid standard array and expects STR 17 after ASI.
The narrow removal rerun passes in
`local-actual-catalog-20261023T220437Z`, 49.5 seconds including wrapper overhead;
all 29 observed identities exited. An intermediate removal run confirmed the
first removal, then incorrectly required HTTP 200 from the deliberately rejected
stale action. The final story checks the visible stale refusal instead.

Browser/native directories:

- `test-results/local-app/builder-2026-10-23T22-01-40-167Z` (accepted Fiend).
- `test-results/local-app/builder-2026-10-23T22-04-42-989Z` (accepted removal).
- Checked aggregation: `..\equipment-runtime\app-flow-runtime\fiend-removal-actual-readback.json`.

The eight snapshots agree on immutable provenance, earned candidates, zero
Fiend free rows, ordinary/bonus choice validity, retained pin identities,
original/ended/new occurrences, receipt progression, parent/order revision and
all five row-order bijections. No external origins or browser page errors were
observed. All transaction capabilities are gone, all thirteen readiness gates
are false, class/hit-die gates are false and service_role has no private-schema
usage. No product code changed between the two accepted stories.

## Source and focused verification

The genuine cached 2014 catalog validates all 1,535 definitions and reference
closure. Fiend's obsolete `spellcastingExtra` enrichment override was removed;
Life/Devotion/Land semantics remain unchanged. Current prepared SHA256:
`125ecb425f8b92b0d4e39fd78cb5d1a461bbd882fd9055e21f57c6cbdd5c00e1`.
The source manifest remains
`60e35087457442e13b2ca8404b129baa934684a02937720a22770894c207e40e`.
The previous prepared catalog/manifest are preserved in
`..\equipment-runtime\catalog-data\fiend-before-20261023`.

A fresh disposable official PostgreSQL/Auth/Storage/PostgREST profile replayed
83 baseline migrations, 17 prior stages and the current builder/class-choice/
bonus companions. Both new companions were installed with exact function
preimage/postimage checks and unchanged owner/ACL/attributes:

- `character-builder-expanded-spells.sql` SHA256:
  `c3bcad4fcdd9d12b08840c5e0a400e409446dcdfedbc59f6421b133ef4add7d0`.
- `character-builder-class-removal.sql` SHA256:
  `50dc0264610f39c2d9eb5abefbaf7e167b1ba0bdbb2d8e39bd76384cc557e22e`.

All catalog snapshots are version one in this fresh runtime. Historical hosted
snapshots are untouched. Old Fiend pins keep their prior meaning and display
an explicit warning; correcting/repinning them requires a separate policy.
Native removal preserves acquisition/receipt/history evidence, rebuilds only
the removed source closure and normalizes retained preparation/HP budgets.

- Seven focused Fiend/transformer/casting/completion/UI files: **68 pass**,
  receipt `local-catalog-builder-20261023T215014Z`.
- Five final removal/profile/UI/action/subclass files: **34 pass**, receipt
  `local-catalog-builder-20261023T220855Z`. This includes executing the actual
  profile installer and the final subclass-clear query correction.
- Final `npm.cmd run typecheck` passes in
  `local-creation-browser-check-20261023T221023Z`. That invocation then failed
  lint's zero-warning rule on an unused E2E helper; the helper is removed.
- Final zero-warning `npm.cmd run lint` passes with task-only
  `NODE_OPTIONS=--max-old-space-size=512`, receipt
  `local-lint-only-20261023T221324Z`, 45.7 seconds. All five observed identities
  exited. The broad suite and production build were not repeated.

The in-memory PostgreSQL fixture stubs admission and locking. It checks compiler
behavior and executes the exact guarded profile installer; actual local browser
and native evidence establish separate real persistence/ownership observations.
[Contract](../specs/2026-10-23-fiend-expanded-list-and-class-removal.md),
[readback source](../../supabase/verification/builder-bonus-spells-readback.sql),
[actual stories](../../e2e/local-app/fiend-and-class-removal.spec.ts).

Preserved failures led to bounded corrections: removal installation initially
rejected an unparenthesized CASE expression and rolled back. The actual profile
fixture was extended to exercise that installer; its missing receipt row type
was supplied. The legacy-warning test was narrowed from ambiguous implicit
status roles, and subclass-clear test query options were corrected for the
Testing Library types. Clicking the selected Fiend card was idempotent, so an
explicit Clear subclass control was added. An initial local first-class 404 did
not recur in fresh flows after temporary diagnostics were removed; no product
repair is attributed to that transient result. Diagnostic lines are absent from
the committed product source. Next dev emitted Gzip listener-count warnings;
no listener limit or unrelated runtime setting was changed.

During final checking, machine memory reached 93% committed and 0.38 GiB free.
The identity-checked lint guard found that the first lint process had already
exited, so it stopped no process. The bounded-heap retry completed after the
unused-helper correction. Unrelated applications were not controlled.

## Cleanup and remaining M1 work

At `2026-10-23T22:07:25.3204123Z`, fresh teardown inspection confirmed all five
owned containers, two networks, two volumes and three private credential files
were absent; the recorded proxy identity was absent and ports 3001/9997/9998/9999
were closed. Evidence is `..\equipment-runtime\app-flow-runtime\runtime-teardown-readback.json`.
The shared Docker engine/cache, inherited worktrees and dependency junctions
remain. Before/after resource evidence is retained; all recorded task check/
browser identities exited. No junction cleanup was retried after the prior
automatic-review block. No push, deployment, hosted migration or live
configuration change occurred.

Next is recovery after a lost ordinary builder save response and reload.
`builder/step-actions.ts` currently creates the operation ID on the server and
attempts one immediate receipt lookup. Reuse the account-scoped first-class
pending-intent pattern to preserve that exact operation across reload, clear it
on sign-out/account change and exercise a lost-response recovery in the app.
Then address reviewed historical correction/repin, complete playable caster
drafts, broader combinations/concurrency and enrolled writer/copy/campaign
lifecycle fences before general route activation. Hosted/provider and backup/
restore acceptance remain separate gates. Arcanum/Mastery/Signature free-cast
spending and rest recovery remain M6 gameplay work. M1–M6/M5.5 precede M8;
M7/creature imports stay paused.
