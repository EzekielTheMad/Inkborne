# Inkborne — Game Plan & Working Handbook

**Last updated:** 2026-07-15
**Audience:** Any coding agent (Claude, Codex, etc.) or human picking up this project. This document is deliberately tool-agnostic and self-contained.
**Companion docs:** [`ROADMAP.md`](ROADMAP.md) (milestone-level source of truth) · [`architecture/00-overview.md`](architecture/00-overview.md) (codebase map) · [`design-briefs/`](design-briefs/) (aesthetic direction)

---

## 1. What Inkborne is

An open-source **D&D Beyond × LegendKeeper** for Victor's playgroup (8 players/DMs), with ambition to grow beyond it:

- **Character sheet engine** flexible enough to absorb homebrew mechanics as the group invents them — content is data (Zod-validated schemas + a deterministic effects evaluator), not hardcoded rules.
- **Narrative as a first-class citizen** — each character has a rich narrative profile (backstory, timeline, relationships, images), not just a bio text field.
- **Campaigns** — characters attach to campaigns; each campaign gets a LegendKeeper-style wiki/narrative space; the app serves both **players and DMs**.
- **Bring-your-own content** — author homebrew in-app and import from existing sources (MPMB scripts first, PDFs later).

## 2. Workflow conventions (read before doing anything)

The project previously used the **GSD** and **superpowers** skill systems. **Both are retired.** Do not run `/gsd:*` commands or follow `docs/superpowers/` process conventions. That directory remains as a valuable **archive** of design specs and implementation plans — read them for context, don't extend the system.

Going forward:

1. **Plain plan → PR workflow.** For non-trivial work, write a short design/plan markdown into `docs/specs/` first (or reuse an existing archived plan), then implement on a feature branch, then PR to `main`. Conventional-commit titles (`feat(builder): …`, `fix(sheet): …`, `docs: …`).
2. **Tests gate merges.** Run `npx vitest run` before any PR. The suite must stay green (**620 passing as of 2026-07-15**, ~25s). There is no CI — the discipline is the gate.
3. **This is a modified Next.js** (see `AGENTS.md`): read the relevant guide in `node_modules/next/dist/docs/` before writing framework-touching code.
4. **UI kit is Base UI (`@base-ui/react`), not Radix** — trigger composition uses the `render` prop. Vaul for bottom sheets. Tailwind tokens per `docs/brand-reference.md` and `docs/design-briefs/*/inkborne-tokens.css`.
5. **Supabase** is the backend (project ref `etcaodglvcspcmwecyxq`). Types are generated into `database.types.ts`; regenerate after migrations. Character state mutates through the `patch_character_state` RPC and the typed helpers from PR #56 — don't write ad-hoc state writes.
6. **Design source of truth** for look & feel is `docs/design-briefs/` — Claude Design mockup bundles with tokens, JSX mockups, and screenshots. Match them; don't freestyle aesthetics.
7. **Don't touch `.claude/worktrees/`** — session worktrees, excluded from vitest. When multiple agents work in parallel worktrees, **never use `git stash`** — stash refs are repo-wide and cross-pop between worktrees (this bit us on 2026-07-16); commit WIP to the branch instead. Reserve migration numbers explicitly when concurrent branches both add migrations.
7b. **Supabase free-tier auto-pause:** the project pauses after ~a week of inactivity (it was found INACTIVE on 2026-07-15 and restored with data intact). Before alpha invites, either upgrade the plan or add a keep-alive; check `get_project` status before debugging "connection timeout" errors.
8. **Update the status log** (§7 below) when you finish or abandon a work item, and keep `ROADMAP.md` snapshots honest.
9. **Local dev:** `npm run dev` (port 3000; launch config `inkborne-dev` in `.claude/launch.json`); `.env.local` lives in the repo root on Victor's machine. Test-account credentials are held by Victor — ask him, never commit them.

## 3. Where the project actually stands (verified 2026-07-15)

**Shipped on `main`** (see `ROADMAP.md` "Where we are today" for the full list): auth (email/Google/Discord), full character builder (race→class→abilities→background→equipment) with the polished class rail / preview modal / multiclass / level-up flows and full mobile support, character sheet with HP/skills/saves/conditions/rests/feature resources, spell selection (Phase 1, no casting), inventory + magic items, unified character page with **sheet + narrative tabs** (backstory editor, portrait upload with crop/compression), feedback widget + error reporting + `/admin` hub, 5e 2014 SRD content seeded.

**Not built yet:** spell *casting* + dice + effects durations (M3), homebrew authoring/import (M4), monsters/NPCs (M5), **campaigns beyond a placeholder page and two migrations** (proposed M5.5), journey aesthetic polish (M2 second half).

**The single gate to closed alpha #1 is database backups** — PR [#33](https://github.com/EzekielTheMad/Inkborne/pull/33) is code-complete; deployment is parked on a Supabase pooler credential and needs Victor's Unraid hardware (details in §4, Track A).

**Open PRs:** [#33](https://github.com/EzekielTheMad/Inkborne/pull/33) (backups, code-complete) · [#57](https://github.com/EzekielTheMad/Inkborne/pull/57) (content-schema-validation design spec, docs-only — mergeable whenever).

**Housekeeping done on 2026-07-15:** the stranded UAT punch-list fixes (dialog a11y + duplicate level-row key) were found uncommitted on a detached HEAD and merged as [#58](https://github.com/EzekielTheMad/Inkborne/pull/58); the ~4,200-line journey design handoff bundle was rescued off the local-only `feat/mobile-builder` WIP commit into `docs/design-briefs/design_handoff_journey_alpha/`.

## 4. The plan, in priority order

Work the tracks top-down. Within a track, tasks are sized for a single focused agent session and are independently PR-able unless noted.

### Track A — Close out alpha #1 (highest priority)

The goal: **invite the 8 friends** from the April 2026 survey to build characters. Everything here serves that.

- **A1 — Deploy backups + restore drill.** *(Victor + agent pairing; blocked on Victor's hardware.)* Merge [#33](https://github.com/EzekielTheMad/Inkborne/pull/33), deploy the container on Unraid, run a restore drill into a throwaway Supabase project. Known fix for the `Tenant or user not found` error: use the Supavisor **session-pooler** connection with the tenant-qualified username `postgres.<project-ref>`, the correct regional pooler host, and the current DB password. Full design: `docs/superpowers/specs/2026-04-25-backup-system-design.md`.
- **A2 — Equipment step chooser.** The equipment step renders choices ("a mace or a warhammer") as static text with a Confirm button — no actual picker. **Needs Victor's product call first** (see §6): grant defaults silently, or build radio/dropdown choosers. Then implement.
- **A3 — Subclass discoverability.** Subclass (Divine Domain etc.) is only reachable via the level-up flow; a fresh level-1 Cleric never sees a domain prompt. Surface the pending-subclass state in the static class view/rail.
- **A4 — Verify "Set level" honors required choices.** Suspicion from UAT: jumping levels directly (vs stepping) may skip required subclass prompts (test character "Voltee", Wizard 3, has no Arcane Tradition). Reproduce, and if real, gate set-level completion on the same required-choice checks the level-up flow uses.
- **A5 — Residual dialog a11y warning.** One `DialogTitle` warning remains in `tests/components/builder/class-step-rail.test.tsx` (LevelRailMobile → set-level flow) after #58. Find the unlabeled dialog layer and fix.
- **A6 — DB hygiene.** Delete the corrupted "UAT Smoke Cleric" test character (CON 4 / WIS 1 — an autosave-race artifact, not a bug).
- **A7 (optional) — Playwright E2E smoke.** Auth → build character → see sheet. Recommended pre-alpha, not a gate. (Test-coverage audit: `docs/alpha/test-coverage-audit.md`, item G1.)
- **A8 — Send the invites.** After A1 + at least A2/A3 decisions are settled: invite the 8 friends, collect via the in-app feedback widget, triage into `docs/alpha/feedback-round-A.md`.

### Track B — M2 journey polish (parallel, not alpha-blocking)

The landing → auth → dashboard → characters-list → sheet aesthetic pass. Design bundle: **`docs/design-briefs/design_handoff_journey_alpha/`** (start with its `README.md`); brief: `docs/design-briefs/journey-landing-to-sheet.md`. One focused PR per surface, mirroring how the builder polish shipped (#37–#54):

- **B1 — Landing page** (bundle has variants A/B/C — **Victor picks**, see §6; screenshot of B in the bundle).
- **B2 — Auth pages** (`journey-auth.jsx`).
- **B3 — Dashboard + characters list** (`journey-dashboard.jsx`).
- **B4 — Sheet first-arrival + typography/spacing polish pass** (no structural changes).

### Track C — Repo housekeeping (cheap, do opportunistically)

- **C1 — Merge PR [#57](https://github.com/EzekielTheMad/Inkborne/pull/57)** (docs-only spec), then execute the content-schema-validation refactor: plan already written at `docs/superpowers/plans/2026-05-19-content-schema-validation.md` (13 tasks — run Zod schemas at the server fetch boundary; closes ~21 test typecheck errors). Rebase the existing `refactor/content-schema-validation` branch onto `main` first. ⚠️ The plan's schema-drift audit task is a **stop gate**: if platform content doesn't match schemas, surface the drift to Victor rather than silently patching.
- **C2 — Branch cleanup.** Safe to delete now that the journey bundle is rescued and everything else is merged: `feat/mobile-builder`, `claude/recursing-carson-b72c72`, `alpha-prep` (== main), plus the long-merged `feat/*`, `fix/*`, `docs/*` branches and the stray `master`. Verify `git log main..<branch>` is empty (or only superseded WIP) before each delete. Note: an unreviewed draft-level-sync tweak from the recursing-carson worktree was preserved as a local commit on its branch — review or discard deliberately.
- **C3 — Remove stale worktrees** under `.claude/worktrees/` (`git worktree remove`) after C2.
- **C4 — Create `docs/specs/`** and add a line to `docs/superpowers/README` (or the directory itself) noting it's an archive.

### Track D — Feature milestones (after alpha #1 feedback)

These are specced at the milestone level in [`ROADMAP.md`](ROADMAP.md); each needs a design spec before implementation:

1. **M3 — Gameplay foundations:** ✅ **COMPLETE 2026-07-16** (spec `docs/specs/2026-07-15-m3-gameplay-foundations-*.md`; PRs #61, #65, #66, #68–#72, #74; migrations 00038–00040 applied to prod; live-browser UAT green with zero bugs). Alpha #2 ("can you *play* a character?") is content-ready.
2. **M4 — Homebrew + importer:** `/library`, schema-driven authoring forms, MPMB JS import pipeline (reuse `scripts/transformers/`), sharing, preview-character validation.
3. **M5 — New content types:** monsters → NPCs → companions/sidekicks.
4. **M5.5 — Campaigns + narrative depth** *(proposed 2026-07-15 — the LegendKeeper layer; ordering vs M5 is Victor's call, see §6)*: campaign CRUD/membership, DM/player roles, campaign wiki with cross-links, character-timeline/relationship expansion, character↔campaign narrative links.
5. **M6/M7/M8** — Spell Phase 3, PDF importer, public-beta polish.

## 5. Agent playbook — how to pick up work

1. Read this file, then the ROADMAP section for your track, then `docs/architecture/00-overview.md` (and `01`–`04` as relevant).
2. Check `git status` and open PRs (`gh pr list`) before starting — this project has been burned by stranded uncommitted work twice. **Never leave finished work uncommitted or on a detached HEAD.**
3. For design work, open the relevant `docs/design-briefs/` bundle and match its tokens/mockups.
4. Definition of done: implementation + tests, full suite green, PR opened with a summary and test evidence, status log updated (§7).
5. Product decisions (anything in §6) belong to Victor — don't guess; leave the decision documented and pick a different task.

## 6. Decisions Victor owns (agents: do not decide these)

| # | Decision | Blocks | Status |
|---|----------|--------|--------|
| 1 | Equipment step: silently grant defaults vs build a chooser UI | A2 | **Session default applied 2026-07-16: chooser built** (PR #64) — veto/revise freely |
| 2 | Landing page variant A / B / C | B1 | **Session default applied 2026-07-16: variant B** (bundle README's recommendation, PR #67) — A/C mockups remain in the bundle |
| 3 | M5 vs M5.5 ordering (DM content first, or campaigns first?) | Track D sequencing | Open |
| 4 | Sharing model: public publishing vs campaign-only | M4 | Open |
| 5 | Multi-system (e.g. Daggerheart) timing | post-beta | Open |
| 6 | Real-time multiplayer vs async | M5.5 architecture | Open |
| 7 | Pricing/monetization | M8 | Open |
| 8 | **C1 schema drift — fix direction per category** (see table below) | C1 tasks 4–12, PR #60 | **Open — blocks the validation refactor** |

**Decision #8 detail — the C1 drift audit found 22/1535 platform rows failing their schemas.** In every category the data matches what the app's consumers actually read, and the schema is the outlier — so the recommendation is to fix schemas, not data. Per category (details in PR #60):

| Category | Recommendation |
|---|---|
| 8 caster classes: `spellcastingList.level` is `{min,max}` object, schema wants tuple | Change schema to the object shape |
| paladin/ranger: empty `cantrips` array, schema demands length 20 | Allow empty/short arrays |
| bard `toolProfs.from` is a plain string, schema wants `"any"\|string[]` | Widen schema to accept string (matches consumer) |
| 11 magic items: `rarity: "Varies"` missing from enum | Add `"Varies"` to the enum |
| 2 spells: `damage.type: null` | Allow null (consumers already tolerate it) |
| ki feature: numeric per-level `additional` array | Widen schema to `(string\|number)[]` |

## 7. Status log (append-only — newest first)

- **2026-07-16** — Agentic sprint close-out (Claude, orchestrated session). **Tracks A (agent-doable), B, C (except C1), and D/M3 are DONE.** 17 PRs merged (#33, #57–#59, #61–#74 minus #60); tests 620 → **1109 unit + 6 live E2E**; migrations 00038–00040 applied to prod. Highlights: M2 journey polish shipped (landing variant B); equipment chooser shipped; subclass discoverability + set-level gating fixed (A4 confirmed real); M3 gameplay foundations complete and UAT-verified in-browser with zero bugs. Latent bugs fixed en route: `initializeState` dropped persisted play-state fields on load (PR #68); Supabase project found auto-paused and restored, data intact. **Still open:** PR #60 (C1, blocked on decision #8), A1 backups deploy (Victor's Unraid), A8 alpha invites (Victor). Session defaults applied for decisions #1/#2 (see §6). Also: UAT Smoke Cleric deleted from prod; 15 stale branches + worktrees removed; e2e selectors repaired post-redesign (#73).
- **2026-07-16** — M3 T9 (Claude): added `e2e/m3-gameplay.spec.ts` — Playwright UAT proving M3 exit criteria against the live stack (cast → slot → effect → AC, upcast damage roll → toast/log/`character_rolls` persistence, no concentration prompt for non-concentration effects, hit-die spend + short rest with Arcane Recovery). Full e2e suite (now 6 tests) green twice consecutively; 1109 vitest unchanged.

- **2026-07-15** — Project re-orientation session (Claude). Verified main @ `31a4996` + 620 tests green; merged stranded UAT a11y/dup-key fixes as #58; rescued journey design bundle into `docs/design-briefs/design_handoff_journey_alpha/`; added M5.5 campaigns milestone (proposed) to ROADMAP; wrote this game plan. Retired GSD/superpowers workflow. Next up: Track A (A1 needs Victor's Unraid access; A2 needs decision #1).
- **2026-06-19** — Re-orientation + full build-a-character UAT (PASS end-to-end). Punch list captured; ROADMAP refreshed.
- **2026-05 and earlier** — See `ROADMAP.md` "What changed since 2026-04-25" and git history (#19–#57).
