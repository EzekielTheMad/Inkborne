# Character command database row checks — prepared native verification

Prepared source only; no native profile or hosted change is authorized by this
document. The next three local preparation checkpoints are implemented at
`96e1197`: five-file SQL pack, persistent three-session runner and new-scope frozen
launcher. [Delivery/evidence handoff](../handoffs/2026-10-22-character-command-three-checkpoints.md).
The underlying checker is tested at `95e9c90`; earlier G2 permission covered
baseline/catalog only. No native row-check profile has run.
Vercel hosting stays unchanged; M1–M6/M5.5 active, M7/creature imports paused.

## Exact source and scope

Use `supabase/staged/character-command-row-locks.sql` from `3d25ac3`, Git blob
`4a6cce7e528b01d4ae3f647ef3c506dc2f8f50fd`. It creates only two postgres-owned
invoker functions; no tables, roles, runtime grants, policies, Auth replacement,
writer readiness or gameplay installation. It must run inside its existing atomic
BEGIN/COMMIT. The 62-case PGlite file is characterization, not native acceptance.
The new functions require the guard table; they do not create it.

The new `scripts/character-command-native.ts freeze` descriptor binds exact
launcher/SQL/bootstrap/83-migration hashes, fixture IDs and allowed operations,
and requires a clean committed source. Independent source review passed; the final
external freeze follows the documentation commit. It supplies no approval record.
Do not reuse the old baseline descriptor as permission for this profile. A future
execution requires the exact package's new `character-command-rows-native-v1`
human record and explicit package confirmation through `node --import tsx` and
the separately hashed external `character-command-run.mjs`. Use the existing
digest-pinned PostgreSQL17.11,
Auth2.196.0 migration job and Storage1.74.0 migration job, five reviewed mounts,
one internal network and two disposable volumes. Preserve existing engine/cache.
No new image pull, host-published port, browser server, hosted project, live data
or running Auth HTTP service is part of the first profile. Resource ceilings and
the 20GiB free-space and 3GiB free-memory floors are rechecked from the reviewed
G2 recipe. Per-container memory/CPU/PID limits and exact resource cleanup are
recorded in the delivery handoff. The engine must already be running and match
the new approval. This profile cannot start it or pull images.

The reviewed source is tied to Auth tag2.196.0 source commit
`0204331ca41a5b49f076b6fa3dc6c0d20b996590`. That tag does not attest the actual
image build or hosted schema. Native metadata must independently match the exact
selected columns before executing this new checker. Catalog mismatch stops;
do not repair drift, add privileges or modify the Auth schema during the run.

## Native catalog and capability capture

Capture only metadata, not user/session values or credentials:

- `auth.users`: id UUID; nullable aud/role varchar255; is_anonymous boolean NOT
  NULL; nullable banned_until/deleted_at timestamptz.
- `auth.sessions`: id/user_id UUID NOT NULL; nullable not_after timestamptz.
- Application profiles.id UUID PK and characters.id/user_id UUID. A fresh G2
  baseline has no writer guard: record that expected absence before its isolated
  fixture setup below. An unexpected preexisting guard stops this fresh profile;
  do not adopt or change it.
- PK/FK/cascade definitions, owners, RLS/FORCE RLS, selected-column privileges,
  schema USAGE, effective role attributes/membership and relevant trigger
  function owner/ACL/security/search-path/body fingerprints and bindings.
- Actual postgres SELECT and locking rights. Locking SELECT requires SELECT on
  referenced columns and UPDATE privilege on at least one column per table.
  Existing declaration/ownership alone is not proof. Do not grant Auth UPDATE
  merely to make this test pass; absent rights are a recorded refusal.

Do not create future runtime owner roles or test their RLS through invented grants.
Closed postgres invoker execution is only that capability profile. Production
authority/class-owner privilege design needs its own reviewed mutation-denial
proof, including direct non-key UPDATE attempts and role membership isolation.

## Synthetic row and multi-connection cases

The prepared five-file pack is under `scripts/character-command-verification`:
catalog, strict preflight, guard fixture, seed and fixture cleanup. Native preflight
requires the observed postgres NONSUPERUSER/BYPASSRLS profile and deliberately
refuses the offline engine's SUPERUSER actor. No missing permission is repaired.

After exact catalog acceptance, the reviewed descriptor includes a
**scratch-only guard fixture**, because the original83 baseline migrations do not
create `private.character_writer_guard_v1`. `guard-fixture.sql` is exactly the
original CREATE TABLE statement from `hit-die-authority-and-writers.sql` and its
single `INSERT ... (singleton) VALUES(true)` statement. Install no other authority
stage statements, roles, RLS policies, grants or readiness records. Capture actual
fixture owner/shape/constraints and stop on mismatch. This fixture supplies only
the lock relation/row; it is not an operational writer fence or readiness proof.
These exact two statements are now included in the source inventory; actual
native shape/capability acceptance remains unrun.

Then install the new closed two-function file. The fresh baseline has no game
system row either: the pack explicitly supplies synthetic draft system
`10000000-0000-4000-8000-000000000005`, slug `inkborne-authrows-fixture`, with
empty mechanics. Seven reserved UUIDs cover that system and two accounts/sessions/
characters. Existing signup triggers alone create profiles. No D&D seed, password,
access token, refresh token or login is involved. Cleanup verifies exact markers,
roots and incoming references and preserves unrelated data.

The bounded runner implements eight cases: checker-first session deletion,
delete-first refusal, ban-first refusal, owner-transfer-first refusal, JWT expiry
on guard wait, not_after expiry on session wait, actual 22012/rollback lock release,
and all three API roles denied row-check execution. Native edges require three
identified connections and actual `pg_blocking_pids`/active Lock observations;
deadline cases prove the edge both before and after native expiry. Scripted-session
and fake-process unit tests are SIMULATED. Freeze/admission tests do not exercise
a successful `executeCharacterRows` orchestration path or accept native execution.

The broader required matrix below remains tracked. The eight cases do **not**
implement all rows: soft-delete-first, checker-first user/owner updates, missing or
wrong-owner prerequisites, expiry during every row wait, direct clock-helper role
denial and complete before/after row equality need further bounded native work.
Offline characterization is not a replacement for those native requirements.

| Competing action | Required observation |
| --- | --- |
| Session deletion commits before checker session lock | Generic refusal; no parent/receipt/state mutation |
| Checker holds session SHARE before deletion | Delete waits; successful row check precedes deletion; no claim of save acceptance |
| Ban/soft-delete starts first | Checker waits, then denies the changed user status |
| Checker user SHARE starts first | Conflicting user update waits; transaction end releases the lock |
| Ownership transfer commits first | Exact owned-parent predicate refuses |
| Checker owns parent lock first | Transfer waits; no historical-owner recovery is disclosed |
| Missing guard/profile/session or wrong session owner | Same generic unavailable result |
| JWT/not_after expires during each lock wait | Native post-wait clock refuses; no fake clock or transaction-start substitute |
| Statement fails or transaction rolls back | Owned locks released; complete before/after rows agree |
| Caller attempts anon/authenticated/service_role execution | Denied; neither clock helper nor checker granted |

Use three actual connections with bounded lock/statement/wall-clock timeouts.
Record backend IDs, blocker chains, each SQL outcome and exact cleanup. Do not use
SKIP LOCKED in this checker, sleeps as evidence of lock acquisition, or a fixture
replacement of the clock/production Auth seams. Exact source/launcher preparation
and source review are complete; the frozen descriptor and a new human approval
remain separate from this document. Finish by removing only owned scratch rows/resources and
verifying recorded process identities and ports absent.

## Separate provider/configuration acceptance

This first profile does not run the provider and cannot accept configured-session
validity. A later finite provider profile must observe the effective configuration;
the simplest candidate supports Timebox=nil, InactivityTimeout=nil, AllowLowAAL=nil
and SinglePerUser=false. These are proposed supported values, not observed target
settings. Do not change live configuration to fit this profile or infer nil from
missing SQL columns. Explicit optional zero durations differ from nil.

Pinned provider refresh uses session-first `FOR UPDATE SKIP LOCKED` and retry;
SinglePerUser can then lock the user, reversing this checker's user→session order.
Long-held session SHARE can also exhaust refresh retry without a deadlock. The
future HTTP profile must exercise real refresh/logout/password/ban/soft/hard-delete
traffic, actual provider/RI roles and lock chains, bounded waits and cleanup.
Manual SQL deletes are not provider acceptance.

Only after accepted native/config/provider capability and writer closure may a
new reviewed transaction integrate this row check with same-token verification,
save planning and acceptance-time deadline checks. Existing `require_*_auth_v1`
functions remain unavailable. The row check and future save must share one
transaction; a successful earlier RPC never conveys retained locks or authority.

Pinned references:
[session validity](https://github.com/supabase/auth/blob/0204331ca41a5b49f076b6fa3dc6c0d20b996590/internal/models/sessions.go),
[refresh lock protocol](https://github.com/supabase/auth/blob/0204331ca41a5b49f076b6fa3dc6c0d20b996590/internal/tokens/service.go),
[session configuration](https://github.com/supabase/auth/blob/0204331ca41a5b49f076b6fa3dc6c0d20b996590/internal/conf/configuration.go),
[PostgreSQL locking privileges](https://www.postgresql.org/docs/17/sql-select.html).
