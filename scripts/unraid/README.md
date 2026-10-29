# Disposable Unraid verification

Run from the authoritative checkout, after committing the candidate:

```powershell
npm run verify:unraid -- plan
npm run verify:unraid -- workflow
```

`plan` checks the existing SSH alias and server identity without writing. `workflow`
exports only committed source and the hash-verified public SRD response cache,
builds a reusable image on the SSD, and starts a unique disposable Compose
project. No production environment, credentials or database is used. The app
and browser run inside the test container; no server ports are published.

The default runs typecheck/lint once, three focused dropdown files plus the
affected psql-protocol, contention and parent-evidence validator files. Two
serial browser stories exercise genuine Auth → Fighter builder → original
equipment award → reload → foreign-account refusal, then a genuine Rogue's
background/Expertise fixture. The Fighter includes all 21 owner/foreign/service
HTTP probes and the existing 34 native parent cases/eight contention scenarios.
The Rogue uses the unchanged rollback-only background vector to require exactly
1/0/2 physical parent writes and matching revisions, then verifies the full
fixture/catalog/installed profile is retained and both private roots are absent.
Only fixture preparation is browser/JWT proof; that native vector explicitly
retains `authenticationAccepted:false`. `focused` runs only the source checks.
Neither mode runs the full unit/E2E suite or a production build.

The fresh database installs current reviewed migrations/stages directly, then
imports the genuine cached SRD through current transformers. Previous browser
stories and their recorder chains are not bootstrap prerequisites. Historical
upgrade/full-parent/A4/F3 acceptance remains separately recorded and open.

Runtime is capped at 10 GiB/3 CPU for the app/browser, 1 GiB/1 CPU for PostgreSQL,
plus small Auth/REST jobs. Image builds are capped at 4 GiB/3 CPU using the
server's supported legacy builder; its deprecation is a future compatibility
limitation. Startup requires 16 GiB available host RAM, 15 GiB SSD space, and
15 GiB free inside Docker's image disk (`/var/lib/docker`). Free SSD capacity
alone does not mean the Docker image disk has space. The first attempt found
the 70 GiB Docker disk 98% full; separately authorized maintenance on October28
cleared unused cache/images. The actual workflow passes at `6226bca`; after
final cleanup Docker again has23.3 GiB free. Refresh live guards before starting.
Verification stops at 20 minutes or below 4 GiB available host RAM. Initial
image/dependency download has its own 20-minute bound. Tests run serially.

Scratch secrets are generated on Unraid and removed after teardown. Exact
run/project labels restrict cleanup; teardown verifies containers, network and
volumes are gone and existing service IDs/states are unchanged. Public reports
remain. Images normally remain reusable, but the user's October28 final-cleanup
request also removed all14 newly introduced test/dependency images and55 input
bundle/source paths using exact identity/baseline checks. Results stay retained;
the next run will download/build its images again. Failed logs are bounded and redacted
before the raw private files are removed. The runner never prunes shared Docker
images/cache; the two maintenance cleanups above were separately requested.

Reports download to `../equipment-runtime/unraid/<run UUID>/output` and remain at
`/mnt/cache/appdata/inkborne-test-runner/runs/<run UUID>/output` on Unraid.
Inspect `host-result.json` for cleanup and `summary.json` for test results.
On interrupted SSH, inspect that exact run and its labels before any cleanup;
never stop another Inkborne run or unrelated service.
