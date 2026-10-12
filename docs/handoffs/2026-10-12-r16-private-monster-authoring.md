# R16.2 bounded private monster authoring

Local source child on `codex/r16-monster-foundation`, isolated
`r16-monster-worker`; authorized plan `4bb6def` + cumulative-budget clarification
`3e382d5`. Root owns reviewed integration and combined acceptance. This child
does not change format-one schema, effects, SQL, permissions, snapshots,
dependencies, seeds, imports, sharing, public publishing or campaign instances.

## Concrete source boundary

- `lib/homebrew/monster-form.ts`: exactly-one-string control validation;
  cumulative relevant-control UTF-8 budget 131,072 bytes before JSON parsing;
  strict canonical data independently capped at 65,536 bytes; bounded errors;
  UUID and decimal PostgreSQL integer version; unique allowlisted changed groups;
  structural equality preserving array order; raw unchanged-group merge and
  refusal of undeclared changes/unsupported formats. Additional browser envelope
  claims never enter a mutation. Transport budget excludes HTTP/framework overhead.
- `lib/homebrew/monster-draft.ts`, `components/library/monster-form.tsx`: complete
  v1 structured fields, explicit absent/present-empty optional sections, no guessed
  AC/HP/scores/speed/bonuses, decimal whole-number syntax, ordered stable UI rows,
  Add/Remove/Move controls, validation focus, actual stat-block preview, controlled
  draft retention, pending/duplicate lock, stale-conflict lock and explicit reload
  with draft-loss copy. UI row IDs are never persisted. No JSON-only normal editor.
- `lib/supabase/homebrew-monsters-server.ts`: ordinary authenticated account
  client `getUser`, exactly one published `dnd-5e-2014` system, all owner/system/
  type/homebrew/personal/active predicates, raw exact-version read then identical
  final CAS predicates; UPDATE is only `{name,data}`. Effects validate for safe
  edit admission but their raw metadata/order are never projected over storage.
  Create derives slug/private envelope and `effects: []`, sends no version, and
  requires a valid version-one returned row. Update confirms expected next version
  and submitted data/name. Equal data/name means no UPDATE or new-version notice.
  Missing CAS read/write is classified only through current-owner filtered lookup.
  Unconfirmed writes tell the user to check owned Homebrew before another attempt;
  no automatic retry/upsert or exactly-once creation claim.
- `app/(app)/homebrew/monsters/{actions.ts,new/page.tsx,[id]/edit/page.tsx}`:
  authentication at pages/actions and DAL; inaccessible IDs not-found, unsupported
  owned data read-only refusal; revalidate Homebrew/current Library/detail/edit only
  after confirmed saves. No effects/authority fields are passed to the form.
- Existing Homebrew page adds only the monster settled-list family, create/edit
  and canonical detail links; other families/importer behavior are retained.

## Verification record

Root released the narrow resource slot after the R23 sequence ended. Exact clean
source `50300b69f4e50ab08f6765f83c908b7ef1695047` passed:

1. `npm.cmd test -- tests/lib/homebrew/monster-form.test.ts tests/supabase/homebrew-monsters-server.test.ts tests/components/library/monster-form.test.tsx tests/app/homebrew-monster-actions.test.ts tests/app/homebrew-monster-pages.test.tsx tests/app/homebrew-page.test.tsx --maxWorkers=2`
   — **6 files / 106 tests PASS**, Vitest 4.1.11, 7.86 seconds.
2. `npm.cmd run typecheck` — **exit 0**.
3. `npm.cmd run lint` — **exit 0 / no warnings**.

Source child `80a64c8` is followed by test-only corrections `222864d` and
`50300b6`. Initial focused run: 94 passed / 12 failed, caused by exact filter
ordering assertions and Vitest array-table argument packaging. Initial lint:
one unused optional-clear test binding under zero-warning policy. Corrections
changed only tests; all initial logs/results are retained separately. No product
behavior was weakened to make these tests pass. No install, full check, build,
browser, live request, database operation or migration ran in this child.

Evidence: `test-results/r16-authoring-local` plus frozen external copy
`../verification/r16-private-authoring-20261012`. Per-gate process JSON records
source SHA/clean status, command, PID/parent/command line/creation time and inherited
working directory; result receipts record exit and captured PID readback. No gate
started a listener. Final readback at `2026-10-12T03:48:51Z`: **0 owned Node processes,
0 captured gate PIDs, 0 captured gate listeners**. Shared-machine before/after:
450→485 processes, 26,561,576,960→27,828,154,368 working-set bytes,
39,229.421875→39,544.921875 cumulative CPU seconds, listeners **41→41**. Those
shared totals include unrelated concurrent machine activity and are not attributed
to this slice. No unrelated process was stopped.

## Review and remaining acceptance

Installed Next 16.3.8 server/client and form guides were read before React edits.
Supabase changelog was checked (2026-09-25 Postgres extension/index changes and
July Management API/extension changes do not change this existing JS table API).
Reference constraints: [Supabase update filters](https://supabase.com/docs/reference/javascript/update),
[RLS including UPDATE SELECT requirements](https://supabase.com/docs/guides/database/postgres/row-level-security).
React checklist: scoped module components, functional updates, no effect-driven
draft derivation, explicit event changes, one authentication boundary per action,
controls only in client DTO, native semantic labels/fieldsets/buttons, stable row
keys and bounded lists, optional preview only after canonical validation.

Mocked query/filter tests are not actual role/JWT/RLS or persistence acceptance.
Historical snapshot parser controls do not prove deployed trigger behavior. A
released offline real-form browser run with current root production CSS/fonts
still needs preparation/review/serialized release. Real owner create/read/edit,
foreign/signed-out denial, concurrent stale CAS, unchanged raw effects and exact
historical v1 after v2 remain authorized-runtime acceptance work. The feature does
not execute attacks/conditions/spellcasting/recharge, create monster campaign/PC
pins, import content or complete R16/M5. No hosted/SQL G2 authority is inferred.

Rollback is a local revert of this additive authoring slice; accepted read-only
monster foundation and any existing content/snapshot rows are not changed by it.
