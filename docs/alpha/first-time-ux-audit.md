# First-Time UX Audit

**Date:** 2026-04-23
**Scope:** What a brand-new user sees from landing page through first character creation. Read-only audit — no code changes here. Findings below are prioritized for pre-alpha decisions.

---

## Current flow

Traced the happy path for an email/password signup:

1. **`/`** landing page — hero ("Your characters are *inkborne*"), product preview mockup (L5 Wizard character), trust bar (Open Source / Built by Players / Community), CTA → `/signup`
2. **`/signup`** — Discord + Google OAuth on top, email/password form below. Display name required. After email submit → `/auth/verify?email=...`. OAuth goes through `/auth/callback`.
3. **`/auth/verify`** — "Check your email" card with resend button. Once verified, callback redirects to `/dashboard`.
4. **`/dashboard`** — "Welcome, [name]" heading + two equal cards: Characters (with empty-state CTA) + Campaigns ("coming soon").
5. **`/characters/new`** — Minimal form: character name input + game system dropdown. Submit creates the character row and redirects to `/characters/[id]`.
6. **`/characters/[id]`** (pre-sheet) — Sparkles icon + "Let's build your character" CTA → `/characters/[id]/builder`
7. Builder flow: race → class → abilities → background → equipment → back to sheet

OAuth path skips step 3. Otherwise identical.

---

## What's working well

- **Landing page is polished.** Hero copy reads clean, the fake-character preview mockup is smart (shows what the product does without needing a screenshot), trust bar speaks to the community-driven positioning.
- **Signup has a clean OAuth-first pattern.** Discord and Google buttons at the top with the email form below is the right hierarchy for a community-driven TTRPG product.
- **Empty states have CTAs.** Dashboard empty state, characters list empty state, and the no-sheet character page all include a prominent "Create" / "Start Building" button instead of leaving the user stranded.
- **Verify page has resend functionality** — nontrivial and easy to miss; nicely done.
- **Auth callback is clean and handles `next` param** so deep links after verification work.
- **No-sheet character state** has a dedicated CTA card with Sparkles icon — was added during the Phase 1 Spells work and serves the onboarding flow well.

---

## Findings — prioritized for pre-alpha

### High-impact, low-effort (recommend doing before alpha)

#### F1. Campaigns "coming soon" card dominates the dashboard

`app/(app)/dashboard/page.tsx:106-117` renders a Campaigns card at equal visual weight to Characters, with the text "Campaign management is coming soon." A brand-new user sees 50% of their dashboard occupied by a "not built yet" card. That's honest but it feels like the product is half-absent.

**Options:**
- **Hide the card entirely** until campaigns ship (single-column Characters layout)
- **Shrink to a thin informational strip** at the bottom of the dashboard ("Campaigns are coming in the next milestone — [signup to get notified / submit feedback about what matters most]")
- **Give it actual content** — a brief "what campaigns will be" explanation plus link to the feedback widget

Recommendation: **hide entirely**. Add it back when the feature is real. The dashboard should be about what the user can do today.

**Effort:** 15 minutes.

#### F2. Game-system dropdown is awkward when only one system is published

`app/(app)/characters/new/page.tsx:106-118` shows a system dropdown. If only D&D 5e 2014 is published (almost certainly true today), the user is asked to select from a one-option list. Friction without value.

**Fix:** check how many systems return from `game_systems` where `status = 'published'`. If exactly 1, auto-select and hide the dropdown. If 2+, show normally with a default selected.

**Effort:** 30 minutes.

#### F3. No alpha-tester context anywhere in the app

Alpha testers will accept rough edges if they know they're testing something unfinished. Today there's no visible signal that "this is an alpha build, things will change, report issues via the feedback widget." They may encounter a broken flow and assume the product is just bad.

**Options:**
- **Small banner** on the dashboard (dismissible) — "You're testing Inkborne Alpha. Things will change. Bugs? Click the Feedback button in the nav."
- **Welcome card** on the dashboard (first-login) — expanded context about what's working, what's not, expected cadence
- **Dashboard intro section** permanent but low-key — right under the "Welcome" heading

Recommendation: **dismissible banner + link to the feedback widget**. Keep it small — don't dominate the page. Dismissal state saved on the profile so it stays dismissed across sessions.

**Effort:** 1-2 hours (includes profile column for dismissal state).

#### F4. No brief welcome context on first dashboard visit

After signup → OAuth or email verification, a user lands on `/dashboard` and sees "Welcome, [name]" + empty Characters + coming-soon Campaigns. They're oriented on *who* they are but not on *what they just joined*. For friends who were invited via the April survey, they'll remember. For anyone impulsively signing up, they won't.

**Recommendation:** folded into F3. The alpha banner can do double duty — set context ("this is Inkborne, a character + campaign tool for TTRPGs") AND call out the alpha nature AND point to the feedback channel. One small card instead of three.

---

### Medium impact, medium effort

#### F5. New-character form lacks context

`app/(app)/characters/new/page.tsx` presents a bare name + system dropdown. A new user doesn't know:
- What happens after they submit (builder flow with 5 steps)
- That they can rename the character later
- That the system choice is mostly cosmetic for now (only one shipped)

**Recommendation:** add a small helper paragraph below `CardDescription`:
> "Next, you'll pick a race, class, abilities, background, and starting equipment. You can rename or change your character at any time."

And once F2 lands (auto-select system when only one), the form is just one field — cleaner.

**Effort:** 30 minutes.

#### F6. Brand-new characters could auto-redirect into the builder

After creating a character name, user lands on `/characters/[id]` which shows the "Let's build your character" CTA. This is intentional (SheetPanel's no-sheet state), but it's an extra click that doesn't carry new information.

**Options:**
- **Auto-redirect** to the builder for characters with no choices yet (`character.choices.classes` is empty). Server-side check in `/characters/[id]/page.tsx`.
- **Keep the intermediate page** but make the CTA button the visual focus, maybe even auto-scroll to it

Recommendation: **auto-redirect** on first visit. If the user backs out of the builder (e.g. unsure what race to pick), they can return to `/characters/[id]` and still see the CTA. This saves a click for the 99% who just want to keep going.

**Effort:** 30 minutes.

---

### Lower priority — defer to post-alpha

#### F7. Supabase default verification email is generic

The email verification template is Supabase's default. For alpha friends, this is fine — they know who invited them. For public launch, a branded template with Inkborne context would be worth doing. Not blocking alpha.

#### F8. No help affordance anywhere in the app

No "Help" link, no tooltip intro, no first-time walkthrough. The feedback widget is the only way to ask questions. For alpha (friends, 8 people), this is acceptable. Post-alpha, a small `?` in the nav that opens a docs drawer or a brief tour could help.

#### F9. No profile personalization prompt

Display name is set at signup, avatar is optional via settings. No "complete your profile" nudge. Fine for alpha.

#### F10. Mobile path not validated

The signup → dashboard → create-character → builder flow hasn't been verified on mobile. Given we just found the `md:hidden` bug, there could be other layout issues here. This is covered in the broader smoke-test checklist — no separate action needed.

---

## What this audit does NOT cover

- Visual/layout consistency at responsive breakpoints (that's the smoke test checklist)
- Builder-step UX polish (that's the Claude Design brief in `docs/design-briefs/builder-ux-polish.md`)
- Accessibility audit (keyboard nav, screen-reader, focus management) — worth doing but scope of its own
- Performance (load times, bundle size)
- Error states (network failure, auth expiry, etc.) — partially covered by the error-reporting work coming next

---

## Recommended pre-alpha action list

In priority order:

1. **F1** — hide Campaigns dashboard card (15 min)
2. **F2** — auto-select system when only one published (30 min)
3. **F3 + F4 combined** — dismissible alpha banner with context + feedback CTA (1-2 hours)
4. **F5** — new-character form helper text (30 min)
5. **F6** — auto-redirect brand-new characters to builder (30 min)

**Total effort: ~3-4 hours.** All are small, low-risk, and visible to every alpha tester on their first visit.

**Deferred to post-alpha: F7–F10.**
