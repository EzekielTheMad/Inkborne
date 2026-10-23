# Bounded local sheet candidate verification

This suite bundles the actual candidate character page, provider, navigation,
theme owner, sheet controls and Narrative surfaces. It supplies original fictional
fighter/wizard data and replaces external persistence at explicit module edges.
It is separate from the authenticated Next route and does not add a demo route,
auth bypass, hosted account or hosted data to the application.

Run the candidate's normal production build first, then:

```text
npm.cmd run test:e2e -- --config e2e/local-sheet/playwright.config.ts
```

The server binds only `127.0.0.1:3196`. Stop any candidate Next regression server
on that port before this suite. Existing review/reference servers on 3192, 3194
and 3195 must be preserved. Playwright can start/stop this bounded server; it
records process metadata under `test-results/local-sheet-bundle/server-process.json`.

The browser permits only GET/HEAD requests to the exact loopback origin; external
requests and browser exceptions fail tests. The HTTP server rejects other methods
and paths outside its small static allowlist. Persistence stays in the separate
`inkborne-dev-sheet-review-v1:` browser storage namespace. Unknown adapter
operations fail and are asserted absent. Feedback, uploads/deletions and story
record mutations explicitly report unavailable. No live auth/database/network
acceptance is claimed.

## Candidate behavior retained

This fixture targets the existing dev gameplay contracts, based on `d5c5020` / live
`99acb2c`. `fixture-data.ts` is self-contained test data. It imports no print model,
new provider-mechanics fixture, ASI authority or conditional writer. Class, feature
and spell data use existing dev schemas; the fictional weapon uses the legacy
string range/damage shape consumed by the unchanged dev Actions UI. The evaluator and provider
compute their normal values. Only `patch_character_state` is modeled as an atomic
shallow merge. The newer integration's conditional/CAS behavior is rejected.

The 12 browser stories cover both themes and System/reload; six widths; long admin
navigation; saved independent accents/reset; rendered gradient/text/focus/input/
portal contrast; successful HP/temp HP/inspiration; real rolls/history; currency,
quick and session notes; loaded spell details/manual slots/successful casting and
concentration; Narrative editing; seven mobile sections/reduced motion; death-save
pips; the existing long-rest action; and long identity/story content at 320 px.
Actual successful casting is checked on desktop and in the mobile Vaul drawer.
Both mobile themes assert that the portaled drawer retains the active character's
source accent and neutral roles, has an opaque surface and readable Cast button,
then verify slot consumption and the saved concentration record.

Currency autosaves through the existing dev input instead of a newer Save button.
Its current denomination text is a paragraph rather than an accessible input label,
so the fixture selects the GP input by its existing denomination order. This does
not change product behavior or claim the older widget's labeling was repaired.

The existing dev sheet has no print action or newer conditional-save error UI.
This suite does not simulate or assert those features. It does not prove server
hydration, hosted RLS/concurrency, provider auth, real-account saves, native touch
swiping, image/story-record writes or physical/PDF printing. Authenticated hosted
character UAT remains separate.
