# Inkborne Roadmap

**Status:** Living draft. Update freely.
**Owner:** Victor
**Last updated:** 2026-07-19

> **Working on this project?** Start with [`docs/GAME-PLAN.md`](GAME-PLAN.md) — the agent-agnostic entry point with the current task backlog, workflow conventions, and repo orientation. This file is the milestone-level source of truth; the game plan is the working-level one.

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

> **Snapshot 2026-06-19.** M1 (pre-alpha consolidation) and the M2 *builder* design polish have shipped — including the full mobile builder (PR #47). The single thing gating closed alpha #1 is deploying database backups (code is done — PR #33 — parked on a Supabase credential). The M2 *journey* polish (landing/auth/dashboard aesthetic) is the main design work still outstanding, but it is **not** alpha-blocking. See "What changed since 2026-04-25" at the end of this section.
>
> **Update 2026-07-15.** The UAT console-error punch items (dialog a11y titles + duplicate level-row key) merged as PR #58. The journey design handoff bundle was rescued off the stale `feat/mobile-builder` branch and now lives in-repo at `docs/design-briefs/design_handoff_journey_alpha/`. Backups (PR #33) remain the sole alpha gate.
>
> **Update 2026-07-16 (agentic sprint).** **M2 is complete** (journey polish shipped, PR #67, landing variant B) and **M3 is complete** (dice + roll log, spell casting, hit dice, effects/durations/concentration, Arcane Recovery — PRs #61–#72, #74; migrations 00038–00040 applied; live-browser UAT green, zero bugs). Equipment chooser (#64) and subclass/set-level fixes (#63) closed the UAT punch list; Playwright E2E smoke exists (#62, 6 tests). Tests: 620 → 1109 unit + 6 E2E. **Alpha #1's only remaining gates are on Victor: deploy backups (PR #33 merged, Unraid deploy pending) and send the invites.** Alpha #1 and #2 could now even be combined, since gameplay shipped ahead of the invite. See `docs/GAME-PLAN.md` §7 for the full log and §6 for pending decisions (incl. the C1 schema-drift call).

**Shipped to production (`main` @ `31a4996`):**
- Auth (email + Google + Discord OAuth)
- Character creation flow: race → class → abilities → background → equipment
- Character sheet: stat ribbon, HP tracker, skills, saves, defenses, conditions, rest dialog, feature resources, spell selection (read-only)
- Spell Management Phase 1 (selection + display, no casting yet)
- Inventory management with magic items
- Feature Resources system (27 class features + 2 racial traits, PR #24)
- Rest System (short/long rest orchestration)
- Atomic state patches via `patch_character_state` RPC
- **First-time UX fixes F1–F6** (PR #29): hide Campaigns card, single-system auto-select, dismissible alpha banner + feedback CTA, new-character helper text, auto-redirect into builder
- **In-app feedback widget + `/admin/feedback`** (PR #19) and **self-hosted error reporting + `/admin/errors`** (PR #22), under an **admin hub** at `/admin` (PR #28)
- **Generated Supabase types** `database.types.ts` (PR #26)
- **M2 builder design polish:** class preview modal (#37), class step rail (#40), multiclass picker (#43), level-up flow (#45), **mobile builder pattern (#47)**, character primary-color carry-through (#52/#53). Mobile support also spans nav (`mobile-nav`) and the sheet (`mobile-sheet`).
- **Post-M2 refactor #1:** character mutations consolidated behind typed helpers (PR #56)
- Test coverage gaps G2/G3/G4 closed (HP tracker, createCharacter, auth callback — PR #31)

**In flight (open PRs):**
- **#33 — Backup container scaffolding.** Code complete and reviewed (Docker + restic + rclone, daily `pg_dump`, 30-daily/12-monthly retention, weekly integrity check, Discord alerts). Unraid deploy is **parked on a Supabase pooler credential** (`Tenant or user not found` → needs the tenant-qualified username `postgres.<project-ref>` + the correct pooler host/password). B2 offsite tier deferred; Unraid-local only for now. **This is the one alpha blocker.**
- **#57 — Content schema validation refactor (design spec).** Post-M2 refactor #2: run the existing Zod schemas at the server fetch boundary. Spec + full implementation plan written (`docs/superpowers/plans/2026-05-19-content-schema-validation.md`); execution pending. Pure robustness — not alpha-blocking.

**Designed but not yet built:**
- **M2 journey polish** — landing / auth / dashboard / characters-list / sheet aesthetic pass (per `docs/design-briefs/journey-landing-to-sheet.md`). The Claude Design handoff bundle for this (landing A/B/C, auth, dashboard mockups + tokens) is now in-repo at `docs/design-briefs/design_handoff_journey_alpha/` (rescued 2026-07-15; `feat/mobile-builder` is now safe to retire). Not alpha-blocking.

**Remaining before closed alpha #1:**
1. **Backups deployed + restore drill** (PR #33) — the blocker; mostly external infra on Unraid.
2. **Remaining UAT punch items** (console errors fixed in #58): equipment-step chooser decision, subclass discoverability, verify direct "Set level" doesn't skip subclass prompts — see `docs/GAME-PLAN.md` Track A.
3. *(Optional, recommended)* **Playwright E2E smoke (G1)** — auth → builder → sheet. Not an alpha gate.

**What changed since 2026-04-25:** every PR the previous snapshot listed as "in flight" (#19, #21, #22, #23, #24, #25, #26) has merged, plus the whole M2 builder-polish sequence (#34–#54), the first-time UX fixes (#29), test gaps (#31), the admin hub (#28), and post-M2 refactor #1 (#56). Backups (#33) were built and parked on a credential. Refactor #2 (#57) was specced + planned, then deferred in favor of the alpha push.

**Roadmap items beyond this:** see milestones below.

---

## Milestones

Each milestone has a **goal**, **scope**, **exit criteria**, and ideally a **feedback checkpoint** before the next milestone starts. Milestones are not strict — they're guideposts.

---

### M1 — Pre-alpha consolidation
**Status (2026-06-19): ✅ Essentially complete.** All in-flight PRs merged, F1–F6 UX fixes shipped (#29), test gaps G2–G4 closed (#31), feedback / error / admin surfaces live. Only remaining item: deploy database backups (PR #33, parked on a credential) + a manual smoke pass. **Backups are the sole alpha gate.**
**Goal:** Land what's in flight, set up infrastructure for production use, fix known issues.
**Estimated effort:** 1–2 weeks.

**Scope:**
- Merge open PRs (#19, #22, #24, #26) and review docs PRs (#21, #23, #25, #27)
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

### M2 — Claude Design implementation (parallel with M1)
**Status (2026-06-19): ◑ Builder polish shipped; journey polish outstanding.** The builder half — preview modal, class step rail, multiclass, level-up, mobile, color carry-through — shipped via PRs #37–#54. The journey half (landing / auth / dashboard / sheet aesthetic) is **not** built; its Claude Design handoff bundle is stranded on the `feat/mobile-builder` WIP commit (rescue before deleting that branch). Journey polish is not required for alpha #1.
**Goal:** Apply the design polish coming back from Claude Design without rushing.
**Estimated effort:** 2–4 weeks (paced by Claude Design output cadence).

Acknowledged as its own milestone because design happens in batches — Victor can only feed Claude Design so much at a time, and the implementation work happens as handoff bundles arrive. This unblocks alpha #1 once both M1 and the design implementation reach a coherent stopping point.

**Scope:**
- Builder UX Polish (per `docs/design-briefs/builder-ux-polish.md`):
  - Content Preview Modal redesign (Race / Class / Background)
  - Class Step layout polish (ASI, feature dropdowns, subclass selector)
- Journey design (per `docs/design-briefs/journey-landing-to-sheet.md`):
  - Landing page polish
  - Auth pages polish + consistency
  - Dashboard
  - Characters list
  - New-character entry
  - Pre-built character state
  - Sheet first-arrival moment
  - Sheet polish pass (typography, spacing, hierarchy — no structural changes)

**Exit criteria for alpha #1:**
- "Enough" of M2 has landed that the journey feels intentional from landing → sheet
- Doesn't have to be 100% — pick a stopping point that's coherent

**Cadence:** Claude Design → handoff bundle → I implement as a focused PR per surface → repeat. Victor reviews the prototypes, picks variants, exports bundles at his own pace.

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

**Output:** Bug list + qualitative "what's missing" feedback. Decisions about M3 scope.

**Rationale:** Don't wait until everything is built before getting feedback. Even with platform-only content (1 feat, fixed system), friends can tell us if the foundation feels good.

---

### M3 — Gameplay foundations
**Status (2026-07-16): ✅ Complete.** Shipped via PRs #61 (spec), #65 (effects), #66 (dice + roll log), #68 (hit dice), #69 (cast dialog), #70 (roll surfaces), #71 (Arcane Recovery), #72 (concentration), #74 (live UAT). Design + plan: `docs/specs/2026-07-15-m3-gameplay-foundations-*.md`.
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

### M4 — Homebrew + Importer (combined)
**Goal:** Users author their own content **and** import existing content (MPMB JS) into a unified library workflow.
**Estimated effort:** ~5 weeks (combined from earlier separate milestones).

Combined because authoring and importing share the same user-owned content infrastructure (the `/library`, the sharing UI, the builder integration). Building one without the other leaves a glaring gap — users author a feat from scratch but can't import the one they already have, or vice versa.

**Scope — Authoring half (~2–3 weeks):**
- `/library` page — "my content" view with filters by type, sort, search
- Schema-driven authoring forms for each existing content type (race, class, feat, feature, spell, item, weapon, armor, background, subclass, trait)
- Builder content discovery — pickers pull from `platform` + `user_owned` + `shared_with_me`
- Sharing UI — toggle content between private / campaign-shared / public; settings page
- Custom content types — UI for `custom_content_types` table that exists in schema today

**Scope — Importer half (~2 weeks, leveraging existing transformers):**
- File upload pipeline (extends portrait upload infrastructure from migration `00024`)
- MPMB JS parser — reuses logic from existing `scripts/transformers/` that we used to seed the SRD
- Validation step — runs Zod schemas against parsed output, surfaces gaps
- Conflict resolution UI — "you already have a feat called Lucky; merge / replace / keep both?"
- Missing-info wizard — fields the parser couldn't extract get a form for the user
- Audit log — what was imported, what was skipped, what needs attention
- **Calculation correctness verification:** test character built with imported content produces correct sheet calculations. The engine evaluates effects → derived stats; if imported content has malformed effects, it shows immediately. Build a "preview character" feature that uses imported content before commit.

**Exit criteria:**
- A user can create a custom feat in `/library`, share it with their campaign, and see another user pick it during character creation
- A user can upload an MPMB community file (e.g., Tasha's Cauldron) → see content land in library → build a character with it → sheet calculations match expected values
- PDF parsing explicitly **not in scope** for this milestone (deferred — see M7)

---

### M5 — New content types
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

### M5.5 — Campaigns + narrative depth (the LegendKeeper layer) — *in progress 2026-07-19*
**Goal:** Deliver the second half of the founding vision: characters belong to campaigns, and campaigns carry a LegendKeeper-style wiki/narrative space shared between DM and players.
**Estimated effort:** 4–6 weeks.

> **Status: in progress on the Codex campaign branch.** Campaigns were selected ahead of M5. The implementation includes authorization/RLS, CRUD and invite membership, character copy/assignment, DM/player roster views, a hierarchical rich-text wiki, DM-only/player-shared visibility, revision conflict protection, settings, invite rotation, and membership cleanup. Production migrations `00041`–`00051`, rollback-only database smoke UAT, and authenticated two-account browser UAT are complete. The application branch still needs to merge/deploy; then the next feature slices are backlinks, character narrative links, timeline/relationship expansion, publishing, and optional live presence.

**Scope (first cut — needs its own brainstorm/spec before implementation):**
- Campaign CRUD + membership: DM creates a campaign, invites players, players assign characters
- DM vs player roles — the first role-based UI in the app (pairs with M5 DM content)
- Campaign wiki: linked pages/articles (locations, factions, sessions, lore) with cross-links, LegendKeeper-style
- Character ↔ campaign narrative connections: character backstory pages can reference campaign wiki entries and vice versa
- Character narrative profile expansion: timeline events, relationships (the parts of the narrative vision beyond the shipped backstory tab)
- Visibility model: DM-only vs shared-with-players content (this is the campaign-scoped half of the M4 sharing question)

**Exit criteria:** A DM runs a campaign with the 8 alpha friends' characters attached, keeps a small wiki for it, and players can read shared entries and link their backstories to them.

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

### Two-tier approach: Unraid primary + cloud secondary

**Tier 1 — Unraid (primary, automated, free):**
- Cron job on Unraid runs daily at 03:00 local time
- Uses Supabase service role key (stored in Unraid's encrypted secrets) to run `pg_dump` remotely
- Stores the dump locally on Unraid (encrypted at rest via Unraid's encryption)
- Retention managed locally — 30 daily, 12 monthly, indefinite annual (or whatever disk allows)
- Pull-based architecture: Unraid initiates the connection out to Supabase. No inbound exposure on Unraid required.
- Failure alerts via local notification (Unraid notification system, or piped to Discord webhook)

**Tier 2 — Backblaze B2 offsite redundancy:**
- Unraid (after the local dump succeeds) pushes a copy of the encrypted dump to a B2 bucket
- ~$0.005/GB/month — basically free for alpha-size DB
- Provides "Unraid died / house burned down" disaster recovery
- Retention: keep 30 daily on B2 (matches local), expire older to control cost

**Why this ordering:** Unraid is hardware you already own with effectively zero marginal cost; B2 is the redundancy layer. If B2 ever becomes annoying (cost, reliability, lock-in), you can drop it without losing your primary backup.

### Setup effort

- Tier 1 (Unraid pg_dump cron): ~half day. Includes installing Supabase CLI on Unraid, securing the service role key, scripting the dump + retention rotation, testing a restore.
- Tier 2 (B2 push from Unraid): ~2 hours additional. B2 account, bucket, app key, rclone config, hook into the existing cron.

### What to back up

- Full database dump via `pg_dump` (all tables — `characters`, `content_definitions`, `feedback`, `app_errors`, etc.)
- **NOT included** in pg_dump — worth a separate sync:
  - Supabase Storage objects (portrait uploads). Use `rclone` or Supabase CLI to mirror to Unraid alongside the DB dump.
  - Migration history (lives in git, so already covered)
  - Edge functions (already in git)

### Restore drill

A backup is only as good as the last time you successfully restored from it. Plan: at least once before alpha #1, do a full restore drill into a throwaway Supabase project. Confirm the dump produces a working DB with characters intact.

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
M1 (consolidation + backups)  ─┐
                                ├──── both must reach a coherent stopping point
M2 (Claude Design impl)       ─┘
  ↓
[checkpoint A: alpha #1 — character creation]
  ↓
M3 (gameplay foundations: dice + Spell P2 + HD + effects)
  ↓
[checkpoint B: alpha #2 — gameplay]
  ↓
M4 (homebrew authoring + importer v1, combined)
  ↓
[checkpoint C: alpha #3 — homebrew/import]
  ↓
M5 (new content types: monsters → NPCs → companions/sidekicks)
  ↓
[checkpoint D: open alpha / closed beta]
  ↓
M6 (Spell P3)  ←────  M7 (importer PDF parser)  ←──── these can parallel
  ↓
M8 (public beta)
```

**Critical path estimate:** M1–M5 = ~6 months at sustainable pace, longer if checkpoints reveal issues that need cycles back. M2 (Claude Design) runs in parallel with M1 and is paced by Victor's design throughput.

**Bypassable items if scope tightens:**
- M5 NPCs / Companions / Sidekicks could move to post-public-beta
- M6 Spell Phase 3 could move to post-public-beta if M5 timing slips
- M7 PDF parser is explicitly post-public-beta unless friends specifically need it

---

## Decisions locked in (2026-04-25)

Initial sequencing questions answered by Victor:

1. **M3 (gameplay foundations) before M4 (homebrew + importer).** ✓ Friends will ask for spell casting before they ask for homebrew authoring.
2. **M4 bundles authoring + importer into one combined milestone.** ✓ ~5 weeks.
3. **M2 Claude Design implementation is its own milestone**, paced by Victor's design throughput. Parallel with M1.
4. **Backup tier ordering:** Unraid is primary (free, automated), Backblaze B2 is offsite secondary.

---

## Decisions still to make as we go

These come up during the milestones; not decisions for today:

1. **Public sharing vs campaign-only.** M4 needs this answered. Are users going to "publish" content for strangers to use, or only share with their campaign?
2. **Multi-system support timing.** Is Daggerheart (or another system) coming alongside D&D 5e, or after public beta? Each system takes content seeding effort.
3. **DM view UI.** When does role-based UI (DM vs player) materialize? Probably needs to coincide with M5 (new content types — monsters are DM-facing).
4. **Real-time multiplayer.** Should two players see live updates on the same character? Or async-only? Big architectural decision.
5. **2024 SRD ingestion.** When the 2024 SRD's expanded feat list is wanted, who ingests it (us, with a proper script) or do users just import it themselves via M4?
6. **Pricing model.** No discussion of monetization yet. Is this free-forever / tip jar / freemium / paid? Answer affects sharing model and feature gating.

---

## Open questions for me to answer

These are mine to track:

- **M1 backup setup** — Supabase service role key handling on Unraid (encrypted secrets store?), B2 bucket structure + retention policy
- **M3 effects/durations system design** — needs its own brainstorm before implementation
- **M4 MPMB parser scope** — which MPMB community files should we use as test fixtures? Tasha's was named as a target; what else?
- **M5 monster schema design** — much bigger than feature/spell schemas; needs design pass

---

## Cadence + how this document is used

- **Each milestone gets a brainstorm before implementation** (per the brainstorming skill we've been using)
- **Each checkpoint produces a feedback summary** committed to `docs/alpha/feedback-round-X.md`
- **This file gets updated** between milestones with what actually shipped, what was deferred, what changed
- **No fixed dates** — milestones complete when they complete. Feedback checkpoints are gates, not deadlines.
