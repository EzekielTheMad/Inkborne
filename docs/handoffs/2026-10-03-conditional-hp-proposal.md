# Conditional HP follow-up — local proposal only

Historical checkpoint. Superseded by [applied conditional HP acceptance](2026-10-03-eighth-conditional-hp-acceptance.md); all eight fixtures cleaned, conditional guard tested locally against approved development endpoint. Legacy writers remain outside that scope.

Parent authorized continuing the demonstrated two-tab overwrite locally, using existing conditional RPC support if available, otherwise preparing a reviewed SQL/code proposal without applying hosted schema/permissions or creating an eighth fixture.

## Finding and deliverables

Read-only pg_proc on project etcaodglvcspcmwecyxq confirms one existing patch_character_state(uuid,jsonb), returning void, SECURITY INVOKER and empty search_path. Its body shallow-merges state without expected-state/version or affected-row result. Local migration 00031/generated types match. Ability concurrency was direct table UPDATE filtered by choices/base_stats, not a state RPC capability. An application pre-read plus the old RPC does not close the race.

Prepared [design and integration plan](../architecture/proposals/conditional-character-state.md), [review-only SQL](../architecture/proposals/conditional-character-state.sql) and [executable client contract](../architecture/proposals/conditional-hp-client.ts). No app/lib/components/generated types/migration changes; no production imports or activated RPC calls. The proposal uses a separate invoker function, existing RLS plus explicit owner predicate, whole raw confirmed state comparison under row lock, and applied/conflict/missing outcomes. The adapter treats transport loss/malformed results as uncertain, not failure known to precede commit, and never automatically replays damage/healing.

A full-state comparison conservatively rejects stale HP actions after independent absolute edits while preserving those edits; death-save/concentration dependencies remain inside the checked snapshot. This is not a revision/event ledger and does not cover ABA or derived rule inputs outside state. Old unconditional writers and partial rollout remain unsafe.

## Local verification

Focused deterministic contract tests: nine passed. Tests exercise both damage orderings, stale healing after independent temp-HP/notes edits, preservation of unpatched state and linked concentration patch, missing access, response loss after model commit and malformed replies. The serialized in-memory model uses structural equality after independent review, matching JSON object key-order semantics better than stringify equality. These are proposal/adapter tests, not real UI/PostgreSQL/RLS concurrency acceptance.

Explicit ESLint check of the proposal TypeScript passed. Full npm run check passed: types, lint, 212 test files / 2,039 tests. No build rerun is needed for this review-only docs/test change; the prior application-source production build passed at 67cc053. SQL was statically reviewed, not parsed or executed: no PostgreSQL/Supabase CLI/Docker executable available in this environment and no install attempted.

Independent reviewer found no blocking SQL issue and required raw-snapshot ownership, coordinated HP/temp-HP writers, patch validation, generated types, provider conflict recovery and approved SQL/RLS/concurrency verification before production wiring. Its stringify-model limitation was corrected to structural equality. No hosted calls by reviewer.

## Approval and unchanged risk

The demonstrated HP 10 to 8 to 7 overwrite (serial intent 5) remains unfixed in production source. Applying the proposed function/execute grant is a hosted schema/permission change and requires separate approval; the draft is outside migrations and is not auto-applied. Production integration and testing require a coordinated rollout decision, including legacy writers. No new table, revision column, policy or ledger is proposed for this minimal compare-and-set boundary. Durable ambiguous outcomes/roll atomicity and equipment atomicity remain separate decisions.

Only hosted action this phase was SELECT function metadata. All seven fixture cleanup receipts remain intact; no eighth creation, application mutation, schema change, server, push, merge or deployment. See [current hosted acceptance matrix](2026-10-03-seventh-recovery-concurrency.md). **Not release-ready.**
