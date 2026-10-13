# R12 magic-item acknowledgment — UNRUN source freeze

2026-10-13. Sole writer in r12-magic-ack-worker, branch
codex/r12-magic-save-ack, base81629ce050f9818827dc88008d6362cd6479435f.
Approved plan7b9002aa6f56223c833381940bb1f62dc4bcb665. Implementation authorization
came from root after independent plan approval. This source remains UNTESTED:
no test/typecheck/lint/build/browser/server/network/SQL command was run.

Production+four focused suites:5d1cf29e3a1fca17a162db5e9ad8a651ede42b68.
Finite test-only observation reorder:916f5dd4b55d798c21ca7ac23011f12b05daa2d9.
Use916f5dd as the exact source/test checkpoint for independent review; all four
production blobs are identical to5d1cf29. This handoff is a later docs-only commit.
No other worker/root/JSON/ordinary-item R13 source was edited or cherry-picked.

## Bounded production change

Only the approved four paths changed:

- lib/supabase/homebrew-magic-items-server.ts
- app/(app)/homebrew/magic-items/actions.ts
- components/library/magic-item-form.tsx
- lib/homebrew/magic-item-form.ts

DAL authenticates first, resolves one published dnd-5e-2014 system with single,
and retains owner/system/type/homebrew/personal/active predicates. CREATE freezes
server UUID and slug before one INSERT, includes explicit ID, derives envelope
and effects[], then checks returned raw intended identity/data/effects plus
canonical current and exact owner/system/type/source/scope immutable snapshot.
Saved describes that exact pin only; no latest/current-private inference.

UPDATE reads the expected eligible original row. Known data and canonical effects
are validated without serializing stripped outputs; original raw data/effects
remain the internal merge/confirmation inputs. Only semantically changed authored
controls overlay. Untouched defaults/absence/whitespace and arbitrary nested raw
metadata survive; explicit blank category removes that key. Effects retain all
valid raw extensions/order/formulas/conditions, and UPDATE omits effects. Invalid
original effects/data or over-limit legacy authoring controls refuse before write.
Genuine no-op returns unchanged without UPDATE, including pg MAX; changed MAX
refuses. Changed CAS confirms expected+1/stable identity/created_at/exact raw merge
and unchanged effects. No retry, snapshot rewrite or character repin.

Known pre-write refusals remain editable errors. Any error/throw/missing/malformed
return after issued write is uncertain. Zero-row CAS rereads the full eligible
row: only a strictly newer validated version is conflict; same/older/error/missing/
foreign/retired/malformed is uncertainty after write. Read failures never imply
permission or newer version. No new SQL/receipt/transaction/idempotency protocol.

Mapper preserves existing finite controls/taxonomies/trim semantics while refusing
duplicate/File controls, unknown checkbox syntax and nondecimal/out-of-range edit
identity (pg1..2147483647). Strict finite response admission rejects idle, malformed
extra shapes, wrong operation/mounted id/version and oversized feedback. Returned
feedback uses at most100 paths,3 messages/path,200 chars/message,1000 total message
chars. Initial idle is allowed only as the local initial state, not a returned ack.

Actions authenticate again, preserve actual Next control flow via unstable_rethrow,
and revalidate only confirmed changed saves. Ordinary cache failure retains saved
id/version with bounded guidance; no success server redirect/query notice. Form
captures mounted identity/version/mode, never rebases hidden inputs or retained
draft onto changed props, and blocks until explicit reload on identity drift.
Native reset retention remains; fieldset disabled/aria-busy plus synchronous submit
mutex protects a single pending action. Named validation focuses an actual control
(or bounded summary). Saved is retained before plain /homebrew navigation and
blocks reinsert on ordinary push failure. Conflict/uncertain edits lock until
reload with draft-discard disclosure. Uncertain create requires manual Check
Homebrew followed by explicit acknowledgment before another create, with duplicate/
lost-draft warning; link alone does not acknowledge. Unchanged remains at the same
mounted version and may permit another edit. Shape/readiness checks are not authority.

## Prepared acceptance; NOT executed

Four existing suite paths were retained and expanded:

- tests/supabase/homebrew-magic-items-server.test.ts
- tests/app/homebrew-magic-item-actions.test.ts
- tests/components/library/magic-item-form.test.tsx
- tests/lib/homebrew/magic-item-form.test.ts

Original mapper trim/blank-category/absent-checkbox/hidden-authority controls and
actual React native-reset settlement positives remain. Positive auth/scoping/effect
omit controls use real synthetic UUID/envelopes. Model PostgREST response routing
supports actual old and repaired query shapes, freezes/echoes supplied server ID
and slug, and supplies a valid DB-generated ID for the old CREATE path. Wrong return
fixtures are otherwise valid under the old generic row parser; canonical mechanical
formula/conditional/narrative effects are validated before raw-preservation checks.

Future authorized failing-before must temporarily restore ONLY base816 actual
DAL/actions/form modules, leaving current mapper/tests/fixtures available. The
three suites contain `actual-old-export acknowledgment baseline` groups: wrong
otherwise-valid return/missing snapshot, actual status-less/idle action handling,
actual nonblank-idle retry, native pending and mounted identity drift. Dedicated
valid CREATE/field-refusal/reset positives construct against the old exports;
missing new exports/modules or fixture construction failures do not count. Also
run the raw metadata payload control:916f5dd observes actual UPDATE payload before
the saved-state assertion, so old metadata loss is substantive. Capture exact old
Git blobs/checkout hashes and failures; finally restore exact current raw bytes
and Git identities. Do not replace production logic with a mock boundary.

After source review and explicit heavy release, intended package-script gates:

`npm.cmd test -- tests/supabase/homebrew-magic-items-server.test.ts tests/app/homebrew-magic-item-actions.test.ts tests/components/library/magic-item-form.test.tsx tests/lib/homebrew/magic-item-form.test.ts --maxWorkers=2`

then `npm.cmd run typecheck`, then `npm.cmd run lint`, sequential with owned OS-birth
process/resource/listener receipts. These commands have NOT run. Root owns combined
check/build and later separately reviewed real-form desktop/mobile harness. No
browser config/process was created in this child. Action/Auth/navigation/DB model
controls do not prove hosted RLS, snapshot triggers, real concurrency or rollback;
those remain G2. Browser and full-shell/cache behavior are pending.

## Static inspection and hygiene

Read own installed Next16.3.8 use-server/use-client/server-actions/forms guides,
applicable AGENTS, and Supabase/React guidance before framework edits. Used installed
framework unstable_rethrow rather than guessing exception messages. No remote docs
or provider calls were made under source-only hold. React review covers controlled
fields, native disable/reset, event-only mutable guards and effect-only DOM focus.

`git diff --check` and staged diff checks passed; only normal autocrlf checkout
warnings occurred. package.json and package-lock.json are unchanged. Root's earlier
own-worktree locked install804/34s is separate from this unrun implementation.
No long-running task process was started, so there is no new PID to terminate.
2026-10-13T17:05:24.7457380Z readback: exact worker-command node/cmd/Chrome runtime
identities0, attributable TCP listeners0. All short file/git shells completed.
Root/other worktrees/ignored receipts were preserved. Source freeze is for independent
challenge, not product acceptance or completion of all R12/M1–M6/M8. Human-paused
importer/M7/PDF work was not resumed; JSON prototype remains frozen and unused.
