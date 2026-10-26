# Local overview review

This harness imports the actual async DashboardPage and CharactersPage functions, actual character rows/cards, AppNav, MobileNav, FeedbackProvider, ThemeProvider, and CharacterRouteFrame. Only Next navigation/link/image and Supabase/action I/O boundaries are adapted. No application demo route or authentication bypass is added.

All characters, profiles, systems, and campaigns are original fictional fixture data. The strict query adapter honors the actual selected columns, owner/archive filters, ordering contract and limit. Presets include site-default, forest, purple, white, black, long identity/metadata, and an unwritten character.

## Run

Use the existing package scripts after a production build. Supply non-secret local public placeholders in the build shell if no local Supabase configuration is present; that build is for local review only. From the repository:

```
node scripts/serve-overview-review.mjs
npm.cmd run test:e2e -- --config e2e/local-overview/playwright.config.ts
```

The server binds only `127.0.0.1:3198` and accepts only GET/HEAD. It uses the existing production CSS and font assets, rebasing concatenated font URLs. It bundles once on startup; restart this exact owned process after a source change. Check its metadata under `test-results/local-overview-bundle/server-process.json` before stopping or restarting it.

For an external scratch harness, set `INKBORNE_REVIEW_SOURCE` to the repository path. Output remains inside the scratch folder; repository source is read-only. Optional `INKBORNE_OVERVIEW_PORT` changes the port, but tests/capture expect3198 by default.

## Routes and states

- `/dashboard`, `/characters`
- `?scenario=empty`, `single`, `error`, `long`; default is populated.
- `?alpha=visible` shows the real AlphaBanner on dashboard. Dismissal is explicitly simulated in session storage. No profile is written.
- `?name=long` exercises a long profile greeting.
- The review-only theme selector uses the real shared ThemeProvider. Source pages retain their actual navigation appearance behavior.

## Boundaries

The server sends a self-only content security policy with external network, frames, and forms blocked. Browser tests additionally allow only GET/HEAD to their exact loopback origin. All reads return fixture objects; unexpected tables, sorting, RPCs and operations throw. Character and builder destinations outside the two reviewed pages are identified as unavailable locally. Real signout forms are blocked; feedback returns an explicit local-review error and never sends.

Theme preference uses the normal browser storage key. Banner dismissal uses a harness-specific session storage key. Neither changes hosted data. This is component/browser evidence with simulated reads, not proof of hosted server rendering, authentication, RLS, live queries, persisted banner preference, feedback delivery, builder navigation, or character editing.

## Original baseline

Captured from unchanged26a76a7 before visual edits. Desktop viewport1440×1000 and mobile390×844 were captured for both pages in both theme preferences, plus desktop dark empty/single/error/long states. Existing unmigrated Light CSS mirrors Dark. The mobile populated character shelf already overflows to742px with long metadata; that is a baseline finding, not a refresh regression.

The original external capture helper recorded actual query calls, browser errors, unexpected network and screenshot paths. Its 16 screenshots completed with no page errors or unexpected requests. The frozen original server was stopped before the candidate bundle started. [Preserved references](../../docs/design-briefs/overview-notebook-local/README.md) contain both sets of images.
