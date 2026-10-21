# Class-acquisition dependency calculation — staged local checkpoint

Victor authorized the next class-acquisition work and continued M1–M6, retaining
Vercel hosting and the M7 pause. This implements the finite calculation needed
before protected native allocation; it does not claim first-class acquisition or
milestone acceptance. M5.5 remains in core scope; M8 follows core acceptance.

## Source and review

Integration workspace: `C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-verification`,
branch `codex/launch-integration-20261011`, starting source `72b10c2`.
Isolated SQL worker: `../class-dependency-resolver-worker`,
branch `codex/class-dependency-resolver-20261021`. No other worktree was modified.
The app worktree operation failed on its old-repository reference; the worker
checkout was created from the actual integration repository with native Git.

| Source | Responsibility |
| --- | --- |
| `266bc24` (worker `2921658`) | Add staged dependency resolver, including independent review fixes |
| `cae1499` (worker `da2b272`) | Fix whole-row dependency snapshots after differential test failure |
| `4b35ec7` | Add 30 differential/refusal tests against original SQL |

Both worker and integration SQL Git blobs are exactly
`0df33644d21c87c55025aa61f89a04288e0ab81e`.
Reviewed LF source SHA256 is
`a4d8d0ef959ecaeae599428b74da2e8d0d4cd7e16a5448ad4f895b345c267825`;
integration CRLF working-file SHA256 is
`d1b2fd5ef20801695bbbd9ccca0f8e52d0deb207912798407fc059b30453a470`.
Line endings explain the difference; normalized bytes match.

Independent semantic discovery identified the canonical legacy materializers,
activation predicates and exact projection INSERTs. Independent owner review
passed final SQL and the differential fixture. Review caught three installation/
calculation issues before integration: atomic CREATE/OWNER/REVOKE, refusing an
existing object instead of inheriting ACLs through replacement, and refusing
historical active spell aliases whose representative requires allocated grant IDs.
The focused test then caught `to_jsonb(version)` binding the integer column rather
than its whole-row alias; both snapshot reads now use the unambiguous `snapshot`.

## Delivered behavior

The new staged SQL file defines only
`private.resolve_first_class_dependencies_v1(uuid,uuid,integer)`: STABLE,
SECURITY INVOKER, empty search_path, postgres owner, application/PUBLIC execution
revoked. It has no application caller or runtime-role grant. Atomic creation fails
if the object already exists. Actual native installation must still validate the
target's default ACLs, resulting owner/grants and invoker read/helper privileges.

For an existing target and exact accessible same-system class snapshot it returns:

- Complete feature and spell grants, including dormant later-level grants,
  minimum unlock level and first flattened source ordinal after slug merging.
- Exact raw controller/dependency snapshot rows, unique by content/version,
  preserving native fields dropped by the TypeScript content parser.
- Hypothetical first-level feature contexts and auto-spell row defaults, following
  original native projection semantics and ignoring unrelated current choices.

Feature selection preserves literal whitespace, historical cutoff, the native
SRD/homebrew access predicates and owner/time/version ranking. Equal highest-ranked
distinct feature identities refuse rather than inventing an ID tiebreak. Spell
selection preserves trimming, all three native manifest shapes, access and the
total owner/platform/time/version/content-ID rank. Same-slug repeats merge;
distinct active slugs selecting one spell content ID refuse because the original
projection's remaining tie requires future native grant IDs. Dormant historical
versions remain in the complete descriptor. Feature data is not expanded recursively.

The finite admitted input rejects malformed/coercive manifests instead of copying
all legacy JSON coercions. Features require numeric integer-text levels1–20 and
nonblank strings. Spells retain native object-tier/string/array forms and levels1–20.
Bounds are 4096 raw references per family, 4096 candidates per dependency, 4096 exact
versions including controller, and 4MiB complete JSON output. No truncation occurs.
Unavailable/access failures use23503; malformed22023; ambiguity23514; bounds54000.

## Verification and preserved failures

Scratch evidence root: `C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-runtime\evidence`.

- Initial focused run `local-class-dependencies-20261021T210126Z`: 26/28 passed;
  two raw-snapshot failures preserved. All six observed process identities exited.
- Corrected focused run `local-class-dependencies-20261021T210202Z`: **30/30 passed**,
  one bounded worker; all six observed identities exited.
- Initial full check `local-check-20261021T210213Z` stopped at six TypeScript errors
  in the new fixture's inferred query/result types. These were corrected without
  changing SQL; all seven observed identities exited.
- Final full project gate `local-check-20261021T210235Z` at executable source
  `4b35ec7`: **PASS** typecheck, zero-warning lint, **362 files / 4920 passed /
  three UNVERIFIED M5 skips**, four bounded workers. Finished21:07:21.0817134UTC;
  all424 observed process identities exited. The skips remain open requirements,
  not accepted behavior or waived tests. Only documentation changed after this run.

The fixture executes actual original access/materialization/activation functions
and exact extracted production projection INSERTs against a minimal schema. It
does not replace Auth or the access helper. It omits production RLS, admission,
triggers, locks and multi-connection behavior. Effective-privilege assertions are
this offline model's configuration only. Positive sampled counts/choices are not
complete all-row nonmutation evidence; refusal assertions compare after savepoint
rollback and do not establish production transaction rollback or phase recovery.
STABLE/read-only source review is separate from those sampled fixture assertions.
No browser workflow changed, so no E2E run or new application build was required.
No server was started. Listening-port count stayed44. Independent post-run
identity/port readback is stored beside the final gate's summary; worker checkout
is retained clean at its committed SQL checkpoint, with no dependencies/services.

## Independent G2 challenge and next class work

Independent read-only review of the existing baseline evidence passed all13
function-body/metadata comparisons, 52 effective privilege rows and 11 trigger
declarations. Actual local owner is postgres LOGIN/INHERIT/BYPASSRLS, not SUPERUSER.
Five trigger-function bindings were among the13 captured functions; six others'
OID/body/owner bindings were not captured. Native attnum-to-column names, WHEN
expressions and constraint relationships remain uncaptured. Those are later
installation preflight work; no new native run was performed to fill them.

Next is B1's protected native identity/timestamp allocation envelope, derived from
verified preacceptance inputs and this complete dependency calculation. Then B2
must materialize those exact identities through all affected legacy writers, and
B3 must couple the actual guarded choices write to observed proof/revision/order.
The descriptor has no verified actor, bootstrap lineage, locks or source certificate;
later acceptance must rederive/revalidate under its reviewed locking contract.
Preacceptance inputs cannot be read from a journal that accepts only the already
complete immutable graph. No retrospective graph/ID mutation is permitted.

No native stage/fixture/race, hosted query/write, Auth/provider flow, push, merge,
deployment or backup/restore ran. Existing application source, migrations,
readiness gates, materializers and hosting configuration are unchanged. M7 PDF
importing and creature imports remain paused; existing PDF export is preserved.
