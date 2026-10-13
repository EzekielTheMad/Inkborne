# R16/M5 campaign monster instance plan — freeze

Sole docs writer in r12-passive-feature-worker/codex/r12-passive-features,
basis53b69fc. Fixed root d3f5ed63778386246b6c1b440dd820a346ca92af inspected through
Git objects only; root owns full check. Owned only new spec
docs/specs/2026-10-13-campaign-monster-instance-plan.md and this handoff.
No source/root/worktree/receipt edits, tests/install/network/SQL/runtime/credentials
or new background work. Freeze for independent challenge BEFORE implementation.

Smallest useful child: current campaign OWNER adds one admitted format1/empty-
effects exact catalog version to a DM-only roster, with per-instance name/manual
currentHP/plain notes and reversible archive. Immutable full embedded snapshot/
source provenance persists independently of definition/version/account deletion.
Existing campaign-owner convention—not a member dm label—controls reads/writes.
MonsterStatBlock is reused unchanged; no monster character/ref or second catalog.

New stage/schema/model/DAL/controlled forms and campaign routes are proposed in
finite children, default-off until native authority/transaction/RLS/recovery accepts.
Native source validation must mirror all shipped monster semantics in the explicit
bounded subset; conservative native JSONB text/data/envelope budgets are disclosed,
not claimed equivalent to Zod JSON.stringify. Source digests/caller previews are
not authorization. Both current+snapshot exact-campaign entitlement rechecked after
locks, shown source version/digest exact; stale catalog returns conflict, no repin.

Single native command transaction derives actor from signed-in auth.uid, source/
maxHP/time; writes instance+immutable natural-key receipt atomically. Expected
bigint revision/no-op/+1/ceiling, replay before fresh source/revision gates, controlled
uncertainty/manual same-operation recovery and saved-ID navigation refusal prevent
duplicate inserts/old HP overwrites. No service client/actor UUID/caller GUC bypass.

Plan expressly requires existing shared writer guard and original R09 owner review
for new owner lock-only ACL bridge; fresh create uses definition/system/campaign/
access/version locks. Replay lookup starts from an unlocked current-owner read,
then campaign FOR SHARE and current-owner recheck BEFORE any receipt return or
intent conflict. Missing receipt CREATE takes no early campaign row lock, avoiding
definition-before-campaign inversion; update locks campaign then its own instance.
Auth/readiness P1/R09 defaults are unchanged and all-writer closure not claimed.
Current ownership-transfer guard remains; later transfer is a separate lifecycle
contract. Campaign-only cascade and immutable receipts require native RI proof.

No human decision is needed for these inferred first-child choices; delegated DM,
player visibility, effect automation, transfer/copy/import/other creature-instance
contracts stay explicit future work. M7/creature imports paused; M5 still incomplete.
Separate G2 native source/RLS/constraints/concurrency/lost-response and G3 real
owner/player browser/persistence/privacy acceptance remain before activation.
