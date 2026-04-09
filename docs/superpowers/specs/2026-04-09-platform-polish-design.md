# Platform Polish — Design Spec

**Date:** 2026-04-09
**Sub-project:** 4 of 10 — Platform Polish
**Scope:** Theme system, landing page, auth polish, account settings, navigation, mobile responsiveness, brand reference

---

## Overview

This sub-project polishes the platform fundamentals — the pages and flows every user touches before they ever create a character. It establishes the visual identity (purple + gold dark theme), builds a real landing page, polishes the auth experience, adds account settings, improves navigation with mobile support, and ensures every page works on mobile viewports.

---

## Theme System

### Color Palette: Purple + Gold

Dark theme with warm purple undertones and gold accent. Defined as CSS variables in `globals.css`, applied through shadcn/ui's existing `dark` class system.

| Token | Value | Usage |
|---|---|---|
| `--background` | `#0b0a10` | Page background |
| `--foreground` | `#f0eef5` | Primary text |
| `--card` | `#13111d` | Card/panel backgrounds |
| `--card-foreground` | `#f0eef5` | Card text |
| `--primary` | `#7c3aed` | CTA buttons, active states |
| `--primary-foreground` | `#fafafa` | Text on primary buttons |
| `--secondary` | `#1e1b2e` | Secondary backgrounds |
| `--secondary-foreground` | `#c4c0d0` | Secondary text |
| `--muted` | `#13111d` | Muted backgrounds |
| `--muted-foreground` | `#8b85a0` | Muted/subtitle text |
| `--accent` | `#c9a44a` | Gold accent — brand color, headings, highlights |
| `--accent-foreground` | `#0b0a10` | Text on gold backgrounds |
| `--destructive` | `#dc2626` | Delete, error states |
| `--destructive-foreground` | `#fafafa` | Text on destructive buttons |
| `--border` | `#1e1b2e` | Borders, dividers |
| `--input` | `#1e1b2e` | Input borders |
| `--ring` | `#7c3aed` | Focus rings |

### Dark/Light/System Toggle

- Default: dark theme (the purple + gold palette above)
- Light mode variable values: defined later in a future sub-project. The infrastructure supports it now — the toggle exists in settings and persists the preference, but only dark mode has defined values.
- System mode: follows OS preference via `prefers-color-scheme` media query
- Theme preference stored in `profiles.preferences` JSONB: `{theme: "dark" | "light" | "system"}`
- Applied via `dark` class on `<html>` element, managed by a ThemeProvider component

### Typography

- Primary font: system font stack (`system-ui, -apple-system, sans-serif`) for now. A custom font can be added later via the brand guide.
- Gold accent color used for: brand name, feature headings, named abilities/content titles
- Purple primary used for: buttons, links, focus states, interactive elements

---

## Landing Page

Route: `/` (replaces the current Next.js default page)

Unauthenticated users see this page. Authenticated users are redirected to `/dashboard`.

### Structure

1. **Nav bar** — Logo (text, image-ready placeholder) + "Sign in" link + "Create Account" button (primary purple)
2. **Hero section** — Subtitle label ("Character & Campaign Management"), headline ("Your characters are *inkborne*" with gold accent), description paragraph, "Start Building" CTA button, supported systems list (D&D 5e · Dagger Heart · More coming)
3. **Product preview** — Styled container with a mockup screenshot of the app (character stats, features list). Uses the actual purple + gold theme. Placeholder content for now — shows a sample character with ability scores, features, and a homebrew entry. Container has a subtle purple glow shadow.
4. **Trust bar** — Three items: "Open Source" (transparent by default), "Built by Players" (we play the games we build for), "Join the Community" (shape what gets built next). No pricing claims.
5. **Footer** — Copyright + Discord/GitHub links

### Hero Background

The hero section has a CSS background that's currently just the `--background` color. The markup includes a background container that can accept an image via CSS when one is created. No placeholder image — just the clean dark background.

### Logo

The nav renders a text logo styled with the gold accent color. The component accepts an optional `src` prop for an image. When a logo is designed, it's a prop change — no layout modifications needed.

---

## Auth Flow Polish

### Login Page (`/login`)

- Apply purple + gold theme (dark background, themed card)
- Discord button with Discord brand color (#5865F2) and icon
- Google button with neutral styling and icon
- "Forgot password?" link below the password field → navigates to `/auth/forgot-password`
- If user is already authenticated, redirect to `/dashboard`

### Signup Page (`/signup`)

- Same theme treatment as login
- Discord and Google OAuth buttons with brand styling
- Display name field + email + password
- Password minimum length indicator (8 characters)

### Forgot Password Page (`/auth/forgot-password`)

- New page: email input + "Send Reset Link" button
- Calls `supabase.auth.resetPasswordForEmail(email)`
- Shows success message: "Check your email for a password reset link"

### Password Reset Page (`/auth/reset-password`)

- New page: new password + confirm password inputs
- Accessed via the link in the reset email (Supabase redirects here with a token)
- Calls `supabase.auth.updateUser({ password })`
- On success: redirect to `/login` with success message

### Email Verification Page (`/auth/verify`)

- New page: "Check your email" confirmation with branded layout
- Shown after signup when email verification is required
- Includes "Resend verification email" button

---

## Account Settings

Route: `/settings`

### Database Change

Add `preferences` JSONB column to `profiles` table:

```sql
alter table public.profiles add column preferences jsonb not null default '{}';
```

### Page Structure

Single page with card sections, scrollable:

**Profile Section**
- Avatar: current avatar display + upload button (Supabase Storage)
- Display name: text input
- Bio: textarea
- Save button (updates `profiles` table)

**Email Section**
- Current email displayed
- "Change Email" button → reveals input for new email
- Calls `supabase.auth.updateUser({ email })` which sends confirmation to both addresses

**Password Section**
- Only visible for users who have a password (not OAuth-only users)
- New password + confirm password inputs
- Calls `supabase.auth.updateUser({ password })`

**Connected Accounts Section**
- Shows Discord and Google with connected/not connected status
- Connected: shows "Connected" badge + "Disconnect" button
- Not connected: shows "Connect" button that initiates OAuth linking
- Uses Supabase Auth identity linking API

**Appearance Section**
- Three-option toggle: Dark / Light / System
- Saves to `profiles.preferences.theme`
- ThemeProvider reads this on load and applies the appropriate class

**Danger Zone Section**
- Red-bordered card at the bottom
- "Delete Account" button
- Confirmation dialog: type "DELETE" to confirm
- Server action calls Supabase Admin API to delete the user (requires service role key)
- Cascades: characters, content refs, content shares, campaign memberships all cascade-deleted via FK constraints

---

## Navigation & Layout

### Desktop Nav (authenticated)

- Left: Logo + main nav links (Dashboard, Characters, Campaigns)
- Right: User dropdown (shadcn DropdownMenu)
  - Avatar + display name as trigger
  - Menu items: Settings, Sign Out
- Active link highlighted with `text-foreground` (vs `text-muted-foreground` for inactive)
- Uses `usePathname()` from `next/navigation` to detect active route

### Mobile Nav

- Below `md` breakpoint: hamburger menu button replaces inline nav links
- Click opens a slide-down or sheet menu with:
  - Nav links (Dashboard, Characters, Campaigns)
  - Separator
  - Settings link
  - Sign Out button
- Uses shadcn Sheet component (needs to be installed: `npx shadcn@latest add sheet`)
- Full feature parity with desktop — every link/action available on mobile

### Landing Page Nav (unauthenticated)

- Left: Logo
- Right: "Sign in" text link + "Create Account" button
- Mobile: same — both links visible (no hamburger needed, only 2 items)

### Footer

- Landing page + auth pages only (not in the authenticated app layout)
- Copyright + Discord + GitHub links
- Minimal, single row

### Active Link Detection

All nav links use a shared utility or component that compares `pathname` with the link's `href` to apply active styling.

---

## Mobile Responsiveness

Every page must work on mobile viewports (375px minimum). Specific considerations:

- **Landing page**: hero stacks vertically, product preview scales down, trust bar stacks to single column on small screens
- **Auth pages**: already centered cards, should work. Verify padding on small screens.
- **Dashboard**: character cards stack to single column. Tab navigation scrolls horizontally if needed.
- **Builder**: step nav scrolls horizontally on mobile. Builder content stacks vertically. Ability score grid goes from 3x2 to 2x3 or single column.
- **Settings**: sections stack vertically (already the default)

A dedicated task in the implementation plan will audit all existing pages and fix mobile layout issues.

---

## Brand Reference

Create `docs/brand-reference.md` capturing the technical design tokens:

- Color palette (CSS variable names + hex values)
- Typography (font stack, size scale)
- Border radius values
- Spacing patterns
- Component patterns (button variants, card styles)

This is a technical reference for developers and AI agents working on the UI, not a marketing brand guide. The full brand guide (voice, tone, messaging, logo usage) comes in a later marketing pass.

---

## What This Sub-Project Delivers

1. **Theme system** — Purple + gold CSS variables in globals.css, ThemeProvider with dark/light/system toggle
2. **Landing page** — Hero, product preview, trust bar, footer (logo/image placeholder-ready)
3. **Auth polish** — Themed login/signup, forgot password, password reset, email verification, OAuth brand icons, auth redirects
4. **Account settings** — Profile editing, avatar upload, email change, password change, connected accounts, theme toggle, delete account
5. **Navigation** — Desktop nav with user dropdown, mobile hamburger menu, active link indicators
6. **Mobile responsiveness** — All pages audited and fixed for mobile viewports
7. **Database migration** — Add `preferences` JSONB column to profiles
8. **Brand reference** — `docs/brand-reference.md` with design tokens

## What This Sub-Project Does NOT Deliver

- Logo or hero illustration (placeholders ready for drop-in)
- Light mode CSS variable values (toggle exists, values defined later)
- Full brand guide with voice/tone/messaging (future marketing pass)
- Cookie consent / privacy policy / legal pages
- Notification preferences
- Onboarding flow / first-run experience

---

## Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| Color palette | Purple + gold on dark | Luxury feel with fantasy warmth; not rustic/brown; distinct from D&D Beyond's teal |
| Landing page style | Bold hero + product preview + trust bar | Confident presentation without template-y three-card grid; product preview builds credibility |
| Trust signals | Open Source, Built by Players, Join Community | Builds trust without making pricing commitments that limit future monetization |
| Auth polish scope | Full flow: forgot password, reset, verification, OAuth icons | Table stakes for a real platform; users expect these flows |
| Account settings scope | Full: profile, email, password, OAuth, theme, delete account | User trust requires control over their data and account |
| Theme toggle | Dark/Light/System stored in profiles.preferences | Infrastructure supports light mode; only dark values defined now |
| Mobile approach | Full feature parity, responsive design | PRD requirement: "Must work on phone at the table" |
| Brand reference | Technical tokens file, not full brand guide | Capture decisions now; full brand/marketing guide is a later pass |
| Logo/hero image | Placeholder-ready in markup | Don't block implementation on asset creation |
| Character accent color | Saved as idea for future sub-project | Per-character hex code influencing dashboard/sheet theme — great personalization |
