# Starting-equipment transaction: local review stage

## Character command database row locks — separate closed subcheck

`character-command-row-locks.sql` adds only two postgres-owned invoker functions
after the Auth/profile/character tables and existing writer guard are present.
The strict finite context and current row checks run under user/session/profile
SHARE and guard/owned-parent UPDATE locks; native expiry is checked after every
acquisition and final status reread. The void result conveys no account payload,
JWT verification, configured-session validity or accepted save. No API EXECUTE,
Auth grant, role, policy, readiness or existing Auth-helper change is included.
All62 focused reduced-schema PGlite tests passed; native roles/RLS/config/provider
lock waits remain unverified. [Checkpoint](../../docs/handoffs/2026-10-22-character-command-row-locks.md).
The [prepared native profile](../../docs/specs/2026-10-22-character-command-native-row-check-plan.md)
now has a reviewed five-file metadata/fixture pack, persistent three-session runner
and strict new-scope launch package. [Three preparation checkpoints](../../docs/handoffs/2026-10-22-character-command-three-checkpoints.md)
record the local evidence and wider unimplemented matrix. No native row-check run,
provider acceptance or save activation follows; previous baseline-only G2 approval
does not authorize this new profile.

## First-class history and immutable calculations — separate evidence stage

`class-first-acquisition-calculations.sql` validates exact original creation
receipt/journal/proof correspondence before the existing allocator runs. Native
insert guards retain the exact results in closed, immutable, explicitly unverified
calculation records. Caller-supplied protected fields, mutation, deletion and
truncation refuse; no Auth, readiness, existing materializer or runtime grant is
changed. Same-transaction lookup returns original evidence; new transactions derive
fresh calculations. This is not a verified plan or an authenticated save. Future
admission must rederive a separate typed plan under actual Auth/source/writer locks.
The no-FK retention/lifecycle policy requires acceptance before native installation.
All 62 focused offline tests passed, including actual active-RLS execution through
a synthetic inherited owner role. [Checkpoint](../../docs/handoffs/2026-10-22-class-calculation-storage.md).

## First-class native allocation — calculated save envelope only

`class-first-acquisition-allocation.sql` adds a closed invoker/volatile calculator
after the descriptor and private class row types exist. It allocates native UUIDs
and timestamps for the complete finite first-class graph, proposed saved choices,
receipt and three private transitions. It reads actual structurally empty rows;
that does not authenticate an actor or prove bootstrap lineage. It accepts no
caller graph/allocated IDs/times and writes no journal, proof or character rows.
The separate advisory native-graph adapter preserves raw save effects and missing/
provisional evidence. No application caller or execution grant is added.
All 29 offline tests passed, including the unchanged final-reader full raw graph
roundtrip; actual protected planning, materializers, Auth/RLS/concurrency and choices
save remain unverified. [Checkpoint](../../docs/handoffs/2026-10-22-class-allocation-save-integration.md).

## First-class dependency descriptor — separate calculation stage

`class-first-acquisition-dependencies.sql` is additive review text, outside the
migration chain and unused by the app. Its invoker/stable function resolves an
exact accessible class snapshot and complete feature/spell dependencies, including
dormant grants, into bounded raw descriptors. It allocates no IDs, writes no rows,
accepts no operation and proves no actor or bootstrap lineage. It refuses ambiguous
feature ranks and active historical spell aliases whose representative depends on
future grant IDs. Creation/ownership/revocation is atomic and grants no application
execution. Thirty offline PostgreSQL-WASM tests compare admitted outputs against
original SQL materializers/projection INSERTs; actual installation, RLS/Auth,
concurrency, allocation and gameplay remain unverified. See the
[checkpoint](../../docs/handoffs/2026-10-21-class-dependency-descriptor.md).

`starting-equipment-transaction.sql` is SQL text for review, not an applied or CLI-generated migration. It is outside `supabase/migrations` intentionally. The complete file now executes in a synthetic in-memory PostgreSQL-WASM fixture with 45 checks; see the [October 11 executable checkpoint](../../docs/handoffs/2026-10-11-equipment-postgres-wasm.md). G2 has since passed replay of all 83 frozen baseline migrations; native staged-equipment installation, multi-connection tests and hosted execution remain outstanding. The API/table declarations in `lib/supabase/database.types.ts` are hand-maintained staged declarations, not hosted-generated types.

The application uses `INKBORNE_ATOMIC_STARTING_EQUIPMENT=true` only as a future server rollout gate; its default is off. No environment file was changed. New character creation uses one trusted create/eligible transaction when enabled and never falls back following its failure. The unused `lib/supabase/characters.ts` creation helper remains a legacy path, does not create eligibility and must not be used to promise first-award eligibility. With the gate off, ordinary creation remains possible but creates no eligible marker. Equipment confirmation has no sequential fallback in either gate state. Legacy unconfirmed/no-marker characters require an explicit reconciliation policy.

Authenticated server entries derive the actor using `getUser` and reject auth errors. A separate server-only service-role client calls restricted invoker functions; it never receives user cookies/JWT. Service-role configuration is unverified. Terminal owner recovery is available independently of the new-award gate and current catalogs/pins. The page reads receipts through owner RLS before source reads. The browser supplies only target, selections and pinned source intent; the server uses existing parser/completeness rules and bounds to construct the award plan.

Staged SQL adds one unique natural-key lifecycle ledger and inventory provenance. The character row coordinates ownership, choices/state, pin DML, copy and award. The terminal ledger is immutable; consuming/deleting inventory does not rewrite the receipt. Copy extends the latest background/ASI-safe transaction, retains ordinary current inventory/state copying and maps provenance to the target marker. Completed copies are explicitly inherited completion, never fabricated historical awards. Eligible sources alone may pass on eligibility; absent markers stay unresolved.

## Before any database application

Use an explicitly authorized disposable PostgreSQL/Supabase runtime. Do not start/restart a live Docker engine or target a hosted database under the current task's authority. Verify the complete current migration chain, service-role table/helper privileges, invoker execution revocations, owner reads and trigger execution. Generate a proper migration using the approved Supabase CLI; regenerate schema types against the disposable schema. Compare latest copy function and prior endpoint/RLS fingerprints before and after. Run failure injection after every award write, simultaneous equivalent/different intents, pin and ownership races, lost committed responses, deleted/spent inventory/currency replay, malformed state/content, foreign/anonymous callers and confirmed/eligible/unresolved legacy copies. A pure or mocked test is not PostgreSQL evidence. Copy during a concurrent award and after source inventory consumption must be included.

## Receipt-preserving rollback procedure (not executed)

Disable new awards via the server gate. If emergency database revocation is separately approved, revoke execution of `commit_starting_equipment(uuid, uuid, jsonb, jsonb, jsonb)` and `create_character_with_starting_grant(uuid, text, uuid)` from `service_role`. Preserve `resolve_starting_equipment`, owner reads, the ledger, provenance and safe latest-copy semantics. Already committed same-intent recovery remains readable; eligible/nonterminal characters stay blocked while new awards are disabled. Never restore sequential grants, drop a used ledger/provenance column, delete real inventory, subtract currency that may have been spent, or fabricate/reset eligibility.

Only if an independently reviewed disposable forward/down test proves there are no awards or inherited completions may additive unused objects be reversed. An application downgrade that omits safe copy or receipt recovery must pause those actions. Removing used evidence requires a separately reviewed data-preserving migration. No destructive down script is included or authorized here.

## R09.3a disabled hit-die kernel — source only

`hit-die-transaction.sql` is separate review text, not a migration or applied schema. The [approved finite plan](../../docs/specs/2026-10-12-hit-die-kernel-plan.md) defines a default-off database gate and an **unconditionally unavailable production dependency reader**. No application, action, Supabase client, runtime switch or live schema type imports the new model/support modules. Setting the gate alone cannot accept a spend. All legacy mechanical writers remain unchanged and unfenced; full dependency authority, ordering/phantom closure, lifetime profile/character cascade compatibility and actual PostgreSQL/PostgREST acceptance remain prerequisites.

The text describes one atomic installation with isolated function-owner privileges and three service-only RPCs, current-owner receipt-first recovery, one transaction for immutable receipt/state/linked roll, a conservative millisecond-expiry profile with native clock acceptance, and existing INT4 roll-total bounds. The TypeScript transition model is offline characterization; its explicit fixture-reader control has no connection to SQL. No SQL execution, concurrency, role/security or browser recovery evidence is claimed at the source checkpoint. Existing starting-equipment staging and immutable evidence remain unchanged.
