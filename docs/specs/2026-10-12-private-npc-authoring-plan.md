# R17.2 private NPC authoring — finite plan for challenge

2026-10-12, documentation only. Owned worker `r17-library-npc-worker`, clean
`fa8aa7b65fcd86db4a705b1a64e52d1e40c3f159`; inspected current root
`c18cf445b4ce7df24aa3e973330979f036f55c1e` read-only. Root integrated the reviewed
R17.1 source; combined/build/browser acceptance is running separately. This plan
does not claim those results or authorize implementation/SQL execution itself.

Implement one useful child: ordinary private narrative NPC create/edit, discoverable
in Homebrew and the existing NPC Library. No template sharing/import/source-copy,
DM instances/secrets, monster/stat-block links, character relationship attachment,
effects, mechanics, public publishing or deletion/retirement in this child.
Existing `public.npcs`, story actions/privacy, character copy, immutable pins,
evaluator and R17.1 schema/parser remain unchanged. All remaining R17/M5 children
and included milestones remain required before beta.

## Actual contracts to follow

| Inspected source | Use / deliberate limit |
| --- | --- |
| `lib/schemas/content-types/npc.ts`; `lib/supabase/content-definitions-parser.ts` | Use the shipped strict v1 payload, 64 KiB budget and current/snapshot explicit empty-effect checks. These are already the shared validation boundary; do not add defaults or another NPC schema. |
| `lib/homebrew/monster-form.ts`; monster form/DAL/actions/routes | Reuse finite structured controls, 128 KiB pre-parse transport limit, declared editable groups, raw merge and constrained owner/system/type/private-active CAS pattern. Do not copy its 100-character name bound or ordinary-error uncertainty state: NPC requires 120 and an explicit uncertainty lock. |
| `lib/homebrew/passive-feature-form.ts`; `components/library/passive-feature-form.tsx`; `lib/supabase/homebrew-passive-features-server.ts`; feature actions | Follow strict feedback/saved/unchanged response validation, pending submit ref, draft/native-reset protection, explicit uncertain-create acknowledgment, saved identity retained before navigation, genuine no-op and MAX-version checks. Existing feature associations are irrelevant to NPCs. |
| Item/trait DAL and existing Homebrew family dispatch | Preserve raw values and omit effects on UPDATE; keep all authority filters and changed-write expected+1 confirmation. Add only one NPC family/list/error/link seam; no shared DAL/form refactor. |
| Installed root Next 16.3.8 `use-server.md`, `server-actions.md`; previously read Supabase/React skills | Actions are authenticated mutation endpoints; client sequential dispatch does not establish authority, idempotency or concurrency safety. Use normal React/Next patterns and repository scripts later. No provider/credentials/DB calls made for this plan. |

## Fields, presence and actual controls

Name is required: 1–120 UTF-16 code units with at least one non-whitespace
character. Preserve original text; never trim/truncate. Payload is exactly the
existing `NpcData`; required `schema_version: 1` is derived, not a visible input.
All ordinary fields are plain text, rendered as text, not executable HTML, rich
documents or expressions. No JSON editor, relation-ID/slug input, portrait upload,
secret visibility, numeric statistic, effect or extra-field control.

| Player-facing control | Exact shipped payload limit / editing behavior |
| --- | --- |
| Name | Text input, 120 maximum, required nonblank. An existing inherited name beyond this authoring bound is unavailable for this editor; Library read remains intact. Never normalize it to fit. |
| Description | Optional textarea, maximum 8,000. Exact empty string means remove the key; whitespace-only nonempty input is invalid. Text with leading/trailing spaces remains unchanged. |
| Occupation | Optional input, maximum 120; same blank/removal rules. |
| Include personality | Presence checkbox: unchecked means absent `personality`; checked with no child fields means explicit `{}`. Initial state uses raw property presence. |
| Personality traits / Ideals / Bonds / Flaws | Each list has an explicit include checkbox. Unchecked means absent child key; checked with no rows means `[]`. Add/remove and Move up/down buttons, 0–8 rows, each nonblank 1–500. Adding first row includes the list; removing last row leaves `[]` until the user explicitly excludes it. |
| Motivation / Mannerisms / Fear | Optional textareas within included personality, each maximum 1,000, exact-empty removal/nonblank rules. Removing a child does not remove the checked personality object. |
| Include relationship ideas | Presence checkbox: unchecked means absent `relationships`; checked with no rows means `[]`. Add/remove/Move up/down buttons, 0–20 ordered rows. Each has required Name and Relationship, each 1–120 nonblank; optional Description 1–1,000 with exact-empty removal. Label these reusable story hooks, not linked people/character relationships. |

Preserve list order and duplicate text, including duplicate idea names; never
deduplicate, sort, guess identities or apply entries to a character. Local stable
row keys are UI state only and are never persisted in strict NPC JSON. Disabling
a populated optional group preserves its page-local draft for re-enabling but
visibly declares that group omitted on save; never send hidden disabled values
as accepted payload. Bound rows before allocation/iteration; no arbitrary
user-number allocation. Name-only creation is valid and writes
`data: { schema_version: 1 }`, not default description/personality/arrays.

Presence is reconstructed from `Object.hasOwn`, not truthiness or default-filled
parser output. Description-only edit of absent vs `{}` vs child `[]` vs
relationships `[]` must leave those raw shapes unchanged. Native reset after an
action cannot erase the controlled draft; explicit reload/discard is disclosed.
Keyboard access includes row add/remove/reorder and optional group controls, with
stable field labels/error IDs and focus on the first actual invalid control (or
focused form error summary if the server path has no mounted control).

## Transport, merge and authority

New NPC-local mapper uses the existing monster transport pattern: exactly one
text value each for `name` and internally generated `npc_data`; edit additionally
requires exactly one `id`, decimal `expected_version`, and `changed_fields`.
No user-facing JSON input. Count combined UTF-8 control bytes before JSON parsing:
inclusive 131,072 limit; then use `npcDataSchema` for its inclusive 65,536 parsed
data budget. Reject duplicate transport keys, File values, malformed JSON,
unknown payload keys/null/version/type/bounds violations. Limit reported errors
to 100 known/control paths, each at most three 200-character messages; summary
message maximum 1,000. React action metadata and forged separate authority fields
are unused. An `effects` key inside NPC JSON is a schema error, not ignored.

Editable group names are exactly `description`, `occupation`, `personality`,
`relationships`; `name` is independently authored envelope text. Edit annotation
`changed_fields` is a unique array of those names, maximum four. It is editing
intent, never authorization/provenance. Validate raw original data and draft
before merge; require every unmarked group to be structurally equal including
presence, list order and duplicates. Overlay/delete only marked groups on the
raw original object and validate the result. Do not persist serialized stripped
parser output. Unknown extensions in strict NPC v1 data or nested objects,
unsupported schema versions, nulls, malformed shape or effectful rows make the
whole edit unavailable; retain original bytes unchanged and disclose no write.
This explicitly locked policy is chosen instead of inventing extension semantics.
No automatic repair/backfill or payload upgrade. Uncontrolled envelope columns
remain untouched by narrow UPDATE.

DAL authenticates `getUser` successfully before any mutation. Resolve exactly one
published `dnd-5e-2014` system via `.single()` and validate its UUID; zero/duplicate/
error/malformed result fails, no guessed/default system. Derive `system_id`,
`content_type: 'npc'`, generated immutable slug, `source: 'homebrew'`,
`scope: 'personal'`, `owner_id` from server context; CREATE explicitly writes
`effects: []`, with database-managed version. Envelope admission must additionally
validate UUID/owner/system/type/source/scope/active/version and canonical NPC data.
Both current effects and snapshot effects must be explicitly empty before
generic defaults. Never strip/drop nonempty effects or accept missing effects as
empty; malformed originals cannot be repaired through this form.

Edit identity is UUID plus integer version 1..2,147,483,647; strings must be strict
positive decimal, no signs/hex/exponent/fraction/unsafe values. Expected-version
read and UPDATE both filter ID + authenticated owner + resolved system + npc +
homebrew + personal + `is_retired=false` + exact version. Validate original row
before any write; UPDATE payload contains only name/data and omits effects,
authority fields and version. Genuine unchanged name/raw data returns unchanged
without write/version increment/revalidation/navigation. A changed row at version
MAX refuses before write. CAS miss performs only the same scoped owner/system/
type/source/scope/active reread: existing eligible newer row gives conflict;
missing/foreign/wrong-type/retired gives generic unavailable, read failure stays
read failure. Never broaden an ID-only reread or retry the mutation automatically.

## Confirmation and draft recovery

After a mutation, confirm the returned row through canonical current parsing and
strict private envelope: exact new ID (CREATE's server-generated ID), unchanged
slug/created identity (EDIT), derived system/owner/type/source/scope, submitted
name and merged raw data, explicit empty effects and version 1 or expected+1.
Also read the exact resulting immutable snapshot using content ID/version and
the same owner/system/type/source/personal snapshot envelope predicates,
`.single()`. Canonical snapshot parser and full tuple/name/raw data/empty effects
must match the confirmed current row. This is a bounded additional confirmation
read, not a latest-version replacement or generic historical-access exception.
Missing/duplicate/malformed/mismatched/error snapshot after a write is uncertain;
no retry/false saved response. Actual trigger/snapshot persistence remains G2.

Action state contract follows passive-feature semantics: `idle`, `error`,
`conflict`, `uncertain`, `saved`, `unchanged`, with strict bounded feedback and
saved `{ id, version, operation: 'create' | 'edit' }`. Client validates structure,
operation and ID/version correlation against edit baseline; malformed/missing/
lost/blank impossible response becomes uncertain, not confirmed success. This
client validation is not write authority. Server confirms canonical data/pin;
no effects/raw authority envelope is sent to the form.

Keep controlled draft and a synchronous submit ref while action pending; actual
fieldset and descendants are disabled/busy and double submit cannot queue a
second request. Validation/auth/read error retains editable draft. Conflict or
uncertain EDIT retains draft and blocks save until explicit Reload latest;
reload warning says it discards unsaved text and loads the current version.
No stale hidden expected-version update or auto-merge.

Uncertain CREATE locks create, retains draft, shows Check Homebrew and explicit
"I checked Homebrew; allow another create" acknowledgment; no automatic retry or
redirect. Generated IDs/slugs are not exactly-once protection. Explain another
create can make a separate NPC and navigation/reload can lose page-local draft.
Acknowledgment permits only the next deliberate client submission; it is not
server evidence/authority. Confirmed saved ID/version is retained before attempted
navigation, so navigation failure offers a manual Homebrew link and never repeats
INSERT. Genuine framework navigation errors use actual `unstable_rethrow`, not
invented digest classification. Revalidate Homebrew/Library/detail/edit only on
confirmed changed save, not no-op/conflict/uncertain.

## Exact production/test touchset

- New `lib/homebrew/npc-form.ts` (mapper, intent/raw merge, finite feedback and
  response correlation); new `components/library/npc-form.tsx` (actual controls).
- New `lib/supabase/homebrew-npcs-server.ts`: owned list/get/create/update and
  bounded exact snapshot confirmation, following existing DAL shape.
- New `app/(app)/homebrew/npcs/actions.ts`, `new/page.tsx`, `[id]/edit/page.tsx`;
  minimal NPC family import/promise/empty/error/create/card/edit/Library link in
  `app/(app)/homebrew/page.tsx`. Route auth and unsupported/unavailable/not-found
  follow existing private authoring routes. No edits to R17.1 public schema,
  parser, Library rendering or NPC story table.
- New mapper/response/DAL/action/route/component tests under the corresponding
  `tests/lib/homebrew`, `tests/supabase`, `tests/app`, `tests/components/library`;
  extend existing Homebrew page test and original NPC fixtures only as needed.
- New `e2e/local-npc-authoring/playwright.config.ts`/actual-form fixture and
  guarded helper/runner. Reuse reviewed asset/byte/process helper imports with
  independent executable-helper binding, rather than copying a large framework.
  No shared helper/refactor/dependency/SQL changes.

Owned list can follow current private-family dispatch; successful empty and
failed/unsupported read must remain distinct. Do not display an empty success or
created notice based solely on query parameters after a failed family load.
Ordinary list/card is discovery, not immutable-write confirmation. Preserve all
other families' promises/error/empty states and existing user data.

## Finite acceptance and remaining gates

Meaningful mapper/UI controls: name-only, Unicode/whitespace/120 name bound,
optional blank vs whitespace rejection, every array/group absence/empty shape,
ordered duplicate ideas, add/remove/reorder/last-row behavior, individual field/
count/aggregate/transport limits, bad JSON/File/duplicate transport keys and
forged authority/intent. Raw edit tests prove name/description-only no unintended
array/object additions, explicit clears distinct from unchanged absence, invalid
extensions/missing/null/nonempty effects refuse without mutation, UPDATE effects
omitted, and old snapshot remains unchanged.

DAL/actions: auth failure before writes; exactly-one canonical system; owner/
system/type/source/scope/active filters on read+CAS+reread; foreign denial;
changed expected+1 vs genuine unchanged; MAX no-op vs changed refusal; exactly
one stale write then scoped conflict; returned wrong tuple/name/data/effects/
version and missing/malformed/error exact snapshot become uncertain. Lost CREATE
transport return retains draft/lock/no auto retry/false confirmation; confirmed
save then failed navigation never reinserts. No client acknowledgment proves
server idempotency. Keep existing NPC parser/ref/actual CharacterPage narrative
fence and ordinary effects controls passing; no calculation scope expansion.

After independent source review and explicit resource/UI release: locked
dependencies, focused tests with two workers, sequential repository typecheck/
lint, root combined gates/build; actual desktop1280/mobile390 form workflows with
current production CSS/fonts/build/source/lock/all-transitive input hashes,
staged/index/raw helper guard, remote/unexpected-write denial, native reset,
keyboard/first-error focus, complete/reachable controls/no horizontal overflow,
pending duplicate, rejection/conflict/uncertain acknowledgment, exact saved
navigation and reload semantics. Simulated actions/auth/nav/persistence labeled;
screenshots/process OS birth/PID/parent/command/cwd/ports/resources and private
cooperative cleanup/closed ports required. No hosted-default E2E or fallback CSS.

Separate G2 approved runtime/target/accounts/operation budget/cleanup: real anon,
owner/other-owner/DM/member/outsider RLS, changed-version trigger + exact immutable
snapshot, concurrent CAS/retire/scope/system races, lost responses/no duplicate
automatic writes, direct Data API role/pin boundaries and unchanged story privacy/
copy/version references. Generic owner DML can still supply malformed JSON under
the existing SQL; do not claim database NPC Zod validation or new SQL prohibition.
App reads/edits/character consumers must continue to reject malformed/effectful
NPCs fail-closed. No live SQL/migration/credentials/hosted/provider/deployment
action is authorized by this document. No essential human product decision blocks
the proposed controls; independent plan challenge precedes ordinary source work.
