# Inkborne User Journey — Design Brief

> **Purpose:** Design the full user journey from landing page through character creation and into the character sheet. Companion to `builder-ux-polish.md`, which covers the builder segment specifically.
>
> **Audience:** Claude Design (with GitHub access to the Inkborne repo).
>
> **Expected deliverable:** 2–3 interactive prototype variants for each surface listed below, a strategic POV on the journey as a whole, plus per-surface recommendations. When directions are picked, export handoff bundles — they come back to Claude Code for implementation.

---

## 1. The journey, in one paragraph

A new user discovers Inkborne (landing page), decides it's for them, creates an account (signup/login), arrives on a home that suggests what's possible (dashboard), creates their first character (new-character entry), walks through a guided build (builder — covered in adjacent brief), and arrives at a living character sheet that feels like theirs (character sheet). Every surface should reinforce the next. Every transition should feel intentional, not like crossing a seam.

This brief is about making those surfaces cohere as a single experience — not seven unrelated pages that happen to be in the same app.

---

## 2. What Inkborne is (for framing voice)

- **Community-driven TTRPG character + campaign management** — D&D 5e today, extensible to other systems
- **Competitive positioning:** visually dense like D&D Beyond, narratively rich like LegendKeeper, homebrew-flexible like MPMB. Players are expected to be coming from one of these and to have high expectations for density and polish.
- **Tone:** "Your characters are *inkborne*." Parchment and manuscript restraint, not high-fantasy maximalism. The name suggests ink, ancestry, inheritance. The app should feel like a sturdy notebook that happens to compute everything for you.
- **Target users:** experienced D&D players and DMs first; entirely-new-to-TTRPG users are a secondary audience for now.

---

## 3. Cross-cutting design anchors

### Tokens (from `docs/brand-reference.md` — already in the repo)

| Token | Hex | Role |
|---|---|---|
| background | `#0b0a10` | near-black |
| card | `#13111d` | dark panel |
| foreground | `#f0eef5` | off-white text |
| primary | `#7c3aed` | purple — CTAs, links, active states |
| accent | `#c9a44a` | gold — headings, brand highlights |
| muted-foreground | `#8b85a0` | subtitle, placeholder |
| destructive | `#dc2626` | delete, error |

**Always use semantic classes** (`text-accent`, `bg-primary`). Never raw Tailwind colors.

### Typography

System font stack today. A custom display font could be introduced in this brief's scope if it materially improves the feel — e.g., a subtle serif for the accent/headline role, reinforcing the "manuscript" voice. If you propose one, include both treatments (system-only vs. display-accent) so we can compare.

### Component library

- **shadcn/ui primitives** — already installed: Button, Card, Dialog, DropdownMenu, Input, Label, Select, Separator, Sheet, Tabs, Tooltip, Badge, Accordion, Avatar
- Custom: `NavLink`, `UserDropdown`, `Logo`, `LandingNav`, `LandingFooter`
- Existing sheet components (`StatRibbon`, `HPTracker`, `ResourceCounter`, `RestDialog`, `Conditions`, `DeathSaves`) — **reference only**, not targets for redesign

### Motion + transitions (a key cross-surface concern)

- Surface transitions should feel intentional — not jarring page loads
- Inkborne doesn't have a motion system today; proposing one is in scope for this brief
- Specifically worth designing: the moment of arrival at a freshly built character sheet (celebratory but subtle, not confetti)

---

## 4. Per-surface tactical asks

Compact section per surface. Give 2–3 variants per major surface (landing, dashboard, character list, sheet arrival) and polish proposals for the smaller connective ones (login, signup, verify, new-character).

### 4.1 Landing (`/`)

**Current state:** Hero with "Your characters are *inkborne*" tagline, fake character preview card, three-column trust bar (Open Source / Built by Players / Community), CTA "Start Building". Functional but generic — could belong to any SaaS.

**What's missing:** a reason to care beyond the tagline. What does Inkborne do that a D&D Beyond user doesn't already have? Why community-driven matters. What the narrative-first angle actually looks like.

**Prototype variants:**
- **Hero-first** (current direction, polished) — dominant hero + preview + trust bar + CTA. Best for cold traffic.
- **Feature-forward** — hero collapses to a single line, three concrete "this is what's different" sections with small visuals (community/homebrew, narrative, all-in-one), social/trust section, closing CTA. Best for explaining the differentiation.
- **Story-led** — hero with ambient visual or animation, an inline "What is Inkborne?" section, a walkthrough of one character's journey (from empty sheet to rich character), closing CTA. Most ambitious, best for investors/enthusiasts.

**Explicit asks:**
- Replace the fake Level 5 Wizard preview mockup with something more representative (or make its mockup-ness explicit — "This is what a character looks like").
- Account for the existing alpha context: "This is an alpha, apply for access" is a possible framing if you want to signal exclusivity vs. trying to convert broad traffic.
- Include a strong "why open source" moment — it's part of the identity, not just a line on a trust bar.

### 4.2 Authentication: Login, Signup, Verify

**Current state:** Three separate client-side pages (`/login`, `/signup`, `/auth/verify`). Each is a centered card on a plain background. OAuth first (Discord + Google), email form below, links between pages. Functional, clean, unbranded beyond the Logo.

**Prototype asks (polish, not reinvention):**
- Consistent visual treatment across all three (background style, card framing, spacing, input styling)
- Consider a subtle ambient background — textured dark, not black void. A hint of "you're entering something crafted," not Supabase-default auth pages.
- **Error states** — design the "invalid credentials" / "email not verified" / "user exists" states explicitly, not just red text below the form
- **Verify page needs a clearer "what now"** — today it says "Check your email" with a resend button, but a brand-new user who didn't receive the email within 30 seconds will bounce. Consider adding troubleshooting steps, expected wait time, alternate confirm path.

**Variant to explore:** full-bleed split-screen (visual left, form right) vs. current centered card. Only worth doing if the visual half earns its space — otherwise stick with the centered card + better background.

### 4.3 Dashboard (`/dashboard`)

**Current state:** "Welcome, [name]" heading + two equal-width cards: Characters (with character list or empty-state CTA) + Campaigns ("coming soon"). First-time UX audit (`docs/alpha/first-time-ux-audit.md`) calls out that the Campaigns card takes up 50% of the visual space for a feature that doesn't exist yet.

**Prototype variants:**
- **Characters-dominant** — single-column layout prioritizing the character list + prominent "Create character" action, with secondary info (recent activity, tips, alpha context) in a sidebar or below the fold. Campaigns not shown (or thin strip at the bottom).
- **Home base** — grid with Characters card, a small "What's new / alpha notices" card, a "Jump back in" quick-action card pointing to the last-edited character, and Campaigns as a placeholder. Dashboard becomes a cockpit.
- **Portal-style** — minimal heading, character list dominates with portrait thumbnails + class badges, everything else collapses into nav/dropdown. Best for users with many characters.

**Explicit asks:**
- The empty state for brand-new users should read as "welcome, here's how to start" — not "you have nothing." First-time UX audit F3/F4 proposes a dismissible alpha banner; integrate that into whichever variant you pick.
- Recent activity (when it exists) and "jump to last character" are compelling patterns — design affordances for them even if the data hookup happens later.

### 4.4 Character dashboard / list (`/characters`)

**Current state:** Grid of `CharacterCard` components (or empty state with CTA). Title + description + "Create New Character" button top-right. Cards show basic info: name, level, class/race. No filter/sort, no portraits, no campaign association visible.

**Prototype variants:**
- **Card grid, richer cards** — upgrade each card to show portrait thumbnail, class + race + level, last edited, campaign tag (if any), inline "open" / "duplicate" / "archive" actions. Same grid layout.
- **List view with thumbnail** — compact horizontal rows, sortable/filterable by class/system/campaign/last-edited. Best for users with 5+ characters.
- **Toggleable both** — user picks grid or list, preference saved.

**Explicit asks:**
- Design the **empty state as welcoming**, not barren — show a sample character outline, a "create your first character" CTA with context about what creation involves (matches first-time UX audit F5)
- Archived characters should be reachable (filter toggle or separate tab) but not visible by default
- Account for eventual campaign groupings — when a user has characters across multiple campaigns, how does the list communicate that?

### 4.5 New-character entry (`/characters/new`)

**Current state:** Minimal form card — character name + game system dropdown → submit creates character row, redirects to `/characters/[id]`. First-time UX audit F2 proposes auto-selecting the system when only one is published; F5 proposes adding "here's what happens next" context.

**Prototype variants:**
- **Welcoming form** — same single-step form, but dressed up: small heading "Begin a new character," helper copy about what follows, maybe a subtle thematic treatment (a line of text at the top like an opening sentence of a story)
- **Preview-on-the-side** — form on the left, a preview panel on the right showing "what you'll build next" (race → class → abilities → background → equipment, with small icons) — reassures users who want to know the scope before committing
- **Inline modal from dashboard** — skip the dedicated page; "Create character" on the dashboard opens a modal that captures name + system (if > 1) and redirects into the builder

**Explicit asks:**
- If only one game system is published, the system dropdown should disappear — form becomes one field + submit. Don't design around a dropdown that doesn't need to exist.
- The opening moment should feel more like starting a story than filling a form. Small thing — consider microcopy: "Begin a new character" > "Create New Character" in heading; "What will they be called?" > "Character Name" in label.

### 4.6 Pre-built character state (`/characters/[id]` with no choices yet)

**Current state:** After creating a character name but before running the builder, the character detail page renders `SheetPanel`'s no-sheet branch — a centered Sparkles icon + "Let's build your character" + "Start Building" button that links to the builder. First-time UX audit F6 proposes auto-redirecting for brand-new characters.

**Prototype asks:**
- **Do we keep this page?** — if F6 wins and we auto-redirect, this state is only visible when a user interrupts the builder and returns. In that case, it should read as "you're partway through" with a "Resume building" CTA.
- **What does "partway" look like?** — progress bar / step indicator / "X of 5 steps remaining" cues, pick-up point clearly named
- **Or: treat this state as a moment of pause** — a beautiful blank-page feeling, not urgent. The character name is theirs, the builder waits. Less "start building now" pressure, more "this is yours to shape."

Variants can explore whether this page is transient (auto-redirect) or resident (always shown pre-build, with richer presentation).

### 4.7 Character sheet — first arrival (post-builder)

**Current state:** When a player completes the final builder step and clicks Finish, they land on the fully-populated character sheet (`/characters/[id]`) with no special treatment. It's the same sheet they'll see every time from here on.

**Prototype asks:**
- Design the **moment of arrival** — a brief celebratory state that plays once when a character is first completed. Options: fade-in from dark with the name appearing in gold, a "Your character is ready" banner that slides down and dismisses, a subtle portrait reveal. Not confetti. Not a modal. Something that makes the builder completion feel earned.
- This is a one-time animation/state — on second load, the sheet renders normally. Implementation detail: check `choices.classes.length > 0` AND a "seen_sheet_first_time" flag on the character state.
- Should tie back to the journey visually — if the landing page has a particular visual motif (ink flourish, parchment texture), the arrival could echo it.

### 4.8 Character sheet — polish pass (no restructure)

**Layout is preserved.** The three-column desktop layout (stat ribbon top, left column with sub-widgets, skills middle, content tabs right) and the mobile tabs view have been iterated extensively. **Don't move anything.** Components stay where they are. Sub-widgets stay in their columns. The stat ribbon's order doesn't change. The mobile tab order doesn't change.

**But polish is in scope.** A pass over the sheet for visual consistency, hierarchy, density, and microcopy is welcome — and probably overdue. The sheet has accreted features over many phases (HP tracker, slot tracker, resources widget, conditions redesign, rest dialog, death saves) and the visual language across them isn't fully unified.

**What's in scope (yes, prototype these):**

- **Typography hierarchy** — section headings (`text-accent uppercase tracking-wide`) are mostly consistent but spacing and size vary. Field labels, value emphasis, and tertiary muted text could be tightened into a clear three-level hierarchy.
- **Spacing rhythm** — panel padding (`p-3`), inter-panel gap (`space-y-4`), and intra-panel spacing should feel consistent. Some panels feel cramped, some loose. A unified rhythm helps the eye scan.
- **Border + background usage** — `bg-card` vs. `bg-card/50`, `border-border` vs. `border-border/50` — there's some drift across panels. Pick a clear two-level system (primary panel vs. secondary nested panel) and apply consistently.
- **Color application** — gold accent is currently overused for headings; muted-foreground is the workhorse for everything else. A polish pass might introduce one more semantic level (e.g., a subtle desaturated accent for "value" text vs. labels) to break up monochrome density.
- **Empty states** — Actions tab shows "No weapons equipped" plainly; Spells tab has its own empty messaging; Inventory has another. These should share a visual treatment (centered, muted, with relevant CTA).
- **Hover + focus affordances** — clickable rows (skill rows, ability cards, HP tracker) have inconsistent hover treatments. Cleaner unified hover/focus styling would reduce cognitive load.
- **Tooltip styling** — exists in places (Exhaustion RAW summary, disabled buttons), inconsistent treatment. Pick one styling convention.
- **Microcopy polish** — section titles ("Saving Throws", "Defenses", "Conditions"), button labels, empty state copy. A pass for consistent voice and density.
- **Stat ribbon polish** — ability cards, combat stat block, HP tracker, Death Saves, Rest button currently sit side-by-side with inconsistent visual weight. The grouping is correct (don't reorder), but the visual treatment of each block could harmonize better.
- **Iconography** — section headings could use small icons next to the gold-uppercase labels (Saving Throws + shield, Conditions + alert, Defenses + sparkles, etc.). Today there are no icons on most section headings; consistent iconography would aid scanning. Prototype with and without to compare.
- **Density** — could the sheet show more at a glance without feeling cramped? Pixel-by-pixel review of where breathing room helps vs. where compression buys real estate.

**What's out of scope (don't propose these):**

- **Reordering or relocating components.** Don't move the HP tracker. Don't move Saving Throws. Don't change which column the Skills list lives in. Don't reshuffle the content tabs (Actions / Spells / Features / Inventory / Notes).
- **New components.** No "Recently used" widget, no "Combat log" panel, no new tracker. Polish what's there.
- **Interaction pattern changes.** HP tracker stays a popover. Conditions widget keeps the dropdown picker. Rest button keeps the dialog. Don't propose new flows.
- **Mobile structure.** Tabs stay tabs; the mobile sheet's section order stays as-is.

**Variants to explore:**
- **Conservative polish** — same layout, same components, tightened typography + spacing + color hierarchy. The "calm pass" version. Best for shipping fast.
- **Considered polish** — same layout but introduces an iconography system on section headings, refined two-level panel framing (primary vs. nested), and a third semantic text color for value emphasis. More design investment, more visible improvement.
- **Density-tuned polish** — primarily about breathing room and information density. Where can fields tighten? Where do they need more space? Best for power users who scan often.

Show all three; pick a recommended one.

**Deliverable shape for this surface:** annotated screenshots of the polished sheet at desktop and mobile, with each polish decision called out. Include before/after pairs where helpful. The handoff bundle should include exact class changes (Tailwind utility deltas, not full component rewrites) so implementation is a careful diff, not a rebuild.

---

## 5. Journey-level concerns (across all surfaces)

### 5.1 Continuity of visual language

Across all seven surfaces, the following should read as obviously-one-product:
- Same typographic scale
- Same button treatments
- Same gold-for-emphasis pattern
- Same card framing style
- Recurring motifs — if you introduce an ink flourish or parchment texture, use it consistently (not on every page, but in the same spots)

### 5.2 Transitions between surfaces

- Landing → Signup: carry the tagline context into the auth page somehow
- Signup → Dashboard: the "arrival" moment for a brand-new user
- Dashboard → New character: a "begin a story" feel
- Builder → Sheet: the "your character is ready" moment (covered in 4.7)

Don't over-engineer with heavy animations. Subtle continuity > flashy transitions.

### 5.3 Nav consistency

Top nav varies by context today: landing has `LandingNav`, authenticated pages have `AppNav` + `MobileNav`. Design the relationship. Brand logo should be consistent. User avatar is always in the same spot on authenticated pages. Logged-in users who visit `/` should either: (a) auto-redirect to dashboard (current behavior), (b) see landing with "Go to dashboard" as the primary CTA, or (c) see a contextual logged-in landing. Pick one.

### 5.4 Mobile consistency

Every surface must fold gracefully below `md` (768px). Alpha includes mobile users. The existing mobile nav sheet works; the landing page is responsive; but the builder flow hasn't been pressure-tested on mobile. If your new-character and dashboard variants require desktop-minimums, flag that.

---

## 6. Explicit non-goals

- **Builder steps themselves** — covered in `docs/design-briefs/builder-ux-polish.md`
- **Character sheet structural changes** — see 4.8 for the polish-only scope. Don't move components. Don't reorder. Don't add or remove widgets. Polish typography, spacing, color, hierarchy, copy, hover/focus states only.
- **Campaigns feature** — not yet implemented; anything showing campaigns is placeholder
- **Admin / feedback dashboards** — internal tools, not user-journey surfaces
- **Settings page** — out of scope; polish later
- **Light theme** — not yet defined; design for dark only
- **Logo redesign** — existing logo stays

---

## 7. What to return

For each surface:

| Surface | Scope |
|---|---|
| 4.1 Landing | 2–3 variants |
| 4.2 Login / Signup / Verify | Polish + one variant exploration |
| 4.3 Dashboard | 2–3 variants |
| 4.4 Characters list | 2–3 variants |
| 4.5 New-character entry | 2–3 variants |
| 4.6 Pre-built state | 2 variants (transient vs. resident) |
| 4.7 Sheet arrival moment | 1–2 options |
| 4.8 Sheet polish pass | 3 polish levels (conservative / considered / density-tuned) — annotated diffs, no restructure |

**Plus a journey overview** — a short POV / recommendation about which combination of variants hangs together best, and why. If there are cross-surface dependencies (e.g., "the dashboard variant B only works if new-character is a modal"), call them out.

**Deliverable format:** Interactive Claude Design prototypes + brief rationale per variant. Export handoff bundles when directions are picked.

---

## 8. Files to scan for context

- `app/page.tsx` — landing page
- `app/(auth)/login/page.tsx`, `signup/page.tsx`, `auth/verify/page.tsx`, `auth/forgot-password/page.tsx`, `auth/reset-password/page.tsx`
- `app/(app)/layout.tsx` — authenticated shell
- `app/(app)/dashboard/page.tsx`
- `app/(app)/characters/page.tsx` — characters list
- `app/(app)/characters/new/page.tsx`
- `app/(app)/characters/[id]/page.tsx` — character shell entry
- `components/nav/` — app nav + mobile nav
- `components/landing/` — landing-specific components
- `components/characters/character-card.tsx` — character list card
- `components/character/sheet-panel.tsx` — the no-sheet branch for 4.6
- `docs/brand-reference.md` — tokens + usage rules
- `docs/alpha/first-time-ux-audit.md` — the audit that informed this brief's gaps
- `docs/design-briefs/builder-ux-polish.md` — the adjacent brief covering the builder segment

---

## 9. Tone note

This is an **alpha-stage product used by a known group of players**, not a public launch. Design accordingly:
- Polish matters because these are experienced players who'll judge by D&D Beyond's bar
- But ambition should serve the journey, not be ornament. If a motion or motif doesn't earn its complexity, cut it.
- Recommendations should consider what's buildable in ~1–2 weeks by one engineer with Claude Code doing implementation handoff. Not what could theoretically be built with unlimited time.

Ask questions if any of the above is ambiguous. Don't guess silently.
