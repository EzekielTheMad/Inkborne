# R07.1 real-runtime harness preparation

2026-10-12 UTC. Owner: R07 worker, worktree
`C:\Users\kaios\Documents\Codex\2026-10-11\task-2\r07-runtime-harness-worker`,
branch `codex/r07-real-runtime-harness`, base
`ff39986683ab5ebcfdf8a4fe708979b13966a6e1`.

**Implemented and tested locally; real DB not executed.** This finite child prepares
full frozen migration replay and baseline/stage evidence. It does not accept equipment
behavior, M1/R12 item effects or the remaining R07 race/rollback/receipt matrices.
Root owns final integration, G1/G2 authorization, runtime provisioning and teardown.

## Implemented contract

`scripts/equipment-runtime.ts` uses only Node builtins. No dotenv, provider keys,
connection URL from the host, CLI installation or runtime startup is used. Existing
repository npm scripts cover quality gates; this standalone helper covers a new
scratch SQL operation, not a replacement gate.

- `freeze` requires a committed clean source and hashes every sorted migration,
  the unchanged staged SQL, literal runtime Compose, helper and four audit SQL files.
  Migration number gaps remain gaps. Nothing is skipped, synthesized or reordered
  beyond deterministic filename order. All approved SQL bytes are cached before
  the first Docker operation to avoid rereading changed files during execution.
- `baseline` / `stage` require an explicit G2 JSON record naming Victor, approved
  UTC time, source SHA, exact manifest SHA256, daemon ID, full 64-hex container and
  network IDs, and image ID. A matching `--confirm-g2-manifest` is also mandatory.
  This record is a receipt of external human authorization, not a way to create
  authorization by editing JSON. Root must obtain actual authorization first.
- Only context `desktop-linux` and the existing installed absolute Docker executable
  are used. Shell execution is disabled; argument arrays carry no passwords. The
  helper neither reads `.env` / credential files nor requests interactive passwords.
- Before SQL, verify daemon identity, exact container/name/project/service/image,
  linux/amd64 digest pin, sole internal network, no published ports, and exactly
  two owned volumes plus two allowed read-only scratch binds. Windows scratch
  sources and their exact `/run/desktop/mnt/host/c/` equivalents are allowlisted;
  arbitrary paths, writable binds and socket mounts are refused.
- `psql` runs inside the recorded DB container over its Unix socket as `postgres`,
  with `-X`, `--no-password`, `ON_ERROR_STOP=1` and SQLSTATE-only error verbosity.
  Each session first sets a 60-second statement timeout and 5-second lock timeout.
  SQL stdin remains the frozen file bytes. Replay is sequential; first failure stops
  later migrations and stage. The helper never resets or resumes partial replay.
- Read-only bootstrap checks require PostgreSQL 17; actual Auth/Storage migration
  tables, users/objects/buckets and uid/jwt/foldername helpers; real API-role
  attributes; zero preexisting Auth users/Storage objects; and absent application
  tables. No replacement helpers or narrowed schemas are created.
- After all migrations, assert the baseline application tables, copy/ability
  entrypoints, ref triggers and RLS. Record every public/private/auth/storage table
  with **exact row counts**, plus actual extensions, roles, function-body MD5s,
  search paths/owners/security-definer flags/effective executes, trigger MD5s,
  policy MD5s and table privilege matrices. Metadata hashes supplement the source
  SHA256 manifest; they are not cryptographic proofs of behavior.
- `stage` requires the exact completed full baseline receipt for the same source,
  manifest and container. Recompute/compare the complete catalog/grants/count
  fingerprint before applying stage once. Already-present stage and catalog drift
  are refused. After stage, assert trusted entrypoints, forbidden API executes,
  grant-table RLS/grants and enabled receipt/provenance/ref-lock protections, then
  capture the complete post-stage audit again.
- Journal each successful/failed SQL filename and exit code before continuing.
  Keep `complete=false` on failures. Never persist raw stderr/stdout from migrations,
  SQL failure bodies, credential-bearing DSNs or row bodies. Retain the first failure
  location and exit code. Metadata/audit failures remain incomplete receipts.

## G2 preparation and exact operation entrypoints

The runtime plan and Compose from the integration owner's previous work must join
this worker at integration. They are not duplicated into this worker's branch. A
real freeze cannot succeed here until the tracked Compose exists and the combined
source is clean; this is an intentional prerequisite, not runtime verification.

After final integration/review, in the exact clean candidate worktree:

```powershell
node --import tsx scripts/equipment-runtime.ts freeze
```

This local-only mode prints `{manifest, manifestSha256}`; it performs no Docker
command. Root saves it as an existing JSON file under:
`C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-runtime\evidence\r07.1`.
Do not edit the emitted manifest or silently regenerate it after approval.

The separately authorized G2 runtime owner creates/inspects the declared resources
and records actual IDs in `g2-approval.json`, using this exact shape:

```json
{
  "gate": "G2",
  "scope": "R07.1-baseline-and-stage",
  "approvedBy": "Victor",
  "approvedAtUTC": "ACTUAL_HUMAN_APPROVAL_UTC",
  "sourceSha": "FINAL_REVIEWED_40_HEX_SHA",
  "manifestSha256": "EXACT_64_HEX_MANIFEST_HASH",
  "engineId": "ACTUAL_SELECTED_DOCKER_DAEMON_ID",
  "containerId": "ACTUAL_64_HEX_DB_CONTAINER_ID",
  "imageId": "sha256:ACTUAL_64_HEX_IMAGE_ID",
  "networkId": "ACTUAL_64_HEX_PRIVATE_NETWORK_ID"
}
```

The displayed uppercase placeholders are deliberately invalid. No approval record
or credential was generated during preparation. `baseline` and `stage` accept only
existing scratch JSON paths and refuse any existing phase receipt instead of
overwriting/resuming an uncertain attempt.

```powershell
node --import tsx scripts/equipment-runtime.ts baseline --manifest C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-runtime\evidence\r07.1\manifest.json --approval C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-runtime\evidence\r07.1\g2-approval.json --confirm-g2-manifest EXACT_APPROVED_MANIFEST_HASH
node --import tsx scripts/equipment-runtime.ts stage --manifest C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-runtime\evidence\r07.1\manifest.json --approval C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-runtime\evidence\r07.1\g2-approval.json --confirm-g2-manifest EXACT_APPROVED_MANIFEST_HASH
```

G2 SQL effects are exactly the complete ordered source migration chain, session
timeouts, read-only bootstrap/catalog assertions/counts, and the unchanged stage
applied once. The helper does **not** create `supabase_migrations` history; its
external ordered journal proves replay status. Do not confuse that journal with a
provider migration ledger. No hosted SQL, history repair, key/account creation,
emails, reset, fixture deletes or runtime lifecycle commands are present.

## Fixture and cleanup manifest

R07.1 has **zero synthetic product fixture IDs**: emitted `fixtureIds: []`. It
creates no owner, character, content, campaign, copy, feature, ASI or item fixture.
Existing migrations may initialize baseline catalog data; exact counts record that
result. There are no fixture-delete queries in this child.

The integration runtime owner retains the G1/G2 exact resource manifest:
`inkborne-equipment-e1-20261011-db`, `...-auth-migrate`, `...-storage-migrate`,
`...-net`, `...-db-data`, `...-db-config`, with actual IDs. Teardown is separately
executed under that approved scope after residue/evidence readback; the helper has
no broad stop/prune/delete interface. Keep shared daemon/images and evidence.

Transport commands have bounded 30-second metadata / 120-second SQL-client limits
and 2 MiB combined captured-output limits; audit table budget is 256. Process
metadata records exact task-owned PID, parent PID, executable, argument array, cwd,
UTC start/finish in the journal. A timeout kills the exact spawned client handle;
root must inspect any plugin/exec descendants and active DB backend on failure before
manifest-scoped teardown. Do not describe a disconnected client as a rolled-back
server transaction without DB readback. Task-owned processes must be verified exited
before final runtime acceptance.

## Explicit remaining acceptance matrix

Every item below remains **unimplemented/unexecuted** in this harness child:

- Real owner/nonowner/anonymous/service role mutations and owner reads under JWT
  claims; direct DML denial, immutable original receipt, marker/provenance protection.
- Synthetic actual-schema create/award/copy fixture with full feature/ASI/spell
  synchronization, magic-item immutable effects/version pins, narratives and children.
- Parallel identical/different awards, both access/ownership/pin/copy lock orders,
  overlapping independent connection lifetimes, observed blocker locks, and bounded
  deadlock/timeout failure classification.
- Fault injection at each item/state/receipt/marker/copy-child boundary; compare
  all tracked tables and receipt/provenance across actual transaction rollback.
- Confirmed commit followed by response loss, receipt recovery after consumption,
  spending or pin deletion; exact original receipt without new intent/fallback.
- Fresh second full replay after exact teardown; full fixture residue audit and
  accepted resource-usage/port cleanup receipt.
- Browser/API/Auth-provider/Storage HTTP acceptance and hosted G3 decisions.

The next finite R07 child should implement approved original fixtures and the
create/award/copy real-role slice against the successfully replayed baseline, then
add contention and fault cases. This child does not close R07 or the E1 gate.

## Local verification and provisioning receipt

`npm.cmd ci --ignore-scripts` completed successfully: 814 packages. Process record:
shell PID 44792, parent 30200, known worker cwd, UTC start
`2026-10-12T00:36:31.3203696Z`; no runtime/server started. Existing old lock reported
37 audit findings; root's independent security/lock lane owns that work. No audit fix
or lock change was made here.

- `npm.cmd test -- tests/scripts/equipment-runtime.test.ts`: **17 passed**.
  Tests inject transport only: wrong daemon/name/state/image ownership/isolation,
  writable/unowned mounts, hash/source/inventory drift, missing human G2/hash gate,
  exact ordered bytes, first-error stop, output suppression, exact-count audit,
  full baseline receipt, stage fingerprint drift and one stage application.
- `npm.cmd run typecheck`: passed again after all 17 cases were present.
- No real Docker transport, SQL files, schema, secrets, fixtures or stages executed.
  Fake Git repositories and SQL strings exist solely for injected-transport tests;
  they are not baseline substitutes or DB acceptance evidence.
- Full `npm.cmd run check` / combined lint are reserved for root's final integration
  capacity as explicitly instructed for this worker; no browser workflow changed,
  so browser E2E was not run.

Source-file hashes are produced by `freeze` after final combined-source commit,
which makes the approval package reproducible without a self-referential commit
hash in this handoff. Root should independently review the harness and SQL before
freezing G2. A saved proposal, unit green, typecheck or clean catalog is not real
equipment or launch acceptance.

Worker artifact SHA256s, before integration:

| File | SHA256 |
| --- | --- |
| `scripts/equipment-runtime.ts` | `625bbb31cfbfe0d51acaad8a23fdca5783faa774aab0ff7858d745aba5373fd6` |
| `bootstrap-preflight.sql` | `8db5f351395cb7f65f8230c0b95725a3937d91cd2338f16e812e049f159349b0` |
| `baseline-assertions.sql` | `138e38f47929e5ee9658a7c8427ac70dfaf9568bff0dd17c05a17996bd42c5ef` |
| `catalog-audit.sql` | `b15a098e4534e626873b72de5a7abfa10fc1bbf63c6b7b09cb5a4fed24479e77` |
| `stage-assertions.sql` | `cfc051e9ecf5aa2de0de121524dcbfd0950407ab0ff04acab2f337d8ddd87618` |
