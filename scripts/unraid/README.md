# Disposable Unraid verification

Run from the authoritative checkout, after committing the candidate:

```powershell
npm run verify:unraid -- plan
npm run verify:unraid -- workflow
npm run verify:unraid -- builders
```

`plan` checks the existing SSH alias and server identity without writing. `workflow`
exports only committed source and the hash-verified public SRD response cache,
builds a reusable image on the SSD, and starts a unique disposable Compose
project. No production environment, credentials or database is used. The app
and browser run inside the test container; no server ports are published.

The default runs typecheck/lint once, three focused dropdown files plus the
affected psql-protocol, contention and parent-evidence validator files. Three
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

`builders` uses the same private runtime and cleanup controls for the existing
fourteen complete creation stories: eight single-class casters, three martial
builds, Hill Dwarf Barbarian, and the two mixed-caster builds. It runs four
focused source files, typecheck/lint once, and the serial actual-app stories.
The fresh current catalog remains at1,535 definitions/snapshots; this mode
does not publish historical catalog versions or rerun the accepted parent bundle.
The same20-minute runtime and memory limits apply.
To rerun only affected stories, append their existing names/IDs as one comma-separated
argument, for example `npm run verify:unraid -- builders Cleric,Druid,A6`.
The exact selection is retained in the source-bound report; omitted selection runs all14.

The parent workflow includes eleven native edit/award/reload/access
checkpoints to the Fighter story and a third, serial Fiend update/replay story.
It uses an exact reviewed legacy entry from the October23 archive, published
as version2 after the ordinary current-v1 bootstrap, then publishes current
version3 through the same full-catalog atomic importer. Existing immutable
snapshots, unrelated catalog entries, character rows and security profiles must
remain unchanged during publication. A real UI-created legacy target retains
ordinary spells, awarded inventory and a rolled HP draw through correction;
the exact UI request is replayed with a genuine JWT and must write nothing.
The new current-v3 control and all other characters must stay unchanged. This
is separately labeled fresh-state parent evidence; historical1→2 aggregator
and ancestry/F3 upgrade gates are unchanged.

All three stories pass at `13dde07c`, run
`0e81c06a-6ac4-431d-a0e8-49e25ae58a09`. Final source/evidence review is clear.
The separately labeled current-state parent acceptance receipt is in
`../equipment-runtime/unraid/parent-positive-20261029T035402Z/`. Ten introduced
images,25 server inputs and15 local archives across five attempts are removed;
all task runtime/credentials are gone and130 evidence files are retained.
All56 original containers,95 volumes and53 original image IDs match baseline,
Docker23.2 GiB free/cache0. Historical parent1→2/A4/F3 upgrade gates stay open.

The earlier two stories pass at `1de39d9`, run `bd7f3ef4-88e7-4305-b39d-78264d453551`.
The 1/0/2 vector and all21 HTTP outcomes are verified, with original inventory
and full global profile retention. All task runtime, six introduced images,
five server source/input paths and three local archives are removed;15 public
result files remain. The56 original containers,95 volumes and53 original image
IDs match the baseline, Docker23.2 GiB free/cache0. Historical full-parent,
ancestry/A4 and F3 upgrade acceptance remains open; see the canonical handoff.

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
