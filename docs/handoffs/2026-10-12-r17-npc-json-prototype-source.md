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
