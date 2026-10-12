# R06.2 explicit race representation: bounded local source handoff

Source **`e6513b2f9d9c6753338a5b9078bee74397b6617b`**, branch `codex/r06-race-parity`, isolated `C:\Users\kaios\Documents\Codex\2026-10-11\task-2\r06-race-parity-worker`. Approved R06.1 reproduction: `7403cb0` / `ac258f2`. Contract was frozen before product code at `bb9469e`; root's approved class casting-row correction `3ceeb59` was cherry-picked as `289dc44` without reverting any characterization work. That inherited correction is separate from the 19-file R06.2 source diff. Root's later ASI/subrace compatibility refinements are recorded in the plan and source.

## Behavior and compatibility

- Canonical optional `ability_score_representation: { version: 1, mode: 'effects' | 'scores' }` is strict and parsed. Scores mode requires a real six-slot array (zero array valid); effects mode treats optional scores as metadata. Unsupported/null/malformed/extra-field declarations fail canonical parsing and runtime resolution. Absence receives no inferred/persisted default and retains previous live arithmetic.
- The actual new transformer emits each original ability effect once, omits duplicated scores and declares effects intent. A small pure resolver supplies the first structured race's additions once inside evaluate. Every original independent effect/ref retains order and condition/formula semantics; there is no number matching, deduplication or subrace structured-score expansion.
- Race/Class/Abilities totals and StatPreview receive the same sources and saved state. Class prerequisites use those resolved stats. Historical undeclared dual race scores and effects remain additive; their previews now reflect that preserved live result. A shared notice in all three builders and the sheet explicitly says both are retained and overlapping intent is unspecified. New/explicit/unambiguous representations do not show that notice.
- Existing CharacterPage baseline evaluation, CharacterProvider live evaluation and durable model already call evaluate with the same source collector. They now share the resolver without changing provider/HP/receipt/CAS rules. Actual provider and durable regressions preserve baseline maxHP versus temporary live CON. Valid representation changes invalidate the durable dependency fingerprint; invalid declarations reject snapshots. No immutable snapshot, content version or character choice is rewritten or automatically repinned.
- Abilities no longer invents a per-source numeric total from blanket race/subrace scores preference. It displays evaluated content total and considered source names, preserving formulas and state gates. **R06.3:** original saved-ASI attribution/amount is still added separately to the builder total, with a visible label that Stats/live omit that separate addition. No ASI synthesis or saved-choice change.
- **R06.4:** a valid scores-only subrace extension supplied through the broad raw component contract retains its old display contribution separately with a visible live/sidebar omission label. This is **raw component compatibility**, not a verified hosted loss: actual canonical subrace parsing strips scores today and live collection excludes them. A parser-stripping control proves that distinction. Actual transformed subraces' ordinary ability effects remain unchanged. Raw dual subrace scores plus nonlinear effects are disclosed separately; no duplicate intent, nonlinear offset or data cleanup is guessed.

## Meaningful before/after evidence

R06.1's actual original transformer/immutable-pin reproduction had original base STR10/CON12 +2/+2 encoded twice: live14/16, actual builders12/14, three d8-level maxHP27 versus intended24. At the new source, actual imported pins are effects-only and evaluate/display12/14, with baseline maxHP24. Explicit effects mode with metadata scores is once-only; explicit scores mode preserves the scores additions **and all independently declared effects**, never erasing same-value entries.

Supplied frozen historical dual v1 remains live14/16/maxHP27; coherent builders now show14/16 with ambiguity notice. Parsing a once-only latest v2 does not mutate v1. Scores-only first-race pins now display the live12/14 rather than the prior missing10/12 sidebar. Same-value independent manual/feature effects stack; conditions change totals only at the supplied identical state; formulas remain evaluated in their existing order.

Adjacent controls are explicit: saved ASI +2 leaves an imported STR12 content/sidebar versus builder14, with original choices unchanged. A supplied scores-only subrace CHA+2 remains builder12 versus preview/live10, while canonical parsing strips that raw extension. An ordinary actual transformed subrace INT+1 stays11 in totals/sidebar. A raw dual child STR score+2 with `strength * 2` demonstrates prior score-preferred14 versus evaluated24; it is labelled unresolved rather than assigned guessed intent. These latter raw controls are not claims about current hosted pin data.

## Commands and results

Final commands, sequential in this independent installed workspace:

```text
npm.cmd test -- --maxWorkers=2 tests/schemas/race-ability-representation.test.ts tests/lib/engine/race-ability-scores.test.ts tests/lib/engine/r06-race-parity-reproduction.test.ts tests/components/builder/r06-race-consumer-reproduction.test.tsx tests/components/builder/race-ability-notice.test.tsx tests/lib/character/durable-hit-die.test.ts tests/lib/character/character-context.test.tsx tests/engine/evaluator.test.ts tests/engine/evaluator-conditions.test.ts tests/engine/evaluator-active-effects.test.ts tests/schemas/content-types.test.ts tests/transformers/races.test.ts tests/components/builder/abilities-step-client.test.tsx tests/character/max-hp.test.ts tests/app/class-step-client-feat-regressions.test.tsx
npm.cmd run typecheck
npm.cmd run lint
git diff --cached --check
```

**15 files / 262 tests passed** (15.32 seconds); typecheck, zero-warning lint and whitespace check passed. Earlier focused checkpoints also passed; the initial HP selector used a nonexistent `tests/lib/character/max-hp.test.ts` filter (13 actual files matched), then the correct `tests/character/max-hp.test.ts` was explicitly included in the final set. No failed command is hidden. R06.1's green characterization assertions were converted to the approved desired importer/consumer contract while retaining explicit frozen legacy fixtures and negative controls.

React review: direct imports, no state mirroring or new persistence effects, complete memo dependencies, accessible status notices, unchanged save/conflict/native controls and no new dependencies. Installed Next client-component docs were read before TSX edits. No server/watcher/browser started; all foreground checks exited and worker-path process inspection found no task Node process remaining. Other workers/processes were preserved.

## Pending gates and limits

Independent exact-source review is required before root integration. **Browser/full check/build held by root**, so current R06.2 real-browser and production styling acceptance is pending; prior race-authoring browser evidence is not evidence for this new calculation/UI source. Unit tests render real builder/StatPreview/ClassStepRail/provider and the real service-internal durable planner, with persistence/navigation/draft boundaries mocked. They do not prove Next auth/routing, save races, PostgreSQL RLS/CAS/trigger/receipt transactions or hosted gameplay.

SQL remains unchanged and **static comparison only**. The existing helper sums six-slot race/subrace scores and excludes ability effects from scored refs, ignores the new declaration, and does not evaluate the same conditional/formula subset. Legacy dual, explicit scores plus independent effects, effects-mode metadata scores, and raw subrace handling can therefore disagree with local calculation. No server prerequisite parity claim or automatic migration/backfill. Historical corrections/repin, general size/string/formula-timing issues, subrace schema/source expansion, R06.3 ASI, R06.4 subrace parity, SQL/runtime and hosted acceptance remain open.
