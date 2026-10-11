# Executable local starting-equipment checkpoint

October 11, 2026. Isolated branch `codex/equipment-executable-verification`, based on `7b7f45bd9f64dbe847238ac108eaed9fa6bcdc32`. Original worktrees are unchanged. This task permits local implementation/testing; no hosted schema, credentials, authentication settings, fixture data, push, merge or deployment was changed.

## Completed slice

The actual complete `supabase/staged/starting-equipment-transaction.sql` now executes in a disposable in-memory PostgreSQL-WASM fixture using the same pinned PGlite `0.5.8` test dependency already used in PR101. The fixture has synthetic tables, roles, owner RLS and narrowed content/campaign helpers. It does not start services or use environment files/network access.

The first executable run passed 35 checks and failed four copy cases with `column reference "source_grant.id" is ambiguous`. The new equipment-ledger row variable collided with an existing feature-grant SQL alias inside `copy_character`. The fix renames only that row variable to `source_starting_grant`; the established feature-grant queries, grant/RLS rules and copy behavior remain intact. No migration was generated or applied. The structural comparison against the existing copy implementation remains enforced.

The resulting 45 executable cases cover:

- Character + eligibility creation, including a failing marker insert rolling back the character.
- Atomic inventory/currency/confirmation/receipt, unchanged-choice/ref/source checks, original receipt replay, different-intent and different-plan rejection, and recovery after inventory consumption, spent currency and pin deletion.
- Failure injection at the first inventory item, second inventory item, character update and receipt update; every failure leaves the pre-award snapshot intact.
- Plan/item/currency validation, immutable private items, campaign membership/sharing access and withdrawal, privileged-entrypoint denial, actor ownership, owner receipt reads and immutable receipt/provenance protection.
- Awarded, eligible and confirmed/no-marker legacy copies; inherited completion has no fabricated historical receipt or fresh award. Consumed inventory stays consumed. Narrative notes/timeline/NPC data retain copy behavior and reset visibility.

Focused executable + existing stage/application-boundary coverage: 73 tests across four files passed. The separate full unit run passed 221 files / 2,230 tests. The existing offline Playwright equipment fixture also passed its 24 real-component desktop/mobile checks with simulated persistence, zero page errors and zero remote requests. A production build passed using process-scoped dummy Supabase configuration with the equipment gate off. `npm run check` passed TypeScript, then stopped at ten inherited lint errors: one `react-hooks/preserve-manual-memoization` finding in `components/sheet/spells/cast-dialog.tsx:121` and nine `react-hooks/globals` findings in `tests/lib/character/character-context.test.tsx` at lines 209, 256 (two), 322 (two), 625, 646, 676 and 699. Those files are unchanged by this checkpoint. The full quality gate is not green. Implementation paused at Victor's request before repairing those findings.

## Limits and next gates

This is real PostgreSQL-WASM execution of the staged functions in a synthetic model. It does not replay the full Supabase migration chain, baseline feature-manifest triggers, production extensions or actual service-role grants. PGlite is a single-connection engine here: no inter-connection races, lock ordering/deadlock proof or hosted durability claim is made. ASI-feature grant remapping is covered by the preserved structural contract, not a fully populated executable feature-trigger scenario.

Next equipment gates remain complete disposable migration-chain replay, baseline privileges/triggers, multi-connection award/pin/ownership/copy contention, reviewed migration/type generation, authoritative legacy partial-grant policy, and separately authorized hosted acceptance/rollout. `INKBORNE_ATOMIC_STARTING_EQUIPMENT` remains default-off.

PR101's ability-save implementation and already-applied migration `20261010232200` were not duplicated or reapplied. This branch inherits the older local core ability code; integrate the reviewed PR101 slice before considering an application release. Do not deploy this branch as a substitute for the current dev build.

The connected backlog also lists older E2E selector drift, PR99 magic-item revalidation and durable rolled-action coordination. These need current-source reproduction rather than relying on stale milestone wording. Journey polish (#67), canonical E2E fixture repair (#98) and the compendium (#96/#97) already shipped; no replacement implementation is required.

## Reproduction

Use repository scripts:

```powershell
npm test -- tests/supabase/starting-equipment-postgres.test.ts tests/supabase/starting-equipment-staged-contract.test.ts tests/app/starting-equipment-actions.test.ts tests/app/starting-equipment-page.test.ts
npm run check
npm run build
npm run test:e2e -- --config e2e/local-equipment/playwright.config.ts
```

The offline browser fixture needs the local production build's CSS. Supply only synthetic process-scoped configuration for that build; never load real credentials or run the default hosted E2E configuration under this task's scope.
