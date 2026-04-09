# Platform Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the purple+gold visual identity, build a real landing page, polish auth flows, add account settings with theme toggle, improve navigation with mobile support, and ensure mobile responsiveness across all pages.

**Architecture:** Theme defined as CSS variables in globals.css. Landing page is a Server Component at `/`. Auth pages themed with new palette. Account settings at `/settings` with profile/email/password/OAuth/theme/delete sections. Nav improved with user dropdown (desktop) and Sheet menu (mobile). ThemeProvider manages dark/light/system preference.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (Auth + Storage), shadcn/ui, Tailwind CSS (semantic colors only)

**Spec:** `docs/superpowers/specs/2026-04-09-platform-polish-design.md`

---

## File Map

### Database
- `supabase/migrations/00008_profile_preferences.sql` — ALTER profiles ADD preferences JSONB

### Types (modify)
- `lib/types/character.ts` — Add `preferences` field to `Profile` interface

### Theme
- `app/globals.css` — Replace all CSS variable values with purple+gold palette
- `components/theme-provider.tsx` — Client component: manages dark/light/system, reads profile preference, sets class on `<html>`
- `app/layout.tsx` — Wrap children in ThemeProvider, update metadata

### Landing Page
- `app/page.tsx` — Complete rewrite: hero, product preview, trust bar, footer
- `components/landing/landing-nav.tsx` — Unauthenticated nav with logo + sign in + create account
- `components/landing/landing-footer.tsx` — Copyright + Discord/GitHub links
- `components/landing/logo.tsx` — Text logo with optional image prop, gold accent

### Auth Pages (modify/create)
- `app/(auth)/login/page.tsx` — Retheme, add OAuth brand icons, forgot password link
- `app/(auth)/signup/page.tsx` — Retheme, add OAuth brand icons, password length indicator
- `app/(auth)/auth/forgot-password/page.tsx` — NEW: email input + send reset link
- `app/(auth)/auth/reset-password/page.tsx` — NEW: new password + confirm
- `app/(auth)/auth/verify/page.tsx` — NEW: check your email + resend button
- `app/(auth)/auth/callback/route.ts` — Update to handle password reset token type

### Navigation (modify/create)
- `app/(app)/layout.tsx` — Rewrite with desktop dropdown + mobile Sheet
- `components/nav/app-nav.tsx` — Desktop nav with active links + user dropdown
- `components/nav/mobile-nav.tsx` — Sheet-based mobile navigation
- `components/nav/nav-link.tsx` — Shared nav link with active state detection
- `components/nav/user-dropdown.tsx` — Avatar + display name dropdown with settings/signout

### Account Settings (create)
- `app/(app)/settings/page.tsx` — Settings page with all card sections
- `components/settings/profile-section.tsx` — Avatar upload, display name, bio
- `components/settings/email-section.tsx` — Current email display, change email
- `components/settings/password-section.tsx` — Change password (hidden for OAuth-only)
- `components/settings/connected-accounts-section.tsx` — Discord/Google status + connect/disconnect
- `components/settings/appearance-section.tsx` — Dark/Light/System toggle
- `components/settings/danger-zone-section.tsx` — Delete account with confirmation dialog
- `app/(app)/settings/actions.ts` — Server actions: update profile, update avatar, delete account

### shadcn/ui (install)
- `components/ui/sheet.tsx` — For mobile nav
- `components/ui/tooltip.tsx` — For icon tooltips

### Brand Reference (create)
- `docs/brand-reference.md` — Technical design tokens reference

---

## CRITICAL RULES

These rules apply to EVERY task in this plan. Violating any of them is a blocking issue.

1. **ALL Tailwind classes MUST use semantic color tokens** — `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `bg-primary`, `text-accent`, `border-border`, `bg-destructive`, etc. NEVER use raw Tailwind colors like `bg-zinc-900`, `text-gray-400`, `bg-slate-800`, `text-white`, or `text-black`. The ONLY exception is the Discord brand color `#5865F2` which is used inline as a one-off on the Discord OAuth button.
2. **Exact color values from the spec** must be used in globals.css:
   - `--background: #0b0a10` (page background)
   - `--foreground: #f0eef5` (primary text)
   - `--card: #13111d` (card/panel backgrounds)
   - `--card-foreground: #f0eef5` (card text)
   - `--primary: #7c3aed` (CTA buttons, active states)
   - `--primary-foreground: #fafafa` (text on primary)
   - `--secondary: #1e1b2e` (secondary backgrounds)
   - `--secondary-foreground: #c4c0d0` (secondary text)
   - `--muted: #13111d` (muted backgrounds)
   - `--muted-foreground: #8b85a0` (muted/subtitle text)
   - `--accent: #c9a44a` (gold — brand color, headings, highlights)
   - `--accent-foreground: #0b0a10` (text on gold backgrounds)
   - `--destructive: #dc2626` (delete, error states)
   - `--destructive-foreground: #fafafa` (text on destructive)
   - `--border: #1e1b2e` (borders, dividers)
   - `--input: #1e1b2e` (input borders)
   - `--ring: #7c3aed` (focus rings)
3. **Use shadcn/ui components everywhere possible** — Button, Input, Label, Card, Separator, Avatar, DropdownMenu, Dialog, Sheet, Tabs, etc.
4. **Server Components for data fetching, Client Components only for interactivity** — forms, toggles, dropdowns that need state are Client Components. Pages that just display data fetched from Supabase are Server Components.
5. **Every step must have complete code** — no placeholder comments like `// TODO: implement` or `// add more here`. Every file must be fully functional.
6. **Read `AGENTS.md` before writing any Next.js code** — this project uses Next.js 16 which may have breaking changes from your training data. Check `node_modules/next/dist/docs/` for current API docs if uncertain about any Next.js API.

---

## Task 1: Database Migration — Add preferences JSONB to profiles

**Files:**
- Create: `supabase/migrations/00008_profile_preferences.sql`
- Modify: `lib/types/character.ts`

**Depends on:** Nothing
**Parallel group:** A (can run with Task 2, Task 3)

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/00008_profile_preferences.sql`:

```sql
-- ============================================================
-- Platform Polish: Add preferences column to profiles
-- ============================================================

-- Add preferences JSONB column to profiles table
-- Stores user preferences like theme choice: { "theme": "dark" | "light" | "system" }
alter table public.profiles
  add column preferences jsonb not null default '{}';
```

- [ ] **Step 2: Run the migration against Supabase**

Execute the migration against the Supabase project (ID: `etcaodglvcspcmwecyxq`):

```bash
# Use Supabase MCP tool: apply_migration
# project_id: "etcaodglvcspcmwecyxq"
# name: "profile_preferences"
# query: (the SQL from step 1)
```

- [ ] **Step 3: Update Profile type in lib/types/character.ts**

Add the `preferences` field to the existing `Profile` interface:

```typescript
export interface ProfilePreferences {
  theme?: "dark" | "light" | "system";
}

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  preferences: ProfilePreferences;
  created_at: string;
}
```

Insert the `ProfilePreferences` interface directly above the existing `Profile` interface, and add `preferences: ProfilePreferences;` to `Profile` between `bio` and `created_at`.

**Verification:**
- `npx tsc --noEmit` passes
- The migration file exists at the expected path

---

## Task 2: Theme System — Replace globals.css + Create ThemeProvider

**Files:**
- Modify: `app/globals.css`
- Create: `components/theme-provider.tsx`
- Modify: `app/layout.tsx`

**Depends on:** Nothing (Task 1 for full integration, but the ThemeProvider can fall back to localStorage if preferences column isn't ready)
**Parallel group:** A

- [ ] **Step 1: Replace globals.css with purple+gold theme**

Replace the entire contents of `app/globals.css`. Keep the same structure (imports, `@theme inline`, `:root`, `.dark`, `@layer base`) but replace ALL color variable values.

The `:root` block defines the light mode values. Since light mode values are not yet defined per the spec, set `:root` to the SAME values as `.dark` — the app defaults to dark and light mode values will be defined in a future sub-project.

The `.dark` block uses the exact hex values from the spec. Convert hex values to the format required by the current CSS setup. Since the existing file uses oklch values and shadcn v4 with Tailwind v4, the hex values should be set directly as hex in the CSS variables (Tailwind v4 / shadcn v4 supports direct hex in CSS variables).

New `app/globals.css`:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-sans);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}

:root {
  /* Light mode: mirrors dark values for now — light palette defined in future sub-project */
  --background: #0b0a10;
  --foreground: #f0eef5;
  --card: #13111d;
  --card-foreground: #f0eef5;
  --popover: #13111d;
  --popover-foreground: #f0eef5;
  --primary: #7c3aed;
  --primary-foreground: #fafafa;
  --secondary: #1e1b2e;
  --secondary-foreground: #c4c0d0;
  --muted: #13111d;
  --muted-foreground: #8b85a0;
  --accent: #c9a44a;
  --accent-foreground: #0b0a10;
  --destructive: #dc2626;
  --destructive-foreground: #fafafa;
  --border: #1e1b2e;
  --input: #1e1b2e;
  --ring: #7c3aed;
  --chart-1: #7c3aed;
  --chart-2: #c9a44a;
  --chart-3: #8b85a0;
  --chart-4: #1e1b2e;
  --chart-5: #f0eef5;
  --radius: 0.625rem;
  --sidebar: #13111d;
  --sidebar-foreground: #f0eef5;
  --sidebar-primary: #7c3aed;
  --sidebar-primary-foreground: #fafafa;
  --sidebar-accent: #1e1b2e;
  --sidebar-accent-foreground: #f0eef5;
  --sidebar-border: #1e1b2e;
  --sidebar-ring: #7c3aed;
}

.dark {
  --background: #0b0a10;
  --foreground: #f0eef5;
  --card: #13111d;
  --card-foreground: #f0eef5;
  --popover: #13111d;
  --popover-foreground: #f0eef5;
  --primary: #7c3aed;
  --primary-foreground: #fafafa;
  --secondary: #1e1b2e;
  --secondary-foreground: #c4c0d0;
  --muted: #13111d;
  --muted-foreground: #8b85a0;
  --accent: #c9a44a;
  --accent-foreground: #0b0a10;
  --destructive: #dc2626;
  --destructive-foreground: #fafafa;
  --border: #1e1b2e;
  --input: #1e1b2e;
  --ring: #7c3aed;
  --chart-1: #7c3aed;
  --chart-2: #c9a44a;
  --chart-3: #8b85a0;
  --chart-4: #1e1b2e;
  --chart-5: #f0eef5;
  --sidebar: #13111d;
  --sidebar-foreground: #f0eef5;
  --sidebar-primary: #7c3aed;
  --sidebar-primary-foreground: #fafafa;
  --sidebar-accent: #1e1b2e;
  --sidebar-accent-foreground: #f0eef5;
  --sidebar-border: #1e1b2e;
  --sidebar-ring: #7c3aed;
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}
```

- [ ] **Step 2: Create ThemeProvider component**

Create `components/theme-provider.tsx`:

This is a Client Component that:
1. On mount, reads the user's theme preference from `profiles.preferences.theme` (passed as a prop from the layout's server fetch) or falls back to `localStorage` key `inkborne-theme`, or defaults to `"dark"`.
2. Applies the `dark` class to `<html>` when theme is `"dark"` or when theme is `"system"` and OS preference is dark.
3. Listens for OS preference changes when in `"system"` mode.
4. Exposes `theme` and `setTheme` via React context for the settings page toggle.
5. Persists theme choice to `localStorage` immediately for fast hydration, and to the database via the settings page (the ThemeProvider itself does NOT write to the database — that's the settings page's responsibility).
6. To avoid flash of wrong theme, the layout includes a small inline `<script>` that reads `localStorage` and sets the `dark` class before React hydrates.

The component wraps children and renders them directly (no extra DOM nodes). It provides a `ThemeContext` with:
- `theme: "dark" | "light" | "system"` — current preference
- `setTheme: (theme: "dark" | "light" | "system") => void` — update preference
- `resolvedTheme: "dark" | "light"` — actual applied theme after resolving "system"

```typescript
// components/theme-provider.tsx
"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "dark" | "light" | "system";
type ResolvedTheme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: ResolvedTheme;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "inkborne-theme";

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function ThemeProvider({
  children,
  defaultTheme,
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (defaultTheme) return defaultTheme;
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem(STORAGE_KEY) as Theme) || "dark";
  });

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    if (theme === "system") return getSystemTheme();
    return theme === "light" ? "light" : "dark";
  });

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  }, []);

  // Resolve theme and apply class
  useEffect(() => {
    const resolved: ResolvedTheme = theme === "system" ? getSystemTheme() : theme === "light" ? "light" : "dark";
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, [theme]);

  // Listen for OS preference changes when in system mode
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const resolved: ResolvedTheme = e.matches ? "dark" : "light";
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [theme]);

  return (
    <ThemeContext value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
```

- [ ] **Step 3: Update root layout**

Modify `app/layout.tsx`:

1. Remove the Geist font imports (the spec says system font stack for now).
2. Update metadata title to "Inkborne" and description.
3. Wrap children in `ThemeProvider`.
4. Add inline script to prevent theme flash (reads localStorage and sets `dark` class before hydration).
5. Set `suppressHydrationWarning` on `<html>` since the inline script modifies the class before React hydrates.
6. Add `dark` as default class on `<html>`.

```typescript
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inkborne",
  description: "Character and campaign management for tabletop RPGs",
};

const themeScript = `
  (function() {
    try {
      var theme = localStorage.getItem('inkborne-theme') || 'dark';
      var resolved = theme;
      if (theme === 'system') {
        resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      if (resolved === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {
      document.documentElement.classList.add('dark');
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

**Verification:**
- `npx tsc --noEmit` passes
- The app loads with the purple+gold dark theme
- No flash of unstyled content on page load
- Background is `#0b0a10`, text is `#f0eef5`, cards are `#13111d`

---

## Task 3: Install Additional shadcn Components

**Files:**
- Create: `components/ui/sheet.tsx`
- Create: `components/ui/tooltip.tsx`

**Depends on:** Nothing
**Parallel group:** A

- [ ] **Step 1: Install Sheet component**

```bash
npx shadcn@latest add sheet
```

This installs the Sheet component needed for the mobile navigation menu.

- [ ] **Step 2: Install Tooltip component**

```bash
npx shadcn@latest add tooltip
```

This installs the Tooltip component for icon hover states.

**Verification:**
- `components/ui/sheet.tsx` exists and exports Sheet, SheetTrigger, SheetContent, etc.
- `components/ui/tooltip.tsx` exists and exports Tooltip, TooltipTrigger, TooltipContent, etc.
- `npx tsc --noEmit` passes

---

## Task 4: Logo Component

**Files:**
- Create: `components/landing/logo.tsx`

**Depends on:** Task 2 (theme variables must be in place for accent color)
**Parallel group:** B

- [ ] **Step 1: Create Logo component**

Create `components/landing/logo.tsx`:

A simple component that renders the "Inkborne" text in the gold accent color. It accepts an optional `src` prop for a future logo image. When `src` is provided, it renders an `<img>` tag. When not, it renders styled text. Also accepts a `className` prop for sizing flexibility and a `linkTo` prop (defaults to `/`) for wrapping in a Link.

```typescript
import Link from "next/link";

interface LogoProps {
  src?: string;
  linkTo?: string;
  className?: string;
}

export function Logo({ src, linkTo = "/", className }: LogoProps) {
  const content = src ? (
    <img src={src} alt="Inkborne" className={className || "h-8"} />
  ) : (
    <span className={`text-xl font-bold text-accent ${className || ""}`}>
      Inkborne
    </span>
  );

  return (
    <Link href={linkTo} className="flex items-center">
      {content}
    </Link>
  );
}
```

**Verification:**
- `npx tsc --noEmit` passes
- Logo renders gold text "Inkborne" linking to `/`

---

## Task 5: Landing Page

**Files:**
- Rewrite: `app/page.tsx`
- Create: `components/landing/landing-nav.tsx`
- Create: `components/landing/landing-footer.tsx`

**Depends on:** Task 2 (theme), Task 4 (Logo)
**Parallel group:** B

- [ ] **Step 1: Create LandingNav component**

Create `components/landing/landing-nav.tsx`:

Server Component (no `"use client"` directive). Renders:
- Left: Logo component
- Right: "Sign in" text link (text-muted-foreground, hover:text-foreground) + "Create Account" Button (primary variant)
- Both items visible on mobile (only 2 items, no hamburger needed)
- Uses semantic colors only

```typescript
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/landing/logo";

export function LandingNav() {
  return (
    <header className="border-b border-border">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Logo />
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
          <Button asChild>
            <Link href="/signup">Create Account</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Create LandingFooter component**

Create `components/landing/landing-footer.tsx`:

Server Component. Renders a minimal single-row footer with copyright + Discord + GitHub links.

```typescript
import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="border-t border-border py-8">
      <div className="container mx-auto flex flex-col items-center gap-4 px-4 sm:flex-row sm:justify-between">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Inkborne. All rights reserved.
        </p>
        <div className="flex items-center gap-6">
          <Link
            href="https://discord.gg/inkborne"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Discord
          </Link>
          <Link
            href="https://github.com/inkborne"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            GitHub
          </Link>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Rewrite app/page.tsx — Landing page**

Completely replace `app/page.tsx` with the landing page. This is a Server Component.

Structure:
1. **LandingNav** — imported component
2. **Hero section** — subtitle label, headline with gold accent on "inkborne", description, CTA button, supported systems
3. **Product preview** — styled card container showing a mockup of the character builder UI with ability scores, features, and a homebrew badge. The container has a subtle purple glow. The content is static placeholder showing what the app looks like.
4. **Trust bar** — three items stacked horizontally on desktop, vertically on mobile: "Open Source", "Built by Players", "Join the Community"
5. **LandingFooter** — imported component

The hero section includes a background container div (empty, just `bg-background`) that can accept a background image via CSS later without layout changes.

Key details:
- Headline: "Your characters are" on one line, "*inkborne*" on the next in gold accent, using italic for emphasis
- CTA button: "Start Building" linking to `/signup`, using primary variant
- Systems list: "D&D 5e  -  Dagger Heart  -  More coming" in muted-foreground
- Product preview: a Card with border-border, showing a mock character sheet with ability scores in a grid, a features list, and a "Homebrew" badge — all using the semantic theme colors. Outer container has `shadow-[0_0_60px_-15px] shadow-primary/20` for the purple glow.
- Trust bar items: each has a bold heading (text-foreground) and a description (text-muted-foreground)
- All text uses semantic colors: `text-foreground`, `text-muted-foreground`, `text-accent`
- All backgrounds use semantic colors: `bg-background`, `bg-card`
- The hero, preview, and trust bar are vertically stacked with generous spacing
- On mobile (< md), the product preview scales down and the trust bar stacks to single column

```typescript
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingFooter } from "@/components/landing/landing-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingNav />

      {/* Hero section */}
      <section className="relative flex flex-col items-center px-4 pt-20 pb-16 text-center md:pt-32 md:pb-24">
        {/* Background container — accepts background image via CSS later */}
        <div className="absolute inset-0 bg-background" aria-hidden="true" />

        <div className="relative z-10 flex max-w-3xl flex-col items-center gap-6">
          <span className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Character &amp; Campaign Management
          </span>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Your characters are{" "}
            <em className="not-italic text-accent">inkborne</em>
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Build, manage, and bring your tabletop RPG characters to life.
            A modern toolkit for players and game masters who want more
            from their character sheets.
          </p>
          <Button size="lg" asChild className="mt-2">
            <Link href="/signup">Start Building</Link>
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">
            D&amp;D 5e &nbsp;&middot;&nbsp; Dagger Heart &nbsp;&middot;&nbsp; More coming
          </p>
        </div>
      </section>

      {/* Product preview */}
      <section className="flex justify-center px-4 pb-20 md:pb-28">
        <div className="w-full max-w-4xl shadow-[0_0_60px_-15px] shadow-primary/20 rounded-lg">
          <Card className="overflow-hidden">
            <CardContent className="p-6 md:p-8">
              {/* Mock character header */}
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-foreground">Thalindra Moonweave</h3>
                  <p className="text-sm text-muted-foreground">Level 5 High Elf Wizard</p>
                </div>
                <Badge variant="secondary" className="text-accent border-accent/30">
                  Homebrew
                </Badge>
              </div>

              {/* Mock ability scores grid */}
              <div className="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
                {[
                  { name: "STR", value: 8 },
                  { name: "DEX", value: 14 },
                  { name: "CON", value: 13 },
                  { name: "INT", value: 18 },
                  { name: "WIS", value: 12 },
                  { name: "CHA", value: 10 },
                ].map((stat) => (
                  <div
                    key={stat.name}
                    className="flex flex-col items-center rounded-md border border-border bg-secondary p-3"
                  >
                    <span className="text-xs font-medium text-muted-foreground">{stat.name}</span>
                    <span className="text-2xl font-bold text-foreground">{stat.value}</span>
                    <span className="text-xs text-muted-foreground">
                      {stat.value >= 10 ? "+" : ""}{Math.floor((stat.value - 10) / 2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Mock features list */}
              <div>
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent">
                  Features
                </h4>
                <div className="space-y-2">
                  {[
                    "Arcane Recovery",
                    "Spell Mastery: Shield",
                    "Arcane Tradition: Chronurgy",
                    "Temporal Awareness",
                  ].map((feature) => (
                    <div
                      key={feature}
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                    >
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-t border-border bg-card py-16 md:py-20">
        <div className="container mx-auto grid gap-10 px-4 md:grid-cols-3 md:gap-8">
          {[
            {
              heading: "Open Source",
              description:
                "Transparent by default. See how it works, suggest improvements, build on top of it.",
            },
            {
              heading: "Built by Players",
              description:
                "We play the games we build for. Every feature solves a real problem at the table.",
            },
            {
              heading: "Join the Community",
              description:
                "Shape what gets built next. Your feedback drives the roadmap.",
            },
          ].map((item) => (
            <div key={item.heading} className="text-center md:text-left">
              <h3 className="mb-2 text-lg font-semibold text-foreground">{item.heading}</h3>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
```

**Verification:**
- `npx tsc --noEmit` passes
- Landing page renders with purple+gold theme
- Hero section shows headline with gold "inkborne"
- Product preview shows mock character sheet with purple glow
- Trust bar shows three items
- Footer shows copyright + links
- Page is responsive: stacks vertically on mobile (< 375px)
- No raw Tailwind colors used (no `bg-zinc-*`, `text-gray-*`, etc.)

---

## Task 6: Auth Redirect Logic — Middleware Update

**Files:**
- Modify: `lib/supabase/middleware.ts`

**Depends on:** Nothing
**Parallel group:** B

- [ ] **Step 1: Update middleware to redirect authenticated users**

Modify `lib/supabase/middleware.ts` to add redirect logic:

1. **Existing behavior (keep):** Unauthenticated users hitting `/dashboard` (or any `(app)` route) get redirected to `/login`.
2. **New behavior:** Authenticated users hitting `/`, `/login`, or `/signup` get redirected to `/dashboard`.
3. Expand the protected route check to cover all `(app)` routes: `/dashboard`, `/characters`, `/campaigns`, `/settings`.

Update the `updateSession` function in `lib/supabase/middleware.ts`:

After the existing `supabase.auth.getUser()` call, add these redirect checks:

```typescript
// Existing: redirect unauthenticated users away from protected routes
const protectedPaths = ["/dashboard", "/characters", "/campaigns", "/settings"];
if (!user && protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path))) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

// New: redirect authenticated users away from public-only pages
const publicOnlyPaths = ["/", "/login", "/signup"];
if (user && publicOnlyPaths.includes(request.nextUrl.pathname)) {
  const url = request.nextUrl.clone();
  url.pathname = "/dashboard";
  return NextResponse.redirect(url);
}
```

Replace the existing single `if (!user && ...)` block with both blocks above. The protected paths list now includes `/settings` and `/characters` and `/campaigns` in addition to `/dashboard`.

**Verification:**
- `npx tsc --noEmit` passes
- Authenticated users visiting `/` are redirected to `/dashboard`
- Authenticated users visiting `/login` are redirected to `/dashboard`
- Unauthenticated users visiting `/dashboard` are redirected to `/login`
- Unauthenticated users visiting `/settings` are redirected to `/login`

---

## Task 7: Login Page Polish

**Files:**
- Modify: `app/(auth)/login/page.tsx`

**Depends on:** Task 2 (theme)
**Parallel group:** C

- [ ] **Step 1: Rewrite login page with theme and brand icons**

Rewrite `app/(auth)/login/page.tsx` with:

1. Dark themed background (`bg-background`), centered card layout
2. Logo component at the top of the card
3. Discord OAuth button with Discord brand color (`#5865F2`) and Discord SVG icon
4. Google OAuth button with neutral outline styling and Google SVG icon
5. "Forgot password?" link below the password input, linking to `/auth/forgot-password`
6. Error display remains the same
7. All existing email/password login logic preserved
8. All existing OAuth logic preserved
9. Link to signup at the bottom

The Discord and Google SVG icons are rendered inline (small SVG elements). The Discord button uses a custom `style={{ backgroundColor: "#5865F2" }}` since this is a one-off brand color not in our semantic palette. The Google button uses `variant="outline"`.

Keep the component as `"use client"` since it has form state and event handlers.

Key changes from current:
- Add Logo import and render above card title
- Add Discord icon SVG (viewBox="0 0 24 24", path data for the Discord logo mark)
- Add Google icon SVG (viewBox="0 0 24 24", the Google "G" logo)
- Style Discord button: `className="w-full text-foreground"` with `style={{ backgroundColor: "#5865F2" }}`
- Add "Forgot password?" link: `<Link href="/auth/forgot-password" className="text-sm text-muted-foreground hover:text-foreground">Forgot password?</Link>` placed after the password input div and before the error message
- Landing footer imported and rendered below the card

**Verification:**
- `npx tsc --noEmit` passes
- Login page renders with purple+gold dark theme
- Discord button shows with purple-blue brand color and Discord icon
- Google button shows with outline style and Google icon
- "Forgot password?" link is visible and links to `/auth/forgot-password`
- Login functionality works (email/password + OAuth)

---

## Task 8: Signup Page Polish

**Files:**
- Modify: `app/(auth)/signup/page.tsx`

**Depends on:** Task 2 (theme)
**Parallel group:** C

- [ ] **Step 1: Rewrite signup page with theme and brand icons**

Rewrite `app/(auth)/signup/page.tsx` with same treatment as login page:

1. Dark themed background, centered card
2. Logo component above the card title
3. Discord and Google OAuth buttons with brand icons (same as login)
4. Display name + email + password fields (existing)
5. Password minimum length helper text: `<p className="text-xs text-muted-foreground">Minimum 8 characters</p>` below the password input
6. Success state redirect: instead of showing "Check your email" inline, redirect to `/auth/verify?email={email}` (the new verification page)
7. Error display
8. Link to login at the bottom
9. Landing footer below

All existing form logic preserved. The only behavioral change is that on successful signup, instead of rendering the success card inline, it navigates to `/auth/verify?email={encodeURIComponent(email)}`.

**Verification:**
- `npx tsc --noEmit` passes
- Signup page renders with purple+gold dark theme
- OAuth buttons match login page styling
- Password helper text shows "Minimum 8 characters"
- Successful signup redirects to `/auth/verify`

---

## Task 9: Forgot Password Page

**Files:**
- Create: `app/(auth)/auth/forgot-password/page.tsx`

**Depends on:** Task 2 (theme)
**Parallel group:** C

- [ ] **Step 1: Create forgot password page**

Create `app/(auth)/auth/forgot-password/page.tsx`:

Client Component (`"use client"`) with:
- Centered card layout on `bg-background`
- Logo at the top
- Heading: "Reset your password"
- Description: "Enter your email and we'll send you a reset link"
- Email input
- "Send Reset Link" button (primary)
- On submit: calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/auth/reset-password" })`
- Success state: shows "Check your email for a password reset link" message with a link back to login
- Error state: shows error message
- "Back to login" link below the form
- Landing footer

The `redirectTo` URL tells Supabase where to redirect the user after they click the link in the email. Supabase appends the token to this URL.

**Verification:**
- `npx tsc --noEmit` passes
- Page renders at `/auth/forgot-password`
- Form submits and shows success message
- "Back to login" link works

---

## Task 10: Password Reset Page

**Files:**
- Create: `app/(auth)/auth/reset-password/page.tsx`

**Depends on:** Task 2 (theme), Task 9 (forgot password sends user here)
**Parallel group:** C

- [ ] **Step 1: Create password reset page**

Create `app/(auth)/auth/reset-password/page.tsx`:

Client Component (`"use client"`) with:
- Centered card layout on `bg-background`
- Logo at the top
- Heading: "Set new password"
- New password input + confirm password input
- Validation: passwords must match, minimum 8 characters
- "Update Password" button (primary)
- On submit: calls `supabase.auth.updateUser({ password })`
- On success: redirect to `/login` (the user needs to sign in with their new password, or they may already have a session)
- Error state: shows error message
- Landing footer

Important: When Supabase redirects the user here after clicking the reset link, the user already has a session (Supabase exchanges the token via the callback). The auth callback route (`/auth/callback`) already handles this. So `supabase.auth.updateUser()` works because the user has an active session.

However, the current auth callback only redirects to `/dashboard`. It needs to also handle the `type=recovery` token type and redirect to `/auth/reset-password` instead. This is handled by checking the `type` search param that Supabase includes in the callback URL.

- [ ] **Step 2: Update auth callback to handle password reset**

Modify `app/(auth)/auth/callback/route.ts`:

After successfully exchanging the code, check if the `type` search param is `"recovery"`. If so, redirect to `/auth/reset-password` instead of the default `next` path.

```typescript
const type = searchParams.get("type");
const next = type === "recovery" ? "/auth/reset-password" : (searchParams.get("next") ?? "/dashboard");
```

Replace the existing `const next = searchParams.get("next") ?? "/dashboard";` line with this logic.

**Verification:**
- `npx tsc --noEmit` passes
- Page renders at `/auth/reset-password`
- Password validation works (match check, length check)
- Password update calls Supabase correctly
- Auth callback routes recovery tokens to `/auth/reset-password`

---

## Task 11: Email Verification Page

**Files:**
- Create: `app/(auth)/auth/verify/page.tsx`

**Depends on:** Task 2 (theme)
**Parallel group:** C

- [ ] **Step 1: Create email verification page**

Create `app/(auth)/auth/verify/page.tsx`:

Client Component (`"use client"`) with:
- Centered card layout on `bg-background`
- Logo at the top
- Heading: "Check your email"
- Reads `email` from URL search params (via `useSearchParams()`) and displays: "We sent a verification link to {email}"
- "Resend verification email" button (outline variant)
- On resend click: calls `supabase.auth.resend({ type: "signup", email })` — this resends the confirmation email
- Success state after resend: shows "Verification email resent" message
- "Back to login" link
- Landing footer

```typescript
// Key imports needed:
// "use client"
// useSearchParams from next/navigation
// createClient from @/lib/supabase/client
// Button, Card, CardContent from shadcn
// Logo from @/components/landing/logo
// LandingFooter from @/components/landing/landing-footer
// Link from next/link
```

**Verification:**
- `npx tsc --noEmit` passes
- Page renders at `/auth/verify`
- Email from query param is displayed
- Resend button calls Supabase resend API
- Shows success/error state after resend

---

## Task 12: Desktop Nav Improvement

**Files:**
- Create: `components/nav/nav-link.tsx`
- Create: `components/nav/user-dropdown.tsx`
- Create: `components/nav/app-nav.tsx`

**Depends on:** Task 2 (theme), Task 4 (Logo)
**Parallel group:** D

- [ ] **Step 1: Create NavLink component**

Create `components/nav/nav-link.tsx`:

Client Component that compares `usePathname()` with the link's `href` to apply active styling.

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function NavLink({ href, children, className, onClick }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`text-sm transition-colors ${
        isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
      } ${className || ""}`}
    >
      {children}
    </Link>
  );
}
```

- [ ] **Step 2: Create UserDropdown component**

Create `components/nav/user-dropdown.tsx`:

Client Component that renders a DropdownMenu with the user's avatar and display name as the trigger, and Settings + Sign Out as menu items.

Props: `displayName: string`, `avatarUrl: string | null`, `email: string`

```typescript
"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";

interface UserDropdownProps {
  displayName: string;
  avatarUrl: string | null;
  email: string;
}

export function UserDropdown({ displayName, avatarUrl, email }: UserDropdownProps) {
  const initials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary transition-colors outline-none">
        <Avatar className="h-7 w-7">
          <AvatarImage src={avatarUrl || undefined} alt={displayName || email} />
          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm text-foreground hidden sm:inline">{displayName || email}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link href="/settings" className="cursor-pointer">
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <form action="/auth/signout" method="post" className="w-full">
            <button type="submit" className="w-full text-left cursor-pointer">
              Sign out
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 3: Create AppNav component**

Create `components/nav/app-nav.tsx`:

Server-rendered wrapper that passes data to the client components. Accepts `profile` and `email` as props.

Renders:
- Left: Logo (linking to `/dashboard`) + nav links (Dashboard, Characters, Campaigns) — hidden below `md` breakpoint
- Right: UserDropdown — hidden below `md` breakpoint
- The mobile hamburger button is handled by MobileNav (Task 13) and rendered separately

```typescript
import { Logo } from "@/components/landing/logo";
import { NavLink } from "@/components/nav/nav-link";
import { UserDropdown } from "@/components/nav/user-dropdown";

interface AppNavProps {
  displayName: string;
  avatarUrl: string | null;
  email: string;
}

export function AppNav({ displayName, avatarUrl, email }: AppNavProps) {
  return (
    <>
      <div className="flex items-center gap-6">
        <Logo linkTo="/dashboard" />
        <nav className="hidden md:flex gap-4">
          <NavLink href="/dashboard">Dashboard</NavLink>
          <NavLink href="/characters">Characters</NavLink>
          <NavLink href="/campaigns">Campaigns</NavLink>
        </nav>
      </div>
      <div className="hidden md:block">
        <UserDropdown displayName={displayName} avatarUrl={avatarUrl} email={email} />
      </div>
    </>
  );
}
```

**Verification:**
- `npx tsc --noEmit` passes
- NavLink highlights the active route
- UserDropdown opens with Settings and Sign Out options
- Desktop nav shows logo + links + user dropdown

---

## Task 13: Mobile Navigation

**Files:**
- Create: `components/nav/mobile-nav.tsx`
- Modify: `app/(app)/layout.tsx`

**Depends on:** Task 3 (Sheet component), Task 12 (NavLink, AppNav)
**Parallel group:** D

- [ ] **Step 1: Create MobileNav component**

Create `components/nav/mobile-nav.tsx`:

Client Component using the Sheet component. Renders:
- A hamburger menu button (visible below `md` breakpoint only)
- Sheet slides in from the left with full nav links + separator + Settings + Sign Out
- Uses NavLink component for consistent active state styling
- Sheet closes when a link is clicked (via `onOpenChange`)

Props: `displayName: string`, `avatarUrl: string | null`, `email: string`

```typescript
"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NavLink } from "@/components/nav/nav-link";
import { Menu } from "lucide-react";

interface MobileNavProps {
  displayName: string;
  avatarUrl: string | null;
  email: string;
}

export function MobileNav({ displayName, avatarUrl, email }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  const initials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase();

  return (
    <div className="md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 bg-card">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>

          {/* User info */}
          <div className="flex items-center gap-3 mb-6 mt-2">
            <Avatar className="h-9 w-9">
              <AvatarImage src={avatarUrl || undefined} alt={displayName || email} />
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{displayName || "User"}</span>
              <span className="text-xs text-muted-foreground">{email}</span>
            </div>
          </div>

          <Separator className="mb-4" />

          {/* Nav links */}
          <nav className="flex flex-col gap-3">
            <NavLink href="/dashboard" onClick={() => setOpen(false)} className="text-base">
              Dashboard
            </NavLink>
            <NavLink href="/characters" onClick={() => setOpen(false)} className="text-base">
              Characters
            </NavLink>
            <NavLink href="/campaigns" onClick={() => setOpen(false)} className="text-base">
              Campaigns
            </NavLink>
          </nav>

          <Separator className="my-4" />

          {/* Settings + Sign out */}
          <nav className="flex flex-col gap-3">
            <NavLink href="/settings" onClick={() => setOpen(false)} className="text-base">
              Settings
            </NavLink>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-base text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign out
              </button>
            </form>
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite app/(app)/layout.tsx**

Rewrite `app/(app)/layout.tsx` to use the new nav components:

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/nav/app-nav";
import { MobileNav } from "@/components/nav/mobile-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .single();

  const displayName = profile?.display_name || "";
  const avatarUrl = profile?.avatar_url || null;
  const email = user.email || "";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <AppNav displayName={displayName} avatarUrl={avatarUrl} email={email} />
          <MobileNav displayName={displayName} avatarUrl={avatarUrl} email={email} />
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
```

**Verification:**
- `npx tsc --noEmit` passes
- On desktop (>= md): full nav with links + user dropdown visible, hamburger hidden
- On mobile (< md): hamburger visible, clicking opens Sheet with full nav + user info + sign out
- Sheet closes when a link is clicked
- Active link is highlighted on both desktop and mobile
- All navigation actions have full feature parity between desktop and mobile

---

## Task 14: Account Settings — Profile Section

**Files:**
- Create: `app/(app)/settings/page.tsx`
- Create: `app/(app)/settings/actions.ts`
- Create: `components/settings/profile-section.tsx`

**Depends on:** Task 1 (preferences column), Task 2 (theme), Task 12/13 (nav — settings link works)
**Parallel group:** E

- [ ] **Step 1: Create server actions file**

Create `app/(app)/settings/actions.ts`:

Server actions for:
1. `updateProfile(formData: FormData)` — updates display_name and bio in profiles table
2. `uploadAvatar(formData: FormData)` — uploads avatar to Supabase Storage and updates avatar_url in profiles
3. `deleteAccount()` — deletes the user via Supabase Admin API (requires SUPABASE_SERVICE_ROLE_KEY env var)

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const displayName = formData.get("displayName") as string;
  const bio = formData.get("bio") as string;

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, bio: bio || null })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const file = formData.get("avatar") as File;
  if (!file || file.size === 0) {
    return { error: "No file selected" };
  }

  // Validate file type
  if (!file.type.startsWith("image/")) {
    return { error: "File must be an image" };
  }

  // Validate file size (2MB max)
  if (file.size > 2 * 1024 * 1024) {
    return { error: "File must be less than 2MB" };
  }

  const fileExt = file.name.split(".").pop();
  const filePath = `${user.id}/avatar.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { data: { publicUrl } } = supabase.storage
    .from("avatars")
    .getPublicUrl(filePath);

  // Append cache-busting timestamp
  const avatarUrl = `${publicUrl}?t=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (updateError) {
    return { error: updateError.message };
  }

  return { success: true, avatarUrl };
}

export async function updatePreferences(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const theme = formData.get("theme") as string;
  if (!["dark", "light", "system"].includes(theme)) {
    return { error: "Invalid theme value" };
  }

  // Fetch current preferences, merge with new theme
  const { data: profile } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .single();

  const currentPrefs = (profile?.preferences as Record<string, unknown>) || {};
  const newPrefs = { ...currentPrefs, theme };

  const { error } = await supabase
    .from("profiles")
    .update({ preferences: newPrefs })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function deleteAccount() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Use admin client with service role key to delete the user
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await adminClient.auth.admin.deleteUser(user.id);
  if (error) {
    return { error: error.message };
  }

  // Sign out the current session
  await supabase.auth.signOut();

  redirect("/");
}
```

- [ ] **Step 2: Create ProfileSection component**

Create `components/settings/profile-section.tsx`:

Client Component with:
- Avatar display (Avatar component) + "Change Avatar" button that triggers a hidden file input
- Display name text input
- Bio textarea
- "Save" button
- Calls `updateProfile` server action on save
- Calls `uploadAvatar` server action when a file is selected
- Shows success/error toast messages (simple inline text, no toast library needed)

Props: `displayName: string`, `avatarUrl: string | null`, `bio: string | null`

```typescript
"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { updateProfile, uploadAvatar } from "@/app/(app)/settings/actions";

interface ProfileSectionProps {
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
}

export function ProfileSection({ displayName: initialName, avatarUrl: initialAvatar, bio: initialBio }: ProfileSectionProps) {
  const [displayName, setDisplayName] = useState(initialName);
  const [bio, setBio] = useState(initialBio || "");
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = displayName ? displayName.slice(0, 2).toUpperCase() : "??";

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const formData = new FormData();
    formData.set("displayName", displayName);
    formData.set("bio", bio);
    const result = await updateProfile(formData);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Profile updated" });
    }
    setSaving(false);
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage(null);
    const formData = new FormData();
    formData.set("avatar", file);
    const result = await uploadAvatar(formData);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else if (result.avatarUrl) {
      setAvatarUrl(result.avatarUrl);
      setMessage({ type: "success", text: "Avatar updated" });
    }
    setUploading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={avatarUrl || undefined} alt={displayName} />
            <AvatarFallback className="bg-primary text-primary-foreground text-lg">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Uploading..." : "Change Avatar"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <p className="mt-1 text-xs text-muted-foreground">Max 2MB. JPG, PNG, or GIF.</p>
          </div>
        </div>

        {/* Display Name */}
        <div className="space-y-2">
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your display name"
          />
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about yourself"
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        {/* Message */}
        {message && (
          <p className={`text-sm ${message.type === "error" ? "text-destructive" : "text-accent"}`}>
            {message.text}
          </p>
        )}

        {/* Save button */}
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create settings page**

Create `app/(app)/settings/page.tsx`:

Server Component that fetches the user's profile and renders all settings sections. Initially just the ProfileSection — other sections will be added in subsequent tasks.

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileSection } from "@/components/settings/profile-section";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, bio, preferences")
    .eq("id", user.id)
    .single();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      <ProfileSection
        displayName={profile?.display_name || ""}
        avatarUrl={profile?.avatar_url || null}
        bio={profile?.bio || null}
      />

      {/* Email, Password, Connected Accounts, Appearance, and Danger Zone sections added in Tasks 15-16 */}
    </div>
  );
}
```

**Verification:**
- `npx tsc --noEmit` passes
- Settings page renders at `/settings`
- Profile section shows avatar, display name, bio fields
- Avatar upload works (file picker opens, uploads to Supabase Storage)
- Display name and bio save correctly
- Success/error messages display properly

---

## Task 15: Account Settings — Email, Password, Connected Accounts, Appearance

**Files:**
- Create: `components/settings/email-section.tsx`
- Create: `components/settings/password-section.tsx`
- Create: `components/settings/connected-accounts-section.tsx`
- Create: `components/settings/appearance-section.tsx`
- Modify: `app/(app)/settings/page.tsx`

**Depends on:** Task 14 (settings page exists), Task 2 (ThemeProvider for appearance toggle)
**Parallel group:** F

- [ ] **Step 1: Create EmailSection component**

Create `components/settings/email-section.tsx`:

Client Component with:
- Shows current email address
- "Change Email" button that reveals an input for the new email
- On submit: calls `supabase.auth.updateUser({ email: newEmail })` (client-side, since it needs the current session)
- Shows message: "Check both your old and new email to confirm the change"
- Cancel button to hide the input

- [ ] **Step 2: Create PasswordSection component**

Create `components/settings/password-section.tsx`:

Client Component with:
- Only visible for users who have a password identity (check `user.app_metadata.providers` or `user.identities` for email provider)
- New password + confirm password inputs
- Validation: passwords match, minimum 8 characters
- On submit: calls `supabase.auth.updateUser({ password })` (client-side)
- Success/error messages

Props: `hasPasswordIdentity: boolean` — determined by the parent page checking `user.identities`

- [ ] **Step 3: Create ConnectedAccountsSection component**

Create `components/settings/connected-accounts-section.tsx`:

Client Component with:
- Lists Discord and Google with connected/not connected status
- For each provider:
  - If connected: shows "Connected" badge + "Disconnect" button
  - If not connected: shows "Connect" button
- Connect: calls `supabase.auth.linkIdentity({ provider })` which initiates OAuth flow
- Disconnect: calls `supabase.auth.unlinkIdentity({ identityId })` using the identity ID from user data

Props: `identities: Array<{ id: string; provider: string }>` — from `user.identities`

- [ ] **Step 4: Create AppearanceSection component**

Create `components/settings/appearance-section.tsx`:

Client Component with:
- Three-option toggle: Dark / Light / System
- Uses `useTheme()` from ThemeProvider to get and set the current theme
- On change: updates ThemeProvider state (which updates localStorage and applies the class) AND calls `updatePreferences` server action to persist to the database
- Visual: three buttons in a group, the active one has `bg-primary text-primary-foreground`, inactive ones have `bg-secondary text-secondary-foreground`

```typescript
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { updatePreferences } from "@/app/(app)/settings/actions";

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  async function handleThemeChange(newTheme: "dark" | "light" | "system") {
    setTheme(newTheme);
    // Persist to database
    const formData = new FormData();
    formData.set("theme", newTheme);
    await updatePreferences(formData);
  }

  const options: Array<{ value: "dark" | "light" | "system"; label: string }> = [
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
    { value: "system", label: "System" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Choose your preferred theme. Light mode colors are coming in a future update.
        </p>
        <div className="flex gap-2">
          {options.map((option) => (
            <Button
              key={option.value}
              variant={theme === option.value ? "default" : "secondary"}
              size="sm"
              onClick={() => handleThemeChange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Update settings page to include all sections**

Modify `app/(app)/settings/page.tsx` to import and render all sections in order:

1. ProfileSection (already there)
2. EmailSection — pass `email: user.email`
3. PasswordSection — pass `hasPasswordIdentity: boolean` (check `user.identities` for `provider === "email"`)
4. ConnectedAccountsSection — pass `identities` from `user.identities`
5. AppearanceSection — no props needed (reads from ThemeProvider context)
6. DangerZoneSection (Task 16 — add a placeholder comment for now)

The page fetches user data including identities. Pass the theme preference from `profile.preferences.theme` to ThemeProvider as the `defaultTheme` prop if needed (this is optional since ThemeProvider reads from localStorage as well).

**Verification:**
- `npx tsc --noEmit` passes
- All sections render on the settings page
- Email change form works
- Password change form works (only visible for email+password users)
- Connected accounts show correct status
- Theme toggle switches between dark/light/system and persists to database

---

## Task 16: Account Settings — Danger Zone

**Files:**
- Create: `components/settings/danger-zone-section.tsx`
- Modify: `app/(app)/settings/page.tsx`

**Depends on:** Task 14 (settings page, server actions)
**Parallel group:** F

- [ ] **Step 1: Create DangerZoneSection component**

Create `components/settings/danger-zone-section.tsx`:

Client Component with:
- Red-bordered Card (`border-destructive`)
- "Delete Account" heading
- Warning text explaining what happens (all characters, campaigns, and data will be permanently deleted)
- "Delete Account" button (destructive variant)
- On click: opens a Dialog (from shadcn)
- Dialog asks user to type "DELETE" to confirm
- Input validation: button only enabled when input value is exactly "DELETE"
- On confirm: calls `deleteAccount` server action from Task 14
- Shows loading state while deleting

```typescript
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteAccount } from "@/app/(app)/settings/actions";

export function DangerZoneSection() {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const result = await deleteAccount();
    // If deleteAccount succeeds, it redirects. If it returns, there was an error.
    if (result?.error) {
      setError(result.error);
      setDeleting(false);
    }
  }

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="text-destructive">Danger Zone</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Permanently delete your account and all associated data. This includes all your
          characters, campaign memberships, homebrew content, and profile information.
          This action cannot be undone.
        </p>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive">Delete Account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Are you absolutely sure?</DialogTitle>
              <DialogDescription>
                This will permanently delete your account and all associated data.
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="confirm-delete">
                Type <span className="font-mono font-bold text-foreground">DELETE</span> to confirm
              </Label>
              <Input
                id="confirm-delete"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
              />
            </div>
            <DialogFooter>
              <Button
                variant="destructive"
                disabled={confirmText !== "DELETE" || deleting}
                onClick={handleDelete}
              >
                {deleting ? "Deleting..." : "Permanently Delete Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Add DangerZoneSection to settings page**

Modify `app/(app)/settings/page.tsx` to import and render `DangerZoneSection` as the last section on the page.

**Verification:**
- `npx tsc --noEmit` passes
- Danger zone section renders with red border
- Delete button opens confirmation dialog
- Input validation requires typing "DELETE" exactly
- Delete action calls server action (test with a throwaway account)

---

## Task 17: Mobile Responsiveness Audit

**Files:**
- Potentially modify: any page that has layout issues on mobile

**Depends on:** Tasks 5-16 (all pages must exist first)
**Parallel group:** G

- [ ] **Step 1: Audit landing page on mobile**

Check the landing page at viewport width 375px:
- Hero section text is readable and centered
- Product preview card scales down properly (ability score grid goes 3x2)
- Trust bar stacks to single column
- Footer is centered
- No horizontal overflow

Fix any issues found. Common patterns:
- Use `px-4` for container padding on mobile
- Use responsive grid: `grid-cols-3 sm:grid-cols-6` for ability scores
- Use `text-3xl sm:text-4xl md:text-5xl` for responsive heading sizes

- [ ] **Step 2: Audit auth pages on mobile**

Check login, signup, forgot password, reset password, and verify pages at 375px:
- Cards should have proper padding (not touching screen edges)
- Forms are usable with touch targets
- OAuth buttons are full width and tappable

Fix: ensure `p-4` wrapper div has proper padding and cards use `w-full max-w-md`.

- [ ] **Step 3: Audit dashboard on mobile**

Check the dashboard page at 375px:
- Character cards stack to single column (`grid-cols-1 md:grid-cols-2`)
- Tab navigation scrolls horizontally if needed
- Text is readable

- [ ] **Step 4: Audit builder on mobile**

Check character builder pages at 375px:
- Step navigation scrolls horizontally on mobile
- Builder content stacks vertically
- Ability score grid adapts (`grid-cols-2 sm:grid-cols-3 md:grid-cols-6`)
- Forms are usable

- [ ] **Step 5: Audit settings on mobile**

Check settings page at 375px:
- All card sections stack vertically (should be default)
- Form fields are full width
- Avatar upload area is accessible
- Theme toggle buttons are tappable

**Verification:**
- All pages render correctly at 375px viewport width
- No horizontal overflow on any page
- All interactive elements are tappable with appropriate touch target sizes
- Text is readable without zooming

---

## Task 18: Brand Reference Document

**Files:**
- Create: `docs/brand-reference.md`

**Depends on:** Task 2 (theme must be finalized)
**Parallel group:** G

- [ ] **Step 1: Create brand reference document**

Create `docs/brand-reference.md` with the following sections:

1. **Color Palette** — CSS variable names + hex values in a table matching the spec exactly
2. **Typography** — Font stack (`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`), size scale (text-sm, text-base, text-lg, text-xl, text-2xl, text-3xl), heading weights
3. **Border Radius** — `--radius: 0.625rem` and derived values (sm, md, lg, xl)
4. **Spacing Patterns** — Common spacing values used in layouts (p-4, p-6, gap-4, gap-6, etc.)
5. **Component Patterns** — Button variants (default=purple, secondary, outline, destructive, ghost), Card styles (bg-card, border-border), Input styles (border-input, bg-background)
6. **Color Usage Rules** — Gold accent for brand text and feature headings, purple primary for CTAs and interactive elements, muted-foreground for secondary text, destructive for errors and danger actions
7. **Critical Rule** — All Tailwind classes must use semantic tokens, never raw colors

This is a technical reference for developers and AI agents. Keep it concise and factual.

**Verification:**
- File exists at `docs/brand-reference.md`
- All color values match the spec exactly
- No missing tokens

---

## Task 19: Final Verification

**Depends on:** All previous tasks
**Parallel group:** H

- [ ] **Step 1: Type check**

```bash
npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Fix any lint errors.

- [ ] **Step 3: Build**

```bash
npm run build
```

Fix any build errors. The build must succeed completely.

- [ ] **Step 4: Semantic color audit**

Search the entire codebase for raw Tailwind color classes that should be semantic:

```bash
# Search for common raw color patterns in tsx/ts files
grep -rn "bg-zinc-\|bg-gray-\|bg-slate-\|text-zinc-\|text-gray-\|text-slate-\|text-white\|text-black\|bg-white\|bg-black" --include="*.tsx" --include="*.ts" app/ components/
```

Any matches (except in `node_modules/`) must be replaced with semantic tokens:
- `bg-white` / `bg-black` -> `bg-background`
- `text-white` / `text-black` -> `text-foreground`
- `bg-zinc-*` / `bg-gray-*` / `bg-slate-*` -> `bg-card`, `bg-secondary`, `bg-muted`
- `text-zinc-*` / `text-gray-*` / `text-slate-*` -> `text-foreground`, `text-muted-foreground`

- [ ] **Step 5: Verify all routes**

Confirm these routes exist and render:
- `/` — Landing page (unauthenticated)
- `/login` — Login page
- `/signup` — Signup page
- `/auth/forgot-password` — Forgot password page
- `/auth/reset-password` — Password reset page
- `/auth/verify` — Email verification page
- `/dashboard` — Dashboard (authenticated)
- `/characters` — Characters list (authenticated)
- `/campaigns` — Campaigns (authenticated)
- `/settings` — Account settings (authenticated)

- [ ] **Step 6: Run tests**

```bash
npm run test
```

Fix any test failures.

**Verification:**
- All commands pass with zero errors
- No raw Tailwind colors in application code
- All routes render correctly
- Build succeeds
