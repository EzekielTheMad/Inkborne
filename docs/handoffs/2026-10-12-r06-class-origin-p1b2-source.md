# R06/R12 P1b.2 disabled private confirmation producer — source freeze

2026-10-12. Sole writer in r12-passive-feature-worker/codex/r12-passive-features,
basis f2da01426d174dc51eba8fe441d508a5587f3f86. Independent plan approval preceded
this source. Source preparation ONLY; all tests/typecheck/lint/SQL/runtime unrun
under root's heavy hold. No install, network/provider, SQL/PGlite, browser/server,
Auth/readiness activation, product imports or other-worktree changes.

Seven additive paths:

- supabase/staged/class-origin-confirmation-producer.sql
- lib/character/class-origin-confirmation-schema.ts
- lib/character/class-origin-confirmation-model.ts
- tests/fixtures/class-origin-confirmation.ts
- tests/lib/character/class-origin-confirmation.test.ts
- tests/supabase/class-origin-confirmation-staged-contract.test.ts
- this handoff

The two existing P1b.2 plan/handoff documents record one root-approved privilege
refinement: receipts have SELECT/INSERT only. Read their actual immutable bytes
under the locked owned parent, lock finalized journal/consumed proofs with existing
rights, and recheck correspondence. No receipt UPDATE lock grant was added.
Both receipt immutable UPDATE/DELETE guards are required source-test dependencies;
native role/guard/lock behavior is still unproved pending G2.

Frozen P1a/joint/R09 modules/tests/stages and all existing product files unchanged.
The actual new SQL file is additive after those stages. Definition/ACL order is
preflight → five authority-only child-key lock grants with permissive visibility
and restrictive WITH CHECK(false) policies → class-owned private evidence helper
→ authority-owned source/access lock helper → class before validator → private
entry → same-transaction exact helper-only EXECUTE closure. No public entry grant,
old begin replacement, role membership, journal cross-owner DML, readiness writer
or native Auth replacement. The source GRANT statements have NOT executed.

The entry invokes the unchanged always-denied class Auth seam initially, after
guard/owned-parent waits, immediately before matching receipt return and before
new acceptance. The authority helper invokes its unchanged always-denied Auth seam.
Shapes cannot establish actor/session authority; positive model phase injections
are labelled model_checked ONLY. Matching replay precedes every new-work origin,
occurrence, history and source lock/read/gate; native equality-expiry refuses.
Original receipt actor/time/revisions survive replay under current ownership.

NEW work derives actual bootstrap receipt/journal zero-capture and retained
add-class INSERT proof, all retained tuples, locked current definition/version/
campaign/member/share/child/order rows, and a bounded full raw before graph.
Acquisition checks selected class/subclass snapshot AND current entitlement and
retirement after waits. Metadata-only confirmation preserves raw source order/
effects, choice history, HP/state, pins and unrelated rows. Exactly three derived
proofs precede actual occurrence→origin→receipt writes. Existing joint dispatch
owns the one shared revision bump/rebind/RETURNING/readback; immediate and original
initially-deferred closure remain armed. No producer manual parent counter write.

The new model binds actual staged critical bodies, composes the accepted joint
phase model and base finalizers, and derives its own receipt/proofs from injected
stored rows. It cannot authenticate, execute SQL, establish historical native
producer lineage, apply grants or enable consumers. Constructor/body removal
controls are separate from semantic missing-provenance/expiry/access/receipt cases.
Original canonical class/effect fixtures cover level1/higher/multiclass, current
catalog v2 while preserving v1, replay-before-missing-history, current ownership,
native expiry after waits, changed intent, retirement/dual entitlement, shared
campaign owner/member rules, forged history/consumption and strict bounded input.

Requested later narrow gates, ONLY after both original-owner source reviews and
root release: package test script on the new model/static suites plus existing
P1a/joint controls with maxWorkers2; package typecheck/lint. Preserve first failures
and exact semantic source controls/restore hashes. No claim of passing tests here.
No SQL syntax/DDL/roles/RLS/trigger/lock/native time/rollback/concurrency accepted.

All13 readiness false; Auth unavailable/default-off. Fresh bootstrap/add-class/
level/subclass/remove/reorder/compiler/copy/materializers/all writers/native Auth/
G2/C1v2/C2/NEW class authoring remain separate prerequisites. The current UI/direct/
equipment creation cannot provide this function's genuine private history; missing
history is unavailable, never synthesized from class-array order or equipment.
Ephemeral row locks do not replace future persisted/all-writer/phantom fences.

Freeze for independent class-family AND original R09-family source review before
any gates or integration; root remains sole integrator. No task-owned background
process was started or left running during source preparation.
