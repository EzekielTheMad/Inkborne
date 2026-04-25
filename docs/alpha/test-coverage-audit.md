# Test Coverage Audit

**Date:** 2026-04-25
**Scope:** Honest inventory of what's tested, what's not, and what to do about it before alpha. Read-only audit — code changes follow once recommendations are confirmed.

---

## Summary

**322 unit + component tests pass today.** Coverage is strong for the engine, schemas, transformers, and isolated component behavior. The main gaps are at **integration boundaries** — the places where multiple pieces have to wire together correctly to make a flow work. That's also where the bugs we've found in this stretch have lived (mobile-sheet stacking, HP key mismatch, Ki all-nulls data, missing `patch_character_state` RPC).

For alpha specifically, the test gap that worries me most is: **we have no smoke test that exercises the end-to-end flow** — sign up → create character → build → see sheet. A single regression on any glue layer kills the alpha experience and our 322 unit tests would all stay green.

---

## What's well covered (don't worry about these)

| Area | Coverage |
|---|---|
| Schema validation | All content types + system schema validated by Zod with comprehensive tests |
| Engine: parser, evaluator, conditions, effects | Strong unit coverage; 10+ test files |
| Inventory: helpers, armor effects, rarity colors, supabase queries | Solid |
| Spells: helpers, multiclass slots, supabase queries | Solid |
| Resources: helpers + counter component + widget + conditions widget + rest dialog | Comprehensive after Phase 1 + Rest System |
| Rest: pure helpers (both short + long) | Comprehensive |
| Character utils, transformers (classes/races/equipment/spells) | Solid |
| Auth admin check (`isAdminUserId`) | Comprehensive |
| Feedback / error reporting helpers | Insert paths covered |

---

## Gaps that worry me for alpha

These are bug-prone surfaces that would silently break the user experience if regressed.

### G1. No E2E flow test for character creation (critical)

**The problem:** A brand-new user goes through landing → signup → dashboard → create character → builder → finished sheet. We have no test that walks this path. Each piece is unit-tested but the seams between them aren't. The mobile-stacking bug is a recent example — every unit test passed, but the actual page rendered both layouts at once.

**Risk:** Any change that breaks the wiring between auth, character creation, builder steps, or sheet rendering ships green-on-green.

**Recommendation:** add Playwright with 2-3 smoke tests:
1. Sign up via email → land on dashboard
2. Create character → land on `/characters/[id]` with no-sheet CTA
3. Walk one full builder pass (race → class L1 → abilities → background → equipment) → reach a populated sheet

Effort: **1 day** for the framework + 3 smoke tests. Pays itself back the first time it catches a regression.

### G2. HP tracker behavior — auto-reset death saves (important)

**The problem:** PR #17 added auto-reset of death saves when HP transitions from 0 to >0. Important behavior, no test. The condition is subtle ("only on the 0→>0 transition, not on every HP change") and easy to break.

**Risk:** A future refactor of the HP tracker could remove the reset and saves would persist after healing. RAW-incorrect, looks like a bug.

**Recommendation:** add a component test with mocked patchState. Verify:
- Damage to 0 → no reset
- Heal from 0 → 1 → death saves cleared
- Heal from 5 → 10 → no death saves touched
- Heal from 0 → 1 with already-zero saves → no spurious patch

Effort: **1-2 hours.** Concrete bug-prevention.

### G3. Server actions are untested (medium)

**The problem:** Server actions like `createCharacter` (in `/characters/new/page.tsx`), `updateFeedbackAction`, `updateErrorAction`, etc. run in the wire-format space — a typo in the form data shape or a permission check breaks the action silently.

**Risk:** A user clicks "Create Character," nothing happens, no error message. We discover it in user feedback.

**Recommendation:** add unit tests for each server action with mocked Supabase. Test the success path + the auth-failure path + the missing-fields path. Each action ~30 minutes.

For alpha, the most important is **`createCharacter`** in `/characters/new/page.tsx` — the entire flow depends on it. Could ship that one alone for ~30 min.

Effort total for all server actions: **2-4 hours.** Or **30 min** for just `createCharacter`.

### G4. Auth callback handler (`/auth/callback/route.ts`) (medium)

**The problem:** OAuth + email verification redirects come back to `/auth/callback`. If this errors, users get bounced to `/login?error=auth` with no further info. Untested.

**Risk:** A change to Supabase auth behavior or our redirect logic could break OAuth without us knowing.

**Recommendation:** unit test with mocked Supabase exchange. Verify success → redirect to next; error → redirect to /login?error=auth; missing code → redirect to /login?error=auth.

Effort: **1 hour.**

### G5. Builder choice-resolution wiring (medium)

**The problem:** `ChoiceSelector` and `AsiSelector` are component-tested in isolation. The wiring from selector → character.choices update → re-evaluation → reflected stats is not E2E tested. We've seen UAT feedback flag broken dropdowns ("ChoiceSelector wired to class features") suggesting this seam has had bugs.

**Risk:** A user clicks a feature choice, the UI shows it, but it doesn't propagate to character state or the engine — silent feature-not-working bug.

**Recommendation:** the Playwright smoke from G1 (full builder pass) covers most of this. Adding a focused unit test that simulates choice resolution end-to-end (selector input → useReducer or context → character.choices update → assert engine output) is overkill if Playwright is in.

Effort: **0** if G1 lands. **2-3 hours** for a dedicated test if not.

### G6. RLS policies are untested (medium)

**The problem:** We've shipped `feedback`, `app_errors`, `character_spells`, `character_inventory`, `characters` tables — all with RLS. Policies are applied via migrations but never verified beyond "did the migration succeed?". A bad policy lets users read others' data or denies legitimate reads.

**Risk:** Privacy bug (cross-user data leak) or functionality bug (legitimate user can't read their own data).

**Recommendation:** for alpha, a manual smoke test of cross-user reads is faster than a DB integration test framework. Open two browser sessions as two users; confirm A can't see B's characters/feedback/errors. **Mark this as a manual smoke item, not a code test.**

Effort: **15 minutes manual.** Defer DB integration test framework to post-alpha.

---

## Lower-priority gaps (defer to post-alpha)

| Gap | Why defer |
|---|---|
| Pure render components (skills list, defenses, ability cards, saving throws, passive senses, combat stats) | Low bug surface — pure render with no logic. Visual regression catches issues better than unit tests would. |
| Page-level server components (dashboard, characters list) | Mostly server-fetch + render. Failures show as 500s, easy to spot. |
| Admin routes (`/admin/feedback`, `/admin/errors`) | Internal tools, only seen by you. Failure mode is "I can't see feedback" — visible immediately. |
| Visual regression / screenshot diffs | Big setup cost; alpha tester eyeballs are the visual test for now. |
| DB integration tests (RPC behavior, RLS verification) | Big setup cost. Alpha replaces this with manual cross-user smoke. |
| Concentration state transitions | Light usage in alpha; easy to fix if broken. |
| Inventory equip/unequip side effects on AC | Tested via `armor-effects.test.ts` already — adequate. |

---

## Recommended pre-alpha actions

In priority order:

| # | Item | Effort | Impact |
|---|---|---|---|
| 1 | **Playwright + 3 smoke tests** (G1) | 1 day | Catches integration regressions across the most important flow |
| 2 | **HP tracker auto-reset test** (G2) | 1-2 hours | Locks in subtle behavior shipped in PR #17 |
| 3 | **`createCharacter` server action test** (G3 narrowed) | 30 min | Most important untested server action |
| 4 | **Auth callback unit test** (G4) | 1 hour | Cheap insurance on OAuth/verify redirect flow |
| 5 | **Manual cross-user RLS smoke** (G6) | 15 min | Check we haven't shipped a privacy bug |

**Total: ~1.5 days of focused work.**

After this is in, we have meaningfully more confidence shipping to alpha. The Playwright suite specifically would have caught the mobile-stacking bug + the HP `0/0` rendering bug, both of which slipped past 322 unit tests.

---

## Recommended post-alpha actions

- Visual regression (Percy / Chromatic / Playwright screenshots)
- DB integration test framework (RLS verification, RPC behavior)
- Coverage for all server actions (not just `createCharacter`)
- Page-level component tests for builder steps (currently untested at the page level)
- Component tests for HP tracker, stat ribbon, combat stats (pure-render but worth basic snapshots)

---

## What I'd change if you sign off

If you say "go," I'd implement items 1, 2, 3, 4 from the priority table — that's 1-2 days of focused work, single PR, locks in the most important pre-alpha confidence. Item 5 is 15 minutes of your time (two browser sessions, one alt-account login).

If 1 (Playwright) feels too heavy, I can skip it and ship 2+3+4 only — that's ~3 hours and still covers the highest-value spots, just without the integration smoke.

Let me know.
