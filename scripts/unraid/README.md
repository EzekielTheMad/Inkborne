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

The default runs typecheck/lint once, three focused dropdown test files, and
one genuine Auth → Fighter builder → original equipment award → reload →
foreign-account refusal flow. It reuses the existing 34 native parent cases
and eight contention scenarios. `focused` runs only those source checks.
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
cleared unused cache/images and left 23.3 GiB free. Plan mode passes; actual
workflow verification is still pending. Refresh the live guard before starting.
Verification stops at 20 minutes or below 4 GiB available host RAM. Initial
image/dependency download has its own 20-minute bound. Tests run serially.

Scratch secrets are generated on Unraid and removed after teardown. Exact
run/project labels restrict cleanup; teardown verifies containers, network and
volumes are gone and existing service IDs/states are unchanged. Public reports
and reusable images remain. Failed diagnostic logs are bounded and redacted
before the raw private files are removed. The runner never prunes shared Docker
images/cache; the one-off maintenance above was separately requested by the user.

Reports download to `../equipment-runtime/unraid/<run UUID>/output` and remain at
`/mnt/cache/appdata/inkborne-test-runner/runs/<run UUID>/output` on Unraid.
Inspect `host-result.json` for cleanup and `summary.json` for test results.
On interrupted SSH, inspect that exact run and its labels before any cleanup;
never stop another Inkborne run or unrelated service.
