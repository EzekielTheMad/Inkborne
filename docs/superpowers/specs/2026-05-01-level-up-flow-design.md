# Level-up flow (in-rail button) — design spec

**Date:** 2026-05-01
**Status:** Design approved, ready for implementation plan
**Slice:** PR-D of the Builder UX Polish phase (M2). Builds on PR-A's `<ClassPreviewModal>`, PR-B's `<ClassStepRail>`, and PR-C's `<ClassPickerPanel>`. PR-E ships mobile; PR-F ships character-color carry-through.

Source design bundle: [`docs/design-briefs/builder-ux-polish-design-files/`](../../design-briefs/builder-ux-polish-design-files/) — variant Model B in `level-up-flow.jsx` (artboards L1 RailIdle, L2 NewLevelChoice; L3 Mobile is PR-E). Companion specs: [`2026-04-27-class-preview-modal-design.md`](2026-04-27-class-preview-modal-design.md), [`2026-04-27-class-step-rail-design.md`](2026-04-27-class-step-rail-design.md), [`2026-04-27-multiclass-picker-design.md`](2026-04-27-multiclass-picker-design.md).

---

## Goal

Ship the in-rail "+ Level up [Class]" button + the new-level choice pane (with NEW LEVEL ribbon, choice cards, HP picker) + Confirm/Cancel-level-up flow. Add an HP-rule precedence chain (campaign → system → default) so the engine respects per-table HP conventions, and lazily store user-set HP rolls per class+level.

This is the *guided* level-up path. The existing PR-B level `<select>` dropdown stays as the power-user / multi-jump / level-down path. Going *up* via the dropdown does not trigger this flow — choices land as red-dot pills the user fills in afterward.

## Non-goals

- **DM-facing UI for setting `campaigns.hp_rule`.** PR-D ships the *read* path. Setting the value is a campaign-settings PR.
- **System-level `hp_rule` editor.** SRD seed sets `"free_choice"`. Editing systems is admin-only and out of M2.
- **Re-roll mechanics** (re-roll 1s, minimum-half floor). RAW base only for now.
- **Multi-level dropdown jumps trigger the flow N times.** The dropdown sets level immediately; choices land as red-dot pills.
- **Mobile bottom-sheet variant.** PR-E.
- **Character primary color carry-through to ribbon/button.** PR-F.
- **Class section collapse/expand.** Polish PR.
- **HP rolling animation (dice tumble).** YAGNI for the integer count-up.
- **History of HP rolls per level.** Current shape stores final value only.

## File layout

**New files:**

| File | Responsibility |
|---|---|
| `lib/builder/level-up-rules.ts` | Pure helpers. `HpRule` type + `resolveHpRule(campaign, system)` precedence + `hpContributionForLevel(...)` per-level decision tree. |
| `components/builder/class-step-rail/level-up-button.tsx` | Rail tile. Idle / disabled-with-reason / active-flow states. Tone-coded gold/purple per class. |
| `components/builder/class-step-rail/level-up-pane.tsx` | Main-pane content during the in-flight flow. Composes choice cards (existing) + HP picker + ribbon + action bar. |
| `components/builder/class-step-rail/hp-picker.tsx` | Average/Roll/Manual toggle + value display. Reused by `<LevelUpPane>` AND `<ClassLevelPane>` for retroactive editing. |
| `components/builder/class-step-rail/level-up-action-bar.tsx` | "Cancel level-up" + Confirm bar. Computes the `Will set X to Lv N · character to Lv M` summary. Confirm gated by all-choices-made + HP-set. |

**Modified files:**

| File | Changes |
|---|---|
| `components/builder/class-step-rail/index.tsx` | Add `levelUpDraft` state; render `<LevelUpButton>` per class; swap main pane to `<LevelUpPane>` when draft active; propagate hard-lock disabled props. Mutually exclusive with PR-C's `showPicker`. |
| `components/builder/class-step-rail/level-rail.tsx` | Accept `disabled` (mid-flow lock) and `onLevelUpClick`. Disable level dropdown + Remove button when `disabled`. Render the trailing `<LevelUpButton>`. |
| `components/builder/class-step-rail/add-class-row.tsx` | Accept `disabledReason` to render the locked variant with a "Finish active level-up first" message during a flow (overrides PR-C's prereq lock messaging). |
| `components/builder/class-step-rail/class-level-pane.tsx` | Surface `<HpPicker>` for non-Lv1-primary levels (lazy retrofit). Add a graceful empty-state message when `activePerLevel.find(r => r.level === selected.level)` is undefined (PR-B carryover follow-up). |
| `lib/character/max-hp.ts` | Extend `computeMaxHp(...)` to accept `hpRolls` map + `hpRule`. Delegate per-level math to `hpContributionForLevel`. |
| `lib/types/character.ts` | Add `hp_rolls?: Record<string, HpRollRecord>` to `CharacterChoices`. Export `HpRollRecord`. |
| `app/(app)/characters/[id]/builder/class/class-step-client.tsx` | Resolve `hpRule` via the precedence chain. Pass `hpRule`, `hpRolls`, and Confirm/Cancel handlers to the rail. |
| `app/(app)/characters/[id]/builder/class/page.tsx` | Join `campaigns.hp_rule` (when the character is in a campaign) and pass through to the client component. |
| `tests/components/builder/class-step-rail.test.tsx` | Append integration + atomic-component tests (per the test plan below). |
| `tests/lib/character/max-hp.test.ts` | Extend with `hpRolls`/`hpRule` cases. |

**Database:**

- Migration: `ALTER TABLE campaigns ADD COLUMN hp_rule TEXT NULL;`
- `game_systems.schema_definition.hp_rule` — documented JSONB convention. SRD seed updates set `"free_choice"`. No migration; just a documented field path.
- `characters.choices` — already JSONB; `hp_rolls` slots in without migration.

**PR-A/B/C carryover follow-ups (bundled into PR-D):**

- "No class data for the selected level." empty-state polish (PR-B regression).
- `setupRail()` test helper exposing `onAddClass` in `handlers` (PR-C reviewer note).
- Drop dead `contentRefs` prop on `<ClassStepRail>` (PR-C reviewer note).

## Component shape (in-flight flow)

```
<ClassStepRail levelUpDraft={...}>
├── <aside aria-label="Class levels">
│   ├── <LevelRail classIndex={0} disabled={isOtherClassActive(0)}>
│   │   ├── <LevelPill /> × selectedClasses[0].level   — confirmed levels (1..6 for Paladin Lv6 → Lv7 flow)
│   │   ├── <LevelPill n={draftLevel} active choice /> — DRAFT pill, only when this is the active class
│   │   └── <LevelUpButton state="active-flow" />      — disabled with "In progress" label
│   ├── <LevelRail classIndex={1} disabled>
│   │   ├── <LevelPill /> × selectedClasses[1].level   — confirmed levels for the other class
│   │   └── <LevelUpButton state="disabled" reason="Finish Pal 7 first" />
│   ├── <Separator />
│   └── <AddClassRow disabled disabledReason="Finish active level-up first" />
└── <main>
    └── <LevelUpPane>                — replaces ClassLevelPane while levelUpDraft != null
        ├── <header>
        │   ├── breadcrumb: ClassEmblem · "Paladin" › "Level 7" · <NewLevelRibbon />
        │   ├── <h2>{level.featureName}</h2>
        │   └── <p>{level.description}</p>
        ├── <section eyebrow="What this level grants">
        │   └── <FeatureCard /> × N            — passive features (reused PR-B component)
        ├── <section eyebrow="Choices for this level">  — only if level has choices
        │   └── <ChoiceCardSubclass | ChoiceCardASI | ChoiceCardFightingStyle | ChoiceCardGeneric />
        ├── <section eyebrow="Hit points">
        │   └── <HpPicker hpRule={resolved} hitDie={d10} conMod={+3} value={...} onChange={...} />
        └── <LevelUpActionBar
              draftSummary="Will set Paladin to Lv 7 · character to Lv 10"
              canConfirm={allChoicesMade && hpSet}
              onCancel={...} onConfirm={...}
            />
```

**Pill rendering note:** The confirmed `<LevelPill>`s are rendered from `selectedClasses[i].level` (1..N where N is the current confirmed level). The DRAFT pill is rendered separately from `levelUpDraft.draftLevel` and only when `levelUpDraft.classIndex === i`. The draft pill has `active={true}` (it's where the pane is focused) and `hasUnmadeChoice={true}` (the red dot indicator) until Confirm fires. After Confirm, `selectedClasses[i].level` becomes `draftLevel`, so the pill is now rendered from the regular path with its red-dot state cleared (or persisting if any choice still hasn't been made — in which case Confirm wouldn't have been allowed in the first place).

### `<LevelUpButton>`

Tone-coded per class via the existing `classTone(slug)` helper from `lib/builder/class-tone.ts` (gold for martial / purple for caster — same mapping as `<ClassEmblem>` and `<LevelPill>`). Three states:

- **idle** — accent border + filled circular `+` glyph + `Level up Paladin` label + `Lv {atLevel + 1}` glyph on the right. `<button type="button" aria-label="Level up Paladin to level 7">`.
- **disabled-with-reason** — dashed border, muted-foreground text, `aria-disabled="true"`, reason rendered inline (e.g. `"Finish Pal 7 first"`, `"Lv 20 (max)"`, `"Character at Lv 20 (max)"`). Click is no-op. Disabled style is identical regardless of class tone (no accent color in this state).
- **active-flow** — same DOM as disabled-with-reason but reason text is `"In progress"`, and the border keeps the class accent at reduced opacity (gold/purple at ~0.25) so the user sees which class is currently being leveled.

### `<LevelUpPane>`

Full main-pane replacement during a flow. Self-contained:

- Header: breadcrumb + `<NewLevelRibbon>` (gold uppercase pill, `role="status" aria-label="Pending new level"`).
- "What this level grants" feature cards — reuses `<FeatureCard>` from PR-B.
- "Choices for this level" — only renders if the level has choices. Uses the same `<ChoiceCardASI>`, `<ChoiceCardSubclass>`, `<ChoiceCardFightingStyle>`, `<ChoiceCardGeneric>` instances as PR-B. Same handlers, same state. Choices persist to `localChoices` immediately on edit (Q2A).
- "Hit points" — `<HpPicker>` (see below).
- `<LevelUpActionBar>` at the bottom.

### `<HpPicker>`

Reused by both `<LevelUpPane>` (for the new level) and `<ClassLevelPane>` (for retroactively editing existing levels — Q9 lazy retrofit). Props:

```ts
interface HpPickerProps {
  classSlug: string;
  level: number;
  hitDie: number;             // e.g. 10 for d10
  conMod: number;             // current CON modifier
  isFirstLevelOfPrimary: boolean;  // if true, do not render this picker — engine pins the value to max die
  hpRule: HpRule;             // resolved rule; "free_choice" enables interaction, others render read-only
  storedRoll: HpRollRecord | undefined;
  onChange: (record: HpRollRecord) => void;
}
```

Renders as a `<div role="radiogroup" aria-labelledby="hp-method-label">` with three options. The stored `value` is always the raw die contribution (before CON); the picker DISPLAYS `value + conMod` to the user:
- **Average** — `<button role="radio">` showing `Average (+{avg + conMod})`. Click → `onChange({ method: "average", value: avg })` where `avg = floor(die/2) + 1`.
- **Roll d{die}** — `<button role="radio">`. Click → roll via `crypto.getRandomValues` to get integer in [1, die], then `onChange({ method: "rolled", value: rolled })`. Display shows `+{rolled + conMod}`. Re-clicking re-rolls and overwrites (no roll history).
- **Manual** — `<button role="radio">` reveals a numeric input (`aria-label="Manual HP value"`). User enters the raw die contribution (validated as integer in [1, die]). Submit on blur or Enter. `onChange({ method: "manual", value: N })`. Display shows `+{value + conMod}`.

**Picker visibility/interactivity by rule:**

| `hpRule` | What renders | User interaction |
|---|---|---|
| `free_choice` | All three method buttons + value | Full interaction |
| `rolled_only` | Roll d{die} button only + value | User must roll; cannot pick Average or Manual |
| `average_only` | Read-only display `"Campaign rule: Average — +N"` | None (`aria-disabled="true"` on the radiogroup) |
| `max_for_all` | Read-only display `"Campaign rule: Max — +N"` | None |
| `max_first_level_each_class` AND `level === 1` of any class | Read-only display `"First level of class — Max — +N"` | None |
| `max_first_level_each_class` AND `level > 1` | Falls through to `free_choice` rendering | Full interaction |

The picker does NOT render at all when `isFirstLevelOfPrimary` is true — that level's HP is pinned to max die by RAW.

### `<LevelUpActionBar>`

Bottom-of-pane bar with three slots:

- Left: `<Button variant="outline" size="sm">Cancel level-up</Button>`. Click → trigger Cancel flow.
- Middle (small muted text): `Will set {className} to Lv {draftLevel} · character to Lv {totalLevelAfterConfirm}`.
- Right: `<Button variant="default">Confirm level {draftLevel}</Button>`. Disabled until all choices made + HP set. When disabled, has `aria-describedby` pointing to a hidden text node explaining what's missing.

## Data model

### `CharacterChoices` extension

```ts
export type HpRollMethod = "average" | "rolled" | "manual";

export interface HpRollRecord {
  method: HpRollMethod;
  /** Raw die contribution for this level, BEFORE CON modifier.
   *  For "average": floor(die/2) + 1.
   *  For "rolled":  the random die roll (1..die).
   *  For "manual":  the user-entered integer (1..die).
   *  computeMaxHp adds CON modifier separately, so a later ASI raising CON
   *  automatically reflects in total HP without invalidating any stored rolls. */
  value: number;
}

export interface CharacterChoices {
  // existing fields...
  hp_rolls?: Record<string, HpRollRecord>;
}
```

Key shape: `{classSlug}-{level}` — e.g. `"paladin-7"`. Lv 1 of primary class is *not* stored (it's RAW max die, computed by the engine without consulting `hp_rolls`).

### `HpRule` enum

```ts
export type HpRule =
  | "free_choice"                    // default; user picks per level
  | "average_only"                   // engine pins to average; picker read-only
  | "rolled_only"                    // user must roll; engine falls back to average until rolled
  | "max_first_level_each_class"     // first level of every class = max die; rest follow free_choice
  | "max_for_all";                   // every level = max die; picker read-only
```

### Database

```sql
ALTER TABLE campaigns ADD COLUMN hp_rule TEXT NULL;
```

Nullable. NULL = inherit from system. Future PRs add a CHECK constraint or a Zod validator at the API boundary.

`game_systems.schema_definition.hp_rule` is a documented JSONB key. SRD seed sets `"free_choice"`. Engine reads via `schema.hp_rule` after the JSONB load.

## HP rule precedence

Resolved once at the page level (in `class-step-client.tsx`):

```ts
import { resolveHpRule } from "@/lib/builder/level-up-rules";

const hpRule = resolveHpRule(
  character.campaign?.hp_rule,
  schema?.hp_rule,
);
```

Implementation:

```ts
export function resolveHpRule(
  campaignRule: HpRule | null | undefined,
  systemRule: HpRule | null | undefined,
): HpRule {
  return campaignRule ?? systemRule ?? "free_choice";
}
```

Campaign overrides system. System overrides default. Default is `"free_choice"`.

## Engine integration

`computeMaxHp` is extended to accept `hpRolls` and `hpRule`:

```ts
export function computeMaxHp(
  classes: ClassChoice[],
  classContent: Record<string, ClassContentEntry>,
  constitutionScore: number,
  hpRolls: Record<string, HpRollRecord> = {},
  hpRule: HpRule = "free_choice",
): number {
  if (classes.length === 0) return 0;
  const conMod = abilityMod(constitutionScore);

  let total = 0;
  classes.forEach((cls, classIndex) => {
    const die = hitDieFor(cls.slug, classContent);
    const isPrimary = classIndex === 0;

    for (let level = 1; level <= cls.level; level++) {
      const contribution = hpContributionForLevel({
        classSlug: cls.slug,
        level,
        die,
        isFirstLevelOfPrimary: isPrimary && level === 1,
        isFirstLevelOfClass: level === 1,
        storedRoll: hpRolls[`${cls.slug}-${level}`],
        rule: hpRule,
      });
      total += Math.max(1, contribution + conMod);
    }
  });

  return total;
}
```

`hpContributionForLevel` lives in `level-up-rules.ts`. Resolution order per level:

1. **Lv 1 of primary class** → always `die` (max). RAW. `hpRolls` and `hpRule` ignored.
2. **`rule === "max_for_all"`** → always `die`. Picker disabled, displays the rule.
3. **`rule === "max_first_level_each_class"`** AND `isFirstLevelOfClass` → `die`. Picker disabled, displays the rule. Other levels fall through to step 4 with `rule = "free_choice"` semantics.
4. **`rule === "average_only"`** → always `averageHitDie(die)`. Picker disabled.
5. **`rule === "rolled_only"`** → uses `storedRoll.value` directly (raw die contribution); else `averageHitDie(die)` until rolled. Picker shows roll-only.
6. **`rule === "free_choice"`** (default):
   - If `storedRoll` exists → use `storedRoll.value` directly.
   - Else → `averageHitDie(die)` (lazy retrofit display default).

> **Note on `storedRoll.value` semantics:** the stored value is the **raw die contribution**, BEFORE CON modifier. The picker displays `value + conMod` to the user (e.g. shows `+9` for a rolled `8` with CON +1), but persists only the `8`. `computeMaxHp` adds CON separately via its per-level loop. This way, changing CON later (e.g. via an ASI) automatically reflects in total HP without invalidating any stored rolls.

> **Note on `storedRoll.value` semantics:** the picker stores `value = die_contribution + conMod` (the displayed/added HP for that level). The engine subtracts conMod to get the raw die contribution, then re-adds it inside `computeMaxHp`'s loop. This avoids a double-CON-add and lets CON changes (e.g. ASI raising CON) automatically reflect in past levels' total HP without re-rolling.

## State machine

Rail-local React state. One new state slot for PR-D:

```ts
const [levelUpDraft, setLevelUpDraft] = useState<{
  classIndex: number;
  draftLevel: number;
} | null>(null);
```

Mutually exclusive with PR-C's `showPicker`. Opening one closes the other.

```
                     IDLE
                     levelUpDraft = null
                     (showPicker = ? — independent)
                       │
                       │ click "+ Level up Paladin"
                       ▼
                     LEVEL_UP_FLOW
                     levelUpDraft = { classIndex, draftLevel }
                     showPicker = false (forced)
                     pane = <LevelUpPane>
                     all other rail mutators DISABLED (Q8)
                       │           │
       Cancel-level-up │           │ Confirm level N
       (or Esc)        │           │ (enabled when all choices made + HP set)
                       ▼           ▼
                     IDLE        IDLE (with selectedClasses[i].level bumped)
                     levelUpDraft=null   The HP roll is already persisted on each
                     Choice/HP edits     <HpPicker> change; Confirm bumps the level
                     stick (orphaned     and clears the draft.
                     until re-leveled)
```

`selected` (existing PR-B state) auto-tracks `{ classIndex: levelUpDraft.classIndex, level: levelUpDraft.draftLevel }` while the flow is active so the new level's pill renders as the active one.

## Interactions

| Trigger | Behavior |
|---|---|
| Click `<LevelUpButton>` (idle) | If `showPicker`, close it. `setLevelUpDraft({ classIndex, draftLevel: cls.level + 1 })`. Pane swaps to `<LevelUpPane>`. Focus moves to the pane's `<h2>`. |
| Click another class's `<LevelUpButton>` mid-flow | No-op; `aria-disabled="true"`; reason text on hover/focus. |
| Click `<LevelPill>` for a different level in active class during flow | No-op visually. Active flow takes priority. |
| Click `<LevelPill>` for a different class during flow | Disabled (rail is locked). |
| Press Escape inside `<LevelUpPane>` | Triggers Cancel-level-up. |
| Click "Cancel level-up" | `setLevelUpDraft(null)`. Pane returns to `<ClassLevelPane>` for the previously-selected level. Choice/HP edits stick. |
| Click "Confirm level N" (enabled) | Single transaction: bump `selectedClasses[classIndex].level`; `setLevelUpDraft(null)`. Pane swaps to `<ClassLevelPane>` showing the new level. HP roll is already persisted. |
| Click `<HpPicker>` "Roll d{die}" | Generate roll via `crypto.getRandomValues`. Persist `hp_rolls[key] = { method: "rolled", value }` immediately. Re-clicking re-rolls. |
| Click `<HpPicker>` "Average" | Persist `hp_rolls[key] = { method: "average", value: avg + conMod }` immediately. |
| Click `<HpPicker>` "Manual" | Reveal numeric input. Submit on blur/Enter. Persist `hp_rolls[key] = { method: "manual", value: N }`. Empty input keeps Confirm disabled. |
| `<HpPicker>` with rule != free_choice | Toggle disabled. Displays rule + computed value. |

**Confirm-button enable logic:**

```ts
const canConfirm =
  allRequiredChoicesAreMade(draftLevel, classContent, localChoices) &&
  (isFirstLevelOfPrimary || hpRolls[`${classSlug}-${draftLevel}`] != null);
```

The `allRequiredChoicesAreMade` predicate checks that every choice introduced at the new level has a value in `localChoices.asi_choices` / `localChoices.resolved_choices` / `localChoices.classes[i].subclass`. Tooltip on disabled state names what's missing.

## A11y

- `<LevelUpButton>` (idle): `<button type="button" aria-label="Level up [Class] to level [N]">+ Level up [Class]</button>`. The `Lv {N}` glyph is `aria-hidden`.
- `<LevelUpButton>` (disabled): `aria-disabled="true"` (not the `disabled` attribute) so screen readers still announce the reason. Reason text is in an `aria-describedby` paragraph.
- `<LevelUpPane>`: `<section aria-labelledby="level-up-heading">` wrapping the breadcrumb + `<h2 id="level-up-heading">`. Focus auto-moves to the heading on flow open.
- `<NewLevelRibbon>`: `<span role="status" aria-label="Pending new level">NEW LEVEL</span>`. The `role="status"` polite live region announces it on flow start.
- `<HpPicker>`: `<div role="radiogroup" aria-labelledby="hp-method-label">`. Each method is `<button role="radio" aria-checked={isSelected}>`. Manual input has `aria-label="Manual HP value"`.
- `<LevelUpActionBar>` Confirm button (disabled): `aria-describedby` points to a hidden text node explaining what's missing.
- Tab order in `<LevelUpPane>`: heading → choice cards → HP picker → Cancel → Confirm. Esc anywhere triggers Cancel.
- Disabled `<LevelUpButton>`s on other classes: dashed outline + reason text always visible (not tooltip-only) so the lock is discoverable without hover.

## Animations

- `<LevelUpButton>` → `<LevelUpPane>` swap: instant. No transition.
- `<NewLevelRibbon>`: fades in (200ms ease-out) on flow open. Removed instantly on Confirm/Cancel.
- HP picker value change: integer animates with a brief +/- delta count (200ms tabular-nums tween) so the user sees the value land. Skip if `prefers-reduced-motion: reduce`.
- Pill in the rail showing the draft level: fades in with the ribbon. Has the red-dot "unmade choice" indicator until Confirm.
- All transitions wrapped in Tailwind's `motion-safe:` variant.

## Tests

vitest + testing-library:

1. **`lib/builder/level-up-rules.ts`** (TDD, pure):
   - `resolveHpRule(campaign, system)`: campaign wins; system fallback; default fallback.
   - `hpContributionForLevel`:
     - Lv 1 primary always returns max die regardless of rule/storedRoll.
     - `max_for_all` returns max die for every non-Lv1-primary level.
     - `max_first_level_each_class` returns max die for `level === 1` of any class; rest fall through to free_choice.
     - `average_only` returns `averageHitDie(die)`.
     - `rolled_only` with `storedRoll` returns `storedRoll.value - conMod` (note: pure helper takes `conMod`-extracted contributions; CON math is in `computeMaxHp`).
     - `rolled_only` without `storedRoll` falls back to average.
     - `free_choice` with `storedRoll` returns the stored contribution.
     - `free_choice` without `storedRoll` returns average.

2. **`lib/character/max-hp.ts`** (extend):
   - `computeMaxHp` with `hpRolls` populated for some levels and missing for others.
   - Multiclass with mixed rules.
   - Negative CON still floors at +1 per level.
   - Backwards compat: `hpRolls = {}` and `hpRule = "free_choice"` matches today's output exactly.

3. **`<LevelUpButton>`:**
   - Renders idle / disabled-with-reason / active-flow states.
   - Tone-coded gold (martial classes) and purple (caster classes).
   - `aria-disabled="true"` only in disabled states.
   - `onClick` only fires in idle state.

4. **`<HpPicker>`:**
   - Renders 4 distinct states: free_choice unset, free_choice with stored value, rule-locked display, manual input mode.
   - `onChange` writes correct `HpRollRecord` shape per method.
   - Rule-locked picker is non-interactive (`aria-disabled`).
   - Re-rolling overwrites the stored value.
   - Doesn't render when `isFirstLevelOfPrimary={true}`.

5. **`<LevelUpActionBar>`:**
   - Confirm disabled when missing choices or HP.
   - Summary text reflects `draftLevel` and computed total character level.
   - `onCancel` and `onConfirm` fire on click.

6. **`<LevelUpPane>`:**
   - Composes feature cards + (optional) choice cards + HP picker + ribbon + action bar.
   - "Choices for this level" section renders only when level has choices.
   - Confirm button enable state reflects choices + HP picker.

7. **`<ClassStepRail>` integration (append to existing test file):**
   - Clicking `<LevelUpButton>` opens the flow + locks the rail (other LevelUpButtons disabled, dropdowns disabled, AddClassRow disabled, Remove buttons disabled).
   - Cancel-level-up reverts to prior pane and re-enables the rail.
   - Confirm bumps `selectedClasses[i].level`, clears `levelUpDraft`, and lands on the new pane.
   - Mutual exclusion with `showPicker` from PR-C: opening flow closes picker.
   - HP roll persistence is incremental (each picker change persists immediately, not just on Confirm).
   - Hard-lock disabled propagation: AddClassRow's `disabledReason` overrides PR-C's prereq lock messaging while the flow is active.

8. **Manual UAT** (browser, via test account):
   - Free-choice character: open flow, Cancel keeps choice/HP edits.
   - Free-choice character: open flow, Confirm lands new level + new pill.
   - Campaign-locked character (manually set `campaigns.hp_rule = "max_for_all"`): HP picker shows read-only display.
   - Lv1-primary doesn't render the picker.
   - Lv 20 character: button shows `"Character at Lv 20 (max)"`.
   - Class at Lv 20 in a multiclass build: button shows `"Lv 20 (max)"`.
   - Multi-class scenario: hard lock during a flow on one class disables the others.
   - Existing characters (Voltee, Xero) without `hp_rolls`: HP widget shows the lazy-retrofit default; engine output unchanged.

## Implementation references

- Source design: [`docs/design-briefs/builder-ux-polish-design-files/level-up-flow.jsx`](../../design-briefs/builder-ux-polish-design-files/level-up-flow.jsx) (artboards `LevelUpL1_RailIdle`, `LevelUpL2_NewLevelChoice`).
- Screenshot: [`docs/design-briefs/builder-ux-polish-design-files/screenshots/04-level-up-flow.png`](../../design-briefs/builder-ux-polish-design-files/screenshots/04-level-up-flow.png).
- PR-A spec (modal): [`2026-04-27-class-preview-modal-design.md`](2026-04-27-class-preview-modal-design.md).
- PR-B spec (rail): [`2026-04-27-class-step-rail-design.md`](2026-04-27-class-step-rail-design.md).
- PR-C spec (multiclass picker): [`2026-04-27-multiclass-picker-design.md`](2026-04-27-multiclass-picker-design.md).
- Existing engine: `lib/character/max-hp.ts` — `computeMaxHp(classes, classContent, conScore)`. PR-D extends with `hpRolls` + `hpRule`.
- Reused PR-A primitives: `<ClassEmblem>`, `lib/builder/class-tone.ts`.
- Reused PR-B primitives: `<FeatureCard>`, `<ChoiceCardASI>`, `<ChoiceCardSubclass>`, `<ChoiceCardFightingStyle>`, `<ChoiceCardGeneric>`, `<LevelPill>`, `<LevelRail>`.
- Reused PR-C primitives: `<ClassStepRail>` (extended), `<AddClassRow>` (extended).

## Out of scope / deferred (recap)

| Item | When |
|---|---|
| DM-facing UI for `campaigns.hp_rule` | Future campaign-settings PR |
| System-level `hp_rule` editor | Admin-only, post-M2 |
| Re-roll mechanics (re-roll 1s, minimum-half) | Variant-rules follow-up |
| Multi-level dropdown jumps trigger flow N times | Power-user dropdown stays as-is |
| Mobile bottom-sheet variant | PR-E |
| Character primary color carry-through | PR-F |
| Class section collapse/expand | Polish PR |
| HP rolling animation (dice tumble) | YAGNI |
| HP roll history per level | YAGNI |
