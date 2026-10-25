# Dashboard and character shelf — local notebook polish

24 October 2026. Local candidate for review; not approved or deployed.

The user asked to continue the refresh by looking at each existing page and polishing it without losing its charm. This round covers `/dashboard` and `/characters`. The starting point is the released sheet checkout at `26a76a7`; the separate mechanics integration and older backup remain untouched.

## Original composition

The actual async page functions, character components, navigation and theme owner were rendered before visual edits. Only their external I/O edges were replaced with fictional data in a separate loopback harness. The original bundle was frozen while these images were captured. This is a component rendering baseline, not an authenticated hosted-page capture.

Keep the original personal greeting, gold Garamond italic name, Marcellus identities, Home/The shelf folios, centered star rule, portrait-led featured character and faint ink wash. Retain the compact character rows, illustrated blank notebook, unwritten labels, and quiet Shared worlds strip. The shelf remains a card grid with system and campaign details.

| Same data and viewport | Before | Local candidate |
| --- | --- | --- |
| Dashboard, desktop Dark | [Before](baseline/original-dashboard-desktop-dark.png) | [After](after/dashboard-1440-dark.png) |
| Dashboard, desktop Light | [Before](baseline/original-dashboard-desktop-light.png) | [After](after/dashboard-1440-light.png) |
| Dashboard, mobile Dark | [Before](baseline/original-dashboard-mobile-dark.png) | [After](after/dashboard-390-dark.png) |
| Dashboard, mobile Light | [Before](baseline/original-dashboard-mobile-light.png) | [After](after/dashboard-390-light.png) |
| Characters, desktop Dark | [Before](baseline/original-characters-desktop-dark.png) | [After](after/characters-1440-dark.png) |
| Characters, desktop Light | [Before](baseline/original-characters-desktop-light.png) | [After](after/characters-1440-light.png) |
| Characters, mobile Dark | [Before](baseline/original-characters-mobile-dark.png) | [After](after/characters-390-dark.png) |
| Characters, mobile Light | [Before](baseline/original-characters-mobile-light.png) | [After](after/characters-390-light.png) |

Desktop: 1440 × 1000. Mobile: 390 × 844. These are full-page captures; image height can exceed the viewport. Both original theme preferences used the legacy Dark palette. The original mobile shelf expanded to 742 px with long metadata; the candidate stays within its 390 px viewport. The toolbar above the real app header belongs only to the local review harness.

Additional narrow references cover [long character metadata](after/characters-long-320.png), the [blank notebook](after/dashboard-empty-320.png), and a [failed shelf read](after/characters-error-320.png). The original [capture report](baseline/baseline-report.json) records queries, widths and zero browser exceptions or unexpected requests. Its absolute screenshot paths identify the original scratch capture location; the PNGs are preserved here.

## Bounded changes

- Extend the existing Scribe logo and coordinated brand frame to these two exact routes, with the existing compact appearance menu and shared Light/Dark/System preference.
- Keep the original composition and ornaments. Refine type hierarchy, spacing, practical controls, focus, name wrapping and mobile metadata. Shelf names allow two lines, retaining full accessible text and a native title.
- Give every character its own derived accent border, portrait ring and level treatment. Preserve saved source values, theme-aware defaults and independent global branding. This adds no color editor or persistence changes.
- Call the featured entry “Your latest character,” matching the existing newest-created query. Remove unsupported completion-time claims. Distinguish failed character reads from successful empty reads.

The dashboard adds only `primary_color` to its existing projection. Owner/archive filters, ordering, eight-item limit, shelf joins, creation/card/campaign destinations, alpha dismissal action, feedback, authentication, gameplay and persistence handlers remain intact. Unwritten cards still open their character route.

## Verification and review

- `npm.cmd run check`: passed, 207 test files / 1,941 tests.
- `npm.cmd run build`: passed with non-secret, non-working public Supabase placeholders supplied only to that shell. This build is for local verification and must not be deployed.
- `npm.cmd run test:e2e -- --config e2e/local-overview/playwright.config.ts`: 11 passed. Actual page/component browser coverage includes themes and reload/navigation, System changes, independent default/forest/purple/white/black/gold/blue entries, rendered text/action/hover/focus contrast, 320/390/768/1024/1440 px layouts, long content, empty/single/error states, mobile navigation, simulated alpha dismissal and the feedback sending boundary.
- Independent source review and matched visual review: no blockers. Small level-badge wrapping differences remain acceptable for this review.

Character source maps are unchanged by theme switching. Ordinary measured text meets 4.5:1 and measured focus meets 3:1. Accent derivation uses the existing tested resolver; these checks do not constitute an exhaustive accessibility audit of every descendant or legacy page.

Open [Dashboard](http://127.0.0.1:3198/dashboard) or [Characters](http://127.0.0.1:3198/characters). The actual application appearance button works; the extra review toolbar exposes example states. [Harness details](../../../e2e/local-overview/README.md) document the explicit data boundaries. Reads are fictional, banner dismissal is simulated, feedback is not sent, and character/builder/account destinations outside these two pages are blocked locally. Live authentication, RLS, server queries, persisted preferences and feedback delivery were not exercised.

Further pages should start with their own real baseline. This local candidate is not user acceptance or authorization to deploy.
