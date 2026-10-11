# E1 disposable Supabase runtime proposal — approval required

October 11, 2026. This is a proposed local runtime lane for the staged equipment
transaction at inspected source `56db57e46e93783356cd132240350784accf1f28`.
The [45-case executable WASM handoff](../handoffs/2026-10-11-equipment-postgres-wasm.md)
already explains the completed local slice. No runtime, schema, fixture, security,
credential, installation, hosted or Docker mutation was performed here.

## Read-only installed-runtime inspection

- Docker executable exists at `C:\Users\kaios\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe`; client version **29.6.2**.
- Docker's `desktop-linux` engine pipe is absent. `docker version` reported failure
  connecting to `npipe:////./pipe/dockerDesktopLinuxEngine`; no usable daemon was proven.
- `Get-Command supabase,psql` found neither on PATH. This is PATH availability, not
  proof that no copies exist anywhere on disk. No package was installed or downloaded.
- Inspected listeners: no rows for 54321–54324, 55431 or 55432. No runtime processes
  named Docker/Postgres/Supabase were returned. These are point-in-time observations.
- Repository config is `project_id="Inkborne"`, PostgreSQL major 17, DB port 54322,
  API 54321 and seed enabled. It is unsuitable as an isolation identifier. No `.env`,
  linked-project token, password, key or authenticated status output was inspected.

Supabase CLI local development uses Docker ([official setup](https://supabase.com/docs/guides/local-development/cli/getting-started)).
The [CLI reference](https://supabase.com/docs/reference/cli/supabase-start) describes
local reset and project-specific teardown; installed-version `--help` must be checked
before use. There is presently no installed CLI version to validate commands against.

## Exact proposed target and permitted resources

Runtime owner: sole orchestrator. Fresh scratch directory:
`C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-runtime`.
New local project/resource prefix: **`inkborne-equipment-e1-20261011`**.
Source is a frozen, reviewed integration SHA chosen immediately before approval;
record SHA and SHA256 hashes of every migration plus staged SQL. Current source lacks
PR101's migration file even though the hosted migration was previously recorded as
applied. Use the reviewed A1-integrated candidate for a combined replay; do not
fabricate, rename, repair or reapply hosted migration history from that discrepancy.

Only new resources with that prefix may be started, reset or removed: containers,
private Docker network and named volumes. Do not reuse the configured `Inkborne`
local project or any unrelated server. Freeze a concrete resource-name/container-ID
manifest before destructive cleanup; no `--all`, volume/system prune or global stop.

Proposed host endpoints, only if required: API **127.0.0.1:55431**, database
**127.0.0.1:55432**, shadow DB **127.0.0.1:55430**; optional UI/mail services disabled.
Recheck all three ports immediately before start. DB-only SQL tests need no browser
or API listener. Do not expose `0.0.0.0` or `::`, modify firewall/security to permit it,
or assume changing a port makes a listener loopback-only.

**Binding is an unresolved startup prerequisite.** The documented CLI start flags
do not provide a verified host-bind-address override. Before approving a launch,
resolve a supported pinned runtime/compose configuration with explicit loopback
HostIp bindings (or no published ports and container-local clients). Review the exact
rendered container plan before start. If the installed CLI cannot meet this constraint,
stop and submit that concrete compose plan; do not launch broadly and fix bindings
afterward. This proposal authorizes neither Docker-engine startup nor a fallback.

Record baseline/after CPU, memory, process count/listening ports. Record task-owned
PID, parent PID, cwd, command, start time and container IDs; bound retries and resource
use. Docker Desktop startup affects a shared daemon and needs its own explicit
approval. Supabase full stacks can use substantial RAM; use only needed services.

## Complete dry-run operation list

These are future actions requiring approval, in dependency order:

1. If Victor approves, start Docker Desktop Linux engine once (hidden helper when
   applicable); verify daemon identity and existing resources without stopping any.
2. Resolve a pinned Supabase CLI/runtime image version and checksum/digest. Install
   only if separately approved. Read installed `--version`, global/start/db-reset/stop
   `--help`; record non-secret command output. No login, link or PAT creation.
3. Create only the named scratch directory; copy frozen tracked SQL/config needed for
   replay. No `.env`, `.temp` linked-project state, private keys or original credentials.
   Change only scratch project ID/ports/disabled services/seed setting. Keep seed off;
   record a migration-file hash manifest and reviewed isolation/bind/resource plan.
4. Approve **scratch-only** SQL/grants/trigger execution, migration history created
   by fresh replay, synthetic fixture rows and disposable runtime credential material.
   Local Supabase bootstrap may generate signing/API/database secrets; that is a
   credential-creation decision, not implied by permission to run tests. Use solely
   scratch-local ephemeral material held in memory or ignored ACL-protected files.
   Never pass secrets on command lines, print status key output or copy hosted keys.
5. Start only the reviewed named runtime. CLI command targets, **only after help and
   bind-plan validation**, are `supabase --workdir <scratch> start` and
   `supabase --workdir <scratch> db reset --local` with scratch seed disabled. An
   approved compose lane must list its exact pinned file/overrides and resource names
   instead. Do not execute these illustrative targets under the current authority.
6. Replay the complete ordered migration chain into the fresh database. Record each
   migration status and first failure; stop on a failure. Do not skip, reorder or
   rewrite old migrations to manufacture success. Record baseline trigger/function
   definitions, RLS/policies, indexes, effective roles/table/function privileges and
   actual PostgreSQL/extension versions before applying the staged file once as
   reviewed local SQL, outside migration history. No `db push`, `repair`, linked URL
   or hosted connection is in this operation list.
7. Execute the fixture and contention matrix below using real independent PostgreSQL
   sessions. Run service-role mutation entrypoints and owner reads under their real
   roles/claims; administrative inspection is a separate connection. Explicitly
   qualify relation/function names and detect missing/inaccessible targets.
8. Audit tracked synthetic IDs/residue, remove only approved run-owned fixtures,
   preserve redacted evidence, then stop/remove only manifest-owned runtime resources
   and volumes. CLI target after validated help: `supabase --workdir <scratch> stop
   --project-id inkborne-equipment-e1-20261011 --no-backup`. Never add `--all`.
   Verify ports closed, owned sessions/containers exited, no fixture residue and
   resource usage returned to baseline. Keep scratch evidence; no blanket directory
   cleanup and no shutdown of a shared Docker daemon without separate approval.

## Full baseline and fixture matrix

Use two synthetic owners A/B and authenticated nonowner C, plus anonymous role.
SQL-only fixtures can use approved synthetic `auth.users` rows without external
email/password accounts; JWT claim simulation proves database authorization, not
Auth/API login. Actual local REST/browser acceptance needs separately approved
local accounts/keys. Do not re-use the ten exhausted hosted fixtures.

Journal every created ID: users/profiles, one game system, exact immutable
class/background/feature/ASI/feat/item versions, eligible/awarded/legacy characters,
campaign + memberships + shares, source refs, feature/spell grants, inventory,
starting-grant ledger, copy destination and narrative/timeline/NPC children.
Derive fixtures from the real migration schema and feature manifests, rather than
replacing helpers/triggers with synthetic no-op equivalents.

| Scenario | Required evidence |
| --- | --- |
| Full migration/grant/trigger replay | Baseline and staged function bodies, search paths, grants/RLS, existing feature/ASI/spell synchronization actually execute; no stub helpers |
| Create/award/copy | Character+eligibility atomic; exact inventory/currency/confirmed receipt; equipped/consumed/copy provenance and narrative semantics retained |
| Identical parallel awards | Two sessions contend at known barrier; one natural grant; identical receipt; exact one inventory/currency award |
| Different selections/source intents | One acceptance, conflicting intent rejected; no partial changes or duplicate grant |
| Award versus pin removal/version switch | Force both lock orders with barrier; accepted result matches one valid ordering, or conflict/access rejection; no mixed snapshot |
| Award versus owner transfer/campaign access withdrawal | Test both orderings and old/new actor; no old-owner success after prior transfer, no unauthorized receipt/body leakage |
| Award versus copy | Both orderings; destination cannot duplicate eligibility/award, receipt inheritance and real ASI/feature remapping correct |
| Two-character/copy contention | Known ordering, recorded lock wait/blocker sessions, bounded statement/lock timeout; classify deadlock/timeout as failure, never success |
| Failure at item1/item2/state/receipt/marker/copy child | Whole transaction rollback; compare all tracked tables and receipt/provenance, not only HP or item count |
| Commit then response loss | Drop response after confirmed DB commit; separate connection reads same original receipt; no automatic new intent or sequential award fallback |
| Grants/RLS/nonowner/anonymous/direct mutation | Effective role tests deny forbidden execute/select/update; owner receipt immutable; marker/provenance protected; explicit inaccessible/no-match result |
| Receipt recovery after consumption/spending/pin deletion | Same original receipt returns; no new inventory/currency fabricated |
| Transaction rollback + fresh replay | Disposable fault path and teardown leave no unintended residue; clean second replay reproduces result |

Race barriers must prove overlapping independent connection lifetimes using backend
PIDs and observed locks, not `Promise.all` around one connection. Never infer rollback
from a rejected HTTP response. Preserve failure evidence and exact accepted ordering.

The [September PostgreSQL 15.19/17.11 changes](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes)
affect some operators/extensions. Inventory actual versions during replay and inspect
relevant migration use; no hosted upgrade/reindex/re-encryption is in this proposal.

## Blast radius, rollback and smallest approval

Expected blast radius: one named scratch Supabase/PostgreSQL stack and synthetic
rows; Docker-engine startup is shared-host impact, and image/CLI installation uses
disk/network resources. App equipment gate stays default-off. No DNS, provider auth,
production schema/data/security, deployment, live fixture or remote Git action.

Rollback is termination/rollback of owned SQL sessions followed by manifest-scoped
runtime/volume teardown; discarded scratch DB has no user data to preserve. Preserve
logs/SQL hashes/fixture journal. If any target unexpectedly resolves outside scratch
or a listener is public, stop before data writes and report the boundary failure.

The earliest approval is bounded runtime discovery/provisioning: Docker-engine start
(if needed) and chosen pinned CLI installation/image download (if needed), while
excluding test-stack launch, database/fixture writes and credential generation. Then
prepare the rendered isolation/loopback plan. A separate final launch approval names
that plan, scratch-only full migration/staged SQL/grants/trigger/fixture operations,
disposable local secret creation and exact teardown. **Installed runtime and bind
plan must be made concrete before that final launch approval.** No blanket approval
follows from this document. A hosted run would require a different named target,
accounts, fixtures and cleanup approval. This document leaves E1 runtime acceptance
blocked and does not pretend the current eight D1/WASM tests establish it.
