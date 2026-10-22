# Character command database row checks — proposed native verification

Source proposal only; no native profile or hosted change is authorized by this
document. Victor requested database session/ownership progress. Local implementation
is tested at `95e9c90`; earlier G2 permission covered baseline/catalog only.
Vercel hosting stays unchanged; M1–M6/M5.5 active, M7/creature imports paused.

## Exact source and scope

Use `supabase/staged/character-command-row-locks.sql` from `3d25ac3`, Git blob
`4a6cce7e528b01d4ae3f647ef3c506dc2f8f50fd`. It creates only two postgres-owned
invoker functions; no tables, roles, runtime grants, policies, Auth replacement,
writer readiness or gameplay installation. It must run inside its existing atomic
BEGIN/COMMIT. The 62-case PGlite file is characterization, not native acceptance.
The new functions require the guard table; they do not create it.

Before any run, prepare a new bounded descriptor with exact launcher/SQL/bootstrap/
83-migration hashes and independent review. Do not reuse the old baseline descriptor
as permission for this profile. Use the existing digest-pinned PostgreSQL17.11,
Auth2.196.0 migration job and Storage1.74.0 migration job, five reviewed mounts,
one internal network and two disposable volumes. Preserve existing engine/cache.
No new image pull, host-published port, browser server, hosted project, live data
or running Auth HTTP service is part of the first profile. Resource ceilings and
the 20GiB free-space floor must be rechecked from the reviewed G2 recipe.

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

After exact catalog acceptance, the eventual separately reviewed descriptor must
first include a **scratch-only guard fixture**, because the original83 baseline
migrations do not create `private.character_writer_guard_v1`. Freeze the exact
original CREATE TABLE statement from `hit-die-authority-and-writers.sql` and its
single `INSERT ... (singleton) VALUES(true)` statement. Install no other authority
stage statements, roles, RLS policies, grants or readiness records. Capture actual
fixture owner/shape/constraints and stop on mismatch. This fixture supplies only
the lock relation/row; it is not an operational writer fence or readiness proof.
Until those exact two fixture statements are in the reviewed descriptor, positive
native cases are blocked by the missing guard prerequisite.

Then install the new closed two-function file. Use synthetic
UUIDs and reduced nonsensitive account/profile/character values in scratch rows;
no password, access token, refresh token or login. Test the actual installed SQL:

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

Use at least two actual connections with bounded lock/statement/wall-clock timeouts.
Record backend IDs, blocker chains, each SQL outcome and exact cleanup. Do not use
SKIP LOCKED in this checker, sleeps as evidence of lock acquisition, or a fixture
replacement of the clock/production Auth seams. Prepare and review exact scenario
SQL and launcher processes before release; this document alone is not a runnable
or approved descriptor. Finish by removing only owned scratch rows/resources and
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
