# D1 durable roll/state contract — proposal and current-gap evidence

> **2026-10-12 continuation:** This is characterization/proposal evidence, not implemented durability. The [launch ledger](../LAUNCH-ACCEPTANCE.md) keeps implementation and acceptance open. Ordinary local code/SQL-file edits and offline tests may proceed within the selected requirement; actual runtime/live data/schema/security/persistent-credential operations require their applicable approvals.

October 11, 2026. Source inspected: `56db57e46e93783356cd132240350784accf1f28`,
branch `codex/durable-roll-contract`, clean sibling `d1-contract-worker` before this slice.
This refines the [existing proposal](2026-10-02-durable-character-actions-proposal.md).
No product, SQL migration, grant, hosted schema/data or credential change accompanies it.

## What the current source guarantees

`lib/character/state-writer.ts` serializes one mounted provider's writes and refuses
stale/pending local actions. `lib/sheet/update-state.ts` classifies an unconfirmed
conditional response as reload-required and does not automatically replay it.
`20261003223252_conditional_character_state_owner_cas.sql` locks the owned character,
compares the raw JSON state and merges the patch in one transaction. That protects
an ordered changed-state snapshot; it has no monotonically increasing revision.

`CharacterProvider.spendHitDie` generates/logs a roll through `roll()` and separately
saves HP/die-spend. `recordRoll` and `lib/supabase/rolls.ts` use an independent insert.
Death-save insertion confirmation and concentration gates likewise do not put roll
history and resulting state in one commit. A local roll ID is not sent as a durable
operation key. A missing/changed current HP is not a receipt for an earlier command.

## Executable gap evidence

Run repository scripts:

```powershell
npm.cmd test -- tests/supabase/durable-action-current-gaps.test.ts tests/lib/character/durable-roll-current-gaps.test.tsx
```

Eight checks pass while asserting **remaining weaknesses**, not durability acceptance:

| Check | Observed result | Evidence boundary |
| --- | --- | --- |
| Two ordered conditional intents from one state | First applies, second conflicts | Real current CAS SQL in synthetic PGlite |
| State A→B→A via older writer | Old A intent applies | Actual current CAS + legacy patch SQL; ordered interleaving |
| Changed Constitution or class choices, same state | State-only CAS applies stale derived patch | Actual CAS SQL; synthetic extra columns |
| Legacy writer after conditional success | Legacy HP overwrites conditional HP | Actual legacy RPC SQL |
| Confirmed roll, rejected hit-die state | Roll remains; state returns to baseline | Actual provider; simulated persistence |
| Pending roll insert, accepted hit-die state | Die/HP state is confirmed before insertion finishes | Actual provider; deferred insert |
| Simulated commit then lost state response | UI rolls back; simulated stored state remains spent/healed; explicit repeat is gated before RNG | Actual provider; simulated committed boundary |

The first SQL fixture attempt lacked `service_role` required by the existing grant
revocation migration; it failed setup (three provider checks passed, five SQL checks
skipped). The fixture role was added; all eight then passed. PGlite has one connection;
none of these checks proves concurrent locking, effective full Supabase permissions,
roll authenticity, browser reload retention or real committed-response-loss recovery.

Final focused rerun: eight passed in 2.29s; `npm.cmd run typecheck` passed after
removing a fixture `natural: null` value disallowed by the existing RollResult type.
Repository `npm.cmd run lint` scanned the new files and reported only the ten
inherited L1 findings at this worker's base; no new-file finding. `git diff --check`
passed. Combined `npm run check` is reserved for the orchestrator after L1 integration.
No new product/browser behavior was added, so no new browser server or E2E run was
started. Worker-owned TypeScript/Vitest/lint processes exited; no listeners started.

## Smallest proposed durable boundary

Start with **one hit-die command**, preserving the existing healing/clamping/spend
rules. Death saves and concentration are subsequent separately reviewed adapters;
ordinary manual dice remain append-only display rolls and carry no action receipt.
Do not combine creation or natural-key starting-equipment uniqueness with gameplay
operation IDs: different IDs can represent legitimate repeated actions.

Proposed request: `character_id`, opaque UUID `operation_id`, command `spend_hit_die`,
selected class slug, `expected_revision`, and server-issued dependency fingerprint.
The fingerprint identifies the rules/source snapshot shown to the client. The server
recomputes it; it is never authority for access, HP limits, costs or a supplied roll.
Canonicalization is versioned, ignores JSON object key order, preserves array order,
and binds character, command, chosen class, expected revision and dependency version.

Proposed schema and API (names are design targets, no DDL is supplied):

| Object | Exact responsibility |
| --- | --- |
| `characters.action_revision` | Nonnegative nonnull bigint initialized to 0; database-controlled, advances for every relevant state/base-stat/choice/owner/campaign/level and child mechanical mutation, including legacy traffic |
| `character_action_receipts` | PK `(character_id, operation_id)`; character FK, verified actor UUID, contract version, command, canonical intent/fingerprint, accepted result JSON, before/after revision, committed timestamp; owner-authorized reads, immutable trusted writes |
| `character_rolls.action_operation_id` | Nullable UUID; composite FK `(character_id, action_operation_id)` to receipt; partial unique key for this one-roll command; ordinary rolls remain null |
| Authenticated command and receipt-lookup entry | Verified actor from session, ownership/access check before returning any receipt; same ID + different canonical intent conflicts |
| Internal transaction | Locked revision/source validation, authoritative accepted roll, state + receipt + linked roll in one commit; inaccessible/no-match never reports success |

A replay authenticates and checks current ownership **before** exposing the receipt.
An identical committed request then returns its original result before comparing
today's revision, HP, remaining dice or source eligibility. Otherwise subsequent
changes would prevent recovery of an already accepted action. Receipts report the
original resulting revision; the client separately refreshes current state and must
not overwrite it with an older receipt snapshot. Owner transfer must not disclose
the receipt to the former owner; actor metadata never grants continuing access.

No permanent pending row is needed for the minimum transaction: lock the character,
check receipt, validate expected revision and dependencies, compute accepted result,
write receipt/state/roll, commit. Same-ID contention serializes and returns one stored
result. Different IDs at one revision produce one acceptance and one stale rejection.
Errors before commit leave no durable state/receipt/roll residue; a lost response
after commit is unresolved until an authorized lookup/replay returns the receipt.

Receipt absence on a reachable primary proves only no visible committed receipt at
that read instant; an original transaction may still be running. Retrying identical
intent **with the same ID** through the transaction waits/serializes safely. A new ID,
fresh RNG or merely rereading HP cannot resolve the old outcome. Offline or access
loss remains unresolved; the client preserves the operation ID and shows recovery.

## Derived inputs and old/direct writer closure

Do not ship a revision increment alone: it detects stale future commands but does
not prevent an old direct absolute HP patch overwriting a newly accepted action.
Before enabling this command, approve a writer map and fence affected mechanical
fields at the database boundary. No browser-settable session flag is a trust marker.

| Existing paths to reconcile | Required approved outcome |
| --- | --- |
| `patch_character_state`, `patch_character_state_if_current`, direct `characters` updates, `character-client.ts` | Mechanical writes use revision-aware domain/compare-and-apply entrypoints; old mechanical writes fail with an explicit upgrade/reload result. Reviewed independent narrative/note/color updates retain their scoped behavior |
| Builder ability/class/background/feat RPCs and direct choice updates | Take character lock and advance mechanical revision; preserve atomic pin/grant behavior and PR101 owner boundary |
| `character_content_refs` and feature/spell grants | Inserts, deletes and version changes invalidate the character's mechanical snapshot under the same lock; no missing-parent success |
| `character_inventory` equip/remove/currency and `character_spells` prepare/pin | Inventory/spell changes that affect this command's dependencies participate; no generic data cleanup |
| Ownership, campaign membership/sharing, campaign rules, game-system rules, content visibility/version | Validate fresh accessible immutable pinned sources; lock relevant shared access/rule rows through acceptance or use an equally reviewed serializable protocol |

For the first hit-die slice, dependencies include class pin IDs/versions, class level
and HP history/choices, evaluated Constitution effects, active effects/equipment that
affect it, max-HP sources, system rules and relevant campaign/access state. Same JSON
state can produce different mechanics when these inputs change. Character-local
revision closes ABA for participating writers; immutable source versions plus fresh
access/rules validation close shared dependencies. Unpinned or unresolved source
inputs reject the command rather than falling back to an assumed catalog definition.

Use a documented deterministic lock order across commands and dependent writers:
affected character IDs sorted, then child/dependency rows by table and stable ID.
Shared permission/rule mutations that cannot follow that order require a reviewed
separate strategy; do not claim closure before tracing their actual paths. PostgreSQL
row locks block conflicting writers until transaction end, but lock order still needs
real multi-connection tests ([PostgreSQL locking](https://www.postgresql.org/docs/17/explicit-locking.html)).

## Decisions, rollout and rollback requiring approval

Recommended authority: generate the accepted hit-die roll at the trusted server
boundary once and store its full existing breakdown; preserve current die/Constitution
math. Victor must approve roll authority/audit, one-command scope, receipt retention
and operation-ID recovery storage (including user/account change and sign-out). Keep
receipts for the character lifetime initially; deletion follows authorized character
deletion, never a retry TTL that permits an old ID to execute again.

1. Review the complete writer/fence and permission diff, effective function bodies,
   generated types, migration ordering and dependency locking before DDL work.
2. Approve implementation/schema/security scope in a disposable local database;
   replay full reconciled migrations and test the matrix below. No hosted approval
   is implied. Preserve baseline independent edits and copy/grant behavior.
3. Deploy additive schema/API under a default-off gate only after separate release
   approval. Upgrade clients and verify old-client mechanical refusal before enabling.
4. Enable only after receipts/revision/grant/rollback and real browser recovery pass
   in an approved target. No sequential state/roll fallback after an uncertain result.
5. On failure, turn the command gate off and stop affected gameplay entrypoints;
   retain receipts, revisions and fences. Do not reenable legacy mechanical writers,
   delete receipts, reverse already accepted dice spends or drop schema as a rollback.

Required acceptance: same-ID parallel replay; changed-intent ID reuse; different IDs
one revision; two committed valid sequential actions; precommit faults at every write;
commit then lost response/reload; ABA; base-stat/choice/pin/equip/access changes during
planning; old RPC/direct writer before and after command; foreign/missing/anonymous
denials; account switch; retained/reloaded operation-ID recovery; immutable receipt,
exact one linked roll; no residue after rollback. Local checks above are evidence for
why this matrix is necessary, not substitutes for it.

The smallest next decision is approval to implement this one-command schema/API and
writer fence locally, plus the four product policies. Hosted fixtures and deployment
remain separately named approval requests. Local D1 analysis/tests are complete;
durable behavior remains blocked pending those decisions and real runtime evidence.
