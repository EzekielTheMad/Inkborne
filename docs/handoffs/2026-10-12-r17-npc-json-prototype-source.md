# R17 NPC JSON local prototype — unverified source checkpoint

2026-10-12. Approved bounded local plan831ca79 over proposed be9a603, owned
r17-library-npc-worker/codex/r17-library-npc-plan-20261012. JSON is a provisional
local working assumption; human format choice is still unanswered. This is not
an approved app upload/import format or persistence feature. Preserve old NPC
source/harness48af, all other writers and worktrees.

New pure `lib/import/npc-json/{types,codec,review}.ts`, read-only
`components/library/npc-json-import-preview.tsx`, original JSON fixture and
focused codec/review/component controls only. No app route/chooser/upload action,
MPMB change, shared NPC schema change, Auth/provider/SQL/staging/commit/dependency
or game-mechanics change. Existing narrative profile is composed unchanged.

Codec checks raw byte/declared-size bounds before decode; explicitly rejects
BOM; validates UTF8 sequences with original starting-byte locations. Finite
recursive JSON reader applies depth/node/member limits before constructing each
value, detects duplicate decoded keys/escaped aliases, rejects dangerous object
keys only and preserves those words in ordinary narrative values. Every decoded
key/value rejects NUL/lone/incorrect surrogate pairs before schema/candidate;
valid pairs, whitespace/plaintext/absence/empty/ordered duplicates are preserved.
Known envelope/data/name/explicit effects[] validation is validation-only; no
parser stripping is persisted. Source positions count original UTF8 bytes and
one-based Unicode-scalar columns/LF lines, including escaped and multibyte text.
Diagnostics and schema paths/messages are bounded; failure has no candidate.

Local review privately copies original bytes before async native SHA256, preserves
external safe filename/hash/byte count/field locations and deeply freezes accepted
data. Hash failure refuses review; no synthetic receipt/hash fallback. Object-key
order is not a JSONB promise; array order and duplicates remain meaningful.
These DTOs represent local validation evidence, not unforgeable provenance or
authorization. The read-only component expects producer-validated review data;
no writer consumes it. It exposes actual group presence/empty counts and uses
the shipped NpcProfile for narrative, plus escaped description/occupation and
provisional/no-import status. Retained prior preview is explicitly labeled.

Prepared controls cover original schema and current/immutable parser compatibility,
name/authority/type/unknown-field refusal, valid nonempty effect rejection without
repair, raw absence/empty/order/duplicates, literal/escaped Unicode/key alias
cases and byte offsets, UTF8/BOM/grammar/nonfinite/all bounds, frozen original
byte hashing/mutation/formatting differences and hash failure, actual profile
escaping/duplicate/presence/no-actions/retained-source disclosure. Test counts and
runtime acceptance are NOT observed yet.

Read locked installed Next16.3.8 use-client guide before TSX. React checklist:
read-only component, no render-time side effect or unnecessary hooks, direct
imports, semantic headings/regions/status, escaped plaintext and finite output.
This checkpoint has only static diff checks. Root holds heavy/UI: no tests,
typecheck/lint/build/browser/install/server/network/provider/SQL executed. No
long-running task process/listener started. Freeze exact source/tests before a
separate offline fixture/harness checkpoint and independent review/released gates.

## Separate offline source preparation — still unexecuted

Production/source tests0f3ee6647f0b15f96a58c8d70a32c828b14a3476 independently
approved. Additional test-only checkpoint7cdce9aee0273974b32a5211317c436fd2ed90b0
prepares otherwise-valid unsafe-reader controls: duplicate effects dropping a
valid mechanical effect; unsupported/escaped duplicate format version; dangerous
or NUL original keys hidden by duplicate data; NUL/lone surrogates in narrative;
malformed UTF8 whose replacement text still fits the shipped schema. They invoke
current review/native hashing and render the actual profile if admitted BEFORE
the refusal assertions. A complete valid positive stays intact. Exact lowered
byte/depth/node/member boundary test uses an otherwise valid NPC (7nodes,
6members, depth3), then the same candidate one below each ceiling; no invalid
schema payload masquerades as positive reader-boundary acceptance.

When a separate baseline slot is authorized, temporarily substitute ONLY codec
decoding/JSON-reader admission with nonfatal UTF8 decode plus JSON.parse; keep
current strict candidateSchema/name/NPC validation, review hashing/freezing and
actual profile unchanged. The dedicated admission controls must show substantive
accepted-profile failures with the original positive passing; no missing-module,
unknown-field/constructor collection failure counts as reproduction. Preserve
exact source/blob/mounted bytes before substitution and finally restore all
hashes/clean status. No baseline has been run yet.

Explicit offline config `e2e/local-npc-json/playwright.config.ts`; later command
`npm.cmd run test:e2e -- --config e2e/local-npc-json/playwright.config.ts` only after
review/build/UI release. Artifact directory `test-results/npc-json-local`;
default manifest `test-results/npc-json-local/production-artifacts.json`. Six
owned fixture/config/spec/production-input/scenario/runner paths, eight fixed
core/fixture source paths at0f, two independently bound inherited executable
helpers (process0841bda7b9e785280e684030bf4fe900d81465e5 and production assets
e4058f8a31cd911583a312e59fedcf4c3fd4adae). Wrapper AND runner verify fixed Git
blobs/raw root/index/checkout config before dynamic process-helper import/use,
and repeat at end/before force; own full non-bundle closure and fixed core bytes
are checked before those helpers and again afterward. Actual metafile project
inputs and lock/root mounted bytes are checked before any browser execution.

Complete successful clean current-root build receipt/BUILD_ID, complete compiled
CSS and local font manifest are required; no fallback CSS or fabricated font.
One private Chrome/server pair with OS birth/PID/parent/exact command/cwd/start,
resources and both closed-port/browser-exit readback. Cooperative IPC shutdown
then bounded10seconds; force only freshly identical captured birth/PID/parent/
command for that exact tree. Previous receipts/screens/failure DOM are archived.

Intended four finite cases per desktop1280/mobile390 = 8grouped receipts and
8viewport/font screenshots: original native file/schema/profile/hash/duplicates/
escaped markup; surrogate/multibyte-offset refusal with invalid focus and prior
source/hash visibly retained; valid pair plus declared empty groups; disabled
native picker/pending single read with an explicitly modeled result delay and
native SHA256. No Math.random/crypto substitute. All local codec/file/profile
behavior is real; result delay is a fixture timing model. No Auth/actions/router/
app upload/stage/commit/save/navigation/SQL/RLS/provider or human-format approval
is simulated or claimed. Counts remain intentions until actual execution.

Static diff checks only for this harness preparation. No new gate/process/server
has run. Freeze this source for independent review before any released narrow
tests/typecheck/lint, full integration/build or explicit UI acceptance.

## Review correction checkpoints — supersede75e, still unrun

Test-only7cdce9a independently approved. Tiny product wording correction
`101027b5b5ae21cd05dcbf6979df9c626ba8aa71` changes only retained-preview status
and its focused component assertion: previous preview does not describe the
selected file. It no longer falsely says changed/pending files were rejected.
Generic provisional/no-import disclosure remains; codecs/review/core contracts
are unchanged. Harness source keeps all eight required source paths: component
alone binds that exact101027b checkpoint; every other path remains exact0f3ee.
No arbitrary HEAD fallback. Existing pending case now asserts truthful retained
status both after selection and while busy, without inflating case counts.

The harness after teardown now performs a fresh complete loadNpcJsonAssets and
bindNpcJsonInputs using the original metafile/captured map. It deep-compares the
entire fresh artifact envelope with the proof used to render, including frozen
root HEAD/source/node closure/transitives, lock/build receipt/BUILD_ID/all CSS/
fonts/source classes and installed runtime package identities. Native node
version plus seven installed package versions/raw package JSON hashes are
recorded in initial/final proof; their bytes match root and versions match lock.
`finalBindings` records and asserts exact complete equality; mismatch is saved
as failure alongside original evidence and cleanup, not discarded or silently
accepted. Port-closed/browser-exited checks and prior failure preservation remain.

These are source-only amendments. No narrow/type/lint/build/browser baseline or
acceptance has run. Earlier75e is preserved as an immutable superseded harness
checkpoint. Independent exact review and explicit resource/UI release remain
required; format decision and app/persistence activation remain pending.

## First released narrow attempt — paused for test-only correction review

At approved clean25943793fb928bfb2d9f50755ef7429fc984f32b,
`npm.cmd test -- tests/components/library/npc-json-admission.test.tsx --maxWorkers=2`
with ONLY the reviewed temporary unsafe UTF8-decode/JSON-reader substitution
produced9substantive actual-profile admission failures and1valid positive pass.
This is a synthetic unsafe-reader control, not a claim of historical production
exposure. Strict candidate schema/name/NPC/review/native hash/profile stayed
unchanged. Finally restored all8original raw hashes and clean status; codec Git
blob1f9b335849eaefdd5b10cdef1fc1693e3001f1f2/rawSHA256
a404a56d75307bbdf9a498137c9b3d4f9a1ffb540a3d9085e582c61c27a1c4e9.

Restored four-file focus (codec/review/preview/admission, --maxWorkers=2) then
observed59fail/21pass, 1filefail/3pass,80tests. Native TextEncoder in jsdom returns
another-realm Uint8Array; direct codec fixtures hit the existing instanceof
byte guard, while review's native byte copy and the other3suites passed. No
parser/schema/semantic admission assertions are removed or changed. Finite
TEST-ONLY7f3f021582140fd1fc64d63e0ef8306b4455fb59 copies native encoded bytes
into this realm's Uint8Array, matching File.arrayBuffer/review input construction
without changing byte values/text. Production259 remains unchanged. Correction
requires independent review before any repeat; no follow-up gate/type/lint run.

Original baseline/focused failure logs/receipts, approved/unsafe byte backups,
eight-file restoration and preparation manifest are retained in ignored
test-results/r17-npc-json-gates. baseline-inputs.json SHA256
2aa1f5ad799b46c228045ac6005cca7cd35aad2ee482519bd13c9bfa60704c49.
No production browser manifest/build/UI generated here. Gate receipts record
actual OS birth/PID/parent/cmd/cwd/start and before/after process/memory/CPU/
listener counts; paused readback23captured identities including wrappers,
zero exact live task processes and task listeners. Heavy slot released to root
pending correction review. No build/full/browser/install/network/SQL/provider
activity; final acceptance is incomplete.
