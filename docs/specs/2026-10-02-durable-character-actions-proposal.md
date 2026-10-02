# Durable character actions and ambiguous saves (proposal only)

The current local writer treats a rejected response as a failed save and removes its optimistic patch. That is correct for the injected guaranteed-failure mocks, but a connection can fail after the server committed. A second tab also has an independent writer with a different confirmed snapshot. Busy/stale action gates cannot distinguish these cases. No client rollback, subtraction from numeric fields or automatic retry supplies durable proof of gameplay intent.

## Minimal durable boundary

A separately authorized implementation should give state-dependent play actions a server-owned command boundary, with a durable receipt and a character revision. Keep independent absolute edits distinct from relative actions.

1. Give each intended action a stable operation ID retained across an ambiguous response/reload. Bind it to the authenticated character, command kind and canonical request fingerprint. A retry with the same ID and identical intent returns the stored receipt; reuse with different intent is rejected. An operation ID alone is not authentication or authorization.
2. Record the committed outcome and resulting character revision in a durable command receipt. The receipt must survive later state changes so rereading current HP/slots is not mistaken for proof about an earlier action. Retention/privacy and retry-key lifecycle need an explicit policy; no client storage or new table implements this proposal.
3. At the authenticated server entry, derive the owner from verified auth, load accessible pinned content and validate the action's supported domain intent. Never accept a client owner, maximum HP, arbitrary effect patch, die spend or spell cost as authority. Keep privileged credentials and any trusted mutation function server-only; use narrowly reviewed grants.
4. Serialize the mutation at the character row and check the expected revision/source snapshot. Reject stale commands rather than guessing their order or silently repeating them. A trusted server may compute a consequence from its loaded snapshot and submit an internal compare-and-apply transaction that locks the character, verifies the unchanged snapshot/revision, atomically saves the patch and receipt, and returns the stored result. Separate read/compute/write RPCs are not a transaction.
5. Every writer that can change relevant state, choices, pins or mechanical inventory must participate in the revision/lock protocol. Updating only the play writer does not protect against the existing direct mutations or reference changes. Define which changes invalidate an action, then enforce it at the durable boundary; a character-only version that ignores pinned-source changes is insufficient.
6. A hit-die command's accepted roll result, die spend, HP update and associated gameplay roll history belong in the same receipt/commit. The frontend presents that accepted result after confirmation. A replay returns the same accepted roll; it does not create another roll-log entry. How rolls are authoritatively generated and audited is a separate product/security decision before implementation.
7. The client distinguishes confirmed success, confirmed no-commit rejection and unresolved completion. For an unresolved result, preserve the operation ID and check its receipt before repeating the action. No receipt found while offline is not proof of failure. Provide explicit recovery when the server can be reached; do not automatically reissue a potentially accepted cast, heal or rest.

This design is independent from starting-equipment grant uniqueness. Distinct operation IDs may represent legitimate distinct gameplay actions; starting equipment needs the natural per-character grant-kind uniqueness and provenance in the [equipment proposal](2026-10-02-equipment-atomicity-proposal.md). Do not invent a universal once-only rest rule or combine the two ledger meanings.

## Required evidence and approval

Before implementation, reconcile migration history, review command receipt/revision schema, existing writers and permissions, decide roll authority and receipt retention, and obtain explicit schema/hosted authorization. Verification must include guaranteed rejection before commit, lost response after commit, same-ID replay, changed-payload ID reuse, simultaneous different IDs from two tabs, stale pinned sources, unauthorized character/content, navigation while ambiguous, and roll-history uniqueness. Local mocked failure tests cannot substitute for these durable cases.

No SQL migration, schema change, hosted test, credential change or new persistence framework accompanies this document. Existing local action gating and explicit errors remain useful but are not release proof for ambiguous or cross-client writes.

## Exact approval scope

Minimum proposed DDL (no migration accompanies this proposal):

- `characters.action_revision`: nonnegative bigint, default 0, not null. Relevant state/base-stat/
  choice changes and content-ref/mechanical-inventory mutations participate in the same character lock
  and increment protocol. Review/update every applicable direct writer and child-table mutation path;
  a new command endpoint alone is insufficient.
- `character_action_receipts`: PK `(character_id, operation_id)` with character FK, command kind,
  canonical request fingerprint, accepted result JSON, resulting revision and timestamp. Owner is
  auth-derived; owner-only receipt reads and trusted-server-only writes/execute grants are reviewed.
- For supported hit-die commands, nullable `character_rolls.action_operation_id` linked by
  `(character_id, action_operation_id)` to the receipt, unique when nonnull: one accepted history entry
  per supported command. Keep ordinary manual rolls distinct; multi-roll commands need separate review.
- Authenticated command/receipt entry plus one internal compare-and-apply transaction: row lock,
  revision/source/access validation, state mutation, accepted roll history and receipt in one commit.
  Existing unrestricted mutation paths must join this protocol, not silently bypass it. Review generated
  types/callers/grants and the state RPC no-match/search-path questions from the release checklist.

Before implementation Victor must approve roll authority/audit, supported command kinds, retention and
client operation-ID storage/recovery policy. Receipt lookup is not a current-HP inference; offline or
missing receipt under unresolved connectivity is not confirmed failure. Creation deduplication requires
a separate pre-character receipt boundary and is not claimed by this character-scoped design.

Hosted approval must name a disposable staging project/DB, migration replay and exact fixtures: at least
two owners plus nonowner/anonymous access, accessible/foreign pinned definitions, tracked character,
inventory/ref, receipt and roll IDs, and two browser sessions. Required cases: reject before commit;
commit then lose HTTP response and reload/read receipt; same-ID replay returns identical result and one
roll; same ID/different fingerprint rejects; simultaneous identical IDs commit once; different IDs with
one expected revision reject stale intent (legitimate subsequent actions remain possible); state, choices,
pins or mechanical inventory changed between planning/commit invalidate the command; foreign/missing
character and inaccessible content cannot yield success; navigation while unresolved keeps recovery ID;
failed transaction leaves no state/receipt/roll residue. Replay the reconciled migration chain in a fresh
approved DB and verify effective qualified function bodies, grants/RLS and no-match rejection. Commit-loss
tests use committed disposable rows; final cleanup is by tracked IDs with zero residual fixtures. No
production data, existing worktree, credential/security change, schema or hosted operation is authorized
by this design document alone.
