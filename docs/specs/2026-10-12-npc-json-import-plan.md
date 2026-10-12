# Proposed R17.3a — one narrative NPC JSON import

2026-10-12. **PROPOSED, pending the human format decision and independent plan
challenge.** Root has asked an optional JSON-versus-evidenced-MPMB preference;
no answer is recorded here. Root uses recommended JSON only as a working local
prototype assumption. This document does not authorize dependent code, enable
app uploads/commits, change SQL, or mark the format approved or R17/import
accepted. Elapsed time is not approval. If the selected format differs, challenge
the revised app/persistence contract before implementation.

Inspected root `fe236dbf05d2ddcbf44239614ea3bfd282a21b90` and clean owned NPC
worker `48af0f691908e66a46129735c79baf4ea425c051`, product correction
`1fc362009f260ca3469fb4440a4f884b702c2e79`. Existing strict schema/profile and
private authoring are usable targets. Preserve all other writers/workspaces.

## Evidence and support boundary

| Actual source | Consequence |
| --- | --- |
| `docs/LAUNCH-ACCEPTANCE.md`, R16/R17; `docs/ROADMAP.md`, M5 | Supported monster import and NPC import remain requirements. This NPC child does not cover monster import, campaign instances, sharing or complete R17. |
| `docs/specs/2026-10-12-library-npc-foundation-plan.md`, R17.3 | A strict v1 JSON format is proposed as a reasonable first input; MPMB NPC mapping needs observed format evidence. |
| `lib/import/mpmb/types.ts`, `parser.ts`, `fold.ts` | Only SourceList/SpellsList/FeatsList; static literal grammar/desc helper. CreaturesList or any NPC registry is rejected before folding. Callbacks do not count as support. No creature/NPC registry fixture was found in inspected tracked importer/docs/transformer sources. |
| `lib/import/mpmb/map/{index,types}.ts`, `preview.ts`; `lib/supabase/mpmb-imports-server.ts` | Mapping, review, finite repair and calculation preview DTOs are spell/feat only. Existing spell/feat behavior remains unchanged. |
| `20260720233030_mpmb_import_review_persistence.sql`; `20260721232837_mpmb_schema_known_guided_repairs.sql` | Import format is mpmb; staged/origin registry and type CHECKs/RPC checks admit spells/feats only. New JSON support cannot be represented by relabeling it MPMB. |
| `20260721041927_mpmb_import_conflict_resolution.sql`; `20260721160500_mpmb_import_preview_validation.sql` | Existing transactional expected-revision/replace/keep-both/immutable-origin/written-version and mandatory current-preview patterns are relevant architecture, not acceptance of a new type. |
| `lib/schemas/content-types/npc.ts`, `lib/supabase/content-definitions-parser.ts`, `components/compendium/npc-profile.tsx` | Strict narrative payload; current AND immutable NPC envelopes require an explicitly present empty effects array before defaults. Canonical refusal must never strip an effectful upload into an accepted empty template. |
| `lib/homebrew/npc-form.ts`, `lib/supabase/homebrew-npcs-server.ts` | Name120, finite strict data, raw group/presence preservation, auth-derived private envelope, pg version bound and exact saved immutable pin confirmation. Import is not a loop over create actions. |

MPMB monster/NPC input, PDFs, paid sourcebook fields and arbitrary script
callbacks remain unsupported. This contract cannot substitute for an MPMB or
PDF compatibility decision. No source text or book content is fetched/copied.

## Proposed exact input contract

Exactly one UTF-8 `.json` file, one NPC, one strict root object:

```json
{
  "format": "inkborne-npc",
  "format_version": 1,
  "name": "Original Bell Keeper",
  "data": {
    "schema_version": 1,
    "occupation": "Original bridge attendant",
    "personality": { "ideals": [], "motivation": "Keep the original bell working." },
    "relationships": [{ "name": "Original Bell Maker", "relationship": "An original acquaintance" }]
  },
  "effects": []
}
```

This is a new Inkborne interchange proposal, not an observed MPMB registry.
Its fixture is wholly original/synthetic and rights-safe. There is no array of
NPCs, external URL, embedded source metadata, resolved relationship, DM secret,
stat block, or JSON editor. Reject every unknown root/nested field. No ID,
owner, system, content_type, source, scope, content version, slug, campaign,
entitlement or sharing-rights value is accepted from the file. `format_version`
is codec version; `data.schema_version` is payload version; neither is a saved
content version. Literal numeric1 is required without string coercion.

Use the shipped strict `npcDataSchema` as validation only; keep accepted raw
data and string values, including whitespace around nonblank text. Preserve
optional absence versus included `{}`/`[]`, ordered arrays and duplicate ideas.
Do not fill defaults, trim, normalize Unicode, reorder, merge/deduplicate or
infer relationships. Existing finite text/list limits and the64KiB serialized
payload budget apply. Name follows `npcNameSchema` (1..120/nonblank). Null is
not absence where the schema rejects it. `effects` is mandatory actual empty
array: missing/null/wrong type/nonempty (including valid narrative/mechanical/
proficiency/choice effects) is rejected, never repaired or dropped.

### Codec bounds and offsets, frozen for challenge

- Raw file length1..131072bytes, checked before decode. Filename is sanitized
  basename1..255 without separators/control characters, `.json` extension;
  it is audit/display text, never a path or content identity. Actual arrayBuffer
  length must match declared size. Content hash is SHA-256 of the exact bytes.
- Fatal UTF-8 decoding. Reject a leading UTF-8 BOM explicitly; do not silently
  discard it. No comments, trailing commas, non-JSON primitives, nonfinite
  numeric result or trailing non-whitespace. No eval/Function/VM/module/import/
  script execution or external reads. Ordinary JSON strings/escapes remain
  data; literal invalid UTF-8 fails. Decode and validate EVERY object key and
  string value before candidate admission or profile rendering: reject decoded
  U+0000 and any lone high/low UTF-16 surrogate or incorrect surrogate pair,
  including JSON escape sequences. Preserve valid pairs and all other accepted
  plaintext unchanged; do not normalize, replace, truncate or repair strings.
  This codec boundary matches PostgreSQL17 JSONB's restrictions reported by
  root from [the official JSON documentation](https://www.postgresql.org/docs/17/datatype-json.html).
  It does not upgrade the shared NPC schema, migrate legacy values or claim
  existing authoring/hosted acceptance of these additional import constraints.
- Use a bounded JSON lexer/parser, or bounded duplicate-key scanner followed
  by JSON.parse, before accepting an object. Depth≤8 (root depth1), total
  value nodes≤2048, total object member occurrences≤512. Each array entry is
  a node; every repeated key occurrence consumes budget before rejection.
  Detect duplicate decoded keys per object, including escaped aliases, and
  reject `__proto__`, `prototype`, `constructor` anywhere before construction.
  Never let JSON.parse's last-key-wins behavior establish accepted content.
- Return bounded diagnostics (≤100paths, ≤3messages/path, ≤200chars/message)
  and one-based line/column plus zero-based original UTF-8 byte offset for the
  offending token/value. NUL/surrogate failures identify the original token and
  offending escape's original UTF-8 byte offset (or literal scalar byte offset),
  including after multibyte text and within object keys. Do not label decoded
  UTF-16 indices as byte offsets or lose offsets by reserializing the decoded
  value. Preserve path/token offsets for schema failures; no entire source excerpts/logging.
  Budget or syntax failure returns no partial accepted candidate.
- Normalized JSON/schema semantics are separate from the original-byte hash:
  indentation/escape differences change the audit hash, not story meaning.

## Provisional first child: local pure codec and read-only profile prototype

After independent challenge and explicit scoped local implementation release,
use JSON as the root's working prototype assumption while human format choice
remains pending. Own only new `lib/import/npc-json/{types,codec,review}.ts`,
read-only `components/library/npc-json-import-preview.tsx` wrapping the actual
shipped `NpcProfile`, and original unit/component/offline fixtures and their
bounded explicit config/runner. Read locked installed Next guides before React
edits. No shared schema upgrade, importer refactor or MPMB dispatch change.

The local fixture may select synthetic bytes/native files → bounded codec →
read-only actual profile with filename/hash/format and absence/empty disclosure.
The component takes validated review data, offers no authoring/relationship
action and cannot create a durable import or NPC. No authenticated app route,
upload action, app upload chooser/link, stage/commit action/control, import job
or success notice belongs to this first touchset. Browser preview is not write
authority. An offline rejected-file scenario keeps any old preview explicitly
labeled with its prior filename/hash; it cannot masquerade as the new valid
file. Replacing bytes invalidates local review; do not mutate/repair the file.
Keyboard labels, invalid-file focus and mobile profile reachability are tested
only within the offline fixture. This is not a shipped app upload workflow.

Pure tests: exact fixture/optional presence/ordered duplicates/plain markup;
all envelope authority fields; missing/null/nonempty valid-effect negatives;
unknown nested keys; duplicate/escaped/dangerous keys; multibyte offsets, BOM,
bad UTF-8, grammar, each hard bound, finite numbers, no partial result and no
side effects. Add decoded NUL/lone high/lone low/reversed or incorrect pair
negatives in EVERY key/string-value position (including escaped keys), offsets
after multibyte tokens, and positive valid literal/escaped surrogate-pair and
plain-text controls with exact preservation. Failures must produce no candidate
or profile. Actual-profile rendering remains escaped. Offline browser tests use
only the fixture's native file selection and actual codec/profile, complete
production CSS/fonts, blocked remotes and guarded private processes. Fixture
navigation/read behavior is labeled; no real app Auth/actions/persistence path,
DB/RLS/staging/commit or hosted support is exercised.

## Later separate child: durable review, audit and immutable commit

Authenticated app route `app/(app)/homebrew/import/npc-json/page.tsx`, native app
upload/review UI and explicit import chooser link are later touchsets, dependent
on the actual human format decision, reviewed app contract and applicable G2
authority gates; the local assumption cannot release them. Before implementing/
enabling staging or commit, freeze exact staged SQL TEXT and
fingerprint, generated types, read/write DTOs and feature gate in another
independently challenged plan. The proposed format discriminator is
`inkborne_npc_json_v1`; proposed persisted registry discriminator is also
`inkborne_npc_json_v1` (an explicitly named JSON audit item kind, not an MPMB
registry); fixed single source key `entry:0`, ordinal0, content_type npc. Existing
format/registry/type CHECKs must be explicitly extended and cross-bound in new
format-specific staging/admission/commit paths; existing MPMB spell/feat tuples
must not gain new combinations. Do not hand-edit existing migration history or
feed JSON into stage_mpmb_import. Default off; the pure review still works.

Reuse the existing content_imports/items/origins architecture where the frozen
DDL/RPC can safely express it. Preserve source hash, safe filename, format and
parser/mapper versions, original byte offsets, bounded diagnostics, attestation,
revision, item identity and exact written version in external provenance. No
source text, external book metadata, license claim or source_refs is injected
into strict NPC data. Rights attestation supports private use only; provenance
must prevent campaign sharing without the separately authorized license flow.
It must survive later metadata edits without falsely asserting edited text is
byte-identical to the original upload; expose imported origin plus current pin.

Server reparses original bytes and derives actor, exactly one published
dnd-5e-2014 UUID, NPC type/homebrew/personal/active envelope and stable generated
ID/slug before insert. Browser candidates/hash/flags are not trusted admission.
The exact SQL/read/write boundary must prove schema/empty-effects validation and
protect staged candidates/preview proof from direct client mutation; an owner-
supplied valid-looking stage shape is not a trusted server validation receipt.
Missing/partial/error reads remain unavailable. New stage/commit requires current
system and ownership/use authority, not historical snapshot readability.

Preview means canonical current/snapshot parser acceptance and actual narrative
profile parity with explicit zero mechanics, not a simulated character-level
calculation. Server confirmation binds exact staged revision/content hash and
validated candidate. Every candidate/selection/conflict edit invalidates it.
Do not auto-normalize effectful rows or call an unchanged calculation preview
proof valid for a different file/revision. Current valid spell/feat preview stays
unchanged. No NPC-to-character attachment/choice/ref insertion is offered.

Conflicts are explicit Keep both (fresh private definition) or Replace an
explicitly selected currently owned/private/active NPC of same system, expected
version1..2147483647. Changed MAX refuses. Shared/foreign/retired/effectful/
malformed targets are unavailable; no forced rescope. Replace overlays only
confirmed supported groups, preserves raw unchanged values or refuses unsupported
originals, omits effects, never alters previous versions. Genuine no-op records
no content write and requires a separately frozen audit disposition. CAS failure
has no blind retry; reread only scoped target, strictly newer eligible yields
conflict, same/older or inconclusive returns uncertainty. Keep-both/replace choice
and target expected-version must be part of the confirmed revision.

Atomic commit locks owner review/current revision, revalidates canonical candidate,
authority and conflict tuple, inserts/updates once and records immutable origin
and exact written pin together. Completion/retry checks use the same owner job
identity, never reconstruct a new job from filename/name. Missing/malformed/lost
response is uncertain: retain draft/job, lock resubmission, show manual Check
Homebrew/review and reconcile read-only status/exact committed pins. No automatic
recommit or new stage/create. An explicit acknowledgment for a separate attempt
must warn it can duplicate; it does not prove exactly-once. Claimed idempotency
requires actual transaction/role acceptance. Confirm exact returned ID/version
and raw immutable owner/system/type/source/scope/data/effects[], never latest;
v+2 or later scope changes do not imply saved v+1 remains current/private.

Successful exit retains confirmed pin before navigation to Library NPC detail or
plain Homebrew. Navigation failure cannot reinsert. UI labels saved version and
possible later edits; no unconditional query-string success. Existing narrative
refs have zero effects, but this workflow offers no character association or
claim NPCs are selectable character-building content.

## Acceptance and dependencies

Local prototype codec/profile acceptance is the first useful source child; it
does not approve the format or close app upload/durable import. The actual
format decision remains pending irrespective of elapsed time. Later default-off
app/persistence work requires its own review and exact SQL TEXT review plus
authorized G2 actual-role/transaction proof: anon/foreign denial, owner isolation,
published-system zero/duplicate/error rejection, direct stage/preview tamper,
effectful/missing NPC effects, mixed format/type tuples, stale revision/CAS,
concurrent commit/upload/replace, current eligibility changes, rollback between
definition/version/origin/completion, lost responses/reconciliation, nonduplicating
completed retries, exact immutable pins, private-only sharing fence and run-owned
cleanup. Static SQL tests and mocked PostgREST cannot satisfy this gate.

Only after those gates may the persistence switch be enabled through a separately
authorized release. No live SQL/provider action is authorized by this plan.
Rights-safe native-upload/offline actual review/commit UI models and authenticated
hosted workflow acceptance remain distinct. Monster import needs its own explicit
input/mapping contract; no CreaturesList assertion is inherited from this proposal.
