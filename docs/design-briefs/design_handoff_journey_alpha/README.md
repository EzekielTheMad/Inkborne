# Handoff: Inkbourne — Journey (Landing → Auth → Dashboard → Library)

## Overview

This package contains the design references for **Inkbourne**'s "Journey" surfaces — the front-of-product screens an alpha tester hits before reaching the character builder and sheet:

1. **Landing** (3 variants — A/B/C; **B is recommended**)
2. **Authentication** (Login, Login error, Signup, Verify email, plus a split-screen variant)
3. **Dashboard** (3 variants — A/B/C; B is recommended)
4. **Library** (system-scoped catalog: Classes / Spells / Monsters / etc., with expandable rows + per-category filters)

These cover everything a new user sees from cold visit through landing inside their account, **excluding** the character builder (already handed off in a separate package) and the character sheet (forthcoming).

---

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy directly.

The task is to **recreate these designs in the Inkbourne codebase's existing environment** (likely React / Next.js / Tailwind, but follow whatever the codebase establishes), using its established patterns, libraries, and component conventions. Where the codebase already has a primitive (Button, Input, Card, Tabs, Accordion), prefer extending that primitive over re-creating one inline.

The HTML/JSX files use inline styles for speed of iteration — **do not ship inline styles**. Translate them to Tailwind classes, CSS Modules, styled-components, or whatever the codebase uses.

## Fidelity

**High-fidelity (hifi).** Final colors, typography, spacing, and copy. Recreate pixel-faithfully where the codebase allows. Where a codebase primitive enforces slightly different metrics (e.g. a 36px button vs. our 44px), match the codebase — internal consistency wins over pixel-faithfulness.

---

## Files in this bundle

| File | Purpose |
|---|---|
| `Journey.html` | The host file. Loads tokens + components, mounts a Design Canvas with all surfaces side-by-side. |
| `inkborne-tokens.css` | Base design tokens (colors, radii, fonts, base utility classes — `.ink-*`). |
| `journey-tokens.css` | Journey-specific extensions (paper grain, manuscript ornaments, gold/purple buttons, paper cards — `.j-*`). |
| `inkborne-ui.jsx` | Base UI primitives shared with the builder (badges, feature cards, etc). |
| `journey-primitives.jsx` | Journey-specific primitives: `JLogo`, `JLandingNav`, `JLandingFooter`, `JRule`, `JStarRule`, `JInkstain`, `JCornerOrnament`, `JImg` (placeholder image), `JDropCap`, `JQuill`, `JCharRow`, `SampleSheetPreview`, `TrustCol`. |
| `journey-landing-a.jsx` | Landing A — Hero-first, polished tagline + sample sheet preview. |
| `journey-landing-b.jsx` | **Landing B (recommended)** — Feature-forward. Three differentiator sections explicitly framing Inkbourne as "sheet + story in one notebook" combining D&D Beyond density with LegendKeeper's narrative depth. |
| `journey-landing-c.jsx` | Landing C — Story-led, narrative-style scroll. |
| `journey-auth.jsx` | All auth surfaces: `AuthLogin`, `AuthLoginError`, `AuthSignup`, `AuthVerify`, `AuthSplitScreen`. |
| `journey-dashboard.jsx` | `AppNav`, `DashboardA`, `DashboardB` (recommended), `DashboardC`, `DashboardEmpty`, `Library` (with `ExpandableList`, `KV`). |
| `design-canvas.jsx` | The pan/zoom canvas component used to lay out artboards in `Journey.html`. **Not for production** — only for viewing the designs. |

To preview locally: open `Journey.html` in a browser. Use scroll/drag to pan; click an artboard's title to focus.

---

## Design Tokens

### Colors

```
/* Surfaces — dark warm palette */
--ink-bg:            #0b0a10   /* page background — near black, warm */
--ink-deep:          #08070d   /* deeper than bg, hero gutters */
--ink-card:          #13111d   /* default card */
--ink-paper:         #1a1626   /* "paper" card — warm sub-surface */
--ink-paper-2:       #14111e   /* deeper paper, subtle nesting */
--ink-secondary:     #1e1b2e
--ink-muted:         #13111d

/* Foreground */
--ink-fg:            #f0eef5   /* primary text */
--ink-muted-fg:      #8b85a0   /* secondary text */
--ink-secondary-fg:  #c4c0d0

/* Brand */
--ink-primary:       #7c3aed   /* purple — secondary accent, used for CTAs, levelled pills */
--ink-primary-fg:    #fafafa
--ink-accent:        #c9a44a   /* gold — primary brand color, manuscript ink */
--ink-accent-fg:     #0b0a10

/* Lines */
--ink-border:        #1e1b2e   /* hairline */
--ink-border-strong: #2a2640   /* card outlines */
--ink-input:         #1e1b2e
--ink-ring:          #7c3aed   /* focus ring */

/* Semantic */
--ink-destructive:   #dc2626

/* Vellum / paper accents (transparent) */
--ink-vellum-faint:  rgba(201,164,74,0.06)
--ink-vellum-line:   rgba(201,164,74,0.22)
```

**Purple alpha tints** (used for purple-toned cards and chips):
- `rgba(124,58,237,0.08–0.18)` for fills
- `rgba(124,58,237,0.40)` for borders
- `#b594ff` / `rgba(167,139,250,0.95)` for purple text

**Gold alpha tints** (used for gold-toned cards, chip backgrounds):
- `rgba(201,164,74,0.04–0.12)` for fills
- `rgba(201,164,74,0.30–0.40)` for borders

### Typography

```
--ink-font:          system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
                     /* body — replace with the codebase's body font; system-ui is acceptable */
--ink-display:       'Marcellus', 'EB Garamond', 'Cormorant Garamond', Georgia, serif
                     /* display — Marcellus from Google Fonts */
--ink-display-italic: 'EB Garamond', Georgia, serif
                     /* italic display — EB Garamond italic */
--ink-font-mono:     ui-monospace, 'SF Mono', Menlo, Consolas, monospace
```

**Typographic conventions:**

| Use | Class | Spec |
|---|---|---|
| Hero display | `.j-display` | Marcellus 56px / 1.1 / 0.01em |
| Section heading | `.j-display` | Marcellus 30–40px / 1.2 |
| Card title | `.j-display` | Marcellus 18–22px |
| Italic flourish | `.j-display-italic` | EB Garamond italic, often colored gold |
| Folio numeral / kicker | `.j-folio` | Marcellus 11px / 0.34em / uppercase, gold |
| Eyebrow | `.ink-eyebrow` | 10px / 0.18em / uppercase, muted |
| Heading (small) | `.ink-heading` | 11px / 0.06em / uppercase, gold |
| Body | inherited | 13–14px / 1.55–1.65 |
| Small body | inherited | 12–12.5px / 1.55 |
| Marginalia | `.j-marginalia` | EB Garamond italic, faded gold 13px |
| Pull quote | `.j-pull` | Marcellus 22px / 1.4 |

Drop cap helper: `.j-dropcap::first-letter` (3.2em, gold).

### Spacing

Spacing is informal — no rigid scale. Common values:
- Card padding: 18–24px
- Section padding: 40–70px vertical, 32px horizontal
- Grid gaps: 8 / 12 / 14 / 16 / 22 / 36px
- Max content widths: 720 / 880 / 1080 / 1140 / 1240px

### Radii & shadows

```
--ink-radius-sm:  6px
--ink-radius:     8px
--ink-radius-lg:  14px
```

Cards: 8–12px. Buttons: 6px. Pills/chips: 999px.

Shadows are **minimal** — this product uses warm hairlines and soft gradients, not drop shadows. The only notable shadow is on `.ink-modal`:
```
0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,164,74,0.04)
```
And on hover for gold/purple buttons (`0 0 28px -8px <accent>`).

### Motifs (manuscript / parchment)

These are decorative accents — ambient, never load-bearing:

- **Parchment grain** (`.j-grain`): two repeating-linear-gradients at 91° and 2° simulating fiber lines, plus a faint warm vignette. Apply to page-level containers.
- **Inkstain** (`<JInkstain />`): SVG-masked organic blob, used as background ambience behind hero/card. Transparent gold/purple.
- **Hairline rule** (`<JRule glyph="✦" />` / `<JStarRule />`): horizontal divider with a centered manuscript glyph (✦, ★, ❋).
- **Corner ornament** (`<JCornerOrnament />`): tiny ▲ at top-left of cards, marginalia-style.
- **Quill icon** (`<JQuill />`): small SVG quill, used in "Why open source matters" sections.

Restraint: **at most one inkstain per visible region**. Grain is on page; everything else is sparse.

---

## Surface 1 — Landing

Three variants are included for design discussion. **B is the recommended direction** — it most clearly communicates the "one-stop shop" positioning.

### Landing A — Hero-first

`<LandingHeroFirst />` in `journey-landing-a.jsx`.

- Big polished hero (tagline + double CTA + ambient inkstain).
- Sample sheet preview anchored beneath the hero.
- Three trust columns ("By players", "Open source", "Your data, your rules").
- Single closing CTA with parchment plaque.
- Use case: cold traffic, search ads, top-of-funnel.

### Landing B — Feature-forward (recommended)

`<LandingFeatureForward />` in `journey-landing-b.jsx`.

**Hero copy:**
> Folio kicker: "The sheet · The story · One place"
> H1: Your character sheet / and your *character's story*, / in the same notebook.
> Body: Inkbourne combines the dense character management of D&D Beyond with the narrative depth of LegendKeeper — sheet, lore, sessions and secrets kept side by side.
> CTAs: `Request access` (gold), `Watch a 90-second tour` (quiet).

**Three differentiator sections** (alternating left/right with a "I / II / III" gold folio numeral):

1. **The sheet** — every modifier computed, every detail in reach.
2. **The story** — sessions, NPCs, lore beside the sheet, not in another tab.
3. **One place, your way** — homebrew that flows through both.

Followed by:
- Open-source pull-quote moment (IV).
- "From the table" — three short voice quotes.
- Closing CTA.

This variant is chosen because it explicitly anchors the value prop ("sheet + story together") and names the comparable products. Don't drop the D&D Beyond / LegendKeeper references — they're the fastest comprehension shortcut.

### Landing C — Story-led

`<LandingStoryLed />` in `journey-landing-c.jsx`.

A narrative-style scroll: a character's becoming. More ambitious, less direct.

### Shared landing primitives

- `<JLandingNav />` — sticky top nav, logo + Features / Open Source / Discord / GitHub + "Sign in" + "Request access" gold CTA.
- `<JLandingFooter />` — quiet footer with build version + open-source links.

---

## Surface 2 — Authentication

All auth screens share a centered card pattern (760×780–860 artboard) with paper-warm card framing, ambient inkstains, and a small `JLogo` above the card.

### `<AuthLogin />`

- Logo + folio kicker "Welcome back, scribe".
- Inputs: Email, Password (with "Forgot?" inline link).
- "Remember me" checkbox.
- Primary: "Sign in" gold button.
- "or" divider; OAuth: Google, Discord, GitHub.
- Footer: "New here? Begin a notebook →"

### `<AuthLoginError />`

Same shape, with an inline error rail above inputs:
- Red-tinted band (`var(--ink-destructive)` border at 30% opacity).
- "We didn't recognize that combination." + "Three more attempts before a cooldown."
- Empty state on the password field, focused.

### `<AuthSignup />`

- Logo + "Begin a notebook".
- Inputs: Display name, Email, Password (with hint: "12+ chars, one of which is unusual"), Confirm.
- Checkbox: agree to terms.
- Primary: "Create account" gold.
- OAuth row.
- Footer: "Already a scribe? Sign in →"

### `<AuthVerify />`

- "Check your inbox" — verification email sent state.
- Big folio numeral.
- "We sent a link to **email@example.com**. It expires in 60 minutes."
- **Troubleshooting accordion** (this is the interesting bit — most "verify email" screens leave users stranded):
  - "Didn't get it?" → resend link.
  - "Wrong email?" → change it without losing progress.
  - "Mail looks like spam?" → tip about adding sender to contacts.
- Primary: "Resend" quiet button + "Open inbox" link.

### `<AuthSplitScreen />`

A 1280×780 split: ambient illustration left (warm gradient + inkstain + a sample manuscript snippet), form right. Same form contents as `<AuthLogin />`. Variant only — the centered card is preferred.

---

## Surface 3 — Dashboard

All three variants share `<AppNav />`:

- Logo + nav: **Dashboard / Library / Homebrew** (3 items — was previously Characters / Campaigns / Homebrew; consolidated to make room for Library).
- Right side: ★ Alpha chip, "+ New character" quiet button, user avatar circle.

### Dashboard A — Characters-dominant

`<DashboardA />`. List-first layout.
- Welcome header ("Good evening, Raven.") + "+ Begin a new character" gold CTA.
- Star rule.
- 1.2/1 grid: "Last opened — Resume" card + "Alpha note · This week" changelog card.
- "Your characters" section heading + filter row (All / Active / Archived).
- Vertical list of `<JCharRow>` items (4 sample characters).
- "Coming next folio" strip — campaigns teaser.

### Dashboard B — Home base (recommended)

`<DashboardB />`. The cockpit/jump-back-in pattern.

**Layout:**
1. Header: "Welcome back, Raven." + waxing-crescent date marginalia.
2. **2/1 grid (top)**: large "Pick up where you left" card (portrait + name + level/class/campaign + last edit note + "Open →" gold sm) | "Alpha · what's new" changelog card (3 bullet items).
3. **Campaigns split (1/1 grid)** — *replaces an earlier 3-up tile pattern*:
   - **"II · Campaigns you run"** (gold-toned) — DM'd campaigns. Each row: glyph + title + role/players/schedule + "Open →".
   - **"III · Campaigns you play in"** (purple-toned, quiet) — campaigns the user is a player in.
4. **Characters list** — same `<JCharRow>` pattern as Dashboard A, with All (4) / Active (3) / Archived (1) filter row above.

This variant is the recommended dashboard. It surfaces both halves of the product (DM and player roles) without overloading the nav.

### Dashboard C — Portal

`<DashboardC />`. Minimalist title + big card grid (2 columns × 2 rows). Each card: portrait + name + level + class + campaign + headline stat.

### Dashboard Empty

`<DashboardEmpty />`. New-user state. Centered welcome + "Begin a character — what to expect" 5-step preview (Race → Class → Abilities → Background → Equipment) + gold "Begin a character →" button.

---

## Surface 4 — Library

`<Library />` in `journey-dashboard.jsx`. The system-scoped catalog.

### Layout

- **Page header:** "The Library" folio + "Compendium & catalog" h1 + "⌘K · Search the library" quiet button (top right).
- **System submenu** (full-width row, paper-2 background, hairline outline):
  - Tabs: D&D 5e *(active, gold)* · Pathfinder 2e *(placeholder)* · Call of Cthulhu *(placeholder)* · Custom system.
  - Each tab: label + faded italic note ("official + homebrew", "placeholder", "your rules").
- **Two-pane body** (240px rail + body):
  - **Catalog rail** (paper card, padded) — vertical list of category buttons with a count per category. Active button: gold left border + gold text + soft gold fill.
  - **Catalog body** (paper card, no padding):
    - **Toolbar:** category title + entry count + filter input + sort dropdown.
    - **Filter chips row** (paper-2 background): per-category filter groups, each row is `[group label] [chip] [chip] [chip]`. Toggle: active chip gets gold border + gold text + soft gold fill. "Clear filters" link appears when any are on.
    - **Body:** expandable list. Each row: 36×36 glyph tile (gold tone for official, purple for homebrew) + title (Marcellus 16px) + sub-line (12px muted) + meta (10.5px italic muted) + chevron `›`. Click a row to expand inline; chevron rotates 90°; row gets paper-2 fill; detail drawer opens beneath with `padding: 16px 20px 22px 72px` (left-indented to align under the title, not the glyph).

### Categories per system

For **D&D 5e** (the only fleshed-out system):

| Category | Count | Filter groups |
|---|---|---|
| Classes | 13 | Primary ability (STR/DEX/CON/INT/WIS/CHA), Hit die (d6/d8/d10/d12), Source (PHB/Homebrew) |
| Races | 42 | Size, Type *(stub)* |
| Monsters | 318 | CR (0–1, 2–4, 5–10, 11–16, 17+), Type, Size, Environment |
| Feats | 87 | Type, Prerequisite *(stub)* |
| Spells | 514 | Level (0–9), School, Casting time |
| Items | 1206 | Rarity, Type, Attunement *(stub)* |
| Backgrounds | 28 | — |
| Conditions | 16 | — |

### Expandable detail content

Three categories have full sample data and renderable detail panes:

- **Classes** — description paragraph + "★ Class features" eyebrow + bulleted feature list. 13 sample classes including a homebrew Witch (purple-toned, source: "Homebrew · Raven").
- **Spells** — three-column KV row (Casting time / Range / School) + description paragraph. 10 sample spells (Fireball, Cure Wounds, Shield, Detect Magic, Eldritch Blast, Counterspell, Wish, Healing Word, Misty Step, Mage Hand).
- **Monsters** — four-column KV row (Challenge / Type / Size / Environment) + description paragraph. 10 sample monsters (Goblin, Owlbear, Beholder, Ancient Red Dragon, Skeleton, Orc, Mind Flayer, Tarrasque, Kobold, Lich).

Other categories show: "Catalog list — same expandable + filter pattern as Classes / Spells / Monsters."

For **PF2e / CoC / Custom**: empty state ("[System] catalog — coming soon. System-specific catalogs will replace this view.").

### Behavior

- One row open at a time. Clicking the open row collapses it.
- Filter state is **per category** (switching categories preserves each category's filters).
- Filters AND together. Clicking an active chip deselects it.
- Empty filter state shows "No entries match the current filters." in the body.

---

## Interactions & Behavior (cross-surface)

- **Hover:** gold buttons brighten and gain a soft gold-tinted glow `0 0 28px -8px rgba(201,164,74,0.5)`. Purple buttons brighten and gain a purple glow. Quiet buttons gain a gold border.
- **Focus:** inputs get gold border + 3px gold soft ring (`0 0 0 3px rgba(201,164,74,0.1)`).
- **Transitions:** 120–150ms ease for color/border/background. No bouncy springs.
- **Animations:** Two named keyframes used sparingly:
  - `j-shimmer` — sparkle/star indicator (3s ease-in-out infinite).
  - `j-fade-in-up` — initial mount fade (0.7s).
  - `j-name-bloom` — character name reveal on sheet open (alluded to; not in this bundle).

## State management

For each surface:

- **Login / Signup / Verify:** standard form state. No special needs.
- **Dashboard:** server-fetched character + campaign list. Filter state is local.
- **Library:**
  - `system` (string), default `"dnd5e"`.
  - `cat` (string), default `"classes"`.
  - `open` (string | null) — currently expanded row key.
  - `filters` ({ catId: { groupId: value | null } }) — per-category filter state. Toggle behavior: setting an already-active value clears it.

Server-side: catalog data should be paginated when it goes live — the 514 spells / 1206 items totals will need virtualization or pagination.

---

## Top nav decision (important)

The top nav was simplified during design: **Characters / Campaigns / Homebrew** → **Dashboard / Library / Homebrew**.

Rationale: campaigns are surfaced inside the dashboard (as the "Campaigns you run / Campaigns you play in" split in Dashboard B), so they don't need a top-level slot. Library replaces them — system-scoped catalogs (Classes, Races, Monsters, Feats, Spells, Items…) are the highest-demand surface after the sheet itself.

Implement the nav as 3 items. The active item gets gold underline + gold text + 600 weight.

---

## Assets

No image assets are bundled. The `<JImg label="…" />` placeholder primitive draws a labeled gradient rectangle wherever a real image would go (portraits, hero illustrations, etc.). Replace with real assets — character portraits, hero artwork, etc. — during build.

The only "logo" is `<JLogo />`, which composes a small italic-Marcellus glyph. Treat it as a placeholder; replace with the final Inkbourne wordmark when available.

---

## Out of scope for this handoff

- **Character builder flow** — separate handoff package (`design_handoff_builder_ux_polish`).
- **Character sheet** — forthcoming, separate design exploration.
- **Narrative / lorebook page** — not yet designed.
- **Campaign detail page** — stub only (deep-link target from dashboard).
- **Homebrew workshop** — top-nav slot exists, but the editor itself is not designed.
- **Account settings** — not designed (acceptable to stub for alpha).

---

## Recommended build order (for alpha smoke test)

1. Auth (login + signup + verify) — gates everything.
2. Dashboard B with stub data — first thing testers see post-login.
3. Top-nav routing (Dashboard / Library / Homebrew).
4. Library shell + Classes catalog with at least 5e seed data — high-value surface, low complexity.
5. Landing B — public face, can ship after the rest.
6. Stub pages for Homebrew and any unbuilt surface so nav doesn't 404.
