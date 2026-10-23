# Character sheet refresh: scoped dev release

23 October 2026. The user approved the second local composition and requested
deployment to `dev.inkborne.app`, preserving existing gameplay, light/dark modes
and character accent colors. This authorizes this bounded dev release.

## Source and target

- Live dev source: `99acb2cf4515b8346997849ccafdc081a6f7228f`.
- Release base: `d5c5020e67d5c55aa64594580fd819a117cdaa7c`, the same runtime
  plus the preceding auth receipt, hosted tests and screenshots.
- Approved visual source: `85d627ccb554fcd0ab28b7da7d206890b97560ad`.
- Release branch: `codex/character-sheet-dev-20261023`, reusing the clean, idle
  `C:\Users\kaios\Documents\Codex\2026-10-22\inkborne-homepage-dev` checkout.
- Mapped remote dev branch: `fix/builder-ability-save-order`.
- Vercel project: `prj_LWMhTpauZDDqLACtHhvIg6vTQ0W1` (`inkborne`).
- Vercel team: `team_gZZdNu24Ux7R6F93mtOzojtj`.
- Previous dev / rollback deployment: `dpl_EXbznyqzLHGXboJSzfFTjfQ1DaLB`,
  `inkborne-47ybxbtet-ezekielthemads-projects.vercel.app`.
- Apex to preserve: `dpl_HAxoR5oLVQ23fvsnLETZ6pxwjptA`, source
  `6b8601f976d3ee121d11f2ec33c7383393024b91` on `main`.

Live connected reads verified the team, project, READY Preview deployment,
exact source, dev-domain branch mapping and apex. The remote mapped branch and
`main` matched those sources. Reconfirm immediately before publication.

## Scoped runtime allowlist

Only the presentation delta from the preview is transplanted. These 29 runtime
files change relative to the dev release base:

```text
app/(app)/layout.tsx
components/character/character-notebook-scope.tsx
components/character/character-notebook.module.css
components/character/character-page-client.tsx
components/character/character-route-frame.tsx
components/character/character-shell.tsx
components/character/color-picker-popover.tsx
components/character/sheet-panel.tsx
components/nav/app-nav.tsx
components/nav/character-appearance.tsx
components/nav/mobile-nav.tsx
components/sheet/ability-card.tsx
components/sheet/character-header.tsx
components/sheet/combat-stats.tsx
components/sheet/content-tabs.tsx
components/sheet/hp-tracker.tsx
components/sheet/mobile-sheet.tsx
components/sheet/rolls/roll-popover.tsx
components/sheet/spells/spell-row.tsx
components/sheet/stat-ribbon.tsx
components/ui/dialog.tsx
components/ui/drawer.tsx
components/ui/dropdown-menu.tsx
components/ui/popover.tsx
components/ui/select.tsx
components/ui/sheet.tsx
components/ui/tooltip.tsx
lib/character/notebook-colors.ts
lib/character/notebook-route.ts
```

The remaining changes are tests, bounded loopback-only fixtures/server, the brand
guide, visual references and release documentation. The shared theme/provider,
appearance menu and Scribe SVGs already match the approved source and are retained.

The current dev root layout, authentication, gameplay libraries/provider contract,
state writers, HP/roll/stat math, persistence calls, schemas, migrations, package
and lockfile remain unchanged. Newer integration mechanics, conditional/CAS
writers, ASI guards, race notices and print features from the preview's ancestry
are excluded. Existing dev currency still autosaves. Five three-way conflicts
were resolved by retaining dev behavior and applying visual wrappers/classes only.

The existing mobile casting drawer also receives the same character portal scope
as dialogs and popovers. Portal scope emits no additional DOM outside a character
context. Global navigation remains in brand scope; character content and its
portals carry both theme maps derived from the saved source. Errors, success,
warning and focus roles remain independent.

## Complete external change list and rollback

The publication action is one normal fast-forward push of the verified release
commit to `fix/builder-ability-save-order`. Existing Vercel Git integration then
builds Preview using its unchanged configured environment and assigns the existing
dev custom domain and branch alias. No manual restart is required; a browser
reload loads the new assets. The local placeholder build is never uploaded.

There is no push to `main`, production promotion, apex reassignment, hosted
environment/security change, migration, account creation or hosted gameplay write.

If hosted smoke checks fail, restore only `dev.inkborne.app` to the recorded
previous dev deployment and verify it. Repair the mapped branch before a later
push so it cannot silently replace the rollback. Do not promote or roll back the
apex production deployment.

## Verification and limits

Use `npm run check`, `npm run build`, the dedicated `e2e/local-sheet` suite and
the existing `e2e/local-auth` / `e2e/local-homepage` suites. The candidate retains
dev's Next.js 16.2.10 and its existing dependency lockfile. Builds use loopback
public placeholders; no hosted credentials are needed for these checks.

The sheet fixture runs real candidate components/provider against original
fictional characters and explicit local persistence adapters. It covers gameplay
controls, both themes, custom accent extremes and per-character retention, portals,
desktop/mobile spell casting, responsive layouts and long content. It imports no
newer print/provider-mechanics support. See its README for exact boundaries.

After publication, verify READY Preview with the exact release SHA, the dev alias,
public routes/assets, retained authentication boundary, and unchanged apex.
Authenticated hosted character saves and real account/provider actions remain
separate user testing; simulated local persistence is not hosted acceptance.

Independent read-only review of the runtime transplant found no blocking gameplay,
dependency, authentication, scope or portal regression. Final candidate and hosted
results are recorded in the deployment receipt after completion.

Candidate validation completed before publication:

- `npm run check`: typecheck, zero-warning lint, all 204 files / 1,902 tests
  passed in 95.14 seconds.
- Final `npm run build`: Next.js 16.2.10 production build passed with loopback
  public placeholders. No local build output is uploaded.
- Dedicated local sheet browser suite: all 12 cases passed in 55.0 seconds.
  Desktop casting and both Light/Dark mobile Vaul casting passed, including
  scoped portal roles, slot consumption and concentration.
- Existing local auth suite: all five cases passed in 30.7 seconds.
- Existing local homepage suite: all 11 cases passed in 25.7 seconds.
- Typecheck and zero-warning lint passed again after the final fixture changes.
- Independent final review includes the mobile drawer scope and isolated fixture;
  no blocking issue remained. Runtime changes stay within the allowlist above.

The initial fixture supplied a structured weapon range to the older dev Actions
UI, which expects a legacy string range/damage shape. This caused a fixture-only
render failure. Only fictional test data was adapted; the production parser and
gameplay behavior were left unchanged. Unknown operations/external requests remain
test failures. No live character or hosted write was used.
