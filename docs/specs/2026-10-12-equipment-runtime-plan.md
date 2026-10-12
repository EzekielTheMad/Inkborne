# E1 runtime provisioning package: G1 ready, G2 pending

Prepared 2026-10-12 UTC. This document and the adjacent
[literal Compose plan](2026-10-12-equipment-runtime.compose.yaml) are a dry run,
not approval or runtime acceptance. The orchestrator owns execution. The
[launch ledger](../LAUNCH-ACCEPTANCE.md) remains the authority for acceptance.
No runtime/image/executable installation, credentials, schema, fixtures or hosted
operations were performed while preparing this package.

## Read-only evidence and selected lane

Inspection was performed in integration worktree
`C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-verification`,
branch `codex/launch-integration-20261011`. Latest observed source was
`72fb420336d0c087c8a7089afca9a615b7ca65ff`; other owners are continuing local work,
so this is not the final G2 source freeze.

- Docker CLI **29.6.2**, Compose **v5.3.1**, context `desktop-linux` are installed.
- Exact Docker Desktop executable exists at
  `C:\Users\kaios\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe`.
  Docker CLI path is
  `C:\Users\kaios\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe`.
- `\\.\pipe\dockerDesktopLinuxEngine` was absent. No Docker/Postgres/Supabase
  runtime processes or listeners on 54321-54324 / 55430-55432 were observed.
- Supabase and psql were not on PATH. No CLI installation is needed for this lane;
  use the pinned PostgreSQL image's psql after G2 approval.
- Resource sample: 523 processes, 33,474,892 KiB physical RAM total,
  11,314,504 KiB free, CPU sample 36%; C: free bytes 254,394,585,088.
  These are point-in-time observations, not startup guarantees.

Use one Supabase PostgreSQL 17 database plus two one-shot **official migration
jobs**, Auth and Storage. No host ports are published; the jobs do not serve
HTTP. SQL clients run inside the database container. Plain database-only bootstrap
is insufficient: the image's Storage init creates schema/grants, while Inkborne
`00024`, `00047` and `00048` need real `storage.objects` / `storage.foldername`
provided by Storage migrations. Do not replace them with test stubs.

This is a source-supported custom Compose lane using official components, not a
pretested stock Supabase recipe. Auth's tagged source supports `auth migrate`;
Storage's tagged build compiles all `src/**/*.ts`, copies `dist` into the image,
and provides `src/scripts/migrate-call.ts`. Actual pinned binary/file presence,
exit behavior and bootstrap compatibility are **unproved** until approved
inspection/execution. If the jobs cannot initialize the real baseline, stop and
submit a concrete supported-stack revision; do not quietly add services or stubs.

## Immutable image and source manifest

All images use `platform: linux/amd64` and the immutable multiarch digest in the
Compose file. Public registry metadata was read; image layers were not fetched.

| Component | Version | Pinned multiarch digest | amd64 manifest digest | Registry compressed amd64 size |
| --- | --- | --- | --- | ---: |
| PostgreSQL | `supabase/postgres:17.11.0.004` | `sha256:06ddc7962e11ab0f4f0334fd05671e97c30ea202f6e6a7113800bd3d6e416108` | `sha256:4b438c22395a9a2bd19ee0522742cc9a1ff91db4732ff0c1b08fc07e9c767c22` | 367,720,299 bytes |
| Auth | `supabase/gotrue:v2.196.0` | `sha256:c0c25187a6b835e65a6f6e6c6b39d090e832d40e6de5186f2c038e0411944232` | `sha256:7e813221b93fbf54b515036438550e483bfaf057b9db52fe9bc1ce91c47e817e` | 29,418,771 bytes |
| Storage | `supabase/storage-api:v1.74.0` | `sha256:f1546fac6d1c7e345428ac904bfaa7be7cecd50a1f549fe1cf38c628a7b15c85` | `sha256:63da55733ce9d7592d860739acb94f0b6189d880b7565d247ee5b195be854db1` | 240,331,180 bytes |

Combined compressed size is 637,470,250 bytes, about 608 MiB. Docker cache/VHD and
uncompressed storage costs are larger and are not represented by this number.

Auth/Storage pins come from official `self-hosted/v0.8.2`, resolved through its
annotated tag to immutable source commit
`564eab8ad7840b13324f68b1bfac074ef8d51c21`. That recipe uses older PostgreSQL
17.6.1.136; this proposal explicitly substitutes the patched 17.11.0.004 image.
Compatibility is a G2 runtime assertion, not assumed from the source version.

Official role-bootstrap source, for G2 only:
`https://raw.githubusercontent.com/supabase/supabase/564eab8ad7840b13324f68b1bfac074ef8d51c21/docker/volumes/db/roles.sql`.
Fetched UTF-8 content SHA256:
`3ad717b225daa38aa982da26750f35641eb404e1eb5e69a763c22236ab96c1b2`.
Verify exact saved bytes before execution. The existing official image supplies
its own Auth/Storage initial schemas and Supabase roles; this additional official
script sets scratch-only role passwords without inventing schema helpers.

Observed application manifest contains **83** migration files, starting
`00001_profiles.sql` and ending `20261010232200_save_character_abilities.sql`.
Observed staged `supabase/staged/starting-equipment-transaction.sql` SHA256:
`095f4b351dc39a73433657602e8fc4d8879c25993e28d213dbde7df6ea76ba4c`.
These observations must be replaced by the final G2 candidate/hash manifest.
The already-applied hosted ability migration is replayed only into a fresh
scratch database; no hosted reapplication/history repair is in either group.

## Literal Compose manifest and rendered verification

Target scratch directory:
`C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-runtime`.
Project prefix: **`inkborne-equipment-e1-20261011`**.

| Proposed G2 resource | Exact name / limit |
| --- | --- |
| Database container | `inkborne-equipment-e1-20261011-db`; 1 GiB, 1 CPU, 256 PIDs |
| Auth migration job | `inkborne-equipment-e1-20261011-auth-migrate`; 256 MiB, 0.5 CPU, 128 PIDs; `auth migrate` |
| Storage migration job | `inkborne-equipment-e1-20261011-storage-migrate`; 512 MiB, 1 CPU, 128 PIDs; `node dist/scripts/migrate-call.js` |
| Private network | `inkborne-equipment-e1-20261011-net`; `internal: true` |
| Database volume | `inkborne-equipment-e1-20261011-db-data` |
| Database configuration volume | `inkborne-equipment-e1-20261011-db-config` |

All three restart policies are `no`; all services have **no ports mapping**.
Run migration jobs sequentially. No Auth server, Storage HTTP server, Studio,
gateway, mail, analytics, Realtime, Supavisor, PostgREST or imgproxy is started.
No shared Docker socket or original worktree is mounted. The only bind mounts are
scratch `bootstrap\99-roles.sql` and `sql`, both read-only with
`create_host_path: false`. The runtime variables use required `${...:?message}`
expressions, with no credential defaults or `.env` file.

DB `JWT_SECRET` also binds the required `E1_JWT_SECRET` reference. Inspected
official PostgreSQL Dockerfile/init sources showed no JWT-secret default; the
pinned self-hosted `jwt.sql` sets only `app.settings.jwt_exp`. Passing an environment
reference does not prove image consumption or configure a PostgreSQL setting by
itself. G2 must inspect the actual pinned initialization/settings and reject any
unexpected built-in secret fallback. Auth/Storage jobs use the explicit scratch
JWT secret; database role/claim tests do not claim JWT signature verification.

Actual installed-Compose render at **2026-10-12T00:28:23.9188842Z** succeeded,
with automatic environment-file loading disabled and explicit strings labeled
`E1_NONSECRET_RENDER_PLACEHOLDER_ONLY` for both variables. The complete resolved
configuration was kept inside the shell; output selected only nonsecret resource
fields. This was configuration parsing only: no daemon/container operation.

Compose file SHA256:
**`0ad22c154bb12e7c4486de030b0d3a0a5c02be2c25cb36a160bbe243159fe721`**.

Verified render: exactly three services; zero published ports; correct image pins;
internal named network; exactly two named volumes; and absolute bind sources:

- `C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-runtime\bootstrap\99-roles.sql`
- `C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-runtime\sql`

Re-render immediately before G2, with the reviewed file hash and project-directory
fixed. A parse success does not prove that mounts exist, images can initialize,
roles are correct or the acceptance scenarios pass.

## G1 approval: complete bounded operation list

**G1 starts no test containers or migration jobs, creates no network/volume,
generates no credential and performs no SQL.** There are no inspection-container
names because this group uses image metadata only. Binary/file confirmation is
an explicit prerequisite before G2 executes the jobs; it is not pretended done.
No `docker image save`, archive extraction or executable invocation from images
is included in G1. This avoids unapproved inspection-container starts and large
temporary archives.

Approved G1 operations, in order:

1. Recheck Docker-related processes, Linux pipe, target listeners, CPU/memory,
   process count and C: free space. If a suitable engine is already running, reuse
   it after verifying identity; do not start a second instance. Require at least
   20 GiB free before image pulls. Existing Docker VM allocation/settings remain
   untouched.
2. If still absent, start **only** the verified existing executable once:
   `Start-Process -FilePath 'C:\Users\kaios\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe' -WindowStyle Hidden -PassThru`.
   Record task-owned launch PID, parent PID, command, cwd and UTC start time, plus
   discovered engine descendants. Poll readiness in bounded intervals with no
   single wait over 60 seconds; cap initial readiness at 120 seconds. A Linux
   pipe/daemon failure ends this lane. No engine switch, installation, restart,
   firewall change or speculative repair is authorized.
3. Verify `desktop-linux` daemon through selected `docker --context desktop-linux
   info` fields (ID, name, OS type, server version, CPUs, memory). Inventory only
   existing container IDs/names/status and network/volume IDs/names. Do not print
   their environment, logs, credentials or unrelated command lines. If any
   proposed prefix resource exists, stop and request a collision-safe revision;
   do not reuse, reset or delete it.
4. Pull these **three exact digests**, one at a time, with `--platform linux/amd64`
   and explicit `--context desktop-linux`:
   - `supabase/postgres@sha256:06ddc7962e11ab0f4f0334fd05671e97c30ea202f6e6a7113800bd3d6e416108`
   - `supabase/gotrue@sha256:c0c25187a6b835e65a6f6e6c6b39d090e832d40e6de5186f2c038e0411944232`
   - `supabase/storage-api@sha256:f1546fac6d1c7e345428ac904bfaa7be7cecd50a1f549fe1cf38c628a7b15c85`
   Command form, with each complete immutable image reference above substituted:
   `docker --context desktop-linux pull --platform linux/amd64 <exact-image-digest>`.
   Allow one retry only for a transient timeout. Bound each command; record its
   PID/parent/cwd/command/start time if long-running. Recheck free disk after each
   image. Use an **8 GiB cumulative logical image-size budget**, inspected after
   each pull; abort further pulls if exceeded. This is a monitored budget, not a
   Docker storage quota or a promise about VM VHD growth.
5. Inspect only each image's ID, RepoDigests, OS, architecture, Size, Entrypoint and
   Cmd. Record digest/platform match. Do not dump image environment or full
   Docker configuration. Image metadata does not verify the `auth` binary or
   `dist/scripts/migrate-call.js` contents.
6. Capture after-state resource usage and prefix resource inventory. Save only
   selected nonsecret evidence below scratch `evidence\g1`; cap evidence at
   **10 MiB**. Leave the shared daemon and digest-pinned cache running/present
   pending G2. Do not launch the Compose plan. End G1 with a provisioning receipt
   and the remaining binary/bootstrap/harness prerequisites.

**Blast radius:** shared Docker Desktop/VM startup; network traffic and disk cache
for the three images; small scratch evidence. Desktop may automatically restore
unrelated containers already configured for restart. Their behavior cannot be
known from an inactive daemon; inspect them after startup without stopping them.
No Inkborne source runtime, database, HTTP service or published listener is
started by G1 itself.

**Rollback/cleanup:** cancel only a verified task-owned stalled pull/helper process
and its verified descendants. Retain the three cached image references and evidence
for G2, because layers may be shared. Preserve all preexisting resources. Do not
shut down the shared daemon or Docker Desktop, remove images globally, prune, change
daemon settings or stop unrelated containers. Shared-daemon shutdown requires a
separate exact approval; G1 approval explicitly includes leaving it running after
inspection. If G2 is declined, report the daemon/cache footprint and propose a
separate narrow cleanup if wanted.

### Ready G1 approval wording

Approve G1 only: start the installed Docker Desktop once if its Linux engine is
still absent, pull the three digest-pinned linux/amd64 images listed above, inspect
selected daemon/resource/image metadata, and retain at most 10 MiB of nonsecret
scratch evidence. Approximately 608 MiB compressed downloads are expected; enforce
the monitored 8 GiB logical image-size budget and 20 GiB free-space floor. Shared
Desktop startup may restore unrelated restart-enabled containers. Preserve those
resources and leave the shared daemon/cache running pending G2. This approval
creates no test containers, credentials, schema or fixtures; G2 remains separate.

## G2 pending: final launch and database acceptance package

G1 approval does not authorize this section. Before requesting G2, freeze:

- Final reviewed combined application SHA, clean state and all ordered migration
  file hashes; staged equipment SQL and any approved D1 SQL hashes.
- Exact Compose/hash, official bootstrap bytes/hash, scratch mount inventory,
  and a bounded harness/fixture/failure-injection manifest with every created ID.
- Full real-session matrix from the previous [E1 proposal](2026-10-11-equipment-runtime-proposal.md):
  actual grants/RLS/triggers/ASI-copy baseline; real backend PIDs/lock barriers;
  award/copy/access/pin races in both orders; atomic rollback across all tracked
  tables; receipt recovery after commit-response loss and later consumption.
- Exact credential decision: one ephemeral database password and JWT secret in
  memory or expressly approved ACL-protected ignored scratch material. Storage
  config creates anon/service JWT values internally, which remain scratch-only,
  unpublished and discarded. No hosted keys, account creation or email.
- Pre-start image-file inspection method and exact resource list. With G2 approval,
  use the three proposed named containers, create them without starting, inspect
  selected bindings/mounts/IDs and copy only the Auth binary / Storage migration
  entry file for read-only confirmation if appropriate. Do not execute jobs until
  their exact commands/files and the baseline bootstrap have passed inspection.
  Record any bounded temporary evidence and cleanup in the final G2 package.

Expected G2 sequence is database initialization, Auth migration job, Storage
migration job, actual version/schema/privilege inspection, full ordered application
migration replay (stop on first failure), staged SQL once outside migration history,
real role/claims/session tests, fixture residue audit and exact manifest-scoped
container/network/volume teardown. Use actual `postgres` role for application replay
and actual service/authenticated/anon authorization checks, with separate
administrative inspection. Independent psql clients execute inside DB container.
Inspect real `HostConfig.PortBindings` and network/mount configuration before any
application SQL. No public bindings, surrogate helpers, skipped migrations or
history repair to manufacture success.

Scrub every generated secret from output before displaying logs/errors; avoid SQL
statement/DSN logging. Preserve the first replay/timeout/deadlock failure as failure
evidence. If any target escapes scratch isolation or a listener is public, stop
before application/fixture writes and report the boundary failure.

Stop/remove only recorded G2 container IDs, the two owned volumes and named
network after residue/evidence checks. Preserve scratch evidence and shared image
cache/daemon; no global cleanup. Compare CPU/memory/process/port baseline after
owned teardown. This lane proves database behavior; it does not prove OAuth,
Storage HTTP, mail or real browser-to-API acceptance.

**G3 remains unselected:** no hosted project/account is selected by this proposal.
If Victor chooses `etcaodglvcspcmwecyxq`, prepare its exact shared-target/accounts/
per-attempt fixture caps/write/fault/cleanup package separately. Historical spent
fixture allowances are not renewed by G1/G2. Do not infer provider or production
authority from this dry run.

## Current official references

- [Supabase Docker setup and custom service reduction](https://supabase.com/docs/guides/self-hosting/docker)
- [Official pinned recipe](https://github.com/supabase/supabase/blob/564eab8ad7840b13324f68b1bfac074ef8d51c21/docker/docker-compose.yml)
- [PostgreSQL 17.11 change notice](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes)
- [Auth migration command](https://github.com/supabase/auth/blob/v2.196.0/cmd/migrate_cmd.go)
- [Auth image binary path](https://github.com/supabase/auth/blob/v2.196.0/Dockerfile)
- [Storage migration entry](https://github.com/supabase/storage/blob/v1.74.0/src/scripts/migrate-call.ts)
- [Storage compile rule](https://github.com/supabase/storage/blob/v1.74.0/build.js)
- [Storage image contents](https://github.com/supabase/storage/blob/v1.74.0/Dockerfile)
- [PostgreSQL registry pin metadata](https://hub.docker.com/v2/repositories/supabase/postgres/tags/17.11.0.004)
- [Auth registry pin metadata](https://hub.docker.com/v2/repositories/supabase/gotrue/tags/v2.196.0)
- [Storage registry pin metadata](https://hub.docker.com/v2/repositories/supabase/storage-api/tags/v1.74.0)

The Supabase changelog index was fetched as text first. Relevant current changes
include PostgreSQL 17.11 operators/extensions and the self-hosted PostgreSQL 17
default transition. Record actual extension versions at G2 replay. No hosted
upgrade, reindex, cipher re-encryption or gateway migration is in this plan.
