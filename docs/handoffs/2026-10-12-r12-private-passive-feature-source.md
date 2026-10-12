# R12.6a private standalone passive features — narrow local gates passed

Approved plan `docs/specs/2026-10-12-private-passive-feature-plan.md`; isolated
`r12-passive-feature-worker`, branch `codex/r12-passive-features`, clean starting
base `9943f51a564cb5ec32cecf5773abfdcdfea220f7`. Other worktrees/monster harness
are untouched. Root remains sole integration writer. This child is a finite
standalone passive-create/text-only-edit slice, not full feature authoring, class
attachment, advanced feature mechanics or R12/M4 completion.

## Source and immutable authority

- `lib/homebrew/passive-feature-form.ts`: exactly-one-text named controls;
  cumulative relevant UTF-8 strings <=131,072 bytes before numeric/schema parsing;
  name nonblank <=100, original description nonblank <=20,000 (no text trimming),
  new class/subclass ASCII lowercase hyphen slugs <=100, explicit null for blank
  optional subclass, gain level decimal 1–20, UUID/positive decimal PostgreSQL
  integer version. Extra association/authority/mechanics controls rejected;
  only framework `$ACTION_` metadata ignored. Response shape/id/version/operation
  correlation refuses missing, malformed, old-version and wrong-identity replies.
  Named-control budget excludes HTTP/framework overhead.
- `lib/supabase/homebrew-passive-features-server.ts`: ordinary account `getUser`,
  exactly one published `dnd-5e-2014` via `.single()`, owner/system/feature/homebrew/
  personal/non-retired predicates on exact-version raw read and final CAS.
  Create writes one server-generated UUID/slug private `content_definitions` row
  with **only** `feature_type: passive`, class, subclass/null, level, description,
  and envelope `effects: []`; no canonical parser defaults or application snapshot.
  Confirm returned exact id/slug/name/private envelope/minimal raw data, empty
  effects and version 1. Generated ID is not a creation operation receipt.
- Existing canonically valid owned features of any recognized feature type can
  edit only name/description. Original raw class/subclass/type/level/mechanics/
  relations/extensions/absence and ordered raw effects remain unchanged. Validate
  canonical data/effects for admission, discard stripped/defaulted parser output,
  overlay only raw description; UPDATE `{name,data}` only. Confirm intended raw
  data/raw effects/identity plus exactly next version. Genuine no-op has **no
  UPDATE**, unchanged id/version, no revalidation/navigation; changed exhausted
  version is refused before UPDATE. Missing CAS classifies only through current
  owner's same eligible predicates, no retry/latest-row rebase/foreign disclosure.
- `components/library/passive-feature-form.tsx`: finite actual named controls,
  explicit unverified standalone/no-attachment/no-grant disclosure before save;
  read-only original association/type/level on edit, including absent subclass/type.
  Controlled drafts/native-reset prevention, pending/immediate duplicate lock,
  rejected/missing/malformed result uncertainty and no automatic retries. Uncertain
  create requires Check Homebrew **and explicit local acknowledgement** before a
  second manual create; another uncertain attempt relocks. Edit uncertainty/
  conflict requires explicit reload with draft-loss copy. Confirmed saved ID is
  retained before client navigation, so navigation failure cannot issue a new
  INSERT. Official `unstable_rethrow` preserves actual framework navigation in
  error boundaries. No raw JSON/mechanics/effects editor.
- New `homebrew/features/{actions.ts,new/page.tsx,[id]/edit/page.tsx}`: signed-out
  pages redirect; actions delegate authentication/authority to DAL, return received
  bounded saved identity before client navigation, and revalidate only confirmed
  changed saves. Unsupported known data/effects gives a read-only load refusal.
  Minimal Homebrew settled-list/create/edit family, isolated family error handling;
  all other families preserved. No new Library category/parallel catalog.

No RPC, feature ref/grant, character, acquisition, inventory, class/subclass
definition, relational attachment, snapshot, permission, SQL/migration, provider,
public sharing or dependency change. A descriptive class string is not immutable
manifest/character authority. Existing `feature-refs-server.ts` and its
`sync_character_feature_refs` RPC remain untouched.

## Meaningful tests and honest gate state

Six-file narrow set: pure mapper/response; actual-mapper mocked DAL;
mounted actual React form; actions; pages; existing Homebrew integration. Original
canonical synthetic fixtures live in `tests/fixtures/passive-features.ts` and
exercise raw choice/per-level/weapon data/extensions and ordered raw effect extras
without authoring them. DAL mocks throw on any RPC or forbidden table/write and
positive paths assert only definition writes, no grants/refs/acquisition/snapshots.
Tests cover frozen byte/text/identity/version bounds, malformed known effects,
raw absence/order, owner/private/system predicates, lost/malformed results,
next-version confirmation, no-op/exhausted limit, stale CAS/no retry, manual check
ack, pending duplicate, native reset and saved-navigation failure.

Root released the serialized narrow slot after independent source approval of
`6f43b57b574faaeb7536aad4ded592cb1bb1e449`. On clean tested source
`400d6380eaacfaa7baa9ee4b733acc68ac0cc952`, the following commands passed:

```text
npm.cmd ci --ignore-scripts --no-audit --no-fund
npm.cmd test -- tests/lib/homebrew/passive-feature-form.test.ts tests/supabase/homebrew-passive-features-server.test.ts tests/components/library/passive-feature-form.test.tsx tests/app/homebrew-passive-feature-actions.test.ts tests/app/homebrew-passive-feature-pages.test.tsx tests/app/homebrew-page.test.tsx --maxWorkers=2
npm.cmd run typecheck
npm.cmd run lint
```

Locked install added 804 packages in this worker only, without copying any
node_modules, environment files or secrets. Package/lock were unchanged; lockfile
SHA256 remains `7225AA9026EB747C5626204C9E5E5901809F95B33A1AACABA35CD139E86A2EB6`.
The final focused run passed **6 files / 145 tests**, typecheck passed and lint
passed with zero warnings. Production source is unchanged from approved `6f43b57`.
Three separate test-only corrections (`48584ab`, `531e116`, `400d638`) preserve
real crypto exports while controlling both named/default UUID interop and typing
the optional Vitest default export. The initial missing-default suite-load failure,
the subsequent real/default UUID correlation failure (144 passed / 1 failed), and
the test-mock-only TS2339 failure are retained; no assertion or product guard was
weakened. Create now additionally asserts one UUID call and exact INSERT payload
before the unchanged saved-result assertion.

Immutable logs, commands, source/status receipts, actual PID/parent/command/OS
CreationDate process metadata, before/after resources and SHA256 manifest are at
`C:/Users/kaios/Documents/Codex/2026-10-11/task-2/verification/r12-passive-feature-20261012`.
Every recorded gate exited, with remaining captured PIDs empty. Fresh readback
matched actual OS birth plus PID and command: **0 owned Node processes, 0 captured
gate processes, 0 owned listeners**. Shared process count changed 387 to 395,
working set 22,849,712,128 to 25,043,447,808 bytes, cumulative shared CPU 26,145.53
to 26,840.39 seconds; total listeners stayed 41. Those shared deltas include other
desktop/agent activity and do not establish a worker leak. No force cleanup or
server/browser startup was needed. The heavy slot was explicitly released after
this readback. Root owns independent correction review, combined checks/build and
the representative browser gate; none of those broader gates ran in this worker.

Actual signed-in owner/foreign/signed-out writes, deployed RLS/grants, concurrent
PostgreSQL CAS and historical snapshot trigger behavior remain runtime acceptance,
not proven by mocks or static source. Class/subclass attachment and advanced
feature mechanics remain required later children; no standalone grant is claimed.
Rollback is local source revert only, not deletion/rewriting of stored rows.

## Documentation checks

Read root-installed Next16.3.8 server/client, forms, server-actions, useRouter and
unstable_rethrow guides before React changes. Supabase changelog checked; its
listed database extension/index and Management API breaking changes do not alter
this existing account JS-table API. Reference constraints:
[Supabase filtered updates](https://supabase.com/docs/reference/javascript/update),
[RLS UPDATE/SELECT requirements](https://supabase.com/docs/guides/database/postgres/row-level-security).
React checklist: controlled finite fields, functional updates, event-driven draft
changes, state-scoped manual acknowledgement, confirmed identity retained before
navigation, semantic labels/fieldsets/status/error copy, and UI-only DTO (no raw
effects/privileged metadata). No unrelated refactor.
