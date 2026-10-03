# Conditional short-rest recovery: local checkpoint

October 3, 2026. Branch `codex/playable-core-stability`; parent checkpoint `a50a1e8c265f968e65cf60499e4613753cbb33a0`. The final response supplies this checkpoint's commit. **Not release-ready.**

## Scope and authority

Parent authorized this local-only short-rest/Arcane Recovery milestone after the remaining-writer inventory. Reuse the already approved conditional endpoint; no further hosted calls, fixtures, schema or grant changes. All eight prior fixtures remain cleaned and the allowance remains exhausted. No installs, other-worktree edits, secrets, remote push, merge, publication or deployment.

Existing builder, campaign, narrative and LegendKeeper integration remain intact. This is a bounded recovery consistency fix, not an expansion of product goals.

## Result

Short rests explicitly opt into conditional persistence even when the patch contains only `spell_slots_used` and/or `feature_uses`. The provider supplies its separately tracked raw confirmed state to the approved `patch_character_state_if_current` endpoint. Display defaults are not added to the comparison. Other non-HP callers retain their previous persistence path.

The existing state writer carries a small per-action `requireCurrent` option. It still gates pending/stale renders before computation. Short-rest effects, Arcane Recovery availability and pick validation now compute after that gate from settled state. Slots and feature use/reset changes remain one state patch. A no-op rest neither writes nor reports success.

Applied results advance the raw baseline and publish canonical saved state. Conflict, missing and unconfirmed outcomes retain the existing sticky reload boundary: no fallback RPC, retry or automatic replay. Independent absolute notes edits remain eligible, including ones queued behind a failed rest; Reload remains disabled until their queue drains.

Conditional save messages now refer to a character/action rather than only HP. Short rest preserves the typed reload error through the existing dialog action hook, including a hidden retained Activity session. The dialog keeps its selected recovery draft on failure and tells the user to reload instead of suggesting a blind retry. A confirmed hidden rest closes once on reveal. Existing dialog generations and destruction behavior remain unchanged.

Long-rest and hit-die dialog handlers still flatten their errors into generic retry guidance. That pre-existing UX limitation is outside this short-rest propagation milestone; do not claim all rest/roll dialog errors were fixed.

## Local validation

- `npx vitest run tests/lib/character/conditional-short-rest.test.tsx tests/lib/character/character-context.test.tsx tests/lib/character/state-writer.test.ts tests/sheet/update-state.test.ts tests/components/sheet/rest-dialog.test.tsx`: 84 tests passed before full checking.
- `npm run check`: types and lint passed; all **213 files / 2,060 tests passed** (49.85s test phase).
- `npm run build`: production build passed with process-local localhost Supabase placeholders; no hosted configuration loaded.
- `node scripts/verify-short-rest-local.mjs`: six installed-Chrome checks using actual provider, update-state dispatcher and rest dialog, with a simulated conditional endpoint, real local history Back and retained React Activity. Remote requests blocked; no page errors or remote requests.
- `node scripts/verify-play-save-local.mjs`: all seven existing actual-provider/retained-dialog Chrome regressions passed because the shared action hook changed. Thirteen local Chrome checks passed across the two scripts.
- Independent read-only review found no code/coverage blockers. Its teardown suggestion was applied so the local HTTP server closes even if browser closure fails.

The new provider tests cover full-HP resource recovery without any HP patch, exact raw snapshots versus defaults, no-op, pending/stale rejection before pick validation, one combined Arcane Recovery save, competing independent providers, conflict/uncertain reload boundaries, independent notes and queue drain, and actual dialog hide -> settle -> reveal with success/conflict/uncertainty. The Chrome checks add two pages, the actual Reload button, mobile 390x844, and simulated commit followed by response loss: explicit reload reads the result without replaying the rest.

Initial focused tests had two incorrect Testing Library locators; corrected before green. Full checking then found a static-component and render-mutation lint issue in the new test fixture; fixed by a module-level probe and effect-based hook capture. Initial browser execution found an assertion racing document replacement after Reload; the wait now tolerates the replacement window. These were harness failures, not hosted acceptance runs.

Logs in Temp: `inkborne-short-rest-check.txt`, `inkborne-short-rest-build.txt`, `inkborne-short-rest-browser.txt`, `inkborne-short-rest-existing-browser.txt`. Ignored local evidence: `test-results/short-rest-local/evidence.json`, two mobile recovery screenshots, and `test-results/play-save-local/evidence.json`. Preserve evidence copies in the task-5 workspace; no hosted journal reset.

## Remaining writers and next acceptance boundary

State-only unconditional candidates remain: casts, manual slot/resource edits, conditions/exhaustion, concentration/effects, inspiration, death-save pips, activation toggles and manual currency. Relative/map edits need settled-state computation as well as raw-state comparison. Notes retain deliberate independent absolute editing; same-field concurrent notes overwrite is unresolved. The first-arrival flag is idempotent. The server character-update helper permits a whole-state replacement but no active production state caller was found in the local inventory.

Starting equipment still combines inventory inserts, currency and choices confirmation; armor equip/unequip uses separate child-row writes. Rolled death saves, concentration checks and hit dice log rolls separately before their state change. Those need separately approved atomic/idempotent operations; merely switching a state call cannot make the full action durable. Standalone roll append and post-cast optional rolls are different operations.

This milestone has **no hosted short-rest acceptance** and makes no claim about real Next route retention. The eighth-run endpoint/HP acceptance remains historical supporting evidence for the approved function, not a new recovery test. Further hosted fixtures require renewed explicit scope; the exhausted eight-attempt runner must not be reset or bypassed. Coordinated writer rollout, old-client handling and production publication require separate approval. No schema/grant change is needed to review this local milestone.

Legacy callers can still overwrite a guarded result later; snapshot equality does not detect ABA or changed derived inputs outside character state. Durable receipts, cross-client breadth, complete rules/content/auth acceptance and roll/equipment atomicity remain open. Stop at this clean checkpoint; do not publish.
