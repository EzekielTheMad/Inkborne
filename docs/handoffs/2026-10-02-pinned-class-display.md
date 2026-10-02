# Saved class display against pinned snapshots

> Historical milestone record. Counts/status describe this checkpoint. Use [CURRENT-STATE](../CURRENT-STATE.md) and the [release checklist](../RELEASE-READINESS.md) for current authority.

The class builder previously read catalog classes, subclasses and features even when existing authorized snapshots were pinned. The actual level rail therefore changed names, hit dice, level features and choice definitions when the catalog changed; removing a catalog class could hide its saved rail.

ClassStepClient now overlays selected class/subclass definitions and their referenced feature slugs with unique matching pinned snapshots. New selection previews remain catalog-based. A missing catalog entry does not hide a valid pin. Multiple matching pins are not arbitrarily chosen; editing and stat preview are withheld with a visible error. Missing/incompatible selected subclasses are also identified. No pin is inserted, upgraded, repaired or removed by display resolution.

## Local evidence

- Three real-control regressions failed against the prior implementation: newer catalog definitions won, removed catalog classes disappeared and duplicate pins were not identified.
- Targeted class/choice tests: 17 passed, including canonical ASI regression coverage, pinned feature rendering, removed class, conflicting class snapshots, pinned subclass parent retention and incompatible subclass rejection.
- `npm.cmd run check`: strict types, zero-warning lint, 203 files / 1,902 tests passed.
- `node scripts/verify-builder-local.mjs`: six installed-Chrome checks passed. The new desktop check displays pinned class/feature names against a newer catalog. Requests stayed on loopback; no page errors or hosted writes. Persistence/history remain simulated. Evidence under `test-results/builder-local/`.

## Critical review and limits

This is display/reference precedence, not transaction safety or complete readiness. When a selected definition or referenced feature has no pin, existing catalog fallback remains; it is not proof that the missing pin was saved. Unselected feature options remain current catalog choices. Fighting-style option snapshots, missing/stale extra references and required choice readiness need separate validation. Existing effect aggregation still consumes saved refs; this repair does not reconcile extra mechanical effects. Choice/ref writes remain separate for class changes; pending full-choice concurrency, partial reference completion and ambiguous responses are unresolved. The durable equipment proposal remains unimplemented and requires separate schema/hosted approval.
