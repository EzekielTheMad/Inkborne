# R06.1 race-score reproduction and plan handoff

Source/plan checkpoint **`7403cb01db06ad61101f6532ca7b7b4602934b1c`**, branch `codex/r06-race-parity`, base `1cf00caf45adb0ed3a439cf0db5b2928d370701a`. Isolated workspace `C:\Users\kaios\Documents\Codex\2026-10-11\task-2\r06-race-parity-worker`. Scope is three new test/fixture files and [the independently challengeable plan](../specs/2026-10-11-r06-race-score-parity-plan.md), plus this handoff. **No product fix is implemented.**

## Findings and evidence boundary

- An entirely original synthetic ApiRace goes through actual `transformRaceEntry`, canonical definition and immutable-snapshot parsers. The transformer already emits both six-slot `scores` and additive ability effects without running enrichment SQL. Original base STR10/CON12 plus fixture bonuses +2/+2 should be STR12/CON14; live structured evaluation is **STR14/CON16**, while actual Race/Class previews and Abilities totals/sidebar show12/14.
- Unambiguous scores-only live12/14 contrasts with actual Race/Class/Abilities sidebar10/12; effects-only agrees12/14 everywhere. Actual ClassStepClient and ClassStepRail are real: only unselected Barbarian STR13 remains locked on preview-resolved12, whereas doubled live14 passes the actual prerequisite helper.
- Real max-HP helper with three d8 levels gives once-only CON14/maxHP24 versus doubled CON16/maxHP27. Separate baseline/live temporary Constitution controls preserve their distinct inputs; provider/character-page workflows are statically traced, not exercised.
- Identical numeric manual effects, separate feature effects, conditional effects and formulas retain their independent intent. The conditional evaluator follows actual state. Abilities currently hides all extra ability effects on a scores-bearing race, and its effects-only fallback counts an inactive conditional bonus. Raw equality therefore cannot identify safe duplicates.
- A supplied v1 immutable snapshot remains unchanged when a synthetic v2 once-only definition is parsed. This establishes pure version isolation, not PostgreSQL triggers, repinning or hosted snapshot provenance. The actual subrace transformer/snapshot parser supplies the collector exclusion control; no fake race-shaped subrace row is used.
- SQL helper comparison is **static only**: it prefers six-slot race/subrace scores, excludes all additive effects on those refs, and does not evaluate other refs' conditional/formula semantics. No database/runtime acceptance is claimed. The separate string-size-to-zero observation is reproduced but not fixed.

Navigation, persistence calls and the ability draft hook are mocked boundaries; actual Race/Abilities/Class clients, StatPreview, ClassStepRail, source collector, evaluator, prerequisite and HP helpers are not mocked. These are jsdom component calculations, not browser/auth/save/concurrency acceptance. Source provenance is proven for the synthetic call chain only; `source=srd` and equal numbers do not authenticate arbitrary legacy rows.

## Commands and results

After root released the slot, serialized install/test/typecheck/lint with R21/R03 siblings:

```text
npm.cmd ci --ignore-scripts
npm.cmd test -- --maxWorkers=2 tests/lib/engine/r06-race-parity-reproduction.test.ts tests/components/builder/r06-race-consumer-reproduction.test.tsx
npm.cmd run typecheck
npm.cmd run lint
git diff --cached --check
```

Locked install: 800 packages in35 seconds; no package/lockfile edits. Final focused run **2 files / 24 tests passed**, 3.28 seconds. Typecheck and zero-warning lint passed; whitespace check passed. These are characterization assertions of observed mismatches, explicitly distinguished from intended mechanics. There were no failing test commands or hidden failures. They must be converted to desired-contract outcomes when the approved product repair changes behavior, preserving manual-effect controls.

No server/watcher/browser was started; no task listening port exists. All task-owned npm/Node checks completed; exact worker-path Node inspection found no remaining command. No process in another worktree was stopped. No full check/build/browser, environment files, credentials, hosted actions, SQL or dependency mutation occurred. Root owns independent exact-SHA plan challenge and later combined gates.

## Pending decisions before fixes

Recommended new mechanical representation: effects-only importer output. An explicit canonical parsed per-version mode can distinguish effects metadata from scores contributions where dual data is deliberately needed; it is a semantic declaration, not unforgeable provenance/authority. A source-aware resolver should feed one contribution list to all affected consumers and retain manual effect order/state/formulas, first-race precedence and baseline/live HP boundaries.

The plan deliberately preserves existing unmarked dual-pin live arithmetic until an explicit historical compatibility decision, rather than silently lowering existing scores/maxHP. Verified current source-generated definitions can receive a reviewed new version; immutable old pins cannot be rewritten or automatically upgraded. Any later exact-snapshot compatibility map/owner repin workflow needs its own reviewed authorization and source evidence. Independent challenge must resolve new representation, dual-mode adoption and historical policy **before product edits**. Real SQL parity, browser workflows, subrace/source expansion, size/formula timing, dependencies and hosted acceptance remain separately bounded gates.
