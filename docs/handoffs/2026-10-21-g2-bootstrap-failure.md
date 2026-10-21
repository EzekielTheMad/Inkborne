# G2 attempted — official bootstrap prerequisite missing

Victor approved the prepared baseline/catalog-only step in this chat on October
21. Vercel hosting and M7 pause remain in effect. Tested executable application
acceptance remains at 236ebcf; this attempt established no native baseline or
materializer-owner acceptance.

## Preserved attempts on the original frozen source

Source `e860e6960bf8833411890532bdba9009fd18d13c`, original manifest SHA256
`3e8706c42a3fa181ba2b7b1ee69dfc46d1c4035ed57350bf853a13a598bbb6b2`.
Evidence root:
`C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-runtime\evidence\g2`.

| Attempt directory | Observed outcome |
| --- | --- |
| `20261021T202507Z` | Postgres image inspection timed out before any resources were created; immediate inventory readback also timed out. A later bounded readiness read returned the same daemon ID. No engine restart. |
| `20261021T202631Z` | Fresh stopped resource/file inspection passed; DB initialization exited before jobs or application SQL. All three containers, network and two volumes removed and absence read back. First failure retained; startup log diagnosis was not captured before this teardown. |
| `20261021T202739Z` | Fresh diagnostic attempt retained the startup cause: exit 3, OOM false, `99-roles.sql:7` reports role `supabase_functions_admin` absent. Initialization stopped; all six resources removed and absence read back. |

No Auth/Storage migration job ran, no application migration replay occurred,
no fixtures or disabled stages were installed and no application function was
invoked. Some official database initialization/password-role SQL ran before the
error; it is inaccurate to describe this as zero SQL execution. There is no
`R07.1 baseline-receipt.json` and no successful catalog capture.

Stopped inspections confirmed exact pinned images, no published ports, restart
`no`, internal network, expected limits/mounts and job commands. Copied Auth ELF
was 52,556,098 bytes, SHA256
`dbb135b1a7608406a6e147ae646d58db7c22d8a664dcec9a4355a8124e8712f9`;
Storage entry 1,642 bytes, SHA256
`59bc11e561eedd00e478403eacc33297792874c9ffb0265fd57ab766ca4c4940`.
Both were inspected without invocation and removed on teardown. Initial inspection
confirmed an ELF/migrate marker and the Storage migration call, not full Auth
command acceptance. Per-attempt selected metadata, processes and resource readbacks
are preserved. The three controllers and all 95 recorded client identities were
independently absent at `2026-10-21T20:30:19.1632304Z`.

## Diagnosis and local correction

The immutable official Compose at Supabase commit
`564eab8ad7840b13324f68b1bfac074ef8d51c21` places `webhooks.sql` at
`98-webhooks.sql` before the existing roles file. That full file creates the
missing role. The reduced recipe omitted this prerequisite. The new candidate
adds that exact read-only mount and requires all five exact DB mounts; no role
stub, partial source splice, skipped migration or schema repair.

Focused transport tests: **63 passed / two files**, including three bootstrap
mount-refusal cases. All 71 observed test identities exited. First full check
preserved **4,880 passes / ten failures / three UNVERIFIED skips**: the successor
core-profile transport still supplied four mounts and failed the stricter guard.
Its fixture was corrected without relaxing the guard; focused **60/60** then
passed and all 43 observed identities exited. The original full check's 400
observed identities exited; its failure receipt remains intact.

Final `npm.cmd run check` passed typecheck, zero-warning lint and **361 files /
4,890 tests / three UNVERIFIED M5 skips**, with four bounded workers. All 398
observed identities exited. Evidence is scratch
`evidence/local-check-20261021T204208Z`; earlier failure is
`evidence/local-check-20261021T203122Z`. No browser workflow changed, so no browser
gate was run. Production app build evidence remains the earlier unchanged-app
checkpoint; this runtime/helper change does not establish gameplay acceptance.
The [amended native package](../specs/2026-10-21-g2-bootstrap-amendment.md) is
prepared but not executed at this checkpoint. Each failed attempt stopped; the
fresh corrected freeze retains the existing human baseline-only authorization.
Root judges completing official initialization inside the same disposable target
to be within that scope, with no new services/hosted action or gameplay stage.
The additional official SQL and its grants/objects are disclosed in the amendment;
no new human approval of that file is asserted.

M1 materializer child remains blocked on native catalog facts. M5 guard/bonus
measurement holds persist; no browser, auth-provider or beta acceptance follows.
