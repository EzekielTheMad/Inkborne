# PR-F · Character Primary Color Carry-Through — Brainstorm Prep

> **Status:** PRE-BRAINSTORM scratch. This is NOT a spec. It pre-loads context so the
> `superpowers:brainstorming` session can run faster — codebase touchpoints identified,
> design decisions surfaced as questions, no implementation choices made yet.
> The actual spec will live at `docs/superpowers/specs/2026-05-XX-character-color-design.md`
> after Victor picks variants in the brainstorm.

---

## What PR-F ships

The **last remaining slice of M2 Builder UX Polish.** Each character has one
user-pickable primary color. The builder shell, character sheet header, and a
handful of accent surfaces read it. Class color (gold/purple emblems) stays
independent — color identity is per-character, class identity stays per-class.

**Design direction (already chosen by stakeholder review):**

- **D2 — Character Primary** with carry-through. See `color-exploration.jsx` lines 217–620
  (`ColorD2_CharacterPrimary` + `ColorD2_CarryThrough`).
- Reference shot: `docs/design-briefs/builder-ux-polish-design-files/screenshots/05-character-color.png`.
- Source-of-truth README section: `docs/design-briefs/builder-ux-polish-design-files/README.md` lines 372–386 ("Character Color Carry-Through").

**Default fallback:** when a character has no color picked, use `var(--accent)` (gold).
This means existing characters render unchanged on day one.

---

## What gets tinted (per design)

From the design source, the character color drives:

| Surface | Element | Today | After PR-F |
|---|---|---|---|
| Builder shell | Step nav active state | `bg-primary text-primary-foreground` (purple) | Character color tint |
| Builder steps | "Continue" / forward CTA | `<Button>` default (purple) | Character color background |
| Builder steps | Selected race/class card highlight | gold accent | Character color tint |
| Builder steps | Stepper completed dot color | `bg-primary` | Character color (?) |
| Class step | Active level pill | gold/purple class tone | Character color tint, class emblem unchanged |
| Class step | Primary ability + saves chips | neutral | Character color tint |
| Character sheet | Header gradient | flat surface | `linear-gradient(135deg, color, color-mix(color 55%, bg))` |
| Character sheet | Stat tiles (HP/AC/Init) on selected/edited | gold accent | Character color tint |
| Character sheet | Action item bullet dots | muted | `tone.fg` |

**Stays gold (per design brief, "to remain readable on any character color"):**

- `Pick this class` / `Confirm` buttons inside content-preview modals
- Brand-level `Inkborne` wordmark, NEW LEVEL ribbon, gold class emblems

> ⚠️ **Apparent conflict to resolve in brainstorm:** the brief says "primary CTAs stay
> gold to remain readable on any character color" — but D2 explicitly shows the *Continue*
> and *Confirm Selection* CTAs in character color (lines 395–402 of `color-exploration.jsx`).
> Probable interpretation: "commit-to-content" CTAs (Pick a class, Confirm a level) stay
> gold; "navigate-forward" CTAs (Continue, Next Step) take character color. Confirm in Q1.

---

## Tone derivation

The design uses `oklch` colors with a `color-mix` derivation that produces a four-part tone bundle:

```ts
function toneFromOklch(color: string) {
  return {
    bg:     `color-mix(in oklab, ${color} 14%, transparent)`,
    border: `color-mix(in oklab, ${color} 45%, transparent)`,
    fg:     color,
    muted:  `color-mix(in oklab, ${color} 70%, var(--muted-foreground))`,
  };
}
```

This is the only piece of "logic" introduced by PR-F — turn a single hex/oklch into bg / border / fg / muted variants for tailwind-style application.

---

## Code touchpoints (by area)

### Schema
- **NEW migration** `supabase/migrations/00037_characters_primary_color.sql`:
  - `alter table public.characters add column primary_color text` (nullable; null = default to accent)
  - Constraint: regex check for valid hex (`#xxxxxx`) OR null. (Or store as oklch — Q5.)

### Type model
- **`lib/types/character.ts`** — add `primary_color: string | null` to `Character` (and `CharacterWithSystem`).

### Color helper (NEW)
- **`lib/character/color.ts`** — exports `toneFromColor(color: string | null): { bg; border; fg; muted; raw }`.
  Default branch: when `color === null`, returns the gold (`--accent`) tone bundle.

### Character page (where the picker lives)
- **`app/(app)/characters/[id]/page.tsx`** — already passes `character` to `CharacterPageClient`. Color will pass through with the character row.
- **`components/character/character-page-client.tsx`** + descendants — read `character.primary_color`, compute tone via `toneFromColor`, expose via existing `CharacterProvider` context.
- **NEW component** `components/character/color-picker.tsx` — 6 preset swatches + custom hex input + native `<input type="color">`. Lives in the character settings/edit surface (TBD where exactly — Q3).

### Character sheet (carry-through)
- **`components/character/character-shell.tsx`** (or wherever the header lives) — apply gradient using `tone.fg` and `color-mix`. Header is the most visible surface; aligns with sheet design which the brief says is sacred elsewhere but EXPLICITLY allows here.
- **Stat tile components** (HPTracker, AC display, etc.) — read tone for selected/edited states only. Q4: scope.

### Builder shell
- **`components/builder/builder-step-nav.tsx`** — replace `bg-primary text-primary-foreground` active state with character-color tone (still falls back to primary purple if no color set).
- **`app/(app)/characters/[id]/builder/layout.tsx`** (or wherever the layout wraps the steps) — wrap children in a `<div style={{ "--character-color": tone.fg, ... }}>` so all descendants can use a `var(--character-color)` token. Or pass tone via prop drilling — Q6.
- **Step pages** (race / class / abilities / background / equipment) — selected card highlight + Continue button consume the color.

### Class step rail (already in M2 surface)
- **`components/builder/class-step-rail/level-pill.tsx`** — active state currently uses class tone (gold/purple). PR-F: active state instead uses character color, class emblem stays per-class.
- **`components/builder/class-step-rail/index.tsx`** — read character color via context or new prop (Q6).
- Tests: extend `tests/components/builder/class-step-rail.test.tsx` to cover color-prop render.

### CSS tokens
- **`app/globals.css`** — register `--character-color` (with sensible default mapping to `--accent`) so styles can reference it without prop drilling. Tone derivations applied via `color-mix` in stylesheet OR computed in JS — Q7.

---

## Open questions for the brainstorm

These are the decisions Victor needs to make. Listed in the order they'd be asked.

**Q1 · CTA scope.** Which CTAs adopt character color and which stay gold? My read: forward-navigation CTAs (Continue, Next Step) → character color; commit-to-content CTAs (Pick this class, Confirm level N) → stay gold. Confirm or override.

**Q2 · Storage format.** Hex string (`#7c3aed`) or oklch literal (`oklch(65% 0.18 300)`)? Hex is friendlier for `<input type="color">`; oklch is what the design source uses for swatches. Could store hex and convert on read. **Recommendation:** hex with a constraint check, derive oklch in JS at read time.

**Q3 · Picker location.** Settings page (`/settings`) vs. character edit surface vs. inline on character sheet header (click avatar to edit)? Design says "set on the character page (`/characters/[id]`)". Brainstorm: confirm exact UI placement — context menu? edit-mode toggle? new tab in the existing character shell?

**Q4 · Sheet carry-through scope.** Which sheet elements? Design source shows: header gradient, HP/AC/Init stat tiles, ability tile borders (when "highlighted"), action item dots. Stat tiles are everywhere — only on edited/selected, or always? Q1 of brainstorm.

**Q5 · oklch fallback story.** Some browsers don't support `color-mix(in oklab, ...)`. Targeted browsers? Need a JS-side polyfill, or pre-compute the tones server-side and emit raw rgba/hex into CSS vars?

**Q6 · Plumbing strategy.** CSS variable on a wrapper element (read via `var(--character-color)` everywhere) OR explicit prop through component tree OR React context? The CSS-var approach is the lightest touch and makes the rail's existing class tones easy to swap. Recommendation: CSS variable + a small `useCharacterColor()` hook for components that need the JS value (e.g., gradient on sheet header).

**Q7 · Default behavior for new characters.** Always show gold (current default = no color picked) OR auto-assign based on first picked class (Paladin → gold, Sorcerer → purple)? Brief says "default to gold." Confirm or override.

**Q8 · Migration of existing characters.** Day-1 migration leaves `primary_color = null` for everyone. Existing characters render unchanged. Confirm.

**Q9 · Multi-character switcher consistency.** When a user is on `/dashboard` and sees character cards, do those cards tint with each character's color? (Design source doesn't show — likely out of scope, but easy win if confirmed.)

**Q10 · "Edit color" entry point gate.** Is the picker visible to non-owners (DMs viewing party members) or owner-only? Default: owner-only.

---

## Proposed implementation order (bottom-up)

Suggested execution sequence once the spec lands. Each step is small and independently shippable; pre-merge tests would gate progression.

1. **Schema + type** — migration + `lib/types/character.ts` field. No UI yet.
2. **Color helper** — `lib/character/color.ts` exports `toneFromColor()` with full unit tests for the gold-fallback + hex + oklch paths.
3. **Picker UI** — color picker component lives in isolation; wire to character row update. No carry-through yet.
4. **Sheet header gradient** — most visible win, tightest scope.
5. **Builder step nav active state** — extends to all builder steps via CSS variable.
6. **Class rail active pill** — color-aware. Class emblems unchanged.
7. **Step content tinting** — selected race/class card, primary CTA on each step, primary ability + saves chips on the class step ASI panel.
8. **Stat tile highlight** — sheet stats use color when selected/edited. Smaller scope per Q4.
9. **Polish + a11y pass** — contrast checks (WCAG AA on text+bg pairs), keyboard nav of picker, screen reader labels for swatches.

---

## Out of scope (do not let the brainstorm scope-creep)

- DM-applied color overrides (DM theming campaigns)
- Theme-aware (light mode) color treatment — alpha is dark-mode only
- Custom illustration/portrait tinting — separate PR if pursued
- Animated transitions between colors when picker changes — instant swap is fine
- Color picker on the dashboard / mobile-specific picker UI
- Class color selection (gold/purple) becoming user-configurable

---

## Reference: the D2 demo loop

To play with the design source: open `docs/design-briefs/builder-ux-polish-design-files/Builder UX Polish.html` in a browser. The `ColorD2_CharacterPrimary` and `ColorD2_CarryThrough` artboards have a live swatch picker — you can see how each tone behaves. Use this during the brainstorm to ground tone discussion.
