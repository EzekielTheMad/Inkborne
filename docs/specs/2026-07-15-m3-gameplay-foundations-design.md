# M3 — Gameplay Foundations: Design Spec

**Date:** 2026-07-15
**Status:** Proposed (design + plan pair; see [`2026-07-15-m3-gameplay-foundations-plan.md`](2026-07-15-m3-gameplay-foundations-plan.md))
**Milestone:** M3 per [`docs/ROADMAP.md`](../ROADMAP.md) — "Make characters playable, not just buildable."
**Scope:** Four subsystems that together deliver alpha #2 ("can you *play* a character?"):

1. **Dice rolling foundation** — cross-cutting roll engine + persistent roll log, consumed by ability checks, saves, attacks, death saves, initiative, hit-dice spending, concentration checks, and spell casting.
2. **Spell Management Phase 2** — casting dialog with slot consumption, upcasting, ritual casting, cantrip scaling, pact-slot handling, and rest/feature-resource integration (incl. Arcane Recovery, whose data shipped in PR #24).
3. **Hit-dice tracking** — the piece the Rest System (2026-04-23) explicitly deferred until dice existed: HD pools per class, spend-to-heal during short rests, half-pool recovery on long rest.
4. **Effects/durations system** — active effects (Bless, Mage Armor, Shield…) applied through the *existing* effects evaluator, with durations, concentration linking (dropping concentration ends linked effects), and a damage-triggered concentration prompt. This is the subsystem ROADMAP flagged as "needs its own brainstorm" — that brainstorm is §6 of this document.

**Exit criteria (from ROADMAP):** a player can click "cast" on a spell → slot consumed → dice rolled → effect applied with a duration; hit dice are spendable during short rests; combat at a virtual table feels real.

---

## 1. Design constraints (non-negotiable)

These come from the architecture ([`docs/architecture/02-domain-layer.md`](../architecture/02-domain-layer.md)) and the project's standing conventions:

- **Content is data.** Casting and active effects must flow through the existing pipeline: Zod-validated content `data` + `effects: Effect[]` folded by the deterministic `evaluate()` in [`lib/engine/evaluator.ts`](../../lib/engine/evaluator.ts). No spell-specific code paths ("if slug === 'mage-armor'"). A homebrew spell authored in M4 with a schema-valid `data` payload and an `effects[]` array must get the cast dialog, dice rolls, and duration tracking **for free**.
- **The evaluator stays pure and deterministic.** Randomness lives in a separate dice module with an injectable RNG. Dice results enter character state only through explicit user actions (a `patchState` call), never inside `evaluate()`.
- **All character-state writes go through `patch_character_state`** (migration `00031`) via `updateCharacterState()` / the typed helpers from PR #56. New *tables* (roll log) follow the `character_spells` / `character_inventory` pattern: typed CRUD helpers in `lib/supabase/`, RLS-gated, owner-scoped.
- **Client architecture matches the existing sheet.** New play-state hooks extend `CharacterContext` ([`lib/character/character-context.tsx`](../../lib/character/character-context.tsx)) exactly like `useRest()` / `useResources()` / `useSpells()` do: pure helpers in `lib/*/helpers.ts` compute patches, the hook applies them via `patchState`, components consume the hook. The sheet layout is "sacred" — M3 adds affordances to existing surfaces (stat ribbon, left-column widgets, content tabs, rest dialog) rather than restructuring them.
- **UI kit:** Base UI (`@base-ui/react`) primitives, Vaul drawer for mobile bottom sheets, semantic Tailwind tokens. Mobile parity via the existing `MobileSheet` mirroring pattern.
- **Tests gate merges:** every pure helper gets unit tests; every new component gets a behavior test; `npx vitest run` stays green.

---

## 2. Recommended decisions (summary)

Each open question gets one recommended answer here; rationale and alternatives are in the relevant section.

| # | Question | Recommendation |
|---|----------|----------------|
| D1 | Roll UX — where do rolls surface? | **Click any rollable stat → small popover with Normal / Advantage / Disadvantage → result appears as a transient roll toast (bottom-right stack) and lands in a persistent Roll Log panel** (right-side slide-over on desktop, Vaul bottom sheet on mobile) opened from a d20 button in the character header. (§3.4) |
| D2 | Roll log persistence — DB table vs client-only? | **DB table `character_rolls`**, owner-RLS, insert-only from the client, last-50 hydrated on load. Multiplayer-ready (campaign-visible rolls later become an RLS policy + a realtime subscription, zero schema change). (§3.5) |
| D3 | Effect data shape | **`ActiveEffect[]` stored in `character.state.active_effects`** (JSONB, patched atomically), each entry carrying a *snapshot* of the content's `Effect[]` plus structured duration + concentration flag. Evaluation: context appends active-effect `Effect`s to the array passed to `evaluate()` — the same mechanism already used for equipped-armor effects. (§6.2–6.4) |
| D4 | Concentration UX | Concentration is **state-linked, prompt-driven**: casting a second concentration spell shows a replace-confirm; taking damage while concentrating raises a **concentration-check prompt** (CON save at DC `max(10, ⌊damage/2⌋)` with a roll button + manual Keep/Drop overrides); dropping concentration (any path) removes all concentration-linked active effects in the same atomic patch. (§6.6) |
| D5 | Duration ticking with no combat tracker | Durations are **displayed and rest-expired, never silently auto-removed**. Real-time durations show an "expired" visual state once `expires_at` passes; round-denominated durations show remaining as text; long rest clears all active effects. One-tap dismiss everywhere. (§6.5) |
| D6 | Upcast/slot model | Cast dialog consumes slots via the existing `spell_slots_used` map in **one atomic `patchState`** together with concentration + active-effect changes. Warlock pact slots are a first-class slot option in the picker. (§4.3) |
| D7 | Hit-dice state shape | `state.hit_dice_spent: Record<classSlug, number>`; max per class = class level; die size from class content `hit_die`. Long rest restores `⌊totalHD/2⌋` min 1, largest dice first. (§5) |
| D8 | Arcane Recovery | **Pulled into M3** (data shipped in PR #24; the rest+slot machinery makes it ~a day): short-rest pane offers slot recovery up to `⌈wizardLevel/2⌉` slot-levels when the `arcane-recovery` resource is unspent. Mystic Arcanum / Spell Mastery / Signature Spells stay in M6. (§4.6) |
| D9 | Death saves | Rolling a death save via the dice engine **applies RAW automatically**: nat 1 = two failures, nat 20 = regain 1 HP + reset saves, ≥10 success, <10 failure. Manual pip-clicking stays for table adjudication. (§3.6) |

---

## 3. Dice rolling foundation

### 3.1 Module layout

```
lib/dice/
  parser.ts      — dice-expression string → DiceExpression AST
  roller.ts      — executeRoll(request, rng) → RollResult (pure given rng)
  types.ts       — DiceExpression, RollRequest, RollResult, RollKind, RollMode
lib/supabase/rolls.ts — insertRoll / getRecentRolls (character_rolls table)
```

The engine is a **pure library**: `executeRoll` takes an injectable `rng: () => number` (default `Math.random`; tests pass a seeded generator). It has no React, Supabase, or 5e-specific imports — it evaluates dice strings, which is exactly what homebrew content will feed it in M4.

### 3.2 Expression grammar

The parser accepts the dice notation already present in content data (`data.damage.dice_at_slot_level` values like `"8d6"`, weapon `damage` like `"1d8"`, hit dice like `"1d10"`) plus modifiers:

```
expression := term (('+' | '-') term)*
term       := dice | integer
dice       := count 'd' sides keep?
keep       := ('kh' | 'kl') count        — keep-highest / keep-lowest
```

Examples: `1d20+5`, `2d6+3`, `8d6`, `2d20kh1+7` (advantage), `4d6kl3`. Unknown syntax throws a typed `DiceParseError` — content validation (M4 importer) can reuse the parser to reject malformed dice strings at the boundary.

### 3.3 Roll requests and results

```ts
export type RollKind =
  | "check" | "save" | "attack" | "damage" | "heal"
  | "death_save" | "initiative" | "hit_die" | "concentration" | "custom";

export type RollMode = "normal" | "advantage" | "disadvantage";

export interface RollRequest {
  kind: RollKind;
  label: string;              // "Athletics Check", "Fire Bolt — Damage", "Longsword — Attack"
  expression: string;         // "1d20+5", "2d6+3"
  mode?: RollMode;            // d20-kind rolls only; implemented as 2d20kh1 / 2d20kl1
  crit?: boolean;             // damage rolls: double the dice (not the modifier)
  meta?: Record<string, unknown>;  // e.g. { spell_slug, slot_level, dc }
}

export interface RollResult {
  request: RollRequest;
  groups: Array<{ sides: number; rolls: number[]; kept: number[] }>;
  modifier: number;
  total: number;
  natural?: number;           // the kept d20 face for d20-kind rolls (crit/fumble detection)
  rolled_at: string;          // ISO
}
```

`mode` is sugar: the roller rewrites the leading `1d20` term to `2d20kh1`/`2d20kl1`. `crit` doubles the *dice count* of every dice term (RAW crit damage) without touching flat modifiers. `natural` lets consumers detect nat-1/nat-20 (attack crits feed `crit: true` into the follow-up damage roll; death saves apply D9).

### 3.4 Roll UX (decision D1)

**Where rolls start.** Every modifier the sheet already renders becomes a roll affordance:

| Surface | Roll |
|---|---|
| Ability cards (stat ribbon) | ability check `1d20+mod` |
| Saving Throws widget rows | save `1d20+saveMod` |
| Skills list rows | skill check `1d20+skillMod` |
| Initiative (combat stats) | initiative `1d20+init` |
| Actions tab attack rows | attack `1d20+hitBonus`, then damage with crit carry-over |
| Death Saves widget | death save `1d20` (D9 semantics) |
| Rest dialog (short) | hit die `1dX+conMod` per die spent |
| Cast dialog | spell attack / damage / heal per spell data |
| HP damage while concentrating | concentration CON save |

Clicking a rollable stat opens a **compact popover** (Base UI Popover, same pattern as the HP tracker) with three buttons: **Roll**, **Advantage**, **Disadvantage** — plus the computed bonus shown for transparency. One extra click versus D&D Beyond's roll-on-click, but adv/dis is the single most common table adjustment and burying it would make half of real rolls wrong. Damage rolls (no adv/dis) roll immediately on click.

*Alternative considered:* roll-on-click with Shift/Ctrl modifiers for adv/dis. Rejected as undiscoverable and mobile-hostile; noted as a possible desktop power-user addition later.

**Where results surface.** Two layers:

1. **Roll toast** — a transient card in a bottom-right stack (bottom-center above the tab bar on mobile): label, total (large), dice breakdown (`d20: 14, 8 → kept 14 · +5`), crit/fumble accent styling. Auto-dismisses after ~6s; clicking pins it open. There is no toast infrastructure in the repo — this is a small purpose-built `RollToaster` rendered by the character shell, **not** a new dependency.
2. **Roll Log panel** — a d20 icon button in the character header opens a slide-over (`components/ui/sheet.tsx` on desktop, Vaul drawer on mobile) listing rolls newest-first with kind badges, relative timestamps, and full breakdowns. Hydrated with the last 50 persisted rolls; session rolls appended optimistically.

*Alternative considered:* a "Rolls" content tab. Rejected — roll results must be visible regardless of which tab is active (you roll an attack from Actions, damage lands while looking at Spells).

### 3.5 Roll log persistence (decision D2)

**New table `character_rolls`** (migration `00038`):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `character_id` | uuid FK → characters | cascade delete |
| `user_id` | uuid FK → profiles | who rolled (owner today; DM later) |
| `kind` | text | `RollKind`, CHECK-constrained |
| `label` | text | display label |
| `expression` | text | the rolled expression |
| `result` | jsonb | full `RollResult` breakdown (groups, kept, natural) |
| `total` | int | denormalized for cheap list rendering |
| `rolled_at` | timestamptz | `now()` |

Index `(character_id, rolled_at desc)`. RLS: owner can SELECT/INSERT (no UPDATE/DELETE — the log is append-only by design; honesty at the table). Writes go through `lib/supabase/rolls.ts` typed helpers — this is a new table, not `characters.state`, so it follows the `character_spells` pattern rather than `patch_character_state` (which exists specifically for the state JSONB column).

**Why a table and not client-only:** (a) *robust over scrappy* — a refresh should not eat the session's rolls; (b) ROADMAP's multiplayer question (Victor's decision #6) stays open either way, but a table means campaign-visible rolls later are purely additive: one RLS policy for campaign members + a Supabase realtime subscription. Client-only would force a redesign. (c) Rows are tiny; no pruning needed in M3 (revisit if a character exceeds ~10k rolls). Persistence is fire-and-forget from the client — a failed insert logs to console and never blocks the toast.

### 3.6 Death-save rolls (decision D9)

The Death Saves widget gains a "Roll Death Save" button (visible only at 0 HP, like the widget itself). The roll applies RAW in one `patchState`: natural 1 → `failures + 2`; natural 20 → `current_hp: 1` + saves reset (reusing the existing 0→>0 auto-reset semantics); 10+ → `successes + 1`; else `failures + 1`. The existing manual pips remain for DM adjudication. Three successes/failures keep today's stabilized/dead display.

---

## 4. Spell Management Phase 2 — casting

### 4.1 What Phase 1 left ready

Phase 1 ([`docs/superpowers/specs/2026-04-16-spell-management-phase-1-design.md`](../superpowers/specs/2026-04-16-spell-management-phase-1-design.md)) shipped: `character_spells` table, `spell_slots_used`/`concentrating_on` state with `patchState`, `computeMaxSlots` (multiclass + pact), `CasterInfo` with DC/attack/ritual metadata, the read-only slot tracker, and a disabled Cast button on `SpellRow`. Phase 2 turns that key.

### 4.2 Cast dialog

`components/sheet/spells/cast-dialog.tsx`, opened from the (now-enabled) Cast button on `SpellRow`. Dialog on desktop, Vaul bottom sheet on mobile (matching the builder's established pattern). Everything it renders is derived from the spell's schema-validated `data` (`spellDataSchema`) — no per-spell logic.

```
╭─ Cast: Burning Hands ────────────────────────────╮
│  1st-level evocation · V,S · Self (15-ft cone)   │
│                                                  │
│  Cast with slot:  [1st ●●○]  [2nd ●●]  [3rd ●]   │
│                   [Pact 5th ●●]     (if Warlock) │
│  ☐ Cast as ritual (+10 min, no slot)   (if avail)│
│                                                  │
│  On cast: 3d6 fire damage · DEX save DC 15 half  │
│  ⚠ Requires concentration — will end Bless       │
│                                                  │
│                       [ Cancel ]  [ Cast ]       │
╰──────────────────────────────────────────────────╯
```

- **Slot picker:** levels ≥ `data.level` with at least one free slot (from `maxSlots` − `slotState`). Defaults to the lowest available. Pact slots render as their own option at the pact level when the character has them and pact level ≥ spell level. Cantrips (`level === 0`) skip the picker entirely.
- **Upcast preview:** the damage/heal line re-renders from `damage.dice_at_slot_level[selectedLevel]` / `heal_at_slot_level[selectedLevel]` as the selection changes. Levels between defined keys inherit the highest defined key ≤ selection (matches SRD data shape, where only breakpoints are listed).
- **Ritual toggle:** shown when `data.ritual && casterClass.ritualCasting`. Wizard RAW nuance honored: a ritual spell that is `in_spellbook` can be ritual-cast even when unprepared (the Cast button on unprepared spellbook rows is enabled *only* into the ritual path). Ritual casting consumes no slot.
- **Concentration warning:** if `data.concentration` and `state.concentrating_on` is set, the dialog shows what will be dropped; Cast proceeds with the replacement (see §6.6).
- **No-slot state:** if every eligible slot is spent, the Cast button disables with "No available slots — take a rest" (ritual path still works when legal).

### 4.3 Cast execution (decision D6)

Casting is **one atomic `patchState`** composing every state consequence, exactly like `useRest()` composes long-rest effects today:

```ts
patchState({
  spell_slots_used: { ...slots, [slotKey]: (slots[slotKey] ?? 0) + 1 },  // omitted for cantrip/ritual
  concentrating_on: data.concentration ? { spell_slug, spell_name, slot_level, started_at } : state.concentrating_on,
  active_effects: nextActiveEffects,   // §6 — previous concentration effects removed, new ones appended
});
```

A pure helper `computeCastEffects(spell, slotChoice, state, casterInfo)` in `lib/spells/casting.ts` produces this patch plus the list of `RollRequest`s the result view offers — unit-testable with zero mocking, mirroring `computeShortRestEffects`.

### 4.4 Post-cast result view

After Cast, the dialog swaps to a result pane (rather than closing instantly) offering the rolls the spell defines:

- **Spell attack** (`data.attack_type` present / no `dc`): "Roll Attack (+7)" with adv/dis, nat-20 arms the damage button with `crit: true`.
- **Damage / heal:** one button per damage type at the cast level; results toast + log like every other roll.
- **Save DC:** displayed ("DEX save DC 15, half on success") — the *target* rolls saves, not the caster, so this is informational.
- **Cantrip scaling:** cantrip damage resolves through `data.descriptionCantripDie` / `dice_at_slot_level` keyed by **character level** tiers (5/11/17). The ~14 cantrips missing `descriptionCantripDie` get a data-enrichment migration (Phase 1 audit already counted them).

"Done" closes the dialog. Slot consumption already happened — rolling is optional (plenty of casts need no roll at the table).

### 4.5 Slot tracker becomes interactive

The read-only dot display (`slot-tracker.tsx`) gains click-to-toggle per slot dot (mark used / restore), for the "I cast it in the hallway conversation, just dock the slot" reality. Same `patchState` shape as the dialog. This closes Phase 1's "interactive slot consumption" deferral.

### 4.6 Rests + feature resources integration (decision D8)

- **Rests already restore slots** (Rest System, 2026-04-23) — casting writes to the same `spell_slots_used` map, so nothing new is needed for the base loop.
- **Arcane Recovery** (data enriched in PR #24: `usages: 1, recovery: "long rest"` on the `arcane-recovery` feature): the short-rest pane of the Rest dialog gains a conditional section when the character has the `arcane-recovery` resource unspent and is a wizard — pick slot levels summing to ≤ `⌈wizardLevel/2⌉` (none 6th+), apply as part of the short-rest patch (restore chosen `spell_slots_used` keys, `feature_uses["arcane-recovery"] = 1`). This is generic machinery only in presentation — the slot-restoration picker is reusable for any future "recover slots" feature; the *trigger* is the feature resource, honoring content-as-data.
- **Feature-granted innate casting** (e.g. Tiefling's Hellish Rebuke 1/day) stays out — it needs a `spellcastingBonus`-style schema extension and is scoped to M6 with the other class-advanced features (Mystic Arcanum, Spell Mastery, Signature Spells).

---

## 5. Hit-dice tracking (decision D7)

The Rest System spec deferred HD precisely because "rolling real dice" didn't exist. It does now.

### 5.1 State + helpers

```ts
// CharacterState addition
hit_dice_spent?: Record<string, number>;   // class slug → dice spent

// lib/hit-dice/helpers.ts (pure)
interface HitDicePool { classSlug: string; die: number; max: number; spent: number; }
computeHitDicePools(classes, classContent, state): HitDicePool[]   // max = class level, die = class data.hit_die
computeLongRestHdRecovery(pools): Record<string, number>           // restore ⌊ΣHD/2⌋ min 1, largest die first
```

Max is *computed* (spent-is-tracked, max-is-computed — the same self-healing convention as `feature_uses` and `spell_slots_used`; a level-down clamps on read). Largest-die-first recovery is a deterministic stand-in for RAW's "player chooses" — predictable and optimal in practice.

### 5.2 Short-rest spending

The short-rest pane of the Rest dialog gains a **Hit Dice section**: one row per class pool (`Fighter d10 — 3/5 remaining [Spend & Roll]`). Spend & Roll executes `1dX + conMod` through the dice engine (kind `hit_die`, so it toasts and logs like everything else), then applies one `patchState` incrementing `hit_dice_spent[classSlug]` and healing `min(maxHp, current_hp + result)`. Repeatable until pools empty or HP full. Spending HD is legal *during* a short rest RAW, so it lives in the dialog rather than as a free-floating widget; the rest itself remains a separate button press.

`computeShortRestEffects` is unchanged (HD spending is per-die interactive, not part of the bulk patch). `computeLongRestEffects` gains the HD recovery from §5.1.

### 5.3 Display

The HP tracker popover gains a read-only "Hit Dice: d10 3/5 · d6 1/1" line so remaining HD are visible without opening the Rest dialog. No new left-column widget — HD are a rest-time resource, not an at-a-glance combat stat.

---

## 6. Effects & durations system (the brainstormed design)

### 6.1 Problem statement

Today the sheet has exactly one "active effect": the hardcoded Rage toggle (`state.rage_active` + `StateCondition`-gated effects on the Rage feature). Spells like Bless, Mage Armor, and Shield have no runtime representation: their mechanical consequences (`effects[]` on their content rows) never reach the evaluator, and nothing tracks "this is on me until X". M3 needs: apply on cast, display with duration, expire on rest, link to concentration — all without hardcoding a single spell.

### 6.2 Core idea: active effects are *snapshotted content effects*

An **ActiveEffect** is a runtime instance of a piece of content's `Effect[]` payload, pinned to the character with duration metadata:

```ts
// lib/types/active-effects.ts
export interface ActiveEffect {
  id: string;                        // uuid (client-generated) — removal handle
  name: string;                      // "Mage Armor" — denormalized for display
  slug: string;                      // content slug, or "custom"
  source: "spell" | "feature" | "item" | "custom";
  content_id: string | null;
  effects: Effect[];                 // SNAPSHOT of the content's effects[] at apply time
  duration: EffectDuration;
  concentration: boolean;            // linked to state.concentrating_on
  cast_at_level?: number;            // upcast awareness (Bless targets, future)
  applied_at: string;                // ISO
  expires_at: string | null;         // applied_at + duration, for real-time kinds
}

export type EffectDuration =
  | { type: "rounds";  value: number }    // "1 round" → advisory display
  | { type: "minutes"; value: number }
  | { type: "hours";   value: number }
  | { type: "until_rest" }                // rare; cleared by any rest
  | { type: "instantaneous" }             // never becomes an ActiveEffect
  | { type: "special" };                  // "until dispelled", etc. — manual removal only
```

**Why snapshot the `Effect[]` instead of re-resolving from `content_id` at eval time:** (a) evaluation stays a pure fold over data already in memory — no async content fetch inside the render path; (b) an effect keeps doing what it did when applied even if the content row is edited mid-session (homebrew authors *will* edit live in M4); (c) custom/DM-adjudicated effects ("+2 AC from cover") need no content row at all. The trade-off — a stale buff after content fixes — resolves naturally on re-apply, and the `content_id` link is retained for provenance.

*Alternative considered — reference-only (`content_id` + re-resolve):* rejected for the async-eval problem and the live-edit hazard. *Alternative — a `character_active_effects` table:* rejected for M3; effects are hot combat state that changes with HP/slots in the *same* atomic patch (cast = slot + concentration + effect in one write; drop concentration = concentration + effects in one write). Splitting across a table breaks atomicity that `patch_character_state` gives us for free. Revisit only if multiplayer needs row-level realtime granularity.

### 6.3 Storage: `state.active_effects`

`CharacterState` gains `active_effects?: ActiveEffect[]`. All mutations go through `patchState({ active_effects: nextArray })` — shallow-merge replaces the array wholesale, which is exactly right: every mutation (add, remove, expire, concentration-drop) computes the full next array from the current one via pure helpers in `lib/active-effects/helpers.ts`:

```ts
addActiveEffect(current, entry)              → ActiveEffect[]
removeActiveEffect(current, id)              → ActiveEffect[]
dropConcentrationEffects(current)            → ActiveEffect[]   // strips all concentration:true entries
buildActiveEffectFromSpell(spell, slotLevel) → ActiveEffect     // parses duration, snapshots effects
collectActiveEffects(current)                → Effect[]         // flatMap for the evaluator
```

### 6.4 Evaluation integration — the part homebrew gets for free

`CharacterProvider` already assembles `combinedEffects = [...allEffects, ...equippedArmorEffects]` before calling `evaluate()`. M3 makes it:

```ts
const combinedEffects = [...allEffects, ...equippedArmorEffects, ...activeEffectEffects];
```

That's the entire integration. Mage Armor works because its content row carries
`{ type:"mechanical", stat:"armor_class", op:"formula", expr:"13 + mod(dexterity)", tag:"ac_formula", condition:{ field:"equipped_armor", op:"eq", value:"none" } }`
— the AC best-of logic, the armor condition, everything already exists in the evaluator. Shield is `{ op:"add", stat:"armor_class", value:5 }`. Bless's attack/save bonus can't be a static stat (it's per-roll `+1d4`), so Bless carries a `narrative` effect for display **and** a new *roll-modifier* hint (below). Any M4 homebrew buff that validates against the effect schema behaves identically.

**Roll-modifier effects (small, honest extension):** effects like Bless/Bane modify *rolls*, not stats. Rather than inventing a parallel system, `MechanicalEffect.stat` gains three conventional targets consumed by the roll layer, not the evaluator: `roll_attack`, `roll_save`, `roll_check`, with `value` as a dice string (`"1d4"`). `useRolls()` scans active effects for these and appends them to matching `RollRequest` expressions (with the effect name shown in the breakdown: `1d20+5 +1d4 (Bless)`). The evaluator ignores unknown stat slugs by design (they accumulate in `stats` harmlessly), so this is additive and schema-compatible. This is the one genuinely new mechanic in M3's effect model.

**SRD enrichment:** a migration adds `effects[]` + structured duration to a starter set of ~12 SRD buff spells (Bless, Bane, Mage Armor, Shield, Shield of Faith, Guidance, Resistance, Haste-lite†, Barkskin, Heroism, Enlarge/Reduce-narrative, Protection from Evil and Good-narrative). Spells whose mechanics exceed the effect vocabulary get narrative effects only — visible on the sheet, honest about what's automated. († Haste's extra-action half is narrative; its +2 AC is mechanical.)

### 6.5 Durations without a combat tracker (decision D5)

There is no initiative/round tracker in M3 (and none is planned before campaigns), so durations are **advisory, not authoritative**:

- **Parsing:** `parseSpellDuration(data.duration)` maps SRD strings ("Instantaneous", "1 round", "Concentration, up to 1 minute", "8 hours", "Until dispelled") to `EffectDuration`. The spell schema gains an optional pre-parsed `duration_structured` field (enriched by migration for the starter set; the parser is the fallback for everything else — imported homebrew included).
- **Display:** each active effect shows remaining time — real-time kinds count down from `expires_at` ("Mage Armor · 7h 52m"), round kinds show the static denomination ("Bless · 1 min (10 rounds)"), `special` shows "until removed".
- **Expiry:** when `expires_at` passes, the entry gets expired styling (dimmed + "expired" badge) and a one-tap dismiss — it is **not** silently auto-removed, because wall-clock time ≠ game time (a real hour of table talk is often zero in-game seconds). Its `Effect[]` contributions *do* stop applying once expired (the `collectActiveEffects` filter excludes expired entries) — the visual lingers only so the player understands why their AC just dropped.
- **Rests:** long rest clears `active_effects` entirely (8+ in-game hours outlasts every non-`special` duration; `special` effects like Mage Armor's 8h are also gone by RAW math — and "until dispelled" surviving a long rest is rare enough that re-applying is the honest default). Short rest touches nothing (RAW: concentration and buffs can persist through an hour).

*Alternative considered — a round ticker on the sheet:* rejected; it implies combat sequencing the app doesn't own yet, and gets superseded by any future campaign-level combat tracker.

### 6.6 Concentration linking + damage prompt (decision D4)

Concentration already exists as `state.concentrating_on` (Phase 1) — M3 wires it to consequences:

- **Casting a concentration spell** while already concentrating: cast dialog shows "⚠ will end *Bless*"; on Cast, the single atomic patch replaces `concentrating_on` **and** strips concentration-linked effects (`dropConcentrationEffects`) **and** appends the new spell's effects. No window where state disagrees with itself.
- **Ending concentration manually** (the existing X on the concentration badge): now also strips linked effects in the same patch. The badge additionally lists what will end.
- **Damage while concentrating** (the prompt): `HPTracker.applyDamage` currently patches HP directly. M3 threads a post-damage callback: when `damage > 0 && state.concentrating_on`, a **ConcentrationPrompt** dialog opens: "You took 14 damage while concentrating on *Bless*. CON save DC 12." Buttons: **Roll CON Save** (dice engine, kind `concentration`; auto-resolves — success keeps, failure drops concentration + linked effects in one patch), **Keep** and **Drop** (manual overrides — the DM may have adjudicated, or War Caster advantage applies and the player rolls with the adv button on the roll popover). DC = `max(10, ⌊damage/2⌋)` computed for them. Death (HP → 0) drops concentration automatically per RAW, no prompt.
- **Linking rule:** an `ActiveEffect` is concentration-linked iff its source spell had `data.concentration === true` at cast time (the `concentration: boolean` snapshot). Exactly one concentration source can exist, but it may have produced multiple entries in principle — the drop rule is simply "remove all `concentration: true` entries", which is correct in every case and never orphans anything.

### 6.7 Active Effects widget

New left-column widget `components/sheet/active-effects-widget.tsx` between `ResourcesWidget` and `ActivationToggles` (hidden when empty, like Resources):

```
╭─ ACTIVE EFFECTS ─────────────────────────╮
│  ✦ Mage Armor          7h 52m        [×] │
│  ✦ Bless  🧠           1 min (10 rd) [×] │
│  [+ Add effect]                          │
╰──────────────────────────────────────────╯
```

🧠 marks concentration linkage (removing it via × is a concentration drop and says so). **+ Add effect** covers the DM-reality escape hatch: apply any spell the character knows *or* a custom entry (name + optional flat stat modifier + duration) — custom entries make cover bonuses, potion buffs, and DM rulings representable without content rows. Rage stays in `ActivationToggles` (it's a feature toggle with `StateCondition` gating, not a duration effect); unifying toggles into this widget is a noted follow-up, not M3 scope.

Mobile: the widget lives in the left-column slot `MobileSheet` already mirrors — no separate work beyond a render test.

---

## 7. Context integration summary

`CharacterContext` gains two hooks and extends one:

```ts
// New
export function useRolls(): {
  rolls: RollLogEntry[];                          // hydrated + session
  roll: (req: RollRequest) => RollResult;         // execute → toast → log → persist
};
export function useActiveEffects(): {
  activeEffects: ActiveEffect[];
  applyEffect: (entry: ActiveEffect) => Promise<void>;
  removeEffect: (id: string) => Promise<void>;    // concentration-aware
  addCustomEffect: (input: CustomEffectInput) => Promise<void>;
};

// Extended
useSpells() += { castSpell: (spell, choice: CastChoice) => Promise<CastOutcome> };
useRest()   — long rest patch now includes HD recovery + active-effect clearing
```

Provider changes: `initialRolls` prop (server-fetched last 50), `active_effects` read from `initialState` like every other state field, and the `combinedEffects` line from §6.4. The provider stays the single owner of play-state; components keep consuming slices.

Server page changes ([`app/(app)/characters/[id]/page.tsx`](../../app/(app)/characters/[id]/page.tsx)): one added query for recent rolls; class content fetch already provides `hit_die` via existing `classData`.

---

## 8. Out of scope (explicit)

- **Initiative/combat tracker, turn order, targets** — no target selection; damage rolls report numbers, players apply them. Campaign-era work.
- **Automatic condition mechanics** (Restrained imposing disadvantage, etc.) — conditions stay display-only pills.
- **Mystic Arcanum, Spell Mastery, Signature Spells, innate feature casting** — M6 (Arcane Recovery alone is pulled forward, §4.6).
- **Realtime multi-viewer sync** of rolls/effects — table design is ready for it (D2); the subscription work waits on Victor's multiplayer decision (GAME-PLAN §6 #6).
- **3D dice / roll animations** — toast + breakdown only.
- **Homebrew authoring UI for effects/durations** — M4; M3's contribution is that the pipeline is data-driven so M4 forms write the same shapes.
- **Wild Shape / polymorph stat replacement** — far exceeds the effect vocabulary; M5 companions territory.

---

## 9. Data & migration summary

| Migration | Contents |
|---|---|
| `00038_character_rolls.sql` | roll-log table + indexes + RLS (§3.5) |
| `00039_spell_effect_enrichment.sql` | `effects[]` + `duration_structured` on ~12 SRD buff spells; `descriptionCantripDie` backfill for the ~14 cantrips missing it (§4.4, §6.4) |

State additions (no migration — additive JSONB): `hit_dice_spent`, `active_effects`. Schema (Zod) additions: `duration_structured` on `spellDataSchema`; `activeEffectSchema` + `effectDurationSchema` in a new `lib/schemas/active-effects.ts` (validated at the state boundary when M4's content validation lands; typed today).

## 10. Verification (milestone-level)

The per-PR criteria live in the plan. Milestone exit is demonstrated by one UAT script on the existing test characters:

1. **Wizard L3:** cast Mage Armor (1st slot) → slot dot fills, Active Effects shows "Mage Armor · 8h", AC becomes `13 + DEX` while unarmored; equip armor → AC reverts (condition works live). Cast Magic Missile upcast at 2nd → 2nd-level slot consumed, damage button rolls `4d4+4`, roll toasts + appears in log. Short rest → Arcane Recovery offers 2 slot-levels → recover the 2nd-level slot.
2. **Cleric L1:** cast Bless (concentration) → 🧠 badge; attack roll from Actions shows `+1d4 (Bless)` in the breakdown; take 15 damage → concentration prompt DC 12 → roll fails → Bless gone from widget, badge cleared.
3. **Fighter 3 / Wizard 2:** short rest → spend 2× d10 hit dice → HP heals by rolled amounts, pools show 1/3 and 2/2; long rest → pools recover ⌊5/2⌋ = 2 dice (d10 first), slots restore, active effects clear.
4. **Any character:** ability/save/skill/initiative clicks roll with adv/dis; death saves at 0 HP roll with RAW nat-1/nat-20 handling; refresh the page → roll log still shows the session's rolls.
5. `npx vitest run` green; no console errors on the flows above.
