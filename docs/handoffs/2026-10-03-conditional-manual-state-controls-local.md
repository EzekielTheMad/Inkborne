# Conditional manual state controls: local checkpoint

October 3, 2026. Branch `codex/playable-core-stability`; parent checkpoint `da132510f54d85ee2f2c25a790fa7b6205aa81c7`. Final response supplies the new commit. **Not release-ready.**

## Result and authority

Victor's continued local-development authority covers these remaining manual state-only callers. Conditions, exhaustion, inspiration, activation toggles, manual death-save pips, effects, manual concentration and manual currency now explicitly use the existing owner conditional endpoint. No hosted calls, fixtures, schema/grant changes, installs, credential changes, other-worktree changes or publication occurred. All eight previous hosted fixtures remain cleaned; no attempts remain. Builder, campaign, narrative and LegendKeeper integration remain intact.

`patchConditionalState` routes a props-derived manual patch through the provider's existing settled-state action gate and raw confirmed snapshot comparison. A stale render or pending dependent write is rejected before persistence. Effects, custom effect IDs, concentration removal and public exhaustion/currency hooks compute after the gate. Linked effects and concentration metadata change together in one patch. There is no automatic replay or legacy fallback. Independent absolute notes keep their existing queue behavior.

Actual desktop and mobile callers await completion, disable while pending and show readable typed conflict or uncertain-save errors through the retained-Activity helper. Manual concentration Drop in the prompt is separately guarded; Keep only dismisses the local prompt. Rolled CON results retain their existing separate persistence path. Long-rest and hit-die dialogs now preserve typed reload guidance instead of offering a misleading ordinary retry after uncertainty.

Manual currency now uses an explicit editable draft with Save and Discard. Keystrokes do not write. A failed save preserves the draft; if another same-session denomination edit confirms, Save refuses the old draft until explicitly discarded and reviewed. Equipment confirmation remains a separate multi-write operation and was not converted piecemeal.

## Validation

- `npm run check`: types, zero-warning lint, **215 files / 2,104 tests passed** (50.89s test phase).
- `npm run build`: production build passed, 24 static pages, process-local localhost placeholders only.
- `node scripts/verify-state-controls-local.mjs`: **18 installed-Chrome checks passed**, actual provider/dispatcher, responsive CharacterShell/SheetPanel/MobileSheet controls, two competing shells, retained React Activity hide/settle/history Back, typed conflict and committed-response-loss recovery, independent notes, currency/effect draft retention, explicit Reload and no replay. No page errors or remote attempts.
- Existing play-save, short-rest and casting/resource Chrome scripts passed seven, six and nine checks respectively. All four scripts passed **40 isolated Chrome checks** after the completed production build.
- New actual-provider suite has 25 tests. It covers all eight manual surfaces, raw snapshots without display defaults, linked effect/concentration removal, both responsive callers, pending/stale closure rejection, exhaustion clamping, currency draft conflicts, hidden settlement and typed rest failures. Manual controls do not append rolls; the separate hit-die test records one roll and explicitly makes no transaction claim.
- Independent read-only critical review found no remaining blockers; same-render/settled gating, linked-map recomputation and currency draft handling reviewed.

The prior browser rerun initially overlapped the build replacing `.next/static/chunks`, so those checks stopped before app loading. They were rerun after the completed build. The new browser harness first used the mobile inspiration label for desktop. Correcting that test locator yielded all 18 passes; no hosted fixture was consumed. These browser checks load production CSS with a local endpoint model and simulated routing. They do not establish real Next route retention, live endpoint acceptance for these callers, complete rule correctness or release readiness.

Evidence: `test-results/state-controls-local/evidence.json`, desktop/mobile control screenshots and mobile custom-effect draft screenshot. Logs in Temp use `inkborne-state-controls-*`; copies of current evidence are preserved in task-5. Prior evidence and hosted journals are unchanged.

## Current writer inventory

This supersedes the prior casting/resource handoff's remaining-writer table. It audits local production callers and checked-in SQL, not external clients or a fresh hosted catalog.

| Caller | Current contract | Remaining boundary |
| --- | --- | --- |
| HP damage/heal/temp HP; short rest/Arcane Recovery; long rest | Settled gate, conditional raw-state save | Prior bounded HP hosted evidence; broad rest acceptance still pending |
| CastDialog casting; manual slot dots; resource widget and feature card | Explicit settled conditional save, awaited UI recovery | Optional rolls separate; local casting/resource acceptance only |
| Conditions and exhaustion +/-; public exhaustion setter | Explicit conditional settled gate; finite clamp for setter | Local caller evidence only |
| Inspiration; desktop/mobile activation toggles | Explicit conditional settled gate; pending/errors | Local caller evidence only |
| Manual death-save pips | Separate manual conditional callback; nested counts preserved | Rolled outcomes remain separate |
| Effect apply/remove/custom creation | Compute after gate; linked concentration/effects one conditional patch | Local editor drafts and recovery proven only |
| Concentration badge and manual prompt Drop; public concentration setter | Guarded set/drop; manual prompt clears after success | Rolled prompt Drop remains legacy |
| Manual currency tracker/public currency setter | Explicit draft save, guarded snapshot; stale draft refusal | Equipment currency deliberately separate |
| QuickNotes and NotesTab | Deliberate independent absolute legacy edits | Same-field cross-client overwrite remains |
| First-arrival seen flag | Legacy idempotent absolute flag | Low-impact compatibility path |
| Rolled death save, concentration CON outcome, hit die | Roll insertion and state save remain separate; HP paths conditional | Durable roll/state transaction and receipt needed |
| Starting equipment confirmation | Legacy inventory inserts, currency update, choice confirmation | Durable atomic/idempotent grant needed |
| Inventory mutations and armor switch | Separate child-row writes | Exclusive equip/grant atomicity separate |
| Old `patch_character_state`, direct owner RLS access | Available and unchanged | Old/direct clients may bypass conditional protection |
| Server whole-state `updateCharacter` helper | Latent direct replacement; no active production state caller found | Narrow/audit separately before coordinated rollout |
| Create/copy/import | New-row initialization | Separate contracts |

## Next decision and approval boundary

All identified active manual state-only sheet paths are now converted locally. Further work on durable rolled actions or equipment grants changes the persistence contract and needs separate schema/endpoint approval. The minimal durable action design is one owner-authorized transaction that verifies an expected baseline, records an idempotent action identity/result, inserts the roll and applies state together. The equipment operation similarly includes selected choices, item grants and currency once. Existing proposals in `docs/specs/2026-10-02-durable-character-actions-proposal.md` and `docs/specs/2026-10-02-equipment-atomicity-proposal.md` remain unimplemented.

New bounded hosted acceptance requires renewed approval; do not reset or bypass the exhausted eight-attempt run. Coordinated handling of old/direct writers, production publication, ABA/derived-input limitations and durable ambiguous outcomes remain separate decisions. No broad framework or speculative feature was added. **Do not publish.**
