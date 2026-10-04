# Starting-equipment local boundary checkpoint

October 4, 2026. Based on clean `55f6cbfaa8179f6e1851e364fbfbd82944799d54`.

## Outcome and authorization blocker

The parent delegated local-only implementation of package B in
[the permission package](../specs/2026-10-03-next-permission-package.md), including staging SQL and application integration for review, explicitly forbidding hosted schema/grant/security changes, fixtures, publication and deployment.

Automatic approval review rejected the SQL/application staging command before execution:

> Although no SQL is executed, this action creates a substantial schema/privileged-function transaction design and wires the application to it; the user explicitly reserved equipment schema/atomicity implementation for further approval, and no trusted user approval for that scope is present.

No retry, alternate execution path or indirect SQL staging followed. The rejected command made no changes. Earlier unintegrated server/action drafts were removed by exact filename; no tracked application caller was changed. The narrower deliverable is a pure, unused boundary-validation contract plus tests. **The equipment transaction, migration, eligibility initialization and caller integration are not implemented.** No hosted calls, fixtures, schema, grants, configuration or credentials changed. The prior ten hosted attempts remain exhausted and cleaned.

Next authorization needs the original user question/reply that explicitly covers local-only SQL staging and application integration, recognized by action-time review. Parent summaries previously failed that boundary during hosted acceptance as well. This is an approval-review blocker, not a product-policy decision. The risky operation is introducing privileged transaction functions and eligibility/provenance schema; applying any hosted version remains separately forbidden.

## Completed unaffected local work

`lib/builder/starting-equipment-contract.ts` specifies a strict, bounded input shape: character UUID, saved selection/pick string maps, exact class/background UUID/version intent, and no actor, inventory plan or currency fields from the browser. The server-derived plan shape accepts existing pinned/custom parser grants and bounded integer quantities/currency. JSON intent comparison ignores object key order and preserves array order; completion flag is omitted from request intent because it is not a different equipment selection.

These schemas are **not called by the application**. They establish TypeScript/input/parser contracts only. They neither create eligibility nor authorize a grant. Tests exercise actual established parser output, malformed maps, strict unexpected fields, missing/invalid pins, bounds, invalid numeric values and changed/equivalent intent. No in-memory grant ledger was introduced or reported as database evidence.

## Reviewed implementation requirements for the next stage

Independent source inspection by `compatibility_review` confirmed:

- Authenticate every server entry with `getUser`; derive actor identity there. Reuse the existing server-only service-role client pattern (`mpmb-imports-server.ts`), without cookie propagation or browser-exposed keys. Configuration availability is unverified; no secrets were read.
- New character and `eligible` marker must commit in one trusted transaction; never initialize eligibility in a second request or fall back after an ambiguous creation response. The current new-character action directly inserts; it remains unchanged.
- Authorize current ownership and resolve terminal receipt **before** current catalog reconstruction, source validation or the new-award gate. Owner-policy reads or a locked ownership-checking receipt operation must avoid a privileged receipt lookup racing an ownership change.
- Use `(character_id, starting_equipment)` uniqueness and one character lock for retries from independent tabs. Relevant direct class/background ref insert/update/delete operations must take that lock, with deterministic old/new-parent lock ordering for reparenting. Existing copy already locks the source.
- Independently load accessible exact pinned sources and saved selections. Reject duplicate/conflicting class/background pins, malformed selections and unsafe plans. Compare the locked relevant choices/ref snapshot and recheck source/item access inside the transaction.
- Complete ledger, inventory provenance, currency increment, confirmation merge and immutable receipt in one commit. Known rejection, committed response loss and crash recovery are distinct. Equivalent recovery returns original IDs/delta after item removal or currency spending, with no automatic new award or catalog guessing.
- Extend the **latest** `copy_character` definition in `20260722221534_atomic_background_selection.sql`, retaining existing feat/background/campaign/content validations and all current inventory/state copying. Awarded/confirmed sources yield inherited completion with target item IDs/provenance, zero additional award items/currency, and no fabricated historical receipt. Proven eligible sources can retain first-confirmation eligibility. Missing-marker unconfirmed/possibly partial legacy sources stay unresolved; do not infer never-awarded from absent inventory.
- Preserve receipts/provenance after any award/inherited completion. Rollback disables new awards but keeps owner receipt recovery and safe copy semantics; do not restore the sequential grant path, subtract spent currency or delete granted inventory/evidence. Any destructive schema reversal with receipts needs separate data-preserving review.

Existing older/direct inventory and stale choices writers are separate rollout limitations. This checkpoint neither fences them nor blesses ambiguous legacy partial grants.

## Database evidence and next steps

Read-only capability inspection found no `supabase`, `psql` or `docker` command, no installed `node_modules/.bin` Supabase/Postgres executable, and no PostgreSQL/Docker installation under Program Files. No installation or runtime startup attempted. There is no supported disposable local database available in this environment.

Consequently **PostgreSQL atomicity, concurrent idempotency, authorization/grants/RLS, trigger lock ordering, crash/committed-loss recovery, migration replay and rollback remain unproven**. Pure schemas/tests cannot prove them. Supabase guidance was read; official function documentation confirms invoker preference and explicit execution revocation. The markdown changelog endpoint was inaccessible through the browsing tool; no new platform API assumptions were implemented.

Once local staging is recognized as authorized: generate the migration with an existing approved Supabase CLI (`migration new`), implement the restricted ledger/provenance/create/award/copy/ref-lock changes, integrate a server-owned parser plan and switch the actual caller with no legacy fallback for eligible characters. A default-off new-award rollout gate must preserve terminal recovery even when disabled. Stage a receipt-preserving rollback procedure. Obtain independent review, then use an existing authorized disposable DB to test failures at every write stage, simultaneous requests, foreign actors/content, changed/stale intent, response loss, consumption replay and copy/no-reaward. A hosted target, schema application and fixtures require separate explicit approval; prior state-only allowance is exhausted and cannot be reused.

## Validation

`npm run check` passed: TypeScript, zero-warning lint, **217 test files / 2,122 tests**. The 17-test focused contract suite passed; final Unicode-key regression is checked separately after using portable source escapes. Independent review found and corrected the locale-dependent key-sort defect (ordinal sorting now used), and confirmed the narrow checkpoint and blocker/rollback claims. `git diff --check` passed. No build/browser rerun is needed for an unused pure module with no application caller changes; the prior `55f6cbf` application build/Chrome evidence is historical, not new transaction acceptance.

Logs are retained as `task-5/inkborne-equipment-contract-check.txt` and `inkborne-equipment-contract-focused.txt`. No application behavior changed; no publication. **Not release-ready.**
