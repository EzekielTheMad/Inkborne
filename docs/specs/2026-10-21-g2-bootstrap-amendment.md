# G2 bootstrap correction — same approved disposable baseline

Victor's current G2 authorization covers the baseline/catalog test and exact owned
teardown. Root treats completing its official initialization as a routine local
correction within that authorization: same disposable target, services, resource
limits and migration/catalog scope; no new hosted or application capability.
This is an implementation judgment, not a new user approval of the extra file.
The amendment is disclosed before the retry; bind new source/bootstrap bytes and
preserve the failed old freeze. The correction has not yet run at this checkpoint.

The approved baseline at `e860e69` failed before Auth/Storage jobs or application
SQL: official `99-roles.sql` attempted to alter the nonexistent
`supabase_functions_admin` role. The same pinned official Docker recipe mounts
`webhooks.sql` as `98-webhooks.sql` before `99-roles.sql`; our reduced recipe
omitted it. Preserve the failure; do not create a surrogate role or skip its ALTER.

## Exact amendment

Add one read-only bind to the existing DB container:

`C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-runtime\bootstrap\98-webhooks.sql`
→ `/docker-entrypoint-initdb.d/init-scripts/98-webhooks.sql`.

Immutable official source:
`https://raw.githubusercontent.com/supabase/supabase/564eab8ad7840b13324f68b1bfac074ef8d51c21/docker/volumes/db/webhooks.sql`.
Downloaded bytes: **9,070**, SHA256
`05a61316b899374253891cbba66ce073d9273f33983c3f47961eda3aa26c2823`.
Use the complete unmodified file. It has not been executed. Existing 379-byte
roles bootstrap remains unchanged at SHA256
`3ad717b225daa38aa982da26750f35641eb404e1eb5e69a763c22236ab96c1b2`.

The additional official SQL installs pg_net, the supabase_functions schema,
two bookkeeping tables, the functions-admin role, HTTP helper definitions,
associated grants and a pg_net extension event trigger. No application webhook
is attached and no HTTP request function is invoked by the proposed test.
All objects remain inside the disposable database on the internal network.
No additional service, container, volume, network, host port or hosted write.
Preserve the existing limits: three containers maximum, two volumes, one network,
database plus one migration job at a time, 20 GiB disk/3 GiB memory floors.

Local candidate changes only the Compose mount inventory and executor's exact
allowlist from four to five mounts. Transport tests reject missing, writable or
different-source webhook binds, and the fixture transport matches the same
inventory. R07 manifest/approval/journal formats and ordered replay remain intact;
no stage, fixture allowance or disabled gameplay profile is added. This supersedes
the earlier source-preservation instruction only for this observed bootstrap
defect, not for profile promotion or alteration of historical receipts.

## Fresh retry bindings

Create a new clean source freeze and supplementary receipt binding **both**
bootstrap hashes, this amendment, the original catalog scope and launcher bytes.
Never overwrite `evidence/r07.1/frozen-manifest.json` or prior attempt evidence;
retain the original manifest hash
`3e8706c42a3fa181ba2b7b1ee69dfc46d1c4035ed57350bf853a13a598bbb6b2`.
No original R07 baseline receipt exists because initialization stopped earlier.
Bind the existing human baseline-only authorization and actual new resource IDs
to the corrected freeze before SQL replay; do not claim a new human response.
Verify five exact DB mounts, pinned images, stopped job files and bootstrap bytes.
Do not relax the existing native checks or represent test transports as native proof.

The remaining [baseline/catalog sequence](2026-10-21-g2-baseline-catalog-plan.md)
and budgets are unchanged: fresh official DB initialization; Auth then Storage
migration jobs; all 83 frozen application migrations; baseline assertions and
read-only materializer owner/privilege/trigger capture. Stop at the first failure;
preserve it rather than adding roles, skipping migrations or repairing history.
Use memory-only temporary credentials, suppress secrets in logs and retain at
most 10 MiB nonsecret evidence plus at most 64 MiB copied job evidence.

After success or failure, verify and remove only the newly recorded three
container IDs, internal network and two owned volumes. Delete the recorded copied
job files, verify owned identities/resources/listeners absent and compare resources.
Leave the shared Docker/image cache running. Rollback is disposal of that scratch
database; Vercel and hosted Supabase configuration/data are untouched. No live
service restart or deployment is required.

**Authorized scope retained:** a fresh G2 baseline/catalog attempt with this
official initialization correction and strict five-mount verification. Other boundaries,
including M7 pause, no stage/fixtures, no hosted work and no deployment, remain.
