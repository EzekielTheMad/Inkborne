# MPMB guided spell repair

## Goal

Let an import owner safely resolve the two review blockers that already retain a
schema-valid normalized spell candidate:

- `spell.material.required`
- `spell.save.success_unknown`

The repair happens inside the durable owner-only review before commit. It never
re-parses, executes, stores, or returns the uploaded JavaScript.

## Scope

An open `needs_info` spell is repairable only when it has normalized candidate
data and one or both supported unresolved diagnostics. The UI renders only the
fields required by those diagnostics:

- missing material text: a bounded nonblank material description;
- unknown save outcome: save ability plus `half`, `none`, or `other`.

Unsupported items, candidate-less items, completed/cancelled imports, committed
items, and all other diagnostics remain read-only.

## Persistence and audit

`content_import_items` gains:

- `resolved_diagnostics jsonb NOT NULL DEFAULT '[]'`;
- `user_edited_fields text[] NOT NULL DEFAULT '{}'`;
- `user_edited_at timestamptz`.

Resolved issue objects move from `diagnostics` to
`resolved_diagnostics`; they are not deleted. Edited field names are recorded
without accepting arbitrary paths from the client.

## Mutation boundary

`repair_mpmb_import_spell_item(target_import_id, target_item_id,
expected_revision, repair_patch)` is an authenticated
`SECURITY DEFINER` RPC with an empty search path.

The RPC:

1. derives the actor from `auth.uid()`;
2. locks the owned open import and rejects stale revisions with `40001`;
3. locks an uncommitted `needs_info` spell with candidate data;
4. rejects unknown patch keys and repairs without a matching unresolved
   diagnostic;
5. validates bounded material text and the exact DC object shape;
6. patches only `candidate_data.material` and/or `candidate_data.dc`;
7. moves the matching issues into the audit column;
8. recomputes the item status from remaining blocking diagnostics;
9. selects the item only when it becomes valid;
10. updates summary counts/blocking count and increments the import revision in
    the same transaction.

Direct table mutation remains unavailable to authenticated clients. The RPC is
revoked from `PUBLIC`, `anon`, and `service_role`, then granted only to
`authenticated`.

## Application flow

- The review page links only repairable items to
  `/library/import/[id]/items/[itemId]/edit`.
- The edit page rechecks authentication and ownership, returns 404 for any
  non-repairable state, and exposes only the normalized candidate values and
  supported repair flags.
- A `useActionState` form validates FormData with Zod, reports field errors,
  and submits the narrow patch through the server data layer.
- The Server Action authenticates through the data layer again, calls
  `revalidatePath` before `redirect`, and maps stale revisions to a visible
  conflict.
- Returning to the review shows the repaired item as ready and selected. The
  audit label identifies user-corrected fields.

The general homebrew spell form is not reused: rebuilding an imported candidate
through its authored subset could silently discard advanced normalized fields.

## Deferred

- Candidate-less spell and feat reconstruction needs a safe normalized draft
  representation in the mapper and staging model.
- Conflict keep/replace needs explicit provenance cardinality and a policy for
  already-shared targets; automatic JSON merge is not acceptable.
- Preview validation needs a non-persistent evaluator boundary or persisted
  content versions; current character/sheet APIs cannot consume staged items.

## Verification

- Migration contract tests cover columns, RLS/grants, ownership, locks,
  optimistic revision, patch allowlist, diagnostic audit, summary transitions,
  and selection invariants.
- Server-layer tests cover authentication, owned item loading, narrow patch
  validation, RPC arguments, and conflict mapping.
- Action/component/page tests cover field errors, pending state, conditional
  fields, revalidation-before-redirect, and repair-link visibility.
- Mapper regressions prove the two supported blockers retain schema-valid
  candidates.
- Hosted rollback smoke covers stage, repair, stale-revision rejection, commit,
  personal/homebrew scope, and private-only provenance.
