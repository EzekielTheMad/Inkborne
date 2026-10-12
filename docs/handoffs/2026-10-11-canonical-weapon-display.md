# R08.1 canonical weapon display and roll requests

Local branch `codex/r08-canonical-weapon-print`, based on `f84d39149f25176155481c85fb4a443a73dcbf09`. No context/provider, source/schema, dependency, permission, query, database or hosted configuration changes.

## Observed defect and failing-before evidence

The actual `weaponDataSchema` stores `damage: { dice, type }`, `range: { normal, long }`, `weapon_category` and `weapon_range`. `ActionsTab` cast damage/range to strings and called `range.includes`, while print discarded nested values and fabricated `1d4`. Both accepted either broad weapon proficiency category for every weapon.

Before implementation, original melee/ranged/finesse fixtures were constructed with **`weaponDataSchema.parse`**, then exercised through the actual `ActionsTab` and print model. On 2026-10-11 at 17:55:28 Phoenix, `npm.cmd test -- tests/components/sheet/actions-tab-canonical-weapons.test.tsx tests/lib/character/print-canonical-weapons.test.ts` produced **2 files / 6 failures**. All four ActionsTab cases threw **`TypeError: range.includes is not a function`** at `actions-tab.tsx:73`. The ranged print case returned **`Hit +7 | Damage 1d4 +4 | 5 ft`** instead of the pinned `1d8 piercing`, `120/480 ft`, DEX and no Martial proficiency. The missing-damage case also fabricated `1d4`.

## Result

`lib/sheet/weapon-attack.ts` now supplies a shared typed display and bounded attack formatter for ActionsTab and the print attack/inventory paths. It reads canonical nested fields and retains legitimate previous string display shapes. Explicit Melee/Ranged type controls STR/DEX; finesse chooses the stronger effective modifier. Matching Simple or Martial category and specific slug/`weapon_<slug>` grants add the evaluated proficiency bonus. Unknown category does not inherit either broad grant.

Missing or unparsable damage stays **Damage unavailable** and its damage-roll control is disabled; no replacement die is invented. Existing attack-to-damage crit arming and request metadata remain. Print inventory includes canonical base damage/type/range. The original martial print fixture now also uses the actual weapon schema.

This slice covers normal STR/DEX/finesse weapon attacks and display. It does not add ability overrides, monk substitutions, a versatile damage mode, ammunition spending or other special weapon rules. No new persistence or source mutation path exists.

## Local verification and limits

- `npm.cmd test -- tests/components/sheet/actions-tab-canonical-weapons.test.tsx tests/components/sheet/actions-tab-rolls.test.tsx tests/lib/character/print-canonical-weapons.test.ts tests/lib/sheet/weapon-attack.test.ts tests/lib/character/print-model.test.ts tests/components/sheet/character-print-action.test.tsx tests/components/character/character-page-client-print.test.tsx`: **7 files / 53 tests passed**. Covers parsed melee/ranged/finesse, category isolation, specific proficiency, effective modifier use, thrown Melee range behavior, unavailable damage, existing legacy crit/request behavior and paper parity.
- `npm.cmd run typecheck`: passed after correcting two new RTL tests that initially used Playwright's unsupported `exact` option.
- `npm.cmd run test:e2e -- --config e2e/print/weapon-playwright.config.ts`: **1 passed**, 1.9 seconds. Uses the actual ActionsTab and RollPopover, actual dice parser/roller with an injected deterministic fixture RNG, and actual print preview. Verifies natural 20 -> one `crit: true` `1d8+4` request -> normal next request, two dice then one die with the same +4 modifier, canonical printed inventory/range and disabled missing damage. Context/persistence are fixtures; **no persisted roll, hosted hydration or full-app Tailwind visual acceptance is claimed**. The isolated harness omits the app's compiled Tailwind stylesheet. Its ActionsTab and print screenshots were inspected.
- `npm.cmd run test:e2e -- --config e2e/print/playwright.config.ts`: **6 passed**, 8.1 seconds. Corrected canonical martial fixture; all six Letter/A4 PDFs were rendered with Poppler and all **33 pages** inspected through their contact sheets. PDF extraction verified complete list endings, margins, dimensions and absence of private/control sentinels. Fixtures establish renderer coverage, not complete game-rule parity.

Ignored artifacts remain in this worker's `test-results/canonical-weapon/` (ActionsTab/print screenshots, worker receipt) and `test-results/character-print/` (six PDFs, all page PNGs/contact sheets, verification and process receipts). No server or listening port started. Final receipt-based process check found no remaining task-owned worker or renderer.

Root owns independent review and the combined check/build on the integration candidate. The worker retains its older locked dependency set; final source is to be checked against root's patched Next 16.3.8. Live authorized character/RLS, native print dialogs, physical printers and release acceptance remain separate gates.
