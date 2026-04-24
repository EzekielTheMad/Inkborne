# Inkborne Builder UX Polish — Design Brief

> **Purpose:** First concrete experiment with Claude Design. This brief is a starting prompt — paste it in, let Claude Design scan the connected repo, then iterate.
>
> **Audience:** Claude Design (with GitHub access to the Inkborne repo).
>
> **Expected deliverable:** 2–3 interactive prototype variants per surface listed below, plus a recommendation call-out. When a direction is picked, export the handoff bundle — it comes back to Claude Code for implementation.

---

## 1. Product context

**Inkborne** is a community-driven TTRPG character + campaign management platform for D&D 5e (extensible to other game systems). The character builder is the first rich interaction new users experience. It determines whether players feel the app "knows D&D" — community UAT feedback names **D&D Beyond** as the visual and interaction target for this surface.

**Audience for this work:** existing D&D players coming from D&D Beyond, MPMB sheets, or paper. They expect dense class/race detail presented cleanly, with real interaction affordances (dropdowns, tabs, accordions) — not just text dumps.

**Voice:** restrained fantasy. The name "Inkborne" (ink + lineage) suggests parchment and manuscript restraint, not high-fantasy maximalism. The existing sheet uses uppercase tracked section headings, rounded cards, subtle borders — already the right direction. Keep consistent.

---

## 2. Design anchors (already in the repo — do not reinvent)

### Tokens (from `docs/brand-reference.md`)

- **Background:** `#0b0a10` near-black
- **Card:** `#13111d` dark panel
- **Foreground:** `#f0eef5` off-white text
- **Primary (CTAs, links, active states):** `#7c3aed` purple
- **Accent (headings, brand highlights):** `#c9a44a` gold
- **Muted-foreground (subtitle, placeholder):** `#8b85a0`
- **Destructive:** `#dc2626`

**Rule:** always use semantic color classes (`text-accent`, `bg-primary`, `text-muted-foreground`) — never raw Tailwind colors. The repo enforces this.

### Existing component library

- **shadcn/ui primitives** — Button, Card, Dialog, DropdownMenu, Input, Label, Select, Separator, Sheet, Tabs, Tooltip, Badge, Accordion
- Custom nav: `NavLink`, `UserDropdown`
- Custom sheet components: `StatRibbon`, `HPTracker`, `ResourceCounter`, `RestDialog` (do not redesign these — reference only for visual consistency)

### Existing sheet visual language (reference, don't target)

The character sheet (`/characters/[id]`) uses a three-column desktop layout with:
- `rounded-lg border border-border bg-card p-3` panels
- `text-accent font-semibold text-sm uppercase tracking-wide` section headings
- Small `[−]` / `[+]` steppers for counters
- Hover states with `hover:bg-accent/20`

The builder should feel like the same app. Same tokens, same spacing rhythm, same typography scale.

---

## 3. What to prototype

**Two focused surfaces. Give me 2–3 distinct variants of each, not one polish pass.**

### Surface A — Content Preview Modal

**Context:** Used across the Race, Class, and Background steps. When a user clicks a content card, a modal opens with full detail. The current modal is narrow and undifferentiated from a generic shadcn Dialog — not matching the depth players expect.

**Explicit asks:**
- Wider proportions that match D&D Beyond's content preview style
- **Class view:** header with class name, hit die, primary ability, saving throw proficiencies, armor/weapon proficiencies at a glance. Tabbed/sectioned below: Features by level, Spellcasting summary (if applicable), Equipment starting set, Subclasses list
- **Race view:** header with species + size + speed + languages + age range. Sections below: Traits (with descriptions), Subraces (if any), Source
- **Background view:** header with skills + languages + tools + equipment. Section below: Feature, Personality/Ideals/Bonds/Flaws tables, Source
- **Icon/portrait slots:** design placeholders for class icons and race portraits even if the assets are stubs today
- **Mobile:** full-screen Sheet (bottom-up slide or side drawer) below `md` breakpoint, not a modal — modals on mobile cramp content

**Key variant dimension I want to see explored:**
- Left-nav tabs (section list on the left, content on the right)
- Top tabs (horizontal tab strip, scrollable content below)
- Scroll-with-section-anchors (single long pane, sticky section nav)

Show all three. Pick a recommended one with reasoning.

### Surface B — Class Step layout

**Context:** The class selection + level + subclass + features page. This is the most complex builder step — a Level 20 Fighter shows ~8 ASI slots, ~15 features, subclass features starting at level 3, fighting style choice at level 1, maneuvers (if Battle Master), etc. Current layout is a flat scroll that gets unwieldy quickly.

**UAT feedback (verbatim issues to fix):**

- The level dropdown plus a separate "Level Up" button is redundant → drop the button; the dropdown is enough
- **ASI (Ability Score Improvement)** should appear as **separate interactive entries** at each level it's granted (4, 8, 12, 16, 19 for most classes). Currently collapsed into one — this loses the fact that an L20 Fighter gets 6 of them
- Feature choices (e.g., "Choose a Fighting Style", "Choose a Circle of Druids", "Choose a Pact Boon") need working inline dropdowns, visually distinct from passive features
- Proficiency choices ("Choose a Barbarian Skill: [dropdown]") need the same inline dropdown selector pattern
- **Subclass selection dropdown** at the level it unlocks — 3 for most, 1 for Sorcerer/Warlock, 2 for Druid/Cleric. Subclass features should thread in at subsequent levels once picked
- Feature cards need collapsible descriptions ("Show More") — some features are a full paragraph, most users only skim

**Key variant dimension I want to see explored:**
- Single scroll with level-grouped sections (current approach, polished)
- Accordion-per-level (one level expanded at a time, collapses others)
- Sidebar-nav-by-level + right-pane features (D&D Beyond style — level 1, 2, 3 in a left column; click to scroll/jump the right pane)

Show all three. Pick a recommended one with reasoning.

---

## 4. Constraints (respect these)

- **Palette:** gold accent + purple primary + near-black, as in `docs/brand-reference.md`. Do not invent a new palette.
- **Typography:** system font stack. No custom font pick in scope.
- **Character sheet layout is sacred** (`/characters/[id]`). Do not suggest changes there — this brief is builder-only.
- **Accessibility:** keyboard navigation (Tab, Enter, Esc), focus rings visible, aria labels on interactive elements
- **Mobile-first responsiveness:** anything that doesn't fold gracefully below `md` (768px) is a non-starter. Alpha includes mobile users.

---

## 5. Decisions I want your help with — surface as variants, don't pick unilaterally

- How prominent should **subclass selection** be relative to class features? (dominant card at the top, inline with its unlock level, or nested inside the level group)
- How to visually **distinguish "choice required" features** from passive ones (badge, color band, section split, disabled-until-resolved styling)
- **Class icons:** portrait-style (tall, character illustration) vs. emblem-style (compact, iconic) vs. typography-only. Show options.
- **Subrace selection** (Race step): inline under the parent race card, or a separate secondary card row that appears only after parent is selected

---

## 6. Non-goals (don't spend cycles here)

- Landing page, marketing pages, logo — not in scope
- Combat/actions/spell-casting UI — separate projects (spell casting is still being designed)
- New component library — use shadcn primitives the Tailwind scan will expose
- Rewriting the existing character-sheet views
- Dark → light theme — we'll define light theme separately later

---

## 7. Files to scan for context

- `components/builder/` — current builder components
  - `content-preview.tsx` — the current preview modal
  - `content-browser.tsx` — the card grid for picking content
  - `builder-step-nav.tsx` — step-by-step navigation
  - `asi-selector.tsx` + `choice-selector.tsx` — the broken dropdown widgets UAT flagged
- `app/(app)/characters/[id]/builder/` — the step pages (race, class, abilities, background, equipment)
- `components/sheet/` — visual-consistency reference (not a redesign target)
- `docs/brand-reference.md` — color + typography + usage rules
- `docs/superpowers/specs/2026-04-08-character-builder-design.md` — original design intent

---

## 8. What to return

For each surface (Preview Modal, Class Step):
- **2–3 distinct layout variants** as interactive prototypes
- **Brief notes per variant:** the tradeoff it makes (e.g., "fastest to scan vs. most depth shown at once")
- **A recommendation** with reasoning — if one is clearly best, say so

When I pick a direction, **export the handoff bundle** — I'll bring it to Claude Code for implementation as React/Tailwind components that honor the existing Inkborne state shape and hooks.

---

## Appendix: tone / keep-in-mind

- This is a working brief, not a spec. Ask questions if any of the above is ambiguous — don't guess silently.
- Real characters built in this tool include Wizards with 15 prepared spells, Fighters with 8 ASI slots, Paladins with spellcasting + channel divinity + lay on hands. The UI must hold up at high levels without collapsing into chaos. Show a **Level 12+ example** in at least one variant so we can pressure-test density.
- D&D Beyond is the reference. You don't need to clone it — you need to match its density, hierarchy, and interaction affordance standards. Inkborne should feel recognizable to a D&D Beyond user without being a clone.
