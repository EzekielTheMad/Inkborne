# Character primary color carry-through (PR-F) — design spec

**Date:** 2026-05-09
**Status:** Design approved, ready for implementation plan
**Slice:** PR-F of the Builder UX Polish phase (M2). Final M2 slice. Builds on PR-A's `<ClassPreviewModal>`, PR-B's `<ClassStepRail>`, PR-C's `<ClassPickerPanel>`, PR-D's `<LevelUpPane>`, and PR-E's mobile pattern.

Source design bundle: [`docs/design-briefs/builder-ux-polish-design-files/`](../../design-briefs/builder-ux-polish-design-files/) — variants in [`color-exploration.jsx`](../../design-briefs/builder-ux-polish-design-files/color-exploration.jsx) (artboards `D1_ClassTinted`, `D2_CharacterPrimary`, `D2_CarryThrough` — chosen direction is **D2 with carry-through**, lines 419–620). Reference shot: [`05-character-color.png`](../../design-briefs/builder-ux-polish-design-files/screenshots/05-character-color.png). Brief: [`docs/design-briefs/builder-ux-polish-design-files/README.md`](../../design-briefs/builder-ux-polish-design-files/README.md) lines 372–386. Brainstorm prep that fed this spec: [`2026-05-08-pr-f-character-color-prep.md`](2026-05-08-pr-f-character-color-prep.md).

---

## Goal

Each character has one user-pickable primary color stored as a hex string on the row. The color drives the active-state tone across the builder shell, the class step rail, all builder primary CTAs, the character sheet header gradient, and a small set of sheet stat/ability accents. Class identity (gold/purple letter emblems) stays per-class; the primary color is per-character. Default fallback is gold (`var(--accent)`) when no color is picked, so existing characters render unchanged.

This is a UI tinting slice + one DB column + one popover component. No engine changes, no new state machines, no migration of existing rows.

## Non-goals

- **DM-applied campaign theming.** Color is owner-only.
- **Light-mode color treatment.** Alpha is dark-mode only.
- **Animated transitions between colors.** Instant swap when the user changes their pick.
- **Dashboard character card tinting.** Out of scope for PR-F. The wireframe (`D2_CarryThrough`) explicitly scopes carry-through to builder + sheet only. Future slice if desired.
- **Custom illustration / portrait tinting.** Separate PR if pursued.
- **Class color (gold / purple) becoming user-configurable.** Class chrome stays constant; only character chrome moves.
- **`<BuilderStepNav>` mobile drawer.** Inherited non-goal from PR-E.

## Key decisions (from brainstorm)

| # | Decision | Choice |
|---|---|---|
| Q1 | Storage format | Hex string (`#xxxxxx`); `color-mix(in oklab, ...)` reads it natively, no JS conversion at read time. |
| Q2 | Picker placement | Click-the-avatar popover on the sheet header. Popover content matches the `D2_CarryThrough` wireframe strip — 6 preset swatches + hex input + native `<input type="color">`. |
| Q3 | Plumbing | CSS variables on a layout wrapper, integrated as Tailwind 4 theme tokens so `bg-character-bg`, `border-character-border`, `text-character-fg` are first-class utility classes. |
| Q4 | CTA color rule | All primary CTAs (builder Continue, modal Pick / Confirm, sheet primary actions) take character color when the wrapper sets `--character-color`. Brief's "stays gold" caveat is superseded by the design source. |
| Q5 | Sheet carry-through scope | Exactly what `D2_CarryThrough` shows: header gradient, HP/AC/Init stat tiles when selected/edited, ability tiles when highlighted, action item dots. |
| Q6 | Default for new characters | Gold (`var(--accent)`). |
| Q7 | Migration of existing characters | `primary_color = null` for all existing rows; renders gold via fallback. No backfill. |
| Q8 | Owner gate | Picker is owner-only. DMs / public viewers see the color but cannot change it. |
| Q9 | Dashboard cards | Not tinted in PR-F. (Listed as non-goal above for emphasis.) |
| Q10 | oklch fallback | Modern browsers only — Inkborne already requires `color-mix(in oklab, ...)` everywhere it's used; no polyfill. |

## File layout

**New files:**

| File | Responsibility |
|---|---|
| [`supabase/migrations/00037_characters_primary_color.sql`](../../../supabase/migrations/00037_characters_primary_color.sql) | Adds `primary_color text` column (nullable) to `public.characters` with hex regex check constraint. |
| [`lib/character/character-color-style.ts`](../../../lib/character/character-color-style.ts) | Exports `characterColorStyle(primaryColor)` returning a `React.CSSProperties` object that sets `--character-color` (or empty when null, for fallback). |
| [`components/character/color-picker-popover.tsx`](../../../components/character/color-picker-popover.tsx) | Owner-only popover component — 6 preset swatches + hex input + native color picker + reset-to-default. Anchored to the sheet header avatar. |
| [`tests/lib/character/character-color-style.test.ts`](../../../tests/lib/character/character-color-style.test.ts) | Unit test for the helper. |
| [`tests/components/character/color-picker-popover.test.tsx`](../../../tests/components/character/color-picker-popover.test.tsx) | Unit test for the picker. |

**Modified files:**

| File | Changes |
|---|---|
| [`app/globals.css`](../../../app/globals.css) | Add `--character-color: var(--accent)` default plus 4 derived variables (`--character-bg`, `--character-border`, `--character-fg`, `--character-muted`) at `:root`/`.dark`. Register all 5 as Tailwind 4 theme tokens via `@theme inline` block. |
| [`lib/types/character.ts`](../../../lib/types/character.ts) | Add `primary_color: string \| null` to `Character` interface. Propagates into `CharacterWithSystem` automatically (it extends `Character`). |
| [`lib/supabase/characters.ts`](../../../lib/supabase/characters.ts) | Already uses `select("*")` for character fetches — the new column comes through automatically. Add helper `updateCharacterColor(id, color)` for picker writes — owner-only, RLS-enforced. |
| [`components/character/character-page-client.tsx`](../../../components/character/character-page-client.tsx) | Wrap children in a `<div style={characterColorStyle(character.primary_color)}>`. Read `isOwner` (already passed), pass to `<CharacterShell>`. |
| [`components/character/character-shell.tsx`](../../../components/character/character-shell.tsx) | Apply gradient to sheet header: `linear-gradient(135deg, var(--character-color), color-mix(in oklab, var(--character-color) 55%, var(--background)))`. Wire avatar to render `<ColorPickerPopover>` for owners. |
| [`app/(app)/characters/[id]/builder/layout.tsx`](../../../app/(app)/characters/[id]/builder/layout.tsx) | Existing layout file. Wrap children in a `<div style={characterColorStyle(character.primary_color)}>`. The layout already runs server-side; add a fetch for `character.primary_color` (single column SELECT) and pass to the wrapper. |
| [`components/builder/builder-step-nav.tsx`](../../../components/builder/builder-step-nav.tsx) | Active step link: `bg-primary text-primary-foreground` → `bg-character-bg text-character-fg border border-character-border`. Status dots: in_progress dot uses `bg-character-fg` instead of `bg-blue-500`. |
| [`components/builder/class-step-rail/level-pill.tsx`](../../../components/builder/class-step-rail/level-pill.tsx) | Active pill: replace gold/purple class tone with `bg-character-bg border-character-border text-character-fg`. Class emblem letter (the small `P`/`S`/etc.) stays gold/purple per-class for identity. |
| [`components/builder/class-step-rail/level-rail.tsx`](../../../components/builder/class-step-rail/level-rail.tsx) | "+ Level up" button (`<LevelUpButton>`) primary fill switches from class tone to `bg-character-fg text-background`. Disabled state unchanged. |
| [`components/builder/class-step-rail/level-rail-mobile.tsx`](../../../components/builder/class-step-rail/level-rail-mobile.tsx) | Same `<LevelUpButton>` swap as desktop. Active mobile pill uses character tone. |
| [`components/builder/class-step-rail/class-level-pane.tsx`](../../../components/builder/class-step-rail/class-level-pane.tsx) | Primary ability + saving throw chips (when displayed): `bg-character-bg border-character-border text-character-fg`. Non-primary chips stay neutral. |
| [`components/builder/class-step-rail/level-up-action-bar.tsx`](../../../components/builder/class-step-rail/level-up-action-bar.tsx) | "Confirm level N" button switches from class tone to character color: `bg-character-fg text-background`. Cancel stays outline/destructive. |
| [`components/builder/class-preview-modal.tsx`](../../../components/builder/class-preview-modal.tsx) | "Pick this class" button switches to `bg-character-fg text-background`. Cancel stays outline. |
| Builder step pages (`app/(app)/characters/[id]/builder/{race,class,abilities,background,equipment}/*-client.tsx`) | "Continue" / "Next" buttons switch from `<Button>` default variant to `bg-character-fg text-background hover:opacity-90`. ~5 sites. |
| [`components/character/character-shell.tsx`](../../../components/character/character-shell.tsx) | (covered above for header gradient) Stat tiles (HP / AC / Init) `selected` / `editing` state: `border-character-border bg-character-bg text-character-fg`. Highlighted ability tiles: same. Action item bullet dots: `bg-character-fg`. |
| [`tests/components/builder/class-step-rail.test.tsx`](../../../tests/components/builder/class-step-rail.test.tsx) | New describe block: "active pill renders character tone when wrapper sets `--character-color`". Reuses existing helpers. |
| [`tests/components/character/character-shell.test.tsx`](../../../tests/components/character/character-shell.test.tsx) (new file) | Snapshot the sheet header gradient style for a custom hex and the null fallback. |

## Schema

```sql
-- supabase/migrations/00037_characters_primary_color.sql
alter table public.characters
  add column primary_color text;

alter table public.characters
  add constraint characters_primary_color_format
  check (primary_color is null or primary_color ~ '^#[0-9a-fA-F]{6}$');
```

Nullable with no default. Existing rows get `null` and render gold via the CSS fallback. Constraint enforces the hex format at the DB boundary so client validation can be optimistic.

RLS for the new column inherits from the existing `characters` row policies. Update is already gated to `user_id = auth.uid()`. No new policy needed.

## Type model

```ts
// lib/types/character.ts
interface Character {
  id: string;
  user_id: string;
  system_id: string;
  campaign_id: string | null;
  name: string;
  visibility: "private" | "campaign" | "public";
  archived: boolean;
  level: number;
  base_stats: Record<string, number>;
  choices: CharacterChoices;
  state: CharacterState;
  narrative: NarrativeData;
  narrative_rich: NarrativeRichData;
  primary_color: string | null;   // <-- new; "#xxxxxx" or null
}
```

`CharacterWithSystem` (extends `Character`) picks it up automatically.

## CSS variable system + Tailwind tokens

Five CSS variables, defined at `:root` (dark theme) in [`app/globals.css`](../../../app/globals.css):

```css
:root, .dark {
  /* Character color — overridden per-character on a layout wrapper */
  --character-color:  var(--accent);                                                    /* gold default */
  --character-bg:     color-mix(in oklab, var(--character-color) 14%, transparent);
  --character-border: color-mix(in oklab, var(--character-color) 45%, transparent);
  --character-fg:     var(--character-color);
  --character-muted:  color-mix(in oklab, var(--character-color) 70%, var(--muted-foreground));
}
```

Registered as Tailwind 4 theme tokens in the same file's `@theme inline` block:

```css
@theme inline {
  /* ... existing tokens ... */
  --color-character:        var(--character-color);
  --color-character-bg:     var(--character-bg);
  --color-character-border: var(--character-border);
  --color-character-fg:     var(--character-fg);
  --color-character-muted:  var(--character-muted);
}
```

Once registered, components write Tailwind classes:

- `bg-character-bg` / `bg-character-fg`
- `border-character-border`
- `text-character-fg` / `text-character-muted`

The four derived variables recompute automatically when `--character-color` changes on a wrapper. No JS observer needed.

## Layout wrappers (where `--character-color` gets set)

The five derived variables are derived FROM `--character-color`. Setting that one variable on a wrapper element propagates to every descendant. Two wrappers:

| Wrapper | File | Scope |
|---|---|---|
| Sheet | [`components/character/character-page-client.tsx`](../../../components/character/character-page-client.tsx) | The character sheet route (`/characters/[id]`). Wraps everything inside the page client. |
| Builder | [`app/(app)/characters/[id]/builder/layout.tsx`](../../../app/(app)/characters/[id]/builder/layout.tsx) | Existing layout file. All builder steps for this character. Server component; fetches `character.primary_color` and passes to the wrapper. |

Both wrappers use the helper:

```tsx
// lib/character/character-color-style.ts
export function characterColorStyle(primaryColor: string | null): React.CSSProperties {
  return primaryColor
    ? ({ ['--character-color' as string]: primaryColor })
    : ({});  // empty → globals.css default applies (gold)
}
```

Outside these wrappers (dashboard, `/campaigns`, login pages), the variable defaults to `var(--accent)` so any class accidentally referencing `bg-character-fg` still renders gold. Defensive default; no breakage.

## Picker UI

**New component:** `components/character/color-picker-popover.tsx`. Wraps shadcn `<Popover>` (already in `components/ui/popover.tsx`).

**Trigger:** the avatar circle in the sheet header. For owners, the avatar is rendered as a `<button>` with `aria-label="Change character color"` and a hover ring. For non-owners, the avatar is a plain `<div>` — no popover.

**Popover content** (top to bottom — matches `D2_CarryThrough` wireframe lines 426–462):

1. **Eyebrow:** `Character color` (10px, 600, `text-muted-foreground`)
2. **6 preset swatches** (18×18 rounded chips, gap-1):
   - `#c9a44a` (gold — current accent)
   - `#7c3aed` (purple — current primary)
   - `#b91c1c` (red)
   - `#059669` (emerald)
   - `#2563eb` (blue)
   - `#db2777` (magenta)

   Click → sets `primary_color` to the hex. Selected swatch shows a 1px ring in `color-mix(swatch 70%, white)`.
3. **Hex text input** (8 chars max — leading `#` optional). Live validation regex `/^#?[0-9a-fA-F]{6}$/`. Invalid state: destructive 1px border. On Enter or blur, commits if valid.
4. **Native color picker:** styled `<label>` with `<input type="color">` overlaid (zero opacity). 24×24 swatch matching the eyebrow row.
5. **Reset link:** small `text-muted-foreground` link `Reset to default` — clicking sets `primary_color = null`.

**Persistence flow:**

```ts
async function commitColor(hex: string | null) {
  // Optimistic: update local state immediately
  setPrimaryColor(hex);
  // Persist
  const { error } = await supabase
    .from('characters')
    .update({ primary_color: hex })
    .eq('id', characterId);
  if (error) {
    setPrimaryColor(prevColor);  // revert
    toast.error('Could not save color. Try again.');
    return;
  }
  router.refresh();  // re-runs server component, picks up new color from row
}
```

**Behavior on the wrapper:** `<CharacterPageClient>` reads `character.primary_color` and applies it via `characterColorStyle()`. The optimistic `setPrimaryColor` lives on the picker; it should also propagate to the wrapper so the sheet re-tints instantly. Implementation: lift `primaryColor` state into `CharacterPageClient` (or its existing context) and pass a setter to the popover. The DB write happens in parallel; on error, the lifted state reverts.

## Carry-through application points

Every surface that reads the color. Each is a class swap.

### Builder shell

| Surface | Element | Today | After |
|---|---|---|---|
| Step nav | Active step link | `bg-primary text-primary-foreground` | `bg-character-bg text-character-fg border border-character-border` |
| Step nav | "in_progress" status dot | `bg-blue-500` | `bg-character-fg` |
| Step nav | "complete" status dot | `bg-green-500` | unchanged (always green) |
| Step nav | "untouched" status dot | `bg-muted-foreground/30` | unchanged |

### Class step rail

| Surface | Element | Today | After |
|---|---|---|---|
| Rail | Active level pill | gold/purple class tone | `bg-character-bg border-character-border text-character-fg` |
| Rail | Inactive level pill | neutral | unchanged |
| Rail | Class emblem letter | gold or purple | unchanged (per-class identity) |
| Rail | "+ Level up" button (idle) | gold/purple class tone | `bg-character-fg text-background` |
| Rail | "+ Level up" button (disabled / active-flow) | dashed muted | unchanged |
| Class level pane | Primary ability chip | neutral | `bg-character-bg border-character-border text-character-fg` |
| Class level pane | Saving throw chips | neutral | same as primary ability |
| Class level pane | Other ability chips | neutral | unchanged |
| Level-up action bar | "Confirm level N" button | gold accent | `bg-character-fg text-background` |
| Level-up action bar | "Cancel" button | outline | unchanged |

### Builder content modals

| Surface | Element | Today | After |
|---|---|---|---|
| Class preview modal | "Pick this class" button | gold accent | `bg-character-fg text-background` |
| Class preview modal | "Cancel" button | outline | unchanged |

### Builder step pages (race, class, abilities, background, equipment)

| Surface | Element | Today | After |
|---|---|---|---|
| Each step | "Continue" / "Next" button | `<Button>` default | `bg-character-fg text-background hover:opacity-90` |
| Each step | "Back" button | outline | unchanged |
| Each step | Selected race / class / background card highlight | gold accent | `bg-character-bg border-character-border` |

### Character sheet

| Surface | Element | Today | After |
|---|---|---|---|
| Header | Background | flat surface | `linear-gradient(135deg, var(--character-color), color-mix(in oklab, var(--character-color) 55%, var(--background)))` |
| Header | Avatar circle | gradient bg | `bg-white/15 border-white/30` (transparent-on-color, reads on any tint). Becomes the `<ColorPickerPopover>` trigger for owners. |
| Header | Name + tagline text | `text-foreground` | `text-white` (header has color background — needs contrast guarantee) |
| Stat tiles (HP / AC / Init) | Default state | neutral | unchanged |
| Stat tiles | Selected / editing state (where the sheet currently renders one) | gold accent | `bg-character-bg border-character-border text-character-fg` |
| Ability tiles | Default | neutral | unchanged |
| Ability tiles | "Featured" state (e.g., active class's primary ability — only if the sheet currently renders such a state) | gold accent | `bg-character-bg border-character-border text-character-fg` |
| Action items | Bullet dot | `bg-muted-foreground` | `bg-character-fg` |

### What stays gold (no change)

- Class emblems (gold for `gold` classes, purple for `purple` classes — class identity is shape *and* color)
- NEW LEVEL ribbon (celebration chrome, not state)
- Brand chrome (Inkborne wordmark, login screen)
- Destructive actions (`text-destructive`, Remove Class confirmation)
- "complete" status dots (green — done is done regardless of color)

## Tests

### Unit

- `tests/lib/character/character-color-style.test.ts`
  - `characterColorStyle(null)` returns `{}`
  - `characterColorStyle("#7c3aed")` returns `{ "--character-color": "#7c3aed" }`
  - Lowercase + uppercase hex both work
- `tests/components/character/color-picker-popover.test.tsx`
  - Preset click commits the hex via `onChange`
  - Hex input with valid value commits on blur
  - Hex input with invalid value shows destructive border, does not commit
  - Native color picker `change` event commits the hex
  - Reset link commits `null`
  - Non-owner: avatar is not a button, popover never opens

### Integration

- Extend `tests/components/builder/class-step-rail.test.tsx` with a describe block `character color carry-through`:
  - Render with a wrapper that sets `--character-color`; assert the active pill computed style picks up the variable (use `getComputedStyle`)
  - Render without the wrapper; assert the active pill renders the gold default
- New file `tests/components/character/character-shell.test.tsx`:
  - Snapshot test of the header gradient style attribute for a custom hex and for null

### Smoke (manual, during PR review)

- Test account: `test@inkborne.app` / `testpassword123`
- Voltee (Wizard 3) and Xero (Barbarian 10 / Fighter 5):
  - Pick gold (default), purple, teal, magenta, custom hex
  - Verify carry-through on builder Race, Class (single + multiclass), Abilities steps
  - Verify carry-through on the sheet header + stat tiles + ability tiles
  - Verify reset returns to gold

No snapshot or visual-regression tests in scope.

## Migration + rollout

- One migration: `00037_characters_primary_color.sql` (above).
- Apply via Supabase MCP `apply_migration` tool, project ref `etcaodglvcspcmwecyxq`.
- No backfill — `null` is the natural "no preference" state.
- Day-1 deploy: migration runs, app reads new column with fallback. Zero impact on existing characters until they pick a color.
- No feature flag. The picker is hidden for non-owners; for owners, the affordance is small (clickable avatar) and discoverable but not disruptive.

## A11y

- Picker trigger: `<button>` with `aria-label="Change character color"`. Keyboard activates the popover.
- Popover: focus-trapped, Esc closes, return focus to the avatar.
- Preset swatches: each is `<button>` with `aria-label="Set character color to <name>"` — visible swatch is decorative, name is the accessible label.
- Hex input: `aria-invalid` toggles based on regex check.
- Native color picker: native a11y is sufficient.
- Reset link: `<button>` with `aria-label="Reset character color to default"`.
- Contrast guarantee: the sheet header uses `text-white` over the color gradient. The 6 presets are chosen to provide reasonable contrast (≥ 4.5:1 for normal text against the gradient's lighter end) against white. Custom hex values may not — that's out of scope to enforce. The header gradient mixes the color with the dark background (`color-mix(in oklab, color 55%, var(--background))`) at the lower-right end, which softens contrast issues for the bottom half of the header. If a real contrast problem emerges from user-picked colors, a future slice can add a contrast guard at the picker (e.g., warn when the picked color fails AA against white).

## Open questions for engineering (none)

The brainstorm closed all 10 questions from the prep doc. If anything emerges during implementation that reshapes the design, surface it back to a brainstorm — don't quietly improvise.

---

## Appendix · Tone derivation reference

The four derived tones (`bg`, `border`, `fg`, `muted`) follow the wireframe's `toneFromOklch` helper, expressed as CSS:

| Tone | CSS expression |
|---|---|
| `bg` | `color-mix(in oklab, var(--character-color) 14%, transparent)` |
| `border` | `color-mix(in oklab, var(--character-color) 45%, transparent)` |
| `fg` | `var(--character-color)` |
| `muted` | `color-mix(in oklab, var(--character-color) 70%, var(--muted-foreground))` |

These percentages match the design source. If they need tweaking after smoke-testing on real characters, change them in `globals.css` once and they propagate everywhere.
