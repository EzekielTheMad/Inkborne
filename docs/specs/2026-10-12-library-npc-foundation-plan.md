# R17 library NPC foundation — plan for independent challenge

2026-10-12. Documentation only; inspected clean worker/root-base
`df8c303dbb92275c1649311e165d492e31c43df1`, branch
`codex/r17-library-npc-plan-20261012`. This does not authorize implementation,
SQL execution, schema application or a release. All included M1–M8 requirements
remain required before beta; public publishing is deferred. R17 is distinct from
the shipped character relationship feature and R16 monster work.

## Observed source boundaries

| Source at inspected base | Consequence |
| --- | --- |
| `docs/ROADMAP.md`, M5; `docs/LAUNCH-ACCEPTANCE.md`, R17 | Library NPCs carry personality/relationship metadata, join entitled encyclopedia discovery/import, and need separate DM campaign use. Existing relationship cards do not satisfy this requirement. |
| `supabase/migrations/00009_narrative_tools.sql`; `00055_character_timeline_relationships.sql`; `lib/supabase/database.types.ts`, `npcs`; `lib/types/narrative.ts` | Existing `npcs` rows require a character and creator. Name, TipTap description, relationship, visibility, portrait and arbitrary metadata are character narrative state; there is no content/version pin, campaign instance identity or revision/CAS column. |
| `00055…`, `private.can_view_character_story_entry`; `app/(app)/characters/[id]/story-actions.ts`, `page.tsx`; `components/narrative/relationships-section.tsx` | Character owner writes; owner and current campaign DM read every entry, other current campaign members read only `campaign`. Unassigned entries are owner-only. Stored legacy `private` remains in SQL/types; page projects non-`campaign` to `dm_only`. Current actions allow `dm_only`/`campaign`, normalize invalid rich documents to empty and do not implement revision CAS. Do not inherit that normalization or claim CAS for new NPC writes. |
| `supabase/migrations/20260722221534_atomic_background_selection.sql`, current captured `copy_character` | Copy inserts actor-created source NPC rows into destination with a new ID/character/creator, retained name/description/relationship/portrait/metadata and `dm_only` visibility. No new template/instance operation may change that behavior or broaden which source rows are copied. |
| `lib/schemas/content.ts`; `lib/schemas/content-types/index.ts`; `lib/supabase/content-definitions-parser.ts`; `lib/supabase/content-refs.ts`; `app/(app)/characters/[id]/page.tsx:262`; `00003_content.sql`; `20260720171627_content_version_pinning_and_rls.sql` | Canonical definitions support generic text types, but no `npc` payload is registered. Current and exact immutable snapshot parsers reject unknown types. If registered without an NPC-specific envelope constraint, generic valid effects pass: actual character page flatMaps all parsed ref effects before evaluate. Owner/system/content-use ref guards do not prohibit NPC type. A renderer-only promise cannot prevent mechanics leaking through refs. Generic authoring triggers manage initial version 1, changed name/data/effects/scope versions and self-contained snapshots; identity is immutable. |
| `20260720173545_content_version_policy_performance.sql` | Catalog SELECT admits platform, actor-owned or actively campaign-shared entries. Snapshot access additionally admits actual existing character refs/inventory/spells. `can_use_content_version` is character-owner/system-bound. Neither a readable historical version nor this character-specific helper authorizes creating a campaign NPC. |
| `lib/compendium/catalog.ts`, `presentation.ts`; `lib/supabase/compendium-server.ts`; `app/(app)/library/[id]/page.tsx`; `components/compendium/*` | Current category list lacks NPCs; authenticated Library uses published systems, active current definitions, 24-row pages, source/provenance/search filters and canonical parser. Detail is UUID-based and read-only. RLS, not a browser provenance filter, is the access boundary. |
| `lib/supabase/homebrew-monsters-server.ts`; Homebrew page/form/action contracts | Existing private authoring pattern authenticates before writes, resolves exactly one published `dnd-5e-2014`, scopes owner/system/type/homebrew/personal/active, uses expected-version CAS, confirms returned data/version and preserves draft on uncertain saves. Reuse this pattern without a generic DAL rewrite. |
| `20260722044333_background_authoring_sharing.sql`; `lib/supabase/campaign-shared-content-server.ts` | Supported share/revoke/list RPC and read DTO explicitly allow only spell/feat/background. Generic `content_shares` does not mean NPC sharing is implemented or approved. |
| `lib/import/mpmb/types.ts`, `map/index.ts` | Import parses SourceList/SpellsList/FeatsList and maps spell/feat only. No NPC registry, mapping or commit contract exists. Do not guess a registry or execute uploaded JavaScript. |
| `app/api/campaigns/[id]/mentions/route.ts`; `lib/types/narrative.ts` | Mention type includes `npc`, but actual route accepts only page/character. No NPC relation resolution/backlink behavior is shipped. A typed label alone is not a working link. |

These are static source observations, not a refreshed database inventory or proof
of hosted policies. Historical comments saying the NPC table had zero rows are
not evidence that current users have no rows.

## Identity and privacy decisions

Use the existing content stack for a **reusable NPC template**: canonical
`content_type: 'npc'`, category `npcs`, normal definition/version envelope. Every
template field is visible to everyone currently entitled to that template.
Templates never carry campaign secrets, character IDs, private relationships,
HP/resource state or visibility rules hidden inside JSON.

Keep `public.npcs` as the existing character relationship store. Generalize NPC
capability additively through reusable templates and, later, separate campaign
instances; do not make `character_id` nullable, reinterpret old rows, or silently
backfill/move/publish them. This fulfills the roadmap's library expansion using
the shipped immutable catalog rather than weakening the character table's
authority. No new generic entity framework is needed.

A later **campaign NPC instance** is a DM-managed occurrence of an exact template
version, with its own name/description overrides, current state and revision.
Distinct occurrences may use the same template. Actual relationships to
characters/pages/other instances belong to that campaign occurrence, not the
catalog. A character's existing relationship row remains an independent
owner-authored relationship, even when it later explicitly refers to an NPC
instance. No inferred name/slug match, automatic effect application, or merger.

Campaign instances default to `dm_only`; explicit `campaign` publication exposes
only their designated shared narrative fields. DM secrets require a separately
protected store/read projection; never fetch secrets into a player payload and
hide them with CSS. Current campaign owner is DM authority, membership is read
eligibility, and former membership/DM authority is rechecked on every operation.
Template sharing grants template access, not instance secrets or DM write rights.

## First implementable child: R17.1 validated read-only Library

Add a finite narrative-template schema and actual Library category/detail,
with original synthetic fixtures. No persistence, migration, seed/catalog insert,
Homebrew form, campaign instance, importer, gameplay/evaluator or mention changes
in this first child. It provides real discovery/display for entitled canonical
NPC definitions when such rows exist; an empty category is an honest empty state.
Offline fixtures are not a claim of populated hosted content or full R17.

Proposed exact v1 payload (new declaration, not a guessed existing taxonomy):

| Field | Contract / display |
| --- | --- |
| `schema_version` | Required literal 1, independent of database content revision. Missing/unknown versions fail. |
| `description` | Optional plain text, 1–8,000 UTF-16 code units, at least one non-whitespace character. Preserve original text; no HTML execution or rich-document normalization. |
| `occupation` | Optional plain text, 1–120; narrative metadata, no mechanical grants. |
| `personality` | Optional strict object with optional `personality_traits`, `ideals`, `bonds`, `flaws`: ordered arrays of 0–8 nonblank texts, each 1–500. Optional `motivation`, `mannerisms`, `fear`: nonblank text, each 1–1,000. These reuse existing narrative concepts; no alignment/role enum invented. |
| `relationships` | Optional ordered array, 0–20 strict objects `{ name, relationship, description? }`; nonblank name/relationship each 1–120, description 1–1,000. Display explicitly as template relationship ideas. Text describes reusable story hooks, not resolved references to actual people; no IDs/slugs/lookup/automatic character relationship creation. |

Every object strict, no unknown keys, nulls, coercion or defaults. Optional absence
and explicit empty arrays remain distinguishable. A name-only template is usable;
never invent a personality, stat block, default score, portrait or relationship.
Aggregate parsed data budget 65,536 UTF-8 bytes via JSON serialization after
bounded shape validation. Other content types retain existing envelope/effect bounds; this
does not silently impose new bounds on every content type. Wrap inherited long
names in list/detail. New authoring later bounds names to 120.

Register `npc` in the normal type registry so current definitions and immutable
snapshots share payload validation. **Narrative NPC envelopes must explicitly
contain `effects: []`; immutable envelopes must explicitly contain
`effects_snapshot: []`.** Enforce this at the canonical envelope/type boundary in
`lib/supabase/content-definitions-parser.ts`, before a generic missing-effects
default could manufacture acceptance. Missing/null/wrong-shape/nonempty effects
are unavailable, including otherwise valid mechanical, narrative, proficiency
grant and choice effects. Never strip effects, discard grant entries, or coerce a
nonempty array into an accepted empty NPC. Preserve rejected raw data untouched;
no cleanup, rewrite, repair/backfill or historical repin is authorized.

Both `parseContentDefinition` and `parseContentVersionSnapshot` must enforce this
rule (including their nested readers); no separate lax catalog or ref path. An
unavailable NPC ref remains incomplete under the existing reader contract, not
an accepted empty ref/document. This bounded parser constraint closes the actual
flat effect collector path without an evaluator/provider/SQL rewrite or a global
NPC-type ref insertion rule. Empty-effect NPCs are narrative-only and contribute
no gameplay effects even if they are present in an authorized ref. Other content
types and their valid effects remain unchanged.

R17.2 authoring and every future NPC import/copy must require the same explicit
empty-effects contract on source/raw read, derived write and returned current/
immutable envelopes. Creation emits `effects: []`; metadata UPDATE omits effects
and retains an existing explicit empty array. Effectful/malformed raw rows lock
editing/import rather than being normalized or erased. Raw extensions in
otherwise supported fields remain subject to the later raw-preservation rules;
these do not relax the empty-effects boundary. A future stat block child should
use an optional exact version of an entitled `monster` definition and the shipped
monster display, with separately challenged system/entitlement/reference handling.
Do not duplicate its schema or add NPCs to character evaluator source collection
in this child.

Minimal production touchset:

- New `lib/schemas/content-types/npc.ts`, registry entry in `index.ts`; NPC-only explicit empty-effects enforcement in `lib/supabase/content-definitions-parser.ts` for current and immutable envelopes.
- `lib/compendium/catalog.ts`, `presentation.ts`; new
  `components/compendium/npc-profile.tsx` and bounded detail dispatch in
  `components/compendium/compendium-detail.tsx`.
- Existing Library browser/row only if its category/render exhaustiveness needs
  the new category. Existing UUID detail route/DAL remain the authority; do not
  add another catalog endpoint or fetch all NPCs outside pagination.
- New original `tests/fixtures/npcs.ts`, schema/parser/profile tests; extend
  existing catalog/presentation/compendium-server/browser/detail/Library-page
  tests. An offline config `e2e/local-npcs/playwright.config.ts` and isolated
  runner may follow reviewed source plus root production build/UI slot.

## Remaining required children and contracts

| Stage | Finite boundary before implementation/acceptance |
| --- | --- |
| R17.2 private authoring | New NPC mapper/form/server/actions/new/edit routes and minimal Homebrew family link/list. Own name, description, occupation and structured personality/relationship-idea controls only. Strict field/path/count/aggregate validation shared with schema. Auth-derived envelope; no browser owner/system/source/scope/slug/effects/version authority. Canonical published system `.single()` (zero/duplicate/error fail), owner/type/homebrew/personal/active filters in read AND update, integer expected_version 1..2,147,483,647, no overflow write. Read raw data/effects; require explicit empty NPC effects before admitting an edit, then validate without persisting stripped output, overlay only explicit authored changes, retain every untouched raw key and absence/empty value. Never update effects; reject effectful/malformed rows without mutation. Unsupported raw fields lock their controls or the edit rather than disappear. Changed write confirms same ID/envelope and expected+1 plus exact authored result; true no-op does not fake a new version. Stale one-write CAS yields scoped conflict/reload, not owner leak. Native reset, invalid-field focus, pending duplicate block, draft retention. Lost/malformed CREATE return is uncertain: retain draft, ask user to check owned Homebrew before an explicit new create; no automatic retry or false redirect. Generated IDs are not exactly-once protection. Confirmed save followed by navigation failure never reinserts. |
| R17.3 template sharing/import/copy | Extend exact allowed-type sharing/revoke/list DTO/RPC only after independent authority contract; do not directly insert shares as a shortcut. Capture template copy as a new private owned definition with immutable source ID/version and bounded verified attribution/license metadata, preserving supported narrative/personality/story hooks and valid raw content with explicit empty NPC effects, not foreign owner/visibility/share IDs/secrets/actual campaign links. Effectful/malformed NPC sources remain unavailable, never converted to empty-effects copies. Copy only original/authorized/licensed source material; import must have an explicitly supported observed format and rights-safe fixture (a strict v1 JSON upload is a reasonable first format; MPMB NPC mapping remains unsupported until an actual registry contract is evidenced). Shared static validator, preview/audit, finite repair/conflict choices, uncertainty/retry semantics and current entitlement at commit. No arbitrary uploaded code or copyrighted book-content copying. |
| R17.4 DM instance/relationships | Separate proposed `campaign_npcs` storage, optional separate protected DM notes and relationship-link store; exact DDL/RPC/FK/lifecycle contract needs another challenge and G2. Required campaign/system/template ID+version pin, current revision, archive flag and dm_only/campaign projection. Authenticated current DM creates/edits/archive/CAS under campaign authority; new selection requires active currently entitled definition AND matching immutable snapshot/type/system. Historical snapshot readability is insufficient authority for a new instance. Original exact pin stays on existing instances after author edits/retirement/share revocation; any controlled historical read requires instance/campaign authorization, not widened generic version RLS. Players receive only shared projection, no template/DM secret union. Explicit owner-created character relationship attachment must preserve legacy character-owner writes and current story visibility; do not let a DM mutate player-owned rows. |
| R17.5 lifecycle/copy/real acceptance | Freeze exact delete/retire/share-revoke/member-removal/campaign-transfer/account-deletion/source-copy policy and test it under real roles. Retire catalog sources rather than deleting pinned versions. Existing instances keep authorized historical display and label retired/unavailable source; new use fails. Exact pin FK/deletion guards must actually prevent dangling versions. Do not enable instance/template delete before that contract; archive instances initially. Cross-campaign copy requires actor current source+destination authority, destination system match and explicit selection, fresh private/dm_only destination, retained exact content provenance and permitted narrative only; no DM secrets/links/state transfer by default. Existing `copy_character` continues unchanged unless a later explicit attachment-copy contract extends it atomically and preserves every legacy behavior. |

Existing content definition/version FKs cascade on definition deletion; catalog
retirement alone does not prove pin survival. R17.4/5 must resolve this in reviewed
DDL/RPC before enabling pins/copy, without rewriting history. Likewise, existing
character-specific `can_use_content_version` cannot simply be called with a fake
character to authorize a DM instance. No new payment, public publishing,
companions/sidekicks, combat runtime or broad generic source resolver is implied.

## Acceptance, risks and dependencies

R17.1 meaningful tests must pass actual definition and immutable snapshot parsers
with original v1/v2 NPC fixtures: edit current v2 without changing parsed v1;
reject missing version, wrong/null/extra nested fields, oversized multibyte
payload, invalid effects and malformed envelope; preserve absent/empty/ordered
fields and explicit empty effects, and retain existing monster/effect behavior.

Negative controls must inject separately otherwise-valid stat modification
(`mechanical`, strength/add/2), proficiency grant (`grant`, athletics/proficient),
and choice grant (`choice`, choose 1 from [athletics, acrobatics],
grant_type proficiency, choice_id npc-skill) into an otherwise valid NPC. Prove canonical current parser and
immutable parser each reject every nonempty case without altering raw JSON.
Include narrative effects and missing/null effects as further refusals. Pass
the same exact snapshot through actual `parseContentRefWithContent` and
`getCharacterContentRefSnapshot`: it must not become an accepted NPC ref, and
completeness must be false. Exercise actual CharacterPage consumer with a
legitimate canonical character fixture and complete read projection plus that
recorded rejected NPC pin; assert unavailable/degraded admission and no stat,
proficiency or choice contribution reaches its existing collector/evaluate
path. A helper-only renderer test is insufficient. Positive empty-effects NPC
current/snapshot/ref controls retain narrative profile and unchanged baseline;
ordinary valid non-NPC effects still participate as before. No product engine
change or SQL execution is necessary for this parser/actual-consumer acceptance.

Exercise actual query category/type/system/active/provenance/pagination filters,
UUID detail, denied/error vs successful empty reads, and published system lists.
No mock test asserts a server role boundary it did not execute.

Offline desktop 1280/mobile 390: actual Library browser/list/detail, long name and
maximum bounded description/personality/hooks, empty/malformed/failed-read states,
keyboard access, reachable controls, no horizontal overflow and content labels.
Use current production CSS/fonts and successful exact-build/lock/transitive byte
receipts, deny remote requests/unexpected writes, cooperative owned-process
cleanup with freshly verified OS birth/PID/parent/command and closed ports.
Original synthetic fixtures and simulated auth/query/nav explicitly disclose
that entitlement/RLS/persistence are unverified. R17.2 adds real form uncertainty,
native reset, stale draft and exactly one pending action tests, not just rendering.

G2 (separate approved target/runtime/accounts/operation budget/cleanup) must prove
anonymous denial, owner vs other owner, DM/member/removed-member/outsider reads,
direct Data API mutation defenses including forged envelopes, sharing revocation,
exact snapshot/system/type handling, two-writer CAS, returned-version receipts,
uncertain-create recovery, instance private projection and source lifecycle/copy.
Test failed transactions leave no partial rows, duplicate instances, widened
visibility, or unresolved residue; cleanup exact recorded IDs only. Existing
legacy private/dm_only/campaign rows, character ownership reassignment,
copy_character field/visibility behavior and character deletion cascade need
positive and negative controls. Migration text and mocked/offline tests are not
PostgreSQL/RLS/concurrency/hosted UAT acceptance.

First child depends only on reviewed existing schema/catalog/parser stack and
root resource/build/UI slots. Subsequent writes depend on canonical published
system and immutable triggers; sharing/import on explicit type/format contracts;
campaign use on new pin/privacy/lifecycle contract and separately authorized DB
acceptance. No essential product question blocks the proposed read-only child:
reasonable choices above are visible for independent challenge, not launch
dispositions. Full R17 remains open until authoring, entitled discovery/import,
DM use and real authority/lifecycle acceptance are complete.

Supabase skill read; current official [RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
supports separate privilege and row-policy acceptance. Changelog read-only fetch
noted upcoming HTTP TLS cipher removal, unrelated to this source-only plan; no
SDK/config change. Installed Next `use-client.md` read from root node_modules;
implementation must read the relevant server/action guides before code. No
runtime, SQL, install, test, build, browser or long-lived process was started.
