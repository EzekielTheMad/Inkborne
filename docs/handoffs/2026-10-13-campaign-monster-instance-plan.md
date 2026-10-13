# R16/M5 campaign monster instance plan — freeze

Sole docs writer in r12-passive-feature-worker/codex/r12-passive-features,
basis53b69fc; docs-only review amendment over immutable c8f2b4c. Fixed root
d3f5ed63778386246b6c1b440dd820a346ca92af inspected through
Git objects only; root owns full check. Owned only new spec
docs/specs/2026-10-13-campaign-monster-instance-plan.md and this handoff.
No source/root/worktree/receipt edits, tests/install/network/SQL/runtime/credentials
or new background work. Freeze for independent challenge BEFORE implementation.

Smallest useful child: current campaign OWNER adds one admitted format1/empty-
effects exact catalog version to a DM-only roster, with per-instance name/manual
currentHP/plain notes and reversible archive. Immutable full embedded snapshot/
source provenance persists independently of definition/version deletion. Shared-
source acquisition and cross-owner account lifecycle remain later requirements.
Existing campaign-owner convention—not a member dm label—controls reads/writes.
MonsterStatBlock is reused unchanged; no monster character/ref or second catalog.

First useful implementation child includes dedicated atomic create/update/resolve
storage/receipts/CAS AND actual DM-only list/detail/form/DAL/routes, default-off
until native authority/transaction/RLS/recovery accepts; pure DTOs are supporting
preparation, not completion. Native validation covers exact locked identity/current
version/digest, active platform or current-owner personal entitlement, explicit
format1/effects[], bounded raw snapshot and finite HP/control/revision. It does NOT
mirror all Zod descriptive invariants or claim complete SQL parity. Existing full
canonical parser is mandatory for preview/render, with malformed descriptions
failing closed. Conservative JSONB budgets are disclosed. Shared sources, even if
generally readable, are unsupported: monster sharing producer is absent and direct
authenticated content_shares DML is revoked. Digests/previews are not authorization.

Single native command transaction derives actor from signed-in auth.uid, source/
maxHP/time; writes instance+immutable natural-key receipt atomically. Expected
bigint revision/no-op/+1/ceiling, replay before fresh source/revision gates, controlled
uncertainty/manual same-operation recovery and saved-ID navigation refusal prevent
duplicate inserts/old HP overwrites. No service client/actor UUID/caller GUC bypass.
Confirmed receipt absence after uncertainty never permits a new UUID: a delayed
original may still commit. Preserve SAME operation+immutable submitted intent for
resolver/replay. Native cancellation/tombstone fencing would be required to abandon
that operation and is outside the first scope; no acknowledgement shortcut.

Plan removes the character guard/installation/ACL bridge entirely: no character
mutations or proven existing cycle requires it. Dedicated internally namespaced
transaction operation lock plus unique receipt key serializes same-operation
commit/resolve; instance row lock+CAS serializes different operations. Fresh create
uses definition→system→campaign→version locks, grounded in existing native sharing
writer definition FOR UPDATE→system FOR SHARE→campaign FOR KEY SHARE order.
Replay lookup starts after its operation lock from an unlocked current-owner read,
then campaign FOR SHARE and current-owner recheck BEFORE any receipt return or
intent conflict. Missing receipt CREATE takes no early campaign row lock, avoiding
definition-before-campaign inversion; update locks campaign then its own instance.
P1/R09 source/ACL/Auth/readiness remain untouched and are not installation dependencies.
Current ownership-transfer guard remains; later transfer is a separate lifecycle
contract. Campaign-only cascade and immutable receipts require native RI proof.

No human decision is needed for these inferred first-child choices; delegated DM,
player visibility, effect automation, transfer/copy/import/other creature-instance
contracts stay explicit future work. M7/creature imports paused; M5 still incomplete.
Separate G2 native source/RLS/constraints/concurrency/lost-response and G3 real
owner/player browser/persistence/privacy acceptance remain before activation.
