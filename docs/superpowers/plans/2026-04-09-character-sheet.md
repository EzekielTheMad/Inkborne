# Character Sheet (Play Mode) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full-page play-mode character sheet with three-column desktop layout, swipeable mobile tabs, HP tracking, conditions, death saves, skills, features, and tabbed content sections.

**Architecture:** Full-page sheet at `/characters/[id]/sheet` with no app nav. Server Component fetches character + system + content refs, runs expression engine, passes computed data to client components. Desktop uses three-column grid; mobile uses swipeable tab sections with fixed tab bar. Interactive state (HP, conditions, death saves, notes) persists to character.state JSONB via Supabase.

**Tech Stack:** Next.js App Router, TypeScript, Supabase, shadcn/ui, Tailwind CSS (semantic colors only), expression engine from lib/engine/

**Spec:** `docs/superpowers/specs/2026-04-09-character-sheet-design.md`

---

## File Map

### Types (modify)
- `lib/types/character.ts` — Expand `CharacterState` interface with conditions, death_saves, inspiration, quick_notes, notes fields + add defaults helper

### Shared Utilities (create)
- `lib/sheet/helpers.ts` — `initializeState()` default builder, `formatModifier()`, `isProficient()`, `hasExpertise()`, `getSkillModifier()`, `getSaveModifier()` helpers

### Data Access Layer (modify)
- `lib/supabase/characters.ts` — Add `updateCharacterState()` function that patches only the `state` JSONB column

### Sheet Page (create — outside app layout)
- `app/characters/[id]/sheet/layout.tsx` — Full-viewport layout with NO app nav (just `<html>` body wrapper)
- `app/characters/[id]/sheet/page.tsx` — Server Component: fetches character + system + content refs, runs evaluate(), passes computed props to SheetClient

### Sheet Client Shell (create)
- `components/sheet/sheet-client.tsx` — Top-level client component managing state (HP, conditions, death saves, inspiration, notes), responsive layout switching

### Header Components (create)
- `components/sheet/character-header.tsx` — Desktop header: avatar placeholder, name (gold), race, class/level, campaign, inspiration toggle, Edit + Back buttons
- `components/sheet/character-header-mobile.tsx` — Compact mobile header: name + class/level on one line, HP readout, back + edit links

### Stat Ribbon Components (create)
- `components/sheet/stat-ribbon.tsx` — Horizontal row: 6 ability cards + divider + combat stats + HP tracker
- `components/sheet/ability-card.tsx` — Single ability score card: name (uppercase muted), modifier (large), score (small)
- `components/sheet/combat-stats.tsx` — Proficiency bonus, AC, Initiative, Speed cards

### HP Tracker (create)
- `components/sheet/hp-tracker.tsx` — Current/Max/Temp display + click-to-open popover with damage/heal/temp input

### Left Column Components (create)
- `components/sheet/saving-throws.tsx` — 2-column grid of save chips with proficiency dot + ability abbr + modifier
- `components/sheet/passive-senses.tsx` — Perception, Investigation, Insight numbered cards
- `components/sheet/conditions.tsx` — Toggleable condition badges, persists to state
- `components/sheet/death-saves.tsx` — 3 success + 3 failure clickable circles, only renders at HP=0
- `components/sheet/quick-notes.tsx` — Collapsible text area, persists to state
- `components/sheet/proficiencies.tsx` — Categorized text lists (Armor, Weapons, Tools, Languages)

### Center Column Components (create)
- `components/sheet/skills-list.tsx` — Full skills list with proficiency indicator, ability label, skill name, modifier

### Right Column / Tabbed Content (create)
- `components/sheet/content-tabs.tsx` — Tab bar + tab content switcher (Actions, Spells, Inventory, Features, Notes)
- `components/sheet/tab-actions.tsx` — Attack table + action-type features with sub-filter pills
- `components/sheet/tab-spells.tsx` — Placeholder with basic spell list from content refs
- `components/sheet/tab-inventory.tsx` — Placeholder with starting equipment list
- `components/sheet/tab-features.tsx` — Features list with filter pills (All, Class Features, Species Traits, Feats, custom types)
- `components/sheet/tab-notes.tsx` — Full-page text area, persists to state

### Mobile Layout (create)
- `components/sheet/mobile-tabs.tsx` — Fixed tab bar + CSS scroll-snap swipeable sections

### Dashboard (modify)
- `app/(app)/characters/[id]/page.tsx` — Remove "Sheet" tab, add "Open Character Sheet" CTA button on Overview

### shadcn/ui (install if missing)
- `components/ui/popover.tsx` — For HP tracker popover
- `components/ui/toggle.tsx` — For condition toggles and inspiration

---

## Task 1: Expand CharacterState Type + Helpers

**Files:**
- Modify: `lib/types/character.ts`
- Create: `lib/sheet/helpers.ts`

- [ ] **Step 1: Update CharacterState interface**

In `lib/types/character.ts`, replace the current `CharacterState` interface with the full shape:

```typescript
export interface CharacterDeathSaves {
  successes: number; // 0-3
  failures: number;  // 0-3
}

export interface CharacterState {
  current_hp?: number;
  temp_hp?: number;
  conditions?: string[];
  death_saves?: CharacterDeathSaves;
  inspiration?: boolean;
  quick_notes?: string;
  notes?: string;
  spell_slots_used?: Record<string, number>;
  [key: string]: unknown;
}
```

Keep the index signature for forward compatibility. The `spell_slots_used` field is retained from the existing type.

- [ ] **Step 2: Create sheet helpers**

Create `lib/sheet/helpers.ts` with:

```typescript
import type { CharacterState, CharacterDeathSaves } from "@/lib/types/character";
import type { GrantEffect } from "@/lib/types/effects";

/** Returns a CharacterState with all fields defaulted. Merges with existing partial state. */
export function initializeState(
  partial: CharacterState,
  maxHp: number,
): CharacterState {
  return {
    current_hp: partial.current_hp ?? maxHp,
    temp_hp: partial.temp_hp ?? 0,
    conditions: partial.conditions ?? [],
    death_saves: partial.death_saves ?? { successes: 0, failures: 0 },
    inspiration: partial.inspiration ?? false,
    quick_notes: partial.quick_notes ?? "",
    notes: partial.notes ?? "",
    spell_slots_used: partial.spell_slots_used ?? {},
  };
}

/** Format a number as a modifier string: "+2", "-1", "+0" */
export function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

/** Check if a grants array includes proficiency for a given stat slug */
export function isProficient(grants: GrantEffect[], stat: string): boolean {
  return grants.some((g) => g.stat === stat && g.value === "proficient");
}

/** Check if a grants array includes expertise for a given stat slug */
export function hasExpertise(grants: GrantEffect[], stat: string): boolean {
  return grants.some((g) => g.stat === stat && g.value === "expertise");
}

/** Compute a skill modifier from ability mod + proficiency bonus (if proficient) */
export function getSkillModifier(
  abilityMod: number,
  proficiencyBonus: number,
  grants: GrantEffect[],
  skillSlug: string,
): number {
  if (hasExpertise(grants, skillSlug)) return abilityMod + proficiencyBonus * 2;
  if (isProficient(grants, skillSlug)) return abilityMod + proficiencyBonus;
  return abilityMod;
}

/** Compute a saving throw modifier from ability mod + proficiency bonus (if proficient) */
export function getSaveModifier(
  abilityMod: number,
  proficiencyBonus: number,
  grants: GrantEffect[],
  saveSlug: string,
): number {
  return isProficient(grants, saveSlug)
    ? abilityMod + proficiencyBonus
    : abilityMod;
}
```

- [ ] **Step 3: Add updateCharacterState to data access layer**

In `lib/supabase/characters.ts`, add a function that patches only the `state` column. This uses the browser client since it will be called from client components:

Create `lib/sheet/update-state.ts`:

```typescript
"use client";

import { createClient } from "@/lib/supabase/client";
import type { CharacterState } from "@/lib/types/character";

/** Patches the character.state JSONB column with partial updates. */
export async function updateCharacterState(
  characterId: string,
  patch: Partial<CharacterState>,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("patch_character_state", {
    character_id: characterId,
    state_patch: patch,
  });

  // Fallback: if RPC doesn't exist, do a read-merge-write
  if (error) {
    const { data } = await supabase
      .from("characters")
      .select("state")
      .eq("id", characterId)
      .single();

    const merged = { ...(data?.state ?? {}), ...patch };
    const { error: updateError } = await supabase
      .from("characters")
      .update({ state: merged })
      .eq("id", characterId);

    if (updateError) throw updateError;
  }
}
```

This uses a read-merge-write pattern. The RPC is optional optimization for the future; the fallback works immediately with no migration.

---

## Task 2: Sheet Page Route + Server Data Fetch

**Files:**
- Create: `app/characters/[id]/sheet/layout.tsx`
- Create: `app/characters/[id]/sheet/page.tsx`

**IMPORTANT:** This route lives at `app/characters/[id]/sheet/` (NOT inside `app/(app)/`). By placing it outside the `(app)` route group, it avoids the app layout with its nav bar, giving the sheet full viewport.

- [ ] **Step 1: Create sheet layout (no app nav)**

Create `app/characters/[id]/sheet/layout.tsx`:

```typescript
export default function SheetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
```

No nav bar. Full viewport. The layout is minimal — just provides the background and text colors.

- [ ] **Step 2: Create sheet page Server Component**

Create `app/characters/[id]/sheet/page.tsx`:

This Server Component:
1. Authenticates the user via Supabase server client
2. Fetches the character with system schema join (reuse `getCharacterWithSystem`)
3. Fetches all content refs with content definitions (reuse `getContentRefsByCharacter`)
4. Collects all effects from content refs
5. Runs `evaluate(baseStatsWithLevel, allEffects, schema)` server-side
6. Computes maxHp from `result.computed.hit_points` (or derived stat)
7. Calls `initializeState(character.state, maxHp)`
8. Passes all computed data + initialized state to `<SheetClient>`

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getCharacterWithSystem } from "@/lib/supabase/characters";
import { getContentRefsByCharacter } from "@/lib/supabase/content-refs";
import { evaluate } from "@/lib/engine/evaluator";
import { initializeState } from "@/lib/sheet/helpers";
import { SheetClient } from "@/components/sheet/sheet-client";
import type { Effect } from "@/lib/types/effects";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CharacterSheetPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const character = await getCharacterWithSystem(id);
  if (!character) notFound();

  const contentRefs = await getContentRefsByCharacter(id);

  // Collect all effects from content refs
  const allEffects: Effect[] = contentRefs.flatMap(
    (ref) => ref.content_definitions?.effects ?? [],
  );

  // Run expression engine server-side
  const baseStatsWithLevel = { ...character.base_stats, level: character.level };
  const schema = character.game_systems.schema_definition;
  const evalResult = evaluate(baseStatsWithLevel, allEffects, schema);

  // Initialize play state with defaults
  const maxHp = evalResult.computed.hit_points ?? 0;
  const initialState = initializeState(character.state, maxHp);

  return (
    <SheetClient
      character={character}
      schema={schema}
      evalResult={evalResult}
      contentRefs={contentRefs}
      initialState={initialState}
      maxHp={maxHp}
    />
  );
}
```

---

## Task 3: SheetClient Shell + Responsive Layout

**Files:**
- Create: `components/sheet/sheet-client.tsx`

- [ ] **Step 1: Build the SheetClient component**

This is the top-level `"use client"` component. It:
- Holds local state for interactive values (currentHp, tempHp, conditions, deathSaves, inspiration, quickNotes, notes)
- Initializes from `initialState` prop
- Provides a `patchState` callback that optimistically updates local state AND calls `updateCharacterState`
- Renders desktop layout (3-column) on `md+` and mobile layout (swipeable tabs) on `<md`
- Uses a `useMediaQuery` hook or Tailwind responsive classes to switch layouts

Desktop layout structure:
```
<CharacterHeader />
<StatRibbon />
<div className="grid grid-cols-[280px_1fr_1fr] gap-4"> (hidden below md)
  <LeftColumn: SaveThrows, Senses, Conditions, DeathSaves, QuickNotes, Proficiencies />
  <CenterColumn: SkillsList />
  <RightColumn: ContentTabs />
</div>
```

Mobile layout structure:
```
<CharacterHeaderMobile />
<MobileTabs /> (hidden above md)
```

Use Tailwind `hidden md:grid` and `md:hidden` to switch between layouts. No JS-based media query needed.

- [ ] **Step 2: Implement patchState callback**

```typescript
const patchState = useCallback(async (patch: Partial<CharacterState>) => {
  // Optimistic local update
  setState((prev) => ({ ...prev, ...patch }));
  // Persist to database
  try {
    await updateCharacterState(character.id, patch);
  } catch (err) {
    console.error("Failed to save state:", err);
    // Could add error toast here in the future
  }
}, [character.id]);
```

All interactive child components receive `patchState` as a prop rather than managing their own persistence.

---

## Task 4: CharacterHeader Components

**Files:**
- Create: `components/sheet/character-header.tsx`
- Create: `components/sheet/character-header-mobile.tsx`

- [ ] **Step 1: Build desktop CharacterHeader**

Full-width row with:
- Left: Avatar placeholder circle (40x40, `border border-border rounded-full bg-muted`), character name (`text-2xl font-bold text-accent`), race + class/level + campaign in `text-muted-foreground`
- Right: Inspiration toggle button, "Edit" link (to `/characters/[id]/builder`), Back button (to `/characters/[id]`)

The name should use `text-accent` for the gold color. Class display: capitalize class slug + level number. Multiple classes shown as "Rogue 5 / Wizard 3".

Inspiration toggle: a simple button/toggle that shows filled star when active, outline when inactive. Calls `patchState({ inspiration: !current })`.

- [ ] **Step 2: Build mobile CharacterHeader**

Compact single-row header:
- Back arrow icon button (links to `/characters/[id]`)
- Character name + class/level on one line (truncated if needed)
- Current HP displayed prominently (clickable, opens HP tracker)
- Edit icon button (links to builder)
- No avatar on mobile to save space

---

## Task 5: StatRibbon + AbilityCard + CombatStats

**Files:**
- Create: `components/sheet/stat-ribbon.tsx`
- Create: `components/sheet/ability-card.tsx`
- Create: `components/sheet/combat-stats.tsx`

- [ ] **Step 1: Build AbilityCard**

Single ability score display:
```
┌──────────┐
│   STR     │  <- text-[10px] uppercase text-muted-foreground
│   +5      │  <- text-2xl font-bold text-foreground
│   21      │  <- text-sm text-muted-foreground
└──────────┘
```

Props: `name: string` (abbreviation), `score: number`, `modifier: number`

Card styling: `rounded-lg border border-border bg-card p-3 text-center min-w-[70px]`

Use `formatModifier()` from helpers to display the modifier with sign.

- [ ] **Step 2: Build CombatStats**

Horizontal group of stat cards:
- **Proficiency Bonus**: `text-accent` value (e.g., "+3"), label "PROF"
- **AC**: value in `text-accent`, `border-primary` ring on the card, label "AC"
- **Initiative**: modifier value, label "INIT"
- **Speed**: value + "ft", label "SPEED"

Each stat card uses the same structure as AbilityCard but smaller. Values come from `evalResult.computed` (proficiency_bonus, armor_class, initiative, speed).

- [ ] **Step 3: Build StatRibbon**

Horizontal flex container assembling:
1. 6 AbilityCards from `schema.ability_scores` mapped with `evalResult.stats[slug]`
2. A visual divider (`<Separator orientation="vertical" />`)
3. CombatStats
4. Another divider
5. HPTracker component

On mobile (within the Stats tab), the ability cards render as a 3x2 grid instead of a horizontal row. Use `className="flex gap-2 overflow-x-auto md:overflow-visible"` for the ribbon container, and `grid grid-cols-3 gap-2 md:flex` for the ability cards section.

---

## Task 6: HP Tracker

**Files:**
- Create: `components/sheet/hp-tracker.tsx`
- Install: `components/ui/popover.tsx` (via `npx shadcn@latest add popover`)

- [ ] **Step 1: Install shadcn popover if not present**

Run: `npx shadcn@latest add popover`

- [ ] **Step 2: Build HP Tracker component**

Display (always visible):
```
┌──────────────────┐
│  12 / 25         │  <- currentHp / maxHp, large text
│  Temp: 5         │  <- temp_hp, smaller, only if > 0
└──────────────────┘
```

HP text color logic:
- Full HP: `text-foreground`
- Below 50%: `text-accent` (gold warning)
- Below 25%: `text-destructive` (red danger)
- At 0: `text-destructive font-bold`

Click opens a Popover with:
- Number input field (auto-focused)
- "Damage" button (`bg-destructive`): subtracts from temp_hp first, then current_hp. Floor at 0.
- "Heal" button (`bg-primary`): adds to current_hp, capped at maxHp.
- "Set Temp" button (outline variant): sets temp_hp to the input value.
- Close on action (popover closes after any button click).

Damage logic:
```typescript
function applyDamage(amount: number) {
  let remaining = amount;
  let newTemp = state.temp_hp ?? 0;
  let newCurrent = state.current_hp ?? 0;

  // Temp HP absorbs first
  if (newTemp > 0) {
    const absorbed = Math.min(newTemp, remaining);
    newTemp -= absorbed;
    remaining -= absorbed;
  }
  newCurrent = Math.max(0, newCurrent - remaining);

  patchState({ current_hp: newCurrent, temp_hp: newTemp });
}
```

Heal logic:
```typescript
function applyHeal(amount: number) {
  const newCurrent = Math.min(maxHp, (state.current_hp ?? 0) + amount);
  patchState({ current_hp: newCurrent });
}
```

Props: `currentHp`, `maxHp`, `tempHp`, `patchState`

---

## Task 7: Saving Throws

**Files:**
- Create: `components/sheet/saving-throws.tsx`

- [ ] **Step 1: Build SavingThrows component**

Section with header "Saving Throws" in `text-accent font-semibold text-sm uppercase tracking-wide`.

2-column grid of save chips. For each ability score in `schema.ability_scores`:
- Compute save slug: `saving_throw_${ability.slug}` (or check grants for pattern)
- Check proficiency: `isProficient(grants, save_slug)`
- Compute modifier: ability mod + (proficient ? proficiency bonus : 0)

Each chip:
```
┌──────────────────┐
│ ● STR      +5    │
└──────────────────┘
```

- Proficiency dot: `●` filled circle in `text-primary` if proficient, `○` hollow circle in `text-muted-foreground` if not
- Expertise dot: `●` filled in `text-accent` (gold)
- Ability abbreviation: uppercase
- Modifier: right-aligned, `text-accent` if proficient, `text-muted-foreground` if not

Proficient chips: `border-primary/50 bg-primary/5` — subtle purple tint
Non-proficient chips: `border-border bg-card` — standard muted

Layout: `grid grid-cols-2 gap-1.5`

---

## Task 8: Passive Senses

**Files:**
- Create: `components/sheet/passive-senses.tsx`

- [ ] **Step 1: Build PassiveSenses component**

Section header "Senses" in gold accent.

Three cards in a row:
- **Passive Perception**: 10 + Wisdom modifier + proficiency_if(perception)
- **Passive Investigation**: 10 + Intelligence modifier + proficiency_if(investigation)
- **Passive Insight**: 10 + Wisdom modifier + proficiency_if(insight)

Each card:
```
┌──────┐
│  14  │  <- text-xl font-bold
│ PER  │  <- text-[10px] uppercase text-muted-foreground
└──────┘
```

Values can be pulled from `evalResult.computed` if the system schema has passive senses as derived stats, or computed inline from ability mods + proficiency.

Layout: `grid grid-cols-3 gap-2`

---

## Task 9: Conditions

**Files:**
- Create: `components/sheet/conditions.tsx`

- [ ] **Step 1: Build Conditions component**

Section header "Conditions" in gold accent.

List of D&D 5e conditions as toggleable badges:
```
Blinded, Charmed, Deafened, Exhaustion, Frightened, Grappled,
Incapacitated, Invisible, Paralyzed, Petrified, Poisoned,
Prone, Restrained, Stunned, Unconscious
```

Each badge is a button:
- Inactive: `bg-muted text-muted-foreground border-border` — muted appearance
- Active: `bg-destructive/10 text-destructive border-destructive/50` — highlighted red tint

Click toggles the condition in/out of the `conditions` array and calls:
```typescript
patchState({
  conditions: isActive
    ? state.conditions.filter((c) => c !== slug)
    : [...state.conditions, slug],
});
```

Layout: `flex flex-wrap gap-1.5`

Badge size: `text-xs px-2 py-1 rounded-md border cursor-pointer`

---

## Task 10: Death Saves

**Files:**
- Create: `components/sheet/death-saves.tsx`

- [ ] **Step 1: Build DeathSaves component**

Only rendered when `currentHp === 0`.

Two rows:
```
Successes:  ● ● ○     (green filled = success, hollow = unfilled)
Failures:   ● ○ ○     (red filled = failure, hollow = unfilled)
```

Each circle is a clickable button. Click increments the count (successes 0->1->2->3->0 wrap, same for failures).

Styling:
- Success circles: filled = `bg-green-500 border-green-500`, empty = `border-green-500/50 bg-transparent`
- Failure circles: filled = `bg-destructive border-destructive`, empty = `border-destructive/50 bg-transparent`
- Circle size: `w-5 h-5 rounded-full border-2`

On change, call:
```typescript
patchState({
  death_saves: { successes: newSuccesses, failures: newFailures },
});
```

If 3 successes reached: could show a subtle "Stabilized" indicator (just text, no game logic).
If 3 failures reached: could show a subtle "Dead" indicator.

NOTE: The green-500 usage here is acceptable since there is no semantic "success" color token in the theme. Keep it minimal — just for the death save circles.

---

## Task 11: Skills List

**Files:**
- Create: `components/sheet/skills-list.tsx`

- [ ] **Step 1: Build SkillsList component**

Section header "Skills" in gold accent.

Renders ALL skills from `schema.skills` sorted alphabetically. For each skill:

```
● DEX  Acrobatics         +7
○ INT  Arcana             +1
```

- Proficiency indicator: `●` if proficient (via `isProficient(grants, skill.slug)`), `◐` if expertise, `○` if none
- Ability abbreviation: `text-muted-foreground text-xs w-8`
- Skill name: `text-sm` — `text-foreground` if proficient, `text-muted-foreground` if not
- Modifier: right-aligned — `text-accent font-medium` if proficient, `text-muted-foreground` if not

Compute modifier using `getSkillModifier()` from helpers.

Proficient skill rows get a subtle background: `bg-primary/5` for visual scanning.

Also include custom skills from content refs where content_type could indicate custom skills (future-proof: just render what the system provides).

Layout: stacked rows with `py-1 px-2 rounded-sm` per row. Full list, no scroll — the center column scrolls naturally.

---

## Task 12: Proficiencies

**Files:**
- Create: `components/sheet/proficiencies.tsx`

- [ ] **Step 1: Build Proficiencies component**

Section header "Proficiencies" in gold accent.

Extracts proficiency grants from `evalResult.grants` and categorizes them:
- **Armor**: grants where `stat` matches armor-related slugs (light_armor, medium_armor, heavy_armor, shields)
- **Weapons**: grants where `stat` matches weapon slugs (simple_weapons, martial_weapons, or specific weapon names)
- **Tools**: grants where `stat` matches tool slugs
- **Languages**: grants where `stat` matches language slugs (common, elvish, etc.)

Each category is a labeled section:
```
Armor
Light, Medium, Shields

Weapons
Simple, Martial, Longsword

Languages
Common, Elvish, Dwarvish
```

Category label: `text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5`
Values: `text-sm text-foreground` — comma-separated, capitalized from slugs

Hide any empty categories. If no proficiencies at all, show nothing (the section just doesn't appear).

---

## Task 13: Content Tabs (Right Column Shell)

**Files:**
- Create: `components/sheet/content-tabs.tsx`

- [ ] **Step 1: Build ContentTabs component**

A tabbed interface for the right column using shadcn `Tabs`:

Tab labels: **Actions**, **Spells**, **Inventory**, **Features**, **Notes**

Active tab: `text-accent border-b-2 border-accent`
Inactive tab: `text-muted-foreground`

Tab content area scrolls independently on desktop (fixed height with overflow-y-auto).

Props: receives `contentRefs`, `evalResult`, `schema`, `character`, `state`, `patchState` and passes relevant subsets to each tab component.

---

## Task 14: Features Tab

**Files:**
- Create: `components/sheet/tab-features.tsx`

- [ ] **Step 1: Build FeaturesTab component**

Filter pills at top: **All**, **Class Features**, **Species Traits**, **Feats**

Additionally, generate dynamic pills for any custom content types present in the character's content refs. For example, if content refs include items with content_type "ship_role", add a "Ship Roles" pill. Derive the display name from `schema.content_types` definition.

Feature list. For each content ref that represents a feature:
- Feature name: `text-accent font-medium` (gold)
- Source citation: `text-xs text-muted-foreground` — e.g., "Rogue 3" or "Species Trait"
- Description: `text-sm text-foreground` — from `content_definitions.data.description`
- Sub-selections: if the feature has resolved choices, show them indented

Filter logic:
- "Class Features": content_type === "feature" AND source is a class
- "Species Traits": content_type === "trait" or source is the character's race
- "Feats": content_type === "feat"
- Custom pills: match content_type to the pill's content type slug

Custom content type entries that have progression tiers show: current tier highlighted, locked tiers muted with dimmed text.

---

## Task 15: Actions Tab

**Files:**
- Create: `components/sheet/tab-actions.tsx`

- [ ] **Step 1: Build ActionsTab component**

Sub-filter pills: **All**, **Attack**, **Action**, **Bonus Action**, **Reaction**, **Other**

Attack table (if any weapon content refs or starting equipment):
| Attack | Range | Hit/DC | Damage | Properties |
|--------|-------|--------|--------|------------|

Derive attacks from `character.choices.starting_equipment` — parse weapon data from content definitions. Each weapon row shows:
- Name + weapon type (melee/ranged)
- Range (5 ft, 20/60 ft, etc.)
- Hit bonus: ability mod + proficiency (if proficient with weapon type)
- Damage dice: from weapon data + ability mod
- Properties: from weapon data (finesse, light, thrown, etc.)

Non-attack actions: class features that have action metadata (e.g., Second Wind is a "Bonus Action"). Display with name, action type badge, description.

Since full equipment management is deferred, this tab may be sparse. That is fine — the structure is in place for future expansion.

---

## Task 16: Placeholder Tabs (Spells + Inventory)

**Files:**
- Create: `components/sheet/tab-spells.tsx`
- Create: `components/sheet/tab-inventory.tsx`

- [ ] **Step 1: Build SpellsTab placeholder**

Show a message: "Spell management coming in a future update."

Below that, list any content refs with content_type "spell" — just name, level, and school. No casting UI, no slot tracking.

If no spells: just show the placeholder message.

- [ ] **Step 2: Build InventoryTab placeholder**

Show a message: "Full inventory management coming in a future update."

Below, list starting equipment from `character.choices.starting_equipment`. Parse the equipment data from content definitions. Show: name, quantity (default 1), weight if available.

If no equipment: just show the placeholder message.

---

## Task 17: Notes Tab

**Files:**
- Create: `components/sheet/tab-notes.tsx`

- [ ] **Step 1: Build NotesTab component**

Full-height textarea for extended session notes. Value comes from `state.notes`.

On blur or after a debounced delay (500ms), persist via `patchState({ notes: value })`.

Use a `<textarea>` styled with `bg-card border-border text-foreground placeholder:text-muted-foreground w-full min-h-[300px] p-3 rounded-md resize-y`.

Placeholder text: "Session notes, story beats, reminders..."

This is separate from Quick Notes (which is always visible in the left column on desktop).

---

## Task 18: Quick Notes

**Files:**
- Create: `components/sheet/quick-notes.tsx`

- [ ] **Step 1: Build QuickNotes component**

Collapsible section in the left column. Default collapsed to save space.

Header row: "Quick Notes" label + expand/collapse chevron icon button.

When expanded: textarea with value from `state.quick_notes`. Debounced save on blur/typing (500ms) via `patchState({ quick_notes: value })`.

Textarea: smaller than Notes tab — `min-h-[100px]` with same styling.

---

## Task 19: Mobile Layout

**Files:**
- Create: `components/sheet/mobile-tabs.tsx`

- [ ] **Step 1: Build MobileTabs component**

Fixed tab bar below the mobile header. Tabs: **Stats**, **Skills**, **Actions**, **Spells**, **Inventory**, **Features**, **Notes**

Implementation: CSS scroll-snap with `overflow-x-auto`.

Tab bar:
```html
<nav className="sticky top-0 z-10 bg-background border-b border-border overflow-x-auto">
  <div className="flex whitespace-nowrap">
    {tabs.map(tab => (
      <button
        className={`px-4 py-2 text-sm shrink-0 ${
          activeTab === tab.id
            ? "text-accent border-b-2 border-accent"
            : "text-muted-foreground"
        }`}
      />
    ))}
  </div>
</nav>
```

Content area uses CSS scroll-snap:
```html
<div
  className="flex overflow-x-auto snap-x snap-mandatory"
  onScroll={handleScroll}
>
  {tabs.map(tab => (
    <section className="snap-start w-full shrink-0 min-h-screen p-4">
      {renderTab(tab.id)}
    </section>
  ))}
</div>
```

The `handleScroll` callback detects which section is in view and updates the active tab indicator. This provides swipe navigation without any library dependency.

**Stats section (mobile)** renders:
1. Ability scores in 3x2 grid
2. Combat stats row
3. HP tracker (full-width)
4. Inspiration toggle
5. Saving throws (2-column grid)
6. Passive senses (3 cards)
7. Conditions
8. Death saves (if HP=0)
9. Quick notes (collapsible)
10. Proficiencies

All other sections render their respective tab content at full width.

---

## Task 20: Dashboard Update

**Files:**
- Modify: `app/(app)/characters/[id]/page.tsx`

- [ ] **Step 1: Remove Sheet tab from dashboard**

In the dashboard page, remove the `TabsTrigger value="sheet"` and its corresponding `TabsContent value="sheet"` block.

- [ ] **Step 2: Add "Open Character Sheet" CTA to Overview**

In the Overview `TabsContent`, add a prominent CTA button at the top of the character summary card (or as a separate card above it):

```tsx
{hasSheet && (
  <div className="mb-4">
    <Link href={`/characters/${character.id}/sheet`}>
      <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90">
        Open Character Sheet
      </Button>
    </Link>
  </div>
)}
```

This links to the full-page sheet. The dashboard remains the management hub; the sheet is the play-mode view.

---

## Task 21: Final Verification

- [ ] **Step 1: Verify all semantic color usage**

Search all files in `components/sheet/` for any non-semantic Tailwind color classes. The ONLY allowed color references are:
- `bg-background`, `bg-card`, `bg-muted`, `bg-primary`, `bg-secondary`, `bg-destructive`, `bg-accent`
- `text-foreground`, `text-muted-foreground`, `text-accent`, `text-primary`, `text-destructive`, `text-primary-foreground`, `text-accent-foreground`, `text-secondary-foreground`
- `border-border`, `border-primary`, `border-destructive`, `border-accent`, `border-input`
- Exception: `bg-green-500` / `border-green-500` for death save success circles only (no semantic "success" token exists)

Any instance of `zinc`, `gray`, `slate`, `stone`, `neutral`, `red-`, `purple-`, `yellow-` must be replaced with the correct semantic token.

- [ ] **Step 2: Test desktop layout**

Verify at `md+` viewport:
1. Sheet loads at `/characters/[id]/sheet` with no app nav
2. Header displays character info with gold name, back + edit buttons
3. Stat ribbon shows all 6 ability scores, combat stats, HP tracker
4. Three-column layout renders: left (saves, senses, conditions, proficiencies), center (skills), right (tabbed content)
5. HP tracker popover opens, damage/heal math works correctly
6. Conditions toggle on/off, persist on reload
7. Death saves appear only at HP=0
8. Skills show proficiency highlighting correctly
9. Features tab filters by category
10. Notes persist on reload

- [ ] **Step 3: Test mobile layout**

Verify at `<md` viewport:
1. Mobile header displays (compact, no avatar)
2. Tab bar shows all 7 tabs, horizontally scrollable
3. Swipe between sections works via CSS scroll-snap
4. Stats section shows full stat breakdown in stacked layout
5. HP tracker is full-width and functional
6. All tabs render their content correctly at full width

- [ ] **Step 4: Test state persistence**

1. Change HP via tracker -> reload -> HP persists
2. Toggle conditions -> reload -> conditions persist
3. Toggle death saves -> reload -> death saves persist
4. Toggle inspiration -> reload -> persists
5. Type in quick notes -> reload -> text persists
6. Type in notes tab -> reload -> text persists

---

## Implementation Notes

### Color Reference (from globals.css)
- `--primary: #7c3aed` (purple) — Use for: proficient save borders, active tab indicators, primary buttons, proficiency dots
- `--accent: #c9a44a` (gold) — Use for: character name, section headers, proficient modifiers, AC card value, proficiency bonus
- `--background: #0b0a10` (deep dark) — Page background
- `--card: #13111d` (slightly lighter dark) — Card/panel backgrounds
- `--muted-foreground: #8b85a0` (muted purple-gray) — Non-proficient text, secondary labels
- `--destructive: #dc2626` (red) — HP danger, death save failures, active conditions

### Expression Engine Reference
The `evaluate()` function from `lib/engine/evaluator.ts` returns:
- `stats`: base ability scores after effects (strength, dexterity, constitution, wisdom, intelligence, charisma)
- `computed`: derived stats after formulas + effects (proficiency_bonus, armor_class, initiative, speed, hit_points, etc.)
- `grants`: array of `GrantEffect` objects — check these for proficiency in saves, skills, armor, weapons, tools, languages
- `narratives`: narrative text effects (not used in the sheet, but available)

Grant patterns to check:
- Save proficiency: `grants.some(g => g.stat === "saving_throw_strength" && g.value === "proficient")`
- Skill proficiency: `grants.some(g => g.stat === "athletics" && g.value === "proficient")`
- Skill expertise: `grants.some(g => g.stat === "stealth" && g.value === "expertise")`
- Armor/weapon/tool/language: `grants.some(g => g.stat === "light_armor" && g.value === "proficient")`

### Content Ref Structure
Each `ContentRefWithContent` from `getContentRefsByCharacter` includes:
- `content_definitions.content_type`: "feature", "trait", "feat", "spell", "class", "race", "background", etc.
- `content_definitions.name`: Display name
- `content_definitions.data`: Arbitrary JSON with description, properties, etc.
- `content_definitions.effects`: Array of Effect objects already included in the evaluate() call
- `choice_source`: Links back to which builder step added this ref

### System Schema Skills Array
Skills are defined in `schema.skills` as `SkillDefinition[]`:
```typescript
{ slug: "acrobatics", name: "Acrobatics", ability: "dexterity" }
```
The `ability` field tells you which ability score to use for the modifier calculation.

### Modifier Calculation
```
abilityMod = Math.floor((abilityScore - 10) / 2)
skillMod = abilityMod + (proficient ? proficiencyBonus : 0) + (expertise ? proficiencyBonus : 0)
saveMod = abilityMod + (proficient ? proficiencyBonus : 0)
passiveSense = 10 + relevantSkillMod
```
