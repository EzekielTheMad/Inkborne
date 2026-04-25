# Inkborne Roadmap

**Status:** Living draft. Update freely.
**Owner:** Victor
**Last updated:** 2026-04-25

This document layers the new vision items (homebrew authoring, content importer, new content types, database backups) into a phased roadmap with explicit alpha/feedback checkpoints. **Not on a critical timeline** — milestones are sized for sustainable progress with feedback loops, not a sprint.

---

## Vision

A **community-driven, multi-system TTRPG character + campaign management platform** where:

- Players build, manage, and play characters with a richer toolkit than D&D Beyond
- Homebrew is first-class — users author their own content and import from existing sources (MPMB JS scripts, eventually PDFs)
- DMs orchestrate campaigns with monsters, NPCs, companions, sidekicks, and shared content libraries
- Narrative depth (LegendKeeper-inspired) is alongside the mechanical sheet, not behind it

---

## Where we are today

**Shipped to production:**
- Auth (email + Google + Discord OAuth)
- Character creation flow: race → class → abilities → background → equipment
- Character sheet: stat ribbon, HP tracker, skills, saves, defenses, conditions, rest dialog, feature resources, spell selection (read-only)
- Spell Management Phase 1 (selection + display, no casting yet)
- Inventory management with magic items
- Feature Resources system (29 class features + 2 racial traits enriched in PR #24)
- Rest System (short/long rest orchestration)
- Atomic state patches via `patch_character_state` RPC

**In flight (open PRs):**
- #19 Feedback widget + admin dashboard
- #21 UX audit findings (docs)
- #22 Error reporting + admin dashboard
- #23 Journey design brief for Claude Design (docs)
- #24 Feature resource data enrichment (29 enrichments)
- #25 Test coverage audit (docs)
- #26 Generated Supabase types

**Designed, not yet built:**
- Builder UX polish (per Claude Design brief)
- Journey UX polish (per Claude Design brief)
- First-time UX fixes (per audit)

**Roadmap items beyond this:** see milestones below.

---

## Milestones

Each milestone has a **goal**, **scope**, **exit criteria**, and ideally a **feedback checkpoint** before the next milestone starts. Milestones are not strict — they're guideposts.

---

### M1 — Pre-alpha consolidation
**Goal:** Land what's in flight, set up infrastructure for production use, fix known issues.
**Estimated effort:** 1–2 weeks.

**Scope:**
- Merge open PRs (#19, #22, #24, #26) and review docs PRs (#21, #23, #25)
- Apply Claude Design output once it lands (Builder UX Polish + Journey)
- Implement first-time UX fixes (F1–F6 from audit PR #21):
  - Hide Campaigns "coming soon" card
  - Auto-select system if only one published
  - Dismissible alpha banner with feedback CTA
  - New-character form helper text
  - Auto-redirect brand-new characters into builder
- Implement test coverage gaps (G2 HP tracker, G3 createCharacter, G4 auth callback) per PR #25
- Optional: G1 Playwright + 3 smoke tests (1 day)
- **Database backups → see "Backup strategy" section below**
- Manual smoke test pass at desktop / tablet / mobile breakpoints

**Exit criteria:**
- All in-flight PRs landed
- Known UX rough edges fixed
- Daily database backups proven working
- No console errors on the main flows

---

### 🟢 Feedback checkpoint A — Closed alpha #1: "Can you build a character?"

**Format:** Invite the 8 friends from the April 2026 survey. They each create 1–2 characters across different classes/races. Use feedback widget for reports.
**Duration:** 1–2 weeks of casual use.
**What we're testing:**
- Builder flow works end-to-end without crashes
- Sheet renders correctly for various class/race/level combinations
- Mobile experience is usable
- The "homebrew flexibility" promise is felt as a **gap** — friends will tell us what they wished was there
- General polish bar — does it feel finished enough to play with?

**Output:** Bug list + qualitative "what's missing" feedback. Decisions about M2 scope.

**Rationale:** Don't wait until everything is built before getting feedback. Even with platform-only content (1 feat, fixed system), friends can tell us if the foundation feels good.

---

### M2 — Gameplay foundations
**Goal:** Make characters playable, not just buildable. Cast spells, roll dice, take rests that mean something.
**Estimated effort:** 4–6 weeks.

**Scope:**
- **Dice Rolling foundation** (per earlier scoping) — cross-cutting roll engine + roll log. Used by attacks, saves, ability checks, death saves, HD spending, concentration, initiative.
- **Spell Management Phase 2** — casting dialog, slot consumption, rests integration with feature resources
- **HD tracking** — depends on Dice Rolling; lights up the deferred piece of Rest System
- **Effects / durations system** (depends partly on dice + casting flow): track Bless, Mage Armor, Shield with proper durations + concentration link

**Exit criteria:**
- Players can click "cast" on a spell and see it consume a slot, roll attack/damage, optionally apply effects
- Hit dice tracking works during short rests
- Real-feeling combat at a virtual table

---

### 🟢 Feedback checkpoint B — Closed alpha #2: "Can you play with a character?"

Same friend group. Now they can simulate combat: cast spells, attack, take damage, rest, recover. Push beyond character building into actual play scenarios.

**What we're testing:**
- Cast/slot/rest workflows feel natural
- Dice rolls integrate where players expect
- Multi-class / multi-resource characters don't break
- Performance with many spells / actions / etc.

**Duration:** 1–2 weeks.

---

### M3 — Homebrew authoring (Tier 1 of content vision)
**Goal:** Users author their own content directly in the app. The "homebrew flexibility" promise becomes real.
**Estimated effort:** 2–3 weeks.

**Scope:**
- `/library` page — "my content" view with filters by type, sort, search
- Schema-driven authoring forms for each existing content type (race, class, feat, feature, spell, item, weapon, armor, background, subclass, trait)
- Builder content discovery — pickers pull from `platform` + `user_owned` + `shared_with_me`
- Sharing UI — toggle content between private / campaign-shared / public; settings page
- Custom content types — UI for `custom_content_types` table that exists in schema today

**Exit criteria:**
- A user can create a custom feat in `/library`, share it with their campaign, and see another user pick it during character creation

---

### 🟢 Feedback checkpoint C — Closed alpha #3: "Can you build your own homebrew?"

Friends create their own feats / spells / classes. Discover what's clunky about the authoring forms. Tell us what import formats they actually have on disk (MPMB? PHB-PDFs? Excel?). This informs M4.

**What we're testing:**
- Authoring forms are usable for non-technical users
- Validation errors are understandable
- Sharing / discovery between friends works
- **What people actually want to import** (this answer shapes M4)

**Duration:** 1–2 weeks.

---

### M4 — Importer (Tier 3 of content vision)
**Goal:** Upload an MPMB JS file, see content imported into your library, with calculation correctness verified.
**Estimated effort:** 2–3 weeks.

**Scope:**
- File upload pipeline (extends portrait upload infrastructure from migration `00024`)
- MPMB JS parser — reuses logic from existing `scripts/transformers/` that we used to seed the SRD
- Validation step — runs Zod schemas against parsed output, surfaces gaps
- Conflict resolution UI — "you already have a feat called Lucky; merge / replace / keep both?"
- Missing-info wizard — fields the parser couldn't extract get a form for the user
- Audit log — what was imported, what was skipped, what needs attention
- **Calculation correctness verification:** test character built with imported content produces correct sheet calculations. The engine evaluates effects → derived stats; if imported content has malformed effects, it shows immediately. Build a "preview character" feature that uses imported content before commit.

**Exit criteria:**
- Take a real MPMB community file (e.g., Tasha's Cauldron) → upload → see content land in library → build a character with it → sheet calculations match expected values
- PDF parsing explicitly **not in scope** for this milestone (deferred — see M7)

---

### M5 — New content types (Tier 2 of content vision)
**Goal:** Library expands beyond character-construction content into full TTRPG ecosystem.
**Estimated effort:** 4–6 weeks total, can be sequenced.

**Scope (per type, ~1 week each):**
- **Monsters** — stat block schema (AC, HP, attacks, saves, abilities, lair actions, legendary actions); display component (D&D Beyond stat-block style); searchable in library; importable via the M4 importer
- **NPCs (library-scoped)** — generalize the existing `npcs` table to support library NPCs (today it's character-attached only). NPCs differ from monsters in carrying personality + relationship metadata
- **Companions** — stat block + character-tied (mounts, beast forms from Druid Wild Shape, summon spells). Hybrid of creature + character
- **Sidekicks (Tasha's-style)** — simplified PCs with one of three archetypes (Expert / Spellcaster / Warrior). Partial features — different schema from full PCs

**Recommended sequence:** Monsters first (highest demand, simplest). NPCs second. Companions / Sidekicks last (most complex, narrowest audience).

**Exit criteria for full M5:** A DM can manage a library of monsters, NPCs, companions, and sidekicks alongside their players' characters.

---

### 🟢 Feedback checkpoint D — Open alpha / closed beta

Expand audience beyond the original 8. Maybe an invite list of 30–50 people who saw the project in community spaces. Real campaigns start to use the tool for ongoing play.

**Duration:** 1–2 months. Long enough for actual sessions to happen.

**What we're testing:**
- Production load / performance
- Sharing model at scale (campaigns with 5+ players)
- Edge cases that only emerge from sustained play (concentration through multiple rests, etc.)
- Whether the homebrew + importer + library experience is good enough to sell the platform

---

### M6 — Spell Management Phase 3
**Goal:** Class-advanced spellcasting features that were deferred from Phase 1.
**Estimated effort:** 2–3 weeks.

**Scope:**
- Mystic Arcanum (already partially enriched via PR #24 — the data is there; UI / interaction is missing)
- Arcane Recovery interaction (data is there too)
- Spell Mastery (Wizard L18)
- Signature Spells (Wizard L20)
- Spellcasting bonus feats / features (Eldritch Knight, Arcane Trickster — half-caster patterns)

---

### M7 — Importer v2: PDF parsing
**Goal:** Upload a PDF (e.g., a third-party homebrew sourcebook), get content imported.
**Estimated effort:** 3–5 weeks.

This is genuinely hard — PDF layout extraction, field heuristics, possibly LLM-assisted parsing. Worth doing only after the JS-only importer (M4) has proven the import workflow is usable.

**Could leverage:** Claude Agent SDK or similar for the LLM-assist step.

---

### M8 — Polish + community launch (public beta)
**Goal:** Open registration. Ready for organic growth.

**Scope:** Cumulative polish from feedback rounds A–D. Performance audit. Accessibility audit. Onboarding flow refinements. Marketing surface (landing page revisit, demos).

**Exit criteria:** Comfortable letting strangers sign up.

---

## Backup strategy

**Setup happens in M1.** Do not wait until alpha to put backups in place — once friends start creating characters, losing them is unrecoverable.

### Recommended approach: two-tier

**Tier 1 — Cloud backup (immediate restore):**
- GitHub Actions scheduled workflow (cron: daily at 03:00 UTC)
- Runs `pg_dump` against Supabase via the Supabase CLI
- Encrypts the dump with a passphrase stored in GH Secrets
- Pushes to Backblaze B2 (~$0.005/GB/month, basically free for an alpha-size DB)
- Retention: 7 daily, 4 weekly, 12 monthly = ~23 copies always available
- Automated alert on workflow failure (Discord webhook or email)

**Tier 2 — Unraid offsite redundancy:**
- Same GitHub Actions workflow also pushes to your Unraid via SSH/rsync
- Or a second scheduled action that pulls from B2 → Unraid
- Unraid stores forever (or as long as disk allows)
- Provides "I lost my Supabase project" disaster recovery

### Effort estimate

- Tier 1 alone: ~half day to set up + test
- Tier 2 added: ~2–3 hours additional (depending on your Unraid SSH setup)

### What to back up

- Full database dump (all tables — `characters`, `content_definitions`, `feedback`, `app_errors`, etc.)
- **NOT included** in pg_dump but worth backing up separately:
  - Supabase Storage objects (portrait uploads)
  - Migration history (lives in git, so already covered)
  - Edge functions (already in git)

---

## Calculation correctness for imports

This was a specific concern raised. To address explicitly:

- **The engine validates content via Zod schemas** (`lib/schemas/content-types/*`) — imported content runs through the same Zod validators as platform content. Malformed effects fail early.
- **The engine evaluates effects deterministically** — if an imported feat has effects shaped correctly, they apply correctly. The same evaluator runs for platform and user content.
- **Calculation tests already exist** (`tests/engine/evaluator.test.ts`, etc.) — they test the engine logic. Imported content correctness is then a matter of "is the import result schema-valid."
- **M4 importer adds a "preview character" step** — before committing imports, build a test character using the new content. Eyeball the sheet. Sheet calculations are the verification.

The risk vector isn't really "engine breaks" — it's "import script misinterprets the source format and produces semantically wrong content (e.g., gives a feat the wrong CON bonus)." That's caught by:
- Schema validation (catches structural errors)
- Preview character testing (catches semantic errors)
- Audit log highlighting "this field was unmapped" (catches missing data)

---

## Dependencies + critical path

```
M1 (consolidation + backups)
  ↓
[checkpoint A: alpha #1]
  ↓
M2 (gameplay foundations: dice + Spell P2 + HD + effects)
  ↓
[checkpoint B: alpha #2]
  ↓
M3 (homebrew authoring)
  ↓
[checkpoint C: alpha #3 — informs M4 import format priorities]
  ↓
M4 (importer v1: MPMB JS only)
  ↓
M5 (new content types: monsters → NPCs → companions/sidekicks)
  ↓
[checkpoint D: open alpha / closed beta]
  ↓
M6 (Spell P3)  ←────  M7 (importer PDF parser)  ←──── these can parallel
  ↓
M8 (public beta)
```

**Critical path estimate:** M1–M5 = ~6 months at sustainable pace, longer if checkpoints reveal issues that need cycles back.

**Bypassable items if scope tightens:**
- M5 NPCs / Companions / Sidekicks could move to post-public-beta
- M6 Spell Phase 3 could move to post-public-beta if M5 timing slips
- M7 PDF parser is explicitly post-public-beta unless friends specifically need it

---

## Decisions to make as we go

These come up during the milestones; not decisions for today:

1. **Public sharing vs campaign-only.** M3 needs this answered. Are users going to "publish" content for strangers to use, or only share with their campaign?
2. **Multi-system support timing.** Is Daggerheart (or another system) coming alongside D&D 5e, or after public beta? Each system takes content seeding effort.
3. **DM view UI.** When does role-based UI (DM vs player) materialize? Probably needs to coincide with M5 (new content types — monsters are DM-facing).
4. **Real-time multiplayer.** Should two players see live updates on the same character? Or async-only? Big architectural decision.
5. **Dice 2024 SRD ingestion.** When the 2024 SRD's expanded feat list is wanted, who ingests it (us, with a proper script) or do users just import it themselves via M4?
6. **Pricing model.** No discussion of monetization yet. Is this free-forever / tip jar / freemium / paid? Answer affects sharing model and feature gating.

---

## Open questions for me to answer

These are mine to track:

- M1 backup setup — exact Unraid endpoint format / SSH key strategy
- M2 effects/durations system design — needs its own brainstorm before implementation
- M4 MPMB parser scope — which MPMB community files should we use as test fixtures?
- M5 monster schema design — much bigger than feature/spell schemas; needs design pass

---

## Cadence + how this document is used

- **Each milestone gets a brainstorm before implementation** (per the brainstorming skill we've been using)
- **Each checkpoint produces a feedback summary** committed to `docs/alpha/feedback-round-X.md`
- **This file gets updated** between milestones with what actually shipped, what was deferred, what changed
- **No fixed dates** — milestones complete when they complete. Feedback checkpoints are gates, not deadlines.

---

## Feedback wanted on this roadmap

Things I'd like Victor's call on before locking in:

1. **Sequence of M2/M3/M4** — does gameplay foundations (M2) come before or after homebrew authoring (M3)? Currently I have M2 first because friends in alpha #1 will probably ask "when can we cast spells" before they ask "when can I make my own feats." But you might know your friends differently.

2. **Whether to bundle M4 (importer) into M3 (authoring)** — they're related. If users are authoring already, they may want to import alongside. Could combine into one ~5 week milestone.

3. **Whether to insert a Builder UX iteration round** between M1 and alpha #1 specifically for whatever Claude Design produces. Currently it's folded into M1 as "apply Claude Design output." If the output is substantial, it might deserve its own milestone.

4. **Backup tier 2 specifics** — do you want me to script the Unraid push too, or just Tier 1 cloud and manual Unraid pulls?
