# Starting-equipment atomicity proposal (not implemented)

## Current failure boundary

`builder/equipment/equipment-step-client.tsx` inserts grants sequentially through
`addInventoryItem`, writes currency from the page-load snapshot, then replaces
the starting-equipment choices with `confirmed: true`. A failure after an insert
leaves durable partial grants; a lost final response/reload/retry can duplicate
them. `character_inventory` requires pinned content versions for definition-backed
items, but no starting-grant provenance identifies which inserts to reconcile.
Client-only tracking, disabling a button and the new dialog guards do not fix it.

## Minimal durable boundary

Design one server-owned transaction that grants equipment, adds currency and
confirms choices together. Proposed components require separate authorization:

1. A grant ledger with one starting-equipment grant per character, a stable grant
   ID, canonical source/selection snapshot, returned inventory IDs and currency
   receipt. Uniqueness is on character plus grant kind, not solely a client request
   UUID: independent tabs can generate different request IDs for the same grant.
2. Grant provenance on inventory rows referencing that ledger. The receipt remains
   durable even if a player later consumes, sells or removes the inventory items.
3. A transaction function callable only by the trusted server role (revoke default
   PUBLIC/anon/authenticated execution). The authenticated server entry first uses
   `getUser`, derives the owner ID from that result and independently loads the
   character's pinned class/background/catalog and saved selections. It uses the
   existing parser/grant builder, with completeness and content-access checks.
   Never accept an owner ID, item list or currency award from form input, expose
   a privileged credential in client code, or make this trusted RPC public.
4. The function locks the character row, verifies ownership against that trusted
   owner ID, and compares the relevant choices/pinned-source snapshot. A stale
   plan is rejected. It checks for the existing ledger before granting. An existing
   equivalent grant returns the original receipt; a differing plan returns an
   already-granted conflict instead of awarding equipment twice.
5. Within that single transaction: create the ledger, insert pinned/custom items
   with provenance, add currency against current locked state, merge only the
   starting-equipment choice fields and confirm, then save/return the receipt.
   Any failure rolls everything back. A committed response that was lost is
   recoverable by reading/repeating the same character grant and returning its
   durable receipt. Existing constraints/triggers remain effective.

This server-only design avoids porting the text-equipment parser into SQL or
trusting a browser-derived award. A public owner RPC would need independent
database validation/derivation of the canonical plan; that is a different design.
The trusted function still needs explicit ownership and snapshot checks even if
its caller has privileged table access. Secure server-role credential availability
and permission narrowing must be verified before implementation, not assumed.

## Reconciliation and gates

Do not automatically regrant or fabricate receipts for legacy confirmed strings,
existing confirmed selections, or suspected partial grants. Inventory names alone
cannot prove provenance, and a player may have altered inventory since creation.
Audit those cases and define an explicit reconciliation policy first. Character
copy semantics must deliberately carry completed-grant status/provenance to the
new character without treating the copy as a new award. Starting-grant respec or
repeat grants are outside this proposal.

Before implementation: reconcile migration history/generated types; review owner
and content access, trusted function grants, copy behavior and historical partial
grants; obtain schema/hosted authorization. Tests must cover injected failure after
each write, response loss, simultaneous different request IDs, stale choices,
guessed character IDs, foreign content/version denial, ledger replay after item
deletion and character copy. No SQL migration or hosted operation accompanies
this document. Equipment remains an unresolved release item.
