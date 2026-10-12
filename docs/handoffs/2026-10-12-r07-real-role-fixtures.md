# R07.2 actual-schema fixture preparation

Local source preparation only, 2026-10-12 UTC. Worker
`C:\Users\kaios\Documents\Codex\2026-10-11\task-2\r07-real-fixtures-worker`,
branch `codex/r07-real-role-fixtures`, base `9ae5a656a7636442fd1d2767b3013ca9a43ec26b`.
Root owns integration, independent review, final combined gates and actual human G2
runtime authorization. No Docker command, fixture SQL, staged SQL, migration, hosted
operation, credentials, Auth login or HTTP request was executed in this child.

## Finite source package and authority

`scripts/equipment-runtime-fixtures.ts` adds `freeze`, `fixtures`, and separately
invoked `cleanup`. The existing R07.1 helper only exports its target verifier,
psql command builder, exact-count audit, and process-record readback. Its original
baseline/stage gates and SQL are unchanged. No dependencies or product code change.
All executable fixture modules and SQL, the full current migration inventory,
unchanged stage, Compose and existing baseline assertions are included in the
new freeze. Runtime bytes are retained before the first transport command.

The predecessor bundle contains the **original** R07.1 manifest, original G2
record, baseline journal and stage journal. Their hashes, original source SHA,
all exact engine/container/image/network IDs and post-stage catalog/count audit
are bound separately from the new R07.2 SHA. A later clean preparation commit is
allowed without rewriting old evidence or requiring new/old source SHAs to match.
Migration inventory/hashes, stage, Compose, bootstrap/audit/assertion SQL must match
the original. The old helper can differ only through the newly frozen source.

R07.1 authority or this local plan approval does not authorize fixtures/cleanup.
Execution refuses a missing/mismatched `G2`, `approvedBy: Victor`, UTC time, new
source/hash confirmation, exact predecessor target IDs, or the exact operations
`["fixtures","cleanup"]` under `R07.2-real-role-fixtures`. JSON records document
authorization already obtained from the human; editing one cannot create it.
No actual predecessor runtime/receipts currently exist, so no real fixture freeze
or execution was performed. Injected evidence in tests is expressly synthetic.

## Deterministic roots and bounded generated children

Run tag: `r07-2-20261012-a`. Exact fixed UUIDs share
`07020000-2026-4a12-8e00-` and these twelve-digit suffixes:

| Fixture | Suffix |
| --- | --- |
| owner Auth user/profile | `000000000001` |
| foreign Auth user/profile | `000000000002` |
| synthetic published system | `000000000003` |
| class definition | `000000000010` |
| passive feature definition | `000000000011` |
| earned ASI feature definition | `000000000012` |
| spell definition | `000000000013` |
| item definition | `000000000014` |
| foreign character | `000000000020` |

The original synthetic definitions pass actual `contentDefinitionSchema`, every
type-specific schema, effect schema, and the canonical definition/snapshot parsers
before SQL is packaged. Features have valid passive/asi types and required
class/level/description/defaults. The class has twenty levels and canonical
`spellcastingExtra: [spellSlug]`, not a SQL-only tier-object shortcut. The spell
and item contain their required full payloads.
The system payload also passes the actual system schema, including six ability
definitions, proficiency/content/currency arrays and creation/sheet sections.
Auth users have `.invalid` synthetic
addresses, no password/identity/session and no email/API operation; the real
signup-profile trigger supplies profiles. Content snapshots come exclusively
from the actual definition prepare/snapshot triggers.

Maximum run-owned rows:

| Table | Budget |
| --- | ---: |
| auth.users / profiles | 2 each |
| game_systems | 1 |
| content_definitions | 5 |
| content_versions | 6 (five v1 plus one real passive-feature v2) |
| characters | 3 (fixed foreign, real create, real copy) |
| character_content_refs | 6 |
| character_feature_grants | 4 |
| character_spell_grants / character_spells | 2 each |
| character_inventory / character_starting_grants | 2 each |

Create/copy, refs, grants, inventory and snapshot IDs use unchanged production UUID
generation. Actual returned/read-back IDs are journaled after confirmed phase
commit, before further SQL. No deterministic UUID override, narrowed schema,
stubbed helper, direct snapshot insert or disabled trigger is used. Budgets are
maximums; every phase has exact permitted count deltas and retains prior IDs.
No campaigns, real accounts, Storage fixtures, narrative children or feat-selection
content are introduced. The ASI is an earned ability allocation only; feat-selection
copy requires a separately reviewed sixth-definition fixture.

## Committed scenarios and invariants

Ordered phases: preflight, seed, create, mechanics, award, consume, replay,
catalog-drift, copy, roles. Each mutating phase commits before the readback/journal.
No transaction is credited as durable PostgreSQL proof until future real execution.

- Actual service-role create makes exactly one character/eligible marker. Owner
  sets canonical class choices, state and v1 class ref; real materializers create
  two feature grants and one spell grant. Normal owner sync creates derived refs
  and a linked prepared spell. The real ASI RPC stores Constitution +2 and must
  restore its transaction-local privileged mutation setting.
- Actual trusted award pins one quantity-two item and adds 15 GP to the existing
  2 GP. Owner then reduces quantity to one and spends to 4 GP. A later transaction
  resolves and commits exact receipt replay using deliberately stale expectations;
  exact JSONB receipt, quantity one, GP four and unrelated state must remain intact.
- Privileged `postgres` changes only the fixed **synthetic platform passive feature**
  description and supported Strength +2 effect after source v1 pin/grant capture.
  Real triggers create version two. Definition identity/system/source/scope/owner
  remain unchanged; v1 full snapshot remains unchanged. Five definitions/six
  snapshots is the explicit amended budget.
- Actual owner copy must retain the source's v1 feature ID/version/data/effects
  despite current definition v2, exact source pins/ASI/state, remapped grants and
  spell links, a distinct inherited-completion marker, and quantity-one inventory
  provenance pointing at that marker. Full source character and child-row JSON
  before/after must match. Copy itself materializes controller grants and remaps
  spells; the fixture explicitly calls ordinary feature/spell sync after copy to
  materialize derived feature refs. This is not attributed to copy alone.
- Transaction-local `SET ROLE` plus `request.jwt.claim.sub` and `request.jwt.claims`
  verifies current role and `auth.uid()`. Owner/API and anonymous trusted-RPC or
  direct marker DML denials require SQLSTATE `42501`. Owner forged provenance
  requires `42501`; stripping/moving it requires `23514`. Foreign reads and RLS
  updates must return zero rows; nonowner copy/trusted resolution requires `42501`.
  Trusted completed-receipt mutation requires `23514`. Privileged full run-owned
  row JSON before/after every denial slice proves marker, original receipt,
  provenance, quantity and unrelated state invariants. Arbitrary exceptions do
  not count as denial. Inherited-copy resolution must prohibit another award.

This exercises PostgreSQL privilege checks under trusted SQL role claims. It does
not validate Auth issuing/verifying JWTs, HTTP/PostgREST role mapping, browser/API
flows, concurrency, fault injection or response-loss behavior. PostgreSQL documents
the permission semantics and limitations of [SET ROLE](https://www.postgresql.org/docs/17/sql-set-role.html);
Supabase distinguishes [grants and RLS filtering](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Freshness, uncertain commits and closed cleanup

Before operations, recheck original daemon/container/image/network/mount isolation
and compare the selected catalog plus exact table counts with the last committed
phase audit. After each phase, catalog must be unchanged and every table-count
change must equal the exact approved owned-ID delta; unrelated counts stay fixed.
Selected catalog/count checks do not detect every same-count mutation of unrelated
row contents. Full run-owned invariants are checked separately in fixture SQL.

The shared ownership assertion enumerates **every actual UUID foreign-key column**,
including composite FK columns and unknown public/private/auth/storage child tables.
Any row referencing a recorded run UUID outside that table's exact ID allowlist
blocks readback/cleanup. Recorded owned rows with a nonnull UUID FK parent outside
the closed run graph also block it. Cleanup checks source/copy/foreign actor-system-name roots,
original receipt and existence of every recorded ID, then deletes exact derived
refs, spells, inventory, grants, controller refs, markers, characters, snapshots,
definitions, system, profiles and Auth users in dependency order. No pattern delete,
TRUNCATE, broad teardown or assumed cascade completion. Exact owned residue must
be zero and the final catalog/count audit must equal the **post-stage, pre-fixture**
baseline; the installed stage schema remains.

First SQL failure, timeout, missing/malformed readback, commit/journal write failure,
catalog/count drift or ID mismatch leaves an uncertain/incomplete journal and stops
all later work. No retry, resume, continuation, automatic cleanup or deletion is
allowed. An uncertain generated-ID outcome needs separately authorized read-only
discovery evidence; this helper provides no discovery/deletion shortcut. Disconnect
or killed psql is not evidence of server rollback. Future runtime owner inspects
exact backend/client state before any separately reviewed recovery.

Existing transport limits remain 30-second metadata, 120-second psql, 60-second
statement/5-second lock timeouts, 2 MiB output and 256 audited tables. The fixture
run adds a frozen 15-minute total and 6,500-command budget; clients receive the
remaining deadline. Exact spawned PID/parent/cwd/arguments/start/finish records join
the journal. Output records only bounded synthetic IDs/receipt and catalog metadata;
raw SQL failures and row bodies are suppressed. No server or listener is started.

## Future authorized entrypoints

After independent review and final clean commit, root preserves original evidence
files and assembles a scratch-only predecessor bundle with original `manifest`,
`approval`, `baseline`, `stage`. Prepare existing `evidence/r07.2` directory under
the fixed runtime scratch target. Freeze is local and does not invoke Docker:

```powershell
node --import tsx scripts/equipment-runtime-fixtures.ts freeze --predecessor ORIGINAL_SCRATCH_BUNDLE.json
```

After **actual human G2 fixture+cleanup authorization**, use new saved manifest,
approval and its exact new hash. Never fabricate authorization or predecessor results:

```powershell
node --import tsx scripts/equipment-runtime-fixtures.ts fixtures --predecessor ORIGINAL_SCRATCH_BUNDLE.json --manifest NEW_FIXTURE_MANIFEST.json --approval ACTUAL_G2_FIXTURE_APPROVAL.json --confirm-g2-manifest NEW_EXACT_HASH
node --import tsx scripts/equipment-runtime-fixtures.ts cleanup --predecessor ORIGINAL_SCRATCH_BUNDLE.json --manifest NEW_FIXTURE_MANIFEST.json --approval ACTUAL_G2_FIXTURE_APPROVAL.json --confirm-g2-manifest NEW_EXACT_HASH --fixture-receipt COMPLETED_FIXTURES_RECEIPT.json
```

CLI evidence inputs must be existing bounded JSON beneath the exact scratch
evidence directory. Receipts are exclusive on first write and never overwrite an
existing attempt. Cleanup requires a completed same-source/same-container fixture
receipt. Runtime teardown is outside this helper and remains root-owned G2 work.

## Local verification

`npm.cmd ci --ignore-scripts`: 800 packages, exit zero; no dependency/lock edits.
Shell PID 53680, parent 30200, worker cwd, start `2026-10-12T01:36:43.5379530Z`,
finish `2026-10-12T01:37:20.5604701Z`. No runtime process or listener was started.

Focused transport/source tests, typecheck and changed-file lint are the child gates.
Verified commands/results:

- `npm.cmd test -- tests/scripts/equipment-runtime.test.ts tests/scripts/equipment-runtime-fixtures.test.ts`:
  **60 passed** (33 original R07.1 + 27 new). Shell PID 38644, parent 30200,
  worker cwd, UTC start `2026-10-12T01:45:51.4299734Z`, finish
  `2026-10-12T01:46:21.1827863Z`, exit zero.
- After the final canonical system-payload/null-safe SQL-source refinements,
  `npm.cmd test -- tests/scripts/equipment-runtime-fixtures.test.ts`: **27 passed**,
  exit zero, 19.21 seconds (tool session 51830).
- Final `npm.cmd run typecheck`: passed, exit zero.
- Final `npm.cmd exec -- eslint scripts/equipment-runtime.ts scripts/equipment-runtime-fixtures.ts scripts/equipment-runtime/fixture-data.ts tests/scripts/equipment-runtime-fixtures.test.ts --max-warnings=0`:
  passed, exit zero, no warnings.
- Task-scoped Node/cmd process readback after completion: no remaining matching
  worker processes. No server, browser, SQL runtime or listener was started.

Their injected fake Git/evidence/transport models do not execute SQL, reproduce
PostgreSQL locking or prove actual G2 acceptance. The preexisting 45-case narrowed
PGlite suite was inspected, not reexecuted under this no-SQL task. Full check/build
and browser gates remain root-owned; no browser/product behavior changed.

Remaining R07 children: actual authorized full baseline/stage/fixture execution,
concurrency and both lock orders, fault/rollback boundaries, response-loss recovery,
fresh second replay, exact resource teardown/residue/process proof, HTTP/JWT/provider
acceptance. SQL compatibility/privileges/trigger behavior remain unexecuted and must
fail visibly rather than cause baseline/stage/helper repair inside this fixture child.
