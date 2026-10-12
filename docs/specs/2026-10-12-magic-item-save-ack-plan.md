# R12 magic-item save acknowledgment hardening — plan for challenge

2026-10-12, clean isolated r12-magic-ack-worker, branch
codex/r12-magic-save-ack, base81629ce050f9818827dc88008d6362cd6479435f.
Docs only. No implementation/SQL/runtime/dependency action is authorized by this
plan. Root owns integration/heavy/UI; other workers and JSON freezes untouched.
Ordinary-item DAL/forms are active R13 work and explicitly outside this child.

## Observed problem and bounded touchset

Four production files only, with their existing focused suites and later separate
explicit offline actual-form harness/handoff. No shared validation framework,
schema upgrade, routes/Homebrew notice refactor, evaluator/inventory/pin rewrite,
sharing/copy/import/provider/SQL/receipt or exactly-once implementation.

| Path | Actual behavior at81629ce; proposed repair |
| --- | --- |
| `lib/supabase/homebrew-magic-items-server.ts` | CREATE omits explicit ID, generates slug inside payload, trusts parseRecord's generic valid row; UPDATE has no original raw read/no-op/MAX check and writes reconstructed data. parseRecord strips unknown data; effects have array shape only; missing-CAS reread treats any returned id/version as conflict. Add bounded raw admission/merge, frozen identity, exact returned-body and immutable-pin confirmation, and phase-aware uncertainty. |
| `app/(app)/homebrew/magic-items/actions.ts` | Any result lacking status, including `{id}` only, is treated as success and redirected using generic created/updated query flags. Return strict finite acknowledgment states and invalidate caches only for confirmed changed saves; avoid server success redirect before the mounted form retains the saved result. |
| `components/library/magic-item-form.tsx` | Native reset prevention/controlled fields already exist; pending disables submit only, fieldset stays editable; hidden identity reads live props and can rebase old draft. Add native busy/pending mutex, strict response acceptance, mount-bound identity, uncertainty/no-repeat/manual-check and navigation-failure recovery. |
| `lib/homebrew/magic-item-form.ts` | Existing five finite controls/trimmed mapper ignore envelope/effects, but use first FormData value/String coercion. Preserve current normal controls/taxonomies/trim rules; add duplicate/File refusal, strict pg edit identity and finite feedback/saved/unchanged response schema without a new shared abstraction. |

`magicItemDataSchema` has rarity Common/description empty/attunement false defaults
and strips unknown fields; it is not extended from mechanicalSchema. Never
serialize its stripped/defaulted edit result. NPC DAL supplies the strongest
exact immutable confirmation pattern; trait DAL supplies raw extension/effect
validation and semantic untouched-control preservation. Trait patterns alone
do not supply the required no-op/MAX/snapshot/strict-newer contract. Read locked
installed Next guides before future actions/TSX edits; apply Supabase/React
guidance within released local scope, no hosted verification inferred.

## Server and raw data invariants

Authenticate via getUser (error or missing/malformed actor refuses before write).
Resolve exactly one UUID system with slug dnd-5e-2014 AND status published using
single; zero/duplicate/error/malformed refuses, never a fallback ID. Every edit
read, UPDATE and reread retains ID+owner+system+magic_item+homebrew+personal+
is_retired=false predicates; list/get retain equivalent scope. Returned rows
must independently match those values, not merely be schema-valid.

Create validates only the current named controls, freezes server UUID AND slug
before INSERT and explicitly inserts that ID. Owner/system/type/source/scope/
active/version/effects are derived, never accepted from hidden browser fields.
Creation emits effects[] and existing canonical trimmed controlled data. Confirm
returned intended ID/slug/owner/system/type/homebrew/personal/active/version1/
name/raw data/effects exactly. Nonmatching otherwise-valid rows are uncertainty.

Edit identity is UUID plus decimal expected_version1..2147483647; reject Files,
duplicate fields, scientific/hex/nonfinite/overflow/coercion. Read the eligible
expected-version ORIGINAL raw row before calculating a patch. Validate original
known data and canonical effects with effectSchema as validation only; retain
all raw data/effect extensions, order/conditions/formulas. Malformed original
data or null/unknown-type/malformed effects refuses before mutation, never
repairs/drops effects. Raw extras are internal, not editable JSON controls.

Overlay only semantically changed authored keys: rarity, description,
equipment_category, requires_attunement, and changed name. Compare the submitted
mapper-normalized control to the original control projection using the same
existing trim/default semantics. If equivalent, retain the original raw value
and presence (including absent rarity/attunement/category defaults and original
whitespace). If different, write the validated value; explicit category blank
deletes that authored key. Preserve every other original raw key/nested value,
including source/custom metadata, rather than inferring its meaning. No browser
change flag or raw payload can replace extensions. Valid existing controls that
exceed authoring limits remain a visible validation/unavailable-edit condition,
not silently truncated; no new authoring fields or guessed vocabulary.

Compare resulting name+raw data with original. Genuine no-op performs ZERO
UPDATE, returns unchanged ID/version read, and says only this invocation did not
write. At pg MAX, unchanged may return no-op; any changed draft refuses before
UPDATE. Changed CAS writes only name/data, omits effects/envelope/slug/created_at,
requires expected+1 and same original stable identity/created_at, and confirms
exact intended raw merged data plus unchanged raw effects. Exactly one attempted
write; no retry/repair/rebase. Current and historical character pins untouched.

Before saved, fetch content_versions by exact returned ID/version with expected
snapshot owner/system/magic_item/homebrew/personal predicates and single. Admit
canonical current AND immutable parsers; additionally compare RAW snapshot data/
effects and all identity/name/slug fields to the intended returned row. Missing/
duplicate/error/malformed/wrong immutable snapshot is uncertainty, not success.
Never read latest as confirmation. A concurrent v+2/scope change cannot imply
saved v+1 is still latest/private; saved wording describes that exact pin only.

Separate known pre-write refusal from any post-issued-write uncertainty. A
transport/throw/error/missing/malformed return after INSERT/UPDATE never becomes
editable “try again” or an automatic retry. For zero-row CAS, reread only the
full eligible scoped raw row: strictly newer validated version is conflict;
same/older, error, missing/foreign/retired/malformed or inconclusive is uncertainty
after an issued write. Pre-write absent/ineligible row may be generic unavailable
without leaking another owner's state; same/older/inconclusive must not pretend
strict-newer conflict. Version checks are evidence, not provider transaction proof.

## Action and actual form acknowledgment

Pure strict bounded states: initial idle only; error/field feedback; conflict;
uncertain; saved{operation:create|edit,id,version}; unchanged{id,version}. Total
feedback≤100paths,≤3messages/path,≤200chars/message, bounded overall message.
An action-returned idle, wrong operation/id/version, unexpected extra shape,
undefined/malformed/error throw is uncertainty. Create saved requires UUID and
version1; edit saved requires mounted ID and mounted expected+1; unchanged only
the mounted ID/read version. Client shape checks do not mint write authority.

Actions retain authentication and real Next control-flow propagation. Return
confirmed result; revalidate Homebrew/Library/edit cache only after a confirmed
changed save, not error/conflict/uncertain/unchanged. Invalidation or navigation
failure after confirmation must not erase the saved pin or permit reinsert.
Catch ordinary cache-invalidation failures and still return the confirmed saved
ID/version (optional bounded refresh notice); propagate actual Next control-flow
exceptions with the framework helper rather than guessing exception messages.
Plain /homebrew client navigation avoids an unconditional generic query-string
success banner; shared Homebrew component is not owned or modified here.

Form captures mode/initial ID/version/initial control projection on mount. Hidden
identity always comes from that mounted snapshot. A different ID/version/mode
prop on rerender blocks saving and requests explicit reload/discard; never
silently rebase old fields, even if new props are otherwise valid. No automatic
reset, repin or optimistic confirmed version. Preserve existing controlled
fields/native reset preventer. Native fieldset disabled+aria-busy while pending,
and synchronous submit guard before queuing, make one in-flight action; buttons
and descendants obey native disabled semantics. Validation focuses actual field
or bounded summary and retains draft.

Retain confirmed saved ID/version BEFORE router.push('/homebrew'); ordinary
navigation failure shows the retained saved status and never calls DAL again.
Saved blocks repeat submission. Genuine unchanged can permit another edit at
the same mounted version; any concurrent change will encounter the normal CAS
guard. Conflict/uncertain edit blocks until explicit native reload (unsaved-draft
discard disclosed). Uncertain create retains draft, blocks retry, offers manual
Check Homebrew and explicit “I checked; allow another create” acknowledgment with
duplicate/lost-draft warning. Link navigation alone does not acknowledge, no auto
retry, no generated-ID/idempotency claim; acknowledgement is client readiness
only. Saved status says exact version, possible later changes, not latest/private.

## Meaningful acceptance before and after

Existing suites: `tests/supabase/homebrew-magic-items-server.test.ts`,
`tests/app/homebrew-magic-item-actions.test.ts`,
`tests/lib/homebrew/magic-item-form.test.ts`,
`tests/components/library/magic-item-form.test.tsx`.
Add otherwise-valid bad return/envelope/name/data/effects/version and missing/
wrong immutable pin controls against ACTUAL existing exports. Preserve original
mapper trim/absent checkbox/category/forged authority, owner filters, effect-omit
UPDATE and native React-settlement reset positives. Upgrade placeholder positive
fixtures to real synthetic UUID/schema envelopes where required; preserve their
behavioral assertions rather than counting missing new fields as reproduction.

Baseline must use old actual DAL/actions/form, no imports of new absent runtime
helpers or collection failures. Queue model PostgREST replies matching old and
new query interfaces; allow generated-ID echo when supplied, valid default DB-ID
for old create. Bad rows must otherwise parse under old schema so acknowledgment/
redirect/repeated action/raw metadata loss occurs before denial assertions. Test
actual action's malformed/minimal row wrongly redirecting; actual form's otherwise
valid idle response allowing retry; native pending fieldset/second queued action;
foreign ID/version rerender old draft identity rebasing. Include native reset
positive, raw nested extension/effects preservation, no-op/MAX zero write, expected
version CAS/strict newer vs same/older/ineligible, exact snapshot negatives,
mounted result correlation, saved navigation failure/no reinsertion and original
pins unchanged. Also inject ordinary cache-revalidation failure after a verified
DAL save and prove confirmed result retained/no second write. Preserve all
before/failure/restoration receipts with exact SHAs.

After independent source review and explicit resource release: narrow npm test
with maxWorkers2, repository typecheck/lint; root owns combined check/build. Later
separate reviewed offline actual-form desktop/mobile config uses real production
CSS/fonts/source/dependency guards and private OS-birth process cleanup; actions/
Auth/navigation/SQL/persistence simulated and disclosed. Native draft/pending/
invalid focus/uncertain manual ack/conflict reload/saved nav failure/mount identity
and reachable controls are exercised. These do not prove RLS, snapshot trigger,
real races, receipts or exactly-once behavior. Real-role/version/rollback acceptance
remains G2; no SQL/new schema/live provider work in this child. Plan and implementation
do not close all R12 or alter ordinary-item R13 work.
