# Inkborne Roadmap

**Status:** Living draft. Update freely.
**Owner:** Victor
**Last updated:** 2026-07-21

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

> **Snapshot 2026-07-21.** M1–M3 are complete. The campaign/LegendKeeper foundation shipped in #76, the content-schema refactor shipped in #60, spell authoring/sharing and the private MPMB workflow through calculation preview are on `main`, backup hardening shipped in #90, and feat authoring/campaign sharing/ASI selection shipped in #91. The automated gate is **167 Vitest files / 1666 tests** plus strict lint/typecheck, GitHub CI, GitGuardian, Vercel preview, hosted migration smoke, and protected-preview browser UAT for high-risk verticals.

**Shipped product surface:**
- Email, Google, and Discord authentication; account linking is implemented in #80 but awaits manual provider-consent UAT.
- Full responsive character builder and sheet, including direct-level gating, equipment choice, subclass prompts, inventory, spells, feat choices, exact-version content pins, and character copy.
- M3 gameplay: dice and roll log, spell casting, resources, hit dice, effects/durations, concentration, and rests.
- Unified character narrative plus campaign CRUD/membership, roles, roster, wiki tree/editor, backlinks, timelines/relationships, visibility controls, settings, and revision conflicts.
- `/library` spell and feat authoring with immutable versions, campaign-scoped sharing, character-aware discovery, DM revocation, and existing-pin preservation.
- Fail-closed private MPMB import review with guided repair, explicit conflict resolution, audit provenance, and mandatory current-revision calculation preview.
- Feedback/error administration, generated Supabase types, validated content fetch boundaries, and hardened local/offsite backup tooling.

**Active M4 work:** broaden the guided repair editor for schema-known spell and feat fields, then extend authoring to additional content types. Optional public publishing remains deliberately separate from campaign sharing.

**External release work:**
1. Deploy #90 on Victor's Unraid system, create a fresh backup, and complete the restore drill in `infra/backup/README.md`.
2. Complete the account-linking browser matrix for #80 (Google, Discord, email security-code linking, unlink/relink).
3. Send closed-alpha invites when Victor is ready.

**Not built yet:** remaining M4 authoring/content types and public publishing; M5 monsters/library NPCs/companions/sidekicks; optional campaign live presence; PDF importing; and public-beta polish.

---

## Milestones

Each milestone has a **goal**, **scope**, **exit criteria**, and ideally a **feedback checkpoint** before the next milestone starts. Milestones are not strict — they're guideposts.

---

### M1 — Pre-alpha consolidation
**Status (2026-07-21): ✅ Code complete.** All consolidation, UX, testing, and backup-hardening work is merged, including #90. The only remaining item is the external Unraid deployment and restore drill.
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
**Status (2026-07-21): ◑ Spell and feat authoring/sharing plus the private MPMB importer workflow through calculation preview are shipped and hosted-verified.** `/library` supports immutable spell/feat edits and campaign access controls; exact-campaign discovery, DM revocation, ASI feat selection, character copy, level-down pruning, and exact-version sheet pins are protected-preview verified. The importer statically parses and maps MPMB JavaScript without executing or storing it, persists owner-only reviews, guides users through narrowly validated missing spell details, resolves owned-content collisions, preserves immutable pins, and requires a server-calculated preview of the exact selected revision before commit. Imported content remains private pending a future rights workflow. This does **not** complete M4: broader schema-known repair, additional authoring/content types, and separately controlled public publishing remain.

**Goal:** Users author their own content **and** import existing content (MPMB JS) into a unified library workflow.
**Estimated effort:** ~5 weeks (combined from earlier separate milestones).

Combined because authoring and importing share the same user-owned content infrastructure (the `/library`, the sharing UI, the builder integration). Building one without the other leaves a glaring gap — users author a feat from scratch but can't import the one they already have, or vice versa.

**Scope — Authoring half (~2–3 weeks):**
- `/library` page — "my content" view with filters by type, sort, search
- Schema-driven authoring forms for each existing content type (race, class, feat, feature, spell, item, weapon, armor, background, subclass, trait)
- Builder content discovery — pickers pull from `platform` + `user_owned` + `shared_with_me`
- Sharing UI — campaign-scoped sharing is implemented for spells and feats; generalize it to other content types, then add separately controlled public publishing
- Custom content types — UI for `custom_content_types` table that exists in schema today

**Scope — Importer half (~2 weeks, leveraging existing transformers):**
- File upload pipeline (extends portrait upload infrastructure from migration `00024`)
- MPMB JS parser — reuses logic from existing `scripts/transformers/` that we used to seed the SRD
- Validation step — runs Zod schemas against parsed output, surfaces gaps
- Conflict resolution UI — implemented for explicit Keep both / Replace outcomes; field-level merge remains intentionally out of scope until it can be made rules-safe
- Missing-info wizard — spell material text and save outcomes are implemented; broaden the editor to remaining schema-known spell/feat fields
- Audit log — what was imported, what was skipped, what needs attention
- **Calculation correctness verification:** implemented as a mandatory owner-only calculation harness before commit. Feats run through the same evaluator and structured-source path as the live sheet at levels 1/5/11/17; spells run through the production casting engine at every supported scaling tier; malformed schemas, formulas, dice, or calculations fail closed.

**Exit criteria:**
- ✅ A user can create a custom feat in `/library`, share it with a campaign, and see another user choose it at an earned ASI with sheet-parity effects (#91)
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

### M5.5 — Campaigns + narrative depth (the LegendKeeper layer) — *foundation shipped 2026-07-20*
**Goal:** Deliver the second half of the founding vision: characters belong to campaigns, and campaigns carry a LegendKeeper-style wiki/narrative space shared between DM and players.
**Estimated effort:** 4–6 weeks.

> **Status: foundation shipped in #76.** Campaigns were selected ahead of M5. Authorization/RLS, CRUD and invite membership, character copy/assignment, DM/player roster views, a hierarchical rich-text wiki with visibility-safe backlinks, bidirectional character↔campaign narrative links, character timelines/relationships, DM-only/player-shared visibility, revision conflict protection, settings, invite rotation, and membership cleanup are merged and authenticated-UAT verified. Remaining work is optional public publishing and live presence.

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
- **M4 importer adds a current-revision calculation preview** — before committing, each selected feat is evaluated independently at levels 1/5/11/17 and each selected spell is test-cast across its supported scaling range. The browser receives only sanitized results, and the database refuses a commit unless that exact review revision was confirmed.

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

1. **Public publishing controls and licensing.** Campaign-only sharing shipped first. Public publishing is optional and later; decide the visibility/redaction/licensing contract before building it.
2. **Multi-system support timing.** Is Daggerheart (or another system) coming alongside D&D 5e, or after public beta? Each system takes content seeding effort.
3. **Real-time multiplayer.** Revision-safe async collaboration is shipped. Decide whether live presence, locking, or merged simultaneous editing is worth the added complexity.
4. **2024 SRD ingestion.** When the 2024 SRD's expanded feat list is wanted, who ingests it (us, with a proper script) or do users import it through M4?
5. **Pricing model.** No discussion of monetization yet. Is this free-forever / tip jar / freemium / paid? The answer affects public sharing and feature gating.

---

## Open questions for me to answer

These are mine to track:

- **M1 backup operations** — first Unraid deployment, fresh backup, and restore drill using `infra/backup/README.md`
- **M4 MPMB parser scope** — which MPMB community files should we use as test fixtures? Tasha's was named as a target; what else?
- **M5 monster schema design** — much bigger than feature/spell schemas; needs design pass

---

## Cadence + how this document is used

- **Each milestone gets a brainstorm before implementation** (per the brainstorming skill we've been using)
- **Each checkpoint produces a feedback summary** committed to `docs/alpha/feedback-round-X.md`
- **This file gets updated** between milestones with what actually shipped, what was deferred, what changed
- **No fixed dates** — milestones complete when they complete. Feedback checkpoints are gates, not deadlines.
