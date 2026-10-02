# Fast continuation checkpoint

Resume branch `codex/playable-core-stability` at:

`C:\Users\kaios\Documents\Codex\2026-10-02\task\inkborne-core`

The final response supplies the exact committed HEAD. Resolve this branch's HEAD; do not resume from the independently reviewed older snapshot `12db70b`. This worker stops after the clean checkpoint and will not start another milestone. The parent intends to create the next task with Fast requested; this worker cannot change its current execution mode.

## What this final bounded milestone changes

1. Ability progress now requires a valid base score for every ability in the actual system schema, a supported/allowed selected method, and the existing editor's manual, standard-array or point-buy constraints. Missing schema does not earn Complete. Editor and readiness share the existing array/cost constants; racial/ASI bonuses are not treated as base scores. Overview and navigation agree for a saved partial map. This is saved-data validation, not a promise that a pending request succeeded or that the entire character is playable.
2. Race/subrace display and direct choice effects now prefer the already authorized pinned snapshots over current catalog entries. Removed catalog entries do not hide an existing pin. A selected subrace belonging to another race is visibly identified. Multiple matching saved snapshots are not arbitrarily selected and editing is disabled. Nothing upgrades, repairs, deletes or rewrites a pin automatically.

Before these changes the accumulated branch had nine commits and 66 files: production code 31 files, +657/-335 lines; tests 14 files, +997/-39; docs 20 files, +838/-2; one local verification script +135. This follow-up intentionally avoids a generalized command framework, transactions, new storage or new authentication paths. Review the logical ability-readiness and pinned-display commits separately before integration.

## Exact independent review findings: next priority

These were supplied by an independent read-only reviewer of committed snapshot `12db70b`. The current worker has not fixed them or independently rerun the reviewer's in-memory HP reproduction. They remain release blockers despite the passing existing suite.

### P1: dependent relative HP work can retain failed damage

Affected files: `lib/character/state-writer.ts`, `lib/character/character-context.tsx` (`spendHitDie`), and callers of relative HP patches.

Reviewer reproduction: start at 10/20 HP; queue damage 5, producing optimistic HP 5; spend a hit die healing 3 while damage is pending, producing an absolute HP patch of 8 plus a die spend; fail damage and succeed healing. The writer persists HP **8**, not the recomputed **13**, and spends the die. Nested-object invalidation does not recognize this dependent numeric HP patch. The existing later-HP writer test treats the number as an independent absolute value and misses the UI dependency.

Next acceptance: reproduce through the actual provider/UI with deterministic rolls and delayed persistence, then gate or recompute relative HP actions against confirmed state. A rejected/gated action must not roll/spend a hit die or silently report healing; a safely recomputed accepted action must yield the correct HP and die count. Preserve independent absolute edits and the existing failed-first/second-cast gate. Audit damage/heal/rest/hit-die interactions rather than applying generic numeric subtraction to arbitrary state keys.

### P2: retained cast/rest dialogs can remain stuck saving

Affected files: `lib/character/use-dialog-action.ts`, cast/rest dialogs and Activity interaction tests.

Reviewer scenario: keep a cast/rest dialog open; start its action; hide the route through React Activity; let the request finish while hidden; return through Back. `useDialogAction` clears its busy ref but skips clearing pending while inactive. On effect resume it has no pending reconciliation, so the retained dialog can remain “saving.” Existing reopen tests destroy the session through `open=false`; they do not cover retained Activity state. A further completion after reactivation needs session/generation protection as well.

Next acceptance: add actual dialog Activity hide/finish/reveal and hide/reveal/late-finish regressions for cast, rest and relevant hit-die work. Reconcile retained pending state without falsely cancelling or automatically repeating a potentially accepted save. Ignore stale dialog outcomes and preserve explicit recovery/dismissal behavior. Use the ability writer's Activity regression as a test pattern, not as a blind drop-in persistence policy.

## Builder synchronization/readiness still incomplete

- Race/class selections still issue separate choice/ref writes. A choice update can succeed before a pin insert fails, and rollback of local UI does not undo that persisted choice. Class actions and background subchoices can overwrite complete `choices` snapshots concurrently. Current race display prefers valid matching pins but does not repair missing, wrong-slug or stale extra references.
- The overview still treats selected race/class/background identities as complete without validating exact corresponding pins or every required subchoice. Class display/features still need a pinned-version audit. Race trait lookups continue to use catalog traits; this milestone covers the race/subrace definition's direct data/effects, not independent trait version provenance.
- Ability readiness is stricter, but subclass/feature choices, ASI readiness and full system-specific playable readiness remain unverified. No hard navigation gate has been imposed. Saved readiness must remain distinct from pending, failed or ambiguous persistence.
- Equipment confirmation still allows pending selection saves and separate item/currency/confirmation writes. Partial completion and repeated confirmation can duplicate grants; low-level confirmation errors and console-only selection recovery remain. Existing stale/wrong-category selection validation is a separate repair. The atomicity proposal requires schema/migration reconciliation and separate authorization; do not imply it is implemented.
- No universal cross-tab reconciliation, ambiguous-response resolution or create idempotency exists. Passing local tests do not establish release readiness.

## Verified evidence and safe execution

- Final `npm.cmd run check`: strict TypeScript and zero-warning lint; **1,887 tests across 203 files** passed.
- Final `npm.cmd run build`: Next 16.2.10 compile, TypeScript and 24 static pages passed. Loopback Supabase placeholders were used; font downloads were permitted. Reused matching dependencies, no install.
- `node scripts/verify-builder-local.mjs`: **five** installed-Chrome fixture checks passed, including pinned race data/choice display against a newer catalog version. Screenshot `test-results/builder-local/pinned-race-mobile.png` was visually inspected. Other evidence: `test-results/builder-local/evidence.json` and prior navigation/mobile error screenshots.
- Browser routing/persistence are simulated; real components are bundled with boundary mocks. This is not a running Next/auth/RLS/backend end-to-end journey. All browser requests stayed on the random loopback server; no page errors or remote requests were observed. The script closes its owned browser/server. Hosted Playwright setup/teardown remain prohibited because they write Supabase.
- Filesystem restrictions require scoped authorized execution for local commits (linked Git metadata), build font access and the isolated browser fixture's esbuild traversal. No automatic-review rejection occurred. Do not install missing software or invent credentials.

Only local scoped source changes, tests/builds and local commits are authorized. No push, merge, deployment, schema migration, hosted writes, memory writes, dependency installation or cleanup of original worktrees. Preserve the alpha candidate and unrelated repositories. End new work before the parent's 18:00 UTC boundary.
