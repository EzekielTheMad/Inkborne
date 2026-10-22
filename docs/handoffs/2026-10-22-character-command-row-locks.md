# Database session and current-owner row checks — local checkpoint

Victor requested continued database session/ownership checks toward authenticated
character saving. Vercel hosting is unchanged; M1–M6/M5.5 remain active, M7 and
creature imports remain paused, and M8 follows accepted core work.

## Delivered source

Integration base `eed23e8`, branch `codex/launch-integration-20261011`, workspace
`C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-verification`.

- `3d25ac3` (worker `4d54846`): additive staged database row-lock primitive.
- `95e9c90`: 62 focused PostgreSQL-WASM characterization cases.

Worker reused the existing isolated checkout on new branch
`codex/character-command-row-locks-20261022` from the integration base, preserving
its previous branches. Worker remains clean and started no dependencies/services.
Root owns the sole verification lane. Independent source/fixture review passed.
Reviewed LF SHA256:
`2b817d4c4d980276e17c521035e54676e6cacdddd1946e5ee88c23b6f87b15b1`;
integration CRLF SHA256:
`b53b956e24dcef9dd397b7d4bf992c078d647c5cf45dbcc86242be42b444146f`.
Both have Git blob `4a6cce7e528b01d4ae3f647ef3c506dc2f8f50fd`.

`private.lock_character_command_rows_v1(context,target) RETURNS void` validates
the finite four-field context from the prior server resolver, then locks selected
Auth user columns FOR SHARE, exact matching session FOR SHARE, actor profile FOR
SHARE, existing writer guard FOR UPDATE, and exact currently owned character FOR
UPDATE. A native clock helper rejects expiry before/after every acquisition and
after final selected-row rereads. Session not_after and account status are checked
against native time; missing/foreign rows have one generic P0001 refusal.

The finite profile requires nonanonymous authenticated aud/role, no soft deletion,
null or expired finite ban, matching current session owner, null or unexpired
finite not_after, existing profile/guard and current character ownership. Infinite
or unsupported year1–9999 timestamps refuse. Context/target UUIDs use the same
lowercase RFC profile; expiry is exact UTC6 whole seconds and the context is2KiB.
JWT expiry equality refuses. not_after equality also refuses, deliberately stricter
than the pinned provider model's strict-after test. Ban equality may pass.

Only selected columns are read; no Auth whole-row type, metadata, credential or
row payload is returned. The two new functions are CREATE-only, postgres-owned,
empty-search-path VOLATILE SECURITY INVOKER in one atomic file. API/PUBLIC EXECUTE
is revoked; no tables, roles, grants, policies, caller, service client or RLS changes
were added. Conversion errors alone are normalized; native missing-schema,
permission and concurrency errors retain their SQLSTATE. Original Auth functions,
readiness/admission and save paths are byte-unchanged.

## Schema and provider evidence

Primary source research resolved Auth2.196.0 to commit
`0204331ca41a5b49f076b6fa3dc6c0d20b996590`. Selected users columns come from
`00_init_auth_schema.up.sql`, `20220114185340_add_banned_until.up.sql`,
`20230116124412_add_deleted_at.up.sql` and
`20240214120130_add_is_anonymous_column.up.sql`; session id/user_id from
`20220811173540_add_sessions_table.up.sql`, and nullable timestamptz not_after from
`20221114143122_add_session_not_after_column.up.sql`.
[Pinned migration tree](https://github.com/supabase/auth/tree/0204331ca41a5b49f076b6fa3dc6c0d20b996590/migrations).
This is source evidence, not running-image, native catalog or hosted attestation.

The Supabase connector discovered the Inkborne project as healthy, then its one
read-only metadata transaction failed with28P01/password authentication failure
for postgres. No user/session records or schema metadata were returned. This is a
connector database-access failure, not proof of a project outage. No credential
retrieval, retry/rotation, hosted SQL change or configuration repair followed.
Project-list access is verified; target SQL access is not. The query covered only
selected column types, relation owners/RLS and PK/FK metadata.

## Verification

Evidence root:
`C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-runtime\evidence`.
`local-character-rows-20261022T142842Z`: **62/62 passed**, one worker; all six
observed process identities exited. Cases cover exact row correspondence, denied
account/session status/deadlines, current and changed ownership, missing identity/
profile/guard, strict context/UUID/time forms, actual closed API calls/ACLs, native
clock bounds, unchanged rows and unchanged original Auth refusals. Tests strengthen
the nil-target case with an existing otherwise valid owned row and use a future
invalid date so those refusals are not explained by absence or past expiry.

Fixture uses reduced typed Auth/character tables, the original profile and guard
DDL, unchanged new functions and unchanged original denied Auth bodies. Original
Auth/provider/admission/materializer triggers, full table RLS/FKs, roles and the
whole migration chain are not installed. Default PGlite postgres is privileged;
no native postgres/runtime role or RLS acceptance follows. API denial may occur
at schema usage before EXECUTE; separate ACL checks prove absent execution grants.
Refusal row comparisons occur after savepoint rollback and show fixture recovery,
not production failure-phase atomicity. No clocks/helpers/Auth gates were replaced.

Full `npm.cmd run check` at executable source `95e9c90`:
`local-check-20261022T142858Z`, **PASS** typecheck, zero-warning lint,
**366 files / 5119 passed / three UNVERIFIED M5 skips**, four bounded workers.
Finished14:33:16.7266327 UTC; all425 observed process identities exited. Skips
remain open requirements. Only documentation changed afterward.

Independent final readback14:33:39.4838589 UTC found all six focused and425
full-check recorded identities absent, with no task-owned service started.
Before/final shared-machine aggregates were538/539 processes,
6,862,220/6,535,668KiB free memory,32/34percent CPU and44/44 TCP listeners.
These are point observations, not per-process attribution or continuous sampling.
The before snapshot, sanitized hosted metadata refusal and final identity readback
are beside the full gate's summary/process journal.

No browser workflow changed, so no E2E server or build was needed. No native
profile, provider flow, hosted write, push, merge, deployment or Vercel change ran.

## Remaining work

A supplied JSON context is not authenticated by this primitive: same-token server
verification is a precondition. Successful row checks are neither configured
session validity nor save acceptance. Timebox, inactivity, low-AAL and single-user
session policy, native effective privileges/provider/RI lock compatibility,
concurrent logout/ban/ownership waits and acceptance-time expiry remain open.
The checker must share the future save transaction; a prior call retains no locks
for a later RPC. Keep both production Auth seams unavailable.

The [proposed native profile](../specs/2026-10-22-character-command-native-row-check-plan.md)
defines metadata, synthetic two-connection and separate provider/configuration
gates. It still needs exact scenario/launcher preparation, source freeze, review
and authorization before execution. Earlier baseline-only G2 permission is not
expanded by this source checkpoint. Genuine bootstrap, verified B1 planning,
B2 materializers and B3 protected choices writing/recovery also remain open.
Independent final documentation/proposal review passed after explicitly correcting
the fresh baseline's missing-guard prerequisite: future positive native cases
need the separately frozen/reviewed original guard table and singleton fixture;
installing the new functions alone supplies neither that table nor writer closure.
