# M3 — Gameplay Foundations: Implementation Plan

**Date:** 2026-07-15
**Design:** [`2026-07-15-m3-gameplay-foundations-design.md`](2026-07-15-m3-gameplay-foundations-design.md) — read it first; this plan does not restate rationale.
**Shape:** 9 tasks, each a single focused PR to `main` per the GAME-PLAN workflow (plain spec → feature branch → tests green → PR). Conventional-commit titles are suggested per task. `npx vitest run` must stay green at every merge; update the GAME-PLAN status log when a task lands or is abandoned.

**Dependency graph:**

```
T1 (dice engine) ──► T2 (roll log + UX) ──► T3 (sheet roll surfaces) ──► T7 (concentration)
                          │                                                ▲
                          ├──► T4 (hit dice) ──► T8 (arcane recovery)      │
                          │                          ▲                     │
                          └──► T5 (cast dialog) ─────┘                     │
T6 (effects/durations) ────────► (T5 consumes T6 helpers) ────────────────┘
                                                       T9 (UAT + docs) ◄── all
```

T6 has **no dependency on dice** and can proceed in parallel with T1–T3. T5 depends on T2 + T6. T7 depends on T3 + T5 + T6. T8 depends on T4 + T5. T9 is the milestone close-out.

Rough sizes: S ≈ ≤1 focused session, M ≈ 1–2 sessions, L ≈ 2–3 sessions.

---

## T1 — Dice engine core (`feat(dice): expression parser + roll engine`) — **M**

**Goal:** A pure, dependency-free dice library: parse dice expressions, execute rolls with an injectable RNG, support advantage/disadvantage and crit doubling, and produce the typed `RollResult` every later task consumes. No UI, no DB, no React.

**Depends on:** nothing. **Unblocks:** T2 (and transitively everything except T6).

**Files:**

| File | Action |
|---|---|
| `lib/dice/types.ts` | Create — `RollKind`, `RollMode`, `RollRequest`, `RollResult`, `DiceExpression`, `DiceParseError` (design §3.2–3.3) |
| `lib/dice/parser.ts` | Create — `parseDiceExpression(str): DiceExpression`; grammar: `NdM` terms, `+/-` chaining, integer modifiers, `kh`/`kl` keep suffixes |
| `lib/dice/roller.ts` | Create — `executeRoll(request, rng?): RollResult`; advantage/disadvantage rewrite of the leading d20 term; `crit` doubles dice counts only; `natural` extraction for d20-kind rolls |
| `tests/dice/parser.test.ts` | Create |
| `tests/dice/roller.test.ts` | Create |

**Test expectations:**
- Parser: `1d20+5`, `2d6+3`, `8d6`, `2d20kh1+7`, `4d6kl3`, bare `d20` (implicit count 1), whitespace tolerance; rejects `2x6`, `1d`, `1d20kh` (missing keep count), negative dice counts — each throws `DiceParseError` with a useful message.
- Roller (seeded RNG throughout): totals = kept dice + modifier; every face within `[1, sides]`; `kh`/`kl` keep the right subset and record dropped dice in `groups[].rolls` vs `groups[].kept`; `mode: "advantage"` on `1d20+5` produces two d20s keeping the higher; `crit: true` on `2d6+3` rolls 4d6 and adds 3 once; `natural` reports the kept d20 face and is absent for non-d20 rolls; determinism — same seed, same result.
- Full suite green (pure addition; nothing else touched).

---

## T2 — Roll log persistence + roll UX shell (`feat(rolls): character_rolls table, useRolls, toast + log panel`) — **L**

**Goal:** Rolls become visible and durable: `character_rolls` table with RLS, typed insert/fetch helpers, `useRolls()` in `CharacterContext`, the `RollToaster` transient stack, the Roll Log slide-over panel, and the d20 button in the character header. After this task any component can call `roll(request)` and the full toast → log → persist pipeline runs.

**Depends on:** T1. **Unblocks:** T3, T4, T5.

**Files:**

| File | Action |
|---|---|
| `supabase/migrations/00038_character_rolls.sql` | Create — table, `(character_id, rolled_at desc)` index, `kind` CHECK, owner SELECT/INSERT RLS, no UPDATE/DELETE policies (design §3.5) |
| `lib/supabase/database.types.ts` | Regenerate after migration |
| `lib/supabase/rolls.ts` | Create — `insertRoll(characterId, result)`, `getRecentRolls(characterId, limit=50)` |
| `lib/types/rolls.ts` | Create — `RollLogEntry` (DB row shape ↔ `RollResult`) |
| `lib/character/character-context.tsx` | Modify — `initialRolls` prop, session roll state, `useRolls()` hook (execute → append → fire-and-forget persist → toast trigger) |
| `components/sheet/rolls/roll-toaster.tsx` | Create — bottom-anchored transient stack, breakdown rendering, crit/fumble accents, pin-on-click |
| `components/sheet/rolls/roll-log-panel.tsx` | Create — slide-over (`components/ui/sheet.tsx`) / Vaul drawer on mobile, newest-first, kind badges, relative times |
| `components/sheet/rolls/roll-breakdown.tsx` | Create — shared dice-breakdown renderer used by toast + panel |
| `components/sheet/character-header.tsx` | Modify — d20 icon button opening the panel |
| `components/character/character-page-client.tsx` | Modify — thread `initialRolls`, mount `RollToaster` |
| `app/(app)/characters/[id]/page.tsx` | Modify — fetch recent rolls server-side |
| `tests/supabase/rolls.test.ts` | Create — mocked insert/fetch |
| `tests/components/sheet/roll-toaster.test.tsx` | Create |
| `tests/components/sheet/roll-log-panel.test.tsx` | Create |

**Test expectations:**
- `useRolls().roll()` returns the `RollResult` synchronously, appends to the session log, and calls `insertRoll` (mock asserts payload shape: kind/label/expression/result/total).
- Persist failure (mock rejects) logs to console and does not throw or block the toast.
- Toaster renders label/total/breakdown; auto-dismiss timer; pinned toast survives the timer.
- Panel renders hydrated + session rolls in order; empty state ("No rolls yet — click any modifier on the sheet").
- Migration applied to the Supabase project; RLS verified (second-user SELECT returns 0 rows).

---

## T3 — Sheet roll surfaces (`feat(sheet): rollable checks, saves, skills, initiative, attacks, death saves`) — **M**

**Goal:** Every modifier already on the sheet becomes a roll trigger with the Normal/Advantage/Disadvantage popover; attack rolls arm crit damage; death saves apply RAW automatically (design D9). This is the "dice rolls integrate where players expect" line of checkpoint B.

**Depends on:** T2. **Unblocks:** T7.

**Files:**

| File | Action |
|---|---|
| `components/sheet/rolls/roll-popover.tsx` | Create — reusable trigger wrapper: child renders the stat, popover offers Roll / Advantage / Disadvantage (d20 kinds) or rolls immediately (damage kinds) |
| `components/sheet/ability-card.tsx` | Modify — wrap in `RollPopover` (kind `check`) |
| `components/sheet/saving-throws.tsx` | Modify — rows rollable (kind `save`) |
| `components/sheet/skills-list.tsx` | Modify — rows rollable (kind `check`, skill label) |
| `components/sheet/combat-stats.tsx` | Modify — initiative rollable (kind `initiative`) |
| `components/sheet/tabs/actions-tab.tsx` | Modify — attack rows: hit-bonus cell rolls `attack`; damage cell rolls `damage`; nat 20 on the preceding attack arms `crit: true` on that row's next damage roll |
| `components/sheet/death-saves.tsx` | Modify — "Roll Death Save" button; RAW resolution in one `patchState` (nat 1 → +2 failures; nat 20 → `current_hp: 1` + reset; ≥10 success; else failure); manual pips unchanged |
| `components/sheet/mobile-sheet.tsx` | Modify — verify mirrored surfaces pick up the popovers (shared components should make this near-zero) |
| `tests/components/sheet/roll-popover.test.tsx` | Create |
| `tests/components/sheet/death-saves.test.tsx` | Create or extend |
| `tests/components/sheet/actions-tab-rolls.test.tsx` | Create |

**Test expectations:**
- Popover: three buttons for d20 kinds; `roll` called with correct expression/mode; damage kind bypasses the popover.
- Ability card with STR 16 rolls `1d20+3`; proficient save includes prof bonus; skill row uses the computed skill modifier (reuse `formatModifier`/`getSaveModifier` fixtures).
- Attack → damage crit chain: seeded nat-20 attack causes the damage roll request to carry `crit: true`; a normal hit does not.
- Death saves (seeded): 10+ increments successes; <10 increments failures; nat 1 adds two failures; nat 20 patches `current_hp: 1` and zeroed saves — each asserted as a single `patchState` call.

---

## T4 — Hit-dice tracking + short-rest spending (`feat(rest): hit dice pools, spend-to-heal, long-rest recovery`) — **M**

**Goal:** Light up the Rest System's deferred piece: per-class HD pools from class content, Spend & Roll rows in the short-rest pane, HD recovery on long rest, read-only HD display in the HP popover. Closes the design's §5 and the rest spec's "Follow-Up Phases" promise.

**Depends on:** T2 (rolling + toast). **Unblocks:** T8.

**Files:**

| File | Action |
|---|---|
| `lib/types/character.ts` | Modify — `hit_dice_spent?: Record<string, number>` on `CharacterState` |
| `lib/hit-dice/helpers.ts` | Create — `computeHitDicePools`, `computeLongRestHdRecovery` (largest die first, ⌊Σ/2⌋ min 1), `spendHitDiePatch(state, classSlug, healedTo)` |
| `lib/rest/helpers.ts` | Modify — `computeLongRestEffects` gains HD recovery in the patch (needs pools param) |
| `lib/character/character-context.tsx` | Modify — `useRest()` computes pools (class content already available via `classData` prop — extend `ClassContentData` with `hit_die`), exposes `hitDicePools` + `spendHitDie(classSlug)` |
| `app/(app)/characters/[id]/page.tsx` | Modify — include `hit_die` in the class content select (verify; likely already in `data`) |
| `components/sheet/rest-dialog.tsx` | Modify — Hit Dice section in the short-rest pane: per-class rows, Spend & Roll (dice engine kind `hit_die`, `1dX+conMod`, heal clamped to maxHp), disabled at 0 remaining or full HP; long-rest pane previews HD recovery |
| `components/sheet/hp-tracker.tsx` | Modify — read-only "Hit Dice: d10 3/5 · …" line in the popover |
| `tests/hit-dice/helpers.test.ts` | Create |
| `tests/rest/helpers.test.ts` | Extend — long-rest HD recovery cases |
| `tests/components/sheet/rest-dialog.test.tsx` | Extend — HD section behavior |

**Test expectations:**
- Pools: Fighter 3/Wizard 2 → `[{fighter,d10,3,spent}, {wizard,d6,2,spent}]`; max clamps stale spent on read; missing `hit_die` in content defaults to d8 with a console warning (defensive).
- Recovery: 5 total HD, all spent → restore 2, d10 pool first; 1 HD character restores 1 (min-1 floor); nothing spent → no-op keys absent.
- Spend flow (seeded RNG): rolls `1d10+CON`, single `patchState` with incremented `hit_dice_spent.fighter` and healed `current_hp` clamped at max; button disabled when pool empty or HP full; roll lands in the roll log.
- `computeLongRestEffects` remains a pure no-React helper; existing rest tests untouched-green.

---

## T5 — Spell casting dialog (`feat(spells): cast dialog — slots, upcast, ritual, cantrip scaling, pact`) — **L**

**Goal:** The Cast button works. Slot picker with upcast preview and pact slots, ritual path, atomic cast patch (slots + concentration + active effects via T6 helpers), post-cast roll offers (attack/damage/heal with crit chain), interactive slot tracker dots, cantrip-scaling data backfill.

**Depends on:** T2 (rolls), T6 (active-effect helpers — merge T6 first; if T6 slips, land T5 with the effect-application seam stubbed behind `computeCastEffects` and a follow-up flag). **Unblocks:** T7, T8.

**Files:**

| File | Action |
|---|---|
| `lib/spells/casting.ts` | Create — `computeCastEffects(spellData, choice, state, casterInfo): { statePatch, rollRequests }` (pure); slot-key resolution (leveled vs pact), upcast damage/heal lookup with breakpoint inheritance, cantrip tier resolution, ritual no-slot path |
| `lib/spells/duration.ts` | Create *(shared with T6 — whichever merges first creates it)* — `parseSpellDuration(str): EffectDuration` |
| `lib/character/character-context.tsx` | Modify — `useSpells().castSpell(spell, choice)`: applies patch, returns `CastOutcome { rollRequests }` |
| `components/sheet/spells/cast-dialog.tsx` | Create — dialog (desktop) / Vaul sheet (mobile); states: configure → result (design §4.2–4.4) |
| `components/sheet/spells/spell-row.tsx` | Modify — enable Cast (prepared/known/cantrip; unprepared wizard spellbook rows enable ritual-only when applicable) |
| `components/sheet/spells/slot-tracker.tsx` | Modify — dots clickable: mark-used / restore via `patchState` |
| `components/sheet/spells/concentration-badge.tsx` | Modify — list linked effects that ending will remove (display only until T7 wires removal) |
| `supabase/migrations/00039_spell_effect_enrichment.sql` | Create *(shared with T6 — see note)* — cantrip `descriptionCantripDie` backfill half |
| `tests/spells/casting.test.ts` | Create |
| `tests/components/sheet/cast-dialog.test.tsx` | Create |
| `tests/components/sheet/slot-tracker.test.tsx` | Create or extend |

**Migration note:** `00039` carries both the cantrip backfill (this task) and the buff-spell effects/durations (T6). Whichever task merges second *extends* the same file only if unapplied; otherwise it becomes `00040`. Coordinate at merge time — migrations are append-only once applied to the project.

**Test expectations:**
- `computeCastEffects` (pure, exhaustive): cantrip → no slot change; 1st-level cast → `spell_slots_used["1"]` +1 preserving other keys; upcast 3rd → `"3"` +1 and damage request uses `dice_at_slot_level` breakpoint inheritance; pact choice → `pact` +1; ritual → no slot change; concentration spell → `concentrating_on` replaced with correct `slot_level` and previous concentration effects stripped (T6 helper); non-concentration cast leaves `concentrating_on` untouched.
- Dialog: slot buttons disabled when exhausted; default = lowest available; Cast disabled with "No available slots" when none (ritual still offered when legal); concentration warning renders when replacing; result pane offers exactly the `rollRequests` returned (attack arms crit chain like T3).
- Slot tracker: clicking an unused dot marks used (patch asserted); clicking a used dot restores.
- Multiclass Warlock fixture (Warlock 3/Wizard 2): picker shows pact 2nd + leveled slots; casting from each consumes the right key.
- Smoke: Wizard L3 casts Magic Missile at 2nd → slot dot fills, `3+1` darts wording via upcast damage `4d4+4` roll.

---

## T6 — Effects & durations foundation (`feat(effects): active effects state, evaluator integration, widget, SRD buff enrichment`) — **L**

**Goal:** The `ActiveEffect` model end-to-end *without* requiring casting: types + Zod schemas, pure mutation helpers, evaluator integration via the context's combined-effects array, roll-modifier effect convention (`roll_attack`/`roll_save`/`roll_check`), the Active Effects widget with durations/expiry display and custom entries, rest-clearing, and the SRD buff-spell enrichment migration.

**Depends on:** nothing (parallel with T1–T3). T5 and T7 consume its helpers. Roll-modifier display in breakdowns activates once T2/T3 exist (the scan lives in `useRolls`; land the helper here, wire the display in whichever of T3/T6 merges second — a one-line follow-up).

**Files:**

| File | Action |
|---|---|
| `lib/types/active-effects.ts` | Create — `ActiveEffect`, `EffectDuration`, `CustomEffectInput` (design §6.2) |
| `lib/schemas/active-effects.ts` | Create — `activeEffectSchema`, `effectDurationSchema` |
| `lib/schemas/content-types/spell.ts` | Modify — optional `duration_structured` field |
| `lib/types/character.ts` | Modify — `active_effects?: ActiveEffect[]` on `CharacterState` |
| `lib/active-effects/helpers.ts` | Create — `addActiveEffect`, `removeActiveEffect`, `dropConcentrationEffects`, `buildActiveEffectFromSpell`, `collectActiveEffects` (expiry-filtering), `isExpired`, `formatRemaining` |
| `lib/spells/duration.ts` | Create *(if T5 hasn't)* — `parseSpellDuration` |
| `lib/character/character-context.tsx` | Modify — append `collectActiveEffects(state.active_effects)` to `combinedEffects`; `useActiveEffects()` hook |
| `lib/rest/helpers.ts` | Modify — long rest clears `active_effects` |
| `components/sheet/active-effects-widget.tsx` | Create — pills with remaining time, expired styling, 🧠 concentration marker, × remove, + Add effect (known spells + custom form) |
| `components/character/sheet-panel.tsx` | Modify — insert widget between `ResourcesWidget` and `ActivationToggles` |
| `supabase/migrations/00039_spell_effect_enrichment.sql` | Create *(shared with T5 — see T5's migration note)* — `effects[]` + `duration_structured` on the ~12 starter buff spells |
| `tests/active-effects/helpers.test.ts` | Create |
| `tests/spells/duration.test.ts` | Create |
| `tests/components/sheet/active-effects-widget.test.tsx` | Create |
| `tests/engine/evaluator-active-effects.test.ts` | Create — integration-style: evaluator receives appended effects |

**Test expectations:**
- Duration parsing: "Instantaneous" → `instantaneous`; "1 round" → rounds 1; "Concentration, up to 10 minutes" → minutes 10; "8 hours" → hours 8; "Until dispelled" → `special`; unknown strings → `special` (never throws).
- Helpers: add/remove immutability; `dropConcentrationEffects` strips only `concentration: true`; `collectActiveEffects` excludes expired entries and flatMaps snapshots; `buildActiveEffectFromSpell` snapshots `effects[]`, computes `expires_at` for real-time kinds and `null` otherwise.
- Evaluator integration: a Mage-Armor-shaped active effect (ac_formula + armor condition) raises AC only when unarmored — asserted through `evaluate()` with the combined array, proving zero evaluator changes were needed; a Shield-shaped `add` stacks on the best-of result.
- Widget: hidden when empty; expired entry dims with badge and its stats stop applying; removing a 🧠 entry warns it ends concentration (actual concentration patch lands in T7 — here it removes the entry and clears `concentrating_on` if it was the last linked one).
- Rest: long-rest patch includes `active_effects: []`; short rest leaves them alone.
- Migration verified: `SELECT slug, jsonb_array_length(effects) FROM content_definitions WHERE slug IN ('bless','mage-armor','shield',…)` all ≥ 1; every enriched row still validates against `spellDataSchema`.

---

## T7 — Concentration linking + damage prompt (`feat(effects): concentration lifecycle — replace, drop, damage saves`) — **M**

**Goal:** Concentration becomes consequential: casting-replacement and manual drop strip linked effects atomically; damage while concentrating raises the CON-save prompt with an auto-resolving roll; HP hitting 0 drops concentration silently per RAW.

**Depends on:** T3 (HP/damage flow + roll popover), T5 (casting sets linkage), T6 (linked effects exist).

**Files:**

| File | Action |
|---|---|
| `lib/active-effects/concentration.ts` | Create — `computeConcentrationDropPatch(state)` (clears `concentrating_on` + strips linked effects, one patch), `concentrationSaveDc(damage)` = `max(10, ⌊damage/2⌋)` |
| `lib/character/character-context.tsx` | Modify — `setConcentration(null)` uses the drop patch; expose `pendingConcentrationCheck` state raised by the damage path |
| `components/sheet/hp-tracker.tsx` | Modify — damage application: if `damage > 0 && concentrating_on && newHp > 0` raise the prompt; `newHp === 0` applies the drop patch with the damage patch |
| `components/sheet/concentration-prompt.tsx` | Create — dialog: DC display, Roll CON Save (kind `concentration`; auto-resolve success/fail), Keep, Drop |
| `components/sheet/spells/concentration-badge.tsx` | Modify — × applies the full drop patch; lists effects that will end |
| `components/sheet/mobile-sheet.tsx` | Modify — verify prompt mounts for the mobile HP flow |
| `tests/active-effects/concentration.test.ts` | Create |
| `tests/components/sheet/concentration-prompt.test.tsx` | Create |

**Test expectations:**
- Drop patch: clears `concentrating_on`, removes all `concentration: true` active effects, leaves others — asserted as one object (one `patchState`).
- DC: 14 damage → 10; 22 → 11; 47 → 23.
- Prompt (seeded): success keeps everything (no patch); failure applies the drop patch; Keep/Drop manual paths; roll logged as kind `concentration`.
- Damage to 0 HP: no prompt, drop patch merged into the damage patch; damage with no concentration: no prompt (regression guard on existing hp-tracker tests).
- Casting replacement (extends T5's dialog test): cast concentration spell B while on A → single patch: A's effects gone, B's applied, `concentrating_on` = B.

---

## T8 — Arcane Recovery on short rest (`feat(rest): arcane recovery slot restoration`) — **S**

**Goal:** The wizard's short rest offers slot recovery (≤ ⌈wizard level / 2⌉ slot-levels, none 6th+) gated on the unspent `arcane-recovery` feature resource (PR #24 data), applied atomically with the short rest.

**Depends on:** T4 (rest-dialog structure), T5 (slot state conventions).

**Files:**

| File | Action |
|---|---|
| `lib/rest/arcane-recovery.ts` | Create — `arcaneRecoveryBudget(wizardLevel)`, `computeArcaneRecoveryPatch(state, picks)` (restores chosen `spell_slots_used` keys, marks `feature_uses["arcane-recovery"] = 1`), `validatePicks(picks, budget, maxSlots, slotState)` |
| `components/sheet/rest-dialog.tsx` | Modify — conditional Arcane Recovery section in the short-rest pane: slot-level stepper picker with live budget, folded into the short-rest patch |
| `tests/rest/arcane-recovery.test.ts` | Create |
| `tests/components/sheet/rest-dialog.test.tsx` | Extend |

**Test expectations:**
- Budget: wizard 1 → 1; wizard 3 → 2; wizard 9 → 5; multiclass uses wizard levels only.
- Validation: rejects picks over budget, 6th+ slots, restoring a slot that isn't spent; patch restores exactly the picked keys and spends the resource.
- Section hidden when: no wizard levels, resource already spent, or no spent slots ≤ 5th; short rest without picks doesn't touch the resource.
- Executed rest is still one `patchState` (rest patch merged with recovery patch).

---

## T9 — Milestone verification + docs close-out (`docs: M3 UAT + status log`) — **S**

**Goal:** Prove the milestone exit criteria end-to-end and leave the repo honest: run the design §10 UAT script in-browser against the test characters (per the smoke-test-before-handoff convention), fix papercuts found (or file them into GAME-PLAN Track A-style bullets), update `docs/ROADMAP.md` M3 status + "Where we are today", and append the GAME-PLAN §7 status log.

**Depends on:** T1–T8 merged.

**Files:** `docs/ROADMAP.md`, `docs/GAME-PLAN.md` (status log + M3 completion notes), `docs/alpha/` UAT notes if issues found. No product code beyond papercut fixes (each as its own small PR if non-trivial).

**Test expectations / done means:**
- Every §10 scenario passes on the dev deployment with the test account.
- Full suite green; no console errors across cast/rest/roll/effect flows on desktop and mobile viewports.
- ROADMAP M3 marked complete with an honest deferred-items list (anything cut lands in M6 or the backlog explicitly).
- Checkpoint B (alpha #2 invite) is unblocked and stated as the next step.

---

## Exit-criteria coverage map

| Milestone exit criterion | Delivered by |
|---|---|
| Click "cast" → slot consumed | T5 (atomic cast patch) |
| → dice rolled | T1 + T2 (engine/pipeline), T5 (spell rolls), T3 (attack/check/save surfaces) |
| → effect applied with duration | T6 (model + evaluator + widget), T5 (cast applies), T7 (concentration lifecycle) |
| Hit dice spendable during short rest | T4 (+ T2 for the rolling) |
| "Real-feeling combat at a virtual table" | T3 (rolls everywhere), T7 (concentration pressure), T2 (shared visible log), T9 (verified end-to-end) |
| Homebrew (M4) gets dice + effects for free | T1 (content dice strings parse), T6 (effects snapshot pipeline, schema-driven durations), T5 (dialog fully data-driven) |
