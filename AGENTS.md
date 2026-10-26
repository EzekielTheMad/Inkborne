<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Inkborne brand and design

- Read [the Inkborne brand guide](docs/brand-reference.md) before UI, visual design, or user-facing copy work. It is the canonical brand direction and supersedes conflicting visual or copy instructions in older briefs and mockup bundles.
- Treat the guide as the target style; inspect the current implementation before describing anything as shipped. Current CSS tokens live in `app/globals.css`.
- Evolve the existing fantasy notebook personality. Preserve the selected Scribe identity, coordinated light/dark themes, and theme-aware character personalization described in the guide.
- Preserve existing functionality and accessibility. Apply the guide within the requested scope, with gradual rollout to stable screens; it does not authorize an unrelated site-wide restyle.
- Before changing an existing screen, render representative current views and capture its visual baseline. Compare at matching viewport, theme, character and accent; preserve useful density, identity and interaction patterns.
- The approved second character-sheet composition evolves the [original sheet baseline](docs/design-briefs/character-sheet-baseline/README.md). The first neutral notebook draft was not accepted and must not become a template for later screens.
- Keep simulated local review evidence separate from hosted persistence and acceptance. A visual migration must preserve the release baseline's gameplay contracts and must not import unrelated development ancestry.
