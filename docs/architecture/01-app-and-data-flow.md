# App router, data flow, and auth

Next.js 16 App Router with three top-level segments: `(app)` (authenticated), `(auth)` (public auth pages), and `app/api` (route handlers). A custom `proxy.ts` (this codebase's renamed `middleware.ts`) refreshes Supabase sessions on every non-asset request and gates protected paths. Server Components do all Supabase reads via `lib/supabase/server.ts` and pass typed props down to `*-client.tsx` peers — that server-page → client-peer pair is the dominant pattern. Server Actions (`"use server"`) handle writes; six action files exist today, all colocated under `app/(app)/...`. Game-system-agnostic content is stored as schema + effect documents in Postgres and resolved against typed shapes in `lib/types/`.

## App router layout

| Segment | Path | Owns |
| --- | --- | --- |
| Public landing | [app/page.tsx](app/page.tsx) | Marketing landing; redirects authed users to `/dashboard` |
| Root layout | [app/layout.tsx](app/layout.tsx) | `<html>`, dark theme, `ThemeProvider` only |
| Authed shell | [app/(app)/layout.tsx](app/(app)/layout.tsx) | Auth gate, nav header, `ErrorListeners`, fetches `profiles` for nav |
| Auth pages | `app/(auth)/login`, `app/(auth)/signup`, `app/(auth)/auth/{forgot-password,reset-password,verify}` | Pure client components using `lib/supabase/client.ts` |
| Auth handlers | [app/(auth)/auth/callback/route.ts](app/(auth)/auth/callback/route.ts), [app/(auth)/auth/signout/route.ts](app/(auth)/auth/signout/route.ts) | OAuth/email-link code-exchange and signout redirect |
| Dashboard | [app/(app)/dashboard/page.tsx](app/(app)/dashboard/page.tsx) | Authed home with character list and alpha banner |
| Characters list | [app/(app)/characters/page.tsx](app/(app)/characters/page.tsx) | Owned characters grid |
| Character new | [app/(app)/characters/new/page.tsx](app/(app)/characters/new/page.tsx) | Form posts to `createCharacter` server action |
| Character page | [app/(app)/characters/[id]/page.tsx](app/(app)/characters/[id]/page.tsx) | Sheet view, renders `CharacterPageClient` |
| Builder | [app/(app)/characters/[id]/builder/](app/(app)/characters/[id]/builder/) | Step-rail layout + per-step pages (`class`, `race`, `background`, `abilities`, `equipment`) |
| Settings | [app/(app)/settings/page.tsx](app/(app)/settings/page.tsx) | Profile, email, password, OAuth links, danger zone |
| Campaigns | [app/(app)/campaigns/page.tsx](app/(app)/campaigns/page.tsx) | Stub — "coming in a future sub-project" |
| Admin hub | [app/(app)/admin/page.tsx](app/(app)/admin/page.tsx) | Hidden ops dashboard; gated by `isAdminUserId` (404 for non-admins) |
| Admin sub-pages | `app/(app)/admin/{users,feedback,errors}/page.tsx` | Each gates independently and renders a client peer |
| Sheet redirect | [app/characters/[id]/sheet/page.tsx](app/characters/[id]/sheet/page.tsx) | One-line `redirect(/characters/[id])` — legacy URL compat. Has its own [layout.tsx](app/characters/[id]/sheet/layout.tsx) outside the `(app)` shell |
| API | [app/api/characters/search/route.ts](app/api/characters/search/route.ts) | Sole API route |

No `template.tsx` files exist. Builder has its own nested layout at [app/(app)/characters/[id]/builder/layout.tsx](app/(app)/characters/[id]/builder/layout.tsx) that fetches the character once and renders the step-rail above the per-step `children`.

## Server vs. client component split

The codebase's dominant pattern: a server `page.tsx` performs all Supabase queries and renders a `*-client.tsx` peer with typed props. The client peer is `"use client"`, holds local state, talks to Supabase via the browser client for live mutations, and calls `router.refresh()` or server actions to persist.

Canonical example — class step:

- [app/(app)/characters/[id]/builder/class/page.tsx](app/(app)/characters/[id]/builder/class/page.tsx) — server component, awaits `getUser()`, queries `characters`, four `content_definitions` queries (class/subclass/feature/spell), and `character_content_refs`. Hands everything to the client.
- [app/(app)/characters/[id]/builder/class/class-step-client.tsx](app/(app)/characters/[id]/builder/class/class-step-client.tsx) — `"use client"`, takes typed `ClassStepClientProps`, owns local `choices`/`level` state, uses `lib/supabase/client.ts` for inline writes, calls `router.refresh()` after persistence.

Same shape repeats for every builder step: `abilities-step-client.tsx`, `race-step-client.tsx`, `background-step-client.tsx`, `equipment-step-client.tsx`. Admin sub-pages (`users-admin-client.tsx`, `feedback-admin-client.tsx`, `error-admin-client.tsx`) follow it too. The character detail page renders a `CharacterPageClient` from [components/character/character-page-client.tsx](components/character/character-page-client.tsx).

Data-access helpers live in [lib/supabase/](lib/supabase/) (e.g. [lib/supabase/characters.ts:35](lib/supabase/characters.ts) `getCharacterWithSystem`, also `content-refs.ts`, `feedback.ts`, `errors.ts`, `inventory.ts`, `spells.ts`, `storage.ts`) — server pages call these directly rather than reissuing raw queries.

## Supabase clients

| File | Purpose | Used in |
| --- | --- | --- |
| [lib/supabase/server.ts](lib/supabase/server.ts) | `createServerClient` reading cookies via `next/headers`. Setter ignores errors when called from a Server Component. | All `page.tsx`, route handlers, server actions, lib data helpers |
| [lib/supabase/client.ts](lib/supabase/client.ts) | `createBrowserClient` — no cookies, just URL+anon-key. | All `*-client.tsx`, login/signup/forgot-password pages |
| [lib/supabase/middleware.ts](lib/supabase/middleware.ts) | `updateSession`: refreshes the session and writes new cookies on a `NextResponse`. | Called by `proxy.ts` |

Auth session protocol: `proxy.ts` runs `updateSession` on every request; that call to `supabase.auth.getUser()` triggers cookie refresh and re-issues set-cookies on the response. Server pages call `await createClient()` then `supabase.auth.getUser()` again as their auth gate — cheap thanks to the freshly-refreshed cookie. Both Supabase URL and `NEXT_PUBLIC_SUPABASE_ANON_KEY` come from env.

## Middleware + auth gate

[proxy.ts](proxy.ts) (note: filename is `proxy.ts`, not `middleware.ts` — Next 16 in this codebase exports a `proxy` function) registers a matcher excluding `_next/static`, `_next/image`, `favicon.ico`, and image extensions, then delegates to `updateSession`.

[lib/supabase/middleware.ts:33](lib/supabase/middleware.ts) contains the redirect logic:

- Protected paths (`/dashboard`, `/characters`, `/campaigns`, `/settings`) → redirect to `/login` if no user.
- Public-only paths (`/`, `/login`, `/signup`) → redirect to `/dashboard` if user is present.

Defense-in-depth: the `(app)` layout at [app/(app)/layout.tsx:10](app/(app)/layout.tsx) and most server pages also call `getUser()` and `redirect("/login")` directly, so the auth check is enforced at three layers (proxy, layout, page).

OAuth flow: client calls `signInWithOAuth({ redirectTo: '/auth/callback' })` (e.g. [app/(auth)/login/page.tsx:68](app/(auth)/login/page.tsx)); provider redirects back with `code`; [app/(auth)/auth/callback/route.ts](app/(auth)/auth/callback/route.ts) exchanges the code and redirects to `/dashboard` (or `/auth/reset-password` for `type=recovery`). Signout is a `POST` to [app/(auth)/auth/signout/route.ts](app/(auth)/auth/signout/route.ts).

Admin gate: [lib/auth/is-admin.ts](lib/auth/is-admin.ts) exports `isAdminUserId(userId)` which checks against the `ADMIN_USER_IDS` env var (comma-separated UUIDs). Each `app/(app)/admin/**/page.tsx` calls `getUser()` then `notFound()` for non-admins (404, not 403 — leaks no existence info). Admin sub-pages also use the service-role key directly via `createClient as createAdminClient` from `@supabase/supabase-js` to bypass RLS for cross-user reads (e.g. [app/(app)/admin/page.tsx:127](app/(app)/admin/page.tsx)).

## Server actions

Experimental Server Actions are enabled with `bodySizeLimit: "6mb"` ([next.config.ts:5](next.config.ts)). Six action files exist, all under `app/(app)/...` and all start with `"use server"`:

| File | Exports | Purpose |
| --- | --- | --- |
| [app/(app)/dashboard/actions.ts](app/(app)/dashboard/actions.ts) | `dismissAlphaBanner` | Update `profiles.preferences.alpha_banner_dismissed_at` |
| [app/(app)/characters/new/actions.ts](app/(app)/characters/new/actions.ts) | `createCharacter(formData)` | Insert character row, redirect to builder |
| [app/(app)/characters/[id]/narrative-actions.ts](app/(app)/characters/[id]/narrative-actions.ts) | Multiple narrative/portrait writers | Owner-checked updates to `narrative` and `narrative_rich`, image upload via storage helper |
| [app/(app)/settings/actions.ts](app/(app)/settings/actions.ts) | `updateProfile`, `uploadAvatar`, … | Profile + avatar; uses service-role client for admin auth ops |
| [app/(app)/admin/feedback/actions.ts](app/(app)/admin/feedback/actions.ts) | `updateFeedbackAction` | Admin-gated status/notes update |
| [app/(app)/admin/errors/actions.ts](app/(app)/admin/errors/actions.ts) | `updateErrorAction` | Admin-gated status/notes update |

All actions follow the same auth-check pattern: `createClient()` → `getUser()` → `redirect("/login")` if missing → ownership/admin check → mutation → `revalidatePath()`. Builder client peers do their writes via the browser client rather than actions; actions are reserved for navigation-triggering mutations and admin/profile flows.

## Top-level data shapes

| Type module | Represents |
| --- | --- |
| [lib/types/character.ts](lib/types/character.ts) | `Character`, `CharacterChoices`, `CharacterState`, `CharacterContentRef`, `CharacterWithSystem`, `Campaign`, ASI/HP roll structures |
| [lib/types/system.ts](lib/types/system.ts) | `GameSystem`, `SystemSchemaDefinition` (ability scores, skills, resources, content types, currencies, creation steps, sheet sections) — the per-system rules JSON |
| [lib/types/effects.ts](lib/types/effects.ts) | `Effect` union (`MechanicalEffect`, `NarrativeEffect`, `GrantEffect`, `ChoiceEffect`), conditions, progression tracks/tiers — the engine's effect grammar |
| [lib/types/content.ts](lib/types/content.ts) | `ContentDefinition` (race/class/feat/etc as data + effects), `ContentVersion`, scope/source enums |
| [lib/types/narrative.ts](lib/types/narrative.ts) | `NarrativeData` (portrait, one-liner, motivation), `FunTraits`, plus `NarrativeRichData` (Tiptap docs) |
| [lib/types/inventory.ts](lib/types/inventory.ts) | `InventoryItem`, `Currency` |
| [lib/types/spells.ts](lib/types/spells.ts) | `CharacterSpell` (known/prepared/spellbook tracking) |
| [lib/types/resources.ts](lib/types/resources.ts) | `FeatureResource` — class-feature usage counters (Rage, Ki, etc.) |
| [lib/types/taxonomies.ts](lib/types/taxonomies.ts) | Frozen vocabularies — damage types, magic schools, sizes, armor/weapon categories |
| [lib/supabase/database.types.ts](lib/supabase/database.types.ts) | Auto-generated Postgres row types |

## API routes

| Route | Method | Description |
| --- | --- | --- |
| [app/api/characters/search/route.ts](app/api/characters/search/route.ts) | `GET` | Type-ahead search of `characters` within a campaign by `q` and `campaign_id`; auth-gated, RLS-respecting (no service role); returns `{id, label, entityType: "character"}[]` |
| [app/(auth)/auth/callback/route.ts](app/(auth)/auth/callback/route.ts) | `GET` | OAuth/email-link `code` → session exchange, redirect to `next` (default `/dashboard`, `/auth/reset-password` for recovery) |
| [app/(auth)/auth/signout/route.ts](app/(auth)/auth/signout/route.ts) | `POST` | Sign out, redirect to `/login` |

Only one true `app/api/` route exists today; the two `(auth)/auth/.../route.ts` handlers are colocated with the auth pages rather than under `api/`.
