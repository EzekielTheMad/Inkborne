# Local homepage notebook refresh

Implement the approved brand guide v2.3 and Revision 4 illustrated homepage composition as a bounded application change. This evolves the previous Revision 3 alternating vignettes into an original illustrated hero and one explorable notebook. Keep the work local for review; no push, merge, deployment, or hosted data changes.

## Scope

- Keep the homepage's server authentication gate and signed-in redirect to `/dashboard`.
- Pair the expressive hero with original character artwork, readable sheet statistics, and a separate session note. Keep essential content unobscured by paper overlap.
- Present Character, Journal, and Homebrew through one keyboard-accessible notebook with Roman folios, bookmark tabs, and a deliberately stacked mobile layout. Preserve private-alpha messaging, the open-source section, closing action, and existing navigation destinations.
- Support site-default, preset, and custom character accents within this fictional example. Derive readable roles for both themes before hydration, retain the chosen source through chapters and theme changes, and reset to the site accent on reload. Do not persist the demo into actual characters or recolor global branding.
- Use the verified Scribe ink and reverse lockups on the homepage. Leave shared authenticated branding and character pages for a separate migration.
- Keep only Sign in as the header's account entry, visible on desktop and mobile. Place Start building in the hero and closing section. Replace the visible appearance selector with a compact sun/moon button and an accessible Light/Dark/System menu.
- Scope the new paper and ink-purple/gold palettes to the homepage. Reuse the existing `inkborne-theme` preference and document theme owner for Light, Dark, and System.
- Initialize saved/System appearance before paint, tolerate unavailable storage, and keep control hydration consistent. Preserve the current shared Dark default and custom character data.
- Remove homepage competitor comparisons, invented testimonials, and unsupported feature, persistence, or offline promises. No prototype-only review links or controls ship into the product.

## Verification

Run `npm run check`, a production build, and the existing `test:e2e` script with a dedicated anonymous local homepage configuration. The configuration must omit hosted auth setup and fixture cleanup; use loopback-only public client configuration and no credentials. Exercise theme persistence, System changes, keyboard bookmark navigation, inactive-panel accessibility, character-accent retention/reset, actual rendered contrast at custom-color extremes, reduced motion, logo treatments, anchor/auth links, desktop/mobile layout, and absent competitor/testimonial copy. Reject hosted browser requests and network mutations. Verify the existing signed-in redirect with a mocked server test rather than creating live sessions. Browser proof covers the local application; it does not establish provider sign-in or hosted acceptance.

Record changed files, test results, local commit, review screenshots, start command, and any remaining limitations before handoff. Stop task-owned verification servers when finished unless the user requests a running server.
