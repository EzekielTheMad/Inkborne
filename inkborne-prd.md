# Inkborne — Product Requirements Document
## TTRPG Character & Campaign Management Platform

**Domain:** inkborne.app
**Version:** Draft 1.0 — April 2026
**Author:** Victor (with research assistance)

---

## Vision

Inkborne is a community-driven, multi-system TTRPG character and campaign management platform. It launches with SRD content for supported systems and provides seamless paths for users to add official content they own and homebrew material. Built for both players and DMs, Inkborne puts creative control in the user's hands with tools that are easy to use and stay out of the way.

**Core philosophy:** Your characters are inkborne — born from what you write. We provide the well; you bring the ink.

---

## Competitive Landscape Summary

| Platform | Strengths | Weaknesses | Relevance to Inkborne |
|---|---|---|---|
| **D&D Beyond** | Polished character builder, integrated dice, content marketplace, Maps VTT, shared content in campaigns | D&D-only, subscription + per-book costs, homebrew is clunky and limited (no custom classes), rebuilding platform from scratch in 2026, search is poor | Direct competitor for D&D players; their homebrew pain is our opportunity |
| **Demiplane / Nexus** | Multi-system (PF2e, VtM, Daggerheart, Cosmere, etc.), publisher partnerships, clean character builder with tooltips, PDF export | Acquired by Roll20 (consolidation risk), per-book purchasing model, limited homebrew, no community-driven content layer | Closest to Inkborne's multi-system vision but locked to publisher deals |
| **MPMB Character Sheet** | Fully automated PDF, open source (GPL), JavaScript-based extensibility via import scripts, offline/printable, community add-on ecosystem, free | Desktop Adobe Acrobat only (no mobile, no web), D&D 5e only, steep learning curve for adding content, no campaign management, no collaboration | Key reference for extensibility model — their script import system is what "easy homebrew" looks like done right (but too technical for most users) |
| **Roll20** | Largest VTT userbase, 250+ system support, free tier, integrated voice/video, community character sheets | VTT-first (not character management focused), interface feels dated, performance issues with complex maps | Integration target, not direct competitor |
| **Foundry VTT** | Self-hosted, one-time purchase, 200+ systems, massive module ecosystem, community-driven | Requires hosting/technical setup, steep learning curve, no built-in character builder separate from VTT | Module ecosystem is a model for community extensibility |
| **LegendKeeper** | Beautiful editor, fast, excellent maps, wiki-style worldbuilding, distraction-free | No character sheets/builders, subscription model, limited campaign management | Worldbuilding features are aspirational for Inkborne's campaign tools |
| **Kanka** | Flexible entity system, relationship mapping, custom calendars, generous free tier, community-driven | No character builder, not pretty, no game rule automation | Entity relationship model is worth studying for campaign management |
| **World Anvil** | Massive feature set, RPG stat blocks, maps, timelines, family trees, community | Overwhelming UI, expensive paid tiers, cluttered with ads on free tier | "Everything but the kitchen sink" — cautionary tale for scope |
| **Pathbuilder** | Excellent PF2e builder, web + Android, fast | PF2e only, no campaign management | Reference for system-specific builder done well |
| **Hero Lab** | Multi-system, deep rule automation, strong character management | Expensive ($35+ per system), desktop-heavy, dated UI | Legacy competitor, shows demand for multi-system tooling |

---

## Feature Requirements

### Priority Definitions

- **MUST HAVE (P0):** Required for MVP launch. Without these, the platform has no value proposition.
- **SHOULD HAVE (P1):** Expected within 3-6 months of launch. Users will ask for these quickly.
- **WANT (P2):** Differentiators and polish. These make Inkborne special but aren't blockers.
- **FUTURE (P3):** Long-term vision. Worth designing the data model to support, but not building yet.

---

### 1. USER & ACCOUNT SYSTEM

| Feature | Priority | Notes |
|---|---|---|
| User registration / login (email + OAuth) | P0 | Google, Discord OAuth at minimum |
| User profile (display name, avatar, bio) | P0 | |
| Dual role: user can be both Player and DM | P0 | Same account, not separate profiles |
| Account-level settings (theme, preferences) | P1 | |
| Public profile / portfolio of characters | P2 | Optional — user controls visibility |

---

### 2. MULTI-SYSTEM ARCHITECTURE

| Feature | Priority | Notes |
|---|---|---|
| System-agnostic data model | P0 | Characters, campaigns, content all reference a "game system" |
| System selection during character creation | P0 | "What system is this character for?" |
| D&D 5e SRD support | P0 | Launch system — free/open content |
| Dagger Heart SRD support | P0 | Launch system — second system to prove multi-system works |
| System definition schema | P0 | Defines what a character sheet looks like for each system: stats, fields, sections, calculated values |
| Ability to add new systems over time | P1 | Admin or community can define new system schemas |
| System version support (e.g., D&D 5e 2014 vs 2024) | P1 | D&D Beyond is struggling with this right now — learn from their mistakes |
| System-specific rule validation | P2 | e.g., "you can't take this feat without 13 STR" |

**Architecture note:** This is the most critical design decision. The system schema needs to be flexible enough to describe any TTRPG's character sheet structure without being so abstract that it's unusable. Study how MPMB handles this with JavaScript objects, how Foundry VTT defines game systems, and how Demiplane structures their Nexus per-system.

---

### 3. CHARACTER BUILDER

| Feature | Priority | Notes |
|---|---|---|
| Step-by-step guided character creation | P0 | Walk user through: system → name → race/species → class → abilities → background → equipment |
| Character sheet view (read/play mode) | P0 | All stats, abilities, inventory, spells on one page |
| Auto-calculated derived stats | P0 | AC, initiative, save DCs, attack bonuses, etc. — this is what makes digital sheets worth using |
| Ability score assignment (standard array, point buy, manual) | P0 | |
| Race/species selection with trait application | P0 | Traits auto-apply to sheet (darkvision, skill proficiencies, etc.) |
| Class selection with feature tracking by level | P0 | Features unlock as you level up |
| Subclass selection | P0 | |
| Multiclassing support | P1 | Complex but expected |
| Background selection with feature/proficiency application | P0 | |
| Level up flow | P0 | HP increase, new features, ability score improvements, spell slots |
| Hit point tracking (current, max, temp) | P0 | |
| Death saves tracking | P1 | |
| Conditions tracking (poisoned, stunned, etc.) | P1 | |
| Multiple characters per account | P0 | No artificial limit |
| Character duplication / templating | P2 | "Make a copy of this character" |
| Character archiving (soft delete) | P1 | Don't lose old characters |
| Quick builder mode (presets/defaults for fast creation) | P2 | D&D Beyond just launched this — it's popular |

---

### 4. SPELL MANAGEMENT

| Feature | Priority | Notes |
|---|---|---|
| Spell list by class with filtering/search | P0 | Level, school, casting time, concentration, ritual |
| Known / prepared spell tracking | P0 | Different casters work differently (known vs prepared) |
| Spell slot tracking (used/remaining) | P0 | Per-level tracking with reset on rest |
| Spell detail view (full description, components, duration) | P0 | |
| Spellbook management for Wizards (and similar) | P1 | Separate from "known" spells |
| Concentration tracking | P1 | Flag active concentration spell |
| Spell save DC / attack bonus auto-calc | P0 | |
| At higher levels casting | P1 | Show upcast effects |

---

### 5. INVENTORY & EQUIPMENT

| Feature | Priority | Notes |
|---|---|---|
| Equipment list with properties | P0 | Weight, cost, description, type |
| Equip/unequip items (affects AC, stats) | P0 | |
| Attunement tracking (3 item limit for D&D) | P1 | System-specific limits |
| Currency tracking (with conversion) | P0 | CP/SP/EP/GP/PP for D&D |
| Encumbrance calculation (optional) | P1 | Some tables use it, some don't |
| Custom items (add your own) | P0 | |
| Party inventory (shared loot) | P1 | DM or designated player manages |
| Magic item properties and charges | P1 | |

---

### 6. CHARACTER DEPTH & NARRATIVE

| Feature | Priority | Notes |
|---|---|---|
| Backstory text field (rich text) | P0 | |
| Personality traits, ideals, bonds, flaws | P0 | Standard D&D fields but generalizable |
| Character portrait/art upload | P1 | |
| Character notes (freeform, per-session or general) | P1 | |
| Appearance description | P1 | |
| Allies & organizations | P2 | |
| Relationship tracking (to other PCs, NPCs) | P2 | Who knows who, how they feel about them |
| Character timeline / event log | P2 | "Session 3: Lost my arm. Session 7: Got a prosthetic." |
| Character journal / diary entries | P2 | |
| Art gallery (multiple images per character) | P3 | |

---

### 7. HOMEBREW & CONTENT MANAGEMENT

| Feature | Priority | Notes |
|---|---|---|
| Structured forms for adding homebrew content | P0 | Species, classes, subclasses, spells, items, feats, backgrounds |
| Content scoped to: personal, campaign, or public | P0 | Creator controls visibility |
| Import/export content as shareable files (JSON) | P1 | MPMB's strongest feature — easy sharing |
| Homebrew content validation | P1 | "This spell is missing a school" type checks |
| Official content upload (manual entry of books you own) | P0 | User enters content from PHB, XGE, etc. — we can't distribute it but they can enter it |
| Content packs / bundles | P2 | "Here's all of Xanathar's Guide subclasses" as a community package |
| Community content marketplace/library | P2 | Browse, rate, import other people's homebrew |
| Content versioning | P2 | Track changes to homebrew over time |
| Homebrew custom mechanics (beyond standard fields) | P3 | Custom calculated fields, new resource types, etc. |
| Content approval / moderation for public sharing | P2 | Prevent copyright issues, quality control |

**Key insight from research:** D&D Beyond's homebrew system is universally described as clunky. Users can't create full custom classes, the process of adding homebrew to character sheets is multi-step and confusing, and sharing requires a subscription. MPMB solves extensibility with JavaScript import scripts, which is powerful but too technical for most users. Inkborne needs a middle path: structured forms that are easy to fill out but produce content that integrates seamlessly into the character builder.

---

### 8. CAMPAIGN MANAGEMENT

| Feature | Priority | Notes |
|---|---|---|
| Create campaign (name, description, system, settings) | P0 | |
| Invite players to campaign via link/code | P0 | |
| Associate characters with campaigns | P0 | A character belongs to one campaign at a time |
| DM view: see all player character sheets | P0 | Read-only or full access (DM controls) |
| Player view: see own character + party members (limited info) | P0 | |
| DM can also be a player in another campaign | P0 | Core requirement from Victor |
| Campaign-level content sharing | P1 | DM's homebrew available to all campaign members |
| Session log / recap | P1 | |
| Campaign notes (DM-only and shared) | P1 | |
| NPC tracker | P2 | Name, description, location, relationship to party |
| Campaign calendar / timeline | P2 | |
| Quest tracker | P2 | |
| Lore wiki (linked entries) | P3 | |
| Map upload and annotation | P3 | |
| Player-facing vs DM-only content toggle | P1 | Secrets and spoilers |

---

### 9. DICE & MECHANICS

| Feature | Priority | Notes |
|---|---|---|
| Integrated dice roller | P1 | Click stat/skill/attack to roll |
| Roll history / log | P2 | |
| Custom roll formulas | P2 | "4d6 drop lowest" etc. |
| Advantage/disadvantage toggle | P1 | |
| Shared rolls visible to party/DM | P2 | |
| Roll animations | P3 | Nice to have, not critical |

---

### 10. PRINT & EXPORT

| Feature | Priority | Notes |
|---|---|---|
| Print-friendly character sheet (PDF export) | P0 | Survey specifically asks about this — players want paper at the table |
| Clean, readable print layout | P0 | Not just a screenshot — properly formatted for paper |
| Export character data (JSON) | P1 | For backup, migration, sharing |
| Import character data (JSON) | P1 | |
| Export to standard character sheet layout (fillable PDF) | P2 | Match the look of official sheets |
| Campaign export (all data) | P2 | Users own their data |

---

### 11. PLATFORM & DEVICE SUPPORT

| Feature | Priority | Notes |
|---|---|---|
| Web application (responsive) | P0 | Primary platform |
| Mobile-friendly responsive design | P0 | Must work on phone at the table |
| Tablet-optimized layout | P1 | Common use case: tablet as character sheet at table |
| Offline support / PWA | P2 | For in-person sessions with bad wifi |
| Native mobile app (iOS/Android) | P3 | After web is proven |
| Desktop app (Electron/Tauri) | P3 | |

---

### 12. INTEGRATIONS

| Feature | Priority | Notes |
|---|---|---|
| Discord bot (character lookup, dice rolls) | P2 | Highly requested in similar platforms |
| VTT integration (Foundry, Roll20) | P3 | API-level integration |
| Embeddable character sheet widget | P2 | For forums, blogs, stream overlays |
| Public API | P2 | Let community build on top of Inkborne |
| Import from D&D Beyond (character data) | P2 | Migration path for new users |
| Import from other tools (MPMB, etc.) | P3 | |

---

### 13. COMMUNITY & SOCIAL

| Feature | Priority | Notes |
|---|---|---|
| Community-driven development (public roadmap, voting) | P1 | Part of the brand promise |
| Open source (MIT or GPL) | P1 | Builds trust, matches the anti-predatory-practices mission |
| User feedback / feature request system | P1 | |
| Forums or discussion space | P3 | Discord may serve this initially |
| Content creator profiles | P3 | People who share popular homebrew |

---

### 14. ADMIN & MODERATION

| Feature | Priority | Notes |
|---|---|---|
| Admin panel for system management | P1 | |
| Content moderation tools | P2 | For public homebrew |
| Analytics / usage tracking | P2 | What systems are popular, what features are used |
| Abuse reporting | P2 | |

---

## Data Model Considerations

The following decisions need to be made early because they affect everything downstream:

1. **System schema definition:** How do you define what a "character" looks like for a given game system? This is the hardest problem. Consider a JSON schema approach where each system provides a template that defines stats, resources, features, and calculated fields.

2. **Content ownership model:** Content exists at three levels: platform (SRD), user (personal homebrew), and campaign (shared with group). How do these layer? Can campaign content override platform content?

3. **Character-to-system binding:** A character belongs to one system. But what happens when a system gets updated (e.g., D&D 5e 2014 vs 2024)? Does the character migrate, or does it stay on the old version?

4. **Homebrew content schema:** Homebrew items (spells, classes, feats) need to follow the same schema as official content so they integrate into the character builder seamlessly. The schema needs to be strict enough to enable automation but flexible enough to handle edge cases.

5. **Multi-tenancy:** Users can be in multiple campaigns across multiple systems. Characters can potentially be moved between campaigns. How does content sharing work across these boundaries?

6. **Versioning:** Both system definitions and homebrew content will change over time. How do you handle versions without breaking existing characters?

---

## MVP Scope (Phase 1)

For initial launch, Inkborne should ship with:

- User accounts (email + Discord OAuth)
- D&D 5e SRD character builder (full guided creation flow)
- Character sheet with auto-calculated stats, spell management, inventory
- Basic campaign management (create, invite, view party)
- Structured homebrew forms (species, subclass, spells, items, feats)
- Print-friendly PDF export
- Responsive web app (desktop + mobile)
- Dagger Heart SRD support (proves multi-system architecture works)

Everything else is Phase 2+.

---

## Technical Stack (Proposed)

- **Frontend:** Next.js + Tailwind CSS (already in Victor's toolbox)
- **Backend/DB:** Supabase (Postgres + Auth + Realtime + Storage)
- **Hosting:** Vercel
- **PDF Generation:** Server-side rendering (Puppeteer or react-pdf)
- **Data Format:** JSON schemas for system definitions and content
- **Auth:** Supabase Auth with Discord and Google OAuth providers

---

*This is a living document. Update as survey responses come in and priorities shift.*
