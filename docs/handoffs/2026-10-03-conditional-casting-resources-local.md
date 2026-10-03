# Conditional casting, slots and resources: final local checkpoint

October 3, 2026. Branch `codex/playable-core-stability`; parent checkpoint `a46dd714e0f4100ea3b4e72f294a9dd2d8f96c15`. Final response supplies this checkpoint's commit. **Not release-ready.**

## Authorized result

This final milestone is local-only and deliberately bounded to casting, manual spell slots and manual feature-resource counters. It reuses the already approved owner conditional endpoint. No hosted calls, new fixtures, schema/grant changes, installs, credentials, other-worktree changes or publication. All eight prior fixtures remain cleaned; the existing allowance remains exhausted. Builder, campaign, narrative and LegendKeeper integration remain intact.

`castSpell` explicitly opts its existing settled-state action into conditional persistence. Slot spend, concentration replacement and linked effects remain one patch against the separate raw confirmed snapshot; no display defaults enter the comparison. Instantaneous cantrip/ritual no-ops remain write-free; lasting cantrip effects use the conditional route. Roll requests are offered only after successful casting; choosing an optional roll remains a separate operation.

`useResources.setUsed`, `spend` and `restore` now return an awaited promise. All three gate before computing, rebuild the map from settled state, preserve unrelated resource entries, clamp to the existing limits and skip no-op writes. Widget and Features-tab card callers both return the promise to their shared counter. The counter prevents repeated clicks while pending and renders errors, including a callback resolving false. Finite-value validation avoids an invalid numeric write.

Manual slot dots explicitly opt their state-only action into conditional saving and rebuild the nested map after the settled gate. They await settlement, disable while pending and display failures. No generic rerouting of other state callers was introduced.

Casting, slot and resource surfaces preserve typed conflict/missing/unconfirmed errors through the existing retained-Activity action hook. No legacy fallback, automatic retry or replay. The existing sticky reload boundary and queue-drain behavior remain. Independent absolute notes edits survive failures, including queued drafts. Explicit reload reads current persisted state before a newly chosen action. Snapshot CAS is still not a durable receipt or an event revision.

## Validation and evidence

- `npm run check`: types and lint passed; **214 files / 2,079 tests passed** (50.61s test phase).
- Prior focused caller suite: 67 tests passed. New provider/RPC suite initially passed 15 tests; final full suite includes expanded hidden uncertainty coverage for all three manual surfaces and the resolved-false callback case.
- `npm run build`: final production build passed, using process-local localhost Supabase placeholders only.
- `node scripts/verify-casting-resources-local.mjs`: nine installed-Chrome checks passed with actual provider, dispatcher, CastDialog, SlotTracker, ResourcesWidget and FeaturesTab. The conditional endpoint is simulated locally; remote requests blocked, no page errors or remote requests.
- Existing `verify-play-save-local.mjs` and `verify-short-rest-local.mjs` passed all seven and six checks respectively. **22 isolated Chrome checks passed** across the three scripts. The corrected new browser script also passed targeted lint.
- Independent read-only review found no production or caller-coverage blocker. Its resolved-false API suggestion was implemented and tested.

Tests cover raw snapshots and combined concentration/effect replacement; instantaneous no-op versus lasting cantrip; set/spend/restore and map preservation; pending/stale rejection; conflict, missing, malformed and transport outcomes; independent notes; two independent providers; retained Activity success/conflict/committed response loss; actual manual widget/card/slot callers; and no replay. Browser evidence adds real local history Back, mobile drawer behavior, two pages and the actual Reload button. It does not prove real Next route retention or hosted casting/resource acceptance.

One initial file read needed explicit UTF-8 and was corrected; no unrelated content change. The first Chrome run used the desktop Close locator for a mobile drawer; it was corrected to the actual Cancel button and rerun. Reload waits explicitly for document navigation. No failed run consumed a hosted fixture.

Logs in Temp: `inkborne-casting-resources-{check,build,browser,existing-browser,rest-browser}.txt`. Ignored browser evidence is in `test-results/casting-resources-local/evidence.json` and two mobile recovery screenshots. Copies are preserved in task-5 as `inkborne-casting-resources-{evidence,existing-browser-evidence,rest-browser-evidence}.json` and the two `inkborne-casting-resources-cast-*-mobile.png` screenshots. No hosted journal or prior evidence was reset.

## Consolidated remaining-writer inventory

This is a local production-caller and checked-in SQL inventory, not a fresh hosted catalog or external-client audit.

| Caller / operation | Current route and contract | Remaining boundary |
| --- | --- | --- |
| HPTracker damage/heal/temp HP; provider `patchActionState` HP actions | Conditional raw-state save; relative actions gated. Prior milestone. | Hosted eighth evidence covers bounded HP flow, not arbitrary histories. |
| `useRest.shortRest`, including Arcane Recovery | Explicit settled-state conditional save. Prior local milestone. | No hosted recovery acceptance. |
| `useRest.longRest` | Conditional because patch contains HP; settled action gate. | Generic dialog retry wording still flattens typed error; no hosted broad rest acceptance. |
| `castSpell` -> CastDialog | Explicit conditional slot/concentration/effect patch. Converted here. | Optional post-cast rolls remain separate; complete casting-rule correctness unaccepted. |
| SlotTracker available/used dots, including pact row | Explicit conditional settled map update. Converted here. | Local caller evidence only. |
| `useResources.setUsed`, `spend`, `restore` | Explicit conditional settled map update. Converted here. | Local caller evidence only. |
| ResourcesWidget -> ResourceCounter; FeaturesTab -> ResourceCounter | Both await guarded `setUsed`, with pending/errors. Converted here. | Other resources' rules/content remain unaccepted. |
| Provider `setConcentration` set/drop and `resolveConcentrationCheck("drop")` | Legacy unconditional state patch. | Manual drop is a future state-only candidate; rolled prompt also has separate roll persistence. |
| Provider `applyEffect`, `removeEffect`, `addCustomEffect` -> ActiveEffectsWidget | Legacy unconditional nested array patch. | Future caller-specific settled-state/CAS integration needed. Existing editor recovery is not cross-client safety. |
| Conditions add/remove; exhaustion +/-; `useRest.setExhaustion` | Legacy unconditional patches. | Relative counters/arrays need settled computation and caller tests. |
| CharacterShell inspiration toggle | Legacy unconditional relative boolean. | Future state-only action candidate. |
| SheetPanel and MobileSheet activation toggles | Legacy unconditional dynamic state keys. | Audit known mechanical keys and test each caller before conversion. |
| DeathSaves manual success/failure pips | Legacy unconditional nested map. | State-only candidate with settled gate. |
| DeathSaves rolled result; natural 20 revival | Ordinary result legacy; natural 20 HP patch conditional. | Roll is already logged separately; CAS alone cannot make roll plus state atomic. |
| `useRest.spendHitDie` | Conditional gated HP/die state patch, prior milestone. | Roll insertion precedes the save. Conflict/response loss can leave unmatched roll/state; generic dialog wording persists. |
| ConcentrationPrompt rolled CON save | Roll append followed by keep/drop; drop state legacy. | Separate roll/state transaction/receipt needed. Manual Keep only clears local prompt. |
| `useInventory.setCurrency` manual currency | Legacy unconditional currency map. | State-only candidate; distinguish from equipment grants. |
| QuickNotes autosave/explicit save; NotesTab autosave/explicit save | Deliberate legacy independent absolute edits, preserved. | Same-field cross-client last-writer overwrite remains. |
| CharacterShell first-arrival `seen_sheet_first_time` | Legacy idempotent absolute flag. | Low-impact compatibility path. |
| Builder starting-equipment confirmation direct `updateCharacterState(currency)` | Legacy currency update between inventory inserts and choices confirmation. | Separate atomic/idempotent grant operation; not safe to convert only the currency call. |
| `patch_character_state(uuid,jsonb)` compatibility endpoint | Still available and unchanged; shallow merge, no expected snapshot. | Older callers/clients can overwrite after guarded writes. Retirement/rollout is separate approval. |
| Server `updateCharacter` helper permits whole `state` replacement | Direct update capability; no active production state caller found. Browser helper excludes state. | Latent bypass to narrow/audit separately; no claim about external consumers. |
| Character create/copy/import initial state | Initializes a new row; not a current-character patch caller. | Separate existing creation/copy contracts. |
| Inventory add/update/delete and armor unequip/equip | Separate child-row operations; armor switch uses multiple writes. | Exclusive equip/grant atomicity remains separate. |
| Standalone `roll` / `insertRoll` | Append operation with fire-and-forget persistence. | Not converted and not claimed atomic with gameplay state. |

## Next approval boundaries

Stop at this clean reviewed local checkpoint. No further hosted fixture is authorized; renewed bounded scope is required before hosted acceptance, and the exhausted eight-attempt runner must not be reset or bypassed. Deployment/publication and a coordinated legacy-writer rollout or endpoint-retirement decision remain separate approvals.

The smallest remaining state-only slice is manual concentration/effect editing, with actual badge/editor callers and retained failure drafts tested. Do not fold rolled concentration checks into that safety claim. Conditions, manual death saves, inspiration, activation toggles and manual currency remain additional bounded slices, not silently converted here.

A durable roll action would need one owner-authorized transaction that verifies the expected baseline, records an idempotent action identity/result, inserts its roll and applies its state patch together. A durable equipment grant would similarly encompass selected choices, item grants and currency once. Exact schema/endpoints and hosted tests require new approval; no implementation or schema change was attempted.

Legacy writers, ABA, changed derived inputs outside state, ambiguous durable outcomes, broader rules/content/auth acceptance and roll/equipment atomicity remain unresolved. **Do not publish.**
