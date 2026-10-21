# G2 baseline/catalog complete — isolated PostgreSQL, no deployment

Victor authorized the prepared baseline-only step, retaining Vercel and the M7
pause. The official bootstrap omission and first failures were corrected and
preserved in [the earlier handoff](2026-10-21-g2-bootstrap-failure.md). Root treated
the complete official prerequisite as a scoped local initialization correction,
not new hosted authority. The corrected candidate passed the full project gate
before a fresh native attempt. No staged gameplay SQL or fixture profile ran.

## Exact source and receipts

Clean executable source: `29b6cc814f667d13d7798fffb1aa5d10ae94308c`.
Fresh R07 manifest SHA256:
`c2b2d5cabf1e3d2603c825307a4246640002295d390949d9bcc9ca721acff16c`.
All 83 application migration paths/bytes are unchanged from the original freeze.
Both official bootstrap hashes and the operational launcher/comparison hashes
are separately bound in scratch `evidence/r07.1/g2-baseline-preparation-bootstrap-v2.json`.
The original manifest/preparation receipts were not overwritten.

Scratch root:
`C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-runtime`.
Successful runtime evidence: `evidence/g2/20261021T204724Z`.
Finished: `2026-10-21T20:50:22.400Z`.
Its `summary.json` SHA256:
`788921ed054ac730bf8fc639283465dc0a2357e012a03dbf453c41fa72592b25`.
Original-format `evidence/r07.1/baseline-receipt.json` SHA256:
`2364a3cce54490e65a0ecdabc2fd0969b943a68902ed68d78a920218ecbc6af8`.

Stopped resource/image/file/isolation inspections passed. Real PostgreSQL **17.11**
initialized with complete official bootstrap; Auth and Storage migration jobs each
exited zero. R07 preflight, all **83 ordered migrations**, baseline assertions and
catalog/count audit passed: **85 steps, one audit, complete true**. The native audit
contains 60 tables/counts; only official histories were nonempty: Auth 77 and
Storage 70. Application and auth-user tables were empty. No user-row contents
were read or exported. Installed extension versions: pg_net 0.20.4,
pg_stat_statements 1.11, pgcrypto 1.3, plpgsql 1.0, supabase_vault 0.3.1,
uuid-ossp 1.1. This is replay proof, not a hosted migration-ledger update.

The controller used the existing executeApproved baseline with a bounded native
transport. Its original-format journal has `processes: []`; all **543 actual
client records** are in the separate controller `processes.json`, linked by this
handoff and source/target/manifest receipts. Do not present the empty journal field
as an independently verified process transcript or silently alter its bytes.

## Materializer facts, no application function invocation

All 13 fixed functions exist and are actually owned by **postgres**, observed
role OID 16384 in this disposable cluster. The role is LOGIN/INHERIT/BYPASSRLS,
not SUPERUSER. Do not hardcode that OID across clusters or infer hosted ownership.
Each captured function is SECURITY DEFINER with one empty search_path setting.
Root compared all 13 normalized body MD5s, language and declared security settings
against the latest frozen migration definitions: **13/13 match**. Evidence:
`catalog-functions.json` and `materializer-source-comparison.json`.
This is a root comparison, not independent-family review.

The 52 effective role/function rows establish:

| Actor | Schema access across these functions | Effective EXECUTE |
| --- | --- | --- |
| anon | public only | None of the 13 |
| authenticated | public and private | Only the two public reconciliation RPCs |
| service_role | public only | Only the two public reconciliation RPCs |
| postgres | public and private | All 13 |

The two public RPCs are sync_character_feature_refs(uuid) and
sync_character_spell_grants(uuid). Effective EXECUTE is not a successful call,
verified actor or replacement for auth.uid(). The staged class/authority roles
are absent because their stages were not installed; do not infer their privileges.
Captured postgres/public default ACLs include service_role function EXECUTE and
table/sequence privileges. There is no captured private-schema default ACL entry.
These facts replace the old owner-unknown prerequisite for this local baseline.

Eleven noninternal triggers were captured on characters, character_content_refs
and character_spells. All enabled O, zero arguments, nondeferrable and initially
nondeferred. Function OIDs, event/column numbers and raw default ACL arrays are
retained. Full independent trigger/privilege challenge remains before B source
release; catalog presence does not prove execution, locks or concurrent behavior.

## Teardown and resource verification

Removed only the recorded three containers, one internal network and two volumes;
all copied job evidence files were removed. Controller cleanup had zero errors.
Independent readback on the same daemon at approximately 20:51 UTC found **zero
containers**, only the three default networks, and only the preserved unrelated
household-finance volume. All 543 recorded clients plus the controller were absent;
near-birth PID reuse would have been treated uncertain, not killed.
See `independent-final-readback.json`. Shared daemon/cache remain as approved.

Before/after aggregate machine observations: processes 513→527; free memory
10,448,824→7,870,020 KiB; free C: space 194,055,684,096→193,982,636,032 bytes;
TCP listeners **44→44**. These include shared/unrelated machine activity, not
attribution of the deltas to this run. Preflight/final readbacks satisfied the
disk/memory floors; host resources were not sampled continuously.
Nonsecret successful-run evidence was about 0.6 MiB, below 10 MiB; the temporary
copied job files stayed below 64 MiB and are gone.

## Local checks and next work

Full `npm.cmd run check`: typecheck, zero-warning lint, **361 files / 4,890 passes /
three UNVERIFIED M5 skips**, four bounded workers. All 398 observed identities
exited. Focused 63 transport and 60 successor-profile checks passed. The first
full check's ten outdated-fixture failures and all native initialization failures
are preserved. No browser workflow changed; no browser test or fresh app build
is claimed by this runtime correction.

Proceed with the [next materializer bridge design](../specs/2026-10-21-first-class-materializer-next-slice.md)
using observed owners/ACLs. Actual issuer/native row allocation, immutable complete
graph production, writer fences, Auth/provider verification, staged equipment and
disabled-profile execution remain open. G2 baseline is not gameplay or beta
acceptance. M1–M6 including M5.5 precede M8; M7/creature importing stay paused.
No push, merge, deployment, hosted write, provider or backup/restore action occurred.
