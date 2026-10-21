# G2 proposed first slice — disposable baseline and catalog capture

Prepared October 21, 2026. **NOT APPROVED OR EXECUTED.** G1 is complete;
Vercel remains the host. This narrows the larger October 12 G2 proposal to its
first useful prerequisite. It does not replace R07 receipt formats or authorize
the original equipment stage, fixtures, races, fault injection or disabled core
stages. Those remain separate subsequent scopes.

## Concrete dry-run resource list

Use only context `desktop-linux`, daemon
`3e3feb6b-78ae-4782-ac34-addaac1709c8`, and scratch
`C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-runtime`.
Abort on changed daemon, resource-name collision, unexpected mount/network/port,
image drift, less than 20 GiB disk free or less than 3 GiB physical memory free.
Never stop unrelated services to make room. There is no hosted target.

| Temporary resource | Exact name / bound |
| --- | --- |
| PostgreSQL container | `inkborne-equipment-e1-20261011-db`; 1 CPU, 1 GiB, 256 PIDs |
| Auth migration container | `inkborne-equipment-e1-20261011-auth-migrate`; 0.5 CPU, 256 MiB, 128 PIDs |
| Storage migration container | `inkborne-equipment-e1-20261011-storage-migrate`; 1 CPU, 512 MiB, 128 PIDs |
| Internal network | `inkborne-equipment-e1-20261011-net`; no host bindings |
| Database volume | `inkborne-equipment-e1-20261011-db-data` |
| Database config volume | `inkborne-equipment-e1-20261011-db-config` |
| Read-only bootstrap mount | scratch `bootstrap/99-roles.sql` → `/docker-entrypoint-initdb.d/init-scripts/99-roles.sql` |
| Read-only SQL directory | scratch `sql` → `/e1-sql`; frozen approved SQL only |

Use unchanged [reviewed Compose](2026-10-12-equipment-runtime.compose.yaml) and
the three G1-verified image digests. No ports, restart policy `no`, no Docker socket
mount, no shared-volume attachment. Three containers are the maximum; database
plus one migration job at a time. No image pulls, builds or upgrades are included.
Create without starting, record exact IDs and inspect selected resource metadata
before launch. Inspect only the Auth binary and Storage migration entry from
those stopped containers; do not dump image environment or unrelated files.
Verify the prepared `auth migrate` and `node dist/scripts/migrate-call.js`
commands against those actual files before invoking either job.

## Frozen inputs and secrets

After committing this preparation, run the existing read-only `freeze` mode of
`scripts/equipment-runtime.ts`. Its exact manifest/source SHA and hash live in
scratch `evidence/r07.1/frozen-manifest.json`; freeze is not SQL execution.
It binds 83 ordered application migrations, the original equipment stage,
Compose, executor and assertions. **Only `baseline` mode is proposed here.**
The presence of a staged file in that original manifest authorizes no execution.
Keep its existing `R07.1-baseline-and-stage` format unchanged, with this human
scope explicitly restricting the invocation to baseline; never infer stage
permission from that broader internal format name.

Official bootstrap source:
`https://raw.githubusercontent.com/supabase/supabase/564eab8ad7840b13324f68b1bfac074ef8d51c21/docker/volumes/db/roles.sql`.
Fetched to scratch only; 379 bytes, SHA256
`3ad717b225daa38aa982da26750f35641eb404e1eb5e69a763c22236ab96c1b2`.
It has not been executed. Bind this document and
[catalog query](../handoffs/2026-10-13-class-materializer-native-metadata.md)
as supplementary hash entries in the preparation receipt without changing the
existing R07 manifest or validator.

On approval, generate one temporary database password and JWT secret in memory;
pass via process environment only. No hosted credentials, accounts, email,
`.env` files or secrets in arguments/evidence. Container environment necessarily
holds those temporary values until teardown; do not dump full container config.
Remove process environment references after owned teardown. Suppress raw logs
that could contain connection strings, tokens, SQL or passwords.

## Exact execution and stopping points after approval

1. Recheck source, frozen bytes, bootstrap, context, daemon, resources and headroom.
   Record baseline process/resource/port metadata. Create the six listed resources,
   inspect stopped containers/mounts/network/limits and the two job files, then
   initialize the database. No public listener is permitted.
2. Database readiness allowance 120 seconds. Run Auth then Storage migration job,
   each bounded to 180 seconds and exit zero. Record actual versions/extensions
   and official history counts. A missing file/schema/role or compatibility error
   stops the attempt; no surrogate bootstrap, skipped migration or schema repair.
3. Populate the existing human G2 record **only after approval and actual resource
   IDs exist**. Execute existing R07.1 `baseline` with the exact frozen manifest,
   approval record and explicit manifest hash. Its preflight checks real roles,
   Auth/Storage structures and empty user fixtures. Apply all 83 migrations in
   order as postgres, stop on first failure, then baseline assertions/catalog
   audit. Preserve its native receipt unchanged. Each SQL command is already
   bounded by the existing executor; outer attempt allowance is 15 minutes.
4. Run the 13 fixed-signature catalog-only query in the linked handoff with a
   15-second read-only transaction. Capture original owner/role flags, security
   mode, language, return signature, ACL, search_path only and normalized body
   digest. Pair with trigger metadata for characters, character_content_refs and
   character_spells (function OID, event/columns, enabled/deferred flags); avoid
   arbitrary trigger arguments or raw function/config bodies. Capture relevant
   default ACLs and effective schema USAGE/function EXECUTE for discovered owners
   and postgres/anon/authenticated/service_role plus existing
   inkborne_class_origin_owner/inkborne_hit_die_authority_owner roles. Missing
   staged roles are reported absent, never created. Do not invoke app functions.
   These supplementary catalog reads are not R07 baseline acceptance steps and
   cannot change the original baseline receipt.
5. Save hashes, first failure/category if any, counts and bounded nonsecret
   metadata. No invented character/profile/auth-user fixtures, application writes
   beyond the frozen migrations, application function calls, stage execution,
   provider/Auth HTTP tests or fault injections. Migration seed rows and its
   existing catalog/count audit are expected; no user-row contents are captured.
6. Stop/remove only the exact created container IDs, then the exact owned network
   and two volumes after verifying names/labels/IDs still match. Record each
   result and independently verify absence and no owned listeners/processes.
   Never use broad prune/down-volume commands or repair another resource.
   Compare resource/port readback with baseline and retain evidence plus G1 cache
   and shared Docker. Teardown is part of the proposed approval even on failure.

Retain at most 10 MiB nonsecret G2 evidence. Bound any copied job evidence to
64 MiB total, hash it and remove only its recorded scratch files on teardown.
Do not erase uncertain resources: stop dependent work and report exact residuals
if identity, cleanup or timeout termination cannot be proved. No restart of
Vercel/hosted services is required. Rollback is disposal of the isolated resources;
no hosted database or application configuration changes to roll back.

## Acceptance and requested human scope

Success proves the frozen baseline replays on these real images and supplies
native catalog facts for independent challenge before class materializer work.
It does not prove gameplay, HTTP/JWT/provider authorization, concurrency, browser
flows or beta readiness. M5 guard/browser and bonus measurement holds persist.

Approve this **G2 baseline/catalog slice only**: three temporary local containers,
one isolated network, two disposable volumes, memory-only temporary credentials,
official initialization plus all 83 frozen migrations, read-only catalog capture
and exact owned teardown. Keep Vercel hosting and G1 shared cache running. No
stage/fixtures, hosted changes, deployment or publication are included.
